export interface Station {
  roCode: string;
  stationName: string;
  stateOffice: string | null;
  divisionalOffice: string | null;
  salesArea: string | null;
  city: string;
  latitude: number;
  longitude: number;
  googleMapsUrl: string;
  petrolPrice?: number | null;
  dieselPrice?: number | null;
  xp95Price?: number | null;
  xp100Price?: number | null;
  address?: string | null;
  state?: string | null;
  phone?: string | null;
  openingHours?: string | null;
  stationUrl?: string | null;
}

export interface ScraperStats {
  totalRows: number;
  parsed: number;
  skipped: number;
  timeTaken: string;
}

export interface NearbyStationResponse {
  roCode: string;
  stationName: string;
  city: string;
  stateOffice: string | null;
  divisionalOffice: string | null;
  salesArea: string | null;
  latitude: number;
  longitude: number;
  distance: number;
  googleMapsUrl: string;
}

export interface IOCLXP95Station {
  brand: string;
  fuelType: string;
  roCode: string;
  stationName: string;
  address: string | null;
  city: string;
  state: string;
  phone: string | null;
  latitude: number;
  longitude: number;
  openingHours: string | null;
  stationUrl: string;
  googleMapsUrl: string;
  xp95Price: number;
  petrolPrice: number | null;
  dieselPrice: number | null;
  xp100Price: number | null;
  lastUpdated: string;
  stateOffice: string | null;
  divisionalOffice: string | null;
  salesArea: string | null;
}

export interface IOCLXP95NearbyStationResponse {
  brand: string;
  fuelType: string;
  stationName: string;
  roCode: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  distance: number;
  xp95Price: number;
  petrolPrice: number | null;
  dieselPrice: number | null;
  xp100Price: number | null;
  stationUrl: string;
  googleMapsUrl: string;
}
