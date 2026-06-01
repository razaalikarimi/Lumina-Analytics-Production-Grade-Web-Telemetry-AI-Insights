(function () {
  // Prevent double loading
  if (window.__analytics_initialized) return;
  window.__analytics_initialized = true;

  // Find the script tag that loaded this file
  const currentScript = document.currentScript || (function() {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  const apiKey = currentScript.getAttribute('data-api-key');
  const host = currentScript.getAttribute('data-host') || 'http://localhost:3001';

  if (!apiKey) {
    console.error('Analytics SDK: Missing data-api-key attribute on the script tag.');
    return;
  }

  // Generate or retrieve session ID (expires when tab is closed)
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = generateUUID();
    sessionStorage.setItem('analytics_session_id', sessionId);
  }

  // Generate a random UUID
  function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'session-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString(36);
  }

  // Track event core function
  function track(eventName, eventData = null) {
    const payload = {
      apiKey,
      sessionId,
      eventName,
      eventData,
      url: window.location.href,
      referrer: document.referrer || null,
    };

    const targetUrl = `${host}/track`;

    // Attempt to send via fetch with keepalive: true (supported in modern browsers, perfect for exit logs)
    if (typeof fetch === 'function') {
      fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(err => console.warn('Analytics SDK transmission error:', err));
    } else if (typeof navigator.sendBeacon === 'function') {
      // Fallback to sendBeacon
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(targetUrl, blob);
    }
  }

  // Expose public API
  window.analytics = {
    track: track,
    getSessionId: () => sessionId,
  };

  // Track initial page view
  track('pageview', { title: document.title });

  // Hook into client-side SPA routing (History API)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    // Slight delay to allow DOM/Title updates
    setTimeout(() => {
      track('pageview', { title: document.title });
    }, 50);
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    setTimeout(() => {
      track('pageview', { title: document.title });
    }, 50);
  };

  window.addEventListener('popstate', () => {
    track('pageview', { title: document.title });
  });

  // Track clicks on elements with data-track attributes
  document.addEventListener('click', (event) => {
    let target = event.target;
    // Walk up the DOM tree to find data-track attribute
    while (target && target !== document.body) {
      if (target.hasAttribute('data-track')) {
        const eventName = target.getAttribute('data-track');
        let rawData = target.getAttribute('data-track-data');
        let eventData = null;

        if (rawData) {
          try {
            eventData = JSON.parse(rawData);
          } catch (e) {
            eventData = { raw: rawData };
          }
        }

        track(eventName, eventData);
        break;
      }
      target = target.parentElement;
    }
  });

  console.log('Analytics SDK: Initialized successfully for key:', apiKey);
})();
