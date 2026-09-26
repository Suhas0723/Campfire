import { useEffect, useRef } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";

const containerStyle = { width: "100%", height: "100%" };

export default function MapStage({ apiKey, location }) {
  const mapRef = useRef(null);
  const { isLoaded, loadError } = useJsApiLoader({
    id: "campfire-map",
    googleMapsApiKey: apiKey,
  });

  useEffect(() => {
    if (!mapRef.current || !location) return;
    mapRef.current.panTo({ lat: location.lat, lng: location.lng });
  }, [location]);

  if (loadError || !isLoaded) {
    return (
      <div className="map-fallback">
        <p>{location?.name || "Map"}</p>
      </div>
    );
  }

  const center = location
    ? { lat: location.lat, lng: location.lng }
    : { lat: 37.8651, lng: -119.5383 };

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={location ? 12 : 9}
      onLoad={(map) => {
        mapRef.current = map;
      }}
      options={{ disableDefaultUI: true, zoomControl: true, clickableIcons: false }}
    >
      {location && <Marker position={center} title={location.name} />}
    </GoogleMap>
  );
}
