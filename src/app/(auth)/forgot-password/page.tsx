import type { Metadata } from "next";
import Link from "next/link";
import { requestPasswordResetAction } from "@/actions/auth";
import { ActionForm, Field, SubmitButton } from "@/components/forms";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <div className="container-page flex justify-center py-12">
      <div className="card w-full max-w-md p-6">
        <h1 className="h1">Reset your password</h1>
        <p className="muted mt-1">Enter your email and we&apos;ll send you a link to choose a new password. The link expires in 30 minutes.</p>
        <ActionForm action={requestPasswordResetAction} className="mt-6 space-y-4" resetOnSuccess>
          <Field label="Email" name="email" type="email" required autoComplete="email" maxLength={254} />
          <SubmitButton className="btn-primary w-full" pendingText="Sending...">Send reset link</SubmitButton>
        </ActionForm>
        <p className="mt-6 text-sm">
          <Link href="/login" className="link">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
