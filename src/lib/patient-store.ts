"use client";

import { create } from "zustand";

/**
 * Local-first patient + prescription store.
 *
 * EVERYTHING is created offline in localStorage first — patients, prescription
 * days, and drug items. Nothing hits the network until the pharmacist taps
 * "Sync to Database". This makes the entire prescription workflow instant and
 * offline-capable.
 *
 * Data model (local):
 *   LocalPatient
 *     └─ LocalDay[] (one per day = one prescription)
 *          └─ LocalItem[] (drug lines with snapshot of name + price)
 *
 * When synced:
 *   1. Patient is POSTed to /api/patients → gets a server id.
 *   2. Each day is POSTed to /api/patients/{id}/prescriptions.
 *   3. Each item is POSTed to /api/prescriptions/{id}/items.
 *   4. Local ids are mapped to server ids; the patient is marked synced.
 */

export interface LocalItem {
  id: string;
  drugId: string;
  drugName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface LocalDay {
  id: string;
  date: string; // ISO date (the prescription date)
  notes: string;
  items: LocalItem[];
  dayInvoice: number;
  synced: boolean;
}

export interface LocalPatient {
  id: string;
  patientRef: string;
  name: string;
  floor: string;
  admissionDate: string;
  roomNumber: string;
  status: string;
  synced: boolean;
  days: LocalDay[];
  daysCount: number;
  totalInvoice: number;
}

interface PatientStoreState {
  patients: LocalPatient[];
  hydrated: boolean;
  loadLocal: (floor: string) => void;
  mergeServer: (floor: string, server: LocalPatient[]) => void;
  createLocal: (data: {
    name: string;
    patientRef: string;
    floor: string;
    roomNumber: string;
  }) => LocalPatient;
  getPatient: (id: string) => LocalPatient | undefined;
  promoteToServer: (localId: string, serverId: string) => void;
  addDay: (patientId: string, date: string) => LocalDay;
  addItem: (patientId: string, dayId: string, item: Omit<LocalItem, "id" | "lineTotal">) => void;
  removeItem: (patientId: string, dayId: string, itemId: string) => void;
  removeDay: (patientId: string, dayId: string) => void;
  markDaySynced: (patientId: string, dayId: string, serverDayId: string) => void;
  removePatient: (id: string) => void;
  /** Upsert a full patient (with days + items) into the local store + persist. */
  upsertFull: (patient: LocalPatient) => void;
}

const CACHE_PREFIX = "mediprice-patients-v3-";

function cacheKey(floor: string) {
  return `${CACHE_PREFIX}${floor}`;
}

function loadFromStorage(floor: string): LocalPatient[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(cacheKey(floor));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as LocalPatient[];
  } catch {
    return [];
  }
}

function saveToStorage(floor: string, patients: LocalPatient[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(cacheKey(floor), JSON.stringify(patients));
  } catch {
    /* ignore quota */
  }
}

let counter = 0;
function newLocalId(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

function recomputeStats(patient: LocalPatient): LocalPatient {
  const daysCount = patient.days.length;
  const totalInvoice = patient.days.reduce(
    (s, d) => s + d.items.reduce((ss, it) => ss + it.lineTotal, 0),
    0
  );
  return { ...patient, daysCount, totalInvoice };
}

export const usePatientStore = create<PatientStoreState>()((set, get) => ({
  patients: [],
  hydrated: false,

  loadLocal: (floor) => {
    const local = loadFromStorage(floor);
    set({ patients: local, hydrated: true });
  },

  mergeServer: (floor, server) => {
    // Always use the fresh server summary (days: []) for synced patients.
    // The patient detail page will fetch full day details from the server
    // when the patient is opened. This ensures every pharmacist on the
    // same floor sees the latest prescriptions — no stale localStorage days.
    const local = loadFromStorage(floor);
    // Keep only local (unsynced) patients that aren't on the server yet.
    const localOnly = local.filter(
      (l) => l.synced === false && !server.some((s) => s.id === l.id)
    );
    const merged = [...localOnly, ...server];
    set({ patients: merged, hydrated: true });
    saveToStorage(floor, merged);
  },

  createLocal: (data) => {
    const patient: LocalPatient = {
      id: newLocalId("patient"),
      patientRef: data.patientRef,
      name: data.name,
      floor: data.floor,
      admissionDate: new Date().toISOString(),
      roomNumber: data.roomNumber,
      status: "active",
      synced: false,
      days: [],
      daysCount: 0,
      totalInvoice: 0,
    };
    set((state) => {
      const next = [patient, ...state.patients];
      saveToStorage(patient.floor, next);
      return { patients: next };
    });
    return patient;
  },

  getPatient: (id) => get().patients.find((p) => p.id === id),

  promoteToServer: (localId, serverId) => {
    set((state) => {
      const next = state.patients.map((p) =>
        p.id === localId ? { ...p, id: serverId, synced: true } : p
      );
      const patient = next.find((p) => p.id === serverId);
      if (patient) saveToStorage(patient.floor, next);
      return { patients: next };
    });
  },

  addDay: (patientId, date) => {
    const day: LocalDay = {
      id: newLocalId("day"),
      date: new Date(date).toISOString(),
      notes: "",
      items: [],
      dayInvoice: 0,
      synced: false,
    };
    set((state) => {
      const next = state.patients.map((p) => {
        if (p.id !== patientId) return p;
        const updated = { ...p, days: [...p.days, day] };
        return recomputeStats(updated);
      });
      const patient = next.find((p) => p.id === patientId);
      if (patient) saveToStorage(patient.floor, next);
      return { patients: next };
    });
    return day;
  },

  addItem: (patientId, dayId, item) => {
    set((state) => {
      const next = state.patients.map((p) => {
        if (p.id !== patientId) return p;
        const days = p.days.map((d) => {
          if (d.id !== dayId) return d;
          const lineTotal = item.quantity * item.unitPrice;
          const newItem: LocalItem = {
            ...item,
            id: newLocalId("item"),
            lineTotal,
          };
          const items = [...d.items, newItem];
          const dayInvoice = items.reduce((s, it) => s + it.lineTotal, 0);
          return { ...d, items, dayInvoice };
        });
        return recomputeStats({ ...p, days });
      });
      const patient = next.find((p) => p.id === patientId);
      if (patient) saveToStorage(patient.floor, next);
      return { patients: next };
    });
  },

  removeItem: (patientId, dayId, itemId) => {
    set((state) => {
      const next = state.patients.map((p) => {
        if (p.id !== patientId) return p;
        const days = p.days.map((d) => {
          if (d.id !== dayId) return d;
          const items = d.items.filter((it) => it.id !== itemId);
          const dayInvoice = items.reduce((s, it) => s + it.lineTotal, 0);
          return { ...d, items, dayInvoice };
        });
        return recomputeStats({ ...p, days });
      });
      const patient = next.find((p) => p.id === patientId);
      if (patient) saveToStorage(patient.floor, next);
      return { patients: next };
    });
  },

  removeDay: (patientId, dayId) => {
    set((state) => {
      const next = state.patients.map((p) => {
        if (p.id !== patientId) return p;
        const days = p.days.filter((d) => d.id !== dayId);
        return recomputeStats({ ...p, days });
      });
      const patient = next.find((p) => p.id === patientId);
      if (patient) saveToStorage(patient.floor, next);
      return { patients: next };
    });
  },

  markDaySynced: (patientId, dayId, serverDayId) => {
    set((state) => {
      const next = state.patients.map((p) => {
        if (p.id !== patientId) return p;
        const days = p.days.map((d) =>
          d.id === dayId ? { ...d, id: serverDayId, synced: true } : d
        );
        return { ...p, days };
      });
      const patient = next.find((p) => p.id === patientId);
      if (patient) saveToStorage(patient.floor, next);
      return { patients: next };
    });
  },

  removePatient: (id) => {
    set((state) => {
      const patient = state.patients.find((p) => p.id === id);
      const next = state.patients.filter((p) => p.id !== id);
      if (patient) saveToStorage(patient.floor, next);
      return { patients: next };
    });
  },

  upsertFull: (patient) => {
    set((state) => {
      const exists = state.patients.some((p) => p.id === patient.id);
      const next = exists
        ? state.patients.map((p) => (p.id === patient.id ? patient : p))
        : [patient, ...state.patients];
      saveToStorage(patient.floor, next);
      return { patients: next };
    });
  },
}));
