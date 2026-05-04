"""
routes/elections.py — Election Management Endpoints
====================================================
Handles the full election lifecycle:
    Upcoming → Active → Completed
                     ↘ Cancelled

Stored Procedures Used:
    • CALL create_election(name, type, start, end, state_id)
    • CALL activate_election(election_id)
    • CALL close_election(election_id)
    • CALL cancel_election(election_id, reason)
"""

from flask import Blueprint, request, jsonify
from database import call_procedure, query_view

elections_bp = Blueprint("elections", __name__, url_prefix="/api/elections")


@elections_bp.route("", methods=["GET"])
def list_elections():
    """
    List all elections with optional status filter.

    Query Parameters:
        ?status=Active          — filter by status (optional)
        ?state_id=1             — filter by state (optional)

    Response (200):
        {
            "success": true,
            "data": [
                {
                    "election_id": 1,
                    "election_name": "Punjab Assembly Election 2025",
                    "election_type": "State",
                    "start_date": "2025-11-01T08:00:00",
                    "end_date": "2025-11-01T18:00:00",
                    "state_id": 1,
                    "status": "Completed",
                    "created_at": "2025-10-15T12:00:00"
                }
            ]
        }
    """
    status = request.args.get("status")
    state_id = request.args.get("state_id", type=int)

    # Build a simple parameterized query — this is a READ, not a mutation,
    # so we use query_view. We're querying the Elections table directly
    # because there's no view for the election list (views are for
    # computed/aggregated data).
    conditions = []
    params = []

    if status:
        conditions.append("status = %s")
        params.append(status)
    if state_id:
        conditions.append("state_id = %s")
        params.append(state_id)

    sql = "SELECT * FROM Elections"
    if conditions:
        sql += " WHERE " + " AND ".join(conditions)
    sql += " ORDER BY created_at DESC"

    rows = query_view(sql, tuple(params))

    # Convert datetime objects to ISO strings for JSON serialization
    for row in rows:
        for key, val in row.items():
            if hasattr(val, "isoformat"):
                row[key] = val.isoformat()

    return jsonify({"success": True, "data": rows}), 200


@elections_bp.route("/create", methods=["POST"])
def create_election():
    """
    Create a new election via the create_election stored procedure.

    Request Body (JSON):
        {
            "election_name": "Maharashtra State Election 2026",
            "election_type": "State",        // General | State | By-election
            "start_date": "2026-06-01 08:00:00",
            "end_date": "2026-06-01 18:00:00",
            "state_id": 2
        }

    The procedure validates:
        • end_date > start_date
        • start_date is in the future
        • state_id references a valid state
    """
    data = request.get_json()

    required = ["election_name", "election_type", "start_date", "end_date", "state_id"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({
            "success": False,
            "error": f"Missing required fields: {', '.join(missing)}"
        }), 400

    call_procedure("create_election", (
        data["election_name"],
        data["election_type"],
        data["start_date"],
        data["end_date"],
        data["state_id"],
    ))

    return jsonify({
        "success": True,
        "message": "Election created successfully"
    }), 201


@elections_bp.route("/<int:election_id>/activate", methods=["POST"])
def activate_election(election_id):
    """
    Transition an election from Upcoming → Active.
    Raises SIGNAL if election is not in 'Upcoming' status.
    """
    call_procedure("activate_election", (election_id,))

    return jsonify({
        "success": True,
        "message": f"Election {election_id} is now Active"
    }), 200


@elections_bp.route("/<int:election_id>/close", methods=["POST"])
def close_election(election_id):
    """
    Transition an election from Active → Completed.
    Raises SIGNAL if election is not in 'Active' status.
    """
    call_procedure("close_election", (election_id,))

    return jsonify({
        "success": True,
        "message": f"Election {election_id} is now Completed"
    }), 200


@elections_bp.route("/<int:election_id>/cancel", methods=["POST"])
def cancel_election(election_id):
    """
    Cancel an election (Upcoming or Active → Cancelled).
    Preserves existing votes but prevents new ones.

    Request Body (JSON):
        {"reason": "Security concerns"}  // optional
    """
    data = request.get_json() or {}
    reason = data.get("reason", "No reason provided")

    call_procedure("cancel_election", (election_id, reason))

    return jsonify({
        "success": True,
        "message": f"Election {election_id} has been cancelled"
    }), 200

@elections_bp.route("/<int:election_id>/summary", methods=["GET"])
def get_election_summary(election_id):
    """
    Get election summary: total votes, turnout percentage, and votes per candidate.
    """
    # Exclude revoked candidates
    candidates_tally = query_view("""
        SELECT cd.candidate_id, cd.name, p.party_name, COUNT(v.vote_id) AS votes
        FROM Candidate_Contests cc
        JOIN Candidates cd ON cc.candidate_id = cd.candidate_id
        JOIN Parties p ON cd.party_id = p.party_id
        LEFT JOIN Votes v ON v.candidate_id = cc.candidate_id AND v.election_id = cc.election_id
        WHERE cc.election_id = %s AND cd.is_active = TRUE
        GROUP BY cd.candidate_id, cd.name, p.party_name
        ORDER BY votes DESC
    """, (election_id,))
    
    total_votes_row = query_view("SELECT total_votes_cast(%s) AS total", (election_id,))
    total_votes = total_votes_row[0]["total"] if total_votes_row else 0
    
    # Calculate turnout: get total registered voters in this election's constituencies
    turnout_row = query_view("""
        SELECT COUNT(DISTINCT vr.voter_id) AS total_registered
        FROM Election_Constituencies ec
        JOIN Voters vr ON ec.constituency_id = vr.constituency_id AND vr.is_active = TRUE
        WHERE ec.election_id = %s
    """, (election_id,))
    total_registered = turnout_row[0]["total_registered"] if turnout_row else 0
    
    turnout_percentage = 0
    if total_registered > 0:
        turnout_percentage = round((total_votes / total_registered) * 100, 2)
        
    return jsonify({
        "success": True,
        "data": {
            "total_votes": total_votes,
            "turnout_percentage": turnout_percentage,
            "candidates": candidates_tally
        }
    }), 200

@elections_bp.route("/candidates/<int:candidate_id>/revoke", methods=["POST"])
def revoke_candidate(candidate_id):
    """
    Soft delete a candidate by setting is_active = FALSE.
    """
    data = request.get_json() or {}
    reason = data.get("reason", "No reason provided")
    
    from database import get_connection
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE Candidates SET is_active = FALSE WHERE candidate_id = %s", (candidate_id,))
        if cursor.rowcount == 0:
            return jsonify({"success": False, "error": "Candidate not found"}), 404
            
        # Log to Audit_Log
        cursor.execute("""
            INSERT INTO Audit_Log (event_type, target_id, details)
            VALUES (%s, %s, %s)
        """, ('CANDIDATE_REVOKED', candidate_id, f"reason={reason}"))
        conn.commit()
        
    return jsonify({"success": True, "message": f"Candidate {candidate_id} revoked successfully"}), 200

@elections_bp.route("/<int:election_id>/restart", methods=["POST"])
def restart_election(election_id):
    """
    Restart an election: snapshot current results → delete votes → set Active.
    Allowed for Completed or Cancelled elections. Idempotent (safe on repeated calls).
    Preserves previous results in Election_History before reset.
    """
    import json
    from database import get_connection
    with get_connection() as conn:
        cursor = conn.cursor(dictionary=True)
        # Check current status
        cursor.execute("SELECT status FROM Elections WHERE election_id = %s", (election_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"success": False, "error": "Election not found"}), 404
        if row["status"] not in ("Completed", "Cancelled"):
            return jsonify({"success": False, "error": "Only Completed or Cancelled elections can be restarted"}), 400

        # --- Snapshot current results before reset ---
        cursor.execute("""
            SELECT cd.candidate_id, cd.name, p.party_name, COUNT(v.vote_id) AS votes
            FROM Candidate_Contests cc
            JOIN Candidates cd ON cc.candidate_id = cd.candidate_id
            JOIN Parties p ON cd.party_id = p.party_id
            LEFT JOIN Votes v ON v.candidate_id = cc.candidate_id AND v.election_id = cc.election_id
            WHERE cc.election_id = %s AND cd.is_active = TRUE
            GROUP BY cd.candidate_id, cd.name, p.party_name
            ORDER BY votes DESC
        """, (election_id,))
        candidates_tally = cursor.fetchall()

        cursor.execute("SELECT COUNT(*) AS total FROM Votes WHERE election_id = %s", (election_id,))
        total_row = cursor.fetchone()
        total_votes = total_row["total"] if total_row else 0

        # Only save snapshot if there were actual votes (avoid empty history entries)
        if total_votes > 0:
            snapshot = {
                "total_votes": total_votes,
                "candidates": candidates_tally,
                "previous_status": row["status"],
            }
            cursor.execute("""
                INSERT INTO Election_History (election_id, results_json)
                VALUES (%s, %s)
            """, (election_id, json.dumps(snapshot, default=str)))

        # --- Perform restart atomically ---
        cursor.execute("DELETE FROM Votes WHERE election_id = %s", (election_id,))
        cursor.execute("UPDATE Elections SET status = 'Active' WHERE election_id = %s", (election_id,))

        cursor.execute("""
            INSERT INTO Audit_Log (event_type, target_id, details)
            VALUES (%s, %s, %s)
        """, ('ELECTION_RESTARTED', election_id,
              f"Election restarted, {total_votes} votes archived to history"))

        conn.commit()

    return jsonify({"success": True, "message": f"Election {election_id} has been restarted"}), 200


@elections_bp.route("/<int:election_id>/history", methods=["GET"])
def get_election_history(election_id):
    """
    Get all historical result snapshots for an election (from Election_History).
    Each entry represents the results saved before a restart.
    """
    rows = query_view("""
        SELECT history_id, election_id, snapshot_at, results_json
        FROM Election_History
        WHERE election_id = %s
        ORDER BY snapshot_at DESC
    """, (election_id,))

    import json
    for row in rows:
        # Parse the JSON string into a dict for the frontend
        if isinstance(row["results_json"], str):
            row["results_json"] = json.loads(row["results_json"])
        if hasattr(row.get("snapshot_at"), "isoformat"):
            row["snapshot_at"] = row["snapshot_at"].isoformat()

    return jsonify({"success": True, "data": rows}), 200


@elections_bp.route("/states", methods=["GET"])
def list_states():
    """
    List all states — needed by the frontend for dropdowns.
    """
    rows = query_view("SELECT * FROM States ORDER BY state_name")
    return jsonify({"success": True, "data": rows}), 200


@elections_bp.route("/constituencies", methods=["GET"])
def list_constituencies():
    """
    List constituencies, optionally filtered by state.

    Query Parameters:
        ?state_id=1  — filter by state (optional)
    """
    state_id = request.args.get("state_id", type=int)

    if state_id:
        rows = query_view(
            "SELECT * FROM Constituencies WHERE state_id = %s ORDER BY constituency_name",
            (state_id,)
        )
    else:
        rows = query_view("SELECT * FROM Constituencies ORDER BY constituency_name")

    return jsonify({"success": True, "data": rows}), 200
