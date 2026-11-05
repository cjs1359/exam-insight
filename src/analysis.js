// 解析與分析（純函式，可測試）
export const HEAD = ['題號','題目','正確答案','詳解','學習內容','題型','選項','答對率'];
const ALIAS = { '題號':['題號','id','no'], '題目':['題目','question'], '正確答案':['正確答案','答案','answer'], '詳解':['詳解','解析','explain'], '學習內容':['學習內容','單元','unit'], '題型':['題型','type'], '選項':['選項','options'], '答對率':['答對率','rate'] };

export function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i+1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',' || c === '\t') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i+1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.map(r => r.map(s => s.trim())).filter(r => r.some(s => s !== ''));
}

const truthy = v => /^(1|o|○|v|✓|對|正確|true|t|y)$/i.test(String(v).trim());
const falsy = v => /^(0|x|×|✗|錯|錯誤|false|f|n)$/i.test(String(v).trim());

function stripFence(t) { const m = t.match(/```(?:json|csv)?\s*\n([\s\S]*?)```/i); return (m ? m[1] : t).trim(); }

export function parseInput(raw) {
  const t = stripFence(String(raw || ''));
  if (!t) throw new Error('沒有資料');
  if (t[0] === '{' || t[0] === '[') return normalize(JSON.parse(t));
  return fromRows(parseCSV(t));
}

function fromRows(rows) {
  if (rows.length < 2) throw new Error('CSV 至少要有標題列與一題');
  const h = rows[0]; const idx = {};
  for (const k of HEAD) idx[k] = h.findIndex(c => ALIAS[k].includes(c.toLowerCase()));
  if (idx['題號'] < 0) throw new Error('找不到「題號」欄');
  const known = new Set(Object.values(idx).filter(i => i >= 0));
  const seatCols = h.map((c, i) => [c, i]).filter(([c, i]) => !known.has(i) && /\d/.test(c)).map(([c, i]) => [c.replace(/[^\d]/g, ''), i]);
  const questions = [], results = {};
  for (const [s] of seatCols) results[s] = {};
  for (const r of rows.slice(1)) {
    const g = k => idx[k] >= 0 ? (r[idx[k]] ?? '') : '';
    const id = g('題號'); if (!id) continue;
    const rateStr = g('答對率');
    questions.push({ id, q: g('題目'), answer: g('正確答案'), explain: g('詳解'), unit: g('學習內容') || '未分類', type: g('題型') || guessType(g('選項')), options: g('選項') ? g('選項').split(/[|｜]/).map(s => s.trim()).filter(Boolean) : [], rate: rateStr === '' ? null : parseRate(rateStr) });
    for (const [s, i] of seatCols) { const v = r[i] ?? ''; if (truthy(v)) results[s][id] = 1; else if (falsy(v)) results[s][id] = 0; }
  }
  return normalize({ questions, results });
}

function guessType(opts) { return opts ? '選擇' : '填充'; }
export function parseRate(s) { s = String(s).replace('%', '').trim(); let n = parseFloat(s); if (isNaN(n)) return null; if (n > 1) n /= 100; return Math.max(0, Math.min(1, n)); }

export function normalize(d) {
  if (Array.isArray(d)) d = { questions: d };
  const questions = (d.questions || []).map((q, i) => ({ id: String(q.id ?? q['題號'] ?? i + 1), q: q.q ?? q['題目'] ?? '', answer: String(q.answer ?? q['正確答案'] ?? ''), explain: q.explain ?? q['詳解'] ?? '', unit: q.unit ?? q['學習內容'] ?? '未分類', type: q.type ?? q['題型'] ?? '選擇', options: Array.isArray(q.options ?? q['選項']) ? (q.options ?? q['選項']) : String(q.options ?? q['選項'] ?? '').split(/[|｜]/).filter(Boolean), rate: q.rate == null ? null : parseRate(q.rate) }));
  const results = {};
  const src = d.results || d.students || {};
  if (Array.isArray(src)) for (const s of src) results[String(s.seat ?? s['座號'])] = Object.fromEntries(Object.entries(s.answers || s.correct || {}).map(([k, v]) => [String(k), truthy(v) || v === 1 || v === true ? 1 : 0]));
  else for (const [s, m] of Object.entries(src)) results[String(s)] = Object.fromEntries(Object.entries(m).map(([k, v]) => [String(k), v === 1 || v === true || truthy(v) ? 1 : 0]));
  return { title: d.title || '', questions, results };
}

export function analyze(data, th = { high: 0.5, mid: 0.3 }) {
  const seats = Object.keys(data.results).sort((a, b) => a - b);
  const level = e => e >= th.high ? 'high' : e >= th.mid ? 'mid' : 'low';
  const qs = data.questions.map(q => {
    const ans = seats.map(s => data.results[s][q.id]).filter(v => v === 0 || v === 1);
    let err = ans.length ? ans.filter(v => v === 0).length / ans.length : (q.rate != null ? 1 - q.rate : null);
    return { ...q, err, n: ans.length, level: err == null ? 'none' : level(err) };
  });
  const units = {};
  for (const q of qs) { if (q.err == null) continue; (units[q.unit] ||= { unit: q.unit, sum: 0, n: 0, qids: [] }); units[q.unit].sum += q.err; units[q.unit].n++; units[q.unit].qids.push(q.id); }
  const unitList = Object.values(units).map(u => ({ unit: u.unit, err: u.sum / u.n, qids: u.qids, level: level(u.sum / u.n) })).sort((a, b) => b.err - a.err);
  const total = data.questions.length;
  const perSeat = seats.map(s => { const m = data.results[s]; const wrong = data.questions.filter(q => m[q.id] === 0).map(q => q.id); const answered = data.questions.filter(q => m[q.id] === 0 || m[q.id] === 1).length; return { seat: s, wrong, score: answered ? Math.round(100 * (answered - wrong.length) / answered) : null }; });
  const bins = Array(10).fill(0); for (const p of perSeat) if (p.score != null) bins[Math.min(9, Math.floor(p.score / 10))]++;
  const scores = perSeat.map(p => p.score).filter(v => v != null);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  return { questions: qs, sortedQ: [...qs].filter(q => q.err != null).sort((a, b) => b.err - a.err), units: unitList, perSeat, bins, avg, total, seatCount: seats.length };
}

const pct = x => Math.round(x * 100) + '%';
export function suggestions(a, top = 3) {
  return a.units.filter(u => u.level !== 'low').slice(0, top).map(u => ({ unit: u.unit, err: u.err, level: u.level,
    grasp: `掌握全班弱點：「${u.unit}」平均錯誤率 ${pct(u.err)}（第 ${u.qids.join('、')} 題），是${u.level === 'high' ? '全班最需要補強' : '需要留意'}的學習內容。`,
    adjust: `調整教學重點：下次上課先用 5–10 分鐘回顧「${u.unit}」，並以第 ${a.questions.filter(q => u.qids.includes(q.id)).sort((x, y) => y.err - x.err)[0].id} 題當作講解例題。`,
    plan: `規劃補強練習：針對「${u.unit}」準備類似題型的練習，請學生在檢討網頁完成「訂正練習」與「再次挑戰」。` }));
}

export function toCSV(data) {
  const seats = Object.keys(data.results).sort((a, b) => a - b);
  const esc = v => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const lines = [[...HEAD, ...seats.map(s => '座號' + s)].join(',')];
  for (const q of data.questions) lines.push([q.id, q.q, q.answer, q.explain, q.unit, q.type, q.options.join('|'), q.rate == null ? '' : Math.round(q.rate * 100) + '%', ...seats.map(s => { const v = data.results[s][q.id]; return v == null ? '' : v; })].map(esc).join(','));
  return lines.join('\n');
}

// 檢討頁資料：只放題目/答案/詳解，不含學生成績
export function reviewPayload(data) { return { t: data.title || '段考檢討', q: data.questions.map(q => ({ i: q.id, q: q.q, a: q.answer, e: q.explain, u: q.unit, y: q.type, o: q.options })) }; }
export function encodePayload(p) { const b = new TextEncoder().encode(JSON.stringify(p)); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
export function decodePayload(h) { h = h.replace(/-/g, '+').replace(/_/g, '/'); const s = atob(h); return JSON.parse(new TextDecoder().decode(Uint8Array.from(s, c => c.charCodeAt(0)))); }
