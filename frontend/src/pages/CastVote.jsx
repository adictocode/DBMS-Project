/**
 * CastVote.jsx — Voting Interface (Voter Portal)
 * =================================================
 * Two-step flow:
 *   1. Enter Voter ID + select Election Type → fetch context (voter, election, candidates)
 *   2. Select candidate → confirm → POST /api/votes/cast
 *
 * All validation is handled by the database's cast_vote procedure
 * and the trg_vote_validation trigger. Error messages from MariaDB
 * SIGNAL statements are displayed via ErrorToast.
 */

import { useState, useEffect } from "react";
import {
  getVoteContext,
  castVote,
  getElections,
  ApiError,
} from "../api/client";
import ErrorToast from "../components/ErrorToast";
import { CheckCircle, ShieldAlert, Vote, Search } from "lucide-react";

function CastVote() {
  const [voterId, setVoterId] = useState("");
  const [electionType, setElectionType] = useState("");
  const [activeElections, setActiveElections] = useState([]);
  const [context, setContext] = useState(null); // { voter, election, candidates }
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getElections("Active")
      .then((res) => {
        if (res.success && res.data) {
          setActiveElections(res.data);
        }
      })
      .catch((err) => console.error("Failed to fetch active elections", err));
  }, []);

  async function handleFetchContext() {
    if (!voterId || !electionType) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    setContext(null);
    setSelectedCandidate("");
    setStep(1);
    try {
      const res = await getVoteContext(parseInt(voterId, 10), electionType);
      setContext(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to fetch voting context");
    } finally {
      setLoading(false);
    }
  }

  async function handleVote() {
    if (!context || !selectedCandidate) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await castVote({
        voter_id: parseInt(voterId, 10),
        candidate_id: parseInt(selectedCandidate, 10),
        election_id: context.election.election_id,
      });
      setSuccess("Your vote has been cast successfully!");
      setStep(1);
      setVoterId("");
      setElectionType("");
      setContext(null);
      setSelectedCandidate("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Vote casting failed");
    } finally {
      setLoading(false);
    }
  }

  const candidates = context?.candidates || [];
  const selectedCandidateObj = candidates.find(
    (c) => String(c.candidate_id) === String(selectedCandidate)
  );

  return (
    <div className="space-y-6" id="vote-page">
      {/* Hero Header */}
      <section className="rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 p-6 text-white shadow-sm">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl bg-white/15">
            <Vote className="h-6 w-6" />
          </div>
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              Secure • Audited • Atomic
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Cast Your Vote
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-6 text-indigo-100">
              Enter your Voter ID and select the election type. Your vote is secure, tamper-proof,
              and recorded in the audit trail.
            </p>
          </div>
        </div>
      </section>

      {/* Success Banner */}
      {success && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700 shadow-sm" id="vote-success-msg">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm font-semibold">{success}</span>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Step 1: Selection Form */}
        <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="mb-6 flex items-center gap-3 text-lg font-bold text-slate-950">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-xs font-bold text-white">1</span>
            Voter Identification
          </h2>

          {/* Voter ID */}
          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="vote-voter-id">
              Voter ID *
            </label>
            <input
              id="vote-voter-id"
              className="h-12 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-200 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              type="number"
              value={voterId}
              onChange={(e) => {
                setVoterId(e.target.value);
                setContext(null);
                setSelectedCandidate("");
              }}
              placeholder="Enter your voter ID"
              min="1"
              required
            />
          </div>

          {/* Election Type */}
          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="vote-election-type">
              Election Type *
            </label>
            <select
              id="vote-election-type"
              className="h-12 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-200 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              value={electionType}
              onChange={(e) => {
                setElectionType(e.target.value);
                setContext(null);
                setSelectedCandidate("");
              }}
              required
            >
              <option value="">Select an active election</option>
              {activeElections.map((elec) => (
                <option key={elec.election_id} value={elec.election_type}>
                  {elec.election_name}
                </option>
              ))}
            </select>
          </div>

          {/* Fetch Context Button */}
          <button
            type="button"
            className="mb-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-800 py-3 text-sm font-bold text-white transition hover:bg-slate-900 disabled:opacity-50"
            onClick={handleFetchContext}
            disabled={loading || !voterId || !electionType}
            id="vote-fetch-btn"
          >
            <Search size={16} />
            {loading && !context ? "Loading..." : "Find My Ballot"}
          </button>

          {/* Voter & Election Info */}
          {context && (
            <>
              <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                <div className="text-sm text-slate-600">Verified Voter: <span className="font-semibold text-slate-900">{context.voter.name}</span></div>
                <div className="text-sm text-slate-600">Constituency: <span className="font-semibold text-slate-900">{context.voter.constituency_name}</span></div>
                <div className="mt-1 text-sm text-slate-600">Election: <span className="font-semibold text-indigo-700">{context.election.election_name}</span></div>
              </div>

              {/* Candidate Cards */}
              {candidates.length > 0 ? (
                <div className="mb-6">
                  <label className="mb-3 block text-sm font-semibold text-slate-700">
                    Select a Candidate *
                  </label>
                  <div className="space-y-2">
                    {candidates.map((c) => {
                      const isSelected = String(selectedCandidate) === String(c.candidate_id);
                      return (
                        <label
                          key={c.candidate_id}
                          className={`flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition ${
                            isSelected
                              ? "border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200"
                              : "border-slate-100 bg-white hover:border-indigo-200 hover:bg-slate-50"
                          }`}
                          htmlFor={`cand-${c.candidate_id}`}
                        >
                          <input
                            type="radio"
                            id={`cand-${c.candidate_id}`}
                            name="candidate"
                            value={c.candidate_id}
                            checked={isSelected}
                            onChange={(e) => setSelectedCandidate(e.target.value)}
                            className="sr-only"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-slate-900">{c.candidate_name}</div>
                            <div className="mt-0.5 text-xs font-medium text-indigo-600">
                              {c.symbol} • {c.party_name}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-400">{c.constituency_name}</div>
                          </div>
                          <div className={`grid h-6 w-6 place-items-center rounded-full border-2 text-xs font-bold transition ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-slate-200 bg-white text-transparent"
                          }`}>
                            ✓
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-sm font-medium text-amber-700">
                  No candidates found for your constituency in this election.
                </div>
              )}

              {/* Review Button */}
              {step === 1 && candidates.length > 0 && (
                <button
                  className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 py-3.5 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:hover:translate-y-0"
                  disabled={!selectedCandidate}
                  onClick={() => setStep(2)}
                  id="vote-review-btn"
                >
                  Review Vote
                </button>
              )}
            </>
          )}
        </div>

        {/* Step 2: Confirmation */}
        {step === 2 && selectedCandidateObj && context && (
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-md xl:sticky xl:top-24" id="vote-confirm-panel">
            <h2 className="mb-6 flex items-center gap-3 text-lg font-bold text-slate-950">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 text-xs font-bold text-white">2</span>
              Confirm Your Vote
            </h2>

            <div className="mb-5 space-y-0 divide-y divide-slate-100">
              {[
                ["Voter ID", voterId],
                ["Voter Name", context.voter.name],
                ["Election", context.election.election_name],
                ["Candidate", selectedCandidateObj.candidate_name],
                ["Party", selectedCandidateObj.party_name],
                ["Constituency", selectedCandidateObj.constituency_name],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between py-3">
                  <span className="text-sm text-slate-500">{label}</span>
                  <span className="text-right text-sm font-semibold text-slate-900">{value}</span>
                </div>
              ))}
            </div>

            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-sm font-medium text-amber-700">
              <ShieldAlert className="mr-1.5 inline h-4 w-4" />
              This action cannot be undone. Your vote is final.
            </div>

            <div className="flex gap-3">
              <button
                className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                onClick={() => setStep(1)}
                disabled={loading}
              >
                Go Back
              </button>
              <button
                className="flex-1 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 py-3 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50"
                onClick={handleVote}
                disabled={loading}
                id="vote-confirm-btn"
              >
                {loading ? "Casting..." : "Confirm & Cast Vote"}
              </button>
            </div>
          </div>
        )}
      </div>

      <ErrorToast message={error} onClose={() => setError(null)} />
    </div>
  );
}

export default CastVote;
