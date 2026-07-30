import { PrivateAthleteShell } from "@/components/private/PrivateAthleteShell";

export default function PrivateAthleteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PrivateAthleteShell>{children}</PrivateAthleteShell>;
}
