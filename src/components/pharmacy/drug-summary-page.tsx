"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatIQD } from "@/lib/format";
import { usePatientStore } from "@/lib/patient-store";

interface DrugSummaryItem {
  drugId: string;
  drugName: string;
  unitPrice: number;
  totalQuantity: number;
  totalCost: number;
  daysUsed: number;
}

interface DrugSummary {
  patient: {
    id: string;
    patientRef: string;
    name: string;
    floor: string;
    admissionDate: string;
    roomNumber: string;
    status: string;
  };
  drugList: DrugSummaryItem[];
  grandTotal: number;
  daysCount: number;
}

interface DrugSummaryPageProps {
  patientId: string;
  onBack: () => void;
}

export function DrugSummaryPage({ patientId, onBack }: DrugSummaryPageProps) {
  const [summary, setSummary] = useState<DrugSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const getPatient = usePatientStore((s) => s.getPatient);

  useEffect(() => {
    let cancelled = false;

    // Check if the patient is local (in the store, unsynced) first.
    const localPatient = getPatient(patientId);
    if (localPatient) {
      // Build the summary from local data (no API call).
      const agg = new Map<
        string,
        DrugSummaryItem
      >();
      for (const day of localPatient.days) {
        const seenThisDay = new Set<string>();
        for (const it of day.items) {
          const existing = agg.get(it.drugId);
          if (existing) {
            existing.totalQuantity += it.quantity;
            existing.totalCost += it.lineTotal;
            if (!seenThisDay.has(it.drugId)) {
              existing.daysUsed += 1;
              seenThisDay.add(it.drugId);
            }
          } else {
            agg.set(it.drugId, {
              drugId: it.drugId,
              drugName: it.drugName,
              unitPrice: it.unitPrice,
              totalQuantity: it.quantity,
              totalCost: it.lineTotal,
              daysUsed: 1,
            });
            seenThisDay.add(it.drugId);
          }
        }
      }
      const drugList = Array.from(agg.values()).sort((a, b) =>
        a.drugName.localeCompare(b.drugName)
      );
      const grandTotal = drugList.reduce((s, d) => s + d.totalCost, 0);
      if (!cancelled) {
        setSummary({
          patient: {
            id: localPatient.id,
            patientRef: localPatient.patientRef,
            name: localPatient.name,
            floor: localPatient.floor,
            admissionDate: localPatient.admissionDate,
            roomNumber: localPatient.roomNumber,
            status: localPatient.status,
          },
          drugList,
          grandTotal,
          daysCount: localPatient.days.length,
        });
        setLoading(false);
      }
      return;
    }

    // Otherwise fetch from the API (synced patient).
    (async () => {
      try {
        const res = await fetch(`/api/patients/${patientId}/drug-summary`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!cancelled) setSummary(data);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">Could not load summary.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>
    );
  }

  const p = summary.patient;

  return (
    <div className="space-y-4">
      {/* Screen-only toolbar */}
      <div className="flex items-center gap-2 print:hidden">
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-base font-bold text-gradient flex-1">Drug Summary</h2>
        <Button size="sm" className="glow-primary" onClick={handlePrint}>
          <Printer className="h-4 w-4" />
          Print A4
        </Button>
      </div>

      {/* Printable document — EXACT replica of hospital template */}
      <div className="printable-a4" dir="rtl" style={{ background: "white", color: "#000", padding: "15mm", maxWidth: "210mm", margin: "0 auto", boxShadow: "0 4px 24px -8px rgba(0,0,0,0.12)", borderRadius: "0.5rem" }}>

        {/* === TOP HEADER — hospital name (right) + department (left) === */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: "0.4rem", borderBottom: "2px solid #000", marginBottom: "0.6rem" }}>
          <div style={{ textAlign: "right", fontWeight: 700, fontSize: "13px", lineHeight: 1.7 }}>
            مستشفى فيصل الملكي - وحدة الصيدلة المستشفية
          </div>
          <div style={{ textAlign: "left", fontWeight: 700, fontSize: "13px", lineHeight: 1.7 }}>
            القائمة العامة للعقارات الدوائية في الإيصال الحالي
          </div>
        </div>

        {/* === PATIENT INFO FIELDS — 3 rows exactly as template === */}
        {/* Row 1: اسم المريض + قاعدة البيانات لتتبع توزيع */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.4rem", fontSize: "12px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.3rem" }}>
            <span style={{ fontWeight: 700 }}>اسم المريض:</span>
            <span style={{ borderBottom: "1px solid #000", minWidth: "120px", display: "inline-block", paddingRight: "0.5rem" }}>{p.name}</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.3rem" }}>
            <span style={{ fontWeight: 700 }}>قاعدة البيانات لتتبع توزيع:</span>
            <span style={{ borderBottom: "1px solid #000", minWidth: "100px", display: "inline-block" }}></span>
          </div>
        </div>

        {/* Row 2: رقم الهوية (patient ID) + رقم الطبيب */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.4rem", fontSize: "12px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.3rem" }}>
            <span style={{ fontWeight: 700 }}>رقم الهوية:</span>
            <span style={{ borderBottom: "1px solid #000", minWidth: "120px", display: "inline-block", paddingRight: "0.5rem" }}>{p.patientRef || p.id}</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.3rem" }}>
            <span style={{ fontWeight: 700 }}>رقم الطبيب:</span>
            <span style={{ borderBottom: "1px solid #000", minWidth: "100px", display: "inline-block" }}></span>
          </div>
        </div>

        {/* Row 3: تاريخ (date) + الرتبة */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.6rem", fontSize: "12px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.3rem" }}>
            <span style={{ fontWeight: 700 }}>تاريخ:</span>
            <span style={{ borderBottom: "1px solid #000", minWidth: "120px", display: "inline-block", paddingRight: "0.5rem" }}>
              {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.3rem" }}>
            <span style={{ fontWeight: 700 }}>الرتبة:</span>
            <span style={{ borderBottom: "1px solid #000", minWidth: "100px", display: "inline-block" }}></span>
          </div>
        </div>

        {/* === DRUG TABLE — 8 columns exactly as template === */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", direction: "rtl" }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid #000", padding: "5px 6px", fontWeight: 700, width: "4%" }}>م</th>
              <th style={{ border: "1px solid #000", padding: "5px 6px", fontWeight: 700, width: "28%" }}>اسم الدواء</th>
              <th style={{ border: "1px solid #000", padding: "5px 6px", fontWeight: 700, width: "12%" }}>الشكل الصيدلاني</th>
              <th style={{ border: "1px solid #000", padding: "5px 6px", fontWeight: 700, width: "12%" }}>شراء أو كيمياليا</th>
              <th style={{ border: "1px solid #000", padding: "5px 6px", fontWeight: 700, width: "10%" }}>سعر الوحدة</th>
              <th style={{ border: "1px solid #000", padding: "5px 6px", fontWeight: 700, width: "10%" }}>الكمية</th>
              <th style={{ border: "1px solid #000", padding: "5px 6px", fontWeight: 700, width: "12%" }}>قيمة الدواء</th>
              <th style={{ border: "1px solid #000", padding: "5px 6px", fontWeight: 700, width: "12%" }}>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {summary.drugList.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ border: "1px solid #000", padding: "1rem", textAlign: "center" }}>
                  لا توجد أدوية مسجلة بعد.
                </td>
              </tr>
            ) : (
              summary.drugList.map((drug, idx) => {
                const lineTotal = drug.unitPrice * drug.totalQuantity;
                return (
                  <tr key={drug.drugId}>
                    <td style={{ border: "1px solid #000", padding: "5px 6px", textAlign: "center" }}>{idx + 1}</td>
                    <td style={{ border: "1px solid #000", padding: "5px 6px" }}>{drug.drugName}</td>
                    <td style={{ border: "1px solid #000", padding: "5px 6px" }}></td>
                    <td style={{ border: "1px solid #000", padding: "5px 6px", textAlign: "center" }}>كيمياليا</td>
                    <td style={{ border: "1px solid #000", padding: "5px 6px", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{formatIQD(drug.unitPrice)}</td>
                    <td style={{ border: "1px solid #000", padding: "5px 6px", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{drug.totalQuantity}</td>
                    <td style={{ border: "1px solid #000", padding: "5px 6px", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{formatIQD(lineTotal)}</td>
                    <td style={{ border: "1px solid #000", padding: "5px 6px" }}></td>
                  </tr>
                );
              })
            )}
            {/* Empty rows to fill the page like the template */}
            {summary.drugList.length < 14 && Array.from({ length: Math.max(0, 14 - summary.drugList.length) }).map((_, i) => (
              <tr key={`empty-${i}`}>
                <td style={{ border: "1px solid #000", padding: "5px 6px", textAlign: "center", height: "22px" }}>&nbsp;</td>
                <td style={{ border: "1px solid #000", padding: "5px 6px", height: "22px" }}>&nbsp;</td>
                <td style={{ border: "1px solid #000", padding: "5px 6px", height: "22px" }}>&nbsp;</td>
                <td style={{ border: "1px solid #000", padding: "5px 6px", height: "22px" }}>&nbsp;</td>
                <td style={{ border: "1px solid #000", padding: "5px 6px", height: "22px" }}>&nbsp;</td>
                <td style={{ border: "1px solid #000", padding: "5px 6px", height: "22px" }}>&nbsp;</td>
                <td style={{ border: "1px solid #000", padding: "5px 6px", height: "22px" }}>&nbsp;</td>
                <td style={{ border: "1px solid #000", padding: "5px 6px", height: "22px" }}>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* === SIGNATURE BLOCKS at bottom — exactly as template === */}
        <div style={{ display: "flex", justifyContent: "space-around", marginTop: "2.5rem", fontSize: "12px", fontWeight: 700 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderBottom: "1px solid #000", width: "160px", height: "2rem", marginBottom: "0.3rem" }}></div>
            المستلم السريري
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderBottom: "1px solid #000", width: "160px", height: "2rem", marginBottom: "0.3rem" }}></div>
            مسؤول القائمة الحالية
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ borderBottom: "1px solid #000", width: "160px", height: "2rem", marginBottom: "0.3rem" }}></div>
            حضر القائمة الحالية
          </div>
        </div>
      </div>
    </div>
  );
}
