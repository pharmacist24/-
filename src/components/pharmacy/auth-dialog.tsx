"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useAuthStore, FLOOR_OPTIONS } from "@/lib/auth-store";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: "login" | "signup";
}

export function AuthDialog({
  open,
  onOpenChange,
  initialMode = "signup",
}: AuthDialogProps) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [floor, setFloor] = useState("10");
  const [submitting, setSubmitting] = useState(false);
  const { signup, login } = useAuthStore();
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const user = await signup({ name, email, password, floor });
        toast({
          title: "Account created",
          description: `Welcome, ${user.name} (${user.floor}).`,
        });
      } else {
        const user = await login(email, password);
        toast({
          title: "Signed in",
          description: `Welcome back, ${user.name}.`,
        });
      }
      // reset + close
      setName("");
      setEmail("");
      setPassword("");
      onOpenChange(false);
    } catch (err) {
      toast({
        title: mode === "signup" ? "Sign up failed" : "Sign in failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] max-h-[92vh] overflow-y-auto scroll-slim">
        <DialogHeader>
          <DialogTitle>
            {mode === "signup" ? "Create Account" : "Sign In"}
          </DialogTitle>
          <DialogDescription>
            {mode === "signup"
              ? "Create an account to access your floor's drug data."
              : "Welcome back. Sign in to continue."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "signup" ? (
            <div className="space-y-1.5">
              <Label htmlFor="auth-name">Full Name</Label>
              <Input
                id="auth-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dr. Ahmed"
                required
                autoFocus
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="auth-email">Email</Label>
            <Input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@hospital.iq"
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth-password">Password</Label>
            <Input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>

          {mode === "signup" ? (
            <div className="space-y-1.5">
              <Label htmlFor="auth-floor">Floor / Department</Label>
              <Select value={floor} onValueChange={setFloor}>
                <SelectTrigger id="auth-floor">
                  <SelectValue placeholder="Select your floor" />
                </SelectTrigger>
                <SelectContent>
                  {FLOOR_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={submitting}>
            {mode === "signup" ? "Create Account" : "Sign In"}
          </Button>

          <div className="text-center text-xs text-muted-foreground">
            {mode === "signup" ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => setMode("login")}
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Need an account?{" "}
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => setMode("signup")}
                >
                  Create one
                </button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
