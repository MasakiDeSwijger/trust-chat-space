import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, Mail, Phone, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional().default("signin"),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in — Trusty" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: search.redirect || "/app" });
    });
  }, [navigate, search.redirect]);

  async function handleEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "");
    const password = String(fd.get("password") || "");
    const display_name = String(fd.get("display_name") || "");

    try {
      if (mode === "signup") {
        if (password.length < 8) throw new Error("Password must be at least 8 characters");
        if (display_name.trim().length < 2) throw new Error("Pick a display name");
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin + "/app",
            data: { display_name: display_name.trim() },
          },
        });
        if (error) throw error;
        toast.success("Account created — you're in!");
        navigate({ to: "/app" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        navigate({ to: search.redirect || "/app" });
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/app" });
      if (result.error) throw result.error;
      if (!result.redirected) navigate({ to: "/app" });
    } catch (err: any) {
      toast.error(err.message || "Google sign-in failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-10">
      <Link to="/" className="mx-auto flex max-w-md items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="mx-auto mt-6 max-w-md rounded-2xl border border-border bg-card/80 p-8 shadow-soft backdrop-blur">
        <div className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand shadow-glow">
            <ShieldCheck className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
          </span>
          Trusty
        </div>
        <h1 className="mt-6 font-display text-2xl font-bold">
          {mode === "signin" ? "Welcome back" : "Get verified"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin" ? "Sign in to your account." : "Create your verified profile in seconds."}
        </p>

        <Button onClick={handleGoogle} disabled={loading} variant="outline" className="mt-6 w-full justify-center gap-2">
          <GoogleIcon /> Continue with Google
        </Button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
        </div>

        <Tabs defaultValue="email" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="email"><Mail className="mr-2 h-4 w-4" /> Email</TabsTrigger>
            <TabsTrigger value="phone"><Phone className="mr-2 h-4 w-4" /> Phone</TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="mt-4">
            <form onSubmit={handleEmail} className="space-y-3">
              {mode === "signup" && (
                <div>
                  <Label htmlFor="display_name">Display name</Label>
                  <Input id="display_name" name="display_name" placeholder="AlexGamer" required minLength={2} maxLength={40} />
                </div>
              )}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="you@example.com" required />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" placeholder="••••••••" required minLength={8} />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-brand text-primary-foreground hover:opacity-95">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "signin" ? "Sign in" : "Create account"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="phone" className="mt-4">
            <PhoneAuth mode={mode} onDone={() => navigate({ to: "/app" })} />
          </TabsContent>
        </Tabs>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New here?" : "Already verified?"}{" "}
          <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="font-medium text-primary hover:underline">
            {mode === "signin" ? "Create account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}

function PhoneAuth({ mode, onDone }: { mode: "signin" | "signup"; onDone: () => void }) {
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const cleaned = phone.replace(/[^\d+]/g, "");
      if (!cleaned.startsWith("+")) throw new Error("Include country code, e.g. +14155550100");
      if (mode === "signup" && displayName.trim().length < 2) throw new Error("Pick a display name");
      const { error } = await supabase.auth.signInWithOtp({
        phone: cleaned,
        options: mode === "signup" ? { data: { display_name: displayName.trim() } } : undefined,
      });
      if (error) throw error;
      toast.success("Code sent — check your phone");
      setStage("otp");
    } catch (err: any) {
      toast.error(err.message || "Failed to send code");
    } finally { setLoading(false); }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const cleaned = phone.replace(/[^\d+]/g, "");
      const { error } = await supabase.auth.verifyOtp({ phone: cleaned, token: otp, type: "sms" });
      if (error) throw error;
      toast.success("Verified!");
      onDone();
    } catch (err: any) {
      toast.error(err.message || "Invalid code");
    } finally { setLoading(false); }
  }

  if (stage === "phone") {
    return (
      <form onSubmit={sendOtp} className="space-y-3">
        {mode === "signup" && (
          <div>
            <Label htmlFor="ph_name">Display name</Label>
            <Input id="ph_name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="AlexGamer" required />
          </div>
        )}
        <div>
          <Label htmlFor="phone">Phone (with country code)</Label>
          <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+14155550100" required />
          <p className="mt-1 text-xs text-muted-foreground">
            Phone sign-in requires SMS to be configured in backend settings.
          </p>
        </div>
        <Button type="submit" disabled={loading} className="w-full bg-brand text-primary-foreground hover:opacity-95">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Send code
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={verifyOtp} className="space-y-3">
      <div>
        <Label htmlFor="otp">Verification code</Label>
        <Input id="otp" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" inputMode="numeric" required />
      </div>
      <Button type="submit" disabled={loading} className="w-full bg-brand text-primary-foreground hover:opacity-95">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Verify & sign in
      </Button>
      <button type="button" onClick={() => setStage("phone")} className="w-full text-center text-xs text-muted-foreground hover:text-foreground">
        Use a different number
      </button>
    </form>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.6 14.6 2.7 12 2.7 6.9 2.7 2.8 6.8 2.8 12s4.1 9.3 9.2 9.3c5.3 0 8.8-3.7 8.8-9 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}
