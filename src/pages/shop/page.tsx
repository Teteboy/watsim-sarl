import { useEffect, useState } from 'react';
import { getPublicCategories, simulateBnpl } from '@/lib/api';

export default function ShopPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [simulation, setSimulation] = useState<any>(null);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [count, setCount] = useState<2 | 3 | 4 | 6>(3);

  useEffect(() => {
    fetch(`${(import.meta.env?.VITE_API_PREFIX as string) ?? '/api/v1'}/products?limit=50`)
      .then(r => r.json())
      .then(data => setProducts(data.items || data || []))
      .catch(() => setProducts([]));

    getPublicCategories().then(res => {
      const list = (res as any)?.data ?? (Array.isArray(res) ? res : []);
      setCategories(list);
    });
  }, []);

  const filtered = products.filter((p: any) => {
    const matchCat = !selectedCategory || (p.category?.slug || p.category?.id) === selectedCategory;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch && p.bnplEligible;
  });

  const openBnpl = async (product: any) => {
    setSelectedProduct(product);
    try {
      const res = await simulateBnpl(product.id, count, frequency);
      setSimulation(res);
    } catch {
      setSimulation(null);
    }
  };

  const updateSimulation = async (newCount: any, newFreq: any) => {
    if (!selectedProduct) return;
    setCount(newCount);
    setFrequency(newFreq);
    try {
      const res = await simulateBnpl(selectedProduct.id, newCount, newFreq);
      setSimulation(res);
    } catch { /* ignore simulation error */ }
  };

  return (
    <div className="min-h-screen" style={{ background: '#050B16' }}>
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-white mb-6">Boutique WATSIM — Achetez maintenant, payez plus tard</h1>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <input
            placeholder="Rechercher un produit..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
          />
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white"
          >
            <option value="">Toutes catégories</option>
            {categories.map((c: any) => (
              <option key={c.id} value={c.slug || c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filtered.map((p: any) => (
            <div key={p.id} className="rounded-2xl p-4 bg-[#014A41] border border-white/10">
              <img src={p.imageUrl || 'https://picsum.photos/300/200'} className="w-full h-40 object-cover rounded-xl mb-4" alt="" />
              <div className="font-semibold text-white">{p.name}</div>
              <div className="text-[#4DB049] text-lg">{p.price.toLocaleString()} FCFA</div>
              <div className="text-xs text-white/50 mb-4">{p.category?.name || 'Autre'}</div>

              <button
                onClick={() => openBnpl(p)}
                className="w-full py-2 rounded-lg bg-gradient-to-r from-[#4DB049] to-[#196D43] text-[#FFFFFF] font-medium"
              >
                Acheter en BNPL
              </button>
            </div>
          ))}
        </div>

        {/* BNPL Simulation Modal */}
        {selectedProduct && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setSelectedProduct(null)}>
            <div className="bg-[#014945] rounded-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-bold text-white mb-4">Payer en plusieurs fois — {selectedProduct.name}</h2>

              <div className="flex gap-2 mb-4">
                {[2,3,4,6].map(n => (
                  <button key={n} onClick={() => updateSimulation(n, frequency)} className={`px-4 py-1 rounded ${count === n ? 'bg-[#4DB049] text-black' : 'bg-white/10'}`}>
                    {n}x
                  </button>
                ))}
              </div>

              <div className="flex gap-2 mb-6">
                {(['daily','weekly','monthly'] as const).map(f => (
                  <button key={f} onClick={() => updateSimulation(count, f)} className={`px-3 py-1 text-sm rounded ${frequency === f ? 'bg-[#4DB049] text-black' : 'bg-white/10'}`}>
                    {f === 'daily' ? 'Journalier' : f === 'weekly' ? 'Hebdomadaire' : 'Mensuel'}
                  </button>
                ))}
              </div>

              {simulation?.plan && (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-white/70">
                    <span>Total à rembourser</span>
                    <span className="text-white font-bold">{simulation.plan.total} FCFA</span>
                  </div>
                  <div className="flex justify-between text-white/70">
                    <span>Par échéance ({simulation.plan.count} versements)</span>
                    <span className="text-white">{simulation.plan.instalmentAmount} FCFA</span>
                  </div>

                  <div className="mt-4">
                    <div className="text-xs text-white/50 mb-2">Échéancier ({simulation.plan.frequency})</div>
                    {simulation.plan.schedule.map((s: any, i: number) => (
                      <div key={i} className="flex justify-between py-1 border-b border-white/10 text-white/80">
                        <span>Échéance {s.index}</span>
                        <span>{new Date(s.dueDate).toLocaleDateString('fr-FR')} — {s.amount} FCFA</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button onClick={() => setSelectedProduct(null)} className="flex-1 py-2.5 rounded-lg bg-white/10">Annuler</button>
                <button className="flex-1 py-2.5 rounded-lg bg-[#4DB049] text-black font-medium">Confirmer l'achat BNPL</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
