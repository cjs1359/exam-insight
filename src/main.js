import { parseInput, analyze, suggestions, toCSV, reviewPayload, encodePayload, HEAD } from './analysis.js';
import { demoData } from './demo.js';
import { AI_PROMPT, PHOTO_TIPS } from './prompt.js';
import reviewJS from './review-core.js?raw';
import reviewCSS from './review.css?raw';

const KEY = 'examInsight.v1';
let S = JSON.parse(localStorage.getItem(KEY) || 'null') || { data: null, th: { high: 0.5, mid: 0.3 }, tab: 's1' };
const save = () => localStorage.setItem(KEY, JSON.stringify(S));
const app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = x => x == null ? '—' : Math.round(x * 100) + '%';
const download = (name, text, type = 'text/csv') => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([type === 'text/csv' ? '\uFEFF' + text : text], { type: type + ';charset=utf-8' })); a.download = name; a.click(); };
let flash = '';
function setData(d, m) { S.data = d; save(); flash = m; }

const tabs = document.querySelectorAll('#tabs button');
tabs.forEach(b => b.onclick = () => { S.tab = b.dataset.t; save(); render(); });

function render() {
  tabs.forEach(b => b.classList.toggle('on', b.dataset.t === S.tab));
  app.innerHTML = ({ s1, s2, s3, s4 })[S.tab]();
  app.querySelectorAll('[data-act]').forEach(el => el.addEventListener(el.tagName === 'INPUT' || el.tagName === 'SELECT' ? 'change' : 'click', e => ACT[el.dataset.act](e, el)));
  flash = '';
}
const msg = () => flash ? `<div class="msg ${flash.startsWith('⚠') ? 'err' : ''}">${esc(flash)}</div>` : '';
const needData = () => `<div class="card"><p>還沒有資料。請先到「② 匯入資料」貼上 AI 的結果，或先 <button class="btn" data-act="demo">載入範例</button></p></div>`;

function s1() {
  return `<div class="card"><h2>① 掃描或用手機拍照留存</h2><p>沒有掃描器也沒關係，用手機拍照就能讓 AI 讀取。</p><ul class="tips">${PHOTO_TIPS.map(t => `<li>📷 ${esc(t)}</li>`).join('')}</ul></div>
  <div class="card"><h2>② 交給 AI 分析（Gemini／ChatGPT）</h2><p>把考卷照片和標準答案一起上傳，再貼上下面這段提示詞。AI 會輸出本工具的 CSV 格式，複製後到「② 匯入資料」貼上即可。</p>
  <pre class="prompt" id="prompt">${esc(AI_PROMPT)}</pre><button class="btn" data-act="copyPrompt">📋 複製提示詞</button><button class="btn alt" data-act="tpl">⬇ 下載 CSV 範本</button>${msg()}
  <p class="legend">提醒：AI 讀考卷可能看錯，匯入後請在表格中快速核對。</p></div>`;
}
function s2() {
  const d = S.data;
  return `<div class="card"><h2>匯入 AI 結果</h2>${msg()}<textarea id="paste" placeholder="把 AI 輸出的 CSV 或 JSON 貼在這裡（有沒有 \`\`\` 都可以）"></textarea>
  <button class="btn" data-act="paste">匯入貼上的資料</button><label class="btn alt">📂 上傳 CSV<input type="file" accept=".csv,.txt,.json" hidden data-act="file"></label>
  <button class="btn alt" data-act="demo">載入範例</button><button class="btn alt" data-act="tpl">⬇ CSV 範本</button>${d ? '<button class="btn alt" data-act="export">⬇ 匯出目前資料 CSV</button><button class="btn warn" data-act="clear">清除這台裝置上的資料</button>' : ''}</div>
  <div class="card"><h2>手動編輯題目 ${d && d.title ? '｜' + esc(d.title) : ''}</h2><p class="legend">沒有個別學生資料時，可直接填「答對率」（例如 65%）。有座號資料時，答對率會自動計算。</p>
  <p>測驗名稱：<input id="title" data-act="title" value="${esc(d?.title || '')}" style="width:320px"></p>
  <div style="overflow:auto"><table><tr><th>題號</th><th>題目</th><th>正確答案</th><th>詳解</th><th>學習內容</th><th>題型</th><th>選項（| 分隔）</th><th>答對率</th><th></th></tr>
  ${(d?.questions || []).map((q, i) => `<tr>${['id', 'q', 'answer', 'explain', 'unit'].map(k => `<td><input data-act="cell" data-i="${i}" data-k="${k}" value="${esc(q[k])}"></td>`).join('')}
  <td><select data-act="cell" data-i="${i}" data-k="type">${['選擇', '是非', '填充'].map(t => `<option ${q.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></td>
  <td><input data-act="cell" data-i="${i}" data-k="options" value="${esc(q.options.join('|'))}"></td><td><input data-act="cell" data-i="${i}" data-k="rate" value="${q.rate == null ? '' : Math.round(q.rate * 100) + '%'}" style="width:60px"></td>
  <td><button class="btn alt" data-act="del" data-i="${i}">✕</button></td></tr>`).join('')}</table></div>
  <button class="btn" data-act="add">＋ 新增題目</button> ${d ? `<span class="legend">共 ${d.questions.length} 題、${Object.keys(d.results).length} 位座號資料</span>` : ''}</div>`;
}
function bars(items, labelFn) {
  return `<div class="bars">${items.map(x => `<div class="row"><span class="lab" title="${esc(labelFn(x))}">${esc(labelFn(x))}</span><div class="track"><div class="fill ${x.level}" style="width:${Math.max(2, x.err * 100)}%"></div></div><span>${pct(x.err)}</span></div>`).join('')}</div>`;
}
const badge = l => ({ high: '<span class="tag high">⚠ 需補強</span>', mid: '<span class="tag mid">注意</span>', low: '<span class="tag low">✓ 良好</span>' }[l] || '');
function s3() {
  if (!S.data) return needData();
  const a = analyze(S.data, S.th), sg = suggestions(a);
  const max = Math.max(1, ...a.bins);
  return `<div class="card noprint th">門檻：⚠ 錯誤率 ≥ <input type="number" data-act="th" data-k="high" value="${S.th.high * 100}" min="1" max="100">%　注意 ≥ <input type="number" data-act="th" data-k="mid" value="${S.th.mid * 100}" min="0" max="100">%　<button class="btn alt" data-act="print">🖨 列印／存成 PDF</button></div>
  <div class="card"><h2>班級學習落點｜${esc(S.data.title || '段考')}</h2><div class="stats"><div class="stat">題數<b>${a.total}</b></div><div class="stat">座號數<b>${a.seatCount || '—'}</b></div><div class="stat">平均分數<b>${a.avg == null ? '—' : Math.round(a.avg)}</b></div><div class="stat">需補強題數<b>${a.questions.filter(q => q.level === 'high').length}</b></div></div>
  <p class="legend">${badge('high')} ≥ ${pct(S.th.high)}　${badge('mid')} ${pct(S.th.mid)}–${pct(S.th.high)}　${badge('low')} &lt; ${pct(S.th.mid)}（錯誤率）</p></div>
  <div class="grid2"><div class="card"><h2>各學習內容錯誤率</h2>${bars(a.units, u => u.unit)}</div>
  <div class="card"><h2>分數分布</h2>${a.seatCount ? `<div class="hist">${a.bins.map(n => `<div>${n || ''}<span class="b" style="height:${n / max * 120}px"></span></div>`).join('')}</div><div class="histlab">${a.bins.map((_, i) => `<span>${i * 10}${i === 9 ? '+' : ''}</span>`).join('')}</div>` : '<p class="legend">只有答對率資料，沒有個別分數。</p>'}</div></div>
  <div class="card"><h2>各題錯誤率（由高到低）</h2>${bars(a.sortedQ, q => `第 ${q.id} 題・${q.unit}`)}</div>
  <div class="card sugg"><h2>教學建議（依資料自動產生）</h2>${sg.length ? `<ol>${sg.map(s => `<li><span class="u">${esc(s.unit)}</span> ${badge(s.level)}<ul><li>${esc(s.grasp)}</li><li>${esc(s.adjust)}</li><li>${esc(s.plan)}</li></ul></li>`).join('')}</ol>` : '<p>所有學習內容錯誤率都低於門檻，全班表現良好！</p>'}</div>
  ${a.seatCount ? `<div class="card"><h2>各座號錯題</h2><div class="seat">${a.perSeat.map(p => `<div><b>${esc(p.seat)} 號</b>｜${p.score ?? '—'} 分<br>${p.wrong.length ? '錯：' + p.wrong.map(esc).join('、') : '全對 🎉'}</div>`).join('')}</div></div>` : ''}`;
}
function reviewURL() { return new URL('review.html', location.href).href.split('#')[0] + '#d=' + encodePayload(reviewPayload(S.data)); }
function s4() {
  if (!S.data) return needData();
  const u = reviewURL();
  return `<div class="card"><h2>產生學生互動檢討網頁</h2><p>檢討頁只包含題目、正確答案與詳解，<b>不包含任何學生成績</b>。學生自己點選錯題 → 看詳解 → 訂正練習 → 再次挑戰。</p>${msg()}
  <h3>方法一：分享連結（貼到 Google Classroom）</h3><div class="linkbox" id="rlink">${esc(u)}</div><button class="btn" data-act="copyLink">📋 複製連結</button><a class="btn alt" href="${esc(u)}" target="_blank" id="openReview">開啟預覽</a> <span class="legend">連結長度 ${u.length} 字元${u.length > 8000 ? '，偏長，建議改用方法二' : ''}</span>
  <h3>方法二：下載單一 HTML 檔（可上傳到 Google Sites／雲端硬碟）</h3><button class="btn" data-act="html">⬇ 下載檢討頁 HTML</button></div>`;
}
const ACT = {
  demo() { setData(demoData(), '已載入範例資料（虛構的台語段考）。'); S.tab = S.tab === 's1' ? 's3' : S.tab; save(); render(); },
  copyPrompt() { navigator.clipboard?.writeText(AI_PROMPT); flash = '已複製提示詞。'; render(); },
  tpl() { download('段考資料範本.csv', [...HEAD, '座號1', '座號2', '座號3'].join(',') + '\n1,"題目文字",A,"詳解",聲調,選擇,"A. 選項一|B. 選項二",,1,0,1\n2,"是非題",O,"詳解",語詞,是非,,,1,1,0\n'); },
  paste() { try { const d = parseInput(document.getElementById('paste').value); if (!d.questions.length) throw new Error('沒有讀到題目'); setData(d, `匯入成功：${d.questions.length} 題、${Object.keys(d.results).length} 位座號。`); } catch (e) { flash = '⚠ 匯入失敗：' + e.message; } render(); },
  file(e) { const f = e.target.files[0]; if (!f) return; f.text().then(t => { try { const d = parseInput(t); setData(d, `已匯入 ${f.name}：${d.questions.length} 題。`); } catch (er) { flash = '⚠ ' + er.message; } render(); }); },
  export() { download('段考資料.csv', toCSV(S.data)); },
  clear() { if (confirm('確定清除這台裝置上的段考資料？（無法復原，建議先匯出 CSV）')) { S.data = null; save(); render(); } },
  title(e) { S.data ||= { title: '', questions: [], results: {} }; S.data.title = e.target.value; save(); },
  cell(e, el) { const q = S.data.questions[+el.dataset.i], k = el.dataset.k, v = e.target.value; if (k === 'options') q.options = v.split(/[|｜]/).map(s => s.trim()).filter(Boolean); else if (k === 'rate') { const n = parseFloat(v); q.rate = isNaN(n) ? null : Math.max(0, Math.min(1, n > 1 ? n / 100 : n)); } else if (k === 'id') { for (const r of Object.values(S.data.results)) if (q.id in r) { r[v] = r[q.id]; delete r[q.id]; } q.id = v; } else q[k] = v; save(); },
  add() { S.data ||= { title: '', questions: [], results: {} }; S.data.questions.push({ id: String(S.data.questions.length + 1), q: '', answer: '', explain: '', unit: '未分類', type: '選擇', options: [], rate: null }); save(); render(); },
  del(e, el) { S.data.questions.splice(+el.dataset.i, 1); save(); render(); },
  th(e, el) { S.th[el.dataset.k] = Math.max(0, Math.min(100, +e.target.value || 0)) / 100; save(); render(); },
  print() { window.print(); },
  copyLink() { navigator.clipboard?.writeText(reviewURL()); flash = '已複製檢討頁連結。'; render(); },
  html() { const p = reviewPayload(S.data); const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.t)}</title><style>${reviewCSS}</style></head><body><div id="rv"></div><script>window.__REVIEW__=${JSON.stringify(p).replace(/</g, '\\u003c')};<\/script><script>${reviewJS.replace(/<\/script/gi, '<\\/script')}<\/script></body></html>`; download((p.t || '段考檢討') + '.html', html, 'text/html'); },
};
render();
