import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import {
  useListVendors,
  useSimulateIncomingMessage,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Smartphone, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Bubble = {
  id: string;
  side: "out" | "in";
  body: string;
  ts: string;
};

export default function Simulator() {
  const { data: vendors } = useListVendors();
  const send = useSimulateIncomingMessage();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [vendorId, setVendorId] = useState<string>("");
  const [phone, setPhone] = useState("+15550000111");
  const [name, setName] = useState("Test Customer");
  const [body, setBody] = useState("");
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (!vendorId && vendors && vendors.length > 0) {
      setVendorId(vendors[0]!.id);
    }
  }, [vendors, vendorId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [bubbles]);

  function reset() {
    setBubbles([]);
    setConversationId(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || !vendorId) return;
    setBody("");
    const out: Bubble = { id: crypto.randomUUID(), side: "out", body: text, ts: new Date().toISOString() };
    setBubbles((b) => [...b, out]);
    try {
      const res = await send.mutateAsync({
        data: { vendorId, customerPhone: phone, customerName: name, body: text },
      });
      if (res.conversationId) setConversationId(res.conversationId);
      if (res.botReply) {
        setBubbles((b) => [
          ...b,
          { id: crypto.randomUUID(), side: "in", body: res.botReply!, ts: new Date().toISOString() },
        ]);
      } else {
        setBubbles((b) => [
          ...b,
          { id: crypto.randomUUID(), side: "in", body: "(bot is silent — vendor took over or bot is disabled)", ts: new Date().toISOString() },
        ]);
      }
    } catch (err) {
      setBubbles((b) => [
        ...b,
        { id: crypto.randomUUID(), side: "in", body: "Error: " + (err instanceof Error ? err.message : "send failed"), ts: new Date().toISOString() },
      ]);
    }
  }

  const selectedVendor = vendors?.find((v) => v.id === vendorId);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">WhatsApp Simulator</h1>
        <p className="text-muted-foreground mt-1">QA the bot end-to-end without a real phone.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session</CardTitle>
            <CardDescription>Pick a vendor and pretend to be a customer.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label>Vendor</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger><SelectValue placeholder="Choose a vendor" /></SelectTrigger>
                <SelectContent>
                  {vendors?.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name} ({v.plan})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Customer phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Customer name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
              <p className="font-semibold uppercase tracking-wider">Try saying</p>
              <p>· "hi" — get welcomed</p>
              <p>· "menu" — see the menu</p>
              <p>· "order Margherita x2" — place an order</p>
              <p>· "paid" — confirm payment after vendor confirms</p>
              <p>· "agent" — hand over to a human</p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" type="button" onClick={reset} className="flex-1">Reset session</Button>
              {conversationId && (
                <Link href={`/vendors/${vendorId}/conversations`}>
                  <Button variant="ghost" type="button">
                    Open chat <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-foreground text-background px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-background/10 flex items-center justify-center">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{selectedVendor?.name ?? "No vendor selected"}</div>
                <div className="text-xs opacity-70 truncate">{selectedVendor?.phoneNumber ?? ""}</div>
              </div>
            </div>
            <div ref={scrollRef} className="bg-muted/40 h-[480px] overflow-y-auto p-4 space-y-3">
              {bubbles.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground text-center px-8">
                  Say hi to start the conversation. The bot's reply will appear here.
                </div>
              ) : (
                bubbles.map((b) => (
                  <div key={b.id} className={cn("flex", b.side === "out" ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[75%]", b.side === "out" ? "items-end" : "items-start")}>
                      <div
                        className={cn(
                          "rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap shadow-sm",
                          b.side === "out"
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-card border border-border text-card-foreground rounded-bl-sm",
                        )}
                      >
                        {b.body}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1 px-1">{format(new Date(b.ts), "p")}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={submit} className="border-t border-border p-3 flex items-center gap-2 bg-background">
              <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type a customer message..." disabled={!vendorId} />
              <Button type="submit" disabled={!vendorId || send.isPending}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
