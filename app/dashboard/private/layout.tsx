import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessModule, defaultDashboardPath } from "@/lib/permissions";
import { PrivateOpsShell } from "@/components/private/PrivateOpsShell";

export default async function PrivateOpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || !canAccessModule(session.user.role, "private_work", session.user.username)) {
    redirect(defaultDashboardPath(session?.user.role ?? "user", session?.user.username));
  }
  return <PrivateOpsShell>{children}</PrivateOpsShell>;
}
