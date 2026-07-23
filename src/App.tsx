// Root component: wires backend event listeners and composes the pet canvas,
// settings panel, and toast host. The root container is `pointer-events: none`
// so transparent window margins pass clicks through; interactive children
// re-enable pointer events.

import { useEffect } from "react";
import PetCanvas from "./pet/PetCanvas";
import ToastHost from "./toast/ToastHost";
import SettingsPanel from "./settings/SettingsPanel";
import { usePetStore } from "./store/usePetStore";
import * as api from "./ipc/api";

export default function App() {
  const settingsOpen = usePetStore((s) => s.settingsOpen);
  const setVisible = usePetStore((s) => s.setVisible);
  const openSettings = usePetStore((s) => s.openSettings);
  const addToast = usePetStore((s) => s.addToast);
  const setLoaded = usePetStore((s) => s.setLoaded);
  const setConfig = usePetStore((s) => s.setConfig);

  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    (async () => {
      try {
        const cfg = await api.configLoad();
        setConfig(cfg);
      } catch (e) {
        console.error("config_load failed", e);
      }
      setLoaded(true);

      unlisteners.push(
        await api.onReminderTrigger((p) =>
          addToast({ id: `t_${Date.now()}_${p.id}`, message: p.message, withSound: p.withSound }),
        ),
      );
      unlisteners.push(await api.onVisibilityChanged((p) => setVisible(p.visible)));
      unlisteners.push(await api.onOpenSettings(() => openSettings()));
      unlisteners.push(await api.onOpenAbout(() => openSettings()));
      unlisteners.push(await api.onTrayToggle(() => undefined));
    })();

    return () => {
      unlisteners.forEach((u) => u());
    };
  }, [setVisible, openSettings, addToast, setLoaded, setConfig]);

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <PetCanvas />
      <ToastHost />
      {settingsOpen && <SettingsPanel />}
    </div>
  );
}
