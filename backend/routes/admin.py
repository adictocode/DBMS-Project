"""
routes/admin.py — Admin Panel Endpoints
=======================================
Handles admin authentication and privileged operations.

Endpoints:
    • POST /api/admin/login — validates @admin.com email
    • GET  /api/admin/stats — aggregated dashboard stats
"""

from flask import Blueprint, request, jsonify
from database import query_view, call_procedure

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

@admin_bp.route("/login", methods=["POST"])
def admin_login():
    """
    Validates an admin login request.
    Enforces the @admin.com domain validation both in Python and via DB triggers.

    Request Body:
        { "email": "super@admin.com", "password": "admin123" }
    """
    data = request.get_json()
    email = data.get("email", "").strip()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"success": False, "error": "Email and password are required"}), 400

    if not email.endswith("@admin.com"):
        return jsonify({"success": False, "error": "Invalid admin domain. Must be @admin.com"}), 403

    # Query the database
    # In a production app, we would verify a bcrypt hash here.
    # For this system, we use the plaintext/hashed value as-is for demo purposes.
    rows = query_view("SELECT admin_id, name, role FROM Admins WHERE email = %s AND password_hash = %s", (email, password))

    if not rows:
        return jsonify({"success": False, "error": "Invalid email or password"}), 401

    admin_user = rows[0]

    return jsonify({
        "success": True,
        "admin": {
            "id": admin_user["admin_id"],
            "name": admin_user["name"],
            "email": email,
            "role": admin_user["role"]
        }
    }), 200

@admin_bp.route("/stats", methods=["GET"])
def get_admin_stats():
    """
    Fetch high-level aggregate statistics for the Admin Dashboard.
    """
    voters_row = query_view("SELECT COUNT(*) as c FROM Voters")
    elections_row = query_view("SELECT COUNT(*) as c FROM Elections")
    votes_row = query_view("SELECT COUNT(*) as c FROM Votes")
    
    return jsonify({
        "success": True,
        "stats": {
            "total_voters": voters_row[0]["c"] if voters_row else 0,
            "total_elections": elections_row[0]["c"] if elections_row else 0,
            "total_votes": votes_row[0]["c"] if votes_row else 0
        }
    }), 200
