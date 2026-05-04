"""
errors.py — MariaDB SIGNAL Error → HTTP Response Translator
==========================================================
The hardened database raises SIGNAL SQLSTATE '45000' with descriptive
MESSAGE_TEXT for every business-rule violation (underage voter, double
vote, inactive account, cross-state mismatch, etc.).

This module catches those errors and translates them into clean HTTP
responses that the React frontend can display to the user.

Error Flow:
    1. Flask route calls database.call_procedure('cast_vote', ...)
    2. MariaDB trigger detects violation → SIGNAL SQLSTATE '45000'
       SET MESSAGE_TEXT = 'Voter is under 18 years of age'
    3. mariadb.Error is raised with .sqlstate = '45000'
       and .msg containing the MESSAGE_TEXT
    4. This error handler catches it → returns HTTP 400 JSON:
       {"success": false, "error": "Voter is under 18 years of age"}
    5. React frontend reads response.error and shows an ErrorToast

Interview Note:
    This pattern is called "error boundary delegation" — the database
    owns the business rules, the backend just translates the error
    format, and the frontend renders it. Clean separation of concerns.
"""

import mysql.connector
from flask import jsonify


def register_error_handlers(app):
    """
    Register global error handlers on the Flask app instance.
    Called once during app initialization in app.py.
    """

    @app.errorhandler(mysql.connector.Error)
    def handle_mariadb_error(error):
        """
        Translate MariaDB errors into HTTP responses.

        SQLSTATE '45000' → HTTP 400 (client/business-rule error)
        All other MariaDB errors → HTTP 500 (server/infrastructure error)
        """
        # SQLSTATE '45000' is the custom error state used by all our
        # triggers and stored procedures for business-rule violations.
        if error.sqlstate == "45000":
            # The .msg attribute contains the MESSAGE_TEXT from SIGNAL.
            # mariadb connector sometimes prefixes with the error number
            message = error.msg
            if message and ": " in message:
                message = message.split(": ", 1)[-1]

            app.logger.warning(f"Business rule violation: {message}")
            return jsonify({
                "success": False,
                "error": message
            }), 400

        # [FIX] SQLSTATE '23000' = integrity constraint violation
        # (duplicate key, FK not found, etc.). These are CLIENT errors,
        # not server errors — return 409 Conflict with a helpful message.
        if error.sqlstate == "23000":
            message = error.msg or ""
            if "Duplicate entry" in message:
                # Extract: "Duplicate entry 'x@y.com' for key 'email'"
                try:
                    field = message.split("for key '")[-1].rstrip("'\")")
                    value = message.split("Duplicate entry '")[1].split("'")[0]
                    message = f"A record with this {field} ('{value}') already exists"
                except (IndexError, ValueError):
                    message = "A record with these details already exists"
            else:
                message = "Data integrity constraint violated"

            app.logger.warning(f"Integrity violation: {message}")
            return jsonify({
                "success": False,
                "error": message
            }), 409

        # For non-business errors (connection failures, syntax errors, etc.),
        # log the full error but return a generic message to avoid leaking
        # database internals (table names, column names, etc.).
        app.logger.error(f"Database error: {error}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "An internal database error occurred. Please try again later."
        }), 500

    @app.errorhandler(404)
    def handle_not_found(error):
        """Return JSON for missing API routes instead of HTML."""
        return jsonify({
            "success": False,
            "error": "The requested endpoint does not exist."
        }), 404

    @app.errorhandler(405)
    def handle_method_not_allowed(error):
        """Return JSON for wrong HTTP methods."""
        return jsonify({
            "success": False,
            "error": "HTTP method not allowed for this endpoint."
        }), 405

    @app.errorhandler(500)
    def handle_internal_error(error):
        """Catch-all for unhandled exceptions."""
        app.logger.error(f"Unhandled error: {error}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "An unexpected server error occurred."
        }), 500
