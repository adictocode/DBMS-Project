/**
 * AuditLog.jsx — Audit Trail Viewer + AI Agent Hook
 * ====================================================
 * Displays the tamper-evident Audit_Log table with filtering
 * and pagination. Contains the primary frontend integration
 * point for a future AI security monitoring agent.
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │  AI AGENT HOOK — Frontend Dashboard                          │
 * │                                                              │
 * │  This page is designed to display AI agent analysis:         │
 * │    1. Anomaly alerts as banner cards at the top              │
 * │    2. Risk scores per audit event (new column)               │
 * │    3. Real-time WebSocket updates for live monitoring        │
 * │                                                              │
 * │  To integrate:                                               │
 * │    • Import streamAgentAlerts from api/client.js             │
 * │    • Add a useEffect that subscribes to the WebSocket        │
 * │    • Render alert cards in the "agent-alerts" div below      │
 * └──────────────────────────────────────────────────────────────┘
 */

import { useState, useEffect } from "react";
import { getAuditLogs, ApiError } from "../api/client";
import ErrorToast from "../components/ErrorToast";
import { Vote, UserPlus, UserMinus, Building2, PlayCircle, XOctagon, XCircle, FileText } from "lucide-react";
import "./AuditLog.css";

// Event type → icon component mapping
const EVENT_ICONS = {
  VOTE_CAST: <Vote size={18} className="audit-icon-vote" />,
  VOTER_REGISTERED: <UserPlus size={18} className="audit-icon-register" />,
  VOTER_DEACTIVATED: <UserMinus size={18} className="audit-icon-deactivate" />,
  ELECTION_CREATED: <Building2 size={18} className="audit-icon-create" />,
  ELECTION_ACTIVATED: <PlayCircle size={18} className="audit-icon-activate" />,
  ELECTION_CLOSED: <XOctagon size={18} className="audit-icon-close" />,
  ELECTION_CANCELLED: <XCircle size={18} className="audit-icon-cancel" />,
};

function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const LIMIT = 50;

  useEffect(() => {
    fetchLogs();
  }, [filter, page]);

  async function fetchLogs() {
    setLoading(true);
    try {
      const params = { limit: LIMIT, offset: page * LIMIT };
      if (filter) params.event_type = filter;
      const res = await getAuditLogs(params);
      setLogs(res.data || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load audit logs");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  const eventTypes = [
    "VOTE_CAST",
    "VOTER_REGISTERED",
    "VOTER_DEACTIVATED",
    "ELECTION_CREATED",
    "ELECTION_ACTIVATED",
    "ELECTION_CLOSED",
    "ELECTION_CANCELLED",
  ];

  return (
    <div className="page" id="audit-page">
      <div className="page-header">
        <h1 className="page-title">Audit Log</h1>
        <p className="page-subtitle">
          Tamper-evident audit trail — UPDATE and DELETE are blocked by database
          triggers.
        </p>
      </div>

      {/* ── AI Agent Alerts Area (future) ────────────────────── */}
      <div id="agent-alerts" className="agent-alerts-container">
        {/*
          When the AI agent is integrated, render alert cards here:

          {agentAlerts.map(alert => (
            <div className="glass-card agent-alert" key={alert.id}>
              <span className="agent-alert-severity">{alert.severity}</span>
              <span>{alert.description}</span>
            </div>
          ))}
        */}
      </div>

      {/* Filter Bar */}
      <div className="audit-filters glass-card">
        <div className="audit-filter-row">
          <select
            className="form-select audit-filter-select"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
            id="audit-event-filter"
          >
            <option value="">All Event Types</option>
            {eventTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <button
            className="btn btn-ghost"
            onClick={fetchLogs}
            id="audit-refresh-btn"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="glass-card audit-table-container">
        {loading ? (
          <div style={{ padding: "40px" }}>
            <div className="skeleton" style={{ height: "300px" }} />
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FileText size={32} color="#94a3b8" /></div>
            <p className="empty-state-text">No audit logs found</p>
          </div>
        ) : (
          <table className="data-table" id="audit-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Event</th>
                <th>Actor</th>
                <th>Target</th>
                <th>Details</th>
                <th>Timestamp</th>
                {/* AI AGENT HOOK: Add "Risk Score" column here */}
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.log_id}>
                  <td style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>
                    #{log.log_id}
                  </td>
                  <td>
                    <span className="audit-event-badge">
                      <span className="audit-icon-wrapper">
                        {EVENT_ICONS[log.event_type] || <FileText size={18} />}
                      </span>
                      {log.event_type}
                    </span>
                  </td>
                  <td>{log.actor_id ?? "System"}</td>
                  <td>{log.target_id}</td>
                  <td
                    className="audit-details"
                    title={log.details}
                  >
                    {log.details || "—"}
                  </td>
                  <td className="audit-timestamp">
                    {log.created_at
                      ? new Date(log.created_at).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!loading && logs.length > 0 && (
        <div className="audit-pagination">
          <button
            className="btn btn-ghost"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ← Previous
          </button>
          <span className="audit-page-info">Page {page + 1}</span>
          <button
            className="btn btn-ghost"
            disabled={logs.length < LIMIT}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}

      <ErrorToast message={error} onClose={() => setError(null)} />
    </div>
  );
}

export default AuditLog;
