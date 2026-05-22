import { useGetVendor, useListVendorOrders, useListVendorConversations, getGetVendorQueryKey, getListVendorOrdersQueryKey, getListVendorConversationsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { formatCurrency } from "@/lib/utils";
import { OrderStatusBadge, ConvoStatusBadge } from "@/components/plan-badge";
import { ShoppingCart, Users, MenuSquare, MessageSquare, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function VendorOverview({ vendorId }: { vendorId: string }) {
  const { data: vendor, isLoading } = useGetVendor(vendorId, {
    query: { enabled: !!vendorId, refetchInterval: 6000, queryKey: getGetVendorQueryKey(vendorId) },
  });
  const { data: orders } = useListVendorOrders(vendorId, undefined, {
    query: { enabled: !!vendorId, queryKey: getListVendorOrdersQueryKey(vendorId) },
  });
  const { data: conversations } = useListVendorConversations(vendorId, {
    query: { enabled: !!vendorId, queryKey: getListVendorConversationsQueryKey(vendorId) },
  });

  if (isLoading || !vendor) return <PageSkeleton />;

  const stats = vendor.stats;
  const recentOrders = (orders ?? []).slice(0, 5);
  const recentConvos = (conversations ?? []).slice(0, 5);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{vendor.name}</h1>
        <p className="text-muted-foreground mt-1">
          {vendor.phoneNumber} · {vendor.currency} · bot {vendor.botEnabled ? "on" : "off"}
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatCard label="Revenue" value={formatCurrency(stats.revenue, vendor.currency)} />
        <StatCard label="Orders" value={stats.totalOrders} sub={`${stats.pendingOrders} pending`} />
        <StatCard label="Menu items" value={stats.menuItems} />
        <StatCard label="Customers" value={stats.customers} sub={`${stats.openConversations} open chats`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base"><ShoppingCart className="w-4 h-4" /> Recent orders</CardTitle>
            <Link href={`/vendors/${vendorId}/orders`} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <Empty icon={<ShoppingCart className="w-4 h-4" />} text="No orders yet" />
            ) : (
              <ul className="divide-y divide-border">
                {recentOrders.map((o) => (
                  <li key={o.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{o.customerName}</div>
                      <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(o.createdAt), { addSuffix: true })}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(o.total, o.currency)}</span>
                      <OrderStatusBadge status={o.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="w-4 h-4" /> Recent chats</CardTitle>
            <Link href={`/vendors/${vendorId}/conversations`} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></Link>
          </CardHeader>
          <CardContent>
            {recentConvos.length === 0 ? (
              <Empty icon={<MessageSquare className="w-4 h-4" />} text="No conversations yet" />
            ) : (
              <ul className="divide-y divide-border">
                {recentConvos.map((c) => (
                  <li key={c.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{c.customerName}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.lastMessagePreview}</div>
                    </div>
                    <ConvoStatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <ActionLink href={`/vendors/${vendorId}/menu`} icon={<MenuSquare className="w-4 h-4" />} label="Edit menu" />
          <ActionLink href={`/vendors/${vendorId}/orders`} icon={<ShoppingCart className="w-4 h-4" />} label="Manage orders" />
          <ActionLink href={`/vendors/${vendorId}/conversations`} icon={<MessageSquare className="w-4 h-4" />} label="Open chats" />
          <ActionLink href={`/vendors/${vendorId}/customers`} icon={<Users className="w-4 h-4" />} label="See customers" />
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="text-center py-6 text-sm text-muted-foreground flex flex-col items-center gap-2">
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">{icon}</div>
      {text}
    </div>
  );
}

function ActionLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-3 py-2.5 rounded-md border border-border hover-elevate transition-all">
      <div className="text-primary">{icon}</div>
      <span className="text-sm font-medium">{label}</span>
      <ArrowRight className="w-3 h-3 ml-auto text-muted-foreground" />
    </Link>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-64 bg-muted animate-pulse rounded" />
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    </div>
  );
}
