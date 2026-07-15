import React, { useState, useEffect } from 'react';
import { Link as LinkIcon, Image as ImageIcon, PlayCircle } from 'lucide-react';

export default function LinkPreview({ url, metadata, onMetadataFetched }) {
  const [data, setData] = useState(metadata || null);
  const [loading, setLoading] = useState(!metadata);
  const [error, setError] = useState(false);

  useEffect(() => {
    // If metadata is already provided (e.g. rendering a saved post), just use it.
    if (metadata) {
      setData(metadata);
      setLoading(false);
      return;
    }

    // Otherwise, fetch from Microlink API
    let ignore = false;
    async function fetchMetadata() {
      if (!url) return;
      setLoading(true);
      try {
        const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}&audio=false&video=true`);
        const json = await res.json();
        if (!ignore && json.status === 'success') {
          const fetchedData = {
            title: json.data.title,
            description: json.data.description,
            image: json.data.image?.url || json.data.logo?.url,
            video: json.data.video?.url,
            url: json.data.url
          };
          setData(fetchedData);
          if (onMetadataFetched) {
            onMetadataFetched(fetchedData);
          }
        } else {
          setError(true);
        }
      } catch (err) {
        if (!ignore) setError(true);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    
    fetchMetadata();
    
    return () => { ignore = true; };
  }, [url, metadata]);

  if (error || (!loading && !data)) return null;

  if (loading) {
    return (
      <div className="w-full h-24 rounded-lg bg-slate-800/50 animate-pulse flex items-center justify-center border border-slate-700/50 my-3">
        <LinkIcon className="text-slate-600 w-6 h-6" />
      </div>
    );
  }

  // If it's a direct video link or a site with a video preview
  if (data.video) {
    return (
      <div className="my-3 rounded-lg overflow-hidden border border-slate-700 bg-black">
        <video src={data.video} controls className="w-full max-h-96 object-contain" />
        <div className="p-3 bg-slate-900 border-t border-slate-800">
          <h4 className="text-sm font-semibold text-slate-200 line-clamp-1">{data.title || data.url}</h4>
          <p className="text-xs text-slate-400 mt-1 line-clamp-1">{data.description || new URL(data.url).hostname}</p>
        </div>
      </div>
    );
  }

  return (
    <a href={data.url} target="_blank" rel="noopener noreferrer" className="block my-3 group">
      <div className="flex flex-col sm:flex-row bg-slate-800/40 rounded-lg overflow-hidden border border-slate-700/50 group-hover:border-indigo-500/50 transition-colors h-full sm:h-32">
        {data.image ? (
          <div className="sm:w-32 h-40 sm:h-full shrink-0 bg-slate-800 relative">
            <img src={data.image} alt="Preview" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="sm:w-32 h-32 shrink-0 bg-slate-800 flex items-center justify-center">
            <LinkIcon className="text-slate-600 w-8 h-8" />
          </div>
        )}
        <div className="p-4 flex flex-col justify-center flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-slate-200 line-clamp-2 group-hover:text-indigo-300 transition-colors">{data.title || data.url}</h4>
          {data.description && (
            <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{data.description}</p>
          )}
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium mt-2 block truncate">
            {new URL(data.url).hostname}
          </span>
        </div>
      </div>
    </a>
  );
}
