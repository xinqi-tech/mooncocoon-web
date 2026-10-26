import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import test from 'node:test';

const pageUrl=new URL('../recharge/review/index.html',import.meta.url);
const html=await readFile(pageUrl,'utf8');

test('充值与审核页共用背景只保留横向纹理，不绘制中央竖线',async()=>{
  const css=await readFile(new URL('../recharge/recharge.css',import.meta.url),'utf8');
  const overlay=css.match(/body::before\s*\{([^}]+)\}/)?.[1];
  assert.ok(overlay,'共用背景层存在');
  assert.doesNotMatch(overlay,/linear-gradient\(90deg|49\.92%|50\.08%/);
  assert.match(overlay,/background-size:\s*100% 72px/);
  assert.match(html,/href="\.\.\/recharge\.css"/);
});

test('审核展示无需登录，商品、确认和售后信息在 HTML 中可见',()=>{
  for(const text of ['审核演示 · 暂未开放收款','商品说明','演示档位','¥6.00','¥30.00','¥68.00','支付确认示意','未生成订单','到账与售后说明','feedback@heabo.cn'])assert.ok(html.includes(text),text);
  for(const id of ['product','checkout','delivery'])assert.match(html,new RegExp(`id="${id}"`));
  assert.doesNotMatch(html,/<(?:input|form|script|iframe)\b/i);
  assert.doesNotMatch(html,/\shidden(?:\s|>|=)/i);
});

test('审核页禁止脚本、网络 API 和表单，付款按钮永远禁用',()=>{
  for(const rule of ["default-src 'none'","script-src 'none'","connect-src 'none'","form-action 'none'","base-uri 'none'"])assert.ok(html.includes(rule),rule);
  const buttons=[...html.matchAll(/<button\b[^>]*>/gi)];
  assert.equal(buttons.length,1);
  assert.match(buttons[0][0],/\sdisabled\b/);
  assert.doesNotMatch(html,/\son\w+=|<meta[^>]+http-equiv="refresh"|(?:alipays?:|gateway\.do|\/api\/)/i);
});

test('所有资源、条款和页内跳转目标真实存在',async()=>{
  for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){
    const path=match[1];
    if(path.startsWith('mailto:'))continue;
    if(path.startsWith('#')){assert.ok(html.includes(`id="${path.slice(1)}"`));continue;}
    const target=path==='/'?new URL('../index.html',import.meta.url):new URL(path.endsWith('/')?`${path}index.html`:path,pageUrl);
    await access(target);
  }
});

test('交易入口保留审核链接，正式 API 固定且初始支付控件关闭',async()=>{
  const entry=await readFile(new URL('../recharge/index.html',import.meta.url),'utf8');
  assert.match(entry,/href="review\/"/);
  assert.match(entry,/id="loginButton"[^>]*disabled/);
  assert.match(entry,/id="checkoutButton"[^>]*disabled/);
  const {createRequire}=await import('node:module');
  const recharge=createRequire(import.meta.url)('../recharge/recharge.js');
  assert.equal(recharge.resolveApiBase({protocol:'https:',hostname:'www.lunakoru.com',port:''}),recharge.PRODUCTION_API_BASE);
});
