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

type Message = {
  id: string;
  type: "customer-message" | "bot-response" | "system-log";
  body: string;
  ts: string;
  metadata?: Record<string, string>;
};

export default function Simulator() {
  const { data: vendors } = useListVendors();
  const vendorList = Array.isArray(vendors)
    ? vendors
    : vendors && Array.isArray((vendors as any).vendors)
    ? (vendors as any).vendors
    : [];
  const send = useSimulateIncomingMessage();
  const customerScrollRef = useRef<HTMLDivElement>(null);
  const vendorScrollRef = useRef<HTMLDivElement>(null);

  const [vendorId, setVendorId] = useState<string>("");
  const [phone, setPhone] = useState("+15550000111");
  const [name, setName] = useState("Test Customer");
  const [body, setBody] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (!vendorId && vendorList.length > 0) {
      setVendorId(vendorList[0]!.id);
    }
  }, [vendorList, vendorId]);

  useEffect(() => {
    if (customerScrollRef.current) {
      customerScrollRef.current.scrollTop = customerScrollRef.current.scrollHeight;
    }
    if (vendorScrollRef.current) {
      vendorScrollRef.current.scrollTop = vendorScrollRef.current.scrollHeight;
    }
  }, [messages]);

  function reset() {
    setMessages([]);
    setConversationId(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || !vendorId) return;
    setBody("");

    // Add customer message to both sides
    const customerMsgId = crypto.randomUUID();
    setMessages((m) => [
      ...m,
      { id: customerMsgId, type: "customer-message", body: text, ts: new Date().toISOString() },
    ]);

    try {
      const res = await send.mutateAsync({
        data: { vendorId, customerPhone: phone, customerName: name, body: text },
      });

      if (res.conversationId) setConversationId(res.conversationId);

      // Add system log for vendor side
      const systemLogId = crypto.randomUUID();
      setMessages((m) => [
        ...m,
        {
          id: systemLogId,
          type: "system-log",
          body: `📨 Message received from ${name}`,
          ts: new Date().toISOString(),
          metadata: { status: "received" },
        },
      ]);

      if (res.botReply) {
        // Add bot response visible to both
        const botReplyId = crypto.randomUUID();
        setMessages((m) => [
          ...m,
          { id: botReplyId, type: "bot-response", body: res.botReply!, ts: new Date().toISOString() },
        ]);
      } else {
        const silentMsgId = crypto.randomUUID();
        setMessages((m) => [
          ...m,
          {
            id: silentMsgId,
            type: "system-log",
            body: "🤐 Bot is silent (vendor took over or bot is disabled)",
            ts: new Date().toISOString(),
            metadata: { status: "silent" },
          },
        ]);
      }
    } catch (err) {
      const errorMsgId = crypto.randomUUID();
      setMessages((m) => [
        ...m,
        {
          id: errorMsgId,
          type: "system-log",
          body: "❌ Error: " + (err instanceof Error ? err.message : "send failed"),
          ts: new Date().toISOString(),
          metadata: { status: "error" },
        },
      ]);
    }
  }

  const selectedVendor = vendorList.find((v: any) => v.id === vendorId);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">WhatsApp Bot Simulator</h1>
        <p className="text-muted-foreground mt-1">See both customer and bot perspectives in real-time.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Left Control Panel */}
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
                  {vendorList.map((v: any) => (
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
              <p>· "I want pizza" — place an order</p>
              <p>· "yes" — confirm order</p>
              <p>· "agent" — hand over to a human</p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" type="button" onClick={reset} className="flex-1">Reset</Button>
              {conversationId && (
                <Link href={`/vendors/${vendorId}/conversations`}>
                  <Button variant="ghost" type="button" size="sm">
                    View Chat <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dual Chat Panes */}
        <div className="grid grid-cols-2 gap-4">
          {/* Customer Side */}
          <Card className="overflow-hidden flex flex-col">
            <CardContent className="p-0 flex flex-col flex-1">
              {/* Header */}
              <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate text-sm">{selectedVendor?.name ?? "No vendor"}</div>
                  <div className="text-xs opacity-75">Online</div>
                </div>
              </div>

              {/* Messages */}
              <div ref={customerScrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#ece5dd]">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-gray-500 text-center px-4">
                    Send a message to start
                  </div>
                ) : (
                  messages.map((m) => {
                    if (m.type === "customer-message") {
                      return (
                        <div key={m.id} className="flex justify-end">
                          <div className="max-w-xs bg-green-100 text-black rounded-lg rounded-tr-none px-3 py-2 text-sm shadow-sm">
                            <p className="whitespace-pre-wrap break-words">{m.body}</p>
                            <div className="text-xs text-gray-600 mt-0.5 text-right">{format(new Date(m.ts), "p")}</div>
                          </div>
                        </div>
                      );
                    }
                    if (m.type === "bot-response") {
                      return (
                        <div key={m.id} className="flex justify-start">
                          <div className="max-w-xs bg-white text-black rounded-lg rounded-tl-none px-3 py-2 text-sm shadow-sm border border-gray-200">
                            <p className="whitespace-pre-wrap break-words">{m.body}</p>
                            <div className="text-xs text-gray-600 mt-0.5">{format(new Date(m.ts), "p")}</div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })
                )}
              </div>

              {/* Input */}
              <form onSubmit={submit} className="border-t border-gray-200 p-3 bg-white flex items-center gap-2">
                <Input
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Type a message..."
                  disabled={!vendorId}
                  className="rounded-full px-4"
                />
                <Button type="submit" disabled={!vendorId || send.isPending} className="rounded-full bg-green-600 hover:bg-green-700 p-2 h-auto w-auto">
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Vendor/Bot Side */}
          <Card className="overflow-hidden flex flex-col">
            <CardContent className="p-0 flex flex-col flex-1">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-lg">🤖</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate text-sm">Bot & Vendor System</div>
                  <div className="text-xs opacity-75">Processing...</div>
                </div>
              </div>

              {/* Messages */}
              <div ref={vendorScrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-gray-500 text-center px-4">
                    System logs appear here
                  </div>
                ) : (
                  messages.map((m) => {
                    if (m.type === "customer-message") {
                      return (
                        <div key={m.id} className="flex justify-start">
                          <div className="max-w-xs bg-gray-200 text-gray-900 rounded-lg rounded-tl-none px-3 py-2 text-sm shadow-sm">
                            <p className="text-xs font-semibold text-gray-600 mb-1">📥 Customer: {name}</p>
                            <p className="whitespace-pre-wrap break-words">{m.body}</p>
                            <div className="text-xs text-gray-600 mt-0.5">{format(new Date(m.ts), "p")}</div>
                          </div>
                        </div>
                      );
                    }
                    if (m.type === "bot-response") {
                      return (
                        <div key={m.id} className="flex justify-end">
                          <div className="max-w-xs bg-blue-100 text-gray-900 rounded-lg rounded-tr-none px-3 py-2 text-sm shadow-sm border border-blue-200">
                            <p className="text-xs font-semibold text-blue-700 mb-1">🤖 Bot Response</p>
                            <p className="whitespace-pre-wrap break-words">{m.body}</p>
                            <div className="text-xs text-gray-600 mt-0.5 text-right">{format(new Date(m.ts), "p")}</div>
                          </div>
                        </div>
                      );
                    }
                    if (m.type === "system-log") {
                      return (
                        <div key={m.id} className="flex justify-center">
                          <div className="max-w-xs bg-amber-100 text-amber-900 rounded-lg px-3 py-2 text-xs shadow-sm border border-amber-200 text-center">
                            <p>{m.body}</p>
                            <div className="text-[10px] text-amber-800 mt-1">{format(new Date(m.ts), "p")}</div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })
                )}
              </div>

              {/* Info Bar */}
              <div className="border-t border-gray-200 p-2 bg-white text-xs text-gray-600 space-y-0.5">
                <p><span className="font-semibold">Vendor:</span> {selectedVendor?.name || "—"}</p>
                <p><span className="font-semibold">Phone:</span> {phone}</p>
                {conversationId && <p><span className="font-semibold">Conversation ID:</span> {conversationId.slice(0, 8)}...</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
