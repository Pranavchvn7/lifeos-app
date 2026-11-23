import { useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { UserButton } from "@/lib/auth/gates";
import { APP_VERSION } from "@/lib/version";
import { DangerSection, ExportSection, HabitEditor, ProgramSection, ReminderSection, Section, ShareSection } from "./settings-sections";

/** Account & settings as a full page (it used to be a popup). Same sections as before. */
export function SettingsPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const toToday = () => void navigate({ to: "/" });

  function back() {
    if (router.history.canGoBack()) router.history.back();
    else toToday();
  }

  return (
    <div data-testid="settings-page" className="mx-auto max-w-2xl">
      {/* The id below is kept from the popup version so existing automated tests keep working. */}
      <div data-testid="settings-dialog">
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-testid="settings-close"
            aria-label="Back"
            onClick={back}
            className="grid size-11 shrink-0 place-items-center rounded-md border border-line bg-surface"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0">
            <h1 id="settings-title" className="font-display text-2xl font-medium">
              Account &amp; settings
            </h1>
            <p className="text-sm text-muted">Saved to your account, so it follows you when you sign in again.</p>
          </div>
        </div>

        <div className="account-chip mt-5 rounded-lg border border-line bg-surface p-3">
          <UserButton />
        </div>

        <Section id="habits" title="Habits" hint="Your do's and don'ts, and which days they apply" defaultOpen>
          <HabitEditor kind="dos" title="Do's" />
          <HabitEditor kind="donts" title="Don'ts" />
          <p className="mt-3 text-xs text-subtle">
            Adding or removing a habit changes past percentages, because each day is scored against the current list.
          </p>
        </Section>

        <Section id="reminders" title="Reminders" hint="Daily nudge and Sunday weekly review">
          <ReminderSection />
        </Section>

        <Section id="program" title="Program" hint="Your current window, or start a new one">
          <ProgramSection onDone={toToday} />
        </Section>

        <Section id="share" title="Share my progress" hint="View-only link for a friend or mentor">
          <ShareSection />
        </Section>

        <Section id="export" title="Export & backup" hint="Excel, CSV and full backup">
          <ExportSection onImported={toToday} />
        </Section>

        <Section id="danger" title="Danger zone" hint="Start over or delete your account">
          <DangerSection onDone={toToday} />
        </Section>

        <p className="mt-6 text-center text-xs text-subtle" data-testid="app-version">
          LifeOS v{APP_VERSION}
        </p>
      </div>
    </div>
  );
}
