import { parsePartQuery, resolveInterchange, normalizePartListing, cheapestCompatible, PARTS_ENGINE_VERSION } from '../lib/parts-core.js';

export default async function handler(_req,res){
  const vehicle={year:2009,make:'Chevrolet',model:'Silverado 1500',engine:'5.3L'};
  const q=parsePartQuery('6l80 transmission',vehicle);
  const interchange=resolveInterchange(q,[
    {interchange_group:'G1',part_type:'Transmission',year:2009,make:'Chevrolet',model:'Silverado 1500'},
    {interchange_group:'G1',part_type:'Transmission',year:2010,make:'Chevrolet',model:'Tahoe'}
  ]);
  const best=cheapestCompatible([
    normalizePartListing({stock_number:'A',part_description:'Transmission',year:2010,make:'Chevrolet',model:'Tahoe',interchange_number:'G1',price:800,shipping:100},'SelfTest')
  ],q,interchange,{maxPrice:100000});
  const tests=[
    {name:'6L80 alias',ok:q.partType==='Transmission'},
    {name:'interchange group resolution',ok:interchange.resolved&&interchange.groupIds[0]==='G1'},
    {name:'cross-year donor expansion',ok:interchange.compatibleVehicles.some(v=>v.year===2010&&v.model==='Tahoe')},
    {name:'landed-cost ranking',ok:best?.landed?.total===900},
    {name:'licensed group match',ok:best?.match?.confidence>=.98}
  ];
  const passed=tests.filter(x=>x.ok).length;
  return res.status(passed===tests.length?200:500).json({ok:passed===tests.length,version:PARTS_ENGINE_VERSION,passed,total:tests.length,tests});
}
