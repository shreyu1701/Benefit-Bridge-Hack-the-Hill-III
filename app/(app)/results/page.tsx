import { ResultsView } from "@/components/results-view";
import { localizedMetadata } from "@/lib/i18n/titles";

export const generateMetadata = localizedMetadata("results");

export default function ResultsPage() {
  return <ResultsView />;
}
