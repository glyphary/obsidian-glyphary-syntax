import { buildRichLinkCard } from "./rich-link";
import { blockSegments, restoreEscapedWikilinks } from "./syntax.mjs";

// Builds the DOM for a container marker. Reading View and Live Preview share
// this so both views produce the same elements and the stylesheet has one
// set of classes.

export type BodyRenderer = (markdown: string, target: HTMLElement) => void;

export type BlockShell = {
  element: HTMLElement;
  /** Where body content goes; the element itself for plain groups. */
  target: HTMLElement;
  /** The body is `key: value` metadata, not Markdown. */
  fields: boolean;
};

function titled(document: Document, tag: string, className: string, blockName: string) {
  const element = document.createElement(tag);
  element.className = className;
  element.dataset.glypharyBlock = blockName;
  return element;
}

function calloutShell(document: Document, marker): BlockShell {
  const kind = marker.kind || "note";
  const aside = titled(document, "aside", `glyphary-callout glyphary-callout-${kind}`, "callout");

  const title = document.createElement("div");
  title.className = "glyphary-callout-title";
  title.textContent = marker.title || kind;
  aside.append(title);

  const body = document.createElement("div");
  body.className = "glyphary-callout-body";
  aside.append(body);

  return { element: aside, target: body, fields: false };
}

function collapseShell(document: Document, marker): BlockShell {
  const details = titled(document, "details", "glyphary-collapse", "collapse") as HTMLDetailsElement;
  details.open = Boolean(marker.open);

  const summary = document.createElement("summary");
  summary.className = "glyphary-collapse-summary";
  summary.textContent = marker.title || "Details";
  details.append(summary);

  const body = document.createElement("div");
  body.className = "glyphary-collapse-body";
  details.append(body);

  return { element: details, target: body, fields: false };
}

export function createBlockShell(document: Document, marker): BlockShell {
  if (marker.type === "callout") {
    return calloutShell(document, marker);
  }

  if (marker.type === "collapse") {
    return collapseShell(document, marker);
  }

  if (marker.type === "rich-link") {
    const element = titled(document, "div", "glyphary-rich-link-block", "rich-link");
    return { element, target: element, fields: true };
  }

  if (marker.type === "container") {
    const element = titled(document, "div", `glyphary-container glyphary-container-${marker.name}`, marker.name);
    return { element, target: element, fields: false };
  }

  const element = titled(document, "div", `glyphary-${marker.type}`, marker.type);
  return { element, target: element, fields: false };
}

/** Renders a block's body lines into its shell: a card for fields, Markdown otherwise. */
export function renderBody(shell: BlockShell, lines: string[], renderMarkdown: BodyRenderer) {
  if (shell.fields) {
    shell.target.append(buildRichLinkCard(shell.element.ownerDocument, lines));
    return;
  }

  const markdown = restoreEscapedWikilinks(lines.join("\n"));

  if (markdown.trim()) {
    renderMarkdown(markdown, shell.target);
  }
}

/** Renders a parsed block tree, text and children in document order. */
export function renderBlockTree(document: Document, block, lines: string[], renderMarkdown: BodyRenderer): HTMLElement {
  const shell = createBlockShell(document, block.marker);

  for (const segment of blockSegments(block, lines)) {
    if (segment.kind === "lines") {
      renderBody(shell, segment.lines, renderMarkdown);
    } else {
      shell.target.append(renderBlockTree(document, segment.block, lines, renderMarkdown));
    }
  }

  return shell.element;
}
