export default async function handler(req,res){
  const username=String(req.query.username||'luciepucka').replace(/^@/,'').trim();
  const H={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36','X-IG-App-ID':'936619743392459','X-ASBD-ID':'198387','X-Requested-With':'XMLHttpRequest','Accept':'*/*'};
  try{
    const p=await fetch('https://www.instagram.com/api/v1/users/web_profile_info/?username='+encodeURIComponent(username),{headers:H});
    const pt=await p.text();
    let pj=null; try{pj=JSON.parse(pt)}catch{}
    const user=pj?.data?.user||pj?.user||null;
    const uid=user?.id||null;
    const edge=user?.edge_highlight_reels?.edges||[];
    const ids=edge.map(e=>e?.node?.id).filter(Boolean);
    const out={profileStatus:p.status,profileText:pt.slice(0,500),uid,highlightIds:ids.slice(0,20)};
    if(uid){
      const t=await fetch('https://www.instagram.com/api/v1/highlights/'+encodeURIComponent(uid)+'/highlights_tray/',{headers:{...H,'Referer':'https://www.instagram.com/'+username+'/'}});
      const tt=await t.text(); out.trayStatus=t.status; out.trayText=tt.slice(0,1500);
    }
    if(ids[0]){
      const r=await fetch('https://i.instagram.com/api/v1/feed/reels_media/?reel_ids='+encodeURIComponent(ids[0]),{headers:{...H,'Referer':'https://www.instagram.com/'+username+'/'}});
      const rt=await r.text(); out.reelStatus=r.status; out.reelText=rt.slice(0,1500);
    }
    res.status(200).json(out);
  }catch(e){res.status(500).json({error:String(e?.message||e)})}
}
