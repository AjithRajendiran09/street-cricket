require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function wipeDatabase() {
    console.log('Starting Clean Slate Protocol...');
    try {
        console.log('Wiping ball_by_ball...');
        let res = await supabase.from('ball_by_ball').delete().not('id', 'eq', '00000000-0000-0000-0000-000000000000');
        if (res.error) console.error("Error ball_by_ball:", res.error.message);

        console.log('Wiping match_scores...');
        res = await supabase.from('match_scores').delete().not('id', 'eq', '00000000-0000-0000-0000-000000000000');
        if (res.error) console.error("Error match_scores:", res.error.message);

        console.log('Wiping fixtures...');
        res = await supabase.from('fixtures').delete().not('id', 'eq', '00000000-0000-0000-0000-000000000000');
        if (res.error) console.error("Error fixtures:", res.error.message);

        console.log('Wiping teams...');
        res = await supabase.from('teams').delete().not('id', 'eq', '00000000-0000-0000-0000-000000000000');
        if (res.error) console.error("Error teams:", res.error.message);

        console.log('Wiping tournaments...');
        res = await supabase.from('tournaments').delete().not('id', 'eq', '00000000-0000-0000-0000-000000000000');
        if (res.error) console.error("Error tournaments:", res.error.message);

        console.log('DATABASE SUCCESSFULLY FORMATTED! READY FOR NEW SEASON.');
    } catch (err) {
        console.error("Critical Failure:", err);
    }
}

wipeDatabase();
