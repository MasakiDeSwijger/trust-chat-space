CREATE TABLE public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id text NOT NULL,
  role text NOT NULL,
  parts jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, message_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai messages select" ON public.ai_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own ai messages insert" ON public.ai_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own ai messages update" ON public.ai_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own ai messages delete" ON public.ai_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX ai_messages_user_created ON public.ai_messages(user_id, created_at);