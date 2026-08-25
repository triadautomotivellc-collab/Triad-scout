import { canonicalText, numberFrom } from './scout-core.js';

export const INTELLIGENCE_VERSION = '0.7.0-alpha';

function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
function roundMoney(n){return Number.isFinite(n)?Math.round(n):null}
function safeNumber(v){const n=numberFrom(v);return Number.isFinite(n)?n:0}

// Copart U.S. licensed, lower-volume Standard Pricing, secured payment.
// Source snapshot: https://www.copart.com/content/us/en/member-fees-us-licensed-less
// Effective/reference date for this implementation: 2026-08-25.
// The user's actual Copart account profile MUST match this profile before a hard cap is treated as authoritative.
const CLEAN_BUYER_FEE = Object.freeze([
 [49.99,25],[99.99,45],[199.99,80],[299.99,120],[349.99,120],[399.99,120],[449.99,160],[499.99,160],
 [549.99,185],[599.99,185],[699.99,210],[799.99,230],[899.99,250],[999.99,275],[1199.99,325],[1299.99,350],
 [1399.99,365],[1499.99,380],[1599.99,390],[1699.99,410],[1799.99,420],[1999.99,440],[2399.99,470],[2499.99,480],
 [2999.99,500],[3499.99,600],[3999.99,675],[4499.99,710],[4999.99,750],[5499.99,750],[5999.99,750],[6499.99,800],
 [6999.99,800],[7499.99,800],[7999.99,815],[8499.99,840],[8999.99,840],[9999.99,840],[10499.99,850],[10999.99,850],
 [11499.99,850],[11999.99,850],[12499.99,850],[14999.99,850]
]);

const NONCLEAN_BUYER_FEE = Object.freeze([
 [49.99,25],[99.99,45],[199.99,80],[299.99,130],[349.99,137.5],[399.99,145],[449.99,175],[499.99,185],
 [549.99,205],[599.99,210],[699.99,240],[799.99,270],[899.99,295],[999.99,320],[1199.99,375],[1299.99,395],
 [1399.99,410],[1499.99,430],[1599.99,445],[1699.99,465],[1799.99,485],[1999.99,510],[2399.99,535],[2499.99,570],
 [2999.99,610],[3499.99,655],[3999.99,705],[4499.99,725],[4999.99,750],[5499.99,775],[5999.99,800],[6499.99,825],
 [6999.99,845],[7499.99,880],[7999.99,900],[8499.99,925],[8999.99,945],[9999.99,945],[10499.99,1000],[10999.99,1000],
 [11499.99,1000],[11999.99,1000],[12499.99,1000],[14999.99,1000]
]);

const CLEAN_PREBID = Object.freeze([[99.99,0],[499.99,39],[999.99,49],[1499.99,69],[1999.99,79],[3999.99,89],[5999.99,99],[7999.99,119],[Infinity,129]]);
const CLEAN_LIVE = Object.freeze([[99.99,0],[499.99,49],[999.99,59],[1499.99,79],[1999.99,89],[3999.99,99],[5999.99,109],[7999.99,139],[Infinity,149]]);
const NONCLEAN_PREBID = Object.freeze([[99.99,0],[499.99,40],[999.99,55],[1499.99,75],[1999.99,85],[3999.99,100],[5999.99,110],[7999.99,125],[Infinity,140]]);
const NONCLEAN_LIVE = Object.freeze([[99.99,0],[499.99,50],[999.99,65],[1499.99,85],[1999.99,95],[3999.99,110],[5999.99,125],[7999.99,145],[Infinity,160]]);

export const COPART_FEE_PROFILE = Object.freeze({
 id:'copart_us_licensed_low_volume_standard_secured_2026_08_25',
 source:'Copart official U.S. licensed fee page',
 sourceUrl:'https://www.copart.com/content/us/en/member-fees-us-licensed-less',
 effectiveDate:'2026-08-25',
 paymentMethod:'secured',
 pricingTier:'standard',
 volumeClass:'lower-volume',
 clean:{ gate:79, environmental:15, buyerRateAbove15000:.0725 },
 nonclean:{ gate:95, environmental:15, buyerRateAbove15000:.075 }
});

function lookupTable(value, table){
 const v=Math.max(0,Number(value)||0);
 for(const [max,fee] of table) if(v<=max) return fee;
 return table.at(-1)?.[1] ?? 0;
}

export function classifyTitleGroup(titleStatus=''){
 const s=canonicalText(titleStatus);
 if(!s) return 'unknown';
 if(/clean|clear/.test(s) && !/salvage|junk|parts only|non repairable|certificate of destruction/.test(s)) return 'clean';
 if(/salvage|rebuilt|rebuildable|junk|parts only|non repairable|certificate of destruction|flood/.test(s)) return 'nonclean';
 return 'unknown';
}

export function copartBuyerFee(bid, options={}){
 const amount=Math.max(0,Number(bid)||0);
 const titleGroup=options.titleGroup==='clean'?'clean':options.titleGroup==='nonclean'?'nonclean':'unknown';
 const conservativeGroup=titleGroup==='unknown'?'nonclean':titleGroup;
 const bidMode=options.bidMode==='prebid'?'prebid':'live';
 const buyerTable=conservativeGroup==='clean'?CLEAN_BUYER_FEE:NONCLEAN_BUYER_FEE;
 const buyerFee=amount>=15000
  ? amount*(conservativeGroup==='clean'?COPART_FEE_PROFILE.clean.buyerRateAbove15000:COPART_FEE_PROFILE.nonclean.buyerRateAbove15000)
  : lookupTable(amount,buyerTable);
 const virtualTable=conservativeGroup==='clean'
  ? (bidMode==='prebid'?CLEAN_PREBID:CLEAN_LIVE)
  : (bidMode==='prebid'?NONCLEAN_PREBID:NONCLEAN_LIVE);
 const virtualFee=lookupTable(amount,virtualTable);
 const gateFee=conservativeGroup==='clean'?COPART_FEE_PROFILE.clean.gate:COPART_FEE_PROFILE.nonclean.gate;
 const environmentalFee=15;
 const titleDelivery=Math.max(0,Number(options.titleDelivery)||0);
 const financeFee=options.thirdPartyFinance?69:0;
 const total=buyerFee+virtualFee+gateFee+environmentalFee+titleDelivery+financeFee;
 return {
  provider:'Copart', profile:COPART_FEE_PROFILE.id, amount,
  titleGroup, assumedTitleGroup:titleGroup==='unknown'?conservativeGroup:null,
  bidMode, buyerFee:roundMoney(buyerFee), virtualFee:roundMoney(virtualFee), gateFee,
  environmentalFee, titleDelivery, financeFee, total:roundMoney(total),
  exactProfile:titleGroup!=='unknown' && options.profileConfirmed===true,
  confidence:options.profileConfirmed===true && titleGroup!=='unknown'?'HIGH':'MED',
  caveat:options.profileConfirmed===true
   ? 'Calculated from the selected Copart fee profile.'
   : 'Fee schedule is current, but the buyer must confirm this Copart account/profile and title group.'
 };
}

export function auctionFeeEstimate(source, bid, options={}){
 const s=canonicalText(source);
 if(s.includes('copart')) return {known:true,...copartBuyerFee(bid,options)};
 if(s.includes('iaa')){
  const fixed=Math.max(0,Number(options.iaaFixedFee)||0);
  const pct=Math.max(0,Number(options.iaaFeePercent)||0);
  if(fixed>0 || pct>0){
   return {known:true,provider:'IAA',amount:bid,total:roundMoney(fixed+bid*pct),confidence:'LOW',exactProfile:false,caveat:'User-supplied IAA fee override. Verify against the logged-in IAA Cost Calculator.'};
  }
  return {known:false,provider:'IAA',amount:bid,total:null,confidence:'UNKNOWN',exactProfile:false,caveat:'IAA exposes a logged-in Cost Calculator; no universal public fee schedule is hard-coded.'};
 }
 if(s.includes('govdeal')) return {known:false,provider:'GovDeals',amount:bid,total:null,confidence:'UNKNOWN',exactProfile:false,caveat:'Buyer premium and fees vary by GovDeals seller/listing; use listing-specific terms.'};
 return {known:false,provider:String(source||'Unknown'),amount:bid,total:null,confidence:'UNKNOWN',exactProfile:false,caveat:'No verified fee profile is configured.'};
}

function weightedQuantile(points,q){
 const clean=(points||[]).filter(p=>Number.isFinite(p.value)&&p.value>0&&Number.isFinite(p.weight)&&p.weight>0).sort((a,b)=>a.value-b.value);
 if(!clean.length) return null;
 const total=clean.reduce((s,p)=>s+p.weight,0);
 const threshold=total*clamp(q,0,1);
 let acc=0;
 for(const p of clean){acc+=p.weight;if(acc>=threshold)return p.value}
 return clean.at(-1).value;
}

function damageFamily(value=''){
 const s=canonicalText(value);
 if(/flood|water/.test(s))return 'flood';
 if(/burn|fire/.test(s))return 'fire';
 if(/rollover|roll over/.test(s))return 'rollover';
 if(/hail/.test(s))return 'hail';
 if(/mechanical/.test(s))return 'mechanical';
 if(/undercarriage/.test(s))return 'undercarriage';
 if(/front/.test(s))return 'front';
 if(/rear/.test(s))return 'rear';
 if(/side|left|right/.test(s))return 'side';
 if(/minor|dent|scratch|cosmetic/.test(s))return 'cosmetic';
 if(/theft|vandal/.test(s))return 'theft';
 return s||'unknown';
}

function compSaleValue(comp={}, nowMs=Date.now()){
 const final=safeNumber(comp.finalPrice||comp.soldPrice||comp.salePrice||comp.hammerPrice||comp.final_bid);
 const status=canonicalText(comp.saleStatus||comp.status||comp.sale_status||comp.auctionStatus);
 const soldFlag=comp.sold===true||comp.isSold===true||/sold|closed|ended|complete|awarded/.test(status);
 const liveFlag=comp.live===true||comp.isLive===true||/live|upcoming|active|open|prebid|pre bid/.test(status);
 if(final>0 && (soldFlag || !liveFlag)) return {value:final,grade:'A',saleWeight:1,confirmed:true};
 const saleDate=Date.parse(comp.saleDate||comp.soldAt||comp.auctionDate||comp.date||'');
 const clearlyPast=Number.isFinite(saleDate) && saleDate < nowMs-12*3600*1000;
 const last=safeNumber(comp.lastBid||comp.lastObservedBid||comp.highBid||comp.currentBid||comp.bid||comp.price);
 if(last>0 && !liveFlag && (soldFlag||clearlyPast)) return {value:last,grade:'B',saleWeight:.68,confirmed:false};
 return {value:0,grade:'X',saleWeight:0,confirmed:false};
}

export function estimateHammerV2(target={}, comps=[], options={}){
 const targetYear=Number(target.year);
 const targetMileage=safeNumber(target.mileage||target.odometer);
 const targetMake=canonicalText(target.make);
 const targetModel=canonicalText(target.model);
 const targetTrim=canonicalText(target.trim);
 const targetDamage=damageFamily(target.damage);
 const targetTitle=classifyTitleGroup(target.titleStatus||target.title);
 const now=Number(options.nowMs)||Date.now();
 const tauYear=Number(options.tauYear)||2.4;
 const tauMiles=Number(options.tauMiles)||65000;
 const tauDays=Number(options.tauDays)||365;
 const points=[];
 const sources=new Set();
 let confirmedCount=0;

 for(const comp of comps||[]){
  const sale=compSaleValue(comp,now);if(sale.value<=0)continue;
  const make=canonicalText(comp.make);const model=canonicalText(comp.model);
  if(targetMake&&make&&make!==targetMake)continue;
  if(targetModel&&model&&!(model.includes(targetModel)||targetModel.includes(model)))continue;
  let weight=sale.saleWeight;
  const year=Number(comp.year);
  if(Number.isFinite(targetYear)&&Number.isFinite(year))weight*=Math.exp(-Math.abs(targetYear-year)/tauYear);
  const mileage=safeNumber(comp.mileage||comp.odometer);
  if(targetMileage>0&&mileage>0)weight*=Math.exp(-Math.abs(targetMileage-mileage)/tauMiles);
  const compTrim=canonicalText(comp.trim);
  if(targetTrim){weight*=compTrim?(compTrim.includes(targetTrim)||targetTrim.includes(compTrim)?1.35:.58):.78}
  const compDamage=damageFamily(comp.damage);
  weight*=compDamage===targetDamage?1.30:(targetDamage==='unknown'||compDamage==='unknown'?.85:.65);
  const compTitle=classifyTitleGroup(comp.titleStatus||comp.title);
  if(targetTitle!=='unknown'&&compTitle!=='unknown')weight*=compTitle===targetTitle?1.12:.78;
  if(target.runDrive!==undefined&&comp.runDrive!==undefined)weight*=target.runDrive===comp.runDrive?1.08:.9;
  if(target.keys!==undefined&&comp.keys!==undefined)weight*=target.keys===comp.keys?1.04:.94;
  const soldAt=Date.parse(comp.saleDate||comp.soldAt||comp.updatedAt||comp.date||'');
  if(Number.isFinite(soldAt)){const ageDays=Math.max(0,(now-soldAt)/86400000);weight*=Math.exp(-ageDays/tauDays)}
  if(weight<.06)continue;
  points.push({value:sale.value,weight,grade:sale.grade,source:comp.source||'unknown'});
  sources.add(canonicalText(comp.source||'unknown'));if(sale.confirmed)confirmedCount++;
 }

 if(points.length<3)return {count:points.length,effectiveN:0,estimate:null,low:null,high:null,p10:null,p90:null,confidence:'LOW',confirmedCount,sourceCount:sources.size,dispersion:null};
 const sumW=points.reduce((s,p)=>s+p.weight,0);
 const sumW2=points.reduce((s,p)=>s+p.weight*p.weight,0);
 const effectiveN=sumW2>0?(sumW*sumW)/sumW2:0;
 const estimate=weightedQuantile(points,.5), low=weightedQuantile(points,.25), high=weightedQuantile(points,.75);
 const p10=weightedQuantile(points,.1), p90=weightedQuantile(points,.9);
 const dispersion=estimate>0?(high-low)/estimate:1;
 let confidence='LOW';
 if(effectiveN>=20&&points.length>=25&&dispersion<=.55&&confirmedCount/points.length>=.35)confidence='HIGH';
 else if(effectiveN>=7&&points.length>=10&&dispersion<=.9)confidence='MED';
 return {count:points.length,effectiveN:Number(effectiveN.toFixed(1)),estimate:roundMoney(estimate),low:roundMoney(low),high:roundMoney(high),p10:roundMoney(p10),p90:roundMoney(p90),confidence,confirmedCount,sourceCount:sources.size,dispersion:Number(dispersion.toFixed(3))};
}

export function riskAssessment(lot={}){
 const damage=canonicalText(lot.damage||lot.primaryDamage||'');
 const title=canonicalText(lot.titleStatus||lot.title||'');
 const fuel=canonicalText(lot.fuelType||lot.fuel||'');
 const reasons=[];
 let valuationMode='vehicle';
 if(/parts only|non repairable|nonrepairable|certificate of destruction|junk title|junk/.test(title)){
  reasons.push('non-rebuildable/parts-only title'); valuationMode='parts';
 }
 if(/flood|water/.test(damage)) reasons.push('flood/water damage');
 if(/fire|burn/.test(damage)) reasons.push('fire/burn damage');
 if(/biohazard|bio hazard|chemical/.test(damage)) reasons.push('biohazard/chemical damage');
 if(/rollover|roll over/.test(damage)) reasons.push('rollover damage');
 if(/battery/.test(damage)&&/electric|bev|ev|hybrid|phev/.test(fuel)) reasons.push('electrified powertrain battery damage');
 const manualReview=reasons.length>0;
 return {manualReview,hardCapBlocked:manualReview,reasons,valuationMode};
}

export function hiddenDamageReserve({repairHigh=0,damage='',repairConfidence='LOW'}={}){
 const high=Math.max(0,Number(repairHigh)||0);if(high<=0)return 0;
 const family=damageFamily(damage);
 let rate=.25;
 if(family==='cosmetic'||family==='hail')rate=.10;
 else if(['front','rear','side'].includes(family))rate=.20;
 else if(['mechanical','undercarriage'].includes(family))rate=.28;
 else if(['flood','fire','rollover'].includes(family))rate=.45;
 if(repairConfidence==='HIGH')rate*=.75;
 else if(repairConfidence==='MED')rate*=.9;
 return roundMoney(high*rate);
}

export function normalizeRepairEstimate({listingEstimate=0,provider=null,manual=null,damage=''}={}){
 if(manual&&safeNumber(manual.base)>0){
  const base=safeNumber(manual.base),low=safeNumber(manual.low)||base*.9,high=safeNumber(manual.high)||base*1.2;
  return {available:true,low:roundMoney(low),base:roundMoney(base),high:roundMoney(high),confidence:'MED',provider:'Manual',hard:true};
 }
 if(provider&&safeNumber(provider.base)>0){
  const base=safeNumber(provider.base),low=safeNumber(provider.low)||base*.9,high=safeNumber(provider.high)||base*1.15;
  return {available:true,low:roundMoney(low),base:roundMoney(base),high:roundMoney(high),confidence:provider.confidence||'MED',provider:provider.provider||'Repair provider',hard:true};
 }
 const listing=safeNumber(listingEstimate);
 if(listing>0){
  return {available:true,low:roundMoney(listing*.9),base:roundMoney(listing),high:roundMoney(listing*1.18),confidence:'LOW',provider:'Auction listed estimate',hard:false,caveat:'Auction repair estimate may omit hidden damage, parts availability and local labor differences.'};
 }
 return {available:false,low:null,base:null,high:null,confidence:'UNKNOWN',provider:null,hard:false,caveat:'No repair estimate is available.'};
}

export function normalizeTransportEstimate({provider=null,manual=null}={}){
 if(manual&&safeNumber(manual.base)>0){
  const base=safeNumber(manual.base),low=safeNumber(manual.low)||base*.9,high=safeNumber(manual.high)||base*1.15;
  return {available:true,low:roundMoney(low),base:roundMoney(base),high:roundMoney(high),confidence:'MED',provider:'Manual',hard:true};
 }
 if(provider&&safeNumber(provider.base)>0){
  const base=safeNumber(provider.base),low=safeNumber(provider.low)||base*.9,high=safeNumber(provider.high)||base*1.15;
  return {available:true,low:roundMoney(low),base:roundMoney(base),high:roundMoney(high),confidence:provider.confidence||'MED',provider:provider.provider||'Transport provider',hard:true};
 }
 return {available:false,low:null,base:null,high:null,confidence:'UNKNOWN',provider:null,hard:false,caveat:'No live transport quote/provider estimate is configured.'};
}

export function fuseMarketValues({marketCheck=null,carsXE=null,acv=0,rebuiltDiscount=null}={}){
 const points=[];
 if(marketCheck&&safeNumber(marketCheck.value)>0)points.push({value:safeNumber(marketCheck.value),weight:1.0,provider:'MarketCheck',low:safeNumber(marketCheck.low)||safeNumber(marketCheck.value)*.9,high:safeNumber(marketCheck.high)||safeNumber(marketCheck.value)*1.1,hard:true});
 if(carsXE&&safeNumber(carsXE.value)>0)points.push({value:safeNumber(carsXE.value),weight:.8,provider:'CarsXE',low:safeNumber(carsXE.low)||safeNumber(carsXE.value)*.88,high:safeNumber(carsXE.high)||safeNumber(carsXE.value)*1.08,hard:true});
 const acvNum=safeNumber(acv);if(acvNum>0)points.push({value:acvNum,weight:.42,provider:'Auction ACV',low:acvNum*.85,high:acvNum*1.05,hard:false});
 if(!points.length)return {available:false,value:null,low:null,high:null,conservative:null,confidence:'UNKNOWN',providers:[],hard:false};
 const value=weightedQuantile(points,.5);const low=weightedQuantile(points.map(p=>({value:p.low,weight:p.weight})),.5);const high=weightedQuantile(points.map(p=>({value:p.high,weight:p.weight})),.5);
 const external=points.filter(p=>p.hard).length;
 const discount=rebuiltDiscount===null||rebuiltDiscount===undefined?null:clamp(Number(rebuiltDiscount)||0,0,.75);
 const adjustedValue=discount===null?value:value*(1-discount);
 const adjustedLow=discount===null?low:low*(1-discount);
 const adjustedHigh=discount===null?high:high*(1-discount);
 return {available:true,value:roundMoney(adjustedValue),low:roundMoney(adjustedLow),high:roundMoney(adjustedHigh),conservative:roundMoney(adjustedLow),confidence:external>=2?'HIGH':external===1?'MED':'LOW',providers:points.map(p=>p.provider),hard:external>=1&&discount!==null,rebuiltDiscount:discount};
}

export function targetProfitFor(resaleConservative, profile={}){
 const resale=Math.max(0,Number(resaleConservative)||0);
 const minProfit=Math.max(0,Number(profile.minProfit)||2000);
 const margin=clamp(Number(profile.targetMargin)||.18,0,.8);
 return Math.max(minProfit,resale*margin);
}

export function solveMaxBid({resaleConservative,feeFunction,fixedConservativeCosts=0,targetProfit=0,bidIncrement=25,maxIterations=64}={}){
 const resale=Number(resaleConservative),fixed=Math.max(0,Number(fixedConservativeCosts)||0),profit=Math.max(0,Number(targetProfit)||0);
 if(!(resale>0)||typeof feeFunction!=='function')return null;
 const feasible=(bid)=>resale-(bid+(Number(feeFunction(bid))||0)+fixed)>=profit;
 if(!feasible(0))return 0;
 let lo=0,hi=resale;
 for(let i=0;i<maxIterations;i++){
  const mid=(lo+hi)/2;if(feasible(mid))lo=mid;else hi=mid;
 }
 const increment=Math.max(1,Number(bidIncrement)||25);
 return Math.max(0,Math.floor(lo/increment)*increment);
}

export function buildIntelligenceSnapshot({lot={},comps=[],marketCheck=null,carsXE=null,transportProvider=null,repairProvider=null,profile={}}={}){
 const source=lot.source||lot.auctionSource||'';
 const titleGroup=classifyTitleGroup(lot.titleStatus||lot.title);
 const risk=riskAssessment(lot);
 const hammer=estimateHammerV2({year:lot.year,make:lot.make,model:lot.model,trim:lot.trim,mileage:lot.mileage,damage:lot.damage,titleStatus:lot.titleStatus,runDrive:lot.runDrive,keys:lot.keys},comps);
 const acquisitionExpected=hammer.estimate||safeNumber(lot.buyNow)||safeNumber(lot.currentBid)||safeNumber(lot.price);
 const acquisitionLow=hammer.low||acquisitionExpected;
 const acquisitionHigh=hammer.high||acquisitionExpected;
 const repair=normalizeRepairEstimate({listingEstimate:lot.repairEstimate,provider:repairProvider,manual:profile.manualRepair,damage:lot.damage});
 const transport=normalizeTransportEstimate({provider:transportProvider,manual:profile.manualTransport});
 const market=fuseMarketValues({marketCheck,carsXE,acv:lot.acv,rebuiltDiscount:profile.rebuiltDiscount});
 const repairReserve=repair.available?hiddenDamageReserve({repairHigh:repair.high,damage:lot.damage,repairConfidence:repair.confidence}):null;
 const taxRateKnown=profile.taxRate!==undefined&&profile.taxRate!==null&&Number.isFinite(Number(profile.taxRate));
 const taxRate=taxRateKnown?clamp(Number(profile.taxRate),0,.2):null;
 const titleRegistration=Math.max(0,Number(profile.titleRegistration)||0);
 const reconditioning=Math.max(0,Number(profile.reconditioning)||0);
 const holding=Math.max(0,Number(profile.holdingCost)||0);
 const feeOptions={titleGroup,bidMode:profile.bidMode||'live',profileConfirmed:profile.copartProfileConfirmed===true,iaaFixedFee:profile.iaaFixedFee,iaaFeePercent:profile.iaaFeePercent};
 const expectedFee=auctionFeeEstimate(source,acquisitionExpected,feeOptions);
 const conservativeFee=auctionFeeEstimate(source,acquisitionHigh,feeOptions);
 const baseRepair=repair.base??0,highRepair=repair.high??0,baseTransport=transport.base??0,highTransport=transport.high??0;
 const taxExpected=taxRateKnown?acquisitionExpected*taxRate:null;
 const knownCostSubtotal=(acquisitionExpected||0)+(expectedFee.total??0)+baseTransport+baseRepair+(repairReserve??0)+(taxExpected??0)+titleRegistration+reconditioning+holding;
 const expectedFinished=(acquisitionExpected>0&&expectedFee.known&&repair.available&&transport.available&&taxRateKnown)?knownCostSubtotal:null;
 const targetProfit=market.available?targetProfitFor(market.conservative,profile):null;
 const transportReserve=Math.max(0,Number(profile.transportReserve)||0);
 const provisionalTransport=transport.available?highTransport:transportReserve;
 const hasProvisionalTransport=transport.available||transportReserve>0;
 const fixedConservative=highTransport+highRepair+(repairReserve??0)+titleRegistration+reconditioning+holding;
 const provisionalFixed=provisionalTransport+highRepair+(repairReserve??0)+titleRegistration+reconditioning+holding;
 const feeFn=(bid)=>{
  const f=auctionFeeEstimate(source,bid,feeOptions).total??0;
  const tax=taxRateKnown?bid*taxRate:0;
  return f+tax;
 };
 const canHardCap=!risk.hardCapBlocked&&taxRateKnown&&market.hard&&repair.hard&&transport.hard&&conservativeFee.known&&conservativeFee.exactProfile;
 const canProvisional=!risk.hardCapBlocked&&taxRateKnown&&market.available&&repair.available&&conservativeFee.known&&hasProvisionalTransport;
 let maxBid=null,provisionalMaxBid=null;
 if(canHardCap){
  maxBid=solveMaxBid({resaleConservative:market.conservative,feeFunction:feeFn,fixedConservativeCosts:fixedConservative,targetProfit,bidIncrement:profile.bidIncrement||25});
 } else if(canProvisional){
  provisionalMaxBid=solveMaxBid({resaleConservative:market.conservative,feeFunction:feeFn,fixedConservativeCosts:provisionalFixed,targetProfit:targetProfit??0,bidIncrement:profile.bidIncrement||25});
 }
 const expectedMargin=market.available&&expectedFinished!==null?roundMoney(market.value-expectedFinished):null;
 const expectedMarginPct=expectedMargin!==null&&market.value>0?Number((expectedMargin/market.value).toFixed(3)):null;
 const decisionCap=maxBid??provisionalMaxBid;
 const bidTarget=(hammer.estimate&&decisionCap!==null)?Math.min(hammer.estimate,decisionCap):null;
 const current=safeNumber(lot.currentBid)||safeNumber(lot.buyNow)||0;
 let decision=risk.manualReview?'MANUAL REVIEW':'INSUFFICIENT DATA';
 if(!risk.manualReview&&decisionCap!==null){
  if(current>decisionCap)decision='PASS';
  else if(safeNumber(lot.buyNow)>0&&safeNumber(lot.buyNow)<=decisionCap)decision='BUY NOW CANDIDATE';
  else if(hammer.high&&hammer.high<=decisionCap)decision='STRONG OPPORTUNITY';
  else if(hammer.estimate&&hammer.estimate>decisionCap)decision='LIKELY OVER CAP';
  else decision='WATCH / BID DISCIPLINED';
 }
 const blockers=[];
 if(!hammer.estimate)blockers.push('historical comps');
 if(!market.available)blockers.push('market value');
 else if(!market.hard)blockers.push('salvage/rebuilt resale calibration');
 if(!repair.available)blockers.push('repair estimate');
 else if(!repair.hard)blockers.push('verified repair estimate');
 if(!transport.available&&!transportReserve)blockers.push('transport');
 if(!taxRateKnown)blockers.push('tax/resale profile');
 if(!conservativeFee.known)blockers.push('auction fee profile');
 else if(!conservativeFee.exactProfile)blockers.push('confirmed fee profile');
 if(risk.manualReview)blockers.push(...risk.reasons.map(x=>`manual review: ${x}`));
 return {
  version:INTELLIGENCE_VERSION,decision,risk,
  hammer,fees:{expected:expectedFee,conservative:conservativeFee},repair,repairReserve,transport,market,
  economics:{
   acquisitionExpected:roundMoney(acquisitionExpected),acquisitionLow:roundMoney(acquisitionLow),acquisitionHigh:roundMoney(acquisitionHigh),
   knownCostSubtotal:roundMoney(knownCostSubtotal),expectedFinished:roundMoney(expectedFinished),expectedMargin,expectedMarginPct,
   targetProfit:roundMoney(targetProfit),bidTarget:roundMoney(bidTarget),maxBid:roundMoney(maxBid),provisionalMaxBid:roundMoney(provisionalMaxBid),hardCap:canHardCap
  },
  profile:{bidMode:feeOptions.bidMode,titleGroup,taxRate,taxRateKnown,targetMargin:Number(profile.targetMargin)||.18,minProfit:Number(profile.minProfit)||2000,rebuiltDiscount:profile.rebuiltDiscount??null},
  blockers:[...new Set(blockers)]
 };
}

