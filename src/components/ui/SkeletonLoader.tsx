// FR-UX: Skeleton Loading States
// Shimmer animations to reduce perceived loading time

import { cn } from '../../lib/utils';

export function QuestionSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className="space-y-6 p-6 animate-pulse">
      {/* Progress bar skeleton */}
      <div className={cn('h-1 w-full rounded-full', isDark ? 'bg-gray-700' : 'bg-gray-200')} />

      {/* Question text skeleton */}
      <div className="space-y-3">
        <div className={cn('h-6 w-3/4 rounded-lg', isDark ? 'bg-gray-700' : 'bg-gray-200')} />
        <div className={cn('h-6 w-1/2 rounded-lg', isDark ? 'bg-gray-700' : 'bg-gray-200')} />
      </div>

      {/* Options skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={cn('h-12 w-full rounded-xl', isDark ? 'bg-gray-700' : 'bg-gray-200')} />
        ))}
      </div>
    </div>
  );
}

export function ResultSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className="space-y-4 p-6 animate-pulse">
      <div className={cn('h-8 w-2/3 rounded-lg', isDark ? 'bg-gray-700' : 'bg-gray-200')} />
      <div className={cn('h-64 w-full rounded-xl', isDark ? 'bg-gray-700' : 'bg-gray-200')} />
      <div className="flex gap-2">
        <div className={cn('h-12 flex-1 rounded-xl', isDark ? 'bg-gray-700' : 'bg-gray-200')} />
        <div className={cn('h-12 flex-1 rounded-xl', isDark ? 'bg-gray-700' : 'bg-gray-200')} />
      </div>
    </div>
  );
}

export function ShimmerSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('shimmer-skeleton relative overflow-hidden rounded-xl bg-gray-200 dark:bg-gray-700', className)}>
      <div className="shimmer-effect" />
    </div>
  );
}
