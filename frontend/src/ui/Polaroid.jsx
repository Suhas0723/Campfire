export default function Polaroid({ label, by, tilt = 0 }) {
  return (
    <figure className="polaroid" style={{ '--tilt': `${tilt}deg` }}>
      <div className="polaroid-photo">
        <span className="polaroid-placeholder">Photo</span>
        <span className="polaroid-label">{label}</span>
      </div>
      <figcaption>by {by}</figcaption>
    </figure>
  );
}
