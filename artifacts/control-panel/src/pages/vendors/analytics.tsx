import { useGetVendor, getGetVendorQueryKey, useGetVendorAnalytics, getGetVendorAnalyticsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Sparkles, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, AreaChart, Area } from "recharts";
import { formatCurrency } from "@/lib/utils";

export default function VendorAnalytics({ vendorId }: { vendorId: string }) {
  const { data: vendor } = useGetVendor(vendorId, { query: { queryKey: getGetVendorQueryKey(vendorId), enabled: !!vendorId } });
  const { data, isLoading } = useGetVendorAnalytics(vendorId, { query: { queryKey: getGetVendorAnalyticsQueryKey(vendorId), enabled: !!vendorId } });

  const isPro = vendor?.plan === "pro";

  if (!isPro) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-1">Per-vendor performance trends.</p>
        </div>
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/20 dark:border-amber-900/50">
          <CardContent className="py-12 flex flex-col items-center text-center gap-4">
            <div className="h-14 w-14 rounded-full bg-amber-200 dark:bg-amber-900 flex items-center justify-center text-amber-700 dark:text-amber-300">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold">Analytics is a Pro feature</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Upgrade {vendor?.name} to Pro to unlock daily order and revenue trends, top-selling items, and repeat-customer rate.
            </p>
            <Link href={`/vendors/${vendorId}/settings`}>
              <Button>Upgrade {vendor?.name} to Pro</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="h-72 bg-muted animate-pulse rounded-xl" />
          <div className="h-72 bg-muted animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  const currency = vendor?.currency ?? "USD";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">Last 14 days of activity.</p>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Repeat customer rate</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{Math.round(data.repeatCustomerRate * 100)}%</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Top item</div>
          <div className="text-2xl font-bold mt-1 truncate">{data.topItems[0]?.name ?? "—"}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Orders this period</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{data.dailyOrders.reduce((s, d) => s + d.count, 0)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Revenue this period</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{formatCurrency(data.dailyRevenue.reduce((s, d) => s + d.amount, 0), currency)}</div>
        </CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily orders</CardTitle>
            <CardDescription>Order count per day</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.dailyOrders}>
                <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8 }} />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily revenue</CardTitle>
            <CardDescription>Revenue per day in {currency}</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.dailyRevenue}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} />
                <Tooltip contentStyle={{ borderRadius: 8 }} formatter={(value: number) => [formatCurrency(value, currency), "Revenue"]} />
                <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Top items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.topItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No item sales yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.topItems.map((it) => (
                  <tr key={it.name} className="hover-elevate">
                    <td className="px-4 py-3 font-medium">{it.name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{it.quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatCurrency(it.revenue, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
