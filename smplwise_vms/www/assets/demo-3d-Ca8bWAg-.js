import{E as x,F as h,a as b,e as E,H as k,ey as $,aS as f,ez as g,eA as _}from"./index-Dspqd-4d.js";var P=Object.defineProperty,C=Object.getOwnPropertyDescriptor,d=(o,t,s,n)=>{for(var i=n>1?void 0:n?C(t,s):t,r=o.length-1,a;r>=0;r--)(a=o[r])&&(i=(n?a(t,s,i):a(i))||i);return n&&i&&P(t,s,i),i};let l=class extends b{constructor(){super(...arguments),this.heading="",this.x=0,this.y=0,this.stageWidth=0,this.stageHeight=0,this.opener=null,this.onFocusIn=o=>{const t=o.relatedTarget;t&&!this.contains(t)&&!this.shadowRoot?.contains(t)&&(this.opener=t)},this.onKey=o=>{if(o.key!=="Escape"||o.defaultPrevented)return;const t=o.composedPath()[0];if(t instanceof HTMLElement&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.tagName==="SELECT"||t.isContentEditable))return;o.preventDefault(),o.stopPropagation();const s=this.opener;this.opener=null,this.close(),s?.isConnected&&requestAnimationFrame(()=>s.focus({preventScroll:!0}))}}connectedCallback(){super.connectedCallback(),this.setAttribute("role","dialog"),this.setAttribute("aria-modal","false"),this.addEventListener("keydown",this.onKey),this.addEventListener("focusin",this.onFocusIn)}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("keydown",this.onKey),this.removeEventListener("focusin",this.onFocusIn),this.opener=null}willUpdate(){this.heading&&this.setAttribute("aria-label",this.heading)}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}updated(){const t=this.offsetHeight||260,s=16;let n=this.x+s;this.stageWidth&&n+268>this.stageWidth-8&&(n=Math.max(8,this.x-268-s));let i=this.y-t/2;this.stageHeight&&(i=Math.max(8,Math.min(this.stageHeight-t-8,i))),this.style.left=`${n}px`,this.style.top=`${Math.max(8,i)}px`}render(){return E`
      <header><h4>${this.heading}</h4><sw-button variant="ghost" size="sm" iconOnly icon="close" label="סגור" @click=${this.close}></sw-button></header>
      <slot></slot>
      <footer><slot name="footer"></slot></footer>
    `}};l.styles=x`
    :host {
      position: absolute;
      z-index: var(--sw-z-drawer);
      inline-size: 268px;
      max-inline-size: calc(100% - 24px);
      /* a popover is a menu surface: opaque in every skin, scheme and glass screen, nothing blurred behind it (owner 2026-10-13) */
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3);
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      animation: pop var(--sw-t-med) var(--sw-ease);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    h4 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    footer {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    footer:not(:has(*)) {
      display: none;
    }
    @keyframes pop {
      from {
        opacity: 0;
        transform: translateY(4px);
      }
    }
  `;d([h()],l.prototype,"heading",2);d([h({type:Number})],l.prototype,"x",2);d([h({type:Number})],l.prototype,"y",2);d([h({type:Number})],l.prototype,"stageWidth",2);d([h({type:Number})],l.prototype,"stageHeight",2);l=d([k("sw-popover")],l);const L=60,z=o=>o.startsWith("light.")?{shape:"cylinder",color_token:"light",role:"light",mesh:null}:{shape:"box",color_token:"furniture",role:"furniture",mesh:null},m=(o,t,s,n,i)=>({id:o,item_id:t,level_id:"L0",position:s,rotation_deg:0,size:n,z_m:i,params:{},label:null,anchor_ref:null,group_id:null,confidence:1,source:"manual",locked:!1,external_ids:{}});function N(o){const t=$.find(e=>e.id===o),s=f(o);if(!t?.hasPlan||!s.length)return null;const n=[],i=[],r=[];s.forEach((e,c)=>{const p=`dw${c}`;n.push({id:p,level_id:"L0",polyline:[[e.x,e.y],[e.x+e.w,e.y],[e.x+e.w,e.y+e.h],[e.x,e.y+e.h],[e.x,e.y]],thickness_m:.15,height_m:null,base_z_m:0,kind:"interior",confidence:1,source:"manual",locked:!1,external_ids:{}}),i.push({id:`do${c}`,wall_id:p,t:.12,kind:"door",width_m:.9,height_m:2.1,sill_m:0,swing:"left",hinge:"start",anchor_ref:null,confidence:1,source:"manual",external_ids:{}}),r.push(m(`dl${c}`,"light.ceiling",[e.x+e.w/2,e.y+e.h/2],{w_m:.4,d_m:.4,h_m:.1},-.3))});const a=s[0];for(let e=0;e<6;e++)r.push(m(`dc${e}`,"chair.basic",[a.x+a.w*(.25+.25*(e%3)),a.y+a.h*(.35+.3*Math.floor(e/3))],{w_m:.45,d_m:.45,h_m:.85},0));const y={schema_version:"2.0",plan_version_id:`demo-${o}`,floor_id:o,source:{sha256:"",file_name:"demo",mime:"image/svg+xml",page:1},dimensions:{width_px:t.planWidth,height_px:t.planHeight,scale_m_per_px:1/L,calibration:{status:"measured",method:"manual",pairs:[],residual_pct:null,reason:null}},transform:{rotation:0,crop:null},levels:[{id:"L0",name:"קומה",elevation_m:0,ceiling_height_m:3,is_default:!0}],walls:n,openings:i,rooms:[],objects:r,circuits:[],connectors:[],labels:[],groups:[],uncertain_regions:[],uncertainty:{overall:0,notes:[]},meta:{generator:"demo",tokens_version:"map-1",detector_version:null}},w=g.filter(e=>e.floorId===o),u=_.filter(e=>e.floorId===o),v=[...w.map(e=>({id:e.id,resource_type:"camera",resource_id:e.id,x:e.x,y:e.y,rotation:e.rotation,fov:e.fov,radius:null,polygon:null,level_id:null,layer_id:"cameras",label:e.name,state:null,online:e.state!=="offline",mount_height_m:null,tilt_deg:null})),...u.map(e=>({id:e.id,resource_type:"ha_entity",resource_id:e.id,x:e.x,y:e.y,rotation:0,fov:null,radius:null,polygon:null,level_id:null,layer_id:e.domain==="lock"?"doors":e.domain==="light"?"lights":"sensors",label:e.name,state:e.state,online:null,mount_height_m:null,tilt_deg:null}))];return{doc:y,width:t.planWidth,height:t.planHeight,anchors:v,entityStates:Object.fromEntries(u.map(e=>[e.id,e.state])),circuitStates:{},catalog:z,zones:[]}}function S(o){const t={};for(const s of g)s.floorId===o&&(t[s.id]=s.name);for(const s of _)s.floorId===o&&(t[s.id]=s.name);f(o).forEach((s,n)=>{t[`dw${n}`]="קיר",t[`do${n}`]="דלת",t[`dl${n}`]="מנורת תקרה"});for(let s=0;s<6;s++)t[`dc${s}`]="כיסא";return t}export{S as a,N as d};
//# sourceMappingURL=demo-3d-Ca8bWAg-.js.map
