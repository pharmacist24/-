"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Drug } from "@/lib/drug-data";

const drugSchema = z.object({
  item: z
    .string()
    .trim()
    .min(1, "Drug brand name is required")
    .max(160, "Brand name is too long"),
  genericName: z
    .string()
    .trim()
    .max(160, "Generic name is too long")
    .optional()
    .or(z.literal("")),
  dosageForm: z.string().trim().min(1, "Dosage form is required"),
  unitPrice: z
    .union([z.string(), z.number()])
    .transform((v) =>
      typeof v === "number" ? v : Number(String(v).replace(/,/g, "").trim())
    )
    .refine((v) => !Number.isNaN(v) && v >= 0, "Enter a valid non-negative price"),
  company: z
    .string()
    .trim()
    .max(120, "Company name is too long")
    .optional()
    .or(z.literal("")),
  priceOfPack: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === "" || v === undefined || v === null) return null as number | null;
      const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, "").trim());
      return Number.isNaN(n) ? null : n;
    }),
  noOfTabPerPack: z
    .string()
    .trim()
    .max(200, "Too long")
    .optional()
    .or(z.literal("")),
});

type DrugFormValues = z.input<typeof drugSchema>;

interface DrugFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the dialog operates in "edit" mode. */
  initialDrug?: Drug;
  onSubmit: (data: Omit<Drug, "id">) => Promise<void> | void;
}

export function DrugFormDialog({
  open,
  onOpenChange,
  initialDrug,
  onSubmit,
}: DrugFormDialogProps) {
  const isEdit = Boolean(initialDrug);
  const { toast } = useToast();

  const [companies, setCompanies] = useState<string[]>([]);
  const [dosageForms, setDosageForms] = useState<string[]>([]);

  // Load prefilled company & dosage-form lists from the DB (Admin Settings).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const [coRes, dfRes] = await Promise.all([
          fetch("/api/companies", { cache: "no-store" }),
          fetch("/api/dosage-forms", { cache: "no-store" }),
        ]);
        const coData = await coRes.json();
        const dfData = await dfRes.json();
        if (!cancelled) {
          setCompanies((coData.companies ?? []).map((c: { name: string }) => c.name));
          setDosageForms((dfData.dosageForms ?? []).map((f: { name: string }) => f.name));
        }
      } catch {
        /* ignore — fall back to free text */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DrugFormValues>({
    resolver: zodResolver(drugSchema) as never,
    defaultValues: {
      item: "",
      genericName: "",
      dosageForm: "Tablet",
      unitPrice: "",
      company: "",
      priceOfPack: "",
      noOfTabPerPack: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (initialDrug) {
      reset({
        item: initialDrug.item,
        genericName: initialDrug.genericName,
        dosageForm: initialDrug.dosageForm || "Tablet",
        unitPrice: initialDrug.unitPrice ?? "",
        company: initialDrug.company,
        priceOfPack: initialDrug.priceOfPack ?? "",
        noOfTabPerPack: initialDrug.noOfTabPerPack,
      });
    } else {
      reset({
        item: "",
        genericName: "",
        dosageForm: "Tablet",
        unitPrice: "",
        company: "",
        priceOfPack: "",
        noOfTabPerPack: "",
      });
    }
  }, [open, initialDrug, reset]);

  const dosageFormValue = watch("dosageForm") || "Tablet";
  const companyValue = watch("company") || "__none__";

  async function handleValid(values: DrugFormValues) {
    const parsed = drugSchema.safeParse(values);
    const data = (parsed.success ? parsed.data : (values as never)) as Omit<Drug, "id">;
    const payload = {
      item: String(data.item).trim(),
      genericName: String(data.genericName ?? "").trim(),
      dosageForm: String(data.dosageForm).trim(),
      unitPrice:
        typeof data.unitPrice === "number" && !Number.isNaN(data.unitPrice)
          ? data.unitPrice
          : null,
      company: String(data.company ?? "").trim(),
      priceOfPack: data.priceOfPack ?? null,
      noOfTabPerPack: String(data.noOfTabPerPack ?? "").trim(),
    };
    try {
      await onSubmit(payload);
      toast({
        title: isEdit ? "Drug updated" : "Drug added",
        description: `${payload.item} has been ${
          isEdit ? "updated" : "saved"
        } successfully.`,
      });
      onOpenChange(false);
    } catch (e) {
      void e;
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[92vh] overflow-y-auto scroll-slim">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Drug" : "Add New Drug"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update pricing and details for this drug record."
              : "Fill in the details below to add a new drug to the catalog."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleValid)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="drug-item">
              Drug Brand Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="drug-item"
              placeholder="e.g. Amoxicillin 500mg"
              autoFocus
              {...register("item")}
            />
            {errors.item ? (
              <p className="text-xs text-destructive">{errors.item.message}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="drug-generic">Generic Name</Label>
              <Input
                id="drug-generic"
                placeholder="e.g. Amoxicillin"
                {...register("genericName")}
              />
              {errors.genericName ? (
                <p className="text-xs text-destructive">{errors.genericName.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="drug-form">
                Dosage Form <span className="text-destructive">*</span>
              </Label>
              <Select
                value={dosageFormValue}
                onValueChange={(v) =>
                  setValue("dosageForm", v, { shouldValidate: true })
                }
              >
                <SelectTrigger id="drug-form">
                  <SelectValue placeholder="Select form" />
                </SelectTrigger>
                <SelectContent>
                  {dosageForms.length > 0
                    ? dosageForms.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))
                    : (
                      <>
                        <SelectItem value="Tablet">Tablet</SelectItem>
                        <SelectItem value="Capsule">Capsule</SelectItem>
                        <SelectItem value="Syrup">Syrup</SelectItem>
                        <SelectItem value="Vial">Vial</SelectItem>
                        <SelectItem value="Injection">Injection</SelectItem>
                      </>
                    )}
                </SelectContent>
              </Select>
              {errors.dosageForm ? (
                <p className="text-xs text-destructive">{errors.dosageForm.message}</p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="drug-unit-price">
                Unit Price (IQD) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="drug-unit-price"
                inputMode="decimal"
                placeholder="e.g. 1500"
                {...register("unitPrice")}
              />
              {errors.unitPrice ? (
                <p className="text-xs text-destructive">{errors.unitPrice.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="drug-company">Company / Manufacturer</Label>
              <Select
                value={companyValue}
                onValueChange={(v) =>
                  setValue(
                    "company",
                    v === "__none__" ? "" : v,
                    { shouldValidate: true }
                  )
                }
              >
                <SelectTrigger id="drug-company">
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.company ? (
                <p className="text-xs text-destructive">{errors.company.message}</p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Manage this list in Admin Settings.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="drug-pack-price">Price of Pack (IQD)</Label>
              <Input
                id="drug-pack-price"
                inputMode="decimal"
                placeholder="e.g. 15000"
                {...register("priceOfPack")}
              />
              {errors.priceOfPack ? (
                <p className="text-xs text-destructive">{errors.priceOfPack.message}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="drug-pack-count">No. of Units per Pack</Label>
              <Input
                id="drug-pack-count"
                placeholder="e.g. 30 or 'pack of 15 vial'"
                {...register("noOfTabPerPack")}
              />
              {errors.noOfTabPerPack ? (
                <p className="text-xs text-destructive">
                  {errors.noOfTabPerPack.message}
                </p>
              ) : null}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEdit ? "Save Changes" : "Add Drug"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
