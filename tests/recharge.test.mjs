import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const recharge=require('../recharge/recharge.js');
const browserFixture=require('./recharge-browser-fixture.js');

function memoryStorage(initial={}){
  const values=new Map(Object.entries(initial));
  return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),values};
}

class FakeElement{
  constructor(id=''){this.id=id;this.hidden=false;this.disabled=false;this.value='';this.textContent='';this.className='';this.dataset={};this.children=[];this.listeners=new Map();this.attributes=new Map();this.open=false}
  addEventListener(type,listener){this.listeners.set(type,listener)}
  setAttribute(name,value){this.attributes.set(name,String(value))}
  querySelector(selector){return selector==='span'?this.noticeDetail||null:null}
  querySelectorAll(selector){return selector==='.tier-option'?this.children.filter(child=>String(child.className).includes('tier-option')):[]}
  replaceChildren(...children){this.children=children}
  append(...children){this.children.push(...children)}
  showModal(){this.open=true}
  close(){this.open=false}
}

function fakeRechargeDocument(){
  const ids=['accountNickname','accountUid','accountWorkspace','backToTiersButton','checkoutAccount','checkoutAmount','checkoutBar','checkoutButton',
    'configurationNotice','confirmationAmount','confirmationDialog','confirmationNickname','confirmationProduct','confirmationUid','environmentBadge','loginButton',
    'loginForm','loginPanel','moonSilkBalance','orderAccount','orderGlyph','orderHeading','orderLabel','orderMessage','orderNumber','orderPanel','orderProduct','orderSwitchAccountButton',
    'pageMessage','phone','refreshOrderButton','retryTiersButton','sendSmsButton','smsCode','startPaymentButton','switchAccountButton','tierList'];
  const elements=Object.fromEntries(ids.map(id=>[id,new FakeElement(id)]));
  elements.configurationNotice.noticeDetail=new FakeElement('configurationNoticeDetail');
  return {hidden:false,elements,getElementById:id=>elements[id]||null,createElement:tag=>new FakeElement(tag),addEventListener(){}};
}

function okResponse(data){return {ok:true,status:200,json:async()=>({result:0,data})}}

function deferred(){let resolve,reject;const promise=new Promise((onResolve,onReject)=>{resolve=onResolve;reject=onReject});return {promise,resolve,reject}}

async function waitFor(predicate,label){
  for(let attempt=0;attempt<100;attempt+=1){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,0))}
  assert.fail(`等待超时：${label}`);
}

async function withBrowserGlobals(storage,callback,locationOverride={}){
  const location={protocol:'http:',hostname:'127.0.0.1',port:'',assign(){assert.fail('测试不应打开支付地址')},...locationOverride};
  const replacements={location,sessionStorage:storage,addEventListener(){}};
  const descriptors=new Map(Object.keys(replacements).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value] of Object.entries(replacements))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  try{return await callback()}finally{
    for(const [key,descriptor] of descriptors)descriptor?Object.defineProperty(globalThis,key,descriptor):delete globalThis[key];
  }
}

function seedSessionAndPending(storage,{orderId='' }={}){
  const namespace=recharge.storageNamespace(recharge.LOOPBACK_API_BASE,'sandbox');
  const store=recharge.createSessionStore(storage,namespace);
  assert.equal(store.saveSession({userId:'900004',accessToken:'signed-v1-token',nickname:'本地合成账号'}),true);
  assert.equal(store.rememberPending('900004',{requestId:'request_1234567890',tierId:'recharge_6',orderId,createdAt:10}),true);
  return store;
}

test('默认页面为未配置安全态，支付控件不伪造可用',async()=>{
  const html=await readFile(new URL('../recharge/index.html',import.meta.url),'utf8');
  assert.match(html,/id="configurationNotice"/);
  assert.match(html,/id="phone"[\s\S]*disabled/);
  assert.match(html,/id="sendSmsButton"[\s\S]*disabled/);
  assert.match(html,/id="loginButton"[\s\S]*disabled/);
  assert.match(html,/id="checkoutButton"[\s\S]*disabled/);
  assert.match(html,/id="environmentBadge"[^>]*hidden/);
  assert.doesNotMatch(html,/cursor_stop|cursor_fly|cursor_trail/);
});

test('支付地址按环境固定支付宝 HTTPS 网关并拒绝串环境',()=>{
  const sandbox='https://openapi-sandbox.dl.alipaydev.com/gateway.do?method=alipay.trade.wap.pay';
  const production='https://openapi.alipay.com/gateway.do?method=alipay.trade.wap.pay';
  assert.equal(recharge.safePaymentUrl(sandbox,'sandbox'),sandbox);
  assert.equal(recharge.safePaymentUrl(production,'production'),production);
  assert.equal(recharge.safePaymentUrl(sandbox,'production'),'');
  assert.equal(recharge.safePaymentUrl(production,'sandbox'),'');
  assert.equal(recharge.safeSandboxPaymentUrl('http://openapi-sandbox.dl.alipaydev.com/gateway.do'),'');
  assert.equal(recharge.safeSandboxPaymentUrl('https://openapi-sandbox.dl.alipaydev.com.evil.test/gateway.do'),'');
  assert.equal(recharge.safeSandboxPaymentUrl('https://openapi-sandbox.dl.alipaydev.com/other'),'');
  assert.equal(recharge.safeSandboxPaymentUrl('https://openapi-sandbox.dl.alipaydev.com/gateway.do#unexpected'),'');
  assert.equal(recharge.safePaymentUrl('https://openapi.alipay.com:8443/gateway.do?method=alipay.trade.wap.pay','production'),'');
  assert.equal(recharge.safePaymentUrl('https://user@openapi.alipay.com/gateway.do?method=alipay.trade.wap.pay','production'),'');
  assert.equal(recharge.safePaymentUrl('https://openapi.alipay.com/gateway.do','production'),'');
  assert.equal(recharge.safePaymentUrl('https://openapi.alipay.com/gateway.do?method=alipay.trade.wap.pay&method=alipay.trade.wap.pay','production'),'');
  assert.equal(recharge.safeSandboxPaymentUrl('javascript:alert(1)'),'');
});

test('账号退出只清理令牌，同账号重登仍可恢复待确认 requestId',()=>{
  const storage=memoryStorage();
  const store=recharge.createSessionStore(storage);
  assert.equal(store.saveSession({userId:4,accessToken:'access-token'}),true);
  assert.equal(store.rememberPending(4,{requestId:'request_1234567890',tierId:'recharge_6',createdAt:10}),true);
  store.clearAccountSession();
  assert.equal(store.readSession(),null);
  assert.deepEqual(store.pendingFor(4),{requestId:'request_1234567890',tierId:'recharge_6',orderId:'',createdAt:10});
  assert.equal(store.pendingFor(5),null);
});

test('完成或关闭订单后可以只删除对应账号的待确认记录',()=>{
  const store=recharge.createSessionStore(memoryStorage());
  store.rememberPending(4,{requestId:'request_1234567890',tierId:'recharge_6'});
  store.rememberPending(5,{requestId:'request_0987654321',tierId:'recharge_30'});
  store.forgetPending(4);
  assert.equal(store.pendingFor(4),null);
  assert.equal(store.pendingFor(5).requestId,'request_0987654321');
});

test('账号 generation 会拒绝切换前返回的异步结果',()=>{
  const guard=recharge.createAccountGuard();
  guard.switchTo(4);
  const oldRequest=guard.capture();
  guard.switchTo(5);
  assert.equal(guard.accepts(oldRequest),false);
  assert.equal(guard.accepts(guard.capture()),true);
  guard.clear();
  assert.equal(guard.accepts({generation:2,userId:'5'}),false);
});

test('会话存储拒绝无效账号和过长 token，不保存 refresh token',()=>{
  const storage=memoryStorage();
  const store=recharge.createSessionStore(storage);
  assert.equal(store.saveSession({userId:'04',accessToken:'token'}),false);
  assert.equal(store.saveSession({userId:'4',accessToken:'x'.repeat(4097)}),false);
  assert.equal(store.saveSession({userId:'4',accessToken:'token',refreshToken:'must-not-persist'}),true);
  const raw=storage.getItem(store.keys.sessionKey);
  assert.doesNotMatch(raw,/refresh/i);
  assert.deepEqual(JSON.parse(raw),{userId:'4',accessToken:'token',nickname:''});
});

test('只有与页面绑定环境一致的服务端配置才解锁',()=>{
  assert.equal(recharge.isTrustedSandboxConfig({environment:'sandbox',available:true,loginAvailable:true}),true);
  assert.equal(recharge.isTrustedSandboxConfig({environment:'sandbox',available:false}),false);
  assert.equal(recharge.isTrustedSandboxConfig({environment:'production',available:true}),false);
  assert.equal(recharge.isTrustedSandboxConfig(null),false);
  assert.deepEqual(recharge.sandboxCapabilities({environment:'sandbox',available:false,loginAvailable:true}),
    {trusted:true,environment:'sandbox',loginAvailable:true,orderAvailable:false,reasonCode:''});
  assert.deepEqual(recharge.environmentCapabilities({environment:'production',available:false,loginAvailable:true,reasonCode:'PAYMENT_PRODUCT_PENDING'},'production'),
    {trusted:true,environment:'production',loginAvailable:true,orderAvailable:false,reasonCode:'PAYMENT_PRODUCT_PENDING'});
  assert.equal(recharge.environmentCapabilities({environment:'sandbox',available:true,loginAvailable:true},'production').trusted,false);
});

test('会话 key 按服务环境和 API 主机隔离',()=>{
  const localNamespace=recharge.storageNamespace('http://127.0.0.1:9000','sandbox');
  const testNamespace=recharge.storageNamespace('https://api.test.lunakoru.com','sandbox');
  const productionNamespace=recharge.storageNamespace(recharge.PRODUCTION_API_BASE,'production');
  assert.equal(localNamespace,'sandbox:127.0.0.1_9000');
  assert.notEqual(recharge.storageKeysFor(localNamespace).sessionKey,recharge.storageKeysFor(testNamespace).sessionKey);
  assert.notEqual(recharge.storageKeysFor(localNamespace).pendingKey,recharge.storageKeysFor(testNamespace).pendingKey);
  assert.notEqual(recharge.storageKeysFor(localNamespace).sessionKey,recharge.storageKeysFor(productionNamespace).sessionKey);
  assert.notEqual(recharge.storageKeysFor(localNamespace).pendingKey,recharge.storageKeysFor(productionNamespace).pendingKey);
});

test('订单状态只单调前进且终态不可被迟到响应覆盖',()=>{
  const tracker={rank:0,terminal:false};
  assert.equal(recharge.advanceOrderTracker(tracker,'created'),true);
  assert.equal(tracker.rank,1);
  assert.equal(recharge.advanceOrderTracker(tracker,'paid'),true);
  assert.equal(tracker.rank,2);
  assert.equal(recharge.advanceOrderTracker(tracker,'created'),false);
  assert.equal(tracker.rank,2);
  assert.equal(recharge.advanceOrderTracker(tracker,'fulfilled'),true);
  assert.equal(tracker.terminal,true);
  assert.equal(recharge.advanceOrderTracker(tracker,'closed'),false);
});

test('只把已知前置业务拒绝视为首次请求的确定失败',()=>{
  for(const code of [210001,210002,100003,100008])assert.equal(recharge.isDefinitiveFreshOrderRejection(new recharge.ApiError(code,'rejected')),true);
  assert.equal(recharge.isDefinitiveFreshOrderRejection(new recharge.ApiError(1,'mixed business error')),false);
  assert.equal(recharge.isDefinitiveFreshOrderRejection(new recharge.ApiError(0,'network unknown')),false);
});

test('实际页面在无效支付地址后查询到 fulfilled，不会被 catch 覆盖且会清除旧提示',async()=>{
  const storage=memoryStorage(),store=seedSessionAndPending(storage),doc=fakeRechargeDocument();
  let sawRejectedUrlMessage=false;
  await withBrowserGlobals(storage,async()=>{
    const fetchImpl=async(url,options={})=>{
      const path=new URL(url).pathname;
      if(path==='/api/web-recharge/config')return okResponse({environment:'sandbox',available:true,loginAvailable:true});
      if(path==='/api/web-recharge/orders'&&options.method==='POST')return okResponse({orderId:'WEB-SANDBOX-0001',paymentUrl:'https://openapi-sandbox.dl.alipaydev.com/not-a-gateway'});
      if(path==='/api/web-recharge/orders/WEB-SANDBOX-0001'){
        sawRejectedUrlMessage=/支付地址未通过/.test(doc.elements.pageMessage.textContent);
        return okResponse({orderId:'WEB-SANDBOX-0001',status:'fulfilled',productType:'recharge',productId:'recharge_6',channel:'alipay_wap_test',rmbPrice:600,wallet:{moonSilk:208}});
      }
      assert.fail(`未匹配的接口：${path}`);
    };
    recharge.init(doc,fetchImpl);
    await waitFor(()=>doc.elements.orderHeading.textContent==='充值已到账','页面显示 fulfilled');
  });
  assert.equal(sawRejectedUrlMessage,true);
  assert.equal(doc.elements.pageMessage.textContent,'');
  assert.equal(doc.elements.moonSilkBalance.textContent,'208');
  assert.equal(store.pendingFor('900004'),null);
});

test('实际页面停新单时仍用原 requestId 恢复无 orderId 的待确认订单',async()=>{
  const storage=memoryStorage(),store=seedSessionAndPending(storage),doc=fakeRechargeDocument();
  let replayBody=null;
  await withBrowserGlobals(storage,async()=>{
    const fetchImpl=async(url,options={})=>{
      const path=new URL(url).pathname;
      if(path==='/api/web-recharge/config')return okResponse({environment:'sandbox',available:false,loginAvailable:true});
      if(path==='/api/web-recharge/orders'&&options.method==='POST'){
        replayBody=JSON.parse(options.body);return okResponse({orderId:'WEB-SANDBOX-0001',paymentUrl:null});
      }
      if(path==='/api/web-recharge/orders/WEB-SANDBOX-0001')return okResponse({orderId:'WEB-SANDBOX-0001',status:'fulfilled',productType:'recharge',productId:'recharge_6',channel:'alipay_wap_test',rmbPrice:600,wallet:{moonSilk:208}});
      assert.fail(`未匹配的接口：${path}`);
    };
    recharge.init(doc,fetchImpl);
    await waitFor(()=>doc.elements.orderHeading.textContent==='充值已到账','停新单恢复 fulfilled');
  });
  assert.deepEqual(replayBody,{tierId:'recharge_6',clientRequestId:'request_1234567890'});
  assert.equal(store.pendingFor('900004'),null);
});

test('实际页面并发查单时迟到的 created 不会覆盖 fulfilled',async()=>{
  const storage=memoryStorage();seedSessionAndPending(storage,{orderId:'WEB-SANDBOX-0001'});const doc=fakeRechargeDocument();
  const orderResponses=[];
  await withBrowserGlobals(storage,async()=>{
    const fetchImpl=async url=>{
      const path=new URL(url).pathname;
      if(path==='/api/web-recharge/config')return okResponse({environment:'sandbox',available:true,loginAvailable:true});
      if(path==='/api/web-recharge/orders/WEB-SANDBOX-0001'){
        const response=deferred();orderResponses.push(response);return response.promise;
      }
      assert.fail(`未匹配的接口：${path}`);
    };
    const controller=recharge.init(doc,fetchImpl);
    await waitFor(()=>orderResponses.length===1,'首次查单发出');
    const latestQuery=controller.resumePending();
    await waitFor(()=>orderResponses.length===2,'并发查单发出');
    orderResponses[1].resolve(okResponse({orderId:'WEB-SANDBOX-0001',status:'fulfilled',productType:'recharge',productId:'recharge_6',channel:'alipay_wap_test',rmbPrice:600,wallet:{moonSilk:208}}));
    await latestQuery;
    assert.equal(doc.elements.orderHeading.textContent,'充值已到账');
    orderResponses[0].resolve(okResponse({orderId:'WEB-SANDBOX-0001',status:'created',productType:'recharge',productId:'recharge_6',channel:'alipay_wap_test',rmbPrice:600}));
    await waitFor(()=>controller.state.orderTracker.terminal===true,'订单 tracker 进入终态');
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(doc.elements.orderHeading.textContent,'充值已到账');
    assert.equal(doc.elements.moonSilkBalance.textContent,'208');
  });
});

test('实际页面首次请求被实名前置拒绝后清本次 pending 并返回档位',async()=>{
  const storage=memoryStorage(),doc=fakeRechargeDocument();
  const namespace=recharge.storageNamespace(recharge.LOOPBACK_API_BASE,'sandbox'),store=recharge.createSessionStore(storage,namespace);
  store.saveSession({userId:'900004',accessToken:'signed-v1-token',nickname:'本地合成账号'});
  await withBrowserGlobals(storage,async()=>{
    const fetchImpl=async(url,options={})=>{
      const path=new URL(url).pathname;
      if(path==='/api/web-recharge/config')return okResponse({environment:'sandbox',available:true,loginAvailable:true});
      if(path==='/api/mall/wallet')return okResponse({moonSilk:88});
      if(path==='/api/mall/recharge')return okResponse({tiers:[{tierId:'recharge_6',name:'轻盈一束',silkAmount:60,rmbPrice:600,firstRechargeBonus:60,firstRechargeTotal:120,firstRechargeAvailable:true,isBigTier:false}]});
      if(path==='/api/web-recharge/orders'&&options.method==='POST')return {ok:true,status:200,json:async()=>({result:210001,errorMsg:'请先完成实名认证'})};
      assert.fail(`未匹配的接口：${path}`);
    };
    recharge.init(doc,fetchImpl);
    await waitFor(()=>doc.elements.tierList.children.length===1,'档位加载');
    doc.elements.tierList.children[0].listeners.get('click')();
    doc.elements.checkoutButton.listeners.get('click')();
    doc.elements.startPaymentButton.listeners.get('click')();
    await waitFor(()=>/实名认证/.test(doc.elements.pageMessage.textContent),'实名拒绝提示');
  });
  assert.equal(store.pendingFor('900004'),null);
  assert.equal(doc.elements.orderPanel.hidden,true);
  assert.equal(doc.elements.accountWorkspace.hidden,false);
});

test('实际页面恢复旧请求时遇到实名拦截仍保留 pending 和切换账号入口',async()=>{
  const storage=memoryStorage(),store=seedSessionAndPending(storage),doc=fakeRechargeDocument();
  await withBrowserGlobals(storage,async()=>{
    const fetchImpl=async(url,options={})=>{
      const path=new URL(url).pathname;
      if(path==='/api/web-recharge/config')return okResponse({environment:'sandbox',available:false,loginAvailable:true});
      if(path==='/api/web-recharge/orders'&&options.method==='POST')return {ok:true,status:200,json:async()=>({result:210001,errorMsg:'请先完成实名认证'})};
      assert.fail(`未匹配的接口：${path}`);
    };
    recharge.init(doc,fetchImpl);
    await waitFor(()=>doc.elements.orderHeading.textContent==='订单创建结果待确认','旧请求保留为待确认');
  });
  assert.equal(store.pendingFor('900004').requestId,'request_1234567890');
  assert.equal(doc.elements.orderPanel.hidden,false);
  assert.equal(doc.elements.orderSwitchAccountButton.hidden,false);
  assert.match(doc.elements.pageMessage.textContent,/实名认证/);
});

test('正式环境审核等待时停止新付款但允许认证恢复旧订单',async()=>{
  const storage=memoryStorage(),doc=fakeRechargeDocument();
  const namespace=recharge.storageNamespace(recharge.PRODUCTION_API_BASE,'production');
  const store=recharge.createSessionStore(storage,namespace);
  store.saveSession({userId:'900004',accessToken:'production-token',nickname:'正式账号'});
  store.rememberPending('900004',{requestId:'request_production_01',tierId:'recharge_6',orderId:'WEB-PROD-0001',createdAt:10});
  const calls=[];
  await withBrowserGlobals(storage,async()=>{
    const fetchImpl=async(url,options={})=>{
      const path=new URL(url).pathname;calls.push({url,path,options});
      if(path==='/api/web-recharge/config')return okResponse({environment:'production',available:false,loginAvailable:true,reasonCode:'PAYMENT_PRODUCT_PENDING'});
      if(path==='/api/web-recharge/orders/WEB-PROD-0001')return okResponse({orderId:'WEB-PROD-0001',status:'fulfilled',productType:'recharge',productId:'recharge_6',channel:'alipay_wap',rmbPrice:600,wallet:{moonSilk:208}});
      assert.fail(`未匹配的接口：${path}`);
    };
    const controller=recharge.init(doc,fetchImpl);
    await waitFor(()=>doc.elements.orderHeading.textContent==='充值已到账','正式旧单恢复 fulfilled');
    assert.equal(controller.state.configured,false);
    assert.equal(controller.state.loginAvailable,false);
    assert.equal(controller.state.environment,'production');
    doc.elements.orderSwitchAccountButton.listeners.get('click')();
  },{protocol:'https:',hostname:'www.lunakoru.com',port:''});
  assert.equal(doc.elements.environmentBadge.textContent,'官网充值');
  assert.match(doc.elements.configurationNotice.noticeDetail.textContent,/账号验证暂未开放/);
  assert.equal(doc.elements.loginButton.disabled,true);
  assert.equal(store.pendingFor('900004'),null);
  assert.equal(calls.some(call=>call.path==='/api/mall/recharge'),false);
  assert.equal(calls.some(call=>call.path==='/api/web-recharge/orders'&&call.options.method==='POST'),false);
});

test('正式环境审核等待时不向首次访问者开放短信或登录',async()=>{
  const storage=memoryStorage(),doc=fakeRechargeDocument();
  const calls=[];
  await withBrowserGlobals(storage,async()=>{
    const controller=recharge.init(doc,async url=>{calls.push(new URL(url).pathname);return okResponse({environment:'production',available:false,loginAvailable:true,reasonCode:'PAYMENT_PRODUCT_PENDING'})});
    await waitFor(()=>calls.length===1,'读取正式配置');
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(controller.state.loginAvailable,false);
  },{protocol:'https:',hostname:'www.lunakoru.com',port:''});
  assert.deepEqual(calls,['/api/web-recharge/config']);
  assert.equal(doc.elements.phone.disabled,true);
  assert.equal(doc.elements.sendSmsButton.disabled,true);
  assert.equal(doc.elements.loginButton.disabled,true);
  assert.match(doc.elements.configurationNotice.noticeDetail.textContent,/账号验证暂未开放/);
});

test('审核等待态拒绝用其他 UID 的 pending 解锁当前登录账号',async()=>{
  const storage=memoryStorage(),doc=fakeRechargeDocument();
  const store=recharge.createSessionStore(storage,recharge.storageNamespace(recharge.PRODUCTION_API_BASE,'production'));
  store.saveSession({userId:'900005',accessToken:'stale-other-token',nickname:'另一个账号'});
  store.rememberPending('900004',{requestId:'request_production_01',tierId:'recharge_6',orderId:'WEB-PROD-0001'});
  const calls=[];
  await withBrowserGlobals(storage,async()=>{
    const fetchImpl=async(url,options={})=>{
      const path=new URL(url).pathname;calls.push(path);
      if(path==='/api/web-recharge/config')return okResponse({environment:'production',available:false,loginAvailable:true,reasonCode:'PAYMENT_PRODUCT_PENDING'});
      if(path==='/api/users/login-existing')return okResponse({user:{id:'900005',nickname:'另一个账号'},accessToken:'other-user-token'});
      assert.fail(`未匹配的接口：${path}`);
    };
    const controller=recharge.init(doc,fetchImpl);
    await waitFor(()=>doc.elements.loginButton.disabled===false,'pending 打开恢复登录');
    assert.equal(store.readSession(),null);
    doc.elements.phone.value='13800138000';doc.elements.smsCode.value='666666';
    await doc.elements.loginForm.listeners.get('submit')({preventDefault(){}});
    assert.equal(controller.state.session,null);
    assert.equal(controller.state.loginAvailable,true);
  },{protocol:'https:',hostname:'www.lunakoru.com',port:''});
  assert.equal(store.readSession(),null);
  assert.equal(store.pendingFor('900004').orderId,'WEB-PROD-0001');
  assert.match(doc.elements.pageMessage.textContent,/当前账号没有可恢复/);
  assert.equal(calls.includes('/api/mall/wallet'),false);
  assert.equal(calls.includes('/api/mall/recharge'),false);
  assert.equal(calls.includes('/api/web-recharge/orders'),false);
});

test('审核等待态允许同 UID 重新认证并恢复原订单',async()=>{
  const storage=memoryStorage(),doc=fakeRechargeDocument();
  const store=recharge.createSessionStore(storage,recharge.storageNamespace(recharge.PRODUCTION_API_BASE,'production'));
  store.rememberPending('900004',{requestId:'request_production_01',tierId:'recharge_6',orderId:'WEB-PROD-0001'});
  const calls=[];
  await withBrowserGlobals(storage,async()=>{
    const fetchImpl=async(url,options={})=>{
      const path=new URL(url).pathname;calls.push(path);
      if(path==='/api/web-recharge/config')return okResponse({environment:'production',available:false,loginAvailable:true,reasonCode:'PAYMENT_PRODUCT_PENDING'});
      if(path==='/api/users/login-existing')return okResponse({user:{id:'900004',nickname:'原账号'},accessToken:'owner-token'});
      if(path==='/api/web-recharge/orders/WEB-PROD-0001')return okResponse({orderId:'WEB-PROD-0001',status:'created',productType:'recharge',productId:'recharge_6',channel:'alipay_wap',rmbPrice:600});
      assert.fail(`未匹配的接口：${path}`);
    };
    const controller=recharge.init(doc,fetchImpl);
    await waitFor(()=>doc.elements.loginButton.disabled===false,'pending 打开恢复登录');
    doc.elements.phone.value='13800138000';doc.elements.smsCode.value='666666';
    await doc.elements.loginForm.listeners.get('submit')({preventDefault(){}});
    await waitFor(()=>doc.elements.orderHeading.textContent==='正在等待服务端确认到账','同 UID 恢复原订单');
    assert.equal(controller.state.session.userId,'900004');
    doc.elements.orderSwitchAccountButton.listeners.get('click')();
  },{protocol:'https:',hostname:'www.lunakoru.com',port:''});
  assert.equal(calls.includes('/api/web-recharge/orders/WEB-PROD-0001'),true);
  assert.equal(calls.includes('/api/mall/wallet'),false);
  assert.equal(calls.includes('/api/mall/recharge'),false);
  assert.equal(store.pendingFor('900004').orderId,'WEB-PROD-0001');
});

test('正式页面拒绝 sandbox 配置且不会使用已存会话访问业务接口',async()=>{
  const storage=memoryStorage(),doc=fakeRechargeDocument();
  const store=recharge.createSessionStore(storage,recharge.storageNamespace(recharge.PRODUCTION_API_BASE,'production'));
  store.saveSession({userId:'900004',accessToken:'production-token',nickname:'正式账号'});
  store.rememberPending('900004',{requestId:'request_production_01',tierId:'recharge_6',orderId:'WEB-PROD-0001'});
  const calls=[];
  await withBrowserGlobals(storage,async()=>{
    const controller=recharge.init(doc,async url=>{calls.push(url);return okResponse({environment:'sandbox',available:true,loginAvailable:true})});
    await waitFor(()=>calls.length===1,'仅请求配置');
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.equal(controller.state.environmentTrusted,false);
  },{protocol:'https:',hostname:'www.lunakoru.com',port:''});
  assert.equal(calls.length,1);
  assert.equal(doc.elements.loginButton.disabled,true);
  assert.match(doc.elements.configurationNotice.noticeDetail.textContent,/可信配置/);
});

test('正式订单必须返回正式 channel，sandbox channel 不会被当成到账',async()=>{
  const storage=memoryStorage(),doc=fakeRechargeDocument();
  const store=recharge.createSessionStore(storage,recharge.storageNamespace(recharge.PRODUCTION_API_BASE,'production'));
  store.saveSession({userId:'900004',accessToken:'production-token',nickname:'正式账号'});
  store.rememberPending('900004',{requestId:'request_production_01',tierId:'recharge_6',orderId:'WEB-PROD-0001'});
  await withBrowserGlobals(storage,async()=>{
    const fetchImpl=async url=>{
      const path=new URL(url).pathname;
      if(path==='/api/web-recharge/config')return okResponse({environment:'production',available:false,loginAvailable:true});
      if(path==='/api/web-recharge/orders/WEB-PROD-0001')return okResponse({orderId:'WEB-PROD-0001',status:'fulfilled',productType:'recharge',productId:'recharge_6',channel:'alipay_wap_test',rmbPrice:600,wallet:{moonSilk:999}});
      assert.fail(`未匹配的接口：${path}`);
    };
    recharge.init(doc,fetchImpl);
    await waitFor(()=>doc.elements.orderHeading.textContent==='暂未取得最新订单状态','正式订单拒绝 sandbox channel');
    doc.elements.orderSwitchAccountButton.listeners.get('click')();
  },{protocol:'https:',hostname:'www.lunakoru.com',port:''});
  assert.notEqual(doc.elements.orderHeading.textContent,'充值已到账');
  assert.equal(doc.elements.moonSilkBalance.textContent,'—');
  assert.equal(store.pendingFor('900004').orderId,'WEB-PROD-0001');
});

test('API 契约固定本机测试基址、表单字段和 Bearer 请求',async()=>{
  const calls=[];
  const fetchImpl=async(url,options)=>{
    calls.push({url,options});
    return {ok:true,status:200,json:async()=>({result:0,data:{}})};
  };
  const api=recharge.createApiClient(fetchImpl,recharge.LOOPBACK_API_BASE);
  await api.getConfig();
  await api.sendSms('13800138000');
  await api.loginExisting('13800138000','666666');
  await api.getWallet('access-token');
  await api.getRecharge('access-token');
  await api.createOrder('access-token','recharge_6','request_1234567890');
  await api.getOrder('access-token','WEB/ORDER 1');

  assert.equal(recharge.LOOPBACK_API_BASE,'http://127.0.0.1:9000');
  assert.equal(recharge.resolveApiBase({protocol:'https:',hostname:'www.lunakoru.com',port:''}),recharge.PRODUCTION_API_BASE);
  assert.equal(recharge.resolveApiBase({protocol:'http:',hostname:'127.0.0.1'}),'http://127.0.0.1:9000');
  assert.deepEqual(calls.map(call=>call.url),[
    'http://127.0.0.1:9000/api/web-recharge/config',
    'http://127.0.0.1:9000/api/users/send/sms/code',
    'http://127.0.0.1:9000/api/users/login-existing',
    'http://127.0.0.1:9000/api/mall/wallet',
    'http://127.0.0.1:9000/api/mall/recharge',
    'http://127.0.0.1:9000/api/web-recharge/orders',
    'http://127.0.0.1:9000/api/web-recharge/orders/WEB%2FORDER%201'
  ]);
  assert.equal(calls[1].options.body,'countryCode=86&phoneNumber=13800138000');
  assert.equal(calls[2].options.body,'countryCode=86&phoneNumber=13800138000&smsCode=666666');
  assert.equal(calls[2].options.headers['X-App-Market'],'CN');
  assert.equal(calls[3].options.headers.Authorization,'Bearer access-token');
  assert.equal(calls[5].options.credentials,'omit');
  assert.equal(calls[5].options.redirect,'error');
  assert.deepEqual(JSON.parse(calls[5].options.body),{tierId:'recharge_6',clientRequestId:'request_1234567890'});
});

test('正式 API 地址复用官网既有生产入口且页面来源不能覆盖',async()=>{
  const [reservation,preview]=await Promise.all([
    readFile(new URL('../reservation.js',import.meta.url),'utf8'),
    readFile(new URL('../preview_server.py',import.meta.url),'utf8')
  ]);
  assert.match(reservation,new RegExp(recharge.PRODUCTION_API_BASE.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(preview,new RegExp(recharge.PRODUCTION_API_BASE.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.deepEqual(recharge.resolveDeploymentTarget({protocol:'https:',hostname:'www.lunakoru.com',port:''}),
    {apiBase:recharge.PRODUCTION_API_BASE,environment:'production',channel:'alipay_wap'});
  for(const location of [
    {protocol:'http:',hostname:'www.lunakoru.com',port:''},
    {protocol:'https:',hostname:'lunakoru.com.evil.test',port:''},
    {protocol:'https:',hostname:'www.lunakoru.com',port:'8443'},
    {protocol:'https:',hostname:'xinqi-tech.github.io',port:''}
  ])assert.equal(recharge.resolveDeploymentTarget(location),null);
  assert.throws(()=>recharge.createApiClient(async()=>okResponse({}),'https://evil.test'),/trusted api base/);
});

test('统一错误信封保留业务错误码，合规错误给出回游戏指引',async()=>{
  const api=recharge.createApiClient(async()=>({ok:true,status:200,json:async()=>({result:210001,errorMsg:'请先完成实名认证'})}),recharge.LOOPBACK_API_BASE);
  await assert.rejects(api.createOrder('token','recharge_6','request_1234567890'),error=>{
    assert.equal(error.code,210001);
    assert.match(recharge.userFacingError(error),/回到游戏内完成实名认证/);
    return true;
  });
  assert.match(recharge.userFacingError(new recharge.ApiError(210002,'minor')),/未成年人暂不能充值/);
});

test('前端不从 query 或 localStorage 覆盖 API 和支付配置',async()=>{
  const js=await readFile(new URL('../recharge/recharge.js',import.meta.url),'utf8');
  assert.doesNotMatch(js,/location\.search|URLSearchParams\(root\.location|localStorage/);
  assert.match(js,/const DEPLOYED_TEST_API_BASE=''/);
  assert.match(js,/const DEPLOYED_TEST_SITE_HOST=''/);
  assert.doesNotMatch(js,/const DEFAULT_API_BASE='http:\/\/127\.0\.0\.1:9000'/);
  assert.match(js,/sandbox:Object\.freeze\(\{channel:'alipay_wap_test'/);
  assert.match(js,/production:Object\.freeze\(\{channel:'alipay_wap'/);
  assert.equal(recharge.formatFen(null),'—');
});

test('浏览器夹具覆盖真实契约且不会连接云端',async()=>{
  const fetchFixture=browserFixture.createRechargeFetchFixture();
  const config=await (await fetchFixture('http://127.0.0.1:9000/api/web-recharge/config')).json();
  const tiers=await (await fetchFixture('http://127.0.0.1:9000/api/mall/recharge',{headers:{Authorization:'Bearer fixture-access-token'}})).json();
  assert.deepEqual(config.data,{environment:'sandbox',available:true,loginAvailable:true});
  assert.equal(tiers.data.tiers[0].rmbPrice,600);
  const storage=memoryStorage();browserFixture.seedPending(storage);
  assert.equal(JSON.parse(storage.getItem(browserFixture.PENDING_KEY))['900004'].orderId,'WEB-SANDBOX-0001');
  assert.equal(fetchFixture.calls.length,2);
});

test('测试预览服务只监听 loopback，生产页不加载夹具',async()=>{
  const [server,html]=await Promise.all([
    readFile(new URL('./recharge-preview-server.mjs',import.meta.url),'utf8'),
    readFile(new URL('../recharge/index.html',import.meta.url),'utf8')
  ]);
  assert.match(server,/server\.listen\(parsedPort,'127\.0\.0\.1'/);
  assert.match(server,/pathname==='\/fixture\/pending\/'/);
  assert.match(server,/pathname==='\/fixture\/mobile\/'/);
  assert.match(server,/本地合成数据 · 非真实沙箱付款/);
  assert.match(server,/width:390px;height:844px/);
  assert.doesNotMatch(html,/recharge-browser-fixture|fixture\/install/);
  assert.doesNotMatch(html,/本地合成数据|非真实沙箱付款/);
});
