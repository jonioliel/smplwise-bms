import{i as p,n as a,a as c,q as l,x as v}from"./index-Cif9Bwbo.js";var b=Object.defineProperty,f=Object.getOwnPropertyDescriptor,r=(i,s,n,o)=>{for(var t=o>1?void 0:o?f(s,n):s,h=i.length-1,d;h>=0;h--)(d=i[h])&&(t=(o?d(s,n,t):d(t))||t);return o&&t&&b(s,n,t),t};let e=class extends c{constructor(){super(...arguments),this.variant="text",this.lines=1,this.width="100%",this.height="",this.size="32px"}render(){if(this.variant==="circle")return l`<div class="b" aria-hidden="true" style="inline-size:${this.size};block-size:${this.size}"></div>`;if(this.variant==="block")return l`<div class="b" aria-hidden="true" style="inline-size:${this.width};block-size:${this.height||"96px"}"></div>`;const i=Math.max(1,Math.min(12,Math.floor(this.lines)||1));return l`${Array.from({length:i},(s,n)=>l`<div class="b" aria-hidden="true" style="inline-size:${i>1&&n===i-1?"62%":this.width}"></div>`)}`}};e.styles=p`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-inline-size: 0;
    }
    .b {
      position: relative;
      overflow: hidden;
      background: var(--sw-skeleton);
      border-radius: var(--sw-r-xs);
    }
    .b::after {
      content: '';
      position: absolute;
      inset: 0;
      transform: translateX(100%);
      background: linear-gradient(90deg, transparent, var(--sw-skeleton-shine), transparent);
      animation: shine 1.4s ease-in-out infinite;
    }
    :host([variant='text']) .b {
      block-size: 0.8em;
      font-size: var(--sw-fs-md);
    }
    :host([variant='circle']) .b {
      border-radius: 50%;
      flex: none;
    }
    :host([variant='block']) .b {
      border-radius: var(--sw-r-md);
    }
    @keyframes shine {
      to {
        transform: translateX(-100%);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .b::after {
        animation: none;
        opacity: 0;
      }
    }
  `;r([a({reflect:!0})],e.prototype,"variant",2);r([a({type:Number})],e.prototype,"lines",2);r([a()],e.prototype,"width",2);r([a()],e.prototype,"height",2);r([a()],e.prototype,"size",2);e=r([v("sw-skeleton")],e);
//# sourceMappingURL=sw-skeleton-Bfn-M-r0.js.map
