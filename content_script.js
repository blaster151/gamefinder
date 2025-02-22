// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'extractSteamDate':
      sendResponse(extractSteamDate());
      break;
    case 'extractSteamSearchResults':
      sendResponse(extractSteamSearchResults());
      break;
    case 'extractWikipediaDate':
      sendResponse(extractWikipediaDate());
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

function extractSteamSearchResults() {
  try {
    const firstResult = document.querySelector('a.search_result_row');
    if (firstResult) {
      const appId = firstResult.href.match(/\/app\/(\d+)\//)?.[1];
      if (appId) {
        return { appId };
      }
    }
    return null;
  } catch (error) {
    console.error('Error extracting Steam search results:', error);
    return null;
  }
}

function extractSteamDate() {
  try {
    // Check for upcoming game
    const comingSoonElement = document.querySelector('.game_area_comingsoon');
    if (comingSoonElement) {
      const dateText = comingSoonElement.textContent.match(/Coming\s+(\w+\s+\d+,\s+\d{4})/i);
      if (dateText) {
        return { date: dateText[1] };
      }
    }

    // Check for released game
    const releaseDateElement = document.querySelector('.release_date .date');
    if (releaseDateElement) {
      const date = releaseDateElement.textContent.trim();
      if (date) {
        return { date };
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting Steam date:', error);
    return null;
  }
}

function extractWikipediaDate() {
  try {
    // First try to find the infobox release date
    const infobox = document.querySelector('.infobox');
    if (infobox) {
      const rows = infobox.querySelectorAll('tr');
      for (const row of rows) {
        if (row.textContent.includes('Release')) {
          const dateText = row.querySelector('td')?.textContent.trim();
          if (dateText) {
            // Handle multiple dates by taking the earliest
            const dates = dateText.split(/[,;]/);
            const firstDate = dates[0].trim();
            return { date: firstDate };
          }
        }
      }
    }

    // Fallback to first paragraph mention of release
    const content = document.querySelector('#mw-content-text');
    if (content) {
      const releaseMatch = content.textContent.match(/released\s+(?:on\s+)?([A-Z][a-z]+\s+\d+,\s+\d{4})/i);
      if (releaseMatch) {
        return { date: releaseMatch[1] };
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting Wikipedia date:', error);
    return null;
  }
}

function extractMetacriticDate() {
  try {
    // Try the main game page first
    const releaseDateElement = document.querySelector('[data-qa="release-date"]');
    if (releaseDateElement) {
      return {
        date: releaseDateElement.textContent.trim()
      };
    }

    // Try search results
    const searchResults = document.querySelectorAll('.c-pageSiteSearch-results-item');
    for (const result of searchResults) {
      const dateElement = result.querySelector('.c-siteReviewScore_releaseDate');
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