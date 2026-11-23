import { createContext, useContext } from "react";

/** What the screens share with the app shell: the day being looked at, the reminder banner, how saving is going. */
export type ShellValue = {
  /** The date shown on the Today screen (always inside the program). */
  date: string;
  setDate: (iso: string) => void;
  /** Jump to a date on the Today screen (used by the Board and the Journal). */
  openDate: (iso: string) => void;
  reminderDue: boolean;
};

export const ShellContext = createContext<ShellValue | null>(null);

export function useShell(): ShellValue {
  const value = useContext(ShellContext);
  if (!value) throw new Error("useShell must be used inside the app shell");
  return value;
}
