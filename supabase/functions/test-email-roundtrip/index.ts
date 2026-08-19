import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendTestEmail(): Promise<{ ok: boolean; sent: number; error?: string }> {
  const smtpHost = Deno.env.get("SMTP_HOST");
  const smtpPort = Deno.env.get("SMTP_PORT");
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPassword = Deno.env.get("SMTP_PASSWORD");

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
    return {
      ok: false,
      sent: 0,
      error: "SMTP configuration incomplete",
    };
  }

  const recipients = ["vijay@choseno.com"];
  const subject = "[ROUNDTRIP TEST] Test Email " + new Date().toISOString();
  const body = `
This is a test email sent at ${new Date().toISOString()}.

If you receive this, the send-receive roundtrip is working!

Reply to this email and we should be able to read it via IMAP.

---
Choseno Email System Test
  `;

  const conn = await Deno.connect({ hostname: smtpHost, port: parseInt(smtpPort) });

  try {
    let smtpConn = conn;

    // For SMTPS (port 465), upgrade to TLS immediately
    if (parseInt(smtpPort) === 465) {
      smtpConn = await Deno.startTls(conn, { hostname: smtpHost });
    } else {
      // For SMTP with STARTTLS (port 587)
      let response = await readLine(conn);
      await writeLine(conn, "EHLO localhost");
      response = await readLine(conn);
      await writeLine(conn, "STARTTLS");
      response = await readLine(conn);
      smtpConn = await Deno.startTls(conn, { hostname: smtpHost });
    }

    let response = await readLine(smtpConn);
    await writeLine(smtpConn, "EHLO localhost");
    response = await readLine(smtpConn);

    const authString = `\0${smtpUser}\0${smtpPassword}`;
    const authBase64 = btoa(authString);
    await writeLine(smtpConn, `AUTH PLAIN ${authBase64}`);
    response = await readLine(smtpConn);

    await writeLine(smtpConn, `MAIL FROM:<${smtpUser}>`);
    response = await readLine(smtpConn);

    for (const recipient of recipients) {
      await writeLine(smtpConn, `RCPT TO:<${recipient}>`);
      response = await readLine(smtpConn);
    }

    await writeLine(smtpConn, "DATA");
    response = await readLine(smtpConn);

    const emailLines = [
      `From: "Choseno Test" <${smtpUser}>`,
      `To: ${recipients.join(", ")}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset=utf-8`,
      `Message-ID: <test-${Date.now()}@choseno.com>`,
      "",
      body,
    ];

    for (const line of emailLines) {
      await writeLine(smtpConn, line);
    }

    await writeLine(smtpConn, ".");
    response = await readLine(smtpConn);

    await writeLine(smtpConn, "QUIT");
    smtpConn.close();

    return { ok: true, sent: recipients.length };
  } catch (error) {
    conn.close();
    throw error;
  }
}

async function readLine(conn: Deno.Conn): Promise<string> {
  const buffer = new Uint8Array(4096);
  const n = await conn.read(buffer);
  if (!n) return "";
  const response = new TextDecoder().decode(buffer.subarray(0, n));
  const lines = response.split("\r\n").filter((l) => l.length > 0);
  let fullResponse = lines[0];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].match(/^\d{3} /)) {
      fullResponse = lines[i];
      break;
    } else if (lines[i].match(/^\d{3}-/)) {
      fullResponse = lines[i];
    }
  }
  return fullResponse.trim();
}

async function writeLine(conn: Deno.Conn, line: string): Promise<void> {
  await conn.write(new TextEncoder().encode(line + "\r\n"));
}

async function checkEmailViaImap(): Promise<{
  received: boolean;
  emailCount: number;
  latestEmail?: {
    subject: string;
    from: string;
    date: string;
  };
  error?: string;
}> {
  const imapHost = Deno.env.get("IMAP_HOST");
  const imapPort = Deno.env.get("IMAP_PORT");
  const imapUser = Deno.env.get("IMAP_USER");
  const imapPassword = Deno.env.get("IMAP_PASSWORD");

  if (!imapHost || !imapPort || !imapUser || !imapPassword) {
    return {
      received: false,
      emailCount: 0,
      error: "IMAP configuration incomplete",
    };
  }

  try {
    const conn = await Deno.connect({
      hostname: imapHost,
      port: parseInt(imapPort),
    });

    let imapConn: Deno.Conn = conn;
    if (parseInt(imapPort) === 993) {
      imapConn = await Deno.startTls(conn, { hostname: imapHost });
    }

    // Read greeting
    const buffer = new Uint8Array(1024);
    const n = await imapConn.read(buffer);
    const greeting = new TextDecoder().decode(buffer.subarray(0, n));

    // Login
    const loginCmd = `a001 LOGIN "${imapUser}" "${imapPassword}"\r\n`;
    await imapConn.write(new TextEncoder().encode(loginCmd));

    const loginBuffer = new Uint8Array(2048);
    const loginN = await imapConn.read(loginBuffer);
    const loginResponse = new TextDecoder().decode(loginBuffer.subarray(0, loginN));

    if (loginResponse.includes("BAD") || loginResponse.includes("NO")) {
      imapConn.close();
      return {
        received: false,
        emailCount: 0,
        error: "IMAP login failed",
      };
    }

    // Select INBOX
    const selectCmd = `a002 SELECT INBOX\r\n`;
    await imapConn.write(new TextEncoder().encode(selectCmd));

    const selectBuffer = new Uint8Array(2048);
    const selectN = await imapConn.read(selectBuffer);
    const selectResponse = new TextDecoder().decode(selectBuffer.subarray(0, selectN));

    // Parse email count from EXISTS line
    const existsMatch = selectResponse.match(/(\d+) EXISTS/);
    const emailCount = existsMatch ? parseInt(existsMatch[1]) : 0;

    let latestEmail: { subject: string; from: string; date: string } | undefined;

    if (emailCount > 0) {
      // Fetch latest email header
      const fetchCmd = `a003 FETCH ${emailCount} (BODY[HEADER.FIELDS (FROM SUBJECT DATE)])\r\n`;
      await imapConn.write(new TextEncoder().encode(fetchCmd));

      const fetchBuffer = new Uint8Array(4096);
      const fetchN = await imapConn.read(fetchBuffer);
      const fetchResponse = new TextDecoder().decode(fetchBuffer.subarray(0, fetchN));

      // Parse headers
      const fromMatch = fetchResponse.match(/From:\s*(.+)/);
      const subjectMatch = fetchResponse.match(/Subject:\s*(.+)/);
      const dateMatch = fetchResponse.match(/Date:\s*(.+)/);

      latestEmail = {
        from: fromMatch ? fromMatch[1].trim() : "Unknown",
        subject: subjectMatch ? subjectMatch[1].trim() : "Unknown",
        date: dateMatch ? dateMatch[1].trim() : "Unknown",
      };
    }

    // Logout
    const logoutCmd = `a004 LOGOUT\r\n`;
    await imapConn.write(new TextEncoder().encode(logoutCmd));
    imapConn.close();

    return {
      received: emailCount > 0,
      emailCount,
      latestEmail,
    };
  } catch (error) {
    return {
      received: false,
      emailCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    console.log("📧 Step 1: Sending test email...");
    const sendResult = await sendTestEmail();

    if (!sendResult.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          step: "send",
          message: "Failed to send email",
          error: sendResult.error,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("✅ Email sent!");
    console.log("📧 Step 2: Waiting 3 seconds for email to arrive...");

    // Wait 3 seconds for email to arrive
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log("📧 Step 3: Checking IMAP inbox...");
    const imapResult = await checkEmailViaImap();

    return new Response(
      JSON.stringify({
        success: imapResult.received,
        step: "complete",
        message: imapResult.received
          ? "✅ Email roundtrip successful!"
          : "❌ Email sent but not received yet",
        send: sendResult,
        receive: imapResult,
      }),
      {
        status: imapResult.received ? 200 : 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Test error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: `Test error: ${error instanceof Error ? error.message : String(error)}`,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
