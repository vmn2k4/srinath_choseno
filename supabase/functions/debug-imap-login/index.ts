import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function debugImapLogin(): Promise<{
  success: boolean;
  steps: Array<{ step: string; result: string }>;
  error?: string;
}> {
  const steps: Array<{ step: string; result: string }> = [];

  const imapHost = Deno.env.get("IMAP_HOST");
  const imapPort = Deno.env.get("IMAP_PORT");
  const imapUser = Deno.env.get("IMAP_USER");
  const imapPassword = Deno.env.get("IMAP_PASSWORD");

  steps.push({ step: "Config Check", result: `Host: ${imapHost ? "✅" : "❌"}, Port: ${imapPort ? "✅" : "❌"}, User: ${imapUser ? "✅" : "❌"}, Password: ${imapPassword ? "✅ set" : "❌ EMPTY"}` });

  if (!imapHost || !imapPort || !imapUser || !imapPassword) {
    return {
      success: false,
      steps,
      error: "Missing IMAP configuration",
    };
  }

  try {
    steps.push({ step: "TCP Connect", result: `Attempting ${imapHost}:${imapPort}...` });

    const conn = await Deno.connect({
      hostname: imapHost,
      port: parseInt(imapPort),
    });

    steps.push({ step: "TCP Connect", result: "✅ Connected" });

    let imapConn: Deno.Conn = conn;
    if (parseInt(imapPort) === 993) {
      steps.push({ step: "TLS Upgrade", result: "Starting TLS..." });
      imapConn = await Deno.startTls(conn, { hostname: imapHost });
      steps.push({ step: "TLS Upgrade", result: "✅ TLS established" });
    }

    // Read greeting
    steps.push({ step: "Read Greeting", result: "Reading..." });
    const buffer = new Uint8Array(1024);
    const n = await imapConn.read(buffer);
    const greeting = new TextDecoder().decode(buffer.subarray(0, n)).trim();
    steps.push({ step: "Read Greeting", result: `✅ ${greeting.substring(0, 50)}...` });

    // Send LOGIN
    steps.push({ step: "Send LOGIN", result: "Sending credentials..." });
    const loginCmd = `a001 LOGIN "${imapUser}" "${imapPassword}"\r\n`;
    await imapConn.write(new TextEncoder().encode(loginCmd));
    steps.push({ step: "Send LOGIN", result: "✅ Command sent" });

    // Read response
    steps.push({ step: "Read LOGIN Response", result: "Waiting..." });
    const loginBuffer = new Uint8Array(2048);
    const loginN = await imapConn.read(loginBuffer);
    const loginResponse = new TextDecoder().decode(loginBuffer.subarray(0, loginN)).trim();
    steps.push({ step: "Read LOGIN Response", result: `Response: ${loginResponse.substring(0, 100)}...` });

    // Parse response
    if (loginResponse.includes("OK")) {
      steps.push({ step: "LOGIN Status", result: "✅ SUCCESS" });

      // Try SELECT INBOX
      steps.push({ step: "SELECT INBOX", result: "Selecting inbox..." });
      await imapConn.write(new TextEncoder().encode("a002 SELECT INBOX\r\n"));
      const selectBuffer = new Uint8Array(2048);
      const selectN = await imapConn.read(selectBuffer);
      const selectResponse = new TextDecoder().decode(selectBuffer.subarray(0, selectN)).trim();
      steps.push({ step: "SELECT INBOX", result: `✅ ${selectResponse.substring(0, 80)}...` });

      imapConn.close();
      return { success: true, steps };
    } else if (loginResponse.includes("NO")) {
      steps.push({ step: "LOGIN Status", result: `❌ NO - Credentials rejected` });
      imapConn.close();
      return { success: false, steps, error: "Login credentials rejected by server" };
    } else if (loginResponse.includes("BAD")) {
      steps.push({ step: "LOGIN Status", result: `❌ BAD - Protocol error` });
      imapConn.close();
      return { success: false, steps, error: "Protocol error - bad command" };
    } else {
      steps.push({ step: "LOGIN Status", result: `❓ Unknown: ${loginResponse.substring(0, 50)}` });
      imapConn.close();
      return { success: false, steps, error: "Unknown response from server" };
    }
  } catch (error) {
    steps.push({ step: "Error", result: error instanceof Error ? error.message : String(error) });
    return { success: false, steps, error: String(error) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const result = await debugImapLogin();
    return new Response(JSON.stringify(result, null, 2), {
      status: result.success ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Server error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        steps: [],
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
