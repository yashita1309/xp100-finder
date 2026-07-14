import { Request, Response, NextFunction } from 'express';
import { StationService } from '../services/stationService';

/**
 * Controller to handle all HTTP requests for stations.
 */
export class StationController {
  /**
   * GET /stations
   * Retrieves, filters, and paginates stations.
   */
  public static getStations(req: Request, res: Response, next: NextFunction): void {
    try {
      const { page, limit, city, search } = req.query;

      const parsedPage = page ? parseInt(page as string, 10) : undefined;
      const parsedLimit = limit ? parseInt(limit as string, 10) : undefined;
      const filterCity = city ? (city as string) : undefined;
      const searchQuery = search ? (search as string) : undefined;

      const result = StationService.getStations({
        page: parsedPage,
        limit: parsedLimit,
        city: filterCity,
        search: searchQuery,
      });

      const isEmpty = Array.isArray(result) ? result.length === 0 : result.stations.length === 0;

      if (isEmpty) {
        res.status(404).json({
          error: 'Not Found',
          message: 'No stations found.',
        });
        return;
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /stations/nearby
   * Finds stations within a given radius from specified coordinates.
   */
  public static getNearbyStations(req: Request, res: Response, next: NextFunction): void {
    try {
      const { lat, lng, radius, limit } = req.query;

      if (lat === undefined || lat === '') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Missing latitude',
        });
        return;
      }

      if (lng === undefined || lng === '') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Missing longitude',
        });
        return;
      }

      const latitude = parseFloat(lat as string);
      if (isNaN(latitude) || latitude < -90 || latitude > 90) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid latitude',
        });
        return;
      }

      const longitude = parseFloat(lng as string);
      if (isNaN(longitude) || longitude < -180 || longitude > 180) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid longitude',
        });
        return;
      }

      const searchRadius = radius ? parseFloat(radius as string) : 100;
      const maxResults = limit ? parseInt(limit as string, 10) : 10;

      if (isNaN(searchRadius) || searchRadius < 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Radius parameter must be a valid positive number.',
        });
        return;
      }

      if (isNaN(maxResults) || maxResults <= 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Limit parameter must be a valid positive integer.',
        });
        return;
      }

      const results = StationService.getNearbyStations(
        latitude,
        longitude,
        searchRadius,
        maxResults,
      );

      if (results.length === 0) {
        res.status(404).json({
          error: 'Not Found',
          message: 'No nearby stations found within the requested radius.',
        });
        return;
      }

      res.json(results);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /stations/:roCode
   * Finds a single station by its unique RO Code.
   */
  public static getStationByRoCode(req: Request, res: Response, next: NextFunction): void {
    try {
      const { roCode } = req.params;

      if (!roCode) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'RO Code parameter is required.',
        });
        return;
      }

      const station = StationService.getStationByRoCode(roCode);

      if (!station) {
        res.status(404).json({
          error: 'Not Found',
          message: `Station with RO Code "${roCode}" was not found.`,
        });
        return;
      }

      res.json(station);
    } catch (error) {
      next(error);
    }
  }
}
