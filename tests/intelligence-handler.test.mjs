import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/intelligence.js';

function response(body,status=200){return {ok:status>=200&&status<300,status,async text(){return JSON.stringify(body)}}}
function mockRes(){return {statusCode:200,headers:{},payload:null,setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(v){this.payload=v;return this}}}
const originalFetch=globalThis.fetch;
const originalEnv={...process.env};

test.afterEach(()=>{globalThis.fetch=originalFetch;process.env={...originalEnv}});

test('intelligence handler degrades gracefully when optional providers are not configured',async()=>{
  process.env.SALVAGEALERT_KEY='test'; delete process.env.MARKETCHECK_API_KEY;delete process.env.CARSXE_API_KEY;delete process.env.SUPERDISPATCH_PRICING_KEY;
  globalThis.fetch=async(url)=>{
    const s=String(url);
    if(s.includes('vpic.nhtsa.dot.gov')) return response({Results:[{Make:'CHEVROLET',Model:'CORVETTE',Trim:'Base',BodyClass:'Coupe'}]});
    if(s.includes('/api/v1/inventory')) return response({lots:[
      {year:2006,make:'CHEVROLET',model:'CORVETTE',trim:'Base',odometer:70000,primary_damage:'front',title_type:'salvage',final_price:6500,status:'sold',sale_date:'2026-07-01',source:'iaai_us'},
      {year:2007,make:'CHEVROLET',model:'CORVETTE',trim:'Base',odometer:73000,primary_damage:'front',title_type:'salvage',sold_price:6900,status:'sold',sale_date:'2026-07-05',source:'iaai_us'},
      {year:2005,make:'CHEVROLET',model:'CORVETTE',trim:'Base',odometer:76000,primary_damage:'front',title_type:'salvage',final_price:6200,status:'sold',sale_date:'2026-06-20',source:'iaai_us'}
    ]});
    throw new Error('unexpected fetch '+s);
  };
  const res=mockRes();
  await handler({method:'POST',body:{lot:{source:'IAA',vin:'1G1YY26U265123456',year:2006,make:'CHEVROLET',model:'CORVETTE',trim:'Base',mileage:70000,damage:'front',titleStatus:'salvage',currentBid:2000,acv:15000},profile:{}}},res);
  assert.equal(res.statusCode,200);assert.equal(res.payload.ok,true);
  assert.ok(res.payload.snapshot.hammer.estimate>0);
  assert.equal(res.payload.providers.marketCheck.status,'not_configured');
  assert.equal(res.payload.snapshot.economics.maxBid,null);
});

test('configured providers can build a complete Copart hard-cap snapshot',async()=>{
  process.env.SALVAGEALERT_KEY='test';process.env.MARKETCHECK_API_KEY='mc';process.env.CARSXE_API_KEY='cx';process.env.SUPERDISPATCH_PRICING_KEY='sd';process.env.MARKETCHECK_TIER='premium';
  globalThis.fetch=async(url,opts={})=>{
    const s=String(url);
    if(s.includes('vpic.nhtsa.dot.gov')) return response({Results:[{Make:'FORD',Model:'F-150',Trim:'XLT',BodyClass:'Pickup',FuelTypePrimary:'Gasoline'}]});
    if(s.includes('/api/v1/inventory')) return response({lots:Array.from({length:30},(_,i)=>({year:2020+(i%3)-1,make:'FORD',model:'F-150',trim:'XLT',odometer:50000+i*1000,primary_damage:i%2?'front':'rear',title_type:'salvage',final_price:5000+(i%6)*150,status:'sold',sale_date:'2026-07-01',source:'copart_us'}))});
    if(s.includes('api.marketcheck.com')) return response({marketcheck_price:20000,recent_comparables:{num_found:321,stats:{price:{percentiles:{'25.0':18500,'75.0':21500}}}}});
    if(s.includes('api.carsxe.com')) return response({retail:19800,auctionValues:{lowAuctionValue:14000,averageAuctionValue:15000,highAuctionValue:16500}});
    if(s.includes('pricing-insights.superdispatch.com')) return response({meta:{status:'success'},data:{price:800,price_range_lower:700,price_range_upper:900,confidence:91,distance_miles:480,volume:42,recent_moves:[]}});
    throw new Error('unexpected '+s);
  };
  const res=mockRes();
  await handler({method:'POST',body:{lot:{source:'Copart',vin:'1FTFW1ET1EFA12345',year:2020,make:'FORD',model:'F-150',trim:'XLT',mileage:62000,damage:'front',titleStatus:'salvage',currentBid:3000,acv:18000,repairEstimate:3500,yardZip:'75001'},profile:{destinationZip:'53913',taxRate:.055,targetMargin:.18,minProfit:2500,rebuiltDiscount:.25,copartProfileConfirmed:true,bidMode:'live',manualRepair:{base:3500,low:3200,high:4000}}}},res);
  assert.equal(res.statusCode,200);assert.equal(res.payload.ok,true);
  assert.equal(res.payload.providers.marketCheck.ok,true);assert.equal(res.payload.providers.transport.ok,true);
  assert.ok(res.payload.snapshot.hammer.count>=25);
  assert.ok(res.payload.snapshot.economics.maxBid!==null);
  assert.equal(res.payload.snapshot.economics.hardCap,true);
});

test('same-ZIP transport never assumes free shipping',async()=>{
  process.env.SALVAGEALERT_KEY='test';process.env.SUPERDISPATCH_PRICING_KEY='sd';delete process.env.MARKETCHECK_API_KEY;delete process.env.CARSXE_API_KEY;
  globalThis.fetch=async(url)=>{
    const s=String(url);
    if(s.includes('vpic.nhtsa.dot.gov')) return response({Results:[{Make:'FORD',Model:'F-150',BodyClass:'Pickup'}]});
    if(s.includes('/api/v1/inventory')) return response({lots:[]});
    throw new Error('Super Dispatch should not be called for same ZIP');
  };
  const res=mockRes();
  await handler({method:'POST',body:{lot:{source:'IAA',vin:'1FTFW1ET1EFA12345',year:2020,make:'FORD',model:'F-150',yardZip:'53913'},profile:{destinationZip:'53913'}}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.payload.providers.transport.ok,false);
  assert.equal(res.payload.providers.transport.status,'local_move');
  assert.equal(res.payload.snapshot.transport.available,false);
});
