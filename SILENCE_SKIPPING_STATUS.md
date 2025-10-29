# Audio Silence Skipping - Implementation Status

## ✅ What's Implemented

1. **Database Schema** - `audio_silence_analysis` table stores FFmpeg silence detection results
2. **FFmpeg Silence Detection API** - `/api/provider/analyze-silence` analyzes audio files and detects silent segments
3. **AudioPlayerWithSilenceSkip Component** - React component that attempts to skip silent segments
4. **Automatic Analysis Trigger** - Analysis runs when provider first views intake recording

## ❌ Critical Issue: WebM Files Are Unseekable

### Problem

The combined WebM audio files (`combined-*.webm`) **lack keyframes**, making them completely unseekable. When the code attempts:

```javascript
audio.currentTime = 19.35; // Try to skip to 19.35 seconds
```

The browser **silently ignores** this assignment because there are no keyframes to seek to.

**Evidence:**
```
[audio_player] ❌ TimeUpdate skip FAILED - currentTime did not change!
[audio_player] ❌ Expected: 19.35 Got: 0.07
[audio_player] ❌ This WebM file appears to have NO seekable keyframes
```

### Root Cause

File: `/src/app/api/provider/combine-intake-audio/route.ts` (line 163)

The audio chunks are combined by concatenating Blobs:

```typescript
const combinedBlob = new Blob(allBlobs, { type: 'audio/webm;codecs=opus' });
```

This creates a single file but **does not re-encode** it. Since the individual chunks lack keyframes, the combined file also lacks keyframes.

## 🔧 Required Fix

### Option 1: Server-Side FFmpeg Re-encoding (Recommended)

Modify `/src/app/api/provider/combine-intake-audio/route.ts` to:

1. Download all chunks to temp files
2. Use FFmpeg to concatenate AND re-encode with keyframes:

```bash
ffmpeg -f concat -safe 0 -i filelist.txt \
  -c:a libopus -b:a 64k \
  -force_key_frames "expr:gte(t,n_forced*2)" \
  output.webm
```

The `-force_key_frames "expr:gte(t,n_forced*2)"` flag adds a keyframe every 2 seconds, making the file seekable.

**Pros:**
- Fixes seeking for all future recordings
- Makes files seekable in all browsers
- Enables silence skipping feature

**Cons:**
- Requires FFmpeg binary on server
- Adds processing time (~1-2 seconds per minute of audio)
- More complex implementation

### Option 2: Re-encode Existing Files (Batch Job)

Create a one-time migration script to re-encode all existing `combined-*.webm` files:

```typescript
// Pseudo-code
for each combined file in storage:
  download file
  re-encode with FFmpeg (add keyframes)
  upload re-encoded file
  update database
```

### Option 3: Client-Side Recording with Keyframes

Modify the WebRTC MediaRecorder settings to include keyframes:

```typescript
const mediaRecorder = new MediaRecorder(stream, {
  mimeType: 'audio/webm;codecs=opus',
  videoBitsPerSecond: 0,
  audioBitsPerSecond: 64000
});
```

**Note:** This may not be sufficient - browser implementations vary. Server-side re-encoding is more reliable.

## 📊 Current State

### What Works
- ✅ Silence detection (FFmpeg analysis produces accurate results)
- ✅ Database storage of silence segments
- ✅ UI component renders correctly
- ✅ Skip logic attempts to jump forward

### What Doesn't Work
- ❌ Actual seeking (browser ignores `currentTime` assignments)
- ❌ Silence skipping (audio plays through all 19 seconds of silence)

## 🎯 Next Steps

**To enable silence skipping:**

1. **Implement FFmpeg re-encoding** in `/src/app/api/provider/combine-intake-audio/route.ts`
2. **Test with a new recording** (will have keyframes after fix)
3. **Batch re-encode existing files** (optional - for historical recordings)

**Dependencies needed:**
- `fluent-ffmpeg` (already installed)
- FFmpeg binary on server (already at `/opt/homebrew/bin/ffmpeg` in development)
- For production: FFmpeg binary in deployment environment (Vercel may need Edge Functions or external service)

## 📝 Files Modified

### Created:
- `/src/app/api/provider/analyze-silence/route.ts` - Silence detection API
- `/src/app/api/provider/get-silence-analysis/route.ts` - Get cached analysis
- `/src/components/AudioPlayerWithSilenceSkip.tsx` - Audio player with skip logic
- `audio_silence_analysis` table in Supabase

### Modified:
- `/src/app/dashboard/provider/intake/[code]/page.tsx` - Uses new AudioPlayer component
- `package.json` - Added fluent-ffmpeg dependencies

## 🔍 Testing Commands

```sql
-- Check if analysis exists for a file
SELECT file_path, array_length(silence_segments, 1) as segment_count, duration_seconds
FROM audio_silence_analysis
ORDER BY analyzed_at DESC;

-- View silence segments for a specific file
SELECT silence_segments
FROM audio_silence_analysis
WHERE file_path = 'v18-voice-recordings/[conversation-id]/combined-[timestamp].webm';
```

## 💡 Alternative Approach (If FFmpeg Re-encoding Is Not Feasible)

If server-side FFmpeg processing is not possible:

1. **Accept the limitation** - Document that seeking doesn't work due to WebM constraints
2. **Use playbackRate instead** - Speed up playback through silent sections (e.g., 4x speed) rather than skipping
3. **Client-side WebAssembly FFmpeg** - Use @ffmpeg/ffmpeg to re-encode in the browser (slow, but possible)

**Example playbackRate approach:**
```typescript
if (inSilenceSegment) {
  audio.playbackRate = 4.0; // 4x speed through silence
} else {
  audio.playbackRate = 1.0; // Normal speed
}
```

This would make silent sections pass 4x faster without needing seeking.

---

**Status:** Implementation complete, but **blocked by unseekable WebM files**. FFmpeg re-encoding required to enable functionality.
