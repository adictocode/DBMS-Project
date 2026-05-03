import { NavLink, Navigate, Outlet, Route, Routes } from "react-router-dom";
import {
  BarChart3,
  Bell,
  ClipboardList,
  LayoutDashboard,
  Menu,
  Search,
  ShieldCheck,
  Trophy,
  UserCircle,
  Vote,
  X,
} from "lucide-react";
import { useState } from "react";
import Dashboard from "./pages/Dashboard";
import CastVote from "./pages/CastVote";
import RegisterVoter from "./pages/RegisterVoter";
import Results from "./pages/Results";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";

const navigationItems = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard, end: true },
  { label: "Voter Portal", path: "/portal", icon: Vote },
  { label: "Register Voter", path: "/register", icon: UserCircle },
  { label: "Election Results", path: "/results", icon: Trophy },
];

// Shared sidebar body keeps the desktop and mobile drawers visually identical.
function SidebarContent({ onNavigate }) {
  return (
    <>
      <div className="flex h-20 items-center gap-3 border-b border-slate-100 px-6">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-600 text-white shadow-sm">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <p className="text-lg font-bold text-slate-950">VoteSecure</p>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Election DBMS
          </p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-2 px-4 py-6" aria-label="Primary navigation">
        {navigationItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-full px-4 py-3 text-sm font-semibold transition",
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900",
                ].join(" ")
              }
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <NavLink
          to="/admin"
          onClick={onNavigate}
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:bg-slate-100"
        >
          <div className="grid h-10 w-10 place-items-center rounded-full bg-white text-indigo-600 shadow-sm">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Admin Portal</p>
            <p className="text-xs text-slate-500">Secure access</p>
          </div>
        </NavLink>
      </div>
    </>
  );
}

// AppLayout owns the SaaS dashboard chrome: fixed sidebar, top bar, and routed content.
function AppLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-slate-100 bg-white shadow-sm lg:flex">
        <SidebarContent />
      </aside>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 lg:hidden">
          <div className="flex h-full w-72 flex-col bg-white shadow-xl">
            <div className="absolute left-72 top-4">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="ml-3 grid h-10 w-10 place-items-center rounded-full bg-white text-slate-600 shadow-sm"
                aria-label="Close sidebar"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <SidebarContent onNavigate={() => setIsSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 shadow-sm backdrop-blur">
          <div className="flex h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-100 bg-white text-slate-600 shadow-sm lg:hidden"
                aria-label="Open sidebar"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>

              <label className="relative hidden min-w-[22rem] sm:block">
                <span className="sr-only">Search elections</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  placeholder="Search voters, candidates, elections"
                  className="h-12 w-full rounded-2xl border border-slate-100 bg-slate-50 pl-12 pr-4 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-200 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-100 bg-white text-slate-500 shadow-sm transition hover:text-indigo-600"
                aria-label="View notifications"
              >
                <Bell className="h-5 w-5" aria-hidden="true" />
              </button>
              <NavLink
                to="/admin"
                className="flex h-11 items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 text-left shadow-sm transition hover:text-indigo-600"
                aria-label="Open admin portal"
              >
                <UserCircle className="h-6 w-6 text-indigo-600" aria-hidden="true" />
                <span className="hidden text-sm font-semibold text-slate-700 sm:inline">
                  Admin
                </span>
              </NavLink>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      {/* Public Routes with Layout */}
      <Route element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="portal" element={<CastVote />} />
        <Route path="register" element={<RegisterVoter />} />
        <Route path="results" element={<Results />} />
      </Route>

      {/* Admin Specific Routes */}
      <Route path="admin" element={<AdminLogin />} />
      <Route path="admin/dashboard" element={<AdminDashboard />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
