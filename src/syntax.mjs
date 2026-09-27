// Parser for Glyphary's `:::` container syntax. Pure functions over lines of
// text; no DOM, no Obsidian.

const calloutPattern =
  /^:::\s*callout(?:\s+([\w-]+))?(?:\s+"((?:\\.|[^"\\])*)")?\s*$/i;
const collapsePattern =
  /^:::\s*collapse(?:\s+(?:"((?:\\.|[^"\\])*)"|([^\r\n]*?)))?(?:\s+(open))?\s*$/i;
const namedContainerPattern = /^:::\s*([\w-]+)\s*$/;
const bareTypes = ["columns", "column", "gallery", "rich-link"];

function unescape(value) {
  return value.replace(/\\(["\\])/g, "$1");
}

function parseCollapse(match) {
  const quotedTitle = match[1];
  const plainTitle = match[2]?.trim() || "";
  const parts = plainTitle.split(/\s+/).filter(Boolean);
  // `::: collapse Title open` has no quotes, so the last word may be the
  // flag rather than part of the title.
  const hasOpenSuffix = !quotedTitle && parts.at(-1)?.toLowerCase() === "open";

  return {
    type: "collapse",
    title: quotedTitle
      ? unescape(quotedTitle)
      : hasOpenSuffix
        ? parts.slice(0, -1).join(" ")
        : plainTitle || "Details",
    open: Boolean(match[3]) || hasOpenSuffix,
  };
}

export function parseMarker(line) {
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
      title: callout[2] ? unescape(callout[2]) : undefined,
    };
  }

  const collapse = trimmed.match(collapsePattern);
  if (collapse) {
    return parseCollapse(collapse);
  }

  // Every Glyphary container closes with a bare `:::`, so a container this
  // build does not render still has to open a level, or its closer would
  // pop the wrong block.
  const named = trimmed.match(namedContainerPattern);
  if (named) {
    return { type: "container", name: named[1].toLowerCase() };
  }

  return null;
}

export function parseRichLinkFields(lines) {
  const fields = {};

  for (const line of lines) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);

    if (match) {
      fields[match[1]] = match[2].trim();
    }
  }

  return fields;
}

// Glyphary builds before 1.0.0-beta.8 saved wikilinks escaped; those notes
// still exist, so the brackets are restored before rendering.
export function restoreEscapedWikilinks(text) {
  return text.replaceAll("\\[\\[", "[[").replaceAll("\\]\\]", "]]");
}

function fenceOf(line) {
  return line.match(/^\s*(`{3,}|~{3,})/)?.[1][0] ?? null;
}

/** Complete top-level blocks with nested children; markers inside code fences are ignored. */
export function parseBlocks(lines) {
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
      children: open.children,
    };
    const parent = stack.at(-1);

    (parent ? parent.children : roots).push(block);
  }

  return roots;
}

/**
 * A block's content in document order: runs of its own lines and its child
 * blocks, so a renderer can interleave text and nested containers as
 * written instead of grouping all text first.
 */
export function blockSegments(block, lines) {
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
