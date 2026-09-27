import { RangeSetBuilder, StateField, type EditorState } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import { Component, MarkdownRenderer, editorInfoField, type App } from "obsidian";
import { renderBlockTree } from "./block-dom";
import { parseBlocks } from "./syntax.mjs";

// Live Preview: a complete block is replaced by a rendered widget unless the
// caret is inside it, so the same bytes stay directly editable.

class GlypharyBlockWidget extends WidgetType {
  private readonly components = new WeakMap<HTMLElement, Component>();

  constructor(
    private readonly app: App,
    private readonly sourcePath: string,
    private readonly block,
    private readonly lines: string[],
    private readonly from: number,
  ) {
    super();
  }

  eq(other: GlypharyBlockWidget) {
    return (
      other.block.startLine === this.block.startLine &&
      other.block.endLine === this.block.endLine &&
      other.lines.slice(this.block.startLine, this.block.endLine + 1).join("\n") ===
        this.lines.slice(this.block.startLine, this.block.endLine + 1).join("\n")
    );
  }

  toDOM(view: EditorView) {
    // Obsidian's renderer needs a Component to own the embeds it creates;
    // it is unloaded with the widget so those embeds are released.
    const component = new Component();
    component.load();

    const wrapper = document.createElement("div");
    wrapper.className = "glyphary-live-widget";
    wrapper.append(
      renderBlockTree(document, this.block, this.lines, (markdown, target) => {
        void MarkdownRenderer.render(this.app, markdown, target, this.sourcePath, component);
      }),
    );
    wrapper.append(this.editButton(view));
    this.components.set(wrapper, component);
    return wrapper;
  }

  destroy(dom: HTMLElement) {
    this.components.get(dom)?.unload();
  }

  ignoreEvent(event: Event) {
    return event.type !== "click";
  }

  private editButton(view: EditorView) {
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
}

function caretInside(state: EditorState, from: number, to: number) {
  const { main } = state.selection;

  return main.from <= to && main.to >= from;
}

function buildDecorations(app: App, state: EditorState) {
  const lines = state.doc.toString().split("\n");
  const sourcePath = state.field(editorInfoField, false)?.file?.path ?? "";
  const builder = new RangeSetBuilder<Decoration>();

  for (const block of parseBlocks(lines)) {
    const from = state.doc.line(block.startLine + 1).from;
    const to = state.doc.line(block.endLine + 1).to;

    if (caretInside(state, from, to)) {
      continue;
    }

    builder.add(
      from,
      to,
      Decoration.replace({ widget: new GlypharyBlockWidget(app, sourcePath, block, lines, from), block: true }),
    );
  }

  return builder.finish();
}

export function createLivePreviewExtension(app: App) {
  const field = StateField.define({
    create: (state) => buildDecorations(app, state),
    update(decorations, transaction) {
      return transaction.docChanged || transaction.selection ? buildDecorations(app, transaction.state) : decorations;
    },
    provide: (self) => EditorView.decorations.from(self),
  });

  return [field];
}
