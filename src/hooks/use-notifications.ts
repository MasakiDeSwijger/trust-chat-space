import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { applyTheme, getStoredTheme } from "@/lib/themes";

/** Global listener: new messages in rooms/DMs you can see → toast + desktop notification. */
export function useNotifications(myId: string | undefined) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  useEffect(() => { applyTheme(getStoredTheme()); }, []);

  useEffect(() => {
    if (!myId) return;
    const ch = supabase
      .channel(`notify-${myId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
        const m = payload.new as any;
        if (m.sender_id === myId) return;
        let target: string | null = null;
        let place = "";
        if (m.dm_id) {
          target = `/app/dm/${m.dm_id}`;
          place = "sent you a message";
        } else if (m.room_id) {
          const { data: mem } = await supabase.from("room_members").select("room_id").eq("room_id", m.room_id).eq("user_id", myId).maybeSingle();
          if (!mem) return; // only rooms you've joined
          const { data: room } = await supabase.from("rooms").select("slug,name").eq("id", m.room_id).maybeSingle();
          if (!room) return;
          target = `/app/room/${room.slug}`;
          place = `in #${room.name}`;
        }
        if (!target || window.location.pathname === target && document.visibilityState === "visible") return;
        const { data: sender } = await supabase.from("profiles").select("display_name").eq("id", m.sender_id).maybeSingle();
        const who = sender?.display_name ?? "Someone";
        const body = m.content ? String(m.content).slice(0, 120) : m.attachment_type?.startsWith("audio/") ? "🎤 Voice message" : "📎 Attachment";
        const go = () => navigate({ to: target! });
        toast(`${who} ${place}`, { description: body, action: { label: "Open", onClick: go } });
        if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
          const n = new Notification(`${who} ${place}`, { body });
          n.onclick = () => { window.focus(); go(); };
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [myId, navigate]);

  return path;
}
