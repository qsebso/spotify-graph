<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Spotify Data Visualizer - Bar Chart Race</title>
  <!-- D3.js Library -->
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <!-- Include any necessary stylesheets or scripts here -->
  <style>
    /* Include your CSS styling here */
    body {
      font-family: Arial, sans-serif;
      background-color: #222;
      color: white;
      text-align: center;
    }
    svg {
      width: 1000px;
      height: 600px;
      display: block;
      margin: 0 auto;
    }
    #chart-container {
      margin-top: 50px;
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
    .bar {
      fill-opacity: 0.7;
    }
    .bar:hover {
      fill-opacity: 1;
    }
    .label {
      font-size: 17px;
      fill: #ffffff; /* Changed to white for contrast */
    }
    .date-label {
      font-size: 24px;
      fill: #ffffff; /* Changed to white for contrast */
    }
    /* Additional styles as needed */
     /* Ensure grid lines and axis are the same color as the background */
  .grid line {
    stroke: #3333; /* Same as background color */
    stroke-opacity: 1;
  }
  </style>
</head>
<body>

  <h1>Spotify Listening Data Visualizer</h1>
  <h2>Your Top Songs Over Time</h2>

  <!-- Visualization Container -->
  <div id="chart-container">
    <!-- The chart will be rendered here -->
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
    // Parse URL parameters to check if sample data should be used
    const urlParams = new URLSearchParams(window.location.search);
    const useSampleData = urlParams.get('sample') === 'true';

    // Set up dimensions and margins
    const margin = { top: 50, right: 30, bottom: 50, left: 150 };
    const width = 1000 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;

    // Number of top songs to display
    const n = 15; // You can make this adjustable if desired

    // Create the SVG container
    const svg = d3.select("#chart-container")
      .append("svg")
      .attr("id", "chart-svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .style("background-color", "#333333") // Changed background color
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

    // Function to load either user data or sample data based on selection
    function loadDataAndCreateBarChart() {
      // First try to fetch the user data
      fetch("http://localhost:8888/cumulative_for_barchart")
        .then(response => {
          if (!response.ok) {
            throw new Error('User data not found, falling back to sample data.');
          }
          return response.json(); // Parse the user data if available
        })
        .then(data => {
          // Process the data and create the bar chart race
          rawData = data;
          initializeChart();
        })
        .catch(() => {
          // If fetching the user data fails or sample data is requested, fetch the sample data
          if (useSampleData) {
            console.warn("Loading sample data as per user request.");
          } else {
            console.warn("User data not available, loading sample data.");
          }
          fetch("http://localhost:8888/sample_cumulative_for_barchart")
            .then(response => response.json())
            .then(sampleData => {
              // Process the sample data and create the bar chart race
              rawData = sampleData;
              initializeChart();
            })
            .catch(error => {
              console.error("Error loading sample data:", error);
            });
        });
    }

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
        .style("fill", "#ffffff") // Changed to white for contrast
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
          .style("fill", "#ffffff") // Changed to white for contrast
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
          .call(g => g.select(".domain").remove())
          .selectAll("text")
          .style("fill", "#ffffff"); // Axis tick labels color

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
        // Get the original SVG element
        const svgElement = document.getElementById("chart-svg");

        // Clone the SVG node
        const clonedSvgElement = svgElement.cloneNode(true);

        // Inline styles
        inlineStyles(clonedSvgElement);

        // Serialize the cloned SVG
        const serializer = new XMLSerializer();
        const svgData = serializer.serializeToString(clonedSvgElement);

        // Create a canvas and draw the SVG onto it
        const canvas = document.createElement("canvas");
        canvas.width = svgElement.clientWidth;
        canvas.height = svgElement.clientHeight;
        const ctx = canvas.getContext("2d");
        const img = new Image();

        // Create a blob from the SVG data
        const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);

        img.onload = function () {
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

      function inlineStyles(element) {
        const computeStyle = window.getComputedStyle(element);
        const styleString = Array.from(computeStyle).map(key => {
          return `${key}:${computeStyle.getPropertyValue(key)};`;
        }).join('');

        element.setAttribute('style', styleString);

        for (let i = 0; i < element.children.length; i++) {
          inlineStyles(element.children[i]);
        }
      }
    }

    // Call the function to load data and create the bar chart race
    loadDataAndCreateBarChart();
  </script>
</body>
</html>
