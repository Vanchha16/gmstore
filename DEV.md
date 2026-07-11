# Running locally (Phase 0)

## Backend
```bash
cd backend
cp .env.example .env          # edit DATABASE_URL if needed
.venv/Scripts/python app.py   # Windows
# or: python app.py           # if venv is activated
```
Runs on http://localhost:5000

Health check: GET http://localhost:5000/api/v1/health

## Frontend
```bash
cd frontend
npm install
npm run dev
```
Runs on http://localhost:5173 — the Vite proxy forwards `/api/*` to Flask.

## MySQL
Database `gmstore` must exist:
```sql
CREATE DATABASE IF NOT EXISTS gmstore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```
