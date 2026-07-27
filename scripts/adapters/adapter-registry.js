export class AdapterRegistry {
  #entries = new Map();

  register(id, adapter, { priority = 0, replace = false } = {}) {
    if (typeof id !== "string" || !/^[a-z0-9][a-z0-9._-]*$/u.test(id)) {
      throw new TypeError("Adapter id must contain only lowercase letters, digits, dots, underscores, and hyphens");
    }
    if (!adapter || typeof adapter.supports !== "function" || typeof adapter.convert !== "function") {
      throw new TypeError(`Adapter "${id}" must implement supports(actor) and convert(actor)`);
    }
    if (this.#entries.has(id) && !replace) throw new Error(`Adapter "${id}" is already registered`);
    this.#entries.set(id, { id, adapter, priority: Number(priority) || 0 });
    return adapter;
  }

  unregister(id) {
    return this.#entries.delete(id);
  }

  getAdapter(actor) {
    const entries = [...this.#entries.values()].sort((a, b) => b.priority - a.priority);
    for (const { adapter } of entries) {
      try {
        if (adapter.supports(actor)) return adapter;
      } catch {
        // A faulty third-party adapter must not prevent later adapters from being considered.
      }
    }
    return null;
  }

  getAdapters() {
    return [...this.#entries.values()]
      .sort((a, b) => b.priority - a.priority)
      .map(({ id, adapter, priority }) => ({ id, adapter, priority }));
  }
}
