import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatAmount,
  formatLong,
  formatMonthDay,
  formatMonthYear,
  formatPretty,
  pctLabel,
  scheduleLabel,
  type LifeData,
} from "@/lib/lifeos/model";
import {
  dayRecord,
  dayStates,
  findHabit,
  habitStart,
  habitStats,
  monthBars,
  monthGrid,
  monthOf,
  shiftMonth,
  streakSeries,
  weeklyBuckets,
  type DayRecord,
  type HabitRef,
} from "@/lib/lifeos/habit-view";
import { useLife } from "@/lib/lifeos/store";
import { cn } from "@/lib/utils";
import { AmountControls } from "./amount-controls";
import { AXIS, ChartBox, TOOLTIP_STYLE } from "./chart-kit";
import { DAY_STATE_LABEL, dayTone } from "./habits-view";
import { Area as TextArea, Panel } from "./ui";

const WEEKDAY_HEADINGS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** One habit: its calendar (tap a day to edit it or add a note), stats, charts and notes. */
export function HabitDashboard({ data, habitId, today }: { data: LifeData; habitId: string; today: string }) {
  const found = findHabit(data, habitId);
  if (!found) {
    return (
      <Panel>
        <p className="text-sm text-muted">This habit no longer exists.</p>
        <Link to="/habits" className="mt-3 inline-flex h-11 items-center text-sm font-medium text-accent">
          Back to habits
        </Link>
      </Panel>
    );
  }
  return <Dashboard data={data} found={found} today={today} />;
}

function Dashboard({ data, found, today }: { data: LifeData; found: HabitRef; today: string }) {
  const { kind, habit } = found;
  const isAmount = kind === "do" && !!habit.amount;
  const unit = habit.amount?.unit ?? "";
  const start = habitStart(data, habit);
  const earliestMonth = monthOf(start);
  const latestMonth = monthOf(today);

  const [month, setMonth] = useState(latestMonth);
  const [selected, setSelected] = useState(today);

  const toggleDo = useLife((s) => s.toggleDo);
  const setDoValue = useLife((s) => s.setDoValue);
  const setDoNote = useLife((s) => s.setDoNote);
  const setDontStatus = useLife((s) => s.setDontStatus);
  const setDontNote = useLife((s) => s.setDontNote);

  const stats = useMemo(() => habitStats(data, found, today), [data, found, today]);
  const records = useMemo(() => dayStates(data, found, today), [data, found, today]);
  const grid = useMemo(() => monthGrid(month), [month]);
  const bars = useMemo(() => monthBars(data, found, month, today), [data, found, month, today]);
  const weeks = useMemo(() => weeklyBuckets(data, found, today, 12), [data, found, today]);
  const streaks = useMemo(() => streakSeries(records).slice(-90), [records]);
  const notes = useMemo(() => records.filter((record) => record.notes.trim()).reverse(), [records]);

  const selectedRecord = dayRecord(data, found, selected, today);
  const editable = selectedRecord.state !== "before" && selectedRecord.state !== "future";

  return (
    <div className="space-y-6" data-testid="habit-dashboard" data-habit-id={habit.id}>
      <div>
        <Link to="/habits" className="inline-flex h-11 items-center gap-1 text-sm font-medium text-muted">
          <ChevronLeft className="size-4" aria-hidden />
          All habits
        </Link>
        <h1 className="mt-1 break-words font-display text-3xl font-medium tracking-tight">{habit.label}</h1>
        <p className="mt-1 text-sm text-muted">
          {kind === "do" ? "Do" : "Don't"}
          {isAmount ? ` · ${unit}${habit.amount?.target ? `, target ${formatAmount(habit.amount.target)} a day` : ""}` : ""}
          {` · ${scheduleLabel(habit)} · Counts from ${formatPretty(start)}`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {isAmount ? (
          <Tile label="Total" value={`${formatAmount(stats.total)} ${unit}`} sub={`${stats.countable} days counted`} />
        ) : (
          <Tile label="Days kept" value={String(stats.total)} sub={`of ${stats.countable} days`} />
        )}
        <Tile label="Completion" value={pctLabel(stats.completion)} sub="of days that applied" />
        <Tile label="Current streak" value={`${stats.current}`} sub="days in a row" />
        <Tile label="Best streak" value={`${stats.best}`} sub="days in a row" />
        {isAmount ? <Tile label="Average" value={`${formatAmount(stats.average)} ${unit}`} sub="per counted day" /> : null}
      </div>

      <Panel>
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            aria-label="Previous month"
            data-testid="habit-month-prev"
            disabled={month <= earliestMonth}
            onClick={() => setMonth(shiftMonth(month, -1))}
            className="grid size-11 place-items-center rounded-md border border-line bg-surface disabled:opacity-40"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <h2 className="font-display text-xl font-medium" data-testid="habit-month-title">
            {formatMonthYear(`${month}-01`)}
          </h2>
          <button
            type="button"
            aria-label="Next month"
            data-testid="habit-month-next"
            disabled={month >= latestMonth}
            onClick={() => setMonth(shiftMonth(month, 1))}
            className="grid size-11 place-items-center rounded-md border border-line bg-surface disabled:opacity-40"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>

        <table className="mt-4 w-full table-fixed border-separate border-spacing-1 text-center text-xs" data-testid="habit-calendar">
          <thead>
            <tr>
              {WEEKDAY_HEADINGS.map((name) => (
                <th key={name} scope="col" className="pb-1 font-medium text-subtle">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((date, col) => {
                  if (!date) return <td key={col} />;
                  const record = dayRecord(data, found, date, today);
                  const disabled = record.state === "before" || record.state === "future";
                  const day = Number(date.slice(8, 10));
                  return (
                    <td key={date} className="p-0">
                      <button
                        type="button"
                        disabled={disabled}
                        aria-label={`${formatPretty(date)}: ${DAY_STATE_LABEL[record.state]}`}
                        aria-pressed={date === selected}
                        data-testid="habit-day"
                        data-state={record.state}
                        onClick={() => setSelected(date)}
                        className={cn(
                          "flex h-12 w-full flex-col items-center justify-center rounded-md tabular-nums transition-shadow disabled:opacity-40",
                          dayTone(record.state),
                          date === selected && "ring-2 ring-accent ring-offset-1 ring-offset-surface",
                        )}
                      >
                        <span className="font-medium">{day}</span>
                        {isAmount && record.value > 0 ? (
                          <span className="text-[10px] leading-none opacity-80">{formatAmount(record.value)}</span>
                        ) : null}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel>
        <div data-testid="habit-day-editor">
        <p className="text-sm text-muted">{formatLong(selected)}</p>
        <p className="mt-0.5 font-medium" data-testid="habit-day-status">
          {DAY_STATE_LABEL[selectedRecord.state]}
        </p>

        {!editable ? (
          <p className="mt-3 text-sm text-muted">
            {selectedRecord.state === "before" ? "This habit had not started yet." : "This day has not happened yet."}
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {kind === "do" && habit.amount ? (
              <AmountControls
                label={habit.label}
                amount={habit.amount}
                value={selectedRecord.value}
                onChange={(value) => setDoValue(selected, habit.id, value)}
              />
            ) : null}

            {kind === "do" && !habit.amount ? (
              <button
                type="button"
                data-testid="habit-done-toggle"
                onClick={() => toggleDo(selected, habit.id)}
                className={cn(
                  "h-11 rounded-md px-4 text-sm font-medium",
                  selectedRecord.state === "done" ? "border border-line bg-paper text-fg" : "bg-accent text-accent-fg",
                )}
              >
                {selectedRecord.state === "done" ? "Undo" : "Mark done"}
              </button>
            ) : null}

            {kind === "dont" ? (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Did you keep it?">
                <StatusButton
                  active={selectedRecord.status === "Avoided"}
                  label="Avoided"
                  onClick={() => setDontStatus(selected, habit.id, "Avoided")}
                />
                <StatusButton
                  active={selectedRecord.status === "Gave In"}
                  label="Gave in"
                  onClick={() => setDontStatus(selected, habit.id, "Gave In")}
                />
              </div>
            ) : null}

            <label className="block">
              <span className="text-sm text-muted">Note for this day</span>
              <TextArea
                rows={3}
                maxLength={500}
                data-testid="habit-day-note"
                value={selectedRecord.notes}
                placeholder="What happened? Optional"
                onChange={(event) =>
                  kind === "do"
                    ? setDoNote(selected, habit.id, event.target.value)
                    : setDontNote(selected, habit.id, event.target.value)
                }
                className="mt-1"
              />
            </label>
          </div>
        )}
        </div>
      </Panel>

      <Panel>
        <h2 className="font-display text-xl font-medium">This month</h2>
        <ChartBox className="mt-3 h-48">
          <BarChart data={bars.map((bar) => ({ name: String(bar.day), value: bar.value }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="name" tick={AXIS} interval={3} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS} allowDecimals={isAmount} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => (isAmount ? `${formatAmount(Number(value))} ${unit}` : Number(value) ? "Done" : "Not done")} />
            <Bar dataKey="value" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartBox>
        <p className="mt-2 text-xs text-subtle">{isAmount ? `${unit} logged each day` : "1 = done, 0 = not done"}</p>
      </Panel>

      <Panel>
        <h2 className="font-display text-xl font-medium">Last 12 weeks</h2>
        <ChartBox className="mt-3 h-48">
          <BarChart data={weeks.map((week) => ({ name: week.label, value: isAmount ? week.amount : week.hits }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="name" tick={AXIS} interval="preserveStartEnd" tickLine={false} axisLine={false} />
            <YAxis tick={AXIS} allowDecimals={isAmount} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => (isAmount ? `${formatAmount(Number(value))} ${unit}` : `${Number(value)} days`)} />
            <Bar dataKey="value" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartBox>
        <p className="mt-2 text-xs text-subtle">{isAmount ? `${unit} per week` : "Days kept per week"}</p>
      </Panel>

      <Panel>
        <h2 className="font-display text-xl font-medium">Completion by week</h2>
        <ChartBox className="mt-3 h-48">
          <ComposedChart data={weeks.map((week) => ({ name: week.label, pct: Math.round(week.completion * 100) }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="name" tick={AXIS} interval="preserveStartEnd" tickLine={false} axisLine={false} />
            <YAxis tick={AXIS} domain={[0, 100]} unit="%" tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => `${Number(value)}%`} />
            <Line type="monotone" dataKey="pct" stroke="var(--color-good)" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ChartBox>
      </Panel>

      <Panel>
        <h2 className="font-display text-xl font-medium">Streak, last 90 days</h2>
        <ChartBox className="mt-3 h-48">
          <ComposedChart data={streaks.map((point) => ({ name: formatMonthDay(point.date), streak: point.streak }))} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="name" tick={AXIS} interval="preserveStartEnd" tickLine={false} axisLine={false} />
            <YAxis tick={AXIS} allowDecimals={false} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => `${Number(value)} days`} />
            <Area type="monotone" dataKey="streak" stroke="var(--color-accent)" fill="var(--color-accent)" fillOpacity={0.18} />
          </ComposedChart>
        </ChartBox>
      </Panel>

      <Panel>
        <h2 className="font-display text-xl font-medium">Notes</h2>
        {notes.length === 0 ? <p className="mt-2 text-sm text-muted">No notes yet. Add one to any day above.</p> : null}
        <ul className="mt-3 space-y-3">
          {notes.map((record: DayRecord) => (
            <li key={record.date}>
              <button
                type="button"
                onClick={() => {
                  setSelected(record.date);
                  setMonth(monthOf(record.date));
                }}
                className="block w-full rounded-md p-2 text-left hover:bg-inset/60"
              >
                <span className="text-xs text-subtle">{formatPretty(record.date)}</span>
                <span className="mt-0.5 block whitespace-pre-wrap break-words text-sm">{record.notes}</span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Panel className="p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-medium tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-subtle">{sub}</p>
    </Panel>
  );
}

function StatusButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-11 rounded-md border px-4 text-sm font-medium",
        active ? "border-accent bg-accent text-accent-fg" : "border-line bg-paper text-fg",
      )}
    >
      {label}
    </button>
  );
}
