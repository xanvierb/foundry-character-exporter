import { MODULE_ID } from "../constants.js";

const prefix = `[${MODULE_ID}]`;

function debugEnabled() {
  try {
    return Boolean(globalThis.CONFIG?.debug?.hooks || globalThis.game?.debug);
  } catch {
    return false;
  }
}

export const logger = Object.freeze({
  debug(...args) {
    if (debugEnabled()) console.debug(prefix, ...args);
  },

  info(...args) {
    console.info(prefix, ...args);
  },

  warn(...args) {
    console.warn(prefix, ...args);
  },

  error(...args) {
    console.error(prefix, ...args);
  }
});
