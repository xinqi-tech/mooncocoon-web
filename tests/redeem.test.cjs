const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes,randomInt}=require('node:crypto');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const api=require('../redeem/redeem.js');
const check=(value,message)=>assert.ok(Boolean(value),message);
const sample=()=>({countryCode:'+'+(80+6),phoneNumber:String(13)+String(randomInt(100000000,999999999)),code:randomBytes(6).toString('hex').toUpperCase()});

test('five language dictionaries have complete UI and error parity',()=>{
 const keys=Object.keys(api.DICT.zh).sort().join('|');
 check(Object.keys(api.DICT).sort().join(',')==='en,ja,ko,zh,zh-TW','five enabled languages');
 for(const dict of Object.values(api.DICT)){
  check(Object.keys(dict).sort().join('|')===keys,'dictionary parity');
  check(Object.values(dict).every(value=>typeof value==='string'&&value.trim()),'no missing translation');
  check((dict.confirmBody.match(/\{phone\}/g)||[]).length===1,'confirmation placeholder parity');
  for(const name of api.ERROR_NAMES)check(Boolean(dict[name]),'stable error translation');
 }
 check(api.DICT.zh.INVALID==='兑换码无效，请检查后重新输入','PRD invalid copy');
 check(api.DICT.zh.SERVICE_BUSY==='网络开小差了，请稍后再试','PRD network copy');
});

test('normalizes a prefilled formatted code; mismatch blocks submission and masking stays local',()=>{
 const input=sample(),formatted=' '+input.code.slice(0,4).toLowerCase()+' - '+input.code.slice(4)+' ';
 check(api.normalizeCode(formatted)===input.code,'code normalization');
 const valid=api.validate({...input,code:formatted,repeatPhone:input.phoneNumber});
 check(!valid.error&&valid.value.code===input.code,'valid input');
 check(api.validate({...input,repeatPhone:input.phoneNumber.slice(0,-1)}).error==='phoneMismatch','mismatch must block');
 const mask=api.maskPhone(input.phoneNumber);
 check(!mask.includes(input.phoneNumber)&&mask.includes('****'),'masked confirmation');
 check(mask.startsWith(input.phoneNumber.slice(0,3))&&mask.endsWith(input.phoneNumber.slice(-4)),'mask suffix/prefix');
 check(api.validate({...input,repeatPhone:input.phoneNumber,code:''}).error==='codeRequired','blank code blocked');
 check(api.validate({...input,countryCode:'+000',repeatPhone:input.phoneNumber}).error==='phoneInvalid','bad dialing code blocked');
});

test('fixed API origins cannot be overridden by untrusted configuration',()=>{
 check(api.apiBaseFor('www.lunakoru.com')==='https://api.lunakoru.com','production API');
 check(api.apiBaseFor('127.0.0.1')==='','local test proxy');
 check(api.apiBaseFor('untrusted.example')===null,'unknown hosts fail closed');
 const source=readFileSync(join(__dirname,'../redeem/redeem.js'),'utf8');
 check(!/localStorage|sessionStorage|document\.cookie|\.cookie\s*=/.test(source),'no sensitive persistence');
 check(!/preview\?code/.test(source),'no code in request URL');
});

test('region and browser defaults select all five languages and site dialing codes',()=>{
 const loc=(hostname,search='')=>({hostname,search});
 for(const [region,country,language] of [['jp','+81','ja'],['sg','+65','en'],['us','+1','en']]){
  const value=api.defaults(loc('www.lunakoru.com','?region='+region),['ko']);
  check(value.country===country&&value.language===language,'regional defaults');
 }
 check(api.defaults(loc('www.lunakoru.com'),['ko-KR']).language==='ko','browser Korean');
 check(api.defaults(loc('www.lunakoru.com'),['zh-Hant-TW']).language==='zh-TW','browser Traditional Chinese');
 check(api.defaults(loc('www.lunakoru.com','?lang=ja'),['en']).language==='ja','explicit supported language');
 check(api.defaults(loc('www.lunakoru.com','?region=invalid&lang=invalid'),[]).country==='+86','safe fallback');
});

test('account outcomes have a single result and unexpected server fields are discarded',()=>{
 for(const result of [0,'ACCOUNT_NOT_FOUND',260006,260008,'NOT_ELIGIBLE','ALREADY_REDEEMED'])check(api.resultKind(result)==='submitted','account outcome merged');
 for(let i=0;i<api.ERROR_NAMES.length;i++){
  const name=api.ERROR_NAMES[i];
  if(['NOT_ELIGIBLE','ALREADY_REDEEMED'].includes(name))continue;
  check(api.resultKind(260001+i)===name,'numeric error contract');
 }
 check(api.resultKind(999)==='SERVICE_BUSY','unknown error private fallback');
 const input=sample();
 const sanitized=api.rewardItems({uid:randomInt(1,9999),nickname:input.phoneNumber,rewardItems:[{rewardType:'ITEM',name:'Gift',count:2,iconUrl:'javascript:alert(1)',uid:input.code}]});
 const output=JSON.stringify(sanitized);
 check(sanitized.length===1&&sanitized[0].iconUrl==='','safe reward rendering');
 check(!output.includes(input.code)&&!output.includes(input.phoneNumber)&&!output.includes('uid'),'account fields ignored');
});

test('analytics only allow submitted and public code outcomes, never raw values',()=>{
 const input=sample(),context={deviceId:'ephemeral-device',sessionId:'ephemeral-session',language:'ko',...input};
 for(const result of ['submitted',...api.ERROR_NAMES,'ACCOUNT_NOT_FOUND',input.code]){
  const event=api.buildAnalyticsEvent('redeem_web_result',context,result);
  const output=JSON.stringify(event);
  check(!output.includes(input.phoneNumber)&&!output.includes(input.code),'no phone or code telemetry');
  check(!['ACCOUNT_NOT_FOUND','NOT_ELIGIBLE','ALREADY_REDEEMED'].includes(event.properties.result),'no account telemetry');
  check(Object.keys(event.properties).sort().join(',')==='language,result','property allowlist');
 }
});

test('scope excludes the Chinese homepage and adds only the regional links',()=>{
 for(const region of ['jp','sg','us'])check(readFileSync(join(__dirname,'..',region,'index.html'),'utf8').includes('../redeem/?region='+region),'regional link');
 const html=readFileSync(join(__dirname,'../redeem/index.html'),'utf8');
 check(!/reservation\.js|reservation\.css/.test(html),'independent page');
 check(html.includes('name="referrer" content="no-referrer"'),'referrer privacy');
});
