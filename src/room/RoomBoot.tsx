import { useEffect, useState } from 'react';
import { useLongLoad } from '../hooks/useLongLoad';
import { LoaderMark, LoaderWordmark } from '../components/LoadingScreen';
import { DrawnTitle, ErrorIllo } from '../components/illustrations';
import './RoomBoot.css';

/**
 * First-load boot for the room: the brand sketch-in loader (star draw-on +
 * wordmark) with honest long-load copy, and — never a dead end — a calm retry
 * path if the room itself can't be reached within a reasonable window.
 */
export function RoomBoot() {
  const { phrase } = useLongLoad(
    true,
    ['Opening your room…', 'Warming up the canvas…', 'Still syncing…'],
    4000,
  );
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setGaveUp(true), 15000);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="loading-screen room-boot" role="status" aria-label="Opening room">
      <LoaderMark size={62} />
      <LoaderWordmark />
      {gaveUp ? (
        <div className="room-boot-error" role="alert">
          <div aria-hidden="true">
            <ErrorIllo />
          </div>
          <DrawnTitle className="room-boot-error-title" delay={700}>
            Can't reach this room
          </DrawnTitle>
          <p className="room-boot-error-sub">Check your connection and give it another try.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      ) : (
        <p className="loader-label">{phrase}</p>
      )}
    </div>
  );
}
