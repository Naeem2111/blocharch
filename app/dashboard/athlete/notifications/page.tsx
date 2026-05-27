import { PageHeader } from "@/components/PageHeader";

export default function AthleteNotificationsPage() {
  return (
    <div>
      <PageHeader
        title="My notifications"
        description="Alerts for check-ins, blockers, project updates, and admin messages will appear here."
      />
      <p className="text-sm text-slate-500">
        Coming soon — this will replace a generic inbox with actionable notifications tied to your
        projects.
      </p>
    </div>
  );
}
