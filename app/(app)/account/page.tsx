import { AccountView } from "@/components/account-view";
import { auth0Enabled, googleLoginUrl } from "@/lib/auth0";
import { localizedMetadata } from "@/lib/i18n/titles";

export const generateMetadata = localizedMetadata("account");
export const dynamic = "force-dynamic";

export default function AccountPage() {
  return <AccountView googleUrl={auth0Enabled ? googleLoginUrl("/account") : null} />;
}
