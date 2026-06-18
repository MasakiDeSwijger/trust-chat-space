import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/chat/AppShell";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensureDmConversation, getProfileByShortId } from "@/lib/chat-api";
import { Avatar, StatusDot } from "@/components/chat/UserBadge";
import { ShieldCheck, MessageCircle, UserPlus, UserCheck, UserX, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMyProfile } from "@/hooks/use-my-profile";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/app/u/$shortId")({
  component: ProfilePage,
});

function ProfilePage() {
  const { shortId } = useParams({ from: "/_authenticated/app/u/$shortId" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useMyProfile();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile-short", shortId],
    queryFn: () => getProfileByShortId(shortId),
  });

  const { data: friendship } = useQuery({
    queryKey: ["friendship", me?.id, profile?.id],
    enabled: !!me && !!profile && me.id !== profile.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("friendships")
        .select("*")
        .or(`and(requester_id.eq.${me!.id},addressee_id.eq.${profile!.id}),and(requester_id.eq.${profile!.id},addressee_id.eq.${me!.id})`)
        .maybeSingle();
      return data;
    },
  });

  async function startDm() {
    if (!profile) return;
    const dmId = await ensureDmConversation(profile.id);
    navigate({ to: "/app/dm/$id", params: { id: dmId } });
  }

  async function sendFriendRequest() {
    if (!me || !profile) return;
    const { error } = await supabase.from("friendships").insert({ requester_id: me.id, addressee_id: profile.id });
    if (error) toast.error(error.message); else { toast.success("Friend request sent"); qc.invalidateQueries({ queryKey: ["friendship"] }); }
  }

  async function reportUser() {
    if (!me || !profile) return;
    const reason = prompt("Why are you reporting this user?");
    if (!reason) return;
    const { error } = await supabase.from("reports").insert({ reporter_id: me.id, target_user_id: profile.id, reason });
    if (error) toast.error(error.message); else toast.success("Reported");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-6 py-10">
        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {!isLoading && !profile && <p className="text-muted-foreground">User not found.</p>}
        {profile && (
          <div className="rounded-2xl border border-border bg-card/60 p-6 shadow-soft backdrop-blur">
            <div className="flex items-start gap-4">
              <div className="relative">
                <Avatar profile={profile} size={80} className="text-2xl" />
                <StatusDot profile={profile} className="absolute -bottom-1 -right-1 h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-2xl font-bold truncate">{profile.display_name}</h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-verified/15 px-2 py-0.5 text-[11px] font-semibold text-verified">
                    <ShieldCheck className="h-3 w-3" /> Verified
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">@{profile.username} · <span className="font-mono">{profile.short_id}</span></div>
                {profile.bio && <p className="mt-3 text-sm">{profile.bio}</p>}
              </div>
            </div>

            {me?.id !== profile.id && (
              <div className="mt-6 flex flex-wrap gap-2">
                <Button onClick={startDm} className="bg-brand text-primary-foreground hover:opacity-95">
                  <MessageCircle className="mr-2 h-4 w-4" /> Message
                </Button>
                {!friendship && (
                  <Button onClick={sendFriendRequest} variant="outline">
                    <UserPlus className="mr-2 h-4 w-4" /> Add friend
                  </Button>
                )}
                {friendship?.status === "pending" && friendship.requester_id === me?.id && (
                  <Button variant="outline" disabled><UserCheck className="mr-2 h-4 w-4" /> Request sent</Button>
                )}
                {friendship?.status === "accepted" && (
                  <Button variant="outline" disabled><UserCheck className="mr-2 h-4 w-4" /> Friends</Button>
                )}
                <Button onClick={reportUser} variant="ghost" className="text-destructive hover:text-destructive">
                  <Flag className="mr-2 h-4 w-4" /> Report
                </Button>
              </div>
            )}

            {me?.id === profile.id && <EditProfile profile={profile} />}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function EditProfile({ profile }: { profile: any }) {
  const [bio, setBio] = useState(profile.bio ?? "");
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ bio, display_name: displayName }).eq("id", profile.id);
    setSaving(false);
    if (error) toast.error(error.message); else { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["my-profile"] }); }
  }

  return (
    <div className="mt-6 space-y-3 border-t border-border pt-6">
      <h2 className="font-display text-sm font-semibold text-muted-foreground">Edit profile</h2>
      <div>
        <label className="text-xs font-medium">Display name</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="text-xs font-medium">Bio</label>
        <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={280} placeholder="A line about you" />
      </div>
      <Button onClick={save} disabled={saving} className="bg-brand text-primary-foreground hover:opacity-95">
        {saving ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
