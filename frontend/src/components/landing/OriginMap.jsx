import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix default marker icons broken by Vite's asset bundling
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const MHOW = { lat: 22.5565, lng: 75.7610 };

export default function OriginMap() {
  return (
    <section className="py-20 px-6 md:px-14">
      {/* Heading */}
      <div className="mx-auto max-w-[900px] text-center mb-10">
        <span
          className="mb-4 inline-block rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ backgroundColor: 'rgba(63,159,255,0.12)', color: '#3f9fff', border: '1px solid rgba(63,159,255,0.25)' }}
        >
          Our Roots
        </span>
        <h2 className="font-display text-[32px] font-bold leading-snug text-white md:text-[40px]">
          Born from the Land of Dr. B.R. Ambedkar
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed" style={{ color: '#8b94b8' }}>
          AmbedkarGPT draws its spirit from Mhow, Madhya Pradesh, the birthplace of Dr. Bhimrao Ramji Ambedkar,
          the architect of the Indian Constitution and the champion of social justice.
        </p>
      </div>

      {/* Map */}
      <div
        className="mx-auto max-w-[900px] overflow-hidden rounded-2xl shadow-[0_0_60px_rgba(63,159,255,0.12)]"
        style={{ height: 420, border: '1px solid rgba(63,159,255,0.2)' }}
      >
        <MapContainer
          center={[MHOW.lat, MHOW.lng]}
          zoom={13}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[MHOW.lat, MHOW.lng]}>
            <Popup>
              <strong>Birthplace of Dr. B.R. Ambedkar</strong>
              <br />
              Mhow (Dr. Ambedkar Nagar), Madhya Pradesh, India
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      {/* Caption */}
      <p className="mt-4 text-center text-[12px]" style={{ color: '#4e5a80' }}>
        Mhow (officially Dr. Ambedkar Nagar) · Madhya Pradesh, India
      </p>
    </section>
  );
}
