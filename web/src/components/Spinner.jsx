// Indicador de carregamento centralizado (ocupa o espaço disponível).
export default function Spinner({ label }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-slate-400">
      <span className="h-7 w-7 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
