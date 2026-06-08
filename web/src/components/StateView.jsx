// Bloco centralizado para estados de vazio/erro, com ação opcional (ex: retry).
// `icon` é um componente de ícone (lucide-react).
export default function StateView({ icon: Icon, title, hint, action, actionLabel = 'Tentar de novo' }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-slate-400">
      {Icon && <Icon className="h-8 w-8 text-slate-500" aria-hidden="true" />}
      {title && <p className="font-medium text-slate-300">{title}</p>}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {action && (
        <button onClick={action} className="btn btn-sm btn-neutral mt-2">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
