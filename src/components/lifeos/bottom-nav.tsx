import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, type NavId } from "./nav-items";

const HINT_KEY = "lifeos-nav-hint-seen";

/**
 * Phone navigation: one row that scrolls sideways. The current section is highlighted and scrolled into view,
 * the next item is always partly visible, soft edges with arrows show there is more on that side, and the first
 * time it is shown the bar nudges itself to say "swipe me".
 */
export function BottomNav({ active }: { active: NavId }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  function measure() {
    const el = scroller.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    measure();
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Keep the highlighted item visible (centered) whenever the section changes.
  useEffect(() => {
    const el = scroller.current;
    const item = el?.querySelector<HTMLElement>(`[data-nav="${active}"]`);
    if (!el || !item) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const left = item.offsetLeft - (el.clientWidth - item.offsetWidth) / 2;
    el.scrollTo({ left: Math.max(0, left), behavior: reduce ? "auto" : "smooth" });
  }, [active]);

  // First time only: a small nudge to the right and back, so it is clear the bar can be swiped.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    try {
      if (window.localStorage.getItem(HINT_KEY)) return;
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
      if (el.scrollWidth <= el.clientWidth + 4) return;
      window.localStorage.setItem(HINT_KEY, "1");
    } catch {
      return;
    }
    const start = el.scrollLeft;
    const out = window.setTimeout(() => el.scrollTo({ left: start + 56, behavior: "smooth" }), 900);
    const back = window.setTimeout(() => el.scrollTo({ left: start, behavior: "smooth" }), 1700);
    return () => {
      window.clearTimeout(out);
      window.clearTimeout(back);
    };
  }, []);

  return (
    <nav
      aria-label="Main"
      data-testid="bottom-nav"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="relative">
        <div
          ref={scroller}
          onScroll={measure}
          className="flex snap-x overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === active;
            return (
              <Link
                key={item.id}
                to={item.to}
                data-nav={item.id}
                data-testid={`nav-mobile-${item.id}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex h-16 w-[4.75rem] shrink-0 snap-center flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  isActive ? "text-accent" : "text-muted",
                )}
              >
                {isActive ? <span aria-hidden className="absolute top-0 h-1 w-9 rounded-b-full bg-accent" /> : null}
                <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors", isActive ? "bg-accent/15" : "")}>
                  <item.icon className="size-5" />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
        <EdgeHint side="left" show={canLeft} />
        <EdgeHint side="right" show={canRight} />
      </div>
    </nav>
  );
}

function EdgeHint({ side, show }: { side: "left" | "right"; show: boolean }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <div
      aria-hidden
      data-testid={`nav-hint-${side}`}
      className={cn(
        "pointer-events-none absolute inset-y-0 flex w-9 items-center text-muted transition-opacity",
        side === "left" ? "left-0 justify-start bg-gradient-to-r from-surface via-surface/80 to-transparent" : "right-0 justify-end bg-gradient-to-l from-surface via-surface/80 to-transparent",
        show ? "opacity-100" : "opacity-0",
      )}
    >
      <Icon className="size-5" />
    </div>
  );
}
