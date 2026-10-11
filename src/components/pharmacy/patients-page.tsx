"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Plus,
  Bed,
  ChevronRight,
  Loader2,
  CloudOff,
  CloudCheck,
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
import { floorLabel } from "@/lib/auth-store";
import { formatIQD } from "@/lib/format";
import { usePatientStore, type LocalPatient } from "@/lib/patient-store";
import { cn } from "@/lib/utils";

interface PatientsPageProps {
  floor: string;
  onOpenPatient: (patientId: string) => void;
}

export function PatientsPage({ floor, onOpenPatient }: PatientsPageProps) {
  const { toast } = useToast();
  const patients = usePatientStore((s) => s.patients);
  const hydrated = usePatientStore((s) => s.hydrated);
  const loadLocal = usePatientStore((s) => s.loadLocal);
  const mergeServer = usePatientStore((s) => s.mergeServer);
  const removePatient = usePatientStore((s) => s.removePatient);

  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [patientRef, setPatientRef] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 1. Load local patients instantly.
  useEffect(() => {
    loadLocal(floor);
  }, [floor, loadLocal]);

  // 2. Background-sync server patients + merge with local unsynced ones.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/patients?floor=${encodeURIComponent(floor)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        const server: LocalPatient[] = (data.patients ?? []).map((p: Record<string, unknown>) => ({
          id: p.id as string,
          patientRef: (p.patientRef as string) ?? "",
          name: p.name as string,
          floor: p.floor as string,
          admissionDate: p.admissionDate as string,
          roomNumber: (p.roomNumber as string) ?? "",
          status: (p.status as string) ?? "active",
          synced: true,
          days: [],
          daysCount: (p.daysCount as number) ?? 0,
          totalInvoice: (p.totalInvoice as number) ?? 0,
        }));
        if (!cancelled) {
          mergeServer(floor, server);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [floor, mergeServer]);

  async function loadPatients() {
    try {
      const res = await fetch(`/api/patients?floor=${encodeURIComponent(floor)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      const server: LocalPatient[] = (data.patients ?? []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        patientRef: (p.patientRef as string) ?? "",
        name: p.name as string,
        floor: p.floor as string,
        admissionDate: p.admissionDate as string,
        roomNumber: (p.roomNumber as string) ?? "",
        status: (p.status as string) ?? "active",
        synced: true,
        days: [],
        daysCount: (p.daysCount as number) ?? 0,
        totalInvoice: (p.totalInvoice as number) ?? 0,
      }));
      mergeServer(floor, server);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }

  async function handleCreatePatient(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    // Create patient directly on the server (auto-sync, no localStorage mismatch).
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, patientRef, floor, admissionDate: today, roomNumber }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "Patient added", description: name });
      setName("");
      setPatientRef("");
      setRoomNumber("");
      setAddOpen(false);
      await loadPatients();
      onOpenPatient(data.patient.id);
    } catch (e) {
      toast({
        title: "Failed to add patient",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(p: LocalPatient) {
    if (!confirm(`Delete patient "${p.name}"? This removes all prescriptions.`)) return;
    // Always try server delete first.
    try {
      const res = await fetch(`/api/patients/${p.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Delete failed (${res.status})`);
      }
    } catch (e) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Could not delete patient",
        variant: "destructive",
      });
      return;
    }
    // Remove from local store.
    removePatient(p.id);
    toast({ title: "Patient deleted", description: p.name });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-[oklch(0.50_0.12_210)]/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Patients</h2>
            <p className="text-xs text-muted-foreground">
              {floorLabel(floor)} · {patients.length} {patients.length === 1 ? "patient" : "patients"}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)} className="glow-primary">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Patient</span>
        </Button>
      </div>

      {!hydrated || loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : patients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Users className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-foreground">No patients yet</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Add a patient to start tracking prescriptions for {floorLabel(floor)}.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {patients.map((p) => (
            <PatientCard
              key={p.id}
              patient={p}
              onOpen={() => onOpenPatient(p.id)}
              onDelete={() => handleDelete(p)}
            />
          ))}
        </div>
      )}

      {/* Add patient dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Add Patient</DialogTitle>
            <DialogDescription>
              Create a new patient record for {floorLabel(floor)}. Saved directly
              to the database.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreatePatient} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="patient-name">Patient Name</Label>
              <Input
                id="patient-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="patient-ref">Patient ID</Label>
              <Input
                id="patient-ref"
                value={patientRef}
                onChange={(e) => setPatientRef(e.target.value)}
                placeholder="e.g. MRN-12345 / hospital number"
              />
              <p className="text-[11px] text-muted-foreground">
                Enter the patient&apos;s hospital ID or medical record number.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="room-number">Room Number</Label>
              <Input
                id="room-number"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="e.g. 101"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Admission date is set automatically to today (
              {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}).
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add Patient
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PatientCard({
  patient,
  onOpen,
  onDelete,
}: {
  patient: LocalPatient;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 lift">
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 text-left">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-[oklch(0.50_0.12_210)]/10 text-primary">
          <Bed className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-semibold text-foreground text-sm truncate">{patient.name}</h3>
            {patient.patientRef ? (
              <Badge variant="secondary" className="bg-muted text-muted-foreground border-0 text-[10px] font-mono h-5 px-1.5">
                {patient.patientRef}
              </Badge>
            ) : null}
            {patient.synced ? (
              <span title="Synced to database" className="flex items-center gap-0.5 text-[10px] text-emerald-600">
                <CloudCheck className="h-3 w-3" />
                Synced
              </span>
            ) : (
              <span title="Local only — will sync on first prescription" className="flex items-center gap-0.5 text-[10px] text-amber-600">
                <CloudOff className="h-3 w-3" />
                Local
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
            {patient.roomNumber ? (
              <span className="flex items-center gap-0.5">
                <Bed className="h-3 w-3" />
                Room {patient.roomNumber}
              </span>
            ) : null}
            <span>{patient.daysCount} {patient.daysCount === 1 ? "day" : "days"}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] text-muted-foreground">Invoice</div>
          <div className="text-sm font-bold tabular-nums text-gradient">
            {formatIQD(patient.totalInvoice)}
          </div>
          <div className="text-[9px] text-muted-foreground">IQD</div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>
      <div className="mt-2 flex justify-end">
        <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive hover:text-destructive" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}
