import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAdminStats,
  getElections,
  activateElection,
  closeElection,
  deactivateVoter,
  getLiveTally,
  getAuditLogs,
  restartElection,
  getElectionSummary,
  getElectionHistory,
  revokeCandidate,
  ApiError,
} from "../api/client";
import ErrorToast from "../components/ErrorToast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line,
} from "recharts";
import {
  Users, Vote, Landmark, BarChart3, TrendingUp, TrendingDown,
  LayoutDashboard, LogOut, ShieldCheck, ChevronRight, MoreVertical,
  Activity, Eye, UserPlus, Percent, ClipboardList, FileText,
  UserMinus, Building2, PlayCircle, XOctagon, XCircle,
} from "lucide-react";
import "./AdminDashboard.css";

/* ─── Tiny sparkline for stat cards ─── */
function MiniSparkline({ data, color, type = "line" }) {
  return (
    <div className="mini-sparkline">
      <ResponsiveContainer width="100%" height="100%">
        {type === "bar" ? (
          <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <Bar dataKey="v" fill={`${color}66`} radius={[2, 2, 0, 0]} />
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <Line type="monotone" dataKey="v" stroke="rgba(255,255,255,0.7)" strokeWidth={2} dot={{ r: 3, fill: "#fff", strokeWidth: 0 }} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Progress bar component for bottom stats ─── */
function ProgressBar({ value, color }) {
  return (
    <div className="ad-progress-track">
      <div className="ad-progress-fill" style={{ width: `${value}%`, backgroundColor: color }} />
    </div>
  );
}

// Event type → icon component mapping for audit logs
const EVENT_ICONS = {
  VOTE_CAST: <Vote size={16} className="text-indigo-600" />,
  VOTER_REGISTERED: <UserPlus size={16} className="text-emerald-600" />,
  VOTER_DEACTIVATED: <UserMinus size={16} className="text-red-500" />,
  ELECTION_CREATED: <Building2 size={16} className="text-blue-600" />,
  ELECTION_ACTIVATED: <PlayCircle size={16} className="text-emerald-600" />,
  ELECTION_CLOSED: <XOctagon size={16} className="text-slate-500" />,
  ELECTION_CANCELLED: <XCircle size={16} className="text-red-500" />,
};

function AdminDashboard() {
  const [admin, setAdmin] = useState(null);
  const [stats, setStats] = useState({ total_voters: 0, total_elections: 0, total_votes: 0 });
  const [elections, setElections] = useState([]);
  const [tally, setTally] = useState([]);
  const [error, setError] = useState(null);
  const [chartPeriod, setChartPeriod] = useState("Month");
  
  // Audit log state
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditFilter, setAuditFilter] = useState("");
  const [auditPage, setAuditPage] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const AUDIT_LIMIT = 25;

  // Forms
  const [revokeVoterId, setRevokeVoterId] = useState("");
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeCandidateId, setRevokeCandidateId] = useState("");
  const [revokeCandidateReason, setRevokeCandidateReason] = useState("");

  // Summary Modal
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryTab, setSummaryTab] = useState("current"); // "current" | "history"
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      navigate("/admin/login");
      return;
    }
    setAdmin(JSON.parse(token));
    loadDashboard();
  }, [navigate]);

  // Fetch audit logs when filter or page changes
  useEffect(() => {
    if (admin) fetchAuditLogs();
  }, [auditFilter, auditPage, admin]);

  // Realtime Polling (3 seconds)
  useEffect(() => {
    if (!admin) return;
    const interval = setInterval(() => {
      loadDashboard();
      // Only fetch audit logs periodically if on first page to avoid jumping
      if (auditPage === 0) fetchAuditLogs();
    }, 3000);
    return () => clearInterval(interval);
  }, [admin, auditPage, auditFilter]);

  async function loadDashboard() {
    try {
      const statsRes = await getAdminStats();
      setStats(statsRes.stats);

      const elecRes = await getElections();
      setElections(elecRes.data);

      const tallyRes = await getLiveTally();
      setTally(tallyRes.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load dashboard data");
    }
  }

  async function fetchAuditLogs() {
    setAuditLoading(true);
    try {
      const params = { limit: AUDIT_LIMIT, offset: auditPage * AUDIT_LIMIT };
      if (auditFilter) params.event_type = auditFilter;
      const res = await getAuditLogs(params);
      setAuditLogs(res.data || []);
    } catch (err) {
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  }

  async function handleActivateElection(id) {
    try {
      await activateElection(id);
      loadDashboard();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to activate election");
    }
  }

  async function handleCloseElection(id) {
    try {
      await closeElection(id);
      loadDashboard();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to close election");
    }
  }

  async function handleRevokeVoter(e) {
    e.preventDefault();
    if (!revokeVoterId) return;
    try {
      await deactivateVoter(revokeVoterId, revokeReason || "Admin Revocation");
      setRevokeVoterId("");
      setRevokeReason("");
      loadDashboard();
      fetchAuditLogs();
      alert(`Voter ${revokeVoterId} revoked successfully.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to revoke voter");
    }
  }

  async function handleRevokeCandidate(e) {
    e.preventDefault();
    if (!revokeCandidateId) return;
    try {
      await revokeCandidate(revokeCandidateId, revokeCandidateReason || "Admin Revocation");
      setRevokeCandidateId("");
      setRevokeCandidateReason("");
      loadDashboard();
      fetchAuditLogs();
      alert(`Candidate ${revokeCandidateId} revoked successfully.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to revoke candidate");
    }
  }

  async function handleRestartElection(id) {
    if (!window.confirm("Are you sure you want to restart this election? All votes will be permanently deleted!")) return;
    try {
      await restartElection(id);
      loadDashboard();
      fetchAuditLogs();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to restart election");
    }
  }

  async function handleViewSummary(id) {
    setSummaryModalOpen(true);
    setSummaryLoading(true);
    setSummaryData(null);
    setSummaryTab("current");
    setHistoryData([]);
    setSelectedSnapshot(null);
    try {
      const [summaryRes, historyRes] = await Promise.all([
        getElectionSummary(id),
        getElectionHistory(id),
      ]);
      setSummaryData({ election_id: id, ...summaryRes.data });
      setHistoryData(historyRes.data || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load election summary");
      setSummaryModalOpen(false);
    } finally {
      setSummaryLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("admin_token");
    navigate("/admin/login");
  }

  if (!admin) return <div className="ad-page">Loading...</div>;

  // --- Mock sparkline data ---
  const sparkVoters = [{ v: 40 }, { v: 38 }, { v: 35 }, { v: 50 }, { v: 48 }, { v: 42 }, { v: stats.total_voters || 45 }];
  const sparkElections = [{ v: 10 }, { v: 15 }, { v: 12 }, { v: 20 }, { v: 18 }, { v: 22 }, { v: stats.total_elections || 25 }];
  const sparkVotes = [{ v: 5 }, { v: 20 }, { v: 15 }, { v: 45 }, { v: 55 }, { v: 50 }, { v: stats.total_votes || 60 }];
  const sparkSessions = Array.from({ length: 12 }, () => ({ v: Math.floor(Math.random() * 40) + 10 }));

  // --- Mock trend chart data ---
  const trendData = [
    { name: "Week 1", votes: Math.floor(stats.total_votes * 0.15), voters: Math.floor(stats.total_voters * 0.2) },
    { name: "Week 2", votes: Math.floor(stats.total_votes * 0.35), voters: Math.floor(stats.total_voters * 0.35) },
    { name: "Week 3", votes: Math.floor(stats.total_votes * 0.5), voters: Math.floor(stats.total_voters * 0.55) },
    { name: "Week 4", votes: Math.floor(stats.total_votes * 0.6), voters: Math.floor(stats.total_voters * 0.65) },
    { name: "Week 5", votes: Math.floor(stats.total_votes * 0.55), voters: Math.floor(stats.total_voters * 0.7) },
    { name: "Week 6", votes: Math.floor(stats.total_votes * 0.7), voters: Math.floor(stats.total_voters * 0.75) },
    { name: "Week 7", votes: Math.floor(stats.total_votes * 0.85), voters: Math.floor(stats.total_voters * 0.85) },
    { name: "Week 8", votes: stats.total_votes, voters: stats.total_voters },
  ];

  const turnoutPct = stats.total_voters > 0 ? ((stats.total_votes / stats.total_voters) * 100).toFixed(1) : "0.0";
  const activeElections = elections.filter(e => e.status === "Active").length;
  const closedElections = elections.filter(e => e.status === "Closed").length;

  const bottomStats = [
    { label: "Total Votes", value: `${stats.total_votes.toLocaleString()} Votes`, pct: 40, color: "#4f46e5", sub: `(${turnoutPct}% Turnout)` },
    { label: "Registered Voters", value: `${stats.total_voters.toLocaleString()} Voters`, pct: 20, color: "#22d3ee", sub: "(Verified)" },
    { label: "Elections", value: `${stats.total_elections} Total`, pct: 60, color: "#f97316", sub: `(${activeElections} Active)` },
    { label: "Active Elections", value: `${activeElections} Running`, pct: 80, color: "#ef4444", sub: `(${closedElections} Closed)` },
    { label: "Turnout Rate", value: `${turnoutPct}%`, pct: parseFloat(turnoutPct) || 0, color: "#8b5cf6", sub: "(Overall)" },
  ];

  const statCards = [
    {
      value: stats.total_voters.toLocaleString(),
      label: "Registered Voters",
      delta: "+12.4%",
      deltaDir: "up",
      bg: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
      sparkData: sparkVoters,
      sparkType: "line",
      icon: Users,
    },
    {
      value: stats.total_votes.toLocaleString(),
      label: "Total Votes Cast",
      delta: `${turnoutPct}%`,
      deltaDir: "up",
      bg: "linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)",
      sparkData: sparkElections,
      sparkType: "line",
      icon: Vote,
    },
    {
      value: `${turnoutPct}%`,
      label: "Voter Turnout",
      delta: "Active",
      deltaDir: "up",
      bg: "linear-gradient(135deg, #f59e0b 0%, #f97316 100%)",
      sparkData: sparkVotes,
      sparkType: "line",
      icon: Percent,
    },
    {
      value: stats.total_elections.toString(),
      label: "Elections",
      delta: `${activeElections} active`,
      deltaDir: activeElections > 0 ? "up" : "down",
      bg: "linear-gradient(135deg, #ef4444 0%, #f43f5e 100%)",
      sparkData: sparkSessions,
      sparkType: "bar",
      icon: Landmark,
    },
  ];

  const eventTypes = [
    "VOTE_CAST", "VOTER_REGISTERED", "VOTER_DEACTIVATED",
    "ELECTION_CREATED", "ELECTION_ACTIVATED", "ELECTION_CLOSED", "ELECTION_CANCELLED",
  ];

  return (
    <div className="ad-page">
      {/* ─── Top Bar ─── */}
      <header className="ad-topbar">
        <div className="ad-topbar-left">
          <LayoutDashboard className="ad-topbar-icon" size={20} />
          <span className="ad-topbar-title">Admin Dashboard</span>
        </div>
        <div className="ad-topbar-right">
          <span className="ad-topbar-welcome">Welcome, {admin.name}</span>
          <span className="ad-topbar-role">{admin.role}</span>
          <button className="ad-logout-btn" onClick={handleLogout}>
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </header>

      {/* ─── Breadcrumb ─── */}
      <div className="ad-breadcrumb">
        <ShieldCheck size={14} />
        <span>Home</span>
        <ChevronRight size={14} />
        <span className="ad-breadcrumb-active">Dashboard</span>
      </div>

      {/* ─── Stat Cards Row ─── */}
      <div className="ad-stat-cards">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div className="ad-stat-card" key={i} style={{ background: card.bg }}>
              <div className="ad-stat-card-top">
                <div className="ad-stat-card-info">
                  <div className="ad-stat-card-value">{card.value}</div>
                  <div className="ad-stat-card-delta">
                    ({card.delta} {card.deltaDir === "up" ? "↑" : "↓"})
                  </div>
                </div>
                <div className="ad-stat-card-icon-wrap">
                  <MoreVertical size={18} />
                </div>
              </div>
              <div className="ad-stat-card-label">{card.label}</div>
              <MiniSparkline data={card.sparkData} color="#fff" type={card.sparkType} />
            </div>
          );
        })}
      </div>

      {/* ─── Traffic / Trend Chart ─── */}
      <div className="ad-chart-section">
        <div className="ad-chart-header">
          <div>
            <h3 className="ad-chart-title">Voting Activity</h3>
            <p className="ad-chart-subtitle">Cumulative trends over time</p>
          </div>
          <div className="ad-chart-controls">
            {["Day", "Month", "Year"].map((p) => (
              <button
                key={p}
                className={`ad-chart-period-btn ${chartPeriod === p ? "active" : ""}`}
                onClick={() => setChartPeriod(p)}
              >
                {p}
              </button>
            ))}
            <button className="ad-chart-action-btn">
              <Activity size={16} />
            </button>
          </div>
        </div>
        <div className="ad-chart-body">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="areaVotes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="areaVoters" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                }}
              />
              <Area type="monotone" dataKey="voters" stroke="#22d3ee" strokeWidth={2} fill="url(#areaVoters)" name="Registered Voters" />
              <Area type="monotone" dataKey="votes" stroke="#6366f1" strokeWidth={2} fill="url(#areaVotes)" name="Votes Cast" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="ad-bottom-stats">
          {bottomStats.map((bs, i) => (
            <div className="ad-bottom-stat" key={i}>
              <div className="ad-bottom-stat-label">{bs.label}</div>
              <div className="ad-bottom-stat-value">
                {bs.value} <span className="ad-bottom-stat-sub">{bs.sub}</span>
              </div>
              <ProgressBar value={bs.pct} color={bs.color} />
            </div>
          ))}
        </div>
      </div>

      {/* ─── Election Controls & Voter Revocation ─── */}
      <div className="ad-grid">
        <div className="ad-section">
          <h3 className="ad-section-title">
            <Landmark size={18} />
            Election Controls
          </h3>
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {elections.map((elec) => (
                  <tr key={elec.election_id}>
                    <td className="ad-td-id">{elec.election_id}</td>
                    <td>{elec.election_name}</td>
                    <td>
                      <span className={`ad-status ad-status-${elec.status.toLowerCase()}`}>
                        {elec.status}
                      </span>
                    </td>
                    <td>
                      {elec.status === "Upcoming" && (
                        <button className="ad-btn ad-btn-start" onClick={() => handleActivateElection(elec.election_id)}>
                          Start
                        </button>
                      )}
                      {elec.status === "Active" && (
                        <button className="ad-btn ad-btn-close" onClick={() => handleCloseElection(elec.election_id)}>
                          Close
                        </button>
                      )}
                      {(elec.status === "Completed" || elec.status === "Cancelled") && (
                        <button className="ad-btn ad-btn-restart" style={{ marginLeft: "8px" }} onClick={() => handleRestartElection(elec.election_id)}>
                          Restart
                        </button>
                      )}
                      <button className="ad-btn" style={{ marginLeft: "8px", background: "#f1f5f9", color: "#475569" }} onClick={() => handleViewSummary(elec.election_id)}>
                        Summary
                      </button>
                    </td>
                  </tr>
                ))}
                {elections.length === 0 && (
                  <tr><td colSpan="4" className="ad-empty">No elections found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ad-section">
          <h3 className="ad-section-title">
            <ShieldCheck size={18} />
            Revoke Voter Access
          </h3>
          <p className="ad-section-desc">Suspend a voter account manually (soft-delete).</p>
          <form onSubmit={handleRevokeVoter} className="ad-revoke-form">
            <div className="ad-form-group">
              <label className="ad-form-label">Voter ID</label>
              <input
                type="number"
                className="ad-form-input"
                value={revokeVoterId}
                onChange={(e) => setRevokeVoterId(e.target.value)}
                placeholder="e.g. 5"
                required
              />
            </div>
            <div className="ad-form-group">
              <label className="ad-form-label">Reason</label>
              <input
                type="text"
                className="ad-form-input"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="e.g. Suspicious activity"
              />
            </div>
            <button type="submit" className="ad-btn ad-btn-danger">
              Revoke Voter
            </button>
          </form>

          <h3 className="ad-section-title" style={{ marginTop: "32px" }}>
            <ShieldCheck size={18} />
            Revoke Candidate Access
          </h3>
          <p className="ad-section-desc">Remove candidate from ballot (soft-delete).</p>
          <form onSubmit={handleRevokeCandidate} className="ad-revoke-form">
            <div className="ad-form-group">
              <label className="ad-form-label">Candidate ID</label>
              <input
                type="number"
                className="ad-form-input"
                value={revokeCandidateId}
                onChange={(e) => setRevokeCandidateId(e.target.value)}
                placeholder="e.g. 5"
                required
              />
            </div>
            <div className="ad-form-group">
              <label className="ad-form-label">Reason</label>
              <input
                type="text"
                className="ad-form-input"
                value={revokeCandidateReason}
                onChange={(e) => setRevokeCandidateReason(e.target.value)}
                placeholder="e.g. Disqualified"
              />
            </div>
            <button type="submit" className="ad-btn ad-btn-danger">
              Revoke Candidate
            </button>
          </form>
        </div>
      </div>

      {/* ─── Live Tally (Admin Only Detailed View) ─── */}
      <div className="ad-tally-section">
        <h3 className="ad-section-title">
          <BarChart3 size={18} />
          Detailed Live Tally (Admin Only)
        </h3>
        {tally.length === 0 ? (
          <div className="ad-empty" style={{ padding: "40px" }}>
            No votes recorded yet.
          </div>
        ) : (
          <div style={{ width: '100%', height: 400, marginTop: '24px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={tally}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" />
                <YAxis dataKey="candidate_name" type="category" width={150} stroke="#64748b" tick={{ fill: '#0f172a' }} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="total_votes" fill="#6366f1" radius={[0, 6, 6, 0]} name="Total Votes" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ─── Audit Log Section (Moved from standalone page) ─── */}
      <div className="ad-tally-section">
        <h3 className="ad-section-title">
          <ClipboardList size={18} />
          Audit Trail
        </h3>
        <p className="ad-section-desc">
          Tamper-evident audit log — UPDATE and DELETE are blocked by database triggers.
        </p>

        {/* Audit Filters */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
          <select
            className="ad-form-input"
            style={{ maxWidth: '280px' }}
            value={auditFilter}
            onChange={(e) => { setAuditFilter(e.target.value); setAuditPage(0); }}
          >
            <option value="">All Event Types</option>
            {eventTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button className="ad-btn ad-btn-start" onClick={fetchAuditLogs} style={{ padding: '8px 16px' }}>
            ↻ Refresh
          </button>
        </div>

        {/* Audit Table */}
        <div className="ad-table-wrap">
          {auditLoading ? (
            <div className="ad-empty" style={{ padding: "40px" }}>Loading audit logs...</div>
          ) : auditLogs.length === 0 ? (
            <div className="ad-empty" style={{ padding: "40px" }}>
              <FileText size={28} color="#94a3b8" style={{ marginBottom: '8px' }} />
              <div>No audit logs found</div>
            </div>
          ) : (
            <table className="ad-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Event</th>
                  <th>Actor</th>
                  <th>Target</th>
                  <th>Details</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.log_id}>
                    <td style={{ fontFamily: "monospace", color: "#94a3b8" }}>#{log.log_id}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 600 }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: '#f1f5f9' }}>
                          {EVENT_ICONS[log.event_type] || <FileText size={16} />}
                        </span>
                        {log.event_type}
                      </span>
                    </td>
                    <td>{log.actor_id ?? "System"}</td>
                    <td>{log.target_id}</td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '0.75rem', color: '#64748b' }} title={log.details}>
                      {log.details || "—"}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.75rem', color: '#94a3b8' }}>
                      {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Audit Pagination */}
        {!auditLoading && auditLogs.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '16px' }}>
            <button
              className="ad-btn ad-btn-close"
              disabled={auditPage === 0}
              onClick={() => setAuditPage((p) => Math.max(0, p - 1))}
              style={{ opacity: auditPage === 0 ? 0.5 : 1 }}
            >
              ← Previous
            </button>
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Page {auditPage + 1}</span>
            <button
              className="ad-btn ad-btn-close"
              disabled={auditLogs.length < AUDIT_LIMIT}
              onClick={() => setAuditPage((p) => p + 1)}
              style={{ opacity: auditLogs.length < AUDIT_LIMIT ? 0.5 : 1 }}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Summary Modal */}
      {summaryModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", padding: "24px", borderRadius: "12px", width: "90%", maxWidth: "650px", maxHeight: "90vh", overflowY: "auto", position: "relative" }}>
            <button 
              onClick={() => setSummaryModalOpen(false)}
              style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "#64748b" }}
            >
              ✕
            </button>
            <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "16px", color: "#0f172a" }}>Election Summary</h2>

            {/* Tab Switcher */}
            <div style={{ display: "flex", gap: "0", marginBottom: "20px", borderRadius: "8px", overflow: "hidden", border: "1px solid #e2e8f0" }}>
              <button
                onClick={() => { setSummaryTab("current"); setSelectedSnapshot(null); }}
                style={{
                  flex: 1, padding: "10px 16px", fontSize: "0.82rem", fontWeight: 600, border: "none", cursor: "pointer",
                  background: summaryTab === "current" ? "#6366f1" : "#fff",
                  color: summaryTab === "current" ? "#fff" : "#475569",
                  transition: "all 0.15s ease",
                }}
              >
                Current Results
              </button>
              <button
                onClick={() => setSummaryTab("history")}
                style={{
                  flex: 1, padding: "10px 16px", fontSize: "0.82rem", fontWeight: 600, border: "none", cursor: "pointer",
                  borderLeft: "1px solid #e2e8f0",
                  background: summaryTab === "history" ? "#6366f1" : "#fff",
                  color: summaryTab === "history" ? "#fff" : "#475569",
                  transition: "all 0.15s ease",
                }}
              >
                Past Snapshots {historyData.length > 0 && `(${historyData.length})`}
              </button>
            </div>
            
            {summaryLoading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Loading summary...</div>
            ) : summaryTab === "current" ? (
              /* ─── Current Results Tab ─── */
              summaryData ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
                    <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "4px" }}>Total Votes Cast</div>
                      <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#0f172a" }}>{summaryData.total_votes.toLocaleString()}</div>
                    </div>
                    <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "4px" }}>Turnout Percentage</div>
                      <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#0f172a" }}>{summaryData.turnout_percentage}%</div>
                    </div>
                  </div>

                  <h3 style={{ fontSize: "1.1rem", fontWeight: "semibold", marginBottom: "12px", color: "#1e293b" }}>Votes per Candidate</h3>
                  
                  {summaryData.candidates && summaryData.candidates.length > 0 ? (
                    <div className="ad-table-wrap">
                      <table className="ad-table" style={{ width: "100%", margin: 0 }}>
                        <thead>
                          <tr>
                            <th>Candidate</th>
                            <th>Party</th>
                            <th style={{ textAlign: "right" }}>Votes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summaryData.candidates.map(c => (
                            <tr key={c.candidate_id}>
                              <td style={{ fontWeight: 500 }}>{c.name}</td>
                              <td style={{ color: "#64748b" }}>{c.party_name}</td>
                              <td style={{ textAlign: "right", fontWeight: "bold", color: "#4f46e5" }}>{c.votes.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: "32px", textAlign: "center", background: "#f8fafc", borderRadius: "8px", color: "#64748b", border: "1px dashed #cbd5e1" }}>
                      No votes cast yet.
                    </div>
                  )}
                </>
              ) : (
                <div style={{ padding: "40px", textAlign: "center", color: "#ef4444" }}>Failed to load data.</div>
              )
            ) : (
              /* ─── History Tab ─── */
              historyData.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", background: "#f8fafc", borderRadius: "8px", color: "#64748b", border: "1px dashed #cbd5e1" }}>
                  No previous snapshots. History is saved when an election is restarted.
                </div>
              ) : (
                <>
                  {/* Snapshot selector */}
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#475569", marginBottom: "6px", display: "block" }}>Select Snapshot</label>
                    <select
                      className="ad-form-input"
                      style={{ width: "100%" }}
                      value={selectedSnapshot?.history_id || ""}
                      onChange={(e) => {
                        const snap = historyData.find(h => String(h.history_id) === e.target.value);
                        setSelectedSnapshot(snap || null);
                      }}
                    >
                      <option value="">Choose a snapshot...</option>
                      {historyData.map(h => (
                        <option key={h.history_id} value={h.history_id}>
                          {new Date(h.snapshot_at).toLocaleString()} — {h.results_json?.total_votes || 0} votes ({h.results_json?.previous_status || "N/A"})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Selected snapshot details */}
                  {selectedSnapshot && (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                        <div style={{ background: "#fffbeb", padding: "14px", borderRadius: "8px", border: "1px solid #fde68a" }}>
                          <div style={{ fontSize: "0.78rem", color: "#92400e", marginBottom: "2px" }}>Snapshot Date</div>
                          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#78350f" }}>{new Date(selectedSnapshot.snapshot_at).toLocaleString()}</div>
                        </div>
                        <div style={{ background: "#fffbeb", padding: "14px", borderRadius: "8px", border: "1px solid #fde68a" }}>
                          <div style={{ fontSize: "0.78rem", color: "#92400e", marginBottom: "2px" }}>Total Votes (at time)</div>
                          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#78350f" }}>{(selectedSnapshot.results_json?.total_votes || 0).toLocaleString()}</div>
                        </div>
                      </div>

                      {selectedSnapshot.results_json?.candidates?.length > 0 ? (
                        <div className="ad-table-wrap">
                          <table className="ad-table" style={{ width: "100%", margin: 0 }}>
                            <thead>
                              <tr>
                                <th>Candidate</th>
                                <th>Party</th>
                                <th style={{ textAlign: "right" }}>Votes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedSnapshot.results_json.candidates.map((c, i) => (
                                <tr key={i}>
                                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                                  <td style={{ color: "#64748b" }}>{c.party_name}</td>
                                  <td style={{ textAlign: "right", fontWeight: "bold", color: "#d97706" }}>{Number(c.votes).toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div style={{ padding: "24px", textAlign: "center", background: "#f8fafc", borderRadius: "8px", color: "#64748b" }}>
                          No candidate data in this snapshot.
                        </div>
                      )}
                    </>
                  )}
                </>
              )
            )}
          </div>
        </div>
      )}

      <ErrorToast message={error} onClose={() => setError(null)} />
    </div>
  );
}

export default AdminDashboard;
