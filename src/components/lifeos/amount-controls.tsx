import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { formatAmount, type HabitAmount } from "@/lib/lifeos/model";
import { cn } from "@/lib/utils";

/** Today's row for an amount habit: a number you can type or step, and a bar showing progress to the daily target. */
export function AmountControls({
  label,
  amount,
  value,
  onChange,
}: {
  label: string;
  amount: HabitAmount;
  value: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(formatAmount(value));
  const focused = useRef(false);
  // Follow changes that did not come from typing (the +/- buttons, the tick, another device).
  useEffect(() => {
    if (!focused.current) setDraft(formatAmount(value));
  }, [value]);

  const target = amount.target;
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const step = (delta: number) => onChange(Math.max(0, value + delta));
  const stepBtn = "grid size-11 shrink-0 place-items-center rounded-md border border-line bg-paper text-fg";

  return (
    <div className="mt-2" data-testid="amount-controls">
      <div className="flex items-center gap-2">
        <button type="button" data-testid="amount-minus" aria-label={`Less ${amount.unit}: ${label}`} onClick={() => step(-1)} className={stepBtn}>
          <Minus className="size-4" />
        </button>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          data-testid="amount-input"
          aria-label={`${amount.unit} for ${label}`}
          value={draft}
          onFocus={() => {
            focused.current = true;
          }}
          onBlur={() => {
            focused.current = false;
            setDraft(formatAmount(value));
          }}
          onChange={(event) => {
            setDraft(event.target.value);
            const next = event.target.value === "" ? 0 : Number(event.target.value);
            if (Number.isFinite(next) && next >= 0) onChange(next);
          }}
          className="h-11 w-24 rounded-md border border-line bg-paper px-2 text-center text-base tabular-nums"
        />
        <button type="button" data-testid="amount-plus" aria-label={`More ${amount.unit}: ${label}`} onClick={() => step(1)} className={stepBtn}>
          <Plus className="size-4" />
        </button>
        <span className="text-sm text-muted" data-testid="amount-label">
          {target ? `/ ${formatAmount(target)} ` : ""}
          {amount.unit}
        </span>
      </div>
      {target ? (
        <div
          role="progressbar"
          aria-label={`${label} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          data-testid="amount-progress"
          className="mt-2 h-2 overflow-hidden rounded-full bg-inset"
        >
          <div className={cn("h-full rounded-full transition-all duration-300", pct >= 100 ? "bg-good" : "bg-accent")} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}
