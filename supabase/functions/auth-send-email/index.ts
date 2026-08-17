// Supabase Auth "Send Email" hook.
//
// When enabled (Authentication > Hooks in the dashboard), GoTrue calls this
// function instead of using its own built-in SMTP mailer for every auth
// email — signup confirmation, magic link, password recovery, email change,
// reauthentication, invite. We verify the Standard Webhooks signature
// GoTrue signs the request with, then dispatch through the same Titan SMTP
// path the officeholder-claim invite flow already uses (see
// ../send-email/index.ts) instead of Supabase's own SMTP client, which was
// failing with "Error sending confirmation email" (500, unexpected_failure)
// independent of Titan itself — Titan is reachable and the send-email
// function already delivers through it successfully.
//
// IMPORTANT: because this hook is active, the Dashboard's own Email
// Templates editor is inert for every auth email ("Email templates are not
// used" banner) — this file is the only place that controls what these
// emails link to. It intentionally does NOT link to GoTrue's own
// `/auth/v1/verify?token=pkce_...` endpoint (the default `{{ .ConfirmationURL }}`
// would). That endpoint issues a PKCE code and exchanging it needs the
// code_verifier cookie from whichever browser originally triggered the
// email — broken whenever the link is opened somewhere else (a mail app's
// in-app browser, a different device, a corporate email-security scanner
// prefetching links to scan them), which surfaced as links reading
// "expired" seconds after being sent, or worse, a silent auto-login via the
// client SDK's detectSessionInUrl with no password-reset step ever
// happening. Instead every link below points at our own
// `/auth/confirm` route (src/app/auth/confirm/route.ts), which calls
// `verifyOtp({ type, token_hash })` — stateless, no code_verifier needed,
// works regardless of where the link is opened.
//
// Deployed with --no-verify-jwt: GoTrue does not send a Supabase JWT here,
// only the webhook signature below.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { Webhook } from "npm:standardwebhooks@1.0.0";

// Supabase prefixes configured hook secrets with "v1," (its own signature
// versioning convention) and strips it before handing the raw whsec_...
// value to the standardwebhooks library when signing — see
// generateSignatures() in supabase/auth's hookshttp.go. The standardwebhooks
// library doesn't know about that prefix, so we strip it here too or every
// verification throws and gets reported upstream as a generic 401 ("Hook
// requires authorization token").
const RAW_HOOK_SECRET = Deno.env.get("SEND_EMAIL_HOOK_SECRET")!;
const HOOK_SECRET = RAW_HOOK_SECRET.startsWith("v1,") ? RAW_HOOK_SECRET.slice(3) : RAW_HOOK_SECRET;

interface EmailData {
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
  token_new: string;
  token_hash_new: string;
}

interface HookPayload {
  user: { email: string };
  email_data: EmailData;
}

// Brand colors, matched to the app: the wordmark's orange gradient
// (src/components/primitives/ChosenoLogo.tsx) and the blue CTA color used
// on the sign-in/sign-up screens (src/app/globals.css, `.theme-blue`).
const BRAND = {
  orange: "#f97316",
  orangeDark: "#ea580c",
  blue: "#3B82F6",
  blueDark: "#2f6fd6",
  ink: "#0f172a",
  slate: "#475569",
  muted: "#94a3b8",
  border: "#e2e8f0",
  surface: "#f8fafc",
};

// Table-based layout with everything inlined — the only layout approach
// that survives Gmail/Outlook's HTML stripping. `preheader` is the hidden
// snippet clients show next to the subject line; `bodyHtml` is the
// message-specific content (buildEmail below composes it per email type).
function emailShell(preheader: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${BRAND.surface};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <span style="display:none;font-size:1px;color:${BRAND.surface};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.surface};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;border:1px solid ${BRAND.border};overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 20px;border-bottom:1px solid ${BRAND.border};">
                <span style="font-size:22px;font-weight:800;letter-spacing:-0.02em;">
                  <span style="color:${BRAND.orange};">Chosen</span><span style="color:#f59e0b;">o</span>
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px;border-top:1px solid ${BRAND.border};">
                <p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND.muted};">
                  Choseno is an independent, non-partisan civic platform — no party, PAC, or corporate funding behind it.
                  You're receiving this because this email address was used on choseno.com.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function ctaButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
    <tr>
      <td style="border-radius:10px;background:${BRAND.blue};">
        <a href="${url}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${label}</a>
      </td>
    </tr>
  </table>
  <p style="margin:0;font-size:12px;line-height:1.6;color:${BRAND.muted};word-break:break-all;">
    Or paste this link into your browser:<br/><a href="${url}" style="color:${BRAND.blue};">${url}</a>
  </p>`;
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 12px;font-size:21px;font-weight:800;color:${BRAND.ink};letter-spacing:-0.01em;">${text}</h1>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${BRAND.slate};">${text}</p>`;
}

// Our own app's origin — matches src/lib/constants/site.ts's SITE_URL.
// Hardcoded (this Deno function can't import from the Next.js app) rather
// than derived from emailData.site_url/redirect_to: GoTrue validates
// resetPasswordForEmail's/signUp's redirectTo against the project's
// Redirect URLs allow-list *before* invoking this hook, and silently
// substitutes the bare Site URL when it doesn't match — which is exactly
// what redirect_to was observed carrying. Building the link from a known
// value here means the reset/confirm flow itself doesn't depend on that
// allow-list being kept in sync; only the "return to wherever the user
// was headed" `next` param (extracted below) does.
const SITE_URL = "https://www.choseno.com";

// The `next` query param our own client code appends to redirectTo
// (src/lib/services/auth.ts) — e.g. `/auth/callback?next=%2Fauth%2Freset-password`.
// Recovered here so /auth/confirm can still forward the user to the right
// place post-verification even though the link no longer routes through
// /auth/callback at all. Returns undefined if redirect_to didn't validate
// (fell back to the bare Site URL) or carries no next param — /auth/confirm
// has its own sensible per-type default for that case.
function extractNextPath(redirectTo: string): string | undefined {
  try {
    const next = new URL(redirectTo).searchParams.get("next");
    return next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  } catch {
    return undefined;
  }
}

function buildEmail(
  emailData: EmailData,
  siteUrl: string,
  recipientEmail: string,
): { subject: string; html: string; text: string } {
  const { token, token_hash, redirect_to, email_action_type } = emailData;
  const nextPath = extractNextPath(redirect_to);
  const verifyUrl = `${siteUrl}/auth/confirm?token_hash=${encodeURIComponent(token_hash)}&type=${encodeURIComponent(email_action_type)}${
    nextPath ? `&next=${encodeURIComponent(nextPath)}` : ""
  }`;

  switch (email_action_type) {
    case "signup":
      return {
        subject: "Welcome to Choseno — confirm your email to get started",
        html: emailShell(
          "One click and you're in — confirm your email to start rating your representatives.",
          heading("Welcome to Choseno 👋") +
            paragraph(
              `Thanks for signing up, <strong>${recipientEmail}</strong>. Choseno is a place for real, honest reviews of the people who represent you — like Yelp, but for democracy. Confirm your email and you're ready to go.`,
            ) +
            ctaButton("Confirm email address", verifyUrl) +
            paragraph(
              "Didn't sign up for Choseno? You can safely ignore this email — no account will be created.",
            ),
        ),
        text: `Welcome to Choseno!\n\nThanks for signing up, ${recipientEmail}. Confirm your email to get started:\n${verifyUrl}\n\nDidn't sign up? You can safely ignore this email.`,
      };
    case "recovery":
      return {
        subject: "Reset your Choseno password",
        html: emailShell(
          "Use this link to choose a new password for your Choseno account.",
          heading("Reset your password") +
            paragraph(
              `We received a request to reset the password for <strong>${recipientEmail}</strong>. Click below to choose a new one — this link is only valid for a short time.`,
            ) +
            ctaButton("Reset password", verifyUrl) +
            paragraph(
              "If you didn't request this, you can safely ignore this email — your password won't change.",
            ),
        ),
        text: `Reset your Choseno password\n\nWe received a request to reset the password for ${recipientEmail}:\n${verifyUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
      };
    case "magiclink":
      return {
        subject: "Your Choseno sign-in link",
        html: emailShell(
          "Click to sign in to Choseno — no password needed.",
          heading("Sign in to Choseno") +
            paragraph(`Click below to sign in as <strong>${recipientEmail}</strong>. No password needed.`) +
            ctaButton("Sign in", verifyUrl) +
            paragraph("Didn't request this? You can safely ignore this email."),
        ),
        text: `Sign in to Choseno\n\n${verifyUrl}\n\nDidn't request this? You can safely ignore this email.`,
      };
    case "invite":
      return {
        subject: "You've been invited to Choseno",
        html: emailShell(
          "You've been invited to join Choseno — accept your invitation to get started.",
          heading("You're invited to Choseno") +
            paragraph(
              `You've been invited to create a Choseno account as <strong>${recipientEmail}</strong>. Accept your invitation below to get started.`,
            ) +
            ctaButton("Accept invitation", verifyUrl),
        ),
        text: `You've been invited to Choseno\n\nAccept your invitation:\n${verifyUrl}`,
      };
    case "email_change":
      return {
        subject: "Confirm your new Choseno email address",
        html: emailShell(
          "Confirm this as your new email address for Choseno.",
          heading("Confirm your new email") +
            paragraph(
              `Click below to confirm <strong>${recipientEmail}</strong> as the new email address for your Choseno account.`,
            ) +
            ctaButton("Confirm new email address", verifyUrl) +
            paragraph(
              "If you didn't request this change, you can safely ignore this email.",
            ),
        ),
        text: `Confirm your new Choseno email address\n\n${verifyUrl}\n\nIf you didn't request this change, you can safely ignore this email.`,
      };
    case "reauthentication":
      return {
        subject: "Your Choseno verification code",
        html: emailShell(
          `Your verification code is ${token}.`,
          heading("Verify your identity") +
            paragraph("Use this code to confirm it's really you:") +
            `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr><td style="padding:16px 24px;background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:10px;font-size:28px;font-weight:800;letter-spacing:0.15em;color:${BRAND.ink};">${token}</td></tr></table>` +
            paragraph("If you didn't request this, you can safely ignore this email."),
        ),
        text: `Your Choseno verification code: ${token}\n\nIf you didn't request this, you can safely ignore this email.`,
      };
    default:
      return {
        subject: "Choseno verification",
        html: emailShell("Continue to Choseno.", heading("Continue to Choseno") + ctaButton("Continue", verifyUrl)),
        text: verifyUrl,
      };
  }
}

Deno.serve(async (req) => {
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  try {
    const wh = new Webhook(HOOK_SECRET);
    const { user, email_data } = wh.verify(payload, headers) as HookPayload;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const { subject, html, text } = buildEmail(email_data, SITE_URL, user.email);

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await admin.functions.invoke("send-email", {
      body: { to: user.email, subject, html, text },
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: { http_code: 500, message: error.message } }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: { http_code: 401, message: error instanceof Error ? error.message : String(error) } }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
});
