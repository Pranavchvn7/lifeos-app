import { createFileRoute } from "@tanstack/react-router";
import { HabitsView } from "@/components/lifeos/habits-view";
import { todayISO } from "@/lib/lifeos/model";
import { useLifeData } from "@/lib/lifeos/use-life-data";

export const Route = createFileRoute("/_app/habits")({ component: HabitsPage });

function HabitsPage() {
  const data = useLifeData();
  return <HabitsView data={data} today={todayISO()} />;
}
