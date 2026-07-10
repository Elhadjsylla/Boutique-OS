

export type RevealState = 'hidden' | 'loading' | 'revealed';

export const MaskedValue = ({ 
  maskedText, 
  revealedText, 
  status, 
  onReveal, 
  type 
}: { 
  maskedText: string, 
  revealedText?: string, 
  status: RevealState, 
  onReveal: () => void,
  type: 'nom' | 'email' | 'texte'
}) => {
  if (status === 'revealed' && revealedText) {
    return <span className="text-admin-text font-bold">{revealedText}</span>;
  }

  if (status === 'loading') {
    return (
      <span className="flex items-center gap-2 text-admin-text-muted">
        <div className="w-3 h-3 border-2 border-admin-primary border-t-transparent rounded-full animate-spin"></div>
        <span className="opacity-70">{maskedText}</span>
      </span>
    );
  }

  return (
    <span 
      onClick={(e) => { e.stopPropagation(); onReveal(); }}
      className="group flex items-center gap-2 cursor-pointer text-admin-text-muted hover:text-admin-primary transition-colors"
      title={`Cliquer pour révéler le ${type}`}
    >
      <span className="border-b border-dashed border-admin-text-muted/50 group-hover:border-admin-primary">
        {maskedText}
      </span>
      <span className="material-symbols-outlined text-[14px] opacity-0 group-hover:opacity-100 transition-opacity">
        visibility
      </span>
    </span>
  );
};
