import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Message, Profile } from "@/lib/chat-api";
import { Avatar } from "./UserBadge";
import { ShieldCheck, Smile, Trash2, Flag, Paperclip, Send, Loader2, Image as ImageIcon, FileIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMyProfile } from "@/hooks/use-my-profile";
import { formatDistanceToNow } from "date-fns";
import { EmojiStickerPicker, StickerView, VoiceRecorder } from "./ComposerExtras";

type Reaction = { message_id: string; user_id: string; emoji: string };

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "🙌"];

export function ChatView({
  kind,
  id,
  title,
  subtitle,
  actions,
}: {
  kind: "room" | "dm";
  id: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const { data: me } = useMyProfile();
  const qc = useQueryClient();
  const filterKey = kind === "room" ? "room_id" : "dm_id";

  const messagesQuery = useQuery({
    queryKey: ["messages", kind, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq(filterKey, id)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const senderIds = useMemo(() => Array.from(new Set((messagesQuery.data ?? []).map((m) => m.sender_id))), [messagesQuery.data]);
  const sendersQuery = useQuery({
    queryKey: ["senders", senderIds],
    enabled: senderIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").in("id", senderIds);
      return Object.fromEntries((data ?? []).map((p) => [p.id, p])) as Record<string, Profile>;
    },
  });

  const messageIds = useMemo(() => (messagesQuery.data ?? []).map((m) => m.id), [messagesQuery.data]);
  const reactionsQuery = useQuery({
    queryKey: ["reactions", messageIds],
    enabled: messageIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("reactions").select("*").in("message_id", messageIds);
      return data ?? [];
    },
  });

  // realtime
  useEffect(() => {
    const ch = supabase
      .channel(`messages-${kind}-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `${filterKey}=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["messages", kind, id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, () => {
        qc.invalidateQueries({ queryKey: ["reactions", messageIds] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, kind, filterKey, qc, messageIds]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messagesQuery.data?.length]);

  const messages = messagesQuery.data ?? [];
  const senders = sendersQuery.data ?? {};
  const reactionsByMsg: Record<string, Reaction[]> = {};
  for (const r of reactionsQuery.data ?? []) {
    (reactionsByMsg[r.message_id] ??= []).push(r);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card/40 px-5 py-3 backdrop-blur">
        <div className="min-w-0">
          <h1 className="font-display text-lg font-bold truncate">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
        {actions}
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin md:px-6">
        {messagesQuery.isLoading && <div className="text-center text-sm text-muted-foreground">Loading…</div>}
        {messages.length === 0 && !messagesQuery.isLoading && (
          <div className="mx-auto max-w-md py-16 text-center text-sm text-muted-foreground">
            No messages yet. Say hi 👋
          </div>
        )}
        <div className="mx-auto max-w-3xl space-y-1">
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const grouped = prev && prev.sender_id === m.sender_id && (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000);
            return (
              <MessageItem
                key={m.id}
                message={m}
                sender={senders[m.sender_id]}
                isMe={me?.id === m.sender_id}
                reactions={reactionsByMsg[m.id] ?? []}
                grouped={!!grouped}
                myId={me?.id}
              />
            );
          })}
        </div>
      </div>

      <Composer kind={kind} id={id} />
    </div>
  );
}

function MessageItem({ message, sender, isMe, reactions, grouped, myId }: {
  message: Message; sender?: Profile; isMe: boolean; reactions: Reaction[]; grouped: boolean; myId?: string;
}) {
  const qc = useQueryClient();
  const grouping = reactions.reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
    const cur = acc[r.emoji] ?? { count: 0, mine: false };
    cur.count++;
    if (r.user_id === myId) cur.mine = true;
    acc[r.emoji] = cur;
    return acc;
  }, {});

  async function toggleReact(emoji: string) {
    if (!myId) return;
    const existing = reactions.find((r) => r.user_id === myId && r.emoji === emoji);
    if (existing) {
      await supabase.from("reactions").delete().match({ message_id: message.id, user_id: myId, emoji });
    } else {
      await supabase.from("reactions").insert({ message_id: message.id, user_id: myId, emoji });
    }
    qc.invalidateQueries({ queryKey: ["reactions"] });
  }

  async function deleteMessage() {
    const { error } = await supabase.from("messages").delete().eq("id", message.id);
    if (error) toast.error(error.message); else toast.success("Deleted");
  }

  async function report() {
    if (!myId) return;
    const { error } = await supabase.from("reports").insert({
      reporter_id: myId,
      target_message_id: message.id,
      target_user_id: message.sender_id,
      reason: "Reported from chat",
    });
    if (error) toast.error(error.message); else toast.success("Reported. Mods will review.");
  }

  if (message.deleted_at) {
    return <div className="px-12 py-1 text-xs italic text-muted-foreground">message deleted</div>;
  }

  return (
    <div className={cn("group flex gap-3 rounded-lg px-2 py-1 hover:bg-card/40", grouped ? "pt-0.5" : "pt-3")}>
      <div className="w-9 shrink-0">
        {!grouped && sender && <Avatar profile={sender} size={36} />}
      </div>
      <div className="min-w-0 flex-1">
        {!grouped && sender && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">{sender.display_name}</span>
            <ShieldCheck className="h-3 w-3 text-verified" />
            <span className="text-[10px] text-muted-foreground">{sender.short_id}</span>
            <span className="text-[10px] text-muted-foreground">· {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}</span>
          </div>
        )}
        {message.attachment_type === "sticker" ? (
          <StickerView id={message.content ?? ""} />
        ) : message.content ? (
          <p className={cn("whitespace-pre-wrap break-words leading-relaxed", /^\p{Extended_Pictographic}{1,3}$/u.test(message.content.replace(/\s|\uFE0F/g, "")) ? "text-4xl" : "text-sm")}>{message.content}</p>
        ) : null}
        {message.attachment_url && <Attachment url={message.attachment_url} type={message.attachment_type ?? ""} name={message.attachment_name ?? "file"} />}
        {Object.keys(grouping).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(grouping).map(([emoji, { count, mine }]) => (
              <button
                key={emoji}
                onClick={() => toggleReact(emoji)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                  mine ? "border-primary/60 bg-primary/15" : "border-border bg-card/60 hover:bg-card",
                )}
              >
                <span>{emoji}</span><span>{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-start opacity-0 group-hover:opacity-100">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Smile className="h-4 w-4" /></Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="flex w-auto gap-1 p-1">
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => toggleReact(e)} className="rounded p-1 text-lg hover:bg-accent">{e}</button>
            ))}
          </PopoverContent>
        </Popover>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">⋯</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isMe && <DropdownMenuItem onClick={deleteMessage} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>}
            {!isMe && <DropdownMenuItem onClick={report}><Flag className="mr-2 h-4 w-4" />Report</DropdownMenuItem>}
            {!isMe && <DropdownMenuItem onClick={deleteMessage}><Trash2 className="mr-2 h-4 w-4" />Delete (mod)</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function Attachment({ url, type, name }: { url: string; type: string; name: string }) {
  const isImage = type.startsWith("image/") || type === "gif";
  if (type.startsWith("audio/")) {
    return (
      <div className="mt-1 inline-flex items-center gap-2 rounded-2xl border border-border bg-card/60 px-3 py-2">
        <span className="text-lg">🎤</span>
        <audio controls src={url} className="h-9 max-w-[260px]" preload="metadata" />
      </div>
    );
  }
  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mt-1 block max-w-xs overflow-hidden rounded-lg border border-border">
        <img src={url} alt={name} className="h-auto max-h-80 w-full object-cover" />
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 text-sm hover:bg-card">
      <FileIcon className="h-4 w-4" />
      <span>{name}</span>
    </a>
  );
}

function Composer({ kind, id }: { kind: "room" | "dm"; id: string }) {
  const { data: me } = useMyProfile();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function send(content: string, attachment?: { url: string; type: string; name: string }) {
    if (!me) return;
    const payload: any = {
      sender_id: me.id,
      content: content || null,
      attachment_url: attachment?.url ?? null,
      attachment_type: attachment?.type ?? null,
      attachment_name: attachment?.name ?? null,
    };
    if (kind === "room") payload.room_id = id; else payload.dm_id = id;
    const { error } = await supabase.from("messages").insert(payload);
    if (error) toast.error(error.message);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setText("");
    try { await send(value); } finally { setSending(false); }
  }

  async function uploadAndSend(file: Blob, name: string, type: string, caption = "") {
    if (!me) return;
    const path = `${me.id}/${Date.now()}-${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("chat-uploads").upload(path, file, { contentType: type });
    if (upErr) throw upErr;
    const { data: signed } = await supabase.storage.from("chat-uploads").createSignedUrl(path, 60 * 60 * 24 * 365);
    if (!signed?.signedUrl) throw new Error("Upload failed");
    await send(caption, { url: signed.signedUrl, type, name });
  }

  async function onVoice(blob: Blob, seconds: number) {
    if (seconds < 1) return;
    setSending(true);
    try { await uploadAndSend(blob, `voice-${seconds}s.webm`, blob.type || "audio/webm"); }
    catch (err: any) { toast.error(err.message); }
    finally { setSending(false); }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !me) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Max 10MB"); return; }
    setSending(true);
    try {
      const path = `${me.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("chat-uploads").upload(path, file);
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("chat-uploads").createSignedUrl(path, 60 * 60 * 24 * 365);
      if (!signed?.signedUrl) throw new Error("No URL");
      await send(text.trim(), { url: signed.signedUrl, type: file.type, name: file.name });
      setText("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <form onSubmit={onSubmit} className="border-t border-border bg-card/40 px-3 py-3 backdrop-blur md:px-6">
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-primary/40">
        <input ref={fileRef} type="file" hidden onChange={onFile} accept="image/*,audio/*,video/*,.pdf,.txt,.zip,.doc,.docx" />
        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 shrink-0 p-0" onClick={() => fileRef.current?.click()} disabled={sending}>
          <Paperclip className="h-4 w-4" />
        </Button>
        <EmojiStickerPicker
          onEmoji={(e) => setText((t) => t + e)}
          onSticker={(sid) => { if (!me) return; const payload: any = { sender_id: me.id, content: sid, attachment_type: "sticker" }; if (kind === "room") payload.room_id = id; else payload.dm_id = id; supabase.from("messages").insert(payload).then(({ error }) => error && toast.error(error.message)); }}
          onGif={(url) => send("", { url, type: "gif", name: "GIF" })}
        />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(e); } }}
          rows={1}
          placeholder="Type a message…"
          className="min-h-0 flex-1 resize-none border-0 bg-transparent p-1 text-sm focus-visible:ring-0"
        />
        {!text.trim() && <VoiceRecorder onRecorded={onVoice} disabled={sending} />}
        <Button type="submit" disabled={sending || !text.trim()} className="h-8 shrink-0 bg-brand text-primary-foreground hover:opacity-95">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </form>
  );
}
