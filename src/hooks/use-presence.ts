import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type Status = "online" | "away" | "offline";

export function usePresence(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    const set = async (status: Status) => {
      const { error } = await supabase
        .from("profiles")
        .update({ last_seen: new Date().toISOString(), status })
        .eq("id", userId);
      if (error) console.error("presence update failed", error);
    };
    const current = (): Status => (document.visibilityState === "visible" ? "online" : "away");
    set(current());
    const interval = setInterval(() => set(current()), 25_000);
    const onVisible = () => set(current());
    const beforeUnload = () => { void set("offline"); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [userId]);
}
