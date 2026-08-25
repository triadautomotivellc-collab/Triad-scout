import { canonicalText, numberFrom } from './scout-core.js';

export const PARTS_ENGINE_VERSION = '0.8.0-alpha';

const PART_ALIASES = Object.freeze([
  {rx:/\b(6l80e?|6l80)\b/i, canonical:'Transmission', tokens:['6L80']},
  {rx:/\b(6l90e?|6l90)\b/i, canonical:'Transmission', tokens:['6L90']},
  {rx:/\b(4l60e?|4l60)\b/i, canonical:'Transmission', tokens:['4L60E']},
  {rx:/\b(10r80)\b/i, canonical:'Transmission', tokens:['10R80']},
  {rx:/\b(transmission|trans|gearbox)\b/i, canonical:'Transmission', tokens:[]},
  {rx:/\b(engine|motor|long block|short block)\b/i, canonical:'Engine', tokens:[]},
  {rx:/\b(turbocharger|turbo)\b/i, canonical:'Turbocharger', tokens:[]},
  {rx:/\b(headlight|headlamp)\b/i, canonical:'Headlamp Assembly', tokens:[]},
  {rx:/\b(taillight|tail light|tail lamp)\b/i, canonical:'Tail Lamp Assembly', tokens:[]},
  {rx:/\b(front door|door assembly|door)\b/i, canonical:'Door Assembly', tokens:[]},
  {rx:/\b(hood|bonnet)\b/i, canonical:'Hood', tokens:[]},
  {rx:/\b(fender)\b/i, canonical:'Fender', tokens:[]},
  {rx:/\b(bumper cover|bumper)\b/i, canonical:'Bumper Assembly', tokens:[]},
  {rx:/\b(radiator support|core support)\b/i, canonical:'Radiator Support', tokens:[]},
  {rx:/\b(radiator)\b/i, canonical:'Radiator', tokens:[]},
  {rx:/\b(condenser|ac condenser|a\/c condenser)\b/i, canonical:'A/C Condenser', tokens:[]},
  {rx:/\b(alternator)\b/i, canonical:'Alternator', tokens:[]},
  {rx:/\b(starter)\b/i, canonical:'Starter', tokens:[]},
  {rx:/\b(transfer case)\b/i, canonical:'Transfer Case', tokens:[]},
  {rx:/\b(rear differential|differential|rear end)\b/i, canonical:'Differential', tokens:[]}
]);

const SIDE_WORDS = Object.freeze({left:'LH',lh:'LH',driver:'LH',right:'RH',rh:'RH',passenger:'RH'});

export function normalizePartName(value=''){
  const text=String(value||'').trim();
  for(const a of PART_ALIASES) if(a.rx.test(text)) return {name:a.canonical,tokens:[...a.tokens]};
  return {name:text.replace(/\s+/g,' ').trim()||'Part',tokens:[]};
}

export function parsePartQuery(text='', vehicleContext={}){
  const raw=String(text||'').trim();
  const normalized=normalizePartName(raw);
  const lower=raw.toLowerCase();
  let side=null;
  for(const [word,code] of Object.entries(SIDE_WORDS)) if(new RegExp(`\\b${word}\\b`,'i').test(lower)){side=code;break}
  const oem=(raw.match(/\b[A-Z0-9]{4,}(?:-[A-Z0-9]{2,})+\b/i)||[])[0]||null;
  const interchange=(raw.match(/\b(?:HOLLANDER|INT|IC)\s*#?\s*([A-Z0-9-]{3,})\b/i)||[])[1]||null;
  return {
    raw,
    partType:normalized.name,
    variantTokens:normalized.tokens,
    side,
    oemPartNumber:oem,
    interchangeNumber:interchange,
    vehicle:{
      year:Number(vehicleContext.year)||null,
      make:String(vehicleContext.make||''),
      model:String(vehicleContext.model||''),
      trim:String(vehicleContext.trim||''),
      engine:String(vehicleContext.engine||''),
      transmission:String(vehicleContext.transmission||''),
      vin:String(vehicleContext.vin||'')
    }
  };
}

export function normalizeInterchangeRecord(row={},source='licensed'){
  const year=Number(row.year||row.model_year)||null;
  const group=String(row.interchange_group||row.interchange_number||row.hollander_number||row.group_id||'').trim();
  const partType=normalizePartName(row.part_type||row.part||row.part_description||'').name;
  return {
    source,
    groupId:group,
    partType,
    year,
    make:String(row.make||'').trim(),
    model:String(row.model||'').trim(),
    trim:String(row.trim||'').trim(),
    engine:String(row.engine||'').trim(),
    transmission:String(row.transmission||'').trim(),
    position:String(row.position||row.side||'').trim(),
    oemPartNumber:String(row.oem_part_number||row.oem||'').trim(),
    qualifier:String(row.qualifier||row.notes||'').trim(),
    confidence:Number(row.confidence)||1
  };
}

function vehicleKey(v={}){
  return canonicalText([v.year,v.make,v.model,v.trim,v.engine,v.transmission].filter(Boolean).join(' '));
}

export function resolveInterchange(query, records=[]){
  const qPart=canonicalText(query.partType);
  const qVehicle=vehicleKey(query.vehicle);
  const qSide=canonicalText(query.side||'');
  const normalized=records.map(r=>normalizeInterchangeRecord(r,r.source||'licensed')).filter(r=>canonicalText(r.partType)===qPart);

  let seed=[];
  if(query.interchangeNumber){
    seed=normalized.filter(r=>canonicalText(r.groupId)===canonicalText(query.interchangeNumber));
  } else if(query.oemPartNumber){
    seed=normalized.filter(r=>canonicalText(r.oemPartNumber)===canonicalText(query.oemPartNumber));
  } else {
    seed=normalized.filter(r=>{
      const v=vehicleKey(r);
      if(!qVehicle) return false;
      const makeOk=!query.vehicle.make||canonicalText(r.make)===canonicalText(query.vehicle.make);
      const modelOk=!query.vehicle.model||canonicalText(r.model)===canonicalText(query.vehicle.model);
      const yearOk=!query.vehicle.year||r.year===Number(query.vehicle.year);
      const sideOk=!qSide||!r.position||canonicalText(r.position).includes(qSide.toLowerCase())||canonicalText(r.position)===qSide;
      return makeOk&&modelOk&&yearOk&&sideOk&&(v.includes(canonicalText(query.vehicle.model))||modelOk);
    });
  }

  const groupIds=[...new Set(seed.map(r=>r.groupId).filter(Boolean))];
  const members=groupIds.length?normalized.filter(r=>groupIds.includes(r.groupId)):seed;
  const compatibleVehicles=[];
  const seen=new Set();
  for(const r of members){
    const k=[r.year,r.make,r.model,r.trim,r.engine,r.transmission,r.position].join('|');
    if(seen.has(k))continue;seen.add(k);
    compatibleVehicles.push({year:r.year,make:r.make,model:r.model,trim:r.trim,engine:r.engine,transmission:r.transmission,position:r.position,qualifier:r.qualifier});
  }
  return {
    resolved:members.length>0,
    partType:query.partType,
    groupIds,
    members,
    compatibleVehicles,
    confidence:members.length?Math.min(1,Math.max(...members.map(r=>Number(r.confidence)||0.8))):0,
    source:[...new Set(members.map(r=>r.source))]
  };
}

export function normalizePartListing(row={}, source='YardLink'){
  const price=numberFrom(row.price,row.us_price,row.amount)||0;
  const shipping=numberFrom(row.shipping,row.shipping_cost)||0;
  const core=numberFrom(row.core,row.core_charge)||0;
  const distance=numberFrom(row.distance_miles,row.distance)||null;
  const grade=String(row.part_grade||row.grade||'').trim().toUpperCase();
  return {
    id:String(row.id||row.stock_number||row.stock||`${source}-${Math.random().toString(36).slice(2)}`),
    source:String(row.source||source),
    yard:String(row.yard_name||row.dealer||row.seller||'Recycler'),
    stock:String(row.stock_number||row.stock||''),
    year:Number(row.year)||null,
    make:String(row.make||''),
    model:String(row.model||''),
    trim:String(row.trim||''),
    engine:String(row.engine||''),
    transmission:String(row.transmission||''),
    partType:normalizePartName(row.part_type||row.part_description||row.part||'').name,
    description:String(row.description||row.part_description||row.part||''),
    position:String(row.position||row.side||''),
    interchangeNumber:String(row.interchange_number||row.hollander_number||'').trim(),
    oemPartNumber:String(row.oem_part_number||row.oem||'').trim(),
    price,shipping,core,distance,grade,
    mileage:numberFrom(row.mileage,row.odometer)||null,
    condition:String(row.condition||''),
    city:String(row.city||''),state:String(row.state||''),zip:String(row.zip||''),
    phone:String(row.phone||''),url:String(row.listing_url||row.url||''),image:String(row.image_url||row.photo||''),
    warranty:String(row.warranty||''),
    raw:row
  };
}

function compatibleVehicleMatch(listing, vehicle){
  const makeOk=!vehicle.make||canonicalText(listing.make)===canonicalText(vehicle.make);
  const modelOk=!vehicle.model||canonicalText(listing.model)===canonicalText(vehicle.model);
  const yearOk=!vehicle.year||Number(listing.year)===Number(vehicle.year);
  return makeOk&&modelOk&&yearOk;
}

export function interchangeMatch(listing, query, interchange={}){
  if(canonicalText(listing.partType)!==canonicalText(query.partType)) return {compatible:false,confidence:0,reason:'wrong part type'};
  if(query.side&&listing.position){
    const q=canonicalText(query.side), p=canonicalText(listing.position);
    if(q&&!p.includes(q.toLowerCase())&&q!==p) return {compatible:false,confidence:0,reason:'wrong side/position'};
  }
  if(query.oemPartNumber&&listing.oemPartNumber&&canonicalText(query.oemPartNumber)===canonicalText(listing.oemPartNumber)) return {compatible:true,confidence:.99,reason:'OEM part number match'};
  if(interchange.groupIds?.length&&listing.interchangeNumber&&interchange.groupIds.some(g=>canonicalText(g)===canonicalText(listing.interchangeNumber))) return {compatible:true,confidence:.98,reason:'licensed interchange group match'};
  if(compatibleVehicleMatch(listing,query.vehicle)) return {compatible:true,confidence:.86,reason:'exact donor vehicle match'};
  for(const v of interchange.compatibleVehicles||[]) if(compatibleVehicleMatch(listing,v)) return {compatible:true,confidence:.92,reason:'interchange donor match'};
  return {compatible:false,confidence:.15,reason:'fitment not verified'};
}

const GRADE_SCORE=Object.freeze({A:1,B:.86,C:.72,NIQ:.55,'':.62});

export function partLandedCost(listing, profile={}){
  const pickupPerMile=Math.max(0,Number(profile.pickupPerMile)||0);
  const pickup=(Number.isFinite(listing.distance)&&listing.distance!==null)?listing.distance*pickupPerMile:0;
  const known=listing.price+listing.shipping+listing.core+pickup;
  const unknownReserve=listing.shipping===0&&profile.reserveUnknownShipping?Math.max(0,Number(profile.unknownShippingReserve)||75):0;
  return {known,unknownReserve,total:known+unknownReserve,pickup};
}

export function rankPartListings(rows=[], query, interchange={}, profile={}){
  const ranked=[];
  for(const raw of rows){
    const listing=raw.partType?raw:normalizePartListing(raw,raw.source||'YardLink');
    const match=interchangeMatch(listing,query,interchange);
    if(!match.compatible)continue;
    const landed=partLandedCost(listing,profile);
    const grade=GRADE_SCORE[listing.grade]??GRADE_SCORE[''];
    const distanceScore=listing.distance===null?0.55:Math.max(.2,1-Math.min(listing.distance,500)/600);
    const costPenalty=Math.min(1,landed.total/Math.max(1,Number(profile.maxPrice)||100000));
    const score=Math.round(100*(.48*match.confidence+.18*grade+.12*distanceScore+.22*(1-costPenalty)));
    ranked.push({...listing,match,landed,rankScore:score});
  }
  return ranked.sort((a,b)=>a.landed.total-b.landed.total||b.match.confidence-a.match.confidence||b.rankScore-a.rankScore);
}

export function cheapestCompatible(rows, query, interchange={}, profile={}){
  return rankPartListings(rows,query,interchange,profile)[0]||null;
}

export function rebuildBasketCost(requiredParts=[], inventory=[], interchangeByPart={}, profile={}){
  const lines=[];
  let total=0, unresolved=0;
  for(const part of requiredParts){
    const query={...part,partType:normalizePartName(part.partType||part.part||'').name};
    const best=cheapestCompatible(inventory,query,interchangeByPart[query.partType]||{},profile);
    if(!best){unresolved++;lines.push({partType:query.partType,resolved:false});continue}
    total+=best.landed.total;lines.push({partType:query.partType,resolved:true,best});
  }
  return {total:Math.round(total),resolved:requiredParts.length-unresolved,unresolved,lines,complete:unresolved===0};
}

export function dedupePartListings(rows=[]){
  const seen=new Set(),out=[];
  for(const row of rows){
    const x=row.partType?row:normalizePartListing(row,row.source||'Source');
    const key=canonicalText([x.source,x.stock,x.interchangeNumber,x.oemPartNumber,x.yard,x.price].join('|'));
    if(seen.has(key))continue;seen.add(key);out.push(x);
  }
  return out;
}
