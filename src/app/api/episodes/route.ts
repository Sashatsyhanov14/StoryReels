import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: episodes, error } = await supabase
      .from('episodes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const { data: shows, error: showsError } = await supabase
      .from('shows')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || showsError) {
      return NextResponse.json({ error: error?.message || showsError?.message }, { status: 500 });
    }

    interface DatabaseEpisode {
      id: string;
      user_id: string;
      show_id?: string;
      status: 'pending' | 'ready' | 'failed';
      assets_json: unknown;
      created_at: string;
    }

    interface PendingAssets {
      progress?: number;
      step?: string;
      userPrompt?: string;
      scenes?: unknown[];
    }

    interface SceneItem {
      text: string;
      imagePrompt: string;
      imageUrl: string;
      audioUrl: string;
      sceneText?: string;
      cameraEffect?: string;
      transition?: string;
    }

    // Format to match the frontend Episode interface
    const formattedEpisodes = (episodes as DatabaseEpisode[]).map((ep) => {
      const status = ep.status;
      const assets = ep.assets_json;
      
      let progress = 0;
      let step = 'idle';
      let userPrompt = '';
      let rawScenes: any[] = [];
      
      if (assets && typeof assets === 'object' && !Array.isArray(assets)) {
        const progressObj = assets as Record<string, any>;
        progress = progressObj.progress || 0;
        step = progressObj.step || 'idle';
        userPrompt = progressObj.userPrompt || '';
        rawScenes = Array.isArray(progressObj.scenes) ? progressObj.scenes : [];
      } else if (Array.isArray(assets)) {
        rawScenes = assets;
      }
      
      // Map scenes consistently
      const scenes = rawScenes.map((s, i) => {
        if (!s) return null;
        
        // Handle database differences between raw pending script and final ready formattedScenes
        const voiceText = s.text || s.voice_text || `Сцена ${i + 1}`;
        const imagePrompt = s.imagePrompt || s.image_prompt || '16-bit pixel art style, retro JRPG aesthetic';
        const sceneText = s.sceneText || s.scene_text || `Описание кадра ${i + 1}`;
        const cameraEffect = s.cameraEffect || s.camera_effect || 'zoom-in-fast';
        const transition = s.transition || 'cross-fade';
        const imageUrl = s.imageUrl || '';
        const audioUrl = s.audioUrl || '#';
        
        return {
          imageUrl,
          audioUrl,
          text: voiceText,
          imagePrompt,
          cameraEffect,
          transition,
          sceneText
        };
      }).filter(Boolean);

      const title = scenes[0]?.text
        ? scenes[0].text.substring(0, 20) + (scenes[0].text.length > 20 ? '...' : '')
        : (userPrompt 
           ? userPrompt.substring(0, 20) + (userPrompt.length > 20 ? '...' : '')
           : 'Эпизод ' + ep.id.substring(0, 4));

      return {
        id: ep.id,
        title,
        prompt: userPrompt || (scenes[0] ? scenes[0].imagePrompt : 'Описание отсутствует'),
        status: ep.status,
        createdAt: new Date(ep.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        scenes: scenes,
        progress,
        step,
        showId: ep.show_id
      };
    });

    return NextResponse.json({ shows: shows || [], episodes: formattedEpisodes });
  } catch (error) {
    console.error('Fetch episodes error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
