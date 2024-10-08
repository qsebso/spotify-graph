<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Your Spotify Wrapped</title>
  <!-- Include Chart.js library -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    /* CSS styles */
    body {
      font-family: Arial, sans-serif;
      background-color: #222;
      color: white;
      margin: 0;
      padding: 20px;
      text-align: center;
    }
    h1, h2, h3 {
      color: #1DB954; /* Spotify Green */
    }
    .section {
      margin: 40px auto;
      max-width: 800px;
    }
    .chart-container {
      position: relative;
      margin: 0 auto;
      height: 400px;
      width: 80%;
    }
    ol, ul {
      list-style-position: inside;
      padding: 0;
      text-align: left;
    }
    li {
      margin: 5px 0;
    }
    /* Additional styles */
    button {
      background-color: #1DB954;
      border: none;
      color: white;
      padding: 10px 24px;
      text-align: center;
      font-size: 16px;
      margin: 20px 10px;
      cursor: pointer;
      border-radius: 5px;
    }
    /* Tooltip styling */
    .tooltip {
      position: absolute;
      background-color: lightsteelblue;
      color: black;
      padding: 5px;
      border-radius: 5px;
      font-size: 12px;
      pointer-events: none;
      visibility: hidden;
    }
  </style>
</head>
<body>
  <!-- Page Title -->
  <h1>Your Spotify Wrapped</h1>

  <!-- Container for the content -->
  <div id="content"></div>

  <!-- Tooltip for hover (if needed in future extensions) -->
  <div id="tooltip" class="tooltip"></div>

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

    // Function to load data and create the charts
    function loadDataAndCreateCharts() {
      fetch("http://localhost:8888/spotify_wrapped")
        .then(response => {
          if (!response.ok) {
            throw new Error('Spotify Wrapped data not found, falling back to sample data.');
          }
          return response.json();
        })
        .then(data => {
          createWrappedDisplay(data);
        })
        .catch(() => {
          fetch("sample_spotify_wrapped.json")
            .then(response => response.json())
            .then(sampleData => {
              createWrappedDisplay(sampleData);
            })
            .catch(error => {
              console.error("Error loading sample data:", error);
            });
        });
    }

    // Function to create the display of the wrapped data
    function createWrappedDisplay(data) {
      const contentDiv = document.getElementById('content');

      // 1. Top 5 Songs of All Time
      const topSongsDiv = document.createElement('div');
      topSongsDiv.className = 'section';
      topSongsDiv.innerHTML = '<h2>Top 5 Songs of All Time</h2>';
      const topSongsCanvas = document.createElement('canvas');
      topSongsCanvas.id = 'topSongsChart';
      topSongsDiv.appendChild(topSongsCanvas);
      contentDiv.appendChild(topSongsDiv);

      // Prepare data for Top Songs chart
      const topSongsLabels = data.topSongs.map(song => song.name);
      const topSongsData = data.topSongs.map(song => parseFloat(song.playtime.split(' ')[0]));

      // Create Top Songs bar chart
      new Chart(topSongsCanvas, {
        type: 'bar',
        data: {
          labels: topSongsLabels,
          datasets: [{
            label: 'Hours Listened',
            data: topSongsData,
            backgroundColor: '#1DB954',
          }]
        },
        options: {
          scales: {
            y: { beginAtZero: true }
          }
        }
      });

      // 2. Top Artists
      const topArtistsDiv = document.createElement('div');
      topArtistsDiv.className = 'section';
      topArtistsDiv.innerHTML = '<h2>Top Artists</h2>';
      const topArtistsCanvas = document.createElement('canvas');
      topArtistsCanvas.id = 'topArtistsChart';
      topArtistsDiv.appendChild(topArtistsCanvas);
      contentDiv.appendChild(topArtistsDiv);

      // Prepare data for Top Artists chart
      const topArtistsLabels = data.topArtists.map(artist => artist.name);
      const topArtistsData = data.topArtists.map(artist => parseFloat(artist.playtime.split(' ')[0]));

      // Create Top Artists pie chart
      new Chart(topArtistsCanvas, {
        type: 'pie',
        data: {
          labels: topArtistsLabels,
          datasets: [{
            data: topArtistsData,
            backgroundColor: ['#1DB954', '#1ED760', '#53D387', '#7DDEA9', '#A8E9C8'],
          }]
        },
        options: {
          plugins: {
            legend: { position: 'bottom' }
          }
        }
      });

      // 3. Top Genres
      const topGenresDiv = document.createElement('div');
      topGenresDiv.className = 'section';
      topGenresDiv.innerHTML = '<h2>Top Genres</h2>';
      const topGenresCanvas = document.createElement('canvas');
      topGenresCanvas.id = 'topGenresChart';
      topGenresDiv.appendChild(topGenresCanvas);
      contentDiv.appendChild(topGenresDiv);

      // Prepare data for Top Genres chart
      const topGenresLabels = data.topGenres.map(genre => genre.genre);
      const topGenresData = data.topGenres.map(genre => parseFloat(genre.playtime.split(' ')[0]));

      // Create Top Genres doughnut chart
      new Chart(topGenresCanvas, {
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

      // 4. Listening Habits
      const listeningHabitsDiv = document.createElement('div');
      listeningHabitsDiv.className = 'section';
      listeningHabitsDiv.innerHTML = '<h2>Listening Habits</h2>';

      // a. Top Days of the Week
      const topDaysCanvas = document.createElement('canvas');
      topDaysCanvas.id = 'topDaysChart';
      listeningHabitsDiv.appendChild(topDaysCanvas);

      const topDaysLabels = data.topDaysOfWeek.map(day => day.day);
      const topDaysData = data.topDaysOfWeek.map(day => parseFloat(day.playtime.split(' ')[0]));

      // Create Top Days bar chart
      new Chart(topDaysCanvas, {
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

      // b. Listening Time of Day
      const timeOfDayCanvas = document.createElement('canvas');
      timeOfDayCanvas.id = 'timeOfDayChart';
      listeningHabitsDiv.appendChild(timeOfDayCanvas);

      const timeOfDayLabels = data.topTimesOfDay.map(time => time.timeOfDay);
      const timeOfDayData = data.topTimesOfDay.map(time => parseFloat(time.playtime.split(' ')[0]));

      // Create Time of Day bar chart
      new Chart(timeOfDayCanvas, {
        type: 'bar',
        data: {
          labels: timeOfDayLabels,
          datasets: [{
            label: 'Hours Listened',
            data: timeOfDayData,
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

      contentDiv.appendChild(listeningHabitsDiv);

      // 5. Listening Sessions
      const sessionsDiv = document.createElement('div');
      sessionsDiv.className = 'section';
      sessionsDiv.innerHTML = '<h2>Listening Sessions</h2>';

      // a. Average Session Length
      sessionsDiv.innerHTML += `<p><strong>Average Session Length:</strong> ${data.averageSessionLength.averageSessionLength}</p>`;

      // b. Longest Listening Session
      const longestSession = data.longestSessions[0];
      sessionsDiv.innerHTML += `<p><strong>Longest Listening Session:</strong> ${longestSession.playtime} (${longestSession.startTime} to ${longestSession.endTime})</p>`;

      // c. Shortest Listening Session
      const shortestSession = data.shortestSessions[0];
      sessionsDiv.innerHTML += `<p><strong>Shortest Listening Session:</strong> ${shortestSession.playtime} (${shortestSession.startTime} to ${shortestSession.endTime})</p>`;

      contentDiv.appendChild(sessionsDiv);

      // 6. Total Listening Time
      const totalListeningDiv = document.createElement('div');
      totalListeningDiv.className = 'section';
      totalListeningDiv.innerHTML = '<h2>Total Listening Time</h2>';

      // a. Average Weekly Playtime
      totalListeningDiv.innerHTML += `<p><strong>Average Weekly Playtime:</strong> ${data.averageWeeklyPlaytime.averageWeeklyPlaytime}</p>`;

      // b. Average Monthly Playtime
      totalListeningDiv.innerHTML += `<p><strong>Average Monthly Playtime:</strong> ${data.averageMonthlyPlaytime.averageMonthlyPlaytime}</p>`;

      contentDiv.appendChild(totalListeningDiv);

      // 7. Listening Streaks and Artist Consistency
      const streaksDiv = document.createElement('div');
      streaksDiv.className = 'section';
      streaksDiv.innerHTML = '<h2>Listening Streaks & Artist Consistency</h2>';

      // Longest Listening Streak
      streaksDiv.innerHTML += `<p><strong>Longest Listening Streak:</strong> ${data.longestListeningStreak.length} days starting from ${data.longestListeningStreak.start}</p>`;

      // Artist Consistency
      const artistConsistencyDiv = document.createElement('div');
      artistConsistencyDiv.innerHTML = '<h3>Artist Consistency</h3>';
      const consistentArtistsList = document.createElement('ol');
      data.consistentArtists.forEach(artist => {
        const listItem = document.createElement('li');
        listItem.textContent = `${artist.artist} - ${artist.length} consecutive days starting from ${artist.startDate}`;
        consistentArtistsList.appendChild(listItem);
      });
      artistConsistencyDiv.appendChild(consistentArtistsList);
      streaksDiv.appendChild(artistConsistencyDiv);

      contentDiv.appendChild(streaksDiv);

      // 8. Track Rotation and Skipping Frequency
      const tracksDiv = document.createElement('div');
      tracksDiv.className = 'section';
      tracksDiv.innerHTML = '<h2>Track Rotation & Skipping Frequency</h2>';

      // Track Rotation
      const trackRotationDiv = document.createElement('div');
      trackRotationDiv.innerHTML = '<h3>Track Rotation</h3>';
      const trackRotationList = document.createElement('ol');
      data.topTrackRotations.forEach(track => {
        const listItem = document.createElement('li');
        listItem.textContent = `${track.song} - Played ${track.playCount} times over ${track.length} days starting from ${track.startDate}`;
        trackRotationList.appendChild(listItem);
      });
      trackRotationDiv.appendChild(trackRotationList);
      tracksDiv.appendChild(trackRotationDiv);

      // Skipping Frequency
      const skippingDiv = document.createElement('div');
      skippingDiv.innerHTML = '<h3>Track Skipping Frequency</h3>';
      const skippedTracksList = document.createElement('ol');
      data.frequentlySkippedTracks.forEach(track => {
        const listItem = document.createElement('li');
        listItem.textContent = `${track.song} - Skipped ${track.skipCount} times`;
        skippedTracksList.appendChild(listItem);
      });
      skippingDiv.appendChild(skippedTracksList);

      // Most Skipped Track
      skippingDiv.innerHTML += `<p><strong>Most Skipped Track:</strong> ${data.mostSkippedTrack.song} - Skipped ${data.mostSkippedTrack.skipCount} times</p>`;

      tracksDiv.appendChild(skippingDiv);
      contentDiv.appendChild(tracksDiv);

      // 9. Music Diversity
      const diversityDiv = document.createElement('div');
      diversityDiv.className = 'section';
      diversityDiv.innerHTML = '<h2>Music Diversity</h2>';
      diversityDiv.innerHTML += `<p><strong>Unique Artists:</strong> ${data.diversity.uniqueArtists}</p>`;
      diversityDiv.innerHTML += `<p><strong>Unique Tracks:</strong> ${data.diversity.uniqueTracks}</p>`;
      diversityDiv.innerHTML += `<p><strong>Total Plays:</strong> ${data.diversity.totalPlays}</p>`;
      diversityDiv.innerHTML += `<p><strong>Artist Diversity Ratio:</strong> ${data.diversity.artistDiversityRatio}</p>`;
      diversityDiv.innerHTML += `<p><strong>Track Diversity Ratio:</strong> ${data.diversity.trackDiversityRatio}</p>`;
      contentDiv.appendChild(diversityDiv);

      // 10. Highlights on Holidays
      const holidaysDiv = document.createElement('div');
      holidaysDiv.className = 'section';
      holidaysDiv.innerHTML = '<h2>Highlights on Holidays</h2>';
      data.holidayHighlights.forEach(holiday => {
        const holidayDiv = document.createElement('div');
        holidayDiv.innerHTML = `<h3>${holiday.holiday} (${holiday.date})</h3>`;
        const topTracksList = document.createElement('ol');
        holiday.topTracks.forEach(track => {
          const listItem = document.createElement('li');
          listItem.textContent = `${track.song} - ${track.totalPlaytime}`;
          topTracksList.appendChild(listItem);
        });
        holidayDiv.appendChild(topTracksList);
        holidaysDiv.appendChild(holidayDiv);
      });
      contentDiv.appendChild(holidaysDiv);
    }

    // Call the function to load data and create charts
    loadDataAndCreateCharts();
  </script>
</body>
</html>
