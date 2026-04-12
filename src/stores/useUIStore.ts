import { create } from "zustand";

interface UIStore {
  activeTab: string;
  showSupportModal: "guide" | "feedback" | null;
  setActiveTab: (tab: string) => void;
  setShowSupportModal: (type: "guide" | "feedback" | null) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activeTab: "all-announcements",
  showSupportModal: null,
  setActiveTab: (tab) => set({ activeTab: tab }),
  setShowSupportModal: (type) => set({ showSupportModal: type }),
}));
