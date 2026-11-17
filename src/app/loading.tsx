/**
 * Shown at once while the server fetches the household. The page is server-rendered (#11),
 * so this only appears when the database is slow.
 */
export default function Loading() {
  return (
    <main className="home" aria-busy>
      <header className="topbar">
        <p className="wordmark">
          <span className="wordmark-mark" aria-hidden />
          KordaMööda
        </p>
      </header>
      <p className="visually-hidden" role="status">
        Laadin nimekirja…
      </p>
      <ul className="cards" aria-hidden>
        {[0, 1, 2].map((index) => (
          <li key={index} className="card-slot">
            <div className="card skeleton-card">
              <span className="skeleton skeleton-title" />
              <span className="skeleton skeleton-name" />
              <span className="skeleton skeleton-row" />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
