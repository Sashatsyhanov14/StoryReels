import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const { data: episodes, error } = await supabaseAdmin
      .from('episodes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format to match the frontend Episode interface
    const formattedEpisodes = episodes.map((ep: any) => {
      const isPending = ep.status === 'pending';
      const assets = ep.assets_json;
      const isProgressObj = isPending && assets && typeof assets === 'object' && !Array.isArray(assets);
      
      const progress = isProgressObj ? (assets as any).progress : 0;
      const step = isProgressObj ? (assets as any).step : 'idle';
      const scenes = Array.isArray(assets) ? assets : [];

      return {
        id: ep.id,
        title: !isPending && scenes[0] 
          ? scenes[0].text.substring(0, 20) + (scenes[0].text.length > 20 ? '...' : '')
          : 'Эпизод ' + ep.id.substring(0, 4),
        prompt: !isPending && scenes[0] ? scenes[0].imagePrompt : 'Описание отсутствует',
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
