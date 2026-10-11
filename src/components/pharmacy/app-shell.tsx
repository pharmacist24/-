"use client";

import { useEffect, useState } from "react";
import {
  Search,
  Star,
  LayoutDashboard,
  User as UserIcon,
  ShieldCheck,
  HeartPulse,
  LogIn,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDrugStore } from "@/lib/drug-store";
import { useAuthStore, floorLabel } from "@/lib/auth-store";
import { usePatientStore } from "@/lib/patient-store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "./auth-dialog";
import { SearchPage } from "./search-page";
import { FavoritesPage } from "./favorites-page";
import { DashboardPage } from "./dashboard-page";
import { ProfilePage } from "./profile-page";
import { PatientsPage } from "./patients-page";
import { PatientDetailPage } from "./patient-detail-page";
import { DrugSummaryPage } from "./drug-summary-page";
import { AdminView } from "./admin-view";

type Page =
  | "search"
  | "favorites"
  | "dashboard"
  | "patients"
  | "patient-detail"
  | "drug-summary"
  | "profile"
  | "admin";

export function AppShell() {
  const drugs = useDrugStore((s) => s.drugs);
  const hydrated = useDrugStore((s) => s.hydrated);
  const loading = useDrugStore((s) => s.loading);
  const error = useDrugStore((s) => s.error);
  const readOnly = useDrugStore((s) => s.readOnly);
  const loadDrugs = useDrugStore((s) => s.loadDrugs);
  const addDrug = useDrugStore((s) => s.addDrug);
  const updateDrug = useDrugStore((s) => s.updateDrug);
  const deleteDrug = useDrugStore((s) => s.deleteDrug);
  const resetToSeed = useDrugStore((s) => s.resetToSeed);

  const user = useAuthStore((s) => s.user);
  const authHydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const logout = useAuthStore((s) => s.logout);
  const { toast } = useToast();

  const [page, setPage] = useState<Page>("search");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signup" | "login">("login");

  // Load catalog + session once.
  useState(() => {
    void loadDrugs();
    void hydrate();
  });

  // Load local patients from localStorage so they survive page reloads
  // (the patient detail page relies on the store being populated).
  useEffect(() => {
    if (user?.floor) {
      usePatientStore.getState().loadLocal(user.floor);
    }
  }, [user?.floor]);

  const isAdmin = Boolean(user && user.role === "admin");

  function handleLogout() {
    void logout().then(() => {
      toast({ title: "Signed out", description: "You have been signed out." });
      setPage("search");
    });
  }

  function openAuth(mode: "signup" | "login") {
    setAuthMode(mode);
    setAuthOpen(true);
  }

  function openPatient(patientId: string) {
    setSelectedPatientId(patientId);
    setPage("patient-detail");
  }

  function openDrugSummary(patientId: string) {
    setSelectedPatientId(patientId);
    setPage("drug-summary");
  }

  const navItems: { key: Page; label: string; icon: React.ReactNode; show: boolean }[] = [
    { key: "search", label: "Search", icon: <Search className="h-5 w-5" />, show: true },
    { key: "favorites", label: "Starred", icon: <Star className="h-5 w-5" />, show: Boolean(user) },
    { key: "dashboard", label: "Home", icon: <LayoutDashboard className="h-5 w-5" />, show: Boolean(user) },
    { key: "patients", label: "Patients", icon: <Users className="h-5 w-5" />, show: Boolean(user) },
    { key: "profile", label: "Profile", icon: <UserIcon className="h-5 w-5" />, show: Boolean(user) },
    { key: "admin", label: "Admin", icon: <ShieldCheck className="h-5 w-5" />, show: isAdmin },
  ];

  const requiresAuth =
    page !== "search" && page !== "patient-detail" && page !== "drug-summary";
  const effectivePage: Page = !user && requiresAuth ? "search" : page;

  return (
    <div className="min-h-screen flex flex-col app-bg">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border/60">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[oklch(0.50_0.12_210)] text-primary-foreground shadow-md glow-primary">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <h1 className="text-sm font-bold tracking-tight text-gradient">
                MediPrice
              </h1>
              <p className="text-[10px] text-muted-foreground">
                {user
                  ? `${user.name} · ${floorLabel(user.floor)}`
                  : "Pharmacy Drug Pricing"}
              </p>
            </div>
          </div>

          {user ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={() => setPage("profile")}
            >
              <UserIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{user.name.split(" ")[0]}</span>
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => openAuth("login")}
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </Button>
          )}
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-4 pb-28">
        {error ? (
          <div className="mx-auto max-w-md rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <h3 className="text-sm font-semibold text-foreground">
              Couldn&apos;t reach the database
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void loadDrugs()}
            >
              Retry
            </Button>
          </div>
        ) : effectivePage === "search" ? (
          <SearchPage
            drugs={drugs}
            hydrated={hydrated}
            floor={user?.floor ?? null}
            onRequireAuth={() => openAuth("signup")}
          />
        ) : effectivePage === "favorites" && user ? (
          <FavoritesPage
            drugs={drugs}
            hydrated={hydrated}
            floor={user.floor}
            onRequireAuth={() => openAuth("signup")}
          />
        ) : effectivePage === "dashboard" && user ? (
          <DashboardPage floor={user.floor} drugs={drugs} />
        ) : effectivePage === "patients" && user ? (
          <PatientsPage floor={user.floor} onOpenPatient={openPatient} />
        ) : effectivePage === "patient-detail" && user && selectedPatientId ? (
          <PatientDetailPage
            patientId={selectedPatientId}
            drugs={drugs}
            onBack={() => setPage("patients")}
            onShowSummary={openDrugSummary}
            onPatientSynced={(oldId, newId) => {
              setSelectedPatientId(newId);
            }}
          />
        ) : effectivePage === "drug-summary" && user && selectedPatientId ? (
          <DrugSummaryPage
            patientId={selectedPatientId}
            onBack={() => setPage("patient-detail")}
          />
        ) : effectivePage === "profile" && user ? (
          <ProfilePage user={user} onLogout={handleLogout} />
        ) : effectivePage === "admin" && isAdmin ? (
          <AdminView
            drugs={drugs}
            hydrated={hydrated}
            readOnly={readOnly}
            onAdd={addDrug}
            onUpdate={updateDrug}
            onDelete={deleteDrug}
            onReset={resetToSeed}
          />
        ) : null}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-border/60">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-around px-2 py-1.5 safe-area-inset-bottom">
          {navItems
            .filter((item) => item.show)
            .map((item) => {
              const active = effectivePage === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPage(item.key)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-all min-w-[58px]",
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-pressed={active}
                  aria-label={item.label}
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
                      active && "nav-active-pill"
                    )}
                  >
                    {item.icon}
                  </div>
                  <span className="text-[10px] font-medium leading-none">
                    {item.label}
                  </span>
                </button>
              );
            })}
        </div>
      </nav>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode={authMode} />
    </div>
  );
}
