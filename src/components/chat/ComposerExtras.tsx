import { useEffect, useRef, useState } from "react";
import { Smile, Sticker, Mic, Square, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const EMOJI_GROUPS: Record<string, string[]> = {
  Smileys: "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 😉 😊 😇 🥰 😍 🤩 😘 😋 😛 😜 🤪 🤗 🤭 🤫 🤔 😐 😏 😒 🙄 😬 😌 😔 😴 🤒 🤯 🥳 😎 🤓 😕 😟 😮 😲 😳 🥺 😢 😭 😱 😤 😡 🤬 💀 🤡 👻 👽 🤖".split(" "),
  Gestures: "👍 👎 👌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ✋ 👋 👏 🙌 🙏 💪 🫶 🤝 ✍️".split(" "),
  Hearts: "❤️ 🧡 💛 💚 💙 🩵 🤍 🖤 💔 💕 💞 💓 💗 💖 💘 💝 ✨ ⭐ 🌟 💫 🔥 💯".split(" "),
  Fun: "🎉 🎊 🎈 🎁 🏆 🥇 🎮 🕹️ 🎲 🎯 🎵 🎶 🎧 📚 ✏️ 💡 🚀 ⚽ 🏀 🍕 🍔 🍟 🍩 🍪 ☕ 🧋 🐶 🐱 🦊 🐼 🐸 🦄 🌈 ☀️ 🌙".split(" "),
};

export const STICKERS = [
  { id: "hype", emoji: "🔥", label: "HYPE" },
  { id: "gg", emoji: "🎮", label: "GG" },
  { id: "lol", emoji: "😂", label: "LOL" },
  { id: "love", emoji: "💖", label: "LOVE IT" },
  { id: "wow", emoji: "🤯", label: "WOW" },
  { id: "thanks", emoji: "🙏", label: "THANKS" },
  { id: "hi", emoji: "👋", label: "HELLO!" },
  { id: "party", emoji: "🥳", label: "PARTY" },
  { id: "nope", emoji: "🙅", label: "NOPE" },
  { id: "brb", emoji: "🏃", label: "BRB" },
  { id: "verified", emoji: "✅", label: "VERIFIED" },
  { id: "sleep", emoji: "😴", label: "GN" },
];

export function EmojiStickerPicker({ onEmoji, onSticker, onGif }: {
  onEmoji: (e: string) => void;
  onSticker: (id: string) => void;
  onGif: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [gif, setGif] = useState("");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0" aria-label="Emojis, stickers and GIFs">
          <Smile className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-80 p-2">
        <Tabs defaultValue="emoji">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="emoji">Emoji</TabsTrigger>
            <TabsTrigger value="stickers"><Sticker className="mr-1 h-3.5 w-3.5" />Stickers</TabsTrigger>
            <TabsTrigger value="gif">GIF</TabsTrigger>
          </TabsList>
          <TabsContent value="emoji" className="max-h-64 overflow-y-auto scrollbar-thin">
            {Object.entries(EMOJI_GROUPS).map(([g, list]) => (
              <div key={g} className="mb-2">
                <div className="px-1 pb-1 text-[11px] font-semibold uppercase text-muted-foreground">{g}</div>
                <div className="grid grid-cols-8 gap-0.5">
                  {list.map((e) => (
                    <button key={e} type="button" onClick={() => onEmoji(e)} className="rounded p-1 text-xl hover:bg-accent">{e}</button>
                  ))}
                </div>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="stickers" className="max-h-64 overflow-y-auto scrollbar-thin">
            <div className="grid grid-cols-3 gap-2">
              {STICKERS.map((s) => (
                <button key={s.id} type="button" onClick={() => { onSticker(s.id); setOpen(false); }} className="rounded-xl p-1 hover:bg-accent">
                  <StickerView id={s.id} small />
                </button>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="gif" className="space-y-2">
            <p className="text-xs text-muted-foreground">Paste a GIF link (from GIPHY, Tenor, …) or attach a .gif file with the paperclip.</p>
            <Input value={gif} onChange={(e) => setGif(e.target.value)} placeholder="https://media.giphy.com/…gif" />
            <Button
              type="button"
              size="sm"
              className="w-full"
              onClick={() => {
                const url = gif.trim();
                if (!/^https:\/\/\S+$/.test(url)) return toast.error("Paste a valid https link");
                onGif(url); setGif(""); setOpen(false);
              }}
            >Send GIF</Button>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

export function StickerView({ id, small }: { id: string; small?: boolean }) {
  const s = STICKERS.find((x) => x.id === id);
  if (!s) return null;
  return (
    <div className={`inline-flex flex-col items-center rounded-2xl bg-brand p-[2px] shadow-glow ${small ? "" : "mt-1"}`}>
      <div className={`flex flex-col items-center rounded-2xl bg-card ${small ? "px-2 py-1.5" : "px-5 py-3"}`}>
        <span className={small ? "text-3xl" : "text-6xl"}>{s.emoji}</span>
        <span className={`font-display font-bold tracking-wide text-gradient-brand ${small ? "text-[10px]" : "text-sm"}`}>{s.label}</span>
      </div>
    </div>
  );
}

export function VoiceRecorder({ onRecorded, disabled }: { onRecorded: (blob: Blob, seconds: number) => void; disabled?: boolean }) {
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [secs, setSecs] = useState(0);
  const chunks = useRef<Blob[]>([]);
  const cancelled = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      cancelled.current = false;
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timer.current) clearInterval(timer.current);
        const s = secsRef.current;
        setRec(null);
        setSecs(0);
        if (!cancelled.current && chunks.current.length) onRecorded(new Blob(chunks.current, { type: mr.mimeType || "audio/webm" }), s);
      };
      mr.start();
      setRec(mr);
      secsRef.current = 0;
      timer.current = setInterval(() => {
        secsRef.current += 1;
        setSecs(secsRef.current);
        if (secsRef.current >= 120) mr.stop();
      }, 1000);
    } catch {
      toast.error("Microphone access is needed to record voice messages");
    }
  }
  const secsRef = useRef(0);

  if (rec) {
    return (
      <div className="flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-1 text-xs text-destructive">
        <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
        <span className="w-9 tabular-nums">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}</span>
        <button type="button" aria-label="Cancel recording" onClick={() => { cancelled.current = true; rec.stop(); }} className="rounded p-0.5 hover:bg-destructive/20"><X className="h-3.5 w-3.5" /></button>
        <button type="button" aria-label="Send voice message" onClick={() => rec.stop()} className="rounded p-0.5 hover:bg-destructive/20"><Square className="h-3.5 w-3.5 fill-current" /></button>
      </div>
    );
  }
  return (
    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0" onClick={start} disabled={disabled} aria-label="Record voice message">
      <Mic className="h-4 w-4" />
    </Button>
  );
}
