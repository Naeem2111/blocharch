import { redirect } from "next/navigation";

export default function PrivateCompletedProjectsRedirect() {
  redirect("/dashboard/private/archives");
}
