import React from "react";
import { Link, useLocation, useParams } from "wouter";
import { 
  LayoutDashboard, Store, Smartphone, Settings,
  MenuSquare, ShoppingCart, MessageSquare, Users, CreditCard, BarChart, ChevronLeft,
  Tag, Megaphone, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetVendor, getGetVendorQueryKey } from "@workspace/api-client-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const params = useParams<{ vendorId?: string }>();
  const isVendorRoute = location.startsWith("/vendors/") && location !== "/vendors/new" && params.vendorId;

  const { data: vendor } = useGetVendor(params.vendorId || "", {
    query: { queryKey: getGetVendorQueryKey(params.vendorId || ""), enabled: !!isVendorRoute }
  });

  const mainNavItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/vendors", label: "Vendors", icon: Store },
    { href: "/simulator", label: "Simulator", icon: Smartphone },
  ];

  const vendorNavItems = [
    { href: `/vendors/${params.vendorId}`, label: "Overview", icon: LayoutDashboard, exact: true },
    { href: `/vendors/${params.vendorId}/menu`, label: "Menu", icon: MenuSquare },
    { href: `/vendors/${params.vendorId}/orders`, label: "Orders", icon: ShoppingCart },
    { href: `/vendors/${params.vendorId}/conversations`, label: "Conversations", icon: MessageSquare },
    { href: `/vendors/${params.vendorId}/customers`, label: "Customers", icon: Users },
    { href: `/vendors/${params.vendorId}/payments`, label: "Payments", icon: CreditCard },
    { href: `/vendors/${params.vendorId}/analytics`, label: "Analytics", icon: BarChart },
    { href: `/vendors/${params.vendorId}/promotions`, label: "Promotions", icon: Tag },
    { href: `/vendors/${params.vendorId}/broadcasts`, label: "Broadcasts", icon: Megaphone },
    { href: `/vendors/${params.vendorId}/settings`, label: "Settings", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground selection:bg-primary/30 font-sans">
      {/* Sidebar */}
      <aside className="w-[280px] border-r border-border/50 bg-sidebar/80 backdrop-blur-2xl flex-shrink-0 flex flex-col shadow-[4px_0_24px_-10px_rgba(0,0,0,0.1)] z-10 relative transition-all">
        <div className="p-6 border-b border-border/50 flex items-center gap-3">
          <div className="bg-gradient-to-br from-primary to-purple-600 p-2.5 rounded-xl text-primary-foreground shadow-lg shadow-primary/20">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <h1 className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
            Vendly Control
          </h1>
        </div>

        {isVendorRoute ? (
          <div className="flex-1 overflow-y-auto flex flex-col custom-scrollbar">
            <div className="p-5 border-b border-border/50 bg-gradient-to-b from-sidebar-accent/30 to-transparent">
              <Link href="/vendors" className="text-xs font-bold text-muted-foreground hover:text-primary flex items-center gap-1 mb-4 transition-colors w-fit">
                <ChevronLeft className="w-3.5 h-3.5" /> Back to Vendors
              </Link>
              {vendor ? (
                <div>
                  <h2 className="font-bold text-lg truncate tracking-tight" title={vendor.name}>{vendor.name}</h2>
                  <div className="flex items-center gap-2.5 mt-2">
                    <span className={cn(
                      "text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-md shadow-sm",
                      vendor.plan === "pro" ? "bg-amber-400 text-amber-950" : "bg-primary/15 text-primary"
                    )}>
                      {vendor.plan}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground truncate">{vendor.phoneNumber}</span>
                  </div>
                </div>
              ) : (
                <div className="animate-pulse space-y-3">
                  <div className="h-6 bg-muted rounded-md w-3/4"></div>
                  <div className="h-4 bg-muted rounded-md w-1/2"></div>
                </div>
              )}
            </div>
            <nav className="p-4 space-y-1.5">
              {vendorNavItems.map((item) => {
                const isActive = item.exact 
                  ? location === item.href 
                  : location.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3.5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 relative group overflow-hidden",
                      isActive
                        ? "text-primary shadow-sm bg-primary/10"
                        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    )}
                  >
                    {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-primary rounded-r-full" />}
                    <item.icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", isActive ? "opacity-100" : "opacity-70")} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        ) : (
          <nav className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar">
            <div className="px-4 mb-3 mt-2 text-[10px] font-black text-muted-foreground/70 uppercase tracking-widest">
              Main Menu
            </div>
            {mainNavItems.map((item) => {
              const isActive = item.href === "/" 
                ? location === item.href 
                : location.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-300 relative group",
                    isActive
                      ? "text-primary shadow-sm bg-primary/10"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  )}
                >
                  {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-primary rounded-r-full" />}
                  <item.icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", isActive ? "opacity-100" : "opacity-70")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-muted/10">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl p-6 lg:p-10">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
