import fs from 'fs';
const file = process.argv[2];
const raw = fs.readFileSync(file, 'utf8');
const obj = JSON.parse(raw);
const recs = obj.data.filter(r => r.product_id === 'IF' && r.ranking_type === 'volume');
const byContract = {};
for (const r of recs) {
  (byContract[r.instrument_id] ??= []).push(r);
}
for (const [c, list] of Object.entries(byContract)) {
  list.sort((a,b)=>a.rank-b.rank);
  console.log(`=== ${c} 成交量排名（前${list.length}名）===`);
  for (const r of list) {
    console.log(`${String(r.rank).padStart(2)}  ${r.member_name.padEnd(16)}  成交量 ${String(r.volume).padStart(9)}  增减 ${r.change_from_previous_day>=0?'+':''}${r.change_from_previous_day}`);
  }
  console.log('');
}
