"""
routes/votes.py — Vote Casting Endpoint
========================================
The most integrity-critical endpoint in the entire system.

Stored Procedure Used:
    • CALL cast_vote(voter_id, candidate_id, election_id)

The stored procedure + triggers enforce ALL of these rules atomically:
    1. Election must be Active
    2. Current time must be within [start_date, end_date]
    3. Voter must be active (is_active = TRUE)
    4. Voter must be >= 18 years old
    5. Voter's state must match election's state
    6. Voter's constituency must match candidate's contested constituency
    7. Voter hasn't already voted in this election (UNIQUE constraint)
    8. (candidate, election) pair must exist in Candidate_Contests

If any rule is violated, the database raises SIGNAL SQLSTATE '45000'
with a descriptive MESSAGE_TEXT, which our error handler (errors.py)
translates into an HTTP 400 response.
"""

from flask import Blueprint, request, jsonify
from database import call_procedure, query_view

votes_bp = Blueprint("votes", __name__, url_prefix="/api/votes")


@votes_bp.route("/cast", methods=["POST"])
def cast_vote():
    """
    Cast a vote — the atomic, tamper-proof core operation.

    Request Body (JSON):
        {
            "voter_id": 1,
            "candidate_id": 2,
            "election_id": 1
        }

    Success Response (201):
        {"success": true, "message": "Vote cast successfully"}

    Possible Error Responses (400) — all from MySQL SIGNAL:
        • "Election is not currently active"
        • "Vote submitted outside the allowed voting window"
        • "Voter is under 18 years of age"
        • "Voter account is inactive or suspended"
        • "Voter is not registered in the election state"
        • "Voter constituency does not match candidate constituency"
        • "Duplicate entry ... for key 'uq_one_vote'"  (double-vote)

    Interview Note:
        Notice how this entire endpoint is ~10 lines of Python.
        ALL business logic lives in the database (triggers + procedures).
        The backend is truly a "thin bridge" — it just translates between
        HTTP/JSON and MySQL procedure calls.
    """
    data = request.get_json()

    required = ["voter_id", "candidate_id", "election_id"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({
            "success": False,
            "error": f"Missing required fields: {', '.join(missing)}"
        }), 400

    # This single line delegates to the database's cast_vote procedure,
    # which wraps the INSERT in a transaction and triggers validate
    # every business rule listed in the docstring above.
    call_procedure("cast_vote", (
        data["voter_id"],
        data["candidate_id"],
        data["election_id"],
    ))

    return jsonify({
        "success": True,
        "message": "Vote cast successfully"
    }), 201


@votes_bp.route("/context", methods=["GET"])
def get_vote_context():
    """
    Get full voting context for a voter + election type combination.
    Replaces the old multi-step lookup (fetch voter → pick election → fetch candidates).

    Query Parameters:
        ?voter_id=1&election_type=State

    Returns voter info, matched election, and filtered candidate list.
    Validates: voter exists, is active, election is active, hasn't voted yet.
    """
    voter_id = request.args.get("voter_id", type=int)
    election_type = request.args.get("election_type", "").strip()

    if not voter_id:
        return jsonify({"success": False, "error": "voter_id is required"}), 400
    if not election_type:
        return jsonify({"success": False, "error": "election_type is required"}), 400

    # 1. Fetch voter + constituency + state
    voter_rows = query_view("""
        SELECT v.voter_id, v.name, v.is_active, v.constituency_id,
               c.constituency_name, c.state_id
        FROM Voters v
        JOIN Constituencies c ON v.constituency_id = c.constituency_id
        WHERE v.voter_id = ?
    """, (voter_id,))

    if not voter_rows:
        return jsonify({"success": False, "error": "Voter not found"}), 404

    voter = voter_rows[0]

    if not voter["is_active"]:
        return jsonify({"success": False, "error": "Voter account is inactive or suspended"}), 400

    # 2. Find active election matching type + voter's state
    election_rows = query_view("""
        SELECT election_id, election_name, election_type, status,
               start_date, end_date, state_id
        FROM Elections
        WHERE election_type = ? AND state_id = ? AND status = 'Active'
        ORDER BY start_date DESC
        LIMIT 1
    """, (election_type, voter["state_id"]))

    if not election_rows:
        return jsonify({
            "success": False,
            "error": f"No active {election_type} election found for your state"
        }), 404

    election = election_rows[0]
    election_id = election["election_id"]

    # Convert datetimes for JSON
    for key, val in election.items():
        if hasattr(val, "isoformat"):
            election[key] = val.isoformat()

    # 3. Check if voter has already voted in this election
    voted_rows = query_view(
        "SELECT has_voted(?, ?) AS voted",
        (voter_id, election_id)
    )
    if voted_rows and voted_rows[0]["voted"]:
        return jsonify({
            "success": False,
            "error": "You have already voted in this election"
        }), 400

    # 4. Fetch candidates for voter's constituency in this election (non-revoked only)
    candidates = query_view("""
        SELECT
            cc.candidate_id,
            cd.name           AS candidate_name,
            p.party_name,
            p.symbol,
            c.constituency_id,
            c.constituency_name
        FROM Candidate_Contests cc
        JOIN Candidates     cd ON cc.candidate_id    = cd.candidate_id
        JOIN Parties         p ON cd.party_id        = p.party_id
        JOIN Constituencies  c ON cc.constituency_id = c.constituency_id
        WHERE cc.election_id = ?
          AND cc.constituency_id = ?
          AND cd.is_active = TRUE
        ORDER BY cd.name
    """, (election_id, voter["constituency_id"]))

    return jsonify({
        "success": True,
        "data": {
            "voter": {
                "voter_id": voter["voter_id"],
                "name": voter["name"],
                "constituency_id": voter["constituency_id"],
                "constituency_name": voter["constituency_name"],
            },
            "election": election,
            "candidates": candidates,
        }
    }), 200


@votes_bp.route("/candidates", methods=["GET"])
def get_candidates_for_election():
    """
    Get candidates contesting in an election, optionally filtered
    by constituency. Used by the frontend to populate the ballot.

    Query Parameters:
        ?election_id=1          — required
        ?constituency_id=1      — optional (filter by constituency)

    Response (200):
        {
            "success": true,
            "data": [
                {
                    "candidate_id": 1,
                    "candidate_name": "Rajiv Sharma",
                    "party_name": "Progressive Party",
                    "symbol": "Lotus",
                    "constituency_name": "Ludhiana East"
                }
            ]
        }
    """
    election_id = request.args.get("election_id", type=int)
    if not election_id:
        return jsonify({
            "success": False,
            "error": "election_id query parameter is required"
        }), 400

    constituency_id = request.args.get("constituency_id", type=int)

    # Read-only query joining Candidate_Contests with Candidates,
    # Parties, and Constituencies for the frontend ballot display.
    sql = """
        SELECT
            cc.candidate_id,
            cd.name           AS candidate_name,
            p.party_name,
            p.symbol,
            c.constituency_id,
            c.constituency_name
        FROM Candidate_Contests cc
        JOIN Candidates     cd ON cc.candidate_id    = cd.candidate_id
        JOIN Parties         p ON cd.party_id        = p.party_id
        JOIN Constituencies  c ON cc.constituency_id = c.constituency_id
        WHERE cc.election_id = ? AND cd.is_active = TRUE
    """
    params = [election_id]

    if constituency_id:
        sql += " AND cc.constituency_id = ?"
        params.append(constituency_id)

    sql += " ORDER BY c.constituency_name, cd.name"

    rows = query_view(sql, tuple(params))

    return jsonify({"success": True, "data": rows}), 200


@votes_bp.route("/has-voted", methods=["GET"])
def check_has_voted():
    """
    Check if a voter has already voted in an election.
    Uses the has_voted() database function.

    Query Parameters:
        ?voter_id=1&election_id=1

    Response (200):
        {"voter_id": 1, "election_id": 1, "has_voted": false}
    """
    voter_id = request.args.get("voter_id", type=int)
    election_id = request.args.get("election_id", type=int)

    if not voter_id or not election_id:
        return jsonify({
            "success": False,
            "error": "Both voter_id and election_id are required"
        }), 400

    rows = query_view(
        "SELECT has_voted(?, ?) AS voted",
        (voter_id, election_id)
    )

    voted = bool(rows[0]["voted"]) if rows else False

    return jsonify({
        "voter_id": voter_id,
        "election_id": election_id,
        "has_voted": voted
    }), 200
