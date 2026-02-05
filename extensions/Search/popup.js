// Function to extract count from the page
function extractCount() {
  const headingElement = document.querySelector('h1.srp-controls__count-heading');

  if (!headingElement) {
    return 'Heading not found';
  }

  const firstChild = headingElement.firstElementChild;

  if (!firstChild) {
    return 'First child not found';
  }

  // Remove commas and return
  return firstChild.textContent.trim().replace(/,/g, '');
}

// Function to display results list sorted by sell-through rate
function displayResultsList(searchHistory) {
  const resultsListDiv = document.getElementById('resultsList');

  if (!searchHistory || searchHistory.length === 0) {
    resultsListDiv.style.display = 'none';
    return;
  }

  // Sort by percentage (highest first)
  const sortedResults = [...searchHistory].sort((a, b) => b.percentage - a.percentage);

  // Build HTML for results list
  const resultsHTML = sortedResults.map(result => `
    <div class="result-item">
      <div class="result-info">
        <div class="result-car">${result.car}</div>
        <div class="result-search">${result.searchTerm}</div>
      </div>
      <div class="result-stats">
        <div class="result-percentage">${result.percentage}%</div>
        <div class="result-counts">${result.soldCount} sold</div>
      </div>
    </div>
  `).join('');

  resultsListDiv.innerHTML = resultsHTML;
  resultsListDiv.style.display = 'block';

  // Auto-scroll to top to show highest percentage
  resultsListDiv.scrollTop = 0;
}

// Global variable to track if search should stop
let shouldStop = false;

// Load search.json when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  const statusDiv = document.getElementById('status');
  const goButton = document.getElementById('goButton');
  const stopButton = document.getElementById('stopButton');
  const downloadButton = document.getElementById('downloadButton');
  const clearButton = document.getElementById('clearButton');
  const carsFileInput = document.getElementById('carsFile');
  const partInput = document.getElementById('partInput');
  const resultsDiv = document.getElementById('results');
  const percentageDiv = document.getElementById('percentage');
  const detailsDiv = document.getElementById('details');
  const resultsListDiv = document.getElementById('resultsList');

  let searchConfig = null;
  let uploadedCars = [];

  // Function to read JSON file
  function readJsonFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target.result);
          resolve(json);
        } catch (error) {
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.onerror = () => reject(new Error('Error reading file'));
      reader.readAsText(file);
    });
  }

  // Function to update status based on loaded data
  function updateStatus() {
    const cars = uploadedCars.length > 0 ? uploadedCars : (searchConfig ? searchConfig.cars : []);
    const part = partInput.value.trim();

    if (cars.length === 0) {
      statusDiv.textContent = 'Please upload cars JSON file';
      return false;
    }

    if (!part) {
      statusDiv.textContent = 'Please enter a part to search for';
      return false;
    }

    const numCars = cars.length;
    statusDiv.textContent = `Ready: ${numCars} car(s) × "${part}" (${numCars} searches total)`;
    return true;
  }

  // Handle cars file upload
  carsFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        uploadedCars = await readJsonFile(file);
        console.log('Loaded cars:', uploadedCars);
        updateStatus();
      } catch (error) {
        statusDiv.textContent = 'Error loading cars: ' + error.message;
      }
    }
  });

  // Handle part input change
  partInput.addEventListener('input', () => {
    updateStatus();
  });

  // Try to load default search.json
  try {
    statusDiv.textContent = 'Loading...';
    const searchUrl = chrome.runtime.getURL('search.json');
    const response = await fetch(searchUrl);
    searchConfig = await response.json();
    updateStatus();
  } catch (error) {
    console.log('No default search.json found, using uploaded files only');
    searchConfig = {
      baseUrl: 'https://www.ebay.com/sch/i.html?',
      soldParams: 'LH_Sold=1&LH_Complete=1',
      liveParams: 'LH_ItemCondition=1000'
    };
  }

  // Load and display existing search history
  const stored = await chrome.storage.local.get(['searchHistory']);
  const searchHistory = stored.searchHistory || [];
  if (searchHistory.length > 0) {
    const avgPercentage = Math.round(searchHistory.reduce((sum, r) => sum + r.percentage, 0) / searchHistory.length);
    percentageDiv.textContent = avgPercentage + '%';
    detailsDiv.textContent = `Average sell rate across ${searchHistory.length} searches`;
    resultsDiv.style.display = 'block';
    displayResultsList(searchHistory);
  }

  // Handle Stop button click
  stopButton.addEventListener('click', () => {
    shouldStop = true;
    statusDiv.textContent = 'Stopping...';
    stopButton.disabled = true;
  });

  // Handle Go button click
  goButton.addEventListener('click', async () => {
    const cars = uploadedCars.length > 0 ? uploadedCars : (searchConfig ? searchConfig.cars : []);
    const part = partInput.value.trim();

    if (!updateStatus()) {
      return;
    }

    shouldStop = false;
    goButton.disabled = true;
    stopButton.disabled = false;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    try {
      const allResults = [];
      let overallProgress = 0;
      const totalSearches = cars.length;

      // Get existing search history
      const stored = await chrome.storage.local.get(['searchHistory']);
      let searchHistory = stored.searchHistory || [];

      // Loop through each car with the single part
      for (let carIndex = 0; carIndex < cars.length; carIndex++) {
        // Check if we should stop
        if (shouldStop) {
          statusDiv.textContent = `Stopped! Checked ${overallProgress}/${totalSearches} cars`;
          break;
        }

        const car = cars[carIndex];
        const searchTerm = `${car} ${part}`;
        overallProgress++;

        statusDiv.textContent = `Checking ${car} - ${part} (${overallProgress}/${totalSearches})...`;

        // Navigate to sold page
        const soldUrl = `${searchConfig.baseUrl}_nkw=${encodeURIComponent(searchTerm)}&${searchConfig.soldParams}`;
        await chrome.tabs.update(tab.id, { url: soldUrl });

        // Wait and extract sold count with retry
        let soldCount = 0;
        let soldRetries = 0;
        while (soldRetries < 10) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          const soldResult = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: extractCount
          });
          const result = soldResult[0].result;

          // Check if we got a valid number
          if (result && !result.includes('not found') && !isNaN(parseInt(result))) {
            soldCount = parseInt(result);
            break;
          }
          soldRetries++;
          console.log(`Retry ${soldRetries} for sold count of ${part}`);
        }

        // Navigate to live page
        const liveUrl = `${searchConfig.baseUrl}_nkw=${encodeURIComponent(searchTerm)}&${searchConfig.liveParams}`;
        await chrome.tabs.update(tab.id, { url: liveUrl });

        // Wait and extract live count with retry
        let liveCount = 0;
        let liveRetries = 0;
        while (liveRetries < 10) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          const liveResult = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: extractCount
          });
          const result = liveResult[0].result;

          // Check if we got a valid number
          if (result && !result.includes('not found') && !isNaN(parseInt(result))) {
            liveCount = parseInt(result);
            break;
          }
          liveRetries++;
          console.log(`Retry ${liveRetries} for live count of ${part}`);
        }

        // Calculate percentage
        const percentage = liveCount > 0 ? Math.round((soldCount / liveCount) * 100) : 0;

        // Create result object
        const result = {
          car: car,
          part: part,
          searchTerm: searchTerm,
          percentage: percentage,
          soldCount: soldCount,
          liveCount: liveCount,
          timestamp: new Date().toISOString()
        };
        allResults.push(result);

        // Check if search term already exists and update it, or add new
        const existingIndex = searchHistory.findIndex(entry => entry.searchTerm === searchTerm);
        if (existingIndex !== -1) {
          // Update existing entry
          searchHistory[existingIndex] = result;
        } else {
          // Add new entry
          searchHistory.push(result);
        }

        // Save to storage immediately
        await chrome.storage.local.set({ searchHistory: searchHistory });

        // Update live results after each search
        const avgPercentage = Math.round(allResults.reduce((sum, r) => sum + r.percentage, 0) / allResults.length);
        percentageDiv.textContent = avgPercentage + '%';
        detailsDiv.textContent = `Average sell rate across ${allResults.length} search(es)`;
        resultsDiv.style.display = 'block';
        displayResultsList(searchHistory);
      }

      // Display final result
      const avgPercentage = Math.round(allResults.reduce((sum, r) => sum + r.percentage, 0) / allResults.length);
      if (shouldStop) {
        statusDiv.textContent = `Stopped at ${overallProgress}/${totalSearches} - Data saved and ready to download`;
      } else {
        statusDiv.textContent = `Complete! Checked ${totalSearches} cars`;
      }
      percentageDiv.textContent = avgPercentage + '%';
      detailsDiv.textContent = `Average sell rate across all searches`;
      resultsDiv.style.display = 'block';
      displayResultsList(searchHistory);

      // Re-enable buttons
      goButton.disabled = false;
      stopButton.disabled = true;
    } catch (error) {
      statusDiv.textContent = 'Error: ' + error.message;
      console.error('Error:', error);
      goButton.disabled = false;
      stopButton.disabled = true;
    }
  });

  // Handle Download button click
  downloadButton.addEventListener('click', async () => {
    try {
      // Get search history from storage
      const stored = await chrome.storage.local.get(['searchHistory']);
      const searchHistory = stored.searchHistory || [];

      if (searchHistory.length === 0) {
        statusDiv.textContent = 'No data to download';
        return;
      }

      // Create CSV content
      const headers = ['Search Term', 'Sell Through Rate', 'Sold Count'];
      const rows = searchHistory.map(entry => [
        entry.searchTerm,
        entry.percentage + '%',
        entry.soldCount
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      // Create blob and download
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'results.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      statusDiv.textContent = `Downloaded ${searchHistory.length} records to results.csv`;
    } catch (error) {
      statusDiv.textContent = 'Error: ' + error.message;
      console.error('Error:', error);
    }
  });

  // Handle Clear button click
  clearButton.addEventListener('click', async () => {
    try {
      // Clear the search history from storage
      await chrome.storage.local.remove(['searchHistory']);

      // Hide results
      resultsDiv.style.display = 'none';
      resultsListDiv.style.display = 'none';

      statusDiv.textContent = 'Data cleared!';
    } catch (error) {
      statusDiv.textContent = 'Error: ' + error.message;
      console.error('Error:', error);
    }
  });
});

