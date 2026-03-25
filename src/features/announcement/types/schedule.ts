export type ScheduleType = "once" | "odd-hour" | "even-hour" | "interval";

export interface Schedule {
  type: ScheduleType;
  time: string;
  intervalMinutes: number;
  enabled: boolean;
}
