import { createFileRoute, useParams } from "@tanstack/react-router";
import { AppShell } from "@/components/chat/AppShell";
import { ChatView } from "@/components/chat/ChatView";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile } from "@/hooks/use-my-profile";

export const Route = createFileRoute("/_authenticated/app/dm/$id")({
  component: DMPage,
});

function DMPage() {
  const { id } = useParams({ from: "/_authenticated/app/dm/$id" });
  const { data: me } = useMyProfile();

  const { data: dm } = useQuery({
    queryKey: ["dm", id],
    queryFn: async () => {
      const { data } = await supabase.from("dm_conversations").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  const otherId = dm ? (dm.user_a === me?.id ? dm.user_b : dm.user_a) : null;
  const { data: peer } = useQuery({
    queryKey: ["profile", otherId],
    enabled: !!otherId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", otherId!).maybeSingle();
      return data;
    },
  });

  return (
    <AppShell>
      {!dm && <div className="grid h-full place-items-center text-muted-foreground">Loading…</div>}
      {dm && peer && (
        <ChatView kind="dm" id={dm.id} title={peer.display_name} subtitle={`${peer.short_id} · Direct message`} />
      )}
    </AppShell>
  );
}
