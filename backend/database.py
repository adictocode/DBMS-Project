"""
database.py — Database Connection Pool & Query Helpers
======================================================
Provides a managed connection pool and two high-level helpers:
    • call_procedure(name, args)  — for stored procedures (cast_vote, etc.)
    • query_view(query, params)   — for views (vw_live_tally, etc.)

Design Decisions:
    1. Uses mariadb.ConnectionPool for connection reuse (avoids the
       overhead of opening/closing connections per request).
    2. Context manager pattern ensures connections are always returned
       to the pool, even when exceptions occur.
    3. NEVER constructs raw SQL CRUD — all mutations go through the
       database's stored procedures, preserving the "hardened DB" contract.

Interview Note:
    Connection pooling is critical for web applications. Without it,
    each HTTP request opens a new TCP connection to MariaDB, which is
    expensive (~3ms per connect on localhost, much worse over network).
"""

from contextlib import contextmanager

import mariadb

from config import Config


# ================================================================
#  CONNECTION POOL (lazy initialization)
# ================================================================
# [FIX] Lazy init — the pool is created on first use, not at import
# time. This prevents the app from crashing if MariaDB is briefly
# unavailable during startup.

_pool = None


def _get_pool():
    """Lazily create and return the connection pool."""
    global _pool
    if _pool is None:
        _pool = mariadb.ConnectionPool(
            pool_name="voting_pool",
            pool_size=Config.DB_POOL_SIZE,
            pool_reset_connection=True,
            host=Config.DB_HOST,
            port=Config.DB_PORT,
            user=Config.DB_USER,
            password=Config.DB_PASSWORD,
            database=Config.DB_NAME,
        )
    return _pool


@contextmanager
def get_connection():
    """
    Context manager that borrows a connection from the pool and
    guarantees it is returned when the block exits.

    Usage:
        with get_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT * FROM vw_live_tally")
            rows = cursor.fetchall()
    """
    conn = _get_pool().get_connection()
    try:
        yield conn
    finally:
        conn.close()  # returns to pool, does NOT terminate the connection


def call_procedure(proc_name: str, args: tuple = (), fetch_last_id: bool = False):
    """
    Call a stored procedure by name with positional arguments.

    This is the ONLY way mutations happen in this application.
    Every stored procedure in the database is transactional and
    raises SIGNAL SQLSTATE '45000' on business-rule violations.

    Args:
        proc_name:     Name of the stored procedure (e.g., 'cast_vote').
        args:          Positional arguments to pass to the procedure.
        fetch_last_id: If True, also returns the LAST_INSERT_ID() from
                       the same connection/session. Needed for procedures
                       that INSERT with AUTO_INCREMENT (register_voter).

    Returns:
        If fetch_last_id=False: list of row dicts (or empty list).
        If fetch_last_id=True:  tuple of (list of row dicts, int last_id).

    Raises:
        mariadb.Error: Re-raised for the Flask error handler
        to translate into HTTP 400/500.
    """
    with get_connection() as conn:
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.callproc(proc_name, args)

            # Collect all rows from result sets.
            # Some stored procedures (e.g., register_voter) only do INSERT
            # and don't return any result set. MariaDB connector raises
            # ProgrammingError when fetchall() is called with no result set.
            results = []
            try:
                rows = cursor.fetchall()
                if rows:
                    results.extend(rows)

                # Iterate through any additional result sets
                while cursor.nextset():
                    rows = cursor.fetchall()
                    if rows:
                        results.extend(rows)
            except Exception:
                # No result set available — procedure was INSERT/UPDATE only
                pass

            conn.commit()

            # [FIX] Fetch the auto-generated ID on the SAME connection.
            # LAST_INSERT_ID() is session-scoped in MariaDB, so it persists
            # after COMMIT on the same connection.
            if fetch_last_id:
                id_cursor = conn.cursor(dictionary=True)
                id_cursor.execute("SELECT LAST_INSERT_ID() AS last_id")
                row = id_cursor.fetchone()
                id_cursor.close()
                return results, (row["last_id"] if row else None)

            return results
        finally:
            cursor.close()


def query_view(sql: str, params: tuple = ()) -> list[dict]:
    """
    Execute a SELECT query (typically against a view) and return
    the result set as a list of dictionaries.

    This function is READ-ONLY. It should only be used for:
        • SELECT * FROM vw_live_tally WHERE ...
        • SELECT * FROM vw_turnout WHERE ...
        • SELECT is_eligible(?) AS eligible
        • SELECT * FROM Elections WHERE ...

    Args:
        sql:    A parameterized SELECT query string.
        params: Tuple of parameters to bind (prevents SQL injection).

    Returns:
        List of row dictionaries.

    Raises:
        mariadb.Error: Re-raised for the Flask error handler.
    """
    with get_connection() as conn:
        cursor = conn.cursor(dictionary=True)
        try:
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            # [FIX] Close the implicit read transaction to prevent
            # stale data on pooled connections.
            conn.commit()
            return rows
        finally:
            cursor.close()
