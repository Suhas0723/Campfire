import { useEffect, useState } from "react";
import { Link, Route, Routes } from "react-router-dom";

import { getTrips } from "./api.js";
import Player from "./Player.jsx";

function formatWhen(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Home() {
  const [trips, setTrips] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getTrips()
      .then(setTrips)
      .catch(() => setError("The story list isn't reachable right now."));
  }, []);

  return (
    <main className="shell">
      <header className="mast">
        <p className="mark">Campfire</p>
        <h1>Around the Campfire</h1>
        <p className="lede">
          A trip, told back to the group that already lived it — from the chat they were sending anyway.
        </p>
      </header>

      {error && <p className="banner">{error}</p>}

      {trips && trips.length === 0 && (
        <section className="empty">
          <h2>No stories yet</h2>
          <p>In the WhatsApp group, send <code>/campfire start</code>. When the trip ends, it shows up here.</p>
        </section>
      )}

      {trips && trips.length > 0 && (
        <ul className="trip-list">
          {trips.map((trip) => (
            <li key={trip.id}>
              <Link to={`/play/${trip.id}`}>
                <span>
                  <strong>{trip.name}</strong>
                  <em>{trip.group_name}</em>
                </span>
                <span className="when">
                  {formatWhen(trip.started_at)}
                  <i>{trip.status}</i>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/play/:tripId" element={<Player />} />
    </Routes>
  );
}
