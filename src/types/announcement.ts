import type { Schedule } from "./schedule";
import type { Category } from "./category";

export interface AnnouncementDef {
  id: string;
  title: string;
  category: Category;
  audioFile: string;
  defaultSchedule: Schedule;
}
