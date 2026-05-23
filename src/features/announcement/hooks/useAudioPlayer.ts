import { useAudioPlayerStore } from "@/features/announcement/stores/useAudioPlayerStore";

export function useAudioPlayer() {
  const { playingId, progress, volume, play, stop, seek, setVolume } = useAudioPlayerStore();
  return { playingId, progress, volume, play, stop, seek, setVolume };
}
