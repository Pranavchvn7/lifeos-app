export type AmountDraft = { enabled: boolean; unit: string; target: string };

/** Turn what was typed into a habit amount, or null when the switch is off or no unit was given. */
export function draftToAmount(draft: AmountDraft): { unit: string; target?: number } | null {
  const unit = draft.unit.trim();
  if (!draft.enabled || !unit) return null;
  const target = Number(draft.target);
  return Number.isFinite(target) && target > 0 ? { unit, target: Math.round(target * 100) / 100 } : { unit };
}

export function amountToDraft(amount: { unit: string; target?: number } | undefined): AmountDraft {
  return { enabled: !!amount, unit: amount?.unit ?? "", target: amount?.target ? String(amount.target) : "" };
}
