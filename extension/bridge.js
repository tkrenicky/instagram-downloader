window.addEventListener('message',ev=>{
  if(ev.source!==window||ev.data?.source!=='IG_DOWNLOADER_PAGE'||ev.data?.type!=='COLLECT')return;
  const requestId=ev.data.requestId;
  chrome.runtime.sendMessage({type:'IG_BRIDGE_COLLECT',username:ev.data.username,feed:!!ev.data.feed,highlights:!!ev.data.highlights,limit:ev.data.limit||1000},res=>{
    const err=chrome.runtime.lastError;
    window.postMessage({source:'IG_DOWNLOADER_EXTENSION',type:'RESULT',requestId,...(err?{ok:false,error:err.message}:(res||{ok:false,error:'Bez odpovědi'}))},'*');
  });
});
window.postMessage({source:'IG_DOWNLOADER_EXTENSION',type:'READY'},'*');