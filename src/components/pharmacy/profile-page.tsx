"use client";

import { useState } from "react";
import {
  LogOut,
  User as UserIcon,
  MapPin,
  Mail,
  ShieldCheck,
  HeartPulse,
  Lock,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SessionUser } from "@/lib/auth-store";
import { floorLabel } from "@/lib/auth-store";
import { useToast } from "@/hooks/use-toast";

interface ProfilePageProps {
  user: SessionUser;
  onLogout: () => void;
}

export function ProfilePage({ user, onLogout }: ProfilePageProps) {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "New password and confirmation must be the same.",
        variant: "destructive",
      });
      return;
    }
    setChanging(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({
        title: "Password changed",
        description: "Your password has been updated successfully.",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      toast({
        title: "Failed to change password",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setChanging(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Profile header */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UserIcon className="h-8 w-8" />
        </div>
        <h2 className="mt-3 text-lg font-bold text-foreground">{user.name}</h2>
        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
          <Mail className="h-3 w-3" />
          {user.email}
        </p>
        <div className="mt-2 flex items-center justify-center gap-1.5">
          <Badge variant="secondary" className="bg-primary/10 text-primary border-0 font-medium">
            <MapPin className="h-3 w-3 mr-1" />
            {floorLabel(user.floor)}
          </Badge>
          {user.role === "admin" ? (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-0 font-medium">
              <ShieldCheck className="h-3 w-3 mr-1" />
              Admin
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Change password */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-3">
          <Lock className="h-4 w-4 text-primary" />
          Change Password
        </h3>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="current-pw">Current Password</Label>
            <Input
              id="current-pw"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-pw">New Password</Label>
              <Input
                id="new-pw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-pw">Confirm New Password</Label>
              <Input
                id="confirm-pw"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={changing}>
            {changing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            Change Password
          </Button>
        </form>
      </div>

      {user.role === "admin" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
          <ShieldCheck className="h-6 w-6 text-amber-600 mx-auto" />
          <p className="mt-2 text-xs text-amber-800">
            You have admin privileges. Use the Admin tab in the bottom navigation to manage the drug catalog.
          </p>
        </div>
      ) : null}

      <Button variant="outline" className="w-full" onClick={onLogout}>
        <LogOut className="h-4 w-4" />
        Sign Out
      </Button>

      <p className="text-center text-[10px] text-muted-foreground flex items-center justify-center gap-1">
        <HeartPulse className="h-3 w-3 text-primary" />
        MediPrice · Hospital Pharmacy Drug Pricing
      </p>
    </div>
  );
}
