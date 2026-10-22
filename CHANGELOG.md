# Changelog

## 0.6.8
- Simplified the one-day graph to show clean stacked areas without lines on top.

## 0.6.7
- Split the one-day graph into colored areas so each measurement's contribution is visible.

## 0.6.6
- Simplified hourly and monthly graph labels.
- Kept long-range graphs in place when selecting a bar.
- Marked minimum goals and maximum limits with directional labels.

## 0.6.5
- Reduced minimum graph markers to a half-width dome.
- Shortened goal summaries into one natural status line.

## 0.6.4
- Made tiny stacked values and missing-data days use a flat-bottomed minimum marker.
- Rounded both ends of the goal line.
- Reduced repeated date labels and kept edge labels visible.

## 0.6.3
- Corrected goal-line dash spacing to match missing-data circles.
- Kept the meeting points between stacked values straight.
- Added small gray markers for past days without data.

## 0.6.2
- Removed horizontal scrolling from month and quarter graph ranges.
- Matched the goal line color and thickness to missing-data circles.

## 0.6.1
- Prevented cards from switching views together while editing a dashboard.
- Rounded bar tops and goal-line dashes.
- Reduced spacing between bars in longer graph ranges.

## 0.6.0
- Added a header button for switching between circles and a simple goal graph.
- Date ranges use outcome-colored bars, while single days show hourly progress as a line.
- Graph selections show the same clear daily details as the circle view.

## 0.5.1
- Expanded single-day views now show the calculation beside the main value without repeating it.

## 0.5.0
- Selected-day details now explain how values were calculated and appear inside the single-day progress oval.
- Range summaries now show the daily goal in plain language.
- Multi-sensor progress bars now have rounded outer ends and clean, straight joins between values.
- Appearance and goal changes now update without unnecessary history reloads or clearing your selection.
- Long date ranges and calendar views now display more efficiently and consistently.

## 0.4.2
- Restored cards that disappeared after updating to 0.4.1.
- Made interrupted history loading restart correctly in Sidebar views.

## 0.4.1
- Fixed history loading getting stuck on Sidebar and other dashboard layouts.
- Prevented date selections from unrelated dashboards affecting the card.
- Made progress outlines lighter across daily, weekly, and compact calendar views.

## 0.4.0
- Added German translations for the card and its settings.
- Made the daily measurement choices easier to understand and compare.

## 0.3.0
- Added separate marker styles for successful, unsuccessful, and no-data days.
- Added a compact grid for choosing day marker styles in the card editor.
- Added an option to start calendars on Sunday.
- Improved current-day sizing, short-range weekday labels, and no-data outlines.
- Empty days now show only a gray dash when their marker style is Symbols.

## 0.2.4
- Increased and standardized progress border thickness across all views.

## 0.2.3
- Added a simple on/off control for the measurement legend.
- Added filled, outlined, and symbol styles for completed days.
- Improved the Last 30 Days layout.
- Unified goal colors, marker sizes, and line thicknesses across views.

## 0.2.2
- Added clearer descriptions for choosing a daily measurement calculation.

## 0.2.1
- Moved goal summaries below the title and added percentage details for selected days.
- Improved progress and status markers, including clearer future and missing-data states.
- Standardized date labels and multi-month layouts.

## 0.2.0
- Added combined goals for multiple measurement entities.
- Added colored current-day progress with a graph-style legend.
- Made the daily progress shape wider.

## 0.1.3
- Added a native-style entity icon beside the card title.
- Made day details available in day, week, month, and year views.
- Fixed dashboard reflow when showing or hiding day details.
- Changed daily progress to a rounded rectangle with straight top and bottom edges.

## 0.1.2
- Kept the daily progress oval correctly proportioned at every card size.
- Added goal summaries to the day and week views.
- Matched Home Assistant typography, spacing, colors, and progress lines more closely.

## 0.1.1
- Simplified the card so goals are easier to read at a glance.
- Fixed progress lines so they begin at the top and move clockwise.

## 0.1.0
- Added daily goal tracking for day, week, month, year, and custom date ranges.
