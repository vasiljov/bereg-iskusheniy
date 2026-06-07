/* ============================================================================
   Раздел «Масштабирование» — таблица Upside_Франшизы из финмодели.
   Данные сидированы из Гугл-таблицы (вкладка Upside_Франшизы). Секции
   сворачиваются/раскрываются. Суммы в ₽ млн.
   ========================================================================== */
(function () {
  var mount = document.getElementById("scale36");
  if (!mount) return;

  // [label, level(0=секция,1=строка), [Год1,Год2,Год3,Σ], flags{total}]
  var DATA = [
    { l: "Франшиза кабаре", sec: true, v: ["", "", "", ""] },
    { l: "Выручка 1 франшизы кабаре / год (расчёт)", v: [0, 0, 2.44, ""] },
    { l: "Паушальные взносы кабаре", v: [0, 0, 0.1, 0.1] },
    { l: "Роялти от кабаре / год", v: [0, 0, 0.0034, 0.0034] },
    { l: "Итого франшиза кабаре", total: true, v: [0, 0, 0.1034, 0.1034] },

    { l: "Франшиза школы танцев", sec: true, v: ["", "", "", ""] },
    { l: "Выручка 1 франшизы школы / год", v: [0, 9.61, 15.02, ""] },
    { l: "Паушальные взносы школа", v: [0, 0.02, 0.125, 0.145] },
    { l: "Роялти от школ / год", v: [0, 0.0067, 0.0601, 0.0668] },
    { l: "Итого франшиза школы", total: true, v: [0, 0.0267, 0.1851, 0.2118] },

    { l: "Итого upside", sec: true, v: ["", "", "", ""] },
    { l: "Выручка базовый сценарий (Москва)", v: [762.02, 1948.47, 3498.74, 6209.22] },
    { l: "+ Франшиза кабаре", v: [0, 0, 0.1034, 0.1034] },
    { l: "+ Франшиза школы", v: [0, 0.0267, 0.1851, 0.2118] },
    { l: "Чистая прибыль базовый", v: [206.28, 829.75, 1714.36, 2750.4] },
    { l: "+ Чистый доход франшизы (−6% налог)", v: [0, 0.0251, 0.2712, 0.2963] },
    { l: "Чистая прибыль с upside", total: true, v: [206.28, 829.78, 1714.63, 2750.7] }
  ];

  DATA.forEach(function (r) { if (r.sec) r.collapsed = false; });

  function fmt(v) {
    if (v === "" || v == null) return "—";
    var n = +v;
    if (!isFinite(n)) return String(v);
    if (n === 0) return "—";
    var a = Math.abs(n), o;
    if (a >= 100) o = { maximumFractionDigits: 0 };
    else if (a >= 1) o = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
    else o = { maximumFractionDigits: 4 };
    return n.toLocaleString("ru-RU", o);
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function render() {
    var html = '<div class="sc-scroll"><table class="sc-tbl"><thead><tr>' +
      '<th class="sc-lbl">Статья</th><th>Год 1</th><th>Год 2</th><th>Год 3</th><th>Σ 3 года</th>' +
      "</tr></thead><tbody>";
    var collapsing = false;
    DATA.forEach(function (r, i) {
      if (r.sec) {
        collapsing = r.collapsed;
        var caret = '<span class="sc-caret">▾</span>';
        html += '<tr class="sc-section' + (r.collapsed ? " is-collapsed" : "") + '" data-i="' + i + '">' +
          '<td class="sc-lbl">' + caret + esc(r.l) + "</td>" +
          '<td class="sc-num"></td><td class="sc-num"></td><td class="sc-num"></td><td class="sc-num"></td></tr>';
        return;
      }
      if (collapsing) return;
      var cls = "sc-row" + (r.total ? " sc-total" : " sc-sub");
      html += '<tr class="' + cls + '"><td class="sc-lbl">' + esc(r.l) + "</td>";
      r.v.forEach(function (val, ci) {
        html += '<td class="' + (ci === 3 ? "sc-grand" : "sc-num") + '">' + fmt(val) + "</td>";
      });
      html += "</tr>";
    });
    html += "</tbody></table></div>";
    mount.innerHTML = html;

    Array.prototype.forEach.call(mount.querySelectorAll(".sc-section"), function (tr) {
      tr.addEventListener("click", function () {
        var i = +tr.getAttribute("data-i");
        DATA[i].collapsed = !DATA[i].collapsed;
        render();
      });
    });
  }

  render();
})();
