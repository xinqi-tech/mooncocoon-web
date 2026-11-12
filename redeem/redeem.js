/**
 * @fileoverview 独立官网兑换页交互。AI Context: 上游 redeem/index.html 与 i18n.js；下游公开 web-redeem、匿名 analytics 接口。
 * 核心概念: 无登录/短信/账号查询；手机号只在内存，所有账号相关结果合并为已提交；API 地址不能由 URL 或存储控制。
 */
(function(root,factory){
  const api=factory(root,typeof module==='object'&&module.exports?require('./i18n.js'):root.LunaKoruRedeemI18n);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.LunaKoruRedeem=api;
  if(root.document)root.document.addEventListener('DOMContentLoaded',()=>api.init(root.document));
})(typeof globalThis!=='undefined'?globalThis:this,function(root,DICT){
  'use strict';
  const DEFAULT_API_BASE='https://api.lunakoru.com';
  const DEFAULT_REQUEST_TIMEOUT_MS=12000;
  const ERROR_NAMES=['INVALID','REVOKED','PAUSED','NOT_STARTED','EXPIRED','NOT_ELIGIBLE','USED','ALREADY_REDEEMED','SOLD_OUT','DAILY_LIMIT','TOO_FREQUENT','SERVICE_BUSY'];
  const ACCOUNT_RESULTS=new Set(['ACCOUNT_NOT_FOUND','NOT_ELIGIBLE','ALREADY_REDEEMED']);
  const CODE_RESULTS=new Set(ERROR_NAMES.filter(key=>!ACCOUNT_RESULTS.has(key)));
  const REGIONS={cn:{country:'+86',language:'zh',home:'/'},jp:{country:'+81',language:'ja',home:'/jp/'},sg:{country:'+65',language:'en',home:'/sg/'},us:{country:'+1',language:'en',home:'/us/'}};
  const normalizeCode=value=>String(value||'').trim().replace(/[\s-]/g,'').toUpperCase();
  const normalizePhone=value=>String(value||'').trim().replace(/[\s()-]/g,'');
  const normalizeCountry=value=>'+'+String(value||'').trim().replace(/^\+/,'');
  function languageFor(value){
    const tag=String(value||'').toLowerCase();
    if(/^(zh-(tw|hk|mo|hant))/.test(tag))return 'zh-TW';
    if(tag.startsWith('zh'))return 'zh';
    return ['en','ja','ko'].find(lang=>tag===lang||tag.startsWith(lang+'-'))||null;
  }
  function defaults(location,languages=[]){
    const params=new URLSearchParams(location.search||'');
    const hostRegion=String(location.hostname||'').split('.')[0];
    const region=Object.hasOwn(REGIONS,params.get('region'))?params.get('region'):Object.hasOwn(REGIONS,hostRegion)?hostRegion:'cn';
    const explicitRegion=region!=='cn'||params.get('region')==='cn';
    const language=languageFor(params.get('lang'))||(explicitRegion?REGIONS[region].language:languages.map(languageFor).find(Boolean))||'zh';
    return {...REGIONS[region],region,language};
  }
  function apiBaseFor(hostname){
    if(['localhost','127.0.0.1','[::1]'].includes(hostname))return '';
    return ['www.lunakoru.com','lunakoru.com','jp.lunakoru.com','sg.lunakoru.com','us.lunakoru.com'].includes(hostname)?DEFAULT_API_BASE:null;
  }
  function validate(input){
    const countryCode=normalizeCountry(input.countryCode),phoneNumber=normalizePhone(input.phoneNumber),repeatPhone=normalizePhone(input.repeatPhone),code=normalizeCode(input.code);
    if(!/^\+[1-9]\d{0,2}$/.test(countryCode)||!/^\d{6,14}$/.test(phoneNumber)||countryCode.length-1+phoneNumber.length>15)return {error:'phoneInvalid'};
    if(phoneNumber!==repeatPhone)return {error:'phoneMismatch'};
    if(!code)return {error:'codeRequired'};
    if(!/^[A-Z0-9]{4,16}$/.test(code))return {error:'INVALID'};
    return {value:{countryCode,phoneNumber,code}};
  }
  const maskPhone=phone=>phone.length>7?phone.slice(0,3)+'****'+phone.slice(-4):phone.slice(0,1)+'****'+phone.slice(-1);
  function resultKind(result){
    if(result===0)return 'submitted';
    const name=typeof result==='number'?ERROR_NAMES[result-260001]:String(result||'');
    if(ACCOUNT_RESULTS.has(name))return 'submitted';
    return CODE_RESULTS.has(name)?name:'SERVICE_BUSY';
  }
  function rewardItems(data){
    if(!Array.isArray(data?.rewardItems))return [];
    return data.rewardItems.slice(0,10).filter(item=>['CURRENCY','ITEM','TITLE'].includes(item?.rewardType)&&Number.isSafeInteger(item.count)&&item.count>0).map(item=>({
      rewardType:item.rewardType,name:typeof item.name==='string'?item.name.slice(0,100):'',count:item.count,iconUrl:safeIcon(item.iconUrl)
    }));
  }
  function safeIcon(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:''}catch(_){return ''}}
  const randomId=()=>root.crypto?.randomUUID?.()||'web-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  function buildAnalyticsEvent(type,context,result){
    if(!['redeem_web_submitted','redeem_web_result'].includes(type))return null;
    const properties={language:languageFor(context.language)||'zh'};
    if(type==='redeem_web_result')properties.result=result==='submitted'?'submitted':CODE_RESULTS.has(result)?result:'SERVICE_BUSY';
    return {event_id:randomId(),event_type:type,device_id:context.deviceId,session_id:context.sessionId,platform:'web',timestamp:Date.now(),properties};
  }
  async function fetchJson(fetcher,url,body,headers,timeoutMs,lifecycleSignal){
    const controller=new AbortController();let timer,rejectCancelled;
    const cancel=()=>controller.abort();
    const aborted=()=>rejectCancelled(new Error('request cancelled'));
    const cancelled=new Promise((_,reject)=>{rejectCancelled=reject});
    controller.signal.addEventListener('abort',aborted,{once:true});
    lifecycleSignal?.addEventListener('abort',cancel,{once:true});
    if(lifecycleSignal?.aborted)cancel();
    const deadline=new Promise((_,reject)=>{timer=root.setTimeout(()=>{controller.abort();reject(new Error('request timeout'))},timeoutMs)});
    try{
      return await Promise.race([cancelled,deadline,(async()=>{
        if(controller.signal.aborted)throw new Error('request cancelled');
        const response=await fetcher(url,{method:'POST',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body),signal:controller.signal});
        if(response.status===429)return {result:260011};
        if(!response.ok)throw new Error('request failed');
        return response.json();
      })()]);
    }finally{
      root.clearTimeout(timer);lifecycleSignal?.removeEventListener('abort',cancel);controller.signal.removeEventListener('abort',aborted);
    }
  }
  function init(doc,fetchImpl,options={}){
    const form=doc.getElementById('redeemForm');if(!form)return;
    const view=doc.defaultView||root,el=id=>doc.getElementById(id),location=view.location;
    const config=defaults(location,view.navigator.languages||[view.navigator.language]);
    const base=apiBaseFor(location.hostname),fetcher=fetchImpl||view.fetch.bind(view);
    let language=config.language,errorKey='',pending=null,busy=false,submitted=false;
    let lifecycleActive=true,generation=0,lifecycleController=new AbortController(),activeRequest=null;
    const current=token=>lifecycleActive&&token===activeRequest&&token.generation===generation;
    const invalidateLifecycle=()=>{lifecycleActive=false;generation++;activeRequest=null;lifecycleController.abort()};
    const fields=['countryCode','phoneNumber','repeatPhone','code'];
    const context={deviceId:randomId(),sessionId:randomId(),language};
    const timeoutMs=options.requestTimeoutMs||DEFAULT_REQUEST_TIMEOUT_MS;
    const t=key=>DICT[language][key]||DICT.zh[key]||'';
    const dialog=el('confirmDialog');
    const setLocked=value=>{fields.forEach(id=>el(id).disabled=value);el('language').disabled=value;el('submit').disabled=value;el('confirm').disabled=value};
    const message=key=>{errorKey=key;el('message').textContent=key?t(key):''};
    const resetInputs=()=>{fields.slice(1).forEach(id=>el(id).value='');pending=null};
    function translate(){
      doc.documentElement.lang=language==='zh'?'zh-CN':language;doc.title=t('title')+' · LunaKoru';context.language=language;
      doc.querySelectorAll('[data-i18n]').forEach(node=>node.textContent=t(node.dataset.i18n));
      el('language').value=language;el('language').setAttribute('aria-label',t('language'));message(errorKey);
      if(busy)el('submit').textContent=t('submitting');
      if(pending)el('confirmBody').textContent=t('confirmBody').replace('{phone}',pending.countryCode+' '+maskPhone(pending.phoneNumber));
    }
    function analytics(type,result,token){
      if(!current(token))return;
      const event=buildAnalyticsEvent(type,context,result);
      if(base===null)return;
      void fetchJson(fetcher,base+'/api/analytics/events',{events:[event]}, {},5000,token.signal).catch(()=>{});
    }
    function showSubmitted(data){
      submitted=true;el('rewardItems').replaceChildren();
      for(const reward of rewardItems(data)){
        const li=doc.createElement('li');
        if(reward.iconUrl){const img=doc.createElement('img');img.src=reward.iconUrl;img.alt='';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>img.hidden=true);li.append(img)}
        else{const icon=doc.createElement('span');icon.className='reward-placeholder';icon.textContent='✦';icon.setAttribute('aria-hidden','true');li.append(icon)}
        const name=doc.createElement('span');name.className='reward-name';name.textContent=reward.name||t('rewardFallback');
        const count=doc.createElement('span');count.textContent='× '+reward.count;li.append(name,count);el('rewardItems').append(li);
      }
      resetInputs();el('formPanel').hidden=true;el('resultPanel').hidden=false;el('resultPanel').focus();
    }
    // Fragments never enter the document GET. Query-based codes are ignored and discarded; clearing cannot undo their initial transmission.
    const params=new URLSearchParams(location.search),fragment=new URLSearchParams(location.hash.slice(1));
    el('code').value=normalizeCode(fragment.get('code')).slice(0,32);
    if(fragment.has('code')||params.has('code')){
      fragment.delete('code');params.delete('code');const query=params.toString(),hash=fragment.toString();
      view.history.replaceState(null,'',location.pathname+(query?'?'+query:'')+(hash?'#'+hash:''));
    }
    el('countryCode').value=config.country;el('phoneNumber').value='';el('repeatPhone').value='';el('homeLink').href=config.home;
    translate();el('submit').disabled=false;
    el('language').addEventListener('change',()=>{language=languageFor(el('language').value)||'zh';translate()});
    el('code').addEventListener('input',()=>{const input=el('code');const end=input.selectionStart;const before=input.value;input.value=normalizeCode(before);if(end!==null){const position=normalizeCode(before.slice(0,end)).length;input.setSelectionRange(position,position)}});
    form.addEventListener('submit',event=>{
      event.preventDefault();if(busy||pending||submitted)return;message('');
      const input=Object.fromEntries(fields.map(id=>[id,el(id).value]));const checked=validate(input);
      if(checked.error){message(checked.error);return}
      pending=checked.value;setLocked(true);el('confirm').disabled=false;translate();dialog.showModal();el('cancel').focus();
    });
    function cancel(){if(busy)return;pending=null;dialog.close();setLocked(false);el('submit').focus()}
    el('cancel').addEventListener('click',cancel);
    dialog.addEventListener('cancel',event=>{event.preventDefault();cancel()});
    el('confirm').addEventListener('click',async()=>{
      if(busy||!pending||!lifecycleActive)return;
      const token={generation,signal:lifecycleController.signal};activeRequest=token;busy=true;setLocked(true);dialog.close();el('submit').textContent=t('submitting');
      const payload=pending;pending=null;analytics('redeem_web_submitted',undefined,token);
      try{
        if(base===null)throw new Error('unsupported host');
        const envelope=await fetchJson(fetcher,base+'/api/redeem-code/web-redeem',payload,{'Accept-Language':language,'X-App-Market':config.region==='cn'?'CN':'OVERSEAS'},timeoutMs,token.signal);
        if(!current(token))return;
        const result=resultKind(envelope?.result);analytics('redeem_web_result',result,token);
        if(result==='submitted')showSubmitted(envelope?.data);else message(result);
      }catch(_){if(current(token)){message('SERVICE_BUSY');analytics('redeem_web_result','SERVICE_BUSY',token)}}
      finally{if(current(token)){busy=false;activeRequest=null;setLocked(false);el('submit').textContent=t('redeem')}}
    });
    el('again').addEventListener('click',()=>{submitted=false;resetInputs();message('');el('resultPanel').hidden=true;el('rewardItems').replaceChildren();el('formPanel').hidden=false;el('phoneNumber').focus()});
    view.addEventListener('pagehide',()=>{invalidateLifecycle();resetInputs();dialog.close()});
    view.addEventListener('pageshow',event=>{if(event.persisted){invalidateLifecycle();lifecycleController=new AbortController();lifecycleActive=true;busy=false;submitted=false;resetInputs();setLocked(false);dialog.close();el('formPanel').hidden=false;el('resultPanel').hidden=true;el('rewardItems').replaceChildren();message('');translate()}});
    return {get language(){return language}};
  }
  return {init,DICT,ERROR_NAMES,normalizeCode,normalizePhone,normalizeCountry,languageFor,defaults,apiBaseFor,validate,maskPhone,resultKind,rewardItems,buildAnalyticsEvent,DEFAULT_REQUEST_TIMEOUT_MS};
});
