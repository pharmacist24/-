"use client";

import { useMemo, useState } from "react";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  Package2,
  Settings as SettingsIcon,
  Building2,
  Pill,
  Hash,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { formatIQD } from "@/lib/format";
import type { Drug } from "@/lib/drug-data";
import { DrugFormDialog } from "./drug-form-dialog";
import { DosageFormSlider } from "./dosage-form-slider";
import { SettingsDialog } from "./settings-dialog";
import { cn } from "@/lib/utils";

interface AdminViewProps {
  drugs: Drug[];
  hydrated: boolean;
  readOnly?: boolean;
  onAdd: (data: Omit<Drug, "id">) => Promise<Drug> | Drug;
  onUpdate: (id: string, data: Omit<Drug, "id">) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  onReset: () => Promise<void> | void;
}

export function AdminView({
  drugs,
  hydrated,
  readOnly = false,
  onAdd,
  onUpdate,
  onDelete,
  onReset,
}: AdminViewProps) {
  const [search, setSearch] = useState("");
  const [formFilter, setFormFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDrug, setEditingDrug] = useState<Drug | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Drug | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { toast } = useToast();

  // Build filter options from current data.
  const formOptions = useMemo(() => {
    const set = new Set<string>();
    drugs.forEach((d) => {
      if (d.dosageForm) set.add(d.dosageForm);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [drugs]);

  const companyOptions = useMemo(() => {
    const set = new Set<string>();
    drugs.forEach((d) => {
      if (d.company) set.add(d.company);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [drugs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    return drugs.filter((d) => {
      if (formFilter !== "all" && d.dosageForm !== formFilter) return false;
      if (companyFilter !== "all" && d.company !== companyFilter) return false;
      if (terms.length === 0) return true;
      const haystack = `${d.item} ${d.genericName} ${d.dosageForm} ${d.company} ${
        d.unitPrice ?? ""
      } ${d.priceOfPack ?? ""} ${d.noOfTabPerPack}`.toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }, [drugs, search, formFilter, companyFilter]);

  function openAdd() {
    setEditingDrug(undefined);
    setDialogOpen(true);
  }

  function openEdit(drug: Drug) {
    setEditingDrug(drug);
    setDialogOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await onDelete(target.id);
      toast({
        title: "Drug deleted",
        description: `${target.item} was removed from the database.`,
        variant: "destructive",
      });
    } catch (e) {
      toast({
        title: "Delete failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function handleReset() {
    try {
      await onReset();
      toast({
        title: "Catalog reset",
        description: "All drugs restored to the original seed data in the database.",
      });
    } catch (e) {
      toast({
        title: "Reset failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  // ---------------- Admin dashboard ----------------
  return (
    <div className="space-y-5">
      {/* Stats + actions bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <StatBadge label="Total Drugs" value={drugs.length} />
          <StatBadge label="Filtered" value={filtered.length} />
          <StatBadge label="Dosage Forms" value={formOptions.length} />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={readOnly}
            title={readOnly ? "Disabled in demo mode" : undefined}
          >
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Reset Catalog</span>
          </Button>
          <Button
            size="sm"
            onClick={openAdd}
            disabled={readOnly}
            title={readOnly ? "Disabled in demo mode" : undefined}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Drug</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-8 relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search across all fields…"
              className="pl-9"
              aria-label="Search drugs"
            />
          </div>
          <div className="md:col-span-4">
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-full">
                <Package2 className="h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All companies</SelectItem>
                {companyOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3">
          <DosageFormSlider
            options={formOptions}
            value={formFilter}
            onChange={setFormFilter}
            label="Dosage form"
          />
        </div>
      </div>

      {/* Data table (desktop/tablet) */}
      <div className="hidden md:block rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="max-h-[60vh] overflow-auto scroll-slim">
          <Table className="w-full min-w-[940px] table-fixed">
            <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[24%]">Item (Brand Name)</TableHead>
                <TableHead className="w-[16%]">Generic Name</TableHead>
                <TableHead className="w-[10%]">Dosage Form</TableHead>
                <TableHead className="w-[10%] text-right">Unit Price</TableHead>
                <TableHead className="w-[12%]">Company</TableHead>
                <TableHead className="w-[10%] text-right">Price of Pack</TableHead>
                <TableHead className="w-[14%]">Units / Pack</TableHead>
                <TableHead className="w-[4%] text-right sticky right-0 bg-muted/95 backdrop-blur">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!hydrated ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={`sk-${i}`}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full max-w-[120px]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                    No drugs match your search.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((drug) => (
                  <TableRow key={drug.id} className="group">
                    <TableCell className="font-medium text-foreground align-top break-words" title={drug.item}>
                      <span className="line-clamp-3">{drug.item}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground align-top break-words" title={drug.genericName}>
                      <span className="line-clamp-2">{drug.genericName || "—"}</span>
                    </TableCell>
                    <TableCell className="align-top">
                      {drug.dosageForm ? (
                        <Badge
                          variant="secondary"
                          className="bg-primary/10 text-primary border-0 font-medium"
                        >
                          {drug.dosageForm}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-foreground align-top">
                      {formatIQD(drug.unitPrice)}
                    </TableCell>
                    <TableCell className="text-muted-foreground align-top break-words" title={drug.company}>
                      <span className="line-clamp-2">{drug.company || "—"}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground align-top">
                      {formatIQD(drug.priceOfPack)}
                    </TableCell>
                    <TableCell className="text-muted-foreground align-top text-sm break-words" title={drug.noOfTabPerPack}>
                      <span className="line-clamp-3">{drug.noOfTabPerPack || "—"}</span>
                    </TableCell>
                    <TableCell className="text-right align-top sticky right-0 bg-card group-hover:bg-muted/40">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(drug)}
                          disabled={readOnly}
                          aria-label={`Edit ${drug.item}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(drug)}
                          disabled={readOnly}
                          aria-label={`Delete ${drug.item}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2.5">
        {!hydrated ? (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-3 w-1/3" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No drugs match your search.
          </div>
        ) : (
          filtered.map((drug) => (
            <div key={drug.id} className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-foreground leading-snug break-words">
                    {drug.item}
                  </h3>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    {drug.dosageForm ? (
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-0 font-medium">
                        {drug.dosageForm}
                      </Badge>
                    ) : null}
                    {drug.company ? (
                      <span className="text-xs text-muted-foreground truncate">{drug.company}</span>
                    ) : null}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-muted-foreground">Unit</div>
                  <div className="text-base font-bold tabular-nums text-primary">
                    {formatIQD(drug.unitPrice)}
                  </div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Generic: </span>
                  <span className="text-foreground truncate">{drug.genericName || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Pack: </span>
                  <span className="text-foreground tabular-nums">{formatIQD(drug.priceOfPack)}</span>
                </div>
              </div>
              <div className="mt-2.5 flex justify-end gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => openEdit(drug)}
                  disabled={readOnly}
                  aria-label={`Edit ${drug.item}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteTarget(drug)}
                  disabled={readOnly}
                  aria-label={`Delete ${drug.item}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <DrugFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialDrug={editingDrug}
        onSubmit={async (data) => {
          try {
            if (editingDrug) {
              await onUpdate(editingDrug.id, data);
            } else {
              await onAdd(data);
            }
          } catch (e) {
            toast({
              title: editingDrug ? "Update failed" : "Add failed",
              description: e instanceof Error ? e.message : "Unknown error",
              variant: "destructive",
            });
            throw e; // re-throw so the dialog stays open on failure
          }
        }}
      />

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this drug?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.item}
              </span>{" "}
              from the catalog. This action can be reverted using “Reset Catalog”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className={cn(
                "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-bold tabular-nums text-foreground">
        {value.toLocaleString("en-US")}
      </span>
    </div>
  );
}
