<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Your Spotify Wrapped</title>
  <!-- Include Chart.js library -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    /* CSS styles */
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      overflow-x: hidden;
      background-color: #222;
      color: white;
      font-family: Arial, sans-serif;
    }
    #topGenresChart {
      width: 90% !important; /* Adjust the width to make it smaller */
      height: auto !important; /* Keep height auto for responsiveness */
    }
    #topDaysChart, #topTimesChart {
      width: 80% !important; /* Adjust the width to make both charts smaller */
      height: auto !important; /* Keep height auto for responsiveness */
    }
    #container {
      overflow-x: hidden;
      position: relative;
    }
    #content {
      display: flex;
      flex-direction: row;
      transition: transform 0.5s ease-in-out;
    }
    .section {
      flex: 0 0 100vw;
      width: 100vw;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: flex-start;
      overflow-y: auto;
      padding: 10px 20px;
      box-sizing: border-box;
    }
    /* Ensure Headings are Left-Aligned */
    h1, h2, h3 {
      color: #1DB954;
      margin: 10px 0;
      /* Ensure text-align is not set to center */
    }
    .chart-container {
      position: relative;
      width: 100%;
      max-width: 800px;
      margin: 0 0 20px 0;
      display: flex;
      justify-content: flex-start;
      align-items: center;
    }
    .chart-container canvas {
      width: 100% !important;
      height: auto !important;
    }
    .card-container {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-start;
      margin-top: 10px;
    }
    .card {
      background-color: #333;
      border-radius: 10px;
      overflow: hidden;
      margin: 10px;
      width: 200px;
      box-sizing: border-box;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
      transition: transform 0.2s;
    }
    .card:hover {
      transform: scale(1.05);
    }
    .card img {
      width: 100%;
      height: auto;
      display: block;
    }
    .card-info {
      padding: 15px;
      text-align: center;
    }
    .card-info h3 {
      margin: 10px 0 5px;
      font-size: 1.1em;
      color: #1DB954;
    }
    p {
      margin: 10px 0;
      text-align: left;
    }
    .card-info p {
      margin: 5px 0;
      font-size: 0.9em;
    }
    /* Adjusted Padded Section */
    .padded-section {
      padding: 20px;
      box-sizing: border-box;
      max-width: 100%;
    }
    /* Adjusted Calendar Styles */
    .calendar {
      display: grid;
      grid-template-columns: repeat(3, 1fr); /* Set to 4 columns */
      gap: 20px;
      max-width: 60%;
      margin: 20px 0;
      padding: 0 20px;
      box-sizing: border-box;
    }
    #holidayInfo {
      list-style-type: disc;
      margin-top: 20px;
      margin: 5px 0;
      padding: 10px;
      padding-left: 20px;
      background-color: #333;
      border-radius: 10px;
      color: #fff; /* Change text color for better contrast */
    }
    .holiday-tracks {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-start;
    }
    .holiday-track {
      background-color: #444;
      border-radius: 8px;
      padding: 15px;
      margin: 10px;
      width: calc(50% - 40px);
      box-sizing: border-box;
      display: flex;
      align-items: center;
    }
    .holiday-track img {
      width: 60px;
      height: 60px;
      border-radius: 4px;
      margin-right: 15px;
    }
    .holiday-track h4 {
      margin: 0 0 5px;
      color: #1DB954;
    }
    .holiday-track p {
      margin: 5px 0;
    }
    .month-box {
      background-color: #333;
      padding: 20px;
      border-radius: 10px;
      color: #1DB954;
      text-align: left; /* Align text to the left */
    }
    .nav-arrows-and-dots {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      z-index: 1001;
      max-width: 100%;
    }
    .nav-arrow {
      background-color: rgba(0, 0, 0, 0);
      border: none;
      color: white;
      font-size: 2em;
      padding: 0px;
      cursor: pointer;
    }
    .nav-dots {
      display: flex;
      margin: 0 20px;
    }
    .nav-dots button {
      background-color: #555;
      border: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin: 5px;
      cursor: pointer;
    }
    .nav-dots button.active {
      background-color: #1DB954;
    }
    /* Hide arrows when inactive */
    .nav-arrow.disabled {
      display: none;
    }
    /* Lists and Paragraphs */
    ol, ul {
      list-style-position: inside;
      padding-left: 20px;
      margin: 10px 0;
      text-align: left;
    }
  </style>
</head>
<body>

  <!-- Container for the horizontal scrolling content -->
  <div id="container">
    <div id="content">
      <!-- Sections will be added dynamically -->
    </div>
  </div>

  <!-- Navigation Arrows and Dots -->
  <div class="nav-arrows-and-dots">
    <button class="nav-arrow left disabled" id="prevBtn">&#10094;</button>
    <div class="nav-dots" id="navDots">
      <!-- Buttons will be added dynamically -->
    </div>
    <button class="nav-arrow right" id="nextBtn">&#10095;</button>
  </div>

  <!-- Include the JavaScript code -->
  <script>
    // Function to format milliseconds to a readable time
    function msToReadableTime(ms) {
      const minutes = ms / 60000;
      if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return `${hours} hr ${mins} min`;
      } else {
        return `${Math.round(minutes)} min`;
      }
    }

    async function getSpotifyToken() {
      try {
        const response = await fetch('http://localhost:8888/spotify_token');
        const data = await response.json();
        return data.token;
      } catch (error) {
        console.error('Error fetching Spotify token:', error);
        return null;
      }
    }

    let spotifyData; // Declare a global variable

    // Function to load data and create charts
    function loadDataAndCreateCharts() {
      // First try to fetch the user data (Spotify Wrapped)
      fetch("http://localhost:8888/spotify_wrapped")
        .then(response => {
          if (!response.ok) {
            throw new Error('Spotify Wrapped data not found, falling back to sample data.');
          }
          return response.json(); // Parse the user data if available
        })
        .then(data => {
          // Assign the data to the global spotifyData variable
          spotifyData = data; 
          console.log("Spotify Data Loaded:", spotifyData); // Log the data for debugging

          // Process the data and create the Spotify Wrapped display
          createWrappedDisplay(spotifyData);
        })
        .catch(() => {
          // If fetching user data fails, fetch the sample data from the provided endpoint
          console.warn("Spotify Wrapped data not available, loading sample data.");
          fetch("http://localhost:8888/sample_spotify_wrapped")
            .then(response => {
              if (!response.ok) {
                throw new Error('Sample Spotify Wrapped data not found.');
              }
              return response.json();
            })
            .then(sampleData => {
              // Assign the sample data to the global spotifyData variable
              spotifyData = sampleData; 
              console.log("Sample Spotify Data Loaded:", spotifyData); // Log the data for debugging

              // Process the sample data and create the Spotify Wrapped display
              createWrappedDisplay(spotifyData);
            })
            .catch(error => {
              console.error("Error loading sample data:", error);
            });
        });
    }


    function showHolidayTracks() {
      const selectedHoliday = document.getElementById('holidaySelect').value;
      const holidayInfoDiv = document.getElementById('holidayInfo');

      console.log("Selected holiday:", selectedHoliday); // Add this line to verify that the holiday is being selected

      // Ensure spotifyData is loaded and contains holidayHighlights
      if (!spotifyData || !spotifyData.holidayHighlights || spotifyData.holidayHighlights.length === 0) {
        console.error("Spotify data or holiday highlights are not available.");
        holidayInfoDiv.innerHTML = "No holiday highlights available."; // Show a message if holiday highlights are unavailable
        return;
      }

      const holiday = spotifyData.holidayHighlights.find(h => h.holiday === selectedHoliday);
      console.log("Found holiday data:", holiday); // Add this line to verify that the selected holiday is found

      if (holiday && holiday.topTracks && holiday.topTracks.length > 0) {
        let trackListHTML = '<ul>';

        holiday.topTracks.forEach(track => {
          const songWithArtist = track.song;
          let songTitle = songWithArtist;
          let artistName = '';

          const artistStartIndex = songWithArtist.lastIndexOf('(');
          const artistEndIndex = songWithArtist.lastIndexOf(')');

          if (artistStartIndex !== -1 && artistEndIndex !== -1 && artistEndIndex > artistStartIndex) {
            songTitle = songWithArtist.substring(0, artistStartIndex).trim();
            artistName = songWithArtist.substring(artistStartIndex + 1, artistEndIndex).trim();
          }

          const playtime = track.totalPlaytime;

          trackListHTML += `<li>${songTitle}${artistName ? ' by ' + artistName : ''} - ${playtime}</li>`;
        });

        trackListHTML += '</ul>';
        holidayInfoDiv.innerHTML = trackListHTML;
      } else {
        holidayInfoDiv.innerHTML = "No tracks found for the selected holiday."; // Fallback message
      }
    }

    async function searchArtist(artistName, token) {
      try {
        const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const data = await response.json();
        return data.artists.items[0]?.images[0]?.url || null;
      } catch (error) {
        console.error(`Error fetching artist ${artistName}:`, error);
        return null;
      }
    }

    async function searchTrack(trackName, artistName, token) {
      try {
        const query = `${trackName} ${artistName}`;
        const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const data = await response.json();
        return data.tracks.items[0]?.album?.images[0]?.url || null;
      } catch (error) {
        console.error(`Error fetching track ${trackName} by ${artistName}:`, error);
        return null;
      }
    }

    // Function to create the display of the wrapped data
    async function createWrappedDisplay(data) {
      const token = await getSpotifyToken();
      if (!token) {
        console.error('Spotify token is not available.');
        return;
      }
      const contentDiv = document.getElementById('content');
      const navDots = document.getElementById('navDots');
      const sections = [];
      let currentIndex = 0; // Initialize currentIndex

      // Helper function to create a section
      function createSection(content) {
        const section = document.createElement('div');
        section.className = 'section';
        section.innerHTML = content;
        contentDiv.appendChild(section);
        sections.push(section);

        // Create a navigation dot
        const dot = document.createElement('button');
        dot.addEventListener('click', () => {
          currentIndex = sections.indexOf(section);
          updateSection();
        });
        navDots.appendChild(dot);
      }

      // 1. Top 5 Songs of All Time
      createSection(`
        <h2>Top 5 Songs of The Year</h2>
        <div id="topSongsCards" class="card-container"></div>
        <div class="chart-container">
          <canvas id="topSongsChart"></canvas>
        </div>
      `);

      // Prepare data for Top Songs chart
      const topSongsLabels = data.topSongs.map(song => song.name);
      const topSongsData = data.topSongs.map(song => parseFloat(song.playtime.split(' ')[0]));

      // Fetch and display album images and info in cards
      const topSongsCardsDiv = document.getElementById('topSongsCards');
      for (const song of data.topSongs) {
        const albumImageUrl = await searchTrack(song.name, song.artistName, token);
        const card = document.createElement('div');
        card.className = 'card';

        const img = document.createElement('img');
        img.src = albumImageUrl || 'default_album_cover.jpg'; // Use a default image if none found
        img.alt = `${song.name} Album Cover`;

        const infoDiv = document.createElement('div');
        infoDiv.className = 'card-info';

        const songName = document.createElement('h3');
        songName.textContent = song.name;

        const artistName = document.createElement('p');
        artistName.textContent = song.artistName;

        const playtime = document.createElement('p');
        playtime.textContent = `Playtime: ${song.playtime}`;

        infoDiv.appendChild(songName);
        infoDiv.appendChild(artistName);
        infoDiv.appendChild(playtime);

        card.appendChild(img);
        card.appendChild(infoDiv);

        topSongsCardsDiv.appendChild(card);
      }

      // 2. Top Artists
      createSection(`
        <h2>Top Artists</h2>
        <div id="topArtistsCards" class="card-container"></div>
        <div class="chart-container">
          <canvas id="topArtistsChart"></canvas>
        </div>
      `);


      // Prepare data for Top Artists chart
      const topArtistsLabels = data.topArtists.map(artist => artist.name);
      const topArtistsData = data.topArtists.map(artist => parseFloat(artist.playtime.split(' ')[0]));

      // Fetch and display artist images and info in cards
      const topArtistsCardsDiv = document.getElementById('topArtistsCards');
      for (const artist of data.topArtists) {
        const artistImageUrl = await searchArtist(artist.name, token);
        const card = document.createElement('div');
        card.className = 'card';

        const img = document.createElement('img');
        img.src = artistImageUrl || 'default_artist_image.jpg'; // Use a default image if none found
        img.alt = `${artist.name} Image`;

        const infoDiv = document.createElement('div');
        infoDiv.className = 'card-info';

        const artistName = document.createElement('h3');
        artistName.textContent = artist.name;

        const playtime = document.createElement('p');
        playtime.textContent = `Playtime: ${artist.playtime}`;

        infoDiv.appendChild(artistName);
        infoDiv.appendChild(playtime);

        card.appendChild(img);
        card.appendChild(infoDiv);

        topArtistsCardsDiv.appendChild(card);
      }

      // 3. Top Genres
      createSection(`
        <h2>Top Genres</h2>
        <div class="chart-container">
          <canvas id="topGenresChart"></canvas>
        </div>
      `);

      // Prepare data for Top Genres chart
      const topGenresLabels = data.topGenres.map(genre => genre.genre);
      const topGenresData = data.topGenres.map(genre => parseFloat(genre.playtime.split(' ')[0]));

      // Create Top Genres doughnut chart
      new Chart(document.getElementById('topGenresChart'), {
        type: 'doughnut',
        data: {
          labels: topGenresLabels,
          datasets: [{
            data: topGenresData,
            backgroundColor: ['#1DB954', '#1ED760', '#53D387', '#7DDEA9', '#A8E9C8'],
          }]
        },
        options: {
          plugins: {
            legend: { position: 'bottom' }
          }
        }
      });

      // 4. Listening Habits (Top Days and Times)
      createSection(`
        <h2>Listening Habits</h2>
        <div class="chart-container">
          <canvas id="topDaysChart"></canvas>
        </div>
        <div class="chart-container">
          <canvas id="topTimesChart"></canvas>
        </div>
      `);

      // Top Days of the Week
      const topDaysLabels = data.topDaysOfWeek.map(day => day.day);
      const topDaysData = data.topDaysOfWeek.map(day => parseFloat(day.playtime.split(' ')[0]));

      // Create Top Days bar chart
      new Chart(document.getElementById('topDaysChart'), {
        type: 'bar',
        data: {
          labels: topDaysLabels,
          datasets: [{
            label: 'Hours Listened',
            data: topDaysData,
            backgroundColor: '#1DB954',
          }]
        },
        options: {
          scales: {
            y: { beginAtZero: true }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });

      // Top Times of Day
      const topTimesLabels = data.topTimesOfDay.map(time => time.timeOfDay);
      const topTimesData = data.topTimesOfDay.map(time => parseFloat(time.playtime.split(' ')[0]));

      // Create Top Times bar chart
      new Chart(document.getElementById('topTimesChart'), {
        type: 'bar',
        data: {
          labels: topTimesLabels,
          datasets: [{
            label: 'Hours Listened',
            data: topTimesData,
            backgroundColor: '#1DB954',
          }]
        },
        options: {
          scales: {
            y: { beginAtZero: true }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });

      // 5. Combined Top Listening Hours, Listening Sessions, Listening Streaks, and Total Listening Time
      createSection(`
        <h2>Top Listening Hours & Sessions</h2>
        <div class="chart-container">
          <canvas id="topHoursChart"></canvas>
        </div>
        <p><strong>Average Session Length:</strong> ${data.averageSessionLength.averageSessionLength}</p>
        <p><strong>Longest Listening Session:</strong> ${data.longestSessions[0].playtime} (${data.longestSessions[0].startTime} to ${data.longestSessions[0].endTime})</p>
        <p><strong>Average Weekly Playtime:</strong> ${data.averageWeeklyPlaytime.averageWeeklyPlaytime}</p>
        <p><strong>Average Monthly Playtime:</strong> ${data.averageMonthlyPlaytime.averageMonthlyPlaytime}</p>
        <p><strong>Longest Listening Streak:</strong> ${data.longestListeningStreak.length} days starting from ${data.longestListeningStreak.start}</p>
      `);

      // Create ordered labels from 12 AM to 11 PM
      const topHoursLabels = [
        "12 AM", "1 AM", "2 AM", "3 AM", "4 AM", "5 AM", "6 AM", "7 AM", "8 AM", "9 AM", "10 AM", "11 AM",
        "12 PM", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM", "8 PM", "9 PM", "10 PM", "11 PM"
      ];

      // Initialize the data array with zeros
      const topHoursData = Array(24).fill(0);

      // Populate the data based on the hour (in 24-hour format)
      data.topHours.forEach(hourEntry => {
        const hour = parseInt(hourEntry.hour); // Get the hour in 24-hour format
        topHoursData[hour] = parseFloat(hourEntry.playtime.split(' ')[0]); // Set the playtime for that hour
      });

      // Create Top Hours line chart
      new Chart(document.getElementById('topHoursChart'), {
        type: 'line',
        data: {
          labels: topHoursLabels,
          datasets: [{
            label: 'Hours Listened',
            data: topHoursData,
            backgroundColor: '#1DB954',
            borderColor: '#1DB954',
            fill: false,
          }]
        },
        options: {
          scales: {
            y: { beginAtZero: true }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });

      // 6. Top Listening Content per Month (Calendar Style)
      let calendarHTML = '<h2>Top Listening Content per Month</h2><div class="calendar">';

      // Month names array to convert month numbers (01, 02, etc.) to month names
      const monthNames = {
        "01": "January", "02": "February", "03": "March", "04": "April",
        "05": "May", "06": "June", "07": "July", "08": "August",
        "09": "September", "10": "October", "11": "November", "12": "December"
      };

      // Loop through the topContentPerMonth object
      Object.keys(data.topContentPerMonth).forEach((key) => {
        // Extract the year and month from the key (e.g., "2024-09")
        const [year, month] = key.split("-");

        // Get the month name from the monthNames array
        const monthName = monthNames[month];

        // Get the content for that month
        const content = data.topContentPerMonth[key];

        // Add the formatted month and year with the content name and playtime
        calendarHTML += `
          <div class="month-box">
            <strong>${monthName} ${year}:</strong><br>${content.name} - ${content.playtime}
          </div>`;
      });

      calendarHTML += '</div>';
      createSection(calendarHTML);

      // 7. Combined Track Rotation, Track Skipping, and Music Diversity
      let combinedHTML = `
      <div class="padded-section">
        <h2>Track Rotation, Track Skipping, and Music Diversity</h2>
        <h3>Track Rotation</h3>
        <ol>`;
      data.topTrackRotations.forEach(track => {
        combinedHTML += `<li>${track.song} - Played ${track.playCount} times over ${track.length} days starting from ${track.startDate}</li>`;
      });
      combinedHTML += `</ol>
        <h3>Track Skipping Frequency</h3>
        <ol>`;
      data.frequentlySkippedTracks.forEach(track => {
        combinedHTML += `<li>${track.song} - Skipped ${track.skipCount} times</li>`;
      });
      combinedHTML += `</ol>
        <p><strong>Most Skipped Track:</strong> ${data.mostSkippedTrack.song} - Skipped ${data.mostSkippedTrack.skipCount} times</p>
        <p><strong>Music Diversity:</strong> ${data.diversity.uniqueArtists} unique artists,
        ${data.diversity.uniqueTracks} unique tracks, ${data.diversity.totalPlays} total plays
        (Artist Ratio: ${data.diversity.artistDiversityRatio}, Track Ratio: ${data.diversity.trackDiversityRatio})</p>
      </div>`;

      createSection(combinedHTML);

      // 8. Holiday Highlights
      let holidayHTML = `
        <h2>Holiday Highlights</h2>
        <label for="holidaySelect">Select a Holiday:</label>
        <select id="holidaySelect" onchange="showHolidayTracks()">
          <option value="">-- Select a Holiday --</option>`;

      data.holidayHighlights.forEach(holiday => {
        holidayHTML += `<option value="${holiday.holiday}">${holiday.holiday}</option>`;
      });

      holidayHTML += `</select>
        <div id="holidayInfo"></div>`;

      createSection(holidayHTML);

      // Adjust content width based on number of sections
      contentDiv.style.width = `calc(100vw * ${sections.length})`;

      // Initialize navigation dots
      updateNavDots();

      // Navigation Buttons
      const prevBtn = document.getElementById('prevBtn');
      const nextBtn = document.getElementById('nextBtn');

      prevBtn.addEventListener('click', () => {
        if (currentIndex > 0) {
          currentIndex--; // Move to the previous section
          updateSection();
        }
      });

      nextBtn.addEventListener('click', () => {
        if (currentIndex < sections.length - 1) {
          currentIndex++; // Move to the next section
          updateSection();
        }
      });

      function updateSection() {
        // Move the content container to show the correct section
        contentDiv.style.transform = `translateX(-${currentIndex * 100}vw)`;
        updateNavDots(); // Update the navigation dots
        updateArrowVisibility(); // Update the visibility of arrows based on currentIndex
      }

      function updateArrowVisibility() {
        // Update the visibility of the arrows based on the current section
        prevBtn.classList.toggle('disabled', currentIndex === 0); // Disable if at the first section
        nextBtn.classList.toggle('disabled', currentIndex === sections.length - 1); // Disable if at the last section
      }

      function updateNavDots() {
        // Update active state for navigation dots
        const dots = navDots.querySelectorAll('button');
        dots.forEach((dot, index) => {
          dot.classList.toggle('active', index === currentIndex); // Set the current section's dot to active
        });
      }

      // Initially set the visibility of the arrows
      updateArrowVisibility();
    }

    // Call the function to load data and create charts
    loadDataAndCreateCharts();
  </script>
</body>
</html>
