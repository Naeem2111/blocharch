import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessModule, defaultDashboardPath } from "@/lib/permissions";
import { AthleteShell } from "@/components/ops/AthleteShell";
import { ensureLinkedAthleteProfile } from "@/lib/ops-athlete-profile";
import { isStaffAdmin } from "@/lib/admin-only-accounts";

export default async function AthleteLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || !canAccessModule(session.user.role, "athlete_portal", session.user.username)) {
    redirect(defaultDashboardPath(session?.user.role ?? "user", session?.user.username));
  }
  if (isStaffAdmin(session.user)) {
    await ensureLinkedAthleteProfile(session.user);
  }
  return <AthleteShell>{children}</AthleteShell>;
}
