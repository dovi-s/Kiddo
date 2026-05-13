# Week 1 Ticket Import Guide

Use the file matching your tool.

Week 1:
- Generic CSV: `WEEK1_TICKETS_IMPORT.csv`
- Jira CSV: `WEEK1_TICKETS_IMPORT_JIRA.csv`
- Linear CSV: `WEEK1_TICKETS_IMPORT_LINEAR.csv`
- Trello CSV: `WEEK1_TICKETS_IMPORT_TRELLO.csv`

Week 2:
- Generic CSV: `WEEK2_TICKETS_IMPORT.csv`
- Jira CSV: `WEEK2_TICKETS_IMPORT_JIRA.csv`
- Linear CSV: `WEEK2_TICKETS_IMPORT_LINEAR.csv`
- Trello CSV: `WEEK2_TICKETS_IMPORT_TRELLO.csv`

Week 3:
- Generic CSV: `WEEK3_TICKETS_IMPORT.csv`
- Jira CSV: `WEEK3_TICKETS_IMPORT_JIRA.csv`
- Linear CSV: `WEEK3_TICKETS_IMPORT_LINEAR.csv`
- Trello CSV: `WEEK3_TICKETS_IMPORT_TRELLO.csv`

Week 4:
- Generic CSV: `WEEK4_TICKETS_IMPORT.csv`
- Jira CSV: `WEEK4_TICKETS_IMPORT_JIRA.csv`
- Linear CSV: `WEEK4_TICKETS_IMPORT_LINEAR.csv`
- Trello CSV: `WEEK4_TICKETS_IMPORT_TRELLO.csv`

Week 5:
- Generic CSV: `WEEK5_TICKETS_IMPORT.csv`
- Jira CSV: `WEEK5_TICKETS_IMPORT_JIRA.csv`
- Linear CSV: `WEEK5_TICKETS_IMPORT_LINEAR.csv`
- Trello CSV: `WEEK5_TICKETS_IMPORT_TRELLO.csv`

Week 6:
- Generic CSV: `WEEK6_TICKETS_IMPORT.csv`
- Jira CSV: `WEEK6_TICKETS_IMPORT_JIRA.csv`
- Linear CSV: `WEEK6_TICKETS_IMPORT_LINEAR.csv`
- Trello CSV: `WEEK6_TICKETS_IMPORT_TRELLO.csv`

Master (Weeks 1-6 combined, 48 tickets):
- Generic CSV: `TICKETS_IMPORT_MASTER.csv`
- Jira CSV: `TICKETS_IMPORT_MASTER_JIRA.csv`
- Linear CSV: `TICKETS_IMPORT_MASTER_LINEAR.csv`
- Trello CSV: `TICKETS_IMPORT_MASTER_TRELLO.csv`

Growth Pack (Kora growth system tickets, 18 tickets):
- Generic CSV: `KORA_GROWTH_TICKETS_IMPORT.csv`
- Jira CSV: `KORA_GROWTH_TICKETS_IMPORT_JIRA.csv`
- Linear CSV: `KORA_GROWTH_TICKETS_IMPORT_LINEAR.csv`
- Trello CSV: `KORA_GROWTH_TICKETS_IMPORT_TRELLO.csv`

UX 2026 Addendum (Research-informed UX execution tickets, 4 tickets):
- Generic CSV: `KORA_UX26_TICKETS_IMPORT.csv`
- Jira CSV: `KORA_UX26_TICKETS_IMPORT_JIRA.csv`
- Linear CSV: `KORA_UX26_TICKETS_IMPORT_LINEAR.csv`
- Trello CSV: `KORA_UX26_TICKETS_IMPORT_TRELLO.csv`

Motion 2026 Addendum (Mobile motion execution tickets, 4 tickets):
- Generic CSV: `KORA_MOTION26_TICKETS_IMPORT.csv`
- Jira CSV: `KORA_MOTION26_TICKETS_IMPORT_JIRA.csv`
- Linear CSV: `KORA_MOTION26_TICKETS_IMPORT_LINEAR.csv`
- Trello CSV: `KORA_MOTION26_TICKETS_IMPORT_TRELLO.csv`

Combined Master (Weeks 1-6 + Growth Pack, 66 tickets):
- Generic CSV: `KORA_GROWTH_TICKETS_IMPORT_MASTER.csv`
- Jira CSV: `KORA_GROWTH_TICKETS_IMPORT_MASTER_JIRA.csv`
- Linear CSV: `KORA_GROWTH_TICKETS_IMPORT_MASTER_LINEAR.csv`
- Trello CSV: `KORA_GROWTH_TICKETS_IMPORT_MASTER_TRELLO.csv`

Combined Master Motion (Weeks 1-6 + Growth + UX26 + Motion26, 74 tickets):
- Generic CSV: `KORA_GROWTH_TICKETS_IMPORT_MASTER_MOTION.csv`
- Jira CSV: `KORA_GROWTH_TICKETS_IMPORT_MASTER_MOTION_JIRA.csv`
- Linear CSV: `KORA_GROWTH_TICKETS_IMPORT_MASTER_MOTION_LINEAR.csv`
- Trello CSV: `KORA_GROWTH_TICKETS_IMPORT_MASTER_MOTION_TRELLO.csv`

## Jira

1. Go to Jira settings import for external CSV.
2. Upload `WEEK1_TICKETS_IMPORT_JIRA.csv`.
3. Map fields:
   - `Summary` -> Summary
   - `Issue Type` -> Issue Type
   - `Priority` -> Priority
   - `Status` -> Status
   - `Assignee` -> Assignee
   - `Original Estimate` -> Original estimate
   - `Description` -> Description
   - `Labels` -> Labels
   - `Sprint` -> Sprint (optional)
4. Confirm project and run import.

## Linear

1. Open workspace settings import CSV.
2. Upload `WEEK1_TICKETS_IMPORT_LINEAR.csv`.
3. Map fields:
   - `title` -> Title
   - `description` -> Description
   - `priority` -> Priority
   - `state` -> State
   - `assignee` -> Assignee
   - `estimate` -> Estimate
   - `sprint` -> Cycle (optional)
   - `labels` -> Labels

## Trello

1. Use Trello CSV import power-up or import tool.
2. Upload `WEEK1_TICKETS_IMPORT_TRELLO.csv`.
3. Map fields:
   - `Name` -> Card title
   - `Description` -> Card description
   - `Labels` -> Labels
   - `Members` -> Members
   - `Due Date` -> Due date (optional)
   - `Checklist` -> Checklist items

## Notes

- Assignee names should match your tool user handles or display names.
- If priorities do not map cleanly, remap `P0/P1` manually after import.
- Keep sprint or cycle name aligned with ticket pack source (`Week 1` or `Week 2`).
- For one-shot imports, use `TICKETS_IMPORT_MASTER*` files.
