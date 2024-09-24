---
toc: false
---

<div class="hero">
  <h1>Spotify Listening Data Visualizer</h1>
  <h2>This tool allows you to upload your Spotify listening history and visualize your top songs over time, including recommendations based on your listening behavior.</h2>
</div>

<!-- Section for Drag and Drop / File Upload -->
<div id="upload-container" style="padding: 20px; background-color: #1e1e1e; color: #fff; border-radius: 10px; margin: 20px;">
  <h3>Upload your Spotify Data (drag and drop .zip file):</h3>
  
  <!-- This will be the drag-and-drop or file input area -->
  <!-- Comment: Replace this section with actual drag-and-drop file upload logic -->
  <div id="file-dropzone" style="padding: 40px; border: 2px dashed #fff; border-radius: 10px; text-align: center;">
    Drag and drop your Spotify data zip file here, or click to upload.
  </div>
</div>

<!-- Section for Visualization -->
<div id="visualization-section" style="padding: 20px; background-color: #333; color: #fff; border-radius: 10px; margin: 20px;">
  <h3>Visualization of Your Top Songs Over Time</h3>
  
  <!-- Placeholder for future chart visualization -->
  <!-- Comment: Insert D3.js or Plot.js chart generation code here -->
  <div id="chart-container" style="width: 100%; height: 500px;">
    <!-- Visualization will be rendered here -->
  </div>
</div>

<!-- Section for Song Recommendations -->
<div id="recommendation-section" style="padding: 20px; background-color: #1e1e1e; color: #fff; border-radius: 10px; margin: 20px;">
  <h3>Recommended Songs Based on Your Listening History</h3>
  
  <!-- Placeholder for song recommendations -->
  <!-- Comment: Insert logic for fetching and displaying song recommendations here -->
  <ul id="recommendation-list" style="list-style-type: none; padding: 0;">
    <!-- Recommendations will be displayed here -->
  </ul>
</div>

<script>
  console.log("Initializing the page");

  // Comment: File drop area logic
  document.getElementById('file-dropzone').addEventListener('click', function() {
    alert('File upload will be implemented here.');
  });

  // Comment: Placeholder logic for fetching token and data
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

#upload-container, #visualization-section, #recommendation-section {
  max-width: 900px;
  margin: 0 auto;
}

</style>
