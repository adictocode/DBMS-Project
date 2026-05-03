/**
 * StatusBadge.jsx — Election Status Pill
 * ========================================
 * Renders a color-coded badge for election status values:
 *   • Upcoming  → blue
 *   • Active    → green (pulsing)
 *   • Completed → gray
 *   • Cancelled → red
 */

const STATUS_STYLES = {
  Upcoming: {
    background: "#eff6ff", /* blue-50 */
    color: "#2563eb", /* blue-600 */
    dot: "#3b82f6",
  },
  Active: {
    background: "#f0fdf4", /* green-50 */
    color: "#16a34a", /* green-600 */
    dot: "#22c55e",
  },
  Completed: {
    background: "#f8fafc", /* slate-50 */
    color: "#64748b", /* slate-500 */
    dot: "#94a3b8",
  },
  Cancelled: {
    background: "#fef2f2", /* red-50 */
    color: "#dc2626", /* red-600 */
    dot: "#ef4444",
  },
};

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.Upcoming;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 12px",
        fontSize: "0.75rem",
        fontWeight: 600,
        borderRadius: "9999px",
        background: style.background,
        color: style.color,
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: style.dot,
          animation: status === "Active" ? "pulse 2s infinite" : "none",
        }}
      />
      {status}
    </span>
  );
}

export default StatusBadge;
