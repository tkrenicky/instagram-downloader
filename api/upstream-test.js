export default async function handler(req,res){
  const username=String(req.query.username||'luciepucka').replace(/^@/,'').trim();
  const out={username};
  try{
    const u=await fetch('https://api-ig.storiesig.info/api/userInfoByUsername/'+encodeURIComponent(username),{headers:{'user-agent':'Mozilla/5.0','accept':'application/json,*/*'}});
    const ut=await u.text(); out.userStatus=u.status; out.userText=ut.slice(0,1200);
    let uj=null; try{uj=JSON.parse(ut)}catch{}
    const uid=uj?.result?.user?.pk||uj?.result?.user?.id||uj?.user?.pk||uj?.user?.id||null; out.uid=uid;
    if(uid){
      const h=await fetch('https://api-ig.storiesig.info/api/highlights/'+encodeURIComponent(uid),{headers:{'user-agent':'Mozilla/5.0','accept':'application/json,*/*'}});
      const ht=await h.text(); out.highlightsStatus=h.status; out.highlightsText=ht.slice(0,2500);
    }
    return res.status(200).json(out);
  }catch(e){return res.status(500).json({...out,error:String(e?.message||e)})}
}
