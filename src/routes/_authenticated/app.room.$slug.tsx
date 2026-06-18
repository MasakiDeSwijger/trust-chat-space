import { createFileRoute, useParams } from "@tanstack/react-router";
import { AppShell } from "@/components/chat/AppShell";
import { ChatView } from "@/components/chat/ChatView";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useMyProfile } from "@/hooks/use-my-profile";

export const Route = createFileRoute("/_authenticated/app/room/$slug")({
  component: RoomPage,
});

function RoomPage() {
  const { slug } = useParams({ from: "/_authenticated/app/room/$slug" });
  const { data: me } = useMyProfile();
  const qc = useQueryClient();

  const { data: room, isLoading } = useQuery({
    queryKey: ["room", slug],
    queryFn: async () => {
      const { data } = await supabase.from("rooms").select("*").eq("slug", slug).maybeSingle();
      return data;
    },
  });

  // Auto-join public rooms so messages can be sent
  useEffect(() => {
    if (!room || !me) return;
    if (!room.is_public) return;
    supabase.from("room_members").upsert({ room_id: room.id, user_id: me.id }, { onConflict: "room_id,user_id" }).then(() => {
      qc.invalidateQueries({ queryKey: ["my-groups", me.id] });
    });
  }, [room?.id, me?.id]);

  return (
    <AppShell>
      {isLoading && <div className="grid h-full place-items-center text-muted-foreground">Loading room…</div>}
      {!isLoading && !room && <div className="grid h-full place-items-center text-muted-foreground">Room not found.</div>}
      {room && <ChatView kind="room" id={room.id} title={`#${room.name}`} subtitle={room.description ?? undefined} />}
    </AppShell>
  );
}
