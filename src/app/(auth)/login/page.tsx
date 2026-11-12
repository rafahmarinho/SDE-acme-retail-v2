import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signInAction } from "@/actions/auth";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getAuth } from "@/services/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; reauth?: string }> }) {
  const sp = await searchParams;
  const next = safeRedirectPath(sp.next, "/account");
  const auth = await getAuth();
  if (auth.user && !sp.reauth) redirect(next);
  return (
    <div className="container-page flex justify-center py-12">
      <div className="card w-full max-w-md p-6">
        <h1 className="h1">Sign in</h1>
        <p className="muted mt-1">Welcome back to ACME Retail.</p>
        {sp.reauth && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">For your security, please sign in again to continue.</p>}
        <ActionForm action={signInAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />
          <Field label="Email" name="email" type="email" required autoComplete="email" maxLength={254} />
          <Field label="Password" name="password" type="password" required autoComplete="current-password" maxLength={72} />
          <SubmitButton className="btn-primary w-full" pendingText="Signing in...">Sign in</SubmitButton>
        </ActionForm>
        <div className="mt-6 flex justify-between text-sm">
          <Link href="/forgot-password" className="link">Forgot your password?</Link>
          <Link href={`/signup?next=${encodeURIComponent(next)}`} className="link">Create an account</Link>
        </div>
      </div>
    </div>
  );
}
