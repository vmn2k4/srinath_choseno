"use client";

import { useState, useEffect, useRef } from "react";
import { Link as LinkIcon } from "lucide-react";

export type LinkMetadata = {
  title?: string;
  description?: string;
  image?: string;
  video?: string;
  url: string;
};

// Ported as-is: still calls the Microlink API directly from the client.
// Worth revisiting later as a server-side fetch (both for reliability and
// so link previews could ever appear in server-rendered/crawlable content),
// but this component is only ever used inside interactive composers/post
// cards, never on a page that needs the preview to exist pre-hydration —
// no regression versus the Vite behavior either way.
export default function LinkPreview({
  url,
  metadata,
  onMetadataFetched,
}: {
  url?: string;
  metadata?: LinkMetadata | null;
  onMetadataFetched?: (data: LinkMetadata) => void;
}) {
  // `fetched` only ever holds a result this component fetched itself; when
  // `metadata` is passed in (e.g. rendering an already-saved post), it's
  // used directly at render time via `data` below instead of being mirrored
  // into state, so the effect never needs to call setState synchronously
  // for the "nothing to fetch" case.
  const [fetched, setFetched] = useState<LinkMetadata | null>(null);
  const [loading, setLoading] = useState(!metadata);
  const [error, setError] = useState(false);
  const data = metadata || fetched;

  // Ref instead of a dependency-array entry: this is a "call me when the
  // fetch resolves" callback, not a value the effect should re-run for —
  // adding it to the deps would refire the fetch on every parent re-render
  // that doesn't memoize the callback.
  const onMetadataFetchedRef = useRef(onMetadataFetched);
  useEffect(() => {
    onMetadataFetchedRef.current = onMetadataFetched;
  });

  useEffect(() => {
    if (metadata) return;

    let ignore = false;
    async function fetchMetadata() {
      if (!url) return;
      setLoading(true);
      try {
        const res = await fetch(
          `https://api.microlink.io/?url=${encodeURIComponent(url)}&audio=false&video=true`
        );
        const json = await res.json();
        if (!ignore && json.status === "success") {
          const fetchedData: LinkMetadata = {
            title: json.data.title,
            description: json.data.description,
            image: json.data.image?.url || json.data.logo?.url,
            video: json.data.video?.url,
            url: json.data.url,
          };
          setFetched(fetchedData);
          onMetadataFetchedRef.current?.(fetchedData);
        } else {
          setError(true);
        }
      } catch {
        if (!ignore) setError(true);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchMetadata();

    return () => {
      ignore = true;
    };
  }, [url, metadata]);

  if (error || (!loading && !data)) {
    if (!url) return null;
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block my-3 group">
        <div className="flex bg-surface-hover/40 rounded-lg overflow-hidden border border-border-light/50 group-hover:border-primary/50 transition-colors h-16 items-center px-4">
          <LinkIcon className="text-text-darker w-6 h-6 mr-4 shrink-0" />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-text-secondary line-clamp-1 group-hover:text-primary-lighter transition-colors">
              {url}
            </h4>
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium mt-1 block truncate">
              {safeHostname(url)}
            </span>
          </div>
        </div>
      </a>
    );
  }

  if (loading) {
    return (
      <div className="w-full h-24 rounded-lg bg-surface-hover/50 animate-pulse flex items-center justify-center border border-border-light/50 my-3">
        <LinkIcon className="text-text-darker w-6 h-6" />
      </div>
    );
  }

  if (!data) return null;

  if (data.video) {
    return (
      <div className="my-3 rounded-lg overflow-hidden border border-border-light bg-black">
        <video src={data.video} controls className="w-full max-h-96 object-contain" />
        <div className="p-3 bg-surface border-t border-border">
          <h4 className="text-sm font-semibold text-text-secondary line-clamp-1">
            {data.title || data.url}
          </h4>
          <p className="text-xs text-text-muted mt-1 line-clamp-1">
            {data.description || safeHostname(data.url)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <a href={data.url} target="_blank" rel="noopener noreferrer" className="block my-3 group">
      <div className="flex flex-col sm:flex-row bg-surface-hover/40 rounded-lg overflow-hidden border border-border-light/50 group-hover:border-primary/50 transition-colors h-full sm:h-32">
        {data.image ? (
          <div className="sm:w-32 h-40 sm:h-full shrink-0 bg-surface-hover relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.image} alt="Preview" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          </div>
        ) : (
          <div className="sm:w-32 h-32 shrink-0 bg-surface-hover flex items-center justify-center">
            <LinkIcon className="text-text-darker w-8 h-8" />
          </div>
        )}
        <div className="p-4 flex flex-col justify-center flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-text-secondary line-clamp-2 group-hover:text-primary-lighter transition-colors">
            {data.title || data.url}
          </h4>
          {data.description && (
            <p className="text-xs text-text-muted mt-1.5 line-clamp-2">{data.description}</p>
          )}
          <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium mt-2 block truncate">
            {safeHostname(data.url)}
          </span>
        </div>
      </div>
    </a>
  );
}

function safeHostname(url: string) {
  try {
    return new URL(url).hostname || "External Link";
  } catch {
    return "External Link";
  }
}
