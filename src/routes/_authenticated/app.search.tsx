import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/chat/AppShell";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { ensureDmConversation, searchUsers } from "@/lib/chat-api";
import { Avatar, StatusDot } from "@/components/chat/UserBadge";
import { ShieldCheck, MessageCircle, Search as SearchIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/search")({
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { data: results = [], isFetching } = useQuery({
    queryKey: ["search", q],
    queryFn: () => searchUsers(q),
    enabled: q.trim().length > 0,
  });

  async function dm(userId: string) {
    const id = await ensureDmConversation(userId);
    navigate({ to: "/app/dm/$id", params: { id } });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-6 py-8">
        <h1 className="font-display text-2xl font-bold">Find people</h1>
        <p className="mt-1 text-sm text-muted-foreground">Search by display name, username, or #ID.</p>

        <div className="relative mt-5">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="AlexGamer or #58291" className="pl-9" autoFocus />
        </div>

        <div className="mt-5 space-y-2">
          {q && !isFetching && results.length === 0 && <p className="text-sm text-muted-foreground">No matches.</p>}
          {results.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/60 p-3">
              <Link to="/app/u/$shortId" params={{ shortId: p.short_id.replace("#", "") }} className="flex min-w-0 items-center gap-3">
                <div className="relative">
                  <Avatar profile={p} size={40} />
                  <StatusDot profile={p} className="absolute -bottom-0.5 -right-0.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {p.display_name}
                    <ShieldCheck className="h-3.5 w-3.5 text-verified" />
                  </div>
                  <div className="text-xs text-muted-foreground">@{p.username} · {p.short_id}</div>
                </div>
              </Link>
              <Button size="sm" variant="outline" onClick={() => dm(p.id)}>
                <MessageCircle className="mr-1.5 h-4 w-4" /> Message
              </Button>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
