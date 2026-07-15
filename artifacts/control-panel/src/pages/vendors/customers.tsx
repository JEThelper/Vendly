import { useGetVendor, getGetVendorQueryKey, useListVendorCustomers, getListVendorCustomersQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { Users, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function VendorCustomers({ vendorId }: { vendorId: string }) {
  const { data: vendor } = useGetVendor(vendorId, { query: { queryKey: getGetVendorQueryKey(vendorId), enabled: !!vendorId } });
  const { data: customers, isLoading } = useListVendorCustomers(vendorId, { query: { queryKey: getListVendorCustomersQueryKey(vendorId), enabled: !!vendorId } });

  const isPro = vendor?.plan === "pro";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
        <p className="text-muted-foreground mt-1">Customer memory — phones, names, lifetime spend.</p>
      </div>

      {!isPro && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50">
          <CardContent className="py-4 flex items-center gap-3 flex-wrap">
            <div className="h-10 w-10 rounded-full bg-amber-200 dark:bg-amber-900 flex items-center justify-center text-amber-700 dark:text-amber-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <h3 className="font-semibold text-sm">Customer memory is a Pro feature</h3>
              <p className="text-xs text-muted-foreground">Upgrade {vendor?.name} to Pro to unlock the full customer view, follow-ups and promotions.</p>
            </div>
            <Link href={`/vendors/${vendorId}/settings`}>
              <Button size="sm" variant="outline">Upgrade plan</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : !customers || customers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-semibold">No customers yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">As people message this vendor's WhatsApp number, they'll show up here.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3 text-right">Orders</th>
                  <th className="px-4 py-3 text-right">Total spent</th>
                  <th className="px-4 py-3">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {customers.map((c) => (
                  <tr key={c.id} className="hover-elevate">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.phone}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.totalOrders}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatCurrency(c.totalSpent, vendor?.currency ?? "USD")}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{c.lastSeenAt ? format(new Date(c.lastSeenAt), "MMM d, p") : "—"}</td>
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
