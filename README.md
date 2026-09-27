# Glyphary Syntax

An Obsidian companion plugin for Glyphary's portable block syntax.

Supported without rewriting source files:

- `::: callout note "Title"`
- `::: columns` with nested `::: column` blocks
- `::: collapse Details` and the optional `open` suffix
- `::: gallery` image grids
- `::: rich-link` preview cards built from the block's `key: value` fields

Any other `::: name` container Glyphary adds later is rendered as a plain
group, so its closing marker never breaks the blocks around it.

Reading View renders the blocks in place. Live Preview renders a complete
block through Obsidian's own Markdown renderer and swaps back to the source
whenever the caret enters it, so the same bytes stay directly editable.
Source Mode is untouched. The plugin never converts or saves a different
representation.

Disable **Multi-Column Markdown** when using Glyphary's `:::` columns syntax;
both plugins claim the same marker and cannot render it together.

## Layout

- `src/syntax.mjs`: the parser. Pure functions over lines of text.
- `src/block-dom.ts`: builds the DOM for a block; shared by both views.
- `src/rich-link.ts`: the rich-link card.
- `src/reading-view.ts`: the post-processor that tracks containers across sections.
- `src/editor.ts`: the Live Preview widget field.

## Development

```sh
npm install
npm run build
npm test
```

Copy `main.js`, `manifest.json`, and `styles.css` into:

```text
<vault>/.obsidian/plugins/glyphary-syntax/
```

Enable **Glyphary Syntax** in Obsidian's Community Plugins settings.
