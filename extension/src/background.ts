import { supabase } from "./supabase";

// Google sign-in has to run here: the popup closes the moment the auth window
// opens, which would kill the flow mid-way. The finished session lands in
// chrome.storage.local and the popup picks it up on next open.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "google-sign-in") return;
  (async () => {
    try {
      const redirectTo = chrome.identity.getRedirectURL();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data.url) throw error ?? new Error("No sign-in URL");
      const result = await chrome.identity.launchWebAuthFlow({ url: data.url, interactive: true });
      const code = result ? new URL(result).searchParams.get("code") : null;
      if (!code) throw new Error("Sign-in was cancelled");
      const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
      if (exErr) throw exErr;
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  })();
  return true;
});
