import test from 'node:test';
import assert from 'node:assert/strict';
import {
  copartBuyerFee, auctionFeeEstimate, estimateHammerV2, riskAssessment,
  solveMaxBid, buildIntelligenceSnapshot, normalizeRepairEstimate,
  normalizeTransportEstimate, fuseMarketValues
} from '../lib/intelligence-core.js';

test('Copart clean fee table changes correctly at $500 boundary',()=>{
  const a=copartBuyerFee(499.99,{titleGroup:'clean',bidMode:'live',profileConfirmed:true});
  const b=copartBuyerFee(500,{titleGroup:'clean',bidMode:'live',profileConfirmed:true});
  assert.equal(a.buyerFee,160); assert.equal(a.virtualFee,49); assert.equal(a.total,303);
  assert.equal(b.buyerFee,185); assert.equal(b.virtualFee,59); assert.equal(b.total,338);
});

test('Copart percentage buyer fee activates at $15k',()=>{
  const a=copartBuyerFee(14999.99,{titleGroup:'clean',bidMode:'live',profileConfirmed:true});
  const b=copartBuyerFee(15000,{titleGroup:'clean',bidMode:'live',profileConfirmed:true});
  assert.equal(a.buyerFee,850);
  assert.equal(b.buyerFee,Math.round(15000*.0725));
  assert.ok(b.total>a.total);
});

test('Copart prebid virtual fee is lower than live at same bid',()=>{
  const pre=copartBuyerFee(5000,{titleGroup:'nonclean',bidMode:'prebid',profileConfirmed:true});
  const live=copartBuyerFee(5000,{titleGroup:'nonclean',bidMode:'live',profileConfirmed:true});
  assert.ok(pre.virtualFee<live.virtualFee);
});

test('IAA does not invent fees without user override',()=>{
  const fee=auctionFeeEstimate('IAA',5000,{});
  assert.equal(fee.known,false); assert.equal(fee.total,null);
});

test('IAA user override produces low-confidence fee estimate',()=>{
  const fee=auctionFeeEstimate('IAA',5000,{iaaFixedFee:400,iaaFeePercent:.05});
  assert.equal(fee.known,true); assert.equal(fee.total,650); assert.equal(fee.confidence,'LOW');
});

function comps({count=30,base=5000,outlier=false,confirmed=true}={}){
  const arr=[];
  for(let i=0;i<count;i++) arr.push({
    year:2018+(i%5),make:'FORD',model:'F-150',trim:'XLT',mileage:45000+i*1500,
    damage:i%2?'front':'rear',titleStatus:'salvage',runDrive:true,keys:true,
    finalPrice:confirmed?base+(i%7)*120:0,lastObservedBid:confirmed?0:base+(i%7)*120,
    sold:confirmed,status:confirmed?'sold':'ended',saleDate:'2026-07-15',source:i%2?'IAA':'Copart'
  });
  if(outlier) arr.push({year:2020,make:'FORD',model:'F-150',trim:'XLT',mileage:50000,damage:'front',titleStatus:'salvage',finalPrice:90000,sold:true,status:'sold',saleDate:'2026-07-20',source:'IAA'});
  return arr;
}

test('Hammer estimator resists one huge outlier',()=>{
  const target={year:2020,make:'FORD',model:'F-150',trim:'XLT',mileage:60000,damage:'front',titleStatus:'salvage',runDrive:true,keys:true};
  const normal=estimateHammerV2(target,comps());
  const withOutlier=estimateHammerV2(target,comps({outlier:true}));
  assert.ok(normal.estimate>4500&&normal.estimate<7000);
  assert.ok(Math.abs(withOutlier.estimate-normal.estimate)<500);
});

test('Live current bids are excluded from historical hammer labels',()=>{
  const target={year:2020,make:'FORD',model:'F-150'};
  const rows=[
    {year:2020,make:'FORD',model:'F-150',currentBid:9000,status:'live',saleDate:'2026-09-10'},
    {year:2020,make:'FORD',model:'F-150',currentBid:8000,status:'active',saleDate:'2026-09-10'},
    {year:2020,make:'FORD',model:'F-150',currentBid:7000,status:'open',saleDate:'2026-09-10'}
  ];
  const r=estimateHammerV2(target,rows,{nowMs:Date.parse('2026-08-25')});
  assert.equal(r.count,0); assert.equal(r.estimate,null);
});

test('Sparse comps remain low confidence',()=>{
  const target={year:2020,make:'FORD',model:'F-150'};
  const r=estimateHammerV2(target,comps({count:3}));
  assert.equal(r.confidence,'LOW');
});

test('Flood and parts-only lots block a hard max bid',()=>{
  assert.equal(riskAssessment({damage:'Flood'}).hardCapBlocked,true);
  assert.equal(riskAssessment({titleStatus:'Parts Only'}).valuationMode,'parts');
});

test('Binary max-bid solver respects nonlinear fees',()=>{
  const fee=b=>b<5000?500:1000;
  const cap=solveMaxBid({resaleConservative:15000,feeFunction:fee,fixedConservativeCosts:5000,targetProfit:2500,bidIncrement:25});
  assert.equal(cap,6500);
});

test('Higher repair cost lowers max bid',()=>{
  const base={
    lot:{source:'Copart',year:2020,make:'FORD',model:'F-150',damage:'front',titleStatus:'salvage',buyNow:3000,acv:18000},
    marketCheck:{value:20000,low:18000,high:22000},
    transportProvider:{provider:'test',base:700,low:650,high:800,confidence:'HIGH'},
    profile:{taxRate:.05,targetMargin:.18,minProfit:2000,rebuiltDiscount:.25,copartProfileConfirmed:true,bidMode:'live'}
  };
  const low=buildIntelligenceSnapshot({...base,repairProvider:{provider:'test',base:2000,low:1800,high:2300,confidence:'HIGH'}});
  const high=buildIntelligenceSnapshot({...base,repairProvider:{provider:'test',base:6000,low:5500,high:7000,confidence:'HIGH'}});
  assert.ok(low.economics.maxBid>high.economics.maxBid);
});

test('Higher tax rate lowers max bid',()=>{
  const common={lot:{source:'Copart',year:2020,make:'FORD',model:'F-150',damage:'front',titleStatus:'salvage',buyNow:3000,acv:18000},marketCheck:{value:20000,low:18000,high:22000},transportProvider:{provider:'test',base:700,low:650,high:800,confidence:'HIGH'},repairProvider:{provider:'test',base:3000,low:2800,high:3400,confidence:'HIGH'}};
  const a=buildIntelligenceSnapshot({...common,profile:{taxRate:.02,targetMargin:.18,minProfit:2000,rebuiltDiscount:.25,copartProfileConfirmed:true,bidMode:'live'}});
  const b=buildIntelligenceSnapshot({...common,profile:{taxRate:.10,targetMargin:.18,minProfit:2000,rebuiltDiscount:.25,copartProfileConfirmed:true,bidMode:'live'}});
  assert.ok(a.economics.maxBid>b.economics.maxBid);
});

test('Unknown tax prevents hard and provisional cap',()=>{
  const s=buildIntelligenceSnapshot({lot:{source:'Copart',year:2020,make:'FORD',model:'F-150',damage:'front',titleStatus:'salvage',buyNow:3000,acv:18000},marketCheck:{value:20000,low:18000,high:22000},repairProvider:{provider:'x',base:3000,low:2800,high:3400,confidence:'HIGH'},transportProvider:{provider:'x',base:700,low:650,high:800,confidence:'HIGH'},profile:{rebuiltDiscount:.25,copartProfileConfirmed:true}});
  assert.equal(s.economics.maxBid,null); assert.equal(s.economics.provisionalMaxBid,null);
  assert.ok(s.blockers.includes('tax/resale profile'));
});

test('Auction ACV alone cannot create a hard resale basis',()=>{
  const m=fuseMarketValues({acv:20000,rebuiltDiscount:.25});
  assert.equal(m.available,true); assert.equal(m.hard,false);
});

test('Manual repair and transport estimates are hard cost inputs',()=>{
  assert.equal(normalizeRepairEstimate({manual:{base:4000}}).hard,true);
  assert.equal(normalizeTransportEstimate({manual:{base:900}}).hard,true);
});
