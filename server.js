import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import unzipper from 'unzipper';  // Add unzipper for unzipping .zip files

dotenv.config(); // Load environment variables

const app = express();
app.use(cors()); // Enable CORS

// Define __dirname in ES module scope
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const currentDate = new Date().toISOString().replace(/:/g, '-');  // Use current date in file name
    const uniqueSuffix = currentDate + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Serve the uploads folder statically
app.use('/uploads', express.static('uploads'));

// Root route to handle "/"
app.get('/', (req, res) => {
  res.send('Welcome to the Spotify API!');
});

// Token route to get Spotify token
app.get('/token', async (req, res) => {
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('CLIENT_ID or CLIENT_SECRET is missing');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const result = await axios.post('https://accounts.spotify.com/api/token', 'grant_type=client_credentials', {
      headers: { Authorization: `Basic ${authString}` }
    });
    res.json(result.data); // Send back token data
  } catch (error) {
    console.error('Error fetching token:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Error retrieving Spotify token' });
  }
});

// Function to clear the unzipped folder before unzipping a new file
function clearUnzippedFolder(callback) {
  const unzippedDir = path.join(__dirname, 'uploads/unzipped');

  fs.rm(unzippedDir, { recursive: true, force: true }, (err) => {
    if (err) {
      console.error('Error deleting unzipped directory:', err);
      return;
    }

    // Recreate the unzipped directory after deletion
    fs.mkdir(unzippedDir, (err) => {
      if (err) {
        console.error('Error recreating unzipped directory:', err);
      } else {
        console.log('Unzipped directory cleared and recreated.');
        callback(); // Proceed with unzipping
      }
    });
  });
}

// Function to recursively filter out files starting with "StreamingHistory_music_"
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
      } else if (/^StreamingHistory_music_\d+\.json$/.test(file)) {
        console.log('File matches:', file);
        relevantFiles.push(fullPath);  // Save the full path of the file
      }
    });
  }

  searchDirectory(directoryPath);

  return relevantFiles;
}

// File upload route with unzipping logic
app.post('/upload', upload.single('datafile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  console.log('File uploaded:', req.file);

  const zipFilePath = path.join(__dirname, 'uploads', req.file.filename);
  const unzipPath = path.join(__dirname, 'uploads/unzipped');

  // Clear the unzipped folder and then proceed with unzipping
  clearUnzippedFolder(() => {
    // Unzip the file to the 'uploads/unzipped' folder
    fs.createReadStream(zipFilePath)
      .pipe(unzipper.Extract({ path: unzipPath }))
      .on('close', () => {
        console.log('Unzipping complete');
        
        // Filter out "StreamingHistory_music_" files, now recursively
        const streamingHistoryFiles = filterStreamingHistoryFiles(unzipPath); 

        if (streamingHistoryFiles.length === 0) {
          console.log('No StreamingHistory_music_ files found.');
          return res.json({
            message: 'File uploaded and unzipped successfully, but no StreamingHistory_music_ files were found.',
            streamingHistoryFiles: []
          });
        }

        // --- BLOCK 1: You can process the `streamingHistoryFiles` here ---
        // At this point, `streamingHistoryFiles` contains the paths to the
        // StreamingHistory_music_*.json files. You can read and process them.

        // --- Your data processing code goes here ---
        // Example: Read the content of each file, and aggregate the data.
        // --- BLOCK 1: Reading the contents of the files ---
        streamingHistoryFiles.forEach((filePath) => {
          try {
            // Read the file content
            const fileContents = fs.readFileSync(filePath, 'utf8');
            
            // Parse the JSON content
            const jsonData = JSON.parse(fileContents);
            
            // Log the contents to the console
            console.log(`Contents of ${filePath}:`, jsonData);
          } catch (err) {
            console.error(`Error reading or parsing ${filePath}:`, err);
          }
        });

        // - Read and parse JSON
        // - Perform operations like aggregating 3-day playtime totals
        // - Prepare data for your bar chart race

        res.json({
          message: 'File uploaded and unzipped successfully',
          streamingHistoryFiles: streamingHistoryFiles
        });
      })
      .on('error', (err) => {
        console.error('Error during unzipping:', err);
        res.status(500).json({ error: 'Error unzipping the file.' });
      });
  });
});

// Route to list uploaded files
app.get('/files', (req, res) => {
  fs.readdir('uploads/unzipped', (err, files) => {
    if (err) {
      return res.status(500).send('Unable to scan uploads directory.');
    }
    const fileList = files.map(file => {
      const filePath = path.join('uploads/unzipped', file);
      const stat = fs.statSync(filePath);
      return {
        filename: file,
        size: stat.size,
        uploadedAt: stat.mtime
      };
    });
    res.json(fileList);
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
