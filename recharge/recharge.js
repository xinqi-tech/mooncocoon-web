/**
 * @fileoverview 月光茧独立官网充值页的沙箱鉴权、订单与支付状态机。
 *
 * AI Context
 * -----------
 * 关联文件:
 * - 上游: recharge/index.html — 账号、档位、确认与订单状态界面
 * - 下游: Aildo-JAVA /api/web-recharge、/api/users、/api/mall — 可信配置与业务真源
 * - 测试: tests/recharge.test.mjs — API 契约、URL 边界、会话清理和异步账号隔离
 *
 * 核心概念:
 * - fail-closed — environment 必须为 sandbox；loginAvailable 只开放账号恢复，available 才开放新付款
 * - pending record — 提交前保存 requestId；网络丢响应后仍用同一 requestId 恢复
 * - generation — 切换账号后使旧异步响应失效，避免串号渲染
 * - fulfilled — 唯一可展示到账成功的服务端订单状态，浏览器回跳不作为成功证据
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.LunaKoruRecharge=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';

  const LOOPBACK_API_BASE='http://127.0.0.1:9000';
  // 测试站发布时由受控构建替换为固定 HTTPS test API；空值确保静态生产页面 fail-closed。
  const DEPLOYED_TEST_API_BASE='';
  const SESSION_KEY_PREFIX='lunakoru.recharge.session.v1';
  const PENDING_KEY_PREFIX='lunakoru.recharge.pending.v1';
  const SANDBOX_GATEWAY_HOST='openapi-sandbox.dl.alipaydev.com';
  const EXPECTED_CHANNEL='alipay_wap_test';
  const APP_MARKET='CN';
  const ORDER_POLL_DELAY=3000;
  const ORDER_POLL_LIMIT=30;

  class ApiError extends Error{
    constructor(code,message,httpStatus){super(message||'请求失败');this.name='ApiError';this.code=Number(code)||0;this.httpStatus=Number(httpStatus)||0}
  }

  const validPhone=value=>/^1[3-9]\d{9}$/.test(String(value||''));
  const validSmsCode=value=>/^\d{6}$/.test(String(value||''));

  function safeSandboxPaymentUrl(value){
    try{
      const url=new URL(String(value||''));
      if(url.protocol!=='https:'||url.hostname!==SANDBOX_GATEWAY_HOST||url.port||url.username||url.password||url.hash)return '';
      if(url.pathname!=='/gateway.do')return '';
      return url.href;
    }catch(_){return ''}
  }

  function normalizeUserId(value){
    const normalized=String(value==null?'':value).trim();
    return /^[1-9]\d{0,18}$/.test(normalized)?normalized:'';
  }

  function normalizeRequestId(value){
    const normalized=String(value||'').trim();
    return /^[a-zA-Z0-9_-]{16,80}$/.test(normalized)?normalized:'';
  }

  function safeText(value,maxLength=80){return String(value==null?'':value).trim().slice(0,maxLength)}
  function finiteNonNegative(value){
    if(value===null||value===undefined||value===''||typeof value==='boolean')return null;
    const number=Number(value);return Number.isFinite(number)&&number>=0?number:null;
  }
  function formatNumber(value){const number=finiteNonNegative(value);return number===null?'—':Math.trunc(number).toLocaleString('zh-CN')}
  function formatFen(value){const fen=finiteNonNegative(value);return fen===null?'—':`¥${(fen/100).toFixed(fen%100===0?0:2)}`}

  function orderStatusRank(status){
    if(status==='created')return 1;
    if(status==='paid')return 2;
    if(status==='fulfilled'||['cancelled','failed','closed'].includes(status))return 3;
    return 0;
  }

  function advanceOrderTracker(tracker,status){
    if(!tracker||tracker.terminal)return false;
    const rank=orderStatusRank(status),isTerminal=rank===3;
    if(rank<tracker.rank||(rank===0&&tracker.rank>0))return false;
    tracker.rank=rank;if(isTerminal)tracker.terminal=true;return true;
  }

  function newRequestId(cryptoImpl){
    const source=cryptoImpl||(root&&root.crypto);
    if(source&&typeof source.randomUUID==='function')return source.randomUUID();
    if(source&&typeof source.getRandomValues==='function'){
      const bytes=new Uint8Array(16);source.getRandomValues(bytes);
      return Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
    }
    throw new Error('当前浏览器无法安全创建订单请求，请更新浏览器后重试');
  }

  function parseJson(value,fallback){try{return value?JSON.parse(value):fallback}catch(_){return fallback}}

  function storageNamespace(apiBase,environment='sandbox'){
    try{
      const url=new URL(apiBase),safeEnvironment=safeText(environment,20).toLowerCase();
      if(!safeEnvironment||!url.host)return '';
      return `${safeEnvironment}:${url.host.toLowerCase().replace(/[^a-z0-9.-]/g,'_')}`;
    }catch(_){return ''}
  }

  function storageKeysFor(namespace){
    const safeNamespace=/^[a-z0-9_.:-]{3,120}$/.test(namespace||'')?namespace:'sandbox:unit-test';
    return {sessionKey:`${SESSION_KEY_PREFIX}:${safeNamespace}`,pendingKey:`${PENDING_KEY_PREFIX}:${safeNamespace}`};
  }

  function createSessionStore(storage,namespace){
    const {sessionKey,pendingKey}=storageKeysFor(namespace);
    const read=key=>{try{return storage.getItem(key)}catch(_){return null}};
    const write=(key,value)=>{try{storage.setItem(key,value);return true}catch(_){return false}};
    const remove=key=>{try{storage.removeItem(key)}catch(_){}};
    const readPendingMap=()=>{
      const parsed=parseJson(read(pendingKey),{});
      return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};
    };
    return {
      saveSession(session){
        const userId=normalizeUserId(session&&session.userId);
        const accessToken=String(session&&session.accessToken||'');
        const nickname=safeText(session&&session.nickname,80);
        if(!userId||!accessToken||accessToken.length>4096)return false;
        return write(sessionKey,JSON.stringify({userId,accessToken,nickname}));
      },
      readSession(){
        const session=parseJson(read(sessionKey),null);
        const userId=normalizeUserId(session&&session.userId);
        const accessToken=String(session&&session.accessToken||'');
        if(!userId||!accessToken||accessToken.length>4096)return null;
        return {userId,accessToken,nickname:safeText(session&&session.nickname,80)};
      },
      clearAccountSession(){remove(sessionKey)},
      rememberPending(userId,pending){
        const owner=normalizeUserId(userId),requestId=normalizeRequestId(pending&&pending.requestId);
        const tierId=safeText(pending&&pending.tierId,80);
        if(!owner||!requestId||!tierId)return false;
        const current=readPendingMap();
        current[owner]={requestId,tierId,orderId:safeText(pending.orderId,80),createdAt:Number(pending.createdAt)||Date.now()};
        const entries=Object.entries(current).sort((a,b)=>Number(b[1].createdAt)-Number(a[1].createdAt)).slice(0,5);
        return write(pendingKey,JSON.stringify(Object.fromEntries(entries)));
      },
      pendingFor(userId){
        const owner=normalizeUserId(userId),pending=readPendingMap()[owner];
        if(!owner||!pending||!normalizeRequestId(pending.requestId)||!safeText(pending.tierId,80))return null;
        return {requestId:pending.requestId,tierId:safeText(pending.tierId,80),orderId:safeText(pending.orderId,80),createdAt:Number(pending.createdAt)||0};
      },
      forgetPending(userId){
        const owner=normalizeUserId(userId);if(!owner)return;
        const current=readPendingMap();delete current[owner];
        Object.keys(current).length?write(pendingKey,JSON.stringify(current)):remove(pendingKey);
      },
      keys:{sessionKey,pendingKey}
    };
  }

  function createAccountGuard(){
    let generation=0,userId='';
    return {
      switchTo(nextUserId){userId=normalizeUserId(nextUserId);generation+=1;return {generation,userId}},
      clear(){userId='';generation+=1;return generation},
      capture(){return {generation,userId}},
      accepts(snapshot){return !!snapshot&&snapshot.generation===generation&&snapshot.userId===userId}
    };
  }

  function resolveApiBase(locationLike){
    if(DEPLOYED_TEST_API_BASE){
      try{const configured=new URL(DEPLOYED_TEST_API_BASE);if(configured.protocol==='https:'&&!configured.username&&!configured.password&&!configured.search&&!configured.hash)return configured.origin}
      catch(_){}
    }
    const protocol=locationLike&&locationLike.protocol,hostname=locationLike&&locationLike.hostname;
    return protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(hostname)?LOOPBACK_API_BASE:'';
  }

  function createApiClient(fetchImpl,apiBase){
    if(typeof fetchImpl!=='function')throw new TypeError('fetch is required');
    const allowedBases=[LOOPBACK_API_BASE,DEPLOYED_TEST_API_BASE].filter(Boolean);
    if(!allowedBases.includes(apiBase))throw new TypeError('trusted test api base is required');
    async function request(path,options={}){
      if(!/^\/api\/[a-zA-Z0-9_%?&=\-./{}]+$/.test(path)||path.includes('{'))throw new Error('非法接口路径');
      const method=options.method||'GET',headers={'Accept':'application/json','Accept-Language':'zh-CN','X-App-Market':APP_MARKET};
      let body;
      if(options.form){headers['Content-Type']='application/x-www-form-urlencoded;charset=UTF-8';body=new URLSearchParams(options.form).toString()}
      else if(options.body!==undefined){headers['Content-Type']='application/json';body=JSON.stringify(options.body)}
      if(options.accessToken)headers.Authorization=`Bearer ${options.accessToken}`;
      let response;
      try{response=await fetchImpl(apiBase+path,{method,headers,body,credentials:'omit',cache:'no-store',redirect:'follow'})}
      catch(_){throw new ApiError(0,'网络连接失败，请稍后重试')}
      let envelope;
      try{envelope=await response.json()}catch(_){throw new ApiError(0,'服务响应无法识别',response.status)}
      if(!response.ok||!envelope||envelope.result!==0)throw new ApiError(envelope&&envelope.result,envelope&&envelope.errorMsg||'请求失败',response.status);
      return envelope.data;
    }
    return {
      getConfig:()=>request('/api/web-recharge/config'),
      sendSms:phone=>request('/api/users/send/sms/code',{method:'POST',form:{countryCode:'86',phoneNumber:phone}}),
      loginExisting:(phone,code)=>request('/api/users/login-existing',{method:'POST',form:{countryCode:'86',phoneNumber:phone,smsCode:code}}),
      getWallet:token=>request('/api/mall/wallet',{accessToken:token}),
      getRecharge:token=>request('/api/mall/recharge',{accessToken:token}),
      createOrder:(token,tierId,clientRequestId)=>request('/api/web-recharge/orders',{method:'POST',accessToken:token,body:{tierId,clientRequestId}}),
      getOrder:(token,orderId)=>request(`/api/web-recharge/orders/${encodeURIComponent(orderId)}`,{accessToken:token})
    };
  }

  function userFacingError(error){
    if(error&&error.code===210001)return '请先回到游戏内完成实名认证，再返回这里重试充值。';
    if(error&&error.code===210002)return '根据相关规定，未成年人暂不能充值。';
    if(error&&error.code===100002)return '登录已过期，请重新验证手机号。';
    const text=safeText(error&&error.message,120);
    return text||'请求失败，请稍后重试。';
  }

  function isDefinitiveFreshOrderRejection(error){
    return !!error&&[210001,210002,100003,100008].includes(Number(error.code));
  }

  function sandboxCapabilities(config){
    const trusted=!!config&&config.environment==='sandbox';
    return {trusted,loginAvailable:trusted&&config.loginAvailable===true,orderAvailable:trusted&&config.available===true};
  }

  function isTrustedSandboxConfig(config){const capabilities=sandboxCapabilities(config);return capabilities.trusted&&capabilities.orderAvailable}

  function lockPage(doc,message){
    for(const id of ['phone','smsCode','sendSmsButton','loginButton']){const node=doc.getElementById(id);if(node)node.disabled=true}
    const notice=doc.getElementById('configurationNotice');
    if(notice){notice.hidden=false;const detail=notice.querySelector('span');if(detail&&message)detail.textContent=message}
    const badge=doc.getElementById('environmentBadge');if(badge)badge.hidden=true;
  }

  function init(doc,fetchImpl){
    if(!doc||!doc.getElementById('loginForm'))return null;
    const fetcher=fetchImpl||(root.fetch&&root.fetch.bind(root));
    if(!fetcher){lockPage(doc,'当前浏览器无法连接充值服务。');return null}
    const apiBase=resolveApiBase(root.location);
    if(!apiBase){lockPage(doc,'当前页面未配置可信测试服务，登录、短信和付款均不可用。');return {configured:false}}
    const api=createApiClient(fetcher,apiBase);
    const store=createSessionStore(root.sessionStorage,storageNamespace(apiBase,'sandbox')),guard=createAccountGuard();
    const el=id=>doc.getElementById(id);
    const state={configured:false,loginAvailable:false,environmentTrusted:false,session:null,tiers:[],selectedTier:null,
      loginAttempt:0,smsAttempt:0,pollCount:0,pollTimer:null,smsTimer:null,smsSeconds:0,orderBusy:false,
      orderTracker:{orderId:'',rank:0,terminal:false,latestVersion:0}};
    const message=value=>{el('pageMessage').textContent=safeText(value,180)};
    const setLoginEnabled=enabled=>{
      el('phone').disabled=!enabled;el('smsCode').disabled=!enabled;el('loginButton').disabled=!enabled;
      el('sendSmsButton').disabled=!enabled||state.smsSeconds>0;
    };
    const stopPolling=()=>{if(state.pollTimer)root.clearTimeout(state.pollTimer);state.pollTimer=null};
    const hideOrder=()=>{stopPolling();el('orderPanel').hidden=true;el('accountWorkspace').hidden=!state.session;el('checkoutBar').hidden=!state.session};

    function showAccount(){
      if(!state.session)return;
      el('loginPanel').hidden=true;el('accountWorkspace').hidden=false;el('checkoutBar').hidden=false;
      el('accountNickname').textContent=state.session.nickname||'当前账号';
      el('accountUid').textContent=state.session.userId;
      el('checkoutAccount').textContent=`${state.session.nickname||'当前账号'} · UID ${state.session.userId}`;
      el('moonSilkBalance').textContent='—';
    }

    function showLogin(){
      el('loginPanel').hidden=false;el('accountWorkspace').hidden=true;el('orderPanel').hidden=true;el('checkoutBar').hidden=true;
      el('phone').value='';el('smsCode').value='';setLoginEnabled(state.loginAvailable);
    }

    function expireSession(){
      state.loginAttempt+=1;state.smsAttempt+=1;stopPolling();guard.clear();store.clearAccountSession();state.session=null;state.selectedTier=null;state.tiers=[];
      state.orderTracker={orderId:'',rank:0,terminal:false,latestVersion:0};
      showLogin();message('登录已过期，请重新验证手机号。');
    }

    function switchAccount(){
      state.loginAttempt+=1;state.smsAttempt+=1;stopPolling();if(state.smsTimer)root.clearInterval(state.smsTimer);state.smsTimer=null;state.smsSeconds=0;
      state.orderTracker={orderId:'',rank:0,terminal:false,latestVersion:0};
      el('sendSmsButton').textContent='获取验证码';
      guard.clear();store.clearAccountSession();state.session=null;state.selectedTier=null;state.tiers=[];showLogin();message('已退出当前账号，待确认订单仍保留在本次浏览器会话中。');
    }

    function handleError(error){if(error&&error.code===100002){expireSession();return true}message(userFacingError(error));return false}

    function renderWallet(wallet){const balance=finiteNonNegative(wallet&&wallet.moonSilk);el('moonSilkBalance').textContent=balance===null?'—':formatNumber(balance)}

    function normalizeTier(raw){
      const tierId=safeText(raw&&raw.tierId,80),silkAmount=finiteNonNegative(raw&&raw.silkAmount),rmbPrice=finiteNonNegative(raw&&raw.rmbPrice);
      if(!tierId||silkAmount===null||rmbPrice===null)return null;
      const bonus=finiteNonNegative(raw.firstRechargeBonus)||0,total=finiteNonNegative(raw.firstRechargeTotal);
      return {tierId,name:safeText(raw.name,60)||`${formatNumber(silkAmount)} 月绸`,silkAmount,rmbPrice,firstRechargeBonus:bonus,
        firstRechargeTotal:total===null?silkAmount+bonus:total,firstRechargeAvailable:raw.firstRechargeAvailable===true,isBigTier:raw.isBigTier===true};
    }

    function selectTier(tier){
      state.selectedTier=tier;
      for(const option of el('tierList').querySelectorAll('.tier-option'))option.setAttribute('aria-checked',String(option.dataset.tierId===tier.tierId));
      const bonus=tier.firstRechargeAvailable&&tier.firstRechargeBonus>0?`，首次共 ${formatNumber(tier.firstRechargeTotal)} 月绸`:'';
      el('checkoutAmount').textContent=`${formatFen(tier.rmbPrice)} · ${formatNumber(tier.silkAmount)} 月绸${bonus}`;
      el('checkoutButton').disabled=!state.configured;
    }

    function renderTiers(payload){
      const tiers=Array.isArray(payload&&payload.tiers)?payload.tiers.map(normalizeTier).filter(Boolean):[];
      state.tiers=tiers;state.selectedTier=null;const list=el('tierList');list.replaceChildren();
      if(!tiers.length){const empty=doc.createElement('p');empty.className='empty-copy';empty.textContent='暂无可用充值档位。';list.append(empty);el('retryTiersButton').hidden=false;el('checkoutButton').disabled=true;return}
      el('retryTiersButton').hidden=true;
      for(const tier of tiers){
        const option=doc.createElement('button');option.type='button';option.className='tier-option'+(tier.isBigTier?' tier-option-big':'');
        option.dataset.tierId=tier.tierId;option.setAttribute('role','radio');option.setAttribute('aria-checked','false');
        const amount=doc.createElement('strong');amount.textContent=`${formatNumber(tier.silkAmount)} 月绸`;
        const price=doc.createElement('span');price.textContent=formatFen(tier.rmbPrice);
        const detail=doc.createElement('small');detail.textContent=tier.firstRechargeAvailable&&tier.firstRechargeBonus>0?`首次加赠 ${formatNumber(tier.firstRechargeBonus)}，共 ${formatNumber(tier.firstRechargeTotal)}`:tier.name;
        option.append(amount,price,detail);option.addEventListener('click',()=>selectTier(tier));list.append(option);
      }
    }

    async function loadAccountData(){
      if(!state.session)return;
      const snapshot=guard.capture(),token=state.session.accessToken;
      const [walletResult,tierResult]=await Promise.allSettled([api.getWallet(token),api.getRecharge(token)]);
      if(!guard.accepts(snapshot))return;
      if(walletResult.status==='fulfilled')renderWallet(walletResult.value);else if(handleError(walletResult.reason))return;
      if(tierResult.status==='fulfilled')renderTiers(tierResult.value);else{handleError(tierResult.reason);el('retryTiersButton').hidden=false}
    }

    function renderOrderBase(order){
      el('loginPanel').hidden=true;el('accountWorkspace').hidden=true;el('checkoutBar').hidden=true;el('orderPanel').hidden=false;
      el('orderNumber').textContent=safeText(order&&order.orderId,80)||'待服务端确认';
      el('orderAccount').textContent=state.session?`${state.session.nickname||'当前账号'} · UID ${state.session.userId}`:'—';
      const price=finiteNonNegative(order&&order.rmbPrice);
      el('orderProduct').textContent=order&&order.productId?`${safeText(order.productId,80)}${price===null?'':` · ${formatFen(price)}`}`:'正在读取订单内容';
    }

    function setOrderState(kind,heading,detail){
      const symbols={pending:'···',paid:'✓',fulfilled:'✓',closed:'×',unknown:'?'};
      const labels={pending:'等待付款确认',paid:'付款已确认',fulfilled:'月绸已到账',closed:'订单已结束',unknown:'状态待确认'};
      el('orderGlyph').textContent=symbols[kind]||'?';el('orderLabel').textContent=labels[kind]||labels.unknown;
      el('orderHeading').textContent=heading;el('orderMessage').textContent=detail;
      el('backToTiersButton').hidden=kind!=='closed'&&kind!=='fulfilled';
      el('refreshOrderButton').hidden=kind==='fulfilled'||kind==='closed';
    }

    function schedulePoll(pending){
      stopPolling();if(state.pollCount>=ORDER_POLL_LIMIT)return;
      state.pollTimer=root.setTimeout(()=>{if(!doc.hidden)resumePending(pending)},ORDER_POLL_DELAY);
    }

    function trackerFor(orderId){
      if(state.orderTracker.orderId!==orderId)state.orderTracker={orderId,rank:0,terminal:false,latestVersion:0};
      return state.orderTracker;
    }

    async function queryOrder(pending){
      if(!state.session||!pending.orderId)return;
      const tracker=trackerFor(pending.orderId);if(tracker.terminal)return;
      const queryVersion=++tracker.latestVersion,snapshot=guard.capture();state.pollCount+=1;
      if(tracker.rank===0)renderOrderBase({orderId:pending.orderId});
      try{
        const order=await api.getOrder(state.session.accessToken,pending.orderId);
        if(!guard.accepts(snapshot))return;
        if(!order||safeText(order.orderId,80)!==pending.orderId||order.channel!==EXPECTED_CHANNEL||order.productType!=='recharge')throw new Error('订单信息校验失败，请稍后重试。');
        if(tracker.terminal)return;
        const status=safeText(order.status,30).toLowerCase();
        if(status==='fulfilled'){
          const balance=finiteNonNegative(order.wallet&&order.wallet.moonSilk);
          if(balance===null)throw new Error('到账信息仍在同步，请稍后查询。');
          if(!advanceOrderTracker(tracker,status))return;
          renderOrderBase(order);message('');
          stopPolling();store.forgetPending(state.session.userId);renderWallet(order.wallet);
          setOrderState('fulfilled','充值已到账',`当前月绸 ${formatNumber(balance)}。你可以回到游戏查看。`);return;
        }
        if(['cancelled','failed','closed'].includes(status)){
          if(!advanceOrderTracker(tracker,status))return;
          renderOrderBase(order);message('');
          stopPolling();store.forgetPending(state.session.userId);
          setOrderState('closed','本次订单未完成','没有确认到月绸到账。你可以返回档位重新发起充值。');return;
        }
        if(!advanceOrderTracker(tracker,status)){schedulePoll(pending);return}
        renderOrderBase(order);
        if(status==='paid')setOrderState('paid','付款已确认，月绸发放中','请稍候，服务端完成发货后这里会显示最新余额。');
        else setOrderState(status==='created'?'pending':'unknown','正在等待服务端确认到账','不要重复付款。可以保留此页面，也可以稍后使用同一账号重新登录查询。');
        schedulePoll(pending);
      }catch(error){if(!guard.accepts(snapshot)||tracker.terminal||queryVersion!==tracker.latestVersion)return;if(handleError(error))return;
        setOrderState('unknown','暂未取得最新订单状态','订单仍会由服务端继续处理，请稍后查询。');schedulePoll(pending)}
    }

    async function createOrderFromPending(pending,{fresh=false}={}){
      if(!state.session)return;
      if(state.orderBusy)return;state.orderBusy=true;
      const snapshot=guard.capture();renderOrderBase({});
      setOrderState('pending',state.configured?'正在创建沙箱订单':'正在恢复待确认订单',
        state.configured?'请勿重复点击或切换账号。':'正在用原请求编号核对服务端记录，不会创建新的充值请求。');
      try{
        const result=await api.createOrder(state.session.accessToken,pending.tierId,pending.requestId);
        if(!guard.accepts(snapshot))return;
        const orderId=safeText(result&&result.orderId,80),paymentUrl=safeSandboxPaymentUrl(result&&result.paymentUrl);
        if(!orderId)throw new Error('服务端未返回有效订单号。');
        store.rememberPending(state.session.userId,{...pending,orderId});
        if(!paymentUrl){
          if(result&&result.paymentUrl)message('支付地址未通过沙箱安全校验，未打开收银台。');
          await queryOrder({...pending,orderId});return;
        }
        root.location.assign(paymentUrl);
      }catch(error){if(guard.accepts(snapshot)){
        if(fresh&&isDefinitiveFreshOrderRejection(error)){
          store.forgetPending(state.session.userId);hideOrder();showAccount();message(userFacingError(error));return;
        }
        if(!handleError(error))setOrderState('unknown','订单创建结果待确认','已保留相同请求编号。点击查询会继续恢复本次请求，不会重复生成订单。');
      }
      }finally{if(guard.accepts(snapshot))state.orderBusy=false}
    }

    function resumePending(pendingOverride){
      if(!state.session)return;
      const pending=pendingOverride||store.pendingFor(state.session.userId);if(!pending)return;
      if(pending.orderId)return queryOrder(pending);
      return createOrderFromPending(pending);
    }

    async function restoreSession(){
      const saved=store.readSession();if(!saved){showLogin();return}
      state.session=saved;guard.switchTo(saved.userId);showAccount();
      const pending=store.pendingFor(saved.userId);
      if(pending)await resumePending(pending);else await loadAccountData();
    }

    async function loadConfig(){
      lockPage(doc,'正在核验充值配置。');
      try{
        const capabilities=sandboxCapabilities(await api.getConfig());
        state.environmentTrusted=capabilities.trusted;state.loginAvailable=capabilities.loginAvailable;state.configured=capabilities.orderAvailable;
        if(!capabilities.trusted){lockPage(doc,'充值服务尚未完成可信配置，登录、短信和新付款均不可用。');return}
        el('environmentBadge').hidden=false;setLoginEnabled(capabilities.loginAvailable);
        if(capabilities.orderAvailable&&capabilities.loginAvailable)el('configurationNotice').hidden=true;
        else{
          el('configurationNotice').hidden=false;
          const detail=el('configurationNotice').querySelector('span');
          if(detail)detail.textContent=capabilities.loginAvailable?'新充值暂时停止，仍可登录查询本浏览器会话中的待确认订单。':'当前仅可查询已登录账号的待确认订单，不能重新登录或发起付款。';
        }
      }catch(_){state.configured=false;state.loginAvailable=false;state.environmentTrusted=false;lockPage(doc,'未能连接可信配置服务，登录、短信和新付款均不可用。')}
    }

    function beginCheckout(){
      if(!state.configured||!state.session||!state.selectedTier)return;
      const tier=state.selectedTier;
      el('confirmationNickname').textContent=state.session.nickname||'当前账号';el('confirmationUid').textContent=state.session.userId;
      el('confirmationProduct').textContent=`${formatNumber(tier.silkAmount)} 月绸${tier.firstRechargeAvailable&&tier.firstRechargeBonus>0?`（首次共 ${formatNumber(tier.firstRechargeTotal)}）`:''}`;
      el('confirmationAmount').textContent=formatFen(tier.rmbPrice);el('confirmationDialog').showModal();
    }

    el('sendSmsButton').addEventListener('click',async()=>{
      const phone=el('phone').value.trim();if(!state.loginAvailable)return;if(!validPhone(phone)){message('请输入正确的中国大陆手机号。');return}
      const smsAttempt=++state.smsAttempt;el('sendSmsButton').disabled=true;
      try{await api.sendSms(phone);if(smsAttempt!==state.smsAttempt)return;message('验证码已发送。');state.smsSeconds=60;
        state.smsTimer=root.setInterval(()=>{if(smsAttempt!==state.smsAttempt){root.clearInterval(state.smsTimer);state.smsTimer=null;return}
          state.smsSeconds-=1;el('sendSmsButton').textContent=state.smsSeconds>0?`${state.smsSeconds} 秒后重试`:'获取验证码';
          if(state.smsSeconds<=0){root.clearInterval(state.smsTimer);state.smsTimer=null;el('sendSmsButton').disabled=!state.loginAvailable}},1000);
      }catch(error){if(smsAttempt===state.smsAttempt){el('sendSmsButton').disabled=!state.loginAvailable;handleError(error)}}
    });

    el('loginForm').addEventListener('submit',async event=>{
      event.preventDefault();if(!state.loginAvailable)return;
      const phone=el('phone').value.trim(),code=el('smsCode').value.trim();
      if(!validPhone(phone)||!validSmsCode(code)){message('请填写正确的手机号和六位验证码。');return}
      const attempt=++state.loginAttempt;el('loginButton').disabled=true;
      try{
        const auth=await api.loginExisting(phone,code);if(attempt!==state.loginAttempt)return;
        const user=auth&&auth.user,userId=normalizeUserId(user&&user.id),token=String(auth&&auth.accessToken||'');
        if(!userId||!token||auth.newUser===true)throw new Error('未找到可登录的游戏账号，请先在游戏内创建账号。');
        const session={userId,accessToken:token,nickname:safeText(user.nickname,80)};
        if(!store.saveSession(session))throw new Error('当前浏览器无法安全保存登录状态。');
        state.session=session;guard.switchTo(userId);el('phone').value='';el('smsCode').value='';message('');showAccount();
        const pending=store.pendingFor(userId);if(pending)await resumePending(pending);else await loadAccountData();
      }catch(error){if(attempt===state.loginAttempt)handleError(error)}
      finally{if(attempt===state.loginAttempt)el('loginButton').disabled=!state.loginAvailable}
    });

    el('switchAccountButton').addEventListener('click',switchAccount);
    el('orderSwitchAccountButton').addEventListener('click',switchAccount);
    el('retryTiersButton').addEventListener('click',loadAccountData);
    el('checkoutButton').addEventListener('click',beginCheckout);
    el('startPaymentButton').addEventListener('click',()=>{
      if(!state.session||!state.selectedTier)return;el('confirmationDialog').close();
      const existing=store.pendingFor(state.session.userId);
      if(existing){resumePending(existing);return}
      state.pollCount=0;state.orderTracker={orderId:'',rank:0,terminal:false,latestVersion:0};
      const pending={requestId:newRequestId(),tierId:state.selectedTier.tierId,orderId:'',createdAt:Date.now()};
      if(!store.rememberPending(state.session.userId,pending)){message('当前浏览器无法安全保存订单请求，请勿付款。');return}
      createOrderFromPending(pending,{fresh:true});
    });
    el('refreshOrderButton').addEventListener('click',()=>resumePending());
    el('backToTiersButton').addEventListener('click',()=>{hideOrder();showAccount();loadAccountData()});
    doc.addEventListener('visibilitychange',()=>{if(!doc.hidden&&state.session&&store.pendingFor(state.session.userId))resumePending()});
    root.addEventListener('pageshow',()=>{if(state.session&&store.pendingFor(state.session.userId))resumePending()});

    (async()=>{await loadConfig();await restoreSession()})();
    return {state,store,guard,api,resumePending};
  }

  if(root.document)root.document.addEventListener('DOMContentLoaded',()=>init(root.document));
  return {init,lockPage,validPhone,validSmsCode,safeSandboxPaymentUrl,normalizeUserId,normalizeRequestId,newRequestId,
    createSessionStore,createAccountGuard,createApiClient,isTrustedSandboxConfig,sandboxCapabilities,userFacingError,isDefinitiveFreshOrderRejection,formatFen,resolveApiBase,advanceOrderTracker,
    storageNamespace,storageKeysFor,ApiError,LOOPBACK_API_BASE,DEPLOYED_TEST_API_BASE,SESSION_KEY_PREFIX,PENDING_KEY_PREFIX,SANDBOX_GATEWAY_HOST,EXPECTED_CHANNEL,APP_MARKET};
});
