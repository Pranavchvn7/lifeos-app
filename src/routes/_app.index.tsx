import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useShell } from "@/components/lifeos/shell-context";
import { TodayView } from "@/components/lifeos/today-view";

export const Route = createFileRoute("/_app/")({ component: TodayPage });

function TodayPage() {
  const { date, setDate, reminderDue } = useShell();
  const navigate = useNavigate();
  return (
    <TodayView
      date={date}
      onDate={setDate}
      onSetup={() => void navigate({ to: "/settings" })}
      onOpenTodos={() => void navigate({ to: "/todo" })}
      reminderDue={reminderDue}
    />
  );
}
