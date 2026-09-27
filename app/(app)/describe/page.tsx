import { DescribeView } from "@/components/describe-view";
import { localizedMetadata } from "@/lib/i18n/titles";

export const generateMetadata = localizedMetadata("describe");

export default function DescribePage() {
  return <DescribeView />;
}
