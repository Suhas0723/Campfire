import { useCallback, useEffect, useRef, useState } from 'react';
import { Route, Routes, useMatch, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider.jsx';
import RequireAuth from './auth/RequireAuth.jsx';
import LoginScreen from './auth/LoginScreen.jsx';
import './auth/auth.css';
import Scene from './scene/Scene.jsx';
import TopBar from './ui/TopBar.jsx';
import Desktop from './ui/Desktop.jsx';
import Window from './ui/Window.jsx';
import DesertTrip from './windows/DesertTrip.jsx';
import StoryPlayer from './windows/StoryPlayer.jsx';
import NextFire from './windows/NextFire.jsx';
import { NightlyRecaps, OffTheRecord, Settings, SideQuests, StartTrip } from './windows/Extras.jsx';
import { KYOTO_TRIP } from './scenes/kyoto/index.js';
import { useMyTrips, usePlayback } from './auth/useMyTrips.js';
import { endNight } from './auth/authApi.js';
import YourFires from './auth/YourFires.jsx';
import useIsMobile from './ui/useIsMobile.js';

const fromRight = (w, y) => () => ({ x: Math.max(130, window.innerWidth - w - 130), y });
const centered = (w, y) => () => ({ x: Math.max(120, Math.round((window.innerWidth - w) / 2)), y });

// Extras built on the Desert trip's sample content; only its crew sees them.
const DESERT_ONLY = new Set(['nightly', 'quests', 'offrecord']);

const JAPAN_PLACE = /\b(japan|tokyo|kyoto|hiroshima|osaka|nara|fuji|hakone|kobe)\b/i;

function usesJapanScene(trip, playback) {
  if (!trip && !playback) return false;
  if (trip?.slug === KYOTO_TRIP.id || trip?.scene_key === 'kyoto' || playback?.trip?.id === 'kyoto' || playback?.trip?.scene_key === 'kyoto') {
    return true;
  }
  const place = playback?.trip?.location?.name || playback?.trip?.place || '';
  const stops = (playback?.locations || []).map((stop) => stop.name).join(' ');
  const text = [trip?.title, trip?.name, trip?.location_name, playback?.trip?.name, place, stops].filter(Boolean).join(' ');
  return JAPAN_PLACE.test(text);
}

const WINDOWS = {
  fires: { title: 'Your fires', width: 640, pos: centered(640, 84), Body: YourFires },
  trip: { title: 'Desert trip', width: 560, pos: { x: 128, y: 78 }, Body: DesertTrip },
  kyoto: { title: KYOTO_TRIP.title, width: 560, pos: { x: 168, y: 98 }, Body: KYOTO_TRIP.Body },
  nightly: { title: 'Nightly recaps', width: 460, pos: { x: 190, y: 120 }, Body: NightlyRecaps },
  quests: { title: 'Side quests', width: 440, pos: { x: 230, y: 160 }, Body: SideQuests },
  next: { title: 'Next fire', width: 520, pos: fromRight(520, 96), Body: NextFire },
  settings: { title: 'Settings', width: 420, pos: fromRight(420, 90), Body: Settings },
  offrecord: { title: 'Off the record', width: 400, pos: fromRight(400, 170), Body: OffTheRecord },
  start: { title: 'Start a trip', width: 440, pos: fromRight(440, 110), Body: StartTrip },
};

const initialPos = (id) => {
  const { pos } = WINDOWS[id];
  return typeof pos === 'function' ? pos() : pos;
};

export default function App() {
  return (
    <AuthProvider>
      <Stage />
    </AuthProvider>
  );
}

function Stage() {
  const { flaring } = useAuth();
  return (
    <>
      <div className={`scene-wrap${flaring ? ' fire-flare' : ''}`}>
        <Scene />
      </div>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route
          path="*"
          element={
            <RequireAuth>
              <Workspace />
            </RequireAuth>
          }
        />
      </Routes>
      <div className="grain" />
    </>
  );
}

function Workspace() {
  const navigate = useNavigate();
  const { status: tripsStatus, trips } = useMyTrips();
  const resolving = tripsStatus === 'loading';
  const desert = trips.find((t) => t.slug === 'desert');
  const kyoto = trips.find((t) => t.slug === KYOTO_TRIP.id);
  const homeTrip = desert || trips.find((t) => t.story_ready);

  const playMatch = useMatch('/play/:tripId');
  const playingId = playMatch?.params.tripId;
  const playing = playingId ? trips.find((t) => t.slug === playingId || t.id === playingId) : undefined;
  const playerWindow = playing?.slug === KYOTO_TRIP.id ? 'kyoto' : 'trip';
  const playData = usePlayback(!playingId ? null : resolving ? undefined : (playing?.id ?? null));
  const tripData = usePlayback(resolving ? undefined : (homeTrip?.id ?? null));
  const tripName = tripData.status === 'ready' ? tripData.trip.name : WINDOWS.trip.title;

  const canOpen = useCallback(
    (id) => {
      if (id === 'trip' || DESERT_ONLY.has(id)) return Boolean(desert);
      if (id === 'kyoto') return Boolean(kyoto);
      return Boolean(WINDOWS[id]);
    },
    [desert, kyoto],
  );

  const [open, setOpen] = useState([{ id: 'fires', pos: initialPos('fires') }]);
  const { mobile } = useIsMobile();
  const japanScene = usesJapanScene(playing, playData.status === 'ready' ? playData : null);

  const focus = useCallback(
    (id) => setOpen((ws) => (ws[ws.length - 1]?.id === id ? ws : [...ws.filter((w) => w.id !== id), ws.find((w) => w.id === id)])),
    [],
  );

  const openWindow = useCallback((id) => {
    if (!WINDOWS[id]) return;
    setOpen((ws) => {
      const existing = ws.find((w) => w.id === id);
      if (existing) return [...ws.filter((w) => w.id !== id), existing];
      return [...ws, { id, pos: initialPos(id) }];
    });
  }, []);

  const openFromUi = useCallback((id) => canOpen(id) && openWindow(id), [canOpen, openWindow]);

  const leftPlayer = useRef(false);

  useEffect(() => {
    if (!playingId) leftPlayer.current = false;
    else if (!resolving && !leftPlayer.current) openWindow(playerWindow);
  }, [playingId, resolving, playerWindow, openWindow]);

  const exitPlayer = useCallback(() => {
    leftPlayer.current = true;
    if (mobile) {
      setOpen((ws) => {
        const rest = ws.filter((w) => w.id !== playerWindow && w.id !== 'fires');
        const fires = ws.find((w) => w.id === 'fires') || { id: 'fires', pos: initialPos('fires') };
        return [...rest, fires];
      });
    } else if (playerWindow === 'trip' && playing !== desert) {
      setOpen((ws) => ws.filter((w) => w.id !== 'trip'));
    }
    navigate('/');
  }, [navigate, playerWindow, playing, desert, mobile]);

  const close = useCallback(
    (id) => {
      setOpen((ws) => ws.filter((w) => w.id !== id));
      if (id === playerWindow && playingId) exitPlayer();
    },
    [playingId, playerWindow, exitPlayer],
  );

  const move = useCallback((id, pos) => setOpen((ws) => ws.map((w) => (w.id === id ? { ...w, pos } : w))), []);

  const playTrip = useCallback((trip) => navigate(`/play/${trip.slug || trip.id}`), [navigate]);

  const play = useCallback(() => {
    if (desert) playTrip(desert);
  }, [desert, playTrip]);

  const activeTrip = trips.find((trip) => trip.status === 'active');
  const [endingNight, setEndingNight] = useState(false);
  const [nightNote, setNightNote] = useState('');

  const endTheNight = useCallback(async () => {
    if (!activeTrip || endingNight) return;
    setEndingNight(true);
    setNightNote('');
    try {
      const result = await endNight(activeTrip.id);
      if (result.status === 'already_done') setNightNote('Tonight’s recap is already in the chat.');
      else if (result.status === 'in_progress') setNightNote('Tonight’s recap is already running.');
      else setNightNote('Recap and tomorrow ideas are on the way in WhatsApp.');
    } catch (error) {
      if (error.code === 'no_messages') setNightNote('Nothing captured today yet.');
      else setNightNote('Couldn’t end the night. Try again.');
    } finally {
      setEndingNight(false);
    }
  }, [activeTrip, endingNight]);

  if (mobile && playingId) {
    return (
      <div className="m-play-root">
        <StoryPlayer data={playData} onExit={exitPlayer} {...(japanScene ? { MapView: KYOTO_TRIP.MapView } : {})} />
      </div>
    );
  }

  return (
    <>
      <TopBar
        onOpen={openFromUi}
        canOpen={canOpen}
        onEndNight={activeTrip ? endTheNight : null}
        endingNight={endingNight}
        nightNote={nightNote}
      />
      <Desktop openIds={open.map((w) => w.id)} onOpen={openFromUi} labels={{ trip: tripName }} canOpen={canOpen} />
      {open.map((w, i) => {
        const cfg = WINDOWS[w.id];
        const full = w.id === playerWindow && Boolean(playingId);
        if (!full && !canOpen(w.id)) return null;
        const title = full ? (playing?.title ?? 'Campfire') : w.id === 'trip' ? tripName : cfg.title;
        const { Body } = cfg;
        return (
          <Window
            key={full ? `${w.id}-full` : w.id}
            id={w.id}
            title={full ? `${title} · Sit around the campfire` : title}
            width={cfg.width}
            pos={w.pos}
            z={full ? 40 : 10 + i}
            full={full}
            onMove={move}
            onFocus={focus}
            onClose={close}
          >
            {full ? (
              <StoryPlayer data={playData} onExit={exitPlayer} {...(japanScene ? { MapView: KYOTO_TRIP.MapView } : {})} />
            ) : (
              <Body data={tripData} onOpen={openFromUi} onPlay={play} trips={trips} tripsStatus={tripsStatus} onPlayTrip={playTrip} />
            )}
          </Window>
        );
      })}
    </>
  );
}
