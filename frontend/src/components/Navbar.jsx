/**
 * Navbar.jsx — Top Navigation Bar
 * =================================
 * Persistent header with app branding and page navigation links.
 * Uses glassmorphism styling for the premium feel.
 */

import { NavLink } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import "./Navbar.css";

function Navbar() {
  return (
    <nav className="navbar" id="main-navbar">
      <div className="navbar-inner container">
        {/* Brand / Logo */}
        <NavLink to="/" className="navbar-brand">
          <span className="navbar-logo"><ShieldCheck size={24} color="#2563eb" /></span>
          <span className="navbar-title">VoteSecure</span>
        </NavLink>

        {/* Navigation Links */}
        <div className="navbar-links">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `navbar-link ${isActive ? "active" : ""}`
            }
            id="nav-dashboard"
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/register"
            className={({ isActive }) =>
              `navbar-link ${isActive ? "active" : ""}`
            }
            id="nav-register"
          >
            Register
          </NavLink>
          <NavLink
            to="/vote"
            className={({ isActive }) =>
              `navbar-link ${isActive ? "active" : ""}`
            }
            id="nav-vote"
          >
            Vote
          </NavLink>
          <NavLink
            to="/results"
            className={({ isActive }) =>
              `navbar-link ${isActive ? "active" : ""}`
            }
            id="nav-results"
          >
            Results
          </NavLink>
          <NavLink
            to="/audit"
            className={({ isActive }) =>
              `navbar-link ${isActive ? "active" : ""}`
            }
            id="nav-audit"
          >
            Audit Log
          </NavLink>
          <NavLink
            to="/admin/login"
            className={({ isActive }) =>
              `navbar-link ${isActive ? "active" : ""}`
            }
            id="nav-admin"
            style={{ color: "#ef4444" }}
          >
            Admin
          </NavLink>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
