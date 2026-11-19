/* לוח המניות של טל — localStorage persistence, no invented market prices */
(() => {
  const KEY = "tal-app:v1";
  const $ = (id) => document.getElementById(id);

  const state = {
    init: "10000",
    monthly: "300",
    rate: "10",
    years: 5,
    deposits: [],
    nextId: 1,
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        if (typeof data.init === "string" || typeof data.init === "number") state.init = String(data.init);
        if (typeof data.monthly === "string" || typeof data.monthly === "number") state.monthly = String(data.monthly);
        if (data.rate) state.rate = String(data.rate);
        if (data.years) state.years = Number(data.years) || 5;
        if (Array.isArray(data.deposits)) state.deposits = data.deposits;
        if (Number.isFinite(data.nextId)) state.nextId = data.nextId;
      }
    } catch (err) {
      console.warn("load failed", err);
    }
  }

  function save(message) {
    const payload = {
      init: state.init,
      monthly: state.monthly,
      rate: state.rate,
      years: state.years,
      deposits: state.deposits,
      nextId: state.nextId,
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
    if (message) setStatus("saveStatus", message, "ok");
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {});
    }
  }

  function setStatus(id, text, kind) {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.classList.remove("ok", "err");
    if (kind) el.classList.add(kind);
  }

  function nis(n) {
    return Math.round(n).toLocaleString("he-IL") + " ₪";
  }

  function fvMonths(P, C, extras, ratePct, n) {
    const m = Math.pow(1 + ratePct / 100, 1 / 12) - 1;
    const extraAt = new Array(n + 1).fill(0);
    extras.forEach((e) => {
      const k = Math.round(Number(e.month));
      const a = Math.max(0, Number(e.amount) || 0);
      if (a > 0 && k >= 0 && k <= n) extraAt[k] += a;
    });
    const series = [];
    let v = P + extraAt[0];
    series.push(v);
    for (let k = 1; k <= n; k++) {
      v = v * (1 + m) + C + extraAt[k];
      series.push(v);
    }
    return series;
  }

  function renderHero() {
    const P = Math.max(0, parseFloat(state.init) || 0);
    const C = Math.max(0, parseFloat(state.monthly) || 0);
    const rate = parseFloat(state.rate) || 0;
    const n = Math.max(1, Math.round(state.years * 12));
    const series = fvMonths(P, C, state.deposits, rate, n);
    const end = series[series.length - 1] || 0;
    $("heroValue").textContent = nis(end);
    $("heroSub").textContent =
      "לפי הנחה של " + rate + "% בשנה, ל-" + state.years + " שנים. זו הנחה לחישוב, לא תחזית.";
    renderChart(series, state.years);
  }

  function renderChart(series, years) {
    const wrap = $("chartWrap");
    if (!series || series.length < 2 || series.every((v) => v === 0)) {
      wrap.innerHTML = '<p class="empty">אין עדיין מספיק נתונים לגרף.</p>';
      return;
    }
    const w = 320, h = 160, padL = 8, padR = 8, padT = 12, padB = 24;
    const min = 0;
    const max = Math.max(...series) * 1.08 || 1;
    const innerW = w - padL - padR;
    const innerH = h - padT - padB;
    const x = (i) => padL + (i / (series.length - 1)) * innerW;
    const y = (v) => padT + innerH - ((v - min) / (max - min)) * innerH;
    let d = "";
    series.forEach((v, i) => {
      d += (i === 0 ? "M" : "L") + x(i).toFixed(1) + " " + y(v).toFixed(1) + " ";
    });
    const area = d + "L" + x(series.length - 1).toFixed(1) + " " + (padT + innerH).toFixed(1) +
      " L" + x(0).toFixed(1) + " " + (padT + innerH).toFixed(1) + " Z";
    const lastX = x(series.length - 1);
    const lastY = y(series[series.length - 1]);
    wrap.innerHTML =
      '<svg class="chart" viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="שווי מחושב לאורך השנים">' +
      '<line class="axis" x1="' + padL + '" y1="' + (padT + innerH) + '" x2="' + (w - padR) + '" y2="' + (padT + innerH) + '"/>' +
      '<path class="area" d="' + area + '"/>' +
      '<path class="line" d="' + d + '"/>' +
      '<circle class="dot" cx="' + lastX.toFixed(1) + '" cy="' + lastY.toFixed(1) + '" r="3.5"/>' +
      '<text x="' + padL + '" y="' + (h - 6) + '">היום</text>' +
      '<text x="' + (w - padR) + '" y="' + (h - 6) + '" text-anchor="end">שנה ' + years + "</text>" +
      "</svg>";
  }

  function renderList() {
    const list = $("depList");
    list.innerHTML = "";
    if (!state.deposits.length) {
      list.innerHTML = '<li class="empty">אין עדיין הפקדות נוספות. הוסיפו אחת למעלה.</li>';
      return;
    }
    state.deposits.forEach((dep) => {
      const li = document.createElement("li");
      li.className = "item";
      const amt = Math.max(0, Number(dep.amount) || 0);
      const month = dep.month === "" ? "—" : "חודש " + dep.month;
      const note = dep.note ? dep.note : "בלי הערה";
      li.innerHTML =
        '<div><div class="amt">' + nis(amt) + "</div>" +
        '<div class="meta">' + month + " · " + escapeHtml(note) + "</div></div>";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-danger";
      btn.setAttribute("aria-label", "מחיקת הפקדה");
      btn.textContent = "מחיקה";
      btn.addEventListener("click", () => {
        state.deposits = state.deposits.filter((d) => d.id !== dep.id);
        save("ההפקדה נמחקה ונשמרה במכשיר.");
        renderList();
        renderHero();
      });
      li.appendChild(btn);
      list.appendChild(li);
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function bindForm() {
    $("init").value = state.init;
    $("monthly").value = state.monthly;
    $("rate").value = state.rate;
    $("years").value = String(state.years);
    $("yearsLabel").textContent = String(state.years);

    ["init", "monthly", "rate"].forEach((id) => {
      $(id).addEventListener("change", () => {
        state[id] = $(id).value;
        save("ההגדרות נשמרו במכשיר.");
        renderHero();
      });
      $(id).addEventListener("input", () => {
        state[id] = $(id).value;
        renderHero();
      });
    });
    $("years").addEventListener("input", () => {
      state.years = parseInt($("years").value, 10) || 5;
      $("yearsLabel").textContent = String(state.years);
      renderHero();
    });
    $("years").addEventListener("change", () => {
      state.years = parseInt($("years").value, 10) || 5;
      save("ההגדרות נשמרו במכשיר.");
    });

    $("addBtn").addEventListener("click", () => {
      const amount = $("newAmt").value.trim();
      const month = $("newMonth").value.trim();
      const note = $("newNote").value.trim();
      if (!(parseFloat(amount) > 0) || month === "") {
        setStatus("saveStatus", "מלאו סכום גדול מאפס וחודש, ואז לחצו הוספה.", "err");
        return;
      }
      state.deposits.push({ id: state.nextId++, amount, month, note });
      $("newAmt").value = "";
      $("newMonth").value = "";
      $("newNote").value = "";
      save("ההפקדה נוספה ונשמרה במכשיר. היא תישאר גם אחרי רענון.");
      renderList();
      renderHero();
    });
  }

  function bindTabs() {
    const ids = ["board", "prices", "extras", "about"];
    const tabs = ids.map((id) => ({ id, tab: $("tab-" + id), panel: $("panel-" + id) }));
    const select = (id) => {
      tabs.forEach((t) => {
        t.tab.setAttribute("aria-selected", t.id === id ? "true" : "false");
        t.panel.hidden = t.id !== id;
      });
      try { localStorage.setItem("tal-app:tab", id); } catch (e) {}
    };
    tabs.forEach((t) => t.tab.addEventListener("click", () => select(t.id)));
    let saved = null;
    try { saved = localStorage.getItem("tal-app:tab"); } catch (e) {}
    if (saved && ids.includes(saved)) select(saved);
  }

  function bindBackup() {
    $("exportBtn").addEventListener("click", () => {
      const blob = new Blob([localStorage.getItem(KEY) || "{}"], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "tal-portfolio-backup.json";
      a.click();
      URL.revokeObjectURL(a.href);
      setStatus("backupStatus", "קובץ הגיבוי ירד למכשיר.", "ok");
    });
    $("importBtn").addEventListener("click", () => $("importFile").click());
    $("importFile").addEventListener("change", async (ev) => {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data || typeof data !== "object") throw new Error("bad");
        localStorage.setItem(KEY, JSON.stringify(data));
        load();
        bindFormValuesOnly();
        renderList();
        renderHero();
        setStatus("backupStatus", "הייבוא הצליח והנתונים נשמרו במכשיר.", "ok");
      } catch (err) {
        setStatus("backupStatus", "לא הצלחתי לקרוא את הקובץ. ודאו שזה גיבוי של האפליקציה.", "err");
      }
      ev.target.value = "";
    });
  }

  function bindFormValuesOnly() {
    $("init").value = state.init;
    $("monthly").value = state.monthly;
    $("rate").value = state.rate;
    $("years").value = String(state.years);
    $("yearsLabel").textContent = String(state.years);
  }

  function fmtUsd(n) {
    return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !Number.isFinite(Number(n))) return "אין נתון";
    const v = Number(n);
    return (v > 0 ? "▲ +" : v < 0 ? "▼ " : "") + v.toFixed(2) + "%";
  }

  function renderPrices(data) {
    const wrap = $("pricesTable");
    const groups = [
      { key: "large", title: "המניות הגדולות (התראה מ-3%)" },
      { key: "small", title: "המניות הקטנות והתנודתיות (התראה מכ-7%)" },
    ];
    let html = "";
    groups.forEach((g) => {
      const rows = data.quotes.filter((q) => (q.group || "large") === g.key);
      if (!rows.length) return;
      html += '<h3 class="gk-h">' + escapeHtml(g.title) + "</h3>";
      html += '<div class="gk-table-wrap"><table class="gk-table"><thead><tr><th>מניה</th><th style="text-align:end">מחיר</th><th>סוג המחיר</th><th style="text-align:end">יומי</th><th style="text-align:end">5 ימים</th><th style="text-align:end">חודש</th></tr></thead><tbody>';
      rows.forEach((q) => {
        const cls = (v) => (v > 0 ? "tone-success" : v < 0 ? "tone-danger" : "");
        const thr = g.key === "small" ? 7 : 3;
        const hit = Math.abs(Number(q.changePct1d) || 0) >= thr;
        html += "<tr><td><b>" + escapeHtml(q.ticker) + "</b>" + (hit ? ' <span class="gk-pill tone-warning">עבר את סף ההתראה</span>' : "") + "</td>" +
          '<td style="text-align:end">' + (q.source ? '<a href="' + escapeHtml(q.source) + '" target="_blank" rel="noopener">' + fmtUsd(q.price) + "</a>" : fmtUsd(q.price)) + "</td>" +
          "<td>" + escapeHtml(q.priceTypeLabel || (q.priceType === "intraday" ? "תוך-יומי" : "סגירה")) + "</td>" +
          '<td style="text-align:end" class="' + cls(q.changePct1d) + '">' + fmtPct(q.changePct1d) + "</td>" +
          '<td style="text-align:end" class="' + cls(q.changePct5d) + '">' + fmtPct(q.changePct5d) + "</td>" +
          '<td style="text-align:end" class="' + cls(q.changePct1m) + '">' + fmtPct(q.changePct1m) + "</td></tr>";
      });
      html += "</tbody></table></div>";
    });
    wrap.innerHTML = html;
    const src = data.source && data.source.href ? ' מקור: <a href="' + escapeHtml(data.source.href) + '" target="_blank" rel="noopener">' + escapeHtml(data.source.title || data.source.href) + "</a>." : "";
    $("pricesNote").innerHTML = escapeHtml(data.note || "") + src;
  }

  async function loadMarket() {
    const status = $("marketStatus");
    const note = $("marketNote");
    const pStatus = $("pricesStatus");
    try {
      const res = await fetch("./data/market.json", { cache: "no-store" });
      if (!res.ok) throw new Error("http");
      const data = await res.json();
      if (!data.asOf || !Array.isArray(data.quotes) || data.quotes.length === 0) {
        status.textContent = "אין עדיין נתוני שוק בקובץ. הבוט יעדכן את data/market.json אחרי סגירת המסחר, בלי מחירי דמה.";
        pStatus.textContent = status.textContent;
        note.textContent = data.note || "";
      } else {
        const label = data.priceTypeLabel ? " · " + data.priceTypeLabel : "";
        status.textContent = "נתוני שוק נכונים ל: " + data.asOf + label + ".";
        pStatus.textContent = "נכון ל: " + data.asOf + label + ". המסחר בארה״ב פתוח בין 16:30 ל-23:00 (שעון ישראל).";
        note.textContent = data.note || "";
        renderPrices(data);
      }
    } catch (err) {
      status.textContent = "לא הצלחתי לקרוא את קובץ נתוני השוק. אפשר להמשיך להשתמש בהפקדות, הן שמורות במכשיר.";
      pStatus.textContent = status.textContent;
    }
  }

  function installHint() {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if (!standalone) $("installHint").hidden = false;
  }

  function registerSw() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  }

  load();
  bindForm();
  bindTabs();
  bindBackup();
  renderList();
  renderHero();
  loadMarket();
  installHint();
  registerSw();
})();
