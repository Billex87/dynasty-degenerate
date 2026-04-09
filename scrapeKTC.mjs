#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Use native fetch (available in Node 18+)

const WAYBACK_URL = 'https://web.archive.org/web/20260115052930/https://keeptradecut.com/dynasty-rankings?page=0&filters=QB|WR|RB|TE';

async function scrapeKTC() {
  try {
    console.log('Fetching Wayback Machine page...');
    const response = await globalThis.fetch(WAYBACK_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    console.log(`Fetched ${html.length} bytes`);
    
    // Extract player data from the HTML
    // Look for patterns like: "1 Bijan RobinsonATL RB1 • 24 y.o. Tier 1 5 9993"
    const players = {};
    
    // Try to find all player rows in the rendered content
    // The page structure has divs with player info
    const playerPattern = /(\d+)\s+([A-Za-z\s\-\.]+?)([A-Z]{2,3})\s+([A-Z]{2,4}\d?)\s+•\s+([\d\.]+)\s+y\.o\.\s+Tier\s+(\d+)\s+(-?\d+)\s+(\d+)/g;
    
    let match;
    let count = 0;
    
    while ((match = playerPattern.exec(html)) !== null) {
      const rank = match[1];
      const playerName = match[2].trim();
      const team = match[3];
      const position = match[4];
      const age = match[5];
      const tier = match[6];
      const tierChange = match[7];
      const value = parseInt(match[8]);
      
      const slug = playerName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]/g, '');
      
      players[slug] = {
        name: playerName,
        ktc_value: value,
        position: position,
        team: team,
        age: parseFloat(age)
      };
      
      count++;
      if (count % 50 === 0) {
        console.log(`Extracted ${count} players...`);
      }
    }
    
    console.log(`Total players extracted: ${count}`);
    
    // If the regex didn't work well, try a different approach
    if (count < 100) {
      console.log('Regex approach found few players, trying alternative method...');
      
      // Look for all lines that start with a number and contain a value
      const lines = html.split('\n');
      for (const line of lines) {
        // Look for lines with player data
        if (/^\d+\s+[A-Z]/.test(line) && /\d{4,5}/.test(line)) {
          // Extract numbers from the line
          const numbers = line.match(/\d+/g) || [];
          if (numbers.length >= 2) {
            // Last number should be the value
            const value = parseInt(numbers[numbers.length - 1]);
            
            // Extract name
            const nameMatch = line.match(/^\d+\s+([A-Za-z\s\-\.]+?)(?:[A-Z]{2,3}|•)/);
            if (nameMatch && value >= 1000 && value <= 10000) {
              const name = nameMatch[1].trim();
              const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]/g, '');
              
              if (name.length > 2 && !players[slug]) {
                players[slug] = {
                  name: name,
                  ktc_value: value
                };
              }
            }
          }
        }
      }
    }
    
    console.log(`Final count: ${Object.keys(players).length} players`);
    
    // Save to JSON file
    const outputPath = path.join(process.cwd(), 'server', 'jan15KTCData.json');
    fs.writeFileSync(outputPath, JSON.stringify(players, null, 2));
    console.log(`Saved to ${outputPath}`);
    
    // Print first 10 players
    console.log('\nFirst 10 players:');
    Object.entries(players).slice(0, 10).forEach(([slug, data]) => {
      console.log(`  ${data.name}: ${data.ktc_value}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

await scrapeKTC();
