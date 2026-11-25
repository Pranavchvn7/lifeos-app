import { BookOpen, LayoutDashboard, ListChecks, ListTodo, Repeat, Settings, Target, type LucideIcon } from "lucide-react";

/** Every section of the app, in the order of the navigation bar. */
export type NavId = "today" | "habits" | "todo" | "board" | "journal" | "goals" | "settings";

export type NavItem = { id: NavId; label: string; icon: LucideIcon; to: "/" | "/habits" | "/todo" | "/board" | "/journal" | "/goals" | "/settings" };

export const NAV_ITEMS: NavItem[] = [
  { id: "today", label: "Today", icon: ListChecks, to: "/" },
  { id: "habits", label: "Habits", icon: Repeat, to: "/habits" },
  { id: "todo", label: "To-do", icon: ListTodo, to: "/todo" },
  { id: "board", label: "Board", icon: LayoutDashboard, to: "/board" },
  { id: "journal", label: "Journal", icon: BookOpen, to: "/journal" },
  { id: "goals", label: "Goals", icon: Target, to: "/goals" },
  { id: "settings", label: "Settings", icon: Settings, to: "/settings" },
];

/** Which section a URL belongs to (so the right item is highlighted). */
export function navIdForPath(pathname: string): NavId {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const hit = NAV_ITEMS.find((item) => item.to !== "/" && (clean === item.to || clean.startsWith(`${item.to}/`)));
  return hit?.id ?? "today";
}
