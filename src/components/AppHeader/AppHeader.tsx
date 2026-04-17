import React from "react";
import styles from "@/components/AppHeader/AppHeader.module.scss";
import { VolumeControl } from "@/components/VolumeControl/VolumeControl";
import { formatTime } from "@/utils";

interface AppHeaderProps {
  currentTime: Date;
  volume: number;
  onVolumeChange: (volume: number) => void;
}

export function AppHeader(
  { currentTime, volume, onVolumeChange }: AppHeaderProps
): React.ReactNode {
  return (
    <header className={styles.appHeader}>
      <img src="logo.png" alt="고고 다이노" className={styles.logo} />
      <div className={styles.headerInfo}>
        <h1>고고 다이노 안내 방송</h1>
        <div className={styles.currentTime}>{formatTime(currentTime)}</div>
      </div>
      <VolumeControl volume={volume} onChange={onVolumeChange} />
    </header>
  );
}
