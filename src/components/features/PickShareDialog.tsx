"use client";

import { useState } from "react";
import { Check, Heart } from "lucide-react";
import { Modal, Button, Avatar, Input, Textarea, Alert } from "@/components/primitives";
import ShareMenu, { type ShareData } from "./ShareMenu";
import { createClient } from "@/lib/supabase/client";
import { createRacePickShare, PICK_SHARE_NOTE_MAX, PICK_SHARE_NAME_MAX } from "@/lib/services/pickShares";
import { getOrCreateAnonSupporterId } from "@/lib/utils/anonSupporter";
import { trackShare } from "@/lib/analytics/events";
import { SITE_URL } from "@/lib/constants/site";
import { joinNames, pickSharePath, type PickRosterCandidate } from "@/lib/utils/pickShare";

const NAME_STORAGE_KEY = "choseno_pick_share_name";

function readStoredName(): string {
  try {
    return window.localStorage.getItem(NAME_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function cleanTag(s: string) {
  return s.replace(/[^a-zA-Z0-9]/g, "");
}

// "Circle your picks" share flow: choose one or more candidates in a race,
// add an optional note, get a /p/<code> link whose OG image highlights the
// picks. Reuses ShareMenu for every destination (copy, X, WhatsApp, ...).
export default function PickShareDialog({
  seat,
  roster,
  initialPickedIds = [],
  onClose,
}: {
  seat: { id: string; role_title?: string | null; map_shapes?: { name?: string | null } | null };
  roster: PickRosterCandidate[];
  initialPickedIds?: string[];
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string[]>(initialPickedIds);
  // Per-candidate "why I support them" notes, keyed by candidacy id.
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [imgLoaded, setImgLoaded] = useState(false);
  // Lazy initializer so the stored name is read once on mount, client-only.
  const [name, setName] = useState(readStoredName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const roleTitle = seat.role_title || "this race";
  const place = seat.map_shapes?.name || "";
  const pickedNames = picked
    .map((id) => roster.find((c) => c.id === id)?.name)
    .filter((n): n is string => Boolean(n));

  function toggle(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleCreate() {
    if (picked.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    const trimmedName = name.trim();
    const { data, error: rpcError } = await createRacePickShare(createClient(), {
      seatId: seat.id,
      picks: picked.map((id) => ({ candidateId: id, note: (notes[id] || "").trim() })),
      authorLabel: trimmedName,
      anonId: getOrCreateAnonSupporterId(),
    });
    setSubmitting(false);
    if (rpcError || !data) {
      setError(rpcError?.message || "Couldn't create your share. Please try again.");
      return;
    }
    try {
      window.localStorage.setItem(NAME_STORAGE_KEY, trimmedName);
    } catch {
      // storage unavailable: the name just isn't remembered
    }
    trackShare("race_pick_share_created", data);
    setCode(data);
  }

  const firstNote = picked.map((id) => (notes[id] || "").trim()).find(Boolean);
  const previewTitle = `${name.trim() || "A Choseno voter"} supports ${joinNames(pickedNames)}${
    roleTitle ? ` — ${roleTitle}${place ? `, ${place}` : ""}` : ""
  }`;
  const previewDescription = firstNote
    ? `“${firstNote}” See everyone running and make your own picks on Choseno.`
    : "See everyone running and make your own picks on Choseno.";

  let shareData: ShareData | null = null;
  if (code) {
    // utm params ride on the link people click so first-touch signup
    // attribution (signupSource.ts) can credit pick shares.
    const url = `${SITE_URL}${pickSharePath(code)}?utm_source=pick_share&utm_medium=social`;
    const noteLines = picked
      .map((id) => ({ name: roster.find((c) => c.id === id)?.name, note: (notes[id] || "").trim() }))
      .filter((l) => l.name && l.note)
      .map((l) => `• ${l.name}: “${l.note}”`);
    const headline = `I'm backing ${joinNames(pickedNames)} for ${roleTitle}${place ? ` in ${place}` : ""}.`;
    const basePostText = `${headline}${noteLines.length ? `\n\n${noteLines.join("\n")}` : ""}\n\nSee everyone running and make your own picks:`;
    const hashtags = Array.from(new Set([cleanTag(roleTitle) || "Election", cleanTag(place), "Vote2026", "Choseno"].filter(Boolean)));
    const hashtagList = hashtags.map((t) => `#${t}`).join(" ");
    shareData = {
      url,
      basePostText,
      hashtagList,
      shareText: `${basePostText}\n\n${hashtagList}\n${url}`,
      hashtags,
      twitterUrl: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${headline} See everyone running:`)}&url=${encodeURIComponent(
        url
      )}&hashtags=${encodeURIComponent(hashtags.join(","))}`,
      imageUrl: `${SITE_URL}${pickSharePath(code)}/opengraph-image`,
    };
  }

  return (
    <Modal
      onOverlayClick={onClose}
      className="bg-surface rounded-2xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4 shadow-xl"
    >
      <div className="flex items-center gap-2 text-text-main font-bold">
        <Heart size={16} className="text-primary" />
        {code ? "Your picks are ready to share" : "Share your picks"}
      </div>

      {code && shareData ? (
        <>
          <p className="text-sm text-text-secondary">
            You&apos;re backing <strong className="text-text-main">{joinNames(pickedNames)}</strong>. This is how your link
            will look when friends see it:
          </p>

          {/* WhatsApp-style link preview mock. Deliberately uses WhatsApp's own
              colours (an imitation of a third-party UI, not our theme) and the
              real generated OG image, so what you see is what they get. */}
          <div className="rounded-xl p-3" style={{ backgroundColor: "#e5ddd5" }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#667781" }}>
              WhatsApp preview
            </p>
            <div className="ml-auto max-w-[92%] rounded-lg p-1 shadow-sm" style={{ backgroundColor: "#d9fdd3", color: "#111b21" }}>
              <div className="rounded-md overflow-hidden" style={{ backgroundColor: "#c5eebd" }}>
                <div className="relative w-full" style={{ aspectRatio: "1200 / 630", backgroundColor: "#b6dcae" }}>
                  {!imgLoaded && (
                    <span className="absolute inset-0 flex items-center justify-center text-[11px]" style={{ color: "#667781" }}>
                      Generating your image…
                    </span>
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${pickSharePath(code)}/opengraph-image`}
                    alt="Preview of your shared picks"
                    onLoad={() => setImgLoaded(true)}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                  />
                </div>
                <div className="px-2.5 py-2">
                  <p className="text-[13px] font-semibold leading-snug line-clamp-2">{previewTitle}</p>
                  <p className="text-xs leading-snug line-clamp-2" style={{ color: "#54656f" }}>
                    {previewDescription}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: "#667781" }}>
                    choseno.com
                  </p>
                </div>
              </div>
              <p className="px-1.5 pt-1 pb-0.5 text-[13px] leading-snug break-all" style={{ color: "#027eb5" }}>
                {shareData.url}
              </p>
              <p className="px-1.5 pb-0.5 text-[10px] text-right" style={{ color: "#667781" }}>
                now
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ShareMenu
              articleId={code}
              shareData={shareData}
              label="Share my picks"
              triggerTitle="Share my picks"
              shareTitle={`${roleTitle}${place ? ` — ${place}` : ""}`}
              menuAlign="below"
              iconSize={16}
              onShare={(platform) => trackShare("race_pick_share", platform ? `${code}:${platform}` : code)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-text-on-primary font-extrabold text-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
            />
            <a
              href={pickSharePath(code)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-primary hover:text-primary-hover"
            >
              Preview page
            </a>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCode(null);
                setImgLoaded(false);
              }}
            >
              Edit picks
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-text-secondary">
            Pick the candidates you support in <strong className="text-text-main">{roleTitle}</strong>
            {place ? ` (${place})` : ""}. You can choose more than one, and tell people why you support each.
          </p>

          <ul className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1">
            {roster.map((c) => {
              const on = picked.includes(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(c.id)}
                    className={`w-full flex items-center gap-3 rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
                      on ? "border-primary bg-primary/10" : "border-border-light/40 bg-surface/20 hover:bg-surface-hover"
                    }`}
                  >
                    <Avatar src={c.avatarUrl} name={c.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-text-main truncate">{c.name}</span>
                      {c.partyName && <span className="block text-xs text-text-muted truncate">{c.partyName}</span>}
                    </span>
                    <span
                      className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        on ? "bg-primary border-primary text-text-on-primary" : "border-border-light"
                      }`}
                    >
                      {on && <Check size={14} />}
                    </span>
                  </button>
                  {on && (
                    <div className="mt-1.5 pl-2 pr-1 pb-1">
                      <label htmlFor={`pick-note-${c.id}`} className="sr-only">
                        Why do you support {c.name}?
                      </label>
                      <Textarea
                        id={`pick-note-${c.id}`}
                        rows={2}
                        maxLength={PICK_SHARE_NOTE_MAX}
                        value={notes[c.id] || ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        placeholder={`Why do you support ${c.name.split(" ")[0]}? (optional)`}
                      />
                      <p className="text-[11px] text-text-muted text-right">
                        {(notes[c.id] || "").length}/{PICK_SHARE_NOTE_MAX} · no links please
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="space-y-1">
            <label htmlFor="pick-share-name" className="text-xs font-semibold text-text-main">
              Your name <span className="font-normal text-text-muted">(optional — first name or nickname)</span>
            </label>
            <Input
              id="pick-share-name"
              maxLength={PICK_SHARE_NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Shown as “Sam is backing…”"
            />
          </div>

          <p className="text-[11px] text-text-muted">
            Your picks are your personal opinion and are shown publicly on a shareable page. Choseno doesn&apos;t endorse
            candidates.
          </p>

          {error && <Alert tone="danger">{error}</Alert>}

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={picked.length === 0 || submitting}>
              {submitting ? "Creating..." : `Create share${picked.length ? ` (${picked.length})` : ""}`}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
