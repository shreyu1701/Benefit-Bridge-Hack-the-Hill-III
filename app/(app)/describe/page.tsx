import type { Metadata } from "next";
import { DescribeView } from "@/components/describe-view";

export const metadata: Metadata = { title: "Describe your situation" };

export default function DescribePage() {
  return <DescribeView />;
}
