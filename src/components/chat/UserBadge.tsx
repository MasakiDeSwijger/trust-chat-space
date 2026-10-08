import { cn } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";
import type { Profile } from "@/lib/chat-api";
import { Link } from "@tanstack/react-router";

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export type LiveStatus = "online" | "away" | "offline";

export function liveStatus(p: Pick<Profile, "last_seen" | "status">): LiveStatus {
  const recent = Date.now() - new Date(p.last_seen).getTime() < 75_000;
  if (!recent || p.status === "offline") return "offline";
  return p.status === "away" ? "away" : "online";
}

export function lastSeenText(p: Pick<Profile, "last_seen" | "status">) {
  const s = liveStatus(p);
  if (s === "online") return "Online";
  if (s === "away") return "Away";
  const mins = Math.round((Date.now() - new Date(p.last_seen).getTime()) / 60000);
  if (mins < 60) return `Last seen ${Math.max(1, mins)}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `Last seen ${h}h ago`;
  return `Last seen ${Math.round(h / 24)}d ago`;
}

export function Avatar({ profile, size = 36, className }: { profile: Pick<Profile, "display_name" | "avatar_url" | "id">; size?: number; className?: string }) {
  return (
    <div
      className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-brand font-display font-semibold text-primary-foreground", className)}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.4) }}
    >
      {profile.avatar_url ? (
        <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(profile.display_name)
      )}
    </div>
  );
}

export function StatusDot({ profile, className }: { profile: Profile; className?: string }) {
  const s = liveStatus(profile);
  return (
    <span
      title={lastSeenText(profile)}
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full ring-2 ring-sidebar",
        s === "online" && "bg-status-online",
        s === "away" && "bg-status-away",
        s === "offline" && "bg-status-offline",
        className,
      )}
    >
      {s === "online" && <span className="absolute inset-0 animate-ping rounded-full bg-status-online opacity-40" />}
    </span>
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
        <div className="text-xs text-muted-foreground truncate">{lastSeenText(profile)}</div>
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
