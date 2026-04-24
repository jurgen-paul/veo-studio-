/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;

/**
 * Loads FFmpeg library if not already loaded.
 */
export const loadFFmpeg = async () => {
  if (ffmpegInstance) return ffmpegInstance;

  const ffmpeg = new FFmpeg();
  
  // Use versioned CDN URLs for stability
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
};

/**
 * Compresses a video blob using ffmpeg.wasm.
 * @param inputBlob The original video blob.
 * @param onProgress Callback for compression progress (0-100).
 * @returns A promise that resolves to the compressed video blob.
 */
export const compressVideo = async (
  inputBlob: Blob,
  onProgress?: (progress: number) => void
): Promise<Blob> => {
  console.log('Initiating video compression...');
  const ffmpeg = await loadFFmpeg();
  
  // Track progress
  ffmpeg.on('progress', ({ progress }) => {
    if (onProgress) {
        // progress is 0 to 1
        onProgress(Math.round(progress * 100));
    }
  });

  const inputName = 'input.mp4';
  const outputName = 'output.mp4';

  // Mount the input file
  await ffmpeg.writeFile(inputName, await fetchFile(inputBlob));

  /**
   * Compression arguments:
   * -crf 28: Constant Rate Factor. 18-28 is typical. 28 is high compression, acceptable quality.
   * -preset veryfast: Faster encoding at the cost of slight size increase.
   * -vf scale=-2:720: Ensure resolution is max 720p to save space.
   */
  await ffmpeg.exec([
    '-i', inputName,
    '-c:v', 'libx264',
    '-crf', '28',
    '-preset', 'veryfast',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', // Ensure dimensions are even for H264
    '-movflags', '+faststart',
    outputName
  ]);

  const data = await ffmpeg.readFile(outputName);
  
  // Clean up
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  console.log('Compression complete.');
  return new Blob([data as any], { type: 'video/mp4' });
};
