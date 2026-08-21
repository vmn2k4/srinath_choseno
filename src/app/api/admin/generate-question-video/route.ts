import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@/lib/supabase/server";
import { normalizeMediaUrl } from "@/lib/services/video";

const execFileAsync = promisify(execFile);

// Local, dev-only bridge to the question-video generator described in
// docs/VIRTUAL_INTERVIEW_SYSTEM.md Gap 1: shells out to
// nvidia_shorts_studio/question_card_engine/generate.py (Qwen TTS +
// HyperFrames render), then uploads the result to the existing
// politician_videos bucket under the caller's own session so storage RLS
// applies normally. Never runs outside next dev on this machine -- the
// pipeline needs local MLX model weights and Node/FFmpeg that don't exist
// in a deployed environment, and shelling out to an external script is not
// something to expose over the network.
const STUDIO_ENGINE_DIR =
  process.env.QUESTION_CARD_ENGINE_DIR ||
  "/Users/vmn2k4/Coding/QwneTTS_Feb_19/nvidia_shorts_studio/question_card_engine";
const GENERATE_SCRIPT = path.join(STUDIO_ENGINE_DIR, "generate.py");

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Question-video generation only runs in local development (next dev)." },
      { status: 403 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  let body: { narrationText?: string; displayText?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const narrationText = body.narrationText?.trim();
  const displayText = body.displayText?.trim();
  if (!narrationText || !displayText) {
    return NextResponse.json({ error: "narrationText and displayText are required." }, { status: 400 });
  }

  const outputPath = path.join(tmpdir(), `question-video-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);

  try {
    await execFileAsync(
      "python3",
      [GENERATE_SCRIPT, "--narration-text", narrationText, "--display-text", displayText, "--output", outputPath],
      { timeout: 5 * 60 * 1000, maxBuffer: 20 * 1024 * 1024 }
    );

    const fileBuffer = await readFile(outputPath);
    const fileName = `question_${Date.now()}.mp4`;
    const { error: uploadError } = await supabase.storage
      .from("politician_videos")
      .upload(fileName, fileBuffer, { contentType: "video/mp4" });
    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from("politician_videos").getPublicUrl(fileName);
    return NextResponse.json({ videoUrl: normalizeMediaUrl(publicUrlData.publicUrl), videoPath: fileName });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Generation failed: ${message}` }, { status: 500 });
  } finally {
    await rm(outputPath, { force: true }).catch(() => {});
  }
}
