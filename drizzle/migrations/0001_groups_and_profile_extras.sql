CREATE OR REPLACE FUNCTION public.create_group(_name text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _slug text; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  _slug := 'g-' || substr(md5(random()::text), 1, 8);
  INSERT INTO public.rooms (name, slug, is_public, is_group, created_by)
  VALUES (coalesce(nullif(trim(_name), ''), 'New group'), _slug, false, true, auth.uid())
  RETURNING id INTO _id;
  INSERT INTO public.room_members (room_id, user_id, role) VALUES (_id, auth.uid(), 'owner');
  RETURN _slug;
END $$;
GRANT EXECUTE ON FUNCTION public.create_group(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_group_member(_room_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_room_member(_room_id, auth.uid()) THEN RAISE EXCEPTION 'Only group members can add people'; END IF;
  INSERT INTO public.room_members (room_id, user_id) VALUES (_room_id, _user_id) ON CONFLICT DO NOTHING;
END $$;
GRANT EXECUTE ON FUNCTION public.add_group_member(uuid, uuid) TO authenticated;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_status text;