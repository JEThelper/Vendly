import { useGetVendor, useListVendorPayments } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, cn } from "@/lib/utils";
import { format } from "date-fns";
import { CreditCard } from "lucide-react";

const STATUS_TONE: Record<string, string> = {
  pending: "text-amber-700 dark:text-amber-300",
  confirmed: "text-emerald-700 dark:text-emerald-300",
  failed: "text-rose-700 dark:text-rose-300",
};

export default function VendorPayments({ vendorId }: { vendorId: string }) {
  const { data: vendor } = useGetVendor(vendorId, { query: { enabled: !!vendorId } });
  const { data: payments, isLoading } = useListVendorPayments(vendorId, { query: { enabled: !!vendorId } });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
        <p className="text-muted-foreground mt-1">Bank transfers and other payment records.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : !payments || payments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <CreditCard className="w-5 h-5" />
            </div>
            <h3 className="font-semibold">No payments yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">When orders are paid, the records will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((p) => (
                  <tr key={p.id} className="hover-elevate">
                    <td className="px-4 py-3 font-medium">{p.customerName}</td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{p.method.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{p.reference ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatCurrency(p.amount, vendor?.currency ?? p.currency)}</td>
                    <td className={cn("px-4 py-3 text-xs uppercase font-semibold tracking-wider", STATUS_TONE[p.status])}>{p.status}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{format(new Date(p.createdAt), "MMM d, p")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
