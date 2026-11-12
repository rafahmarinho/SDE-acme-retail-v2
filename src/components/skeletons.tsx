export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card animate-pulse p-3">
          <div className="aspect-square rounded-lg bg-gray-100" />
          <div className="mt-3 h-3 w-1/3 rounded bg-gray-100" />
          <div className="mt-2 h-4 w-2/3 rounded bg-gray-100" />
          <div className="mt-3 h-4 w-1/4 rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-1/3 rounded bg-gray-200" />
      <div className="card h-40" />
      <div className="card h-64" />
    </div>
  );
}
