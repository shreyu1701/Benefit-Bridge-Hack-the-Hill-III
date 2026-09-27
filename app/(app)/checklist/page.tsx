import type { Metadata } from "next";
import { Checklist } from "@/components/checklist";

export const metadata: Metadata = { title: "My benefits checklist" };

export default function ChecklistPage() {
  return <Checklist />;
}
