import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import { fetchHtmlWithChallenge } from '../utils/challengeSolver';
import { Station, ScraperStats } from '../types/station';

dotenv.config();

const URL = process.env.IOCL_XP100_URL || 'https://iocl.com/xp100';
const DEFAULT_OUTPUT_PATH = path.resolve(
  process.cwd(),
  process.env.DATA_FILE_PATH || 'data/xp100_stations.json',
);

/**
 * Trims whitespace, removes leading symbols like "**", replaces multiple spaces with a single space,
 * and preserves original casing.
 */
function cleanField(val: string): string {
  let cleaned = val.trim();
  if (cleaned.startsWith('**')) {
    cleaned = cleaned.substring(2).trim();
  }
  return cleaned.replace(/\s+/g, ' ');
}

/**
 * Scrapes the XP100 petrol pump stations from the official IOCL website.
 * Saves the output to a local JSON file and returns performance statistics.
 */
export async function scrapeXP100Stations(outputPath = DEFAULT_OUTPUT_PATH): Promise<ScraperStats> {
  const startTime = Date.now();
  let totalRows = 0;
  let parsed = 0;
  let skipped = 0;

  console.log(`[Scraper] Starting scrape of ${URL}...`);
  const html = await fetchHtmlWithChallenge(URL);

  const $ = cheerio.load(html);

  // Try table tbody tr, and fall back to checking all trs containing tds if necessary
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows = $('table tbody tr') as any;
  if (rows.length === 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows = $('tr').has('td') as any;
  }

  if (rows.length === 0) {
    throw new Error(
      'Missing table: No rows containing table data could be found on the target webpage.',
    );
  }

  totalRows = rows.length;
  console.log(`[Scraper] Found ${totalRows} table rows to process.`);

  const stations: Station[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows.each((index: number, element: any) => {
    try {
      const cells = $(element).find('td');

      // If table row has fewer cells than columns (9 columns total), we skip or treat as parsing failure
      if (cells.length < 9) {
        console.warn(
          `[Scraper] Row ${index + 1} skipped: Expected at least 9 columns, found ${cells.length}.`,
        );
        skipped++;
        return;
      }

      const stateOffice = cleanField($(cells[1]).text());
      const divisionalOffice = cleanField($(cells[2]).text());
      const salesArea = cleanField($(cells[3]).text());
      const roCode = cleanField($(cells[4]).text());
      const stationName = cleanField($(cells[5]).text());
      const city = cleanField($(cells[6]).text());
      const latStr = $(cells[7]).text().trim();
      const lngStr = $(cells[8]).text().trim();

      // Coordinates validation
      if (!latStr || !lngStr) {
        console.warn(`[Scraper] Row ${index + 1} skipped: Missing latitude or longitude values.`);
        skipped++;
        return;
      }

      const latitude = parseFloat(latStr);
      const longitude = parseFloat(lngStr);

      if (isNaN(latitude) || isNaN(longitude)) {
        console.warn(
          `[Scraper] Row ${index + 1} skipped: Invalid numerical coordinate format (lat: "${latStr}", lng: "${lngStr}").`,
        );
        skipped++;
        return;
      }

      // Check basic coordinate range limits (lat: -90 to 90, lng: -180 to 180)
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        console.warn(
          `[Scraper] Row ${index + 1} skipped: Coordinates out of bounds (lat: ${latitude}, lng: ${longitude}).`,
        );
        skipped++;
        return;
      }

      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

      stations.push({
        roCode,
        stationName,
        stateOffice,
        divisionalOffice,
        salesArea,
        city,
        latitude,
        longitude,
        googleMapsUrl,
      });

      parsed++;
    } catch (rowError) {
      const err = rowError as Error;
      console.error(
        `[Scraper] Unexpected parsing error in row ${index + 1}: ${err.message}. Continuing...`,
      );
      skipped++;
    }
  });

  // Ensure target folder exists and write results to JSON output
  const dirPath = path.dirname(outputPath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(stations, null, 2), 'utf-8');
  console.log(`[Scraper] Scrape completed. Saved ${stations.length} stations to ${outputPath}.`);

  const endTime = Date.now();
  const timeTakenSec = ((endTime - startTime) / 1000).toFixed(1);

  return {
    totalRows,
    parsed,
    skipped,
    timeTaken: `${timeTakenSec}s`,
  };
}
