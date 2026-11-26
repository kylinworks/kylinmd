/* ===== 导出：Markdown / PDF / Word(.docx) =====
 *
 * Word 走真正的 OOXML（docx 库），而不是 HTML 套壳的 .doc：
 *   - 从已渲染的预览 DOM 提取结构 → 段落 / 列表 / 表格 / 图片 / 代码
 *   - 任务列表 → ☑ / ☐ 字符（Word 不认 input）
 *   - 图片（含 Mermaid）→ 内嵌 PNG，不依赖外部路径
 *   - 代码块保留语法高亮配色（固定浅色方案，与界面明暗无关）
 *   - <details> 展开、<kbd>/<mark> 退化为带底色/高亮的文本
 */
const Exporter = (() => {
  const SITE = "KylinMD";

  /* ---------------- 通用 ---------------- */
  function filename() {
    const h1 = document.querySelector("#preview h1");
    let name = h1 ? h1.textContent.trim() : "markdown";
    name = name.replace(/[\\/:*?"<>|]+/g, "").trim();
    return (name || "markdown").slice(0, 60);
  }

  function download(name, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /* ---------------- Markdown ---------------- */
  function md() {
    const text = document.getElementById("editor").value;
    const blob = new Blob(["\ufeff" + text], { type: "text/markdown;charset=utf-8" });
    download(filename() + ".md", blob);
    return filename() + ".md";
  }

  /* ---------------- 依赖懒加载 ---------------- */
  const libCache = {};

  function loadLib(url, ready) {
    if (ready()) return Promise.resolve(true);
    if (libCache[url]) return libCache[url];
    libCache[url] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = url;
      s.onload = () => (ready() ? resolve(true) : reject(new Error(url + " 未挂载")));
      s.onerror = () => {
        delete libCache[url];
        reject(new Error("依赖加载失败：" + url));
      };
      document.head.appendChild(s);
    });
    return libCache[url];
  }

  function nextFrames(n) {
    return new Promise((resolve) => {
      let i = 0;
      const tick = () => (++i >= n ? resolve() : requestAnimationFrame(tick));
      requestAnimationFrame(tick);
    });
  }

  /* ================= PDF（走浏览器打印，文字可选中） =================
   * 不在页面里自己拼 PDF：中文字体没法只嵌入用到的字形，手写 PDF 要么变位图、
   * 要么得内嵌几 MB 的字体。交给浏览器排版引擎最省事——「打印 → 另存为 PDF」
   * 出来的就是矢量文字，可选中、可搜索、可复制。
   */
  function pdf() {
    const root = document.documentElement;
    const lightCss = document.getElementById("hljs-light");
    const darkCss = document.getElementById("hljs-dark");
    const prev = {
      theme: root.getAttribute("data-theme"),
      title: document.title,
      light: lightCss ? lightCss.disabled : false,
      dark: darkCss ? darkCss.disabled : false,
      view: document.body.getAttribute("data-view")
    };

    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      root.setAttribute("data-theme", prev.theme || "light");
      document.title = prev.title;
      if (lightCss) lightCss.disabled = prev.light;
      if (darkCss) darkCss.disabled = prev.dark;
      if (prev.view) document.body.setAttribute("data-view", prev.view);
      window.removeEventListener("afterprint", restore);
    };

    // 打印一律白纸黑字；窄屏时确保预览面板处于显示状态
    root.setAttribute("data-theme", "light");
    if (lightCss) lightCss.disabled = false;
    if (darkCss) darkCss.disabled = true;
    document.body.setAttribute("data-view", "preview");
    // 「另存为 PDF」默认拿 document.title 当文件名
    document.title = filename();

    window.addEventListener("afterprint", restore);
    setTimeout(() => {
      window.print();
      // Chrome/Edge 的 print() 会阻塞到对话框关闭；Safari 不阻塞，
      // 靠 afterprint + 这个较长的兜底来恢复（宁可晚一点也不能在预览生成中途还原）
      setTimeout(restore, 5000);
    }, 60);

    return filename() + ".pdf";
  }

  /* ================= 独立 HTML =================
   * 单文件、自包含：内容 + 内联样式 + 内联图片。
   * 双击就能在浏览器里看，也能直接「打印 → 另存为 PDF」得到可搜索的文字版。
   */
  const textCache = {};

  async function fetchText(url) {
    if (textCache[url]) return textCache[url];
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status + " " + url);
    textCache[url] = await res.text();
    return textCache[url];
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  // 文本节点（<title>）只需处理 & 和 <，引号原样保留更干净
  function escapeText(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error("图片读取失败"));
      fr.readAsDataURL(blob);
    });
  }

  // 把图片转成 data URI，导出的文件才不依赖外部路径；跨域/404 时保留原地址
  async function inlineImages(root) {
    const imgs = Array.from(root.querySelectorAll("img"));
    let inlined = 0;
    let kept = 0;
    for (const img of imgs) {
      const src = img.getAttribute("src") || "";
      if (!src || /^data:/i.test(src)) continue;
      try {
        const res = await fetch(src, { mode: "cors" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        img.setAttribute("src", await blobToDataUrl(await res.blob()));
        inlined++;
      } catch (e) {
        kept++;
      }
    }
    return { inlined, kept };
  }

  async function html() {
    const preview = document.getElementById("preview");
    const content = preview.cloneNode(true);
    await inlineImages(content);

    let siteCss = "";
    let themeCss = "";
    try { siteCss = await fetchText("css/style.css"); } catch (e) { /* 拿不到就只输出内容 */ }
    try { themeCss = await fetchText("lib/github.min.css"); } catch (e) { /* 同上 */ }

    const overrides = [
      "html,body{display:block;height:auto;min-height:0;overflow:visible;background:#fff;color:#1b1f24;}",
      "body{padding:0;}",
      ".doc{max-width:820px;margin:0 auto;padding:48px 28px 80px;}",
      "@media print{",
      "  .doc{max-width:none;padding:0;}",
      "  pre,table,blockquote,.task-item{break-inside:avoid;}",
      "  h1,h2,h3,h4{break-after:avoid;}",
      "  a[href^='http']::after{content:' (' attr(href) ')';font-size:.82em;color:#6b7280;}",
      "}"
    ].join("\n");

    const title = filename();
    const doc = [
      "<!DOCTYPE html>",
      '<html lang="' + langInfo(Settings.resolvedLang()).htmlLang + '">',
      "<head>",
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      "<title>" + escapeText(title) + "</title>",
      '<meta name="generator" content="' + escapeHtml(SITE) + '">',
      "<style>",
      siteCss,
      themeCss,
      overrides,
      "</style>",
      "</head>",
      "<body>",
      '<div class="markdown-body doc">',
      content.innerHTML,
      "</div>",
      "</body>",
      "</html>"
    ].join("\n");

    const name = title + ".html";
    download(name, new Blob([doc], { type: "text/html;charset=utf-8" }));
    return name;
  }

  /* ================= Word (.docx) ================= */
  const lib = () => window.docx;

  const FONT_BODY = "Microsoft YaHei";
  const FONT_MONO = "Consolas";
  // 等宽字体只管西文，中文回落到正文字体（否则代码里的中文注释会缺字形）
  const MONO_FONT = {
    ascii: FONT_MONO,
    hAnsi: FONT_MONO,
    cs: FONT_MONO,
    eastAsia: FONT_BODY
  };

  // docx 尺寸单位为半磅（half-point）
  const SIZE = { body: 22, code: 19, h1: 44, h2: 34, h3: 28, h4: 24, h5: 22, h6: 21 };

  // 固定浅色配色：导出文档不随界面明暗变化
  const C = {
    text: "1F2328",
    muted: "57606A",
    border: "D0D7DE",
    accent: "2563EB",
    codeBg: "F2F4F7",
    inlineCodeBg: "EEF1F4",
    tableHead: "F2F4F7",
    quoteText: "4A535D",
    hr: "D8DEE4"
  };

  // highlight.js 类名 → 颜色（GitHub 浅色方案）
  const HLJS_MAP = [
    [/hljs-(comment|quote)/, "6E7781", true],
    [/hljs-(keyword|literal|type|built_in|selector-tag)/, "CF222E"],
    [/hljs-(string|regexp|char|attr-value|template-string)/, "0A3069"],
    [/hljs-(number|symbol|bullet|meta)/, "0550AE"],
    [/hljs-(title|function|class|section-name|name)/, "8250DF"],
    [/hljs-(attr|attribute|variable|property|params)/, "116329"],
    [/hljs-(link|operator|tag)/, "0550AE"]
  ];

  function hljsStyle(className) {
    const cls = String(className || "");
    for (const [re, color, italic] of HLJS_MAP) {
      if (re.test(cls)) return { color, italic: !!italic };
    }
    return null;
  }

  const BLOCK_TAGS = new Set([
    "p", "div", "ul", "ol", "table", "pre", "blockquote", "hr",
    "h1", "h2", "h3", "h4", "h5", "h6", "details", "section", "article", "figure"
  ]);

  function hasBlockChild(el) {
    for (const c of el.children) {
      if (BLOCK_TAGS.has(c.tagName.toLowerCase())) return true;
    }
    return false;
  }

  /* ---------- 内联：HTML 片段 → TextRun[] ---------- */
  function mkRun(text, st) {
    const D = lib();
    const opts = {
      text: text,
      bold: !!st.bold,
      italics: !!st.italics,
      strike: !!st.strike,
      font: st.code ? MONO_FONT : FONT_BODY,
      size: st.size || SIZE.body,
      color: st.color || C.text
    };
    if (st.underline) opts.underline = {};
    if (st.sub) opts.subScript = true;
    if (st.sup) opts.superScript = true;
    if (st.highlight) {
      opts.highlight = "yellow";
    } else if (st.shading) {
      opts.shading = { type: D.ShadingType.CLEAR, fill: st.shading };
    }
    return new D.TextRun(opts);
  }

  function inlineRuns(node, st, images) {
    const D = lib();
    const runs = [];

    for (const n of node.childNodes) {
      if (n.nodeType === 3) {
        const text = n.nodeValue.replace(/\s*\n\s*/g, " ");
        if (text.trim() || /\S/.test(text)) {
          if (text) runs.push(mkRun(text, st));
        }
        continue;
      }
      if (n.nodeType !== 1) continue;

      const tag = n.tagName.toLowerCase();

      if (tag === "br") {
        runs.push(new D.TextRun({ text: "", break: 1 }));
        continue;
      }
      if (tag === "img") {
        const payload = images.get(n);
        if (payload) {
          runs.push(new D.TextRun({ text: " " }));
          runs.push(imgRun(payload));
          runs.push(new D.TextRun({ text: " " }));
        } else {
          runs.push(mkRun(n.getAttribute("alt") || "[图片]", st));
        }
        continue;
      }
      // 任务列表复选框（渲染后处理替换成的自绘 span）
      if (tag === "span" && n.classList.contains("task-check")) {
        const done = n.getAttribute("data-checked") === "true";
        runs.push(mkRun(done ? "☑ " : "☐ ", Object.assign({}, st, { color: C.accent })));
        continue;
      }
      if (tag === "input" && n.type === "checkbox") {
        runs.push(mkRun(n.checked ? "☑ " : "☐ ", Object.assign({}, st, { color: C.accent })));
        continue;
      }

      // 链接：外链做成真正的超链接（Word 里可点），锚点退化为带样式的文本
      if (tag === "a") {
        const href = n.getAttribute("href") || "";
        const linkState = Object.assign({}, st, { color: C.accent, underline: true });
        const inner = inlineRuns(n, linkState, images);
        if (!inner.length) inner.push(mkRun(href || "链接", linkState));
        if (/^(https?:|mailto:)/i.test(href)) {
          runs.push(new D.ExternalHyperlink({ link: href, children: inner }));
        } else {
          runs.push(...inner);
        }
        continue;
      }

      const next = Object.assign({}, st);
      if (tag === "strong" || tag === "b") next.bold = true;
      if (tag === "em" || tag === "i" || tag === "cite") next.italics = true;
      if (tag === "del" || tag === "s" || tag === "strike") next.strike = true;
      if (tag === "code" || tag === "kbd" || tag === "samp" || tag === "tt") {
        next.code = true;
        next.shading = C.inlineCodeBg;
      }
      if (tag === "mark") next.highlight = true;
      if (tag === "sub") next.sub = true;
      if (tag === "sup") next.sup = true;

      const hl = hljsStyle(n.className);
      if (hl) {
        next.color = hl.color;
        if (hl.italic) next.italics = true;
      }

      runs.push(...inlineRuns(n, next, images));
    }

    return runs;
  }

  /* ---------- 块级：容器 → docx 元素[] ---------- */
  function baseState(ctx) {
    return {
      color: ctx && ctx.quote ? C.quoteText : C.text,
      size: SIZE.body
    };
  }

  function mkPara(runs, ctx, extra) {
    const D = lib();
    const props = Object.assign(
      { children: runs, spacing: { before: 60, after: 60, line: 320 } },
      extra || {}
    );
    if (ctx && ctx.quote) {
      props.indent = Object.assign({ left: 340 * ctx.quote }, props.indent || {});
      props.border = {
        left: { style: D.BorderStyle.SINGLE, size: 12, color: C.border, space: 10 }
      };
    }
    return new D.Paragraph(props);
  }

  function headingPara(el, level, ctx, images) {
    const D = lib();
    const runs = inlineRuns(el, { color: C.text, size: SIZE["h" + level], bold: true }, images);
    if (!runs.length) runs.push(mkRun("", { size: SIZE["h" + level] }));
    return new D.Paragraph({
      children: runs,
      keepNext: true,
      spacing: { before: level <= 2 ? 280 : 220, after: 120, line: 300 }
    });
  }

  function listBlocks(listEl, ctx, images) {
    const D = lib();
    const ordered = listEl.tagName.toLowerCase() === "ol";
    const level = Math.min(ctx.level || 0, 4);
    const out = [];

    for (const li of listEl.children) {
      if (li.tagName.toLowerCase() !== "li") continue;

      const isTask =
        li.classList.contains("task-item") ||
        !!li.querySelector(":scope > span.task-check, :scope > input[type='checkbox']");

      const runs = liRuns(li, Object.assign({}, baseState(ctx), { bold: false }), images);
      if (!runs.length) runs.push(mkRun(" ", baseState(ctx)));

      const props = { children: runs, spacing: { before: 40, after: 40, line: 320 } };
      if (isTask) {
        props.indent = { left: 360 * (level + 1), hanging: 0 };
      } else {
        props.numbering = { reference: ordered ? "md-ol" : "md-ul", level: level };
      }
      out.push(new D.Paragraph(props));

      // 嵌套列表
      for (const sub of li.children) {
        const t = sub.tagName.toLowerCase();
        if (t === "ul" || t === "ol") {
          out.push(...listBlocks(sub, Object.assign({}, ctx, { level: level + 1 }), images));
        }
      }
    }

    return out;
  }

  // li 的内联内容（跳过嵌套列表，避免重复）
  function liRuns(li, st, images) {
    const runs = [];
    let afterCheck = false;
    for (const n of li.childNodes) {
      if (n.nodeType === 3) {
        let text = n.nodeValue.replace(/\s*\n\s*/g, " ");
        if (afterCheck) {
          text = text.replace(/^ +/, "");
          afterCheck = false;
        }
        if (text.trim()) runs.push(mkRun(text, st));
        continue;
      }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName.toLowerCase();
      if (tag === "ul" || tag === "ol") continue;
      if (tag === "span" && n.classList.contains("task-check")) {
        const done = n.getAttribute("data-checked") === "true";
        runs.push(mkRun(done ? "☑ " : "☐ ", Object.assign({}, st, { color: C.accent })));
        afterCheck = true;
        continue;
      }
      if (tag === "input" && n.type === "checkbox") {
        runs.push(mkRun(n.checked ? "☑ " : "☐ ", Object.assign({}, st, { color: C.accent })));
        afterCheck = true;
        continue;
      }
      runs.push(...inlineRuns(n, st, images));
    }
    return runs;
  }

  /* ---------- 代码块（保留高亮配色） ---------- */
  function codeLines(codeEl) {
    const lines = [[]];
    (function visit(node, color, italic) {
      for (const n of node.childNodes) {
        if (n.nodeType === 3) {
          const parts = n.nodeValue.split("\n");
          parts.forEach((p, i) => {
            if (i > 0) lines.push([]);
            if (p) lines[lines.length - 1].push({ text: p, color: color, italic: italic });
          });
        } else if (n.nodeType === 1) {
          const st = hljsStyle(n.className);
          visit(n, st ? st.color : color, italic || !!(st && st.italic));
        }
      }
    })(codeEl, null, false);
    return lines;
  }

  function codeBlock(pre) {
    const D = lib();
    const code = pre.querySelector("code") || pre;
    const lines = codeLines(code);

    // 去掉首尾空行（marked 常在块首尾留换行）
    while (lines.length && !lines[0].length) lines.shift();
    while (lines.length && !lines[lines.length - 1].length) lines.pop();
    if (!lines.length) lines.push([{ text: " ", color: null }]);

    return lines.map((segs, i) => {
      const runs = segs.map(
        (s) =>
          new D.TextRun({
            text: s.text,
            font: MONO_FONT,
            size: SIZE.code,
            color: s.color || C.text,
            italics: !!s.italic
          })
      );
      if (!runs.length) {
        runs.push(new D.TextRun({ text: " ", font: MONO_FONT, size: SIZE.code, color: C.text }));
      }
      const first = i === 0;
      const last = i === lines.length - 1;
      return new D.Paragraph({
        children: runs,
        shading: { type: D.ShadingType.CLEAR, fill: C.codeBg },
        spacing: {
          before: first ? 120 : 0,
          after: last ? 160 : 0,
          line: 264,
          lineRule: "auto"
        },
        indent: { left: 140, right: 140 }
      });
    });
  }

  /* ---------- 表格 ---------- */
  function tableBlock(el, ctx, images) {
    const D = lib();
    const rows = [];

    el.querySelectorAll("tr").forEach((tr) => {
      const parent = tr.parentElement;
      const isHead = parent && parent.tagName.toLowerCase() === "thead";
      const cells = [];

      for (const cell of tr.children) {
        const tag = cell.tagName.toLowerCase();
        if (tag !== "td" && tag !== "th") continue;

        let paras = blocksOf(cell, { level: 0, quote: 0 }, images);
        if (!paras.length) {
          const runs = inlineRuns(cell, { size: SIZE.body, color: C.text, bold: isHead }, images);
          paras = [new D.Paragraph({ children: runs, spacing: { before: 20, after: 20 } })];
        }
        cells.push(
          new D.TableCell({
            children: paras,
            shading: { type: D.ShadingType.CLEAR, fill: isHead ? C.tableHead : "FFFFFF" },
            margins: { top: 60, bottom: 60, left: 110, right: 110 },
            verticalAlign: D.VerticalAlign.CENTER
          })
        );
      }

      if (cells.length) rows.push(new D.TableRow({ children: cells, tableHeader: isHead }));
    });

    const border = { style: D.BorderStyle.SINGLE, size: 4, color: C.border };
    return new D.Table({
      rows: rows,
      width: { size: 100, type: D.WidthType.PERCENTAGE },
      borders: {
        top: border, bottom: border, left: border, right: border,
        insideHorizontal: border, insideVertical: border
      }
    });
  }

  /* ---------- 其他块 ---------- */
  function hrPara() {
    const D = lib();
    return new D.Paragraph({
      children: [],
      spacing: { before: 160, after: 160 },
      border: { bottom: { style: D.BorderStyle.SINGLE, size: 6, color: C.hr, space: 1 } }
    });
  }

  function detailsBlocks(el, ctx, images) {
    const D = lib();
    const out = [];
    const summary = el.querySelector(":scope > summary");
    if (summary) {
      out.push(
        new D.Paragraph({
          children: inlineRuns(summary, { size: SIZE.body, color: C.text, bold: true }, images),
          spacing: { before: 140, after: 60 }
        })
      );
    }
    const rest = el.cloneNode(true);
    const rs = rest.querySelector("summary");
    if (rs) rs.remove();
    out.push(...blocksOf(rest, ctx, images));
    return out;
  }

  function blocksOf(container, ctx, images) {
    if (!hasBlockChild(container)) {
      const runs = inlineRuns(container, baseState(ctx), images);
      if (!runs.length && !(container.textContent || "").trim()) return [];
      return [mkPara(runs, ctx)];
    }

    const out = [];
    for (const el of container.children) {
      const tag = el.tagName.toLowerCase();

      if (/^h[1-6]$/.test(tag)) {
        out.push(headingPara(el, Number(tag[1]), ctx, images));
      } else if (tag === "p") {
        out.push(mkPara(inlineRuns(el, baseState(ctx), images), ctx));
      } else if (tag === "ul" || tag === "ol") {
        out.push(...listBlocks(el, ctx, images));
      } else if (tag === "blockquote") {
        out.push(...blocksOf(el, Object.assign({}, ctx, { quote: (ctx.quote || 0) + 1 }), images));
      } else if (tag === "pre") {
        out.push(...codeBlock(el));
      } else if (tag === "table") {
        out.push(tableBlock(el, ctx, images));
      } else if (tag === "hr") {
        out.push(hrPara());
      } else if (tag === "details") {
        out.push(...detailsBlocks(el, ctx, images));
      } else if (tag === "img") {
        out.push(imagePara(el, images));
      } else if (el.classList && el.classList.contains("mermaid")) {
        out.push(mermaidPara(el, images));
      } else if (tag === "svg") {
        // 兜底：裸 SVG 跳过
        continue;
      } else {
        out.push(...blocksOf(el, ctx, images));
      }
    }
    return out;
  }

  /* ---------- 图片 ---------- */
  function fitImage(w, h) {
    const maxW = 620;
    if (!w || !h) return { width: 480, height: 320 };
    if (w <= maxW) return { width: Math.round(w), height: Math.round(h) };
    const k = maxW / w;
    return { width: maxW, height: Math.round(h * k) };
  }

  function imgRun(payload) {
    const D = lib();
    return new D.ImageRun({
      data: payload.data,
      transformation: fitImage(payload.width, payload.height),
      type: payload.type || "png",
      altText: { title: "image", description: "image", name: "image" }
    });
  }

  function imagePara(el, images) {
    const D = lib();
    const payload = images.get(el);
    if (!payload) return new D.Paragraph({ children: [] });
    return new D.Paragraph({
      children: [imgRun(payload)],
      spacing: { before: 140, after: 140 }
    });
  }

  function mermaidPara(host, images) {
    const D = lib();
    const payload = images.get(host);
    if (!payload) {
      // 出图失败：退化为源码块，至少不丢内容
      const src = host.dataset.mermaid ? decodeURIComponent(host.dataset.mermaid) : "";
      if (!src) return new D.Paragraph({ children: [] });
      return new D.Paragraph({
        children: [
          new D.TextRun({ text: "[Mermaid 图表]", font: FONT_BODY, size: SIZE.body, color: C.muted })
        ]
      });
    }
    return new D.Paragraph({
      children: [imgRun(payload)],
      alignment: D.AlignmentType.CENTER,
      spacing: { before: 140, after: 140 }
    });
  }

  function rasterize(svgText, w, h) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(3, Math.max(2, 1500 / Math.max(1, w)));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(w * scale));
          canvas.height = Math.max(1, Math.round(h * scale));
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (!blob) return reject(new Error("canvas toBlob 失败"));
            blob.arrayBuffer().then((buf) => {
              resolve({
                data: new Uint8Array(buf),
                type: "png",
                width: Math.round(w),
                height: Math.round(h)
              });
            });
          }, "image/png");
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error("SVG 加载失败"));
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgText);
    });
  }

  function svgPayload(text, w, h) {
    const parsed = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
    let vw = parseFloat(parsed.getAttribute("width")) || 0;
    let vh = parseFloat(parsed.getAttribute("height")) || 0;
    if (!vw || !vh) {
      const vb = (parsed.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
      if (vb.length === 4) {
        vw = vw || vb[2];
        vh = vh || vb[3];
      }
    }
    const width = w || vw || 600;
    const height = h || vh || Math.round(width * 0.6);
    parsed.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    parsed.setAttribute("width", String(Math.round(width)));
    parsed.setAttribute("height", String(Math.round(height)));
    const svgText = new XMLSerializer().serializeToString(parsed);
    return rasterize(svgText, width, height);
  }

  async function imagePayload(img) {
    const src = img.currentSrc || img.getAttribute("src") || "";
    if (!src) throw new Error("缺少 src");
    const res = await fetch(src);
    if (!res.ok) throw new Error("图片读取失败");
    const blob = await res.blob();
    const isSvg = /svg/i.test(blob.type) || /\.svg(\?|#|$)/i.test(src);
    if (isSvg) {
      return svgPayload(await blob.text(), img.naturalWidth || 0, img.naturalHeight || 0);
    }
    const buf = await blob.arrayBuffer();
    const type = /jpe?g/i.test(blob.type) ? "jpg" : /gif/i.test(blob.type) ? "gif" : "png";
    return {
      data: new Uint8Array(buf),
      type: type,
      width: img.naturalWidth || 480,
      height: img.naturalHeight || 320
    };
  }

  // Mermaid：始终按浅色主题重绘成 PNG（文档是白底，深色图上白底会看不清）
  async function mermaidPayload(host) {
    const src = host.dataset.mermaid ? decodeURIComponent(host.dataset.mermaid) : "";
    if (src && window.mermaid) {
      try {
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "loose",
          themeVariables: { fontFamily: '"PingFang SC","Microsoft YaHei","Segoe UI",sans-serif' },
          flowchart: { htmlLabels: false }
        });
        const id = "mdexport-" + Math.random().toString(36).slice(2, 9);
        const result = await mermaid.render(id, src);
        const svgText = result.svg;
        const root = new DOMParser().parseFromString(svgText, "image/svg+xml").documentElement;
        const vb = (root.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
        const w = vb.length === 4 && vb[2] ? vb[2] : 600;
        const h = vb.length === 4 && vb[3] ? vb[3] : 360;
        const payload = await svgPayload(svgText, w, h);
        return payload;
      } catch (e) {
        console.warn("Mermaid 重绘失败，回退 DOM", e);
      } finally {
        if (typeof Renderer !== "undefined" && Renderer.initMermaid) Renderer.initMermaid();
      }
    }
    // 回退：直接栅格化 DOM 中的 SVG
    const svgEl = host.querySelector("svg");
    if (!svgEl) throw new Error("无 SVG");
    const rect = svgEl.getBoundingClientRect();
    const w = Math.round(rect.width) || 600;
    const h = Math.round(rect.height) || 360;
    const clone = svgEl.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
    return rasterize(new XMLSerializer().serializeToString(clone), w, h);
  }

  // 取不到图片字节（跨域/404/离线）时，用占位图顶上，保证版面不塌
  async function placeholderPayload(img) {
    const alt = img.getAttribute("alt") || "";
    const src = (img.dataset && img.dataset.originalSrc) || img.getAttribute("src") || "";
    if (typeof Renderer === "undefined" || !Renderer.placeholderSvg) {
      throw new Error("缺少占位图生成器");
    }
    return svgPayload(Renderer.placeholderSvg(alt, src), 640, 240);
  }

  async function collectImages(root) {
    const map = new Map();
    const jobs = [];

    root.querySelectorAll("img").forEach((img) => {
      jobs.push(
        imagePayload(img)
          .then((p) => map.set(img, p))
          .catch(async (e) => {
            console.warn("图片导出失败，改用占位图：", img.getAttribute("src"), e);
            try {
              map.set(img, await placeholderPayload(img));
            } catch (e2) {
              console.warn("占位图生成失败：", e2);
            }
          })
      );
    });

    root.querySelectorAll(".mermaid").forEach((host) => {
      jobs.push(
        mermaidPayload(host)
          .then((p) => map.set(host, p))
          .catch((e) => console.warn("Mermaid 导出失败：", e))
      );
    });

    await Promise.all(jobs);
    return map;
  }

  /* ---------- 编号（列表） ---------- */
  function ulNumbering(D) {
    const marks = ["•", "◦", "▪", "–", "·"];
    return {
      reference: "md-ul",
      levels: marks.map((m, l) => ({
        level: l,
        format: D.LevelFormat.BULLET,
        text: m,
        alignment: D.AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 360 * (l + 1), hanging: 240 } } }
      }))
    };
  }

  function olNumbering(D) {
    const levels = [0, 1, 2, 3, 4].map((l) => ({
      level: l,
      format: D.LevelFormat.DECIMAL,
      text: "%" + (l + 1) + ".",
      alignment: D.AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 360 * (l + 1), hanging: 300 } } }
    }));
    return { reference: "md-ol", levels: levels };
  }

  /* ---------- 组装 ---------- */
  async function word() {
    try {
      await loadLib("lib/docx.umd.js", () => !!window.docx);
    } catch (e) {
      console.warn("docx 库加载失败，退回 .doc 模式", e);
      return wordLegacy();
    }

    const D = lib();
    if (!D) return wordLegacy();

    const preview = document.getElementById("preview");
    const images = await collectImages(preview);
    const children = blocksOf(preview, { level: 0, quote: 0 }, images);
    if (!children.length) children.push(new D.Paragraph({ children: [] }));

    const doc = new D.Document({
      creator: SITE,
      title: filename(),
      description: t("export.exportedBy"),
      numbering: { config: [ulNumbering(D), olNumbering(D)] },
      styles: {
        default: {
          document: {
            run: { font: FONT_BODY, size: SIZE.body, color: C.text },
            paragraph: { spacing: { line: 320 } }
          }
        }
      },
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 }, // A4
              margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 }
            }
          },
          children: children
        }
      ]
    });

    const blob = await D.Packer.toBlob(doc);
    const name = filename() + ".docx";
    download(name, blob);
    return name;
  }

  /* ---------- 兜底：老式 HTML .doc（库缺失时） ---------- */
  function wordLegacy() {
    const source = document.getElementById("editor").value;
    const body = marked.parse(source || "");
    const css = [
      "body{font-family:'Microsoft YaHei',SimSun,sans-serif;font-size:11pt;line-height:1.7;color:#1f2328;margin:24pt;}",
      "h1{font-size:22pt;margin:18pt 0 10pt;}",
      "h2{font-size:17pt;margin:16pt 0 8pt;}",
      "h3{font-size:14pt;margin:14pt 0 6pt;}",
      "p{margin:6pt 0;}a{color:#2563eb;}",
      "blockquote{border-left:3px solid #bbb;margin:8pt 0;padding:4pt 10pt;color:#57606a;}",
      "pre{background:#f6f8fa;border:1px solid #ddd;padding:8pt;font-family:Consolas,monospace;font-size:9.5pt;}",
      "code{font-family:Consolas,monospace;background:#f0f0f0;padding:1pt 3pt;}",
      "table{border-collapse:collapse;}th,td{border:1px solid #999;padding:4pt 10pt;}th{background:#f0f0f0;}",
      "img{max-width:100%;}"
    ].join("\n");
    const html =
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">' +
      '<head><meta charset="utf-8"><style>' + css + "</style></head><body>" + body + "</body></html>";
    const blob = new Blob(["\ufeff" + html], { type: "application/msword;charset=utf-8" });
    download(filename() + ".doc", blob);
    return filename() + ".doc";
  }

  return { md, pdf, word, html, filename };
})();
