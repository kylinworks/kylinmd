/* ===== 设置：主题 / 同步滚动 / 字号 / 语言，均持久化到 localStorage =====
 * 语言规则：
 *   - 每种语言一个静态页面，默认语言跟随当前页面的 <html lang>
 *   - localStorage 记住上次选择；?lg=xxx 优先级最高，读到就写进去
 *   - 真正切语言要换页面（app.js 负责跳转），这里只发请求、管状态
 */
const Settings = (() => {
  const KEY = "md-preview.settings";
  const DEFAULTS = { sync: true, theme: "light", fontSize: 14, lang: DEFAULT_LANG };
  const state = { ...DEFAULTS };
  let lastFocus = null;
  let urlLang = false;

  function load() {
    state.lang = pageLang();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(state, JSON.parse(raw));
    } catch (e) { /* 忽略损坏的配置 */ }
    return state;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 忽略 */ }
  }

  /* ?lg=zh-TW —— 原样存下来（哪怕不认识），显示时再解析 */
  function applyUrlLang() {
    let raw = null;
    try {
      const params = new URLSearchParams(location.search);
      raw = params.get("lg") != null ? params.get("lg") : params.get("lang");
    } catch (e) { /* 忽略 */ }
    if (raw == null) return null;
    state.lang = String(raw).trim();
    urlLang = true;
    save();
    return state.lang;
  }

  /* 实际生效的语言（受支持的语言代码） */
  function resolvedLang() {
    return resolveLang(state.lang);
  }

  /* 原地换语言：只改界面文案，不换页面（跨语言由 app.js 跳转到静态页） */
  function applyLang(raw) {
    state.lang = raw == null ? pageLang() : String(raw).trim();
    save();
    applyI18n(state.lang);
    syncLangControl();
    document.dispatchEvent(new CustomEvent("app:langchange"));
  }

  /* 下拉框选择：交给 app.js 决定是跳页还是原地换 */
  function setLang(raw) {
    document.dispatchEvent(new CustomEvent("app:langrequest", { detail: { lang: resolveLang(raw) } }));
  }

  function resolvedTheme() {
    if (state.theme === "auto") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return state.theme;
  }

  function applyTheme() {
    const t = resolvedTheme();
    document.documentElement.setAttribute("data-theme", t);
    document.getElementById("hljs-light").disabled = t === "dark";
    document.getElementById("hljs-dark").disabled = t !== "dark";

    // 移动端浏览器地址栏配色跟随主题
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t === "dark" ? "#161b22" : "#fafbfc");

    document.querySelectorAll("#opt-theme button").forEach((b) => {
      const on = b.dataset.themeOpt === state.theme;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }

  function applyFontSize() {
    document.documentElement.style.setProperty("--editor-font-size", state.fontSize + "px");
    document.documentElement.style.setProperty("--preview-font-size", (state.fontSize + 1) + "px");
  }

  function syncLangControl() {
    const sel = document.getElementById("opt-lang");
    if (sel) sel.value = resolvedLang();
  }

  function syncControls() {
    document.getElementById("opt-sync").checked = !!state.sync;
    document.getElementById("opt-fontsize").value = String(state.fontSize);
    syncLangControl();
  }

  function panel() {
    return document.getElementById("settings");
  }

  function open() {
    const p = panel();
    lastFocus = document.activeElement;
    p.classList.add("open");
    p.removeAttribute("inert");
    p.setAttribute("aria-hidden", "false");
    document.getElementById("scrim").classList.add("show");
    // 打开后把焦点送进抽屉，键盘 / 读屏用户不会「丢焦点」
    requestAnimationFrame(() => {
      const target = p.querySelector("#settings-close");
      if (target) target.focus();
    });
  }

  function close() {
    const p = panel();
    if (!p.classList.contains("open")) return;
    p.classList.remove("open");
    p.setAttribute("aria-hidden", "true");
    p.setAttribute("inert", "");
    document.getElementById("scrim").classList.remove("show");
    // 焦点还给触发按钮
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    lastFocus = null;
  }

  // 抽屉内 Tab 循环，避免焦点跑到背后页面
  function trapFocus(e) {
    if (e.key !== "Tab") return;
    const p = panel();
    const nodes = p.querySelectorAll('button:not([disabled]), select:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
    const items = Array.from(nodes).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function bindEvents() {
    document.getElementById("btn-settings").addEventListener("click", open);
    document.getElementById("settings-close").addEventListener("click", close);
    document.getElementById("scrim").addEventListener("click", close);

    document.getElementById("opt-sync").addEventListener("change", (e) => {
      state.sync = e.target.checked;
      save();
    });

    document.getElementById("opt-theme").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-theme-opt]");
      if (!btn) return;
      state.theme = btn.dataset.themeOpt;
      save();
      applyTheme();
      document.dispatchEvent(new CustomEvent("app:themechange"));
    });

    document.getElementById("opt-fontsize").addEventListener("change", (e) => {
      state.fontSize = parseInt(e.target.value, 10) || 14;
      save();
      applyFontSize();
    });

    document.getElementById("opt-lang").addEventListener("change", (e) => {
      setLang(e.target.value);
    });

    panel().addEventListener("keydown", trapFocus);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  // 系统主题变化（仅在“自动”模式下响应）
  function init() {
    load();
    applyUrlLang();   // ?lg= 优先于 localStorage
    applyTheme();
    applyFontSize();
    syncControls();
    bindEvents();

    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (state.theme === "auto") {
        applyTheme();
        document.dispatchEvent(new CustomEvent("app:themechange"));
      }
    });
  }

  return {
    load, save, init, open, close,
    setLang, applyLang, resolvedLang, state,
    hasUrlLang: () => urlLang
  };
})();
