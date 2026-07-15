import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetVendor,
  useGetVendorMenu,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
  getGetVendorMenuQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Pencil, MenuSquare } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  category?: string | null;
  available: boolean;
}

export default function VendorMenu({ vendorId }: { vendorId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: vendor } = useGetVendor(vendorId, { query: { enabled: !!vendorId, queryKey: ["vendor", vendorId] } });
  const { data: items, isLoading } = useGetVendorMenu(vendorId, { query: { enabled: !!vendorId, queryKey: ["vendorMenu", vendorId] } });

  const updateItem = useUpdateMenuItem();
  const deleteItem = useDeleteMenuItem();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);

  const currency = vendor?.currency ?? "USD";

  const grouped = (items ?? []).reduce<Record<string, NonNullable<typeof items>>>((acc, it) => {
    const cat = it.category || "Uncategorized";
    acc[cat] ??= [];
    acc[cat].push(it);
    return acc;
  }, {});

  function invalidate() {
    qc.invalidateQueries({ queryKey: getGetVendorMenuQueryKey(vendorId) });
  }

  async function toggleAvailable(item: MenuItem) {
    await updateItem.mutateAsync({ itemId: item.id, data: { available: !item.available } });
    invalidate();
  }

  async function handleDelete(item: MenuItem) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    await deleteItem.mutateAsync({ itemId: item.id });
    invalidate();
    toast({ title: "Item deleted" });
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Menu</h1>
          <p className="text-muted-foreground mt-1">What customers can order over WhatsApp.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="w-4 h-4 mr-2" /> Add item
            </Button>
          </DialogTrigger>
          <ItemDialog vendorId={vendorId} editing={editing} onClose={() => { setOpen(false); setEditing(null); invalidate(); }} />
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : !items || items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <MenuSquare className="w-5 h-5" />
            </div>
            <h3 className="font-semibold">No menu items yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">Add items so the bot can show them and accept orders.</p>
            <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" /> Add first item</Button>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([cat, list]) => (
          <Card key={cat}>
            <CardHeader>
              <CardTitle className="text-base">{cat}</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              {list.map((item) => (
                <div key={item.id} className="py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-medium ${item.available ? "" : "text-muted-foreground line-through"}`}>{item.name}</h3>
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(item.price, currency)}</span>
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                    )}
                  </div>
                  <Switch checked={item.available} onCheckedChange={() => toggleAvailable(item)} />
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(item); setOpen(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(item)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function ItemDialog({
  vendorId,
  editing,
  onClose,
}: {
  vendorId: string;
  editing: MenuItem | null;
  onClose: () => void;
}) {
  const create = useCreateMenuItem();
  const update = useUpdateMenuItem();
  const { toast } = useToast();

  const [name, setName] = useState(editing?.name ?? "");
  const [price, setPrice] = useState(editing?.price.toString() ?? "");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const priceNum = parseFloat(price);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      toast({ title: "Price must be a non-negative number", variant: "destructive" });
      return;
    }
    try {
      if (editing) {
        await update.mutateAsync({
          itemId: editing.id,
          data: { name, price: priceNum, category: category || undefined, description: description || undefined },
        });
        toast({ title: "Item updated" });
      } else {
        await create.mutateAsync({
          vendorId,
          data: { name, price: priceNum, category: category || undefined, description: description || undefined, available: true },
        });
        toast({ title: "Item added" });
      }
      onClose();
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit item" : "New menu item"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="i-name">Name</Label>
          <Input id="i-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-2 grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="i-price">Price</Label>
            <Input id="i-price" required value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" step="0.01" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="i-cat">Category</Label>
            <Input id="i-cat" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Mains" />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="i-desc">Description</Label>
          <Textarea id="i-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? "Saving..." : editing ? "Save changes" : "Add item"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
