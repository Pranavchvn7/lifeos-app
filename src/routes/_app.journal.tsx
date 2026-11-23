import { createFileRoute } from "@tanstack/react-router";
import { JournalView } from "@/components/lifeos/journal-view";
import { useShell } from "@/components/lifeos/shell-context";

export const Route = createFileRoute("/_app/journal")({ component: JournalPage });

function JournalPage() {
  const { openDate } = useShell();
  return <JournalView onOpenDate={openDate} />;
}
