import React, { useState, useEffect } from 'react';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { DetailDrawer } from './DetailDrawer';
import { callRpcWithRetry } from '../../../lib/supabase-rpc';

// Custom icons for leaflet
const activeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const dormantIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export const GeoMap: React.FC = () => {
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedBoutique, setSelectedBoutique] = useState<any>(null);

  useEffect(() => {
    const fetchGeo = async () => {
      setLoading(true);
      try {
        const { data, error } = await callRpcWithRetry('get_boutiques_geo');
        if (error) throw error;
        setGeoData(data);
      } catch (err) {
        console.error('Erreur fetch geo:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchGeo();
  }, []);

  const openBoutique = (b: any) => {
    setSelectedBoutique(b);
    setDrawerOpen(true);
  };

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('fr-SN', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(val || 0);
  };

  if (loading || !geoData) {
    return <div className="h-96 w-full bg-admin-card animate-pulse rounded-xl"></div>;
  }

  // Centered on Dakar
  const defaultCenter: [number, number] = [14.7167, -17.4677];

  return (
    <>
      <div className="bg-admin-card rounded-xl border border-admin-border overflow-hidden flex flex-col">
        <div className="p-5 border-b border-admin-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-admin-surface">
          <h2 className="text-lg font-black tracking-tight text-admin-text">Couverture Géographique (Dakar)</h2>
          <span className="px-3 py-1 bg-admin-primary/10 text-admin-primary border border-admin-primary/20 rounded-lg text-xs font-bold">
            {geoData.boutiques_localisees} boutiques localisées sur {geoData.total_boutiques}
          </span>
        </div>
        
        <div className="h-[500px] w-full relative z-0">
          <MapContainer center={defaultCenter} zoom={13} style={{ height: '100%', width: '100%', zIndex: 0 }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {geoData.boutiques?.map((b: any) => (
              b.latitude && b.longitude && (
                <Marker 
                  key={b.boutique_id} 
                  position={[b.latitude, b.longitude]}
                  icon={b.statut === 'dormante' ? dormantIcon : activeIcon}
                >
                  <Popup>
                    <div className="flex flex-col gap-1 min-w-[150px]">
                      <span className="font-bold text-sm">{b.nom}</span>
                      <span className="text-[10px] text-gray-500">{b.quartier}</span>
                      <div className="mt-2 text-xs">
                        <div>Revenu: <span className="font-bold">{formatMoney(b.revenu_total)}</span></div>
                        <div>Ventes: <span className="font-bold">{b.nb_ventes}</span></div>
                      </div>
                      <button 
                        onClick={() => openBoutique(b)}
                        className="mt-3 w-full py-1.5 bg-[#3b82f6] text-white text-xs font-bold rounded"
                      >
                        Voir détails
                      </button>
                    </div>
                  </Popup>
                </Marker>
              )
            ))}
          </MapContainer>
        </div>
      </div>

      <DetailDrawer
        isOpen={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedBoutique(null); }}
        title={`Boutique: ${selectedBoutique?.nom}`}
        width="md"
      >
        {selectedBoutique && (
          <div className="flex flex-col gap-4">
            <div className="bg-admin-card p-4 rounded-xl border border-admin-border text-sm flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-admin-text-muted">Quartier</span>
              <span className="font-bold text-admin-text">{selectedBoutique.quartier}</span>
            </div>
            
            <div className="bg-admin-card p-4 rounded-xl border border-admin-border text-sm flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-admin-text-muted">Statut</span>
              <span className={`font-bold ${selectedBoutique.statut === 'dormante' ? 'text-slate-400' : 'text-green-500'}`}>
                {selectedBoutique.statut === 'dormante' ? 'Dormante' : 'Active'}
              </span>
            </div>
            
            <div className="bg-admin-card p-4 rounded-xl border border-admin-border text-sm flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-admin-text-muted">Performances globales</span>
              <div className="flex justify-between">
                <span>Revenu Total</span>
                <span className="font-black text-admin-primary">{formatMoney(selectedBoutique.revenu_total)}</span>
              </div>
              <div className="flex justify-between">
                <span>Ventes Totales</span>
                <span className="font-black">{selectedBoutique.nb_ventes}</span>
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>
    </>
  );
};
