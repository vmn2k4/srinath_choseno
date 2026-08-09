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

    // Send MAIL FROM
    console.log(`Sending MAIL FROM: ${from}`);
    await writeLine(smtpConn, `MAIL FROM:<${from}>`);
    response = await readLine(smtpConn);
    console.log("MAIL FROM response:", response);

    // Send RCPT TO for each recipient
    for (const recipient of to) {
      console.log(`Sending RCPT TO: ${recipient}`);
      await writeLine(smtpConn, `RCPT TO:<${recipient}>`);
      response = await readLine(smtpConn);
      console.log("RCPT TO response:", response);
    }

    // Send DATA
    console.log("Sending DATA command");
    await writeLine(smtpConn, "DATA");
    response = await readLine(smtpConn);
    console.log("DATA response:", response);

    // Compose and send email
    const emailLines = [
      `From: ${from}`,
      `To: ${to.join(", ")}`,
      `Subject: ${subject}`,
      `Content-Type: ${isHtml ? "text/html" : "text/plain"}; charset=utf-8`,
      "",
      body,
    ];

    for (const line of emailLines) {
      await writeLine(smtpConn, line);
    }

    // End message
    await writeLine(smtpConn, ".");
    response = await readLine(smtpConn);
    console.log("Message acceptance response:", response);

    // Send QUIT
    await writeLine(smtpConn, "QUIT");
    response = await readLine(smtpConn);
    console.log("QUIT response:", response);

    smtpConn.close();
    console.log("Email sent successfully");
  } catch (error) {
    conn.close();
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
