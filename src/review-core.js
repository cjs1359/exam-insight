// 學生檢討頁（自成一檔，可內嵌到單一 HTML）
(function () {
  function decode(h) { h = h.replace(/-/g, '+').replace(/_/g, '/'); var s = atob(h); return JSON.parse(new TextDecoder().decode(Uint8Array.from(s, function (c) { return c.charCodeAt(0); }))); }
  var root = document.getElementById('rv'); if (!root) return;
  var D = window.__REVIEW__ || null;
  try { if (!D && location.hash.length > 3) D = decode(location.hash.slice(1).replace(/^d=/, '')); } catch (e) { D = null; }
  if (!D) { root.innerHTML = '<div class="box rh"><h1>找不到檢討資料</h1><p>請向老師索取完整的檢討網址。</p></div>'; return; }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var Q = D.q, st = { seat: '', picked: [], step: 0, queue: [], idx: 0, wrongOnce: {}, answered: false, tries: 0 };
  var STEPS = ['找出錯題', '看詳解', '訂正練習', '再次挑戰', '完成'];
  var byId = function (id) { return Q.filter(function (q) { return q.i === id; })[0]; };
  function letterOf(o) { var m = String(o).trim().match(/^([A-Za-z])[\.\)、．]/); return m ? m[1].toUpperCase() : null; }
  function norm(s) { return String(s).normalize('NFC').replace(/\s+/g, '').toLowerCase(); }
  function isRight(q, v) {
    var a = norm(q.a);
    if (q.o && q.o.length) { var L = letterOf(v); return (L && norm(L) === a) || norm(v) === a; }
    if (q.y === '是非') { var t = /^(o|○|對|是|true)$/i.test(q.a.trim()); return (v === 'O') === t; }
    return norm(v) === a;
  }
  function head() { return '<div class="rh"><h1>' + esc(D.t) + '</h1>' + (st.seat ? '<div class="small">座號 ' + esc(st.seat) + '</div>' : '') + '<div class="steps">' + STEPS.map(function (s, i) { return '<span class="' + (i === st.step ? 'on' : '') + '">' + (i + 1) + '. ' + s + '</span>'; }).join('') + '</div></div>'; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function render() { root.innerHTML = head() + [pick, explain, practice, practice, done][st.step](); bind(); }
  function pick() {
    return '<div class="box"><p>座號（可不填）：<input class="seatin" id="seat" inputmode="numeric" value="' + esc(st.seat) + '"></p><p><b>點選你寫錯的題號</b>（可多選）</p><div class="qs">' +
      Q.map(function (q) { return '<button data-q="' + esc(q.i) + '" class="' + (st.picked.indexOf(q.i) >= 0 ? 'sel' : '') + '">' + esc(q.i) + '</button>'; }).join('') +
      '</div><button class="go" id="next" ' + (st.picked.length ? '' : 'disabled') + '>開始檢討（' + st.picked.length + ' 題）</button><button class="go alt" id="all">全部題目都練一次</button></div>';
  }
  function explain() {
    return st.picked.map(function (id) { var q = byId(id); return '<div class="box"><span class="unit">' + esc(q.u) + '</span> 第 ' + esc(q.i) + ' 題<div class="qt">' + esc(q.q) + '</div>' + (q.o && q.o.length ? q.o.map(function (o) { return '<div class="small">' + esc(o) + '</div>'; }).join('') : '') + '<div class="fb ok">正確答案：' + esc(q.a) + '</div>' + (q.e ? '<div class="exp">💡 ' + esc(q.e) + '</div>' : '') + '</div>'; }).join('') + '<button class="go" id="next">看懂了，開始訂正練習 ✏️</button>';
  }
  function practice() {
    var id = st.queue[st.idx], q = byId(id), total = st.queue.length;
    var label = st.step === 2 ? '訂正練習' : '再次挑戰';
    var body = '<div class="box"><div class="small">' + label + '　' + (st.idx + 1) + ' / ' + total + '</div><div class="prog"><i style="width:' + (100 * st.idx / total) + '%"></i></div><span class="unit">' + esc(q.u) + '</span> 第 ' + esc(q.i) + ' 題<div class="qt">' + esc(q.q) + '</div>';
    if (q.o && q.o.length) body += q.o.map(function (o) { return '<button class="opt" data-v="' + esc(o) + '">' + esc(o) + '</button>'; }).join('');
    else if (q.y === '是非') body += '<button class="opt" data-v="O">⭕ 對</button><button class="opt" data-v="X">❌ 錯</button>';
    else body += '<input class="fill" id="fill" placeholder="輸入答案"><button class="go" id="send">送出</button>';
    return body + '<div id="fb"></div></div>';
  }
  function done() { return '<div class="box done"><div class="big">🎉</div><h2>全部訂正完成！</h2><p>' + (st.seat ? '座號 ' + esc(st.seat) + '，' : '') + '你把 ' + st.picked.length + ' 題錯題都練到答對了，太厲害了！</p><button class="go" id="again">再挑戰一次</button><button class="go alt" id="restart">重新選題</button></div>'; }
  function answer(v, btn) {
    if (st.answered) return; var q = byId(st.queue[st.idx]), ok = isRight(q, v); st.answered = true;
    if (btn) btn.classList.add(ok ? 'right' : 'wrong');
    if (!ok && st.step === 3) st.queue.push(q.i);
    document.getElementById('fb').innerHTML = '<div class="fb ' + (ok ? 'ok' : 'no') + '">' + (ok ? '答對了！👍' : '再想想～正確答案是：' + esc(q.a) + (st.step === 3 ? '（這題稍後會再出現）' : '')) + '</div>' + (q.e ? '<div class="exp">💡 ' + esc(q.e) + '</div>' : '') + '<button class="go" id="cont">下一題 →</button>';
    document.getElementById('cont').onclick = advance;
  }
  function advance() {
    st.answered = false; st.idx++;
    if (st.idx >= st.queue.length) { if (st.step === 2) { st.step = 3; st.queue = shuffle(st.picked); st.idx = 0; } else st.step = 4; }
    render(); window.scrollTo(0, 0);
  }
  function bind() {
    var $ = function (s) { return root.querySelector(s); };
    root.querySelectorAll('.qs button').forEach(function (b) { b.onclick = function () { var id = b.dataset.q, k = st.picked.indexOf(id); if (k >= 0) st.picked.splice(k, 1); else st.picked.push(id); st.picked.sort(function (a, c) { return Q.indexOf(byId(a)) - Q.indexOf(byId(c)); }); st.seat = $('#seat').value; render(); }; });
    if ($('#seat')) $('#seat').oninput = function (e) { st.seat = e.target.value; };
    if ($('#all')) $('#all').onclick = function () { st.picked = Q.map(function (q) { return q.i; }); st.step = 1; render(); };
    if ($('#next')) $('#next').onclick = function () { st.step++; if (st.step === 2) { st.queue = st.picked.slice(); st.idx = 0; } render(); window.scrollTo(0, 0); };
    root.querySelectorAll('.opt').forEach(function (b) { b.onclick = function () { answer(b.dataset.v, b); }; });
    if ($('#send')) { $('#send').onclick = function () { answer($('#fill').value); }; $('#fill').onkeydown = function (e) { if (e.key === 'Enter') answer(e.target.value); }; }
    if ($('#again')) $('#again').onclick = function () { st.step = 3; st.queue = shuffle(st.picked); st.idx = 0; render(); };
    if ($('#restart')) $('#restart').onclick = function () { st.step = 0; st.picked = []; render(); };
  }
  render();
})();
