import { createFileRoute } from "@tanstack/react-router";
import { GoalsView } from "@/components/lifeos/goals-view";

export const Route = createFileRoute("/_app/goals")({ component: GoalsView });
