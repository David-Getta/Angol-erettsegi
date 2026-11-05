import type { Metadata } from "next";
import { MockPage } from "@/components/mock/MockPage";
import { t } from "@/lib/i18n/hu";

export const metadata: Metadata = { title: t.diagnostic.title };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MockPage id={Number(id)} kind="diagnostic" />;
}
