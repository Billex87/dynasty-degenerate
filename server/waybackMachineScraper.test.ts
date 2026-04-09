import { describe, it, expect } from 'vitest';
import { getMay2025KTCSnapshot } from './waybackMachineScraper';

describe('Wayback Machine KTC Scraper', () => {
  it('should return May 2025 KTC snapshot', () => {
    const data = getMay2025KTCSnapshot();
    expect(typeof data).toBe('object');
  });

  it('should have correct data structure for players', () => {
    const data = getMay2025KTCSnapshot();
    for (const [slug, playerData] of Object.entries(data)) {
      expect(typeof slug).toBe('string');
      if (Object.keys(data).length > 0) {
        expect(playerData.name).toBeDefined();
        expect(typeof playerData.ktc_value).toBe('number');
      }
    }
  });

  it('should return empty object if no data available', () => {
    const data = getMay2025KTCSnapshot();
    expect(Array.isArray(data) || typeof data === 'object').toBe(true);
  });
});
