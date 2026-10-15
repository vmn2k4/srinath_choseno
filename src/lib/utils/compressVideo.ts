// Client-side video downscale + re-encode so pitch uploads fit the 50MB
// politician_videos bucket limit (and play quickly on mobile data). Plays the
// file into a canvas at reduced size and records that with MediaRecorder at a
// capped bitrate, so it runs in real time (a 30s clip takes ~30s) and needs no
// extra dependency. Always falls back to the original file when the browser
// can't do it or the result isn't smaller — callers never lose the upload.

const MAX_LONG_SIDE = 960; // px — plenty for a phone-screen pitch
const VIDEO_BPS = 1_000_000;
const AUDIO_BPS = 64_000;
const SKIP_BELOW_BYTES = 4 * 1024 * 1024; // already small — don't re-encode

export const RECORDER_BITRATES = { videoBitsPerSecond: VIDEO_BPS, audioBitsPerSecond: AUDIO_BPS };

// MP4 (H.264) first: iPhones and the mobile app can't play WebM, while MP4
// plays everywhere (Chrome 126+ and Safari can record it; older Chrome and
// Firefox fall back to WebM).
export function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const t of [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return null;
}

export async function compressVideo(
  file: File | Blob,
  onProgress?: (fraction: number) => void
): Promise<File | Blob> {
  const mimeType = pickMimeType();
  if (!mimeType || file.size <= SKIP_BELOW_BYTES || typeof document === "undefined") return file;

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true; // allowed to autoplay; audio is taken from captureStream, not the speakers
  video.playsInline = true;
  video.preload = "auto";

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("unreadable video"));
    });

    const { videoWidth: w, videoHeight: h, duration } = video;
    if (!w || !h || !Number.isFinite(duration)) return file;

    const scale = Math.min(1, MAX_LONG_SIDE / Math.max(w, h));
    const cw = Math.round((w * scale) / 2) * 2;
    const ch = Math.round((h * scale) / 2) * 2;
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    const capture = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream;
    if (!capture) return file;
    const audioTracks = capture.call(video).getAudioTracks();
    const out = canvas.captureStream(30);
    audioTracks.forEach((t) => out.addTrack(t));

    const recorder = new MediaRecorder(out, { mimeType, ...RECORDER_BITRATES });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    const finished = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));

    let raf = 0;
    const draw = () => {
      ctx.drawImage(video, 0, 0, cw, ch);
      onProgress?.(Math.min(1, video.currentTime / duration));
      if (!video.ended) raf = requestAnimationFrame(draw);
    };

    recorder.start(1000);
    await video.play();
    draw();
    await new Promise<void>((resolve) => (video.onended = () => resolve()));
    cancelAnimationFrame(raf);
    recorder.stop();
    await finished;

    const result = new Blob(chunks, { type: mimeType.split(";")[0] });
    return result.size > 0 && result.size < file.size ? result : file;
  } catch {
    return file;
  } finally {
    video.pause();
    URL.revokeObjectURL(url);
  }
}
