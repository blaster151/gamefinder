// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'extractSteamDate':
      sendResponse(extractSteamDate());
      break;
    case 'extractMetacriticDate':
      sendResponse(extractMetacriticDate());
      break;
    case 'extractGoogleDate':
      sendResponse(extractGoogleDate());
      break;
  }
  return true; // Will respond asynchronously
});

function extractSteamDate() {
  try {
    // First try to find the release date on a game's page
    const releaseDateElement = document.querySelector('.release_date .date');
    if (releaseDateElement) {
      return {
        date: releaseDateElement.textContent.trim()
      };
    }

    // If we're on search results, try to find the first result's release date
    const searchResults = document.querySelectorAll('.search_result_row');
    for (const result of searchResults) {
      const dateElement = result.querySelector('.search_released');
      if (dateElement) {
        return {
          date: dateElement.textContent.trim()
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting Steam date:', error);
    return null;
  }
}

function extractMetacriticDate() {
  try {
    // Try to find release date in game details
    const releaseDateElement = document.querySelector('.release_data');
    if (releaseDateElement) {
      return {
        date: releaseDateElement.textContent.replace('Release Date:', '').trim()
      };
    }

    // If we're on search results, try to find the first result's release date
    const searchResults = document.querySelectorAll('.main_stats');
    for (const result of searchResults) {
      const dateElement = result.querySelector('.release_date');
      if (dateElement) {
        return {
          date: dateElement.textContent.trim()
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting Metacritic date:', error);
    return null;
  }
}

function extractGoogleDate() {
  try {
    // Try to find the release date in Google's knowledge panel
    const knowledgePanel = document.querySelector('.kp-header');
    if (knowledgePanel) {
      const dateElements = knowledgePanel.querySelectorAll('[data-attrid*="release_date"]');
      for (const element of dateElements) {
        const date = element.textContent.replace('Release date:', '').trim();
        if (date) {
          return {
            date: date
          };
        }
      }
    }

    // Try to find structured data in search results
    const searchResults = document.querySelectorAll('.g');
    for (const result of searchResults) {
      const datePattern = /Release date: ([A-Za-z]+ \d+, \d{4})|Released: ([A-Za-z]+ \d+, \d{4})/i;
      const match = result.textContent.match(datePattern);
      if (match) {
        return {
          date: match[1] || match[2]
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting Google date:', error);
    return null;
  }
} 