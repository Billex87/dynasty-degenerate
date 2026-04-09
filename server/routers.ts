import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { loadKTCValues, loadKTCValuesLastWeek } from "./ktcLoader";
import { getKtcSnapshotFromSevenDaysAgo } from "./ktcSnapshotJob";
import { generateReport } from "./reportGenerator";
import { fetchDraftData, fetchADPData, analyzeDraftPicks } from "./draftAnalysis";

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
              userMap[r.owner_id]?.display_name || 'Unknown',
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
          // Try to get 7-day snapshot from database, fall back to static file
          let ktcValuesLastWeekRaw = await getKtcSnapshotFromSevenDaysAgo();
          let ktcValuesLastWeek: any;
          if (ktcValuesLastWeekRaw) {
            // Convert from Record<string, number> to KTCValues format
            ktcValuesLastWeek = Object.fromEntries(
              Object.entries(ktcValuesLastWeekRaw).map(([key, value]) => [
                key,
                { name: key, ktc_value: value }
              ])
            );
          } else {
            ktcValuesLastWeek = await loadKTCValuesLastWeek();
          }

          const prevLeagueId = leagueInfo.previous_league_id;
          let pastSeasonData = null;

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
                  pastUserMap[r.owner_id]?.display_name || 'Unknown',
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

              pastSeasonData = {
                label: '2025',
                trades: pastTrades,
                rosterMap: pastRosterUserMap,
                rosters: pastRosters,
              };
            } catch (e) {
              console.warn('Failed to fetch past season data:', e);
            }
          }

          const currentSeasonData = {
            label: '2026',
            trades,
            rosterMap: rosterUserMap,
            rosters,
          };

          const reportData = await generateReport(
            currentSeasonData,
            pastSeasonData,
            players,
            ktcValues,
            ktcValuesLastWeek
          );

          // Create user_id to manager name mapping for draft analysis
          const currentUserMap = Object.fromEntries(
            users.map((u: any) => [u.user_id, u.display_name || 'Unknown'])
          );
          let pastUserMap: Record<string, string> = {};
          if (pastSeasonData) {
            const pastUsers = await fetch(
              `https://api.sleeper.app/v1/league/${prevLeagueId}/users`
            ).then((r) => r.json());
            pastUserMap = Object.fromEntries(
              pastUsers.map((u: any) => [u.user_id, u.display_name || 'Unknown'])
            );
          }

          // Fetch and analyze draft data
          let draftAnalysis: { draftPicks: any[]; draftStats: any[] } = { draftPicks: [], draftStats: [] };
          try {
            const draftPicks = await fetchDraftData(input.leagueId, {
              currentRosterMap: rosterUserMap,
              currentRosters: rosters,
              currentUserMap,
              pastRosterMap: pastSeasonData?.rosterMap || {},
              pastRosters: pastSeasonData?.rosters || [],
              pastUserMap,
            });
            const adpData = await fetchADPData();
            if (draftPicks.length > 0) {
              draftAnalysis = analyzeDraftPicks(
                draftPicks,
                players,
                rosterUserMap,
                ktcValues,
                adpData
              );
            }
          } catch (e) {
            console.warn('Failed to fetch draft data:', e);
          }

          return {
            leagueId: input.leagueId,
            leagueName: leagueInfo.name,
            leagueLogo: leagueInfo.logo || null,
            reportData: {
              ...reportData,
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
});

export type AppRouter = typeof appRouter;
