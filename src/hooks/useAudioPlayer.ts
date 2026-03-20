import { useState, useRef, useCallback, useEffect } from "react";
import type { AnnouncementDef } from "../types/announcement";

interface AudioProgress {
  current: number;
  duration: number;
}

interface AudioPlayerReturn {
  playingId: string | null;
  progress: AudioProgress;
  volume: number;
  play: (ann: AnnouncementDef) => void;
  stop: () => void;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
}

export function useAudioPlayer(): AudioPlayerReturn {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<AudioProgress>({ current: 0, duration: 0 });
  const [volume, setVolume] = useState(1.0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const volumeRef = useRef(1.0);

  useEffect(() => {
    volumeRef.current = volume;
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.ontimeupdate = null;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    cleanupAudio();
    setPlayingId(null);
    setProgress({ current: 0, duration: 0 });
  }, [cleanupAudio]);

  const play = useCallback(
    (ann: AnnouncementDef) => {
      cleanupAudio();
      const audio = new Audio(ann.audioFile);
      audio.volume = volumeRef.current;
      audioRef.current = audio;
      setPlayingId(ann.id);
      setProgress({ current: 0, duration: 0 });

      audio.ontimeupdate = () => {
        setProgress({ current: audio.currentTime, duration: audio.duration || 0 });
      };
      audio.onended = () => {
        setPlayingId(null);
        setProgress({ current: 0, duration: 0 });
        audioRef.current = null;
      };
      audio.onerror = () => {
        setPlayingId(null);
        audioRef.current = null;
      };

      audio.play().catch(() => {
        setPlayingId(null);
        audioRef.current = null;
      });
    },
    [cleanupAudio]
  );

  const seek = useCallback((time: number) => {
    if (audioRef.current) audioRef.current.currentTime = time;
    setProgress((prev) => ({ ...prev, current: time }));
  }, []);

  return { playingId, progress, volume, play, stop, seek, setVolume };
}
