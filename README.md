<div align="center">

<img src="https://img.shields.io/badge/AuditFlow-v1.0-crimson?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik05IDEyaDZtLTYgNGg2bS0xMCA4SDVhMiAyIDAgMDEtMi0yVjZhMiAyIDAgMDEyLTJoNS40NGExIDEgMCAwMS43MDcuMjkzbDYuMjY4IDYuMjY4QTEgMSAwIDAxMTkgMTEuMjY4VjIwYTIgMiAwIDAxLTIgMkgxM20tNyAwdjBhMiAyIDAgMDEtMi0yVjVhMiAyIDAgMDEyLTJoMXYxNGEyIDIgMCAwMS0yIDJ6Ii8+PC9zdmc+" alt="AuditFlow" />

# AuditFlow

### *Professional Audit & Compliance Management Platform*

**Internal web application for CA firms to manage tax compliance tasks, client records, portal credentials, and team workflows — with bank-grade encryption and zero hosting cost deployment.**

<br />

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-Local%20DB-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-D1%20%2B%20Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/)

[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen?style=flat-square)](https://github.com/rahul-1809/AuditFlow/pulls)
[![Security](https://img.shields.io/badge/Security-AES--256--GCM%20%2B%20PBKDF2-red?style=flat-square&logo=shield&logoColor=white)](#-security)

</div>

---

## 📋 Table of Contents

- [✨ Features](#-features)
- [🏗️ Architecture](#-architecture)
- [🔐 Security](#-security)
- [🚀 Quick Start](#-quick-start)
- [📁 Project Structure](#-project-structure)
- [🌐 Deployment](#-deployment)
- [🧪 Testing](#-testing)
- [👥 Pre-configured Demo Accounts](#-pre-configured-demo-accounts)
- [🛠️ Tech Stack](#-tech-stack)
- [📄 License](#-license)

---

## ✨ Features

<table>
<tr>
<td width="50%">

**📋 Task Management**
- Grouped task view by client & category
- Accordion-style client groupings
- Status lifecycle: `To Do` → `In Progress` → `Completed` → `Approved`
- Admin approval & send-back workflows
- Recurring task rollover support
- Quick filters by assignee, client, status

</td>
<td width="50%">

**🏢 Client Management**
- Full client profile with GSTIN & PAN
- Multi-type client support (GST, PF, ESI, IT, MCA)
- Two-panel list + detail layout
- Portal credential vault per client
- Internal notes & contact details
- Quick search & filtering

</td>
</tr>
<tr>
<td width="50%">

**🔑 Portal Credentials Vault**
- AES-256-GCM encrypted storage
- Show/hide password toggle
- One-click clipboard copy
- Per-portal username, password & notes
- Direct portal URL linking
- Admin-only credential management

</td>
<td width="50%">

**👥 Team Management**
- Admin & Assistant role separation
- Add / deactivate team members
- Per-user task assignment & tracking
- Password reset capability
- Active session management
- Role-based access control (RBAC)

</td>
</tr>
</table>

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        LOCAL DEVELOPMENT                        │
│                                                                  │
│   ┌─────────────────┐         ┌──────────────────────────────┐  │
│   │  React + Vite   │ ──/api──▶  Node.js Express API :3001   │  │
│   │   SPA  :5173    │◀──JSON──│  (JWT-less session auth)     │  │
│   └─────────────────┘         └──────────────┬───────────────┘  │
│                                              │                   │
│                                ┌─────────────▼───────────────┐  │
│                                │  SQLite  server/data/*.db    │  │
│                                │  (PBKDF2 users, AES creds)   │  │
│                                └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    PRODUCTION (Cloudflare)                       │
│                                                                  │
│          ┌──────────────────────────────────────────┐           │
│          │         Cloudflare Edge Network           │           │
│          │                                           │           │
│          │  ┌──────────────┐   ┌─────────────────┐  │           │
│          │  │  React SPA   │   │  CF Worker API  │  │           │
│          │  │ Static Assets│   │   /api/* routes │  │           │
│          │  └──────────────┘   └────────┬────────┘  │           │
│          └───────────────────────────────┼───────────┘           │
│                                          │                        │
│                           ┌──────────────▼──────────────┐        │
│                           │    Cloudflare D1 Database    │        │
│                           │  (Serverless SQLite at Edge) │        │
│                           └─────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

| Layer | Local Dev | Production |
|-------|-----------|------------|
| **Frontend** | Vite dev server `:5173` | Cloudflare Pages (static) |
| **Backend** | Express.js `:3001` | Cloudflare Worker |
| **Database** | SQLite file (`server/data/`) | Cloudflare D1 (serverless SQLite) |
| **Cost** | Free | **₹0 / month** |

---

## 🔐 Security

> [!IMPORTANT]
> AuditFlow is built with production-grade encryption. No plain-text secrets are ever stored.

| Concern | Implementation |
|---------|---------------|
| **User Passwords** | PBKDF2 + SHA-512, 100,000 iterations, unique cryptographic salt per user |
| **Portal Credentials** | AES-256-GCM encryption with a master secret key stored in Cloudflare Secrets (never in code) |
| **Database** | SQLite with no direct public access; all reads/writes go through the API layer |
| **Secrets in Git** | `.gitignore` excludes all `.env`, `.db`, and generated SQL seed files |
| **Role Separation** | Admin-only routes enforced server-side; clients, credentials & team management are admin-gated |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/rahul-1809/AuditFlow.git
cd AuditFlow

# 2. Install all dependencies
npm install
```

### Running Locally

Open **two terminal windows**:

**Terminal 1 — Backend API:**
```bash
npm run server
# → Express API running at http://127.0.0.1:3001
```

**Terminal 2 — Frontend:**
```bash
npm run dev
# → Vite dev server at http://127.0.0.1:5173
```

Then open **http://127.0.0.1:5173** in your browser.

> [!NOTE]
> The Vite dev server proxies all `/api/*` requests to the Express backend automatically. No CORS issues in local development.

---

## 📁 Project Structure

```
AuditFlow/
├── src/                        # React + TypeScript frontend
│   ├── components/             # Reusable UI components
│   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   ├── Modal.tsx           # Base modal wrapper
│   │   └── StatusBadge.tsx     # Task status badge component
│   ├── pages/                  # Full-page route views
│   │   ├── LoginPage.tsx       # Authentication screen
│   │   ├── TasksPage.tsx       # Task management (main view)
│   │   ├── ClientsPage.tsx     # Client records & credentials
│   │   └── TeamPage.tsx        # Team/user management (admin)
│   ├── context/
│   │   └── AuthContext.tsx     # Global auth state & session
│   ├── types/
│   │   └── index.ts            # Shared TypeScript interfaces
│   ├── index.css               # Global design system & styles
│   └── App.tsx                 # Root component & routing
│
├── server/                     # Node.js Express backend
│   ├── index.js                # API routes & Express server
│   ├── db.js                   # SQLite database layer & queries
│   └── crypto.js               # PBKDF2 & AES-256-GCM helpers
│
├── worker/                     # Cloudflare Worker (production API)
│   └── index.ts                # CF Worker API (mirrors server/index.js)
│
├── migrations/                 # D1 database schema migrations
│   └── 0001_initial_schema.sql # Initial tables & indexes
│
├── scripts/                    # CLI utilities
│   └── create-admin.js         # Interactive admin account setup tool
│
├── d1/                         # Cloudflare D1 artifacts (gitignored data)
├── vite.config.ts              # Vite + proxy configuration
├── wrangler.jsonc              # Cloudflare Wrangler configuration
└── package.json
```

---

## 🌐 Deployment

### Vercel Deployment (Frontend Only)

For deploying just the React frontend to Vercel:

1. **Import** the repository at [vercel.com/new](https://vercel.com/new)
2. Vercel auto-detects **Vite** — no configuration needed
3. Set **Build Command**: `npm run build`
4. Set **Output Directory**: `dist`

> [!WARNING]
> Vercel only hosts the **static frontend**. The Express backend (`server/`) needs a separate hosting solution (Railway, Render, Fly.io, etc.) or use the **Cloudflare full-stack deployment** below.

### Cloudflare Full-Stack Deployment (Recommended — Free)

Deploy the entire stack (frontend + API + database) to Cloudflare at **zero cost**. See the full guide: **[CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md)**

**Summary of steps:**
```bash
# 1. Login to Cloudflare
npx wrangler login

# 2. Create D1 database
npx wrangler d1 create auditflow-db

# 3. Apply schema migrations
npm run d1:migrate

# 4. Set encryption secret
npx wrangler secret put CREDENTIALS_SECRET

# 5. Create admin account
npm run create-admin

# 6. Build & deploy
npm run deploy
```

---

## 🧪 Testing

Run the end-to-end API verification suite against the running local backend:

```bash
# Make sure npm run server is running first
npm test
```

This validates all 10 core acceptance requirements including:
- Authentication & session management
- Task CRUD operations & status transitions
- Client & credential management APIs
- Admin-only route access control
- Encryption round-trips

---

## 👥 Pre-configured Demo Accounts

> [!CAUTION]
> These credentials are for **local development only**. The production database starts clean with zero accounts — you create your own admin via `npm run create-admin`.

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@auditflow.internal` | `admin123` |
| **Assistant 1** | `priya@auditflow.internal` | `assistant123` |
| **Assistant 2** | `amit@auditflow.internal` | `assistant123` |

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| [React](https://reactjs.org/) | 19.x | UI framework |
| [TypeScript](https://www.typescriptlang.org/) | 6.x | Type safety |
| [Vite](https://vitejs.dev/) | 8.x | Build tool & dev server |
| [Lucide React](https://lucide.dev/) | 1.52+ | Icon library |
| [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) | — | Primary UI font |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| [Node.js](https://nodejs.org/) | 18+ | Runtime |
| [Express](https://expressjs.com/) | 5.x | HTTP framework |
| [SQLite](https://sqlite.org/) | (built-in) | Local database |
| [PBKDF2](https://nodejs.org/api/crypto.html) | Node crypto | Password hashing |
| [AES-256-GCM](https://nodejs.org/api/crypto.html) | Node crypto | Credential encryption |

### Production / Deployment
| Technology | Purpose |
|-----------|---------|
| [Cloudflare Workers](https://workers.cloudflare.com/) | Serverless API runtime |
| [Cloudflare D1](https://developers.cloudflare.com/d1/) | Serverless SQLite database |
| [Wrangler](https://developers.cloudflare.com/workers/wrangler/) | Deployment CLI |

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ for CA firms that need a professional, secure, and cost-effective audit management tool.**

[![GitHub](https://img.shields.io/badge/GitHub-rahul--1809-181717?style=flat-square&logo=github)](https://github.com/rahul-1809)
[![AuditFlow](https://img.shields.io/badge/Repo-AuditFlow-crimson?style=flat-square&logo=github)](https://github.com/rahul-1809/AuditFlow)

</div>
