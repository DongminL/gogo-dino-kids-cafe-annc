import React from "react";
import styles from "@/components/VolumeControl/VolumeControl.module.scss";

interface VolumeControlProps {
  volume: number;
  onChange: (volume: number) => void;
}

export function VolumeControl(
  { volume, onChange }: VolumeControlProps
): React.ReactNode {
  return (
    <div className={styles.volumeControl}>
      <span className={styles.volumeLabel}>볼륨</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        onChange={(e) => onChange(Number(e.target.value))}
        className={styles.volumeSlider}
      />
      <span className={styles.volumeValue}>{Math.round(volume * 100)}%</span>
    </div>
  );
}
