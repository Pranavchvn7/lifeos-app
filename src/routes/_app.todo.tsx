import { createFileRoute } from "@tanstack/react-router";
import { TodoView } from "@/components/lifeos/todo-view";

export const Route = createFileRoute("/_app/todo")({ component: TodoView });
