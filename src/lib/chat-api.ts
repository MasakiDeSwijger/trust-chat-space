import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type Room = Database["public"]["Tables"]["rooms"]["Row"];
export type DMConversation = Database["public"]["Tables"]["dm_conversations"]["Row"];
export type Friendship = Database["public"]["Tables"]["friendships"]["Row"];

export async function getCurrentProfile(): Promise<Profile | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
  return data;
}

export async function listPublicRooms(): Promise<Room[]> {
  const { data, error } = await supabase.from("rooms").select("*").eq("is_public", true).order("name");
  if (error) throw error;
  return data ?? [];
}

export async function listMyGroups(userId: string): Promise<Room[]> {
  const { data, error } = await supabase
    .from("rooms")
    .select("*, room_members!inner(user_id)")
    .eq("is_group", true)
    .eq("room_members.user_id", userId);
  if (error) throw error;
  return (data ?? []) as unknown as Room[];
}

export async function listOnlineUsers(): Promise<Profile[]> {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .gte("last_seen", since)
    .order("display_name")
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((p) => ({ ...p, status: "online" as const }));
}

export async function searchUsers(q: string): Promise<Profile[]> {
  const trimmed = q.trim();
  if (!trimmed) return [];
  const term = trimmed.startsWith("#") ? trimmed : trimmed.toLowerCase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .or(`username.ilike.%${term}%,display_name.ilike.%${term}%,short_id.ilike.%${term}%`)
    .limit(30);
  if (error) throw error;
  return data ?? [];
}

export async function getProfileByShortId(shortId: string): Promise<Profile | null> {
  const normalized = shortId.startsWith("#") ? shortId : `#${shortId}`;
  const { data } = await supabase.from("profiles").select("*").eq("short_id", normalized).maybeSingle();
  return data;
}

export async function ensureDmConversation(otherUserId: string): Promise<string> {
  const { data: me } = await supabase.auth.getUser();
  if (!me.user) throw new Error("Not authenticated");
  const [a, b] = [me.user.id, otherUserId].sort();
  const { data: existing } = await supabase
    .from("dm_conversations")
    .select("id")
    .eq("user_a", a)
    .eq("user_b", b)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: created, error } = await supabase
    .from("dm_conversations")
    .insert({ user_a: a, user_b: b })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

export async function listDmConversations(userId: string) {
  const { data, error } = await supabase
    .from("dm_conversations")
    .select("*")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order("last_message_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
