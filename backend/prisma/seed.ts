import { PrismaClient, UserRole, KycStatus, MerchantStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hash(pw: string) {
  return bcrypt.hash(pw, 12);
}

async function main() {
  console.log('🌱 Starting clean seed...');

  // ============================================
  // 1. PLATFORM CATEGORIES (new relational model)
  // ============================================
  console.log('Seeding Categories...');

  const categoriesData = [
    { name: 'Électronique', slug: 'electronique', description: 'Smartphones, ordinateurs, accessoires high-tech', icon: 'ri-smartphone-line', color: '#4DB049', bnplEnabled: true, maxCredit: 500000, minScore: 600, merchantCommission: 2.5, imageUrl: 'https://images.unsplash.com/photo-1498049860654-af1a5c5668ba?w=800&q=80' },
    { name: 'Mode', slug: 'mode', description: 'Vêtements, chaussures, accessoires de mode', icon: 'ri-t-shirt-line', color: '#22C55E', bnplEnabled: true, maxCredit: 200000, minScore: 550, merchantCommission: 3.0, imageUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800&q=80' },
    { name: 'Maison', slug: 'maison', description: 'Meubles, décoration, électroménager', icon: 'ri-home-smile-line', color: '#4A9EFF', bnplEnabled: true, maxCredit: 350000, minScore: 580, merchantCommission: 2.0, imageUrl: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=800&q=80' },
    { name: 'Santé & Beauté', slug: 'sante-beaute', description: 'Produits de santé, cosmétiques et bien-être', icon: 'ri-heart-pulse-line', color: '#EF4444', bnplEnabled: true, maxCredit: 150000, minScore: 620, merchantCommission: 1.8, imageUrl: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800&q=80' },
    { name: 'Sports', slug: 'sports', description: 'Équipements sportifs et articles de sport', icon: 'ri-basketball-line', color: '#8B5CF6', bnplEnabled: false, maxCredit: 180000, minScore: 560, merchantCommission: 2.2, imageUrl: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&q=80' },
    { name: 'Automobile', slug: 'automobile', description: 'Pièces auto, accessoires et entretien', icon: 'ri-car-line', color: '#F59E0B', bnplEnabled: true, maxCredit: 400000, minScore: 650, merchantCommission: 1.5, imageUrl: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80' },
  ];

  const categories: { slug: string; id: string }[] = [];
  for (const cat of categoriesData) {
    const created = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        icon: cat.icon,
        color: cat.color,
        imageUrl: cat.imageUrl,
        bnplEnabled: cat.bnplEnabled,
        maxCredit: cat.maxCredit,
        minScore: cat.minScore,
        merchantCommission: cat.merchantCommission,
        active: true,
        featured: true,
      },
    });
    categories.push(created);
  }

  const catMap = Object.fromEntries(categories.map(c => [c.slug, c.id]));

  // ============================================
  // 2. ADMIN USER
  // ============================================
  console.log('Seeding Admin...');
  const adminPw = await hash('Admin@123');
  await prisma.user.upsert({
    where: { email: 'admin@watsim.cm' },
    update: {},
    create: {
      email: 'admin@watsim.cm',
      phone: '+237600000000',
      passwordHash: adminPw,
      fullName: 'WATSIM Admin',
      role: UserRole.ADMIN,
      kycStatus: KycStatus.VERIFIED,
      creditScore: 100,
      creditLimit: 0,
      wallet: { create: { balance: 0 } },
    },
  });

  // ============================================
  // 3. MERCHANTS + USERS
  // ============================================
  console.log('Seeding Merchants...');

  const merchantSeeds = [
    { email: 'techshop@watsim.cm', phone: '+237691112233', name: 'Mvondo Pierre', business: 'TechShop Yaoundé', category: 'Électronique', city: 'Yaoundé', catSlug: 'electronique' },
    { email: 'fashion@watsim.cm', phone: '+237677334455', name: 'Ngassa Marie', business: 'Fashion House Douala', category: 'Mode', city: 'Douala', catSlug: 'mode' },
    { email: 'homeplus@watsim.cm', phone: '+237655667788', name: 'Tchamba Eric', business: 'Home Plus', category: 'Maison', city: 'Douala', catSlug: 'maison' },
  ];

  const merchants: { id: string; catSlug: string }[] = [];
  for (const m of merchantSeeds) {
    const user = await prisma.user.upsert({
      where: { email: m.email },
      update: {},
      create: {
        email: m.email,
        phone: m.phone,
        passwordHash: await hash('Merchant@123'),
        fullName: m.name,
        role: UserRole.MERCHANT,
        kycStatus: KycStatus.VERIFIED,
        wallet: { create: { balance: 50000 } },
      },
    });

    const merchant = await prisma.merchant.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        businessName: m.business,
        category: m.category,           // keep legacy string for now
        city: m.city,
        status: MerchantStatus.ACTIVE,
      },
    });

    // Add merchant-category relationship (merchant can manage their primary category)
    await prisma.merchantCategory.upsert({
      where: { merchantId_categoryId: { merchantId: merchant.id, categoryId: catMap[m.catSlug] } },
      update: {},
      create: {
        merchantId: merchant.id,
        categoryId: catMap[m.catSlug],
      },
    });

    merchants.push({ ...merchant, catSlug: m.catSlug });
  }

  // ============================================
  // 4. PRODUCTS (now linked to Category)
  // ============================================
  console.log('Seeding Products with categories...');

  const productsData = [
    // TechShop (Électronique)
    { name: 'Samsung Galaxy A55', price: 185000, catSlug: 'electronique', imageUrl: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600&q=80', description: 'Smartphone Samsung Galaxy A55 avec écran Super AMOLED 6.5", 128GB stockage, 6GB RAM.', gallery: ['https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600&q=80', 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=600&q=80'] },
    { name: 'iPhone 13 128Go', price: 420000, catSlug: 'electronique', imageUrl: 'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=600&q=80', description: 'Apple iPhone 13 128GB - Écran Super Retina XDR 6.1", puce A15 Bionic.', gallery: ['https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=600&q=80', 'https://images.unsplash.com/photo-1696446701796-da61225697cc?w=600&q=80'] },
    { name: 'MacBook Air M2', price: 650000, catSlug: 'electronique', imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80', description: 'MacBook Air 13" avec puce M2, 8GB RAM, 256GB SSD.', gallery: ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80', 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=600&q=80'] },
    { name: 'Casque Sony WH-1000XM5', price: 125000, catSlug: 'electronique', imageUrl: 'https://images.unsplash.com/photo-1618366712010-b4af921049e7?w=600&q=80', description: 'Casque sans fil à réduction de bruit Sony WH-1000XM5.', gallery: ['https://images.unsplash.com/photo-1618366712010-b4af921049e7?w=600&q=80'] },
    { name: 'TV Samsung 55" QLED', price: 295000, catSlug: 'electronique', imageUrl: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&q=80', description: 'Téléviseur Samsung 55" QLED 4K Smart TV.', gallery: ['https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&q=80'] },

    // Fashion House (Mode)
    { name: 'Sneakers Nike Air Force', price: 85000, catSlug: 'mode', imageUrl: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&q=80', description: 'Baskets Nike Air Force 1 classiques, tailles 40-45.', gallery: ['https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&q=80', 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=600&q=80'] },
    { name: 'Veste en cuir homme', price: 145000, catSlug: 'mode', imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&q=80', description: 'Veste en cuir véritable pour homme, style motard.', gallery: ['https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&q=80'] },
    { name: 'Robe d\'été femme', price: 45000, catSlug: 'mode', imageUrl: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600&q=80', description: 'Robe légère d\'été, tailles S à XL, plusieurs coloris.', gallery: ['https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600&q=80'] },
    { name: 'Montre Casio Vintage', price: 35000, catSlug: 'mode', imageUrl: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=600&q=80', description: 'Montre digitale vintage style rétro Casio.', gallery: ['https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=600&q=80'] },
    { name: 'Sac à main cuir', price: 95000, catSlug: 'mode', imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80', description: 'Sac à main en cuir véritable, fabrication artisanale.', gallery: ['https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80'] },

    // Home Plus (Maison)
    { name: 'Canapé 3 places moderne', price: 285000, catSlug: 'maison', imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80', description: 'Canapé 3 places design moderne, tissu de qualité.', gallery: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80', 'https://images.unsplash.com/photo-1550226891-ef816aed4a98?w=600&q=80'] },
    { name: 'Aspirateur robot Xiaomi', price: 125000, catSlug: 'maison', imageUrl: 'https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?w=600&q=80', description: 'Aspirateur robot connecté Xiaomi avec navigation laser.', gallery: ['https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?w=600&q=80'] },
    { name: 'Lampe de chevet design', price: 28000, catSlug: 'maison', imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&q=80', description: 'Lampe de chevet LED moderne avec variateur tactile.', gallery: ['https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&q=80'] },
    { name: 'Machine à café Nespresso', price: 165000, catSlug: 'maison', imageUrl: 'https://images.unsplash.com/photo-1517142089942-ba376ce32a2e?w=600&q=80', description: 'Machine à café Nespresso avec mousseur à lait intégré.', gallery: ['https://images.unsplash.com/photo-1517142089942-ba376ce32a2e?w=600&q=80'] },
    { name: 'Set de couverts 24 pièces', price: 42000, catSlug: 'maison', imageUrl: 'https://images.unsplash.com/photo-1584992236310-6eddd73e56f3?w=600&q=80', description: 'Set de couverts inox 24 pièces pour 6 personnes.', gallery: ['https://images.unsplash.com/photo-1584992236310-6eddd73e56f3?w=600&q=80'] },
  ];

  for (const p of productsData) {
    const merchant = merchants.find(m => m.catSlug === p.catSlug) || merchants[0];
    const categoryId = catMap[p.catSlug];

    await prisma.product.create({
      data: {
        merchantId: merchant.id,
        categoryId: categoryId,
        name: p.name,
        description: p.description,
        price: p.price,
        stock: 15 + Math.floor(Math.random() * 30),
        imageUrl: p.imageUrl,
        bnplEligible: true,
        isActive: true,
        // Create gallery images
        gallery: {
          create: p.gallery?.map((url: string, idx: number) => ({
            imageUrl: url,
            sortOrder: idx,
          })) || [],
        },
      },
    });
  }

  // ============================================
  // 5. CUSTOMERS
  // ============================================
  console.log('Seeding Customers...');
  const customers = [];
  for (let i = 1; i <= 8; i++) {
    const score = 45 + Math.floor(Math.random() * 50);
    const limit = score < 50 ? 0 : score < 65 ? 80000 : score < 80 ? 180000 : 350000;

    const u = await prisma.user.upsert({
      where: { email: `customer${i}@watsim.cm` },
      update: {},
      create: {
        email: `customer${i}@watsim.cm`,
        phone: `+2376990000${String(i).padStart(2, '0')}`,
        passwordHash: await hash('Customer@123'),
        pinHash: await hash('1234'),
        pinSetAt: new Date(),
        fullName: `Client Test ${i}`,
        role: UserRole.CUSTOMER,
        kycStatus: KycStatus.VERIFIED,
        creditScore: score,
        creditLimit: limit,
        wallet: { create: { balance: 30000 + i * 8000 } },
      },
    });
    customers.push(u);
  }

  console.log('✅ Seed completed successfully!');
  console.log('Admin login: admin@watsim.cm / Admin@123 (password)');
  console.log('Merchant example: techshop@watsim.cm / Merchant@123 (password)');
  console.log('Customer mobile PIN login: +237699000001 / 1234  (or customer1@watsim.cm + password)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
