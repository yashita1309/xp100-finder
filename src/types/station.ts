export interface Station {
  roCode: string;
  stationName: string;
  stateOffice: string;
  divisionalOffice: string;
  salesArea: string;
  city: string;
  latitude: number;
  longitude: number;
  googleMapsUrl: string;
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
  stateOffice: string;
  divisionalOffice: string;
  salesArea: string;
  latitude: number;
  longitude: number;
  distance: number;
  googleMapsUrl: string;
}
