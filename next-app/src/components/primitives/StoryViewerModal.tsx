import Modal from "./Modal";

// Full-screen video/story viewer — previously duplicated identically in
// CandidacyWall.jsx and FeedPage.jsx.
export default function StoryViewerModal({
  url,
  onClose,
}: {
  url?: string | null;
  onClose: () => void;
}) {
  if (!url) return null;

  return (
    <Modal overlayClassName="bg-overlay-heavy backdrop-blur-sm" zIndexClassName="z-[100]">
      <div className="relative max-w-sm w-full bg-surface rounded-2xl overflow-hidden shadow-2xl border border-border-light">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-black/50 hover:bg-black/80 rounded-full text-white transition-colors"
        >
          ✕
        </button>
        <video src={url} controls autoPlay className="w-full max-h-[85vh] object-contain bg-black" />
      </div>
    </Modal>
  );
}
