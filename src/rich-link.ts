import { parseRichLinkFields } from "./syntax.mjs";

// A rich-link body is `key: value` metadata, not Markdown, so it is drawn as
// a card rather than rendered through the Markdown pipeline. Without a URL
// the card would be an inert box, so the fields are shown as plain text.

export function buildRichLinkCard(document: Document, bodyLines: string[]) {
  const fields = parseRichLinkFields(bodyLines);
  const url = fields.url ?? "";

  if (!url) {
    const fallback = document.createElement("pre");
    fallback.className = "glyphary-rich-link-missing";
    fallback.textContent = bodyLines.join("\n");
    return fallback;
  }

  const card = document.createElement("a");
  card.className = "glyphary-rich-link";
  card.href = url;
  card.rel = "noopener";
  card.target = "_blank";

  if (fields.image) {
    const image = document.createElement("img");
    image.className = "glyphary-rich-link-image";
    image.src = fields.image;
    image.alt = "";
    image.loading = "lazy";
    card.append(image);
  }

  const text = document.createElement("div");
  text.className = "glyphary-rich-link-text";

  const title = document.createElement("div");
  title.className = "glyphary-rich-link-title";
  title.textContent = fields.title || url;
  text.append(title);

  if (fields.description) {
    const description = document.createElement("div");
    description.className = "glyphary-rich-link-description";
    description.textContent = fields.description;
    text.append(description);
  }

  const site = document.createElement("div");
  site.className = "glyphary-rich-link-site";
  site.textContent = fields.siteName || safeHost(url);
  text.append(site);

  card.append(text);
  return card;
}

function safeHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
