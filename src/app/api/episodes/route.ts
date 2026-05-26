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

    // Format to match the frontend ChatEpisode interface
    const formattedEpisodes = episodes.map((ep: any) => {
      const assets = ep.assets_json;
      
      let messages: any[] = [];
      let unlockedTillIndex = 5;
      
      if (assets && typeof assets === 'object') {
        if (Array.isArray(assets.messages)) {
          messages = assets.messages;
        }
        if (typeof assets.unlockedTillIndex === 'number') {
          unlockedTillIndex = assets.unlockedTillIndex;
        }
      } else if (Array.isArray(assets)) {
        messages = assets;
      }
      
      const title = messages[0]?.text
        ? messages[0].text.substring(0, 20) + (messages[0].text.length > 20 ? '...' : '')
        : 'Эпизод ' + ep.id.substring(0, 4);

      return {
        id: ep.id,
        userId: ep.user_id,
        title,
        prompt: 'Чат история',
        status: ep.status,
        createdAt: new Date(ep.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        messages: messages,
        unlockedTillIndex,
        showId: ep.show_id
      };
    });

    return NextResponse.json({ shows: shows || [], episodes: formattedEpisodes });
  } catch (error) {
    console.error('Fetch episodes error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
