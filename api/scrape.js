function send(res,code,obj){res.status(code).json(obj)}
function safe(s){return String(s||'item').replace(/[^A-Za-z0-9._-]+/g,'_').slice(0,100)}
function isImg(u){return typeof u==='string' && /^https?:\/\//.test(u) && !/\.mp4(\?|$)/i.test(u)}
function add(out,url,path){if(!isImg(url))return;if(!out.some(x=>x.url===url))out.push({url,path})}
function extractPostMedia(post,idx,out){
  const base='feed/'+String(idx+1).padStart(5,'0');
  const preferred=[];
  const walk=(v,key='')=>{
    if(!v)return;
    if(typeof v==='string'){
      if(/url|image|display|thumbnail|thumb/i.test(key) && !/avatar|profile/i.test(key) && isImg(v)) preferred.push(v);
      return;
    }
    if(Array.isArray(v)){for(const x of v)walk(x,key);return}
    if(typeof v==='object'){for(const [k,x] of Object.entries(v))walk(x,k)}
  };
  if(post.childPosts) walk(post.childPosts,'childPosts');
  if(post.images) walk(post.images,'images');
  for(const k of ['displayUrl','imageUrl','image','thumbnailUrl','thumbnail','display_url']) if(post[k]) preferred.push(post[k]);
  if(!preferred.length) walk(post);
  [...new Set(preferred)].forEach((u,j)=>add(out,u,base+'_'+String(j+1).padStart(2,'0')+'.jpg'));
}
async function actor(token,id,input){
  const url='https://api.apify.com/v2/acts/'+id+'/run-sync-get-dataset-items?token='+encodeURIComponent(token);
  const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});
  const t=await r.text();
  if(!r.ok) throw new Error('Apify '+id+' HTTP '+r.status+': '+t.slice(0,220));
  try{return JSON.parse(t)}catch{throw new Error('Apify vrátil neplatná data')}
}
export default async function handler(req,res){
  if(req.method!=='POST')return send(res,405,{error:'POST only'});
  try{
    const {username,token,feed=true,highlights=true,limit=1000}=req.body||{};
    if(!username||!token)return send(res,400,{error:'Chybí username nebo Apify token.'});
    const out=[], warnings=[];
    if(feed){
      try{
        const posts=await actor(token,'apify~instagram-post-scraper',{username:[String(username).replace(/^@/,'')],resultsLimit:Math.max(1,Math.min(Number(limit)||1000,5000)),dataDetailLevel:'basicData'});
        (posts||[]).forEach((p,i)=>extractPostMedia(p,i,out));
      }catch(e){warnings.push('Feed: '+e.message)}
    }
    if(highlights){
      try{
        const hs=await actor(token,'seemuapps~instagram-highlights-scraper',{usernames:[String(username).replace(/^@/,'')],maxHighlightsPerUser:0});
        let hi=0;
        for(const h of hs||[]){
          hi++;
          const title=safe(h.title||('highlight_'+hi));
          let si=0;
          for(const s of h.stories||[]){
            si++;
            const u=s.imageUrl||s.thumbnailUrl||s.displayUrl;
            add(out,u,'highlights/'+String(hi).padStart(3,'0')+'_'+title+'/'+String(si).padStart(4,'0')+'.jpg');
          }
        }
      }catch(e){warnings.push('Highlights: '+e.message)}
    }
    return send(res,200,{items:out,count:out.length,warnings});
  }catch(e){return send(res,500,{error:String(e.message||e)})}
}