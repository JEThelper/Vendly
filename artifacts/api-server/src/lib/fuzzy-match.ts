import Fuse from "fuse.js";
import { MenuItemRow } from "@workspace/db";
import { logger } from "./logger";

export type MenuMatchResult =
  | { kind: "exact"; item: MenuItemRow }
  | { kind: "unique"; item: MenuItemRow; confidence: number }
  | { kind: "ambiguous"; options: MenuItemRow[]; confidence: number }
  | { kind: "none"; suggestions: MenuItemRow[] };

/**
 * Find best menu item match with disambiguation
 * 
 * Returns:
 * - "exact" if exact match found
 * - "unique" if fuzzy match is confident (>70%)
 * - "ambiguous" if multiple close matches exist
 * - "none" if no match found
 */
export function findBestMenuMatch(
  itemName: string,
  menuItems: MenuItemRow[],
  threshold: number = 0.6,
): MenuMatchResult {
  if (menuItems.length === 0) {
    return { kind: "none", suggestions: [] };
  }

  const itemLower = itemName.toLowerCase().trim();

  // Exact match (case-insensitive)
  const exact = menuItems.find((m) => m.name.toLowerCase() === itemLower);
  if (exact) {
    logger.debug({ itemName, matchedItem: exact.name }, "Exact menu match");
    return { kind: "exact", item: exact };
  }

  // Substring match (high confidence)
  const substring = menuItems.find((m) =>
    m.name.toLowerCase().includes(itemLower),
  );
  if (substring) {
    logger.debug({ itemName, matchedItem: substring.name }, "Substring menu match");
    return { kind: "unique", item: substring, confidence: 0.85 };
  }

  // Fuzzy match using Fuse.js
  const fuse = new Fuse(menuItems, {
    keys: ["name"],
    threshold: 1 - threshold, // Fuse uses distance, not similarity
    includeScore: true,
  });

  const results = fuse.search(itemName);

  if (results.length === 0) {
    logger.debug({ itemName }, "No menu match found, suggesting alternatives");
    // Return first 3 items as suggestions
    return {
      kind: "none",
      suggestions: menuItems.slice(0, 3),
    };
  }

  // Single result
  if (results.length === 1) {
    const confidence = 1 - (results[0].score ?? 1);
    logger.debug(
      { itemName, matchedItem: results[0].item.name, confidence },
      "Fuzzy menu match",
    );
    return { kind: "unique", item: results[0].item, confidence };
  }

  // Multiple results: check if they're too close
  const bestScore = results[0].score ?? 1;
  const closeMatches = results.filter((r) => Math.abs((r.score ?? 1) - bestScore) < 0.05);

  if (closeMatches.length > 1) {
    const confidence = 1 - bestScore;
    logger.debug(
      {
        itemName,
        topMatches: closeMatches.map((m) => m.item.name),
        confidence,
      },
      "Ambiguous menu match",
    );

    // If confidence is low, ask for disambiguation
    if (confidence < 0.7) {
      return {
        kind: "ambiguous",
        options: closeMatches.slice(0, 3).map((m) => m.item),
        confidence,
      };
    }
  }

  // Return best match
  const confidence = 1 - bestScore;
  logger.debug(
    { itemName, matchedItem: results[0].item.name, confidence },
    "Best fuzzy menu match",
  );
  return { kind: "unique", item: results[0].item, confidence };
}
