import React, { useState, useRef, useEffect } from "react";
import clsx from "clsx";
import styles from "./GlobalBottomBar.module.scss";
import {
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Repeat,
  Zap,
  Music,
  Megaphone,
  ListMusic
} from "lucide-react";
import type { Track } from "@/features/bg-music/types/bgMusic";
import { formatDuration } from "../../utils";

interface GlobalBottomBarProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: { current: number; duration: number };
  anncVolume: number;
  bgmVolume: number;
  autoplay: boolean;
  loop: boolean;
  onPrev: () => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onSetAnncVolume: (v: number) => void;
  onSetBgmVolume: (v: number) => void;
  onToggleAutoplay: () => void;
  onToggleLoop: () => void;
  onNavigateToPlayingPlaylist?: () => void;
}

export function GlobalBottomBar({
  currentTrack,
  isPlaying,
  progress,
  anncVolume,
  bgmVolume,
  autoplay,
  loop,
  onPrev,
  onTogglePlay,
  onNext,
  onSeek,
  onSetAnncVolume,
  onSetBgmVolume,
  onToggleAutoplay,
  onToggleLoop,
  onNavigateToPlayingPlaylist,
}: GlobalBottomBarProps) {
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
        animationTimerRef.current = null;
      }
    };

    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        // Force width reset for accurate measurement
        const container = containerRef.current;
        const text = textRef.current;

        const overflowing = text.scrollWidth > container.clientWidth;
        setIsOverflowing(overflowing);

        if (overflowing) {
          const scrollDist = text.scrollWidth - container.clientWidth;
          container.style.setProperty("--scroll-dist", `-${scrollDist}px`);

          // Delay marquee start by 2.5 seconds
          animationTimerRef.current = setTimeout(() => {
            setShouldAnimate(true);
          }, 2500);
        } else {
          setShouldAnimate(false);
        }
      }
    };

    // Reset states on track change
    setShouldAnimate(false);
    setIsOverflowing(false);
    clearTimers();

    // Check overflow after a short delay for DOM rendering
    const checkTimer = setTimeout(checkOverflow, 200);

    window.addEventListener("resize", checkOverflow);
    return () => {
      clearTimeout(checkTimer);
      clearTimers();
      window.removeEventListener("resize", checkOverflow);
    };
  }, [currentTrack]);

  return (
    <div className={styles.globalBottomBar}>
      <div className={styles.playerInfo}>
        <div
          className={clsx(
            styles.trackNameWrapper,
            isOverflowing && styles.isOverflowing,
            shouldAnimate && styles.shouldAnimate
          )}
          ref={containerRef}
          title={currentTrack?.name}
        >
          <div className={styles.trackName} ref={textRef}>
            {currentTrack ? currentTrack.name : "재생 중인 배경 음악이 없습니다"}
          </div>
        </div>
        {onNavigateToPlayingPlaylist && (
          <button
            className={styles.goToPlaylistBtn}
            onClick={onNavigateToPlayingPlaylist}
            title="재생 중인 플레이리스트로 이동"
          >
            <ListMusic size={16} />
          </button>
        )}
      </div>

      <div className={styles.playerControls}>
        <div className={styles.progressBarContainer}>
          <span className={styles.timeText}>{formatDuration(progress.current)}</span>
          <div className={styles.seekBarWrapper}>
            <div className={styles.seekBarRail} />
            <div
              className={styles.seekBarFill}
              style={{ width: `${progress.duration ? (progress.current / progress.duration) * 100 : 0}%` }}
            />
            <input
              type="range"
              className={styles.seekBar}
              min={0}
              max={progress.duration || 0}
              step={0.5}
              value={progress.current}
              disabled={!progress.duration}
              onChange={(e) => onSeek(Number(e.target.value))}
            />
          </div>
          <span className={styles.timeText}>-{formatDuration(Math.max(0, progress.duration - progress.current))}</span>
        </div>

        <div className={styles.buttons}>
          <button
            className={clsx(styles.secondaryBtn, autoplay && styles.active)}
            onClick={onToggleAutoplay}
            title="자동 재생"
          >
            <Zap size={16} fill={autoplay ? "currentColor" : "none"} />
          </button>

          <button className={styles.transportBtn} onClick={onPrev} title="이전 곡" disabled={!currentTrack}>
            <SkipBack size={20} fill="currentColor" />
          </button>

          <button className={styles.playBtn} onClick={onTogglePlay} title={isPlaying ? "일시정지" : "재생"} disabled={!currentTrack}>
            {isPlaying ? (
              <Pause size={24} fill="currentColor" />
            ) : (
              <Play size={24} fill="currentColor" style={{ marginLeft: "2px" }} />
            )}
          </button>

          <button className={styles.transportBtn} onClick={onNext} title="다음 곡" disabled={!currentTrack}>
            <SkipForward size={20} fill="currentColor" />
          </button>

          <button
            className={clsx(styles.secondaryBtn, loop && styles.active)}
            onClick={onToggleLoop}
            title="반복 재생"
          >
            <Repeat size={18} strokeWidth={loop ? 3 : 2} />
          </button>
        </div>
      </div>

      <div className={styles.volumeControls}>
        <div className={styles.volumeGroup} title="안내 방송 볼륨">
          <div className={clsx(styles.iconBadge, styles.annc)}>
            <Megaphone size={14} />
          </div>
          <div className={styles.sliderContainer}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={anncVolume}
              style={{ "--progress": `${anncVolume * 100}%` } as React.CSSProperties}
              onChange={(e) => onSetAnncVolume(Number(e.target.value))}
            />
          </div>
          <span className={styles.volumeVal}>{Math.round(anncVolume * 100)}</span>
        </div>

        <div className={styles.volumeGroup} title="배경 음악 볼륨">
          <div className={clsx(styles.iconBadge, styles.bgm)}>
            <Music size={14} />
          </div>
          <div className={styles.sliderContainer}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={bgmVolume}
              style={{ "--progress": `${bgmVolume * 100}%` } as React.CSSProperties}
              onChange={(e) => onSetBgmVolume(Number(e.target.value))}
            />
          </div>
          <span className={styles.volumeVal}>{Math.round(bgmVolume * 100)}</span>
        </div>
      </div>
    </div>
  );
}
