import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminLogin, ApiError } from "../api/client";
import ErrorToast from "../components/ErrorToast";
import { ShieldCheck, Lock } from "lucide-react";

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await adminLogin(email, password);
      localStorage.setItem("admin_token", JSON.stringify(res.admin));
      navigate("/admin/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4" id="admin-login-page">
      <div className="w-full max-w-md" style={{ animation: 'scaleIn 0.4s ease' }}>
        {/* Logo */}
        <div className="mx-auto mb-8 flex flex-col items-center">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Admin Portal</h1>
          <p className="mt-2 text-sm text-slate-500">
            Authorized personnel only. Requires an <code className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-500">@admin.com</code> domain.
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-md">
          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="admin-email">
                Admin Email
              </label>
              <input
                id="admin-email"
                className="h-12 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-200 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                type="email"
                placeholder="name@admin.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="mb-6">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="admin-pass">
                Password
              </label>
              <input
                id="admin-pass"
                className="h-12 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-200 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-500 to-rose-500 py-3.5 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:hover:translate-y-0"
              disabled={loading}
            >
              <Lock className="h-4 w-4" />
              {loading ? "Authenticating..." : "Secure Login"}
            </button>
          </form>
        </div>
      </div>
      <ErrorToast message={error} onClose={() => setError(null)} />
    </div>
  );
}

export default AdminLogin;
