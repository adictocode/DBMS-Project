/**
 * Sidebar.jsx — Left Navigation Sidebar
 * =====================================
 * Replaces the Top Navbar for a modern, enterprise-ready layout.
 * Uses lucide-react for iconography.
 */

import { NavLink } from "react-router-dom";
import { LayoutDashboard, UserPlus, Vote, BarChart3, ListChecks, ShieldAlert, ShieldCheck } from "lucide-react";
import "./Sidebar.css";

function Sidebar() {
  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <ShieldCheck className="sidebar-logo-icon" size={28} color="#2563eb" />
        <span className="sidebar-title">VoteSecure</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <NavLink to="/" end className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
          <LayoutDashboard className="sidebar-icon" size={20} />
          <span>Overview</span>
        </NavLink>

        <NavLink to="/register" className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
          <UserPlus className="sidebar-icon" size={20} />
          <span>Register Voter</span>
        </NavLink>

        <NavLink to="/vote" className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
          <Vote className="sidebar-icon" size={20} />
          <span>Cast Vote</span>
        </NavLink>

        <NavLink to="/results" className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
          <BarChart3 className="sidebar-icon" size={20} />
          <span>Results</span>
        </NavLink>

        <NavLink to="/audit" className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
          <ListChecks className="sidebar-icon" size={20} />
          <span>Audit Logs</span>
        </NavLink>
      </nav>

      {/* Admin Link at the bottom */}
      <div className="sidebar-footer">
        <NavLink to="/admin/login" className={({ isActive }) => `sidebar-link admin-link ${isActive ? "active" : ""}`}>
          <ShieldAlert className="sidebar-icon" size={20} />
          <span>Admin Portal</span>
        </NavLink>
      </div>
    </aside>
  );
}

export default Sidebar;
