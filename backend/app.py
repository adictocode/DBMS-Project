"""
app.py — Flask Application Factory
====================================
Entry point for the Online Voting System backend.

Architecture:
    ┌─────────┐     ┌──────────┐     ┌──────────────────┐
    │  React  │────▶│  Flask   │────▶│  MySQL Database   │
    │Frontend │◀────│  (this)  │◀────│  (stored procs,   │
    │  :5173  │JSON │  :5000   │SQL  │   triggers, views)│
    └─────────┘     └──────────┘     └──────────────────┘

    The Flask backend is a THIN BRIDGE — it translates HTTP/JSON
    into stored procedure calls and view queries. All business logic
    lives in the database (DbmsProject_Final.sql).

Usage:
    Development:  python app.py
    Production:   gunicorn app:app --workers 4

Interview Note:
    This file demonstrates the Application Factory pattern, Flask
    Blueprints for modular routing, CORS configuration, and
    centralized error handling — all production best practices.
"""

from flask import Flask
from flask_cors import CORS

from config import Config
from errors import register_error_handlers
from routes import ALL_BLUEPRINTS


def create_app() -> Flask:
    """
    Application factory — creates and configures the Flask app.

    Why a factory function%s
        1. Testability — tests can create isolated app instances
        2. Multiple configs — dev/staging/prod can each get a different config
        3. Avoids circular imports — modules import the factory, not a global `app`
    """
    app = Flask(__name__)
    app.config.from_object(Config)

    # ── CORS ──
    # Allow the React dev server (localhost:5173) to make API calls.
    # In production, replace with your actual domain.
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # ── Error Handlers ──
    # Translates MySQL SIGNAL errors into HTTP 400 responses.
    # See errors.py for the full error flow documentation.
    register_error_handlers(app)

    # ── Blueprints ──
    # Each blueprint handles a domain: voters, elections, votes, results, audit.
    # Adding a new domain is as simple as creating a new file in routes/
    # and appending it to ALL_BLUEPRINTS in routes/__init__.py.
    for bp in ALL_BLUEPRINTS:
        app.register_blueprint(bp)

    # ── Health Check ──
    @app.route("/api/health", methods=["GET"])
    def health():
        """Simple health check — useful for monitoring and load balancers."""
        return {"status": "healthy", "service": "online-voting-api"}, 200

    # ── 🤖 AI AGENT HOOK — Startup ──
    # When you integrate an AI agent, you can initialize it here:
    #
    # from ai_agent import VotingSecurityAgent
    # agent = VotingSecurityAgent(config=Config)
    # agent.start_monitoring()  # begins polling /api/audit/logs
    #
    # Or register a background task:
    # from apscheduler.schedulers.background import BackgroundScheduler
    # scheduler = BackgroundScheduler()
    # scheduler.add_job(agent.check_anomalies, 'interval', seconds=30)
    # scheduler.start()

    return app


# ================================================================
#  Entry point for `python app.py`
# ================================================================
app = create_app()

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  ONLINE VOTING SYSTEM — Backend API")
    print("  Running on http://localhost:5001")
    print("  API docs: See routes/ directory for all endpoints")
    print("=" * 60 + "\n")

    app.run(
        host="0.0.0.0",
        port=5001,
        debug=Config.DEBUG
    )
