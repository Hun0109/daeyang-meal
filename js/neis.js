/**
 * NEIS Open API Integration Module for Daeyang High School
 */
const NEIS = {
  OFFICE_CODE: 'C10',      // 부산광역시교육청
  SCHOOL_CODE: '7150626',   // 대양고등학교

  ALLERGY_MAP: {
    1: '난류(계란)', 2: '우유', 3: '메밀', 4: '땅콩', 5: '대두(콩)',
    6: '밀', 7: '고등어', 8: '게', 9: '새우', 10: '돼지고기',
    11: '복숭아', 12: '토마토', 13: '아황산류', 14: '호두', 15: '닭고기',
    16: '쇠고기', 17: '오징어', 18: '조개류'
  },

  SPECIAL_KEYWORDS: [
    '치킨', '돈까스', '돈가스', '피자', '스파게티', '파스타', '떡볶이',
    '우동', '햄버거', '탕수육', '스테이크', '갈비', '삼겹살', '아이스크림',
    '케이크', '와플', '핫도그', '짜장', '짬뽕', '마라', '초밥', '치즈볼'
  ],

  cache: {},

  /**
   * Fetch meal info for a specific date (YYYYMMDD)
   */
  async getMealData(ymdDate) {
    if (this.cache[ymdDate]) {
      return this.cache[ymdDate];
    }

    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&ATPT_OFCDC_SC_CODE=${this.OFFICE_CODE}&SD_SCHUL_CODE=${this.SCHOOL_CODE}&MLSV_YMD=${ymdDate}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.mealServiceDietInfo && data.mealServiceDietInfo[1] && data.mealServiceDietInfo[1].row) {
        const parsedRows = data.mealServiceDietInfo[1].row.map(row => this.parseMealRow(row));
        this.cache[ymdDate] = parsedRows;
        return parsedRows;
      }
      return [];
    } catch (err) {
      console.error('NEIS API Fetch Error:', err);
      return [];
    }
  },

  /**
   * Parse a single meal row from NEIS API
   */
  parseMealRow(row) {
    const rawDishList = row.DDISH_NM.split('<br/>');
    
    const dishItems = rawDishList.map(dishStr => {
      // Extract allergy numbers inside parentheses, e.g. "닭갈비 (5.6.15)"
      const allergyMatch = dishStr.match(/\(([\d\.]+)\)/);
      let allergyCodes = [];
      if (allergyMatch) {
        allergyCodes = allergyMatch[1].split('.').map(n => parseInt(n, 10));
      }

      // Clean dish name by stripping allergy numbers and special HTML
      const cleanName = dishStr.replace(/\([\d\.]+\)/g, '').replace(/[*#]/g, '').trim();

      // Check if it's a special menu
      const isSpecial = this.SPECIAL_KEYWORDS.some(keyword => cleanName.includes(keyword));

      return {
        name: cleanName,
        allergyCodes: allergyCodes,
        isSpecial: isSpecial
      };
    }).filter(item => item.name.length > 0);

    // Parse Nutrition Info
    const calorie = row.CAL_INFO ? row.CAL_INFO.trim() : '';
    const nutrition = this.parseNutrition(row.NTR_INFO || '');

    return {
      mealType: row.MMEAL_SC_NM, // 중식 or 석식
      mealCode: row.MMEAL_SC_CODE, // 2 = 중식, 3 = 석식
      date: row.MLSV_YMD,
      dishes: dishItems,
      calorie: calorie,
      nutrition: nutrition
    };
  },

  /**
   * Parse Nutrition String (Carbs, Protein, Fat, Calcium)
   */
  parseNutrition(ntrString) {
    const getVal = (key) => {
      const regex = new RegExp(`${key}\\(g\\)\\s*:\\s*([\\d\\.]+)`);
      const match = ntrString.match(regex);
      return match ? parseFloat(match[1]) : 0;
    };

    const carbs = getVal('탄수화물');
    const protein = getVal('단백질');
    const fat = getVal('지방');

    return {
      carbs: carbs,
      protein: protein,
      fat: fat
    };
  }
};
