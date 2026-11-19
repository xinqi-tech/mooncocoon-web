/**
 * @fileoverview 独立充值页的 loopback-only 静态预览服务，向明确 fixture 路由注入内存 fetch。
 *
 * AI Context
 * -----------
 * 关联文件:
 * - 生产页面: recharge/index.html（不会引用本服务或夹具）
 * - 测试夹具: tests/recharge-browser-fixture.js
 *
 * 核心概念:
 * - /recharge/ — 原始页面，验证默认未配置安全态
 * - /fixture/ — 注入登录、钱包与档位接口，但不连接云端
 * - /fixture/pending/ — 额外种入待确认订单，依次展示 created、paid、fulfilled
 */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot=resolve(fileURLToPath(new URL('../',import.meta.url)));
const args=process.argv.slice(2);
const portIndex=args.indexOf('--port');
const parsedPort=portIndex>=0?Number(args[portIndex+1]):8908;
if(!Number.isInteger(parsedPort)||parsedPort<1024||parsedPort>65535)throw new Error('port must be an integer between 1024 and 65535');

const contentTypes={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.ttf':'font/ttf','.mp3':'audio/mpeg'};

async function fixtureHtml(seedPending){
  let html=await readFile(resolve(projectRoot,'recharge/index.html'),'utf8');
  html=html.replaceAll('="../','="/').replaceAll('url("../','url("/').replace('</head>','<link rel="stylesheet" href="/fixture/fixture.css"></head>');
  html=html.replace('<label for="smsCode">','<label for="smsCode" hidden>')
    .replace('<div class="code-row">','<div class="code-row" hidden>')
    .replace('<div id="phonePreview" class="phone-preview" hidden>','<div id="phonePreview" class="phone-preview" hidden style="display:none!important">')
    .replace('<div id="phoneVerification" class="phone-verification" hidden>','<div id="phoneVerification" class="phone-verification" hidden style="display:none!important">')
    .replace('<div><dt>昵称</dt><dd id="accountNickname">','<div hidden><dt>昵称</dt><dd id="accountNickname">')
    .replace('<div class="balance-line">','<div class="balance-line" hidden>')
    .replace('<div><dt>昵称</dt><dd id="confirmationNickname">','<div hidden><dt>昵称</dt><dd id="confirmationNickname">')
    .replace('<div><dt>UID</dt><dd id="accountUid">—</dd></div>',`<div><dt>UID</dt><dd id="accountUid">—</dd></div>
          <div><dt>手机号</dt><dd id="fixtureMaskedPhone">—</dd></div>`)
    .replace('        <div class="balance-line" hidden>', `        <div class="phone-preview">
          <label for="fixtureConfirmPhone">确认手机号</label>
          <input id="fixtureConfirmPhone" type="tel" inputmode="numeric" autocomplete="off" maxlength="11" placeholder="请再次输入完整手机号" aria-describedby="fixtureConfirmHint">
          <span id="fixtureConfirmHint" role="status">两次填写一致后才能充值。</span>
        </div>
        <div class="balance-line" hidden>`)
    .replace('aria-label="关闭确认窗口">×</button>','aria-label="关闭确认窗口"><img src="/images/app-ui/reservation-close.png" alt=""></button>')
    .replace('<button id="orderSwitchAccountButton"','<button hidden id="orderSwitchAccountButton"')
    .replace('离开支付宝后，页面会继续向服务端查询到账结果。','请选择支付方式。')
    .replace('<button class="secondary-button" value="cancel">返回修改</button>','')
    .replace('前往支付宝付款','支付宝支付')
    .replace('登录只用于确认本人游戏账号，不支持输入 UID 为他人充值。','请确认充值手机号无误。');
  const installPath=seedPending?'/fixture/pending/install.js':'/fixture/install.js';
  html=html.replace('<body>','<body><aside class="fixture-banner">本地合成数据 · 非真实沙箱付款</aside>');
  const support = '<button id="fixtureService" type="button" aria-label="联系客服" aria-haspopup="dialog" aria-controls="fixtureServiceDialog"><span></span><img src="/tests/recharge-assets/recharge-service-icon.svg" alt=""></button>'
    + '<dialog id="fixtureServiceDialog" class="confirmation-dialog" aria-labelledby="fixtureServiceHeading"><form method="dialog">'
    + '<button class="dialog-close" aria-label="关闭客服窗口"><img src="/images/app-ui/reservation-close.png" alt=""></button>'
    + '<h2 id="fixtureServiceHeading">客服 QQ 群</h2><img class="fixture-qq" src="/tests/recharge-assets/recharge-service-qq.jpg" alt="客服 QQ 群二维码"></form></dialog>';
  html=html.replace('<script id="recharge-inline-js">',support+'<script id="recharge-inline-js">');
  return html.replace(/<script id="recharge-inline-js">[\s\S]*?<\/script>/,
    `<script src="/tests/recharge-browser-fixture.js"></script><script src="${installPath}"></script><script src="/recharge/recharge.js"></script>`);
}

function installScript(seedPending){return `RechargeBrowserFixture.installRechargeBrowserFixture(window,{seedPending:${seedPending},confirmWithoutSms:true});`}

function mobileFixturePage(){return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>充值页 390×844 预览</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#020817;color:#c7e5ff;font:14px system-ui}main{text-align:center}p{margin:0 0 10px}iframe{display:block;width:390px;height:844px;border:1px solid rgba(199,229,255,.4);background:#06142f;box-shadow:0 24px 80px rgba(0,0,0,.55)}</style></head><body><main><p>测试视口 · 390 × 844</p><iframe src="/fixture/" title="月光茧充值页 390 像素预览"></iframe></main></body></html>`}

const fixtureCss='.fixture-banner{position:relative;z-index:1000;padding:7px 14px;background:#ffd99a;color:#26364d;text-align:center;font:600 12px/1.4 system-ui;letter-spacing:.04em}.site-header{top:0}';
const checkoutFixtureCss=`
#refreshOrderButton{width:min(100%,260px);min-height:0;aspect-ratio:658/144;padding:0;background-image:url("/images/app-ui/recharge-query-frame.png");background-size:contain}
#refreshOrderButton{align-self:center}
#fixtureConfirmHint{font-size:13px;opacity:.7}
#checkoutBar.fixture-no-tier{display:none!important}
#checkoutBar{background:linear-gradient(rgba(130,174,230,.16),rgba(130,174,230,.16)),#172b45}
#confirmationDialog{background:linear-gradient(rgba(180,215,255,.20),rgba(130,174,230,.16)),#182d49;border-color:rgba(220,240,255,.30)}
#checkoutButton,#confirmationDialog .dialog-actions button{width:min(100%,196px);aspect-ratio:384/132;min-height:0;padding:0;font-size:15px}
#checkoutButton,#confirmationDialog #startPaymentButton{background-image:url("/tests/recharge-assets/recharge-confirm-frame.png");background-size:contain}
#confirmationDialog .dialog-actions{display:grid;grid-template-columns:minmax(0,196px);justify-content:center;gap:22px;padding-inline:10px}
#confirmationDialog .dialog-actions>*{min-width:0}

.fixture-banner~.recharge-shell .order-glyph[data-art]{width:80px;height:80px;border:0;color:transparent;background:center/contain no-repeat}
.order-glyph[data-art="loading"]{background-image:url("/tests/recharge-assets/recharge-order-loading.webp")!important;animation:fixture-order-spin 1.2s linear infinite}
.order-glyph[data-art="success"]{background-image:url("/tests/recharge-assets/recharge-order-success.png")!important}
@keyframes fixture-order-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.order-glyph[data-art="loading"]{animation:none}}
.dialog-close{display:grid;place-items:center;padding:0}
.dialog-close img{display:block;width:22px;height:22px;object-fit:contain}
#fixtureService{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:calc(104px + env(safe-area-inset-bottom));z-index:21;width:58px;height:58px;padding:0;border:0;background:transparent;cursor:pointer}
#fixtureService>span{position:absolute;inset:0;background:url("/tests/recharge-assets/recharge-service-base.png") 49% 48%/140.58% 134.06% no-repeat}
#fixtureService>img{position:absolute;left:23.91%;top:26.09%;width:47.83%;height:auto}
#fixtureServiceHeading{text-align:center;padding-inline:36px}
#fixtureServiceDialog .fixture-qq{display:block;width:min(100%,260px);max-height:60vh;object-fit:contain;margin:16px auto 0;border-radius:14px}
@media(max-width:480px){#checkoutButton{width:min(44vw,196px)}}
`;

const server=createServer(async(request,response)=>{
  try{
    const pathname=new URL(request.url,'http://127.0.0.1').pathname;
    response.setHeader('Cache-Control','no-store');
    response.setHeader('X-Content-Type-Options','nosniff');
    if(pathname==='/fixture/'||pathname==='/fixture/pending/'){
      response.setHeader('Content-Type',contentTypes['.html']);response.end(await fixtureHtml(pathname.includes('/pending/')));return;
    }
    if(pathname==='/fixture/mobile/'){
      response.setHeader('Content-Type',contentTypes['.html']);response.end(mobileFixturePage());return;
    }
    if(pathname==='/fixture/fixture.css'){
      response.setHeader('Content-Type',contentTypes['.css']);response.end(fixtureCss+checkoutFixtureCss);return;
    }
    if(pathname==='/fixture/install.js'||pathname==='/fixture/pending/install.js'){
      response.setHeader('Content-Type',contentTypes['.js']);response.end(installScript(pathname.includes('/pending/')));return;
    }
    const relative=decodeURIComponent(pathname).replace(/^\/+/, '')||'index.html';
    const file=resolve(projectRoot,relative.endsWith('/')?`${relative}index.html`:relative);
    if(file!==projectRoot&&!file.startsWith(projectRoot+sep)){response.writeHead(403);response.end('Forbidden');return}
    const data=await readFile(file);response.setHeader('Content-Type',contentTypes[extname(file)]||'application/octet-stream');response.end(data);
  }catch(error){response.writeHead(error&&error.code==='ENOENT'?404:500);response.end('Not found')}
});

server.listen(parsedPort,'127.0.0.1',()=>{
  process.stdout.write(`Recharge preview: http://127.0.0.1:${parsedPort}/recharge/\nFixture login: http://127.0.0.1:${parsedPort}/fixture/\nFixture pending: http://127.0.0.1:${parsedPort}/fixture/pending/\nFixture mobile: http://127.0.0.1:${parsedPort}/fixture/mobile/\n`);
});
