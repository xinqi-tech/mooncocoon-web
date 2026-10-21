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
    const message=value=>{if(value!==null)el('reservationMessage').textContent=value};
    const errorHint=error=>error?.stale?null:error?.name==='AbortError'?'请求超时，请稍后重试':error instanceof TypeError?'网络异常，请稍后重试':error instanceof SyntaxError?'服务异常，请稍后重试':error.message;
    const state={activity:null,mine:null,csrf:null,verified:false,queryOnly:false,subscribing:false,flow:0,cleaning:Promise.resolve()};
    const dialog=el('reservationDialog');
    async function openFlow(queryOnly){
      const flow=++state.flow;
      state.mine=null;state.csrf=null;state.verified=false;state.subscribing=false;state.queryOnly=queryOnly;
      form.reset();form.elements.platform.value=selectedPlatform(form,root.navigator.userAgent);
      el('reservationMine').hidden=true;
      if(state.activity)renderActivity(state.activity);message('');
      dialog.showModal();doc.documentElement.classList.add('reservation-modal-open');
      el('reservationSubmit').disabled=true;
      await state.cleaning;if(state.flow===flow)el('reservationSubmit').disabled=false;
    }
    el('reservationOpen').addEventListener('click',()=>openFlow(false));
    el('reservationQuery').addEventListener('click',()=>openFlow(true));
    el('reservationClose').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{
      const rect=dialog.getBoundingClientRect();
      if(event.target===dialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom))dialog.close();
    });
    dialog.addEventListener('close',()=>{
      doc.documentElement.classList.remove('reservation-modal-open');
      if(state.csrf)state.cleaning=request('/logout','POST',{}).catch(()=>{});
      state.flow++;state.mine=null;state.csrf=null;state.verified=false;state.subscribing=false;
      form.reset();el('reservationMine').hidden=true;message('');
      if(state.activity)renderActivity(state.activity);
    });
    let refreshTimer,countdownTimer;
    let boundaryRefreshRequested=false;
    const params=new URLSearchParams(root.location.search);
    for(const key of ['utm_source','utm_campaign']){
      const value=channel(params.get(key));
      if(value!=='unknown')root.sessionStorage.setItem('reservation_'+key,value);
    }
    const request=async(path,method='GET',body=null)=>{
      const flow=state.flow;
      const stale=()=>path!=='/activity'&&path!=='/logout'&&flow!==state.flow;
      const headers={};if(body!==null)headers['Content-Type']='application/json';
      if(method!=='GET'&&state.csrf)headers['X-Reservation-CSRF']=state.csrf;
      const controller=path==='/activity'?new AbortController():null;
      const timeout=controller?root.setTimeout(()=>controller.abort(),12000):null;
      try{
        const response=await fetcher(base+endpoint+path,{method,credentials:'include',headers,signal:controller?.signal,
          body:body===null?undefined:JSON.stringify(body),cache:'no-store'});
        if(stale()){const error=new Error('closed reservation flow');error.stale=true;throw error}
        if(!response.ok)throw new Error(response.status===401?'验证已过期，请重新获取验证码':
          response.status===403?'请刷新页面后重试':response.status===429?'请求太频繁，请稍后重试':response.status===400?(path==='/verify'?'验证码错误或已过期':path==='/sms'?'请填写正确的手机号':'预约信息有误，请检查'):response.status===503?'服务暂不可用，请稍后重试':'请求失败，请稍后重试');
        const envelope=await response.json();
        if(envelope.result!==0){
          const reason=String(envelope.errorMsg||'');
          throw new Error(/频繁|冷却/.test(reason)?'请求太频繁，请稍后重试':/验证码/.test(reason)?'验证码错误或已过期':'请求失败，请稍后重试');
        }
        if(stale()){const error=new Error('closed reservation flow');error.stale=true;throw error}
        return envelope.data;
      }catch(error){if(stale())error.stale=true;throw error}
      finally{if(timeout!==null)root.clearTimeout(timeout)}
    };
    const date=value=>value?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value))+'（北京时间）':'';
    function renderActivity(data){
      state.activity=data;
      const available=!!data?.available;
      data=data||{};
      const phase=available?data.phase:'BEFORE',upcoming=!available||phase==='BEFORE';
      el('reservationQuery').hidden=upcoming;
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
      el('reservationFormHeading').textContent=state.mine?.reservation?'预约成功':state.queryOnly?'查询预约':phase==='RESERVING'?'立即预约':'查询预约';
      const reminderAllowed=data.reminderAvailable!==false;
      renderReminderSubscription();
      form.elements.reminder.disabled=!reminderAllowed;
      if(!reminderAllowed)form.elements.reminder.checked=false;
      el('reservationOpen').disabled=upcoming;
      el('reservationOpen').hidden=upcoming;
      el('reservationOpen').textContent='立即预约';
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
      const trackStart=.02;
      let progress=trackStart;
      if(!upcoming&&milestones.length&&Number.isFinite(data.count)){
        const nextIndex=milestones.findIndex(reward=>count<reward.threshold);
        if(nextIndex<0)progress=positions[positions.length-1];
        else{
          const lowerCount=nextIndex?milestones[nextIndex-1].threshold:0;
          const lowerPosition=nextIndex?positions[nextIndex-1]:trackStart;
          const fraction=Math.min(1,(count-lowerCount)/Math.max(1,milestones[nextIndex].threshold-lowerCount));
          progress=lowerPosition+(positions[nextIndex]-lowerPosition)*fraction;
        }
      }
      rewards.style.setProperty('--milestone-progress',`${(progress*100).toFixed(5)}%`);
      rewards.dataset.progressActive=String(!upcoming&&Number.isFinite(data.count)&&count>0);
      const track=doc.createElement('span');track.className='reservation-track';track.setAttribute('role','progressbar');
      track.setAttribute('aria-label','预约人数奖励进度');track.setAttribute('aria-valuemin','0');
      track.setAttribute('aria-valuemax',String(milestones.at(-1)?.threshold||100000));
      if(!upcoming&&Number.isFinite(data.count))track.setAttribute('aria-valuenow',String(Math.min(count,milestones.at(-1)?.threshold||100000)));
      else track.setAttribute('aria-valuetext',upcoming?'预约尚未开启':'预约人数暂不可用');
      const start=doc.createElement('span');start.className='reservation-track-start';start.setAttribute('aria-hidden','true');track.append(start);
      const light=doc.createElement('img');light.className='reservation-progress-light';light.src='images/app-ui/reservation-progress-light.png';light.alt='';light.setAttribute('aria-hidden','true');track.append(light);rewards.append(track);
      const next=milestones.find(reward=>count<reward.threshold);
      el('reservationNext').textContent=upcoming?'预约开启后，与你一起点亮三份心意。':Number.isFinite(data.count)?next?`距离 ${next.threshold/10000} 万人档，还差 ${(next.threshold-count).toLocaleString('zh-CN')} 人`:'全部里程碑已达成':'人数更新后显示下一档进度';
      for(const reward of milestones){
        const unlocked=!upcoming&&!!(data.unlockedMask&(1<<(reward.tier-1)));
        const card=doc.createElement('article');card.className='reservation-reward'+(unlocked?' is-unlocked':'');
        const target=doc.createElement('span');target.className='reservation-reward-target';target.textContent=`${reward.threshold/10000} 万人`;card.append(target);
        const orb=doc.createElement('span');orb.className='reservation-reward-orb';orb.setAttribute('aria-hidden','true');
        if(!unlocked){const base=doc.createElement('span');base.className='reservation-orb-base';const baseImage=doc.createElement('img');baseImage.src='images/app-ui/gift-base-locked.png';baseImage.alt='';base.append(baseImage);orb.append(base)}
        const img=doc.createElement('img');img.className='reservation-gift-icon';img.src='images/app-ui/gift-closed.webp';img.alt='';orb.append(img);
        card.append(orb);
        const title=doc.createElement('strong');title.textContent=reward.name;card.append(title);
        const badge=doc.createElement('small');badge.textContent='永久拥有';card.append(badge);
        const status=doc.createElement('span');status.className='reservation-reward-status';
        status.textContent=upcoming?'待活动开启':unlocked?(phase==='CLAIMING'?'可领取':'已解锁'):'待解锁';card.append(status);rewards.append(card);
      }
      const canReserve=!state.queryOnly&&phase==='RESERVING'&&!data.reservationPaused;
      form.hidden=(upcoming&&!state.queryOnly)||!!state.mine?.reservation;
      el('reservationCodeRow').hidden=state.queryOnly;
      el('reservationSubmit').hidden=upcoming&&!state.queryOnly;
      el('reservationSubmit').textContent=canReserve?'确认预约':'查询预约';
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
    function renderReminderSubscription(){
      const reservation=state.mine?.reservation;if(!reservation)return;
      const available=state.activity?.reminderAvailable===true;
      el('reservationSubscribe').disabled=!!state.mine?.publicLookup||state.subscribing||reservation.reminderSubscribed||!available;
      el('reservationSubscribe').textContent=state.subscribing?'订阅中…':reservation.reminderSubscribed?'已订阅上线提醒':'订阅上线提醒';
      el('reservationReminderHint').textContent=reservation.reminderSubscribed?'正式上线时，将向预约手机号发送一条短信提醒。':state.mine?.publicLookup?'如需订阅提醒，请通过“立即预约”验证手机号。':available?'自愿接收一条正式上线短信提醒。':'上线提醒订阅暂未开放';
    }
    function renderMine(data,existing=false){
      state.mine=data;state.csrf=data?.csrf||state.csrf;
      const reservation=data?.reservation;
      el('reservationMine').hidden=!reservation;
      if(reservation){
        el('reservationMineNotice').textContent=existing?'该手机号已预约，以下是你的预约信息。':'';
        el('reservationMinePhone').textContent=data.phoneMasked;
        el('reservationMineCode').textContent=reservation.code;
        el('reservationMinePlatform').textContent=reservation.platform==='IOS'?'iOS':'Android';
        el('reservationMineReminder').textContent=reservation.reminderSubscribed?'已订阅':'未订阅';
        el('reservationCopyStatus').textContent='';
        renderReminderSubscription();
        const rewardList=el('reservationMineRewards');rewardList.replaceChildren();
        const stateLabels={PENDING:'发放中',GRANTED:'已到账',ALREADY_OWNED:'已拥有同款'};
        for(const reward of reservation.rewards||[]){const item=doc.createElement('li');
          const tierLabel={3:'2 万人档',1:'5 万人档',2:'10 万人档'};
          item.textContent=`${tierLabel[reward.tier]||'奖励'}：${stateLabels[reward.state]||'核验中'}`;rewardList.append(item)}
        message('');}
      else if(data&&state.verified&&state.queryOnly){message('该手机号暂未查询到预约信息')}
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
    function verificationInput(){
      const phone=form.elements.phone.value.trim(),code=form.elements.code.value.trim();
      if(!phone)throw new Error('请先填写手机号');
      if(!validPhone(phone))throw new Error('请填写正确的手机号');
      if(!code)throw new Error('请先填写验证码');
      if(!/^\d{6}$/.test(code))throw new Error('请填写六位验证码');
      return {phone,code};
    }
    async function verify(){
      const flow=state.flow;
      const {phone,code}=verificationInput();
      await state.cleaning;
      if(flow!==state.flow){const error=new Error('closed reservation flow');error.stale=true;throw error}
      const data=await request('/verify','POST',{phone,code});state.verified=true;renderMine(data.mine,true);return data;
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
      const flow=state.flow;
      try{const phone=form.elements.phone.value.trim();if(!phone)throw new Error('请先填写手机号');if(!validPhone(phone))throw new Error('请填写正确的手机号');
        smsSending=true;renderSmsCooldown();
        await state.cleaning;
        if(flow!==state.flow)return;
        await request('/sms','POST',{phone});
        smsRetryAt=Date.now()+60000;root.sessionStorage.setItem('reservation_sms_retry_at',String(smsRetryAt));message('');
      }catch(error){message(errorHint(error))}
      finally{smsSending=false;watchSmsCooldown()}
    });
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const flow=state.flow;
      let submitted=false;
      try{
        if(state.queryOnly){
          const phone=form.elements.phone.value.trim();
          if(!phone)throw new Error('请先填写手机号');
          if(!validPhone(phone))throw new Error('请填写正确的手机号');
          renderMine(await request('/lookup','POST',{phone}),true);
          if(!state.mine?.reservation)message('该手机号暂未查询到预约信息');
          return;
        }
        if(!state.verified)verificationInput();
        const accepting=!state.queryOnly&&state.activity?.phase==='RESERVING'&&!state.activity.reservationPaused;
        if(accepting&&!state.mine?.reservation&&(!form.elements.adult.checked||!form.elements.terms.checked)){message('请先勾选相关协议');return}
        if(!state.verified)await verify();
        if(state.mine?.reservation)return;
        if(state.queryOnly){message('该手机号暂未查询到预约信息');return}
        if(state.activity?.phase!=='RESERVING'||state.activity.reservationPaused){message('未查到预约记录，请核对手机号。');return}
        const source=channel(root.sessionStorage.getItem('reservation_utm_source'));
        const campaignTag=channel(root.sessionStorage.getItem('reservation_utm_campaign'));
        const platform=selectedPlatform(form,root.navigator.userAgent);
        submitted=true;
        await request('/reserve','POST',{platform,adult:true,terms:true,reminder:form.elements.reminder.checked,
          source,campaignTag,deviceKind:/Mobi/i.test(root.navigator.userAgent)?'mobile':'desktop'});
        renderMine(await request('/mine'));
      }catch(error){
        if(error.stale||flow!==state.flow)return;
        if(submitted){
          refreshActivity();
          try{const mine=await request('/mine');if(mine.reservation){renderMine(mine);return}}catch(_){}
        }
        if(flow===state.flow)message(errorHint(error));
      }
    });
    el('reservationCopy').addEventListener('click',async()=>{const code=state.mine?.reservation?.code;if(!code)return;
      try{await root.navigator.clipboard.writeText(code);el('reservationCopyStatus').textContent='已复制'}
      catch(_){el('reservationCopyStatus').textContent='请长按编号复制'}});
    el('reservationSubscribe').addEventListener('click',async()=>{
      if(el('reservationSubscribe').disabled)return;
      const flow=state.flow;
      try{state.subscribing=true;renderReminderSubscription();renderMine(await request('/subscribe','POST',{}))}
      catch(error){message(errorHint(error))}
      finally{if(flow===state.flow){state.subscribing=false;renderReminderSubscription()}}
    });
    doc.addEventListener('visibilitychange',()=>{if(!doc.hidden)refreshActivity()});
    refreshActivity();
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
