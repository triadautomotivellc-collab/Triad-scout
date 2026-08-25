import { canonicalText, numberFrom } from '../lib/scout-core.js';
import { buildIntelligenceSnapshot, INTELLIGENCE_VERSION } from '../lib/intelligence-core.js';

const CACHE_TTL_MS = 10 * 60 * 1000;
const archiveCache = globalThis.__triadArchiveCache || new Map();
globalThis.__triadArchiveCache = archiveCache;

function safeNum(...values){
  const n=numberFrom(...values);
  return Number.isFinite(n)?n:0;
}
function first(obj, paths){
  for(const path of paths){
    let v=obj;
    for(const p of path.split('.')){ if(v==null)break; v=v[p]; }
    if(v!==undefined&&v!==null&&String(v).trim()!=='')return v;
  }
  return null;
}
function timeoutSignal(ms){
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(new Error('timeout')),ms);
  return {signal:ctrl.signal,done:()=>clearTimeout(timer)};
}
async function fetchJson(url, options={}, timeoutMs=5500){
  const {signal,done}=timeoutSignal(timeoutMs);
  try{
    const res=await fetch(url,{...options,signal});
    const text=await res.text();
    let data={};
    try{data=text?JSON.parse(text):{}}catch{data={raw:text.slice(0,500)}}
    return {ok:res.ok,status:res.status,data};
  } finally {done()}
}
function extractRows(payload){
  if(Array.isArray(payload))return payload;
  for(const k of ['lots','items','results','records','inventory']) if(Array.isArray(payload?.[k]))return payload[k];
  if(Array.isArray(payload?.data))return payload.data;
  for(const k of ['lots','items','results','records','inventory']) if(Array.isArray(payload?.data?.[k]))return payload.data[k];
  return [];
}
function sourceCode(source=''){
  const s=canonicalText(source);
  if(s.includes('iaa'))return 'iaai_us';
  if(s.includes('copart'))return 'copart_us';
  return null;
}
function boolValue(v){
  if(v===true||v===1)return true;if(v===false||v===0)return false;
  const s=canonicalText(v);
  if(['yes','true','run and drive','runs and drives','present','available'].includes(s))return true;
  if(['no','false','missing','no keys'].includes(s))return false;
  return undefined;
}
function normalizeArchiveComp(row, fallbackSource){
  return {
    source:first(row,['source','auction_source'])||fallbackSource,
    year:safeNum(first(row,['year','model_year','vehicle.year'])),
    make:first(row,['make','vehicle.make'])||'',
    model:first(row,['model','vehicle.model'])||'',
    trim:first(row,['trim','vehicle.trim','series'])||'',
    mileage:safeNum(first(row,['odometer','mileage','miles','vehicle.odometer'])),
    damage:[first(row,['primary_damage','damage.primary','damage','loss_type']),first(row,['secondary_damage','damage.secondary'])].filter(Boolean).join(' / '),
    titleStatus:first(row,['title_type','title_status','title','document_type'])||'',
    runDrive:boolValue(first(row,['run_and_drive','run_drive','runs_drives','condition.run_and_drive'])),
    keys:boolValue(first(row,['keys','has_keys','keys_present','key_status'])),
    finalPrice:safeNum(first(row,['final_price','sold_price','sale_price','hammer_price','final_bid','winning_bid'])),
    lastObservedBid:safeNum(first(row,['last_bid','last_observed_bid','high_bid','current_bid','bid','price'])),
    saleDate:first(row,['sale_date','sold_at','auction_date','date','updated_at'])||null,
    saleStatus:first(row,['sale_status','status','auction_status'])||'',
    sold:boolValue(first(row,['sold','is_sold'])),
    listingUrl:first(row,['listing_url','url'])||''
  };
}
function locallyRelevantComp(comp,lot){
  const make=canonicalText(lot.make), model=canonicalText(lot.model), cMake=canonicalText(comp.make), cModel=canonicalText(comp.model);
  if(make&&cMake&&make!==cMake)return false;
  if(model&&cModel&&!(cModel.includes(model)||model.includes(cModel)))return false;
  const y=Number(lot.year),cy=Number(comp.year);
  if(Number.isFinite(y)&&Number.isFinite(cy)&&Math.abs(y-cy)>5)return false;
  return true;
}
async function fetchArchiveComps(lot,key){
  const source=sourceCode(lot.source);
  if(!source)return {ok:false,status:'unsupported',rows:[],message:'SalvageAlert public archive currently documents IAA/Copart inventory, not this source.'};
  if(!key)return {ok:false,status:'not_configured',rows:[],message:'SALVAGEALERT_KEY is missing.'};
  if(!lot.make||!lot.model)return {ok:false,status:'blocked',rows:[],message:'Make/model required for archive comps.'};
  const cacheKey=[source,canonicalText(lot.make),canonicalText(lot.model),Number(lot.year)||0].join('|');
  const cached=archiveCache.get(cacheKey);
  if(cached&&Date.now()-cached.at<CACHE_TTL_MS)return {...cached.value,cached:true};

  const buildUrl=(relaxed=false)=>{
    const u=new URL('https://salvagealert.com/api/v1/inventory');
    u.searchParams.set('source',source);
    u.searchParams.set('make',String(lot.make));
    u.searchParams.set('model',String(lot.model));
    if(!relaxed&&Number(lot.year)){
      u.searchParams.set('year_min',String(Math.max(1981,Number(lot.year)-4)));
      u.searchParams.set('year_max',String(Number(lot.year)+4));
    }
    return u;
  };
  let r=await fetchJson(buildUrl(false),{headers:{Authorization:`Bearer ${key}`,Accept:'application/json'}},6500);
  let fallback=false;
  if(!r.ok&&[400,404,422].includes(r.status)){
    fallback=true;
    r=await fetchJson(buildUrl(true),{headers:{Authorization:`Bearer ${key}`,Accept:'application/json'}},6500);
  }
  if(!r.ok)return {ok:false,status:r.status,rows:[],fallback,message:first(r.data,['detail','error','message'])||`Archive returned ${r.status}`};
  const raw=extractRows(r.data);
  const rows=raw.map(x=>normalizeArchiveComp(x,source)).filter(x=>locallyRelevantComp(x,lot));
  const value={ok:true,status:200,rows,fallback,rawCount:raw.length,message:rows.length?null:'Archive call succeeded but returned no locally verified comparable rows.'};
  archiveCache.set(cacheKey,{at:Date.now(),value});
  return value;
}

async function decodeNhtsa(lot){
  const vin=String(lot.vin||'').replace(/[^A-HJ-NPR-Z0-9]/gi,'').toUpperCase();
  if(vin.length!==17)return {ok:false,status:'blocked',message:'17-character VIN required.'};
  const year=Number(lot.year)||'';
  const url=`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json${year?`&modelyear=${year}`:''}`;
  const r=await fetchJson(url,{headers:{Accept:'application/json'}},4500);
  const row=Array.isArray(r.data?.Results)?r.data.Results[0]:null;
  if(!r.ok||!row)return {ok:false,status:r.status||'no_data',message:'NHTSA VIN decode unavailable.'};
  return {ok:true,status:200,data:{make:row.Make,model:row.Model,trim:row.Trim||row.Series,bodyClass:row.BodyClass,fuelType:row.FuelTypePrimary,driveType:row.DriveType,engineCylinders:row.EngineCylinders,displacementL:row.DisplacementL}};
}
function marketCheckRange(data){
  const p=data?.recent_comparables?.stats?.price?.percentiles||data?.comparables?.stats?.price?.percentiles||{};
  const value=safeNum(data?.marketcheck_price);
  return {value,low:safeNum(p['25.0'])||0,high:safeNum(p['75.0'])||0};
}
async function fetchMarketCheck(lot,profile){
  const key=process.env.MARKETCHECK_API_KEY;
  if(!key)return {ok:false,status:'not_configured',message:'MARKETCHECK_API_KEY not configured.'};
  const vin=String(lot.vin||'').replace(/[^A-HJ-NPR-Z0-9]/gi,'').toUpperCase();
  const miles=safeNum(lot.mileage);
  const zip=String(profile.destinationZip||'').trim();
  if(vin.length!==17||miles<=0||!/^[0-9]{5}(-[0-9]{4})?$/.test(zip))return {ok:false,status:'blocked',message:'MarketCheck needs VIN, mileage and destination ZIP.'};
  const premium=canonicalText(process.env.MARKETCHECK_TIER)==='premium';
  const path=premium?'marketcheck_price/comparables':'marketcheck_price';
  const u=new URL(`https://api.marketcheck.com/v2/predict/car/us/${path}`);
  u.searchParams.set('api_key',key);u.searchParams.set('vin',vin);u.searchParams.set('miles',String(Math.round(miles)));u.searchParams.set('dealer_type','independent');u.searchParams.set('zip',zip);u.searchParams.set('is_certified','false');
  const r=await fetchJson(u,{headers:{Accept:'application/json'}},5500);
  if(!r.ok)return {ok:false,status:r.status,message:first(r.data,['message','error'])||`MarketCheck returned ${r.status}`};
  const range=marketCheckRange(r.data);
  if(range.value<=0)return {ok:false,status:'no_data',message:'MarketCheck returned no predicted value.'};
  return {ok:true,status:200,data:{provider:'MarketCheck',value:range.value,low:range.low||undefined,high:range.high||undefined,tier:premium?'premium':'base',comparableCount:safeNum(r.data?.recent_comparables?.num_found||r.data?.comparables?.num_found)}};
}
async function fetchCarsXE(lot){
  const key=process.env.CARSXE_API_KEY;
  if(!key)return {ok:false,status:'not_configured',message:'CARSXE_API_KEY not configured.'};
  const vin=String(lot.vin||'').replace(/[^A-HJ-NPR-Z0-9]/gi,'').toUpperCase();
  if(vin.length!==17)return {ok:false,status:'blocked',message:'CarsXE needs a 17-character VIN.'};
  const u=new URL('https://api.carsxe.com/marketvalue');u.searchParams.set('key',key);u.searchParams.set('vin',vin);
  const r=await fetchJson(u,{headers:{Accept:'application/json'}},5500);
  if(!r.ok)return {ok:false,status:r.status,message:first(r.data,['message','error'])||`CarsXE returned ${r.status}`};
  const retail=safeNum(r.data?.retail);
  if(retail<=0)return {ok:false,status:'no_data',message:'CarsXE returned no retail value.'};
  return {ok:true,status:200,data:{provider:'CarsXE',value:retail,auctionLow:safeNum(r.data?.auctionValues?.lowAuctionValue),auctionAverage:safeNum(r.data?.auctionValues?.averageAuctionValue),auctionHigh:safeNum(r.data?.auctionValues?.highAuctionValue)}};
}
function mapBodyType(bodyClass='',lot={}){
  const s=canonicalText(bodyClass||lot.bodyClass||lot.vehicleType||'');
  if(/motorcycle/.test(s))return 'motorcycle';
  if(/pickup/.test(s))return '4_door_pickup';
  if(/sport utility|suv/.test(s))return 'suv';
  if(/van|minivan/.test(s))return 'van';
  if(/coupe|2 door/.test(s))return '2_door_coupe';
  return 'sedan';
}
async function fetchSuperDispatch(lot,profile,nhtsa){
  const key=process.env.SUPERDISPATCH_PRICING_KEY;
  if(!key)return {ok:false,status:'not_configured',message:'SUPERDISPATCH_PRICING_KEY not configured.'};
  const origin=String(lot.yardZip||lot.originZip||'').trim(), destination=String(profile.destinationZip||'').trim();
  if(!/^[0-9]{5}$/.test(origin)||!/^[0-9]{5}$/.test(destination))return {ok:false,status:'blocked',message:'Super Dispatch needs auction-yard ZIP and destination ZIP.'};
  if(origin===destination)return {ok:false,status:'local_move',message:'Origin and destination share a ZIP. Use a manual pickup/local-transport estimate rather than assuming $0 transport.'};
  const payload={pickup:{zip:origin},delivery:{zip:destination},vehicles:[{type:mapBodyType(nhtsa?.bodyClass,lot),make:String(lot.make||''),model:String(lot.model||''),year:String(lot.year||''),is_inoperable:lot.runDrive===false,requires_enclosed_trailer:profile.enclosedTransport===true}]};
  const r=await fetchJson('https://pricing-insights.superdispatch.com/api/v2/recommended-price',{method:'POST',headers:{'X-API-Key':key,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload)},6000);
  if(!r.ok||r.data?.meta?.status==='fail')return {ok:false,status:r.status,message:r.data?.data?.message||`Super Dispatch returned ${r.status}`};
  const d=r.data?.data||{};const price=safeNum(d.price);
  if(price<=0)return {ok:false,status:'no_data',message:'Super Dispatch returned no recommended price.'};
  const c=safeNum(d.confidence);return {ok:true,status:200,data:{provider:'Super Dispatch',base:price,low:safeNum(d.price_range_lower)||price*.9,high:safeNum(d.price_range_upper)||price*1.1,confidence:c>=85?'HIGH':c>=60?'MED':'LOW',providerConfidence:c,distanceMiles:safeNum(d.distance_miles),volume:safeNum(d.volume),recentMoves:Array.isArray(d.recent_moves)?d.recent_moves.slice(0,5):[]}};
}
function providerStatus(result,name){return {name,ok:result.ok===true,status:result.status,message:result.message||null};}

export default async function handler(req,res){
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'Use POST.'});}
  const lot=req.body?.lot||{};const profile=req.body?.profile||{};
  if(!lot.make||!lot.model)return res.status(400).json({ok:false,error:'lot.make and lot.model are required.'});
  const salvageKey=process.env.SALVAGEALERT_KEY;

  const nhtsaPromise=decodeNhtsa(lot).catch(e=>({ok:false,status:'error',message:e.message}));
  const archivePromise=fetchArchiveComps(lot,salvageKey).catch(e=>({ok:false,status:'error',rows:[],message:e.message}));
  const marketPromise=fetchMarketCheck(lot,profile).catch(e=>({ok:false,status:'error',message:e.message}));
  const carsPromise=fetchCarsXE(lot).catch(e=>({ok:false,status:'error',message:e.message}));
  const [nhtsa,archive,marketCheck,carsXE]=await Promise.all([nhtsaPromise,archivePromise,marketPromise,carsPromise]);
  const transport=await fetchSuperDispatch(lot,profile,nhtsa.data||{}).catch(e=>({ok:false,status:'error',message:e.message}));

  const snapshot=buildIntelligenceSnapshot({
    lot:{...lot,fuelType:lot.fuelType||nhtsa.data?.fuelType},
    comps:archive.rows||[],
    marketCheck:marketCheck.ok?marketCheck.data:null,
    carsXE:carsXE.ok?carsXE.data:null,
    transportProvider:transport.ok?transport.data:null,
    repairProvider:null,
    profile
  });
  const providers={
    archive:{...providerStatus(archive,'SalvageAlert Archive'),count:(archive.rows||[]).length,rawCount:archive.rawCount??0,cached:archive.cached===true},
    vin:providerStatus(nhtsa,'NHTSA vPIC'),
    marketCheck:providerStatus(marketCheck,'MarketCheck'),
    carsXE:providerStatus(carsXE,'CarsXE'),
    transport:providerStatus(transport,'Super Dispatch'),
    repair:{name:'RepairSnap',ok:false,status:process.env.REPAIRSNAP_API_KEY?'available_not_auto':'not_configured',message:process.env.REPAIRSNAP_API_KEY?'Photo repair provider is configured but deliberately not auto-billed by Analyze.':'REPAIRSNAP_API_KEY not configured.'}
  };
  return res.status(200).json({
    ok:true,version:INTELLIGENCE_VERSION,snapshot,providers,
    vehicle:nhtsa.ok?nhtsa.data:null,
    compExamples:(archive.rows||[]).slice(0,6).map(x=>({year:x.year,make:x.make,model:x.model,trim:x.trim,damage:x.damage,mileage:x.mileage,finalPrice:x.finalPrice,lastObservedBid:x.lastObservedBid,saleDate:x.saleDate,source:x.source}))
  });
}
