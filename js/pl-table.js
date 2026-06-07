/* ============================================================================
   Помесячный P&L (36 мес) — живая связь с Google-таблицей, вкладка PL_36мес.
   Источник: опубликованный CSV. Кэшируется в localStorage для отказоустойчивости.
   Сворачивание/разворачивание поддиректорий — по отступам, как в исходном файле.
   ========================================================================== */
(function () {
  var CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRpsb1TpKagysMO49d2RvzjyLcs7x5gCgJ_qlfrdBgLfQ-4FrjmL4Ovmje0HiyjpTZd2BVG6lbQ5Jmh/pub?gid=1918668730&single=true&output=csv";
  var LS_KEY = "bi_pl36_csv_v1";

  var mount = document.getElementById("pl36");
  if (!mount) return;
  var statusEl = document.getElementById("pl36-status");

  /* -------- CSV parser (кавычки, запятые, переводы строк) -------- */
  function parseCSV(text) {
    var rows = [], row = [], f = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else {
        if (c === '"') q = true;
        else if (c === ",") { row.push(f); f = ""; }
        else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
        else if (c === "\r") { /* skip */ }
        else f += c;
      }
    }
    if (f.length || row.length) { row.push(f); rows.push(row); }
    return rows;
  }

  /* -------- Построение модели из строк CSV -------- */
  var model = null, phaseBands = [], monthCols = [];

  function leadingSpaces(s) { var m = s.match(/^ */); return m ? m[0].length : 0; }
  function isNegative(s) { return /^\(.*\)$/.test(s.trim()); }
  function isBlank(s) { var t = (s || "").trim(); return t === "" || t === "-" || t === "—"; }

  function buildModel(rows) {
    // найти строку-заголовок (где col0 === "Статья")
    var hi = -1;
    for (var i = 0; i < rows.length; i++) {
      if ((rows[i][0] || "").trim() === "Статья") { hi = i; break; }
    }
    if (hi < 0) hi = 3;
    var header = rows[hi];
    var phaseRow = rows[hi - 2] || [];

    // колонки значений: 2..(len-1). Последняя — ИТОГО 3г. Пропускаем col1 (Год/мес).
    var last = header.length - 1;
    monthCols = [];
    for (var c = 2; c <= last; c++) {
      monthCols.push({ idx: c, label: (header[c] || "").trim() });
    }

    // фазовые полосы (ПОДГОТОВКА / СЕЗОН 1 / ГОД 2 / ГОД 3 / ИТОГО)
    phaseBands = [];
    for (var pc = 2; pc <= last; pc++) {
      var p = (phaseRow[pc] || "").replace(/[←→]/g, "").trim();
      if (pc === last) { phaseBands.push({ label: "Σ", span: 1 }); continue; }
      if (p) phaseBands.push({ label: p, span: 1 });
      else if (phaseBands.length) phaseBands[phaseBands.length - 1].span++;
      else phaseBands.push({ label: "", span: 1 });
    }

    // строки данных
    var data = [];
    for (var r = hi + 1; r < rows.length; r++) {
      var raw0 = rows[r][0] || "";
      var label = raw0.trim();
      var vals = monthCols.map(function (mc) { return (rows[r][mc.idx] || "").trim(); });
      var allBlank = vals.every(isBlank);
      if (label === "" && allBlank) continue; // пустой разделитель — пропускаем
      data.push({
        label: label,
        level: Math.floor(leadingSpaces(raw0) / 2),
        values: vals,
        hasValues: !allBlank,
        collapsed: false,
        parent: false
      });
    }
    // пометить родителей (следующая строка глубже по уровню)
    for (var k = 0; k < data.length; k++) {
      data[k].parent = (k + 1 < data.length && data[k + 1].level > data[k].level);
      if (data[k].parent) data[k].collapsed = true; // по умолчанию свёрнуто, как в исходнике
    }
    return data;
  }

  /* -------- видимость с учётом свёрнутых родителей -------- */
  function computeVisible(m) {
    var stack = [], vis = [];
    for (var i = 0; i < m.length; i++) {
      var lv = m[i].level;
      while (stack.length && lv <= stack[stack.length - 1]) stack.pop();
      vis[i] = stack.length === 0;
      if (m[i].parent && m[i].collapsed && vis[i]) stack.push(lv);
    }
    return vis;
  }

  function isTotal(label) { return /^(итого|ebitda|чистая|fcf|накопленн)/i.test(label.replace(/^\s+/, "")); }
  function isSection(item) { return item.level === 0 && !item.hasValues; }

  /* -------- отрисовка -------- */
  function render() {
    var vis = computeVisible(model);
    var html = '<div class="pl-scroll"><table class="pl-tbl"><thead>';
    // строка фаз
    html += '<tr class="pl-phase"><th class="pl-cap pl-sticky">Статья</th>';
    phaseBands.forEach(function (b) {
      html += '<th colspan="' + b.span + '">' + esc(b.label) + "</th>";
    });
    html += "</tr>";
    // строка месяцев
    html += '<tr class="pl-months"><th class="pl-sticky"></th>';
    monthCols.forEach(function (mc) {
      html += "<th>" + esc(mc.label.replace("Мес ", "")) + "</th>";
    });
    html += "</tr></thead><tbody>";

    model.forEach(function (item, i) {
      if (!vis[i]) return;
      var cls = "pl-row";
      if (isSection(item)) cls += " pl-section";
      if (isTotal(item.label)) cls += " pl-total";
      if (item.parent) cls += " pl-parent" + (item.collapsed ? " is-collapsed" : "");
      html += '<tr class="' + cls + '" data-i="' + i + '">';
      var pad = 6 + item.level * 16;
      var caret = item.parent ? '<span class="pl-caret">▸</span>' : '<span class="pl-caret pl-caret--none"></span>';
      html += '<td class="pl-lbl pl-sticky" style="padding-left:' + pad + 'px">' + caret + esc(item.label) + "</td>";
      item.values.forEach(function (v, ci) {
        var cellCls = "pl-num";
        if (ci === monthCols.length - 1) cellCls += " pl-grand";
        if (isNegative(v)) cellCls += " pl-neg";
        if (isBlank(v)) cellCls += " pl-blank";
        html += '<td class="' + cellCls + '">' + esc(isBlank(v) ? "·" : v) + "</td>";
      });
      html += "</tr>";
    });
    html += "</tbody></table></div>";
    mount.innerHTML = html;

    // навесить тоглы
    Array.prototype.forEach.call(mount.querySelectorAll(".pl-parent"), function (tr) {
      tr.addEventListener("click", function () {
        var i = +tr.getAttribute("data-i");
        model[i].collapsed = !model[i].collapsed;
        render();
      });
    });
  }

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function setStatus(live) {
    if (!statusEl) return;
    statusEl.textContent = live
      ? "● Данные подгружены из Google-таблицы (вкладка PL_36мес)"
      : "● Показан сохранённый снимок — живой источник временно недоступен";
    statusEl.className = "pl-live" + (live ? "" : " pl-live--cache");
  }

  function show(csvText, live) {
    model = buildModel(parseCSV(csvText));
    render();
    setStatus(live);
  }

  /* -------- загрузка: live -> кэш -> ошибка -------- */
  fetch(CSV_URL, { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
    .then(function (t) {
      try { localStorage.setItem(LS_KEY, t); } catch (e) {}
      show(t, true);
    })
    .catch(function () {
      var cached = null;
      try { cached = localStorage.getItem(LS_KEY); } catch (e) {}
      if (cached) { show(cached, false); }
      else {
        mount.innerHTML = '<p class="pl-err">Не удалось загрузить таблицу из источника. Обновите страницу или откройте финмодель напрямую.</p>';
      }
    });
})();
