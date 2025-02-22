document.addEventListener('DOMContentLoaded', () => {
  const gameInput = document.getElementById('gameInput');
  const searchButton = document.getElementById('searchButton');
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
    const gameTitle = element.getAttribute('data-game');
    if (isError) {
      element.innerHTML = `❌ ${gameTitle}: ${result}`;
      element.className = 'result-item error';
    } else {
      element.className = 'result-item success';
      element.innerHTML = `<span>✅ ${gameTitle}: ${result}</span>`;
      element.setAttribute('data-result', result);  // Store clean result in data attribute
    }
  };

  // Function to copy all results
  const copyResults = () => {
    // Get all result elements (both success and error) in their original order
    const allResults = Array.from(results.querySelectorAll('.result-item'))
      .map(result => {
        if (result.classList.contains('success')) {
          const fullResult = result.getAttribute('data-result');
          return fullResult.split(' (')[0].trim();  // Just get the date part
        }
        return '';  // Empty string for errors/not found
      })
      .join('\n');  // Join with newlines
    
    navigator.clipboard.writeText(allResults).then(() => {
      const feedback = document.createElement('div');
      feedback.className = 'copy-feedback';
      feedback.textContent = 'Results copied!';
      results.appendChild(feedback);
      setTimeout(() => feedback.remove(), 2000);
    });
  };

  const showError = (message) => {
    results.style.display = 'block';
    results.innerHTML = `<div class="result-item error">${message}</div>`;
  };

  // Handle messages from background script
  chrome.runtime.onMessage.addListener((message) => {
    const resultElement = results.querySelector(`[data-game="${message.game}"]`);
    
    switch (message.type) {
      case 'searchStarted':
        // Update or create result element
        if (!resultElement) {
          const newElement = createResultElement(message.game);
          newElement.setAttribute('data-game', message.game);
          results.appendChild(newElement);
        }
        break;
        
      case 'searchComplete':
        if (resultElement) {
          updateResultElement(resultElement, message.result, message.result === 'No release date found');
        }
        break;
        
      case 'searchError':
        if (resultElement) {
          updateResultElement(resultElement, `Error - ${message.error}`, true);
        }
        break;
        
      case 'allComplete':
        searchButton.disabled = false;
        searchButton.textContent = '🔍 Find Release Dates';
        
        // Add copy button after all results
        const copyButton = document.createElement('button');
        copyButton.id = 'copyAllButton';
        copyButton.textContent = '📋 Copy Results';
        copyButton.addEventListener('click', copyResults);
        results.appendChild(copyButton);
        break;
    }
  });

  searchButton.addEventListener('click', async () => {
    const games = gameInput.value
      .split('\n')
      .map(game => game.trim())
      .filter(game => game.length > 0);

    if (games.length === 0) {
      showError('Please enter at least one game title');
      return;
    }

    if (games.length > 20) {
      showError('Please limit to 20 games at a time');
      return;
    }

    results.style.display = 'block';
    results.innerHTML = '';

    searchButton.disabled = true;
    searchButton.textContent = '🔍 Searching...';

    // Start the search process
    chrome.runtime.sendMessage({
      type: 'searchGames',
      games: games
    });
  });
}); 