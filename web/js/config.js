/**
 * Centralized configuration for the Insighta portal
 * All API URLs and constants should be defined here
 *
 * To customize the API base URL:
 *   1. Edit this file directly, or
 *   2. Set window.INSIGHTA_API_BASE before loading this script
 */

const CONFIG = {
  // API Configuration
  // Check for global override first, then use hardcoded value
  API_BASE: (typeof window !== 'undefined' && window.INSIGHTA_API_BASE !== undefined)
    ? window.INSIGHTA_API_BASE
    : '',
  
  API_VERSION: '1',
  
  ENV: 'development',

  // CSRF Token storage
  CSRF_STORAGE_KEY: 'csrf_token',

  // API Headers
  getHeaders: function(includeCSRF) {
    if (includeCSRF === undefined) {
      includeCSRF = true;
    }
    
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Version': this.API_VERSION
    };

    // Add CSRF token for state-changing requests
    if (includeCSRF) {
      const csrfToken = localStorage.getItem(this.CSRF_STORAGE_KEY);
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
    }

    return headers;
  },

  // Pagination defaults
  DEFAULT_LIMIT: 10,

  // Error messages
  ERRORS: {
    UNAUTHORIZED: 'Please log in to continue',
    NOT_FOUND: 'Resource not found',
    SERVER_ERROR: 'Server error. Please try again later',
    NETWORK_ERROR: 'Network error. Please check your connection',
    CSRF_ERROR: 'Security token expired. Please refresh and try again.'
  },

  // Feature flags
  FEATURES: {
    PROFILE_CREATION: true,
    PROFILE_DELETION: true,
    CSV_EXPORT: true
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
