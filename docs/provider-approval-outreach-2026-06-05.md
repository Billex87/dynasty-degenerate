# Provider Approval Outreach Packet - 2026-06-05

Scope: projection/SOS/source-readiness provider approval. This packet is for outbound provider requests and legal/product review. It does not grant approval by itself.

Related evidence:

- [Provider / Source / Legal Checkpoint](provider-source-legal-checkpoint-2026-06-05.md)
- [Projection Source Readiness Gates](projection-source-readiness-gates.md)
- [FantasyPros Endpoint Feature Audit](fantasypros-endpoint-feature-audit.md)
- [Projections / SOS Source Policy](projections-sos-source-policy.md)

## Current Default

Until signed provider approval and legal/product approval exist:

- Normal report loads stay snapshot-backed.
- Sleeper remains the only live user-load source, and only for selected league state.
- FantasyPros, SportsDataIO/FantasyData, GridIron Data, DraftSharks, and future provider reads stay cron/admin/probe only.
- Public recommendation copy must not say a provider says, projects, ranks, recommends, endorses, or powers a specific claim.
- Provider names may appear in admin diagnostics, source coverage, legal/attribution contexts, and internal traces.

## Provider Approval Questions

Ask every provider to answer these in writing before any gate can move to `approved-for-public-claim`.

1. Which endpoints and fields are approved for our use case?
2. Is commercial use approved for a paid fantasy-football analysis product?
3. May we store snapshots in our database for report generation, caching, backtests, and audit trails?
4. May we show provider-attributed public claims, or must the data remain internal/blended?
5. What exact attribution language is required or allowed?
6. Are derived scores, confidence caps, and blended recommendations allowed when provider data is one input?
7. Are there restrictions on redisplay, redistribution, exports, screenshots, emails, or AI-generated summaries?
8. Are player images, headshots, logos, article text, excerpts, or news summaries included or separately licensed?
9. What are the rate limits, burst limits, daily/monthly quotas, retry rules, and cache requirements?
10. What freshness/cadence is expected for weekly projections, rankings, news, injuries, depth charts, targets, and schedule data?
11. Can provider player/team IDs be stored and mapped to Sleeper, GSIS, ESPN, Yahoo, and internal IDs?
12. What needs to be deleted or stopped if access terminates?

## Legal Approval Questions

Ask legal/product to approve these before charging, marketing, or provider-attributed claims:

1. Provider terms allow the planned commercial product use.
2. Provider terms allow stored snapshots and audit/backtest retention.
3. Public recommendation copy is allowed, including AI-generated summaries.
4. Attribution language is exact and acceptable.
5. Provider data can be mixed into a blended app recommendation without implying endorsement.
6. Blocked assets are excluded: player images, full articles, restricted historical stats, or unlicensed redisplay fields.
7. User-facing disclaimers cover projection uncertainty and source availability.
8. Billing/marketing pages do not imply official partnership unless explicitly approved.
9. Support/contact path exists for source-data disputes or takedown requests.
10. The source gate register is updated only after written approval exists.

## Proposed Public Copy For Legal Review

Preferred default when provider data is only an internal/blended input:

- "stored projection"
- "stored weekly rank"
- "schedule context"
- "stored news"
- "blend evidence"
- "schedule/value context only"

Avoid unless a provider explicitly approves public attribution:

- "FantasyPros projects..."
- "DraftSharks says..."
- "SportsDataIO recommends..."
- "Powered by [provider]"
- "[provider] edge"
- any claim that a provider endorses a lineup, waiver, trade, or ranking recommendation

Possible attribution-only wording for legal/provider review:

- "Contains data from [Provider], used under license."
- "Projection and ranking data provided by [Provider]."
- "Source data: [Provider]. Dynasty Degens recommendations are generated independently."

Do not ship any attribution wording until legal/provider approval confirms the exact phrase.

## FantasyPros Outreach Draft

Subject: Commercial API approval request for snapshot-backed fantasy football analysis

Hi FantasyPros team,

I am requesting commercial API approval for Dynasty Degens, a fantasy-football analysis product that generates league reports, waiver/trade reads, player detail views, matchup previews, and projection/SOS readiness checks.

Our intended implementation is server-side and snapshot-backed:

- No FantasyPros calls during normal user-triggered report loads.
- API reads would run only through cron/admin refreshes or metadata probes.
- Stored snapshots would include endpoint path, fetch timestamp, row count, freshness metadata, source version, and player/team mapping diagnostics.
- Recommendation copy would default to app-level language such as "stored projection", "weekly rank", "stored news", and "blend evidence" unless FantasyPros approves provider-attributed wording.

We are requesting written approval for:

1. Commercial use in a paid fantasy-football analysis product.
2. Snapshot storage for caching, report generation, audit trails, and backtests.
3. Endpoints: consensus rankings, weekly ECR, waiver-wire rankings, projections, player-points, players, news, injuries, compare-player rows, targets, and articles if available in our package.
4. Allowed row fields and any fields that must not be stored or displayed.
5. Exact public attribution language, if provider attribution is allowed.
6. Whether AI-generated summaries may use stored FantasyPros rows as internal evidence.
7. Rate limits, daily/monthly quotas, retry policy, and required cache cadence.
8. Package entitlements for projections, targets, articles, news, and player images.

We will not display FantasyPros player images, full articles, or article excerpts unless those rights are separately approved.

Current relevant source links we reviewed:

- https://support.fantasypros.com/hc/en-us/articles/49749297704475-How-do-I-request-access-to-the-FantasyPros-API
- https://api.fantasypros.com/public/v2/terms-of-use

Can you confirm which use cases and attribution language are approved, and what commercial package or agreement is required?

Thanks,

Billy

## SportsDataIO / FantasyData Outreach Draft

Subject: NFL fantasy data commercial package and redistribution approval request

Hi SportsDataIO team,

I am evaluating SportsDataIO/FantasyData for Dynasty Degens, a fantasy-football analysis product that generates league reports, waiver/trade reads, player detail views, matchup previews, and projection/SOS readiness checks.

Our intended implementation is server-side and snapshot-backed:

- No SportsDataIO/FantasyData calls during normal user-triggered report loads.
- API reads would run only through cron/admin refreshes or metadata probes.
- Stored snapshots would include endpoint path, fetch timestamp, row count, freshness metadata, source version, and player/team mapping diagnostics.
- Recommendation copy would default to app-level blended language unless provider attribution is approved.

We are requesting written approval and package guidance for NFL:

1. Commercial use in a paid fantasy-football analysis product.
2. Snapshot storage for caching, report generation, audit trails, and backtests.
3. Endpoints/feeds for players, teams, schedules, injuries, depth charts, fantasy scoring, weekly projections, route/usage fields, RotoBaller news, and transaction/classification data if available.
4. Whether Discovery Lab is insufficient for our use case and which commercial agreement is required.
5. Allowed public attribution language and any redisplay restrictions.
6. Whether AI-generated summaries may use stored provider rows as internal evidence.
7. Rate limits, cache requirements, quotas, retry policy, and expected freshness cadence.
8. Player/team ID mapping rights and any restrictions on joining to Sleeper, GSIS, ESPN, Yahoo, and internal IDs.

Current relevant source links we reviewed:

- https://sportsdata.io/developers
- https://sportsdata.io/terms-of-service

Can you confirm the correct commercial package, required agreement, and public attribution rules for this use case?

Thanks,

Billy

## GridIron Data Outreach Draft

Subject: Commercial approval request for snapshot-backed fantasy football API use

Hi GridIron Data team,

I am evaluating GridIron Data for Dynasty Degens, a fantasy-football analysis product that generates league reports, waiver/trade reads, player detail views, matchup previews, and projection/SOS readiness checks.

Our intended implementation is server-side and snapshot-backed:

- No GridIron Data calls during normal user-triggered report loads.
- API reads would run only through cron/admin refreshes or metadata probes.
- Stored snapshots would include endpoint path, fetch timestamp, row count, freshness metadata, source version, and player/team mapping diagnostics.
- Recommendation copy would default to app-level blended language unless provider attribution is approved.

We are requesting written approval for:

1. Commercial use in a paid fantasy-football analysis product.
2. Snapshot storage for caching, report generation, audit trails, and backtests.
3. Endpoints for players, projections, matchup data, injuries, roster changes, and historical stats.
4. Which plan is required for our expected call volume and whether Enterprise terms are needed.
5. Allowed public attribution language and any redisplay or redistribution restrictions.
6. Whether derived scores, AI-generated summaries, and blended recommendations may use stored GridIron rows as internal evidence.
7. Rate limits, cache requirements, quotas, retry policy, and expected freshness cadence.
8. Player/team ID mapping rights and any restrictions on joining to Sleeper, GSIS, ESPN, Yahoo, and internal IDs.

Current relevant source links we reviewed:

- https://www.gridirondata.com/
- https://www.gridirondata.com/pages/terms.html

Can you confirm the appropriate plan, approved uses, and exact public attribution rules?

Thanks,

Billy

## DraftSharks Approval Follow-Up

Current app status: DraftSharks SOS is approved for stored snapshots only. Public provider-attributed claims are still blocked.

Ask DraftSharks or the approved export/API owner to confirm:

1. We can store SOS snapshots for QB/RB/WR/TE/K/DEF by week/team.
2. We can use those stored rows in schedule-edge and waiver/streamer confidence models.
3. Public UI should say "schedule context" or may say "DraftSharks SOS".
4. Required attribution language, if any.
5. Refresh cadence and stale-data requirements.
6. Whether screenshots, emailed reports, or paid reports may include attributed SOS labels.

## Approval Packet To Send Legal

Send legal/product these files:

- `docs/provider-source-legal-checkpoint-2026-06-05.md`
- `docs/provider-approval-outreach-2026-06-05.md`
- `docs/projection-source-readiness-gates.md`
- `docs/projections-sos-source-policy.md`
- `docs/fantasypros-endpoint-feature-audit.md`

Ask legal/product for one of these written decisions for each source:

- `blocked`
- `research`
- `approved-for-snapshot`
- `approved-for-public-claim`

The source gate register should not be upgraded until legal/provider approval includes:

- terms approval
- exact endpoint URL/path or storage key
- auth model
- row count requirement
- freshness timestamp requirement
- rate-limit result requirement
- mapping coverage requirement
- allowed attribution language

## Current Engineering Decision

Do not add provider credentials, turn on production feature flags, or ship provider-attributed copy from this outreach packet alone.

The next code change after approval should be a small gate-register update plus a failing public-claim preflight test that turns green only for the approved source.
