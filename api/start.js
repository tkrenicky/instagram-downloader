async function startActor(token,id,input){
  const r=await fetch('https://api.apify.com/v2/acts/'+id+'/runs?token='+encodeURIComponent(token),{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)
  });
  const t=await r.text();
  if(!r.ok) throw new Error('Apify '+id+' HTTP '+r.status+': '+t.slice(0,300));
  const j=JSON.parse(t);
  return j.data;
}
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'POST only'});
  try{
    const {username,token,feed=true,highlights=true,limit=1000}=req.body||{};
    if(!username||!token) return res.status(400).json({error:'Chybí username nebo Apify token.'});
    const u=String(username).replace(/^@/,'').trim();
    const jobs={};
    if(feed){
      jobs.feed=await startActor(token,'apify~instagram-post-scraper',{
        username:[u],
        resultsLimit:Math.max(1,Math.min(Number(limit)||1000,5000)),
        skipPinnedPosts:false,
        dataDetailLevel:'basicData'
      });
    }
    if(highlights){
      jobs.highlights=await startActor(token,'seemuapps~instagram-highlights-scraper',{
        usernames:[u],
        maxHighlightsPerUser:0
      });
    }
    return res.status(200).json({jobs});
  }catch(e){return res.status(500).json({error:String(e.message||e)})}
}