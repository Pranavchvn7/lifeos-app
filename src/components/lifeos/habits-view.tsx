import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { formatPretty, scheduleLabel, type Habit, type LifeData } from "@/lib/lifeos/model";
import { habitStats, lastDays, type DayState, type HabitKind } from "@/lib/lifeos/habit-view";
import { cn } from "@/lib/utils";
import { Panel, SectionLabel } from "./ui";

/** Colour of one day, shared by the list strip and the dashboard calendar. */
export function dayTone(state: DayState): string {
  switch (state) {
    case "done":
      return "bg-good text-accent-fg";
    case "missed":
      return "bg-bad-soft text-bad";
    case "open":
      return "border border-dashed border-accent bg-paper text-fg";
    case "frozen":
      return "bg-accent/20 text-fg";
    default:
      return "bg-inset text-subtle";
  }
}

export const DAY_STATE_LABEL: Record<DayState, string> = {
  done: "Done",
  missed: "Missed",
  open: "Not logged yet",
  off: "Not scheduled",
  frozen: "Streak freeze",
  before: "Before it started",
  future: "Later",
};

/** Habits tab: every do and don't with its streak and the last seven days. */
export function HabitsView({ data, today }: { data: LifeData; today: string }) {
  const none = data.dos.length + data.donts.length === 0;
  return (
    <div className="space-y-6">
      <header>
        <SectionLabel>Habits</SectionLabel>
        <p className="mt-1 text-sm text-muted">Each habit's streak and the last seven days. Tap one for its history.</p>
      </header>

      {none ? (
        <Panel>
          <p className="text-sm text-muted">You have no habits yet.</p>
          <Link to="/settings" className="mt-3 inline-flex h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg">
            Add habits in settings
          </Link>
        </Panel>
      ) : null}

      <HabitGroup kind="do" title="Do's" habits={data.dos} data={data} today={today} />
      <HabitGroup kind="dont" title="Don'ts" habits={data.donts} data={data} today={today} />
    </div>
  );
}

function HabitGroup({
  kind,
  title,
  habits,
  data,
  today,
}: {
  kind: HabitKind;
  title: string;
  habits: Habit[];
  data: LifeData;
  today: string;
}) {
  if (habits.length === 0) return null;
  return (
    <section aria-labelledby={`habits-${kind}`} className="space-y-3">
      <h3 id={`habits-${kind}`} className="font-display text-xl font-medium">
        {title}
      </h3>
      <ul className="space-y-3">
        {habits.map((habit) => (
          <li key={habit.id}>
            <HabitRow kind={kind} habit={habit} data={data} today={today} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function HabitRow({ kind, habit, data, today }: { kind: HabitKind; habit: Habit; data: LifeData; today: string }) {
  const ref = { kind, habit };
  const stats = habitStats(data, ref, today);
  const days = lastDays(data, ref, today);
  const detail = [habit.amount ? `${habit.amount.unit}${habit.amount.target ? `, target ${habit.amount.target}` : ""}` : null, scheduleLabel(habit)]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link
      to="/habits/$habitId"
      params={{ habitId: habit.id }}
      data-testid="habit-row"
      data-habit-id={habit.id}
      className="block rounded-xl border border-line bg-surface p-4 transition-colors hover:bg-inset/60"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-medium">{habit.label}</p>
          <p className="mt-0.5 text-xs text-subtle">{detail}</p>
        </div>
        <ChevronRight className="mt-1 size-5 shrink-0 text-muted" aria-hidden />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <ol className="flex gap-1.5" aria-label={`Last seven days for ${habit.label}`}>
          {days.map((day) => (
            <li
              key={day.date}
              role="img"
              aria-label={`${formatPretty(day.date)}: ${DAY_STATE_LABEL[day.state]}`}
              title={`${formatPretty(day.date)}: ${DAY_STATE_LABEL[day.state]}`}
              className={cn("size-6 rounded-md", dayTone(day.state))}
            />
          ))}
        </ol>
        <p className="shrink-0 text-sm tabular-nums text-muted" data-testid="habit-streak">
          {stats.current > 0 ? `${stats.current}-day streak` : "No streak yet"}
        </p>
      </div>
    </Link>
  );
}
