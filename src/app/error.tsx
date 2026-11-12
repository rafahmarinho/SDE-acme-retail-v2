"use client";
import Link from "next/link";

/** Generic error page: no stack traces or internal messages reach the user (T2139, T49). */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-page flex justify-center py-20">
      <div className="card max-w-md p-8 text-center">
        <h1 className="h1">Something went wrong</h1>
        <p className="muted mt-2">We couldn&apos;t load this page. Please try again.</p>
        {error.digest && <p className="mt-2 font-mono text-xs text-gray-400">Reference: {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" onClick={reset} className="btn-primary">Try again</button>
          <Link href="/" className="btn-secondary">Go home</Link>
        </div>
      </div>
    </div>
  );
}
