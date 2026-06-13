import { type ReactNode } from "react";

type FeatureCard = {
  key: string;
  title: string;
  icon: ReactNode;
  colorClass: string;
  headingBgClass: string;
  body: ReactNode;
};

interface HomeLandingFeatureCardProps {
  card: FeatureCard;
  isClone?: boolean;
}

function getFeatureTileTone(colorClass: string) {
  if (colorClass.includes("green") || colorClass.includes("cyan"))
    return "success";
  if (colorClass.includes("orange") || colorClass.includes("amber"))
    return "warning";
  if (colorClass.includes("purple")) return "violet";
  if (colorClass.includes("blue")) return "brand";
  return "danger";
}

export function HomeLandingFeatureCard({
  card,
  isClone,
}: HomeLandingFeatureCardProps) {
  return (
    <article
      className={`dd-tile dd-glass-cold dd-cut-frame u-dd-scanlines home-feature-card ${card.colorClass} p-4 sm:p-6 space-y-3${
        isClone ? " home-feature-card-clone" : ""
      }`}
      data-dd-tone={getFeatureTileTone(card.colorClass)}
      aria-hidden={isClone ? true : undefined}
    >
      <div className="home-feature-heading">
        <div className={`home-feature-heading-icon ${card.headingBgClass}`}>
          {card.icon}
        </div>
        <h3 className="home-feature-card-title">{card.title}</h3>
      </div>
      <p className="home-feature-card-body">{card.body}</p>
    </article>
  );
}

export type { FeatureCard };
