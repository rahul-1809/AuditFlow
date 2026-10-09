import readline from 'node:readline';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Helper to ask question with masked password input
function question(query, isPassword = false) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (!isPassword) {
      rl.question(query, (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    } else {
      process.stdout.write(query);
      let pass = '';
      process.stdin.setRawMode?.(true);
      process.stdin.resume();

      const onData = (chunk) => {
        const char = chunk.toString();
        if (char === '\n' || char === '\r' || char === '\u0004') {
          process.stdin.setRawMode?.(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          rl.close();
          process.stdout.write('\n');
          resolve(pass.trim());
        } else if (char === '\u0003') {
          // Ctrl+C
          process.stdout.write('\n');
          process.exit(1);
        } else if (char === '\b' || char === '\x7f') {
          // Backspace
          if (pass.length > 0) {
            pass = pass.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          pass += char;
          process.stdout.write('*');
        }
      };

      process.stdin.on('data', onData);
    }
  });
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) result.name = args[++i];
    if (args[i] === '--email' && args[i + 1]) result.email = args[++i];
    if (args[i] === '--password' && args[i + 1]) result.password = args[++i];
  }
  return result;
}

async function main() {
  console.log('====================================================');
  console.log('AUDITFLOW: SECURE INITIAL ADMIN CREATION FOR D1');
  console.log('====================================================');
  console.log('This utility hashes the password with PBKDF2 (100,000');
  console.log('iterations, sha512) and generates a secure D1 SQL insert.');
  console.log('No passwords or credentials will be stored in Git.\n');

  const cli = parseCliArgs();

  const name = cli.name || (await question('Enter Admin Full Name (e.g., CA Rajesh Sharma): '));
  if (!name) {
    console.error('Error: Admin name is required.');
    process.exit(1);
  }

  const email = cli.email || (await question('Enter Admin Email (e.g., admin@ajassociates.in): '));
  if (!email || !email.includes('@')) {
    console.error('Error: A valid email address is required.');
    process.exit(1);
  }

  let password = cli.password;
  if (!password) {
    password = await question('Enter Admin Password: ', true);
    if (!password || password.length < 6) {
      console.error('Error: Password must be at least 6 characters.');
      process.exit(1);
    }
    const confirm = await question('Confirm Admin Password: ', true);
    if (password !== confirm) {
      console.error('Error: Passwords do not match.');
      process.exit(1);
    }
  }

  // Generate PBKDF2 salt & hash
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  const userId = `u-admin-1`;
  const createdAt = new Date().toISOString();

  // Escape single quotes for SQL safety
  const safeName = name.replace(/'/g, "''");
  const safeEmail = email.toLowerCase().replace(/'/g, "''");

  const sql = `-- Secure Initial Admin Creation for AuditFlow (AJ Associates)
-- Generated on: ${createdAt}
INSERT OR REPLACE INTO users (id, email, name, role, password_hash, password_salt, status, created_at)
VALUES ('${userId}', '${safeEmail}', '${safeName}', 'admin', '${hash}', '${salt}', 'active', '${createdAt}');
`;

  const d1Dir = path.join(projectRoot, 'd1');
  if (!fs.existsSync(d1Dir)) {
    fs.mkdirSync(d1Dir, { recursive: true });
  }

  const outSqlPath = path.join(d1Dir, '.init-admin.sql');
  fs.writeFileSync(outSqlPath, sql, 'utf8');

  console.log('\n✓ Initial Admin SQL generated successfully!');
  console.log(`  File: d1/.init-admin.sql (automatically ignored by git)\n`);
  console.log('To apply this to your remote Cloudflare D1 production database, run:');
  console.log('----------------------------------------------------');
  console.log('npx wrangler d1 execute auditflow-db --remote --file=./d1/.init-admin.sql');
  console.log('----------------------------------------------------');
  console.log('\nOnce applied, delete d1/.init-admin.sql:');
  console.log('rm d1/.init-admin.sql  (or on Windows: del d1\\.init-admin.sql)');
  console.log('====================================================\n');
}

main().catch((err) => {
  console.error('Error creating admin SQL:', err);
  process.exit(1);
});
