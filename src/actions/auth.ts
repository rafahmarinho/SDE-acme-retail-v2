"use server";
/**
 * Authentication actions (Supabase Auth, email + password).
 * - Login/sign-up/recovery are rate limited per IP and per (pseudonymized) email (T1362, T70).
 * - Recovery responses are identical whether or not the account exists (T2).
 * - Successful/failed logins are audit-logged without raw emails (T2602, T744).
 * - Redirect targets are validated (T37).
 */
import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerClient } from "@/db/server";
import { fail, type ActionResult } from "@/lib/errors";
import { serverEnv } from "@/lib/env.server";
import { clientIp, pseudonym } from "@/lib/request";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { Email, Password } from "@/lib/schemas";
import { assertUser } from "@/services/auth";
import { logSecurityEvent } from "@/services/audit";
import { rateLimit } from "@/services/rate-limit";
import { recordConsents } from "@/services/users";

const GENERIC_RESET_MESSAGE = "If an account exists for that email, we've sent a link to reset your password.";

export async function signInAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const parsed = z
    .object({ email: Email, password: z.string().min(1).max(72), next: z.string().max(512).optional() })
    .safeParse({ email: form.get("email"), password: form.get("password"), next: form.get("next") ?? undefined });
  if (!parsed.success) return { ok: false, error: "Enter your email and password." };
  const { email, password, next } = parsed.data;
  try {
    await rateLimit(`login:ip:${await clientIp()}`, 10, 300);
    await rateLimit(`login:email:${pseudonym(email)}`, 5, 900);
  } catch (err) {
    return fail(err);
  }
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    await logSecurityEvent("auth.login_failed", null, { email: pseudonym(email) });
    return { ok: false, error: "Invalid email or password." };
  }
  await logSecurityEvent("auth.login", data.user.id, {}, data.user.id);
  redirect(safeRedirectPath(next, "/account"));
}

export async function signUpAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const parsed = z
    .object({
      full_name: z.string().trim().min(2, "Enter your name").max(120),
      email: Email,
      password: Password,
      terms: z.literal("on", { message: "Please accept the Terms of Service" }),
    })
    .safeParse(Object.fromEntries(["full_name", "email", "password", "terms"].map((k) => [k, form.get(k) ?? undefined])));
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const { full_name, email, password } = parsed.data;
  try {
    await rateLimit(`signup:ip:${await clientIp()}`, 5, 3600);
  } catch (err) {
    return fail(err);
  }
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name }, emailRedirectTo: `${serverEnv().APP_BASE_URL}/auth/confirm?next=/account` },
  });
  if (error || !data.user) {
    if (error?.code === "weak_password") return { ok: false, error: "Please choose a stronger password." };
    // Same message for "already registered" and other failures (no account enumeration)
    return { ok: false, error: "We couldn't create an account with those details. If you already have one, sign in or reset your password." };
  }
  if (!data.session) {
    return { ok: true, message: "Check your email to confirm your account, then sign in." };
  }
  // Optional purposes are opt-in and recorded separately from the Terms acceptance (T178)
  await recordConsents(data.user.id, {
    marketing_email: form.get("consent_marketing_email") === "on",
    analytics: form.get("consent_analytics") === "on",
    personalization: form.get("consent_personalization") === "on",
  });
  await logSecurityEvent("auth.signup", data.user.id, {}, data.user.id);
  redirect("/account");
}

export async function requestPasswordResetAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const parsed = Email.safeParse(form.get("email"));
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." };
  const email = parsed.data;
  try {
    await rateLimit(`reset:ip:${await clientIp()}`, 10, 3600);
    await rateLimit(`reset:email:${pseudonym(email)}`, 3, 3600);
  } catch (err) {
    return fail(err);
  }
  const supabase = await createServerClient();
  // redirect target is a fixed server-side constant (T2); the email template builds the link.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${serverEnv().APP_BASE_URL}/auth/confirm?next=/account/update-password`,
  });
  if (error) console.error("[acme] password reset request failed", error.code);
  await logSecurityEvent("auth.password_reset_requested", null, { email: pseudonym(email) });
  return { ok: true, message: GENERIC_RESET_MESSAGE };
}

const NewPassword = z
  .object({ password: Password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

/** After following the recovery link (recovery session). Revokes all other sessions. */
export async function updatePasswordAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const parsed = NewPassword.safeParse({ password: form.get("password"), confirm: form.get("confirm") });
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: z.flattenError(parsed.error).fieldErrors };
  try {
    const { user } = await assertUser();
    const supabase = await createServerClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) {
      return { ok: false, error: error.code === "same_password" ? "Choose a password you haven't used before." : "Couldn't update your password. Please request a new link." };
    }
    await supabase.auth.signOut({ scope: "others" });
    await logSecurityEvent("auth.password_changed", user.id, { via: "recovery" }, user.id);
  } catch (err) {
    return fail(err);
  }
  redirect("/account?password=updated");
}

/** From Settings: re-verify the current password first (step-up), then change it. */
export async function changePasswordAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const parsed = NewPassword.safeParse({ password: form.get("password"), confirm: form.get("confirm") });
  const current = z.string().min(1).max(72).safeParse(form.get("current"));
  if (!parsed.success || !current.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: parsed.success ? { current: ["Enter your current password"] } : z.flattenError(parsed.error).fieldErrors };
  }
  try {
    const { user } = await assertUser();
    await rateLimit(`pwchange:${user.id}`, 5, 900);
    const supabase = await createServerClient();
    const { error: verifyErr } = await supabase.auth.signInWithPassword({ email: user.email ?? "", password: current.data });
    if (verifyErr) {
      await logSecurityEvent("auth.password_change_failed", user.id, {}, user.id);
      return { ok: false, error: "Your current password is incorrect.", fieldErrors: { current: ["Incorrect password"] } };
    }
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) return { ok: false, error: error.code === "same_password" ? "Choose a new password." : "Couldn't update your password." };
    await supabase.auth.signOut({ scope: "others" });
    await logSecurityEvent("auth.password_changed", user.id, { via: "settings" }, user.id);
    return { ok: true, message: "Password updated. Other devices have been signed out." };
  } catch (err) {
    return fail(err);
  }
}

export async function changeEmailAction(_prev: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const parsed = Email.safeParse(form.get("email"));
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." };
  try {
    const { user } = await assertUser();
    await rateLimit(`emailchange:${user.id}`, 3, 3600);
    const supabase = await createServerClient();
    const { error } = await supabase.auth.updateUser(
      { email: parsed.data },
      { emailRedirectTo: `${serverEnv().APP_BASE_URL}/auth/confirm?next=/account/profile` },
    );
    if (error) return { ok: false, error: "Couldn't start the email change. Please try again later." };
    await logSecurityEvent("auth.email_change_requested", user.id, {}, user.id);
    return { ok: true, message: "Check both your current and new inbox to confirm the change." };
  } catch (err) {
    return fail(err);
  }
}
