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

export function HomeLandingFeatureCard({
  card,
  isClone,
}: HomeLandingFeatureCardProps) {
  return (
    <article
      className={`home-feature-card ${card.colorClass} p-4 sm:p-6 space-y-3${
        isClone ? " home-feature-card-clone" : ""
      }`}
      aria-hidden={isClone ? true : undefined}
    >
      <div className="home-feature-heading">
        <div
          className={`home-feature-heading-icon ${card.headingBgClass}`}
        >
          {card.icon}
        </div>
        <h3 className="home-feature-card-title">{card.title}</h3>
      </div>
      <p className="home-feature-card-body">{card.body}</p>
    </article>
  );
}

export type { FeatureCard };
