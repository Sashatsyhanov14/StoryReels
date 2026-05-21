import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

interface SceneInput {
  scene_text?: string;
  image_prompt: string;
  voice_text: string;
  camera_effect: string;
  transition: string;
  imageUrl?: string;
  audioUrl?: string;
}

interface DbAssets {
  progress: number;
  step: 'idle' | 'script' | 'keyframes' | 'voiceover' | 'compiling';
  userPrompt: string;
  scenes: SceneInput[];
}

async function retryDb<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fn();
      if (res && typeof res === 'object' && 'error' in res && res.error) {
        if (i === retries - 1) return res;
        console.warn(`Database call returned error (attempt ${i + 1}/${retries}), retrying in ${delay}ms...`, res.error);
        await new Promise((resFn) => setTimeout(resFn, delay));
        continue;
      }
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`Database call threw error (attempt ${i + 1}/${retries}), retrying in ${delay}ms...`, err);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw new Error('Retries exhausted');
}

async function pollImageResult(taskId: string, apiKey: string, maxAttempts = 30): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((res) => setTimeout(res, 2000));
    try {
      const response = await fetch(`https://api.gen-api.ru/api/v1/request/get/${taskId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });

      if (!response.ok) continue;

      const result = await response.json();
      if (result.status === 'success') {
        if (result.result) {
          if (typeof result.result === 'string') return result.result;
          if (result.result.url) return result.result.url;
          if (Array.isArray(result.result) && result.result[0]) {
             return typeof result.result[0] === 'string' ? result.result[0] : result.result[0].url;
          }
        }
        throw new Error('Success status but no URL found');
      }
      if (result.status === 'failed' || result.status === 'error') {
        throw new Error(result.error || result.message || 'unknown error');
      }
    } catch (err) {
      console.error(`Poll attempt ${i + 1} error:`, err);
    }
  }
  throw new Error(`Task ${taskId} timed out`);
}

async function generateImage(prompt: string): Promise<string> {
  const apiKey = process.env.GEN_API_KEY;
  if (!apiKey) {
    console.warn('GEN_API_KEY is missing, using fallback image.');
    return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';
  }

  let lastError: unknown = null;
  for (let i = 0; i < 3; i++) {
    try {
      const response = await fetch('https://api.gen-api.ru/api/v1/networks/z-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Connection': 'close'
        },
        body: JSON.stringify({
          prompt,
          aspect_ratio: '9:16'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Gen-API Image generation request failed: ${response.status} - ${errorText}`);
        throw new Error(`API failed: ${response.status}`);
      }

      const result = await response.json();
      if (result.status === 'success' && result.result) {
        if (typeof result.result === 'string') return result.result;
        if (result.result.url) return result.result.url;
        if (Array.isArray(result.result) && result.result[0]) {
           return typeof result.result[0] === 'string' ? result.result[0] : result.result[0].url;
        }
      }

      const taskId = result.request_id || result.id || result.taskId;
      if (taskId) {
        return await pollImageResult(taskId, apiKey);
      }
      throw new Error('Unexpected response format');
    } catch (err) {
      lastError = err;
      console.warn(`Gen-API Image generation attempt ${i + 1} failed:`, err);
      if (i < 2) await new Promise(res => setTimeout(res, 1500));
    }
  }
  
  console.error('Image generation error, using fallback:', lastError);
  return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';
}

async function generateAudio(text: string): Promise<string> {
  const apiKey = process.env.POLZA_API_KEY;
  if (!apiKey) {
    return '#';
  }

  let lastError: unknown = null;
  for (let i = 0; i < 3; i++) {
    try {
      const response = await fetch('https://polza.ai/api/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Connection': 'close'
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: 'alloy'
        })
      });

      if (!response.ok) {
        throw new Error(`TTS API failed: ${response.status}`);
      }

      const result = await response.json();
      if (result?.audio) {
        return `data:audio/mp3;base64,${result.audio}`;
      }
      throw new Error('TTS response missing audio data');
    } catch (err) {
      lastError = err;
      console.warn(`Polza Audio generation attempt ${i + 1} failed:`, err);
      if (i < 2) await new Promise(res => setTimeout(res, 1500));
    }
  }

  console.error('Audio generation failed, using fallback:', lastError);
  return '#';
}

function saveAudioLocally(episodeId: string, sceneIndex: number, audioBase64: string): string {
  // On Vercel, the file system is read-only. 
  // We return the base64 string directly which the browser can play as a data URI.
  return audioBase64;
}

async function saveImageLocally(episodeId: string, sceneIndex: number, imageUrl: string): Promise<string> {
  // On Vercel, the file system is read-only.
  // We return the remote URL directly. For long-term persistence, 
  // this should be updated to upload to Supabase Storage.
  if (!imageUrl || imageUrl.startsWith('https://images.unsplash.com')) {
    return imageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';
  }
  return imageUrl;
}

export async function POST(request: Request) {
  try {
    const { episodeId, sceneIndex, sceneIndices } = await request.json();

    if (!episodeId || (typeof sceneIndex !== 'number' && !Array.isArray(sceneIndices))) {
      return NextResponse.json({ error: 'Episode ID and sceneIndex or sceneIndices are required' }, { status: 400 });
    }

    const indices: number[] = Array.isArray(sceneIndices) 
      ? sceneIndices 
      : [sceneIndex as number];

    const supabase = getSupabaseAdmin();

    // Log env vars status
    console.log("Supabase URL loaded status:", !!process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log("Supabase Service Key loaded status:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch current episode state with retry logic
    const { data: ep, error: fetchErr } = await retryDb(async () => {
      return await supabase
        .from('episodes')
        .select('*')
        .eq('id', episodeId)
        .single();
    });

    if (fetchErr || !ep) {
      console.error('Fetch episode DB error:', fetchErr);
      return NextResponse.json({ error: 'Episode not found', details: fetchErr }, { status: 404 });
    }

    const assets = ep.assets_json as unknown as DbAssets;
    if (!assets || !Array.isArray(assets.scenes)) {
      return NextResponse.json({ error: 'Invalid episode state' }, { status: 400 });
    }

    // 2. Generate assets for the requested scenes in parallel
    await Promise.all(
      indices.map(async (idx) => {
        const scene = assets.scenes[idx];
        if (!scene) return;

        // Generate assets for this scene in parallel
        const [rawImageUrl, rawAudioUrl] = await Promise.all([
          generateImage(scene.image_prompt),
          generateAudio(scene.voice_text)
        ]);

        // Save generated assets locally in parallel
        const [imageUrl, audioUrl] = await Promise.all([
          saveImageLocally(episodeId, idx, rawImageUrl),
          saveAudioLocally(episodeId, idx, rawAudioUrl)
        ]);

        assets.scenes[idx] = {
          ...scene,
          imageUrl,
          audioUrl
        };
      })
    );

    // Calculate progress based on how many scenes are fully generated
    const totalScenes = assets.scenes.length;
    const generatedCount = assets.scenes.filter(s => s.imageUrl && s.audioUrl && s.audioUrl !== '#').length;
    const progress = Math.min(95, Math.round(10 + (generatedCount / totalScenes) * 85));
    assets.progress = progress;
    assets.step = 'keyframes';

    // 3. Check if all scenes in the episode are completed
    const isCompleted = assets.scenes.every(s => s.imageUrl && s.audioUrl && s.audioUrl !== '#');

    if (isCompleted) {
      // Map all scenes to format expected by UI
      const formattedScenes = assets.scenes.map((s) => ({
        imageUrl: s.imageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
        audioUrl: s.audioUrl || '#',
        text: s.voice_text,
        imagePrompt: s.image_prompt,
        cameraEffect: s.camera_effect,
        transition: s.transition,
        sceneText: s.scene_text
      }));

      const { error: updateErr } = await retryDb(async () => {
        return await supabase
          .from('episodes')
          .update({
            status: 'ready',
            assets_json: formattedScenes
          })
          .eq('id', episodeId);
      });

      if (updateErr) {
        console.error('Final DB update error:', updateErr);
        return NextResponse.json({ error: 'Failed to update final episode state', details: updateErr }, { status: 500 });
      }

      return NextResponse.json({ success: true, isCompleted: true, progress: 100 });
    } else {
      const { error: updateErr } = await retryDb(async () => {
        return await supabase
          .from('episodes')
          .update({
            assets_json: assets
          })
          .eq('id', episodeId);
      });

      if (updateErr) {
        console.error('Scene DB update error:', updateErr);
        return NextResponse.json({ error: 'Failed to update scene state', details: updateErr }, { status: 500 });
      }

      return NextResponse.json({ success: true, isCompleted: false, progress });
    }
  } catch (error) {
    console.error('Generate scene error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
}
