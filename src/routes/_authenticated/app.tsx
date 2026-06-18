import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/chat/AppShell";
import { useMyProfile } from "@/hooks/use-my-profile";
import { ShieldCheck, Hash, Search, UserPlus } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Verified Chat" }] }),
  component: AppHome,
});

function AppHome() {
  const { data: me } = useMyProfile();
  return (
    <AppShell>
      <div className="grid min-h-full place-items-center p-8">
        <div className="max-w-md text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand shadow-glow">
            <ShieldCheck className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="mt-5 font-display text-2xl font-bold">
            {me ? `Welcome, ${me.display_name}` : "Welcome"}
          </h1>
          {me && (
            <p className="mt-1 text-sm text-muted-foreground">
              Your verified ID is <span className="font-mono text-foreground">{me.short_id}</span>
            </p>
          )}
          <p className="mt-4 text-sm text-muted-foreground">Jump into a public room, find friends, or start a private conversation.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link to="/app/room/$slug" params={{ slug: "lobby" }} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-95"><Hash className="h-4 w-4" /> Enter Lobby</Link>
            <Link to="/app/search" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-4 py-2 text-sm font-semibold hover:bg-card"><Search className="h-4 w-4" /> Find people</Link>
            <Link to="/app/friends" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/60 px-4 py-2 text-sm font-semibold hover:bg-card"><UserPlus className="h-4 w-4" /> Friends</Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
