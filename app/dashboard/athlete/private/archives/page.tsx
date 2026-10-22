import { redirect } from "next/navigation";

export default function AthletePrivateArchivesRedirect() {
  redirect("/dashboard/athlete/projects/completed?set=private");
}
