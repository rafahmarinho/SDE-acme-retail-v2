import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page flex justify-center py-20">
      <div className="card max-w-md p-8 text-center">
        <p className="text-5xl font-extrabold text-brand-600">404</p>
        <h1 className="h1 mt-2">Page not found</h1>
        <p className="muted mt-2">The page you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/" className="btn-primary">Go home</Link>
          <Link href="/catalog" className="btn-secondary">Browse catalog</Link>
        </div>
      </div>
    </div>
  );
}
