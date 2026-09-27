import { Checklist } from "@/components/checklist";
import { localizedMetadata } from "@/lib/i18n/titles";

export const generateMetadata = localizedMetadata("checklist");

export default function ChecklistPage() {
  return <Checklist />;
}
