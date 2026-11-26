/* ===== 界面文案字典（多语言） =====
 * 新增语言：
 *   1. 在 LANGS 里加一项（code / label / htmlLang / file）
 *   2. 在 I18N 里复制一个语言块翻译
 *   3. 放一份 content/<file>.md 作为该语言的默认教程
 * 界面元素用 data-i18n="键" 标注，工具栏提示用 data-i18n-title="键" 标注，
 * 无可见文字的控件用 data-i18n-aria="键"（会同时写入 aria-label）。
 */
/* hreflang 与 page 必须和 tools/build-pages.mjs 里的 PAGES 对得上：
 * 每种语言一个静态页面，切语言就是跳到那一页，源码天然是目标语言。 */
const LANGS = [
  { code: "en", label: "English", htmlLang: "en", hreflang: "en", page: "index.html", file: "en" },
  { code: "zh", label: "简体中文", htmlLang: "zh-CN", hreflang: "zh-Hans", page: "zh.html", file: "zh" },
  { code: "zh-Hant", label: "繁體中文", htmlLang: "zh-Hant", hreflang: "zh-Hant", page: "zh-hant.html", file: "zh-Hant" }
];

const DEFAULT_LANG = "en";

/* 常见写法与简写都收进来：?lg=zh-TW / ?lg=tw / ?lg=zh_Hant 都认 */
const LANG_ALIASES = {
  en: "en", "en-us": "en", "en-gb": "en", "en-ca": "en", "en-au": "en", english: "en",
  zh: "zh", "zh-cn": "zh", "zh-hans": "zh", "zh-sg": "zh", "zh-my": "zh", cn: "zh", chs: "zh", hans: "zh",
  "zh-hant": "zh-Hant", "zh-tw": "zh-Hant", "zh-hk": "zh-Hant", "zh-mo": "zh-Hant",
  tw: "zh-Hant", hk: "zh-Hant", cht: "zh-Hant", hant: "zh-Hant", "zh-traditional": "zh-Hant"
};

/* 把任意输入解析成受支持的语言代码；不认识就回落到默认语言（英文） */
function resolveLang(raw) {
  const key = String(raw == null ? "" : raw).trim().toLowerCase().replace(/_/g, "-");
  return LANG_ALIASES[key] || DEFAULT_LANG;
}

/* 语言元信息：显示名 / <html lang> / hreflang / 页面文件 / 内容文件名 */
function langInfo(code) {
  const resolved = resolveLang(code);
  return LANGS.find((l) => l.code === resolved) || LANGS[0];
}

/* 当前页面自己的语言：由构建时写死的 <html lang> 决定 */
function pageLang() {
  return resolveLang(document.documentElement.lang);
}

const I18N = {
  en: {
    "doc.title": "KylinMD · Markdown Editor Online",
    "app.title": "KylinMD Editor",
    "app.subtitle": "Online editor · Live preview",

    "a11y.skip": "Skip to editor",
    "pane.editor": "Markdown",
    "pane.preview": "Preview",
    "view.label": "Switch view",
    "view.editor": "Edit",
    "view.preview": "Preview",
    "editor.label": "Markdown editor",
    "preview.label": "Rendered preview",

    "stats.chars": "chars",
    "stats.words": "words",

    "file.title": "File",
    "file.open": "Open local file",
    "file.clear": "Clear content",
    "file.reset": "Restore default content",
    "file.opened": "Opened: {name}",
    "file.openFail": "Failed to read file",
    "file.clearConfirm": "Clear the current content? This cannot be undone.",

    "export.title": "Export",
    "export.md": "Markdown (.md)",
    "export.pdf": "PDF (.pdf)",
    "export.word": "Word (.docx)",
    "export.html": "HTML (.html)",
    "export.exportedBy": "Exported from KylinMD",

    "settings.title": "Settings",
    "settings.close": "Close settings",
    "settings.syncScroll": "Sync scroll",
    "settings.syncScrollDesc": "Link editor and preview scroll positions",
    "settings.theme": "Theme",
    "settings.themeLight": "Light",
    "settings.themeDark": "Dark",
    "settings.themeAuto": "Auto",
    "settings.fontSize": "Font size",
    "settings.language": "Language",
    "settings.languageDesc": "UI language and tutorial language",
    "settings.langEn": "English",
    "settings.langZh": "简体中文",
    "settings.langHant": "繁體中文",

    "tb.toolbar": "Formatting toolbar",
    "tb.h1": "Heading 1",
    "tb.h2": "Heading 2",
    "tb.h3": "Heading 3",
    "tb.bold": "Bold",
    "tb.italic": "Italic",
    "tb.strike": "Strikethrough",
    "tb.code": "Inline code",
    "tb.link": "Insert link",
    "tb.linkLabel": "Link",
    "tb.image": "Insert image",
    "tb.imageLabel": "Image",
    "tb.quote": "Blockquote",
    "tb.quoteLabel": "Quote",
    "tb.ul": "Bulleted list",
    "tb.ulLabel": "Bullets",
    "tb.ol": "Numbered list",
    "tb.olLabel": "Numbers",
    "tb.task": "Task list",
    "tb.taskLabel": "Task",
    "tb.table": "Insert table",
    "tb.tableLabel": "Table",
    "tb.codeblock": "Code block",
    "tb.codeblockLabel": "Code",
    "tb.hr": "Horizontal rule",
    "tb.hrLabel": "Divider",

    "editor.placeholder": "Type Markdown here…",

    "img.failed": "Image failed to load",
    "img.alt": "Image",

    "toast.exporting": "Exporting…",
    "toast.exportOk": "Exported: {name}",
    "toast.printHint": "Print dialog opened — choose \"Save as PDF\"",
    "toast.exportFail": "Export failed, please try again (see console)",
    "toast.reset": "Default content restored",
    "toast.cleared": "Content cleared",
    "toast.lang": "UI language changed",
    "toast.langKept": "UI language changed; your content was kept",
    "toast.copied": "Copied to clipboard"
  },

  zh: {
    "doc.title": "KylinMD · Markdown 在线编辑器",
    "app.title": "KylinMD Editor",
    "app.subtitle": "在线编辑器 · 实时预览",

    "a11y.skip": "跳到编辑器",
    "pane.editor": "Markdown",
    "pane.preview": "预览",
    "view.label": "视图切换",
    "view.editor": "编辑",
    "view.preview": "预览",
    "editor.label": "Markdown 编辑器",
    "preview.label": "预览结果",

    "stats.chars": "字符",
    "stats.words": "词",

    "file.title": "文件",
    "file.open": "打开本地文件",
    "file.clear": "清空内容",
    "file.reset": "恢复默认内容",
    "file.opened": "已打开：{name}",
    "file.openFail": "文件读取失败",
    "file.clearConfirm": "确定清空当前内容吗？此操作不可撤销。",

    "export.title": "导出",
    "export.md": "Markdown (.md)",
    "export.pdf": "PDF (.pdf)",
    "export.word": "Word (.docx)",
    "export.html": "HTML (.html)",
    "export.exportedBy": "由 KylinMD 导出",

    "settings.title": "设置",
    "settings.close": "关闭设置",
    "settings.syncScroll": "同步滚动",
    "settings.syncScrollDesc": "编辑区与预览区滚动位置联动",
    "settings.theme": "主题",
    "settings.themeLight": "浅色",
    "settings.themeDark": "深色",
    "settings.themeAuto": "自动",
    "settings.fontSize": "字号",
    "settings.language": "语言",
    "settings.languageDesc": "界面与教程使用的语言",
    "settings.langEn": "English",
    "settings.langZh": "简体中文",
    "settings.langHant": "繁體中文",

    "tb.toolbar": "编辑工具栏",
    "tb.h1": "一级标题",
    "tb.h2": "二级标题",
    "tb.h3": "三级标题",
    "tb.bold": "加粗",
    "tb.italic": "斜体",
    "tb.strike": "删除线",
    "tb.code": "行内代码",
    "tb.link": "插入链接",
    "tb.linkLabel": "链接",
    "tb.image": "插入图片",
    "tb.imageLabel": "图片",
    "tb.quote": "引用",
    "tb.quoteLabel": "引用",
    "tb.ul": "无序列表",
    "tb.ulLabel": "无序",
    "tb.ol": "有序列表",
    "tb.olLabel": "有序",
    "tb.task": "任务列表",
    "tb.taskLabel": "任务",
    "tb.table": "插入表格",
    "tb.tableLabel": "表格",
    "tb.codeblock": "代码块",
    "tb.codeblockLabel": "代码块",
    "tb.hr": "分割线",
    "tb.hrLabel": "分割线",

    "editor.placeholder": "在这里输入 Markdown…",

    "img.failed": "图片未能加载",
    "img.alt": "图片",

    "toast.exporting": "正在导出…",
    "toast.exportOk": "已导出：{name}",
    "toast.printHint": "已打开打印面板，目标选择「另存为 PDF」即可",
    "toast.exportFail": "导出失败，请重试（控制台有详细原因）",
    "toast.reset": "已恢复默认内容",
    "toast.cleared": "已清空内容",
    "toast.lang": "界面语言已切换",
    "toast.langKept": "界面语言已切换，编辑内容保持不变",
    "toast.copied": "已复制到剪贴板"
  },

  "zh-Hant": {
    "doc.title": "KylinMD · Markdown 線上編輯器",
    "app.title": "KylinMD Editor",
    "app.subtitle": "線上編輯器 · 即時預覽",

    "a11y.skip": "跳到編輯器",
    "pane.editor": "Markdown",
    "pane.preview": "預覽",
    "view.label": "檢視切換",
    "view.editor": "編輯",
    "view.preview": "預覽",
    "editor.label": "Markdown 編輯器",
    "preview.label": "預覽結果",

    "stats.chars": "字元",
    "stats.words": "詞",

    "file.title": "檔案",
    "file.open": "開啟本機檔案",
    "file.clear": "清空內容",
    "file.reset": "還原預設內容",
    "file.opened": "已開啟：{name}",
    "file.openFail": "檔案讀取失敗",
    "file.clearConfirm": "確定清空目前內容嗎？此操作無法復原。",

    "export.title": "匯出",
    "export.md": "Markdown (.md)",
    "export.pdf": "PDF (.pdf)",
    "export.word": "Word (.docx)",
    "export.html": "HTML (.html)",
    "export.exportedBy": "由 KylinMD 匯出",

    "settings.title": "設定",
    "settings.close": "關閉設定",
    "settings.syncScroll": "同步捲動",
    "settings.syncScrollDesc": "編輯區與預覽區捲動位置連動",
    "settings.theme": "主題",
    "settings.themeLight": "淺色",
    "settings.themeDark": "深色",
    "settings.themeAuto": "自動",
    "settings.fontSize": "字型大小",
    "settings.language": "語言",
    "settings.languageDesc": "介面與教學使用的語言",
    "settings.langEn": "English",
    "settings.langZh": "简体中文",
    "settings.langHant": "繁體中文",

    "tb.toolbar": "編輯工具列",
    "tb.h1": "一級標題",
    "tb.h2": "二級標題",
    "tb.h3": "三級標題",
    "tb.bold": "粗體",
    "tb.italic": "斜體",
    "tb.strike": "刪除線",
    "tb.code": "行內程式碼",
    "tb.link": "插入連結",
    "tb.linkLabel": "連結",
    "tb.image": "插入圖片",
    "tb.imageLabel": "圖片",
    "tb.quote": "引用",
    "tb.quoteLabel": "引用",
    "tb.ul": "項目符號清單",
    "tb.ulLabel": "項目",
    "tb.ol": "編號清單",
    "tb.olLabel": "編號",
    "tb.task": "待辦清單",
    "tb.taskLabel": "待辦",
    "tb.table": "插入表格",
    "tb.tableLabel": "表格",
    "tb.codeblock": "程式碼區塊",
    "tb.codeblockLabel": "程式碼",
    "tb.hr": "分隔線",
    "tb.hrLabel": "分隔線",

    "editor.placeholder": "在這裡輸入 Markdown…",

    "img.failed": "圖片載入失敗",
    "img.alt": "圖片",

    "toast.exporting": "正在匯出…",
    "toast.exportOk": "已匯出：{name}",
    "toast.printHint": "已開啟列印面板，目標選擇「另存為 PDF」即可",
    "toast.exportFail": "匯出失敗，請重試（主控台有詳細原因）",
    "toast.reset": "已還原預設內容",
    "toast.cleared": "已清空內容",
    "toast.lang": "介面語言已切換",
    "toast.langKept": "介面語言已切換，編輯內容保持不變",
    "toast.copied": "已複製到剪貼簿"
  }
};

let currentLang = DEFAULT_LANG;

function t(key) {
  const cur = I18N[currentLang] || I18N[DEFAULT_LANG];
  const val = cur[key];
  if (val != null) return val;
  return I18N[DEFAULT_LANG][key] != null ? I18N[DEFAULT_LANG][key] : key;
}

/* lang 可以是任意写法（?lg=zh-TW 之类），内部统一解析成受支持的语言 */
function applyI18n(lang) {
  currentLang = resolveLang(lang);
  document.documentElement.lang = langInfo(currentLang).htmlLang;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
  });

  // 提示气泡
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.getAttribute("data-i18n-title"));
  });

  // 无障碍名称；data-aria-prefix="text" 时保留可见文字在前（Label in Name）
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const name = t(el.getAttribute("data-i18n-aria"));
    const withText = el.getAttribute("data-aria-prefix") === "text";
    const visible = withText ? (el.textContent || "").trim() : "";
    el.setAttribute("aria-label", visible ? visible + " " + name : name);
  });

  document.title = t("doc.title");
}
