import {test} from 'node:test';
import {request} from 'node:http';
import assert from 'node:assert/strict';
import {createRedeemPreviewServer,TEST_API} from './redeem-preview-server.mjs';
import {randomBytes,randomInt} from 'node:crypto';
const check=(value,message)=>assert.ok(Boolean(value),message);
async function fixture(t,opts){const server=createRedeemPreviewServer(opts);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));return `http://127.0.0.1:${server.address().port}`}
const sample=()=>({countryCode:'+'+(80+6),phoneNumber:String(13)+String(randomInt(100000000,999999999)),code:randomBytes(6).toString('hex').toUpperCase()});
test('preview is visibly synthetic and only serves a static allowlist',async t=>{
 const origin=await fixture(t,{});const html=await (await fetch(origin+'/redeem/')).text();
 check(html.includes('mockBanner'),'visible mock environment');
 for(const path of ['/README.md','/tests/redeem-preview-server.mjs','/.git/config','/reservation.js','/index.html'])check((await fetch(origin+path)).status===404,'private files unavailable');
 const status=await new Promise((resolve,reject)=>{const req=request(origin+'/redeem/',{headers:{Host:'untrusted.example'}},res=>{res.resume();resolve(res.statusCode)});req.on('error',reject);req.end()});
 check(status===403,'host boundary');
});
test('preview writes require same origin and exact allowlisted requests',async t=>{
 let called=0;const origin=await fixture(t,{test:true,fetchImpl:async(url,options)=>{called++;check(url===TEST_API+'/api/redeem-code/web-redeem','fixed test upstream');check(!('cookie' in options.headers)&&!('authorization' in options.headers),'no client credentials forwarded');return new Response(JSON.stringify({result:0,errorMsg:'',data:{rewardItems:[]}}),{status:200})}});
 const payload=sample();const request=(path,headers,body=payload)=>fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 check((await request('/api/redeem-code/web-redeem',{})).status===403,'missing origin blocked');
 check((await request('/api/redeem-code/web-redeem',{Origin:'https://untrusted.example'})).status===403,'cross site blocked');
 check((await request('/api/admin/redeem/bundles',{Origin:origin})).status===404,'admin path blocked');
 check(called===0,'blocked writes not proxied');
 check((await request('/api/redeem-code/web-redeem',{Origin:origin})).status===200&&called===1,'explicit test proxy');
 const html=await (await fetch(origin+'/redeem/')).text();check(html.includes('testBanner'),'visible test environment');
});
test('oversized input is rejected without proxying or exposing data',async t=>{
 let called=0;const origin=await fixture(t,{test:true,fetchImpl:async()=>{called++;throw Error('must not forward')}});
 const response=await fetch(origin+'/api/redeem-code/web-redeem',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({text:'x'.repeat(9000)})});
 check(response.status===413&&called===0,'size boundary');
});
