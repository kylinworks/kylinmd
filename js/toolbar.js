/* ===== 编辑工具栏：向编辑器插入 / 包裹 Markdown 语法 ===== */
const Toolbar = (() => {
  function editor() {
    return document.getElementById("editor");
  }

  function getSel() {
    const el = editor();
    return {
      start: el.selectionStart,
      end: el.selectionEnd,
      text: el.value.slice(el.selectionStart, el.selectionEnd)
    };
  }

  function commit() {
    const el = editor();
    el.focus();
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /* 在光标处插入纯文本 */
  function insert(text) {
    const el = editor();
    const { start, end } = getSel();
    el.setRangeText(text, start, end, "end");
    commit();
  }

  /* 用 before/after 包裹选区；无选区时填入占位符并选中它 */
  function wrap(before, after, placeholder) {
    const el = editor();
    const { start, end, text } = getSel();
    const inner = text || placeholder;
    el.setRangeText(before + inner + after, start, end, "end");
    const selStart = start + before.length;
    el.setSelectionRange(selStart, selStart + inner.length);
    commit();
  }

  /* 对选区所在行的每一行加前缀 */
  function linePrefix(prefix) {
    const el = editor();
    const { start, end } = getSel();
    const lineStart = el.value.lastIndexOf("\n", start - 1) + 1;
    let lineEnd = el.value.indexOf("\n", end);
    if (lineEnd === -1) lineEnd = el.value.length;
    const seg = el.value.slice(lineStart, lineEnd);
    const out = seg.split("\n").map((l) => prefix + l).join("\n");
    el.setRangeText(out, lineStart, lineEnd, "end");
    commit();
  }

  function orderedList() {
    const el = editor();
    const { start, end } = getSel();
    const lineStart = el.value.lastIndexOf("\n", start - 1) + 1;
    let lineEnd = el.value.indexOf("\n", end);
    if (lineEnd === -1) lineEnd = el.value.length;
    const seg = el.value.slice(lineStart, lineEnd);
    const out = seg.split("\n").map((l, i) => (i + 1) + ". " + l).join("\n");
    el.setRangeText(out, lineStart, lineEnd, "end");
    commit();
  }

  const actions = {
    h1: () => linePrefix("# "),
    h2: () => linePrefix("## "),
    h3: () => linePrefix("### "),
    bold: () => wrap("**", "**", "加粗文字"),
    italic: () => wrap("*", "*", "斜体文字"),
    strike: () => wrap("~~", "~~", "删除文字"),
    mark: () => wrap("==", "==", "高亮文字"),
    code: () => wrap("`", "`", "行内代码"),
    link: () => wrap("[", "](https://example.com)", "链接文字"),
    image: () => wrap("![", "](https://example.com/image.png)", "图片描述"),
    quote: () => linePrefix("> "),
    ul: () => linePrefix("- "),
    ol: orderedList,
    task: () => linePrefix("- [ ] "),
    codeblock: () => wrap("```\n", "\n```", "代码"),
    table: () => insert("\n| 列一 | 列二 |\n| --- | --- |\n| 内容 | 内容 |\n\n"),
    hr: () => insert("\n\n---\n\n")
  };

  /* 工具栏键盘导航：整个工具栏只占一个 Tab 位，左右方向键切换按钮 */
  function initKeys(bar) {
    const buttons = () => Array.from(bar.querySelectorAll("[data-action]"));

    function setTabStop(active) {
      buttons().forEach((b) => { b.tabIndex = b === active ? 0 : -1; });
    }

    const list = buttons();
    if (list.length) setTabStop(list[0]);

    bar.addEventListener("focusin", (e) => {
      const btn = e.target.closest("[data-action]");
      if (btn) setTabStop(btn);
    });

    bar.addEventListener("keydown", (e) => {
      const list = buttons();
      const i = list.indexOf(document.activeElement);
      if (i === -1) return;
      let next = null;
      if (e.key === "ArrowRight") next = (i + 1) % list.length;
      else if (e.key === "ArrowLeft") next = (i - 1 + list.length) % list.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = list.length - 1;
      if (next === null) return;
      e.preventDefault();
      setTabStop(list[next]);
      list[next].focus();
    });
  }

  function init() {
    const bar = document.getElementById("toolbar");
    bar.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const fn = actions[btn.dataset.action];
      if (fn) fn();
    });
    initKeys(bar);
  }

  return { init };
})();
