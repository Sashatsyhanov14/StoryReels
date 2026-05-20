import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { episodeId } = await request.json();

    if (!episodeId) {
      return NextResponse.json({ error: 'Episode ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    await supabase
      .from('episodes')
      .update({ status: 'failed' })
      .eq('id', episodeId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to mark episode as failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
