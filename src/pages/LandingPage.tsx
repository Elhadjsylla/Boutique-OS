import React, { useState } from 'react';
import { Login } from '../components/Login';

export const LandingPage: React.FC = () => {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [activeSimTab, setActiveSimTab] = useState<'caisse' | 'stock' | 'ardoise' | 'dashboard'>('caisse');

  // Mini simulator database simulation state
  const [simCart, setSimCart] = useState<{ id: string; nom: string; prix: number; qty: number }[]>([
    { id: '1', nom: 'Huile de Palme', prix: 2500, qty: 1 },
    { id: '2', nom: 'Riz Long Grain 5kg', prix: 6750, qty: 1 }
  ]);

  const simTotal = simCart.reduce((sum, item) => sum + item.prix * item.qty, 0);

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 overflow-x-hidden font-body-md relative selection:bg-primary-container selection:text-primary">
      
      {/* CSS Background Grid & Glowing Mesh Blobs */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
      
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full filter blur-[120px] pointer-events-none animate-pulse-subtle" />
      <div className="absolute top-[20%] right-1/4 w-[400px] h-[400px] bg-emerald-600/10 rounded-full filter blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-10 w-[350px] h-[350px] bg-purple-600/10 rounded-full filter blur-[90px] pointer-events-none" />

      {/* Header / Glass Navbar */}
      <header className="fixed top-0 left-0 w-full z-50 bg-[#030712]/70 backdrop-blur-md border-b border-slate-800/60">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-violet-600/20">
              <span className="text-white text-sm font-black">OS</span>
            </div>
            <span className="text-lg font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">BoutikOS</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-400">
            <a href="#features" className="hover:text-slate-100 transition-colors">Fonctionnalités</a>
            <a href="#demo" className="hover:text-slate-100 transition-colors">Démo Interactive</a>
            <a href="#security" className="hover:text-slate-100 transition-colors">Sécurité</a>
          </nav>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowLoginModal(true)}
              className="px-4 h-9.5 text-xs font-bold tracking-wider uppercase bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 hover:border-slate-700 active:scale-95 transition-all text-slate-300"
            >
              Se Connecter
            </button>
            <button 
              onClick={() => setShowLoginModal(true)}
              className="px-4.5 h-9.5 text-xs font-black tracking-wider uppercase bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/20 hover:scale-[1.03] active:scale-95 transition-all"
            >
              Créer un commerce
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 max-w-5xl mx-auto text-center flex flex-col items-center">
        {/* Shiny badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900/80 border border-slate-800/80 rounded-full text-xs text-slate-300 mb-8 backdrop-blur-sm shadow-inner">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-semibold">BoutikOS v2.0 est disponible hors-ligne</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[1.1] max-w-4xl text-white mb-6">
          Le système d'exploitation moderne <br />
          <span className="bg-gradient-to-r from-violet-400 via-indigo-200 to-emerald-300 bg-clip-text text-transparent">
            pour votre point de vente.
          </span>
        </h1>

        <p className="text-base md:text-lg text-slate-400 max-w-2xl leading-relaxed mb-10">
          Gérez vos ventes, contrôlez vos stocks en temps réel et suivez le carnet d'ardoises clients avec une interface ultra-fluide conçue pour votre smartphone.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center w-full max-w-md mb-20">
          <button 
            onClick={() => setShowLoginModal(true)}
            className="w-full sm:w-auto px-8 h-13 text-sm font-black tracking-wide uppercase bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-600/30 hover:scale-[1.02] active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            Lancer l'application <span className="material-symbols-outlined text-lg">arrow_forward</span>
          </button>
          <a
            href="#demo"
            className="w-full sm:w-auto px-8 h-13 text-sm font-bold tracking-wide uppercase bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800 rounded-2xl text-slate-300 transition-all flex items-center justify-center gap-2"
          >
            Voir la démo
          </a>
        </div>

        {/* Dashboard Visual Mockup with Glassmorphism */}
        <div className="w-full max-w-4xl border border-slate-800/80 bg-slate-950/40 rounded-[28px] p-2 backdrop-blur-md shadow-2xl shadow-indigo-500/5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent z-10" />
          <div className="absolute inset-0 bg-gradient-to-tr from-violet-500/10 via-transparent to-emerald-500/5 pointer-events-none" />
          
          <div className="rounded-[20px] overflow-hidden border border-slate-900 bg-slate-950/60 aspect-[16/9] flex items-center justify-center relative">
            {/* Mock Dashboard UI inside the mockup */}
            <div className="w-full h-full p-4 flex flex-col gap-3 text-left">
              {/* Header inside mockup */}
              <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-violet-600 flex items-center justify-center text-[10px] font-black text-white">OS</div>
                  <span className="text-xs font-bold text-white">BoutikOS - Aperçu</span>
                </div>
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                </div>
              </div>
              {/* Content Grid inside mockup */}
              <div className="grid grid-cols-3 gap-3 mt-1">
                <div className="bg-slate-900/80 border border-slate-800/50 p-3 rounded-xl flex flex-col justify-between h-20">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Ventes Aujourd'hui</span>
                  <span className="text-lg font-black text-emerald-400">145 000 FCFA</span>
                </div>
                <div className="bg-slate-900/80 border border-slate-800/50 p-3 rounded-xl flex flex-col justify-between h-20">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Crédits Encours</span>
                  <span className="text-lg font-black text-rose-400">32 500 FCFA</span>
                </div>
                <div className="bg-slate-900/80 border border-slate-800/50 p-3 rounded-xl flex flex-col justify-between h-20">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Articles en Rupture</span>
                  <span className="text-lg font-black text-amber-500">3 produits</span>
                </div>
              </div>
              {/* Big graph mockup placeholder */}
              <div className="bg-slate-900/60 border border-slate-800/40 p-4 rounded-xl flex-1 flex flex-col justify-between relative overflow-hidden">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Courbe d'activité</span>
                  <span className="text-[10px] text-slate-500">Mise à jour en temps réel</span>
                </div>
                {/* SVG Mock Curve Graph */}
                <div className="w-full h-16 mt-2 relative">
                  <svg className="w-full h-full" viewBox="0 0 100 20" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="glowGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0 20 C10 12, 20 8, 30 14 C40 18, 50 2, 60 8 C70 12, 80 1, 100 4 L100 20 Z" fill="url(#glowGrad)" />
                    <path d="M0 20 C10 12, 20 8, 30 14 C40 18, 50 2, 60 8 C70 12, 80 1, 100 4" fill="none" stroke="#6366f1" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bento Grid: Features Section */}
      <section id="features" className="py-24 px-4 max-w-5xl mx-auto border-t border-slate-900">
        <div className="text-center mb-16">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-3">Conçu pour la performance au quotidien</h2>
          <p className="text-sm text-slate-400">Tous les outils indispensables réunis au même endroit.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Box 1: Caisse */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-6 rounded-[24px] hover:border-violet-500/40 transition-all flex flex-col justify-between h-72 group">
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-600/10 border border-violet-500/25 flex items-center justify-center text-violet-400 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">point_of_sale</span>
              </div>
              <h3 className="font-bold text-lg text-white">Caisse Intelligente</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ajoutez des produits au panier, gérez les quantités, appliquez des remises et validez l'encaissement en quelques secondes.
              </p>
            </div>
            <span className="text-[10px] text-violet-400 font-extrabold uppercase tracking-widest mt-4">Vitesse & Fluidité</span>
          </div>

          {/* Box 2: Stock */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-6 rounded-[24px] hover:border-emerald-500/40 transition-all flex flex-col justify-between h-72 group">
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-600/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">inventory_2</span>
              </div>
              <h3 className="font-bold text-lg text-white">Suivi des Stocks</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ajustez vos prix, visualisez vos produits en rupture, recevez des alertes automatiques et réapprovisionnez en un clic.
              </p>
            </div>
            <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest mt-4">Zéro Rupture Surprise</span>
          </div>

          {/* Box 3: Slate / Ardoise */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-6 rounded-[24px] hover:border-amber-500/40 transition-all flex flex-col justify-between h-72 group">
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-600/10 border border-amber-500/25 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">book</span>
              </div>
              <h3 className="font-bold text-lg text-white">Carnet de Dettes</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Suivez les ardoises de vos clients fidèles. Enregistrez des paiements partiels et gérez les crédits en toute clarté.
              </p>
            </div>
            <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest mt-4">Comptabilité Simplifiée</span>
          </div>
        </div>
      </section>

      {/* Simulator Section (Live interaction demo) */}
      <section id="demo" className="py-20 px-4 max-w-5xl mx-auto border-t border-slate-900 relative">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-black text-white mb-3">Démo interactive en un clic</h2>
          <p className="text-sm text-slate-400">Interagissez avec le simulateur BoutikOS ci-dessous pour tester l'interface.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Controls list (Left side on large screen) */}
          <div className="lg:col-span-4 flex flex-col gap-3">
            {[
              { id: 'caisse', label: 'Caisse de Vente', icon: 'point_of_sale', desc: 'Ajout de produits et encaissement rapide.' },
              { id: 'stock', label: 'Gestion des Stocks', icon: 'inventory_2', desc: 'Suivi de l\'inventaire et alertes bas stock.' },
              { id: 'ardoise', label: 'Carnet d\'Ardoises', icon: 'book', desc: 'Gestion des ardoises et des dettes clients.' },
              { id: 'dashboard', label: 'Analyses', icon: 'monitoring', desc: 'Aperçu des performances de la boutique.' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSimTab(tab.id as any)}
                className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                  activeSimTab === tab.id
                    ? 'bg-slate-900 border-indigo-500/50 shadow-lg text-white'
                    : 'bg-transparent border-slate-800/40 text-slate-400 hover:border-slate-800 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`material-symbols-outlined ${activeSimTab === tab.id ? 'text-indigo-400' : 'text-slate-500'}`}>{tab.icon}</span>
                  <div>
                    <h4 className="font-bold text-xs">{tab.label}</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{tab.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Device Mockup containing interactive simulated screens (Right side) */}
          <div className="lg:col-span-8 flex justify-center">
            <div className="w-full max-w-[340px] aspect-[9/18.5] bg-slate-950 rounded-[44px] border-[10px] border-slate-800 shadow-2xl relative overflow-hidden flex flex-col ring-1 ring-slate-700/50">
              
              {/* Phone Speaker & Camera Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-2xl z-40 flex items-center justify-center">
                <div className="w-12 h-1 bg-slate-900 rounded-full mb-1" />
              </div>

              {/* simulated OS Header */}
              <div className="bg-slate-900 text-slate-300 pt-8 pb-3 px-4 flex justify-between items-center border-b border-slate-800/50 text-[10px] font-bold">
                <span>BoutikOS Demo</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> En ligne
                </span>
              </div>

              {/* Simulated Screens Content Area */}
              <div className="flex-1 bg-slate-950 p-3 overflow-y-auto text-left text-xs select-none">
                
                {/* 1. CAISSE SIMULATOR */}
                {activeSimTab === 'caisse' && (
                  <div className="flex flex-col gap-3 h-full justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Panier Courant</span>
                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-wider">2 Articles</span>
                      </div>
                      
                      <div className="flex flex-col gap-1.5">
                        {simCart.map(item => (
                          <div key={item.id} className="flex justify-between items-center bg-slate-900/60 border border-slate-800/60 p-2 rounded-xl">
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-slate-200 text-[11px] truncate">{item.nom}</p>
                              <p className="text-[9px] text-slate-500">{item.prix} FCFA x {item.qty}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button 
                                onClick={() => {
                                  setSimCart(simCart.map(i => i.id === item.id ? { ...i, qty: Math.max(1, i.qty - 1) } : i));
                                }}
                                className="w-5 h-5 bg-slate-800 hover:bg-slate-700 active:scale-90 rounded flex items-center justify-center font-bold text-slate-300"
                              >
                                -
                              </button>
                              <span className="text-[11px] font-bold w-3 text-center">{item.qty}</span>
                              <button 
                                onClick={() => {
                                  setSimCart(simCart.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
                                }}
                                className="w-5 h-5 bg-slate-800 hover:bg-slate-700 active:scale-90 rounded flex items-center justify-center font-bold text-slate-300"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-slate-900 pt-3">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-slate-400 font-bold text-[11px]">Total Panier</span>
                        <span className="text-indigo-400 font-black text-sm">{simTotal} FCFA</span>
                      </div>
                      <button
                        onClick={() => {
                          alert(`Simulé : Vente encaissée pour un montant total de ${simTotal} FCFA !`);
                          setSimCart([
                            { id: '1', nom: 'Huile de Palme', prix: 2500, qty: 1 },
                            { id: '2', nom: 'Riz Long Grain 5kg', prix: 6750, qty: 1 }
                          ]);
                        }}
                        className="w-full h-9 bg-indigo-600 hover:bg-indigo-500 font-black text-[10px] text-white rounded-xl uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center"
                      >
                        Encaisser la vente
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. STOCK SIMULATOR */}
                {activeSimTab === 'stock' && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Alerte & Inventaire</span>
                    
                    <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h5 className="font-bold text-[11px] text-amber-200">Sucre en Poudre</h5>
                        <p className="text-[9px] text-amber-400/80">Rupture imminente : 1 restant</p>
                      </div>
                      <button
                        onClick={() => alert("Simulé : 10 unités de Sucre en Poudre ajoutées !")}
                        className="px-2 h-6 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 text-[10px] font-black rounded-lg active:scale-90 transition-all"
                      >
                        RÉAPPRO (+10)
                      </button>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex justify-between items-center mt-2">
                      <div>
                        <h5 className="font-bold text-[11px] text-slate-200">Riz Long Grain 5kg</h5>
                        <p className="text-[9px] text-slate-500">En stock : 15 sacs</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[8px] font-bold uppercase">OK</span>
                    </div>

                    <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex justify-between items-center">
                      <div>
                        <h5 className="font-bold text-[11px] text-slate-200">Lait Concentré</h5>
                        <p className="text-[9px] text-slate-500">En stock : 48 boites</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[8px] font-bold uppercase">OK</span>
                    </div>
                  </div>
                )}

                {/* 3. ARDOISE SIMULATOR */}
                {activeSimTab === 'ardoise' && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Dettes en cours</span>

                    <div className="bg-slate-900/60 border border-slate-800/80 p-2.5 rounded-xl flex justify-between items-center">
                      <div>
                        <h5 className="font-bold text-[11px] text-slate-200">Mamadou Diallo</h5>
                        <p className="text-[9px] text-slate-500">Mis à jour il y a 2h</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-rose-400 text-[11px]">12 500 FCFA</p>
                        <button 
                          onClick={() => alert("Simulé : Remboursement de 5 000 FCFA reçu de Mamadou Diallo")}
                          className="text-[9px] text-indigo-400 font-bold hover:underline cursor-pointer"
                        >
                          Régler
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-900/60 border border-slate-800/80 p-2.5 rounded-xl flex justify-between items-center">
                      <div>
                        <h5 className="font-bold text-[11px] text-slate-200">Fatou Sow</h5>
                        <p className="text-[9px] text-slate-500">Mis à jour hier</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-rose-400 text-[11px]">8 000 FCFA</p>
                        <button 
                          onClick={() => alert("Simulé : Remboursement de 8 000 FCFA reçu de Fatou Sow")}
                          className="text-[9px] text-indigo-400 font-bold hover:underline cursor-pointer"
                        >
                          Régler
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. DASHBOARD SIMULATOR */}
                {activeSimTab === 'dashboard' && (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-900 p-2 rounded-xl text-center">
                        <span className="text-[8px] font-bold text-slate-500 uppercase">Chiffre d'Affaires</span>
                        <p className="font-bold text-emerald-400 text-[11px] mt-0.5">145 000 F</p>
                      </div>
                      <div className="bg-slate-900 p-2 rounded-xl text-center">
                        <span className="text-[8px] font-bold text-slate-500 uppercase">Bénéfice Estimé</span>
                        <p className="font-bold text-indigo-400 text-[11px] mt-0.5">28 900 F</p>
                      </div>
                    </div>

                    <div className="bg-slate-900 border border-slate-800/50 p-2.5 rounded-xl">
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Ventes Populaires</span>
                      <div className="flex justify-between items-center text-[10px] text-slate-300 border-b border-slate-800/50 pb-1">
                        <span>1. Huile de Palme</span>
                        <span className="font-bold">12 ventes</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-300 pt-1">
                        <span>2. Riz Long Grain</span>
                        <span className="font-bold">9 ventes</span>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Bottom Nav Mockup */}
              <div className="bg-slate-900 border-t border-slate-800/80 py-2.5 px-4 flex justify-between items-center text-slate-500 text-[9px] font-bold">
                <div className={`flex flex-col items-center gap-0.5 ${activeSimTab === 'caisse' ? 'text-indigo-400' : ''}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>point_of_sale</span>
                  <span>Caisse</span>
                </div>
                <div className={`flex flex-col items-center gap-0.5 ${activeSimTab === 'stock' ? 'text-indigo-400' : ''}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>inventory_2</span>
                  <span>Stock</span>
                </div>
                <div className={`flex flex-col items-center gap-0.5 ${activeSimTab === 'ardoise' ? 'text-indigo-400' : ''}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>book</span>
                  <span>Ardoises</span>
                </div>
                <div className={`flex flex-col items-center gap-0.5 ${activeSimTab === 'dashboard' ? 'text-indigo-400' : ''}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>monitoring</span>
                  <span>Analyses</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security and Offline first section */}
      <section id="security" className="py-24 px-4 max-w-5xl mx-auto border-t border-slate-900 text-center">
        <div className="max-w-2xl mx-auto flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 mb-2">
            <span className="material-symbols-outlined text-2xl">offline_bolt</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white">Technologie Locale Securisée</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Grâce à l'utilisation d'une base de données locale synchronisée (Dexie), BoutikOS fonctionne à 100% même en cas de coupure Internet. Vos données de ventes et de stocks restent disponibles et s'actualisent en arrière-plan dès la reconnexion.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-900 bg-slate-950 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-tr from-violet-600 to-emerald-500 flex items-center justify-center">
              <span className="text-white text-[9px] font-black">OS</span>
            </div>
            <span className="font-extrabold text-slate-400">BoutikOS</span>
          </div>
          <p>© 2026 BoutikOS. Le système d'exploitation de votre boutique.</p>
        </div>
      </footer>

      {/* Auth / Login Modal Wrapper */}
      {showLoginModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          {/* Modal Container */}
          <div className="relative w-full max-w-md bg-[#0D0E12] border border-slate-800 rounded-[28px] overflow-hidden shadow-2xl p-6">
            
            {/* Close Button */}
            <button 
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            {/* Injected Login Component */}
            <div className="pt-2 text-slate-100">
              <Login isModal={true} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
