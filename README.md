<div align="center">

<img src="https://img.shields.io/badge/AuditFlow-v1.0-crimson?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik05IDEyaDZtLTYgNGg2bS0xMCA4SDVhMiAyIDAgMDEtMi0yVjZhMiAyIDAgMDEyLTJoNS40NGExIDEgMCAwMS43MDcuMjkzbDYuMjY4IDYuMjY4QTEgMSAwIDAxMTkgMTEuMjY4VjIwYTIgMiAwIDAxLTIgMkgxM20tNyAwdjBhMiAyIDAgMDEtMi0yVjVhMiAyIDAgMDEyLTJoMXYxNGEyIDIgMCAwMS0yIDJ6Ii8+PC9zdmc+" alt="AuditFlow" />

# AuditFlow

### *Professional Audit & Compliance Management Platform*

**Internal web application for CA firms to manage tax compliance tasks, client records, portal credentials, and team workflows — with bank-grade encryption.**

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
- [🏗️ Architecture](#%EF%B8%8F-architecture)
- [🔄 Data Flow](#-data-flow)
- [🔐 Security](#-security)
- [🚀 Quick Start](#-quick-start)
- [📁 Project Structure](#-project-structure)
- [🧪 Testing](#-testing)
- [👥 Pre-configured Demo Accounts](#-pre-configured-demo-accounts)
- [🛠️ Tech Stack](#%EF%B8%8F-tech-stack)
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

### Local Development

```mermaid
graph TD
    Browser["🌐 Browser\nhttp://localhost:5173"]
    Vite["⚡ Vite Dev Server\nReact + TypeScript SPA\n:5173"]
    Express["🟢 Express.js API\nNode.js Backend\n:3001"]
    SQLite[("🗄️ SQLite Database\nserver/data/auditflow.db")]

    Browser -->|"HTTP Request"| Vite
    Vite -->|"/api/* proxy"| Express
    Express -->|"SQL Queries"| SQLite
    SQLite -->|"Result rows"| Express
    Express -->|"JSON Response"| Vite
    Vite -->|"Rendered UI"| Browser

    style Browser fill:#e0f2fe,stroke:#0284c7,color:#0c4a6e
    style Vite fill:#f0f4ff,stroke:#6366f1,color:#312e81
    style Express fill:#f0fdf4,stroke:#16a34a,color:#14532d
    style SQLite fill:#fefce8,stroke:#ca8a04,color:#713f12
```

### Production (Cloudflare Stack)

```mermaid
graph TD
    User["🌐 User Browser\nHTTPS"]
    CF["☁️ Cloudflare Edge Network"]
    SPA["📦 React SPA\nStatic Assets"]
    Worker["⚙️ Cloudflare Worker\n/api/* routes"]
    D1[("🗄️ Cloudflare D1\nServerless SQLite")]

    User -->|"Single HTTPS URL"| CF
    CF -->|"Static files"| SPA
    CF -->|"/api/* requests"| Worker
    Worker -->|"D1 Binding"| D1
    D1 -->|"Query results"| Worker
    Worker -->|"JSON"| CF
    SPA -->|"Rendered UI"| User

    style User fill:#e0f2fe,stroke:#0284c7,color:#0c4a6e
    style CF fill:#fff7ed,stroke:#f97316,color:#7c2d12
    style SPA fill:#f0f4ff,stroke:#6366f1,color:#312e81
    style Worker fill:#f0fdf4,stroke:#16a34a,color:#14532d
    style D1 fill:#fefce8,stroke:#ca8a04,color:#713f12
```

---

## 🔄 Data Flow

### Task Status Lifecycle

```mermaid
stateDiagram-v2
    direction LR

    [*] --> ToDo : Task Created

    ToDo --> InProgress : Assistant starts work
    InProgress --> Completed : Assistant marks complete
    Completed --> Approved : Admin approves ✅
    Completed --> ToDo : Admin sends back 🔄

    Approved --> [*]

    ToDo : 🔵 To Do
    InProgress : 🟡 In Progress
    Completed : 🔷 Completed
    Approved : 🟢 Approved
```

### Authentication Flow

```mermaid
sequenceDiagram
    actor User
    participant SPA as React SPA
    participant API as Express API
    participant DB as SQLite DB

    User->>SPA: Enter email + password
    SPA->>API: POST /api/auth/login
    API->>DB: SELECT user WHERE email = ?
    DB-->>API: User record (hash + salt)
    API->>API: PBKDF2 verify (100k iterations)
    alt Credentials Valid
        API-->>SPA: 200 OK + session cookie
        SPA-->>User: Redirect to Dashboard
    else Invalid Credentials
        API-->>SPA: 401 Unauthorized
        SPA-->>User: Show error message
    end
```

### Credential Encryption

```mermaid
flowchart LR
    Plain["🔓 Plain Password\n(user input)"]
    Encrypt["🔐 AES-256-GCM\nEncryption"]
    Secret["🗝️ CREDENTIALS_SECRET\n(env variable)"]
    Store["🗄️ Database\n(cipher text only)"]
    Decrypt["🔓 AES-256-GCM\nDecryption"]
    Show["👁️ Revealed\nto Admin"]

    Plain --> Encrypt
    Secret --> Encrypt
    Encrypt --> Store
    Store --> Decrypt
    Secret --> Decrypt
    Decrypt --> Show

    style Plain fill:#fff1f2,stroke:#e11d48,color:#881337
    style Encrypt fill:#f0fdf4,stroke:#16a34a,color:#14532d
    style Secret fill:#fefce8,stroke:#ca8a04,color:#713f12
    style Store fill:#f0f4ff,stroke:#6366f1,color:#312e81
    style Decrypt fill:#f0fdf4,stroke:#16a34a,color:#14532d
    style Show fill:#ecfdf5,stroke:#059669,color:#064e3b
```

---

## 🔐 Security

> [!IMPORTANT]
> AuditFlow is built with production-grade encryption. No plain-text secrets are ever stored.

```mermaid
mindmap
  root((🔐 Security))
    User Passwords
      PBKDF2 + SHA-512
      100,000 iterations
      Unique salt per user
    Portal Credentials
      AES-256-GCM encryption
      Master key in env secrets
      Never stored in Git
    Access Control
      Admin-only API routes
      Server-side RBAC
      Session-based auth
    Git Safety
      .db files gitignored
      .env files gitignored
      No secrets in code
```

| Concern | Implementation |
|---------|---------------|
| **User Passwords** | PBKDF2 + SHA-512, 100,000 iterations, unique cryptographic salt per user |
| **Portal Credentials** | AES-256-GCM encryption with master secret key stored in environment (never in code) |
| **Database** | SQLite with no direct public access; all reads/writes go through the API layer |
| **Secrets in Git** | `.gitignore` excludes all `.env`, `.db`, and generated SQL seed files |
| **Role Separation** | Admin-only routes enforced server-side; credentials & team management are admin-gated |

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

```mermaid
graph TD
    Root["📁 AuditFlow/"]

    Root --> Src["📁 src/\nReact + TypeScript frontend"]
    Root --> Server["📁 server/\nNode.js Express backend"]
    Root --> Worker["📁 worker/\nCloudflare Worker API"]
    Root --> Migrations["📁 migrations/\nD1 schema migrations"]
    Root --> Scripts["📁 scripts/\nCLI utilities"]

    Src --> Components["📁 components/\nSidebar · Modal · StatusBadge"]
    Src --> Pages["📁 pages/\nLogin · Tasks · Clients · Team"]
    Src --> Context["📁 context/\nAuthContext.tsx"]
    Src --> Types["📁 types/\nindex.ts"]
    Src --> CSS["🎨 index.css\nDesign system"]

    Server --> SrvIndex["index.js\nAPI routes"]
    Server --> SrvDB["db.js\nDatabase layer"]
    Server --> SrvCrypto["crypto.js\nPBKDF2 + AES"]

    style Root fill:#0d1b2e,stroke:#334155,color:#f1f5f9
    style Src fill:#1e3a5f,stroke:#3b82f6,color:#bfdbfe
    style Server fill:#14532d,stroke:#16a34a,color:#bbf7d0
    style Worker fill:#4c1d95,stroke:#7c3aed,color:#ddd6fe
    style Migrations fill:#713f12,stroke:#d97706,color:#fef3c7
    style Scripts fill:#881337,stroke:#e11d48,color:#fecdd3
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
> These credentials are for **local development only**. The production database starts clean — create your own admin via `npm run create-admin`.

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@auditflow.internal` | `admin123` |
| **Assistant 1** | `priya@auditflow.internal` | `assistant123` |
| **Assistant 2** | `amit@auditflow.internal` | `assistant123` |

---

## 🛠️ Tech Stack

```mermaid
graph LR
    subgraph Frontend["🖥️ Frontend"]
        React["React 19"]
        TS["TypeScript 6"]
        Vite["Vite 8"]
        Lucide["Lucide React"]
    end

    subgraph Backend["⚙️ Backend"]
        Node["Node.js 18+"]
        Express["Express 5"]
        SQLite["SQLite"]
        Crypto["Node Crypto\nPBKDF2 · AES-256"]
    end

    subgraph Production["☁️ Production"]
        CFWorker["Cloudflare Workers"]
        D1["Cloudflare D1"]
        Wrangler["Wrangler CLI"]
    end

    Frontend -->|"REST /api"| Backend
    Backend -->|"Deploy"| Production

    style Frontend fill:#1e3a5f,stroke:#3b82f6,color:#bfdbfe
    style Backend fill:#14532d,stroke:#16a34a,color:#bbf7d0
    style Production fill:#7c2d12,stroke:#f97316,color:#fed7aa
```

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **UI Framework** | React | 19.x | Component-based SPA |
| **Type System** | TypeScript | 6.x | Static type safety |
| **Build Tool** | Vite | 8.x | Dev server & bundler |
| **Icons** | Lucide React | 1.52+ | Icon library |
| **Runtime** | Node.js | 18+ | Backend runtime |
| **HTTP** | Express | 5.x | REST API framework |
| **Local DB** | SQLite | built-in | Development database |
| **Password Hash** | PBKDF2 + SHA-512 | Node crypto | User auth security |
| **Encryption** | AES-256-GCM | Node crypto | Credential vault |
| **Edge API** | Cloudflare Workers | — | Serverless production API |
| **Edge DB** | Cloudflare D1 | — | Serverless SQLite at edge |

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ for CA firms that need a professional, secure audit management tool.**

[![GitHub](https://img.shields.io/badge/GitHub-rahul--1809-181717?style=flat-square&logo=github)](https://github.com/rahul-1809)
[![AuditFlow](https://img.shields.io/badge/Repo-AuditFlow-crimson?style=flat-square&logo=github)](https://github.com/rahul-1809/AuditFlow)

</div>
