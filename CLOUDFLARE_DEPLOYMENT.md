# Cloudflare Free Tier (₹0/month) Production Deployment Guide

This guide details the single, streamlined deployment process for **AuditFlow (AJ Associates)** to Cloudflare's **100% Free Tier** with zero hosting costs and a clean production database.

---

## 1. Zero-Cost Architectural Overview

```
                      [ User Browser ]
                             │
                             ▼  (Single HTTPS URL)
         ┌───────────────────────────────────────┐
         │       Cloudflare Edge Network         │
         │                                       │
         │  ┌──────────────────┐  ┌───────────┐  │
         │  │ React + Vite SPA │  │ Worker    │  │
         │  │ (Static Assets)  │  │ API /api  │  │
         │  └──────────────────┘  └─────┬─────┘  │
         └──────────────────────────────┼────────┘
                                        │
                                        ▼
                         ┌─────────────────────────────┐
                         │    Cloudflare D1 Database   │
                         │ (Serverless SQLite at Edge) │
                         │    AES-256-GCM Encrypted    │
                         └─────────────────────────────┘
```

- **Cloudflare Worker API**: 100,000 free requests/day (*internal 3-user firm uses ~200–500 req/day*).
- **Static SPA Assets**: Unlimited free requests with SPA client-side routing.
- **Cloudflare D1 Database**: 5,000,000 reads/day and 100,000 writes/day free (*internal DB is <10 MB*).
- **Single URL**: Static frontend and `/api/*` backend live on the exact same domain.
- **Total Monthly Cost**: **₹0.00 / month forever**.

---

## 2. Exact Deployment Sequence

Follow these 9 steps in exact order to deploy to production:

### Step 1: Log in to Cloudflare
Log in to your free Cloudflare account from your terminal:
```bash
npx wrangler login
```
*(A browser window will open. Click **Authorize**).*

---

### Step 2: Create the Production D1 Database
Create the empty serverless SQLite database in Cloudflare D1:
```bash
npx wrangler d1 create auditflow-db
```
Wrangler will print output similar to:
```text
[[d1_databases]]
binding = "DB"
database_name = "auditflow-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

---

### Step 3: Configure D1 Database ID
Open [`wrangler.jsonc`](./wrangler.jsonc) and replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` on line 15 with your actual `database_id`:
```jsonc
    {
      "binding": "DB",
      "database_name": "auditflow-db",
      "database_id": "YOUR_ACTUAL_DATABASE_ID_FROM_STEP_2",
      "migrations_dir": "migrations"
    }
```

---

### Step 4: Apply Schema to Clean Production Database
Initialize the empty database tables (`users`, `clients`, `client_credentials`, `tasks`) and edge performance indexes:
```bash
npm run d1:migrate
```
*Alternatively:*
```bash
npx wrangler d1 migrations apply auditflow-db --remote
```
*(This only runs `migrations/0001_initial_schema.sql`. Production starts 100% clean with zero test clients, zero test tasks, and zero test credentials).*

---

### Step 5: Create and Set the Credential Encryption Secret
Set your production master encryption key (used for AES-256-GCM client portal password encryption). This secret is stored securely at the Cloudflare edge and is never exposed in Git or browser code:
```bash
npx wrangler secret put CREDENTIALS_SECRET
```
*When prompted, paste or type a strong, unique secret passphrase (e.g., 32+ random characters).*

---

### Step 6: Create Your Initial Production Admin Securely
Run the interactive CLI setup utility to hash your admin password with PBKDF2 (100,000 iterations, sha512) and prepare the database insert:
```bash
npm run create-admin
```
*(The tool prompts for Admin Full Name, Email, and Password with masked input. No passwords are ever stored in Git).*

Execute the generated SQL file against your remote D1 database:
```bash
npx wrangler d1 execute auditflow-db --remote --file=./d1/.init-admin.sql
```

Immediately remove the temporary SQL file:
```bash
# On Windows PowerShell:
Remove-Item d1/.init-admin.sql

# On Linux/macOS:
rm d1/.init-admin.sql
```

---

### Step 7: Build the Application
Compile the React/TypeScript frontend and generate the production assets in `./dist`:
```bash
npm run build
```

---

### Step 8: Deploy Full Stack Application
Deploy the static assets and Cloudflare Worker API together with a single command:
```bash
npm run deploy
```
*Wrangler will package the `./dist` assets, bundle `worker/index.ts`, bind your D1 database, and upload everything.*

---

### Step 9: Open and Test Production URL
Wrangler outputs your live HTTPS production URL at the end of the deployment:
```text
Uploaded 3 files
Total Upload: ~340 KiB
Deployed auditflow triggers:
  https://auditflow.<your-subdomain>.workers.dev
```

1. Open `https://auditflow.<your-subdomain>.workers.dev` in your browser.
2. Log in using the Admin email and password created in **Step 6**.
3. Create your assistants under the **Team** module.
4. Add your first client and test adding portal credentials.
5. Refresh the page on `/tasks` or `/clients` to verify single-page application routing works seamlessly without 404s.

---

## 3. Maintenance & Optional Artifacts

- **Local Development**: Completely untouched. Run `npm run server` and `npm run dev` as normal. Your local SQLite database `server/data/auditflow.db` remains intact.
- **Optional Local Data Export**: [`d1/optional_local_seed.sql`](./d1/optional_local_seed.sql) is an optional manual export artifact and is **NEVER** run during normal migrations or deployments.
- **Production Database Backups**: Run at any time:
  ```bash
  npx wrangler d1 export auditflow-db --remote --output=./backup_$(date +%Y%m%d).sql
  ```
