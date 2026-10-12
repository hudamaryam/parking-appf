import React, { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth, googleProvider } from "../config/firebase";

/* Brand mark: isometric dual-tier parking glyph + sensor beacon (same as App.jsx header) */
function SlotifyMark({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="0.5" y="0.5" width="31" height="31" rx="8" fill="#11182c" stroke="#232f4e" />
      <path d="M16 26 L7 21.5 L16 17 L25 21.5 Z" fill="#2563eb" fillOpacity="0.35" stroke="#3b82f6" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M16 20 L7 15.5 L16 11 L25 15.5 Z" fill="#3b82f6" stroke="#60a5fa" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="16" cy="6" r="1.6" fill="#60a5fa" />
      <path d="M12.2 8 A5.4 5.4 0 0 1 19.8 8" stroke="#3b82f6" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M9.8 9.6 A8.6 8.6 0 0 1 22.2 9.6" stroke="#3b82f6" strokeOpacity="0.5" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
    <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

const AUTH_ERRORS = {
  "auth/invalid-credential": "Invalid email or password. Choose 'Create an account' below if you're new.",
  "auth/user-not-found": "Invalid email or password. Choose 'Create an account' below if you're new.",
  "auth/wrong-password": "Invalid email or password.",
  "auth/email-already-in-use": "That email is already registered. Switch to 'Sign in'.",
  "auth/weak-password": "Password should be at least 6 characters.",
  "auth/invalid-email": "That doesn't look like a valid email address.",
  "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/popup-closed-by-user": "Google sign-in was closed before finishing.",
  "auth/cancelled-popup-request": "Google sign-in was cancelled.",
};

const inputClass =
  "w-full px-4 py-3 bg-[#1a233d] border border-[#232f4e] rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/25 transition";

export default function AuthPage({ onLoginSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const resolveRole = (userEmail) =>
    userEmail && userEmail.toLowerCase().startsWith("admin") ? "admin" : "customer";

  const friendlyError = (err) => AUTH_ERRORS[err?.code] || err?.code || err?.message || "Something went wrong.";

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      const userCredential = isSignUp
        ? await createUserWithEmailAndPassword(auth, email, password)
        : await signInWithEmailAndPassword(auth, email, password);
      onLoginSuccess(resolveRole(userCredential.user.email), userCredential.user);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      onLoginSuccess(resolveRole(result.user.email), result.user);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] bg-[#0a0f1d] text-white flex flex-col justify-center items-center px-4 py-8 overflow-hidden">
      {/* ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-80 w-[36rem] rounded-full bg-[#2563eb]/20 blur-3xl"
      />

      <div className="relative w-full max-w-sm flex flex-col space-y-6">
        {/* Brand */}
        <div className="space-y-4">
          <SlotifyMark size={56} />
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Slotify<span className="text-[#3b82f6]">.</span>
            </h1>
            <p className="text-slate-400 text-base mt-1">
              Find a slot, reserve it, park without the circling.
            </p>
          </div>
        </div>

        {/* Auth card */}
        <div className="bg-[#11182c]/80 backdrop-blur-md border border-[#232f4e] rounded-2xl p-6 shadow-2xl shadow-black/30 space-y-5">
          {error && (
            <div
              role="alert"
              className="p-3 bg-[#4c0519]/60 border border-rose-800/70 text-rose-300 text-xs rounded-xl leading-relaxed"
            >
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full py-3 px-4 bg-[#1a233d] hover:bg-[#232f4e] border border-[#232f4e] text-white text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="relative flex items-center justify-center">
            <div className="grow border-t border-[#232f4e]" />
            <span className="shrink mx-3 text-xs text-slate-500 font-medium">or</span>
            <div className="grow border-t border-[#232f4e]" />
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className={inputClass}
            />
            <input
              type="password"
              required
              autoComplete={isSignUp ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className={inputClass}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-[#2563eb] hover:bg-[#3b82f6] text-white text-sm font-semibold rounded-xl transition shadow-[0_0_24px_-6px_rgba(59,130,246,0.8)] cursor-pointer disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? "Processing..." : isSignUp ? "Create account" : "Sign in"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center space-y-3 pt-1">
          <button
            type="button"
            onClick={() => {
              setError("");
              setIsSignUp(!isSignUp);
            }}
            className="text-sm font-medium text-slate-300 hover:text-white transition cursor-pointer"
          >
            {isSignUp ? "Already have an account? Sign in" : "New here? Create an account"}
          </button>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
            Demo: use an email starting with &ldquo;admin&rdquo; to open the admin dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}