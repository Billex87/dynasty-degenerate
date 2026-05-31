# Cross‑League Validation Matrix

This matrix compares how Dynasty Degens should adapt its UI and analytics across the four test leagues.  Due to a league‑switching bug, only **Skids Get Beat** could be inspected.  The other leagues are described based on expected behaviour, and differences remain unverified.

## A. Skids Get Beat vs test league (Dynasty superflex vs redraft non‑superflex)

| Aspect | Expected difference | Observed in Skids Get Beat | Observed in test league | Pass/Fail |
|---|---|---|---|---|
| **League labels** | Dynasty league should show `Dynasty` and `SF`.  Redraft league should show `Redraft` and no `SF` tag. | Tags `Dynasty` and `SF` displayed correctly. | *Unverified – blocked.* | **Unverified** |
| **Ranking basis** | Dynasty league uses long‑term value and age metrics.  Redraft should focus on current season with weekly ranks and points. | Dynasty value, season value and age appear in the table【204209501864871†screenshot】. | *Unverified – blocked.* | **Unverified** |
| **QB importance** | QBs should be top‑valued in Superflex; in 1‑QB redraft they should rank lower relative to RB/WR. | QBs like Josh Allen and Caleb Williams ranked near the top【204209501864871†screenshot】. | *Unverified – blocked.* | **Unverified** |
| **Dynasty vs redraft language** | Dynasty page should mention future picks, rebuilders vs contenders, taxi squad.  Redraft page should avoid dynasty terms. | Overview uses dynasty language (“Rebuilding”, “Contender”) and draft picks. | *Unverified – blocked.* | **Unverified** |
| **Draft‑complete features** | test league (draft complete) should show team rosters, start/sit analysis and trade features. | Skids Get Beat shows full league features (draft complete). | *Unverified – blocked.* | **Unverified** |

## B. The Fantasy Degenerates vs Skids Get Beat (Dynasty superflex with TE premium vs dynasty superflex without TE premium)

| Aspect | Expected difference | Observed in Skids Get Beat | Observed in The Fantasy Degenerates | Pass/Fail |
|---|---|---|---|---|
| **TE premium indicator** | TE premium league should display a `TE Premium` tag in header or settings. | Skids Get Beat does not display TE premium (as expected). | *Unverified – blocked.* | **Unverified** |
| **Tight end rankings** | TE premium should boost TE values relative to other positions; top TEs may leapfrog some WRs/RBs. | No TE premium observed.  TEs like Brock Bowers were high but not excessive【535542977125753†screenshot】. | *Unverified – blocked.* | **Unverified** |
| **TE‑specific projections** | Projections should reflect higher point multipliers for tight end receptions. | Not applicable. | *Unverified – blocked.* | **Unverified** |

## C. test league vs Gov Tech Grid Iron (Redraft drafted vs redraft pre‑draft)

| Aspect | Expected difference | Observed in test league | Observed in Gov Tech Grid Iron | Pass/Fail |
|---|---|---|---|---|
| **Draft status** | test league should show completed draft features (roster analysis, start/sit suggestions).  Gov Tech Grid Iron should show pre‑draft empty states and not pretend teams exist. | *Unverified – blocked.* | *Unverified – blocked.* | **Unverified** |
| **Empty states** | Pre‑draft league should provide helpful messages explaining that the draft has not occurred yet and hide team‑specific features. | N/A | *Unverified – blocked.* | **Unverified** |
| **Current‑season focus** | Both should avoid dynasty language and emphasise weekly projections and current season value. | N/A | *Unverified – blocked.* | **Unverified** |

## D. Dynasty leagues vs redraft leagues

| Aspect | Expected difference | Observed dynasty behaviour (Skids Get Beat) | Observed redraft behaviour (test league & Gov Tech Grid Iron) | Overall assessment |
|---|---|---|---|---|
| **Terminology** | Dynasty pages should mention future picks, rebuild vs contend, taxi squads; redraft pages should not. | Skids Get Beat used dynasty terminology across multiple pages (e.g., “Future picks” on draft board; “Rebuilder/Contender” labels). | *Unverified – blocked.* | Unable to validate due to missing redraft access. |
| **Ranking metrics** | Dynasty pages should show long‑term value (dynasty ranks).  Redraft pages should show seasonal projections and weekly ranks. | Dynasty value, season value and age metrics present. | *Unverified – blocked.* | Unknown. |
| **Feature availability** | Some features (draft capital efficiency, taxi squad triage) should be hidden in redraft leagues. | Visible in Skids Get Beat. | *Unverified – blocked.* | Unknown. |

### Summary

Because of the league switching bug, cross‑league validation could not be performed.  The expected differences between dynasty and redraft, superflex and non‑superflex, TE premium and non‑premium, and draft complete versus incomplete remain hypothetical.  Fixing league selection is critical to validate business logic across formats.

