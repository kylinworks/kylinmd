/* ===== Markdown 渲染器 =====
 * marked 负责 Markdown → HTML；随后在 DOM 上后处理：
 *   - 白名单净化（Markdown 允许原始 HTML，必须过滤脚本/事件/危险协议）
 *   - highlight.js 代码高亮
 *   - Mermaid 图表渲染（3.3MB 的库按需加载）
 *   - 标题生成 id（便于锚点跳转）
 *   - 外链新窗口打开
 */
const Renderer = (() => {
  marked.setOptions({ gfm: true, breaks: true });

  /* ---------- ==高亮== → <mark> ----------
   * GFM 没有这个语法（Obsidian / Typora / 飞书都支持），用 marked 的行内扩展补上。
   * 走官方扩展接口而不是「渲染前字符串替换」，这样代码块、行内代码里的 == 不会被误伤。
   */
  marked.use({
    extensions: [
      {
        name: "highlight",
        level: "inline",
        start(src) { return src.indexOf("=="); },
        tokenizer(src) {
          // 内容不能以空白开头或结尾，避免把 "x == y == z" 这种普通文本吃掉
          const m = /^==(?=\S)([\s\S]*?\S)==/.exec(src);
          if (m) return { type: "highlight", raw: m[0], tokens: this.lexer.inlineTokens(m[1]) };
        },
        renderer(token) {
          return "<mark>" + this.parser.parseInline(token.tokens) + "</mark>";
        }
      }
    ]
  });

  /* ---------- 净化 ----------
   * 用 DOMPurify（lib/purify.min.js，本地 vendor）；万一它没加载成功，
   * 退回到同一份白名单的 DOM 版兜底，绝不放行原始 HTML。
   */
  const ALLOWED_TAGS = [
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "a", "em", "strong", "del", "s",
    "code", "pre", "blockquote", "ul", "ol", "li", "hr", "br",
    "table", "thead", "tbody", "tr", "th", "td",
    "img", "input", "details", "summary", "kbd", "mark", "span", "div", "sub", "sup"
  ];
  const ALLOWED_ATTR = [
    "href", "title", "alt", "src", "class", "id", "type", "checked", "disabled",
    "start", "align", "colspan", "rowspan"
  ];
  const PURIFY_CFG = {
    ALLOWED_TAGS: ALLOWED_TAGS,
    ALLOWED_ATTR: ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false
  };

  const DROP_WITH_CONTENT = ["script", "style", "iframe", "object", "embed", "link", "meta", "base", "form", "svg", "math"];

  function dangerousUrl(v) {
    const s = String(v || "").trim().toLowerCase();
    if (s.startsWith("javascript:") || s.startsWith("vbscript:")) return true;
    return s.startsWith("data:") && !s.startsWith("data:image/");
  }

  // 兜底净化：在已解析的 DOM 上按白名单裁剪
  function sanitizeFallback(html) {
    const tpl = document.createElement("template");
    tpl.innerHTML = html;
    const walk = (root) => {
      Array.from(root.children).forEach((el) => {
        const tag = el.tagName.toLowerCase();
        if (DROP_WITH_CONTENT.indexOf(tag) >= 0) { el.remove(); return; }
        if (ALLOWED_TAGS.indexOf(tag) < 0) {
          el.replaceWith.apply(el, Array.from(el.childNodes));
          return;
        }
        Array.from(el.attributes).forEach((attr) => {
          const name = attr.name.toLowerCase();
          const okAttr = ALLOWED_ATTR.indexOf(name) >= 0;
          const okUrl = (name === "href" || name === "src") ? !dangerousUrl(attr.value) : true;
          if (!okAttr || !okUrl) el.removeAttribute(attr.name);
        });
        walk(el);
      });
    };
    walk(tpl.content);
    return tpl.innerHTML;
  }

  function sanitize(html) {
    if (window.DOMPurify && window.DOMPurify.sanitize) {
      try { return window.DOMPurify.sanitize(html, PURIFY_CFG); } catch (e) { /* 落到兜底 */ }
    }
    return sanitizeFallback(html);
  }

  /* 直接接管净化后的 DocumentFragment，省掉「序列化成字符串再 innerHTML 重新解析」的一轮 */
  function sanitizeInto(container, html) {
    if (window.DOMPurify && window.DOMPurify.sanitize) {
      try {
        const cfg = Object.assign({}, PURIFY_CFG, { RETURN_DOM_FRAGMENT: true });
        container.replaceChildren(window.DOMPurify.sanitize(html, cfg));
        return;
      } catch (e) { /* 落到兜底 */ }
    }
    container.innerHTML = sanitizeFallback(html);
  }


  function slugify(text) {
    const s = (text || "")
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return s || "section";
  }

  /* ---------- 图片占位图 ----------
   * 图片挂掉（404 / 跨域 / 断网）时统一换成一张说明性占位图：
   * 预览、PDF 截图、Word 内嵌三条路径共用同一张图，版面不会塌。
   */
  const PH_W = 640;
  const PH_H = 240;

  function escXml(s) {
    return String(s == null ? "" : s).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c])
    );
  }

  function placeholderSvg(alt, url) {
    const title = escXml((alt || t("img.alt")).slice(0, 36));
    const addr = escXml(
      String(url || "")
        .replace(/^https?:\/\//, "")
        .replace(/[?#].*$/, "")
        .slice(0, 60)
    );
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + PH_W + '" height="' + PH_H + '" viewBox="0 0 ' + PH_W + " " + PH_H + '">' +
      '<rect x="1.5" y="1.5" width="' + (PH_W - 3) + '" height="' + (PH_H - 3) + '" rx="10" fill="#f6f8fa" stroke="#c4ccd4" stroke-width="2" stroke-dasharray="9 7"/>' +
      '<g fill="none" stroke="#aeb8c2" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="292" y="46" width="56" height="44" rx="4"/>' +
      '<circle cx="309" cy="62" r="5"/>' +
      '<path d="M296 86l14-14 10 10 8-8 16 16"/>' +
      "</g>" +
      '<text x="320" y="128" text-anchor="middle" font-family="Segoe UI, Microsoft YaHei, PingFang SC, sans-serif" font-size="19" fill="#4f5862">' + escXml(t("img.failed")) + "</text>" +
      '<text x="320" y="160" text-anchor="middle" font-family="Segoe UI, Microsoft YaHei, PingFang SC, sans-serif" font-size="14" fill="#6b747e">' + title + "</text>" +
      '<text x="320" y="188" text-anchor="middle" font-family="Consolas, monospace" font-size="12" fill="#aeb8c2">' + addr + "</text>" +
      "</svg>"
    );
  }

  function placeholderUri(alt, url) {
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(placeholderSvg(alt, url));
  }

  function markFailedImage(img) {
    if (img.dataset.imgFailed) return;
    const original = img.getAttribute("src") || "";
    img.dataset.imgFailed = "1";
    img.dataset.originalSrc = original;
    img.setAttribute("src", placeholderUri(img.getAttribute("alt"), original));
    img.classList.add("img-failed");
    img.title = t("img.failed") + ": " + original;
  }

  function initMermaid() {
    if (!window.mermaid) return;
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    /* 注意：不指定 themeVariables.fontFamily。
     * mermaid 量文字宽度时的字体与最终 SVG 的字体必须一致，
     * 自定义字体栈会让「量出来窄、画出来宽」，右侧节点被 viewBox 裁掉。 */
    const base = {
      startOnLoad: false,
      theme: dark ? "dark" : "default",
      securityLevel: "loose"
    };
    try {
      // 用 SVG 原生文本标签而非 foreignObject：
      // 1) 导出的 PNG 能正常栅格化（Chrome 不允许把含 foreignObject 的 SVG 画进 canvas）
      // 2) 预览与导出的图外观一致
      mermaid.initialize(Object.assign({}, base, { flowchart: { htmlLabels: false } }));
    } catch (e) {
      // 配置项不被当前版本接受时退回基础配置，至少保证图表能渲染
      try { mermaid.initialize(base); } catch (e2) { /* 放弃 */ }
    }
  }

  function postProcess(root) {
    // 代码高亮（跳过 mermaid 块）
    root.querySelectorAll("pre code").forEach((code) => {
      if (/language-mermaid/.test(code.className)) return;
      try { hljs.highlightElement(code); } catch (e) { /* 忽略 */ }
    });

    // 任务列表：marked 输出 disabled 的 input，浏览器会强制灰化，
    // 这里替换为自绘 span，便于在浅/深色下都保持清晰。
    root.querySelectorAll("li").forEach((li) => {
      const box = li.firstElementChild;
      if (box && box.tagName === "INPUT" && box.type === "checkbox") {
        const checked = box.checked;
        const tick = document.createElement("span");
        tick.className = "task-check";
        tick.setAttribute("data-checked", checked ? "true" : "false");
        box.replaceWith(tick);
        li.classList.add("task-item");
        if (checked) li.classList.add("task-done");
        if (li.parentElement && li.parentElement.tagName === "UL") {
          li.parentElement.classList.add("contains-task");
        }
      }
    });

    // 标题 id
    root.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((h) => {
      h.id = slugify(h.textContent);
    });

    // 外链新窗口
    root.querySelectorAll('a[href^="http"]').forEach((a) => {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    });

    // 图片加载失败 → 换占位图（已失败的、以及之后失败的都覆盖）
    root.querySelectorAll("img").forEach((img) => {
      if (img.dataset.imgFailed) return;
      img.addEventListener("error", () => markFailedImage(img));
      if (img.complete && img.naturalWidth === 0) markFailedImage(img);
    });
  }

  /* ---------- Mermaid（按需加载） ----------
   * lib/mermaid.min.js 有 3.3MB，而多数文档并没有图表：
   * 只有真的出现 ```mermaid 代码块时才去下载它。
   */
  let mermaidLoad = null;

  function loadMermaid() {
    if (window.mermaid) return Promise.resolve(window.mermaid);
    if (mermaidLoad) return mermaidLoad;
    mermaidLoad = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "lib/mermaid.min.js";
      s.onload = () => (window.mermaid ? resolve(window.mermaid) : reject(new Error("mermaid 未挂载")));
      s.onerror = () => {
        mermaidLoad = null;
        reject(new Error("mermaid 加载失败"));
      };
      document.head.appendChild(s);
    });
    return mermaidLoad;
  }

  /* mermaid 自己算的 viewBox 偶尔会偏（右侧节点被裁到框外），
   * 这里按真实内容包围盒重设一次，留 8px 余量。
   * 必须在 SVG 已经进入文档后调用，否则 getBBox 全是 0。 */
  function fitMermaidSvg(wrap) {
    const svg = wrap.querySelector("svg");
    if (!svg || typeof svg.getBBox !== "function") return;
    try {
      const root = svg.querySelector("g.root") || svg;
      const bb = root.getBBox();
      if (!bb || !bb.width || !bb.height) return;
      const pad = 8;
      const w = bb.width + pad * 2;
      const h = bb.height + pad * 2;
      const vb = [bb.x - pad, bb.y - pad, w, h].map((n) => Math.round(n * 100) / 100).join(" ");
      svg.setAttribute("viewBox", vb);
      // mermaid 内联的 max-width 是按它自己算的宽度写的，一并纠正
      svg.style.maxWidth = Math.round(w) + "px";
    } catch (e) { /* 量不到就沿用 mermaid 的 viewBox */ }
  }

  function renderMermaid(root) {
    const blocks = root.querySelectorAll("code.language-mermaid");
    if (!blocks.length) return;

    if (!window.mermaid) {
      // 加载完成后对“当前”预览重跑一次：这期间 DOM 可能已被新的输入替换
      loadMermaid()
        .then(() => renderMermaid(document.getElementById("preview") || root))
        .catch(() => { /* 加载失败就保留源码块，不影响其它内容 */ });
      return;
    }

    initMermaid();
    Array.from(blocks).forEach((block, i) => {
      const code = block.textContent || "";
      const id = "mermaid-" + Date.now() + "-" + i;
      mermaid
        .render(id, code)
        .then(({ svg }) => {
          const wrap = document.createElement("div");
          wrap.className = "mermaid";
          // 留存源码：Word 导出时按浅色主题重绘为 PNG
          wrap.dataset.mermaid = encodeURIComponent(code);
          wrap.innerHTML = svg;
          const pre = block.closest("pre");
          if (pre) pre.replaceWith(wrap);
          fitMermaidSvg(wrap);
        })
        .catch(() => { /* 语法错误时保留源码块 */ });
    });
  }

  function render(text) {
    const preview = document.getElementById("preview");
    if (!preview) return;
    sanitizeInto(preview, marked.parse(text || ""));
    postProcess(preview);
    renderMermaid(preview);
  }

  // 纯 HTML（供导出等需要未后处理结果的场景）
  return { render, slugify, initMermaid, loadMermaid, placeholderSvg, placeholderUri, sanitize };
})();
