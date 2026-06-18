
CREATE POLICY "Authenticated can read chat uploads"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-uploads');

CREATE POLICY "Users can upload to chat-uploads under their folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own chat uploads"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
