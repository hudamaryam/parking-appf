import React from "react";

const SLOTS = ["R1", "R2", "R3", "R4"];
const slotX = (i) => 30 + i * 70;

/**
 * Directional map from the ramp to a reserved top-floor bay.
 * Accepts `targetSlot` (what CustomerDashboard passes) or the older `slot` prop.
 */
export default function RouteMap({ targetSlot, slot }) {
  const wanted = targetSlot || slot;
  const target = SLOTS.indexOf(wanted);
  const targetCenter = target >= 0 ? slotX(target) + 28 : 0;

  return (
    <svg
      viewBox="0 0 320 190"
      className="w-full"
      role="img"
      aria-label={target >= 0 ? `Route from the ramp to bay ${wanted}` : "Top floor map"}
    >
      <rect x="4" y="4" width="312" height="182" rx="14" fill="#0a0f1d" stroke="#232f4e" />

      {SLOTS.map((s, i) => {
        const isTarget = i === target;
        return (
          <g key={s}>
            <rect
              x={slotX(i)}
              y="20"
              width="56"
              height="50"
              rx="8"
              fill={isTarget ? "#2563eb" : "#1a233d"}
              stroke={isTarget ? "#60a5fa" : "#232f4e"}
              strokeWidth={isTarget ? 2 : 1}
            />
            <text
              x={slotX(i) + 28}
              y="50"
              textAnchor="middle"
              fill="#f1f5f9"
              fontSize="13"
              fontWeight="700"
              fontFamily="ui-monospace, 'JetBrains Mono', monospace"
            >
              {s}
            </text>
          </g>
        );
      })}

      <rect x="30" y="90" width="260" height="30" rx="6" fill="#11182c" stroke="#232f4e" />
      <text x="160" y="109" textAnchor="middle" fill="#64748b" fontSize="11">
        Driveway
      </text>

      <rect x="30" y="145" width="70" height="30" rx="8" fill="#1a233d" stroke="#3b82f6" />
      <text x="65" y="164" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="600">
        Ramp up
      </text>

      {target >= 0 && (
        <>
          <path
            d={`M65 145 V105 H${targetCenter} V74`}
            fill="none"
            stroke="#60a5fa"
            strokeWidth="3"
            strokeDasharray="6 5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* arrow head at the bay */}
          <path d={`M${targetCenter - 5} 80 L${targetCenter} 72 L${targetCenter + 5} 80`} fill="none" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="65" cy="145" r="4" fill="#3b82f6" />
        </>
      )}
    </svg>
  );
}