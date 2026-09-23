import { JsonDatabase } from './jsonDatabase.js';

export interface MigrationResult {
  migrated: boolean;
  message: string;
  filesMigrated: string[];
  counts: {
    qrCodes: number;
    scans: number;
    campaigns: number;
    visitors: number;
    settings: boolean;
    admin: boolean;
  };
}

/**
 * Migration Utility: One-time migration from local JSON files to Vercel Blob.
 *
 * Rules:
 * 1. Only runs if process.env.MIGRATION_MODE === 'true'.
 * 2. Checks if Vercel Blob already contains data (idempotent; will not overwrite existing blob data).
 * 3. Scans are split into immutable scan event records under `data/scans/YYYY-MM-DD/<scan-id>.json`.
 * 4. Other collections (qr_codes, campaigns, visitors, settings, admin) are stored as JSON blobs.
 */
export async function runMigrationIfNeeded(): Promise<MigrationResult> {
  const isMigrationMode = process.env.MIGRATION_MODE === 'true';

  if (!isMigrationMode) {
    return {
      migrated: false,
      message: 'MIGRATION_MODE is not set to "true". Migration skipped.',
      filesMigrated: [],
      counts: { qrCodes: 0, scans: 0, campaigns: 0, visitors: 0, settings: false, admin: false },
    };
  }

  const db = JsonDatabase.getInstance();
  return await db.migrateLocalJsonToBlob();
}
