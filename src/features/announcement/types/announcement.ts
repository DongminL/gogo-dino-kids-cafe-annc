import type { Schedule } from "@/features/announcement/types/schedule";
import type { Category } from "@/features/announcement/types/category";

export interface AnnouncementDef {
  id: string;
  title: string;
  category: Category;
  audioFile: string;
  defaultSchedule: Schedule;
  isCustom?: boolean;
}

// 커스텀 방송인데 TTS 음성 생성에 실패해 재생할 오디오가 없는 상태
export function isBrokenCustom(def: AnnouncementDef): boolean {
  return !!def.isCustom && !def.audioFile;
}

// localStorage에 저장되는 커스텀(TTS) 방송 원본 — audioFile(object URL)은 세션마다
// 재생성되므로 여기엔 저장하지 않는다.
export interface CustomAnnouncement {
  id: string;
  title: string;
  category: Category;
  text: string;
}
