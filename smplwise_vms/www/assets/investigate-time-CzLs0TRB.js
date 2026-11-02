function i(o,u=Date.now()){const t=Math.round((u-new Date(o).getTime())/1e3);if(!Number.isFinite(t)||t<0)return null;if(t<60)return"לפני רגע";const n=Math.floor(t/60);if(n<60)return`לפני ${n} דק׳`;const r=Math.floor(n/60);if(r<24)return`לפני ${r} שע׳`;const e=Math.floor(r/24);return e===1?"אתמול":e<=7?`לפני ${e} ימים`:null}export{i as a};
//# sourceMappingURL=investigate-time-CzLs0TRB.js.map
