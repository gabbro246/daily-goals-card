/* Daily Goals Card, a dependency-free Home Assistant Lovelace custom card.
 * Copyright (c) 2026. MIT license.
 */
(() => {
  'use strict';
  const VERSION = '0.1.0';
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
  const unitLabel = (config,hass) => config.unit || hass?.states?.[config.entity]?.attributes?.unit_of_measurement || '';
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
    :host { display:block; --goal-color:var(--primary-color,#03a9f4); --goal-track:var(--divider-color,rgba(120,120,120,.20)); --goal-muted:var(--secondary-text-color,#777); --goal-error:var(--error-color,#db4437); --goal-ink:var(--primary-text-color,#212121) }
    ha-card { overflow:hidden; color:var(--goal-ink) }
    .header {display:flex;align-items:center;gap:12px;padding:16px;min-width:0}
    .avatar {height:42px;width:42px;display:grid;place-items:center;border-radius:50%;flex-shrink:0;background:var(--secondary-background-color,rgba(127,127,127,.1));color:var(--goal-color)}
    .header ha-icon{--mdc-icon-size:24px}
    .heading{min-width:0;flex:1}
    .name{font-size:var(--ha-font-size-l,18px);font-weight:var(--ha-font-weight-medium,500);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .subtitle{font-size:var(--ha-font-size-s,12px);color:var(--goal-muted);margin-top:3px}
    .body {border-top:1px solid var(--goal-track);padding:16px;}
    .period {display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
    .period strong{font-size:var(--ha-font-size-m,14px);font-weight:500}
    .period span{color:var(--goal-muted);font-size:var(--ha-font-size-s,12px)}
    .canvas{height:300px;min-height:300px;display:flex;align-items:center;justify-content:center;min-width:0;overflow:hidden;}
    .fill {width:100%;max-width:500px}
    .oval {width:100%;height:148px;position:relative;display:grid;place-items:center;}
    .oval svg{width:100%;height:100%;position:absolute;inset:0;overflow:visible}
    .oval-text{display:flex;align-items:center;flex-direction:column;position:relative;z-index:1;gap:4px}
    .oval-text .state{color:var(--goal-muted);font-size:var(--ha-font-size-s,12px)}
    .oval-text .measurement{font-size:clamp(26px,6vw,38px);line-height:1.2;font-weight:500;letter-spacing:-.04em}
    .oval-text .unit{font-size:var(--ha-font-size-m,14px);color:var(--goal-muted)}
    .oval.done .oval-text .state{color:var(--goal-color)}
    .twostats{display:grid;grid-template-columns:1fr 1fr;text-align:center;border-top:1px solid var(--goal-track);padding-top:18px;margin:14px 16px 0}
    .twostats > div+div{border-left:1px solid var(--goal-track)}
    .twostats strong{display:block;font-size:clamp(16px,5vw,23px);font-weight:500}
    .twostats small{display:block;font-size:var(--ha-font-size-s,12px);color:var(--goal-muted);margin-top:6px}
    .strip{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:12px 3px;place-items:center;max-width:500px;margin:0 auto 16px;width:100%}
    .cell{display:flex;flex-direction:column;align-items:center;gap:7px;min-width:0}
    .cell span{font-size:var(--ha-font-size-xs,11px);color:var(--goal-muted)}
    .dot{border:2px solid var(--goal-track);background:transparent;color:var(--goal-muted);border-radius:50%;display:grid;place-items:center;position:relative;isolation:isolate;width:32px;height:32px;padding:0;box-sizing:border-box;font-family:inherit;font-size:12px;font-weight:500;cursor:pointer}
    .dot:focus-visible,.month-button:focus-visible{outline:2px solid var(--goal-color);outline-offset:2px}
    .dot[aria-pressed=true]{outline:2px solid var(--goal-color);outline-offset:3px}
    .dot.met{background:var(--goal-color);border-color:var(--goal-color);color:var(--text-primary-color,#fff)}
    .dot.missed{border-color:var(--goal-error);color:var(--goal-error)}
    .dot.progress{border-color:transparent;background:conic-gradient(var(--goal-color) 0 var(--fill),var(--goal-track) var(--fill) 100%)}
    .dot.progress::before{content:'';inset:3px;border-radius:50%;position:absolute;background:var(--ha-card-background,var(--card-background-color,#fff));z-index:-1}
    .dot.no-data{border-style:dashed}
    .dot.no-goal{border-color:var(--warning-color,#e3a23b);color:var(--warning-color,#e3a23b)}
    .dot.future{opacity:.35}
    .week-details{text-align:center;border-top:1px solid var(--goal-track);padding-top:16px}
    .week-details strong{font-size:var(--ha-font-size-xl,24px);font-weight:500}
    .week-details small{display:block;color:var(--goal-muted);margin-top:6px;font-size:12px}
    .month-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px 3px;align-items:center;justify-items:center;max-width:430px;margin:0 auto;width:100%}
    .weekday{color:var(--goal-muted);font-size:11px}
    .month-grid .dot{width:clamp(27px,7vw,34px);height:clamp(27px,7vw,34px)}
    .month-collection{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;width:100%;}
    .mini-month{border:1px solid var(--goal-track);border-radius:var(--ha-card-border-radius,12px);padding:8px;min-width:0;background:var(--ha-card-background,var(--card-background-color,#fff))}
    .month-button{display:block;width:100%;border:0;background:none;padding:0;text-align:left;font-family:inherit;color:inherit;font-size:var(--ha-font-size-xs,11px);margin:0 0 8px;cursor:pointer;font-weight:500}
    .mini-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px 2px;place-items:center}
    .mini-dot{width:7px;height:7px;border:1px solid var(--goal-track);border-radius:50%;box-sizing:border-box}
    .mini-dot.met{background:var(--goal-color);border-color:var(--goal-color)}
    .mini-dot.missed{border-color:var(--goal-error);background:var(--goal-error);opacity:.48}
    .mini-dot.progress{border-color:var(--goal-color)}
    .mini-dot.no-data{border-style:dashed}
    .mini-dot.no-goal{border-color:var(--warning-color,#e3a23b)}
    .mini-dot.future{opacity:.22}
    .mini-month.active{outline:2px solid var(--goal-color);outline-offset:1px}
    .many-months{height:300px;max-height:300px;overflow:auto;align-self:stretch;display:block;width:100%;padding:4px 0;box-sizing:border-box}
    .many-months.year{overflow:hidden}
    .many-months.year .month-collection{grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
    .many-months.year .mini-month{padding:5px}
    .many-months.year .mini-grid{gap:3px 1px}
    .many-months.year .mini-dot{width:6px;height:6px}
    .drillback{display:flex;align-items:center;justify-content:flex-start;gap:6px;border:0;background:transparent;color:var(--primary-color,#03a9f4);padding:7px 2px 14px;cursor:pointer;font:inherit;font-size:13px}
    .many-months .month-collection{grid-template-columns:repeat(3,minmax(0,1fr))}
    .detail{height:26px;display:flex;align-items:center;justify-content:center;text-align:center;color:var(--goal-muted);font-size:var(--ha-font-size-s,12px);line-height:1.3;gap:5px;overflow:hidden;}
    .summary{border-top:1px solid var(--goal-track);padding:13px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:var(--ha-font-size-s,12px)}
    .summary .value{font-weight:500;font-size:var(--ha-font-size-m,14px);text-align:right}
    .muted{color:var(--goal-muted)}
    .error{color:var(--goal-error);font-size:13px;text-align:center;line-height:1.5;padding:18px}
    @media(max-width:340px){.body{padding:12px}.month-collection{gap:5px}.mini-month{padding:5px}.mini-grid{gap:3px 1px}.mini-dot{width:6px;height:6px}.strip .dot{width:27px;height:27px}.period strong{font-size:13px}}
  `;

  class DailyGoalsCard extends HTMLElement {
    constructor(){
      super();this.attachShadow({mode:'open'});
      this._config=null;this._hass=null;this._period=null;this._signature='';this._selected=null;this._selectedMonth=null;
      this._days=[];this._loading=false;this._error='';this._clock=Date.now();this._fetchId=0;this._timer=null;this._lastDataRequest='';
      this.shadowRoot.innerHTML=`<style>${css}</style><ha-card><div id="content"></div></ha-card>`;
      this.shadowRoot.addEventListener('click', (e)=>{
        const btn=e.target.closest('[data-day],[data-month]');if(!btn)return;
        if(btn.dataset.day) this._selected=btn.dataset.day;
        if(btn.dataset.month) this._selectedMonth=btn.dataset.month==='all' ? null : btn.dataset.month;
        this._render();
      });
    }
    static getConfigElement(){return document.createElement('daily-goals-card-editor')}
    static getStubConfig(hass,entities=[]){
      const pick=entities.find(e=>e.startsWith('sensor.'))||'sensor.daily_steps';
      return {type:'custom:daily-goals-card',entity:pick,goal:6000,direction:'min',aggregation:'max'};
    }
    setConfig(config){
      if(!config?.entity||typeof config.entity!=='string')throw new Error('Select a numeric entity (entity).');
      if(config.goal_entity && typeof config.goal_entity!=='string') throw new Error('goal_entity must be an entity ID.');
      if(!config.goal_entity && (numeric(config.goal)===null||numeric(config.goal)<0))throw new Error('Set a nonnegative goal number or a goal entity.');
      if(config.collection_key && !config.collection_key.startsWith('energy_'))throw new Error('collection_key must begin with energy_.');
      if(config.direction && !['min','max'].includes(config.direction))throw new Error('direction must be min or max.');
      if(config.aggregation && !VALID_AGG.has(config.aggregation))throw new Error('aggregation must be change, max, min, mean, or state.');
      const key=JSON.stringify(config);
      if(key!==JSON.stringify(this._config)){this._config={...config};this._signature='';this._lastDataRequest='';this._selected=null;this._selectedMonth=null;this._syncPeriod(true)}
      this._render();
    }
    set hass(hass){
      const old=this._hass;this._hass=hass;
      if(!hass)return;
      const prevZone=old?.config?.time_zone;
      this._syncPeriod(prevZone!==hass.config?.time_zone);
      // A sensor's live value can change before Recorder's next hourly result.
      const state=hass.states?.[this._config?.entity],prior=old?.states?.[this._config?.entity];
      const goal=hass.states?.[this._config?.goal_entity],priorGoal=old?.states?.[this._config?.goal_entity];
      if(state?.last_updated!==prior?.last_updated||goal?.last_updated!==priorGoal?.last_updated){this._mergeCurrentDay();this._render()}
    }
    connectedCallback(){
      this._syncPeriod();
      this._timer=setInterval(()=>{
        this._syncPeriod();
        const now=new Date().getTime();
        if(now-this._clock>300000){this._clock=now;const today=dateParts(new Date(),this._tz());if(this._period?.start<=today&&this._period?.end>=today)this._load();else {this._mergeCurrentDay();this._render();}}
      },1100);
    }
    disconnectedCallback(){clearInterval(this._timer);this._timer=null;this._fetchId++}
    getCardSize(){return 10}
    getGridOptions(){return {columns:12,rows:8,min_columns:9,min_rows:8}}
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
      this._days=keys.map(key=>({key,value:null,goal:null,status:'no-data'}));
      this._clock=Date.now();this._loading=true;this._error='';this._render();
      const tz=this._tz(),start=zonedMidnight(period.start,tz),end=zonedMidnight(keyPlus(period.end,1),tz);
      try {
        const ids=[config.entity,...(config.goal_entity?[config.goal_entity]:[])];
        const response=await hass.callWS({type:'recorder/statistics_during_period',start_time:start.toISOString(),end_time:end.toISOString(),period:'day',statistic_ids:[...new Set(ids)],types:['change','mean','max','min','state']});
        if(seq!==this._fetchId)return;
        const agg=config.aggregation||'max';
        const metric=dailyFromStats(response?.[config.entity],agg,tz);
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
            const fallback=dailyFromHistory(byEntity.get(config.entity),agg,tz,histStart,histEnd);
            for(const [key,val] of fallback)if(!metric.has(key))metric.set(key,val);
            if(config.goal_entity){
              const gh=goalFromHistory(byEntity.get(config.goal_entity),tz,histStart,histEnd);
              for(const [key,val] of gh)targets.set(key,val);
            }
          }catch(err){console.warn('daily-goals-card: recent history not available',err)}
        }
        if(seq!==this._fetchId)return;
        this._metric=metric;this._targets=targets;this._rebuildDays();this._loading=false;this._render();
      }catch(err){
        if(seq!==this._fetchId)return;
        this._loading=false;this._error=`Could not read Recorder statistics: ${err?.message||err}`;
        this._render();
      }
    }
    _rebuildDays(){
      if(!this._period||!this._config||!this._hass)return;
      const config=this._config,zone=this._tz(),today=dateParts(new Date(),zone),goalFixed=numeric(config.goal);
      this._days=this._days.map(({key})=>{
        const value=this._metric?.has(key)?this._metric.get(key):null;
        const goal=config.goal_entity?(this._targets?.get(key)??null):goalFixed;
        return {key,value,goal,status:evaluate(value,goal,config.direction||'min',key,today)};
      });
      this._mergeCurrentDay();
    }
    _mergeCurrentDay(){
      if(!this._days?.length||!this._config||!this._hass)return;
      const today=dateParts(new Date(),this._tz());
      const row=this._days.find(d=>d.key===today);
      if(!row)return;
      const entity=this._hass.states?.[this._config.entity];
      const n=stateValue(entity);
      // Only use live state for daily snapshots (max, state, min), not cumulative
      // 'change' meters or averages, where entity state has different semantics.
      const agg=this._config.aggregation||'max';
      if(n!==null && ['max','min','state'].includes(agg)){
        if(agg==='max')row.value=Math.max(row.value??n,n);
        else if(agg==='min')row.value=Math.min(row.value??n,n);
        else row.value=n;
      }
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
    _renderDot(row,mini=false){
      if(!row)return '<span></span>';
      if(mini)return `<span class="mini-dot ${row.status}" title="${escapeHTML(this._formatDate(row.key))}: ${escapeHTML(this._label(row))}"></span>`;
      const active=this._selected===row.key;
      const sym=row.status==='no-goal'?'!':row.status==='no-data'?'–':Number(row.key.slice(-2));
      const pct=this._progress(row).toFixed(2);
      return `<button type="button" class="dot ${row.status}" data-day="${row.key}" style="--fill:${pct}%" aria-pressed="${active}" aria-label="${escapeHTML(this._formatDate(row.key))}: ${escapeHTML(this._label(row))}. ${row.value===null?'':`${escapeHTML(this._format(row.value))} ${escapeHTML(unitLabel(this._config,this._hass))}`}">${sym}</button>`;
    }
    _monthGrid(year,month,small=false){
      const limit=daysInMonth(year,month),prefix=weekOffset(year,month),map=new Map(this._days.map(d=>[d.key,d]));
      let cells='';
      if(!small){
        const labels=Array.from({length:7},(_,i)=>new Intl.DateTimeFormat(this._locale(),{timeZone:'UTC',weekday:'narrow'}).format(new Date(Date.UTC(2026,0,5+i))));
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
      if(this._selectedMonth){const [year,month]=this._selectedMonth.split('-').map(Number);return `<div class="fill"><button type="button" class="drillback" data-month="all">‹ &nbsp; All months</button>${this._monthGrid(year,month)}</div>`;}
      const months=[...new Set(this._days.map(d=>d.key.slice(0,7)))];
      const isYear=getLayout(this._days.map(d=>d.key))==='year';
      return `<div class="many-months ${isYear?'year':''}"><div class="month-collection">${months.map(month=>{
        const [year,m]=month.split('-').map(Number);
        const title=this._formatDate(month+'-01',true);
        const shortTitle=new Intl.DateTimeFormat(this._locale(),{timeZone:'UTC',month:'short'}).format(new Date(month+'-01T12:00:00Z'));
        const active=month===this._selectedMonth;
        return `<div class="mini-month ${active?'active':''}"><button class="month-button" data-month="${month}" aria-label="Select ${escapeHTML(title)}">${escapeHTML(isYear?shortTitle:title)}</button>${this._monthGrid(year,m,true)}</div>`;
      }).join('')}</div></div>`;
    }
    _dayView(row){
      const unit=unitLabel(this._config,this._hass);const pct=this._progress(row);
      const fill=row?.status==='met'?'var(--goal-color)':'var(--goal-color)';
      const oval=`<div class="oval ${row.status}"><svg viewBox="0 0 380 145" preserveAspectRatio="none" aria-hidden="true"><rect x="12" y="12" width="356" height="121" rx="61" stroke="var(--goal-track)" stroke-width="9" fill="none"/><rect x="12" y="12" width="356" height="121" rx="61" pathLength="100" stroke="${fill}" stroke-width="9" stroke-linecap="round" fill="none" stroke-dasharray="${pct} 100" /></svg><div class="oval-text"><span class="state">${escapeHTML(this._label(row))}</span><strong class="measurement">${this._format(row.value)}</strong><span class="unit">${escapeHTML(unit)}</span></div></div>`;
      let left='—',leftLabel='Remaining',right='—',rightLabel='Progress';
      if(row?.goal>=0 && row?.value!==null){
        left=this._format(Math.max(0,(this._config.direction==='max'?row.goal-row.value:row.goal-row.value)));
        leftLabel=this._config.direction==='max'?'Allowance remaining':'Remaining to goal';
        right=`${this._format(Math.round(pct))}%`;
        rightLabel=this._config.direction==='max'?'Budget used':'Goal reached';
      }
      return `<div class="fill">${oval}<div class="twostats"><div><strong>${left}</strong><small>${leftLabel}</small></div><div><strong>${right}</strong><small>${rightLabel}</small></div></div></div>`;
    }
    _weekView(){
      const rows=this._days;
      const selected=rows.find(d=>d.key===this._selected)||rows.find(d=>d.key===dateParts(new Date(),this._tz()))||rows[rows.length-1];
      return `<div class="fill"><div class="strip">${rows.map(row=>`<div class="cell"><span>${escapeHTML(this._weekday(row.key))}</span>${this._renderDot(row)}<span>${Number(row.key.slice(-2))}</span></div>`).join('')}</div><div class="week-details"><strong>${this._format(selected?.value)} ${escapeHTML(unitLabel(this._config,this._hass))}</strong><small>${escapeHTML(this._formatDate(selected.key))} · ${escapeHTML(this._label(selected))}${selected.goal==null?'':` · ${this._format(selected.goal)} goal`}</small></div></div>`;
    }
    _monthView(){
      const [year,month]=this._days[0].key.split('-').map(Number);
      return `<div class="fill">${this._monthGrid(year,month)}</div>`;
    }
    _dateDescription(){
      if(!this._period)return '';
      const {start,end}=this._period;
      return start===end?this._formatDate(start):`${this._formatDate(start)} – ${this._formatDate(end)}`;
    }
    _render(){
      if(!this._config||!this._hass)return;
      const root=this.shadowRoot.getElementById('content');if(!root)return;
      const c=this._config,hass=this._hass,rows=this._days,goal=c.goal_entity?null:numeric(c.goal);
      const title=c.title||hass.states?.[c.entity]?.attributes?.friendly_name||c.entity;
      const icon=c.icon||hass.states?.[c.entity]?.attributes?.icon||'mdi:target';
      const unit=unitLabel(c,hass);
      const target=c.goal_entity?(hass.states?.[c.goal_entity]?.attributes?.friendly_name||c.goal_entity):`${this._format(goal)} ${unit}`;
      const direction=c.direction==='max'?'At most':'At least';
      const kind=rows.length?getLayout(rows.map(d=>d.key)):'day';
      const latest=rows.find(d=>d.key===this._selected)||rows[rows.length-1];
      let stage='';
      if(this._error)stage=`<div class="error">${escapeHTML(this._error)}</div>`;
      else if(this._loading)stage='<div class="muted">Loading history…</div>';
      else if(kind==='day')stage=this._dayView(rows[0]);
      else if(kind==='week')stage=this._weekView();
      else if(kind==='month')stage=this._monthView();
      else stage=this._miniMonths();
      const today=dateParts(new Date(),this._tz());
      const finalized=rows.filter(r=>r.key<today&&(r.status==='met'||r.status==='missed'));
      const met=finalized.filter(r=>r.status==='met').length;
      const missing=rows.filter(r=>r.key<=today&&r.status==='no-data').length;
      const footer=kind==='day'?`${escapeHTML(this._label(rows[0]))}`:`${met} / ${finalized.length} days met${missing?` · ${missing} missing`:''}`;
      let detail='';
      if(kind!=='day' && kind!=='week' && latest){
        const selection=rows.find(r=>r.key===this._selected);
        detail=selection?`${this._formatDate(selection.key)} · ${this._format(selection.value)} ${unit} · ${this._label(selection)}`:
          kind==='year'||kind==='mini-months'?(this._selectedMonth?`${this._formatDate(this._selectedMonth+'-01',true)} selected`:'Select a month for context'):'Select a day for details';
      }
      root.innerHTML=`<div class="header"><div class="avatar"><ha-icon icon="${escapeHTML(icon)}"></ha-icon></div><div class="heading"><div class="name">${escapeHTML(title)}</div><div class="subtitle">${direction} ${escapeHTML(target)} / day</div></div></div><div class="body"><div class="period"><strong>${escapeHTML(this._dateDescription())}</strong><span>${kind==='day'?escapeHTML(this._weekday(rows[0]?.key||today)):escapeHTML(kind==='mini-months'?'Custom range':kind.charAt(0).toUpperCase()+kind.slice(1))}</span></div><div class="canvas">${stage}</div><div class="detail">${escapeHTML(detail)}</div></div><div class="summary"><span class="muted">${kind==='day'?'Daily goal':'Daily goals'}</span><span class="value">${footer}</span></div>`;
    }
  }

  const FORM_SCHEMA=[
    {name:'entity',required:true,selector:{entity:{domain:['sensor','number','input_number']}}},
    {name:'title',selector:{text:{}}},
    {name:'icon',selector:{icon:{}}},
    {name:'goal',selector:{number:{mode:'box',step:'any'}}},
    {name:'goal_entity',selector:{entity:{domain:['sensor','number','input_number']}}},
    {name:'direction',selector:{select:{options:[{value:'min',label:'At least (minimum)'},{value:'max',label:'At most (maximum)'}]}}},
    {name:'aggregation',selector:{select:{options:[{value:'max',label:'Highest value per day (steps)'},{value:'change',label:'Daily change (energy / total increasing)'},{value:'state',label:'Last recorded value per day'},{value:'mean',label:'Daily mean'},{value:'min',label:'Daily minimum'}]}}},
    {name:'unit',selector:{text:{}}},
    {name:'collection_key',selector:{text:{}}},
  ];
  const FORM_LABELS={entity:'Measurement entity',title:'Card title (optional)',icon:'Icon (optional)',goal:'Fixed daily goal (ignored when goal entity is set)',goal_entity:'Daily goal entity (optional)',direction:'Goal rule',aggregation:'Measurement aggregation',unit:'Unit override (optional)',collection_key:'Energy date collection key (optional)'};
  class DailyGoalsCardEditor extends HTMLElement {
    constructor(){super();this.attachShadow({mode:'open'});this._form=document.createElement('ha-form');this._form.schema=FORM_SCHEMA;this._form.computeLabel=(schema)=>FORM_LABELS[schema.name]||schema.name;
      this._form.addEventListener('value-changed',e=>{if(!this._config)return;const newConfig={...this._config,...e.detail.value,type:'custom:daily-goals-card'};this._config=newConfig;this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:newConfig},bubbles:true,composed:true}));});this.shadowRoot.appendChild(this._form)}
    setConfig(config){this._config={...config};this._form.data={...config};}
    set hass(hass){this._form.hass=hass;}
  }
  if(!customElements.get('daily-goals-card'))customElements.define('daily-goals-card',DailyGoalsCard);
  if(!customElements.get('daily-goals-card-editor'))customElements.define('daily-goals-card-editor',DailyGoalsCardEditor);
  window.customCards=window.customCards||[];
  if(!window.customCards.some(c=>c.type==='daily-goals-card'))window.customCards.push({type:'daily-goals-card',name:'Daily Goals',description:'Daily goals synced with the Energy date picker',preview:true});
  console.info(`%c DAILY GOALS CARD %c v${VERSION} `,'background:#03a9f4;color:white;font-weight:bold','background:#eee;color:#222');
  // Exposed only for programmatic tests; does not affect Home Assistant UI.
  if (typeof window.__DAILY_GOALS_TEST__!=='undefined') window.__DAILY_GOALS_TEST__={numeric,keyPlus,dayDiff,dateParts,zonedMidnight,makeKeys,daysInMonth,dailyFromStats,dailyFromHistory,goalFromHistory,evaluate,getLayout,relevantEnergyCollection};
})();
