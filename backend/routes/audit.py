"""
routes/audit.py — Audit Log Endpoints + AI Agent Integration Hooks
===================================================================
The Audit_Log table is tamper-evident (UPDATE and DELETE are blocked
by triggers trg_audit_no_update and trg_audit_no_delete).

This module provides read-only access to audit records and contains
the primary integration point for a future GenAI security agent.

┌──────────────────────────────────────────────────────────────────┐
│  🤖 AI AGENT INTEGRATION POINT                                  │
│                                                                  │
│  This file is designed to be the bridge between the voting       │
│  system and an AI-powered security monitoring agent.             │
│                                                                  │
│  Suggested Agent Capabilities:                                   │
│    1. Anomaly Detection — flag unusual voting patterns           │
│       (e.g., burst of votes from same constituency in seconds)   │
│    2. Fraud Pattern Matching — cross-reference audit events      │
│       with known attack signatures                               │
│    3. Real-time Alerts — push notifications when suspicious      │
│       events are detected                                        │
│    4. Natural Language Queries — "Show me all deactivated        │
│       voters in the last hour"                                   │
│                                                                  │
│  Integration Architecture:                                       │
│    • PUSH: After each audit query, optionally forward events     │
│      to the agent's webhook (see _notify_ai_agent below)         │
│    • PULL: The agent can poll GET /api/audit/logs?since=<ts>     │
│      to fetch new events since its last check                    │
│    • INLINE: Mount agent analysis at /api/audit/analyze          │
└──────────────────────────────────────────────────────────────────┘
"""

import logging
from flask import Blueprint, request, jsonify
from database import query_view
from config import Config

audit_bp = Blueprint("audit", __name__, url_prefix="/api/audit")
logger = logging.getLogger(__name__)


# ================================================================
#  🤖 AI AGENT HOOK — Event Notification (PUSH model)
# ================================================================
def _notify_ai_agent(events: list[dict]) -> None:
    """
    Forward audit events to the AI agent's webhook endpoint.

    This function is a NO-OP until AI_AGENT_WEBHOOK_URL is configured
    in the environment. When active, it sends a POST request with the
    audit events as JSON payload.

    To implement:
        1. Set AI_AGENT_WEBHOOK_URL in your .env
        2. Uncomment the requests.post() call below
        3. The agent receives events and runs anomaly detection
        4. Agent can call back to /api/audit/flag to mark suspicious events

    Example agent payload:
        {
            "source": "online_voting_system",
            "events": [
                {"log_id": 42, "event_type": "VOTE_CAST", ...},
                {"log_id": 43, "event_type": "VOTER_DEACTIVATED", ...}
            ]
        }
    """
    if not Config.AI_AGENT_WEBHOOK_URL:
        return  # Agent not configured — skip silently

    # ── Uncomment when agent is ready ──
    # import requests
    # try:
    #     response = requests.post(
    #         Config.AI_AGENT_WEBHOOK_URL,
    #         json={"source": "online_voting_system", "events": events},
    #         headers={"Authorization": f"Bearer {Config.AI_AGENT_API_KEY}"},
    #         timeout=5,
    #     )
    #     response.raise_for_status()
    #     logger.info(f"AI agent notified with {len(events)} events")
    # except requests.RequestException as e:
    #     # Non-blocking — audit logging must never fail because of agent
    #     logger.warning(f"Failed to notify AI agent: {e}")
    pass


@audit_bp.route("/logs", methods=["GET"])
def get_audit_logs():
    """
    Retrieve audit log entries with optional filters.

    Query Parameters:
        ?event_type=VOTE_CAST    — filter by event type (optional)
        ?limit=50                — max rows to return (default 100)
        ?offset=0                — pagination offset (default 0)
        ?since=2025-01-01        — events after this timestamp (optional)

    Response (200):
        {
            "success": true,
            "data": [
                {
                    "log_id": 1,
                    "event_type": "ELECTION_CREATED",
                    "actor_id": null,
                    "target_id": 1,
                    "details": "Punjab Assembly Election 2025",
                    "created_at": "2025-10-15T12:00:00"
                }
            ],
            "pagination": {"limit": 100, "offset": 0, "count": 5}
        }
    """
    event_type = request.args.get("event_type")
    limit = request.args.get("limit", 100, type=int)
    offset = request.args.get("offset", 0, type=int)
    since = request.args.get("since")

    # Clamp limit to prevent abuse
    limit = min(limit, 500)

    conditions = []
    params = []

    if event_type:
        conditions.append("event_type = %s")
        params.append(event_type)
    if since:
        conditions.append("created_at >= %s")
        params.append(since)

    sql = "SELECT * FROM Audit_Log"
    if conditions:
        sql += " WHERE " + " AND ".join(conditions)
    sql += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
    params.extend([limit, offset])

    rows = query_view(sql, tuple(params))

    # Convert datetime objects for JSON serialization
    for row in rows:
        for key, val in row.items():
            if hasattr(val, "isoformat"):
                row[key] = val.isoformat()

    # ── 🤖 AI AGENT HOOK — Forward events for analysis ──
    if rows:
        _notify_ai_agent(rows)

    return jsonify({
        "success": True,
        "data": rows,
        "pagination": {"limit": limit, "offset": offset, "count": len(rows)}
    }), 200


# ================================================================
#  🤖 AI AGENT HOOK — Analysis Endpoint (future)
# ================================================================
@audit_bp.route("/analyze", methods=["POST"])
def analyze_audit_logs():
    """
    AI Agent Analysis Endpoint (STUB)

    This endpoint is reserved for the AI agent to post its analysis
    results. When implemented, the agent will:
        1. Receive audit events (via webhook or polling)
        2. Run anomaly detection / pattern matching
        3. POST results here for the admin dashboard to display

    Request Body (future):
        {
            "analysis_type": "anomaly_detection",
            "findings": [
                {
                    "severity": "HIGH",
                    "description": "Unusual voting burst detected",
                    "affected_election_id": 1,
                    "evidence": {...}
                }
            ]
        }
    """
    # ── Implement when AI agent is ready ──
    # data = request.get_json()
    # Store findings in a new table or in-memory cache
    # Broadcast to connected admin dashboards via WebSocket

    return jsonify({
        "success": True,
        "message": "AI analysis endpoint is ready for integration. "
                   "See routes/audit.py for implementation guide."
    }), 200
