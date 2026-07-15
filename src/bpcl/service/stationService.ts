import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { BPCLStation, NearbyStationResponse } from '../types/station';
import { calculateDistance } from '../../utils/distance';

dotenv.config();

const DATA_FILE_PATH = path.resolve(process.cwd(), 'data/bpcl_speed.json');

interface TempStation extends BPCLStation {
  _tempDistance?: number;
}

/**
 * Service to manage queries and operations on BPCL Speed station data.
 */
export class BPCLStationService {
  /**
   * Reads all BPCL stations directly from the JSON database file.
   * Throws an error on JSON parsing failure.
   */
  public static getAllRawStations(): BPCLStation[] {
    if (!fs.existsSync(DATA_FILE_PATH)) {
      console.warn(
        `[BPCLStationService] Data file not found at ${DATA_FILE_PATH}. Returning empty list.`,
      );
      return [];
    }
    try {
      const rawData = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
      return JSON.parse(rawData) as BPCLStation[];
    } catch (error) {
      throw new Error(`JSON parsing failure: ${(error as Error).message}`);
    }
  }

  /**
   * Retrieves, filters, and paginates BPCL stations.
   */
  public static getStations(params: {
    page?: number;
    limit?: number;
    city?: string;
    search?: string;
    sortBy?: string;
    order?: string;
    lat?: number;
    lng?: number;
  }):
    | {
        stations: BPCLStation[];
        pagination?: { total: number; page: number; limit: number; totalPages: number };
      }
    | BPCLStation[] {
    let stations = this.getAllRawStations();

    // 1. Filter by city (case-insensitive exact match)
    if (params.city) {
      const cityLower = params.city.trim().toLowerCase();
      stations = stations.filter((s) => s.city.toLowerCase() === cityLower);
    }

    // 2. Filter by search query (case-insensitive substring across stationName, city, state, roId)
    if (params.search) {
      const searchLower = params.search.trim().toLowerCase();
      stations = stations.filter(
        (s) =>
          (s.stationName || '').toLowerCase().includes(searchLower) ||
          (s.city || '').toLowerCase().includes(searchLower) ||
          (s.address || '').toLowerCase().includes(searchLower) ||
          (s.state || '').toLowerCase().includes(searchLower) ||
          (s.roId || '').toLowerCase().includes(searchLower),
      );
    }

    // 3. Sort stations
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
      } else if (field === 'price') {
        stations.sort((a, b) => {
          const valA = a.speedPrice;
          const valB = b.speedPrice;

          if (valA === null && valB === null) return 0;
          if (valA === null) return 1; // nulls go to the end
          if (valB === null) return -1;

          return (valA - valB) * orderSign;
        });
      } else if (['stationName', 'city', 'state', 'roId'].includes(field)) {
        stations.sort((a, b) => {
          const valA = (a[field as keyof BPCLStation] || '') as string;
          const valB = (b[field as keyof BPCLStation] || '') as string;
          return valA.localeCompare(valB) * orderSign;
        });
      }
    }

    // Remove any temporary distance property before returning
    const tempStations = stations as TempStation[];
    tempStations.forEach((s) => {
      delete s._tempDistance;
    });

    // 4. Paginate if parameters are provided
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
   * Finds BPCL stations within a given radius from a starting coordinate,
   * sorted by distance or price ascending.
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
    const limit = params.limit || 20;
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
          roId: station.roId,
          stationName: station.stationName,
          city: station.city,
          state: station.state,
          latitude: station.latitude,
          longitude: station.longitude,
          distance,
          speedPrice: station.speedPrice,
          petrolPrice: station.petrolPrice,
          dieselPrice: station.dieselPrice,
          googleMapsUrl: station.googleMapsUrl,
        });
      }
    }

    // Sort results dynamically
    if (sortBy === 'distance') {
      results.sort((a, b) => (a.distance - b.distance) * orderSign);
    } else if (sortBy === 'price') {
      results.sort((a, b) => {
        const valA = a.speedPrice;
        const valB = b.speedPrice;

        if (valA === null && valB === null) return 0;
        if (valA === null) return 1;
        if (valB === null) return -1;

        return (valA - valB) * orderSign;
      });
    }

    return results.slice(0, limit);
  }

  /**
   * Finds a single BPCL station by its unique RO Code (roId).
   */
  public static getStationByRoId(roId: string): BPCLStation | undefined {
    const stations = this.getAllRawStations();
    return stations.find((s) => s.roId === roId);
  }
}
