const H={
  'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
  'X-IG-App-ID':'936619743392459',
  'X-ASBD-ID':'198387',
  'X-IG-WWW-Claim':'0',
  'X-Requested-With':'XMLHttpRequest',
  'Accept':'*/*'
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function getJson(url,referer){
  let last='';
  for(let i=0;i<3;i++){
    const r=await fetch(url,{headers:{...H,Referer:referer}});
    last=await r.text();
    if(r.ok){try{return JSON.parse(last)}catch{}}
    if(r.status===429||r.status>=500){await sleep(800*(i+1));continue;}
    throw new Error('Instagram HTTP '+r.status+': '+last.slice(0,180));
  }
  throw new Error('Instagram request failed: '+last.slice(0,180));
}
function safe(s){return String(s||'highlight').replace(/[^A-Za-z0-9._-]+/g,'_').slice(0,80)}
function bestImage(it){
  const c=it?.image_versions2?.candidates||it?.image_versions?.candidates||[];
  return c[0]?.url||it?.display_url||it?.thumbnail_url||null;
}
export default async function handler(req,res){
  try{
    const username=String(req.method==='POST'?req.body?.username:req.query?.username||'').replace(/^@/,'').trim();
    if(!username)return res.status(400).json({error:'Chybí username.'});
    const ref='https://www.instagram.com/'+encodeURIComponent(username)+'/';
    const p=await getJson('https://www.instagram.com/api/v1/users/web_profile_info/?username='+encodeURIComponent(username),ref);
    const user=p?.data?.user||p?.user;
    if(!user)return res.status(404).json({error:'Profil nebyl nalezen.'});
    if(user.is_private)return res.status(403).json({error:'Soukromý profil nelze stáhnout.'});
    const uid=String(user.id||'');
    if(!uid)throw new Error('Instagram nevrátil user ID.');
    let highlights=[];
    const edges=user?.edge_highlight_reels?.edges||[];
    for(const e of edges){const n=e?.node||{};if(n.id)highlights.push({id:String(n.id),title:n.title||'highlight'});}
    if(!highlights.length){
      const tray=await getJson('https://www.instagram.com/api/v1/highlights/'+encodeURIComponent(uid)+'/highlights_tray/',ref);
      for(const h of (tray?.tray||tray?.highlight_reels||[])){
        const id=h?.id||h?.pk;
        if(id)highlights.push({id:String(id),title:h?.title||'highlight'});
      }
    }
    const uniq=[];const seenH=new Set();for(const h of highlights){if(!seenH.has(h.id)){seenH.add(h.id);uniq.push(h)}}
    if(!uniq.length)return res.status(200).json({items:[],highlightCount:0,message:'Profil nemá veřejně dostupné Highlights.'});
    const items=[];let idx=0;
    for(const h of uniq){
      let d=null;
      try{d=await getJson('https://i.instagram.com/api/v1/feed/reels_media/?reel_ids='+encodeURIComponent(h.id),ref)}catch(e){
        d=await getJson('https://i.instagram.com/api/v1/feed/reels_media/?reel_ids='+encodeURIComponent('highlight:'+h.id),ref);
      }
      const reels=d?.reels||{};
      const reel=reels[h.id]||reels['highlight:'+h.id]||Object.values(reels)[0]||d?.reel||null;
      const arr=reel?.items||[];
      let j=0;
      for(const it of arr){
        const url=bestImage(it);if(!url)continue;j++;idx++;
        items.push({url,path:'highlights/'+safe(h.title)+'/'+String(j).padStart(4,'0')+'.jpg',highlight:h.title});
      }
      await sleep(120);
    }
    return res.status(200).json({items,highlightCount:uniq.length,total:items.length});
  }catch(e){return res.status(502).json({error:String(e?.message||e)})}
}
