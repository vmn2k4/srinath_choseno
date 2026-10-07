// Best-effort first-touch / pre-auth context for "where did this signup come
// from". Everything here is wrapped in try/catch and never throws -- it must
// never be able to interfere with sign-up or sign-in. Stored in localStorage
// (not sessionStorage) so it survives the email-confirmation round trip.

const KEY = "choseno_signup_source";

export type SignupSource = {
  landing_page?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  last_page_before_auth?: string;
  auth_next?: string;
  first_seen_at?: string;
  // The button/link text the visitor clicked right before /auth opened
  // (e.g. "Sign up", "Support"), and the page it was on.
  auth_trigger?: string;
  auth_trigger_page?: string;
  role?: string;
  // Last few pages viewed, oldest first, joined with " > ".
  trail?: string;
};

const MAX_TRAIL = 8;
const TRIGGER_WINDOW_MS = 5000;

// Passive record of the most recent click, kept in memory only. A click that
// leads to /auth within a few seconds is what "triggered" the signup flow.
let lastClick: { text: string; page: string; at: number } | null = null;

export function noteClick(target: EventTarget | null) {
  try {
    const el = (target as Element | null)?.closest?.("a,button,[role=button]");
    if (!el) return;
    const text = (
      el.getAttribute("data-signup-trigger") ||
      el.getAttribute("aria-label") ||
      el.textContent ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
    if (!text) return;
    lastClick = { text, page: window.location.pathname, at: Date.now() };
  } catch {
    // never throw
  }
}

function read(): SignupSource {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function write(value: SignupSource) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // storage blocked / full -- fine, source just stays unknown
  }
}

// Called on every route change. First call ever stores landing page +
// referrer + UTMs (first touch, never overwritten); non-/auth pages update
// last_page_before_auth; /auth records the ?next= it was opened with.
export function captureSignupContext(pathname: string, search: string) {
  try {
    const current = read();
    const next: SignupSource = { ...current };
    const isAuth = pathname.startsWith("/auth");

    if (!next.landing_page && !isAuth) {
      const params = new URLSearchParams(search);
      next.landing_page = pathname;
      next.first_seen_at = new Date().toISOString();
      if (document.referrer) {
        try {
          const ref = new URL(document.referrer);
          if (ref.host !== window.location.host) next.referrer = ref.host + ref.pathname;
        } catch {
          // ignore malformed referrer
        }
      }
      for (const key of ["utm_source", "utm_medium", "utm_campaign"] as const) {
        const value = params.get(key);
        if (value) next[key] = value;
      }
    }

    if (isAuth) {
      const params = new URLSearchParams(search);
      // Each /auth visit describes only itself -- drop what an earlier visit left.
      delete next.auth_next;
      delete next.role;
      delete next.auth_trigger;
      delete next.auth_trigger_page;
      const authNext = params.get("next");
      if (authNext) next.auth_next = authNext;
      const role = params.get("role");
      if (role) next.role = role;
      if (lastClick && Date.now() - lastClick.at < TRIGGER_WINDOW_MS) {
        next.auth_trigger = lastClick.text;
        next.auth_trigger_page = lastClick.page;
      }
    } else {
      next.last_page_before_auth = pathname;
      const trail = next.trail ? next.trail.split(" > ") : [];
      if (trail[trail.length - 1] !== pathname.slice(0, 80)) {
        trail.push(pathname.slice(0, 80));
      }
      next.trail = trail.slice(-MAX_TRAIL).join(" > ");
    }

    write(next);
  } catch {
    // never throw
  }
}

export function readSignupContext(): SignupSource | null {
  const value = read();
  return Object.keys(value).length > 0 ? value : null;
}

export function clearSignupContext() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
