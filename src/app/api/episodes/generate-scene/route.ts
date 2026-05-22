import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Pro: allow up to 60s for image generation

// ─── Types ──────────────────────────────────────────────────────────────────

interface SceneData {
  scene_text: string;
  image_prompt: string;
  voice_text: string;
  camera_effect: string;
  transition: string;
  imageUrl?: string;
  audioUrl?: string;
}

interface EpisodeAssets {
  progress: number;
  step: 'script' | 'keyframes' | 'voiceover' | 'compiling' | 'done';
  userPrompt: string;
  scenes: SceneData[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';

const STYLE_PREFIX = '16-bit pixel art style, retro JRPG aesthetic, SNES HD-2D style, detailed pixel art, vibrant game colors';

const STYLE_PREFIXES_TO_STRIP = [
  '16-bit pixel art style, retro jrpg aesthetic, snes hd-2d style, detailed pixel art',
  '16-bit pixel art style, retro jrpg aesthetic, snes hd-2d style',
  '16-bit pixel art style, retro jrpg aesthetic',
  '16-bit pixel art style',
];

// ─── Image Generation ───────────────────────────────────────────────────────

/**
 * Removes duplicate style prefixes from the LLM-generated prompt,
 * then prepends our canonical style prefix exactly once.
 */
function buildImagePrompt(rawPrompt: string): string {
  let cleaned = rawPrompt.trim();
  for (const prefix of STYLE_PREFIXES_TO_STRIP) {
    if (cleaned.toLowerCase().startsWith(prefix)) {
      cleaned = cleaned.substring(prefix.length).replace(/^[,\s]+/, '');
    }
  }
  return `${STYLE_PREFIX}, ${cleaned}`;
}

/**
 * Polls the Gen-API async task endpoint until the image is ready.
 * Timeout: 20 attempts × 2s = 40s max.
 */
async function pollImageResult(taskId: string, apiKey: string): Promise<string> {
  const MAX_ATTEMPTS = 20;
  const POLL_INTERVAL_MS = 2000;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const response = await fetch(`https://api.gen-api.ru/api/v1/request/get/${taskId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      console.warn(`[poll] Attempt ${attempt + 1}: HTTP ${response.status}`);
      continue;
    }

    const data = await response.json();

    if (data.status === 'success' && data.result) {
      const url = extractImageUrl(data.result);
      if (url) return url;
      throw new Error(`[poll] Success status but could not extract URL from result: ${JSON.stringify(data.result).substring(0, 200)}`);
    }

    if (data.status === 'failed' || data.status === 'error') {
      throw new Error(`[poll] Task failed: ${data.error || data.message || 'unknown'}`);
    }

    // Still processing — continue polling
  }

  throw new Error(`[poll] Task ${taskId} timed out after ${MAX_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`);
}

/**
 * Extracts an image URL from the Gen-API response result,
 * which can be a string, an object with .url, or an array.
 */
function extractImageUrl(result: unknown): string | null {
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if ('url' in obj && typeof obj.url === 'string') return obj.url;
    if (Array.isArray(result) && result.length > 0) {
      const first = result[0] as unknown;
      if (typeof first === 'string') return first;
      if (first && typeof first === 'object' && 'url' in first) {
        return (first as Record<string, unknown>).url as string;
      }
    }
  }
  return null;
}

/**
 * Generates a single image via Gen-API's z-image endpoint.
 * Uses 512×896 (9:16, 0.46 Mpx) for cost efficiency with pixel art style.
 * Retries up to 3 times on transient failures.
 */
async function generateImage(rawPrompt: string): Promise<string> {
  const apiKey = process.env.GEN_API_KEY;
  if (!apiKey) {
    console.warn('[generateImage] GEN_API_KEY missing — returning fallback');
    return FALLBACK_IMAGE;
  }

  const prompt = buildImagePrompt(rawPrompt);
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      console.log(`[generateImage] Attempt ${attempt + 1}/3`);

      const response = await fetch('https://api.gen-api.ru/api/v1/networks/z-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt,
          aspect_ratio: '9:16',
          width: 512,
          height: 896,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '(unreadable)');
        throw new Error(`Gen-API HTTP ${response.status}: ${errorBody.substring(0, 300)}`);
      }

      const data = await response.json();

      // Case 1: Synchronous result
      if (data.status === 'success' && data.result) {
        const url = extractImageUrl(data.result);
        if (url) {
          console.log(`[generateImage] ✓ Sync result received`);
          return url;
        }
      }

      // Case 2: Async — poll for result
      const taskId = data.request_id || data.id || data.taskId;
      if (taskId) {
        console.log(`[generateImage] Async task ${taskId} — polling...`);
        return await pollImageResult(taskId, apiKey);
      }

      throw new Error(`Unexpected Gen-API response shape: ${JSON.stringify(data).substring(0, 300)}`);
    } catch (err) {
      lastError = err;
      console.error(`[generateImage] Attempt ${attempt + 1} failed:`, err);
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.error('[generateImage] All attempts exhausted — returning fallback:', lastError);
  return FALLBACK_IMAGE;
}

// ─── Audio Generation ───────────────────────────────────────────────────────

/**
 * Generates TTS audio via Polza.ai and uploads the result to Supabase Storage.
 * Returns a public URL to the stored audio file.
 * Falls back to returning base64 data URI if storage upload fails.
 */
async function generateAudio(
  text: string,
  episodeId: string,
  sceneIndex: number
): Promise<string> {
  const apiKey = process.env.POLZA_API_KEY;
  if (!apiKey) {
    console.warn('[generateAudio] POLZA_API_KEY missing — skipping');
    return '';
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      console.log(`[generateAudio] Scene ${sceneIndex + 1}, attempt ${attempt + 1}/3`);

      const response = await fetch('https://polza.ai/api/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: 'alloy',
        }),
      });

      if (!response.ok) {
        throw new Error(`Polza TTS HTTP ${response.status}`);
      }

      const result = await response.json();
      if (!result?.audio) {
        throw new Error('TTS response missing audio field');
      }

      // Try to upload to Supabase Storage for persistence
      const audioUrl = await uploadAudioToStorage(
        result.audio,
        episodeId,
        sceneIndex
      );

      if (audioUrl) {
        console.log(`[generateAudio] ✓ Uploaded to storage: scene ${sceneIndex + 1}`);
        return audioUrl;
      }

      // Fallback: return as data URI (works but bloats DB)
      console.warn(`[generateAudio] Storage upload failed — using data URI fallback`);
      return `data:audio/mp3;base64,${result.audio}`;
    } catch (err) {
      lastError = err;
      console.error(`[generateAudio] Attempt ${attempt + 1} failed:`, err);
      if (attempt < 2) await new Promise(r => setTimeout(r, 1500));
    }
  }

  console.error('[generateAudio] All attempts exhausted:', lastError);
  return '';
}

/**
 * Uploads base64 audio to Supabase Storage bucket "episode-audio".
 * Returns the public URL, or null on failure.
 */
async function uploadAudioToStorage(
  base64Audio: string,
  episodeId: string,
  sceneIndex: number
): Promise<string | null> {
  try {
    const supabase = getSupabaseAdmin();
    const buffer = Buffer.from(base64Audio, 'base64');
    const filePath = `${episodeId}/scene-${sceneIndex}.mp3`;

    const { error: uploadError } = await supabase.storage
      .from('episode-audio')
      .upload(filePath, buffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (uploadError) {
      console.warn('[uploadAudio] Storage upload error:', uploadError.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('episode-audio')
      .getPublicUrl(filePath);

    return urlData?.publicUrl || null;
  } catch (err) {
    console.warn('[uploadAudio] Unexpected error:', err);
    return null;
  }
}

// ─── Database Helpers ───────────────────────────────────────────────────────

/**
 * Fetches current episode state from DB.
 */
async function fetchEpisode(episodeId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('episodes')
    .select('id, status, assets_json')
    .eq('id', episodeId)
    .single();

  if (error || !data) {
    throw new Error(`Episode not found: ${error?.message || 'no data'}`);
  }

  return data;
}

/**
 * Updates a single scene within the episode's assets_json.
 * Uses a fresh read → modify → write to avoid race conditions.
 * Also calculates progress and transitions to 'ready' when all scenes are done.
 */
async function updateSceneInDb(
  episodeId: string,
  sceneIndex: number,
  imageUrl: string,
  audioUrl: string
): Promise<{ progress: number; isCompleted: boolean; scenes: Record<string, unknown>[] }> {
  const supabase = getSupabaseAdmin();

  // Re-read current state (freshest data)
  const { data: ep, error: readErr } = await supabase
    .from('episodes')
    .select('assets_json')
    .eq('id', episodeId)
    .single();

  if (readErr || !ep) {
    throw new Error(`Failed to read episode for update: ${readErr?.message}`);
  }

  const assets = ep.assets_json as EpisodeAssets;
  if (!assets?.scenes?.[sceneIndex]) {
    throw new Error(`Scene ${sceneIndex} not found in episode assets`);
  }

  // Patch this specific scene
  assets.scenes[sceneIndex] = {
    ...assets.scenes[sceneIndex],
    imageUrl,
    audioUrl,
  };

  // Calculate progress
  const total = assets.scenes.length;
  const done = assets.scenes.filter(s => s.imageUrl && s.audioUrl && s.audioUrl !== '').length;
  const progress = Math.round((done / total) * 100);
  const isCompleted = done === total;

  assets.progress = progress;
  assets.step = isCompleted ? 'done' : 'keyframes';

  // Build the update payload
  const updatePayload: Record<string, unknown> = { assets_json: assets };
  if (isCompleted) {
    updatePayload.status = 'ready';
  }

  const { error: writeErr } = await supabase
    .from('episodes')
    .update(updatePayload)
    .eq('id', episodeId);

  if (writeErr) {
    throw new Error(`Failed to write episode update: ${writeErr.message}`);
  }

  // Return the formatted scene for the frontend
  const updatedScene = assets.scenes[sceneIndex];
  const formattedScene = {
    imageUrl: updatedScene.imageUrl || FALLBACK_IMAGE,
    audioUrl: updatedScene.audioUrl || '',
    text: updatedScene.voice_text,
    imagePrompt: updatedScene.image_prompt,
    cameraEffect: updatedScene.camera_effect,
    transition: updatedScene.transition,
    sceneText: updatedScene.scene_text,
  };

  return { progress, isCompleted, scenes: [formattedScene] };
}

// ─── Main Handler ───────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { episodeId, sceneIndex } = body;

    // ── Validate input ─────────────────────────────────────────────────────
    if (!episodeId || typeof sceneIndex !== 'number') {
      return NextResponse.json(
        { error: 'episodeId (string) and sceneIndex (number) are required' },
        { status: 400 }
      );
    }

    console.log(`\n━━━ Generate Scene ${sceneIndex + 1} for episode ${episodeId.substring(0, 8)}... ━━━`);

    // ── 1. Fetch episode & validate state ──────────────────────────────────
    const episode = await fetchEpisode(episodeId);

    if (episode.status === 'failed') {
      return NextResponse.json(
        { error: 'Episode is in failed state — cannot generate scenes' },
        { status: 409 }
      );
    }

    const assets = episode.assets_json as EpisodeAssets;
    if (!assets?.scenes || !Array.isArray(assets.scenes)) {
      return NextResponse.json(
        { error: 'Episode has no scenes in assets_json' },
        { status: 400 }
      );
    }

    const scene = assets.scenes[sceneIndex];
    if (!scene) {
      return NextResponse.json(
        { error: `Scene index ${sceneIndex} out of range (0..${assets.scenes.length - 1})` },
        { status: 400 }
      );
    }

    // ── 2. Idempotency check ───────────────────────────────────────────────
    const hasImage = scene.imageUrl && scene.imageUrl !== '' && scene.imageUrl !== FALLBACK_IMAGE;
    const hasAudio = scene.audioUrl && scene.audioUrl !== '' && scene.audioUrl !== '#';

    if (hasImage && hasAudio) {
      console.log(`[scene ${sceneIndex + 1}] Already generated — skipping`);

      const total = assets.scenes.length;
      const done = assets.scenes.filter(s => s.imageUrl && s.audioUrl && s.audioUrl !== '').length;

      return NextResponse.json({
        success: true,
        skipped: true,
        progress: Math.round((done / total) * 100),
        isCompleted: done === total,
        sceneIndex,
      });
    }

    // ── 3. Generate image + audio in parallel ──────────────────────────────
    console.log(`[scene ${sceneIndex + 1}] Generating image + audio in parallel...`);

    const [imageUrl, audioUrl] = await Promise.all([
      generateImage(scene.image_prompt),
      generateAudio(scene.voice_text, episodeId, sceneIndex),
    ]);

    console.log(`[scene ${sceneIndex + 1}] Image: ${imageUrl ? '✓' : '✗'}, Audio: ${audioUrl ? '✓' : '✗'}`);

    // ── 4. Atomic DB update for this scene ─────────────────────────────────
    const { progress, isCompleted, scenes: formattedScenes } = await updateSceneInDb(
      episodeId,
      sceneIndex,
      imageUrl,
      audioUrl
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[scene ${sceneIndex + 1}] ✓ Done in ${elapsed}s | Progress: ${progress}% | Completed: ${isCompleted}`);

    return NextResponse.json({
      success: true,
      skipped: false,
      progress,
      isCompleted,
      sceneIndex,
      generatedScene: formattedScenes[0],
    });

  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[generate-scene] ✗ Failed after ${elapsed}s:`, message);

    return NextResponse.json(
      { error: 'Scene generation failed', details: message },
      { status: 500 }
    );
  }
}
