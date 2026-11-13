/** Controlled page lifecycle regression against the real init logic; all input stays in memory. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {randomBytes,randomInt}=require('node:crypto');
const vm=require('node:vm');
const DICT=require('../redeem/i18n.js');
const source=readFileSync(join(__dirname,'../redeem/redeem.js'),'utf8');
const check=(value,message)=>assert.ok(Boolean(value),message);
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve()};
const sample=()=>({countryCode:'+'+(80+6),phoneNumber:String(13)+String(randomInt(100000000,999999999)),code:randomBytes(6).toString('hex').toUpperCase()});
class Element extends EventTarget{
 constructor(){super();this.value='';this.disabled=false;this.hidden=false;this.textContent='';this.children=[];this.dataset={}}
 focus(){} setAttribute(){} setSelectionRange(){} append(...children){this.children.push(...children)} replaceChildren(){this.children=[]} showModal(){this.open=true} close(){this.open=false}
 click(){if(!this.disabled)this.dispatchEvent(new Event('click'))}
}
function fixture({search='?region=cn',hash=''}={}){
 let timerId=0;const timers=new Map(),requests=[],events=[];
 const ids=['redeemForm','countryCode','phoneNumber','repeatPhone','code','language','submit','confirm','confirmDialog','confirmBody','message','homeLink','formPanel','resultPanel','rewardItems','again','cancel'];
 const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));elements.resultPanel.hidden=true;
 const view=new EventTarget();Object.assign(view,{location:{hostname:'www.lunakoru.com',pathname:'/redeem/',search,hash},navigator:{languages:['zh-CN']},history:{replaceState(_state,_title,address){const url=new URL(address,'https://www.lunakoru.com');view.location.search=url.search;view.location.hash=url.hash}}});
 const doc={defaultView:view,getElementById:id=>elements[id],documentElement:{},querySelectorAll:()=>[],createElement:()=>new Element()};
 const response=(result=0)=>({ok:true,status:200,json:async()=>({result,errorMsg:'',data:{rewardItems:[]}})});
 const fetcher=(url,options)=>{
  if(url.endsWith('/api/analytics/events')){events.push(...JSON.parse(options.body).events);return Promise.resolve(response())}
  let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});requests.push({resolve,reject,signal:options.signal});return promise;
 };
 const sandbox={module:{exports:{}},require:()=>DICT,URL,URLSearchParams,AbortController,console,crypto:{randomUUID:()=>randomBytes(8).toString('hex')},setTimeout(callback){const id=++timerId;timers.set(id,callback);return id},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(source,sandbox,{filename:'redeem.js'});sandbox.module.exports.init(doc,fetcher);
 const fill=input=>{elements.countryCode.value=input.countryCode;elements.phoneNumber.value=input.phoneNumber;elements.repeatPhone.value=input.phoneNumber;elements.code.value=input.code};
 const submit=()=>{elements.redeemForm.dispatchEvent(new Event('submit',{cancelable:true}));elements.confirm.click()};
 const transition=(type,persisted)=>{const event=new Event(type);Object.defineProperty(event,'persisted',{value:persisted});view.dispatchEvent(event)};
 return {elements,view,requests,events,timers,response,fill,submit,transition};
}

test('fragment prefill is normalized and cleared while safe query context remains',()=>{
 const input=sample(),formatted=' '+input.code.slice(0,4).toLowerCase()+' - '+input.code.slice(4)+' ';
 const f=fixture({search:'?region=jp&lang=ja',hash:'#code='+encodeURIComponent(formatted)});
 check(f.elements.code.value===input.code,'fragment normalized');
 check(!new URLSearchParams(f.view.location.hash.slice(1)).has('code'),'fragment consumed');
 check(f.view.location.search==='?region=jp&lang=ja','non-sensitive query preserved');
});
test('query code is no longer a supported prefill source',()=>{
 const input=sample(),f=fixture({search:'?code='+encodeURIComponent(input.code)});
 check(f.elements.code.value==='','query prefill rejected');
});

for(const outcome of ['success','public-error','network-failure','timeout'])test('BFCache restore isolates old '+outcome+' callbacks and finally from new submission',async()=>{
 const f=fixture(),oldInput=sample(),newInput=sample();
 f.fill(oldInput);f.submit();await flush();
 check(f.requests.length===1,'old request started');const oldRequest=f.requests[0],oldTimers=[...f.timers.keys()];
 f.transition('pagehide',true);f.transition('pageshow',true);
 f.fill(newInput);f.submit();await flush();
 check(f.requests.length===2&&f.elements.submit.disabled,'new request owns lock');
 if(outcome==='success')oldRequest.resolve(f.response());
 if(outcome==='public-error')oldRequest.resolve(f.response(260001));
 if(outcome==='network-failure')oldRequest.reject(new Error('synthetic failure'));
 if(outcome==='timeout')for(const id of oldTimers){const callback=f.timers.get(id);if(callback){f.timers.delete(id);callback()}}
 await flush();
 check(!f.elements.formPanel.hidden&&f.elements.resultPanel.hidden,'old callback cannot replace restored form');
 check(f.elements.phoneNumber.value===newInput.phoneNumber&&f.elements.code.value===newInput.code,'new input retained');
 check(f.elements.submit.disabled&&f.elements.confirm.disabled,'old finally cannot unlock new request');
 check(f.elements.message.textContent==='','old error cannot write new form');
 check(!f.events.some(event=>event.event_type==='redeem_web_result'),'old callback cannot emit result event');
 f.requests[1].resolve(f.response());await flush();
 check(!f.elements.resultPanel.hidden&&f.elements.formPanel.hidden,'current response still renders');
 check(f.events.filter(event=>event.event_type==='redeem_web_result').length===1,'only current request emits result');
});
test('pagehide cancels the active request and result telemetry without automatic retry',async()=>{
 const f=fixture();f.fill(sample());f.submit();await flush();const request=f.requests[0];
 f.transition('pagehide',true);await flush();
 check(request.signal.aborted,'active fetch cancelled');
 check(f.timers.size===0,'deadlines cancelled');
 f.transition('pageshow',true);await flush();
 check(f.requests.length===1,'no automatic retry');
 check(!f.elements.submit.disabled&&f.elements.phoneNumber.value==='','restore starts a new empty form');
 check(!f.events.some(event=>event.event_type==='redeem_web_result'),'cancelled request has no result telemetry');
});
