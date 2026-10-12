import { ref, onValue, update, get, set, runTransaction } from "firebase/database";
import { rtdb } from "../config/firebase";

/**
 * Root node of the Slotify tree.
 * "" = database root (matches the redesign spec schema).
 * Your old code used "slotify" -- if your ESP32/STM32 firmware still writes
 * under /slotify, set this to "slotify".
 */
const ROOT = "";

const dbRef = (path = "") => {
  const full = [ROOT, path].filter(Boolean).join("/");
  return full ? ref(rtdb, full) : ref(rtdb);
};

const VALID_GATES = ["entry", "exit", "reserved"];
const VALID_GATE_STATES = ["OPEN", "CLOSED"];
const VALID_BUZZER_MODES = ["OFF", "ON", "SUCCESS", "ERROR", "OVERSTAY"];

const vacantTopSlot = () => ({
  occupied: false,
  reserved: false,
  plate: "",
  rfid: "",
  reservedAt: 0,
  durationHours: 1,
});

const defaultGate = () => ({
  state: "CLOSED",
  lastTriggered: 0,
  manualOverride: false,
});

export const initialParkingData = {
  slots: {
    ground: {
      G1: { occupied: false },
      G2: { occupied: false },
      G3: { occupied: false },
    },
    top: {
      R1: vacantTopSlot(),
      R2: vacantTopSlot(),
      R3: vacantTopSlot(),
      R4: vacantTopSlot(),
    },
  },
  gates: {
    entry: defaultGate(),
    exit: defaultGate(),
    reserved: defaultGate(),
  },
  control: {
    buzzer: false,
    buzzerMode: "OFF",
  },
  camera: {
    ip: "192.168.1.100",
    port: 81,
    path: "/stream",
  },
  rfid: {
    lastScannedPlate: "",
    lastScannedUid: "",
    checkoutSlot: "",
    status: "IDLE",
    timestamp: 0,
  },
};

/**
 * Creates the full tree if the DB is empty. If the tree exists, only fills in
 * missing pieces (e.g. a missing slot or gate) without touching existing values.
 */
export const initializeDatabaseState = async () => {
  try {
    const snapshot = await get(dbRef());
    if (!snapshot.exists()) {
      await set(dbRef(), initialParkingData);
      return;
    }

    const current = snapshot.val() || {};
    const missing = {};

    Object.keys(initialParkingData.slots.ground).forEach((id) => {
      if (!current?.slots?.ground?.[id]) {
        missing[`slots/ground/${id}`] = initialParkingData.slots.ground[id];
      }
    });
    Object.keys(initialParkingData.slots.top).forEach((id) => {
      if (!current?.slots?.top?.[id]) {
        missing[`slots/top/${id}`] = initialParkingData.slots.top[id];
      }
    });
    Object.keys(initialParkingData.gates).forEach((g) => {
      if (!current?.gates?.[g]) missing[`gates/${g}`] = initialParkingData.gates[g];
    });
    ["control", "camera", "rfid"].forEach((k) => {
      if (!current?.[k]) missing[k] = initialParkingData[k];
    });

    if (Object.keys(missing).length > 0) {
      await update(dbRef(), missing);
    }
  } catch (err) {
    console.warn("Database initialization skipped:", err);
  }
};

/** Real-time listener on the root node. Returns the unsubscribe function. */
export const subscribeToParking = (callback) => {
  return onValue(
    dbRef(),
    (snapshot) => {
      callback(snapshot.val() || initialParkingData);
    },
    (error) => {
      console.error("Parking subscription error:", error);
    }
  );
};

/**
 * Atomically reserves a top-floor bay. Uses a transaction so two users
 * can't book the same bay at the same time.
 * Throws if the bay is already reserved/occupied or the slot ID is invalid.
 */
export const reserveSlot = async (slotId, plate, rfid, durationHours) => {
  if (!Object.keys(initialParkingData.slots.top).includes(slotId)) {
    throw new Error(`Invalid reserved bay: ${slotId}`);
  }

  const result = await runTransaction(dbRef(`slots/top/${slotId}`), (slot) => {
    if (slot && (slot.reserved || slot.occupied)) {
      return; // abort -- bay is taken
    }
    return {
      ...(slot || {}),
      occupied: slot?.occupied || false,
      reserved: true,
      plate: String(plate || "").trim().toUpperCase(),
      rfid: String(rfid || "").trim().toUpperCase(),
      reservedAt: Date.now(),
      durationHours: Number(durationHours) || 1,
    };
  });

  if (!result.committed) {
    throw new Error(`Bay ${slotId} is no longer available`);
  }
  return result;
};

/** Resets a top-floor bay to its default vacant state. */
export const checkoutSlot = async (slotId) => {
  return update(dbRef(`slots/top/${slotId}`), vacantTopSlot());
};

/**
 * Manual gate control. targetState: "OPEN" | "CLOSED".
 * Sets manualOverride: true so firmware knows this was a dashboard command.
 */
export const toggleGate = async (gateName, targetState) => {
  if (!VALID_GATES.includes(gateName)) {
    throw new Error(`Invalid gate: ${gateName}`);
  }
  if (!VALID_GATE_STATES.includes(targetState)) {
    throw new Error(`Invalid gate state: ${targetState}`);
  }
  return update(dbRef(`gates/${gateName}`), {
    state: targetState,
    manualOverride: true,
    lastTriggered: Date.now(),
  });
};

/** Hands a gate back to automatic (sensor/RFID) control. */
export const releaseGateOverride = async (gateName) => {
  if (!VALID_GATES.includes(gateName)) {
    throw new Error(`Invalid gate: ${gateName}`);
  }
  return update(dbRef(`gates/${gateName}`), { manualOverride: false });
};

/**
 * Buzzer control.
 * active: boolean. mode (optional): "SUCCESS" | "ERROR" | "OVERSTAY" | "ON".
 * When active is false the mode is forced to "OFF".
 */
export const toggleBuzzer = async (active, mode) => {
  const nextMode = active
    ? VALID_BUZZER_MODES.includes(mode) && mode !== "OFF"
      ? mode
      : "ON"
    : "OFF";
  return update(dbRef("control"), {
    buzzer: Boolean(active),
    buzzerMode: nextMode,
  });
};

/** Updates ESP32-CAM stream configuration. */
export const updateCameraConfig = async (ip, port, path) => {
  const cleanPath = String(path || "/stream").trim();
  return update(dbRef("camera"), {
    ip: String(ip || "").trim(),
    port: Number(port) || 81,
    path: cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`,
  });
};