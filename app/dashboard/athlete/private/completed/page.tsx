import { redirect } from "next/navigation";

export default function AthletePrivateCompletedRedirect() {
  redirect("/dashboard/athlete/projects/completed?set=private");
}
