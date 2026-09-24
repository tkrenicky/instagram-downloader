const m=document.getElementById('m');
document.getElementById('go').onclick=async()=>{
 const username=document.getElementById('u').value.trim().replace(/^@/,'');
 if(!username){m.textContent='Zadej username.';return}
 m.textContent='Pracuji…';
 const tabs=await chrome.tabs.query({url:'https://www.instagram.com/*'});
 let tab=tabs[0];
 if(!tab){tab=await chrome.tabs.create({url:'https://www.instagram.com/'+username+'/',active:false}); await new Promise(r=>setTimeout(r,2500));}
 try{
   const res=await chrome.tabs.sendMessage(tab.id,{type:'IG_DOWNLOAD',username,feed:document.getElementById('feed').checked,highlights:document.getElementById('hl').checked});
   if(!res?.ok) throw new Error(res?.error||'Neznámá chyba');
   m.textContent='Nalezeno '+res.count+' obrázků. Stahování začalo.';
 }catch(e){m.textContent='Chyba: '+e.message}
};