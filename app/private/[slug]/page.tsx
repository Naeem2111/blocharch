import { notFound } from "next/navigation";
import { getPublicPrivateProjectBySlug } from "@/lib/private-public-portal";
import { PrivateClientPortalClient } from "./PrivateClientPortalClient";

export default async function PrivateClientPortalPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const resolved = await Promise.resolve(params);
  const data = await getPublicPrivateProjectBySlug(resolved.slug);
  if (!data) notFound();

  return <PrivateClientPortalClient data={data} />;
}
