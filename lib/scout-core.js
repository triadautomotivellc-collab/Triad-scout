export const ALLOWED_SOURCES = Object.freeze(['copart_us', 'iaai_us', 'govdeals_us']);

const MAKE_ALIASES = Object.freeze({
  ford:'FORD', chevy:'CHEVROLET', chevrolet:'CHEVROLET', gmc:'GMC',
  cadillac:'CADILLAC', buick:'BUICK', pontiac:'PONTIAC', dodge:'DODGE',
  ram:'RAM', chrysler:'CHRYSLER', jeep:'JEEP', lincoln:'LINCOLN',
  mercury:'MERCURY', toyota:'TOYOTA', lexus:'LEXUS', honda:'HONDA',
  acura:'ACURA', nissan:'NISSAN', infiniti:'INFINITI', mazda:'MAZDA',
  subaru:'SUBARU', mitsubishi:'MITSUBISHI', hyundai:'HYUNDAI', kia:'KIA',
  bmw:'BMW', mercedes:'MERCEDES-BENZ', 'mercedes-benz':'MERCEDES-BENZ',
  audi:'AUDI', volkswagen:'VOLKSWAGEN', vw:'VOLKSWAGEN', volvo:'VOLVO',
  tesla:'TESLA', porsche:'PORSCHE', jaguar:'JAGUAR', landrover:'LAND ROVER',
  'land rover':'LAND ROVER', mini:'MINI'
});

const SPECIAL_MODELS = Object.freeze([
  // Ford performance / enthusiast
  { rx:/\btaurus\s+sho\b/i, make:'FORD', model:'Taurus', trims:['SHO'] },
  { rx:/\bexplorer\s+sport\b/i, make:'FORD', model:'Explorer', trims:['Sport'] },
  { rx:/\bexplorer\s+st\b/i, make:'FORD', model:'Explorer', trims:['ST'] },
  { rx:/\bf-?150\s+raptor\b/i, make:'FORD', model:'F-150', trims:['Raptor'] },
  { rx:/\bmustang\s+shelby\s+gt500\b/i, make:'FORD', model:'Mustang', trims:['Shelby GT500'] },
  { rx:/\bmustang\s+shelby\s+gt350\b/i, make:'FORD', model:'Mustang', trims:['Shelby GT350'] },
  { rx:/\bmustang\s+mach\s*1\b/i, make:'FORD', model:'Mustang', trims:['Mach 1'] },
  { rx:/\bmustang\s+gt\b/i, make:'FORD', model:'Mustang', trims:['GT'] },

  // GM performance / common truck models
  { rx:/\bcamaro\s+zl1\b/i, make:'CHEVROLET', model:'Camaro', trims:['ZL1'] },
  { rx:/\bcamaro\s+ss\b/i, make:'CHEVROLET', model:'Camaro', trims:['SS'] },
  { rx:/\bcamaro\s+lt1\b/i, make:'CHEVROLET', model:'Camaro', trims:['LT1'] },
  { rx:/\bcorvette\s+zr1\b/i, make:'CHEVROLET', model:'Corvette', trims:['ZR1'] },
  { rx:/\bcorvette\s+z06\b/i, make:'CHEVROLET', model:'Corvette', trims:['Z06'] },
  { rx:/\bsilverado\s+1500\b/i, make:'CHEVROLET', model:'Silverado 1500', trims:[] },
  { rx:/\bsierra\s+1500\b/i, make:'GMC', model:'Sierra 1500', trims:[] },
  { rx:/\bcts[-\s]?v\b/i, make:'CADILLAC', model:'CTS-V', trims:[] },

  // Mopar / Jeep
  { rx:/\bcharger\s+srt\s+hellcat\b/i, make:'DODGE', model:'Charger', trims:['SRT Hellcat'] },
  { rx:/\bcharger\s+scat\s+pack\b/i, make:'DODGE', model:'Charger', trims:['Scat Pack'] },
  { rx:/\bcharger\s+r\/?t\b/i, make:'DODGE', model:'Charger', trims:['R/T'] },
  { rx:/\bchallenger\s+srt\s+hellcat\b/i, make:'DODGE', model:'Challenger', trims:['SRT Hellcat'] },
  { rx:/\bchallenger\s+scat\s+pack\b/i, make:'DODGE', model:'Challenger', trims:['Scat Pack'] },
  { rx:/\bchallenger\s+r\/?t\b/i, make:'DODGE', model:'Challenger', trims:['R/T'] },
  { rx:/\bdurango\s+srt\s+hellcat\b/i, make:'DODGE', model:'Durango', trims:['SRT Hellcat'] },
  { rx:/\bdurango\s+srt\b/i, make:'DODGE', model:'Durango', trims:['SRT'] },
  { rx:/\bgrand\s+cherokee\s+trackhawk\b/i, make:'JEEP', model:'Grand Cherokee', trims:['Trackhawk'] },
  { rx:/\bgrand\s+cherokee\s+srt\b/i, make:'JEEP', model:'Grand Cherokee', trims:['SRT'] },
  { rx:/\bgrand\s+cherokee\b/i, make:'JEEP', model:'Grand Cherokee', trims:[] },

  // Imports
  { rx:/\bcivic\s+type\s*r\b/i, make:'HONDA', model:'Civic', trims:['Type R'] },
  { rx:/\bcivic\s+si\b/i, make:'HONDA', model:'Civic', trims:['Si'] },
  { rx:/\bwrx\s+sti\b/i, make:'SUBARU', model:'WRX', trims:['STI'] }
]);

const MODEL_MAKE_HINTS = Object.freeze([
  [/\btaurus\b/i,'FORD'], [/\bexplorer\b/i,'FORD'], [/\bf-?150\b/i,'FORD'],
  [/\bf-?250\b/i,'FORD'], [/\bf-?350\b/i,'FORD'], [/\bmustang\b/i,'FORD'],
  [/\bsilverado\b/i,'CHEVROLET'], [/\bsuburban\b/i,'CHEVROLET'], [/\btahoe\b/i,'CHEVROLET'],
  [/\bcorvette\b/i,'CHEVROLET'], [/\bcamaro\b/i,'CHEVROLET'], [/\bsierra\b/i,'GMC'],
  [/\byukon\b/i,'GMC'], [/\bchallenger\b/i,'DODGE'], [/\bcharger\b/i,'DODGE'],
  [/\bdurango\b/i,'DODGE'], [/\bwrangler\b/i,'JEEP'], [/\bgrand\s+cherokee\b/i,'JEEP'],
  [/\bcamry\b/i,'TOYOTA'], [/\bcorolla\b/i,'TOYOTA'], [/\btacoma\b/i,'TOYOTA'],
  [/\btundra\b/i,'TOYOTA'], [/\baccord\b/i,'HONDA'], [/\bcivic\b/i,'HONDA'],
  [/\baltima\b/i,'NISSAN'], [/\bmaxima\b/i,'NISSAN'], [/\bsentra\b/i,'NISSAN']
]);

const GENERIC_WORDS = new Set([
  'car','cars','vehicle','vehicles','salvage','auction','auctions','used','cheap',
  'under','below','within','miles','mile','near','nearby','clean','title','damaged',
  'damage','front','rear','side','hail','flood','burn','run','drive','runs','drives',
  'keys','key','automatic','manual','awd','fwd','rwd','4wd','2wd','with','and','the'
]);

const DAMAGE_TERMS = Object.freeze([
  'front end','front','rear end','rear','side','left side','right side','hail',
  'flood','water','burn','fire','rollover','roll over','undercarriage','mechanical',
  'minor dent','scratches','theft','vandalism'
]);

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function canonicalText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/([a-z])[-\s]+(?=\d)/g, '$1')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function titleCaseWords(s) {
  return canonicalText(s).split(' ').filter(Boolean).map(w => {
    if (/^[a-z]\d+$/.test(w)) return w.toUpperCase();
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

function inferMake(text) {
  const lower = canonicalText(text);
  for (const [alias, canonical] of Object.entries(MAKE_ALIASES)) {
    const a = canonicalText(alias);
    if (new RegExp(`(^| )${escapeRegex(a)}( |$)`).test(lower)) return { make:canonical, alias:a };
  }
  for (const [rx, make] of MODEL_MAKE_HINTS) if (rx.test(text)) return { make, alias:null };
  return { make:null, alias:null };
}

export function parseVehicleQuery(text) {
  const original = String(text ?? '').trim().slice(0, 160);
  if (!original) return {
    raw:'', make:null, model:null, trims:[], years:[], yearMin:null, yearMax:null,
    damage:null, maxPrice:null, radiusMiles:null, filters:{}, requiredTokens:[]
  };

  let special = null;
  for (const s of SPECIAL_MODELS) if (s.rx.test(original)) { special = s; break; }

  const inferred = inferMake(original);
  const make = special?.make ?? inferred.make;
  const years = [...original.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map(m => Number(m[1]));

  const moneyMatch = original.match(/(?:under|below|max(?:imum)?|<)\s*\$?([\d,]+(?:\.\d+)?)/i);
  const maxPrice = moneyMatch ? Number(moneyMatch[1].replace(/,/g,'')) : null;
  const radiusMatch = original.match(/(?:within|under|inside)\s+(\d{1,4})\s*(?:mi|mile|miles)\b/i);
  const radiusMiles = radiusMatch ? Number(radiusMatch[1]) : null;

  const lower = canonicalText(original);
  let damage = null;
  for (const term of DAMAGE_TERMS) if (lower.includes(canonicalText(term))) { damage = term; break; }

  let model = special?.model ?? null;
  const trims = [...(special?.trims ?? [])];

  if (!model) {
    let cleaned = canonicalText(original)
      .replace(/\b(19\d{2}|20\d{2})\b/g,' ')
      .replace(/\bunder\s+\d+(?:\.\d+)?\b/g,' ')
      .replace(/\bwithin\s+\d+\s*(?:mi|mile|miles)\b/g,' ')
      .replace(/\b\d+(?:\.\d+)?\b/g,' ');

    if (inferred.alias) cleaned = cleaned.replace(new RegExp(`(^| )${escapeRegex(inferred.alias)}( |$)`,'g'),' ');
    if (damage) cleaned = cleaned.replace(new RegExp(escapeRegex(canonicalText(damage)),'g'),' ');

    const tokens = cleaned.split(/\s+/).filter(Boolean).filter(t => !GENERIC_WORDS.has(t));
    if (tokens.length) model = titleCaseWords(tokens.join(' '));
  }

  const filters = {};
  if (make) filters.makes = [make];
  if (model) filters.models = [model];
  if (years.length === 1) filters.year_min = filters.year_max = years[0];
  else if (years.length > 1) {
    filters.year_min = Math.min(...years);
    filters.year_max = Math.max(...years);
  }
  if (damage) filters.damage = damage;
  if (maxPrice) filters.price_max = maxPrice;

  const requiredTokens = [];
  if (model) requiredTokens.push(...canonicalText(model).split(' '));
  for (const trim of trims) requiredTokens.push(...canonicalText(trim).split(' '));

  return {
    raw:original, make, model, trims, years,
    yearMin:filters.year_min ?? null, yearMax:filters.year_max ?? null,
    damage, maxPrice, radiusMiles, filters,
    requiredTokens:[...new Set(requiredTokens.filter(Boolean))]
  };
}

export function buildSearchBody({ source, query='', pageSize=20, maxPrice=null }={}) {
  if (!ALLOWED_SOURCES.includes(source)) throw new Error(`Unsupported source: ${source}`);
  const parsed = parseVehicleQuery(query);
  const body = { source, page_size:Math.max(1, Math.min(50, Number(pageSize) || 20)), ...parsed.filters };
  const explicitMax = Number(maxPrice);
  if (Number.isFinite(explicitMax) && explicitMax > 0) body.price_max = explicitMax;
  return { body, parsed };
}

export function lotSearchText(lot) {
  return canonicalText([
    lot?.year, lot?.make, lot?.model, lot?.trim, lot?.name, lot?.title,
    lot?.vehicle?.year, lot?.vehicle?.make, lot?.vehicle?.model, lot?.vehicle?.trim,
    lot?.primary_damage, lot?.secondary_damage, lot?.damage, lot?.damage_description,
    lot?.title_type, lot?.title_status
  ].filter(v => v !== undefined && v !== null).join(' '));
}

export function lotMatchesQuery(lot, parsed) {
  if (!parsed?.raw) return true;
  const haystack = lotSearchText(lot);
  if (parsed.make && !haystack.includes(canonicalText(parsed.make))) return false;
  for (const token of parsed.requiredTokens ?? []) {
    if (!haystack.includes(canonicalText(token))) return false;
  }
  if (parsed.yearMin || parsed.yearMax) {
    const y = Number(lot?.year ?? lot?.vehicle?.year);
    if (Number.isFinite(y)) {
      if (parsed.yearMin && y < parsed.yearMin) return false;
      if (parsed.yearMax && y > parsed.yearMax) return false;
    }
  }
  if (parsed.damage && !haystack.includes(canonicalText(parsed.damage))) return false;
  return true;
}

export function extractLots(payload) {
  if (Array.isArray(payload)) return payload;
  for (const key of ['lots','results','items','records']) if (Array.isArray(payload?.[key])) return payload[key];
  if (Array.isArray(payload?.data)) return payload.data;
  for (const key of ['lots','results','items','records']) if (Array.isArray(payload?.data?.[key])) return payload.data[key];
  return [];
}

export function lotIdentity(lot) {
  const source = canonicalText(lot?.source ?? lot?.auction_source ?? '');
  const lotKey = String(lot?.lot_key ?? lot?.lot_number ?? lot?.lot_id ?? lot?.id ?? '').trim();
  const vin = String(lot?.vin ?? lot?.vehicle?.vin ?? '').trim().toUpperCase();
  if (source && lotKey) return `${source}:${lotKey}`;
  if (vin) return `vin:${vin}`;
  return canonicalText([lot?.year, lot?.make, lot?.model, lot?.yard, lot?.current_bid].join('|'));
}

export function dedupeLots(lots) {
  const seen = new Set();
  const out = [];
  for (const lot of lots ?? []) {
    const id = lotIdentity(lot);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(lot);
  }
  return out;
}

export function numberFrom(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const n = Number(String(value).replace(/[^0-9.-]+/g,''));
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export function scoreAuctionOpportunity(input={}) {
  const acquisition = numberFrom(input.buyNow, input.currentBid, input.price);
  const acv = numberFrom(input.acv, input.preLossValue, input.marketValue);
  const repair = numberFrom(input.repairEstimate, input.repair);
  const basisType = numberFrom(input.buyNow) > 0 ? 'BUY_NOW' : numberFrom(input.currentBid) > 0 ? 'CURRENT_BID' : 'UNKNOWN';

  let economics = 18;
  let condition = 8;
  let utility = 6;
  let confidence = 'LOW';
  const reasons = [];

  if (acv > 0 && acquisition > 0) {
    const cost = acquisition + Math.max(0, repair);
    const ratio = cost / acv;
    if (ratio <= .35) economics = 70;
    else if (ratio <= .45) economics = 64;
    else if (ratio <= .55) economics = 58;
    else if (ratio <= .65) economics = 51;
    else if (ratio <= .75) economics = 43;
    else if (ratio <= .85) economics = 34;
    else if (ratio <= .95) economics = 25;
    else if (ratio <= 1.05) economics = 17;
    else if (ratio <= 1.20) economics = 9;
    else economics = 3;
    reasons.push(`${Math.round(ratio*100)}% of ACV before fees/transport`);
    confidence = repair > 0 ? 'HIGH' : 'MED';
  } else {
    reasons.push('ACV or auction price unavailable');
  }

  const damage = canonicalText(input.damage);
  if (/hail|minor dent|scratch|cosmetic/.test(damage)) condition = 15;
  else if (/rear|side|front/.test(damage)) condition = 10;
  else if (/mechanical|undercarriage/.test(damage)) condition = 6;
  else if (/flood|water|burn|fire|biohazard|rollover|roll over|all over/.test(damage)) condition = 1;

  const title = canonicalText(input.titleStatus);
  if (/clean|clear/.test(title)) utility += 4;
  else if (/parts only|certificate of destruction|non repairable|junk/.test(title)) utility -= 4;

  if (input.runDrive === true) utility += 4;
  else if (input.runDrive === false) utility -= 2;
  if (input.keys === true) utility += 2;
  else if (input.keys === false) utility -= 1;

  let score = Math.round(economics + condition + Math.max(0, Math.min(15, utility)));
  score = Math.max(10, Math.min(100, score));
  if (basisType === 'CURRENT_BID') {
    score = Math.min(score, 89);
    if (confidence === 'HIGH') confidence = 'MED';
    reasons.push('current bid can still rise');
  }
  if (!repair) reasons.push('repair estimate unavailable');

  return {
    score, confidence, basisType,
    acquisition, acv, repair,
    projectBasis:acquisition + repair,
    breakdown:{ economics, condition, utility:Math.max(0, Math.min(15, utility)) },
    reasons
  };
}

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}

function weightedMedian(points) {
  if (!points.length) return null;
  const sorted = [...points].sort((a,b)=>a.value-b.value);
  const total = sorted.reduce((s,p)=>s+p.weight,0);
  let acc = 0;
  for (const p of sorted) {
    acc += p.weight;
    if (acc >= total / 2) return p.value;
  }
  return sorted.at(-1).value;
}

export function estimateHammerFromComparables(target, comps=[]) {
  const targetYear = Number(target?.year);
  const targetMileage = numberFrom(target?.mileage, target?.odometer);
  const targetDamage = canonicalText(target?.damage);
  const targetMake = canonicalText(target?.make);
  const targetModel = canonicalText(target?.model);
  const points = [];

  for (const comp of comps) {
    const value = numberFrom(comp?.finalPrice, comp?.soldPrice, comp?.lastBid, comp?.currentBid, comp?.price);
    if (value <= 0) continue;
    const make = canonicalText(comp?.make);
    const model = canonicalText(comp?.model);
    if (targetMake && make && make !== targetMake) continue;
    if (targetModel && model && !model.includes(targetModel) && !targetModel.includes(model)) continue;

    let weight = 1;
    const year = Number(comp?.year);
    if (Number.isFinite(targetYear) && Number.isFinite(year)) weight *= Math.max(.35, 1 - Math.abs(targetYear-year)*.15);
    const mileage = numberFrom(comp?.mileage, comp?.odometer);
    if (targetMileage > 0 && mileage > 0) {
      const delta = Math.abs(targetMileage-mileage) / Math.max(targetMileage,1);
      weight *= Math.max(.35, 1 - Math.min(1,delta)*.65);
    }
    const damage = canonicalText(comp?.damage);
    if (targetDamage && damage) weight *= (damage.includes(targetDamage) || targetDamage.includes(damage)) ? 1.25 : .75;
    if (comp?.confirmedSold === true) weight *= 1.25;
    if (comp?.confirmedSold === false) weight *= .85;
    points.push({ value, weight });
  }

  if (points.length < 3) return { count:points.length, estimate:null, low:null, high:null, confidence:'LOW' };
  const values = points.map(p=>p.value).sort((a,b)=>a-b);
  const estimate = weightedMedian(points);
  const low = quantile(values,.25);
  const high = quantile(values,.75);
  const confidence = points.length >= 30 ? 'HIGH' : points.length >= 10 ? 'MED' : 'LOW';
  return { count:points.length, estimate:Math.round(estimate), low:Math.round(low), high:Math.round(high), confidence };
}
