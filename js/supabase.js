/**
 * Daeyang Meal - Supabase Realtime Shared Cloud Database Module
 */
const SupabaseModule = {
  SUPABASE_URL: 'https://afpsimkmmanxrxyojuuz.supabase.co',
  SUPABASE_KEY: 'sb_publishable_OV-8fxn_SRrjMQm-Dnq5hA_ebmITTX3',

  client: null,
  realtimeCallbacks: [],

  init() {
    if (window.supabase && window.supabase.createClient) {
      try {
        this.client = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_KEY);
        this.setupRealtimeSubscription();
      } catch (e) {
        console.warn('Supabase client init error:', e);
      }
    }
  },

  /**
   * Subscribe to Realtime postgres_changes on 'meal_reactions' table
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

            // Notify UI subscribers for real-time live update across devices
            this.realtimeCallbacks.forEach(cb => cb(mealId, updatedCounts));
          }
        })
        .subscribe();
    } catch (e) {
      console.warn('Realtime subscription warning:', e);
    }
  },

  onRealtimeUpdate(callback) {
    this.realtimeCallbacks.push(callback);
  },

  /**
   * Fetch reaction counts for a meal_id
   */
  async getReactions(mealId) {
    if (this.client) {
      try {
        const { data, error } = await this.client
          .from('meal_reactions')
          .select('*')
          .eq('meal_id', mealId)
          .single();

        if (error) {
          if (error.code === '42P01' || error.status === 404) {
            console.error('🚨 Supabase Error: meal_reactions 테이블이 생성되지 않았습니다! SQL Editor에서 테이블을 생성해주세요.');
          }
        }

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

    // Local Storage fallback if table empty or fetching
    const local = JSON.parse(localStorage.getItem(`shared_react_${mealId}`) || 'null');
    return local || { like: 0, neutral: 0, dislike: 0 };
  },

  /**
   * Vote / Increment reaction for a meal_id
   */
  async voteReaction(mealId, type, delta = 1) {
    const current = await this.getReactions(mealId);
    if (type in current) {
      current[type] = Math.max(0, (current[type] || 0) + delta);
    }

    // Save local backup
    localStorage.setItem(`shared_react_${mealId}`, JSON.stringify(current));

    // Upsert to Supabase
    if (this.client) {
      try {
        const { error } = await this.client
          .from('meal_reactions')
          .upsert({
            meal_id: mealId,
            like_count: current.like,
            neutral_count: current.neutral,
            dislike_count: current.dislike,
            updated_at: new Date().toISOString()
          });

        if (error) {
          console.error('🚨 Supabase Upsert Error:', error.message);
        }
      } catch (e) {
        console.warn('Supabase upsert error:', e);
      }
    }

    return current;
  }
};
