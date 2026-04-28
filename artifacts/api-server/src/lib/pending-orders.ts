import { MenuItemRow } from "@workspace/db";

export type PendingOrder = {
  vendorId: string;
  customerPhone: string;
  item: MenuItemRow;
  quantity: number;
  total: number;
  timestamp: Date;
};

// In-memory store for pending confirmations
// Key: `${vendorId}:${customerPhone}`
const pendingOrders = new Map<string, PendingOrder>();

// Clean up orders older than 15 minutes (customer didn't confirm)
const TIMEOUT_MS = 15 * 60 * 1000;

function getPendingKey(vendorId: string, customerPhone: string): string {
  return `${vendorId}:${customerPhone}`;
}

export function setPendingOrder(order: PendingOrder): void {
  const key = getPendingKey(order.vendorId, order.customerPhone);
  pendingOrders.set(key, order);

  // Auto-cleanup after timeout
  setTimeout(() => {
    if (pendingOrders.get(key) === order) {
      pendingOrders.delete(key);
    }
  }, TIMEOUT_MS);
}

export function getPendingOrder(
  vendorId: string,
  customerPhone: string,
): PendingOrder | undefined {
  return pendingOrders.get(getPendingKey(vendorId, customerPhone));
}

export function clearPendingOrder(
  vendorId: string,
  customerPhone: string,
): void {
  pendingOrders.delete(getPendingKey(vendorId, customerPhone));
}
