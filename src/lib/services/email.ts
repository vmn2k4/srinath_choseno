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

function unwrapError(error: unknown): string {
  if (!error || typeof error !== "object") return "Unknown error";

  // Handle Supabase FunctionsHttpError
  if ("context" in error && error.context) {
    const context = error.context as { json?: () => Promise<{ error?: string }> };
    if (context.json) {
      return "Check error context for details";
    }
  }

  if ("message" in error) {
    return String(error.message);
  }

  return "Failed to send email";
}

export async function sendEmail(supabase: Client, request: EmailRequest) {
  const { data, error } = await supabase.functions.invoke<EmailResponse>("send-email", {
    body: request,
  });

  if (error) {
    const message = unwrapError(error);
    return { data: null, error: { message } };
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
