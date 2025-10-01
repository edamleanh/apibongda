// Test script để kiểm tra parsing xaycon.live cụ thể
console.log('🔍 Testing Xaycon.live Specific Parsing...\n');

async function testXayconParsing() {
    const API_BASE = 'http://localhost:3000/api';
    const fetch = require('node-fetch');
    
    try {
        // Test debug endpoint
        console.log('📊 Fetching debug information...');
        const debugResponse = await fetch(`${API_BASE}/debug`);
        const debugData = await debugResponse.json();
        
        console.log(`✅ Total matches found: ${debugData.totalMatches}`);
        console.log(`📈 Source breakdown:`, debugData.sourceCounts);
        console.log('');
        
        // Analyze xaycon-specific matches
        const xayconMatches = debugData.allMatches.filter(m => m.source === 'xaycon-specific');
        const genericMatches = debugData.allMatches.filter(m => m.source === 'generic');
        
        console.log(`🎯 Xaycon-specific matches: ${xayconMatches.length}`);
        console.log(`🔄 Generic matches: ${genericMatches.length}`);
        console.log('');
        
        // Show sample xaycon matches
        if (xayconMatches.length > 0) {
            console.log('🏆 Sample Xaycon-specific matches:');
            xayconMatches.slice(0, 3).forEach((match, index) => {
                console.log(`\n${index + 1}. ${match.teams}`);
                console.log(`   📅 Date: ${match.date || 'N/A'}`);
                console.log(`   ⏰ Time: ${match.timeOnly || 'N/A'}`);
                console.log(`   🏆 League: ${match.league || 'N/A'}`);
                console.log(`   📊 Status: ${match.status || 'N/A'}`);
                console.log(`   📝 Raw preview: ${match.rawTextPreview}`);
            });
        } else {
            console.log('❌ No xaycon-specific matches found!');
            console.log('🔧 The HTML structure might have changed or selectors need adjustment.');
        }
        
        // Show sample generic matches
        if (genericMatches.length > 0) {
            console.log('\n🔄 Sample Generic matches:');
            genericMatches.slice(0, 2).forEach((match, index) => {
                console.log(`\n${index + 1}. ${match.teams}`);
                console.log(`   📅 Date: ${match.date || 'N/A'}`);
                console.log(`   ⏰ Time: ${match.timeOnly || 'N/A'}`);
                console.log(`   🏆 League: ${match.league || 'N/A'}`);
                console.log(`   📊 Status: ${match.status || 'N/A'}`);
            });
        }
        
        // Test live matches
        console.log('\n🔴 Testing live matches...');
        const liveResponse = await fetch(`${API_BASE}/matches/live`);
        const liveData = await liveResponse.json();
        console.log(`✅ Live matches found: ${liveData.totalMatches}`);
        
        if (liveData.data.length > 0) {
            liveData.data.forEach((match, index) => {
                console.log(`${index + 1}. ${match.homeTeam} vs ${match.awayTeam} - ${match.status}`);
            });
        }
        
        // Test today's matches
        console.log('\n📅 Testing today\'s matches...');
        const todayResponse = await fetch(`${API_BASE}/matches/today`);
        const todayData = await todayResponse.json();
        console.log(`✅ Today's matches found: ${todayData.totalMatches}`);
        
        // Summary
        console.log('\n📋 Summary:');
        console.log(`• Total matches: ${debugData.totalMatches}`);
        console.log(`• Xaycon-specific: ${xayconMatches.length}`);
        console.log(`• Generic: ${genericMatches.length}`);
        console.log(`• Live matches: ${liveData.totalMatches}`);
        console.log(`• Today's matches: ${todayData.totalMatches}`);
        
        if (xayconMatches.length === 0) {
            console.log('\n⚠️  Warning: No xaycon-specific matches detected!');
            console.log('This might indicate:');
            console.log('1. The HTML structure has changed');
            console.log('2. CSS classes are different');
            console.log('3. JavaScript takes longer to render');
            console.log('4. Need to adjust selectors');
        }
        
    } catch (error) {
        console.error('❌ Error testing xaycon parsing:', error);
    }
}

// For Node.js environment
if (typeof window === 'undefined') {
    const fetch = require('node-fetch');
    testXayconParsing();
}