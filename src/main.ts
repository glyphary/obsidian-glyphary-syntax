import { Plugin } from "obsidian";
import { createLivePreviewExtension } from "./editor";
import { renderGlypharySection } from "./reading-view";

export default class GlypharySyntaxPlugin extends Plugin {
  onload() {
    this.registerEditorExtension(createLivePreviewExtension(this.app));
    this.registerMarkdownPostProcessor((element, context) => renderGlypharySection(element, context));
  }
}
