import type { Metadata } from "next";
import { setConsentAction, setRestrictionAction } from "@/actions/account";
import { changePasswordAction } from "@/actions/auth";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Badge, PageHeader } from "@/components/ui";
import { date } from "@/lib/format";
import { requireUser } from "@/services/auth";
import { POLICY_VERSION, getConsents, getRestrictions } from "@/services/users";

export const metadata: Metadata = { title: "Security & privacy" };

const CONSENT_COPY = {
  marketing_email: ["Marketing emails", "Offers and new arrivals by email."],
  personalization: ["Personalized recommendations", "Use your favorites to recommend products."],
  analytics: ["Usage analytics", "Anonymous statistics that help us improve the store."],
} as const;

const RESTRICTION_COPY = {
  marketing: ["Marketing", "Exclude my data from marketing segments and campaigns."],
  personalization: ["Personalization", "Don't use my activity to personalize what I see."],
  analytics: ["Analytics", "Exclude my activity from analytics reports."],
} as const;

export default async function SettingsPage() {
  const auth = await requireUser("/account/settings");
  const [consents, restrictions] = await Promise.all([getConsents(auth.user.id), getRestrictions(auth.user.id)]);
  return (
    <div className="space-y-6">
      <PageHeader title="Security & privacy" />

      <section className="card p-5">
        <h2 className="h2 mb-1">Change password</h2>
        <p className="muted mb-3">For your security we&apos;ll ask for your current password and sign out your other devices.</p>
        <ActionForm action={changePasswordAction} className="grid gap-4 sm:grid-cols-3" resetOnSuccess>
          <Field label="Current password" name="current" type="password" required autoComplete="current-password" maxLength={72} />
          <Field label="New password" name="password" type="password" required autoComplete="new-password" maxLength={72} hint="10+ characters, upper & lower case, a digit." />
          <Field label="Confirm new password" name="confirm" type="password" required autoComplete="new-password" maxLength={72} />
          <div className="sm:col-span-3"><SubmitButton pendingText="Updating...">Update password</SubmitButton></div>
        </ActionForm>
      </section>

      {/* Consent review and withdrawal (T604): withdrawing is as easy as granting */}
      <section className="card p-5">
        <h2 className="h2 mb-1">Your consents</h2>
        <p className="muted mb-3">Optional uses of your data. Privacy notice version {POLICY_VERSION}.</p>
        <ul className="divide-y">
          {(Object.keys(CONSENT_COPY) as (keyof typeof CONSENT_COPY)[]).map((p) => (
            <li key={p} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium">
                  {CONSENT_COPY[p][0]} {consents[p].granted ? <Badge tone="green">On</Badge> : <Badge>Off</Badge>}
                </p>
                <p className="muted">{CONSENT_COPY[p][1]} {consents[p].at && `Last changed ${date(consents[p].at)}.`}</p>
              </div>
              <ActionForm action={setConsentAction}>
                <input type="hidden" name="purpose" value={p} />
                <input type="hidden" name="granted" value={consents[p].granted ? "false" : "true"} />
                <SubmitButton className={consents[p].granted ? "btn-danger btn-sm" : "btn-secondary btn-sm"}>
                  {consents[p].granted ? "Withdraw consent" : "Give consent"}
                </SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      </section>

      {/* Restriction of processing (T754) */}
      <section className="card p-5">
        <h2 className="h2 mb-1">Restrict processing</h2>
        <p className="muted mb-3">Object to specific uses of your data. Order fulfilment and legal obligations aren&apos;t affected.</p>
        <ul className="divide-y">
          {(Object.keys(RESTRICTION_COPY) as (keyof typeof RESTRICTION_COPY)[]).map((a) => (
            <li key={a} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium">
                  {RESTRICTION_COPY[a][0]} {restrictions[a] && <Badge tone="amber">Restricted</Badge>}
                </p>
                <p className="muted">{RESTRICTION_COPY[a][1]}</p>
              </div>
              <ActionForm action={setRestrictionAction}>
                <input type="hidden" name="activity" value={a} />
                <input type="hidden" name="restricted" value={restrictions[a] ? "false" : "true"} />
                <SubmitButton className="btn-secondary btn-sm">{restrictions[a] ? "Lift restriction" : "Restrict"}</SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
