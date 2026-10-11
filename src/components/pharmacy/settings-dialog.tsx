"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Pill,
  Plus,
  Trash2,
  Settings as SettingsIcon,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface PrefillItem {
  id: string;
  name: string;
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<PrefillItem[]>([]);
  const [forms, setForms] = useState<PrefillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCompany, setNewCompany] = useState("");
  const [newForm, setNewForm] = useState("");

  async function loadAll() {
    setLoading(true);
    try {
      const [coRes, dfRes] = await Promise.all([
        fetch("/api/companies", { cache: "no-store" }),
        fetch("/api/dosage-forms", { cache: "no-store" }),
      ]);
      const coData = await coRes.json();
      const dfData = await dfRes.json();
      setCompanies(coData.companies ?? []);
      setForms(dfData.dosageForms ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void loadAll();
  }, [open]);

  async function addCompany() {
    const name = newCompany.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error ?? "Failed");
      }
      setNewCompany("");
      await loadAll();
      toast({ title: "Company added", description: name });
    } catch (e) {
      toast({
        title: "Failed to add company",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function addForm() {
    const name = newForm.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/dosage-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error ?? "Failed");
      }
      setNewForm("");
      await loadAll();
      toast({ title: "Dosage form added", description: name });
    } catch (e) {
      toast({
        title: "Failed to add dosage form",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function deleteCompany(id: string, name: string) {
    try {
      const res = await fetch(`/api/companies/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setCompanies((c) => c.filter((x) => x.id !== id));
      toast({ title: "Company removed", description: name });
    } catch {
      toast({
        title: "Failed to delete company",
        variant: "destructive",
      });
    }
  }

  async function deleteForm(id: string, name: string) {
    try {
      const res = await fetch(`/api/dosage-forms/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setForms((f) => f.filter((x) => x.id !== id));
      toast({ title: "Dosage form removed", description: name });
    } catch {
      toast({
        title: "Failed to delete dosage form",
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[92vh] overflow-y-auto scroll-slim">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-primary" />
            Admin Settings
          </DialogTitle>
          <DialogDescription>
            Manage the prefilled lists used in the Add-Drug form to prevent
            misspellings.
          </DialogDescription>
        </DialogHeader>

        {/* Companies section */}
        <section className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Building2 className="h-4 w-4 text-primary" />
            Companies / Manufacturers
            <span className="text-xs font-normal text-muted-foreground">
              ({companies.length})
            </span>
          </div>
          <div className="flex gap-2">
            <Input
              value={newCompany}
              onChange={(e) => setNewCompany(e.target.value)}
              placeholder="Add a company name…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addCompany();
                }
              }}
            />
            <Button type="button" onClick={addCompany} size="default">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          <div className="max-h-40 overflow-y-auto scroll-slim rounded-lg border border-border">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : companies.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No companies yet. Add one above.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {companies.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <span className="truncate">{c.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteCompany(c.id, c.name)}
                      aria-label={`Delete ${c.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Dosage forms section */}
        <section className="space-y-2.5 pt-2">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Pill className="h-4 w-4 text-primary" />
            Dosage Forms
            <span className="text-xs font-normal text-muted-foreground">
              ({forms.length})
            </span>
          </div>
          <div className="flex gap-2">
            <Input
              value={newForm}
              onChange={(e) => setNewForm(e.target.value)}
              placeholder="Add a dosage form…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addForm();
                }
              }}
            />
            <Button type="button" onClick={addForm}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          <div className="max-h-40 overflow-y-auto scroll-slim rounded-lg border border-border">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : forms.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No dosage forms yet. Add one above.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {forms.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <span className="truncate">{f.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteForm(f.id, f.name)}
                      aria-label={`Delete ${f.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
