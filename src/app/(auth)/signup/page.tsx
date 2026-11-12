import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signUpAction } from "@/actions/auth";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { getAuth } from "@/services/auth";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  if ((await getAuth()).user) redirect("/account");
  return (
    <div className="container-page flex justify-center py-12">
      <div className="card w-full max-w-md p-6">
        <h1 className="h1">Create your account</h1>
        <p className="muted mt-1">Track orders, save favorites and check out faster.</p>
        <ActionForm action={signUpAction} className="mt-6 space-y-4">
          <Field label="Full name" name="full_name" required autoComplete="name" maxLength={120} hint="Used for shipping and order emails." />
          <Field label="Email" name="email" type="email" required autoComplete="email" maxLength={254} hint="Used to sign in and to send order updates." />
          <Field
            label="Password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            maxLength={72}
            hint="At least 10 characters, with uppercase, lowercase and a digit."
          />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="terms" required className="mt-1" />
            <span>
              I accept the Terms of Service and have read the Privacy Notice. <span className="text-red-600">*</span>
            </span>
          </label>
          {/* Optional consents: separate from the Terms, unchecked by default (T178) */}
          <fieldset className="space-y-2 rounded-lg border border-gray-200 p-3 text-sm">
            <legend className="px-1 font-medium">Optional - you can change these any time in Settings</legend>
            <label className="flex items-start gap-2">
              <input type="checkbox" name="consent_marketing_email" className="mt-1" />
              <span>Email me offers and new arrivals.</span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" name="consent_personalization" className="mt-1" />
              <span>Use my favorites to personalize recommendations.</span>
            </label>
            <label className="flex items-start gap-2">
              <input type="checkbox" name="consent_analytics" className="mt-1" />
              <span>Help improve the store with anonymous usage analytics.</span>
            </label>
          </fieldset>
          <SubmitButton className="btn-primary w-full" pendingText="Creating account...">Create account</SubmitButton>
        </ActionForm>
        <p className="mt-6 text-sm">
          Already have an account? <Link href="/login" className="link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
