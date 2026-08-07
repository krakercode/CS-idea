export interface WeatherLocation {
  label: string;
  latitude: number;
  longitude: number;
}

export type TemperatureUnit = "celsius" | "fahrenheit";

export interface WeatherSnapshot {
  temperature: number;
  apparentTemperature: number;
  humidityPercent: number;
  windKph: number;
  weatherCode: number;
  isDay: boolean;
  unit: TemperatureUnit;
}
