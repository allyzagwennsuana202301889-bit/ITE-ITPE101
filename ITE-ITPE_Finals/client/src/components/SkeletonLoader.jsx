export default function SkeletonLoader({ count = 4 }) {
  return (
    <div className="product-grid" aria-label="Loading products" role="status">
      {Array.from({ length: count }, (_, index) => (
        <div className="product-card skeleton-card" key={index}>
          <div className="skeleton-block skeleton-image" />
          <div className="skeleton-block skeleton-line" />
          <div className="skeleton-block skeleton-line short" />
          <div className="skeleton-block skeleton-button" />
        </div>
      ))}
    </div>
  );
}
