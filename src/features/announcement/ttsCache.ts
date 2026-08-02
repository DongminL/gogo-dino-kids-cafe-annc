import { getTrackBlob, saveTrackBlob, deleteTrackBlob } from "@/db/trackStorage";

// 커스텀 방송의 음성(voice)은 고정 — 바꾸고 싶어지면 그때 파라미터로 노출.
// voice를 캐시 키에 포함해두면 나중에 voice가 늘어나도 캐시가 안전하게 분리된다.
export const TTS_VOICE = "ko-KR-SunHiNeural";

function cacheKey(text: string): string {
  return `tts:${TTS_VOICE}:${text}`;
}

// 같은 텍스트면 IndexedDB 캐시를 재생하고, Azure API를 다시 호출하지 않는다.
export async function getTtsAudioUrl(text: string): Promise<string> {
  const key = cacheKey(text);
  let blob = await getTrackBlob(key);
  if (!blob) {
    if (!window.electronAPI) throw new Error("Electron 환경에서만 사용할 수 있습니다.");
    const bytes = await window.electronAPI.synthesizeTts(text);
    blob = new Blob([bytes as BlobPart], { type: "audio/mpeg" });
    await saveTrackBlob(key, blob);
  }
  return URL.createObjectURL(blob);
}

export function deleteTtsCache(text: string): Promise<void> {
  return deleteTrackBlob(cacheKey(text));
}
