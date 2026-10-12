import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, onValue } from "firebase/database";
import { auth, rtdb } from "./config/firebase";
import AuthPage from "./pages/AuthPage";
import CustomerDashboard from "./pages/CustomerDashboard";
import AdminDashboard from "./pages/AdminDashboard";

/* ---------- Brand mark: isometric dual-tier parking glyph + sensor beacon ---------- */
function SlotifyMark({ size = 32 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="0.5" y="0.5" width="31" height="31" rx="8" fill="#11182c" stroke="#232f4e" />
      {/* ground tier */}
      <path
        d="M16 26 L7 21.5 L16 17 L25 21.5 Z"
        fill="#2563eb"
        fillOpacity="0.35"
        stroke="#3b82f6"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* top tier */}
      <path
        d="M16 20 L7 15.5 L16 11 L25 15.5 Z"
        fill="#3b82f6"
        stroke="#60a5fa"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* wireless beacon */}
      <circle cx="16" cy="6" r="1.6" fill="#60a5fa" />
      <path d="M12.2 8 A5.4 5.4 0 0 1 19.8 8" stroke="#3b82f6" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M9.8 9.6 A8.6 8.6 0 0 1 22.2 9.6" stroke="#3b82f6" strokeOpacity="0.5" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function BrandLogo() {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <SlotifyMark size={32} />
      <span className="font-bold text-[19px] tracking-tight text-white leading-none">
        Slotify<span className="text-[#3b82f6]">.</span>
      </span>
    </div>
  );
}

/* ---------- Live Firebase connection pill ---------- */
function ConnectionPill() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const unsubscribe = onValue(
      ref(rtdb, ".info/connected"),
      (snap) => setConnected(snap.val() === true),
      () => setConnected(false)
    );
    return () => unsubscribe();
  }, []);

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold tracking-wide ${
        connected
          ? "bg-[#064e3b]/60 border-emerald-700/60 text-emerald-300"
          : "bg-[#4c0519]/60 border-rose-800/70 text-rose-300"
      }`}
      title={connected ? "Connected to Firebase" : "Disconnected from Firebase"}
    >
      <span className="relative flex h-2 w-2">
        {connected && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            connected ? "bg-emerald-400" : "bg-rose-400"
          }`}
        />
      </span>
      <span className="hidden sm:inline">{connected ? "LIVE" : "OFFLINE"}</span>
    </div>
  );
}

const homePathFor = (role) => (role === "admin" ? "/admin/camera" : "/dashboard/grid");

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const resolvedRole = currentUser.email?.toLowerCase().startsWith("admin")
          ? "admin"
          : "customer";
        setRole(resolvedRole);

        // Redirect off auth page if already logged in
        if (location.pathname === "/login" || location.pathname === "/") {
          navigate(homePathFor(resolvedRole), { replace: true });
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0f1d] flex flex-col items-center justify-center gap-4">
        <div className="animate-pulse">
          <SlotifyMark size={48} />
        </div>
        <span className="text-slate-400 text-sm font-medium">Loading Slotify...</span>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#0a0f1d] text-slate-100 flex flex-col font-sans antialiased">
      {user && (
        <header className="sticky top-0 z-50 border-b border-[#232f4e] bg-[#0a0f1d]/80 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
            <BrandLogo />

            <div className="flex items-center gap-2 sm:gap-3">
              <ConnectionPill />

              {/* Profile chip */}
              <div className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-[#11182c] border border-[#232f4e]">
                <span className="h-6 w-6 rounded-full bg-gradient-to-br from-[#2563eb] to-[#60a5fa] text-white text-[11px] font-bold flex items-center justify-center uppercase">
                  {user.email?.[0] || "U"}
                </span>
                <span className="hidden md:inline text-xs text-slate-300 max-w-[160px] truncate">
                  {user.email}
                </span>
                <span
                  className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${
                    role === "admin"
                      ? "bg-[#451a03] text-amber-300 border border-amber-800/60"
                      : "bg-[#1a233d] text-sky-300 border border-[#232f4e]"
                  }`}
                >
                  {role}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="text-xs px-3 py-1.5 bg-[#1a233d] hover:bg-[#232f4e] text-slate-200 border border-[#232f4e] rounded-lg transition font-medium cursor-pointer"
              >
                <span className="hidden sm:inline">Sign Out</span>
                <span className="sm:hidden" aria-label="Sign out">
                  Exit
                </span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/*
        Bottom padding keeps content clear of the docked mobile nav bar
        (rendered inside each dashboard) incl. iOS safe-area inset.
        Removed from md and up where the nav sits at the top.
      */}
      <main
        className={`flex-1 ${
          user ? "pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6" : ""
        }`}
      >
        <Routes>
          <Route
            path="/login"
            element={
              !user ? (
                <AuthPage
                  onLoginSuccess={(detectedRole, authUser) => {
                    setRole(detectedRole);
                    setUser(authUser);
                    navigate(homePathFor(detectedRole));
                  }}
                />
              ) : (
                <Navigate to={homePathFor(role)} replace />
              )
            }
          />

          {/* Customer routes */}
          <Route
            path="/dashboard/:tab"
            element={
              user ? (
                role === "admin" ? (
                  <Navigate to="/admin/camera" replace />
                ) : (
                  <CustomerDashboard user={user} />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* Admin routes */}
          <Route
            path="/admin/:tab"
            element={
              user ? (
                role === "admin" ? (
                  <AdminDashboard user={user} />
                ) : (
                  <Navigate to="/dashboard/grid" replace />
                )
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* Catch-all redirect (also handles bare /dashboard and /admin) */}
          <Route
            path="*"
            element={<Navigate to={user ? homePathFor(role) : "/login"} replace />}
          />
        </Routes>
      </main>
    </div>
  );
}