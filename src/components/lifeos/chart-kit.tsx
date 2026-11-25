import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

/** Shared chart pieces: the Board and the habit dashboards draw with the same axis, tooltip and sizing (v2.2). */

export const AXIS = { fill: "var(--color-muted)", fontSize: 11 } as const;

export const TOOLTIP_STYLE = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-line)",
  borderRadius: 12,
  color: "var(--color-fg)",
  fontSize: 13,
} as const;

/** Renders its chart only after mount, so recharts measures a real width. */
export function ChartBox({ className, children }: { className?: string; children: ReactNode }) {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(true), []);
  return (
    <div className={cn("w-full min-w-0", className)}>
      {on ? (
        <ResponsiveContainer width="100%" height="100%">
          {children as ReactElement}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
