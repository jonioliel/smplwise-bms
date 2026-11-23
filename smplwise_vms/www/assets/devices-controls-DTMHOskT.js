import{c5 as i,aq as A,cO as st,cP as F,cJ as ct,aP as lt,b as c,A as v,a5 as rt,cK as nt,cQ as ot,cR as w,az as mt,g as ut}from"./index-eHtAZ44A.js";import{d as pt,P as ht,r as vt,w as gt,p as X,b as $t,s as Y}from"./device-commands-C-Sb0bN1.js";import{d as bt}from"./lock-reason-CSFyHUkj.js";const ft=["off","heat","cool","heat_cool","auto","dry","fan_only"],at=4e3,_t={docked:i("בעגינה"),cleaning:i("מנקה"),paused:i("מושהה"),returning:i("חוזר לעגינה"),idle:i("ממתין"),error:i("תקלה"),unavailable:i("לא זמין"),unknown:i("לא ידוע")},xt=new Set(["vacuum","valve","water_heater"]);function yt(o,t="°"){return o==null?"—":`${A(Number.isInteger(o)?o:o.toFixed(1))}${t}`}function Mt(o){if(o.state==="unavailable"||!o.available)return i("לא זמין");if(o.domain==="light")return o.active?o.brightness_pct!==null&&o.brightness_pct!==void 0?`${i("דולק")} · ${A(o.brightness_pct)}%`:i("דולק"):i("כבוי");if(o.domain==="cover"){const t=o.state==="open"?i("פתוח"):o.state==="closed"?st("deviceCard.valveClosed"):o.state==="opening"?i("נפתח…"):o.state==="closing"?i("נסגר…"):o.state??i("לא ידוע");return o.position!==null&&o.position!==void 0&&!o.moving?`${t} · ${A(o.position)}%`:t}if(o.domain==="climate")return o.hvac_mode?F[o.hvac_mode]??o.hvac_mode:i("לא ידוע");if(o.domain==="alarm_control_panel")return ct[o.state??""]??o.state??i("לא ידוע");if(o.domain==="media_player")return o.state==="playing"?i("מנגן"):o.state==="paused"?i("מושהה"):o.state==="idle"?i("דולק · ללא תוכן"):o.state==="on"?i("דולק"):o.state==="standby"?i("המתנה"):o.state==="off"?i("כבוי"):o.state??i("לא ידוע");if(o.domain==="fan")return o.active?o.percentage!==null&&o.percentage!==void 0?`${i("פועל")} · ${A(o.percentage)}%`:i("פועל"):i("כבוי");if(o.domain==="humidifier")return o.active?i("פועל"):i("כבוי");if(o.domain==="vacuum")return _t[o.state??""]??o.state??i("לא ידוע");if(o.domain==="valve"){const t=o.state==="open"?i("פתוח"):o.state==="closed"?st("deviceCard.valveClosed"):o.state==="opening"?i("נפתח…"):o.state==="closing"?i("נסגר…"):o.state??i("לא ידוע");return o.position!==null&&o.position!==void 0&&!o.moving&&o.position>0&&o.position<100?`${t} · ${A(o.position)}%`:t}return o.domain==="water_heater"?o.active?o.target_temperature!==null&&o.target_temperature!==void 0?`${i("פועל")} · ${i("יעד {t}",{t:`${A(o.target_temperature)}°`})}`:i("פועל"):i("כבוי"):lt({domain:o.domain,state:o.state,unit:o.unit??null,device_class:o.device_class,attributes:{}})}const zt=ut`
  .tile.pending,
  .row.pending {
    opacity: 0.7;
  }
  .tile sw-toggle {
    margin-inline-start: auto;
  }
  input[type='range'].ctl-range {
    grid-column: 1 / -1;
    inline-size: 100%;
    accent-color: var(--sw-accent);
    block-size: 20px;
    margin: 2px 0;
  }
  .tile input[type='range'].ctl-range {
    margin-top: 4px;
  }
  .ctl-row {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: var(--sw-s-1h);
    flex-wrap: wrap;
  }
  /* DEVICES-POLISH-2331: a cover's tilt is a second movement of the same device - its row reads as its own group */
  .ctl-row[data-control='cover-tilt'] {
    padding-block-start: var(--sw-s-2);
    border-block-start: 1px dashed var(--sw-border);
  }
  .ctl-val {
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-medium);
    min-inline-size: 4ch;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  /* DEVICES-POLISH-2331: a mode menu is one of the row's controls - the small button's height, radius, border, lift and type
     (sw-button size sm), so minus / value / plus, the menus and the buttons sit on one line as one family */
  .ctl-select {
    font: inherit;
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-medium);
    min-block-size: var(--sw-ctl-h-sm);
    max-inline-size: 100%;
    border-radius: var(--sw-r-xs);
    border: 1px solid var(--sw-border-strong);
    background: var(--sw-surface);
    color: var(--sw-text);
    box-shadow: var(--sw-shadow-1);
    padding-block: 0;
    padding-inline: var(--sw-s-2) var(--sw-s-1);
    cursor: pointer;
    transition: background var(--sw-t-hover) var(--sw-ease-color), border-color var(--sw-t-hover) var(--sw-ease-color);
  }
  @media (hover: hover) and (pointer: fine) {
    .ctl-select:hover:not(:disabled) {
      background: var(--sw-surface-2);
    }
  }
  .ctl-select:disabled {
    opacity: 0.55;
    cursor: default;
  }
  .rollback-note,
  .cmd-status {
    grid-column: 1 / -1;
    font-size: var(--sw-fs-xs);
    display: flex;
    align-items: center;
    gap: var(--sw-s-1h);
  }
  .rollback-note {
    color: var(--sw-danger-text);
  }
  .cmd-status.pending {
    color: var(--sw-text);
    background: var(--sw-warning-soft);
    border-radius: var(--sw-r-sm);
    padding: 2px var(--sw-s-1h);
    font-weight: var(--sw-fw-medium);
  }
  .cmd-status.pending .dot {
    flex: none;
    inline-size: 8px;
    block-size: 8px;
    border-radius: 50%;
    background: var(--sw-warning);
    animation: sw-cmd-pulse 1s ease-in-out infinite;
  }
  .cmd-status.sent {
    color: var(--sw-text-2);
  }
  .cmd-status.confirmed {
    color: var(--sw-text-2);
  }
  .cmd-status.confirmed::before {
    content: '';
    flex: none;
    inline-size: 8px;
    block-size: 8px;
    border-radius: 50%;
    background: var(--sw-success);
  }
  @keyframes sw-cmd-pulse {
    50% {
      opacity: 0.3;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .cmd-status.pending .dot {
      animation: none;
    }
  }
  .tile .rollback-note,
  .tile .cmd-status {
    white-space: normal;
  }
  .ctl-note {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    white-space: normal;
    max-inline-size: 26em;
  }
  /* UNLOCK-REASON-2370: the door-map link beside a "door not mapped" note (system administrators only) */
  .ctl-link {
    color: var(--sw-accent-text, var(--sw-accent));
    text-decoration: underline;
    text-underline-offset: 2px;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    min-block-size: 24px;
  }
  @media (pointer: coarse) {
    .ctl-link {
      min-block-size: 44px;
    }
  }
`;class At{constructor(t,e){this.host=t,this.onSettle=e,this.commands={},this.armed={},this.drafts={},this.debouncedRaw=pt(),this.building="",this.setCmd=(s,n)=>{this.commands={...this.commands,[s]:n},this.changed(),n.phase==="pending"&&window.setTimeout(()=>this.commands[s]===n&&this.changed(),Math.max(0,(n.since??Date.now())+ht-Date.now())+10),n.phase!=="pending"&&this.onSettle?.(),n.phase==="confirmed"||n.phase==="sent"?window.setTimeout(()=>this.clearCmd(s,n),2500):n.phase==="rolled_back"&&window.setTimeout(()=>this.clearCmd(s,n),4e3)},t.addController(this)}scoped(t){return this.building?{...t,building:this.building}:t}run(t,e,s,n,a,d,m,h={}){return vt(t,e,s,n,a,d,m,this.scoped(h))}debouncedRange(t,e,s,n,a,d,m,h={}){this.debouncedRaw(t,e,s,n,a,d,m,this.scoped(h))}hostConnected(){gt()}changed(){this.host.requestUpdate()}clearCmd(t,e){if(this.commands[t]===e){const s={...this.commands};delete s[t],this.commands=s,this.changed()}}entityCommands(t){return Object.entries(this.commands).filter(([e])=>e.startsWith(`${t}:`)).map(([,e])=>e)}rowPending(t){return this.entityCommands(t).some(e=>e.phase==="pending")}rowPendingVisible(t){return this.entityCommands(t).some(e=>X(e))}shownActive(t){return this.live(t.entity_id,"power")??t.active}shownRow(t){const e=this.live(t.entity_id,"power");return e===void 0||e===t.active||t.state==="unavailable"?t:{...t,active:e,state:e?"on":"off",brightness_pct:e?t.brightness_pct??null:null}}live(t,e){const s=this.commands[`${t}:${e}`];return s&&(s.phase==="pending"||s.phase==="confirmed")?s.optimistic:void 0}renderCmdStatus(t){const e=this.entityCommands(t),s=h=>e.find(f=>f.phase===h),n=e.find(h=>X(h));if(n)return c`<div class="cmd-status pending" data-cmd-status="pending" role="status"><span class="dot"></span>${i("ממתין לאישור")}${n.label?` · ${n.label}`:""}</div>`;const a=s("rolled_back");if(a)return c`<div class="rollback-note" data-rollback data-cmd-status="rolled_back" role="status">${a.label?`${a.label}: `:""}${a.note}</div>`;const d=s("sent");if(d)return c`<div class="cmd-status sent" data-cmd-status="sent" role="status">${i("נשלח")}${d.label?` · ${d.label}`:""} · ${i("אין דיווח מצב שמאשר את הביצוע")}</div>`;const m=s("confirmed");return m?c`<div class="cmd-status confirmed" data-cmd-status="confirmed" role="status">${i("אושר")}${m.label?` · ${m.label}`:""}</div>`:v}isArmed(t){const e=this.armed[t];return!!e&&e>Date.now()}disarm(t){const e={...this.armed};if(delete e[t],this.armed=e,t in this.drafts){const s={...this.drafts};delete s[t],this.drafts=s}this.changed()}arm(t){this.armed={...this.armed,[t]:Date.now()+at},this.changed(),window.setTimeout(()=>{this.armed[t]&&this.armed[t]<=Date.now()&&this.disarm(t)},at+50)}tapArmed(t,e){if(this.isArmed(t)){this.disarm(t),e();return}this.arm(t)}setDraft(t,e){this.drafts={...this.drafts,[t]:e},this.changed()}renderPowerToggle(t){const e=this.shownActive(t),s=n=>{n.stopPropagation(),this.power(t,n.detail?.checked??!e)};return c`<sw-toggle data-control="power" .checked=${e} ?data-pending=${this.rowPendingVisible(t.entity_id)} label=${rt(t.name)} labelHidden @click=${n=>n.stopPropagation()} @change=${s}></sw-toggle>`}renderBrightnessSlider(t){if(!nt(t))return v;const e=`${t.entity_id}:brightness`,s=this.live(t.entity_id,"brightness")??t.brightness_pct??100,n=a=>{const d=Number(a.target.value);this.debouncedRange(e,"light",t.entity_id,"light.turn_on",{brightness_pct:d},d,m=>this.setCmd(e,m),{label:i("בהירות {n}%",{n:d})})};return c`<input type="range" class="ctl-range" data-control="brightness" min="1" max="100" .value=${String(s)} @input=${n} @click=${a=>a.stopPropagation()} aria-label=${`${i("בהירות")} · ${t.name}`} />`}renderCoverControls(t){const e=t.entity_id,s=`${e}:open`,n=`${e}:close`,a=`${e}:stop`,d=`${e}:position`,m=[s,n,d].some(l=>this.commands[l]?.phase==="pending"),h=(l,p,B,S,q)=>void this.run(l,"cover",e,p,B,S,D=>this.setCmd(l,D),{confirmed:!0,label:q}),f=()=>this.tapArmed(s,()=>h(s,"cover.open_cover",{},"open",i("פתיחה"))),_=()=>this.tapArmed(n,()=>h(n,"cover.close_cover",{},"closed",i("סגירה"))),k=()=>{const l={...this.commands};for(const p of[s,n,d])Y(p),delete l[p],(p in this.armed||p in this.drafts)&&this.disarm(p);this.commands=l,this.changed(),this.run(a,"cover",e,"cover.stop_cover",{},"stopped",p=>this.setCmd(a,p),{label:i("עצירה")})},x=this.drafts[d],g=this.isArmed(d)&&x!==void 0,y=x??this.live(e,"position")??t.position??0,M=l=>this.setDraft(d,Number(l.target.value)),H=l=>{this.setDraft(d,Number(l.target.value)),this.arm(d)},P=()=>{const l=this.drafts[d];l===void 0||!this.isArmed(d)||(this.disarm(d),h(d,"cover.set_cover_position",{position:l},l,i("מיקום {n}%",{n:l})))},b=`${e}:open-tilt`,C=`${e}:close-tilt`,O=`${e}:stop-tilt`,$=`${e}:tilt-position`,E=[b,C,$].some(l=>this.commands[l]?.phase==="pending"),K=(l,p,B,S,q)=>void this.run(l,"cover",e,p,B,S,D=>this.setCmd(l,D),{confirmed:!0,label:q}),R=()=>this.tapArmed(b,()=>K(b,"cover.open_cover_tilt",{},"open",i("פתיחת הטיה"))),Q=()=>this.tapArmed(C,()=>K(C,"cover.close_cover_tilt",{},"closed",i("סגירת הטיה"))),I=()=>{const l={...this.commands};for(const p of[b,C,$])Y(p),delete l[p],(p in this.armed||p in this.drafts)&&this.disarm(p);this.commands=l,this.changed(),this.run(O,"cover",e,"cover.stop_cover_tilt",{},"stopped",p=>this.setCmd(O,p),{label:i("עצירת הטיה")})},N=this.drafts[$],L=this.isArmed($)&&N!==void 0,V=N??this.live(e,"tilt-position")??t.tilt??0,W=l=>this.setDraft($,Number(l.target.value)),U=l=>{this.setDraft($,Number(l.target.value)),this.arm($)},j=()=>{const l=this.drafts[$];l===void 0||!this.isArmed($)||(this.disarm($),K($,"cover.set_cover_tilt_position",{tilt_position:l},l,i("מיקום הטיה {n}%",{n:l})))};return c`<div class="ctl-row" data-control="cover">
        <sw-button size="sm" variant=${this.isArmed(s)?"primary":"secondary"} ?disabled=${m} data-control="open" @click=${f}>${this.isArmed(s)?i("לאשר פתיחה?"):i("פתיחה")}</sw-button>
        <sw-button size="sm" data-control="stop" @click=${k}>${i("עצירה")}</sw-button>
        <sw-button size="sm" variant=${this.isArmed(n)?"primary":"secondary"} ?disabled=${m} data-control="close" @click=${_}>${this.isArmed(n)?i("לאשר סגירה?"):i("סגירה")}</sw-button>
        ${t.position!==null&&t.position!==void 0?c`<input type="range" class="ctl-range" data-control="position" min="0" max="100" ?disabled=${m} .value=${String(y)} @input=${M} @change=${H} aria-label=${i("מיקום התריס")} />
              ${g?c`<sw-button size="sm" variant="primary" data-control="position-confirm" @click=${P}>${i("לאשר מיקום {n}%?",{n:x})}</sw-button>`:v}`:v}
      </div>
      ${t.tilt!==null&&t.tilt!==void 0?c`<div class="ctl-row" data-control="cover-tilt">
            <sw-button size="sm" variant=${this.isArmed(b)?"primary":"secondary"} ?disabled=${E} data-control="open-tilt" @click=${R}>${this.isArmed(b)?i("לאשר פתיחת הטיה?"):i("פתיחת הטיה")}</sw-button>
            <sw-button size="sm" data-control="stop-tilt" @click=${I}>${i("עצירת הטיה")}</sw-button>
            <sw-button size="sm" variant=${this.isArmed(C)?"primary":"secondary"} ?disabled=${E} data-control="close-tilt" @click=${Q}>${this.isArmed(C)?i("לאשר סגירת הטיה?"):i("סגירת הטיה")}</sw-button>
            <input type="range" class="ctl-range" data-control="tilt-position" min="0" max="100" ?disabled=${E} .value=${String(V)} @input=${W} @change=${U} aria-label=${i("מיקום הטיה")} />
            ${L?c`<sw-button size="sm" variant="primary" data-control="tilt-position-confirm" @click=${j}>${i("לאשר הטיה {n}%?",{n:N})}</sw-button>`:v}
          </div>`:v}`}renderClimateControls(t){const e=t.entity_id;if(t.domain==="climate"){const g=`${e}:temp`,{min:y,max:M,step:H}=ot(t),P=t.target_temperature,b=this.live(e,"temp")??P,C=r=>Math.min(M,Math.max(y,Math.round(r*10)/10)),O=r=>this.debouncedRange(g,"climate",e,"climate.set_temperature",{temperature:r},r,u=>this.setCmd(g,u),{label:i("טמפרטורת יעד {n}°",{n:r})}),$=`${e}:mode`,E=this.commands[$]?.phase==="pending",K=(t.hvac_modes??[]).filter(r=>ft.includes(r)),R=this.live(e,"mode")??t.hvac_mode??"",Q=r=>{const u=r.target.value,z=i("מצב {v}",{v:F[u]??u});u==="off"?this.run($,"climate",e,"climate.turn_off",{},"off",J=>this.setCmd($,J),{label:z}):this.run($,"climate",e,"climate.set_hvac_mode",{hvac_mode:u},u,J=>this.setCmd($,J),{label:z})},I=`${e}:fan`,N=this.commands[I]?.phase==="pending",L=t.fan_modes??[],V=this.live(e,"fan")??t.fan_mode??"",W=r=>{const u=r.target.value;u&&this.run(I,"climate",e,"climate.set_fan_mode",{fan_mode:u},u,z=>this.setCmd(I,z),{label:i("מאוורר {v}",{v:w("fan",u)})})},U=`${e}:preset`,j=this.commands[U]?.phase==="pending",l=t.preset_modes??[],p=this.live(e,"preset")??t.preset_mode??"",B=r=>{const u=r.target.value;u&&this.run(U,"climate",e,"climate.set_preset_mode",{preset_mode:u},u,z=>this.setCmd(U,z),{label:i("מצב מוגדר {v}",{v:w("preset",u)})})},S=`${e}:swing`,q=this.commands[S]?.phase==="pending",D=t.swing_modes??[],G=this.live(e,"swing")??t.swing_mode??"",dt=r=>{const u=r.target.value;u&&this.run(S,"climate",e,"climate.set_swing_mode",{swing_mode:u},u,z=>this.setCmd(S,z),{label:i("נדנוד {v}",{v:w("swing",u)})})},Z=`${e}:humidity`,tt=t.min_humidity??0,et=t.max_humidity??100,T=this.live(e,"humidity")??t.target_humidity,it=r=>void this.run(Z,"climate",e,"climate.set_humidity",{humidity:r},r,u=>this.setCmd(Z,u),{label:i("לחות יעד {n}%",{n:r})});return c`<div class="ctl-row" data-control="climate">
        ${b!=null?c`<sw-button size="sm" iconOnly icon="minus" label=${i("הורדת טמפרטורה")} data-control="temp-down" ?disabled=${b<=y} @click=${()=>O(C(b-H))}></sw-button>
              <span class="ctl-val" data-control="temp-value">${yt(b)}</span>
              <sw-button size="sm" iconOnly icon="plus" label=${i("העלאת טמפרטורה")} data-control="temp-up" ?disabled=${b>=M} @click=${()=>O(C(b+H))}></sw-button>`:v}
        ${K.length?c`<select class="ctl-select" data-control="mode" aria-label=${i("מצב פעולה")} ?disabled=${E} @change=${Q}>
              ${K.includes(R)?v:c`<option value="" selected disabled>${F[R]??(R||i("מצב"))}</option>`}
              ${K.map(r=>c`<option value=${r} ?selected=${r===R}>${F[r]??r}</option>`)}
            </select>`:v}
        ${L.length?c`<select class="ctl-select" data-control="fan-mode" aria-label=${i("מצב מאוורר")} ?disabled=${N} @change=${W}>
              ${L.includes(V)?v:c`<option value="" selected disabled>${w("fan",V)||i("מאוורר")}</option>`}
              ${L.map(r=>c`<option value=${r} ?selected=${r===V}>${w("fan",r)}</option>`)}
            </select>`:v}
        ${l.length?c`<select class="ctl-select" data-control="preset-mode" aria-label=${i("מצב מוגדר מראש")} ?disabled=${j} @change=${B}>
              ${l.includes(p)?v:c`<option value="" selected disabled>${w("preset",p)||i("מצב מוגדר")}</option>`}
              ${l.map(r=>c`<option value=${r} ?selected=${r===p}>${w("preset",r)}</option>`)}
            </select>`:v}
        ${D.length?c`<select class="ctl-select" data-control="swing-mode" aria-label=${i("מצב נדנוד")} ?disabled=${q} @change=${dt}>
              ${D.includes(G)?v:c`<option value="" selected disabled>${w("swing",G)||i("נדנוד")}</option>`}
              ${D.map(r=>c`<option value=${r} ?selected=${r===G}>${w("swing",r)}</option>`)}
            </select>`:v}
        ${T!=null?c`<sw-button size="sm" iconOnly icon="minus" label=${i("הפחתת לחות יעד")} data-control="humidity-down" ?disabled=${T<=tt} @click=${()=>it(Math.max(tt,T-5))}></sw-button>
              <span class="ctl-val" data-control="humidity-value">${A(T)}%</span>
              <sw-button size="sm" iconOnly icon="plus" label=${i("הגברת לחות יעד")} data-control="humidity-up" ?disabled=${T>=et} @click=${()=>it(Math.min(et,T+5))}></sw-button>`:v}
      </div>`}if(t.domain==="fan"){const g=`${e}:percentage`,y=this.live(e,"percentage")??t.percentage??0,M=H=>{const P=Number(H.target.value);this.debouncedRange(g,"fan",e,"fan.set_percentage",{percentage:P},P,b=>this.setCmd(g,b),{label:i("עוצמה {n}%",{n:P})})};return c`<div class="ctl-row" data-control="fan">
        ${this.renderPowerToggle(t)}
        <input type="range" class="ctl-range" data-control="percentage" min="0" max="100" .value=${String(y)} @input=${M} aria-label=${i("עוצמת מאוורר")} />
      </div>`}const s=`${e}:mode`,n=this.commands[s]?.phase==="pending",a=t.available_modes??[],d=this.live(e,"mode")??t.mode??"",m=g=>{const y=g.target.value;y&&this.run(s,"humidifier",e,"humidifier.set_mode",{mode:y},y,M=>this.setCmd(s,M),{label:i("מצב {v}",{v:w("hmode",y)})})},h=`${e}:humidity`,f=t.min_humidity??0,_=t.max_humidity??100,k=this.live(e,"humidity")??t.target_humidity,x=g=>void this.run(h,"humidifier",e,"humidifier.set_humidity",{humidity:g},g,y=>this.setCmd(h,y),{label:i("לחות יעד {n}%",{n:g})});return c`<div class="ctl-row" data-control="humidifier">
      ${a.length?c`<select class="ctl-select" data-control="mode" aria-label=${i("מצב לחות")} ?disabled=${n} @change=${m}>
            ${a.includes(d)?v:c`<option value="" selected disabled>${w("hmode",d)||i("מצב")}</option>`}
            ${a.map(g=>c`<option value=${g} ?selected=${g===d}>${w("hmode",g)}</option>`)}
          </select>`:v}
      ${k!=null?c`<sw-button size="sm" iconOnly icon="minus" label=${i("הפחתת לחות יעד")} data-control="humidity-down" ?disabled=${k<=f} @click=${()=>x(Math.max(f,k-5))}></sw-button>
            <span class="ctl-val" data-control="humidity-value">${A(k)}%</span>
            <sw-button size="sm" iconOnly icon="plus" label=${i("הגברת לחות יעד")} data-control="humidity-up" ?disabled=${k>=_} @click=${()=>x(Math.min(_,k+5))}></sw-button>`:v}
    </div>`}renderMediaControls(t){const e=t.entity_id,s=`${e}:mute`,n=`${e}:playpause`,a=this.live(e,"mute")??!!t.muted,d=()=>void this.run(s,"media_player",e,"media_player.volume_mute",{is_volume_muted:!a},!a,f=>this.setCmd(s,f),{label:a?i("ביטול השתקה"):i("השתקה")}),m=(this.live(e,"playpause")??t.state)==="playing",h=()=>void this.run(n,"media_player",e,m?"media_player.media_pause":"media_player.media_play",{},m?"paused":"playing",f=>this.setCmd(n,f),{label:m?i("השהיה"):i("ניגון")});return c`<div class="ctl-row" data-control="media">
      ${this.renderPowerToggle(t)}
      <sw-button size="sm" icon=${m?"pause":"play"} iconOnly label=${m?i("השהה"):i("נגן")} data-control="playpause" ?disabled=${this.commands[n]?.phase==="pending"} @click=${h}></sw-button>
      <sw-button size="sm" icon="volume" iconOnly label=${a?i("בטל השתקה"):i("השתקה")} data-control="mute" ?disabled=${this.commands[s]?.phase==="pending"} @click=${d}></sw-button>
    </div>`}renderLockControls(t,e){const s=`${t.entity_id}:lock`,n=this.commands[s]?.phase==="pending",a=this.live(t.entity_id,"lock")??(t.locked?"locked":t.state);return c`<div class="ctl-row" data-control="lock">
      ${a==="locked"?t.can_unlock?c`<sw-button size="sm" icon="unlock" data-control="unlock" ?disabled=${n} @click=${()=>e(t)}>${i("פתיחה…")}</sw-button>`:this.renderUnlockDenied(t):c`<sw-button size="sm" icon="lock" data-control="lock" ?disabled=${n} @click=${()=>void this.run(s,"lock",t.entity_id,"lock.lock",{},"locked",m=>this.setCmd(s,m),{label:i("נעילה")})}>${i("נעילה")}</sw-button>
            ${t.can_unlock&&a!=="unlocked"?c`<sw-button size="sm" icon="unlock" data-control="unlock" ?disabled=${n} @click=${()=>e(t)}>${i("פתיחה…")}</sw-button>`:v}`}
    </div>`}renderUnlockDenied(t){const e=bt(t,mt("system.configure"));return c`<span class="ctl-note" data-control="unlock-denied" data-unlock-reason=${t.unlock_reason??"unknown"} title=${e.title}>${e.text}${e.link?c` <a class="ctl-link" data-control="unlock-denied-link" href=${e.link.href}>${e.link.label}</a>`:v}</span>`}runUnlock(t){const e=`${t.entity_id}:lock`;this.run(e,"lock",t.entity_id,"lock.unlock",{},"unlocked",s=>this.setCmd(e,s),{confirmed:!0,label:i("פתיחה")})}pillStatus(t){const e=this.entityCommands(t),s=e.find(d=>X(d));if(s)return{text:`${i("ממתין לאישור")}${s.label?` · ${s.label}`:""}`,tone:"pending"};const n=e.find(d=>d.phase==="rolled_back");if(n)return{text:n.note??i("לא בוצע"),tone:"bad"};const a=e.find(d=>d.phase==="sent");return a?{text:`${i("נשלח")}${a.label?` · ${a.label}`:""}`,tone:"ok"}:null}power(t,e){const s=`${t.entity_id}:power`,n=this.commands[s];if(n?.phase==="pending"&&n.optimistic===e)return;const a=["light","input_boolean","media_player","fan"].includes(t.domain)?t.domain:"switch";this.run(s,t.domain,t.entity_id,`${a}.${e?"turn_on":"turn_off"}`,{},e,d=>this.setCmd(s,d),{label:e?i("הדלקה"):i("כיבוי"),reached:$t(t.domain,e)})}brightness(t,e){const s=Math.max(0,Math.min(100,Math.round(e)));if(s===0)return this.power(t,!1);if(!nt(t))return this.power(t,!0);const n=`${t.entity_id}:brightness`;this.debouncedRange(n,"light",t.entity_id,"light.turn_on",{brightness_pct:s},s,a=>this.setCmd(n,a),{label:i("בהירות {n}%",{n:s})})}coverKey(t,e,s){const n=s==="tilt"?{open:"open-tilt",close:"close-tilt",stop:"stop-tilt",position:"tilt-position"}:{open:"open",close:"close",stop:"stop",position:"position"};return`${t.entity_id}:${n[e]}`}coverMoving(t,e="position"){return["open","close","position"].some(s=>this.commands[this.coverKey(t,s,e)]?.phase==="pending")}coverArmed(t,e,s="position"){return this.isArmed(this.coverKey(t,e,s))}coverMove(t,e,s="position"){const n=s==="tilt",a=this.coverKey(t,e,s),d=(h,f,_,k)=>void this.run(a,"cover",t.entity_id,h,{},f,x=>this.setCmd(a,x),k?{confirmed:!0,label:_}:{label:_});if(e==="stop"){const h={...this.commands};for(const f of["open","close","position"]){const _=this.coverKey(t,f,s);Y(_),delete h[_],(_ in this.armed||_ in this.drafts)&&this.disarm(_)}this.commands=h,this.changed(),d(n?"cover.stop_cover_tilt":"cover.stop_cover","stopped",n?i("עצירת הטיה"):i("עצירה"),!1);return}const m=e==="open";this.tapArmed(a,()=>d(n?m?"cover.open_cover_tilt":"cover.close_cover_tilt":m?"cover.open_cover":"cover.close_cover",m?"open":"closed",n?m?i("פתיחת הטיה"):i("סגירת הטיה"):m?i("פתיחה"):i("סגירה"),!0))}coverStage(t,e,s="position"){const n=this.coverKey(t,"position",s);this.setDraft(n,Math.max(0,Math.min(100,Math.round(e)))),this.arm(n)}coverDraft(t,e="position"){const s=this.coverKey(t,"position",e);return this.isArmed(s)?this.drafts[s]:void 0}coverConfirm(t,e="position"){const s=this.coverKey(t,"position",e),n=this.drafts[s];if(n===void 0||!this.isArmed(s))return;this.disarm(s);const a=e==="tilt";this.run(s,"cover",t.entity_id,a?"cover.set_cover_tilt_position":"cover.set_cover_position",a?{tilt_position:n}:{position:n},n,d=>this.setCmd(s,d),{confirmed:!0,label:a?i("מיקום הטיה {n}%",{n}):i("מיקום {n}%",{n})})}coverShown(t,e="position"){return this.coverDraft(t,e)??this.live(t.entity_id,e==="tilt"?"tilt-position":"position")??(e==="tilt"?t.tilt:t.position)??0}climateTemp(t,e){const{min:s,max:n}=ot(t),a=Math.min(n,Math.max(s,Math.round(e*10)/10)),d=`${t.entity_id}:temp`;this.debouncedRange(d,"climate",t.entity_id,"climate.set_temperature",{temperature:a},a,m=>this.setCmd(d,m),{label:i("טמפרטורת יעד {n}°",{n:a})})}climateMode(t,e){const s=`${t.entity_id}:mode`,n=i("מצב {v}",{v:F[e]??e});e==="off"?this.run(s,"climate",t.entity_id,"climate.turn_off",{},"off",a=>this.setCmd(s,a),{label:n}):this.run(s,"climate",t.entity_id,"climate.set_hvac_mode",{hvac_mode:e},e,a=>this.setCmd(s,a),{label:n})}climateChoice(t,e,s){const n=`${t.entity_id}:${e==="hmode"?"mode":e}`,a=e==="fan"?["climate.set_fan_mode","fan_mode",i("מאוורר")]:e==="preset"?["climate.set_preset_mode","preset_mode",i("מצב מוגדר")]:e==="swing"?["climate.set_swing_mode","swing_mode",i("נדנוד")]:["humidifier.set_mode","mode",i("מצב")];this.run(n,e==="hmode"?"humidifier":"climate",t.entity_id,a[0],{[a[1]]:s},s,d=>this.setCmd(n,d),{label:`${a[2]} ${w(e,s)}`})}humidity(t,e){const s=Math.min(t.max_humidity??100,Math.max(t.min_humidity??0,Math.round(e))),n=`${t.entity_id}:humidity`,a=t.domain==="humidifier"?"humidifier":"climate";this.run(n,a,t.entity_id,`${a}.set_humidity`,{humidity:s},s,d=>this.setCmd(n,d),{label:i("לחות יעד {n}%",{n:s})})}fanPercentage(t,e){const s=Math.max(0,Math.min(100,Math.round(e))),n=`${t.entity_id}:percentage`;this.debouncedRange(n,"fan",t.entity_id,"fan.set_percentage",{percentage:s},s,a=>this.setCmd(n,a),{label:i("עוצמה {n}%",{n:s})})}mediaPlayPause(t){const e=`${t.entity_id}:playpause`;if(this.commands[e]?.phase==="pending")return;const s=(this.live(t.entity_id,"playpause")??t.state)==="playing";this.run(e,"media_player",t.entity_id,s?"media_player.media_pause":"media_player.media_play",{},s?"paused":"playing",n=>this.setCmd(e,n),{label:s?i("השהיה"):i("ניגון")})}mediaMute(t){const e=`${t.entity_id}:mute`;if(this.commands[e]?.phase==="pending")return;const s=this.live(t.entity_id,"mute")??!!t.muted;this.run(e,"media_player",t.entity_id,"media_player.volume_mute",{is_volume_muted:!s},!s,n=>this.setCmd(e,n),{label:s?i("ביטול השתקה"):i("השתקה")})}}export{At as D,xt as E,yt as a,zt as d,Mt as r};
