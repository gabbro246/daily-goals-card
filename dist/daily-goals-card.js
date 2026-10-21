/* Daily Goals Card, a dependency-free Home Assistant Lovelace custom card.
 * Copyright (c) 2026. MIT license.
 */
(() => {
  'use strict';
  const VERSION = '0.6.0';
  const DAY_MS = 86400000;
  const HOUR_MS = 3600000;
  const VIEW_STORAGE_KEY = 'daily-goals-card-view';
  const STATUS_LABELS = {met:'goalMet',missed:'goalMissed',progress:'inProgress','no-data':'noData','no-goal':'goalUnavailable',future:'future'};
  // Share formatters across cards; bound the cache when locales or options change.
  const formatters = new Map();
  const formatter = (type,locale,options={}) => {
    const key=JSON.stringify([type,locale,options]);
    if(!formatters.has(key)){
      const value=new Intl[type](locale,options);
      if(formatters.size>=64)formatters.delete(formatters.keys().next().value);
      formatters.set(key,value);
    }
    return formatters.get(key);
  };
  const TRANSLATIONS = {
    en: {
      rangeTooLong:'Select a range of no more than 750 days.',
      entityIdError:'entity must be an entity ID.', entitiesError:'entities must be a list of entity IDs.', selectEntity:'Select at least one numeric measurement entity.',
      goalEntityError:'goal_entity must be an entity ID.', goalError:'Set a nonnegative goal number or a goal entity.', collectionKeyError:'collection_key must begin with energy_.',
      directionError:'direction must be min or max.', aggregationError:'aggregation must be change, max, min, mean, or state.', finishedStyleError:'finished_style must be filled, outline, or symbols.',
      namedStyleError:'{name} must be filled, outline, or symbols.', weekStartError:'start_week_on_sunday must be true or false.', legendError:'show_legend must be true or false.',
      recorderError:'Could not read Recorder statistics: {error}', noSelection:'No selection', goalMet:'Goal met', goalMissed:'Goal missed', inProgress:'In progress', noData:'No data', goalUnavailable:'Goal unavailable', future:'Future',
      goalIsZero:'Goal is zero', ofLimit:'{value}% of limit', ofGoal:'{value}% of goal', futureDay:'Future day', remaining:'{amount} remaining', atLimit:'At the limit', overLimit:'{amount} over limit', left:'{amount} left', goalReached:'Goal reached', aboveGoal:'{amount} above goal',
      allMonths:'All months', selectMonth:'Select {month}', goalAria:'{value} {unit} goal.', show:'Show', hide:'Hide', measurementEntities:'Measurement entities',
      showChart:'Show graph view', showCircles:'Show circle view', goalLine:'Goal', hourlyUnavailable:'No hourly data', progressChart:'Goal progress',
      summaryOne:'{met} of {total} day met', summaryMany:'{met} of {total} days met', goalMinimumSummary:'Goal: {amount} or more', goalMaximumSummary:'Goal: {amount} or less', dailyGoalsMinimumSummary:'Daily goals: {amount} or more', dailyGoalsMaximumSummary:'Daily goals: {amount} or less', loadingHistory:'Loading history…', unavailable:'Unavailable', dailyTotal:'Daily total',
      directionMin:'At least (minimum)', directionMax:'At most (maximum)',
      formEntities:'Measurement entities', formTitle:'Card title (optional)', formIcon:'Icon (optional)', formGoal:'Fixed daily goal (ignored when goal entity is set)', formGoalEntity:'Daily goal entity (optional)', formDirection:'Goal rule', formAggregation:'Measurement aggregation', formWeekStart:'Start week on Sunday', formLegend:'Show measurement legend', formUnit:'Unit override (optional)', formCollectionKey:'Energy date collection key (optional)',
      successfulDays:'Successful days', unsuccessfulDays:'Unsuccessful days', daysWithoutData:'Days without data', filled:'Filled', outlined:'Outlined', symbols:'Symbols', dayMarkerStyles:'Day marker styles',
      cardName:'Daily Goals', cardDescription:'Daily goals synced with the Energy date picker',
      aggMaxLabel:'Highest value per day', aggMaxDescription:'Uses the highest value recorded during the day. Choose this when a single high reading matters, or when a daily counter only moves upward.',
      aggChangeLabel:'Total change during the day', aggChangeDescription:'Uses how much a continuously increasing meter advanced during the day, rather than its displayed reading. Choose this for a total that carries over from one day to the next.',
      aggStateLabel:'Last value of the day', aggStateDescription:'Uses the most recently recorded value of the day and ignores earlier readings. Choose this when the end-of-day result is what matters.',
      aggMeanLabel:'Average value per day', aggMeanDescription:'Uses the average of the values recorded throughout the day. Choose this when the overall daily level matters more than a brief high or low reading.',
      aggMinLabel:'Lowest value per day', aggMinDescription:'Uses the lowest value recorded during the day. Choose this when a single low reading should determine the result for the whole day.',
      detailMax:'Highest', detailChange:'Total change', detailState:'Last value', detailMean:'Average', detailMin:'Lowest',
    },
    de: {
      rangeTooLong:'Wähle einen Zeitraum von höchstens 750 Tagen aus.',
      entityIdError:'entity muss eine Entitäts-ID sein.', entitiesError:'entities muss eine Liste von Entitäts-IDs sein.', selectEntity:'Wähle mindestens eine numerische Messentität aus.',
      goalEntityError:'goal_entity muss eine Entitäts-ID sein.', goalError:'Lege eine nicht negative Zielzahl oder eine Zielentität fest.', collectionKeyError:'collection_key muss mit energy_ beginnen.',
      directionError:'direction muss min oder max sein.', aggregationError:'aggregation muss change, max, min, mean oder state sein.', finishedStyleError:'finished_style muss filled, outline oder symbols sein.',
      namedStyleError:'{name} muss filled, outline oder symbols sein.', weekStartError:'start_week_on_sunday muss true oder false sein.', legendError:'show_legend muss true oder false sein.',
      recorderError:'Recorder-Statistiken konnten nicht gelesen werden: {error}', noSelection:'Keine Auswahl', goalMet:'Ziel erreicht', goalMissed:'Ziel verfehlt', inProgress:'In Bearbeitung', noData:'Keine Daten', goalUnavailable:'Ziel nicht verfügbar', future:'Zukünftig',
      goalIsZero:'Das Ziel ist null', ofLimit:'{value} % des Limits', ofGoal:'{value} % des Ziels', futureDay:'Zukünftiger Tag', remaining:'{amount} verbleibend', atLimit:'Am Limit', overLimit:'{amount} über dem Limit', left:'Noch {amount}', goalReached:'Ziel erreicht', aboveGoal:'{amount} über dem Ziel',
      allMonths:'Alle Monate', selectMonth:'{month} auswählen', goalAria:'Ziel: {value} {unit}.', show:'Einblenden', hide:'Ausblenden', measurementEntities:'Messentitäten',
      showChart:'Diagrammansicht anzeigen', showCircles:'Kreisansicht anzeigen', goalLine:'Ziel', hourlyUnavailable:'Keine Stundendaten', progressChart:'Zielfortschritt',
      summaryOne:'{met} von {total} Tag erreicht', summaryMany:'{met} von {total} Tagen erreicht', goalMinimumSummary:'Ziel: mindestens {amount}', goalMaximumSummary:'Ziel: höchstens {amount}', dailyGoalsMinimumSummary:'Tagesziele: mindestens {amount}', dailyGoalsMaximumSummary:'Tagesziele: höchstens {amount}', loadingHistory:'Verlauf wird geladen…', unavailable:'Nicht verfügbar', dailyTotal:'Tagessumme',
      directionMin:'Mindestens (Minimum)', directionMax:'Höchstens (Maximum)',
      formEntities:'Messentitäten', formTitle:'Kartentitel (optional)', formIcon:'Symbol (optional)', formGoal:'Festes Tagesziel (wird bei festgelegter Zielentität ignoriert)', formGoalEntity:'Entität für das Tagesziel (optional)', formDirection:'Zielregel', formAggregation:'Messwertberechnung', formWeekStart:'Woche am Sonntag beginnen', formLegend:'Messwertlegende anzeigen', formUnit:'Einheit überschreiben (optional)', formCollectionKey:'Schlüssel der Energie-Zeitraumauswahl (optional)',
      successfulDays:'Erfolgreiche Tage', unsuccessfulDays:'Nicht erfolgreiche Tage', daysWithoutData:'Tage ohne Daten', filled:'Ausgefüllt', outlined:'Umrandet', symbols:'Symbole', dayMarkerStyles:'Darstellung der Tagesmarkierungen',
      cardName:'Tagesziele', cardDescription:'Tagesziele, synchronisiert mit der Energie-Zeitraumauswahl',
      aggMaxLabel:'Höchster Tageswert', aggMaxDescription:'Verwendet den höchsten im Tagesverlauf aufgezeichneten Wert. Wähle diese Option, wenn ein einzelner hoher Messwert entscheidend ist oder ein Tageszähler nur ansteigt.',
      aggChangeLabel:'Gesamtänderung im Tagesverlauf', aggChangeDescription:'Verwendet den Anstieg eines fortlaufenden Zählers im Tagesverlauf statt seines angezeigten Werts. Wähle diese Option für einen Gesamtwert, der von einem Tag zum nächsten übertragen wird.',
      aggStateLabel:'Letzter Tageswert', aggStateDescription:'Verwendet den zuletzt am Tag aufgezeichneten Wert und ignoriert frühere Messwerte. Wähle diese Option, wenn nur das Ergebnis am Tagesende zählt.',
      aggMeanLabel:'Tagesdurchschnitt', aggMeanDescription:'Verwendet den Durchschnitt aller im Tagesverlauf aufgezeichneten Werte. Wähle diese Option, wenn das allgemeine Tagesniveau wichtiger ist als ein kurzer hoher oder niedriger Messwert.',
      aggMinLabel:'Niedrigster Tageswert', aggMinDescription:'Verwendet den niedrigsten im Tagesverlauf aufgezeichneten Wert. Wähle diese Option, wenn ein einzelner niedriger Messwert das Ergebnis des ganzen Tages bestimmen soll.',
      detailMax:'Höchstwert', detailChange:'Gesamtänderung', detailState:'Letzter Wert', detailMean:'Durchschnitt', detailMin:'Tiefstwert',
    },
  };
  const languageCode = (locale) => String(locale||'en').toLowerCase().split(/[-_]/)[0];
  const translate = (locale,key,values={}) => {
    const language=languageCode(locale),template=TRANSLATIONS[language]?.[key]??TRANSLATIONS.en[key]??key;
    return template.replace(/\{(\w+)\}/g,(_,name)=>values[name]??('{'+name+'}'));
  };
  const AGGREGATIONS=[
    {value:'max',labelKey:'aggMaxLabel',descriptionKey:'aggMaxDescription',detailKey:'detailMax'},
    {value:'change',labelKey:'aggChangeLabel',descriptionKey:'aggChangeDescription',detailKey:'detailChange'},
    {value:'state',labelKey:'aggStateLabel',descriptionKey:'aggStateDescription',detailKey:'detailState'},
    {value:'mean',labelKey:'aggMeanLabel',descriptionKey:'aggMeanDescription',detailKey:'detailMean'},
    {value:'min',labelKey:'aggMinLabel',descriptionKey:'aggMinDescription',detailKey:'detailMin'},
  ];
  const VALID_AGG=new Set(AGGREGATIONS.map(({value})=>value));
  const localizedAggregationOptions=(locale)=>AGGREGATIONS.map(({value,labelKey,descriptionKey})=>({
    value,label:translate(locale,labelKey),description:translate(locale,descriptionKey),
  }));
  const AGGREGATION_OPTIONS=localizedAggregationOptions('en');
  const browserLocale = () => (typeof document!=='undefined'&&document.documentElement?.lang)||(typeof navigator!=='undefined'&&navigator.language)||'en';
  const numeric = (value) => {
    if (value === null || value === undefined || value === '' || value === 'unknown' || value === 'unavailable') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const startKey = (key) => new Date(`${key}T00:00:00Z`);
  const keyPlus = (key, n) => new Date(startKey(key).getTime() + n * DAY_MS).toISOString().slice(0,10);
  const dayDiff = (a, b) => Math.round((startKey(b) - startKey(a)) / DAY_MS);
  const dateParts = (date, zone) => {
    const parts = formatter('DateTimeFormat','en-US', {timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(date);
    const get = (type) => parts.find((x) => x.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  };
  const zonedMidnight = (key, zone) => {
    // Convert a calendar date at 00:00 in HA's time zone to a UTC instant.
    const [year, month, day] = key.split('-').map(Number);
    const intended = Date.UTC(year, month-1, day);
    let value = intended;
    const fmt = formatter('DateTimeFormat','en-US', {
      timeZone: zone, year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'
    });
    for (let i=0; i<3; i++) {
      const parts = fmt.formatToParts(new Date(value));
      const get = (type) => Number(parts.find((p) => p.type === type).value);
      const interpreted = Date.UTC(get('year'),get('month')-1,get('day'),get('hour'),get('minute'),get('second'));
      const correction = intended - interpreted;
      value += correction;
      if (Math.abs(correction) < 1000) break;
    }
    return new Date(value);
  };
  const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();
  const weekOffset = (year, month, day=1, sunday=false) => (new Date(Date.UTC(year,month-1,day)).getUTCDay()+(sunday?0:6))%7;
  const weekdayLabels = (locale,sunday=false) => Array.from({length:7},(_,i)=>
    formatter('DateTimeFormat',locale,{timeZone:'UTC',weekday:'short'}).format(new Date(Date.UTC(2026,0,(sunday?4:5)+i)))
  );
  const makeKeys = (start,end,locale='en') => {
    const count = dayDiff(start,end);
    if (count<0 || count>750) throw new Error(translate(locale,'rangeTooLong'));
    return Array.from({length: count+1}, (_,i)=>keyPlus(start,i));
  };
  const formatValue = (n, locale, digits) => n == null ? '—' : formatter('NumberFormat',locale, {maximumFractionDigits: digits ?? (Number.isInteger(n) ? 0 : 1)}).format(n);
  const measurementEntities = (config) => [...new Set(
    (Array.isArray(config?.entities)?config.entities:(typeof config?.entity==='string'?[config.entity]:[]))
      .filter(id=>typeof id==='string'&&id)
  )];
  const historyConfigKey = (config) => JSON.stringify([
    measurementEntities(config),config?.aggregation||'max',config?.goal_entity||null,
  ]);
  const evaluationConfigKey = (config) => JSON.stringify([
    config?.goal_entity?null:numeric(config?.goal),config?.direction||'min',
  ]);
  const totalParts = (parts) => parts.every(part=>part.value!==null)?parts.reduce((sum,part)=>sum+part.value,0):null;
  const shouldShowLegend = (config) => config?.show_legend === true || (config?.show_legend === undefined && config?.legend === 'show');
  const weekStartsSunday = (config) => config?.start_week_on_sunday === true;
  const FINISHED_STYLES = new Set(['filled','outline','symbols']);
  const finishedStyle = (config) => FINISHED_STYLES.has(config?.finished_style) ? config.finished_style : 'filled';
  const markerStyle = (config,status) => {
    const name=status==='met'?'success_style':status==='missed'?'failure_style':['no-data','no-goal'].includes(status)?'no_data_style':null;
    if(name&&FINISHED_STYLES.has(config?.[name]))return config[name];
    if(['met','missed'].includes(status))return finishedStyle(config);
    return ['no-data','no-goal'].includes(status)?'outline':null;
  };
  const unitLabel = (config,hass,entities=measurementEntities(config)) => config.unit || hass?.states?.[entities[0]]?.attributes?.unit_of_measurement || '';
  const stateValue = (state) => numeric(state?.state);
  const dailyFromStats = (rows, aggregation, tz) => {
    const values = new Map();
    for (const row of rows || []) {
      const date = new Date(row.start);
      if (Number.isNaN(date.getTime())) continue;
      const n = numeric(row[aggregation]);
      if (n !== null) values.set(dateParts(date, tz), n);
    }
    return values;
  };
  const hourlyProgressFromStats = (response, entities, aggregation) => {
    const progress = entities.map(entity => {
      const rows=(response?.[entity]||[]).map(row=>({time:new Date(row.start).getTime(),value:numeric(row[aggregation])}))
        .filter(row=>Number.isFinite(row.time)&&row.value!==null).sort((a,b)=>a.time-b.time);
      const values=new Map();
      let running=null,sum=0,count=0;
      for(const row of rows){
        if(aggregation==='change')running=(running??0)+row.value;
        else if(aggregation==='max')running=running===null?row.value:Math.max(running,row.value);
        else if(aggregation==='min')running=running===null?row.value:Math.min(running,row.value);
        else if(aggregation==='mean'){sum+=row.value;count++;running=sum/count}
        else running=row.value;
        values.set(row.time+HOUR_MS,running);
      }
      return values;
    });
    const times=[...new Set(progress.flatMap(values=>[...values.keys()]))].sort((a,b)=>a-b);
    const carry=entities.map(()=>null);
    const points=[];
    for(const time of times){
      progress.forEach((values,index)=>{if(values.has(time))carry[index]=values.get(time)});
      if(carry.some(value=>value===null))continue;
      const parts=entities.map((entity,index)=>({entity,value:carry[index]}));
      points.push({time,value:totalParts(parts),parts});
    }
    return points;
  };
  const hourlyProgressFromHistory = (byEntity, entities, aggregation, start, end) => {
    const series=entities.map(entity=>(byEntity.get(entity)||[]).map(state=>({
      time:new Date(state.last_updated||state.last_changed).getTime(),value:numeric(state.state),
    })).filter(sample=>Number.isFinite(sample.time)&&sample.value!==null).sort((a,b)=>a.time-b.time));
    const states=series.map(samples=>{
      let pos=0,previous=null;
      while(pos<samples.length&&(samples[pos].time<start||(aggregation==='change'&&samples[pos].time===start))){
        if(aggregation==='change')previous=samples[pos].value;
        pos++;
      }
      return {samples,pos,previous,running:null,sum:0,count:0};
    });
    const points=[];
    for(let time=start+HOUR_MS;time<=end;time+=HOUR_MS){
      for(const state of states){
        while(state.pos<state.samples.length&&state.samples[state.pos].time<time){
          const value=state.samples[state.pos++].value;
          if(aggregation==='change'){
            if(state.previous!==null)state.running=(state.running??0)+(value>=state.previous?value-state.previous:value);
            state.previous=value;
          }else if(aggregation==='max')state.running=state.running===null?value:Math.max(state.running,value);
          else if(aggregation==='min')state.running=state.running===null?value:Math.min(state.running,value);
          else if(aggregation==='mean'){state.sum+=value;state.count++;state.running=state.sum/state.count}
          else state.running=value;
        }
      }
      if(states.some(state=>state.running===null))continue;
      const parts=entities.map((entity,index)=>({entity,value:states[index].running}));
      points.push({time,value:totalParts(parts),parts});
    }
    return points;
  };
  const dailyFromHistory = (states, aggregation, tz, start, end) => {
    // Recorder history records the initial state plus changes during the period.
    // Do not treat a carried-forward state as evidence of metric activity.
    const series = (states || []).map((s) => ({time: new Date(s.last_updated || s.last_changed), value: numeric(s.state)}))
      .filter((s) => !Number.isNaN(s.time.getTime())).sort((a,b)=>a.time-b.time);
    const out = new Map();
    let carry = null;
    let idx=0;
    for (let key=start; key<=end; key=keyPlus(key,1)) {
      const dayStart=zonedMidnight(key,tz).getTime(), dayEnd=zonedMidnight(keyPlus(key,1),tz).getTime();
      while (idx<series.length && series[idx].time.getTime()<dayStart) { if(series[idx].value!==null) carry=series[idx].value; idx++; }
      const samples=[];
      while (idx<series.length && series[idx].time.getTime()<dayEnd) { if(series[idx].value!==null) samples.push(series[idx].value); idx++; }
      if (!samples.length) continue;
      let value;
      if(aggregation==='max') value=Math.max(...samples);
      else if(aggregation==='min') value=Math.min(...samples);
      else if(aggregation==='mean') value=samples.reduce((a,b)=>a+b,0)/samples.length;
      else if(aggregation==='state') value=samples[samples.length-1];
      else {
        // Total-increasing: add positive deltas, treating a reset as a new start.
        // If we have no baseline, do not invent the missing beginning of the day.
        if (carry===null) continue;
        let previous=carry;value=0;
        for(const next of samples){value += next>=previous ? next-previous : next;previous=next;}
      }
      out.set(key,value);
      carry=samples[samples.length-1];
    }
    return out;
  };
  const goalFromHistory = (states,tz,start,end) => {
    const result=new Map(),ordered=(states||[]).map(s=>({time:new Date(s.last_updated||s.last_changed).getTime(),value:numeric(s.state)}))
      .filter(s=>Number.isFinite(s.time)).sort((a,b)=>a.time-b.time);
    let pos=0,carry=null;
    for(let key=start;key<=end;key=keyPlus(key,1)){
      const endTime=zonedMidnight(keyPlus(key,1),tz).getTime();
      while(pos<ordered.length&&ordered[pos].time<endTime){carry=ordered[pos].value;pos++;}
      if(carry!==null)result.set(key,carry);
    }
    return result;
  };
  const evaluate = (value,goal,direction,key,today) => {
    if(key>today)return 'future';
    if(goal===null || goal<0)return 'no-goal';
    if(value===null)return 'no-data';
    if(direction==='max') {
      if(value>goal)return 'missed';
      return key===today?'progress':'met';
    }
    if(value>=goal)return 'met';
    return key===today?'progress':'missed';
  };
  const getLayout = (keys) => {
    const n=keys.length,first=keys[0],last=keys[n-1];
    if(n===1)return 'day';
    if(n<=14)return 'week';
    if(first.slice(8)==='01' && last===keyPlus(first.slice(0,7)+'-01',daysInMonth(Number(first.slice(0,4)),Number(first.slice(5,7)))-1)) return 'month';
    if(n===31)return 'rolling-month';
    if(first.slice(5)==='01-01' && last.slice(5)==='12-31' && first.slice(0,4)===last.slice(0,4))return 'year';
    if(n<=62)return 'months';
    return 'mini-months';
  };
  const relevantEnergyCollection = (hass, key) => {
    const connection=hass?.connection;if(!connection)return null;
    const names = key ? [`_${key}`] : [hass?.panelUrl ? `_energy_${hass.panelUrl}` : '_energy'];
    for (const name of names) if(connection[name]?.start) return connection[name];
    return null;
  };
  const chartBarWidth = (count) => count<=8?10:count<=31?3:1.5;
  const storedView = () => {
    try{return window.localStorage?.getItem(VIEW_STORAGE_KEY)==='chart'?'chart':'circles'}catch(_err){return 'circles'}
  };
  const storeView = (view) => {try{window.localStorage?.setItem(VIEW_STORAGE_KEY,view)}catch(_err){}};
  const css = `
    :host {
      display:block;
      --goal-color:var(--ha-color-fill-primary-loud-resting,var(--primary-color,#03a9f4));
      --goal-success:var(--ha-color-fill-success-loud-resting,var(--success-color,#43a047));
      --goal-error:var(--ha-color-fill-danger-loud-resting,var(--error-color,#db4437));
      --goal-track:var(--ha-color-border-neutral-quiet,var(--divider-color,rgba(120,120,120,.20)));
      --goal-muted:var(--ha-color-text-secondary,var(--secondary-text-color,#777));
      --goal-unavailable:var(--state-unavailable-color,var(--disabled-text-color,#bdbdbd));
      --goal-ink:var(--ha-color-text-primary,var(--primary-text-color,#212121));
      --goal-on-success:var(--ha-color-on-success-loud,var(--text-primary-color,#fff));
      --goal-on-error:var(--ha-color-on-danger-loud,var(--text-primary-color,#fff));
      --goal-on-unavailable:var(--card-background-color,#fff);
      --goal-focus:var(--ha-color-focus,var(--primary-color,#03a9f4));
      --goal-icon-background:var(--ha-color-fill-primary-quiet-resting,rgba(3,169,244,.12));
    }
    ha-card{overflow:hidden;color:var(--goal-ink)}
    .subtitle,.weekday,.month-button,.series-legend li,.detail{font-size:var(--ha-font-size-s,12px);font-weight:var(--ha-font-weight-normal,400);line-height:var(--ha-line-height-condensed,1.2);letter-spacing:.4px;}
    .header{display:flex;align-items:center;gap:10px;min-height:56px;padding:0 10px;min-width:0;box-sizing:border-box}
    .header-icon{display:grid;place-items:center;width:36px;height:36px;flex:0 0 36px;border-radius:var(--ha-border-radius-pill,18px);background:var(--goal-icon-background);color:var(--goal-color)}
    .header-icon ha-state-icon{--mdc-icon-size:24px}
    .header-info{min-width:0;flex:1}
    .view-toggle{flex:0 0 auto;color:var(--goal-muted);--ha-icon-button-size:48px;margin-inline-end:-6px}
    .view-toggle ha-icon{--mdc-icon-size:24px}
    .name{font-size:var(--ha-font-size-m,14px);font-weight:var(--ha-font-weight-medium,500);line-height:var(--ha-line-height-normal,1.6);letter-spacing:.1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .subtitle{color:var(--goal-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .body{padding:var(--ha-space-3,12px) 10px 10px;min-width:0}
    .fill{width:100%;max-width:500px;margin:0 auto}
    .oval{width:min(100%,460px);aspect-ratio:5 / 2;margin:0 auto;position:relative;display:grid;place-items:center;color:var(--goal-color);border:0;background:transparent;padding:0;font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
    .oval.met{color:var(--goal-success)}
    .oval.missed{color:var(--goal-error)}
    .oval.no-data,.oval.no-goal,.oval.future{color:var(--goal-track)}
    .oval svg{width:100%;height:100%;position:absolute;inset:0;overflow:visible}
    .oval .track{stroke:var(--goal-track)}
    .oval .value{stroke:currentColor;stroke-linecap:round}
    .series-value{fill:none;stroke-linecap:butt;transition:opacity 180ms ease-in-out}
    .series-cap{fill:none;stroke-linecap:round;transition:opacity 180ms ease-in-out}
    .series-value.hidden,.series-cap.hidden{opacity:0}
    .oval-content{display:flex;flex-direction:column;align-items:center;position:relative;z-index:1}
    .oval-text{display:flex;align-items:baseline;gap:var(--ha-space-1,4px)}
    .oval-text .calculation{font-size:var(--ha-font-size-m,14px);font-weight:var(--ha-font-weight-medium,500);line-height:var(--ha-line-height-normal,1.6);letter-spacing:.1px;color:var(--goal-ink)}
    .oval-text .measurement{font-size:var(--ha-font-size-3xl,28px);font-weight:var(--ha-font-weight-normal,400);line-height:var(--ha-line-height-condensed,1.2);letter-spacing:0}
    .oval-text .unit{font-size:var(--ha-font-size-m,14px);font-weight:var(--ha-font-weight-normal,400);line-height:var(--ha-line-height-condensed,1.2);color:var(--goal-muted)}
    .strip,.month-grid,.mini-grid{display:grid;grid-template-columns:repeat(var(--day-columns,7),minmax(0,1fr));gap:var(--day-gap,var(--ha-space-2,8px) 2px);place-items:center;width:100%;max-width:var(--grid-width,500px);margin:0 auto}
    .weekday,.month-button{color:var(--goal-muted)}
    .dot{border:3px solid var(--goal-track);background:transparent;color:var(--goal-muted);border-radius:var(--ha-border-radius-circle,50%);display:grid;place-items:center;position:relative;width:32px;height:32px;padding:0;box-sizing:border-box;font-family:inherit;font-size:var(--ha-font-size-s,12px);font-weight:var(--ha-font-weight-normal,400);line-height:1;cursor:pointer}
    .dot > span{position:relative;z-index:1}
    .oval:focus-visible,.dot:focus-visible,.mini-dot:focus-visible,.month-button:focus-visible,.drillback:focus-visible{outline:2px solid var(--goal-focus);outline-offset:2px}
    .dot[aria-pressed=true]{box-shadow:0 0 0 2px var(--card-background-color,#fff),0 0 0 4px var(--goal-focus)}
    .dot.met,.mini-dot.met{--marker-color:var(--goal-success);--marker-ink:var(--goal-on-success)}
    .dot.missed,.mini-dot.missed{--marker-color:var(--goal-error);--marker-ink:var(--goal-on-error)}
    .dot.met,.dot.missed,.mini-dot.met::after,.mini-dot.missed::after{background:var(--marker-color);border-color:var(--marker-color);color:var(--marker-ink)}
    .dot.marker-outline,.mini-dot.marker-outline::after{background:transparent;border-color:var(--marker-color);color:var(--marker-color)}
    .dot.marker-symbols{background:transparent;border-color:transparent;color:var(--marker-color,var(--goal-unavailable))}
    .dot.marker-symbols > span{font-size:18px;font-weight:var(--ha-font-weight-bold,700)}
    .dot.progress,.dot.multi-current{border-width:0}
    .dot.no-data,.dot.no-goal{border:0;color:var(--goal-unavailable)}
    .dot.no-data.marker-filled,.dot.no-goal.marker-filled{background:var(--goal-unavailable);border:3px solid var(--goal-unavailable);color:var(--goal-on-unavailable)}
    .dot.no-data.marker-symbols,.dot.no-goal.marker-symbols{background:transparent;border:0;color:var(--goal-unavailable)}
    .dot.future{border-color:var(--goal-unavailable);color:var(--goal-unavailable)}
    .dot.multi-current{background:transparent;border-color:transparent;color:var(--goal-muted)}
    .progress-ring,.unavailable-ring{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
    .progress-ring .track{fill:none;stroke:var(--goal-track)}
    .progress-ring .value{fill:none;stroke:var(--goal-color);stroke-linecap:round}
    .progress-ring .series-value,.progress-ring .series-cap{fill:none}
    .unavailable-ring circle{fill:none;stroke:var(--goal-unavailable);stroke-linecap:round}
    .month-grid{--grid-width:430px}
    .month-collection{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--ha-space-4,16px) var(--ha-space-2,8px);width:100%}
    .mini-month{padding:0;min-width:0}
    .month-button{display:block;width:100%;border:0;background:none;padding:0;text-align:left;font-family:inherit;margin:0 0 var(--ha-space-2,8px);cursor:pointer}
    .mini-grid{--day-gap:var(--ha-space-1,4px) 2px;max-width:none}
    .mini-dot{position:relative;width:12px;height:12px;border:0;background:transparent;padding:0;border-radius:var(--ha-border-radius-circle,50%);box-sizing:border-box;cursor:pointer}
    .mini-dot::after{content:"";position:absolute;inset:0;border:1.5px solid var(--goal-track);border-radius:inherit;box-sizing:border-box}
    .mini-dot.marker-symbols::after{inset:0;border:0;background:transparent;display:grid;place-items:center;font-size:11px;font-weight:var(--ha-font-weight-bold,700);line-height:1}
    .mini-dot.met.marker-symbols::after{content:"\\2713";color:var(--goal-success)}
    .mini-dot.missed.marker-symbols::after{content:"\\00d7";color:var(--goal-error)}
    .mini-dot.progress::after{border:0}
    .mini-dot.no-data::after,.mini-dot.no-goal::after{border:0}
    .mini-dot.no-data.marker-filled::after,.mini-dot.no-goal.marker-filled::after{background:var(--goal-unavailable);border-color:var(--goal-unavailable);border-style:solid}
    .mini-dot.no-data.marker-symbols::after,.mini-dot.no-goal.marker-symbols::after{content:"\\2013";color:var(--goal-unavailable)}
    .mini-dot.future::after{border-color:var(--goal-unavailable)}
    .mini-dot.multi-current::after{background:transparent;border:0}
    .mini-dot[aria-pressed=true]{box-shadow:inset 0 0 0 1px var(--goal-focus)}
    .mini-dot .progress-ring,.mini-dot .unavailable-ring{inset:0;width:12px;height:12px}
    .many-months{max-height:320px;overflow:auto;width:100%;padding:0;box-sizing:border-box}
    .many-months.unscrolled{max-height:none;overflow:visible}
    .many-months .mini-grid{--day-gap:3px 1px}
    .drillback{display:flex;align-items:center;border:0;background:transparent;color:var(--goal-color);padding:0 0 var(--ha-space-3,12px);cursor:pointer;font:inherit;font-size:var(--ha-font-size-s,12px);font-weight:var(--ha-font-weight-medium,500);line-height:var(--ha-line-height-condensed,1.2)}
    .series-legend{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--ha-space-2,8px) var(--ha-space-4,16px);list-style:none;margin:var(--ha-space-3,12px) 0 0;padding:0}
    .series-legend li{display:flex;align-items:center;min-width:0}
    .legend-toggle,.legend-label{border:0;background:transparent;font:inherit;padding:0;cursor:pointer}
    .legend-toggle{display:grid;place-items:center;width:24px;height:24px;margin-inline-end:2px;color:var(--series-color)}
    .legend-toggle.static{cursor:default}
    .legend-toggle.static .legend-marker::after{content:""}
    .legend-marker{display:grid;place-items:center;width:14px;height:14px;border:2px solid currentColor;border-radius:50%;box-sizing:border-box;background:currentColor}
    .legend-marker::after{content:"✓";color:var(--card-background-color,#fff);font-size:9px;font-weight:700;line-height:1}
    .series-legend li.hidden .legend-marker{background:transparent;color:var(--goal-muted)}
    .series-legend li.hidden .legend-marker::after{content:""}
    .series-legend li.hidden .legend-label,.series-legend li.hidden .legend-value{opacity:.55}
    .legend-label{max-width:150px;color:var(--goal-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .legend-value{margin-inline-start:var(--ha-space-1,4px);color:var(--goal-muted);white-space:nowrap}
    .legend-toggle:focus-visible,.legend-label:focus-visible{outline:2px solid var(--goal-focus);outline-offset:1px;border-radius:var(--ha-border-radius-sm,4px)}
    .chart-scroll{width:100%;overflow-x:auto;overflow-y:hidden;overscroll-behavior-inline:contain}
    .chart-canvas{position:relative;height:178px;min-width:0;margin:0 auto}
    .status-chart{position:absolute;inset:0 0 auto;width:100%;height:150px;overflow:visible}
    .chart-goal{fill:none;stroke:var(--goal-muted);stroke-width:2;stroke-dasharray:5 4;vector-effect:non-scaling-stroke;opacity:.7}
    .chart-goal-label{position:absolute;right:2px;z-index:2;transform:translateY(-100%);padding-inline-start:4px;background:var(--card-background-color,#fff);color:var(--goal-muted);font-size:var(--ha-font-size-s,12px);line-height:1;pointer-events:none}
    .chart-axis-label{position:absolute;top:157px;transform:translateX(-50%);color:var(--goal-muted);font-size:var(--ha-font-size-s,12px);line-height:1;white-space:nowrap;pointer-events:none}
    .chart-day-hit{position:absolute;top:0;height:150px;border:0;background:transparent;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
    .chart-day-hit::after{content:"";position:absolute;left:50%;bottom:1px;width:12px;height:2px;border-radius:1px;transform:translateX(-50%);background:transparent}
    .chart-day-hit:focus-visible{outline:none}.chart-day-hit:focus-visible::after,.chart-day-hit[aria-pressed=true]::after{background:var(--goal-focus)}
    .chart-bar{stroke-linecap:butt;vector-effect:non-scaling-stroke}
    .chart-bar.met{stroke:var(--goal-success)}
    .chart-bar.missed{stroke:var(--goal-error)}
    .chart-bar.progress{stroke:var(--goal-color)}
    .chart-bar.no-data,.chart-bar.no-goal,.chart-bar.future{stroke:var(--goal-unavailable)}
    .chart-stack{stroke-linecap:butt;vector-effect:non-scaling-stroke;transition:opacity 180ms ease-in-out}
    .chart-stack.hidden{opacity:0}
    .chart-missing{stroke:var(--goal-unavailable);stroke-width:1.5;stroke-linecap:round;vector-effect:non-scaling-stroke}
    .chart-line{fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
    .chart-empty{height:178px;display:grid;place-items:center;color:var(--goal-muted);font-size:var(--ha-font-size-s,12px)}
    .detail{display:block;margin-top:var(--ha-space-3,12px);text-align:center;color:var(--goal-muted)}
    .oval-detail{margin-top:var(--ha-space-1,4px)}
    .detail strong{color:var(--goal-ink);font-size:var(--ha-font-size-m,14px);font-weight:var(--ha-font-weight-medium,500);line-height:var(--ha-line-height-normal,1.6);letter-spacing:.1px}
    .muted{color:var(--goal-muted);font-size:var(--ha-font-size-s,12px);font-weight:var(--ha-font-weight-normal,400);line-height:var(--ha-line-height-condensed,1.2);text-align:center}
    .error{color:var(--goal-error);font-size:var(--ha-font-size-s,12px);font-weight:var(--ha-font-weight-normal,400);line-height:var(--ha-line-height-normal,1.6);text-align:center;padding:var(--ha-space-4,16px)}
    @media(max-width:340px){.month-collection{gap:var(--ha-space-3,12px) var(--ha-space-1,4px)}.mini-grid{--day-gap:3px 1px}}
  `;

  class DailyGoalsCard extends HTMLElement {
    constructor(){
      super();this.attachShadow({mode:'open'});
      this._config=null;this._hass=null;this._period=null;this._signature='';this._sourceSignature='';this._selected=null;this._selectedMonth=null;
      this._days=[];this._loading=false;this._error='';this._clock=Date.now();this._fetchId=0;this._timer=null;this._resizeObserver=null;this._lastHeight=0;this._hiddenEntities=new Set();this._restartOnConnect=false;this._viewMode=storedView();
      this._hourly=[];this._hourlyKey='';this._hourlyLoading=false;this._hourlyError='';this._hourlyFetchId=0;this._restartHourlyOnConnect=false;
      this.shadowRoot.innerHTML=`<style>${css}</style><ha-card><div id="content"></div></ha-card>`;
      this.shadowRoot.addEventListener('click', (e)=>{
        const btn=e.target.closest('[data-day],[data-month],[data-toggle-entity],[data-more-info],[data-view-toggle]');if(!btn)return;
        if(btn.dataset.viewToggle!==undefined){
          this._viewMode=this._viewMode==='chart'?'circles':'chart';storeView(this._viewMode);
          this._render();
          if(this._viewMode==='chart'&&this._period?.start===this._period?.end)this._loadHourly();
          return;
        }
        if(btn.dataset.toggleEntity){
          const id=btn.dataset.toggleEntity;
          if(this._hiddenEntities.has(id))this._hiddenEntities.delete(id);else this._hiddenEntities.add(id);
          this._render();return;
        }
        if(btn.dataset.moreInfo){this.dispatchEvent(new CustomEvent('hass-more-info',{detail:{entityId:btn.dataset.moreInfo},bubbles:true,composed:true}));return;}
        if(btn.dataset.day) this._selected=this._selected===btn.dataset.day?null:btn.dataset.day;
        if(btn.dataset.month){this._selectedMonth=btn.dataset.month==='all' ? null : btn.dataset.month;this._selected=null;}
        this._render();
      });
    }
    static getConfigElement(){return document.createElement('daily-goals-card-editor')}
    static getStubConfig(hass,entities=[]){
      const pick=entities.find(e=>e.startsWith('sensor.'))||'sensor.daily_steps';
      return {type:'custom:daily-goals-card',entities:[pick],goal:6000,direction:'min',aggregation:'max',success_style:'filled',failure_style:'filled',no_data_style:'outline',start_week_on_sunday:false,show_legend:false};
    }
    setConfig(config){
      if(config?.entity!==undefined&&typeof config.entity!=='string')throw new Error(this._t('entityIdError'));
      if(config?.entities!==undefined&&(!Array.isArray(config.entities)||config.entities.some(id=>typeof id!=='string')))throw new Error(this._t('entitiesError'));
      if(!measurementEntities(config).length)throw new Error(this._t('selectEntity'));
      if(config.goal_entity && typeof config.goal_entity!=='string') throw new Error(this._t('goalEntityError'));
      if(!config.goal_entity && (numeric(config.goal)===null||numeric(config.goal)<0))throw new Error(this._t('goalError'));
      if(config.collection_key && !config.collection_key.startsWith('energy_'))throw new Error(this._t('collectionKeyError'));
      if(config.direction && !['min','max'].includes(config.direction))throw new Error(this._t('directionError'));
      if(config.aggregation && !VALID_AGG.has(config.aggregation))throw new Error(this._t('aggregationError'));
      if(config.finished_style && !FINISHED_STYLES.has(config.finished_style))throw new Error(this._t('finishedStyleError'));
      for(const name of ['success_style','failure_style','no_data_style'])if(config[name]&&!FINISHED_STYLES.has(config[name]))throw new Error(this._t('namedStyleError',{name}));
      if(config.start_week_on_sunday!==undefined && typeof config.start_week_on_sunday!=='boolean')throw new Error(this._t('weekStartError'));
      if(config.show_legend!==undefined && typeof config.show_legend!=='boolean')throw new Error(this._t('legendError'));
      const previous=this._config;
      const historyChanged=!previous||historyConfigKey(config)!==historyConfigKey(previous);
      const periodChanged=!previous||(config.collection_key||null)!==(previous.collection_key||null);
      const evaluationChanged=!previous||evaluationConfigKey(config)!==evaluationConfigKey(previous);
      this._config={...config};
      if(historyChanged||periodChanged){
        this._signature='';this._sourceSignature='';this._selected=null;this._selectedMonth=null;this._hiddenEntities.clear();this._hourly=[];this._hourlyKey='';this._hourlyError='';
        this._hourlyFetchId++;
        this._syncPeriod(true);
      } else if(evaluationChanged)this._rebuildDays();
      this._render();
    }
    set hass(hass){
      const old=this._hass;this._hass=hass;
      if(!hass)return;
      const prevZone=old?.config?.time_zone,localeChanged=old?.locale?.language!==hass.locale?.language;
      this._syncPeriod(prevZone!==hass.config?.time_zone);
      // A sensor's live value can change before Recorder's next hourly result.
      const measurementChanged=measurementEntities(this._config).some(id=>hass.states?.[id]?.last_updated!==old?.states?.[id]?.last_updated);
      const goal=hass.states?.[this._config?.goal_entity],priorGoal=old?.states?.[this._config?.goal_entity];
      if(localeChanged||measurementChanged||goal?.last_updated!==priorGoal?.last_updated){this._mergeCurrentDay();this._render()}
    }
    connectedCallback(){
      const restart=this._restartOnConnect;this._restartOnConnect=false;
      const restartHourly=this._restartHourlyOnConnect;this._restartHourlyOnConnect=false;
      this._syncPeriod(restart);
      if(!restart&&restartHourly&&this._viewMode==='chart'&&this._period?.start===this._period?.end)this._loadHourly(true);
      this._observeSize();
      this._timer=setInterval(()=>{
        this._syncPeriod();
        const now=new Date().getTime();
        if(now-this._clock>300000){this._clock=now;const today=dateParts(new Date(),this._tz());if(this._period?.start<=today&&this._period?.end>=today)this._load();else {this._mergeCurrentDay();this._render();}}
      },1100);
    }
    disconnectedCallback(){this._restartOnConnect=this._restartOnConnect||this._loading;this._restartHourlyOnConnect=this._restartHourlyOnConnect||this._hourlyLoading;clearInterval(this._timer);this._timer=null;this._fetchId++;this._hourlyFetchId++;this._loading=false;this._hourlyLoading=false;this._resizeObserver?.disconnect();this._resizeObserver=null}
    getCardSize(){
      const height=this.shadowRoot?.querySelector?.('ha-card')?.offsetHeight;
      return height?Math.max(1,Math.ceil(height/50)):5;
    }
    getGridOptions(){return {columns:12,min_columns:9}}
    _observeSize(){
      if(this._resizeObserver||typeof ResizeObserver==='undefined')return;
      const card=this.shadowRoot?.querySelector?.('ha-card');if(!card)return;
      this._resizeObserver=new ResizeObserver((entries)=>{
        const height=Math.round(entries[0]?.contentRect?.height||card.offsetHeight||0);
        if(!height||height===this._lastHeight)return;
        this._lastHeight=height;
        this.dispatchEvent(new CustomEvent('card-updated',{bubbles:true,composed:true}));
      });
      this._resizeObserver.observe(card);
    }
    _tz(){return this._hass?.config?.time_zone||formatter('DateTimeFormat',undefined).resolvedOptions().timeZone||'UTC'}
    _locale(){return this._hass?.locale?.language||browserLocale()}
    _t(key,values){return translate(this._locale(),key,values)}
    _syncPeriod(force=false){
      if(!this._config||!this._hass)return;
      const col=relevantEnergyCollection(this._hass,this._config.collection_key);
      const tz=this._tz();const now=new Date();
      const from=col?.start instanceof Date ? col.start : col?.start ? new Date(col.start) : now;
      const to=col?.end instanceof Date ? col.end : col?.end ? new Date(col.end) : from;
      if(Number.isNaN(from.getTime())||Number.isNaN(to.getTime()))return;
      let a,b,sourceSignature;
      if(col){
        sourceSignature=`collection/${from.getTime()}/${to.getTime()}/${tz}`;
        if(!force&&sourceSignature===this._sourceSignature)return;
        a=dateParts(from,tz);b=dateParts(to,tz);
      } else {
        a=dateParts(now,tz);b=a;sourceSignature=`today/${a}/${tz}`;
        if(!force&&sourceSignature===this._sourceSignature)return;
      }
      this._sourceSignature=sourceSignature;
      const signature=`${a}/${b}/${tz}`;
      if(!force && signature===this._signature)return;
      this._signature=signature;this._period={start:a,end:b};this._selected=null;this._selectedMonth=null;this._hourly=[];this._hourlyKey='';this._hourlyError='';
      this._hourlyFetchId++;
      this._load();
    }
    async _load(){
      const seq=++this._fetchId, period=this._period, hass=this._hass, config=this._config;
      if(!period||!hass||!config)return;
      let keys;
      try {keys=makeKeys(period.start,period.end,this._locale())}catch(err){this._error=err.message;this._days=[];this._render();return}
      this._days=keys.map(key=>({key,value:null,goal:null,status:'no-data',parts:[]}));
      this._clock=Date.now();this._loading=true;this._error='';this._render();
      const tz=this._tz(),start=zonedMidnight(period.start,tz),end=zonedMidnight(keyPlus(period.end,1),tz);
      try {
        const entityIds=measurementEntities(config);
        const ids=[...entityIds,...(config.goal_entity?[config.goal_entity]:[])];
        const response=await hass.callWS({type:'recorder/statistics_during_period',start_time:start.toISOString(),end_time:end.toISOString(),period:'day',statistic_ids:[...new Set(ids)],types:['change','mean','max','min','state']});
        if(seq!==this._fetchId)return;
        const agg=config.aggregation||'max';
        const metrics=new Map(entityIds.map(id=>[id,dailyFromStats(response?.[id],agg,tz)]));
        let targets=new Map();
        if(config.goal_entity){
          // Historical state is the preferred goal value. For measurement sensors
          // that only expose mean, use mean as an approximate daily threshold.
          const goalStats=response?.[config.goal_entity]||[];
          targets=dailyFromStats(goalStats,'state',tz);
          for(const [key,val] of dailyFromStats(goalStats,'mean',tz))if(!targets.has(key))targets.set(key,val);
        }
        // Recorder's REST history fills recent gaps, especially input_number goals.
        // Restrict to recent history to avoid querying years of state changes.
        const today=dateParts(new Date(),tz),recentStart=keyPlus(today,-10);
        const histStart=period.start>recentStart?period.start:recentStart;
        const histEnd=period.end<today?period.end:today;
        if(histStart<=histEnd && typeof hass.callApi==='function'){
          const begin=zonedMidnight(histStart,tz).toISOString();
          const until=zonedMidnight(keyPlus(histEnd,1),tz).toISOString();
          const url=`history/period/${encodeURIComponent(begin)}?filter_entity_id=${encodeURIComponent(ids.join(','))}&end_time=${encodeURIComponent(until)}&no_attributes=1`;
          try {
            const hist=await hass.callApi('GET',url);
            if(seq!==this._fetchId)return;
            const byEntity=new Map();
            for(const items of hist||[])if(items?.[0]?.entity_id)byEntity.set(items[0].entity_id,items);
            for(const id of entityIds){
              const metric=metrics.get(id);
              const fallback=dailyFromHistory(byEntity.get(id),agg,tz,histStart,histEnd);
              for(const [key,val] of fallback)if(!metric.has(key))metric.set(key,val);
            }
            if(config.goal_entity){
              const gh=goalFromHistory(byEntity.get(config.goal_entity),tz,histStart,histEnd);
              for(const [key,val] of gh)targets.set(key,val);
            }
          }catch(err){console.warn('daily-goals-card: recent history not available',err)}
        }
        if(seq!==this._fetchId)return;
        this._metrics=metrics;this._targets=targets;this._rebuildDays();this._loading=false;this._render();
        if(keys.length===1&&this._viewMode==='chart')this._loadHourly(true);
      }catch(err){
        if(seq!==this._fetchId)return;
        this._loading=false;this._error=this._t('recorderError',{error:err?.message||err});
        this._render();
      }
    }
    async _loadHourly(force=false){
      const period=this._period,hass=this._hass,config=this._config;
      if(!period||period.start!==period.end||!hass||!config)return;
      const key=`${period.start}/${this._tz()}/${historyConfigKey(config)}`;
      if(!force&&key===this._hourlyKey&&(this._hourlyLoading||!this._hourlyError))return;
      const seq=++this._hourlyFetchId;
      this._hourlyKey=key;this._hourly=[];this._hourlyLoading=true;this._hourlyError='';this._render();
      const start=zonedMidnight(period.start,this._tz()),end=zonedMidnight(keyPlus(period.end,1),this._tz());
      const entityIds=measurementEntities(config);
      try{
        let response={},statisticsError=null;
        try{
          response=await hass.callWS({type:'recorder/statistics_during_period',start_time:start.toISOString(),end_time:end.toISOString(),period:'hour',statistic_ids:entityIds,types:['change','mean','max','min','state']});
        }catch(err){statisticsError=err;console.warn('daily-goals-card: hourly statistics not available',err)}
        if(seq!==this._hourlyFetchId)return;
        this._hourly=hourlyProgressFromStats(response,entityIds,config.aggregation||'max');
        if(!this._hourly.length&&typeof hass.callApi==='function'){
          const url=`history/period/${encodeURIComponent(start.toISOString())}?filter_entity_id=${encodeURIComponent(entityIds.join(','))}&end_time=${encodeURIComponent(end.toISOString())}&no_attributes=1`;
          const history=await hass.callApi('GET',url);
          if(seq!==this._hourlyFetchId)return;
          const byEntity=new Map();
          for(const items of history||[])if(items?.[0]?.entity_id)byEntity.set(items[0].entity_id,items);
          this._hourly=hourlyProgressFromHistory(byEntity,entityIds,config.aggregation||'max',start.getTime(),end.getTime());
        }
        if(!this._hourly.length&&statisticsError)this._hourlyError=String(statisticsError?.message||statisticsError);
        this._hourlyLoading=false;this._render();
      }catch(err){
        if(seq!==this._hourlyFetchId)return;
        this._hourlyLoading=false;this._hourlyError=String(err?.message||err);
        console.warn('daily-goals-card: hourly history not available',err);this._render();
      }
    }
    _rebuildDays(){
      if(!this._period||!this._config||!this._hass)return;
      const config=this._config,zone=this._tz(),today=dateParts(new Date(),zone),goalFixed=numeric(config.goal);
      const entityIds=measurementEntities(config);
      this._days=this._days.map(({key})=>{
        const parts=entityIds.map(entity=>{
          const metric=this._metrics?.get(entity);
          return {entity,value:metric?.has(key)?metric.get(key):null};
        });
        const value=totalParts(parts);
        const goal=config.goal_entity?(this._targets?.get(key)??null):goalFixed;
        return {key,value,goal,parts,status:evaluate(value,goal,config.direction||'min',key,today)};
      });
      this._mergeCurrentDay();
    }
    _mergeCurrentDay(){
      if(!this._days?.length||!this._config||!this._hass)return;
      const today=dateParts(new Date(),this._tz());
      const row=this._days.find(d=>d.key===today);
      if(!row)return;
      const entityIds=measurementEntities(this._config);
      const existing=new Map((row.parts||[]).map(part=>[part.entity,part.value]));
      // Only use live state for daily snapshots (max, state, min), not cumulative
      // 'change' meters or averages, where entity state has different semantics.
      const agg=this._config.aggregation||'max';
      row.parts=entityIds.map(entity=>{
        const n=stateValue(this._hass.states?.[entity]);
        let value=existing.get(entity)??null;
        if(n!==null&&['max','min','state'].includes(agg)){
          if(agg==='max')value=Math.max(value??n,n);
          else if(agg==='min')value=Math.min(value??n,n);
          else value=n;
        }
        return {entity,value};
      });
      row.value=totalParts(row.parts);
      if(this._config.goal_entity){
        const goal=stateValue(this._hass.states?.[this._config.goal_entity]);
        if(goal!==null)row.goal=goal;
      }
      row.status=evaluate(row.value,row.goal,this._config.direction||'min',row.key,today);
    }
    _entities(){return this._renderContext?.entities??measurementEntities(this._config)}
    _today(){return this._renderContext?.today??dateParts(new Date(),this._tz())}
    _unit(){return this._renderContext?.unit??unitLabel(this._config,this._hass,this._entities())}
    _dateLabel(key,options){
      return formatter('DateTimeFormat',this._locale(),{timeZone:'UTC',...options}).format(new Date(`${key}T12:00:00Z`));
    }
    _formatDate(key,monthOnly=false){
      return this._dateLabel(key,monthOnly?{year:'numeric',month:'long'}:{day:'numeric',month:'short',year:'numeric'});
    }
    _weekday(key){return this._dateLabel(key,{weekday:'short'})}
    _format(n){return formatValue(n,this._locale(),this._config?.precision)}
    _label(row){
      if(!row)return this._t('noSelection');
      const key=STATUS_LABELS[row.status];
      return key?this._t(key):row.status;
    }
    _progress(row){
      if(row?.value==null||row?.goal==null)return 0;
      if(row.goal===0)return row.status==='met'?100:0;
      return Math.max(0,Math.min(100,100*row.value/row.goal));
    }
    _percentageText(row){
      if(row?.value==null)return this._t('noData');
      if(row?.goal==null)return this._t('goalUnavailable');
      if(row.goal===0)return this._t('goalIsZero');
      return this._t(this._config?.direction==='max'?'ofLimit':'ofGoal',{value:this._format(100*row.value/row.goal)});
    }
    _dayState(row){
      if(!row||row.status==='future')return this._t('futureDay');
      if(row.value==null)return this._t('noData');
      if(row.goal==null)return this._t('goalUnavailable');
      const unit=this._unit();
      const amount=value=>`${this._format(value)}${unit?` ${unit}`:``}`;
      const remaining=row.goal-row.value;
      if(this._config?.direction==='max'){
        if(remaining>0)return this._t('remaining',{amount:amount(remaining)});
        if(remaining===0)return this._t('atLimit');
        return this._t('overLimit',{amount:amount(-remaining)});
      }
      if(remaining>0)return this._t('left',{amount:amount(remaining)});
      if(remaining===0)return this._t('goalReached');
      return this._t('aboveGoal',{amount:amount(-remaining)});
    }
    _isMultiCurrent(row){
      return this._entities().length>1&&row?.key===this._today()&&(row.parts?.length||0)>1;
    }
    _seriesColor(index){
      const fallback=['#4269d0','#f4bd4a','#ff725c','#6cc5b0','#a463f2','#ff8ab7','#9c6b4e','#97bbf5','#01ab63','#094bad','#c99000','#ff9d3f'];
      const slot=index%fallback.length;
      return `var(--color-${slot+1},${fallback[slot]})`;
    }
    _seriesSegments(row){
      const parts=(row?.parts||[]).map((part,index)=>({...part,index,positive:Math.max(0,part.value??0)}));
      const total=parts.reduce((sum,part)=>sum+part.positive,0);
      const filled=row?.goal>0?Math.min(100,100*total/row.goal):(total>0?100:0);
      let offset=0;
      return parts.map(part=>{
        const length=total?filled*part.positive/total:0;
        const result={...part,length,offset,color:this._seriesColor(part.index),hidden:this._hiddenEntities.has(part.entity)};
        offset+=length;
        return result;
      });
    }
    _ringGeometry(mini=false){
      const size=mini?12:32,stroke=mini?1.5:3,center=size/2;
      return {size,center,attributes:`cx="${center}" cy="${center}" r="${(size-stroke)/2}"`,stroke};
    }
    _stackedSegments(row,tag,attributes){
      const segments=this._seriesSegments(row).filter(segment=>segment.length>0);
      const render=(segment,length,offset,kind)=>`<${tag} class="series-${kind}${segment.hidden?' hidden':''}" ${attributes} pathLength="100" stroke-linecap="${kind==='cap'?'round':'butt'}" stroke-dasharray="${length} ${kind==='cap'?'100':(100-segment.length).toFixed(3)}" stroke-dashoffset="${(-offset).toFixed(3)}" style="stroke:${segment.color}"/>`;
      const values=segments.map(segment=>render(segment,segment.length.toFixed(3),segment.offset,'value')).join('');
      const total=segments.length?segments.at(-1).offset+segments.at(-1).length:0;
      const caps=segments.length&&total<99.999?[[segments[0],0],[segments.at(-1),total]].map(([segment,offset])=>render(segment,0,offset,'cap')).join(''):'';
      return values+caps;
    }
    _stackedRing(row,mini=false){
      const {size,center,attributes,stroke}=this._ringGeometry(mini);
      const segments=this._stackedSegments(row,'circle',`${attributes} stroke-width="${stroke}" transform="rotate(-90 ${center} ${center})"`);
      return `<svg class="progress-ring" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle class="track" ${attributes} stroke-width="${stroke}"/>${segments}</svg>`;
    }
    _stackedPath(row,path){
      return this._stackedSegments(row,'path',`d="${path}" stroke-width="10" fill="none"`);
    }
    _progressRing(pct,mini=false){
      const {size,center,attributes,stroke}=this._ringGeometry(mini);
      return `<svg class="progress-ring" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle class="track" ${attributes} stroke-width="${stroke}"/><circle class="value" ${attributes} pathLength="100" stroke-width="${stroke}" stroke-dasharray="${pct} 100" transform="rotate(-90 ${center} ${center})"/></svg>`;
    }
    _unavailableRing(mini=false){
      const {size,center,attributes,stroke}=this._ringGeometry(mini),pathLength=mini?15:21;
      return `<svg class="unavailable-ring" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle ${attributes} pathLength="${pathLength}" stroke-width="${stroke}" stroke-dasharray="1 2" transform="rotate(-90 ${center} ${center})"/></svg>`;
    }
    _renderDot(row,mini=false){
      if(!row)return '<span></span>';
      const pct=this._progress(row).toFixed(2),multiCurrent=this._isMultiCurrent(row);
      const style=markerStyle(this._config,row.status);
      const unavailable=['no-data','no-goal'].includes(row.status)&&style==='outline';
      const ring=multiCurrent?this._stackedRing(row,mini):(row.status==='progress'?this._progressRing(pct,mini):(unavailable?this._unavailableRing(mini):''));
      const classes=`${mini?'mini-dot':'dot'} ${row.status}${style?` marker-${style}`:''}${multiCurrent?' multi-current':''}`;
      const dayLabel=`${this._formatDate(row.key)}: ${this._label(row)}`;
      const label=mini?dayLabel:`${dayLabel}. ${row.value===null?'':`${this._format(row.value)} ${this._unit()}`}`;
      const symbols={met:'&#10003;',missed:'&times;','no-data':'–','no-goal':'–'};
      const sym=(style==='symbols'||row.status==='no-goal')&&symbols[row.status]?symbols[row.status]:Number(row.key.slice(-2));
      return this._dayButton(row,classes,ring+(mini?'':`<span>${sym}</span>`),label,mini);
    }
    _dayButton(row,classes,content,label,showTitle=false){
      const escapedLabel=escapeHTML(label);
      return `<button type="button" class="${classes}" data-day="${row.key}" aria-pressed="${this._selected===row.key}" aria-label="${escapedLabel}"${showTitle?` title="${escapedLabel}"`:''}>${content}</button>`;
    }
    _view(content){
      return `<div class="fill">${content}${this._selectionDetail()}</div>`;
    }
    _dayGrid(rows,{className='month-grid',labels=weekdayLabels(this._locale(),weekStartsSunday(this._config)),prefix=0,mini=false,columns}={}){
      const headings=labels.map(label=>`<span class="weekday">${escapeHTML(label)}</span>`).join('');
      const cells='<span></span>'.repeat(prefix)+rows.map(row=>this._renderDot(row,mini)).join('');
      return `<div class="${className}"${columns?` style="--day-columns:${columns}"`:''}>${headings}${cells}</div>`;
    }
    _monthGrid(year,month,small=false,map=new Map(this._days.map(row=>[row.key,row]))){
      const prefix=weekOffset(year,month,1,weekStartsSunday(this._config));
      const rows=Array.from({length:daysInMonth(year,month)},(_,index)=>map.get(`${year}-${String(month).padStart(2,'0')}-${String(index+1).padStart(2,'0')}`));
      return this._dayGrid(rows,{className:small?'mini-grid':'month-grid',prefix,mini:small,labels:small?[]:undefined});
    }
    _miniMonths(){
      if(this._selectedMonth){
        const [year,month]=this._selectedMonth.split('-').map(Number);
        return this._view(`<button type="button" class="drillback" data-month="all">‹&nbsp; ${escapeHTML(this._t('allMonths'))}</button>${this._monthGrid(year,month)}`);
      }
      const months=[...new Set(this._days.map(d=>d.key.slice(0,7)))];
      const unscrolled=months.length<=13,map=new Map(this._days.map(row=>[row.key,row]));
      return `<div class="many-months${unscrolled?' unscrolled':''}"><div class="month-collection">${months.map(month=>{
        const [year,m]=month.split('-').map(Number);
        const title=this._formatDate(month+'-01',true);
        const shortTitle=this._dateLabel(month+'-01',{year:'numeric',month:'short'});
        return `<div class="mini-month"><button class="month-button" data-month="${month}" aria-label="${escapeHTML(this._t('selectMonth',{month:title}))}">${escapeHTML(shortTitle)}</button>${this._monthGrid(year,m,true,map)}</div>`;
      }).join('')}</div></div>${this._selectionDetail()}`;
    }
    _dayView(row){
      const unit=this._unit(),pct=this._progress(row);
      const path='M 125 8 H 200 A 42 42 0 0 1 242 50 A 42 42 0 0 1 200 92 H 50 A 42 42 0 0 1 8 50 A 42 42 0 0 1 50 8 H 125';
      const label=`${this._formatDate(row.key)}: ${this._label(row)}. ${this._format(row.value)} ${unit}. ${this._t('goalAria',{value:this._format(row.goal),unit})}`;
      const multiCurrent=this._isMultiCurrent(row);
      const valuePath=multiCurrent?this._stackedPath(row,path):`<path class="value" d="${path}" pathLength="100" stroke-width="10" fill="none" stroke-dasharray="${pct} 100"/>`;
      const selected=this._selected===row.key;
      const calculation=selected?`<span class="calculation">${escapeHTML(this._aggregationDetail())}</span>`:'';
      const detail=selected?this._selectionDetail(true):'';
      const content=`<svg viewBox="0 0 250 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><path class="track" d="${path}" pathLength="100" stroke-width="10" fill="none"/>${valuePath}</svg><span class="oval-content"><span class="oval-text">${calculation}<strong class="measurement">${this._format(row.value)}</strong><span class="unit">${escapeHTML(unit)}</span></span>${detail}</span>`;
      return `<div class="fill">${this._dayButton(row,`oval ${row.status}${multiCurrent?' multi-current':''}`,content,label)}</div>`;
    }
    _aggregationDetail(){
      const aggregation=this._config?.aggregation||'max';
      const detailKey=AGGREGATIONS.find(option=>option.value===aggregation)?.detailKey||'detailMax';
      return this._t(detailKey);
    }
    _selectionDetail(inOval=false){
      const row=this._days.find(d=>d.key===this._selected);
      if(!row)return '';
      const meta=`${escapeHTML(this._formatDate(row.key))} · ${escapeHTML(this._percentageText(row))}`;
      if(inOval)return `<span class="detail oval-detail">${meta}</span>`;
      const unit=this._unit();
      const amount=`${this._format(row.value)}${unit?` ${unit}`:''}`;
      return `<span class="detail"><strong>${escapeHTML(this._aggregationDetail())} ${escapeHTML(amount)}</strong><br>${meta}</span>`;
    }
    _chartDayButton(row,left,width){
      const unit=this._unit();
      const value=row.value===null?'':`. ${this._format(row.value)}${unit?` ${unit}`:''}`;
      const label=`${this._formatDate(row.key)}: ${this._label(row)}${value}`;
      return `<button type="button" class="chart-day-hit" data-day="${row.key}" style="left:${left}%;width:${width}%" aria-pressed="${this._selected===row.key}" aria-label="${escapeHTML(label)}"></button>`;
    }
    _chartLabelIndexes(rows){
      const count=rows.length;
      if(count<=8)return rows.map((_row,index)=>index);
      if(count<=31){
        const step=Math.ceil(count/6),indexes=[];
        for(let index=0;index<count;index+=step)indexes.push(index);
        if(indexes.at(-1)!==count-1)indexes.push(count-1);
        return indexes;
      }
      const indexes=rows.map((row,index)=>row.key.slice(8)==='01'?index:null).filter(index=>index!==null);
      if(indexes[0]!==0)indexes.unshift(0);
      if(indexes.at(-1)!==count-1)indexes.push(count-1);
      return indexes;
    }
    _chartDateLabel(row,index,count){
      if(count<=8)return this._weekday(row.key);
      if(count<=62)return this._dateLabel(row.key,{day:'numeric',month:'short'});
      const includeYear=index===0||row.key.slice(5)==='01-01';
      return this._dateLabel(row.key,{month:'short',...(includeYear?{year:'2-digit'}:{})});
    }
    _barChart(){
      const rows=this._days,count=rows.length,barWidth=chartBarWidth(count),base=145,top=9,plotHeight=base-top;
      const scaleValues=rows.flatMap(row=>[row.value,row.goal]).filter(value=>value!==null&&Number.isFinite(value)).map(value=>Math.max(0,value));
      const ceiling=Math.max(1,...scaleValues)*1.08;
      const y=value=>base-Math.max(0,value)/ceiling*plotHeight;
      let goalPath='',goalActive=false,previousGoalY=null,lastGoalY=null;
      rows.forEach((row,index)=>{
        if(row.goal===null){goalActive=false;previousGoalY=null;return}
        const currentY=y(row.goal),left=100*index/count,right=100*(index+1)/count;
        if(!goalActive)goalPath+=`M ${left} ${currentY}`;
        else if(Math.abs(currentY-previousGoalY)>.01)goalPath+=` V ${currentY}`;
        goalPath+=` H ${right}`;goalActive=true;previousGoalY=currentY;lastGoalY=currentY;
      });
      const bars=rows.map((row,index)=>{
        const x=100*(index+.5)/count;
        if(row.value===null||row.status==='future')return `<line class="chart-missing" x1="${x}" y1="${base}" x2="${x}" y2="${base-2}"/>`;
        if(this._isMultiCurrent(row)){
          let total=0;
          return (row.parts||[]).map((part,partIndex)=>{
            const value=Math.max(0,part.value??0),from=y(total),to=y(total+value);total+=value;
            const hidden=this._hiddenEntities.has(part.entity)?' hidden':'';
            return `<line class="chart-stack${hidden}" x1="${x}" y1="${from}" x2="${x}" y2="${to}" stroke-width="${barWidth}" style="stroke:${this._seriesColor(partIndex)}"/>`;
          }).join('');
        }
        const valueY=Math.min(base-1.5,y(row.value));
        return `<line class="chart-bar ${row.status}" x1="${x}" y1="${base}" x2="${x}" y2="${valueY}" stroke-width="${barWidth}"/>`;
      }).join('');
      const hits=rows.map((row,index)=>this._chartDayButton(row,100*index/count,100/count)).join('');
      const labels=this._chartLabelIndexes(rows).map(index=>`<span class="chart-axis-label" style="left:${100*(index+.5)/count}%">${escapeHTML(this._chartDateLabel(rows[index],index,count))}</span>`).join('');
      const goal=goalPath?`<path class="chart-goal" d="${goalPath}"/>`:'';
      const goalLabel=lastGoalY===null?'':`<span class="chart-goal-label" style="top:${Math.max(12,lastGoalY-3)}px">${escapeHTML(this._t('goalLine'))}</span>`;
      const canvasWidth=count>31?Math.max(500,Math.ceil(28+count*(barWidth+1))):null;
      const style=canvasWidth?` style="width:${canvasWidth}px"`:'';
      const content=`<div class="chart-scroll"><div class="chart-canvas"${style} aria-label="${escapeHTML(this._t('progressChart'))}"><svg class="status-chart" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true">${goal}${bars}</svg>${goalLabel}${labels}${hits}</div></div>`;
      return this._view(content);
    }
    _lineChart(row){
      if(this._hourlyLoading)return this._view(`<div class="chart-empty">${escapeHTML(this._t('loadingHistory'))}</div>`);
      if(this._hourlyError||!this._hourly.length)return this._view(`<div class="chart-empty">${escapeHTML(this._t('hourlyUnavailable'))}</div>`);
      const start=zonedMidnight(row.key,this._tz()).getTime(),end=zonedMidnight(keyPlus(row.key,1),this._tz()).getTime();
      const today=this._today(),visibleEnd=row.key===today?Math.min(Date.now(),end):end;
      const points=this._hourly.filter(point=>point.time>=start&&point.time<=visibleEnd).map(point=>({...point}));
      if(row.key<=today&&row.value!==null&&visibleEnd>=start){
        if(!points.length||points.at(-1).time<visibleEnd)points.push({time:visibleEnd,value:row.value});
        else if(points.at(-1).time===visibleEnd)points[points.length-1].value=row.value;
      }
      if(!points.length)return this._view(`<div class="chart-empty">${escapeHTML(this._t('hourlyUnavailable'))}</div>`);
      const base=145,top=9,plotHeight=base-top;
      const scaleValues=[row.goal,...points.map(point=>point.value)].filter(value=>value!==null&&Number.isFinite(value)).map(value=>Math.max(0,value));
      const ceiling=Math.max(1,...scaleValues)*1.08;
      const x=time=>100*Math.max(0,Math.min(1,(time-start)/(end-start)));
      const y=value=>base-Math.max(0,value)/ceiling*plotHeight;
      let path=points.map((point,index)=>`${index?'L':'M'} ${x(point.time)} ${y(point.value)}`).join(' ');
      if(points.length===1)path+=` l .01 0`;
      const goalY=row.goal===null?null:y(row.goal);
      const goal=goalY===null?'':`<path class="chart-goal" d="M 0 ${goalY} H 100"/>`;
      const goalLabel=goalY===null?'':`<span class="chart-goal-label" style="top:${Math.max(12,goalY-3)}px">${escapeHTML(this._t('goalLine'))}</span>`;
      const formatTime=time=>formatter('DateTimeFormat',this._locale(),{timeZone:this._tz(),hour:'2-digit',minute:'2-digit'}).format(new Date(time));
      const labels=[0,.25,.5,.75].map(fraction=>`<span class="chart-axis-label" style="left:${100*fraction}%">${escapeHTML(formatTime(start+(end-start)*fraction))}</span>`).join('');
      const hit=this._chartDayButton(row,0,100);
      const content=`<div class="chart-canvas" aria-label="${escapeHTML(this._t('progressChart'))}"><svg class="status-chart" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true">${goal}<path class="chart-line chart-bar ${row.status}" d="${path}"/></svg>${goalLabel}${labels}${hit}</div>`;
      return this._view(content);
    }
    _graphView(kind){
      return kind==='day'?this._lineChart(this._days[0]):this._barChart();
    }
    _weekView(){
      const columns=Math.min(7,this._days.length);
      const labels=this._days.slice(0,columns).map(row=>this._weekday(row.key));
      return this._view(this._dayGrid(this._days,{className:'strip',labels,columns}));
    }
    _monthView(){
      const [year,month]=this._days[0].key.split('-').map(Number);
      return this._view(this._monthGrid(year,month));
    }
    _rollingMonthView(){
      const first=this._days[0]?.key;
      if(!first)return '';
      const [year,month,day]=first.split('-').map(Number);
      const prefix=weekOffset(year,month,day,weekStartsSunday(this._config));
      return this._view(this._dayGrid(this._days,{prefix}));
    }
    _seriesLegend(){
      if(!shouldShowLegend(this._config))return '';
      const today=this._today(),row=this._days.find(day=>day.key===today);
      if(!row?.parts?.length)return '';
      const unit=this._unit(),interactive=row.parts.length>1;
      const items=row.parts.map((part,index)=>{
        const hidden=this._hiddenEntities.has(part.entity),name=this._hass.states?.[part.entity]?.attributes?.friendly_name||part.entity;
        const value=`${this._format(part.value)}${unit?` ${unit}`:''}`;
        const marker=interactive?`<button type="button" class="legend-toggle" data-toggle-entity="${escapeHTML(part.entity)}" aria-pressed="${!hidden}" aria-label="${escapeHTML(this._t(hidden?'show':'hide'))} ${escapeHTML(name)}"><span class="legend-marker" aria-hidden="true"></span></button>`:`<span class="legend-toggle static" aria-hidden="true"><span class="legend-marker"></span></span>`;
        return `<li class="${hidden?'hidden':''}" style="--series-color:${this._seriesColor(index)}">${marker}<button type="button" class="legend-label" data-more-info="${escapeHTML(part.entity)}" title="${escapeHTML(name)}">${escapeHTML(name)}</button><span class="legend-value">${escapeHTML(value)}</span></li>`;
      }).join('');
      return `<ul class="series-legend" aria-label="${escapeHTML(this._t('measurementEntities'))}">${items}</ul>`;
    }
    _summaryText(){
      const today=this._today();
      const evaluated=this._days.filter(row=>row.key<=today&&['met','missed','progress'].includes(row.status));
      const met=evaluated.filter(row=>row.status==='met').length;
      const summary=this._t(evaluated.length===1?'summaryOne':'summaryMany',{met,total:evaluated.length});
      const rowGoals=this._days.filter(row=>row.key<=today&&row.goal!=null).map(row=>row.goal);
      const configuredGoal=numeric(this._config?.goal);
      const goals=[...new Set(rowGoals.length?rowGoals:(configuredGoal===null?[]:[configuredGoal]))].sort((a,b)=>a-b);
      if(!goals.length)return summary;
      const unit=this._unit();
      const values=goals.length===1?this._format(goals[0]):`${this._format(goals[0])}–${this._format(goals.at(-1))}`;
      const amount=`${values}${unit?` ${unit}`:''}`;
      const maximum=this._config?.direction==='max';
      const goal=this._t(goals.length===1?(maximum?'goalMaximumSummary':'goalMinimumSummary'):(maximum?'dailyGoalsMaximumSummary':'dailyGoalsMinimumSummary'),{amount});
      return `${summary} · ${goal}`;
    }
    _stateText(kind){
      if(this._loading)return this._t('loadingHistory');
      if(this._error)return this._t('unavailable');
      return kind==='day'?this._dayState(this._days[0]):this._summaryText();
    }
    _render(){
      if(!this._config||!this._hass)return;
      const root=this.shadowRoot.getElementById('content');if(!root)return;
      const c=this._config,hass=this._hass,rows=this._days;
      const entityIds=measurementEntities(c),primary=entityIds[0];
      this._renderContext={entities:entityIds,today:dateParts(new Date(),this._tz()),unit:unitLabel(c,hass,entityIds)};
      try {
        const title=c.title||(entityIds.length>1?this._t('dailyTotal'):hass.states?.[primary]?.attributes?.friendly_name||primary);
        const kind=rows.length?getLayout(rows.map(d=>d.key)):'day';
        let stage='';
        if(this._error)stage=`<div class="error">${escapeHTML(this._error)}</div>`;
        else if(this._loading)stage=`<div class="muted">${escapeHTML(this._t('loadingHistory'))}</div>`;
        else if(this._viewMode==='chart')stage=this._graphView(kind);
        else if(kind==='day')stage=this._dayView(rows[0]);
        else if(kind==='week')stage=this._weekView();
        else if(kind==='month')stage=this._monthView();
        else if(kind==='rolling-month')stage=this._rollingMonthView();
        else stage=this._miniMonths();
        const legend=!this._loading&&!this._error&&!(this._viewMode==='chart'&&kind==='day')?this._seriesLegend():'';
        const state=this._stateText(kind);
        const chartView=this._viewMode==='chart';
        const viewLabel=this._t(chartView?'showCircles':'showChart');
        const viewIcon=chartView?'mdi:calendar-month-outline':'mdi:chart-bar';
        const viewToggle=`<ha-icon-button class="view-toggle" data-view-toggle label="${escapeHTML(viewLabel)}"><ha-icon icon="${viewIcon}"></ha-icon></ha-icon-button>`;
        root.innerHTML=`<div class="header"><div class="header-icon" aria-hidden="true"><ha-state-icon></ha-state-icon></div><div class="header-info"><div class="name">${escapeHTML(title)}</div><div class="subtitle">${escapeHTML(state)}</div></div>${viewToggle}</div><div class="body">${stage}${legend}</div>`;
        const stateIcon=root.querySelector('ha-state-icon');
        if(stateIcon){stateIcon.hass=hass;stateIcon.stateObj=hass.states?.[primary];if(c.icon)stateIcon.icon=c.icon;}
      } finally {
        // Never reuse a render snapshot after a config, sensor, or date change.
        this._renderContext=null;
      }
    }
  }

  const FORM_SCHEMA=[
    {name:'entities',required:true,selector:{entity:{domain:['sensor','number','input_number'],multiple:true}}},
    {name:'title',selector:{text:{}}},
    {name:'icon',selector:{icon:{}}},
    {name:'goal',selector:{number:{mode:'box',step:'any'}}},
    {name:'goal_entity',selector:{entity:{domain:['sensor','number','input_number']}}},
    {name:'direction',selector:{select:{options:[{value:'min',label:'At least (minimum)'},{value:'max',label:'At most (maximum)'}]}}},
    {name:'aggregation',selector:{select:{mode:'box',box_max_columns:1,options:AGGREGATION_OPTIONS}}},
    {name:'show_legend',selector:{boolean:{}}},
    {name:'start_week_on_sunday',selector:{boolean:{}}},
    {name:'unit',selector:{text:{}}},
    {name:'collection_key',selector:{text:{}}},
  ];
  const FORM_LABEL_KEYS={entities:'formEntities',title:'formTitle',icon:'formIcon',goal:'formGoal',goal_entity:'formGoalEntity',direction:'formDirection',aggregation:'formAggregation',start_week_on_sunday:'formWeekStart',show_legend:'formLegend',unit:'formUnit',collection_key:'formCollectionKey'};
  const localizedFormSchema=(locale)=>FORM_SCHEMA.map(schema=>{
    if(schema.name==='direction')return {...schema,selector:{select:{options:[{value:'min',label:translate(locale,'directionMin')},{value:'max',label:translate(locale,'directionMax')}]}}};
    if(schema.name==='aggregation')return {...schema,selector:{select:{...schema.selector.select,options:localizedAggregationOptions(locale)}}};
    return schema;
  });
  const STYLE_ROWS=[
    {name:'success_style',translationKey:'successfulDays',status:'met'},
    {name:'failure_style',translationKey:'unsuccessfulDays',status:'missed'},
    {name:'no_data_style',translationKey:'daysWithoutData',status:'no-data'},
  ];
  class DailyGoalsCardEditor extends HTMLElement {
    constructor(){super();this.attachShadow({mode:'open'});this._locale=browserLocale();this._form=document.createElement('ha-form');this._form.schema=localizedFormSchema(this._locale);this._form.computeLabel=(schema)=>translate(this._locale,FORM_LABEL_KEYS[schema.name]||schema.name);
      this._form.addEventListener('value-changed',e=>{if(!this._config)return;const values=e.detail.value,newConfig={...this._config,...values,type:'custom:daily-goals-card'};if(Array.isArray(values.entities))delete newConfig.entity;delete newConfig.legend;this._config=newConfig;this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:newConfig},bubbles:true,composed:true}));});this.shadowRoot.appendChild(this._form);
      this._styles=document.createElement('fieldset');this._styles.className='style-grid';this._styles.addEventListener('change',e=>{if(!this._config||e.target.type!=='radio'||!e.target.checked)return;const newConfig={...this._config,[e.target.name]:e.target.value,type:'custom:daily-goals-card'};this._config=newConfig;this._renderStyles();this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:newConfig},bubbles:true,composed:true}));});this.shadowRoot.appendChild(this._styles);
      const style=document.createElement('style');style.textContent=`.style-grid{border:0;margin:20px 0 0;padding:0;width:100%;box-sizing:border-box;color:var(--primary-text-color);display:grid;grid-template-columns:minmax(120px,1fr) repeat(3,minmax(64px,.55fr));align-items:center;gap:0}.style-grid legend{grid-column:1/-1;font-size:var(--ha-font-size-m,14px);font-weight:var(--ha-font-weight-medium,500);padding:0 0 12px}.style-grid .heading{font-size:var(--ha-font-size-s,12px);color:var(--secondary-text-color);text-align:center;padding:0 4px 8px}.style-grid .row-label{font-size:var(--ha-font-size-m,14px);padding:10px 8px 10px 0}.style-grid label{display:grid;place-items:center;min-height:40px;cursor:pointer}.style-grid input{width:18px;height:18px;margin:0;accent-color:var(--primary-color)}@media(max-width:360px){.style-grid{grid-template-columns:minmax(105px,1fr) repeat(3,minmax(54px,.5fr))}.style-grid .heading{font-size:11px}}`;this.shadowRoot.appendChild(style)}
    _renderStyles(){if(!this._styles)return;const headings=[translate(this._locale,'filled'),translate(this._locale,'outlined'),translate(this._locale,'symbols')];const rows=STYLE_ROWS.map(row=>{const selected=markerStyle(this._config,row.status),label=translate(this._locale,row.translationKey);return `<span class="row-label">${escapeHTML(label)}</span>${['filled','outline','symbols'].map((value,index)=>`<label title="${escapeHTML(label)}: ${escapeHTML(headings[index])}"><input type="radio" name="${row.name}" value="${value}" aria-label="${escapeHTML(label)}: ${escapeHTML(headings[index])}"${selected===value?' checked':''}></label>`).join('')}`}).join('');this._styles.innerHTML=`<legend>${escapeHTML(translate(this._locale,'dayMarkerStyles'))}</legend><span></span>${headings.map(label=>`<span class="heading">${escapeHTML(label)}</span>`).join('')}${rows}`;}
    setConfig(config){this._config={...config};const data={...config,entities:measurementEntities(config),show_legend:config.show_legend??config.legend==='show'};delete data.entity;delete data.legend;delete data.finished_style;delete data.success_style;delete data.failure_style;delete data.no_data_style;this._form.data=data;this._renderStyles();}
    set hass(hass){this._form.hass=hass;const locale=hass?.locale?.language||browserLocale();if(locale!==this._locale){this._locale=locale;this._form.schema=localizedFormSchema(locale);this._renderStyles();}}
  }
  if(!customElements.get('daily-goals-card'))customElements.define('daily-goals-card',DailyGoalsCard);
  if(!customElements.get('daily-goals-card-editor'))customElements.define('daily-goals-card-editor',DailyGoalsCardEditor);
  window.customCards=window.customCards||[];
  const registrationLocale=browserLocale();
  if(!window.customCards.some(c=>c.type==='daily-goals-card'))window.customCards.push({type:'daily-goals-card',name:translate(registrationLocale,'cardName'),description:translate(registrationLocale,'cardDescription'),preview:true});
  console.info(`%c DAILY GOALS CARD %c v${VERSION} `,'background:#03a9f4;color:white;font-weight:bold','background:#eee;color:#222');
  // Exposed only for programmatic tests; does not affect Home Assistant UI.
  if (typeof window.__DAILY_GOALS_TEST__!=='undefined') window.__DAILY_GOALS_TEST__={numeric,keyPlus,dayDiff,dateParts,zonedMidnight,makeKeys,daysInMonth,weekOffset,weekdayLabels,measurementEntities,shouldShowLegend,weekStartsSunday,finishedStyle,markerStyle,dailyFromStats,hourlyProgressFromStats,hourlyProgressFromHistory,dailyFromHistory,goalFromHistory,evaluate,getLayout,relevantEnergyCollection,chartBarWidth,translate,localizedAggregationOptions,localizedFormSchema,AGGREGATION_OPTIONS,STYLE_ROWS};
})();
