import { PageHeader } from "@/components/PageHeader";
import { OpsCheckInRequestsClient } from "./OpsCheckInRequestsClient";

export default function OpsCheckInsPage() {
  return (
    <div>
      <PageHeader
        title="Check-in requests"
        description="Book a Call requests from athletes — approve, decline, suggest another time, and add Zoom links to Google Calendar."
      />
      <OpsCheckInRequestsClient />
    </div>
  );
}
