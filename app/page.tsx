import { t } from "@/lib/i18n/hu";
import { PageHeader } from "@/components/ui";

export default function DashboardPage() {
  return <PageHeader title={t.dashboard.title} intro={t.dashboard.welcome} />;
}
