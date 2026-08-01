// Azure Cognitive Services 음성 합성(TTS) 호출. main 프로세스 전용 —
// 렌더러에서 직접 fetch하면 키가 devtools에 노출되고 CORS에 걸린다.

export const TTS_VOICE = "ko-KR-SunHiNeural";

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Azure 리전은 "koreacentral" 같은 소문자 영숫자+하이픈 — URL 조립에 그대로 들어가므로 검증 필수
export function isValidRegion(region: string): boolean {
  return /^[a-z0-9-]{1,32}$/.test(region);
}

export function buildSsml(text: string, voice: string = TTS_VOICE): string {
  return `<speak version="1.0" xml:lang="ko-KR"><voice name="${voice}">${escapeXml(text)}</voice></speak>`;
}

export interface SynthesizeParams {
  key: string;
  region: string;
  text: string;
  voice?: string;
}

export async function synthesize({ key, region, text, voice }: SynthesizeParams): Promise<Buffer> {
  if (!isValidRegion(region)) {
    throw new Error("잘못된 Azure 리전입니다.");
  }

  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
    },
    body: buildSsml(text, voice),
  });

  if (!res.ok) {
    throw new Error(`Azure TTS 요청 실패 (${res.status})`);
  }

  return Buffer.from(await res.arrayBuffer());
}
