/**
 * @fileoverview 国内官网预约有礼页面交互。
 * AI Context
 * 上游: index.html 和服务端 /api/reservation-gift；下游: 活动状态、短信验证、预约查询、退订和下载入口。
 * 核心概念: 查询 Cookie 仅由浏览器持有，JS 只保存同源 CSRF；服务端字段仅以 textContent 呈现。
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.LunaKoruReservation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const DEFAULT_API_BASE='https://1259219143-fp8pc6xpyz.ap-guangzhou.tencentscf.com';
  const endpoint='/api/reservation-gift';
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
    const fetcher=fetchImpl||root.fetch.bind(root);
    const base=String(doc.body.dataset.reservationApi||DEFAULT_API_BASE).replace(/\/$/,'');
    const el=id=>doc.getElementById(id);
    const message=value=>{el('reservationMessage').textContent=value};
    const state={activity:null,mine:null,csrf:null,verified:false};
    let refreshTimer;
    const params=new URLSearchParams(root.location.search);
    for(const key of ['utm_source','utm_campaign']){
      const value=channel(params.get(key));
      if(value!=='unknown')root.sessionStorage.setItem('reservation_'+key,value);
    }
    const request=async(path,method='GET',body=null)=>{
      const headers={};if(body!==null)headers['Content-Type']='application/json';
      if(method!=='GET'&&state.csrf)headers['X-Reservation-CSRF']=state.csrf;
      const response=await fetcher(base+endpoint+path,{method,credentials:'include',headers,
        body:body===null?undefined:JSON.stringify(body),cache:'no-store'});
      if(!response.ok)throw new Error(response.status===401?'查询会话已过期，请重新验证手机号':
        response.status===403?'请求被拒绝，请刷新页面重试':response.status===429?'操作太频繁，请稍后再试':'请求失败，请稍后再试');
      const envelope=await response.json();
      if(envelope.result!==0)throw new Error(envelope.errorMsg||'请求失败');
      return envelope.data;
    };
    const date=value=>value?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value))+'（北京时间）':'';
    function renderActivity(data){
      state.activity=data;
      if(!data||!data.available){message('活动尚未开放，请稍后查看。');form.hidden=true;return}
      const phase=data.phase;
      el('reservationPhase').textContent=phase==='RESERVING'?(data.reservationPaused?'预约暂时暂停':'预约进行中'):
        phase==='BEFORE'?'预约尚未开始':phase==='CLAIMING'?'已开放下载与领取':'领取期已结束，仍可下载';
      el('reservationFormHeading').textContent=phase==='RESERVING'?'留下你的预约':'查询我的预约';
      el('reservationDates').textContent='预约开始：'+date(data.startAt)+'；正式上线：'+date(data.releaseAt)+'；领取截止：'+date(data.claimDeadlineAt);
      el('reservationCount').textContent=Number.isFinite(data.count)?`已有 ${data.count.toLocaleString('zh-CN')} 人完成预约`:'当前人数暂不可用';
      el('heroReservationProgress').textContent=el('reservationCount').textContent;
      const rewards=el('reservationRewards');rewards.replaceChildren();
      const milestones=(data.rewards||[]).slice().sort((a,b)=>a.threshold-b.threshold);
      const count=Number.isFinite(data.count)?Math.max(0,data.count):0;
      const positions=milestones.map((_,index)=>(index+.5)/Math.max(milestones.length,1));
      let progress=0;
      if(milestones.length&&Number.isFinite(data.count)){
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
      el('reservationNext').textContent=Number.isFinite(data.count)?next?`距离 ${next.threshold/10000} 万人档，还差 ${(next.threshold-count).toLocaleString('zh-CN')} 人`:'全部里程碑已达成':'人数更新后显示下一档进度';
      for(const reward of milestones){
        const unlocked=!!(data.unlockedMask&(1<<(reward.tier-1)));
        const card=doc.createElement('article');card.className='reservation-reward'+(unlocked?' is-unlocked':'');
        const target=doc.createElement('span');target.className='reservation-reward-target';target.textContent=`${reward.threshold/10000} 万人`;card.append(target);
        const orb=doc.createElement('span');orb.className='reservation-reward-orb';orb.setAttribute('aria-hidden','true');
        const image=safeUrl(reward.image);
        if(image){const img=doc.createElement('img');img.src=image;img.alt='';orb.append(img)}
        else orb.textContent='✦';
        card.append(orb);
        const title=doc.createElement('strong');title.textContent=reward.name;card.append(title);
        const badge=doc.createElement('small');badge.textContent='永久拥有';card.append(badge);
        const status=doc.createElement('span');status.className='reservation-reward-status';
        status.textContent=unlocked?(phase==='CLAIMING'?'可领取':'已解锁'):'待解锁';card.append(status);rewards.append(card);
      }
      const canReserve=phase==='RESERVING'&&!data.reservationPaused;
      form.hidden=!!state.mine?.reservation;
      el('reservationSubmit').hidden=!canReserve;
      for(const control of form.querySelectorAll('.reservation-new-only'))control.hidden=!canReserve;
      el('reservationQuery').textContent=canReserve?'仅查询我的预约':'查询我的预约';
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
      el('reservationSticky').textContent=released?'下载月光茧':state.mine?.reservation?'查看我的预约':'立即预约';
    }
    function renderMine(data){
      state.mine=data;state.csrf=data?.csrf||state.csrf;
      const reservation=data?.reservation;
      el('reservationMine').hidden=!reservation;
      if(reservation){el('reservationMineText').textContent=`${data.phoneMasked} · 编号 ${reservation.code} · ${reservation.platform} · ${reservation.reminderSubscribed?'已订阅上线提醒':'未订阅上线提醒'}`;
        const rewardList=el('reservationMineRewards');rewardList.replaceChildren();
        const stateLabels={PENDING:'发放中',GRANTED:'已到账',ALREADY_OWNED:'已拥有同款'};
        for(const reward of reservation.rewards||[]){const item=doc.createElement('li');
          item.textContent=`${reward.tier} 档：${stateLabels[reward.state]||'核验中'}`;rewardList.append(item)}
        el('reservationUnsubscribe').hidden=!reservation.reminderSubscribed;
        message('预约记录已确认。正式上线后请使用同手机号账号进入 App。');}
      else if(data){message('未查到预约记录，请核对手机号。')}
      if(state.activity)renderActivity(state.activity);
    }
    function refreshActivity(){
      request('/activity').then(data=>{
        renderActivity(data);clearTimeout(refreshTimer);
        const now=Date.parse(data.serverTime),release=Date.parse(data.releaseAt),start=Date.parse(data.startAt);
        const next=[start,release,release+30*24*3600*1000].filter(time=>Number.isFinite(time)&&time>now)[0];
        const delay=next&&Number.isFinite(now)?Math.max(1000,Math.min(300000,next-now+100)):300000;
        refreshTimer=root.setTimeout(refreshActivity,delay);
      }).catch(()=>{
        if(!state.activity){form.hidden=true;message('活动信息暂不可用，请稍后重试。');el('reservationCount').textContent=''}
        clearTimeout(refreshTimer);refreshTimer=root.setTimeout(refreshActivity,60000);
      });
    }
    async function verify(){
      const phone=form.elements.phone.value.trim(),code=form.elements.code.value.trim();
      if(!validPhone(phone)||!/^\d{6}$/.test(code))throw new Error('请填写正确的大陆手机号和六位验证码');
      const data=await request('/verify','POST',{phone,code});state.verified=true;renderMine(data.mine);return data;
    }
    form.elements.phone.addEventListener('input',()=>{state.verified=false});
    el('reservationSms').addEventListener('click',async()=>{
      try{const phone=form.elements.phone.value.trim();if(!validPhone(phone))throw new Error('请输入正确的中国大陆手机号');
        await request('/sms','POST',{phone});message('验证码已发送');}catch(error){message(error.message)}
    });
    el('reservationQuery').addEventListener('click',async()=>{try{await verify()}catch(error){message(error.message)}});
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      if(!form.elements.adult.checked||!form.elements.terms.checked){message('请先确认已年满18周岁并同意协议与规则');return}
      try{
        if(!state.verified)await verify();
        if(state.mine?.reservation){message('该手机号已预约，已恢复原记录');return}
        const source=channel(root.sessionStorage.getItem('reservation_utm_source'));
        const campaignTag=channel(root.sessionStorage.getItem('reservation_utm_campaign'));
        const platform=selectedPlatform(form,root.navigator.userAgent);
        await request('/reserve','POST',{platform,adult:true,terms:true,reminder:form.elements.reminder.checked,
          source,campaignTag,deviceKind:/Mobi/i.test(root.navigator.userAgent)?'mobile':'desktop'});
        renderMine(await request('/mine'));
      }catch(error){
        refreshActivity();
        try{const mine=await request('/mine');if(mine.reservation){renderMine(mine);return}}catch(_){}
        message('暂未确认预约结果，请先查询我的预约；未成功可重试。'+error.message);
      }
    });
    el('reservationCopy').addEventListener('click',()=>{const code=state.mine?.reservation?.code;if(code)root.navigator.clipboard.writeText(code)});
    el('reservationPlatform').addEventListener('click',async()=>{try{const current=state.mine?.reservation?.platform;
      renderMine(await request('/platform','PATCH',{platform:current==='IOS'?'ANDROID':'IOS'}));}catch(error){message(error.message)}});
    el('reservationUnsubscribe').addEventListener('click',async()=>{try{renderMine(await request('/unsubscribe','POST',{}));message('已取消上线短信提醒，预约与奖励不受影响')}catch(error){message(error.message)}});
    el('reservationLogout').addEventListener('click',async()=>{try{await request('/logout','POST',{});state.mine=null;state.csrf=null;state.verified=false;form.reset();
      el('reservationMine').hidden=true;renderActivity(state.activity);message('已退出，请验证新的手机号')}catch(error){message(error.message)}});
    const updateSticky=()=>{
      const rect=el('reservation').getBoundingClientRect();
      el('reservationSticky').classList.toggle('reservation-sticky-hidden',rect.top<root.innerHeight&&rect.bottom>0);
    };
    root.addEventListener('scroll',updateSticky,{passive:true});root.addEventListener('resize',updateSticky);
    updateSticky();
    doc.addEventListener('visibilitychange',()=>{if(!doc.hidden)refreshActivity()});
    refreshActivity();
    request('/mine').then(renderMine).catch(()=>{});
    return state;
  }
  if(root.document)root.document.addEventListener('DOMContentLoaded',()=>init(root.document));
  return {init,validPhone,safeUrl,channel,selectedPlatform,DEFAULT_API_BASE};
});
