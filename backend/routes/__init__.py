"""
routes/__init__.py — Blueprint Registry
========================================
Central registration point for all Flask Blueprints.
Each domain (voters, elections, votes, results, audit) is a
separate Blueprint in its own file for clean separation of concerns.

To add a new domain:
    1. Create routes/new_domain.py with a Blueprint
    2. Import and append it to ALL_BLUEPRINTS below
    3. It's automatically registered in app.py — zero config needed
"""

from routes.voters import voters_bp
from routes.elections import elections_bp
from routes.votes import votes_bp
from routes.results import results_bp
from routes.audit import audit_bp
from routes.admin import admin_bp

# All blueprints are registered in app.py by iterating this list.
# Order does not matter — Flask routes are matched by URL, not registration order.
ALL_BLUEPRINTS = [
    voters_bp,
    elections_bp,
    votes_bp,
    results_bp,
    audit_bp,
    admin_bp,
]
