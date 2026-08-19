import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

async function readLine(conn: Deno.Conn): Promise<string> {
  const buffer = new Uint8Array(4096);
  const n = await conn.read(buffer);
  if (!n) return "";

  const response = new TextDecoder().decode(buffer.subarray(0, n));
  const lines = response.split("\r\n").filter(l => l.length > 0);

  // For SMTP multi-line responses, read until we get a line starting with code + space
  let fullResponse = lines[0];

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].match(/^\d{3} /)) {
      // This is the last line of a multi-line response
      fullResponse = lines[i];
      break;
    } else if (lines[i].match(/^\d{3}-/)) {
      // This is a continuation line, keep reading
      fullResponse = lines[i];
    }
  }

  return fullResponse.trim();
}

async function writeLine(conn: Deno.Conn, line: string): Promise<void> {
  await conn.write(new TextEncoder().encode(line + "\r\n"));
}

// RFC 2047 encoded-word, needed because raw non-ASCII bytes in a header
// (e.g. an em dash in the subject) get reinterpreted as Latin-1 by mail
// clients and render as mojibake ("â€"" instead of "—"). Headers are
// otherwise sent as-is over SMTP with no charset declaration of their own —
// unlike the body, which does declare charset=utf-8 and so isn't affected.
function encodeHeaderValue(value: string): string {
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

// Base64-encodes the body and wraps it at 76 chars/line (RFC 2045). This is
// what actually makes HTML delivery work: without a declared
// Content-Transfer-Encoding, MIME defaults to 7bit — i.e. the message
// promises pure ASCII. Our HTML templates contain real UTF-8 (em dashes,
// checkmarks), so the raw bytes were 8-bit while the message silently
// claimed 7bit — a MIME violation many receiving/relay servers accept over
// the wire (still a "250 OK", which is why this looked like a successful
// send) and then quarantine or drop rather than deliver. Sending as
// base64 sidesteps that entirely: the wire bytes are pure ASCII by
// construction, so no transfer-encoding claim can be wrong. It also fixes a
// second, independent bug — the body used to go out as one unbroken
// multi-KB "line" with bare \n instead of \r\n, which violates SMTP's
// CRLF-only framing and RFC 5321's 998-octet line-length limit. Base64's
// alphabet (A-Za-z0-9+/=) never contains a leading ".", so this also needs
// no dot-stuffing.
function toBase64Lines(text: string): string[] {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const b64 = btoa(binary);
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 76) {
    lines.push(b64.slice(i, i + 76));
  }
  return lines;
}

// RFC 5322 Date header, e.g. "Tue, 19 Aug 2026 14:32:00 +0000". Several
// receiving MTAs (Gmail included) treat a missing Date header as a strong
// spam/spoofing signal and will silently junk or reject the message.
function formatRfc5322Date(date: Date): string {
  return date.toUTCString().replace("GMT", "+0000");
}

// Throws with the raw SMTP response attached when a command isn't accepted,
// instead of trusting a bare "connection didn't throw" as success. Before
// this, a rejected AUTH/RCPT/DATA still fell through to `{ok: true}` — the
// send looked successful in the admin panel while the server had actually
// refused it.
function assertSmtpOk(step: string, response: string, expectedCodes: string[]): void {
  const code = response.slice(0, 3);
  if (!expectedCodes.includes(code)) {
    throw new Error(`SMTP ${step} failed: ${response || "(no response)"}`);
  }
}

async function sendViaSMTP(
  host: string,
  port: number,
  user: string,
  password: string,
  from: string,
  to: string[],
  subject: string,
  body: string,
  isHtml: boolean
): Promise<void> {
  console.log(`Connecting to SMTP: ${host}:${port}`);

  const conn = await Deno.connect({ hostname: host, port });
  console.log("Connected to SMTP server");

  try {
    let smtpConn = conn;

    // For SMTPS (port 465), upgrade to TLS immediately
    if (port === 465) {
      console.log("Upgrading to TLS immediately (SMTPS)...");
      smtpConn = await Deno.startTls(conn, { hostname: host });
      console.log("TLS connection established");
    } else {
      // For SMTP with STARTTLS (port 587)
      // Read greeting
      let response = await readLine(conn);
      console.log("Server greeting:", response);

      // Send EHLO
      await writeLine(conn, "EHLO localhost");
      response = await readLine(conn);
      console.log("EHLO response:", response);

      // Send STARTTLS
      await writeLine(conn, "STARTTLS");
      response = await readLine(conn);
      console.log("STARTTLS response:", response);

      // Upgrade to TLS
      console.log("Upgrading to TLS...");
      smtpConn = await Deno.startTls(conn, { hostname: host });
      console.log("TLS connection established");
    }

    // Send EHLO after TLS
    let response = await readLine(smtpConn);
    console.log("Server greeting (after TLS):", response);

    await writeLine(smtpConn, "EHLO localhost");
    response = await readLine(smtpConn);
    console.log("EHLO response:", response);

    // Authenticate with PLAIN mechanism
    console.log("Authenticating...");
    const authString = `\0${user}\0${password}`;
    const authBase64 = btoa(authString);
    await writeLine(smtpConn, `AUTH PLAIN ${authBase64}`);
    response = await readLine(smtpConn);
    console.log("AUTH response:", response);
    assertSmtpOk("AUTH", response, ["235"]);

    // Send MAIL FROM
    console.log(`Sending MAIL FROM: ${from}`);
    await writeLine(smtpConn, `MAIL FROM:<${from}>`);
    response = await readLine(smtpConn);
    console.log("MAIL FROM response:", response);
    assertSmtpOk("MAIL FROM", response, ["250"]);

    // Send RCPT TO for each recipient
    for (const recipient of to) {
      console.log(`Sending RCPT TO: ${recipient}`);
      await writeLine(smtpConn, `RCPT TO:<${recipient}>`);
      response = await readLine(smtpConn);
      console.log("RCPT TO response:", response);
      assertSmtpOk(`RCPT TO <${recipient}>`, response, ["250", "251"]);
    }

    // Send DATA
    console.log("Sending DATA command");
    await writeLine(smtpConn, "DATA");
    response = await readLine(smtpConn);
    console.log("DATA response:", response);
    assertSmtpOk("DATA", response, ["354"]);

    // Compose and send email. The envelope MAIL FROM above stays a bare
    // address (SMTP requires that); this header can carry a display name.
    // Body goes out base64-encoded (see toBase64Lines) — that's what makes
    // HTML with non-ASCII characters (em dashes, checkmarks, etc.) actually
    // deliver instead of silently getting dropped as malformed 7bit.
    const now = new Date();
    const headerLines = [
      `From: "Choseno" <${from}>`,
      `To: ${to.join(", ")}`,
      `Subject: ${encodeHeaderValue(subject)}`,
      `Date: ${formatRfc5322Date(now)}`,
      `Message-ID: <${crypto.randomUUID()}@choseno.com>`,
      `MIME-Version: 1.0`,
      `Content-Type: ${isHtml ? "text/html" : "text/plain"}; charset=utf-8`,
      `Content-Transfer-Encoding: base64`,
      "",
    ];

    for (const line of headerLines) {
      await writeLine(smtpConn, line);
    }
    for (const line of toBase64Lines(body)) {
      await writeLine(smtpConn, line);
    }

    // End message
    await writeLine(smtpConn, ".");
    response = await readLine(smtpConn);
    console.log("Message acceptance response:", response);
    assertSmtpOk("message acceptance", response, ["250"]);

    // Send QUIT
    try {
      await writeLine(smtpConn, "QUIT");
      response = await readLine(smtpConn);
      console.log("QUIT response:", response);
    } catch {}

    try {
      smtpConn.close();
    } catch {}
    console.log("Email sent successfully");
  } catch (error) {
    try {
      smtpConn?.close();
    } catch {}
    try {
      conn?.close();
    } catch {}
    throw error;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const { to, subject, html, text, replyTo } = (await req.json()) as EmailRequest;

    if (!to || !subject || (!html && !text)) {
      return new Response(
        JSON.stringify({ error: "to, subject, and (html or text) are required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = Deno.env.get("SMTP_PORT");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");

    console.log("SMTP config check:", {
      host: smtpHost ? "set" : "MISSING",
      port: smtpPort ? "set" : "MISSING",
      user: smtpUser ? "set" : "MISSING",
      password: smtpPassword ? "set" : "MISSING",
    });

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
      return new Response(
        JSON.stringify({
          error: "SMTP configuration incomplete",
          config: {
            host: smtpHost ? "set" : "MISSING",
            port: smtpPort ? "set" : "MISSING",
            user: smtpUser ? "set" : "MISSING",
            password: smtpPassword ? "set" : "MISSING",
          },
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const recipients = Array.isArray(to) ? to : [to];
    const emailBody = html || text || "";
    const isHtml = !!html;

    console.log(`Sending email to ${recipients.length} recipient(s)`);

    await sendViaSMTP(
      smtpHost,
      parseInt(smtpPort),
      smtpUser,
      smtpPassword,
      replyTo || smtpUser,
      recipients,
      subject,
      emailBody,
      isHtml
    );

    return new Response(
      JSON.stringify({
        ok: true,
        sent: recipients.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Email send error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to send email",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
