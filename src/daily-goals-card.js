/* Daily Goals Card, a dependency-free Home Assistant Lovelace custom card.
 * Copyright (c) 2026. MIT license.
 */
(() => {
  'use strict';
  const VERSION = '0.2.2';
  const DAY_MS = 86400000;
  const VALID_AGG = new Set(['change', 'max', 'min', 'mean', 'state']);
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
    const parts = new Intl.DateTimeFormat('en-US', {timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(date);
    const get = (type) => parts.find((x) => x.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  };
  const zonedMidnight = (key, zone) => {
    // Convert a calendar date at 00:00 in HA's time zone to a UTC instant.
    const [year, month, day] = key.split('-').map(Number);
    const intended = Date.UTC(year, month-1, day);
    let value = intended;
    const fmt = new Intl.DateTimeFormat('en-US', {
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
  const weekOffset = (year, month, day=1) => (new Date(Date.UTC(year,month-1,day)).getUTCDay()+6)%7;
  const makeKeys = (start,end) => {
    const count = dayDiff(start,end);
    if (count<0 || count>750) throw new Error('Select a range of no more than 750 days.');
    return Array.from({length: count+1}, (_,i)=>keyPlus(start,i));
  };
  const formatValue = (n, locale, digits) => n == null ? '—' : new Intl.NumberFormat(locale, {maximumFractionDigits: digits ?? (Number.isInteger(n) ? 0 : 1)}).format(n);
  const measurementEntities = (config) => [...new Set(
    (Array.isArray(config?.entities)?config.entities:(typeof config?.entity==='string'?[config.entity]:[]))
      .filter(id=>typeof id==='string'&&id)
  )];
  const unitLabel = (config,hass) => config.unit || hass?.states?.[measurementEntities(config)[0]]?.attributes?.unit_of_measurement || '';
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
    if(first.slice(5)==='01-01' && last.slice(5)==='12-31' && first.slice(0,4)===last.slice(0,4))return 'year';
    if(n<=62)return 'months';
    return 'mini-months';
  };
  const relevantEnergyCollection = (hass, key) => {
    const connection=hass?.connection;if(!connection)return null;
    const names = key ? [`_${key}`] : [hass?.panelUrl ? `_energy_${hass.panelUrl}` : '_energy', '_energy'];
    for (const name of names) if(connection[name]?.start) return connection[name];
    return null;
  };
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
      --goal-focus:var(--ha-color-focus,var(--primary-color,#03a9f4));
      --goal-icon-background:var(--ha-color-fill-primary-quiet-resting,rgba(3,169,244,.12));
    }
    ha-card{overflow:hidden;color:var(--goal-ink)}
    .header{display:flex;align-items:center;gap:10px;min-height:56px;padding:0 10px;min-width:0;box-sizing:border-box}
    .header-icon{display:grid;place-items:center;width:36px;height:36px;flex:0 0 36px;border-radius:var(--ha-border-radius-pill,18px);background:var(--goal-icon-background);color:var(--goal-color)}
    .header-icon ha-state-icon{--mdc-icon-size:24px}
    .header-info{min-width:0;flex:1}
    .name{font-size:var(--ha-font-size-m,14px);font-weight:var(--ha-font-weight-medium,500);line-height:var(--ha-line-height-normal,1.6);letter-spacing:.1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .subtitle{font-size:var(--ha-font-size-s,12px);font-weight:var(--ha-font-weight-normal,400);line-height:var(--ha-line-height-condensed,1.2);letter-spacing:.4px;color:var(--goal-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
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
    .oval-text{display:flex;align-items:baseline;position:relative;z-index:1;gap:var(--ha-space-1,4px)}
    .oval-text .measurement{font-size:var(--ha-font-size-3xl,28px);font-weight:var(--ha-font-weight-normal,400);line-height:var(--ha-line-height-condensed,1.2);letter-spacing:0}
    .oval-text .unit{font-size:var(--ha-font-size-m,14px);font-weight:var(--ha-font-weight-normal,400);line-height:var(--ha-line-height-condensed,1.2);color:var(--goal-muted)}
    .strip{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:var(--ha-space-2,8px) 2px;place-items:center;max-width:500px;margin:0 auto;width:100%}
    .cell{display:flex;flex-direction:column;align-items:center;gap:var(--ha-space-2,8px);min-width:0}
    .cell > span,.weekday{font-size:var(--ha-font-size-s,12px);font-weight:var(--ha-font-weight-normal,400);line-height:var(--ha-line-height-condensed,1.2);letter-spacing:.4px;color:var(--goal-muted)}
    .dot{border:2px solid var(--goal-track);background:transparent;color:var(--goal-muted);border-radius:var(--ha-border-radius-circle,50%);display:grid;place-items:center;position:relative;width:32px;height:32px;padding:0;box-sizing:border-box;font-family:inherit;font-size:var(--ha-font-size-s,12px);font-weight:var(--ha-font-weight-normal,400);line-height:1;cursor:pointer}
    .dot > span{position:relative;z-index:1}
    .oval:focus-visible,.dot:focus-visible,.mini-dot:focus-visible,.month-button:focus-visible,.drillback:focus-visible{outline:2px solid var(--goal-focus);outline-offset:2px}
    .dot[aria-pressed=true]{box-shadow:0 0 0 2px var(--card-background-color,#fff),0 0 0 4px var(--goal-focus)}
    .dot.met{background:var(--goal-success);border-color:var(--goal-success);color:var(--goal-on-success)}
    .dot.missed{background:var(--goal-error);border-color:var(--goal-error);color:var(--goal-on-error)}
    .dot.progress{border-color:transparent}
    .dot.no-data,.dot.no-goal{border-color:var(--goal-unavailable);border-style:dashed;color:var(--goal-unavailable)}
    .dot.future{opacity:.25}
    .dot.multi-current{background:transparent;border-color:transparent;color:var(--goal-muted)}
    .progress-ring{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
    .progress-ring .track{fill:none;stroke:var(--goal-track)}
    .progress-ring .value{fill:none;stroke:var(--goal-color);stroke-linecap:round}
    .progress-ring .series-value,.progress-ring .series-cap{fill:none}
    .month-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:var(--ha-space-2,8px) 2px;align-items:center;justify-items:center;max-width:430px;margin:0 auto;width:100%}
    .month-grid .dot{width:clamp(28px,7vw,32px);height:clamp(28px,7vw,32px)}
    .month-collection{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--ha-space-4,16px) var(--ha-space-2,8px);width:100%}
    .mini-month{padding:0;min-width:0}
    .month-button{display:block;width:100%;border:0;background:none;padding:0;text-align:left;font-family:inherit;color:var(--goal-ink);font-size:var(--ha-font-size-s,12px);font-weight:var(--ha-font-weight-medium,500);line-height:var(--ha-line-height-condensed,1.2);letter-spacing:.1px;margin:0 0 var(--ha-space-2,8px);cursor:pointer}
    .mini-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:var(--ha-space-1,4px) 2px;place-items:center}
    .mini-dot{position:relative;width:12px;height:12px;border:0;background:transparent;padding:0;border-radius:var(--ha-border-radius-circle,50%);box-sizing:border-box;cursor:pointer}
    .mini-dot::after{content:"";position:absolute;inset:2px;border:1px solid var(--goal-track);border-radius:inherit;box-sizing:border-box}
    .mini-dot.met::after{background:var(--goal-success);border-color:var(--goal-success)}
    .mini-dot.missed::after{border-color:var(--goal-error);background:var(--goal-error)}
    .mini-dot.progress::after{border:0}
    .mini-dot.no-data::after,.mini-dot.no-goal::after{border-color:var(--goal-unavailable);border-style:dashed}
    .mini-dot.future{opacity:.55}
    .mini-dot.future::after{border-color:var(--goal-muted)}
    .mini-dot.multi-current::after{background:transparent;border:0}
    .mini-dot[aria-pressed=true]{box-shadow:inset 0 0 0 1px var(--goal-focus)}
    .mini-dot .progress-ring{inset:2px;width:8px;height:8px}
    .many-months{max-height:320px;overflow:auto;width:100%;padding:0;box-sizing:border-box}
    .many-months.unscrolled{max-height:none;overflow:visible}
    .many-months .mini-grid{gap:3px 1px}
    .drillback{display:flex;align-items:center;border:0;background:transparent;color:var(--goal-color);padding:0 0 var(--ha-space-3,12px);cursor:pointer;font:inherit;font-size:var(--ha-font-size-s,12px);font-weight:var(--ha-font-weight-medium,500);line-height:var(--ha-line-height-condensed,1.2)}
    .series-legend{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--ha-space-2,8px) var(--ha-space-4,16px);list-style:none;margin:var(--ha-space-3,12px) 0 0;padding:0}
    .series-legend li{display:flex;align-items:center;min-width:0;font-size:var(--ha-font-size-s,12px);font-weight:var(--ha-font-weight-normal,400);line-height:var(--ha-line-height-condensed,1.2);letter-spacing:.4px}
    .legend-toggle,.legend-label{border:0;background:transparent;font:inherit;padding:0;cursor:pointer}
    .legend-toggle{display:grid;place-items:center;width:24px;height:24px;margin-inline-end:2px;color:var(--series-color)}
    .legend-marker{display:grid;place-items:center;width:14px;height:14px;border:2px solid currentColor;border-radius:50%;box-sizing:border-box;background:currentColor}
    .legend-marker::after{content:"✓";color:var(--card-background-color,#fff);font-size:9px;font-weight:700;line-height:1}
    .series-legend li.hidden .legend-marker{background:transparent;color:var(--goal-muted)}
    .series-legend li.hidden .legend-marker::after{content:""}
    .series-legend li.hidden .legend-label,.series-legend li.hidden .legend-value{opacity:.55}
    .legend-label{max-width:150px;color:var(--goal-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .legend-value{margin-inline-start:var(--ha-space-1,4px);color:var(--goal-muted);white-space:nowrap}
    .legend-toggle:focus-visible,.legend-label:focus-visible{outline:2px solid var(--goal-focus);outline-offset:1px;border-radius:var(--ha-border-radius-sm,4px)}
    .detail{margin-top:var(--ha-space-3,12px);font-size:var(--ha-font-size-s,12px);font-weight:var(--ha-font-weight-normal,400);line-height:var(--ha-line-height-condensed,1.2);letter-spacing:.4px;text-align:center;color:var(--goal-muted)}
    .detail strong{color:var(--goal-ink);font-size:var(--ha-font-size-m,14px);font-weight:var(--ha-font-weight-medium,500);line-height:var(--ha-line-height-normal,1.6);letter-spacing:.1px}
    .muted{color:var(--goal-muted);font-size:var(--ha-font-size-s,12px);font-weight:var(--ha-font-weight-normal,400);line-height:var(--ha-line-height-condensed,1.2);text-align:center}
    .error{color:var(--goal-error);font-size:var(--ha-font-size-s,12px);font-weight:var(--ha-font-weight-normal,400);line-height:var(--ha-line-height-normal,1.6);text-align:center;padding:var(--ha-space-4,16px)}
    @media(max-width:340px){.month-collection{gap:var(--ha-space-3,12px) var(--ha-space-1,4px)}.mini-grid{gap:3px 1px}.mini-dot{width:10px;height:10px}.mini-dot::after{inset:2px}.mini-dot .progress-ring{inset:2px;width:6px;height:6px}.strip .dot{width:28px;height:28px}}
  `;

  class DailyGoalsCard extends HTMLElement {
    constructor(){
      super();this.attachShadow({mode:'open'});
      this._config=null;this._hass=null;this._period=null;this._signature='';this._selected=null;this._selectedMonth=null;
      this._days=[];this._loading=false;this._error='';this._clock=Date.now();this._fetchId=0;this._timer=null;this._lastDataRequest='';this._resizeObserver=null;this._lastHeight=0;this._hiddenEntities=new Set();
      this.shadowRoot.innerHTML=`<style>${css}</style><ha-card><div id="content"></div></ha-card>`;
      this.shadowRoot.addEventListener('click', (e)=>{
        const btn=e.target.closest('[data-day],[data-month],[data-toggle-entity],[data-more-info]');if(!btn)return;
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
      return {type:'custom:daily-goals-card',entities:[pick],goal:6000,direction:'min',aggregation:'max'};
    }
    setConfig(config){
      if(config?.entity!==undefined&&typeof config.entity!=='string')throw new Error('entity must be an entity ID.');
      if(config?.entities!==undefined&&(!Array.isArray(config.entities)||config.entities.some(id=>typeof id!=='string')))throw new Error('entities must be a list of entity IDs.');
      if(!measurementEntities(config).length)throw new Error('Select at least one numeric measurement entity.');
      if(config.goal_entity && typeof config.goal_entity!=='string') throw new Error('goal_entity must be an entity ID.');
      if(!config.goal_entity && (numeric(config.goal)===null||numeric(config.goal)<0))throw new Error('Set a nonnegative goal number or a goal entity.');
      if(config.collection_key && !config.collection_key.startsWith('energy_'))throw new Error('collection_key must begin with energy_.');
      if(config.direction && !['min','max'].includes(config.direction))throw new Error('direction must be min or max.');
      if(config.aggregation && !VALID_AGG.has(config.aggregation))throw new Error('aggregation must be change, max, min, mean, or state.');
      const key=JSON.stringify(config);
      if(key!==JSON.stringify(this._config)){this._config={...config};this._signature='';this._lastDataRequest='';this._selected=null;this._selectedMonth=null;this._hiddenEntities.clear();this._syncPeriod(true)}
      this._render();
    }
    set hass(hass){
      const old=this._hass;this._hass=hass;
      if(!hass)return;
      const prevZone=old?.config?.time_zone;
      this._syncPeriod(prevZone!==hass.config?.time_zone);
      // A sensor's live value can change before Recorder's next hourly result.
      const measurementChanged=measurementEntities(this._config).some(id=>hass.states?.[id]?.last_updated!==old?.states?.[id]?.last_updated);
      const goal=hass.states?.[this._config?.goal_entity],priorGoal=old?.states?.[this._config?.goal_entity];
      if(measurementChanged||goal?.last_updated!==priorGoal?.last_updated){this._mergeCurrentDay();this._render()}
    }
    connectedCallback(){
      this._syncPeriod();
      this._observeSize();
      this._timer=setInterval(()=>{
        this._syncPeriod();
        const now=new Date().getTime();
        if(now-this._clock>300000){this._clock=now;const today=dateParts(new Date(),this._tz());if(this._period?.start<=today&&this._period?.end>=today)this._load();else {this._mergeCurrentDay();this._render();}}
      },1100);
    }
    disconnectedCallback(){clearInterval(this._timer);this._timer=null;this._fetchId++;this._resizeObserver?.disconnect();this._resizeObserver=null}
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
    _tz(){return this._hass?.config?.time_zone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'}
    _locale(){return this._hass?.locale?.language||navigator.language||'en'}
    _syncPeriod(force=false){
      if(!this._config||!this._hass)return;
      const col=relevantEnergyCollection(this._hass,this._config.collection_key);
      const tz=this._tz();const now=new Date();
      const from=col?.start instanceof Date ? col.start : col?.start ? new Date(col.start) : now;
      const to=col?.end instanceof Date ? col.end : col?.end ? new Date(col.end) : from;
      if(Number.isNaN(from.getTime())||Number.isNaN(to.getTime()))return;
      const a=dateParts(from,tz),b=dateParts(to,tz),signature=`${a}/${b}/${tz}`;
      if(!force && signature===this._signature)return;
      this._signature=signature;this._period={start:a,end:b};this._selected=null;this._selectedMonth=null;
      this._load();
    }
    async _load(){
      const seq=++this._fetchId, period=this._period, hass=this._hass, config=this._config;
      if(!period||!hass||!config)return;
      let keys;
      try {keys=makeKeys(period.start,period.end)}catch(err){this._error=err.message;this._days=[];this._render();return}
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
        const recentStart=keyPlus(dateParts(new Date(),tz),-10);
        const histStart=period.start>recentStart?period.start:recentStart;
        const histEnd=period.end<dateParts(new Date(),tz)?period.end:dateParts(new Date(),tz);
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
      }catch(err){
        if(seq!==this._fetchId)return;
        this._loading=false;this._error=`Could not read Recorder statistics: ${err?.message||err}`;
        this._render();
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
        const value=parts.every(part=>part.value!==null)?parts.reduce((sum,part)=>sum+part.value,0):null;
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
      row.value=row.parts.every(part=>part.value!==null)?row.parts.reduce((sum,part)=>sum+part.value,0):null;
      if(this._config.goal_entity){
        const goal=stateValue(this._hass.states?.[this._config.goal_entity]);
        if(goal!==null)row.goal=goal;
      }
      row.status=evaluate(row.value,row.goal,this._config.direction||'min',row.key,today);
    }
    _formatDate(key,monthOnly=false){
      return new Intl.DateTimeFormat(this._locale(),monthOnly?{timeZone:'UTC',year:'numeric',month:'long'}:{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'}).format(new Date(`${key}T12:00:00Z`));
    }
    _weekday(key){return new Intl.DateTimeFormat(this._locale(),{timeZone:'UTC',weekday:'short'}).format(new Date(`${key}T12:00:00Z`))}
    _format(n){return formatValue(n,this._locale(),this._config?.precision)}
    _label(row){
      if(!row)return 'No selection';
      const states={met:'Goal met',missed:'Goal missed',progress:'In progress','no-data':'No data','no-goal':'Goal unavailable',future:'Future'};
      return states[row.status]||row.status;
    }
    _progress(row){
      if(row?.value==null||row?.goal==null)return 0;
      if(row.goal===0)return row.status==='met'?100:0;
      return Math.max(0,Math.min(100,100*row.value/row.goal));
    }
    _percentageText(row){
      if(row?.value==null)return 'No data';
      if(row?.goal==null)return 'Goal unavailable';
      if(row.goal===0)return 'Goal is zero';
      const label=this._config?.direction==='max'?'limit':'goal';
      return `${this._format(100*row.value/row.goal)}% of ${label}`;
    }
    _dayState(row){
      if(!row||row.status==='future')return 'Future day';
      if(row.value==null)return 'No data';
      if(row.goal==null)return 'Goal unavailable';
      const unit=unitLabel(this._config,this._hass);
      const amount=value=>`${this._format(value)}${unit?` ${unit}`:``}`;
      const remaining=row.goal-row.value;
      if(this._config?.direction==='max'){
        if(remaining>0)return `${amount(remaining)} remaining`;
        if(remaining===0)return 'At the limit';
        return `${amount(-remaining)} over limit`;
      }
      if(remaining>0)return `${amount(remaining)} left`;
      if(remaining===0)return 'Goal reached';
      return `${amount(-remaining)} above goal`;
    }
    _isMultiCurrent(row){
      return measurementEntities(this._config).length>1&&row?.key===dateParts(new Date(),this._tz())&&(row.parts?.length||0)>1;
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
    _stackedRing(row,mini=false){
      const size=mini?16:32,center=size/2,radius=mini?7:15,stroke=2;
      const segments=this._seriesSegments(row).filter(segment=>segment.length>0);
      const values=segments.map(segment=>`<circle class="series-value${segment.hidden?' hidden':''}" cx="${center}" cy="${center}" r="${radius}" pathLength="100" stroke-width="${stroke}" stroke-dasharray="${segment.length.toFixed(3)} ${(100-segment.length).toFixed(3)}" stroke-dashoffset="${(-segment.offset).toFixed(3)}" transform="rotate(-90 ${center} ${center})" style="stroke:${segment.color}"/>`).join('');
      const total=segments.length?segments.at(-1).offset+segments.at(-1).length:0;
      const caps=segments.length&&total<99.999?[[segments[0],0],[segments.at(-1),total]].map(([segment,offset])=>`<circle class="series-cap${segment.hidden?' hidden':''}" cx="${center}" cy="${center}" r="${radius}" pathLength="100" stroke-width="${stroke}" stroke-dasharray="0 100" stroke-dashoffset="${(-offset).toFixed(3)}" transform="rotate(-90 ${center} ${center})" style="stroke:${segment.color}"/>`).join(''):'';
      return `<svg class="progress-ring" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle class="track" cx="${center}" cy="${center}" r="${radius}" stroke-width="${stroke}"/>${values}${caps}</svg>`;
    }
    _stackedPath(row,path){
      const segments=this._seriesSegments(row).filter(segment=>segment.length>0);
      const values=segments.map(segment=>`<path class="series-value${segment.hidden?' hidden':''}" d="${path}" pathLength="100" stroke-width="8" fill="none" stroke-dasharray="${segment.length.toFixed(3)} ${(100-segment.length).toFixed(3)}" stroke-dashoffset="${(-segment.offset).toFixed(3)}" style="stroke:${segment.color}"/>`).join('');
      const total=segments.length?segments.at(-1).offset+segments.at(-1).length:0;
      const caps=segments.length&&total<99.999?[[segments[0],0],[segments.at(-1),total]].map(([segment,offset])=>`<path class="series-cap${segment.hidden?' hidden':''}" d="${path}" pathLength="100" stroke-width="8" fill="none" stroke-dasharray="0 100" stroke-dashoffset="${(-offset).toFixed(3)}" style="stroke:${segment.color}"/>`).join(''):'';
      return values+caps;
    }
    _progressRing(pct,mini=false){
      const size=mini?16:32,center=size/2,radius=mini?7:15,stroke=2;
      return `<svg class="progress-ring" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle class="track" cx="${center}" cy="${center}" r="${radius}" stroke-width="${stroke}"/><circle class="value" cx="${center}" cy="${center}" r="${radius}" pathLength="100" stroke-width="${stroke}" stroke-dasharray="${pct} 100" transform="rotate(-90 ${center} ${center})"/></svg>`;
    }
    _renderDot(row,mini=false){
      if(!row)return '<span></span>';
      const pct=this._progress(row).toFixed(2),multiCurrent=this._isMultiCurrent(row);
      const ring=multiCurrent?this._stackedRing(row,mini):(row.status==='progress'?this._progressRing(pct,mini):'');
      const active=this._selected===row.key,currentClass=multiCurrent?' multi-current':'';
      const dayLabel=`${this._formatDate(row.key)}: ${this._label(row)}`;
      if(mini)return `<button type="button" class="mini-dot ${row.status}${currentClass}" data-day="${row.key}" aria-pressed="${active}" aria-label="${escapeHTML(dayLabel)}" title="${escapeHTML(dayLabel)}">${ring}</button>`;
      const sym=row.status==='no-goal'||row.status==='no-data'?'–':Number(row.key.slice(-2));
      return `<button type="button" class="dot ${row.status}${currentClass}" data-day="${row.key}" aria-pressed="${active}" aria-label="${escapeHTML(this._formatDate(row.key))}: ${escapeHTML(this._label(row))}. ${row.value===null?'':`${escapeHTML(this._format(row.value))} ${escapeHTML(unitLabel(this._config,this._hass))}`}">${ring}<span>${sym}</span></button>`;
    }
    _monthGrid(year,month,small=false){
      const limit=daysInMonth(year,month),prefix=weekOffset(year,month),map=new Map(this._days.map(d=>[d.key,d]));
      let cells='';
      if(!small){
        const labels=Array.from({length:7},(_,i)=>new Intl.DateTimeFormat(this._locale(),{timeZone:'UTC',weekday:'short'}).format(new Date(Date.UTC(2026,0,5+i))));
        cells+=labels.map(s=>`<span class="weekday">${escapeHTML(s)}</span>`).join('');
      }
      for(let i=0;i<prefix;i++)cells+='<span></span>';
      for(let d=1;d<=limit;d++){
        const key=`${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        cells+=this._renderDot(map.get(key),small);
      }
      return `<div class="${small?'mini-grid':'month-grid'}">${cells}</div>`;
    }
    _miniMonths(){
      if(this._selectedMonth){
        const [year,month]=this._selectedMonth.split('-').map(Number);
        return `<div class="fill"><button type="button" class="drillback" data-month="all">‹&nbsp; All months</button>${this._monthGrid(year,month)}${this._selectionDetail()}</div>`;
      }
      const months=[...new Set(this._days.map(d=>d.key.slice(0,7)))];
      const unscrolled=months.length<=13;
      return `<div class="many-months${unscrolled?' unscrolled':''}"><div class="month-collection">${months.map(month=>{
        const [year,m]=month.split('-').map(Number);
        const title=this._formatDate(month+'-01',true);
        const shortTitle=new Intl.DateTimeFormat(this._locale(),{timeZone:'UTC',year:'numeric',month:'short'}).format(new Date(month+'-01T12:00:00Z'));
        return `<div class="mini-month"><button class="month-button" data-month="${month}" aria-label="Select ${escapeHTML(title)}">${escapeHTML(shortTitle)}</button>${this._monthGrid(year,m,true)}</div>`;
      }).join('')}</div></div>${this._selectionDetail()}`;
    }
    _dayView(row){
      const unit=unitLabel(this._config,this._hass),pct=this._progress(row);
      const path='M 125 8 H 200 A 42 42 0 0 1 242 50 A 42 42 0 0 1 200 92 H 50 A 42 42 0 0 1 8 50 A 42 42 0 0 1 50 8 H 125';
      const label=`${this._formatDate(row.key)}: ${this._label(row)}. ${this._format(row.value)} ${unit}. ${this._format(row.goal)} ${unit} goal.`;
      const active=this._selected===row.key,multiCurrent=this._isMultiCurrent(row);
      const valuePath=multiCurrent?this._stackedPath(row,path):`<path class="value" d="${path}" pathLength="100" stroke-width="8" fill="none" stroke-dasharray="${pct} 100"/>`;
      return `<div class="fill"><button type="button" class="oval ${row.status}${multiCurrent?' multi-current':''}" data-day="${row.key}" aria-pressed="${active}" aria-label="${escapeHTML(label)}"><svg viewBox="0 0 250 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><path class="track" d="${path}" pathLength="100" stroke-width="8" fill="none"/>${valuePath}</svg><span class="oval-text"><strong class="measurement">${this._format(row.value)}</strong><span class="unit">${escapeHTML(unit)}</span></span></button>${this._selectionDetail()}</div>`;
    }
    _selectionDetail(){
      const row=this._days.find(d=>d.key===this._selected);
      if(!row)return '';
      const unit=unitLabel(this._config,this._hass);
      return `<div class="detail"><strong>${this._format(row.value)} ${escapeHTML(unit)}</strong><br>${escapeHTML(this._formatDate(row.key))} · ${escapeHTML(this._percentageText(row))}</div>`;
    }
    _weekView(){
      return `<div class="fill"><div class="strip">${this._days.map(row=>`<div class="cell"><span>${escapeHTML(this._weekday(row.key))}</span>${this._renderDot(row)}</div>`).join('')}</div>${this._selectionDetail()}</div>`;
    }
    _monthView(){
      const [year,month]=this._days[0].key.split('-').map(Number);
      return `<div class="fill">${this._monthGrid(year,month)}${this._selectionDetail()}</div>`;
    }
    _seriesLegend(){
      const row=this._days.find(day=>day.key===dateParts(new Date(),this._tz()));
      if(!this._isMultiCurrent(row))return '';
      const unit=unitLabel(this._config,this._hass);
      const items=row.parts.map((part,index)=>{
        const hidden=this._hiddenEntities.has(part.entity),name=this._hass.states?.[part.entity]?.attributes?.friendly_name||part.entity;
        const value=`${this._format(part.value)}${unit?` ${unit}`:''}`;
        return `<li class="${hidden?'hidden':''}" style="--series-color:${this._seriesColor(index)}"><button type="button" class="legend-toggle" data-toggle-entity="${escapeHTML(part.entity)}" aria-pressed="${!hidden}" aria-label="${hidden?'Show':'Hide'} ${escapeHTML(name)}"><span class="legend-marker" aria-hidden="true"></span></button><button type="button" class="legend-label" data-more-info="${escapeHTML(part.entity)}" title="${escapeHTML(name)}">${escapeHTML(name)}</button><span class="legend-value">${escapeHTML(value)}</span></li>`;
      }).join('');
      return `<ul class="series-legend" aria-label="Measurement entities">${items}</ul>`;
    }
    _summaryText(){
      const today=dateParts(new Date(),this._tz());
      const evaluated=this._days.filter(row=>row.key<=today&&['met','missed','progress'].includes(row.status));
      const met=evaluated.filter(row=>row.status==='met').length;
      return `${met} of ${evaluated.length} ${evaluated.length===1?'day':'days'} met`;
    }
    _stateText(kind){
      if(this._loading)return 'Loading history…';
      if(this._error)return 'Unavailable';
      return kind==='day'?this._dayState(this._days[0]):this._summaryText();
    }
    _render(){
      if(!this._config||!this._hass)return;
      const root=this.shadowRoot.getElementById('content');if(!root)return;
      const c=this._config,hass=this._hass,rows=this._days;
      const entityIds=measurementEntities(c),primary=entityIds[0];
      const title=c.title||(entityIds.length>1?'Daily total':hass.states?.[primary]?.attributes?.friendly_name||primary);
      const kind=rows.length?getLayout(rows.map(d=>d.key)):'day';
      let stage='';
      if(this._error)stage=`<div class="error">${escapeHTML(this._error)}</div>`;
      else if(this._loading)stage='<div class="muted">Loading history…</div>';
      else if(kind==='day')stage=this._dayView(rows[0]);
      else if(kind==='week')stage=this._weekView();
      else if(kind==='month')stage=this._monthView();
      else stage=this._miniMonths();
      const legend=!this._loading&&!this._error?this._seriesLegend():'';
      const state=this._stateText(kind);
      root.innerHTML=`<div class="header"><div class="header-icon" aria-hidden="true"><ha-state-icon></ha-state-icon></div><div class="header-info"><div class="name">${escapeHTML(title)}</div><div class="subtitle">${escapeHTML(state)}</div></div></div><div class="body">${stage}${legend}</div>`;
      const stateIcon=root.querySelector('ha-state-icon');
      if(stateIcon){stateIcon.hass=hass;stateIcon.stateObj=hass.states?.[primary];if(c.icon)stateIcon.icon=c.icon;}
    }
  }

  const AGGREGATION_OPTIONS=[
    {value:'max',label:'Highest value per day',description:'For counters that rise during the day and reset, such as steps or daily production.'},
    {value:'change',label:'Total change during the day',description:'For continuously increasing totals, such as energy, water, gas, distance, or runtime meters.'},
    {value:'state',label:'Last value of the day',description:'For a daily score, balance, or helper where the most recently recorded value should be used.'},
    {value:'mean',label:'Average value per day',description:'For measurements sampled throughout the day, such as temperature, humidity, power, heart rate, or air quality.'},
    {value:'min',label:'Lowest value per day',description:'For measurements where the daily low matters, such as temperature, battery level, pressure, or tank level.'},
  ];
  const FORM_SCHEMA=[
    {name:'entities',required:true,selector:{entity:{domain:['sensor','number','input_number'],multiple:true}}},
    {name:'title',selector:{text:{}}},
    {name:'icon',selector:{icon:{}}},
    {name:'goal',selector:{number:{mode:'box',step:'any'}}},
    {name:'goal_entity',selector:{entity:{domain:['sensor','number','input_number']}}},
    {name:'direction',selector:{select:{options:[{value:'min',label:'At least (minimum)'},{value:'max',label:'At most (maximum)'}]}}},
    {name:'aggregation',selector:{select:{mode:'box',box_max_columns:1,options:AGGREGATION_OPTIONS}}},
    {name:'unit',selector:{text:{}}},
    {name:'collection_key',selector:{text:{}}},
  ];
  const FORM_LABELS={entities:'Measurement entities',title:'Card title (optional)',icon:'Icon (optional)',goal:'Fixed daily goal (ignored when goal entity is set)',goal_entity:'Daily goal entity (optional)',direction:'Goal rule',aggregation:'Measurement aggregation',unit:'Unit override (optional)',collection_key:'Energy date collection key (optional)'};
  class DailyGoalsCardEditor extends HTMLElement {
    constructor(){super();this.attachShadow({mode:'open'});this._form=document.createElement('ha-form');this._form.schema=FORM_SCHEMA;this._form.computeLabel=(schema)=>FORM_LABELS[schema.name]||schema.name;
      this._form.addEventListener('value-changed',e=>{if(!this._config)return;const values=e.detail.value,newConfig={...this._config,...values,type:'custom:daily-goals-card'};if(Array.isArray(values.entities))delete newConfig.entity;this._config=newConfig;this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:newConfig},bubbles:true,composed:true}));});this.shadowRoot.appendChild(this._form)}
    setConfig(config){this._config={...config};const data={...config,entities:measurementEntities(config)};delete data.entity;this._form.data=data;}
    set hass(hass){this._form.hass=hass;}
  }
  if(!customElements.get('daily-goals-card'))customElements.define('daily-goals-card',DailyGoalsCard);
  if(!customElements.get('daily-goals-card-editor'))customElements.define('daily-goals-card-editor',DailyGoalsCardEditor);
  window.customCards=window.customCards||[];
  if(!window.customCards.some(c=>c.type==='daily-goals-card'))window.customCards.push({type:'daily-goals-card',name:'Daily Goals',description:'Daily goals synced with the Energy date picker',preview:true});
  console.info(`%c DAILY GOALS CARD %c v${VERSION} `,'background:#03a9f4;color:white;font-weight:bold','background:#eee;color:#222');
  // Exposed only for programmatic tests; does not affect Home Assistant UI.
  if (typeof window.__DAILY_GOALS_TEST__!=='undefined') window.__DAILY_GOALS_TEST__={numeric,keyPlus,dayDiff,dateParts,zonedMidnight,makeKeys,daysInMonth,measurementEntities,dailyFromStats,dailyFromHistory,goalFromHistory,evaluate,getLayout,relevantEnergyCollection,AGGREGATION_OPTIONS};
})();
