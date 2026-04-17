import type { Schedule } from "@/features/announcement/types/schedule";
import type { Category } from "@/features/announcement/types/category";

export interface AnnouncementDef {
  id: string;
  title: string;
  category: Category;
  audioFile: string;
  defaultSchedule: Schedule;
}
