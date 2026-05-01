#!/usr/bin/env node

/**
 * Parse May 2025 KTC rookie rankings archive
 * Extract rookie player values from superflexValues
 * Run with: node server/parseMay2025Rookies.mjs
 */

import fs from 'fs';

async function parseKTCRookieArchive() {
  try {
    // Read the HTML file
    const html = fs.readFileSync('/tmp/ktc_may_2025_rookies.html', 'utf-8');

    // Extract player data with superflexValues
    // Pattern: "playerName":"...", "slug":"...", ... "superflexValues":{...,"value":NUMBER}
    const playerPattern = /"playerName":"([^"]+)","playerID":\d+,"slug":"([^"]+)"[\s\S]*?"superflexValues":\{[\s\S]*?"value":(\d+)(?=,"rank")/g;
    
    const players = {};
    let match;
    let count = 0;
    
    while ((match = playerPattern.exec(html)) !== null) {
      const playerName = match[1];
      const slug = match[2];
      const ktcValue = parseInt(match[3], 10);
      
      players[slug] = {
        name: playerName,
        ktc_value: ktcValue,
      };
      count++;
    }

    console.log(`Extracted ${count} rookie players from May 2025 KTC archive`);
    
    // Display first 10 players
    console.log('\nFirst 10 players:');
    Object.entries(players).slice(0, 10).forEach(([slug, data]) => {
      console.log(`  ${slug}: ${data.name} = ${data.ktc_value}`);
    });

    // Check specific players
    console.log('\nSpecific players:');
    console.log(`  Ashton Jeanty: ${players['ashton-jeanty-1742']?.ktc_value || 'NOT FOUND'}`);

    // Save to JSON file
    const outputPath = new URL('./rookie-values/2025RookieValues.json', import.meta.url);
    fs.writeFileSync(outputPath, JSON.stringify(players, null, 2));
    console.log(`\nSaved ${count} rookie players to ${outputPath}`);

    return players;
  } catch (error) {
    console.error('Error parsing KTC rookie archive:', error);
    return {};
  }
}

parseKTCRookieArchive();
