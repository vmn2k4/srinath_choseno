"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Ghost, ShieldCheck, ThumbsUp, MapPin } from "lucide-react";
import { Card } from "@/components/primitives";
import { useTranslation } from "@/contexts/LanguageContext";

// A looping, illustrative preview of what the product *is* -- a feed of
// anonymous opinions scoped to a district -- shown in the hero instead of
// describing it. One new opinion slides in every few seconds; the newest one
// gets "supported" a beat later, so the whole loop demonstrates the verbs the
// visitor is being asked to do (post as a Ghost, get support, move on).
// Copy is clearly labelled as an example -- these are not live posts.

type PreviewPost = { ghost: string; area: string; body: string; support: number };

const POSTS: PreviewPost[] = [
  {
    ghost: "Ghost-CandidFalcon",
    area: "Your riding",
    body: "The potholes on our main road have been there two years. Where is the money from the last tax increase going?",
    support: 214,
  },
  {
    ghost: "Ghost-QuietHeron",
    area: "Your ward",
    body: "First time my councillor has done something I actually agree with. The new bus route is overdue.",
    support: 168,
  },
  {
    ghost: "Ghost-SturdyOtter",
    area: "Your district",
    body: "Candidates should answer housing questions on video before the vote, not after it.",
    support: 97,
  },
  {
    ghost: "Ghost-NimbleWren",
    area: "Your riding",
    body: "I don't want a fight in the comments. I just want my local rep to know the clinic hours matter to me.",
    support: 141,
  },
];

const ROTATE_MS = 3600;
const SUPPORT_DELAY_MS = 1500;
const STACK_SIZE = 3;

function PostRow({ post, depth, live }: { post: PreviewPost; depth: number; live: boolean }) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  // Only the newest card plays the "support" tap; older ones keep whatever
  // state they ended in (supported), so the count never jumps backwards.
  const [supported, setSupported] = useState(!live || !!reduceMotion);

  useEffect(() => {
    if (!live || reduceMotion) return;
    const id = window.setTimeout(() => setSupported(true), SUPPORT_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [live, reduceMotion]);

  return (
    <Card variant="row" padding="sm" className="!bg-surface-elevated/80" style={{ opacity: 1 - depth * 0.22 }}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Ghost size={16} aria-hidden="true" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-bold text-text-main truncate">{post.ghost}</p>
          <p className="flex items-center gap-1 text-[11px] font-medium text-text-muted">
            <MapPin size={10} aria-hidden="true" />
            {post.area}
          </p>
        </div>
      </div>
      <p className="mt-2.5 text-sm leading-snug text-text-main line-clamp-3">{post.body}</p>
      <div className="mt-3 flex items-center justify-between">
        <motion.span
          animate={supported && live && !reduceMotion ? { scale: [1, 1.12, 1] } : { scale: 1 }}
          transition={{ duration: 0.35 }}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-colors duration-300 ${
            supported ? "bg-primary text-text-on-primary" : "bg-surface-active text-text-secondary"
          }`}
        >
          <ThumbsUp size={12} aria-hidden="true" />
          {t("home.social.support")} · {post.support + (supported ? 1 : 0)}
        </motion.span>
      </div>
    </Card>
  );
}

export default function HomeFeedPreview() {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  // `tick` is the sequence number of the newest card. Starting at STACK_SIZE-1
  // means the first paint already shows a full stack (no empty-then-filling flash).
  const [tick, setTick] = useState(STACK_SIZE - 1);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => setTick((n) => n + 1), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  const stack = Array.from({ length: STACK_SIZE }, (_, depth) => {
    const seq = tick - depth;
    return { seq, depth, post: POSTS[((seq % POSTS.length) + POSTS.length) % POSTS.length] };
  });

  return (
    <Card variant="hero" padding="sm" className="w-full max-w-md min-[1700px]:max-w-xl mx-auto" aria-label={t("home.social.feedHeader")}>
      {/* Composer: shows the anonymity up front, before any post is even read. */}
      <div className="rounded-xl border border-border-light/50 bg-surface/60 p-3">
        <p className="text-sm text-text-muted">{t("home.social.composerPlaceholder")}</p>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
            <ShieldCheck size={12} aria-hidden="true" />
            {t("home.social.postingAs")} Ghost-BoldFinch
          </span>
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-text-on-primary">
            {t("home.social.post")}
          </span>
        </div>
      </div>

      {/* Fixed height so rotating cards never shift the hero layout (CLS). */}
      <div className="relative mt-3 h-[22rem] sm:h-[23.5rem] overflow-hidden" aria-live="off">
        <div className="flex flex-col">
          {/* Height-based enter/exit: a new card grows in at the top and pushes the rest down,
              so cards never occupy the same space mid-animation (the earlier translate + layout
              spring let the incoming card overlap ones still sliding down). */}
          <AnimatePresence initial={false}>
            {stack.map(({ seq, depth, post }) => (
              <motion.div
                key={seq}
                initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="pb-3">
                  <PostRow post={post} depth={depth} live={depth === 0} />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface/80 to-transparent"
          aria-hidden="true"
        />
      </div>

      <p className="mt-2 text-center text-[11px] font-medium text-text-muted">{t("home.social.exampleNote")}</p>
    </Card>
  );
}
