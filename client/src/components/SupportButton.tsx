import { Coffee, ExternalLink } from 'lucide-react';

const DEFAULT_SUPPORT_URL = 'https://www.buymeacoffee.com/billex87';
const DEFAULT_SUPPORT_LABEL = 'Buy Me A Coffee';

type SupportButtonProps = {
  compact?: boolean;
  className?: string;
};

export function SupportButton({ compact = false, className = '' }: SupportButtonProps) {
  const configuredUrl = String(import.meta.env.VITE_SUPPORT_URL || '').trim();
  const configuredLabel = String(import.meta.env.VITE_SUPPORT_LABEL || '').trim();
  const supportUrl = configuredUrl || DEFAULT_SUPPORT_URL;
  const label = configuredLabel || DEFAULT_SUPPORT_LABEL;

  return (
    <a
      href={supportUrl}
      target="_blank"
      rel="noreferrer"
      className={`support-button ${compact ? 'support-button-compact' : ''} ${className}`.trim()}
    >
      <Coffee aria-hidden="true" className="support-button-icon" />
      <span>{compact ? 'Tip Jar' : label}</span>
      <ExternalLink aria-hidden="true" className="support-button-external" />
    </a>
  );
}
