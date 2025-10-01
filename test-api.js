// Test script để demo API với parsing ngày tháng chi tiết
const API_BASE = 'http://localhost:3000/api';

async function testAPI() {
    console.log('🧪 Testing Xaycon Live API with Enhanced Date Parsing\n');
    
    try {
        // Test 1: Get all matches
        console.log('1️⃣ Testing /api/matches...');
        const response1 = await fetch(`${API_BASE}/matches`);
        const data1 = await response1.json();
        
        console.log(`✅ Total matches: ${data1.totalMatches}`);
        console.log(`📊 Summary:`, data1.summary);
        
        if (data1.data.length > 0) {
            const sample = data1.data[0];
            console.log(`📝 Sample match:`, {
                teams: `${sample.homeTeam} vs ${sample.awayTeam}`,
                fullDateTime: sample.time,
                dateOnly: sample.date, 
                timeOnly: sample.timeOnly,
                league: sample.league,
                status: sample.status
            });
        }
        console.log('');
        
        // Test 2: Get today's matches
        console.log('2️⃣ Testing /api/matches/today...');
        const response2 = await fetch(`${API_BASE}/matches/today`);
        const data2 = await response2.json();
        console.log(`✅ Today's matches: ${data2.totalMatches}`);
        console.log('');
        
        // Test 3: Get live matches
        console.log('3️⃣ Testing /api/matches/live...');
        const response3 = await fetch(`${API_BASE}/matches/live`);
        const data3 = await response3.json();
        console.log(`✅ Live matches: ${data3.totalMatches}`);
        console.log('');
        
        // Test 4: Search by team
        console.log('4️⃣ Testing /api/search/barcelona...');
        const response4 = await fetch(`${API_BASE}/search/barcelona`);
        const data4 = await response4.json();
        console.log(`✅ Barcelona matches: ${data4.totalMatches}`);
        console.log('');
        
        // Test 5: Get by date
        console.log('5️⃣ Testing /api/matches/date/02/10...');
        const response5 = await fetch(`${API_BASE}/matches/date/02/10`);
        const data5 = await response5.json();
        console.log(`✅ Matches on 02/10: ${data5.totalMatches}`);
        console.log('');
        
        // Display detailed parsing results
        console.log('📋 Detailed Parsing Analysis:');
        const matches = data1.data;
        
        console.log(`Total matches found: ${matches.length}`);
        console.log(`Matches with dates: ${matches.filter(m => m.date).length}`);
        console.log(`Matches with time only: ${matches.filter(m => m.timeOnly).length}`);
        console.log(`Matches with league info: ${matches.filter(m => m.league).length}`);
        console.log(`Matches with status: ${matches.filter(m => m.status).length}`);
        
        console.log('\n🎯 Sample Parsed Matches:');
        matches.slice(0, 5).forEach((match, index) => {
            console.log(`\n${index + 1}. ${match.homeTeam} vs ${match.awayTeam}`);
            console.log(`   📅 Date: ${match.date || 'N/A'}`);
            console.log(`   ⏰ Time: ${match.timeOnly || 'N/A'}`);
            console.log(`   🏆 League: ${match.league || 'N/A'}`);
            console.log(`   📊 Status: ${match.status || 'N/A'}`);
            console.log(`   📝 Raw: ${match.rawText.substring(0, 100)}...`);
        });
        
    } catch (error) {
        console.error('❌ Error testing API:', error);
    }
}

// Run test if this is executed directly (Node.js)
if (typeof window === 'undefined') {
    // Node.js environment
    const fetch = require('node-fetch');
    testAPI();
} else {
    // Browser environment
    window.testAPI = testAPI;
    console.log('Run testAPI() in browser console to test the API');
}