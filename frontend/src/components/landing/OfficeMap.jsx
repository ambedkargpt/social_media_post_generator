import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icons broken by Vite asset bundling
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const OFFICE = [51.5145, -0.1227];

/**
 * The office map, in its own module so Leaflet is a separate chunk.
 *
 * It sits at the bottom of the landing page, and importing it from
 * ContactSection put 43 kB of gzipped JavaScript and its stylesheet on the
 * critical path for a map most visitors never scroll to.
 */
export default function OfficeMap() {
  return (
    <MapContainer
      center={OFFICE}
      zoom={15}
      scrollWheelZoom={false}
      zoomControl={false}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={OFFICE}>
        <Popup>AmbedkarGPT<br />71-75 Shelton Street, Covent Garden, London (WC2H 9JQ)</Popup>
      </Marker>
    </MapContainer>
  );
}
