import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/chat/AppShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile } from "@/hooks/use-my-profile";
import { Avatar, StatusDot } from "@/components/chat/UserBadge";
import { ShieldCheck, Check, X, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { ensureDmConversation } from "@/lib/chat-api";

export const Route = createFileRoute("/_authenticated/app/friends")({
  component: FriendsPage,
});

function FriendsPage() {
  const { data: me } = useMyProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: friendships = [] } = useQuery({
    queryKey: ["friendships", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase
        .from("friendships")
        .select("*")
        .or(`requester_id.eq.${me!.id},addressee_id.eq.${me!.id}`)
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const userIds = Array.from(new Set(friendships.flatMap((f) => [f.requester_id, f.addressee_id])));
  const { data: peers = [] } = useQuery({
    queryKey: ["friend-peers", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").in("id", userIds);
      return data ?? [];
    },
  });
  const byId = Object.fromEntries(peers.map((p) => [p.id, p]));

  const incoming = friendships.filter((f) => f.status === "pending" && f.addressee_id === me?.id);
  const outgoing = friendships.filter((f) => f.status === "pending" && f.requester_id === me?.id);
  const accepted = friendships.filter((f) => f.status === "accepted");

  async function respond(id: string, status: "accepted" | "blocked") {
    const { error } = await supabase.from("friendships").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["friendships"] });
  }

  async function dm(userId: string) {
    const id = await ensureDmConversation(userId);
    navigate({ to: "/app/dm/$id", params: { id } });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="font-display text-2xl font-bold">Friends</h1>

        <Section title="Incoming requests" empty="No new requests.">
          {incoming.map((f) => {
            const p = byId[f.requester_id];
            if (!p) return null;
            return (
              <Row peer={p} key={f.id}>
                <Button size="sm" onClick={() => respond(f.id, "accepted")} className="bg-brand text-primary-foreground hover:opacity-95"><Check className="mr-1 h-4 w-4" />Accept</Button>
                <Button size="sm" variant="ghost" onClick={() => respond(f.id, "blocked")}><X className="mr-1 h-4 w-4" />Decline</Button>
              </Row>
            );
          })}
        </Section>

        <Section title="Friends" empty="No friends yet — find people via Search.">
          {accepted.map((f) => {
            const peerId = f.requester_id === me?.id ? f.addressee_id : f.requester_id;
            const p = byId[peerId];
            if (!p) return null;
            return (
              <Row peer={p} key={f.id}>
                <Button size="sm" variant="outline" onClick={() => dm(p.id)}><MessageCircle className="mr-1 h-4 w-4" />Message</Button>
              </Row>
            );
          })}
        </Section>

        <Section title="Sent" empty="No outgoing requests.">
          {outgoing.map((f) => {
            const p = byId[f.addressee_id];
            if (!p) return null;
            return <Row peer={p} key={f.id}><span className="text-xs text-muted-foreground">Pending</span></Row>;
          })}
        </Section>
      </div>
    </AppShell>
  );
}

function Section({ title, empty, children }: any) {
  const arr = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <div className="mt-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="mt-2 space-y-2">
        {arr.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : children}
      </div>
    </div>
  );
}

function Row({ peer, children }: any) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/60 p-3">
      <Link to="/app/u/$shortId" params={{ shortId: peer.short_id.replace("#", "") }} className="flex min-w-0 items-center gap-3">
        <div className="relative">
          <Avatar profile={peer} size={36} />
          <StatusDot profile={peer} className="absolute -bottom-0.5 -right-0.5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-medium truncate">
            {peer.display_name} <ShieldCheck className="h-3.5 w-3.5 text-verified" />
          </div>
          <div className="text-xs text-muted-foreground">{peer.short_id}</div>
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}
