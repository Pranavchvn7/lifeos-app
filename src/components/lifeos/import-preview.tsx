import { summarizeLog, type BackupMeta } from "@/lib/lifeos/backup";
import type { LifeData } from "@/lib/lifeos/model";

const btn = "h-11 rounded-md border border-line px-3 text-sm font-medium disabled:opacity-60";
const btnPrimary = "h-11 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg disabled:opacity-60";

function range(first: string | null, last: string | null): string {
  if (!first || !last) return "none";
  return first === last ? first : `${first} to ${last}`;
}

/** Shown after a backup file is chosen and before anything is changed: what is in the app now versus in the file. */
export function ImportPreview({
  current,
  backup,
  meta,
  busy,
  onReplace,
  onMerge,
  onCancel,
}: {
  current: LifeData;
  backup: LifeData;
  meta: BackupMeta;
  busy: boolean;
  onReplace: () => void;
  onMerge: () => void;
  onCancel: () => void;
}) {
  const now = summarizeLog(current);
  const file = summarizeLog(backup);
  const rows: [string, string, string][] = [
    ["Habits", String(now.habits), String(file.habits)],
    ["Logged days", String(now.loggedDays), String(file.loggedDays)],
    ["Dates logged", range(now.firstDay, now.lastDay), range(file.firstDay, file.lastDay)],
    ["To-dos", String(now.todos), String(file.todos)],
    ["Goals", String(now.goals), String(file.goals)],
    ["Journal days", String(now.journalDays), String(file.journalDays)],
    ["Program", `${now.programDays} days from ${now.programStart}`, `${file.programDays} days from ${file.programStart}`],
  ];
  const made = meta.exportedAt ? new Date(meta.exportedAt).toLocaleString() : null;

  return (
    <div className="space-y-3 rounded-md border border-line bg-inset p-3" data-testid="import-preview" role="group" aria-label="Restore this backup?">
      <p className="text-sm font-medium">Restore this backup?</p>
      {made ? (
        <p className="text-xs text-muted">
          Backup made {made}
          {meta.appVersion ? ` (LifeOS v${meta.appVersion})` : ""}.
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1 pr-3 font-medium" />
              <th className="py-1 pr-3 font-medium">In the app now</th>
              <th className="py-1 font-medium">In the backup</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, a, b]) => (
              <tr key={name} className="border-t border-line">
                <th scope="row" className="py-1 pr-3 font-medium">
                  {name}
                </th>
                <td className="py-1 pr-3 tabular-nums">{a}</td>
                <td className="py-1 tabular-nums">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">A safety copy of what is in the app now is saved first, so you can undo this.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" data-testid="import-replace" className={btnPrimary} disabled={busy} onClick={onReplace}>
          Replace everything with this backup
        </button>
        <button type="button" data-testid="import-merge" className={btn} disabled={busy} onClick={onMerge}>
          Add what's missing (keep my data)
        </button>
        <button type="button" data-testid="import-cancel" className={btn} disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
