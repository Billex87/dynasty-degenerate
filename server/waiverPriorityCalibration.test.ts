import { describe, expect, it } from 'vitest';
import {
  buildWaiverPriorityCalibrationRows,
  summarizeWaiverPriorityCalibration,
  type WaiverPriorityRosterInput,
} from './waiverPriorityCalibration';

const rosters: WaiverPriorityRosterInput[] = [
  {
    rosterId: 1,
    ownerId: 'manager-a',
    settings: {
      waiver_position: 1,
      wins: 4,
      losses: 1,
      fpts: 612,
      fpts_decimal: 34,
      total_moves: 22,
    },
  },
  {
    rosterId: 2,
    manager: 'Middle Priority',
    settings: {
      waiver_position: 2,
      wins: 2,
      losses: 3,
      fpts: 480,
      total_moves: 9,
    },
  },
  {
    rosterId: 3,
    manager: 'Low Priority',
    settings: {
      waiver_position: 4,
      wins: 1,
      losses: 4,
      fpts: 390,
      total_moves: 2,
    },
  },
];

describe('waiver priority calibration', () => {
  it('builds public Sleeper waiver order context with standings and activity buckets', () => {
    const rows = buildWaiverPriorityCalibrationRows({
      rosters,
      managerNameByRosterId: { '1': 'Mapped Top Priority' },
    });

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      rosterId: '1',
      manager: 'Mapped Top Priority',
      waiverPosition: 1,
      priorityPercentile: 0,
      priorityBurnCost: 'high',
      standingsRank: 1,
      pointsFor: 612.34,
      totalMoves: 22,
      activityLevel: 'active',
      confidence: 72,
      cohortKey: 'priority:high|standings:top|activity:active',
    });
    expect(rows[1]).toMatchObject({
      priorityBurnCost: 'medium',
      standingsRank: 2,
      activityLevel: 'normal',
      cohortKey: 'priority:medium|standings:middle|activity:normal',
    });
    expect(rows[2]).toMatchObject({
      priorityBurnCost: 'low',
      standingsRank: 3,
      activityLevel: 'quiet',
      cohortKey: 'priority:low|standings:bottom|activity:quiet',
    });
  });

  it('summarizes readiness and caps confidence because hidden claim outcomes are not approved', () => {
    const summary = summarizeWaiverPriorityCalibration({ rosters });

    expect(summary).toMatchObject({
      status: 'ready',
      rowCount: 3,
      rankedRowCount: 3,
      maxConfidence: 72,
    });
    expect(summary.confidenceCapReason).toMatch(/skipped, losing, pending, or cancelled claim evidence is not approved/i);
    expect(summary.rows.every((row) => row.confidence <= 72)).toBe(true);
  });

  it('marks partial or missing contexts without inventing priority evidence', () => {
    const partial = summarizeWaiverPriorityCalibration({
      rosters: [
        rosters[0],
        { rosterId: 2, manager: 'Unknown Priority', settings: { wins: 1, losses: 1 } },
      ],
    });
    expect(partial.status).toBe('partial');
    expect(partial.rankedRowCount).toBe(1);
    expect(partial.rows[1]).toMatchObject({
      waiverPosition: null,
      priorityPercentile: null,
      priorityBurnCost: 'unknown',
      confidence: 39,
      cohortKey: 'priority:unknown|standings:bottom|activity:unknown',
    });

    const missing = summarizeWaiverPriorityCalibration({
      rosters: [{ rosterId: 1, manager: 'No Waiver Order', settings: null }],
    });
    expect(missing.status).toBe('missing');
    expect(missing.rankedRowCount).toBe(0);
    expect(missing.maxConfidence).toBe(34);
  });
});
