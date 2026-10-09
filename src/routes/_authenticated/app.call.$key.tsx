import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { z } from "zod";
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, Users } from "lucide-react";
import { useMyProfile } from "@/hooks/use-my-profile";
import { useCall } from "@/hooks/use-call";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/call/$key")({
  validateSearch: z.object({ video: z.boolean().optional(), back: z.string().optional() }),
  head: () => ({ meta: [{ title: "Call — Verified Chat" }, { name: "description", content: "Voice and video call with verified members." }] }),
  component: CallPage,
});

function CallPage() {
  const { key } = Route.useParams();
  const { video, back } = Route.useSearch();
  const navigate = useNavigate();
  const { data: me } = useMyProfile();
  const call = useCall(key, me ?? undefined, !!video);

  function leave() {
    if (back && back.startsWith("/app")) navigate({ to: back as any });
    else navigate({ to: "/app" });
  }

  const tiles = [{ id: "me", name: `${me?.display_name ?? "You"} (you)`, stream: call.local, muted: true, self: true }, ...call.peers.map((p) => ({ ...p, muted: false, self: false }))];
  const cols = tiles.length <= 1 ? "grid-cols-1" : tiles.length <= 4 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 lg:grid-cols-3";

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <div>
          <h1 className="font-display text-lg font-bold">{key.startsWith("dm-") ? "Private call" : "Group meeting"}</h1>
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" /> {tiles.length} in call</p>
        </div>
      </header>

      {call.error && <div className="mx-auto mt-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">{call.error}</div>}

      <div className={cn("grid flex-1 auto-rows-fr gap-3 overflow-y-auto p-4", cols)}>
        {tiles.map((t) => <Tile key={t.id} name={t.name} stream={t.stream} muted={t.muted} mirror={t.self && !call.sharing} />)}
      </div>
      {call.peers.length === 0 && !call.error && (
        <p className="pb-2 text-center text-sm text-muted-foreground">Waiting for others to join… they'll see a "Join call" card in the chat.</p>
      )}

      <footer className="flex items-center justify-center gap-3 border-t border-border p-4">
        <CtrlButton label={call.muted ? "Unmute" : "Mute"} active={call.muted} onClick={call.toggleMute}>{call.muted ? <MicOff /> : <Mic />}</CtrlButton>
        <CtrlButton label={call.camOff ? "Turn camera on" : "Turn camera off"} active={call.camOff} onClick={call.toggleCam}>{call.camOff ? <VideoOff /> : <Video />}</CtrlButton>
        <CtrlButton label={call.sharing ? "Stop sharing" : "Share screen"} active={call.sharing} onClick={call.toggleShare}><MonitorUp /></CtrlButton>
        <button onClick={leave} aria-label="Leave call" className="grid h-12 w-16 place-items-center rounded-full bg-destructive text-destructive-foreground hover:opacity-90">
          <PhoneOff className="h-5 w-5" />
        </button>
      </footer>
    </div>
  );
}

function CtrlButton({ children, label, active, onClick }: { children: React.ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={label} title={label}
      className={cn("grid h-12 w-12 place-items-center rounded-full border border-border [&_svg]:h-5 [&_svg]:w-5", active ? "bg-foreground text-background" : "bg-card hover:bg-accent")}>
      {children}
    </button>
  );
}

function Tile({ name, stream, muted, mirror }: { name: string; stream: MediaStream | null; muted: boolean; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream; }, [stream]);
  const hasVideo = !!stream?.getVideoTracks().some((t) => t.enabled && t.readyState === "live");
  return (
    <div className="relative min-h-40 overflow-hidden rounded-2xl border border-border bg-card">
      <video ref={ref} autoPlay playsInline muted={muted} className={cn("h-full w-full object-cover", !hasVideo && "opacity-0", mirror && "-scale-x-100")} />
      {!hasVideo && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-brand font-display text-2xl font-bold text-primary-foreground shadow-glow">
            {name.slice(0, 1).toUpperCase()}
          </div>
        </div>
      )}
      <span className="absolute bottom-2 left-2 rounded-md bg-background/80 px-2 py-0.5 text-xs font-medium backdrop-blur">{name}</span>
    </div>
  );
}
