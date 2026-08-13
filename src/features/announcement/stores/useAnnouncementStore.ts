import { create } from "zustand";
import type { Schedule, AnnouncementTimeRangeSettings, DayType } from "@/features/announcement/types/schedule";
import type { AnnouncementDef, CustomAnnouncement } from "@/features/announcement/types/announcement";
import type { Category } from "@/features/announcement/types/category";
import { STORAGE_KEY, TIME_RANGE_STORAGE_KEY, CUSTOM_STORAGE_KEY } from "@/features/announcement/announcements";
import { loadSettings, loadTimeRangeSettings } from "@/utils";
import { getTtsAudioUrl, deleteTtsCache } from "@/features/announcement/ttsCache";
import { useAudioPlayerStore } from "@/features/announcement/stores/useAudioPlayerStore";

const DEFAULT_CUSTOM_SCHEDULE: Schedule = { type: "once", time: "00:00", intervalMinutes: 30, enabled: false };

let initCustomPromise: Promise<void> | null = null;

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
    text: c.text,
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
  updateCustom: (id: string, title: string, category: Category, text: string) => Promise<void>;
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

  initCustom: () => {
    // ponytail: 앱 시작 시 한 번만 실행되어야 함 — 중복 호출(StrictMode 등)이
    // 같은 로딩을 두 번 돌며 object URL을 누수하지 않도록 in-flight promise를 공유
    if (!initCustomPromise) {
      initCustomPromise = (async () => {
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
        // 로딩 중 addCustom으로 추가된 항목이 있으면 유지 — 그대로 덮어쓰지 않음
        set((state) => {
          const currentIds = new Set(state.customDefs.map((d) => d.id));
          return { customDefs: [...defs.filter((d) => !currentIds.has(d.id)), ...state.customDefs] };
        });
      })();
    }
    return initCustomPromise;
  },

  addCustom: async (title, category, text) => {
    const audioFile = await getTtsAudioUrl(text);
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const custom: CustomAnnouncement = { id, title, category, text };
    saveCustomList([...loadCustomList(), custom]);
    set((state) => ({ customDefs: [...state.customDefs, toDef(custom, audioFile)] }));
    get().updateSchedule(id, DEFAULT_CUSTOM_SCHEDULE);
  },

  updateCustom: async (id, title, category, text) => {
    const list = loadCustomList();
    const oldEntry = list.find((c) => c.id === id);
    if (!oldEntry) return;

    const updated: CustomAnnouncement = { id, title, category, text };
    const textChanged = oldEntry.text !== text;

    if (!textChanged) {
      saveCustomList(list.map((c) => (c.id === id ? updated : c)));
      set((state) => ({
        customDefs: state.customDefs.map((d) => (d.id === id ? { ...d, title, category } : d)),
      }));
      return;
    }

    if (useAudioPlayerStore.getState().playingId === id) useAudioPlayerStore.getState().stop();

    // TTS 생성 성공을 확인한 뒤에 저장 — 실패 시 localStorage와 화면 상태가 어긋나지 않도록
    const audioFile = await getTtsAudioUrl(text);
    saveCustomList(list.map((c) => (c.id === id ? updated : c)));
    set((state) => {
      const prev = state.customDefs.find((d) => d.id === id);
      if (prev?.audioFile) URL.revokeObjectURL(prev.audioFile);
      return { customDefs: state.customDefs.map((d) => (d.id === id ? toDef(updated, audioFile) : d)) };
    });

    // 같은 텍스트를 쓰는 다른 커스텀 방송이 없을 때만 이전 텍스트의 캐시 삭제
    const stillUsed = list.some((c) => c.id !== id && c.text === oldEntry.text);
    if (!stillUsed) await deleteTtsCache(oldEntry.text);
  },

  removeCustom: async (id) => {
    if (useAudioPlayerStore.getState().playingId === id) useAudioPlayerStore.getState().stop();

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
