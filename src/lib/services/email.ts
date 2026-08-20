import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

interface EmailRequest {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

interface EmailResponse {
  ok?: boolean;
  sent?: number;
  error?: string;
}

async function unwrapError(error: unknown): Promise<string> {
  if (!error || typeof error !== "object") return "Unknown error";

  // Handle Supabase FunctionsHttpError where context is a Fetch Response
  if ("context" in error && error.context) {
    const context = error.context as {
      json?: () => Promise<{ error?: string }>;
      text?: () => Promise<string>;
    };
    if (typeof context.json === "function") {
      try {
        const body = await context.json();
        if (body && typeof body === "object" && body.error) {
          return String(body.error);
        }
      } catch {
        if (typeof context.text === "function") {
          try {
            const txt = await context.text();
            if (txt) return txt;
          } catch {}
        }
      }
    }
  }

  if ("message" in error && error.message) {
    return String(error.message);
  }

  return "Failed to send email";
}

export async function sendEmail(supabase: Client, request: EmailRequest) {
  // If running in browser on localhost/127.0.0.1, route through local Next.js API (Titan SMTP on local IP)
  if (typeof window !== "undefined") {
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (isLocalhost) {
      try {
        const res = await fetch("/api/admin/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });

        const json = await res.json();
        if (!res.ok || !json.ok) {
          return { data: null, error: { message: json.error || "Failed to send via local SMTP" } };
        }
        return { data: json, error: null };
      } catch (err: any) {
        return { data: null, error: { message: err?.message || "Local SMTP route unreachable" } };
      }
    }
  }

  // Otherwise (production or server-side without local override), invoke Supabase Edge Function
  const { data, error } = await supabase.functions.invoke<EmailResponse>("send-email", {
    body: request,
  });

  if (error) {
    const message = await unwrapError(error);
    return { data: null, error: { message } };
  }

  if (data && !data.ok && data.error) {
    return { data: null, error: { message: data.error } };
  }

  return { data, error: null };
}

export async function sendMarketingEmail(
  supabase: Client,
  recipients: string | string[],
  subject: string,
  html: string,
  options?: { replyTo?: string }
) {
  return sendEmail(supabase, {
    to: recipients,
    subject,
    html,
    replyTo: options?.replyTo,
  });
}

export async function sendNotificationEmail(
  supabase: Client,
  recipient: string,
  subject: string,
  html: string
) {
  return sendEmail(supabase, {
    to: recipient,
    subject,
    html,
  });
}
