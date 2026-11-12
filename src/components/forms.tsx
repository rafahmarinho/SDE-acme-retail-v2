"use client";
/**
 * Form helpers built on React 19 Server Actions: pending states, success/error messages and
 * field errors. Messages are plain text (escaped by React).
 */
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/errors";

type Action = (prev: ActionResult | undefined, form: FormData) => Promise<ActionResult>;

export function SubmitButton({ children, className = "btn-primary", pendingText, name, value, disabled }: {
  children: ReactNode;
  className?: string;
  pendingText?: string;
  name?: string;
  value?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled} name={name} value={value} aria-busy={pending}>
      {pending && <Spinner />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

export function Spinner() {
  return <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

export function FormMessage({ state }: { state: ActionResult | undefined }) {
  if (!state) return null;
  if (state.ok) {
    return state.message ? (
      <p role="status" className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
        {state.message}
      </p>
    ) : null;
  }
  const fieldErrors = Object.entries(state.fieldErrors ?? {}).filter(([, v]) => v && v.length);
  return (
    <div role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      <p>{state.error}</p>
      {fieldErrors.length > 0 && (
        <ul className="mt-1 list-disc pl-5">
          {fieldErrors.map(([k, v]) => (
            <li key={k}>
              {k.replace(/_/g, " ")}: {v?.[0]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  encType,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  encType?: "multipart/form-data";
}) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className} encType={encType}>
      {children}
      <FormMessage state={state} />
    </form>
  );
}

export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  autoComplete,
  placeholder,
  maxLength,
  hint,
  min,
  max,
  step,
  className,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  maxLength?: number;
  hint?: string;
  min?: number;
  max?: number;
  step?: number | string;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="label">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      <input
        className="input"
        name={name}
        type={type}
        defaultValue={defaultValue ?? undefined}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        maxLength={maxLength}
        min={min}
        max={max}
        step={step}
      />
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}
