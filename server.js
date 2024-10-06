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
const SNAPSHOT_DAYS = 3; // Modify this to control how many days are considered per non-cumulative snapshot

dotenv.config(); // Load environment variables

const app = express();
app.use(cors()); // Enable CORS
app.use(express.json());  // This allows the server to parse incoming JSON requests

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
    console.error('Error fetching Spotify token:', error.response ? error.response.data : error.message);
    throw new Error('Error retrieving Spotify token');
  }
}

app.post('/get_recommendations', async (req, res) => {
  const { genres, artists } = req.body;

  if (!genres && !artists) {
    return res.status(400).json({ error: 'Genres or artists are missing in the request' });
  }

  try {
    // Fetch Spotify access token
    const spotifyToken = await getSpotifyToken();

    // Fetch valid genres from Spotify
    const validGenresResponse = await axios.get('https://api.spotify.com/v1/recommendations/available-genre-seeds', {
      headers: {
        Authorization: `Bearer ${spotifyToken}`,
      },
    });
    const validGenres = validGenresResponse.data.genres;

    // Filter genres to only include valid seed genres
    const seedGenres = genres.filter(genre => validGenres.includes(genre.toLowerCase()));

    // Map artist names to Spotify IDs
    const seedArtists = [];
    for (const artistName of artists) {
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

      const artistItems = searchResponse.data.artists.items;
      if (artistItems.length > 0) {
        seedArtists.push(artistItems[0].id);
      }
    }

    // Limit the number of seed parameters to 5
    const totalSeeds = seedGenres.length + seedArtists.length;
    if (totalSeeds > 5) {
      // Adjust seeds to not exceed 5
      seedGenres.splice(5 - seedArtists.length);
    }

    // Call Spotify recommendations API
    const recommendationsResponse = await axios.get('https://api.spotify.com/v1/recommendations', {
      headers: {
        Authorization: `Bearer ${spotifyToken}`,
      },
      params: {
        seed_genres: seedGenres.join(','),
        seed_artists: seedArtists.join(','),
        limit: 10,
      },
    });

    // Extract relevant data
    const tracks = recommendationsResponse.data.tracks.map(track => ({
      artist: track.artists.map(artist => artist.name).join(', '),
      track: track.name,
      preview_url: track.preview_url,
    }));

    res.json(tracks);
  } catch (error) {
    console.error('Error fetching recommendations:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Error fetching recommendations' });
  }
});

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
          const intervalStart = getIntervalStart(endTime, SNAPSHOT_DAYS)
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
    const genresList = Object.keys(genreArtistsMap).map((genre) => ({
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
});

// Function to chunk an array into smaller arrays of a specified size
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

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

// Route to access uploaded files
app.get('/uploads/:filename', (req, res) => {
  const filepath = path.join(__dirname, 'uploads', req.params.filename);
  res.download(filepath);
});

// Start the server
const PORT = process.env.PORT || 8888;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
