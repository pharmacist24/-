"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  Users,
  Pill,
  Receipt,
  Calendar,
  ArrowRight,
  Star,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { floorLabel } from "@/lib/auth-store";
import { formatIQD } from "@/lib/format";
import type { Drug } from "@/lib/drug-data";

interface PatientSummary {
  id: string;
  name: string;
  daysCount: number;
  totalInvoice: number;
  status: string;
}

interface DashboardPageProps {
  floor: string;
  drugs: Drug[];
}

export function DashboardPage({ floor, drugs }: DashboardPageProps) {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/patients?floor=${encodeURIComponent(floor)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!cancelled) setPatients(data.patients ?? []);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [floor]);

  const activePatients = patients.filter((p) => p.status === "active");
  const totalFloorInvoice = patients.reduce((s, p) => s + p.totalInvoice, 0);
  const totalPrescriptions = patients.reduce((s, p) => s + p.daysCount, 0);
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-4">
      {/* Welcome hero */}
      <div className="relative overflow-hidden rounded-2xl gradient-border p-5 glow-primary">
        <div className="relative z-10">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {today}
          </div>
          <h2 className="mt-1 text-xl font-bold text-gradient">
            {floorLabel(floor)}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pharmacy dashboard · {drugs.length} drugs in catalog
          </p>
        </div>
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
        <div className="absolute -right-4 bottom-0 h-24 w-24 rounded-full bg-[oklch(0.50_0.12_210)]/10 blur-2xl" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Active Patients"
          value={loading ? "…" : String(activePatients.length)}
          tint="emerald"
        />
        <StatCard
          icon={<Receipt className="h-5 w-5" />}
          label="Floor Invoice"
          value={loading ? "…" : `${formatIQD(totalFloorInvoice)}`}
          sub="IQD"
          tint="teal"
        />
        <StatCard
          icon={<Pill className="h-5 w-5" />}
          label="Prescriptions"
          value={loading ? "…" : String(totalPrescriptions)}
          sub="days"
          tint="cyan"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Avg / Patient"
          value={
            loading || patients.length === 0
              ? "…"
              : formatIQD(Math.round(totalFloorInvoice / patients.length))
          }
          sub="IQD"
          tint="blue"
        />
      </div>

      {/* Active patients list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">Active Patients</h3>
          <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
            {activePatients.length}
          </Badge>
        </div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : activePatients.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Users className="h-5 w-5" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              No active patients on {floorLabel(floor)}.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activePatients.slice(0, 5).map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 lift"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-[oklch(0.50_0.12_210)]/10 text-primary">
                  <Users className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-foreground text-sm truncate">
                    {p.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.daysCount} {p.daysCount === 1 ? "day" : "days"} · {formatIQD(p.totalInvoice)} IQD
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick tips */}
      <div className="rounded-2xl border border-border bg-card/60 p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">Quick Tips</h3>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          <li className="flex items-start gap-1.5">
            <Search className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
            Use Search to instantly look up any drug price by brand or generic name.
          </li>
          <li className="flex items-start gap-1.5">
            <Star className="h-3.5 w-3.5 mt-0.5 text-amber-500 shrink-0" />
            Star drugs to save them for {floorLabel(floor)} — shared with your floor team.
          </li>
          <li className="flex items-start gap-1.5">
            <Users className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
            Open Patients to track prescriptions and invoices per day.
          </li>
        </ul>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tint: "emerald" | "teal" | "cyan" | "blue";
}) {
  const tints: Record<string, string> = {
    emerald: "from-[oklch(0.55_0.14_175)]/15 to-[oklch(0.55_0.14_175)]/5 text-[oklch(0.50_0.14_175)]",
    teal: "from-[oklch(0.55_0.13_190)]/15 to-[oklch(0.55_0.13_190)]/5 text-[oklch(0.50_0.13_190)]",
    cyan: "from-[oklch(0.60_0.12_210)]/15 to-[oklch(0.60_0.12_210)]/5 text-[oklch(0.50_0.12_210)]",
    blue: "from-[oklch(0.55_0.13_240)]/15 to-[oklch(0.55_0.13_240)]/5 text-[oklch(0.50_0.13_240)]",
  };
  return (
    <div className={`rounded-2xl border border-border bg-gradient-to-br ${tints[tint]} p-3.5 lift`}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium opacity-80">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-xl font-bold tabular-nums text-foreground">{value}</span>
        {sub ? <span className="text-[10px] text-muted-foreground">{sub}</span> : null}
      </div>
    </div>
  );
}
