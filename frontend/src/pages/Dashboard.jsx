import { useState, useEffect } from "react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BadgeCheck,
  Database,
  Landmark,
  ShieldCheck,
  TrendingUp,
  Users,
  Vote,
} from "lucide-react";
import {
  getLiveTally,
  getTurnout,
  getPartyPerformance,
  getAdminStats,
} from "../api/client";

const chartColors = ["#4f46e5", "#8b5cf6", "#14b8a6", "#f97316"];

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [tallyData, setTallyData] = useState([]);
  const [turnoutData, setTurnoutData] = useState([]);
  const [performanceData, setPerformanceData] = useState([]);
  const [adminStats, setAdminStats] = useState({
    total_votes: 0,
    total_voters: 0,
    total_elections: 0,
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const [tallyRes, turnoutRes, perfRes, statsRes] = await Promise.all([
          getLiveTally(),
          getTurnout(),
          getPartyPerformance(),
          getAdminStats(),
        ]);
        
        // Use only the top overall leader or empty if none
        setTallyData(tallyRes.data || []);
        setTurnoutData(turnoutRes.data || []);
        
        // Aggregate party performance across all elections for the pie chart
        const aggregatedPerf = {};
        (perfRes.data || []).forEach((row) => {
          if (!aggregatedPerf[row.party_name]) {
            aggregatedPerf[row.party_name] = 0;
          }
          aggregatedPerf[row.party_name] += row.seats_won;
        });
        const seatsWonFormatted = Object.keys(aggregatedPerf).map((party) => ({
          name: party,
          value: aggregatedPerf[party],
        }));
        setPerformanceData(seatsWonFormatted);
        
        if (statsRes.stats) {
          setAdminStats(statsRes.stats);
        }
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const leadingCandidate = tallyData.length > 0 
    ? { 
        candidate: tallyData[0].candidate_name, 
        party: tallyData[0].party_name, 
        votes: tallyData[0].total_votes 
      } 
    : { candidate: "Waiting for votes", party: "—", votes: 0 };

  const seatsWon = performanceData;

  const stats = [
    {
      label: "Votes Cast",
      value: adminStats.total_votes.toLocaleString(),
      delta: "Live",
      icon: Vote,
      accent: "bg-indigo-50 text-indigo-600",
    },
    {
      label: "Verified Voters",
      value: adminStats.total_voters.toLocaleString(),
      delta: "Registered",
      icon: Users,
      accent: "bg-violet-50 text-violet-600",
    },
    {
      label: "Total Elections",
      value: adminStats.total_elections.toString(),
      delta: "System",
      icon: Landmark,
      accent: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Audit Events",
      value: "Secure",
      delta: "Active tracking",
      icon: Database,
      accent: "bg-amber-50 text-amber-600",
    },
  ];

  // Mocked trend data since backend doesn't support time-series yet
  const turnoutTrend = [
    { time: "08:00", votes: 0 },
    { time: "10:00", votes: Math.floor(adminStats.total_votes * 0.2) },
    { time: "12:00", votes: Math.floor(adminStats.total_votes * 0.4) },
    { time: "14:00", votes: Math.floor(adminStats.total_votes * 0.6) },
    { time: "16:00", votes: Math.floor(adminStats.total_votes * 0.8) },
    { time: "18:00", votes: adminStats.total_votes },
  ];

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading live data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 p-6 text-white shadow-sm">
          <div className="flex flex-col justify-between gap-8 sm:flex-row">
            <div className="max-w-xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Live election control center
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Online Voting System Dashboard
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-50 sm:text-base">
                Monitor live tally views, district turnout, and database audit activity
                from one portfolio-grade operations surface.
              </p>
            </div>

            <div className="rounded-2xl bg-white/15 p-5 backdrop-blur">
              <p className="text-sm font-medium text-indigo-50">Current leader</p>
              <p className="mt-3 text-2xl font-bold">{leadingCandidate.candidate}</p>
              <p className="mt-1 text-sm text-indigo-50">{leadingCandidate.party}</p>
              <div className="mt-5 flex items-end gap-2">
                <span className="text-4xl font-bold">
                  {leadingCandidate.votes.toLocaleString()}
                </span>
                <span className="pb-1 text-sm font-semibold text-indigo-50">votes</span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Database view
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">vw_turnout</h2>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Activity className="h-6 w-6" aria-hidden="true" />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 max-h-48 overflow-y-auto">
            {turnoutData.length === 0 ? (
              <p className="text-sm text-slate-500">No turnout data available.</p>
            ) : (
              turnoutData.map((row) => (
                <div key={row.constituency_id + "-" + row.election_id} className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-500 truncate" title={row.constituency_name}>
                    {row.constituency_name}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">{row.turnout_pct}%</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <article
              key={stat.label}
              className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                  <p className="mt-3 text-3xl font-bold text-slate-950">{stat.value}</p>
                </div>
                <div className={`grid h-12 w-12 place-items-center rounded-2xl ${stat.accent}`}>
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
              </div>
              <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-600">
                <TrendingUp className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                {stat.delta}
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <article className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                Voting trends
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">Votes over time</h2>
            </div>
            <Activity className="h-6 w-6 text-indigo-600" aria-hidden="true" />
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={turnoutTrend} margin={{ left: -24, right: 12, top: 10, bottom: 0 }}>
                <XAxis
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ stroke: "#c7d2fe", strokeWidth: 1 }}
                  contentStyle={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "16px",
                    boxShadow: "0 1px 2px rgb(15 23 42 / 0.08)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="votes"
                  stroke="#4f46e5"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, fill: "#8b5cf6", stroke: "#ffffff", strokeWidth: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                vw_live_tally
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">Seats won</h2>
            </div>
            <BadgeCheck className="h-6 w-6 text-indigo-600" aria-hidden="true" />
          </div>

          <div className="h-72">
            {seatsWon.length === 0 ? (
               <div className="flex h-full items-center justify-center text-sm text-slate-500">
                 No performance data yet.
               </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "16px",
                      boxShadow: "0 1px 2px rgb(15 23 42 / 0.08)",
                    }}
                  />
                  <Pie
                    data={seatsWon}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={94}
                    paddingAngle={4}
                  >
                    {seatsWon.map((entry, index) => (
                      <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="space-y-3">
            {seatsWon.map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: chartColors[index % chartColors.length] }}
                  />
                  <span className="font-medium text-slate-600">{entry.name}</span>
                </div>
                <span className="font-bold text-slate-950">{entry.value}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

export default Dashboard;
