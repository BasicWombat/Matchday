export function Spinner() {
  return (
    <div className="flex items-center justify-center p-16">
      <div className="w-8 h-8 border-[3px] border-pitch-200 border-t-pitch-700 rounded-full animate-spin" />
    </div>
  );
}

export function ErrorState({ message }) {
  return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-600 font-medium">{message}</p>
      </div>
    </div>
  );
}

export function EmptyState({ message, action }) {
  return (
    <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
      <p className="text-gray-400 text-sm mb-3">{message}</p>
      {action}
    </div>
  );
}

export function PageHeader({ eyebrow, title, action }) {
  return (
    <div className="bg-pitch-900 px-6 py-8">
      {eyebrow && (
        <p className="text-gold-400 text-[10px] font-bold tracking-[0.2em] uppercase mb-1">{eyebrow}</p>
      )}
      <div className="flex items-start justify-between gap-4">
        <h1 className="font-bebas text-white text-4xl md:text-5xl tracking-wide leading-none">{title}</h1>
        {action && <div className="shrink-0 pt-1">{action}</div>}
      </div>
    </div>
  );
}

export function LeaderRow({ rank, name, jersey, teamName, value, unit, gold }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={`font-bebas text-2xl w-7 text-center shrink-0 ${rank === 1 ? 'text-gold-500' : 'text-pitch-300'}`}>
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-pitch-900 text-sm truncate">{name}</p>
        <p className="text-[11px] text-gray-400">#{jersey} · {teamName}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`font-bebas text-2xl ${gold ? 'text-gold-500' : 'text-pitch-900'}`}>{value}</p>
        <p className="text-[10px] text-gray-400 uppercase tracking-wide">{unit}</p>
      </div>
    </div>
  );
}

export function Btn({ variant = 'primary', size = 'md', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center gap-1.5 font-bold rounded-lg transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'text-xs px-3 py-1.5', md: 'text-sm px-4 py-2', lg: 'px-6 py-2.5' };
  const variants = {
    primary:   'bg-gold-500 hover:bg-gold-400 text-pitch-950',
    secondary: 'bg-white border border-gray-200 hover:bg-pitch-50 hover:border-pitch-300 text-pitch-700',
    danger:    'bg-red-600 hover:bg-red-500 text-white',
    ghost:     'bg-white border border-gray-200 hover:bg-gray-50 text-pitch-800',
    dark:      'bg-pitch-800 hover:bg-pitch-700 text-white',
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />
  );
}
