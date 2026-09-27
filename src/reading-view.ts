import { MarkdownRenderChild, MarkdownRenderer } from "obsidian";
import { type BlockShell, createBlockShell, renderBody } from "./block-dom";
import { parseMarker } from "./syntax.mjs";

// Reading View: Obsidian hands the post-processor one section at a time, and
// a container can span many sections. The open shells are kept per source
// path between calls so later sections render into the right parent.

type SectionState = { stack: BlockShell[]; nextLine: number };

class GlypharyRenderChild extends MarkdownRenderChild {}

const sectionStates = new Map<string, SectionState>();

function markdownRenderer(context) {
  return (markdown: string, target: HTMLElement) => {
    const child = new GlypharyRenderChild(target);
    context.addChild(child);
    void MarkdownRenderer.renderMarkdown(markdown, target, context.sourcePath, child);
  };
}

/** Lines this call owns: from the first unrendered line through the section end. */
function pendingLines(info, state: SectionState) {
  const source = info.text.split(/\r?\n/);

  return { startLine: state.nextLine, lines: source.slice(state.nextLine, info.lineEnd + 1) };
}

export function renderGlypharySection(element: HTMLElement, context) {
  const info = context.getSectionInfo(element);
  if (!info) {
    return;
  }

  const sourcePath = context.sourcePath;
  const state = sectionStates.get(sourcePath) ?? { stack: [], nextLine: info.lineStart };

  // A section already consumed by an earlier container's tail.
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
  let body: string[] = [];
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

    // Only lines inside this section may wipe Obsidian's own rendering of it.
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
