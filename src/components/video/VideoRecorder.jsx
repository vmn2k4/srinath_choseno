import React, { useState, useRef } from 'react';
import { Video, StopCircle, RefreshCw, Upload } from 'lucide-react';
import { uploadVideo, getVideoPublicUrl } from '../../services/video';
import { Button } from '../ui';

export default function VideoRecorder({ onVideoUploaded, maxDuration = 30, bucket = 'politician_videos' }) {
  const [isRecording, setIsRecording] = useState(false);
  const [videoBlob, setVideoBlob] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(maxDuration);

  const mediaRecorderRef = useRef(null);
  const videoPreviewRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }

      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setVideoBlob(blob);
        chunksRef.current = [];
        
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = null;
          videoPreviewRef.current.src = URL.createObjectURL(blob);
          videoPreviewRef.current.controls = true;
          videoPreviewRef.current.play();
        }

        // Stop all tracks to release camera
        stream.getTracks().forEach(track => track.stop());
      };

      chunksRef.current = [];
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setTimeLeft(maxDuration);

      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera/microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const retakeVideo = () => {
    setVideoBlob(null);
    if (videoPreviewRef.current) {
      videoPreviewRef.current.src = '';
      videoPreviewRef.current.controls = false;
    }
  };

  const handleUpload = async () => {
    if (!videoBlob) return;
    setUploading(true);
    try {
      const fileName = `video_${Date.now()}.webm`;

      const { data, error } = await uploadVideo(bucket, fileName, videoBlob);

      if (error) throw error;

      const { data: publicUrlData } = getVideoPublicUrl(bucket, fileName);

      onVideoUploaded(publicUrlData.publicUrl);
    } catch (error) {
      console.error('Error uploading video:', error);
      alert('Failed to upload video.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full bg-background rounded-xl p-4 border border-primary/30 flex flex-col items-center justify-center gap-4 mb-4">

      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-border flex items-center justify-center">
        <video 
          ref={videoPreviewRef} 
          className="w-full h-full object-contain"
          muted={isRecording}
        />
        
        {!isRecording && !videoBlob && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted gap-2">
            <Video size={32} />
            <span className="text-sm">Record a {maxDuration}-sec pitch</span>
          </div>
        )}

        {isRecording && (
          <div className="absolute top-4 right-4 bg-danger/90 text-white px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2 animate-pulse">
            <div className="w-2 h-2 bg-white rounded-full" />
            00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 w-full justify-center">
        {!isRecording && !videoBlob && (
          <Button type="button" variant="danger" onClick={startRecording} className="rounded-full">
            <Video size={18} />
            Start Recording
          </Button>
        )}

        {isRecording && (
          <Button type="button" variant="secondary" onClick={stopRecording} className="rounded-full">
            <StopCircle size={18} />
            Stop
          </Button>
        )}

        {videoBlob && !uploading && (
          <>
            <Button type="button" variant="outline" size="sm" onClick={retakeVideo}>
              <RefreshCw size={16} />
              Retake
            </Button>
            <Button type="button" size="sm" onClick={handleUpload}>
              <Upload size={16} />
              Attach to Post
            </Button>
          </>
        )}

        {uploading && (
          <div className="flex items-center gap-2 text-primary-light font-medium px-4 py-2 bg-primary/10 rounded-lg">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Uploading...
          </div>
        )}
      </div>
    </div>
  );
}
