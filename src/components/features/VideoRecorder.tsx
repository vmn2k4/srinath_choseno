"use client";

import React, { useState, useRef } from "react";
import { Video, StopCircle, RefreshCw, Upload, FileVideo, ShieldAlert } from "lucide-react";
import { uploadVideo, getVideoPublicUrl, normalizeMediaUrl } from "@/lib/services/video";
import { Button } from "@/components/primitives";
import { createClient } from "@/lib/supabase/client";

export default function VideoRecorder({
  onVideoUploaded,
  maxDuration = 30,
  bucket = "politician_videos",
}: {
  onVideoUploaded: (url: string) => void;
  maxDuration?: number;
  bucket?: string;
}) {
  const supabase = createClient();
  const [isRecording, setIsRecording] = useState(false);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(maxDuration);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const startRecording = async () => {
    setCameraError(null);
    try {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== "function"
      ) {
        setCameraError(
          "Camera recording requires accessing via http://localhost:3000 or HTTPS. Please click 'Select File' below to pick a video."
        );
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          aspectRatio: { ideal: 9 / 16 },
          width: { ideal: 720 },
          height: { ideal: 1280 },
          facingMode: "user",
        },
        audio: true,
      });
      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setVideoBlob(blob);
        chunksRef.current = [];

        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = null;
          videoPreviewRef.current.src = URL.createObjectURL(blob);
          videoPreviewRef.current.controls = true;
          videoPreviewRef.current.play();
        }

        stream.getTracks().forEach((track) => track.stop());
      };

      chunksRef.current = [];
      mediaRecorder.start();
      setIsRecording(true);
      setTimeLeft(maxDuration);

      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      console.warn("Camera access failed:", err);
      // getUserMedia rejects for several distinct reasons that all deserve
      // different guidance -- a single generic "use HTTPS/localhost" message
      // was being shown for all of them, including permission denials on a
      // page that was already on http://localhost:3000, which just pointed
      // the user back at what they were already doing instead of the actual
      // fix.
      if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
        setCameraError(
          "Camera/microphone access was denied. Check your browser's site permissions for this page (and, if that's already set to Allow, your OS's camera privacy settings for this browser) then reload the page — or use Select File below to upload a video instead."
        );
      } else if (err?.name === "NotFoundError" || err?.name === "OverconstrainedError") {
        setCameraError(
          "No camera was found on this device. Use Select File below to upload a video instead."
        );
      } else if (
        typeof navigator !== "undefined" &&
        typeof window !== "undefined" &&
        !window.isSecureContext
      ) {
        setCameraError(
          "Camera recording requires HTTPS or http://localhost. Use Select File below to upload a video instead."
        );
      } else {
        setCameraError(
          (err?.message ? `Camera access failed: ${err.message}` : "Camera access failed.") +
            " Use Select File below to upload a video instead."
        );
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const retakeVideo = () => {
    setVideoBlob(null);
    setCameraError(null);
    if (videoPreviewRef.current) {
      videoPreviewRef.current.src = "";
      videoPreviewRef.current.controls = false;
    }
  };

  const [aspectWarning, setAspectWarning] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      alert("Video file size must be less than 50MB");
      return;
    }
    setAspectWarning(null);

    // Recorded answers already come out 9:16 (getUserMedia constraints
    // above) — this is the one path (a plain file upload) with no built-in
    // guarantee of that, so it's the only place that needs a check. Reads
    // the file's real dimensions off a throwaway <video> element rather than
    // trusting the container/aspect metadata, since that's what actually
    // renders. Warns rather than hard-blocking — some legitimate footage is
    // shot slightly off 9:16 and still worth accepting, this is a nudge
    // toward the shorts format the interview player expects, not a rejection.
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      const { videoWidth: w, videoHeight: h } = probe;
      URL.revokeObjectURL(probe.src);
      if (w && h) {
        const ratio = w / h;
        const target = 9 / 16;
        if (Math.abs(ratio - target) / target > 0.1) {
          setAspectWarning(
            `This video is ${w}×${h} (not vertical 9:16 "shorts" format) — it may be cropped when played back.`
          );
        }
      }
    };
    probe.src = URL.createObjectURL(file);

    setVideoBlob(file);
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
      videoPreviewRef.current.src = URL.createObjectURL(file);
      videoPreviewRef.current.controls = true;
    }
  };

  const handleUpload = async () => {
    if (!videoBlob) return;
    setUploading(true);
    try {
      const ext = (videoBlob as File).name?.split(".").pop() || "webm";
      const fileName = `video_${Date.now()}.${ext}`;
      const { error } = await uploadVideo(supabase, bucket, fileName, videoBlob);
      if (error) throw error;

      const { data: publicUrlData } = getVideoPublicUrl(supabase, bucket, fileName);
      onVideoUploaded(normalizeMediaUrl(publicUrlData.publicUrl));
    } catch (error: any) {
      console.error("Error uploading video:", error);
      alert("Failed to upload video: " + (error?.message || "Storage upload failed"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto bg-surface-elevated/90 rounded-2xl p-4 border border-border-light/40 flex flex-col items-center justify-center gap-3 my-3 shadow-md">
      {/* 9:16 Vertical Video Preview Box */}
      <div
        className="relative w-48 sm:w-56 bg-black/90 rounded-2xl overflow-hidden border border-border-light/40 flex items-center justify-center shadow-lg"
        style={{ aspectRatio: "9 / 16" }}
      >
        <video
          ref={videoPreviewRef}
          className="w-full h-full object-cover bg-black"
          muted={isRecording}
          playsInline
        />

        {!isRecording && !videoBlob && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted gap-1.5 p-3 text-center">
            <Video size={24} className="text-primary/70" />
            <span className="text-xs font-medium">Record or upload a {maxDuration}s pitch</span>
          </div>
        )}

        {isRecording && (
          <div className="absolute top-2 right-2 bg-danger/90 text-white px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 animate-pulse shadow-md">
            <div className="w-2 h-2 bg-white rounded-full" />
            00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
          </div>
        )}
      </div>

      {aspectWarning && (
        <div className="p-2.5 bg-warning/10 border border-warning/30 rounded-xl text-[11px] text-warning-light flex items-start gap-2 max-w-xs">
          <ShieldAlert size={15} className="shrink-0 mt-0.5 text-warning" />
          <span>{aspectWarning}</span>
        </div>
      )}

      {cameraError && (
        <div className="p-2.5 bg-warning/10 border border-warning/30 rounded-xl text-[11px] text-warning-light flex items-start gap-2 max-w-xs">
          <ShieldAlert size={15} className="shrink-0 mt-0.5 text-warning" />
          <span>{cameraError}</span>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex items-center gap-2 w-full justify-center flex-wrap">
        {!isRecording && !videoBlob && (
          <>
            <Button type="button" size="sm" onClick={startRecording} className="rounded-xl gap-1.5 text-xs">
              <Video size={14} />
              Camera
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl gap-1.5 text-xs"
            >
              <FileVideo size={14} />
              Select File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </>
        )}

        {isRecording && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={stopRecording}
            className="rounded-xl gap-1.5 text-danger border-danger/40 text-xs"
          >
            <StopCircle size={14} />
            Stop Recording
          </Button>
        )}

        {videoBlob && !uploading && (
          <>
            <Button type="button" variant="outline" size="sm" onClick={retakeVideo} className="gap-1.5 text-xs">
              <RefreshCw size={13} />
              Reset
            </Button>
            <Button type="button" size="sm" onClick={handleUpload} className="gap-1.5 text-xs">
              <Upload size={13} />
              Upload & Attach
            </Button>
          </>
        )}

        {uploading && (
          <div className="flex items-center gap-2 text-primary-light font-medium px-3 py-1.5 bg-primary/10 rounded-xl text-xs">
            <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Uploading video...
          </div>
        )}
      </div>
    </div>
  );
}
