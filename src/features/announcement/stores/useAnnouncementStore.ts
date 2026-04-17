import { create } from "zustand";
import type { Schedule, AnnouncementTimeRangeSettings, DayType } from "@/features/announcement/types/schedule";
import { STORAGE_KEY, TIME_RANGE_STORAGE_KEY } from "@/features/announcement/announcements";
import { loadSettings, loadTimeRangeSettings } from "@/utils";

interface AnnouncementStore {
  schedules: Record<string, Schedule>;
  openSettingsId: string | null;
  timeRangeSettings: AnnouncementTimeRangeSettings;
  dayTypeOverride: DayType | null;
  showTimeRangeSettings: boolean;
  updateSchedule: (id: string, update: Partial<Schedule>) => void;
  toggleSettings: (id: string) => void;
  setTimeRangeSettings: (s: AnnouncementTimeRangeSettings) => void;
  setDayTypeOverride: (t: DayType | null) => void;
  setShowTimeRangeSettings: (v: boolean) => void;
}

export const useAnnouncementStore = create<AnnouncementStore>((set) => ({
  schedules: loadSettings(),
  openSettingsId: null,
  timeRangeSettings: loadTimeRangeSettings(),
  dayTypeOverride: null,
  showTimeRangeSettings: false,

  updateSchedule: (id, update) =>
    set((state) => {
      const newSchedules = { ...state.schedules, [id]: { ...state.schedules[id], ...update } };
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
}));
