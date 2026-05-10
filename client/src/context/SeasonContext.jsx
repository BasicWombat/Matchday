import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';

const SeasonContext = createContext(null);

export function SeasonProvider({ children }) {
  const [seasons,  setSeasons]  = useState([]);
  const [selectedId, setSelectedIdRaw] = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    api.getSeasons()
      .then(data => {
        setSeasons(data);
        const stored  = Number(localStorage.getItem('matchday_season_id'));
        const active  = data.find(s => s.is_active);
        const valid   = stored && data.find(s => s.id === stored);
        setSelectedIdRaw(valid ? stored : (active?.id ?? data[0]?.id ?? null));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function setSelectedSeasonId(id) {
    setSelectedIdRaw(id);
    localStorage.setItem('matchday_season_id', String(id));
  }

  function refreshSeasons() {
    return api.getSeasons().then(data => { setSeasons(data); return data; });
  }

  const selectedSeason    = seasons.find(s => s.id === selectedId) ?? null;
  const activeSeason      = seasons.find(s => s.is_active) ?? null;
  const isViewingNonActive = !!(selectedSeason && activeSeason && selectedSeason.id !== activeSeason.id);

  return (
    <SeasonContext.Provider value={{
      seasons,
      selectedSeason,
      selectedSeasonId: selectedId,
      setSelectedSeasonId,
      activeSeason,
      isViewingNonActive,
      loading,
      refreshSeasons,
    }}>
      {children}
    </SeasonContext.Provider>
  );
}

export function useSeason() {
  const ctx = useContext(SeasonContext);
  if (!ctx) throw new Error('useSeason must be used within SeasonProvider');
  return ctx;
}
