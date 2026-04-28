import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { loadKTCValues, loadKTCValuesLastWeek } from "./ktcLoader";
import type { KTCValues } from "./reportGenerator";
import { loadCurrentKTCPositionRanks } from "./currentKTCLoader";
import { getKtcSnapshotFromSevenDaysAgo } from "./ktcSnapshotJob";
import { generateReport } from "./reportGenerator";
import { fetchDraftData, calculateADPFromPicks, analyzeDraftPicks } from "./draftAnalysis";
import { getMay2025KTCSnapshot, getJan15KTCSnapshot } from "./waybackMachineScraper";
import { fetchPlayerHeadshot, getCachedImage } from "./imageProxy";

function normalizeManagerName(name: string | undefined): string {
  const fallback = name || 'Unknown';
  return fallback.replace(/\d+$/, '') || fallback;
}

function getSleeperAvatarUrl(avatarId: string | null | undefined): string | null {
  return avatarId ? `https://sleepercdn.com/avatars/thumbs/${avatarId}` : null;
}

function buildManagerAvatarMap(users: any[]): Record<string, string | null> {
  return Object.fromEntries(
    users.map((user: any) => [
      normalizeManagerName(user.display_name),
      getSleeperAvatarUrl(user.avatar),
    ])
  );
}

async function fetchDraftSlotsBySeason(
  leagueId: string,
  rosters: Array<{ roster_id: number; owner_id: string }>
): Promise<Record<string, Record<number, number>>> {
  const drafts = await fetch(
    `https://api.sleeper.app/v1/league/${leagueId}/drafts`
  ).then((r) => r.json());

  if (!Array.isArray(drafts)) return {};

  const rosterByOwnerId = Object.fromEntries(
    rosters.map((roster) => [roster.owner_id, roster.roster_id])
  );
  const slotsBySeason: Record<string, Record<number, number>> = {};

  for (const draft of drafts) {
    if (!draft?.season || !draft?.draft_order) continue;

    const season = String(draft.season);
    if (!slotsBySeason[season]) slotsBySeason[season] = {};

    for (const [ownerId, draftSlot] of Object.entries(draft.draft_order)) {
      const rosterId = rosterByOwnerId[ownerId];
      if (rosterId && typeof draftSlot === 'number') {
        slotsBySeason[season][rosterId] = draftSlot;
      }
    }
  }

  return slotsBySeason;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  league: router({
    analyze: publicProcedure
      .input(z.object({ leagueId: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const leagueInfo = await fetch(
            `https://api.sleeper.app/v1/league/${input.leagueId}`
          ).then((r) => r.json());

          if (!leagueInfo.league_id) {
            throw new Error('Invalid league ID');
          }

          const users = await fetch(
            `https://api.sleeper.app/v1/league/${input.leagueId}/users`
          ).then((r) => r.json());

          const rosters = await fetch(
            `https://api.sleeper.app/v1/league/${input.leagueId}/rosters`
          ).then((r) => r.json());

          const userMap = Object.fromEntries(
            users.map((u: any) => [u.user_id, u])
          );
          const rosterUserMap = Object.fromEntries(
            rosters.map((r: any) => [
              r.roster_id,
              normalizeManagerName(userMap[r.owner_id]?.display_name),
            ])
          );

          const trades: any[] = [];
          for (let week = 1; week <= 18; week++) {
            const weekTrades = await fetch(
              `https://api.sleeper.app/v1/league/${input.leagueId}/transactions/${week}`
            ).then((r) => r.json());
            if (weekTrades) {
              trades.push(
                ...weekTrades.filter(
                  (t: any) => t.type === 'trade' && t.status === 'complete'
                )
              );
            }
          }

          const players = await fetch(
            'https://api.sleeper.app/v1/players/nfl'
          ).then((r) => r.json());

          const ktcValues = await loadKTCValues();
          // Get previous week's KTC snapshot for Weekly Momentum calculations (7 days ago)
          const ktcValuesLastWeekRaw = await getKtcSnapshotFromSevenDaysAgo();
          let ktcValuesLastWeek: KTCValues = {};
          
          if (ktcValuesLastWeekRaw && Object.keys(ktcValuesLastWeekRaw).length > 0) {
            ktcValuesLastWeek = ktcValuesLastWeekRaw;
          } else {
            // Fallback to Jan 15 snapshot if no database snapshot available
            ktcValuesLastWeek = await getJan15KTCSnapshot();
            if (Object.keys(ktcValuesLastWeek).length === 0) {
              ktcValuesLastWeek = await loadKTCValuesLastWeek();
            }
          }

          const prevLeagueId = leagueInfo.previous_league_id;
          let pastSeasonData = null;
          let draftSlotsBySeason = await fetchDraftSlotsBySeason(input.leagueId, rosters);

          if (prevLeagueId) {
            try {
              const pastUsers = await fetch(
                `https://api.sleeper.app/v1/league/${prevLeagueId}/users`
              ).then((r) => r.json());
              const pastRosters = await fetch(
                `https://api.sleeper.app/v1/league/${prevLeagueId}/rosters`
              ).then((r) => r.json());
              const pastUserMap = Object.fromEntries(
                pastUsers.map((u: any) => [u.user_id, u])
              );
              const pastRosterUserMap = Object.fromEntries(
                pastRosters.map((r: any) => [
                  r.roster_id,
                  normalizeManagerName(pastUserMap[r.owner_id]?.display_name),
                ])
              );
              // Fetch trades from previous season
              const pastTrades: any[] = [];
              for (let week = 1; week <= 18; week++) {
                const weekTrades = await fetch(
                  `https://api.sleeper.app/v1/league/${prevLeagueId}/transactions/${week}`
                ).then((r) => r.json());
                if (weekTrades) {
                  pastTrades.push(
                    ...weekTrades.filter(
                      (t: any) => t.type === "trade" && t.status === "complete"
                    )
                  );
                }
              }

              const pastDraftSlotsBySeason = await fetchDraftSlotsBySeason(prevLeagueId, pastRosters);
              draftSlotsBySeason = {
                ...pastDraftSlotsBySeason,
                ...draftSlotsBySeason,
              };

              pastSeasonData = {
                label: '2025',
                trades: pastTrades,
                rosterMap: pastRosterUserMap,
                rosters: pastRosters,
                draftSlotsBySeason,
              };
            } catch (e) {
              console.warn('Failed to fetch past season data:', e);
            }
          }

          // Create user_id to manager name map for draft analysis
          const userIdToManagerMap = Object.fromEntries(
            users.map((u: any) => [u.user_id, normalizeManagerName(u.display_name)])
          );

          const currentSeasonData = {
            label: '2026',
            trades,
            rosterMap: rosterUserMap,
            rosters,
            draftSlotsBySeason,
          };

          const reportData = await generateReport(
            currentSeasonData,
            pastSeasonData,
            players,
            ktcValues,
            ktcValuesLastWeek
          );

          // currentUserMap is the same as userIdToManagerMap, so we can reuse it
          const currentUserMap = userIdToManagerMap;
          let pastUserMap: Record<string, string> = {};
          if (pastSeasonData) {
            const pastUsers = await fetch(
              `https://api.sleeper.app/v1/league/${prevLeagueId}/users`
            ).then((r) => r.json());
            pastUserMap = Object.fromEntries(
              pastUsers.map((u: any) => [u.user_id, normalizeManagerName(u.display_name)])
            );
          }

          // Fetch and analyze draft data
          let draftAnalysis: { draftPicks: any[]; draftStats: any[] } = { draftPicks: [], draftStats: [] };
          try {
            const draftPicks = await fetchDraftData(input.leagueId, {
              currentRosterMap: rosterUserMap,
              currentRosters: rosters,
              currentUserMap,
              currentUserIdToManagerMap: userIdToManagerMap,
              pastRosterMap: pastSeasonData?.rosterMap || {},
              pastRosters: pastSeasonData?.rosters || [],
              pastUserMap,
              pastUserIdToManagerMap: pastUserMap,
              prevLeagueId,
            });
            // Calculate ADP from the draft picks themselves
            const adpData = calculateADPFromPicks(draftPicks);
            if (draftPicks.length > 0) {
              // Load May 2025 KTC baseline for value change calculations
              const ktcValuesMay2025 = getMay2025KTCSnapshot();
              // Load current KTC position ranks
              const currentKTCRanks = await loadCurrentKTCPositionRanks();
              draftAnalysis = await analyzeDraftPicks(
                draftPicks,
                players,
                rosterUserMap,
                ktcValues,
                adpData,
                ktcValuesLastWeek,
                ktcValuesMay2025,
                currentKTCRanks
              );
            }
          } catch (e) {
            console.warn('Failed to fetch draft data:', e);
          }

          return {
            leagueId: input.leagueId,
            leagueName: leagueInfo.name,
            leagueLogo: getSleeperAvatarUrl(leagueInfo.avatar),
            reportData: {
              ...reportData,
              managerAvatars: buildManagerAvatarMap(users),
              draftPicks: draftAnalysis.draftPicks,
              draftStats: draftAnalysis.draftStats,
            },
          }
        } catch (error) {
          console.error('League analysis error:', error);
          throw new Error('Failed to fetch league data');
        }
      }),
  }),

  images: router({
    playerHeadshot: publicProcedure
      .input(z.object({ playerId: z.string() }))
      .query(async ({ input }) => {
        // Try to get from cache first
        const cached = getCachedImage(input.playerId);
        if (cached) {
          return {
            success: true,
            cached: true,
            data: cached.data.toString('base64'),
            contentType: cached.contentType,
          };
        }

        // Fetch and cache
        const imageBuffer = await fetchPlayerHeadshot(input.playerId);
        if (!imageBuffer) {
          return { success: false, cached: false };
        }

        return {
          success: true,
          cached: false,
          data: imageBuffer.toString('base64'),
          contentType: 'image/jpeg',
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
