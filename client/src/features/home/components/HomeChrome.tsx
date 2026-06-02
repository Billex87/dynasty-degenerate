import { FeedbackButton } from "@/components/FeedbackButton";
import { HeaderCssLights } from "@/components/HeaderCssLights";
import { LegalLinks } from "@/components/LegalLinks";
import { SupportButton } from "@/components/SupportButton";

const DYNASTY_LOGO_SRC =
  "/brand/logos/uploads/report-header-logo-compact-transparent-cropped-720.webp?v=20260520-home-perf";
const DYNASTY_MOBILE_REPORT_LOGO_SRC =
  "/brand/logos/png/mobile-dd-stacked-transparent.png?v=20260519-mobile-transparent";

function HomeBrandLockup() {
  return (
    <div className="home-footer-brand" aria-label="Dynasty Degenerates">
      <img
        src={DYNASTY_LOGO_SRC}
        alt="Dynasty Degenerates"
        width={720}
        height={200}
        decoding="async"
        className="home-footer-logo-long"
      />
      <img
        src={DYNASTY_MOBILE_REPORT_LOGO_SRC}
        alt=""
        width={180}
        height={180}
        decoding="async"
        aria-hidden="true"
        className="home-footer-mobile-icon"
      />
    </div>
  );
}

function HomeHeaderBrandLockup({
  onBrandClick,
}: {
  onBrandClick?: () => void;
}) {
  const content = (
    <img
      src={DYNASTY_LOGO_SRC}
      alt="Dynasty Degenerates"
      width={720}
      height={200}
      decoding="async"
      className="home-header-logo"
    />
  );

  if (onBrandClick) {
    return (
      <button
        type="button"
        className="home-header-logo-wrap cursor-pointer border-0 bg-transparent p-0"
        onClick={onBrandClick}
        aria-label="Return to Dynasty Degenerates home"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="home-header-logo-wrap" aria-label="Dynasty Degenerates">
      {content}
    </div>
  );
}

export function HomeHeaderChrome({
  onBrandClick,
}: {
  onBrandClick?: () => void;
}) {
  return (
    <header className="home-header md:hidden">
      <HeaderCssLights className="dd-home-header-css-lights" />
      <div className="home-header-inner max-w-7xl mx-auto px-4">
        <HomeHeaderBrandLockup onBrandClick={onBrandClick} />
        <div className="home-header-right-slot" aria-hidden="true" />
      </div>
    </header>
  );
}

export function HomeFooterChrome({ showBrand = true }: { showBrand?: boolean }) {
  return (
    <div className="home-footer-inner home-footer-light-shell max-w-7xl mx-auto">
      <HeaderCssLights className="dd-footer-css-lights" />
      <div className="home-footer-slot home-footer-slot-left">
        <SupportButton className="home-action-button" showExternalIcon={false} />
      </div>
      {showBrand && (
        <div className="flex flex-col items-center gap-1">
          <HomeBrandLockup />
          <LegalLinks />
        </div>
      )}
      <div className="home-footer-slot home-footer-slot-right">
        <FeedbackButton className="home-action-button" compact />
      </div>
    </div>
  );
}
