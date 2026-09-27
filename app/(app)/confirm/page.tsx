import { FactConfirm } from "@/components/fact-confirm";
import { localizedMetadata } from "@/lib/i18n/titles";

export const generateMetadata = localizedMetadata("confirm");

export default function ConfirmPage() {
  return <FactConfirm />;
}
