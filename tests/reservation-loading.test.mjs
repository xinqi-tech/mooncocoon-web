import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../reservation.js',import.meta.url),'utf8');
const activity={available:true,phase:'RESERVING',count:229,unlockedMask:0,
  serverTime:'2026-10-27T10:00:00Z',releaseAt:'2026-11-18T16:00:00Z',claimDeadlineAt:'2026-12-18T16:00:00Z'};
function fixture({oldBrowser=false,failures=0,hang=false,status=503,data=activity}={}){
  const nodes=new Map(),timers=new Map(),calls=[],events=[];let id=0;
  const node=()=>({hidden:false,disabled:false,textContent:'',value:'',checked:false,dataset:{},style:{setProperty(){}},
    classList:{add(){},remove(){}},setAttribute(){},append(){},prepend(){},before(){},replaceChildren(){},
    addEventListener(type,fn){this[type]=fn},querySelector(){return {value:'ANDROID'}},querySelectorAll(){return []},closest(){return node()}});
  const el=key=>{if(!nodes.has(key))nodes.set(key,node());return nodes.get(key)};
  el('reservationForm').elements={platform:{value:'ANDROID'},reminder:node(),code:node(),phone:node()};
  const storage={getItem(){return null},setItem(){},removeItem(){}};
  const document={body:{dataset:{}},documentElement:{classList:{add(){},remove(){}}},
    getElementById:el,querySelector:el,createElement:node,addEventListener(type,fn){this[type]=fn}};
  const context=vm.createContext({document,location:{hostname:'www.lunakoru.com',search:''},navigator:{userAgent:'Mobile'},
    localStorage:storage,sessionStorage:storage,URL,URLSearchParams,AbortController,Intl,
    setTimeout(fn,ms){timers.set(++id,{fn,ms});return id},clearTimeout(k){timers.delete(k)},clearInterval(k){timers.delete(k)},setInterval(){return ++id},
    fetch:async(url,options)=>{
      if(url.endsWith('/api/analytics/events')){events.push(JSON.parse(options.body).events[0]);return {ok:true}}
      calls.push(options);
      if(hang)return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>{const e=new Error('aborted');e.name='AbortError';reject(e)}));
      if(calls.length<=failures)return {ok:false,status};
      return {ok:true,status:200,json:async()=>({result:0,data})};
    }});
  if(oldBrowser)vm.runInContext('Array.prototype.at=undefined',context);
  vm.runInContext(source,context);context.LunaKoruReservation.init(document);
  return {el,calls,events,timers,refresh:()=>document.visibilitychange?.(),
    async flush(){for(let i=0;i<20;i++)await Promise.resolve()},
    async timer(ms){const entry=[...timers].find(([,v])=>v.ms===ms);assert.ok(entry,`missing timer ${ms}`);timers.delete(entry[0]);entry[1].fn();await this.flush()}};
}
test('older mobile browser without Array.at renders the complete reservation panel',async()=>{
  const app=fixture({oldBrowser:true});await app.flush();
  assert.equal(app.el('.reservation-panel').dataset.state,'active');
  assert.equal(app.el('reservationRetry').hidden,true);
  assert.match(app.el('reservationCount').textContent,/229/);
  assert.equal(app.el('reservationNotice').textContent,'');
});


test('temporary 503 retries only public activity, then renders successfully',async()=>{
  const app=fixture({failures:2});await app.flush();
  await app.timer(1000);await app.timer(2000);
  assert.equal(app.calls.length,3);
  assert.ok(app.calls.every(call=>call.method==='GET'&&call.credentials==='omit'));
  assert.equal(app.el('reservationRetry').hidden,true);
  const loaded=app.events.find(event=>event.event_type==='reservation_activity_loaded');
  assert.equal(loaded.properties.retry_count,2);
  assert.equal(app.events.filter(event=>event.event_type==='reservation_activity_load_failed').length,2);
});
test('hung requests abort and stop after three attempts with a usable retry button',async()=>{
  const app=fixture({hang:true});await app.flush();
  await app.timer(12000);await app.timer(1000);
  await app.timer(12000);await app.timer(2000);await app.timer(12000);
  assert.equal(app.calls.length,3);
  assert.equal(app.el('.reservation-panel').dataset.state,'error');
  assert.equal(app.el('reservationRetry').hidden,false);
  assert.equal(app.events.filter(event=>event.properties.error_kind==='timeout').length,3);
});
test('rate limits are reported accurately without immediate automatic retries',async()=>{
  const app=fixture({failures:1,status:429});await app.flush();
  assert.equal(app.calls.length,1);
  assert.equal(app.el('reservationRetry').hidden,false);
  const failure=app.events.find(event=>event.event_type==='reservation_activity_load_failed');
  assert.equal(failure.properties.error_kind,'rate_limited');
  assert.equal(failure.properties.http_status,429);
  assert.equal([...app.timers.values()].some(timer=>timer.ms===1000),false);
});
test('foreground events and retry clicks share an in-flight request',async()=>{
  const app=fixture({hang:true});await app.flush();
  app.refresh();app.refresh();app.el('reservationRetry').click();await app.flush();
  assert.equal(app.calls.length,1);
});
test('render failures do not record success or leave a partially committed activity state',async()=>{
  const app=fixture({data:{...activity,claimDeadlineAt:'invalid-date'}});await app.flush();
  assert.equal(app.el('.reservation-panel').dataset.state,'error');
  assert.equal(app.el('reservationRetry').hidden,false);
  assert.equal(app.events.some(event=>event.event_type==='reservation_activity_loaded'),false);
  const failure=app.events.find(event=>event.event_type==='reservation_activity_load_failed');
  assert.equal(failure.properties.stage,'render');
  assert.equal(failure.properties.error_kind,'render_failed');
  assert.equal('message' in failure.properties,false);
});
