import { LoadingAnimation } from "@/components/LoadingAnimation";
import type { LoaderManagerAnchor } from "@/components/LoaderKitBackdrop";
import "@/styles/loader-kit-preview.css";

const previewLeagueLogo =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Cdefs%3E%3CradialGradient id='g' cx='35%25' cy='24%25' r='78%25'%3E%3Cstop stop-color='%2324f5ff'/%3E%3Cstop offset='0.46' stop-color='%230a3148'/%3E%3Cstop offset='1' stop-color='%23ff9f43'/%3E%3C/radialGradient%3E%3C/defs%3E%3Ccircle cx='48' cy='48' r='43' fill='url(%23g)'/%3E%3Ccircle cx='48' cy='48' r='36' fill='%23020712' opacity='0.84'/%3E%3Cpath d='M22 50c11-14 41-14 52 0-10 18-42 18-52 0Z' fill='%23ff9f43' opacity='0.9'/%3E%3Ctext x='48' y='43' text-anchor='middle' font-family='Arial Black,Arial,sans-serif' font-size='18' fill='%2324f5ff'%3ESGB%3C/text%3E%3Ctext x='48' y='61' text-anchor='middle' font-family='Arial, sans-serif' font-size='8' fill='%23f7fbff'%3ELEAGUE%3C/text%3E%3C/svg%3E";

function makePreviewManagerIcon(primary: string, secondary: string, accent: string, shape: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
    <defs>
      <radialGradient id="g" cx="32%" cy="24%" r="78%">
        <stop stop-color="${accent}"/>
        <stop offset=".45" stop-color="${primary}"/>
        <stop offset="1" stop-color="${secondary}"/>
      </radialGradient>
    </defs>
    <rect width="80" height="80" rx="24" fill="url(#g)"/>
    <circle cx="40" cy="40" r="27" fill="#020712" opacity=".78"/>
    ${shape}
  </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const previewManagerAnchors: LoaderManagerAnchor[] = [
  {
    id: "preview-manager-1",
    avatarUrl: makePreviewManagerIcon(
      "#063a52",
      "#ff8a2a",
      "#24f5ff",
      `<path d="M21 42c8-16 30-22 44-7-6 19-27 26-44 7Z" fill="#ff8a2a"/><path d="M29 41h22" stroke="#fff8e7" stroke-width="3" stroke-linecap="round"/>`
    ),
  },
  {
    id: "preview-manager-2",
    avatarUrl: makePreviewManagerIcon(
      "#431707",
      "#0d7288",
      "#ffb45a",
      `<path d="M40 17l7 14 15 2-11 11 3 15-14-7-14 7 3-15-11-11 15-2 7-14Z" fill="#24f5ff"/>`
    ),
  },
  {
    id: "preview-manager-3",
    avatarUrl: makePreviewManagerIcon(
      "#052237",
      "#7a3b16",
      "#24f5ff",
      `<path d="M24 53l11-31h23L46 42h12L30 63l8-21H25Z" fill="#ffb45a"/>`
    ),
  },
  {
    id: "preview-manager-4",
    avatarUrl: makePreviewManagerIcon(
      "#092f3f",
      "#ff8a2a",
      "#8cf8ff",
      `<path d="M22 49c4-16 19-27 36-23 5 14-4 29-20 33-7-1-12-4-16-10Z" fill="#24f5ff"/><circle cx="50" cy="36" r="4" fill="#fff8e7"/>`
    ),
  },
  {
    id: "preview-manager-5",
    avatarUrl: makePreviewManagerIcon(
      "#331207",
      "#084d61",
      "#ff8a2a",
      `<path d="M18 46c9-19 34-25 47-8-7 20-32 24-47 8Z" fill="#8cf8ff"/><path d="M28 46c8-7 20-9 30-4" fill="none" stroke="#ff8a2a" stroke-width="4" stroke-linecap="round"/>`
    ),
  },
  {
    id: "preview-manager-6",
    avatarUrl: makePreviewManagerIcon(
      "#062b43",
      "#8a4217",
      "#24f5ff",
      `<circle cx="40" cy="40" r="19" fill="#ff8a2a"/><path d="M28 40h24M40 28v24" stroke="#fff8e7" stroke-width="4" stroke-linecap="round"/>`
    ),
  },
  {
    id: "preview-manager-7",
    avatarUrl: makePreviewManagerIcon(
      "#041826",
      "#ff8a2a",
      "#24f5ff",
      `<path d="M40 18l23 13v18L40 62 17 49V31Z" fill="#0fe3ff"/><path d="M40 25v30M24 35l32 19M56 35L24 54" stroke="#020712" stroke-width="3" opacity=".72"/>`
    ),
  },
  {
    id: "preview-manager-8",
    avatarUrl: makePreviewManagerIcon(
      "#4b1e0d",
      "#053549",
      "#ffb45a",
      `<path d="M19 47c7-20 33-27 48-10-7 19-29 27-48 10Z" fill="#ff8a2a"/><path d="M34 34l12 12M46 34L34 46" stroke="#fff8e7" stroke-width="4" stroke-linecap="round"/>`
    ),
  },
  {
    id: "preview-manager-9",
    avatarUrl: makePreviewManagerIcon(
      "#052435",
      "#934516",
      "#8cf8ff",
      `<circle cx="40" cy="40" r="18" fill="#24f5ff"/><path d="M29 44h22l-6 12H35Z" fill="#ff8a2a"/><path d="M28 35h24" stroke="#020712" stroke-width="4" stroke-linecap="round"/>`
    ),
  },
  {
    id: "preview-manager-10",
    avatarUrl: makePreviewManagerIcon(
      "#3c1608",
      "#08596d",
      "#ffb45a",
      `<path d="M24 25h32l7 18-23 16-23-16Z" fill="#ff8a2a"/><path d="M29 38h22M35 47h10" stroke="#fff8e7" stroke-width="4" stroke-linecap="round"/>`
    ),
  },
  {
    id: "preview-manager-11",
    avatarUrl: makePreviewManagerIcon(
      "#041a2a",
      "#a04918",
      "#24f5ff",
      `<path d="M20 53l20-36 20 36H20Z" fill="#24f5ff"/><circle cx="40" cy="43" r="8" fill="#020712"/><circle cx="40" cy="43" r="4" fill="#ff8a2a"/>`
    ),
  },
  {
    id: "preview-manager-12",
    avatarUrl: makePreviewManagerIcon(
      "#55210c",
      "#063344",
      "#ff8a2a",
      `<path d="M22 40c9-16 28-21 39-9 1 17-17 29-37 23Z" fill="#8cf8ff"/><path d="M32 37l14 14M47 36l-16 16" stroke="#020712" stroke-width="4" stroke-linecap="round"/>`
    ),
  },
  {
    id: "preview-manager-13",
    avatarUrl: makePreviewManagerIcon(
      "#052538",
      "#7a3512",
      "#24f5ff",
      `<path d="M40 17l6 17h18l-15 10 6 18-15-11-15 11 6-18-15-10h18Z" fill="#ffb45a"/><circle cx="40" cy="40" r="7" fill="#020712"/>`
    ),
  },
  {
    id: "preview-manager-14",
    avatarUrl: makePreviewManagerIcon(
      "#3a1407",
      "#074e61",
      "#ffb45a",
      `<path d="M18 48c11-17 33-22 48-8-7 19-31 25-48 8Z" fill="#ff8a2a"/><path d="M33 34h14v25H33Z" fill="#020712" opacity=".72"/><path d="M30 43h20" stroke="#fff8e7" stroke-width="4" stroke-linecap="round"/>`
    ),
  },
];

export default function LoaderKitPreview() {
  return (
    <div className="ddlp">
      <div className="ddlp__preview-shell">
        <div className="analysis-loading-dialog-loading ddlp__current-modal-shell">
          <div className="analysis-loading-modal-body">
              <LoadingAnimation
                leagueName="Skids Get Beat"
                leagueFormat="14-Team Dynasty SF Half-PPR"
                leagueLogo={previewLeagueLogo}
                managerAnchors={previewManagerAnchors}
              />
          </div>
        </div>
      </div>
    </div>
  );
}
