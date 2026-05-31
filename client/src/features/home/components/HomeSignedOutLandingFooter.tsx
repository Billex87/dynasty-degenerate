import { HomeFooterChrome } from "@/features/home/components/HomeChrome";

interface HomeSignedOutLandingFooterProps {
  showLoadingFooter: boolean;
  isAnalysisBusy: boolean;
}

export function HomeSignedOutLandingFooter({
  showLoadingFooter,
  isAnalysisBusy,
}: HomeSignedOutLandingFooterProps) {
  if (!showLoadingFooter) {
    return null;
  }

  return (
    <footer className="home-footer mt-auto px-4 py-1">
      <HomeFooterChrome showBrand={!isAnalysisBusy} />
    </footer>
  );
}
