import { useState } from 'react';
import data from '../mock/trip.json';
import { blob, roughPoly, c } from '../scene/shape.js';
import { CompassIcon, PinIcon } from '../ui/icons.jsx';

const { nextFire, trip } = data;
const OUT = { stroke: c('bark-dark'), strokeLinejoin: 'round', strokeLinecap: 'round' };

function Postcard() {
  return (
    <svg className="postcard-art" viewBox="0 0 320 150" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <rect width="320" height="150" style={{ fill: c('sky-bottom') }} />
      <rect width="320" height="60" style={{ fill: c('sky-top'), opacity: 0.6 }} />
      <circle cx="230" cy="84" r="26" style={{ fill: c('fire-yellow'), ...OUT }} strokeWidth={1.5} strokeOpacity={0.4} />
      <path d={roughPoly([[-10, 110], [40, 70], [80, 88], [130, 52], [190, 96], [240, 76], [330, 104], [330, 150], [-10, 150]], { seed: 7, jitter: 1.2, step: 20 })} style={{ fill: c('wood-light'), ...OUT }} strokeWidth={2} />
      <path d={roughPoly([[-10, 124], [70, 108], [150, 122], [230, 110], [330, 120], [330, 150], [-10, 150]], { seed: 8, jitter: 1, step: 20 })} style={{ fill: c('wood'), ...OUT }} strokeWidth={2} />
      {/* ocotillo */}
      <g transform="translate(60 132)" style={{ ...OUT, fill: 'none', stroke: c('bark') }} strokeWidth={2.5}>
        <path d="M0,0 C-6,-20 -12,-34 -16,-46 M0,0 C0,-22 2,-38 2,-54 M0,0 C6,-18 12,-32 18,-44" />
      </g>
      {[[-16, -46], [2, -54], [18, -44]].map(([x, y], i) => (
        <path key={i} d={blob(60 + x, 132 + y, 3, 5, { seed: i + 2, points: 6 })} style={{ fill: c('fire-red'), ...OUT }} strokeWidth={1.2} />
      ))}
      {[[110, 138], [124, 142], [150, 136], [200, 140], [214, 134], [262, 140], [280, 136]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.2" style={{ fill: c(i % 2 ? 'fire-yellow' : 'ember'), ...OUT }} strokeWidth={1.2} />
      ))}
      <path d="M284,24 l2,5 l5,2 l-5,2 l-2,5 l-2,-5 l-5,-2 l5,-2Z" style={{ fill: c('cream') }} />
      <path d="M40,20 l1.5,3.5 l3.5,1.5 l-3.5,1.5 l-1.5,3.5 l-1.5,-3.5 l-3.5,-1.5 l3.5,-1.5Z" style={{ fill: c('cream') }} />
    </svg>
  );
}

export default function NextFire() {
  const [sent, setSent] = useState(false);
  const options = [nextFire.place, ...nextFire.alternatives];

  return (
    <div className="nextfire">
      <p className="eyebrow">Where the next fire should be</p>

      <article className="suggestion">
        <div className="postcard">
          <Postcard />
          <span className="postcard-stamp">
            <CompassIcon size={34} />
          </span>
        </div>
        <div className="suggestion-body">
          <h2 className="suggestion-title">{nextFire.headline}</h2>
          <div className="chip-row">
            <span className="chip">
              <PinIcon size={14} /> {nextFire.drive}
            </span>
            <span className="chip">{nextFire.when}</span>
            <span className="chip">Free parking</span>
          </div>

          <h3 className="reasons-title">Pulled from your chat</h3>
          <ul className="reasons">
            {nextFire.reasons.map((r) => (
              <li key={r.who}>
                <span className="reason-who">{r.who}</span>
                <q>{r.quote}</q>
              </li>
            ))}
          </ul>
        </div>
      </article>

      {sent ? (
        <div className="poll-sent" role="status">
          <p className="poll-sent-head">
            Poll sent to the <strong>{trip.title}</strong> chat
          </p>
          <ul className="poll-preview">
            {options.map((o, i) => (
              <li key={o}>
                <span className="poll-box" />
                {o}
                {i === 0 && <span className="poll-pick">Campfire's pick</span>}
              </li>
            ))}
          </ul>
          <button className="text-button" onClick={() => setSent(false)}>
            Undo
          </button>
        </div>
      ) : (
        <div className="nextfire-actions">
          <button className="btn-primary lg" onClick={() => setSent(true)}>
            Send to the group as a poll
          </button>
          <span className="nextfire-hint">Also in the poll: {nextFire.alternatives.join(', ')}</span>
        </div>
      )}
    </div>
  );
}
