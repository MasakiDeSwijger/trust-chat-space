import { cn } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";
import type { Profile } from "@/lib/chat-api";
import { Link } from "@tanstack/react-router";

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function isOnline(p: Profile) {
  const ts = new Date(p.last_seen).getTime();
  return Date.now() - ts < 90_000;
}

export function Avatar({ profile, size = 36, className }: { profile: Pick<Profile, "display_name" | "avatar_url" | "id">; size?: number; className?: string }) {
  return (
    <div
      className={cn("relative grid shrink-0 place-items-center rounded-full bg-brand font-display font-semibold text-primary-foreground", className)}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.4) }}
    >
      {profile.avatar_url ? (
        <img src={profile.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        initials(profile.display_name)
      )}
    </div>
  );
}

export function StatusDot({ profile, className }: { profile: Profile; className?: string }) {
  const online = isOnline(profile);
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full ring-2 ring-sidebar",
        online ? "bg-status-online" : profile.status === "away" ? "bg-status-away" : "bg-status-offline",
        className,
      )}
    />
  );
}

export function UserBadge({ profile, link = true }: { profile: Profile; link?: boolean }) {
  const inner = (
    <div className="flex items-center gap-3 min-w-0">
      <div className="relative">
        <Avatar profile={profile} size={36} />
        <StatusDot profile={profile} className="absolute -bottom-0 -right-0" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-medium truncate">
          {profile.display_name}
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-verified" />
        </div>
        <div className="text-xs text-muted-foreground truncate">{profile.short_id}</div>
      </div>
    </div>
  );
  if (!link) return inner;
  return (
    <Link to="/app/u/$shortId" params={{ shortId: profile.short_id.replace("#", "") }} className="block rounded-md px-2 py-1.5 hover:bg-sidebar-accent">
      {inner}
    </Link>
  );
}
