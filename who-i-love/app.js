/** @fileoverview 月光茧官网「我爱的角色」测评。浏览器内完成匹配，并用同目录素材生成人设卡。 */

(()=>{
const root=document.getElementById('who-i-love'),$=s=>root.querySelector(s);
const questions=[{"chapter": "初 遇", "title": "故事的开场，\n你想先遇见哪一幕？", "sub": "有些人一出场，连风都偏心。", "options": [{"tag": "雨夜 · 克制系", "title": "雨都偏向他，\n伞却偏向你。", "copy": "银发被雨打湿，他只淡淡说了一句：「顺路。」可你们明明住在反方向。", "kind": "quiet"}, {"tag": "逆光 · 直球系", "title": "他跑过整个操场，\n只问你有没有看见。", "copy": "刚赢下比赛的人没看记分牌，眼睛亮亮地找你：「刚才那球，帅不帅？」", "kind": "sunny"}, {"tag": "晚风 · 交锋系", "title": "他看穿了你的偷看，\n却先认了输。", "copy": "天台的风吹乱他的衣领。他侧过头笑：「再看下去，我会以为你喜欢我。」", "kind": "spark"}, {"tag": "灯下 · 温柔系", "title": "你找了很久的书，\n在他手里等你。", "copy": "书店快打烊了，他替你留着灯。扉页夹了张纸条：「这次，别错过结局。」", "kind": "gentle"}]}, {"chapter": "反 差", "title": "他的哪一秒，\n会让你偷偷改备注？", "sub": "人设可以很稳，心动偏要失控。", "options": [{"tag": "温柔里的小私心", "title": "对谁都从容，\n偏偏问你问了两遍。", "copy": "你随口夸了别人，他笑着点头。过了一会儿又问：「那……我呢？」", "kind": "gentle"}, {"tag": "冷脸突然掉线", "title": "脸还是冷的，\n耳朵已经投降。", "copy": "你只是替他理了理衣领。他站着没动，耳尖却红得很诚实。", "kind": "quiet"}, {"tag": "小狗也能挡风", "title": "平时拧不开瓶盖，\n此刻替你挡住人海。", "copy": "上一秒还在撒娇，拥挤的人群涌来时，他已经把你稳稳护在身侧。", "kind": "sunny"}, {"tag": "嘴强王者失语", "title": "平时最会逗你，\n被你一撩就静音。", "copy": "你学着他的语气说了句「想你了」。他准备好的俏皮话，突然一句都找不到。", "kind": "spark"}]}, {"chapter": "靠 近", "title": "你说「今天不太好」，\n最想等到哪种回应？", "sub": "心动是开场，被接住才想续章。", "options": [{"tag": "先替你把灯点亮", "title": "「饭快好了。\n你只负责回来。」", "copy": "他没急着追问，先把热汤放到你手边。等你愿意开口，他再认真听。", "kind": "quiet"}, {"tag": "和你站在同一边", "title": "「说吧，今天谁\n偷走了你的好心情？」", "copy": "他把抱枕塞进你怀里，一本正经地准备听你吐槽，连开场白都替你想好了。", "kind": "spark"}, {"tag": "连沉默都留位置", "title": "「不想说也没关系。\n我陪你坐一会儿。」", "copy": "他把音乐调轻，替你留出沙发的一半。今晚，不用努力把自己解释清楚。", "kind": "gentle"}, {"tag": "把安慰直接送达", "title": "「抱抱外卖到了，\n请问在哪里签收？」", "copy": "他站在门口，手里是你喜欢的甜点。认真问完，又小声补充：「我也想抱你。」", "kind": "sunny"}]}, {"chapter": "试 探", "title": "暧昧只差一层窗户纸，\n你希望怎样被戳破？", "sub": "再多一句，就藏不住了。", "options": [{"tag": "直球，不绕弯", "title": "「我喜欢你。\n这句没有开玩笑。」", "copy": "平时总是笑着的人，这次认真得有点笨拙，连准备好的后半句都忘了。", "kind": "sunny"}, {"tag": "留一步，等你来", "title": "「下次见面，\n可以算约会吗？」", "copy": "他把邀请说得很轻，却把时间空得很郑重。答案，交给你。", "kind": "gentle"}, {"tag": "把嘴硬拆给你看", "title": "「不是顺路。\n每一次，都是来见你。」", "copy": "他终于承认，那些巧合都练习过很久。你没接话，他又紧张地看了你一眼。", "kind": "quiet"}, {"tag": "棋逢对手的心跳", "title": "「你再靠近一点，\n我就当你也喜欢我。」", "copy": "你真的向前一步。他眼里的笑忽然认真起来，这回，轮到他心跳失控。", "kind": "spark"}]}, {"chapter": "往 后", "title": "故事翻到很久以后，\n哪一页让你舍不得合上？", "sub": "把轰轰烈烈，写进细水长流。", "options": [{"tag": "一起把日子过成彩蛋", "title": "八十岁了，\n还在互相使坏。", "copy": "他藏起你最后一颗糖，你换掉他的手机壁纸。吵吵闹闹，又一起笑到弯腰。", "kind": "spark"}, {"tag": "爱有安静的回声", "title": "灯为你留着，\n身旁的位置也是。", "copy": "你半夜醒来，他迷迷糊糊把被子拉向你。好多年了，还是下意识先照顾你。", "kind": "quiet"}, {"tag": "一直热烈，一直偏爱", "title": "恋爱谈了很久，\n他还像刚追到你。", "copy": "你不过是下楼拿个快递，他已经在窗边挥手。朋友都知道，他真的超爱。", "kind": "sunny"}, {"tag": "把浪漫藏进日常", "title": "书签换了很多张，\n收信人一直是你。", "copy": "一起散步，一起看旧电影。他偶尔还会写信，认真记录你们普通又珍贵的一天。", "kind": "gentle"}]}],types={"quiet": {"name": "冷月偏爱型", "line": "「不是顺路。每一次，都是来见你。」", "description": "你会被安静的行动打动，也会为藏不住的反差心软。比起把喜欢挂在嘴边，你更想看见他一次次认真走向你。"}, "sunny": {"name": "晴天直球型", "line": "「今天也想见你。这句，明天还算数。」", "description": "你喜欢可以感受到的在意，也喜欢毫不拐弯的心意。他会把想念说出口，再用行动给这句话盖章。"}, "spark": {"name": "晚风交锋型", "line": "「本来想逗你开心，结果先把自己搭进去了。」", "description": "你会为默契和交锋心动，也期待玩笑背后那一瞬间的认真。最合拍的浪漫，是两个人都接得住对方。"}, "gentle": {"name": "灯下长情型", "line": "「故事可以慢慢写。下一页，也想有你。」", "description": "你在意舒服的节奏，也珍惜被认真记住的小事。能让你停留的，是陪伴里始终留给你的空间。"}},quizId='love';
// AI Context: Single pointer-event state machine; no competing touch handlers or scroll paging.
const deck=$('.q-deck'),live=$('.q-live');let state={step:0,card:0,answers:[]},busy=false,timer=null,suppress=0,gesture=null,direction=1,wheel=0,lastWheel=0;
const wrap=(index)=>((index%4)+4)%4;
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
function save(){}
function restore(s){if(!s||![2,3,4,5,6].includes(s.version)||s.quizId!==quizId||!s.state||!Array.isArray(s.state.answers))return;const a=s.state.answers.slice(0,5);if(a.some(v=>!Number.isInteger(v)||v<0||v>3))return;state={answers:a,step:Math.max(0,Math.min(Number.isInteger(s.state.step)?s.state.step:0,a.length)),card:Math.max(0,Math.min(Number.isInteger(s.state.card)?s.state.card:0,3)),revealed:s.state.revealed===true};}
function announce(){if(state.step<5)live.textContent=`第${state.step+1}题，当前选项：${questions[state.step].options[state.card].title.replace(/\n/g,'')}`;}
function paint(progress=0,dx=0){
 const positions=[{x:0,y:0,rx:5,ry:-7,rz:-3,s:1},{x:19*direction,y:25,rx:5,ry:-2,rz:5*direction,s:.95},{x:-13*direction,y:40,rx:5,ry:3,rz:-5*direction,s:.9},{x:2,y:51,rx:5,ry:0,rz:2,s:.86}];
 const mix=(a,b,t)=>a+(b-a)*t;
 deck.querySelectorAll('.q-card').forEach((el,i)=>{const rank=wrap((i-state.card)*direction);const active=rank===0;el.dataset.active=String(active);el.disabled=busy;el.tabIndex=active?0:-1;el.setAttribute('aria-hidden',String(!active));el.style.zIndex=String(8-rank);let t;
 if(active){t={rx:positions[0].rx,x:dx,y:-Math.min(23,Math.abs(dx)*.055),rz:-3+dx/22,ry:-7+dx/40,s:1-progress*.025};el.style.opacity=String(1-Math.max(0,progress-.55)/.45);el.style.filter='brightness(1)';el.style.setProperty('--reveal','1');}
 else{const a=positions[rank],b=positions[rank-1];t={};for(const k of Object.keys(a))t[k]=mix(a[k],b[k],progress);el.style.opacity=rank===3?String(progress):'1';el.style.filter=`brightness(${mix(.79+(.03*(3-rank)),rank===1?1:.85,progress)})`;el.style.setProperty('--reveal',rank===1?String(progress):'0');}
 el.style.transform=`translateX(calc(-50% + ${t.x}px)) translateY(${t.y}px) rotateX(${t.rx}deg) rotateY(${t.ry}deg) rotateZ(${t.rz}deg) scale(${t.s})`;
 });
}
function turn(dir,alreadyDragged=false){if(busy||state.step>=5)return;direction=dir;busy=true;suppress=Date.now()+520;deck.classList.remove('q-returning','q-enter');if(!alreadyDragged)paint(0,0);void deck.offsetWidth;deck.classList.add('q-settling');paint(1,-dir*deck.clientWidth*1.18);timer=setTimeout(()=>{state.card=wrap(state.card+dir);busy=false;deck.classList.remove('q-settling');direction=1;paint();save();announce();},reduce()?0:440);}
function snapBack(){gesture=null;busy=true;deck.classList.add('q-returning');paint();timer=setTimeout(()=>{busy=false;deck.classList.remove('q-returning');direction=1;paint();},reduce()?0:270);}
function choose(i){if(busy||Date.now()<suppress||i!==state.card)return;busy=true;state.answers[state.step]=i;state.answers=state.answers.slice(0,state.step+1);deck.classList.remove('q-enter');deck.classList.add('q-picking');live.textContent='已选定';timer=setTimeout(()=>{state.step++;state.card=0;state.revealed=false;busy=false;deck.classList.remove('q-picking');render(true);save();announce();},reduce()?0:250);}
function back(){clearTimeout(timer);busy=false;gesture=null;deck.classList.remove('q-picking','q-settling','q-returning');if(state.step>0){state.revealed=false;state.step--;state.card=(state.answers[state.step] === undefined ? 0 : state.answers[state.step]);render();save();announce();}}
const people={"darkjade":{"id":"darkjade","kind":"quiet","analysisTitle":"冷月偏爱型","love":[0,1,0,2,1],"loved":[0,1,1,3,0],"name":"墨玉","job":"法医/暗夜裁定者","age":29,"line":"如果黑暗会靠近你，我会站在它和你之间。","quoted":true,"archetype":"","source":"official","matchLove":"你会被安静的行动打动，也会为藏不住的反差心软。比起把喜欢挂在嘴边，你更想看见他一次次认真走向你。","matchLoved":"你愿意给沉默留一点空间，也有自己的坚持。像他这样不轻易敞开心的人，可能会在你的理解里，慢慢卸下防备。","image":"./assets/4016ca2a828c6ef9.webp"},"amber":{"id":"amber","kind":"sunny","analysisTitle":"晴天直球型","love":[1,2,3,0,2],"loved":[1,3,0,2,1],"name":"琥珀","job":"体育系研究生/私人教练","age":22,"line":"只要你在终点等我，我就永远不会输。","quoted":true,"archetype":"","source":"official","matchLove":"你喜欢可以感受到的在意，也喜欢毫不拐弯的心意。他会把想念说出口，再用行动给这句话盖章。","matchLoved":"你表达在意的方式里，有让人安心的温度。像他这样总给别人带来快乐的人，也会想在你身边偶尔撒个娇。","image":"./assets/a6fc67e23964d1c9.webp"},"amethyst":{"id":"amethyst","kind":"spark","analysisTitle":"晚风交锋型","love":[2,3,1,3,0],"loved":[2,0,3,1,2],"name":"紫翎","job":"调酒师/地下舞见Joker","age":21,"line":"我是你的麻烦，也是你的解药。","quoted":true,"archetype":"","source":"official","matchLove":"你会为默契和交锋心动，也期待玩笑背后那一瞬间的认真。最合拍的浪漫，是两个人都接得住对方。","matchLoved":"你的回应里藏着自己的节奏，也接得住玩笑里的真心。像他这样擅长逗人的人，可能会先被你打乱心跳。","image":"./assets/8a10a26f10b69bbe.webp"},"emerald":{"id":"emerald","kind":"gentle","analysisTitle":"灯下长情型","love":[3,0,2,1,3],"loved":[3,2,2,0,3],"name":"翡","job":"自由摄影师/画廊主","age":27,"line":"胶卷的底片只有黑白，显影后才有了色彩。你就是我的显影液。","quoted":true,"archetype":"","source":"official","matchLove":"你在意舒服的节奏，也珍惜被认真记住的小事。能让你停留的，是陪伴里始终留给你的空间。","matchLoved":"你珍惜细微的感受，也愿意认真回应。像他这样把心事放进作品的人，可能会想把更多日常分享给你。","image":"./assets/d55ae03727e53aa2.webp"},"5EFWR53W":{"id":"5EFWR53W","kind":"quiet","analysisTitle":"霜雪藏糖型","love":[0,1,2,2,3],"loved":[2,0,0,3,0],"name":"谢停雪","job":"听雪峰峰主 / 剑修","age":32,"archetype":"冷淡师尊","matchLove":"你容易被克制里露出的一点偏爱打动。他不把情话挂在嘴边，却记得每一件关于你的小事。","matchLoved":"你不急着替沉默填空，也敢说出自己的选择。这会让习惯独自承担的他，愿意与你商量明天。","line":"教你断情绝念的人，先为你乱了方寸。","quoted":false,"source":"custom","image":"./assets/9309af45f5fffefd.webp","shareUrl":"https://lunakoru.com/c/sururYQB649fXV1A1aOpMZ","shareId":"sururYQB649fXV1A1aOpMZ","qrImage":"./assets/6df2338c3d5ab066.png","importEnvironment":"prod"},"ZMJS7JTC":{"id":"ZMJS7JTC","kind":"sunny","analysisTitle":"嘴硬心热型","love":[1,3,1,0,0],"loved":[1,0,3,2,1],"name":"周燃","job":"独立音乐制作人","age":24,"archetype":"嘴毒金毛","matchLove":"你喜欢有来有往的热闹，也在意玩笑背后有没有认真。他会陪你斗嘴，更会先一步站到你身边。","matchLoved":"你接得住他的玩笑，也看得见他的认真。他会发现，在你面前不用一直当那个负责逗人开心的人。","line":"嘴上说你跑调，歌单却全是写给你的。","quoted":false,"source":"custom","image":"./assets/d5ae9cc1252c1003.webp","shareUrl":"https://lunakoru.com/c/1GbwCjVxoBh0NEms7O3FPQ","shareId":"1GbwCjVxoBh0NEms7O3FPQ","qrImage":"./assets/7da8173552396bee.png","importEnvironment":"prod"},"YAL47MAN":{"id":"YAL47MAN","kind":"spark","analysisTitle":"撩人先心动型","love":[2,3,2,3,2],"loved":[2,3,2,1,0],"name":"绯烬","job":"夜间剧场主人 / 魅魔","age":126,"archetype":"魅魔","matchLove":"你会被张扬的吸引力勾住，也想看见面具后不熟练的真心。他的反差，恰好藏在谢幕之后。","matchLoved":"你没有只把他当成一场漂亮表演。那些认真又日常的关心，会让擅长暧昧的他第一次想给出确定答案。","line":"他什么情话都会，唯独不会回答：你是不是喜欢我。","quoted":false,"source":"custom","image":"./assets/c5d1416b9fb81d1d.webp","shareUrl":"https://lunakoru.com/c/86lIU5grP4hwrEy5Rvvwcp","shareId":"86lIU5grP4hwrEy5Rvvwcp","qrImage":"./assets/728e94ad2f892b95.png","importEnvironment":"prod"},"9HGYVXJH":{"id":"9HGYVXJH","kind":"gentle","analysisTitle":"斯文失措型","love":[3,1,2,1,2],"loved":[2,2,1,1,0],"name":"沈知序","job":"公共图书馆写作讲师 / 译者","age":24,"archetype":"年下老师","matchLove":"你喜欢有分寸的聪明，也会被认真到有些笨拙的直球击中。他能与你聊很远的事，也愿意承认自己的紧张。","matchLoved":"你尊重他的判断，也允许他偶尔不成熟。他会珍惜这种平等，慢慢敢把准备好的答案换成真实心事。","line":"道理讲得头头是道，被你夸一句就忘了下文。","quoted":false,"source":"custom","image":"./assets/0e6e9e66be94b487.webp","shareUrl":"https://lunakoru.com/c/FJmiPEr0S7pUWIJExJVHwk","shareId":"FJmiPEr0S7pUWIJExJVHwk","qrImage":"./assets/d709d6739d3d02e7.png","importEnvironment":"prod"},"JSR5H9BS":{"id":"JSR5H9BS","kind":"gentle","analysisTitle":"春日细语型","love":[3,0,2,0,3],"loved":[3,0,0,1,3],"name":"温以澜","job":"绘本画家 / 纸本修复师","age":26,"archetype":"温柔艺术家","matchLove":"你会被细腻的关注打动，也希望温柔背后有自己的坚持。他能珍惜你的感受，也能与你一起做决定。","matchLoved":"你愿意认真看他的小作品，也不要求他始终温柔完美。他会把与你相处的普通一天，画成最舍不得翻过的一页。","line":"画过很多春天，遇见你才知道风是什么颜色。","quoted":false,"source":"custom","image":"./assets/3fe5628637a64983.webp","shareUrl":"https://lunakoru.com/c/gCpq5FBkuqxj2bGqShOZdm","shareId":"gCpq5FBkuqxj2bGqShOZdm","qrImage":"./assets/eb13c86610693c9c.png","importEnvironment":"prod"},"A2P5SH34":{"id":"A2P5SH34","kind":"quiet","analysisTitle":"笃定偏爱型","love":[0,0,0,1,1],"loved":[2,1,1,0,2],"name":"裴凛","job":"古董钟表修复师 / 私人拍卖顾问","age":30,"archetype":"冷淡dom","matchLove":"你喜欢明确、可靠的回应，也想保有自己的选择。他的吸引力来自稳稳接住事情，同时认真听见你的意愿。","matchLoved":"你能坦白说出喜欢与不喜欢，让他不必靠猜测安排一切。他会愿意为你的节奏，调整自己一贯的秩序。","line":"他习惯掌控节奏，却把最后的选择留给你。","quoted":false,"source":"custom","image":"./assets/b12fff8d584b2c5d.webp","shareUrl":"https://lunakoru.com/c/XlMmKx6dWxasKpmohJ3Mdb","shareId":"XlMmKx6dWxasKpmohJ3Mdb","qrImage":"./assets/9115acc28280d872.png","importEnvironment":"prod"},"7WZ6LZ6B":{"id":"7WZ6LZ6B","kind":"quiet","analysisTitle":"提灯同行型","love":[0,2,0,2,3],"loved":[0,3,0,0,3],"name":"陆照霜","job":"巡山首席 / 剑修","age":27,"archetype":"清冷大师兄","matchLove":"你喜欢并肩同行的默契，也容易被认真守约的人打动。他的偏爱不喧哗，却会出现在每一次约好的见面里。","matchLoved":"你既信任他的可靠，也愿意替他分担。他会慢慢相信，在你面前不必永远站在最前面。","line":"门规背得一字不差，下山陪你却请好了假。","quoted":false,"source":"custom","image":"./assets/001f87d539974966.webp","shareUrl":"https://lunakoru.com/c/JEerEnQfUw4j8lgoT7Ob9c","shareId":"JEerEnQfUw4j8lgoT7Ob9c","qrImage":"./assets/1bdbb093af01fd43.png","importEnvironment":"prod"},"XLAF9XFX":{"id":"XLAF9XFX","kind":"sunny","analysisTitle":"竹马长情型","love":[3,0,0,0,1],"loved":[0,3,2,0,3],"name":"江叙","job":"社区建筑师","age":27,"archetype":"竹马哥","matchLove":"你珍惜相处里的自然与熟悉，也希望自己变化后仍被认真认识。他记得从前，更愿意听你讲现在。","matchLoved":"你愿意看见可靠之外的他，而不只把他当成随叫随到的老朋友。这会让他有勇气把熟悉，往心动的方向走一步。","line":"别人问你的理想型，他比你先紧张。","quoted":false,"source":"custom","image":"./assets/73e55f8fdacd4b85.webp","shareUrl":"https://lunakoru.com/c/1XUDMMoaYksVjC9canPLeT","shareId":"1XUDMMoaYksVjC9canPLeT","qrImage":"./assets/41dd0015b577bce8.png","importEnvironment":"prod"},"YDYCPKNB":{"id":"YDYCPKNB","kind":"gentle","analysisTitle":"夜林知己型","love":[3,1,2,2,3],"loved":[3,2,3,2,0],"name":"伊瑟尔","job":"夜林档案守护者 / 植物绘图师","age":128,"archetype":"西幻精灵","matchLove":"你会被陌生世界的细节吸引，也珍惜慢慢靠近的过程。他的神秘不是拒人千里，而是一片愿意为你打开的夜林。","matchLoved":"你愿意分享普通生活，也允许彼此有不同的节奏。这会让看惯漫长岁月的他，开始期待下一次具体的见面。","line":"见过百年的月亮，却想研究你为什么会笑。","quoted":false,"source":"custom","image":"./assets/5c8bbe1e34bdf601.webp","shareUrl":"https://lunakoru.com/c/uhldaHDkSUYhAF0wVjjPPO","shareId":"uhldaHDkSUYhAF0wVjjPPO","qrImage":"./assets/265d2d06065feafb.png","importEnvironment":"prod"}};
function affinity(person,index,answer){
 const preferred=person[quizId][index];
 return answer===preferred?3:(questions[index].options[answer].kind===questions[index].options[preferred].kind?1:0);
}
function matchResult(){
 const weights=[2,2,3,3,2];
 const ranked=Object.values(people).map(person=>{
  const contributions=state.answers.map((answer,index)=>affinity(person,index,answer)*weights[index]);
  return {person,contributions,score:contributions.reduce((a,b)=>a+b,0)};
 });
 ranked.sort((a,b)=>{
  if(a.score!==b.score)return b.score-a.score;
  for(let i=4;i>=0;i--)if(a.contributions[i]!==b.contributions[i])return b.contributions[i]-a.contributions[i];
  return a.person.id<b.person.id?-1:a.person.id>b.person.id?1:0;
 });
 return ranked[0];
}

function loadCardImage(src){return new Promise((resolve,reject)=>{
 const image=new Image();const timer=setTimeout(()=>{image.onload=null;image.onerror=null;reject(new Error('图片加载超时，请点击重试。'));},15000);
 image.onload=()=>{clearTimeout(timer);resolve(image);};image.onerror=()=>{clearTimeout(timer);reject(new Error('图片加载失败，请点击重试。'));};image.src=src;
});}
function cardLines(ctx,text,width){
 const lines=[];let line='';
 for(const c of text){if(c==='\n'){lines.push(line);line='';continue;}if(line&&ctx.measureText(line+c).width>width){lines.push(line);line=c;}else line+=c;}
 if(line)lines.push(line);return lines;
}
async function createPersonaPng(person){
 const [portrait,qr]=await Promise.all([loadCardImage(person.image),
     person.shareUrl && person.qrImage ? loadCardImage(person.qrImage) : null]);
 const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;
 const c=canvas.getContext('2d');if(!c)throw new Error('当前浏览器无法生成图片，请换浏览器打开。');
 const bg=c.createLinearGradient(0,0,1080,1560);bg.addColorStop(0,'#63799e');bg.addColorStop(.45,'#3d537e');bg.addColorStop(1,'#172b49');c.fillStyle=bg;c.fillRect(0,0,1080,1920);
 // Foil stays behind the illustration; no bright overlays on the face or type.
 const foil=c.createLinearGradient(0,100,1080,950);[['#7e83cc',0],['#ad94bc',.23],['#a5c9c5',.48],['#548eb7',.73],['#7976b4',1]].forEach(([color,stop])=>foil.addColorStop(stop,color));
 c.fillStyle=foil;c.fillRect(0,0,1080,1580);
 const halo=c.createRadialGradient(530,340,30,530,490,660);halo.addColorStop(0,'rgba(246,241,231,0.4196)');halo.addColorStop(.6,'rgba(210,239,245,0.1020)');halo.addColorStop(1,'rgba(201,220,242,0.0000)');c.fillStyle=halo;c.fillRect(0,0,1080,1424);
 c.strokeStyle='rgba(230,247,255,0.2510)';c.lineWidth=1;c.beginPath();c.ellipse(540,600,430,520,-.3,0,Math.PI*2);c.stroke();
 for(let i=0;i<30;i++){c.fillStyle=i%7?'rgba(236,248,255,0.4392)':'#fff';c.beginPath();c.arc(46+(i*173)%990,70+(i*137)%1300,i%7?1.8:3,0,Math.PI*2);c.fill();}
 // One full-width 1080 lossless portrait, without re-capturing a scaled DOM layer.
 c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(portrait,0,28,1080,portrait.height*1080/portrait.width);
 const shade=c.createLinearGradient(0,830,0,1570);shade.addColorStop(0,'rgba(23,43,73,0.0000)');shade.addColorStop(.45,'rgba(23,43,73,0.8118)');shade.addColorStop(.73,'rgba(23,43,73,0.9608)');shade.addColorStop(1,'#172b49');c.fillStyle=shade;c.fillRect(0,830,1080,750);
 c.textBaseline='top';c.fillStyle='#d3e5f6';c.font='23px "PingFang SC",sans-serif';c.fillText(quizId==='love'?'与你心动同频的他':'可能为你心动的他',76,1110);
 c.fillStyle='#f7f7ff';c.font='86px "Songti SC","STSong",serif';c.fillText(person.name,72,1165);
 c.fillStyle='#c8d8ec';c.font='26px "PingFang SC",sans-serif';
 const meta=cardLines(c,`${person.archetype?person.archetype+' · ':''}${person.job} · ${person.age}岁`,916);meta.forEach((line,i)=>c.fillText(line,76,1270+i*43));
 c.fillStyle='#f1f3ff';c.font='35px "Songti SC","STSong",serif';cardLines(c,person.line,916).forEach((line,i)=>c.fillText(line,76,1337+(meta.length-1)*43+i*60));
 // Pearl footer flows out of the navy panel; QR keeps an untouched white quiet zone.
 const pearl=c.createLinearGradient(24,1530,1056,1920);pearl.addColorStop(0,'#dbe4f0');pearl.addColorStop(.45,'#f4f6fb');pearl.addColorStop(1,'#deebef');c.fillStyle=pearl;c.fillRect(0,1524,1080,396);
 const seam=c.createLinearGradient(70,0,1010,0);seam.addColorStop(0,'#c0b9dd');seam.addColorStop(.5,'#fffdf3');seam.addColorStop(1,'#a9dce2');c.fillStyle=seam;c.fillRect(0,1524,1080,2);
 c.fillStyle='#344e73';c.font='43px "Songti SC","STSong",serif';c.fillText('月光茧',76,1618);
 c.fillStyle='#74829b';c.font='italic 20px Georgia,serif';c.fillText('LunaKoru',222,1638);
 c.fillStyle='#455b7b';c.font='30px "Songti SC","STSong",serif';c.fillText('虚实有别，爱意无界',76,1694);
 c.fillStyle='#6b7d98';c.fillRect(76,1750,52,1);
 if(qr){c.font='23px "PingFang SC",sans-serif';c.fillText('月光茧 App · 导入人设卡',76,1780);c.fillText('从相册选中此图，开启你们的故事',76,1820);
 if(qr.width>300||qr.height!==qr.width)throw new Error('二维码尺寸异常，请重新生成。');
 const qx=Math.round(873-qr.width/2),qy=Math.round(1700-qr.height/2);
 c.fillStyle='#ffffff';c.beginPath();cardRoundRect(c,qx-10,qy-10,qr.width+20,qr.height+20,16);c.fill();
 c.imageSmoothingEnabled=false;c.drawImage(qr,qx,qy);
 }else{
  c.font='30px "PingFang SC",sans-serif';
  c.fillText('打开月光茧 App，选择「邂逅他」',76,1770);
  c.fillText('在官方角色中选择'+person.name,76,1820);
 }
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('图片生成失败，请重试。')),'image/png'));
}
function cardRoundRect(c,x,y,w,h,r){
 r=Math.min(r,w/2,h/2);c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);
 c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);
 c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();
}

let cleanupResultCard = () => {};
function bindResultActions(person) {
 const saveButton = $('.q-save-card');
 const inviteShare = $('[data-type="card"]');
 const inviteLink = $('.q-invite-link');
 const status = $('.q-share-panel [role="status"]');
 const saveStatus = $('.q-save-status');
 const fileName = '月光茧-' + person.name + '-人设卡.png';
 const quizUrl = document.querySelector('link[rel="canonical"]').href;
 let cardUrl;

 cleanupResultCard = () => {
  if (cardUrl) URL.revokeObjectURL(cardUrl);
 };

 async function prepareCard() {
  saveButton.disabled = true;
  saveButton.textContent = '正在准备图片…';
  saveStatus.textContent = '';
  try {
   const png = await createPersonaPng(person);
   if (!saveButton.isConnected) return;
   cardUrl = URL.createObjectURL(png);
   saveButton.textContent = '下载人设卡';
  } catch {
   saveButton.textContent = '重试生成图片';
   saveStatus.textContent = '图片生成失败，请重试。';
  } finally {
   saveButton.disabled = false;
  }
 }

 saveButton.addEventListener('click', () => {
  if (!cardUrl) {
   void prepareCard();
   return;
  }
  const download = document.createElement('a');
  download.href = cardUrl;
  download.download = fileName;
  saveButton.after(download);
  download.click();
  download.remove();
 });

 inviteLink.value = quizUrl;
 inviteShare.addEventListener('click', async () => {
  inviteLink.hidden = true;
  status.textContent = '';
  try {
   if (navigator.share) {
    await navigator.share({ title: document.title, url: quizUrl });
    return;
   }
  } catch (error) {
   if (error.name === 'AbortError') return;
  }
  try {
   await navigator.clipboard.writeText(quizUrl);
   status.textContent = '测评链接已复制。';
  } catch {
   inviteLink.hidden = false;
   inviteLink.focus();
   inviteLink.select();
   status.textContent = '请复制上方的测评链接。';
  }
 });

 void prepareCard();
}

function bindPortraitRetry(person){
 const art=$('.q-person-art'),image=art.querySelector('img');
 const retry=document.createElement('button');retry.type='button';retry.className='q-portrait-retry';retry.hidden=true;
 retry.textContent='立绘加载失败，点击重试';$('.q-person').appendChild(retry);
 image.addEventListener('error',()=>{retry.hidden=false;});image.addEventListener('load',()=>{retry.hidden=true;});
 retry.addEventListener('click',()=>{retry.hidden=true;image.src=person.image;});
 if(image.complete&&!image.naturalWidth)retry.hidden=false;
}
function updateViewportHeight() {
 $('.q-screen').style.setProperty('--app-height', window.innerHeight + 'px');
}

let holoCleanup=()=>{};
function bindHolo(stage){
 let raf=0,down=null,blockUntil=0,current={x:0,y:0},target={x:0,y:0};
 const clamp=v=>Math.max(-1,Math.min(1,v));
 const apply=()=>{
  const spring=down ? 1 : .16;
  current.x+=(target.x-current.x)*spring;current.y+=(target.y-current.y)*spring;
  const x=current.x,y=current.y,power=Math.min(1,Math.hypot(x,y));
  const vars={'--tilt-x':`${y*19+2}deg`,'--tilt-y':`${-x*26-3}deg`,'--art-x':`${x*17}px`,'--art-y':`${y*11}px`,'--bg-x':`${-x*13}px`,'--bg-y':`${-y*9}px`,'--text-x':`${x*1.8}px`,'--text-y':`${y*1.2}px`,'--shadow-x':`${-x*12}px`,'--shadow-y':`${18-y*8}px`,'--mx':`${50+x*45}%`,'--my':`${32+y*35}%`,'--foil-x':`${50-x*37+y*10}%`,'--foil-y':`${50+y*37-x*10}%`,'--foil-angle':`${115+x*25-y*18}deg`,'--foil-strength':String(.56+power*.4),'--cloth-strength':String(.12+power*.2)};
  for(const [key,value] of Object.entries(vars))stage.style.setProperty(key,value);
  if(Math.abs(target.x-x)+Math.abs(target.y-y)>.002)raf=requestAnimationFrame(apply);else raf=0;
 };
 const schedule=()=>{if(!raf&&!document.hidden&&!reduce())raf=requestAnimationFrame(apply);};
 const reset=()=>{target={x:0,y:0};schedule();};
 const isCardControl=event=>event.target.closest('.q-flip-back, .q-portrait-retry');
 function holdTilt(){
  cancelAnimationFrame(raf);
  raf=0;
 }
// Both input paths share the same drag threshold and click suppression.
 function followContact(x,y){
  const r=down.bounds;
  target={x:clamp(((x-r.left)/r.width-.5)*2.2),y:clamp(((y-r.top)/r.height-.5)*2.2)};
  schedule();
 }
 function begin(x,y,id){
  if(down || reduce())return;
  down={x:x,y:y,id:id,moved:false,bounds:stage.getBoundingClientRect()};
  followContact(x,y);
 }
 function move(x,y,id,touch){
  if(!down || id!==down.id)return false;
  const dx=x-down.x,dy=y-down.y;
  if(!down.moved){
   if(Math.max(Math.abs(dx),Math.abs(dy))<6)return false;
   if(touch && Math.abs(dy)>Math.abs(dx)){down=null;reset();return false;}
   down.moved=true;
  }
  followContact(x,y);
  blockUntil=Date.now()+450;return true;
 }
 function end(id){
  if(!down || down.id!==id)return;
  if(down.moved)blockUntil=Date.now()+450;
  down=null;reset();
 }
 stage.addEventListener('touchstart',e=>{
  if(e.touches.length!==1){if(down)end(down.id);return;}
  if(isCardControl(e)){holdTilt();return;}
  const t=e.touches[0];begin(t.clientX,t.clientY,t.identifier);
 },{passive:true});
 stage.addEventListener('touchmove',e=>{
  if(e.touches.length!==1)return;
  const t=e.touches[0];
  if(move(t.clientX,t.clientY,t.identifier,true) && e.cancelable)e.preventDefault();
 },{passive:false});
 const finishTouch=e=>{for(let i=0;i<e.changedTouches.length;i++)end(e.changedTouches[i].identifier);};
 stage.addEventListener('touchend',finishTouch);
 stage.addEventListener('touchcancel',finishTouch);
 stage.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch' || e.button!==0)return;
  if(isCardControl(e)){holdTilt();return;}
  begin(e.clientX,e.clientY,e.pointerId);
 });
 stage.addEventListener('pointermove',e=>{
  if(e.pointerType==='touch' || reduce())return;
  if(down){
   if(move(e.clientX,e.clientY,e.pointerId,false) && stage.setPointerCapture)stage.setPointerCapture(e.pointerId);
  }else{
   if(isCardControl(e)){holdTilt();return;}
   const r=stage.getBoundingClientRect();
   target={x:clamp((e.clientX-r.left)/r.width*2-1),y:clamp((e.clientY-r.top)/r.height*2-1)};schedule();
  }
 });
 const finishPointer=e=>{if(e.pointerType!=='touch')end(e.pointerId);};
 stage.addEventListener('pointerup',finishPointer);
 stage.addEventListener('pointercancel',finishPointer);
 stage.addEventListener('lostpointercapture',finishPointer);
 stage.addEventListener('pointerleave',()=>{if(!down)reset();});
 stage.addEventListener('click',e=>{if(Date.now()<blockUntil&&!isCardControl(e)){e.preventDefault();e.stopImmediatePropagation();}},true);
 stage.addEventListener('keydown',e=>{if(reduce())return;const keys={ArrowLeft:[-.35,0],ArrowRight:[.35,0],ArrowUp:[0,-.35],ArrowDown:[0,.35]};if(keys[e.key]){e.preventDefault();const [x,y]=keys[e.key];target={x:clamp(target.x+x),y:clamp(target.y+y)};schedule();}else if(e.key==='Escape'){e.preventDefault();reset();}});
 stage.addEventListener('dragstart',e=>e.preventDefault());
 return holdTilt;
}

function renderResult(enter){
 const result=matchResult(),person=result.person,kind=person.kind,r={name:person.analysisTitle};
 const selected=state.answers.map((a,i)=>({option:questions[i].options[a],score:result.contributions[i],index:i}));
 const evidence=selected.sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,2).sort((a,b)=>a.index-b.index).map(({option})=>`「${option.title.replace(/\n/g,'').replace(/[「」]/g,'')}」`).join('，也选了');
 const container=$('.q-result');
 container.classList.toggle('is-arriving',!!enter);
 container.innerHTML=`<p class="q-result-intro">${quizId==='love'?'原来，你会为这样的他心动':'这样的你，会让谁心动？'}</p><div class="q-flip-stage" data-kind="${kind}" data-character="${person.id}" data-source="${person.source}"><div class="q-flipper"><button class="q-face q-analysis cursor-interaction" aria-label="翻开分析卡，揭晓对应角色"><span class="q-foil" aria-hidden="true"></span><span class="q-glare" aria-hidden="true"></span><span class="q-rim" aria-hidden="true"></span><span class="q-analysis-kicker">${quizId==='love'?'你的心动，藏在选择里':'你的选择，写出了你的温柔'}</span><strong class="q-analysis-title">${r.name}</strong><span class="q-evidence">你选了${evidence}</span><span class="q-reading">${quizId==='love'?person.matchLove:person.matchLoved}</span><span class="q-flip-cta">翻开，看看他</span></button><section class="q-face q-person" aria-label="匹配角色：${person.name}" aria-hidden="true" inert><div class="q-material-bed"><div class="q-scene" aria-hidden="true"></div><div class="q-sparkles" aria-hidden="true">${Array.from({length:46},(_,i)=>`<span class="q-spark" style="left:${(i*67+11)%100}%;top:${(i*43+7)%100}%;--spark-a:${.25+(i%6)*.12}"></span>`).join('')}</div><span class="q-foil" aria-hidden="true"></span><span class="q-glare" aria-hidden="true"></span><span class="q-sweep" aria-hidden="true"></span></div><div class="q-person-art"><img src="${person.image}" alt="${person.name}角色立绘" draggable="false"><span class="q-clothes-foil" aria-hidden="true" style="--portrait:url('${person.image}')"></span></div><div class="q-person-shade" aria-hidden="true"></div><span class="q-rim" aria-hidden="true"></span><span class="q-sweep" aria-hidden="true"></span><div class="q-person-caption"><p class="q-person-label">${quizId==='love'?'与你心动同频的他':'可能为你心动的他'}</p><h2>${person.name}</h2><p class="q-person-meta">${person.archetype?person.archetype+' · ':''}${person.job} · ${person.age}岁</p><blockquote>${person.quoted?'「'+person.line+'」':person.line}</blockquote><button class="q-flip-back cursor-interaction">再看分析</button></div></section></div></div>
 <div class="q-result-controls">
  <div class="q-save-wrap" hidden>
   <button type="button" class="q-save-card" disabled>下载人设卡</button>
   <p class="q-save-status" role="status"></p>
   <p class="q-save-guide">${person.source === 'official'
    ? `打开月光茧 App，选择「邂逅他」，在官方角色中选择${person.name}。`
    : '将图片保存到相册，再到月光茧 App 选择「导入人设卡」。'}</p>
  </div>
  <figure class="q-invite-qr">
   <figcaption>扫码来测</figcaption>
   <img src="./assets/quiz-invite-qr.png" width="129" height="129" alt="「我爱的角色」测评二维码">
  </figure>
  <div class="q-share-panel">
   <div class="q-share-buttons">
    <a href="https://www.lunakoru.com/">了解月光茧</a>
    <button type="button" data-type="card">邀请好友来测</button>
   </div>
   <input type="url" class="q-invite-link" aria-label="测评链接" readonly hidden>
   <p role="status"></p>
  </div>
 </div>`;
 const flip=(reveal,focus=false)=>{
  state.revealed=reveal;container.classList.toggle('show-share',reveal);
  const saveWrap=$('.q-save-wrap');if(saveWrap)saveWrap.hidden=person.source==='official' && !reveal;
  $('.q-flip-stage').classList.toggle('is-revealed',reveal);
  const front=$('.q-analysis'),rear=$('.q-person');
  front.inert=reveal;front.tabIndex=reveal?-1:0;front.setAttribute('aria-hidden',String(reveal));
  rear.inert=!reveal;$('.q-flip-back').tabIndex=reveal?0:-1;rear.setAttribute('aria-hidden',String(!reveal));
  if(focus){(reveal?$('.q-flip-back'):front).focus({preventScroll:true});save();live.textContent=reveal?`为你揭晓：${person.name}`:`${r.name}，点击卡片揭晓角色`;}
 };
 $('.q-analysis').addEventListener('click',()=>flip(true,true));
 $('.q-flip-back').addEventListener('click',()=>flip(false,true));

 bindResultActions(person);bindPortraitRetry(person);holoCleanup=bindHolo($('.q-flip-stage'));
 flip(!!state.revealed);live.textContent=state.revealed?`为你揭晓：${person.name}`:`${r.name}，点击卡片揭晓角色`;
}

function render(enter=false){cleanupResultCard();cleanupResultCard=()=>{};holoCleanup();const done=state.step===5;$('.q-screen').classList.toggle('show-result',done);restart.hidden=!done;$('.q-quiz').hidden=done;$('.q-result').hidden=!done;if(done){renderResult(enter);return;}
const q=questions[state.step];$('.q-count').setAttribute('role','img');$('.q-count').setAttribute('aria-label',`第 ${state.step+1} 题，共 5 题`);$('.q-count').innerHTML=questions.map((_,i)=>`<span aria-hidden="true" class="q-star ${i<state.step?'is-done':i===state.step?'is-current':''}">✦</span>`).join('');$('.q-question').textContent=q.title;deck.innerHTML='<div class="q-floor" aria-hidden="true"></div>'+q.options.map((o,i)=>`<button class="q-card cursor-interaction" aria-label="选择：${o.title.replace(/\n/g,'')} ${o.copy}"><div class="q-text"><h3 class="q-answer">${o.title}</h3><p class="q-detail">${o.copy}</p></div><div class="q-card-end"><span class="q-select">选这个</span></div></button>`).join('');deck.querySelectorAll('.q-card').forEach((el,i)=>el.addEventListener('click',()=>choose(i)));$('.q-back').disabled=state.step===0;direction=1;paint();deck.classList.toggle('q-enter',enter);}
$('.q-back').addEventListener('click',back);
const restart = document.createElement('button');
restart.type = 'button';
restart.className = 'q-restart cursor-interaction';
restart.hidden = true;
restart.textContent = '重新测试';
$('.q-top').prepend(restart);
restart.addEventListener('click', () => {
 state = {step:0,card:0,answers:[],revealed:false};
 suppress = 0;
 render();
 save();
 announce();
});
// Touch input is handled separately from mouse input. The entire deck accepts swipes.
function beginSwipe(x,y,id,card){if(busy||state.step>=5)return;deck.classList.remove('q-enter');gesture={id,x,y,dx:0,start:performance.now(),lastX:x,lastTime:performance.now(),velocity:0,moved:false,card};}
function dragSwipe(x,y){const g=gesture;if(!g)return;const dx=x-g.x,dy=y-g.y;if(!g.moved&&Math.abs(dy)>Math.abs(dx)*1.35&&Math.abs(dy)>16){gesture=null;return;}if(Math.abs(dx)>6||g.moved){g.moved=true;g.dx=dx;const now=performance.now();g.velocity=(x-g.lastX)/Math.max(1,now-g.lastTime);g.lastTime=now;g.lastX=x;direction=dx<=0?1:-1;suppress=Date.now()+450;paint(Math.min(.92,Math.abs(dx)/(deck.clientWidth*.73)),dx);}}
function endSwipe(x){const g=gesture;if(!g)return;gesture=null;if(!g.moved)return;const dx=x-g.x;suppress=Date.now()+450;const speed=performance.now()-g.lastTime<120?Math.abs(g.velocity):0;if(Math.abs(dx)>Math.max(30,deck.clientWidth*.10)||(Math.abs(dx)>18&&speed>.4))turn(dx<0?1:-1,true);else snapBack();}
function cancelSwipe(){const g=gesture;gesture=null;if((g && g.moved))snapBack();}
deck.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;const t=e.touches[0];beginSwipe(t.clientX,t.clientY,'touch',deck.querySelector('.q-card[data-active="true"]'));},{passive:true});
deck.addEventListener('touchmove',e=>{if((gesture && gesture.id)!=='touch')return;const t=e.touches[0];dragSwipe(t.clientX,t.clientY);if((gesture && gesture.moved)&&e.cancelable)e.preventDefault();},{passive:false});
deck.addEventListener('touchend',e=>{if((gesture && gesture.id)==='touch')endSwipe(e.changedTouches[0].clientX);},{passive:true});
deck.addEventListener('touchcancel',()=>{if((gesture && gesture.id)==='touch')cancelSwipe();},{passive:true});
deck.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||e.button!==0)return;beginSwipe(e.clientX,e.clientY,e.pointerId,e.target.closest('.q-card')||deck.querySelector('.q-card[data-active="true"]'));});
deck.addEventListener('pointermove',e=>{if(e.pointerType==='touch'||(gesture && gesture.id)!==e.pointerId)return;dragSwipe(e.clientX,e.clientY);if((gesture && gesture.moved)){if(!gesture.card.hasPointerCapture(e.pointerId))gesture.card.setPointerCapture(e.pointerId);if(e.cancelable)e.preventDefault();}},{passive:false});
deck.addEventListener('pointerup',e=>{if(e.pointerType!=='touch'&&(gesture && gesture.id)===e.pointerId)endSwipe(e.clientX);});
deck.addEventListener('pointercancel',e=>{if(e.pointerType!=='touch'&&(gesture && gesture.id)===e.pointerId)cancelSwipe();});
deck.addEventListener('lostpointercapture',e=>{if((gesture && gesture.id)===e.pointerId)cancelSwipe();});
deck.addEventListener('wheel',e=>{if(Math.abs(e.deltaX)<=Math.abs(e.deltaY))return;e.preventDefault();if(busy||Date.now()-lastWheel<600)return;wheel+=e.deltaX;if(Math.abs(wheel)>28){turn(wheel>0?1:-1);wheel=0;lastWheel=Date.now();}},{passive:false});
deck.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();turn(e.key==='ArrowRight'?1:-1);}});
render();const startup=$('.q-startup-note');if(startup)startup.remove();updateViewportHeight();window.addEventListener('resize',updateViewportHeight);
})();
