// Bundle locally. `standalone` implements the same request API using the verified deployment.
export function createPepeChainBridge({standalone,onPause=()=>{},onResume=()=>{},onInit=()=>{}}={}){
 let channel=null,counter=0;const pending=new Map(),embedded=window.parent!==window;
 const send=data=>window.parent.postMessage({protocol:'pepe-game/1',channel,...data},'*');
 function receive(event){if(event.source!==window.parent||event.data?.protocol!=='pepe-game/1')return;const m=event.data;
  if(m.type==='init'&&typeof m.channel==='string'){if(channel&&channel!==m.channel)for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Host session changed.'));}if(channel!==m.channel)pending.clear();const changed=channel!==m.channel;channel=m.channel;if(changed)onInit({preview:m.preview===true});send({type:'ready'});return;}
  if(m.channel!==channel)return;if(m.type==='pause')onPause();if(m.type==='resume')onResume();
  if(m.type==='chain-result'){const p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);if(m.error)p.reject(Error(String(m.error)));else p.resolve(m.result);}
 }
 if(embedded)window.addEventListener('message',receive);
 return {embedded,async request(request){if(!embedded){if(!standalone)throw Error('Standalone wallet adapter is required.');return standalone(request);}if(!channel)throw Error('Waiting for game host.');if(pending.size>=2)throw Error('Finish the current request first.');const id=String(++counter);return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error('Confirmation timed out. Check your wallet before retrying.'));},180000);pending.set(id,{resolve,reject,timer});send({type:'chain',id,request});});},destroy(){window.removeEventListener('message',receive);for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Game closed.'));}pending.clear();}};
}
