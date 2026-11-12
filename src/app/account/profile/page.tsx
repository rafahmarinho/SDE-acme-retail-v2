import type { Metadata } from "next";
import { addressCommandAction, saveAddressAction, updateProfileAction } from "@/actions/account";
import { changeEmailAction } from "@/actions/auth";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Badge, PageHeader } from "@/components/ui";
import { requireUser } from "@/services/auth";
import { getProfile, listAddresses } from "@/services/users";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const auth = await requireUser("/account/profile");
  const [profile, addresses] = await Promise.all([getProfile(auth.user.id), listAddresses(auth.user.id)]);
  return (
    <div className="space-y-6">
      <PageHeader title="Profile & addresses" subtitle="Keep your details up to date so deliveries arrive on time." />
      <section className="card p-5">
        <h2 className="h2 mb-3">Personal details</h2>
        <ActionForm action={updateProfileAction} className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" name="full_name" defaultValue={profile.full_name} required maxLength={120} autoComplete="name" />
          <Field label="Phone" name="phone" type="tel" defaultValue={profile.phone} maxLength={20} autoComplete="tel" hint="Optional - used only by carriers for delivery." />
          <div className="sm:col-span-2"><SubmitButton pendingText="Saving...">Save details</SubmitButton></div>
        </ActionForm>
      </section>

      <section className="card p-5">
        <h2 className="h2 mb-1">Email address</h2>
        <p className="muted mb-3">Current: {auth.user.email}. We&apos;ll ask you to confirm the change from both inboxes.</p>
        <ActionForm action={changeEmailAction} className="flex flex-wrap items-end gap-2" resetOnSuccess>
          <Field label="New email" name="email" type="email" required maxLength={254} autoComplete="email" className="flex-1" />
          <SubmitButton className="btn-secondary" pendingText="Sending...">Change email</SubmitButton>
        </ActionForm>
      </section>

      <section className="card p-5">
        <h2 className="h2 mb-3">Saved addresses</h2>
        {addresses.length === 0 && <p className="muted mb-3">No saved addresses yet.</p>}
        <ul className="mb-4 grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-lg border border-gray-200 p-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium">{a.full_name}</p>
                {a.is_default && <Badge tone="green">Default</Badge>}
              </div>
              <p>{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p>
              <p>{a.city}{a.region ? `, ${a.region}` : ""} {a.postal_code} · {a.country}</p>
              <ActionForm action={addressCommandAction} className="mt-2 flex gap-2">
                <input type="hidden" name="address_id" value={a.id} />
                {!a.is_default && <SubmitButton className="btn-secondary btn-sm" name="command" value="default">Make default</SubmitButton>}
                <SubmitButton className="btn-danger btn-sm" name="command" value="delete">Delete</SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
        <details>
          <summary className="link cursor-pointer text-sm">Add an address</summary>
          <ActionForm action={saveAddressAction} className="mt-3 grid gap-4 sm:grid-cols-2" resetOnSuccess>
            <Field label="Full name" name="full_name" defaultValue={profile.full_name} required maxLength={120} className="sm:col-span-2" />
            <Field label="Address line 1" name="line1" required maxLength={120} className="sm:col-span-2" />
            <Field label="Address line 2" name="line2" maxLength={120} className="sm:col-span-2" />
            <Field label="City" name="city" required maxLength={80} />
            <Field label="State / region" name="region" maxLength={80} />
            <Field label="Postal code" name="postal_code" required maxLength={10} />
            <Field label="Country (2 letters)" name="country" defaultValue="US" required maxLength={2} />
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="is_default" /> Use as default</label>
            <div className="sm:col-span-2"><SubmitButton pendingText="Saving...">Save address</SubmitButton></div>
          </ActionForm>
        </details>
      </section>
    </div>
  );
}
