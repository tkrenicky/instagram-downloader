async function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
async function igFetch(path){
  let last;
  for(let i=0;i<4;i++){
    const r=await fetch(path,{credentials:'include',headers:{'X-IG-App-ID':'936619743392459','X-ASBD-ID':'198387','X-Requested-With':'XMLHttpRequest','Accept':'*/*'}});
    if(r.ok)return await r.json();
    last=r.status;
    if(r.status===429||r.status>=500){await sleep(1000*(i+1));continue;}
    throw new Error('Instagram HTTP '+r.status);
  }
  throw new Error('Instagram HTTP '+last);
}
function safe(s){return String(s||'item').replace(/[^A-Za-z0-9._-]+/g,'_').slice(0,100)}
async function getUser(username){
  const d=await igFetch('/api/v1/users/web_profile_info/?username='+encodeURIComponent(username));
  const u=d?.data?.user;if(!u)throw new Error('Profil nebyl nalezen nebo Instagram nevrátil data.');
  return u;
}
async function feedItems(user,limit){
  const out=[];
  const addEdges=edges=>{for(const e of edges||[]){const n=e?.node;if(!n)continue;if(n.__typename==='GraphSidecar'){for(const ce of n.edge_sidecar_to_children?.edges||[]){if(ce?.node?.display_url)out.push({url:ce.node.display_url,path:'feed/'+String(out.length+1).padStart(5,'0')+'.jpg'})}}else if(n.display_url)out.push({url:n.display_url,path:'feed/'+String(out.length+1).padStart(5,'0')+'.jpg'});if(out.length>=limit)return;}};
  const media=user?.edge_owner_to_timeline_media;addEdges(media?.edges);
  let end=media?.page_info?.end_cursor,more=media?.page_info?.has_next_page,guard=0;
  while(more&&end&&out.length<limit&&guard++<100){
    const vars=encodeURIComponent(JSON.stringify({id:user.id,first:50,after:end}));
    const r=await fetch('/graphql/query/?query_hash=003056d32c2554def87228bc3fd9668a&variables='+vars,{credentials:'include'});
    if(!r.ok)break;const j=await r.json();const m=j?.data?.user?.edge_owner_to_timeline_media;if(!m)break;addEdges(m.edges);more=m.page_info?.has_next_page;end=m.page_info?.end_cursor;await sleep(250);
  }
  return out.slice(0,limit);
}
async function highlightItems(user){
  const out=[];
  const tray=await igFetch('/api/v1/highlights/'+user.id+'/highlights_tray/');
  for(const h of tray?.tray||[]){
    const id=h.id||h.pk;if(!id)continue;
    const d=await igFetch('/api/v1/feed/reels_media/?reel_ids='+encodeURIComponent(id));
    const reel=d?.reels?.[id]||d?.reels?.[String(id)]||Object.values(d?.reels||{})[0];
    let n=0;
    for(const it of reel?.items||[]){const c=it?.image_versions2?.candidates?.[0]?.url;if(c)out.push({url:c,path:'highlights/'+safe(h.title||'highlight')+'/'+String(++n).padStart(5,'0')+'.jpg'});}
    await sleep(250);
  }
  return out;
}
async function collect(msg){
  const user=await getUser(msg.username);
  if(user.is_private)throw new Error('Profil je soukromý.');
  let items=[];
  if(msg.feed)items.push(...await feedItems(user,Math.max(1,Math.min(Number(msg.limit)||1000,5000))));
  if(msg.highlights)items.push(...await highlightItems(user));
  const seen=new Set();return items.filter(x=>x.url&&!seen.has(x.url)&&seen.add(x.url));
}
chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
  if(!['IG_COLLECT','IG_DOWNLOAD'].includes(msg?.type))return;
  (async()=>{try{const items=await collect(msg);sendResponse({ok:true,items,count:items.length});}catch(e){sendResponse({ok:false,error:e.message||String(e)})}})();
  return true;
});