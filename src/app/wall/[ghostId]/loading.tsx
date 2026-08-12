import { Spinner } from "@/components/primitives";

// Also covers the nested /wall/[ghostId]/[slug] route -- Next.js reuses the
// nearest ancestor loading.tsx when a segment doesn't define its own.
export default function Loading() {
  return <Spinner fullPage />;
}
