"use client";

import { useState } from "react";
import { Camera, RefreshCw } from "lucide-react";
import Button from "@/components/primitives/Button";

// Extracted from StepPolitician.jsx's avatar upload control. Unlike
// MediaAttachButton (which defers upload to the caller), this uploads
// immediately on selection — the "preview" is the already-uploaded remote
// URL (`value`), not a local blob. The actual upload call is injected via
// `onUpload` (a service function wired in by the page, e.g.
// `uploadAvatarImage`) so this component has no direct Supabase dependency.
export default function AvatarUploader({
  value,
  onUpload,
  onChange,
  maxSizeMb = 5,
  id = "avatar-upload-input",
}: {
  value?: string | null;
  onUpload: (file: File) => Promise<{ publicUrl: string | null; error: unknown }>;
  onChange: (url: string) => void;
  maxSizeMb?: number;
  id?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`Image must be less than ${maxSizeMb}MB`);
      return;
    }

    setError(null);
    setUploading(true);
    const { publicUrl, error: uploadError } = await onUpload(file);
    setUploading(false);

    if (uploadError || !publicUrl) {
      setError("Failed to upload image. Please try again.");
      return;
    }
    onChange(publicUrl);
  };

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16 rounded-full bg-surface-hover border border-border-light flex items-center justify-center overflow-hidden shrink-0">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <Camera size={20} className="text-text-muted" />
          )}
          {uploading && (
            <div className="absolute inset-0 bg-surface/70 flex items-center justify-center">
              <RefreshCw size={16} className="animate-spin text-text-muted" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input type="file" accept="image/*" id={id} className="hidden" onChange={handleSelect} />
          <label htmlFor={id}>
            <Button as="span" variant="outline" size="sm" className="cursor-pointer">
              {value ? "Replace Photo" : "Upload Photo"}
            </Button>
          </label>
          {value && (
            <Button variant="ghost" size="sm" onClick={() => onChange("")}>
              Remove
            </Button>
          )}
        </div>
      </div>
      {error && <p className="text-danger-light text-xs mt-2">{error}</p>}
    </div>
  );
}
