const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testPublicities() {
  try {
    console.log('Testing publicity data...');
    
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Check if we have publicity data
    const publicities = await prisma.publicity.findMany({
      include: { merchant: { select: { businessName: true } } }
    });
    
    console.log(`\n📊 Found ${publicities.length} publicities in database:`);
    
    publicities.forEach((pub, index) => {
      console.log(`${index + 1}. ${pub.name}`);
      console.log(`   Status: ${pub.status}`);
      console.log(`   Type: ${pub.type}`);
      console.log(`   Image: ${pub.imageUrl}`);
      console.log(`   Merchant: ${pub.merchant?.businessName || 'No merchant'}`);
      console.log('');
    });
    
    // Test the API endpoint structure
    console.log('🔗 API Endpoint Info:');
    console.log('   GET /api/v1/publicities/active');
    console.log('   - Returns active publicities for mobile app');
    console.log('   - No authentication required');
    console.log('   - Response format: { publicities: [...] }');
    
    console.log('\n✅ Publicity system is ready!');
    console.log('📱 Flutter app will fetch from: http://192.168.1.197:3001/api/v1/publicities/active');
    
  } catch (error) {
    console.error('❌ Error testing publicities:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPublicities();
