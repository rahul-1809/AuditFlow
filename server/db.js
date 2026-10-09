import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hashPassword, encryptCredential } from './crypto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'auditflow.db');
export const db = new DatabaseSync(dbPath);

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON;');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'assistant')),
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    gstin TEXT,
    pan TEXT,
    notes TEXT,
    client_types TEXT DEFAULT '[]',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS client_credentials (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    portal_name TEXT NOT NULL,
    portal_url TEXT,
    username TEXT NOT NULL,
    encrypted_password TEXT NOT NULL,
    iv TEXT NOT NULL,
    tag TEXT NOT NULL,
    notes TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT,
    task_type TEXT NOT NULL CHECK(task_type IN ('one_time', 'recurring_monthly', 'recurring_quarterly')),
    assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
    due_date TEXT,
    status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'completed', 'approved')),
    month TEXT,
    notes TEXT,
    rework_comment TEXT,
    in_others INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// Safe migrations for existing databases
try {
  const clientCols = db.prepare('PRAGMA table_info(clients)').all();
  if (!clientCols.some((c) => c.name === 'client_types')) {
    db.exec("ALTER TABLE clients ADD COLUMN client_types TEXT DEFAULT '[]';");
  }

  // Update existing clients if client_types is null
  db.exec("UPDATE clients SET client_types = '[\"GST\"]' WHERE client_types IS NULL OR client_types = '' OR client_types = '[]';");
} catch (err) {
  console.error('Error running client schema migration:', err);
}

try {
  const tasksMaster = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'").get();
  const sql = tasksMaster ? tasksMaster.sql : '';
  const needsTaskMigration = !sql.includes('recurring_quarterly') || !sql.includes('in_others');

  if (needsTaskMigration) {
    db.exec('PRAGMA foreign_keys = OFF;');
    db.exec(`
      CREATE TABLE tasks_migrated (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        category TEXT,
        task_type TEXT NOT NULL CHECK(task_type IN ('one_time', 'recurring_monthly', 'recurring_quarterly')),
        assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
        due_date TEXT,
        status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'completed', 'approved')),
        month TEXT,
        notes TEXT,
        rework_comment TEXT,
        in_others INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO tasks_migrated (id, client_id, title, category, task_type, assigned_to, due_date, status, month, notes, rework_comment, in_others, created_at, updated_at)
      SELECT id, client_id, title, null, task_type, assigned_to, due_date, status, month, notes, rework_comment, 0, created_at, updated_at FROM tasks;
      DROP TABLE tasks;
      ALTER TABLE tasks_migrated RENAME TO tasks;
    `);
    db.exec('PRAGMA foreign_keys = ON;');
  }

  // Ensure category column exists
  const taskCols = db.prepare('PRAGMA table_info(tasks)').all();
  if (!taskCols.some((c) => c.name === 'category')) {
    db.exec('ALTER TABLE tasks ADD COLUMN category TEXT;');
  }

  // Populate category for any existing tasks where category is null or empty
  const tasksWithoutCategory = db.prepare(`
    SELECT t.id, t.title, c.client_types, c.name as client_name 
    FROM tasks t 
    JOIN clients c ON t.client_id = c.id 
    WHERE t.category IS NULL OR t.category = ''
  `).all();

  for (const t of tasksWithoutCategory) {
    let clientTypes = [];
    try {
      clientTypes = JSON.parse(t.client_types || '[]');
    } catch (e) {
      clientTypes = [];
    }
    let cat = 'GST';
    const lowerTitle = (t.title || '').toLowerCase();
    const isPendingClient = clientTypes.includes('Pending Tasks') || (t.client_name || '').toLowerCase().includes('pending');

    if (isPendingClient) {
      cat = 'Pending Tasks';
    } else if (lowerTitle.includes('gst') || lowerTitle.includes('gstr') || lowerTitle.includes('itc')) {
      cat = 'GST';
    } else if (lowerTitle.includes('pf') || lowerTitle.includes('provident') || lowerTitle.includes('epf')) {
      cat = 'PF';
    } else if (lowerTitle.includes('esi') || lowerTitle.includes('esic')) {
      cat = 'ESI';
    } else if (lowerTitle.includes('tax') || lowerTitle.includes('income') || lowerTitle.includes('tds') || lowerTitle.includes('itr') || lowerTitle.includes('3cd')) {
      cat = 'IT';
    } else if (lowerTitle.includes('mca') || lowerTitle.includes('roc') || lowerTitle.includes('mgt') || lowerTitle.includes('aoc') || lowerTitle.includes('director')) {
      cat = 'MCA';
    } else if (clientTypes.length > 0) {
      cat = clientTypes[0];
    }
    db.prepare('UPDATE tasks SET category = ? WHERE id = ?').run(cat, t.id);
  }

  // Ensure Zenith Manufacturing (c-5) has sample tasks for GST, PF and ESI for immediate multi-type demonstration
  const c5 = db.prepare("SELECT id FROM clients WHERE id = 'c-5'").get();
  if (c5) {
    const gstTask = db.prepare("SELECT id FROM tasks WHERE client_id = 'c-5' AND category = 'GST'").get();
    if (!gstTask) {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO tasks (id, client_id, title, category, task_type, assigned_to, due_date, status, month, notes, rework_comment, in_others, created_at, updated_at)
        VALUES ('t-gst-c5', 'c-5', 'Zenith GSTR-3B Monthly Return Filing', 'GST', 'recurring_monthly', 'u-2', '2026-10-20', 'in_progress', '2026-10', 'Monthly GSTR-3B return & tax payment computation', null, 0, ?, ?)
      `).run(now, now);
    }
    const pfTask = db.prepare("SELECT id FROM tasks WHERE client_id = 'c-5' AND category = 'PF'").get();
    if (!pfTask) {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO tasks (id, client_id, title, category, task_type, assigned_to, due_date, status, month, notes, rework_comment, in_others, created_at, updated_at)
        VALUES ('t-pf-c5', 'c-5', 'Monthly PF Contribution & ECR Filing', 'PF', 'recurring_monthly', 'u-2', '2026-10-15', 'in_progress', '2026-10', 'Verify monthly salary register with unified portal ECR', null, 0, ?, ?)
      `).run(now, now);
    }
    const esiTask = db.prepare("SELECT id FROM tasks WHERE client_id = 'c-5' AND category = 'ESI'").get();
    if (!esiTask) {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO tasks (id, client_id, title, category, task_type, assigned_to, due_date, status, month, notes, rework_comment, in_others, created_at, updated_at)
        VALUES ('t-esi-c5', 'c-5', 'ESI Monthly Contribution Return Scrutiny', 'ESI', 'recurring_monthly', 'u-3', '2026-10-21', 'todo', '2026-10', 'Verify IP count and Form 5 return register', null, 0, ?, ?)
      `).run(now, now);
    }
  }

  // Ensure BlueSky Technologies (c-4) has MCA tasks for MCA quick-filtering
  const c4 = db.prepare("SELECT id FROM clients WHERE id = 'c-4'").get();
  if (c4) {
    const mcaTask = db.prepare("SELECT id FROM tasks WHERE client_id = 'c-4' AND category = 'MCA'").get();
    if (!mcaTask) {
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO tasks (id, client_id, title, category, task_type, assigned_to, due_date, status, month, notes, rework_comment, in_others, created_at, updated_at)
        VALUES ('t-mca-c4', 'c-4', 'ROC Form MGT-7 Annual Return Filing', 'MCA', 'recurring_quarterly', 'u-3', '2026-10-30', 'in_progress', '2026-10', 'Verify director shareholding and board meeting minutes', null, 0, ?, ?)
      `).run(now, now);
    }
  }
} catch (err) {
  console.error('Error running tasks schema migration:', err);
}

// Seed initial dataset if users table is empty
const existingUsers = db.prepare('SELECT count(*) as count FROM users').get();
if (!existingUsers || existingUsers.count === 0) {
  console.log('Seeding initial AuditFlow database with realistic sample data...');

  // 1. Seed Users (1 Admin, 2 Assistants) with securely hashed passwords
  const insertUser = db.prepare(`
    INSERT INTO users (id, email, name, role, password_hash, password_salt, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const adminCred = hashPassword('admin123');
  insertUser.run('u-1', 'admin@auditflow.internal', 'CA Rajesh Sharma', 'admin', adminCred.hash, adminCred.salt, 'active', '2026-01-10T09:00:00Z');

  const priyaCred = hashPassword('assistant123');
  insertUser.run('u-2', 'priya@auditflow.internal', 'Priya Patel', 'assistant', priyaCred.hash, priyaCred.salt, 'active', '2026-02-01T10:00:00Z');

  const amitCred = hashPassword('assistant123');
  insertUser.run('u-3', 'amit@auditflow.internal', 'Amit Verma', 'assistant', amitCred.hash, amitCred.salt, 'active', '2026-02-15T11:00:00Z');

  // 2. Seed Clients
  const insertClient = db.prepare(`
    INSERT INTO clients (id, name, contact_person, phone, email, gstin, pan, notes, client_types, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertClient.run(
    'c-1',
    'Apex Logistics Pvt Ltd',
    'Suresh Nair',
    '+91 98201 44521',
    'accounts@apexlogistics.in',
    '27AABCA1234F1Z8',
    'AABCA1234F',
    'Warehousing & transport firm. Monthly GSTR-3B and quarterly TDS filing required.',
    JSON.stringify(['GST', 'IT']),
    '2026-01-15T10:00:00Z'
  );

  insertClient.run(
    'c-2',
    'Nova Retail Enterprises',
    'Anita Desai',
    '+91 98190 22319',
    'finance@novaretail.com',
    '27AACCN9876P1Z3',
    'AACCN9876P',
    'Retail chain with 4 branches in Mumbai. High invoice volume.',
    JSON.stringify(['GST']),
    '2026-02-01T11:00:00Z'
  );

  insertClient.run(
    'c-3',
    'Greenleaf Pharma LLP',
    'Dr. Vikram Joshi',
    '+91 97690 88712',
    'admin@greenleafpharma.co',
    '24AAAFG4567M1Z1',
    'AAAFG4567M',
    'Pharma manufacturing unit in Gujarat. Annual statutory audit & Form 3CD.',
    JSON.stringify(['IT']),
    '2026-02-10T14:30:00Z'
  );

  insertClient.run(
    'c-4',
    'BlueSky Technologies Pvt Ltd',
    'Rohit Saxena',
    '+91 98450 11209',
    'tax@blueskytech.io',
    '29AABCB5544N1ZV',
    'AABCB5544N',
    'Software exports (LUT filing required). Foreign remittance 15CA/15CB.',
    JSON.stringify(['MCA']),
    '2026-03-01T09:15:00Z'
  );

  insertClient.run(
    'c-5',
    'Zenith Manufacturing Co.',
    'Manmohan Mehta',
    '+91 99200 66543',
    'mmehta@zenithmfg.in',
    '27AAACZ1122K1Z9',
    'AAACZ1122K',
    'Heavy engineering plant. E-way bill monitoring & monthly reconciliation.',
    JSON.stringify(['GST', 'PF', 'ESI']),
    '2026-03-12T16:00:00Z'
  );

  insertClient.run(
    'c-pending',
    'Pending Tasks',
    'Admin Desk',
    '+91 90000 00000',
    'desk@auditflow.internal',
    '',
    '',
    'System container for unclassified pending work.',
    JSON.stringify(['Pending Tasks']),
    '2026-03-15T09:00:00Z'
  );

  // 3. Seed Client Portal Credentials (Encrypted via AES-256-GCM)
  const insertCred = db.prepare(`
    INSERT INTO client_credentials (id, client_id, portal_name, portal_url, username, encrypted_password, iv, tag, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const p1 = encryptCredential('ApexGST@2026#');
  insertCred.run('cr-1', 'c-1', 'GST Portal', 'https://services.gst.gov.in', 'apex_gst_27', p1.encrypted, p1.iv, p1.tag, 'OTP directed to Suresh Nair registered mobile', '2026-03-15T10:00:00Z');

  const p2 = encryptCredential('TaxApex@9820');
  insertCred.run('cr-2', 'c-1', 'Income Tax e-Filing Portal', 'https://eportal.incometax.gov.in', 'AABCA1234F', p2.encrypted, p2.iv, p2.tag, 'DSC registered with CA office dongle', '2026-03-15T10:15:00Z');

  const p3 = encryptCredential('TracesApex#123');
  insertCred.run('cr-3', 'c-1', 'TRACES (TDS Portal)', 'https://contents.tdscpc.gov.in', 'TAN_MUMA9982', p3.encrypted, p3.iv, p3.tag, 'Form 26Q quarterly token active', '2026-03-16T12:00:00Z');

  const p4 = encryptCredential('NovaPass@7712');
  insertCred.run('cr-4', 'c-2', 'GST Portal', 'https://services.gst.gov.in', 'nova_retail_gst', p4.encrypted, p4.iv, p4.tag, 'Monthly GSTR-1 and GSTR-3B', '2026-04-01T11:00:00Z');

  const p5 = encryptCredential('PharmaTax!2026');
  insertCred.run('cr-5', 'c-3', 'Income Tax Portal', 'https://eportal.incometax.gov.in', 'AAAFG4567M', p5.encrypted, p5.iv, p5.tag, 'Firm partner signoff required', '2026-04-10T14:00:00Z');

  const p6 = encryptCredential('SkyMca$9921');
  insertCred.run('cr-6', 'c-4', 'MCA V3 Portal', 'https://www.mca.gov.in', 'bluesky_mca_v3', p6.encrypted, p6.iv, p6.tag, 'ROC annual filing DIN mapped', '2026-04-12T09:30:00Z');

  // 4. Seed Tasks
  const insertTask = db.prepare(`
    INSERT INTO tasks (id, client_id, title, task_type, assigned_to, due_date, status, month, notes, rework_comment, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertTask.run(
    't-1',
    'c-1',
    'Monthly GSTR-3B Filing & ITC Reconciliation',
    'recurring_monthly',
    'u-2',
    '2026-10-20',
    'in_progress',
    '2026-10',
    'Check purchase register against 2B before final tax offset calculation.',
    null,
    '2026-10-01T09:00:00Z',
    '2026-10-05T14:30:00Z'
  );

  insertTask.run(
    't-2',
    'c-5',
    'Tax Audit Report (Form 3CD) Verification',
    'one_time',
    'u-3',
    '2026-10-15',
    'completed',
    '2026-10',
    'Verify Clause 34 TDS compliance and Section 43B statutory dues payment proofs.',
    null,
    '2026-10-02T10:00:00Z',
    '2026-10-07T16:00:00Z'
  );

  insertTask.run(
    't-3',
    'c-2',
    'Advance Tax Calculation & Challan 280 Verification',
    'recurring_monthly',
    'u-2',
    '2026-10-12',
    'approved',
    '2026-10',
    'Quarterly estimate verified with client management accountant.',
    null,
    '2026-10-01T11:00:00Z',
    '2026-10-06T12:00:00Z'
  );

  insertTask.run(
    't-4',
    'c-4',
    'GSTR-1 Monthly Outward Supply Return Filing',
    'recurring_monthly',
    'u-3',
    '2026-10-11',
    'todo',
    '2026-10',
    'Export invoices table 6A with foreign currency conversions.',
    null,
    '2026-10-03T11:30:00Z',
    '2026-10-03T11:30:00Z'
  );

  insertTask.run(
    't-5',
    'c-3',
    'Statutory Audit Voucher Sampling & Ledger Scrutiny',
    'one_time',
    'u-2',
    '2026-10-25',
    'todo',
    '2026-10',
    'Sample 15% raw material purchases and high-value foreign travel vouchers.',
    null,
    '2026-10-04T15:00:00Z',
    '2026-10-04T15:00:00Z'
  );

  insertTask.run(
    't-6',
    'c-1',
    'TDS Return Q2 (Form 26Q) Preparation',
    'one_time',
    'u-3',
    '2026-10-31',
    'in_progress',
    '2026-10',
    'Section 194C & 194J challan book verification.',
    null,
    '2026-10-05T09:30:00Z',
    '2026-10-07T10:15:00Z'
  );

  insertTask.run(
    't-7',
    'c-5',
    'Quarterly GST ITC Audit & Reconciliation',
    'recurring_quarterly',
    'u-2',
    '2026-10-30',
    'in_progress',
    '2026-10',
    'Quarterly input tax credit scrutiny across all state branches.',
    null,
    '2026-10-06T10:00:00Z',
    '2026-10-06T10:00:00Z'
  );

  insertTask.run(
    't-8',
    'c-pending',
    'Urgent ROC Annual Filing Clarification',
    'one_time',
    'u-2',
    '2026-10-25',
    'todo',
    '2026-10',
    'Director DIN status mismatch inquiry from MCA portal.',
    null,
    '2026-10-07T11:00:00Z',
    '2026-10-07T11:00:00Z'
  );

  insertTask.run(
    't-9',
    'c-pending',
    'Tax Exemption Certificate Verification',
    'one_time',
    'u-3',
    '2026-10-18',
    'approved',
    '2026-10',
    'Section 12AA approval certificate verification completed and signed off.',
    null,
    '2026-10-06T14:00:00Z',
    '2026-10-07T17:00:00Z'
  );

  console.log('Seeding complete. Initialized SQLite database successfully.');
}

// Backfill Pending Tasks container client for existing DBs if not present
try {
  const pendingClient = db.prepare("SELECT id FROM clients WHERE name = 'Pending Tasks' OR client_types LIKE '%Pending Tasks%'").get();
  if (!pendingClient) {
    db.prepare(`
      INSERT INTO clients (id, name, contact_person, phone, email, gstin, pan, notes, client_types, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'c-pending',
      'Pending Tasks',
      'Admin Desk',
      '+91 90000 00000',
      'desk@auditflow.internal',
      '',
      '',
      'System container for unclassified pending work.',
      JSON.stringify(['Pending Tasks']),
      new Date().toISOString()
    );

    // Also add a sample approved task so Move to Others is testable immediately
    db.prepare(`
      INSERT INTO tasks (id, client_id, title, task_type, assigned_to, due_date, status, month, notes, rework_comment, in_others, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      't-pending-demo',
      'c-pending',
      'Tax Exemption Certificate Verification',
      'one_time',
      'u-2',
      '2026-10-18',
      'approved',
      '2026-10',
      'Verified 80G/12AA compliance documents.',
      null,
      0,
      new Date().toISOString(),
      new Date().toISOString()
    );
  }
} catch (err) {
  console.error('Error ensuring Pending Tasks client:', err);
}

