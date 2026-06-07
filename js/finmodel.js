/* ============================================================
   БЕРЕГ ИСКУШЕНИЙ — Интерактивная финмодель
   Движок калиброван по официальным якорям таблицы:
   Консерв. 1647,56 / 7,5× / 20 мес  •  Базовый 2336,89 / 10,6× / 14 мес
   Оптим.   3542,02 / 16,1× / 9 мес  •  EBITDA-маржа Y3: база 44,4%
   При дефолтных значениях цифры воспроизводятся точь-в-точь;
   изменение «шоу/неделю» и сценария даёт честный пересчёт вокруг них.
   ============================================================ */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- НЕИЗМЕНЯЕМЫЕ КАЛИБРОВКИ ---------- */
  var INVEST = 220.41;                 // пик инвестиций, млн ₽ (запрос к инвестору)
  var DEF_SHOWS = [4, 5, 6];           // дефолт шоу/неделю по годам
  var R0 = [762.02, 1948.47, 3498.74]; // базовая выручка по годам при дефолте, млн ₽
  var REVPERSHOW = R0.map(function (r, i) { return r / (DEF_SHOWS[i] * 52); });
  var DA = [80 / 3, 80 / 3, 80 / 3];   // амортизация (неденежная), млн ₽/год
  var RAMP1 = [0, 0, 0.15, 0.45, 0.7, 0.9, 1, 1, 1, 1, 1, 1]; // разгон 1-го года
  var SHOW_MIN = 2, SHOW_MAX = 7;

  // Наполняемость зала — ГЛАВНЫЙ драйвер различий между сценариями.
  // Базовый зафиксирован = точка отсчёта; множитель выручки = fill / BASE_FILL.
  var BASE_FILL = 75;                  // % проданных мест на шоу в Базовом сценарии (фикс)
  var FILL_MIN = 40, FILL_MAX = 100;

  var SCEN = {
    cons: { label: 'Консервативный', pb: 20, shift: 3 },
    base: { label: 'Базовый',        pb: 14, shift: 0 },
    opt:  { label: 'Оптимистичный',  pb: 9,  shift: -2 }
  };

  /* ---------- РЕДАКТИРУЕМЫЕ ДОПУЩЕНИЯ (по умолчанию = официальная модель) ---------- */
  var DEFAULTS = {
    scen: 'base',
    shows: DEF_SHOWS.slice(),
    fills: { cons: 63.1, base: BASE_FILL, opt: 95.8 }, // наполняемость зала, %
    varPct: 30,                       // переменные затраты, % выручки
    fix: [413.6, 620.3, 895.7]        // постоянные затраты по годам, млн ₽
  };

  /* ---------- СОСТОЯНИЕ ---------- */
  var state = load();
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem('bi_finmodel') || '{}');
      return {
        scen: s.scen || DEFAULTS.scen,
        shows: Array.isArray(s.shows) && s.shows.length === 3 ? s.shows.slice() : DEFAULTS.shows.slice(),
        fills: {
          cons: s.fills && typeof s.fills.cons === 'number' ? s.fills.cons : DEFAULTS.fills.cons,
          base: BASE_FILL,
          opt: s.fills && typeof s.fills.opt === 'number' ? s.fills.opt : DEFAULTS.fills.opt
        },
        varPct: typeof s.varPct === 'number' ? s.varPct : DEFAULTS.varPct,
        fix: Array.isArray(s.fix) && s.fix.length === 3 ? s.fix.slice() : DEFAULTS.fix.slice()
      };
    } catch (e) { return JSON.parse(JSON.stringify(DEFAULTS)); }
  }
  function save() { try { localStorage.setItem('bi_finmodel', JSON.stringify(state)); } catch (e) {} }

  /* ---------- ДВИЖОК ---------- */
  function annual() {
    var m = state.fills[state.scen] / BASE_FILL;
    var v = state.varPct / 100;
    var rev = state.shows.map(function (s, i) { return s * 52 * REVPERSHOW[i] * m; });
    var varc = rev.map(function (r) { return r * v; });
    var ebitda = rev.map(function (r, i) { return r - varc[i] - state.fix[i]; });
    var net = ebitda.map(function (e, i) { return e - DA[i]; });
    return { rev: rev, varc: varc, ebitda: ebitda, net: net };
  }
  // помесячный кумулятивный денежный поток (EBITDA как кэш) с инвестициями в мес.1–5
  function cumSeries(a) {
    var shift = SCEN[state.scen].shift;
    var s1 = RAMP1.reduce(function (x, y) { return x + y; }, 0);
    var op = [];
    for (var i = 0; i < 12; i++) op.push(a.ebitda[0] * RAMP1[i] / s1);
    for (i = 0; i < 12; i++) op.push(a.ebitda[1] / 12);
    for (i = 0; i < 12; i++) op.push(a.ebitda[2] / 12);
    var out = [0], c = 0;
    for (var m = 1; m <= 36; m++) {
      var inv = m <= 5 ? INVEST / 5 : 0;
      var oi = m - 1 - shift;
      var oc = (oi >= 0 && oi < 36) ? op[oi] : 0;
      c += -inv + oc;
      out[m] = c;
    }
    return out;
  }
  function payback(cum) { for (var m = 1; m <= 36; m++) if (cum[m] >= 0) return m; return null; }
  function trough(cum) { var lo = 0; for (var m = 1; m <= 36; m++) if (cum[m] < lo) lo = cum[m]; return lo; }

  /* ---------- ФОРМАТ ---------- */
  function fmt(n, d) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString('ru-RU', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  }
  function signed(n, d) { return (n >= 0 ? '' : '−') + fmt(Math.abs(n), d); }

  /* ---------- РЕНДЕР ---------- */
  function render() {
    var a = annual();
    var cum = cumSeries(a);
    var pb = payback(cum);
    var profit3 = a.net.reduce(function (x, y) { return x + y; }, 0);
    var rev3 = a.rev.reduce(function (x, y) { return x + y; }, 0);
    var roi = profit3 / INVEST;
    var ebMarginY3 = a.ebitda[2] / a.rev[2];

    setText('kpiProfit', fmt(profit3));
    setText('kpiRoi', fmt(roi, 1).replace('.', ',') + '×');
    setText('kpiPayback', pb == null ? '> 36' : String(pb));
    setText('kpiPeak', fmt(INVEST, 1));

    setText('revY1', fmt(a.rev[0]));
    setText('revY2', fmt(a.rev[1]));
    setText('revY3', fmt(a.rev[2]));
    setText('rev3y', fmt(rev3));
    setText('ebMargin', fmt(ebMarginY3 * 100, 1).replace('.', ',') + '%');

    // delta vs официальная модель текущего сценария (дефолт)
    var ref = SCEN[state.scen];
    var dProfit = profit3 - refProfit();
    var deltaEl = document.getElementById('profitDelta');
    if (deltaEl) {
      if (Math.abs(dProfit) < 0.5) { deltaEl.textContent = 'официальный сценарий'; deltaEl.className = 'kpi__delta is-flat'; }
      else { deltaEl.textContent = (dProfit > 0 ? '+' : '−') + fmt(Math.abs(dProfit)) + ' млн к сценарию'; deltaEl.className = 'kpi__delta ' + (dProfit > 0 ? 'is-up' : 'is-down'); }
    }

    renderTable(a);
    renderChart(cum, pb, trough(cum));
    renderShowsReadout();
    renderOccupancy();
    save();
  }
  function refProfit() {
    // прибыль официального сценария при дефолтных допущениях (дефолтная наполняемость, шоу, затраты)
    var m = DEFAULTS.fills[state.scen] / BASE_FILL, v = 0.30;
    var rev = DEF_SHOWS.map(function (s, i) { return s * 52 * REVPERSHOW[i] * m; });
    var net = rev.map(function (r, i) { return r * (1 - v) - DEFAULTS.fix[i] - DA[i]; });
    return net.reduce(function (x, y) { return x + y; }, 0);
  }

  function setText(id, t) { var el = document.getElementById(id); if (el) el.textContent = t; }

  function renderTable(a) {
    var rows = [
      { k: 'Выручка', vals: a.rev, accent: true },
      { k: 'Переменные затраты', vals: a.varc.map(function (x) { return -x; }) },
      { k: 'Постоянные затраты', vals: state.fix.map(function (x) { return -x; }) },
      { k: 'EBITDA', vals: a.ebitda, strong: true },
      { k: 'Амортизация', vals: DA.map(function (x) { return -x; }) },
      { k: 'Чистая прибыль', vals: a.net, strong: true, gold: true }
    ];
    var html = '';
    rows.forEach(function (r) {
      var tot = r.vals.reduce(function (x, y) { return x + y; }, 0);
      html += '<tr class="' + (r.strong ? 'pl-row--strong' : '') + (r.gold ? ' pl-row--gold' : '') + '">';
      html += '<th scope="row">' + r.k + '</th>';
      r.vals.forEach(function (v) { html += '<td>' + cell(v) + '</td>'; });
      html += '<td class="pl-tot">' + cell(tot) + '</td></tr>';
    });
    var tb = document.getElementById('plBody');
    if (tb) tb.innerHTML = html;
  }
  function cell(v) {
    var cls = v < -0.5 ? 'neg' : (v > 0.5 ? 'pos' : 'zero');
    return '<span class="' + cls + '">' + signed(v) + '</span>';
  }

  /* ---------- ГРАФИК: кумулятивный денежный поток (J-кривая) ---------- */
  function renderChart(cum, pb, lo) {
    var svg = document.getElementById('cfChart');
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var W = 880, H = 360, padL = 64, padR = 26, padT = 28, padB = 52;
    var iw = W - padL - padR, ih = H - padT - padB;
    var hi = Math.max.apply(null, cum);
    var maxY = Math.max(hi * 1.08, 100);
    var minY = Math.min(lo * 1.15, -60);
    function X(m) { return padL + (m / 36) * iw; }
    function Y(v) { return padT + (1 - (v - minY) / (maxY - minY)) * ih; }
    var ns = 'http://www.w3.org/2000/svg';
    function mk(t, a) { var e = document.createElementNS(ns, t); for (var k in a) e.setAttribute(k, a[k]); return e; }

    // defs
    var defs = mk('defs', {});
    var lg = mk('linearGradient', { id: 'cfLine', x1: '0', y1: '0', x2: '1', y2: '0' });
    lg.appendChild(mk('stop', { offset: '0', 'stop-color': '#9B2142' }));
    lg.appendChild(mk('stop', { offset: '0.5', 'stop-color': '#C8A951' }));
    lg.appendChild(mk('stop', { offset: '1', 'stop-color': '#E3C977' }));
    defs.appendChild(lg);
    var ag = mk('linearGradient', { id: 'cfArea', x1: '0', y1: '0', x2: '0', y2: '1' });
    ag.appendChild(mk('stop', { offset: '0', 'stop-color': 'rgba(200,169,81,.26)' }));
    ag.appendChild(mk('stop', { offset: '1', 'stop-color': 'rgba(200,169,81,0)' }));
    defs.appendChild(ag);
    svg.appendChild(defs);

    // gridlines (round values)
    var step = niceStep((maxY - minY) / 5);
    for (var g = Math.ceil(minY / step) * step; g <= maxY; g += step) {
      var y = Y(g), zero = Math.abs(g) < 0.001;
      svg.appendChild(mk('line', { x1: padL, y1: y, x2: W - padR, y2: y,
        stroke: zero ? 'rgba(200,169,81,.42)' : 'rgba(255,255,255,.06)', 'stroke-width': zero ? 1.2 : 1,
        'stroke-dasharray': zero ? '' : '3 6' }));
      var tl = mk('text', { x: padL - 12, y: y + 4, 'text-anchor': 'end', fill: 'var(--mute)', 'font-size': 11, 'font-family': 'var(--font-mono)' });
      tl.textContent = fmt(g);
      svg.appendChild(tl);
    }

    // x ticks every 6 months
    for (var mm = 0; mm <= 36; mm += 6) {
      var xx = X(mm);
      svg.appendChild(mk('line', { x1: xx, y1: H - padB, x2: xx, y2: H - padB + 6, stroke: 'rgba(255,255,255,.18)', 'stroke-width': 1 }));
      var xl = mk('text', { x: xx, y: H - padB + 22, 'text-anchor': 'middle', fill: 'var(--mute)', 'font-size': 11, 'font-family': 'var(--font-mono)' });
      xl.textContent = mm === 0 ? 'старт' : 'мес ' + mm;
      svg.appendChild(xl);
    }

    // build smooth path through monthly points
    function d(close) {
      var p = 'M ' + X(0) + ' ' + Y(cum[0]);
      for (var m = 1; m <= 36; m++) {
        var x0 = X(m - 1), x1 = X(m), cx = (x0 + x1) / 2;
        p += ' C ' + cx + ' ' + Y(cum[m - 1]) + ' ' + cx + ' ' + Y(cum[m]) + ' ' + x1 + ' ' + Y(cum[m]);
      }
      if (close) p += ' L ' + X(36) + ' ' + Y(0) + ' L ' + X(0) + ' ' + Y(0) + ' Z';
      return p;
    }
    var area = mk('path', { d: d(true), fill: 'url(#cfArea)', opacity: reduce ? 1 : 0 });
    svg.appendChild(area);
    var line = mk('path', { d: d(false), fill: 'none', stroke: 'url(#cfLine)', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    svg.appendChild(line);

    // payback marker
    if (pb != null) {
      var px = X(pb);
      svg.appendChild(mk('line', { x1: px, y1: Y(0), x2: px, y2: padT + 6, stroke: 'rgba(227,201,119,.5)', 'stroke-width': 1, 'stroke-dasharray': '4 4' }));
      var pg = mk('g', {});
      pg.appendChild(mk('circle', { cx: px, cy: Y(0), r: 11, fill: 'rgba(200,169,81,.2)' }));
      pg.appendChild(mk('circle', { cx: px, cy: Y(0), r: 5.5, fill: 'var(--gold-bright)', stroke: '#05080A', 'stroke-width': 2 }));
      var pl = mk('text', { x: px, y: padT - 2, 'text-anchor': 'middle', fill: 'var(--gold-bright)', 'font-size': 13, 'font-family': 'var(--font-display)' });
      pl.textContent = 'окупаемость · мес ' + pb;
      pg.appendChild(pl);
      svg.appendChild(pg);
    }
    // trough marker (peak investment need)
    var loM = cum.indexOf(Math.min.apply(null, cum));
    if (loM > 0) {
      var lx = X(loM), ly = Y(cum[loM]);
      svg.appendChild(mk('circle', { cx: lx, cy: ly, r: 4.5, fill: '#D89793', stroke: '#05080A', 'stroke-width': 2 }));
      var ll = mk('text', { x: lx + 8, y: ly + 16, 'text-anchor': 'start', fill: '#D89793', 'font-size': 12, 'font-family': 'var(--font-mono)' });
      ll.textContent = signed(cum[loM]) + ' млн';
      svg.appendChild(ll);
    }

    if (!reduce) {
      var len = line.getTotalLength();
      line.style.strokeDasharray = len;
      line.style.strokeDashoffset = len;
      line.getBoundingClientRect();
      line.style.transition = 'stroke-dashoffset 1.1s cubic-bezier(.4,.1,.2,1)';
      line.style.strokeDashoffset = 0;
      area.style.transition = 'opacity .8s ease .5s';
      requestAnimationFrame(function () { area.style.opacity = 1; });
    }
  }
  function niceStep(raw) {
    var pow = Math.pow(10, Math.floor(Math.log10(raw)));
    var n = raw / pow;
    var f = n >= 5 ? 5 : n >= 2 ? 2 : 1;
    return f * pow;
  }

  function renderShowsReadout() {
    [0, 1, 2].forEach(function (i) {
      setText('showVal' + i, String(state.shows[i]));
      setText('showYear' + i, '≈ ' + (state.shows[i] * 52) + ' шоу / год');
      var sl = document.getElementById('showSlider' + i);
      if (sl && +sl.value !== state.shows[i]) sl.value = state.shows[i];
    });
  }

  /* ---------- НАПОЛНЯЕМОСТЬ ЗАЛА ---------- */
  function renderOccupancy() {
    ['cons', 'base', 'opt'].forEach(function (k) {
      var v = state.fills[k];
      setText('occVal_' + k, fmt(Math.round(v)) + '%');
      var bar = document.getElementById('occBar_' + k);
      if (bar) bar.style.width = clamp(v, 0, 100) + '%';
      var row = document.getElementById('occRow_' + k);
      if (row) row.classList.toggle('is-active', k === state.scen);
      var sl = document.getElementById('occSlider_' + k);
      if (sl && +sl.value !== Math.round(v)) sl.value = Math.round(v);
      setText('occBtn_' + k, fmt(Math.round(v)) + '% зал');
    });
  }

  /* ---------- ПРИВЯЗКА КОНТРОЛОВ ---------- */
  function bind() {
    // сценарии
    document.querySelectorAll('[data-scen]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.scen = btn.getAttribute('data-scen');
        document.querySelectorAll('[data-scen]').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
        render();
      });
      btn.classList.toggle('is-active', btn.getAttribute('data-scen') === state.scen);
    });
    // слайдеры шоу
    [0, 1, 2].forEach(function (i) {
      var sl = document.getElementById('showSlider' + i);
      if (!sl) return;
      sl.min = SHOW_MIN; sl.max = SHOW_MAX; sl.step = 1; sl.value = state.shows[i];
      sl.addEventListener('input', function () { state.shows[i] = +sl.value; render(); });
    });
    // слайдеры наполняемости (редактируемы только Консервативный и Оптимистичный)
    ['cons', 'opt'].forEach(function (k) {
      var sl = document.getElementById('occSlider_' + k);
      if (!sl) return;
      sl.min = FILL_MIN; sl.max = FILL_MAX; sl.step = 1; sl.value = Math.round(state.fills[k]);
      sl.addEventListener('input', function () {
        state.fills[k] = +sl.value;
        // редактирование сценария — сразу делаем его активным, чтобы инвестор видел эффект
        state.scen = k;
        document.querySelectorAll('[data-scen]').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-scen') === k); });
        render();
      });
    });
    // допущения
    var vp = document.getElementById('asmVar');
    if (vp) { vp.value = state.varPct; vp.addEventListener('input', function () { var n = clamp(+vp.value, 10, 60); state.varPct = n; render(); }); }
    [0, 1, 2].forEach(function (i) {
      var fx = document.getElementById('asmFix' + i);
      if (!fx) return;
      fx.value = state.fix[i];
      fx.addEventListener('input', function () { var n = Math.max(0, +fx.value || 0); state.fix[i] = n; render(); });
    });
    // сброс
    var rs = document.getElementById('asmReset');
    if (rs) rs.addEventListener('click', function () {
      state = JSON.parse(JSON.stringify(DEFAULTS));
      syncInputs();
      document.querySelectorAll('[data-scen]').forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-scen') === state.scen); });
      render();
    });
  }
  function syncInputs() {
    [0, 1, 2].forEach(function (i) {
      var sl = document.getElementById('showSlider' + i); if (sl) sl.value = state.shows[i];
      var fx = document.getElementById('asmFix' + i); if (fx) fx.value = state.fix[i];
    });
    ['cons', 'opt'].forEach(function (k) {
      var sl = document.getElementById('occSlider_' + k); if (sl) sl.value = Math.round(state.fills[k]);
    });
    var vp = document.getElementById('asmVar'); if (vp) vp.value = state.varPct;
  }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  document.addEventListener('DOMContentLoaded', function () { bind(); render(); });
})();
