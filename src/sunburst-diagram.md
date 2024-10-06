<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sunburst Chart: Genres and Artists</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #222;
      color: white;
      text-align: center;
    }
    svg {
      width: 800px;
      height: 800px;
      display: block;
      margin: 0 auto;
    }
    input {
      width: 200px;
      margin: 5px;
      color: black;
    }
    button {
      background-color: #4CAF50;
      border: none;
      color: white;
      padding: 10px 24px;
      text-align: center;
      font-size: 16px;
      margin: 4px 2px;
      cursor: pointer;
    }
    .clickable:hover {
      cursor: pointer;
      fill-opacity: 0.8;
    }
    #selectedList {
      margin: 20px auto;
      max-width: 400px;
      background-color: #444;
      padding: 10px;
      border-radius: 10px;
    }
    .selected-item {
      display: flex;
      justify-content: space-between;
      margin: 5px 0;
    }
    #recommendations ul {
      list-style-type: none;
      padding: 0;
    }
    #recommendations li {
      margin: 5px 0;
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
  <h1>Sunburst Chart: Genres and Artists</h1>

  <div>
    <label for="numGenres">Number of genres:</label>
    <input type="number" id="numGenres" name="numGenres" value="15" min="1" max="50">
  </div>
  <div>
    <label for="numArtists">Number of artists per genre:</label>
    <input type="number" id="numArtists" name="numArtists" value="5" min="1" max="10">
  </div>
  <div>
    <button id="updateChart">Update Chart</button>
    <button id="toggleMinSize">Toggle Minimum Size</button> <!-- New Button -->
  </div>

  <div id="chart"></div>
  <div id="recommendations"></div>

  <div id="selectedList">
    <h3>Selected Items</h3>
    <ul id="selectedItems"></ul>
    <button id="getRecommendations" style="display:none;">Get Recommendations</button>
  </div>

  <!-- Tooltip for hover -->
  <div id="tooltip" class="tooltip"></div>

  <!-- D3.js library -->
  <script src="https://d3js.org/d3.v6.min.js"></script>

  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const margin = {top: 10, right: 10, bottom: 10, left: 10},
            width = 800 - margin.left - margin.right,
            height = 800 - margin.top - margin.bottom,
            radius = Math.min(width, height) / 2;

      const color = d3.scaleOrdinal(d3.schemeCategory10);
      const tooltip = document.getElementById('tooltip'); // Get tooltip element
      let applyMinSize = false; // Track whether minimum size is applied

      const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${(width / 2)}, ${(height / 2)})`);

      const partition = d3.partition()
        .size([2 * Math.PI, radius]);

      const arc = d3.arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .innerRadius(d => d.y0)
        .outerRadius(d => d.y1);

      const selectedGenres = new Set();
      const selectedArtists = new Set();

      // Update selected items list and button visibility
      function updateSelectedItems() {
        const selectedItemsDiv = document.getElementById('selectedItems');
        selectedItemsDiv.innerHTML = '';

        selectedGenres.forEach(item => {
          const li = document.createElement('li');
          li.className = 'selected-item';
          li.innerHTML = `Genre: ${item} <button onclick="removeGenre('${item}')">Remove</button>`;
          selectedItemsDiv.appendChild(li);
        });

        selectedArtists.forEach(item => {
          const li = document.createElement('li');
          li.className = 'selected-item';
          li.innerHTML = `Artist: ${item} <button onclick="removeArtist('${item}')">Remove</button>`;
          selectedItemsDiv.appendChild(li);
        });

        const recommendButton = document.getElementById('getRecommendations');
        if (selectedGenres.size > 0 || selectedArtists.size > 0) {
          recommendButton.style.display = 'inline-block';
        } else {
          recommendButton.style.display = 'none';
        }
      }

      function removeGenre(item) {
        selectedGenres.delete(item);
        updateSelectedItems();
      }

      function removeArtist(item) {
        selectedArtists.delete(item);
        updateSelectedItems();
      }

      window.removeGenre = removeGenre;
      window.removeArtist = removeArtist;

      // Function to show tooltip
      function showTooltip(d) {
        const playtimeInMinutes = (d.data.playtime / 60000).toFixed(2); // Convert ms to minutes
        const artistName = d.data.name;

        tooltip.innerHTML = `Artist: ${artistName}<br>Time: ${playtimeInMinutes} min`;
        tooltip.style.visibility = 'visible';
      }

      // Function to move the tooltip with the mouse
      function moveTooltip(event) {
        tooltip.style.top = `${event.pageY + 10}px`;
        tooltip.style.left = `${event.pageX + 10}px`; // Adjusting the tooltip position to follow cursor
      }

      // Function to hide the tooltip
      function hideTooltip() {
        tooltip.style.visibility = 'hidden';
      }

      // Create the sunburst chart
      function createSunburst(data) {
        const root = d3.hierarchy(data)
          .sum(d => applyMinSize ? Math.max(Math.sqrt(d.playtime), 5) : d.playtime); // Apply min size condition

        partition(root);

        const path = svg.selectAll("path")
          .data(root.descendants())
          .enter().append("path")
          .attr("d", arc)
          .attr("class", "clickable")
          .style("fill", d => color((d.children ? d : d.parent).data.name))
          .on("mouseover", (event, d) => showTooltip(d))
          .on("mousemove", (event) => moveTooltip(event))
          .on("mouseout", hideTooltip)
          .on("click", (event, d) => {
            const name = d.data.name;
            if (d.depth === 1) {
              selectedGenres.add(name);
            } else if (d.depth === 2) {
              if (selectedArtists.size >= 5 && !selectedArtists.has(name)) {
                alert("You can only select up to 5 artists.");
                return;
              }
              selectedArtists.add(name);
            }
            updateSelectedItems();
          });

        svg.selectAll("text")
          .data(root.descendants())
          .enter().append("text")
          .attr("transform", function(d) {
            const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
            const y = (d.y0 + d.y1) / 2;
            return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
          })
          .attr("dx", "-20")
          .attr("dy", ".35em")
          .text(d => d.data.name)
          .style("fill", "white")
          .style("font-size", d => {
            const angle = d.x1 - d.x0;
            return angle < 0.05 ? "0px" : "12px";
          });
      }

      function loadDataAndCreateSunburst(maxGenres, maxArtistsPerGenre) {
        d3.json("http://localhost:8888/artists_by_genre").then(data => {
          const genres = data
            .sort((a, b) => d3.sum(b.artists, d => d.playtime) - d3.sum(a.artists, d => d.playtime))
            .slice(0, maxGenres);

          const trimmedData = {
            name: "Genres",
            children: genres.map(genre => ({
              name: genre.genre,
              children: genre.artists
                .sort((a, b) => b.playtime - a.playtime)
                .slice(0, maxArtistsPerGenre)
                .map(artist => ({ name: artist.name, playtime: artist.playtime }))
            }))
          };

          svg.selectAll("*").remove();
          createSunburst(trimmedData);
        });
      }

      async function fetchRecommendations() {
        const genres = Array.from(selectedGenres);
        const artists = Array.from(selectedArtists);

        try {
          const response = await fetch('http://localhost:8888/get_recommendations', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              genres,
              artists
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error('Server Error:', errorData.error);
            alert('Error fetching recommendations: ' + errorData.error);
            return;
          }

          const recommendations = await response.json();
          displayRecommendations(recommendations);
        } catch (error) {
          console.error('Error fetching recommendations:', error);
          alert('An unexpected error occurred.');
        }
      }

      function displayRecommendations(tracks) {
        const recommendationsDiv = document.getElementById('recommendations');
        recommendationsDiv.innerHTML = '<h2>Recommended Songs</h2><ul>';

        tracks.forEach(track => {
          recommendationsDiv.innerHTML += `<li>${track.track} by ${track.artist}</li>`;
        });

        recommendationsDiv.innerHTML += '</ul>';
      }

      document.getElementById('updateChart').addEventListener('click', () => {
        const numGenres = document.getElementById('numGenres').value;
        const numArtists = document.getElementById('numArtists').value;
        loadDataAndCreateSunburst(numGenres, numArtists);
      });

      // Toggle minimum size button event listener
      document.getElementById('toggleMinSize').addEventListener('click', () => {
        applyMinSize = !applyMinSize; // Toggle the minimum size flag
        const numGenres = document.getElementById('numGenres').value;
        const numArtists = document.getElementById('numArtists').value;
        loadDataAndCreateSunburst(numGenres, numArtists); // Re-create the chart with updated settings
      });

      document.getElementById('getRecommendations').addEventListener('click', fetchRecommendations);

      loadDataAndCreateSunburst(15, 5);
    });
  </script>
</body>
</html>
