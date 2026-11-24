import { PageHeader } from "@/components/PageHeader";
import { RecruitmentClient } from "./RecruitmentClient";

export default function RecruitmentPage() {
  return (
    <>
      <PageHeader
        title="Recruitment"
        description="Import an applicant into Athlete manager, or reject them and delete that row from the recruitment sheet."
        className="mb-8"
      />
      <RecruitmentClient />
    </>
  );
}
