import express from 'express';
import cors from 'cors';
import { db } from './db.js';
import { hashPassword, verifyPassword, encryptCredential, decryptCredential } from './crypto.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// -------------------------------------------------------------
// Auth Endpoints
// -------------------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Username/Email and password are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email.trim());
  if (!user) {
    return res.status(401).json({ error: 'User account not found.' });
  }

  if (user.status === 'inactive') {
    return res.status(403).json({ error: 'Account is deactivated. Contact system administrator.' });
  }

  const isValid = verifyPassword(password, user.password_salt, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid password. Please try again.' });
  }

  const { password_hash, password_salt, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// -------------------------------------------------------------
// Users Management (Admin)
// -------------------------------------------------------------
app.get('/api/users', (req, res) => {
  const users = db.prepare(`
    SELECT id, email, name, role, status, created_at 
    FROM users 
    ORDER BY created_at ASC
  `).all();
  res.json(users);
});

app.post('/api/users', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(email.trim());
  if (existing) {
    return res.status(409).json({ error: 'A user with this email already exists.' });
  }

  const id = `u-${Date.now()}`;
  const now = new Date().toISOString();
  const { hash, salt } = hashPassword(password);

  db.prepare(`
    INSERT INTO users (id, email, name, role, password_hash, password_salt, status, created_at)
    VALUES (?, ?, ?, 'assistant', ?, ?, 'active', ?)
  `).run(id, email.trim().toLowerCase(), name.trim(), hash, salt, now);

  const created = db.prepare('SELECT id, email, name, role, status, created_at FROM users WHERE id = ?').get(id);
  res.status(201).json(created);
});

app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { name, email, status } = req.body;

  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!current) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const updatedName = name !== undefined ? name.trim() : current.name;
  const updatedEmail = email !== undefined ? email.trim().toLowerCase() : current.email;
  const updatedStatus = status !== undefined ? status : current.status;

  db.prepare(`
    UPDATE users 
    SET name = ?, email = ?, status = ?
    WHERE id = ?
  `).run(updatedName, updatedEmail, updatedStatus, id);

  const updated = db.prepare('SELECT id, email, name, role, status, created_at FROM users WHERE id = ?').get(id);
  res.json(updated);
});

app.post('/api/users/:id/reset-password', (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  if (!newPassword) {
    return res.status(400).json({ error: 'New password is required.' });
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const { hash, salt } = hashPassword(newPassword);
  db.prepare(`
    UPDATE users 
    SET password_hash = ?, password_salt = ?
    WHERE id = ?
  `).run(hash, salt, id);

  res.json({ success: true, message: 'Password updated successfully.' });
});

app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }
  if (user.role === 'admin') {
    return res.status(400).json({ error: 'Primary Admin account cannot be deleted.' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ success: true, message: 'User deleted successfully.' });
});

// -------------------------------------------------------------
// Clients Management
// -------------------------------------------------------------
app.get('/api/clients', (req, res) => {
  const clients = db.prepare('SELECT * FROM clients ORDER BY created_at DESC').all();
  const parsed = clients.map((c) => ({
    ...c,
    client_types: typeof c.client_types === 'string' ? JSON.parse(c.client_types || '[]') : (c.client_types || []),
  }));
  res.json(parsed);
});

app.post('/api/clients', (req, res) => {
  const { name, contact_person, phone, email, gstin, pan, notes, client_types, credentials } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Client name is required.' });
  }

  const id = `c-${Date.now()}`;
  const now = new Date().toISOString();
  const typesJson = Array.isArray(client_types) ? JSON.stringify(client_types) : (client_types || '[]');

  db.prepare(`
    INSERT INTO clients (id, name, contact_person, phone, email, gstin, pan, notes, client_types, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
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
  );

  // If credentials are provided directly in client creation, encrypt and insert
  if (Array.isArray(credentials) && credentials.length > 0) {
    const insertCred = db.prepare(`
      INSERT INTO client_credentials (id, client_id, portal_name, portal_url, username, encrypted_password, iv, tag, notes, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < credentials.length; i++) {
      const cred = credentials[i];
      if (cred.portal_name && cred.username && cred.password) {
        const credId = `cr-${Date.now()}-${i}`;
        const enc = encryptCredential(cred.password);
        insertCred.run(
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
        );
      }
    }
  }

  const created = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  res.status(201).json({
    ...created,
    client_types: Array.isArray(client_types) ? client_types : JSON.parse(created.client_types || '[]'),
  });
});

app.put('/api/clients/:id', (req, res) => {
  const { id } = req.params;
  const { name, contact_person, phone, email, gstin, pan, notes, client_types } = req.body;

  const current = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!current) {
    return res.status(404).json({ error: 'Client not found.' });
  }

  const updatedTypes = Array.isArray(client_types)
    ? JSON.stringify(client_types)
    : (client_types !== undefined ? client_types : current.client_types);

  db.prepare(`
    UPDATE clients 
    SET name = ?, contact_person = ?, phone = ?, email = ?, gstin = ?, pan = ?, notes = ?, client_types = ?
    WHERE id = ?
  `).run(
    name !== undefined ? name.trim() : current.name,
    contact_person !== undefined ? contact_person : current.contact_person,
    phone !== undefined ? phone : current.phone,
    email !== undefined ? email : current.email,
    gstin !== undefined ? gstin.toUpperCase() : current.gstin,
    pan !== undefined ? pan.toUpperCase() : current.pan,
    notes !== undefined ? notes : current.notes,
    updatedTypes,
    id
  );

  const updated = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  res.json({
    ...updated,
    client_types: typeof updated.client_types === 'string' ? JSON.parse(updated.client_types || '[]') : (updated.client_types || []),
  });
});

app.delete('/api/clients/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM clients WHERE id = ?').run(id);
  res.json({ success: true });
});

// -------------------------------------------------------------
// Client Portal Credentials
// -------------------------------------------------------------
app.get('/api/credentials', (req, res) => {
  const { clientId } = req.query;
  let rows;
  if (clientId) {
    rows = db.prepare('SELECT * FROM client_credentials WHERE client_id = ? ORDER BY updated_at DESC').all(clientId);
  } else {
    rows = db.prepare('SELECT * FROM client_credentials ORDER BY updated_at DESC').all();
  }

  // Decrypt passwords for authorized in-app viewer
  const credentials = rows.map((r) => ({
    id: r.id,
    client_id: r.client_id,
    portal_name: r.portal_name,
    portal_url: r.portal_url,
    username: r.username,
    password_decrypted: decryptCredential(r.encrypted_password, r.iv, r.tag),
    notes: r.notes,
    updated_at: r.updated_at,
  }));

  res.json(credentials);
});

app.post('/api/credentials', (req, res) => {
  const { client_id, portal_name, portal_url, username, password, notes } = req.body;
  if (!client_id || !portal_name || !username || !password) {
    return res.status(400).json({ error: 'client_id, portal_name, username, and password are required.' });
  }

  const id = `cr-${Date.now()}`;
  const now = new Date().toISOString();
  const enc = encryptCredential(password);

  db.prepare(`
    INSERT INTO client_credentials (id, client_id, portal_name, portal_url, username, encrypted_password, iv, tag, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, client_id, portal_name.trim(), portal_url || null, username.trim(), enc.encrypted, enc.iv, enc.tag, notes || null, now);

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

  res.status(201).json(created);
});

app.put('/api/credentials/:id', (req, res) => {
  const { id } = req.params;
  const { portal_name, portal_url, username, password, notes } = req.body;

  const current = db.prepare('SELECT * FROM client_credentials WHERE id = ?').get(id);
  if (!current) {
    return res.status(404).json({ error: 'Credential not found.' });
  }

  let enc = {
    encrypted: current.encrypted_password,
    iv: current.iv,
    tag: current.tag,
  };

  if (password) {
    enc = encryptCredential(password);
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE client_credentials 
    SET portal_name = ?, portal_url = ?, username = ?, encrypted_password = ?, iv = ?, tag = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `).run(
    portal_name || current.portal_name,
    portal_url !== undefined ? portal_url : current.portal_url,
    username || current.username,
    enc.encrypted,
    enc.iv,
    enc.tag,
    notes !== undefined ? notes : current.notes,
    now,
    id
  );

  const updated = db.prepare('SELECT * FROM client_credentials WHERE id = ?').get(id);
  res.json({
    id: updated.id,
    client_id: updated.client_id,
    portal_name: updated.portal_name,
    portal_url: updated.portal_url,
    username: updated.username,
    password_decrypted: decryptCredential(updated.encrypted_password, updated.iv, updated.tag),
    notes: updated.notes,
    updated_at: updated.updated_at,
  });
});

app.delete('/api/credentials/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM client_credentials WHERE id = ?').run(id);
  res.json({ success: true });
});

// -------------------------------------------------------------
// Tasks Management & Recurring Generation
// -------------------------------------------------------------
function addMonthsToPeriod(period, numMonths) {
  const parts = period.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const totalMonths = y * 12 + (m - 1) + numMonths;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, '0')}`;
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function ensureRecurringOccurrences() {
  const recurringTasks = db.prepare(`
    SELECT * FROM tasks 
    WHERE task_type IN ('recurring_monthly', 'recurring_quarterly')
    ORDER BY month ASC, created_at ASC
  `).all();

  if (recurringTasks.length === 0) return 0;

  // Group recurring tasks by client_id and title
  const groups = new Map();
  for (const task of recurringTasks) {
    const key = `${task.client_id}:::${task.title}:::${task.task_type}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(task);
  }

  const currentMonth = getCurrentMonth();
  let createdCount = 0;

  for (const [, taskList] of groups.entries()) {
    const sample = taskList[taskList.length - 1];
    const taskType = sample.task_type;
    const stepMonths = taskType === 'recurring_quarterly' ? 3 : 1;

    // Get sorted list of months for this series
    const months = taskList.map((t) => t.month || '').filter(Boolean).sort();
    let latestMonth = months.length > 0 ? months[months.length - 1] : currentMonth;

    // We generate occurrences up to at least current month + 1 period
    const limitMonth = addMonthsToPeriod(currentMonth, stepMonths);

    let nextMonth = addMonthsToPeriod(latestMonth, stepMonths);
    while (nextMonth <= limitMonth) {
      const exists = db.prepare(`
        SELECT id FROM tasks 
        WHERE client_id = ? AND title = ? AND month = ?
      `).get(sample.client_id, sample.title, nextMonth);

      if (!exists) {
        const id = `t-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const now = new Date().toISOString();
        let newDueDate = null;
        if (sample.due_date && sample.due_date.length >= 10) {
          newDueDate = `${nextMonth}-${sample.due_date.slice(8, 10)}`;
        }

        db.prepare(`
          INSERT INTO tasks (id, client_id, title, category, task_type, assigned_to, due_date, status, month, notes, rework_comment, in_others, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'todo', ?, ?, null, 0, ?, ?)
        `).run(
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
        );
        createdCount++;
      }

      nextMonth = addMonthsToPeriod(nextMonth, stepMonths);
    }
  }

  return createdCount;
}

app.get('/api/tasks', (req, res) => {
  try {
    ensureRecurringOccurrences();
  } catch (err) {
    console.error('Error generating recurring occurrences:', err);
  }
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
  res.json(tasks);
});

app.post('/api/tasks', (req, res) => {
  const { client_id, title, category, task_type, assigned_to, due_date, status, month, notes } = req.body;
  if (!client_id || !title || !assigned_to) {
    return res.status(400).json({ error: 'client_id, title, and assigned_to are required.' });
  }

  const id = `t-${Date.now()}`;
  const now = new Date().toISOString();
  const taskMonth = month || (due_date && due_date.length >= 7 ? due_date.slice(0, 7) : getCurrentMonth());
  const type = task_type || 'one_time';

  // Derive task category if not provided
  let taskCategory = category ? category.trim() : null;
  if (!taskCategory) {
    const client = db.prepare('SELECT client_types FROM clients WHERE id = ?').get(client_id);
    if (client) {
      try {
        const types = JSON.parse(client.client_types || '[]');
        taskCategory = types[0] || 'GST';
      } catch (e) {
        taskCategory = 'GST';
      }
    } else {
      taskCategory = 'GST';
    }
  }

  db.prepare(`
    INSERT INTO tasks (id, client_id, title, category, task_type, assigned_to, due_date, status, month, notes, rework_comment, in_others, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, null, 0, ?, ?)
  `).run(
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
  );

  // If recurring task, ensure next occurrences are created
  if (type === 'recurring_monthly' || type === 'recurring_quarterly') {
    try {
      ensureRecurringOccurrences();
    } catch (err) {
      console.error('Error creating subsequent recurring occurrence:', err);
    }
  }

  const created = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.status(201).json(created);
});

app.put('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const current = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!current) {
    return res.status(404).json({ error: 'Task not found.' });
  }

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
  } = req.body;

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE tasks
    SET client_id = ?, title = ?, category = ?, task_type = ?, assigned_to = ?, due_date = ?, status = ?, month = ?, notes = ?, rework_comment = ?, in_others = ?, updated_at = ?
    WHERE id = ?
  `).run(
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
    in_others !== undefined ? in_others : (current.in_others || 0),
    now,
    id
  );

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json(updated);
});

app.post('/api/tasks/:id/move-to-others', (req, res) => {
  const { id } = req.params;
  const current = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!current) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE tasks 
    SET in_others = 1, updated_at = ?
    WHERE id = ?
  `).run(now, id);

  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json(updated);
});

app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  res.json({ success: true });
});

// Rollover recurring tasks to target month
app.post('/api/tasks/rollover', (req, res) => {
  const { targetMonth } = req.body;
  let createdCount = 0;

  try {
    if (targetMonth) {
      const recurringTasks = db.prepare("SELECT * FROM tasks WHERE task_type IN ('recurring_monthly', 'recurring_quarterly')").all();
      for (const task of recurringTasks) {
        const exists = db.prepare(`
          SELECT id FROM tasks 
          WHERE client_id = ? AND title = ? AND month = ?
        `).get(task.client_id, task.title, targetMonth);

        if (!exists) {
          let newDueDate = null;
          if (task.due_date && task.due_date.length >= 10) {
            newDueDate = `${targetMonth}-${task.due_date.slice(8, 10)}`;
          }

          const id = `t-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const now = new Date().toISOString();

          db.prepare(`
            INSERT INTO tasks (id, client_id, title, category, task_type, assigned_to, due_date, status, month, notes, rework_comment, in_others, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'todo', ?, ?, null, 0, ?, ?)
          `).run(
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
          );
          createdCount++;
        }
      }
    }

    const autoCount = ensureRecurringOccurrences();
    createdCount += autoCount;
  } catch (err) {
    console.error('Error during rollover:', err);
  }

  res.json({ success: true, createdCount });
});

// Ensure initial recurring task occurrences on startup
try {
  ensureRecurringOccurrences();
} catch (err) {
  console.error('Initial recurrence run:', err);
}

app.listen(PORT, () => {
  console.log(`AuditFlow backend server running on http://127.0.0.1:${PORT}`);
});

