// app.js

import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import unzipper from 'unzipper';
import axios from 'axios';
import pLimit from 'p-limit';

// Define constants for easy adjustments
const TOP_N = 10; // Modify this number to adjust how many top songs to select
const SNAPSHOT_DAYS = 7; // Modify this to control how many days are considered per non-cumulative snapshot
let genresList = []; // Declared once here

dotenv.config(); // Load environment variables

const app = express();
app.use(cors()); // Enable CORS
app.use(express.json()); // This allows the server to parse incoming JSON requests

// Define __dirname in ES module scope
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const currentDate = new Date().toISOString().replace(/:/g, '-'); // Use current date in file name
    const uniqueSuffix = currentDate + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Serve the uploads folder statically
app.use('/uploads', express.static('uploads'));

// Root route to handle "/"
app.get('/', (req, res) => {
  res.send('Welcome to the Spotify API!');
});

// Function to get Spotify token
async function getSpotifyToken() {
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

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
    return tokenResponse.data.access_token;
  } catch (error) {
    console.error(
      'Error fetching Spotify token:',
      error.response ? error.response.data : error.message
    );
    throw new Error('Error retrieving Spotify token');
  }
}

// Function to clear the unzipped folder before unzipping a new file
function clearUnzippedFolder() {
  const unzippedDir = path.join(__dirname, 'uploads/unzipped');

  return new Promise((resolve, reject) => {
    fs.rm(unzippedDir, { recursive: true, force: true }, (err) => {
      if (err) {
        console.error('Error deleting unzipped directory:', err);
        reject(err);
        return;
      }

      // Recreate the unzipped directory after deletion
      fs.mkdir(unzippedDir, (err) => {
        if (err) {
          console.error('Error recreating unzipped directory:', err);
          reject(err);
        } else {
          console.log('Unzipped directory cleared and recreated.');
          resolve(); // Proceed with unzipping
        }
      });
    });
  });
}

// Function to clear the entire uploads folder before processing
function clearUploadsFolder() {
  const uploadsDir = path.join(__dirname, 'uploads');

  return new Promise((resolve, reject) => {
    // Remove all contents of the uploads folder
    fs.readdir(uploadsDir, (err, files) => {
      if (err) {
        console.error('Error reading uploads directory:', err);
        reject(err);
        return;
      }

      // Loop through each file/folder and remove them
      Promise.all(
        files.map((file) => {
          const filePath = path.join(uploadsDir, file);
          return new Promise((res, rej) => {
            fs.rm(filePath, { recursive: true, force: true }, (err) => {
              if (err) {
                console.error('Error deleting file:', filePath, err);
                rej(err);
              } else {
                console.log(`Deleted: ${filePath}`);
                res();
              }
            });
          });
        })
      )
        .then(() => {
          console.log('Uploads directory cleared.');
          resolve();
        })
        .catch((err) => {
          console.error('Error clearing uploads directory:', err);
          reject(err);
        });
    });
  });
}

// Function to unzip the file
function unzipFile(zipFilePath, unzipPath) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(zipFilePath)
      .pipe(unzipper.Extract({ path: unzipPath }))
      .on('close', () => {
        console.log('Unzipping complete');
        resolve();
      })
      .on('error', (err) => {
        console.error('Error during unzipping:', err);
        reject(err);
      });
  });
}

// Function to recursively filter out files starting with "StreamingHistory_music"
function filterStreamingHistoryFiles(directoryPath) {
  const relevantFiles = [];

  function searchDirectory(currentPath) {
    const files = fs.readdirSync(currentPath);

    files.forEach((file) => {
      const fullPath = path.join(currentPath, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Recursively search directories
        searchDirectory(fullPath);
      } else if (/^StreamingHistory_music.*\.json$/.test(file)) {
        console.log('File matches:', file);
        relevantFiles.push(fullPath); // Save the full path of the file
      }
    });
  }

  searchDirectory(directoryPath);

  return relevantFiles;
}

// Function to calculate the start of the N-day interval
function getIntervalStart(date, days = 3) {
  const msInInterval = days * 24 * 60 * 60 * 1000; // N days in milliseconds
  const intervalStart = Math.floor(date.getTime() / msInInterval) * msInInterval;
  return new Date(intervalStart); // Return the start of the interval as a Date object
}

// Function for readable time for the data
function msToReadableTime(ms) {
  const minutes = ms / 60000;
  if (minutes > 60) {
    const hours = (minutes / 60).toFixed(2);
    return `${hours} hours`;
  } else {
    return `${Math.round(minutes)} min`;
  }
}

// Helper Function to Get Week Number
function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${weekNumber}`;
}

// Function to chunk an array into smaller arrays of a specified size
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// File upload route with unzipping logic
app.post('/upload', upload.single('datafile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  console.log('File uploaded:', req.file);

  const zipFilePath = path.join(__dirname, 'uploads', req.file.filename);
  const unzipPath = path.join(__dirname, 'uploads/unzipped');

  try {
    // Clear the unzipped folder and then proceed with unzipping
    await clearUnzippedFolder();
    await unzipFile(zipFilePath, unzipPath);

    // Filter out "StreamingHistory_music" files, now recursively
    const streamingHistoryFiles = filterStreamingHistoryFiles(unzipPath);

    if (streamingHistoryFiles.length === 0) {
      console.log('No StreamingHistory_music files found.');
      return res.json({
        message:
          'File uploaded and unzipped successfully, but no StreamingHistory_music files were found.',
        streamingHistoryFiles: [],
      });
    }

    // --- Block 1: Cumulative Snapshot Processing in 3-Day Intervals ---
    const cumulativePlaytime = {}; // Store cumulative playtime across all songs
    const cumulativeByInterval = {}; // Store cumulative playtime for each 3-day interval

    // Initialize previous interval
    let previousIntervalData = {};

    // Loop over each StreamingHistory file and process the playtime data
    streamingHistoryFiles.forEach((filePath) => {
      try {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(fileContents);

        jsonData.forEach((entry) => {
          const trackName = entry.trackName;
          const endTime = new Date(entry.endTime);
          const intervalStart = getIntervalStart(endTime, 3)
            .toISOString()
            .split('T')[0]; // Format as YYYY-MM-DD

          const artistName = entry.artistName || 'Unknown Artist'; // Ensure this field exists
          const songWithArtist = `${trackName} (${artistName})`; // Combine song name and artist

          // If we enter a new interval, carry over songs from the previous interval
          if (!cumulativeByInterval[intervalStart]) {
            // Carry over all songs from the previous interval to maintain cumulative playtime
            cumulativeByInterval[intervalStart] = { ...previousIntervalData };
          }

          // Track cumulative playtime across all intervals
          if (!cumulativePlaytime[songWithArtist]) {
            cumulativePlaytime[songWithArtist] = 0;
          }

          cumulativePlaytime[songWithArtist] += entry.msPlayed;

          // Track cumulative playtime per interval (ensure it's not overwritten)
          cumulativeByInterval[intervalStart][songWithArtist] =
            cumulativePlaytime[songWithArtist];

          // Update previous interval data to carry forward
          previousIntervalData = { ...cumulativeByInterval[intervalStart] };
        });
      } catch (err) {
        console.error(`Error processing ${filePath}:`, err);
      }
    });

    // Now convert the cumulativeByInterval object to the desired format
    const cumulativeDataForBarChart = Object.keys(cumulativeByInterval).map(
      (interval) => ({
        date: interval,
        songs: Object.entries(cumulativeByInterval[interval])
          .map(([name, playtime]) => ({ name, playtime: playtime })) // Playtime in ms
          .sort((a, b) => b.playtime - a.playtime), // Sort by playtime
      })
    );

    // Save cumulative data per 3-day interval to file in the new format
    fs.writeFileSync(
      path.join(__dirname, 'cumulative_for_barchart.json'),
      JSON.stringify(cumulativeDataForBarChart, null, 2)
    );
    console.log(
      'Cumulative data per interval saved to cumulative_for_barchart.json'
    );

    // --- Block 2: Non-Cumulative Snapshot Processing ---
    const nonCumulativePlaytime = {};

    streamingHistoryFiles.forEach((filePath) => {
      try {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(fileContents);

        jsonData.forEach((entry) => {
          const trackName = entry.trackName;
          const endTime = new Date(entry.endTime);
          const intervalStart = getIntervalStart(endTime, SNAPSHOT_DAYS)
            .toISOString()
            .split('T')[0]; // Format as YYYY-MM-DD

          const artistName = entry.artistName || 'Unknown Artist';
          const songWithArtist = `${trackName} (${artistName})`;

          if (!nonCumulativePlaytime[intervalStart]) {
            nonCumulativePlaytime[intervalStart] = {};
          }

          if (!nonCumulativePlaytime[intervalStart][songWithArtist]) {
            nonCumulativePlaytime[intervalStart][songWithArtist] = 0;
          }

          nonCumulativePlaytime[intervalStart][songWithArtist] += entry.msPlayed;
        });
      } catch (err) {
        console.error(`Error processing ${filePath}:`, err);
      }
    });

    // Process each interval and get the top N songs
    const topSongsByInterval = {};

    Object.keys(nonCumulativePlaytime).forEach((intervalKey) => {
      const songsInInterval = nonCumulativePlaytime[intervalKey];
      const sortedSongs = Object.entries(songsInInterval)
        .sort((a, b) => b[1] - a[1]) // Sort by playtime in descending order
        .slice(0, TOP_N); // Select top N songs

      topSongsByInterval[intervalKey] = sortedSongs.map(([name, playtime]) => ({
        name,
        playtime,
      }));
    });

    // Save non-cumulative data per 3-day interval to file in the new format
    fs.writeFileSync(
      path.join(__dirname, 'non_cumulative_songs.json'),
      JSON.stringify(topSongsByInterval, null, 2)
    );
    console.log('Non-cumulative data saved to non_cumulative_songs.json');

     // --- New Block: Genre Mapping with API Calls for Missing Artists ---

    // Step 1: Calculate total playtime per artist
    const artistPlaytime = {};
    const normalizedToOriginalArtistNames = {};

    streamingHistoryFiles.forEach((filePath) => {
      try {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(fileContents);

        jsonData.forEach((entry) => {
          const originalArtistName = entry.artistName || 'Unknown Artist';
          const artistName = originalArtistName.toLowerCase().trim(); // Normalize artist name

          // Map normalized name to original name (the first occurrence)
          if (!normalizedToOriginalArtistNames[artistName]) {
            normalizedToOriginalArtistNames[artistName] = originalArtistName;
          }

          if (!artistPlaytime[artistName]) {
            artistPlaytime[artistName] = 0;
          }
          artistPlaytime[artistName] += entry.msPlayed;
        });
      } catch (err) {
        console.error(`Error processing ${filePath}:`, err);
      }
    });

    // Step 2: Load the pre-generated artist-genre mapping
    let artistGenreMapping = {};
    try {
      const mappingPath = path.join(__dirname, 'artist_genre_mapping.json');
      const mappingContents = fs.readFileSync(mappingPath, 'utf8');
      artistGenreMapping = JSON.parse(mappingContents);
    } catch (error) {
      console.error('Error loading artist_genre_mapping.json:', error);
      // Initialize an empty mapping if the file doesn't exist
      artistGenreMapping = {};
    }

    // Step 3: Identify artists not in the mapping
    const artistsToFetch = [];
    for (const artistNameKey of Object.keys(artistPlaytime)) {
      const originalArtistName = normalizedToOriginalArtistNames[artistNameKey];
      if (!artistGenreMapping[originalArtistName]) {
        artistsToFetch.push({
          normalizedName: artistNameKey,
          originalName: originalArtistName,
        });
      }
    }

    if (artistsToFetch.length > 0) {
      console.log(`Fetching genres for ${artistsToFetch.length} new artists...`);

      // Step 4: Get Spotify access token
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
        return res.status(500).json({ error: 'Error retrieving Spotify token' });
      }

      // Step 5: Fetch genres for missing artists
      const limit = pLimit(10); // Control concurrency

      // Map to store artist IDs and genres
      const artistIdMap = {};
      const artistGenreMap = {};

      // Function to fetch artist ID
      async function fetchArtistId(artist) {
        const { normalizedName, originalName } = artist;
        try {
          const searchResponse = await axios.get(
            'https://api.spotify.com/v1/search',
            {
              headers: {
                Authorization: `Bearer ${spotifyToken}`,
              },
              params: {
                q: originalName,
                type: 'artist',
                limit: 1,
              },
            }
          );

          const artists = searchResponse.data.artists.items;
          if (artists.length > 0) {
            const artistData = artists[0];
            artistIdMap[normalizedName] = artistData.id;
          } else {
            console.warn(`No Spotify artist found for ${originalName}`);
            artistIdMap[normalizedName] = null;
          }
        } catch (error) {
          console.error(
            `Error fetching artist ID for ${originalName}:`,
            error.response ? error.response.data : error.message
          );
          artistIdMap[normalizedName] = null;
        }
      }

      // Fetch artist IDs with controlled concurrency
      await Promise.all(
        artistsToFetch.map((artist) => limit(() => fetchArtistId(artist)))
      );

      // Fetch genres in batches of 50
      const artistIds = Object.values(artistIdMap).filter((id) => id !== null);
      const idChunks = chunkArray(artistIds, 50);

      for (const chunk of idChunks) {
        try {
          const response = await axios.get('https://api.spotify.com/v1/artists', {
            headers: {
              Authorization: `Bearer ${spotifyToken}`,
            },
            params: {
              ids: chunk.join(','),
            },
          });

          response.data.artists.forEach((artistData) => {
            const normalizedName = Object.keys(artistIdMap).find(
              (key) => artistIdMap[key] === artistData.id
            );
            artistGenreMap[normalizedName] =
              artistData.genres.length > 0 ? artistData.genres : ['Unknown Genre'];
          });
        } catch (error) {
          console.error(
            'Error fetching genres for artist chunk:',
            error.response ? error.response.data : error.message
          );
          // Assign 'Unknown Genre' to all artists in this chunk
          chunk.forEach((id) => {
            const normalizedName = Object.keys(artistIdMap).find(
              (key) => artistIdMap[key] === id
            );
            artistGenreMap[normalizedName] = ['Unknown Genre'];
          });
        }
      }

      // Assign 'Unknown Genre' to artists without a Spotify ID
      Object.entries(artistIdMap).forEach(([normalizedName, id]) => {
        if (id === null) {
          artistGenreMap[normalizedName] = ['Unknown Genre'];
        }
      });

      // Step 6: Update the artistGenreMapping with fetched genres
      artistsToFetch.forEach(({ normalizedName, originalName }) => {
        artistGenreMapping[originalName] = artistGenreMap[normalizedName] || [
          'Unknown Genre',
        ];
      });

      // Step 7: Save the updated mapping back to the file
      fs.writeFileSync(
        path.join(__dirname, 'artist_genre_mapping.json'),
        JSON.stringify(artistGenreMapping, null, 2)
      );
      console.log('Updated artist_genre_mapping.json with new artists.');
    }

    // Step 8: Build the genre-artists-playtime mapping
    const genreArtistsMap = {};

    for (const [artistNameKey, playtimeMs] of Object.entries(artistPlaytime)) {
      const originalArtistName = normalizedToOriginalArtistNames[artistNameKey];
      const genres = artistGenreMapping[originalArtistName] || ['Unknown Genre'];

      genres.forEach((genre) => {
        if (!genreArtistsMap[genre]) {
          genreArtistsMap[genre] = [];
        }
        genreArtistsMap[genre].push({
          name: originalArtistName,
          playtime: playtimeMs,
        });
      });
    }

    // Step 9: Convert the genreArtistsMap to the desired JSON structure
    let genresList = Object.keys(genreArtistsMap).map((genre) => ({
      genre: genre,
      artists: genreArtistsMap[genre],
    }));

    // Step 10: Save the result to a JSON file
    fs.writeFileSync(
      path.join(__dirname, 'artists_by_genre.json'),
      JSON.stringify(genresList, null, 2)
    );
    console.log('Artists grouped by genre saved to artists_by_genre.json');

    // --- End of New Block ---

    // --- Spotify Wrapped Insights Processing ---

    // Initialize an array to hold all streaming data
    let allStreamingData = [];

    // Loop over each StreamingHistory file and read the data
    streamingHistoryFiles.forEach((filePath) => {
      try {
        const fileContents = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(fileContents);
        allStreamingData = allStreamingData.concat(jsonData);
      } catch (err) {
        console.error(`Error processing ${filePath}:`, err);
      }
    });

    // Sort the combined data by endTime
    allStreamingData.sort((a, b) => new Date(a.endTime) - new Date(b.endTime));
    
    // --- Compute Spotify Wrapped Insights ---

    // Helper function to format milliseconds to readable time
    function msToReadableTime(ms) {
      const minutes = ms / 60000;
      if (minutes > 60) {
        const hours = (minutes / 60).toFixed(2);
        return `${hours} hours`;
      } else {
        return `${Math.round(minutes)} min`;
      }
    }

    // Insight 1: Top Songs
    const trackPlaytime = {};

    allStreamingData.forEach((entry) => {
      const trackName = entry.trackName || 'Unknown Track';
      const artistName = entry.artistName || 'Unknown Artist';

      // Skip if 'Unknown' is in track or artist name
      if (trackName.includes('Unknown') || artistName.includes('Unknown')) {
        return;
      }

      const songWithArtist = `${trackName} (${artistName})`;

      if (!trackPlaytime[songWithArtist]) {
        trackPlaytime[songWithArtist] = 0;
      }
      trackPlaytime[songWithArtist] += entry.msPlayed;
    });

    // Get top N songs
    const TOP_SONGS = 5; // Adjustable number of top songs
    const topSongs = Object.entries(trackPlaytime)
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_SONGS)
      .map(([name, playtime]) => ({
        name,
        playtimeMs: playtime,
        playtime: msToReadableTime(playtime),
      }));


    // Insight 2: Top Artists
    const artistPlaytimeForTopArtists = {};

    allStreamingData.forEach((entry) => {
      const artistName = entry.artistName || 'Unknown Artist';

      if (!artistPlaytimeForTopArtists[artistName]) {
        artistPlaytimeForTopArtists[artistName] = 0;
      }
      artistPlaytimeForTopArtists[artistName] += entry.msPlayed;
    });

    // Get top artists
    const topArtists = Object.entries(artistPlaytimeForTopArtists)
      .sort((a, b) => b[1] - a[1]) // Sort by playtime descending
      .slice(0, 5)
      .map(([name, playtime]) => ({
        name,
        playtimeMs: playtime,
        playtime: msToReadableTime(playtime),
      }));

    // Insight 3: Top Genre
    // Compute total playtime per genre using the pre-generated artists_by_genre.json

    // Step 1: Load the 'artists_by_genre.json' file
    let artistsByGenre = [];

    try {
      const artistsByGenrePath = path.join(__dirname, 'artists_by_genre.json');
      const artistsByGenreContents = fs.readFileSync(artistsByGenrePath, 'utf8');
      artistsByGenre = JSON.parse(artistsByGenreContents); // Parse the JSON file
    } catch (error) {
      console.error('Error loading artists_by_genre.json:', error);
      artistsByGenre = []; // Fallback in case the file can't be loaded
    }

    // Step 2: Initialize an object to store total playtime per genre
    const genrePlaytime = {};

    // Step 3: Process all streaming data to calculate playtime per genre
    allStreamingData.forEach((entry) => {
      const artistName = entry.artistName || 'Unknown Artist'; // Ensure we have the artist name
      const msPlayed = entry.msPlayed;

      // Find the artist and associated genre(s) from the loaded 'artists_by_genre.json' data
      const genreData = artistsByGenre.find((genreItem) =>
        genreItem.artists.some((artist) => artist.name === artistName)
      );

      // If genre is found, aggregate the playtime by genre
      const genres = genreData ? [genreData.genre] : ['Unknown Genre'];

      // Add playtime for each genre, ensuring 'Unknown Genre' is ignored when calculating top genres
      genres.forEach((genre) => {
        if (genre !== 'Unknown Genre') {
          if (!genrePlaytime[genre]) {
            genrePlaytime[genre] = 0;
          }
          genrePlaytime[genre] += msPlayed;
        }
      });
    });

    // Step 4: Get top genres, excluding 'Unknown Genre'
    const topGenres = Object.entries(genrePlaytime)
      .sort(([, playtimeA], [, playtimeB]) => playtimeB - playtimeA) // Sort by playtime descending
      .slice(0, 5) // Get the top 5 genres
      .map(([genre, playtime]) => ({
        genre,
        playtimeMs: playtime,
        playtime: msToReadableTime(playtime), // Convert playtime to a readable format
      }));

    // Log the top genres for debugging
    console.log(topGenres);

    // Insight 4a: Top Listening Days of the Week
    const dayOfWeekPlaytime = {};

    allStreamingData.forEach((entry) => {
      const endTime = new Date(entry.endTime);
      const dayOfWeek = endTime.toLocaleString('en-US', { weekday: 'long' });

      if (!dayOfWeekPlaytime[dayOfWeek]) {
        dayOfWeekPlaytime[dayOfWeek] = 0;
      }
      dayOfWeekPlaytime[dayOfWeek] += entry.msPlayed;
    });

    // Sort days by playtime
    const topDaysOfWeek = Object.entries(dayOfWeekPlaytime)
      .sort((a, b) => b[1] - a[1]) // Sort by playtime descending
      .map(([day, playtime]) => ({
        day,
        playtimeMs: playtime,
        playtime: msToReadableTime(playtime),
      }));

    // Insight 4b: Listening Time of Day
    // Define time ranges
    const timeRanges = [
      { name: 'Should Be Asleep', startHour: 1, endHour: 5 },
      { name: 'Morning', startHour: 5, endHour: 12 },
      { name: 'Afternoon', startHour: 12, endHour: 17 },
      { name: 'Evening', startHour: 17, endHour: 21 },
      { name: 'Night', startHour: 21, endHour: 25 }, // 25 to include 0 (12 AM)
    ];

    const timeOfDayPlaytime = {};

    // Initialize playtime for each time range
    timeRanges.forEach((range) => {
      timeOfDayPlaytime[range.name] = 0;
    });

    allStreamingData.forEach((entry) => {
      const endTime = new Date(entry.endTime);
      let hour = endTime.getHours();

      // Adjust hour for 12 AM to 1 AM
      if (hour === 0) {
        hour = 24;
      }

      for (const range of timeRanges) {
        if (hour >= range.startHour && hour < range.endHour) {
          timeOfDayPlaytime[range.name] += entry.msPlayed;
          break;
        }
      }
    });

    // Sort time ranges by playtime
    const topTimesOfDay = Object.entries(timeOfDayPlaytime)
      .sort((a, b) => b[1] - a[1])
      .map(([timeOfDay, playtime]) => ({
        timeOfDay,
        playtimeMs: playtime,
        playtime: msToReadableTime(playtime),
      }));

    // Insight 4c: Top Listening Hours
    const hourPlaytime = {};

    allStreamingData.forEach((entry) => {
      const endTime = new Date(entry.endTime);
      const hour = endTime.getHours();

      if (!hourPlaytime[hour]) {
        hourPlaytime[hour] = 0;
      }
      hourPlaytime[hour] += entry.msPlayed;
    });

    // Sort hours by playtime
    const topHours = Object.entries(hourPlaytime)
      .sort((a, b) => b[1] - a[1])
      .map(([hour, playtime]) => ({
        hour: `${hour}:00 - ${hour}:59`,
        playtimeMs: playtime,
        playtime: msToReadableTime(playtime),
      }));

    // Insight 5a: Average Session Length
    // Identify sessions
    const sessions = [];
    let currentSession = [];
    const sessionGapThreshold = 10 * 60 * 1000; // 10 minutes in ms

    allStreamingData.forEach((entry, index) => {
      const endTime = new Date(entry.endTime).getTime();

      if (currentSession.length === 0) {
        currentSession.push(entry);
      } else {
        const previousEndTime = new Date(
          allStreamingData[index - 1].endTime
        ).getTime();
        const gap = endTime - previousEndTime;

        if (gap <= sessionGapThreshold) {
          currentSession.push(entry);
        } else {
          sessions.push([...currentSession]);
          currentSession = [entry];
        }
      }

      // Add the last session
      if (index === allStreamingData.length - 1 && currentSession.length > 0) {
        sessions.push([...currentSession]);
      }
    });

    // Calculate session lengths
    const sessionLengths = sessions.map((session) =>
      session.reduce((sum, entry) => sum + entry.msPlayed, 0)
    );

    // Calculate average session length
    const totalSessionTime = sessionLengths.reduce((sum, length) => sum + length, 0);
    const averageSessionLengthMs = totalSessionTime / sessionLengths.length || 0;
    const averageSessionLength = msToReadableTime(averageSessionLengthMs);

    // Insight 5b: Longest Listening Sessions
    // Find the longest sessions
    const longestSessions = sessionLengths
      .map((length, index) => ({
        sessionNumber: index + 1,
        playtimeMs: length,
        playtime: msToReadableTime(length),
        startTime: sessions[index][0].endTime,
        endTime: sessions[index][sessions[index].length - 1].endTime,
      }))
      .sort((a, b) => b.playtimeMs - a.playtimeMs)
      .slice(0, 1); // Get the longest sessions

    // Insight 5c: Shortest Listening Sessions
    // Find the shortest sessions
    const shortestSessions = sessionLengths
      .map((length, index) => ({
        sessionNumber: index + 1,
        playtimeMs: length,
        playtime: msToReadableTime(length),
        startTime: sessions[index][0].endTime,
        endTime: sessions[index][sessions[index].length - 1].endTime,
      }))
      .sort((a, b) => a.playtimeMs - b.playtimeMs)
      .slice(0, 1); // Get the shortest sessions

    // Insight 6a: Average Listening Time per Week
    const weekPlaytime = {};

    allStreamingData.forEach((entry) => {
      const endTime = new Date(entry.endTime);
      const week = getWeekNumber(endTime); // Custom function to get week number

      if (!weekPlaytime[week]) {
        weekPlaytime[week] = 0;
      }
      weekPlaytime[week] += entry.msPlayed;
    });

    // Calculate average listening time per week
    const totalWeeks = Object.keys(weekPlaytime).length;
    const totalWeekPlaytime = Object.values(weekPlaytime).reduce(
      (sum, playtime) => sum + playtime,
      0
    );
    const averageWeeklyPlaytimeMs = totalWeekPlaytime / totalWeeks || 0;
    const averageWeeklyPlaytime = msToReadableTime(averageWeeklyPlaytimeMs);

    // Insight 6b: Average Listening Time per Month
    const monthPlaytime = {};

    allStreamingData.forEach((entry) => {
      const endTime = new Date(entry.endTime);
      const month = `${endTime.getFullYear()}-${String(
        endTime.getMonth() + 1
      ).padStart(2, '0')}`;

      if (!monthPlaytime[month]) {
        monthPlaytime[month] = 0;
      }
      monthPlaytime[month] += entry.msPlayed;
    });

    // Calculate average listening time per month
    const totalMonths = Object.keys(monthPlaytime).length;
    const totalMonthPlaytime = Object.values(monthPlaytime).reduce(
      (sum, playtime) => sum + playtime,
      0
    );
    const averageMonthlyPlaytimeMs = totalMonthPlaytime / totalMonths || 0;
    const averageMonthlyPlaytime = msToReadableTime(averageMonthlyPlaytimeMs);

    // Insight 6c: Top Listening Content per Month
    const topContentPerMonth = {};

    Object.keys(monthPlaytime).forEach((month) => {
      const entriesInMonth = allStreamingData.filter((entry) => {
        const endTime = new Date(entry.endTime);
        const entryMonth = `${endTime.getFullYear()}-${String(
          endTime.getMonth() + 1
        ).padStart(2, '0')}`;
        return entryMonth === month;
      });

      const trackPlaytimeInMonth = {};

      entriesInMonth.forEach((entry) => {
        const trackName = entry.trackName || 'Unknown Track';
        const artistName = entry.artistName || 'Unknown Artist';
        const songWithArtist = `${trackName} (${artistName})`;

        if (!trackPlaytimeInMonth[songWithArtist]) {
          trackPlaytimeInMonth[songWithArtist] = 0;
        }
        trackPlaytimeInMonth[songWithArtist] += entry.msPlayed;
      });

      // Get top track for the month
      const topTrack = Object.entries(trackPlaytimeInMonth)
        .sort((a, b) => b[1] - a[1])
        .map(([name, playtime]) => ({
          name,
          playtimeMs: playtime,
          playtime: msToReadableTime(playtime),
        }))[0];

      topContentPerMonth[month] = topTrack;
    });

    // Insight 7: Listening Streaks
    const listeningDays = new Set(
      allStreamingData.map((entry) =>
        new Date(entry.endTime).toISOString().split('T')[0]
      )
    );

    // Sort the dates
    const sortedDays = Array.from(listeningDays).sort();

    // Find longest streak
    let longestStreak = 0;
    let currentStreak = 1;
    let streaks = [];
    let streakStart = sortedDays[0];

    for (let i = 1; i < sortedDays.length; i++) {
      const prevDate = new Date(sortedDays[i - 1]);
      const currDate = new Date(sortedDays[i]);
      const diffDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        currentStreak++;
      } else {
        streaks.push({ start: streakStart, length: currentStreak });
        currentStreak = 1;
        streakStart = sortedDays[i];
      }

      if (i === sortedDays.length - 1) {
        streaks.push({ start: streakStart, length: currentStreak });
      }
    }

    // Find the longest streak
    const longestListeningStreak = streaks.reduce(
      (max, streak) => (streak.length > max.length ? streak : max),
      { length: 0 }
    );

    // Insight 8: Artist Consistency
    const TOP_CONSISTENT_ARTISTS = 5; // Adjust this value to get more or fewer artists

    const artistListeningDays = {};

    allStreamingData.forEach((entry) => {
      const artistName = entry.artistName || 'Unknown Artist';
      const date = new Date(entry.endTime).toISOString().split('T')[0];

      if (!artistListeningDays[artistName]) {
        artistListeningDays[artistName] = new Set();
      }
      artistListeningDays[artistName].add(date);
    });

    const consistentArtists = [];

    Object.entries(artistListeningDays).forEach(([artist, daysSet]) => {
      const daysArray = Array.from(daysSet).sort();
      let currentStreak = 1;
      let streakStart = daysArray[0];

      for (let i = 1; i < daysArray.length; i++) {
        const prevDate = new Date(daysArray[i - 1]);
        const currDate = new Date(daysArray[i]);
        const diffDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);

        if (diffDays === 1) {
          currentStreak++;
        } else {
          if (currentStreak >= 5) {
            consistentArtists.push({
              artist,
              startDate: streakStart,
              length: currentStreak,
            });
          }
          currentStreak = 1;
          streakStart = daysArray[i];
        }

        // Check at the end of the loop
        if (i === daysArray.length - 1 && currentStreak >= 5) {
          consistentArtists.push({
            artist,
            startDate: streakStart,
            length: currentStreak,
          });
        }
      }
    });

    // Sort consistent artists by streak length and select the top N
    const sortedConsistentArtists = consistentArtists
      .sort((a, b) => b.length - a.length)
      .slice(0, TOP_CONSISTENT_ARTISTS); // Get top N consistent artists

    // Insight 9: Track Rotation
    const TOP_TRACK_ROTATIONS = 5; // Adjust this value to change the number of top tracks

    const trackRotation = [];

    const trackPlayDays = {};

    allStreamingData.forEach((entry) => {
      const trackName = entry.trackName || 'Unknown Track';
      const artistName = entry.artistName || 'Unknown Artist';
      const songWithArtist = `${trackName} (${artistName})`;
      const date = new Date(entry.endTime).toISOString().split('T')[0];

      if (!trackPlayDays[songWithArtist]) {
        trackPlayDays[songWithArtist] = {};
      }

      if (!trackPlayDays[songWithArtist][date]) {
        trackPlayDays[songWithArtist][date] = 0;
      }
      trackPlayDays[songWithArtist][date] += 1;
    });

    Object.entries(trackPlayDays).forEach(([song, days]) => {
      const dayDates = Object.keys(days).sort();
      let currentStreak = 1;
      let playCount = days[dayDates[0]];

      for (let i = 1; i < dayDates.length; i++) {
        const prevDate = new Date(dayDates[i - 1]);
        const currDate = new Date(dayDates[i]);
        const diffDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);

        if (diffDays === 1) {
          currentStreak++;
          playCount += days[dayDates[i]];
        } else {
          if (currentStreak >= 3 && playCount >= 5) {
            trackRotation.push({
              song,
              startDate: dayDates[i - currentStreak],
              length: currentStreak,
              playCount,
            });
          }
          currentStreak = 1;
          playCount = days[dayDates[i]];
        }

        // Check at the end of the loop
        if (i === dayDates.length - 1 && currentStreak >= 3 && playCount >= 5) {
          trackRotation.push({
            song,
            startDate: dayDates[i - currentStreak + 1],
            length: currentStreak,
            playCount,
          });
        }
      }
    });

    // Sort the track rotations by length of streak and play count
    const sortedTrackRotations = trackRotation.sort((a, b) => {
      if (b.length !== a.length) {
        return b.length - a.length; // First, sort by streak length
      } else {
        return b.playCount - a.playCount; // If streak lengths are equal, sort by play count
      }
    });

    // Take the top N track rotations
    const topTrackRotations = sortedTrackRotations.slice(0, TOP_TRACK_ROTATIONS);

    // Insight 10: Track Skipping Frequency
    const TOP_SKIPPED_TRACKS = 5; // Adjust this value to change the number of top skipped tracks

    const skippedTracks = {};

    allStreamingData.forEach((entry) => {
      if (entry.msPlayed < 30 * 1000) {
        const trackName = entry.trackName || 'Unknown Track';
        const artistName = entry.artistName || 'Unknown Artist';

        // Skip if 'Unknown' is in track or artist name
        if (trackName.includes('Unknown') || artistName.includes('Unknown')) {
          return;
        }

        const songWithArtist = `${trackName} (${artistName})`;

        if (!skippedTracks[songWithArtist]) {
          skippedTracks[songWithArtist] = 0;
        }
        skippedTracks[songWithArtist] += 1;
      }
    });

    // Convert to array, sort, and limit to top N
    const frequentlySkippedTracks = Object.entries(skippedTracks)
      .sort((a, b) => b[1] - a[1]) // Sort by skip count descending
      .slice(0, TOP_SKIPPED_TRACKS) // Take the top N skipped tracks
      .map(([song, skipCount]) => ({
        song,
        skipCount,
      }));

    // Implementing Most Skipped Track
    const mostSkippedTrack =
      frequentlySkippedTracks.length > 0 ? frequentlySkippedTracks[0] : null;

    // Insight 11: Music Diversity
    const uniqueArtistsSet = new Set();
    const uniqueTracksSet = new Set();

    allStreamingData.forEach((entry) => {
      const artistName = entry.artistName || 'Unknown Artist';
      const trackName = entry.trackName || 'Unknown Track';
      uniqueArtistsSet.add(artistName);
      uniqueTracksSet.add(`${trackName} (${artistName})`);
    });

    const totalPlays = allStreamingData.length;
    const diversity = {
      uniqueArtists: uniqueArtistsSet.size,
      uniqueTracks: uniqueTracksSet.size,
      totalPlays,
      artistDiversityRatio: (uniqueArtistsSet.size / totalPlays).toFixed(2),
      trackDiversityRatio: (uniqueTracksSet.size / totalPlays).toFixed(2),
    };

    // Insight 12: Highlights on Holidays
    // List of holidays with their dates (adjust dates for variable holidays)
    const holidays = [
      { name: "New Year’s Day", date: "01-01" },
      { name: "Valentine’s Day", date: "02-14" },
      { name: "St. Patrick’s Day", date: "03-17" },
      { name: "Cinco de Mayo", date: "05-05" },
      { name: "Mother's Day", date: "05-12"},
      { name: "Father's Day", date: "06-15"},
      { name: "Independence Day", date: "07-04" },
      { name: "Halloween", date: "10-31" },
      { name: "Veterans Day", date: "11-11" },
      { name: "Christmas Day", date: "12-25" },
      { name: "New Year's Eve", date: "12-31" },
      // Add other fixed-date holidays as needed
    ];

    const holidayPlays = {};

    allStreamingData.forEach((entry) => {
      const endTime = new Date(entry.endTime);
      const dateStr = endTime.toISOString().split('T')[0]; // YYYY-MM-DD
      const monthDay = dateStr.substring(5); // MM-DD

      holidays.forEach((holiday) => {
        if (holiday.date === monthDay) {
          if (!holidayPlays[holiday.name]) {
            holidayPlays[holiday.name] = [];
          }
          holidayPlays[holiday.name].push(entry);
        }
      });
    });

    // Format the holiday plays
    const holidayHighlights = Object.entries(holidayPlays).map(
      ([holidayName, plays]) => {
        // Get top tracks played on the holiday based on total playtime
        const trackPlaytime = {};

        plays.forEach((entry) => {
          const trackName = entry.trackName || 'Unknown Track';
          const artistName = entry.artistName || 'Unknown Artist';

          // Skip if 'Unknown' is in track or artist name
          if (trackName.includes('Unknown') || artistName.includes('Unknown')) {
            return;
          }

          const songWithArtist = `${trackName} (${artistName})`;

          if (!trackPlaytime[songWithArtist]) {
            trackPlaytime[songWithArtist] = 0;
          }
          trackPlaytime[songWithArtist] += entry.msPlayed;
        });

        const topTracks = Object.entries(trackPlaytime)
          .sort((a, b) => b[1] - a[1]) // Sort by total playtime descending
          .slice(0, 5) // Get top 5 tracks
          .map(([song, totalPlaytime]) => ({
            song,
            totalPlaytimeMs: totalPlaytime,
            totalPlaytime: msToReadableTime(totalPlaytime),
          }));

        return {
          holiday: holidayName,
          date: plays[0].endTime.split('T')[0],
          topTracks,
        };
      }
    );

    // Assemble the insights into a single object
    const spotifyWrapped = {
      topSongs,
      topArtists,
      topGenres,
      topDaysOfWeek,
      topTimesOfDay,
      topHours,
      averageSessionLength: {
        averageSessionLengthMs,
        averageSessionLength,
      },
      longestSessions,
      shortestSessions,
      averageWeeklyPlaytime: {
        averageWeeklyPlaytimeMs,
        averageWeeklyPlaytime,
      },
      averageMonthlyPlaytime: {
        averageMonthlyPlaytimeMs,
        averageMonthlyPlaytime,
      },
      topContentPerMonth,
      longestListeningStreak,
      consistentArtists: sortedConsistentArtists,
      topTrackRotations,
      frequentlySkippedTracks,
      mostSkippedTrack,
      diversity,
      holidayHighlights,
    };

    // Save the spotifyWrapped object to a JSON file
    fs.writeFileSync(
      path.join(__dirname, 'spotify_wrapped.json'),
      JSON.stringify(spotifyWrapped, null, 2)
    );
    console.log('Spotify Wrapped insights saved to spotify_wrapped.json');

    // --- End of Spotify Wrapped Insights Processing ---

    // Send the response
    res.json({
      message: 'File uploaded and processed successfully',
      cumulativePlaytime: cumulativeByInterval,
      topSongsByInterval,
      artistsByGenre: genresList, // Include the new data in the response
    });
  } catch (err) {
    console.error('Error during processing:', err);
    res.status(500).json({ error: 'Error processing the file.' });
  }
  await clearUploadsFolder();
});

async function getArtistProfile(artistId) {
  const token = await getSpotifyToken();
  const url = `https://api.spotify.com/v1/artists/${artistId}`;
  
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Extract artist profile picture from the response
    const artistData = response.data;
    const artistImageUrl = artistData.images[0]?.url || null; // Check if image exists
    return artistImageUrl;
  } catch (error) {
    console.error('Error fetching artist profile:', error);
    throw new Error('Unable to fetch artist profile');
  }
}

async function getAlbumCover(albumId) {
  const token = await getSpotifyToken();
  const url = `https://api.spotify.com/v1/albums/${albumId}`;

  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Extract album cover image from the response
    const albumData = response.data;
    const albumCoverUrl = albumData.images[0]?.url || null; // Check if cover exists
    return albumCoverUrl;
  } catch (error) {
    console.error('Error fetching album cover:', error);
    throw new Error('Unable to fetch album cover');
  }
}

// Route to fetch artist profile picture
app.get('/artist/:id/profile', async (req, res) => {
  const artistId = req.params.id;
  
  try {
    const artistImageUrl = await getArtistProfile(artistId);
    if (!artistImageUrl) {
      return res.status(404).json({ message: 'Artist profile image not found' });
    }
    res.json({ imageUrl: artistImageUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch artist profile' });
  }
});

// Route to fetch album cover
app.get('/album/:id/cover', async (req, res) => {
  const albumId = req.params.id;
  
  try {
    const albumCoverUrl = await getAlbumCover(albumId);
    if (!albumCoverUrl) {
      return res.status(404).json({ message: 'Album cover not found' });
    }
    res.json({ coverUrl: albumCoverUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch album cover' });
  }
});


// Route to access spotify_wrapped.json
app.get('/spotify_wrapped', (req, res) => {
  const filePath = path.join(__dirname, 'spotify_wrapped.json');

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error('File not found:', filePath); // Log error
      return res.status(404).send('File not found');
    }

    res.sendFile(filePath);
  });
});

// Route to access spotify_wrapped.json
app.get('/sample_spotify_wrapped', (req, res) => {
  const filePath = path.join(__dirname, 'sample_spotify_wrapped.json');

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error('File not found:', filePath); // Log error
      return res.status(404).send('File not found');
    }

    res.sendFile(filePath);
  });
});

// Route to list uploaded files
app.get('/files', (req, res) => {
  fs.readdir('uploads/unzipped', (err, files) => {
    if (err) {
      return res.status(500).send('Unable to scan uploads directory.');
    }
    const fileList = files.map((file) => {
      const filePath = path.join('uploads/unzipped', file);
      const stat = fs.statSync(filePath);
      return {
        filename: file,
        size: stat.size,
        uploadedAt: stat.mtime,
      };
    });
    res.json(fileList);
  });
});

// Route to the barchart file
app.get('/cumulative_for_barchart', (req, res) => {
  const filePath = path.join(__dirname, 'cumulative_for_barchart.json');

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error('File not found:', filePath); // Log error
      return res.status(404).send('File not found');
    }

    res.sendFile(filePath);
  });
});

// Route to the sample barchart file
app.get('/sample_cumulative_for_barchart', (req, res) => {
  const filePath = path.join(__dirname, 'sample_cumulative_for_barchart.json');

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error('File not found:', filePath); // Log error
      return res.status(404).send('File not found');
    }

    res.sendFile(filePath);
  });
});

// Route to the non-cumulative songs
app.get('/non_cumulative_songs', (req, res) => {
  const filePath = path.join(__dirname, 'non_cumulative_songs.json');

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error('File not found:', filePath); // Log error
      return res.status(404).send('File not found');
    }

    res.sendFile(filePath);
  });
});

// Route to the sample non-cumulative songs
app.get('/sample_non_cumulative_songs', (req, res) => {
  const filePath = path.join(__dirname, 'sample_non_cumulative_songs.json');

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error('File not found:', filePath); // Log error
      return res.status(404).send('File not found');
    }

    res.sendFile(filePath);
  });
});

// Route to the artist by genre
app.get('/artists_by_genre', (req, res) => {
  const filePath = path.join(__dirname, 'artists_by_genre.json');

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error('File not found:', filePath); // Log error
      return res.status(404).send('File not found');
    }

    res.sendFile(filePath);
  });
});

// Route to the sample artist by genre
app.get('/sample_artists_by_genre', (req, res) => {
  const filePath = path.join(__dirname, 'sample_artists_by_genre.json');

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error('File not found:', filePath); // Log error
      return res.status(404).send('File not found');
    }

    res.sendFile(filePath);
  });
});

// API route to provide token to frontend
app.get('/spotify_token', async (req, res) => {
  try {
    const token = await getSpotifyToken();
    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve token' });
  }
});

// Route to access uploaded files
app.get('/uploads/:filename', (req, res) => {
  const filepath = path.join(__dirname, 'uploads', req.params.filename);
  res.download(filepath);
});

// Start the server
const PORT = process.env.PORT || 8888;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
