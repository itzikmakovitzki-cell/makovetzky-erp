import { PageLoadingSkeleton } from "@/components/global/page-loading-skeleton";

// Suspense fallback for every route inside the (dashboard) group that
// doesn't define its own more specific loading.tsx. Without this, every
// navigation blocked on the full server render with no feedback at all.
export default function DashboardLoading() {
  return <PageLoadingSkeleton />;
}
