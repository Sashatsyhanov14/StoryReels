import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Mock function representing Polza.ai LLM generation
async function generateScript() {
  return Array.from({ length: 15 }, (_, i) => ({
    image_prompt: `cyberpunk neon noir scene part ${i + 1}`,
    text: `Line of dialogue or narration ${i + 1}`
  }));
}

// Mock function for Flux rendering
async function generateImage(prompt: string, seed: string) {
  // Simulate API call delay
  await new Promise(res => setTimeout(res, 500));
  return `https://example.com/generated-images/flux_${seed}_${Math.random().toString(36).substring(7)}.jpg`;
}

// Mock function for TTS
async function generateAudio(text: string) {
  // Use text to simulate text usage
  await new Promise(res => setTimeout(res, 300));
  return `https://example.com/generated-audio/tts_${text.substring(0, 5)}_${Math.random().toString(36).substring(7)}.mp3`;
}

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

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
        const script = await generateScript();
        const seed = '888999'; // Fixed seed for consistency
        
        // Parallel rendering of 15 pairs
        const assetPromises = script.map(async (frame) => {
          const [imageUrl, audioUrl] = await Promise.all([
            generateImage(frame.image_prompt, seed),
            generateAudio(frame.text)
          ]);
          return { imageUrl, audioUrl };
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

    // Timeout mechanism (15 seconds as per spec)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Generation timeout')), 15000);
    });

    // Run generation, we await it here for the sake of the API response,
    // though in a real app this might be a background job and the client polls.
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
