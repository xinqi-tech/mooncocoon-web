import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const code=html.slice(html.indexOf('function silenceVideos('),html.indexOf('// PV Video fullscreen'));
function setup(){
 const listeners={},bgm={paused:false,pause(){this.paused=true;},addEventListener(n,fn){listeners[n]=fn;}};
 const button={classList:{remove(){}},setAttribute(){}};
 const pv={muted:true,addEventListener(n,fn){listeners[n]=fn;}};
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
 const x=setup();x.listeners.play();assert.ok(x.videos.every(v=>v.muted));
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
