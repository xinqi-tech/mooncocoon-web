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

const contentTypes={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.ttf':'font/ttf','.mp3':'audio/mpeg'};

async function fixtureHtml(seedPending){
  let html=await readFile(resolve(projectRoot,'recharge/index.html'),'utf8');
  html=html.replaceAll('="../','="/').replace('href="recharge.css"','href="/recharge/recharge.css"><link rel="stylesheet" href="/fixture/fixture.css"');
  const installPath=seedPending?'/fixture/pending/install.js':'/fixture/install.js';
  html=html.replace('<body>','<body><aside class="fixture-banner">本地合成数据 · 非真实沙箱付款</aside>');
  return html.replace('<script src="recharge.js"></script>',
    `<script src="/tests/recharge-browser-fixture.js"></script><script src="${installPath}"></script><script src="/recharge/recharge.js"></script>`);
}

function installScript(seedPending){return `RechargeBrowserFixture.installRechargeBrowserFixture(window,{seedPending:${seedPending}});`}

function mobileFixturePage(){return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>充值页 390×844 预览</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#020817;color:#c7e5ff;font:14px system-ui}main{text-align:center}p{margin:0 0 10px}iframe{display:block;width:390px;height:844px;border:1px solid rgba(199,229,255,.4);background:#06142f;box-shadow:0 24px 80px rgba(0,0,0,.55)}</style></head><body><main><p>测试视口 · 390 × 844</p><iframe src="/fixture/" title="月光茧充值页 390 像素预览"></iframe></main></body></html>`}

const fixtureCss='.fixture-banner{position:relative;z-index:1000;padding:7px 14px;background:#ffd99a;color:#26364d;text-align:center;font:600 12px/1.4 system-ui;letter-spacing:.04em}.site-header{top:0}';

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
      response.setHeader('Content-Type',contentTypes['.css']);response.end(fixtureCss);return;
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
