/* ===== 默认内容加载 =====
 * 教程正文以独立 .md 文件存放于 content/ 目录，文件名与语言代码对应：
 *   content/en.md      —— 英文（默认）
 *   content/zh.md      —— 简体中文
 *   content/zh-Hant.md —— 繁体中文
 * 加载时优先取当前语言，缺失则回退默认语言（英文）。
 * 使用 fetch 加载；通过 file:// 直接打开时会失败，此时显示简短提示。
 */
const Content = (() => {
  const FALLBACK = [
    "# KylinMD",
    "",
    "The default tutorial could not be loaded — the page is probably opened over `file://`.",
    "",
    "Try one of these instead:",
    "",
    "- Run `python -m http.server` in this folder, then open http://localhost:8000",
    "- Deploy it to GitHub Pages",
    "",
    "You can still type on the left; the preview updates as you go."
  ].join("\n");

  async function fetchText(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.text();
  }

  async function load(lang) {
    const code = langInfo(lang).file;
    try {
      return await fetchText(`content/${code}.md`);
    } catch (e) {
      /* 当前语言内容不存在或网络失败 */
    }
    if (code !== langInfo(DEFAULT_LANG).file) {
      try {
        return await fetchText(`content/${langInfo(DEFAULT_LANG).file}.md`);
      } catch (e) {
        /* 继续回退 */
      }
    }
    return FALLBACK;
  }

  return { load, DEFAULT_LANG };
})();
