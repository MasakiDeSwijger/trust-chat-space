import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePresence(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    const beat = () => {
      supabase.from("profiles").update({ last_seen: new Date().toISOString(), status: "online" }).eq("id", userId);
    };
    beat();
    const interval = setInterval(beat, 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") beat(); };
    document.addEventListener("visibilitychange", onVisible);
    const beforeUnload = () => {
      supabase.from("profiles").update({ status: "offline", last_seen: new Date().toISOString() }).eq("id", userId);
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [userId]);
}
