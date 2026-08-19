import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function testImapConnection(): Promise<{ success: boolean; message: string; details?: unknown }> {
  const imapHost = Deno.env.get("IMAP_HOST");
  const imapPort = Deno.env.get("IMAP_PORT");
  const imapUser = Deno.env.get("IMAP_USER");
  const imapPassword = Deno.env.get("IMAP_PASSWORD");

  console.log("🧪 IMAP Connection Test");
  console.log("Config check:", {
    host: imapHost ? "✅ set" : "❌ MISSING",
    port: imapPort ? "✅ set" : "❌ MISSING",
    user: imapUser ? `✅ ${imapUser}` : "❌ MISSING",
    password: imapPassword ? "✅ set" : "❌ MISSING",
  });

  if (!imapHost || !imapPort || !imapUser || !imapPassword) {
    return {
      success: false,
      message: "❌ IMAP secrets not fully configured in Supabase",
      details: {
        host: imapHost ? "set" : "MISSING",
        port: imapPort ? "set" : "MISSING",
        user: imapUser ? "set" : "MISSING",
        password: imapPassword ? "set" : "MISSING",
      },
    };
  }

  try {
    const port = parseInt(imapPort);
    console.log(`Attempting to connect to ${imapHost}:${port}...`);

    // Connect to IMAP server
    const conn = await Deno.connect({
      hostname: imapHost,
      port: port,
    });

    console.log("✅ TCP connection established");

    // For SSL (port 993), upgrade to TLS immediately
    let imapConn: Deno.Conn = conn;
    if (port === 993) {
      console.log("Upgrading to TLS...");
      imapConn = await Deno.startTls(conn, { hostname: imapHost });
      console.log("✅ TLS connection established");
    }

    // Read IMAP greeting
    const buffer = new Uint8Array(1024);
    const n = await imapConn.read(buffer);
    const greeting = new TextDecoder().decode(buffer.subarray(0, n));
    console.log("Server greeting:", greeting.trim());

    if (!greeting.includes("OK") && !greeting.includes("*")) {
      imapConn.close();
      return {
        success: false,
        message: "❌ Invalid IMAP server response",
        details: { greeting: greeting.trim() },
      };
    }

    // Send LOGIN command
    const loginCmd = `a001 LOGIN "${imapUser}" "${imapPassword}"\r\n`;
    await imapConn.write(new TextEncoder().encode(loginCmd));
    console.log("📤 Sent LOGIN command");

    // Read login response
    const loginBuffer = new Uint8Array(2048);
    const loginN = await imapConn.read(loginBuffer);
    const loginResponse = new TextDecoder().decode(loginBuffer.subarray(0, loginN));
    console.log("Login response:", loginResponse.trim());

    if (loginResponse.includes("BAD") || loginResponse.includes("NO")) {
      imapConn.close();
      return {
        success: false,
        message: "❌ IMAP login failed - check credentials",
        details: { response: loginResponse.trim() },
      };
    }

    console.log("✅ Login successful!");

    // Send SELECT INBOX to check mailbox
    const selectCmd = `a002 SELECT INBOX\r\n`;
    await imapConn.write(new TextEncoder().encode(selectCmd));
    console.log("📤 Sent SELECT INBOX command");

    const selectBuffer = new Uint8Array(2048);
    const selectN = await imapConn.read(selectBuffer);
    const selectResponse = new TextDecoder().decode(selectBuffer.subarray(0, selectN));
    console.log("SELECT response:", selectResponse.trim());

    // Send LOGOUT
    const logoutCmd = `a003 LOGOUT\r\n`;
    await imapConn.write(new TextEncoder().encode(logoutCmd));
    imapConn.close();

    return {
      success: true,
      message: "✅ IMAP connection successful! Ready to receive emails.",
      details: {
        host: imapHost,
        port: port,
        user: imapUser,
        inboxAccessible: selectResponse.includes("OK"),
      },
    };
  } catch (error) {
    console.error("Connection error:", error);
    return {
      success: false,
      message: `❌ Connection failed: ${error instanceof Error ? error.message : String(error)}`,
      details: { error: String(error) },
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
    const result = await testImapConnection();
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Server error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: `Server error: ${error instanceof Error ? error.message : String(error)}`,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
