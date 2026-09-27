var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => GlypharySyntaxPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian3 = require("obsidian");

// src/editor.ts
var import_state = require("@codemirror/state");
var import_view = require("@codemirror/view");
var import_obsidian = require("obsidian");

// src/syntax.mjs
var calloutPattern = /^:::\s*callout(?:\s+([\w-]+))?(?:\s+"((?:\\.|[^"\\])*)")?\s*$/i;
var collapsePattern = /^:::\s*collapse(?:\s+(?:"((?:\\.|[^"\\])*)"|([^\r\n]*?)))?(?:\s+(open))?\s*$/i;
var namedContainerPattern = /^:::\s*([\w-]+)\s*$/;
var bareTypes = ["columns", "column", "gallery", "rich-link"];
function unescape(value) {
  return value.replace(/\\(["\\])/g, "$1");
}
function parseCollapse(match) {
  const quotedTitle = match[1];
  const plainTitle = match[2]?.trim() || "";
  const parts = plainTitle.split(/\s+/).filter(Boolean);
  const hasOpenSuffix = !quotedTitle && parts.at(-1)?.toLowerCase() === "open";
  return {
    type: "collapse",
    title: quotedTitle ? unescape(quotedTitle) : hasOpenSuffix ? parts.slice(0, -1).join(" ") : plainTitle || "Details",
    open: Boolean(match[3]) || hasOpenSuffix
  };
}
function parseMarker(line) {
  const trimmed = line.trim();
  if (/^:::\s*$/.test(trimmed)) {
    return { type: "close" };
  }
  const bare = bareTypes.find((type) => new RegExp(`^:::\\s*${type}\\s*$`, "i").test(trimmed));
  if (bare) {
    return { type: bare };
  }
  const callout = trimmed.match(calloutPattern);
  if (callout) {
    return {
      type: "callout",
      kind: callout[1] || "note",
      title: callout[2] ? unescape(callout[2]) : void 0
    };
  }
  const collapse = trimmed.match(collapsePattern);
  if (collapse) {
    return parseCollapse(collapse);
  }
  const named = trimmed.match(namedContainerPattern);
  if (named) {
    return { type: "container", name: named[1].toLowerCase() };
  }
  return null;
}
function parseRichLinkFields(lines) {
  const fields = {};
  for (const line of lines) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (match) {
      fields[match[1]] = match[2].trim();
    }
  }
  return fields;
}
function restoreEscapedWikilinks(text) {
  return text.replaceAll("\\[\\[", "[[").replaceAll("\\]\\]", "]]");
}
function fenceOf(line) {
  return line.match(/^\s*(`{3,}|~{3,})/)?.[1][0] ?? null;
}
function parseBlocks(lines) {
  const roots = [];
  const stack = [];
  let fence = null;
  for (let index = 0; index < lines.length; index += 1) {
    const lineFence = fenceOf(lines[index]);
    if (fence) {
      if (lineFence === fence) {
        fence = null;
      }
      continue;
    }
    if (lineFence) {
      fence = lineFence;
      continue;
    }
    const marker = parseMarker(lines[index]);
    if (!marker) {
      continue;
    }
    if (marker.type !== "close") {
      stack.push({ marker, startLine: index, children: [] });
      continue;
    }
    const open = stack.pop();
    if (!open) {
      continue;
    }
    const block = {
      type: open.marker.type,
      marker: open.marker,
      startLine: open.startLine,
      endLine: index,
      children: open.children
    };
    const parent = stack.at(-1);
    (parent ? parent.children : roots).push(block);
  }
  return roots;
}
function blockSegments(block, lines) {
  const segments = [];
  let cursor = block.startLine + 1;
  const pushLines = (from, to) => {
    const own = lines.slice(from, to);
    if (own.some((line) => line.trim())) {
      segments.push({ kind: "lines", lines: own });
    }
  };
  for (const child of block.children) {
    pushLines(cursor, child.startLine);
    segments.push({ kind: "block", block: child });
    cursor = child.endLine + 1;
  }
  pushLines(cursor, block.endLine);
  return segments;
}

// src/rich-link.ts
function buildRichLinkCard(document2, bodyLines) {
  const fields = parseRichLinkFields(bodyLines);
  const url = fields.url ?? "";
  if (!url) {
    const fallback = document2.createElement("pre");
    fallback.className = "glyphary-rich-link-missing";
    fallback.textContent = bodyLines.join("\n");
    return fallback;
  }
  const card = document2.createElement("a");
  card.className = "glyphary-rich-link";
  card.href = url;
  card.rel = "noopener";
  card.target = "_blank";
  if (fields.image) {
    const image = document2.createElement("img");
    image.className = "glyphary-rich-link-image";
    image.src = fields.image;
    image.alt = "";
    image.loading = "lazy";
    card.append(image);
  }
  const text = document2.createElement("div");
  text.className = "glyphary-rich-link-text";
  const title = document2.createElement("div");
  title.className = "glyphary-rich-link-title";
  title.textContent = fields.title || url;
  text.append(title);
  if (fields.description) {
    const description = document2.createElement("div");
    description.className = "glyphary-rich-link-description";
    description.textContent = fields.description;
    text.append(description);
  }
  const site = document2.createElement("div");
  site.className = "glyphary-rich-link-site";
  site.textContent = fields.siteName || safeHost(url);
  text.append(site);
  card.append(text);
  return card;
}
function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

// src/block-dom.ts
function titled(document2, tag, className, blockName) {
  const element = document2.createElement(tag);
  element.className = className;
  element.dataset.glypharyBlock = blockName;
  return element;
}
function calloutShell(document2, marker) {
  const kind = marker.kind || "note";
  const aside = titled(document2, "aside", `glyphary-callout glyphary-callout-${kind}`, "callout");
  const title = document2.createElement("div");
  title.className = "glyphary-callout-title";
  title.textContent = marker.title || kind;
  aside.append(title);
  const body = document2.createElement("div");
  body.className = "glyphary-callout-body";
  aside.append(body);
  return { element: aside, target: body, fields: false };
}
function collapseShell(document2, marker) {
  const details = titled(document2, "details", "glyphary-collapse", "collapse");
  details.open = Boolean(marker.open);
  const summary = document2.createElement("summary");
  summary.className = "glyphary-collapse-summary";
  summary.textContent = marker.title || "Details";
  details.append(summary);
  const body = document2.createElement("div");
  body.className = "glyphary-collapse-body";
  details.append(body);
  return { element: details, target: body, fields: false };
}
function createBlockShell(document2, marker) {
  if (marker.type === "callout") {
    return calloutShell(document2, marker);
  }
  if (marker.type === "collapse") {
    return collapseShell(document2, marker);
  }
  if (marker.type === "rich-link") {
    const element2 = titled(document2, "div", "glyphary-rich-link-block", "rich-link");
    return { element: element2, target: element2, fields: true };
  }
  if (marker.type === "container") {
    const element2 = titled(document2, "div", `glyphary-container glyphary-container-${marker.name}`, marker.name);
    return { element: element2, target: element2, fields: false };
  }
  const element = titled(document2, "div", `glyphary-${marker.type}`, marker.type);
  return { element, target: element, fields: false };
}
function renderBody(shell, lines, renderMarkdown) {
  if (shell.fields) {
    shell.target.append(buildRichLinkCard(shell.element.ownerDocument, lines));
    return;
  }
  const markdown = restoreEscapedWikilinks(lines.join("\n"));
  if (markdown.trim()) {
    renderMarkdown(markdown, shell.target);
  }
}
function renderBlockTree(document2, block, lines, renderMarkdown) {
  const shell = createBlockShell(document2, block.marker);
  for (const segment of blockSegments(block, lines)) {
    if (segment.kind === "lines") {
      renderBody(shell, segment.lines, renderMarkdown);
    } else {
      shell.target.append(renderBlockTree(document2, segment.block, lines, renderMarkdown));
    }
  }
  return shell.element;
}

// src/editor.ts
var GlypharyBlockWidget = class extends import_view.WidgetType {
  constructor(app, sourcePath, block, lines, from) {
    super();
    this.app = app;
    this.sourcePath = sourcePath;
    this.block = block;
    this.lines = lines;
    this.from = from;
    __publicField(this, "components", /* @__PURE__ */ new WeakMap());
  }
  eq(other) {
    return other.block.startLine === this.block.startLine && other.block.endLine === this.block.endLine && other.lines.slice(this.block.startLine, this.block.endLine + 1).join("\n") === this.lines.slice(this.block.startLine, this.block.endLine + 1).join("\n");
  }
  toDOM(view) {
    const component = new import_obsidian.Component();
    component.load();
    const wrapper = document.createElement("div");
    wrapper.className = "glyphary-live-widget";
    wrapper.append(
      renderBlockTree(document, this.block, this.lines, (markdown, target) => {
        void import_obsidian.MarkdownRenderer.render(this.app, markdown, target, this.sourcePath, component);
      })
    );
    wrapper.append(this.editButton(view));
    this.components.set(wrapper, component);
    return wrapper;
  }
  destroy(dom) {
    this.components.get(dom)?.unload();
  }
  ignoreEvent(event) {
    return event.type !== "click";
  }
  editButton(view) {
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "glyphary-live-edit";
    edit.textContent = "Edit source";
    edit.addEventListener("click", () => {
      view.dispatch({ selection: { anchor: this.from }, scrollIntoView: true });
      view.focus();
    });
    return edit;
  }
};
function caretInside(state, from, to) {
  const { main } = state.selection;
  return main.from <= to && main.to >= from;
}
function buildDecorations(app, state) {
  const lines = state.doc.toString().split("\n");
  const sourcePath = state.field(import_obsidian.editorInfoField, false)?.file?.path ?? "";
  const builder = new import_state.RangeSetBuilder();
  for (const block of parseBlocks(lines)) {
    const from = state.doc.line(block.startLine + 1).from;
    const to = state.doc.line(block.endLine + 1).to;
    if (caretInside(state, from, to)) {
      continue;
    }
    builder.add(
      from,
      to,
      import_view.Decoration.replace({ widget: new GlypharyBlockWidget(app, sourcePath, block, lines, from), block: true })
    );
  }
  return builder.finish();
}
function createLivePreviewExtension(app) {
  const field = import_state.StateField.define({
    create: (state) => buildDecorations(app, state),
    update(decorations, transaction) {
      return transaction.docChanged || transaction.selection ? buildDecorations(app, transaction.state) : decorations;
    },
    provide: (self) => import_view.EditorView.decorations.from(self)
  });
  return [field];
}

// src/reading-view.ts
var import_obsidian2 = require("obsidian");
var GlypharyRenderChild = class extends import_obsidian2.MarkdownRenderChild {
};
var sectionStates = /* @__PURE__ */ new Map();
function markdownRenderer(context) {
  return (markdown, target) => {
    const child = new GlypharyRenderChild(target);
    context.addChild(child);
    void import_obsidian2.MarkdownRenderer.renderMarkdown(markdown, target, context.sourcePath, child);
  };
}
function pendingLines(info, state) {
  const source = info.text.split(/\r?\n/);
  return { startLine: state.nextLine, lines: source.slice(state.nextLine, info.lineEnd + 1) };
}
function renderGlypharySection(element, context) {
  const info = context.getSectionInfo(element);
  if (!info) {
    return;
  }
  const sourcePath = context.sourcePath;
  const state = sectionStates.get(sourcePath) ?? { stack: [], nextLine: info.lineStart };
  if (info.lineStart < state.nextLine) {
    return;
  }
  const { startLine, lines } = pendingLines(info, state);
  const touchesContainer = state.stack.length > 0 || lines.some((line) => parseMarker(line));
  if (!touchesContainer) {
    state.nextLine = info.lineEnd + 1;
    return;
  }
  const render = markdownRenderer(context);
  let body = [];
  let cleared = false;
  let sawMarker = false;
  const clearSection = () => {
    if (!cleared) {
      element.replaceChildren();
      cleared = true;
    }
  };
  const flushBody = () => {
    const top = state.stack.at(-1);
    if (body.length > 0 && top) {
      clearSection();
      renderBody(top, body, render);
    }
    body = [];
  };
  lines.forEach((line, offset) => {
    const marker = parseMarker(line);
    if (!marker) {
      body.push(line);
      return;
    }
    flushBody();
    sawMarker = true;
    if (startLine + offset >= info.lineStart) {
      clearSection();
    }
    if (marker.type === "close") {
      state.stack.pop();
      return;
    }
    const shell = createBlockShell(element.ownerDocument, marker);
    (state.stack.at(-1)?.target ?? element).append(shell.element);
    state.stack.push(shell);
  });
  flushBody();
  state.nextLine = info.lineEnd + 1;
  if (state.stack.length > 0) {
    sectionStates.set(sourcePath, state);
  } else if (sawMarker) {
    sectionStates.delete(sourcePath);
  }
}

// src/main.ts
var GlypharySyntaxPlugin = class extends import_obsidian3.Plugin {
  onload() {
    this.registerEditorExtension(createLivePreviewExtension(this.app));
    this.registerMarkdownPostProcessor((element, context) => renderGlypharySection(element, context));
  }
};
