export interface TransitStop {
  id: string;
  name: string;
  modes: string[];
  agencies: string[];
}

export interface TransitDeparture {
  routeName: string;
  headsign: string | null;
  agency: string | null;
  mode: string;
  scheduledTime: string | null;
  estimatedTime: string | null;
  delaySeconds: number | null;
}

export interface Airport {
  icao: string;
  iata: string | null;
  name: string;
  city: string | null;
  country: string | null;
}

export interface TrackedAirport extends Airport {
  id: string;
}

export interface FlightMovement {
  callsign: string | null;
  otherAirport: string | null;
  timeUnix: number;
}
