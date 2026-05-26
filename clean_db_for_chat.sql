-- ====================================================
-- Скрипт очистки БД (переход на Chat Stories)
-- СКОПИРУЙТЕ И ВЫПОЛНИТЕ В SUPABASE SQL EDITOR
-- ====================================================

-- 1. Удаляем таблицы, которые больше не нужны (если они были)
DROP TABLE IF EXISTS public.scenes CASCADE;
DROP TABLE IF EXISTS public.renders CASCADE;

-- 2. Удаляем специфичные для видео колонки из episodes (если они были)
ALTER TABLE public.episodes DROP COLUMN IF EXISTS video_url;
ALTER TABLE public.episodes DROP COLUMN IF EXISTS render_id;
ALTER TABLE public.episodes DROP COLUMN IF EXISTS render_progress;
ALTER TABLE public.episodes DROP COLUMN IF EXISTS audio_url;

-- 3. (ОПЦИОНАЛЬНО) Если вы хотите удалить ВСЕ старые сгенерированные видео-истории, 
-- чтобы они не крашили новый интерфейс мессенджера (т.к. там нет сообщений),
-- снимите комментарий с команды ниже:
-- DELETE FROM public.episodes;

-- 4. Очищаем Storage Bucket, который мы создавали для аудио (он больше не нужен)
-- Внимание: это удалит сам бакет. Если в нем остались файлы, сначала нужно удалить их.
-- DELETE FROM storage.buckets WHERE id = 'episode-audio';
