import { useRegisterSW } from "virtual:pwa-register/react";

export default function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!offlineReady && !needRefresh) return null;

  return (
    <div className="reload-prompt" role="alert">
      <span>
        {offlineReady
          ? "The app is ready to work offline."
          : "A new version is available."}
      </span>
      <div className="reload-prompt-actions">
        {needRefresh && (
          <button type="button" onClick={() => updateServiceWorker(true)}>
            Reload
          </button>
        )}
        <button type="button" onClick={close}>
          Close
        </button>
      </div>
    </div>
  );
}
