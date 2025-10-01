// Demo tính năng link generation
console.log('🔗 Testing Link Generation Feature...\n');

// Function để test tạo link từ thông tin trận đấu
function testLinkGeneration() {
    const testCases = [
        {
            homeTeam: "Saint Gilloise",
            awayTeam: "Newcastle United",
            timeOnly: "23:45",
            date: "01/10",
            expected: "https://www.xaycon.live/truc-tiep/saint-gilloise-vs-newcastle-united-23-45-01-10-2025"
        },
        {
            homeTeam: "Manchester United",
            awayTeam: "Real Madrid",
            timeOnly: "20:00",
            date: "03/10/2025",
            expected: "https://www.xaycon.live/truc-tiep/manchester-united-vs-real-madrid-20-00-03-10-2025"
        },
        {
            homeTeam: "Barcelona FC",
            awayTeam: "Liverpool F.C.",
            timeOnly: "19:30",
            date: "05/10",
            expected: "https://www.xaycon.live/truc-tiep/barcelona-fc-vs-liverpool-fc-19-30-05-10-2025"
        }
    ];
    
    console.log('🧪 Test Cases for Link Generation:\n');
    
    testCases.forEach((testCase, index) => {
        console.log(`${index + 1}. Input:`);
        console.log(`   Home Team: ${testCase.homeTeam}`);
        console.log(`   Away Team: ${testCase.awayTeam}`);
        console.log(`   Time: ${testCase.timeOnly}`);
        console.log(`   Date: ${testCase.date}`);
        console.log(`   Expected Link: ${testCase.expected}`);
        console.log('');
    });
    
    console.log('🌐 API Endpoints to Test:\n');
    console.log('1. Get all matches with links:');
    console.log('   GET http://localhost:3000/api/matches\n');
    
    console.log('2. Get specific match by slug:');
    console.log('   GET http://localhost:3000/api/match/saint-gilloise-vs-newcastle-united\n');
    
    console.log('3. Get specific match by full URL:');
    console.log('   GET http://localhost:3000/api/match-by-url?url=https://www.xaycon.live/truc-tiep/saint-gilloise-vs-newcastle-united-23-45-01-10-2025\n');
    
    console.log('4. Debug links:');
    console.log('   GET http://localhost:3000/api/debug\n');
    
    console.log('📋 Link Format Explanation:');
    console.log('Format: https://www.xaycon.live/truc-tiep/{home-team}-vs-{away-team}-{HH-MM}-{DD-MM-YYYY}');
    console.log('');
    console.log('Rules:');
    console.log('• Team names: lowercase, spaces → hyphens, special chars removed');
    console.log('• Time: HH:MM → HH-MM');
    console.log('• Date: DD/MM → DD-MM-YYYY (current year added)');
    console.log('• Date: DD/MM/YYYY → DD-MM-YYYY');
    console.log('');
    
    console.log('🔍 Example transformations:');
    console.log('• "Saint Gilloise" → "saint-gilloise"');
    console.log('• "Newcastle United" → "newcastle-united"');
    console.log('• "Liverpool F.C." → "liverpool-fc"');
    console.log('• "23:45" → "23-45"');
    console.log('• "01/10" → "01-10-2025"');
    console.log('• "01/10/2025" → "01-10-2025"');
}

// Chạy test
testLinkGeneration();

// Nếu chạy trong browser
if (typeof window !== 'undefined') {
    console.log('\n🌐 You can test the API endpoints in your browser:');
    console.log('• Open: http://localhost:3000/api/matches');
    console.log('• Check the "link" field in each match object (now full URLs)');
    console.log('• Use slug to access: http://localhost:3000/api/match/{slug}');
    console.log('• Use full URL: http://localhost:3000/api/match-by-url?url={fullUrl}');
}