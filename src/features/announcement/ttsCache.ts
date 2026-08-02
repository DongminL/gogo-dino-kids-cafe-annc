import { getTrackBlob, saveTrackBlob, deleteTrackBlob } from "@/db/trackStorage";
import { TTS_VOICE } from "@/electron/tts";

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
