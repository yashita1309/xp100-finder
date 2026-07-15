import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { HPCLStation, NearbyStationResponse } from '../types/station';
import { calculateDistance } from '../utils/distance';

dotenv.config();

const DATA_FILE_PATH = path.resolve(process.cwd(), 'data/hpcl_power95.json');

interface TempStation extends HPCLStation {
  _tempDistance?: number;
}

/**
 * Service to manage queries and operations on HPCL Power95 station data.
 */
export class HPCLStationService {
  /**
   * Reads all HPCL stations directly from the JSON database file.
   * Throws an error on JSON parsing failure.
   */
  public static getAllRawStations(): HPCLStation[] {
    if (!fs.existsSync(DATA_FILE_PATH)) {
      console.warn(
        `[HPCLStationService] Data file not found at ${DATA_FILE_PATH}. Returning empty list.`,
      );
      return [];
    }
    try {
      const rawData = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
      return JSON.parse(rawData) as HPCLStation[];
    } catch (error) {
      throw new Error(`JSON parsing failure: ${(error as Error).message}`);
    }
  }

  /**
   * Retrieves, filters, and paginates HPCL stations.
   */
  public static getStations(params: {
    page?: number;
    limit?: number;
    city?: string;
    state?: string;
    search?: string;
    fuelType?: string;
    priceMin?: number;
    priceMax?: number;
    sortBy?: string;
    order?: string;
    lat?: number;
    lng?: number;
  }):
    | {
        stations: HPCLStation[];
        pagination?: { total: number; page: number; limit: number; totalPages: number };
      }
    | HPCLStation[] {
    let stations = this.getAllRawStations();

    // 1. Filter by city (case-insensitive exact match)
    if (params.city) {
      const cityLower = params.city.trim().toLowerCase();
      stations = stations.filter((s) => s.city.toLowerCase() === cityLower);
    }

    // 2. Filter by state (case-insensitive exact match)
    if (params.state) {
      const stateLower = params.state.trim().toLowerCase();
      stations = stations.filter((s) => s.state && s.state.toLowerCase() === stateLower);
    }

    // 3. Filter by search query (case-insensitive substring across multiple fields)
    if (params.search) {
      const searchLower = params.search.trim().toLowerCase();
      stations = stations.filter(
        (s) =>
          (s.stationName || '').toLowerCase().includes(searchLower) ||
          (s.city || '').toLowerCase().includes(searchLower) ||
          (s.address || '').toLowerCase().includes(searchLower) ||
          (s.state || '').toLowerCase().includes(searchLower) ||
          (s.salesArea || '').toLowerCase().includes(searchLower) ||
          (s.divisionalOffice || '').toLowerCase().includes(searchLower) ||
          (s.stateOffice || '').toLowerCase().includes(searchLower) ||
          (s.roCode || '').toLowerCase().includes(searchLower),
      );
    }

    // 4. Filter by fuelType (case-insensitive exact match)
    if (params.fuelType) {
      const fuelLower = params.fuelType.trim().toLowerCase();
      stations = stations.filter((s) => s.fuelType.toLowerCase() === fuelLower);
    }

    // 5. Filter by priceMin
    if (params.priceMin !== undefined) {
      const minVal = params.priceMin;
      stations = stations.filter((s) => s.power95Price !== null && s.power95Price >= minVal);
    }

    // 6. Filter by priceMax
    if (params.priceMax !== undefined) {
      const maxVal = params.priceMax;
      stations = stations.filter((s) => s.power95Price !== null && s.power95Price <= maxVal);
    }

    // 7. Sort stations
    if (params.sortBy) {
      const field = params.sortBy;
      const orderSign = params.order?.toLowerCase() === 'desc' ? -1 : 1;

      if (field === 'distance' && params.lat !== undefined && params.lng !== undefined) {
        const tempStations = stations as TempStation[];
        tempStations.forEach((s) => {
          s._tempDistance = calculateDistance(params.lat!, params.lng!, s.latitude, s.longitude);
        });
        tempStations.sort((a, b) => {
          const distA = a._tempDistance ?? 0;
          const distB = b._tempDistance ?? 0;
          return (distA - distB) * orderSign;
        });
      } else if (['power95Price', 'petrolPrice', 'dieselPrice', 'turboJetPrice'].includes(field)) {
        stations.sort((a, b) => {
          const valA = a[field as keyof HPCLStation] as number | null;
          const valB = b[field as keyof HPCLStation] as number | null;

          if (valA === null && valB === null) return 0;
          if (valA === null) return 1; // nulls go to the end
          if (valB === null) return -1;

          return (valA - valB) * orderSign;
        });
      } else if (['stationName', 'city', 'state', 'roCode'].includes(field)) {
        stations.sort((a, b) => {
          const valA = (a[field as keyof HPCLStation] || '') as string;
          const valB = (b[field as keyof HPCLStation] || '') as string;
          return valA.localeCompare(valB) * orderSign;
        });
      }
    }

    // Remove any temporary distance property before returning
    const tempStations = stations as TempStation[];
    tempStations.forEach((s) => {
      delete s._tempDistance;
    });

    // 8. Paginate if parameters are provided
    if (params.page !== undefined || params.limit !== undefined) {
      const total = stations.length;
      const page = params.page && params.page > 0 ? params.page : 1;
      const limit = params.limit && params.limit > 0 ? params.limit : 10;
      const totalPages = Math.ceil(total / limit);

      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedStations = stations.slice(startIndex, endIndex);

      return {
        stations: paginatedStations,
        pagination: {
          total,
          page,
          limit,
          totalPages,
        },
      };
    }

    return stations;
  }

  /**
   * Finds HPCL stations within a given radius from a starting coordinate,
   * sorted by distance ascending.
   */
  public static getNearbyStations(params: {
    lat: number;
    lng: number;
    radius?: number;
    limit?: number;
    sortBy?: string;
    order?: string;
  }): NearbyStationResponse[] {
    const stations = this.getAllRawStations();
    const radius = params.radius || 100;
    const limit = params.limit || 10;
    const sortBy = params.sortBy || 'distance';
    const orderSign = params.order?.toLowerCase() === 'desc' ? -1 : 1;

    const results: NearbyStationResponse[] = [];

    for (const station of stations) {
      const distance = calculateDistance(
        params.lat,
        params.lng,
        station.latitude,
        station.longitude,
      );

      if (distance <= radius) {
        results.push({
          stationName: station.stationName,
          city: station.city,
          state: station.state,
          latitude: station.latitude,
          longitude: station.longitude,
          distance,
          power95Price: station.power95Price,
          petrolPrice: station.petrolPrice,
          dieselPrice: station.dieselPrice,
          turboJetPrice: station.turboJetPrice,
          stationUrl: station.stationUrl,
          googleMapsUrl: station.googleMapsUrl,
        });
      }
    }

    // Sort results dynamically
    if (sortBy === 'distance') {
      results.sort((a, b) => (a.distance - b.distance) * orderSign);
    } else if (['power95Price', 'petrolPrice', 'dieselPrice', 'turboJetPrice'].includes(sortBy)) {
      results.sort((a, b) => {
        const valA = a[sortBy as keyof NearbyStationResponse] as number | null;
        const valB = b[sortBy as keyof NearbyStationResponse] as number | null;

        if (valA === null && valB === null) return 0;
        if (valA === null) return 1;
        if (valB === null) return -1;

        return (valA - valB) * orderSign;
      });
    }

    return results.slice(0, limit);
  }

  /**
   * Finds a single HPCL station by its unique RO Code (outlet ID).
   */
  public static getStationByRoCode(roCode: string): HPCLStation | undefined {
    const stations = this.getAllRawStations();
    return stations.find((s) => s.roCode === roCode);
  }
}
