<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Top Songs of the Week</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #222;
      color: white;
    }
    #chart-container {
      width: 100%;
      height: 600px;
      margin: 20px auto;
      text-align: center;
    }
    .tooltip {
      position: absolute;
      background-color: lightsteelblue;
      color: #000;
      padding: 8px;
      border-radius: 4px;
      visibility: hidden;
    }
    select {
      padding: 10px;
      margin: 20px;
      background-color: #444;
      color: white;
      border: none;
      border-radius: 4px;
    }
  </style>
</head>
<body>

<h1>Top Songs of the Week</h1>
<div id="week-selector-container">
  <select id="week-selector"></select>
</div>
<div id="chart-container"></div>
<div id="tooltip" class="tooltip"></div>

<script>
  function loadDataAndCreateChart() {
    fetch("http://localhost:8888/non_cumulative_songs")
      .then(response => {
        if (!response.ok) {
          throw new Error('Non-cumulative songs data not found.');
        }
        return response.json();
      })
      .then(data => {
        console.log("Loaded non-cumulative songs data:", data); // Log the data
        createTopSongsChart(data);
      })
      .catch(() => {
        // Fallback to sample data
        console.warn('Falling back to sample data...');
        return fetch("http://localhost:8888/sample_non_cumulative_songs")
          .then(sampleResponse => {
            if (!sampleResponse.ok) {
              throw new Error('Sample data not found.');
            }
            return sampleResponse.json();
          })
          .then(sampleData => {
            console.log("Loaded sample songs data:", sampleData); // Log the sample data
            createTopSongsChart(sampleData);
          })
          .catch(error => {
            console.error("Error loading sample data:", error);
          });
      });
  }

  function createTopSongsChart(weeklyData) {
    console.log("Weekly data for the chart:", weeklyData); // Log the weekly data used for the chart
    const weeks = Object.keys(weeklyData);
    
    // Create a dropdown for the weeks
    const weekSelector = d3.select("#week-selector");
    weeks.forEach(week => {
      weekSelector.append("option").text(week).attr("value", week);
    });

    // Event listener to update chart when a new week is selected
    weekSelector.on("change", function() {
      const selectedWeek = this.value;
      updateChart(weeklyData[selectedWeek]);
    });

    // Initial chart display
    updateChart(weeklyData[weeks[0]]);

    // Function to update the chart based on selected week
    function updateChart(data) {
      console.log("Data for the selected week:", data); // Log the data for the selected week

      // Transform the nested data into the format expected by the chart
      const transformedData = data.map(songData => {
        return {
          name: songData.name,
          playtime: songData.playtime ? songData.playtime : 0  // Default to 0 if playtime is missing
        };
      });

      const margin = { top: 30, right: 20, bottom: 100, left: 80 };
      const width = 1000 - margin.left - margin.right;
      const height = 600 - margin.top - margin.bottom;

      // Clear the previous chart
      d3.select("#chart-container").select("svg").remove();

      const svg = d3.select("#chart-container").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const x = d3.scaleBand()
        .domain(transformedData.map(d => d.name))
        .range([0, width])
        .padding(0.2);

      const y = d3.scaleLinear()
        .domain([0, d3.max(transformedData, d => isNaN(d.playtime) ? 0 : d.playtime / 60000)])  // Handle NaN values
        .nice()
        .range([height, 0]);

      const color = d3.scaleOrdinal(d3.schemeCategory10);

      // X Axis
      svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end")
        .style("font-size", "12px")
        .each(function(d) {
          const self = d3.select(this);
          const text = self.text();
          if (text.length > 20) {
            self.text(text.substring(0, 20) + "...");
          }
        });

      // Y Axis
      svg.append("g")
        .call(d3.axisLeft(y).ticks(10).tickFormat(d => d + ' min'));

      const tooltip = d3.select("#tooltip");

      svg.selectAll(".bar")
        .data(transformedData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.name))
        .attr("y", d => y(d.playtime / 60000))  // Convert ms to minutes
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.playtime / 60000))  // Convert ms to minutes
        .attr("fill", d => color(d.name))
        .on("mouseover", (event, d) => {
          tooltip.html(`Song: ${d.name}<br>Playtime: ${(d.playtime / 60000).toFixed(2)} min`)
            .style("visibility", "visible");
        })
        .on("mousemove", (event) => {
          const svgBounds = document.getElementById('chart-container').getBoundingClientRect();
          tooltip.style("top", `${event.clientY - svgBounds.top + 20}px`)
                 .style("left", `${event.clientX - svgBounds.left + 20}px`);
        })
        .on("mouseout", () => {
          tooltip.style("visibility", "hidden");
        });
    }
  }

  // Load data when the page is ready
  loadDataAndCreateChart();

</script>

</body>
</html>
