"use client";

import { useEffect, useMemo } from "react";
import { Star, Search, ChevronDown, Copy, Pill, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFavoritesStore } from "@/lib/favorites-store";
import { useToast } from "@/hooks/use-toast";
import { floorLabel } from "@/lib/auth-store";
import { formatIQD, formatIQDWithCurrency, extractUnitsPerPack } from "@/lib/format";
import type { Drug } from "@/lib/drug-data";
import { cn } from "@/lib/utils";

interface FavoritesPageProps {
  drugs: Drug[];
  hydrated: boolean;
  floor: string;
  onRequireAuth: () => void;
}

export function FavoritesPage({ drugs, hydrated, floor }: FavoritesPageProps) {
  const { toast } = useToast();
  const favorites = useFavoritesStore((s) => s.favorites);
  const favHydrated = useFavoritesStore((s) => s.hydrated);
  const loadFavorites = useFavoritesStore((s) => s.loadFavorites);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);

  useEffect(() => {
    void loadFavorites(floor);
  }, [floor, loadFavorites]);

  const favSet = useMemo(() => new Set(favorites), [favorites]);

  const favDrugs = useMemo(() => {
    return drugs.filter((d) => favSet.has(d.id));
  }, [drugs, favSet]);

  async function handleToggleFavorite(drugId: string) {
    try {
      const isNowFav = await toggleFavorite(drugId, floor);
      toast({
        title: isNowFav ? "Starred" : "Removed",
        description: isNowFav ? "Added to your floor's favorites" : "Removed from favorites",
      });
    } catch (e) {
      toast({
        title: "Failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function copyPrice(drug: Drug) {
    const text = `${formatIQD(drug.unitPrice)} IQD — ${drug.item}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* silently ignore */
    }
  }

  if (!favHydrated) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
          <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Starred Drugs</h2>
          <p className="text-xs text-muted-foreground">
            {floorLabel(floor)} · {favDrugs.length} {favDrugs.length === 1 ? "drug" : "drugs"}
          </p>
        </div>
      </div>

      {favDrugs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Star className="h-5 w-5" />
          </div>
          <h3 className="mt-2 text-sm font-semibold">No starred drugs yet</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Tap the star icon on any drug in Search to save it here for {floorLabel(floor)}.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {favDrugs.map((drug) => (
            <FavCard
              key={drug.id}
              drug={drug}
              onUnstar={() => handleToggleFavorite(drug.id)}
              onCopy={() => copyPrice(drug)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FavCard({
  drug,
  onUnstar,
  onCopy,
}: {
  drug: Drug;
  onUnstar: () => void;
  onCopy: () => void;
}) {
  const units = extractUnitsPerPack(drug.noOfTabPerPack);
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onUnstar}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-amber-500 hover:bg-amber-50 transition-colors"
          aria-label="Remove from starred"
        >
          <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
        </button>
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
        <button
          type="button"
          onClick={onCopy}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-primary transition-colors"
          aria-label="Copy price"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
