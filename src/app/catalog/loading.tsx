import { GridSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="container-page py-8">
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-gray-200" />
      <GridSkeleton />
    </div>
  );
}
