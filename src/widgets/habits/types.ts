export interface HabitTask {
  id: string;
  name: string;
  points: number;
}

export type VitalityBand = "healthy" | "warning" | "critical";
