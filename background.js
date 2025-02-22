// Configuration for different sources
const sources = {
  steam: {
    searchUrl: 'https://store.steampowered.com/search/?term={game}',
    directUrl: 'https://store.steampowered.com/app/{appId}',
    extractDate: async (tab) => {
      const result = await chrome.tabs.sendMessage(tab.id, {
        action: 'extractSteamDate'
      });
      return result;
    },
    extractSearchResults: async (tab) => {
      const result = await chrome.tabs.sendMessage(tab.id, {
        action: 'extractSteamSearchResults'
      });
      return result;
    }
  },
  wikipedia: {
    urlTemplate: 'https://en.wikipedia.org/w/index.php?search={game}+video+game',
    extractDate: async (tab) => {
      const result = await chrome.tabs.sendMessage(tab.id, {
        action: 'extractWikipediaDate'
      });
      return result;
    }
  },
  metacritic: {
    urlTemplate: 'https://www.metacritic.com/search/game/{game}/results',
    extractDate: async (tab) => {
      const result = await chrome.tabs.sendMessage(tab.id, {
        action: 'extractMetacriticDate'
      });
      return result;
    }
  }
};

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'searchGame') {
    findGameReleaseDate(request.game).then(sendResponse);
    return true; // Will respond asynchronously
  }
});

async function findGameReleaseDate(game) {
  try {
    // Start all searches in parallel
    const searchPromises = Object.entries(sources).map(async ([sourceName, source]) => {
      try {
        let result;
        
        if (sourceName === 'steam') {
          // Special handling for Steam to get direct page if possible
          result = await searchSteam(game, source);
        } else {
          // Standard search for other sources
          const url = source.urlTemplate.replace('{game}', encodeURIComponent(game));
          const tab = await chrome.tabs.create({ url, active: false });
          
          // Wait for page load
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          result = await source.extractDate(tab);
          await chrome.tabs.remove(tab.id);
        }

        return {
          source: sourceName,
          ...result
        };
      } catch (error) {
        console.error(`Error with ${sourceName}:`, error);
        return { source: sourceName, error: error.message };
      }
    });

    // Wait for all searches to complete
    const results = await Promise.all(searchPromises);
    
    // Filter out errors and empty results
    const validResults = results.filter(r => r && r.date && !r.error);
    
    if (validResults.length === 0) {
      return 'No release date found';
    }

    // Group dates to find matches
    const dateGroups = validResults.reduce((groups, result) => {
      const date = normalizeDate(result.date);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(result.source);
      return groups;
    }, {});

    // Find the most confident result
    const [bestDate, sources] = Object.entries(dateGroups)
      .sort(([, a], [, b]) => b.length - a.length)[0];

    // Format the response based on confidence
    if (sources.length > 1) {
      return `${bestDate} (${sources.length} sources agree)`;
    } else {
      return `${bestDate} (from ${sources[0]})`;
    }

  } catch (error) {
    console.error('Search error:', error);
    return `Error: ${error.message}`;
  }
}

async function searchSteam(game, source) {
  // First search Steam to get the app ID
  const searchTab = await chrome.tabs.create({
    url: source.searchUrl.replace('{game}', encodeURIComponent(game)),
    active: false
  });

  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const searchResults = await source.extractSearchResults(searchTab);
  await chrome.tabs.remove(searchTab.id);

  if (searchResults && searchResults.appId) {
    // If we found an app ID, get the direct page
    const directTab = await chrome.tabs.create({
      url: source.directUrl.replace('{appId}', searchResults.appId),
      active: false
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const result = await source.extractDate(directTab);
    await chrome.tabs.remove(directTab.id);
    return result;
  }

  return null;
}

function normalizeDate(dateStr) {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateStr; // Return original if parsing fails
  }
} 