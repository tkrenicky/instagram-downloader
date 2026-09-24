function safe(s){return String(s||'item').replace(/[^A-Za-z0-9._-]+/g,'_').slice(0,100)}
function good(u){return typeof u==='string'&&/^https?:\/\//.test(u)&&!/\.mp4(\?|$)/i.test(u)}
function add(out,url,path){if(good(url)&&!out.some(x=>x.url===url))out.push({url,path})}
function collectUrls(v,key='',arr=[]){
  if(v==null)return arr;
  if(typeof v==='string'){
    if(good(v)&&/image|display|thumb|url|photo/i.test(key)&&!/profile|avatar/i.test(key))arr.push(v);
  } else if(Array.isArray(v)){for(const x of v)collectUrls(x,key,arr)}
  else if(typeof v==='object'){for(const [k,x] of Object.entries(v))collectUrls(x,k,arr)}
  return arr;
}
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'POST only'});
  try{
    const {token,datasetId,kind='feed'}=req.body||{};
    if(!token||!datasetId)return res.status(400).json({error:'Chybí token nebo datasetId.'});
    const r=await fetch('https://api.apify.com/v2/datasets/'+encodeURIComponent(datasetId)+'/items?clean=true&format=json&token='+encodeURIComponent(token));
    const t=await r.text();
    if(!r.ok)return res.status(r.status).json({error:t.slice(0,300)});
    const rows=JSON.parse(t),out=[];
    if(kind==='feed'){
      (rows||[]).forEach((p,i)=>{
        const base='feed/'+String(i+1).padStart(5,'0');
        let urls=[];
        if(Array.isArray(p.childPosts)){
          for(const cp of p.childPosts){
            for(const k of ['displayUrl','imageUrl','thumbnailUrl','url']) if(good(cp?.[k])) urls.push(cp[k]);
          }
        }
        for(const k of ['displayUrl','imageUrl','thumbnailUrl','url']) if(good(p?.[k])) urls.push(p[k]);
        if(!urls.length) urls=collectUrls(p);
        [...new Set(urls)].forEach((u,j)=>add(out,u,base+'_'+String(j+1).padStart(2,'0')+'.jpg'));
      });
    }else{
      let hi=0;
      for(const h of rows||[]){
        hi++;
        const title=safe(h.title||('highlight_'+hi));
        let stories=h.stories||h.items||h.media||[];
        if(!Array.isArray(stories)) stories=[];
        let si=0;
        for(const s of stories){
          si++;
          let u=s.imageUrl||s.thumbnailUrl||s.displayUrl||s.image||s.thumbnail;
          if(!good(u)){
            const found=collectUrls(s);u=found[0];
          }
          add(out,u,'highlights/'+String(hi).padStart(3,'0')+'_'+title+'/'+String(si).padStart(4,'0')+'.jpg');
        }
      }
    }
    return res.status(200).json({items:out,count:out.length});
  }catch(e){return res.status(500).json({error:String(e.message||e)})}
}