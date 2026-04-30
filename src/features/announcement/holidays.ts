import { y2018, y2019, y2020, y2021, y2022, y2023, y2024, y2025, y2026 } from "@hyunbinseo/holidays-kr";

const HOLIDAY_DATA_BY_YEAR: Record<number, Record<string, readonly string[]>> = {
  2018: y2018,
  2019: y2019,
  2020: y2020,
  2021: y2021,
  2022: y2022,
  2023: y2023,
  2024: y2024,
  2025: y2025,
  2026: y2026,
};

export function isKoreanHoliday(date: Date): boolean {
  const yyyy = date.getFullYear();
  const data = HOLIDAY_DATA_BY_YEAR[yyyy];

  if (!data) return false;

  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  
  return `${yyyy}-${mm}-${dd}` in data;
}
