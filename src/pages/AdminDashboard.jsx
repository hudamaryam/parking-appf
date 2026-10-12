import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  subscribeToParking,
  toggleGate,
  releaseGateOverride,
  toggleBuzzer,
  updateCameraConfig,
  initializeDatabaseState,
} from "../services/parkingService";
import SlotTile from "../components/SlotTile";

/* Strict bay layout: 3 ground bays, 4 reserved top bays. */
const GROUND_IDS = ["G1", "G2", "G3"];
const TOP_IDS = ["R1", "R2", "R3", "R4"];
const HOUR_MS = 3600000;
const EXIT_AUTO_CLOSE_MS = 10000;
const MAX_STREAM_RETRIES = 10;
const STREAM_RETRY_DELAY_MS = 4000;

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

const CameraIcon = () => (
  <svg {...iconProps}>
    <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.6l1.2-1.8A1.5 1.5 0 0 1 9.5 3.5h5a1.5 1.5 0 0 1 1.2.7L16.9 6h1.6A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5Z" />
    <circle cx="12" cy="13" r="3.6" />
  </svg>
);
const GateIcon = () => (
  <svg {...iconProps}>
    <path d="M4 20V9M4 13h16M20 20v-5M8 13v-3M12 13v-3M16 13v-3" />
    <rect x="2.5" y="8" width="3" height="3" rx="0.8" />
  </svg>
);
const BellIcon = () => (
  <svg {...iconProps}>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15Z" />
    <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
  </svg>
);
const GridIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.8" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8" />
  </svg>
);
const FullscreenIcon = ({ exit }) => (
  <svg {...iconProps} width={16} height={16}>
    {exit ? (
      <path d="M9 4v4a1 1 0 0 1-1 1H4M15 4v4a1 1 0 0 0 1 1h4M9 20v-4a1 1 0 0 0-1-1H4M15 20v-4a1 1 0 0 1 1-1h4" />
    ) : (
      <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" />
    )}
  </svg>
);

const TABS = [
  { id: "camera", label: "Surveillance", short: "Camera", Icon: CameraIcon },
  { id: "gates", label: "Gate Controls", short: "Gates", Icon: GateIcon },
  { id: "overstay", label: "Overstay & Alarms", short: "Alarms", Icon: BellIcon },
  { id: "slots", label: "Slots Overview", short: "Slots", Icon: GridIcon },
];

const GATES = [
  { key: "entry", title: "Main Entry Servo", sub: "Entrance barrier" },
  { key: "exit", title: "Main Exit Servo", sub: "Exit barrier" },
  { key: "reserved", title: "Reserved Ramp Servo", sub: "Top floor ramp barrier" },
];

/* ---------- Helpers ---------- */
const pad = (n) => String(n).padStart(2, "0");
const formatHMS = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
};
// Firmware may write epoch seconds; the web app writes milliseconds.
const normalizeTs = (ts) => {
  const n = Number(ts) || 0;
  return n && n < 1e11 ? n * 1000 : n;
};
const formatClock = (ts) => {
  const n = normalizeTs(ts);
  return n ? new Date(n).toLocaleTimeString() : "—";
};

const cardClass = "bg-[#11182c] border border-[#232f4e] rounded-2xl shadow-xl shadow-black/20";
const inputClass =
  "w-full px-3 py-2 bg-[#1a233d] border border-[#232f4e] rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/25 transition font-mono";

/* ---------- Barrier glyph ---------- */
function BarrierGlyph({ open }) {
  return (
    <svg viewBox="0 0 120 56" className="w-full h-14" aria-hidden="true">
      <rect x="6" y="22" width="14" height="30" rx="3" fill="#1a233d" stroke="#232f4e" />
      <circle cx="13" cy="30" r="2.2" fill={open ? "#10b981" : "#f43f5e"} />
      <g
        style={{
          transform: open ? "rotate(-62deg)" : "rotate(0deg)",
          transformOrigin: "16px 38px",
          transition: "transform 0.6s ease",
        }}
      >
        <rect x="16" y="35" width="96" height="6" rx="3" fill={open ? "#10b981" : "#3b82f6"} />
        <rect x="40" y="35" width="10" height="6" fill="#0a0f1d" fillOpacity="0.45" />
        <rect x="64" y="35" width="10" height="6" fill="#0a0f1d" fillOpacity="0.45" />
        <rect x="88" y="35" width="10" height="6" fill="#0a0f1d" fillOpacity="0.45" />
      </g>
    </svg>
  );
}

function InfoRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 text-right">{children}</span>
    </div>
  );
}

/* ---------- Single gate card ---------- */
function GateCard({ title, sub, gate, busy, onOpen, onClose, onRelease, children }) {
  const isOpen = gate?.state === "OPEN";
  const override = Boolean(gate?.manualOverride);

  return (
    <div className={`${cardClass} p-5 flex flex-col gap-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full border text-[11px] font-bold tracking-wide ${
            isOpen
              ? "bg-[#064e3b]/60 border-emerald-700/60 text-emerald-300"
              : "bg-[#1a233d] border-[#232f4e] text-slate-300"
          }`}
        >
          {isOpen ? "OPEN" : "CLOSED"}
        </span>
      </div>

      <BarrierGlyph open={isOpen} />

      <div className="space-y-2 border-t border-dashed border-[#232f4e] pt-3">
        {children}
        <InfoRow label="Last triggered">
          <span className="font-mono">{formatClock(gate?.lastTriggered)}</span>
        </InfoRow>
        <InfoRow label="Control">
          {override ? (
            <span className="px-2 py-0.5 rounded bg-[#451a03] border border-amber-800/60 text-amber-300 text-[10px] font-semibold">
              MANUAL OVERRIDE
            </span>
          ) : (
            <span className="text-emerald-300">Automatic</span>
          )}
        </InfoRow>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-auto">
        <button
          onClick={onOpen}
          disabled={busy || isOpen}
          className="py-2 rounded-xl text-xs font-semibold bg-[#2563eb] hover:bg-[#3b82f6] text-white transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          Open
        </button>
        <button
          onClick={onClose}
          disabled={busy || !isOpen}
          className="py-2 rounded-xl text-xs font-semibold bg-[#1a233d] hover:bg-[#232f4e] border border-[#232f4e] text-slate-200 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          Close
        </button>
        {override && (
          <button
            onClick={onRelease}
            disabled={busy}
            className="col-span-2 py-2 rounded-xl text-xs font-semibold border border-amber-800/60 text-amber-300 hover:bg-[#451a03]/60 transition disabled:opacity-40 cursor-pointer"
          >
            Return to automatic
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const activeTab = TABS.some((t) => t.id === tab) ? tab : "camera";

  const [dbData, setDbData] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [actionError, setActionError] = useState("");
  const [busyGate, setBusyGate] = useState("");

  /* camera state */
  const [wantStream, setWantStream] = useState(true);
  const [streamStatus, setStreamStatus] = useState("connecting"); // connecting | live | error
  const [retryCount, setRetryCount] = useState(0);
  const [streamNonce, setStreamNonce] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState({ ip: "", port: "81", path: "/stream" });
  const [savingCfg, setSavingCfg] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const frameRef = useRef(null);

  /* ---------- Firebase ---------- */
  useEffect(() => {
    initializeDatabaseState();
    const unsubscribe = subscribeToParking((data) => setDbData(data));
    return () => unsubscribe();
  }, []);

  /* ---------- 1s clock (countdowns, overstay detection) ---------- */
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dataReady = dbData !== null;
  const groundSlots = dbData?.slots?.ground || {};
  const topSlots = dbData?.slots?.top || {};
  const gates = dbData?.gates || {};
  const control = dbData?.control || {};
  const rfidState = dbData?.rfid || {};
  const camera = dbData?.camera || {};

  const buzzerActive = Boolean(control.buzzer);
  const buzzerMode = control.buzzerMode || "OFF";

  /* ---------- Safe action wrapper ---------- */
  const safe = async (fn) => {
    try {
      setActionError("");
      await fn();
    } catch (err) {
      console.error(err);
      setActionError(err?.message || "Action failed");
    }
  };

  /* ---------- Camera ---------- */
  const camIp = camera.ip || "";
  const camPort = camera.port || 81;
  const camPath = camera.path || "/stream";
  const streamBase = camIp ? `http://${camIp}:${camPort}${camPath}` : "";
  const streamSrc = streamBase
    ? `${streamBase}${streamBase.includes("?") ? "&" : "?"}_=${streamNonce}`
    : "";
  const mixedContent =
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    streamBase.startsWith("http:");

  // New config -> restart connection attempts
  useEffect(() => {
    setStreamStatus("connecting");
    setRetryCount(0);
    setStreamNonce((n) => n + 1);
  }, [streamBase]);

  // Auto-reconnect with a retry cap
  useEffect(() => {
    if (streamStatus !== "error" || !wantStream || retryCount >= MAX_STREAM_RETRIES) return undefined;
    const timer = setTimeout(() => {
      setRetryCount((c) => c + 1);
      setStreamNonce((n) => n + 1);
      setStreamStatus("connecting");
    }, STREAM_RETRY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [streamStatus, wantStream, retryCount]);

  const retryNow = () => {
    setWantStream(true);
    setRetryCount(0);
    setStreamNonce((n) => n + 1);
    setStreamStatus("connecting");
  };

  const toggleStream = () => {
    if (wantStream) {
      setWantStream(false);
    } else {
      retryNow();
    }
  };

  // Fullscreen
  useEffect(() => {
    const onChange = () => setIsFs(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      frameRef.current?.requestFullscreen?.().catch(() => {});
    }
  };

  const openDrawer = () => {
    setDraft({ ip: camIp, port: String(camPort), path: camPath });
    setDrawerOpen((v) => !v);
  };

  const saveCamera = async () => {
    const port = Number(draft.port);
    if (!draft.ip.trim()) {
      setActionError("Enter the ESP32-CAM IP address.");
      return;
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setActionError("Port must be a number between 1 and 65535.");
      return;
    }
    setSavingCfg(true);
    await safe(() => updateCameraConfig(draft.ip, port, draft.path));
    setSavingCfg(false);
    setDrawerOpen(false);
  };

  const streamBadge = !wantStream
    ? { label: "DISCONNECTED", cls: "bg-[#1a233d] border-[#232f4e] text-slate-300", dot: "bg-slate-500" }
    : streamStatus === "live"
    ? { label: "LIVE", cls: "bg-[#064e3b]/70 border-emerald-700/60 text-emerald-300", dot: "bg-emerald-400" }
    : streamStatus === "connecting"
    ? { label: "CONNECTING", cls: "bg-[#451a03]/70 border-amber-800/60 text-amber-300", dot: "bg-amber-400" }
    : { label: "OFFLINE", cls: "bg-[#4c0519]/70 border-rose-800/70 text-rose-300", dot: "bg-rose-400" };

  /* ---------- Gates ---------- */
  const handleGate = async (gateKey, action) => {
    setBusyGate(gateKey);
    await safe(() =>
      action === "release" ? releaseGateOverride(gateKey) : toggleGate(gateKey, action)
    );
    setBusyGate("");
  };

  const groundTaken = GROUND_IDS.filter((id) => groundSlots[id]?.occupied).length;

  const exitGate = gates.exit || {};
  const exitTriggeredAt = normalizeTs(exitGate.lastTriggered);
  let exitTimerLabel = "Idle";
  if (exitGate.state === "OPEN") {
    if (exitGate.manualOverride) {
      exitTimerLabel = "Held open (manual)";
    } else if (exitTriggeredAt) {
      const left = EXIT_AUTO_CLOSE_MS - (now - exitTriggeredAt);
      exitTimerLabel = left > 0 ? `Closing in ${Math.ceil(left / 1000)}s` : "Awaiting close";
    } else {
      exitTimerLabel = "Open";
    }
  } else {
    exitTimerLabel = `Auto-close ${EXIT_AUTO_CLOSE_MS / 1000}s armed`;
  }

  const rfidStatus = String(rfidState.status || "IDLE").toUpperCase();
  const rfidTone = /GRANT|OK|AUTH|VALID|SUCCESS/.test(rfidStatus) && !/INVALID/.test(rfidStatus)
    ? "bg-[#064e3b]/60 border-emerald-700/60 text-emerald-300"
    : /DENY|DENIED|INVALID|UNKNOWN|FAIL|ERROR/.test(rfidStatus)
    ? "bg-[#4c0519]/60 border-rose-800/70 text-rose-300"
    : "bg-[#1a233d] border-[#232f4e] text-slate-300";

  /* ---------- Overstay tracking ---------- */
  const tracked = TOP_IDS.map((id) => ({ id, ...(topSlots[id] || {}) }))
    .filter((s) => s.reserved || s.occupied)
    .map((s) => {
      const hours = Number(s.durationHours ?? s.duration) || 1;
      const start = Number(s.reservedAt ?? s.bookedAt) || 0;
      const endsAt = start ? start + hours * HOUR_MS : null;
      const expired = endsAt !== null && now > endsAt;
      return {
        ...s,
        hours,
        elapsed: start ? now - start : null,
        remaining: endsAt !== null ? endsAt - now : null,
        expired,
        overstay: expired && Boolean(s.occupied),
      };
    });
  const overstayCount = tracked.filter((s) => s.overstay).length;

  const fireBuzzer = (mode, autoStopMs) =>
    safe(async () => {
      await toggleBuzzer(true, mode);
      if (autoStopMs) {
        setTimeout(() => {
          toggleBuzzer(false).catch(() => {});
        }, autoStopMs);
      }
    });

  const stats = [
    { label: "Ground free", value: `${GROUND_IDS.length - groundTaken}/${GROUND_IDS.length}`, tone: "text-emerald-300" },
    { label: "Top reserved", value: TOP_IDS.filter((id) => topSlots[id]?.reserved).length, tone: "text-amber-300" },
    { label: "Top occupied", value: TOP_IDS.filter((id) => topSlots[id]?.occupied).length, tone: "text-rose-300" },
    { label: "Overstays", value: overstayCount, tone: overstayCount ? "text-rose-400" : "text-slate-300" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-6">
      {/* ---------- Desktop top pills ---------- */}
      <nav className="hidden md:flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#11182c] border border-[#232f4e] w-fit">
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => navigate(`/admin/${id}`)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition ${
                active
                  ? "bg-[#2563eb] text-white shadow-[0_0_20px_-2px_rgba(59,130,246,0.6)]"
                  : "text-slate-400 hover:text-slate-100 hover:bg-[#1a233d]"
              }`}
            >
              <span className="scale-90">
                <Icon />
              </span>
              {label}
              {id === "overstay" && overstayCount > 0 && (
                <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {overstayCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {actionError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 text-xs text-rose-300 bg-[#4c0519]/60 border border-rose-800/70 rounded-xl px-3.5 py-2.5"
        >
          <span>{actionError}</span>
          <button onClick={() => setActionError("")} className="text-rose-300 hover:text-white cursor-pointer" aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {!dataReady && (
        <div className="text-center py-16 text-slate-500 text-sm animate-pulse">Syncing live parking data...</div>
      )}

      {/* ---------- Surveillance ---------- */}
      {dataReady && activeTab === "camera" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className={`${cardClass} p-4 sm:p-5 lg:col-span-2 space-y-4`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">ESP32-CAM Feed</h2>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5 break-all">
                  {streamBase || "No camera configured"}
                </p>
              </div>
              <span
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold tracking-wide whitespace-nowrap ${streamBadge.cls}`}
              >
                <span className="relative flex h-2 w-2">
                  {streamBadge.label === "LIVE" && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${streamBadge.dot}`} />
                </span>
                {streamBadge.label}
              </span>
            </div>

            {/* Player frame */}
            <div
              ref={frameRef}
              className={`relative bg-[#05080f] overflow-hidden ${
                isFs ? "" : "aspect-video rounded-xl border border-[#232f4e]"
              }`}
            >
              {wantStream && streamSrc && (
                <img
                  key={streamNonce}
                  src={streamSrc}
                  alt="ESP32 CAM stream"
                  className={`absolute inset-0 w-full h-full object-contain ${
                    streamStatus === "live" ? "opacity-100" : "opacity-0"
                  }`}
                  onLoad={() => {
                    setStreamStatus("live");
                    setRetryCount(0);
                  }}
                  onError={() => setStreamStatus("error")}
                />
              )}

              {(!wantStream || streamStatus !== "live" || !streamSrc) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
                  <p className="text-xs text-slate-400">
                    {!streamSrc
                      ? "No camera IP configured. Open the settings drawer to add one."
                      : !wantStream
                      ? "Stream disconnected."
                      : streamStatus === "connecting"
                      ? retryCount > 0
                        ? `Reconnecting... (attempt ${retryCount}/${MAX_STREAM_RETRIES})`
                        : "Connecting to camera..."
                      : retryCount >= MAX_STREAM_RETRIES
                      ? "Camera unreachable. Auto-reconnect stopped."
                      : `Stream lost. Retrying in ${STREAM_RETRY_DELAY_MS / 1000}s...`}
                  </p>
                  {streamSrc && (!wantStream || retryCount >= MAX_STREAM_RETRIES) && (
                    <button
                      onClick={retryNow}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#2563eb] hover:bg-[#3b82f6] text-white transition cursor-pointer"
                    >
                      Reconnect
                    </button>
                  )}
                </div>
              )}

              <button
                onClick={toggleFullscreen}
                className="absolute bottom-3 right-3 h-8 w-8 flex items-center justify-center rounded-lg bg-[#0a0f1d]/70 backdrop-blur border border-[#232f4e] text-slate-200 hover:text-white hover:bg-[#1a233d] transition cursor-pointer"
                aria-label={isFs ? "Exit fullscreen" : "Enter fullscreen"}
              >
                <FullscreenIcon exit={isFs} />
              </button>
            </div>

            {mixedContent && (
              <p className="text-[11px] text-amber-300 bg-[#451a03]/50 border border-amber-800/60 rounded-lg px-3 py-2">
                This page is served over HTTPS but the camera stream is plain HTTP, so browsers will block it.
                Open the dashboard over HTTP (local network) or proxy the stream through HTTPS.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                onClick={toggleStream}
                className="px-4 py-2 bg-[#1a233d] hover:bg-[#232f4e] border border-[#232f4e] text-slate-100 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                {wantStream ? "Disconnect" : "Connect"}
              </button>
              <button
                onClick={openDrawer}
                className="px-4 py-2 bg-[#1a233d] hover:bg-[#232f4e] border border-[#232f4e] text-slate-100 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                {drawerOpen ? "Close settings" : "Camera settings"}
              </button>
            </div>
          </div>

          {/* IP config drawer / side panel */}
          <div className="space-y-5">
            {drawerOpen ? (
              <div className={`${cardClass} p-5 space-y-3`}>
                <h3 className="text-sm font-semibold text-white">Camera Configuration</h3>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">IP address</label>
                  <input
                    className={inputClass}
                    value={draft.ip}
                    onChange={(e) => setDraft({ ...draft, ip: e.target.value })}
                    placeholder="192.168.1.100"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="block text-[11px] text-slate-400 mb-1">Port</label>
                    <input
                      className={inputClass}
                      value={draft.port}
                      onChange={(e) => setDraft({ ...draft, port: e.target.value })}
                      placeholder="81"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">Path</label>
                    <input
                      className={inputClass}
                      value={draft.path}
                      onChange={(e) => setDraft({ ...draft, path: e.target.value })}
                      placeholder="/stream"
                    />
                  </div>
                </div>
                <button
                  onClick={saveCamera}
                  disabled={savingCfg}
                  className="w-full py-2 bg-[#2563eb] hover:bg-[#3b82f6] text-white text-xs font-bold rounded-xl transition disabled:opacity-50 cursor-pointer"
                >
                  {savingCfg ? "Saving..." : "Save & Reconnect"}
                </button>
              </div>
            ) : (
              <div className={`${cardClass} p-5 space-y-2.5`}>
                <h3 className="text-sm font-semibold text-white mb-1">Stream Details</h3>
                <InfoRow label="IP">
                  <span className="font-mono">{camIp || "—"}</span>
                </InfoRow>
                <InfoRow label="Port">
                  <span className="font-mono">{camPort}</span>
                </InfoRow>
                <InfoRow label="Path">
                  <span className="font-mono">{camPath}</span>
                </InfoRow>
              </div>
            )}

            <div className={`${cardClass} p-5 space-y-2.5`}>
              <h3 className="text-sm font-semibold text-white mb-1">Last RFID Scan</h3>
              <InfoRow label="Plate">
                <span className="font-mono">{rfidState.lastScannedPlate || "—"}</span>
              </InfoRow>
              <InfoRow label="UID">
                <span className="font-mono">{rfidState.lastScannedUid || "—"}</span>
              </InfoRow>
              <InfoRow label="Time">
                <span className="font-mono">{formatClock(rfidState.timestamp)}</span>
              </InfoRow>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Gate Controls ---------- */}
      {dataReady && activeTab === "gates" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {GATES.map(({ key, title, sub }) => (
            <GateCard
              key={key}
              title={title}
              sub={sub}
              gate={gates[key]}
              busy={busyGate === key}
              onOpen={() => handleGate(key, "OPEN")}
              onClose={() => handleGate(key, "CLOSED")}
              onRelease={() => handleGate(key, "release")}
            >
              {key === "entry" && (
                <InfoRow label="Bay IR sensors">
                  <span className="font-mono">
                    {groundTaken}/{GROUND_IDS.length} ground bays occupied
                  </span>
                </InfoRow>
              )}
              {key === "exit" && <InfoRow label="Auto-close timer">{exitTimerLabel}</InfoRow>}
              {key === "reserved" && (
                <>
                  <InfoRow label="RFID authorization">
                    <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${rfidTone}`}>
                      {rfidStatus}
                    </span>
                  </InfoRow>
                  <InfoRow label="Last UID">
                    <span className="font-mono">{rfidState.lastScannedUid || "—"}</span>
                  </InfoRow>
                </>
              )}
            </GateCard>
          ))}
        </div>
      )}

      {/* ---------- Overstay & Alarms ---------- */}
      {dataReady && activeTab === "overstay" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Buzzer console */}
          <div className={`${cardClass} p-5 space-y-4 lg:col-span-2 self-start`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Buzzer & Alarm Console</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Drives the buzzer on the ESP32 via Firebase</p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full border text-[11px] font-bold ${
                  buzzerActive
                    ? "bg-[#4c0519]/70 border-rose-800/70 text-rose-300 animate-pulse"
                    : "bg-[#1a233d] border-[#232f4e] text-slate-300"
                }`}
              >
                {buzzerActive ? `ACTIVE · ${buzzerMode}` : "SILENT"}
              </span>
            </div>

            <button
              onClick={() => (buzzerActive ? safe(() => toggleBuzzer(false)) : fireBuzzer("ON"))}
              className={`w-full py-3.5 rounded-xl text-sm font-extrabold tracking-wide transition cursor-pointer ${
                buzzerActive
                  ? "bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_28px_-4px_rgba(244,63,94,0.8)]"
                  : "bg-[#4c0519]/60 hover:bg-[#4c0519] border border-rose-800 text-rose-200"
              }`}
            >
              {buzzerActive ? "STOP BUZZER" : "EMERGENCY TRIGGER"}
            </button>

            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
                Pattern simulator
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-2">
                <button
                  onClick={() => fireBuzzer("SUCCESS", 800)}
                  className="py-2 px-2 rounded-xl text-[11px] font-semibold bg-[#064e3b]/50 hover:bg-[#064e3b] border border-emerald-800/60 text-emerald-300 transition cursor-pointer"
                >
                  Valid RFID chirp
                </button>
                <button
                  onClick={() => fireBuzzer("ERROR", 1500)}
                  className="py-2 px-2 rounded-xl text-[11px] font-semibold bg-[#451a03]/50 hover:bg-[#451a03] border border-amber-800/60 text-amber-300 transition cursor-pointer"
                >
                  Invalid RFID beep
                </button>
                <button
                  onClick={() => fireBuzzer("OVERSTAY")}
                  className="py-2 px-2 rounded-xl text-[11px] font-semibold bg-[#4c0519]/50 hover:bg-[#4c0519] border border-rose-800/60 text-rose-300 transition cursor-pointer"
                >
                  Overstay siren
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-2">
                Chirp and beep switch themselves off after a moment. The siren runs until you press Stop.
              </p>
            </div>
          </div>

          {/* Overstay tracker */}
          <div className={`${cardClass} p-5 lg:col-span-3`}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Overstay Tracker</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Reserved bays, live from the IR sensors</p>
              </div>
              {overstayCount > 0 && (
                <button
                  onClick={() => fireBuzzer("OVERSTAY")}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer"
                >
                  Sound siren ({overstayCount})
                </button>
              )}
            </div>

            {tracked.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-500 border border-dashed border-[#232f4e] rounded-xl">
                No reserved or occupied top floor bays right now.
              </div>
            ) : (
              <div className="space-y-2.5">
                {tracked.map((s) => (
                  <div
                    key={s.id}
                    className={`p-3.5 rounded-xl border text-xs ${
                      s.overstay
                        ? "bg-[#4c0519]/40 border-rose-700/70 shadow-[0_0_20px_-8px_rgba(244,63,94,0.8)]"
                        : "bg-[#1a233d]/60 border-[#232f4e]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-bold text-white text-sm font-mono">{s.id}</span>
                        <span className="font-mono text-slate-300 truncate">{s.plate || "Unreserved"}</span>
                      </div>
                      {s.overstay ? (
                        <span className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-bold animate-pulse">
                          OVERSTAY
                        </span>
                      ) : s.expired ? (
                        <span className="px-2 py-0.5 rounded bg-[#451a03] border border-amber-800/60 text-amber-300 text-[10px] font-semibold">
                          EXPIRED · EMPTY
                        </span>
                      ) : s.occupied ? (
                        <span className="px-2 py-0.5 rounded bg-[#4c0519]/70 border border-rose-800/70 text-rose-300 text-[10px] font-semibold">
                          PARKED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-[#451a03]/70 border border-amber-800/60 text-amber-300 text-[10px] font-semibold">
                          RESERVED
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 mt-3 text-[11px]">
                      <div>
                        <span className="block text-slate-500">RFID</span>
                        <span className="font-mono text-slate-200 break-all">{s.rfid || "—"}</span>
                      </div>
                      <div>
                        <span className="block text-slate-500">Elapsed</span>
                        <span className="font-mono text-slate-200">
                          {s.elapsed !== null ? formatHMS(s.elapsed) : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="block text-slate-500">Reserved for</span>
                        <span className="font-mono text-slate-200">
                          {s.reserved ? `${s.hours}h` : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="block text-slate-500">{s.expired ? "Over by" : "Remaining"}</span>
                        <span className={`font-mono font-semibold ${s.overstay ? "text-rose-400" : "text-slate-200"}`}>
                          {s.remaining !== null ? formatHMS(Math.abs(s.remaining)) : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- Slots Overview ---------- */}
      {dataReady && activeTab === "slots" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((st) => (
              <div key={st.label} className={`${cardClass} p-4`}>
                <span className="block text-[11px] uppercase tracking-wider text-slate-500">{st.label}</span>
                <span className={`block text-2xl font-bold font-mono mt-1 ${st.tone}`}>{st.value}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section>
              <h2 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">
                Ground Floor — General Parking
              </h2>
              <div className="grid grid-cols-3 gap-3">
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
              <h2 className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-3">
                Top Floor — Reserved Parking
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {TOP_IDS.map((id) => {
                  const s = topSlots[id];
                  return (
                    <SlotTile
                      key={id}
                      id={id}
                      floor="top"
                      status={s?.occupied ? "occupied" : s?.reserved ? "reserved" : "vacant"}
                      plate={s?.plate}
                    />
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ---------- Mobile bottom navigation ---------- */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-[#232f4e] bg-[#0a0f1d]/85 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]"
        aria-label="Admin"
      >
        <div className="grid grid-cols-4 max-w-md mx-auto">
          {TABS.map(({ id, short, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => navigate(`/admin/${id}`)}
                className={`relative flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-medium transition cursor-pointer ${
                  active ? "text-[#60a5fa]" : "text-slate-500"
                }`}
              >
                {active && (
                  <span className="absolute top-0 h-0.5 w-8 rounded-full bg-[#3b82f6] shadow-[0_0_12px_2px_rgba(59,130,246,0.8)]" />
                )}
                <span className="relative">
                  <Icon />
                  {id === "overstay" && overstayCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-[#0a0f1d]">
                      {overstayCount}
                    </span>
                  )}
                </span>
                {short}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}