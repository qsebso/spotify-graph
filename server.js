import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables

const app = express();

app.use(cors()); // Enable CORS

// Root route to handle "/"
app.get('/', (req, res) => {
  res.send('Welcome to the Spotify API!');
});

// Token route to get Spotify token
app.get('/token', async (req, res) => {
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;

  // Check if the client ID or secret is missing
  if (!clientId || !clientSecret) {
    console.error('CLIENT_ID or CLIENT_SECRET is missing');
    return res.status(500).send('Server configuration error');
  }

  const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const result = await axios.post('https://accounts.spotify.com/api/token', 'grant_type=client_credentials', {
      headers: { Authorization: `Basic ${authString}` }
    });
    res.json(result.data); // Send back token data
  } catch (error) {
    console.error('Error fetching token:', error.response ? error.response.data : error.message);
    res.status(500).send('Error retrieving Spotify token');
  }
});

// Start the server
const PORT = process.env.PORT || 8888; // Use environment port if provided
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
