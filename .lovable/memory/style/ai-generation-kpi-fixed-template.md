# Memory: style/ai-generation-kpi-fixed-template
Updated: now

AI-generated KPI widgets MUST use a fixed, centered layout template. This ensures visual consistency across all KPI widgets regardless of their data source or purpose.

## Fixed KPI Layout Structure:
- **Container**: `flex flex-col items-center justify-center text-center gap-2`
- **Icon**: Top-center, 48x48px (`w-12 h-12 rounded flex items-center justify-center`)
- **Value**: Center, large and bold (`text-3xl md:text-4xl font-bold`)
- **Label**: Center, small and muted (`text-xs text-muted-foreground`)
- **Subtitle**: Bottom, very small (`text-[10px] text-muted-foreground`)

## Icon Color Mapping:
| Type | Icon Background | Icon Color |
|------|----------------|------------|
| Critical/Error | bg-destructive/10 | text-destructive |
| Warning | bg-warning/10 | text-warning |
| Success | bg-success/10 | text-success |
| Info/Neutral | bg-primary/10 | text-primary |

## Prohibited Layouts:
- Flex-row (horizontal) layouts
- Icons on left or right side
- Left or right-aligned values
- `justify-between` (use `justify-center`)
- `text-left` or `text-right` (use `text-center`)
