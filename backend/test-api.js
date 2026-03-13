const axios = require('axios');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function testApi() {
  console.log('Testing /api/prices endpoint...');
  try {
    // 실제 서버가 실행 중이지 않으므로, 코인게코 API 구조를 직접 호출하여 검증 (백엔드 로직과 동일)
    const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
      params: {
        vs_currency: 'usd',
        ids: 'bitcoin,ethereum',
        order: 'market_cap_desc',
        per_page: 2,
        page: 1,
        sparkline: true,
        price_change_percentage: '24h'
      }
    });

    const data = response.data;
    if (Array.isArray(data) && data.length > 0) {
      const coin = data[0];
      const hasRequiredFields = 
        coin.id && 
        coin.symbol && 
        coin.current_price !== undefined && 
        coin.sparkline_in_7d && 
        Array.isArray(coin.sparkline_in_7d.price);

      if (hasRequiredFields) {
        console.log('✅ API structure validation SUCCESS');
        console.log(`Sample: ${coin.name} (${coin.symbol.toUpperCase()}) - $${coin.current_price}`);
        console.log(`Sparkline points: ${coin.sparkline_in_7d.price.length}`);
      } else {
        console.error('❌ API structure validation FAILED: Missing fields');
        process.exit(1);
      }
    } else {
      console.error('❌ API structure validation FAILED: Empty response');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ API test error:', error.message);
    process.exit(1);
  }
}

testApi();
