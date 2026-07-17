// Simple in‑memory cache for menu items per vendor
// Used by src/lib/bot.ts via `import { menuCache } from "@workspace/db/src/cache"`.
// It stores an array of MenuItemRow for each vendor ID.
// The cache is deliberately lightweight – a Map keyed by vendor ID.
// No expiration logic is added; cache is cleared only when the process restarts
// or when the developer manually calls `menuCache.clear()`.

export interface MenuCache {
  get(vendorId: string): any | undefined;
  set(vendorId: string, items: any): void;
  clear(): void;
}

const _cache = new Map<string, any>();

export const menuCache: MenuCache = {
  get(vendorId: string) {
    return _cache.get(vendorId);
  },
  set(vendorId: string, items: any) {
    _cache.set(vendorId, items);
  },
  clear() {
    _cache.clear();
  },
};
