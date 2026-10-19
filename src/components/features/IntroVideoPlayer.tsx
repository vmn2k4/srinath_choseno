"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2, Play, Volume2, VolumeX } from "lucide-react";
import { parseYouTubeId } from "@/lib/utils/youtube";
import { facebookVideoEmbedUrl } from "@/lib/utils/facebookVideo";

// Intro videos are vertical shorts, so both branches are sized as portrait
// (9:16, capped width) rather than a full-width landscape player.
// Plays a candidate's intro_video_url, which is an uploaded file, a YouTube
// link, or a Facebook video link -- all of them play inside the site. YouTube uses the same privacy-enhanced embed as the home-page
// demo (HomeDemoVideo), behind a click-to-play thumbnail so no YouTube
// requests happen until the viewer presses play.
export default function IntroVideoPlayer({
  url,
  className = "max-h-[26rem] max-w-full rounded-xl bg-black",
  autoPlay = false,
  wide = false,
}: {
  url: string;
  className?: string;
  // YouTube only. Starts playing on mount as a clean, muted, looping clip
  // with YouTube's own controls/captions/annotations switched off and the
  // iframe non-interactive (so hover controls can't appear). Skips the
  // click-to-play thumbnail, so YouTube loads as soon as this mounts.
  autoPlay?: boolean;
  // Use the full width of the container instead of the 260px cap.
  wide?: boolean;
}) {
  const [playing, setPlaying] = useState(autoPlay);
  // autoPlay mode only: our own sound + full-screen buttons over the clean
  // (controls-off) YouTube frame. Sound is toggled through YouTube's iframe
  // postMessage API (enablejsapi=1 below), full screen on the wrapper div so
  // the overlay buttons stay available inside it.
  const wrapRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [muted, setMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanFullscreen(typeof document !== "undefined" && document.fullscreenEnabled === true);
    const onChange = () => setIsFullscreen(document.fullscreenElement === wrapRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleMute = () => {
    const next = !muted;
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: next ? "mute" : "unMute", args: [] }),
      "*"
    );
    if (!next) {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: "playVideo", args: [] }),
        "*"
      );
    }
    setMuted(next);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapRef.current?.requestFullscreen?.();
  };
  const youTubeId = parseYouTubeId(url);
  const facebookEmbed = youTubeId ? null : facebookVideoEmbedUrl(url, true);

  if (!youTubeId && !facebookEmbed) return <video src={url} controls className={className} />;

  // Facebook has no public thumbnail URL, so it gets a plain click-to-play
  // card; the player (and any Facebook request) only loads once pressed.
  if (facebookEmbed) {
    return (
      <div className="relative w-full max-w-[260px] aspect-[9/16] rounded-xl overflow-hidden bg-black">
        {playing ? (
          <iframe
            className="absolute inset-0 w-full h-full border-0"
            src={facebookEmbed}
            title="Candidate intro video"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 w-full h-full cursor-pointer flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-surface via-surface-hover to-surface-active"
            aria-label="Play intro video"
          >
            <span className="w-16 h-16 rounded-full bg-primary text-text-on-primary flex items-center justify-center shadow-xl transition-transform group-hover:scale-110">
              <Play className="w-7 h-7 fill-current translate-x-0.5" aria-hidden="true" />
            </span>
            <span className="text-xs font-semibold text-text-secondary">Play video</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className={`relative w-full ${isFullscreen ? "" : `${wide ? "max-w-[340px]" : "max-w-[260px]"} aspect-[9/16] rounded-xl`} overflow-hidden bg-black`}
    >
      {playing ? (
        <iframe
          ref={iframeRef}
          className={`absolute inset-0 w-full h-full border-0 ${autoPlay ? "pointer-events-none" : ""}`}
          src={`https://www.youtube-nocookie.com/embed/${youTubeId}?autoplay=1&rel=0&modestbranding=1&playsinline=1${autoPlay ? `&enablejsapi=1&mute=1&loop=1&playlist=${youTubeId}&controls=0&fs=0&disablekb=1&iv_load_policy=3&cc_load_policy=0` : ""}`}
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
      {autoPlay && playing && (
        <div className="absolute top-2 right-2 z-10 flex gap-1.5">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Unmute video" : "Mute video"}
            className="w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          {canFullscreen && (
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
              className="w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}