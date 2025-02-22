// Configuration for different sources
const sources = {
  steam: {
    urlTemplate: 'https://store.steampowered.com/search/?term={game}',
    extractDate: async (tab) => {
      const result = await chrome.tabs.sendMessage(tab.id, {
        action: 'extractSteamDate'
      });
      return result;
    }
  },
  metacritic: {
    urlTemplate: 'https://www.metacritic.com/search/{game}/',
    extractDate: async (tab) => {
      const result = await chrome.tabs.sendMessage(tab.id, {
        action: 'extractMetacriticDate'
      });
      return result;
    }
  },
  google: {
    urlTemplate: 'https://www.google.com/search?q={game}+video+game+release+date',
    extractDate: async (tab) => {
      const result = await chrome.tabs.sendMessage(tab.id, {
        action: 'extractGoogleDate'
      });
      return result;
    }
  }
};

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'findReleaseDates') {
    handleReleaseDateSearch(request.games).then(sendResponse);
    return true; // Will respond asynchronously
  }
});

async function handleReleaseDateSearch(games) {
  const results = [];
  
  for (const game of games) {
    try {
      const result = await findGameReleaseDate(game);
      results.push(result);
    } catch (error) {
      results.push({
        game,
        error: error.message
      });
    }
  }
  
  return results;
}

async function findGameReleaseDate(game) {
  // Try each source in sequence until we find a date
  for (const [sourceName, source] of Object.entries(sources)) {
    try {
      const url = source.urlTemplate.replace('{game}', encodeURIComponent(game));
      
      // Create a new tab
      const tab = await chrome.tabs.create({
        url,
        active: false
      });

      // Wait for the page to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Try to extract the date
      const result = await source.extractDate(tab);
      
      // Close the tab
      await chrome.tabs.remove(tab.id);

      if (result && result.date) {
        return {
          game,
          date: result.date,
          source: sourceName
        };
      }
    } catch (error) {
      console.error(`Error with ${sourceName}:`, error);
      // Continue to next source
    }
  }

  // If we get here, we couldn't find a date
  return {
    game,
    error: 'Could not find release date in any source'
  };
} 