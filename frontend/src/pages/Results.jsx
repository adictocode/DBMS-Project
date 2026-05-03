/**
 * Results.jsx — Public Election Dashboard
 * =========================================
 * Shows voter turnout per constituency and party performance.
 */

import { useState, useEffect } from "react";
import {
  getElections,
  getTurnout,
  getPartyPerformance,
} from "../api/client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Trophy, BarChart3, Percent } from "lucide-react";

const COLORS = ["#4f46e5", "#8b5cf6", "#06b6d4", "#f97316", "#10b981"];

function Results() {
  const [elections, setElections] = useState([]);
  const [selectedElection, setSelectedElection] = useState("");
  const [turnout, setTurnout] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("turnout");

  useEffect(() => {
    getElections()
      .then((res) => setElections(res.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedElection) return;
    setLoading(true);
    Promise.all([
      getTurnout(selectedElection),
      getPartyPerformance(selectedElection),
    ])
      .then(([turnoutRes, perfRes]) => {
        setTurnout(turnoutRes.data || []);
        setPerformance(perfRes.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedElection]);

  return (
    <div className="space-y-6" id="results-page">
      {/* Hero Header */}
      <section className="rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 p-6 text-white shadow-sm">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl bg-white/15">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              Public Dashboard
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Election Results
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-6 text-indigo-100">
              Public overview showing voter turnout per constituency and party performance.
            </p>
          </div>
        </div>
      </section>

      {/* Election Selector */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="results-election">
          Select Election
        </label>
        <select
          id="results-election"
          className="h-12 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-200 focus:bg-white focus:ring-4 focus:ring-indigo-100"
          value={selectedElection}
          onChange={(e) => setSelectedElection(e.target.value)}
        >
          <option value="">Choose an election to view</option>
          {elections.map((e) => (
            <option key={e.election_id} value={e.election_id}>
              {e.election_name} ({e.status})
            </option>
          ))}
        </select>
      </div>

      {/* Tab Navigation + Content */}
      {selectedElection && (
        <>
          <div className="flex gap-1 rounded-2xl bg-slate-100 p-1 w-fit">
            {[
              { key: "turnout", label: "Constituency Turnout", icon: Percent },
              { key: "performance", label: "Party Performance", icon: BarChart3 },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                    activeTab === tab.key
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-10 shadow-sm">
              <div className="h-48 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : (
            <>
              {/* Turnout Tab */}
              {activeTab === "turnout" && (
                <div className="rounded-2xl border border-slate-100 bg-white shadow-sm" id="turnout-panel">
                  {turnout.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <Percent className="mb-3 h-8 w-8" />
                      <p className="text-sm font-medium">No turnout data</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-5 p-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {turnout.map((row, i) => (
                        <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-center transition hover:border-indigo-200 hover:shadow-sm">
                          <div className="mb-4 text-sm font-semibold text-slate-900">
                            {row.constituency_name}
                          </div>
                          <div className="relative mx-auto mb-3 h-28 w-28">
                            <svg viewBox="0 0 100 100" className="h-full w-full">
                              <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                              <circle
                                cx="50" cy="50" r="42"
                                fill="none"
                                stroke="url(#turnoutGrad)"
                                strokeWidth="8"
                                strokeLinecap="round"
                                strokeDasharray={`${(row.turnout_pct || 0) * 2.64} 264`}
                                transform="rotate(-90 50 50)"
                              />
                              <defs>
                                <linearGradient id="turnoutGrad" x1="0" y1="0" x2="1" y2="1">
                                  <stop offset="0%" stopColor="#4f46e5" />
                                  <stop offset="100%" stopColor="#8b5cf6" />
                                </linearGradient>
                              </defs>
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center text-xl font-bold text-slate-900">
                              {row.turnout_pct ?? 0}%
                            </div>
                          </div>
                          <div className="text-sm text-slate-500">
                            {row.votes_cast} / {row.registered_voters}
                          </div>
                          <div className="text-xs text-slate-400">votes cast</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Party Performance Tab */}
              {activeTab === "performance" && (
                <div className="rounded-2xl border border-slate-100 bg-white shadow-sm" id="performance-panel">
                  {performance.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <BarChart3 className="mb-3 h-8 w-8" />
                      <p className="text-sm font-medium">No performance data</p>
                    </div>
                  ) : (
                    <div className="p-6">
                      <div className="h-96">
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie
                              data={performance}
                              dataKey="seats_won"
                              nameKey="party_name"
                              cx="50%"
                              cy="50%"
                              innerRadius={70}
                              outerRadius={130}
                              paddingAngle={4}
                              label={({ party_name, percent }) =>
                                `${party_name} ${(percent * 100).toFixed(0)}%`
                              }
                            >
                              {performance.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={COLORS[index % COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#fff",
                                border: "1px solid #e2e8f0",
                                borderRadius: "16px",
                                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                              }}
                            />
                            <Legend verticalAlign="bottom" height={36} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Legend cards */}
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        {performance.map((entry, index) => (
                          <div key={entry.party_name} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span className="flex-1 text-sm font-medium text-slate-600">
                              {entry.party_name}
                            </span>
                            <span className="text-sm font-bold text-slate-900">
                              {entry.seats_won} seats
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default Results;
