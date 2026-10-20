/**
 * @fileoverview 国内官网预约有礼页面交互。
 * AI Context
 * 上游: index.html 和服务端 /api/reservation-gift；下游: 活动状态、短信验证、预约查询、退订和下载入口。
 * 核心概念: 默认隐藏，首页标题点击十次后才初始化；查询 Cookie 仅由浏览器持有，服务端字段仅以 textContent 呈现。
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.LunaKoruReservation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const DEFAULT_API_BASE='https://1259219143-fp8pc6xpyz.ap-guangzhou.tencentscf.com';
  const endpoint='/api/reservation-gift';
  const RESERVATION_START='2026-10-24T00:00:00+08:00';
  function formatCountdown(start,now){
    const seconds=Math.max(0,Math.ceil((start-now)/1000));
    return `${String(Math.floor(seconds/3600)).padStart(2,'0')} 小时 ${String(Math.floor(seconds/60)%60).padStart(2,'0')} 分钟 ${String(seconds%60).padStart(2,'0')} 秒`;
  }
  // Approved reward categories are a preview only; counts and unlocks always come from the API.
  const previewRewards=[{tier:3,threshold:20000,name:'专属称号'},
    {tier:1,threshold:50000,name:'永久配饰'},{tier:2,threshold:100000,name:'永久服装'}];
  const validPhone=phone=>/^1[3-9]\d{9}$/.test(String(phone||''));
  const safeUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:''}catch(_){return ''}};
  const channel=value=>/^[a-zA-Z0-9_-]{1,80}$/.test(value||'')?value:'unknown';
  const selectedPlatform=(form,ua)=>{
    const checked=form.querySelector('input[name="platform"]:checked');
    if(checked)return checked.value;
    return /iPhone|iPad/i.test(ua||'')?'IOS':'ANDROID';
  };
  function init(doc,fetchImpl){
    const form=doc.getElementById('reservationForm');if(!form)return;
    if(!form.querySelector('input[name="platform"]:checked'))form.elements.platform.value=selectedPlatform(form,root.navigator.userAgent);
    const fetcher=fetchImpl||root.fetch.bind(root);
    const localPreview=['127.0.0.1','localhost','[::1]'].includes(root.location.hostname);
    const base=localPreview?'':String(doc.body.dataset.reservationApi||DEFAULT_API_BASE).replace(/\/$/,'');
    const el=id=>doc.getElementById(id);
    const message=value=>{el('reservationMessage').textContent=value};
    const state={activity:null,mine:null,csrf:null,verified:false};
    const dialog=el('reservationDialog');
    el('reservationOpen').addEventListener('click',()=>{
      dialog.showModal();doc.documentElement.classList.add('reservation-modal-open');
    });
    el('reservationClose').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{
      const rect=dialog.getBoundingClientRect();
      if(event.target===dialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))dialog.close();
    });
    dialog.addEventListener('close',()=>{
      doc.documentElement.classList.remove('reservation-modal-open');
    });
    let refreshTimer,countdownTimer;
    let boundaryRefreshRequested=false;
    const params=new URLSearchParams(root.location.search);
    for(const key of ['utm_source','utm_campaign']){
      const value=channel(params.get(key));
      if(value!=='unknown')root.sessionStorage.setItem('reservation_'+key,value);
    }
    const request=async(path,method='GET',body=null)=>{
      const headers={};if(body!==null)headers['Content-Type']='application/json';
      if(method!=='GET'&&state.csrf)headers['X-Reservation-CSRF']=state.csrf;
      const controller=path==='/activity'?new AbortController():null;
      const timeout=controller?root.setTimeout(()=>controller.abort(),12000):null;
      try{
        const response=await fetcher(base+endpoint+path,{method,credentials:'include',headers,signal:controller?.signal,
          body:body===null?undefined:JSON.stringify(body),cache:'no-store'});
        if(!response.ok)throw new Error(response.status===401?'查询会话已过期，请重新验证手机号':
          response.status===403?'请求被拒绝，请刷新页面重试':response.status===429?'操作太频繁或短信暂不可用，请稍后再试':response.status===400?(path==='/sms'?'手机号暂不可用，请检查号码或稍后重试':'验证码不正确或已过期，请重新获取'):response.status===503?'验证服务暂不可用，请稍后重试':'请求失败，请稍后再试');
        const envelope=await response.json();
        if(envelope.result!==0)throw new Error(envelope.errorMsg||'请求失败');
        return envelope.data;
      }finally{if(timeout!==null)root.clearTimeout(timeout)}
    };
    const date=value=>value?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value))+'（北京时间）':'';
    function renderActivity(data){
      state.activity=data;
      const available=!!data?.available;
      data=data||{};
      const phase=available?data.phase:'BEFORE',upcoming=!available||phase==='BEFORE';
      doc.querySelector('.reservation-panel').dataset.state=upcoming?'upcoming':'active';
      if(upcoming)el('reservationNotice').before(el('reservationPhase'));
      else doc.querySelector('.reservation-panel').prepend(el('reservationPhase'));
      el('reservationRetry').hidden=true;
      root.clearInterval(countdownTimer);
      el('reservationNotice').textContent='';
      el('reservationNotice').setAttribute('aria-live',upcoming?'off':'polite');
      if(upcoming){
        const start=Date.parse(RESERVATION_START);
        const receivedAt=Date.now(),serverTime=Date.parse(data.serverTime);
        const clock=()=>Number.isFinite(serverTime)?serverTime+Date.now()-receivedAt:Date.now();
        const update=()=>{
          const now=clock();
          el('reservationNotice').textContent=now<start?'距离预约开启 '+formatCountdown(start,now):'预约即将开放，请稍后刷新';
          el('reservationNotice').title='2026年10月24日 00:00（北京时间）';
          if(now>=start&&!boundaryRefreshRequested){boundaryRefreshRequested=true;root.setTimeout(refreshActivity,0)}
        };
        update();countdownTimer=root.setInterval(update,1000);
      }
      el('reservationPhase').textContent=phase==='RESERVING'?(data.reservationPaused?'预约暂时暂停':'预约进行中'):
        phase==='BEFORE'?'预约即将开启':phase==='CLAIMING'?'已开放下载与领取':'领取期已结束，仍可下载';
      el('reservationFormHeading').textContent=state.mine?.reservation?'我的预约':phase==='RESERVING'?'立即预约':'查询我的预约';
      const reminderAllowed=data.reminderAvailable!==false;
      form.elements.reminder.disabled=!reminderAllowed;
      if(!reminderAllowed)form.elements.reminder.checked=false;
      el('reservationOpen').disabled=upcoming;
      el('reservationOpen').hidden=upcoming;
      el('reservationOpen').textContent=(state.mine?.reservation?'查看预约':phase==='RESERVING'&&!data.reservationPaused?'立即预约':'查询我的预约');
      const arrow=doc.createElement('img');arrow.className='app-icon';arrow.src='images/app-ui/right.png';arrow.alt='';el('reservationOpen').append(' ',arrow);
      const dates=upcoming?'':
        [['领取截止',data.claimDeadlineAt]]
          .filter(([,value])=>value).map(([label,value])=>label+'：'+date(value)).join('；');
      el('reservationDates').textContent=dates;el('reservationDates').hidden=!dates;
      el('reservationCount').hidden=upcoming;
      el('reservationCount').textContent=upcoming?'':Number.isFinite(data.count)?`已有 ${data.count.toLocaleString('zh-CN')} 人完成预约`:'当前人数暂不可用';
      const rewards=el('reservationRewards');rewards.replaceChildren();
      const milestones=(available&&data.rewards?.length?data.rewards:previewRewards).slice().sort((a,b)=>a.threshold-b.threshold);
      const count=!upcoming&&Number.isFinite(data.count)?Math.max(0,data.count):0;
      const positions=milestones.map((_,index)=>(index+.5)/Math.max(milestones.length,1));
      let progress=0;
      if(!upcoming&&milestones.length&&Number.isFinite(data.count)){
        const nextIndex=milestones.findIndex(reward=>count<reward.threshold);
        if(nextIndex<0)progress=positions[positions.length-1];
        else{
          const lowerCount=nextIndex?milestones[nextIndex-1].threshold:0;
          const lowerPosition=nextIndex?positions[nextIndex-1]:0;
          const fraction=Math.min(1,(count-lowerCount)/Math.max(1,milestones[nextIndex].threshold-lowerCount));
          progress=lowerPosition+(positions[nextIndex]-lowerPosition)*fraction;
        }
      }
      rewards.style.setProperty('--milestone-progress',`${(progress*100).toFixed(2)}%`);
      const next=milestones.find(reward=>count<reward.threshold);
      el('reservationNext').textContent=upcoming?'预约开启后，与你一起点亮三份心意。':Number.isFinite(data.count)?next?`距离 ${next.threshold/10000} 万人档，还差 ${(next.threshold-count).toLocaleString('zh-CN')} 人`:'全部里程碑已达成':'人数更新后显示下一档进度';
      for(const reward of milestones){
        const unlocked=!upcoming&&!!(data.unlockedMask&(1<<(reward.tier-1)));
        const card=doc.createElement('article');card.className='reservation-reward'+(unlocked?' is-unlocked':'');
        const target=doc.createElement('span');target.className='reservation-reward-target';target.textContent=`${reward.threshold/10000} 万人`;card.append(target);
        const orb=doc.createElement('span');orb.className='reservation-reward-orb';orb.setAttribute('aria-hidden','true');
        const img=doc.createElement('img');img.src=unlocked?'images/app-ui/gift-open.webp':'images/app-ui/gift-closed.webp';img.alt='';orb.append(img);
        card.append(orb);
        const title=doc.createElement('strong');title.textContent=reward.name;card.append(title);
        const badge=doc.createElement('small');badge.textContent='永久拥有';card.append(badge);
        const status=doc.createElement('span');status.className='reservation-reward-status';
        status.textContent=upcoming?'待活动开启':unlocked?(phase==='CLAIMING'?'可领取':'已解锁'):'待解锁';card.append(status);rewards.append(card);
      }
      const canReserve=phase==='RESERVING'&&!data.reservationPaused;
      form.hidden=upcoming||!!state.mine?.reservation;
      el('reservationSubmit').hidden=upcoming;
      el('reservationSubmit').textContent=canReserve?'确认预约':'查看预约';
      for(const control of form.querySelectorAll('.reservation-new-only'))control.hidden=!canReserve;
      form.elements.reminder.closest('label').hidden=!canReserve||!reminderAllowed;
      const released=phase==='CLAIMING'||phase==='ENDED';el('reservationDownload').hidden=!released;
      const links=el('reservationDownloadLinks');links.replaceChildren();
      if(released)for(const [platform,url,label] of [['ANDROID',data.androidUrl,'下载 Android 版'],['IOS',data.iosUrl,'前往 App Store']]){
        const safe=safeUrl(url),group=doc.createElement('div');group.className='reservation-download-option';
        const node=doc.createElement(safe?'a':'span');node.textContent=safe?label:label+' · 即将开放';
        if(safe){node.href=safe;node.rel='noopener';node.dataset.platform=platform;
          if(typeof root.qrcode==='function'){
            const qr=root.qrcode(0,'M');qr.addData(safe);qr.make();
            const canvas=doc.createElement('canvas'),size=qr.getModuleCount(),scale=4;
            canvas.width=size*scale;canvas.height=size*scale;canvas.setAttribute('role','img');
            canvas.setAttribute('aria-label',`扫码${label}`);canvas.className='reservation-qr';
            const context=canvas.getContext('2d');
            if(context){context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
              context.fillStyle='#172b4b';for(let row=0;row<size;row++)for(let col=0;col<size;col++)
                if(qr.isDark(row,col))context.fillRect(col*scale,row*scale,scale,scale);
              group.append(canvas);
            }
          }
        }
        group.append(node);links.append(group);
      }
    }
    function renderMine(data){
      state.mine=data;state.csrf=data?.csrf||state.csrf;
      const reservation=data?.reservation;
      el('reservationMine').hidden=!reservation;
      if(reservation){el('reservationMineText').textContent=`${data.phoneMasked} · 编号 ${reservation.code} · ${reservation.platform} · ${reservation.reminderSubscribed?'已订阅上线提醒':'未订阅上线提醒'}`;
        const rewardList=el('reservationMineRewards');rewardList.replaceChildren();
        const stateLabels={PENDING:'发放中',GRANTED:'已到账',ALREADY_OWNED:'已拥有同款'};
        for(const reward of reservation.rewards||[]){const item=doc.createElement('li');
          const tierLabel={3:'2 万人档',1:'5 万人档',2:'10 万人档'};
          item.textContent=`${tierLabel[reward.tier]||'奖励'}：${stateLabels[reward.state]||'核验中'}`;rewardList.append(item)}
        el('reservationUnsubscribe').hidden=!reservation.reminderSubscribed;
        message('预约记录已确认。正式上线后请使用同手机号账号进入 App。');}
      else if(data&&state.verified){message('未查到预约记录，请核对手机号。')}
      if(state.activity)renderActivity(state.activity);
    }
    function refreshActivity(){
      clearTimeout(refreshTimer);
      request('/activity').then(data=>{
        renderActivity(data);clearTimeout(refreshTimer);
        const now=Date.parse(data.serverTime),release=Date.parse(data.releaseAt),start=Date.parse(data.startAt);
        const next=[start,release,release+30*24*3600*1000].filter(time=>Number.isFinite(time)&&time>now)[0];
        const delay=next&&Number.isFinite(now)?Math.max(1000,Math.min(300000,next-now+100)):300000;
        refreshTimer=root.setTimeout(refreshActivity,delay);
      }).catch(()=>{
        root.clearInterval(countdownTimer);
        el('reservationRetry').hidden=false;
        if(!state.activity){
          doc.querySelector('.reservation-panel').dataset.state='error';
          el('reservationPhase').textContent='暂时无法连接';
          el('reservationCount').hidden=false;
          el('reservationCount').textContent='活动信息加载失败';
          el('reservationNext').textContent='请稍后重试，或先查看下方活动规则。';
              el('reservationNotice').textContent='';
          form.hidden=true;el('reservationOpen').hidden=true;el('reservationOpen').disabled=true;
        }else el('reservationNotice').textContent='活动信息暂未更新，请稍后重试。';
        clearTimeout(refreshTimer);refreshTimer=root.setTimeout(refreshActivity,60000);
      });
    }
    el('reservationRetry').addEventListener('click',()=>{el('reservationRetry').hidden=true;refreshActivity()});
    async function verify(){
      const phone=form.elements.phone.value.trim(),code=form.elements.code.value.trim();
      if(!validPhone(phone)||!/^\d{6}$/.test(code))throw new Error('请填写正确的大陆手机号和六位验证码');
      const data=await request('/verify','POST',{phone,code});state.verified=true;renderMine(data.mine);return data;
    }
    form.elements.phone.addEventListener('input',()=>{state.verified=false});
    let smsTimer,smsSending=false;
    let smsRetryAt=Number(root.sessionStorage.getItem('reservation_sms_retry_at'))||0;
    function renderSmsCooldown(){
      const seconds=Math.max(0,Math.ceil((smsRetryAt-Date.now())/1000));
      el('reservationSms').disabled=smsSending||seconds>0;
      el('reservationSms').textContent=smsSending?'发送中…':seconds>0?`重新获取 ${seconds} s`:'获取验证码';
      if(!seconds){root.clearInterval(smsTimer);root.sessionStorage.removeItem('reservation_sms_retry_at')}
    }
    function watchSmsCooldown(){root.clearInterval(smsTimer);renderSmsCooldown();if(smsRetryAt>Date.now())smsTimer=root.setInterval(renderSmsCooldown,250)}
    watchSmsCooldown();
    el('reservationSms').addEventListener('click',async()=>{
      if(smsSending||smsRetryAt>Date.now())return;
      try{const phone=form.elements.phone.value.trim();if(!validPhone(phone))throw new Error('请输入正确的中国大陆手机号');
        smsSending=true;renderSmsCooldown();
        await request('/sms','POST',{phone});
        smsRetryAt=Date.now()+60000;root.sessionStorage.setItem('reservation_sms_retry_at',String(smsRetryAt));message('');
      }catch(error){message(error.message)}
      finally{smsSending=false;watchSmsCooldown()}
    });
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      try{
        if(!state.verified)await verify();
        if(state.mine?.reservation){message('该手机号已预约，已恢复原记录');return}
        if(state.activity?.phase!=='RESERVING'||state.activity.reservationPaused){message('未查到预约记录，请核对手机号。');return}
        if(!form.elements.adult.checked||!form.elements.terms.checked){message('请先确认已年满18周岁并同意协议与规则');return}
        const source=channel(root.sessionStorage.getItem('reservation_utm_source'));
        const campaignTag=channel(root.sessionStorage.getItem('reservation_utm_campaign'));
        const platform=selectedPlatform(form,root.navigator.userAgent);
        await request('/reserve','POST',{platform,adult:true,terms:true,reminder:form.elements.reminder.checked,
          source,campaignTag,deviceKind:/Mobi/i.test(root.navigator.userAgent)?'mobile':'desktop'});
        renderMine(await request('/mine'));
      }catch(error){
        refreshActivity();
        try{const mine=await request('/mine');if(mine.reservation){renderMine(mine);return}}catch(_){}
        message('暂未确认预约结果，请重试；若已预约，将自动恢复记录。'+error.message);
      }
    });
    el('reservationCopy').addEventListener('click',()=>{const code=state.mine?.reservation?.code;if(code)root.navigator.clipboard.writeText(code)});
    el('reservationPlatform').addEventListener('click',async()=>{try{const current=state.mine?.reservation?.platform;
      renderMine(await request('/platform','PATCH',{platform:current==='IOS'?'ANDROID':'IOS'}));}catch(error){message(error.message)}});
    el('reservationUnsubscribe').addEventListener('click',async()=>{try{renderMine(await request('/unsubscribe','POST',{}));message('已取消上线短信提醒，预约与奖励不受影响')}catch(error){message(error.message)}});
    el('reservationLogout').addEventListener('click',async()=>{try{await request('/logout','POST',{});state.mine=null;state.csrf=null;state.verified=false;form.reset();
      el('reservationMine').hidden=true;renderActivity(state.activity);message('已退出，请验证新的手机号')}catch(error){message(error.message)}});
    doc.addEventListener('visibilitychange',()=>{if(!doc.hidden)refreshActivity()});
    refreshActivity();
    if(!localPreview||doc.body.dataset.reservationTest==='true')request('/mine').then(renderMine).catch(()=>{});
    return state;
  }
  function setupPreviewGate(doc){
    const title=doc.getElementById('reservationRevealTitle');if(!title)return;
    let clicks=0;
    const reveal=()=>{
      if(++clicks<10)return;
      title.removeEventListener('click',reveal);
      for(const entry of doc.querySelectorAll('[data-reservation-entry]'))entry.hidden=false;
      doc.getElementById('firstScreen').after(doc.getElementById('pv'));
      init(doc);
      doc.getElementById('hero').scrollIntoView({behavior:'smooth',block:'start'});
    };
    title.addEventListener('click',reveal);
    if(doc.body.dataset.reservationAutoOpen==='true'){clicks=9;reveal()}
  }
  if(root.document)root.document.addEventListener('DOMContentLoaded',()=>setupPreviewGate(root.document));
  return {init,validPhone,safeUrl,channel,selectedPlatform,DEFAULT_API_BASE,formatCountdown,RESERVATION_START};
});
