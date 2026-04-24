import { cn } from "@/lib/utils";

export function PlanBadge({ plan, className }: { plan: "starter" | "pro"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-sm",
        plan === "pro"
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 ring-1 ring-amber-200 dark:ring-amber-900/50"
          : "bg-primary/10 text-primary ring-1 ring-primary/20",
        className,
      )}
    >
      {plan}
    </span>
  );
}

const ORDER_TONES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-900/50",
  confirmed: "bg-blue-100 text-blue-800 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-900/50",
  paid: "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-900/50",
  rejected: "bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-900/50",
  completed: "bg-violet-100 text-violet-800 ring-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:ring-violet-900/50",
};

export function OrderStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full ring-1",
        ORDER_TONES[status] ?? "bg-muted text-muted-foreground ring-border",
        className,
      )}
    >
      {status}
    </span>
  );
}

const CONVO_TONES: Record<string, string> = {
  bot: "bg-primary/10 text-primary ring-primary/20",
  human: "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-900/50",
  closed: "bg-muted text-muted-foreground ring-border",
};

export function ConvoStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full ring-1",
        CONVO_TONES[status] ?? "bg-muted text-muted-foreground ring-border",
        className,
      )}
    >
      {status === "bot" ? "auto" : status}
    </span>
  );
}
