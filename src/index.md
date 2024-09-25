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
  <div id="file-dropzone" style="padding: 40px; border: 2px dashed #fff; border-radius: 10px; text-align: center;">
    Drag and drop your Spotify data zip file here, or click to upload.
  </div>

  <input type="file" id="file-input" style="display: none;" />
</div>

<!-- Section for Visualization -->
<div id="visualization-section" style="padding: 20px; background-color: #333; color: #fff; border-radius: 10px; margin: 20px;">
  <h3>Visualization of Your Top Songs Over Time</h3>
  
  <!-- Placeholder for future chart visualization -->
  <div id="chart-container" style="width: 100%; height: 500px;">
    <!-- Visualization will be rendered here -->
  </div>
</div>

<!-- Section for Song Recommendations -->
<div id="recommendation-section" style="padding: 20px; background-color: #1e1e1e; color: #fff; border-radius: 10px; margin: 20px;">
  <h3>Recommended Songs Based on Your Listening History</h3>
  
  <!-- Placeholder for song recommendations -->
  <ul id="recommendation-list" style="list-style-type: none; padding: 0;">
    <!-- Recommendations will be displayed here -->
  </ul>
</div>

<script>
  console.log("Initializing the page");

  // Handle file drop and drag events
  const fileDropzone = document.getElementById('file-dropzone');
  const fileInput = document.getElementById('file-input');

  // Handle drag over to show that the area is active
  fileDropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    fileDropzone.style.backgroundColor = '#444'; // Optional styling to show active drag area
  });

  // Reset background color when file is dragged out
  fileDropzone.addEventListener('dragleave', () => {
    fileDropzone.style.backgroundColor = '#1e1e1e';
  });

  // Handle file drop
  fileDropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    fileDropzone.style.backgroundColor = '#1e1e1e'; // Reset background color
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]); // Send the first file (assumed .zip)
    }
  });

  // Fallback to file select via click
  fileDropzone.addEventListener('click', () => {
    fileInput.click(); // Trigger file selection dialog
  });

  fileInput.addEventListener('change', (event) => {
    const files = event.target.files;
    if (files.length > 0) {
      handleFileUpload(files[0]); // Handle file selection
    }
  });

  // Function to handle file upload to backend
  function handleFileUpload(file) {
    const formData = new FormData();
    formData.append('datafile', file);

    fetch('http://localhost:8888/upload', {
      method: 'POST',
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      console.log('File uploaded successfully:', data);
      // Further logic to process data
    })
    .catch(error => {
      console.error('Error uploading file:', error);
    });
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

/* Styling for upload, visualization, and recommendation sections */
#upload-container, #visualization-section, #recommendation-section {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

#file-dropzone {
  padding: 40px;
  border: 2px dashed #fff;
  border-radius: 10px;
  text-align: center;
  transition: background-color 0.3s;
}

#chart-container {
  width: 100%;
  height: 500px;
}
</style>
