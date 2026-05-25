import { useRef, useCallback } from "react";

const FADE_DURATION_MS = 1500;
const FADE_STEPS = 30;

export function useBgMusicFade(
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  volumeRef: React.MutableRefObject<number>,
  isFadedRef: React.MutableRefObject<boolean>
) {
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearFadeTimer = useCallback(() => {
    if (fadeTimerRef.current !== null) {
      clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const fadeOut = useCallback(() => {
    if (isFadedRef.current) return;
    isFadedRef.current = true;
    if (!audioRef.current) return;
    clearFadeTimer();
    const audio = audioRef.current;
    const startVol = audio.volume;
    const delta = startVol / FADE_STEPS;
    const stepTime = FADE_DURATION_MS / FADE_STEPS;
    fadeTimerRef.current = setInterval(() => {
      if (!audio || audio !== audioRef.current) {
        clearFadeTimer();
        return;
      }
      const newVol = Math.max(0, audio.volume - delta);
      audio.volume = newVol;
      if (newVol <= 0) clearFadeTimer();
    }, stepTime);
  }, [audioRef, clearFadeTimer]);

  const fadeIn = useCallback(() => {
    if (!isFadedRef.current) return;
    isFadedRef.current = false;
    if (!audioRef.current) return;
    clearFadeTimer();
    const audio = audioRef.current;
    const targetVol = volumeRef.current;
    const delta = targetVol / FADE_STEPS;
    const stepTime = FADE_DURATION_MS / FADE_STEPS;
    fadeTimerRef.current = setInterval(() => {
      if (!audio || audio !== audioRef.current) {
        clearFadeTimer();
        return;
      }
      const newVol = Math.min(targetVol, audio.volume + delta);
      audio.volume = newVol;
      if (newVol >= targetVol) clearFadeTimer();
    }, stepTime);
  }, [audioRef, volumeRef, clearFadeTimer]);

  return { clearFadeTimer, fadeOut, fadeIn };
}
