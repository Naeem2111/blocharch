import { PageHeader } from "@/components/PageHeader";
import { OpsNotificationsClient } from "./OpsNotificationsClient";

export default function OpsNotificationsPage() {
  return (
    <div>
      <PageHeader
        title="My notifications"
        description="Check-in requests, blockers, reviews, and other athlete items that need your attention."
      />
      <OpsNotificationsClient />
    </div>
  );
}
