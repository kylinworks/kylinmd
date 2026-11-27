# Markdown: A Complete Beginner's Guide

> **This is a hands-on Markdown tutorial — edit it as you read.**
> The preview shows exactly what the source on the left renders to. Change something on the left and it updates instantly, so you can learn by poking at it and be productive in minutes.

---

## What is Markdown?

Markdown is a **lightweight markup language** created in 2004 by John Gruber and Aaron Swartz. It marks up formatting with plain-text symbols that convert easily to HTML.

Three reasons to use it:

- **Readable** — the source is plain text, so it makes sense even before rendering
- **Quick to write** — you stay on the content instead of reaching for a toolbar
- **Everywhere** — GitHub, CMS editors, note apps (Obsidian / Notion / Bear) and most chat tools support it

---

## 1. Headings

Start a line with `#`; the more hashes, the deeper the level:

```markdown
# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6
```

> Tip: keep one space after the `#`. Pick a heading level for its place in the document outline, not for how big it looks.

# Heading 1
## Heading 2
### Heading 3

---

## 2. Emphasis: bold / italic / strikethrough / highlight

| Syntax | Result |
| --- | --- |
| `**bold**` | **bold** |
| `*italic*` | *italic* |
| `~~strikethrough~~` | ~~strikethrough~~ |
| `==highlight==` | ==highlight== |
| `***bold italic***` | ***bold italic*** |
| `` `inline code` `` | `inline code` |

They also **combine**: `**bold with *italic* and ~~struck~~ text**` → **bold with *italic* and ~~struck~~ text**

---

## 3. Lists

### Unordered

Start each line with `-`, `*` or `+`:

```markdown
- First item
- Second item
- Third item
```

- First item
- Second item
- Third item

### Ordered

Start with a number and a dot:

```markdown
1. First step
2. Second step
3. Third step
```

1. First step
2. Second step
3. Third step

### Nested

Indent a sub-item by **two spaces**:

```markdown
1. Gather the ingredients
   - 2 eggs
   - 200 ml milk
2. Cook everything
   - 30 seconds on high heat
   - then turn it down
```

1. Gather the ingredients
   - 2 eggs
   - 200 ml milk
2. Cook everything
   - 30 seconds on high heat
   - then turn it down

### Task lists

Add `[ ]` (open) or `[x]` (done) after the dash:

```markdown
- [x] Learn headings
- [x] Learn lists
- [ ] Learn tables
- [ ] Learn code blocks
```

- [x] Learn headings
- [x] Learn lists
- [ ] Learn tables
- [ ] Learn code blocks

> Tip: leave a space after `-`, `[` and `]`.

---

## 4. Links

### Inline

```markdown
[link text](https://example.com "optional title")
```

For example: visit the [KylinTech channel](https://www.youtube.com/@KylinTech "YouTube channel").

### Autolinks

```markdown
<https://www.youtube.com/@KylinTech>
```

Wrap a bare URL in angle brackets and it becomes a link:

<https://www.youtube.com/@KylinTech>

---

## 5. Images

It's a link with a `!` in front:

```markdown
![alt text](path/to/image.png)
```

Example (this tutorial ships a local SVG, so it renders offline):

![Markdown image example](assets/markdown-demo.svg)

> Tip: the address can be a URL or a relative path. The alt text appears if the image fails to load.

---

## 6. Blockquotes

Start each line with `>`, including every line of a multi-line quote:

```markdown
> Learning without thought is labour lost;
> thought without learning is perilous.
>
> — Confucius
```

> Learning without thought is labour lost;
> thought without learning is perilous.
>
> — Confucius

Quotes **nest**, giving you multi-level quotes:

> Level one
> > Level two
> > > Level three

---

## 7. Code

### Inline code

Wrap it in backticks: `` `print("hello")` `` → `print("hello")`

### Code blocks

Fence the code with three backticks

> Always tag the language (e.g. ```python) — that turns on syntax highlighting and makes the code far easier to scan

````markdown
```python
def greet(name):
    """Say hello to someone."""
    return f"Hello, {name}!"

print(greet("world"))
```
````

Rendered:

```python
def greet(name):
    """Say hello to someone."""
    return f"Hello, {name}!"

print(greet("world"))
```

Some JavaScript:

```javascript
const fruits = ["apple", "banana", "orange"];
fruits.map((f) => console.log(f));
```

And a shell session:

```bash
git init
git add .
git commit -m "first commit"
```

---

## 8. Tables

Split columns with `|` and separate the header row with `-`. Colons set the alignment:

```markdown
| Feature | Left | Right | Center |
| :--- | :--- | ---: | :---: |
| Headings | `#` | up to 6 levels | ✓ |
| Lists | `-` / `1.` | nestable | ✓ |
| Code | backticks | highlighted | ✓ |
```

| Feature | Left | Right | Center |
| :--- | :--- | ---: | :---: |
| Headings | `#` | up to 6 levels | ✓ |
| Lists | `-` / `1.` | nestable | ✓ |
| Code | backticks | highlighted | ✓ |

---

## 9. Horizontal rules

Three or more `-`, `*` or `_` on a line of their own:

```markdown
---
```

---

## 10. Escaping

To show a marker **literally**, put a backslash `\` in front of it:

```markdown
\*not italic\*
\# not a heading
```

\*not italic\*
\# not a heading

---

## 11. Best practices

1. **One `#` per document** — reserve it for the title and start sections at `##`
2. **Pick one bullet** — use `-` throughout or `*` throughout; don't mix `-`, `*` and `+`
3. **Give fences room** — a blank line before and after a code block is the most portable choice

---

## Wrapping up

What you're reading *is* a working Markdown lesson. **Edit on the left, watch on the right** — try every syntax here once and you're past the beginner stage.
