import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileRole } from "@/lib/services/profile";
import nodemailer from "nodemailer";

// Lazy-init persistent connection pool for dev / local execution
let localTransporter: nodemailer.Transporter | null = null;
function getTransporter() {
  if (!localTransporter) {
    const host = process.env.TITAN_SMTP_HOST || "smtp.titan.email";
    const port = Number(process.env.TITAN_SMTP_PORT) || 465;
    const user = process.env.TITAN_SMTP_USER;
    const pass = process.env.TITAN_SMTP_PASS;

    if (!user || !pass) {
      throw new Error("Missing TITAN_SMTP_USER or TITAN_SMTP_PASS in server environment");
    }

    localTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      pool: true,
      maxConnections: 1,
      auth: { user, pass },
    });
  }
  return localTransporter;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await getProfileRole(supabase, user.id);
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    replyTo?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { to, subject, html, text, replyTo } = body;
  if (!to || !subject) {
    return NextResponse.json({ error: "Missing required fields: to, subject" }, { status: 400 });
  }

  try {
    const transporter = getTransporter();
    const sender = process.env.TITAN_SMTP_USER;

    const info = await transporter.sendMail({
      from: `"Choseno" <${sender}>`,
      to,
      subject,
      html,
      text,
      replyTo,
    });

    return NextResponse.json({ ok: true, messageId: info.messageId });
  } catch (err: any) {
    console.error("Local send-email route error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to send email via local SMTP" },
      { status: 500 }
    );
  }
}
