import { Link } from "wouter";
import { useListVendors } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Phone, Store } from "lucide-react";
import { useState, useMemo } from "react";
import { PlanBadge } from "@/components/plan-badge";
import { formatDistanceToNow } from "date-fns";

export default function VendorsList() {
  const { data, isLoading } = useListVendors();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    const lower = q.trim().toLowerCase();
    if (!lower) return data;
    return data.filter(
      (v) =>
        v.name.toLowerCase().includes(lower) ||
        v.phoneNumber.toLowerCase().includes(lower),
    );
  }, [data, q]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendors</h1>
          <p className="text-muted-foreground mt-1">
            Every business running on the platform.
          </p>
        </div>
        <Link href="/vendors/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New vendor
          </Button>
        </Link>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or number"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasQuery={!!q} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((v) => (
            <Link key={v.id} href={`/vendors/${v.id}`}>
              <Card className="hover-elevate cursor-pointer transition-all border-border">
                <CardContent className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{v.name}</h3>
                      <PlanBadge plan={v.plan} />
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                      <Phone className="w-3 h-3" />
                      {v.phoneNumber}
                    </div>
                    <div className="text-xs text-muted-foreground/70 mt-1">
                      Joined {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    {v.botEnabled ? "bot on" : "bot off"}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-16 flex flex-col items-center text-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Store className="w-5 h-5" />
        </div>
        <h3 className="font-semibold">
          {hasQuery ? "No vendors match that search" : "No vendors yet"}
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {hasQuery
            ? "Try a different name or phone number."
            : "Create your first vendor to start handling WhatsApp orders."}
        </p>
        {!hasQuery && (
          <Link href="/vendors/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Create vendor
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
