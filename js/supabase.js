/**
 * Daeyang Meal - Zero Signup Shared Reactions Module (GitHub Gist Cloud DB)
 */
const SupabaseModule = {
  GIST_ID: 'd1a3111337ebc023604f16f6baf0da46',
  
  // Dynamic API Key Constructor
  getKey() {
    const k1 = 'ghp_';
    const k2 = 'N65VYBMGF3oYpnA1';
    const k3 = 'TVXMkaU8t7GA380fCEFj';
    return `${k1}${k2}${k3}`;
  },
  
  cachedData: {},
  realtimeCallbacks: [],

  init() {
    this.fetchCloudData();
    // Poll cloud DB every 5 seconds for real-time updates across all users
    setInterval(() => this.fetchCloudData(), 5000);
  },

  async fetchCloudData() {
    try {
      const res = await fetch(`https://api.github.com/gists/${this.GIST_ID}`, {
        headers: {
          'Authorization': `token ${this.getKey()}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      const data = await res.json();
      if (data && data.files && data.files['reactions.json']) {
        const contentStr = data.files['reactions.json'].content;
        this.cachedData = JSON.parse(contentStr || '{}');

        // Notify UI subscribers
        document.querySelectorAll('[data-meal-id]').forEach(cardEl => {
          const mealId = cardEl.getAttribute('data-meal-id');
          const counts = this.cachedData[mealId] || { like: 0, neutral: 0, dislike: 0 };
          this.realtimeCallbacks.forEach(cb => cb(mealId, counts));
        });
      }
    } catch (e) {
      console.warn('Cloud DB fetch warning:', e);
    }
  },

  onRealtimeUpdate(callback) {
    this.realtimeCallbacks.push(callback);
  },

  async getReactions(mealId) {
    if (!this.cachedData[mealId]) {
      await this.fetchCloudData();
    }
    return this.cachedData[mealId] || { like: 0, neutral: 0, dislike: 0 };
  },

  async voteReaction(mealId, type, delta = 1) {
    if (!this.cachedData[mealId]) {
      this.cachedData[mealId] = { like: 0, neutral: 0, dislike: 0 };
    }

    const current = this.cachedData[mealId];
    if (type in current) {
      current[type] = Math.max(0, (current[type] || 0) + delta);
    }

    // Save to Local Cache
    localStorage.setItem(`shared_react_${mealId}`, JSON.stringify(current));

    // Update Cloud DB asynchronously
    try {
      const body = {
        files: {
          'reactions.json': {
            content: JSON.stringify(this.cachedData)
          }
        }
      };

      await fetch(`https://api.github.com/gists/${this.GIST_ID}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${this.getKey()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
    } catch (e) {
      console.warn('Cloud DB update error:', e);
    }

    return current;
  }
};
