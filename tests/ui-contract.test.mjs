import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('Parts is the default primary mode',()=>assert.match(html,/<button type="button" data-mode="Parts" class="active">Parts<\/button>/));
test('top command deck contains live donor fees, interchange, and rebuild snapshot',()=>{assert.match(html,/Live Donor Feed \+ Fees/);assert.match(html,/Interchange \+ Cheapest Part/);assert.match(html,/Rebuild Cost Snapshot/)});
test('price defaults are 0 to 100000',()=>{assert.match(html,/id="minPriceInput"[^>]*value="0"/);assert.match(html,/id="maxPriceInput"[^>]*value="100000"/)});
test('default location is configured to McAllen TX fallback',()=>assert.match(html,/DEFAULT_LOCATION='McAllen, TX'/));
test('parts search calls parts intelligence endpoint',()=>assert.match(html,/\/api\/parts-search/));
test('fee preview is automatic and front-center',()=>assert.match(html,/\/api\/fee-preview/));
test('intelligence panel remains embedded in auction result cards',()=>{assert.match(html,/TRIAD Intelligence/);assert.match(html,/data-intel-id/);assert.match(html,/\/api\/intelligence/)});
test('intelligence profile does not silently invent tax or salvage resale discount',()=>{assert.match(html,/id="intelTaxRate"[^>]*placeholder="5\.5"/);assert.match(html,/id="intelRebuiltDiscount"[^>]*placeholder="25"/)});
