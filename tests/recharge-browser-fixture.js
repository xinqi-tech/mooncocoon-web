/**
 * @fileoverview 官网充值页浏览器验收用的内存 fetch 夹具，只能由测试主动注入。
 *
 * AI Context
 * -----------
 * 关联文件:
 * - 被测: recharge/index.html、recharge/recharge.js
 * - 使用方: 浏览器 initScript 或 DevTools evaluate；生产 HTML 不加载本文件
 *
 * 核心概念:
 * - installRechargeBrowserFixture — 替换测试页面的 fetch，不连接云端、短信或支付宝
 * - seedPending — 写入同源 sessionStorage，直接覆盖订单恢复和 fulfilled 到账界面
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.RechargeBrowserFixture=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const STORAGE_NAMESPACE='sandbox:127.0.0.1_9000';
  const SESSION_KEY=`lunakoru.recharge.session.v1:${STORAGE_NAMESPACE}`;
  const PENDING_KEY=`lunakoru.recharge.pending.v1:${STORAGE_NAMESPACE}`;
  const EXCHANGE_CREDENTIAL=`wrx1.${'e'.repeat(60)}`;
  const RESUME_CREDENTIAL=`wr1.${'r'.repeat(60)}`;

  function response(data,result=0,errorMsg=''){
    return Promise.resolve({ok:true,status:200,json:async()=>({result,errorMsg,data})});
  }

  function createRechargeFetchFixture(options={}){
    const calls=[];
    let orderReads=0;
    const statusSequence=Array.isArray(options.statusSequence)&&options.statusSequence.length?options.statusSequence:['created','paid','fulfilled'];
    const user={id:900004,nickname:'本地合成账号'};
    const orderId='WEB-SANDBOX-0001';
    const fixture=async(url,request={})=>{
      const parsed=new URL(url),path=parsed.pathname;calls.push({path,request});
      if(path==='/api/web-recharge/config')return response({environment:'sandbox',available:true,loginAvailable:true});
      if(path==='/api/users/send/sms/code')return response({success:true});
      if(path==='/api/users/login-existing')return response({user,newUser:false,accessToken:'fixture-access-token',resumeExchangeCredential:EXCHANGE_CREDENTIAL,refreshToken:'fixture-must-be-ignored'});
      if(path==='/api/web-recharge/resume')return response({resumeCredential:RESUME_CREDENTIAL});
      if(path==='/api/mall/wallet')return response({moonCocoon:120,moonSilk:88,energy:9,energyExact:'9'});
      if(path==='/api/mall/recharge')return response({tiers:[
        {tierId:'recharge_6',name:'轻盈一束',silkAmount:60,rmbPrice:600,firstRechargeBonus:60,firstRechargeTotal:120,firstRechargeAvailable:true,isBigTier:false},
        {tierId:'recharge_30',name:'月下相逢',silkAmount:300,rmbPrice:3000,firstRechargeBonus:300,firstRechargeTotal:600,firstRechargeAvailable:true,isBigTier:false},
        {tierId:'recharge_68',name:'长夜相伴',silkAmount:680,rmbPrice:6800,firstRechargeBonus:680,firstRechargeTotal:1360,firstRechargeAvailable:true,isBigTier:true}
      ]});
      if(path==='/api/web-recharge/orders'&&request.method==='POST')return response({orderId,paymentUrl:'https://openapi-sandbox.dl.alipaydev.com/not-a-gateway',resumeCredential:RESUME_CREDENTIAL});
      if(path===`/api/web-recharge/orders/${orderId}`){
        const status=statusSequence[Math.min(orderReads++,statusSequence.length-1)];
        return response({orderId,status,productType:'recharge',productId:'recharge_6',channel:'alipay_wap_test',rmbPrice:600,
          paidAt:status==='created'?null:'2026-10-21T12:00:00Z',fulfilledAt:status==='fulfilled'?'2026-10-21T12:00:02Z':null,
          wallet:status==='fulfilled'?{moonCocoon:120,moonSilk:208,energy:9,energyExact:'9'}:null});
      }
      return response(null,404001,'测试夹具没有匹配该接口');
    };
    fixture.calls=calls;
    return fixture;
  }

  function seedPending(storage){
    storage.setItem(SESSION_KEY,JSON.stringify({userId:'900004',accessToken:'fixture-access-token',nickname:'本地合成账号'}));
    storage.setItem(PENDING_KEY,JSON.stringify({'900004':{requestId:'123e4567-e89b-42d3-a456-426614174000',tierId:'recharge_6',orderId:'WEB-SANDBOX-0001',createdAt:Date.now()}}));
  }

  function installRechargeBrowserFixture(target,options={}){
    const fetchFixture=createRechargeFetchFixture(options);target.fetch=fetchFixture;
    if(options.seedPending)seedPending(target.sessionStorage);
    target.__rechargeFixtureCalls=fetchFixture.calls;
    return fetchFixture;
  }

  return {createRechargeFetchFixture,seedPending,installRechargeBrowserFixture,SESSION_KEY,PENDING_KEY};
});
