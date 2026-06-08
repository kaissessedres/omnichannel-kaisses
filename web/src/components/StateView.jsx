// Bloco centralizado para estados de vazio/erro, com ação opcional (ex: retry).
export default function StateView({ emoji, title, hint, action, actionLabel = 'Tentar de novo' }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-slate-400">
      {emoji && <span className="text-3xl" aria-hidden="true">{emoji}</span>}
      {title && <p className="font-medium text-slate-300">{title}</p>}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {action && (
        <button
          onClick={action}
          className="mt-2 rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-100 hover:bg-slate-600"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
