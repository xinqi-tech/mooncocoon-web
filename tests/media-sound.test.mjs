import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const code=html.slice(html.indexOf('function silenceVideos('),html.indexOf('// Module tabs'));
function setup(){
 const listeners={},bgm={paused:false,pause(){this.paused=true;},addEventListener(n,fn){listeners['bgm-'+n]=fn;}};
 const button={classList:{remove(){}},setAttribute(){}};
 const pv={muted:true,paused:true,pause(){this.paused=true;},addEventListener(n,fn){listeners[n]=fn;}};
 const videos=[pv,{muted:true,play(){return Promise.resolve();}},{muted:false,play(){return Promise.resolve();}}];
 const ctx=vm.createContext({document:{getElementById:id=>id==='bgmAudio'?bgm:button,querySelector:()=>pv,querySelectorAll:q=>q==='video'?videos:[]}});
 vm.runInContext(code,ctx);
 return {ctx,videos,bgm,listeners};
}
test('开启当前视频声音会静音其他视频并暂停背景音乐',()=>{
 const x=setup();x.ctx.playFeature(x.videos[1]);
 assert.equal(x.videos[1].muted,false);assert.equal(x.videos[2].muted,true);assert.equal(x.bgm.paused,true);
});
test('背景音乐开始播放会静音全部视频，PV取消静音会暂停背景音乐',()=>{
 const x=setup();x.listeners['bgm-play']();assert.ok(x.videos.every(v=>v.muted));
 x.videos[0].muted=false;x.listeners.volumechange({target:x.videos[0]});assert.equal(x.bgm.paused,true);
});
test('浏览器拒绝自动播放时保留有声，点击后可重试',async()=>{
 const x=setup();x.videos[1].play=()=>Promise.reject(new Error('autoplay blocked'));
 x.ctx.playFeature(x.videos[1]);await Promise.resolve();assert.equal(x.videos[1].muted,false);
 let retried=false;x.videos[1].play=()=>{retried=true;return Promise.resolve();};
 x.ctx.playFeature(x.videos[1]);assert.equal(retried,true);assert.equal(x.videos[1].muted,false);
});

test('侧边预览保持静音且不生成声音开关按钮',()=>{
 const x=setup();x.ctx.playFeature(x.videos[1],false);assert.equal(x.videos[1].muted,true);
 assert.doesNotMatch(html,/sound\.className='video-sound'|sound\.textContent='开启声音'/);
});

test('手机原生播放不依赖外层点击，直接暂停背景音乐与其他视频',()=>{
 const x=setup();x.videos[0].muted=false;x.listeners.play();
 assert.equal(x.videos[0].muted,false);assert.equal(x.videos[2].muted,true);assert.equal(x.bgm.paused,true);
 const pv=html.match(/<div class="hero-video" id="pvVideo">\s*(<video[^>]+>)/)[1];
 assert.match(pv,/\ssrc="videos\/pv\.mp4\?v=20261024"/);
 assert.match(pv,/playsinline.*controls preload="none"/);
 assert.doesNotMatch(code,/requestFullscreen|webkitEnterFullscreen|pvWrap\.addEventListener/);
});

test('背景音乐初始化不会提前静音尚未开始的PV',()=>{
 const x=setup();x.videos[0].muted=false;x.listeners['bgm-play']();
 assert.equal(x.videos[0].muted,false);
});

test('滚动触发功能预览不会抢走正在播放的PV声音',()=>{
 const x=setup();x.videos[0].paused=false;x.videos[0].muted=false;
 x.ctx.playFeature(x.videos[1]);
 assert.equal(x.videos[0].muted,false);assert.equal(x.videos[1].muted,true);
});
