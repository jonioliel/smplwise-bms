class e{constructor(){this.seq=0}begin(){const s=++this.seq;return()=>s===this.seq}cancel(){this.seq+=1}}export{e as L};
