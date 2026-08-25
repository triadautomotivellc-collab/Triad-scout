import { parsePartQuery, resolveInterchange, normalizePartListing, rankPartListings, dedupePartListings, PARTS_ENGINE_VERSION } from '../lib/parts-core.js';

function timeoutSignal(ms){
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(new Error('timeout')),ms);
  return {signal:ctrl.signal,done:()=>clearTimeout(timer)};
}

async function postJson(url, key, body, timeoutMs=6500){
  const {signal,done}=timeoutSignal(timeoutMs);
  try{
    const headers={'Content-Type':'application/json','Accept':'application/json'};
    if(key) headers.Authorization=`Bearer ${key}`;
    const res=await fetch(url,{method:'POST',headers,body:JSON.stringify(body),signal});
    const text=await res.text();
    let data={};
    try{data=text?JSON.parse(text):{}}catch{data={raw:text.slice(0,500)}}
    return {ok:res.ok,status:res.status,data};
  } finally {done()}
}

function extractRows(data){
  if(Array.isArray(data))return data;
  for(const key of ['parts','inventory','results','items','rows']) if(Array.isArray(data?.[key]))return data[key];
  if(Array.isArray(data?.data))return data.data;
  for(const key of ['parts','inventory','results','items','rows']) if(Array.isArray(data?.data?.[key]))return data.data[key];
  return [];
}

function connectorConfigs(){
  return [
    {
      id:'hollander',name:'Hollander / EDEN Licensed Connector',
      url:process.env.HOLLANDER_CONNECTOR_URL,key:process.env.HOLLANDER_CONNECTOR_KEY,
      note:'Requires licensed Hollander/EDEN access or a TRIAD adapter service backed by licensed data.'
    },
    {
      id:'carpart',name:'Car-Part Authorized Web Services Connector',
      url:process.env.CARPART_CONNECTOR_URL,key:process.env.CARPART_CONNECTOR_KEY,
      note:'Only enable with Car-Part-authorized Web Services/integration access; never scrape the public search.'
    },
    {
      id:'eden',name:'EDEN Partner Connector',
      url:process.env.EDEN_CONNECTOR_URL,key:process.env.EDEN_CONNECTOR_KEY,
      note:'Enable only with partner/yard credentials that authorize inventory access.'
    }
  ];
}

async function callConnector(config, payload){
  if(!config.url) return {id:config.id,name:config.name,ok:false,status:'not_configured',rows:[],message:config.note};
  try{
    const r=await postJson(config.url,config.key,payload,6500);
    if(!r.ok) return {id:config.id,name:config.name,ok:false,status:r.status,rows:[],message:r.data?.message||r.data?.error||`Connector returned ${r.status}`};
    const rows=extractRows(r.data).map(x=>normalizePartListing(x,config.name));
    return {id:config.id,name:config.name,ok:true,status:200,rows,message:null};
  }catch(err){
    return {id:config.id,name:config.name,ok:false,status:'error',rows:[],message:err.message};
  }
}

export default async function handler(req,res){
  if(req.method!=='POST'){
    res.setHeader('Allow','POST');
    return res.status(405).json({ok:false,error:'Use POST.'});
  }

  const body=req.body||{};
  const queryText=String(body.query||'').trim();
  const vehicle=body.vehicle||{};
  if(!queryText) return res.status(400).json({ok:false,error:'query is required.'});

  const partQuery=parsePartQuery(queryText,vehicle);
  const licensedInterchange=Array.isArray(body.licensed_interchange)?body.licensed_interchange.slice(0,10000):[];

  if(!partQuery.partType){
    return res.status(200).json({
      ok:true,
      version:PARTS_ENGINE_VERSION,
      intent:'vehicle_only',
      query:partQuery,
      interchange:{resolved:false,group_ids:[],compatible_vehicle_count:0,compatible_vehicles:[],sources:[],confidence:0},
      providers:[
        {id:'yardlink',name:'YardLink Direct',ok:false,status:'not_called',count:0,message:'No part type detected; recycler inventory search was not needed.'},
        {id:'licensed_interchange',name:'Licensed Interchange Catalog',ok:false,status:'not_called',count:0,message:'Add a part name to activate interchange lookup.'}
      ],
      parts:[],
      cheapest:null
    });
  }

  const interchange=resolveInterchange(partQuery,licensedInterchange);
  const maxPrice=Math.max(0,Math.min(100000,Number(body.max_price)||100000));
  const profile={
    maxPrice,
    pickupPerMile:Math.max(0,Number(body.pickup_per_mile)||0),
    reserveUnknownShipping:body.reserve_unknown_shipping!==false,
    unknownShippingReserve:Math.max(0,Number(body.unknown_shipping_reserve)||75)
  };

  const localRows=Array.isArray(body.yardlink_inventory)?body.yardlink_inventory.slice(0,2500).map(x=>normalizePartListing(x,x.source||'YardLink')):[];

  const providerPayload={
    version:PARTS_ENGINE_VERSION,
    query:{
      raw:partQuery.raw,part_type:partQuery.partType,side:partQuery.side,
      oem_part_number:partQuery.oemPartNumber,interchange_number:partQuery.interchangeNumber,
      vehicle:partQuery.vehicle
    },
    interchange:{group_ids:interchange.groupIds,compatible_vehicles:interchange.compatibleVehicles.slice(0,250)},
    location:body.location||{},
    max_price:maxPrice
  };

  const external=await Promise.all(connectorConfigs().map(c=>callConnector(c,providerPayload)));
  const allRows=dedupePartListings([...localRows,...external.flatMap(x=>x.rows)]);
  const ranked=rankPartListings(allRows,partQuery,interchange,profile).filter(x=>x.landed.total<=maxPrice);

  const providers=[
    {id:'yardlink',name:'YardLink Direct',ok:localRows.length>0,status:localRows.length?'loaded':'empty',count:localRows.length,message:localRows.length?null:'No direct recycler inventory was supplied in this request.'},
    {id:'licensed_interchange',name:'Licensed Interchange Catalog',ok:interchange.resolved,status:interchange.resolved?'resolved':'no_match',count:interchange.members.length,message:interchange.resolved?null:'No licensed interchange group resolved for this query.'},
    ...external.map(x=>({id:x.id,name:x.name,ok:x.ok,status:x.status,count:x.rows.length,message:x.message}))
  ];

  return res.status(200).json({
    ok:true,version:PARTS_ENGINE_VERSION,
    query:partQuery,
    interchange:{
      resolved:interchange.resolved,group_ids:interchange.groupIds,
      compatible_vehicle_count:interchange.compatibleVehicles.length,
      compatible_vehicles:interchange.compatibleVehicles.slice(0,60),
      sources:interchange.source,
      confidence:interchange.confidence
    },
    providers,
    parts:ranked.slice(0,200),
    cheapest:ranked[0]||null
  });
}
