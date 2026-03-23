import { useState, useEffect } from "react";
import { getKoreanTime } from "../utils";

export function useKoreanClock(): Date {
  const [currentTime, setCurrentTime] = useState<Date>(getKoreanTime);
  useEffect(() => {
    const msUntilNextSecond = 1000 - new Date().getMilliseconds();
    const timer = setTimeout(() => setCurrentTime(getKoreanTime()), msUntilNextSecond);
    return () => clearTimeout(timer);
  }, [currentTime]);
  return currentTime;
}
