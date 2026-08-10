# Video Support

In-browser video recording, upload, storage, and playback across the platform.

---

## Overview

Users can:
- **Record videos in-browser** using webcam/microphone (candidate intros, politician pitches)
- **Upload pre-recorded videos** (from file picker)
- **View video galleries** on walls, campaigns, feeds
- **Play videos inline** in posts/stories or full-screen

---

## Recording & Upload

### Browser Recording (`VideoRecorder` component)

Used in:
- **Candidate application** (`/apply/:candidateId`) — Required 90-second intro
- **Feed/wall composer** — Optional video post
- **Politician wall posts** — Video pitch

**Technical stack**:
- **Browser API**: `MediaRecorder` (native)
- **Codec**: Vorbis (audio) + VP8 (video) by default; falls back to device default
- **Container**: WebM preferred, MP4 fallback
- **Duration cap**: 90 seconds (candidate), unlimited (posts/walls) with warning
- **File size limit**: 500MB (browser storage) → uploaded in chunks

**Component API**:
```tsx
<VideoRecorder
  maxDuration={90}  // seconds
  onRecordingComplete={(blob: Blob) => {
    // Upload blob to storage
  }}
  onError={(error) => {
    // Handle permission denied, device unavailable, etc.
  }}
/>
```

### File Upload (`VideoUploader`)

Alternative to recording — user selects a pre-recorded file.

- **Formats accepted**: MP4, WebM, Ogg, MOV
- **Size limit**: 500MB
- **Metadata extraction**: Duration, dimensions (for preview)

---

## Storage & Serving

### Supabase Storage Bucket

**Bucket name**: `video-uploads` (public read, authenticated write)

**Path structure**:
```
video-uploads/
├── candidates/
│   ├── {candidacy_id}/
│   │   ├── intro.webm          (Required intro video)
│   │   └── question_{id}.webm  (Per-question answer video)
├── posts/
│   ├── {post_id}.webm          (Post/wall video)
├── politicians/
│   ├── {profile_id}/
│   │   └── pitch_{date}.webm   (Politician pitch post)
```

**Permissions**:
- Public read (anyone can view)
- Authenticated write (signed-in users can upload their own)
- RLS enforces: a user can only upload to their own `candidate_id`/`post_id`/`profile_id`

### CDN & Playback

**URL format**:
```
https://{project-url}.supabase.co/storage/v1/object/public/video-uploads/{path}
```

**Browser playback**:
```html
<video src="https://..." controls width="100%" />
```

**Mobile**: HLS adaptive streaming (if added in future for bandwidth savings).

---

## Storage Schema

### `posts` / `candidacy_applications` / `politician_profiles`

**Fields for video URLs**:
- `video_url` (text, nullable) — Full Supabase URL to video blob
- `video_duration` (int, nullable) — Duration in seconds (extracted on upload)
- `video_thumbnail_url` (text, nullable) — Screenshot at 0:00 or user-selected frame

**Why store URL?** 
- Avoids storing blobs in main table (bandwidth)
- URL is stable; video can be re-uploaded if corrupted
- Easier to migrate storage later (just change URL prefix)

### Video Metadata Table (Optional)

If tracking transcoding/processing state is needed:

```sql
CREATE TABLE video_metadata (
  id uuid PRIMARY KEY,
  original_url text NOT NULL,      -- Uploaded file
  transcoded_urls jsonb,            -- Per-quality URLs { "720p": "...", "480p": "..." }
  duration int,                     -- Seconds
  dimensions jsonb,                 -- { "width": 1920, "height": 1080 }
  processing_status text,           -- 'pending', 'processing', 'done', 'error'
  error_message text,
  created_at timestamp DEFAULT NOW()
);
```

---

## Upload Workflow

### Step-by-Step (in component)

1. **Start recording** or **select file**
   ```tsx
   <VideoRecorder onRecordingComplete={handleUpload} />
   // OR
   <input type="file" onChange={handleFileSelect} />
   ```

2. **Extract metadata** (duration, dimensions)
   ```ts
   const video = new Video(blob);
   const duration = await video.getDuration();
   const { width, height } = video.getDimensions();
   ```

3. **Generate thumbnail** (optional, for preview)
   ```ts
   const thumbnail = await video.captureFrame(0); // Frame at 0ms
   ```

4. **Upload to Supabase Storage**
   ```ts
   const { data, error } = await supabase.storage
     .from('video-uploads')
     .upload(`posts/${postId}.webm`, blob, {
       contentType: 'video/webm',
       upsert: false
     });
   ```

5. **Store URL in database**
   ```ts
   await supabase.from('posts').update({
     video_url: data.path,  // Path, not full URL
     video_duration: duration
   }).eq('id', postId);
   ```

6. **On read, reconstruct full URL**
   ```ts
   const fullUrl = `${SUPABASE_URL}/storage/v1/object/public/${video_url}`;
   ```

---

## Display & Playback

### Feed/Wall Posts (`PostCard`)

**Video thumbnail + play icon**:
- Show thumbnail image (or generated frame)
- Overlay play icon
- On click: open `VideoPlayer` modal (full-screen)

### Stories/Reels (`StoryStrip`)

**Auto-scroll through politician videos**:
- Vertical thumbnails at top of feed
- Click thumbnail → open full-screen player
- Swipe/arrow keys to navigate
- Auto-advance to next video on end (or on countdown timer)

### Candidate Application (`CandidateApplicationClient`)

**Required intro video**:
- Recorded in app or uploaded
- Preview before submitting
- Max 90 seconds (warning at 80s)
- No re-record? Link to edit application

**Question videos** (if questionnaire has video answers):
- Optional per-question video elaboration
- Preview + delete button

### Politician Wall (`PoliticianWallClient`)

**Video posts**:
- Inline playback (don't expand; fit in feed)
- OR full-screen on click (per UX design)

**Engagement**: Like/comment on video posts (same as text posts).

---

## Video Player Component

### `VideoPlayer` / `VideoPlayerModal`

```tsx
<VideoPlayerModal
  videoUrl={url}
  duration={duration}
  title="Intro Video"
  onClose={() => setOpen(false)}
/>
```

**Features**:
- **Play/pause**: Spacebar
- **Volume**: Slider
- **Fullscreen**: Button or double-click
- **Progress bar**: Click to seek
- **Speed control**: 0.75x, 1x, 1.5x, 2x (optional)
- **Keyboard shortcuts**:
  - `Space` = play/pause
  - `F` = fullscreen
  - `M` = mute
  - `→` = +10s
  - `←` = -10s

---

## Performance & Optimization

### Client-Side

- **Lazy load**: Videos don't preload until hovered/clicked
- **Thumbnail preview**: Show still image instead of loading video
- **Compression**: Before upload, re-encode if file > 100MB (optional, PWA-only)

### Server-Side (Future)

- **Transcoding**: Convert all uploads to VP8 + H.264 for compatibility
- **Adaptive bitrate**: Serve 720p on wifi, 480p on mobile LTE
- **CDN caching**: 7-day edge cache on Supabase CDN
- **Analytics**: Track play time, seek patterns (via GA4 events)

---

## Related Files

| File | Purpose |
|---|---|
| [`src/components/features/VideoRecorder.tsx`](../src/components/features/VideoRecorder.tsx) | In-browser recording UI |
| [`src/lib/services/video.ts`](../src/lib/services/video.ts) | Upload + metadata extraction |
| [`src/components/primitives/StoryViewerModal.tsx`](../src/components/primitives/StoryViewerModal.tsx) | Full-screen video player |
| [`PostCard.tsx`](../src/components/features/PostCard.tsx) | Video thumbnail + play icon |
| [`StoryStrip.tsx`](../src/components/features/StoryStrip.tsx) | Story gallery |

---

## Future Enhancements

- [ ] **Live streaming**: Real-time town halls, debates (via Agora/Twilio SDK)
- [ ] **Transcription**: Auto-generate captions (via AssemblyAI API)
- [ ] **Editing**: Trim, cut, add title card in browser
- [ ] **Analytics**: Heatmap of where viewers pause/replay
- [ ] **Social sharing**: Generate short clips for Twitter/TikTok
- [ ] **Accessibility**: Keyboard controls for recording, descriptive audio track option
