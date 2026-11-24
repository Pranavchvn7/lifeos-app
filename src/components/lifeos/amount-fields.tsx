import type { AmountDraft } from "./amount-draft";
import { Field } from "./ui";

/** "Track an amount" switch plus unit and daily target, used when adding a habit and when editing one. */
export function AmountFields({
  draft,
  onChange,
  onCommit,
  testId,
}: {
  draft: AmountDraft;
  onChange: (next: AmountDraft) => void;
  /** Called when a field loses focus or the switch changes (used by the edit form to save). */
  onCommit?: (next: AmountDraft) => void;
  testId: string;
}) {
  return (
    <div className="space-y-2">
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          data-testid={`${testId}-toggle`}
          checked={draft.enabled}
          onChange={(event) => {
            const next = { ...draft, enabled: event.target.checked };
            onChange(next);
            onCommit?.(next);
          }}
          className="size-5 accent-[var(--color-accent)]"
        />
        Track an amount (pages, glasses, minutes…)
      </label>
      {draft.enabled ? (
        <div className="flex flex-wrap gap-2">
          <Field
            aria-label="Unit"
            data-testid={`${testId}-unit`}
            placeholder="Unit, e.g. pages"
            value={draft.unit}
            maxLength={20}
            className="w-40"
            onChange={(event) => onChange({ ...draft, unit: event.target.value })}
            onBlur={() => onCommit?.(draft)}
          />
          <Field
            aria-label="Daily target"
            data-testid={`${testId}-target`}
            placeholder="Daily target (optional)"
            inputMode="decimal"
            value={draft.target}
            className="w-52"
            onChange={(event) => onChange({ ...draft, target: event.target.value.replace(/[^0-9.]/g, "") })}
            onBlur={() => onCommit?.(draft)}
          />
        </div>
      ) : null}
    </div>
  );
}
