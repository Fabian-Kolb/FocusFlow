import React from 'react';

// Platzhalter in der Form des späteren Inhalts. Nur fürs Laden von Inhalten, nicht für kurze Aktionen.
const base = 'bg-surface-low animate-pulse motion-reduce:animate-none';

export function Skeleton({ className = '' }) {
  return <div className={`${base} rounded-md ${className}`} aria-hidden="true" />;
}

export function SkeletonCard({ lines = 2, className = '' }) {
  return (
    <div className={`bg-white border border-outline-variant/70 rounded-xl p-4 shadow-card space-y-3 ${className}`} aria-hidden="true">
      <Skeleton className="h-4 w-2/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-1/2' : 'w-full'}`} />
      ))}
    </div>
  );
}

export function SkeletonList({ count = 3, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`} role="status" aria-label="Wird geladen">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

export default Skeleton;
