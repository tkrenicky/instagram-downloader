const ALLOWED=['cdninstagram.com','fbcdn.net','instagram.com','scontent'];
function okHost(h){h=(h||'').toLowerCase();return ALLOWED.some(d=>h===d||h.endsWith('.'+d)||h.includes(d))}
export default async function handler(req,res){
  try{
    const raw=String(req.query.url||'');
    const u=new URL(raw);
    if(!/^https?:$/.test(u.protocol)||!okHost(u.hostname))return res.status(400).send('Invalid media URL');
    const r=await fetch(raw,{headers:{'user-agent':'Mozilla/5.0','referer':'https://www.instagram.com/'}});
    if(!r.ok)return res.status(r.status).send('Media fetch failed');
    const ab=await r.arrayBuffer();
    res.setHeader('content-type',r.headers.get('content-type')||'image/jpeg');
    res.setHeader('cache-control','private, max-age=300');
    res.status(200).send(Buffer.from(ab));
  }catch(e){res.status(502).send('Media proxy failed')}
}