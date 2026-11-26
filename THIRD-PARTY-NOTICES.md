# 第三方组件声明

本项目本体以 MIT 分发（见 `LICENSE`）。`lib/` 目录下的第三方库各自保留原有许可证，
版权归各自作者所有；下表列出打包进来的版本与出处。

| 组件 | 版本 | 许可证 | 位置 | 上游 |
| --- | --- | --- | --- | --- |
| marked | 12.0.2 | MIT | `lib/marked.min.js` | https://github.com/markedjs/marked |
| highlight.js | 11.9.0 | BSD-3-Clause | `lib/highlight.min.js` | https://github.com/highlightjs/highlight.js |
| highlight.js 主题（GitHub） | 11.9.0 | BSD-3-Clause | `lib/github.min.css`、`lib/github-dark.min.css` | 同上 |
| mermaid | 10.9.1 | MIT | `lib/mermaid.min.js` | https://github.com/mermaid-js/mermaid |
| docx | 8.5.0 | MIT | `lib/docx.umd.js` | https://github.com/dolanmiu/docx |
| DOMPurify | 3.1.7 | Apache-2.0 **或** MPL-2.0（本项目按 Apache-2.0 使用） | `lib/purify.min.js` | https://github.com/cure53/DOMPurify |

## 关于许可证副本

- MIT / BSD-3-Clause 的库：原版权声明与许可声明保留在各自的 `lib/*.js` 文件头里，文件原样分发、未做修改。
- DOMPurify：完整许可证原文见 `lib/purify.LICENSE.txt`（含双许可声明与 Apache License 2.0 全文）。
- 本文件与 `LICENSE` 分离存放，避免把第三方声明混进本项目的 MIT 文本里，影响自动识别与合规扫描。
