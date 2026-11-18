import { PageHeader } from "@/components/PageHeader";
import { MeetingNotesPageClient } from "./MeetingNotesPageClient";

export default function OpsMeetingNotesPage({
  searchParams,
}: {
  searchParams: { clientId?: string };
}) {
  return (
    <>
      <PageHeader
        title="Meeting notes"
        description="Agenda points for a client meeting. They can reorder open points and tick them off on their portal."
        className="mb-8"
      />
      <MeetingNotesPageClient initialClientId={searchParams.clientId ?? ""} />
    </>
  );
}
