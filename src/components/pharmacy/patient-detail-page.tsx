"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bed,
  Calendar,
  Plus,
  Trash2,
  Receipt,
  Pill,
  Search,
  X,
  ChevronDown,
  Loader2,
  Copy,
  FileText,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatIQD } from "@/lib/format";
import type { Drug } from "@/lib/drug-data";
import { cn } from "@/lib/utils";
import {
  usePatientStore,
  type LocalPatient,
} from "@/lib/patient-store";
import { PrescriptionMatrix } from "./prescription-matrix";

interface PatientDetailPageProps {
  patientId: string;
  drugs: Drug[];
  onBack: () => void;
  onShowSummary: (patientId: string) => void;
  onPatientSynced: (oldId: string, newId: string) => void;
}

// Distinct gradient color schemes per day index (cycles through 6 palettes).
const DAY_GRADIENTS = [
  {
    badge: "from-teal-500 to-cyan-500",
    addBtn: "border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:border-teal-800 dark:bg-teal-950/30 dark:text-teal-300",
    total: "from-teal-50 to-cyan-50 border-teal-200 dark:from-teal-950/30 dark:to-cyan-950/30 dark:border-teal-900",
  },
  {
    badge: "from-violet-500 to-purple-500",
    addBtn: "border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-300",
    total: "from-violet-50 to-purple-50 border-violet-200 dark:from-violet-950/30 dark:to-purple-950/30 dark:border-violet-900",
  },
  {
    badge: "from-amber-500 to-orange-500",
    addBtn: "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
    total: "from-amber-50 to-orange-50 border-amber-200 dark:from-amber-950/30 dark:to-orange-950/30 dark:border-amber-900",
  },
  {
    badge: "from-emerald-500 to-green-500",
    addBtn: "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
    total: "from-emerald-50 to-green-50 border-emerald-200 dark:from-emerald-950/30 dark:to-green-950/30 dark:border-emerald-900",
  },
  {
    badge: "from-rose-500 to-pink-500",
    addBtn: "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300",
    total: "from-rose-50 to-pink-50 border-rose-200 dark:from-rose-950/30 dark:to-pink-950/30 dark:border-rose-900",
  },
  {
    badge: "from-sky-500 to-blue-500",
    addBtn: "border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300",
    total: "from-sky-50 to-blue-50 border-sky-200 dark:from-sky-950/30 dark:to-blue-950/30 dark:border-sky-900",
  },
];

export function PatientDetailPage({
  patientId,
  drugs,
  onBack,
  onShowSummary,
  onPatientSynced,
}: PatientDetailPageProps) {
  const { toast } = useToast();
  const patients = usePatientStore((s) => s.patients);
  const removeDay = usePatientStore((s) => s.removeDay);

  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [addPrescOpen, setAddPrescOpen] = useState(false);
  const [newPrescDate, setNewPrescDate] = useState(new Date().toISOString().slice(0, 10));
  const [drugSearchOpen, setDrugSearchOpen] = useState(false);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [matrixTargetDayId, setMatrixTargetDayId] = useState<string | null>(null);

  // The patient from the store (local-first). For synced patients, this is
  // loaded from the server and merged into the store on the patients page.
  const patient = patients.find((p) => p.id === patientId) as LocalPatient | undefined;

  // If the patient is not in the store OR is synced but has no days loaded
  // (the patients list only sends summary stats, not full day details), fetch
  // the full detail from the server.
  const [serverPatient, setServerPatient] = useState<LocalPatient | null>(null);
  const [loadingServer, setLoadingServer] = useState(false);

  // Always fetch fresh data from the server for synced patients — this
  // ensures prescriptions created by OTHER pharmacists on the same floor
  // are visible. Local (unsynced) patients don't need a server fetch.
  const upsertFull = usePatientStore((s) => s.upsertFull);
  const isLocalPatient = patientId.startsWith("patient-") || patientId.startsWith("local-");
  const needsServerFetch = !isLocalPatient;

  useEffect(() => {
    if (needsServerFetch && patientId && !patientId.startsWith("patient-") && !patientId.startsWith("local-")) {
      let cancelled = false;
      setLoadingServer(true);
      (async () => {
        try {
          const res = await fetch(`/api/patients/${patientId}`, { cache: "no-store" });
          const data = await res.json();
          if (!cancelled && data.patient) {
            const full: LocalPatient = {
              id: data.patient.id,
              patientRef: data.patient.patientRef ?? "",
              name: data.patient.name,
              floor: data.patient.floor,
              admissionDate: data.patient.admissionDate,
              roomNumber: data.patient.roomNumber ?? "",
              status: data.patient.status,
              synced: true,
              days: (data.patient.days ?? []).map((d: Record<string, unknown>) => ({
                id: d.id as string,
                date: d.date as string,
                notes: (d.notes as string) ?? "",
                items: ((d.items as Array<Record<string, unknown>>) ?? []).map((it) => ({
                  id: it.id as string,
                  drugId: it.drugId as string,
                  drugName: it.drugName as string,
                  quantity: it.quantity as number,
                  unitPrice: it.unitPrice as number,
                  lineTotal: it.lineTotal as number,
                })),
                dayInvoice: d.dayInvoice as number,
                synced: true,
              })),
              daysCount: data.patient.daysCount ?? 0,
              totalInvoice: data.patient.totalInvoice ?? 0,
            };
            if (!cancelled) {
              setServerPatient(full);
              setLoadingServer(false);
            }
          }
        } catch {
          /* ignore */
        } finally {
          if (!cancelled) setLoadingServer(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }
  }, [patientId]);

  // Prefer the serverPatient (fresh from server) when it has days — this
  // ensures other pharmacists' prescriptions are visible. Fall back to the
  // store patient (which may have stale days from a previous session).
  const effectivePatient =
    (serverPatient && serverPatient.days.length > 0 ? serverPatient : null) ??
    patient ??
    serverPatient ??
    null;

  // Auto-expand the last day.
  useEffect(() => {
    if (effectivePatient?.days?.length) {
      setExpandedDay(effectivePatient.days[effectivePatient.days.length - 1].id);
    }
  }, [effectivePatient?.id, effectivePatient?.days?.length]);

  async function handleAddPrescription(e: React.FormEvent) {
    e.preventDefault();
    if (!effectivePatient) return;
    setSyncing(true);
    try {
      const res = await fetch(`/api/patients/${effectivePatient.id}/prescriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: newPrescDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await refreshPatient();
      toast({ title: "Prescription added", description: newPrescDate });
      setAddPrescOpen(false);
    } catch (e) {
      toast({
        title: "Failed to add prescription",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }

  // Re-fetch the full patient from the server + update the local store.
  async function refreshPatient() {
    if (!effectivePatient) return;
    try {
      const res = await fetch(`/api/patients/${effectivePatient.id}`, { cache: "no-store" });
      const data = await res.json();
      if (data.patient) {
        const full: LocalPatient = {
          id: data.patient.id,
          patientRef: data.patient.patientRef ?? "",
          name: data.patient.name,
          floor: data.patient.floor,
          admissionDate: data.patient.admissionDate,
          roomNumber: data.patient.roomNumber ?? "",
          status: data.patient.status,
          synced: true,
          days: (data.patient.days ?? []).map((d: Record<string, unknown>) => ({
            id: d.id as string,
            date: d.date as string,
            notes: (d.notes as string) ?? "",
            items: ((d.items as Array<Record<string, unknown>>) ?? []).map((it) => ({
              id: it.id as string,
              drugId: it.drugId as string,
              drugName: it.drugName as string,
              quantity: it.quantity as number,
              unitPrice: it.unitPrice as number,
              lineTotal: it.lineTotal as number,
            })),
            dayInvoice: d.dayInvoice as number,
            synced: true,
          })),
          daysCount: data.patient.daysCount ?? 0,
          totalInvoice: data.patient.totalInvoice ?? 0,
        };
        upsertFull(full);
        setServerPatient(full);
      }
    } catch {
      /* ignore */
    }
  }

  function handleAddDrug(drug: Drug, quantity: number) {
    if (!effectivePatient || !activeDayId) return;
    // Add to server immediately.
    (async () => {
      try {
        const res = await fetch(`/api/prescriptions/${activeDayId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ drugId: drug.id, quantity }),
        });
        if (!res.ok) throw new Error("Failed");
        await refreshPatient();
        toast({ title: "Drug added", description: `${quantity} × ${drug.item}` });
      } catch {
        toast({ title: "Failed to add drug", variant: "destructive" });
      }
    })();
    setDrugSearchOpen(false);
  }

  // Build a new prescription day + all items in ONE API call (batch).
  async function handleMatrixComplete(
    items: Array<{ drugId: string; drugName: string; quantity: number; unitPrice: number }>,
    date: string
  ) {
    if (!effectivePatient || items.length === 0) return;
    setSyncing(true);
    try {
      const res = await fetch(
        `/api/patients/${effectivePatient.id}/batch-prescription`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, items: items.map((it) => ({ drugId: it.drugId, quantity: it.quantity })) }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await refreshPatient();
      toast({
        title: "Prescription saved",
        description: `${items.length} drugs added and synced to the database.`,
      });
      setMatrixOpen(false);
    } catch (e) {
      toast({
        title: "Failed to save prescription",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }

  function handleDuplicateDay(dayId: string) {
    if (!effectivePatient) return;
    setSyncing(true);
    (async () => {
      try {
        const res = await fetch(`/api/prescriptions/${dayId}/duplicate`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed");
        await refreshPatient();
        toast({ title: "Day duplicated", description: "Created a new prescription with the same drugs." });
      } catch (e) {
        toast({
          title: "Failed to duplicate day",
          description: e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setSyncing(false);
      }
    })();
  }

  function handleRemoveItem(prescriptionId: string, itemId: string) {
    (async () => {
      try {
        const res = await fetch(
          `/api/prescriptions/${prescriptionId}/items?itemId=${encodeURIComponent(itemId)}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error("Failed");
        await refreshPatient();
      } catch {
        toast({ title: "Failed to remove item", variant: "destructive" });
      }
    })();
  }

  if (loadingServer) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  if (!effectivePatient) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">Patient not found.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back to Patients
        </Button>
      </div>
    );
  }

  const p = effectivePatient;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-gradient truncate">{p.name}</h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
            {p.patientRef ? (
              <Badge variant="secondary" className="bg-muted text-muted-foreground border-0 text-[10px] font-mono h-5 px-1.5">
                {p.patientRef}
              </Badge>
            ) : null}
            <span className="flex items-center gap-0.5">
              <Calendar className="h-3 w-3" />
              {new Date(p.admissionDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
            {p.roomNumber ? (
              <span className="flex items-center gap-0.5">
                <Bed className="h-3 w-3" />
                Room {p.roomNumber}
              </span>
            ) : null}
            {p.synced ? (
              <span className="flex items-center gap-0.5 text-emerald-600 text-[10px] font-medium">
                ✓ Synced
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-amber-600 text-[10px] font-medium">
                ○ Local
              </span>
            )}
          </div>
        </div>
        {p.status === "active" ? (
          <Badge className="bg-emerald-100 text-emerald-700 border-0">Active</Badge>
        ) : (
          <Badge variant="secondary">Discharged</Badge>
        )}
      </div>

      {/* Total invoice hero card */}
      <div className="relative overflow-hidden rounded-2xl gradient-border p-5 glow-primary">
        <div className="relative z-10 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Receipt className="h-3.5 w-3.5" />
            TOTAL INVOICE
          </div>
          <div className="mt-1 text-3xl font-bold tabular-nums text-gradient">
            {formatIQD(p.totalInvoice)} IQD
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            across {p.daysCount} {p.daysCount === 1 ? "prescription" : "prescriptions"}
          </div>
        </div>
        <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/15 blur-2xl" />
      </div>

      {syncing ? (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Syncing to database…
        </div>
      ) : null}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => setAddPrescOpen(true)} variant="outline">
          <Plus className="h-4 w-4" />
          Blank Prescription
        </Button>
        <Button
          variant="outline"
          onClick={() => onShowSummary(p.id)}
          disabled={p.days.length === 0}
          title={p.days.length === 0 ? "No prescriptions yet" : undefined}
        >
          <FileText className="h-4 w-4" />
          Drug Summary
        </Button>
      </div>

      {/* Primary action: Build Prescription with the matrix builder */}
      <Button
        className="w-full glow-primary"
        size="lg"
        onClick={() => setMatrixOpen(true)}
      >
        <Zap className="h-5 w-5" />
        Build Prescription
        <span className="text-xs opacity-80 ml-1">
          (search + quick-select + matrix)
        </span>
      </Button>

      {/* Prescriptions list — colored cards */}
      {p.days.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Calendar className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-foreground">No prescriptions yet</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Tap &ldquo;Add Prescription&rdquo; to start recording drugs and calculating invoices.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {p.days.map((day, idx) => {
            const isOpen = expandedDay === day.id;
            const palette = DAY_GRADIENTS[idx % DAY_GRADIENTS.length];
            return (
              <div
                key={day.id}
                className={cn(
                  "rounded-2xl border bg-card overflow-hidden lift",
                  isOpen && "ring-1 ring-primary/20"
                )}
              >
                {/* Day header — colored badge */}
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => setExpandedDay(isOpen ? null : day.id)}
                    className="flex flex-1 items-center gap-3 p-3.5 text-left min-w-0"
                  >
                    <div
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white font-bold text-base shadow-sm",
                        palette.badge
                      )}
                    >
                      P{idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-foreground text-sm">
                        {new Date(day.date).toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "short" })}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Pill className="h-3 w-3" />
                        {day.items.length} {day.items.length === 1 ? "drug" : "drugs"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-muted-foreground uppercase">Invoice</div>
                      <div className="text-base font-bold tabular-nums text-gradient">
                        {formatIQD(day.dayInvoice)}
                      </div>
                    </div>
                    <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform shrink-0", isOpen && "rotate-180")} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeDay(p.id, day.id)}
                    className="px-3 text-muted-foreground hover:text-destructive shrink-0"
                    aria-label="Delete prescription"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Day content */}
                {isOpen ? (
                  <div className="border-t border-border bg-muted/30 px-3.5 py-3 space-y-2.5">
                    {day.items.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">
                        No drugs added yet. Tap the + button below to search and add.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {day.items.map((item) => (
                          <div key={item.id} className="flex items-start gap-2 rounded-xl bg-card border border-border px-2.5 py-2 lift">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
                              <Pill className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-foreground leading-snug break-words">{item.drugName}</div>
                              <div className="text-xs text-muted-foreground tabular-nums">
                                {item.quantity} × {formatIQD(item.unitPrice)} = <span className="font-semibold text-foreground">{formatIQD(item.lineTotal)}</span> IQD
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleRemoveItem(day.id, item.id)}
                              aria-label="Remove drug"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add drug — big + button */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveDayId(day.id);
                        setDrugSearchOpen(true);
                      }}
                      className={cn(
                        "flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-2.5 text-sm font-medium transition-colors",
                        palette.addBtn
                      )}
                    >
                      <Plus className="h-4 w-4" />
                      Add drug from inventory
                    </button>

                    {/* Day total */}
                    <div className={cn("flex items-center justify-between rounded-xl bg-gradient-to-r border px-3.5 py-2.5", palette.total)}>
                      <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                        <Receipt className="h-3.5 w-3.5" />
                        Prescription Total
                      </span>
                      <span className="font-bold tabular-nums text-gradient text-base">
                        {formatIQD(day.dayInvoice)} IQD
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Add prescription dialog */}
      <Dialog open={addPrescOpen} onOpenChange={setAddPrescOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Add Prescription</DialogTitle>
            <DialogDescription>
              Each prescription represents a day. Drugs added here are saved
              locally first.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddPrescription} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="presc-date">Date</Label>
              <Input
                id="presc-date"
                type="date"
                value={newPrescDate}
                onChange={(e) => setNewPrescDate(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddPrescOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <Plus className="h-4 w-4" />
                Add Prescription
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Popup drug search dialog — key resets state each time it opens */}
      {drugSearchOpen ? (
        <DrugSearchDialog
          key={activeDayId ?? "search"}
          open={drugSearchOpen}
          onOpenChange={setDrugSearchOpen}
          drugs={drugs}
          onAdd={handleAddDrug}
        />
      ) : null}

      {/* Prescription matrix builder — predictive search + quick-select + matrix */}
      {matrixOpen ? (
        <PrescriptionMatrix
          key="matrix"
          open={matrixOpen}
          onOpenChange={setMatrixOpen}
          drugs={drugs}
          floor={effectivePatient.floor}
          onComplete={handleMatrixComplete}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------
// Popup drug search dialog — shows full drug names from inventory.
// ---------------------------------------------------------------------
function DrugSearchDialog({
  open,
  onOpenChange,
  drugs,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drugs: Drug[];
  onAdd: (drug: Drug, quantity: number) => void | Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Drug | null>(null);
  const [qty, setQty] = useState(1);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const terms = q.split(/\s+/).filter(Boolean);
    return drugs
      .filter((d) => {
        const haystack = `${d.item} ${d.genericName} ${d.company} ${d.dosageForm}`.toLowerCase();
        return terms.every((t) => haystack.includes(t));
      })
      .slice(0, 8);
  }, [drugs, query]);

  function handleAdd() {
    if (!selected) return;
    void onAdd(selected, qty);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto scroll-slim">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Add Drug from Inventory
          </DialogTitle>
          <DialogDescription>
            Search the drug inventory by name, generic, or company. Full names shown.
          </DialogDescription>
        </DialogHeader>

        {selected ? (
          <div className="space-y-3">
            <div className="rounded-xl border p-3 bg-primary/5 border-primary/20">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground break-words leading-snug">
                    {selected.item}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    {selected.genericName ? <div>Generic: {selected.genericName}</div> : null}
                    {selected.dosageForm ? <div>Form: {selected.dosageForm}</div> : null}
                    {selected.company ? <div>Company: {selected.company}</div> : null}
                    {selected.noOfTabPerPack ? <div>Pack: {selected.noOfTabPerPack}</div> : null}
                  </div>
                  <div className="mt-2 text-lg font-bold tabular-nums text-primary">
                    {formatIQD(selected.unitPrice)} IQD<span className="text-xs text-muted-foreground font-normal"> / unit</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                  aria-label="Back to search"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Quantity</Label>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease">−</Button>
                  <Input inputMode="numeric" value={String(qty)} onChange={(e) => { const n = parseInt(e.target.value.replace(/[^0-9]/g, ""), 10); setQty(Number.isFinite(n) && n > 0 ? n : 1); }} className="h-9 w-16 text-center tabular-nums" />
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => setQty((q) => q + 1)} aria-label="Increase">+</Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Line Total</Label>
                <div className="flex h-9 items-center gap-1 rounded-md border border-border bg-card px-2.5">
                  <span className="text-sm font-bold tabular-nums text-gradient">{formatIQD((selected.unitPrice ?? 0) * qty)}</span>
                  <span className="text-[10px] text-muted-foreground">IQD</span>
                </div>
              </div>
            </div>
            <Button className="w-full" onClick={handleAdd}>
              <Plus className="h-4 w-4" />
              Add to Prescription ({qty} × {formatIQD(selected.unitPrice)} = {formatIQD((selected.unitPrice ?? 0) * qty)} IQD)
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type drug name, generic, or company…"
                className="h-10 pl-9"
                autoFocus
              />
            </div>
            {query.trim() && results.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No drugs match &ldquo;{query}&rdquo;</p>
            ) : !query.trim() ? (
              <p className="text-xs text-muted-foreground text-center py-4">Start typing to search the drug inventory.</p>
            ) : (
              <div className="space-y-1.5 max-h-[50vh] overflow-y-auto scroll-slim">
                {results.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelected(d)}
                    className="flex w-full items-start gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 text-left hover:bg-accent hover:border-primary/30 transition-colors lift"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
                      <Pill className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground leading-snug break-words">{d.item}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 break-words">
                        {d.genericName ? <span>{d.genericName}</span> : null}
                        {d.dosageForm ? <span> · {d.dosageForm}</span> : null}
                        {d.company ? <span> · {d.company}</span> : null}
                      </div>
                    </div>
                    <div className="text-right shrink-0 mt-0.5">
                      <div className="text-sm font-bold tabular-nums text-primary">{formatIQD(d.unitPrice)}</div>
                      <div className="text-[9px] text-muted-foreground">IQD</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
