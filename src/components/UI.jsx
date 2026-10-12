import React from "react";
import { LogOut } from "lucide-react";

export const MALL = "Lulu Central Mall";

export const fmt = (s) => {
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(Math.floor(s % 60)).padStart(2, "0");
  return `${h}:${m}:${sec}`;
};

export const Card = ({ className = "", children }) => (
  <div className={`bg-zinc-800 border border-zinc-700 rounded-xl ${className}`}>
    {children}
  </div>
);

export const Button = ({ variant = "primary", className = "", ...p }) => (
  <button
    {...p}
    className={`h-12 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
      variant === "primary"
        ? "bg-blue-600 hover:bg-blue-500 text-white"
        : "bg-zinc-700 hover:bg-zinc-600 text-zinc-100"
    } ${className}`}
  />
);

export const Input = (p) => (
  <input
    {...p}
    className="w-full h-12 px-4 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
  />
);

export const Shell = ({ title, subtitle, onLogout, tabs, tab, setTab, children }) => (
  <div className="min-h-screen bg-zinc-900 text-zinc-100 flex flex-col max-w-md mx-auto">
    <header className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-zinc-800">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-zinc-400">{subtitle}</p>
      </div>
      <button
        onClick={onLogout}
        aria-label="Sign out"
        className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
      >
        <LogOut size={20} />
      </button>
    </header>
    <main className="flex-1 px-5 py-5 pb-28 space-y-4">{children}</main>
    <nav className="fixed bottom-0 inset-x-0 max-w-md mx-auto bg-zinc-900 border-t border-zinc-800 grid grid-cols-3">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setTab(id)}
          className={`flex flex-col items-center gap-1 py-3 text-xs ${
            tab === id ? "text-blue-400" : "text-zinc-500"
          }`}
        >
          <Icon size={22} />
          {label}
        </button>
      ))}
    </nav>
  </div>
);