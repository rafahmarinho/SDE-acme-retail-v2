import type { Metadata } from "next";
import { updatePasswordAction } from "@/actions/auth";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { requireUser } from "@/services/auth";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function UpdatePasswordPage() {
  await requireUser("/account/update-password");
  return (
    <div className="card max-w-md p-6">
      <h1 className="h1">Choose a new password</h1>
      <p className="muted mt-1">After saving, you&apos;ll stay signed in here and other devices will be signed out.</p>
      <ActionForm action={updatePasswordAction} className="mt-6 space-y-4">
        <Field label="New password" name="password" type="password" required autoComplete="new-password" maxLength={72} hint="10+ characters, upper & lower case, a digit." />
        <Field label="Confirm new password" name="confirm" type="password" required autoComplete="new-password" maxLength={72} />
        <SubmitButton className="btn-primary w-full" pendingText="Saving...">Save password</SubmitButton>
      </ActionForm>
    </div>
  );
}
