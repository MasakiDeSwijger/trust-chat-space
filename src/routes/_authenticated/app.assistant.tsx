import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bot, Trash2 } from "lucide-react";
import { AppShell } from "@/components/chat/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, PromptInputTools } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/assistant")({
  head: () => ({
    meta: [
      { title: "Trusty AI assistant — Trusty" },
      { name: "description", content: "Ask Trusty AI, your built-in AI helper, anything about the community." },
    ],
  }),
  component: AssistantPage,
});

function AssistantPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-history"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_messages").select("message_id, role, parts").order("created_at");
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.message_id, role: r.role as UIMessage["role"], parts: r.parts as any })) as UIMessage[];
    },
  });
  return (
    <AppShell>
      {isLoading || !data ? (
        <div className="grid h-full place-items-center text-muted-foreground">Loading…</div>
      ) : (
        <AssistantChat initial={data} />
      )}
    </AppShell>
  );
}

function AssistantChat({ initial }: { initial: UIMessage[] }) {
  const qc = useQueryClient();
  const { messages, sendMessage, status, stop, setMessages } = useChat({
    id: "assistant",
    messages: initial,
    transport: new DefaultChatTransport({
      api: "/api/assistant",
      headers: async (): Promise<Record<string, string>> => {
        const { data } = await supabase.auth.getSession();
        return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
      },
    }),
    onError: (e) => toast.error(e.message || "The assistant couldn't answer."),
    onFinish: () => qc.invalidateQueries({ queryKey: ["ai-history"] }),
  });
  const busy = status === "submitted" || status === "streaming";

  async function clearChat() {
    const { error } = await supabase.from("ai_messages").delete().neq("message_id", "");
    if (error) return toast.error("Couldn't clear the conversation");
    setMessages([]);
    qc.invalidateQueries({ queryKey: ["ai-history"] });
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand shadow-glow">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display font-semibold">Trusty AI</div>
            <div className="text-xs text-muted-foreground">Your AI community assistant</div>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearChat} disabled={busy}>
            <Trash2 className="mr-1 h-4 w-4" /> Clear
          </Button>
        )}
      </header>

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<Bot className="h-10 w-10 text-primary" />}
              title="Hi, I'm Trusty AI"
              description="Ask how anything works, get help writing a message, or brainstorm ideas for your community."
            />
          ) : (
            messages.map((m) => (
              <Message key={m.id} from={m.role}>
                <MessageContent>
                  {m.parts.map((p, i) =>
                    p.type === "text" ? <MessageResponse key={i}>{p.text}</MessageResponse> : null,
                  )}
                </MessageContent>
              </Message>
            ))
          )}
          {status === "submitted" && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer>Trusty AI is thinking…</Shimmer>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl p-3">
        <PromptInput
          onSubmit={({ text }) => {
            if (!text?.trim() || busy) return;
            sendMessage({ text });
          }}
        >
          <PromptInputTextarea autoFocus placeholder="Message Trusty AI…" />
          <PromptInputFooter>
            <PromptInputTools />
            <PromptInputSubmit status={status} onClick={busy ? (e) => { e.preventDefault(); stop(); } : undefined} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
