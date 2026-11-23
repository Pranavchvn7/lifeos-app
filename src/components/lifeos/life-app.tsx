import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { Toaster, toast } from "sonner";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { clampProgram, createBlank, formatMonthDay, programOf, todayISO } from "@/lib/lifeos/model";
import { computeBadges } from "@/lib/lifeos/badges";
import { syncTimeZone } from "@/lib/lifeos/push-client";
import { useReminderEngine } from "@/lib/lifeos/reminders";
import { buildScores } from "@/lib/lifeos/score";
import { useLifeData } from "@/lib/lifeos/use-life-data";
import { isReviewDone, reviewWeekFor } from "@/lib/lifeos/weekly";
import { getLifeLog, saveLifeLog } from "@/lib/lifeos/life.functions";
import { useLife } from "@/lib/lifeos/store";
import { parseLifeData, selectData } from "@/lib/lifeos/validate";
import { mergeLifeData, sameData } from "@/lib/lifeos/merge";
import type { LifeData } from "@/lib/lifeos/model";
import { useTheme } from "@/lib/lifeos/theme";
import { cn } from "@/lib/utils";
import { AppHeader } from "./app-header";
import { BootScreen } from "./boot-screen";
import { BottomNav } from "./bottom-nav";
import { NAV_ITEMS, navIdForPath, type NavItem } from "./nav-items";
import { ShellContext } from "./shell-context";

export function LifeApp({ userId }: { userId: string }) {
  const ready = useLife((state) => state.ready && state.ownerId === userId);
  const revision = useLife((state) => state.revision);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [mounted, setMounted] = useState(false);
  const chain = useRef<Promise<void>>(Promise.resolve());
  // What the server held when this device last read or saved it (the "base" for merging) and its version.
  const base = useRef<{ data: LifeData; version: number } | null>(null);
  const lastSync = useRef(0);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const active = navIdForPath(pathname);

  // Each section opens at the top, like a new page.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  const { theme, toggle: toggleTheme } = useTheme();
  const data = useLifeData();
  const program = programOf(data);
  const today = todayISO();
  // Follows today until the visitor navigates; always kept inside the program window.
  const date = clampProgram(pickedDate ?? today, program);
  const setDate = setPickedDate;

  const todayScore = useMemo(() => buildScores(data, today).find((d) => d.date === today), [data, today]);
  const hasHabits = data.dos.length + data.donts.length > 0;
  const reviewMonday = reviewWeekFor(today);
  const { due: reminderDue } = useReminderEngine({
    today,
    needsLogToday: hasHabits && !!todayScore && !todayScore.rest && !todayScore.filled,
    reviewPending: reviewMonday !== null && !isReviewDone(data.weeklyReviews[reviewMonday]),
    onFire: useCallback((message: string) => toast(message), []),
  });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    let cancel = false;
    useLife.getState().markUnready();
    setLoadError("");
    void getLifeLog()
      .then((row) => {
        if (cancel) return;
        useLife.getState().load(userId, row.data ?? createBlank());
        base.current = { data: selectData(useLife.getState()), version: row.version };
      })
      .catch((err: unknown) => {
        if (cancel) return;
        const message = err instanceof Error ? err.message : "";
        setLoadError(message === "Unauthorized" ? "unauthorized" : "Could not open your log.");
      });
    return () => {
      cancel = true;
    };
  }, [mounted, userId]);

  // Save: every save names the server version it is based on. If another device saved in between, the server
  // refuses, we merge the two copies (see merge.ts) and save the merged result, so nothing is overwritten.
  useEffect(() => {
    if (!ready || revision === 0) return;
    const handle = window.setTimeout(() => {
      const rev = useLife.getState().revision;
      setSaveState("saving");
      chain.current = chain.current
        .then(async () => {
          if (useLife.getState().revision !== rev) return;
          for (let attempt = 0; attempt < 4; attempt += 1) {
            const known = base.current;
            if (!known) return;
            const snapshot = selectData(useLife.getState());
            const res = await saveLifeLog({ data: { data: snapshot, baseVersion: known.version } });
            if (res.ok) {
              base.current = { data: snapshot, version: res.version };
              if (useLife.getState().revision === rev) setSaveState("saved");
              return;
            }
            const server = res.data ?? createBlank();
            let merged: LifeData;
            try {
              merged = parseLifeData(mergeLifeData(known.data, selectData(useLife.getState()), server));
            } catch {
              merged = selectData(useLife.getState()); // never lose what is on this screen
            }
            base.current = { data: server, version: res.version };
            useLife.getState().applyRemote(merged, false);
            toast("Combined with changes from another device");
          }
          throw new Error("Could not sync");
        })
        .catch(() => setSaveState("error"));
    }, 400);
    return () => window.clearTimeout(handle);
  }, [ready, revision]);

  // Keep the server's idea of this phone's time zone right (scheduled reminders are sent in local time).
  useEffect(() => {
    if (ready) void syncTimeZone();
  }, [ready]);

  // When the app comes back to the foreground (a phone app can sit open for days), pick up changes made on
  // another device. Unsaved edits on this device are merged in, never dropped.
  useEffect(() => {
    if (!ready) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastSync.current < 5000) return;
      lastSync.current = now;
      chain.current = chain.current
        .then(async () => {
          const known = base.current;
          if (!known) return;
          const row = await getLifeLog();
          if (row.version === known.version) return;
          const server = row.data ?? createBlank();
          const local = selectData(useLife.getState());
          const dirty = !sameData(local, known.data);
          let next = server;
          if (dirty) {
            try {
              next = parseLifeData(mergeLifeData(known.data, local, server));
            } catch {
              next = local;
            }
          }
          base.current = { data: server, version: row.version };
          useLife.getState().applyRemote(next, dirty);
          toast("Updated with changes from another device");
        })
        .catch(() => undefined);
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [ready]);

  // Celebrate newly earned badges (the first run only records what's already earned).
  const earnedIds = useMemo(
    () => (ready ? computeBadges(data, today).filter((b) => b.earned).map((b) => b.id) : []),
    [ready, data, today],
  );
  const earnedKey = earnedIds.join(",");
  useEffect(() => {
    if (!ready) return;
    const storageKey = `lifeos-badges-${userId}`;
    try {
      const seenRaw = window.localStorage.getItem(storageKey);
      if (seenRaw !== null) {
        const seen = new Set(seenRaw.split(",").filter(Boolean));
        const fresh = computeBadges(data, today).filter((b) => b.earned && !seen.has(b.id));
        fresh.forEach((b) => toast.success(`New badge: ${b.title}`, { description: b.description }));
      }
      window.localStorage.setItem(storageKey, earnedKey);
    } catch {
      /* storage unavailable */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, earnedKey, userId]);

  if (!mounted || (!ready && !loadError)) return <BootScreen label="Opening your log" />;
  if (loadError === "unauthorized") return <RedirectToSignIn />;
  if (loadError) {
    return (
      <main className="grid min-h-dvh place-items-center bg-paper px-6 text-center">
        <div className="max-w-sm">
          <p className="font-display text-2xl">LifeOS</p>
          <p className="mt-2 text-sm text-muted">{loadError}</p>
          <button
            type="button"
            className="mt-4 h-11 rounded-md bg-accent px-4 text-sm font-medium text-accent-fg"
            onClick={() => {
              setLoadError("");
              setMounted(false);
              window.setTimeout(() => setMounted(true), 0);
            }}
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  function openDate(iso: string) {
    setDate(clampProgram(iso, program));
    void navigate({ to: "/" });
  }

  const goSettings = () => void navigate({ to: "/settings" });

  return (
    <ShellContext.Provider value={{ date, setDate, openDate, reminderDue }}>
      <div className="min-h-dvh bg-paper text-fg">
        <div className="mx-auto grid min-h-dvh max-w-6xl md:grid-cols-[15rem_1fr]">
          <aside className="hidden border-r border-line md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:px-4 md:py-6">
            <p className="font-display text-2xl font-medium tracking-tight">LifeOS</p>
            <p className="mt-1 text-sm text-muted" data-testid="program-range">
              {formatMonthDay(program.start)} – {formatMonthDay(program.end)} {program.end.slice(0, 4)}
            </p>
            <nav aria-label="Main" className="mt-6 flex flex-col gap-1">
              {NAV_ITEMS.filter((item) => item.id !== "settings").map((item) => (
                <NavButton key={item.id} item={item} active={active === item.id} testId={`nav-desktop-${item.id}`} />
              ))}
            </nav>
            <div className="mt-auto space-y-3 pt-6">
              <SaveNote state={saveState} />
              <Link
                to="/settings"
                data-testid="settings-open"
                aria-current={active === "settings" ? "page" : undefined}
                className={cn(
                  "flex h-11 w-full items-center gap-2 rounded-md px-3 text-sm font-medium",
                  active === "settings" ? "bg-inset text-fg" : "text-muted",
                )}
              >
                <Settings className="size-4" />
                Account &amp; settings
              </Link>
            </div>
          </aside>

          <div className="min-w-0">
            <AppHeader theme={theme} onToggleTheme={toggleTheme} onSettings={goSettings} saveNote={saveNoteText(saveState)} />
            <main className="px-4 py-5 pb-28 md:px-8 md:py-8 md:pb-10">
              <Outlet />
            </main>
          </div>
        </div>

        <BottomNav active={active} />

        <Toaster position="top-center" theme={theme} richColors closeButton />
      </div>
    </ShellContext.Provider>
  );
}

function NavButton({ item, active, testId }: { item: NavItem; active: boolean; testId: string }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      data-testid={testId}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
        active ? "bg-inset text-fg" : "text-muted hover:bg-inset/60",
      )}
    >
      <Icon className="size-4" />
      {item.label}
    </Link>
  );
}

function saveNoteText(state: "idle" | "saving" | "saved" | "error"): string {
  if (state === "idle") return "";
  return state === "saving" ? "Saving…" : state === "saved" ? "Saved to your account" : "Not saved";
}

function SaveNote({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  const text = saveNoteText(state);
  if (!text) return null;
  return (
    <p data-testid="save-status" className={cn("text-xs", state === "error" ? "text-bad" : "text-subtle")}>
      {text}
    </p>
  );
}
