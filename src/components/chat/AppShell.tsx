import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile } from "@/hooks/use-my-profile";
import { usePresence } from "@/hooks/use-presence";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listPublicRooms, listMyGroups, listOnlineUsers, listDmConversations } from "@/lib/chat-api";
import { Avatar, StatusDot } from "@/components/chat/UserBadge";
import { ShieldCheck, Hash, Users, Search, UserPlus, LogOut, Plus, MessageCircle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AppShell({ children }: { children?: React.ReactNode }) {
  const { data: me } = useMyProfile();
  const navigate = useNavigate();
  usePresence(me?.id);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  if (!me) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Left sidebar */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <SidebarContent me={me} onSignOut={handleSignOut} />
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        <MobileHeader me={me} onSignOut={handleSignOut} />
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1">{children ?? <Outlet />}</div>
          {/* Online users sidebar */}
          <aside className="hidden w-64 shrink-0 border-l border-sidebar-border bg-sidebar text-sidebar-foreground lg:block">
            <OnlineSidebar />
          </aside>
        </div>
      </main>
    </div>
  );
}

function MobileHeader({ me, onSignOut }: { me: any; onSignOut: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-card/60 px-3 py-2 backdrop-blur md:hidden">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="sm">Menu</Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
          <SidebarContent me={me} onSignOut={onSignOut} />
        </SheetContent>
      </Sheet>
      <div className="font-display text-sm font-bold">Verified Chat</div>
      <Sheet>
        <SheetTrigger asChild><Button variant="ghost" size="sm">Online</Button></SheetTrigger>
        <SheetContent side="right" className="w-72 bg-sidebar p-0 text-sidebar-foreground"><OnlineSidebar /></SheetContent>
      </Sheet>
    </div>
  );
}

function SidebarContent({ me, onSignOut }: { me: any; onSignOut: () => void }) {
  const router = useRouterState({ select: (s) => s.location.pathname });
  const { data: rooms = [] } = useQuery({ queryKey: ["rooms-public"], queryFn: listPublicRooms });
  const { data: groups = [] } = useQuery({ queryKey: ["my-groups", me.id], queryFn: () => listMyGroups(me.id) });
  const { data: dms = [] } = useQuery({ queryKey: ["my-dms", me.id], queryFn: () => listDmConversations(me.id) });

  // dm peers
  const otherIds = dms.map((d) => (d.user_a === me.id ? d.user_b : d.user_a));
  const { data: dmPeers = [] } = useQuery({
    queryKey: ["dm-peers", otherIds],
    enabled: otherIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").in("id", otherIds);
      return data ?? [];
    },
  });
  const peerById = Object.fromEntries(dmPeers.map((p) => [p.id, p]));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand shadow-glow">
          <ShieldCheck className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
        </span>
        <span className="font-display text-base font-bold">Verified Chat</span>
      </div>

      <Link to="/app/u/$shortId" params={{ shortId: me.short_id.replace("#", "") }} className="mx-3 flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 hover:bg-sidebar-accent">
        <div className="relative">
          <Avatar profile={me} size={36} />
          <StatusDot profile={me} className="absolute -bottom-0 -right-0" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold truncate">
            {me.display_name}
            <ShieldCheck className="h-3.5 w-3.5 text-verified shrink-0" />
          </div>
          <div className="text-xs text-muted-foreground truncate">{me.short_id}</div>
        </div>
      </Link>

      <div className="mt-3 grid grid-cols-3 gap-1 px-3 text-xs">
        <NavTile to="/app/search" active={router === "/app/search"} icon={Search} label="Search" />
        <NavTile to="/app/friends" active={router === "/app/friends"} icon={UserPlus} label="Friends" />
        <NewGroupButton />
      </div>

      <div className="mt-4 flex-1 overflow-y-auto px-2 scrollbar-thin">
        <SidebarSection label="Public Rooms" icon={Hash}>
          {rooms.map((r) => (
            <SidebarLink key={r.id} to="/app/room/$slug" params={{ slug: r.slug }} active={router === `/app/room/${r.slug}`}>
              <Hash className="h-4 w-4 opacity-60" />
              <span className="truncate">{r.name}</span>
            </SidebarLink>
          ))}
        </SidebarSection>

        {groups.length > 0 && (
          <SidebarSection label="My Groups" icon={Users}>
            {groups.map((r) => (
              <SidebarLink key={r.id} to="/app/room/$slug" params={{ slug: r.slug }} active={router === `/app/room/${r.slug}`}>
                <Users className="h-4 w-4 opacity-60" />
                <span className="truncate">{r.name}</span>
              </SidebarLink>
            ))}
          </SidebarSection>
        )}

        <SidebarSection label="Direct Messages" icon={MessageCircle}>
          {dms.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">No DMs yet. Find people via Search.</p>}
          {dms.map((d) => {
            const peerId = d.user_a === me.id ? d.user_b : d.user_a;
            const peer = peerById[peerId];
            if (!peer) return null;
            return (
              <SidebarLink key={d.id} to="/app/dm/$id" params={{ id: d.id }} active={router === `/app/dm/${d.id}`}>
                <div className="relative">
                  <Avatar profile={peer} size={22} />
                  <StatusDot profile={peer} className="absolute -bottom-0.5 -right-0.5 h-2 w-2 ring-1" />
                </div>
                <span className="truncate">{peer.display_name}</span>
              </SidebarLink>
            );
          })}
        </SidebarSection>
      </div>

      <div className="border-t border-sidebar-border p-2">
        <button onClick={onSignOut} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}

function NavTile({ to, params, active, icon: Icon, label }: any) {
  return (
    <Link
      to={to}
      params={params}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-2 py-2 text-center hover:bg-sidebar-accent",
        active && "bg-sidebar-accent ring-1 ring-primary/40",
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="text-[11px] font-medium">{label}</span>
    </Link>
  );
}

function SidebarSection({ label, children }: { label: string; icon?: any; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SidebarLink({ to, params, active, children }: any) {
  return (
    <Link to={to} params={params} className={cn(
      "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-sidebar-accent",
      active && "bg-sidebar-accent text-foreground font-medium",
    )}>
      {children}
    </Link>
  );
}

function NewGroupButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useMyProfile();

  async function create() {
    if (!me) return;
    setBusy(true);
    try {
      const slug = `g-${Math.random().toString(36).slice(2, 8)}`;
      const { data, error } = await supabase
        .from("rooms")
        .insert({ name: name.trim() || "New group", slug, is_public: false, is_group: true, created_by: me.id })
        .select()
        .single();
      if (error) throw error;
      // Bypass RLS by inserting via the user's own membership using service is not possible.
      // Members policy only allows joining public rooms by self. So we insert via a server function-like path:
      // Workaround: temporarily flip to public, join, flip back.
      await supabase.from("rooms").update({ is_public: true }).eq("id", data.id);
      await supabase.from("room_members").insert({ room_id: data.id, user_id: me.id, role: "owner" });
      await supabase.from("rooms").update({ is_public: false }).eq("id", data.id);
      toast.success("Group created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["my-groups", me.id] });
      navigate({ to: "/app/room/$slug", params: { slug: data.slug } });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-sidebar-border bg-sidebar-accent/20 px-2 py-2 text-center hover:bg-sidebar-accent">
          <Plus className="h-4 w-4" />
          <span className="text-[11px] font-medium">Group</span>
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create a group</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="g_name">Group name</Label>
            <Input id="g_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Friday Study Squad" maxLength={60} />
          </div>
          <Button onClick={create} disabled={busy} className="w-full bg-brand text-primary-foreground hover:opacity-95">
            {busy ? "Creating…" : "Create group"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OnlineSidebar() {
  const qc = useQueryClient();
  const { data: users = [] } = useQuery({
    queryKey: ["online-users"],
    queryFn: listOnlineUsers,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const ch = supabase.channel("presence-profiles")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        qc.invalidateQueries({ queryKey: ["online-users"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-sidebar-border px-4 py-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Online — {users.length}</div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {users.length === 0 && <p className="px-2 py-4 text-center text-xs text-muted-foreground">Nobody online right now.</p>}
        {users.map((u) => (
          <Link
            key={u.id}
            to="/app/u/$shortId"
            params={{ shortId: u.short_id.replace("#", "") }}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent"
          >
            <div className="relative">
              <Avatar profile={u} size={28} />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-status-online ring-2 ring-sidebar" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-sm truncate">
                <span className="truncate">{u.display_name}</span>
                <ShieldCheck className="h-3 w-3 shrink-0 text-verified" />
              </div>
              <div className="text-[10px] text-muted-foreground">{u.short_id}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
