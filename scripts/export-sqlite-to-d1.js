import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const dbPath = path.join(projectRoot, 'server', 'data', 'auditflow.db');
if (!fs.existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}`);
  process.exit(1);
}

const db = new DatabaseSync(dbPath);

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

console.log('Reading data from local SQLite database...');

// 1. Users
const users = db.prepare('SELECT * FROM users ORDER BY created_at ASC').all();
// 2. Clients
const clients = db.prepare('SELECT * FROM clients ORDER BY created_at ASC').all();
// 3. Credentials
const credentials = db.prepare('SELECT * FROM client_credentials ORDER BY updated_at ASC').all();
// 4. Tasks
const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at ASC').all();

console.log(`Found: ${users.length} users, ${clients.length} clients, ${credentials.length} credentials, ${tasks.length} tasks`);

let sql = `-- Cloudflare D1 Seed & Migration Data Export
-- Generated automatically from local SQLite (auditflow.db)
-- Preserves all AES-256-GCM encrypted credentials, user PBKDF2 hashes, clients, and tasks.

`;

// Users
if (users.length > 0) {
  sql += `-- =====================================================\n`;
  sql += `-- 1. USERS (${users.length} records)\n`;
  sql += `-- =====================================================\n`;
  for (const u of users) {
    sql += `INSERT OR IGNORE INTO users (id, email, name, role, password_hash, password_salt, status, created_at) VALUES (${escapeSql(u.id)}, ${escapeSql(u.email)}, ${escapeSql(u.name)}, ${escapeSql(u.role)}, ${escapeSql(u.password_hash)}, ${escapeSql(u.password_salt)}, ${escapeSql(u.status)}, ${escapeSql(u.created_at)});\n`;
  }
  sql += '\n';
}

// Clients
if (clients.length > 0) {
  sql += `-- =====================================================\n`;
  sql += `-- 2. CLIENTS (${clients.length} records)\n`;
  sql += `-- =====================================================\n`;
  for (const c of clients) {
    sql += `INSERT OR IGNORE INTO clients (id, name, contact_person, phone, email, gstin, pan, notes, client_types, created_at) VALUES (${escapeSql(c.id)}, ${escapeSql(c.name)}, ${escapeSql(c.contact_person)}, ${escapeSql(c.phone)}, ${escapeSql(c.email)}, ${escapeSql(c.gstin)}, ${escapeSql(c.pan)}, ${escapeSql(c.notes)}, ${escapeSql(c.client_types)}, ${escapeSql(c.created_at)});\n`;
  }
  sql += '\n';
}

// Credentials
if (credentials.length > 0) {
  sql += `-- =====================================================\n`;
  sql += `-- 3. CLIENT CREDENTIALS (${credentials.length} records)\n`;
  sql += `-- =====================================================\n`;
  for (const cr of credentials) {
    sql += `INSERT OR IGNORE INTO client_credentials (id, client_id, portal_name, portal_url, username, encrypted_password, iv, tag, notes, updated_at) VALUES (${escapeSql(cr.id)}, ${escapeSql(cr.client_id)}, ${escapeSql(cr.portal_name)}, ${escapeSql(cr.portal_url)}, ${escapeSql(cr.username)}, ${escapeSql(cr.encrypted_password)}, ${escapeSql(cr.iv)}, ${escapeSql(cr.tag)}, ${escapeSql(cr.notes)}, ${escapeSql(cr.updated_at)});\n`;
  }
  sql += '\n';
}

// Tasks
if (tasks.length > 0) {
  sql += `-- =====================================================\n`;
  sql += `-- 4. TASKS (${tasks.length} records)\n`;
  sql += `-- =====================================================\n`;
  for (const t of tasks) {
    sql += `INSERT OR IGNORE INTO tasks (id, client_id, title, category, task_type, assigned_to, due_date, status, month, notes, rework_comment, in_others, created_at, updated_at) VALUES (${escapeSql(t.id)}, ${escapeSql(t.client_id)}, ${escapeSql(t.title)}, ${escapeSql(t.category)}, ${escapeSql(t.task_type)}, ${escapeSql(t.assigned_to)}, ${escapeSql(t.due_date)}, ${escapeSql(t.status)}, ${escapeSql(t.month)}, ${escapeSql(t.notes)}, ${escapeSql(t.rework_comment)}, ${escapeSql(t.in_others)}, ${escapeSql(t.created_at)}, ${escapeSql(t.updated_at)});\n`;
  }
  sql += '\n';
}

const outMigrationsPath = path.join(projectRoot, 'd1', 'optional_local_seed.sql');
fs.writeFileSync(outMigrationsPath, sql, 'utf8');
console.log(`Successfully exported data to ${outMigrationsPath} (OPTIONAL ARTIFACT ONLY)`);
