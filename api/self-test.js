import {
  buildSearchBody,
  dedupeLots,
  estimateHammerFromComparables,
  lotMatchesQuery,
  parseVehicleQuery,
  scoreAuctionOpportunity
} from '../lib/scout-core.js';

export default async function handler(req,res) {
  const tests = [];
  const run = (name, fn) => {
    try { fn(); tests.push({name,pass:true}); }
    catch (e) { tests.push({name,pass:false,error:e.message}); }
  };
  const assert = (cond,msg='assertion failed') => { if(!cond) throw new Error(msg); };

  run('parse Taurus SHO',()=>{
    const q=parseVehicleQuery('2013 ford taurus sho under $8000');
    assert(q.make==='FORD','make');
    assert(q.model==='Taurus','model');
    assert(q.trims.includes('SHO'),'trim');
    assert(q.yearMin===2013 && q.maxPrice===8000,'year/price');
  });
  run('reject unrelated Camry',()=>{
    const q=parseVehicleQuery('taurus sho');
    assert(!lotMatchesQuery({year:2013,make:'TOYOTA',model:'CAMRY'},q),'Camry leaked');
  });
  run('accept Taurus SHO',()=>{
    const q=parseVehicleQuery('taurus sho');
    assert(lotMatchesQuery({year:2015,make:'FORD',model:'TAURUS',trim:'SHO'},q),'SHO rejected');
  });
  run('dedupe same lot',()=>{
    const out=dedupeLots([{source:'copart_us',lot_number:'1'},{source:'copart_us',lot_number:'1'}]);
    assert(out.length===1,'dedupe');
  });
  run('score caps live bid',()=>{
    const s=scoreAuctionOpportunity({currentBid:2500,acv:15000,repairEstimate:2000,damage:'front',runDrive:true});
    assert(s.score<=89,'live bid cap');
    assert(s.confidence!=='HIGH','confidence');
  });
  run('score punishes flood',()=>{
    const clean=scoreAuctionOpportunity({buyNow:3000,acv:12000,repairEstimate:1000,damage:'minor dent'});
    const flood=scoreAuctionOpportunity({buyNow:3000,acv:12000,repairEstimate:1000,damage:'flood'});
    assert(clean.score>flood.score,'damage risk');
  });
  run('historical comp estimator',()=>{
    const comps=Array.from({length:12},(_,i)=>({make:'FORD',model:'TAURUS',year:2013+i%3,mileage:80000+i*2000,damage:'front',finalPrice:4000+i*100,confirmedSold:true}));
    const e=estimateHammerFromComparables({make:'FORD',model:'TAURUS',year:2014,mileage:95000,damage:'front'},comps);
    assert(e.count===12 && e.estimate>=4000 && e.estimate<=5200,'comp estimate');
    assert(e.low<=e.estimate && e.estimate<=e.high,'range');
  });
  run('search body is bounded',()=>{
    const {body}=buildSearchBody({source:'copart_us',query:'2015 ford taurus sho',pageSize:999});
    assert(body.page_size===50,'page size clamp');
    assert(body.makes[0]==='FORD','make filter');
  });

  const failed=tests.filter(t=>!t.pass);
  return res.status(failed.length?500:200).json({
    ok:failed.length===0,
    build:'major-alpha-v5',
    passed:tests.length-failed.length,
    failed:failed.length,
    tests
  });
}
