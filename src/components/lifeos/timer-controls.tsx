import { useEffect, useState } from "react";
import { Pause, Play, Square } from "lucide-react";
import { useLife } from "@/lib/lifeos/store";
import { formatClock, timerSeconds } from "@/lib/lifeos/timer";

/** The clock: re-reads the time once a second, but only while a timer is actually running. */
function useNowMs(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const handle = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(handle);
  }, [running]);
  return now;
}

const ghost = "inline-flex h-11 items-center gap-2 rounded-md border border-line bg-paper px-3 text-sm font-medium text-fg";

/**
 * Start, pause, resume and stop for one habit (on one day) or one task. Shows the clock while this is the timer
 * that is running or paused; otherwise it is a Start button. Only one timer runs at a time, across all screens.
 */
export function TimerButton({ kind, id, date = "", label }: { kind: "habit" | "task"; id: string; date?: string; label: string }) {
  const timer = useLife((s) => s.timer);
  const startTimer = useLife((s) => s.startTimer);
  const pauseTimer = useLife((s) => s.pauseTimer);
  const resumeTimer = useLife((s) => s.resumeTimer);
  const stopTimer = useLife((s) => s.stopTimer);

  const mine = !!timer && timer.kind === kind && timer.id === id && (kind === "task" || timer.date === date);
  const now = useNowMs(!!mine && !!timer?.startedAt);

  if (!mine || !timer) {
    return (
      <button
        type="button"
        data-testid="timer-start"
        aria-label={`Start timer for ${label}`}
        onClick={() => startTimer(kind, id, date, Date.now())}
        className={ghost}
      >
        <Play className="size-4" aria-hidden />
        Start timer
      </button>
    );
  }

  const running = !!timer.startedAt;
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="timer-controls">
      <span className="min-w-[4.5rem] tabular-nums text-sm font-medium" data-testid="timer-clock">
        {formatClock(timerSeconds(timer, now))}
      </span>
      {running ? (
        <button type="button" data-testid="timer-pause" aria-label={`Pause timer for ${label}`} onClick={() => pauseTimer(Date.now())} className={ghost}>
          <Pause className="size-4" aria-hidden />
          Pause
        </button>
      ) : (
        <button type="button" data-testid="timer-resume" aria-label={`Resume timer for ${label}`} onClick={() => resumeTimer(Date.now())} className={ghost}>
          <Play className="size-4" aria-hidden />
          Resume
        </button>
      )}
      <button type="button" data-testid="timer-stop" aria-label={`Stop timer for ${label} and save the time`} onClick={() => stopTimer(Date.now())} className={ghost}>
        <Square className="size-4" aria-hidden />
        Stop
      </button>
    </div>
  );
}

/** Shown above every page while a timer runs or is paused, so you can always see it and stop it. */
export function TimerBar() {
  const timer = useLife((s) => s.timer);
  const dos = useLife((s) => s.dos);
  const todos = useLife((s) => s.todos);
  const pauseTimer = useLife((s) => s.pauseTimer);
  const resumeTimer = useLife((s) => s.resumeTimer);
  const stopTimer = useLife((s) => s.stopTimer);

  const running = !!timer?.startedAt;
  const now = useNowMs(running);
  if (!timer) return null;

  const name =
    timer.kind === "habit" ? dos.find((habit) => habit.id === timer.id)?.label : todos.find((todo) => todo.id === timer.id)?.title;
  const label = name ?? "Timer";

  return (
    <section
      aria-label="Running timer"
      data-testid="timer-bar"
      className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-surface/95 px-4 py-2 backdrop-blur"
    >
      <span className={running ? "size-2.5 rounded-full bg-accent" : "size-2.5 rounded-full bg-subtle"} aria-hidden />
      <p className="min-w-0 flex-1 truncate text-sm">
        {label}
        <span className="text-subtle">{running ? "" : " (paused)"}</span>
      </p>
      <span className="tabular-nums text-sm font-semibold" data-testid="timer-bar-clock">
        {formatClock(timerSeconds(timer, now))}
      </span>
      {running ? (
        <button type="button" data-testid="timer-bar-pause" aria-label={`Pause ${label}`} onClick={() => pauseTimer(Date.now())} className={ghost}>
          <Pause className="size-4" aria-hidden />
          Pause
        </button>
      ) : (
        <button type="button" data-testid="timer-bar-resume" aria-label={`Resume ${label}`} onClick={() => resumeTimer(Date.now())} className={ghost}>
          <Play className="size-4" aria-hidden />
          Resume
        </button>
      )}
      <button type="button" data-testid="timer-bar-stop" aria-label={`Stop ${label} and save the time`} onClick={() => stopTimer(Date.now())} className={ghost}>
        <Square className="size-4" aria-hidden />
        Stop
      </button>
    </section>
  );
}
