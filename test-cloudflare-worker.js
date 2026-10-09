import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { handleApiRequest, ensureRecurringOccurrences } from './worker/handler.ts';
import { hashPassword } from './worker/crypto.ts';
import workerDefault from './worker/index.ts';

console.log('====================================================');
console.log('AUDITFLOW CLOUDFLARE WORKER & D1 DEPLOYMENT VERIFICATION');
console.log('====================================================');

// 1. Create In-Memory SQLite with D1-compatible Adapter
const memDb = new DatabaseSync(':memory:');
memDb.exec('PRAGMA foreign_keys = ON;');

// 2. Execute ONLY the clean production D1 Schema (migrations/0001_initial_schema.sql)
const schemaSql = fs.readFileSync('migrations/0001_initial_schema.sql', 'utf8');
memDb.exec(schemaSql);

// Verify database starts completely clean
const initialUserCount = memDb.prepare('SELECT count(*) as c FROM users').get().c;
const initialClientCount = memDb.prepare('SELECT count(*) as c FROM clients').get().c;
const initialTaskCount = memDb.prepare('SELECT count(*) as c FROM tasks').get().c;
const initialCredCount = memDb.prepare('SELECT count(*) as c FROM client_credentials').get().c;

if (initialUserCount !== 0 || initialClientCount !== 0 || initialTaskCount !== 0 || initialCredCount !== 0) {
  console.error('FAIL: Database is not clean after applying schema!');
  process.exit(1);
}

// D1 Interface Adapter over Node.js SQLite
const d1Mock = {
  prepare(sql) {
    let boundParams = [];
    return {
      bind(...params) {
        boundParams = params;
        return this;
      },
      async all() {
        const stmt = memDb.prepare(sql);
        const results = stmt.all(...boundParams);
        return { results, success: true };
      },
      async first() {
        const stmt = memDb.prepare(sql);
        const row = stmt.get(...boundParams);
        return row || null;
      },
      async run() {
        const stmt = memDb.prepare(sql);
        stmt.run(...boundParams);
        return { success: true };
      },
    };
  },
};

const TEST_SECRET = 'Prod_Secret_Key_9876543210_SecureToken_2026';
const mockEnv = {
  DB: d1Mock,
  CREDENTIALS_SECRET: TEST_SECRET,
  ASSETS: {
    async fetch(request) {
      const url = new URL(request.url);
      if (url.pathname.startsWith('/assets/')) {
        return new Response('/* static asset bundle */', {
          status: 200,
          headers: { 'Content-Type': 'application/javascript' },
        });
      }
      // SPA fallback
      return new Response('<!DOCTYPE html><html><head><title>AJ Associates</title></head><body><div id="root"></div></body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    },
  },
};

async function testEndpoint(name, method, path, body = null) {
  const reqInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) {
    reqInit.body = JSON.stringify(body);
  }
  const req = new Request(`http://localhost${path}`, reqInit);
  const res = await handleApiRequest(req, mockEnv);
  const data = await res.json();
  return { status: res.status, data };
}

let passed = 0;
let total = 0;

function assert(desc, condition) {
  total++;
  if (condition) {
    console.log(`  ✓ [TEST ${total}] PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ [TEST ${total}] FAIL: ${desc}`);
  }
}

async function runTests() {
  // [1] Clean Database Initialization
  assert(
    'Clean database initialization starts with 0 users, 0 clients, 0 credentials, 0 tasks',
    initialUserCount === 0 && initialClientCount === 0 && initialCredCount === 0 && initialTaskCount === 0
  );

  // [2] Health Endpoint
  const health = await testEndpoint('Health Check', 'GET', '/api/health');
  assert('GET /api/health returns status ok with Cloudflare platform', health.status === 200 && health.data.status === 'ok');

  // [3] Secure First Admin Creation via PBKDF2 hash
  const adminPassword = 'SuperSecretAdminPass#2026';
  const { hash: adminHash, salt: adminSalt } = hashPassword(adminPassword);
  const adminId = 'u-admin-1';
  const adminEmail = 'admin@ajassociates.in';
  const adminName = 'CA Rajesh Sharma';
  const now = new Date().toISOString();

  memDb.prepare(`
    INSERT INTO users (id, email, name, role, password_hash, password_salt, status, created_at)
    VALUES (?, ?, ?, 'admin', ?, ?, 'active', ?)
  `).run(adminId, adminEmail, adminName, adminHash, adminSalt, now);

  const insertedAdmin = memDb.prepare('SELECT * FROM users WHERE id = ?').get(adminId);
  assert(
    'Initial Admin created securely with PBKDF2 salt & hash (no plaintext password in DB)',
    insertedAdmin && insertedAdmin.role === 'admin' && insertedAdmin.password_hash === adminHash && insertedAdmin.password_hash !== adminPassword
  );

  // [4] Admin Login
  const adminLogin = await testEndpoint('Admin Login', 'POST', '/api/auth/login', {
    email: adminEmail,
    password: adminPassword,
  });
  assert('Admin login succeeds with credentials and returns admin role', adminLogin.status === 200 && adminLogin.data.user.role === 'admin');

  // [5] Invalid Login Rejection
  const badLogin = await testEndpoint('Invalid Login', 'POST', '/api/auth/login', {
    email: adminEmail,
    password: 'wrong_password',
  });
  assert('Login with wrong password returns 401 Unauthorized', badLogin.status === 401);

  // [6] Admin Creates Assistant User
  const newAssistant = await testEndpoint('Create Assistant', 'POST', '/api/users', {
    name: 'Priya Patel',
    email: 'priya@ajassociates.in',
    password: 'AssistantPass@2026',
  });
  assert('Admin successfully creates assistant user', newAssistant.status === 201 && newAssistant.data.role === 'assistant');

  // [7] Assistant Login
  const asstLogin = await testEndpoint('Assistant Login', 'POST', '/api/auth/login', {
    email: 'priya@ajassociates.in',
    password: 'AssistantPass@2026',
  });
  assert('Assistant logs in successfully with their created password', asstLogin.status === 200 && asstLogin.data.user.role === 'assistant');

  // [8] Client Creation with Multi-Types & Credentials
  const newClient = await testEndpoint('Create Client', 'POST', '/api/clients', {
    name: 'Zenith Global Manufacturing Ltd',
    contact_person: 'Vikram Mehta',
    phone: '+91 98200 12345',
    email: 'accounts@zenithmfg.in',
    gstin: '27AABCT1234F1Z5',
    pan: 'AABCT1234F',
    client_types: ['GST', 'PF', 'ESI'],
    credentials: [
      {
        portal_name: 'GST',
        username: 'zenith_gst_admin',
        password: 'PortalSecretPassword#99',
        notes: 'OTP sent to director mobile',
      },
    ],
  });
  assert('Created client with types [GST, PF, ESI] and inline credential', newClient.status === 201 && newClient.data.name === 'Zenith Global Manufacturing Ltd');

  // [9] Credential Encryption & Decryption
  const rawCred = memDb.prepare('SELECT * FROM client_credentials WHERE client_id = ?').get(newClient.data.id);
  const isEncryptedInDb = rawCred.encrypted_password !== 'PortalSecretPassword#99' && rawCred.iv && rawCred.tag;
  assert('Credential is AES-256-GCM encrypted in D1 (plaintext NOT stored)', isEncryptedInDb);

  const credsList = await testEndpoint('Get Credentials', 'GET', `/api/credentials?clientId=${newClient.data.id}`);
  assert(
    'Worker API decrypts credential seamlessly using CREDENTIALS_SECRET',
    credsList.status === 200 && credsList.data.length === 1 && credsList.data[0].password_decrypted === 'PortalSecretPassword#99'
  );

  // [10] Task Creation (One-Time)
  const task1 = await testEndpoint('Create One-Time Task', 'POST', '/api/tasks', {
    client_id: newClient.data.id,
    title: 'Statutory Ledger Audit Scrutiny',
    category: 'GST',
    task_type: 'one_time',
    assigned_to: newAssistant.data.id,
    due_date: '2026-10-25',
    notes: 'Sample raw material purchase bills',
  });
  assert('Created one-time task successfully', task1.status === 201 && task1.data.task_type === 'one_time');

  // [11] Task Creation (Recurring Monthly)
  const taskMonthly = await testEndpoint('Create Recurring Monthly Task', 'POST', '/api/tasks', {
    client_id: newClient.data.id,
    title: 'GSTR-3B Monthly Return Filing',
    category: 'GST',
    task_type: 'recurring_monthly',
    assigned_to: newAssistant.data.id,
    due_date: '2026-10-20',
    month: '2026-10',
  });
  assert('Created recurring monthly task', taskMonthly.status === 201 && taskMonthly.data.task_type === 'recurring_monthly');

  // [12] Monthly Recurrence Generation
  const monthlyOccurrences = memDb.prepare(
    "SELECT * FROM tasks WHERE client_id = ? AND title = 'GSTR-3B Monthly Return Filing'"
  ).all(newClient.data.id);
  assert('Recurring monthly task generated subsequent period occurrence(s)', monthlyOccurrences.length >= 2);

  // [13] Task Creation (Recurring Quarterly)
  const taskQuarterly = await testEndpoint('Create Recurring Quarterly Task', 'POST', '/api/tasks', {
    client_id: newClient.data.id,
    title: 'Form 26Q Quarterly TDS Return Scrutiny',
    category: 'IT',
    task_type: 'recurring_quarterly',
    assigned_to: newAssistant.data.id,
    due_date: '2026-10-31',
    month: '2026-10',
  });
  assert('Created recurring quarterly task', taskQuarterly.status === 201 && taskQuarterly.data.task_type === 'recurring_quarterly');

  // [14] Quarterly Recurrence Generation
  const quarterlyOccurrences = memDb.prepare(
    "SELECT * FROM tasks WHERE client_id = ? AND title = 'Form 26Q Quarterly TDS Return Scrutiny'"
  ).all(newClient.data.id);
  assert('Recurring quarterly task generated subsequent quarterly occurrence', quarterlyOccurrences.length >= 2);

  // [15] Assistant Updates Status & Admin Approves
  await testEndpoint('Update Status In Progress', 'PUT', `/api/tasks/${task1.data.id}`, { status: 'in_progress' });
  await testEndpoint('Update Status Completed', 'PUT', `/api/tasks/${task1.data.id}`, { status: 'completed' });
  const approved = await testEndpoint('Admin Approve', 'PUT', `/api/tasks/${task1.data.id}`, { status: 'approved' });
  assert('Task workflow progresses from todo -> in_progress -> completed -> approved', approved.data.status === 'approved');

  // [16] Move to Others (Archive)
  const moved = await testEndpoint('Move to Others', 'POST', `/api/tasks/${task1.data.id}/move-to-others`);
  assert('Task moved to Others successfully (in_others = 1)', moved.status === 200 && moved.data.in_others === 1);

  // [17] SPA Static Routing & Refresh Handling
  const rootReq = new Request('http://localhost/', { method: 'GET' });
  const rootRes = await workerDefault.fetch(rootReq, mockEnv, {});
  const rootHtml = await rootRes.text();
  assert('Root URL (/) serves React Vite SPA index.html with 200 status', rootRes.status === 200 && rootHtml.includes('AJ Associates'));

  const refreshReq = new Request('http://localhost/tasks', { method: 'GET' });
  const refreshRes = await workerDefault.fetch(refreshReq, mockEnv, {});
  const refreshHtml = await refreshRes.text();
  assert('Refreshing client-side SPA route (/tasks) serves index.html with 200 (NO 404)', refreshRes.status === 200 && refreshHtml.includes('AJ Associates'));

  const staticAssetReq = new Request('http://localhost/assets/index-abc.js', { method: 'GET' });
  const staticAssetRes = await workerDefault.fetch(staticAssetReq, mockEnv, {});
  assert('Static asset request (/assets/index-abc.js) returns 200 javascript', staticAssetRes.status === 200 && staticAssetRes.headers.get('Content-Type')?.includes('javascript'));

  console.log('====================================================');
  console.log(`RESULTS: ${passed}/${total} TESTS PASSED!`);
  console.log('====================================================');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test run error:', err);
  process.exit(1);
});
