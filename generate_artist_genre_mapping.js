// generate_artist_genre_mapping.js

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables

// Define __dirname in ES module scope
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Utility function to add a delay
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Main function to generate artist-genre mapping
async function generateArtistGenreMapping() {
  try {
    // Load the list of artist names from your data
    const dataDir = path.join(__dirname, 'uploads/unzipped');
    const artistSet = new Set();

    // Recursively read all StreamingHistory files
    function getAllStreamingHistoryFiles(dir) {
      const files = fs.readdirSync(dir);
      let streamingHistoryFiles = [];

      files.forEach((file) => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          streamingHistoryFiles = streamingHistoryFiles.concat(
            getAllStreamingHistoryFiles(fullPath)
          );
        } else if (/^StreamingHistory_music_\d+\.json$/.test(file)) {
          streamingHistoryFiles.push(fullPath);
        }
      });

      return streamingHistoryFiles;
    }

    const streamingHistoryFiles = getAllStreamingHistoryFiles(dataDir);

    streamingHistoryFiles.forEach((filePath) => {
      const fileContents = fs.readFileSync(filePath, 'utf8');
      const jsonData = JSON.parse(fileContents);

      jsonData.forEach((entry) => {
        const artistName = entry.artistName || 'Unknown Artist';
        artistSet.add(artistName);
      });
    });

    const artistNames = Array.from(artistSet);

    console.log(`Total unique artists found: ${artistNames.length}`);

    // Get Spotify access token
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    let spotifyToken = null;

    try {
      const tokenResponse = await axios.post(
        'https://accounts.spotify.com/api/token',
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${authString}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      spotifyToken = tokenResponse.data.access_token;
    } catch (error) {
      console.error(
        'Error fetching Spotify token:',
        error.response ? error.response.data : error.message
      );
      return;
    }

    const artistGenreMapping = {};

    // Function to fetch artist genres with retry mechanism
    async function fetchArtistGenres(artistName, index, total) {
      const maxRetries = 5;
      let retryCount = 0;
      let success = false;

      while (!success && retryCount < maxRetries) {
        try {
          // Search for the artist to get their Spotify ID
          const searchResponse = await axios.get('https://api.spotify.com/v1/search', {
            headers: {
              Authorization: `Bearer ${spotifyToken}`,
            },
            params: {
              q: artistName,
              type: 'artist',
              limit: 1,
            },
          });

          const artists = searchResponse.data.artists.items;
          if (artists.length > 0) {
            const artist = artists[0];
            const genres = artist.genres.length > 0 ? artist.genres : ['Unknown Genre'];
            artistGenreMapping[artistName] = genres;
          } else {
            console.warn(`No Spotify artist found for ${artistName}`);
            artistGenreMapping[artistName] = ['Unknown Genre'];
          }

          success = true; // Exit the loop on success
        } catch (error) {
          if (error.response && error.response.status === 429) {
            // Rate limit exceeded
            const retryAfter = error.response.headers['retry-after'];
            const waitTime = (retryAfter ? parseInt(retryAfter) : 5) * 1000; // Default to 5 seconds if not provided
            console.warn(
              `Rate limit exceeded. Waiting for ${waitTime / 1000} seconds before retrying...`
            );
            await delay(waitTime);
            retryCount++;
          } else if (error.response && error.response.status >= 500) {
            // Server error, retry after delay
            console.warn(
              `Server error (${error.response.status}). Retrying after delay...`
            );
            await delay(5000); // Wait 5 seconds before retrying
            retryCount++;
          } else {
            console.error(
              `Error fetching genres for ${artistName}:`,
              error.response ? error.response.data : error.message
            );
            artistGenreMapping[artistName] = ['Unknown Genre'];
            success = true; // Exit the loop since this error is not recoverable
          }
        }
      }

      if (!success) {
        console.error(`Failed to fetch genres for ${artistName} after ${maxRetries} retries.`);
        artistGenreMapping[artistName] = ['Unknown Genre'];
      }

      // Log progress after each artist
      console.log(`Processed ${index + 1}/${total}: ${artistName}`);

      // Delay between requests to avoid hitting rate limits
      await delay(1); // Wait 1 second between requests
    }

    // Sequential processing to respect rate limits
    const totalArtists = artistNames.length;
    for (let i = 0; i < totalArtists; i++) {
      const artistName = artistNames[i];
      await fetchArtistGenres(artistName, i, totalArtists);
    }

    // Save the artist-genre mapping to a JSON file
    fs.writeFileSync(
      path.join(__dirname, 'artist_genre_mapping.json'),
      JSON.stringify(artistGenreMapping, null, 2)
    );

    console.log('Artist-genre mapping saved to artist_genre_mapping.json');
  } catch (error) {
    console.error('Error generating artist-genre mapping:', error);
  }
}

// Run the main function
generateArtistGenreMapping();
