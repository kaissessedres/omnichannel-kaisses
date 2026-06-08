// Indicador de carregamento centralizado (ocupa o espaço disponível).
export default function Spinner({ label }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-slate-400">
      <span className="loading loading-spinner loading-lg text-primary" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
