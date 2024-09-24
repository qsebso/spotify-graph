---
toc: false
---

<div class="hero">
  <h1>Spotify Project</h1>
  <h2>This visualizer will automatically show all albums by the artist Glaive.</h2>
</div>

<div id="albums-list" style="padding: 20px; background-color: #1e1e1e; color: #fff; border-radius: 10px; margin: 20px;">
  <h3>Fetching albums by Glaive...</h3>
  <ul id="album-list" style="list-style-type: none; padding: 0;"></ul>
</div>

<script>
  console.log("Script is running");

  let token;
  let tokenExpiryTime;

  function fetchToken() {
    return fetch('http://localhost:8888/token')
      .then(response => response.json())
      .then(data => {
        token = data.access_token;
        tokenExpiryTime = Date.now() + data.expires_in * 1000; // Set expiration time
        console.log('New Token:', token);
      });
  }

  // Step 1: Search for the artist 'Glaive' to get their artist ID
  async function getArtistID() {
    if (!token || Date.now() >= tokenExpiryTime) {
      await fetchToken();  // Fetch a new token if expired
    }
    return fetch(`https://api.spotify.com/v1/search?q=itzy&type=artist`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      const artist = data.artists.items[0];  // Get the first artist result
      console.log("Artist found:", artist.name, artist.id);
      return artist.id;
    })
    .catch(error => {
      console.error('Error fetching artist:', error);
      document.getElementById('albums-list').innerHTML = `<h3>Error fetching artist. Please try again later.</h3>`;
    });
  }

  // Step 2: Use the artist ID to fetch their albums
  async function getAlbumsByArtist(artistID) {
    console.log("Fetching albums for artist ID:", artistID);
    return fetch(`https://api.spotify.com/v1/artists/${artistID}/albums`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      const albumList = document.getElementById('album-list');
      albumList.innerHTML = ''; // Clear any existing data
      data.items.forEach((album, index) => {
        const listItem = document.createElement('li');
        listItem.innerHTML = `<strong>${index + 1}. ${album.name}</strong> (${album.release_date})`;
        albumList.appendChild(listItem);
      });
    })
    .catch(error => {
      console.error('Error fetching albums:', error);
      document.getElementById('albums-list').innerHTML = `<h3>Error fetching albums. Please try again later.</h3>`;
    });
  }

  // Fetch Glaive's albums when the page loads
  window.onload = async function() {
    const artistID = await getArtistID();
    if (artistID) {
      getAlbumsByArtist(artistID);
    }
  }
</script>

<style>
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  font-family: var(--sans-serif);
  margin: 4rem 0 8rem;
  text-wrap: balance;
  text-align: center;
}

.hero h1 {
  margin: 1rem 0;
  padding: 1rem 0;
  max-width: none;
  font-size: 14vw;
  font-weight: 900;
  line-height: 1;
  background: linear-gradient(30deg, var(--theme-foreground-focus), currentColor);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero h2 {
  margin: 0;
  max-width: 34em;
  font-size: 20px;
  font-style: initial;
  font-weight: 500;
  line-height: 1.5;
  color: var(--theme-foreground-muted);
}

@media (min-width: 640px) {
  .hero h1 {
    font-size: 90px;
  }
}

</style>
