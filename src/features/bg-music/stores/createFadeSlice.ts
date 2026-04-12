const FADE_DURATION_MS = 1500;
const FADE_STEPS = 30;

type FadeCtx = {
  audioRef: { current: HTMLAudioElement | null };
  volumeRef: { current: number };
  isFadedRef: { current: boolean };
  fadeTimerRef: { current: ReturnType<typeof setInterval> | null };
};

export interface FadeSlice {
  fadeOut: () => void;
  fadeIn: () => void;
  clearFadeTimer: () => void;
}

export function createFadeSlice(ctx: FadeCtx): FadeSlice {
  const clearFadeTimer = () => {
    if (ctx.fadeTimerRef.current !== null) {
      clearInterval(ctx.fadeTimerRef.current);
      ctx.fadeTimerRef.current = null;
    }
  };

  return {
    clearFadeTimer,

    fadeOut: () => {
      if (ctx.isFadedRef.current) return;
      ctx.isFadedRef.current = true;
      if (!ctx.audioRef.current) return;
      clearFadeTimer();
      const audio = ctx.audioRef.current;
      const delta = audio.volume / FADE_STEPS;
      const stepTime = FADE_DURATION_MS / FADE_STEPS;
      ctx.fadeTimerRef.current = setInterval(() => {
        if (!audio || audio !== ctx.audioRef.current) { clearFadeTimer(); return; }
        const newVol = Math.max(0, audio.volume - delta);
        audio.volume = newVol;
        if (newVol <= 0) clearFadeTimer();
      }, stepTime);
    },

    fadeIn: () => {
      if (!ctx.isFadedRef.current) return;
      ctx.isFadedRef.current = false;
      if (!ctx.audioRef.current) return;
      clearFadeTimer();
      const audio = ctx.audioRef.current;
      const targetVol = ctx.volumeRef.current;
      const delta = targetVol / FADE_STEPS;
      const stepTime = FADE_DURATION_MS / FADE_STEPS;
      ctx.fadeTimerRef.current = setInterval(() => {
        if (!audio || audio !== ctx.audioRef.current) { clearFadeTimer(); return; }
        const newVol = Math.min(targetVol, audio.volume + delta);
        audio.volume = newVol;
        if (newVol >= targetVol) clearFadeTimer();
      }, stepTime);
    },
  };
}
