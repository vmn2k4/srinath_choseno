import { Image as ImageIcon } from "lucide-react";

// Extracted from FeedPage.jsx's composer image-attach control: a hidden
// file input + icon label trigger, with a 5MB client-side gate and a
// FileReader-based local data-URL preview. Deliberately does NOT perform
// the actual upload or manage preview/RemoveMediaButton rendering itself —
// FeedPage.jsx defers the real upload to submit time and owns
// imageFile/imagePreview as its own state, so this stays a thin trigger
// that just hands the caller a File + local preview URL via one callback.
export default function MediaAttachButton({
  onFileSelected,
  accept = "image/*",
  maxSizeMb = 5,
  id = "media-attach-input",
  title = "Attach Image",
}: {
  onFileSelected: (file: File, previewDataUrl: string) => void;
  accept?: string;
  maxSizeMb?: number;
  id?: string;
  title?: string;
}) {
  return (
    <>
      <input
        type="file"
        accept={accept}
        id={id}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > maxSizeMb * 1024 * 1024) {
            alert(`Image must be less than ${maxSizeMb}MB`);
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => onFileSelected(file, reader.result as string);
          reader.readAsDataURL(file);
          // Allow re-selecting the same file after a remove.
          e.target.value = "";
        }}
      />
      <label
        htmlFor={id}
        className="p-2 text-text-muted hover:bg-surface-hover hover:text-primary-light rounded-xl cursor-pointer transition-colors"
        title={title}
      >
        <ImageIcon size={18} />
      </label>
    </>
  );
}
