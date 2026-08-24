import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} />;
}

/** Skeleton de um card de medley/recomendação enquanto o score é calculado. */
export function SkeletonRecommendationCard() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-base-800 bg-base-900/60 p-5">
      <Skeleton className="h-5 w-24" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <Skeleton className="h-10 w-full sm:w-40" />
    </div>
  );
}

export function SkeletonRecommendationList({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRecommendationCard key={i} />
      ))}
    </div>
  );
}
