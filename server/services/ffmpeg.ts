export interface ProbeResult {
  durationMs: number;
  width: number;
  height: number;
}

export async function probe(path: string): Promise<ProbeResult> {
  const proc = Bun.spawn(
    [
      "ffprobe",
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      path,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );

  const text = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`ffprobe failed with exit code ${exitCode}`);
  }

  const info = JSON.parse(text);
  const videoStream = info.streams?.find((s: any) => s.codec_type === "video");
  const durationSec = parseFloat(info.format?.duration ?? videoStream?.duration ?? "0");

  return {
    durationMs: Math.round(durationSec * 1000),
    width: videoStream?.width ?? 0,
    height: videoStream?.height ?? 0,
  };
}

export async function thumbnail(path: string, outPath: string, atMs: number): Promise<void> {
  const atSec = (atMs / 1000).toFixed(3);
  const proc = Bun.spawn(
    [
      "ffmpeg",
      "-y",
      "-ss", atSec,
      "-i", path,
      "-frames:v", "1",
      "-vf", "scale=320:-1",
      outPath,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const errText = await new Response(proc.stderr).text();
    throw new Error(`ffmpeg thumbnail failed: ${errText}`);
  }
}

export async function extractFrames(
  path: string,
  startMs: number,
  endMs: number,
  count: number = 4,
): Promise<Buffer[]> {
  const durationSec = (endMs - startMs) / 1000;
  const interval = count > 1 ? durationSec / (count - 1) : 0;
  const startSec = (startMs / 1000).toFixed(3);

  const filters =
    count > 1
      ? `fps=1/${interval.toFixed(3)},scale=512:-1`
      : "scale=512:-1,select=eq(n\\,0)";

  const proc = Bun.spawn(
    [
      "ffmpeg",
      "-ss", startSec,
      "-t", durationSec.toFixed(3),
      "-i", path,
      "-vf", filters,
      "-frames:v", String(count),
      "-f", "image2pipe",
      "-vcodec", "png",
      "pipe:1",
    ],
    { stdout: "pipe", stderr: "pipe" },
  );

  const raw = await new Response(proc.stdout).arrayBuffer();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const errText = await new Response(proc.stderr).text();
    throw new Error(`ffmpeg extractFrames failed: ${errText}`);
  }

  const buf = Buffer.from(raw);
  const frames: Buffer[] = [];
  const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const IEND = Buffer.from([0x49, 0x45, 0x4e, 0x44]);

  let offset = 0;
  while (offset < buf.length) {
    const start = buf.indexOf(PNG_HEADER, offset);
    if (start === -1) break;
    const iend = buf.indexOf(IEND, start + 8);
    if (iend === -1) break;
    const end = iend + IEND.length + 4;
    frames.push(buf.subarray(start, end));
    offset = end;
  }

  return frames;
}

export async function extractSingleFrame(path: string, atMs: number): Promise<Buffer> {
  const atSec = (atMs / 1000).toFixed(3);
  const proc = Bun.spawn(
    [
      "ffmpeg",
      "-ss", atSec,
      "-i", path,
      "-frames:v", "1",
      "-f", "image2pipe",
      "-vcodec", "png",
      "pipe:1",
    ],
    { stdout: "pipe", stderr: "pipe" },
  );

  const raw = await new Response(proc.stdout).arrayBuffer();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const errText = await new Response(proc.stderr).text();
    throw new Error(`ffmpeg extractSingleFrame failed: ${errText}`);
  }

  return Buffer.from(raw);
}

export async function exportVideo(
  inputPaths: string[],
  outPath: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  if (inputPaths.length === 0) {
    throw new Error("No input files to export");
  }

  const args: string[] = ["ffmpeg", "-y"];
  for (const p of inputPaths) {
    args.push("-i", p);
  }
  args.push("-c:v", "libx264", "-preset", "fast", "-crf", "23", outPath);

  const proc = Bun.spawn(args, {
    stdout: "pipe",
    stderr: "pipe",
  });

  const errText = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`ffmpeg export failed: ${errText}`);
  }

  onProgress?.(100);
}
