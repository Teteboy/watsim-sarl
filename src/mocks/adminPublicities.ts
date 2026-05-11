export const adminPublicities = [
  { id: 'PUB-001', name: 'Campagne Samsung Galaxy', merchant: 'TechShop Yaoundé', merchantId: 'MCH-001', type: 'banner', status: 'active', budget: 150000, spent: 87500, clicks: 1247, impressions: 45000, ctr: 2.77, startDate: '2026-04-15', endDate: '2026-05-15', position: 'homepage_hero', image: 'https://readdy.ai/api/search-image?query=Samsung%20Galaxy%20A55%20smartphone%20promotional%20banner%20with%20gold%20accents%20on%20dark%20blue%20background%2C%20sleek%20advertising%20style%2C%20professional%20marketing%20design&width=300&height=120&seq=pub001&orientation=landscape' },
  { id: 'PUB-002', name: 'Promo Mode Printemps', merchant: 'Fashion House Douala', merchantId: 'MCH-002', type: 'banner', status: 'active', budget: 80000, spent: 42000, clicks: 892, impressions: 28000, ctr: 3.19, startDate: '2026-04-20', endDate: '2026-05-20', position: 'category_fashion', image: 'https://readdy.ai/api/search-image?query=Fashion%20spring%20collection%20promotional%20banner%20with%20elegant%20clothing%20display%20on%20dark%20navy%20blue%20background%20with%20gold%20accents%2C%20professional%20advertising&width=300&height=120&seq=pub002&orientation=landscape' },
  { id: 'PUB-003', name: 'Électroménager Promo', merchant: 'TechShop Yaoundé', merchantId: 'MCH-001', type: 'sidebar', status: 'active', budget: 60000, spent: 32000, clicks: 456, impressions: 15000, ctr: 3.04, startDate: '2026-04-10', endDate: '2026-05-10', position: 'sidebar_right', image: 'https://readdy.ai/api/search-image?query=Home%20appliances%20promotional%20banner%20with%20refrigerator%20and%20modern%20appliances%20on%20dark%20blue%20background%20with%20gold%20highlights%2C%20advertising%20style&width=300&height=120&seq=pub003&orientation=landscape' },
  { id: 'PUB-004', name: 'Nouveau Vélo Électrique', merchant: 'SportZone Cameroun', merchantId: 'MCH-008', type: 'popup', status: 'paused', budget: 50000, spent: 18000, clicks: 234, impressions: 8000, ctr: 2.93, startDate: '2026-04-01', endDate: '2026-04-30', position: 'popup_homepage', image: 'https://readdy.ai/api/search-image?query=Electric%20bicycle%20promotional%20banner%20on%20dark%20navy%20background%20with%20gold%20accent%20lighting%2C%20sporty%20advertising%20design%2C%20professional%20marketing&width=300&height=120&seq=pub004&orientation=landscape' },
  { id: 'PUB-005', name: 'Santé & Beauté', merchant: 'PharmaCare Santé', merchantId: 'MCH-005', type: 'banner', status: 'pending', budget: 40000, spent: 0, clicks: 0, impressions: 0, ctr: 0, startDate: '2026-05-10', endDate: '2026-06-10', position: 'homepage_featured', image: 'https://readdy.ai/api/search-image?query=Beauty%20and%20health%20cosmetics%20promotional%20banner%20with%20premium%20skincare%20products%20on%20dark%20blue%20background%20with%20gold%20accents%2C%20luxury%20advertising%20style&width=300&height=120&seq=pub005&orientation=landscape' },
  { id: 'PUB-006', name: 'Déco Maison Soldes', merchant: 'Déco Maison Plus', merchantId: 'MCH-004', type: 'banner', status: 'active', budget: 35000, spent: 28000, clicks: 567, impressions: 19000, ctr: 2.98, startDate: '2026-04-05', endDate: '2026-05-05', position: 'category_home', image: 'https://readdy.ai/api/search-image?query=Home%20decoration%20furniture%20promotional%20banner%20with%20elegant%20interior%20design%20on%20dark%20navy%20blue%20background%20with%20warm%20gold%20lighting%2C%20advertising%20style&width=300&height=120&seq=pub006&orientation=landscape' },
  { id: 'PUB-007', name: 'iPhone 15 Pro Launch', merchant: 'TechShop Yaoundé', merchantId: 'MCH-001', type: 'banner', status: 'ended', budget: 200000, spent: 200000, clicks: 3456, impressions: 95000, ctr: 3.64, startDate: '2026-03-01', endDate: '2026-03-31', position: 'homepage_hero', image: 'https://readdy.ai/api/search-image?query=iPhone%2015%20Pro%20titanium%20promotional%20banner%20on%20dark%20blue%20background%20with%20golden%20light%20rays%2C%20premium%20advertising%20design%2C%20professional%20marketing&width=300&height=120&seq=pub007&orientation=landscape' },
  { id: 'PUB-008', name: 'Soldes Spéciales Ramadan', merchant: 'Fashion House Douala', merchantId: 'MCH-002', type: 'popup', status: 'ended', budget: 120000, spent: 120000, clicks: 1890, impressions: 62000, ctr: 3.05, startDate: '2026-02-20', endDate: '2026-03-20', position: 'popup_all_pages', image: 'https://readdy.ai/api/search-image?query=Ramadan%20special%20sales%20promotional%20banner%20with%20elegant%20lanterns%20and%20festive%20design%20on%20dark%20navy%20blue%20background%20with%20gold%20accents%2C%20advertising%20style&width=300&height=120&seq=pub008&orientation=landscape' },
];

export const publicityTypes = [
  { value: 'banner', label: 'Bannière', icon: 'ri-image-line' },
  { value: 'popup', label: 'Popup', icon: 'ri-window-line' },
  { value: 'sidebar', label: 'Sidebar', icon: 'ri-side-bar-line' },
  { value: 'video', label: 'Vidéo', icon: 'ri-video-line' },
  { value: 'carousel', label: 'Carrousel', icon: 'ri-slideshow-line' },
];

export const publicityPositions = [
  { value: 'homepage_hero', label: 'Hero Accueil Web' },
  { value: 'homepage_featured', label: 'Featured Accueil Web' },
  { value: 'category_fashion', label: 'Catégorie Mode Web' },
  { value: 'category_electronics', label: 'Catégorie Électronique Web' },
  { value: 'category_home', label: 'Catégorie Maison Web' },
  { value: 'sidebar_right', label: 'Sidebar Droite Web' },
  { value: 'popup_homepage', label: 'Popup Accueil Web' },
  { value: 'popup_all_pages', label: 'Popup Toutes Pages Web' },
  { value: 'splash_screen', label: 'Splash Screen Mobile' },
  { value: 'home_feed', label: "Fil d'accueil Mobile" },
  { value: 'product_detail_interstitial', label: 'Interstitiel Produit Mobile' },
];

export const publicityStatuses = [
  { value: 'active', label: 'Active', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' },
  { value: 'paused', label: 'En pause', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  { value: 'pending', label: 'En attente', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
  { value: 'ended', label: 'Terminée', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
];