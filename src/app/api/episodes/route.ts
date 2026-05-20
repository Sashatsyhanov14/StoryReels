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

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    interface DatabaseEpisode {
      id: string;
      user_id: string;
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
    }

    // Format to match the frontend Episode interface
    const formattedEpisodes = (episodes as DatabaseEpisode[]).map((ep) => {
      const isPending = ep.status === 'pending';
      const assets = ep.assets_json as PendingAssets | SceneItem[] | null;
      const isProgressObj = isPending && assets && typeof assets === 'object' && !Array.isArray(assets);
      
      const progress = isProgressObj ? (assets as PendingAssets).progress || 0 : 0;
      const step = isProgressObj ? (assets as PendingAssets).step || 'idle' : 'idle';
      const scenes = Array.isArray(assets) 
        ? (assets as SceneItem[]) 
        : (isProgressObj && (assets as PendingAssets).scenes ? ((assets as PendingAssets).scenes as unknown as SceneItem[]) : []);
      const userPrompt = isProgressObj ? (assets as PendingAssets).userPrompt : undefined;

      return {
        id: ep.id,
        title: !isPending && scenes[0] 
          ? scenes[0].text.substring(0, 20) + (scenes[0].text.length > 20 ? '...' : '')
          : (isProgressObj && userPrompt 
             ? userPrompt.substring(0, 20) + (userPrompt.length > 20 ? '...' : '')
             : 'Эпизод ' + ep.id.substring(0, 4)),
        prompt: isProgressObj && userPrompt 
          ? userPrompt 
          : (!isPending && scenes[0] ? scenes[0].imagePrompt : 'Описание отсутствует'),
        status: ep.status,
        createdAt: new Date(ep.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        scenes: scenes,
        progress,
        step
      };
    });

    return NextResponse.json({ episodes: formattedEpisodes });
  } catch (error) {
    console.error('Fetch episodes error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
