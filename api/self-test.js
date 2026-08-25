import { parseVehicleQuery, lotMatchesQuery, scoreAuctionOpportunity } from '../lib/scout-core.js';
export default async function handler(req,res){
 const checks=[];
 function c(name,ok){checks.push({name,ok:Boolean(ok)})}
 const cam=parseVehicleQuery('camaro ss');
 c('Camaro SS resolves base model + trim',cam.make==='CHEVROLET'&&cam.model==='Camaro'&&cam.trims.includes('SS'));
 c('Camaro SS rejects LT',!lotMatchesQuery({make:'CHEVROLET',model:'CAMARO',trim:'LT'},cam));
 c('Camaro SS accepts SS',lotMatchesQuery({make:'CHEVROLET',model:'CAMARO',trim:'SS'},cam));
 const sho=parseVehicleQuery('taurus sho');
 c('Taurus SHO resolver',sho.make==='FORD'&&sho.model==='Taurus'&&sho.trims.includes('SHO'));
 const flood=scoreAuctionOpportunity({buyNow:3000,acv:15000,repairEstimate:1500,damage:'flood'});
 const cosmetic=scoreAuctionOpportunity({buyNow:3000,acv:15000,repairEstimate:1500,damage:'minor dent'});
 c('Damage score penalizes flood',cosmetic.score>flood.score);
 const ok=checks.every(x=>x.ok);
 return res.status(ok?200:500).json({ok,checks,note:'No upstream API credits used.'});
}
