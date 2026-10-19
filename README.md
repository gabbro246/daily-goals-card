# Daily Goals Card

Daily Goals Card shows whether you reached a daily target directly on your Home Assistant dashboard.

## What it does

Track steps, electricity limits, water use, or any other numeric measurement with a daily goal. The card follows Home Assistant's Energy date selection, so you can move between a single day, week, month, year, or custom date range.

### See progress at a glance

Each day clearly shows whether your goal was met, missed, still in progress, or has no recorded data. You can set a minimum goal, such as walking at least 6,000 steps, or a maximum goal, such as using no more than 10 kWh per day.

![Daily goal day view](docs/day-view.png)

### Review weeks, months, and years

The layout changes automatically for the selected period. Tap a day for its details or select a month to take a closer look.

![Daily goals month view](docs/month-view.png)

![Daily goals year view](docs/year-view.png)

## Install with HACS

Make sure you have [HACS](https://hacs.xyz/) installed in Home Assistant.

[![Open Daily Goals Card in HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=gabbro246&repository=daily-goals-card&category=plugin)

1. Click the button above to open Daily Goals Card and confirm adding the repository if prompted.
2. In HACS, download **Daily Goals Card**.
3. Reload your browser.
4. Edit your dashboard and add the built-in **Energy date selection** card, followed by **Daily Goals Card**.

If the button does not work, add https://github.com/gabbro246/daily-goals-card through HACS > Custom repositories, selecting **Dashboard** as the repository type. Then follow steps 2-4.

## Set up a daily goal

Add the card through Home Assistant's dashboard editor. Select the entity to measure, enter a fixed daily goal or choose an entity containing the goal, and decide how the daily value should be calculated.

For example, this tracks a step counter that resets each day:

```yaml
- type: energy-date-selection
- type: custom:daily-goals-card
  title: Daily steps
  entity: sensor.daily_steps
  goal: 6000
  direction: min
  aggregation: max
```

Use `direction: min` when you want to reach at least the goal. Use `direction: max` when the goal is a limit you do not want to exceed.

Choose the daily calculation that matches your entity:

- `max` for counters that rise during the day and reset daily, such as daily steps.
- `change` for continuously increasing meters, such as a total energy meter.
- `state` for the last recorded value of each day.
- `mean` for the daily average.
- `min` for the lowest value of each day.

### Use a changing goal

Select a goal entity instead of entering a fixed number when your target can change:

```yaml
- type: energy-date-selection
  collection_key: energy_goals
- type: custom:daily-goals-card
  entity: sensor.daily_steps
  goal_entity: input_number.daily_steps_goal
  direction: min
  aggregation: max
  collection_key: energy_goals
```

When you use more than one Energy date selection card, give each pair the same `collection_key`. The key must begin with `energy_`.

## History and recorded data

Daily Goals Card reads Home Assistant's Recorder history and long-term statistics. The selected measurement must be recorded, and long-term views work best with an entity that provides long-term statistics.

Home Assistant normally keeps helper history for a limited time. If you use an `input_number` as a changing goal, older targets may eventually become unavailable. Use a goal sensor with long-term statistics if you want to preserve changing goals for year views.

## Additional information

Found a bug or have a suggestion? Feel free to [open an issue](https://github.com/gabbro246/daily-goals-card/issues).

Daily Goals Card uses Home Assistant's Energy date selection to choose its visible period. Because this relies on an internal frontend feature, a future Home Assistant update may require a card update.

Licensed under the [MIT License](LICENSE).
