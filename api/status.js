export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'POST only'});
  try{
    const {token,runId}=req.body||{};
    if(!token||!runId) return res.status(400).json({error:'Chybí token nebo runId.'});
    const r=await fetch('https://api.apify.com/v2/actor-runs/'+encodeURIComponent(runId)+'?token='+encodeURIComponent(token));
    const t=await r.text();
    if(!r.ok) return res.status(r.status).json({error:t.slice(0,300)});
    const j=JSON.parse(t).data;
    return res.status(200).json({
      id:j.id,status:j.status,statusMessage:j.statusMessage||'',defaultDatasetId:j.defaultDatasetId||null,
      startedAt:j.startedAt||null,finishedAt:j.finishedAt||null
    });
  }catch(e){return res.status(500).json({error:String(e.message||e)})}
}