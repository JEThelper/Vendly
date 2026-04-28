import React from "react";
import { useGetDashboardSummary, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, ShoppingCart, DollarSign, MessageSquare, Activity } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: activity, isLoading: isLoadingActivity } = useGetRecentActivity();

  if (isLoadingSummary) {
    return <div className="space-y-6">
      <div className="h-8 w-48 bg-muted animate-pulse rounded"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl"></div>)}
      </div>
    </div>;
  }

  if (!summary) return <div>Failed to load dashboard</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Platform overview across all vendors.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Vendors</CardTitle>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Store className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalVendors ?? 0}</div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>{summary.proVendors ?? 0} Pro</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary"></span>{summary.starterVendors ?? 0} Starter</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalOrders ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.pendingOrders ?? 0} pending
            </p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.revenue, 'USD')}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all currencies</p>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Chats</CardTitle>
            <div className="h-8 w-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-600">
              <MessageSquare className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.openConversations}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.messagesToday} messages today
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border shadow-sm">
          <CardHeader>
            <CardTitle>Revenue by Vendor</CardTitle>
            <CardDescription>Top performing vendors by total revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {summary.revenueByVendor && summary.revenueByVendor.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.revenueByVendor} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="vendorName" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                    <RechartsTooltip 
                      cursor={{fill: 'var(--color-muted)', opacity: 0.4}}
                      contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)' }}
                      formatter={(value: number) => [formatCurrency(value, 'USD'), 'Revenue']}
                    />
                    <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                      {summary.revenueByVendor.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill="var(--color-primary)" opacity={0.8 + (index % 3)*0.1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
                  No revenue data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Activity Feed
            </CardTitle>
            <CardDescription>Recent platform events</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingActivity ? (
              <div className="space-y-4">
                {[1,2,3,4].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded"></div>)}
              </div>
            ) : Array.isArray(activity) && activity.length > 0 ? (
              <div className="space-y-4">
                {activity.map((item) => (
                  <div key={item.id} className="flex gap-3 text-sm">
                    <div className={cn(
                      "w-2 h-2 mt-1.5 rounded-full flex-shrink-0",
                      item.type === 'order' ? 'bg-emerald-500' :
                      item.type === 'payment' ? 'bg-blue-500' :
                      item.type === 'vendor' ? 'bg-primary' :
                      item.type === 'handover' ? 'bg-amber-500' : 'bg-indigo-500'
                    )} />
                    <div>
                      <p className="text-foreground">
                        <span className="font-medium">{item.vendorName}</span>: {item.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No recent activity
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
