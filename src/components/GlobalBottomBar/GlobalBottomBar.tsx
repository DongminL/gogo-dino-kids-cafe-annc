import React, { useState, useRef, useEffect } from "react";
import "./GlobalBottomBar.scss";
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
    <div className="global-bottom-bar">
      <div className="player-info">
        <div
          className={`track-name-wrapper ${isOverflowing ? "is-overflowing" : ""} ${shouldAnimate ? "should-animate" : ""}`}
          ref={containerRef}
          title={currentTrack?.name}
        >
          <div className="track-name" ref={textRef}>
            {currentTrack ? currentTrack.name : "재생 중인 배경 음악이 없습니다"}
          </div>
        </div>
        {onNavigateToPlayingPlaylist && (
          <button
            className="go-to-playlist-btn"
            onClick={onNavigateToPlayingPlaylist}
            title="재생 중인 플레이리스트로 이동"
          >
            <ListMusic size={16} />
          </button>
        )}
      </div>

      <div className="player-controls">
        <div className="progress-bar-container">
          <span className="time-text">{formatDuration(progress.current)}</span>
          <div className="seek-bar-wrapper">
            <div className="seek-bar-rail" />
            <div
              className="seek-bar-fill"
              style={{ width: `${progress.duration ? (progress.current / progress.duration) * 100 : 0}%` }}
            />
            <input
              type="range"
              className="seek-bar"
              min={0}
              max={progress.duration || 0}
              step={0.5}
              value={progress.current}
              disabled={!progress.duration}
              onChange={(e) => onSeek(Number(e.target.value))}
            />
          </div>
          <span className="time-text">-{formatDuration(Math.max(0, progress.duration - progress.current))}</span>
        </div>

        <div className="buttons">
          <button
            className={`secondary-btn ${autoplay ? "active" : ""}`}
            onClick={onToggleAutoplay}
            title="자동 재생"
          >
            <Zap size={16} fill={autoplay ? "currentColor" : "none"} />
          </button>

          <button className="transport-btn" onClick={onPrev} title="이전 곡" disabled={!currentTrack}>
            <SkipBack size={20} fill="currentColor" />
          </button>

          <button className="play-btn" onClick={onTogglePlay} title={isPlaying ? "일시정지" : "재생"} disabled={!currentTrack}>
            {isPlaying ? (
              <Pause size={24} fill="currentColor" />
            ) : (
              <Play size={24} fill="currentColor" style={{ marginLeft: "2px" }} />
            )}
          </button>

          <button className="transport-btn" onClick={onNext} title="다음 곡" disabled={!currentTrack}>
            <SkipForward size={20} fill="currentColor" />
          </button>

          <button
            className={`secondary-btn ${loop ? "active" : ""}`}
            onClick={onToggleLoop}
            title="반복 재생"
          >
            <Repeat size={18} strokeWidth={loop ? 3 : 2} />
          </button>
        </div>
      </div>

      <div className="volume-controls">
        <div className="volume-group" title="안내 방송 볼륨">
          <div className="icon-badge annc">
            <Megaphone size={14} />
          </div>
          <div className="slider-container">
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
          <span className="volume-val">{Math.round(anncVolume * 100)}</span>
        </div>

        <div className="volume-group" title="배경 음악 볼륨">
          <div className="icon-badge bgm">
            <Music size={14} />
          </div>
          <div className="slider-container">
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
          <span className="volume-val">{Math.round(bgmVolume * 100)}</span>
        </div>
      </div>
    </div>
  );
}
