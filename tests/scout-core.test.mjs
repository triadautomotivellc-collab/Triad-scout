import test from 'node:test';
import assert from 'node:assert/strict';
import {
 buildSearchBody, canonicalText, dedupeLots, estimateHammerFromComparables,
 lotMatchesQuery, parseVehicleQuery, scoreAuctionOpportunity
} from '../lib/scout-core.js';

test('canonical punctuation',()=>assert.equal(canonicalText('F-150 / XLT'),'f150 xlt'));
test('F150 normalization',()=>assert.equal(lotMatchesQuery({make:'FORD',model:'F-150'},parseVehicleQuery('ford f150')),true));

const parserCases=[
 ['taurus sho','FORD','Taurus',['SHO']],
 ['explorer sport','FORD','Explorer',['Sport']],
 ['explorer st','FORD','Explorer',['ST']],
 ['camaro ss','CHEVROLET','Camaro',['SS']],
 ['camaro zl1','CHEVROLET','Camaro',['ZL1']],
 ['camaro lt1','CHEVROLET','Camaro',['LT1']],
 ['corvette z06','CHEVROLET','Corvette',['Z06']],
 ['corvette zr1','CHEVROLET','Corvette',['ZR1']],
 ['mustang gt','FORD','Mustang',['GT']],
 ['mustang shelby gt500','FORD','Mustang',['Shelby GT500']],
 ['charger scat pack','DODGE','Charger',['Scat Pack']],
 ['challenger r/t','DODGE','Challenger',['R/T']],
 ['grand cherokee trackhawk','JEEP','Grand Cherokee',['Trackhawk']],
 ['civic type r','HONDA','Civic',['Type R']],
 ['wrx sti','SUBARU','WRX',['STI']]
];
for(const [q,make,model,trims] of parserCases){
 test(`parser ${q}`,()=>{
  const p=parseVehicleQuery(q);
  assert.equal(p.make,make); assert.equal(p.model,model); assert.deepEqual(p.trims,trims);
 });
}

test('Camaro SS base-model provider filter',()=>{
 const {body}=buildSearchBody({source:'copart_us',query:'camaro ss'});
 assert.deepEqual(body.makes,['CHEVROLET']); assert.deepEqual(body.models,['Camaro']);
});
test('Camaro SS accepts SS rejects LT',()=>{
 const q=parseVehicleQuery('camaro ss');
 assert.equal(lotMatchesQuery({make:'CHEVROLET',model:'CAMARO',trim:'SS'},q),true);
 assert.equal(lotMatchesQuery({make:'CHEVROLET',model:'CAMARO',trim:'LT'},q),false);
});
test('Taurus SHO rejects non-SHO',()=>{
 const q=parseVehicleQuery('taurus sho');
 assert.equal(lotMatchesQuery({make:'FORD',model:'Taurus',trim:'Limited'},q),false);
});
test('year and radius parse',()=>{
 const q=parseVehicleQuery('2015 2020 Ford Explorer within 250 miles');
 assert.equal(q.yearMin,2015); assert.equal(q.yearMax,2020); assert.equal(q.radiusMiles,250);
});
test('dedupe source lot',()=>{
 assert.equal(dedupeLots([{source:'copart_us',lot_number:'1'},{source:'copart_us',lot_number:'1'},{source:'iaai_us',lot_number:'1'}]).length,2);
});
test('deal score flood penalty',()=>{
 const good=scoreAuctionOpportunity({buyNow:3000,acv:15000,repairEstimate:1500,damage:'minor dent'});
 const bad=scoreAuctionOpportunity({buyNow:3000,acv:15000,repairEstimate:1500,damage:'flood'});
 assert.ok(good.score>bad.score);
});
test('current bid provisional',()=>{
 const s=scoreAuctionOpportunity({currentBid:500,acv:20000,repairEstimate:1000,damage:'front'});
 assert.ok(s.score<=89); assert.notEqual(s.confidence,'HIGH');
});
test('comp estimator robust against huge outlier',()=>{
 const comps=Array.from({length:40},(_,i)=>({make:'FORD',model:'Taurus',year:2013+i%4,mileage:70000+i*1500,damage:'front',finalPrice:3500+i%10*150,confirmedSold:true}));
 comps.push({make:'FORD',model:'Taurus',year:2014,mileage:80000,damage:'front',finalPrice:50000,confirmedSold:true});
 const e=estimateHammerFromComparables({make:'FORD',model:'Taurus',year:2014,mileage:90000,damage:'front'},comps);
 assert.equal(e.confidence,'HIGH'); assert.ok(e.estimate<10000);
});
