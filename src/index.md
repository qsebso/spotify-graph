<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spotify Listening Data Visualizer | Unveil Your Music Journey</title>
  <meta name="description" content="Visualize your Spotify listening history with interactive charts. Upload your data and explore your top songs over time. Discover insights into your music journey.">
  <link rel="icon" href="favicon.ico" type="image/x-icon">
  <!-- Google Fonts -->
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
  <!-- D3.js Library -->
  <script src="https://d3js.org/d3.v7.min.js"></script>
</head>
<body>

<div class="hero">
  <h1>Spotify Listening Data Visualizer</h1>
  <h2>Unveil your music journey through interactive visualizations of your Spotify listening history.</h2>
</div>

<!-- Section for Drag and Drop / File Upload -->
<div id="upload-container">
  <h3>Upload Your Spotify Data (drag and drop .zip file):</h3>
  
  <!-- File Dropzone -->
  <div id="file-dropzone">
    Drag and drop your Spotify data zip file here, or click to upload.
  </div>

  <!-- Hidden File Input -->
  <input type="file" id="file-input" accept=".zip" style="display: none;" />

  <!-- Use Sample Data Button -->
  <button id="use-sample-button">
    Use Sample Data
  </button>

  <!-- Status Message -->
  <div id="status-message"></div>
</div>

<!-- Visualization Section -->
<div id="visualization-container">
  <div id="chart-container"></div>
</div>

<!-- Controls -->
<div id="controls">
  <button id="start-button">Start</button>
  <button id="stop-button">Stop</button>
  <button id="speedup-button">Speed Up</button>
  <button id="slowdown-button">Slow Down</button>
  <button id="download-button">Download Image</button>
</div>

<!-- JavaScript -->
<script>
  // Set up dimensions and margins
  const margin = { top: 50, right: 30, bottom: 50, left: 150 };
  const width = 1000 - margin.left - margin.right;
  const height = 600 - margin.top - margin.bottom;

  // Number of top songs to display
  const n = 15; // create it so that the user can increase or decreasae this number

  // Create the SVG container
  const svg = d3.select("#chart-container")
    .append("svg")
    .attr("id", "chart-svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .style("background-color", "#ffffff")
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  // Scales
  const x = d3.scaleLinear([0, 1], [0, width]);
  const y = d3.scaleBand()
    .domain(d3.range(n))
    .range([0, height])
    .padding(0.1);

  // Variables for controlling animation
  let updateInterval = 150; // Adjust as needed
  let keyframes;
  let timer;
  let currentIndex = 0;

  // Variables to hold data
  let rawData;

  // Get references to the DOM elements
  const fileDropzone = document.getElementById('file-dropzone');
  const fileInput = document.getElementById('file-input');
  const statusMessage = document.getElementById('status-message');

  // Trigger file input when dropzone is clicked
  fileDropzone.addEventListener('click', () => {
    fileInput.click();
  });

  // Handle files selected via file input
  fileInput.addEventListener('change', (e) => {
    const files = e.target.files;
    handleFiles(files);
  });

  // Function to handle files
  function handleFiles(files) {
    if (files.length > 0) {
      const file = files[0];

      // Validate file type
      if (file.type !== 'application/zip' && !file.name.endsWith('.zip')) {
        alert('Please upload a .zip file containing your Spotify data.');
        return;
      }

      statusMessage.textContent = 'Uploading and processing your file, please wait...';

      const formData = new FormData();
      formData.append('datafile', file);

      // Upload the file to the server
      fetch('http://localhost:8888/upload', {
        method: 'POST',
        body: formData
      })
      .then(response => response.json())
      .then(data => {
        console.log('Upload successful:', data);
        statusMessage.textContent = 'Upload and processing complete!';

        // Fetch the processed data and initialize the chart
        d3.json('http://localhost:8888/cumulative_for_barchart').then(processedData => {
          rawData = processedData;
          initializeChart();
        }).catch(error => {
          console.error('Error loading processed data:', error);
          statusMessage.textContent = 'Error loading processed data.';
        });
      })
      .catch(error => {
        console.error('Error uploading file:', error);
        statusMessage.textContent = 'Error uploading file. Please try again.';
      });
    }
  }

  // Include drag-and-drop functionality
  // Prevent default behavior for dragover and drop events
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    fileDropzone.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Highlight drop area when file is dragged over it
  ['dragenter', 'dragover'].forEach(eventName => {
    fileDropzone.addEventListener(eventName, () => {
      fileDropzone.style.borderColor = '#008080';
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    fileDropzone.addEventListener(eventName, () => {
      fileDropzone.style.borderColor = '#cccccc';
    }, false);
  });

  // Handle dropped files
  fileDropzone.addEventListener('drop', handleDrop, false);

  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
  }

  // Check if cumulative_for_barchart exists on page load
  window.addEventListener('DOMContentLoaded', () => {
    checkForExistingData();
  });

  // Check for existing cumulative_for_barchart data
  function checkForExistingData() {
    fetch('http://localhost:8888/cumulative_for_barchart')
      .then(response => {
        if (response.ok) {
          return response.json(); // If the file exists, return it
        } else {
          throw new Error('Data not found'); // If it doesn't exist, throw an error
        }
      })
      .then(data => {
        rawData = data;
        initializeChart(); // If data exists, initialize the chart immediately
      })
      .catch(() => {
        statusMessage.textContent = 'No existing data found. Please upload your data or use sample data.';
      });
  }

  // Event listener for Use Sample Data button
  document.getElementById('use-sample-button').addEventListener('click', () => {
    statusMessage.textContent = 'Loading sample data, please wait...';
    // Load the sample data
    d3.json("http://localhost:8888/sample_cumulative_for_barchart").then(data => {
      rawData = data;
      initializeChart();
      statusMessage.textContent = 'Sample data loaded successfully!';
    }).catch(error => {
      console.error('Error loading sample data:', error);
      statusMessage.textContent = 'Error loading sample data.';
    });
  });

  // Function to initialize and draw the chart
  function initializeChart() {
    // Clear previous visualization if any
    svg.selectAll("*").remove();

    // Re-create the necessary groups
    const barGroup = svg.append("g").attr("class", "bars");
    const gridGroup = svg.append("g").attr("class", "grid");
    const labelGroup = svg.append("g").attr("class", "labels");
    const axisGroup = svg.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0, ${height})`);

    // Parse dates and sort data chronologically
    rawData.forEach(d => d.date = new Date(d.date));
    rawData.sort((a, b) => d3.ascending(a.date, b.date));

    // Extract song names and artist mapping
    const names = new Set();
    const artistMap = new Map();

    rawData.forEach(entry => {
      entry.songs.forEach(song => {
        const match = song.name.match(/\(([^)]+)\)$/);
        let artist = 'Unknown';
        let name = song.name;
        if (match) {
          artist = match[1];
          name = song.name.replace(/\s*\([^)]+\)$/, '');
        }
        names.add(name);
        artistMap.set(name, artist);
        song.name = name;
        song.artist = artist;
        song.playtime = song.playtime / 60000; // Convert to minutes
      });
    });

    // Create color scale for artists
    const color = d3.scaleOrdinal()
      .domain(Array.from(artistMap.values()))
      .range(d3.schemeTableau10);

    // Build keyframes
    keyframes = buildKeyframes(rawData, names, n);

    // Date label
    const dateLabel = svg.append("text")
      .attr("class", "date-label")
      .attr("x", width)
      .attr("y", -20)
      .attr("text-anchor", "end")
      .style("font-size", "24px")
      .style("fill", "#333333")
      .text(d3.timeFormat("%B %d, %Y")(keyframes[0][0]));

    // Reset animation variables
    currentIndex = 0;
    if (timer) {
      timer.stop();
      timer = null;
    }

    // Start the animation
    start();

    // Start the animation function
    function start() {
      if (timer) return;
      timer = d3.interval(() => {
        if (currentIndex >= keyframes.length) {
          timer.stop();
          timer = null;
          return;
        }
        const [date, data] = keyframes[currentIndex];
        updateChart(date, data);
        currentIndex++;
      }, updateInterval);
    }

    // Stop the animation
    function stop() {
      if (timer) {
        timer.stop();
        timer = null;
      }
    }

    // Update chart function
    function updateChart(date, data) {
      x.domain([0, data[0].value]);

      y.domain(data.map(d => d.name));

      // Update bars
      const bars = barGroup.selectAll(".bar")
        .data(data, d => d.name);

      bars.enter()
        .append("rect")
        .attr("class", "bar")
        .attr("fill", d => color(artistMap.get(d.name)))
        .attr("x", x(0))
        .attr("y", d => y(d.name))
        .attr("height", y.bandwidth())
        .attr("width", d => x(d.value) - x(0))
        .merge(bars)
        .transition().duration(updateInterval)
        .ease(d3.easeLinear)
        .attr("x", x(0))
        .attr("y", d => y(d.name))
        .attr("width", d => x(d.value) - x(0));

      bars.exit().remove();

      // Update gridlines after bars
      gridGroup.transition().duration(updateInterval)
        .ease(d3.easeLinear)
        .call(d3.axisBottom(x)
          .ticks(width / 160, "s")
          .tickSize(-height)
          .tickFormat("")
        )
        .attr("transform", `translate(0, ${height})`);

      // Update labels
      const labels = labelGroup.selectAll(".label")
        .data(data, d => d.name);

      labels.enter()
        .append("text")
        .attr("class", "label")
        .attr("x", d => x(d.value) - 5)
        .attr("y", d => y(d.name) + y.bandwidth() / 2)
        .attr("dy", ".35em")
        .attr("text-anchor", "end")
        .style("fill", "#333333")
        .text(d => `${d.name} - ${artistMap.get(d.name)}`)
        .merge(labels)
        .transition().duration(updateInterval)
        .ease(d3.easeLinear)
        .attr("x", d => x(d.value) - 5)
        .attr("y", d => y(d.name) + y.bandwidth() / 2);

      labels.exit().remove();

      // Update axis
      axisGroup.transition().duration(updateInterval)
        .ease(d3.easeLinear)
        .call(d3.axisBottom(x).ticks(width / 160, "s"))
        .call(g => g.select(".domain").remove());

      // Update date label
      dateLabel.text(d3.timeFormat("%B %d, %Y")(date));
    }

    // Build keyframes function
    function buildKeyframes(data, names, n) {
      const dateValues = Array.from(d3.rollup(
        data.flatMap(d => d.songs.map(s => ({ date: d.date, name: s.name, value: s.playtime }))),
        v => v[0].value,
        d => +d.date, // use timestamp as key
        d => d.name
      ));

      const keyframes = [];
      const k = 20; // Number of frames per date

      for (let i = 0; i < dateValues.length - 1; i++) {
        const [date1, data1] = dateValues[i];
        const [date2, data2] = dateValues[i + 1];

        for (let j = 0; j < k; j++) {
          const t = j / k;
          const interpDate = new Date(date1 * (1 - t) + date2 * t);

          const entries = Array.from(names, name => ({
            name,
            value: (data1.get(name) || 0) * (1 - t) + (data2.get(name) || 0) * t
          }));

          const sorted = entries.sort((a, b) => b.value - a.value).slice(0, n);

          keyframes.push([interpDate, sorted]);
        }
      }

      // Add the last frame
      const [lastDate, lastData] = dateValues[dateValues.length - 1];
      const entries = Array.from(names, name => ({
        name,
        value: lastData.get(name) || 0
      }));
      const sorted = entries.sort((a, b) => b.value - a.value).slice(0, n);
      keyframes.push([new Date(+lastDate), sorted]);

      return keyframes;
    }

    // Control buttons
    document.getElementById('start-button').addEventListener('click', () => {
      start();
    });

    document.getElementById('stop-button').addEventListener('click', stop);

    document.getElementById('speedup-button').addEventListener('click', () => {
      if (updateInterval > 50) {
        updateInterval -= 20;
        if (timer) {
          stop();
          start();
        }
      }
    });

    document.getElementById('slowdown-button').addEventListener('click', () => {
      updateInterval += 20;
      if (timer) {
        stop();
        start();
      }
    });

    document.getElementById('download-button').addEventListener('click', downloadChart);

    function downloadChart() {
      // Use SVG to image conversion
      const svgElement = document.getElementById("chart-svg");
      const serializer = new XMLSerializer();
      const svgData = serializer.serializeToString(svgElement);
      const canvas = document.createElement("canvas");
      canvas.width = svgElement.clientWidth;
      canvas.height = svgElement.clientHeight;
      const ctx = canvas.getContext("2d");
      const img = new Image();
      const svgBlob = new Blob([svgData], {type: "image/svg+xml;charset=utf-8"});
      const url = URL.createObjectURL(svgBlob);
      img.onload = function() {
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        const imgURL = canvas.toDataURL("image/png");
        const downloadLink = document.createElement('a');
        downloadLink.href = imgURL;
        downloadLink.download = 'chart.png';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      };
      img.src = url;
    }
  }

  // Fetch Spotify token (as a placeholder)
  async function fetchSpotifyData() {
    try {
      let tokenResponse = await fetch('http://localhost:8888/token');
      let tokenData = await tokenResponse.json();
      console.log('Spotify API token received:', tokenData.access_token);
    } catch (error) {
      console.error('Error fetching Spotify token:', error);
    }
  }

  // Call function to get Spotify data
  fetchSpotifyData();
</script>

<!-- CSS -->
<style>
  /* Reset some basic elements */
  body, h1, h2, h3, p, div, button {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  /* Body styles */
  body {
    font-family: 'Roboto', sans-serif;
    background-color: #f9f9f9;
    color: #333333;
    line-height: 1.6;
  }

  /* Hero section */
  .hero {
    text-align: center;
    padding: 60px 20px;
    background-color: #ffffff;
    border-bottom: 1px solid #e0e0e0;
  }

  .hero h1 {
    font-size: 48px;
    margin-bottom: 20px;
    font-weight: 700;
    color: #008080;
  }

  .hero h2 {
    font-size: 24px;
    font-weight: 400;
    color: #666666;
    max-width: 800px;
    margin: 0 auto;
  }

  /* Upload container */
  #upload-container {
    max-width: 800px;
    margin: 40px auto;
    padding: 30px;
    background-color: #ffffff;
    border-radius: 10px;
    text-align: center;
    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
  }

  #upload-container h3 {
    font-size: 24px;
    margin-bottom: 20px;
    color: #333333;
  }

  /* File Dropzone */
  #file-dropzone {
    padding: 60px;
    border: 2px dashed #cccccc;
    border-radius: 10px;
    text-align: center;
    margin-bottom: 20px;
    transition: border-color 0.3s ease;
    cursor: pointer;
    background-color: #fafafa;
    color: #666666;
    font-size: 18px;
  }

  #file-dropzone:hover {
    border-color: #008080;
  }

  /* Status Message */
  #status-message {
    text-align: center;
    color: #333333;
    margin-top: 10px;
    font-size: 18px;
  }

  /* Use Sample Data Button */
  #use-sample-button {
    margin-top: 20px;
    padding: 12px 24px;
    font-size: 18px;
    cursor: pointer;
    background-color: #008080;
    color: #ffffff;
    border: none;
    border-radius: 5px;
    transition: background-color 0.3s ease;
  }

  #use-sample-button:hover {
    background-color: #00b3b3;
  }

  /* Visualization container */
  #visualization-container {
    max-width: 1200px;
    margin: 40px auto;
    padding: 20px;
    background-color: #ffffff;
    border-radius: 15px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
  }

  /* Chart container */
  #chart-container {
    background-color: #ffffff;
    padding: 20px;
    border-radius: 10px;
  }

  /* Controls */
  #controls {
    text-align: center;
    margin: 30px auto;
  }

  #controls button {
    margin: 5px;
    padding: 12px 24px;
    font-size: 16px;
    cursor: pointer;
    background-color: #008080;
    color: #ffffff;
    border: none;
    border-radius: 5px;
    transition: background-color 0.3s ease;
  }

  #controls button:hover {
    background-color: #00b3b3;
  }

  /* Style for labels */
  .label {
    font-size: 14px;
    pointer-events: none;
    fill: #333333;
  }

  /* Style for the date label */
  .date-label {
    font-size: 24px;
    fill: #333333;
  }

  /* Style for the bars */
  .bar {
    stroke: none;
  }

  /* Style for grid lines */
  .grid line {
    stroke: #cccccc;
    stroke-opacity: 0.5;
    shape-rendering: crispEdges;
  }

  .grid path {
    stroke-width: 0;
  }

  /* Footer */
  footer {
    text-align: center;
    padding: 20px;
    background-color: #f9f9f9;
    color: #666666;
    font-size: 14px;
    border-top: 1px solid #e0e0e0;
    margin-top: 40px;
  }

  footer a {
    color: #008080;
    text-decoration: none;
  }

  footer a:hover {
    text-decoration: underline;
  }
</style>

<footer>
  <p>&copy; 2023 Spotify Listening Data Visualizer. Developed by Quinn.</p>
</footer>

</body>
</html>
