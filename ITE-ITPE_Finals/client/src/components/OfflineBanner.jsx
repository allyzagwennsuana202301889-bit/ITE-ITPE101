export default function OfflineBanner({ isOnline }) {
  if (isOnline) return null;
  return (
    <div className="offline-banner" role="status">
      <span aria-hidden="true">⚠</span>
      <span>You're offline. Cart viewing is available; reconnect for account and checkout actions.</span>
    </div>
  );
}
