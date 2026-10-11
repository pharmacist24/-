"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Pill,
  Building2,
  Package,
  ChevronDown,
  Hash,
  Star,
  Copy,
  Calculator,
  GitCompare,
  RotateCcw,
  SlidersHorizontal,
  X,
  Check,
  LogIn,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useFavoritesStore } from "@/lib/favorites-store";
import { floorLabel as floorLabelFn } from "@/lib/auth-store";
import {
  formatIQD,
  formatIQDWithCurrency,
  extractUnitsPerPack,
} from "@/lib/format";
import type { Drug } from "@/lib/drug-data";
import { cn } from "@/lib/utils";
import { DosageFormSlider } from "./dosage-form-slider";

interface SearchPageProps {
  drugs: Drug[];
  hydrated: boolean;
  floor: string | null;
  onRequireAuth: () => void;
}

type SortKey = "default" | "name-asc" | "price-asc" | "price-desc";
const MAX_RESULTS = 80;

export function SearchPage({ drugs, hydrated, floor, onRequireAuth }: SearchPageProps) {
  const { toast } = useToast();
  const favorites = useFavoritesStore((s) => s.favorites);
  const favHydrated = useFavoritesStore((s) => s.hydrated);
  const loadFavorites = useFavoritesStore((s) => s.loadFavorites);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);

  const [query, setQuery] = useState("");
  const [activeForm, setActiveForm] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Track recently viewed via API when a row is expanded.
  useEffect(() => {
    if (floor) void loadFavorites(floor);
  }, [floor, loadFavorites]);

  const formOptions = useMemo(() => {
    const set = new Set<string>();
    drugs.forEach((d) => d.dosageForm && set.add(d.dosageForm));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [drugs]);

  const companyOptions = useMemo(() => {
    const set = new Set<string>();
    drugs.forEach((d) => d.company && set.add(d.company));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [drugs]);

  const favSet = useMemo(() => new Set(favorites), [favorites]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    const min = priceMin.trim() === "" ? null : Number(priceMin.replace(/,/g, ""));
    const max = priceMax.trim() === "" ? null : Number(priceMax.replace(/,/g, ""));
    const minNum = min !== null && !Number.isNaN(min) ? min : null;
    const maxNum = max !== null && !Number.isNaN(max) ? max : null;

    let list = drugs.filter((d) => {
      if (terms.length > 0) {
        const haystack = `${d.item} ${d.genericName} ${d.company} ${d.dosageForm}`.toLowerCase();
        if (!terms.every((t) => haystack.includes(t))) return false;
      }
      if (activeForm !== "all" && d.dosageForm !== activeForm) return false;
      if (companyFilter !== "all" && d.company !== companyFilter) return false;
      if (favoritesOnly && !favSet.has(d.id)) return false;
      if (d.unitPrice === null || d.unitPrice === undefined) {
        if (minNum !== null || maxNum !== null) return false;
      } else {
        if (minNum !== null && d.unitPrice < minNum) return false;
        if (maxNum !== null && d.unitPrice > maxNum) return false;
      }
      return true;
    });

    switch (sortKey) {
      case "name-asc":
        list = list.slice().sort((a, b) => a.item.localeCompare(b.item));
        break;
      case "price-asc":
        list = list.slice().sort((a, b) => (a.unitPrice ?? Infinity) - (b.unitPrice ?? Infinity));
        break;
      case "price-desc":
        list = list.slice().sort((a, b) => (b.unitPrice ?? -Infinity) - (a.unitPrice ?? -Infinity));
        break;
      default:
        break;
    }
    return list.slice(0, MAX_RESULTS);
  }, [drugs, query, activeForm, companyFilter, favoritesOnly, priceMin, priceMax, sortKey, favSet]);

  const activeFilterCount =
    (activeForm !== "all" ? 1 : 0) +
    (companyFilter !== "all" ? 1 : 0) +
    (sortKey !== "default" ? 1 : 0) +
    (priceMin.trim() !== "" ? 1 : 0) +
    (priceMax.trim() !== "" ? 1 : 0) +
    (favoritesOnly ? 1 : 0);

  function resetAllFilters() {
    setQuery("");
    setActiveForm("all");
    setCompanyFilter("all");
    setSortKey("default");
    setPriceMin("");
    setPriceMax("");
    setFavoritesOnly(false);
  }

  function toggle(id: string) {
    setExpandedId((cur) => (cur === id ? null : id));
  }

  async function handleToggleFavorite(drugId: string) {
    if (!floor) {
      onRequireAuth();
      return;
    }
    try {
      await toggleFavorite(drugId, floor);
    } catch (e) {
      toast({
        title: "Failed to update favorite",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function copyPrice(drug: Drug) {
    const text =
      drug.unitPrice !== null && drug.unitPrice !== undefined
        ? `${formatIQD(drug.unitPrice)} IQD — ${drug.item}`
        : `Price unavailable — ${drug.item}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* silently ignore */
    }
  }

  function findGenericEquivalents(drug: Drug) {
    if (!drug.genericName.trim()) {
      toast({ title: "No generic name", description: "This drug has no generic name recorded." });
      return;
    }
    setQuery(drug.genericName.trim());
    setActiveForm("all");
    setCompanyFilter("all");
    setFavoritesOnly(false);
    setPriceMin("");
    setPriceMax("");
    setExpandedId(null);
    toast({ title: "Generic equivalents", description: `Filtered to "${drug.genericName.trim()}".` });
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a drug name or generic name…"
          className="h-12 pl-11 pr-10 text-base rounded-xl shadow-sm"
          aria-label="Search drugs"
          autoComplete="off"
        />
        {query.trim() ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {/* Quick actions row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {hydrated
            ? `${results.length} of ${drugs.length} drugs`
            : "Loading…"}
        </span>
        <div className="flex items-center gap-1.5">
          {floor ? (
            <Button
              variant={favoritesOnly ? "default" : "ghost"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setFavoritesOnly((v) => !v)}
              aria-pressed={favoritesOnly}
            >
              <Star className={cn("h-3.5 w-3.5", favoritesOnly && "fill-current")} />
              <span className="hidden sm:inline">Starred</span>
              {favorites.length ? ` ${favorites.length}` : ""}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount ? (
              <Badge className="ml-1 h-4 px-1 text-[10px] bg-primary text-primary-foreground">
                {activeFilterCount}
              </Badge>
            ) : null}
          </Button>
          {activeFilterCount > 0 || query.trim() ? (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetAllFilters}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Dosage form slider */}
      <DosageFormSlider options={formOptions} value={activeForm} onChange={setActiveForm} />

      {/* Filter panel */}
      <Collapsible open={showFilters} onOpenChange={setShowFilters}>
        <CollapsibleContent>
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="w-full">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All companies</SelectItem>
                  {companyOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="name-asc">Name A→Z</SelectItem>
                  <SelectItem value="price-asc">Price ↑</SelectItem>
                  <SelectItem value="price-desc">Price ↓</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Input
                inputMode="numeric"
                placeholder="Min IQD"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                className="h-9"
                aria-label="Minimum price"
              />
              <span className="text-muted-foreground text-sm">—</span>
              <Input
                inputMode="numeric"
                placeholder="Max IQD"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                className="h-9"
                aria-label="Maximum price"
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Not signed in notice */}
      {!floor ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
          <LogIn className="h-4 w-4 shrink-0" />
          <span>Sign in to star drugs and save your floor's data.</span>
        </div>
      ) : null}

      {/* Results */}
      <div className="space-y-2">
        {!hydrated ? (
          <LoadingState />
        ) : results.length === 0 ? (
          <EmptyState query={query} onReset={resetAllFilters} />
        ) : (
          results.map((drug) => (
            <DrugCard
              key={drug.id}
              drug={drug}
              isOpen={expandedId === drug.id}
              isFavorite={favSet.has(drug.id)}
              signedIn={Boolean(floor)}
              onToggle={() => toggle(drug.id)}
              onToggleFavorite={() => handleToggleFavorite(drug.id)}
              onCopyPrice={() => copyPrice(drug)}
              onFindEquivalents={() => findGenericEquivalents(drug)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DrugCard({
  drug,
  isOpen,
  isFavorite,
  signedIn,
  onToggle,
  onToggleFavorite,
  onCopyPrice,
  onFindEquivalents,
}: {
  drug: Drug;
  isOpen: boolean;
  isFavorite: boolean;
  signedIn: boolean;
  onToggle: () => void;
  onToggleFavorite: () => void;
  onCopyPrice: () => void;
  onFindEquivalents: () => void;
}) {
  const units = extractUnitsPerPack(drug.noOfTabPerPack);
  const perUnitFromPack = drug.priceOfPack && units ? drug.priceOfPack / units : null;
  const hasGeneric = drug.genericName.trim().length > 0;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card shadow-sm transition-all",
        isOpen ? "border-primary/60 ring-1 ring-primary/20" : "border-border"
      )}
    >
      <div className="flex items-start gap-2 p-3">
        {/* Star button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
            isFavorite
              ? "text-amber-500"
              : "text-muted-foreground hover:text-amber-500"
          )}
          aria-label={isFavorite ? "Remove from starred" : "Add to starred"}
          aria-pressed={isFavorite}
        >
          <Star className={cn("h-5 w-5", isFavorite && "fill-amber-400 text-amber-400")} />
        </button>

        {/* Main content — clickable */}
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
          aria-expanded={isOpen}
        >
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground leading-snug break-words text-sm">
              {drug.item}
            </h3>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              {drug.dosageForm ? (
                <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-[10px] font-medium h-5 px-1.5">
                  {drug.dosageForm}
                </Badge>
              ) : null}
              {drug.company ? (
                <span className="text-xs text-muted-foreground truncate flex items-center gap-0.5">
                  <Building2 className="h-3 w-3 shrink-0" />
                  {drug.company}
                </span>
              ) : null}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-base font-bold tabular-nums text-primary leading-none">
              {formatIQD(drug.unitPrice)}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">IQD</div>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform mt-1",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {/* Copy button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCopyPrice();
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-primary transition-colors"
          aria-label="Copy unit price"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>

      {isOpen ? (
        <div className="border-t border-border bg-muted/30 px-3 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <DetailItem label="Generic" value={drug.genericName || "—"} />
            <DetailItem label="Dosage" value={drug.dosageForm || "—"} />
            <DetailItem label="Unit Price" value={formatIQDWithCurrency(drug.unitPrice)} strong />
            <DetailItem label="Pack Price" value={drug.priceOfPack ? formatIQDWithCurrency(drug.priceOfPack) : "—"} />
            <DetailItem label="Company" value={drug.company || "—"} />
            <DetailItem label="Units/Pack" value={drug.noOfTabPerPack || "—"} />
          </div>

          {drug.priceOfPack && units ? (
            <div className="rounded-lg bg-primary/5 border border-primary/15 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Derived: </span>
              <span className="font-semibold text-primary">{formatIQD(perUnitFromPack)} IQD</span>
              <span className="text-muted-foreground"> / unit ({formatIQD(drug.priceOfPack)} ÷ {units})</span>
            </div>
          ) : null}

          <DispensingCalculator drug={drug} />

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={onFindEquivalents}
            disabled={!hasGeneric}
          >
            <GitCompare className="h-3.5 w-3.5" />
            {hasGeneric ? `Find "${drug.genericName}" variants` : "No generic name"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function DispensingCalculator({ drug }: { drug: Drug }) {
  const [qty, setQty] = useState("1");
  const n = Number(qty.replace(/,/g, ""));
  const valid = qty.trim() !== "" && !Number.isNaN(n) && n >= 0;
  const total =
    drug.unitPrice !== null && drug.unitPrice !== undefined && valid
      ? drug.unitPrice * n
      : null;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
        <Calculator className="h-3.5 w-3.5" />
        Dispensing Calculator
      </div>
      <div className="mt-2 flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-[10px] uppercase text-muted-foreground mb-0.5">Qty</label>
          <Input
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="h-8 text-sm"
            placeholder="10"
          />
        </div>
        <div className="flex-1">
          <label className="block text-[10px] uppercase text-muted-foreground mb-0.5">Total</label>
          <div className="flex h-8 items-center gap-1 rounded-md border border-border bg-card px-2.5">
            <Check className="h-3 w-3 text-primary" />
            <span className="text-sm font-bold tabular-nums text-primary">
              {total !== null ? formatIQD(total) : "—"}
            </span>
            <span className="text-[10px] text-muted-foreground">IQD</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg bg-card border border-border px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-xs break-words", strong ? "font-bold text-primary tabular-nums" : "font-medium text-foreground")}>
        {value}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 p-3 rounded-xl border border-border bg-card">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ query, onReset }: { query: string; onReset: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Search className="h-5 w-5" />
      </div>
      <h3 className="mt-2 text-sm font-semibold">No drugs found</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {query.trim() ? `Nothing matched "${query}".` : "No drugs match the active filters."}
      </p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onReset}>
        <RotateCcw className="h-3.5 w-3.5" />
        Reset
      </Button>
    </div>
  );
}
