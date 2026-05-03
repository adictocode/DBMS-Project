"""
routes/results.py — Election Results & Analytics Endpoints
==========================================================
Views Used: vw_live_tally, vw_turnout, vw_party_performance
Procedures Used: get_winner, get_election_results
"""

from flask import Blueprint, request, jsonify
from database import call_procedure, query_view

results_bp = Blueprint("results", __name__, url_prefix="/api/results")


@results_bp.route("/tally", methods=["GET"])
def live_tally():
    """Live vote tally from vw_live_tally. Optional ?election_id filter."""
    election_id = request.args.get("election_id", type=int)
    if election_id:
        rows = query_view(
            "SELECT * FROM vw_live_tally WHERE election_id = ? ORDER BY constituency_name, total_votes DESC",
            (election_id,)
        )
    else:
        rows = query_view("SELECT * FROM vw_live_tally ORDER BY election_id, constituency_name, total_votes DESC")
    return jsonify({"success": True, "data": rows}), 200


@results_bp.route("/turnout", methods=["GET"])
def turnout():
    """Voter turnout from vw_turnout. Optional ?election_id filter."""
    election_id = request.args.get("election_id", type=int)
    if election_id:
        rows = query_view("SELECT * FROM vw_turnout WHERE election_id = ?", (election_id,))
    else:
        rows = query_view("SELECT * FROM vw_turnout")
    for row in rows:
        if row.get("turnout_pct") is not None:
            row["turnout_pct"] = float(row["turnout_pct"])
    return jsonify({"success": True, "data": rows}), 200


@results_bp.route("/performance", methods=["GET"])
def party_performance():
    """Seats won per party from vw_party_performance. Optional ?election_id filter."""
    election_id = request.args.get("election_id", type=int)
    if election_id:
        rows = query_view("SELECT * FROM vw_party_performance WHERE election_id = ?", (election_id,))
    else:
        rows = query_view("SELECT * FROM vw_party_performance")
    return jsonify({"success": True, "data": rows}), 200


@results_bp.route("/winner/<int:election_id>/<int:constituency_id>", methods=["GET"])
def get_winner(election_id, constituency_id):
    """Get winner(s) via CALL get_winner — tie-safe (uses RANK)."""
    rows = call_procedure("get_winner", (constituency_id, election_id))
    return jsonify({"success": True, "data": rows}), 200


@results_bp.route("/election/<int:election_id>", methods=["GET"])
def election_results(election_id):
    """Full election results via CALL get_election_results."""
    rows = call_procedure("get_election_results", (election_id,))
    return jsonify({"success": True, "data": rows}), 200
