/** Real Chromium + WebKit mock-only regression. Sensitive inputs are generated in memory; failures suppress browser call logs. */
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {randomBytes,randomInt}=require('node:crypto');
const {chromium,webkit,devices}=require('playwright');
const root=join(__dirname,'..'),api=require('../redeem/redeem.js');
const check=(value,message)=>assert.ok(Boolean(value),message);
const sample=()=>({countryCode:'+'+(80+6),phoneNumber:String(13)+String(randomInt(100000000,999999999)),code:randomBytes(6).toString('hex').toUpperCase()});
let browsers=[];
before(async()=>{browsers=[await chromium.launch({headless:true}),await webkit.launch({headless:true})]});
after(async()=>{await Promise.all(browsers.map(browser=>browser.close()))});
async function safely(action){try{await action()}catch(error){if(error instanceof assert.AssertionError&&error.operator==='==')throw error;assert.fail('Browser scenario failed; sensitive browser call details suppressed')}}
async function fixture(t,browser,{prefill=false,timeoutMs=12000,mobile=false,region,locale='zh-CN',languages,search,controlledRequests=false}={}){
 const context=await browser.newContext(mobile?{...devices['iPhone 13']}:{viewport:{width:1280,height:900},locale});t.after(()=>context.close());context.setDefaultTimeout(5000);
 if(languages)await context.addInitScript(values=>Object.defineProperty(navigator,'languages',{get:()=>values}),languages);
 if(controlledRequests)await context.addInitScript(timeout=>{
  const nativeFetch=window.fetch.bind(window),nativeTimeout=window.setTimeout.bind(window),nativeClear=window.clearTimeout.bind(window);let timer=-1;
  window.__redeemRequests=[];window.__redeemTimers=new Map();
  window.setTimeout=(callback,delay,...args)=>{if(delay!==timeout)return nativeTimeout(callback,delay,...args);const id=timer--;window.__redeemTimers.set(id,()=>callback(...args));return id};
  window.clearTimeout=id=>{if(id<0)window.__redeemTimers.delete(id);else nativeClear(id)};
  window.fetch=(url,options)=>String(url).endsWith('/api/redeem-code/web-redeem')?new Promise((resolve,reject)=>window.__redeemRequests.push({resolve,reject,signal:options.signal,timers:[...window.__redeemTimers.keys()]})):nativeFetch(url,options);
 },timeoutMs);
 const page=await context.newPage(),input=sample();
 const state={calls:0,events:[],delay:0,result:0,network:false,reward:{rewardType:'ITEM',skuId:'test_reward',name:'Gift',count:2,iconUrl:''},responseBodies:[],documentUrls:[]};
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(request.isNavigationRequest()&&request.resourceType()==='document')state.documentUrls.push(request.url());
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'https://www.lunakoru.com','Access-Control-Allow-Headers':'content-type,accept-language,x-app-market','Access-Control-Allow-Methods':'POST,OPTIONS'}});
  const respond=envelope=>route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'https://www.lunakoru.com'},body:JSON.stringify(envelope)});
  if(url.pathname==='/api/analytics/events'){state.events.push(...request.postDataJSON().events);return respond({result:0,errorMsg:'',data:null})}
  if(url.pathname==='/api/redeem-code/web-redeem'){
   state.calls++;const payload=request.postDataJSON();
   state.requestMatches=payload.countryCode===input.countryCode&&payload.phoneNumber===input.phoneNumber&&payload.code===input.code;
   state.credentialsOmitted=!request.headers().cookie&&!request.headers().authorization;
   if(state.delay)await new Promise(resolve=>setTimeout(resolve,state.delay));
   if(state.network)return route.abort('failed').catch(()=>{});
   const envelope={result:state.result,errorMsg:'',data:{rewardItems:[state.reward]},nickname:'PRIVATE_ACCOUNT_SIGNAL',uid:987654321};
   state.responseBodies.push(JSON.stringify(envelope));return respond(envelope).catch(()=>{});
  }
  const files={'/redeem/':'redeem/index.html','/redeem/index.html':'redeem/index.html','/redeem/redeem.js':'redeem/redeem.js','/redeem/i18n.js':'redeem/i18n.js','/redeem/redeem.css':'redeem/redeem.css','/images/app-logo.jpg':'images/app-logo.jpg'};
  const file=files[url.pathname];if(!file)return route.abort();
  let data=readFileSync(join(root,file));
  if(file.endsWith('redeem.js'))data=data.toString().replace('const DEFAULT_REQUEST_TIMEOUT_MS=12000;','const DEFAULT_REQUEST_TIMEOUT_MS='+timeoutMs+';');
  const contentType=file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'image/jpeg';
  return route.fulfill({contentType,body:data});
 });
 let query=search===undefined?(region?'?region='+region+'&lang=zh':'?lang=zh'):search;if(prefill)query+='#code='+encodeURIComponent(' '+input.code.slice(0,4).toLowerCase()+' - '+input.code.slice(4)+' ');
 await page.goto('https://www.lunakoru.com/redeem/'+query);await page.locator('#submit').waitFor({state:'visible'});
 await page.waitForFunction(()=>!document.getElementById('submit').disabled);
 const fill=async({mismatch=false}={})=>{
  await page.locator('#countryCode').fill(input.countryCode);await page.locator('#phoneNumber').fill(input.phoneNumber);await page.locator('#repeatPhone').fill(mismatch?input.phoneNumber.slice(0,-1):input.phoneNumber);await page.locator('#code').fill(input.code);
 };
 const submit=async()=>{await page.locator('#submit').click();await page.locator('#confirm').click()};
 return {page,context,input,state,fill,submit};
}
for(let engineIndex=0;engineIndex<2;engineIndex++){
 const engine=engineIndex===0?'Chromium':'WebKit';
 test(engine+': prefill, mismatch, masked confirmation, duplicate lock, safe result and telemetry',()=>safely(async()=>{
  const t={after:fn=>cleanups.push(fn)},cleanups=[];try{
   const f=await fixture(t,browsers[engineIndex],{prefill:true});const {page,input,state}=f;
   check(await page.locator('#code').inputValue()===input.code,'normalized prefill');
   check(state.documentUrls.length===1&&!new URL(state.documentUrls[0]).searchParams.has('code')&&!state.documentUrls[0].includes(input.code)&&new URL(state.documentUrls[0]).hash==='','first document request never contains the code');
   check(!page.url().includes(input.code)&&!new URLSearchParams(new URL(page.url()).hash.slice(1)).has('code'),'fragment prefill removed from URL');
   await f.fill({mismatch:true});await page.locator('#submit').click();check(await page.locator('#message').textContent()===api.DICT.zh.phoneMismatch&&state.calls===0,'mismatch makes no request');
   await f.fill();await page.locator('#submit').click();
   const confirmation=await page.locator('#confirmBody').textContent();
   check(confirmation.includes(api.maskPhone(input.phoneNumber))&&!confirmation.includes(input.phoneNumber)&&state.calls===0,'local masked confirmation');
   await page.locator('#cancel').click();check(state.calls===0,'cancel makes no request');
   state.delay=180;await page.locator('#submit').click();await page.locator('#confirm').click();
   check(await page.locator('#submit').isDisabled(),'inflight lock');
   await page.evaluate(()=>{document.getElementById('confirm').click();document.getElementById('redeemForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))});
   await page.locator('#resultPanel').waitFor({state:'visible'});
   check(state.calls===1&&state.requestMatches&&state.credentialsOmitted,'single anonymous contract request');
   const result=await page.locator('#resultPanel').textContent();check(result.includes(api.DICT.zh.submittedBody)&&result.includes('Gift')&&!result.includes('PRIVATE_ACCOUNT_SIGNAL')&&!result.includes('987654321'),'private unified result');
   check(await page.locator('#phoneNumber').inputValue()===''&&await page.locator('#repeatPhone').inputValue()===''&&await page.locator('#code').inputValue()==='','clear inputs after submission');
   await page.waitForFunction(()=>document.getElementById('resultPanel').hidden===false);await page.waitForTimeout(30);
   const telemetry=JSON.stringify(state.events);check(!telemetry.includes(input.phoneNumber)&&!telemetry.includes(input.code),'no sensitive telemetry');
   check(state.events.some(event=>event.event_type==='redeem_web_submitted')&&state.events.some(event=>event.event_type==='redeem_web_result'&&event.properties.result==='submitted'),'required event names');
   check((await contextStorage(f.context)).empty,'no storage persistence');
   await page.locator('#again').click();await f.fill();await page.reload();check(await page.locator('#phoneNumber').inputValue()===''&&await page.locator('#repeatPhone').inputValue()==='','refresh clears phones');
  }finally{await Promise.all(cleanups.map(fn=>fn()))}
 }));
 test(engine+': invalid mainland phones cannot open confirmation or request redemption',()=>safely(async()=>{
  const cleanups=[],t={after:fn=>cleanups.push(fn)};try{
   const f=await fixture(t,browsers[engineIndex]);await f.fill();
   const invalid=String(12)+f.input.phoneNumber.slice(2);
   for(const [first,second] of [[invalid,invalid],[f.input.phoneNumber,invalid],[invalid,f.input.phoneNumber]]){
    await f.page.locator('#phoneNumber').fill(first);await f.page.locator('#repeatPhone').fill(second);await f.page.locator('#submit').click();
    check(!(await f.page.locator('#confirmDialog').isVisible())&&f.state.calls===0,'invalid or mismatched input blocks confirmation and API');
   }
   await f.fill();await f.page.locator('#submit').click();check(await f.page.locator('#confirmDialog').isVisible()&&f.state.calls===0,'valid corrected input allows local confirmation');
  }finally{await Promise.all(cleanups.map(fn=>fn()))}
 }));
 test(engine+': browser locale defaults and explicit region precedence render in the real form',()=>safely(async()=>{
  for(const [locale,search,country,language] of [['en-SG','', '+65','en'],['en-US','', '+1','en'],['ja-JP','', '+81','ja'],['zh-CN','', '+86','zh'],['ko-KR','', '+86','ko'],['zh-TW','', '+86','zh-TW'],['fr-FR','', '+86','zh'],['en-SG','?lang=ja','+65','ja'],['en-SG','?region=jp&lang=ko','+81','ko'],['ja-JP','?region=cn','+86','zh']]){
   const cleanups=[],t={after:fn=>cleanups.push(fn)};try{
    const f=await fixture(t,browsers[engineIndex],{locale,search});
    check(await f.page.locator('#countryCode').inputValue()===country&&await f.page.locator('#language').inputValue()===language,'locale and explicit region set expected form defaults');
    check(f.state.calls===0&&await f.page.locator('#phoneNumber').inputValue()===''&&await f.page.locator('#repeatPhone').inputValue()==='','default selection has no redemption request or phone input');
   }finally{await Promise.all(cleanups.map(fn=>fn()))}
  }
 }));
 test(engine+': international validation, prefixed numbers and fullwidth code reach only the local mock',()=>safely(async()=>{
  const digits=count=>Array.from({length:count},()=>randomInt(0,10)).join('');
  for(const [countryCode,phone] of [['+81','90'+digits(8)],['+65','8'+digits(7)],['+1','2'+digits(2)+'2'+digits(6)]]){
   const cleanups=[],t={after:fn=>cleanups.push(fn)};try{
    const f=await fixture(t,browsers[engineIndex]);Object.assign(f.input,{countryCode,phoneNumber:phone});await f.fill();
    await f.page.locator('#phoneNumber').fill(phone.slice(0,6));await f.page.locator('#repeatPhone').fill(phone.slice(0,6));
    await f.page.locator('#submit').click();
    check(await f.page.locator('#message').textContent()===api.DICT.zh.phoneInvalid&&!(await f.page.locator('#confirmDialog').isVisible())&&f.state.calls===0,'invalid international number blocked locally');
    await f.page.locator('#phoneNumber').fill(countryCode+' ('+phone.slice(0,3)+') '+phone.slice(3));
    await f.page.locator('#repeatPhone').fill(phone);
    const wide=[...f.input.code.toLowerCase()].map(char=>String.fromCharCode(char.charCodeAt(0)+0xfee0)).join('');
    await f.page.locator('#code').fill(wide.slice(0,4)+'－'+wide.slice(4));
    check(await f.page.locator('#code').inputValue()===f.input.code,'input event normalizes fullwidth code');
    await f.page.locator('#submit').click();
    const confirmation=await f.page.locator('#confirmBody').textContent();
    check(confirmation.includes(countryCode+' '+api.maskPhone(phone))&&!confirmation.includes(phone)&&f.state.calls===0,'normalized national number masked before request');
    await f.page.locator('#confirm').click();await f.page.locator('#resultPanel').waitFor({state:'visible'});
    check(f.state.calls===1&&f.state.requestMatches,'canonical local mock payload only after confirmation');
    check(await f.page.locator('#message').getAttribute('role')==='alert'&&await f.page.locator('#message').getAttribute('aria-live')===null,'single implicit alert announcement');
   }finally{await Promise.all(cleanups.map(fn=>fn()))}
  }
 }));
 test(engine+': secondary display language fallback leaves the first-locale dialing choice intact',()=>safely(async()=>{
  for(const [languages,search,country,language] of [[['fr-FR','en-SG'],'','+86','en'],[['de-DE','ja-JP'],'','+86','ja'],[['fr-FR','zh-Hant-TW'],'','+86','zh-TW'],[['en-GB','ko-KR'],'','+1','en'],[['fr-FR','ko-KR'],'?region=jp','+81','ja']]){
   const cleanups=[],t={after:fn=>cleanups.push(fn)};try{
    const f=await fixture(t,browsers[engineIndex],{languages,search});
    check(await f.page.locator('#countryCode').inputValue()===country&&await f.page.locator('#language').inputValue()===language,'browser preference fallback reflected in the form');
    check(f.state.calls===0,'default selection makes no API write');
   }finally{await Promise.all(cleanups.map(fn=>fn()))}
  }
 }));
 test(engine+': four account states have identical response and page content',()=>safely(async()=>{
  let previousPage,previousBody;
  for(const _accountState of ['registered','unregistered','already','ineligible']){
   const cleanups=[],t={after:fn=>cleanups.push(fn)};try{
    const f=await fixture(t,browsers[engineIndex]);await f.fill();await f.submit();await f.page.locator('#resultPanel').waitFor({state:'visible'});
    const pageContent=await f.page.locator('#resultPanel').innerHTML(),body=f.state.responseBodies[0];
    if(previousPage)check(pageContent===previousPage&&body===previousBody,'indistinguishable account states');previousPage=pageContent;previousBody=body;
   }finally{await Promise.all(cleanups.map(fn=>fn()))}
  }
 }));
 test(engine+': public errors and unexpected account errors use local copy; network and timeout recover',()=>safely(async()=>{
  const cleanups=[],t={after:fn=>cleanups.push(fn)};try{
   const f=await fixture(t,browsers[engineIndex],{timeoutMs:50});
   for(const result of [260003,260004,260005,260007,260009,260010,260011,260012]){
    f.state.result=result;await f.fill();await f.submit();await f.page.waitForFunction(()=>!document.getElementById('submit').disabled);
    check(await f.page.locator('#message').textContent()===api.DICT.zh[api.resultKind(result)],'public error copy');
   }
   f.state.network=true;await f.submit();await f.page.waitForFunction(()=>!document.getElementById('submit').disabled);check(await f.page.locator('#message').textContent()===api.DICT.zh.SERVICE_BUSY,'network copy');
   f.state.network=false;f.state.delay=160;await f.submit();await f.page.waitForFunction(()=>!document.getElementById('submit').disabled);check(await f.page.locator('#message').textContent()===api.DICT.zh.SERVICE_BUSY,'timeout recovery');
   f.state.delay=0;f.state.result=260006;await f.submit();await f.page.locator('#resultPanel').waitFor({state:'visible'});check((await f.page.locator('#resultPanel').textContent()).includes(api.DICT.zh.submittedBody),'unexpected account error merged');
  }finally{await Promise.all(cleanups.map(fn=>fn()))}
 }));
 test(engine+': restored page rejects stale success, error, timeout and finally callbacks',()=>safely(async()=>{
  for(const outcome of ['success','public-error','network-failure','timeout']){
   const cleanups=[],t={after:fn=>cleanups.push(fn)};try{
    const f=await fixture(t,browsers[engineIndex],{controlledRequests:true,timeoutMs:2000});
    await f.fill();await f.submit();await f.page.waitForFunction(()=>window.__redeemRequests.length===1);
    await f.page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))});
    Object.assign(f.input,sample());await f.fill();await f.submit();await f.page.waitForFunction(()=>window.__redeemRequests.length===2);
    await f.page.evaluate(outcome=>{
     const old=window.__redeemRequests[0];
     if(outcome==='success'||outcome==='public-error')old.resolve({ok:true,status:200,json:async()=>({result:outcome==='success'?0:260001,data:{rewardItems:[]}})});
     if(outcome==='network-failure')old.reject(new Error('synthetic failure'));
     if(outcome==='timeout')for(const id of old.timers){const callback=window.__redeemTimers.get(id);if(callback){window.__redeemTimers.delete(id);callback()}}
    },outcome);
    await f.page.waitForTimeout(30);
    check(await f.page.locator('#submit').isDisabled()&&await f.page.locator('#formPanel').isVisible()&&await f.page.locator('#resultPanel').isHidden(),'old callbacks cannot render or unlock current form');
    check(await f.page.locator('#phoneNumber').inputValue()===f.input.phoneNumber&&await f.page.locator('#code').inputValue()===f.input.code,'new input remains intact');
    check(await f.page.locator('#message').textContent()===''&&!f.state.events.some(event=>event.event_type==='redeem_web_result'),'old errors and result telemetry suppressed');
    check(await f.page.evaluate(()=>window.__redeemRequests[0].signal.aborted),'old request cancelled');
    await f.page.evaluate(()=>window.__redeemRequests[1].resolve({ok:true,status:200,json:async()=>({result:0,data:{rewardItems:[]}})}));
    await f.page.locator('#resultPanel').waitFor({state:'visible'});await f.page.waitForTimeout(30);
    check(f.state.events.filter(event=>event.event_type==='redeem_web_result').length===1,'only current request emits result');
   }finally{await Promise.all(cleanups.map(fn=>fn()))}
  }
 }));
 test(engine+': mobile five-language layout and privacy-safe empty screenshot',()=>safely(async()=>{
  const cleanups=[],t={after:fn=>cleanups.push(fn)};try{
   const f=await fixture(t,browsers[engineIndex],{mobile:true,region:'jp'});
   check(await f.page.locator('#countryCode').inputValue()==='+81','site calling code');
   for(const lang of ['zh','en','ja','ko','zh-TW']){
    await f.page.locator('#language').selectOption(lang);check(await f.page.locator('h1').textContent()===api.DICT[lang].title,'language selector');
    check(await f.page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'no mobile horizontal overflow');
   }
   await f.page.locator('#language').selectOption('zh');
   check(await f.page.locator('#phoneNumber').inputValue()===''&&await f.page.locator('#code').inputValue()==='','screenshot inputs empty');
   await f.page.screenshot({path:'/private/tmp/redeem-review2/web/redeem-empty-'+engine.toLowerCase()+'.png',fullPage:true});
  }finally{await Promise.all(cleanups.map(fn=>fn()))}
 }));
}
async function contextStorage(context){const page=context.pages()[0];const data=await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}));const cookies=await context.cookies();return {empty:data.local===0&&data.session===0&&cookies.length===0}}

test('Regional home and product links remain reachable with single-line labels across viewport sizes',()=>safely(async()=>{
 for(const browser of browsers)for(const width of [320,390,768,1280])for(const region of ['jp','sg','us'])for(const product of [false,true]){
  const context=await browser.newContext({viewport:{width,height:844}});try{
   await context.addInitScript(()=>{window.__LUNAKORU_SKIP_LOADER=true});const page=await context.newPage();
   await page.route('**/*',route=>{
    const path=new URL(route.request().url()).pathname;
    const relative=path.endsWith('/')?path+'index.html':path;
    if(!/^\/(?:jp|sg|us|redeem)\/[a-z0-9_./-]+\.(?:html|css|js)$/.test(relative)&&!['/region.js','/title-plates.js','/app-ui.css'].includes(relative))return route.abort();
    try{const body=readFileSync(join(root,relative));return route.fulfill({contentType:relative.endsWith('.html')?'text/html':relative.endsWith('.css')?'text/css':'text/javascript',body})}catch(_){return route.abort()}
   });
   await page.goto('https://www.lunakoru.com/'+region+'/'+(product?'product/':''));
   await page.waitForTimeout(60);
   const bounds=await page.locator('.nav').evaluate(nav=>[...nav.querySelectorAll('.nav-links a,.region-switcher button,.bgm-toggle')].every(node=>{const r=node.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.width>0}));
   check(bounds,'all regional navigation controls in viewport '+width+' '+region+' '+product);
   const singleLine=await page.locator('.nav-links a').evaluateAll(links=>links.every(link=>{
    const range=document.createRange();range.selectNodeContents(link.querySelector('span')||link);
    return new Set([...range.getClientRects()].map(rect=>Math.round(rect.top))).size===1;
   }));
   check(singleLine,'regional navigation labels remain on one line '+width+' '+region+' '+product);
   await page.locator('.nav-links a[href*="redeem"]').click();await page.waitForURL('**/redeem/?region='+region);
   await page.waitForFunction(()=>!document.getElementById('submit').disabled);
   check(await page.locator('#countryCode').inputValue()===({jp:'+81',sg:'+65',us:'+1'})[region],'regional link sets calling code');
  }finally{await context.close()}
 }
}));
