import { PageHeader } from "@/components/PageHeader";

export default function BookCallPage() {
  return (
    <div>
      <PageHeader
        title="Book a call"
        description="Request a check-in slot from Jethro’s calendar — project, reason, preferred time, and notes."
      />
      <p className="text-sm text-slate-500">
        Coming soon — Google Calendar availability, approval flow, and Zoom link confirmation.
      </p>
    </div>
  );
}
