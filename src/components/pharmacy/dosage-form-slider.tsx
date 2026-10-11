"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DosageFormSliderProps {
  options: string[];
  value: string; // "all" or a specific form
  onChange: (value: string) => void;
  /** Optional label shown before the chips */
  label?: string;
}

/**
 * Horizontal scrollable slider of dosage-form chips, with left/right arrows.
 * Used in both the Pharmacist and Admin interfaces.
 * Clicking a chip selects it; clicking "All" clears the filter.
 */
export function DosageFormSlider({
  options,
  value,
  onChange,
  label,
}: DosageFormSliderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scrollBy(dir: -1 | 1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 200, behavior: "smooth" });
  }

  return (
    <div className="w-full">
      {label ? (
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">
          {label}
        </div>
      ) : null}
      <div className="relative flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label="Scroll dosage forms left"
          className="hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div
          ref={scrollRef}
          className="flex flex-1 items-center gap-1.5 overflow-x-auto scroll-slim scroll-smooth snap-x py-0.5"
          style={{ scrollbarWidth: "thin" }}
        >
          <Chip active={value === "all"} onClick={() => onChange("all")}>
            All forms
          </Chip>
          {options.map((opt) => (
            <Chip key={opt} active={value === opt} onClick={() => onChange(opt)}>
              {opt}
            </Chip>
          ))}
        </div>

        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label="Scroll dosage forms right"
          className="hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "snap-start shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
