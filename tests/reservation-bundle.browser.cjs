const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {chromium}=require('playwright');
const html=readFileSync(join(__dirname,'../index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const script=readFileSync(join(__dirname,'../reservation.js'),'utf8');
test('single bundle requires login, restores same code and shows redeemed state',async t=>{
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
 t.after(()=>browser.close());
 const page=await browser.newPage();let loggedIn=false,issued=false,redeemed=false,issues=0,ended=false;
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.href==='https://www.lunakoru.com/')return route.fulfill({contentType:'text/html',body:html});
  if(!url.pathname.startsWith('/api/reservation-gift/'))return route.abort();
  const path=url.pathname.split('/').pop();
  const headers={'access-control-allow-origin':'https://www.lunakoru.com','access-control-allow-credentials':'true','access-control-allow-headers':'content-type,x-reservation-csrf','access-control-allow-methods':'GET,POST,OPTIONS'};
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  const respond=(data,status=200)=>route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify({result:status===200?0:status,data})});
  const code={tier:4,bundle:true,code:'TEST-ONLY-CODE',redeemed,expiresAt:'2099-01-01T00:00:00Z'};
  const mine=()=>({phoneMasked:'*** **** 8000',csrf:'synthetic-csrf',expiresAt:'2099-01-01T00:00:00Z',reservation:{code:'RG-SYNTHETIC',platform:'ANDROID',reminderSubscribed:false,rewards:[]},activationCodes:issued?[code]:[]});
  if(path==='activity')return respond({available:true,phase:ended?'ENDED':'CLAIMING',serverTime:new Date().toISOString(),count:50001,unlockedMask:7,claimAvailable:!ended,claimDeadlineAt:'2099-01-01T00:00:00Z'});
  if(path==='mine')return loggedIn?respond(mine()):respond({},401);
  if(path==='verify'){loggedIn=true;return respond({mine:mine()})}
  if(path==='bundle-code'){assert.equal(loggedIn,true);assert.equal(req.headers()['x-reservation-csrf'],'synthetic-csrf');issued=true;issues++;return respond(code)}
  assert.notEqual(path,'activation-code');return respond({},403);
 });
 async function load(){await page.goto('https://www.lunakoru.com/');await page.evaluate(()=>document.getElementById('loader')?.remove());await page.addScriptTag({content:script});await page.evaluate(()=>window.LunaKoruReservation.init(document));await page.waitForFunction(()=>document.querySelectorAll('#reservationOpen').length===1)}
 await load();await page.locator('#reservationOpen').click();
 await page.locator('#reservationForm input[name=phone]').fill('13800138000');await page.locator('#reservationForm input[name=code]').fill('123456');
 await page.locator('#reservationSubmit').click();
 const claim=page.getByRole('button',{name:'领取',exact:true});
 await claim.waitFor();assert.equal(issues,0);
 await claim.click();
 await page.locator('#reservationCodeClaimList code').waitFor();assert.equal(await page.locator('#reservationCodeClaimList code').textContent(),'TEST-ONLY-CODE');assert.equal(issues,1);
 redeemed=true;ended=true;await load();await page.waitForFunction(()=>!document.getElementById('reservationLogout').hidden);await page.locator('#reservationOpen').click();
 await page.getByText('已兑换',{exact:true}).waitFor();assert.equal(await page.locator('#reservationCodeClaimList code').count(),1);assert.equal(issues,1);
});
