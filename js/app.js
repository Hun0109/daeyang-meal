/**
 * Daeyang High School Meal Assistant Main Application Script
 * Enhanced with Supabase Realtime Shared Reactions
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Supabase Module
  SupabaseModule.init();

  // State Variables
  let currentDate = new Date();
  let selectedAllergies = JSON.parse(localStorage.getItem('daeyang_allergies') || '[]');
  let userReactionsChoice = JSON.parse(localStorage.getItem('daeyang_user_choices') || '{}');

  // DOM Elements
  const liveTimeEl = document.getElementById('liveTime');
  const themeToggleBtn = document.getElementById('themeToggle');
  const datePicker = document.getElementById('datePicker');
  const allergyChipsContainer = document.getElementById('allergyChips');
  const mealContainer = document.getElementById('mealContainer');
  const weeklyGrid = document.getElementById('weeklyGrid');
  const countdownText = document.getElementById('countdownText');
  const countdownSub = document.getElementById('countdownSub');
  const mealStatusChip = document.getElementById('mealStatusChip');
  const bannerEmoji = document.getElementById('bannerEmoji');

  // Initial Theme Setup
  const savedTheme = localStorage.getItem('daeyang_theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.setAttribute('data-theme', 'light');
    themeToggleBtn.textContent = '☀️';
  } else {
    document.body.removeAttribute('data-theme');
    themeToggleBtn.textContent = '🌙';
  }

  // Theme Toggle Event
  themeToggleBtn.addEventListener('click', () => {
    const isLight = document.body.getAttribute('data-theme') === 'light';
    if (isLight) {
      document.body.removeAttribute('data-theme');
      localStorage.setItem('daeyang_theme', 'dark');
      themeToggleBtn.textContent = '🌙';
    } else {
      document.body.setAttribute('data-theme', 'light');
      localStorage.setItem('daeyang_theme', 'light');
      themeToggleBtn.textContent = '☀️';
    }
  });

  // Listen to Realtime Reactions Updates across clients
  SupabaseModule.onRealtimeUpdate((mealId, counts) => {
    const cardEl = document.querySelector(`[data-meal-id="${mealId}"]`);
    if (cardEl) {
      const likeSpan = cardEl.querySelector('.count-like');
      const neutralSpan = cardEl.querySelector('.count-neutral');
      const dislikeSpan = cardEl.querySelector('.count-dislike');
      if (likeSpan) likeSpan.textContent = counts.like || 0;
      if (neutralSpan) neutralSpan.textContent = counts.neutral || 0;
      if (dislikeSpan) dislikeSpan.textContent = counts.dislike || 0;
    }
  });

  // Live Clock & Countdown Loop
  function updateClock() {
    const now = new Date();
    liveTimeEl.textContent = now.toLocaleTimeString('ko-KR', { hour12: false });
    updateCountdown(now);
  }

  function updateCountdown(now) {
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const currentMinTotal = hours * 60 + minutes;

    // Daeyang High School Meal Times (Lunch: 12:40 = 760m, Dinner: 18:10 = 1090m)
    const lunchMin = 12 * 60 + 40;
    const dinnerMin = 18 * 60 + 10;

    if (currentMinTotal < lunchMin) {
      const diff = lunchMin - currentMinTotal;
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      mealStatusChip.textContent = '🍚 점심시간 카운트다운';
      countdownText.textContent = h > 0 ? `점심까지 ${h}시간 ${m}분 남음!` : `점심까지 ${m}분 남았어요!`;
      countdownSub.textContent = '오늘 맛있는 점심이 준비되고 있어요!';
      bannerEmoji.textContent = '🍱';
    } else if (currentMinTotal >= lunchMin && currentMinTotal < lunchMin + 50) {
      mealStatusChip.textContent = '🔥 현재 점심시간 중!';
      countdownText.textContent = '지금은 즐거운 점심시간! 😋';
      countdownSub.textContent = '친구들과 함께 맛있게 드세요!';
      bannerEmoji.textContent = '🍖';
    } else if (currentMinTotal < dinnerMin) {
      const diff = dinnerMin - currentMinTotal;
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      mealStatusChip.textContent = '🌙 저녁시간 카운트다운';
      countdownText.textContent = h > 0 ? `저녁까지 ${h}시간 ${m}분 남음!` : `저녁까지 ${m}분 남았어요!`;
      countdownSub.textContent = '오늘 석식 메뉴를 확인해보세요!';
      bannerEmoji.textContent = '🌙';
    } else {
      mealStatusChip.textContent = '✨ 오늘 급식 완료';
      countdownText.textContent = '오늘 하루도 수고 많으셨습니다! 🎉';
      countdownSub.textContent = '내일 맛있는 급식으로 찾아올게요!';
      bannerEmoji.textContent = '😴';
    }
  }

  setInterval(updateClock, 1000);
  updateClock();

  // Format Date to YYYYMMDD and YYYY-MM-DD
  function formatDateYMD(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }

  function formatDateISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Allergy Chips Generator
  function renderAllergyChips() {
    allergyChipsContainer.innerHTML = '';
    Object.entries(NEIS.ALLERGY_MAP).forEach(([code, name]) => {
      const chip = document.createElement('button');
      chip.className = `allergy-chip ${selectedAllergies.includes(parseInt(code)) ? 'selected' : ''}`;
      chip.textContent = name;
      chip.addEventListener('click', () => {
        const numCode = parseInt(code);
        if (selectedAllergies.includes(numCode)) {
          selectedAllergies = selectedAllergies.filter(c => c !== numCode);
        } else {
          selectedAllergies.push(numCode);
        }
        localStorage.setItem('daeyang_allergies', JSON.stringify(selectedAllergies));
        renderAllergyChips();
        loadMealsForDate(currentDate);
      });
      allergyChipsContainer.appendChild(chip);
    });
  }

  // Load and Render Meal Cards
  async function loadMealsForDate(dateObj) {
    const ymd = formatDateYMD(dateObj);
    datePicker.value = formatDateISO(dateObj);

    mealContainer.innerHTML = `
      <div class="meal-card skeleton-card">
        <div class="skeleton-line title"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line"></div>
      </div>
    `;

    const meals = await NEIS.getMealData(ymd);

    if (meals.length === 0) {
      const dayName = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];
      mealContainer.innerHTML = `
        <div class="no-meal-box">
          <div class="no-meal-icon">🏖️</div>
          <div class="no-meal-text">${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 (${dayName})에는 등록된 급식 정보가 없습니다.</div>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 6px;">(주말, 공휴일 또는 방학기간일 수 있습니다)</p>
        </div>
      `;
      return;
    }

    mealContainer.innerHTML = '';
    for (const meal of meals) {
      const card = await createMealCard(meal, ymd);
      mealContainer.appendChild(card);
    }
  }

  // Create Single Meal Card Element with Supabase Shared Reaction Sync
  async function createMealCard(meal, ymdKey) {
    const card = document.createElement('div');
    card.className = 'meal-card';

    const reactionKey = `${ymdKey}_${meal.mealCode}`;
    card.setAttribute('data-meal-id', reactionKey);

    // Fetch Shared Counts from Supabase / Shared DB
    const sharedCounts = await SupabaseModule.getReactions(reactionKey);
    const myChoice = userReactionsChoice[reactionKey] || null;

    // Header
    let html = `
      <div class="meal-card-header">
        <div class="meal-type-title">
          ${meal.mealCode === '2' ? '🍱 중식 (점심)' : '🌙 석식 (저녁)'}
        </div>
        ${meal.calorie ? `<div class="calorie-badge">🔥 ${meal.calorie}</div>` : ''}
      </div>
      <ul class="menu-list">
    `;

    // Menu Items
    meal.dishes.forEach(dish => {
      const warningAllergies = dish.allergyCodes.filter(c => selectedAllergies.includes(c));
      const hasWarning = warningAllergies.length > 0;
      const warningNames = warningAllergies.map(c => NEIS.ALLERGY_MAP[c]).join(', ');

      html += `
        <li class="menu-item ${hasWarning ? 'has-allergy' : ''}">
          <span class="menu-item-name">
            ${dish.name}
            ${dish.isSpecial ? '<span class="special-badge">🔥 특식</span>' : ''}
          </span>
          ${hasWarning ? `<span class="allergy-warn-tag">⚠️ ${warningNames} 함유</span>` : ''}
        </li>
      `;
    });

    html += `</ul>`;

    // Nutrition Progress Bar
    const ntr = meal.nutrition;
    if (ntr.carbs > 0 || ntr.protein > 0 || ntr.fat > 0) {
      const total = ntr.carbs + ntr.protein + ntr.fat || 1;
      const carbsPct = Math.round((ntr.carbs / total) * 100);
      const proteinPct = Math.round((ntr.protein / total) * 100);
      const fatPct = Math.round((ntr.fat / total) * 100);

      html += `
        <div class="nutrition-card">
          <span class="nutrition-title">📊 영양 성분 비율 (탄 / 단 / 지)</span>
          <div class="nutrition-bars">
            <div class="nutri-item">
              <span class="nutri-label"><span>탄수화물</span> <span>${ntr.carbs}g (${carbsPct}%)</span></span>
              <div class="progress-track"><div class="progress-fill fill-carbs" style="width: ${carbsPct}%;"></div></div>
            </div>
            <div class="nutri-item">
              <span class="nutri-label"><span>단백질</span> <span>${ntr.protein}g (${proteinPct}%)</span></span>
              <div class="progress-track"><div class="progress-fill fill-protein" style="width: ${proteinPct}%;"></div></div>
            </div>
            <div class="nutri-item">
              <span class="nutri-label"><span>지방</span> <span>${ntr.fat}g (${fatPct}%)</span></span>
              <div class="progress-track"><div class="progress-fill fill-fat" style="width: ${fatPct}%;"></div></div>
            </div>
          </div>
        </div>
      `;
    }

    // Reaction Bar (Realtime Shared Counts)
    html += `
      <div class="reaction-bar">
        <button class="reaction-btn ${myChoice === 'like' ? 'active' : ''}" data-type="like">
          👍 존맛 <span class="count-like">${sharedCounts.like}</span>
        </button>
        <button class="reaction-btn ${myChoice === 'neutral' ? 'active' : ''}" data-type="neutral">
          😐 보통 <span class="count-neutral">${sharedCounts.neutral}</span>
        </button>
        <button class="reaction-btn ${myChoice === 'dislike' ? 'active' : ''}" data-type="dislike">
          👎 별로 <span class="count-dislike">${sharedCounts.dislike}</span>
        </button>
      </div>
    `;

    card.innerHTML = html;

    // Attach reaction click handlers
    card.querySelectorAll('.reaction-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const type = btn.getAttribute('data-type');
        const prevChoice = userReactionsChoice[reactionKey] || null;

        if (prevChoice === type) {
          // Toggle off
          userReactionsChoice[reactionKey] = null;
          await SupabaseModule.voteReaction(reactionKey, type, -1);
        } else {
          // Switch or new vote
          if (prevChoice) {
            await SupabaseModule.voteReaction(reactionKey, prevChoice, -1);
          }
          userReactionsChoice[reactionKey] = type;
          await SupabaseModule.voteReaction(reactionKey, type, 1);
        }

        localStorage.setItem('daeyang_user_choices', JSON.stringify(userReactionsChoice));

        // Refresh Card Counts immediately
        const newCounts = await SupabaseModule.getReactions(reactionKey);
        const likeSpan = card.querySelector('.count-like');
        const neutralSpan = card.querySelector('.count-neutral');
        const dislikeSpan = card.querySelector('.count-dislike');
        if (likeSpan) likeSpan.textContent = newCounts.like;
        if (neutralSpan) neutralSpan.textContent = newCounts.neutral;
        if (dislikeSpan) dislikeSpan.textContent = newCounts.dislike;

        // Toggle Active styles
        card.querySelectorAll('.reaction-btn').forEach(b => {
          if (b.getAttribute('data-type') === userReactionsChoice[reactionKey]) {
            b.classList.add('active');
          } else {
            b.classList.remove('active');
          }
        });
      });
    });

    return card;
  }

  // Render Weekly Grid View
  async function renderWeeklyGrid() {
    weeklyGrid.innerHTML = '';

    // Get current Monday
    const temp = new Date(currentDate);
    const day = temp.getDay();
    const diff = temp.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(temp.setDate(diff));

    const dayLabels = ['월', '화', '수', '목', '금'];

    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);

      const ymd = formatDateYMD(d);
      const isSelected = formatDateYMD(currentDate) === ymd;

      const miniCard = document.createElement('div');
      miniCard.className = `weekly-mini-card ${isSelected ? 'active' : ''}`;
      miniCard.innerHTML = `
        <div class="weekly-day">${dayLabels[i]}요일</div>
        <div class="weekly-date">${d.getMonth() + 1}/${d.getDate()}</div>
        <div class="weekly-menu-summary" id="week-sum-${ymd}">로딩 중...</div>
      `;

      miniCard.addEventListener('click', () => {
        currentDate = new Date(d);
        loadMealsForDate(currentDate);
        renderWeeklyGrid();
      });

      weeklyGrid.appendChild(miniCard);

      // Async fetch summary for weekly grid
      NEIS.getMealData(ymd).then(meals => {
        const sumEl = document.getElementById(`week-sum-${ymd}`);
        if (sumEl) {
          if (meals.length > 0 && meals[0].dishes.length > 0) {
            const summary = meals[0].dishes.slice(0, 3).map(dish => dish.name).join(', ');
            sumEl.textContent = summary;
          } else {
            sumEl.textContent = '급식 없음';
          }
        }
      });
    }
  }

  // Quick Date Navigation Buttons
  document.querySelectorAll('.date-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const offset = parseInt(btn.getAttribute('data-offset'));
      currentDate = new Date();
      currentDate.setDate(currentDate.getDate() + offset);

      document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      loadMealsForDate(currentDate);
      renderWeeklyGrid();
    });
  });

  // Custom Date Picker Event
  datePicker.addEventListener('change', (e) => {
    if (e.target.value) {
      currentDate = new Date(e.target.value);
      document.querySelectorAll('.date-btn').forEach(b => b.classList.remove('active'));
      loadMealsForDate(currentDate);
      renderWeeklyGrid();
    }
  });

  // Initial Load
  renderAllergyChips();
  await loadMealsForDate(currentDate);
  renderWeeklyGrid();
});
