"""
config.py — Centralized Configuration
======================================
Single source of truth for all application settings.
Reads from environment variables with sensible defaults.

Interview Note:
    This pattern (env → config class → app) is standard in production
    Flask apps. It decouples configuration from code, following the
    12-Factor App methodology (https://12factor.net/config).
"""

import os
from dotenv import load_dotenv

# Load .env file if it exists (development convenience)
load_dotenv()


class Config:
    """
    Application configuration.
    All values are read from environment variables at import time.
    """

    # --- Flask Core ---
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "dev-fallback-key")
    DEBUG = os.getenv("FLASK_DEBUG", "False").lower() in ("true", "1", "yes")

    # --- MySQL Database ---
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = int(os.getenv("DB_PORT", "3306"))
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_NAME = os.getenv("DB_NAME", "online_voting_system")

    # Connection pool size — 5 is appropriate for a single-server
    # deployment; increase for production behind a load balancer.
    DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "5"))

    # --- AI Agent Integration (Future) ---
    # ┌──────────────────────────────────────────────────────────┐
    # │  🤖 AI AGENT HOOK — Configuration                       │
    # │                                                          │
    # │  When you build your GenAI security agent, set these     │
    # │  env vars to enable real-time audit log monitoring.      │
    # │                                                          │
    # │  The agent can consume events via:                       │
    # │    1. Webhook (push model) — set AI_AGENT_WEBHOOK_URL    │
    # │    2. Polling (pull model) — agent queries /api/audit    │
    # │                                                          │
    # │  See routes/audit.py for the integration point.          │
    # └──────────────────────────────────────────────────────────┘
    AI_AGENT_WEBHOOK_URL = os.getenv("AI_AGENT_WEBHOOK_URL", None)
    AI_AGENT_API_KEY = os.getenv("AI_AGENT_API_KEY", None)
