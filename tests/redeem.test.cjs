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


test('submitted copy tells unregistered users to register and submit again in every language',()=>{
 check(api.DICT.zh.submittedBody==='已提交。若该手机号已注册 LunaKoru 且符合活动条件，奖励已发放到账号，请打开 App 在背包中查看；若尚未注册，请先用该手机号注册，再回到本页重新提交。','exact current PRD submitted copy');
 const required={en:/register with this phone number, then return to this page and submit again/,ja:/この電話番号で登録してから、このページに戻って再送信/,ko:/이 전화번호로 가입한 후 이 페이지로 돌아와 다시 제출/,['zh-TW']:/先用該手機號碼註冊，再回到本頁重新提交/};
 for(const [lang,pattern] of Object.entries(required))check(pattern.test(api.DICT[lang].submittedBody),'registration and resubmission instruction translated');
 const html=readFileSync(join(__dirname,'../redeem/index.html'),'utf8');check(html.includes(api.DICT.zh.submittedBody),'independent page static fallback matches PRD');
});


test('mainland local phones require a mobile prefix and eleven digits after normalization',()=>{
 const input=sample(),validate=phone=>api.validate({...input,phoneNumber:phone,repeatPhone:phone});
 for(const prefix of ['138','147','159','166','172','188','199']){
  const phone=prefix+String(randomInt(10000000,99999999));
  check(!validate(phone).error,'supported mainland mobile prefix');
  check(!validate(' '+phone.slice(0,3)+' ('+phone.slice(3,7)+')-'+phone.slice(7)+' ').error,'formatting normalized before validation');
 }
 for(const phone of [String(12)+String(randomInt(100000000,999999999)),String(23)+String(randomInt(100000000,999999999)),input.phoneNumber.slice(1),input.phoneNumber+'0',input.phoneNumber.slice(0,-1)+'x'])check(validate(phone).error==='phoneInvalid','malformed mainland phone rejected');
});


test('browser locale selects existing dialing regions while explicit region takes precedence',()=>{
 const loc=(search='',hostname='www.lunakoru.com')=>({hostname,search});
 for(const [locale,country,region,language] of [['zh-CN','+86','cn','zh'],['zh-Hans-SG','+65','sg','zh'],['en-JP','+81','jp','en'],['en-CN','+86','cn','en'],['en-SG','+65','sg','en'],['en-US','+1','us','en'],['en','+1','us','en'],['ja-JP','+81','jp','ja'],['ko-KR','+86','cn','ko'],['zh-TW','+86','cn','zh-TW'],['zh-Hant-TW','+86','cn','zh-TW']]){
  const result=api.defaults(loc(),[locale]);check(result.country===country&&result.region===region&&result.language===language,'browser locale dialing and display defaults');
 }
 check(api.defaults(loc(),['fr-FR','en-SG']).country==='+86','unsupported preferred browser language does not select a secondary dialing region');
 check(api.defaults(loc(),['ko-KR','en-US']).country==='+86','preferred fallback language does not select a secondary dialing region');
 check(api.defaults(loc('?region=invalid'),['ja']).country==='+81','unrecognized region uses browser fallback');
 check(api.defaults(loc('?lang=ja'),['en-SG']).country==='+65','display language does not replace browser dialing region');
 for(const [region,country] of [['cn','+86'],['jp','+81'],['sg','+65'],['us','+1']]){
  check(api.defaults(loc('?region='+region+'&lang=ko'),['en-SG']).country===country,'explicit query region wins over browser and display language');
  check(api.defaults(loc('',region+'.lunakoru.com'),['ja']).country===country,'regional hostname wins over browser');
 }
 check(api.defaults(loc('?region=us','jp.lunakoru.com'),['en-SG']).country==='+1','query region wins over regional hostname');
 check(api.defaults(loc(),['fr-FR']).country==='+86','unsupported languages retain safe fallback');
});


test('supported international mobile formats reject malformed national numbers before confirmation',()=>{
 const input=sample(),digits=count=>Array.from({length:count},()=>randomInt(0,10)).join('');
 const groups=[
  ['+81',['60','70','80','90'].map(prefix=>prefix+digits(8)),[digits(6),'20'+digits(8),'50'+digits(8),'90'+digits(7),'90'+digits(9)]],
  ['+65',['812','912'].map(prefix=>prefix+digits(5)),[digits(6),'2'+digits(7),'8'+digits(6),'9'+digits(8)]],
  ['+1',['20255501'+digits(2)],
   [digits(6),'1'+digits(2)+'2'+digits(6),'2'+digits(2)+'1'+digits(6),'2'+digits(2)+'2'+digits(7)]]
 ];
 for(const [countryCode,valid,invalid] of groups){
  for(const phone of valid){
   const checked=api.validate({...input,countryCode,phoneNumber:phone,repeatPhone:phone});
   check(!checked.error,'valid national mobile format');
   for(const [first,second] of [[countryCode+' '+phone,phone],[phone,countryCode+' ('+phone.slice(0,3)+') '+phone.slice(3)],[countryCode+' '+phone,countryCode+' '+phone]]){
    const prefixed=api.validate({...input,countryCode,phoneNumber:first,repeatPhone:second});
    check(!prefixed.error&&prefixed.value.phoneNumber===phone,'matching selected calling code stripped independently from both inputs');
   }
   check(api.validate({...input,countryCode,phoneNumber:'+44'+phone,repeatPhone:'+44'+phone}).error==='phoneInvalid','different calling prefix rejected');
  }
  for(const phone of invalid)check(api.validate({...input,countryCode,phoneNumber:phone,repeatPhone:phone}).error==='phoneInvalid','malformed national mobile format blocked');
 }
 const mainland=api.validate({...input,phoneNumber:input.countryCode+' '+input.phoneNumber,repeatPhone:input.phoneNumber});
 check(!mainland.error&&mainland.value.phoneNumber===input.phoneNumber,'mainland matching prefix also stripped');
 const japan=groups[0][1][0];
 check(!api.validate({...input,countryCode:'+81',phoneNumber:'0'+japan,repeatPhone:'+81'+japan}).error,'Japanese domestic trunk prefix normalized');
});

test('display language scans browser preferences independently from first-locale dialing defaults',()=>{
 const loc={hostname:'www.lunakoru.com',search:''};
 for(const [languages,language,country] of [
  [['fr-FR','ja-JP'],'ja','+86'],[['fr-FR','en-SG'],'en','+86'],[['de-DE','zh-Hant-TW'],'zh-TW','+86'],
  [['fr-FR','ko-KR'],'ko','+86'],[['fr-FR','de-DE'],'zh','+86'],[['en-GB','ja-JP'],'en','+1'],[['en-AU'],'en','+1']
 ]){
  const value=api.defaults(loc,languages);check(value.language===language&&value.country===country,'display fallback preserves independent dialing contract');
 }
 check(api.defaults({...loc,search:'?region=jp'},['fr-FR','en-SG']).language==='ja','regional site display wins over browser fallback');
 check(api.defaults({...loc,search:'?region=jp&lang=ko'},['fr-FR','en-SG']).language==='ko','explicit supported display language still wins');
});

test('NFKC code input and prefill normalize compatibility characters before lookup',()=>{
 const input=sample(),wide=value=>[...value].map(char=>String.fromCharCode(char.charCodeAt(0)+0xfee0)).join('');
 const formatted='　'+wide(input.code.slice(0,4).toLowerCase())+'－'+wide(input.code.slice(4))+'　';
 check(api.normalizeCode(formatted)===input.code,'fullwidth code and separator normalized before ASCII checks');
 const result=api.validate({...input,repeatPhone:input.phoneNumber,code:formatted});
 check(!result.error&&result.value.code===input.code,'normalized compatibility input reaches contract payload');
});

test('submitted English copy uses the app Bag label',()=>{
 check(api.DICT.en.submittedBody.includes('check your Bag.')&&!api.DICT.en.submittedBody.includes('backpack'),'app destination label matches');
});

test('redemption assets use one version token and alert keeps its implicit live behavior',()=>{
 const html=readFileSync(join(__dirname,'../redeem/index.html'),'utf8');
 const versions=[...html.matchAll(/(?:src|href)="(?:redeem\.(?:css|js)|i18n\.js|phone-libphonenumber-9\.0\.39\.js)\?v=([^"&]+)"/g)].map(match=>match[1]);
 check(versions.length===4&&new Set(versions).size===1,'all redemption runtime assets share a release cache version');
 check(/id="message"[^>]*role="alert"/.test(html)&&!/<[^>]*role="alert"[^>]*aria-live=/.test(html),'alert has one live announcement policy');
});


test('phone acceptance and canonical national payload match backend mobile metadata',()=>{
 const input=sample();
 for(const {id,country,phone,want} of require('./redeem-phone-fixtures.cjs')()){
  const result=api.validate({...input,countryCode:country,phoneNumber:phone,repeatPhone:phone});
  if(want===null)check(result.error==='phoneInvalid',id+' rejected locally');
  else check(!result.error&&result.value.countryCode===country&&result.value.phoneNumber===want,id+' accepted with backend canonical national payload');
 }
});
