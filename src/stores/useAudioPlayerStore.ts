import { create } from "zustand";
import type { AnnouncementDef } from "@/features/announcement/types/announcement";

interface AudioProgress {
  current: number;
  duration: number;
}

interface AudioPlayerStore {
  playingId: string | null;
  progress: AudioProgress;
  volume: number;
  play: (ann: AnnouncementDef) => void;
  stop: () => void;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
}

// Module-level mutable refs (not reactive, not serialized)
const audioRef = { current: null as HTMLAudioElement | null };
const volumeRef = { current: 1.0 };

function cleanupAudio() {
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.ontimeupdate = null;
    audioRef.current.onended = null;
    audioRef.current.onerror = null;
    audioRef.current = null;
  }
}

export const useAudioPlayerStore = create<AudioPlayerStore>((set) => ({
  playingId: null,
  progress: { current: 0, duration: 0 },
  volume: 1.0,

  play: (ann) => {
    cleanupAudio();
    const audio = new Audio(ann.audioFile);
    audio.volume = volumeRef.current;
    audioRef.current = audio;
    set({ playingId: ann.id, progress: { current: 0, duration: 0 } });

    audio.ontimeupdate = () => {
      set({ progress: { current: audio.currentTime, duration: audio.duration || 0 } });
    };
    audio.onended = () => {
      set({ playingId: null, progress: { current: 0, duration: 0 } });
      audioRef.current = null;
    };
    audio.onerror = () => {
      set({ playingId: null });
      audioRef.current = null;
    };

    audio.play().catch(() => {
      set({ playingId: null });
      audioRef.current = null;
    });
  },

  stop: () => {
    cleanupAudio();
    set({ playingId: null, progress: { current: 0, duration: 0 } });
  },

  seek: (time) => {
    if (audioRef.current) audioRef.current.currentTime = time;
    set((state) => ({ progress: { ...state.progress, current: time } }));
  },

  setVolume: (v) => {
    volumeRef.current = v;
    if (audioRef.current) audioRef.current.volume = v;
    set({ volume: v });
  },
}));

export function resetAudioPlayerStore() {
  cleanupAudio();
  volumeRef.current = 1.0;
  useAudioPlayerStore.setState({ playingId: null, progress: { current: 0, duration: 0 }, volume: 1.0 });
}
