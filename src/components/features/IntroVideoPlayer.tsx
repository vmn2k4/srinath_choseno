"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { parseYouTubeId } from "@/lib/utils/youtube";

// Plays a candidate's intro_video_url, which is either an uploaded file or a
// YouTube link. YouTube uses the same privacy-enhanced embed as the home-page
// demo (HomeDemoVideo), behind a click-to-play thumbnail so no YouTube
// requests happen until the viewer presses play.
export default function IntroVideoPlayer({
  url,
  className = "w-full max-h-64 rounded-lg bg-black",
}: {
  url: string;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const youTubeId = parseYouTubeId(url);

  if (!youTubeId) return <video src={url} controls className={className} />;

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
      {playing ? (
        <iframe
          className="absolute inset-0 w-full h-full border-0"
          src={`https://www.youtube-nocookie.com/embed/${youTubeId}?autoplay=1&rel=0&modestbranding=1`}
          title="Candidate intro video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group absolute inset-0 w-full h-full cursor-pointer"
          aria-label="Play intro video"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.ytimg.com/vi/${youTubeId}/hqdefault.jpg`}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <span className="absolute inset-0 bg-black/25 group-hover:bg-black/10 transition-colors" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-16 h-16 rounded-full bg-primary text-text-on-primary flex items-center justify-center shadow-xl transition-transform group-hover:scale-110">
              <Play className="w-7 h-7 fill-current translate-x-0.5" aria-hidden="true" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
