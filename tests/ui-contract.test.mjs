import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('live zero does not show demos',()=>assert.match(html,/function activeListings\(\)\{if\(FEED_MODE==='salvagealert'\|\|FEED_MODE==='yardlink'\)return LIVE_LISTINGS;return DEMO_LISTINGS\}/));
test('Smart search is default',()=>assert.match(html,/<option value="smart" selected>Smart US Search/));

test('intelligence panel is embedded in result cards',()=>{assert.match(html,/TRIAD Intelligence/);assert.match(html,/data-intel-id/);assert.match(html,/\/api\/intelligence/)});
test('intelligence profile does not silently invent tax or salvage resale discount',()=>{assert.match(html,/id="intelTaxRate"[^>]*placeholder="5\.5"/);assert.match(html,/id="intelRebuiltDiscount"[^>]*placeholder="25"/)});
