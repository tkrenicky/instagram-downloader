function okHost(h){
  h=(h||'').toLowerCase();
  return h.includes('cdninstagram.com') || h.includes('fbcdn.net') || h.startsWith('scontent');
}

export default async function handler(req,res){
  try{
    const raw=String(req.query.url||'');
    const u=new URL(raw);

    if(!/^https?:$/.test(u.protocol) || !okHost(u.hostname)){
      return res.status(400).send('Invalid media URL');
    }

    const r=await fetch(raw,{
      headers:{
        'user-agent':'Mozilla/5.0',
        'referer':'https://www.instagram.com/'
      }
    });

    if(!r.ok) return res.status(r.status).send('Media fetch failed');

    const type=(r.headers.get('content-type')||'').toLowerCase();
    if(!type.startsWith('image/')){
      return res.status(415).send('Not an image');
    }

    const ab=await r.arrayBuffer();
    res.setHeader('content-type',type);
    res.setHeader('cache-control','private, max-age=300');
    return res.status(200).send(Buffer.from(ab));
  }catch(e){
    return res.status(502).send('Media proxy failed');
  }
}