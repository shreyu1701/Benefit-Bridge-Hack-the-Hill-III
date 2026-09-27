import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { localizedMetadata } from "@/lib/i18n/titles";

export const generateMetadata = localizedMetadata("onboarding");

export default function OnboardingPage() {
  return <OnboardingFlow />;
}
