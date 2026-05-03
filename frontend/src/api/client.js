/**
 * api/client.js — Centralized API Client
 * ========================================
 * All HTTP requests to the Flask backend go through this module.
 *
 * Key Features:
 *   • Single base URL configuration
 *   • Automatic JSON parsing
 *   • Error extraction — reads the `error` field from Flask's
 *     HTTP 400 responses (which contain the MySQL SIGNAL message)
 *   • Typed error class for the UI to catch and display
 *
 * Error Flow:
 *   MySQL SIGNAL '45000' → Flask HTTP 400 {"error": "..."} → ApiError → ErrorToast
 */

const BASE_URL = "/api";

/**
 * Custom error class that carries the server's error message.
 * Thrown when the backend returns a non-2xx response.
 */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Core request function — wraps fetch with error handling.
 *
 * @param {string} endpoint — API path (e.g., "/voters/register")
 * @param {object} options  — fetch options (method, body, etc.)
 * @returns {Promise<object>} — parsed JSON response
 * @throws {ApiError} — if the server returns an error
 */
async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;

  const config = {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  };

  // Stringify body if it's an object
  if (config.body && typeof config.body === "object") {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok) {
    // The Flask error handler (errors.py) returns:
    // {"success": false, "error": "Voter must be at least 18 years old"}
    //
    // We extract that message and throw it as an ApiError so the
    // ErrorToast component can display it to the user.
    throw new ApiError(
      data.error || "An unexpected error occurred",
      response.status
    );
  }

  return data;
}

// ================================================================
//  PUBLIC API METHODS
// ================================================================

// --- Voters ---
export const registerVoter = (voterData) =>
  request("/voters/register", { method: "POST", body: voterData });

export const checkEligibility = (voterId) =>
  request(`/voters/${voterId}/eligibility`);

export const deactivateVoter = (voterId, reason) =>
  request(`/voters/${voterId}/deactivate`, {
    method: "POST",
    body: { reason },
  });

export const getPendingVoters = (electionId) =>
  request(`/voters/pending${electionId ? `?election_id=${electionId}` : ""}`);

export const getVoter = (voterId) =>
  request(`/voters/${voterId}`);

// --- Elections ---
export const getElections = (status) =>
  request(`/elections${status ? `?status=${status}` : ""}`);

export const createElection = (electionData) =>
  request("/elections/create", { method: "POST", body: electionData });

export const activateElection = (id) =>
  request(`/elections/${id}/activate`, { method: "POST" });

export const closeElection = (id) =>
  request(`/elections/${id}/close`, { method: "POST" });

export const cancelElection = (id, reason) =>
  request(`/elections/${id}/cancel`, { method: "POST", body: { reason } });

export const restartElection = (id) =>
  request(`/elections/${id}/restart`, { method: "POST" });

export const getElectionSummary = (id) =>
  request(`/elections/${id}/summary`);

export const revokeCandidate = (id, reason) =>
  request(`/elections/candidates/${id}/revoke`, { method: "POST", body: { reason } });

export const getStates = () => request("/elections/states");

export const getConstituencies = (stateId) =>
  request(
    `/elections/constituencies${stateId ? `?state_id=${stateId}` : ""}`
  );

// --- Votes ---
export const castVote = (voteData) =>
  request("/votes/cast", { method: "POST", body: voteData });

export const getCandidates = (electionId, constituencyId) => {
  let url = `/votes/candidates?election_id=${electionId}`;
  if (constituencyId) url += `&constituency_id=${constituencyId}`;
  return request(url);
};

export const checkHasVoted = (voterId, electionId) =>
  request(`/votes/has-voted?voter_id=${voterId}&election_id=${electionId}`);

export const getVoteContext = (voterId, electionType) =>
  request(`/votes/context?voter_id=${voterId}&election_type=${encodeURIComponent(electionType)}`);

export const getElectionHistory = (electionId) =>
  request(`/elections/${electionId}/history`);

// --- Results ---
export const getLiveTally = (electionId) =>
  request(`/results/tally${electionId ? `?election_id=${electionId}` : ""}`);

export const getTurnout = (electionId) =>
  request(
    `/results/turnout${electionId ? `?election_id=${electionId}` : ""}`
  );

export const getPartyPerformance = (electionId) =>
  request(
    `/results/performance${electionId ? `?election_id=${electionId}` : ""}`
  );

export const getWinner = (electionId, constituencyId) =>
  request(`/results/winner/${electionId}/${constituencyId}`);

export const getElectionResults = (electionId) =>
  request(`/results/election/${electionId}`);

// --- Audit ---
export const getAuditLogs = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return request(`/audit/logs${query ? `?${query}` : ""}`);
};

// --- Admin ---
export const adminLogin = (email, password) =>
  request("/admin/login", { method: "POST", body: { email, password } });

export const getAdminStats = () =>
  request("/admin/stats");

// ┌──────────────────────────────────────────────────────────────┐
// │  AI AGENT HOOK — Frontend Integration                        │
// │                                                              │
// │  When you build the AI agent dashboard, add methods here:    │
// │                                                              │
// │  export const getAgentAnalysis = () =>                       │
// │    request("/audit/analyze");                                │
// │                                                              │
// │  export const streamAgentAlerts = (callback) => {            │
// │    // WebSocket or SSE connection for real-time alerts       │
// │    const ws = new WebSocket("ws://localhost:8000/ws/alerts");│
// │    ws.onmessage = (e) => callback(JSON.parse(e.data));       │
// │    return ws;                                                │
// │  };                                                          │
// └──────────────────────────────────────────────────────────────┘
