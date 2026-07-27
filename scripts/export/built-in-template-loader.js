import { MODULE_ID } from "../constants.js";

/** Resolve relative assets from a bundled template's own metadata directory. */
export function resolveBuiltInTemplateAssets(metadata, metadataPath, sourceModule = MODULE_ID) {
  const base = String(metadataPath).slice(0, String(metadataPath).lastIndexOf("/"));
  const resolve = path => {
    const value = String(path ?? "");
    return value.startsWith("modules/") || value.startsWith("systems/") ? value : `${base}/${value}`;
  };
  const stylesheets = metadata.stylesheets ?? (metadata.stylesheet ? [metadata.stylesheet] : []);
  return {
    ...metadata,
    template: resolve(metadata.template),
    stylesheets: stylesheets.map(resolve),
    sourceModule
  };
}

/** Fetch and normalize one metadata file distributed with this module. */
export async function loadBuiltInTemplate(metadataPath, fetcher = globalThis.fetch) {
  if (typeof fetcher !== "function") throw new Error("Fetch is not available");
  const response = await fetcher(metadataPath);
  if (!response?.ok) {
    throw new Error(`Unable to load built-in template metadata at ${metadataPath} (${response?.status ?? "unknown"})`);
  }
  return resolveBuiltInTemplateAssets(await response.json(), metadataPath);
}
