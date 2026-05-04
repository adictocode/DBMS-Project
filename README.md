# 🗳️ VoteSecure — Online Voting System

A production-grade, full-stack online voting application built on a **hardened MySQL database** with tamper-evident audit trails, atomic transactions, and comprehensive business-rule enforcement via triggers and stored procedures.

## Architecture

```
┌─────────────────┐     HTTP/JSON     ┌─────────────────┐      SQL       ┌──────────────────────┐
│   React SPA     │ ◄──────────────── │   Flask API     │ ◄──────────── │   MySQL Database     │
│   (Vite)        │                   │   (thin bridge) │               │   (hardened)         │
│   Port 5173     │                   │   Port 5000     │               │                      │
│                 │                   │                 │               │ • 14 triggers        │
│ • Dashboard     │                   │ • /api/voters   │               │ • 9 stored procs     │
│ • Register      │                   │ • /api/elections│               │ • 4 views            │
│ • Vote          │                   │ • /api/votes    │               │ • 4 functions        │
│ • Results       │                   │ • /api/results  │               │ • Full ACID txns     │
│ • Audit Log     │                   │ • /api/audit    │               │ • SIGNAL error flow  │
└─────────────────┘                   └─────────────────┘               └──────────────────────┘
```

**Key Design Principle:** The Flask backend is a *thin bridge* — it contains **zero raw SQL CRUD operations**. All mutations go through stored procedures (`CALL cast_vote`, `CALL register_voter`, etc.), and all reads come from database views (`vw_live_tally`, `vw_turnout`, etc.).

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** and **npm**
- **MySQL 8.0+**

## Quick Start

### 1. Database Setup

```bash
# Create the database and load the schema
mysql -u root -p -e "CREATE DATABASE online_voting_system;"
mysql -u root -p online_voting_system < DbmsProject_Final.sql
```

### 2. Backend Setup

```bash
cd backend

# Create a virtual environment
python -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your MySQL credentials

# Start the Flask server
python app.py
```

The API will be available at `http://localhost:5000`.

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server (auto-proxies /api to Flask)
npm run dev
```

The app will be available at `http://localhost:5173`.

## API Endpoints

| Method | Endpoint | Description | DB Mechanism |
|--------|----------|-------------|--------------|
| POST | `/api/voters/register` | Register voter | `CALL register_voter()` |
| GET | `/api/voters/:id/eligibility` | Check eligibility | `SELECT is_eligible()` |
| POST | `/api/voters/:id/deactivate` | Deactivate voter | `CALL deactivate_voter()` |
| GET | `/api/voters/pending` | Unvoted voters | `vw_pending_voters` |
| GET | `/api/elections` | List elections | `SELECT * FROM Elections` |
| POST | `/api/elections/create` | Create election | `CALL create_election()` |
| POST | `/api/elections/:id/activate` | Activate election | `CALL activate_election()` |
| POST | `/api/elections/:id/close` | Close election | `CALL close_election()` |
| POST | `/api/elections/:id/cancel` | Cancel election | `CALL cancel_election()` |
| POST | `/api/votes/cast` | Cast vote | `CALL cast_vote()` |
| GET | `/api/results/tally` | Live tally | `vw_live_tally` |
| GET | `/api/results/turnout` | Turnout % | `vw_turnout` |
| GET | `/api/results/performance` | Party seats | `vw_party_performance` |
| GET | `/api/results/winner/:e/:c` | Get winner | `CALL get_winner()` |
| GET | `/api/audit/logs` | Audit trail | `SELECT * FROM Audit_Log` |

## Error Handling Flow

```
MySQL Trigger/Procedure
  → SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Voter is under 18'
    → mysql.connector.Error (sqlstate='45000')
      → Flask error handler (errors.py) → HTTP 400 {"error": "Voter is under 18"}
        → React ApiError → ErrorToast component
```

## 🤖 AI Agent Integration Points

The codebase includes documented hooks for integrating a GenAI security agent:

| File | Hook | Purpose |
|------|------|---------|
| `backend/config.py` | `AI_AGENT_WEBHOOK_URL` | Agent endpoint configuration |
| `backend/routes/audit.py` | `_notify_ai_agent()` | Push audit events to agent |
| `backend/routes/audit.py` | `POST /api/audit/analyze` | Agent posts analysis results |
| `backend/app.py` | Startup comment block | Initialize agent on app start |
| `frontend/src/api/client.js` | `streamAgentAlerts` | WebSocket for real-time alerts |
| `frontend/src/pages/AuditLog.jsx` | `#agent-alerts` div | Render anomaly alert cards |

## Project Structure

```
OnlineVotingSystem_DBMS/
├── DbmsProject_Final.sql           # Hardened database schema
├── README.md
├── backend/
│   ├── .env.example
│   ├── requirements.txt
│   ├── app.py                      # Flask application factory
│   ├── config.py                   # Environment-based configuration
│   ├── database.py                 # Connection pool + query helpers
│   ├── errors.py                   # MySQL SIGNAL → HTTP 400 translator
│   └── routes/
│       ├── __init__.py             # Blueprint registry
│       ├── voters.py               # Voter management
│       ├── elections.py            # Election lifecycle
│       ├── votes.py                # Vote casting
│       ├── results.py              # Tally, turnout, performance
│       └── audit.py                # Audit log + AI hooks
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css               # Design system
        ├── api/client.js           # Centralized fetch wrapper
        ├── components/
        │   ├── Navbar.jsx + .css
        │   ├── StatusBadge.jsx
        │   └── ErrorToast.jsx + .css
        └── pages/
            ├── Dashboard.jsx + .css
            ├── RegisterVoter.jsx + .css
            ├── CastVote.jsx + .css
            ├── Results.jsx + .css
            └── AuditLog.jsx + .css
```

## Built With

- **Backend:** Python, Flask, mysql-connector-python
- **Frontend:** React 18, React Router, Vite
- **Database:** MySQL 8.0 with advanced triggers, stored procedures, views
- **Styling:** Vanilla CSS with glassmorphism design system

---


