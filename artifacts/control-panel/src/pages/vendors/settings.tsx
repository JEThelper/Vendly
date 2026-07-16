import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetVendor,
  useUpdateVendor,
  useDeleteVendor,
  getGetVendorQueryKey,
  getListVendorsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { PlanBadge } from "@/components/plan-badge";
import { Trash2, Save, Building2, Smartphone, Banknote, ShieldAlert, Bot } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function VendorSettings({ vendorId }: { vendorId: string }) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: vendor } = useGetVendor(vendorId, { query: { enabled: !!vendorId, queryKey: getGetVendorQueryKey(vendorId) } });
  const updateVendor = useUpdateVendor();
  const deleteVendor = useDeleteVendor();

  const [form, setForm] = useState({
    name: "",
    phoneNumber: "",
    botNumber: "",
    adminNumber: "",
    phoneNumberId: "",
    plan: "starter" as "starter" | "pro",
    currency: "USD",
    bankName: "",
    bankAccountNumber: "",
    bankAccountHolder: "",
    welcomeMessage: "",
    botEnabled: true,
    requiresDeliveryAddress: true,
    deliveryLocations: "",
    deliveryAvailable: true,
    pickupAvailable: true,
    acceptedPaymentMethods: ["bank_transfer", "cash_on_delivery", "pos"],
  });

  useEffect(() => {
    if (vendor) {
      setForm({
        name: vendor.name || "",
        phoneNumber: vendor.phoneNumber || "",
        botNumber: vendor.botNumber ?? "",
        adminNumber: vendor.adminNumber ?? "",
        phoneNumberId: vendor.phoneNumberId ?? "",
        plan: vendor.plan || "starter",
        currency: vendor.currency || "USD",
        bankName: vendor.bankName ?? "",
        bankAccountNumber: vendor.bankAccountNumber ?? "",
        bankAccountHolder: vendor.bankAccountHolder ?? "",
        welcomeMessage: vendor.welcomeMessage ?? "",
        botEnabled: vendor.botEnabled ?? true,
        requiresDeliveryAddress: vendor.requiresDeliveryAddress ?? true,
        deliveryLocations: vendor.deliveryLocations ? (vendor.deliveryLocations as string[]).join(", ") : "",
        deliveryAvailable: vendor.deliveryAvailable ?? true,
        pickupAvailable: vendor.pickupAvailable ?? true,
        acceptedPaymentMethods: vendor.acceptedPaymentMethods ? (vendor.acceptedPaymentMethods as string[]) : ["bank_transfer", "cash_on_delivery", "pos"],
      });
    }
  }, [vendor?.id]);

  if (!vendor) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-muted animate-pulse rounded-lg" />
        <div className="h-96 bg-muted animate-pulse rounded-2xl" />
      </div>
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      const locations = form.deliveryLocations.split(",").map(s => s.trim()).filter(s => s.length > 0);
      await updateVendor.mutateAsync({
        vendorId,
        data: {
          name: form.name,
          phoneNumber: form.phoneNumber,
          botNumber: form.botNumber,
          adminNumber: form.adminNumber,
          phoneNumberId: form.phoneNumberId,
          plan: form.plan,
          currency: form.currency,
          bankName: form.bankName,
          bankAccountNumber: form.bankAccountNumber,
          bankAccountHolder: form.bankAccountHolder,
          welcomeMessage: form.welcomeMessage,
          botEnabled: form.botEnabled,
          requiresDeliveryAddress: form.requiresDeliveryAddress,
          deliveryLocations: locations,
          deliveryAvailable: form.deliveryAvailable,
          pickupAvailable: form.pickupAvailable,
          acceptedPaymentMethods: form.acceptedPaymentMethods,
        },
      });
      qc.invalidateQueries({ queryKey: getGetVendorQueryKey(vendorId) });
      qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });
      toast({ title: "Settings saved successfully", description: "Your vendor profile has been updated." });
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : "Something went wrong", variant: "destructive" });
    }
  }

  async function handleDelete() {
    if (!confirm(`Are you absolutely sure you want to delete ${vendor!.name}? This action cannot be undone.`)) return;
    await deleteVendor.mutateAsync({ vendorId });
    qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });
    toast({ title: "Vendor deleted" });
    navigate("/vendors");
  }

  const containerVariants: any = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  
  const itemVariants: any = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
  };

  return (
    <motion.div 
      className="max-w-4xl mx-auto space-y-8 pb-12"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tight">Settings</h1>
            <div className="mt-1"><PlanBadge plan={form.plan} /></div>
          </div>
          <p className="text-muted-foreground mt-2 text-lg">Manage your business profile and preferences.</p>
        </div>
        
        <Button 
          onClick={save} 
          disabled={updateVendor.isPending}
          size="lg"
          className="shadow-md hover:shadow-lg transition-all rounded-xl font-bold px-8 hidden sm:flex"
        >
          {updateVendor.isPending ? "Saving..." : <><Save className="w-5 h-5 mr-2" /> Save Changes</>}
        </Button>
      </motion.div>

      <form onSubmit={save} className="space-y-6">
        <motion.div variants={itemVariants}>
          <Card className="glass-card border-none overflow-hidden relative">
            <div className="absolute top-0 right-0 p-12 bg-primary/5 blur-[50px] rounded-full z-0"></div>
            <CardHeader className="relative z-10 pb-2">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Building2 className="w-5 h-5 text-primary" /> Identity
              </CardTitle>
              <CardDescription>Core details about your business</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 relative z-10 mt-4">
              <div className="grid gap-3">
                <Label className="text-sm font-semibold">Business name</Label>
                <Input className="h-12 bg-background/50 border-muted focus-visible:ring-primary rounded-xl" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="grid gap-3">
                  <Label className="text-sm font-semibold">WhatsApp number</Label>
                  <Input className="h-12 bg-background/50 border-muted focus-visible:ring-primary rounded-xl" value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
                </div>
                <div className="grid gap-3">
                  <Label className="text-sm font-semibold">Currency Code</Label>
                  <Input className="h-12 bg-background/50 border-muted focus-visible:ring-primary rounded-xl" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
                </div>
              </div>
              <div className="grid gap-3">
                <Label className="text-sm font-semibold">Welcome message</Label>
                <Textarea className="min-h-[100px] bg-background/50 border-muted focus-visible:ring-primary rounded-xl resize-y" value={form.welcomeMessage} onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })} placeholder="Hi, welcome to our store!" />
              </div>
              
              <div className="flex items-center justify-between p-4 rounded-xl border border-primary/20 bg-primary/5 mt-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 text-primary rounded-lg"><Bot className="w-5 h-5" /></div>
                  <div>
                    <div className="font-bold text-foreground">AI Bot Enabled</div>
                    <div className="text-xs text-muted-foreground font-medium mt-0.5">Let AI automatically handle customer inquiries</div>
                  </div>
                </div>
                <Switch checked={form.botEnabled} onCheckedChange={(v) => setForm({ ...form, botEnabled: v })} className="data-[state=checked]:bg-primary" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-card border-none overflow-hidden relative">
            <CardHeader className="relative z-10 pb-2">
              <CardTitle className="flex items-center gap-2 text-xl">
                Delivery Settings
              </CardTitle>
              <CardDescription>Manage how you deliver orders</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 relative z-10 mt-4">
              <div className="grid gap-3">
                <Label className="text-sm font-semibold">Delivery Locations (comma separated)</Label>
                <Textarea 
                  className="min-h-[80px] bg-background/50 border-muted focus-visible:ring-primary rounded-xl resize-y" 
                  value={form.deliveryLocations} 
                  onChange={(e) => setForm({ ...form, deliveryLocations: e.target.value })} 
                  placeholder="e.g. Downtown, Uptown, Eastside, Westside" 
                />
                <p className="text-xs text-muted-foreground">Customers will see these locations when choosing delivery.</p>
              </div>
              
              <div className="grid gap-6 md:grid-cols-2">
                <div className="flex items-center justify-between p-4 rounded-xl border border-muted bg-background/50 mt-2">
                  <div className="flex flex-col">
                    <div className="font-bold text-foreground text-sm">Delivery Available</div>
                    <div className="text-xs text-muted-foreground font-medium mt-0.5">Allow customers to choose delivery</div>
                  </div>
                  <Switch checked={form.deliveryAvailable} onCheckedChange={(v) => setForm({ ...form, deliveryAvailable: v })} />
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-xl border border-muted bg-background/50 mt-2">
                  <div className="flex flex-col">
                    <div className="font-bold text-foreground text-sm">Pickup Available</div>
                    <div className="text-xs text-muted-foreground font-medium mt-0.5">Allow customers to choose pickup</div>
                  </div>
                  <Switch checked={form.pickupAvailable} onCheckedChange={(v) => setForm({ ...form, pickupAvailable: v })} />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-muted bg-background/50 mt-2">
                <div className="flex flex-col">
                  <div className="font-bold text-foreground text-sm">Require Delivery Address</div>
                  <div className="text-xs text-muted-foreground font-medium mt-0.5">Ask customers for their specific address when ordering</div>
                </div>
                <Switch checked={form.requiresDeliveryAddress} onCheckedChange={(v) => setForm({ ...form, requiresDeliveryAddress: v })} />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="glass-card border-none overflow-hidden relative">
            <CardHeader className="relative z-10 pb-2">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Smartphone className="w-5 h-5 text-blue-500" /> WhatsApp Routing
              </CardTitle>
              <CardDescription>Technical details for Meta API integration</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 relative z-10 mt-4">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="grid gap-3">
                  <Label className="text-sm font-semibold">Bot display number</Label>
                  <Input className="h-12 bg-background/50 border-muted focus-visible:ring-blue-500 rounded-xl" value={form.botNumber} onChange={(e) => setForm({ ...form, botNumber: e.target.value })} placeholder="+15551234567" />
                </div>
                <div className="grid gap-3">
                  <Label className="text-sm font-semibold">Vendor admin number</Label>
                  <Input className="h-12 bg-background/50 border-muted focus-visible:ring-blue-500 rounded-xl" value={form.adminNumber} onChange={(e) => setForm({ ...form, adminNumber: e.target.value })} placeholder="+15558881111" />
                </div>
              </div>
              <div className="grid gap-3">
                <Label className="text-sm font-semibold">Meta phone_number_id</Label>
                <Input className="h-12 bg-background/50 border-muted focus-visible:ring-blue-500 rounded-xl font-mono" value={form.phoneNumberId} onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })} placeholder="100000000000001" />
                <p className="text-xs text-muted-foreground font-medium">Webhooks from Meta are routed to this vendor via this ID.</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          <motion.div variants={itemVariants}>
            <Card className="glass-card border-none overflow-hidden relative h-full">
              <CardHeader className="relative z-10 pb-2">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Banknote className="w-5 h-5 text-emerald-500" /> Bank Details
                </CardTitle>
                <CardDescription>Where funds should be sent</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 relative z-10 mt-4">
                <div className="grid gap-3">
                  <Label className="text-sm font-semibold">Bank name</Label>
                  <Input className="bg-background/50 border-muted focus-visible:ring-emerald-500 rounded-xl" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
                </div>
                <div className="grid gap-3">
                  <Label className="text-sm font-semibold">Account number</Label>
                  <Input className="bg-background/50 border-muted focus-visible:ring-emerald-500 rounded-xl" value={form.bankAccountNumber} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} />
                </div>
                <div className="grid gap-3">
                  <Label className="text-sm font-semibold">Account holder</Label>
                  <Input className="bg-background/50 border-muted focus-visible:ring-emerald-500 rounded-xl" value={form.bankAccountHolder} onChange={(e) => setForm({ ...form, bankAccountHolder: e.target.value })} />
                </div>

                <div className="grid gap-3 pt-2 border-t">
                  <Label className="text-sm font-semibold">Accepted Payment Methods</Label>
                  <div className="flex flex-col gap-3">
                    {[
                      { id: "bank_transfer", label: "Bank Transfer" },
                      { id: "cash_on_delivery", label: "Cash on Delivery" },
                      { id: "pos", label: "POS Terminal" }
                    ].map(method => (
                      <label key={method.id} className="flex items-center gap-3 p-3 rounded-xl border bg-background/50 cursor-pointer hover:bg-muted transition-colors">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500"
                          checked={form.acceptedPaymentMethods.includes(method.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm({ ...form, acceptedPaymentMethods: [...form.acceptedPaymentMethods, method.id] });
                            } else {
                              setForm({ ...form, acceptedPaymentMethods: form.acceptedPaymentMethods.filter(m => m !== method.id) });
                            }
                          }}
                        />
                        <span className="text-sm font-medium">{method.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="glass-card border-none overflow-hidden relative h-full">
              <CardHeader className="relative z-10 pb-2">
                <CardTitle className="flex items-center gap-2 text-xl">
                  Subscriptions
                </CardTitle>
                <CardDescription>Choose the right plan for your business</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 relative z-10 mt-4">
                {(["starter", "pro"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm({ ...form, plan: p })}
                    className={cn(
                      "text-left p-4 rounded-2xl border-2 transition-all relative overflow-hidden group",
                      form.plan === p 
                        ? "border-primary bg-primary/5 shadow-md" 
                        : "border-transparent bg-muted/50 hover:bg-muted"
                    )}
                  >
                    {form.plan === p && <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-bl-full -mr-4 -mt-4 transition-all" />}
                    <div className="flex items-center gap-3 relative z-10">
                      <PlanBadge plan={p} />
                      <span className="font-bold capitalize text-lg">{p}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 font-medium relative z-10">
                      {p === "starter" ? "Essential tools: Bot, menu, orders, manual bank-transfer payments." : "Advanced tools: Analytics, follow-ups, memory, and promotions."}
                    </p>
                  </button>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div variants={itemVariants} className="sm:hidden">
          <Button 
            type="submit" 
            disabled={updateVendor.isPending}
            size="lg"
            className="w-full shadow-md rounded-xl font-bold"
          >
            {updateVendor.isPending ? "Saving..." : <><Save className="w-5 h-5 mr-2" /> Save Changes</>}
          </Button>
        </motion.div>
      </form>

      <motion.div variants={itemVariants} className="pt-8">
        <Card className="border border-destructive/20 bg-destructive/5 overflow-hidden">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" /> Danger Zone
            </CardTitle>
            <CardDescription className="text-destructive/80 font-medium">Permanently delete this vendor and all associated data</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteVendor.isPending} className="font-bold rounded-xl">
              <Trash2 className="w-4 h-4 mr-2" /> Delete Vendor
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
