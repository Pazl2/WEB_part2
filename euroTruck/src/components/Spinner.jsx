export default function Spinner({ label = 'Загрузка...' }) {
  return (
    <div className="spinner-box" role="status">
      <div className="spinner" />
      <span>{label}</span>
    </div>
  );
}
