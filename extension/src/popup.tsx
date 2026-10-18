import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowLeft, AtSign, CheckCircle2, EyeOff, ExternalLink, Image as ImageIcon, Link2, LogOut, MapPin, ShieldAlert, Users, X,
} from "lucide-react";
import { supabase, SITE_URL } from "./supabase";
import { resendSignupEmail, signInWithPassword, signOut, signUp, verifySignupCode } from "@/lib/services/auth";
import { getOwnProfile, getUserBoundaryMemberships } from "@/lib/services/profile";
import { createFeedPost, uploadPostImage } from "@/lib/services/feed";
import { fetchLinkPreview } from "@/lib/services/linkPreview";
import type { LinkMetadata } from "@/components/features/LinkPreview";
import { readCurrentPage, hostOf, type PageInfo } from "./page";
import { initTheme } from "./theme";
import { Avatar, MentionPicker, MentionTextarea, type MentionTextareaHandle } from "./Mentions";

type Shape = { id: number; name: string; country: string; boundary_type: string };
type Profile = { id: string; full_name: string | null; country: string | null; current_ghost_id: string | null };

const MAX_IMAGE = 5 * 1024 * 1024;
const draftKey = (url: string) => `draft:${url || "no-link"}`;

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" className="logo-mark">
      <defs>
        <linearGradient id="lg-t" x1="4" y1="8" x2="44" y2="20" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#f97316" /><stop offset="100%" stopColor="#ff8c00" /></linearGradient>
        <linearGradient id="lg-b" x1="44" y1="28" x2="8" y2="40" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#ea580c" /><stop offset="100%" stopColor="#f97316" /></linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="#0f172a" />
      <path d="M 6 22 C 10 10, 24 6, 36 12 L 34 7 L 44 14 L 37 23 L 35 18 C 26 12, 14 14, 8 23 Z" fill="url(#lg-t)" />
      <path d="M 42 26 C 38 38, 24 42, 12 36 L 14 41 L 4 34 L 11 25 L 13 30 C 22 36, 34 34, 40 25 Z" fill="url(#lg-b)" />
      <circle cx="24" cy="24" r="6" fill="#fff" />
      <circle cx="24" cy="24" r="3.5" fill="#0f172a" />
    </svg>
  );
}

function Header({ onSignOut }: { onSignOut?: () => void }) {
  return (
    <header className="brand">
      <Logo />
      <div className="brand-text">
        <strong aria-label="Choseno"><span className="wm-a">Chosen</span><span className="wm-b">o</span></strong>
        <small>Companion · Voice of the Silent Majority</small>
      </div>
      {onSignOut && (
        <button type="button" className="icon-btn" onClick={onSignOut} aria-label="Sign out" title="Sign out">
          <LogOut size={18} />
        </button>
      )}
    </header>
  );
}

function SignIn() {
  const [mode, setMode] = useState<"home" | "signin" | "signup" | "verify">("home");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"pw" | "google" | "resend" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy("pw"); setError(null); setNotice(null);
    if (mode === "signin") {
      const { error } = await signInWithPassword(supabase, email.trim(), password);
      if (error) setError(error.message);
    } else if (mode === "signup") {
      const { data, error } = await signUp(supabase, email.trim(), password);
      if (error) setError(error.message);
      // Supabase hides "already registered" by returning a user with no identities.
      else if (data.user && (data.user.identities?.length ?? 1) === 0) setError("That email already has an account — sign in instead.");
      else if (!data.session) setMode("verify"); // email confirmation required → 6-digit code
    } else {
      const { error } = await verifySignupCode(supabase, email.trim(), code);
      if (error) setError(error.message);
    }
    setBusy(null);
  }
  async function resend() {
    setBusy("resend"); setError(null); setNotice(null);
    const { error } = await resendSignupEmail(supabase, email.trim());
    if (error) setError(error.message); else setNotice("New code sent — check your inbox.");
    setBusy(null);
  }
  async function google() {
    setBusy("google"); setError(null);
    const res = await chrome.runtime.sendMessage({ type: "google-sign-in" });
    if (!res?.ok) { setError(res?.error || "Google sign-in failed"); setBusy(null); }
  }
  const switchTo = (m: "home" | "signin" | "signup") => { setMode(m); setError(null); setNotice(null); };

  if (mode === "home") {
    return (
      <div className="screen">
        <Header />
        <main className="body">
          <h1>Your honest view on politics, from any page.</h1>
          <p className="lede">
            Speak up about whatever you’re reading — without your name attached — so politicians and neighbours finally hear the silent majority.
          </p>
          <ol className="steps">
            <li><span className="step-ic"><Link2 size={18} aria-hidden="true" /></span><div><b>The page link is added for you</b><small>Open it on any page and the link, title and image are attached automatically.</small></div></li>
            <li><span className="step-ic"><MapPin size={18} aria-hidden="true" /></span><div><b>Shared with your districts</b><small>Your view goes to the communities where you live. Tag politicians with @.</small></div></li>
            <li><span className="step-ic"><EyeOff size={18} aria-hidden="true" /></span><div><b>Anonymous by design</b><small>A rotating Ghost ID — no profile, no followers, no one knows it’s you.</small></div></li>
          </ol>
          <div className="home-actions">
            <button type="button" className="btn btn-primary btn-block" onClick={() => switchTo("signup")}>Sign up — it’s free</button>
            <button type="button" className="btn btn-secondary btn-block" onClick={() => switchTo("signin")}>I already have an account · Sign in</button>
          </div>
          <p className="foot"><a href={SITE_URL} target="_blank" rel="noreferrer">Learn more about Choseno</a></p>
        </main>
      </div>
    );
  }

  if (mode === "verify") {
    return (
      <div className="screen">
        <Header />
        <main className="body">
          <h1>Check your email</h1>
          <p className="lede">We sent a 6-digit code to <b>{email}</b>. Enter it to confirm your account.</p>
          <form onSubmit={submit} className="stack">
            <label className="field"><span>Confirmation code</span>
              <input inputMode="numeric" autoComplete="one-time-code" required autoFocus maxLength={10} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" className="code-input" />
            </label>
            {error && <p className="alert" role="alert">{error}</p>}
            {notice && <p className="notice" role="status">{notice}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy !== null || code.trim().length < 6}>
              {busy === "pw" ? <span className="spinner" /> : null} Confirm account
            </button>
          </form>
          <p className="foot">
            <button type="button" className="link-btn" onClick={resend} disabled={busy !== null}>Resend code</button> ·{" "}
            <button type="button" className="link-btn" onClick={() => switchTo("signup")}>Use a different email</button>
          </p>
        </main>
      </div>
    );
  }

  const signup = mode === "signup";
  return (
    <div className="screen">
      <Header />
      <main className="body">
        <button type="button" className="back-btn" onClick={() => switchTo("home")}><ArrowLeft size={16} aria-hidden="true" /> Back</button>
        <h1>{signup ? "Join the silent majority." : "Say what you really think."}</h1>
        <p className="lede">
          {signup
            ? "Create a free account. You post anonymously under a rotating Ghost ID — never your name."
            : "Sign in to share your view on any page with your districts — anonymously, under a Ghost ID."}
        </p>
        <button type="button" className="btn btn-secondary btn-block" onClick={google} disabled={busy !== null}>
          {busy === "google" ? <span className="spinner" /> : <GoogleMark />} Continue with Google
        </button>
        <div className="divider"><span>or</span></div>
        <form onSubmit={submit} className="stack">
          <label className="field"><span>Email</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <label className="field"><span>Password</span>
            <input type="password" required minLength={signup ? 8 : undefined} autoComplete={signup ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={signup ? "At least 8 characters" : "Your password"} />
          </label>
          {error && <p className="alert" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy !== null}>
            {busy === "pw" ? <span className="spinner" /> : null} {signup ? "Create account" : "Sign in"}
          </button>
        </form>
        <p className="foot">
          {signup ? (
            <>Already have an account? <button type="button" className="link-btn" onClick={() => switchTo("signin")}>Sign in</button></>
          ) : (
            <>New to Choseno? <button type="button" className="link-btn" onClick={() => switchTo("signup")}>Create an account</button> ·{" "}
              <a href={`${SITE_URL}/auth/forgot-password`} target="_blank" rel="noreferrer">Forgot password</a></>
          )}
        </p>
      </main>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/>
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/>
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
    </svg>
  );
}

function Composer({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<PageInfo | null>(null);
  const [link, setLink] = useState<LinkMetadata | null>(null);
  const [text, setText] = useState("");
  const [mentionIds, setMentionIds] = useState<string[]>([]);
  const [target, setTarget] = useState("all");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postedId, setPostedId] = useState<string | null>(null);
  const textRef = useRef<MentionTextareaHandle>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    let off = false;
    (async () => {
      const [{ data: prof }, { data: mem }, pg] = await Promise.all([
        getOwnProfile(supabase, session.user.id),
        getUserBoundaryMemberships(supabase, session.user.id),
        readCurrentPage(),
      ]);
      if (off) return;
      setProfile(prof as Profile | null);
      setShapes(
        ((mem || []) as unknown as { map_shapes: Shape | Shape[] | null }[])
          .map((m) => (Array.isArray(m.map_shapes) ? m.map_shapes[0] : m.map_shapes))
          .filter((s): s is Shape => Boolean(s))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setPage(pg);
      setLink(pg.meta);
      const saved = (await chrome.storage.local.get(draftKey(pg.url)))[draftKey(pg.url)] as string | undefined;
      setText(saved ?? (pg.selection ? `“${pg.selection}”\n\n` : ""));
      hydrated.current = true;
      setLoading(false);
      // Enrich with the server-side preview (same as the website) when the page gave us no image.
      if (pg.meta && !pg.meta.image) {
        const rich = await fetchLinkPreview(supabase, pg.url);
        if (!off && rich) setLink((cur) => (cur ? { ...cur, ...Object.fromEntries(Object.entries(rich).filter(([, v]) => v)), url: cur.url } : cur));
      }
    })();
    return () => { off = true; };
  }, [session.user.id]);

  // Popups close when focus is lost: keep the draft per page.
  useEffect(() => {
    if (!hydrated.current || !page) return;
    const k = draftKey(page.url);
    if (text.trim()) chrome.storage.local.set({ [k]: text }); else chrome.storage.local.remove(k);
  }, [text, page]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_IMAGE) { setError("Image is too large (max 5 MB)."); return; }
    setError(null); setImage(f); setPreview(URL.createObjectURL(f));
  }

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.current_ghost_id) return;
    setSubmitting(true); setError(null);
    try {
      let imageUrl: string | null = null;
      if (image) {
        const up = await uploadPostImage(supabase, image, profile.current_ghost_id);
        if (up.error) throw new Error("Failed to upload image.");
        imageUrl = up.publicUrl;
      }
      const { data, error } = await createFeedPost(supabase, {
        content: text.trim(),
        imageUrl,
        linkMetadata: link ? ({ ...link } as never) : null,
        mentionedPoliticianIds: mentionIds,
        boundaryIds: target === "all" ? undefined : [Number(target)],
      });
      if (error) throw error;
      if (page) await chrome.storage.local.remove(draftKey(page.url));
      setPostedId((data as { id?: string } | null)?.id ?? "ok");
    } catch (err) {
      const e2 = err as { message?: string; details?: string };
      setError(e2?.message || e2?.details || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [profile, image, text, link, mentionIds, target, page]);

  const reach = useMemo(() => {
    if (shapes.length === 0) return null;
    if (target !== "all") return shapes.find((s) => String(s.id) === target)?.name ?? "1 district";
    return `${shapes.length} district${shapes.length === 1 ? "" : "s"}`;
  }, [shapes, target]);

  if (loading) return <div className="screen"><Header onSignOut={onSignOut} /><div className="center grow"><span className="spinner lg" /></div></div>;

  if (postedId) {
    return (
      <div className="screen">
        <Header onSignOut={onSignOut} />
        <main className="body center-col">
          <CheckCircle2 size={48} className="ok" aria-hidden="true" />
          <h1>Your view is posted</h1>
          <p className="lede">Shared with {reach ?? "your districts"} as a Ghost ID. Thank you for speaking up.</p>
          {postedId !== "ok" && (
            <a className="btn btn-secondary" href={`${SITE_URL}/post/${postedId}`} target="_blank" rel="noreferrer">
              View on Choseno <ExternalLink size={14} />
            </a>
          )}
          <button type="button" className="link-btn" onClick={() => window.close()}>Close</button>
        </main>
      </div>
    );
  }

  if (!profile?.current_ghost_id || shapes.length === 0) {
    return (
      <div className="screen">
        <Header onSignOut={onSignOut} />
        <main className="body center-col">
          <ShieldAlert size={44} className="warn" aria-hidden="true" />
          <h1>Finish setting up first</h1>
          <p className="lede">{!profile?.current_ghost_id ? "Your account has no Ghost ID yet." : "We don’t know your districts yet, so a post wouldn’t reach anyone."} Complete onboarding on Choseno, then come back.</p>
          <a className="btn btn-primary" href={`${SITE_URL}/onboarding`} target="_blank" rel="noreferrer">Open Choseno <ExternalLink size={14} /></a>
        </main>
      </div>
    );
  }

  const canPost = !submitting && (text.trim().length > 0 || image !== null);

  return (
    <form className="screen" onSubmit={submit} aria-label="New post">
      <Header onSignOut={onSignOut} />
      <div className="body scroll">
        <div className="who">
          <Avatar name={profile.full_name} size={40} />
          <div className="who-text">
            <p><b>Share with your community</b></p>
            <label className="pill">
              <Users size={14} aria-hidden="true" />
              <span>Post to:</span>
              <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Post to">
                <option value="all">All my districts ({shapes.length})</option>
                {shapes.map((s) => <option key={s.id} value={String(s.id)}>{s.name} · {s.boundary_type}</option>)}
              </select>
            </label>
          </div>
        </div>

        <MentionTextarea
          handleRef={textRef}
          value={text}
          onChange={setText}
          onMentionsChange={setMentionIds}
          viewerShapeIds={shapes.map((s) => s.id)}
          viewerCountry={profile.country}
          placeholder="What do you think about this? Type @ to tag a politician"
        />

        {link ? (
          <div className="link-card">
            {link.image && <img src={link.image} alt="" onError={(e) => ((e.currentTarget.style.display = "none"))} />}
            <div className="link-body">
              <span className="link-host"><Link2 size={12} aria-hidden="true" /> {hostOf(link.url)}</span>
              <b>{link.title || link.url}</b>
              {link.description && <small>{link.description}</small>}
            </div>
            <button type="button" className="icon-btn sm link-x" aria-label="Don’t attach this link" onClick={() => setLink(null)}><X size={14} /></button>
          </div>
        ) : page?.shareable ? (
          <button type="button" className="link-btn left" onClick={() => setLink(page.meta)}>+ Attach this page’s link again</button>
        ) : (
          <p className="hint">This page can’t be linked — your post will be shared without a link.</p>
        )}

        {preview && (
          <div className="img-prev">
            <img src={preview} alt="Selected photo" />
            <button type="button" className="icon-btn sm" aria-label="Remove photo" onClick={() => { setImage(null); setPreview(null); }}><X size={14} /></button>
          </div>
        )}
        {error && <p className="alert" role="alert">{error}</p>}
      </div>

      <footer className="toolbar">
        <label className="icon-btn" title="Add a photo">
          <ImageIcon size={22} /><span className="sr-only">Photo</span>
          <input type="file" accept="image/*" hidden onChange={pickImage} />
        </label>
        <button type="button" className="icon-btn" title="Tag an official" aria-label="Tag an official" onClick={() => setPickerOpen(true)}>
          <AtSign size={22} />
        </button>
        <span className="reach">{reach && `→ ${reach}`}</span>
        <button type="submit" className="btn btn-primary" disabled={!canPost}>
          {submitting ? <><span className="spinner" /> Posting…</> : "Post"}
        </button>
      </footer>

      {pickerOpen && (
        <MentionPicker
          viewerShapeIds={shapes.map((s) => s.id)}
          viewerCountry={profile.country}
          onClose={() => setPickerOpen(false)}
          onSelect={(o) => { textRef.current?.insertMention(o); setPickerOpen(false); }}
        />
      )}
    </form>
  );
}

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    // Google sign-in finishes in the background worker; pick up the stored session.
    const onChange = (c: Record<string, unknown>) => { if (Object.keys(c).some((k) => k.includes("auth-token"))) supabase.auth.getSession().then(({ data }) => setSession(data.session)); };
    chrome.storage.onChanged.addListener(onChange);
    return () => { data.subscription.unsubscribe(); chrome.storage.onChanged.removeListener(onChange); };
  }, []);

  if (session === undefined) return <div className="screen"><div className="center grow"><span className="spinner lg" /></div></div>;
  if (!session) return <SignIn />;
  return <Composer session={session} onSignOut={() => signOut(supabase)} />;
}

initTheme();
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
