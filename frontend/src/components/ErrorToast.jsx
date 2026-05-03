/**
 * ErrorToast.jsx — Animated Error Notification
 * ==============================================
 * Displays API errors (including MySQL SIGNAL messages) as
 * slide-in toast notifications in the bottom-right corner.
 *
 * Usage:
 *   <ErrorToast message={errorMsg} onClose={() => setErrorMsg(null)} />
 *
 * The error flow:
 *   MySQL trigger → SIGNAL '45000' → Flask HTTP 400 → ApiError → ErrorToast
 */

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import "./ErrorToast.css";

function ErrorToast({ message, onClose, duration = 6000 }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(onClose, 300); // wait for exit animation
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div className={`error-toast ${exiting ? "exiting" : ""}`} id="error-toast">
      <div className="error-toast-icon"><AlertCircle size={20} /></div>
      <div className="error-toast-content">
        <div className="error-toast-title">Operation Failed</div>
        <div className="error-toast-message">{message}</div>
      </div>
      <button
        className="error-toast-close"
        onClick={() => {
          setExiting(true);
          setTimeout(onClose, 300);
        }}
        aria-label="Dismiss error"
      >
        ✕
      </button>
      {/* Progress bar showing auto-dismiss countdown */}
      <div
        className="error-toast-progress"
        style={{ animationDuration: `${duration}ms` }}
      />
    </div>
  );
}

export default ErrorToast;
