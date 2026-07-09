import { PrismaClient, PublicityType, PublicityPosition, PublicityStatus } from '../src/config/db';

const prisma = new PrismaClient();

async function seedPublicities() {
  try {
    // First, let's check if we have any merchants
    const merchants = await prisma.merchant.findMany();
    
    if (merchants.length === 0) {
      console.log('No merchants found. Creating a sample merchant first...');
      const sampleMerchant = await prisma.merchant.create({
        data: {
          businessName: 'TechShop Cameroon',
          owner: 'John Doe',
          email: 'john@techshop.cm',
          phone: '+237612345678',
          address: 'Douala, Cameroon',
          businessType: 'RETAIL',
          description: 'Technology and electronics retailer',
          status: 'APPROVED',
        },
      });
      merchants.push(sampleMerchant);
    }

    const samplePublicities = [
      {
        name: 'Samsung Galaxy S24 - Summer Sale',
        merchantId: merchants[0].id,
        type: PublicityType.BANNER,
        position: PublicityPosition.HOMEPAGE_HERO,
        budget: 500000, // 500K FCFA
        status: PublicityStatus.ACTIVE,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        imageUrl: 'https://picsum.photos/800/400?random=1',
      },
      {
        name: 'iPhone 15 Pro - Special Offer',
        merchantId: merchants[0].id,
        type: PublicityType.BANNER,
        position: PublicityPosition.HOMEPAGE_HERO,
        budget: 750000, // 750K FCFA
        status: PublicityStatus.ACTIVE,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        imageUrl: 'https://picsum.photos/800/400?random=2',
      },
      {
        name: 'MacBook Air M3 - Back to School',
        merchantId: merchants[0].id,
        type: PublicityType.BANNER,
        position: PublicityPosition.HOMEPAGE_HERO,
        budget: 600000, // 600K FCFA
        status: PublicityStatus.ACTIVE,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        imageUrl: 'https://picsum.photos/800/400?random=3',
      },
    ];

    console.log('Creating sample publicity data...');
    
    for (const pub of samplePublicities) {
      const existing = await prisma.publicity.findFirst({
        where: { name: pub.name },
      });
      
      if (!existing) {
        await prisma.publicity.create({ data: pub });
        console.log(`Created publicity: ${pub.name}`);
      } else {
        console.log(`Publicity already exists: ${pub.name}`);
      }
    }

    console.log('Sample publicity data seeded successfully!');
  } catch (error) {
    console.error('Error seeding publicities:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedPublicities();
