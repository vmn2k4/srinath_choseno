import { Send } from "lucide-react";
import Input from "@/components/primitives/Input";
import Button from "@/components/primitives/Button";

// Extracted from the near-identical comment-input row duplicated in
// FeedPage.jsx and WallPostFeed.jsx (Enter-to-submit text input + icon send
// button, disabled while empty). Used both inside PostCard and standalone
// (e.g. a candidacy answer's own comment thread, which isn't post-shaped).
export default function CommentComposer({
  value,
  onChange,
  onSubmit,
  placeholder = "Write an anonymous comment...",
  size = "md",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`.trim()}>
      <Input
        type="text"
        size={size}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
        }}
        placeholder={placeholder}
        className="flex-1"
      />
      <Button variant="icon" tone="primary" onClick={onSubmit} disabled={!value.trim()}>
        <Send size={size === "sm" ? 14 : 16} />
      </Button>
    </div>
  );
}
