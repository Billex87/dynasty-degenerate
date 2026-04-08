import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storeKtcSnapshot, getKtcSnapshotFromSevenDaysAgo } from './ktcSnapshotJob';

// Mock the database and KTC loader
vi.mock('./db', () => ({
  getDb: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('./ktcLoader', () => ({
  loadKTCValues: vi.fn(() =>
    Promise.resolve({
      'josh-allen': 1500,
      'patrick-mahomes': 1400,
      'travis-kelce': 1200,
    })
  ),
}));

describe('KTC Snapshot Job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle missing database gracefully', async () => {
    // When database is not available, the function should log an error but not throw
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    await storeKtcSnapshot();
    
    expect(consoleSpy).toHaveBeenCalledWith(
      '[KTC Snapshot] Database not available'
    );
    
    consoleSpy.mockRestore();
  });

  it('should return null when no snapshot found from 7 days ago', async () => {
    const result = await getKtcSnapshotFromSevenDaysAgo();
    
    // When database is not available, should return null
    expect(result).toBeNull();
  });

  it('should log error when database is unavailable during snapshot storage', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // This will fail gracefully due to no database, but we're testing the error message
    await storeKtcSnapshot();
    
    // The function should log an error when DB is unavailable
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[KTC Snapshot] Database not available'
    );
    
    consoleErrorSpy.mockRestore();
  });
});
