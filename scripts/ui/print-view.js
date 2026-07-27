import { localize } from "../foundry/compatibility.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stylesheetLinks(paths, baseUri) {
  return paths.map(path => {
    const href = new URL(path, baseUri).href;
    return `<link rel="stylesheet" href="${escapeHtml(href)}">`;
  }).join("\n");
}

const SHELL_STYLE = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  body { background: #d9d9d9; color: #202020; }
  .character-exporter-controls {
    position: sticky; top: 0; z-index: 10000; display: flex; justify-content: flex-end; gap: .6rem;
    padding: .65rem max(1rem, calc((100vw - 210mm) / 2)); background: #20252b; color: #fff;
    box-shadow: 0 2px 8px rgb(0 0 0 / 28%); font: 600 14px/1.2 system-ui, sans-serif;
  }
  .character-exporter-controls button {
    min-width: 7rem; border: 1px solid #fff8; border-radius: .25rem; padding: .55rem .9rem;
    background: #f7f7f7; color: #17191c; font: inherit; cursor: pointer;
  }
  .character-exporter-controls button:hover { background: #fff; }
  .character-exporter-document { width: 210mm; min-height: 297mm; margin: 8mm auto; background: #fff; }
  .character-exporter-status {
    width: min(34rem, calc(100% - 2rem)); margin: 20vh auto; border: 1px solid #bbb; border-radius: .4rem;
    padding: 2rem; background: #fff; font: 16px/1.5 system-ui, sans-serif; text-align: center;
  }
  .character-exporter-status h1 { margin-top: 0; font-size: 1.3rem; }
  @media (max-width: 850px) {
    .character-exporter-document { width: 100%; margin: 0; }
    .character-exporter-controls { padding-inline: .7rem; }
  }
  @media print {
    body { background: #fff !important; }
    .character-exporter-controls { display: none !important; }
    .character-exporter-document { width: auto; min-height: 0; margin: 0; box-shadow: none; }
  }
`;

export class PrintView {
  #baseUri;

  constructor(baseUri = globalThis.document?.baseURI ?? globalThis.location?.href) {
    this.#baseUri = baseUri;
  }

  showLoading(targetWindow, characterName) {
    const title = localize("CHARACTER-EXPORTER.PrintView.LoadingTitle", "Preparing character sheet");
    const message = localize("CHARACTER-EXPORTER.PrintView.Loading", "Rendering the printable view…");
    this.#write(targetWindow, `
      <section class="character-exporter-status" role="status">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(characterName)}</p>
        <p>${escapeHtml(message)}</p>
      </section>
    `, { title: `${characterName} — ${title}` });
  }

  render(targetWindow, rendered, characterName) {
    const printLabel = localize("CHARACTER-EXPORTER.PrintView.Print", "Print");
    const closeLabel = localize("CHARACTER-EXPORTER.PrintView.Close", "Close");
    const controls = `
      <nav class="character-exporter-controls" aria-label="${escapeHtml(localize(
        "CHARACTER-EXPORTER.PrintView.Controls", "Print controls"
      ))}">
        <button type="button" data-action="print">${escapeHtml(printLabel)}</button>
        <button type="button" data-action="close">${escapeHtml(closeLabel)}</button>
      </nav>
    `;
    this.#write(targetWindow, `${controls}<main class="character-exporter-document">${rendered.html}</main>`, {
      title: `${characterName} — ${localize("CHARACTER-EXPORTER.PrintView.TitleSuffix", "Character Sheet")}`,
      stylesheets: rendered.stylesheets
    });

    targetWindow.document.querySelector('[data-action="print"]')?.addEventListener("click", () => targetWindow.print());
    targetWindow.document.querySelector('[data-action="close"]')?.addEventListener("click", () => targetWindow.close());
  }

  showError(targetWindow, message) {
    const title = localize("CHARACTER-EXPORTER.PrintView.ErrorTitle", "Export failed");
    this.#write(targetWindow, `
      <section class="character-exporter-status" role="alert">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(message)}</p>
        <button type="button" data-action="close">${escapeHtml(
          localize("CHARACTER-EXPORTER.PrintView.Close", "Close")
        )}</button>
      </section>
    `, { title });
    targetWindow.document.querySelector('[data-action="close"]')?.addEventListener("click", () => targetWindow.close());
  }

  #write(targetWindow, body, { title, stylesheets = [] }) {
    if (!targetWindow || targetWindow.closed) throw new Error("The print window is not available");
    const base = new URL(this.#baseUri, globalThis.location?.href).href;
    const documentHtml = `<!doctype html>
      <html lang="${escapeHtml(globalThis.document?.documentElement?.lang || "en")}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <base href="${escapeHtml(base)}">
        <title>${escapeHtml(title)}</title>
        <style>${SHELL_STYLE}</style>
        ${stylesheetLinks(stylesheets, base)}
      </head>
      <body>${body}</body>
      </html>`;
    targetWindow.document.open();
    targetWindow.document.write(documentHtml);
    targetWindow.document.close();
    try {
      targetWindow.opener = null;
    } catch {
      // Some browsers expose opener as read-only. The page contains no executable template JavaScript.
    }
  }
}
