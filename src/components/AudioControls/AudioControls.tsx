import React from "react";
import styles from "@/components/AudioControls/AudioControls.module.scss";
import { formatDuration } from "@/utils";

interface AudioControlsProps {
  current: number;
  duration: number;
  onSeek: (time: number) => void;
}

export function AudioControls(
  { current, duration, onSeek }: AudioControlsProps
): React.ReactNode {
  return (
    <div className={styles.audioControls}>
      <input
        type="range"
        className={styles.seekBar}
        min={0}
        max={duration || 0}
        step={0.1}
        value={current}
        onChange={(e) => onSeek(Number(e.target.value))}
      />
      <div className={styles.timeDisplay}>
        <span>{formatDuration(current)}</span>
        <span>{formatDuration(duration)}</span>
      </div>
    </div>
  );
}
