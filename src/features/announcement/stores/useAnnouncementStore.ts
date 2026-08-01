import { create } from "zustand";
import type { Schedule, AnnouncementTimeRangeSettings, DayType } from "@/features/announcement/types/schedule";
import type { AnnouncementDef, CustomAnnouncement } from "@/features/announcement/types/announcement";
import type { Category } from "@/features/announcement/types/category";
import { STORAGE_KEY, TIME_RANGE_STORAGE_KEY, CUSTOM_STORAGE_KEY } from "@/features/announcement/announcements";
import { loadSettings, loadTimeRangeSettings } from "@/utils";
import { getTtsAudioUrl, deleteTtsCache } from "@/features/announcement/ttsCache";

const DEFAULT_CUSTOM_SCHEDULE: Schedule = { type: "once", time: "00:00", intervalMinutes: 30, enabled: false };

function loadCustomList(): CustomAnnouncement[] {
  try {
    const saved = localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore parse errors — return empty */ }
  return [];
}

function saveCustomList(list: CustomAnnouncement[]): void {
  localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(list));
}

function toDef(c: CustomAnnouncement, audioFile: string): AnnouncementDef {
  return {
    id: c.id,
    title: c.title,
    category: c.category,
    audioFile,
    defaultSchedule: DEFAULT_CUSTOM_SCHEDULE,
    isCustom: true,
  };
}

interface AnnouncementStore {
  schedules: Record<string, Schedule>;
  openSettingsId: string | null;
  timeRangeSettings: AnnouncementTimeRangeSettings;
  dayTypeOverride: DayType | null;
  showTimeRangeSettings: boolean;
  customDefs: AnnouncementDef[];
  updateSchedule: (id: string, update: Partial<Schedule>) => void;
  removeSchedule: (id: string) => void;
  toggleSettings: (id: string) => void;
  setTimeRangeSettings: (s: AnnouncementTimeRangeSettings) => void;
  setDayTypeOverride: (t: DayType | null) => void;
  setShowTimeRangeSettings: (v: boolean) => void;
  initCustom: () => Promise<void>;
  addCustom: (title: string, category: Category, text: string) => Promise<void>;
  removeCustom: (id: string) => Promise<void>;
}

export const useAnnouncementStore = create<AnnouncementStore>((set, get) => ({
  schedules: loadSettings(),
  openSettingsId: null,
  timeRangeSettings: loadTimeRangeSettings(),
  dayTypeOverride: null,
  showTimeRangeSettings: false,
  customDefs: [],

  updateSchedule: (id, update) =>
    set((state) => {
      const newSchedules = { ...state.schedules, [id]: { ...state.schedules[id], ...update } };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSchedules));
      return { schedules: newSchedules };
    }),

  removeSchedule: (id) =>
    set((state) => {
      const { [id]: _removed, ...newSchedules } = state.schedules;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSchedules));
      return { schedules: newSchedules };
    }),

  toggleSettings: (id) =>
    set((state) => ({ openSettingsId: state.openSettingsId === id ? null : id })),

  setTimeRangeSettings: (s) => {
    localStorage.setItem(TIME_RANGE_STORAGE_KEY, JSON.stringify(s));
    set({ timeRangeSettings: s });
  },

  setDayTypeOverride: (t) => set({ dayTypeOverride: t }),

  setShowTimeRangeSettings: (v) => set({ showTimeRangeSettings: v }),

  initCustom: async () => {
    const list = loadCustomList();
    const defs = await Promise.all(
      list.map(async (c) => {
        try {
          const audioFile = await getTtsAudioUrl(c.text);
          return toDef(c, audioFile);
        } catch {
          // 음성 생성 실패 — 목록엔 남기되 재생은 비활성화
          return toDef(c, "");
        }
      })
    );
    set({ customDefs: defs });
  },

  addCustom: async (title, category, text) => {
    const audioFile = await getTtsAudioUrl(text);
    const id = `custom-${Date.now()}`;
    const custom: CustomAnnouncement = { id, title, category, text };
    saveCustomList([...loadCustomList(), custom]);
    set((state) => ({ customDefs: [...state.customDefs, toDef(custom, audioFile)] }));
    get().updateSchedule(id, DEFAULT_CUSTOM_SCHEDULE);
  },

  removeCustom: async (id) => {
    const list = loadCustomList();
    const target = list.find((c) => c.id === id);
    saveCustomList(list.filter((c) => c.id !== id));

    set((state) => {
      const def = state.customDefs.find((d) => d.id === id);
      if (def?.audioFile) URL.revokeObjectURL(def.audioFile);
      return { customDefs: state.customDefs.filter((d) => d.id !== id) };
    });
    get().removeSchedule(id);

    // 같은 텍스트를 쓰는 다른 커스텀 방송이 없을 때만 캐시 삭제
    const stillUsed = target && list.some((c) => c.id !== id && c.text === target.text);
    if (target && !stillUsed) await deleteTtsCache(target.text);
  },
}));
