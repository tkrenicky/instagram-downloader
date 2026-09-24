async function igFetch(path){
  const r=await fetch(path,{credentials:'include',headers:{'X-IG-App-ID':'936619743392459','X-ASBD-ID':'198387','X-Requested-With':'XMLHttpRequest','Accept':'*/*'}});
  if(!r.ok) throw new Error('Instagram HTTP '+r.status);
  return await r.json();
}
function safe(s){return String(s||'item').replace(/[^A-Za-z0-9._-]+/g,'_').slice(0,100)}
async function downloadUrl(url,filename){
  const a=document.createElement('a');a.href=url;a.download=filename;a.target='_blank';a.rel='noopener';document.body.appendChild(a);a.click();a.remove();
  await new Promise(r=>setTimeout(r,180));
}
async function getUser(username){
  const d=await igFetch('/api/v1/users/web_profile_info/?username='+encodeURIComponent(username));
  const u=d?.data?.user;if(!u)throw new Error('Profil nebyl nalezen nebo Instagram nevrátil data.');
  return u;
}
async function feedItems(user){
  const out=[]; let end=user?.edge_owner_to_timeline_media?.page_info?.end_cursor||null;
  const first=user?.edge_owner_to_timeline_media?.edges||[];
  const addEdges=(edges)=>{for(const e of edges){const n=e.node;if(!n)continue;
    if(n.__typename==='GraphSidecar'){for(const ce of (n.edge_sidecar_to_children?.edges||[])){const c=ce.node;if(c?.display_url)out.push(c.display_url)}}
    else if(n.display_url)out.push(n.display_url)
  }};
  addEdges(first);
  const uid=user.id;
  let more=user?.edge_owner_to_timeline_media?.page_info?.has_next_page;
  let guard=0;
  while(more&&end&&guard++<200){
    const vars=encodeURIComponent(JSON.stringify({id:uid,first:50,after:end}));
    const r=await fetch('/graphql/query/?query_hash=003056d32c2554def87228bc3fd9668a&variables='+vars,{credentials:'include'});
    if(!r.ok)break; const j=await r.json(); const m=j?.data?.user?.edge_owner_to_timeline_media;if(!m)break;
    addEdges(m.edges||[]); more=m.page_info?.has_next_page; end=m.page_info?.end_cursor;
  }
  return out;
}
async function highlightItems(user){
  const out=[];
  const tray=await igFetch('/api/v1/highlights/'+user.id+'/highlights_tray/');
  const reels=tray?.tray||[];
  for(const h of reels){
    const id=h.id||h.pk;if(!id)continue;
    const d=await igFetch('/api/v1/feed/reels_media/?reel_ids='+encodeURIComponent(id));
    const reel=d?.reels?.[id]||d?.reels?.[String(id)]||Object.values(d?.reels||{})[0];
    for(const it of (reel?.items||[])){
      const cands=it?.image_versions2?.candidates||[];
      if(cands[0]?.url)out.push({url:cands[0].url,title:safe(h.title||'highlight')});
    }
  }
  return out;
}
chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
 if(msg?.type!=='IG_DOWNLOAD')return;
 (async()=>{
   try{
     const user=await getUser(msg.username);
     if(user.is_private)throw new Error('Profil je soukromý.');
     let count=0;
     if(msg.feed){
       const items=await feedItems(user);
       for(let i=0;i<items.length;i++){await downloadUrl(items[i],safe(msg.username)+'/feed/'+String(i+1).padStart(5,'0')+'.jpg');count++}
     }
     if(msg.highlights){
       const items=await highlightItems(user);
       for(let i=0;i<items.length;i++){await downloadUrl(items[i].url,safe(msg.username)+'/highlights/'+items[i].title+'/'+String(i+1).padStart(5,'0')+'.jpg');count++}
     }
     sendResponse({ok:true,count});
   }catch(e){sendResponse({ok:false,error:e.message})}
 })(); return true;
});