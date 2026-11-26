/* ===== 应用入口：渲染、同步滚动、分隔条拖拽、导出、内容加载 ===== */
(() => {
  const editor = document.getElementById("editor");
  const preview = document.getElementById("preview");
  const stats = document.getElementById("editor-stats");

  /* ---------- 渲染 ---------- */
  let renderTimer;
  function render() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      Renderer.render(editor.value);
      updateStats();
    }, 60);
  }

  function updateStats() {
    const chars = editor.value.length;
    const words = editor.value.trim() ? editor.value.trim().split(/\s+/).length : 0;
    stats.textContent = chars + " " + t("stats.chars") + " · " + words + " " + t("stats.words");
  }

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(key, vars) {
    let msg = t(key);
    if (vars && vars.name) msg = msg.replace("{name}", vars.name);
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add("show"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => { el.hidden = true; }, 220);
    }, 2000);
  }

  /* ---------- 同步滚动 ---------- */
  let syncing = false;
  function syncScroll(source, target) {
    if (!Settings.state.sync || syncing) return;
    const sMax = source.scrollHeight - source.clientHeight;
    const tMax = target.scrollHeight - target.clientHeight;
    if (sMax <= 0 || tMax <= 0) return;
    syncing = true;
    target.scrollTop = (source.scrollTop / sMax) * tMax;
    requestAnimationFrame(() => { syncing = false; });
  }

  /* ---------- 分隔条拖拽 ---------- */
  function initDivider() {
    const divider = document.getElementById("divider");
    const workspace = document.querySelector(".workspace");
    const editorPane = document.querySelector(".pane-editor");
    let dragging = false;

    divider.addEventListener("mousedown", (e) => {
      e.preventDefault();
      dragging = true;
      divider.classList.add("dragging");
      document.body.style.userSelect = "none";
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const dir = getComputedStyle(workspace).flexDirection;
      const rect = workspace.getBoundingClientRect();
      if (dir === "column") {
        const h = e.clientY - rect.top;
        editorPane.style.flex = "0 0 " + Math.max(90, Math.min(rect.height - 90, h)) + "px";
      } else {
        const w = e.clientX - rect.left;
        editorPane.style.flex = "0 0 " + Math.max(180, Math.min(rect.width - 180, w)) + "px";
      }
    });

    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      divider.classList.remove("dragging");
      document.body.style.userSelect = "";
    });
  }

  /* ---------- 内容替换（打开 / 清空 / 恢复默认） ----------
   * 正文不进 localStorage：刷新即回到当前语言的默认教程。
   * lastDefault 只用来判断用户是否动过内容，避免切语言时抹掉正在写的东西。 */
  let lastDefault = "";

  function applyContent(text) {
    editor.value = text;
    render();
  }

  function applyDefault(text) {
    applyContent(text);
    // 读回来再存：textarea 会把 CRLF 归一成 LF，直接存原文会误判成「改过」
    lastDefault = editor.value;
  }

  function isPristine() {
    return editor.value === lastDefault;
  }

  /* ---------- 语言路由：换语言 = 换静态页 ----------
   * 每种语言都有独立页面（index.html / zh.html / zh-hant.html），页面源码里
   * 的 <html lang>、title、description 和教程正文都是该语言，搜索引擎才能
   * 按语言分别收录。切语言时把没保存的编辑内容用 sessionStorage 带过去，
   * 用户感觉不到内容被重置。 */
  const HANDOFF = "md-preview.handoff";

  function langUrl(code) {
    const link = document.querySelector(
      'link[rel="alternate"][hreflang="' + langInfo(code).hreflang + '"]'
    );
    return link ? link.href : "";
  }

  // /dir/ 与 /dir/index.html 视为同一页，避免来回跳
  function samePage(url) {
    const norm = (u) => {
      const p = new URL(u, location.href);
      return (p.pathname.replace(/index\.html$/, "") + p.search).replace(/\/+$/, "");
    };
    return norm(url) === norm(location.href);
  }

  function goToLang(code) {
    const url = langUrl(code);
    if (!url || samePage(url)) return false;
    Settings.state.lang = code;
    Settings.save();
    if (!isPristine()) {
      try { sessionStorage.setItem(HANDOFF, editor.value); } catch (e) { /* 无痕模式忽略 */ }
    }
    location.assign(url);
    return true;
  }

  /* ---------- 下拉菜单：文件 / 导出（含键盘无障碍） ---------- */
  function closeAllMenus(except) {
    document.querySelectorAll(".dropdown.open").forEach((dd) => {
      if (dd === except) return;
      dd.classList.remove("open");
      const trigger = dd.querySelector("[aria-haspopup]");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    });
  }

  function initMenus() {
    const fileInput = document.getElementById("file-input");

    /* 菜单按钮模式：Enter/Space/↓ 打开并聚焦首项，↑ 聚焦末项，
       ↑↓ 循环、Home/End 跳首末、Esc 关闭并把焦点还给按钮、Tab 关闭并离开 */
    document.querySelectorAll(".dropdown").forEach((dd) => {
      const trigger = dd.querySelector("[aria-haspopup]");
      const menu = dd.querySelector('[role="menu"]');
      if (!trigger || !menu) return;
      const items = () => Array.from(menu.querySelectorAll('[role="menuitem"]'));

      function open(focusAt) {
        closeAllMenus(dd);
        dd.classList.add("open");
        trigger.setAttribute("aria-expanded", "true");
        const list = items();
        if (!list.length) return;
        if (focusAt === "last") list[list.length - 1].focus();
        else if (focusAt === "first") list[0].focus();
      }

      function close(restoreFocus) {
        if (!dd.classList.contains("open")) return;
        dd.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
        if (restoreFocus) trigger.focus();
      }

      dd.closeMenu = close;

      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        if (dd.classList.contains("open")) close(false);
        else open(null);
      });

      trigger.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); open("first"); }
        else if (e.key === "ArrowUp") { e.preventDefault(); open("last"); }
        else if (e.key === "Escape" && dd.classList.contains("open")) {
          e.preventDefault(); e.stopPropagation(); close(true);
        }
      });

      menu.addEventListener("keydown", (e) => {
        const list = items();
        const i = list.indexOf(document.activeElement);
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(true); return; }
        if (e.key === "Tab") { close(false); return; }
        let next = null;
        if (e.key === "ArrowDown") next = (i + 1) % list.length;
        else if (e.key === "ArrowUp") next = (i - 1 + list.length) % list.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = list.length - 1;
        if (next === null || i === -1) return;
        e.preventDefault();
        list[next].focus();
      });
    });

    document.addEventListener("click", () => closeAllMenus());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAllMenus();
    });

    // 打开本地文件
    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        applyContent(String(reader.result || ""));
        toast("file.opened", { name: file.name });
      };
      reader.onerror = () => toast("file.openFail");
      reader.readAsText(file, "utf-8");
      fileInput.value = ""; // 允许重复选择同一文件
    });

    // 文件菜单动作
    document.getElementById("file-menu").addEventListener("click", async (e) => {
      const item = e.target.closest("[data-file]");
      if (!item) return;
      document.getElementById("file-dropdown").closeMenu(false);
      const act = item.dataset.file;
      if (act === "open") {
        fileInput.click();
      } else if (act === "clear") {
        if (editor.value.trim() && !window.confirm(t("file.clearConfirm"))) return;
        applyContent("");
        toast("toast.cleared");
      } else if (act === "reset") {
        applyDefault(await Content.load(Settings.resolvedLang()));
        toast("toast.reset");
      }
    });

    // 导出菜单动作
    document.getElementById("export-menu").addEventListener("click", async (e) => {
      const item = e.target.closest("[data-export]");
      if (!item) return;
      document.getElementById("export-dropdown").closeMenu(false);
      const type = item.dataset.export;
      try {
        if (type === "pdf") {
          // 交给浏览器打印：文字是矢量，可选中可搜索
          Exporter.pdf();
          toast("toast.printHint");
          return;
        }
        let name;
        if (type === "md") {
          name = Exporter.md();
        } else {
          toast("toast.exporting");
          name = await Exporter[type]();
        }
        toast("toast.exportOk", { name });
      } catch (err) {
        console.error("导出失败", err);
        toast("toast.exportFail");
      }
    });
  }

  /* ---------- 窄屏视图切换：编辑 / 预览 二选一 ---------- */
  function initViewSwitch() {
    const bar = document.getElementById("view-switch");
    const buttons = Array.from(bar.querySelectorAll("[data-view]"));
    const panes = {
      editor: document.getElementById("pane-editor"),
      preview: document.getElementById("pane-preview")
    };
    const mq = window.matchMedia("(max-width: 860px)");

    // 视图偏好不落盘：每次打开都从「预览」开始
    let view = "preview";

    function apply(v) {
      view = panes[v] ? v : "preview";
      buttons.forEach((b) => {
        const on = b.dataset.view === view;
        b.setAttribute("aria-pressed", String(on));
        // 宽屏时两个面板都显示，按钮组本身也是隐藏的
        b.tabIndex = mq.matches && !on ? -1 : 0;
      });
      const single = mq.matches;
      panes.editor.hidden = single ? view !== "editor" : false;
      panes.preview.hidden = single ? view !== "preview" : false;
    }

    buttons.forEach((b) => {
      b.addEventListener("click", () => apply(b.dataset.view));
    });

    // 切换按钮之间用左右方向键（分组内常见操作）
    bar.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const cur = (e.target.closest && e.target.closest("[data-view]")) || document.activeElement;
      const i = buttons.indexOf(cur);
      if (i === -1) return;
      e.preventDefault();
      const next = buttons[(i + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length];
      next.focus();
      apply(next.dataset.view);
    });

    mq.addEventListener("change", () => apply(view));
    apply(view);
  }


  /* ---------- 编辑器事件 ---------- */
  function initEditorEvents() {
    editor.addEventListener("input", () => render());

    editor.addEventListener("scroll", () => syncScroll(editor, preview));
    preview.addEventListener("scroll", () => syncScroll(preview, editor));
  }

  /* ---------- 全局事件 ---------- */
  function initGlobalEvents() {
    document.addEventListener("editorchange", () => render());

    document.addEventListener("app:themechange", () => {
      render(); // 让 mermaid 按新主题重绘
    });

    // 设置里选了语言：能跳页就跳页，跳不了才就地换文案
    document.addEventListener("app:langrequest", (e) => {
      const target = e.detail.lang;
      if (goToLang(target)) return;
      Settings.applyLang(target);
      toast("toast.lang");
    });
  }

  /* ---------- 初始内容：当前语言的默认教程（正文不落盘） ----------
   * 从别的语言页跳过来时，先把带过来的编辑内容接上。 */
  async function loadInitialContent() {
    let handoff = null;
    try {
      handoff = sessionStorage.getItem(HANDOFF);
      if (handoff != null) sessionStorage.removeItem(HANDOFF);
    } catch (e) { /* 忽略 */ }

    applyDefault(await Content.load(Settings.resolvedLang()));

    if (handoff != null) {
      applyContent(handoff);
      toast("toast.langKept");
    }
  }

  /* ---------- 工具栏溢出提示：右侧淡出，表示还能横向滑动 ---------- */
  function initToolbarOverflow() {
    const bar = document.getElementById("toolbar");
    function update() {
      const more = bar.scrollWidth - bar.clientWidth - bar.scrollLeft > 2;
      bar.classList.toggle("has-more", more);
    }
    bar.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    document.addEventListener("app:langchange", () => setTimeout(update, 60));
    update();
  }

  /* ---------- 启动 ---------- */
  function bootstrap() {
    Settings.init();

    /* 语言对齐：?lg= 或上次记住的偏好和本页语言不一致时，跳到对应的静态页。
     * 直接打开某种语言的页面（深链接、分享链接）时以页面为准，不把人弹走。 */
    const here = pageLang();
    const want = Settings.resolvedLang();
    if (want !== here) {
      const entryPage = here === DEFAULT_LANG || Settings.hasUrlLang();
      if (entryPage && goToLang(want)) return;
      Settings.state.lang = here;
      Settings.save();
    }

    applyI18n(Settings.state.lang);
    Toolbar.init();
    initDivider();
    initViewSwitch();
    initToolbarOverflow();
    initMenus();
    initEditorEvents();
    initGlobalEvents();
    loadInitialContent();
  }

  bootstrap();
})();
