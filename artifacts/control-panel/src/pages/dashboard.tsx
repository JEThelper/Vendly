import React from "react";
import { useGetDashboardSummary, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, ShoppingCart, DollarSign, MessageSquare, Activity, TrendingUp } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: activity, isLoading: isLoadingActivity } = useGetRecentActivity();

  if (isLoadingSummary) {
    return (
      <div className="space-y-8 p-4">
        <div className="h-10 w-64 bg-muted animate-pulse rounded-lg"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-36 bg-muted animate-pulse rounded-2xl"></div>)}
        </div>
      </div>
    );
  }

  if (!summary) return <div>Failed to load dashboard</div>;

  const containerVariants: any = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1, y: 0,
      transition: { type: "spring", stiffness: 100, damping: 15 }
    }
  };

  return (
    <motion.div 
      className="space-y-8 bg-gradient-premium min-h-full p-2 pb-10"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <motion.div variants={itemVariants} className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
            Overview
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">Platform metrics across all vendors.</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div variants={itemVariants}>
          <Card className="glass-card border-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total Vendors</CardTitle>
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <Store className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{summary.totalVendors ?? 0}</div>
              <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground font-medium">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"></span>{summary.proVendors ?? 0} Pro</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(99,102,241,0.8)]"></span>{summary.starterVendors ?? 0} Starter</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-card border-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total Orders</CardTitle>
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-inner">
                <ShoppingCart className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black">{summary.totalOrders ?? 0}</div>
              <div className="flex items-center gap-2 mt-3 text-sm text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 w-max px-2 py-0.5 rounded-full">
                <TrendingUp className="w-3 h-3" />
                <span>{summary.pendingOrders ?? 0} pending</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-card border-none relative overflow-hidden">
            <div className="absolute top-0 right-0 p-10 bg-blue-500/10 blur-[50px] rounded-full"></div>
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total Revenue</CardTitle>
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shadow-inner">
                <DollarSign className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-black">{formatCurrency(summary.revenue, 'USD')}</div>
              <p className="text-sm text-muted-foreground mt-3 font-medium">Across all currencies</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-card border-none relative overflow-hidden">
            <div className="absolute -bottom-4 -right-4 p-8 bg-indigo-500/10 blur-[40px] rounded-full"></div>
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Active Chats</CardTitle>
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shadow-inner">
                <MessageSquare className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-black">{summary.openConversations}</div>
              <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-3 font-medium bg-indigo-500/10 w-max px-2 py-0.5 rounded-full">
                {summary.messagesToday} messages today
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="xl:col-span-2">
          <Card className="glass-card h-full border-none">
            <CardHeader>
              <CardTitle className="text-xl">Revenue by Vendor</CardTitle>
              <CardDescription>Top performing vendors by total revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px] w-full mt-4">
                {summary.revenueByVendor && summary.revenueByVendor.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={summary.revenueByVendor} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.5} />
                      <XAxis dataKey="vendorName" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: 'var(--color-muted-foreground)' }} dy={10} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} tick={{ fill: 'var(--color-muted-foreground)' }} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-background)', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                        formatter={(value: number) => [formatCurrency(value, 'USD'), 'Revenue']}
                        labelStyle={{ fontWeight: 'bold', color: 'var(--color-foreground)', marginBottom: '4px' }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground bg-muted/20 rounded-2xl">
                    No revenue data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-card h-full border-none flex flex-col">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="p-1.5 bg-primary/10 rounded-md text-primary">
                  <Activity className="w-5 h-5" />
                </div>
                Activity Feed
              </CardTitle>
              <CardDescription>Real-time platform events</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {isLoadingActivity ? (
                <div className="space-y-6 mt-2">
                  {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg"></div>)}
                </div>
              ) : Array.isArray(activity) && activity.length > 0 ? (
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent mt-2">
                  {activity.map((item, i) => (
                    <motion.div 
                      key={item.id} 
                      className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                    >
                      <div className={cn(
                        "flex items-center justify-center w-5 h-5 rounded-full border-4 border-background shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm",
                        item.type === 'order' ? 'bg-emerald-500' :
                        item.type === 'payment' ? 'bg-blue-500' :
                        item.type === 'vendor' ? 'bg-primary' :
                        item.type === 'handover' ? 'bg-amber-500' : 'bg-indigo-500'
                      )} />
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-4 rounded-2xl glass-card border-none hover:-translate-y-1 transition-transform">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm">{item.vendorName}</span>
                          <span className="text-xs text-muted-foreground font-medium">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</span>
                        </div>
                        <p className="text-sm text-foreground/80 leading-snug">{item.description}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground bg-muted/20 rounded-2xl">
                  <Activity className="w-8 h-8 mb-3 opacity-20" />
                  <p className="text-sm font-medium">No recent activity</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
