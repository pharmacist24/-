"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Minus,
  X,
  Trash2,
  Check,
  Loader2,
  Sparkles,
  ChevronRight,
  Package,
  TrendingUp,
  Receipt,
  ArrowRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatIQD } from "@/lib/format";
import type { Drug } from "@/lib/drug-data";
import { useFavoritesStore } from "@/lib/favorites-store";
import { cn } from "@/lib/utils";

interface PrescriptionMatrixProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drugs: Drug[];
  floor: string | null;
  onComplete: (
    items: Array<{ drugId: string; drugName: string; quantity: number; unitPrice: number }>,
    date: string
  ) => Promise<void>;
}

interface MatrixItem {
  drug: Drug;
  quantity: number;
}

/**
 * Modern prescription matrix builder with:
 * - Predictive global search bar (generic + trade names, instant stock + price)
 * - Dynamic line-item matrix (inline quantity steppers, live totals)
 * - Quick-select catalog sidebar (starred / high-frequency drugs, one-tap add)
 * - Sticky summary footer (item count, subtotal, Complete button)
 */
export function PrescriptionMatrix({
  open,
  onOpenChange,
  drugs,
  floor,
  onComplete,
}: PrescriptionMatrixProps) {
  const [query, setQuery] = useState("");
  const [matrix, setMatrix] = useState<MatrixItem[]>([]);
  const [completing, setCompleting] = useState(false);
  const [tab, setTab] = useState<"search" | "quick">("search");
  const [prescDate, setPrescDate] = useState(new Date().toISOString().slice(0, 10));

  // Load starred drugs for the quick-select sidebar.
  const favorites = useFavoritesStore((s) => s.favorites);
  const loadFavorites = useFavoritesStore((s) => s.loadFavorites);
  const favSet = useMemo(() => new Set(favorites), [favorites]);

  useEffect(() => {
    if (floor) void loadFavorites(floor);
  }, [floor, loadFavorites]);

  // Reset state when the dialog opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setMatrix([]);
      setTab("search");
      setPrescDate(new Date().toISOString().slice(0, 10));
    }
  }, [open]);

  // --- Predictive search results ---
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const terms = q.split(/\s+/).filter(Boolean);
    return drugs
      .filter((d) => {
        const haystack = `${d.item} ${d.genericName} ${d.company} ${d.dosageForm}`.toLowerCase();
        return terms.every((t) => haystack.includes(t));
      })
      .slice(0, 10)
      .map((d) => ({
        drug: d,
        inMatrix: matrix.some((m) => m.drug.id === d.id),
      }));
  }, [drugs, query, matrix]);

  // --- Quick-select: ALL starred drugs on this floor (no cap) ---
  const quickSelectDrugs = useMemo(() => {
    return drugs.filter((d) => favSet.has(d.id));
  }, [drugs, favSet]);

  // --- Matrix operations ---
  function addToMatrix(drug: Drug) {
    setMatrix((cur) => {
      if (cur.some((m) => m.drug.id === drug.id)) return cur;
      return [...cur, { drug, quantity: 1 }];
    });
    setQuery("");
  }

  function setQuantity(drugId: string, qty: number) {
    setMatrix((cur) =>
      cur.map((m) =>
        m.drug.id === drugId ? { ...m, quantity: Math.max(1, qty) } : m
      )
    );
  }

  function incrementQty(drugId: string) {
    setMatrix((cur) =>
      cur.map((m) =>
        m.drug.id === drugId ? { ...m, quantity: m.quantity + 1 } : m
      )
    );
  }

  function decrementQty(drugId: string) {
    setMatrix((cur) =>
      cur.map((m) =>
        m.drug.id === drugId
          ? { ...m, quantity: Math.max(1, m.quantity - 1) }
          : m
      )
    );
  }

  function removeFromMatrix(drugId: string) {
    setMatrix((cur) => cur.filter((m) => m.drug.id !== drugId));
  }

  // --- Live totals ---
  const subtotal = matrix.reduce(
    (s, m) => s + (m.drug.unitPrice ?? 0) * m.quantity,
    0
  );
  const totalItems = matrix.reduce((s, m) => s + m.quantity, 0);

  async function handleComplete() {
    if (matrix.length === 0) return;
    setCompleting(true);
    try {
      await onComplete(
        matrix.map((m) => ({
          drugId: m.drug.id,
          drugName: m.drug.item,
          quantity: m.quantity,
          unitPrice: m.drug.unitPrice ?? 0,
        })),
        prescDate
      );
      onOpenChange(false);
    } catch {
      /* error handled by caller */
    } finally {
      setCompleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-5 w-5 text-primary" />
            Build Prescription
          </DialogTitle>
          <div className="flex items-center gap-2 mt-2">
            <label htmlFor="presc-date" className="text-xs text-muted-foreground whitespace-nowrap">
              Prescription date:
            </label>
            <input
              id="presc-date"
              type="date"
              value={prescDate}
              onChange={(e) => setPrescDate(e.target.value)}
              className="h-8 rounded-md border border-border bg-card px-2 text-sm text-foreground"
            />
          </div>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex border-b border-border px-5 pt-2">
          <button
            type="button"
            onClick={() => setTab("search")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
              tab === "search"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Search className="h-4 w-4" />
            Predictive Search
          </button>
          <button
            type="button"
            onClick={() => setTab("quick")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
              tab === "quick"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="h-4 w-4" />
            Quick Select
            {quickSelectDrugs.length > 0 ? (
              <Badge className="ml-1 h-4 px-1 text-[10px] bg-primary text-primary-foreground">
                {quickSelectDrugs.length}
              </Badge>
            ) : null}
          </button>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto scroll-slim px-5 py-3 min-h-[200px]">
          {tab === "search" ? (
            <SearchTab
              query={query}
              setQuery={setQuery}
              results={searchResults}
              onAdd={addToMatrix}
            />
          ) : (
            <QuickSelectTab
              drugs={quickSelectDrugs}
              matrix={matrix}
              onAdd={addToMatrix}
            />
          )}

          {/* Line-item matrix — scrollable so all drug names are reachable */}
          {matrix.length > 0 ? (
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Line Items ({matrix.length})
              </h3>
              <div className="space-y-1.5 max-h-[320px] overflow-y-auto scroll-slim pr-1">
                {matrix.map((item) => (
                  <MatrixRow
                    key={item.drug.id}
                    item={item}
                    onIncrement={() => incrementQty(item.drug.id)}
                    onDecrement={() => decrementQty(item.drug.id)}
                    onSetQty={(n) => setQuantity(item.drug.id, n)}
                    onRemove={() => removeFromMatrix(item.drug.id)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p className="mt-2 text-xs text-muted-foreground">
                No drugs added yet. Use search or quick-select above.
              </p>
            </div>
          )}
        </div>

        {/* Sticky summary footer — stacks on mobile */}
        <div className="border-t border-border bg-card/95 backdrop-blur px-3 py-2.5 safe-area-inset-bottom">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {/* Summary stats */}
            <div className="flex items-center gap-3 text-sm">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block leading-tight">Items</span>
                <span className="font-bold tabular-nums text-foreground text-xs">
                  {matrix.length} drugs · {totalItems} units
                </span>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block leading-tight">Subtotal</span>
                <span className="font-bold tabular-nums text-gradient text-base">
                  {formatIQD(subtotal)} IQD
                </span>
              </div>
            </div>
            {/* Complete button */}
            <Button
              onClick={handleComplete}
              disabled={matrix.length === 0 || completing}
              className="glow-primary w-full sm:w-auto"
            >
              {completing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              <span className="text-sm">Complete</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Predictive search tab
// ---------------------------------------------------------------------
function SearchTab({
  query,
  setQuery,
  results,
  onAdd,
}: {
  query: string;
  setQuery: (v: string) => void;
  results: Array<{ drug: Drug; inMatrix: boolean }>;
  onAdd: (drug: Drug) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type drug name or generic name…"
          className="h-11 pl-10 text-base shadow-sm"
          autoFocus
        />
        {query.trim() ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {query.trim() ? (
        results.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            No drugs match &ldquo;{query}&rdquo;
          </p>
        ) : (
          <div className="space-y-1">
            {results.map(({ drug, inMatrix }) => (
              <button
                key={drug.id}
                type="button"
                onClick={() => onAdd(drug)}
                disabled={inMatrix}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
                  inMatrix
                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 opacity-70"
                    : "border-border bg-card hover:bg-accent hover:border-primary/30 lift"
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
                  <Package className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground leading-snug break-words">
                    {drug.item}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 break-words">
                    {drug.genericName ? <span className="font-medium">{drug.genericName}</span> : null}
                    {drug.dosageForm ? <span> · {drug.dosageForm}</span> : null}
                    {drug.company ? <span> · {drug.company}</span> : null}
                  </div>
                </div>
                <div className="text-right shrink-0 mt-0.5">
                  <div className="text-sm font-bold tabular-nums text-primary">
                    {formatIQD(drug.unitPrice)}
                  </div>
                  <div className="text-[9px] text-muted-foreground">IQD/unit</div>
                </div>
                {inMatrix ? (
                  <Badge className="shrink-0 bg-emerald-100 text-emerald-700 border-0 text-[10px]">
                    <Check className="h-3 w-3" />
                    Added
                  </Badge>
                ) : (
                  <div className="shrink-0 mt-0.5">
                    <Plus className="h-4 w-4 text-primary" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="text-center py-6">
          <Search className="h-8 w-8 text-muted-foreground/40 mx-auto" />
          <p className="mt-2 text-xs text-muted-foreground">
            Start typing to search {results.length > 0 ? `${results.length} ` : ""}drugs instantly.
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Searches brand names, generic names, and companies.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Quick-select catalog sidebar (starred / high-frequency drugs)
// ---------------------------------------------------------------------
function QuickSelectTab({
  drugs,
  matrix,
  onAdd,
}: {
  drugs: Drug[];
  matrix: MatrixItem[];
  onAdd: (drug: Drug) => void;
}) {
  if (drugs.length === 0) {
    return (
      <div className="text-center py-8">
        <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto" />
        <p className="mt-2 text-xs text-muted-foreground">
          No quick-select items yet.
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Star drugs from the Search tab to populate this quick-select grid.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
        <TrendingUp className="h-3.5 w-3.5" />
        High-frequency drugs (your floor&apos;s starred items)
      </div>
      {/* Single column, full drug names, scrollable */}
      <div className="space-y-1 max-h-[280px] overflow-y-auto scroll-slim pr-1">
        {drugs.map((drug) => {
          const inMatrix = matrix.some((m) => m.drug.id === drug.id);
          return (
            <button
              key={drug.id}
              type="button"
              onClick={() => onAdd(drug)}
              disabled={inMatrix}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors w-full",
                inMatrix
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 opacity-70"
                  : "border-border bg-card hover:bg-accent hover:border-primary/30 lift"
              )}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Package className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground leading-snug break-words">
                  {drug.item}
                </div>
              </div>
              {inMatrix ? (
                <Check className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <Plus className="h-4 w-4 text-primary shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Matrix row — inline quantity stepper + live line total + remove
// ---------------------------------------------------------------------
function MatrixRow({
  item,
  onIncrement,
  onDecrement,
  onSetQty,
  onRemove,
}: {
  item: MatrixItem;
  onIncrement: () => void;
  onDecrement: () => void;
  onSetQty: (n: number) => void;
  onRemove: () => void;
}) {
  const lineTotal = (item.drug.unitPrice ?? 0) * item.quantity;
  return (
    <div className="rounded-lg border border-border bg-card px-2.5 py-2 space-y-1.5">
      {/* Row 1: drug name + remove (full width) */}
      <div className="flex items-start gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary mt-0.5">
          <Package className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-foreground leading-snug break-words">
            {item.drug.item}
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          aria-label="Remove item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {/* Row 2: quantity stepper (left) + line total (right) — stacked on very small screens */}
      <div className="flex items-center justify-between gap-2 pl-8">
        {/* Quantity stepper */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onDecrement}
            disabled={item.quantity <= 1}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
            aria-label="Decrease quantity"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={String(item.quantity)}
            onChange={(e) => {
              const n = parseInt(e.target.value.replace(/[^0-9]/g, ""), 10);
              onSetQty(Number.isFinite(n) && n > 0 ? n : 1);
            }}
            className="h-7 w-9 text-center text-sm font-semibold tabular-nums border border-border rounded-md bg-card"
            aria-label="Quantity"
          />
          <button
            type="button"
            onClick={onIncrement}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Increase quantity"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] text-muted-foreground ml-1 hidden xs:inline sm:inline">×</span>
          <span className="text-[10px] text-muted-foreground tabular-nums hidden xs:inline sm:inline">
            {formatIQD(item.drug.unitPrice)}
          </span>
        </div>
        {/* Line total */}
        <div className="text-right shrink-0">
          <span className="text-sm font-bold tabular-nums text-gradient">
            {formatIQD(lineTotal)}
          </span>
          <span className="text-[9px] text-muted-foreground ml-0.5">IQD</span>
        </div>
      </div>
    </div>
  );
}
