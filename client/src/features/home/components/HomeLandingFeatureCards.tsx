import { Bot, Crosshair, Flame, Gavel, Radar, Swords } from "lucide-react";
import type { ReactNode } from "react";
import {
  HomeLandingFeatureCard,
  type FeatureCard,
} from "@/features/home/components/HomeLandingFeatureCard";

const HOME_FEATURE_CARDS: FeatureCard[] = [
  {
    key: "roster-roast",
    title: "Roster Roast",
    icon: <Flame className="w-6 h-6 text-red-400" />,
    colorClass: "home-feature-green",
    headingBgClass: "bg-red-500/20",
    body: (
      <>
        See who’s stacked, who’s cooked, and who’s one ACL away from
        rebuilding their <span className="home-keep-together">trash ass team.</span>
      </>
    ),
  },
  {
    key: "trade-victims",
    title: "Trade Victims",
    icon: <Crosshair className="w-6 h-6 text-blue-400" />,
    colorClass: "home-feature-blue",
    headingBgClass: "bg-blue-500/20",
    body: (
      <>
        Find managers holding drops, fake depth, and players only podcasters
        <span className="home-keep-together"> really believe in.</span>
      </>
    ),
  },
  {
    key: "lineup-abuse",
    title: "Lineup Abuse",
    icon: <Swords className="w-6 h-6 text-purple-400" />,
    colorClass: "home-feature-purple",
    headingBgClass: "bg-purple-500/20",
    body: (
      <>
        Spot starter gaps and turn desperation into leverage plays before your
        <span className="home-keep-together"> buddies coffee hits.</span>
      </>
    ),
  },
  {
    key: "draft-punishment",
    title: "Draft Punishment",
    icon: <Gavel className="w-6 h-6 text-orange-300" />,
    colorClass: "home-feature-orange",
    headingBgClass: "bg-orange-500/20",
    body: (
      <>
        Expose bad picks, wasted rookie value, and managers who let their
        girlfriends <span className="home-keep-together">draft for them.</span>
      </>
    ),
  },
  {
    key: "ai-league-bully",
    title: "AI League Bully",
    icon: <Bot className="w-6 h-6 text-cyan-300" />,
    colorClass: "home-feature-cyan",
    headingBgClass: "bg-cyan-500/20",
    body: (
      <>
        Use AI to find weak rosters, bad offers, and managers one panic trade away
        <span className="home-keep-together"> from a Sacko.</span>
      </>
    ),
  },
  {
    key: "waiver-vultures",
    title: "Waiver Vultures",
    icon: <Radar className="w-6 h-6 text-amber-300" />,
    colorClass: "home-feature-amber",
    headingBgClass: "bg-amber-500/20",
    body: (
      <>
        Find overlooked players, panic drops, and free scraps before the rest of
        <span className="home-keep-together"> the league notices.</span>
      </>
    ),
  },
];

export function HomeLandingFeatureCards() {
  const carouselCards = [
    ...HOME_FEATURE_CARDS,
    ...HOME_FEATURE_CARDS.slice(0, 2).map((card, index) => ({
      ...card,
      key: `${card.key}-clone-${index}`,
      isClone: true,
    })),
  ] as Array<FeatureCard & { isClone?: boolean }>;

  return (
    <div className="home-feature-carousel-window">
      <div className="home-feature-grid">
        {carouselCards.map(card => (
          <HomeLandingFeatureCard
            key={card.key}
            card={card}
            isClone={Boolean(card.isClone)}
          />
        ))}
      </div>
    </div>
  );
}
