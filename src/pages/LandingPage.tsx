import React, { useState, useEffect } from 'react';
import { Login } from '../components/Login';
import { Toast } from '../components/ui/Toast';

interface LandingPageProps {
  isLoggedIn?: boolean;
  onBackToApp?: () => void;
  onNavigateToPortal?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ 
  isLoggedIn = false, 
  onBackToApp,
  onNavigateToPortal
}) => {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [activeSimTab, setActiveSimTab] = useState<'caisse' | 'stock' | 'ardoise' | 'dashboard'>('caisse');
  const [activeSection, setActiveSection] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const sections = ['problem', 'solution', 'features', 'how-it-works', 'demo', 'security'];
    
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200; // offset for navbar & screen layout
      
      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(sectionId);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Mini simulator database simulation state
  const [simCart, setSimCart] = useState<{ id: string; nom: string; prix: number; qty: number }[]>([
    { id: '1', nom: 'Huile de Palme', prix: 2500, qty: 1 },
    { id: '2', nom: 'Riz Long Grain 5kg', prix: 6750, qty: 1 }
  ]);

  const simTotal = simCart.reduce((sum, item) => sum + item.prix * item.qty, 0);

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#1A1A2E] overflow-x-hidden font-body-md relative selection:bg-primary-container selection:text-primary">
      
      {/* Light Theme Background Grid & Soft Primary/Secondary Ambient Halos */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f080_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f080_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_80%,transparent_100%)] pointer-events-none" />
      
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full filter blur-[120px] pointer-events-none animate-pulse-subtle" />
      <div className="absolute top-[20%] right-1/4 w-[400px] h-[400px] bg-secondary/5 rounded-full filter blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-10 w-[350px] h-[350px] bg-tertiary/5 rounded-full filter blur-[90px] pointer-events-none" />

      {/* Header / Light Glass Navbar */}
      <header className="fixed top-0 left-0 w-full z-50 bg-[#F5F7FA]/80 backdrop-blur-md border-b border-outline-variant/80">
        <div className="max-w-6xl mx-auto px-4 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-md text-white">
              <svg className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
            </div>
            <span className="text-base md:text-lg font-black tracking-tight text-primary">Sama Boutik</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-texte-2">
            <a 
              href="#features" 
              className={`pb-1 transition-all border-b-2 ${
                activeSection === 'features' 
                  ? 'text-primary border-primary font-black scale-105' 
                  : 'border-transparent hover:text-primary hover:border-primary/20'
              }`}
            >
              Fonctionnalités
            </a>
            <a 
              href="#demo" 
              className={`pb-1 transition-all border-b-2 ${
                activeSection === 'demo' 
                  ? 'text-primary border-primary font-black scale-105' 
                  : 'border-transparent hover:text-primary hover:border-primary/20'
              }`}
            >
              Démo Interactive
            </a>
            <a 
              href="#security" 
              className={`pb-1 transition-all border-b-2 ${
                activeSection === 'security' 
                  ? 'text-primary border-primary font-black scale-105' 
                  : 'border-transparent hover:text-primary hover:border-primary/20'
              }`}
            >
              Sécurité
            </a>
          </nav>

          {/* Desktop buttons */}
          <div className="hidden md:flex items-center gap-3">
            <button 
              onClick={onNavigateToPortal}
              className="px-3.5 h-9.5 text-xs font-black tracking-wider uppercase border border-emerald-500/30 text-emerald-600 bg-emerald-50 hover:bg-emerald-100/50 rounded-xl transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
              title="Accéder à l'espace de suivi de vos dettes"
            >
              <span className="material-symbols-outlined text-sm">menu_book</span>
              Espace Client
            </button>
            {isLoggedIn ? (
              <button 
                onClick={onBackToApp}
                className="px-4.5 h-9.5 text-xs font-black tracking-wider uppercase bg-secondary text-white rounded-xl shadow-md hover:scale-[1.03] active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>dashboard</span>
                Accéder à l'App
              </button>
            ) : (
              <>
                <button 
                  onClick={() => setShowLoginModal(true)}
                  className="px-4 h-9.5 text-xs font-bold tracking-wider uppercase bg-white border border-outline-variant rounded-xl hover:bg-surface-container hover:border-outline active:scale-95 transition-all text-texte"
                >
                  Se Connecter
                </button>
                <button 
                  onClick={() => setShowLoginModal(true)}
                  className="px-4.5 h-9.5 text-xs font-black tracking-wider uppercase bg-primary text-white rounded-xl shadow-md hover:scale-[1.03] active:scale-95 transition-all"
                >
                  Créer un commerce
                </button>
              </>
            )}
          </div>

          {/* Mobile: compact action buttons */}
          <div className="flex md:hidden items-center gap-2">
            <button 
              onClick={onNavigateToPortal}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-emerald-500/30 text-emerald-600 bg-emerald-50 active:scale-95 transition-all cursor-pointer"
              title="Espace Client"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>menu_book</span>
            </button>
            {isLoggedIn ? (
              <button 
                onClick={onBackToApp}
                className="h-8 px-3 text-[10px] font-black tracking-wider uppercase bg-secondary text-white rounded-lg shadow-md active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>dashboard</span>
                App
              </button>
            ) : (
              <button 
                onClick={() => setShowLoginModal(true)}
                className="h-8 px-3 text-[10px] font-black tracking-wider uppercase bg-primary text-white rounded-lg shadow-md active:scale-95 transition-all cursor-pointer"
              >
                Connexion
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 max-w-5xl mx-auto text-center flex flex-col items-center">
        {/* Shiny badge */}
        <div className="reveal transition-all duration-1000 ease-out transform  delay-75 inline-flex items-center gap-2 px-3 py-1 bg-white border border-outline-variant rounded-full text-xs text-texte-2 mb-8 backdrop-blur-sm shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping" />
          <span className="font-semibold">Deviens le gérant qui contrôle tout</span>
        </div>

        <h1 className="reveal transition-all duration-1000 ease-out transform  delay-150 text-4xl md:text-6xl font-black tracking-tight leading-[1.1] max-w-4xl text-primary mb-6">
          Gère ta boutique <br />
          <span className="bg-gradient-to-r from-primary via-[#2E5B88] to-secondary bg-clip-text text-transparent">
            comme un vrai patron.
          </span>
        </h1>

        <p className="reveal transition-all duration-1000 ease-out transform  delay-200 text-base md:text-lg text-texte-2 max-w-2xl leading-relaxed mb-8">
          Caisse, stock, dettes clients — tout dans ta poche, en temps réel.
        </p>

        {/* Scattered floating money and retail icons */}
        <div className="absolute top-20 left-6 md:left-20 text-4xl md:text-5xl select-none animate-bounce opacity-80 filter drop-shadow-[0_8px_16px_rgba(26,60,94,0.06)]" style={{ animationDuration: '3.2s' }}>💸</div>
        <div className="absolute top-28 right-6 md:right-20 text-4xl md:text-5xl select-none animate-bounce opacity-80 filter drop-shadow-[0_8px_16px_rgba(26,60,94,0.06)]" style={{ animationDuration: '4s', animationDelay: '0.4s' }}>🪙</div>
        <div className="absolute top-1/2 -left-2 md:left-8 text-4xl md:text-5xl select-none animate-bounce opacity-80 filter drop-shadow-[0_8px_16px_rgba(26,60,94,0.06)]" style={{ animationDuration: '3.6s', animationDelay: '0.8s' }}>🛒</div>
        <div className="absolute top-1/2 -right-2 md:right-8 text-4xl md:text-5xl select-none animate-bounce opacity-80 filter drop-shadow-[0_8px_16px_rgba(26,60,94,0.06)]" style={{ animationDuration: '4.4s', animationDelay: '1.2s' }}>💳</div>
        <div className="absolute bottom-6 left-8 md:left-24 text-4xl md:text-5xl select-none animate-bounce opacity-80 filter drop-shadow-[0_8px_16px_rgba(26,60,94,0.06)]" style={{ animationDuration: '4.8s', animationDelay: '1.6s' }}>💵</div>
        <div className="absolute bottom-8 right-8 md:right-24 text-4xl md:text-5xl select-none animate-bounce opacity-80 filter drop-shadow-[0_8px_16px_rgba(26,60,94,0.06)]" style={{ animationDuration: '5.2s', animationDelay: '2s' }}>🛍️</div>
        
        {/* Additional icons */}
        <div className="absolute top-24 left-1/3 text-4xl select-none animate-bounce opacity-70 filter drop-shadow-[0_8px_16px_rgba(26,60,94,0.05)] hidden md:block" style={{ animationDuration: '4.2s', animationDelay: '0.6s' }}>📈</div>
        <div className="absolute top-36 right-1/3 text-4xl select-none animate-bounce opacity-75 filter drop-shadow-[0_8px_16px_rgba(26,60,94,0.05)] hidden md:block" style={{ animationDuration: '3.8s', animationDelay: '1s' }}>🏷️</div>
        <div className="absolute bottom-32 left-1/4 text-4xl select-none animate-bounce opacity-70 filter drop-shadow-[0_8px_16px_rgba(26,60,94,0.05)] hidden md:block" style={{ animationDuration: '4.6s', animationDelay: '1.4s' }}>🧾</div>
        <div className="absolute top-1/3 left-2 text-4xl select-none animate-bounce opacity-75 filter drop-shadow-[0_8px_16px_rgba(26,60,94,0.05)]" style={{ animationDuration: '3.4s', animationDelay: '0.2s' }}>📦</div>
        <div className="absolute bottom-1/3 right-4 text-4xl select-none animate-bounce opacity-75 filter drop-shadow-[0_8px_16px_rgba(26,60,94,0.05)]" style={{ animationDuration: '4.5s', animationDelay: '1.8s' }}>💎</div>
        <div className="absolute bottom-20 right-1/4 text-4xl select-none animate-bounce opacity-70 filter drop-shadow-[0_8px_16px_rgba(26,60,94,0.05)] hidden md:block" style={{ animationDuration: '5s', animationDelay: '2.2s' }}>🔔</div>

        <div className="reveal transition-all duration-1000 ease-out transform  delay-300 flex flex-col md:flex-row gap-3.5 justify-center items-stretch w-full max-w-4xl mb-20 z-10">
          {isLoggedIn ? (
            <button 
              onClick={onBackToApp}
              className="w-full md:w-auto px-6 py-4.5 text-xs font-black tracking-wide uppercase bg-secondary text-white rounded-2xl shadow-lg hover:scale-[1.02] active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              Ouvrir ma caisse 🚀
            </button>
          ) : (
            <button 
              onClick={() => setShowLoginModal(true)}
              className="w-full md:w-auto px-6 py-4.5 text-xs font-black tracking-wide uppercase bg-primary text-white rounded-2xl shadow-lg hover:scale-[1.02] active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              Essayer maintenant — c'est gratuit
            </button>
          )}
          <button 
            onClick={onNavigateToPortal}
            className="w-full md:w-auto px-6 py-4.5 text-xs font-black tracking-wide uppercase bg-emerald-600 text-white rounded-2xl shadow-md hover:scale-[1.02] active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            Consulter mes Dettes 👤
          </button>
          <a
            href="#demo"
            className="w-full md:w-auto px-6 py-4.5 text-xs font-black tracking-wide uppercase bg-white hover:bg-surface-container border border-outline-variant rounded-2xl text-texte transition-all flex items-center justify-center gap-2 whitespace-nowrap"
          >
            Tester sans compte (2s) ⚡
          </a>
        </div>

        {/* Dashboard Visual Mockup with Light Glassmorphism */}
        <div className="reveal transition-all duration-1000 ease-out transform  delay-300 w-full max-w-4xl border border-outline-variant bg-white/60 rounded-[28px] p-2 backdrop-blur-md shadow-xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-secondary/5 pointer-events-none" />
          
          <div className="rounded-[20px] overflow-hidden border border-outline-variant/60 bg-white aspect-[16/9] flex items-center justify-center relative">
            {/* Mock Dashboard UI inside the mockup */}
            <div className="w-full h-full p-2 md:p-4 flex flex-col gap-1.5 md:gap-3 text-left">
              {/* Header inside mockup */}
              <div className="flex items-center justify-between border-b border-outline-variant pb-1.5 md:pb-3">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <div className="w-4 h-4 md:w-6 md:h-6 rounded bg-primary flex items-center justify-center text-white">
                    <svg className="w-2.5 h-2.5 md:w-3.5 md:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                      <line x1="3" y1="6" x2="21" y2="6"></line>
                      <path d="M16 10a4 4 0 0 1-8 0"></path>
                    </svg>
                  </div>
                  <span className="text-[8px] md:text-xs font-bold text-texte">Sama Boutik - Aperçu</span>
                </div>
                <div className="flex gap-1 md:gap-1.5">
                  <span className="w-1.5 h-1.5 md:w-2.5 md:h-2.5 rounded-full bg-outline-variant" />
                  <span className="w-1.5 h-1.5 md:w-2.5 md:h-2.5 rounded-full bg-outline-variant" />
                  <span className="w-1.5 h-1.5 md:w-2.5 md:h-2.5 rounded-full bg-outline-variant" />
                </div>
              </div>
              {/* Content Grid inside mockup */}
              <div className="grid grid-cols-3 gap-1.5 md:gap-3 mt-1">
                <div className="bg-surface-container-lowest border border-outline-variant p-1.5 md:p-3 rounded-lg md:rounded-xl flex flex-col justify-between min-h-[3rem] md:h-20">
                  <span className="text-[7px] md:text-[9px] font-bold text-outline uppercase tracking-wide leading-tight">Ventes Aujourd'hui</span>
                  <span className="text-[10px] md:text-lg font-black text-secondary leading-tight">145 000 F</span>
                </div>
                <div className="bg-surface-container-lowest border border-outline-variant p-1.5 md:p-3 rounded-lg md:rounded-xl flex flex-col justify-between min-h-[3rem] md:h-20">
                  <span className="text-[7px] md:text-[9px] font-bold text-outline uppercase tracking-wide leading-tight">Crédits En cours</span>
                  <span className="text-[10px] md:text-lg font-black text-error leading-tight">32 500 F</span>
                </div>
                <div className="bg-surface-container-lowest border border-outline-variant p-1.5 md:p-3 rounded-lg md:rounded-xl flex flex-col justify-between min-h-[3rem] md:h-20">
                  <span className="text-[7px] md:text-[9px] font-bold text-outline uppercase tracking-wide leading-tight">Articles en Rupture</span>
                  <span className="text-[10px] md:text-lg font-black text-tertiary leading-tight">3 produits</span>
                </div>
              </div>
              {/* Big graph mockup placeholder */}
              <div className="bg-surface-container-lowest border border-outline-variant/60 p-2 md:p-4 rounded-lg md:rounded-xl flex-1 flex flex-col justify-between relative overflow-hidden">
                <div className="flex justify-between items-center gap-1">
                  <span className="text-[7px] md:text-[10px] font-bold text-texte-2 uppercase tracking-wide">Courbe d'activité</span>
                  <span className="text-[7px] md:text-[10px] text-outline hidden sm:inline">Mise à jour en temps réel</span>
                </div>
                {/* SVG Mock Curve Graph */}
                <div className="w-full h-10 md:h-16 mt-1 md:mt-2 relative">
                  <svg className="w-full h-full" viewBox="0 0 100 20" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="glowGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1A3C5E" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#1A3C5E" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0 20 C10 12, 20 8, 30 14 C40 18, 50 2, 60 8 C70 12, 80 1, 100 4 L100 20 Z" fill="url(#glowGrad)" />
                    <path d="M0 20 C10 12, 20 8, 30 14 C40 18, 50 2, 60 8 C70 12, 80 1, 100 4" fill="none" stroke="#1A3C5E" strokeWidth="1.5" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: Le Problème (The Pain Points) */}
      <section id="problem" className="py-20 px-4 max-w-5xl mx-auto border-t border-outline-variant text-center">
        <div className="reveal transition-all duration-1000 ease-out transform  delay-75 mb-12">
          <span className="text-[10px] text-error font-extrabold uppercase tracking-widest bg-error-container/40 px-3 py-1 rounded-full">Le Constat</span>
          <h2 className="text-2xl md:text-3xl font-black text-primary mt-3">Gérer une boutique sur papier, c'est l'enfer.</h2>
          <p className="text-sm text-texte-2 mt-2">Chaque jour, des centaines de commerçants perdent du temps et de l'argent à cause de processus obsolètes.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="reveal transition-all duration-1000 ease-out transform  delay-150 bg-white border border-outline-variant p-6 rounded-[24px] flex flex-col gap-3 hover:scale-[1.02] hover:shadow-md hover:border-error/20 transition-all duration-300">
            <span className="material-symbols-outlined text-error text-3xl">sms_failed</span>
            <h4 className="font-bold text-texte text-base">Crédits Clients oubliés</h4>
            <p className="text-xs text-texte-2 leading-relaxed">
              Une ardoise notée sur un bout de carton qui se perd, un client de confiance qui oublie... Ce sont des milliers de FCFA perdus chaque mois.
            </p>
          </div>
          <div className="reveal transition-all duration-1000 ease-out transform  delay-225 bg-white border border-outline-variant p-6 rounded-[24px] flex flex-col gap-3 hover:scale-[1.02] hover:shadow-md hover:border-error/20 transition-all duration-300">
            <span className="material-symbols-outlined text-error text-3xl">inventory</span>
            <h4 className="font-bold text-texte text-base">Ruptures de stock surprises</h4>
            <p className="text-xs text-texte-2 leading-relaxed">
              Ne pas savoir combien de bouteilles d'huile ou de sacs de riz il vous reste. Découvrir la rupture devant le client et rater la vente.
            </p>
          </div>
          <div className="reveal transition-all duration-1000 ease-out transform  delay-300 bg-white border border-outline-variant p-6 rounded-[24px] flex flex-col gap-3 hover:scale-[1.02] hover:shadow-md hover:border-error/20 transition-all duration-300">
            <span className="material-symbols-outlined text-error text-3xl">calculate</span>
            <h4 className="font-bold text-texte text-base">Calculs manuels interminables</h4>
            <p className="text-xs text-texte-2 leading-relaxed">
              Passer des heures chaque soir avec une calculatrice pour faire les comptes, avec le risque constant d'une erreur de caisse.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION: La Solution */}
      <section id="solution" className="py-20 px-4 max-w-5xl mx-auto border-t border-outline-variant text-center bg-secondary-container/10 rounded-[32px] my-10 border border-secondary-container/20">
        <div className="reveal transition-all duration-1000 ease-out transform  delay-75 mb-12">
          <span className="text-[10px] text-secondary font-extrabold uppercase tracking-widest bg-secondary-container px-3 py-1 rounded-full">La Solution</span>
          <h2 className="text-2xl md:text-3xl font-black text-primary mt-3">Sama Boutik : Tout dans ton téléphone.</h2>
          <p className="text-sm text-texte-2 mt-2">Une application rapide, moderne et intelligente conçue pour simplifier la vie des commerçants.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="reveal transition-all duration-1000 ease-out transform  delay-150 bg-white/80 backdrop-blur-sm border border-outline-variant p-6 rounded-[24px] flex flex-col gap-3 hover:scale-[1.02] hover:shadow-md hover:border-secondary/20 transition-all duration-300">
            <span className="material-symbols-outlined text-secondary text-3xl">check_circle</span>
            <h4 className="font-bold text-texte text-base">Crédits tracés & sécurisés</h4>
            <p className="text-xs text-texte-2 leading-relaxed">
              Enregistrez chaque dette en un clic au nom du client. Suivez les remboursements partiels en temps réel, sans risque de perte.
            </p>
          </div>
          <div className="reveal transition-all duration-1000 ease-out transform  delay-225 bg-white/80 backdrop-blur-sm border border-outline-variant p-6 rounded-[24px] flex flex-col gap-3 hover:scale-[1.02] hover:shadow-md hover:border-secondary/20 transition-all duration-300">
            <span className="material-symbols-outlined text-secondary text-3xl">notifications_active</span>
            <h4 className="font-bold text-texte text-base">Alertes de stock bas</h4>
            <p className="text-xs text-texte-2 leading-relaxed">
              Sama Boutik vous alerte dès qu'un produit passe sous le seuil critique. Vous réapprovisionnez à temps et ne ratez plus aucune vente.
            </p>
          </div>
          <div className="reveal transition-all duration-1000 ease-out transform  delay-300 bg-white/80 backdrop-blur-sm border border-outline-variant p-6 rounded-[24px] flex flex-col gap-3 hover:scale-[1.02] hover:shadow-md hover:border-secondary/20 transition-all duration-300">
            <span className="material-symbols-outlined text-secondary text-3xl">analytics</span>
            <h4 className="font-bold text-texte text-base">Caisse & Bilans automatiques</h4>
            <p className="text-xs text-texte-2 leading-relaxed">
              Ajoutez les articles au panier, encaissez et laissez Sama Boutik faire la comptabilité. Vos rapports d'activité sont prêts instantanément.
            </p>
          </div>
        </div>
      </section>

      {/* Bento Grid: Features Section */}
      <section id="features" className="py-24 px-4 max-w-5xl mx-auto border-t border-outline-variant">
        <div className="reveal transition-all duration-1000 ease-out transform  delay-75 text-center mb-16">
          <h2 className="text-2xl md:text-3xl font-black text-primary mb-3">Conçu pour la performance au quotidien</h2>
          <p className="text-sm text-texte-2">Tous les outils indispensables réunis au même endroit.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Box 1: Caisse */}
          <div className="reveal transition-all duration-1000 ease-out transform  delay-150 bg-white border border-outline-variant/60 p-6 rounded-[24px] hover:border-primary/40 flex flex-col justify-between h-72 group shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300">
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-container flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300">
                <span className="material-symbols-outlined">point_of_sale</span>
              </div>
              <h3 className="font-bold text-lg text-primary">Caisse Intelligente</h3>
              <p className="text-xs text-texte-2 leading-relaxed">
                Ajoutez des produits au panier, gérez les quantités, appliquez des remises et validez l'encaissement en quelques secondes.
              </p>
            </div>
            <span className="text-[10px] text-primary font-extrabold uppercase tracking-widest mt-4">Vitesse & Fluidité</span>
          </div>

          {/* Box 2: Stock */}
          <div className="reveal transition-all duration-1000 ease-out transform  delay-225 bg-white border border-outline-variant/60 p-6 rounded-[24px] hover:border-secondary/40 flex flex-col justify-between h-72 group shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300">
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 rounded-xl bg-secondary-container flex items-center justify-center text-secondary group-hover:scale-110 transition-transform duration-300">
                <span className="material-symbols-outlined">inventory_2</span>
              </div>
              <h3 className="font-bold text-lg text-primary">Suivi des Stocks</h3>
              <p className="text-xs text-texte-2 leading-relaxed">
                Ajustez vos prix, visualisez vos produits en rupture, recevez des alertes automatiques et réapprovisionnez en un clic.
              </p>
            </div>
            <span className="text-[10px] text-secondary font-extrabold uppercase tracking-widest mt-4">Zéro Rupture Surprise</span>
          </div>

          {/* Box 3: Slate / Ardoise */}
          <div className="reveal transition-all duration-1000 ease-out transform  delay-300 bg-white border border-outline-variant/60 p-6 rounded-[24px] hover:border-tertiary/40 flex flex-col justify-between h-72 group shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-300">
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 rounded-xl bg-tertiary-container flex items-center justify-center text-tertiary group-hover:scale-110 transition-transform duration-300">
                <span className="material-symbols-outlined">book</span>
              </div>
              <h3 className="font-bold text-lg text-primary">Crédits Clients</h3>
              <p className="text-xs text-texte-2 leading-relaxed">
                Suivez les crédits de vos clients fidèles. Enregistrez des paiements partiels et gérez les dettes en toute clarté.
              </p>
            </div>
            <span className="text-[10px] text-tertiary font-extrabold uppercase tracking-widest mt-4">Comptabilité Simplifiée</span>
          </div>
        </div>
      </section>

      {/* SECTION: Comment ça marche (How It Works) */}
      <section id="how-it-works" className="py-20 px-4 max-w-5xl mx-auto border-t border-outline-variant text-center">
        <div className="reveal transition-all duration-1000 ease-out transform  delay-75 mb-16">
          <span className="text-[10px] text-primary font-extrabold uppercase tracking-widest bg-primary-container px-3 py-1 rounded-full">Guide</span>
          <h2 className="text-2xl md:text-3xl font-black text-primary mt-3">Prêt en 3 étapes simples</h2>
          <p className="text-sm text-texte-2 mt-2">Démarrez votre transition numérique en moins de 2 minutes.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* Step 1 */}
          <div className="reveal transition-all duration-1000 ease-out transform  delay-150 flex gap-4 items-start bg-white border border-outline-variant p-6 rounded-[24px] relative z-10 shadow-sm hover:scale-[1.02] hover:shadow-md transition-all duration-300">
            <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center font-black text-lg shadow-md flex-shrink-0">
              1
            </div>
            <div className="flex flex-col text-left">
              <h4 className="font-bold text-texte text-base">Créez votre commerce</h4>
              <p className="text-xs text-texte-2 leading-relaxed mt-1">
                Renseignez le nom de votre boutique et créez votre compte gérant/caissier en 30 secondes.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="reveal transition-all duration-1000 ease-out transform  delay-225 flex gap-4 items-start bg-white border border-outline-variant p-6 rounded-[24px] relative z-10 shadow-sm hover:scale-[1.02] hover:shadow-md transition-all duration-300">
            <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center font-black text-lg shadow-md flex-shrink-0">
              2
            </div>
            <div className="flex flex-col text-left">
              <h4 className="font-bold text-texte text-base">Ajoutez vos stocks</h4>
              <p className="text-xs text-texte-2 leading-relaxed mt-1">
                Configurez vos prix et vos quantités initiales. L'application détecte automatiquement le bon emoji selon le produit.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="reveal transition-all duration-1000 ease-out transform  delay-300 flex gap-4 items-start bg-white border border-outline-variant p-6 rounded-[24px] relative z-10 shadow-sm hover:scale-[1.02] hover:shadow-md transition-all duration-300">
            <div className="w-12 h-12 rounded-2xl bg-secondary text-white flex items-center justify-center font-black text-lg shadow-md flex-shrink-0">
              3
            </div>
            <div className="flex flex-col text-left">
              <h4 className="font-bold text-texte text-base">Encaissez vos clients</h4>
              <p className="text-xs text-texte-2 leading-relaxed mt-1">
                Ajoutez les articles au panier, encaissez par cash ou enregistrez un crédit client. Tout s'actualise instantanément.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Simulator Section (Live interaction demo) */}
      <section id="demo" className="py-20 px-4 max-w-5xl mx-auto border-t border-outline-variant relative">
        <div className="reveal transition-all duration-1000 ease-out transform  delay-75 text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-black text-primary mb-3">Démo interactive en un clic</h2>
          <p className="text-sm text-texte-2">Interagissez avec le simulateur Sama Boutik ci-dessous pour tester l'interface.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Controls list (Left side on large screen) */}
          <div className="reveal transition-all duration-1000 ease-out transform  delay-150 lg:col-span-4 flex flex-col gap-3">
            {[
              { id: 'caisse', label: 'Caisse de Vente', icon: 'point_of_sale', desc: 'Ajout de produits et encaissement rapide.' },
              { id: 'stock', label: 'Gestion des Stocks', icon: 'inventory_2', desc: 'Suivi de l\'inventaire et alertes bas stock.' },
              { id: 'ardoise', label: 'Crédits Clients', icon: 'book', desc: 'Gestion des crédits et des dettes clients.' },
              { id: 'dashboard', label: 'Analyses', icon: 'monitoring', desc: 'Aperçu des performances de la boutique.' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSimTab(tab.id as any)}
                className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer hover:scale-[1.01] hover:shadow-sm duration-200 ${
                  activeSimTab === tab.id
                    ? 'bg-white border-primary shadow-md text-primary'
                    : 'bg-transparent border-outline-variant text-texte-2 hover:border-outline hover:text-texte'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`material-symbols-outlined ${activeSimTab === tab.id ? 'text-primary' : 'text-[#9CA3AF]'}`}>{tab.icon}</span>
                  <div>
                    <h4 className="font-bold text-xs">{tab.label}</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{tab.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Device Mockup containing interactive simulated screens (Right side) */}
          <div className="reveal transition-all duration-1000 ease-out transform  delay-225 lg:col-span-8 flex justify-center">
            <div className="w-full max-w-[340px] aspect-[9/18.5] bg-slate-950 rounded-[44px] border-[10px] border-slate-900 shadow-2xl relative overflow-hidden flex flex-col ring-1 ring-slate-800 hover:scale-[1.01] transition-transform duration-300">
              
              {/* Phone Speaker & Camera Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-900 rounded-b-2xl z-40 flex items-center justify-center">
                <div className="w-12 h-1 bg-slate-950 rounded-full mb-1" />
              </div>

              {/* simulated OS Header */}
              <div className="bg-slate-900 text-slate-300 pt-8 pb-3 px-4 flex justify-between items-center border-b border-slate-800/50 text-[10px] font-bold">
                <span>Sama Boutik Demo</span>
                <span className="text-secondary flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" /> En ligne
                </span>
              </div>

              {/* Simulated Screens Content Area */}
              <div className="flex-1 bg-[#F5F7FA] p-3 overflow-y-auto text-left text-xs select-none">
                
                {/* 1. CAISSE SIMULATOR */}
                {activeSimTab === 'caisse' && (
                  <div className="flex flex-col gap-3 h-full justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Panier Courant</span>
                        <span className="text-[9px] font-black text-primary uppercase tracking-wider">2 Articles</span>
                      </div>
                      
                      <div className="flex flex-col gap-1.5">
                        {simCart.map(item => (
                          <div key={item.id} className="flex justify-between items-center bg-white border border-outline-variant p-2 rounded-xl">
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-texte text-[11px] truncate">{item.nom}</p>
                              <p className="text-[9px] text-[#9CA3AF]">{item.prix} FCFA x {item.qty}</p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button 
                                onClick={() => {
                                  setSimCart(simCart.map(i => i.id === item.id ? { ...i, qty: Math.max(1, i.qty - 1) } : i));
                                }}
                                className="w-5 h-5 bg-surface-container hover:bg-outline-variant active:scale-90 rounded flex items-center justify-center font-bold text-texte"
                              >
                                -
                              </button>
                              <span className="text-[11px] font-bold w-3 text-center">{item.qty}</span>
                              <button 
                                onClick={() => {
                                  setSimCart(simCart.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i));
                                }}
                                className="w-5 h-5 bg-surface-container hover:bg-outline-variant active:scale-90 rounded flex items-center justify-center font-bold text-texte"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-outline-variant pt-3">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-texte-2 font-bold text-[11px]">Total Panier</span>
                        <span className="text-primary font-black text-sm">{simTotal} FCFA</span>
                      </div>
                      <button
                        onClick={() => {
                          setToast({ message: `Simulé : Vente encaissée pour un montant total de ${simTotal} FCFA !`, type: 'success' });
                          setSimCart([
                            { id: '1', nom: 'Huile de Palme', prix: 2500, qty: 1 },
                            { id: '2', nom: 'Riz Long Grain 5kg', prix: 6750, qty: 1 }
                          ]);
                        }}
                        className="w-full h-9 bg-primary hover:bg-primary/95 font-black text-[10px] text-white rounded-xl uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center cursor-pointer"
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
                    
                    <div className="bg-tertiary-container/30 border border-tertiary-container p-2.5 rounded-xl flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h5 className="font-bold text-[11px] text-tertiary">Sucre en Poudre</h5>
                        <p className="text-[9px] text-[#E69200]/80">Rupture imminente : 1 restant</p>
                      </div>
                      <button
                        onClick={() => setToast({ message: "Simulé : 10 unités de Sucre en Poudre ajoutées !", type: 'success' })}
                        className="px-2 h-6 bg-tertiary text-white hover:bg-tertiary/90 text-[10px] font-black rounded-lg active:scale-90 transition-all cursor-pointer"
                      >
                        RÉAPPRO (+10)
                      </button>
                    </div>

                    <div className="bg-white border border-outline-variant p-2.5 rounded-xl flex justify-between items-center mt-2">
                      <div>
                        <h5 className="font-bold text-[11px] text-texte">Riz Long Grain 5kg</h5>
                        <p className="text-[9px] text-[#9CA3AF]">En stock : 15 sacs</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-secondary-container text-secondary text-[8px] font-bold uppercase">OK</span>
                    </div>

                    <div className="bg-white border border-outline-variant p-2.5 rounded-xl flex justify-between items-center">
                      <div>
                        <h5 className="font-bold text-[11px] text-texte">Lait Concentré</h5>
                        <p className="text-[9px] text-[#9CA3AF]">En stock : 48 boites</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-secondary-container text-secondary text-[8px] font-bold uppercase">OK</span>
                    </div>
                  </div>
                )}

                {/* 3. ARDOISE SIMULATOR */}
                {activeSimTab === 'ardoise' && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Crédits en cours</span>

                    <div className="bg-white border border-outline-variant p-2.5 rounded-xl flex justify-between items-center">
                      <div>
                        <h5 className="font-bold text-[11px] text-texte">Mamadou Diallo</h5>
                        <p className="text-[9px] text-[#9CA3AF]">Mis à jour il y a 2h</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-error text-[11px]">12 500 FCFA</p>
                        <button 
                          onClick={() => setToast({ message: "Simulé : Remboursement de 5 000 FCFA reçu de Mamadou Diallo", type: 'success' })}
                          className="text-[9px] text-primary font-bold hover:underline cursor-pointer"
                        >
                          Régler
                        </button>
                      </div>
                    </div>

                    <div className="bg-white border border-outline-variant p-2.5 rounded-xl flex justify-between items-center">
                      <div>
                        <h5 className="font-bold text-[11px] text-texte">Fatou Sow</h5>
                        <p className="text-[9px] text-[#9CA3AF]">Mis à jour hier</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-error text-[11px]">8 000 FCFA</p>
                        <button 
                          onClick={() => setToast({ message: "Simulé : Remboursement de 8 000 FCFA reçu de Fatou Sow", type: 'success' })}
                          className="text-[9px] text-primary font-bold hover:underline cursor-pointer"
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
                      <div className="bg-white p-2 border border-outline-variant rounded-xl text-center">
                        <span className="text-[8px] font-bold text-[#9CA3AF] uppercase">Chiffre d'Affaires</span>
                        <p className="font-bold text-secondary text-[11px] mt-0.5">145 000 F</p>
                      </div>
                      <div className="bg-white p-2 border border-outline-variant rounded-xl text-center">
                        <span className="text-[8px] font-bold text-[#9CA3AF] uppercase">Bénéfice Estimé</span>
                        <p className="font-bold text-primary text-[11px] mt-0.5">28 900 F</p>
                      </div>
                    </div>

                    <div className="bg-white border border-outline-variant p-2.5 rounded-xl">
                      <span className="text-[8px] font-bold text-texte uppercase tracking-wider block mb-2">Ventes Populaires</span>
                      <div className="flex justify-between items-center text-[10px] text-texte-2 border-b border-outline-variant pb-1">
                        <span>1. Huile de Palme</span>
                        <span className="font-bold">12 ventes</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-texte-2 pt-1">
                        <span>2. Riz Long Grain</span>
                        <span className="font-bold">9 ventes</span>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Bottom Nav Mockup */}
              <div className="bg-slate-900 border-t border-slate-800/80 py-2.5 px-4 flex justify-between items-center text-slate-500 text-[9px] font-bold">
                <div 
                  onClick={() => setActiveSimTab('caisse')}
                  className={`flex flex-col items-center gap-0.5 cursor-pointer transition-all hover:text-slate-300 ${activeSimTab === 'caisse' ? 'text-emerald-400' : ''}`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>point_of_sale</span>
                  <span>Caisse</span>
                </div>
                <div 
                  onClick={() => setActiveSimTab('stock')}
                  className={`flex flex-col items-center gap-0.5 cursor-pointer transition-all hover:text-slate-300 ${activeSimTab === 'stock' ? 'text-emerald-400' : ''}`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>inventory_2</span>
                  <span>Stock</span>
                </div>
                <div 
                  onClick={() => setActiveSimTab('ardoise')}
                  className={`flex flex-col items-center gap-0.5 cursor-pointer transition-all hover:text-slate-300 ${activeSimTab === 'ardoise' ? 'text-emerald-400' : ''}`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>book</span>
                  <span>Crédits</span>
                </div>
                <div 
                  onClick={() => setActiveSimTab('dashboard')}
                  className={`flex flex-col items-center gap-0.5 cursor-pointer transition-all hover:text-slate-300 ${activeSimTab === 'dashboard' ? 'text-emerald-400' : ''}`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>monitoring</span>
                  <span>Analyses</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security and Offline first section */}
      <section id="security" className="py-24 px-4 max-w-5xl mx-auto border-t border-outline-variant text-center">
        <div className="reveal transition-all duration-1000 ease-out transform  delay-75 max-w-2xl mx-auto flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-secondary-container flex items-center justify-center text-secondary mb-2 hover:scale-110 transition-transform duration-300">
            <span className="material-symbols-outlined text-2xl">offline_bolt</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-primary">Technologie Locale Sécurisée</h2>
          <p className="text-sm text-texte-2 leading-relaxed">
            Grâce à l'utilisation d'une base de données locale synchronisée (Dexie), Sama Boutik fonctionne à 100% même en cas de coupure Internet. Vos données de ventes et de stocks restent disponibles et s'actualisent en arrière-plan dès la reconnexion.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-outline-variant bg-[#F5F7FA] text-center text-xs text-texte-2">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
            </div>
            <span className="font-extrabold text-primary">Sama Boutik</span>
          </div>
          <p>© 2026 Sama Boutik. Le système d'exploitation de votre boutique.</p>
        </div>
      </footer>

      {/* Auth / Login Modal Wrapper */}
      {showLoginModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-[#030712]/50 backdrop-blur-md animate-fade-in">
          {/* Modal Container */}
          <div className="relative w-full max-w-md bg-white border border-outline-variant rounded-[28px] overflow-hidden shadow-2xl p-6">
            
            {/* Close Button */}
            <button 
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            {/* Injected Login Component */}
            <div className="pt-2 text-[#1A1A2E]">
              <Login isModal={true} />
            </div>
          </div>
        </div>
      )}
      
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  );
};
