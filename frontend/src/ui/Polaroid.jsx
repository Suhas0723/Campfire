export default function Polaroid({ label, by, tilt = 0, src }) {
  return (
    <figure className="polaroid" style={{ '--tilt': `${tilt}deg` }}>
      <div className={`polaroid-photo${src ? ' has-photo' : ''}`}>
        {src ? <img src={src} alt={label || 'Trip photo'} /> : <span className="polaroid-placeholder">Photo</span>}
        {!src && <span className="polaroid-label">{label}</span>}
      </div>
      <figcaption>by {by}</figcaption>
    </figure>
  );
}
