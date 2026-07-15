import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  type Order,
  useListVendorOrders,
  useUpdateOrderStatus,
  getListVendorOrdersQueryKey,
  getGetVendorQueryKey,
  getListVendorPaymentsQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OrderStatusBadge } from "@/components/plan-badge";
import { formatCurrency, cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, CheckCircle2, XCircle, Banknote, Flag } from "lucide-react";

const STATUSES = ["all", "pending", "confirmed", "paid", "rejected", "completed"] as const;
type StatusFilter = (typeof STATUSES)[number];

export default function VendorOrders({ vendorId }: { vendorId: string }) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const params = filter === "all" ? undefined : { status: filter as Exclude<StatusFilter, "all"> };
  const { data: orders, isLoading } = useListVendorOrders(vendorId, params, {
    query: { enabled: !!vendorId, refetchInterval: 5000, queryKey: getListVendorOrdersQueryKey(vendorId, params) },
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground mt-1">Confirm, reject, mark paid, or complete orders coming in via chat.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs uppercase tracking-wider font-semibold transition-all",
              filter === s
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : !orders || orders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <h3 className="font-semibold">No orders {filter !== "all" ? `with status "${filter}"` : "yet"}</h3>
            <p className="text-sm text-muted-foreground max-w-sm">When customers place orders via WhatsApp they'll appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <OrderRow key={o.id} order={o} vendorId={vendorId} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderRow({ order, vendorId }: { order: Order; vendorId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const updateStatus = useUpdateOrderStatus();
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(status: "confirmed" | "rejected" | "paid" | "completed") {
    setBusy(status);
    try {
      await updateStatus.mutateAsync({ orderId: order.id, data: { status } });
      qc.invalidateQueries({ queryKey: getListVendorOrdersQueryKey(vendorId) });
      qc.invalidateQueries({ queryKey: getGetVendorQueryKey(vendorId) });
      qc.invalidateQueries({ queryKey: getListVendorPaymentsQueryKey(vendorId) });
      qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      toast({ title: `Order ${status}` });
    } catch (err) {
      toast({ title: "Couldn't update", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{order.customerName}</h3>
              <span className="text-xs text-muted-foreground">{order.customerPhone}</span>
              <OrderStatusBadge status={order.status} />
            </div>
            <ul className="text-sm text-muted-foreground mt-2 space-y-0.5">
              {order.items?.map((it: any, idx: number) => (
                <li key={idx} className="tabular-nums">
                  {it.quantity}× {it.name} <span className="text-muted-foreground/60">— {formatCurrency(it.unitPrice * it.quantity, order.currency)}</span>
                </li>
              ))}
            </ul>
            {order.notes && <p className="text-xs text-muted-foreground/80 mt-2 italic">{order.notes}</p>}
            <div className="text-xs text-muted-foreground/70 mt-2">{formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}</div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-lg font-bold tabular-nums">{formatCurrency(order.total, order.currency)}</div>
            <div className="flex flex-wrap gap-2 justify-end">
              {order.status === "pending" && (
                <>
                  <Button size="sm" onClick={() => setStatus("confirmed")} disabled={busy !== null}>
                    <CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirm
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setStatus("rejected")} disabled={busy !== null}>
                    <XCircle className="w-4 h-4 mr-1.5" /> Reject
                  </Button>
                </>
              )}
              {order.status === "confirmed" && (
                <Button size="sm" onClick={() => setStatus("paid")} disabled={busy !== null}>
                  <Banknote className="w-4 h-4 mr-1.5" /> Mark paid
                </Button>
              )}
              {order.status === "paid" && (
                <Button size="sm" variant="outline" onClick={() => setStatus("completed")} disabled={busy !== null}>
                  <Flag className="w-4 h-4 mr-1.5" /> Complete
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
