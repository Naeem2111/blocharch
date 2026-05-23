import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessModule, defaultDashboardPath } from "@/lib/permissions";
import { AthleteShell } from "@/components/ops/AthleteShell";

export default async function AthleteLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || !canAccessModule(session.user.role, "athlete_portal")) {
    redirect(defaultDashboardPath(session?.user.role ?? "user"));
  }
  return <AthleteShell>{children}</AthleteShell>;
}
