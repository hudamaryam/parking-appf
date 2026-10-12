import React from "react";
import { ParkingSquare, Car, Lock } from "lucide-react";

/**
 * Props:
 *  - id:       slot id, e.g. "G1" or "R3"
 *  - floor:    "ground" | "top"
 *  - status:   "vacant" | "reserved" | "occupied"
 *  - plate:    optional licence plate (shown on reserved / occupied top bays)
 *  - selected, onClick, disabled: optional, for selectable tiles (kept from the old component)
 */
const STATUS = {
  vacant: {
    label: "Vacant",
    card: "border-emerald-500/30 hover:border-emerald-400/60",
    glow: "",
    tag: "bg-[#064e3b]/70 border-emerald-700/60 text-emerald-300",
    icon: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  reserved: {
    label: "Reserved",
    card: "border-amber-500/60",
    glow: "shadow-[0_0_22px_-6px_rgba(245,158,11,0.55)]",
    tag: "bg-[#451a03]/80 border-amber-800/70 text-amber-300",
    icon: "text-amber-400",
    dot: "bg-amber-400",
  },
  occupied: {
    label: "Occupied",
    card: "border-rose-500/60",
    glow: "shadow-[0_0_22px_-6px_rgba(244,63,94,0.6)]",
    tag: "bg-[#4c0519]/80 border-rose-800/70 text-rose-300",
    icon: "text-rose-400",
    dot: "bg-rose-400",
  },
};

const FLOOR_LABEL = { ground: "Ground", top: "Top" };

export default function SlotTile({
  id,
  floor = "ground",
  status = "vacant",
  plate = "",
  selected = false,
  onClick,
  disabled = false,
}) {
  const s = STATUS[status] || STATUS.vacant;
  const Wrapper = onClick ? "button" : "div";
  const Icon = status === "occupied" ? Car : status === "reserved" ? Lock : ParkingSquare;

  const plateText = String(plate || "").trim();
  const plateShort = plateText.length > 12 ? `${plateText.slice(0, 11)}…` : plateText;

  return (
    <Wrapper
      {...(onClick ? { onClick, disabled, type: "button" } : {})}
      aria-label={`Slot ${id}, ${s.label}${plateText ? `, plate ${plateText}` : ""}`}
      className={`relative overflow-hidden min-h-[116px] p-3 rounded-2xl border bg-[#11182c]/60 backdrop-blur-md flex flex-col justify-between text-left transition-all duration-300 ${
        s.card
      } ${s.glow} ${
        selected ? "!border-[#3b82f6] ring-2 ring-[#3b82f6]/40 bg-[#2563eb]/20" : ""
      } ${onClick && !disabled ? "cursor-pointer active:scale-[0.98]" : ""} ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      {/* frosted highlight */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.05] to-transparent"
      />

      <div className="relative flex items-start justify-between gap-2">
        <span className="px-1.5 py-0.5 rounded-md bg-[#1a233d]/80 border border-[#232f4e] text-[9px] uppercase tracking-wider font-semibold text-slate-400">
          {FLOOR_LABEL[floor] || floor}
        </span>
        {status !== "vacant" && (
          <span className="relative flex h-2.5 w-2.5 mt-0.5" aria-hidden="true">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-70 ${s.dot}`} />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${s.dot}`} />
          </span>
        )}
      </div>

      <div className="relative flex items-center gap-2.5 my-1">
        <Icon size={24} className={s.icon} />
        <span className="text-xl font-bold text-white font-mono tracking-tight">{id}</span>
      </div>

      <div className="relative flex items-center justify-between gap-2 min-h-[20px]">
        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${s.tag}`}>
          {selected ? "Selected" : s.label}
        </span>
        {plateShort && (
          <span className="text-[10px] font-mono text-slate-300 truncate" title={plateText}>
            {plateShort}
          </span>
        )}
      </div>
    </Wrapper>
  );
}