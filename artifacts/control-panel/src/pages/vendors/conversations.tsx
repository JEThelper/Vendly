import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListVendorConversations,
  useGetConversation,
  useUpdateConversation,
  useSendMessage,
  getListVendorConversationsQueryKey,
  getGetConversationQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConvoStatusBadge } from "@/components/plan-badge";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { Send, Bot, User, MessageSquare, Hand, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function VendorConversations({ vendorId }: { vendorId: string }) {
  const { data: conversations, isLoading } = useListVendorConversations(vendorId, {
    query: { queryKey: getListVendorConversationsQueryKey(vendorId), enabled: !!vendorId, refetchInterval: 4000 },
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeId && conversations && conversations.length > 0) {
      setActiveId(conversations[0]!.id);
    }
  }, [conversations, activeId]);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Conversations</h1>
        <p className="text-muted-foreground mt-1">Watch the bot, or take over manually when a customer needs a human.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-220px)] min-h-[500px]">
        <Card className="overflow-hidden flex flex-col">
          <CardContent className="p-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />)}
              </div>
            ) : !conversations || conversations.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <MessageSquare className="w-6 h-6 text-muted-foreground/50" />
                No conversations yet
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => setActiveId(c.id)}
                      className={cn(
                        "w-full text-left p-3 hover-elevate transition-all",
                        activeId === c.id && "bg-muted",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">{c.customerName}</span>
                        {c.unreadCount > 0 && (
                          <span className="text-[10px] font-bold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">{c.unreadCount}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMessagePreview}</div>
                      <div className="flex items-center justify-between mt-1.5">
                        <ConvoStatusBadge status={c.status} />
                        <span className="text-[10px] text-muted-foreground/70">{formatDistanceToNow(new Date(c.lastMessageAt), { addSuffix: true })}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden flex flex-col">
          {activeId ? (
            <ConversationThread conversationId={activeId} vendorId={vendorId} />
          ) : (
            <CardContent className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              Pick a conversation to read it.
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

function ConversationThread({ conversationId, vendorId }: { conversationId: string; vendorId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useGetConversation(conversationId, {
    query: { queryKey: getGetConversationQueryKey(conversationId), enabled: !!conversationId, refetchInterval: 3000 },
  });
  const updateConv = useUpdateConversation();
  const sendMessage = useSendMessage();
  const [body, setBody] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data?.messages?.length]);

  // Mark as read when opened
  useEffect(() => {
    if (data && data.unreadCount > 0) {
      updateConv.mutate(
        { conversationId, data: { markRead: true } },
        {
          onSuccess: () => {
            qc.invalidateQueries({ queryKey: getListVendorConversationsQueryKey(vendorId) });
          },
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, data?.id]);

  async function setStatus(status: "bot" | "human" | "closed") {
    await updateConv.mutateAsync({ conversationId, data: { status } });
    qc.invalidateQueries({ queryKey: getGetConversationQueryKey(conversationId) });
    qc.invalidateQueries({ queryKey: getListVendorConversationsQueryKey(vendorId) });
    toast({ title: `Conversation set to ${status}` });
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBody("");
    try {
      await sendMessage.mutateAsync({ conversationId, data: { body: text, sender: "vendor" } });
      qc.invalidateQueries({ queryKey: getGetConversationQueryKey(conversationId) });
      qc.invalidateQueries({ queryKey: getListVendorConversationsQueryKey(vendorId) });
    } catch (err) {
      toast({ title: "Send failed", description: err instanceof Error ? err.message : "", variant: "destructive" });
      setBody(text);
    }
  }

  if (isLoading || !data) {
    return <CardContent className="flex-1 animate-pulse" />;
  }

  return (
    <>
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{data.customerName}</h3>
            <ConvoStatusBadge status={data.status} />
          </div>
          <div className="text-xs text-muted-foreground">{data.customerPhone}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.status !== "bot" && (
            <Button size="sm" variant="outline" onClick={() => setStatus("bot")}>
              <Bot className="w-3.5 h-3.5 mr-1.5" /> Hand back to bot
            </Button>
          )}
          {data.status !== "human" && (
            <Button size="sm" variant="outline" onClick={() => setStatus("human")}>
              <Hand className="w-3.5 h-3.5 mr-1.5" /> Take over
            </Button>
          )}
          {data.status !== "closed" && (
            <Button size="sm" variant="ghost" onClick={() => setStatus("closed")}>
              <Lock className="w-3.5 h-3.5 mr-1.5" /> Close
            </Button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/30">
        {data.messages.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-8">No messages yet.</div>
        ) : (
          data.messages.map((m) => (
            <MessageBubble key={m.id} sender={m.sender} direction={m.direction} body={m.body} createdAt={m.createdAt} />
          ))
        )}
      </div>

      <form onSubmit={send} className="border-t border-border p-3 flex items-center gap-2 bg-background">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={data.status === "bot" ? "Take over to reply, or send anyway..." : "Type a message"}
        />
        <Button type="submit" disabled={sendMessage.isPending}>
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </>
  );
}

function MessageBubble({ sender, direction, body, createdAt }: { sender: string; direction: string; body: string; createdAt: string }) {
  const incoming = direction === "in";
  const isCustomer = sender === "customer";
  const isBot = sender === "bot";

  return (
    <div className={cn("flex gap-2", incoming ? "justify-start" : "justify-end")}>
      {incoming && (
        <div className="w-7 h-7 rounded-full bg-muted flex-shrink-0 flex items-center justify-center text-muted-foreground">
          <User className="w-3.5 h-3.5" />
        </div>
      )}
      <div className="max-w-[75%]">
        <div className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground mb-1 px-1">
          {isCustomer ? "Customer" : isBot ? "Bot" : sender}
        </div>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words shadow-sm",
            incoming
              ? "bg-card border border-border text-card-foreground rounded-bl-sm"
              : isBot
                ? "bg-primary/10 text-foreground border border-primary/20 rounded-br-sm"
                : "bg-foreground text-background rounded-br-sm",
          )}
        >
          {body}
        </div>
        <div className="text-[10px] text-muted-foreground/70 mt-1 px-1">
          {format(new Date(createdAt), "MMM d, p")}
        </div>
      </div>
      {!incoming && (
        <div className={cn("w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center", isBot ? "bg-primary/10 text-primary" : "bg-foreground text-background")}>
          {isBot ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
        </div>
      )}
    </div>
  );
}
