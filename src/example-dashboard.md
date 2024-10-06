<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Clickable D3 Chord Diagram</title>
  <style>
    /* Basic styling */
    body {
      font-family: Arial, sans-serif;
    }
    svg {
      width: 800px;
      height: 800px;
      display: block;
      margin: 0 auto;
    }
    .tooltip {
      position: absolute;
      text-align: center;
      padding: 8px;
      font-size: 12px;
      background: lightsteelblue;
      border: 0px;
      border-radius: 8px;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <h1>Clickable D3 Chord Diagram</h1>
  <div id="chart"></div>

  <!-- D3.js library -->
  <script src="https://d3js.org/d3.v6.min.js"></script>

  <script>
    const margin = {top: 50, right: 50, bottom: 50, left: 50},
          width = 800 - margin.left - margin.right,
          height = 800 - margin.top - margin.bottom,
          outerRadius = Math.min(width, height) / 2,
          innerRadius = outerRadius - 20;

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    const svg = d3.select("#chart")
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${(width + margin.left) / 2}, ${(height + margin.top) / 2})`);

    const chord = d3.chord()
      .padAngle(0.05)
      .sortSubgroups(d3.descending);

    const arc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius);

    const ribbon = d3.ribbon()
      .radius(innerRadius);

    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("opacity", 0);

    // Fetch data from the server
    d3.json("http://localhost:8888/artists_by_genre").then(data => {

      const genreNames = data.map(d => d.genre);
      const artistNames = Array.from(new Set(data.flatMap(d => d.artists.map(a => a.name))));
      
      const matrix = genreNames.map(genre => {
        return artistNames.map(artist => {
          const genreData = data.find(d => d.genre === genre);
          const artistData = genreData.artists.find(a => a.name === artist);
          return artistData ? artistData.playtime : 0;
        });
      });

      const chords = chord(matrix);

      svg.append("g")
        .selectAll("path")
        .data(chords)
        .enter()
        .append("path")
        .attr("d", ribbon)
        .attr("fill", d => color(artistNames[d.source.index]))
        .attr("stroke", d => d3.rgb(color(artistNames[d.source.index])).darker())
        .on("mouseover", (event, d) => {
          tooltip.transition().duration(200).style("opacity", .9);
          tooltip.html(`Artist: ${artistNames[d.source.index]}<br>Genre: ${genreNames[d.target.index]}<br>Playtime: ${matrix[d.source.index][d.target.index]}ms`)
            .style("left", (event.pageX + 5) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", () => {
          tooltip.transition().duration(500).style("opacity", 0);
        });

      const arcs = svg.append("g")
        .selectAll("g")
        .data(chords.groups)
        .enter()
        .append("g");

      arcs.append("path")
        .style("fill", d => color(artistNames[d.index]))
        .style("stroke", d => d3.rgb(color(artistNames[d.index])).darker())
        .attr("d", arc);

      arcs.append("text")
        .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
        .attr("dy", ".35em")
        .attr("transform", d => `
          rotate(${(d.angle * 180 / Math.PI - 90)})
          translate(${outerRadius + 10})
          ${d.angle > Math.PI ? "rotate(180)" : ""}
        `)
        .attr("text-anchor", d => d.angle > Math.PI ? "end" : null)
        .text(d => artistNames[d.index]);

    }).catch(error => {
      console.error("Error loading data:", error);
    });
  </script>
</body>
</html>
