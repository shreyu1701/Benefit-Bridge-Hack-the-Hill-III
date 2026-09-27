import { describe, expect, it } from "vitest";
import { AuthorizationError, OAuth2Error } from "@auth0/nextjs-auth0/errors";
import { describeAuthError, safeReturnTo } from "@/lib/auth0";

describe("Auth0 callback handling", () => {
  it("surfaces the real Auth0 reason hidden behind the generic SDK message", () => {
    const err = new AuthorizationError({ cause: new OAuth2Error({ code: "access_denied", message: "Service not enabled within domain" }) });
    expect(err.message).toBe("An error occurred during the authorization flow.");
    expect(describeAuthError(err)).toEqual({ code: "access_denied", detail: "Service not enabled within domain" });
  });

  it("only allows same-site paths after login (no open redirect)", () => {
    expect(safeReturnTo("/onboarding")).toBe("/onboarding");
    expect(safeReturnTo("//evil.example")).toBe("/");
    expect(safeReturnTo("https://evil.example")).toBe("/");
    expect(safeReturnTo(undefined)).toBe("/");
  });
});
