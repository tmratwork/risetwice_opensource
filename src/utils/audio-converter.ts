// src/utils/audio-converter.ts
// Reusable WebM to MP3 conversion utility for client-side audio processing

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

// Global FFmpeg instance to avoid multiple initializations
let ffmpegInstance: FFmpeg | null = null;
let isFFmpegLoading = false;

/**
 * Initialize FFmpeg.wasm if not already initialized
 * @returns Promise<FFmpeg> The initialized FFmpeg instance
 */
async function getFFmpegInstance(): Promise<FFmpeg> {
  if (ffmpegInstance) {
    return ffmpegInstance;
  }

  if (isFFmpegLoading) {
    // Wait for existing initialization to complete
    while (isFFmpegLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (ffmpegInstance) {
      return ffmpegInstance;
    }
  }

  try {
    isFFmpegLoading = true;
    console.log('[audio_converter] Initializing FFmpeg.wasm...');

    ffmpegInstance = new FFmpeg();

    // Load FFmpeg core
    await ffmpegInstance.load();

    console.log('[audio_converter] FFmpeg.wasm initialized successfully');
    return ffmpegInstance;
  } catch (error) {
    console.error('[audio_converter] Failed to initialize FFmpeg:', error);
    throw new Error('Failed to initialize FFmpeg. Audio conversion not supported in this browser.');
  } finally {
    isFFmpegLoading = false;
  }
}

/**
 * Convert WebM audio to MP3 and trigger download
 * @param webmUrl - URL of the WebM audio file
 * @param filename - Base filename for the output (without extension)
 * @param onProgress - Optional callback for conversion progress
 * @returns Promise<void>
 */
export async function convertWebMToMp3(
  webmUrl: string,
  filename: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  try {
    console.log('[audio_converter] Starting WebM to MP3 conversion:', filename);

    // Initialize FFmpeg
    const ffmpeg = await getFFmpegInstance();

    // Set up progress tracking if callback provided
    if (onProgress) {
      ffmpeg.on('progress', ({ progress }) => {
        const percentage = Math.round(progress * 100);
        console.log('[audio_converter] Conversion progress:', percentage + '%');
        onProgress(percentage);
      });
    }

    // Fetch the WebM file
    console.log('[audio_converter] Fetching WebM file...');
    onProgress?.(10);

    const webmData = await fetchFile(webmUrl);
    console.log('[audio_converter] WebM file fetched, size:', webmData.byteLength, 'bytes');

    // Write input file to FFmpeg filesystem
    const inputFileName = 'input.webm';
    const outputFileName = 'output.mp3';

    await ffmpeg.writeFile(inputFileName, webmData);
    onProgress?.(20);

    console.log('[audio_converter] Starting FFmpeg conversion...');

    // Convert WebM to MP3 with high quality settings
    // -codec:a libmp3lame: Use LAME MP3 encoder
    // -b:a 192k: Set audio bitrate to 192 kbps (high quality)
    // -ar 44100: Set sample rate to 44.1 kHz (standard)
    await ffmpeg.exec([
      '-i', inputFileName,
      '-codec:a', 'libmp3lame',
      '-b:a', '192k',
      '-ar', '44100',
      outputFileName
    ]);

    onProgress?.(80);

    // Read the converted MP3 file
    const mp3Data = await ffmpeg.readFile(outputFileName);
    console.log('[audio_converter] Conversion completed, MP3 size:', mp3Data.length, 'bytes');

    // Clean up temporary files
    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);

    onProgress?.(90);

    // Create blob and trigger download
    const mp3Blob = new Blob([mp3Data], { type: 'audio/mpeg' });
    const downloadUrl = URL.createObjectURL(mp3Blob);

    // Create temporary download link and trigger click
    const downloadLink = document.createElement('a');
    downloadLink.href = downloadUrl;
    downloadLink.download = `${filename}.mp3`;
    downloadLink.style.display = 'none';

    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    // Clean up object URL
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

    onProgress?.(100);
    console.log('[audio_converter] ✅ MP3 download initiated successfully');

  } catch (error) {
    console.error('[audio_converter] ❌ Conversion failed:', error);

    // Provide user-friendly error messages
    if (error instanceof Error) {
      if (error.message.includes('SharedArrayBuffer')) {
        throw new Error('Audio conversion requires secure context (HTTPS). Please use HTTPS to enable this feature.');
      } else if (error.message.includes('WebAssembly')) {
        throw new Error('Audio conversion not supported in this browser. Please try a modern browser like Chrome, Firefox, or Safari.');
      } else if (error.message.includes('network')) {
        throw new Error('Failed to download audio file. Please check your internet connection.');
      }
    }

    throw new Error(`Audio conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if audio conversion is supported in the current browser
 * @returns boolean - True if conversion is supported
 */
export function isAudioConversionSupported(): boolean {
  try {
    // Check for required browser features
    const hasWebAssembly = typeof WebAssembly !== 'undefined';
    const hasWorkers = typeof Worker !== 'undefined';

    // SharedArrayBuffer is optional - FFmpeg can work without it in many cases
    // We'll try the conversion and handle errors gracefully if it fails
    console.log('[audio_converter] Browser support check:', {
      WebAssembly: hasWebAssembly,
      Worker: hasWorkers,
      SharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined'
    });

    return hasWebAssembly && hasWorkers;
  } catch (error) {
    console.warn('[audio_converter] Browser compatibility check failed:', error);
    return false;
  }
}

/**
 * Get a user-friendly filename from a URL
 * @param url - The audio file URL
 * @param sessionNumber - Session number for naming
 * @returns string - Clean filename for download
 */
export function generateAudioFilename(url: string, sessionNumber?: number): string {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const baseFilename = sessionNumber
    ? `s2-session-${sessionNumber}-${timestamp}`
    : `s2-audio-${timestamp}`;

  return baseFilename;
}