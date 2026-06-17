// Headless jsdom test for the beta-reservation panel logic in index.html.
// Setup (node_modules is git-ignored, NOT committed):
//   npm install --no-save jsdom
// Run:
//   node tests/beta-reservation.test.mjs
// Exit code 0 = all pass.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '..', 'index.html'), 'utf8');

let passed = 0, failed = 0;
function ok(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.log('  FAIL ' + name + (extra ? '  -> ' + extra : '')); }
}
function eq(name, actual, expected) {
  ok(name + ' (= ' + JSON.stringify(expected) + ')', actual === expected, 'got ' + JSON.stringify(actual));
}

// ---- Boot a jsdom document with the page scripts executed ----
// NOTE: inline <script>s run synchronously during JSDOM construction, so all
// browser-API stubs the page touches at top level (matchMedia, IntersectionObserver,
// canvas getContext, rAF) MUST be installed in `beforeParse` — not after — or the
// main script block throws before our beta IIFE is reached.
async function boot(fetchImpl) {
  const vc = new VirtualConsole(); // swallow page console noise (canvas/lucide etc.)
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://www.lunakoru.com/',
    virtualConsole: vc,
    beforeParse(window) {
      // jsdom has no canvas backend; hand the page a no-op 2D context so the
      // particle/cursor canvas code doesn't throw (these are decorative, not under test).
      const gradientStub = { addColorStop() {} };
      const ctxStub = new Proxy({}, {
        get(_t, prop) {
          if (prop === 'createRadialGradient' || prop === 'createLinearGradient' || prop === 'createPattern') return () => gradientStub;
          if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
          if (prop === 'measureText') return () => ({ width: 0 });
          if (prop === 'canvas') return { width: 0, height: 0 };
          return () => {};
        },
        set() { return true; },
      });
      window.HTMLCanvasElement.prototype.getContext = () => ctxStub;
      window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
      window.matchMedia = () => ({ matches: false, media: '', onchange: null, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){}, dispatchEvent(){ return false; } });
      window.IntersectionObserver = class { constructor(){} observe(){} unobserve(){} disconnect(){} takeRecords(){ return []; } };
      window.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
      window.lucide = { createIcons() {} };
      window.open = () => null; // no-op for window.open
      if (fetchImpl) window.fetch = fetchImpl;
    },
  });
  const { window } = dom;
  // Fire DOMContentLoaded + load so all IIFEs/listeners run.
  window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
  window.dispatchEvent(new window.Event('load'));
  await tick(0);
  return window;
}
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

// =====================================================================
// (a) Phone normalization edge cases — must match backend rule.
// =====================================================================
async function testNormalize() {
  console.log('\n[a] normalizePhone edge cases');
  const w = await boot();
  const n = w.__betaNormalizePhone;
  ok('normalize fn is exposed on window', typeof n === 'function');
  if (typeof n !== 'function') return;

  // --- Valid forms (must normalize to the canonical 11-digit number) ---
  eq('plain 11-digit',            n('13800138000'), '13800138000');
  eq('with spaces',               n('138 0013 8000'), '13800138000');
  eq('leading +86',               n('+8613800138000'), '13800138000');
  eq('bare 86 country code (13d)',n('8613800138000'), '13800138000');
  eq('+86 with spaces',           n(' +86 138 0013 8000 '), '13800138000');
  eq('dashes',                    n('138-0013-8000'), '13800138000');
  eq('parens + dashes',           n('(138)0013-8000'), '13800138000');
  eq('dotted',                    n('138.0013.8000'), '13800138000');
  eq('letters stripped',          n('abc13800138000'), '13800138000');
  eq('numeric input type',        n(13800138000), '13800138000');

  // --- Normalization-hole regressions (backend PhoneNormalizer parity) ---
  // Extra digits must NOT be silently truncated to a different valid number — reject.
  eq('extra trailing digits -> reject (no truncate)', n('13800138000999'), '');
  eq('one extra digit -> reject',                     n('138001380001'), '');
  // First digit not 1 -> reject (China mainland mobile must start with 1).
  eq('first digit != 1 -> reject',                    n('23800138000'), '');
  // 0086 prefix => 15 digits after stripping, not exactly 13, so 86 is NOT stripped -> reject.
  eq('0086 prefix -> reject (len!=13)',               n('008613800138000'), '');
  eq('0086 + spaces -> reject',                       n('00 86 138 0013 8000'), '');
  // A literal "86" + 11-digit number that does NOT start with 1: still 13 digits, 86 stripped,
  // result starts with 9 -> reject.
  eq('86 + non-1 number -> reject',                   n('8693800138000'), '');
  // Too short.
  eq('too short -> reject',                           n('138'), '');
  // null / empty -> empty string (treated as invalid by isValidPhone).
  eq('null input',                n(null), '');
  eq('empty input',               n(''), '');
}

// =====================================================================
// (b) Three-state + error rendering with mocked fetch.
// =====================================================================
function mockFetch(payload, { ok: okFlag = true, status = 200, reject = false } = {}) {
  return () => reject
    ? Promise.reject(new Error('network down'))
    : Promise.resolve({
        ok: okFlag,
        status,
        json: () => Promise.resolve({ result: 0, data: payload }),
      });
}

async function runQuery(window) {
  const phone = window.document.getElementById('betaPhone');
  const btn = window.document.getElementById('betaQueryBtn');
  phone.value = '13800138000';
  btn.click();
  // allow promise microtasks + our setTimeout-based rAF stub to flush
  await tick(0); await tick(0); await tick(0);
}

async function testState(label, payload, opts, expect) {
  const w = await boot(mockFetch(payload, opts));
  // open the panel so the result region is live
  w.document.querySelector('[data-beta-open]').click();
  await tick(0);
  await runQuery(w);
  const result = w.document.querySelector('#betaResult .beta-result');
  ok(label + ': result block rendered', !!result, 'no .beta-result found');
  if (!result) return;
  ok(label + ': has expected class "' + expect.cls + '"', result.classList.contains(expect.cls),
     'classes=' + result.className);
  const title = (w.document.querySelector('.beta-result-title') || {}).textContent || '';
  ok(label + ': title contains "' + expect.titleIncludes + '"', title.includes(expect.titleIncludes),
     'title=' + JSON.stringify(title));
  if (expect.qr !== undefined) {
    const img = w.document.querySelector('.beta-qr-wrap img');
    if (expect.qr) {
      ok(label + ': QR img present', !!img);
      if (img) eq(label + ': QR src', img.getAttribute('src'), expect.qr);
    } else {
      ok(label + ': no QR img', !img);
    }
  }
  return w;
}

async function testStates() {
  console.log('\n[b] three-state + error rendering');

  await testState('PENDING', { status: 'PENDING' }, {}, { cls: 'pending', titleIncludes: '审核中' });

  await testState('APPROVED', { status: 'APPROVED', groupQrUrl: 'https://cdn.lunakoru.com/qr/g1.png' }, {},
    { cls: 'approved', titleIncludes: '恭喜入选', qr: 'https://cdn.lunakoru.com/qr/g1.png' });

  await testState('NOT_SELECTED', { status: 'NOT_SELECTED' }, {},
    { cls: 'not-selected', titleIncludes: '未入选' });

  // HTTP error -> error state
  await testState('HTTP 500 -> error', {}, { ok: false, status: 500 },
    { cls: 'error', titleIncludes: '查询失败' });

  // network reject -> error state
  await testState('network reject -> error', null, { reject: true },
    { cls: 'error', titleIncludes: '查询失败' });

  // unknown status string -> error state
  await testState('unknown status -> error', { status: 'WAT' }, {},
    { cls: 'error', titleIncludes: '查询失败' });
}

// =====================================================================
// (c) Behavioral extras: localStorage flags + invalid input guard.
// =====================================================================
async function testBehaviors() {
  console.log('\n[c] localStorage + input-guard behaviors');

  // beta_applied set when clicking "去填写预约问卷"
  {
    const w = await boot();
    w.document.querySelector('[data-beta-open]').click();
    await tick(0);
    w.document.getElementById('betaFormBtn').click();
    eq('beta_applied set after form click', w.localStorage.getItem('beta_applied'), '1');
    const note = w.document.getElementById('betaAppliedNote');
    ok('applied note shown after form click', note.hidden === false, 'hidden=' + note.hidden);
  }

  // invalid phone -> error message, no fetch, no result
  {
    let fetchCalls = 0;
    const w = await boot(() => { fetchCalls++; return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ status: 'PENDING' }) }); });
    w.document.querySelector('[data-beta-open]').click();
    await tick(0);
    const phone = w.document.getElementById('betaPhone');
    phone.value = '123'; // too short
    w.document.getElementById('betaQueryBtn').click();
    await tick(0); await tick(0);
    eq('no fetch on invalid phone', fetchCalls, 0);
    ok('error message on invalid phone', (w.document.getElementById('betaError').textContent || '').length > 0);
    ok('no result block on invalid phone', !w.document.querySelector('#betaResult .beta-result'));
  }

  // valid query persists beta_phone
  {
    const w = await boot(mockFetch({ status: 'PENDING' }));
    w.document.querySelector('[data-beta-open]').click();
    await tick(0);
    await runQuery(w);
    eq('beta_phone persisted after valid query', w.localStorage.getItem('beta_phone'), '13800138000');
  }

  // reset clears beta_phone + result
  {
    const w = await boot(mockFetch({ status: 'PENDING' }));
    w.document.querySelector('[data-beta-open]').click();
    await tick(0);
    await runQuery(w);
    const reset = w.document.getElementById('betaResetBtn');
    ok('reset button exists', !!reset);
    if (reset) {
      reset.click();
      await tick(0);
      eq('beta_phone cleared after reset', w.localStorage.getItem('beta_phone'), null);
      ok('result cleared after reset', !w.document.querySelector('#betaResult .beta-result'));
    }
  }

  // revisit: pre-seeded beta_phone auto-queries on first panel open
  {
    let fetchCalls = 0, lastUrl = '';
    const w = await boot((url) => { fetchCalls++; lastUrl = url; return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ result: 0, data: { status: 'APPROVED', groupQrUrl: 'https://cdn.lunakoru.com/qr/x.png' } }) }); });
    w.localStorage.setItem('beta_phone', '13800138000');
    w.document.querySelector('[data-beta-open]').click();
    await tick(0); await tick(0); await tick(0);
    eq('auto-query fired once on revisit', fetchCalls, 1);
    ok('auto-query hit result endpoint with phone', lastUrl.includes('/api/beta-reservation/result?phone=13800138000'), 'url=' + lastUrl);
    ok('auto-query rendered result', !!w.document.querySelector('#betaResult .beta-result'));
    const phone = w.document.getElementById('betaPhone');
    eq('phone input prefilled on revisit', phone.value, '13800138000');
  }

  // Esc closes panel
  {
    const w = await boot();
    const overlay = w.document.getElementById('betaOverlay');
    w.document.querySelector('[data-beta-open]').click();
    await tick(0);
    ok('panel open after entry click', overlay.classList.contains('open'));
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await tick(0);
    ok('panel closed after Esc', !overlay.classList.contains('open'));
  }
}

// =====================================================================
// (d) Focus trap + background inert when modal is open.
// =====================================================================
async function testFocusTrap() {
  console.log('\n[d] focus trap + background inert');

  // Background siblings become inert/aria-hidden while open, restored on close.
  {
    const w = await boot();
    const nav = w.document.querySelector('.nav-wrap');
    const overlay = w.document.getElementById('betaOverlay');
    ok('nav not inert before open', !nav.hasAttribute('inert'));
    w.document.querySelector('[data-beta-open]').click();
    await tick(0);
    ok('overlay open', overlay.classList.contains('open'));
    ok('background nav set inert when open', nav.hasAttribute('inert'));
    ok('background nav aria-hidden when open', nav.getAttribute('aria-hidden') === 'true');
    ok('overlay itself NOT inert', !overlay.hasAttribute('inert'));
    // 回归（弹窗点不动 bug）：overlay 必须是 body 直接子节点，否则祖先(.page-ui)被 inert → 面板整体不可点。
    // jsdom 不真实现 inert 的点击拦截，故必须显式断言「面板不在 inert 子树内」。
    ok('overlay hoisted to body (clickable)', overlay.parentElement === w.document.body);
    let _anc = overlay.parentElement, _ancInert = false;
    while(_anc){ if(_anc.nodeType===1 && _anc.hasAttribute('inert')){ _ancInert = true; break; } _anc = _anc.parentElement; }
    ok('no inert ancestor over open panel', !_ancInert);
    // close restores
    w.document.getElementById('betaClose').click();
    await tick(0); await tick(500);
    ok('nav inert removed after close', !nav.hasAttribute('inert'));
    ok('nav aria-hidden removed after close', !nav.hasAttribute('aria-hidden'));
  }

  // Tab on last focusable wraps to first; Shift+Tab on first wraps to last.
  {
    const w = await boot();
    const panel = w.document.querySelector('.beta-panel');
    w.document.querySelector('[data-beta-open]').click();
    await tick(0); await tick(400); // let the 380ms focus timer fire
    // jsdom has no layout engine (offset* === 0), so mirror the page's getFocusable:
    // when NO element reports real geometry, skip the offset filter entirely.
    const all = Array.prototype.slice.call(
      panel.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')
    ).filter((el) => !el.hidden);
    const hasLayout = all.some((el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);
    const focusables = hasLayout
      ? all.filter((el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0 || el === w.document.activeElement)
      : all;
    ok('panel has >=2 focusable elements', focusables.length >= 2, 'count=' + focusables.length);
    if (focusables.length >= 2) {
      const first = focusables[0], last = focusables[focusables.length - 1];
      // Tab from last -> first
      last.focus();
      w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
      await tick(0);
      ok('Tab on last wraps to first', w.document.activeElement === first,
         'active=' + (w.document.activeElement && w.document.activeElement.id || w.document.activeElement && w.document.activeElement.className));
      // Shift+Tab from first -> last
      first.focus();
      w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
      await tick(0);
      ok('Shift+Tab on first wraps to last', w.document.activeElement === last,
         'active=' + (w.document.activeElement && w.document.activeElement.id || w.document.activeElement && w.document.activeElement.className));
    }
  }

  // Focus that escaped the panel is pulled back to the first focusable on Tab.
  {
    const w = await boot();
    const panel = w.document.querySelector('.beta-panel');
    w.document.querySelector('[data-beta-open]').click();
    await tick(0); await tick(400);
    // Force focus onto a background element (simulating a stray focus), then Tab.
    const navLink = w.document.querySelector('.nav-brand') || w.document.body;
    if (navLink.focus) navLink.focus();
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    await tick(0);
    ok('stray focus pulled back into panel on Tab', panel.contains(w.document.activeElement),
       'active=' + (w.document.activeElement && (w.document.activeElement.id || w.document.activeElement.tagName)));
  }
}

// =====================================================================
// (e) APPROVED group-QR <img> onerror fallback (dead link -> text, no blank).
// =====================================================================
async function testQrFallback() {
  console.log('\n[e] group QR img onerror fallback');
  const w = await boot(mockFetch({ status: 'APPROVED', groupQrUrl: 'https://cdn.lunakoru.com/qr/dead.png' }));
  w.document.querySelector('[data-beta-open]').click();
  await tick(0);
  await runQuery(w);
  const img = w.document.querySelector('.beta-qr-wrap img');
  ok('QR img rendered', !!img);
  if (!img) return;
  ok('QR img has onerror handler', !!img.getAttribute('onerror'),
     'onerror=' + img.getAttribute('onerror'));
  // Simulate the broken image by firing the error event (jsdom does not load images).
  const wrap = img.parentNode;
  img.dispatchEvent(new w.Event('error'));
  await tick(0);
  ok('wrap marked is-broken after error', wrap.classList.contains('is-broken'),
     'class=' + wrap.className);
  ok('fallback shows text hint (not blank/img)', /二维码加载失败/.test(wrap.textContent),
     'text=' + JSON.stringify(wrap.textContent));
  ok('broken image element removed', !wrap.querySelector('img'));
}

(async () => {
  try {
    await testNormalize();
    await testStates();
    await testBehaviors();
    await testFocusTrap();
    await testQrFallback();
  } catch (e) {
    console.error('\nTEST HARNESS ERROR:', e && e.stack || e);
    process.exit(2);
  }
  console.log('\n==============================');
  console.log('  passed: ' + passed + '   failed: ' + failed);
  console.log('==============================');
  process.exit(failed === 0 ? 0 : 1);
})();
