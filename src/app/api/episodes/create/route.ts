import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Real Polza.ai LLM generation using openai/gpt-4o-mini
async function generateScript(userPrompt: string) {
  const apiKey = process.env.POLZA_API_KEY;
  if (!apiKey) {
    console.warn('POLZA_API_KEY is not defined, using mock script.');
    return Array.from({ length: 15 }, (_, i) => ({
      image_prompt: `cyberpunk neon noir scene part ${i + 1} based on ${userPrompt}`,
      text: `Line of dialogue or narration ${i + 1} for ${userPrompt}`
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
          content: 'You are an elite screenwriter. Your task is to generate a compelling, episodic cinematic storyboard script based on the user\'s prompt. You must output exactly 15 sequential scenes. For each scene, provide a highly detailed descriptive prompt for image generation (targeting Flux) and a brief narration/dialogue line (1-2 sentences). You MUST return your output in JSON format: a JSON array containing exactly 15 objects, each having the keys "image_prompt" and "text". Do not wrap in markdown, return raw JSON only.'
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

// Real Flux rendering via Polza.ai
async function generateImage(prompt: string, seed: string) {
  const apiKey = process.env.POLZA_API_KEY;
  if (!apiKey) {
    // Simulate API call delay
    await new Promise(res => setTimeout(res, 300));
    return `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80`;
  }

  try {
    const response = await fetch('https://polza.ai/api/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'flux',
        prompt: prompt,
        n: 1,
        size: '1024x1024'
      })
    });

    if (!response.ok) {
      throw new Error(`Image API error: ${response.status}`);
    }

    const result = await response.json();
    return result.data[0].url;
  } catch (err) {
    console.error('Flux image generation failed, using fallback:', err);
    return `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80`;
  }
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

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Audio = buffer.toString('base64');
    return `data:audio/mp3;base64,${base64Audio}`;
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

    // 3. Start generating assets (can be run in background, but keeping here for simplicity, with fallback)
    const generationPromise = async () => {
      try {
        const script = await generateScript(prompt || 'cyberpunk adventure');
        const seed = '888999'; // Fixed seed for consistency
        
        // Parallel rendering of 15 pairs
        const assetPromises = script.map(async (frame) => {
          const [imageUrl, audioUrl] = await Promise.all([
            generateImage(frame.image_prompt, seed),
            generateAudio(frame.text)
          ]);
          return { 
            imageUrl, 
            audioUrl,
            text: frame.text,
            imagePrompt: frame.image_prompt
          };
        });

        const assets = await Promise.all(assetPromises);

        // Update episode as ready
        await supabaseAdmin
          .from('episodes')
          .update({
            status: 'ready',
            assets_json: assets
          })
          .eq('id', episode.id);

      } catch (err) {
        console.error('Generation failed:', err);
        // Fallback: set failed and return token
        await supabaseAdmin
          .from('episodes')
          .update({ status: 'failed' })
          .eq('id', episode.id);
        
        await supabaseAdmin
          .from('users')
          .update({ token_balance: user.token_balance }) // Restore the exact balance we knew
          .eq('id', userId);
      }
    };

    // Timeout mechanism (increased to 120 seconds for API latency)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Generation timeout')), 120000);
    });

    // Run generation
    try {
      await Promise.race([generationPromise(), timeoutPromise]);
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'Unknown error');
      // Fallback
      await supabaseAdmin
        .from('episodes')
        .update({ status: 'failed' })
        .eq('id', episode.id);
        
      await supabaseAdmin
        .from('users')
        .update({ token_balance: user.token_balance }) // Restore the exact balance we knew
        .eq('id', userId);
        
      return NextResponse.json({ error: 'Generation failed or timed out' }, { status: 504 });
    }

    return NextResponse.json({ success: true, episodeId: episode.id });

  } catch (error) {
    console.error('Episode creation error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
