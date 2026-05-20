import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

interface SceneInput {
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
      const response = await fetch(`https://polza.ai/api/v1/media/${taskId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });

      if (!response.ok) continue;

      const result = await response.json();
      if (result.status === 'completed') {
        if (result.data) {
          if (result.data.url) return result.data.url;
          if (Array.isArray(result.data) && result.data[0]?.url) return result.data[0].url;
        }
        throw new Error('Completed status but no URL found');
      }
      if (result.status === 'failed') {
        throw new Error(result.error?.message || 'unknown error');
      }
    } catch (err) {
      console.error(`Poll attempt ${i + 1} error:`, err);
    }
  }
  throw new Error(`Task ${taskId} timed out`);
}

async function generateImage(prompt: string): Promise<string> {
  const apiKey = process.env.POLZA_API_KEY;
  if (!apiKey) {
    return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';
  }

  let lastError: unknown = null;
  for (let i = 0; i < 3; i++) {
    try {
      const response = await fetch('https://polza.ai/api/v1/media', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Connection': 'close'
        },
        body: JSON.stringify({
          model: 'qwen/image',
          input: {
            prompt,
            aspect_ratio: '9:16'
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Image generation request failed: ${response.status} - ${errorText}`);
        throw new Error(`API failed: ${response.status}`);
      }

      const result = await response.json();
      if (result.status === 'completed' && result.data) {
        if (result.data.url) return result.data.url;
        if (Array.isArray(result.data) && result.data[0]?.url) return result.data[0].url;
      }

      const taskId = result.id || result.requestId || result.taskId;
      if (taskId) {
        return await pollImageResult(taskId, apiKey);
      }
      throw new Error('Unexpected response format');
    } catch (err) {
      lastError = err;
      console.warn(`Polza Image generation attempt ${i + 1} failed:`, err);
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
  if (audioBase64 === '#') return '#';
  try {
    const base64Data = audioBase64.replace(/^data:audio\/[a-z0-9]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const dir = path.join(process.cwd(), 'public', 'audio', episodeId);
    fs.mkdirSync(dir, { recursive: true });

    const fileName = `scene_${sceneIndex}.mp3`;
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, buffer);

    return `/audio/${episodeId}/${fileName}`;
  } catch (err) {
    console.error('Failed to save audio locally:', err);
    return audioBase64;
  }
}

async function saveImageLocally(episodeId: string, sceneIndex: number, imageUrl: string): Promise<string> {
  if (!imageUrl || imageUrl.startsWith('https://images.unsplash.com')) {
    return imageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80';
  }

  for (let i = 0; i < 3; i++) {
    try {
      const response = await fetch(imageUrl, {
        headers: { 'Connection': 'close' }
      });
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const dir = path.join(process.cwd(), 'public', 'images', episodeId);
      fs.mkdirSync(dir, { recursive: true });

      const fileName = `scene_${sceneIndex}.png`;
      const filePath = path.join(dir, fileName);
      fs.writeFileSync(filePath, buffer);

      return `/images/${episodeId}/${fileName}`;
    } catch (err) {
      console.warn(`Attempt ${i + 1} to save image locally failed:`, err);
      if (i < 2) await new Promise(res => setTimeout(res, 1000));
    }
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
        transition: s.transition
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
