# AuditFlow

A compact, professional internal web application for an auditor and two assistants.

## Architecture

- **Frontend**: React + TypeScript + Vite (`http://127.0.0.1:5173`)
- **Backend API**: Node.js Express server (`http://127.0.0.1:3001`)
- **Database**: Local SQLite database file (`server/data/auditflow.db`)
- **Security**: 
  - User login passwords hashed with PBKDF2 (SHA-512) and unique cryptographic salts.
  - Client portal passwords encrypted via AES-256-GCM.

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the backend server**:
   ```bash
   npm run server
   ```

3. **Start the frontend application** (in a separate terminal):
   ```bash
   npm run dev
   ```

4. Open `http://127.0.0.1:5173/` in your browser.

## Run Verification Suite

To verify all 10 core acceptance requirements against the running backend:
```bash
npm test
```

## Pre-Configured Accounts

- **Admin**: `admin@auditflow.internal` (Password: `admin123`)
- **Assistant 1**: `priya@auditflow.internal` (Password: `assistant123`)
- **Assistant 2**: `amit@auditflow.internal` (Password: `assistant123`)
