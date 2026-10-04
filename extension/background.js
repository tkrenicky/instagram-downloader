async function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
async function getInstagramTab(username){
  const tabs=await chrome.tabs.query({url:'https://www.instagram.com/*'});
  let tab=tabs.find(t=>t.status==='complete')||tabs[0];
  if(!tab){
    tab=await chrome.tabs.create({url:'https://www.instagram.com/'+encodeURIComponent(username)+'/',active:false});
    for(let i=0;i<20;i++){await sleep(500);const t=await chrome.tabs.get(tab.id);if(t.status==='complete'){tab=t;break;}}
  }
  return tab;
}
chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
  if(msg?.type!=='IG_BRIDGE_COLLECT')return;
  (async()=>{
    try{
      const tab=await getInstagramTab(msg.username);
      const res=await chrome.tabs.sendMessage(tab.id,{type:'IG_COLLECT',username:msg.username,feed:!!msg.feed,highlights:!!msg.highlights,limit:msg.limit||1000});
      sendResponse(res||{ok:false,error:'Instagram nevrátil odpověď.'});
    }catch(e){sendResponse({ok:false,error:e.message||String(e)})}
  })();
  return true;
});