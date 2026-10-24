import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const reservation=require('../reservation.js');
const qrcode=require('../vendor/qrcode-generator.js');

test('手机号和渠道参数校验，未知来源不猜测',()=>{
  assert.equal(reservation.validPhone('13800138000'),true);
  assert.equal(reservation.validPhone('1380013800'),false);
  assert.equal(reservation.channel('xiaohongshu'), 'xiaohongshu');
  assert.equal(reservation.channel('test<script>'), 'unknown');
});
test('仅允许 HTTPS 素材和下载地址',()=>{
  assert.equal(reservation.safeUrl('javascript:alert(1)'), '');
  assert.equal(reservation.safeUrl('http://example.com'), '');
  assert.equal(reservation.safeUrl('https://releases.lunakoru.com/'), 'https://releases.lunakoru.com/');
});
test('用户显式选择的平台优先于系统推荐',()=>{
  const form={querySelector:()=>({value:'ANDROID'})};
  assert.equal(reservation.selectedPlatform(form,'iPhone'), 'ANDROID');
  assert.equal(reservation.selectedPlatform({querySelector:()=>null},'iPhone'), 'IOS');
});
test('首页预约在 PV 前，视频不自动预加载',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.ok(html.indexOf('id="reservation"')<html.indexOf('id="pv"'));
  assert.match(html,/id="reservationForm"/);
  assert.match(html,/name="adult"/);
  assert.match(html,/name="terms"/);
  assert.match(html,/name="reminder"/);
  assert.match(html,/preload="none" poster="images\/pv_poster.jpg\?v=20261024"/);
  assert.doesNotMatch(html,/\{src:window\.__PV_SRC,w:34,type:'video'\}/);
});
test('接口请求带 Cookie 且个人资料不用 HTML 字符串插值',async()=>{
  const js=await readFile(new URL('../reservation.js',import.meta.url),'utf8');
  assert.match(js,/credentials:'include'/);
  assert.match(js,/textContent=data\.phoneMasked/);
  assert.doesNotMatch(js,/innerHTML/);
});
test('桌面下载二维码由本地库为同一 HTTPS 链接编码',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const js=await readFile(new URL('../reservation.js',import.meta.url),'utf8');
  assert.match(html,/vendor\/qrcode-generator\.js/);
  assert.match(js,/qr\.addData\(safe\)/);
  const qr=qrcode(0,'M');qr.addData('https://releases.lunakoru.com/');qr.make();
  assert.ok(qr.getModuleCount()>20);
});

test('北京时间预约倒计时使用总小时并在开启时归零',()=>{
  const start=Date.parse(reservation.RESERVATION_START);
  assert.equal(start,Date.parse('2026-10-23T16:00:00Z'));
  assert.equal(reservation.formatCountdown(start,start-((49*3600+2*60+3)*1000)), '49 小时 02 分钟 03 秒');
  assert.equal(reservation.formatCountdown(start,start-1),'00 小时 00 分钟 01 秒');
  assert.equal(reservation.formatCountdown(start,start),'00 小时 00 分钟 00 秒');
  assert.equal(reservation.formatCountdown(start,start+1000),'00 小时 00 分钟 00 秒');
});
