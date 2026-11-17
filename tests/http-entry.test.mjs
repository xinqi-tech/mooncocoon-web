import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script id="officialHttpsEntry">([\s\S]*?)<\/script>/)[1];
const redirect=input=>{
  const url=new URL(input),targets=[];
  vm.runInNewContext(script,{window:{location:{protocol:url.protocol,hostname:url.hostname,
    pathname:url.pathname,search:url.search,hash:url.hash,replace(value){targets.push(value)}}}});
  return targets;
};
test('HTTP official entry upgrades to HTTPS before reservation or other scripts execute',()=>{
  assert.ok(html.indexOf('<script id="officialHttpsEntry">')<html.indexOf('<link'));
  assert.ok(html.indexOf('<script id="officialHttpsEntry">')<html.indexOf('reservation.js'));
  assert.deepEqual(redirect('http://www.lunakoru.com/'),['https://www.lunakoru.com/']);
  assert.deepEqual(redirect('http://lunakoru.com/'),['https://lunakoru.com/']);
});
test('HTTP upgrade preserves the complete path, attribution query and page position',()=>{
  assert.deepEqual(redirect('http://www.lunakoru.com/index.html?utm_source=xhs&utm_campaign=test%2B1&release=http#reservation'),
    ['https://www.lunakoru.com/index.html?utm_source=xhs&utm_campaign=test%2B1&release=http#reservation']);
});
test('HTTPS does not loop and local or unrelated hosts are not redirected',()=>{
  for(const url of ['https://www.lunakoru.com/','https://lunakoru.com/','http://localhost:8769/',
    'http://127.0.0.1:8769/','http://192.168.1.2:8769/','http://www.lunakoru.com.evil.test/',
    'http://other.lunakoru.com/'])assert.deepEqual(redirect(url),[],url);
});
