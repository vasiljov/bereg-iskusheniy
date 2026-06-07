/* ============================================================
   БЕРЕГ ИСКУШЕНИЙ — motion & interactions
   ============================================================ */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- scroll reveals ---------- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        if (e.target.dataset.onreveal === 'audience') animateAudience(e.target);
        if (e.target.dataset.onreveal === 'chart') animateChart();
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

  /* ---------- nav solidify ---------- */
  var nav = document.querySelector('.nav');
  function onScroll() {
    if (window.scrollY > 40) nav.classList.add('solid');
    else nav.classList.remove('solid');
    if (!reduce) parallax();
  }
  /* ---------- decorative parallax (ribbons + hero poster drift) ---------- */
  var ribbons = document.querySelectorAll('.ribbon');
  var heroMedia = document.querySelector('.hero__media');
  var heroH = window.innerHeight;
  function parallax() {
    var y = window.scrollY;
    ribbons.forEach(function (r, i) {
      var dir = i % 2 === 0 ? 1 : -1;
      r.style.transform = (r.classList.contains('ribbon--tl') ? 'rotate(8deg)' : 'rotate(-12deg)') +
        ' translateY(' + (y * 0.06 * dir) + 'px)';
    });
    if (heroMedia && y < heroH) {
      heroMedia.style.setProperty('--py', (y * 0.06) + 'px');
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- audience bars ---------- */
  function animateAudience(scope) {
    scope.querySelectorAll('.aud__bar').forEach(function (bar) {
      var w = bar.getAttribute('data-w');
      requestAnimationFrame(function () { bar.style.width = w + '%'; });
    });
  }

  /* ---------- investment chart ---------- */
  // milestones: capital need curve (млн ₽) over project timeline
  var pts = [
    { x: 0,  y: -20,  m: 0,  label: 'Старт',  cap: '−20', sub: 'Начальный капитал' },
    { x: 1,  y: -210, m: 3,  label: 'Запуск', cap: '−210', sub: 'Запуск ШОУ' },
    { x: 2,  y: -220, m: 5,  label: 'Пик',    cap: '−220', sub: 'Пик инвестиций' },
    { x: 3.4,y: 42,   m: 15, label: 'Возврат',cap: '+42',  sub: 'Первая прибыль' }
  ];
  var chartDone = false;
  function animateChart() {
    if (chartDone) return; chartDone = true;
    var svg = document.getElementById('investChart');
    if (!svg) return;
    var W = 760, H = 300, padL = 56, padR = 30, padT = 24, padB = 48;
    var iw = W - padL - padR, ih = H - padT - padB;
    var minY = -240, maxY = 80;
    var maxX = 3.4;
    function X(x) { return padL + (x / maxX) * iw; }
    function Y(v) { return padT + (1 - (v - minY) / (maxY - minY)) * ih; }

    var ns = 'http://www.w3.org/2000/svg';
    function mk(tag, attrs) {
      var el = document.createElementNS(ns, tag);
      for (var k in attrs) el.setAttribute(k, attrs[k]);
      return el;
    }
    // grid + axis labels
    var grids = [80, 0, -80, -160, -240];
    grids.forEach(function (g) {
      var y = Y(g);
      svg.appendChild(mk('line', { x1: padL, y1: y, x2: W - padR, y2: y,
        stroke: g === 0 ? 'rgba(200,169,81,.4)' : 'rgba(255,255,255,.07)', 'stroke-width': g === 0 ? 1.2 : 1,
        'stroke-dasharray': g === 0 ? '' : '3 5' }));
      var t = mk('text', { x: padL - 12, y: y + 4, 'text-anchor': 'end',
        fill: 'var(--mute)', 'font-size': 11, 'font-family': 'var(--font-mono)' });
      t.textContent = g;
      svg.appendChild(t);
    });
    // zero baseline label
    var zlab = mk('text', { x: W - padR, y: Y(0) - 8, 'text-anchor': 'end', fill: 'var(--mute-deep)', 'font-size': 10, 'letter-spacing': '.1em' });
    zlab.textContent = '0 ₽';
    svg.appendChild(zlab);

    // month timeline axis (anchors the month tick markers)
    svg.appendChild(mk('line', { x1: padL, y1: H - padB, x2: W - padR, y2: H - padB,
      stroke: 'rgba(255,255,255,.12)', 'stroke-width': 1 }));

    // build smooth path
    function path(close) {
      var d = 'M ' + X(pts[0].x) + ' ' + Y(pts[0].y);
      for (var i = 1; i < pts.length; i++) {
        var p0 = pts[i - 1], p1 = pts[i];
        var cx = (X(p0.x) + X(p1.x)) / 2;
        d += ' C ' + cx + ' ' + Y(p0.y) + ' ' + cx + ' ' + Y(p1.y) + ' ' + X(p1.x) + ' ' + Y(p1.y);
      }
      if (close) d += ' L ' + X(pts[pts.length - 1].x) + ' ' + Y(0) + ' L ' + X(pts[0].x) + ' ' + Y(0) + ' Z';
      return d;
    }
    // area fill
    var area = mk('path', { d: path(true), fill: 'url(#areaGrad)', opacity: 0 });
    svg.appendChild(area);
    // line
    var line = mk('path', { d: path(false), fill: 'none', stroke: 'url(#lineGrad)', 'stroke-width': 3,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    svg.appendChild(line);
    var len = line.getTotalLength();
    line.style.strokeDasharray = len;
    line.style.strokeDashoffset = reduce ? 0 : len;

    if (!reduce) {
      line.style.transition = 'stroke-dashoffset 1.8s cubic-bezier(.4,.1,.2,1)';
      requestAnimationFrame(function () { line.style.strokeDashoffset = 0; });
      area.style.transition = 'opacity 1.2s ease 1s';
      requestAnimationFrame(function () { area.style.opacity = 1; });
    } else { area.style.opacity = 1; }

    // points + labels
    pts.forEach(function (p, i) {
      var cx = X(p.x), cy = Y(p.y);
      var up = p.y >= 0;
      var g = mk('g', { opacity: reduce ? 1 : 0 });
      var halo = mk('circle', { cx: cx, cy: cy, r: 11, fill: up ? 'rgba(200,169,81,.18)' : 'rgba(155,33,66,.2)' });
      var dot = mk('circle', { cx: cx, cy: cy, r: 5.5, fill: up ? 'var(--gold-bright)' : '#D89793', stroke: '#05080A', 'stroke-width': 2 });
      g.appendChild(halo); g.appendChild(dot);
      // deep-negative & positive labels sit ABOVE the point; shallow start sits below
      var above = (p.y <= -100) || up;
      var ly = above ? cy - 18 : cy + 28;
      var cap = mk('text', { x: cx, y: ly, 'text-anchor': 'middle', fill: up ? 'var(--gold-bright)' : '#D89793',
        'font-size': 18, 'font-family': 'var(--font-display)' });
      cap.textContent = p.cap;
      g.appendChild(cap);
      // x label (milestone name)
      var xl = mk('text', { x: cx, y: H - 26, 'text-anchor': 'middle', fill: 'var(--cream-dim)', 'font-size': 11.5, 'letter-spacing': '.16em' });
      xl.textContent = p.label.toUpperCase();
      svg.appendChild(xl);
      // month tick + label
      var tickTop = H - padB;
      svg.appendChild(mk('line', { x1: cx, y1: tickTop, x2: cx, y2: tickTop + 6,
        stroke: 'rgba(200,169,81,.5)', 'stroke-width': 1.2 }));
      if (p.m !== 0) {
        var ml = mk('text', { x: cx, y: H - 8, 'text-anchor': 'middle', fill: 'var(--gold-bright)',
          'font-size': 14, 'font-weight': 600, 'font-family': 'var(--font-mono)', 'letter-spacing': '.06em' });
        ml.textContent = 'мес ' + p.m;
        svg.appendChild(ml);
      }
      svg.appendChild(g);
      if (!reduce) {
        g.style.transition = 'opacity .5s ease';
        setTimeout(function () { g.style.opacity = 1; }, 700 + i * 320);
      }
    });
  }

  /* ---------- smooth anchor nav ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        var top = target.getBoundingClientRect().top + window.scrollY - 64;
        window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
      }
    });
  });
})();
