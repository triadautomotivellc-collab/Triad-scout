import { auctionFeeEstimate, classifyTitleGroup } from '../lib/intelligence-core.js';

export default async function handler(req,res){
  if(req.method!=='POST'){
    res.setHeader('Allow','POST');
    return res.status(405).json({ok:false,error:'Use POST.'});
  }
  const source=String(req.body?.source||'');
  const bid=Math.max(0,Number(req.body?.bid)||0);
  if(!source||bid<=0) return res.status(400).json({ok:false,error:'source and positive bid are required.'});
  const profile=req.body?.profile||{};
  const titleGroup=classifyTitleGroup(req.body?.titleStatus||'');
  const fee=auctionFeeEstimate(source,bid,{
    titleGroup,
    bidMode:profile.bidMode||'live',
    profileConfirmed:profile.copartProfileConfirmed===true,
    iaaFixedFee:Number(profile.iaaFixedFee)||0,
    iaaFeePercent:Number(profile.iaaFeePercent)||0
  });
  return res.status(200).json({ok:true,fee});
}
