const MatchService = require('./src/services/matchService.js');
const supabase = require('./src/db/supabase.js');

async function test() {
  const { data: fix } = await supabase.from('fixtures').select('*').eq('status', 'live').limit(1).single();
  if(!fix) { console.log('No live fixture'); return; }
  console.log('Live Fixture:', fix.id);
  
  // Try to add ball manually
  try {
     const res = await MatchService.addBall(fix.id, { runs_scored: 1, striker_name: 'test', bowler_name: 'test' });
     console.log('SUCCESS:', res);
  } catch(e) {
     console.log('ERROR:', e.message);
  }
}
test();
