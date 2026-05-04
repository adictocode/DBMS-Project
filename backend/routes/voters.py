"""
routes/voters.py — Voter Management Endpoints
==============================================
All voter operations delegate to the database's stored procedures
and functions. No raw INSERT/UPDATE/DELETE SQL is written here.

Stored Procedures Used:
    • CALL register_voter(name, dob, gender, email, phone, constituency_id)
    • CALL deactivate_voter(voter_id, reason)

Functions Used:
    • SELECT is_eligible(voter_id)

Views Used:
    • vw_pending_voters — voters who haven't voted in active elections

Design Note (Address-Based Constituency Assignment):
    In a real voting system (like India's ECI), a voter's constituency
    is determined by their residential address — they NEVER choose it.
    Our system parses the voter's address to auto-detect their state
    and constituency using keyword matching against the database.
"""

from flask import Blueprint, request, jsonify
from database import call_procedure, query_view

voters_bp = Blueprint("voters", __name__, url_prefix="/api/voters")


def _resolve_constituency_from_address(address: str) -> dict | None:
    """
    Parse a voter's address to determine their state and constituency.

    Strategy (keyword matching against the database):
        1. Fetch all states → find which state name appears in the address
        2. Fetch constituencies in that state → find which one matches
        3. If no constituency matches, default to the first in the state

    In a production system, this would use a geocoding API (Google Maps,
    India Post PIN code database, etc.) for precise mapping.

    Args:
        address: Free-text residential address string.

    Returns:
        dict with {state_id, state_name, constituency_id, constituency_name}
        or None if no state could be matched.
    """
    addr_lower = address.lower().strip()

    # Step 1: Match state name in the address
    states = query_view("SELECT state_id, state_name FROM States")
    matched_state = None
    for state in states:
        if state["state_name"].lower() in addr_lower:
            matched_state = state
            break

    if not matched_state:
        return None

    # Step 2: Get all constituencies in the matched state
    constituencies = query_view(
        "SELECT constituency_id, constituency_name FROM Constituencies "
        "WHERE state_id = %s ORDER BY constituency_id",
        (matched_state["state_id"],)
    )

    if not constituencies:
        return None

    # Step 3: Try to match a specific constituency name in the address
    matched_const = None
    for const in constituencies:
        # Check if constituency name (e.g., "Ludhiana East") appears in address
        if const["constituency_name"].lower() in addr_lower:
            matched_const = const
            break

    # If no specific constituency matched, try partial match (city name)
    if not matched_const:
        for const in constituencies:
            # Extract city portion (e.g., "Ludhiana" from "Ludhiana East")
            city = const["constituency_name"].split()[0].lower()
            if city in addr_lower:
                matched_const = const
                break

    # Fallback: assign first constituency in the state
    if not matched_const:
        matched_const = constituencies[0]

    return {
        "state_id": matched_state["state_id"],
        "state_name": matched_state["state_name"],
        "constituency_id": matched_const["constituency_id"],
        "constituency_name": matched_const["constituency_name"],
    }


@voters_bp.route("/register", methods=["POST"])
def register_voter():
    """
    Register a new voter via the register_voter stored procedure.

    The user provides their residential address — the system auto-detects
    their state and constituency from it. The voter CANNOT choose their
    own constituency (mirrors real electoral commission rules).

    Request Body (JSON):
        {
            "name": "Harpreet Singh",
            "date_of_birth": "1990-03-14",
            "gender": "Male",
            "email": "h.singh@example.com",
            "phone": "9876543210",
            "address": "42, Model Town, Ludhiana, Punjab 141002"
        }

    Success Response (201):
        {
            "success": true,
            "message": "Voter registered successfully",
            "voter_id": 5,
            "state": "Punjab",
            "constituency": "Ludhiana East"
        }

    Error Response (400) — from MySQL SIGNAL:
        {"success": false, "error": "Voter must be at least 18 years old"}
    """
    data = request.get_json()

    # Validate required fields before hitting the database
    required = ["name", "date_of_birth", "address"]
    missing = [f for f in required if f not in data or not data[f]]
    if missing:
        return jsonify({
            "success": False,
            "error": f"Missing required fields: {', '.join(missing)}"
        }), 400

    # ── Address → State + Constituency resolution ────────────────
    # Parse the address to auto-detect the voter's region.
    # The voter does NOT choose their constituency manually.
    resolved = _resolve_constituency_from_address(data["address"])

    if not resolved:
        return jsonify({
            "success": False,
            "error": "Could not determine your state from the address provided. "
                     "Please include your state name (e.g., 'Punjab') in your address."
        }), 400

    # Delegate to stored procedure — it handles:
    #   • Age validation (>= 18)
    #   • DOB trigger validation (must be in past)
    #   • Duplicate email/phone checks (UNIQUE constraint)
    #   • Audit log entry creation
    #   • Full transaction with rollback on failure
    #
    result = call_procedure("register_voter", (
        data["name"],
        data["date_of_birth"],
        data.get("gender") or None,         # Convert "" to NULL for ENUM
        data.get("email") or None,          # Convert "" to NULL for UNIQUE
        data.get("phone") or None,          # Convert "" to NULL for UNIQUE
        resolved["constituency_id"],        # auto-resolved from address
    ), fetch_last_id=False)
    
    voter_id = result[0]["voter_id"]

    return jsonify({
        "success": True,
        "message": "Voter registered successfully",
        "voter_id": voter_id,
        "state": resolved["state_name"],
        "constituency": resolved["constituency_name"],
    }), 201


@voters_bp.route("/<int:voter_id>/eligibility", methods=["GET"])
def check_eligibility(voter_id):
    """
    Check if a voter is eligible to vote using the is_eligible() function.

    The database function checks:
        • Voter exists
        • is_active = TRUE
        • Age >= 18

    Response (200):
        {"voter_id": 1, "eligible": true}
    """
    rows = query_view(
        "SELECT is_eligible(%s) AS eligible",
        (voter_id,)
    )

    eligible = bool(rows[0]["eligible"]) if rows else False

    return jsonify({
        "voter_id": voter_id,
        "eligible": eligible
    }), 200


@voters_bp.route("/<int:voter_id>/deactivate", methods=["POST"])
def deactivate_voter(voter_id):
    """
    Soft-delete (suspend) a voter via deactivate_voter stored procedure.

    Request Body (JSON):
        {"reason": "Duplicate registration"}  // optional

    The procedure:
        • Sets is_active = FALSE
        • Creates an audit log entry
        • Raises SIGNAL if voter not found
    """
    data = request.get_json() or {}
    reason = data.get("reason", "No reason provided")

    call_procedure("deactivate_voter", (voter_id, reason))

    return jsonify({
        "success": True,
        "message": f"Voter {voter_id} has been deactivated"
    }), 200


@voters_bp.route("/<int:voter_id>", methods=["GET"])
def get_voter(voter_id):
    """
    Get voter details by ID.
    Used by the frontend to fetch constituency details for dynamic voting.
    """
    rows = query_view("""
        SELECT v.voter_id, v.name, v.is_active, v.constituency_id, c.constituency_name
        FROM Voters v
        JOIN Constituencies c ON v.constituency_id = c.constituency_id
        WHERE v.voter_id = %s
    """, (voter_id,))
    
    if not rows:
        return jsonify({"success": False, "error": "Voter not found"}), 404
        
    return jsonify({"success": True, "data": rows[0]}), 200


@voters_bp.route("/pending", methods=["GET"])
def get_pending_voters():
    """
    Get voters who haven't voted in any active election.
    Reads from the vw_pending_voters view.

    Query Parameters:
        ?election_id=1  — filter by specific election (optional)
    """
    election_id = request.args.get("election_id", type=int)

    if election_id:
        rows = query_view(
            "SELECT * FROM vw_pending_voters WHERE election_id = %s",
            (election_id,)
        )
    else:
        rows = query_view("SELECT * FROM vw_pending_voters")

    return jsonify({"success": True, "data": rows}), 200
