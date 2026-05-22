-- ============================================
-- StoryReels: Storage Bucket для аудио эпизодов
-- Выполнить в Supabase SQL Editor
-- ============================================

-- 1. Создать bucket для аудио-файлов эпизодов
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'episode-audio',
  'episode-audio',
  true,
  5242880,  -- 5MB лимит на файл
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Политика: разрешить публичное чтение (для воспроизведения в плеере)
CREATE POLICY "Public read access for episode audio"
ON storage.objects
FOR SELECT
USING (bucket_id = 'episode-audio');

-- 3. Политика: разрешить запись из серверного API (service_role)
CREATE POLICY "Service role upload for episode audio"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'episode-audio');

-- 4. Политика: разрешить перезапись (upsert) из серверного API
CREATE POLICY "Service role update for episode audio"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'episode-audio');

-- 5. Политика: разрешить удаление старых файлов
CREATE POLICY "Service role delete for episode audio"
ON storage.objects
FOR DELETE
USING (bucket_id = 'episode-audio');
