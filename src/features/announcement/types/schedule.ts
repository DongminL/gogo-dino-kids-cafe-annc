export type ScheduleType = "once" | "odd-hour" | "even-hour" | "interval";

export interface Schedule {
  type: ScheduleType;
  time: string;
  intervalMinutes: number;
  enabled: boolean;
}

export type DayType = "weekday" | "holiday";

export interface TimeRange {
  start: string; // "HH:mm"
  end: string;   // "HH:mm"
}

export interface AnnouncementTimeRangeSettings {
  enabled: boolean;
  weekday: TimeRange;
  holiday: TimeRange;
}
