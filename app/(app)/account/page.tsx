import type { Metadata } from "next";
import { AccountView } from "@/components/account-view";
import { auth0Enabled, googleLoginUrl } from "@/lib/auth0";

export const metadata: Metadata = { title: "Your profile" };
export const dynamic = "force-dynamic";

export default function AccountPage() {
  return <AccountView googleUrl={auth0Enabled ? googleLoginUrl("/account") : null} />;
}
