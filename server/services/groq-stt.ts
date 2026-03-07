import type { CaptionWord } from "../../shared/types.ts";

const GROQ_API_URL = "https://api.groq.com/openai/v1/audio/transcriptions";

interface GroqWord {
  word: string;
  start: number;
  end: number;
}

interface GroqResponse {
  text: string;
  words?: GroqWord[];
}

export interface TranscriptResult {
  transcript: string;
  words: CaptionWord[];
}

export async function transcribe(audioBuffer: Buffer, language = "en"): Promise<TranscriptResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");

  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(audioBuffer)], { type: "audio/wav" }), "audio.wav");
  formData.append("model", "whisper-large-v3-turbo");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "word");
  formData.append("language", language);

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq STT failed (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as GroqResponse;

  const words: CaptionWord[] = (data.words ?? []).map((w) => ({
    text: w.word.trim(),
    fromMs: Math.round(w.start * 1000),
    toMs: Math.round(w.end * 1000),
  }));

  return {
    transcript: data.text ?? "",
    words,
  };
}
