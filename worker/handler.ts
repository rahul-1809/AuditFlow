import { hashPassword, verifyPassword, encryptCredential, decryptCredential } from './crypto.ts';

export interface Env {
  DB: any; // Cloudflare D1Database
  CREDENTIALS_SECRET?: string;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

function addMonthsToPeriod(period: string, numMonths: number): string {
  const parts = period.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const totalMonths = y * 12 + (m - 1) + numMonths;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, '0')}`;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function ensureRecurringOccurrences(db: any): Promise<number> {
  const { results: recurringTasks } = await db
    .prepare(
      `SELECT * FROM tasks 
       WHERE task_type IN ('recurring_monthly', 'recurring_quarterly')
       ORDER BY month ASC, created_at ASC`
    )
    .all();

  if (!recurringTasks || recurringTasks.length === 0) return 0;

  const groups = new Map<string, any[]>();
  for (const task of recurringTasks) {
    const key = `${task.client_id}:::${task.title}:::${task.task_type}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(task);
  }

  const currentMonth = getCurrentMonth();
  let createdCount = 0;

  for (const [, taskList] of groups.entries()) {
    const sample = taskList[taskList.length - 1];
    const taskType = sample.task_type;
    const stepMonths = taskType === 'recurring_quarterly' ? 3 : 1;

    const months = taskList.map((t) => t.month || '').filter(Boolean).sort();
    let latestMonth = months.length > 0 ? months[months.length - 1] : currentMonth;
    const limitMonth = addMonthsToPeriod(currentMonth, stepMonths);

    let nextMonth = addMonthsToPeriod(latestMonth, stepMonths);
    while (nextMonth <= limitMonth) {
      const exists = await db
        .prepare('SELECT id FROM tasks WHERE client_id = ? AND title = ? AND month = ?')
        .bind(sample.client_id, sample.title, nextMonth)
        .first();

      if (!exists) {
        const id = `t-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const now = new Date().toISOString();
        let newDueDate: string | null = null;
        if (sample.due_date && sample.due_date.length >= 10) {
          newDueDate = `${nextMonth}-${sample.due_date.slice(8, 10)}`;
        }

        await db
          .prepare(
            `INSERT INTO tasks (id, client_id, title, category, task_type, assigned_to, due_date, status, month, notes, rework_comment, in_others, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'todo', ?, ?, null, 0, ?, ?)`
          )
          .bind(
            id,
            sample.client_id,
            sample.title,
            sample.category || 'GST',
            taskType,
            sample.assigned_to,
            newDueDate,
            nextMonth,
            sample.notes || null,
            now,
            now
          )
          .run();
        createdCount++;
      }

      nextMonth = addMonthsToPeriod(nextMonth, stepMonths);
    }
  }

  return createdCount;
}

export async function handleApiRequest(
  request: Request,
  env: Env,
  _ctx?: { waitUntil?: (p: Promise<any>) => void }
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    // Health check
    if (path === '/api/health' && method === 'GET') {
      return jsonResponse({
        status: 'ok',
        platform: 'Cloudflare Workers + D1',
        time: new Date().toISOString(),
      });
    }

    // -----------------------------------------------------------
    // Auth Endpoints
    // -----------------------------------------------------------
    if (path === '/api/auth/login' && method === 'POST') {
      const body: any = await request.json().catch(() => ({}));
      const { email, password } = body;
      if (!email || !password) {
        return jsonResponse({ error: 'Username/Email and password are required.' }, 400);
      }

      const user: any = await env.DB
        .prepare('SELECT * FROM users WHERE lower(email) = lower(?)')
        .bind(email.trim())
        .first();

      if (!user) {
        return jsonResponse({ error: 'User account not found.' }, 401);
      }

      if (user.status === 'inactive') {
        return jsonResponse({ error: 'Account is deactivated. Contact system administrator.' }, 403);
      }

      const isValid = verifyPassword(password, user.password_salt, user.password_hash);
      if (!isValid) {
        return jsonResponse({ error: 'Invalid password. Please try again.' }, 401);
      }

      const { password_hash, password_salt, ...safeUser } = user;
      return jsonResponse({ success: true, user: safeUser });
    }

    // -----------------------------------------------------------
    // Users Management
    // -----------------------------------------------------------
    if (path === '/api/users' && method === 'GET') {
      const { results: users } = await env.DB
        .prepare('SELECT id, email, name, role, status, created_at FROM users ORDER BY created_at ASC')
        .all();
      return jsonResponse(users || []);
    }

    if (path === '/api/users' && method === 'POST') {
      const body: any = await request.json().catch(() => ({}));
      const { name, email, password } = body;
      if (!name || !email || !password) {
        return jsonResponse({ error: 'Name, email, and password are required.' }, 400);
      }

      const existing = await env.DB
        .prepare('SELECT id FROM users WHERE lower(email) = lower(?)')
        .bind(email.trim())
        .first();

      if (existing) {
        return jsonResponse({ error: 'A user with this email already exists.' }, 409);
      }

      const id = `u-${Date.now()}`;
      const now = new Date().toISOString();
      const { hash, salt } = hashPassword(password);

      await env.DB
        .prepare(
          `INSERT INTO users (id, email, name, role, password_hash, password_salt, status, created_at)
           VALUES (?, ?, ?, 'assistant', ?, ?, 'active', ?)`
        )
        .bind(id, email.trim().toLowerCase(), name.trim(), hash, salt, now)
        .run();

      const created = await env.DB
        .prepare('SELECT id, email, name, role, status, created_at FROM users WHERE id = ?')
        .bind(id)
        .first();

      return jsonResponse(created, 201);
    }

    // PUT /api/users/:id
    const userMatch = path.match(/^\/api\/users\/([^/]+)$/);
    if (userMatch && method === 'PUT') {
      const id = userMatch[1];
      const body: any = await request.json().catch(() => ({}));
      const { name, email, status } = body;

      const current: any = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
      if (!current) {
        return jsonResponse({ error: 'User not found.' }, 404);
      }

      const updatedName = name !== undefined ? name.trim() : current.name;
      const updatedEmail = email !== undefined ? email.trim().toLowerCase() : current.email;
      const updatedStatus = status !== undefined ? status : current.status;

      await env.DB
        .prepare('UPDATE users SET name = ?, email = ?, status = ? WHERE id = ?')
        .bind(updatedName, updatedEmail, updatedStatus, id)
        .run();

      const updated = await env.DB
        .prepare('SELECT id, email, name, role, status, created_at FROM users WHERE id = ?')
        .bind(id)
        .first();

      return jsonResponse(updated);
    }

    // POST /api/users/:id/reset-password
    const resetPassMatch = path.match(/^\/api\/users\/([^/]+)\/reset-password$/);
    if (resetPassMatch && method === 'POST') {
      const id = resetPassMatch[1];
      const body: any = await request.json().catch(() => ({}));
      const { newPassword } = body;
      if (!newPassword) {
        return jsonResponse({ error: 'New password is required.' }, 400);
      }

      const user = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
      if (!user) {
        return jsonResponse({ error: 'User not found.' }, 404);
      }

      const { hash, salt } = hashPassword(newPassword);
      await env.DB
        .prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?')
        .bind(hash, salt, id)
        .run();

      return jsonResponse({ success: true, message: 'Password updated successfully.' });
    }

    // DELETE /api/users/:id
    if (userMatch && method === 'DELETE') {
      const id = userMatch[1];
      const user: any = await env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(id).first();
      if (!user) {
        return jsonResponse({ error: 'User not found.' }, 404);
      }
      if (user.role === 'admin') {
        return jsonResponse({ error: 'Primary Admin account cannot be deleted.' }, 400);
      }

      await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
      return jsonResponse({ success: true, message: 'User deleted successfully.' });
    }

    // -----------------------------------------------------------
    // Clients Management
    // -----------------------------------------------------------
    if (path === '/api/clients' && method === 'GET') {
      const { results: clients } = await env.DB
        .prepare('SELECT * FROM clients ORDER BY created_at DESC')
        .all();

      const parsed = (clients || []).map((c: any) => ({
        ...c,
        client_types:
          typeof c.client_types === 'string'
            ? (() => {
                try {
                  return JSON.parse(c.client_types || '[]');
                } catch {
                  return [];
                }
              })()
            : c.client_types || [],
      }));

      return jsonResponse(parsed);
    }

    if (path === '/api/clients' && method === 'POST') {
      const body: any = await request.json().catch(() => ({}));
      const { name, contact_person, phone, email, gstin, pan, notes, client_types, credentials } = body;
      if (!name) {
        return jsonResponse({ error: 'Client name is required.' }, 400);
      }

      const id = `c-${Date.now()}`;
      const now = new Date().toISOString();
      const typesJson = Array.isArray(client_types)
        ? JSON.stringify(client_types)
        : client_types || '[]';

      await env.DB
        .prepare(
          `INSERT INTO clients (id, name, contact_person, phone, email, gstin, pan, notes, client_types, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          name.trim(),
          contact_person || '',
          phone || '',
          email || '',
          (gstin || '').toUpperCase(),
          (pan || '').toUpperCase(),
          notes || '',
          typesJson,
          now
        )
        .run();

      // If credentials provided directly in client creation, encrypt and insert
      if (Array.isArray(credentials) && credentials.length > 0) {
        for (let i = 0; i < credentials.length; i++) {
          const cred = credentials[i];
          if (cred.portal_name && cred.username && cred.password) {
            const credId = `cr-${Date.now()}-${i}`;
            const enc = encryptCredential(cred.password, env.CREDENTIALS_SECRET);
            await env.DB
              .prepare(
                `INSERT INTO client_credentials (id, client_id, portal_name, portal_url, username, encrypted_password, iv, tag, notes, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
              )
              .bind(
                credId,
                id,
                cred.portal_name.trim(),
                cred.portal_url || null,
                cred.username.trim(),
                enc.encrypted,
                enc.iv,
                enc.tag,
                cred.notes || null,
                now
              )
              .run();
          }
        }
      }

      const created: any = await env.DB.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first();
      return jsonResponse(
        {
          ...created,
          client_types: Array.isArray(client_types)
            ? client_types
            : JSON.parse(created?.client_types || '[]'),
        },
        201
      );
    }

    const clientMatch = path.match(/^\/api\/clients\/([^/]+)$/);
    if (clientMatch && method === 'PUT') {
      const id = clientMatch[1];
      const body: any = await request.json().catch(() => ({}));
      const { name, contact_person, phone, email, gstin, pan, notes, client_types } = body;

      const current: any = await env.DB.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first();
      if (!current) {
        return jsonResponse({ error: 'Client not found.' }, 404);
      }

      const updatedTypes = Array.isArray(client_types)
        ? JSON.stringify(client_types)
        : client_types !== undefined
        ? client_types
        : current.client_types;

      await env.DB
        .prepare(
          `UPDATE clients 
           SET name = ?, contact_person = ?, phone = ?, email = ?, gstin = ?, pan = ?, notes = ?, client_types = ?
           WHERE id = ?`
        )
        .bind(
          name !== undefined ? name.trim() : current.name,
          contact_person !== undefined ? contact_person : current.contact_person,
          phone !== undefined ? phone : current.phone,
          email !== undefined ? email : current.email,
          gstin !== undefined ? gstin.toUpperCase() : current.gstin,
          pan !== undefined ? pan.toUpperCase() : current.pan,
          notes !== undefined ? notes : current.notes,
          updatedTypes,
          id
        )
        .run();

      const updated: any = await env.DB.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first();
      return jsonResponse({
        ...updated,
        client_types:
          typeof updated.client_types === 'string'
            ? JSON.parse(updated.client_types || '[]')
            : updated.client_types || [],
      });
    }

    if (clientMatch && method === 'DELETE') {
      const id = clientMatch[1];
      await env.DB.prepare('DELETE FROM clients WHERE id = ?').bind(id).run();
      return jsonResponse({ success: true });
    }

    // -----------------------------------------------------------
    // Client Portal Credentials
    // -----------------------------------------------------------
    if (path === '/api/credentials' && method === 'GET') {
      const clientId = url.searchParams.get('clientId');
      let rows: any[] = [];
      if (clientId) {
        const { results } = await env.DB
          .prepare('SELECT * FROM client_credentials WHERE client_id = ? ORDER BY updated_at DESC')
          .bind(clientId)
          .all();
        rows = results || [];
      } else {
        const { results } = await env.DB
          .prepare('SELECT * FROM client_credentials ORDER BY updated_at DESC')
          .all();
        rows = results || [];
      }

      const credentials = rows.map((r: any) => ({
        id: r.id,
        client_id: r.client_id,
        portal_name: r.portal_name,
        portal_url: r.portal_url,
        username: r.username,
        password_decrypted: decryptCredential(
          r.encrypted_password,
          r.iv,
          r.tag,
          env.CREDENTIALS_SECRET
        ),
        notes: r.notes,
        updated_at: r.updated_at,
      }));

      return jsonResponse(credentials);
    }

    if (path === '/api/credentials' && method === 'POST') {
      const body: any = await request.json().catch(() => ({}));
      const { client_id, portal_name, portal_url, username, password, notes } = body;
      if (!client_id || !portal_name || !username || !password) {
        return jsonResponse(
          { error: 'client_id, portal_name, username, and password are required.' },
          400
        );
      }

      const id = `cr-${Date.now()}`;
      const now = new Date().toISOString();
      const enc = encryptCredential(password, env.CREDENTIALS_SECRET);

      await env.DB
        .prepare(
          `INSERT INTO client_credentials (id, client_id, portal_name, portal_url, username, encrypted_password, iv, tag, notes, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          client_id,
          portal_name.trim(),
          portal_url || null,
          username.trim(),
          enc.encrypted,
          enc.iv,
          enc.tag,
          notes || null,
          now
        )
        .run();

      const created = {
        id,
        client_id,
        portal_name: portal_name.trim(),
        portal_url: portal_url || null,
        username: username.trim(),
        password_decrypted: password,
        notes: notes || null,
        updated_at: now,
      };

      return jsonResponse(created, 201);
    }

    const credMatch = path.match(/^\/api\/credentials\/([^/]+)$/);
    if (credMatch && method === 'PUT') {
      const id = credMatch[1];
      const body: any = await request.json().catch(() => ({}));
      const { portal_name, portal_url, username, password, notes } = body;

      const current: any = await env.DB
        .prepare('SELECT * FROM client_credentials WHERE id = ?')
        .bind(id)
        .first();

      if (!current) {
        return jsonResponse({ error: 'Credential not found.' }, 404);
      }

      let enc = {
        encrypted: current.encrypted_password,
        iv: current.iv,
        tag: current.tag,
      };

      if (password) {
        enc = encryptCredential(password, env.CREDENTIALS_SECRET);
      }

      const now = new Date().toISOString();

      await env.DB
        .prepare(
          `UPDATE client_credentials 
           SET portal_name = ?, portal_url = ?, username = ?, encrypted_password = ?, iv = ?, tag = ?, notes = ?, updated_at = ?
           WHERE id = ?`
        )
        .bind(
          portal_name || current.portal_name,
          portal_url !== undefined ? portal_url : current.portal_url,
          username || current.username,
          enc.encrypted,
          enc.iv,
          enc.tag,
          notes !== undefined ? notes : current.notes,
          now,
          id
        )
        .run();

      const updated: any = await env.DB
        .prepare('SELECT * FROM client_credentials WHERE id = ?')
        .bind(id)
        .first();

      return jsonResponse({
        id: updated.id,
        client_id: updated.client_id,
        portal_name: updated.portal_name,
        portal_url: updated.portal_url,
        username: updated.username,
        password_decrypted: decryptCredential(
          updated.encrypted_password,
          updated.iv,
          updated.tag,
          env.CREDENTIALS_SECRET
        ),
        notes: updated.notes,
        updated_at: updated.updated_at,
      });
    }

    if (credMatch && method === 'DELETE') {
      const id = credMatch[1];
      await env.DB.prepare('DELETE FROM client_credentials WHERE id = ?').bind(id).run();
      return jsonResponse({ success: true });
    }

    // -----------------------------------------------------------
    // Tasks Management
    // -----------------------------------------------------------
    if (path === '/api/tasks' && method === 'GET') {
      try {
        await ensureRecurringOccurrences(env.DB);
      } catch (err) {
        console.error('Error generating recurring occurrences:', err);
      }

      const { results: tasks } = await env.DB
        .prepare('SELECT * FROM tasks ORDER BY created_at DESC')
        .all();
      return jsonResponse(tasks || []);
    }

    if (path === '/api/tasks' && method === 'POST') {
      const body: any = await request.json().catch(() => ({}));
      const { client_id, title, category, task_type, assigned_to, due_date, status, month, notes } = body;
      if (!client_id || !title || !assigned_to) {
        return jsonResponse({ error: 'client_id, title, and assigned_to are required.' }, 400);
      }

      const id = `t-${Date.now()}`;
      const now = new Date().toISOString();
      const taskMonth =
        month || (due_date && due_date.length >= 7 ? due_date.slice(0, 7) : getCurrentMonth());
      const type = task_type || 'one_time';

      let taskCategory = category ? category.trim() : null;
      if (!taskCategory) {
        const client: any = await env.DB
          .prepare('SELECT client_types FROM clients WHERE id = ?')
          .bind(client_id)
          .first();

        if (client) {
          try {
            const types = JSON.parse(client.client_types || '[]');
            taskCategory = types[0] || 'GST';
          } catch {
            taskCategory = 'GST';
          }
        } else {
          taskCategory = 'GST';
        }
      }

      await env.DB
        .prepare(
          `INSERT INTO tasks (id, client_id, title, category, task_type, assigned_to, due_date, status, month, notes, rework_comment, in_others, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, null, 0, ?, ?)`
        )
        .bind(
          id,
          client_id,
          title.trim(),
          taskCategory,
          type,
          assigned_to,
          due_date || null,
          status || 'todo',
          taskMonth,
          notes || null,
          now,
          now
        )
        .run();

      if (type === 'recurring_monthly' || type === 'recurring_quarterly') {
        try {
          await ensureRecurringOccurrences(env.DB);
        } catch (err) {
          console.error('Error creating subsequent recurring occurrence:', err);
        }
      }

      const created = await env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();
      return jsonResponse(created, 201);
    }

    // POST /api/tasks/:id/move-to-others
    const moveMatch = path.match(/^\/api\/tasks\/([^/]+)\/move-to-others$/);
    if (moveMatch && method === 'POST') {
      const id = moveMatch[1];
      const current = await env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();
      if (!current) {
        return jsonResponse({ error: 'Task not found.' }, 404);
      }

      const now = new Date().toISOString();
      await env.DB
        .prepare('UPDATE tasks SET in_others = 1, updated_at = ? WHERE id = ?')
        .bind(now, id)
        .run();

      const updated = await env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();
      return jsonResponse(updated);
    }

    const taskMatch = path.match(/^\/api\/tasks\/([^/]+)$/);
    if (taskMatch && method === 'PUT') {
      const id = taskMatch[1];
      const current: any = await env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();
      if (!current) {
        return jsonResponse({ error: 'Task not found.' }, 404);
      }

      const body: any = await request.json().catch(() => ({}));
      const {
        client_id = current.client_id,
        title = current.title,
        category = current.category,
        task_type = current.task_type,
        assigned_to = current.assigned_to,
        due_date = current.due_date,
        status = current.status,
        month = current.month,
        notes = current.notes,
        rework_comment = current.rework_comment,
        in_others = current.in_others,
      } = body;

      const now = new Date().toISOString();

      await env.DB
        .prepare(
          `UPDATE tasks
           SET client_id = ?, title = ?, category = ?, task_type = ?, assigned_to = ?, due_date = ?, status = ?, month = ?, notes = ?, rework_comment = ?, in_others = ?, updated_at = ?
           WHERE id = ?`
        )
        .bind(
          client_id,
          title,
          category,
          task_type,
          assigned_to,
          due_date !== undefined ? due_date : current.due_date,
          status,
          month,
          notes,
          rework_comment !== undefined ? rework_comment : current.rework_comment,
          in_others !== undefined ? in_others : current.in_others || 0,
          now,
          id
        )
        .run();

      const updated = await env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(id).first();
      return jsonResponse(updated);
    }

    if (taskMatch && method === 'DELETE') {
      const id = taskMatch[1];
      await env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
      return jsonResponse({ success: true });
    }

    // POST /api/tasks/rollover
    if (path === '/api/tasks/rollover' && method === 'POST') {
      const body: any = await request.json().catch(() => ({}));
      const { targetMonth } = body;
      let createdCount = 0;

      try {
        if (targetMonth) {
          const { results: recurringTasks } = await env.DB
            .prepare(
              "SELECT * FROM tasks WHERE task_type IN ('recurring_monthly', 'recurring_quarterly')"
            )
            .all();

          for (const task of recurringTasks || []) {
            const exists = await env.DB
              .prepare('SELECT id FROM tasks WHERE client_id = ? AND title = ? AND month = ?')
              .bind(task.client_id, task.title, targetMonth)
              .first();

            if (!exists) {
              let newDueDate: string | null = null;
              if (task.due_date && task.due_date.length >= 10) {
                newDueDate = `${targetMonth}-${task.due_date.slice(8, 10)}`;
              }

              const id = `t-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
              const now = new Date().toISOString();

              await env.DB
                .prepare(
                  `INSERT INTO tasks (id, client_id, title, category, task_type, assigned_to, due_date, status, month, notes, rework_comment, in_others, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 'todo', ?, ?, null, 0, ?, ?)`
                )
                .bind(
                  id,
                  task.client_id,
                  task.title,
                  task.category || 'GST',
                  task.task_type,
                  task.assigned_to,
                  newDueDate,
                  targetMonth,
                  task.notes,
                  now,
                  now
                )
                .run();
              createdCount++;
            }
          }
        }

        const autoCount = await ensureRecurringOccurrences(env.DB);
        createdCount += autoCount;
      } catch (err) {
        console.error('Error during rollover:', err);
      }

      return jsonResponse({ success: true, createdCount });
    }

    return jsonResponse({ error: 'Route not found' }, 404);
  } catch (err: any) {
    console.error('API Error:', err);
    return jsonResponse({ error: err?.message || 'Internal Server Error' }, 500);
  }
}
