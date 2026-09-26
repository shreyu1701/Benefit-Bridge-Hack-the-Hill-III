import type { Metadata } from "next";
import { FactConfirm } from "@/components/fact-confirm";

export const metadata: Metadata = { title: "Confirm" };

export default function ConfirmPage() {
  return <FactConfirm />;
}
