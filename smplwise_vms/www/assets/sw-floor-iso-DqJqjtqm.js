import{j as d,z as f,a as y,ai as h,b as c,A as m,m as x}from"./index-D3xHkfje.js";import{a as u}from"./scene-builder-DvhxEr1O.js";var v=Object.defineProperty,g=Object.getOwnPropertyDescriptor,n=(o,t,e,i)=>{for(var s=i>1?void 0:i?g(t,e):t,a=o.length-1,l;a>=0;a--)(l=o[a])&&(s=(i?l(t,e,s):l(s))||s);return i&&s&&v(t,e,s),s};let r=class extends y{constructor(){super(...arguments),this.rooms=[],this.iso=null,this.selected=!1,this.empty=!1,this.width=132}iso2(o,t){return u(o,t)}poly(o){return o.map(t=>`${t.x.toFixed(1)},${t.y.toFixed(1)}`).join(" ")}isoBox(o){let[t,e,i,s]=[0,0,120,72];for(const a of o.faces)for(const[l,p]of a.points)t=Math.min(t,l-1),e=Math.min(e,p-1),i=Math.max(i,l+1),s=Math.max(s,p+1);return`${t} ${e} ${i-t} ${s-e}`}updated(){this.setAttribute("data-iso",this.iso?"real":"demo")}render(){if(this.style.setProperty("--w",`${this.width}px`),this.iso)return c`<svg class="real" viewBox=${this.isoBox(this.iso)} aria-hidden="true">
        ${this.iso.faces.map(s=>h`<polygon class=${s.face==="plate"?"plate":s.face==="side"?"side f-side":"top f-top"} style=${`--fc: var(--sw-${s.color}); opacity: ${s.opacity}`} points=${s.points.map(a=>`${a[0]},${a[1]}`).join(" ")} />`)}
      </svg>`;const o=[this.iso2(0,0),this.iso2(1,0),this.iso2(1,1),this.iso2(0,1)],t=7,e=[this.iso2(1,0),this.iso2(1,1),{x:this.iso2(1,1).x,y:this.iso2(1,1).y+t},{x:this.iso2(1,0).x,y:this.iso2(1,0).y+t}],i=[this.iso2(0,1),this.iso2(1,1),{x:this.iso2(1,1).x,y:this.iso2(1,1).y+t},{x:this.iso2(0,1).x,y:this.iso2(0,1).y+t}];return c`<svg viewBox="0 0 120 72" aria-hidden="true">
      ${h`<polygon class="side" points=${this.poly(e)} /><polygon class="side" points=${this.poly(i)} />`}
      ${h`<polygon class="top" points=${this.poly(o)} />`}
      ${this.empty?m:this.rooms.map(s=>h`<polygon class="room" points=${this.poly([this.iso2(s.x,s.y),this.iso2(s.x+s.w,s.y),this.iso2(s.x+s.w,s.y+s.h),this.iso2(s.x,s.y+s.h)])} />`)}
    </svg>`}};r.styles=d`
    :host {
      display: inline-block;
      inline-size: var(--w, 132px);
      flex-shrink: 0;
      /* COLOR-LITERAL-A-2480: the drawing's fixed face and edge colours, written once (the same literals) */
      --fi-face: #ffffff;
      --fi-edge: #b7c3d4;
      --fi-tone: #aab7cc; /* a face whose colour token is missing */
    }
    svg {
      display: block;
      inline-size: 100%;
      block-size: auto;
      overflow: visible;
    }
    /* the true isometric keeps the thumbnail box of the demo drawing and fits its faces inside it */
    svg.real {
      aspect-ratio: 120 / 72;
    }
    .side {
      fill: #cfd7e3;
    }
    .top {
      fill: var(--fi-face);
      stroke: var(--fi-edge);
      stroke-width: 1.2;
      stroke-linejoin: round;
    }
    .room {
      fill: none;
      stroke: var(--fi-edge);
      stroke-width: 1;
      stroke-linejoin: round;
    }
    /* the true isometric: a token colour per face, sides darkened, the plate as the slab top */
    polygon.plate {
      fill: var(--fi-face);
      stroke: var(--fi-edge);
      stroke-width: 1;
      stroke-linejoin: round;
    }
    polygon.f-side {
      fill: color-mix(in srgb, var(--fc, var(--fi-tone)) 72%, #1f2937 28%);
      stroke: none;
    }
    polygon.f-top {
      fill: var(--fc, var(--fi-tone));
      stroke: none;
    }
    :host([selected]) .side {
      fill: #9db9ff;
    }
    :host([selected]) .top,
    :host([selected]) polygon.plate {
      fill: #dbe6ff;
      stroke: var(--sw-accent);
    }
    :host([selected]) .room {
      stroke: var(--sw-accent);
    }
    :host([empty]) .top {
      fill: #f6f8fb;
      stroke-dasharray: 3 3;
    }
  `;n([f({attribute:!1})],r.prototype,"rooms",2);n([f({attribute:!1})],r.prototype,"iso",2);n([f({type:Boolean,reflect:!0})],r.prototype,"selected",2);n([f({type:Boolean,reflect:!0})],r.prototype,"empty",2);n([f({type:Number})],r.prototype,"width",2);r=n([x("sw-floor-iso")],r);
