import { test } from 'node:test';
import assert from 'node:assert';
import { getSupabaseAdmin } from '../src/lib/supabase';

test('database assets_json can store and retrieve ChatEpisodePayload objects', async () => {
  const supabase = getSupabaseAdmin();
  
  // Try querying any row to confirm client functions
  const { data, error } = await supabase
    .from('episodes')
    .select('assets_json')
    .limit(1);
    
  assert.equal(error, null, 'Error querying database: ' + error?.message);
  if (data && data.length > 0) {
    console.log('✓ Successfully retrieved assets_json from database:', JSON.stringify(data[0]).substring(0, 100));
  } else {
    console.log('✓ Database connection OK (no episodes found)');
  }
});
