import {copartBuyerFee, estimateHammerV2, solveMaxBid, riskAssessment, buildIntelligenceSnapshot} from '../lib/intelligence-core.js';
export default async function handler(req,res){
 const checks=[];const c=(name,ok)=>checks.push({name,ok:Boolean(ok)});
 const fee499=copartBuyerFee(499.99,{titleGroup:'clean',bidMode:'live',profileConfirmed:true});
 const fee500=copartBuyerFee(500,{titleGroup:'clean',bidMode:'live',profileConfirmed:true});
 c('Copart $500 fee boundary',fee499.total===303&&fee500.total===338);
 const target={year:2020,make:'FORD',model:'F-150',mileage:60000,damage:'front',titleStatus:'salvage'};
 const comps=Array.from({length:20},(_,i)=>({year:2019+i%3,make:'FORD',model:'F-150',mileage:50000+i*1200,damage:'front',titleStatus:'salvage',finalPrice:5000+(i%5)*100,sold:true,status:'sold',saleDate:'2026-07-01',source:i%2?'IAA':'Copart'}));
 comps.push({...comps[0],finalPrice:90000});
 const h=estimateHammerV2(target,comps);c('Hammer robust to outlier',h.estimate>4500&&h.estimate<7000);
 c('Flood risk gate',riskAssessment({damage:'flood'}).hardCapBlocked===true);
 const cap=solveMaxBid({resaleConservative:15000,feeFunction:b=>b<5000?500:1000,fixedConservativeCosts:5000,targetProfit:2500,bidIncrement:25});
 c('Nonlinear max-bid solver',cap===6500);
 const incomplete=buildIntelligenceSnapshot({lot:{source:'IAA',year:2020,make:'FORD',model:'F-150'}});c('Missing data withholds max bid',incomplete.economics.maxBid===null&&incomplete.economics.provisionalMaxBid===null);
 const ok=checks.every(x=>x.ok);return res.status(ok?200:500).json({ok,version:'0.7.0-alpha',checks,note:'Pure logic only — no external API credits used.'});
}
