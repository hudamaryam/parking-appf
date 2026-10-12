import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  subscribeToParking,
  reserveSlot,
  checkoutSlot,
  initializeDatabaseState,
} from "../services/parkingService";
import SlotTile from "../components/SlotTile";
import RouteMap from "../components/RouteMap";

/* Strict bay layout: 3 ground bays, 4 reserved top bays. Anything else in the DB is ignored. */
const GROUND_IDS = ["G1", "G2", "G3"];
const TOP_IDS = ["R1", "R2", "R3", "R4"];
const HOUR_MS = 3600000;

/* ---------- Icons ---------- */
const iconProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

const GridIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.8" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8" />
  </svg>
);

const ReserveIcon = () => (
  <svg {...iconProps}>
    <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
    <path d="M8 2.8v3.4M16 2.8v3.4M3.5 9.5h17M12 13v4.5M9.75 15.25h4.5" />
  </svg>
);

const TicketIcon = () => (
  <svg {...iconProps}>
    <path d="M4 8.5V6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 15.5v-2a2.5 2.5 0 0 0 0-5Z" />
    <path d="M14.5 5v14" strokeDasharray="2 2.4" />
  </svg>
);

const TABS = [
  { id: "grid", label: "Live Slots", Icon: GridIcon },
  { id: "reserve", label: "Reserve Bay", Icon: ReserveIcon },
  { id: "ticket", label: "My Ticket", Icon: TicketIcon },
];

/* ---------- Helpers ---------- */
const pad = (n) => String(n).padStart(2, "0");
const formatDuration = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

const storageKey = (uid) => `slotify:mySlot:${uid || "guest"}`;
const readStoredSlot = (uid) => {
  try {
    return window.localStorage.getItem(storageKey(uid)) || "";
  } catch {
    return "";
  }
};
const writeStoredSlot = (uid, slotId) => {
  try {
    if (slotId) window.localStorage.setItem(storageKey(uid), slotId);
    else window.localStorage.removeItem(storageKey(uid));
  } catch {
    /* storage unavailable -- ignore */
  }
};

const inputClass =
  "w-full px-3.5 py-2.5 bg-[#1a233d] border border-[#232f4e] rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/25 transition";
const labelClass = "block text-xs font-medium text-slate-400 mb-1.5";

export default function CustomerDashboard({ user }) {
  const { tab } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = TABS.some((t) => t.id === tab) ? tab : "grid";

  const [dbData, setDbData] = useState(null);
  const [plate, setPlate] = useState("");
  const [rfid, setRfid] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("R1");
  const [duration, setDuration] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [formError, setFormError] = useState("");
  const [mySlotId, setMySlotId] = useState(() => readStoredSlot(user?.uid));
  const [now, setNow] = useState(() => Date.now());
  const [toastOpen, setToastOpen] = useState(false);
  const firstScanKeyRef = useRef(null);

  /* ---------- Firebase subscription ---------- */
  useEffect(() => {
    initializeDatabaseState();
    const unsubscribe = subscribeToParking((data) => setDbData(data));
    return () => unsubscribe();
  }, []);

  const dataReady = dbData !== null;
  const groundSlots = dbData?.slots?.ground || {};
  const topSlots = dbData?.slots?.top || {};
  const rfidState = dbData?.rfid || {};

  const freeGround = GROUND_IDS.filter((id) => !groundSlots[id]?.occupied).length;
  const availableTop = TOP_IDS.filter((id) => !topSlots[id]?.reserved && !topSlots[id]?.occupied);
  const availableTopKey = availableTop.join(",");

  /* ---------- Active booking (prefer the slot this device booked) ---------- */
  const isBooked = (slot) => Boolean(slot?.reserved && slot?.plate);
  const activeSlotId =
    (mySlotId && TOP_IDS.includes(mySlotId) && isBooked(topSlots[mySlotId]) ? mySlotId : null) ||
    TOP_IDS.find((id) => isBooked(topSlots[id])) ||
    null;
  const activeBooking = activeSlotId ? topSlots[activeSlotId] : null;

  /* ---------- Keep the reserve dropdown on a free bay ---------- */
  const slotFromUrl = activeTab === "reserve" ? searchParams.get("slot") : null;
  useEffect(() => {
    if (!dataReady) return;
    // A bay picked from the Live Slots grid (or deep link) wins while it's still free.
    if (slotFromUrl && availableTop.includes(slotFromUrl)) {
      setSelectedSlot(slotFromUrl);
      return;
    }
    if (!availableTop.includes(selectedSlot)) {
      setSelectedSlot(availableTop[0] || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReady, availableTopKey, slotFromUrl]);

  /* Click a vacant top-floor tile on the grid to jump straight to Reserve with it preselected. */
  const goReserve = (id) => navigate(`/dashboard/reserve?slot=${id}`);

  /* ---------- Ticking clock for the countdown ---------- */
  const hasBooking = Boolean(activeBooking);
  useEffect(() => {
    if (activeTab !== "ticket" || !hasBooking) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [activeTab, hasBooking]);

  /* ---------- Exit barrier toast: only for scans that arrive while the page is open ---------- */
  const scanPlate = rfidState?.lastScannedPlate || "";
  const scanKey = `${scanPlate}|${rfidState?.lastScannedUid || ""}|${rfidState?.timestamp || 0}|${
    rfidState?.checkoutSlot || ""
  }`;
  const validScan = scanPlate !== "" && scanPlate !== "UNKNOWN_VEHICLE";

  useEffect(() => {
    if (!dataReady) return undefined;
    if (firstScanKeyRef.current === null) {
      firstScanKeyRef.current = scanKey; // stale scan from before page load -- don't pop a toast
      return undefined;
    }
    if (scanKey === firstScanKeyRef.current) return undefined;
    firstScanKeyRef.current = scanKey;
    if (!validScan) return undefined;
    setToastOpen(true);
    const timer = setTimeout(() => setToastOpen(false), 9000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanKey, dataReady]);

  /* ---------- Handlers ---------- */
  const handleBooking = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!plate.trim() || !rfid.trim() || !selectedSlot) {
      setFormError("Enter your vehicle number, RFID UID and pick a free bay.");
      return;
    }
    setIsSubmitting(true);
    try {
      await reserveSlot(selectedSlot, plate, rfid, duration);
      writeStoredSlot(user?.uid, selectedSlot);
      setMySlotId(selectedSlot);
      setPlate("");
      setRfid("");
      navigate("/dashboard/ticket");
    } catch (err) {
      console.error("Booking error:", err);
      setFormError(err?.message || "Could not complete the reservation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualCheckout = async () => {
    if (!activeSlotId) return;
    setIsCheckingOut(true);
    try {
      await checkoutSlot(activeSlotId);
      writeStoredSlot(user?.uid, "");
      setMySlotId("");
      navigate("/dashboard/grid");
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setIsCheckingOut(false);
    }
  };

  /* ---------- Ticket maths ---------- */
  const durationHours = Number(activeBooking?.durationHours ?? activeBooking?.duration) || 1;
  const reservedAt = Number(activeBooking?.reservedAt ?? activeBooking?.bookedAt) || 0;
  const endsAt = reservedAt ? reservedAt + durationHours * HOUR_MS : null;
  const remainingMs = endsAt ? endsAt - now : null;
  const expired = remainingMs !== null && remainingMs <= 0;
  const parked = Boolean(activeBooking?.occupied);

  let ticketStatus = { label: "Reserved — Awaiting Car", tone: "amber" };
  if (parked && expired) ticketStatus = { label: "Overstay — Time Expired", tone: "rose" };
  else if (parked) ticketStatus = { label: "Parked (IR Active)", tone: "emerald" };
  else if (expired) ticketStatus = { label: "Reservation Expired", tone: "slate" };

  const toneClass = {
    amber: "text-amber-300 bg-[#451a03]/60 border-amber-800/60",
    emerald: "text-emerald-300 bg-[#064e3b]/60 border-emerald-700/60",
    rose: "text-rose-300 bg-[#4c0519]/70 border-rose-800/70",
    slate: "text-slate-300 bg-[#1a233d] border-[#232f4e]",
  }[ticketStatus.tone];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-8 space-y-6 lg:space-y-8">
      {/* ---------- Desktop top pills ---------- */}
      <nav className="hidden md:flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#11182c] border border-[#232f4e] w-fit">
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => navigate(`/dashboard/${id}`)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition ${
                active
                  ? "bg-[#2563eb] text-white shadow-[0_0_20px_-2px_rgba(59,130,246,0.6)]"
                  : "text-slate-400 hover:text-slate-100 hover:bg-[#1a233d]"
              }`}
            >
              <span className="scale-90">
                <Icon />
              </span>
              {label}
              {id === "ticket" && activeSlotId && (
                <span className="ml-0.5 h-2 w-2 rounded-full bg-amber-400" aria-label="Active ticket" />
              )}
            </button>
          );
        })}
      </nav>

      {!dataReady && (
        <div className="text-center py-16 text-slate-500 text-sm animate-pulse">
          Syncing live parking data...
        </div>
      )}

      {/* ---------- Tab 1: Live Slots ---------- */}
      {dataReady && activeTab === "grid" && (
        <div className="space-y-7">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                Ground Floor — General Parking
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#064e3b]/60 border border-emerald-800/60 text-emerald-300">
                {freeGround}/{GROUND_IDS.length} free
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 lg:gap-4 lg:max-w-xl">
              {GROUND_IDS.map((id) => (
                <SlotTile
                  key={id}
                  id={id}
                  floor="ground"
                  status={groundSlots[id]?.occupied ? "occupied" : "vacant"}
                />
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                Top Floor — Reserved Parking
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#1a233d] border border-[#232f4e] text-sky-300">
                {availableTop.length}/{TOP_IDS.length} open
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
              {TOP_IDS.map((id) => {
                const s = topSlots[id];
                const free = !s?.occupied && !s?.reserved;
                return (
                  <SlotTile
                    key={id}
                    id={id}
                    floor="top"
                    status={s?.occupied ? "occupied" : s?.reserved ? "reserved" : "vacant"}
                    plate={s?.plate}
                    onClick={free ? () => goReserve(id) : undefined}
                  />
                );
              })}
            </div>
            {availableTop.length > 0 && (
              <p className="text-[11px] text-slate-500 mt-2.5">
                Tap a vacant bay to reserve it directly.
              </p>
            )}
          </section>
        </div>
      )}

      {/* ---------- Tab 2: Reserve Bay ---------- */}
      {dataReady && activeTab === "reserve" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          <div className="bg-[#11182c] border border-[#232f4e] rounded-2xl p-5 sm:p-6 max-w-md mx-auto lg:max-w-none lg:mx-0 lg:col-span-3 shadow-xl shadow-black/20">
          <h2 className="text-lg font-bold text-slate-100">Reserve Top Floor Bay</h2>
          <p className="text-xs text-slate-400 mt-1 mb-5">
            Your RFID card opens the reserved ramp, so enter the exact UID printed on it.
          </p>

          <form onSubmit={handleBooking} className="space-y-4">
            <div>
              <label className={labelClass}>Vehicle Number</label>
              <input
                type="text"
                required
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="KL-47-E-1001"
                className={`${inputClass} uppercase font-mono tracking-wide`}
              />
            </div>

            <div>
              <label className={labelClass}>RFID UID</label>
              <input
                type="text"
                required
                value={rfid}
                onChange={(e) => setRfid(e.target.value.toUpperCase())}
                placeholder="A1B2C3D4"
                autoComplete="off"
                className={`${inputClass} uppercase font-mono tracking-wide`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Select Bay</label>
                <select
                  value={selectedSlot}
                  onChange={(e) => setSelectedSlot(e.target.value)}
                  className={inputClass}
                >
                  {availableTop.length === 0 && <option value="">All bays taken</option>}
                  {TOP_IDS.map((id) => {
                    const taken = topSlots[id]?.reserved || topSlots[id]?.occupied;
                    return (
                      <option key={id} value={id} disabled={taken}>
                        Bay {id} {taken ? "(Taken)" : "(Free)"}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className={labelClass}>Duration</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className={inputClass}
                >
                  {[1, 2, 3, 4].map((h) => (
                    <option key={h} value={h}>
                      {h} {h === 1 ? "Hour" : "Hours"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formError && (
              <div
                role="alert"
                className="text-xs text-rose-300 bg-[#4c0519]/60 border border-rose-800/70 rounded-xl px-3 py-2"
              >
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || availableTop.length === 0}
              className="w-full py-3 bg-[#2563eb] hover:bg-[#3b82f6] text-white font-bold rounded-xl text-sm transition shadow-[0_0_24px_-6px_rgba(59,130,246,0.8)] disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? "Confirming..." : "Confirm Reservation"}
            </button>
          </form>
          </div>

          {/* Desktop-only side panel: live bay picker so the page isn't just a lone narrow card */}
          <div className="hidden lg:block lg:col-span-2 bg-[#11182c] border border-[#232f4e] rounded-2xl p-5 shadow-xl shadow-black/20">
            <h3 className="text-sm font-semibold text-slate-100 mb-1">Top Floor Bays</h3>
            <p className="text-[11px] text-slate-500 mb-4">
              {availableTop.length}/{TOP_IDS.length} free right now — click one to select it.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {TOP_IDS.map((id) => {
                const s = topSlots[id];
                const free = !s?.occupied && !s?.reserved;
                return (
                  <SlotTile
                    key={id}
                    id={id}
                    floor="top"
                    status={s?.occupied ? "occupied" : s?.reserved ? "reserved" : "vacant"}
                    plate={s?.plate}
                    selected={free && selectedSlot === id}
                    onClick={free ? () => setSelectedSlot(id) : undefined}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---------- Tab 3: My Ticket ---------- */}
      {dataReady && activeTab === "ticket" && (
        <div className="space-y-6">
          {activeBooking ? (
            <div className="bg-[#11182c] border border-[#232f4e] rounded-2xl p-5 sm:p-6 lg:p-7 max-w-2xl space-y-5 shadow-xl shadow-black/20">
              <div className="flex justify-between items-start gap-3 border-b border-dashed border-[#232f4e] pb-4">
                <div>
                  <h3 className="font-bold text-slate-100 text-lg">Slotify Parking Ticket</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Assigned Bay{" "}
                    <span className="text-[#60a5fa] font-bold text-sm font-mono">{activeSlotId}</span>
                    <span className="mx-1.5 text-slate-600">•</span>Top Floor
                  </p>
                </div>
                <span className="px-3 py-1 bg-[#1a233d] border border-[#2563eb]/60 text-[#60a5fa] text-xs rounded-full font-mono font-semibold tracking-wide whitespace-nowrap">
                  {activeBooking.plate}
                </span>
              </div>

              {/* Countdown */}
              <div
                className={`rounded-xl border p-4 text-center ${
                  parked && expired
                    ? "bg-[#4c0519]/50 border-rose-800/70"
                    : "bg-[#0a0f1d] border-[#232f4e]"
                }`}
              >
                <span className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1">
                  {expired ? (parked ? "Overstayed by" : "Expired") : "Time Remaining"}
                </span>
                <span
                  className={`block font-mono text-3xl sm:text-4xl font-bold tabular-nums ${
                    parked && expired ? "text-rose-400" : "text-white"
                  }`}
                >
                  {remainingMs === null
                    ? "--:--:--"
                    : formatDuration(expired ? Math.abs(remainingMs) : remainingMs)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
                <div className="p-3 bg-[#1a233d] rounded-xl border border-[#232f4e]">
                  <span className="text-slate-500 block mb-1">Duration</span>
                  <span className="text-slate-100 font-semibold text-sm">
                    {durationHours} {durationHours === 1 ? "Hour" : "Hours"}
                  </span>
                </div>
                <div className="p-3 bg-[#1a233d] rounded-xl border border-[#232f4e]">
                  <span className="text-slate-500 block mb-1">RFID UID</span>
                  <span className="text-slate-100 font-semibold text-sm font-mono break-all">
                    {activeBooking.rfid || "—"}
                  </span>
                </div>
                <div className="col-span-2 p-3 bg-[#1a233d] rounded-xl border border-[#232f4e] flex items-center justify-between gap-3">
                  <span className="text-slate-500">Status</span>
                  <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${toneClass}`}>
                    {ticketStatus.label}
                  </span>
                </div>
              </div>

              <div className="pt-1">
                <RouteMap targetSlot={activeSlotId} />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={handleManualCheckout}
                  disabled={isCheckingOut}
                  className="px-4 py-2 bg-[#4c0519]/50 border border-rose-800 text-rose-300 hover:bg-[#4c0519] rounded-xl text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                >
                  {isCheckingOut ? "Checking out..." : "Exit / Checkout (Simulate RFID)"}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 px-4 bg-[#11182c]/60 border border-[#232f4e] rounded-2xl">
              <p className="text-slate-300 text-sm font-medium">No active parking ticket</p>
              <p className="text-slate-500 text-xs mt-1 mb-4">Reserve a top floor bay to get your ticket and route.</p>
              <button
                onClick={() => navigate("/dashboard/reserve")}
                className="px-4 py-2 bg-[#2563eb] hover:bg-[#3b82f6] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Reserve a Bay
              </button>
            </div>
          )}
        </div>
      )}

      {/* ---------- Exit barrier floating toast ---------- */}
      {toastOpen && validScan && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6 z-40 w-[calc(100%-2rem)] max-w-md"
        >
          <div className="flex items-center gap-3 bg-[#11182c]/95 backdrop-blur-xl border border-[#2563eb]/60 rounded-full pl-4 pr-2 py-2 shadow-[0_8px_32px_-8px_rgba(37,99,235,0.7)]">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-[11px] text-slate-400">Exit scan</span>
              <span className="text-xs font-mono font-bold text-white truncate">{scanPlate}</span>
              {rfidState?.lastScannedUid && (
                <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                  {rfidState.lastScannedUid}
                </span>
              )}
            </div>
            {rfidState?.checkoutSlot && (
              <span className="px-2 py-0.5 bg-[#064e3b]/70 border border-emerald-700/60 text-emerald-300 rounded-full text-[11px] font-semibold whitespace-nowrap">
                {rfidState.checkoutSlot} Freed
              </span>
            )}
            <button
              onClick={() => setToastOpen(false)}
              aria-label="Dismiss"
              className="h-7 w-7 shrink-0 rounded-full text-slate-400 hover:text-white hover:bg-[#1a233d] transition cursor-pointer"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* ---------- Mobile bottom navigation ---------- */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-[#232f4e] bg-[#0a0f1d]/85 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        <div className="grid grid-cols-3 max-w-md mx-auto">
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => navigate(`/dashboard/${id}`)}
                className={`relative flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-medium transition cursor-pointer ${
                  active ? "text-[#60a5fa]" : "text-slate-500"
                }`}
              >
                {active && (
                  <span className="absolute top-0 h-0.5 w-10 rounded-full bg-[#3b82f6] shadow-[0_0_12px_2px_rgba(59,130,246,0.8)]" />
                )}
                <span className="relative">
                  <Icon />
                  {id === "ticket" && activeSlotId && (
                    <span className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-[#0a0f1d]" />
                  )}
                </span>
                {label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}