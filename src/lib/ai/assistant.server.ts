import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id.server";

const MODEL = "openai/gpt-6-astra";
const INSTRUCTIONS = `You are "Verity", the built-in assistant of Trusty — a chat app where every member is verified (email, phone or Google) and only shows a display name and a short public ID like #58291.
Help users with: using the app (public rooms, private messages, groups, friend requests, reactions, file sharing, search by name or ID, reporting), writing friendly messages, community ideas, and general questions.
How the app works: the left menu has your profile card, Search (find people by name or #ID), Friends (requests), "+ Group" (name a private group; inside it use "Add people"), Verity AI, public rooms, and Direct Messages. "Settings & themes" at the bottom changes profile picture, name, bio, colour theme and desktop notifications. In the message box: paperclip = files/images, smiley = emojis, stickers and GIFs, microphone = voice message. Hover a message to react or report it. Never invent features that are not listed here.
Never ask users for their email or phone number. Encourage safe, respectful behaviour. Be concise and warm; use markdown when helpful.`;

export async function handleAssistant(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return new Response("Unauthorized", { status: 401 });

  const supabase = createClient<Database>((process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL)!, (process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY)!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
  const userId = userData.user.id;

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return new Response("AI is not configured: add LOVABLE_API_KEY to your hosting environment variables.", { status: 500 });

  const body = (await request.json()) as { messages?: UIMessage[] };
  const messages = Array.isArray(body.messages) ? body.messages.slice(-40) : [];
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return new Response("Invalid request", { status: 400 });

  const { error: insErr } = await supabase
    .from("ai_messages")
    .upsert({ user_id: userId, message_id: last.id, role: "user", parts: last.parts as any }, { onConflict: "user_id,message_id" });
  if (insErr) console.error("save user message failed", insErr);

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: provider.responses(MODEL),
    instructions: INSTRUCTIONS,
    messages: await convertToModelMessages(messages),
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  } as any);

  return withLovableAiGatewayRunIdHeader(
    result.toUIMessageStreamResponse({
      originalMessages: messages,
      sendReasoning: true,
      onFinish: async ({ responseMessage }) => {
        const { error } = await supabase.from("ai_messages").upsert(
          { user_id: userId, message_id: responseMessage.id, role: "assistant", parts: responseMessage.parts as any },
          { onConflict: "user_id,message_id" },
        );
        if (error) console.error("save assistant message failed", error);
      },
      onError: (e: any) => {
        const status = e?.statusCode ?? e?.status;
        if (status === 402) return "AI credits are used up. Please add credits to keep chatting with the assistant.";
        if (status === 429) return "The assistant is busy right now. Please try again in a moment.";
        return "The assistant couldn't answer. Please try again.";
      },
    }),
    runIdFetch,
  );
}
