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
  enqueue: (ann: AnnouncementDef, priority?: number) => void;
  stop: () => void;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
}

interface QueueItem {
  ann: AnnouncementDef;
  priority: number; // 낮을수록 먼저 재생
}

// Module-level mutable refs (not reactive, not serialized)
const audioRef = { current: null as HTMLAudioElement | null };
const volumeRef = { current: 1.0 };
const queueRef = { current: [] as QueueItem[] };
const playGenerationRef = { current: 0 };

function cleanupAudio() {
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.ontimeupdate = null;
    audioRef.current.onended = null;
    audioRef.current.onerror = null;
    audioRef.current = null;
  }
}

export const useAudioPlayerStore = create<AudioPlayerStore>((set) => {
  function playAudio(ann: AnnouncementDef) {
    cleanupAudio();
    const generation = ++playGenerationRef.current;
    const audio = new Audio(ann.audioFile);
    audio.volume = volumeRef.current;
    audioRef.current = audio;
    set({ playingId: ann.id, progress: { current: 0, duration: 0 } });

    const handleEnd = () => {
      audioRef.current = null;
      if (queueRef.current.length > 0) {
        const next = queueRef.current.shift()!;
        playAudio(next.ann);
      } else {
        set({ playingId: null, progress: { current: 0, duration: 0 } });
      }
    };

    audio.ontimeupdate = () =>
      set({ progress: { current: audio.currentTime, duration: audio.duration || 0 } });
    audio.onended = handleEnd;
    audio.onerror = handleEnd;

    audio.play().catch(() => {
      if (playGenerationRef.current === generation) {
        handleEnd();
      }
    });
  }

  return {
    playingId: null,
    progress: { current: 0, duration: 0 },
    volume: 1.0,

    play: (ann) => {
      queueRef.current = [];
      playAudio(ann);
    },

    enqueue: (ann, priority = 1) => {
      if (audioRef.current === null) {
        playAudio(ann);
      } else {
        const item: QueueItem = { ann, priority };
        const idx = queueRef.current.findIndex((q) => q.priority > item.priority);
        if (idx === -1) {
          queueRef.current.push(item);
        } else {
          queueRef.current.splice(idx, 0, item);
        }
      }
    },

    stop: () => {
      queueRef.current = [];
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
  };
});

export function resetAudioPlayerStore() {
  cleanupAudio();
  queueRef.current = [];
  playGenerationRef.current = 0;
  volumeRef.current = 1.0;
  useAudioPlayerStore.setState({ playingId: null, progress: { current: 0, duration: 0 }, volume: 1.0 });
}
