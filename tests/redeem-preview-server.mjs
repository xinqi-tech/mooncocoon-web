/**
 * @fileoverview 兑换页 loopback 预览：默认内存合成，--test 才连接固定测试后端。
 * AI Context: 上游 README.md；下游 redeem/ 页面与测试 API；不提供生产代理，不记录号码、码、查询参数或上游错误。
 */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=resolve(fileURLToPath(new URL('../',import.meta.url)));
export const TEST_API='https://1259219143-3xft5qxme3.ap-guangzhou.tencentscf.com';
const ROUTES=new Map([
 ['/redeem/',['redeem/index.html','text/html; charset=utf-8']],
 ['/redeem/index.html',['redeem/index.html','text/html; charset=utf-8']],
 ['/redeem/redeem.css',['redeem/redeem.css','text/css; charset=utf-8']],
 ['/redeem/redeem.js',['redeem/redeem.js','text/javascript; charset=utf-8']],
 ['/redeem/phone-libphonenumber-9.0.39.js',['redeem/phone-libphonenumber-9.0.39.js','text/javascript; charset=utf-8']],
 ['/redeem/i18n.js',['redeem/i18n.js','text/javascript; charset=utf-8']],
 ['/images/app-logo.jpg',['images/app-logo.jpg','image/jpeg']]
]);
const POST_PATHS=new Set(['/api/redeem-code/web-redeem','/api/analytics/events']);
const MOCK={result:0,errorMsg:'',data:{rewardItems:[{rewardType:'CURRENCY',skuId:'moon_silk',name:'Moon Silk',iconUrl:'',count:30}]}};
export function createRedeemPreviewServer({test=false,fetchImpl=fetch}={}){
 return createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  const reply=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body))};
  const port=req.socket.localPort,host=`127.0.0.1:${port}`,origin=`http://${host}`;
  if(req.headers.host!==host)return reply(403,{error:'Forbidden'});
  let path;try{path=new URL(req.url,origin).pathname}catch(_){return reply(400,{error:'Bad request'})}
  if(req.method==='POST'){
   if(!POST_PATHS.has(path))return reply(404,{error:'Not found'});
   if(req.headers.origin!==origin||!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return reply(403,{error:'Forbidden'});
   let body='';try{
    for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>8192)return reply(413,{error:'Request too large'})}
    const parsed=JSON.parse(body);
    if(path==='/api/redeem-code/web-redeem'&&(!parsed||Object.keys(parsed).sort().join(',')!=='code,countryCode,phoneNumber'||Object.values(parsed).some(v=>typeof v!=='string')))return reply(400,{error:'Bad request'});
    if(!test)return reply(200,path.includes('analytics')?{result:0,errorMsg:'',data:null}:MOCK);
    const response=await fetchImpl(TEST_API+path,{method:'POST',redirect:'error',signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/json','Origin':'https://www.lunakoru.com','Accept-Language':req.headers['accept-language']||'zh','X-App-Market':req.headers['x-app-market']==='OVERSEAS'?'OVERSEAS':'CN'},body});
    const raw=await response.text();res.writeHead(response.status,{'Content-Type':'application/json'});res.end(raw);
   }catch(_){reply(503,{result:260012,errorMsg:'',data:null})}
   return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return reply(405,{error:'Method not allowed'});
  if(path==='/'){res.writeHead(302,{Location:'/redeem/'});res.end();return}
  const route=ROUTES.get(path);if(!route)return reply(404,{error:'Not found'});
  try{
   let data=await readFile(resolve(ROOT,route[0]));
   if(route[0]==='redeem/index.html')data=data.toString().replace('<body>',`<body><aside class="preview-banner" data-i18n="${test?'testBanner':'mockBanner'}">${test?'测试环境 · 仅测试数据':'本地合成数据 · 不发放真实奖励'}</aside>`);
   res.writeHead(200,{'Content-Type':route[1]});res.end(req.method==='HEAD'?undefined:data);
  }catch(_){reply(404,{error:'Not found'})}
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),index=args.indexOf('--port'),port=index<0?8912:Number(args[index+1]);
 if(args.some((v,i)=>v!=='--test'&&v!=='--port'&&i!==index+1))throw new Error('Unsupported option');
 if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid port');
 createRedeemPreviewServer({test:args.includes('--test')}).listen(port,'127.0.0.1',()=>process.stdout.write(`Redeem ${args.includes('--test')?'TEST':'MOCK'} preview: http://127.0.0.1:${port}/redeem/\n`));
}
