import { useCallback, useState } from 'react';
import Scene from './scene/Scene.jsx';
import TopBar from './ui/TopBar.jsx';
import Desktop from './ui/Desktop.jsx';
import Window from './ui/Window.jsx';
import DesertTrip from './windows/DesertTrip.jsx';
import StoryPlayer from './windows/StoryPlayer.jsx';
import NextFire from './windows/NextFire.jsx';
import { NightlyRecaps, OffTheRecord, Settings, SideQuests, StartTrip, TalkToCampfire } from './windows/Extras.jsx';

const fromRight = (w, y) => () => ({ x: Math.max(130, window.innerWidth - w - 130), y });

const WINDOWS = {
  trip: { title: 'Desert trip', width: 560, pos: { x: 128, y: 78 }, Body: DesertTrip },
  nightly: { title: 'Nightly recaps', width: 460, pos: { x: 190, y: 120 }, Body: NightlyRecaps },
  quests: { title: 'Side quests', width: 440, pos: { x: 230, y: 160 }, Body: SideQuests },
  next: { title: 'Next fire', width: 520, pos: fromRight(520, 96), Body: NextFire },
  talk: { title: 'Talk to Campfire', width: 420, pos: { x: 270, y: 190 }, Body: TalkToCampfire },
  settings: { title: 'Settings', width: 420, pos: fromRight(420, 90), Body: Settings },
  offrecord: { title: 'Off the record', width: 400, pos: fromRight(400, 170), Body: OffTheRecord },
  start: { title: 'Start a trip', width: 440, pos: fromRight(440, 110), Body: StartTrip },
};

const initialPos = (id) => {
  const { pos } = WINDOWS[id];
  return typeof pos === 'function' ? pos() : pos;
};

export default function App() {
  const [open, setOpen] = useState([{ id: 'trip', pos: initialPos('trip') }]);
  const [playing, setPlaying] = useState(false);

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

  const close = useCallback((id) => {
    setOpen((ws) => ws.filter((w) => w.id !== id));
    if (id === 'trip') setPlaying(false);
  }, []);

  const move = useCallback((id, pos) => setOpen((ws) => ws.map((w) => (w.id === id ? { ...w, pos } : w))), []);

  const play = useCallback(() => {
    openWindow('trip');
    setPlaying(true);
  }, [openWindow]);

  return (
    <>
      <Scene />
      <TopBar onOpen={openWindow} />
      <Desktop openIds={open.map((w) => w.id)} onOpen={openWindow} />
      {open.map((w, i) => {
        const cfg = WINDOWS[w.id];
        const full = w.id === 'trip' && playing;
        const { Body } = cfg;
        return (
          <Window
            key={full ? `${w.id}-full` : w.id}
            id={w.id}
            title={full ? `${cfg.title} · Sit around the campfire` : cfg.title}
            width={cfg.width}
            pos={w.pos}
            z={full ? 40 : 10 + i}
            full={full}
            onMove={move}
            onFocus={focus}
            onClose={close}
          >
            {full ? <StoryPlayer onExit={() => setPlaying(false)} /> : <Body onOpen={openWindow} onPlay={play} />}
          </Window>
        );
      })}
      <div className="grain" />
    </>
  );
}
