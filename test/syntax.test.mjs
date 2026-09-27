import assert from "node:assert/strict";
import test from "node:test";
import {
  blockSegments,
  parseBlocks,
  parseMarker,
  parseRichLinkFields,
  restoreEscapedWikilinks,
} from "../src/syntax.mjs";

test("parses callout kind and escaped title", () => {
  assert.deepEqual(parseMarker('::: callout warning "Deploy \\"now\\""'), {
    type: "callout",
    kind: "warning",
    title: 'Deploy "now"',
  });
  assert.deepEqual(parseMarker("::: callout"), { type: "callout", kind: "note", title: undefined });
});

test("parses collapse titles and the open suffix", () => {
  assert.deepEqual(parseMarker("::: collapse More details open"), {
    type: "collapse",
    title: "More details",
    open: true,
  });
  assert.deepEqual(parseMarker('::: collapse "Quoted open" open'), {
    type: "collapse",
    title: "Quoted open",
    open: true,
  });
  assert.deepEqual(parseMarker("::: collapse"), { type: "collapse", title: "Details", open: false });
});

test("recognises every bare container and any unknown Glyphary container", () => {
  assert.deepEqual(parseMarker("::: columns"), { type: "columns" });
  assert.deepEqual(parseMarker("::: column"), { type: "column" });
  assert.deepEqual(parseMarker("::: gallery"), { type: "gallery" });
  assert.deepEqual(parseMarker("::: rich-link"), { type: "rich-link" });
  assert.deepEqual(parseMarker("::: something-new"), { type: "container", name: "something-new" });
  assert.deepEqual(parseMarker(":::"), { type: "close" });
  assert.equal(parseMarker("::: not a container"), null);
  assert.equal(parseMarker("plain text"), null);
});

test("parses complete nested blocks and ignores fenced markers", () => {
  const blocks = parseBlocks([
    "::: columns",
    "::: column",
    "One",
    ":::",
    "::: column",
    "Two",
    ":::",
    ":::",
    "```md",
    "::: callout warning",
    "```",
  ]);

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "columns");
  assert.equal(blocks[0].children.length, 2);
});

test("an unknown container's closer does not pop its parent", () => {
  const blocks = parseBlocks([
    "::: callout note",
    "Before",
    "::: something-new",
    "Inside",
    ":::",
    "After",
    ":::",
  ]);

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "callout");
  assert.equal(blocks[0].endLine, 6);
  assert.equal(blocks[0].children[0].type, "container");
});

test("block segments keep text and children in document order", () => {
  const lines = ["::: callout note", "Before", "::: collapse More", "Inside", ":::", "", "After", ":::"];
  const [callout] = parseBlocks(lines);
  const segments = blockSegments(callout, lines);

  assert.deepEqual(
    segments.map((segment) => (segment.kind === "lines" ? segment.lines : `<${segment.block.type}>`)),
    [["Before"], "<collapse>", ["", "After"]],
  );
  assert.deepEqual(blockSegments(callout.children[0], lines), [{ kind: "lines", lines: ["Inside"] }]);
});

test("rich-link bodies are key: value fields", () => {
  assert.deepEqual(
    parseRichLinkFields(["url: https://example.com/a", "title: Example", "description: Words here", "junk line", "siteName: Example"]),
    { url: "https://example.com/a", title: "Example", description: "Words here", siteName: "Example" },
  );
});

test("wikilinks escaped by older Glyphary builds are restored", () => {
  assert.equal(restoreEscapedWikilinks("see \\[\\[Note\\]\\] and [[Other]]"), "see [[Note]] and [[Other]]");
});
