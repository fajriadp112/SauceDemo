'use strict';
const fs = require('fs');
const path = require('path');

const C = { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const strip = (s) => String(s || '').replace(/\x1b\[[0-9;]*m/g, '');

/** Flatten Playwright's nested step tree into [{title, ms, error, depth}] (user steps only). */
function flattenSteps(steps = [], depth = 0, out = []) {
  for (const s of steps) {
    if (s.category === 'test.step') {
      out.push({ title: s.title, ms: s.duration, error: s.error ? strip(s.error.message).split('\n')[0] : '', depth });
    }
    flattenSteps(s.steps, s.category === 'test.step' ? depth + 1 : depth, out);
  }
  return out;
}

class SummaryReporter {
  constructor(options = {}) {
    this.outDir = path.resolve(options.outputDir || 'report');
    this.rows = [];
    this.start = Date.now();
  }

  onBegin(config) {
    this.baseURL = config.projects[0] && config.projects[0].use.baseURL;
  }

  onTestEnd(test, result) {
    // keep only the final attempt of each test (retries overwrite earlier ones)
    const row = {
      file: path.basename(test.location.file),
      title: test.title,
      project: test.parent.project() ? test.parent.project().name : '',
      status: result.status, // passed | failed | timedOut | skipped | interrupted
      ms: result.duration,
      retry: result.retry,
      error: strip(result.error && result.error.message).split('\n').slice(0, 12).join('\n'),
      steps: flattenSteps(result.steps),
    };
    const key = `${row.file}::${row.title}`;
    const i = this.rows.findIndex((r) => `${r.file}::${r.title}` === key);
    if (i >= 0) this.rows[i] = row; else this.rows.push(row);
  }

  onEnd() {
    const rows = this.rows;
    const ok = (r) => r.status === 'passed';
    const total = rows.length;
    const passed = rows.filter(ok).length;
    const skipped = rows.filter((r) => r.status === 'skipped').length;
    const failed = total - passed - skipped;
    const s = { total, passed, failed, skipped, secs: ((Date.now() - this.start) / 1000).toFixed(1) };

    this.printConsole(rows, s);
    fs.mkdirSync(this.outDir, { recursive: true });
    const htmlPath = path.join(this.outDir, 'report.html');
    fs.writeFileSync(htmlPath, this.html(rows, s));
    fs.writeFileSync(path.join(this.outDir, 'results.json'), JSON.stringify(rows, null, 2));
    console.log(`\n${C.b}HTML report:${C.x} ${htmlPath}\n${C.b}JSON results:${C.x} ${path.join(this.outDir, 'results.json')}\n`);
  }

  printConsole(rows, s) {
    console.log(`\n${C.b}=== SauceDemo Test Report ===${C.x}\n`);
    for (const r of rows) {
      const tag = r.status === 'passed' ? `${C.g}PASS${C.x}` : r.status === 'skipped' ? `${C.y}SKIP${C.x}` : `${C.r}FAIL${C.x}`;
      console.log(`${tag}  ${r.title} ${C.d}[${r.file}] (${r.ms} ms)${C.x}`);
      for (const st of r.steps) {
        const mark = st.error ? `${C.r}x${C.x}` : `${C.g}✓${C.x}`;
        console.log(`        ${'  '.repeat(st.depth)}${mark} ${st.title} ${C.d}(${st.ms} ms)${C.x}`);
      }
    }
    const failedRows = rows.filter((r) => !['passed', 'skipped'].includes(r.status));
    if (failedRows.length) {
      console.log(`\n${C.r}${C.b}Failed tests:${C.x}`);
      for (const r of failedRows) {
        const first = r.error.split('\n').find((l) => l.trim()) || '';
        console.log(`  ${r.title}\n      ${C.d}${first.trim()}${C.x}`);
      }
    }
    const rate = s.total ? ((s.passed / s.total) * 100).toFixed(1) : '0.0';
    console.log(`\n${C.b}Total:${C.x} ${s.total}   ${C.g}Passed:${C.x} ${s.passed}   ${C.r}Failed:${C.x} ${s.failed}   ${C.y}Skipped:${C.x} ${s.skipped}   ${C.b}Pass rate:${C.x} ${rate}%   ${C.b}Duration:${C.x} ${s.secs}s`);
  }

  html(rows, s) {
    const rate = s.total ? (s.passed / s.total) * 100 : 0;
    const cls = (r) => (r.status === 'passed' ? 'passed' : r.status === 'skipped' ? 'skipped' : 'failed');
    const label = (r) => (r.status === 'passed' ? 'Passed' : r.status === 'skipped' ? 'Skipped' : 'Failed');
    const R = 52, CIRC = 2 * Math.PI * R;
    const seg = (n, color, offset) =>
      n ? `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${color}" stroke-width="16" stroke-dasharray="${(n / s.total) * CIRC} ${CIRC}" stroke-dashoffset="${-offset}" transform="rotate(-90 70 70)"/>` : '';
    const donut = s.total
      ? seg(s.passed, 'var(--pass)', 0) + seg(s.failed, 'var(--fail)', (s.passed / s.total) * CIRC) + seg(s.skipped, 'var(--skip)', ((s.passed + s.failed) / s.total) * CIRC)
      : '';
    const maxMs = Math.max(1, ...rows.map((r) => r.ms));
    const banner = s.failed ? `${s.failed} of ${s.total} tests failed` : `All ${s.total} tests passed`;

    const cards = rows.map((r) => {
      const stepMax = Math.max(1, ...r.steps.map((st) => st.ms));
      const timeline = r.steps.map((st) => `
        <li class="${st.error ? 'bad' : 'ok'}">
          <div class="st-head"><span>${esc(st.title)}</span><small>${st.ms} ms</small></div>
          <div class="bar"><i style="width:${Math.max(2, (st.ms / stepMax) * 100)}%"></i></div>
          ${st.error ? `<div class="st-err">${esc(st.error)}</div>` : ''}
        </li>`).join('');
      return `
      <article class="test ${cls(r)}" data-name="${esc((r.title + ' ' + r.file).toLowerCase())}">
        <button class="test-head" onclick="this.parentElement.classList.toggle('open')">
          <span class="dot"></span>
          <span class="t-main"><b>${esc(r.title)}</b><small>${esc(r.file)} &middot; ${esc(r.project)}</small></span>
          <span class="t-bar"><i style="width:${Math.max(3, (r.ms / maxMs) * 100)}%"></i></span>
          <span class="t-ms">${(r.ms / 1000).toFixed(2)}s</span>
          <span class="pill">${label(r)}</span>
        </button>
        <div class="test-body">
          ${r.steps.length ? `<ol class="timeline">${timeline}</ol>` : '<p class="muted">No steps recorded.</p>'}
          ${r.error ? `<pre>${esc(r.error)}</pre>` : ''}
        </div>
      </article>`;
    }).join('');

    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SauceDemo Test Report</title>
<style>
:root{--bg:#f4f1ec;--panel:#fffdf9;--ink:#23201b;--muted:#7a7468;--line:#e4ded3;--pass:#2f9e6b;--fail:#d6453d;--skip:#d59a2b;--accent:#4b5cd6}
@media (prefers-color-scheme:dark){:root{--bg:#14161c;--panel:#1c1f27;--ink:#eceae4;--muted:#8d92a0;--line:#2b2f3a;--pass:#3fc98a;--fail:#ff6b61;--skip:#f0b84a;--accent:#8b98ff}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 "Segoe UI",system-ui,sans-serif}
.wrap{max-width:980px;margin:0 auto;padding:28px 16px 60px}
header{display:flex;gap:28px;align-items:center;flex-wrap:wrap;background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:24px}
.donut{position:relative;width:140px;height:140px;flex:none}
.donut svg{width:140px;height:140px}.donut circle.bg{stroke:var(--line)}
.donut .c{position:absolute;inset:0;display:grid;place-content:center;text-align:center}
.donut .c b{font-size:28px;line-height:1}.donut .c small{color:var(--muted)}
.hd{flex:1;min-width:240px}
.hd h1{margin:0 0 4px;font-size:22px}.hd .sub{color:var(--muted);font-size:13px;margin-bottom:14px}
.banner{display:inline-block;padding:4px 12px;border-radius:999px;font-weight:600;font-size:13px;color:#fff;background:${s.failed ? 'var(--fail)' : 'var(--pass)'}}
.stats{display:flex;gap:22px;margin-top:16px;flex-wrap:wrap}
.stats div{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.stats b{display:block;font-size:22px;color:var(--ink);text-transform:none;letter-spacing:0}
.stats .p b{color:var(--pass)}.stats .f b{color:var(--fail)}.stats .k b{color:var(--skip)}
.tools{display:flex;gap:8px;margin:22px 0 12px;flex-wrap:wrap;align-items:center}
.tools button,.tools input{font:inherit;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:999px;padding:6px 14px}
.tools button{cursor:pointer}.tools button.on{background:var(--accent);border-color:var(--accent);color:#fff}
.tools input{flex:1;min-width:160px;border-radius:10px}
.test{background:var(--panel);border:1px solid var(--line);border-radius:14px;margin-bottom:10px;overflow:hidden}
.test.failed{border-left:5px solid var(--fail)}.test.passed{border-left:5px solid var(--pass)}.test.skipped{border-left:5px solid var(--skip)}
.test-head{all:unset;box-sizing:border-box;display:flex;gap:14px;align-items:center;width:100%;padding:14px 16px;cursor:pointer}
.test-head:hover{background:color-mix(in srgb,var(--accent) 6%,transparent)}
.dot{width:10px;height:10px;border-radius:50%;flex:none}
.passed .dot{background:var(--pass)}.failed .dot{background:var(--fail)}.skipped .dot{background:var(--skip)}
.t-main{flex:1;min-width:0}.t-main b{display:block}.t-main small{color:var(--muted)}
.t-bar{width:110px;height:6px;background:var(--line);border-radius:3px;overflow:hidden;flex:none}
.t-bar i{display:block;height:100%;background:var(--accent)}
.t-ms{width:52px;text-align:right;color:var(--muted);font-variant-numeric:tabular-nums;flex:none}
.pill{font-size:12px;font-weight:600;padding:2px 10px;border-radius:999px;flex:none}
.passed .pill{color:var(--pass);background:color-mix(in srgb,var(--pass) 15%,transparent)}
.failed .pill{color:var(--fail);background:color-mix(in srgb,var(--fail) 15%,transparent)}
.skipped .pill{color:var(--skip);background:color-mix(in srgb,var(--skip) 15%,transparent)}
.test-body{display:none;padding:4px 20px 18px 40px;border-top:1px solid var(--line)}.test.open .test-body{display:block}
.timeline{list-style:none;margin:14px 0 0;padding:0 0 0 18px;border-left:2px solid var(--line)}
.timeline li{position:relative;margin-bottom:14px}
.timeline li:before{content:"";position:absolute;left:-25px;top:5px;width:10px;height:10px;border-radius:50%;background:var(--pass);border:2px solid var(--panel)}
.timeline li.bad:before{background:var(--fail)}
.st-head{display:flex;justify-content:space-between;gap:12px}.st-head small{color:var(--muted)}
.bar{height:4px;background:var(--line);border-radius:2px;margin-top:5px;max-width:420px}.bar i{display:block;height:100%;background:var(--pass);border-radius:2px}
li.bad .bar i{background:var(--fail)}.st-err{color:var(--fail);font-size:13px;margin-top:4px}
pre{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:12px;font-size:12px;white-space:pre-wrap;overflow:auto;margin:10px 0 0}
.muted{color:var(--muted)}
@media(max-width:640px){.t-bar{display:none}}
</style></head><body><div class="wrap">
<header>
  <div class="donut">
    <svg viewBox="0 0 140 140"><circle class="bg" r="${R}" cx="70" cy="70" fill="none" stroke-width="16"/>${donut}</svg>
    <div class="c"><b>${rate.toFixed(0)}%</b><small>passed</small></div>
  </div>
  <div class="hd">
    <h1>SauceDemo Test Report</h1>
    <div class="sub">${esc(this.baseURL || '')} &middot; ${new Date().toLocaleString()} &middot; ${s.secs}s total</div>
    <span class="banner">${banner}</span>
    <div class="stats"><div>Total<b>${s.total}</b></div><div class="p">Passed<b>${s.passed}</b></div><div class="f">Failed<b>${s.failed}</b></div><div class="k">Skipped<b>${s.skipped}</b></div></div>
  </div>
</header>
<div class="tools">
  <button class="on" data-f="all">All</button><button data-f="passed">Passed</button><button data-f="failed">Failed</button>
  <input id="q" placeholder="Search tests..." oninput="apply()">
</div>
<main>${cards}</main>
</div>
<script>
let flt='all';
document.querySelectorAll('.tools button').forEach(b=>b.onclick=()=>{flt=b.dataset.f;document.querySelectorAll('.tools button').forEach(x=>x.classList.toggle('on',x===b));apply()});
function apply(){const q=document.getElementById('q').value.toLowerCase();document.querySelectorAll('.test').forEach(t=>{t.style.display=((flt==='all'||t.classList.contains(flt))&&t.dataset.name.includes(q))?'':'none'})}
document.querySelectorAll('.test.failed').forEach(t=>t.classList.add('open'));
</script></body></html>`;
  }
}

module.exports = SummaryReporter;
