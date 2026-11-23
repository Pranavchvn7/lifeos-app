import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BoardView } from "@/components/lifeos/board-view";
import { useShell } from "@/components/lifeos/shell-context";
import { useLifeData } from "@/lib/lifeos/use-life-data";

export const Route = createFileRoute("/_app/board")({ component: BoardPage });

function BoardPage() {
  const data = useLifeData();
  const { openDate } = useShell();
  const navigate = useNavigate();
  return <BoardView data={data} onOpenDate={openDate} onSetup={() => void navigate({ to: "/settings" })} />;
}
