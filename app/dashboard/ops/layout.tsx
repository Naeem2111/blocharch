import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessModule, canAccessOpsOverview, defaultDashboardPath } from "@/lib/permissions";
import { OpsShell } from "@/components/ops/OpsShell";

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const canEnterOps =
    session &&
    (canAccessModule(session.user.role, "ops", session.user.username) ||
      canAccessOpsOverview(session.user.role));
  if (!canEnterOps) {
    redirect(defaultDashboardPath(session?.user.role ?? "user", session?.user.username));
  }
  return <OpsShell>{children}</OpsShell>;
}
