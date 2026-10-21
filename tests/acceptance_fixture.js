/* Synthetic browser fixture only; served exclusively by acceptance_fixture.py. */
(() => {
  const originalFetch = window.fetch.bind(window), calls = [];
  const ended = acceptanceScenario === 'ended';
  const released = ended || acceptanceScenario === 'claiming';
  const codes = released?[{tier:3,code:'MGJ-'+'A'.repeat(43),redeemed:false,expiresAt:new Date(Date.now()+(ended?-1:1)*86400000).toISOString()}]:[];
  let verified = released, receipt = released ? {code:'RG-SYNTHETIC',platform:'ANDROID',reminderSubscribed:false,rewards:[]} : null;
  const mine = () => ({phoneMasked:'*** **** 8000',csrf:'synthetic-csrf',expiresAt:new Date(Date.now()+86400000).toISOString(),reservation:receipt,
    activationCodes:codes.slice()});
  window.fetch = async (input, options = {}) => {
    const url = new URL(input, location.href);
    if (!url.pathname.startsWith('/api/reservation-gift/')) return originalFetch(input, options);
    const path = url.pathname.slice('/api/reservation-gift'.length), body = options.body ? JSON.parse(options.body) : {};
    calls.push({path,reminder:body.reminder});
    const output = document.getElementById('qaCalls');
    if(output)output.textContent='MOCK API — '+JSON.stringify(calls);
    const response = (data,status=200) => new Response(JSON.stringify({result:status===200?0:status,data}),{status,headers:{'Content-Type':'application/json'}});
    if(path==='/activity')return response({available:true,phase:acceptanceScenario==='before'?'BEFORE':ended?'ENDED':released?'CLAIMING':'RESERVING',serverTime:new Date().toISOString(),startAt:new Date(Date.now()+7200000).toISOString(),claimDeadlineAt:new Date(Date.now()+(ended?-1:1)*86400000).toISOString(),count:released?100000:1,unlockedMask:released?7:0,reminderAvailable:!released,claimAvailable:released&&!ended});
    if(path==='/lookup')return response({publicLookup:true,phoneMasked:'*** **** 8001',reservation:body.phone==='13800138001'?{code:'RG-DUPLICATE',platform:'ANDROID',reminderSubscribed:false,rewards:[]}:null});
    if(path==='/verify'){
      await new Promise(resolve=>setTimeout(resolve,600));
      if(acceptanceScenario==='failure')return response({},500);
      verified=true;return response({mine:mine()});
    }
    if(path==='/sms')return response({sent:true});
    if(path==='/reserve'){receipt={code:'RG-SYNTHETIC',platform:body.platform,reminderSubscribed:!!body.reminder,rewards:[]};return response(receipt);}
    if(path==='/mine')return verified?response(mine()):response({},401);
    if(path==='/activation-code'){
      let code=codes.find(code=>code.tier===body.tier);
      if(!code){code={tier:body.tier,code:'MGJ-'+String(body.tier).repeat(43),redeemed:false,expiresAt:new Date(Date.now()+86400000).toISOString()};codes.push(code);}
      return response(code);
    }
    if(path==='/logout'){verified=false;return response({});}
    return response({},403);
  };
})();
