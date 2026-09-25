function safe(s){return String(s||'item').replace(/[^A-Za-z0-9._-]+/g,'_').slice(0,100)}

function isMediaUrl(u){
  if(typeof u!=='string' || !/^https?:\/\//i.test(u)) return false;
  try{
    const x=new URL(u);
    const h=x.hostname.toLowerCase();
    if(!(h.includes('cdninstagram') || h.includes('fbcdn') || h.startsWith('scontent'))) return false;
    if(/\.mp4(?:\?|$)/i.test(u)) return false;
    return true;
  }catch{return false}
}

function pickImage(obj){
  if(!obj || typeof obj!=='object') return null;

  // Prefer the canonical still image / video thumbnail.
  for(const k of ['displayUrl','display_url','imageUrl','image_url','thumbnailUrl','thumbnail_url']){
    if(isMediaUrl(obj[k])) return obj[k];
  }

  // Apify may expose several resolution variants in images[].
  if(Array.isArray(obj.images)){
    for(const v of obj.images){
      if(isMediaUrl(v)) return v;
      if(v && typeof v==='object'){
        for(const k of ['url','src','imageUrl','displayUrl']){
          if(isMediaUrl(v[k])) return v[k];
        }
      }
    }
  }

  // Other image-candidate shapes.
  const candidates=obj.image_versions2?.candidates || obj.imageVersions2?.candidates;
  if(Array.isArray(candidates)){
    for(const c of candidates){
      if(isMediaUrl(c?.url)) return c.url;
    }
  }

  return null;
}

function add(out,url,path){
  if(!isMediaUrl(url)) return;
  if(out.some(x=>x.url===url)) return;
  out.push({url,path});
}

function feedRowToImages(post,idx,out){
  const base='feed/'+String(idx+1).padStart(5,'0');
  const children =
    (Array.isArray(post.childPosts) && post.childPosts) ||
    (Array.isArray(post.child_posts) && post.child_posts) ||
    [];

  if(children.length){
    let n=0;
    for(const child of children){
      const u=pickImage(child);
      if(!u) continue;
      n++;
      add(out,u,base+'_'+String(n).padStart(2,'0')+'.jpg');
    }
    // If carousel children were present but none contained media, fall back to cover.
    if(n===0){
      const u=pickImage(post);
      if(u) add(out,u,base+'_01.jpg');
    }
    return;
  }

  const u=pickImage(post);
  if(u) add(out,u,base+'_01.jpg');
}

function highlightRowsToImages(rows,out){
  let hi=0;
  for(const h of rows||[]){
    hi++;
    const title=safe(h.title||h.name||('highlight_'+hi));
    let stories=h.stories||h.items||h.media||h.highlightItems||[];
    if(!Array.isArray(stories)) stories=[];

    let si=0;
    for(const s of stories){
      const u=pickImage(s);
      if(!u) continue;
      si++;
      add(out,u,'highlights/'+String(hi).padStart(3,'0')+'_'+title+'/'+String(si).padStart(4,'0')+'.jpg');
    }

    // Some highlight actors output one story per dataset row instead of nested stories.
    if(stories.length===0){
      const u=pickImage(h);
      if(u){
        add(out,u,'highlights/'+String(hi).padStart(3,'0')+'_'+title+'/0001.jpg');
      }
    }
  }
}

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'POST only'});
  try{
    const {token,datasetId,kind='feed'}=req.body||{};
    if(!token||!datasetId) return res.status(400).json({error:'Chybí token nebo datasetId.'});

    const r=await fetch(
      'https://api.apify.com/v2/datasets/'+encodeURIComponent(datasetId)+'/items?clean=true&format=json&token='+encodeURIComponent(token)
    );
    const t=await r.text();
    if(!r.ok) return res.status(r.status).json({error:t.slice(0,300)});

    const rows=JSON.parse(t);
    const out=[];

    if(kind==='feed'){
      (rows||[]).forEach((p,i)=>feedRowToImages(p,i,out));
    }else{
      highlightRowsToImages(rows,out);
    }

    return res.status(200).json({items:out,count:out.length});
  }catch(e){
    return res.status(500).json({error:String(e.message||e)});
  }
}