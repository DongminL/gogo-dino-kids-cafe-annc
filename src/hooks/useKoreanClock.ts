import { useState, useEffect } from "react";
import { getKoreanTime } from "../utils";

export function useKoreanClock(): Date {
  const [currentTime, setCurrentTime] = useState<Date>(getKoreanTime);
  useEffect(() => {
    const timer = setTimeout(() => setCurrentTime(getKoreanTime()), 1000);
    return () => clearTimeout(timer);
  }, [currentTime]);
  return currentTime;
}
