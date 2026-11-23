import { createFileRoute } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { BootScreen } from "@/components/lifeos/boot-screen";
import { LifeApp } from "@/components/lifeos/life-app";

/** The signed-in app: loads your log once, then every section below is a page inside this frame. */
export const Route = createFileRoute("/_app")({ component: AppFrame });

function AppFrame() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <BootScreen label="Checking your session" />;
  if (!user) return <RedirectToSignIn />;
  return <LifeApp userId={user.id} />;
}
