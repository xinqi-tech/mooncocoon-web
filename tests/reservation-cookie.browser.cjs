/**
 * Cookie-free reservation regression using the real page and WebKit (iPhone viewport).
 * Requires playwright + its WebKit runtime; all network traffic is intercepted with synthetic data.
 * Run: node --test tests/reservation-cookie.browser.cjs
 */
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {webkit,devices}=require('playwright');
const html=readFileSync(join(__dirname,'../index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const script=readFileSync(join(__dirname,'../reservation.js'),'utf8');
let browser;
before(async()=>{browser=await webkit.launch({headless:true})});
after(async()=>{await browser?.close()});

async function fixture(t,{failure,loseResponse,hangResponse=false,saveBeforeHang=false,delay=0,timeoutMs=12000}={}){
  const context=await browser.newContext({...devices['iPhone 13']});
  context.setDefaultTimeout(8000);
  t.after(()=>context.close());
  const page=await context.newPage(),calls=[];
  let receipt=null,attempts=0;
  const activity={available:true,phase:'RESERVING',serverTime:new Date().toISOString(),
    startAt:'2026-01-01T00:00:00Z',releaseAt:'2099-01-01T00:00:00Z',count:0,unlockedMask:0,reminderAvailable:true};
  const mine=()=>({phoneMasked:'*** **** 8000',publicLookup:true,reservation:receipt});
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.href==='https://www.lunakoru.com/')return route.fulfill({contentType:'text/html',body:html});
    if(!url.pathname.startsWith('/api/reservation-gift/'))return route.abort();
    const path=url.pathname.slice('/api/reservation-gift'.length);
    const headers={'access-control-allow-origin':'https://www.lunakoru.com','access-control-allow-credentials':'true',
      'access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,OPTIONS'};
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
    const body=req.postDataJSON();calls.push({path,body,cookie:req.headers().cookie});
    const respond=(data,status=200)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify({result:0,data})});
    if(path==='/activity')return respond(activity);
    if(path==='/reserve-with-code'){
      attempts++;
      if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
      if(failure&&attempts===1)return respond({},failure);
      if(hangResponse&&attempts===1){
        if(saveBeforeHang)receipt={code:'RG-SYNTHETIC',platform:body.platform,reminderSubscribed:body.reminder,rewards:[]};
        await new Promise(resolve=>setTimeout(resolve,Math.max(timeoutMs*4,200)));
        return route.abort('failed').catch(()=>{});
      }
      receipt={code:'RG-SYNTHETIC',platform:body.platform,reminderSubscribed:body.reminder,rewards:[]};
      if(loseResponse)return route.abort('failed');
      return respond(mine());
    }
    if(path==='/lookup')return respond(mine());
    if(path==='/lookup/subscribe'){receipt.reminderSubscribed=true;return respond(mine())}
    // Deliberately reject cookie-dependent requests: no session cookie exists in this fixture.
    return respond({},401);
  });
  await page.goto('https://www.lunakoru.com/');
  // The site's media loader is unrelated to reservation and its script is excluded above.
  await page.evaluate(()=>document.getElementById('loader')?.remove());
  await page.addScriptTag({content:script});
  await page.evaluate(timeout=>window.LunaKoruReservation.init(document,undefined,timeout),timeoutMs);
  await page.locator('#reservationOpen').waitFor({state:'visible'});
  await page.locator('#reservationOpen').click();
  await page.locator('[name=phone]').fill('13800138000');
  await page.locator('[name=code]').fill('123456');
  await page.locator('[name=adult]').check();
  await page.locator('[name=terms]').check();
  return {page,context,calls};
}
const submit=page=>page.locator('#reservationSubmit').click();
const success=page=>page.locator('#reservationMineCode').filter({hasText:'RG-SYNTHETIC'}).waitFor();

test('iPhone WebKit saves and displays a receipt with no Cookie, verify or mine request',async t=>{
  const {page,context,calls}=await fixture(t);
  await submit(page);await success(page);
  const writes=calls.filter(c=>c.path==='/reserve-with-code');
  assert.equal(writes.length,1);assert.equal(writes[0].body.platform,'IOS');
  assert.equal(writes[0].body.code,'123456');assert.equal(writes[0].cookie,undefined);
  assert.equal(calls.some(c=>['/verify','/reserve','/mine'].includes(c.path)),false);
  assert.deepEqual(await context.cookies(),[]);
  assert.equal(await page.locator('[name=code]').inputValue(),'');
  await page.locator('#reservationSubscribe').click();
  await page.waitForFunction(()=>document.getElementById('reservationSubscribe').textContent==='已订阅上线提醒');
  assert.equal(calls.filter(c=>c.path==='/lookup/subscribe').length,1);
});
test('invalid SMS shows a code error and a fresh attempt can succeed',async t=>{
  const {page,calls}=await fixture(t,{failure:422});
  await submit(page);
  await page.waitForFunction(()=>document.getElementById('reservationMessage').textContent.includes('验证码错误或已过期'));
  await page.locator('[name=code]').fill('654321');await submit(page);await success(page);
  assert.deepEqual(calls.filter(c=>c.path==='/reserve-with-code').map(c=>c.body.code),['123456','654321']);
});
test('failed save retains entered code and allows retry',async t=>{
  const {page,calls}=await fixture(t,{failure:503});
  await submit(page);
  await page.waitForFunction(()=>document.getElementById('reservationMessage').textContent.includes('服务暂不可用'));
  assert.equal(await page.locator('[name=code]').inputValue(),'123456');
  await submit(page);await success(page);
  assert.equal(calls.filter(c=>c.path==='/reserve-with-code').length,2);
});
test('lost response recovers the saved receipt through cookie-free lookup',async t=>{
  const {page,calls}=await fixture(t,{loseResponse:true});
  await submit(page);await success(page);
  assert.equal(calls.filter(c=>c.path==='/lookup').length,1);
  assert.equal(calls.some(c=>c.path==='/mine'),false);
});
test('pending response times out and recovers a receipt saved by the server',async t=>{
  const {page,calls}=await fixture(t,{hangResponse:true,saveBeforeHang:true,timeoutMs:50});
  await submit(page);await success(page);
  assert.equal(calls.filter(c=>c.path==='/reserve-with-code').length,1);
  assert.equal(calls.filter(c=>c.path==='/lookup').length,1);
  assert.equal(await page.locator('[name=code]').inputValue(),'');
});
test('pending response with no saved record restores retryable form state',async t=>{
  const {page,calls}=await fixture(t,{hangResponse:true,timeoutMs:50});
  await submit(page);
  await page.waitForFunction(()=>document.getElementById('reservationMessage').textContent.includes('请求超时'));
  assert.equal(await page.locator('[name=code]').inputValue(),'123456');
  assert.equal(await page.locator('#reservationSubmit').isDisabled(),false);
  await submit(page);await success(page);
  assert.equal(calls.filter(c=>c.path==='/reserve-with-code').length,2);
});
test('source, rate-limit and missing-login errors keep their distinct recovery messages',async t=>{
  for(const [status,text,cleared] of [[403,'请刷新页面后重试',false],[429,'请求太频繁',false],[401,'未能识别登录状态',true]]){
    const {page}=await fixture(t,{failure:status});
    await submit(page);
    await page.waitForFunction(expected=>document.getElementById('reservationMessage').textContent.includes(expected),text);
    assert.equal(await page.locator('[name=code]').inputValue()==='',cleared);
  }
});
test('double submission saves once and missing consent never sends a code',async t=>{
  const {page,calls}=await fixture(t,{delay:200});
  await page.locator('[name=terms]').uncheck();await submit(page);
  assert.equal(calls.filter(c=>c.path==='/reserve-with-code').length,0);
  await page.locator('[name=terms]').check();
  await page.evaluate(()=>{const form=document.getElementById('reservationForm');
    form.dispatchEvent(new Event('submit',{cancelable:true}));form.dispatchEvent(new Event('submit',{cancelable:true}));});
  await page.locator('[name=phone]').fill('13900139000');
  await success(page);
  assert.equal(calls.filter(c=>c.path==='/reserve-with-code').length,1);
  assert.equal(await page.locator('[name=phone]').inputValue(),'13800138000');
});
test('closing and reopening the dialog ignores a late receipt from the previous flow',async t=>{
  const {page}=await fixture(t,{delay:300});
  await submit(page);
  await page.locator('#reservationClose').click();
  await page.locator('#reservationOpen').click();
  await new Promise(resolve=>setTimeout(resolve,500));
  assert.equal(await page.locator('#reservationMine').isVisible(),false);
  assert.equal(await page.locator('[name=phone]').inputValue(),'');
  assert.equal(await page.locator('#reservationSubmit').isDisabled(),false);
});
