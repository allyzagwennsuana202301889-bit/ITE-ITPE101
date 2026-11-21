export default function BottomNav({ activePage, user, onNavigate, onAccount }) {
  const items = [
    { id: "shop", label: "Home", icon: "⌂", action: () => onNavigate("shop", "home") },
    { id: "catalog", label: "Shop", icon: "▦", action: () => onNavigate("shop", "shop") },
    { id: "kit", label: "Art Kit", icon: "✎", action: () => onNavigate("kit", "art-kit-builder") },
    { id: "compatibility", label: "Devices", icon: "▤", action: () => onNavigate("compatibility", "compatibility") },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          className={activePage === item.id || (item.id === "shop" && activePage === "shop") ? "mobile-nav-item active" : "mobile-nav-item"}
          onClick={item.action}
          aria-label={item.label}
        >
          <span className="mobile-nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
      <button type="button" className="mobile-nav-item" onClick={onAccount} aria-label="Account">
        <span className="mobile-nav-icon">♙</span>
        <span>{user ? "Account" : "Log in"}</span>
      </button>
    </nav>
  );
}
