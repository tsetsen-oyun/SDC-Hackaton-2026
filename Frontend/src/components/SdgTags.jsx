// small honesty tags that go next to an SDG link
export default function SdgTags({ s }) {
  return (
    <>
      {s.malaysia_off_track && <span className="sdg-tag off">Malaysia off track</span>}
      {s.is_estimate && <span className="badge-est">Estimate</span>}
      {s.reviewed == null && <span className="sdg-tag">not yet checked</span>}
    </>
  );
}