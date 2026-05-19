import { NextResponse, after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const maxDuration = 300; // 5 minutes execution timeout (max allowed on Vercel Hobby)
export const dynamic = 'force-dynamic';

// Real Polza.ai LLM generation using openai/gpt-4o-mini
async function generateScript(userPrompt: string) {
  const apiKey = process.env.POLZA_API_KEY;
  if (!apiKey) {
    console.warn('POLZA_API_KEY is not defined, using mock script.');
    return Array.from({ length: 15 }, (_, i) => ({
      image_prompt: `cyberpunk neon noir scene part ${i + 1} based on ${userPrompt}`,
      text: `Сцена ${i + 1}: Диалог или закадровый голос для "${userPrompt}"`
    }));
  }

  const response = await fetch('https://polza.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an elite screenwriter. Your task is to generate a compelling, episodic cinematic storyboard script based on the user\'s prompt. The narration and dialogue lines MUST be in Russian. You must output exactly 15 sequential scenes. For each scene, provide a highly detailed descriptive prompt in English for image generation and a brief narration/dialogue line in Russian (1-2 sentences). You MUST return your output in JSON format: a JSON array containing exactly 15 objects, each having the keys "image_prompt" and "text". Do not wrap in markdown, return raw JSON only.'
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Polza Script Generation failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const content = result.choices[0].message.content;
  
  // Clean potential markdown wrap
  const cleanContent = content.trim().replace(/^```json\s*/, '').replace(/```$/, '');
  const parsed = JSON.parse(cleanContent);
  
  const scenes = Array.isArray(parsed) ? parsed : (parsed.scenes || parsed.storyboard || []);
  if (!Array.isArray(scenes) || scenes.length === 0) {
    throw new Error('Invalid response structure from Polza script generation');
  }
  
  return scenes.slice(0, 15).map((scene: any) => ({
    image_prompt: scene.image_prompt || scene.prompt || 'cinematic shot',
    text: scene.text || scene.dialogue || scene.narration || ''
  }));
}

// Image generation via Polza.ai (tongyi-mai/z-image — Z-Image)
async function generateImage(prompt: string) {
  const apiKey = process.env.POLZA_API_KEY;
  if (!apiKey) {
    await new Promise(res => setTimeout(res, 300));
    return `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80`;
  }

  try {
    const response = await fetch('https://polza.ai/api/v1/media', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'tongyi-mai/z-image',
        input: {
          prompt: prompt,
          aspect_ratio: '9:16'
        }
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Image API error body: ${errorBody}`);
      throw new Error(`Image API error: ${response.status}`);
    }

    const result = await response.json();
    console.log('Image API response:', JSON.stringify(result));

    // Sync response — image ready immediately
    if (result.data) {
      if (result.data.url) return result.data.url;
      if (Array.isArray(result.data) && result.data[0] && result.data[0].url) return result.data[0].url;
    }

    // Async response — Polza.ai returns status: pending with id
    const taskId = result.id || result.requestId || result.taskId || result.task_id;
    if (taskId) {
      console.log(`Image generation async, polling task: ${taskId}`);
      return await pollImageResult(taskId, apiKey);
    }

    console.error('Unhandled image API response:', JSON.stringify(result));
    throw new Error('Unexpected image API response');
  } catch (err) {
    console.error('Image generation failed, using fallback:', err);
    return `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80`;
  }
}

// Poll Polza.ai Media API for async image task completion
async function pollImageResult(taskId: string, apiKey: string, maxAttempts = 30): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(res => setTimeout(res, 3000)); // wait 3s between polls

    try {
      const response = await fetch(`https://polza.ai/api/v1/media/${taskId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });

      if (!response.ok) {
        console.warn(`Poll ${i + 1}: HTTP ${response.status}`);
        continue;
      }

      const result = await response.json();
      console.log(`Poll ${i + 1} for ${taskId}: status=${result.status}`);

      if (result.status === 'completed') {
        // data can be an object {url: "..."} or an array [{url: "..."}]
        if (result.data) {
          if (result.data.url) return result.data.url;
          if (Array.isArray(result.data) && result.data[0] && result.data[0].url) return result.data[0].url;
        }
        console.error('Completed but no URL found:', JSON.stringify(result));
        throw new Error('Completed but missing image URL');
      }
      if (result.status === 'failed') {
        console.error(`Task ${taskId} failed:`, result.error);
        throw new Error(`Image task failed: ${result.error?.message || 'unknown'}`);
      }
      // pending / processing — continue polling
    } catch (err) {
      if ((err as Error).message?.includes('failed') || (err as Error).message?.includes('missing')) throw err;
      console.error(`Poll attempt ${i + 1} error:`, err);
    }
  }
  throw new Error(`Image task ${taskId} timed out after ${maxAttempts} attempts`);
}

// Process scenes in sequential batches to respect Polza.ai concurrency limits, updating progress in Supabase
async function generateAssetsInBatches(
  script: { image_prompt: string; text: string }[],
  episodeId: string,
  batchSize: number = 3
) {
  const allAssets: { imageUrl: string; audioUrl: string; text: string; imagePrompt: string }[] = [];
  const totalBatches = Math.ceil(script.length / batchSize);

  for (let i = 0; i < script.length; i += batchSize) {
    const batchIndex = Math.floor(i / batchSize);
    const batch = script.slice(i, i + batchSize);
    
    // Map batchIndex to steps: keyframes -> voiceover -> compiling
    let step: 'keyframes' | 'voiceover' | 'compiling' = 'keyframes';
    if (batchIndex >= 3) {
      step = 'compiling';
    } else if (batchIndex >= 1) {
      step = 'voiceover';
    }
    
    // Calculate progress: starting at 20% after script, ending at 95% before final ready status.
    const progress = Math.min(95, Math.round(20 + (batchIndex / totalBatches) * 75));

    // Update DB with current progress and step before starting the batch
    await supabaseAdmin
      .from('episodes')
      .update({
        assets_json: { progress, step }
      })
      .eq('id', episodeId);

    const batchResults = await Promise.all(
      batch.map(async (frame) => {
        const [imageUrl, audioUrl] = await Promise.all([
          generateImage(frame.image_prompt),
          generateAudio(frame.text)
        ]);
        return {
          imageUrl,
          audioUrl,
          text: frame.text,
          imagePrompt: frame.image_prompt
        };
      })
    );
    allAssets.push(...batchResults);
    console.log(`Batch ${batchIndex + 1} complete (${allAssets.length}/${script.length} scenes)`);
  }

  return allAssets;
}

// Real TTS via Polza.ai (OpenAI compatible) returning a Base64 data URI for instant playback
async function generateAudio(text: string) {
  const apiKey = process.env.POLZA_API_KEY;
  if (!apiKey) {
    await new Promise(res => setTimeout(res, 200));
    return '#';
  }

  try {
    const response = await fetch('https://polza.ai/api/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: 'alloy'
      })
    });

    if (!response.ok) {
      throw new Error(`TTS failed with status: ${response.status}`);
    }

    const result = await response.json();
    if (result && result.audio) {
      return `data:audio/mp3;base64,${result.audio}`;
    }
    throw new Error('TTS response missing audio data');
  } catch (err) {
    console.error('Audio generation failed, using fallback:', err);
    return '#';
  }
}

export async function POST(request: Request) {
  try {
    const { userId, prompt } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // 1. Deduct 1 token
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('token_balance')
      .eq('id', userId)
      .single();

    if (userError || !user || user.token_balance < 1) {
      return NextResponse.json({ error: 'Insufficient tokens' }, { status: 402 });
    }

    await supabaseAdmin
      .from('users')
      .update({ token_balance: user.token_balance - 1 })
      .eq('id', userId);

    // 2. Create pending episode record
    const { data: episode, error: epError } = await supabaseAdmin
      .from('episodes')
      .insert({
        user_id: userId,
        status: 'pending',
        assets_json: { progress: 5, step: 'script' }
      })
      .select()
      .single();

    if (epError || !episode) {
      // Revert token deduction if we fail to start
      await supabaseAdmin
        .from('users')
        .update({ token_balance: user.token_balance })
        .eq('id', userId);
      return NextResponse.json({ error: 'Failed to create episode record' }, { status: 500 });
    }

    // 3. Start generating assets in the background using Next.js after() API
    after(async () => {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Generation timeout')), 600000); // 10 minutes timeout for async background generation
      });

      const generationPromise = async () => {
        const script = await generateScript(prompt || 'киберпанк приключение');
        
        // Update progress after script is done
        await supabaseAdmin
          .from('episodes')
          .update({
            assets_json: { progress: 20, step: 'keyframes' }
          })
          .eq('id', episode.id);

        // Sequential batch rendering (3 scenes per batch)
        const assets = await generateAssetsInBatches(script, episode.id, 3);

        // Update episode as ready
        await supabaseAdmin
          .from('episodes')
          .update({
            status: 'ready',
            assets_json: assets
          })
          .eq('id', episode.id);
      };

      try {
        await Promise.race([generationPromise(), timeoutPromise]);
      } catch (err) {
        console.error('Generation failed or timed out:', err);
        // Fallback: set failed
        await supabaseAdmin
          .from('episodes')
          .update({ 
            status: 'failed',
            assets_json: []
          })
          .eq('id', episode.id);
        
        // Refund token
        const { data: currentUser } = await supabaseAdmin
          .from('users')
          .select('token_balance')
          .eq('id', userId)
          .single();
        if (currentUser) {
          await supabaseAdmin
            .from('users')
            .update({ token_balance: currentUser.token_balance + 1 })
            .eq('id', userId);
        }
      }
    });

    return NextResponse.json({ success: true, episodeId: episode.id });

  } catch (error) {
    console.error('Episode creation error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
