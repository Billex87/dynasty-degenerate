import type { DraftOpportunity } from '@/lib/draftOpportunity';

export function DraftOpportunityNote({
  opportunity,
}: {
  opportunity?: DraftOpportunity;
}) {
  if (!opportunity) return null;

  return (
    <span
      className="draft-opportunity-note draft-opportunity-missed"
      title={`${opportunity.label}: ${opportunity.playerName} at ${opportunity.pickLabel}`}
    >
      {opportunity.label}: {opportunity.playerName}
    </span>
  );
}
