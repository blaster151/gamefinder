document.addEventListener('DOMContentLoaded', () => {
  const gameInput = document.getElementById('gameInput');
  const searchButton = document.getElementById('searchButton');
  const pasteButton = document.getElementById('pasteFromClipboard');
  const results = document.getElementById('results');

  const createResultElement = (game) => {
    const div = document.createElement('div');
    div.className = 'result-item pending';
    div.innerHTML = `
      <div class="spinner"></div>
      <span>${game}: Searching...</span>
    `;
    return div;
  };

  const updateResultElement = (element, result, isError = false) => {
    element.innerHTML = isError
      ? `❌ ${element.textContent.split(':')[0]}: ${result}`
      : `✅ ${element.textContent.split(':')[0]}: ${result}`;
    element.className = `result-item ${isError ? 'error' : 'success'}`;
  };

  pasteButton.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      gameInput.value = text;
    } catch (err) {
      results.innerHTML = '<div class="result-item error">Please paste manually (Ctrl/Cmd+V)</div>';
    }
  });

  searchButton.addEventListener('click', async () => {
    const games = gameInput.value
      .split('\n')
      .map(game => game.trim())
      .filter(game => game.length > 0);

    if (games.length === 0) {
      results.innerHTML = '<div class="result-item error">Please enter at least one game title</div>';
      return;
    }

    if (games.length > 20) {
      results.innerHTML = '<div class="result-item error">Please limit to 20 games at a time</div>';
      return;
    }

    results.innerHTML = '';
    searchButton.disabled = true;
    searchButton.textContent = '🔍 Searching...';

    const CONCURRENT_SEARCHES = 3;
    const chunks = [];
    
    for (let i = 0; i < games.length; i += CONCURRENT_SEARCHES) {
      const chunk = games.slice(i, i + CONCURRENT_SEARCHES);
      const searches = chunk.map(async game => {
        const resultElement = createResultElement(game);
        results.appendChild(resultElement);
        
        try {
          const result = await chrome.runtime.sendMessage({
            type: 'searchGame',
            game: game
          });
          updateResultElement(resultElement, result || 'Not found', !result);
        } catch (err) {
          updateResultElement(resultElement, `Error - ${err.message}`, true);
        }
      });
      await Promise.all(searches);
    }

    searchButton.disabled = false;
    searchButton.textContent = '🔍 Find Release Dates';
  });
}); 