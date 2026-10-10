import { useEffect, useState } from "react";
import { Bell, Camera, Check, Loader2, Mic, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Access = "camera" | "microphone" | "notifications";
type Status = "ready" | "granted" | "blocked" | "unavailable" | "error";
const options = [
  { key: "camera" as const, label: "Camera", icon: Camera },
  { key: "microphone" as const, label: "Microphone", icon: Mic },
  { key: "notifications" as const, label: "Notifications", icon: Bell },
];

export function PermissionPrompt({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Access | "all" | null>(null);
  const [status, setStatus] = useState<Record<Access, Status>>({ camera: "ready", microphone: "ready", notifications: "ready" });
  const key = `chat-permissions:${userId}`;

  useEffect(() => {
    try { setOpen(sessionStorage.getItem(key) !== "done"); } catch { setOpen(true); }
    setStatus((current) => ({ ...current, notifications: typeof Notification === "undefined" ? "unavailable" : Notification.permission === "granted" ? "granted" : Notification.permission === "denied" ? "blocked" : "ready" }));
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        try { sessionStorage.removeItem(key); } catch { /* Storage may be disabled. */ }
      }
    });
    return () => data.subscription.unsubscribe();
  }, [key]);

  function close() {
    try { sessionStorage.setItem(key, "done"); } catch { /* Chat still works without storage. */ }
    setOpen(false);
  }

  async function request(access: Access) {
    let result: Status = "error";
    try {
      if (access === "notifications") {
        if (typeof Notification === "undefined") result = "unavailable";
        else {
          const permission = await Notification.requestPermission();
          result = permission === "granted" ? "granted" : permission === "denied" ? "blocked" : "ready";
        }
      } else if (!navigator.mediaDevices?.getUserMedia) result = "unavailable";
      else {
        const stream = await navigator.mediaDevices.getUserMedia(access === "camera" ? { video: true } : { audio: true });
        // Permission setup must never leave a camera or microphone recording.
        stream.getTracks().forEach((track) => track.stop());
        result = "granted";
      }
    } catch (error) {
      if (error instanceof DOMException) {
        result = error.name === "NotAllowedError" || error.name === "SecurityError" ? "blocked" : error.name === "NotFoundError" ? "unavailable" : "error";
      }
    }
    setStatus((current) => ({ ...current, [access]: result }));
  }

  async function enable(access: Access | "all") {
    setBusy(access);
    try {
      if (access === "all") {
        // Notifications need the original button gesture in some browsers.
        const notifications = status.notifications === "ready" || status.notifications === "error" ? request("notifications") : Promise.resolve();
        for (const media of ["camera", "microphone"] as const) {
          if (status[media] === "ready" || status[media] === "error") await request(media);
        }
        await notifications;
      } else await request(access);
    } finally { setBusy(null); }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) close(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md" onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onInteractOutside={(event) => { if (busy) event.preventDefault(); }}>
        <DialogHeader>
          <ShieldCheck className="mb-2 h-8 w-8 text-primary" />
          <DialogTitle>Welcome! Allow app permissions</DialogTitle>
          <DialogDescription>Allow camera, microphone, and notifications? Your browser will ask you to confirm each permission. You can still chat without them.</DialogDescription>
        </DialogHeader>
        <div className="divide-y divide-border">
          {options.map(({ key: access, label, icon: Icon }) => (
            <div key={access} className="flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3"><Icon className="h-5 w-5 shrink-0 text-muted-foreground" /><div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{status[access] === "blocked" ? "Blocked — change browser site settings" : status[access] === "unavailable" ? "Not available on this device" : status[access] === "error" ? "Could not connect. Try again." : status[access] === "granted" ? "Allowed" : "Optional"}</p></div></div>
              {status[access] === "granted" ? <Check aria-label={`${label} allowed`} className="h-5 w-5 shrink-0 text-verified" /> : <Button size="sm" variant="outline" disabled={busy !== null || status[access] === "blocked" || status[access] === "unavailable"} onClick={() => void enable(access)}>{busy === access ? <Loader2 className="h-4 w-4 animate-spin" /> : "Allow"}</Button>}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Camera and microphone are switched off after this check. Screen sharing and file access are requested only when you choose them.</p>
        <Button disabled={busy !== null || options.every(({ key: access }) => status[access] !== "ready" && status[access] !== "error")} onClick={() => void enable("all")}>{busy === "all" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Allow all</Button>
        <Button variant="ghost" disabled={busy !== null} onClick={close}>{options.every(({ key: access }) => status[access] === "granted") ? "Continue to chat" : "Not now — continue to chat"}</Button>
      </DialogContent>
    </Dialog>
  );
}