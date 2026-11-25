import { createFileRoute } from "@tanstack/react-router";
import { HabitDashboard } from "@/components/lifeos/habit-dashboard";
import { todayISO } from "@/lib/lifeos/model";
import { useLifeData } from "@/lib/lifeos/use-life-data";

export const Route = createFileRoute("/_app/habits_/$habitId")({ component: HabitPage });

function HabitPage() {
  const data = useLifeData();
  const { habitId } = Route.useParams();
  return <HabitDashboard data={data} habitId={habitId} today={todayISO()} />;
}
