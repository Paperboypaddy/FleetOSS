import { useState, useCallback, useRef } from 'react';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import MapPanel from './components/map/MapPanel';
import type { MapPanelHandle } from './components/map/MapPanel';
import TripsPanel from './components/trips/TripsPanel';
import MaintPanel from './components/maint/MaintPanel';
import FuelPanel from './components/fuel/FuelPanel';
import Toast from './components/ui/Toast';
import type { PanelId } from './types';

export default function App() {
  const [activePanel, setActivePanel] = useState<PanelId>('map');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const mapRef = useRef<MapPanelHandle>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  const handleShowTrip = useCallback(async (tripIdx: number) => {
    setActivePanel('map');
    await new Promise(r => setTimeout(r, 100));
    mapRef.current?.showTripOnMap(tripIdx);
  }, []);

  return (
    <div className="shell flex h-screen">
      <Sidebar activePanel={activePanel} onPanelChange={setActivePanel} />
      <div className="main flex flex-col flex-1 overflow-hidden">
        <Topbar activePanel={activePanel} />
        <div className="content flex-1 flex overflow-hidden">
          {activePanel === 'map' && <MapPanel ref={mapRef} />}
          {activePanel === 'trips' && <TripsPanel showToast={showToast} onShowTrip={handleShowTrip} />}
          {activePanel === 'maint' && <MaintPanel showToast={showToast} />}
          {activePanel === 'fuel' && <FuelPanel showToast={showToast} />}
        </div>
      </div>
      <Toast message={toastMsg} onDone={() => setToastMsg(null)} />
    </div>
  );
}
