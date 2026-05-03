/**
 * RegisterVoter.jsx — Voter Registration Form
 * ==============================================
 * Calls POST /api/voters/register which delegates to the
 * register_voter stored procedure.
 */

import { useState } from "react";
import { registerVoter, ApiError } from "../api/client";
import ErrorToast from "../components/ErrorToast";
import { UserCheck, ShieldCheck, AlertCircle, UserPlus } from "lucide-react";

function RegisterVoter() {
  const [form, setForm] = useState({
    name: "",
    date_of_birth: "",
    gender: "",
    email: "",
    phone: "",
    address: "",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await registerVoter(form);
      setResult({
        voter_id: res.voter_id,
        state: res.state,
        constituency: res.constituency,
      });
      setForm({
        name: "",
        date_of_birth: "",
        gender: "",
        email: "",
        phone: "",
        address: "",
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6" id="register-page">
      {/* Hero Header */}
      <section className="rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 p-6 text-white shadow-sm">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-2xl bg-white/15">
            <UserPlus className="h-6 w-6" />
          </div>
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              Auto-detected constituency
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Register Voter
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-6 text-indigo-100">
              Enter your details and residential address. The system will
              auto-detect your state and constituency — just like the real
              Election Commission.
            </p>
          </div>
        </div>
      </section>

      {/* Voter ID Card (shown after successful registration) */}
      {result && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm" id="voter-id-card" style={{ animation: 'scaleIn 0.4s ease' }}>
          <div className="mb-4 flex items-center justify-center gap-2 text-lg font-semibold text-emerald-600">
            <UserCheck className="h-6 w-6" />
            Registration Successful!
          </div>
          <div className="bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-6xl font-extrabold text-transparent" style={{ lineHeight: '1.1' }}>
            {result.voter_id}
          </div>
          <div className="mt-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Your Voter ID
          </div>
          <div className="mt-5 flex justify-center gap-8">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">State</div>
              <div className="mt-1 text-sm font-bold text-slate-900">{result.state}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Constituency</div>
              <div className="mt-1 text-sm font-bold text-slate-900">{result.constituency}</div>
            </div>
          </div>
          <div className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
            <AlertCircle className="h-4 w-4" />
            Save this Voter ID — you'll need it to cast your vote.
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        {/* Registration Form */}
        <form
          className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
          onSubmit={handleSubmit}
          id="register-form"
          style={{ animation: 'slideUp 0.5s ease' }}
        >
          {/* Name */}
          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="reg-name">
              Full Name *
            </label>
            <input
              id="reg-name"
              className="h-12 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-200 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Enter full name"
              required
            />
          </div>

          {/* Date of Birth */}
          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="reg-dob">
              Date of Birth *
            </label>
            <input
              id="reg-dob"
              className="h-12 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-200 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              type="date"
              name="date_of_birth"
              value={form.date_of_birth}
              onChange={handleChange}
              min="1920-01-01"
              max={new Date().toISOString().split("T")[0]}
              required
            />
          </div>

          {/* Gender */}
          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="reg-gender">
              Gender
            </label>
            <select
              id="reg-gender"
              className="h-12 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-200 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              name="gender"
              value={form.gender}
              onChange={handleChange}
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Email */}
          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="reg-email">
              Email
            </label>
            <input
              id="reg-email"
              className="h-12 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-200 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="voter@example.com"
            />
          </div>

          {/* Phone */}
          <div className="mb-5">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="reg-phone">
              Phone
            </label>
            <input
              id="reg-phone"
              className="h-12 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-200 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="9876543210"
            />
          </div>

          {/* Address */}
          <div className="mb-6">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="reg-address">
              Residential Address *
            </label>
            <textarea
              id="reg-address"
              className="w-full resize-y rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-200 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              name="address"
              value={form.address}
              onChange={handleChange}
              placeholder="e.g., 42, Model Town, Ludhiana, Punjab 141002"
              rows={3}
              required
            />
            <span className="mt-1.5 block text-xs text-slate-400">
              Include your city and state — the system uses this to assign your constituency.
            </span>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 py-3.5 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:hover:translate-y-0"
            disabled={loading}
            id="register-submit-btn"
          >
            {loading ? "Registering..." : "Register & Get Voter ID"}
          </button>
        </form>

        {/* Info Panel */}
        <div style={{ animation: 'slideUp 0.6s ease' }}>
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-950">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              How It Works
            </h3>
            <p className="mb-4 text-sm leading-relaxed text-slate-500">
              Your constituency is <strong className="text-slate-700">auto-detected</strong> from your
              residential address. You cannot select it manually — this mirrors
              the real Election Commission of India process.
            </p>
            <ul className="space-y-0 divide-y divide-slate-100">
              {[
                "Address parsed to detect state & constituency",
                "Unique Voter ID assigned automatically",
                "Age ≥ 18 enforced by database trigger",
                "Email & phone must be unique",
                "Full ACID transaction with rollback",
                "Audit trail created on registration",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 py-3 text-sm text-slate-500">
                  <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <ErrorToast message={error} onClose={() => setError(null)} />
    </div>
  );
}

export default RegisterVoter;
