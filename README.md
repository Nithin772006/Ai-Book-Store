# AI Online Bookstore

An AI-Powered Online Bookstore built with **React (Vite)** on the frontend and **Django REST Framework** on the backend.

---

## Project Status: Phase 1 (Foundation & Health Check)

Phase 1 establishes the decoupled full-stack architecture, sets up isolated environments, configures CORS policies, and validates connectivity through a dedicated API health-check endpoint.

---

## Architecture Overview

```
Ai-Bookstore/
├── frontend/                     # React Single Page Application (Vite)
│   ├── src/
│   │   ├── api.js                # Reusable Axios API client with VITE_API_URL configuration
│   │   ├── App.jsx               # System health status dashboard component
│   │   ├── App.css               # Modern status card styling & animations
│   │   ├── index.css             # Global design system & theme variables
│   │   └── main.jsx              # React application entry point
│   ├── .env                      # Local environment configuration (VITE_API_URL)
│   ├── .env.example              # Environment variables template
│   ├── index.html                # HTML template with typography & SEO tags
│   ├── package.json              # Node.js project manifest & dependencies
│   └── vite.config.js            # Vite configuration (port 5173)
├── backend/                      # Django REST Framework Backend
│   ├── api/                      # Core bookstore API application
│   │   ├── views.py              # Health check endpoint view
│   │   ├── urls.py               # API route definitions (/health/)
│   │   └── tests.py              # Automated test suite
│   ├── config/                   # Django project configuration
│   │   ├── settings.py           # DRF, CORS, database, and application settings
│   │   ├── urls.py               # Root URL router (mounts /api/)
│   │   ├── asgi.py               # ASGI entry point
│   │   └── wsgi.py               # WSGI entry point
│   ├── .venv/                    # Python virtual environment (ignored by Git)
│   ├── manage.py                 # Django management script
│   ├── requirements.txt          # Python dependencies
│   ├── .env.example              # Backend environment template
│   └── db.sqlite3                # Local SQLite database (ignored by Git)
├── .gitignore                    # Git ignore file for Python, Node, env, and DB
└── README.md                     # Project documentation & instructions
```

---

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** & **npm 9+**
- **Windows PowerShell**

---

## Getting Started (Windows PowerShell)

Open two separate Windows PowerShell terminal tabs in VS Code or Windows Terminal.

### 1. Backend Setup & Run

In the first terminal:

```powershell
# Navigate to the backend directory
cd backend

# Create virtual environment (if not already created)
python -m venv .venv

# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Upgrade pip and install dependencies
pip install -r requirements.txt

# Run initial database migrations
python manage.py migrate

# Run automated tests to verify API and CORS headers
python manage.py test

# Start Django development server on port 8000
python manage.py runserver 127.0.0.1:8000
```

The Django API server will be available at `http://127.0.0.1:8000`.

### 2. Frontend Setup & Run

In the second terminal:

```powershell
# Navigate to the frontend directory
cd frontend

# Install npm dependencies (if not already installed)
npm install

# Verify environment file exists (configured to http://127.0.0.1:8000)
# (Copy from .env.example if missing: Copy-Item .env.example .env)

# Start Vite development server on port 5173
npm run dev
```

The React dashboard will be accessible at `http://127.0.0.1:5173` or `http://localhost:5173`.

---

## Verification & API Endpoints

### Direct API Health Check (Browser / PowerShell)

Visit in your browser:
```
http://127.0.0.1:8000/api/health/
```

Or test using PowerShell:
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health/"
```

**Expected JSON Response:**
```json
{
  "status": "success",
  "message": "Online Bookstore API is running!",
  "project": "AI Online Bookstore",
  "version": "1.0.0"
}
```

### React Health Dashboard

Visit `http://localhost:5173` in your browser. The status card will:
1. Show a loading indicator while requesting Django.
2. Display a success badge with project name, API version, status code, and latency.
3. Render the live JSON response payload.
4. Allow instant re-verification with the "Check Again" button.
5. Provide detailed troubleshooting steps if the backend server is stopped.

---

## CORS Security Policy

CORS is restricted strictly to local React origins in `backend/config/settings.py`:
- `http://localhost:5173`
- `http://127.0.0.1:5173`

---

## Troubleshooting Guide

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| **Connection Refused / Failed to Fetch** | Django server is not running on port 8000 | In the backend terminal, run `python manage.py runserver 127.0.0.1:8000` |
| **CORS Error in Browser Console** | Origin mismatch | Ensure frontend is accessed on port 5173 and `CORS_ALLOWED_ORIGINS` in `backend/config/settings.py` includes your origin |
| **PowerShell script execution policy error** | PowerShell execution policy restricted | Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in your PowerShell session before activating `.venv` |
| **Port 8000 / 5173 already in use** | Another process occupies the port | Stop the conflicting process or specify an alternative port and update `frontend/.env` accordingly |

---

## Next Steps (Phase 2)

- Book data models and migrations
- Custom User Authentication & JWT / Session management
- Django Admin interface customization
