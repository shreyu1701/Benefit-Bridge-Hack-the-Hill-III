import { ReviewQueue } from "@/components/review-queue";
import { Notice } from "@/components/ui/notice";
import { auth0Enabled, currentActor } from "@/lib/auth0";
import { localizedMetadata } from "@/lib/i18n/titles";

export const generateMetadata = localizedMetadata("admin", { robots: { index: false } });
export const dynamic = "force-dynamic";

/** Reviewer-only page. Eligibility rules change only through approvals made here. */
export default async function AdminPage() {
  const actor = await currentActor();
  if (!actor) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">Review queue</h1>
        {auth0Enabled ? (
          <p>
            <a href="/auth/login?returnTo=/admin" className="underline text-primary">Sign in with your email</a> to review source changes.
          </p>
        ) : (
          <Notice>
            Reviewer sign-in is not configured. Set the Auth0 variables (production) or ADMIN_TOKEN (local development only). See the README.
          </Notice>
        )}
      </div>
    );
  }
  if (!actor.isAdmin) {
    return <Notice>Your account is not a reviewer. Ask an administrator to add your email to ADMIN_EMAILS.</Notice>;
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Review queue</h1>
      <p className="text-muted">
        Changes detected on official program pages. The live eligibility rules stay unchanged until you approve. Signed in as{" "}
        {actor.email ?? actor.id}.{auth0Enabled && <> <a href="/auth/logout" className="underline">Sign out</a></>}
      </p>
      <ReviewQueue />
    </div>
  );
}
