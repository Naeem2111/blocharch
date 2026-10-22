import { redirect } from "next/navigation";

export default function AthletePrivateLogRedirect() {
  redirect("/dashboard/athlete/private");
}
