class GameReleaseFinder {
  constructor() {
    this.sources = {
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
      },
      appStore: {
        searchUrl: 'https://apps.apple.com/search?term={game}&entity=apps&limit=1',
        directUrl: 'https://apps.apple.com/app/id{appId}',
        extractSearchResults: async (tab) => {
          try {
            const text = await tab.document.body.textContent;
            const data = JSON.parse(text);
            if (data.results && data.results.length > 0) {
              return { appId: data.results[0].trackId };
            }
            return null;
          } catch (error) {
            console.error('Error parsing App Store search results:', error);
            return null;
          }
        },
        extractDate: async (tab) => {
          const result = await chrome.tabs.sendMessage(tab.id, {
            action: 'extractAppStoreDate'
          });
          return result;
        }
      }
    };

    // Set up message listener
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'searchGames') {
        // Start the search process but don't wait for it
        this.findGameReleaseDates(request.games);
        sendResponse({ status: 'started' });
        return false; // No async response needed
      }
    });
  }

  async createHiddenWindow(url) {
    // Create a hidden tab in the current window
    const tab = await chrome.tabs.create({
      url,
      active: false,  // Don't focus the tab
      selected: false // Keep current tab selected
    });
    
    return tab;
  }

  async cleanupWindow(tab) {
    await chrome.tabs.remove(tab.id);
  }

  async injectContentScript(tab) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content_script.js']
      });
      // Wait a bit for the script to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Failed to inject content script:', error);
      throw error;
    }
  }

  async searchSteam(game, source) {
    // First search Steam to get the app ID
    const searchTab = await this.createHiddenWindow(
      source.searchUrl.replace('{game}', encodeURIComponent(game))
    );

    // Wait for page load and inject content script
    await new Promise(resolve => setTimeout(resolve, 2000));
    await this.injectContentScript(searchTab);
    
    const searchResults = await source.extractSearchResults(searchTab);
    await this.cleanupWindow(searchTab);

    if (searchResults && searchResults.appId) {
      // If we found an app ID, get the direct page
      const directTab = await this.createHiddenWindow(
        source.directUrl.replace('{appId}', searchResults.appId)
      );

      await new Promise(resolve => setTimeout(resolve, 2000));
      await this.injectContentScript(directTab);
      
      const result = await source.extractDate(directTab);
      await this.cleanupWindow(directTab);
      return result;
    }

    return null;
  }

  async searchAppStore(game, source) {
    // First search App Store to get the app ID
    const searchTab = await this.createHiddenWindow(
      source.searchUrl.replace('{game}', encodeURIComponent(game))
    );

    // Wait for page load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const searchResults = await source.extractSearchResults(searchTab);
    await this.cleanupWindow(searchTab);

    if (searchResults && searchResults.appId) {
      // If we found an app ID, get the direct page
      const directTab = await this.createHiddenWindow(
        source.directUrl.replace('{appId}', searchResults.appId)
      );

      await new Promise(resolve => setTimeout(resolve, 2000));
      await this.injectContentScript(directTab);
      
      const result = await source.extractDate(directTab);
      await this.cleanupWindow(directTab);
      return result;
    }

    return null;
  }

  async findGameReleaseDates(games) {
    // Process games in chunks of 3
    const CHUNK_SIZE = 3;
    for (let i = 0; i < games.length; i += CHUNK_SIZE) {
      const chunk = games.slice(i, i + CHUNK_SIZE);
      
      // Process this chunk in parallel
      await Promise.all(chunk.map(async game => {
        try {
          // Notify progress
          this.broadcastProgress({
            type: 'searchStarted',
            game
          });

          const result = await this.findGameReleaseDate(game);
          
          // Notify result
          this.broadcastProgress({
            type: 'searchComplete',
            game,
            result
          });
        } catch (error) {
          // Notify error
          this.broadcastProgress({
            type: 'searchError',
            game,
            error: error.message
          });
        }
      }));
    }

    // Notify all searches complete
    this.broadcastProgress({
      type: 'allComplete'
    });
  }

  broadcastProgress(message) {
    // Send message to all extension views (popups)
    chrome.runtime.sendMessage(message).catch(() => {
      // Ignore errors - popup might be closed
    });
  }

  async findGameReleaseDate(game) {
    try {
      console.log('Starting search for:', game);
      
      // Check if it's an iOS game
      if (game.toLowerCase().endsWith('ios')) {
        // Remove "iOS" suffix for search
        const cleanName = game.slice(0, -3).trim();
        const result = await this.searchAppStore(cleanName, this.sources.appStore);

        if (result && result.date) {
          return `${result.date} (from App Store)`;
        }
      }

      // If not iOS or App Store search failed, try Steam
      const result = await this.searchSteam(game, this.sources.steam);
      if (result && result.date) {
        const date = this.normalizeDate(result.date);
        return `${date} (from Steam)`;
      }

      return 'No release date found';
    } catch (error) {
      console.error('Search error:', error);
      return `Error: ${error.message}`;
    }
  }

  normalizeDate(dateStr) {
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
}

// Initialize the finder
const finder = new GameReleaseFinder(); 