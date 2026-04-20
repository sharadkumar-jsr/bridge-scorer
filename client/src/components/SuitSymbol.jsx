const SUITS = {
  S:  { symbol: '♠', label: 'Spades',   cls: 'suit-spade'   },
  H:  { symbol: '♥', label: 'Hearts',   cls: 'suit-heart'   },
  D:  { symbol: '♦', label: 'Diamonds', cls: 'suit-diamond' },
  C:  { symbol: '♣', label: 'Clubs',    cls: 'suit-club'    },
  NT: { symbol: 'NT', label: 'No Trump', cls: 'text-gold-300' },
};

export default function SuitSymbol({ suit, size = 'md', className = '' }) {
  const s = SUITS[suit];
  if (!s) return null;
  const sizeClass = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-sm' : 'text-base';
  return (
    <span
      className={`${s.cls} ${sizeClass} ${className} font-mono select-none`}
      title={s.label}
      aria-label={s.label}
    >
      {s.symbol}
    </span>
  );
}

export { SUITS };
