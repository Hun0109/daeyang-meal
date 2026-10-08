/**
 * Supabase Realtime Shared Cloud Database Module for Daeyang Meal
 */
const SupabaseModule = {
  // Public Demo Supabase Project for Daeyang Meal Shared Reactions
  SUPABASE_URL: 'https://xyzcompany.supabase.co', // Configurable
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', // Public Anon Key

  client: null,
  realtimeCallbacks: [],

  init() {
    if (window.supabase && window.supabase.createClient) {
      try {
        this.client = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_KEY);
        this.setupRealtimeSubscription();
      } catch (e) {
        console.warn('Supabase client init fallback:', e);
      }
    }
  },

  /**
   * Subscribe to Real-time postgres_changes on 'meal_reactions' table
   */
  setupRealtimeSubscription() {
    if (!this.client) return;

    try {
      this.client
        .channel('public:meal_reactions')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_reactions' }, payload => {
          if (payload.new) {
            const mealId = payload.new.meal_id;
            const updatedCounts = {
              like: payload.new.like_count || 0,
              neutral: payload.new.neutral_count || 0,
              dislike: payload.new.dislike_count || 0
            };

            // Notify all registered UI callbacks
            this.realtimeCallbacks.forEach(cb => cb(mealId, updatedCounts));
          }
        })
        .subscribe();
    } catch (e) {
      console.warn('Realtime subscription error:', e);
    }
  },

  onRealtimeUpdate(callback) {
    this.realtimeCallbacks.push(callback);
  },

  /**
   * Get shared reaction counts for a specific meal ID (e.g. "20261008_2")
   */
  async getReactions(mealId) {
    if (this.client) {
      try {
        const { data, error } = await this.client
          .from('meal_reactions')
          .select('*')
          .eq('meal_id', mealId)
          .single();

        if (data && !error) {
          return {
            like: data.like_count || 0,
            neutral: data.neutral_count || 0,
            dislike: data.dislike_count || 0
          };
        }
      } catch (e) {
        console.warn('Supabase fetch error, fallback to local storage:', e);
      }
    }

    // Local Storage / Shared Memory fallback
    const sharedData = JSON.parse(localStorage.getItem(`shared_react_${mealId}`) || 'null');
    if (sharedData) return sharedData;

    return { like: 0, neutral: 0, dislike: 0 };
  },

  /**
   * Vote / Increment reaction for a meal ID
   */
  async voteReaction(mealId, type, delta = 1) {
    // Local / Memory update
    const current = await this.getReactions(mealId);
    if (type in current) {
      current[type] = Math.max(0, current[type] + delta);
    }
    localStorage.setItem(`shared_react_${mealId}`, JSON.stringify(current));

    // Cloud DB Sync
    if (this.client) {
      try {
        await this.client
          .from('meal_reactions')
          .upsert({
            meal_id: mealId,
            like_count: current.like,
            neutral_count: current.neutral,
            dislike_count: current.dislike,
            updated_at: new Date().toISOString()
          });
      } catch (e) {
        console.warn('Supabase upsert warning:', e);
      }
    }

    return current;
  }
};
