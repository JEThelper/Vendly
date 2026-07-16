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
import { ShoppingCart, CheckCircle2, XCircle, Banknote, Flag, AlertCircle, Package } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STATUSES = ["all", "pending", "confirmed", "paid", "rejected", "completed"] as const;
type StatusFilter = (typeof STATUSES)[number];

export default function VendorOrders({ vendorId }: { vendorId: string }) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const params = filter === "all" ? undefined : { status: filter as Exclude<StatusFilter, "all"> };
  const { data: orders, isLoading } = useListVendorOrders(vendorId, params, {
    query: { enabled: !!vendorId, refetchInterval: 5000, queryKey: getListVendorOrdersQueryKey(vendorId, params) },
  });

  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground mt-1">Manage, fulfill, and track incoming requests.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 bg-muted/50 p-1.5 rounded-2xl w-fit">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs uppercase tracking-wider font-bold transition-all duration-300 relative",
              filter === s
                ? "text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {filter === s && (
              <motion.div 
                layoutId="activeTab" 
                className="absolute inset-0 bg-background rounded-xl shadow-sm border border-border/50" 
                style={{ zIndex: -1 }}
              />
            )}
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4 mt-6">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-muted animate-pulse rounded-2xl" />)}
        </div>
      ) : !orders || orders.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="border-dashed border-2 bg-transparent shadow-none mt-6">
            <CardContent className="py-20 flex flex-col items-center text-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2 shadow-inner">
                <ShoppingCart className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold">No orders {filter !== "all" ? `with status "${filter}"` : "found"}</h3>
              <p className="text-muted-foreground max-w-sm">When customers place orders, they will appear here ready for your action.</p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="space-y-4 mt-6">
          <AnimatePresence>
            {orders.map((o, i) => (
              <motion.div
                key={o.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
              >
                <OrderRow order={o} vendorId={vendorId} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
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
      toast({ title: `Order successfully marked as ${status}` });
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="glass-card border-none hover:shadow-md transition-all group overflow-hidden relative">
      {order.status === 'pending' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400"></div>}
      {order.status === 'confirmed' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400"></div>}
      {order.status === 'paid' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-400"></div>}
      
      <CardContent className="p-5 pl-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center font-bold text-foreground">
                {order.customerName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-lg">{order.customerName}</h3>
                  <OrderStatusBadge status={order.status} />
                </div>
                <div className="text-xs font-medium text-muted-foreground mt-0.5">
                  {order.customerPhone} • {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                </div>
              </div>
            </div>
            
            <div className="bg-muted/30 rounded-xl p-3 mt-4 border border-border/50">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                <Package className="w-3 h-3" /> Order Items
              </div>
              <ul className="text-sm space-y-1.5">
                {order.items?.map((it: any, idx: number) => (
                  <li key={idx} className="flex justify-between items-center tabular-nums">
                    <span><span className="font-semibold">{it.quantity}×</span> {it.name}</span>
                    <span className="text-muted-foreground font-medium">{formatCurrency(it.unitPrice * it.quantity, order.currency)}</span>
                  </li>
                ))}
              </ul>
              {order.notes && (
                <div className="mt-3 text-sm flex gap-2 items-start bg-amber-500/10 text-amber-600 dark:text-amber-400 p-2 rounded-lg border border-amber-500/20">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="italic">{order.notes}</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-4 lg:w-48 shrink-0">
            <div className="text-right">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total</div>
              <div className="text-2xl font-black tabular-nums text-primary">{formatCurrency(order.total, order.currency)}</div>
            </div>
            
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              {order.status === "pending" && (
                <>
                  <Button className="w-full shadow-sm hover:shadow-md transition-shadow" onClick={() => setStatus("confirmed")} disabled={busy !== null}>
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Confirm Order
                  </Button>
                  <Button variant="outline" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20" onClick={() => setStatus("rejected")} disabled={busy !== null}>
                    <XCircle className="w-4 h-4 mr-2" /> Reject
                  </Button>
                </>
              )}
              {order.status === "confirmed" && (
                <Button className="w-full shadow-sm hover:shadow-md transition-shadow bg-blue-600 hover:bg-blue-700" onClick={() => setStatus("paid")} disabled={busy !== null}>
                  <Banknote className="w-4 h-4 mr-2" /> Mark as Paid
                </Button>
              )}
              {order.status === "paid" && (
                <Button className="w-full shadow-sm hover:shadow-md transition-shadow bg-emerald-600 hover:bg-emerald-700" onClick={() => setStatus("completed")} disabled={busy !== null}>
                  <Flag className="w-4 h-4 mr-2" /> Complete Order
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
