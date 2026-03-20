import type { AnnouncementDef } from "./types/announcement";
import type { Category } from "./types/category";
import type { ScheduleType } from "./types/schedule";

export const STORAGE_KEY = "annc-schedules";

export const ANNOUNCEMENT_DEFS: AnnouncementDef[] = [
  {
    id: "dance-trampoline",
    title: "댄스트램폴린",
    category: "attraction",
    audioFile: "dance-trampoline.wav",
    defaultSchedule: { type: "odd-hour", time: "00:00", intervalMinutes: 30, enabled: true },
  },
  {
    id: "zipline",
    title: "짚라인",
    category: "attraction",
    audioFile: "zip-line.mp3",
    defaultSchedule: { type: "even-hour", time: "00:00", intervalMinutes: 30, enabled: true },
  },
  {
    id: "photo-time",
    title: "포토타임",
    category: "attraction",
    audioFile: "photo-time.wav",
    defaultSchedule: { type: "none", time: "00:00", intervalMinutes: 30, enabled: false },
  },
  {
    id: "meal-order",
    title: "식사주문 마감",
    category: "closing",
    audioFile: "meal-order.mp3",
    defaultSchedule: { type: "once", time: "18:15", intervalMinutes: 30, enabled: true },
  },
  {
    id: "cafe-order",
    title: "카페음료 마감",
    category: "closing",
    audioFile: "cafe-order.mp3",
    defaultSchedule: { type: "once", time: "18:50", intervalMinutes: 30, enabled: true },
  },
  {
    id: "waterplay-close",
    title: "워터플레이존 마감",
    category: "closing",
    audioFile: "waterplay-close.wav",
    defaultSchedule: { type: "once", time: "19:10", intervalMinutes: 30, enabled: true },
  },
  {
    id: "exit",
    title: "퇴장",
    category: "closing",
    audioFile: "exit.wav",
    defaultSchedule: { type: "once", time: "19:50", intervalMinutes: 30, enabled: true },
  },
  {
    id: "table-yield",
    title: "식사 테이블 양보",
    category: "table",
    audioFile: "table-yield.wav",
    defaultSchedule: { type: "none", time: "00:00", intervalMinutes: 30, enabled: false },
  },
];

export const CATEGORY_LABELS: Record<Category, string> = {
  attraction: "어트랙션 운영",
  closing: "마감 안내 방송",
  table: "식사 테이블 양보 방송",
};

export const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  none: "자동 재생 없음",
  once: "특정 시각 1회",
  "odd-hour": "매 홀수 시각 정각",
  "even-hour": "매 짝수 시각 정각",
  interval: "반복 간격",
};

/** 카테고리별로 그룹화된 방송 목록 (정적 데이터이므로 모듈 수준에서 미리 계산) */
export const ANNOUNCEMENTS_BY_CATEGORY = (
  Object.keys(CATEGORY_LABELS) as Category[]
).reduce<Record<Category, AnnouncementDef[]>>(
  (acc, cat) => ({ ...acc, [cat]: ANNOUNCEMENT_DEFS.filter((a) => a.category === cat) }),
  {} as Record<Category, AnnouncementDef[]>
);
