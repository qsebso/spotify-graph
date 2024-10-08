<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Spotify Data Visualizer - Upload</title>
  <!-- You can include external stylesheets or scripts here -->
  <style>
    /* CSS Styling */
    body {
      font-family: Arial, sans-serif;
      background-color: #222;
      color: white;
      text-align: center;
    }
    #upload-container {
      margin: 50px auto;
      max-width: 600px;
    }
    #file-dropzone {
      padding: 60px;
      border: 2px dashed #cccccc;
      border-radius: 10px;
      text-align: center;
      margin-bottom: 20px;
      transition: border-color 0.3s ease;
      cursor: pointer;
      background-color: #333;
      color: #cccccc;
      font-size: 18px;
    }
    #file-dropzone:hover {
      border-color: #008080;
    }
    #use-sample-button {
      margin-top: 20px;
      padding: 12px 24px;
      font-size: 18px;
      cursor: pointer;
      background-color: #4CAF50;
      color: #ffffff;
      border: none;
      border-radius: 5px;
      transition: background-color 0.3s ease;
    }
    #use-sample-button:hover {
      background-color: #00b3b3;
    }
    #status-message {
      text-align: center;
      color: #ffffff;
      margin-top: 10px;
      font-size: 18px;
    }
  </style>
</head>
<body>

  <h1>Spotify Listening Data Visualizer</h1>
  <h2>Upload Your Data</h2>

  <div id="upload-container">
    <!-- File Dropzone -->
    <div id="file-dropzone">
      Drag and drop your Spotify data zip file here, or click to upload.
    </div>
  <div>
    <!-- Hidden File Input -->
    <input type="file" id="file-input" accept=".zip" style="display: none;" />
    <!-- Use Sample Data Button -->
    <button id="use-sample-button">
      Use Sample Data
    </button>
    <!-- Status Message -->
    <div id="status-message"></div>
  </div>

  <!-- JavaScript -->
  <script>
    // Get references to the DOM elements
    const fileDropzone = document.getElementById('file-dropzone');
    const fileInput = document.getElementById('file-input');
    const statusMessage = document.getElementById('status-message');
    const useSampleButton = document.getElementById('use-sample-button');

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
          statusMessage.textContent = 'Upload and processing complete! Redirecting...';
          // Redirect to the bar chart race page after successful upload
          window.location.href = '/bar-chart-race';
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

    // Event listener for Use Sample Data button
    useSampleButton.addEventListener('click', () => {
      // Redirect to the bar chart race page with a query parameter indicating sample data
      window.location.href = '/bar-chart-race?sample=true';
    });
  </script>
</body>
</html>
