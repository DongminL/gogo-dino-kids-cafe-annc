import type { AnnouncementDef } from "@/features/announcement/types/announcement";
import type { Category } from "@/features/announcement/types/category";

export const STORAGE_KEY = "annc-schedules";

export const CATEGORY_LABELS: Record<Category, string> = {
  attraction: "어트랙션 운영",
  closing: "마감 안내 방송",
  etiquette: "이용 에티켓 방송",
};
export const TIME_RANGE_STORAGE_KEY = "annc-time-range";

export const ANNOUNCEMENT_DEFS: AnnouncementDef[] = [
  {
    id: "dance-trampoline",
    title: "댄스트램폴린",
    category: "attraction",
    audioFile: "announcements/dance-trampoline.mp3",
    defaultSchedule: { type: "even-hour", time: "00:59", intervalMinutes: 30, enabled: true },
  },
  {
    id: "zip-line",
    title: "짚라인",
    category: "attraction",
    audioFile: "announcements/zip-line.mp3",
    defaultSchedule: { type: "odd-hour", time: "00:59", intervalMinutes: 30, enabled: true },
  },
  {
    id: "photo-time",
    title: "포토타임",
    category: "attraction",
    audioFile: "announcements/photo-time.mp3",
    defaultSchedule: { type: "once", time: "00:00", intervalMinutes: 30, enabled: false },
  },
  {
    id: "meal-order",
    title: "식사주문 마감",
    category: "closing",
    audioFile: "announcements/meal-order.mp3",
    defaultSchedule: { type: "once", time: "18:15", intervalMinutes: 30, enabled: true },
  },
  {
    id: "cafe-order",
    title: "카페음료 마감",
    category: "closing",
    audioFile: "announcements/cafe-order.mp3",
    defaultSchedule: { type: "once", time: "18:50", intervalMinutes: 30, enabled: true },
  },
  {
    id: "waterplay-close",
    title: "워터플레이존 마감",
    category: "closing",
    audioFile: "announcements/waterplay-close.mp3",
    defaultSchedule: { type: "once", time: "19:10", intervalMinutes: 30, enabled: true },
  },
  {
    id: "exit",
    title: "퇴장",
    category: "closing",
    audioFile: "announcements/exit.mp3",
    defaultSchedule: { type: "once", time: "19:50", intervalMinutes: 30, enabled: true },
  },
  {
    id: "return-dishes",
    title: "식기 반납",
    category: "closing",
    audioFile: "announcements/return-dishes.mp3",
    defaultSchedule: { type: "once", time: "19:20", intervalMinutes: 30, enabled: false },
  },
  {
    id: "room-ab",
    title: "룸 A, B 마감",
    category: "closing",
    audioFile: "announcements/room-ab.mp3",
    defaultSchedule: { type: "once", time: "16:45", intervalMinutes: 30, enabled: false },
  },
  {
    id: "table-yield",
    title: "식사 테이블 양보",
    category: "etiquette",
    audioFile: "announcements/table-yield.mp3",
    defaultSchedule: { type: "once", time: "00:00", intervalMinutes: 30, enabled: false },
  },
  {
    id: "socks",
    title: "양말 착용",
    category: "etiquette",
    audioFile: "announcements/socks.mp3",
    defaultSchedule: { type: "once", time: "00:00", intervalMinutes: 43, enabled: false },
  },
];

export const ANNOUNCEMENTS_BY_CATEGORY = (
  Object.keys(CATEGORY_LABELS) as Category[]
).reduce<Record<Category, AnnouncementDef[]>>(
  (acc, cat) => ({ ...acc, [cat]: ANNOUNCEMENT_DEFS.filter((a) => a.category === cat) }),
  {} as Record<Category, AnnouncementDef[]>
);
