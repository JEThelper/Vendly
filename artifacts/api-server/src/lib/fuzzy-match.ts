import Fuse from "fuse.js";
import { MenuItemRow } from "@workspace/db";

export function findBestMenuMatch(
  itemName: string,
  menuItems: MenuItemRow[],
  threshold: number = 0.6,
): MenuItemRow | null {
  if (menuItems.length === 0) return null;

  const itemLower = itemName.toLowerCase().trim();

  // Exact match (case-insensitive)
  const exact = menuItems.find((m) => m.name.toLowerCase() === itemLower);
  if (exact) return exact;

  // Substring match
  const substring = menuItems.find((m) =>
    m.name.toLowerCase().includes(itemLower),
  );
  if (substring) return substring;

  // Fuzzy match using Fuse.js
  const fuse = new Fuse(menuItems, {
    keys: ["name"],
    threshold: 1 - threshold, // Fuse uses distance, not similarity
    includeScore: true,
  });

  const results = fuse.search(itemName);
  if (results.length > 0) {
    return results[0].item;
  }

  return null;
}
