import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, statSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8').replaceAll('\r\n','\n');
const source=html.slice(html.indexOf('(function(){\n  var loader='),html.indexOf('</script>',html.indexOf('(function(){\n  var loader=')));
function run({cached=false,frames=true}={}){
  let now=0,id=0,events=0;
  const timers=new Map(),rafs=new Map(),images=[];
  const elements=Object.fromEntries(['loader','loaderRingFill','loaderProgressLight','loaderNum'].map(key=>[key,{attrs:{},setAttribute(k,v){this.attrs[k]=v;},classList:{add(){}},parentNode:null}]));
  let locked=true;
  vm.runInNewContext(source,{
    document:{getElementById:key=>elements[key],body:{classList:{remove(){locked=false;}}}},
    window:{matchMedia:()=>({matches:false}),dispatchEvent(){events++;}},
    Image:class{constructor(){this.complete=cached;images.push(this);}},Event:class{},
    performance:{now:()=>now},Math,
    setTimeout(fn,ms){timers.set(++id,{fn,at:now+ms});return id;},clearTimeout(key){timers.delete(key);},
    requestAnimationFrame(fn){rafs.set(++id,fn);return id;},cancelAnimationFrame(key){rafs.delete(key);}
  });
  return {elements,images,get locked(){return locked;},get events(){return events;},advance(ms){
    const end=now+ms;
    while(now<end){now=Math.min(now+16,end);for(const [key,t] of [...timers])if(t.at<=now){timers.delete(key);t.fn();}
      if(frames){const work=[...rafs.values()];rafs.clear();work.forEach(fn=>fn(now));}}
  }};
}
test('首屏背景小于 600KB，仅等待两个首屏资源',()=>{
  assert.ok(statSync(new URL('../images/banner_bg.webp',import.meta.url)).size<600_000);
  assert.doesNotMatch(source,/window\.addEventListener\('load'|createElement\('video'/);
  assert.equal(run().images.length,2);
});
test('缓存命中不重复计数，首屏一秒内可进入且只完成一次',()=>{
  const app=run({cached:true});app.advance(1000);
  assert.equal(app.locked,false);assert.equal(app.events,1);assert.equal(app.elements.loader.attrs['aria-valuenow'],100);
  app.advance(5000);assert.equal(app.events,1);
});
test('请求永久挂起且动画帧暂停，4.5 秒兜底仍解除遮罩',()=>{
  const app=run({frames:false});app.advance(4490);assert.equal(app.locked,true);
  app.advance(20);assert.equal(app.locked,false);assert.equal(app.events,1);
  app.images.forEach(im=>im.onload());app.advance(5000);assert.equal(app.events,1);
});
test('资源失败不阻塞，末端高亮跟随圆弧',()=>{
  const app=run();app.images[0].onerror();app.advance(500);
  assert.ok(Number(app.elements.loaderProgressLight.attrs.x)<0);
  assert.match(html,/id="loaderProgressLight" href="images\/app-ui\/reservation-progress-light.png"/);
  app.images[1].onload();app.advance(1000);assert.equal(app.locked,false);
});

