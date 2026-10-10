/* SmplWise Arx - Plan Studio 6 prototype bundle. three.js 0.186.1 (MIT, see LICENSES.md). Built 2026-10-10. */
(()=>{var Yn={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},jn={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},Cf=0,Xh=1,Rf=2;var Zn=1,Pf=2,gr=3,rn=0,ti=1,Dt=2,Bt=0,xr=1,ys=2,qh=3,Yh=4,wl=5;var Ri=100,Lf=101,If=102,Df=103,Nf=104,Ms=200,Uf=201,Of=202,Ff=203,jh=204,Zh=205,Io=206,Bf=207,Do=208,kf=209,zf=210,Hf=211,Vf=212,Gf=213,Wf=214,Ya=0,ja=1,Za=2,Js=3,Ka=4,Ja=5,Qa=6,$a=7,Tl=0,Xf=1,qf=2,Si=0,No=1,Uo=2,Oo=3,Fo=4,Bo=5,ko=6,Kn=7,Ch="attached",Yf="detached",Kh=300,Jn=301,bs=302,El=303,Al=304,zo=306,Xt=1e3,pi=1001,Qs=1002,bt=1003,Cl=1004;var Ss=1005;var It=1006,_r=1007;var Gi=1008;var li=1009,Jh=1010,Qh=1011,vr=1012,Rl=1013,Wi=1014,wi=1015,wt=1016,Pl=1017,Ll=1018,Qn=1020,$h=35902,eu=35899,tu=1021,iu=1022,fi=1023,Ji=1026,on=1027,Il=1028,Dl=1029,$n=1030,Nl=1031;var Ul=1033,Ho=33776,Vo=33777,Go=33778,Wo=33779,Ol=35840,Fl=35841,Bl=35842,kl=35843,zl=36196,Hl=37492,Vl=37496,Gl=37488,Wl=37489,Xo=37490,Xl=37491,ql=37808,Yl=37809,jl=37810,Zl=37811,Kl=37812,Jl=37813,Ql=37814,$l=37815,ec=37816,tc=37817,ic=37818,nc=37819,sc=37820,rc=37821,oc=36492,ac=36494,lc=36495,cc=36283,hc=36284,qo=36285,uc=36286;var ls=2300,cs=2301,Wa=2302,Rh=2303,Ph=2400,Lh=2401,Ih=2402,jf=2500;var nu=0,Yo=1,yr=2,Zf=3200;var Mr=0,Kf=1,Pi="",Mt="srgb",di="srgb-linear",Jr="linear",ht="srgb";var Xa=7680;var Jf=519,Qf=512,$f=513,ep=514,dc=515,tp=516,ip=517,fc=518,np=519,su=35044;var ru="300 es",Hi=2e3,$s=2001;function Um(s){for(let e=s.length-1;e>=0;--e)if(s[e]>=65535)return!0;return!1}function Om(s){return ArrayBuffer.isView(s)&&!(s instanceof DataView)}function er(s){return document.createElementNS("http://www.w3.org/1999/xhtml",s)}function sp(){let s=er("canvas");return s.style.display="block",s}var Nd={},tr=null;function Qr(...s){let e="THREE."+s.shift();tr?tr("log",e,...s):console.log(e,...s)}function rp(s){let e=s[0];if(typeof e=="string"&&e.startsWith("TSL:")){let t=s[1];t&&t.isStackTrace?s[0]+=" "+t.getLocation():s[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return s}function Ge(...s){s=rp(s);let e="THREE."+s.shift();if(tr)tr("warn",e,...s);else{let t=s[0];t&&t.isStackTrace?console.warn(t.getError(e)):console.warn(e,...s)}}function Ke(...s){s=rp(s);let e="THREE."+s.shift();if(tr)tr("error",e,...s);else{let t=s[0];t&&t.isStackTrace?console.error(t.getError(e)):console.error(e,...s)}}function as(...s){let e=s.join(" ");e in Nd||(Nd[e]=!0,Ge(...s))}function op(s,e,t){return new Promise(function(i,n){function r(){switch(s.clientWaitSync(e,s.SYNC_FLUSH_COMMANDS_BIT,0)){case s.WAIT_FAILED:n();break;case s.TIMEOUT_EXPIRED:setTimeout(r,t);break;default:i()}}setTimeout(r,t)})}var ap={[Ya]:ja,[Za]:Qa,[Ka]:$a,[Js]:Ja,[ja]:Ya,[Qa]:Za,[$a]:Ka,[Ja]:Js},Vi=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let i=this._listeners;i[e]===void 0&&(i[e]=[]),i[e].indexOf(t)===-1&&i[e].push(t)}hasEventListener(e,t){let i=this._listeners;return i===void 0?!1:i[e]!==void 0&&i[e].indexOf(t)!==-1}removeEventListener(e,t){let i=this._listeners;if(i===void 0)return;let n=i[e];if(n!==void 0){let r=n.indexOf(t);r!==-1&&n.splice(r,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let i=t[e.type];if(i!==void 0){e.target=this;let n=i.slice(0);for(let r=0,o=n.length;r<o;r++)n[r].call(this,e);e.target=null}}},si=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],Ud=1234567,Yr=Math.PI/180,hs=180/Math.PI;function Ai(){let s=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(si[s&255]+si[s>>8&255]+si[s>>16&255]+si[s>>24&255]+"-"+si[e&255]+si[e>>8&255]+"-"+si[e>>16&15|64]+si[e>>24&255]+"-"+si[t&63|128]+si[t>>8&255]+"-"+si[t>>16&255]+si[t>>24&255]+si[i&255]+si[i>>8&255]+si[i>>16&255]+si[i>>24&255]).toLowerCase()}function it(s,e,t){return Math.max(e,Math.min(t,s))}function ou(s,e){return(s%e+e)%e}function Fm(s,e,t,i,n){return i+(s-e)*(n-i)/(t-e)}function Bm(s,e,t){return s!==e?(t-s)/(e-s):0}function jr(s,e,t){return(1-t)*s+t*e}function km(s,e,t,i){return jr(s,e,1-Math.exp(-t*i))}function zm(s,e=1){return e-Math.abs(ou(s,e*2)-e)}function Hm(s,e,t){return s<=e?0:s>=t?1:(s=(s-e)/(t-e),s*s*(3-2*s))}function Vm(s,e,t){return s<=e?0:s>=t?1:(s=(s-e)/(t-e),s*s*s*(s*(s*6-15)+10))}function Gm(s,e){return s+Math.floor(Math.random()*(e-s+1))}function Wm(s,e){return s+Math.random()*(e-s)}function Xm(s){return s*(.5-Math.random())}function qm(s){s!==void 0&&(Ud=s);let e=Ud+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function Ym(s){return s*Yr}function jm(s){return s*hs}function Zm(s){return s>0&&Number.isInteger(s)&&2**Math.round(Math.log2(s))===s}function Km(s){return Math.pow(2,Math.ceil(Math.log(s)/Math.LN2))}function Jm(s){return Math.pow(2,Math.floor(Math.log(s)/Math.LN2))}function Qm(s,e,t,i,n){let r=Math.cos,o=Math.sin,a=r(t/2),l=o(t/2),c=r((e+i)/2),h=o((e+i)/2),f=r((e-i)/2),d=o((e-i)/2),u=r((i-e)/2),p=o((i-e)/2);switch(n){case"XYX":s.set(a*h,l*f,l*d,a*c);break;case"YZY":s.set(l*d,a*h,l*f,a*c);break;case"ZXZ":s.set(l*f,l*d,a*h,a*c);break;case"XZX":s.set(a*h,l*p,l*u,a*c);break;case"YXY":s.set(l*u,a*h,l*p,a*c);break;case"ZYZ":s.set(l*p,l*u,a*h,a*c);break;default:Ge("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+n)}}function zi(s,e){switch(e.constructor){case Float32Array:return s;case Uint32Array:return s/4294967295;case Uint16Array:return s/65535;case Uint8Array:case Uint8ClampedArray:return s/255;case Int32Array:return Math.max(s/2147483647,-1);case Int16Array:return Math.max(s/32767,-1);case Int8Array:return Math.max(s/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function mt(s,e){switch(e.constructor){case Float32Array:return s;case Uint32Array:return Math.round(s*4294967295);case Uint16Array:return Math.round(s*65535);case Uint8Array:case Uint8ClampedArray:return Math.round(s*255);case Int32Array:return Math.round(s*2147483647);case Int16Array:return Math.round(s*32767);case Int8Array:return Math.round(s*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var jo={DEG2RAD:Yr,RAD2DEG:hs,generateUUID:Ai,clamp:it,euclideanModulo:ou,mapLinear:Fm,inverseLerp:Bm,lerp:jr,damp:km,pingpong:zm,smoothstep:Hm,smootherstep:Vm,randInt:Gm,randFloat:Wm,randFloatSpread:Xm,seededRandom:qm,degToRad:Ym,radToDeg:jm,isPowerOfTwo:Zm,ceilPowerOfTwo:Km,floorPowerOfTwo:Jm,setQuaternionFromProperEuler:Qm,normalize:mt,denormalize:zi},du=class du{constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,i=this.y,n=e.elements;return this.x=n[0]*t+n[3]*i+n[6],this.y=n[1]*t+n[4]*i+n[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=it(this.x,e.x,t.x),this.y=it(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=it(this.x,e,t),this.y=it(this.y,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(it(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let i=this.dot(e)/t;return Math.acos(it(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,i=this.y-e.y;return t*t+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let i=Math.cos(t),n=Math.sin(t),r=this.x-e.x,o=this.y-e.y;return this.x=r*i-o*n+e.x,this.y=r*n+o*i+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}};du.prototype.isVector2=!0;var ee=du,Qt=class{constructor(e=0,t=0,i=0,n=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=i,this._w=n}static slerpFlat(e,t,i,n,r,o,a){let l=i[n+0],c=i[n+1],h=i[n+2],f=i[n+3],d=r[o+0],u=r[o+1],p=r[o+2],x=r[o+3];if(f!==x||l!==d||c!==u||h!==p){let m=l*d+c*u+h*p+f*x;m<0&&(d=-d,u=-u,p=-p,x=-x,m=-m);let g=1-a;if(m<.9995){let S=Math.acos(m),T=Math.sin(S);g=Math.sin(g*S)/T,a=Math.sin(a*S)/T,l=l*g+d*a,c=c*g+u*a,h=h*g+p*a,f=f*g+x*a}else{l=l*g+d*a,c=c*g+u*a,h=h*g+p*a,f=f*g+x*a;let S=1/Math.sqrt(l*l+c*c+h*h+f*f);l*=S,c*=S,h*=S,f*=S}}e[t]=l,e[t+1]=c,e[t+2]=h,e[t+3]=f}static multiplyQuaternionsFlat(e,t,i,n,r,o){let a=i[n],l=i[n+1],c=i[n+2],h=i[n+3],f=r[o],d=r[o+1],u=r[o+2],p=r[o+3];return e[t]=a*p+h*f+l*u-c*d,e[t+1]=l*p+h*d+c*f-a*u,e[t+2]=c*p+h*u+a*d-l*f,e[t+3]=h*p-a*f-l*d-c*u,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,i,n){return this._x=e,this._y=t,this._z=i,this._w=n,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let i=e._x,n=e._y,r=e._z,o=e._order,a=Math.cos,l=Math.sin,c=a(i/2),h=a(n/2),f=a(r/2),d=l(i/2),u=l(n/2),p=l(r/2);switch(o){case"XYZ":this._x=d*h*f+c*u*p,this._y=c*u*f-d*h*p,this._z=c*h*p+d*u*f,this._w=c*h*f-d*u*p;break;case"YXZ":this._x=d*h*f+c*u*p,this._y=c*u*f-d*h*p,this._z=c*h*p-d*u*f,this._w=c*h*f+d*u*p;break;case"ZXY":this._x=d*h*f-c*u*p,this._y=c*u*f+d*h*p,this._z=c*h*p+d*u*f,this._w=c*h*f-d*u*p;break;case"ZYX":this._x=d*h*f-c*u*p,this._y=c*u*f+d*h*p,this._z=c*h*p-d*u*f,this._w=c*h*f+d*u*p;break;case"YZX":this._x=d*h*f+c*u*p,this._y=c*u*f+d*h*p,this._z=c*h*p-d*u*f,this._w=c*h*f-d*u*p;break;case"XZY":this._x=d*h*f-c*u*p,this._y=c*u*f-d*h*p,this._z=c*h*p+d*u*f,this._w=c*h*f+d*u*p;break;default:Ge("Quaternion: .setFromEuler() encountered an unknown order: "+o)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let i=t/2,n=Math.sin(i);return this._x=e.x*n,this._y=e.y*n,this._z=e.z*n,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,i=t[0],n=t[4],r=t[8],o=t[1],a=t[5],l=t[9],c=t[2],h=t[6],f=t[10],d=i+a+f;if(d>0){let u=.5/Math.sqrt(d+1);this._w=.25/u,this._x=(h-l)*u,this._y=(r-c)*u,this._z=(o-n)*u}else if(i>a&&i>f){let u=2*Math.sqrt(1+i-a-f);this._w=(h-l)/u,this._x=.25*u,this._y=(n+o)/u,this._z=(r+c)/u}else if(a>f){let u=2*Math.sqrt(1+a-i-f);this._w=(r-c)/u,this._x=(n+o)/u,this._y=.25*u,this._z=(l+h)/u}else{let u=2*Math.sqrt(1+f-i-a);this._w=(o-n)/u,this._x=(r+c)/u,this._y=(l+h)/u,this._z=.25*u}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let i=e.dot(t)+1;return i<1e-8?(i=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=i):(this._x=0,this._y=-e.z,this._z=e.y,this._w=i)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=i),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(it(this.dot(e),-1,1)))}rotateTowards(e,t){let i=this.angleTo(e);if(i===0)return this;let n=Math.min(1,t/i);return this.slerp(e,n),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let i=e._x,n=e._y,r=e._z,o=e._w,a=t._x,l=t._y,c=t._z,h=t._w;return this._x=i*h+o*a+n*c-r*l,this._y=n*h+o*l+r*a-i*c,this._z=r*h+o*c+i*l-n*a,this._w=o*h-i*a-n*l-r*c,this._onChangeCallback(),this}slerp(e,t){let i=e._x,n=e._y,r=e._z,o=e._w,a=this.dot(e);a<0&&(i=-i,n=-n,r=-r,o=-o,a=-a);let l=1-t;if(a<.9995){let c=Math.acos(a),h=Math.sin(c);l=Math.sin(l*c)/h,t=Math.sin(t*c)/h,this._x=this._x*l+i*t,this._y=this._y*l+n*t,this._z=this._z*l+r*t,this._w=this._w*l+o*t,this._onChangeCallback()}else this._x=this._x*l+i*t,this._y=this._y*l+n*t,this._z=this._z*l+r*t,this._w=this._w*l+o*t,this.normalize();return this}slerpQuaternions(e,t,i){return this.copy(e).slerp(t,i)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),i=Math.random(),n=Math.sqrt(1-i),r=Math.sqrt(i);return this.set(n*Math.sin(e),n*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},fu=class fu{constructor(e=0,t=0,i=0){this.x=e,this.y=t,this.z=i}set(e,t,i){return i===void 0&&(i=this.z),this.x=e,this.y=t,this.z=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Od.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Od.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,i=this.y,n=this.z,r=e.elements;return this.x=r[0]*t+r[3]*i+r[6]*n,this.y=r[1]*t+r[4]*i+r[7]*n,this.z=r[2]*t+r[5]*i+r[8]*n,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,i=this.y,n=this.z,r=e.elements,o=1/(r[3]*t+r[7]*i+r[11]*n+r[15]);return this.x=(r[0]*t+r[4]*i+r[8]*n+r[12])*o,this.y=(r[1]*t+r[5]*i+r[9]*n+r[13])*o,this.z=(r[2]*t+r[6]*i+r[10]*n+r[14])*o,this}applyQuaternion(e){let t=this.x,i=this.y,n=this.z,r=e.x,o=e.y,a=e.z,l=e.w,c=2*(o*n-a*i),h=2*(a*t-r*n),f=2*(r*i-o*t);return this.x=t+l*c+o*f-a*h,this.y=i+l*h+a*c-r*f,this.z=n+l*f+r*h-o*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,i=this.y,n=this.z,r=e.elements;return this.x=r[0]*t+r[4]*i+r[8]*n,this.y=r[1]*t+r[5]*i+r[9]*n,this.z=r[2]*t+r[6]*i+r[10]*n,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=it(this.x,e.x,t.x),this.y=it(this.y,e.y,t.y),this.z=it(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=it(this.x,e,t),this.y=it(this.y,e,t),this.z=it(this.z,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(it(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let i=e.x,n=e.y,r=e.z,o=t.x,a=t.y,l=t.z;return this.x=n*l-r*a,this.y=r*o-i*l,this.z=i*a-n*o,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let i=e.dot(this)/t;return this.copy(e).multiplyScalar(i)}projectOnPlane(e){return eh.copy(this).projectOnVector(e),this.sub(eh)}reflect(e){return this.sub(eh.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let i=this.dot(e)/t;return Math.acos(it(i,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,i=this.y-e.y,n=this.z-e.z;return t*t+i*i+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,i){let n=Math.sin(t)*e;return this.x=n*Math.sin(i),this.y=Math.cos(t)*e,this.z=n*Math.cos(i),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,i){return this.x=e*Math.sin(t),this.y=i,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),i=this.setFromMatrixColumn(e,1).length(),n=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=i,this.z=n,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,i=Math.sqrt(1-t*t);return this.x=i*Math.cos(e),this.y=t,this.z=i*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}};fu.prototype.isVector3=!0;var D=fu,eh=new D,Od=new Qt,pu=class pu{constructor(e,t,i,n,r,o,a,l,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,i,n,r,o,a,l,c)}set(e,t,i,n,r,o,a,l,c){let h=this.elements;return h[0]=e,h[1]=n,h[2]=a,h[3]=t,h[4]=r,h[5]=l,h[6]=i,h[7]=o,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],this}extractBasis(e,t,i){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let i=e.elements,n=t.elements,r=this.elements,o=i[0],a=i[3],l=i[6],c=i[1],h=i[4],f=i[7],d=i[2],u=i[5],p=i[8],x=n[0],m=n[3],g=n[6],S=n[1],T=n[4],_=n[7],v=n[2],E=n[5],A=n[8];return r[0]=o*x+a*S+l*v,r[3]=o*m+a*T+l*E,r[6]=o*g+a*_+l*A,r[1]=c*x+h*S+f*v,r[4]=c*m+h*T+f*E,r[7]=c*g+h*_+f*A,r[2]=d*x+u*S+p*v,r[5]=d*m+u*T+p*E,r[8]=d*g+u*_+p*A,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],i=e[1],n=e[2],r=e[3],o=e[4],a=e[5],l=e[6],c=e[7],h=e[8];return t*o*h-t*a*c-i*r*h+i*a*l+n*r*c-n*o*l}invert(){let e=this.elements,t=e[0],i=e[1],n=e[2],r=e[3],o=e[4],a=e[5],l=e[6],c=e[7],h=e[8],f=h*o-a*c,d=a*l-h*r,u=c*r-o*l,p=t*f+i*d+n*u;if(p===0)return this.set(0,0,0,0,0,0,0,0,0);let x=1/p;return e[0]=f*x,e[1]=(n*c-h*i)*x,e[2]=(a*i-n*o)*x,e[3]=d*x,e[4]=(h*t-n*l)*x,e[5]=(n*r-a*t)*x,e[6]=u*x,e[7]=(i*l-c*t)*x,e[8]=(o*t-i*r)*x,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,i,n,r,o,a){let l=Math.cos(r),c=Math.sin(r);return this.set(i*l,i*c,-i*(l*o+c*a)+o+e,-n*c,n*l,-n*(-c*o+l*a)+a+t,0,0,1),this}scale(e,t){return as("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(th.makeScale(e,t)),this}rotate(e){return as("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(th.makeRotation(-e)),this}translate(e,t){return as("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(th.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,i,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,i=e.elements;for(let n=0;n<9;n++)if(t[n]!==i[n])return!1;return!0}fromArray(e,t=0){for(let i=0;i<9;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){let i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e}clone(){return new this.constructor().fromArray(this.elements)}};pu.prototype.isMatrix3=!0;var Qe=pu,th=new Qe,Fd=new Qe().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Bd=new Qe().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function $m(){let s={enabled:!0,workingColorSpace:di,spaces:{},convert:function(n,r,o){return this.enabled===!1||r===o||!r||!o||(this.spaces[r].transfer===ht&&(n.r=yn(n.r),n.g=yn(n.g),n.b=yn(n.b)),this.spaces[r].primaries!==this.spaces[o].primaries&&(n.applyMatrix3(this.spaces[r].toXYZ),n.applyMatrix3(this.spaces[o].fromXYZ)),this.spaces[o].transfer===ht&&(n.r=Ks(n.r),n.g=Ks(n.g),n.b=Ks(n.b))),n},workingToColorSpace:function(n,r){return this.convert(n,this.workingColorSpace,r)},colorSpaceToWorking:function(n,r){return this.convert(n,r,this.workingColorSpace)},getPrimaries:function(n){return this.spaces[n].primaries},getTransfer:function(n){return n===Pi?Jr:this.spaces[n].transfer},getToneMappingMode:function(n){return this.spaces[n].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(n,r=this.workingColorSpace){return n.fromArray(this.spaces[r].luminanceCoefficients)},define:function(n){Object.assign(this.spaces,n)},_getMatrix:function(n,r,o){return n.copy(this.spaces[r].toXYZ).multiply(this.spaces[o].fromXYZ)},_getDrawingBufferColorSpace:function(n){return this.spaces[n].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(n=this.workingColorSpace){return this.spaces[n].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(n,r){return as("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),s.workingToColorSpace(n,r)},toWorkingColorSpace:function(n,r){return as("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),s.colorSpaceToWorking(n,r)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],i=[.3127,.329];return s.define({[di]:{primaries:e,whitePoint:i,transfer:Jr,toXYZ:Fd,fromXYZ:Bd,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:Mt},outputColorSpaceConfig:{drawingBufferColorSpace:Mt}},[Mt]:{primaries:e,whitePoint:i,transfer:ht,toXYZ:Fd,fromXYZ:Bd,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:Mt}}}),s}var tt=$m();function yn(s){return s<.04045?s*.0773993808:Math.pow(s*.9478672986+.0521327014,2.4)}function Ks(s){return s<.0031308?s*12.92:1.055*Math.pow(s,.41666)-.055}var Is,el=class{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let i;if(e instanceof HTMLCanvasElement)i=e;else{Is===void 0&&(Is=er("canvas")),Is.width=e.width,Is.height=e.height;let n=Is.getContext("2d");e instanceof ImageData?n.putImageData(e,0,0):n.drawImage(e,0,0,e.width,e.height),i=Is}return i.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=er("canvas");t.width=e.width,t.height=e.height;let i=t.getContext("2d");i.drawImage(e,0,0,e.width,e.height);let n=i.getImageData(0,0,e.width,e.height),r=n.data;for(let o=0;o<r.length;o++)r[o]=yn(r[o]/255)*255;return i.putImageData(n,0,0),t}else if(e.data){let t=e.data.slice(0);for(let i=0;i<t.length;i++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[i]=Math.floor(yn(t[i]/255)*255):t[i]=yn(t[i]);return{data:t,width:e.width,height:e.height}}else return Ge("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},e0=0,ir=class{constructor(e=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:e0++}),this.uuid=Ai(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let i={uuid:this.uuid,url:""},n=this.data;if(n!==null){let r;if(Array.isArray(n)){r=[];for(let o=0,a=n.length;o<a;o++)n[o].isDataTexture?r.push(ih(n[o].image)):r.push(ih(n[o]))}else r=ih(n);i.url=r}return t||(e.images[this.uuid]=i),i}};function ih(s){return typeof HTMLImageElement<"u"&&s instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&s instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&s instanceof ImageBitmap?el.getDataURL(s):s.data?{data:Array.from(s.data),width:s.width,height:s.height,type:s.data.constructor.name}:(Ge("Texture: Unable to serialize Texture."),{})}var t0=0,nh=new D,Ot=class s extends Vi{constructor(e=s.DEFAULT_IMAGE,t=s.DEFAULT_MAPPING,i=pi,n=pi,r=It,o=Gi,a=fi,l=li,c=s.DEFAULT_ANISOTROPY,h=Pi){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:t0++}),this.uuid=Ai(),this.name="",this.source=new ir(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=i,this.wrapT=n,this.magFilter=r,this.minFilter=o,this.anisotropy=c,this.format=a,this.internalFormat=null,this.type=l,this.offset=new ee(0,0),this.repeat=new ee(1,1),this.center=new ee(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Qe,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(nh).x}get height(){return this.source.getSize(nh).y}get depth(){return this.source.getSize(nh).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let i=e[t];if(i===void 0){Ge(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let n=this[t];if(n===void 0){Ge(`Texture.setValues(): property '${t}' does not exist.`);continue}n&&i&&n.isVector2&&i.isVector2||n&&i&&n.isVector3&&i.isVector3||n&&i&&n.isMatrix3&&i.isMatrix3?n.copy(i):this[t]=i}}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let i={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),t||(e.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==Kh)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Xt:e.x=e.x-Math.floor(e.x);break;case pi:e.x=e.x<0?0:1;break;case Qs:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Xt:e.y=e.y-Math.floor(e.y);break;case pi:e.y=e.y<0?0:1;break;case Qs:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};Ot.DEFAULT_IMAGE=null;Ot.DEFAULT_MAPPING=Kh;Ot.DEFAULT_ANISOTROPY=1;var mu=class mu{constructor(e=0,t=0,i=0,n=1){this.x=e,this.y=t,this.z=i,this.w=n}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,i,n){return this.x=e,this.y=t,this.z=i,this.w=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,i=this.y,n=this.z,r=this.w,o=e.elements;return this.x=o[0]*t+o[4]*i+o[8]*n+o[12]*r,this.y=o[1]*t+o[5]*i+o[9]*n+o[13]*r,this.z=o[2]*t+o[6]*i+o[10]*n+o[14]*r,this.w=o[3]*t+o[7]*i+o[11]*n+o[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,i,n,r,l=e.elements,c=l[0],h=l[4],f=l[8],d=l[1],u=l[5],p=l[9],x=l[2],m=l[6],g=l[10];if(Math.abs(h-d)<.01&&Math.abs(f-x)<.01&&Math.abs(p-m)<.01){if(Math.abs(h+d)<.1&&Math.abs(f+x)<.1&&Math.abs(p+m)<.1&&Math.abs(c+u+g-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let T=(c+1)/2,_=(u+1)/2,v=(g+1)/2,E=(h+d)/4,A=(f+x)/4,y=(p+m)/4;return T>_&&T>v?T<.01?(i=0,n=.707106781,r=.707106781):(i=Math.sqrt(T),n=E/i,r=A/i):_>v?_<.01?(i=.707106781,n=0,r=.707106781):(n=Math.sqrt(_),i=E/n,r=y/n):v<.01?(i=.707106781,n=.707106781,r=0):(r=Math.sqrt(v),i=A/r,n=y/r),this.set(i,n,r,t),this}let S=Math.sqrt((m-p)*(m-p)+(f-x)*(f-x)+(d-h)*(d-h));return Math.abs(S)<.001&&(S=1),this.x=(m-p)/S,this.y=(f-x)/S,this.z=(d-h)/S,this.w=Math.acos((c+u+g-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=it(this.x,e.x,t.x),this.y=it(this.y,e.y,t.y),this.z=it(this.z,e.z,t.z),this.w=it(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=it(this.x,e,t),this.y=it(this.y,e,t),this.z=it(this.z,e,t),this.w=it(this.w,e,t),this}clampLength(e,t){let i=this.length();return this.divideScalar(i||1).multiplyScalar(it(i,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,i){return this.x=e.x+(t.x-e.x)*i,this.y=e.y+(t.y-e.y)*i,this.z=e.z+(t.z-e.z)*i,this.w=e.w+(t.w-e.w)*i,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}};mu.prototype.isVector4=!0;var ut=mu,tl=class extends Vi{constructor(e=1,t=1,i={}){super(),i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:It,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},i),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=i.depth,this.scissor=new ut(0,0,e,t),this.scissorTest=!1,this.viewport=new ut(0,0,e,t),this.textures=[];let n={width:e,height:t,depth:i.depth},r=new Ot(n),o=i.count;for(let a=0;a<o;a++)this.textures[a]=r.clone(),this.textures[a].isRenderTargetTexture=!0,this.textures[a].renderTarget=this;this._setTextureOptions(i),this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveColorBuffer=i.resolveColorBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this.storeMultisampledColorBuffer=i.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=i.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=i.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=i.depthTexture,this.samples=i.samples,this.multiview=i.multiview,this.useArrayDepthTexture=i.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:It,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let i=0;i<this.textures.length;i++)this.textures[i].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&this._depthTexture.renderTarget===this&&(this._depthTexture.renderTarget=null),e!==null&&e.renderTarget===null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,i=1){if(this.width!==e||this.height!==t||this.depth!==i){this.width=e,this.height=t,this.depth=i;for(let n=0,r=this.textures.length;n<r;n++)this.textures[n].image.width=e,this.textures[n].image.height=t,this.textures[n].image.depth=i,this.textures[n].isData3DTexture!==!0&&(this.textures[n].isArrayTexture=this.textures[n].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,i=e.textures.length;t<i;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let n=Object.assign({},e.textures[t].image);this.textures[t].source=new ir(n)}if(this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveColorBuffer=e.resolveColorBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,this.storeMultisampledColorBuffer=e.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=e.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=e.storeMultisampledStencilBuffer,e.depthTexture!==null)if(e.depthTexture.renderTarget===e){let t=e.depthTexture.clone();t.renderTarget=null,this.depthTexture=t}else this.depthTexture=e.depthTexture;return this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},dt=class extends tl{constructor(e=1,t=1,i={}){super(e,t,i),this.isWebGLRenderTarget=!0}},$r=class extends Ot{constructor(e=null,t=1,i=1,n=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:i,depth:n},this.magFilter=bt,this.minFilter=bt,this.wrapR=pi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}};var il=class extends Ot{constructor(e=null,t=1,i=1,n=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:i,depth:n},this.magFilter=bt,this.minFilter=bt,this.wrapR=pi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}};var Sl=class Sl{constructor(e,t,i,n,r,o,a,l,c,h,f,d,u,p,x,m){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,i,n,r,o,a,l,c,h,f,d,u,p,x,m)}set(e,t,i,n,r,o,a,l,c,h,f,d,u,p,x,m){let g=this.elements;return g[0]=e,g[4]=t,g[8]=i,g[12]=n,g[1]=r,g[5]=o,g[9]=a,g[13]=l,g[2]=c,g[6]=h,g[10]=f,g[14]=d,g[3]=u,g[7]=p,g[11]=x,g[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Sl().fromArray(this.elements)}copy(e){let t=this.elements,i=e.elements;return t[0]=i[0],t[1]=i[1],t[2]=i[2],t[3]=i[3],t[4]=i[4],t[5]=i[5],t[6]=i[6],t[7]=i[7],t[8]=i[8],t[9]=i[9],t[10]=i[10],t[11]=i[11],t[12]=i[12],t[13]=i[13],t[14]=i[14],t[15]=i[15],this}copyPosition(e){let t=this.elements,i=e.elements;return t[12]=i[12],t[13]=i[13],t[14]=i[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,i){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),i.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this)}makeBasis(e,t,i){return this.set(e.x,t.x,i.x,0,e.y,t.y,i.y,0,e.z,t.z,i.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,i=e.elements,n=1/Ds.setFromMatrixColumn(e,0).length(),r=1/Ds.setFromMatrixColumn(e,1).length(),o=1/Ds.setFromMatrixColumn(e,2).length();return t[0]=i[0]*n,t[1]=i[1]*n,t[2]=i[2]*n,t[3]=0,t[4]=i[4]*r,t[5]=i[5]*r,t[6]=i[6]*r,t[7]=0,t[8]=i[8]*o,t[9]=i[9]*o,t[10]=i[10]*o,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,i=e.x,n=e.y,r=e.z,o=Math.cos(i),a=Math.sin(i),l=Math.cos(n),c=Math.sin(n),h=Math.cos(r),f=Math.sin(r);if(e.order==="XYZ"){let d=o*h,u=o*f,p=a*h,x=a*f;t[0]=l*h,t[4]=-l*f,t[8]=c,t[1]=u+p*c,t[5]=d-x*c,t[9]=-a*l,t[2]=x-d*c,t[6]=p+u*c,t[10]=o*l}else if(e.order==="YXZ"){let d=l*h,u=l*f,p=c*h,x=c*f;t[0]=d+x*a,t[4]=p*a-u,t[8]=o*c,t[1]=o*f,t[5]=o*h,t[9]=-a,t[2]=u*a-p,t[6]=x+d*a,t[10]=o*l}else if(e.order==="ZXY"){let d=l*h,u=l*f,p=c*h,x=c*f;t[0]=d-x*a,t[4]=-o*f,t[8]=p+u*a,t[1]=u+p*a,t[5]=o*h,t[9]=x-d*a,t[2]=-o*c,t[6]=a,t[10]=o*l}else if(e.order==="ZYX"){let d=o*h,u=o*f,p=a*h,x=a*f;t[0]=l*h,t[4]=p*c-u,t[8]=d*c+x,t[1]=l*f,t[5]=x*c+d,t[9]=u*c-p,t[2]=-c,t[6]=a*l,t[10]=o*l}else if(e.order==="YZX"){let d=o*l,u=o*c,p=a*l,x=a*c;t[0]=l*h,t[4]=x-d*f,t[8]=p*f+u,t[1]=f,t[5]=o*h,t[9]=-a*h,t[2]=-c*h,t[6]=u*f+p,t[10]=d-x*f}else if(e.order==="XZY"){let d=o*l,u=o*c,p=a*l,x=a*c;t[0]=l*h,t[4]=-f,t[8]=c*h,t[1]=d*f+x,t[5]=o*h,t[9]=u*f-p,t[2]=p*f-u,t[6]=a*h,t[10]=x*f+d}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(i0,e,n0)}lookAt(e,t,i){let n=this.elements;return vi.subVectors(e,t),vi.lengthSq()===0&&(vi.z=1),vi.normalize(),Un.crossVectors(i,vi),Un.lengthSq()===0&&(Math.abs(i.z)===1?vi.x+=1e-4:vi.z+=1e-4,vi.normalize(),Un.crossVectors(i,vi)),Un.normalize(),pa.crossVectors(vi,Un),n[0]=Un.x,n[4]=pa.x,n[8]=vi.x,n[1]=Un.y,n[5]=pa.y,n[9]=vi.y,n[2]=Un.z,n[6]=pa.z,n[10]=vi.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let i=e.elements,n=t.elements,r=this.elements,o=i[0],a=i[4],l=i[8],c=i[12],h=i[1],f=i[5],d=i[9],u=i[13],p=i[2],x=i[6],m=i[10],g=i[14],S=i[3],T=i[7],_=i[11],v=i[15],E=n[0],A=n[4],y=n[8],R=n[12],I=n[1],L=n[5],b=n[9],w=n[13],P=n[2],U=n[6],F=n[10],O=n[14],z=n[3],k=n[7],G=n[11],Y=n[15];return r[0]=o*E+a*I+l*P+c*z,r[4]=o*A+a*L+l*U+c*k,r[8]=o*y+a*b+l*F+c*G,r[12]=o*R+a*w+l*O+c*Y,r[1]=h*E+f*I+d*P+u*z,r[5]=h*A+f*L+d*U+u*k,r[9]=h*y+f*b+d*F+u*G,r[13]=h*R+f*w+d*O+u*Y,r[2]=p*E+x*I+m*P+g*z,r[6]=p*A+x*L+m*U+g*k,r[10]=p*y+x*b+m*F+g*G,r[14]=p*R+x*w+m*O+g*Y,r[3]=S*E+T*I+_*P+v*z,r[7]=S*A+T*L+_*U+v*k,r[11]=S*y+T*b+_*F+v*G,r[15]=S*R+T*w+_*O+v*Y,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],i=e[4],n=e[8],r=e[12],o=e[1],a=e[5],l=e[9],c=e[13],h=e[2],f=e[6],d=e[10],u=e[14],p=e[3],x=e[7],m=e[11],g=e[15],S=l*u-c*d,T=a*u-c*f,_=a*d-l*f,v=o*u-c*h,E=o*d-l*h,A=o*f-a*h;return t*(x*S-m*T+g*_)-i*(p*S-m*v+g*E)+n*(p*T-x*v+g*A)-r*(p*_-x*E+m*A)}determinantAffine(){let e=this.elements,t=e[0],i=e[4],n=e[8],r=e[1],o=e[5],a=e[9],l=e[2],c=e[6],h=e[10];return t*(o*h-a*c)-i*(r*h-a*l)+n*(r*c-o*l)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,i){let n=this.elements;return e.isVector3?(n[12]=e.x,n[13]=e.y,n[14]=e.z):(n[12]=e,n[13]=t,n[14]=i),this}invert(){let e=this.elements,t=e[0],i=e[1],n=e[2],r=e[3],o=e[4],a=e[5],l=e[6],c=e[7],h=e[8],f=e[9],d=e[10],u=e[11],p=e[12],x=e[13],m=e[14],g=e[15],S=t*a-i*o,T=t*l-n*o,_=t*c-r*o,v=i*l-n*a,E=i*c-r*a,A=n*c-r*l,y=h*x-f*p,R=h*m-d*p,I=h*g-u*p,L=f*m-d*x,b=f*g-u*x,w=d*g-u*m,P=S*w-T*b+_*L+v*I-E*R+A*y;if(P===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let U=1/P;return e[0]=(a*w-l*b+c*L)*U,e[1]=(n*b-i*w-r*L)*U,e[2]=(x*A-m*E+g*v)*U,e[3]=(d*E-f*A-u*v)*U,e[4]=(l*I-o*w-c*R)*U,e[5]=(t*w-n*I+r*R)*U,e[6]=(m*_-p*A-g*T)*U,e[7]=(h*A-d*_+u*T)*U,e[8]=(o*b-a*I+c*y)*U,e[9]=(i*I-t*b-r*y)*U,e[10]=(p*E-x*_+g*S)*U,e[11]=(f*_-h*E-u*S)*U,e[12]=(a*R-o*L-l*y)*U,e[13]=(t*L-i*R+n*y)*U,e[14]=(x*T-p*v-m*S)*U,e[15]=(h*v-f*T+d*S)*U,this}scale(e){let t=this.elements,i=e.x,n=e.y,r=e.z;return t[0]*=i,t[4]*=n,t[8]*=r,t[1]*=i,t[5]*=n,t[9]*=r,t[2]*=i,t[6]*=n,t[10]*=r,t[3]*=i,t[7]*=n,t[11]*=r,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],i=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],n=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,i,n))}makeTranslation(e,t,i){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,i,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),i=Math.sin(e);return this.set(1,0,0,0,0,t,-i,0,0,i,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,0,i,0,0,1,0,0,-i,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),i=Math.sin(e);return this.set(t,-i,0,0,i,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let i=Math.cos(t),n=Math.sin(t),r=1-i,o=e.x,a=e.y,l=e.z,c=r*o,h=r*a;return this.set(c*o+i,c*a-n*l,c*l+n*a,0,c*a+n*l,h*a+i,h*l-n*o,0,c*l-n*a,h*l+n*o,r*l*l+i,0,0,0,0,1),this}makeScale(e,t,i){return this.set(e,0,0,0,0,t,0,0,0,0,i,0,0,0,0,1),this}makeShear(e,t,i,n,r,o){return this.set(1,i,r,0,e,1,o,0,t,n,1,0,0,0,0,1),this}compose(e,t,i){let n=this.elements,r=t._x,o=t._y,a=t._z,l=t._w,c=r+r,h=o+o,f=a+a,d=r*c,u=r*h,p=r*f,x=o*h,m=o*f,g=a*f,S=l*c,T=l*h,_=l*f,v=i.x,E=i.y,A=i.z;return n[0]=(1-(x+g))*v,n[1]=(u+_)*v,n[2]=(p-T)*v,n[3]=0,n[4]=(u-_)*E,n[5]=(1-(d+g))*E,n[6]=(m+S)*E,n[7]=0,n[8]=(p+T)*A,n[9]=(m-S)*A,n[10]=(1-(d+x))*A,n[11]=0,n[12]=e.x,n[13]=e.y,n[14]=e.z,n[15]=1,this}decompose(e,t,i){let n=this.elements;e.x=n[12],e.y=n[13],e.z=n[14];let r=this.determinantAffine();if(r===0)return i.set(1,1,1),t.identity(),this;let o=Ds.set(n[0],n[1],n[2]).length(),a=Ds.set(n[4],n[5],n[6]).length(),l=Ds.set(n[8],n[9],n[10]).length();r<0&&(o=-o),Fi.copy(this);let c=1/o,h=1/a,f=1/l;return Fi.elements[0]*=c,Fi.elements[1]*=c,Fi.elements[2]*=c,Fi.elements[4]*=h,Fi.elements[5]*=h,Fi.elements[6]*=h,Fi.elements[8]*=f,Fi.elements[9]*=f,Fi.elements[10]*=f,t.setFromRotationMatrix(Fi),i.x=o,i.y=a,i.z=l,this}makePerspective(e,t,i,n,r,o,a=Hi,l=!1){let c=this.elements,h=2*r/(t-e),f=2*r/(i-n),d=(t+e)/(t-e),u=(i+n)/(i-n),p,x;if(l)p=r/(o-r),x=o*r/(o-r);else if(a===Hi)p=-(o+r)/(o-r),x=-2*o*r/(o-r);else if(a===$s)p=-o/(o-r),x=-o*r/(o-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return c[0]=h,c[4]=0,c[8]=d,c[12]=0,c[1]=0,c[5]=f,c[9]=u,c[13]=0,c[2]=0,c[6]=0,c[10]=p,c[14]=x,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,i,n,r,o,a=Hi,l=!1){let c=this.elements,h=2/(t-e),f=2/(i-n),d=-(t+e)/(t-e),u=-(i+n)/(i-n),p,x;if(l)p=1/(o-r),x=o/(o-r);else if(a===Hi)p=-2/(o-r),x=-(o+r)/(o-r);else if(a===$s)p=-1/(o-r),x=-r/(o-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return c[0]=h,c[4]=0,c[8]=0,c[12]=d,c[1]=0,c[5]=f,c[9]=0,c[13]=u,c[2]=0,c[6]=0,c[10]=p,c[14]=x,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){let t=this.elements,i=e.elements;for(let n=0;n<16;n++)if(t[n]!==i[n])return!1;return!0}fromArray(e,t=0){for(let i=0;i<16;i++)this.elements[i]=e[i+t];return this}toArray(e=[],t=0){let i=this.elements;return e[t]=i[0],e[t+1]=i[1],e[t+2]=i[2],e[t+3]=i[3],e[t+4]=i[4],e[t+5]=i[5],e[t+6]=i[6],e[t+7]=i[7],e[t+8]=i[8],e[t+9]=i[9],e[t+10]=i[10],e[t+11]=i[11],e[t+12]=i[12],e[t+13]=i[13],e[t+14]=i[14],e[t+15]=i[15],e}};Sl.prototype.isMatrix4=!0;var We=Sl,Ds=new D,Fi=new We,i0=new D(0,0,0),n0=new D(1,1,1),Un=new D,pa=new D,vi=new D,kd=new We,zd=new Qt,Qi=class s{constructor(e=0,t=0,i=0,n=s.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=i,this._order=n}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,i,n=this._order){return this._x=e,this._y=t,this._z=i,this._order=n,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,i=!0){let n=e.elements,r=n[0],o=n[4],a=n[8],l=n[1],c=n[5],h=n[9],f=n[2],d=n[6],u=n[10];switch(t){case"XYZ":this._y=Math.asin(it(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-h,u),this._z=Math.atan2(-o,r)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-it(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(a,u),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-f,r),this._z=0);break;case"ZXY":this._x=Math.asin(it(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-f,u),this._z=Math.atan2(-o,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-it(f,-1,1)),Math.abs(f)<.9999999?(this._x=Math.atan2(d,u),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-o,c));break;case"YZX":this._z=Math.asin(it(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-f,r)):(this._x=0,this._y=Math.atan2(a,u));break;case"XZY":this._z=Math.asin(-it(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(a,r)):(this._x=Math.atan2(-h,u),this._y=0);break;default:Ge("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,i===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,i){return kd.makeRotationFromQuaternion(e),this.setFromRotationMatrix(kd,t,i)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return zd.setFromEuler(this),this.setFromQuaternion(zd,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Qi.DEFAULT_ORDER="XYZ";var nr=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}},s0=0,Hd=new D,Ns=new Qt,fn=new We,ma=new D,Ur=new D,r0=new D,o0=new Qt,Vd=new D(1,0,0),Gd=new D(0,1,0),Wd=new D(0,0,1),Xd={type:"added"},a0={type:"removed"},Us={type:"childadded",child:null},sh={type:"childremoved",child:null},Rt=class s extends Vi{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:s0++}),this.uuid=Ai(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=s.DEFAULT_UP.clone();let e=new D,t=new Qi,i=new Qt,n=new D(1,1,1);function r(){i.setFromEuler(t,!1)}function o(){t.setFromQuaternion(i,void 0,!1)}t._onChange(r),i._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:n},modelViewMatrix:{value:new We},normalMatrix:{value:new Qe}}),this.matrix=new We,this.matrixWorld=new We,this.matrixAutoUpdate=s.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=s.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new nr,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return Ns.setFromAxisAngle(e,t),this.quaternion.multiply(Ns),this}rotateOnWorldAxis(e,t){return Ns.setFromAxisAngle(e,t),this.quaternion.premultiply(Ns),this}rotateX(e){return this.rotateOnAxis(Vd,e)}rotateY(e){return this.rotateOnAxis(Gd,e)}rotateZ(e){return this.rotateOnAxis(Wd,e)}translateOnAxis(e,t){return Hd.copy(e).applyQuaternion(this.quaternion),this.position.add(Hd.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Vd,e)}translateY(e){return this.translateOnAxis(Gd,e)}translateZ(e){return this.translateOnAxis(Wd,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(fn.copy(this.matrixWorld).invert())}lookAt(e,t,i){e.isVector3?ma.copy(e):ma.set(e,t,i);let n=this.parent;this.updateWorldMatrix(!0,!1),Ur.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?fn.lookAt(Ur,ma,this.up):fn.lookAt(ma,Ur,this.up),this.quaternion.setFromRotationMatrix(fn),n&&(fn.extractRotation(n.matrixWorld),Ns.setFromRotationMatrix(fn),this.quaternion.premultiply(Ns.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(Ke("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Xd),Us.child=e,this.dispatchEvent(Us),Us.child=null):Ke("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(a0),sh.child=e,this.dispatchEvent(sh),sh.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),fn.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),fn.multiply(e.parent.matrixWorld)),e.applyMatrix4(fn),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Xd),Us.child=e,this.dispatchEvent(Us),Us.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let i=0,n=this.children.length;i<n;i++){let o=this.children[i].getObjectByProperty(e,t);if(o!==void 0)return o}}getObjectsByProperty(e,t,i=[]){this[e]===t&&i.push(this);let n=this.children;for(let r=0,o=n.length;r<o;r++)n[r].getObjectsByProperty(e,t,i);return i}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ur,e,r0),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ur,o0,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}intersectsFrustum(){}traverse(e){e(this);let t=this.children;for(let i=0,n=t.length;i<n;i++)t[i].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let i=0,n=t.length;i<n;i++)t[i].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let t=e.x,i=e.y,n=e.z,r=this.matrix.elements;r[12]+=t-r[0]*t-r[4]*i-r[8]*n,r[13]+=i-r[1]*t-r[5]*i-r[9]*n,r[14]+=n-r[2]*t-r[6]*i-r[10]*n}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let i=0,n=t.length;i<n;i++)t[i].updateMatrixWorld(e)}updateWorldMatrix(e,t,i=!1){let n=this.parent;if(e===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||i)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,i=!0),t===!0){let r=this.children;for(let o=0,a=r.length;o<a;o++)r[o].updateWorldMatrix(!1,!0,i)}}toJSON(e){let t=e===void 0||typeof e=="string",i={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let n={};n.uuid=this.uuid,n.type=this.type,n.name=this.name,n.castShadow=this.castShadow,n.receiveShadow=this.receiveShadow,n.visible=this.visible,n.frustumCulled=this.frustumCulled,n.renderOrder=this.renderOrder,n.static=this.static,n.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(n.userData=this.userData),n.layers=this.layers.mask,n.matrix=this.matrix.toArray(),n.up=this.up.toArray(),this.pivot!==null&&(n.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(n.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(n.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(n.type="InstancedMesh",n.count=this.count,n.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(n.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(n.type="BatchedMesh",n.perObjectFrustumCulled=this.perObjectFrustumCulled,n.sortObjects=this.sortObjects,n.drawRanges=this._drawRanges,n.reservedRanges=this._reservedRanges,n.geometryInfo=this._geometryInfo.map(a=>({...a,boundingBox:a.boundingBox?a.boundingBox.toJSON():void 0,boundingSphere:a.boundingSphere?a.boundingSphere.toJSON():void 0})),n.instanceInfo=this._instanceInfo.map(a=>({...a})),n.availableInstanceIds=this._availableInstanceIds.slice(),n.availableGeometryIds=this._availableGeometryIds.slice(),n.nextIndexStart=this._nextIndexStart,n.nextVertexStart=this._nextVertexStart,n.geometryCount=this._geometryCount,n.maxInstanceCount=this._maxInstanceCount,n.maxVertexCount=this._maxVertexCount,n.maxIndexCount=this._maxIndexCount,n.geometryInitialized=this._geometryInitialized,n.matricesTexture=this._matricesTexture.toJSON(e),n.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(n.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(n.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(n.boundingBox=this.boundingBox.toJSON()));function r(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?n.background=this.background.toJSON():this.background.isTexture&&(n.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(n.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){n.geometry=r(e.geometries,this.geometry);let a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){let l=a.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){let f=l[c];r(e.shapes,f)}else r(e.shapes,l)}}if(this.isSkinnedMesh&&(n.bindMode=this.bindMode,n.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(e.skeletons,this.skeleton),n.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let a=[];for(let l=0,c=this.material.length;l<c;l++)a.push(r(e.materials,this.material[l]));n.material=a}else n.material=r(e.materials,this.material);if(this.children.length>0){n.children=[];for(let a=0;a<this.children.length;a++)n.children.push(this.children[a].toJSON(e).object)}if(this.animations.length>0){n.animations=[];for(let a=0;a<this.animations.length;a++){let l=this.animations[a];n.animations.push(r(e.animations,l))}}if(t){let a=o(e.geometries),l=o(e.materials),c=o(e.textures),h=o(e.images),f=o(e.shapes),d=o(e.skeletons),u=o(e.animations),p=o(e.nodes);a.length>0&&(i.geometries=a),l.length>0&&(i.materials=l),c.length>0&&(i.textures=c),h.length>0&&(i.images=h),f.length>0&&(i.shapes=f),d.length>0&&(i.skeletons=d),u.length>0&&(i.animations=u),p.length>0&&(i.nodes=p)}return i.object=n,i;function o(a){let l=[];for(let c in a){let h=a[c];delete h.metadata,l.push(h)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let i=0;i<e.children.length;i++){let n=e.children[i];this.add(n.clone())}return this}dispose(){this.dispatchEvent({type:"dispose"})}};Rt.DEFAULT_UP=new D(0,1,0);Rt.DEFAULT_MATRIX_AUTO_UPDATE=!0;Rt.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var Gt=class extends Rt{constructor(){super(),this.isGroup=!0,this.type="Group"}},l0={type:"move"},sr=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Gt,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Gt,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new D,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new D),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Gt,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new D,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new D,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let i of e.hand.values())this._getHandJoint(t,i)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,i){let n=null,r=null,o=null,a=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){o=!0;for(let x of e.hand.values()){let m=t.getJointPose(x,i),g=this._getHandJoint(c,x);m!==null&&(g.matrix.fromArray(m.transform.matrix),g.matrix.decompose(g.position,g.rotation,g.scale),g.matrixWorldNeedsUpdate=!0,g.jointRadius=m.radius),g.visible=m!==null}let h=c.joints["index-finger-tip"],f=c.joints["thumb-tip"],d=h.position.distanceTo(f.position),u=.02,p=.005;c.inputState.pinching&&d>u+p?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&d<=u-p&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,i),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:e,target:this})));a!==null&&(n=t.getPose(e.targetRaySpace,i),n===null&&r!==null&&(n=r),n!==null&&(a.matrix.fromArray(n.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,n.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(n.linearVelocity)):a.hasLinearVelocity=!1,n.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(n.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(l0)))}return a!==null&&(a.visible=n!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=o!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let i=new Gt;i.matrixAutoUpdate=!1,i.visible=!1,e.joints[t.jointName]=i,e.add(i)}return e.joints[t.jointName]}},lp={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},On={h:0,s:0,l:0},ga={h:0,s:0,l:0};function rh(s,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?s+(e-s)*6*t:t<1/2?e:t<2/3?s+(e-s)*6*(2/3-t):s}var Me=class{constructor(e,t,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,i)}set(e,t,i){if(t===void 0&&i===void 0){let n=e;n&&n.isColor?this.copy(n):typeof n=="number"?this.setHex(n):typeof n=="string"&&this.setStyle(n)}else this.setRGB(e,t,i);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Mt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,tt.colorSpaceToWorking(this,t),this}setRGB(e,t,i,n=tt.workingColorSpace){return this.r=e,this.g=t,this.b=i,tt.colorSpaceToWorking(this,n),this}setHSL(e,t,i,n=tt.workingColorSpace){if(e=ou(e,1),t=it(t,0,1),i=it(i,0,1),t===0)this.r=this.g=this.b=i;else{let r=i<=.5?i*(1+t):i+t-i*t,o=2*i-r;this.r=rh(o,r,e+1/3),this.g=rh(o,r,e),this.b=rh(o,r,e-1/3)}return tt.colorSpaceToWorking(this,n),this}setStyle(e,t=Mt){function i(r){r!==void 0&&parseFloat(r)<1&&Ge("Color: Alpha component of "+e+" will be ignored.")}let n;if(n=/^(\w+)\(([^\)]*)\)/.exec(e)){let r,o=n[1],a=n[2];switch(o){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:Ge("Color: Unknown color model "+e)}}else if(n=/^\#([A-Fa-f\d]+)$/.exec(e)){let r=n[1],o=r.length;if(o===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(o===6)return this.setHex(parseInt(r,16),t);Ge("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Mt){let i=lp[e.toLowerCase()];return i!==void 0?this.setHex(i,t):Ge("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=yn(e.r),this.g=yn(e.g),this.b=yn(e.b),this}copyLinearToSRGB(e){return this.r=Ks(e.r),this.g=Ks(e.g),this.b=Ks(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Mt){return tt.workingToColorSpace(ri.copy(this),e),Math.round(it(ri.r*255,0,255))*65536+Math.round(it(ri.g*255,0,255))*256+Math.round(it(ri.b*255,0,255))}getHexString(e=Mt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=tt.workingColorSpace){tt.workingToColorSpace(ri.copy(this),t);let i=ri.r,n=ri.g,r=ri.b,o=Math.max(i,n,r),a=Math.min(i,n,r),l,c,h=(a+o)/2;if(a===o)l=0,c=0;else{let f=o-a;switch(c=h<=.5?f/(o+a):f/(2-o-a),o){case i:l=(n-r)/f+(n<r?6:0);break;case n:l=(r-i)/f+2;break;case r:l=(i-n)/f+4;break}l/=6}return e.h=l,e.s=c,e.l=h,e}getRGB(e,t=tt.workingColorSpace){return tt.workingToColorSpace(ri.copy(this),t),e.r=ri.r,e.g=ri.g,e.b=ri.b,e}getStyle(e=Mt){tt.workingToColorSpace(ri.copy(this),e);let t=ri.r,i=ri.g,n=ri.b;return e!==Mt?`color(${e} ${t.toFixed(3)} ${i.toFixed(3)} ${n.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(i*255)},${Math.round(n*255)})`}offsetHSL(e,t,i){return this.getHSL(On),this.setHSL(On.h+e,On.s+t,On.l+i)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,i){return this.r=e.r+(t.r-e.r)*i,this.g=e.g+(t.g-e.g)*i,this.b=e.b+(t.b-e.b)*i,this}lerpHSL(e,t){this.getHSL(On),e.getHSL(ga);let i=jr(On.h,ga.h,t),n=jr(On.s,ga.s,t),r=jr(On.l,ga.l,t);return this.setHSL(i,n,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,i=this.g,n=this.b,r=e.elements;return this.r=r[0]*t+r[3]*i+r[6]*n,this.g=r[1]*t+r[4]*i+r[7]*n,this.b=r[2]*t+r[5]*i+r[8]*n,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},ri=new Me;Me.NAMES=lp;var eo=class s{constructor(e,t=25e-5){this.isFogExp2=!0,this.name="",this.color=new Me(e),this.density=t}clone(){return new s(this.color,this.density)}toJSON(){return{type:"FogExp2",name:this.name,color:this.color.getHex(),density:this.density}}};var rr=class extends Rt{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Qi,this.environmentIntensity=1,this.environmentRotation=new Qi,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),t.object.backgroundBlurriness=this.backgroundBlurriness,t.object.backgroundIntensity=this.backgroundIntensity,t.object.backgroundRotation=this.backgroundRotation.toArray(),t.object.environmentIntensity=this.environmentIntensity,t.object.environmentRotation=this.environmentRotation.toArray(),t}},Bi=new D,pn=new D,oh=new D,mn=new D,Os=new D,Fs=new D,qd=new D,ah=new D,lh=new D,ch=new D,hh=new ut,uh=new ut,dh=new ut,vn=class s{constructor(e=new D,t=new D,i=new D){this.a=e,this.b=t,this.c=i}static getNormal(e,t,i,n){n.subVectors(i,t),Bi.subVectors(e,t),n.cross(Bi);let r=n.lengthSq();return r>0?n.multiplyScalar(1/Math.sqrt(r)):n.set(0,0,0)}static getBarycoord(e,t,i,n,r){Bi.subVectors(n,t),pn.subVectors(i,t),oh.subVectors(e,t);let o=Bi.dot(Bi),a=Bi.dot(pn),l=Bi.dot(oh),c=pn.dot(pn),h=pn.dot(oh),f=o*c-a*a;if(f===0)return r.set(0,0,0),null;let d=1/f,u=(c*l-a*h)*d,p=(o*h-a*l)*d;return r.set(1-u-p,p,u)}static containsPoint(e,t,i,n){return this.getBarycoord(e,t,i,n,mn)===null?!1:mn.x>=0&&mn.y>=0&&mn.x+mn.y<=1}static getInterpolation(e,t,i,n,r,o,a,l){return this.getBarycoord(e,t,i,n,mn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,mn.x),l.addScaledVector(o,mn.y),l.addScaledVector(a,mn.z),l)}static getInterpolatedAttribute(e,t,i,n,r,o){return hh.setScalar(0),uh.setScalar(0),dh.setScalar(0),hh.fromBufferAttribute(e,t),uh.fromBufferAttribute(e,i),dh.fromBufferAttribute(e,n),o.setScalar(0),o.addScaledVector(hh,r.x),o.addScaledVector(uh,r.y),o.addScaledVector(dh,r.z),o}static isFrontFacing(e,t,i,n){return Bi.subVectors(i,t),pn.subVectors(e,t),Bi.cross(pn).dot(n)<0}set(e,t,i){return this.a.copy(e),this.b.copy(t),this.c.copy(i),this}setFromPointsAndIndices(e,t,i,n){return this.a.copy(e[t]),this.b.copy(e[i]),this.c.copy(e[n]),this}setFromAttributeAndIndices(e,t,i,n){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,i),this.c.fromBufferAttribute(e,n),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Bi.subVectors(this.c,this.b),pn.subVectors(this.a,this.b),Bi.cross(pn).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return s.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return s.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,i,n,r){return s.getInterpolation(e,this.a,this.b,this.c,t,i,n,r)}containsPoint(e){return s.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return s.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let i=this.a,n=this.b,r=this.c,o,a;Os.subVectors(n,i),Fs.subVectors(r,i),ah.subVectors(e,i);let l=Os.dot(ah),c=Fs.dot(ah);if(l<=0&&c<=0)return t.copy(i);lh.subVectors(e,n);let h=Os.dot(lh),f=Fs.dot(lh);if(h>=0&&f<=h)return t.copy(n);let d=l*f-h*c;if(d<=0&&l>=0&&h<=0)return o=l/(l-h),t.copy(i).addScaledVector(Os,o);ch.subVectors(e,r);let u=Os.dot(ch),p=Fs.dot(ch);if(p>=0&&u<=p)return t.copy(r);let x=u*c-l*p;if(x<=0&&c>=0&&p<=0)return a=c/(c-p),t.copy(i).addScaledVector(Fs,a);let m=h*p-u*f;if(m<=0&&f-h>=0&&u-p>=0)return qd.subVectors(r,n),a=(f-h)/(f-h+(u-p)),t.copy(n).addScaledVector(qd,a);let g=1/(m+x+d);return o=x*g,a=d*g,t.copy(i).addScaledVector(Os,o).addScaledVector(Fs,a)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},oi=class{constructor(e=new D(1/0,1/0,1/0),t=new D(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t+=3)this.expandByPoint(ki.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,i=e.count;t<i;t++)this.expandByPoint(ki.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,i=e.length;t<i;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let i=ki.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(i),this.max.copy(e).add(i),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let i=e.geometry;if(i!==void 0){let r=i.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let o=0,a=r.count;o<a;o++)e.isMesh===!0?e.getVertexPosition(o,ki):ki.fromBufferAttribute(r,o),ki.applyMatrix4(e.matrixWorld),this.expandByPoint(ki);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),xa.copy(e.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),xa.copy(i.boundingBox)),xa.applyMatrix4(e.matrixWorld),this.union(xa)}let n=e.children;for(let r=0,o=n.length;r<o;r++)this.expandByObject(n[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,ki),ki.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,i;return e.normal.x>0?(t=e.normal.x*this.min.x,i=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,i=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,i+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,i+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,i+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,i+=e.normal.z*this.min.z),t<=-e.constant&&i>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Or),_a.subVectors(this.max,Or),Bs.subVectors(e.a,Or),ks.subVectors(e.b,Or),zs.subVectors(e.c,Or),Fn.subVectors(ks,Bs),Bn.subVectors(zs,ks),ns.subVectors(Bs,zs);let t=[0,-Fn.z,Fn.y,0,-Bn.z,Bn.y,0,-ns.z,ns.y,Fn.z,0,-Fn.x,Bn.z,0,-Bn.x,ns.z,0,-ns.x,-Fn.y,Fn.x,0,-Bn.y,Bn.x,0,-ns.y,ns.x,0];return!fh(t,Bs,ks,zs,_a)||(t=[1,0,0,0,1,0,0,0,1],!fh(t,Bs,ks,zs,_a))?!1:(va.crossVectors(Fn,Bn),t=[va.x,va.y,va.z],fh(t,Bs,ks,zs,_a))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,ki).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(ki).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(gn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),gn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),gn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),gn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),gn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),gn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),gn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),gn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(gn),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},gn=[new D,new D,new D,new D,new D,new D,new D,new D],ki=new D,xa=new oi,Bs=new D,ks=new D,zs=new D,Fn=new D,Bn=new D,ns=new D,Or=new D,_a=new D,va=new D,ss=new D;function fh(s,e,t,i,n){for(let r=0,o=s.length-3;r<=o;r+=3){ss.fromArray(s,r);let a=n.x*Math.abs(ss.x)+n.y*Math.abs(ss.y)+n.z*Math.abs(ss.z),l=e.dot(ss),c=t.dot(ss),h=i.dot(ss);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>a)return!1}return!0}var Vt=new D,ya=new ee,c0=0,Ct=class extends Vi{constructor(e,t,i=!1){if(super(),Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:c0++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=i,this.usage=su,this.updateRanges=[],this.gpuType=wi,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,i){e*=this.itemSize,i*=t.itemSize;for(let n=0,r=this.itemSize;n<r;n++)this.array[e+n]=t.array[i+n];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,i=this.count;t<i;t++)ya.fromBufferAttribute(this,t),ya.applyMatrix3(e),this.setXY(t,ya.x,ya.y);else if(this.itemSize===3)for(let t=0,i=this.count;t<i;t++)Vt.fromBufferAttribute(this,t),Vt.applyMatrix3(e),this.setXYZ(t,Vt.x,Vt.y,Vt.z);return this}applyMatrix4(e){for(let t=0,i=this.count;t<i;t++)Vt.fromBufferAttribute(this,t),Vt.applyMatrix4(e),this.setXYZ(t,Vt.x,Vt.y,Vt.z);return this}applyNormalMatrix(e){for(let t=0,i=this.count;t<i;t++)Vt.fromBufferAttribute(this,t),Vt.applyNormalMatrix(e),this.setXYZ(t,Vt.x,Vt.y,Vt.z);return this}transformDirection(e){for(let t=0,i=this.count;t<i;t++)Vt.fromBufferAttribute(this,t),Vt.transformDirection(e),this.setXYZ(t,Vt.x,Vt.y,Vt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let i=this.array[e*this.itemSize+t];return this.normalized&&(i=zi(i,this.array)),i}setComponent(e,t,i){return this.normalized&&(i=mt(i,this.array)),this.array[e*this.itemSize+t]=i,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=zi(t,this.array)),t}setX(e,t){return this.normalized&&(t=mt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=zi(t,this.array)),t}setY(e,t){return this.normalized&&(t=mt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=zi(t,this.array)),t}setZ(e,t){return this.normalized&&(t=mt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=zi(t,this.array)),t}setW(e,t){return this.normalized&&(t=mt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,i){return e*=this.itemSize,this.normalized&&(t=mt(t,this.array),i=mt(i,this.array)),this.array[e+0]=t,this.array[e+1]=i,this}setXYZ(e,t,i,n){return e*=this.itemSize,this.normalized&&(t=mt(t,this.array),i=mt(i,this.array),n=mt(n,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=n,this}setXYZW(e,t,i,n,r){return e*=this.itemSize,this.normalized&&(t=mt(t,this.array),i=mt(i,this.array),n=mt(n,this.array),r=mt(r,this.array)),this.array[e+0]=t,this.array[e+1]=i,this.array[e+2]=n,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return e.name=this.name,e.usage=this.usage,e.gpuType=this.gpuType,e}dispose(){this.dispatchEvent({type:"dispose"})}};var to=class extends Ct{constructor(e,t,i){super(new Uint16Array(e),t,i)}};var io=class extends Ct{constructor(e,t,i){super(new Uint32Array(e),t,i)}};var at=class extends Ct{constructor(e,t,i){super(new Float32Array(e),t,i)}},h0=new oi,Fr=new D,ph=new D,mi=class{constructor(e=new D,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let i=this.center;t!==void 0?i.copy(t):h0.setFromPoints(e).getCenter(i);let n=0;for(let r=0,o=e.length;r<o;r++)n=Math.max(n,i.distanceToSquared(e[r]));return this.radius=Math.sqrt(n),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let i=this.center.distanceToSquared(e);return t.copy(e),i>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Fr.subVectors(e,this.center);let t=Fr.lengthSq();if(t>this.radius*this.radius){let i=Math.sqrt(t),n=(i-this.radius)*.5;this.center.addScaledVector(Fr,n/i),this.radius+=n}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(ph.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Fr.copy(e.center).add(ph)),this.expandByPoint(Fr.copy(e.center).sub(ph))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},u0=0,Ei=new We,mh=new Rt,Hs=new D,yi=new oi,Br=new oi,Jt=new D,_t=class s extends Vi{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:u0++}),this.uuid=Ai(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Um(e)?io:to)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,i=0){this.groups.push({start:e,count:t,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let i=this.attributes.normal;if(i!==void 0){let r=new Qe().getNormalMatrix(e);i.applyNormalMatrix(r),i.needsUpdate=!0}let n=this.attributes.tangent;return n!==void 0&&(n.transformDirection(e),n.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return Ei.makeRotationFromQuaternion(e),this.applyMatrix4(Ei),this}rotateX(e){return Ei.makeRotationX(e),this.applyMatrix4(Ei),this}rotateY(e){return Ei.makeRotationY(e),this.applyMatrix4(Ei),this}rotateZ(e){return Ei.makeRotationZ(e),this.applyMatrix4(Ei),this}translate(e,t,i){return Ei.makeTranslation(e,t,i),this.applyMatrix4(Ei),this}scale(e,t,i){return Ei.makeScale(e,t,i),this.applyMatrix4(Ei),this}lookAt(e){return mh.lookAt(e),mh.updateMatrix(),this.applyMatrix4(mh.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Hs).negate(),this.translate(Hs.x,Hs.y,Hs.z),this}setFromPoints(e){let t=this.getAttribute("position");if(t===void 0){let i=[];for(let n=0,r=e.length;n<r;n++){let o=e[n];i.push(o.x,o.y,o.z||0)}this.setAttribute("position",new at(i,3))}else{let i=Math.min(e.length,t.count);for(let n=0;n<i;n++){let r=e[n];t.setXYZ(n,r.x,r.y,r.z||0)}e.length>t.count&&Ge("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new oi);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ke("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new D(-1/0,-1/0,-1/0),new D(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let i=0,n=t.length;i<n;i++){let r=t[i];yi.setFromBufferAttribute(r),this.morphTargetsRelative?(Jt.addVectors(this.boundingBox.min,yi.min),this.boundingBox.expandByPoint(Jt),Jt.addVectors(this.boundingBox.max,yi.max),this.boundingBox.expandByPoint(Jt)):(this.boundingBox.expandByPoint(yi.min),this.boundingBox.expandByPoint(yi.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Ke('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new mi);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ke("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new D,1/0);return}if(e){let i=this.boundingSphere.center;if(yi.setFromBufferAttribute(e),t)for(let r=0,o=t.length;r<o;r++){let a=t[r];Br.setFromBufferAttribute(a),this.morphTargetsRelative?(Jt.addVectors(yi.min,Br.min),yi.expandByPoint(Jt),Jt.addVectors(yi.max,Br.max),yi.expandByPoint(Jt)):(yi.expandByPoint(Br.min),yi.expandByPoint(Br.max))}yi.getCenter(i);let n=0;for(let r=0,o=e.count;r<o;r++)Jt.fromBufferAttribute(e,r),n=Math.max(n,i.distanceToSquared(Jt));if(t)for(let r=0,o=t.length;r<o;r++){let a=t[r],l=this.morphTargetsRelative;for(let c=0,h=a.count;c<h;c++)Jt.fromBufferAttribute(a,c),l&&(Hs.fromBufferAttribute(e,c),Jt.add(Hs)),n=Math.max(n,i.distanceToSquared(Jt))}this.boundingSphere.radius=Math.sqrt(n),isNaN(this.boundingSphere.radius)&&Ke('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){Ke("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let i=t.position,n=t.normal,r=t.uv,o=this.getAttribute("tangent");(o===void 0||o.count!==i.count)&&(o=new Ct(new Float32Array(4*i.count),4),this.setAttribute("tangent",o));let a=[],l=[];for(let y=0;y<i.count;y++)a[y]=new D,l[y]=new D;let c=new D,h=new D,f=new D,d=new ee,u=new ee,p=new ee,x=new D,m=new D;function g(y,R,I){c.fromBufferAttribute(i,y),h.fromBufferAttribute(i,R),f.fromBufferAttribute(i,I),d.fromBufferAttribute(r,y),u.fromBufferAttribute(r,R),p.fromBufferAttribute(r,I),h.sub(c),f.sub(c),u.sub(d),p.sub(d);let L=1/(u.x*p.y-p.x*u.y);isFinite(L)&&(x.copy(h).multiplyScalar(p.y).addScaledVector(f,-u.y).multiplyScalar(L),m.copy(f).multiplyScalar(u.x).addScaledVector(h,-p.x).multiplyScalar(L),a[y].add(x),a[R].add(x),a[I].add(x),l[y].add(m),l[R].add(m),l[I].add(m))}let S=this.groups;S.length===0&&(S=[{start:0,count:e.count}]);for(let y=0,R=S.length;y<R;++y){let I=S[y],L=I.start,b=I.count;for(let w=L,P=L+b;w<P;w+=3)g(e.getX(w+0),e.getX(w+1),e.getX(w+2))}let T=new D,_=new D,v=new D,E=new D;function A(y){v.fromBufferAttribute(n,y),E.copy(v);let R=a[y];T.copy(R),T.sub(v.multiplyScalar(v.dot(R))).normalize(),_.crossVectors(E,R);let L=_.dot(l[y])<0?-1:1;o.setXYZW(y,T.x,T.y,T.z,L)}for(let y=0,R=S.length;y<R;++y){let I=S[y],L=I.start,b=I.count;for(let w=L,P=L+b;w<P;w+=3)A(e.getX(w+0)),A(e.getX(w+1)),A(e.getX(w+2))}this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let i=this.getAttribute("normal");if(i===void 0||i.count!==t.count)i=new Ct(new Float32Array(t.count*3),3),this.setAttribute("normal",i);else for(let d=0,u=i.count;d<u;d++)i.setXYZ(d,0,0,0);let n=new D,r=new D,o=new D,a=new D,l=new D,c=new D,h=new D,f=new D;if(e)for(let d=0,u=e.count;d<u;d+=3){let p=e.getX(d+0),x=e.getX(d+1),m=e.getX(d+2);n.fromBufferAttribute(t,p),r.fromBufferAttribute(t,x),o.fromBufferAttribute(t,m),h.subVectors(o,r),f.subVectors(n,r),h.cross(f),a.fromBufferAttribute(i,p),l.fromBufferAttribute(i,x),c.fromBufferAttribute(i,m),a.add(h),l.add(h),c.add(h),i.setXYZ(p,a.x,a.y,a.z),i.setXYZ(x,l.x,l.y,l.z),i.setXYZ(m,c.x,c.y,c.z)}else for(let d=0,u=t.count;d<u;d+=3)n.fromBufferAttribute(t,d+0),r.fromBufferAttribute(t,d+1),o.fromBufferAttribute(t,d+2),h.subVectors(o,r),f.subVectors(n,r),h.cross(f),i.setXYZ(d+0,h.x,h.y,h.z),i.setXYZ(d+1,h.x,h.y,h.z),i.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,i=e.count;t<i;t++)Jt.fromBufferAttribute(e,t),Jt.normalize(),e.setXYZ(t,Jt.x,Jt.y,Jt.z)}toNonIndexed(){function e(a,l){let c=a.array,h=a.itemSize,f=a.normalized,d=new c.constructor(l.length*h),u=0,p=0;for(let x=0,m=l.length;x<m;x++){a.isInterleavedBufferAttribute?u=l[x]*a.data.stride+a.offset:u=l[x]*h;for(let g=0;g<h;g++)d[p++]=c[u++]}return new Ct(d,h,f)}if(this.index===null)return Ge("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new s,i=this.index.array,n=this.attributes;for(let a in n){let l=n[a],c=e(l,i);t.setAttribute(a,c)}let r=this.morphAttributes;for(let a in r){let l=[],c=r[a];for(let h=0,f=c.length;h<f;h++){let d=c[h],u=e(d,i);l.push(u)}t.morphAttributes[a]=l}t.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let a=0,l=o.length;a<l;a++){let c=o[a];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){let e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,e.name=this.name,Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let i=this.attributes;for(let l in i){let c=i[l];e.data.attributes[l]=c.toJSON(e.data)}let n={},r=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],h=[];for(let f=0,d=c.length;f<d;f++){let u=c[f];h.push(u.toJSON(e.data))}h.length>0&&(n[l]=h,r=!0)}r&&(e.data.morphAttributes=n,e.data.morphTargetsRelative=this.morphTargetsRelative);let o=this.groups;o.length>0&&(e.data.groups=JSON.parse(JSON.stringify(o)));let a=this.boundingSphere;return a!==null&&(e.data.boundingSphere=a.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let i=e.index;i!==null&&this.setIndex(i.clone());let n=e.attributes;for(let c in n){let h=n[c];this.setAttribute(c,h.clone(t))}let r=e.morphAttributes;for(let c in r){let h=[],f=r[c];for(let d=0,u=f.length;d<u;d++)h.push(f[d].clone(t));this.morphAttributes[c]=h}this.morphTargetsRelative=e.morphTargetsRelative;let o=e.groups;for(let c=0,h=o.length;c<h;c++){let f=o[c];this.addGroup(f.start,f.count,f.materialIndex)}let a=e.boundingBox;a!==null&&(this.boundingBox=a.clone());let l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}},us=class{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=su,this.updateRanges=[],this.version=0,this.uuid=Ai()}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,i){e*=this.stride,i*=t.stride;for(let n=0,r=this.stride;n<r;n++)this.array[e+n]=t.array[i+n];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Ai()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);let t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),i=new this.constructor(t,this.stride);return i.setUsage(this.usage),i}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Ai()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer)));let t={uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride};return t.usage=this.usage,t}},ui=new D,Hn=class s{constructor(e,t,i,n=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=i,this.normalized=n}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,i=this.data.count;t<i;t++)ui.fromBufferAttribute(this,t),ui.applyMatrix4(e),this.setXYZ(t,ui.x,ui.y,ui.z);return this}applyNormalMatrix(e){for(let t=0,i=this.count;t<i;t++)ui.fromBufferAttribute(this,t),ui.applyNormalMatrix(e),this.setXYZ(t,ui.x,ui.y,ui.z);return this}transformDirection(e){for(let t=0,i=this.count;t<i;t++)ui.fromBufferAttribute(this,t),ui.transformDirection(e),this.setXYZ(t,ui.x,ui.y,ui.z);return this}getComponent(e,t){let i=this.array[e*this.data.stride+this.offset+t];return this.normalized&&(i=zi(i,this.array)),i}setComponent(e,t,i){return this.normalized&&(i=mt(i,this.array)),this.data.array[e*this.data.stride+this.offset+t]=i,this}setX(e,t){return this.normalized&&(t=mt(t,this.array)),this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.normalized&&(t=mt(t,this.array)),this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.normalized&&(t=mt(t,this.array)),this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.normalized&&(t=mt(t,this.array)),this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];return this.normalized&&(t=zi(t,this.array)),t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];return this.normalized&&(t=zi(t,this.array)),t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];return this.normalized&&(t=zi(t,this.array)),t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];return this.normalized&&(t=zi(t,this.array)),t}setXY(e,t,i){return e=e*this.data.stride+this.offset,this.normalized&&(t=mt(t,this.array),i=mt(i,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=i,this}setXYZ(e,t,i,n){return e=e*this.data.stride+this.offset,this.normalized&&(t=mt(t,this.array),i=mt(i,this.array),n=mt(n,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=i,this.data.array[e+2]=n,this}setXYZW(e,t,i,n,r){return e=e*this.data.stride+this.offset,this.normalized&&(t=mt(t,this.array),i=mt(i,this.array),n=mt(n,this.array),r=mt(r,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=i,this.data.array[e+2]=n,this.data.array[e+3]=r,this}clone(e){if(e===void 0){Qr("InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let i=0;i<this.count;i++){let n=i*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[n+r])}return new Ct(new this.array.constructor(t),this.itemSize,this.normalized)}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.clone(e)),new s(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){Qr("InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let i=0;i<this.count;i++){let n=i*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[n+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}},gh=new D,d0=new D,f0=new Qe,$t=class{constructor(e=new D(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,i,n){return this.normal.set(e,t,i),this.constant=n,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,i){let n=gh.subVectors(i,t).cross(d0.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(n,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,i=!0){let n=e.delta(gh),r=this.normal.dot(n);if(r===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let o=-(e.start.dot(this.normal)+this.constant)/r;return i===!0&&(o<0||o>1)?null:t.copy(e.start).addScaledVector(n,o)}intersectsLine(e){let t=this.distanceToPoint(e.start),i=this.distanceToPoint(e.end);return t<0&&i>0||i<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let i=t||f0.getNormalMatrix(e),n=this.coplanarPoint(gh).applyMatrix4(e),r=this.normal.applyMatrix3(i).normalize();return this.constant=-n.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(e){return this.normal.fromArray(e.normal),this.constant=e.constant,this}},p0=0,ei=class extends Vi{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:p0++}),this.uuid=Ai(),this.name="",this.type="Material",this.blending=xr,this.side=rn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=jh,this.blendDst=Zh,this.blendEquation=Ri,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Me(0,0,0),this.blendAlpha=0,this.depthFunc=Js,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Jf,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Xa,this.stencilZFail=Xa,this.stencilZPass=Xa,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let i=e[t];if(i===void 0){Ge(`Material: parameter '${t}' has value of undefined.`);continue}let n=this[t];if(n===void 0){Ge(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}n&&n.isColor?n.set(i):n&&n.isVector2&&i&&i.isVector2||n&&n.isEuler&&i&&i.isEuler||n&&n.isVector3&&i&&i.isVector3?n.copy(i):this[t]=i}}toJSON(e){let t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});let i={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,i.blending=this.blending,i.side=this.side,i.shadowSide=this.shadowSide,i.vertexColors=this.vertexColors,i.opacity=this.opacity,i.transparent=this.transparent,i.blendSrc=this.blendSrc,i.blendDst=this.blendDst,i.blendEquation=this.blendEquation,i.blendSrcAlpha=this.blendSrcAlpha,i.blendDstAlpha=this.blendDstAlpha,i.blendEquationAlpha=this.blendEquationAlpha,i.blendColor=this.blendColor.getHex(),i.blendAlpha=this.blendAlpha,i.depthFunc=this.depthFunc,i.depthTest=this.depthTest,i.depthWrite=this.depthWrite,i.colorWrite=this.colorWrite,i.clipIntersection=this.clipIntersection,i.clipShadows=this.clipShadows,i.stencilWriteMask=this.stencilWriteMask,i.stencilFunc=this.stencilFunc,i.stencilRef=this.stencilRef,i.stencilFuncMask=this.stencilFuncMask,i.stencilFail=this.stencilFail,i.stencilZFail=this.stencilZFail,i.stencilZPass=this.stencilZPass,i.stencilWrite=this.stencilWrite,i.polygonOffset=this.polygonOffset,i.polygonOffsetFactor=this.polygonOffsetFactor,i.polygonOffsetUnits=this.polygonOffsetUnits,i.dithering=this.dithering,i.alphaTest=this.alphaTest,i.alphaHash=this.alphaHash,i.alphaToCoverage=this.alphaToCoverage,i.premultipliedAlpha=this.premultipliedAlpha,i.forceSinglePass=this.forceSinglePass,i.allowOverride=this.allowOverride,i.visible=this.visible,i.toneMapped=this.toneMapped,i.name=this.name,this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(i.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(i.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(i.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(e).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(e).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(e).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(e).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(e).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(i.clippingPlanes=this.clippingPlanes.map(r=>r.toJSON())),this.rotation!==void 0&&(i.rotation=this.rotation),this.depthPacking!==void 0&&(i.depthPacking=this.depthPacking),this.linewidth!==void 0&&(i.linewidth=this.linewidth),this.linecap!==void 0&&(i.linecap=this.linecap),this.linejoin!==void 0&&(i.linejoin=this.linejoin),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.wireframe!==void 0&&(i.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(i.flatShading=this.flatShading),this.fog!==void 0&&(i.fog=this.fog),Object.keys(this.userData).length>0&&(i.userData=this.userData);function n(r){let o=[];for(let a in r){let l=r[a];delete l.metadata,o.push(l)}return o}if(t){let r=n(e.textures),o=n(e.images);r.length>0&&(i.textures=r),o.length>0&&(i.images=o)}return i}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new Me().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.retroreflectivity!==void 0&&(this.retroreflectivity=e.retroreflectivity),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.clippingPlanes!==void 0&&(this.clippingPlanes=e.clippingPlanes.map(i=>new $t().fromJSON(i))),e.clipIntersection!==void 0&&(this.clipIntersection=e.clipIntersection),e.clipShadows!==void 0&&(this.clipShadows=e.clipShadows),e.depthPacking!==void 0&&(this.depthPacking=e.depthPacking),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.linecap!==void 0&&(this.linecap=e.linecap),e.linejoin!==void 0&&(this.linejoin=e.linejoin),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let i=e.normalScale;Array.isArray(i)===!1&&(i=[i,i]),this.normalScale=new ee().fromArray(i)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new ee().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,i=null;if(t!==null){let n=t.length;i=new Array(n);for(let r=0;r!==n;++r)i[r]=t[r].clone()}return this.clippingPlanes=i,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}},or=class extends ei{constructor(e){super(),this.isSpriteMaterial=!0,this.type="SpriteMaterial",this.color=new Me(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.rotation=e.rotation,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},Vs,kr=new D,Gs=new D,Ws=new D,Xs=new ee,zr=new ee,cp=new We,Ma=new D,Hr=new D,ba=new D,Yd=new ee,xh=new ee,jd=new ee,no=class extends Rt{constructor(e=new or){if(super(),this.isSprite=!0,this.type="Sprite",Vs===void 0){Vs=new _t;let t=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),i=new us(t,5);Vs.setIndex([0,1,2,0,2,3]),Vs.setAttribute("position",new Hn(i,3,0,!1)),Vs.setAttribute("uv",new Hn(i,2,3,!1))}this.geometry=Vs,this.material=e,this.center=new ee(.5,.5),this.count=1}intersectsFrustum(e){return e.intersectsSprite(this)}raycast(e,t){e.camera===null&&Ke('Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),Gs.setFromMatrixScale(this.matrixWorld),cp.copy(e.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(e.camera.matrixWorldInverse,this.matrixWorld),Ws.setFromMatrixPosition(this.modelViewMatrix),e.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&Gs.multiplyScalar(-Ws.z);let i=this.material.rotation,n,r;i!==0&&(r=Math.cos(i),n=Math.sin(i));let o=this.center;Sa(Ma.set(-.5,-.5,0),Ws,o,Gs,n,r),Sa(Hr.set(.5,-.5,0),Ws,o,Gs,n,r),Sa(ba.set(.5,.5,0),Ws,o,Gs,n,r),Yd.set(0,0),xh.set(1,0),jd.set(1,1);let a=e.ray.intersectTriangle(Ma,Hr,ba,!1,kr);if(a===null&&(Sa(Hr.set(-.5,.5,0),Ws,o,Gs,n,r),xh.set(0,1),a=e.ray.intersectTriangle(Ma,ba,Hr,!1,kr),a===null))return;let l=e.ray.origin.distanceTo(kr);l<e.near||l>e.far||t.push({distance:l,point:kr.clone(),uv:vn.getInterpolation(kr,Ma,Hr,ba,Yd,xh,jd,new ee),face:null,object:this})}copy(e,t){return super.copy(e,t),e.center!==void 0&&this.center.copy(e.center),this.material=e.material,this}};function Sa(s,e,t,i,n,r){Xs.subVectors(s,t).addScalar(.5).multiply(i),n!==void 0?(zr.x=r*Xs.x-n*Xs.y,zr.y=n*Xs.x+r*Xs.y):zr.copy(Xs),s.copy(e),s.x+=zr.x,s.y+=zr.y,s.applyMatrix4(cp)}var xn=new D,_h=new D,wa=new D,Ta=new D,$i=class{constructor(e=new D,t=new D(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,xn)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let i=t.dot(this.direction);return i<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=xn.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(xn.copy(this.origin).addScaledVector(this.direction,t),xn.distanceToSquared(e))}distanceSqToSegment(e,t,i,n){_h.copy(e).add(t).multiplyScalar(.5),wa.copy(t).sub(e).normalize(),Ta.copy(this.origin).sub(_h);let r=e.distanceTo(t)*.5,o=-this.direction.dot(wa),a=Ta.dot(this.direction),l=-Ta.dot(wa),c=Ta.lengthSq(),h=Math.abs(1-o*o),f,d,u,p;if(h>0)if(f=o*l-a,d=o*a-l,p=r*h,f>=0)if(d>=-p)if(d<=p){let x=1/h;f*=x,d*=x,u=f*(f+o*d+2*a)+d*(o*f+d+2*l)+c}else d=r,f=Math.max(0,-(o*d+a)),u=-f*f+d*(d+2*l)+c;else d=-r,f=Math.max(0,-(o*d+a)),u=-f*f+d*(d+2*l)+c;else d<=-p?(f=Math.max(0,-(-o*r+a)),d=f>0?-r:Math.min(Math.max(-r,-l),r),u=-f*f+d*(d+2*l)+c):d<=p?(f=0,d=Math.min(Math.max(-r,-l),r),u=d*(d+2*l)+c):(f=Math.max(0,-(o*r+a)),d=f>0?r:Math.min(Math.max(-r,-l),r),u=-f*f+d*(d+2*l)+c);else d=o>0?-r:r,f=Math.max(0,-(o*d+a)),u=-f*f+d*(d+2*l)+c;return i&&i.copy(this.origin).addScaledVector(this.direction,f),n&&n.copy(_h).addScaledVector(wa,d),u}intersectSphere(e,t){if(e.radius<0)return null;xn.subVectors(e.center,this.origin);let i=xn.dot(this.direction),n=xn.dot(xn)-i*i,r=e.radius*e.radius;if(n>r)return null;let o=Math.sqrt(r-n),a=i-o,l=i+o;return l<0?null:a<0?this.at(l,t):this.at(a,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let i=-(this.origin.dot(e.normal)+e.constant)/t;return i>=0?i:null}intersectPlane(e,t){let i=this.distanceToPlane(e);return i===null?null:this.at(i,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let i,n,r,o,a,l,c=1/this.direction.x,h=1/this.direction.y,f=1/this.direction.z,d=this.origin;return c>=0?(i=(e.min.x-d.x)*c,n=(e.max.x-d.x)*c):(i=(e.max.x-d.x)*c,n=(e.min.x-d.x)*c),h>=0?(r=(e.min.y-d.y)*h,o=(e.max.y-d.y)*h):(r=(e.max.y-d.y)*h,o=(e.min.y-d.y)*h),i>o||r>n||((r>i||isNaN(i))&&(i=r),(o<n||isNaN(n))&&(n=o),f>=0?(a=(e.min.z-d.z)*f,l=(e.max.z-d.z)*f):(a=(e.max.z-d.z)*f,l=(e.min.z-d.z)*f),i>l||a>n)||((a>i||i!==i)&&(i=a),(l<n||n!==n)&&(n=l),n<0)?null:this.at(i>=0?i:n,t)}intersectsBox(e){return this.intersectBox(e,xn)!==null}intersectTriangle(e,t,i,n,r){let o=this.origin,a=this.direction,l=a.x,c=a.y,h=a.z,f=e.x-o.x,d=e.y-o.y,u=e.z-o.z,p=t.x-o.x,x=t.y-o.y,m=t.z-o.z,g=i.x-o.x,S=i.y-o.y,T=i.z-o.z,_=Math.abs(l),v=Math.abs(c),E=Math.abs(h),A,y,R,I,L,b,w,P,U,F,O,z;if(_>=v&&_>=E?(R=l,b=f,U=p,z=g,l>=0?(A=c,y=h,I=d,L=u,w=x,P=m,F=S,O=T):(A=h,y=c,I=u,L=d,w=m,P=x,F=T,O=S)):v>=E?(R=c,b=d,U=x,z=S,c>=0?(A=h,y=l,I=u,L=f,w=m,P=p,F=T,O=g):(A=l,y=h,I=f,L=u,w=p,P=m,F=g,O=T)):(R=h,b=u,U=m,z=T,h>=0?(A=l,y=c,I=f,L=d,w=p,P=x,F=g,O=S):(A=c,y=l,I=d,L=f,w=x,P=p,F=S,O=g)),R===0)return null;let k=A/R,G=y/R,Y=1/R,he=I-k*b,pe=L-G*b,Te=w-k*U,Ee=P-G*U,Re=F-k*z,j=O-G*z,J=Re*Ee-j*Te,fe=he*j-pe*Re,Le=Te*pe-Ee*he;if(n){if(J<0||fe<0||Le<0)return null}else if((J<0||fe<0||Le<0)&&(J>0||fe>0||Le>0))return null;let _e=J+fe+Le;if(_e===0)return null;let ze=Y*(J*b+fe*U+Le*z);return(_e>0?ze<0:ze>0)?null:this.at(ze/_e,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},St=class extends ei{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Me(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Qi,this.combine=Tl,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},Zd=new We,rs=new $i,Ea=new mi,Kd=new D,Aa=new D,Ca=new D,Ra=new D,vh=new D,Pa=new D,Jd=new D,La=new D,De=class extends Rt{constructor(e=new _t,t=new St){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){let n=t[i[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=n.length;r<o;r++){let a=n[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}getVertexPosition(e,t){let i=this.geometry,n=i.attributes.position,r=i.morphAttributes.position,o=i.morphTargetsRelative;t.fromBufferAttribute(n,e);let a=this.morphTargetInfluences;if(r&&a){Pa.set(0,0,0);for(let l=0,c=r.length;l<c;l++){let h=a[l],f=r[l];h!==0&&(vh.fromBufferAttribute(f,e),o?Pa.addScaledVector(vh,h):Pa.addScaledVector(vh.sub(t),h))}t.add(Pa)}return t}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let i=this.geometry,n=this.material,r=this.matrixWorld;n!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),Ea.copy(i.boundingSphere),Ea.applyMatrix4(r),rs.copy(e.ray).recast(e.near),!(Ea.containsPoint(rs.origin)===!1&&(rs.intersectSphere(Ea,Kd)===null||rs.origin.distanceToSquared(Kd)>(e.far-e.near)**2))&&(Zd.copy(r).invert(),rs.copy(e.ray).applyMatrix4(Zd),!(i.boundingBox!==null&&rs.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(e,t,rs)))}_computeIntersections(e,t,i){let n,r=this.geometry,o=this.material,a=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,f=r.attributes.normal,d=r.groups,u=r.drawRange;if(a!==null)if(Array.isArray(o))for(let p=0,x=d.length;p<x;p++){let m=d[p],g=o[m.materialIndex],S=Math.max(m.start,u.start),T=Math.min(a.count,Math.min(m.start+m.count,u.start+u.count));for(let _=S,v=T;_<v;_+=3){let E=a.getX(_),A=a.getX(_+1),y=a.getX(_+2);n=Ia(this,g,e,i,c,h,f,E,A,y),n&&(n.faceIndex=Math.floor(_/3),n.face.materialIndex=m.materialIndex,t.push(n))}}else{let p=Math.max(0,u.start),x=Math.min(a.count,u.start+u.count);for(let m=p,g=x;m<g;m+=3){let S=a.getX(m),T=a.getX(m+1),_=a.getX(m+2);n=Ia(this,o,e,i,c,h,f,S,T,_),n&&(n.faceIndex=Math.floor(m/3),t.push(n))}}else if(l!==void 0)if(Array.isArray(o))for(let p=0,x=d.length;p<x;p++){let m=d[p],g=o[m.materialIndex],S=Math.max(m.start,u.start),T=Math.min(l.count,Math.min(m.start+m.count,u.start+u.count));for(let _=S,v=T;_<v;_+=3){let E=_,A=_+1,y=_+2;n=Ia(this,g,e,i,c,h,f,E,A,y),n&&(n.faceIndex=Math.floor(_/3),n.face.materialIndex=m.materialIndex,t.push(n))}}else{let p=Math.max(0,u.start),x=Math.min(l.count,u.start+u.count);for(let m=p,g=x;m<g;m+=3){let S=m,T=m+1,_=m+2;n=Ia(this,o,e,i,c,h,f,S,T,_),n&&(n.faceIndex=Math.floor(m/3),t.push(n))}}}};function m0(s,e,t,i,n,r,o,a){let l;if(e.side===ti?l=i.intersectTriangle(o,r,n,!0,a):l=i.intersectTriangle(n,r,o,e.side===rn,a),l===null)return null;La.copy(a),La.applyMatrix4(s.matrixWorld);let c=t.ray.origin.distanceTo(La);return c<t.near||c>t.far?null:{distance:c,point:La.clone(),object:s}}function Ia(s,e,t,i,n,r,o,a,l,c){s.getVertexPosition(a,Aa),s.getVertexPosition(l,Ca),s.getVertexPosition(c,Ra);let h=m0(s,e,t,i,Aa,Ca,Ra,Jd);if(h){let f=new D;vn.getBarycoord(Jd,Aa,Ca,Ra,f),n&&(h.uv=vn.getInterpolatedAttribute(n,a,l,c,f,new ee)),r&&(h.uv1=vn.getInterpolatedAttribute(r,a,l,c,f,new ee)),o&&(h.normal=vn.getInterpolatedAttribute(o,a,l,c,f,new D),h.normal.dot(i.direction)>0&&h.normal.multiplyScalar(-1));let d={a,b:l,c,normal:new D,materialIndex:0};vn.getNormal(Aa,Ca,Ra,d.normal),h.face=d,h.barycoord=f}return h}var Vr=new ut,Qd=new ut,$d=new ut,g0=new ut,ef=new We,Da=new D,yh=new mi,tf=new We,Mh=new $i,so=class extends De{constructor(e,t){super(e,t),this.isSkinnedMesh=!0,this.type="SkinnedMesh",this.bindMode=Ch,this.bindMatrix=new We,this.bindMatrixInverse=new We,this.boundingBox=null,this.boundingSphere=null}computeBoundingBox(){let e=this.geometry;this.boundingBox===null&&(this.boundingBox=new oi),this.boundingBox.makeEmpty();let t=e.getAttribute("position");for(let i=0;i<t.count;i++)this.getVertexPosition(i,Da),this.boundingBox.expandByPoint(Da)}computeBoundingSphere(){let e=this.geometry;this.boundingSphere===null&&(this.boundingSphere=new mi),this.boundingSphere.makeEmpty();let t=e.getAttribute("position");for(let i=0;i<t.count;i++)this.getVertexPosition(i,Da),this.boundingSphere.expandByPoint(Da)}copy(e,t){return super.copy(e,t),this.bindMode=e.bindMode,this.bindMatrix.copy(e.bindMatrix),this.bindMatrixInverse.copy(e.bindMatrixInverse),this.skeleton=e.skeleton,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}raycast(e,t){let i=this.material,n=this.matrixWorld;i!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),yh.copy(this.boundingSphere),yh.applyMatrix4(n),e.ray.intersectsSphere(yh)!==!1&&(tf.copy(n).invert(),Mh.copy(e.ray).applyMatrix4(tf),!(this.boundingBox!==null&&Mh.intersectsBox(this.boundingBox)===!1)&&this._computeIntersections(e,t,Mh)))}getVertexPosition(e,t){return super.getVertexPosition(e,t),this.applyBoneTransform(e,t),t}bind(e,t){this.skeleton=e,t===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),t=this.matrixWorld),this.bindMatrix.copy(t),this.bindMatrixInverse.copy(t).invert()}pose(){this.skeleton.pose()}normalizeSkinWeights(){let e=new ut,t=this.geometry.attributes.skinWeight;for(let i=0,n=t.count;i<n;i++){e.fromBufferAttribute(t,i);let r=1/e.manhattanLength();r!==1/0?e.multiplyScalar(r):e.set(1,0,0,0),t.setXYZW(i,e.x,e.y,e.z,e.w)}}updateMatrixWorld(e){super.updateMatrixWorld(e),this.bindMode===Ch?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode===Yf?this.bindMatrixInverse.copy(this.bindMatrix).invert():Ge("SkinnedMesh: Unrecognized bindMode: "+this.bindMode)}applyBoneTransform(e,t){let i=this.skeleton,n=this.geometry;Qd.fromBufferAttribute(n.attributes.skinIndex,e),$d.fromBufferAttribute(n.attributes.skinWeight,e),t.isVector4?(Vr.copy(t),t.set(0,0,0,0)):(Vr.set(...t,1),t.set(0,0,0)),Vr.applyMatrix4(this.bindMatrix);for(let r=0;r<4;r++){let o=$d.getComponent(r);if(o!==0){let a=Qd.getComponent(r);ef.multiplyMatrices(i.bones[a].matrixWorld,i.boneInverses[a]),t.addScaledVector(g0.copy(Vr).applyMatrix4(ef),o)}}return t.isVector4&&(t.w=Vr.w),t.applyMatrix4(this.bindMatrixInverse)}},ar=class extends Rt{constructor(){super(),this.isBone=!0,this.type="Bone"}},en=class extends Ot{constructor(e=null,t=1,i=1,n,r,o,a,l,c=bt,h=bt,f,d){super(null,o,a,l,c,h,n,r,f,d),this.isDataTexture=!0,this.image={data:e,width:t,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},nf=new We,x0=new We,ro=class s{constructor(e=[],t=[]){this.uuid=Ai(),this.bones=e.slice(0),this.boneInverses=t,this.boneMatrices=null,this.boneTexture=null,this.init()}init(){let e=this.bones,t=this.boneInverses;if(this.boneMatrices=new Float32Array(e.length*16),t.length===0)this.calculateInverses();else if(e.length!==t.length){Ge("Skeleton: Number of inverse bone matrices does not match amount of bones."),this.boneInverses=[];for(let i=0,n=this.bones.length;i<n;i++)this.boneInverses.push(new We)}}calculateInverses(){this.boneInverses.length=0;for(let e=0,t=this.bones.length;e<t;e++){let i=new We;this.bones[e]&&i.copy(this.bones[e].matrixWorld).invert(),this.boneInverses.push(i)}}pose(){for(let e=0,t=this.bones.length;e<t;e++){let i=this.bones[e];i&&i.matrixWorld.copy(this.boneInverses[e]).invert()}for(let e=0,t=this.bones.length;e<t;e++){let i=this.bones[e];i&&(i.parent&&i.parent.isBone?(i.matrix.copy(i.parent.matrixWorld).invert(),i.matrix.multiply(i.matrixWorld)):i.matrix.copy(i.matrixWorld),i.matrix.decompose(i.position,i.quaternion,i.scale))}}update(){let e=this.bones,t=this.boneInverses,i=this.boneMatrices,n=this.boneTexture;for(let r=0,o=e.length;r<o;r++){let a=e[r]?e[r].matrixWorld:x0;nf.multiplyMatrices(a,t[r]),nf.toArray(i,r*16)}n!==null&&(n.needsUpdate=!0)}clone(){return new s(this.bones,this.boneInverses)}computeBoneTexture(){let e=Math.sqrt(this.bones.length*4);e=Math.ceil(e/4)*4,e=Math.max(e,4);let t=new Float32Array(e*e*4);t.set(this.boneMatrices);let i=new en(t,e,e,fi,wi);return i.needsUpdate=!0,this.boneMatrices=t,this.boneTexture=i,this}getBoneByName(e){for(let t=0,i=this.bones.length;t<i;t++){let n=this.bones[t];if(n.name===e)return n}}dispose(){this.boneTexture!==null&&(this.boneTexture.dispose(),this.boneTexture=null)}fromJSON(e,t){this.uuid=e.uuid;for(let i=0,n=e.bones.length;i<n;i++){let r=e.bones[i],o=t[r];o===void 0&&(Ge("Skeleton: No bone found with UUID:",r),o=new ar),this.bones.push(o),this.boneInverses.push(new We().fromArray(e.boneInverses[i]))}return this.init(),this}toJSON(){let e={metadata:{version:4.7,type:"Skeleton",generator:"Skeleton.toJSON"},bones:[],boneInverses:[]};e.uuid=this.uuid;let t=this.bones,i=this.boneInverses;for(let n=0,r=t.length;n<r;n++){let o=t[n];e.bones.push(o.uuid);let a=i[n];e.boneInverses.push(a.toArray())}return e}},Mn=class extends Ct{constructor(e,t,i,n=1){super(e,t,i),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=n}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}},qs=new We,sf=new We,Na=[],rf=new oi,_0=new We,Gr=new De,Wr=new mi,ds=class extends De{constructor(e,t,i){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new Mn(new Float32Array(i*16),16),this.instanceColor=null,this.morphTexture=null,this.count=i,this.boundingBox=null,this.boundingSphere=null;for(let n=0;n<i;n++)this.setMatrixAt(n,_0)}computeBoundingBox(){let e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new oi),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let i=0;i<t;i++)this.getMatrixAt(i,qs),rf.copy(e.boundingBox).applyMatrix4(qs),this.boundingBox.union(rf)}computeBoundingSphere(){let e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new mi),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let i=0;i<t;i++)this.getMatrixAt(i,qs),Wr.copy(e.boundingSphere).applyMatrix4(qs),this.boundingSphere.union(Wr)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){return this.instanceColor===null?t.setRGB(1,1,1):t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){return t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){let i=t.morphTargetInfluences,n=this.morphTexture.source.data.data,r=i.length+1,o=e*r+1;for(let a=0;a<i.length;a++)i[a]=n[o+a]}raycast(e,t){let i=this.matrixWorld,n=this.count;if(Gr.geometry=this.geometry,Gr.material=this.material,Gr.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Wr.copy(this.boundingSphere),Wr.applyMatrix4(i),e.ray.intersectsSphere(Wr)!==!1))for(let r=0;r<n;r++){this.getMatrixAt(r,qs),sf.multiplyMatrices(i,qs),Gr.matrixWorld=sf,Gr.raycast(e,Na);for(let o=0,a=Na.length;o<a;o++){let l=Na[o];l.instanceId=r,l.object=this,t.push(l)}Na.length=0}}setColorAt(e,t){return this.instanceColor===null&&(this.instanceColor=new Mn(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3),this}setMatrixAt(e,t){return t.toArray(this.instanceMatrix.array,e*16),this}setMorphAt(e,t){let i=t.morphTargetInfluences,n=i.length+1;this.morphTexture===null&&(this.morphTexture=new en(new Float32Array(n*this.count),n,this.count,Il,wi));let r=this.morphTexture.source.data.data,o=0;for(let c=0;c<i.length;c++)o+=i[c];let a=this.geometry.morphTargetsRelative?1:1-o,l=n*e;return r[l]=a,r.set(i,l+1),this}updateMorphTargets(){}dispose(){super.dispose(),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}},os=new mi,v0=new ee(.5,.5),Ua=new D,lr=class{constructor(e=new $t,t=new $t,i=new $t,n=new $t,r=new $t,o=new $t){this.planes=[e,t,i,n,r,o]}set(e,t,i,n,r,o){let a=this.planes;return a[0].copy(e),a[1].copy(t),a[2].copy(i),a[3].copy(n),a[4].copy(r),a[5].copy(o),this}copy(e){let t=this.planes;for(let i=0;i<6;i++)t[i].copy(e.planes[i]);return this}setFromProjectionMatrix(e,t=Hi,i=!1){let n=this.planes,r=e.elements,o=r[0],a=r[1],l=r[2],c=r[3],h=r[4],f=r[5],d=r[6],u=r[7],p=r[8],x=r[9],m=r[10],g=r[11],S=r[12],T=r[13],_=r[14],v=r[15];if(n[0].setComponents(c-o,u-h,g-p,v-S).normalize(),n[1].setComponents(c+o,u+h,g+p,v+S).normalize(),n[2].setComponents(c+a,u+f,g+x,v+T).normalize(),n[3].setComponents(c-a,u-f,g-x,v-T).normalize(),i)n[4].setComponents(l,d,m,_).normalize(),n[5].setComponents(c-l,u-d,g-m,v-_).normalize();else if(n[4].setComponents(c-l,u-d,g-m,v-_).normalize(),t===Hi)n[5].setComponents(c+l,u+d,g+m,v+_).normalize();else if(t===$s)n[5].setComponents(l,d,m,_).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),os.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),os.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(os)}intersectsSprite(e){os.center.set(0,0,0);let t=v0.distanceTo(e.center);return os.radius=.7071067811865476+t,os.applyMatrix4(e.matrixWorld),this.intersectsSphere(os)}intersectsSphere(e){let t=this.planes,i=e.center,n=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(i)<n)return!1;return!0}intersectsBox(e){let t=this.planes;for(let i=0;i<6;i++){let n=t[i];if(Ua.x=n.normal.x>0?e.max.x:e.min.x,Ua.y=n.normal.y>0?e.max.y:e.min.y,Ua.z=n.normal.z>0?e.max.z:e.min.z,n.distanceToPoint(Ua)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let i=0;i<6;i++)if(t[i].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var Vn=class extends ei{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new Me(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}},nl=new D,sl=new D,of=new We,Xr=new $i,Oa=new mi,bh=new D,af=new D,fs=class extends Rt{constructor(e=new _t,t=new Vn){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,i=[0];for(let n=1,r=t.count;n<r;n++)nl.fromBufferAttribute(t,n-1),sl.fromBufferAttribute(t,n),i[n]=i[n-1],i[n]+=nl.distanceTo(sl);e.setAttribute("lineDistance",new at(i,1))}else Ge("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let i=this.geometry,n=this.matrixWorld,r=e.params.Line.threshold,o=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),Oa.copy(i.boundingSphere),Oa.applyMatrix4(n),Oa.radius+=r,e.ray.intersectsSphere(Oa)===!1)return;of.copy(n).invert(),Xr.copy(e.ray).applyMatrix4(of);let a=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=this.isLineSegments?2:1,h=i.index,d=i.attributes.position;if(h!==null){let u=Math.max(0,o.start),p=Math.min(h.count,o.start+o.count);for(let x=u,m=p-1;x<m;x+=c){let g=h.getX(x),S=h.getX(x+1),T=Fa(this,e,Xr,l,g,S,x);T&&t.push(T)}if(this.isLineLoop){let x=h.getX(p-1),m=h.getX(u),g=Fa(this,e,Xr,l,x,m,p-1);g&&t.push(g)}}else{let u=Math.max(0,o.start),p=Math.min(d.count,o.start+o.count);for(let x=u,m=p-1;x<m;x+=c){let g=Fa(this,e,Xr,l,x,x+1,x);g&&t.push(g)}if(this.isLineLoop){let x=Fa(this,e,Xr,l,p-1,u,p-1);x&&t.push(x)}}}updateMorphTargets(){let t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){let n=t[i[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=n.length;r<o;r++){let a=n[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}};function Fa(s,e,t,i,n,r,o){let a=s.geometry.attributes.position;if(nl.fromBufferAttribute(a,n),sl.fromBufferAttribute(a,r),t.distanceSqToSegment(nl,sl,bh,af)>i)return;bh.applyMatrix4(s.matrixWorld);let c=e.ray.origin.distanceTo(bh);if(!(c<e.near||c>e.far))return{distance:c,point:af.clone().applyMatrix4(s.matrixWorld),index:o,face:null,faceIndex:null,barycoord:null,object:s}}var lf=new D,cf=new D,ps=class extends fs{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,i=[];for(let n=0,r=t.count;n<r;n+=2)lf.fromBufferAttribute(t,n),cf.fromBufferAttribute(t,n+1),i[n]=n===0?0:i[n-1],i[n+1]=i[n]+lf.distanceTo(cf);e.setAttribute("lineDistance",new at(i,1))}else Ge("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}},oo=class extends fs{constructor(e,t){super(e,t),this.isLineLoop=!0,this.type="LineLoop"}},cr=class extends ei{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new Me(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},hf=new We,Dh=new $i,Ba=new mi,ka=new D,ao=class extends Rt{constructor(e=new _t,t=new cr){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let i=this.geometry,n=this.matrixWorld,r=e.params.Points.threshold,o=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),Ba.copy(i.boundingSphere),Ba.applyMatrix4(n),Ba.radius+=r,e.ray.intersectsSphere(Ba)===!1)return;hf.copy(n).invert(),Dh.copy(e.ray).applyMatrix4(hf);let a=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=i.index,f=i.attributes.position;if(c!==null){let d=Math.max(0,o.start),u=Math.min(c.count,o.start+o.count);for(let p=d,x=u;p<x;p++){let m=c.getX(p);ka.fromBufferAttribute(f,m),uf(ka,m,l,n,e,t,this)}}else{let d=Math.max(0,o.start),u=Math.min(f.count,o.start+o.count);for(let p=d,x=u;p<x;p++)ka.fromBufferAttribute(f,p),uf(ka,p,l,n,e,t,this)}}updateMorphTargets(){let t=this.geometry.morphAttributes,i=Object.keys(t);if(i.length>0){let n=t[i[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=n.length;r<o;r++){let a=n[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}};function uf(s,e,t,i,n,r,o){let a=Dh.distanceSqToPoint(s);if(a<t){let l=new D;Dh.closestPointToPoint(s,l),l.applyMatrix4(i);let c=n.ray.origin.distanceTo(l);if(c<n.near||c>n.far)return;r.push({distance:c,distanceToRay:Math.sqrt(a),point:l,index:e,face:null,faceIndex:null,barycoord:null,object:o})}}var lo=class extends Ot{constructor(e=[],t=Jn,i,n,r,o,a,l,c,h){super(e,t,i,n,r,o,a,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},Ci=class extends Ot{constructor(e,t,i,n,r,o,a,l,c){super(e,t,i,n,r,o,a,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}};var tn=class extends Ot{constructor(e,t,i=Wi,n,r,o,a=bt,l=bt,c,h=Ji,f=1){if(h!==Ji&&h!==on)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let d={width:e,height:t,depth:f};super(d,n,r,o,a,l,h,i,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new ir(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return t.compareFunction=this.compareFunction,t}},rl=class extends tn{constructor(e,t=Wi,i=Jn,n,r,o=bt,a=bt,l,c=Ji){let h={width:e,height:e,depth:1},f=[h,h,h,h,h,h];super(e,e,t,i,n,r,o,a,l,c),this.image=f,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},co=class extends Ot{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},qt=class s extends _t{constructor(e=1,t=1,i=1,n=1,r=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:i,widthSegments:n,heightSegments:r,depthSegments:o};let a=this;n=Math.floor(n),r=Math.floor(r),o=Math.floor(o);let l=[],c=[],h=[],f=[],d=0,u=0;p("z","y","x",-1,-1,i,t,e,o,r,0),p("z","y","x",1,-1,i,t,-e,o,r,1),p("x","z","y",1,1,e,i,t,n,o,2),p("x","z","y",1,-1,e,i,-t,n,o,3),p("x","y","z",1,-1,e,t,i,n,r,4),p("x","y","z",-1,-1,e,t,-i,n,r,5),this.setIndex(l),this.setAttribute("position",new at(c,3)),this.setAttribute("normal",new at(h,3)),this.setAttribute("uv",new at(f,2));function p(x,m,g,S,T,_,v,E,A,y,R){let I=_/A,L=v/y,b=_/2,w=v/2,P=E/2,U=A+1,F=y+1,O=0,z=0,k=new D;for(let G=0;G<F;G++){let Y=G*L-w;for(let he=0;he<U;he++){let pe=he*I-b;k[x]=pe*S,k[m]=Y*T,k[g]=P,c.push(k.x,k.y,k.z),k[x]=0,k[m]=0,k[g]=E>0?1:-1,h.push(k.x,k.y,k.z),f.push(he/A),f.push(1-G/y),O+=1}}for(let G=0;G<y;G++)for(let Y=0;Y<A;Y++){let he=d+Y+U*G,pe=d+Y+U*(G+1),Te=d+(Y+1)+U*(G+1),Ee=d+(Y+1)+U*G;l.push(he,pe,Ee),l.push(pe,Te,Ee),z+=6}a.addGroup(u,z,R),u+=z,d+=O}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}};var ho=class s extends _t{constructor(e=1,t=32,i=0,n=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:e,segments:t,thetaStart:i,thetaLength:n},t=Math.max(3,t);let r=[],o=[],a=[],l=[],c=new D,h=new ee;o.push(0,0,0),a.push(0,0,1),l.push(.5,.5);for(let f=0,d=3;f<=t;f++,d+=3){let u=i+f/t*n;c.x=e*Math.cos(u),c.y=e*Math.sin(u),o.push(c.x,c.y,c.z),a.push(0,0,1),h.x=(o[d]/e+1)/2,h.y=(o[d+1]/e+1)/2,l.push(h.x,h.y)}for(let f=1;f<=t;f++)r.push(f,f+1,0);this.setIndex(r),this.setAttribute("position",new at(o,3)),this.setAttribute("normal",new at(a,3)),this.setAttribute("uv",new at(l,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.radius,e.segments,e.thetaStart,e.thetaLength)}},Yt=class s extends _t{constructor(e=1,t=1,i=1,n=32,r=1,o=!1,a=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:i,radialSegments:n,heightSegments:r,openEnded:o,thetaStart:a,thetaLength:l};let c=this;n=Math.floor(n),r=Math.floor(r);let h=[],f=[],d=[],u=[],p=0,x=[],m=i/2,g=0;S(),o===!1&&(e>0&&T(!0),t>0&&T(!1)),this.setIndex(h),this.setAttribute("position",new at(f,3)),this.setAttribute("normal",new at(d,3)),this.setAttribute("uv",new at(u,2));function S(){let _=new D,v=new D,E=0,A=(t-e)/i;for(let y=0;y<=r;y++){let R=[],I=y/r,L=I*(t-e)+e;for(let b=0;b<=n;b++){let w=b/n,P=w*l+a,U=Math.sin(P),F=Math.cos(P);v.x=L*U,v.y=-I*i+m,v.z=L*F,f.push(v.x,v.y,v.z),_.set(U,A,F).normalize(),d.push(_.x,_.y,_.z),u.push(w,1-I),R.push(p++)}x.push(R)}for(let y=0;y<n;y++)for(let R=0;R<r;R++){let I=x[R][y],L=x[R+1][y],b=x[R+1][y+1],w=x[R][y+1];(e>0||R!==0)&&(h.push(I,L,w),E+=3),(t>0||R!==r-1)&&(h.push(L,b,w),E+=3)}c.addGroup(g,E,0),g+=E}function T(_){let v=p,E=new ee,A=new D,y=0,R=_===!0?e:t,I=_===!0?1:-1;for(let b=1;b<=n;b++)f.push(0,m*I,0),d.push(0,I,0),u.push(.5,.5),p++;let L=p;for(let b=0;b<=n;b++){let P=b/n*l+a,U=Math.cos(P),F=Math.sin(P);A.x=R*F,A.y=m*I,A.z=R*U,f.push(A.x,A.y,A.z),d.push(0,I,0),E.x=U*.5+.5,E.y=F*.5*I+.5,u.push(E.x,E.y),p++}for(let b=0;b<n;b++){let w=v+b,P=L+b;_===!0?h.push(P,P+1,w):h.push(P+1,P,w),y+=3}c.addGroup(g,y,_===!0?1:2),g+=y}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}};var Mi=class{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){Ge("Curve: .getPoint() not implemented.")}getPointAt(e,t){let i=this.getUtoTmapping(e);return this.getPoint(i,t)}getPoints(e=5){let t=[];for(let i=0;i<=e;i++)t.push(this.getPoint(i/e));return t}getSpacedPoints(e=5){let t=[];for(let i=0;i<=e;i++)t.push(this.getPointAt(i/e));return t}getLength(){let e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let t=[],i,n=this.getPoint(0),r=0;t.push(0);for(let o=1;o<=e;o++)i=this.getPoint(o/e),r+=i.distanceTo(n),t.push(r),n=i;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t=null){let i=this.getLengths(),n=0,r=i.length,o;t?o=t:o=e*i[r-1];let a=0,l=r-1,c;for(;a<=l;)if(n=Math.floor(a+(l-a)/2),c=i[n]-o,c<0)a=n+1;else if(c>0)l=n-1;else{l=n;break}if(n=l,i[n]===o)return n/(r-1);let h=i[n],d=i[n+1]-h,u=(o-h)/d;return(n+u)/(r-1)}getTangent(e,t){let n=e-1e-4,r=e+1e-4;n<0&&(n=0),r>1&&(r=1);let o=this.getPoint(n),a=this.getPoint(r),l=t||(o.isVector2?new ee:new D);return l.copy(a).sub(o).normalize(),l}getTangentAt(e,t){let i=this.getUtoTmapping(e);return this.getTangent(i,t)}computeFrenetFrames(e,t=!1){let i=new D,n=[],r=[],o=[],a=new D,l=new We;for(let u=0;u<=e;u++){let p=u/e;n[u]=this.getTangentAt(p,new D)}r[0]=new D,o[0]=new D;let c=Number.MAX_VALUE,h=Math.abs(n[0].x),f=Math.abs(n[0].y),d=Math.abs(n[0].z);h<=c&&(c=h,i.set(1,0,0)),f<=c&&(c=f,i.set(0,1,0)),d<=c&&i.set(0,0,1),a.crossVectors(n[0],i).normalize(),r[0].crossVectors(n[0],a),o[0].crossVectors(n[0],r[0]);for(let u=1;u<=e;u++){if(r[u]=r[u-1].clone(),o[u]=o[u-1].clone(),a.crossVectors(n[u-1],n[u]),a.length()>Number.EPSILON){a.normalize();let p=Math.acos(it(n[u-1].dot(n[u]),-1,1));r[u].applyMatrix4(l.makeRotationAxis(a,p))}o[u].crossVectors(n[u],r[u])}if(t===!0){let u=Math.acos(it(r[0].dot(r[e]),-1,1));u/=e,n[0].dot(a.crossVectors(r[0],r[e]))>0&&(u=-u);for(let p=1;p<=e;p++)r[p].applyMatrix4(l.makeRotationAxis(n[p],u*p)),o[p].crossVectors(n[p],r[p])}return{tangents:n,normals:r,binormals:o}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}toJSON(){let e={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}},hr=class extends Mi{constructor(e=0,t=0,i=1,n=1,r=0,o=Math.PI*2,a=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=e,this.aY=t,this.xRadius=i,this.yRadius=n,this.aStartAngle=r,this.aEndAngle=o,this.aClockwise=a,this.aRotation=l}getPoint(e,t=new ee){let i=t,n=Math.PI*2,r=this.aEndAngle-this.aStartAngle,o=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=n;for(;r>n;)r-=n;r<Number.EPSILON&&(o?r=0:r=n),this.aClockwise===!0&&!o&&(r===n?r=-n:r=r-n);let a=this.aStartAngle+e*r,l=this.aX+this.xRadius*Math.cos(a),c=this.aY+this.yRadius*Math.sin(a);if(this.aRotation!==0){let h=Math.cos(this.aRotation),f=Math.sin(this.aRotation),d=l-this.aX,u=c-this.aY;l=d*h-u*f+this.aX,c=d*f+u*h+this.aY}return i.set(l,c)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){let e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}},ol=class extends hr{constructor(e,t,i,n,r,o){super(e,t,i,i,n,r,o),this.isArcCurve=!0,this.type="ArcCurve"}};function au(){let s=0,e=0,t=0,i=0;function n(r,o,a,l){s=r,e=a,t=-3*r+3*o-2*a-l,i=2*r-2*o+a+l}return{initCatmullRom:function(r,o,a,l,c){n(o,a,c*(a-r),c*(l-o))},initNonuniformCatmullRom:function(r,o,a,l,c,h,f){let d=(o-r)/c-(a-r)/(c+h)+(a-o)/h,u=(a-o)/h-(l-o)/(h+f)+(l-a)/f;d*=h,u*=h,n(o,a,d,u)},calc:function(r){let o=r*r,a=o*r;return s+e*r+t*o+i*a}}}var df=new D,ff=new D,Sh=new au,wh=new au,Th=new au,al=class extends Mi{constructor(e=[],t=!1,i="centripetal",n=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=e,this.closed=t,this.curveType=i,this.tension=n}getPoint(e,t=new D){let i=t,n=this.points,r=n.length,o=(r-(this.closed?0:1))*e,a=Math.floor(o),l=o-a;this.closed?a+=a>0?0:(Math.floor(Math.abs(a)/r)+1)*r:l===0&&a===r-1&&(a=r-2,l=1);let c,h;this.closed||a>0?c=n[(a-1)%r]:(ff.subVectors(n[0],n[1]).add(n[0]),c=ff);let f=n[a%r],d=n[(a+1)%r];if(this.closed||a+2<r?h=n[(a+2)%r]:(df.subVectors(n[r-1],n[r-2]).add(n[r-1]),h=df),this.curveType==="centripetal"||this.curveType==="chordal"){let u=this.curveType==="chordal"?.5:.25,p=Math.pow(c.distanceToSquared(f),u),x=Math.pow(f.distanceToSquared(d),u),m=Math.pow(d.distanceToSquared(h),u);x<1e-4&&(x=1),p<1e-4&&(p=x),m<1e-4&&(m=x),Sh.initNonuniformCatmullRom(c.x,f.x,d.x,h.x,p,x,m),wh.initNonuniformCatmullRom(c.y,f.y,d.y,h.y,p,x,m),Th.initNonuniformCatmullRom(c.z,f.z,d.z,h.z,p,x,m)}else this.curveType==="catmullrom"&&(Sh.initCatmullRom(c.x,f.x,d.x,h.x,this.tension),wh.initCatmullRom(c.y,f.y,d.y,h.y,this.tension),Th.initCatmullRom(c.z,f.z,d.z,h.z,this.tension));return i.set(Sh.calc(l),wh.calc(l),Th.calc(l)),i}copy(e){super.copy(e),this.points=[];for(let t=0,i=e.points.length;t<i;t++){let n=e.points[t];this.points.push(n.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,i=this.points.length;t<i;t++){let n=this.points[t];e.points.push(n.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,i=e.points.length;t<i;t++){let n=e.points[t];this.points.push(new D().fromArray(n))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}};function pf(s,e,t,i,n){let r=(i-e)*.5,o=(n-t)*.5,a=s*s,l=s*a;return(2*t-2*i+r+o)*l+(-3*t+3*i-2*r-o)*a+r*s+t}function y0(s,e){let t=1-s;return t*t*e}function M0(s,e){return 2*(1-s)*s*e}function b0(s,e){return s*s*e}function Zr(s,e,t,i){return y0(s,e)+M0(s,t)+b0(s,i)}function S0(s,e){let t=1-s;return t*t*t*e}function w0(s,e){let t=1-s;return 3*t*t*s*e}function T0(s,e){return 3*(1-s)*s*s*e}function E0(s,e){return s*s*s*e}function Kr(s,e,t,i,n){return S0(s,e)+w0(s,t)+T0(s,i)+E0(s,n)}var uo=class extends Mi{constructor(e=new ee,t=new ee,i=new ee,n=new ee){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=e,this.v1=t,this.v2=i,this.v3=n}getPoint(e,t=new ee){let i=t,n=this.v0,r=this.v1,o=this.v2,a=this.v3;return i.set(Kr(e,n.x,r.x,o.x,a.x),Kr(e,n.y,r.y,o.y,a.y)),i}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},ll=class extends Mi{constructor(e=new D,t=new D,i=new D,n=new D){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=e,this.v1=t,this.v2=i,this.v3=n}getPoint(e,t=new D){let i=t,n=this.v0,r=this.v1,o=this.v2,a=this.v3;return i.set(Kr(e,n.x,r.x,o.x,a.x),Kr(e,n.y,r.y,o.y,a.y),Kr(e,n.z,r.z,o.z,a.z)),i}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},fo=class extends Mi{constructor(e=new ee,t=new ee){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=e,this.v2=t}getPoint(e,t=new ee){let i=t;return e===1?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(e).add(this.v1)),i}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new ee){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},cl=class extends Mi{constructor(e=new D,t=new D){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=e,this.v2=t}getPoint(e,t=new D){let i=t;return e===1?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(e).add(this.v1)),i}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new D){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},po=class extends Mi{constructor(e=new ee,t=new ee,i=new ee){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=e,this.v1=t,this.v2=i}getPoint(e,t=new ee){let i=t,n=this.v0,r=this.v1,o=this.v2;return i.set(Zr(e,n.x,r.x,o.x),Zr(e,n.y,r.y,o.y)),i}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},hl=class extends Mi{constructor(e=new D,t=new D,i=new D){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=e,this.v1=t,this.v2=i}getPoint(e,t=new D){let i=t,n=this.v0,r=this.v1,o=this.v2;return i.set(Zr(e,n.x,r.x,o.x),Zr(e,n.y,r.y,o.y),Zr(e,n.z,r.z,o.z)),i}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},mo=class extends Mi{constructor(e=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=e}getPoint(e,t=new ee){let i=t,n=this.points,r=(n.length-1)*e,o=Math.floor(r),a=r-o,l=n[o===0?o:o-1],c=n[o],h=n[o>n.length-2?n.length-1:o+1],f=n[o>n.length-3?n.length-1:o+2];return i.set(pf(a,l.x,c.x,h.x,f.x),pf(a,l.y,c.y,h.y,f.y)),i}copy(e){super.copy(e),this.points=[];for(let t=0,i=e.points.length;t<i;t++){let n=e.points[t];this.points.push(n.clone())}return this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,i=this.points.length;t<i;t++){let n=this.points[t];e.points.push(n.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,i=e.points.length;t<i;t++){let n=e.points[t];this.points.push(new ee().fromArray(n))}return this}},Nh=Object.freeze({__proto__:null,ArcCurve:ol,CatmullRomCurve3:al,CubicBezierCurve:uo,CubicBezierCurve3:ll,EllipseCurve:hr,LineCurve:fo,LineCurve3:cl,QuadraticBezierCurve:po,QuadraticBezierCurve3:hl,SplineCurve:mo}),ul=class extends Mi{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(e){this.curves.push(e)}closePath(){let e=this.curves[0].getPoint(0),t=this.curves[this.curves.length-1].getPoint(1);if(!e.equals(t)){let i=e.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new Nh[i](t,e))}return this}getPoint(e,t){let i=e*this.getLength(),n=this.getCurveLengths(),r=0;for(;r<n.length;){if(n[r]>=i){let o=n[r]-i,a=this.curves[r],l=a.getLength(),c=l===0?0:1-o/l;return a.getPointAt(c,t)}r++}return null}getLength(){let e=this.getCurveLengths();return e[e.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;let e=[],t=0;for(let i=0,n=this.curves.length;i<n;i++)t+=this.curves[i].getLength(),e.push(t);return this.cacheLengths=e,e}getSpacedPoints(e=40){let t=[];for(let i=0;i<=e;i++)t.push(this.getPoint(i/e));return this.autoClose&&t.push(t[0]),t}getPoints(e=12){let t=[],i;for(let n=0,r=this.curves;n<r.length;n++){let o=r[n],a=o.isEllipseCurve?e*2:o.isLineCurve||o.isLineCurve3?1:o.isSplineCurve?e*o.points.length:e,l=o.getPoints(a);for(let c=0;c<l.length;c++){let h=l[c];i&&i.equals(h)||(t.push(h),i=h)}}return this.autoClose&&t.length>1&&!t[t.length-1].equals(t[0])&&t.push(t[0]),t}copy(e){super.copy(e),this.curves=[];for(let t=0,i=e.curves.length;t<i;t++){let n=e.curves[t];this.curves.push(n.clone())}return this.autoClose=e.autoClose,this}toJSON(){let e=super.toJSON();e.autoClose=this.autoClose,e.curves=[];for(let t=0,i=this.curves.length;t<i;t++){let n=this.curves[t];e.curves.push(n.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.autoClose=e.autoClose,this.curves=[];for(let t=0,i=e.curves.length;t<i;t++){let n=e.curves[t];this.curves.push(new Nh[n.type]().fromJSON(n))}return this}},ms=class extends ul{constructor(e){super(),this.type="Path",this.currentPoint=new ee,e&&this.setFromPoints(e)}setFromPoints(e){this.moveTo(e[0].x,e[0].y);for(let t=1,i=e.length;t<i;t++)this.lineTo(e[t].x,e[t].y);return this}moveTo(e,t){return this.currentPoint.set(e,t),this}lineTo(e,t){let i=new fo(this.currentPoint.clone(),new ee(e,t));return this.curves.push(i),this.currentPoint.set(e,t),this}quadraticCurveTo(e,t,i,n){let r=new po(this.currentPoint.clone(),new ee(e,t),new ee(i,n));return this.curves.push(r),this.currentPoint.set(i,n),this}bezierCurveTo(e,t,i,n,r,o){let a=new uo(this.currentPoint.clone(),new ee(e,t),new ee(i,n),new ee(r,o));return this.curves.push(a),this.currentPoint.set(r,o),this}splineThru(e){let t=[this.currentPoint.clone()].concat(e),i=new mo(t);return this.curves.push(i),this.currentPoint.copy(e[e.length-1]),this}arc(e,t,i,n,r,o){let a=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(e+a,t+l,i,n,r,o),this}absarc(e,t,i,n,r,o){return this.absellipse(e,t,i,i,n,r,o),this}ellipse(e,t,i,n,r,o,a,l){let c=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(e+c,t+h,i,n,r,o,a,l),this}absellipse(e,t,i,n,r,o,a,l){let c=new hr(e,t,i,n,r,o,a,l);if(this.curves.length>0){let f=c.getPoint(0);f.equals(this.currentPoint)||this.lineTo(f.x,f.y)}this.curves.push(c);let h=c.getPoint(1);return this.currentPoint.copy(h),this}copy(e){return super.copy(e),this.currentPoint.copy(e.currentPoint),this}toJSON(){let e=super.toJSON();return e.currentPoint=this.currentPoint.toArray(),e}fromJSON(e){return super.fromJSON(e),this.currentPoint.fromArray(e.currentPoint),this}},gs=class extends ms{constructor(e){super(e),this.uuid=Ai(),this.type="Shape",this.holes=[]}getPointsHoles(e){let t=[];for(let i=0,n=this.holes.length;i<n;i++)t[i]=this.holes[i].getPoints(e);return t}extractPoints(e){return{shape:this.getPoints(e),holes:this.getPointsHoles(e)}}copy(e){super.copy(e),this.holes=[];for(let t=0,i=e.holes.length;t<i;t++){let n=e.holes[t];this.holes.push(n.clone())}return this}toJSON(){let e=super.toJSON();e.uuid=this.uuid,e.holes=[];for(let t=0,i=this.holes.length;t<i;t++){let n=this.holes[t];e.holes.push(n.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.uuid=e.uuid,this.holes=[];for(let t=0,i=e.holes.length;t<i;t++){let n=e.holes[t];this.holes.push(new ms().fromJSON(n))}return this}};function A0(s,e,t=2){let i=e&&e.length,n=i?e[0]*t:s.length,r=hp(s,0,n,t,!0),o=[];if(!r||r.next===r.prev)return o;let a,l,c;if(i&&(r=I0(s,e,r,t)),s.length>80*t){a=s[0],l=s[1];let h=a,f=l;for(let d=t;d<n;d+=t){let u=s[d],p=s[d+1];u<a&&(a=u),p<l&&(l=p),u>h&&(h=u),p>f&&(f=p)}c=Math.max(h-a,f-l),c=c!==0?32767/c:0}return go(r,o,t,a,l,c,0),o}function hp(s,e,t,i,n){let r;if(n===G0(s,e,t,i)>0)for(let o=e;o<t;o+=i)r=mf(o/i|0,s[o],s[o+1],r);else for(let o=t-i;o>=e;o-=i)r=mf(o/i|0,s[o],s[o+1],r);return r&&ur(r,r.next)&&(_o(r),r=r.next),r}function xs(s,e){if(!s)return s;e||(e=s);let t=s,i;do if(i=!1,!t.steiner&&(ur(t,t.next)||Lt(t.prev,t,t.next)===0)){if(_o(t),t=e=t.prev,t===t.next)break;i=!0}else t=t.next;while(i||t!==e);return e}function go(s,e,t,i,n,r,o){if(!s)return;!o&&r&&F0(s,i,n,r);let a=s;for(;s.prev!==s.next;){let l=s.prev,c=s.next;if(r?R0(s,i,n,r):C0(s)){e.push(l.i,s.i,c.i),_o(s),s=c.next,a=c.next;continue}if(s=c,s===a){o?o===1?(s=P0(xs(s),e),go(s,e,t,i,n,r,2)):o===2&&L0(s,e,t,i,n,r):go(xs(s),e,t,i,n,r,1);break}}}function C0(s){let e=s.prev,t=s,i=s.next;if(Lt(e,t,i)>=0)return!1;let n=e.x,r=t.x,o=i.x,a=e.y,l=t.y,c=i.y,h=Math.min(n,r,o),f=Math.min(a,l,c),d=Math.max(n,r,o),u=Math.max(a,l,c),p=i.next;for(;p!==e;){if(p.x>=h&&p.x<=d&&p.y>=f&&p.y<=u&&qr(n,a,r,l,o,c,p.x,p.y)&&Lt(p.prev,p,p.next)>=0)return!1;p=p.next}return!0}function R0(s,e,t,i){let n=s.prev,r=s,o=s.next;if(Lt(n,r,o)>=0)return!1;let a=n.x,l=r.x,c=o.x,h=n.y,f=r.y,d=o.y,u=Math.min(a,l,c),p=Math.min(h,f,d),x=Math.max(a,l,c),m=Math.max(h,f,d),g=Uh(u,p,e,t,i),S=Uh(x,m,e,t,i),T=s.prevZ,_=s.nextZ;for(;T&&T.z>=g&&_&&_.z<=S;){if(T.x>=u&&T.x<=x&&T.y>=p&&T.y<=m&&T!==n&&T!==o&&qr(a,h,l,f,c,d,T.x,T.y)&&Lt(T.prev,T,T.next)>=0||(T=T.prevZ,_.x>=u&&_.x<=x&&_.y>=p&&_.y<=m&&_!==n&&_!==o&&qr(a,h,l,f,c,d,_.x,_.y)&&Lt(_.prev,_,_.next)>=0))return!1;_=_.nextZ}for(;T&&T.z>=g;){if(T.x>=u&&T.x<=x&&T.y>=p&&T.y<=m&&T!==n&&T!==o&&qr(a,h,l,f,c,d,T.x,T.y)&&Lt(T.prev,T,T.next)>=0)return!1;T=T.prevZ}for(;_&&_.z<=S;){if(_.x>=u&&_.x<=x&&_.y>=p&&_.y<=m&&_!==n&&_!==o&&qr(a,h,l,f,c,d,_.x,_.y)&&Lt(_.prev,_,_.next)>=0)return!1;_=_.nextZ}return!0}function P0(s,e){let t=s;do{let i=t.prev,n=t.next.next;!ur(i,n)&&dp(i,t,t.next,n)&&xo(i,n)&&xo(n,i)&&(e.push(i.i,t.i,n.i),_o(t),_o(t.next),t=s=n),t=t.next}while(t!==s);return xs(t)}function L0(s,e,t,i,n,r){let o=s;do{let a=o.next.next;for(;a!==o.prev;){if(o.i!==a.i&&z0(o,a)){let l=fp(o,a);o=xs(o,o.next),l=xs(l,l.next),go(o,e,t,i,n,r,0),go(l,e,t,i,n,r,0);return}a=a.next}o=o.next}while(o!==s)}function I0(s,e,t,i){let n=[];for(let r=0,o=e.length;r<o;r++){let a=e[r]*i,l=r<o-1?e[r+1]*i:s.length,c=hp(s,a,l,i,!1);c===c.next&&(c.steiner=!0),n.push(k0(c))}n.sort(D0);for(let r=0;r<n.length;r++)t=N0(n[r],t);return t}function D0(s,e){let t=s.x-e.x;if(t===0&&(t=s.y-e.y,t===0)){let i=(s.next.y-s.y)/(s.next.x-s.x),n=(e.next.y-e.y)/(e.next.x-e.x);t=i-n}return t}function N0(s,e){let t=U0(s,e);if(!t)return e;let i=fp(t,s);return xs(i,i.next),xs(t,t.next)}function U0(s,e){let t=e,i=s.x,n=s.y,r=-1/0,o;if(ur(s,t))return t;do{if(ur(s,t.next))return t.next;if(n<=t.y&&n>=t.next.y&&t.next.y!==t.y){let f=t.x+(n-t.y)*(t.next.x-t.x)/(t.next.y-t.y);if(f<=i&&f>r&&(r=f,o=t.x<t.next.x?t:t.next,f===i))return o}t=t.next}while(t!==e);if(!o)return null;let a=o,l=o.x,c=o.y,h=1/0;t=o;do{if(i>=t.x&&t.x>=l&&i!==t.x&&up(n<c?i:r,n,l,c,n<c?r:i,n,t.x,t.y)){let f=Math.abs(n-t.y)/(i-t.x);xo(t,s)&&(f<h||f===h&&(t.x>o.x||t.x===o.x&&O0(o,t)))&&(o=t,h=f)}t=t.next}while(t!==a);return o}function O0(s,e){return Lt(s.prev,s,e.prev)<0&&Lt(e.next,s,s.next)<0}function F0(s,e,t,i){let n=s;do n.z===0&&(n.z=Uh(n.x,n.y,e,t,i)),n.prevZ=n.prev,n.nextZ=n.next,n=n.next;while(n!==s);n.prevZ.nextZ=null,n.prevZ=null,B0(n)}function B0(s){let e,t=1;do{let i=s,n;s=null;let r=null;for(e=0;i;){e++;let o=i,a=0;for(let c=0;c<t&&(a++,o=o.nextZ,!!o);c++);let l=t;for(;a>0||l>0&&o;)a!==0&&(l===0||!o||i.z<=o.z)?(n=i,i=i.nextZ,a--):(n=o,o=o.nextZ,l--),r?r.nextZ=n:s=n,n.prevZ=r,r=n;i=o}r.nextZ=null,t*=2}while(e>1);return s}function Uh(s,e,t,i,n){return s=(s-t)*n|0,e=(e-i)*n|0,s=(s|s<<8)&16711935,s=(s|s<<4)&252645135,s=(s|s<<2)&858993459,s=(s|s<<1)&1431655765,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,s|e<<1}function k0(s){let e=s,t=s;do(e.x<t.x||e.x===t.x&&e.y<t.y)&&(t=e),e=e.next;while(e!==s);return t}function up(s,e,t,i,n,r,o,a){return(n-o)*(e-a)>=(s-o)*(r-a)&&(s-o)*(i-a)>=(t-o)*(e-a)&&(t-o)*(r-a)>=(n-o)*(i-a)}function qr(s,e,t,i,n,r,o,a){return!(s===o&&e===a)&&up(s,e,t,i,n,r,o,a)}function z0(s,e){return s.next.i!==e.i&&s.prev.i!==e.i&&!H0(s,e)&&(xo(s,e)&&xo(e,s)&&V0(s,e)&&(Lt(s.prev,s,e.prev)||Lt(s,e.prev,e))||ur(s,e)&&Lt(s.prev,s,s.next)>0&&Lt(e.prev,e,e.next)>0)}function Lt(s,e,t){return(e.y-s.y)*(t.x-e.x)-(e.x-s.x)*(t.y-e.y)}function ur(s,e){return s.x===e.x&&s.y===e.y}function dp(s,e,t,i){let n=Ha(Lt(s,e,t)),r=Ha(Lt(s,e,i)),o=Ha(Lt(t,i,s)),a=Ha(Lt(t,i,e));return!!(n!==r&&o!==a||n===0&&za(s,t,e)||r===0&&za(s,i,e)||o===0&&za(t,s,i)||a===0&&za(t,e,i))}function za(s,e,t){return e.x<=Math.max(s.x,t.x)&&e.x>=Math.min(s.x,t.x)&&e.y<=Math.max(s.y,t.y)&&e.y>=Math.min(s.y,t.y)}function Ha(s){return s>0?1:s<0?-1:0}function H0(s,e){let t=s;do{if(t.i!==s.i&&t.next.i!==s.i&&t.i!==e.i&&t.next.i!==e.i&&dp(t,t.next,s,e))return!0;t=t.next}while(t!==s);return!1}function xo(s,e){return Lt(s.prev,s,s.next)<0?Lt(s,e,s.next)>=0&&Lt(s,s.prev,e)>=0:Lt(s,e,s.prev)<0||Lt(s,s.next,e)<0}function V0(s,e){let t=s,i=!1,n=(s.x+e.x)/2,r=(s.y+e.y)/2;do t.y>r!=t.next.y>r&&t.next.y!==t.y&&n<(t.next.x-t.x)*(r-t.y)/(t.next.y-t.y)+t.x&&(i=!i),t=t.next;while(t!==s);return i}function fp(s,e){let t=Oh(s.i,s.x,s.y),i=Oh(e.i,e.x,e.y),n=s.next,r=e.prev;return s.next=e,e.prev=s,t.next=n,n.prev=t,i.next=t,t.prev=i,r.next=i,i.prev=r,i}function mf(s,e,t,i){let n=Oh(s,e,t);return i?(n.next=i.next,n.prev=i,i.next.prev=n,i.next=n):(n.prev=n,n.next=n),n}function _o(s){s.next.prev=s.prev,s.prev.next=s.next,s.prevZ&&(s.prevZ.nextZ=s.nextZ),s.nextZ&&(s.nextZ.prevZ=s.prevZ)}function Oh(s,e,t){return{i:s,x:e,y:t,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function G0(s,e,t,i){let n=0;for(let r=e,o=t-i;r<t;r+=i)n+=(s[o]-s[r])*(s[r+1]+s[o+1]),o=r;return n}var Fh=class{static triangulate(e,t,i=2){return A0(e,t,i)}},Zi=class s{static area(e){let t=e.length,i=0;for(let n=t-1,r=0;r<t;n=r++)i+=e[n].x*e[r].y-e[r].x*e[n].y;return i*.5}static isClockWise(e){return s.area(e)<0}static triangulateShape(e,t){let i=[],n=[],r=[];gf(e),xf(i,e);let o=e.length;t.forEach(gf);for(let l=0;l<t.length;l++)n.push(o),o+=t[l].length,xf(i,t[l]);let a=Fh.triangulate(i,n);for(let l=0;l<a.length;l+=3)r.push(a.slice(l,l+3));return r}};function gf(s){let e=s.length;e>2&&s[e-1].equals(s[0])&&s.pop()}function xf(s,e){for(let t=0;t<e.length;t++)s.push(e[t].x),s.push(e[t].y)}var vo=class s extends _t{constructor(e=new gs([new ee(.5,.5),new ee(-.5,.5),new ee(-.5,-.5),new ee(.5,-.5)]),t={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:e,options:t},e=Array.isArray(e)?e:[e];let i=this,n=[],r=[];for(let a=0,l=e.length;a<l;a++){let c=e[a];o(c)}this.setAttribute("position",new at(n,3)),this.setAttribute("uv",new at(r,2)),this.computeVertexNormals();function o(a){let l=[],c=t.curveSegments!==void 0?t.curveSegments:12,h=t.steps!==void 0?t.steps:1,f=t.depth!==void 0?t.depth:1,d=t.bevelEnabled!==void 0?t.bevelEnabled:!0,u=t.bevelThickness!==void 0?t.bevelThickness:.2,p=t.bevelSize!==void 0?t.bevelSize:u-.1,x=t.bevelOffset!==void 0?t.bevelOffset:0,m=t.bevelSegments!==void 0?t.bevelSegments:3,g=t.extrudePath,S=t.UVGenerator!==void 0?t.UVGenerator:W0,T,_=!1,v,E,A,y;if(g){T=g.getSpacedPoints(h),_=!0,d=!1;let ie=g.isCatmullRomCurve3?g.closed:!1;v=g.computeFrenetFrames(h,ie),E=new D,A=new D,y=new D}d||(m=0,u=0,p=0,x=0);let R=a.extractPoints(c),I=R.shape,L=R.holes;if(!Zi.isClockWise(I)){I=I.reverse();for(let ie=0,ae=L.length;ie<ae;ie++){let re=L[ie];Zi.isClockWise(re)&&(L[ie]=re.reverse())}}function w(ie){let re=10000000000000001e-36,oe=ie[0];for(let le=1;le<=ie.length;le++){let ke=le%ie.length,Ie=ie[ke],Ue=Ie.x-oe.x,je=Ie.y-oe.y,B=Ue*Ue+je*je,$e=Math.max(Math.abs(Ie.x),Math.abs(Ie.y),Math.abs(oe.x),Math.abs(oe.y)),Ze=re*$e*$e;if(B<=Ze){ie.splice(ke,1),le--;continue}oe=Ie}}w(I),L.forEach(w);let P=L.length,U=I;for(let ie=0;ie<P;ie++){let ae=L[ie];I=I.concat(ae)}function F(ie,ae,re){return ae||Ke("ExtrudeGeometry: vec does not exist"),ie.clone().addScaledVector(ae,re)}let O=I.length;function z(ie,ae,re){let oe,le,ke,Ie=ie.x-ae.x,Ue=ie.y-ae.y,je=re.x-ie.x,B=re.y-ie.y,$e=Ie*Ie+Ue*Ue,Ze=Ie*B-Ue*je;if(Math.abs(Ze)>Number.EPSILON){let N=Math.sqrt($e),M=Math.sqrt(je*je+B*B),W=ae.x-Ue/N,X=ae.y+Ie/N,q=re.x-B/M,ue=re.y+je/M,de=((q-W)*B-(ue-X)*je)/(Ie*B-Ue*je);oe=W+Ie*de-ie.x,le=X+Ue*de-ie.y;let $=oe*oe+le*le;if($<=2)return new ee(oe,le);ke=Math.sqrt($/2)}else{let N=!1;Ie>Number.EPSILON?je>Number.EPSILON&&(N=!0):Ie<-Number.EPSILON?je<-Number.EPSILON&&(N=!0):Math.sign(Ue)===Math.sign(B)&&(N=!0),N?(oe=-Ue,le=Ie,ke=Math.sqrt($e)):(oe=Ie,le=Ue,ke=Math.sqrt($e/2))}return new ee(oe/ke,le/ke)}let k=[];for(let ie=0,ae=U.length,re=ae-1,oe=ie+1;ie<ae;ie++,re++,oe++)re===ae&&(re=0),oe===ae&&(oe=0),k[ie]=z(U[ie],U[re],U[oe]);let G=[],Y,he=k.concat();for(let ie=0,ae=P;ie<ae;ie++){let re=L[ie];Y=[];for(let oe=0,le=re.length,ke=le-1,Ie=oe+1;oe<le;oe++,ke++,Ie++)ke===le&&(ke=0),Ie===le&&(Ie=0),Y[oe]=z(re[oe],re[ke],re[Ie]);G.push(Y),he=he.concat(Y)}let pe;if(m===0)pe=Zi.triangulateShape(U,L);else{let ie=[],ae=[];for(let re=0;re<m;re++){let oe=re/m,le=u*Math.cos(oe*Math.PI/2),ke=p*Math.sin(oe*Math.PI/2)+x;for(let Ie=0,Ue=U.length;Ie<Ue;Ie++){let je=F(U[Ie],k[Ie],ke);fe(je.x,je.y,-le),oe===0&&ie.push(je)}for(let Ie=0,Ue=P;Ie<Ue;Ie++){let je=L[Ie];Y=G[Ie];let B=[];for(let $e=0,Ze=je.length;$e<Ze;$e++){let N=F(je[$e],Y[$e],ke);fe(N.x,N.y,-le),oe===0&&B.push(N)}oe===0&&ae.push(B)}}pe=Zi.triangulateShape(ie,ae)}let Te=pe.length,Ee=p+x;for(let ie=0;ie<O;ie++){let ae=d?F(I[ie],he[ie],Ee):I[ie];_?(A.copy(v.normals[0]).multiplyScalar(ae.x),E.copy(v.binormals[0]).multiplyScalar(ae.y),y.copy(T[0]).add(A).add(E),fe(y.x,y.y,y.z)):fe(ae.x,ae.y,0)}for(let ie=1;ie<=h;ie++)for(let ae=0;ae<O;ae++){let re=d?F(I[ae],he[ae],Ee):I[ae];_?(A.copy(v.normals[ie]).multiplyScalar(re.x),E.copy(v.binormals[ie]).multiplyScalar(re.y),y.copy(T[ie]).add(A).add(E),fe(y.x,y.y,y.z)):fe(re.x,re.y,f/h*ie)}for(let ie=m-1;ie>=0;ie--){let ae=ie/m,re=u*Math.cos(ae*Math.PI/2),oe=p*Math.sin(ae*Math.PI/2)+x;for(let le=0,ke=U.length;le<ke;le++){let Ie=F(U[le],k[le],oe);fe(Ie.x,Ie.y,f+re)}for(let le=0,ke=L.length;le<ke;le++){let Ie=L[le];Y=G[le];for(let Ue=0,je=Ie.length;Ue<je;Ue++){let B=F(Ie[Ue],Y[Ue],oe);_?fe(B.x,B.y+T[h-1].y,T[h-1].x+re):fe(B.x,B.y,f+re)}}}Re(),j();function Re(){let ie=n.length/3;if(d){let ae=0,re=O*ae;for(let oe=0;oe<Te;oe++){let le=pe[oe];Le(le[2]+re,le[1]+re,le[0]+re)}ae=h+m*2,re=O*ae;for(let oe=0;oe<Te;oe++){let le=pe[oe];Le(le[0]+re,le[1]+re,le[2]+re)}}else{for(let ae=0;ae<Te;ae++){let re=pe[ae];Le(re[2],re[1],re[0])}for(let ae=0;ae<Te;ae++){let re=pe[ae];Le(re[0]+O*h,re[1]+O*h,re[2]+O*h)}}i.addGroup(ie,n.length/3-ie,0)}function j(){let ie=n.length/3,ae=0;J(U,ae),ae+=U.length;for(let re=0,oe=L.length;re<oe;re++){let le=L[re];J(le,ae),ae+=le.length}i.addGroup(ie,n.length/3-ie,1)}function J(ie,ae){let re=ie.length;for(;--re>=0;){let oe=re,le=re-1;le<0&&(le=ie.length-1);for(let ke=0,Ie=h+m*2;ke<Ie;ke++){let Ue=O*ke,je=O*(ke+1),B=ae+oe+Ue,$e=ae+le+Ue,Ze=ae+le+je,N=ae+oe+je;_e(B,$e,Ze,N)}}}function fe(ie,ae,re){l.push(ie),l.push(ae),l.push(re)}function Le(ie,ae,re){ze(ie),ze(ae),ze(re);let oe=n.length/3,le=S.generateTopUV(i,n,oe-3,oe-2,oe-1);et(le[0]),et(le[1]),et(le[2])}function _e(ie,ae,re,oe){ze(ie),ze(ae),ze(oe),ze(ae),ze(re),ze(oe);let le=n.length/3,ke=S.generateSideWallUV(i,n,le-6,le-3,le-2,le-1);et(ke[0]),et(ke[1]),et(ke[3]),et(ke[1]),et(ke[2]),et(ke[3])}function ze(ie){n.push(l[ie*3+0]),n.push(l[ie*3+1]),n.push(l[ie*3+2])}function et(ie){r.push(ie.x),r.push(ie.y)}}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON(),t=this.parameters.shapes,i=this.parameters.options;return X0(t,i,e)}static fromJSON(e,t){let i=[];for(let r=0,o=e.shapes.length;r<o;r++){let a=t[e.shapes[r]];i.push(a)}let n=e.options.extrudePath;return n!==void 0&&(e.options.extrudePath=new Nh[n.type]().fromJSON(n)),new s(i,e.options)}},W0={generateTopUV:function(s,e,t,i,n){let r=e[t*3],o=e[t*3+1],a=e[i*3],l=e[i*3+1],c=e[n*3],h=e[n*3+1];return[new ee(r,o),new ee(a,l),new ee(c,h)]},generateSideWallUV:function(s,e,t,i,n,r){let o=e[t*3],a=e[t*3+1],l=e[t*3+2],c=e[i*3],h=e[i*3+1],f=e[i*3+2],d=e[n*3],u=e[n*3+1],p=e[n*3+2],x=e[r*3],m=e[r*3+1],g=e[r*3+2];return Math.abs(a-h)<Math.abs(o-c)?[new ee(o,1-l),new ee(c,1-f),new ee(d,1-p),new ee(x,1-g)]:[new ee(a,1-l),new ee(h,1-f),new ee(u,1-p),new ee(m,1-g)]}};function X0(s,e,t){if(t.shapes=[],Array.isArray(s))for(let i=0,n=s.length;i<n;i++){let r=s[i];t.shapes.push(r.uuid)}else t.shapes.push(s.uuid);return t.options=Object.assign({},e),e.extrudePath!==void 0&&(t.options.extrudePath=e.extrudePath.toJSON()),t}var Gn=class s extends _t{constructor(e=1,t=1,i=1,n=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:i,heightSegments:n};let r=e/2,o=t/2,a=Math.floor(i),l=Math.floor(n),c=a+1,h=l+1,f=e/a,d=t/l,u=[],p=[],x=[],m=[];for(let g=0;g<h;g++){let S=g*d-o;for(let T=0;T<c;T++){let _=T*f-r;p.push(_,-S,0),x.push(0,0,1),m.push(T/a),m.push(1-g/l)}}for(let g=0;g<l;g++)for(let S=0;S<a;S++){let T=S+c*g,_=S+c*(g+1),v=S+1+c*(g+1),E=S+1+c*g;u.push(T,_,E),u.push(_,v,E)}this.setIndex(u),this.setAttribute("position",new at(p,3)),this.setAttribute("normal",new at(x,3)),this.setAttribute("uv",new at(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.width,e.height,e.widthSegments,e.heightSegments)}};var bn=class s extends _t{constructor(e=new gs([new ee(0,.5),new ee(-.5,-.5),new ee(.5,-.5)]),t=12){super(),this.type="ShapeGeometry",this.parameters={shapes:e,curveSegments:t};let i=[],n=[],r=[],o=[],a=0,l=0;if(Array.isArray(e)===!1)c(e);else for(let h=0;h<e.length;h++)c(e[h]),this.addGroup(a,l,h),a+=l,l=0;this.setIndex(i),this.setAttribute("position",new at(n,3)),this.setAttribute("normal",new at(r,3)),this.setAttribute("uv",new at(o,2));function c(h){let f=n.length/3,d=h.extractPoints(t),u=d.shape,p=d.holes;Zi.isClockWise(u)===!1&&(u=u.reverse());for(let m=0,g=p.length;m<g;m++){let S=p[m];Zi.isClockWise(S)===!0&&(p[m]=S.reverse())}let x=Zi.triangulateShape(u,p);for(let m=0,g=p.length;m<g;m++){let S=p[m];u=u.concat(S)}for(let m=0,g=u.length;m<g;m++){let S=u[m];n.push(S.x,S.y,0),r.push(0,0,1),o.push(S.x,S.y)}for(let m=0,g=x.length;m<g;m++){let S=x[m],T=S[0]+f,_=S[1]+f,v=S[2]+f;i.push(T,_,v),l+=3}}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON(),t=this.parameters.shapes;return q0(t,e)}static fromJSON(e,t){let i=[];for(let n=0,r=e.shapes.length;n<r;n++){let o=t[e.shapes[n]];i.push(o)}return new s(i,e.curveSegments)}};function q0(s,e){if(e.shapes=[],Array.isArray(s))for(let t=0,i=s.length;t<i;t++){let n=s[t];e.shapes.push(n.uuid)}else e.shapes.push(s.uuid);return e}var Wn=class s extends _t{constructor(e=1,t=32,i=16,n=0,r=Math.PI*2,o=0,a=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:i,phiStart:n,phiLength:r,thetaStart:o,thetaLength:a},t=Math.max(3,Math.floor(t)),i=Math.max(2,Math.floor(i));let l=Math.min(o+a,Math.PI),c=0,h=[],f=new D,d=new D,u=[],p=[],x=[],m=[];for(let g=0;g<=i;g++){let S=[],T=g/i,_=o+T*a,v=e*Math.cos(_),E=Math.sqrt(e*e-v*v),A=0;g===0&&o===0?A=.5/t:g===i&&l===Math.PI&&(A=-.5/t);for(let y=0;y<=t;y++){let R=y/t,I=n+R*r;f.x=-E*Math.cos(I),f.y=v,f.z=E*Math.sin(I),p.push(f.x,f.y,f.z),d.copy(f).normalize(),x.push(d.x,d.y,d.z),m.push(R+A,1-T),S.push(c++)}h.push(S)}for(let g=0;g<i;g++)for(let S=0;S<t;S++){let T=h[g][S+1],_=h[g][S],v=h[g+1][S],E=h[g+1][S+1];(g!==0||o>0)&&u.push(T,_,E),(g!==i-1||l<Math.PI)&&u.push(_,v,E)}this.setIndex(u),this.setAttribute("position",new at(p,3)),this.setAttribute("normal",new at(x,3)),this.setAttribute("uv",new at(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}};function ws(s){let e={};for(let t in s){e[t]={};for(let i in s[t]){let n=s[t][i];if(_f(n))n.isRenderTargetTexture?(Ge("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][i]=null):e[t][i]=n.clone();else if(Array.isArray(n))if(_f(n[0])){let r=[];for(let o=0,a=n.length;o<a;o++)r[o]=n[o].clone();e[t][i]=r}else e[t][i]=n.slice();else e[t][i]=n}}return e}function ci(s){let e={};for(let t=0;t<s.length;t++){let i=ws(s[t]);for(let n in i)e[n]=i[n]}return e}function _f(s){return s&&(s.isColor||s.isMatrix3||s.isMatrix4||s.isVector2||s.isVector3||s.isVector4||s.isTexture||s.isQuaternion)}function Y0(s){let e=[];for(let t=0;t<s.length;t++)e.push(s[t].clone());return e}function lu(s){let e=s.getRenderTarget();return e===null?s.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:tt.workingColorSpace}var kt={clone:ws,merge:ci},j0=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Z0=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,ct=class extends ei{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=j0,this.fragmentShader=Z0,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=ws(e.uniforms),this.uniformsGroups=Y0(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let n in this.uniforms){let o=this.uniforms[n].value;o&&o.isTexture?t.uniforms[n]={type:"t",value:o.toJSON(e).uuid}:o&&o.isColor?t.uniforms[n]={type:"c",value:o.getHex()}:o&&o.isVector2?t.uniforms[n]={type:"v2",value:o.toArray()}:o&&o.isVector3?t.uniforms[n]={type:"v3",value:o.toArray()}:o&&o.isVector4?t.uniforms[n]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?t.uniforms[n]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?t.uniforms[n]={type:"m4",value:o.toArray()}:t.uniforms[n]={value:o}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let i={};for(let n in this.extensions)this.extensions[n]===!0&&(i[n]=!0);return Object.keys(i).length>0&&(t.extensions=i),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let i in e.uniforms){let n=e.uniforms[i];switch(this.uniforms[i]={},n.type){case"t":this.uniforms[i].value=t[n.value]||null;break;case"c":this.uniforms[i].value=new Me().setHex(n.value);break;case"v2":this.uniforms[i].value=new ee().fromArray(n.value);break;case"v3":this.uniforms[i].value=new D().fromArray(n.value);break;case"v4":this.uniforms[i].value=new ut().fromArray(n.value);break;case"m3":this.uniforms[i].value=new Qe().fromArray(n.value);break;case"m4":this.uniforms[i].value=new We().fromArray(n.value);break;default:this.uniforms[i].value=n.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(let i in e.extensions)this.extensions[i]=e.extensions[i];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}},dr=class extends ct{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}},Pt=class extends ei{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Me(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Me(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Mr,this.normalScale=new ee(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Qi,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},ai=class extends Pt{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new ee(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return it(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new Me(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new Me(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new Me(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._retroreflectivity=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get retroreflectivity(){return this._retroreflectivity}set retroreflectivity(e){this._retroreflectivity>0!=e>0&&this.version++,this._retroreflectivity=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.retroreflectivity=e.retroreflectivity,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}};var yo=class extends ei{constructor(e){super(),this.isMeshNormalMaterial=!0,this.type="MeshNormalMaterial",this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Mr,this.normalScale=new ee(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.flatShading=!1,this.setValues(e)}copy(e){return super.copy(e),this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.flatShading=e.flatShading,this}},Mo=class extends ei{constructor(e){super(),this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new Me(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Me(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Mr,this.normalScale=new ee(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Qi,this.combine=Tl,this.reflectivity=1,this.envMapIntensity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.envMapIntensity=e.envMapIntensity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},dl=class extends ei{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Zf,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},fl=class extends ei{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function zn(s,e){return!s||s.constructor===e?s:typeof e.BYTES_PER_ELEMENT=="number"?new e(s):Array.prototype.slice.call(s)}function qa(s){return s!==void 0&&s.inTangents!==void 0&&s.outTangents!==void 0}function K0(s){function e(n,r){return s[n]-s[r]}let t=s.length,i=new Array(t);for(let n=0;n!==t;++n)i[n]=n;return i.sort(e),i}function vf(s,e,t){let i=s.length,n=new s.constructor(i);for(let r=0,o=0;o!==i;++r){let a=t[r]*e;for(let l=0;l!==e;++l)n[o++]=s[a+l]}return n}function J0(s,e,t,i){let n=1,r=s[0];for(;r!==void 0&&r[i]===void 0;)r=s[n++];if(r===void 0)return;let o=r[i];if(o!==void 0)if(Array.isArray(o))do o=r[i],o!==void 0&&(e.push(r.time),t.push(...o)),r=s[n++];while(r!==void 0);else if(o.toArray!==void 0)do o=r[i],o!==void 0&&(e.push(r.time),o.toArray(t,t.length)),r=s[n++];while(r!==void 0);else do o=r[i],o!==void 0&&(e.push(r.time),t.push(o)),r=s[n++];while(r!==void 0)}var nn=class{constructor(e,t,i,n){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=n!==void 0?n:new t.constructor(i),this.sampleValues=t,this.valueSize=i,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,i=this._cachedIndex,n=t[i],r=t[i-1];i:{e:{let o;t:{n:if(!(e<n)){for(let a=i+2;;){if(n===void 0){if(e<r)break n;return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}if(i===a)break;if(r=n,n=t[++i],e<n)break e}o=t.length;break t}if(!(e>=r)){let a=t[1];e<a&&(i=2,r=a);for(let l=i-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===l)break;if(n=r,r=t[--i-1],e>=r)break e}o=i,i=0;break t}break i}for(;i<o;){let a=i+o>>>1;e<t[a]?o=a:i=a+1}if(n=t[i],r=t[i-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===void 0)return i=t.length,this._cachedIndex=i,this.copySampleValue_(i-1)}this._cachedIndex=i,this.intervalChanged_(i,r,n)}return this.interpolate_(i,r,e,n)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,i=this.sampleValues,n=this.valueSize,r=e*n;for(let o=0;o!==n;++o)t[o]=i[r+o];return t}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},pl=class extends nn{constructor(e,t,i,n){super(e,t,i,n),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Ph,endingEnd:Ph}}intervalChanged_(e,t,i){let n=this.parameterPositions,r=e-2,o=e+1,a=n[r],l=n[o];if(a===void 0)switch(this.getSettings_().endingStart){case Lh:r=e,a=2*t-i;break;case Ih:r=n.length-2,a=t+n[r]-n[r+1];break;default:r=e,a=i}if(l===void 0)switch(this.getSettings_().endingEnd){case Lh:o=e,l=2*i-t;break;case Ih:o=1,l=i+n[1]-n[0];break;default:o=e-1,l=t}let c=(i-t)*.5,h=this.valueSize;this._weightPrev=c/(t-a),this._weightNext=c/(l-i),this._offsetPrev=r*h,this._offsetNext=o*h}interpolate_(e,t,i,n){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,h=this._offsetPrev,f=this._offsetNext,d=this._weightPrev,u=this._weightNext,p=(i-t)/(n-t),x=p*p,m=x*p,g=-d*m+2*d*x-d*p,S=(1+d)*m+(-1.5-2*d)*x+(-.5+d)*p+1,T=(-1-u)*m+(1.5+u)*x+.5*p,_=u*m-u*x;for(let v=0;v!==a;++v)r[v]=g*o[h+v]+S*o[c+v]+T*o[l+v]+_*o[f+v];return r}},ml=class extends nn{constructor(e,t,i,n){super(e,t,i,n)}interpolate_(e,t,i,n){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,h=(i-t)/(n-t),f=1-h;for(let d=0;d!==a;++d)r[d]=o[c+d]*f+o[l+d]*h;return r}},gl=class extends nn{constructor(e,t,i,n){super(e,t,i,n)}interpolate_(e){return this.copySampleValue_(e-1)}},xl=class extends nn{interpolate_(e,t,i,n){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,h=this.inTangents,f=this.outTangents;if(!h||!f){let p=(i-t)/(n-t),x=1-p;for(let m=0;m!==a;++m)r[m]=o[c+m]*x+o[l+m]*p;return r}let d=a*2,u=e-1;for(let p=0;p!==a;++p){let x=o[c+p],m=o[l+p],g=u*d+p*2,S=f[g],T=f[g+1],_=e*d+p*2,v=h[_],E=h[_+1],A=$0(i,t,S,v,n);r[p]=pp(A,x,T,E,m)}return r}};function pp(s,e,t,i,n){let r=1-s;return r*r*r*e+3*r*r*s*t+3*r*s*s*i+s*s*s*n}function Q0(s,e,t,i,n){let r=1-s;return 3*r*r*(t-e)+6*r*s*(i-t)+3*s*s*(n-i)}function $0(s,e,t,i,n){let r=(s-e)/(n-e);for(let o=0;o<8;o++){let a=pp(r,e,t,i,n)-s;if(Math.abs(a)<1e-10)break;let l=Q0(r,e,t,i,n);if(Math.abs(l)<1e-10)break;r=Math.max(0,Math.min(1,r-a/l))}return r}var gi=class{constructor(e,t,i,n){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=zn(t,this.TimeBufferType),this.values=zn(i,this.ValueBufferType),this.setInterpolation(n||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,i;if(t.toJSON!==this.toJSON)i=t.toJSON(e);else{i={name:e.name,times:zn(e.times,Array),values:zn(e.values,Array)};let n=e.getInterpolation();n!==e.DefaultInterpolation&&(i.interpolation=n),qa(e.settings)&&(i.settings={inTangents:zn(e.settings.inTangents,Array),outTangents:zn(e.settings.outTangents,Array)})}return i.type=e.ValueTypeName,i}InterpolantFactoryMethodDiscrete(e){return new gl(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new ml(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new pl(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new xl(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents),t}setInterpolation(e){let t;switch(e){case ls:t=this.InterpolantFactoryMethodDiscrete;break;case cs:t=this.InterpolantFactoryMethodLinear;break;case Wa:t=this.InterpolantFactoryMethodSmooth;break;case Rh:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){let i="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(i);return Ge("KeyframeTrack:",i),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return ls;case this.InterpolantFactoryMethodLinear:return cs;case this.InterpolantFactoryMethodSmooth:return Wa;case this.InterpolantFactoryMethodBezier:return Rh}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let i=0,n=t.length;i!==n;++i)t[i]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let i=0,n=t.length;i!==n;++i)t[i]*=e;qa(this.settings)&&(yf(this.settings.inTangents,e),yf(this.settings.outTangents,e))}return this}trim(e,t){let i=this.times,n=i.length,r=0,o=n-1;for(;r!==n&&i[r]<e;)++r;for(;o!==-1&&i[o]>t;)--o;if(++o,r!==0||o!==n){r>=o&&(o=Math.max(o,1),r=o-1);let a=this.getValueSize();this.times=i.slice(r,o),this.values=this.values.slice(r*a,o*a)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(Ke("KeyframeTrack: Invalid value size in track.",this),e=!1);let i=this.times,n=this.values,r=i.length;r===0&&(Ke("KeyframeTrack: Track is empty.",this),e=!1);let o=null;for(let a=0;a!==r;a++){let l=i[a];if(typeof l=="number"&&isNaN(l)){Ke("KeyframeTrack: Time is not a valid number.",this,a,l),e=!1;break}if(o!==null&&o>l){Ke("KeyframeTrack: Out of order keys.",this,a,l,o),e=!1;break}o=l}if(n!==void 0&&Om(n))for(let a=0,l=n.length;a!==l;++a){let c=n[a];if(isNaN(c)){Ke("KeyframeTrack: Value is not a valid number.",this,a,c),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),i=this.getValueSize(),n=this.getInterpolation()===Wa,r=e.length-1,o=1;for(let a=1;a<r;++a){let l=!1,c=e[a],h=e[a+1];if(c!==h&&(a!==1||c!==e[0]))if(n)l=!0;else{let f=a*i,d=f-i,u=f+i;for(let p=0;p!==i;++p){let x=t[f+p];if(x!==t[d+p]||x!==t[u+p]){l=!0;break}}}if(l){if(a!==o){e[o]=e[a];let f=a*i,d=o*i;for(let u=0;u!==i;++u)t[d+u]=t[f+u]}++o}}if(r>0){e[o]=e[r];for(let a=r*i,l=o*i,c=0;c!==i;++c)t[l+c]=t[a+c];++o}return o!==e.length?(this.times=e.slice(0,o),this.values=t.slice(0,o*i)):(this.times=e,this.values=t),this}clone(){let e=this.times.slice(),t=this.values.slice(),i=this.constructor,n=new i(this.name,e,t);return n.createInterpolant=this.createInterpolant,qa(this.settings)&&(n.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()}),n}};function yf(s,e){for(let t=0,i=s.length;t!==i;t+=2)s[t]*=e}gi.prototype.ValueTypeName="";gi.prototype.TimeBufferType=Float32Array;gi.prototype.ValueBufferType=Float32Array;gi.prototype.DefaultInterpolation=cs;var Sn=class extends gi{constructor(e,t,i){super(e,t,i)}};Sn.prototype.ValueTypeName="bool";Sn.prototype.ValueBufferType=Array;Sn.prototype.DefaultInterpolation=ls;Sn.prototype.InterpolantFactoryMethodLinear=void 0;Sn.prototype.InterpolantFactoryMethodSmooth=void 0;var bo=class extends gi{constructor(e,t,i,n){super(e,t,i,n)}};bo.prototype.ValueTypeName="color";var wn=class extends gi{constructor(e,t,i,n){super(e,t,i,n)}};wn.prototype.ValueTypeName="number";var _l=class extends nn{constructor(e,t,i,n){super(e,t,i,n)}interpolate_(e,t,i,n){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=(i-t)/(n-t),c=e*a;for(let h=c+a;c!==h;c+=4)Qt.slerpFlat(r,0,o,c-a,o,c,l);return r}},Tn=class extends gi{constructor(e,t,i,n){super(e,t,i,n)}InterpolantFactoryMethodLinear(e){return new _l(this.times,this.values,this.getValueSize(),e)}};Tn.prototype.ValueTypeName="quaternion";Tn.prototype.InterpolantFactoryMethodSmooth=void 0;var En=class extends gi{constructor(e,t,i){super(e,t,i)}};En.prototype.ValueTypeName="string";En.prototype.ValueBufferType=Array;En.prototype.DefaultInterpolation=ls;En.prototype.InterpolantFactoryMethodLinear=void 0;En.prototype.InterpolantFactoryMethodSmooth=void 0;var Xn=class extends gi{constructor(e,t,i,n){super(e,t,i,n)}};Xn.prototype.ValueTypeName="vector";var So=class{constructor(e="",t=-1,i=[],n=jf){this.name=e,this.tracks=i,this.duration=t,this.blendMode=n,this.uuid=Ai(),this.userData={},this.duration<0&&this.resetDuration()}static parse(e){let t=[],i=e.tracks,n=1/(e.fps||1);for(let o=0,a=i.length;o!==a;++o)t.push(tg(i[o]).scale(n));let r=new this(e.name,e.duration,t,e.blendMode);return r.uuid=e.uuid,r.userData=JSON.parse(e.userData||"{}"),r}static toJSON(e){let t=[],i=e.tracks,n={name:e.name,duration:e.duration,tracks:t,uuid:e.uuid,blendMode:e.blendMode,userData:JSON.stringify(e.userData)};for(let r=0,o=i.length;r!==o;++r)t.push(gi.toJSON(i[r]));return n}static CreateFromMorphTargetSequence(e,t,i,n){let r=t.length,o=[];for(let a=0;a<r;a++){let l=[],c=[];l.push((a+r-1)%r,a,(a+1)%r),c.push(0,1,0);let h=K0(l);l=vf(l,1,h),c=vf(c,1,h),!n&&l[0]===0&&(l.push(r),c.push(c[0])),o.push(new wn(".morphTargetInfluences["+t[a].name+"]",l,c).scale(1/i))}return new this(e,-1,o)}static findByName(e,t){let i=e;if(!Array.isArray(e)){let n=e;i=n.geometry&&n.geometry.animations||n.animations}for(let n=0;n<i.length;n++)if(i[n].name===t)return i[n];return null}static CreateClipsFromMorphTargetSequences(e,t,i){let n={},r=/^([\w-]*?)([\d]+)$/;for(let a=0,l=e.length;a<l;a++){let c=e[a],h=c.name.match(r);if(h&&h.length>1){let f=h[1],d=n[f];d||(n[f]=d=[]),d.push(c)}}let o=[];for(let a in n)o.push(this.CreateFromMorphTargetSequence(a,n[a],t,i));return o}resetDuration(){let e=this.tracks,t=0;for(let i=0,n=e.length;i!==n;++i){let r=this.tracks[i];t=Math.max(t,r.times[r.times.length-1])}return this.duration=t,this}trim(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].trim(0,this.duration);return this}validate(){let e=!0;for(let t=0;t<this.tracks.length;t++)e=e&&this.tracks[t].validate();return e}optimize(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].optimize();return this}clone(){let e=[];for(let i=0;i<this.tracks.length;i++)e.push(this.tracks[i].clone());let t=new this.constructor(this.name,this.duration,e,this.blendMode);return t.userData=JSON.parse(JSON.stringify(this.userData)),t}toJSON(){return this.constructor.toJSON(this)}};function eg(s){switch(s.toLowerCase()){case"scalar":case"double":case"float":case"number":case"integer":return wn;case"vector":case"vector2":case"vector3":case"vector4":return Xn;case"color":return bo;case"quaternion":return Tn;case"bool":case"boolean":return Sn;case"string":return En}throw new Error("THREE.KeyframeTrack: Unsupported typeName: "+s)}function tg(s){if(s.type===void 0)throw new Error("THREE.KeyframeTrack: track type undefined, can not parse");let e=eg(s.type);if(s.times===void 0){let i=[],n=[];J0(s.keys,i,n,"value"),s.times=i,s.values=n}let t;return e.parse!==void 0?t=e.parse(s):t=new e(s.name,s.times,s.values,s.interpolation),qa(s.settings)&&(t.settings={inTangents:zn(s.settings.inTangents,Float32Array),outTangents:zn(s.settings.outTangents,Float32Array)}),t}var Ki={enabled:!1,files:{},add:function(s,e){this.enabled!==!1&&(Mf(s)||(this.files[s]=e))},get:function(s){if(this.enabled!==!1&&!Mf(s))return this.files[s]},remove:function(s){delete this.files[s]},clear:function(){this.files={}}};function Mf(s){try{let e=s.slice(s.indexOf(":")+1);return new URL(e).protocol==="blob:"}catch{return!1}}var vl=class{constructor(e,t,i){let n=this,r=!1,o=0,a=0,l,c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=i,this._abortController=null,this.itemStart=function(h){a++,r===!1&&n.onStart!==void 0&&n.onStart(h,o,a),r=!0},this.itemEnd=function(h){o++,n.onProgress!==void 0&&n.onProgress(h,o,a),o===a&&(r=!1,n.onLoad!==void 0&&n.onLoad())},this.itemError=function(h){n.onError!==void 0&&n.onError(h)},this.resolveURL=function(h){return h=h.normalize("NFC"),l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,f){return c.push(h,f),this},this.removeHandler=function(h){let f=c.indexOf(h);return f!==-1&&c.splice(f,2),this},this.getHandler=function(h){for(let f=0,d=c.length;f<d;f+=2){let u=c[f],p=c[f+1];if(u.global&&(u.lastIndex=0),u.test(h))return p}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},mp=new vl,sn=class{constructor(e){this.manager=e!==void 0?e:mp,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,t){let i=this;return new Promise(function(n,r){i.load(e,n,t,r)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}};sn.DEFAULT_MATERIAL_NAME="__DEFAULT";var _n={},Bh=class extends Error{constructor(e,t){super(e),this.response=t}},fr=class extends sn{constructor(e){super(e),this.mimeType="",this.responseType="",this._abortController=new AbortController}load(e,t,i,n){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let r=Ki.get(`file:${e}`);if(r!==void 0){this.manager.itemStart(e),setTimeout(()=>{t&&t(r),this.manager.itemEnd(e)},0);return}if(_n[e]!==void 0){_n[e].push({onLoad:t,onProgress:i,onError:n});return}_n[e]=[],_n[e].push({onLoad:t,onProgress:i,onError:n});let o=new Request(e,{headers:new Headers(this.requestHeader),credentials:this.withCredentials?"include":"same-origin",signal:typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal}),a=this.mimeType,l=this.responseType;fetch(o).then(c=>{if(c.status===200||c.status===0){if(c.status===0&&Ge("FileLoader: HTTP Status 0 received."),typeof ReadableStream>"u"||c.body===void 0||c.body.getReader===void 0)return c;let h=_n[e],f=c.body.getReader(),d=c.headers.get("X-File-Size")||c.headers.get("Content-Length"),u=d?parseInt(d):0,p=u!==0,x=0,m=new ReadableStream({start(g){S();function S(){f.read().then(({done:T,value:_})=>{if(T)g.close();else{x+=_.byteLength;let v=new ProgressEvent("progress",{lengthComputable:p,loaded:x,total:u});for(let E=0,A=h.length;E<A;E++){let y=h[E];y.onProgress&&y.onProgress(v)}g.enqueue(_),S()}},T=>{g.error(T)})}}});return new Response(m)}else throw new Bh(`fetch for "${c.url}" responded with ${c.status}: ${c.statusText}`,c)}).then(c=>{switch(l){case"arraybuffer":return c.arrayBuffer();case"blob":return c.blob();case"document":return c.text().then(h=>new DOMParser().parseFromString(h,a));case"json":return c.json();default:if(a==="")return c.text();{let f=/charset="?([^;"\s]*)"?/i.exec(a),d=f&&f[1]?f[1].toLowerCase():void 0,u=new TextDecoder(d);return c.arrayBuffer().then(p=>u.decode(p))}}}).then(c=>{Ki.add(`file:${e}`,c);let h=_n[e];delete _n[e];for(let f=0,d=h.length;f<d;f++){let u=h[f];u.onLoad&&u.onLoad(c)}}).catch(c=>{let h=_n[e];if(h===void 0)throw this.manager.itemError(e),c;delete _n[e];for(let f=0,d=h.length;f<d;f++){let u=h[f];u.onError&&u.onError(c)}this.manager.itemError(e)}).finally(()=>{this.manager.itemEnd(e)}),this.manager.itemStart(e)}setResponseType(e){return this.responseType=e,this}setMimeType(e){return this.mimeType=e,this}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}};var Ys=new WeakMap,yl=class extends sn{constructor(e){super(e)}load(e,t,i,n){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let r=this,o=Ki.get(`image:${e}`);if(o!==void 0){if(o.complete===!0)r.manager.itemStart(e),setTimeout(function(){t&&t(o),r.manager.itemEnd(e)},0);else{let f=Ys.get(o);f===void 0&&(f=[],Ys.set(o,f)),f.push({onLoad:t,onError:n})}return o}let a=er("img");function l(){h(),t&&t(this);let f=Ys.get(this)||[];for(let d=0;d<f.length;d++){let u=f[d];u.onLoad&&u.onLoad(this)}Ys.delete(this),r.manager.itemEnd(e)}function c(f){h(),n&&n(f),Ki.remove(`image:${e}`);let d=Ys.get(this)||[];for(let u=0;u<d.length;u++){let p=d[u];p.onError&&p.onError(f)}Ys.delete(this),r.manager.itemError(e),r.manager.itemEnd(e)}function h(){a.removeEventListener("load",l,!1),a.removeEventListener("error",c,!1)}return a.addEventListener("load",l,!1),a.addEventListener("error",c,!1),e.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(a.crossOrigin=this.crossOrigin),Ki.add(`image:${e}`,a),r.manager.itemStart(e),a.src=e,a}};var _s=class extends sn{constructor(e){super(e)}load(e,t,i,n){let r=new Ot,o=new yl(this.manager);return o.setCrossOrigin(this.crossOrigin),o.setPath(this.path),o.load(e,function(a){r.image=a,r.needsUpdate=!0,t!==void 0&&t(r)},i,n),r}},qn=class extends Rt{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new Me(e),this.intensity=t}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}},wo=class extends qn{constructor(e,t,i){super(e,i),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Rt.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Me(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}toJSON(e){let t=super.toJSON(e);return t.object.groundColor=this.groundColor.getHex(),t}},Eh=new We,bf=new D,Sf=new D,pr=class{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new ee(512,512),this.mapType=li,this.map=null,this.mapPass=null,this.matrix=new We,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new lr,this._frameExtents=new ee(1,1),this._viewportCount=1,this._viewports=[new ut(0,0,1,1)]}getViewportCount(){return this._viewportCount}getCamera(){return this.camera}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera;bf.setFromMatrixPosition(e.matrixWorld),t.position.copy(bf),Sf.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Sf),t.updateMatrixWorld(),this._updateMatrix(t,this.matrix,this._frustum)}_updateMatrix(e,t,i,n){Eh.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),i.setFromProjectionMatrix(Eh,e.coordinateSystem,e.reversedDepth);let r=this._frameExtents,o=n?n.z/r.x:1,a=n?n.w/r.y:1,l=n?n.x/r.x:0,c=n?n.y/r.y:0;e.coordinateSystem===$s||e.reversedDepth?t.set(.5*o,0,0,.5*o+l,0,.5*a,0,.5*a+c,0,0,1,0,0,0,0,1):t.set(.5*o,0,0,.5*o+l,0,.5*a,0,.5*a+c,0,0,.5,.5,0,0,0,1),t.multiply(Eh)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return e.intensity=this.intensity,e.bias=this.bias,e.normalBias=this.normalBias,e.radius=this.radius,e.blurSamples=this.blurSamples,e.mapSize=this.mapSize.toArray(),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},Va=new D,Ga=new Qt,ji=new D,To=class extends Rt{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new We,this.projectionMatrix=new We,this.projectionMatrixInverse=new We,this.coordinateSystem=Hi,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(Va,Ga,ji),ji.x===1&&ji.y===1&&ji.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Va,Ga,ji.set(1,1,1)).invert()}updateWorldMatrix(e,t,i=!1){super.updateWorldMatrix(e,t,i),this.matrixWorld.decompose(Va,Ga,ji),ji.x===1&&ji.y===1&&ji.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Va,Ga,ji.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},kn=new D,wf=new ee,Tf=new ee,Ut=class extends To{constructor(e=50,t=1,i=.1,n=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=i,this.far=n,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=hs*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(Yr*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return hs*2*Math.atan(Math.tan(Yr*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,i){kn.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(kn.x,kn.y).multiplyScalar(-e/kn.z),kn.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(kn.x,kn.y).multiplyScalar(-e/kn.z)}getViewSize(e,t){return this.getViewBounds(e,wf,Tf),t.subVectors(Tf,wf)}setViewOffset(e,t,i,n,r,o){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=n,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(Yr*.5*this.fov)/this.zoom,i=2*t,n=this.aspect*i,r=-.5*n,o=this.view;if(this.view!==null&&this.view.enabled){let l=o.fullWidth,c=o.fullHeight;r+=o.offsetX*n/l,t-=o.offsetY*i/c,n*=o.width/l,i*=o.height/c}let a=this.filmOffset;a!==0&&(r+=e*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+n,t,t-i,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}},kh=class extends pr{constructor(){super(new Ut(50,1,.5,500)),this.isSpotLightShadow=!0,this.focus=1,this.aspect=1}updateMatrices(e){let t=this.camera,i=hs*2*e.angle*this.focus,n=this.mapSize.width/this.mapSize.height*this.aspect,r=e.distance||t.far;(i!==t.fov||n!==t.aspect||r!==t.far)&&(t.fov=i,t.aspect=n,t.far=r,t.updateProjectionMatrix()),super.updateMatrices(e)}copy(e){return super.copy(e),this.focus=e.focus,this.aspect=e.aspect,this}toJSON(){let e=super.toJSON();return e.focus=this.focus,e.aspect=this.aspect,e}},Eo=class extends qn{constructor(e,t,i=0,n=Math.PI/3,r=0,o=2){super(e,t),this.isSpotLight=!0,this.type="SpotLight",this.position.copy(Rt.DEFAULT_UP),this.updateMatrix(),this.target=new Rt,this.distance=i,this.angle=n,this.penumbra=r,this.decay=o,this.map=null,this.shadow=new kh}get power(){return this.intensity*Math.PI}set power(e){this.intensity=e/Math.PI}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.angle=e.angle,this.penumbra=e.penumbra,this.decay=e.decay,this.target=e.target.clone(),this.map=e.map,this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.distance=this.distance,t.object.angle=this.angle,t.object.decay=this.decay,t.object.penumbra=this.penumbra,t.object.target=this.target.uuid,this.map&&this.map.isTexture&&(t.object.map=this.map.toJSON(e).uuid),t.object.shadow=this.shadow.toJSON(),t}},zh=class extends pr{constructor(){super(new Ut(90,1,.5,500)),this.isPointLightShadow=!0}},vs=class extends qn{constructor(e,t,i=0,n=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=i,this.decay=n,this.shadow=new zh}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.distance=this.distance,t.object.decay=this.decay,t.object.shadow=this.shadow.toJSON(),t}},bi=class extends To{constructor(e=-1,t=1,i=1,n=-1,r=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=i,this.bottom=n,this.near=r,this.far=o,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,i,n,r,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=i,this.view.offsetY=n,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,n=(this.top+this.bottom)/2,r=i-e,o=i+e,a=n+t,l=n-t;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,o=r+c*this.view.width,a-=h*this.view.offsetY,l=a-h*this.view.height}this.projectionMatrix.makeOrthographic(r,o,a,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},Hh=class extends pr{constructor(){super(new bi(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},An=class extends qn{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Rt.DEFAULT_UP),this.updateMatrix(),this.target=new Rt,this.shadow=new Hh}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}},Ao=class extends qn{constructor(e,t){super(e,t),this.isAmbientLight=!0,this.type="AmbientLight"}};var Cn=class{static extractUrlBase(e){let t=e.lastIndexOf("/");return t===-1?"./":e.slice(0,t+1)}static resolveURL(e,t){return typeof e!="string"||e===""?"":(/^https?:\/\//i.test(t)&&/^\//.test(e)&&(t=t.replace(/(^https?:\/\/[^\/]+).*/i,"$1")),/^(https?:)?\/\//i.test(e)||/^data:.*,.*$/i.test(e)||/^blob:.*$/i.test(e)?e:t+e)}};var Ah=new WeakMap,Co=class extends sn{constructor(e){super(e),this.isImageBitmapLoader=!0,typeof createImageBitmap>"u"&&Ge("ImageBitmapLoader: createImageBitmap() not supported."),typeof fetch>"u"&&Ge("ImageBitmapLoader: fetch() not supported."),this.options={premultiplyAlpha:"none"},this._abortController=new AbortController}setOptions(e){return this.options=e,this}load(e,t,i,n){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let r=this,o=Ki.get(`image-bitmap:${e}`);if(o!==void 0){if(r.manager.itemStart(e),o.then){o.then(c=>{Ah.has(o)===!0?(n&&n(Ah.get(o)),r.manager.itemError(e),r.manager.itemEnd(e)):(t&&t(c),r.manager.itemEnd(e))});return}setTimeout(function(){t&&t(o),r.manager.itemEnd(e)},0);return}let a={};a.credentials=this.crossOrigin==="anonymous"?"same-origin":"include",a.headers=this.requestHeader,a.signal=typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal;let l=fetch(e,a).then(function(c){return c.blob()}).then(function(c){return createImageBitmap(c,Object.assign({},r.options,{colorSpaceConversion:"none"}))}).then(function(c){return Ki.add(`image-bitmap:${e}`,c),t&&t(c),r.manager.itemEnd(e),c}).catch(function(c){n&&n(c),Ah.set(l,c),Ki.remove(`image-bitmap:${e}`),r.manager.itemError(e),r.manager.itemEnd(e)});Ki.add(`image-bitmap:${e}`,l),r.manager.itemStart(e)}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}};var js=-90,Zs=1,Ml=class extends Rt{constructor(e,t,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;let n=new Ut(js,Zs,e,t);n.layers=this.layers,this.add(n);let r=new Ut(js,Zs,e,t);r.layers=this.layers,this.add(r);let o=new Ut(js,Zs,e,t);o.layers=this.layers,this.add(o);let a=new Ut(js,Zs,e,t);a.layers=this.layers,this.add(a);let l=new Ut(js,Zs,e,t);l.layers=this.layers,this.add(l);let c=new Ut(js,Zs,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[i,n,r,o,a,l]=t;for(let c of t)this.remove(c);if(e===Hi)i.up.set(0,1,0),i.lookAt(1,0,0),n.up.set(0,1,0),n.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===$s)i.up.set(0,-1,0),i.lookAt(-1,0,0),n.up.set(0,-1,0),n.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:i,activeMipmapLevel:n}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[r,o,a,l,c,h]=this.children,f=e.getRenderTarget(),d=e.getActiveCubeFace(),u=e.getActiveMipmapLevel(),p=e.xr.enabled;e.xr.enabled=!1;let x=i.texture.generateMipmaps;i.texture.generateMipmaps=!1;let m=!1;e.isWebGLRenderer===!0?m=e.state.buffers.depth.getReversed():m=e.reversedDepthBuffer,e.setRenderTarget(i,0,n),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,r),e.setRenderTarget(i,1,n),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(i,2,n),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(i,3,n),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(i,4,n),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),i.texture.generateMipmaps=x,e.setRenderTarget(i,5,n),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,h),e.setRenderTarget(f,d,u),e.xr.enabled=p,i.texture.needsPMREMUpdate=!0}},bl=class extends Ut{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}},Ro=class{constructor(){this._previousTime=0,this._currentTime=0,this._startTime=performance.now(),this._delta=0,this._elapsed=0,this._timescale=1,this._document=null,this._pageVisibilityHandler=null}connect(e){this._document=e,e.hidden!==void 0&&(this._pageVisibilityHandler=ig.bind(this),e.addEventListener("visibilitychange",this._pageVisibilityHandler,!1))}disconnect(){this._pageVisibilityHandler!==null&&(this._document.removeEventListener("visibilitychange",this._pageVisibilityHandler),this._pageVisibilityHandler=null),this._document=null}getDelta(){return this._delta/1e3}getElapsed(){return this._elapsed/1e3}getTimescale(){return this._timescale}setTimescale(e){return this._timescale=e,this}reset(){return this._currentTime=performance.now()-this._startTime,this}dispose(){this.disconnect()}update(e){return this._pageVisibilityHandler!==null&&this._document.hidden===!0?this._delta=0:(this._previousTime=this._currentTime,this._currentTime=(e!==void 0?e:performance.now())-this._startTime,this._delta=(this._currentTime-this._previousTime)*this._timescale,this._elapsed+=this._delta),this}};function ig(){this._document.hidden===!1&&this.reset()}var cu="\\[\\]\\.:\\/",ng=new RegExp("["+cu+"]","g"),hu="[^"+cu+"]",sg="[^"+cu.replace("\\.","")+"]",rg=/((?:WC+[\/:])*)/.source.replace("WC",hu),og=/(WCOD+)?/.source.replace("WCOD",sg),ag=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",hu),lg=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",hu),cg=new RegExp("^"+rg+og+ag+lg+"$"),hg=["material","materials","bones","map"],Vh=class{constructor(e,t,i){let n=i||yt.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,n)}getValue(e,t){this.bind();let i=this._targetGroup.nCachedObjects_,n=this._bindings[i];n!==void 0&&n.getValue(e,t)}setValue(e,t){let i=this._bindings;for(let n=this._targetGroup.nCachedObjects_,r=i.length;n!==r;++n)i[n].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,i=e.length;t!==i;++t)e[t].unbind()}},yt=class s{constructor(e,t,i){this.path=t,this.parsedPath=i||s.parseTrackName(t),this.node=s.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,i){return e&&e.isAnimationObjectGroup?new s.Composite(e,t,i):new s(e,t,i)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace(ng,"")}static parseTrackName(e){let t=cg.exec(e);if(t===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+e);let i={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},n=i.nodeName&&i.nodeName.lastIndexOf(".");if(n!==void 0&&n!==-1){let r=i.nodeName.substring(n+1);hg.indexOf(r)!==-1&&(i.nodeName=i.nodeName.substring(0,n),i.objectName=r)}if(i.propertyName===null||i.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+e);return i}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let i=e.skeleton.getBoneByName(t);if(i!==void 0)return i}if(e.children){let i=function(r){for(let o=0;o<r.length;o++){let a=r[o];if(a.name===t||a.uuid===t)return a;let l=i(a.children);if(l)return l}return null},n=i(e.children);if(n)return n}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let i=this.resolvedProperty;for(let n=0,r=i.length;n!==r;++n)e[t++]=i[n]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let i=this.resolvedProperty;for(let n=0,r=i.length;n!==r;++n)i[n]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let i=this.resolvedProperty;for(let n=0,r=i.length;n!==r;++n)i[n]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let i=this.resolvedProperty;for(let n=0,r=i.length;n!==r;++n)i[n]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,i=t.objectName,n=t.propertyName,r=t.propertyIndex;if(e||(e=s.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){Ge("PropertyBinding: No target node found for track: "+this.path+".");return}if(i){let c=t.objectIndex;switch(i){case"materials":if(!e.material){Ke("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){Ke("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){Ke("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let h=0;h<e.length;h++)if(e[h].name===c){c=h;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){Ke("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){Ke("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[i]===void 0){Ke("PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[i]}if(c!==void 0){if(e[c]===void 0){Ke("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[c]}}let o=e[n];if(o===void 0){let c=t.nodeName;Ke("PropertyBinding: Trying to update property for track: "+c+"."+n+" but it wasn't found.",e);return}let a=this.Versioning.None;this.targetObject=e,e.isMaterial===!0?a=this.Versioning.NeedsUpdate:e.isObject3D===!0&&(a=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(r!==void 0){if(n==="morphTargetInfluences"){if(!e.geometry){Ke("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){Ke("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[r]!==void 0&&(r=e.morphTargetDictionary[r])}l=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=r}else o.fromArray!==void 0&&o.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(l=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=n;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][a]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};yt.Composite=Vh;yt.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};yt.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};yt.prototype.GetterByBindingType=[yt.prototype._getValue_direct,yt.prototype._getValue_array,yt.prototype._getValue_arrayElement,yt.prototype._getValue_toArray];yt.prototype.SetterByBindingTypeAndVersioning=[[yt.prototype._setValue_direct,yt.prototype._setValue_direct_setNeedsUpdate,yt.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[yt.prototype._setValue_array,yt.prototype._setValue_array_setNeedsUpdate,yt.prototype._setValue_array_setMatrixWorldNeedsUpdate],[yt.prototype._setValue_arrayElement,yt.prototype._setValue_arrayElement_setNeedsUpdate,yt.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[yt.prototype._setValue_fromArray,yt.prototype._setValue_fromArray_setNeedsUpdate,yt.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var ib=new Float32Array(1);var Ef=new We,Po=class{constructor(e,t,i=0,n=1/0){this.ray=new $i(e,t),this.near=i,this.far=n,this.camera=null,this.layers=new nr,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,t.projectionMatrix.elements[14]).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):Ke("Raycaster: Unsupported camera type: "+t.type)}setFromXRController(e){return Ef.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(Ef),this}intersectObject(e,t=!0,i=[]){return Gh(e,this,i,t),i.sort(Af),i}intersectObjects(e,t=!0,i=[]){for(let n=0,r=e.length;n<r;n++)Gh(e[n],this,i,t);return i.sort(Af),i}};function Af(s,e){return s.distance-e.distance}function Gh(s,e,t,i){let n=!0;if(s.layers.test(e.layers)&&s.raycast(e,t)===!1&&(n=!1),n===!0&&i===!0){let r=s.children;for(let o=0,a=r.length;o<a;o++)Gh(r[o],e,t,!0)}}var mr=class{constructor(e=1,t=0,i=0){this.radius=e,this.phi=t,this.theta=i}set(e,t,i){return this.radius=e,this.phi=t,this.theta=i,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){return this.phi=it(this.phi,1e-6,Math.PI-1e-6),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,i){return this.radius=Math.sqrt(e*e+t*t+i*i),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,i),this.phi=Math.acos(it(t/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}};var gu=class gu{constructor(e,t,i,n){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,i,n)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let i=0;i<4;i++)this.elements[i]=e[i+t];return this}set(e,t,i,n){let r=this.elements;return r[0]=e,r[2]=t,r[1]=i,r[3]=n,this}};gu.prototype.isMatrix2=!0;var Wh=gu;var Lo=class extends Vi{constructor(e,t=null){super(),this.object=e,this.domElement=t,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(e){this.domElement!==null&&this.disconnect(),this.domElement=e}disconnect(){}dispose(){}update(){}};function uu(s,e,t,i){let n=ug(i);switch(t){case tu:return s*e;case Il:return s*e/n.components*n.byteLength;case Dl:return s*e/n.components*n.byteLength;case $n:return s*e*2/n.components*n.byteLength;case Nl:return s*e*2/n.components*n.byteLength;case iu:return s*e*3/n.components*n.byteLength;case fi:return s*e*4/n.components*n.byteLength;case Ul:return s*e*4/n.components*n.byteLength;case Ho:case Vo:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*8;case Go:case Wo:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*16;case Fl:case kl:return Math.max(s,16)*Math.max(e,8)/4;case Ol:case Bl:return Math.max(s,8)*Math.max(e,8)/2;case zl:case Hl:case Gl:case Wl:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*8;case Vl:case Xo:case Xl:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*16;case ql:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*16;case Yl:return Math.floor((s+4)/5)*Math.floor((e+3)/4)*16;case jl:return Math.floor((s+4)/5)*Math.floor((e+4)/5)*16;case Zl:return Math.floor((s+5)/6)*Math.floor((e+4)/5)*16;case Kl:return Math.floor((s+5)/6)*Math.floor((e+5)/6)*16;case Jl:return Math.floor((s+7)/8)*Math.floor((e+4)/5)*16;case Ql:return Math.floor((s+7)/8)*Math.floor((e+5)/6)*16;case $l:return Math.floor((s+7)/8)*Math.floor((e+7)/8)*16;case ec:return Math.floor((s+9)/10)*Math.floor((e+4)/5)*16;case tc:return Math.floor((s+9)/10)*Math.floor((e+5)/6)*16;case ic:return Math.floor((s+9)/10)*Math.floor((e+7)/8)*16;case nc:return Math.floor((s+9)/10)*Math.floor((e+9)/10)*16;case sc:return Math.floor((s+11)/12)*Math.floor((e+9)/10)*16;case rc:return Math.floor((s+11)/12)*Math.floor((e+11)/12)*16;case oc:case ac:case lc:return Math.ceil(s/4)*Math.ceil(e/4)*16;case cc:case hc:return Math.ceil(s/4)*Math.ceil(e/4)*8;case qo:case uc:return Math.ceil(s/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function ug(s){switch(s){case li:case Jh:return{byteLength:1,components:1};case vr:case Qh:case wt:return{byteLength:2,components:1};case Pl:case Ll:return{byteLength:2,components:4};case Wi:case Rl:case wi:return{byteLength:4,components:1};case $h:case eu:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${s}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"186"}}));typeof window<"u"&&(window.__THREE__?Ge("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="186");function Fp(){let s=null,e=!1,t=null,i=null;function n(r,o){i=s.requestAnimationFrame(n),t(r,o)}return{start:function(){e!==!0&&t!==null&&s!==null&&(i=s.requestAnimationFrame(n),e=!0)},stop:function(){s!==null&&s.cancelAnimationFrame(i),e=!1},setAnimationLoop:function(r){t=r},setContext:function(r){s=r}}}function fg(s){let e=new WeakMap;function t(a,l){let c=a.array,h=a.usage,f=c.byteLength,d=s.createBuffer();s.bindBuffer(l,d),s.bufferData(l,c,h),a.onUploadCallback();let u;if(c instanceof Float32Array)u=s.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)u=s.HALF_FLOAT;else if(c instanceof Uint16Array)a.isFloat16BufferAttribute?u=s.HALF_FLOAT:u=s.UNSIGNED_SHORT;else if(c instanceof Int16Array)u=s.SHORT;else if(c instanceof Uint32Array)u=s.UNSIGNED_INT;else if(c instanceof Int32Array)u=s.INT;else if(c instanceof Int8Array)u=s.BYTE;else if(c instanceof Uint8Array)u=s.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)u=s.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:d,type:u,bytesPerElement:c.BYTES_PER_ELEMENT,version:a.version,size:f}}function i(a,l,c){let h=l.array,f=l.updateRanges;if(s.bindBuffer(c,a),f.length===0)s.bufferSubData(c,0,h);else{f.sort((u,p)=>u.start-p.start);let d=0;for(let u=1;u<f.length;u++){let p=f[d],x=f[u];x.start<=p.start+p.count+1?p.count=Math.max(p.count,x.start+x.count-p.start):(++d,f[d]=x)}f.length=d+1;for(let u=0,p=f.length;u<p;u++){let x=f[u];s.bufferSubData(c,x.start*h.BYTES_PER_ELEMENT,h,x.start,x.count)}l.clearUpdateRanges()}l.onUploadCallback()}function n(a){return a.isInterleavedBufferAttribute&&(a=a.data),e.get(a)}function r(a){a.isInterleavedBufferAttribute&&(a=a.data);let l=e.get(a);l&&(s.deleteBuffer(l.buffer),e.delete(a))}function o(a,l){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){let h=e.get(a);(!h||h.version<a.version)&&e.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}let c=e.get(a);if(c===void 0)e.set(a,t(a,l));else if(c.version<a.version){if(c.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,a,l),c.version=a.version}}return{get:n,remove:r,update:o}}var pg=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,mg=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,gg=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,xg=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,_g=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,vg=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,yg=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Mg=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,bg=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,Sg=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,wg=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Tg=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Eg=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Ag=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Cg=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Rg=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Pg=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Lg=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Ig=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Dg=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Ng=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Ug=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Og=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,Fg=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Bg=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,kg=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,zg=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Hg=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Vg=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Gg=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Wg="gl_FragColor = linearToOutputTexel( gl_FragColor );",Xg=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,qg=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,Yg=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,jg=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Zg=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Kg=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Jg=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Qg=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,$g=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,ex=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,tx=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,ix=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,nx=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,sx=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,rx=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,ox=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureCubeUV( envMap, envMapRotation * retroVec, roughness );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_CUBE_UV
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,ax=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,lx=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,cx=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,hx=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,ux=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,dx=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,fx=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,px=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,mx=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,gx=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,xx=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,_x=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,vx=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,yx=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Mx=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,bx=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Sx=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,wx=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Tx=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Ex=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Ax=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Cx=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Rx=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Px=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,Lx=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Ix=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Dx=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Nx=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Ux=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Ox=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,Fx=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Bx=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,kx=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,zx=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Hx=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Vx=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Gx=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,Wx=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Xx=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,qx=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Yx=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,jx=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Zx=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Kx=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,Jx=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Qx=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,$x=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,e_=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,t_=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,i_=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,n_=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,s_=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,r_=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,o_=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,a_=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,l_=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,c_=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,h_=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,u_=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,d_=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,f_=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,p_=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,m_=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,g_=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,x_=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,__=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,v_=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,y_=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,M_=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,b_=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,S_=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,w_=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,T_=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,E_=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,A_=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,C_=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,R_=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,P_=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,L_=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,I_=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,D_=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,N_=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,U_=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,O_=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,F_=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,B_=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,k_=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,z_=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,H_=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,V_=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,G_=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,W_=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,X_=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,q_=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Y_=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,st={alphahash_fragment:pg,alphahash_pars_fragment:mg,alphamap_fragment:gg,alphamap_pars_fragment:xg,alphatest_fragment:_g,alphatest_pars_fragment:vg,aomap_fragment:yg,aomap_pars_fragment:Mg,batching_pars_vertex:bg,batching_vertex:Sg,begin_vertex:wg,beginnormal_vertex:Tg,bsdfs:Eg,iridescence_fragment:Ag,bumpmap_pars_fragment:Cg,clipping_planes_fragment:Rg,clipping_planes_pars_fragment:Pg,clipping_planes_pars_vertex:Lg,clipping_planes_vertex:Ig,color_fragment:Dg,color_pars_fragment:Ng,color_pars_vertex:Ug,color_vertex:Og,common:Fg,cube_uv_reflection_fragment:Bg,defaultnormal_vertex:kg,displacementmap_pars_vertex:zg,displacementmap_vertex:Hg,emissivemap_fragment:Vg,emissivemap_pars_fragment:Gg,colorspace_fragment:Wg,colorspace_pars_fragment:Xg,envmap_fragment:qg,envmap_common_pars_fragment:Yg,envmap_pars_fragment:jg,envmap_pars_vertex:Zg,envmap_physical_pars_fragment:ox,envmap_vertex:Kg,fog_vertex:Jg,fog_pars_vertex:Qg,fog_fragment:$g,fog_pars_fragment:ex,gradientmap_pars_fragment:tx,lightmap_pars_fragment:ix,lights_lambert_fragment:nx,lights_lambert_pars_fragment:sx,lights_pars_begin:rx,lights_toon_fragment:ax,lights_toon_pars_fragment:lx,lights_phong_fragment:cx,lights_phong_pars_fragment:hx,lights_physical_fragment:ux,lights_physical_pars_fragment:dx,lights_fragment_begin:fx,lights_fragment_maps:px,lights_fragment_end:mx,lightprobes_pars_fragment:gx,logdepthbuf_fragment:xx,logdepthbuf_pars_fragment:_x,logdepthbuf_pars_vertex:vx,logdepthbuf_vertex:yx,map_fragment:Mx,map_pars_fragment:bx,map_particle_fragment:Sx,map_particle_pars_fragment:wx,metalnessmap_fragment:Tx,metalnessmap_pars_fragment:Ex,morphinstance_vertex:Ax,morphcolor_vertex:Cx,morphnormal_vertex:Rx,morphtarget_pars_vertex:Px,morphtarget_vertex:Lx,normal_fragment_begin:Ix,normal_fragment_maps:Dx,normal_pars_fragment:Nx,normal_pars_vertex:Ux,normal_vertex:Ox,normalmap_pars_fragment:Fx,clearcoat_normal_fragment_begin:Bx,clearcoat_normal_fragment_maps:kx,clearcoat_pars_fragment:zx,iridescence_pars_fragment:Hx,opaque_fragment:Vx,packing:Gx,premultiplied_alpha_fragment:Wx,project_vertex:Xx,dithering_fragment:qx,dithering_pars_fragment:Yx,roughnessmap_fragment:jx,roughnessmap_pars_fragment:Zx,shadowmap_pars_fragment:Kx,shadowmap_pars_vertex:Jx,shadowmap_vertex:Qx,shadowmask_pars_fragment:$x,skinbase_vertex:e_,skinning_pars_vertex:t_,skinning_vertex:i_,skinnormal_vertex:n_,specularmap_fragment:s_,specularmap_pars_fragment:r_,tonemapping_fragment:o_,tonemapping_pars_fragment:a_,transmission_fragment:l_,transmission_pars_fragment:c_,uv_pars_fragment:h_,uv_pars_vertex:u_,uv_vertex:d_,worldpos_vertex:f_,background_vert:p_,background_frag:m_,backgroundCube_vert:g_,backgroundCube_frag:x_,cube_vert:__,cube_frag:v_,depth_vert:y_,depth_frag:M_,distance_vert:b_,distance_frag:S_,equirect_vert:w_,equirect_frag:T_,linedashed_vert:E_,linedashed_frag:A_,meshbasic_vert:C_,meshbasic_frag:R_,meshlambert_vert:P_,meshlambert_frag:L_,meshmatcap_vert:I_,meshmatcap_frag:D_,meshnormal_vert:N_,meshnormal_frag:U_,meshphong_vert:O_,meshphong_frag:F_,meshphysical_vert:B_,meshphysical_frag:k_,meshtoon_vert:z_,meshtoon_frag:H_,points_vert:V_,points_frag:G_,shadow_vert:W_,shadow_frag:X_,sprite_vert:q_,sprite_frag:Y_},be={common:{diffuse:{value:new Me(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Qe},alphaMap:{value:null},alphaMapTransform:{value:new Qe},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Qe}},envmap:{envMap:{value:null},envMapRotation:{value:new Qe},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Qe}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Qe}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Qe},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Qe},normalScale:{value:new ee(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Qe},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Qe}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Qe}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Qe}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Me(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new D},probesMax:{value:new D},probesResolution:{value:new D}},points:{diffuse:{value:new Me(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Qe},alphaTest:{value:0},uvTransform:{value:new Qe}},sprite:{diffuse:{value:new Me(16777215)},opacity:{value:1},center:{value:new ee(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Qe},alphaMap:{value:null},alphaMapTransform:{value:new Qe},alphaTest:{value:0}}},ln={basic:{uniforms:ci([be.common,be.specularmap,be.envmap,be.aomap,be.lightmap,be.fog]),vertexShader:st.meshbasic_vert,fragmentShader:st.meshbasic_frag},lambert:{uniforms:ci([be.common,be.specularmap,be.envmap,be.aomap,be.lightmap,be.emissivemap,be.bumpmap,be.normalmap,be.displacementmap,be.fog,be.lights,{emissive:{value:new Me(0)},envMapIntensity:{value:1}}]),vertexShader:st.meshlambert_vert,fragmentShader:st.meshlambert_frag},phong:{uniforms:ci([be.common,be.specularmap,be.envmap,be.aomap,be.lightmap,be.emissivemap,be.bumpmap,be.normalmap,be.displacementmap,be.fog,be.lights,{emissive:{value:new Me(0)},specular:{value:new Me(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:st.meshphong_vert,fragmentShader:st.meshphong_frag},standard:{uniforms:ci([be.common,be.envmap,be.aomap,be.lightmap,be.emissivemap,be.bumpmap,be.normalmap,be.displacementmap,be.roughnessmap,be.metalnessmap,be.fog,be.lights,{emissive:{value:new Me(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:st.meshphysical_vert,fragmentShader:st.meshphysical_frag},toon:{uniforms:ci([be.common,be.aomap,be.lightmap,be.emissivemap,be.bumpmap,be.normalmap,be.displacementmap,be.gradientmap,be.fog,be.lights,{emissive:{value:new Me(0)}}]),vertexShader:st.meshtoon_vert,fragmentShader:st.meshtoon_frag},matcap:{uniforms:ci([be.common,be.bumpmap,be.normalmap,be.displacementmap,be.fog,{matcap:{value:null}}]),vertexShader:st.meshmatcap_vert,fragmentShader:st.meshmatcap_frag},points:{uniforms:ci([be.points,be.fog]),vertexShader:st.points_vert,fragmentShader:st.points_frag},dashed:{uniforms:ci([be.common,be.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:st.linedashed_vert,fragmentShader:st.linedashed_frag},depth:{uniforms:ci([be.common,be.displacementmap]),vertexShader:st.depth_vert,fragmentShader:st.depth_frag},normal:{uniforms:ci([be.common,be.bumpmap,be.normalmap,be.displacementmap,{opacity:{value:1}}]),vertexShader:st.meshnormal_vert,fragmentShader:st.meshnormal_frag},sprite:{uniforms:ci([be.sprite,be.fog]),vertexShader:st.sprite_vert,fragmentShader:st.sprite_frag},background:{uniforms:{uvTransform:{value:new Qe},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:st.background_vert,fragmentShader:st.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Qe}},vertexShader:st.backgroundCube_vert,fragmentShader:st.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:st.cube_vert,fragmentShader:st.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:st.equirect_vert,fragmentShader:st.equirect_frag},distance:{uniforms:ci([be.common,be.displacementmap,{referencePosition:{value:new D},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:st.distance_vert,fragmentShader:st.distance_frag},shadow:{uniforms:ci([be.lights,be.fog,{color:{value:new Me(0)},opacity:{value:1}}]),vertexShader:st.shadow_vert,fragmentShader:st.shadow_frag}};ln.physical={uniforms:ci([ln.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Qe},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Qe},clearcoatNormalScale:{value:new ee(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Qe},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Qe},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Qe},sheen:{value:0},sheenColor:{value:new Me(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Qe},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Qe},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Qe},transmissionSamplerSize:{value:new ee},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Qe},attenuationDistance:{value:0},attenuationColor:{value:new Me(0)},specularColor:{value:new Me(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Qe},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Qe},anisotropyVector:{value:new ee},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Qe}}]),vertexShader:st.meshphysical_vert,fragmentShader:st.meshphysical_frag};var pc={r:0,b:0,g:0},j_=new We,Bp=new Qe;Bp.set(-1,0,0,0,1,0,0,0,1);function Z_(s,e,t,i,n,r){let o=new Me(0),a=n===!0?0:1,l,c,h=null,f=0,d=null;function u(S){let T=S.isScene===!0?S.background:null;if(T&&T.isTexture){let _=S.backgroundBlurriness>0;T=e.get(T,_)}return T}function p(S){let T=!1,_=u(S);_===null?m(o,a):_&&_.isColor&&(m(_,1),T=!0);let v=s.xr.getEnvironmentBlendMode();v==="additive"?t.buffers.color.setClear(0,0,0,1,r):v==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,r),(s.autoClear||T)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),s.clear(s.autoClearColor,s.autoClearDepth,s.autoClearStencil))}function x(S,T){let _=u(T);_&&(_.isCubeTexture||_.mapping===zo)?(c===void 0&&(c=new De(new qt(1,1,1),new ct({name:"BackgroundCubeMaterial",uniforms:ws(ln.backgroundCube.uniforms),vertexShader:ln.backgroundCube.vertexShader,fragmentShader:ln.backgroundCube.fragmentShader,side:ti,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(v,E,A){this.matrixWorld.copyPosition(A.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(c)),c.material.uniforms.envMap.value=_,c.material.uniforms.backgroundBlurriness.value=T.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=T.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(j_.makeRotationFromEuler(T.backgroundRotation)).transpose(),_.isCubeTexture&&_.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(Bp),c.material.toneMapped=tt.getTransfer(_.colorSpace)!==ht,(h!==_||f!==_.version||d!==s.toneMapping)&&(c.material.needsUpdate=!0,h=_,f=_.version,d=s.toneMapping),c.layers.enableAll(),S.unshift(c,c.geometry,c.material,0,0,null)):_&&_.isTexture&&(l===void 0&&(l=new De(new Gn(2,2),new ct({name:"BackgroundMaterial",uniforms:ws(ln.background.uniforms),vertexShader:ln.background.vertexShader,fragmentShader:ln.background.fragmentShader,side:rn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(l)),l.material.uniforms.t2D.value=_,l.material.uniforms.backgroundIntensity.value=T.backgroundIntensity,l.material.toneMapped=tt.getTransfer(_.colorSpace)!==ht,_.matrixAutoUpdate===!0&&_.updateMatrix(),l.material.uniforms.uvTransform.value.copy(_.matrix),(h!==_||f!==_.version||d!==s.toneMapping)&&(l.material.needsUpdate=!0,h=_,f=_.version,d=s.toneMapping),l.layers.enableAll(),S.unshift(l,l.geometry,l.material,0,0,null))}function m(S,T){S.getRGB(pc,lu(s)),t.buffers.color.setClear(pc.r,pc.g,pc.b,T,r)}function g(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return o},setClearColor:function(S,T=1){o.set(S),a=T,m(o,a)},getClearAlpha:function(){return a},setClearAlpha:function(S){a=S,m(o,a)},render:p,addToRenderList:x,dispose:g}}function K_(s,e){let t=s.getParameter(s.MAX_VERTEX_ATTRIBS),i={},n=d(null),r=n,o=!1;function a(L,b,w,P,U){let F=!1,O=f(L,P,w,b);r!==O&&(r=O,c(r.object)),F=u(L,P,w,U),F&&p(L,P,w,U),U!==null&&e.update(U,s.ELEMENT_ARRAY_BUFFER),(F||o)&&(o=!1,_(L,b,w,P),U!==null&&s.bindBuffer(s.ELEMENT_ARRAY_BUFFER,e.get(U).buffer))}function l(){return s.createVertexArray()}function c(L){return s.bindVertexArray(L)}function h(L){return s.deleteVertexArray(L)}function f(L,b,w,P){let U=P.wireframe===!0,F=i[b.id];F===void 0&&(F={},i[b.id]=F);let O=L.isInstancedMesh===!0?L.id:0,z=F[O];z===void 0&&(z={},F[O]=z);let k=z[w.id];k===void 0&&(k={},z[w.id]=k);let G=k[U];return G===void 0&&(G=d(l()),k[U]=G),G}function d(L){let b=[],w=[],P=[];for(let U=0;U<t;U++)b[U]=0,w[U]=0,P[U]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:b,enabledAttributes:w,attributeDivisors:P,object:L,attributes:{},index:null}}function u(L,b,w,P){let U=r.attributes,F=b.attributes,O=0,z=w.getAttributes();for(let k in z)if(z[k].location>=0){let Y=U[k],he=F[k];if(he===void 0&&(k==="instanceMatrix"&&L.instanceMatrix&&(he=L.instanceMatrix),k==="instanceColor"&&L.instanceColor&&(he=L.instanceColor)),Y===void 0||Y.attribute!==he||he&&Y.data!==he.data)return!0;O++}return r.attributesNum!==O||r.index!==P}function p(L,b,w,P){let U={},F=b.attributes,O=0,z=w.getAttributes();for(let k in z)if(z[k].location>=0){let Y=F[k];Y===void 0&&(k==="instanceMatrix"&&L.instanceMatrix&&(Y=L.instanceMatrix),k==="instanceColor"&&L.instanceColor&&(Y=L.instanceColor));let he={};he.attribute=Y,Y&&Y.data&&(he.data=Y.data),U[k]=he,O++}r.attributes=U,r.attributesNum=O,r.index=P}function x(){let L=r.newAttributes;for(let b=0,w=L.length;b<w;b++)L[b]=0}function m(L){g(L,0)}function g(L,b){let w=r.newAttributes,P=r.enabledAttributes,U=r.attributeDivisors;w[L]=1,P[L]===0&&(s.enableVertexAttribArray(L),P[L]=1),U[L]!==b&&(s.vertexAttribDivisor(L,b),U[L]=b)}function S(){let L=r.newAttributes,b=r.enabledAttributes;for(let w=0,P=b.length;w<P;w++)b[w]!==L[w]&&(s.disableVertexAttribArray(w),b[w]=0)}function T(L,b,w,P,U,F,O){O===!0?s.vertexAttribIPointer(L,b,w,U,F):s.vertexAttribPointer(L,b,w,P,U,F)}function _(L,b,w,P){x();let U=P.attributes,F=w.getAttributes(),O=b.defaultAttributeValues;for(let z in F){let k=F[z];if(k.location>=0){let G=U[z];if(G===void 0&&(z==="instanceMatrix"&&L.instanceMatrix&&(G=L.instanceMatrix),z==="instanceColor"&&L.instanceColor&&(G=L.instanceColor)),G!==void 0){let Y=G.normalized,he=G.itemSize,pe=e.get(G);if(pe===void 0)continue;let Te=pe.buffer,Ee=pe.type,Re=pe.bytesPerElement,j=Ee===s.INT||Ee===s.UNSIGNED_INT||G.gpuType===Rl;if(G.isInterleavedBufferAttribute){let J=G.data,fe=J.stride,Le=G.offset;if(J.isInstancedInterleavedBuffer){for(let _e=0;_e<k.locationSize;_e++)g(k.location+_e,J.meshPerAttribute);L.isInstancedMesh!==!0&&P._maxInstanceCount===void 0&&(P._maxInstanceCount=J.meshPerAttribute*J.count)}else for(let _e=0;_e<k.locationSize;_e++)m(k.location+_e);s.bindBuffer(s.ARRAY_BUFFER,Te);for(let _e=0;_e<k.locationSize;_e++)T(k.location+_e,he/k.locationSize,Ee,Y,fe*Re,(Le+he/k.locationSize*_e)*Re,j)}else{if(G.isInstancedBufferAttribute){for(let J=0;J<k.locationSize;J++)g(k.location+J,G.meshPerAttribute);L.isInstancedMesh!==!0&&P._maxInstanceCount===void 0&&(P._maxInstanceCount=G.meshPerAttribute*G.count)}else for(let J=0;J<k.locationSize;J++)m(k.location+J);s.bindBuffer(s.ARRAY_BUFFER,Te);for(let J=0;J<k.locationSize;J++)T(k.location+J,he/k.locationSize,Ee,Y,he*Re,he/k.locationSize*J*Re,j)}}else if(O!==void 0){let Y=O[z];if(Y!==void 0)switch(Y.length){case 2:s.vertexAttrib2fv(k.location,Y);break;case 3:s.vertexAttrib3fv(k.location,Y);break;case 4:s.vertexAttrib4fv(k.location,Y);break;default:s.vertexAttrib1fv(k.location,Y)}}}}S()}function v(){R();for(let L in i){let b=i[L];for(let w in b){let P=b[w];for(let U in P){let F=P[U];for(let O in F)h(F[O].object),delete F[O];delete P[U]}}delete i[L]}}function E(L){if(i[L.id]===void 0)return;let b=i[L.id];for(let w in b){let P=b[w];for(let U in P){let F=P[U];for(let O in F)h(F[O].object),delete F[O];delete P[U]}}delete i[L.id]}function A(L){for(let b in i){let w=i[b];for(let P in w){let U=w[P];if(U[L.id]===void 0)continue;let F=U[L.id];for(let O in F)h(F[O].object),delete F[O];delete U[L.id]}}}function y(L){for(let b in i){let w=i[b],P=L.isInstancedMesh===!0?L.id:0,U=w[P];if(U!==void 0){for(let F in U){let O=U[F];for(let z in O)h(O[z].object),delete O[z];delete U[F]}delete w[P],Object.keys(w).length===0&&delete i[b]}}}function R(){I(),o=!0,r!==n&&(r=n,c(r.object))}function I(){n.geometry=null,n.program=null,n.wireframe=!1}return{setup:a,reset:R,resetDefaultState:I,dispose:v,releaseStatesOfGeometry:E,releaseStatesOfObject:y,releaseStatesOfProgram:A,initAttributes:x,enableAttribute:m,disableUnusedAttributes:S}}function J_(s,e,t){let i;function n(l){i=l}function r(l,c){s.drawArrays(i,l,c),t.update(c,i,1)}function o(l,c,h){h!==0&&(s.drawArraysInstanced(i,l,c,h),t.update(c,i,h))}function a(l,c,h){if(h===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,l,0,c,0,h);let d=0;for(let u=0;u<h;u++)d+=c[u];t.update(d,i,1)}this.setMode=n,this.render=r,this.renderInstances=o,this.renderMultiDraw=a}function Q_(s,e,t,i){let n;function r(){if(n!==void 0)return n;if(e.has("EXT_texture_filter_anisotropic")===!0){let A=e.get("EXT_texture_filter_anisotropic");n=s.getParameter(A.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else n=0;return n}function o(A){return!(A!==fi&&i.convert(A)!==s.getParameter(s.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(A){let y=A===wt&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(A!==li&&A!==wi&&!y&&i.convert(A)!==s.getParameter(s.IMPLEMENTATION_COLOR_READ_TYPE))}function l(A){if(A==="highp"){if(s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.HIGH_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.HIGH_FLOAT).precision>0)return"highp";A="mediump"}return A==="mediump"&&s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.MEDIUM_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp",h=l(c);h!==c&&(Ge("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);let f=t.logarithmicDepthBuffer===!0,d=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control");t.reversedDepthBuffer===!0&&d===!1&&Ge("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let u=s.getParameter(s.MAX_TEXTURE_IMAGE_UNITS),p=s.getParameter(s.MAX_VERTEX_TEXTURE_IMAGE_UNITS),x=s.getParameter(s.MAX_TEXTURE_SIZE),m=s.getParameter(s.MAX_CUBE_MAP_TEXTURE_SIZE),g=s.getParameter(s.MAX_VERTEX_ATTRIBS),S=s.getParameter(s.MAX_VERTEX_UNIFORM_VECTORS),T=s.getParameter(s.MAX_VARYING_VECTORS),_=s.getParameter(s.MAX_FRAGMENT_UNIFORM_VECTORS),v=s.getParameter(s.MAX_SAMPLES),E=s.getParameter(s.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:c,logarithmicDepthBuffer:f,reversedDepthBuffer:d,maxTextures:u,maxVertexTextures:p,maxTextureSize:x,maxCubemapSize:m,maxAttributes:g,maxVertexUniforms:S,maxVaryings:T,maxFragmentUniforms:_,maxSamples:v,samples:E}}function $_(s){let e=this,t=null,i=0,n=!1,r=!1,o=new $t,a=new Qe,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(f,d){let u=f.length!==0||d||i!==0||n;return n=d,i=f.length,u},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(f,d){t=h(f,d,0)},this.setState=function(f,d,u){let p=f.clippingPlanes,x=f.clipIntersection,m=f.clipShadows,g=s.get(f);if(!n||p===null||p.length===0||r&&!m)r?h(null):c();else{let S=r?0:i,T=S*4,_=g.clippingState||null;l.value=_,_=h(p,d,T,u);for(let v=0;v!==T;++v)_[v]=t[v];g.clippingState=_,this.numIntersection=x?this.numPlanes:0,this.numPlanes+=S}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=i>0),e.numPlanes=i,e.numIntersection=0}function h(f,d,u,p){let x=f!==null?f.length:0,m=null;if(x!==0){if(m=l.value,p!==!0||m===null){let g=u+x*4,S=d.matrixWorldInverse;a.getNormalMatrix(S),(m===null||m.length<g)&&(m=new Float32Array(g));for(let T=0,_=u;T!==x;++T,_+=4)o.copy(f[T]).applyMatrix4(S,a),o.normal.toArray(m,_),m[_+3]=o.constant}l.value=m,l.needsUpdate=!0}return e.numPlanes=x,e.numIntersection=0,m}}var Sr=4,ev=6,tv=20,iv=256,Zo=new bi,gp=new Me,xu=null,_u=0,vu=0,yu=!1,nv=new D,Ts=new D,Tr=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,i=.1,n=100,r={}){let{size:o=256,position:a=nv}=r;xu=this._renderer.getRenderTarget(),_u=this._renderer.getActiveCubeFace(),vu=this._renderer.getActiveMipmapLevel(),yu=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(o);let l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,i,n,l,a),t>0&&this._blur(l,0,0,t),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=vp(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=_p(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(xu,_u,vu),this._renderer.xr.enabled=yu,e.scissorTest=!1,br(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===Jn||e.mapping===bs?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),xu=this._renderer.getRenderTarget(),_u=this._renderer.getActiveCubeFace(),vu=this._renderer.getActiveMipmapLevel(),yu=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let i=t||this._allocateTargets();return this._textureToCubeUV(e,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,i={magFilter:It,minFilter:It,generateMipmaps:!1,type:wt,format:fi,colorSpace:di,depthBuffer:!1},n=xp(e,t,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=xp(e,t,i);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods}=sv(r)),this._blurMaterial=ov(r,e,t),this._ggxMaterial=rv(r,e,t)}return n}_compileMaterial(e){let t=new De(new _t,e);this._renderer.compile(t,Zo)}_sceneToCubeUV(e,t,i,n,r){let l=new Ut(90,1,t,i),c=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],f=this._renderer,d=f.autoClear,u=f.toneMapping;f.getClearColor(gp),f.toneMapping=Si,f.autoClear=!1,f.state.buffers.depth.getReversed()&&(f.setRenderTarget(n),f.clearDepth(),f.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new De(new qt,new St({name:"PMREM.Background",side:ti,depthWrite:!1,depthTest:!1})));let x=this._backgroundBox,m=x.material,g=!1,S=e.background;S?S.isColor&&(m.color.copy(S),e.background=null,g=!0):(m.color.copy(gp),g=!0);for(let T=0;T<6;T++){let _=T%3;_===0?(l.up.set(0,c[T],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x+h[T],r.y,r.z)):_===1?(l.up.set(0,0,c[T]),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y+h[T],r.z)):(l.up.set(0,c[T],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y,r.z+h[T]));let v=this._cubeSize;br(n,_*v,T>2?v:0,v,v),f.setRenderTarget(n),g&&f.render(x,l),f.render(e,l)}f.toneMapping=u,f.autoClear=d,e.background=S}_textureToCubeUV(e,t){let i=this._renderer,n=e.mapping===Jn||e.mapping===bs;n?(this._cubemapMaterial===null&&(this._cubemapMaterial=vp()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=_p());let r=n?this._cubemapMaterial:this._equirectMaterial,o=this._lodMeshes[0];o.material=r;let a=r.uniforms;a.envMap.value=e;let l=this._cubeSize;br(t,0,0,3*l,2*l),i.setRenderTarget(t),i.render(o,Zo)}_applyPMREM(e){let t=this._renderer,i=t.autoClear;t.autoClear=!1;let n=this._lodMeshes.length;for(let r=1;r<n;r++)this._applyGGXFilter(e,r-1,r);t.autoClear=i}_applyGGXFilter(e,t,i){let n=this._renderer,r=this._pingPongRenderTarget,o=this._ggxMaterial,a=this._lodMeshes[i];a.material=o;let l=o.uniforms,c=i/(this._lodMeshes.length-1),h=t/(this._lodMeshes.length-1),f=Math.sqrt(c*c-h*h),d=c*1.25,u=f*d,{_lodMax:p}=this,x=this._sizeLods[i],m=3*x*(i>p-Sr?i-p+Sr:0),g=4*(this._cubeSize-x);l.envMap.value=e.texture,l.roughness.value=u,l.mipInt.value=p-t,br(r,m,g,3*x,2*x),n.setRenderTarget(r),n.render(a,Zo),l.envMap.value=r.texture,l.roughness.value=0,l.mipInt.value=p-i,br(e,m,g,3*x,2*x),n.setRenderTarget(e),n.render(a,Zo)}_blur(e,t,i,n){let r=this._pingPongRenderTarget,o=Math.min(n,Math.PI)/Math.SQRT2;this._blurPass(e,r,t,i,o),this._blurPass(r,e,i,i,o)}_blurPass(e,t,i,n,r){let o=this._renderer,a=this._blurMaterial,l=this._lodMeshes[n];l.material=a;let c=a.uniforms;c.envMap.value=e.texture,c.sigma.value=r,c.mipInt.value=this._lodMax-i;let h=this._sizeLods[n],f=3*h*(n>this._lodMax-Sr?n-this._lodMax+Sr:0),d=4*(this._cubeSize-h);br(t,f,d,3*h,2*h),o.setRenderTarget(t),o.render(l,Zo)}};function sv(s){let e=[],t=[],i=s,n=s-Sr+1+ev;for(let r=0;r<n;r++){let o=Math.pow(2,i);e.push(o);let a=1/(o-2),l=-a,c=1+a,h=[l,l,c,l,c,c,l,l,c,c,l,c],f=6,d=6,u=3,p=new Float32Array(u*d*f),x=new Float32Array(u*d*f);for(let g=0;g<f;g++){let S=g%3*2/3-1,T=g>2?0:-1,_=[S,T,0,S+2/3,T,0,S+2/3,T+1,0,S,T,0,S+2/3,T+1,0,S,T+1,0];p.set(_,u*d*g);for(let v=0;v<d;v++){let E=h[v*2]*2-1,A=h[v*2+1]*2-1;g===0?Ts.set(1,A,E):g===1?Ts.set(-E,1,-A):g===2?Ts.set(-E,A,1):g===3?Ts.set(-1,A,-E):g===4?Ts.set(-E,-1,A):Ts.set(E,A,-1),Ts.toArray(x,(g*d+v)*u)}}let m=new _t;m.setAttribute("position",new Ct(p,u)),m.setAttribute("outputDirection",new Ct(x,u)),t.push(new De(m,null)),i>Sr&&i--}return{lodMeshes:t,sizeLods:e}}function xp(s,e,t){let i=new dt(s,e,t);return i.texture.mapping=zo,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function br(s,e,t,i,n){s.viewport.set(e,t,i,n),s.scissor.set(e,t,i,n)}function rv(s,e,t){return new ct({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:iv,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${s}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:_c(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:Bt,depthTest:!1,depthWrite:!1})}function ov(s,e,t){return new ct({name:"SphericalGaussianBlur",defines:{SAMPLES:tv,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${s}.0`},uniforms:{envMap:{value:null},sigma:{value:0},mipInt:{value:0}},vertexShader:_c(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float sigma;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359
			#define GOLDEN_ANGLE 2.39996322973

			void main() {

				if ( sigma == 0.0 ) {

					gl_FragColor = vec4( bilinearCubeUV( envMap, vOutputDirection, mipInt ), 1.0 );
					return;

				}

				vec3 outputDirection = normalize( vOutputDirection );

				vec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
				vec3 tangent = normalize( cross( up, outputDirection ) );
				vec3 bitangent = cross( outputDirection, tangent );

				// Truncate the kernel at three standard deviations or at the antipode.
				float thetaMax = min( 3.0 * sigma, PI );
				float truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );

				vec3 accumColor = vec3( 0.0 );
				float accumWeight = 0.0;

				for ( int i = 0; i < SAMPLES; i ++ ) {

					// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.
					float stratum = ( float( i ) + 0.5 ) / float( SAMPLES );
					float theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );
					float phi = float( i ) * GOLDEN_ANGLE;

					vec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;
					vec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;

					// Correct the planar sample density to solid angle.
					float weight = sin( theta ) / theta;

					accumColor += weight * bilinearCubeUV( envMap, sampleDirection, mipInt );
					accumWeight += weight;

				}

				gl_FragColor = vec4( accumColor / accumWeight, 1.0 );

			}
		`,blending:Bt,depthTest:!1,depthWrite:!1})}function _p(){return new ct({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:_c(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Bt,depthTest:!1,depthWrite:!1})}function vp(){return new ct({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:_c(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Bt,depthTest:!1,depthWrite:!1})}function _c(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 outputDirection;

		varying vec3 vOutputDirection;

		void main() {

			vOutputDirection = outputDirection;
			gl_Position = vec4( position, 1.0 );

		}
	`}var gc=class extends dt{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let i={width:e,height:e,depth:1},n=[i,i,i,i,i,i];this.texture=new lo(n),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let i={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},n=new qt(5,5,5),r=new ct({name:"CubemapFromEquirect",uniforms:ws(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:ti,blending:Bt});r.uniforms.tEquirect.value=t;let o=new De(n,r),a=t.minFilter;return t.minFilter===Gi&&(t.minFilter=It),new Ml(1,10,this).update(e,o),t.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(e,t=!0,i=!0,n=!0){let r=e.getRenderTarget();for(let o=0;o<6;o++)e.setRenderTarget(this,o),e.clear(t,i,n);e.setRenderTarget(r)}};function av(s){let e=new WeakMap,t=new WeakMap,i=null;function n(d,u=!1){return d==null?null:u?o(d):r(d)}function r(d){if(d&&d.isTexture){let u=d.mapping;if(u===El||u===Al)if(e.has(d)){let p=e.get(d).texture;return a(p,d.mapping)}else{let p=d.image;if(p&&p.height>0){let x=new gc(p.height);return x.fromEquirectangularTexture(s,d),e.set(d,x),d.addEventListener("dispose",c),a(x.texture,d.mapping)}else return null}}return d}function o(d){if(d&&d.isTexture){let u=d.mapping,p=u===El||u===Al,x=u===Jn||u===bs;if(p||x){let m=t.get(d),g=m!==void 0?m.texture.pmremVersion:0;if(d.isRenderTargetTexture&&d.pmremVersion!==g)return i===null&&(i=new Tr(s)),m=p?i.fromEquirectangular(d,m):i.fromCubemap(d,m),m.texture.pmremVersion=d.pmremVersion,t.set(d,m),m.texture;if(m!==void 0)return m.texture;{let S=d.image;return p&&S&&S.height>0||x&&S&&l(S)?(i===null&&(i=new Tr(s)),m=p?i.fromEquirectangular(d):i.fromCubemap(d),m.texture.pmremVersion=d.pmremVersion,t.set(d,m),d.addEventListener("dispose",h),m.texture):null}}}return d}function a(d,u){return u===El?d.mapping=Jn:u===Al&&(d.mapping=bs),d}function l(d){let u=0,p=6;for(let x=0;x<p;x++)d[x]!==void 0&&u++;return u===p}function c(d){let u=d.target;u.removeEventListener("dispose",c);let p=e.get(u);p!==void 0&&(e.delete(u),p.dispose())}function h(d){let u=d.target;u.removeEventListener("dispose",h);let p=t.get(u);p!==void 0&&(t.delete(u),p.dispose())}function f(){e=new WeakMap,t=new WeakMap,i!==null&&(i.dispose(),i=null)}return{get:n,dispose:f}}function lv(s){let e={};function t(i){if(e[i]!==void 0)return e[i];let n=s.getExtension(i);return e[i]=n,n}return{has:function(i){return t(i)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(i){let n=t(i);return n===null&&as("WebGLRenderer: "+i+" extension not supported."),n}}}function cv(s,e,t,i){let n={},r=new WeakMap;function o(f){let d=f.target;d.index!==null&&e.remove(d.index);for(let p in d.attributes)e.remove(d.attributes[p]);d.removeEventListener("dispose",o),delete n[d.id];let u=r.get(d);u&&(e.remove(u),r.delete(d)),i.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,t.memory.geometries--}function a(f,d){return n[d.id]===!0||(d.addEventListener("dispose",o),n[d.id]=!0,t.memory.geometries++),d}function l(f){let d=f.attributes;for(let u in d)e.update(d[u],s.ARRAY_BUFFER)}function c(f){let d=[],u=f.index,p=f.attributes.position,x=0;if(p===void 0)return;if(u!==null){let S=u.array;x=u.version;for(let T=0,_=S.length;T<_;T+=3){let v=S[T+0],E=S[T+1],A=S[T+2];d.push(v,E,E,A,A,v)}}else{let S=p.array;x=p.version;for(let T=0,_=S.length/3-1;T<_;T+=3){let v=T+0,E=T+1,A=T+2;d.push(v,E,E,A,A,v)}}let m=new(p.count>=65535?io:to)(d,1);m.version=x;let g=r.get(f);g&&e.remove(g),r.set(f,m)}function h(f){let d=r.get(f);if(d){let u=f.index;u!==null&&d.version<u.version&&c(f)}else c(f);return r.get(f)}return{get:a,update:l,getWireframeAttribute:h}}function hv(s,e,t){let i;function n(f){i=f}let r,o;function a(f){r=f.type,o=f.bytesPerElement}function l(f,d){s.drawElements(i,d,r,f*o),t.update(d,i,1)}function c(f,d,u){u!==0&&(s.drawElementsInstanced(i,d,r,f*o,u),t.update(d,i,u))}function h(f,d,u){if(u===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,d,0,r,f,0,u);let x=0;for(let m=0;m<u;m++)x+=d[m];t.update(x,i,1)}this.setMode=n,this.setIndex=a,this.render=l,this.renderInstances=c,this.renderMultiDraw=h}function uv(s){let e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function i(r,o,a){switch(t.calls++,o){case s.TRIANGLES:t.triangles+=a*(r/3);break;case s.LINES:t.lines+=a*(r/2);break;case s.LINE_STRIP:t.lines+=a*(r-1);break;case s.LINE_LOOP:t.lines+=a*r;break;case s.POINTS:t.points+=a*r;break;default:Ke("WebGLInfo: Unknown draw mode:",o);break}}function n(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:n,update:i}}function dv(s,e,t){let i=new WeakMap,n=new ut;function r(o,a,l){let c=o.morphTargetInfluences,h=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,f=h!==void 0?h.length:0,d=i.get(a);if(d===void 0||d.count!==f){let R=function(){A.dispose(),i.delete(a),a.removeEventListener("dispose",R)};d!==void 0&&d.texture.dispose();let u=a.morphAttributes.position!==void 0,p=a.morphAttributes.normal!==void 0,x=a.morphAttributes.color!==void 0,m=a.morphAttributes.position||[],g=a.morphAttributes.normal||[],S=a.morphAttributes.color||[],T=0;u===!0&&(T=1),p===!0&&(T=2),x===!0&&(T=3);let _=a.attributes.position.count*T,v=1;_>e.maxTextureSize&&(v=Math.ceil(_/e.maxTextureSize),_=e.maxTextureSize);let E=new Float32Array(_*v*4*f),A=new $r(E,_,v,f);A.type=wi,A.needsUpdate=!0;let y=T*4;for(let I=0;I<f;I++){let L=m[I],b=g[I],w=S[I],P=_*v*4*I;for(let U=0;U<L.count;U++){let F=U*y;u===!0&&(n.fromBufferAttribute(L,U),E[P+F+0]=n.x,E[P+F+1]=n.y,E[P+F+2]=n.z,E[P+F+3]=0),p===!0&&(n.fromBufferAttribute(b,U),E[P+F+4]=n.x,E[P+F+5]=n.y,E[P+F+6]=n.z,E[P+F+7]=0),x===!0&&(n.fromBufferAttribute(w,U),E[P+F+8]=n.x,E[P+F+9]=n.y,E[P+F+10]=n.z,E[P+F+11]=w.itemSize===4?n.w:1)}}d={count:f,texture:A,size:new ee(_,v)},i.set(a,d),a.addEventListener("dispose",R)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(s,"morphTexture",o.morphTexture,t);else{let u=0;for(let x=0;x<c.length;x++)u+=c[x];let p=a.morphTargetsRelative?1:1-u;l.getUniforms().setValue(s,"morphTargetBaseInfluence",p),l.getUniforms().setValue(s,"morphTargetInfluences",c)}l.getUniforms().setValue(s,"morphTargetsTexture",d.texture,t),l.getUniforms().setValue(s,"morphTargetsTextureSize",d.size)}return{update:r}}function fv(s,e,t,i,n){let r=new WeakMap;function o(c){let h=n.render.frame,f=c.geometry,d=e.get(c,f);if(r.get(d)!==h&&(e.update(d),r.set(d,h)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),r.get(c)!==h&&(t.update(c.instanceMatrix,s.ARRAY_BUFFER),c.instanceColor!==null&&t.update(c.instanceColor,s.ARRAY_BUFFER),r.set(c,h))),c.isSkinnedMesh){let u=c.skeleton;r.get(u)!==h&&(u.update(),r.set(u,h))}return d}function a(){r=new WeakMap}function l(c){let h=c.target;h.removeEventListener("dispose",l),i.releaseStatesOfObject(h),t.remove(h.instanceMatrix),h.instanceColor!==null&&t.remove(h.instanceColor)}return{update:o,dispose:a}}var pv={[No]:"LINEAR_TONE_MAPPING",[Uo]:"REINHARD_TONE_MAPPING",[Oo]:"CINEON_TONE_MAPPING",[Fo]:"ACES_FILMIC_TONE_MAPPING",[ko]:"AGX_TONE_MAPPING",[Kn]:"NEUTRAL_TONE_MAPPING",[Bo]:"CUSTOM_TONE_MAPPING"};function mv(s,e,t,i,n,r){let o=new dt(e,t,{type:s,depthBuffer:n,stencilBuffer:r,samples:i?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),a=null,l=null,c=new _t;c.setAttribute("position",new at([-1,3,0,-1,-1,0,3,-1,0],3)),c.setAttribute("uv",new at([0,2,0,0,2,0],2));let h=new dr({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),f=new De(c,h),d=new bi(-1,1,1,-1,0,1),u=null,p=null,x=!1,m,g=null,S=[],T=!1;this.setSize=function(_,v){o.setSize(_,v),a!==null&&a.setSize(_,v),l!==null&&l.setSize(_,v);for(let E=0;E<S.length;E++){let A=S[E];A.setSize&&A.setSize(_,v)}},this.setEffects=function(_){S=_,T=S.length>0&&S[0].isRenderPass===!0;let v=o.width,E=o.height;S.length>0&&a===null&&(a=new dt(v,E,{type:wt,depthBuffer:!1,stencilBuffer:!1}),l=new dt(v,E,{type:wt,depthBuffer:!1,stencilBuffer:!1}));for(let A=0;A<S.length;A++){let y=S[A];y.setSize&&y.setSize(v,E)}},this.begin=function(_,v){if(x||_.toneMapping===Si&&S.length===0)return!1;if(g=v,v!==null){let E=v.width,A=v.height;(o.width!==E||o.height!==A)&&this.setSize(E,A)}return T===!1&&_.setRenderTarget(o),m=_.toneMapping,_.toneMapping=Si,!0},this.hasRenderPass=function(){return T},this.end=function(_,v){_.toneMapping=m,x=!0;let E=o,A=a;for(let y=0;y<S.length;y++){let R=S[y];R.enabled!==!1&&(R.render(_,A,E,v),R.needsSwap!==!1&&(E=A,A=A===a?l:a))}if(u!==_.outputColorSpace||p!==_.toneMapping){u=_.outputColorSpace,p=_.toneMapping,h.defines={},tt.getTransfer(u)===ht&&(h.defines.SRGB_TRANSFER="");let y=pv[p];y&&(h.defines[y]=""),h.needsUpdate=!0}h.uniforms.tDiffuse.value=E.texture,_.setRenderTarget(g),_.render(f,d),g=null,x=!1},this.isCompositing=function(){return x},this.dispose=function(){o.dispose(),a!==null&&a.dispose(),l!==null&&l.dispose(),c.dispose(),h.dispose()}}var kp=new Ot,Su=new tn(1,1),zp=new $r,Hp=new il,Vp=new lo,yp=[],Mp=[],bp=new Float32Array(16),Sp=new Float32Array(9),wp=new Float32Array(4);function Er(s,e,t){let i=s[0];if(i<=0||i>0)return s;let n=e*t,r=yp[n];if(r===void 0&&(r=new Float32Array(n),yp[n]=r),e!==0){i.toArray(r,0);for(let o=1,a=0;o!==e;++o)a+=t,s[o].toArray(r,a)}return r}function jt(s,e){if(s.length!==e.length)return!1;for(let t=0,i=s.length;t<i;t++)if(s[t]!==e[t])return!1;return!0}function Zt(s,e){for(let t=0,i=e.length;t<i;t++)s[t]=e[t]}function vc(s,e){let t=Mp[e];t===void 0&&(t=new Int32Array(e),Mp[e]=t);for(let i=0;i!==e;++i)t[i]=s.allocateTextureUnit();return t}function gv(s,e){let t=this.cache;t[0]!==e&&(s.uniform1f(this.addr,e),t[0]=e)}function xv(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(s.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(jt(t,e))return;s.uniform2fv(this.addr,e),Zt(t,e)}}function _v(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(s.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(s.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(jt(t,e))return;s.uniform3fv(this.addr,e),Zt(t,e)}}function vv(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(s.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(jt(t,e))return;s.uniform4fv(this.addr,e),Zt(t,e)}}function yv(s,e){let t=this.cache,i=e.elements;if(i===void 0){if(jt(t,e))return;s.uniformMatrix2fv(this.addr,!1,e),Zt(t,e)}else{if(jt(t,i))return;wp.set(i),s.uniformMatrix2fv(this.addr,!1,wp),Zt(t,i)}}function Mv(s,e){let t=this.cache,i=e.elements;if(i===void 0){if(jt(t,e))return;s.uniformMatrix3fv(this.addr,!1,e),Zt(t,e)}else{if(jt(t,i))return;Sp.set(i),s.uniformMatrix3fv(this.addr,!1,Sp),Zt(t,i)}}function bv(s,e){let t=this.cache,i=e.elements;if(i===void 0){if(jt(t,e))return;s.uniformMatrix4fv(this.addr,!1,e),Zt(t,e)}else{if(jt(t,i))return;bp.set(i),s.uniformMatrix4fv(this.addr,!1,bp),Zt(t,i)}}function Sv(s,e){let t=this.cache;t[0]!==e&&(s.uniform1i(this.addr,e),t[0]=e)}function wv(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(s.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(jt(t,e))return;s.uniform2iv(this.addr,e),Zt(t,e)}}function Tv(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(s.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(jt(t,e))return;s.uniform3iv(this.addr,e),Zt(t,e)}}function Ev(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(s.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(jt(t,e))return;s.uniform4iv(this.addr,e),Zt(t,e)}}function Av(s,e){let t=this.cache;t[0]!==e&&(s.uniform1ui(this.addr,e),t[0]=e)}function Cv(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(s.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(jt(t,e))return;s.uniform2uiv(this.addr,e),Zt(t,e)}}function Rv(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(s.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(jt(t,e))return;s.uniform3uiv(this.addr,e),Zt(t,e)}}function Pv(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(s.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(jt(t,e))return;s.uniform4uiv(this.addr,e),Zt(t,e)}}function Lv(s,e,t){let i=this.cache,n=t.allocateTextureUnit();i[0]!==n&&(s.uniform1i(this.addr,n),i[0]=n);let r;this.type===s.SAMPLER_2D_SHADOW?(Su.compareFunction=t.isReversedDepthBuffer()?fc:dc,r=Su):r=kp,t.setTexture2D(e||r,n)}function Iv(s,e,t){let i=this.cache,n=t.allocateTextureUnit();i[0]!==n&&(s.uniform1i(this.addr,n),i[0]=n),t.setTexture3D(e||Hp,n)}function Dv(s,e,t){let i=this.cache,n=t.allocateTextureUnit();i[0]!==n&&(s.uniform1i(this.addr,n),i[0]=n),t.setTextureCube(e||Vp,n)}function Nv(s,e,t){let i=this.cache,n=t.allocateTextureUnit();i[0]!==n&&(s.uniform1i(this.addr,n),i[0]=n),t.setTexture2DArray(e||zp,n)}function Uv(s){switch(s){case 5126:return gv;case 35664:return xv;case 35665:return _v;case 35666:return vv;case 35674:return yv;case 35675:return Mv;case 35676:return bv;case 5124:case 35670:return Sv;case 35667:case 35671:return wv;case 35668:case 35672:return Tv;case 35669:case 35673:return Ev;case 5125:return Av;case 36294:return Cv;case 36295:return Rv;case 36296:return Pv;case 35678:case 36198:case 36298:case 36306:case 35682:return Lv;case 35679:case 36299:case 36307:return Iv;case 35680:case 36300:case 36308:case 36293:return Dv;case 36289:case 36303:case 36311:case 36292:return Nv}}function Ov(s,e){s.uniform1fv(this.addr,e)}function Fv(s,e){let t=Er(e,this.size,2);s.uniform2fv(this.addr,t)}function Bv(s,e){let t=Er(e,this.size,3);s.uniform3fv(this.addr,t)}function kv(s,e){let t=Er(e,this.size,4);s.uniform4fv(this.addr,t)}function zv(s,e){let t=Er(e,this.size,4);s.uniformMatrix2fv(this.addr,!1,t)}function Hv(s,e){let t=Er(e,this.size,9);s.uniformMatrix3fv(this.addr,!1,t)}function Vv(s,e){let t=Er(e,this.size,16);s.uniformMatrix4fv(this.addr,!1,t)}function Gv(s,e){s.uniform1iv(this.addr,e)}function Wv(s,e){s.uniform2iv(this.addr,e)}function Xv(s,e){s.uniform3iv(this.addr,e)}function qv(s,e){s.uniform4iv(this.addr,e)}function Yv(s,e){s.uniform1uiv(this.addr,e)}function jv(s,e){s.uniform2uiv(this.addr,e)}function Zv(s,e){s.uniform3uiv(this.addr,e)}function Kv(s,e){s.uniform4uiv(this.addr,e)}function Jv(s,e,t){let i=this.cache,n=e.length,r=vc(t,n);jt(i,r)||(s.uniform1iv(this.addr,r),Zt(i,r));let o;this.type===s.SAMPLER_2D_SHADOW?o=Su:o=kp;for(let a=0;a!==n;++a)t.setTexture2D(e[a]||o,r[a])}function Qv(s,e,t){let i=this.cache,n=e.length,r=vc(t,n);jt(i,r)||(s.uniform1iv(this.addr,r),Zt(i,r));for(let o=0;o!==n;++o)t.setTexture3D(e[o]||Hp,r[o])}function $v(s,e,t){let i=this.cache,n=e.length,r=vc(t,n);jt(i,r)||(s.uniform1iv(this.addr,r),Zt(i,r));for(let o=0;o!==n;++o)t.setTextureCube(e[o]||Vp,r[o])}function ey(s,e,t){let i=this.cache,n=e.length,r=vc(t,n);jt(i,r)||(s.uniform1iv(this.addr,r),Zt(i,r));for(let o=0;o!==n;++o)t.setTexture2DArray(e[o]||zp,r[o])}function ty(s){switch(s){case 5126:return Ov;case 35664:return Fv;case 35665:return Bv;case 35666:return kv;case 35674:return zv;case 35675:return Hv;case 35676:return Vv;case 5124:case 35670:return Gv;case 35667:case 35671:return Wv;case 35668:case 35672:return Xv;case 35669:case 35673:return qv;case 5125:return Yv;case 36294:return jv;case 36295:return Zv;case 36296:return Kv;case 35678:case 36198:case 36298:case 36306:case 35682:return Jv;case 35679:case 36299:case 36307:return Qv;case 35680:case 36300:case 36308:case 36293:return $v;case 36289:case 36303:case 36311:case 36292:return ey}}var wu=class{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.setValue=Uv(t.type)}},Tu=class{constructor(e,t,i){this.id=e,this.addr=i,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=ty(t.type)}},Eu=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,i){let n=this.seq;for(let r=0,o=n.length;r!==o;++r){let a=n[r];a.setValue(e,t[a.id],i)}}},Mu=/(\w+)(\])?(\[|\.)?/g;function Tp(s,e){s.seq.push(e),s.map[e.id]=e}function iy(s,e,t){let i=s.name,n=i.length;for(Mu.lastIndex=0;;){let r=Mu.exec(i),o=Mu.lastIndex,a=r[1],l=r[2]==="]",c=r[3];if(l&&(a=a|0),c===void 0||c==="["&&o+2===n){Tp(t,c===void 0?new wu(a,s,e):new Tu(a,s,e));break}else{let f=t.map[a];f===void 0&&(f=new Eu(a),Tp(t,f)),t=f}}}var wr=class{constructor(e,t){this.seq=[],this.map={};let i=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let o=0;o<i;++o){let a=e.getActiveUniform(t,o),l=e.getUniformLocation(t,a.name);iy(a,l,this)}let n=[],r=[];for(let o of this.seq)o.type===e.SAMPLER_2D_SHADOW||o.type===e.SAMPLER_CUBE_SHADOW||o.type===e.SAMPLER_2D_ARRAY_SHADOW?n.push(o):r.push(o);n.length>0&&(this.seq=n.concat(r))}setValue(e,t,i,n){let r=this.map[t];r!==void 0&&r.setValue(e,i,n)}setOptional(e,t,i){let n=t[i];n!==void 0&&this.setValue(e,i,n)}static upload(e,t,i,n){for(let r=0,o=t.length;r!==o;++r){let a=t[r],l=i[a.id];l.needsUpdate!==!1&&a.setValue(e,l.value,n)}}static seqWithValue(e,t){let i=[];for(let n=0,r=e.length;n!==r;++n){let o=e[n];o.id in t&&i.push(o)}return i}};function Ep(s,e,t){let i=s.createShader(e);return s.shaderSource(i,t),s.compileShader(i),i}var ny=37297,sy=0;function ry(s,e){let t=s.split(`
`),i=[],n=Math.max(e-6,0),r=Math.min(e+6,t.length);for(let o=n;o<r;o++){let a=o+1;i.push(`${a===e?">":" "} ${a}: ${t[o]}`)}return i.join(`
`)}var Ap=new Qe;function oy(s){tt._getMatrix(Ap,tt.workingColorSpace,s);let e=`mat3( ${Ap.elements.map(t=>t.toFixed(4))} )`;switch(tt.getTransfer(s)){case Jr:return[e,"LinearTransferOETF"];case ht:return[e,"sRGBTransferOETF"];default:return Ge("WebGLProgram: Unsupported color space: ",s),[e,"LinearTransferOETF"]}}function Cp(s,e,t){let i=s.getShaderParameter(e,s.COMPILE_STATUS),r=(s.getShaderInfoLog(e)||"").trim();if(i&&r==="")return"";let o=/ERROR: 0:(\d+)/.exec(r);if(o){let a=parseInt(o[1]);return t.toUpperCase()+`

`+r+`

`+ry(s.getShaderSource(e),a)}else return r}function ay(s,e){let t=oy(e);return[`vec4 ${s}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}var ly={[No]:"Linear",[Uo]:"Reinhard",[Oo]:"Cineon",[Fo]:"ACESFilmic",[ko]:"AgX",[Kn]:"Neutral",[Bo]:"Custom"};function cy(s,e){let t=ly[e];return t===void 0?(Ge("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+s+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+s+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}var mc=new D;function hy(){tt.getLuminanceCoefficients(mc);let s=mc.x.toFixed(4),e=mc.y.toFixed(4),t=mc.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${s}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function uy(s){return[s.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",s.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Jo).join(`
`)}function dy(s){let e=[];for(let t in s){let i=s[t];i!==!1&&e.push("#define "+t+" "+i)}return e.join(`
`)}function fy(s,e){let t={},i=s.getProgramParameter(e,s.ACTIVE_ATTRIBUTES);for(let n=0;n<i;n++){let r=s.getActiveAttrib(e,n),o=r.name,a=1;r.type===s.FLOAT_MAT2&&(a=2),r.type===s.FLOAT_MAT3&&(a=3),r.type===s.FLOAT_MAT4&&(a=4),t[o]={type:r.type,location:s.getAttribLocation(e,o),locationSize:a}}return t}function Jo(s){return s!==""}function Rp(s,e){let t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return s.replace(/NUM_SUN_LIGHTS/g,e.numSunLights).replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,e.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function Pp(s,e){return s.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}var py=/^[ \t]*#include +<([\w\d./]+)>/gm;function Au(s){return s.replace(py,gy)}var my=new Map;function gy(s,e){let t=st[e];if(t===void 0){let i=my.get(e);if(i!==void 0)t=st[i],Ge('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,i);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+e+">")}return Au(t)}var xy=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Lp(s){return s.replace(xy,_y)}function _y(s,e,t,i){let n="";for(let r=parseInt(e);r<parseInt(t);r++)n+=i.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return n}function Ip(s){let e=`precision ${s.precision} float;
	precision ${s.precision} int;
	precision ${s.precision} sampler2D;
	precision ${s.precision} samplerCube;
	precision ${s.precision} sampler3D;
	precision ${s.precision} sampler2DArray;
	precision ${s.precision} sampler2DShadow;
	precision ${s.precision} samplerCubeShadow;
	precision ${s.precision} sampler2DArrayShadow;
	precision ${s.precision} isampler2D;
	precision ${s.precision} isampler3D;
	precision ${s.precision} isamplerCube;
	precision ${s.precision} isampler2DArray;
	precision ${s.precision} usampler2D;
	precision ${s.precision} usampler3D;
	precision ${s.precision} usamplerCube;
	precision ${s.precision} usampler2DArray;
	`;return s.precision==="highp"?e+=`
#define HIGH_PRECISION`:s.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:s.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}var vy={[Zn]:"SHADOWMAP_TYPE_PCF",[gr]:"SHADOWMAP_TYPE_VSM"};function yy(s){return vy[s.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var My={[Jn]:"ENVMAP_TYPE_CUBE",[bs]:"ENVMAP_TYPE_CUBE",[zo]:"ENVMAP_TYPE_CUBE_UV"};function by(s){return s.envMap===!1?"ENVMAP_TYPE_CUBE":My[s.envMapMode]||"ENVMAP_TYPE_CUBE"}var Sy={[bs]:"ENVMAP_MODE_REFRACTION"};function wy(s){return s.envMap===!1?"ENVMAP_MODE_REFLECTION":Sy[s.envMapMode]||"ENVMAP_MODE_REFLECTION"}var Ty={[Tl]:"ENVMAP_BLENDING_MULTIPLY",[Xf]:"ENVMAP_BLENDING_MIX",[qf]:"ENVMAP_BLENDING_ADD"};function Ey(s){return s.envMap===!1?"ENVMAP_BLENDING_NONE":Ty[s.combine]||"ENVMAP_BLENDING_NONE"}function Ay(s){let e=s.envMapCubeUVHeight;if(e===null)return null;let t=Math.log2(e)-2,i=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:i,maxMip:t}}function Cy(s,e,t,i){let n=s.getContext(),r=t.defines,o=t.vertexShader,a=t.fragmentShader,l=yy(t),c=by(t),h=wy(t),f=Ey(t),d=Ay(t),u=uy(t),p=dy(r),x=n.createProgram(),m,g,S=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,p].filter(Jo).join(`
`),m.length>0&&(m+=`
`),g=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,p].filter(Jo).join(`
`),g.length>0&&(g+=`
`)):(m=[Ip(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,p,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(Jo).join(`
`),g=[Ip(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,p,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+h:"",t.envMap?"#define "+f:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.retroreflection?"#define USE_RETROREFLECTION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==Si?"#define TONE_MAPPING":"",t.toneMapping!==Si?st.tonemapping_pars_fragment:"",t.toneMapping!==Si?cy("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",st.colorspace_pars_fragment,ay("linearToOutputTexel",t.outputColorSpace),hy(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(Jo).join(`
`)),o=Au(o),o=Rp(o,t),o=Pp(o,t),a=Au(a),a=Rp(a,t),a=Pp(a,t),o=Lp(o),a=Lp(a),t.isRawShaderMaterial!==!0&&(S=`#version 300 es
`,m=[u,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,g=["#define varying in",t.glslVersion===ru?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===ru?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+g);let T=S+m+o,_=S+g+a,v=Ep(n,n.VERTEX_SHADER,T),E=Ep(n,n.FRAGMENT_SHADER,_);n.attachShader(x,v),n.attachShader(x,E),t.index0AttributeName!==void 0?n.bindAttribLocation(x,0,t.index0AttributeName):t.hasPositionAttribute===!0&&n.bindAttribLocation(x,0,"position"),n.linkProgram(x);function A(L){if(s.debug.checkShaderErrors){let b=n.getProgramInfoLog(x)||"",w=n.getShaderInfoLog(v)||"",P=n.getShaderInfoLog(E)||"",U=b.trim(),F=w.trim(),O=P.trim(),z=!0,k=!0;if(n.getProgramParameter(x,n.LINK_STATUS)===!1)if(z=!1,typeof s.debug.onShaderError=="function")s.debug.onShaderError(n,x,v,E);else{let G=Cp(n,v,"vertex"),Y=Cp(n,E,"fragment");Ke("WebGLProgram: Shader Error "+n.getError()+" - VALIDATE_STATUS "+n.getProgramParameter(x,n.VALIDATE_STATUS)+`

Material Name: `+L.name+`
Material Type: `+L.type+`

Program Info Log: `+U+`
`+G+`
`+Y)}else U!==""?Ge("WebGLProgram: Program Info Log:",U):(F===""||O==="")&&(k=!1);k&&(L.diagnostics={runnable:z,programLog:U,vertexShader:{log:F,prefix:m},fragmentShader:{log:O,prefix:g}})}n.deleteShader(v),n.deleteShader(E),y=new wr(n,x),R=fy(n,x)}let y;this.getUniforms=function(){return y===void 0&&A(this),y};let R;this.getAttributes=function(){return R===void 0&&A(this),R};let I=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return I===!1&&(I=n.getProgramParameter(x,ny)),I},this.destroy=function(){i.releaseStatesOfProgram(this),n.deleteProgram(x),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=sy++,this.cacheKey=e,this.usedTimes=1,this.program=x,this.vertexShader=v,this.fragmentShader=E,this}var Ry=0,Cu=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,i){let n=this._getShaderCacheForMaterial(e);return n.has(t)===!1&&(n.add(t),t.usedTimes++),n.has(i)===!1&&(n.add(i),i.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let i of t)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,i=t.get(e);return i===void 0&&(i=new Set,t.set(e,i)),i}_getShaderStage(e){let t=this.shaderCache,i=t.get(e);return i===void 0&&(i=new Ru(e),t.set(e,i)),i}},Ru=class{constructor(e){this.id=Ry++,this.code=e,this.usedTimes=0}};function Py(s){return s===$n||s===Xo||s===qo}function Ly(s,e,t,i,n,r){let o=new nr,a=new Cu,l=new Set,c=[],h=new Map,f=i.logarithmicDepthBuffer,d=i.precision,u={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function p(y){return l.add(y),y===0?"uv":`uv${y}`}function x(y,R,I,L,b,w){let P=L.fog,U=b.geometry,F=y.isMeshStandardMaterial||y.isMeshLambertMaterial||y.isMeshPhongMaterial?L.environment:null,O=y.isMeshStandardMaterial||y.isMeshLambertMaterial&&!y.envMap||y.isMeshPhongMaterial&&!y.envMap,z=e.get(y.envMap||F,O),k=z&&z.mapping===zo?z.image.height:null,G=u[y.type];y.precision!==null&&(d=i.getMaxPrecision(y.precision),d!==y.precision&&Ge("WebGLProgram.getParameters:",y.precision,"not supported, using",d,"instead."));let Y=U.morphAttributes.position||U.morphAttributes.normal||U.morphAttributes.color,he=Y!==void 0?Y.length:0,pe=0;U.morphAttributes.position!==void 0&&(pe=1),U.morphAttributes.normal!==void 0&&(pe=2),U.morphAttributes.color!==void 0&&(pe=3);let Te,Ee,Re,j;if(G){let Tt=ln[G];Te=Tt.vertexShader,Ee=Tt.fragmentShader}else{Te=y.vertexShader,Ee=y.fragmentShader;let Tt=a.getVertexShaderStage(y),ft=a.getFragmentShaderStage(y);a.update(y,Tt,ft),Re=Tt.id,j=ft.id}let J=s.getRenderTarget(),fe=s.state.buffers.depth.getReversed(),Le=b.isInstancedMesh===!0,_e=b.isBatchedMesh===!0,ze=!!y.map,et=!!y.matcap,ie=!!z,ae=!!y.aoMap,re=!!y.lightMap,oe=!!y.bumpMap&&y.wireframe===!1,le=!!y.normalMap,ke=!!y.displacementMap,Ie=!!y.emissiveMap,Ue=!!y.metalnessMap,je=!!y.roughnessMap,B=y.anisotropy>0,$e=y.clearcoat>0,Ze=y.dispersion>0,N=y.retroreflectivity>0,M=y.iridescence>0,W=y.sheen>0,X=y.transmission>0,q=B&&!!y.anisotropyMap,ue=$e&&!!y.clearcoatMap,de=$e&&!!y.clearcoatNormalMap,$=$e&&!!y.clearcoatRoughnessMap,te=M&&!!y.iridescenceMap,ge=M&&!!y.iridescenceThicknessMap,Oe=W&&!!y.sheenColorMap,xe=W&&!!y.sheenRoughnessMap,me=!!y.specularMap,Ne=!!y.specularColorMap,Xe=!!y.specularIntensityMap,Je=X&&!!y.transmissionMap,V=X&&!!y.thicknessMap,ve=!!y.gradientMap,ne=!!y.alphaMap,ye=y.alphaTest>0,Ae=!!y.alphaHash,ce=!!y.extensions,qe=Si;y.toneMapped&&(J===null||J.isXRRenderTarget===!0)&&(qe=s.toneMapping);let He={shaderID:G,shaderType:y.type,shaderName:y.name,vertexShader:Te,fragmentShader:Ee,defines:y.defines,customVertexShaderID:Re,customFragmentShaderID:j,isRawShaderMaterial:y.isRawShaderMaterial===!0,glslVersion:y.glslVersion,precision:d,batching:_e,batchingColor:_e&&b._colorsTexture!==null,instancing:Le,instancingColor:Le&&b.instanceColor!==null,instancingMorph:Le&&b.morphTexture!==null,outputColorSpace:J===null?s.outputColorSpace:J.isXRRenderTarget===!0?J.texture.colorSpace:tt.workingColorSpace,alphaToCoverage:!!y.alphaToCoverage,map:ze,matcap:et,envMap:ie,envMapMode:ie&&z.mapping,envMapCubeUVHeight:k,aoMap:ae,lightMap:re,bumpMap:oe,normalMap:le,displacementMap:ke,emissiveMap:Ie,normalMapObjectSpace:le&&y.normalMapType===Kf,normalMapTangentSpace:le&&y.normalMapType===Mr,packedNormalMap:le&&y.normalMapType===Mr&&Py(y.normalMap.format),metalnessMap:Ue,roughnessMap:je,anisotropy:B,anisotropyMap:q,clearcoat:$e,clearcoatMap:ue,clearcoatNormalMap:de,clearcoatRoughnessMap:$,dispersion:Ze,retroreflection:N,iridescence:M,iridescenceMap:te,iridescenceThicknessMap:ge,sheen:W,sheenColorMap:Oe,sheenRoughnessMap:xe,specularMap:me,specularColorMap:Ne,specularIntensityMap:Xe,transmission:X,transmissionMap:Je,thicknessMap:V,gradientMap:ve,opaque:y.transparent===!1&&y.blending===xr&&y.alphaToCoverage===!1,alphaMap:ne,alphaTest:ye,alphaHash:Ae,combine:y.combine,mapUv:ze&&p(y.map.channel),aoMapUv:ae&&p(y.aoMap.channel),lightMapUv:re&&p(y.lightMap.channel),bumpMapUv:oe&&p(y.bumpMap.channel),normalMapUv:le&&p(y.normalMap.channel),displacementMapUv:ke&&p(y.displacementMap.channel),emissiveMapUv:Ie&&p(y.emissiveMap.channel),metalnessMapUv:Ue&&p(y.metalnessMap.channel),roughnessMapUv:je&&p(y.roughnessMap.channel),anisotropyMapUv:q&&p(y.anisotropyMap.channel),clearcoatMapUv:ue&&p(y.clearcoatMap.channel),clearcoatNormalMapUv:de&&p(y.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:$&&p(y.clearcoatRoughnessMap.channel),iridescenceMapUv:te&&p(y.iridescenceMap.channel),iridescenceThicknessMapUv:ge&&p(y.iridescenceThicknessMap.channel),sheenColorMapUv:Oe&&p(y.sheenColorMap.channel),sheenRoughnessMapUv:xe&&p(y.sheenRoughnessMap.channel),specularMapUv:me&&p(y.specularMap.channel),specularColorMapUv:Ne&&p(y.specularColorMap.channel),specularIntensityMapUv:Xe&&p(y.specularIntensityMap.channel),transmissionMapUv:Je&&p(y.transmissionMap.channel),thicknessMapUv:V&&p(y.thicknessMap.channel),alphaMapUv:ne&&p(y.alphaMap.channel),vertexTangents:!!U.attributes.tangent&&(le||B),vertexNormals:!!U.attributes.normal,vertexColors:y.vertexColors,vertexAlphas:y.vertexColors===!0&&!!U.attributes.color&&U.attributes.color.itemSize===4,pointsUvs:b.isPoints===!0&&!!U.attributes.uv&&(ze||ne),fog:!!P,useFog:y.fog===!0,fogExp2:!!P&&P.isFogExp2,flatShading:y.wireframe===!1&&(y.flatShading===!0||U.attributes.normal===void 0&&le===!1&&(y.isMeshLambertMaterial||y.isMeshPhongMaterial||y.isMeshStandardMaterial||y.isMeshPhysicalMaterial)),sizeAttenuation:y.sizeAttenuation===!0,logarithmicDepthBuffer:f,reversedDepthBuffer:fe,skinning:b.isSkinnedMesh===!0,hasPositionAttribute:U.attributes.position!==void 0,morphTargets:U.morphAttributes.position!==void 0,morphNormals:U.morphAttributes.normal!==void 0,morphColors:U.morphAttributes.color!==void 0,morphTargetsCount:he,morphTextureStride:pe,numSunLights:R.sun.length,numDirLights:R.directional.length,numPointLights:R.point.length,numSpotLights:R.spot.length,numSpotLightMaps:R.spotLightMap.length,numRectAreaLights:R.rectArea.length,numHemiLights:R.hemi.length,numSunLightShadows:R.sunShadowMap.length,numDirLightShadows:R.directionalShadowMap.length,numPointLightShadows:R.pointShadowMap.length,numSpotLightShadows:R.spotShadowMap.length,numSpotLightShadowsWithMaps:R.numSpotLightShadowsWithMaps,numLightProbes:R.numLightProbes,numLightProbeGrids:w.length,numClippingPlanes:r.numPlanes,numClipIntersection:r.numIntersection,dithering:y.dithering,shadowMapEnabled:s.shadowMap.enabled&&I.length>0,shadowMapType:s.shadowMap.type,toneMapping:qe,decodeVideoTexture:ze&&y.map.isVideoTexture===!0&&tt.getTransfer(y.map.colorSpace)===ht,decodeVideoTextureEmissive:Ie&&y.emissiveMap.isVideoTexture===!0&&tt.getTransfer(y.emissiveMap.colorSpace)===ht,premultipliedAlpha:y.premultipliedAlpha,doubleSided:y.side===Dt,flipSided:y.side===ti,useDepthPacking:y.depthPacking>=0,depthPacking:y.depthPacking||0,index0AttributeName:y.index0AttributeName,extensionClipCullDistance:ce&&y.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(ce&&y.extensions.multiDraw===!0||_e)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:y.customProgramCacheKey()};return He.vertexUv1s=l.has(1),He.vertexUv2s=l.has(2),He.vertexUv3s=l.has(3),l.clear(),He}function m(y){let R=[];if(y.shaderID?R.push(y.shaderID):(R.push(y.customVertexShaderID),R.push(y.customFragmentShaderID)),y.defines!==void 0)for(let I in y.defines)R.push(I),R.push(y.defines[I]);return y.isRawShaderMaterial===!1&&(g(R,y),S(R,y),R.push(s.outputColorSpace)),R.push(y.customProgramCacheKey),R.join()}function g(y,R){y.push(R.precision),y.push(R.outputColorSpace),y.push(R.envMapMode),y.push(R.envMapCubeUVHeight),y.push(R.mapUv),y.push(R.alphaMapUv),y.push(R.lightMapUv),y.push(R.aoMapUv),y.push(R.bumpMapUv),y.push(R.normalMapUv),y.push(R.displacementMapUv),y.push(R.emissiveMapUv),y.push(R.metalnessMapUv),y.push(R.roughnessMapUv),y.push(R.anisotropyMapUv),y.push(R.clearcoatMapUv),y.push(R.clearcoatNormalMapUv),y.push(R.clearcoatRoughnessMapUv),y.push(R.iridescenceMapUv),y.push(R.iridescenceThicknessMapUv),y.push(R.sheenColorMapUv),y.push(R.sheenRoughnessMapUv),y.push(R.specularMapUv),y.push(R.specularColorMapUv),y.push(R.specularIntensityMapUv),y.push(R.transmissionMapUv),y.push(R.thicknessMapUv),y.push(R.combine),y.push(R.fogExp2),y.push(R.sizeAttenuation),y.push(R.morphTargetsCount),y.push(R.morphAttributeCount),y.push(R.numSunLights),y.push(R.numDirLights),y.push(R.numPointLights),y.push(R.numSpotLights),y.push(R.numSpotLightMaps),y.push(R.numHemiLights),y.push(R.numRectAreaLights),y.push(R.numSunLightShadows),y.push(R.numDirLightShadows),y.push(R.numPointLightShadows),y.push(R.numSpotLightShadows),y.push(R.numSpotLightShadowsWithMaps),y.push(R.numLightProbes),y.push(R.shadowMapType),y.push(R.toneMapping),y.push(R.numClippingPlanes),y.push(R.numClipIntersection),y.push(R.depthPacking)}function S(y,R){o.disableAll(),R.instancing&&o.enable(0),R.instancingColor&&o.enable(1),R.instancingMorph&&o.enable(2),R.matcap&&o.enable(3),R.envMap&&o.enable(4),R.normalMapObjectSpace&&o.enable(5),R.normalMapTangentSpace&&o.enable(6),R.clearcoat&&o.enable(7),R.iridescence&&o.enable(8),R.alphaTest&&o.enable(9),R.vertexColors&&o.enable(10),R.vertexAlphas&&o.enable(11),R.vertexUv1s&&o.enable(12),R.vertexUv2s&&o.enable(13),R.vertexUv3s&&o.enable(14),R.vertexTangents&&o.enable(15),R.anisotropy&&o.enable(16),R.alphaHash&&o.enable(17),R.batching&&o.enable(18),R.dispersion&&o.enable(19),R.retroreflection&&o.enable(24),R.batchingColor&&o.enable(20),R.gradientMap&&o.enable(21),R.packedNormalMap&&o.enable(22),R.vertexNormals&&o.enable(23),y.push(o.mask),o.disableAll(),R.fog&&o.enable(0),R.useFog&&o.enable(1),R.flatShading&&o.enable(2),R.logarithmicDepthBuffer&&o.enable(3),R.reversedDepthBuffer&&o.enable(4),R.skinning&&o.enable(5),R.morphTargets&&o.enable(6),R.morphNormals&&o.enable(7),R.morphColors&&o.enable(8),R.premultipliedAlpha&&o.enable(9),R.shadowMapEnabled&&o.enable(10),R.doubleSided&&o.enable(11),R.flipSided&&o.enable(12),R.useDepthPacking&&o.enable(13),R.dithering&&o.enable(14),R.transmission&&o.enable(15),R.sheen&&o.enable(16),R.opaque&&o.enable(17),R.pointsUvs&&o.enable(18),R.decodeVideoTexture&&o.enable(19),R.decodeVideoTextureEmissive&&o.enable(20),R.alphaToCoverage&&o.enable(21),R.numLightProbeGrids>0&&o.enable(22),R.hasPositionAttribute&&o.enable(23),y.push(o.mask)}function T(y){let R=u[y.type],I;if(R){let L=ln[R];I=kt.clone(L.uniforms)}else I=y.uniforms;return I}function _(y,R){let I=h.get(R);return I!==void 0?++I.usedTimes:(I=new Cy(s,R,y,n),c.push(I),h.set(R,I)),I}function v(y){if(--y.usedTimes===0){let R=c.indexOf(y);c[R]=c[c.length-1],c.pop(),h.delete(y.cacheKey),y.destroy()}}function E(y){a.remove(y)}function A(){a.dispose()}return{getParameters:x,getProgramCacheKey:m,getUniforms:T,acquireProgram:_,releaseProgram:v,releaseShaderCache:E,programs:c,dispose:A}}function Iy(){let s=new WeakMap;function e(o){return s.has(o)}function t(o){let a=s.get(o);return a===void 0&&(a={},s.set(o,a)),a}function i(o){s.delete(o)}function n(o,a,l){s.get(o)[a]=l}function r(){s=new WeakMap}return{has:e,get:t,remove:i,update:n,dispose:r}}function Dy(s,e){return s.groupOrder!==e.groupOrder?s.groupOrder-e.groupOrder:s.renderOrder!==e.renderOrder?s.renderOrder-e.renderOrder:s.material.id!==e.material.id?s.material.id-e.material.id:s.materialVariant!==e.materialVariant?s.materialVariant-e.materialVariant:s.z!==e.z?s.z-e.z:s.id-e.id}function Dp(s,e){return s.groupOrder!==e.groupOrder?s.groupOrder-e.groupOrder:s.renderOrder!==e.renderOrder?s.renderOrder-e.renderOrder:s.z!==e.z?e.z-s.z:s.id-e.id}function Np(){let s=[],e=0,t=[],i=[],n=[];function r(){e=0,t.length=0,i.length=0,n.length=0}function o(d){let u=0;return d.isInstancedMesh&&(u+=2),d.isSkinnedMesh&&(u+=1),u}function a(d,u,p,x,m,g){let S=s[e];return S===void 0?(S={id:d.id,object:d,geometry:u,material:p,materialVariant:o(d),groupOrder:x,renderOrder:d.renderOrder,z:m,group:g},s[e]=S):(S.id=d.id,S.object=d,S.geometry=u,S.material=p,S.materialVariant=o(d),S.groupOrder=x,S.renderOrder=d.renderOrder,S.z=m,S.group=g),e++,S}function l(d,u,p,x,m,g,S){S.reversedDepth===!0&&(m=-m);let T=a(d,u,p,x,m,g);p.transmission>0?i.push(T):p.transparent===!0?n.push(T):t.push(T)}function c(d,u,p,x,m,g){let S=a(d,u,p,x,m,g);p.transmission>0?i.unshift(S):p.transparent===!0?n.unshift(S):t.unshift(S)}function h(d,u){t.length>1&&t.sort(d||Dy),i.length>1&&i.sort(u||Dp),n.length>1&&n.sort(u||Dp)}function f(){for(let d=e,u=s.length;d<u;d++){let p=s[d];if(p.id===null)break;p.id=null,p.object=null,p.geometry=null,p.material=null,p.group=null}}return{opaque:t,transmissive:i,transparent:n,init:r,push:l,unshift:c,finish:f,sort:h}}function Ny(){let s=new WeakMap;function e(i,n){let r=s.get(i),o;return r===void 0?(o=new Np,s.set(i,[o])):n>=r.length?(o=new Np,r.push(o)):o=r[n],o}function t(){s=new WeakMap}return{get:e,dispose:t}}function Uy(){let s={};return{get:function(e){if(s[e.id]!==void 0)return s[e.id];let t;switch(e.type){case"SunLight":case"DirectionalLight":t={direction:new D,color:new Me};break;case"SpotLight":t={position:new D,direction:new D,color:new Me,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new D,color:new Me,distance:0,decay:0};break;case"HemisphereLight":t={direction:new D,skyColor:new Me,groundColor:new Me};break;case"RectAreaLight":t={color:new Me,position:new D,halfWidth:new D,halfHeight:new D};break}return s[e.id]=t,t}}}function Oy(){let s={};return{get:function(e){if(s[e.id]!==void 0)return s[e.id];let t;switch(e.type){case"SunLight":case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ee};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ee};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ee,shadowCameraNear:1,shadowCameraFar:1e3};break}return s[e.id]=t,t}}}var Fy=0;function By(s,e){return(e.castShadow?2:0)-(s.castShadow?2:0)+(e.map?1:0)-(s.map?1:0)}function ky(s){let e=new Uy,t=Oy(),i={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new D);let n=new D,r=new We,o=new We;function a(c){let h=0,f=0,d=0;for(let b=0;b<9;b++)i.probe[b].set(0,0,0);let u=0,p=0,x=0,m=0,g=0,S=0,T=0,_=0,v=0,E=0,A=0,y=0,R=0,I=0;c.sort(By);for(let b=0,w=c.length;b<w;b++){let P=c[b],U=P.color,F=P.intensity,O=P.distance,z=null;if(P.shadow&&P.shadow.map&&(P.shadow.map.texture.format===$n?z=P.shadow.map.texture:z=P.shadow.map.depthTexture||P.shadow.map.texture),P.isAmbientLight)h+=U.r*F,f+=U.g*F,d+=U.b*F;else if(P.isLightProbe){for(let k=0;k<9;k++)i.probe[k].addScaledVector(P.sh.coefficients[k],F);I++}else if(P.isSunLight){let k=e.get(P);if(k.color.copy(P.color).multiplyScalar(P.intensity),P.castShadow){let G=P.shadow,Y=t.get(P);Y.shadowIntensity=G.intensity,Y.shadowBias=G.bias,Y.shadowNormalBias=G.normalBias,Y.shadowRadius=G.radius,Y.shadowMapSize.copy(G.mapSize).multiply(G.getFrameExtents()),i.sunShadow[p]=Y,i.sunShadowMap[p]=z;let he=G.getViewportCount();for(let pe=0;pe<he;pe++)i.sunShadowMatrix[x+pe]=G.getMatrix(pe),i.sunShadowCascade[x+pe]=G._cascadeData[pe];x+=he,p++}i.sun[u]=k,u++}else if(P.isDirectionalLight){let k=e.get(P);if(k.color.copy(P.color).multiplyScalar(P.intensity),P.castShadow){let G=P.shadow,Y=t.get(P);Y.shadowIntensity=G.intensity,Y.shadowBias=G.bias,Y.shadowNormalBias=G.normalBias,Y.shadowRadius=G.radius,Y.shadowMapSize=G.mapSize,i.directionalShadow[m]=Y,i.directionalShadowMap[m]=z,i.directionalShadowMatrix[m]=P.shadow.matrix,v++}i.directional[m]=k,m++}else if(P.isSpotLight){let k=e.get(P);k.position.setFromMatrixPosition(P.matrixWorld),k.color.copy(U).multiplyScalar(F),k.distance=O,k.coneCos=Math.cos(P.angle),k.penumbraCos=Math.cos(P.angle*(1-P.penumbra)),k.decay=P.decay,i.spot[S]=k;let G=P.shadow;if(P.map&&(i.spotLightMap[y]=P.map,y++,G.updateMatrices(P),P.castShadow&&R++),i.spotLightMatrix[S]=G.matrix,P.castShadow){let Y=t.get(P);Y.shadowIntensity=G.intensity,Y.shadowBias=G.bias,Y.shadowNormalBias=G.normalBias,Y.shadowRadius=G.radius,Y.shadowMapSize=G.mapSize,i.spotShadow[S]=Y,i.spotShadowMap[S]=z,A++}S++}else if(P.isRectAreaLight){let k=e.get(P);k.color.copy(U).multiplyScalar(F),k.halfWidth.set(P.width*.5,0,0),k.halfHeight.set(0,P.height*.5,0),i.rectArea[T]=k,T++}else if(P.isPointLight){let k=e.get(P);if(k.color.copy(P.color).multiplyScalar(P.intensity),k.distance=P.distance,k.decay=P.decay,P.castShadow){let G=P.shadow,Y=t.get(P);Y.shadowIntensity=G.intensity,Y.shadowBias=G.bias,Y.shadowNormalBias=G.normalBias,Y.shadowRadius=G.radius,Y.shadowMapSize=G.mapSize,Y.shadowCameraNear=G.camera.near,Y.shadowCameraFar=G.camera.far,i.pointShadow[g]=Y,i.pointShadowMap[g]=z,i.pointShadowMatrix[g]=P.shadow.matrix,E++}i.point[g]=k,g++}else if(P.isHemisphereLight){let k=e.get(P);k.skyColor.copy(P.color).multiplyScalar(F),k.groundColor.copy(P.groundColor).multiplyScalar(F),i.hemi[_]=k,_++}}T>0&&(s.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=be.LTC_FLOAT_1,i.rectAreaLTC2=be.LTC_FLOAT_2):(i.rectAreaLTC1=be.LTC_HALF_1,i.rectAreaLTC2=be.LTC_HALF_2)),i.ambient[0]=h,i.ambient[1]=f,i.ambient[2]=d;let L=i.hash;(L.sunLength!==u||L.directionalLength!==m||L.pointLength!==g||L.spotLength!==S||L.rectAreaLength!==T||L.hemiLength!==_||L.numSunShadows!==p||L.numDirectionalShadows!==v||L.numPointShadows!==E||L.numSpotShadows!==A||L.numSpotMaps!==y||L.numLightProbes!==I)&&(i.sun.length=u,i.directional.length=m,i.spot.length=S,i.rectArea.length=T,i.point.length=g,i.hemi.length=_,i.sunShadow.length=p,i.sunShadowMap.length=p,i.sunShadowMatrix.length=x,i.sunShadowCascade.length=x,i.directionalShadow.length=v,i.directionalShadowMap.length=v,i.directionalShadowMatrix.length=v,i.pointShadow.length=E,i.pointShadowMap.length=E,i.pointShadowMatrix.length=E,i.spotShadow.length=A,i.spotShadowMap.length=A,i.spotLightMatrix.length=A+y-R,i.spotLightMap.length=y,i.numSpotLightShadowsWithMaps=R,i.numLightProbes=I,L.sunLength=u,L.directionalLength=m,L.pointLength=g,L.spotLength=S,L.rectAreaLength=T,L.hemiLength=_,L.numSunShadows=p,L.numDirectionalShadows=v,L.numPointShadows=E,L.numSpotShadows=A,L.numSpotMaps=y,L.numLightProbes=I,i.version=Fy++)}function l(c,h){let f=0,d=0,u=0,p=0,x=0,m=0,g=h.matrixWorldInverse;for(let S=0,T=c.length;S<T;S++){let _=c[S];if(_.isSunLight){let v=i.sun[f];v.direction.setFromMatrixPosition(_.matrixWorld),v.direction.transformDirection(g),f++}else if(_.isDirectionalLight){let v=i.directional[d];v.direction.setFromMatrixPosition(_.matrixWorld),n.setFromMatrixPosition(_.target.matrixWorld),v.direction.sub(n),v.direction.transformDirection(g),d++}else if(_.isSpotLight){let v=i.spot[p];v.position.setFromMatrixPosition(_.matrixWorld),v.position.applyMatrix4(g),v.direction.setFromMatrixPosition(_.matrixWorld),n.setFromMatrixPosition(_.target.matrixWorld),v.direction.sub(n),v.direction.transformDirection(g),p++}else if(_.isRectAreaLight){let v=i.rectArea[x];v.position.setFromMatrixPosition(_.matrixWorld),v.position.applyMatrix4(g),o.identity(),r.copy(_.matrixWorld),r.premultiply(g),o.extractRotation(r),v.halfWidth.set(_.width*.5,0,0),v.halfHeight.set(0,_.height*.5,0),v.halfWidth.applyMatrix4(o),v.halfHeight.applyMatrix4(o),x++}else if(_.isPointLight){let v=i.point[u];v.position.setFromMatrixPosition(_.matrixWorld),v.position.applyMatrix4(g),u++}else if(_.isHemisphereLight){let v=i.hemi[m];v.direction.setFromMatrixPosition(_.matrixWorld),v.direction.transformDirection(g),m++}}}return{setup:a,setupView:l,state:i}}function Up(s){let e=new ky(s),t=[],i=[],n=[];function r(d){f.camera=d,t.length=0,i.length=0,n.length=0}function o(d){t.push(d)}function a(d){i.push(d)}function l(d){n.push(d)}function c(){e.setup(t)}function h(d){e.setupView(t,d)}let f={lightsArray:t,shadowsArray:i,lightProbeGridArray:n,camera:null,lights:e,transmissionRenderTarget:{},textureUnits:0};return{init:r,state:f,setupLights:c,setupLightsView:h,pushLight:o,pushShadow:a,pushLightProbeGrid:l}}function zy(s){let e=new WeakMap;function t(n,r=0){let o=e.get(n),a;return o===void 0?(a=new Up(s),e.set(n,[a])):r>=o.length?(a=new Up(s),o.push(a)):a=o[r],a}function i(){e=new WeakMap}return{get:t,dispose:i}}var Hy=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Vy=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,Gy=[new D(1,0,0),new D(-1,0,0),new D(0,1,0),new D(0,-1,0),new D(0,0,1),new D(0,0,-1)],Wy=[new D(0,-1,0),new D(0,-1,0),new D(0,0,1),new D(0,0,-1),new D(0,-1,0),new D(0,-1,0)],Op=new We,Ko=new D,bu=new D;function Xy(s,e,t){let i=new lr,n=new ee,r=new ee,o=new ut,a=new dl,l=new fl,c={},h=t.maxTextureSize,f={[rn]:ti,[ti]:rn,[Dt]:Dt},d=new ct({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new ee},radius:{value:4}},vertexShader:Hy,fragmentShader:Vy}),u=d.clone();u.defines.HORIZONTAL_PASS=1;let p=new _t;p.setAttribute("position",new Ct(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let x=new De(p,d),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Zn;let g=this.type;this.render=function(E,A,y){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||E.length===0)return;this.type===Pf&&(Ge("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead."),this.type=Zn);let R=s.getRenderTarget(),I=s.getActiveCubeFace(),L=s.getActiveMipmapLevel(),b=s.state;b.setBlending(Bt),b.buffers.depth.getReversed()===!0?b.buffers.color.setClear(0,0,0,0):b.buffers.color.setClear(1,1,1,1),b.buffers.depth.setTest(!0),b.setScissorTest(!1);let w=g!==this.type;w&&A.traverse(function(P){P.material&&(Array.isArray(P.material)?P.material.forEach(U=>U.needsUpdate=!0):P.material.needsUpdate=!0)});for(let P=0,U=E.length;P<U;P++){let F=E[P],O=F.shadow;if(O===void 0){Ge("WebGLShadowMap:",F,"has no shadow.");continue}if(O.autoUpdate===!1&&O.needsUpdate===!1)continue;n.copy(O.mapSize);let z=O.getFrameExtents();n.multiply(z),r.copy(O.mapSize),(n.x>h||n.y>h)&&(n.x>h&&(r.x=Math.floor(h/z.x),n.x=r.x*z.x,O.mapSize.x=r.x),n.y>h&&(r.y=Math.floor(h/z.y),n.y=r.y*z.y,O.mapSize.y=r.y));let k=s.state.buffers.depth.getReversed();if(O.camera._reversedDepth=k,O.map===null||w===!0){if(O.map!==null&&(O.map.depthTexture!==null&&(O.map.depthTexture.dispose(),O.map.depthTexture=null),O.map.dispose()),this.type===gr){if(F.isPointLight){Ge("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}O.map=new dt(n.x,n.y,{format:$n,type:wt,minFilter:It,magFilter:It,generateMipmaps:!1}),O.map.texture.name=F.name+".shadowMap",O.map.depthTexture=new tn(n.x,n.y,wi),O.map.depthTexture.name=F.name+".shadowMapDepth",O.map.depthTexture.format=Ji,O.map.depthTexture.compareFunction=null,O.map.depthTexture.minFilter=bt,O.map.depthTexture.magFilter=bt}else F.isPointLight?(O.map=new gc(n.x),O.map.depthTexture=new rl(n.x,Wi)):(O.map=new dt(n.x,n.y),O.map.depthTexture=new tn(n.x,n.y,Wi)),O.map.depthTexture.name=F.name+".shadowMap",O.map.depthTexture.format=Ji,this.type===Zn?(O.map.depthTexture.compareFunction=k?fc:dc,O.map.depthTexture.minFilter=It,O.map.depthTexture.magFilter=It):(O.map.depthTexture.compareFunction=null,O.map.depthTexture.minFilter=bt,O.map.depthTexture.magFilter=bt);O.camera.updateProjectionMatrix()}O.map.isWebGLCubeRenderTarget!==!0&&(O.map.width!==n.x||O.map.height!==n.y)&&O.map.setSize(n.x,n.y);let G=O.map.isWebGLCubeRenderTarget?6:O.getViewportCount();F.isPointLight!==!0&&O.updateMatrices(F,y);for(let Y=0;Y<G;Y++){let he=O.getCamera(Y);if(F.isPointLight){let pe=O.camera,Te=O.matrix,Ee=F.distance||pe.far;Ee!==pe.far&&(pe.far=Ee,pe.updateProjectionMatrix()),Ko.setFromMatrixPosition(F.matrixWorld),pe.position.copy(Ko),bu.copy(pe.position),bu.add(Gy[Y]),pe.up.copy(Wy[Y]),pe.lookAt(bu),pe.updateMatrixWorld(),Te.makeTranslation(-Ko.x,-Ko.y,-Ko.z),Op.multiplyMatrices(pe.projectionMatrix,pe.matrixWorldInverse),O._frustum.setFromProjectionMatrix(Op,pe.coordinateSystem,pe.reversedDepth)}if(O.map.isWebGLCubeRenderTarget)s.setRenderTarget(O.map,Y),s.clear();else{Y===0&&(s.setRenderTarget(O.map),s.clear());let pe=O.getViewport(Y);o.set(r.x*pe.x,r.y*pe.y,r.x*pe.z,r.y*pe.w),b.viewport(o)}i=O.getFrustum(Y),_(A,y,he,F,this.type)}O.isPointLightShadow!==!0&&this.type===gr&&S(O,y),O.needsUpdate=!1}g=this.type,m.needsUpdate=!1,s.setRenderTarget(R,I,L)};function S(E,A){let y=e.update(x);d.defines.VSM_SAMPLES!==E.blurSamples&&(d.defines.VSM_SAMPLES=E.blurSamples,u.defines.VSM_SAMPLES=E.blurSamples,d.needsUpdate=!0,u.needsUpdate=!0),E.mapPass===null?E.mapPass=new dt(n.x,n.y,{format:$n,type:wt}):(E.mapPass.width!==E.map.width||E.mapPass.height!==E.map.height)&&E.mapPass.setSize(E.map.width,E.map.height),d.uniforms.shadow_pass.value=E.map.depthTexture,d.uniforms.resolution.value.set(E.map.width,E.map.height),d.uniforms.radius.value=E.radius,s.setRenderTarget(E.mapPass),s.clear(),s.renderBufferDirect(A,null,y,d,x,null),u.uniforms.shadow_pass.value=E.mapPass.texture,u.uniforms.resolution.value.set(E.map.width,E.map.height),u.uniforms.radius.value=E.radius,s.setRenderTarget(E.map),s.clear(),s.renderBufferDirect(A,null,y,u,x,null)}function T(E,A,y,R){let I=null,L=y.isPointLight===!0?E.customDistanceMaterial:E.customDepthMaterial;if(L!==void 0)I=L;else if(I=y.isPointLight===!0?l:a,s.localClippingEnabled&&A.clipShadows===!0&&Array.isArray(A.clippingPlanes)&&A.clippingPlanes.length!==0||A.displacementMap&&A.displacementScale!==0||A.alphaMap&&A.alphaTest>0||A.map&&A.alphaTest>0||A.alphaToCoverage===!0){let b=I.uuid,w=A.uuid,P=c[b];P===void 0&&(P={},c[b]=P);let U=P[w];U===void 0&&(U=I.clone(),P[w]=U,A.addEventListener("dispose",v)),I=U}if(I.visible=A.visible,I.wireframe=A.wireframe,R===gr?I.side=A.shadowSide!==null?A.shadowSide:A.side:I.side=A.shadowSide!==null?A.shadowSide:f[A.side],I.alphaMap=A.alphaMap,I.alphaTest=A.alphaToCoverage===!0?.5:A.alphaTest,I.map=A.map,I.clipShadows=A.clipShadows,I.clippingPlanes=A.clippingPlanes,I.clipIntersection=A.clipIntersection,I.displacementMap=A.displacementMap,I.displacementScale=A.displacementScale,I.displacementBias=A.displacementBias,I.wireframeLinewidth=A.wireframeLinewidth,I.linewidth=A.linewidth,y.isPointLight===!0&&I.isMeshDistanceMaterial===!0){let b=s.properties.get(I);b.light=y}return I}function _(E,A,y,R,I){if(E.visible===!1)return;if(E.layers.test(A.layers)&&(E.isMesh||E.isLine||E.isPoints)&&(E.castShadow||E.receiveShadow&&I===gr)&&(!E.frustumCulled||E.intersectsFrustum(i))){E.modelViewMatrix.multiplyMatrices(y.matrixWorldInverse,E.matrixWorld);let w=e.update(E),P=E.material;if(Array.isArray(P)){let U=w.groups;for(let F=0,O=U.length;F<O;F++){let z=U[F],k=P[z.materialIndex];if(k&&k.visible){let G=T(E,k,R,I);E.onBeforeShadow(s,E,A,y,w,G,z),s.renderBufferDirect(y,null,w,G,E,z),E.onAfterShadow(s,E,A,y,w,G,z)}}}else if(P.visible){let U=T(E,P,R,I);E.onBeforeShadow(s,E,A,y,w,U,null),s.renderBufferDirect(y,null,w,U,E,null),E.onAfterShadow(s,E,A,y,w,U,null)}}let b=E.children;for(let w=0,P=b.length;w<P;w++)_(b[w],A,y,R,I)}function v(E){E.target.removeEventListener("dispose",v);for(let y in c){let R=c[y],I=E.target.uuid;I in R&&(R[I].dispose(),delete R[I])}}}function qy(s,e){function t(){let V=!1,ve=new ut,ne=null,ye=new ut(0,0,0,0);return{setMask:function(Ae){ne!==Ae&&!V&&(s.colorMask(Ae,Ae,Ae,Ae),ne=Ae)},setLocked:function(Ae){V=Ae},setClear:function(Ae,ce,qe,He,Tt){Tt===!0&&(Ae*=He,ce*=He,qe*=He),ve.set(Ae,ce,qe,He),ye.equals(ve)===!1&&(s.clearColor(Ae,ce,qe,He),ye.copy(ve))},reset:function(){V=!1,ne=null,ye.set(-1,0,0,0)}}}function i(){let V=!1,ve=!1,ne=null,ye=null,Ae=null;return{setReversed:function(ce){if(ve!==ce){let qe=e.get("EXT_clip_control");ce?qe.clipControlEXT(qe.LOWER_LEFT_EXT,qe.ZERO_TO_ONE_EXT):qe.clipControlEXT(qe.LOWER_LEFT_EXT,qe.NEGATIVE_ONE_TO_ONE_EXT),ve=ce;let He=Ae;Ae=null,this.setClear(He)}},getReversed:function(){return ve},setTest:function(ce){ce?J(s.DEPTH_TEST):fe(s.DEPTH_TEST)},setMask:function(ce){ne!==ce&&!V&&(s.depthMask(ce),ne=ce)},setFunc:function(ce){if(ve&&(ce=ap[ce]),ye!==ce){switch(ce){case Ya:s.depthFunc(s.NEVER);break;case ja:s.depthFunc(s.ALWAYS);break;case Za:s.depthFunc(s.LESS);break;case Js:s.depthFunc(s.LEQUAL);break;case Ka:s.depthFunc(s.EQUAL);break;case Ja:s.depthFunc(s.GEQUAL);break;case Qa:s.depthFunc(s.GREATER);break;case $a:s.depthFunc(s.NOTEQUAL);break;default:s.depthFunc(s.LEQUAL)}ye=ce}},setLocked:function(ce){V=ce},setClear:function(ce){Ae!==ce&&(Ae=ce,ve&&(ce=1-ce),s.clearDepth(ce))},reset:function(){V=!1,ne=null,ye=null,Ae=null,ve=!1}}}function n(){let V=!1,ve=null,ne=null,ye=null,Ae=null,ce=null,qe=null,He=null,Tt=null;return{setTest:function(ft){V||(ft?J(s.STENCIL_TEST):fe(s.STENCIL_TEST))},setMask:function(ft){ve!==ft&&!V&&(s.stencilMask(ft),ve=ft)},setFunc:function(ft,Oi,qi){(ne!==ft||ye!==Oi||Ae!==qi)&&(s.stencilFunc(ft,Oi,qi),ne=ft,ye=Oi,Ae=qi)},setOp:function(ft,Oi,qi){(ce!==ft||qe!==Oi||He!==qi)&&(s.stencilOp(ft,Oi,qi),ce=ft,qe=Oi,He=qi)},setLocked:function(ft){V=ft},setClear:function(ft){Tt!==ft&&(s.clearStencil(ft),Tt=ft)},reset:function(){V=!1,ve=null,ne=null,ye=null,Ae=null,ce=null,qe=null,He=null,Tt=null}}}let r=new t,o=new i,a=new n,l=new WeakMap,c=new WeakMap,h={},f={},d={},u=new WeakMap,p=[],x=null,m=!1,g=null,S=null,T=null,_=null,v=null,E=null,A=null,y=new Me(0,0,0),R=0,I=!1,L=null,b=null,w=null,P=null,U=null,F=s.getParameter(s.MAX_COMBINED_TEXTURE_IMAGE_UNITS),O=!1,z=0,k=s.getParameter(s.VERSION);k.indexOf("WebGL")!==-1?(z=parseFloat(/^WebGL (\d)/.exec(k)[1]),O=z>=1):k.indexOf("OpenGL ES")!==-1&&(z=parseFloat(/^OpenGL ES (\d)/.exec(k)[1]),O=z>=2);let G=null,Y={},he=s.getParameter(s.SCISSOR_BOX),pe=s.getParameter(s.VIEWPORT),Te=new ut().fromArray(he),Ee=new ut().fromArray(pe);function Re(V,ve,ne,ye){let Ae=new Uint8Array(4),ce=s.createTexture();s.bindTexture(V,ce),s.texParameteri(V,s.TEXTURE_MIN_FILTER,s.NEAREST),s.texParameteri(V,s.TEXTURE_MAG_FILTER,s.NEAREST);for(let qe=0;qe<ne;qe++)V===s.TEXTURE_3D||V===s.TEXTURE_2D_ARRAY?s.texImage3D(ve,0,s.RGBA,1,1,ye,0,s.RGBA,s.UNSIGNED_BYTE,Ae):s.texImage2D(ve+qe,0,s.RGBA,1,1,0,s.RGBA,s.UNSIGNED_BYTE,Ae);return ce}let j={};j[s.TEXTURE_2D]=Re(s.TEXTURE_2D,s.TEXTURE_2D,1),j[s.TEXTURE_CUBE_MAP]=Re(s.TEXTURE_CUBE_MAP,s.TEXTURE_CUBE_MAP_POSITIVE_X,6),j[s.TEXTURE_2D_ARRAY]=Re(s.TEXTURE_2D_ARRAY,s.TEXTURE_2D_ARRAY,1,1),j[s.TEXTURE_3D]=Re(s.TEXTURE_3D,s.TEXTURE_3D,1,1),r.setClear(0,0,0,1),o.setClear(1),a.setClear(0),J(s.DEPTH_TEST),o.setFunc(Js),oe(!1),le(Xh),J(s.CULL_FACE),ae(Bt);function J(V){h[V]!==!0&&(s.enable(V),h[V]=!0)}function fe(V){h[V]!==!1&&(s.disable(V),h[V]=!1)}function Le(V,ve){return d[V]!==ve?(s.bindFramebuffer(V,ve),d[V]=ve,V===s.DRAW_FRAMEBUFFER&&(d[s.FRAMEBUFFER]=ve),V===s.FRAMEBUFFER&&(d[s.DRAW_FRAMEBUFFER]=ve),!0):!1}function _e(V,ve){let ne=p,ye=!1;if(V){ne=u.get(ve),ne===void 0&&(ne=[],u.set(ve,ne));let Ae=V.textures;if(ne.length!==Ae.length||ne[0]!==s.COLOR_ATTACHMENT0){for(let ce=0,qe=Ae.length;ce<qe;ce++)ne[ce]=s.COLOR_ATTACHMENT0+ce;ne.length=Ae.length,ye=!0}}else ne[0]!==s.BACK&&(ne[0]=s.BACK,ye=!0);ye&&s.drawBuffers(ne)}function ze(V){return x!==V?(s.useProgram(V),x=V,!0):!1}let et={[Ri]:s.FUNC_ADD,[Lf]:s.FUNC_SUBTRACT,[If]:s.FUNC_REVERSE_SUBTRACT};et[Df]=s.MIN,et[Nf]=s.MAX;let ie={[Ms]:s.ZERO,[Uf]:s.ONE,[Of]:s.SRC_COLOR,[jh]:s.SRC_ALPHA,[zf]:s.SRC_ALPHA_SATURATE,[Do]:s.DST_COLOR,[Io]:s.DST_ALPHA,[Ff]:s.ONE_MINUS_SRC_COLOR,[Zh]:s.ONE_MINUS_SRC_ALPHA,[kf]:s.ONE_MINUS_DST_COLOR,[Bf]:s.ONE_MINUS_DST_ALPHA,[Hf]:s.CONSTANT_COLOR,[Vf]:s.ONE_MINUS_CONSTANT_COLOR,[Gf]:s.CONSTANT_ALPHA,[Wf]:s.ONE_MINUS_CONSTANT_ALPHA};function ae(V,ve,ne,ye,Ae,ce,qe,He,Tt,ft){if(V===Bt){m===!0&&(fe(s.BLEND),m=!1);return}if(m===!1&&(J(s.BLEND),m=!0),V!==wl){if(V!==g||ft!==I){if((S!==Ri||v!==Ri)&&(s.blendEquation(s.FUNC_ADD),S=Ri,v=Ri),ft)switch(V){case xr:s.blendFuncSeparate(s.ONE,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case ys:s.blendFunc(s.ONE,s.ONE);break;case qh:s.blendFuncSeparate(s.ZERO,s.ONE_MINUS_SRC_COLOR,s.ZERO,s.ONE);break;case Yh:s.blendFuncSeparate(s.DST_COLOR,s.ONE_MINUS_SRC_ALPHA,s.ZERO,s.ONE);break;default:Ke("WebGLState: Invalid blending: ",V);break}else switch(V){case xr:s.blendFuncSeparate(s.SRC_ALPHA,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case ys:s.blendFuncSeparate(s.SRC_ALPHA,s.ONE,s.ONE,s.ONE);break;case qh:Ke("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Yh:Ke("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Ke("WebGLState: Invalid blending: ",V);break}T=null,_=null,E=null,A=null,y.set(0,0,0),R=0,g=V,I=ft}return}Ae=Ae||ve,ce=ce||ne,qe=qe||ye,(ve!==S||Ae!==v)&&(s.blendEquationSeparate(et[ve],et[Ae]),S=ve,v=Ae),(ne!==T||ye!==_||ce!==E||qe!==A)&&(s.blendFuncSeparate(ie[ne],ie[ye],ie[ce],ie[qe]),T=ne,_=ye,E=ce,A=qe),(He.equals(y)===!1||Tt!==R)&&(s.blendColor(He.r,He.g,He.b,Tt),y.copy(He),R=Tt),g=V,I=!1}function re(V,ve){V.side===Dt?fe(s.CULL_FACE):J(s.CULL_FACE);let ne=V.side===ti;ve&&(ne=!ne),oe(ne),V.blending===xr&&V.transparent===!1?ae(Bt):ae(V.blending,V.blendEquation,V.blendSrc,V.blendDst,V.blendEquationAlpha,V.blendSrcAlpha,V.blendDstAlpha,V.blendColor,V.blendAlpha,V.premultipliedAlpha),o.setFunc(V.depthFunc),o.setTest(V.depthTest),o.setMask(V.depthWrite),r.setMask(V.colorWrite);let ye=V.stencilWrite;a.setTest(ye),ye&&(a.setMask(V.stencilWriteMask),a.setFunc(V.stencilFunc,V.stencilRef,V.stencilFuncMask),a.setOp(V.stencilFail,V.stencilZFail,V.stencilZPass)),Ie(V.polygonOffset,V.polygonOffsetFactor,V.polygonOffsetUnits),V.alphaToCoverage===!0?J(s.SAMPLE_ALPHA_TO_COVERAGE):fe(s.SAMPLE_ALPHA_TO_COVERAGE)}function oe(V){L!==V&&(V?s.frontFace(s.CW):s.frontFace(s.CCW),L=V)}function le(V){V!==Cf?(J(s.CULL_FACE),V!==b&&(V===Xh?s.cullFace(s.BACK):V===Rf?s.cullFace(s.FRONT):s.cullFace(s.FRONT_AND_BACK))):fe(s.CULL_FACE),b=V}function ke(V){V!==w&&(O&&s.lineWidth(V),w=V)}function Ie(V,ve,ne){V?(J(s.POLYGON_OFFSET_FILL),(P!==ve||U!==ne)&&(P=ve,U=ne,o.getReversed()&&(ve=-ve),s.polygonOffset(ve,ne))):fe(s.POLYGON_OFFSET_FILL)}function Ue(V){V?J(s.SCISSOR_TEST):fe(s.SCISSOR_TEST)}function je(V){V===void 0&&(V=s.TEXTURE0+F-1),G!==V&&(s.activeTexture(V),G=V)}function B(V,ve,ne){ne===void 0&&(G===null?ne=s.TEXTURE0+F-1:ne=G);let ye=Y[ne];ye===void 0&&(ye={type:void 0,texture:void 0},Y[ne]=ye),(ye.type!==V||ye.texture!==ve)&&(G!==ne&&(s.activeTexture(ne),G=ne),s.bindTexture(V,ve||j[V]),ye.type=V,ye.texture=ve)}function $e(){let V=Y[G];V!==void 0&&V.type!==void 0&&(s.bindTexture(V.type,null),V.type=void 0,V.texture=void 0)}function Ze(){try{s.compressedTexImage2D(...arguments)}catch(V){Ke("WebGLState:",V)}}function N(){try{s.compressedTexImage3D(...arguments)}catch(V){Ke("WebGLState:",V)}}function M(){try{s.texSubImage2D(...arguments)}catch(V){Ke("WebGLState:",V)}}function W(){try{s.texSubImage3D(...arguments)}catch(V){Ke("WebGLState:",V)}}function X(){try{s.compressedTexSubImage2D(...arguments)}catch(V){Ke("WebGLState:",V)}}function q(){try{s.compressedTexSubImage3D(...arguments)}catch(V){Ke("WebGLState:",V)}}function ue(){try{s.texStorage2D(...arguments)}catch(V){Ke("WebGLState:",V)}}function de(){try{s.texStorage3D(...arguments)}catch(V){Ke("WebGLState:",V)}}function $(){try{s.texImage2D(...arguments)}catch(V){Ke("WebGLState:",V)}}function te(){try{s.texImage3D(...arguments)}catch(V){Ke("WebGLState:",V)}}function ge(V){return f[V]!==void 0?f[V]:s.getParameter(V)}function Oe(V,ve){f[V]!==ve&&(s.pixelStorei(V,ve),f[V]=ve)}function xe(V){Te.equals(V)===!1&&(s.scissor(V.x,V.y,V.z,V.w),Te.copy(V))}function me(V){Ee.equals(V)===!1&&(s.viewport(V.x,V.y,V.z,V.w),Ee.copy(V))}function Ne(V,ve){let ne=c.get(ve);ne===void 0&&(ne=new WeakMap,c.set(ve,ne));let ye=ne.get(V);ye===void 0&&(ye=s.getUniformBlockIndex(ve,V.name),ne.set(V,ye))}function Xe(V,ve){let ye=c.get(ve).get(V);l.get(ve)!==ye&&(s.uniformBlockBinding(ve,ye,V.__bindingPointIndex),l.set(ve,ye))}function Je(){s.disable(s.BLEND),s.disable(s.CULL_FACE),s.disable(s.DEPTH_TEST),s.disable(s.POLYGON_OFFSET_FILL),s.disable(s.SCISSOR_TEST),s.disable(s.STENCIL_TEST),s.disable(s.SAMPLE_ALPHA_TO_COVERAGE),s.blendEquation(s.FUNC_ADD),s.blendFunc(s.ONE,s.ZERO),s.blendFuncSeparate(s.ONE,s.ZERO,s.ONE,s.ZERO),s.blendColor(0,0,0,0),s.colorMask(!0,!0,!0,!0),s.clearColor(0,0,0,0),s.depthMask(!0),s.depthFunc(s.LESS),o.setReversed(!1),s.clearDepth(1),s.stencilMask(4294967295),s.stencilFunc(s.ALWAYS,0,4294967295),s.stencilOp(s.KEEP,s.KEEP,s.KEEP),s.clearStencil(0),s.cullFace(s.BACK),s.frontFace(s.CCW),s.polygonOffset(0,0),s.activeTexture(s.TEXTURE0),s.bindFramebuffer(s.FRAMEBUFFER,null),s.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),s.bindFramebuffer(s.READ_FRAMEBUFFER,null),s.useProgram(null),s.lineWidth(1),s.scissor(0,0,s.canvas.width,s.canvas.height),s.viewport(0,0,s.canvas.width,s.canvas.height),s.pixelStorei(s.PACK_ALIGNMENT,4),s.pixelStorei(s.UNPACK_ALIGNMENT,4),s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,!1),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,s.BROWSER_DEFAULT_WEBGL),s.pixelStorei(s.PACK_ROW_LENGTH,0),s.pixelStorei(s.PACK_SKIP_PIXELS,0),s.pixelStorei(s.PACK_SKIP_ROWS,0),s.pixelStorei(s.UNPACK_ROW_LENGTH,0),s.pixelStorei(s.UNPACK_IMAGE_HEIGHT,0),s.pixelStorei(s.UNPACK_SKIP_PIXELS,0),s.pixelStorei(s.UNPACK_SKIP_ROWS,0),s.pixelStorei(s.UNPACK_SKIP_IMAGES,0),h={},f={},G=null,Y={},d={},u=new WeakMap,p=[],x=null,m=!1,g=null,S=null,T=null,_=null,v=null,E=null,A=null,y=new Me(0,0,0),R=0,I=!1,L=null,b=null,w=null,P=null,U=null,Te.set(0,0,s.canvas.width,s.canvas.height),Ee.set(0,0,s.canvas.width,s.canvas.height),r.reset(),o.reset(),a.reset()}return{buffers:{color:r,depth:o,stencil:a},enable:J,disable:fe,bindFramebuffer:Le,drawBuffers:_e,useProgram:ze,setBlending:ae,setMaterial:re,setFlipSided:oe,setCullFace:le,setLineWidth:ke,setPolygonOffset:Ie,setScissorTest:Ue,activeTexture:je,bindTexture:B,unbindTexture:$e,compressedTexImage2D:Ze,compressedTexImage3D:N,texImage2D:$,texImage3D:te,pixelStorei:Oe,getParameter:ge,updateUBOMapping:Ne,uniformBlockBinding:Xe,texStorage2D:ue,texStorage3D:de,texSubImage2D:M,texSubImage3D:W,compressedTexSubImage2D:X,compressedTexSubImage3D:q,scissor:xe,viewport:me,reset:Je}}function Yy(s,e,t,i,n,r,o){let a=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new ee,h=new WeakMap,f=new Set,d,u=new WeakMap,p=!1;try{p=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function x(N,M){return p?new OffscreenCanvas(N,M):er("canvas")}function m(N,M,W){let X=1,q=Ze(N);if((q.width>W||q.height>W)&&(X=W/Math.max(q.width,q.height)),X<1)if(typeof HTMLImageElement<"u"&&N instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&N instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&N instanceof ImageBitmap||typeof VideoFrame<"u"&&N instanceof VideoFrame){let ue=Math.floor(X*q.width),de=Math.floor(X*q.height);d===void 0&&(d=x(ue,de));let $=M?x(ue,de):d;return $.width=ue,$.height=de,$.getContext("2d").drawImage(N,0,0,ue,de),Ge("WebGLRenderer: Texture has been resized from ("+q.width+"x"+q.height+") to ("+ue+"x"+de+")."),$}else return"data"in N&&Ge("WebGLRenderer: Image in DataTexture is too big ("+q.width+"x"+q.height+")."),N;return N}function g(N){return N.generateMipmaps}function S(N){s.generateMipmap(N)}function T(N){return N.isWebGLCubeRenderTarget?s.TEXTURE_CUBE_MAP:N.isWebGL3DRenderTarget?s.TEXTURE_3D:N.isWebGLArrayRenderTarget||N.isCompressedArrayTexture?s.TEXTURE_2D_ARRAY:s.TEXTURE_2D}function _(N,M,W,X,q,ue=!1){if(N!==null){if(s[N]!==void 0)return s[N];Ge("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+N+"'")}let de;X&&(de=e.get("EXT_texture_norm16"),de||Ge("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let $=M;if(M===s.RED&&(W===s.FLOAT&&($=s.R32F),W===s.HALF_FLOAT&&($=s.R16F),W===s.UNSIGNED_BYTE&&($=s.R8),W===s.UNSIGNED_SHORT&&de&&($=de.R16_EXT),W===s.SHORT&&de&&($=de.R16_SNORM_EXT)),M===s.RED_INTEGER&&(W===s.UNSIGNED_BYTE&&($=s.R8UI),W===s.UNSIGNED_SHORT&&($=s.R16UI),W===s.UNSIGNED_INT&&($=s.R32UI),W===s.BYTE&&($=s.R8I),W===s.SHORT&&($=s.R16I),W===s.INT&&($=s.R32I)),M===s.RG&&(W===s.FLOAT&&($=s.RG32F),W===s.HALF_FLOAT&&($=s.RG16F),W===s.UNSIGNED_BYTE&&($=s.RG8),W===s.UNSIGNED_SHORT&&de&&($=de.RG16_EXT),W===s.SHORT&&de&&($=de.RG16_SNORM_EXT)),M===s.RG_INTEGER&&(W===s.UNSIGNED_BYTE&&($=s.RG8UI),W===s.UNSIGNED_SHORT&&($=s.RG16UI),W===s.UNSIGNED_INT&&($=s.RG32UI),W===s.BYTE&&($=s.RG8I),W===s.SHORT&&($=s.RG16I),W===s.INT&&($=s.RG32I)),M===s.RGB_INTEGER&&(W===s.UNSIGNED_BYTE&&($=s.RGB8UI),W===s.UNSIGNED_SHORT&&($=s.RGB16UI),W===s.UNSIGNED_INT&&($=s.RGB32UI),W===s.BYTE&&($=s.RGB8I),W===s.SHORT&&($=s.RGB16I),W===s.INT&&($=s.RGB32I)),M===s.RGBA_INTEGER&&(W===s.UNSIGNED_BYTE&&($=s.RGBA8UI),W===s.UNSIGNED_SHORT&&($=s.RGBA16UI),W===s.UNSIGNED_INT&&($=s.RGBA32UI),W===s.BYTE&&($=s.RGBA8I),W===s.SHORT&&($=s.RGBA16I),W===s.INT&&($=s.RGBA32I)),M===s.RGB&&(W===s.UNSIGNED_SHORT&&de&&($=de.RGB16_EXT),W===s.SHORT&&de&&($=de.RGB16_SNORM_EXT),W===s.UNSIGNED_INT_5_9_9_9_REV&&($=s.RGB9_E5),W===s.UNSIGNED_INT_10F_11F_11F_REV&&($=s.R11F_G11F_B10F)),M===s.RGBA){let te=ue?Jr:tt.getTransfer(q);W===s.FLOAT&&($=s.RGBA32F),W===s.HALF_FLOAT&&($=s.RGBA16F),W===s.UNSIGNED_BYTE&&($=te===ht?s.SRGB8_ALPHA8:s.RGBA8),W===s.UNSIGNED_SHORT&&de&&($=de.RGBA16_EXT),W===s.SHORT&&de&&($=de.RGBA16_SNORM_EXT),W===s.UNSIGNED_SHORT_4_4_4_4&&($=s.RGBA4),W===s.UNSIGNED_SHORT_5_5_5_1&&($=s.RGB5_A1)}return($===s.R16F||$===s.R32F||$===s.RG16F||$===s.RG32F||$===s.RGBA16F||$===s.RGBA32F)&&e.get("EXT_color_buffer_float"),$}function v(N,M){let W;return N?M===null||M===Wi||M===Qn?W=s.DEPTH24_STENCIL8:M===wi?W=s.DEPTH32F_STENCIL8:M===vr&&(W=s.DEPTH24_STENCIL8,Ge("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):M===null||M===Wi||M===Qn?W=s.DEPTH_COMPONENT24:M===wi?W=s.DEPTH_COMPONENT32F:M===vr&&(W=s.DEPTH_COMPONENT16),W}function E(N,M){return g(N)===!0||N.isFramebufferTexture&&N.minFilter!==bt&&N.minFilter!==It?Math.log2(Math.max(M.width,M.height))+1:N.mipmaps!==void 0&&N.mipmaps.length>0?N.mipmaps.length:N.isCompressedTexture&&Array.isArray(N.image)?M.mipmaps.length:1}function A(N){let M=N.target;M.removeEventListener("dispose",A),R(M),M.isVideoTexture&&h.delete(M),M.isHTMLTexture&&f.delete(M)}function y(N){let M=N.target;M.removeEventListener("dispose",y),L(M)}function R(N){let M=i.get(N);if(M.__webglInit===void 0)return;let W=N.source,X=u.get(W);if(X){let q=X[M.__cacheKey];q.usedTimes--,q.usedTimes===0&&I(N),Object.keys(X).length===0&&u.delete(W)}i.remove(N)}function I(N){let M=i.get(N);s.deleteTexture(M.__webglTexture);let W=N.source,X=u.get(W);delete X[M.__cacheKey],o.memory.textures--}function L(N){let M=i.get(N);if(N.depthTexture&&(N.depthTexture.dispose(),i.remove(N.depthTexture)),N.isWebGLCubeRenderTarget)for(let X=0;X<6;X++){if(Array.isArray(M.__webglFramebuffer[X]))for(let q=0;q<M.__webglFramebuffer[X].length;q++)s.deleteFramebuffer(M.__webglFramebuffer[X][q]);else s.deleteFramebuffer(M.__webglFramebuffer[X]);M.__webglDepthbuffer&&s.deleteRenderbuffer(M.__webglDepthbuffer[X])}else{if(Array.isArray(M.__webglFramebuffer))for(let X=0;X<M.__webglFramebuffer.length;X++)s.deleteFramebuffer(M.__webglFramebuffer[X]);else s.deleteFramebuffer(M.__webglFramebuffer);if(M.__webglDepthbuffer&&s.deleteRenderbuffer(M.__webglDepthbuffer),M.__webglMultisampledFramebuffer&&s.deleteFramebuffer(M.__webglMultisampledFramebuffer),M.__webglColorRenderbuffer)for(let X=0;X<M.__webglColorRenderbuffer.length;X++)M.__webglColorRenderbuffer[X]&&s.deleteRenderbuffer(M.__webglColorRenderbuffer[X]);M.__webglDepthRenderbuffer&&s.deleteRenderbuffer(M.__webglDepthRenderbuffer)}let W=N.textures;for(let X=0,q=W.length;X<q;X++){let ue=i.get(W[X]);ue.__webglTexture&&(s.deleteTexture(ue.__webglTexture),o.memory.textures--),i.remove(W[X])}i.remove(N)}let b=0;function w(){b=0}function P(){return b}function U(N){b=N}function F(){let N=b;return N>=n.maxTextures&&Ge("WebGLTextures: Trying to use "+(N+1)+" texture units while this GPU supports only "+n.maxTextures),b+=1,N}function O(N){let M=[];return M.push(N.wrapS),M.push(N.wrapT),M.push(N.wrapR||0),M.push(N.magFilter),M.push(N.minFilter),M.push(N.anisotropy),M.push(N.internalFormat),M.push(N.format),M.push(N.type),M.push(N.generateMipmaps),M.push(N.premultiplyAlpha),M.push(N.flipY),M.push(N.unpackAlignment),M.push(N.colorSpace),M.join()}function z(N,M){let W=i.get(N);if(N.isVideoTexture&&B(N),N.isRenderTargetTexture===!1&&N.isExternalTexture!==!0&&N.version>0&&W.__version!==N.version){let X=N.image;if(X===null)Ge("WebGLRenderer: Texture marked for update but no image data found.");else if(X.complete===!1)Ge("WebGLRenderer: Texture marked for update but image is incomplete");else{fe(W,N,M);return}}else N.isExternalTexture&&(W.__webglTexture=N.sourceTexture?N.sourceTexture:null);t.bindTexture(s.TEXTURE_2D,W.__webglTexture,s.TEXTURE0+M)}function k(N,M){let W=i.get(N);if(N.isRenderTargetTexture===!1&&N.version>0&&W.__version!==N.version){fe(W,N,M);return}else N.isExternalTexture&&(W.__webglTexture=N.sourceTexture?N.sourceTexture:null);t.bindTexture(s.TEXTURE_2D_ARRAY,W.__webglTexture,s.TEXTURE0+M)}function G(N,M){let W=i.get(N);if(N.isRenderTargetTexture===!1&&N.version>0&&W.__version!==N.version){fe(W,N,M);return}t.bindTexture(s.TEXTURE_3D,W.__webglTexture,s.TEXTURE0+M)}function Y(N,M){let W=i.get(N);if(N.isCubeDepthTexture!==!0&&N.version>0&&W.__version!==N.version){Le(W,N,M);return}t.bindTexture(s.TEXTURE_CUBE_MAP,W.__webglTexture,s.TEXTURE0+M)}let he={[Xt]:s.REPEAT,[pi]:s.CLAMP_TO_EDGE,[Qs]:s.MIRRORED_REPEAT},pe={[bt]:s.NEAREST,[Cl]:s.NEAREST_MIPMAP_NEAREST,[Ss]:s.NEAREST_MIPMAP_LINEAR,[It]:s.LINEAR,[_r]:s.LINEAR_MIPMAP_NEAREST,[Gi]:s.LINEAR_MIPMAP_LINEAR},Te={[Qf]:s.NEVER,[np]:s.ALWAYS,[$f]:s.LESS,[dc]:s.LEQUAL,[ep]:s.EQUAL,[fc]:s.GEQUAL,[tp]:s.GREATER,[ip]:s.NOTEQUAL};function Ee(N,M){if(M.type===wi&&e.has("OES_texture_float_linear")===!1&&(M.magFilter===It||M.magFilter===_r||M.magFilter===Ss||M.magFilter===Gi||M.minFilter===It||M.minFilter===_r||M.minFilter===Ss||M.minFilter===Gi)&&Ge("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),s.texParameteri(N,s.TEXTURE_WRAP_S,he[M.wrapS]),s.texParameteri(N,s.TEXTURE_WRAP_T,he[M.wrapT]),(N===s.TEXTURE_3D||N===s.TEXTURE_2D_ARRAY)&&s.texParameteri(N,s.TEXTURE_WRAP_R,he[M.wrapR]),s.texParameteri(N,s.TEXTURE_MAG_FILTER,pe[M.magFilter]),s.texParameteri(N,s.TEXTURE_MIN_FILTER,pe[M.minFilter]),M.compareFunction&&(s.texParameteri(N,s.TEXTURE_COMPARE_MODE,s.COMPARE_REF_TO_TEXTURE),s.texParameteri(N,s.TEXTURE_COMPARE_FUNC,Te[M.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(M.magFilter===bt||M.minFilter!==Ss&&M.minFilter!==Gi||M.type===wi&&e.has("OES_texture_float_linear")===!1)return;if(M.anisotropy>1||i.get(M).__currentAnisotropy){let W=e.get("EXT_texture_filter_anisotropic");s.texParameterf(N,W.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(M.anisotropy,n.getMaxAnisotropy())),i.get(M).__currentAnisotropy=M.anisotropy}}}function Re(N,M){let W=!1;N.__webglInit===void 0&&(N.__webglInit=!0,M.addEventListener("dispose",A));let X=M.source,q=u.get(X);q===void 0&&(q={},u.set(X,q));let ue=O(M);if(ue!==N.__cacheKey){q[ue]===void 0&&(q[ue]={texture:s.createTexture(),usedTimes:0},o.memory.textures++,W=!0),q[ue].usedTimes++;let de=q[N.__cacheKey];de!==void 0&&(q[N.__cacheKey].usedTimes--,de.usedTimes===0&&I(M)),N.__cacheKey=ue,N.__webglTexture=q[ue].texture}return W}function j(N,M,W){return Math.floor(Math.floor(N/W)/M)}function J(N,M,W,X){let ue=N.updateRanges;if(ue.length===0)t.texSubImage2D(s.TEXTURE_2D,0,0,0,M.width,M.height,W,X,M.data);else{ue.sort((Oe,xe)=>Oe.start-xe.start);let de=0;for(let Oe=1;Oe<ue.length;Oe++){let xe=ue[de],me=ue[Oe],Ne=xe.start+xe.count,Xe=j(me.start,M.width,4),Je=j(xe.start,M.width,4);me.start<=Ne+1&&Xe===Je&&j(me.start+me.count-1,M.width,4)===Xe?xe.count=Math.max(xe.count,me.start+me.count-xe.start):(++de,ue[de]=me)}ue.length=de+1;let $=t.getParameter(s.UNPACK_ROW_LENGTH),te=t.getParameter(s.UNPACK_SKIP_PIXELS),ge=t.getParameter(s.UNPACK_SKIP_ROWS);t.pixelStorei(s.UNPACK_ROW_LENGTH,M.width);for(let Oe=0,xe=ue.length;Oe<xe;Oe++){let me=ue[Oe],Ne=Math.floor(me.start/4),Xe=Math.ceil(me.count/4),Je=Ne%M.width,V=Math.floor(Ne/M.width),ve=Xe,ne=1;t.pixelStorei(s.UNPACK_SKIP_PIXELS,Je),t.pixelStorei(s.UNPACK_SKIP_ROWS,V),t.texSubImage2D(s.TEXTURE_2D,0,Je,V,ve,ne,W,X,M.data)}N.clearUpdateRanges(),t.pixelStorei(s.UNPACK_ROW_LENGTH,$),t.pixelStorei(s.UNPACK_SKIP_PIXELS,te),t.pixelStorei(s.UNPACK_SKIP_ROWS,ge)}}function fe(N,M,W){let X=s.TEXTURE_2D;(M.isDataArrayTexture||M.isCompressedArrayTexture)&&(X=s.TEXTURE_2D_ARRAY),M.isData3DTexture&&(X=s.TEXTURE_3D);let q=Re(N,M),ue=M.source;t.bindTexture(X,N.__webglTexture,s.TEXTURE0+W);let de=i.get(ue);if(ue.version!==de.__version||q===!0){if(t.activeTexture(s.TEXTURE0+W),(typeof ImageBitmap<"u"&&M.image instanceof ImageBitmap)===!1){let ne=tt.getPrimaries(tt.workingColorSpace),ye=M.colorSpace===Pi?null:tt.getPrimaries(M.colorSpace),Ae=M.colorSpace===Pi||ne===ye?s.NONE:s.BROWSER_DEFAULT_WEBGL;t.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,M.flipY),t.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,M.premultiplyAlpha),t.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,Ae)}t.pixelStorei(s.UNPACK_ALIGNMENT,M.unpackAlignment);let te=m(M.image,!1,n.maxTextureSize);te=$e(M,te);let ge=r.convert(M.format,M.colorSpace),Oe=r.convert(M.type),xe=_(M.internalFormat,ge,Oe,M.normalized,M.colorSpace,M.isVideoTexture);Ee(X,M);let me,Ne=M.mipmaps,Xe=M.isVideoTexture!==!0,Je=de.__version===void 0||q===!0,V=ue.dataReady,ve=E(M,te);if(M.isDepthTexture)xe=v(M.format===on,M.type),Je&&(Xe?t.texStorage2D(s.TEXTURE_2D,1,xe,te.width,te.height):t.texImage2D(s.TEXTURE_2D,0,xe,te.width,te.height,0,ge,Oe,null));else if(M.isDataTexture)if(Ne.length>0){Xe&&Je&&t.texStorage2D(s.TEXTURE_2D,ve,xe,Ne[0].width,Ne[0].height);for(let ne=0,ye=Ne.length;ne<ye;ne++)me=Ne[ne],Xe?V&&t.texSubImage2D(s.TEXTURE_2D,ne,0,0,me.width,me.height,ge,Oe,me.data):t.texImage2D(s.TEXTURE_2D,ne,xe,me.width,me.height,0,ge,Oe,me.data);M.generateMipmaps=!1}else Xe?(Je&&t.texStorage2D(s.TEXTURE_2D,ve,xe,te.width,te.height),V&&J(M,te,ge,Oe)):t.texImage2D(s.TEXTURE_2D,0,xe,te.width,te.height,0,ge,Oe,te.data);else if(M.isCompressedTexture)if(M.isCompressedArrayTexture){Xe&&Je&&t.texStorage3D(s.TEXTURE_2D_ARRAY,ve,xe,Ne[0].width,Ne[0].height,te.depth);for(let ne=0,ye=Ne.length;ne<ye;ne++)if(me=Ne[ne],M.format!==fi)if(ge!==null)if(Xe){if(V)if(M.layerUpdates.size>0){let Ae=uu(me.width,me.height,M.format,M.type);for(let ce of M.layerUpdates){let qe=me.data.subarray(ce*Ae/me.data.BYTES_PER_ELEMENT,(ce+1)*Ae/me.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(s.TEXTURE_2D_ARRAY,ne,0,0,ce,me.width,me.height,1,ge,qe)}}else t.compressedTexSubImage3D(s.TEXTURE_2D_ARRAY,ne,0,0,0,me.width,me.height,te.depth,ge,me.data)}else t.compressedTexImage3D(s.TEXTURE_2D_ARRAY,ne,xe,me.width,me.height,te.depth,0,me.data,0,0);else Ge("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Xe?V&&t.texSubImage3D(s.TEXTURE_2D_ARRAY,ne,0,0,0,me.width,me.height,te.depth,ge,Oe,me.data):t.texImage3D(s.TEXTURE_2D_ARRAY,ne,xe,me.width,me.height,te.depth,0,ge,Oe,me.data);M.layerUpdates.size>0&&M.clearLayerUpdates()}else{Xe&&Je&&t.texStorage2D(s.TEXTURE_2D,ve,xe,Ne[0].width,Ne[0].height);for(let ne=0,ye=Ne.length;ne<ye;ne++)me=Ne[ne],M.format!==fi?ge!==null?Xe?V&&t.compressedTexSubImage2D(s.TEXTURE_2D,ne,0,0,me.width,me.height,ge,me.data):t.compressedTexImage2D(s.TEXTURE_2D,ne,xe,me.width,me.height,0,me.data):Ge("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Xe?V&&t.texSubImage2D(s.TEXTURE_2D,ne,0,0,me.width,me.height,ge,Oe,me.data):t.texImage2D(s.TEXTURE_2D,ne,xe,me.width,me.height,0,ge,Oe,me.data)}else if(M.isDataArrayTexture)if(Xe){if(Je&&t.texStorage3D(s.TEXTURE_2D_ARRAY,ve,xe,te.width,te.height,te.depth),V)if(M.layerUpdates.size>0){let ne=uu(te.width,te.height,M.format,M.type);for(let ye of M.layerUpdates){let Ae=te.data.subarray(ye*ne/te.data.BYTES_PER_ELEMENT,(ye+1)*ne/te.data.BYTES_PER_ELEMENT);t.texSubImage3D(s.TEXTURE_2D_ARRAY,0,0,0,ye,te.width,te.height,1,ge,Oe,Ae)}M.clearLayerUpdates()}else t.texSubImage3D(s.TEXTURE_2D_ARRAY,0,0,0,0,te.width,te.height,te.depth,ge,Oe,te.data)}else t.texImage3D(s.TEXTURE_2D_ARRAY,0,xe,te.width,te.height,te.depth,0,ge,Oe,te.data);else if(M.isData3DTexture)Xe?(Je&&t.texStorage3D(s.TEXTURE_3D,ve,xe,te.width,te.height,te.depth),V&&t.texSubImage3D(s.TEXTURE_3D,0,0,0,0,te.width,te.height,te.depth,ge,Oe,te.data)):t.texImage3D(s.TEXTURE_3D,0,xe,te.width,te.height,te.depth,0,ge,Oe,te.data);else if(M.isFramebufferTexture){if(Je)if(Xe)t.texStorage2D(s.TEXTURE_2D,ve,xe,te.width,te.height);else{let ne=te.width,ye=te.height;for(let Ae=0;Ae<ve;Ae++)t.texImage2D(s.TEXTURE_2D,Ae,xe,ne,ye,0,ge,Oe,null),ne>>=1,ye>>=1}}else if(M.isHTMLTexture){if("texElementImage2D"in s){let ne=s.canvas;if(ne.hasAttribute("layoutsubtree")||ne.setAttribute("layoutsubtree","true"),te.parentNode!==ne){ne.appendChild(te),f.add(M),ne.onpaint=ye=>{let Ae=ye.changedElements;for(let ce of f)Ae.includes(ce.image)&&(ce.needsUpdate=!0)},ne.requestPaint();return}if(s.texElementImage2D.length===3)s.texElementImage2D(s.TEXTURE_2D,s.RGBA8,te);else{let Ae=s.RGBA,ce=s.RGBA,qe=s.UNSIGNED_BYTE;s.texElementImage2D(s.TEXTURE_2D,0,Ae,ce,qe,te)}s.texParameteri(s.TEXTURE_2D,s.TEXTURE_MIN_FILTER,s.LINEAR),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_S,s.CLAMP_TO_EDGE),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_T,s.CLAMP_TO_EDGE)}}else if(Ne.length>0){if(Xe&&Je){let ne=Ze(Ne[0]);t.texStorage2D(s.TEXTURE_2D,ve,xe,ne.width,ne.height)}for(let ne=0,ye=Ne.length;ne<ye;ne++)me=Ne[ne],Xe?V&&t.texSubImage2D(s.TEXTURE_2D,ne,0,0,ge,Oe,me):t.texImage2D(s.TEXTURE_2D,ne,xe,ge,Oe,me);M.generateMipmaps=!1}else if(Xe){if(Je){let ne=Ze(te);t.texStorage2D(s.TEXTURE_2D,ve,xe,ne.width,ne.height)}V&&t.texSubImage2D(s.TEXTURE_2D,0,0,0,ge,Oe,te)}else t.texImage2D(s.TEXTURE_2D,0,xe,ge,Oe,te);g(M)&&S(X),de.__version=ue.version,M.onUpdate&&M.onUpdate(M)}N.__version=M.version}function Le(N,M,W){if(M.image.length!==6)return;let X=Re(N,M),q=M.source;t.bindTexture(s.TEXTURE_CUBE_MAP,N.__webglTexture,s.TEXTURE0+W);let ue=i.get(q);if(q.version!==ue.__version||X===!0){t.activeTexture(s.TEXTURE0+W);let de=tt.getPrimaries(tt.workingColorSpace),$=M.colorSpace===Pi?null:tt.getPrimaries(M.colorSpace),te=M.colorSpace===Pi||de===$?s.NONE:s.BROWSER_DEFAULT_WEBGL;t.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,M.flipY),t.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,M.premultiplyAlpha),t.pixelStorei(s.UNPACK_ALIGNMENT,M.unpackAlignment),t.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,te);let ge=M.isCompressedTexture||M.image[0].isCompressedTexture,Oe=M.image[0]&&M.image[0].isDataTexture,xe=[];for(let ce=0;ce<6;ce++)!ge&&!Oe?xe[ce]=m(M.image[ce],!0,n.maxCubemapSize):xe[ce]=Oe?M.image[ce].image:M.image[ce],xe[ce]=$e(M,xe[ce]);let me=xe[0],Ne=r.convert(M.format,M.colorSpace),Xe=r.convert(M.type),Je=_(M.internalFormat,Ne,Xe,M.normalized,M.colorSpace),V=M.isVideoTexture!==!0,ve=ue.__version===void 0||X===!0,ne=q.dataReady,ye=E(M,me);Ee(s.TEXTURE_CUBE_MAP,M);let Ae;if(ge){V&&ve&&t.texStorage2D(s.TEXTURE_CUBE_MAP,ye,Je,me.width,me.height);for(let ce=0;ce<6;ce++){Ae=xe[ce].mipmaps;for(let qe=0;qe<Ae.length;qe++){let He=Ae[qe];M.format!==fi?Ne!==null?V?ne&&t.compressedTexSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,qe,0,0,He.width,He.height,Ne,He.data):t.compressedTexImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,qe,Je,He.width,He.height,0,He.data):Ge("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):V?ne&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,qe,0,0,He.width,He.height,Ne,Xe,He.data):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,qe,Je,He.width,He.height,0,Ne,Xe,He.data)}}}else{if(Ae=M.mipmaps,V&&ve){Ae.length>0&&ye++;let ce=Ze(xe[0]);t.texStorage2D(s.TEXTURE_CUBE_MAP,ye,Je,ce.width,ce.height)}for(let ce=0;ce<6;ce++)if(Oe){V?ne&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,0,0,0,xe[ce].width,xe[ce].height,Ne,Xe,xe[ce].data):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,0,Je,xe[ce].width,xe[ce].height,0,Ne,Xe,xe[ce].data);for(let qe=0;qe<Ae.length;qe++){let Tt=Ae[qe].image[ce].image;V?ne&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,qe+1,0,0,Tt.width,Tt.height,Ne,Xe,Tt.data):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,qe+1,Je,Tt.width,Tt.height,0,Ne,Xe,Tt.data)}}else{V?ne&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,0,0,0,Ne,Xe,xe[ce]):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,0,Je,Ne,Xe,xe[ce]);for(let qe=0;qe<Ae.length;qe++){let He=Ae[qe];V?ne&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,qe+1,0,0,Ne,Xe,He.image[ce]):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,qe+1,Je,Ne,Xe,He.image[ce])}}}g(M)&&S(s.TEXTURE_CUBE_MAP),ue.__version=q.version,M.onUpdate&&M.onUpdate(M)}N.__version=M.version}function _e(N,M,W,X,q,ue){let de=r.convert(W.format,W.colorSpace),$=r.convert(W.type),te=_(W.internalFormat,de,$,W.normalized,W.colorSpace),ge=i.get(M),Oe=i.get(W);if(Oe.__renderTarget=M,!ge.__hasExternalTextures){let xe=Math.max(1,M.width>>ue),me=Math.max(1,M.height>>ue);q===s.TEXTURE_3D||q===s.TEXTURE_2D_ARRAY?t.texImage3D(q,ue,te,xe,me,M.depth,0,de,$,null):t.texImage2D(q,ue,te,xe,me,0,de,$,null)}t.bindFramebuffer(s.FRAMEBUFFER,N),je(M)?a.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,X,q,Oe.__webglTexture,0,Ue(M)):(q===s.TEXTURE_2D||q>=s.TEXTURE_CUBE_MAP_POSITIVE_X&&q<=s.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&s.framebufferTexture2D(s.FRAMEBUFFER,X,q,Oe.__webglTexture,ue),t.bindFramebuffer(s.FRAMEBUFFER,null)}function ze(N,M,W){if(s.bindRenderbuffer(s.RENDERBUFFER,N),M.depthBuffer){let X=M.depthTexture,q=X&&X.isDepthTexture?X.type:null,ue=v(M.stencilBuffer,q),de=M.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT;je(M)?a.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,Ue(M),ue,M.width,M.height):W?s.renderbufferStorageMultisample(s.RENDERBUFFER,Ue(M),ue,M.width,M.height):s.renderbufferStorage(s.RENDERBUFFER,ue,M.width,M.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,de,s.RENDERBUFFER,N)}else{let X=M.textures;for(let q=0;q<X.length;q++){let ue=X[q],de=r.convert(ue.format,ue.colorSpace),$=r.convert(ue.type),te=_(ue.internalFormat,de,$,ue.normalized,ue.colorSpace);je(M)?a.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,Ue(M),te,M.width,M.height):W?s.renderbufferStorageMultisample(s.RENDERBUFFER,Ue(M),te,M.width,M.height):s.renderbufferStorage(s.RENDERBUFFER,te,M.width,M.height)}}s.bindRenderbuffer(s.RENDERBUFFER,null)}function et(N,M,W){let X=M.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(s.FRAMEBUFFER,N),!(M.depthTexture&&M.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let q=i.get(M.depthTexture);if(q.__renderTarget=M,(!q.__webglTexture||M.depthTexture.image.width!==M.width||M.depthTexture.image.height!==M.height)&&(M.depthTexture.image.width=M.width,M.depthTexture.image.height=M.height,M.depthTexture.needsUpdate=!0),X){if(q.__webglInit===void 0&&(q.__webglInit=!0,M.depthTexture.addEventListener("dispose",A)),q.__webglTexture===void 0){q.__webglTexture=s.createTexture(),t.bindTexture(s.TEXTURE_CUBE_MAP,q.__webglTexture),Ee(s.TEXTURE_CUBE_MAP,M.depthTexture);let ge=r.convert(M.depthTexture.format),Oe=r.convert(M.depthTexture.type),xe;M.depthTexture.format===Ji?xe=s.DEPTH_COMPONENT24:M.depthTexture.format===on&&(xe=s.DEPTH24_STENCIL8);for(let me=0;me<6;me++)s.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+me,0,xe,M.width,M.height,0,ge,Oe,null)}}else z(M.depthTexture,0);let ue=q.__webglTexture,de=Ue(M),$=X?s.TEXTURE_CUBE_MAP_POSITIVE_X+W:s.TEXTURE_2D,te=M.depthTexture.format===on?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT;if(M.depthTexture.format===Ji)je(M)?a.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,te,$,ue,0,de):s.framebufferTexture2D(s.FRAMEBUFFER,te,$,ue,0);else if(M.depthTexture.format===on)je(M)?a.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,te,$,ue,0,de):s.framebufferTexture2D(s.FRAMEBUFFER,te,$,ue,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function ie(N){let M=i.get(N),W=N.isWebGLCubeRenderTarget===!0;if(M.__boundDepthTexture!==N.depthTexture){let X=N.depthTexture;if(M.__depthDisposeCallback&&M.__depthDisposeCallback(),X){let q=()=>{delete M.__boundDepthTexture,delete M.__depthDisposeCallback,X.removeEventListener("dispose",q)};X.addEventListener("dispose",q),M.__depthDisposeCallback=q}M.__boundDepthTexture=X}if(N.depthTexture&&!M.__autoAllocateDepthBuffer)if(W)for(let X=0;X<6;X++)et(M.__webglFramebuffer[X],N,X);else{let X=N.texture.mipmaps;X&&X.length>0?et(M.__webglFramebuffer[0],N,0):et(M.__webglFramebuffer,N,0)}else if(W){M.__webglDepthbuffer=[];for(let X=0;X<6;X++)if(t.bindFramebuffer(s.FRAMEBUFFER,M.__webglFramebuffer[X]),M.__webglDepthbuffer[X]===void 0)M.__webglDepthbuffer[X]=s.createRenderbuffer(),ze(M.__webglDepthbuffer[X],N,!1);else{let q=N.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,ue=M.__webglDepthbuffer[X];s.bindRenderbuffer(s.RENDERBUFFER,ue),s.framebufferRenderbuffer(s.FRAMEBUFFER,q,s.RENDERBUFFER,ue)}}else{let X=N.texture.mipmaps;if(X&&X.length>0?t.bindFramebuffer(s.FRAMEBUFFER,M.__webglFramebuffer[0]):t.bindFramebuffer(s.FRAMEBUFFER,M.__webglFramebuffer),M.__webglDepthbuffer===void 0)M.__webglDepthbuffer=s.createRenderbuffer(),ze(M.__webglDepthbuffer,N,!1);else{let q=N.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,ue=M.__webglDepthbuffer;s.bindRenderbuffer(s.RENDERBUFFER,ue),s.framebufferRenderbuffer(s.FRAMEBUFFER,q,s.RENDERBUFFER,ue)}}t.bindFramebuffer(s.FRAMEBUFFER,null)}function ae(N,M,W){let X=i.get(N);M!==void 0&&_e(X.__webglFramebuffer,N,N.texture,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,0),W!==void 0&&ie(N)}function re(N){let M=N.texture,W=i.get(N),X=i.get(M);N.addEventListener("dispose",y);let q=N.textures,ue=N.isWebGLCubeRenderTarget===!0,de=q.length>1;if(de||(X.__webglTexture===void 0&&(X.__webglTexture=s.createTexture()),X.__version=M.version,o.memory.textures++),ue){W.__webglFramebuffer=[];for(let $=0;$<6;$++)if(M.mipmaps&&M.mipmaps.length>0){W.__webglFramebuffer[$]=[];for(let te=0;te<M.mipmaps.length;te++)W.__webglFramebuffer[$][te]=s.createFramebuffer()}else W.__webglFramebuffer[$]=s.createFramebuffer()}else{if(M.mipmaps&&M.mipmaps.length>0){W.__webglFramebuffer=[];for(let $=0;$<M.mipmaps.length;$++)W.__webglFramebuffer[$]=s.createFramebuffer()}else W.__webglFramebuffer=s.createFramebuffer();if(de)for(let $=0,te=q.length;$<te;$++){let ge=i.get(q[$]);ge.__webglTexture===void 0&&(ge.__webglTexture=s.createTexture(),o.memory.textures++)}if(N.samples>0&&je(N)===!1){W.__webglMultisampledFramebuffer=s.createFramebuffer(),W.__webglColorRenderbuffer=[],t.bindFramebuffer(s.FRAMEBUFFER,W.__webglMultisampledFramebuffer);for(let $=0;$<q.length;$++){let te=q[$];W.__webglColorRenderbuffer[$]=s.createRenderbuffer(),s.bindRenderbuffer(s.RENDERBUFFER,W.__webglColorRenderbuffer[$]);let ge=r.convert(te.format,te.colorSpace),Oe=r.convert(te.type),xe=_(te.internalFormat,ge,Oe,te.normalized,te.colorSpace,N.isXRRenderTarget===!0),me=Ue(N);s.renderbufferStorageMultisample(s.RENDERBUFFER,me,xe,N.width,N.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+$,s.RENDERBUFFER,W.__webglColorRenderbuffer[$])}s.bindRenderbuffer(s.RENDERBUFFER,null),N.depthBuffer&&(W.__webglDepthRenderbuffer=s.createRenderbuffer(),ze(W.__webglDepthRenderbuffer,N,!0)),t.bindFramebuffer(s.FRAMEBUFFER,null)}}if(ue){t.bindTexture(s.TEXTURE_CUBE_MAP,X.__webglTexture),Ee(s.TEXTURE_CUBE_MAP,M);for(let $=0;$<6;$++)if(M.mipmaps&&M.mipmaps.length>0)for(let te=0;te<M.mipmaps.length;te++)_e(W.__webglFramebuffer[$][te],N,M,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+$,te);else _e(W.__webglFramebuffer[$],N,M,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+$,0);g(M)&&S(s.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(de){for(let $=0,te=q.length;$<te;$++){let ge=q[$],Oe=i.get(ge),xe=s.TEXTURE_2D;(N.isWebGL3DRenderTarget||N.isWebGLArrayRenderTarget)&&(xe=N.isWebGL3DRenderTarget?s.TEXTURE_3D:s.TEXTURE_2D_ARRAY),t.bindTexture(xe,Oe.__webglTexture),Ee(xe,ge),_e(W.__webglFramebuffer,N,ge,s.COLOR_ATTACHMENT0+$,xe,0),g(ge)&&S(xe)}t.unbindTexture()}else{let $=s.TEXTURE_2D;if((N.isWebGL3DRenderTarget||N.isWebGLArrayRenderTarget)&&($=N.isWebGL3DRenderTarget?s.TEXTURE_3D:s.TEXTURE_2D_ARRAY),t.bindTexture($,X.__webglTexture),Ee($,M),M.mipmaps&&M.mipmaps.length>0)for(let te=0;te<M.mipmaps.length;te++)_e(W.__webglFramebuffer[te],N,M,s.COLOR_ATTACHMENT0,$,te);else _e(W.__webglFramebuffer,N,M,s.COLOR_ATTACHMENT0,$,0);g(M)&&S($),t.unbindTexture()}N.depthBuffer&&ie(N)}function oe(N){let M=N.textures;for(let W=0,X=M.length;W<X;W++){let q=M[W];if(g(q)){let ue=T(N),de=i.get(q).__webglTexture;t.bindTexture(ue,de),S(ue),t.unbindTexture()}}}let le=[],ke=[];function Ie(N){if(N.samples>0){if(je(N)===!1){let M=N.textures,W=N.width,X=N.height,q=s.COLOR_BUFFER_BIT,ue=N.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,de=i.get(N),$=M.length>1;if($)for(let ge=0;ge<M.length;ge++)t.bindFramebuffer(s.FRAMEBUFFER,de.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+ge,s.RENDERBUFFER,null),t.bindFramebuffer(s.FRAMEBUFFER,de.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+ge,s.TEXTURE_2D,null,0);t.bindFramebuffer(s.READ_FRAMEBUFFER,de.__webglMultisampledFramebuffer);let te=N.texture.mipmaps;te&&te.length>0?t.bindFramebuffer(s.DRAW_FRAMEBUFFER,de.__webglFramebuffer[0]):t.bindFramebuffer(s.DRAW_FRAMEBUFFER,de.__webglFramebuffer);for(let ge=0;ge<M.length;ge++){if(N.resolveDepthBuffer&&(N.depthBuffer&&(q|=s.DEPTH_BUFFER_BIT),N.stencilBuffer&&N.resolveStencilBuffer&&(q|=s.STENCIL_BUFFER_BIT)),$){s.framebufferRenderbuffer(s.READ_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.RENDERBUFFER,de.__webglColorRenderbuffer[ge]);let Oe=i.get(M[ge]).__webglTexture;s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,Oe,0)}s.blitFramebuffer(0,0,W,X,0,0,W,X,q,s.NEAREST),l===!0&&(le.length=0,ke.length=0,le.push(s.COLOR_ATTACHMENT0+ge),N.depthBuffer&&N.storeMultisampledDepthBuffer===!1&&(le.push(ue),ke.push(ue),s.invalidateFramebuffer(s.DRAW_FRAMEBUFFER,ke)),s.invalidateFramebuffer(s.READ_FRAMEBUFFER,le))}if(t.bindFramebuffer(s.READ_FRAMEBUFFER,null),t.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),$)for(let ge=0;ge<M.length;ge++){t.bindFramebuffer(s.FRAMEBUFFER,de.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+ge,s.RENDERBUFFER,de.__webglColorRenderbuffer[ge]);let Oe=i.get(M[ge]).__webglTexture;t.bindFramebuffer(s.FRAMEBUFFER,de.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+ge,s.TEXTURE_2D,Oe,0)}t.bindFramebuffer(s.DRAW_FRAMEBUFFER,de.__webglMultisampledFramebuffer)}else if(N.depthBuffer&&N.storeMultisampledDepthBuffer===!1&&l){let M=N.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT;s.invalidateFramebuffer(s.DRAW_FRAMEBUFFER,[M])}}}function Ue(N){return Math.min(n.maxSamples,N.samples)}function je(N){let M=i.get(N);return N.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&M.__useRenderToTexture!==!1}function B(N){let M=o.render.frame;h.get(N)!==M&&(h.set(N,M),N.update())}function $e(N,M){let W=N.colorSpace,X=N.format,q=N.type;return N.isCompressedTexture===!0||N.isVideoTexture===!0||W!==di&&W!==Pi&&(tt.getTransfer(W)===ht?(X!==fi||q!==li)&&Ge("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Ke("WebGLTextures: Unsupported texture color space:",W)),M}function Ze(N){return typeof HTMLImageElement<"u"&&N instanceof HTMLImageElement?(c.width=N.naturalWidth||N.width,c.height=N.naturalHeight||N.height):typeof VideoFrame<"u"&&N instanceof VideoFrame?(c.width=N.displayWidth,c.height=N.displayHeight):(c.width=N.width,c.height=N.height),c}this.allocateTextureUnit=F,this.resetTextureUnits=w,this.getTextureUnits=P,this.setTextureUnits=U,this.setTexture2D=z,this.setTexture2DArray=k,this.setTexture3D=G,this.setTextureCube=Y,this.rebindTextures=ae,this.setupRenderTarget=re,this.updateRenderTargetMipmap=oe,this.updateMultisampleRenderTarget=Ie,this.setupDepthRenderbuffer=ie,this.setupFrameBufferTexture=_e,this.useMultisampledRTT=je,this.isReversedDepthBuffer=function(){return t.buffers.depth.getReversed()}}function jy(s,e){function t(i,n=Pi){let r,o=tt.getTransfer(n);if(i===li)return s.UNSIGNED_BYTE;if(i===Pl)return s.UNSIGNED_SHORT_4_4_4_4;if(i===Ll)return s.UNSIGNED_SHORT_5_5_5_1;if(i===$h)return s.UNSIGNED_INT_5_9_9_9_REV;if(i===eu)return s.UNSIGNED_INT_10F_11F_11F_REV;if(i===Jh)return s.BYTE;if(i===Qh)return s.SHORT;if(i===vr)return s.UNSIGNED_SHORT;if(i===Rl)return s.INT;if(i===Wi)return s.UNSIGNED_INT;if(i===wi)return s.FLOAT;if(i===wt)return s.HALF_FLOAT;if(i===tu)return s.ALPHA;if(i===iu)return s.RGB;if(i===fi)return s.RGBA;if(i===Ji)return s.DEPTH_COMPONENT;if(i===on)return s.DEPTH_STENCIL;if(i===Il)return s.RED;if(i===Dl)return s.RED_INTEGER;if(i===$n)return s.RG;if(i===Nl)return s.RG_INTEGER;if(i===Ul)return s.RGBA_INTEGER;if(i===Ho||i===Vo||i===Go||i===Wo)if(o===ht)if(r=e.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(i===Ho)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===Vo)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===Go)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===Wo)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=e.get("WEBGL_compressed_texture_s3tc"),r!==null){if(i===Ho)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===Vo)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===Go)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===Wo)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===Ol||i===Fl||i===Bl||i===kl)if(r=e.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(i===Ol)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===Fl)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===Bl)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===kl)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===zl||i===Hl||i===Vl||i===Gl||i===Wl||i===Xo||i===Xl)if(r=e.get("WEBGL_compressed_texture_etc"),r!==null){if(i===zl||i===Hl)return o===ht?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(i===Vl)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(i===Gl)return r.COMPRESSED_R11_EAC;if(i===Wl)return r.COMPRESSED_SIGNED_R11_EAC;if(i===Xo)return r.COMPRESSED_RG11_EAC;if(i===Xl)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(i===ql||i===Yl||i===jl||i===Zl||i===Kl||i===Jl||i===Ql||i===$l||i===ec||i===tc||i===ic||i===nc||i===sc||i===rc)if(r=e.get("WEBGL_compressed_texture_astc"),r!==null){if(i===ql)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===Yl)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===jl)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===Zl)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===Kl)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===Jl)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===Ql)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===$l)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===ec)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===tc)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===ic)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===nc)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===sc)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===rc)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===oc||i===ac||i===lc)if(r=e.get("EXT_texture_compression_bptc"),r!==null){if(i===oc)return o===ht?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===ac)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===lc)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===cc||i===hc||i===qo||i===uc)if(r=e.get("EXT_texture_compression_rgtc"),r!==null){if(i===cc)return r.COMPRESSED_RED_RGTC1_EXT;if(i===hc)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===qo)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===uc)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===Qn?s.UNSIGNED_INT_24_8:s[i]!==void 0?s[i]:null}return{convert:t}}var Zy=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Ky=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,Pu=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let i=new co(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=i}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,i=new ct({vertexShader:Zy,fragmentShader:Ky,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new De(new Gn(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},Lu=class extends Vi{constructor(e,t){super();let i=this,n=null,r=1,o=null,a="local-floor",l=1,c=null,h=null,f=null,d=null,u=null,p=null,x=typeof XRWebGLBinding<"u",m=new Pu,g={},S=t.getContextAttributes(),T=null,_=null,v=[],E=[],A=new ee,y=null,R=null,I=new Ut;I.viewport=new ut;let L=new Ut;L.viewport=new ut;let b=[I,L],w=new bl,P=null,U=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(j){let J=v[j];return J===void 0&&(J=new sr,v[j]=J),J.getTargetRaySpace()},this.getControllerGrip=function(j){let J=v[j];return J===void 0&&(J=new sr,v[j]=J),J.getGripSpace()},this.getHand=function(j){let J=v[j];return J===void 0&&(J=new sr,v[j]=J),J.getHandSpace()};function F(j){let J=E.indexOf(j.inputSource);if(J===-1)return;let fe=v[J];fe!==void 0&&(fe.update(j.inputSource,j.frame,c||o),fe.dispatchEvent({type:j.type,data:j.inputSource}))}function O(){n.removeEventListener("select",F),n.removeEventListener("selectstart",F),n.removeEventListener("selectend",F),n.removeEventListener("squeeze",F),n.removeEventListener("squeezestart",F),n.removeEventListener("squeezeend",F),n.removeEventListener("end",O),n.removeEventListener("inputsourceschange",z);for(let j=0;j<v.length;j++){let J=E[j];J!==null&&(E[j]=null,v[j].disconnect(J))}P=null,U=null,m.reset();for(let j in g)delete g[j];if(e.setRenderTarget(T),u=null,d=null,f=null,n=null,_=null,Re.stop(),i.isPresenting=!1,e.setPixelRatio(y),e.setSize(A.width,A.height,!1),R!==null){let j=R.camera;j.fov=R.fov,j.zoom=R.zoom,j.updateProjectionMatrix(),R=null}i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(j){r=j,i.isPresenting===!0&&Ge("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(j){a=j,i.isPresenting===!0&&Ge("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||o},this.setReferenceSpace=function(j){c=j},this.getBaseLayer=function(){return d!==null?d:u},this.getBinding=function(){return f===null&&x&&(f=new XRWebGLBinding(n,t)),f},this.getFrame=function(){return p},this.getSession=function(){return n},this.setSession=async function(j){if(n=j,n!==null){if(T=e.getRenderTarget(),n.addEventListener("select",F),n.addEventListener("selectstart",F),n.addEventListener("selectend",F),n.addEventListener("squeeze",F),n.addEventListener("squeezestart",F),n.addEventListener("squeezeend",F),n.addEventListener("end",O),n.addEventListener("inputsourceschange",z),S.xrCompatible!==!0&&await t.makeXRCompatible(),y=e.getPixelRatio(),e.getSize(A),x&&"createProjectionLayer"in XRWebGLBinding.prototype){let fe=null,Le=null,_e=null;S.depth&&(_e=S.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,fe=S.stencil?on:Ji,Le=S.stencil?Qn:Wi);let ze={colorFormat:t.RGBA8,depthFormat:_e,scaleFactor:r};f=this.getBinding(),d=f.createProjectionLayer(ze),n.updateRenderState({layers:[d]}),e.setPixelRatio(1),e.setSize(d.textureWidth,d.textureHeight,!1),_=new dt(d.textureWidth,d.textureHeight,{format:fi,type:li,depthTexture:new tn(d.textureWidth,d.textureHeight,Le,void 0,void 0,void 0,void 0,void 0,void 0,fe),stencilBuffer:S.stencil,colorSpace:e.outputColorSpace,samples:S.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1,storeMultisampledDepthBuffer:d.ignoreDepthValues===!1,storeMultisampledStencilBuffer:d.ignoreDepthValues===!1})}else{let fe={antialias:S.antialias,alpha:!0,depth:S.depth,stencil:S.stencil,framebufferScaleFactor:r};u=new XRWebGLLayer(n,t,fe),n.updateRenderState({baseLayer:u}),e.setPixelRatio(1),e.setSize(u.framebufferWidth,u.framebufferHeight,!1),_=new dt(u.framebufferWidth,u.framebufferHeight,{format:fi,type:li,colorSpace:e.outputColorSpace,stencilBuffer:S.stencil,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1,storeMultisampledDepthBuffer:u.ignoreDepthValues===!1,storeMultisampledStencilBuffer:u.ignoreDepthValues===!1})}_.isXRRenderTarget=!0,this.setFoveation(l),c=null,o=await n.requestReferenceSpace(a),Re.setContext(n),Re.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(n!==null)return n.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function z(j){for(let J=0;J<j.removed.length;J++){let fe=j.removed[J],Le=E.indexOf(fe);Le>=0&&(E[Le]=null,v[Le].disconnect(fe))}for(let J=0;J<j.added.length;J++){let fe=j.added[J],Le=E.indexOf(fe);if(Le===-1){for(let ze=0;ze<v.length;ze++)if(ze>=E.length){E.push(fe),Le=ze;break}else if(E[ze]===null){E[ze]=fe,Le=ze;break}if(Le===-1)break}let _e=v[Le];_e&&_e.connect(fe)}}let k=new D,G=new D;function Y(j,J,fe){k.setFromMatrixPosition(J.matrixWorld),G.setFromMatrixPosition(fe.matrixWorld);let Le=k.distanceTo(G),_e=J.projectionMatrix.elements,ze=fe.projectionMatrix.elements,et=_e[14]/(_e[10]-1),ie=_e[14]/(_e[10]+1),ae=(_e[9]+1)/_e[5],re=(_e[9]-1)/_e[5],oe=(_e[8]-1)/_e[0],le=(ze[8]+1)/ze[0],ke=et*oe,Ie=et*le,Ue=Le/(-oe+le),je=Ue*-oe;if(J.matrixWorld.decompose(j.position,j.quaternion,j.scale),j.translateX(je),j.translateZ(Ue),j.matrixWorld.compose(j.position,j.quaternion,j.scale),j.matrixWorldInverse.copy(j.matrixWorld).invert(),_e[10]===-1)j.projectionMatrix.copy(J.projectionMatrix),j.projectionMatrixInverse.copy(J.projectionMatrixInverse);else{let B=et+Ue,$e=ie+Ue,Ze=ke-je,N=Ie+(Le-je),M=ae*ie/$e*B,W=re*ie/$e*B;j.projectionMatrix.makePerspective(Ze,N,M,W,B,$e),j.projectionMatrixInverse.copy(j.projectionMatrix).invert()}}function he(j,J){J===null?j.matrixWorld.copy(j.matrix):j.matrixWorld.multiplyMatrices(J.matrixWorld,j.matrix),j.matrixWorldInverse.copy(j.matrixWorld).invert()}this.updateCamera=function(j){if(n===null)return;let J=j.near,fe=j.far;m.texture!==null&&(m.depthNear>0&&(J=m.depthNear),m.depthFar>0&&(fe=m.depthFar)),w.near=L.near=I.near=J,w.far=L.far=I.far=fe,(P!==w.near||U!==w.far)&&(n.updateRenderState({depthNear:w.near,depthFar:w.far}),P=w.near,U=w.far),w.layers.mask=j.layers.mask|6,I.layers.mask=w.layers.mask&-5,L.layers.mask=w.layers.mask&-3;let Le=j.parent,_e=w.cameras;he(w,Le);for(let ze=0;ze<_e.length;ze++)he(_e[ze],Le);_e.length===2?Y(w,I,L):w.projectionMatrix.copy(I.projectionMatrix),R===null&&j.isPerspectiveCamera&&(R={camera:j,fov:j.fov,zoom:j.zoom}),pe(j,w,Le)};function pe(j,J,fe){fe===null?j.matrix.copy(J.matrixWorld):(j.matrix.copy(fe.matrixWorld),j.matrix.invert(),j.matrix.multiply(J.matrixWorld)),j.matrix.decompose(j.position,j.quaternion,j.scale),j.updateMatrixWorld(!0),j.projectionMatrix.copy(J.projectionMatrix),j.projectionMatrixInverse.copy(J.projectionMatrixInverse),j.isPerspectiveCamera&&(j.fov=hs*2*Math.atan(1/j.projectionMatrix.elements[5]),j.zoom=1)}this.getCamera=function(){return w},this.getFoveation=function(){if(!(d===null&&u===null))return l},this.setFoveation=function(j){l=j,d!==null&&(d.fixedFoveation=j),u!==null&&u.fixedFoveation!==void 0&&(u.fixedFoveation=j)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(w)},this.getCameraTexture=function(j){return g[j]};let Te=null;function Ee(j,J){if(h=J.getViewerPose(c||o),p=J,h!==null){let fe=h.views;u!==null&&(e.setRenderTargetFramebuffer(_,u.framebuffer),e.setRenderTarget(_));let Le=!1;fe.length!==w.cameras.length&&(w.cameras.length=0,Le=!0);for(let ie=0;ie<fe.length;ie++){let ae=fe[ie],re=null;if(u!==null)re=u.getViewport(ae);else{let le=f.getViewSubImage(d,ae);re=le.viewport,ie===0&&(e.setRenderTargetTextures(_,le.colorTexture,le.depthStencilTexture),e.setRenderTarget(_))}let oe=b[ie];oe===void 0&&(oe=new Ut,oe.layers.enable(ie),oe.viewport=new ut,b[ie]=oe),oe.matrix.fromArray(ae.transform.matrix),oe.matrix.decompose(oe.position,oe.quaternion,oe.scale),oe.projectionMatrix.fromArray(ae.projectionMatrix),oe.projectionMatrixInverse.copy(oe.projectionMatrix).invert(),oe.viewport.set(re.x,re.y,re.width,re.height),ie===0&&(w.matrix.copy(oe.matrix),w.matrix.decompose(w.position,w.quaternion,w.scale)),Le===!0&&w.cameras.push(oe)}let _e=n.enabledFeatures;if(_e&&_e.includes("depth-sensing")&&n.depthUsage=="gpu-optimized"&&x){f=i.getBinding();let ie=f.getDepthInformation(fe[0]);ie&&ie.isValid&&ie.texture&&m.init(ie,n.renderState)}if(_e&&_e.includes("camera-access")&&x){e.state.unbindTexture(),f=i.getBinding();for(let ie=0;ie<fe.length;ie++){let ae=fe[ie].camera;if(ae){let re=g[ae];re||(re=new co,g[ae]=re);let oe=f.getCameraImage(ae);re.sourceTexture=oe}}}}for(let fe=0;fe<v.length;fe++){let Le=E[fe],_e=v[fe];Le!==null&&_e!==void 0&&_e.update(Le,J,c||o)}Te&&Te(j,J),J.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:J}),p=null}let Re=new Fp;Re.setAnimationLoop(Ee),this.setAnimationLoop=function(j){Te=j},this.dispose=function(){}}},Jy=new We,Gp=new Qe;Gp.set(-1,0,0,0,1,0,0,0,1);function Qy(s,e){function t(m,g){m.matrixAutoUpdate===!0&&m.updateMatrix(),g.value.copy(m.matrix)}function i(m,g){g.color.getRGB(m.fogColor.value,lu(s)),g.isFog?(m.fogNear.value=g.near,m.fogFar.value=g.far):g.isFogExp2&&(m.fogDensity.value=g.density)}function n(m,g,S,T,_){g.isNodeMaterial?g.uniformsNeedUpdate=!1:g.isMeshBasicMaterial?r(m,g):g.isMeshLambertMaterial?(r(m,g),g.envMap&&(m.envMapIntensity.value=g.envMapIntensity)):g.isMeshToonMaterial?(r(m,g),f(m,g)):g.isMeshPhongMaterial?(r(m,g),h(m,g),g.envMap&&(m.envMapIntensity.value=g.envMapIntensity)):g.isMeshStandardMaterial?(r(m,g),d(m,g),g.isMeshPhysicalMaterial&&u(m,g,_)):g.isMeshMatcapMaterial?(r(m,g),p(m,g)):g.isMeshDepthMaterial?r(m,g):g.isMeshDistanceMaterial?(r(m,g),x(m,g)):g.isMeshNormalMaterial?r(m,g):g.isLineBasicMaterial?(o(m,g),g.isLineDashedMaterial&&a(m,g)):g.isPointsMaterial?l(m,g,S,T):g.isSpriteMaterial?c(m,g):g.isShadowMaterial?(m.color.value.copy(g.color),m.opacity.value=g.opacity):g.isShaderMaterial&&(g.uniformsNeedUpdate=!1)}function r(m,g){m.opacity.value=g.opacity,g.color&&m.diffuse.value.copy(g.color),g.emissive&&m.emissive.value.copy(g.emissive).multiplyScalar(g.emissiveIntensity),g.map&&(m.map.value=g.map,t(g.map,m.mapTransform)),g.alphaMap&&(m.alphaMap.value=g.alphaMap,t(g.alphaMap,m.alphaMapTransform)),g.bumpMap&&(m.bumpMap.value=g.bumpMap,t(g.bumpMap,m.bumpMapTransform),m.bumpScale.value=g.bumpScale,g.side===ti&&(m.bumpScale.value*=-1)),g.normalMap&&(m.normalMap.value=g.normalMap,t(g.normalMap,m.normalMapTransform),m.normalScale.value.copy(g.normalScale),g.side===ti&&m.normalScale.value.negate()),g.displacementMap&&(m.displacementMap.value=g.displacementMap,t(g.displacementMap,m.displacementMapTransform),m.displacementScale.value=g.displacementScale,m.displacementBias.value=g.displacementBias),g.emissiveMap&&(m.emissiveMap.value=g.emissiveMap,t(g.emissiveMap,m.emissiveMapTransform)),g.specularMap&&(m.specularMap.value=g.specularMap,t(g.specularMap,m.specularMapTransform)),g.alphaTest>0&&(m.alphaTest.value=g.alphaTest);let S=e.get(g),T=S.envMap,_=S.envMapRotation;T&&(m.envMap.value=T,m.envMapRotation.value.setFromMatrix4(Jy.makeRotationFromEuler(_)).transpose(),T.isCubeTexture&&T.isRenderTargetTexture===!1&&m.envMapRotation.value.premultiply(Gp),m.reflectivity.value=g.reflectivity,m.ior.value=g.ior,m.refractionRatio.value=g.refractionRatio),g.lightMap&&(m.lightMap.value=g.lightMap,m.lightMapIntensity.value=g.lightMapIntensity,t(g.lightMap,m.lightMapTransform)),g.aoMap&&(m.aoMap.value=g.aoMap,m.aoMapIntensity.value=g.aoMapIntensity,t(g.aoMap,m.aoMapTransform))}function o(m,g){m.diffuse.value.copy(g.color),m.opacity.value=g.opacity,g.map&&(m.map.value=g.map,t(g.map,m.mapTransform))}function a(m,g){m.dashSize.value=g.dashSize,m.totalSize.value=g.dashSize+g.gapSize,m.scale.value=g.scale}function l(m,g,S,T){m.diffuse.value.copy(g.color),m.opacity.value=g.opacity,m.size.value=g.size*S,m.scale.value=T*.5,g.map&&(m.map.value=g.map,t(g.map,m.uvTransform)),g.alphaMap&&(m.alphaMap.value=g.alphaMap,t(g.alphaMap,m.alphaMapTransform)),g.alphaTest>0&&(m.alphaTest.value=g.alphaTest)}function c(m,g){m.diffuse.value.copy(g.color),m.opacity.value=g.opacity,m.rotation.value=g.rotation,g.map&&(m.map.value=g.map,t(g.map,m.mapTransform)),g.alphaMap&&(m.alphaMap.value=g.alphaMap,t(g.alphaMap,m.alphaMapTransform)),g.alphaTest>0&&(m.alphaTest.value=g.alphaTest)}function h(m,g){m.specular.value.copy(g.specular),m.shininess.value=Math.max(g.shininess,1e-4)}function f(m,g){g.gradientMap&&(m.gradientMap.value=g.gradientMap)}function d(m,g){m.metalness.value=g.metalness,g.metalnessMap&&(m.metalnessMap.value=g.metalnessMap,t(g.metalnessMap,m.metalnessMapTransform)),m.roughness.value=g.roughness,g.roughnessMap&&(m.roughnessMap.value=g.roughnessMap,t(g.roughnessMap,m.roughnessMapTransform)),g.envMap&&(m.envMapIntensity.value=g.envMapIntensity)}function u(m,g,S){m.ior.value=g.ior,g.sheen>0&&(m.sheenColor.value.copy(g.sheenColor).multiplyScalar(g.sheen),m.sheenRoughness.value=g.sheenRoughness,g.sheenColorMap&&(m.sheenColorMap.value=g.sheenColorMap,t(g.sheenColorMap,m.sheenColorMapTransform)),g.sheenRoughnessMap&&(m.sheenRoughnessMap.value=g.sheenRoughnessMap,t(g.sheenRoughnessMap,m.sheenRoughnessMapTransform))),g.clearcoat>0&&(m.clearcoat.value=g.clearcoat,m.clearcoatRoughness.value=g.clearcoatRoughness,g.clearcoatMap&&(m.clearcoatMap.value=g.clearcoatMap,t(g.clearcoatMap,m.clearcoatMapTransform)),g.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=g.clearcoatRoughnessMap,t(g.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),g.clearcoatNormalMap&&(m.clearcoatNormalMap.value=g.clearcoatNormalMap,t(g.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(g.clearcoatNormalScale),g.side===ti&&m.clearcoatNormalScale.value.negate())),g.dispersion>0&&(m.dispersion.value=g.dispersion),g.retroreflectivity>0&&(m.retroreflectivity.value=g.retroreflectivity),g.iridescence>0&&(m.iridescence.value=g.iridescence,m.iridescenceIOR.value=g.iridescenceIOR,m.iridescenceThicknessMinimum.value=g.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=g.iridescenceThicknessRange[1],g.iridescenceMap&&(m.iridescenceMap.value=g.iridescenceMap,t(g.iridescenceMap,m.iridescenceMapTransform)),g.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=g.iridescenceThicknessMap,t(g.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),g.transmission>0&&(m.transmission.value=g.transmission,m.transmissionSamplerMap.value=S.texture,m.transmissionSamplerSize.value.set(S.width,S.height),g.transmissionMap&&(m.transmissionMap.value=g.transmissionMap,t(g.transmissionMap,m.transmissionMapTransform)),m.thickness.value=g.thickness,g.thicknessMap&&(m.thicknessMap.value=g.thicknessMap,t(g.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=g.attenuationDistance,m.attenuationColor.value.copy(g.attenuationColor)),g.anisotropy>0&&(m.anisotropyVector.value.set(g.anisotropy*Math.cos(g.anisotropyRotation),g.anisotropy*Math.sin(g.anisotropyRotation)),g.anisotropyMap&&(m.anisotropyMap.value=g.anisotropyMap,t(g.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=g.specularIntensity,m.specularColor.value.copy(g.specularColor),g.specularColorMap&&(m.specularColorMap.value=g.specularColorMap,t(g.specularColorMap,m.specularColorMapTransform)),g.specularIntensityMap&&(m.specularIntensityMap.value=g.specularIntensityMap,t(g.specularIntensityMap,m.specularIntensityMapTransform))}function p(m,g){g.matcap&&(m.matcap.value=g.matcap)}function x(m,g){let S=e.get(g).light;m.referencePosition.value.setFromMatrixPosition(S.matrixWorld),m.nearDistance.value=S.shadow.camera.near,m.farDistance.value=S.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:n}}function $y(s,e,t,i){let n={},r={},o=[],a=s.getParameter(s.MAX_UNIFORM_BUFFER_BINDINGS);function l(_,v){let E=v.program;i.uniformBlockBinding(_,E)}function c(_,v){let E=n[_.id];E===void 0&&(m(_),E=h(_),n[_.id]=E,_.addEventListener("dispose",S));let A=v.program;i.updateUBOMapping(_,A);let y=e.render.frame;r[_.id]!==y&&(d(_),r[_.id]=y)}function h(_){let v=f();_.__bindingPointIndex=v;let E=s.createBuffer(),A=_.__size,y=_.usage;return s.bindBuffer(s.UNIFORM_BUFFER,E),s.bufferData(s.UNIFORM_BUFFER,A,y),s.bindBuffer(s.UNIFORM_BUFFER,null),s.bindBufferBase(s.UNIFORM_BUFFER,v,E),E}function f(){for(let _=0;_<a;_++)if(o.indexOf(_)===-1)return o.push(_),_;return Ke("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(_){let v=n[_.id],E=_.uniforms,A=_.__cache;s.bindBuffer(s.UNIFORM_BUFFER,v);for(let y=0,R=E.length;y<R;y++){let I=E[y];if(Array.isArray(I))for(let L=0,b=I.length;L<b;L++)u(I[L],y,L,A);else u(I,y,0,A)}s.bindBuffer(s.UNIFORM_BUFFER,null)}function u(_,v,E,A){if(x(_,v,E,A)===!0){let y=_.__offset,R=_.value;if(Array.isArray(R)){let I=0;for(let L=0;L<R.length;L++){let b=R[L],w=g(b);p(b,_.__data,I),typeof b!="number"&&typeof b!="boolean"&&!b.isMatrix3&&!ArrayBuffer.isView(b)&&(I+=w.storage/Float32Array.BYTES_PER_ELEMENT)}}else p(R,_.__data,0);s.bufferSubData(s.UNIFORM_BUFFER,y,_.__data)}}function p(_,v,E){typeof _=="number"||typeof _=="boolean"?v[0]=_:_.isMatrix3?(v[0]=_.elements[0],v[1]=_.elements[1],v[2]=_.elements[2],v[3]=0,v[4]=_.elements[3],v[5]=_.elements[4],v[6]=_.elements[5],v[7]=0,v[8]=_.elements[6],v[9]=_.elements[7],v[10]=_.elements[8],v[11]=0):ArrayBuffer.isView(_)?v.set(new _.constructor(_.buffer,_.byteOffset,v.length)):_.toArray(v,E)}function x(_,v,E,A){let y=_.value,R=v+"_"+E;if(A[R]===void 0)return typeof y=="number"||typeof y=="boolean"?A[R]=y:ArrayBuffer.isView(y)?A[R]=y.slice():A[R]=y.clone(),!0;{let I=A[R];if(typeof y=="number"||typeof y=="boolean"){if(I!==y)return A[R]=y,!0}else{if(ArrayBuffer.isView(y))return!0;if(I.equals(y)===!1)return I.copy(y),!0}}return!1}function m(_){let v=_.uniforms,E=0,A=16;for(let R=0,I=v.length;R<I;R++){let L=Array.isArray(v[R])?v[R]:[v[R]];for(let b=0,w=L.length;b<w;b++){let P=L[b],U=Array.isArray(P.value)?P.value:[P.value];for(let F=0,O=U.length;F<O;F++){let z=U[F],k=g(z),G=E%A,Y=G%k.boundary,he=G+Y;E+=Y,he!==0&&A-he<k.storage&&(E+=A-he),P.__data=new Float32Array(k.storage/Float32Array.BYTES_PER_ELEMENT),P.__offset=E,E+=k.storage}}}let y=E%A;return y>0&&(E+=A-y),_.__size=E,_.__cache={},this}function g(_){let v={boundary:0,storage:0};return typeof _=="number"||typeof _=="boolean"?(v.boundary=4,v.storage=4):_.isVector2?(v.boundary=8,v.storage=8):_.isVector3||_.isColor?(v.boundary=16,v.storage=12):_.isVector4?(v.boundary=16,v.storage=16):_.isMatrix3?(v.boundary=48,v.storage=48):_.isMatrix4?(v.boundary=64,v.storage=64):_.isTexture?Ge("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(_)?(v.boundary=16,v.storage=_.byteLength):Ge("WebGLRenderer: Unsupported uniform value type.",_),v}function S(_){let v=_.target;v.removeEventListener("dispose",S);let E=o.indexOf(v.__bindingPointIndex);o.splice(E,1),s.deleteBuffer(n[v.id]),delete n[v.id],delete r[v.id]}function T(){for(let _ in n)s.deleteBuffer(n[_]);o=[],n={},r={}}return{bind:l,update:c,dispose:T}}var eM=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),an=null;function tM(){return an===null&&(an=new en(eM,16,16,$n,wt),an.name="DFG_LUT",an.minFilter=It,an.magFilter=It,an.wrapS=pi,an.wrapT=pi,an.generateMipmaps=!1,an.needsUpdate=!0),an}var xc=class{constructor(e={}){let{canvas:t=sp(),context:i=null,depth:n=!0,stencil:r=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:f=!1,reversedDepthBuffer:d=!1,outputBufferType:u=li}=e;this.isWebGLRenderer=!0;let p;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");p=i.getContextAttributes().alpha}else p=o;let x=u,m=new Set([Ul,Nl,Dl]),g=new Set([li,Wi,vr,Qn,Pl,Ll]),S=new Uint32Array(4),T=new Int32Array(4),_=new D,v=null,E=null,A=[],y=[],R=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=Si,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let I=this,L=!1,b=null,w=null,P=null,U=null;this._outputColorSpace=Mt;let F=0,O=0,z=null,k=-1,G=null,Y=new ut,he=new ut,pe=null,Te=new Me(0),Ee=0,Re=t.width,j=t.height,J=1,fe=null,Le=null,_e=new ut(0,0,Re,j),ze=new ut(0,0,Re,j),et=!1,ie=new lr,ae=!1,re=!1,oe=new We,le=new D,ke=new ut,Ie={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},Ue=!1;function je(){return z===null?J:1}let B=i;function $e(C,H){return t.getContext(C,H)}let Ze,N,M,W,X,q,ue,de,$,te,ge,Oe,xe,me,Ne,Xe,Je,V,ve,ne,ye,Ae,ce;try{let C={alpha:!0,depth:n,stencil:r,antialias:a,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:f};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${"186"}`),t.addEventListener("webglcontextlost",Tt,!1),t.addEventListener("webglcontextrestored",ft,!1),t.addEventListener("webglcontextcreationerror",Oi,!1),B===null){let H="webgl2";if(B=$e(H,C),B===null)throw $e(H)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}qe()}catch(C){throw t.removeEventListener("webglcontextlost",Tt,!1),t.removeEventListener("webglcontextrestored",ft,!1),t.removeEventListener("webglcontextcreationerror",Oi,!1),Ke("WebGLRenderer: "+C.message),C}function qe(){Ze=new lv(B),Ze.init(),ye=new jy(B,Ze),N=new Q_(B,Ze,e,ye),M=new qy(B,Ze),N.reversedDepthBuffer&&d&&M.buffers.depth.setReversed(!0),w=B.createFramebuffer(),P=B.createFramebuffer(),U=B.createFramebuffer(),W=new uv(B),X=new Iy,q=new Yy(B,Ze,M,X,N,ye,W),ue=new av(I),de=new fg(B),Ae=new K_(B,de),$=new cv(B,de,W,Ae),te=new fv(B,$,de,Ae,W),V=new dv(B,N,q),Ne=new $_(X),ge=new Ly(I,ue,Ze,N,Ae,Ne),Oe=new Qy(I,X),xe=new Ny,me=new zy(Ze),Je=new Z_(I,ue,M,te,p,l),Xe=new Xy(I,te,N),ce=new $y(B,W,N,M),ve=new J_(B,Ze,W),ne=new hv(B,Ze,W),W.programs=ge.programs,I.capabilities=N,I.extensions=Ze,I.properties=X,I.renderLists=xe,I.shadowMap=Xe,I.state=M,I.info=W}x!==li&&(R=new mv(x,t.width,t.height,a,n,r));let He=new Lu(I,B);this.xr=He,this.getContext=function(){return B},this.getContextAttributes=function(){return B.getContextAttributes()},this.forceContextLoss=function(){let C=Ze.get("WEBGL_lose_context");C&&C.loseContext()},this.forceContextRestore=function(){let C=Ze.get("WEBGL_lose_context");C&&C.restoreContext()},this.getPixelRatio=function(){return J},this.setPixelRatio=function(C){C!==void 0&&(J=C,this.setSize(Re,j,!1))},this.getSize=function(C){return C.set(Re,j)},this.setSize=function(C,H,Q=!0){if(He.isPresenting){Ge("WebGLRenderer: Can't change size while VR device is presenting.");return}Re=C,j=H,t.width=Math.floor(C*J),t.height=Math.floor(H*J),Q===!0&&(t.style.width=C+"px",t.style.height=H+"px"),R!==null&&R.setSize(t.width,t.height),this.setViewport(0,0,C,H)},this.getDrawingBufferSize=function(C){return C.set(Re*J,j*J).floor()},this.setDrawingBufferSize=function(C,H,Q){Re=C,j=H,J=Q,t.width=Math.floor(C*Q),t.height=Math.floor(H*Q),this.setViewport(0,0,C,H)},this.setEffects=function(C){if(x===li){Ke("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(C){for(let H=0;H<C.length;H++)if(C[H].isOutputPass===!0){Ge("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}R.setEffects(C||[])},this.getCurrentViewport=function(C){return C.copy(Y)},this.getViewport=function(C){return C.copy(_e)},this.setViewport=function(C,H,Q,Z){C.isVector4?_e.set(C.x,C.y,C.z,C.w):_e.set(C,H,Q,Z),M.viewport(Y.copy(_e).multiplyScalar(J).round())},this.getScissor=function(C){return C.copy(ze)},this.setScissor=function(C,H,Q,Z){C.isVector4?ze.set(C.x,C.y,C.z,C.w):ze.set(C,H,Q,Z),M.scissor(he.copy(ze).multiplyScalar(J).round())},this.getScissorTest=function(){return et},this.setScissorTest=function(C){M.setScissorTest(et=C)},this.setOpaqueSort=function(C){fe=C},this.setTransparentSort=function(C){Le=C},this.getClearColor=function(C){return C.copy(Je.getClearColor())},this.setClearColor=function(){Je.setClearColor(...arguments)},this.getClearAlpha=function(){return Je.getClearAlpha()},this.setClearAlpha=function(){Je.setClearAlpha(...arguments)},this.clear=function(C=!0,H=!0,Q=!0){let Z=0;if(C){let K=!1;if(z!==null){let we=z.texture.format;K=m.has(we)}if(K){let we=z.texture.type,Pe=g.has(we),Se=Je.getClearColor(),Fe=Je.getClearAlpha(),Ve=Se.r,nt=Se.g,ot=Se.b;Pe?(S[0]=Ve,S[1]=nt,S[2]=ot,S[3]=Fe,B.clearBufferuiv(B.COLOR,0,S)):(T[0]=Ve,T[1]=nt,T[2]=ot,T[3]=Fe,B.clearBufferiv(B.COLOR,0,T))}else Z|=B.COLOR_BUFFER_BIT}H&&(Z|=B.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),Q&&(Z|=B.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),Z!==0&&B.clear(Z)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(C){C.setRenderer(this),b=C},this.dispose=function(){t.removeEventListener("webglcontextlost",Tt,!1),t.removeEventListener("webglcontextrestored",ft,!1),t.removeEventListener("webglcontextcreationerror",Oi,!1),Je.dispose(),xe.dispose(),me.dispose(),X.dispose(),ue.dispose(),te.dispose(),Ae.dispose(),ce.dispose(),ge.dispose(),He.dispose(),He.removeEventListener("sessionstart",Td),He.removeEventListener("sessionend",Ed),is.stop()};function Tt(C){C.preventDefault(),Qr("WebGLRenderer: Context Lost."),L=!0}function ft(){Qr("WebGLRenderer: Context Restored."),L=!1;let C=W.autoReset,H=Xe.enabled,Q=Xe.autoUpdate,Z=Xe.needsUpdate,K=Xe.type;qe(),W.autoReset=C,Xe.enabled=H,Xe.autoUpdate=Q,Xe.needsUpdate=Z,Xe.type=K}function Oi(C){Ke("WebGLRenderer: A WebGL context could not be created. Reason: ",C.statusMessage)}function qi(C){let H=C.target;H.removeEventListener("dispose",qi),Cm(H)}function Cm(C){Rm(C),X.remove(C)}function Rm(C){let H=X.get(C).programs;H!==void 0&&(H.forEach(function(Q){ge.releaseProgram(Q)}),C.isShaderMaterial&&ge.releaseShaderCache(C))}this.renderBufferDirect=function(C,H,Q,Z,K,we){H===null&&(H=Ie);let Pe=K.isMesh&&K.matrixWorld.determinantAffine()<0,Se=Im(C,H,Q,Z,K);M.setMaterial(Z,Pe);let Fe=Q.index,Ve=1;if(Z.wireframe===!0){if(Fe=$.getWireframeAttribute(Q),Fe===void 0)return;Ve=2}let nt=Q.drawRange,ot=Q.attributes.position,Be=nt.start*Ve,pt=(nt.start+nt.count)*Ve;we!==null&&(Be=Math.max(Be,we.start*Ve),pt=Math.min(pt,(we.start+we.count)*Ve)),Fe!==null?(Be=Math.max(Be,0),pt=Math.min(pt,Fe.count)):ot!=null&&(Be=Math.max(Be,0),pt=Math.min(pt,ot.count));let Ht=pt-Be;if(Ht<0||Ht===1/0)return;Ae.setup(K,Z,Se,Q,Fe);let At,vt=ve;if(Fe!==null&&(At=de.get(Fe),vt=ne,vt.setIndex(At)),K.isMesh)Z.wireframe===!0?(M.setLineWidth(Z.wireframeLinewidth*je()),vt.setMode(B.LINES)):vt.setMode(B.TRIANGLES);else if(K.isLine){let ni=Z.linewidth;ni===void 0&&(ni=1),M.setLineWidth(ni*je()),K.isLineSegments?vt.setMode(B.LINES):K.isLineLoop?vt.setMode(B.LINE_LOOP):vt.setMode(B.LINE_STRIP)}else K.isPoints?vt.setMode(B.POINTS):K.isSprite&&vt.setMode(B.TRIANGLES);if(K.isBatchedMesh)if(Ze.get("WEBGL_multi_draw"))vt.renderMultiDraw(K._multiDrawStarts,K._multiDrawCounts,K._multiDrawCount);else{let ni=K._multiDrawStarts,Ce=K._multiDrawCounts,hi=K._multiDrawCount,lt=Fe?de.get(Fe).bytesPerElement:1,Ti=X.get(Z).currentProgram.getUniforms();for(let Yi=0;Yi<hi;Yi++)Ti.setValue(B,"_gl_DrawID",Yi),vt.render(ni[Yi]/lt,Ce[Yi])}else if(K.isInstancedMesh)vt.renderInstances(Be,Ht,K.count);else if(Q.isInstancedBufferGeometry){let ni=Q._maxInstanceCount!==void 0?Q._maxInstanceCount:1/0,Ce=Math.min(Q.instanceCount,ni);vt.renderInstances(Be,Ht,Ce)}else vt.render(Be,Ht)};function wd(C,H,Q,Z){b!==null&&C.isNodeMaterial&&b.setObject(Z,C),ae===!0&&Ne.setState(C,Q,!1),C.transparent===!0&&C.side===Dt&&C.forceSinglePass===!1?(C.side=ti,C.needsUpdate=!0,fa(C,H,Z),C.side=rn,C.needsUpdate=!0,fa(C,H,Z),C.side=Dt):fa(C,H,Z)}this.compile=function(C,H,Q=null){Q===null&&(Q=C),b!==null&&b.renderStart(C,H,Q),E=me.get(Q),E.init(H),y.push(E),Q.traverseVisible(function(K){K.isLight&&K.layers.test(H.layers)&&(E.pushLight(K),K.castShadow&&E.pushShadow(K))}),C!==Q&&C.traverseVisible(function(K){K.isLight&&K.layers.test(H.layers)&&(E.pushLight(K),K.castShadow&&E.pushShadow(K))}),E.setupLights(),b!==null&&b.updateLights(E.state.lightsArray),re=this.localClippingEnabled,ae=Ne.init(this.clippingPlanes,re),ae===!0&&Ne.setGlobalState(this.clippingPlanes,H),b!==null&&Xe.render(E.state.shadowsArray,Q,H);let Z=new Set;return C.traverse(function(K){if(!(K.isMesh||K.isPoints||K.isLine||K.isSprite))return;let we=K.material;if(we)if(Array.isArray(we))for(let Pe=0;Pe<we.length;Pe++){let Se=we[Pe];wd(Se,Q,H,K),Z.add(Se)}else wd(we,Q,H,K),Z.add(we)}),E=y.pop(),b!==null&&b.renderEnd(),Z},this.compileAsync=function(C,H,Q=null){let Z=this.compile(C,H,Q);return new Promise(K=>{function we(){if(Z.forEach(function(Pe){let Fe=X.get(Pe).currentProgram;(Fe===void 0||Fe.isReady())&&Z.delete(Pe)}),Z.size===0){K(C);return}setTimeout(we,10)}Ze.get("KHR_parallel_shader_compile")!==null?we():setTimeout(we,10)})};let Qc=null;function Pm(C){Qc&&Qc(C)}function Td(){is.stop()}function Ed(){is.start()}let is=new Fp;is.setAnimationLoop(Pm),typeof self<"u"&&is.setContext(self),this.setAnimationLoop=function(C){Qc=C,He.setAnimationLoop(C),C===null?is.stop():is.start()},He.addEventListener("sessionstart",Td),He.addEventListener("sessionend",Ed),this.render=function(C,H){if(H!==void 0&&H.isCamera!==!0){Ke("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(L===!0)return;b!==null&&b.renderStart(C,H);let Q=He.enabled===!0&&He.isPresenting===!0,Z=R!==null&&(z===null||Q)&&R.begin(I,z);if(C.matrixWorldAutoUpdate===!0&&C.updateMatrixWorld(),H.parent===null&&H.matrixWorldAutoUpdate===!0&&H.updateMatrixWorld(),He.enabled===!0&&He.isPresenting===!0&&(R===null||R.isCompositing()===!1)&&(He.cameraAutoUpdate===!0&&He.updateCamera(H),H=He.getCamera()),C.isScene===!0&&C.onBeforeRender(I,C,H,z),E=me.get(C,y.length),E.init(H),E.state.textureUnits=q.getTextureUnits(),y.push(E),oe.multiplyMatrices(H.projectionMatrix,H.matrixWorldInverse),ie.setFromProjectionMatrix(oe,Hi,H.reversedDepth),re=this.localClippingEnabled,ae=Ne.init(this.clippingPlanes,re),v=xe.get(C,A.length),v.init(),A.push(v),He.enabled===!0&&He.isPresenting===!0){let Pe=I.xr.getDepthSensingMesh();Pe!==null&&$c(Pe,H,-1/0,I.sortObjects)}$c(C,H,0,I.sortObjects),v.finish(),b!==null&&b.updateLights(E.state.lightsArray),I.sortObjects===!0&&v.sort(fe,Le),Ue=He.enabled===!1||He.isPresenting===!1||He.hasDepthSensing()===!1,Ue&&Je.addToRenderList(v,C),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),ae===!0&&Ne.beginShadows();let K=E.state.shadowsArray;if(Xe.render(K,C,H),ae===!0&&Ne.endShadows(),(Z&&R.hasRenderPass())===!1){let Pe=v.opaque,Se=v.transmissive;if(E.setupLights(),H.isArrayCamera){let Fe=H.cameras;if(Se.length>0)for(let Ve=0,nt=Fe.length;Ve<nt;Ve++){let ot=Fe[Ve];Cd(Pe,Se,C,ot)}Ue&&Je.render(C);for(let Ve=0,nt=Fe.length;Ve<nt;Ve++){let ot=Fe[Ve];Ad(v,C,ot,ot.viewport)}}else Se.length>0&&Cd(Pe,Se,C,H),Ue&&Je.render(C),Ad(v,C,H)}z!==null&&O===0&&(q.updateMultisampleRenderTarget(z),q.updateRenderTargetMipmap(z)),Z&&R.end(I),C.isScene===!0&&C.onAfterRender(I,C,H),Ae.resetDefaultState(),k=-1,G=null,y.pop(),y.length>0?(E=y[y.length-1],q.setTextureUnits(E.state.textureUnits),ae===!0&&Ne.setGlobalState(I.clippingPlanes,E.state.camera)):E=null,A.pop(),A.length>0?v=A[A.length-1]:v=null,b!==null&&b.renderEnd()};function $c(C,H,Q,Z){if(C.visible===!1)return;if(C.layers.test(H.layers)){if(C.isGroup)Q=C.renderOrder;else if(C.isLOD)C.autoUpdate===!0&&C.update(H);else if(C.isLightProbeGrid)E.pushLightProbeGrid(C);else if(C.isLight)E.pushLight(C),C.castShadow&&E.pushShadow(C);else if(C.isSprite){if(!C.frustumCulled||C.intersectsFrustum(ie)){Z&&ke.setFromMatrixPosition(C.matrixWorld).applyMatrix4(oe);let Pe=te.update(C),Se=C.material;Se.visible&&v.push(C,Pe,Se,Q,ke.z,null,H)}}else if((C.isMesh||C.isLine||C.isPoints)&&(!C.frustumCulled||C.intersectsFrustum(ie))){let Pe=te.update(C),Se=C.material;if(Z&&(C.boundingSphere!==void 0?(C.boundingSphere===null&&C.computeBoundingSphere(),ke.copy(C.boundingSphere.center)):(Pe.boundingSphere===null&&Pe.computeBoundingSphere(),ke.copy(Pe.boundingSphere.center)),ke.applyMatrix4(C.matrixWorld).applyMatrix4(oe)),Array.isArray(Se)){let Fe=Pe.groups;for(let Ve=0,nt=Fe.length;Ve<nt;Ve++){let ot=Fe[Ve],Be=Se[ot.materialIndex];Be&&Be.visible&&v.push(C,Pe,Be,Q,ke.z,ot,H)}}else Se.visible&&v.push(C,Pe,Se,Q,ke.z,null,H)}}let we=C.children;for(let Pe=0,Se=we.length;Pe<Se;Pe++)$c(we[Pe],H,Q,Z)}function Ad(C,H,Q,Z){let{opaque:K,transmissive:we,transparent:Pe}=C;E.setupLightsView(Q),ae===!0&&Ne.setGlobalState(I.clippingPlanes,Q),Z&&M.viewport(Y.copy(Z)),K.length>0&&da(K,H,Q),we.length>0&&da(we,H,Q),Pe.length>0&&da(Pe,H,Q),M.buffers.depth.setTest(!0),M.buffers.depth.setMask(!0),M.buffers.color.setMask(!0),M.setPolygonOffset(!1)}function Cd(C,H,Q,Z){if((Q.isScene===!0?Q.overrideMaterial:null)!==null)return;if(E.state.transmissionRenderTarget[Z.id]===void 0){let Be=Ze.has("EXT_color_buffer_half_float")||Ze.has("EXT_color_buffer_float");E.state.transmissionRenderTarget[Z.id]=new dt(1,1,{generateMipmaps:!0,type:Be?wt:li,minFilter:Gi,samples:Math.max(4,N.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:tt.workingColorSpace})}let we=E.state.transmissionRenderTarget[Z.id],Pe=Z.viewport||Y;we.setSize(Pe.z*I.transmissionResolutionScale,Pe.w*I.transmissionResolutionScale);let Se=I.getRenderTarget(),Fe=I.getActiveCubeFace(),Ve=I.getActiveMipmapLevel();I.setRenderTarget(we),I.getClearColor(Te),Ee=I.getClearAlpha(),Ee<1&&I.setClearColor(16777215,.5),I.clear(),Ue&&Je.render(Q);let nt=I.toneMapping;I.toneMapping=Si;let ot=Z.viewport;if(Z.viewport!==void 0&&(Z.viewport=void 0),E.setupLightsView(Z),ae===!0&&Ne.setGlobalState(I.clippingPlanes,Z),da(C,Q,Z),q.updateMultisampleRenderTarget(we),q.updateRenderTargetMipmap(we),Ze.has("WEBGL_multisampled_render_to_texture")===!1){let Be=!1;for(let pt=0,Ht=H.length;pt<Ht;pt++){let At=H[pt],{object:vt,geometry:ni,material:Ce,group:hi}=At;if(Ce.side===Dt&&vt.layers.test(Z.layers)){let lt=Ce.side;Ce.side=ti,Ce.needsUpdate=!0,Rd(vt,Q,Z,ni,Ce,hi),Ce.side=lt,Ce.needsUpdate=!0,Be=!0}}Be===!0&&(q.updateMultisampleRenderTarget(we),q.updateRenderTargetMipmap(we))}I.setRenderTarget(Se,Fe,Ve),I.setClearColor(Te,Ee),ot!==void 0&&(Z.viewport=ot),I.toneMapping=nt}function da(C,H,Q){let Z=H.isScene===!0?H.overrideMaterial:null;for(let K=0,we=C.length;K<we;K++){let Pe=C[K],{object:Se,geometry:Fe,group:Ve}=Pe,nt=Pe.material;nt.allowOverride===!0&&Z!==null&&(nt=Z),Se.layers.test(Q.layers)&&Rd(Se,H,Q,Fe,nt,Ve)}}function Rd(C,H,Q,Z,K,we){b!==null&&K.isNodeMaterial&&b.setObject(C,K),C.onBeforeRender(I,H,Q,Z,K,we),C.modelViewMatrix.multiplyMatrices(Q.matrixWorldInverse,C.matrixWorld),C.normalMatrix.getNormalMatrix(C.modelViewMatrix),K.onBeforeRender(I,H,Q,Z,C,we),K.transparent===!0&&K.side===Dt&&K.forceSinglePass===!1?(K.side=ti,K.needsUpdate=!0,I.renderBufferDirect(Q,H,Z,K,C,we),K.side=rn,K.needsUpdate=!0,I.renderBufferDirect(Q,H,Z,K,C,we),K.side=Dt):I.renderBufferDirect(Q,H,Z,K,C,we),C.onAfterRender(I,H,Q,Z,K,we)}function fa(C,H,Q){H.isScene!==!0&&(H=Ie);let Z=X.get(C),K=E.state.lights,we=E.state.shadowsArray,Pe=K.state.version,Se=ge.getParameters(C,K.state,we,H,Q,E.state.lightProbeGridArray),Fe=ge.getProgramCacheKey(Se),Ve=Z.programs;Z.environment=C.isMeshStandardMaterial||C.isMeshLambertMaterial||C.isMeshPhongMaterial?H.environment:null,Z.fog=H.fog;let nt=C.isMeshStandardMaterial||C.isMeshLambertMaterial&&!C.envMap||C.isMeshPhongMaterial&&!C.envMap;Z.envMap=ue.get(C.envMap||Z.environment,nt),Z.envMapRotation=Z.environment!==null&&C.envMap===null?H.environmentRotation:C.envMapRotation,Ve===void 0&&(C.addEventListener("dispose",qi),Ve=new Map,Z.programs=Ve);let ot=Ve.get(Fe);if(ot!==void 0){if(Z.currentProgram===ot&&Z.lightsStateVersion===Pe)return Ld(C,Se),ot}else Se.uniforms=ge.getUniforms(C),b!==null&&C.isNodeMaterial&&b.build(C,Q,Se),C.onBeforeCompile(Se,I),ot=ge.acquireProgram(Se,Fe),Ve.set(Fe,ot),Z.uniforms=Se.uniforms;let Be=Z.uniforms;return(!C.isShaderMaterial&&!C.isRawShaderMaterial||C.clipping===!0)&&(Be.clippingPlanes=Ne.uniform),Ld(C,Se),Z.needsLights=Nm(C),Z.lightsStateVersion=Pe,Z.needsLights&&(Be.ambientLightColor.value=K.state.ambient,Be.lightProbe.value=K.state.probe,Be.sunLights.value=K.state.sun,Be.sunLightShadows.value=K.state.sunShadow,Be.directionalLights.value=K.state.directional,Be.directionalLightShadows.value=K.state.directionalShadow,Be.spotLights.value=K.state.spot,Be.spotLightShadows.value=K.state.spotShadow,Be.rectAreaLights.value=K.state.rectArea,Be.ltc_1.value=K.state.rectAreaLTC1,Be.ltc_2.value=K.state.rectAreaLTC2,Be.pointLights.value=K.state.point,Be.pointLightShadows.value=K.state.pointShadow,Be.hemisphereLights.value=K.state.hemi,Be.sunShadowMatrix.value=K.state.sunShadowMatrix,Be.sunShadowCascade.value=K.state.sunShadowCascade,Be.directionalShadowMatrix.value=K.state.directionalShadowMatrix,Be.spotLightMatrix.value=K.state.spotLightMatrix,Be.spotLightMap.value=K.state.spotLightMap,Be.pointShadowMatrix.value=K.state.pointShadowMatrix),Z.lightProbeGrid=E.state.lightProbeGridArray.length>0,Z.currentProgram=ot,Z.uniformsList=null,ot}function Pd(C){if(C.uniformsList===null){let H=C.currentProgram.getUniforms();C.uniformsList=wr.seqWithValue(H.seq,C.uniforms)}return C.uniformsList}function Ld(C,H){let Q=X.get(C);Q.outputColorSpace=H.outputColorSpace,Q.batching=H.batching,Q.batchingColor=H.batchingColor,Q.instancing=H.instancing,Q.instancingColor=H.instancingColor,Q.instancingMorph=H.instancingMorph,Q.skinning=H.skinning,Q.morphTargets=H.morphTargets,Q.morphNormals=H.morphNormals,Q.morphColors=H.morphColors,Q.morphTargetsCount=H.morphTargetsCount,Q.numClippingPlanes=H.numClippingPlanes,Q.numIntersection=H.numClipIntersection,Q.vertexAlphas=H.vertexAlphas,Q.vertexTangents=H.vertexTangents,Q.toneMapping=H.toneMapping}function Lm(C,H){if(C.length===0)return null;if(C.length===1)return C[0].texture!==null?C[0]:null;_.setFromMatrixPosition(H.matrixWorld);for(let Q=0,Z=C.length;Q<Z;Q++){let K=C[Q];if(K.texture!==null&&K.boundingBox.containsPoint(_))return K}return null}function Im(C,H,Q,Z,K){H.isScene!==!0&&(H=Ie),q.resetTextureUnits();let we=H.fog,Pe=Z.isMeshStandardMaterial||Z.isMeshLambertMaterial||Z.isMeshPhongMaterial?H.environment:null,Se=z===null?I.outputColorSpace:z.isXRRenderTarget===!0?z.texture.colorSpace:tt.workingColorSpace,Fe=Z.isMeshStandardMaterial||Z.isMeshLambertMaterial&&!Z.envMap||Z.isMeshPhongMaterial&&!Z.envMap,Ve=ue.get(Z.envMap||Pe,Fe),nt=Z.vertexColors===!0&&!!Q.attributes.color&&Q.attributes.color.itemSize===4,ot=!!Q.attributes.tangent&&(!!Z.normalMap||Z.anisotropy>0),Be=!!Q.morphAttributes.position,pt=!!Q.morphAttributes.normal,Ht=!!Q.morphAttributes.color,At=Si;Z.toneMapped&&(z===null||z.isXRRenderTarget===!0)&&(At=I.toneMapping);let vt=Q.morphAttributes.position||Q.morphAttributes.normal||Q.morphAttributes.color,ni=vt!==void 0?vt.length:0,Ce=X.get(Z),hi=E.state.lights;if(ae===!0&&(re===!0||C!==G)){let Et=C===G&&Z.id===k;Ne.setState(Z,C,Et)}let lt=!1;Z.version===Ce.__version?(Ce.needsLights&&Ce.lightsStateVersion!==hi.state.version||Ce.outputColorSpace!==Se||K.isBatchedMesh&&Ce.batching===!1||!K.isBatchedMesh&&Ce.batching===!0||K.isBatchedMesh&&Ce.batchingColor===!0&&K._colorsTexture===null||K.isBatchedMesh&&Ce.batchingColor===!1&&K._colorsTexture!==null||K.isInstancedMesh&&Ce.instancing===!1||!K.isInstancedMesh&&Ce.instancing===!0||K.isSkinnedMesh&&Ce.skinning===!1||!K.isSkinnedMesh&&Ce.skinning===!0||K.isInstancedMesh&&Ce.instancingColor===!0&&K.instanceColor===null||K.isInstancedMesh&&Ce.instancingColor===!1&&K.instanceColor!==null||K.isInstancedMesh&&Ce.instancingMorph===!0&&K.morphTexture===null||K.isInstancedMesh&&Ce.instancingMorph===!1&&K.morphTexture!==null||Ce.envMap!==Ve||Z.fog===!0&&Ce.fog!==we||Ce.numClippingPlanes!==void 0&&(Ce.numClippingPlanes!==Ne.numPlanes||Ce.numIntersection!==Ne.numIntersection)||Ce.vertexAlphas!==nt||Ce.vertexTangents!==ot||Ce.morphTargets!==Be||Ce.morphNormals!==pt||Ce.morphColors!==Ht||Ce.toneMapping!==At||Ce.morphTargetsCount!==ni||!!Ce.lightProbeGrid!=E.state.lightProbeGridArray.length>0)&&(lt=!0):(lt=!0,Ce.__version=Z.version);let Ti=Ce.currentProgram;lt===!0&&(Ti=fa(Z,H,K),b&&Z.isNodeMaterial&&b.onUpdateProgram(Z,Ti,Ce));let Yi=!1,In=!1,Ps=!1,xt=Ti.getUniforms(),Ft=Ce.uniforms;if(M.useProgram(Ti.program)&&(Yi=!0,In=!0,Ps=!0),Z.id!==k&&(k=Z.id,In=!0),Ce.needsLights){let Et=Lm(E.state.lightProbeGridArray,K);Ce.lightProbeGrid!==Et&&(Ce.lightProbeGrid=Et,In=!0)}if(Yi||G!==C){M.buffers.depth.getReversed()&&C.reversedDepth!==!0&&(C._reversedDepth=!0,C.updateProjectionMatrix()),xt.setValue(B,"projectionMatrix",C.projectionMatrix),xt.setValue(B,"viewMatrix",C.matrixWorldInverse);let Nn=xt.map.cameraPosition;Nn!==void 0&&Nn.setValue(B,le.setFromMatrixPosition(C.matrixWorld)),N.logarithmicDepthBuffer&&xt.setValue(B,"logDepthBufFC",2/(Math.log(C.far+1)/Math.LN2)),(Z.isMeshPhongMaterial||Z.isMeshToonMaterial||Z.isMeshLambertMaterial||Z.isMeshBasicMaterial||Z.isMeshStandardMaterial||Z.isShaderMaterial)&&xt.setValue(B,"isOrthographic",C.isOrthographicCamera===!0),G!==C&&(G=C,In=!0,Ps=!0)}if(Ce.needsLights&&(hi.state.sunShadowMap.length>0&&xt.setValue(B,"sunShadowMap",hi.state.sunShadowMap,q),hi.state.directionalShadowMap.length>0&&xt.setValue(B,"directionalShadowMap",hi.state.directionalShadowMap,q),hi.state.spotShadowMap.length>0&&xt.setValue(B,"spotShadowMap",hi.state.spotShadowMap,q),hi.state.pointShadowMap.length>0&&xt.setValue(B,"pointShadowMap",hi.state.pointShadowMap,q)),K.isSkinnedMesh){xt.setOptional(B,K,"bindMatrix"),xt.setOptional(B,K,"bindMatrixInverse");let Et=K.skeleton;Et&&(Et.boneTexture===null&&Et.computeBoneTexture(),xt.setValue(B,"boneTexture",Et.boneTexture,q))}K.isBatchedMesh&&(xt.setOptional(B,K,"batchingTexture"),xt.setValue(B,"batchingTexture",K._matricesTexture,q),xt.setOptional(B,K,"batchingIdTexture"),xt.setValue(B,"batchingIdTexture",K._indirectTexture,q),xt.setOptional(B,K,"batchingColorTexture"),K._colorsTexture!==null&&xt.setValue(B,"batchingColorTexture",K._colorsTexture,q));let Dn=Q.morphAttributes;if((Dn.position!==void 0||Dn.normal!==void 0||Dn.color!==void 0)&&V.update(K,Q,Ti),(In||Ce.receiveShadow!==K.receiveShadow)&&(Ce.receiveShadow=K.receiveShadow,xt.setValue(B,"receiveShadow",K.receiveShadow)),(Z.isMeshStandardMaterial||Z.isMeshLambertMaterial||Z.isMeshPhongMaterial)&&Z.envMap===null&&H.environment!==null&&(Ft.envMapIntensity.value=H.environmentIntensity),Ft.dfgLUT!==void 0&&(Ft.dfgLUT.value=tM()),In){if(xt.setValue(B,"toneMappingExposure",I.toneMappingExposure),Ce.needsLights&&Dm(Ft,Ps),we&&Z.fog===!0&&Oe.refreshFogUniforms(Ft,we),Oe.refreshMaterialUniforms(Ft,Z,J,j,E.state.transmissionRenderTarget[C.id]),Ce.needsLights&&Ce.lightProbeGrid){let Et=Ce.lightProbeGrid;Ft.probesSH.value=Et.texture,Ft.probesMin.value.copy(Et.boundingBox.min),Ft.probesMax.value.copy(Et.boundingBox.max),Ft.probesResolution.value.copy(Et.resolution)}wr.upload(B,Pd(Ce),Ft,q)}if(Z.isShaderMaterial&&Z.uniformsNeedUpdate===!0&&(wr.upload(B,Pd(Ce),Ft,q),Z.uniformsNeedUpdate=!1),Z.isSpriteMaterial&&xt.setValue(B,"center",K.center),xt.setValue(B,"modelViewMatrix",K.modelViewMatrix),xt.setValue(B,"normalMatrix",K.normalMatrix),xt.setValue(B,"modelMatrix",K.matrixWorld),Z.uniformsGroups!==void 0){let Et=Z.uniformsGroups;for(let Nn=0,Ls=Et.length;Nn<Ls;Nn++){let Dd=Et[Nn];ce.update(Dd,Ti),ce.bind(Dd,Ti)}}return Ti}function Dm(C,H){C.ambientLightColor.needsUpdate=H,C.lightProbe.needsUpdate=H,C.sunLights.needsUpdate=H,C.sunLightShadows.needsUpdate=H,C.directionalLights.needsUpdate=H,C.directionalLightShadows.needsUpdate=H,C.pointLights.needsUpdate=H,C.pointLightShadows.needsUpdate=H,C.spotLights.needsUpdate=H,C.spotLightShadows.needsUpdate=H,C.rectAreaLights.needsUpdate=H,C.hemisphereLights.needsUpdate=H}function Nm(C){return C.isMeshLambertMaterial||C.isMeshToonMaterial||C.isMeshPhongMaterial||C.isMeshStandardMaterial||C.isShadowMaterial||C.isShaderMaterial&&C.lights===!0}this.getActiveCubeFace=function(){return F},this.getActiveMipmapLevel=function(){return O},this.getRenderTarget=function(){return z},this.setRenderTargetTextures=function(C,H,Q){let Z=X.get(C);Z.__autoAllocateDepthBuffer=C.resolveDepthBuffer===!1,Z.__autoAllocateDepthBuffer===!1&&(Z.__useRenderToTexture=!1),X.get(C.texture).__webglTexture=H,X.get(C.depthTexture).__webglTexture=Z.__autoAllocateDepthBuffer?void 0:Q,Z.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(C,H){let Q=X.get(C);Q.__webglFramebuffer=H,Q.__useDefaultFramebuffer=H===void 0},this.setRenderTarget=function(C,H=0,Q=0){z=C,F=H,O=Q;let Z=null,K=!1,we=!1;if(C){let Se=X.get(C);if(Se.__useDefaultFramebuffer!==void 0){M.bindFramebuffer(B.FRAMEBUFFER,Se.__webglFramebuffer),Y.copy(C.viewport),he.copy(C.scissor),pe=C.scissorTest,M.viewport(Y),M.scissor(he),M.setScissorTest(pe),k=-1;return}else if(Se.__webglFramebuffer===void 0)q.setupRenderTarget(C);else if(Se.__hasExternalTextures)q.rebindTextures(C,X.get(C.texture).__webglTexture,X.get(C.depthTexture).__webglTexture);else if(C.depthBuffer){let nt=C.depthTexture;if(Se.__boundDepthTexture!==nt){if(nt!==null&&X.has(nt)&&(C.width!==nt.image.width||C.height!==nt.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");q.setupDepthRenderbuffer(C)}}let Fe=C.texture;(Fe.isData3DTexture||Fe.isDataArrayTexture||Fe.isCompressedArrayTexture)&&(we=!0);let Ve=X.get(C).__webglFramebuffer;C.isWebGLCubeRenderTarget?(Array.isArray(Ve[H])?Z=Ve[H][Q]:Z=Ve[H],K=!0):C.samples>0&&q.useMultisampledRTT(C)===!1?Z=X.get(C).__webglMultisampledFramebuffer:Array.isArray(Ve)?Z=Ve[Q]:Z=Ve,Y.copy(C.viewport),he.copy(C.scissor),pe=C.scissorTest}else Y.copy(_e).multiplyScalar(J).floor(),he.copy(ze).multiplyScalar(J).floor(),pe=et;if(Q!==0&&(Z=w),M.bindFramebuffer(B.FRAMEBUFFER,Z)&&M.drawBuffers(C,Z),M.viewport(Y),M.scissor(he),M.setScissorTest(pe),K){let Se=X.get(C.texture);B.framebufferTexture2D(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_CUBE_MAP_POSITIVE_X+H,Se.__webglTexture,Q)}else if(we){let Se=H;for(let Fe=0;Fe<C.textures.length;Fe++){let Ve=X.get(C.textures[Fe]);B.framebufferTextureLayer(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0+Fe,Ve.__webglTexture,Q,Se)}}else if(C!==null&&Q!==0){let Se=X.get(C.texture);B.framebufferTexture2D(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_2D,Se.__webglTexture,Q)}k=-1};function Id(C){let H=X.get(C);return(H.__readFormat!==C.format||H.__readType!==C.type)&&(H.__readFormat=C.format,H.__readType=C.type,H.__formatReadable=N.textureFormatReadable(C.format),H.__typeReadable=N.textureTypeReadable(C.type)),H}this.readRenderTargetPixels=function(C,H,Q,Z,K,we,Pe,Se=0){if(!(C&&C.isWebGLRenderTarget)){Ke("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Fe=X.get(C).__webglFramebuffer;if(C.isWebGLCubeRenderTarget&&Pe!==void 0&&(Fe=Fe[Pe]),Fe){M.bindFramebuffer(B.FRAMEBUFFER,Fe);try{let Ve=C.textures[Se],nt=Ve.format,ot=Ve.type;C.textures.length>1&&B.readBuffer(B.COLOR_ATTACHMENT0+Se);let Be=Id(Ve);if(Be.__formatReadable===!1){Ke("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(Be.__typeReadable===!1){Ke("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}H>=0&&H<=C.width-Z&&Q>=0&&Q<=C.height-K&&B.readPixels(H,Q,Z,K,ye.convert(nt),ye.convert(ot),we)}finally{let Ve=z!==null?X.get(z).__webglFramebuffer:null;M.bindFramebuffer(B.FRAMEBUFFER,Ve)}}},this.readRenderTargetPixelsAsync=async function(C,H,Q,Z,K,we,Pe,Se=0){if(!(C&&C.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Fe=X.get(C).__webglFramebuffer;if(C.isWebGLCubeRenderTarget&&Pe!==void 0&&(Fe=Fe[Pe]),Fe)if(H>=0&&H<=C.width-Z&&Q>=0&&Q<=C.height-K){M.bindFramebuffer(B.FRAMEBUFFER,Fe);let Ve=C.textures[Se],nt=Ve.format,ot=Ve.type;C.textures.length>1&&B.readBuffer(B.COLOR_ATTACHMENT0+Se);let Be=Id(Ve);if(Be.__formatReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(Be.__typeReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let pt=B.createBuffer();B.bindBuffer(B.PIXEL_PACK_BUFFER,pt),B.bufferData(B.PIXEL_PACK_BUFFER,we.byteLength,B.STREAM_READ),B.readPixels(H,Q,Z,K,ye.convert(nt),ye.convert(ot),0),B.bindBuffer(B.PIXEL_PACK_BUFFER,null);let Ht=z!==null?X.get(z).__webglFramebuffer:null;M.bindFramebuffer(B.FRAMEBUFFER,Ht);let At=B.fenceSync(B.SYNC_GPU_COMMANDS_COMPLETE,0);return B.flush(),await op(B,At,4),B.bindBuffer(B.PIXEL_PACK_BUFFER,pt),B.getBufferSubData(B.PIXEL_PACK_BUFFER,0,we),B.bindBuffer(B.PIXEL_PACK_BUFFER,null),B.deleteBuffer(pt),B.deleteSync(At),we}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(C,H=null,Q=0){let Z=Math.pow(2,-Q),K=Math.floor(C.image.width*Z),we=Math.floor(C.image.height*Z),Pe=H!==null?H.x:0,Se=H!==null?H.y:0;q.setTexture2D(C,0),B.copyTexSubImage2D(B.TEXTURE_2D,Q,0,0,Pe,Se,K,we),M.unbindTexture()},this.copyTextureToTexture=function(C,H,Q=null,Z=null,K=0,we=0){let Pe,Se,Fe,Ve,nt,ot,Be,pt,Ht,At=C.isCompressedTexture?C.mipmaps[we]:C.image;if(Q!==null)Pe=Q.max.x-Q.min.x,Se=Q.max.y-Q.min.y,Fe=Q.isBox3?Q.max.z-Q.min.z:1,Ve=Q.min.x,nt=Q.min.y,ot=Q.isBox3?Q.min.z:0;else{let Ft=Math.pow(2,-K);Pe=Math.floor(At.width*Ft),Se=Math.floor(At.height*Ft),C.isDataArrayTexture?Fe=At.depth:C.isData3DTexture?Fe=Math.floor(At.depth*Ft):Fe=1,Ve=0,nt=0,ot=0}Z!==null?(Be=Z.x,pt=Z.y,Ht=Z.z):(Be=0,pt=0,Ht=0);let vt=ye.convert(H.format),ni=ye.convert(H.type),Ce;H.isData3DTexture?(q.setTexture3D(H,0),Ce=B.TEXTURE_3D):H.isDataArrayTexture||H.isCompressedArrayTexture?(q.setTexture2DArray(H,0),Ce=B.TEXTURE_2D_ARRAY):(q.setTexture2D(H,0),Ce=B.TEXTURE_2D),M.activeTexture(B.TEXTURE0),M.pixelStorei(B.UNPACK_FLIP_Y_WEBGL,H.flipY),M.pixelStorei(B.UNPACK_PREMULTIPLY_ALPHA_WEBGL,H.premultiplyAlpha),M.pixelStorei(B.UNPACK_ALIGNMENT,H.unpackAlignment);let hi=M.getParameter(B.UNPACK_ROW_LENGTH),lt=M.getParameter(B.UNPACK_IMAGE_HEIGHT),Ti=M.getParameter(B.UNPACK_SKIP_PIXELS),Yi=M.getParameter(B.UNPACK_SKIP_ROWS),In=M.getParameter(B.UNPACK_SKIP_IMAGES);M.pixelStorei(B.UNPACK_ROW_LENGTH,At.width),M.pixelStorei(B.UNPACK_IMAGE_HEIGHT,At.height),M.pixelStorei(B.UNPACK_SKIP_PIXELS,Ve),M.pixelStorei(B.UNPACK_SKIP_ROWS,nt),M.pixelStorei(B.UNPACK_SKIP_IMAGES,ot);let Ps=C.isDataArrayTexture||C.isData3DTexture,xt=H.isDataArrayTexture||H.isData3DTexture;if(C.isDepthTexture){let Ft=X.get(C),Dn=X.get(H),Et=X.get(Ft.__renderTarget),Nn=X.get(Dn.__renderTarget);M.bindFramebuffer(B.READ_FRAMEBUFFER,Et.__webglFramebuffer),M.bindFramebuffer(B.DRAW_FRAMEBUFFER,Nn.__webglFramebuffer);for(let Ls=0;Ls<Fe;Ls++)Ps&&(B.framebufferTextureLayer(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,X.get(C).__webglTexture,K,ot+Ls),B.framebufferTextureLayer(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,X.get(H).__webglTexture,we,Ht+Ls)),B.blitFramebuffer(Ve,nt,Pe,Se,Be,pt,Pe,Se,B.DEPTH_BUFFER_BIT,B.NEAREST);M.bindFramebuffer(B.READ_FRAMEBUFFER,null),M.bindFramebuffer(B.DRAW_FRAMEBUFFER,null)}else if(K!==0||C.isRenderTargetTexture||X.has(C)){let Ft=X.get(C),Dn=X.get(H);M.bindFramebuffer(B.READ_FRAMEBUFFER,P),M.bindFramebuffer(B.DRAW_FRAMEBUFFER,U);for(let Et=0;Et<Fe;Et++)Ps?B.framebufferTextureLayer(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,Ft.__webglTexture,K,ot+Et):B.framebufferTexture2D(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_2D,Ft.__webglTexture,K),xt?B.framebufferTextureLayer(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,Dn.__webglTexture,we,Ht+Et):B.framebufferTexture2D(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_2D,Dn.__webglTexture,we),K!==0?B.blitFramebuffer(Ve,nt,Pe,Se,Be,pt,Pe,Se,B.COLOR_BUFFER_BIT,B.NEAREST):xt?B.copyTexSubImage3D(Ce,we,Be,pt,Ht+Et,Ve,nt,Pe,Se):B.copyTexSubImage2D(Ce,we,Be,pt,Ve,nt,Pe,Se);M.bindFramebuffer(B.READ_FRAMEBUFFER,null),M.bindFramebuffer(B.DRAW_FRAMEBUFFER,null)}else xt?C.isDataTexture||C.isData3DTexture?B.texSubImage3D(Ce,we,Be,pt,Ht,Pe,Se,Fe,vt,ni,At.data):H.isCompressedArrayTexture?B.compressedTexSubImage3D(Ce,we,Be,pt,Ht,Pe,Se,Fe,vt,At.data):B.texSubImage3D(Ce,we,Be,pt,Ht,Pe,Se,Fe,vt,ni,At):C.isDataTexture?B.texSubImage2D(B.TEXTURE_2D,we,Be,pt,Pe,Se,vt,ni,At.data):C.isCompressedTexture?B.compressedTexSubImage2D(B.TEXTURE_2D,we,Be,pt,At.width,At.height,vt,At.data):B.texSubImage2D(B.TEXTURE_2D,we,Be,pt,Pe,Se,vt,ni,At);M.pixelStorei(B.UNPACK_ROW_LENGTH,hi),M.pixelStorei(B.UNPACK_IMAGE_HEIGHT,lt),M.pixelStorei(B.UNPACK_SKIP_PIXELS,Ti),M.pixelStorei(B.UNPACK_SKIP_ROWS,Yi),M.pixelStorei(B.UNPACK_SKIP_IMAGES,In),we===0&&H.generateMipmaps&&B.generateMipmap(Ce),M.unbindTexture()},this.initRenderTarget=function(C){X.get(C).__webglFramebuffer===void 0&&q.setupRenderTarget(C)},this.initTexture=function(C){C.isCubeTexture?q.setTextureCube(C,0):C.isData3DTexture?q.setTexture3D(C,0):C.isDataArrayTexture||C.isCompressedArrayTexture?q.setTexture2DArray(C,0):q.setTexture2D(C,0),M.unbindTexture()},this.resetState=function(){F=0,O=0,z=null,M.reset(),Ae.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Hi}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=tt._getDrawingBufferColorSpace(e),t.unpackColorSpace=tt._getUnpackColorSpace()}};var Wp={type:"change"},Du={type:"start"},qp={type:"end"},yc=new $i,Xp=new $t,iM=Math.cos(70*jo.DEG2RAD),Kt=new D,xi=2*Math.PI,gt={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},Iu=1e-6,Mc=class extends Lo{constructor(e,t=null){super(e,t),this.state=gt.NONE,this.target=new D,this.cursor=new D,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:Yn.ROTATE,MIDDLE:Yn.DOLLY,RIGHT:Yn.PAN},this.touches={ONE:jn.ROTATE,TWO:jn.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._cursorStyle="auto",this._domElementKeyEvents=null,this._lastPosition=new D,this._lastQuaternion=new Qt,this._lastTargetPosition=new D,this._quat=new Qt().setFromUnitVectors(e.up,new D(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new mr,this._sphericalDelta=new mr,this._scale=1,this._panOffset=new D,this._rotateStart=new ee,this._rotateEnd=new ee,this._rotateDelta=new ee,this._panStart=new ee,this._panEnd=new ee,this._panDelta=new ee,this._dollyStart=new ee,this._dollyEnd=new ee,this._dollyDelta=new ee,this._dollyDirection=new D,this._mouse=new ee,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=sM.bind(this),this._onPointerDown=nM.bind(this),this._onPointerUp=rM.bind(this),this._onContextMenu=dM.bind(this),this._onMouseWheel=lM.bind(this),this._onKeyDown=cM.bind(this),this._onTouchStart=hM.bind(this),this._onTouchMove=uM.bind(this),this._onMouseDown=oM.bind(this),this._onMouseMove=aM.bind(this),this._interceptControlDown=fM.bind(this),this._interceptControlUp=pM.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}set cursorStyle(e){this._cursorStyle=e,e==="grab"?this.domElement.style.cursor="grab":this.domElement.style.cursor="auto"}get cursorStyle(){return this._cursorStyle}connect(e){super.connect(e),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.state=gt.NONE,this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents();let e=this.domElement.getRootNode();e.removeEventListener("keydown",this._interceptControlDown,{capture:!0}),e.removeEventListener("keyup",this._interceptControlUp,{capture:!0}),this._controlActive=!1,this._pointers.length=0,this._pointerPositions={},this.domElement.style.touchAction="",this.domElement.style.cursor="auto"}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(Wp),this.update(),this.state=gt.NONE}pan(e,t){this._pan(e,t),this.update()}dollyIn(e){this._dollyIn(e),this.update()}dollyOut(e){this._dollyOut(e),this.update()}rotateLeft(e){this._rotateLeft(e),this.update()}rotateUp(e){this._rotateUp(e),this.update()}update(e=null){let t=this.object.position;Kt.copy(t).sub(this.target),Kt.applyQuaternion(this._quat),this._spherical.setFromVector3(Kt),this.autoRotate&&this.state===gt.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let i=this.minAzimuthAngle,n=this.maxAzimuthAngle;isFinite(i)&&isFinite(n)&&(i<-Math.PI?i+=xi:i>Math.PI&&(i-=xi),n<-Math.PI?n+=xi:n>Math.PI&&(n-=xi),i<=n?this._spherical.theta=Math.max(i,Math.min(n,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(i+n)/2?Math.max(i,this._spherical.theta):Math.min(n,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let r=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{let o=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),r=o!=this._spherical.radius}if(Kt.setFromSpherical(this._spherical),Kt.applyQuaternion(this._quatInverse),t.copy(this.target).add(Kt),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let o=null;if(this.object.isPerspectiveCamera){let a=Kt.length();o=this._clampDistance(a*this._scale);let l=a-o;this.object.position.addScaledVector(this._dollyDirection,l),this.object.updateMatrixWorld(),r=!!l}else if(this.object.isOrthographicCamera){let a=new D(this._mouse.x,this._mouse.y,0);a.unproject(this.object);let l=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),r=l!==this.object.zoom;let c=new D(this._mouse.x,this._mouse.y,0);c.unproject(this.object),this.object.position.sub(c).add(a),this.object.updateMatrixWorld(),o=Kt.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;o!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(o).add(this.object.position):(yc.origin.copy(this.object.position),yc.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(yc.direction))<iM?this.object.lookAt(this.target):(Xp.setFromNormalAndCoplanarPoint(this.object.up,this.target),yc.intersectPlane(Xp,this.target))))}else if(this.object.isOrthographicCamera){let o=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),o!==this.object.zoom&&(this.object.updateProjectionMatrix(),r=!0)}return this._scale=1,this._performCursorZoom=!1,r||this._lastPosition.distanceToSquared(this.object.position)>Iu||8*(1-this._lastQuaternion.dot(this.object.quaternion))>Iu||this._lastTargetPosition.distanceToSquared(this.target)>Iu?(this.dispatchEvent(Wp),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e!==null?xi/60*this.autoRotateSpeed*e:xi/60/60*this.autoRotateSpeed}_getZoomScale(e){let t=Math.abs(e*.01);return Math.pow(.95,this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){Kt.setFromMatrixColumn(t,0),Kt.multiplyScalar(-e),this._panOffset.add(Kt)}_panUp(e,t){this.screenSpacePanning===!0?Kt.setFromMatrixColumn(t,1):(Kt.setFromMatrixColumn(t,0),Kt.crossVectors(this.object.up,Kt)),Kt.multiplyScalar(e),this._panOffset.add(Kt)}_pan(e,t){let i=this.domElement;if(this.object.isPerspectiveCamera){let n=this.object.position;Kt.copy(n).sub(this.target);let r=Kt.length();r*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*r/i.clientHeight,this.object.matrix),this._panUp(2*t*r/i.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/i.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/i.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;let i=this.domElement.getBoundingClientRect(),n=e-i.left,r=t-i.top,o=i.width,a=i.height;this._mouse.x=n/o*2-1,this._mouse.y=-(r/a)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(xi*this._rotateDelta.x/t.clientHeight),this._rotateUp(xi*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(xi*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(-xi*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(xi*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(-xi*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),t=!0;break}t&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),n=.5*(e.pageY+t.y);this._rotateStart.set(i,n)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),n=.5*(e.pageY+t.y);this._panStart.set(i,n)}}_handleTouchStartDolly(e){let t=this._getSecondPointerPosition(e),i=e.pageX-t.x,n=e.pageY-t.y,r=Math.sqrt(i*i+n*n);this._dollyStart.set(0,r)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{let i=this._getSecondPointerPosition(e),n=.5*(e.pageX+i.x),r=.5*(e.pageY+i.y);this._rotateEnd.set(n,r)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(xi*this._rotateDelta.x/t.clientHeight),this._rotateUp(xi*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),n=.5*(e.pageY+t.y);this._panEnd.set(i,n)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){let t=this._getSecondPointerPosition(e),i=e.pageX-t.x,n=e.pageY-t.y,r=Math.sqrt(i*i+n*n);this._dollyEnd.set(0,r),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);let o=(e.pageX+t.x)*.5,a=(e.pageY+t.y)*.5;this._updateZoomParameters(o,a)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new ee,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){let t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){let t=e.deltaMode,i={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:i.deltaY*=16;break;case 2:i.deltaY*=100;break}return e.ctrlKey&&!this._controlActive&&(i.deltaY*=10),i}};function nM(s){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(s.pointerId),this.domElement.ownerDocument.addEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(s)&&(this._addPointer(s),s.pointerType==="touch"?this._onTouchStart(s):this._onMouseDown(s),this._cursorStyle==="grab"&&(this.domElement.style.cursor="grabbing")))}function sM(s){this.enabled!==!1&&(s.pointerType==="touch"?this._onTouchMove(s):this._onMouseMove(s))}function rM(s){switch(this._removePointer(s),this._pointers.length){case 0:this.domElement.releasePointerCapture(s.pointerId),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(qp),this.state=gt.NONE,this._cursorStyle==="grab"&&(this.domElement.style.cursor="grab");break;case 1:let e=this._pointers[0],t=this._pointerPositions[e];this._onTouchStart({pointerId:e,pageX:t.x,pageY:t.y});break}}function oM(s){let e;switch(s.button){case 0:e=this.mouseButtons.LEFT;break;case 1:e=this.mouseButtons.MIDDLE;break;case 2:e=this.mouseButtons.RIGHT;break;default:e=-1}switch(e){case Yn.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(s),this.state=gt.DOLLY;break;case Yn.ROTATE:if(s.ctrlKey||s.metaKey||s.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(s),this.state=gt.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(s),this.state=gt.ROTATE}break;case Yn.PAN:if(s.ctrlKey||s.metaKey||s.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(s),this.state=gt.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(s),this.state=gt.PAN}break;default:this.state=gt.NONE}this.state!==gt.NONE&&this.dispatchEvent(Du)}function aM(s){switch(this.state){case gt.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(s);break;case gt.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(s);break;case gt.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(s);break}}function lM(s){this.enabled===!1||this.enableZoom===!1||this.state!==gt.NONE||(s.preventDefault(),this.dispatchEvent(Du),this._handleMouseWheel(this._customWheelEvent(s)),this.dispatchEvent(qp))}function cM(s){this.enabled!==!1&&this._handleKeyDown(s)}function hM(s){switch(this._trackPointer(s),this._pointers.length){case 1:switch(this.touches.ONE){case jn.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(s),this.state=gt.TOUCH_ROTATE;break;case jn.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(s),this.state=gt.TOUCH_PAN;break;default:this.state=gt.NONE}break;case 2:switch(this.touches.TWO){case jn.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(s),this.state=gt.TOUCH_DOLLY_PAN;break;case jn.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(s),this.state=gt.TOUCH_DOLLY_ROTATE;break;default:this.state=gt.NONE}break;default:this.state=gt.NONE}this.state!==gt.NONE&&this.dispatchEvent(Du)}function uM(s){switch(this._trackPointer(s),this.state){case gt.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(s),this.update();break;case gt.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(s),this.update();break;case gt.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(s),this.update();break;case gt.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(s),this.update();break;default:this.state=gt.NONE}}function dM(s){this.enabled!==!1&&s.preventDefault()}function fM(s){s.key==="Control"&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function pM(s){s.key==="Control"&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}var Qo=class s extends De{constructor(e,t={}){super(e),this.isReflector=!0,this.type="Reflector",this.forceUpdate=!1,this._reflectionCameras=new WeakMap;let i=this,n=t.color!==void 0?new Me(t.color):new Me(8355711),r=t.textureWidth||512,o=t.textureHeight||512,a=t.clipBias||0,l=t.shader||s.ReflectorShader,c=t.multisample!==void 0?t.multisample:4,h=new $t,f=new D,d=new D,u=new D,p=new We,x=new D(0,0,-1),m=new ut,g=new D,S=new D,T=new ut,_=new We,v=new dt(r,o,{samples:c,type:wt}),E=new ct({name:l.name!==void 0?l.name:"unspecified",uniforms:kt.clone(l.uniforms),fragmentShader:l.fragmentShader,vertexShader:l.vertexShader});E.uniforms.tDiffuse.value=v.texture,E.uniforms.color.value=n,E.uniforms.textureMatrix.value=_,this.material=E,this.onBeforeRender=function(A,y,R){let I=this.getReflectionCamera(R);if(d.setFromMatrixPosition(i.matrixWorld),u.setFromMatrixPosition(R.matrixWorld),p.extractRotation(i.matrixWorld),f.set(0,0,1),f.applyMatrix4(p),g.subVectors(d,u),g.dot(f)>0===!0&&this.forceUpdate===!1)return;g.reflect(f).negate(),g.add(d),p.extractRotation(R.matrixWorld),x.set(0,0,-1),x.applyMatrix4(p),x.add(u),S.subVectors(d,x),S.reflect(f).negate(),S.add(d),I.position.copy(g),I.up.set(0,1,0),I.up.applyMatrix4(p),I.up.reflect(f),I.lookAt(S),I.far=R.far,I.updateMatrixWorld(),I.projectionMatrix.copy(R.projectionMatrix),_.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),_.multiply(I.projectionMatrix),_.multiply(I.matrixWorldInverse),_.multiply(i.matrixWorld),h.setFromNormalAndCoplanarPoint(f,d),h.applyMatrix4(I.matrixWorldInverse),m.set(h.normal.x,h.normal.y,h.normal.z,h.constant);let b=I.projectionMatrix;I.isOrthographicCamera?(T.x=(Math.sign(m.x)+b.elements[8])/b.elements[0],T.y=(Math.sign(m.y)+b.elements[9])/b.elements[5],T.z=-R.far,T.w=1):(T.x=(Math.sign(m.x)+b.elements[8])/b.elements[0],T.y=(Math.sign(m.y)+b.elements[9])/b.elements[5],T.z=-1,T.w=(1+b.elements[10])/b.elements[14]),m.multiplyScalar(2/m.dot(T)),b.elements[2]=m.x,b.elements[6]=m.y,I.isOrthographicCamera?(b.elements[10]=m.z-a,b.elements[14]=m.w-1):(b.elements[10]=m.z+1-a,b.elements[14]=m.w),i.visible=!1;let w=A.getRenderTarget(),P=A.xr.enabled,U=A.shadowMap.autoUpdate;A.xr.enabled=!1,A.shadowMap.autoUpdate=!1,A.setRenderTarget(v),A.state.buffers.depth.setMask(!0),A.autoClear===!1&&A.clear(),A.render(y,I),A.xr.enabled=P,A.shadowMap.autoUpdate=U,A.setRenderTarget(w);let F=R.viewport;F!==void 0&&A.state.viewport(F),i.visible=!0,this.forceUpdate=!1},this.getRenderTarget=function(){return v},this.dispose=function(){v.dispose(),i.material.dispose()},this.getReflectionCamera=function(A){let y=this._reflectionCameras.get(A);return y===void 0&&(y=A.clone(),this._reflectionCameras.set(A,y)),y}}};Qo.ReflectorShader={name:"ReflectorShader",uniforms:{color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null}},vertexShader:`
		uniform mat4 textureMatrix;
		varying vec4 vUv;

		#include <common>
		#include <logdepthbuf_pars_vertex>

		void main() {

			vUv = textureMatrix * vec4( position, 1.0 );

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

			#include <logdepthbuf_vertex>

		}`,fragmentShader:`
		uniform vec3 color;
		uniform sampler2D tDiffuse;
		varying vec4 vUv;

		#include <logdepthbuf_pars_fragment>

		float blendOverlay( float base, float blend ) {

			return( base < 0.5 ? ( 2.0 * base * blend ) : ( 1.0 - 2.0 * ( 1.0 - base ) * ( 1.0 - blend ) ) );

		}

		vec3 blendOverlay( vec3 base, vec3 blend ) {

			return vec3( blendOverlay( base.r, blend.r ), blendOverlay( base.g, blend.g ), blendOverlay( base.b, blend.b ) );

		}

		void main() {

			#include <logdepthbuf_fragment>

			vec4 base = texture2DProj( tDiffuse, vUv );
			gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );

			#include <tonemapping_fragment>
			#include <colorspace_fragment>

		}`};var _i={light:{id:"light",name:"\u05D0\u05D3\u05E8\u05D9\u05DB\u05DC\u05D9 \u05D1\u05D4\u05D9\u05E8",palette:{plaster_white:15525596,plaster_exterior:13880512,plaster_ceiling:16052974,concrete:11578790,tiles_white:14868956,tiles_grey:11711928,oak:12556906,carpet:11446172,fabric_grey:9081760,fabric_accent:6716046,fabric_rug:11375233,linen:15328474,leather:5128758,wood_light:13678228,wood_dark:7034439,door_wood:12295804,metal_dark:3948614,metal_light:12238273,asphalt:7040110,grass:8887410,screen_off:1382429,shutter:14277597,section_cap:3817030,section_edge:3817030,cone:2582509,presence:2582509,open_door:14960188,lock_ok:3122027},rig:{exposureDay:.62,exposureNight:.9,sunScale:1.3,skyScale:1,envDay:.5,envNight:.22,hemiScale:.26,interiorFill:[.55,1],shadowRadius:8,rim:null,floorSheen:1,fog:{color:"#dfe6ee",density:.028},lampEmissiveDay:1.6,lampEmissiveNight:3,lampPoolDay:.5,lampPoolNight:1,lampKelvinOffset:0,moonScale:.5},post:{bloomThresholdDay:2,bloomThresholdNight:1.6,bloomStrengthDay:.12,bloomStrengthNight:.38,bloomRadius:.35,aoRadius:.6,aoIntensity:.55,contactAlpha:.46,junctionAlpha:.62,vignette:.32,contrast:1.06,saturation:1.05},cut:{fraction:.6,edge:!1,edgeWidth:0,ghostWalls:0},glass:{tint:13623530,opacity:.22,env:1.6},horizon:{low:10135703,high:12766405,radius:55,height:7},ground:{disc:13949149,discNight:1712432,contact:.38,horizonFade:!0},backdrop:{topDay:"#cfdff2",horizonDay:"#eef3f9",topNight:"#0d1a33",horizonNight:"#1a2b47",groundTint:.96},ui:{accent:"#2767ed",labelBg:"rgba(255,255,255,.86)",labelText:"#22314c",theme:"light"}},dark:{id:"dark",name:"\u05EA\u05D0\u05D5\u05DD \u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9 \u05DB\u05D4\u05D4",palette:{plaster_white:4936548,plaster_exterior:3423050,plaster_ceiling:4080980,concrete:4935769,tiles_white:7106936,tiles_grey:5199198,oak:8021584,carpet:5067355,fabric_grey:5989746,fabric_accent:5008006,fabric_rug:6314855,linen:10132902,leather:3353380,wood_light:9074016,wood_dark:4142384,door_wood:7232327,metal_dark:2764341,metal_light:9278620,asphalt:3356219,grass:4084544,screen_off:724242,shutter:8028296,section_cap:1383207,section_edge:6280191,cone:3718648,presence:3718648,open_door:16739170,lock_ok:4054148},rig:{exposureDay:.72,exposureNight:.8,sunScale:.55,skyScale:.32,envDay:.5,envNight:.2,hemiScale:.35,interiorFill:[.45,.9],shadowRadius:8,rim:{color:8177919,intensity:.55},floorSheen:.72,fog:{color:"#0a1322",density:.045},lampEmissiveDay:2.6,lampEmissiveNight:3.4,lampPoolDay:1,lampPoolNight:1.2,lampKelvinOffset:0,moonScale:.8},post:{bloomThresholdDay:1.2,bloomThresholdNight:1,bloomStrengthDay:.32,bloomStrengthNight:.5,bloomRadius:.45,aoRadius:.6,aoIntensity:.5,contactAlpha:.52,junctionAlpha:.62,vignette:.4,contrast:1.08,saturation:1},cut:{fraction:.6,edge:!0,edgeWidth:1.5,ghostWalls:0},glass:{tint:10470622,opacity:.2,env:1.8},horizon:{low:1186340,high:1779252,radius:55,height:7},ground:{disc:1119775,discNight:724759,contact:.5,horizonFade:!0},backdrop:{topDay:"#111a2b",horizonDay:"#1b2a44",topNight:"#070c17",horizonNight:"#111c33",groundTint:.5},ui:{accent:"#38bdf8",labelBg:"rgba(21,28,44,.86)",labelText:"#e6ebf5",theme:"dark"}}},F1=Object.keys(_i);function Yp(s){return s==="dark"?_i.dark:_i.light}function Uu(s){let e=s>>>0;return()=>(e=e*1664525+1013904223>>>0,e/4294967296)}function Zp(s,e,t){let i=Uu(t),n=new Float32Array((e+1)*(e+1));for(let l=0;l<n.length;l++)n[l]=i();let r=new Float32Array(s*s),o=l=>l*l*(3-2*l),a=new Float32Array(e+1);for(let l=0;l<s;l++){let c=l/s*e,h=Math.floor(c),f=o(c-h),d=(h+1)%e;for(let u=0;u<=e;u++)a[u]=n[h%e*(e+1)+u%e]*(1-f)+n[d*(e+1)+u%e]*f;for(let u=0;u<s;u++){let p=u/s*e,x=Math.floor(p),m=o(p-x);r[l*s+u]=a[x%e]*(1-m)+a[(x+1)%e]*m}}return r}function Rn(s,e,t=4,i=4){let n=new Float32Array(s*s),r=.5,o=0;for(let a=0;a<t;a++){let l=Zp(s,i<<a,e+a*97);for(let c=0;c<n.length;c++)n[c]+=l[c]*r;o+=r,r*=.5}for(let a=0;a<n.length;a++)n[a]/=o;return n}function Nu(s,e,t,i=8){let n=document.createElement("canvas");n.width=n.height=e;let r=n.getContext("2d"),o=r.createImageData(e,e);o.data.set(s),r.putImageData(o,0,0);let a=new Ci(n);return a.wrapS=a.wrapT=Xt,a.colorSpace=t?Mt:Pi,a.anisotropy=i,a.needsUpdate=!0,a}function mM(s,e,t){let i=new Uint8ClampedArray(e*e*4),n=e;for(let r=0;r<n;r++){let o=(r-1+n)%n*n,a=r*n,l=(r+1)%n*n;for(let c=0;c<n;c++){let h=(c-1+n)%n,f=(c+1)%n,d=s[o+f]+2*s[a+f]+s[l+f]-(s[o+h]+2*s[a+h]+s[l+h]),u=s[l+h]+2*s[l+c]+s[l+f]-(s[o+h]+2*s[o+c]+s[o+f]),p=-d*t,x=-u*t,m=1,g=Math.hypot(p,x,m);p/=g,x/=g,m/=g;let S=(a+c)*4;i[S]=(p*.5+.5)*255,i[S+1]=(x*.5+.5)*255,i[S+2]=(m*.5+.5)*255,i[S+3]=255}}return i}function gM(s,e,t=200,i=40,n=[1,1,1]){let r=new Uint8ClampedArray(e*e*4);for(let o=0,a=0;o<s.length;o++,a+=4){let l=t+(s[o]-.5)*2*i;r[a]=l*n[0],r[a+1]=l*n[1],r[a+2]=l*n[2],r[a+3]=255}return r}function xM(s,e){let t=new Uint8ClampedArray(e*e*4);for(let i=0,n=0;i<s.length;i++,n+=4){let r=Math.max(0,Math.min(1,s[i]))*255;t[n]=r,t[n+1]=r,t[n+2]=r,t[n+3]=255}return t}var Wt={planks(s,e,t=6,i=.35){let n=Rn(s,e,5,2),r=s/t,o=Uu(e+11),a=Array.from({length:t},()=>Math.floor(o()*s)),l=Array.from({length:t},()=>.88+o()*.24),c=new Float32Array(s*s),h=new Float32Array(s*s),f=new Float32Array(s*s);for(let d=0;d<s;d++)for(let u=0;u<s;u++){let p=Math.floor(u/r),x=(d+a[p])%s,m=n[x*s+u*3%s],g=.5+.5*Math.sin(u/r*Math.PI*9+m*11),S=u%r<1.5||x%s<1.5,T=d*s+u;c[T]=S?.2:Math.min(1,(.5+(m-.5)*i+(g-.5)*.12)*l[p]),h[T]=S?0:.75+.25*m,f[T]=S?.9:.42+.2*m}return{lum:c,height:h,rough:f,mid:196,amp:46,tint:[1,.98,.95]}},tiles(s,e,t=2,i=3,n=!1){let r=Rn(s,e,3,8),o=s/t,a=new Float32Array(s*s),l=new Float32Array(s*s),c=new Float32Array(s*s);for(let h=0;h<s;h++)for(let f=0;f<s;f++){let d=h*s+f,u=f%o<i||h%o<i,p=Math.floor(f/o),x=Math.floor(h/o),m=.5+(r[d]-.5)*.5+((p*7+x*13)%5-2)*.025;a[d]=u?.32:m,l[d]=u?0:1-r[d]*.06,c[d]=u?.95:n?.18+r[d]*.1:.4+r[d]*.15}return{lum:a,height:l,rough:c,mid:206,amp:22}},plaster(s,e,t=.12){let i=Rn(s,e,5,6),n=new Float32Array(s*s);for(let o=0;o<n.length;o++)n[o]=.82+i[o]*.15;let r=new Float32Array(s*s);for(let o=0;o<r.length;o++)r[o]=.5+(i[o]-.5)*t*2;return{lum:r,height:i,rough:n,mid:214,amp:14}},concrete(s,e){let t=Rn(s,e,6,3),i=Zp(s,64,e+5),n=new Float32Array(s*s),r=new Float32Array(s*s);for(let o=0;o<n.length;o++)n[o]=.5+(t[o]-.5)*.7+(i[o]>.94?-.2:0),r[o]=.7+t[o]*.25;return{lum:n,height:t,rough:r,mid:200,amp:30}},fabric(s,e,t=.8,i=.5){let n=Rn(s,e,5,24),r=new Float32Array(s*s),o=new Float32Array(s*s);for(let l=0;l<s;l++)for(let c=0;c<s;c++){let h=l*s+c,f=.5+.5*Math.sin(c*t)*Math.sin(l*t);r[h]=.5+((n[h]-.5)*.6+(f-.5)*.4)*i,o[h]=n[h]*.6+f*.4}let a=new Float32Array(s*s).fill(.92);return{lum:r,height:o,rough:a,mid:200,amp:26}},wood(s,e,t=.12){let i=Rn(s,e,4,2),n=new Float32Array(s*s),r=new Float32Array(s*s);for(let o=0;o<s;o++)for(let a=0;a<s;a++){let l=o*s+a,c=.5+.5*Math.sin(o*t+i[l]*7);n[l]=.5+(c-.5)*.5+(i[l]-.5)*.4,r[l]=.38+i[l]*.2}return{lum:n,height:i,rough:r,mid:200,amp:28,tint:[1,.98,.95]}},metal(s,e){let t=Rn(s,e,3,4),i=new Float32Array(s*s),n=new Float32Array(s*s);for(let r=0;r<s;r++)for(let o=0;o<s;o++){let a=r*s+o,l=t[r*7%s*s+o%s];i[a]=.5+(l-.5)*.5,n[a]=.3+l*.15}return{lum:i,height:i,rough:n,mid:215,amp:10}},leather(s,e){let t=Rn(s,e,6,20),i=new Float32Array(s*s),n=new Float32Array(s*s);for(let r=0;r<i.length;r++)i[r]=t[r],n[r]=.45+t[r]*.3;return{lum:i,height:t,rough:n,mid:205,amp:22}},grass(s,e){let t=Rn(s,e,6,10),i=new Float32Array(s*s).fill(.95);return{lum:t,height:t,rough:i,mid:205,amp:40}}},$o={plaster_white:{size:512,recipe:s=>Wt.plaster(s,31,.1),tile_m:2,normal:.22,roughness:1},plaster_exterior:{size:512,recipe:s=>Wt.plaster(s,47,.16),tile_m:2,normal:.6,roughness:1},plaster_ceiling:{size:256,recipe:s=>Wt.plaster(s,53,.03),tile_m:3,normal:.04,roughness:1},concrete:{size:512,recipe:s=>Wt.concrete(s,61),tile_m:2.5,normal:1.2,roughness:1},tiles_white:{size:512,recipe:s=>Wt.tiles(s,71,4,3,!0),tile_m:1.2,normal:1.8,roughness:1},tiles_grey:{size:512,recipe:s=>Wt.tiles(s,79,2,3,!1),tile_m:1.2,normal:1.8,roughness:1},oak:{size:512,recipe:s=>Wt.planks(s,83,6,.35),tile_m:1.2,normal:1.6,roughness:1},carpet:{size:256,recipe:s=>Wt.fabric(s,89,1.3,.35),tile_m:.5,normal:.8,roughness:1},fabric_grey:{size:256,recipe:s=>Wt.fabric(s,97,.8,.5),tile_m:.6,normal:.9,roughness:1},fabric_accent:{size:256,recipe:s=>Wt.fabric(s,101,.8,.5),tile_m:.6,normal:.9,roughness:1},fabric_rug:{size:256,recipe:s=>Wt.fabric(s,102,1.6,.4),tile_m:.8,normal:1,roughness:1},linen:{size:256,recipe:s=>Wt.fabric(s,103,1.1,.3),tile_m:.8,normal:.6,roughness:1},leather:{size:256,recipe:s=>Wt.leather(s,105),tile_m:.6,normal:.8,roughness:1},wood_light:{size:256,recipe:s=>Wt.wood(s,107,.12),tile_m:1,normal:.7,roughness:1},wood_dark:{size:256,recipe:s=>Wt.wood(s,109,.1),tile_m:1,normal:.7,roughness:1},door_wood:{size:256,recipe:s=>Wt.wood(s,113,.14),tile_m:1,normal:.9,roughness:1},metal_dark:{size:256,recipe:s=>Wt.metal(s,127),tile_m:.5,normal:.12,roughness:1,metalness:.85},metal_light:{size:256,recipe:s=>Wt.metal(s,131),tile_m:.5,normal:.12,roughness:1,metalness:.8},asphalt:{size:256,recipe:s=>Wt.concrete(s,137),tile_m:3,normal:1.2,roughness:1},grass:{size:256,recipe:s=>Wt.grass(s,139),tile_m:2,normal:.8,roughness:1}},jp={plaster_white:"Plaster001",plaster_exterior:"Plaster003",concrete:"Concrete034",brick_painted:"Bricks059",tiles_white:"Tiles074",oak:"WoodFloor051",tiles_grey:"Tiles101",carpet:"Carpet013",asphalt:"Asphalt012",grass:"Grass004",wood_light:"Wood049",wood_dark:"Wood049",door_wood:"Wood049",metal_dark:"Metal032",metal_light:"Metal032",fabric_grey:"Fabric030",fabric_accent:"Fabric030",fabric_rug:"Fabric030",linen:"Fabric024",leather:"Leather011",floor_sport:"WoodFloor040"},wc=class{constructor(e=_i.light){this.cache=new Map,this.materials=new Map,this.bytes=0,this.genMs=0,this.style=e}palette(e){return this.style.palette[e]??this.style.palette.plaster_white}fileTextures(e,t){let i=this.base||"assets/textures/",n=`${i}sets/${jp[e]}/`,r=`${i}${e}/`;this.loader||(this.loader=new _s,this.loaded=new Set,this.failed=new Set);let o=(l,c)=>{let h=this.loader.load(l,()=>{this.loaded.add(e),this.onLoaded&&this.onLoaded(e)},void 0,()=>{this.failed.add(e),this.cache.delete(e),this.onLoaded&&this.onLoaded(e)});return h.wrapS=h.wrapT=Xt,h.colorSpace=c?Mt:Pi,h.anisotropy=8,h},a=o(n+"rough_ao.jpg",!1);return this.bytes+=512*512*4*3*1.33,{map:o(r+"color.webp",!0),normalMap:o(n+"normal.jpg",!1),roughnessMap:a,aoMap:a,tile_m:t.tile_m,spec:t,file:!0}}textures(e){let t=this.cache.get(e);if(t)return t;let i=performance.now(),n=$o[e]||$o.plaster_white;if((this.textureSource||"files")==="files"&&jp[e]&&!(this.failed&&this.failed.has(e)))return t=this.fileTextures(e,n),this.cache.set(e,t),t;let r=n.size,o=n.recipe(r),a=Nu(gM(o.lum,r,o.mid,o.amp,o.tint),r,!0),l=Nu(mM(o.height,r,n.normal),r,!1),c=Nu(xM(o.rough,r),r,!1,2);return t={map:a,normalMap:l,roughnessMap:c,tile_m:n.tile_m,spec:n},this.bytes+=r*r*4*3*1.33,this.genMs+=performance.now()-i,this.cache.set(e,t),t}get(e,t,i={}){let n=`${e}|${t}|${i.side||0}|${i.variant||""}|${i.roughness??""}`,r=this.materials.get(n);if(r)return r;let o=$o[e]||{},a=this.palette(e);if(t>=3){let l=this.textures(e);r=new Pt({map:l.map,normalMap:l.normalMap,roughnessMap:l.roughnessMap,roughness:1,metalness:o.metalness??0,color:a,envMapIntensity:o.metalness?1:.7}),l.aoMap&&(r.aoMap=l.aoMap,r.aoMap.channel=0,r.aoMapIntensity=.6),l.file&&r.normalScale.set(o.normal,o.normal)}else t===2?r=new Pt({color:a,roughness:.85,metalness:o.metalness?.6:0}):r=new Mo({color:a});return r.userData.materialId=e,i.variant&&(r.userData.variant=i.variant),i.roughness!=null&&t>=3&&(r.roughness=i.roughness),i.variant==="floor"&&t>=3&&(r.roughness=this.style.rig.floorSheen??1),i.side&&(r.side=i.side),this.materials.set(n,r),r}setStyle(e){this.style=e;for(let t of this.materials.values()){let i=t.userData.materialId;i&&t.color.setHex(this.palette(i)),t.userData.variant==="floor"&&t.isMeshStandardMaterial&&t.map&&(t.roughness=e.rig.floorSheen??1)}}tileM(e){return($o[e]||$o.plaster_white).tile_m}dispose(){for(let e of this.cache.values())e.map.dispose(),e.normalMap.dispose(),e.roughnessMap.dispose();for(let e of this.materials.values())e.dispose();this.cache.clear(),this.materials.clear(),this.bytes=0}},bc=null,Cr=null;function Ou(){if(bc)return bc;let s=document.createElement("canvas");s.width=s.height=128;let e=s.getContext("2d"),t=e.createRadialGradient(64,64,0,64,64,64);return t.addColorStop(0,"rgba(0,0,0,1)"),t.addColorStop(.45,"rgba(0,0,0,0.75)"),t.addColorStop(.8,"rgba(0,0,0,0.18)"),t.addColorStop(1,"rgba(0,0,0,0)"),e.fillStyle=t,e.fillRect(0,0,128,128),bc=new Ci(s),bc}var Sc=null;function Fu(){if(Sc)return Sc;let s=document.createElement("canvas");s.width=s.height=256;let e=s.getContext("2d"),t=e.createRadialGradient(128,128,0,128,128,128);return t.addColorStop(0,"#fff"),t.addColorStop(.55,"#fff"),t.addColorStop(1,"#000"),e.fillStyle=t,e.fillRect(0,0,256,256),Sc=new Ci(s),Sc}var Rr=null;function Kp(){if(Rr)return Rr;let s=document.createElement("canvas");s.width=1024,s.height=128;let e=s.getContext("2d");e.fillStyle="#000",e.fillRect(0,0,1024,128);let t=Uu(77);e.fillStyle="#fff",e.beginPath(),e.moveTo(0,128);for(let n=0;n<=1024;n+=8){let r=60+22*Math.sin(n*.02)+14*Math.sin(n*.071+1.3)+t()*10;e.lineTo(n,128-r)}e.lineTo(1024,128),e.closePath(),e.fill();let i=e.createLinearGradient(0,0,0,128);return i.addColorStop(0,"rgba(0,0,0,0.35)"),i.addColorStop(.55,"rgba(0,0,0,0)"),i.addColorStop(1,"rgba(0,0,0,0)"),e.fillStyle=i,e.fillRect(0,0,1024,128),Rr=new Ci(s),Rr.wrapS=Xt,Rr.repeat.set(6,1),Rr}function Jp(){if(Cr)return Cr;let s=document.createElement("canvas");s.width=4,s.height=64;let e=s.getContext("2d"),t=e.createLinearGradient(0,0,0,64);return t.addColorStop(0,"rgba(0,0,0,1)"),t.addColorStop(.35,"rgba(0,0,0,0.45)"),t.addColorStop(1,"rgba(0,0,0,0)"),e.fillStyle=t,e.fillRect(0,0,4,64),Cr=new Ci(s),Cr.wrapS=Xt,Cr.wrapT=pi,Cr}function Es(s,e=!1){let t=s[0].index!==null,i=new Set(Object.keys(s[0].attributes)),n=new Set(Object.keys(s[0].morphAttributes)),r={},o={},a=s[0].morphTargetsRelative,l=new _t,c=0;for(let h=0;h<s.length;++h){let f=s[h],d=0;if(t!==(f.index!==null))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(let u in f.attributes){if(!i.has(u))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+'. All geometries must have compatible attributes; make sure "'+u+'" attribute exists among all geometries, or in none of them.'),null;r[u]===void 0&&(r[u]=[]),r[u].push(f.attributes[u]),d++}if(d!==i.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". Make sure all geometries have the same number of attributes."),null;if(a!==f.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(let u in f.morphAttributes){if(!n.has(u))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+".  .morphAttributes must be consistent throughout all geometries."),null;o[u]===void 0&&(o[u]=[]),o[u].push(f.morphAttributes[u])}if(e){let u;if(t)u=f.index.count;else if(f.attributes.position!==void 0)u=f.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". The geometry must have either an index or a position attribute"),null;l.addGroup(c,u,h),c+=u}}if(t){let h=0,f=[];for(let d=0;d<s.length;++d){let u=s[d].index;for(let p=0;p<u.count;++p)f.push(u.getX(p)+h);h+=s[d].attributes.position.count}l.setIndex(f)}for(let h in r){let f=Qp(r[h]);if(!f)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" attribute."),null;l.setAttribute(h,f)}for(let h in o){let f=o[h][0].length;if(f!==0){l.morphAttributes=l.morphAttributes||{},l.morphAttributes[h]=[];for(let d=0;d<f;++d){let u=[];for(let x=0;x<o[h].length;++x)u.push(o[h][x][d]);let p=Qp(u);if(!p)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" morphAttribute."),null;l.morphAttributes[h].push(p)}}}return l}function Qp(s){let e,t,i,n=-1,r=0;for(let c=0;c<s.length;++c){let h=s[c];if(e===void 0&&(e=h.array.constructor),e!==h.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(t===void 0&&(t=h.itemSize),t!==h.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(i===void 0&&(i=h.normalized),i!==h.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(n===-1&&(n=h.gpuType),n!==h.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;r+=h.count*t}let o=new e(r),a=new Ct(o,t,i),l=0;for(let c=0;c<s.length;++c){let h=s[c];if(h.isInterleavedBufferAttribute){let f=l/t;for(let d=0,u=h.count;d<u;d++)for(let p=0;p<t;p++){let x=h.getComponent(d,p);a.setComponent(d+f,p,x)}}else o.set(h.array,l);l+=h.count*t}return n!==void 0&&(a.gpuType=n),a}function Bu(s,e){if(e===nu)return console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles."),s;if(e===yr||e===Yo){let t=s.getIndex();if(t===null){let r=[],o=s.getAttribute("position");if(o!==void 0){for(let a=0;a<o.count;a++)r.push(a);s.setIndex(r),t=s.getIndex()}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible."),s}let i=t.count-2,n=[];if(e===yr)for(let r=1;r<=i;r++)n.push(t.getX(0)),n.push(t.getX(r)),n.push(t.getX(r+1));else for(let r=0;r<i;r++)r%2===0?(n.push(t.getX(r)),n.push(t.getX(r+1)),n.push(t.getX(r+2))):(n.push(t.getX(r+2)),n.push(t.getX(r+1)),n.push(t.getX(r)));return n.length/3!==i&&console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles."),s.setIndex(n),s.clearGroups(),s}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:",e),s}function $p(s,e=Math.PI/3){let t=s.index?s.toNonIndexed():s,i=t.attributes.position,n=i.count,r;if(i.isBufferAttribute===!0&&i.itemSize===3&&i.normalized===!1)r=i.array;else{r=new Float64Array(n*3);for(let _=0;_<n;_++)r[3*_+0]=i.getX(_),r[3*_+1]=i.getY(_),r[3*_+2]=i.getZ(_)}let o=Math.cos(e),a=(1+1e-10)*100,l=n/3,c=new Float64Array(l*3);for(let _=0;_<l;_++){let v=9*_,E=r[v+0],A=r[v+1],y=r[v+2],R=r[v+3],I=r[v+4],L=r[v+5],b=r[v+6],w=r[v+7],P=r[v+8],U=b-R,F=w-I,O=P-L,z=E-R,k=A-I,G=y-L,Y=F*G-O*k,he=O*z-U*G,pe=U*k-F*z,Te=1/(Math.sqrt(Y*Y+he*he+pe*pe)||1);c[3*_+0]=Y*Te,c[3*_+1]=he*Te,c[3*_+2]=pe*Te}let h=new Int32Array(n),f=new Float64Array(n*3),d=1;for(;d<n*2;)d<<=1;let u=d-1,p=new Int32Array(d),x=0;for(let _=0;_<n;_++){let v=3*_,E=Math.trunc(r[v+0]*a),A=Math.trunc(r[v+1]*a),y=Math.trunc(r[v+2]*a),R=(Math.imul(E,73856093)^Math.imul(A,19349663)^Math.imul(y,83492791))&u;for(;;){let I=p[R];if(I===0){let b=3*x;f[b+0]=E,f[b+1]=A,f[b+2]=y,p[R]=x+1,h[_]=x++;break}let L=3*(I-1);if(f[L+0]===E&&f[L+1]===A&&f[L+2]===y){h[_]=I-1;break}R=R+1&u}}let m=new Int32Array(x+1);for(let _=0;_<n;_++)m[h[_]+1]++;for(let _=0;_<x;_++)m[_+1]+=m[_];let g=new Int32Array(n),S=m.slice(0,x);for(let _=0;_<l;_++){let v=3*_;g[S[h[v+0]]++]=_,g[S[h[v+1]]++]=_,g[S[h[v+2]]++]=_}let T=new Float32Array(n*3);for(let _=0;_<l;_++){let v=3*_,E=c[v+0],A=c[v+1],y=c[v+2];for(let R=0;R<3;R++){let I=v+R,L=h[I],b=0,w=0,P=0;for(let F=m[L],O=m[L+1];F<O;F++){let z=3*g[F],k=c[z+0],G=c[z+1],Y=c[z+2];E*k+A*G+y*Y>o&&(b+=k,w+=G,P+=Y)}let U=1/(Math.sqrt(b*b+w*w+P*P)||1);T[3*I+0]=b*U,T[3*I+1]=w*U,T[3*I+2]=P*U}}return t.setAttribute("normal",new Ct(T,3,!1)),t}var ea=new D;function Li(s,e,t,i,n,r){let o=2*Math.PI*n/4,a=Math.max(r-2*n,0),l=Math.PI/4;ea.copy(e),ea[i]=0,ea.normalize();let c=.5*o/(o+a),h=1-ea.angleTo(s)/l;return Math.sign(ea[t])===1?h*c:a/(o+a)+c+c*(1-h)}var Xi=class s extends qt{constructor(e=1,t=1,i=1,n=2,r=.1){let o=n*2+1;if(r=Math.min(e/2,t/2,i/2,r),super(1,1,1,o,o,o),this.type="RoundedBoxGeometry",this.parameters={width:e,height:t,depth:i,segments:n,radius:r},o===1)return;let a=this.toNonIndexed();this.index=null,this.attributes.position=a.attributes.position,this.attributes.normal=a.attributes.normal,this.attributes.uv=a.attributes.uv;let l=new D,c=new D,h=new D(e,t,i).divideScalar(2).subScalar(r),f=this.attributes.position.array,d=this.attributes.normal.array,u=this.attributes.uv.array,p=f.length/6,x=new D,m=.5/o;for(let g=0,S=0;g<f.length;g+=3,S+=2)switch(l.fromArray(f,g),c.copy(l),c.x-=Math.sign(c.x)*m,c.y-=Math.sign(c.y)*m,c.z-=Math.sign(c.z)*m,c.normalize(),f[g+0]=h.x*Math.sign(l.x)+c.x*r,f[g+1]=h.y*Math.sign(l.y)+c.y*r,f[g+2]=h.z*Math.sign(l.z)+c.z*r,d[g+0]=c.x,d[g+1]=c.y,d[g+2]=c.z,Math.floor(g/p)){case 0:x.set(1,0,0),u[S+0]=Li(x,c,"z","y",r,i),u[S+1]=1-Li(x,c,"y","z",r,t);break;case 1:x.set(-1,0,0),u[S+0]=1-Li(x,c,"z","y",r,i),u[S+1]=1-Li(x,c,"y","z",r,t);break;case 2:x.set(0,1,0),u[S+0]=1-Li(x,c,"x","z",r,e),u[S+1]=Li(x,c,"z","x",r,i);break;case 3:x.set(0,-1,0),u[S+0]=1-Li(x,c,"x","z",r,e),u[S+1]=1-Li(x,c,"z","x",r,i);break;case 4:x.set(0,0,1),u[S+0]=1-Li(x,c,"x","y",r,e),u[S+1]=1-Li(x,c,"y","x",r,t);break;case 5:x.set(0,0,-1),u[S+0]=Li(x,c,"x","y",r,e),u[S+1]=1-Li(x,c,"y","x",r,t);break}}static fromJSON(e){return new s(e.width,e.height,e.depth,e.segments,e.radius)}};var _M=["open","opening","on"],Tc=s=>!!s&&_M.includes(s),em=(s,e)=>s.id<e.id?-1:s.id>e.id?1:0;function vM(s){let e=s.dimensions,t=e.scale_m_per_px,i=e.calibration&&e.calibration.status;return typeof t=="number"&&Number.isFinite(t)&&t>0&&(i==="measured"||i==="estimated")?{scale:t,estimated:i==="estimated"}:{scale:.2/(.006*(e.width_px||1e3)),estimated:!0}}function yM(s){let e=[0];for(let t=1;t<s.length;t++)e.push(e[t-1]+Math.hypot(s[t][0]-s[t-1][0],s[t][1]-s[t-1][1]));return e}function ku(s,e,t){let i=0;for(;i<s.length-2&&t>e[i+1];)i++;let[n,r]=s[i],[o,a]=s[i+1],l=e[i+1]-e[i];if(l<=1e-9)return{p:[n,r],d:[1,0]};let c=Math.min(1,Math.max(0,(t-e[i])/l));return{p:[n+(o-n)*c,r+(a-r)*c],d:[(o-n)/l,(a-r)/l]}}function MM(s,e,t,i){let n=[];for(let r=1;r<s.length-1;r++)t<e[r]&&e[r]<i&&n.push(s[r]);return[ku(s,e,t).p,...n,ku(s,e,i).p]}var tm=(s,e,t)=>{let i=s[0]-e[0],n=s[1]-e[1],r=Math.hypot(i,n);return r<1e-9?s:[s[0]+i/r*t,s[1]+n/r*t]},im=(s,e,t)=>[s[0]+e[0]*t,s[1]+e[1]*t];function ta(s,e,t,i){let{scale:n}=vM(s),r=1/n,o=new Map;for(let h of s.openings){let f=o.get(h.wall_id);f?f.push(h):o.set(h.wall_id,[h])}let a=[],l=new Map;for(let h of[...new Map(s.walls.map(f=>[f.id,f])).values()].sort(em)){if(i!=null&&h.level_id!==i)continue;let f=h.polyline.map(T=>[T[0]*e,T[1]*t]),d=yM(f),u=d[d.length-1];if(u<=1e-6)continue;let p=Math.max(1,(h.thickness_m||.2)*r);l.set(h.id,{pts:f,cum:d,wpx:p,wall:h});let x=(o.get(h.id)||[]).map(T=>{let _=(T.t||0)*u,v=(T.width_m||0)*r/2;return[Math.max(0,_-v),Math.min(u,_+v)]});x.sort((T,_)=>T[0]-_[0]||T[1]-_[1]);let m=[],g=0;for(let[T,_]of x)T>g&&m.push([g,T]),g=Math.max(g,_);g<u&&m.push([g,u]);let S=0;for(let[T,_]of m){if(_-T<=.01)continue;let v=MM(f,d,T,_);T<=0&&(v[0]=tm(v[0],v[1],p/2)),_>=u&&(v[v.length-1]=tm(v[v.length-1],v[v.length-2],p/2)),a.push({id:h.id,part:S,points:v,width:p,wall:h}),S+=1}}let c=[];for(let h of[...s.openings].sort(em)){let f=l.get(h.wall_id);if(!f)continue;let{p:d,d:u}=ku(f.pts,f.cum,(h.t||0)*f.cum[f.cum.length-1]),p=(h.width_m||0)*r;c.push({opening:h,wall:f.wall,c:d,d:u,g0:im(d,u,-p/2),g1:im(d,u,p/2),w:p,wpx:f.wpx})}return{walls:a,openings:c,scale:n}}function zu(s,e,t,i,n,r={}){let{walls:o,openings:a}=ta(s,e,t,i),l=[];for(let c of o)if(!(r.bodyOnly===!1&&(c.wall.kind==="railing"||c.wall.kind==="low")))for(let h=1;h<c.points.length;h++)l.push({a:c.points[h-1],b:c.points[h],w:c.width,kind:c.wall.kind,id:c.id});for(let c of a){let h=c.opening.kind;if(h!=="passage"){if(h==="door"){let f=c.opening.anchor_ref,d=f&&f.resource_type==="ha_entity"?n[f.resource_id]:void 0;if(!f||Tc(d))continue;let u=r.locks&&r.locks[c.opening.id]}l.push({a:c.g0,b:c.g1,w:c.wpx,kind:h,id:c.opening.id})}}return l}function Pn(s,e,t){let i=!1;for(let n=0,r=t.length-1;n<t.length;r=n++){let o=t[n][0],a=t[n][1],l=t[r][0],c=t[r][1];a>e!=c>e&&s<(l-o)*(e-a)/(c-a)+o&&(i=!i)}return i}function Pr(s){let e=0,t=0,i=0;for(let n=0;n<s.length;n++){let[r,o]=s[n],[a,l]=s[(n+1)%s.length],c=r*l-a*o;e+=c,t+=(r+a)*c,i+=(o+l)*c}return Math.abs(e)<1e-9?[s[0][0],s[0][1]]:[t/(3*e),i/(3*e)]}function Hu(s,e){let t=s.length;if(t<2)return[];let i=[];for(let a=0;a<t-1;a++){let l=s[a+1][0]-s[a][0],c=s[a+1][1]-s[a][1],h=Math.hypot(l,c)||1;i.push([l/h,c/h])}let n=a=>{let l=[];for(let c=0;c<t;c++){let h=i[Math.max(0,c-1)],f=i[Math.min(t-2,c)],d=[-h[1]*a,h[0]*a],u=[-f[1]*a,f[0]*a],p=d[0]+u[0],x=d[1]+u[1],m=Math.hypot(p,x);if(m<1e-6){l.push([s[c][0]+u[0]*e,s[c][1]+u[1]*e]);continue}let g=(p*u[0]+x*u[1])/m,S=e/Math.max(g,.25);l.push([s[c][0]+p/m*S,s[c][1]+x/m*S])}return l},r=n(1),o=n(-1).reverse();return[...r,...o]}var om=1.65,nm=8,bM=85,SM=350,Ec=(s,e)=>-Math.atan2(e,s),sm=(s,e,t)=>s+(e-s)*t;function Gu(s,e,t,i,n=[[0,0],[1,0],[1,1],[0,1]]){let r=new _t,o=[s,e,t,s,t,i].flat(),a=[n[0],n[1],n[2],n[0],n[2],n[3]].flat();return r.setAttribute("position",new at(o,3)),r.setAttribute("uv",new at(a,2)),r.computeVertexNormals(),r}function wM(s,e,t=.3,i=.3,n=.32){let r=s.length,o=[];for(let a=0;a<r;a++){let l=s[a],c=s[(a+1)%r],h=Math.hypot(c[0]-l[0],c[1]-l[1]);if(h<n)continue;let f=-(c[1]-l[1])/h,d=(c[0]-l[0])/h;Pn((l[0]+c[0])/2+f*.02,(l[1]+c[1])/2+d*.02,s)&&(f=-f,d=-d);let u=h/.5;o.push(Gu([l[0],e+.006,l[1]],[c[0],e+.006,c[1]],[c[0]+f*t,e+.006,c[1]+d*t],[l[0]+f*t,e+.006,l[1]+d*t],[[0,0],[u,0],[u,1],[0,1]]));let p=.004;o.push(Gu([l[0]+f*p,e,l[1]+d*p],[c[0]+f*p,e,c[1]+d*p],[c[0]+f*p,e+i,c[1]+d*p],[l[0]+f*p,e+i,l[1]+d*p],[[0,0],[u,0],[u,1],[0,1]]))}return o}function Ii(s,e,t=[0,0,0]){let i=s.index?s.toNonIndexed():s,n=i.attributes.position,r=new Float32Array(n.count*2),o=new D,a=new D,l=new D,c=new D;for(let h=0;h<n.count;h+=3){o.fromBufferAttribute(n,h),a.fromBufferAttribute(n,h+1),l.fromBufferAttribute(n,h+2),c.copy(a).sub(o).cross(l.clone().sub(o));let f=Math.abs(c.x),d=Math.abs(c.y),u=Math.abs(c.z);for(let p=0;p<3;p++){let x=[o,a,l][p],m,g;f>=d&&f>=u?(m=x.z+t[2],g=x.y+t[1]):d>=u?(m=x.x+t[0],g=x.z+t[2]):(m=x.x+t[0],g=x.y+t[1]),r[(h+p)*2]=m/e,r[(h+p)*2+1]=g/e}}return i.setAttribute("uv",new Ct(r,2)),i.computeVertexNormals(),i}function Lr(s){let e=new gs;return s.forEach(([t,i],n)=>n?e.lineTo(t,-i):e.moveTo(t,-i)),e.closePath(),e}function Ac(s,e,t){let i=new vo(Lr(s),{depth:e,bevelEnabled:!1,curveSegments:1});return i.rotateX(-Math.PI/2),i.translate(0,t,0),i}function Nt(s,e,t,i,n,r,o=0){let a=new qt(s,e,t);return o&&a.rotateY(o),a.translate(i,n,r),a}function rm(s,e,t,i,n,r=16,o=s){let a=new Yt(o,s,e,r);return a.translate(t,i,n),a}var Vu=(s,e)=>{let[t,i]=Pr(s);return s.map(([n,r])=>[n+Math.sign(t-n)*e,r+Math.sign(i-r)*e])},Rc=class{constructor(e){this.lib=e,this.root=new Gt,this.root.name="plan",this.levels={},this.doors=[],this.shutters=[],this.lamps=[],this.devices=[],this.markers=[],this.presence=[],this.tints=[],this.pool=[],this.labels=[],this.quality=3,this.reflectors=[],this.cameras=[],this.mirror=null,this.style=e.style||_i.light,this.cutY=null,this.clipMaterials=new Set,this.styled=[],this.furnitureMode="procedural"}dispose(){this.root.traverse(e=>{e.geometry&&e.geometry.dispose()}),this.root.clear(),this.levels={},this.doors=[],this.shutters=[],this.lamps=[],this.devices=[],this.markers=[],this.presence=[],this.tints=[],this.labels=[],this.cameras=[],this.clipMaterials.clear(),this.styled=[],this.screens=[],this.lockPlates=[],this.ground=null;for(let e of this.pool)e.parent&&e.parent.remove(e);this.pool=[]}setStyle(e){this.style=e,this.lib.setStyle(e);let t=e.palette;for(let i of this.styled){let n=t[i.key];n!==void 0&&(i.prop==="color"?i.material.color.setHex(n):i.prop==="emissive"?(i.material.color.setHex(n),i.material.emissive.setHex(n)):i.prop==="opacity"&&(i.material.opacity=e.post[i.key]))}for(let i of Object.values(this.levels))i.capEdges&&(i.capEdges.visible=!!e.cut.edge&&i.capMesh.visible);this.ground&&(this.ground.disc.material.color.setHex(e.ground.disc),this.ground.shadow.material.opacity=e.ground.contact,this.ground.band&&e.horizon&&this.ground.band.material.color.setHex(e.horizon.low));for(let i of this.styled)i.key==="glass_tint"&&e.glass&&(i.material.color.setHex(e.glass.tint),i.material.envMapIntensity=e.glass.env,i.material.opacity<.5&&(i.material.opacity=e.glass.opacity))}setNight(e){this.ground&&this.ground.disc.material.color.setHex(this.style.ground.disc).lerp(new Me(this.style.ground.discNight),e)}styledMaterial(e,t,i="color"){return this.styled.push({material:e,key:t,prop:i}),e}setCut(e,t){this.cutY=e,this.cutLevel=t;let i=e==null?null:[new $t(new D(0,-1,0),e)];for(let n of this.clipMaterials)n.clippingPlanes=i,n.clipShadows=!!i,n.needsUpdate=n.needsUpdate||!1;for(let n of Object.values(this.levels)){let r=e!=null&&n.id===t;n.capMesh&&(n.capMesh.visible=r,n.capMesh.position.y=e??0),n.capEdges&&(n.capEdges.visible=r&&!!this.style.cut.edge,n.capEdges.position.y=e??0)}}build(e,t,i={}){this.dispose(),this.plan=e,this.quality=t,this.reflections=!!i.reflections;let n=e.doc,r=n.dimensions.width_px,o=n.dimensions.height_px,{scale:a}=ta(n,r,o,null);this.scale=a,this.W=r,this.H=o;let l=m=>[m[0]*r*a,m[1]*o*a];this.toM=l;let c=t,h=this.lib,f=(m,g)=>h.get(m,c,{side:g}),d=new Map(n.levels.map(m=>[m.id,m])),u=e.entities;for(let m of n.levels){let g=new Gt;g.name=`level:${m.id}`,this.root.add(g);let S=m.elevation_m,T=m.ceiling_height_m,_=e.zones.filter(b=>b.level_id===m.id).map(b=>({...b,polyM:b.polygon.map(w=>l([w.x,w.y]))}));if(!_.length){let b=n.walls.filter(w=>w.level_id===m.id).flatMap(w=>w.polyline.map(l));if(b.length){let P=Math.min(...b.map(z=>z[0]))-.5,U=Math.max(...b.map(z=>z[0]))+.5,F=Math.min(...b.map(z=>z[1]))-.5,O=Math.max(...b.map(z=>z[1]))+.5;_.push({id:`plate-${m.id}`,name:m.name,level_id:m.id,polyM:[[P,F],[U,F],[U,O],[P,O]],x_proto:{floor_material:"concrete"},synthetic:!0})}}let v={id:m.id,name:m.name,group:g,elevation:S,ceiling:T,zones:_,ceilings:[],extent:null,statics:[],segs:[],stairs:[],objectsBlocking:[],strips:[],blobs:[],caps:[],capLines:[]};this.levels[m.id]=v;let E=new Map,A=(b,w)=>{(E.get(b)||E.set(b,[]).get(b)).push(w)},{walls:y,openings:R}=ta(n,r,o,m.id);for(let b of y){let w=b.wall,P=w.height_m??T,U=b.points.map(k=>[k[0]*a,k[1]*a]),F=Hu(U,b.width*a/2);if(F.length<3)continue;let O=Ac(F,P-(w.base_z_m||0),S+(w.base_z_m||0)),z=w.kind==="railing"?"metal_dark":w.kind==="exterior"?"plaster_exterior":"plaster_white";if(A(z,Ii(O,h.tileM(z))),w.kind!=="railing"&&!(w.base_z_m>0)){if(v.strips.push(...wM(F,S)),P>=T*.5){let k=new bn(Lr(F));k.rotateX(-Math.PI/2),v.caps.push(k);for(let G=0;G<F.length;G++){let Y=F[G],he=F[(G+1)%F.length];v.capLines.push(Y[0],0,Y[1],he[0],0,he[1])}}if(c>=3&&w.kind==="interior"){let k=Ac(Hu(U,b.width*a/2+.012),.08,S);A("plaster_ceiling",Ii(k,2))}}}let I=_.length?_.flatMap(b=>b.polyM):y.flatMap(b=>b.points.map(w=>[w[0]*a,w[1]*a]));I.length&&(v.extent={minX:Math.min(...I.map(b=>b[0])),maxX:Math.max(...I.map(b=>b[0])),minZ:Math.min(...I.map(b=>b[1])),maxZ:Math.max(...I.map(b=>b[1]))});for(let b of _){let w=0;for(let U of R){if(U.opening.kind!=="window")continue;let F=[U.c[0]*a,U.c[1]*a],O=[-U.d[1],U.d[0]];(Pn(F[0]+O[0]*.3,F[1]+O[1]*.3,b.polyM)||Pn(F[0]-O[0]*.3,F[1]-O[1]*.3,b.polyM))&&(w+=U.opening.width_m*U.opening.height_m)}let P=0;for(let U=0;U<b.polyM.length;U++){let F=b.polyM[U],O=b.polyM[(U+1)%b.polyM.length];P+=F[0]*O[1]-O[0]*F[1]}b.daylight=Math.min(1,w/Math.max(1,Math.abs(P)/2)*5)}for(let b of R){let w=b.opening,P=[b.c[0]*a,b.c[1]*a],U=b.d,F=[-U[1],U[0]],O=w.width_m,z=b.wpx*a,k=b.wall.height_m??T,G=Ec(U[0],U[1]),Y=S+w.sill_m+w.height_m;if(k-(w.sill_m+w.height_m)>.01&&A(b.wall.kind==="exterior"?"plaster_exterior":"plaster_white",Ii(Nt(O,k-(w.sill_m+w.height_m),z,P[0],(Y+S+k)/2,P[1],G),2)),w.kind==="window"){w.sill_m>.01&&A(b.wall.kind==="exterior"?"plaster_exterior":"plaster_white",Ii(Nt(O,w.sill_m,z,P[0],S+w.sill_m/2,P[1],G),2));let he=.06;A("metal_light",Nt(he,w.height_m,z*.9,P[0]-U[0]*(O/2-he/2),S+w.sill_m+w.height_m/2,P[1]-U[1]*(O/2-he/2),G)),A("metal_light",Nt(he,w.height_m,z*.9,P[0]+U[0]*(O/2-he/2),S+w.sill_m+w.height_m/2,P[1]+U[1]*(O/2-he/2),G)),A("metal_light",Nt(O,he,z*.9,P[0],Y-he/2,P[1],G)),A("metal_light",Nt(O+.1,he,z+.08,P[0],S+w.sill_m+he/2,P[1],G)),c>=3&&(A("tiles_white",Nt(O+.14,.03,z+.12,P[0],S+w.sill_m-.015,P[1],G)),O>1&&A("metal_light",Nt(.04,w.height_m-he*2,z*.6,P[0],S+w.sill_m+w.height_m/2,P[1],G)),O>2&&(A("metal_light",Nt(.04,w.height_m-he*2,z*.6,P[0]-U[0]*(O/3),S+w.sill_m+w.height_m/2,P[1]-U[1]*(O/3),G)),A("metal_light",Nt(.04,w.height_m-he*2,z*.6,P[0]+U[0]*(O/3),S+w.sill_m+w.height_m/2,P[1]+U[1]*(O/3),G))),w.height_m>1.6&&A("metal_light",Nt(O-he*2,.04,z*.6,P[0],S+w.sill_m+w.height_m*.68,P[1],G)));let pe=w.x_proto&&w.x_proto.glazing==="frosted",Te=new De(Nt(O-he*2,w.height_m-he*2,.02,0,0,0),this.glassMaterial(pe));Te.position.set(P[0],S+w.sill_m+w.height_m/2,P[1]),Te.rotation.y=G,Te.userData={kind:"glass"},g.add(Te);let Ee=w.x_proto&&w.x_proto.cover_entity;if(Ee){let Re=v.extent?P[0]+F[0]*.5<v.extent.minX+.01||P[0]+F[0]*.5>v.extent.maxX-.01||P[1]+F[1]*.5<v.extent.minZ+.01||P[1]+F[1]*.5>v.extent.maxZ-.01?1:-1:1,j=new De(new qt(O+.1,.22,.18),f("metal_light"));j.position.set(P[0]+F[0]*Re*(z/2+.09),Y+.11,P[1]+F[1]*Re*(z/2+.09)),j.rotation.y=G,j.castShadow=!0,g.add(j);let J=new De(new qt(O+.04,1,.04),this.shutterMaterial());J.geometry.translate(0,-.5,0),J.position.set(P[0]+F[0]*Re*(z/2+.06),Y,P[1]+F[1]*Re*(z/2+.06)),J.rotation.y=G,J.castShadow=!0,J.userData={kind:"device",entity:Ee,label:e.entityNames[Ee]||Ee,domain:"cover"},g.add(J),this.devices.push(J),this.shutters.push({entity:Ee,mesh:J,height:w.height_m,current:1}),this.labels.push({kind:"device",entity:Ee,pos:new D(P[0]+F[0]*Re*.3,Y+.3,P[1]+F[1]*Re*.3),level:m.id})}}else if(w.kind==="door"){let pe="wood_dark";if(A(pe,Nt(.05,w.height_m,z+.02,P[0]-U[0]*(O/2-.05/2),S+w.height_m/2,P[1]-U[1]*(O/2-.05/2),G)),A(pe,Nt(.05,w.height_m,z+.02,P[0]+U[0]*(O/2-.05/2),S+w.height_m/2,P[1]+U[1]*(O/2-.05/2),G)),A(pe,Nt(O,.05,z+.02,P[0],Y-.05/2,P[1],G)),c>=3){let oe=z+.024;A(pe,Nt(.07,w.height_m+.07,oe,P[0]-U[0]*(O/2+.07/2),S+(w.height_m+.07)/2,P[1]-U[1]*(O/2+.07/2),G)),A(pe,Nt(.07,w.height_m+.07,oe,P[0]+U[0]*(O/2+.07/2),S+(w.height_m+.07)/2,P[1]+U[1]*(O/2+.07/2),G)),A(pe,Nt(O+.07*2,.07,oe,P[0],Y+.07/2,P[1],G))}let Te=w.anchor_ref&&w.anchor_ref.resource_type==="ha_entity"?w.anchor_ref.resource_id:null,Ee=e.doorLocks&&e.doorLocks[w.id],Re=w.height_m-.05-.01,j=.045,J=w.swing||"right",fe=[U[1],-U[0]],Le=[-U[1],U[0]],_e=[],ze=(re,oe,le,ke,Ie)=>{let Ue=new Gt;Ue.position.set(re[0],S,re[1]);let je=Ec(oe[0],oe[1]);Ue.rotation.y=je;let B=w.id==="d-liv-kit",$e=le-.02,Ze=new De(c>=3?new Xi($e,Re,j,2,.006):new qt($e,Re,j),B?this.glassMaterial(!1,!0):f("door_wood"));Ze.geometry.translate(le/2,Re/2,0),Ze.castShadow=!0,Ze.receiveShadow=!0,c>=3&&!B&&Ii(Ze.geometry,1),Ze.userData={kind:"device",entity:Te||`door:${w.id}`,label:Te?e.entityNames[Te]||Te:"\u05D3\u05DC\u05EA \u05DC\u05DC\u05D0 \u05D7\u05D9\u05D9\u05E9\u05DF",domain:"door",openingId:w.id,lock:Ee||null},Ue.add(Ze);let N=[],M=[],W=q=>q.index?q.toNonIndexed():q;if(c>=3)if(B)for(let[q,ue,de,$]of[[.04,Re,.02,Re/2],[.04,Re,$e-.02,Re/2],[$e,.04,$e/2,.02],[$e,.04,$e/2,Re-.02]]){let te=new qt(q,ue,j+.01);te.translate(de+.01,$,0),M.push(Ii(W(te),.5))}else{let q=$e-.22,ue=Re*.52,de=Re*.28;for(let $ of[-1,1])for(let[te,ge]of[[.14+de/2,de],[.14+de+.12+ue/2,ue]]){let Oe=new Xi(q,ge,.012,2,.005);Oe.translate(le/2+.01,te,$*(j/2+.003)),N.push(Ii(W(Oe),1))}}for(let q of[-1,1]){let ue=new Yt(.025,.025,.012,14);ue.rotateX(Math.PI/2),ue.translate(le-.12,1.02,q*(j/2+.006)),M.push(W(ue));let de=new Yt(.009,.009,.12,10);de.rotateZ(Math.PI/2),de.translate(le-.17,1.02,q*(j/2+.04)),M.push(W(de));let $=new Yt(.009,.009,.05,10);$.rotateX(Math.PI/2),$.translate(le-.12,1.02,q*(j/2+.025)),M.push(W($))}if(N.length&&!B&&(Ze.geometry=Es([W(Ze.geometry),...N],!1)),M.length){let q=new De(Es(M,!1),f(B?"metal_dark":"metal_light"));q.castShadow=!0,Ue.add(q)}if(Ee){let q=new De(new qt(.06,.1,.06),this.lockMaterial());q.position.set(le-.15,1.12,0),q.userData={kind:"lock",entity:Ee},Ue.add(q),this.devices.push(q),this.lockPlates=this.lockPlates||[],this.lockPlates.push({entity:Ee,mesh:q})}g.add(Ue),this.devices.push(Ze);let X=je;if(Ie==="swing"){X=Ec(ke[0],ke[1]);let q=X-je;for(;q>Math.PI;)q-=2*Math.PI;for(;q<-Math.PI;)q+=2*Math.PI;X=je+Math.sign(q)*(bM*Math.PI)/180}_e.push({grp:Ue,closedYaw:je,openYaw:X,kind:Ie,slide:Ie==="slide"?[oe[0]*-(le*.92),oe[1]*-(le*.92)]:null,base:[re[0],re[1]]})},et=[b.g0[0]*a,b.g0[1]*a],ie=[b.g1[0]*a,b.g1[1]*a],ae=(w.hinge||"start")==="start"?fe:Le;if(J==="sliding"){let re=(w.hinge||"start")==="start"?et:ie,oe=re===et?U:[-U[0],-U[1]];ze([re[0]+fe[0]*0,re[1]+fe[1]*0],oe,O,null,"slide")}else if(J==="double")ze(et,U,O/2,ae,"swing"),ze(ie,[-U[0],-U[1]],O/2,ae,"swing");else if(J!=="none"){let re=J==="left"?fe:Le,oe=(w.hinge||"start")==="start"?et:ie,le=oe===et?U:[-U[0],-U[1]];ze(oe,le,O,re,"swing")}if(this.doors.push({id:w.id,entity:Te,lock:Ee||null,leaves:_e,t:0,open:!1}),Te){let re=new Gt,oe=this.markerMaterial(),le=.06,ke=.04;for(let Ie of[-1,1]){let Ue=new De(Nt(le,w.height_m+le,z+ke*2,P[0]+U[0]*Ie*(O/2+le/2),S+(w.height_m+le)/2,P[1]+U[1]*Ie*(O/2+le/2),G),oe);re.add(Ue)}re.add(new De(Nt(O+le*2,le,z+ke*2,P[0],Y+le/2,P[1],G),oe)),re.visible=!1,g.add(re),this.markers.push({entity:Te,group:re}),this.labels.push({kind:"device",entity:Te,pos:new D(P[0],Y+.25,P[1]),level:m.id})}}else w.kind}for(let b of _){let w=b.x_proto&&b.x_proto.floor_material||"concrete",P=S>.01?.08:.25,U=Ac(b.polyM,P,S-P),F=h.get(w,c,{variant:"floor"}),O=this.reflections&&c>=3?this.transparentClone(F):F,z=new De(Ii(U,h.tileM(w)),O);z.receiveShadow=!0,z.castShadow=c>=2,z.userData={kind:"floor",zone:b.id,level:m.id},g.add(z),v.statics.push(z);let k=new bn(Lr(b.polyM));k.rotateX(-Math.PI/2),k.translate(0,S+T,0);let G=new De(Ii(k,h.tileM("plaster_ceiling")),f("plaster_ceiling",Dt));G.castShadow=!0,G.receiveShadow=!0,G.userData={kind:"ceiling"},g.add(G),v.ceilings.push(G);let[Y,he]=Pr(b.polyM),pe=b.x_proto&&b.x_proto.light;if(pe&&c<3){let Ee=new bn(Lr(Vu(b.polyM,.08)));Ee.rotateX(-Math.PI/2),Ee.translate(0,S+.014,0);let Re=new De(Ee,new St({color:16762967,transparent:!0,opacity:.4,depthWrite:!1}));Re.visible=!1,g.add(Re),this.tints.push({entity:pe,mesh:Re,zone:b.id})}let Te=b.x_proto&&b.x_proto.presence;if(Te){let Ee=Vu(b.polyM,.1),Re=Vu(b.polyM,.4),j=Lr(Ee),J=new ms;Re.forEach(([_e,ze],et)=>et?J.lineTo(_e,-ze):J.moveTo(_e,-ze)),J.closePath(),j.holes.push(J);let fe=new bn(j);fe.rotateX(-Math.PI/2),fe.translate(0,S+.026,0);let Le=new De(fe,this.styledMaterial(new St({color:this.style.palette.presence,transparent:!0,opacity:.45,depthWrite:!1}),"presence"));Le.visible=!1,g.add(Le),this.presence.push({entity:Te,mesh:Le,zone:b.id,fade:1})}this.labels.push({kind:"room",text:b.name,pos:new D(Y,S+.05,he),level:m.id,zone:b.id}),b.x_proto&&typeof b.x_proto.temp=="number"&&this.labels.push({kind:"temp",text:`${b.x_proto.temp.toFixed(1)}\xB0`,pos:new D(Y,S+1.5,he),level:m.id,zone:b.id,offset:.55})}for(let b of n.objects.filter(w=>w.level_id===m.id)){let[w,P]=l(b.position),U=-(b.rotation_deg||0)*Math.PI/180,F=S+(b.z_m||0);this.buildObject(b,w,F,P,U,g,A,v,e)}this.models&&this.furnitureMode==="models"&&this.models.flush(m.id);for(let b of n.connectors.filter(w=>w.level_from===m.id&&w.kind==="stairs"&&w.polyline.length>=2)){let w=d.get(b.level_to);if(!w)continue;let P=l(b.polyline[0]),U=l(b.polyline[b.polyline.length-1]),F=Math.hypot(U[0]-P[0],U[1]-P[1]),O=b.flights&&b.flights[0]&&b.flights[0].steps||Math.max(2,Math.round(F/.28)),z=w.elevation_m-S,k=(U[0]-P[0])/F,G=(U[1]-P[1])/F,Y=Ec(k,G),he=F/O,pe=z/O;for(let Te=0;Te<O;Te++){let Ee=(Te+.5)*he,Re=S+(Te+1)*pe,j=Math.max(.02,(Te+1)*pe);A("oak",Ii(Nt(he+.01,j,b.width_m,P[0]+k*Ee,Re-j/2,P[1]+G*Ee,Y),1))}A("wood_dark",Nt(F,.08,.05,(P[0]+U[0])/2+0,S+z/2-.04,(P[1]+U[1])/2,Y)),v.stairs.push({a:P,b:U,run:F,width:b.width_m,from:m.id,to:b.level_to,elevFrom:S,elevTo:w.elevation_m,dx:k,dz:G})}let L=zu(n,r,o,m.id,u);for(let b of e.anchors.filter(w=>w.level_id===m.id&&w.resource_type==="camera")){let[w,P]=l([b.x,b.y]),U=b.mount_height_m??2.4,F=(b.rotation||0)*Math.PI/180,O=[Math.sin(F),-Math.cos(F)],z=new Gt;z.position.set(w,S+U,P),z.rotation.y=-F+Math.PI/2;let k=new De(new qt(.24,.1,.12),f("metal_dark"));k.position.x=.1,k.rotation.z=-(b.tilt_deg||0)*Math.PI/180,z.add(k);let G=new De(new Yt(.035,.035,.04,12),this.lensMaterial(b.online));G.rotation.z=Math.PI/2,G.position.set(.23,-.03,0),z.add(G);let Y=new De(new qt(.06,.06,.06),f("metal_dark"));z.add(Y),z.userData={kind:"camera",id:b.id,label:b.label,online:b.online},k.userData=z.userData,G.userData=z.userData,g.add(z),this.devices.push(k,G);let he=(b.radius??.5)*r,Te=TM([b.x*r,b.y*o],b.rotation||0,b.fov||90,he,L).map(Ee=>[Ee[0]*a,Ee[1]*a]);if(Te.length>=3){let Ee=new bn(Lr(Te));Ee.rotateX(-Math.PI/2),Ee.translate(0,S+.03,0);let Re=b.online===!1?new St({color:10134453,transparent:!0,opacity:.12,depthWrite:!1,side:Dt}):this.styledMaterial(new St({color:this.style.palette.cone,transparent:!0,opacity:.11,depthWrite:!1,side:Dt}),"cone"),j=new De(Ee,Re);j.userData={kind:"cone",noClip:!0},g.add(j);let J=new De(Ac(Te,U-.2,S+.05),this.styledMaterial(new St({color:this.style.palette.cone,transparent:!0,opacity:.05,depthWrite:!1,side:Dt}),"cone"));J.visible=!1,J.userData={kind:"cone-volume",noClip:!0},g.add(J),this.cameras.push({id:b.id,cone:j,vol:J,body:z,fwd:O,pos:[w,P],mount:U,tilt:b.tilt_deg||0,label:b.label,level:m.id})}this.labels.push({kind:"camera",text:b.label,pos:new D(w,S+U+.2,P),level:m.id,online:b.online})}for(let[b,w]of E){let P=w.map(z=>z.index?z.toNonIndexed():z),U=Es(P,!1),F=f(b),O=new De(U,F);O.castShadow=!0,O.receiveShadow=!0,O.userData={kind:"static",material:b,level:m.id},g.add(O),v.statics.push(O)}if(c>=2){if(v.strips.length){let b=this.styledMaterial(new St({map:Jp(),color:0,transparent:!0,opacity:this.style.post.junctionAlpha,depthWrite:!1,side:Dt,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),"junctionAlpha","opacity"),w=new De(Es(v.strips,!1),b);w.userData={kind:"ao",noClip:!0},w.renderOrder=1,g.add(w)}if(v.blobs.length){let b=this.styledMaterial(new St({map:Ou(),color:0,transparent:!0,opacity:this.style.post.contactAlpha,depthWrite:!1,side:Dt,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),"contactAlpha","opacity"),w=new De(Es(v.blobs,!1),b);w.userData={kind:"ao",noClip:!0},w.renderOrder=1,g.add(w)}}if(v.caps.length){let b=this.styledMaterial(new St({color:this.style.palette.section_cap,toneMapped:!1}),"section_cap");v.capMesh=new De(Es(v.caps.map(P=>P.index?P.toNonIndexed():P),!1),b),v.capMesh.visible=!1,v.capMesh.userData={kind:"cap",noClip:!0},v.capMesh.renderOrder=2,g.add(v.capMesh);let w=new _t;w.setAttribute("position",new at(v.capLines,3)),v.capEdges=new ps(w,this.styledMaterial(new Vn({color:this.style.palette.section_edge,toneMapped:!1,transparent:!0,opacity:.9,linewidth:this.style.cut.edgeWidth||1}),"section_edge")),v.capEdges.visible=!1,v.capEdges.userData={kind:"cap",noClip:!0},v.capEdges.renderOrder=3,g.add(v.capEdges)}v.segsPx=null}{let m=Object.values(this.levels).filter(g=>g.extent);if(m.length){let g=m.reduce((P,U)=>P.elevation<U.elevation?P:U),S=g.extent,T=S.maxX-S.minX,_=S.maxZ-S.minZ,v=(S.minX+S.maxX)/2,E=(S.minZ+S.maxZ)/2,A=new Gt;A.userData={kind:"ground",noClip:!0};let y=c>=3&&!this.lite,R=y?new Pt({color:this.style.ground.disc,roughness:1,metalness:0,transparent:!0,alphaMap:Fu(),depthWrite:!1}):new St({color:this.style.ground.disc,transparent:!0,alphaMap:Fu(),depthWrite:!1}),I=new De(new ho(Math.max(T,_)*3.2,72),this.styledMaterial(R,"ground_disc"));I.rotation.x=-Math.PI/2,I.position.set(v,g.elevation-.25,E),I.receiveShadow=y,I.userData={kind:"ground",noClip:!0},A.add(I);let L=new De(new Gn(T+3,_+3),new St({map:Ou(),color:0,transparent:!0,opacity:this.style.ground.contact,depthWrite:!1}));L.rotation.x=-Math.PI/2,L.position.set(v,g.elevation-.245,E),L.userData={kind:"ground",noClip:!0},A.add(L);let b=this.style.horizon||{low:10135703,high:12766405,radius:55,height:7},w=new De(new Yt(b.radius,b.radius,b.height,72,1,!0),this.styledMaterial(new St({color:b.low,transparent:!0,alphaMap:Kp(),side:Dt,depthWrite:!1,fog:!0}),"horizon_low"));w.position.set(v,g.elevation-.25+b.height/2,E),w.userData={kind:"ground",noClip:!0},w.renderOrder=-5,A.add(w),this.ground={group:A,disc:I,shadow:L,band:w},this.root.add(A)}}this.root.traverse(m=>{m.material&&!(m.userData&&m.userData.noClip)&&!m.isSprite&&!m.isLine&&this.clipMaterials.add(m.material)}),this.cutY!=null&&this.setCut(this.cutY,this.cutLevel);let p=Object.values(this.levels).flatMap(m=>m.stairs.filter(g=>!g.arrival));for(let m of p){let g=this.levels[m.to];g&&g.stairs.push({...m,arrival:!0})}let x=Math.min(nm,this.maxLights??nm,Math.max(1,this.lamps.length));for(let m=0;m<x;m++){let g=new vs(16777215,0,9,2);g.castShadow=!!i.lampShadows&&m<2,g.shadow.mapSize.set(512,512),g.shadow.bias=-.002,g.position.set(0,-100,0),this.root.add(g),this.pool.push(g)}return this.reflections&&t>=3&&this.addReflectors(),this.setStates(e.entities,e.coverPositions,!0),this.updateLevelCollision(),this.root}addReflectors(){let{Reflector:e}=this._reflector||{};if(e)for(let t of Object.values(this.levels)){if(!t.extent)continue;let i=t.extent.maxX-t.extent.minX,n=t.extent.maxZ-t.extent.minZ,r=new e(new Gn(i,n),{clipBias:.003,textureWidth:1024,textureHeight:1024,color:8949913});r.rotation.x=-Math.PI/2,r.position.set((t.extent.minX+t.extent.maxX)/2,t.elevation-.004,(t.extent.minZ+t.extent.maxZ)/2),r.userData={kind:"reflector"},t.group.add(r),this.reflectors.push(r)}}transparentClone(e){let t=e.clone();return t.transparent=!0,t.opacity=.9,t}glassMaterial(e,t){if(this.quality>=3&&!this.lite)return new ai({color:15266040,metalness:0,roughness:e?.55:.05,transmission:e?.7:.92,thickness:.05,ior:1.5,transparent:!0,opacity:1,side:Dt,envMapIntensity:1.2,clearcoat:.6});let n=this.style.glass||{tint:14674419,opacity:.16,env:1.4};return this.styledMaterial(new Pt({color:n.tint,transparent:!0,opacity:e?.62:n.opacity,roughness:e?.5:.05,metalness:0,side:Dt,envMapIntensity:n.env,depthWrite:!1}),"glass_tint")}shutterMaterial(){return this._shutter||(this._shutter=this.styledMaterial(new Pt({color:this.style.palette.shutter,roughness:.6,metalness:.3}),"shutter")),this._shutter}markerMaterial(){return this._marker||(this._marker=this.styledMaterial(new Pt({color:this.style.palette.open_door,emissive:this.style.palette.open_door,emissiveIntensity:.9,roughness:.8}),"open_door","emissive")),this._marker}lockMaterial(){return new Pt({color:this.style.palette.lock_ok,emissive:this.style.palette.lock_ok,emissiveIntensity:.6,roughness:.5,metalness:.4})}lensMaterial(e){let t=this.style.palette.cone;return e===!1?new Pt({color:10134453,roughness:.2}):this.styledMaterial(new Pt({color:t,emissive:t,emissiveIntensity:.9,roughness:.2}),"cone","emissive")}bulbMaterial(e=3e3){let t=Cc(e);return new Pt({color:16774880,emissive:new Me(t[0],t[1],t[2]),emissiveIntensity:0,roughness:.4})}buildObject(e,t,i,n,r,o,a,l,c){let h=this.quality,f=this.lib,d=L=>f.get(L,h),{w_m:u,d_m:p,h_m:x}=e.size,m=Math.cos(r),g=Math.sin(r),S=(L,b)=>[t+L*m+b*g,n-L*g+b*m],T=h>=3,_=(L,b,w,P,U,F,O,z=.02,k=2)=>{let[G,Y]=S(U,O),he=Math.min(z,b/2-.001,w/2-.001,P/2-.001),pe=Math.min(b,w,P)<.12?1:k,Te=T&&he>.003?new Xi(b,w,P,pe,he):new qt(b,w,P);r&&Te.rotateY(r),Te.translate(G,i+F,Y),a(L,T?Ii(Te,f.tileM(L)):Te)},v=(L,b,w,P,U,F,O=16,z=b)=>{let[k,G]=S(P,F),Y=rm(b,w,k,i+U,G,O,z);a(L,T?Ii(Y,f.tileM(L)):Y)},E=(L,b,w,P,U=.06,F=.022,O=.7)=>{for(let[z,k]of[[-1,-1],[1,-1],[-1,1],[1,1]])v(L,F,P,z*(b/2-U),P/2,k*(w/2-U),10,F*O)},A=e.item_id,y=A.split(".")[0],R=e.anchor_ref&&e.anchor_ref.resource_type==="ha_entity"?e.anchor_ref.resource_id:null;if(x>=.9&&y!=="mat"&&y!=="light"&&l.objectsBlocking.push({x:t,z:n,w:u,d:p,yaw:r}),y!=="light"&&y!=="mat"&&y!=="screen"&&(e.z_m||0)<.05){let L=u*1.3+.1,b=p*1.3+.1,w=(P,U)=>{let[F,O]=S(P,U);return[F,i+.009,O]};l.blobs.push(Gu(w(-L/2,-b/2),w(L/2,-b/2),w(L/2,b/2),w(-L/2,b/2)))}if(!(y!=="light"&&this.furnitureMode==="models"&&this.models&&this.models.place(A,e,t,i,n,r,o,l,c)))switch(y){case"sofa":{let L=u>1.9?3:2,b=.08;E("wood_dark",u-.1,p-.1,b,.04,.02,.8),_("fabric_accent",u,.34,p-.04,0,b+.17,.02,.045),_("fabric_accent",u,x-.42,.2,0,.42+(x-.42)/2,-p/2+.1,.05),_("fabric_accent",.2,.3,p,-u/2+.1,.42+.15,0,.06),_("fabric_accent",.2,.3,p,u/2-.1,.42+.15,0,.06);let w=(u-.4)/L-.02;for(let P=0;P<L;P++){let U=-(u-.4)/2+w/2+.01+P*(w+.02);_("fabric_grey",w,.14,p-.34,U,b+.34+.07,.07,.05),_("fabric_grey",w-.02,.36,.14,U,b+.34+.14+.18,-p/2+.27,.05)}break}case"chair":{if(A.includes("office")){v("metal_dark",.03,.45-.08,0,(.45-.08)/2+.04,0,12);for(let b=0;b<5;b++){let w=b/5*Math.PI*2;_("metal_dark",.3,.03,.04,Math.cos(w)*.15,.03,Math.sin(w)*.15,.01)}_("leather",u,.08,p,0,.45,0,.03),_("leather",u*.9,x-.45-.05,.08,0,.45+(x-.45)/2+.03,-p/2+.06,.03)}else E("wood_dark",u,p,.45,.035,.018,.75),_("wood_dark",u,.035,p,0,.45,0,.012),_("fabric_grey",u-.04,.05,p-.04,0,.45+.04,0,.018),_("wood_dark",u*.92,x-.45,.03,0,.45+(x-.45)/2,-p/2+.02,.012),v("wood_dark",.014,x-.45-.04,-u/2+.035,.45+(x-.45)/2,-p/2+.02,8),v("wood_dark",.014,x-.45-.04,u/2-.035,.45+(x-.45)/2,-p/2+.02,8);break}case"table":{let L=A.includes("coffee")?"wood_dark":A.includes("desk")?"wood_light":"oak";_(L,u,.035,p,0,x-.0175,0,.012),A.includes("coffee")?E("metal_dark",u,p,x-.035,.05,.016,.8):A.includes("desk")?(_("wood_light",.03,x-.035,p-.1,-u/2+.03,(x-.035)/2,0,.008),_("wood_light",.03,x-.035,p-.1,u/2-.03,(x-.035)/2,0,.008),_("wood_light",u-.1,.4,.02,0,x-.25,-p/2+.06,.006)):E("wood_dark",u,p,x-.035,.07,.03,.7),A.includes("desk")&&(_("metal_dark",.52,.32,.018,.15,x+.3,-p/2+.16,.006),_("metal_dark",.16,.12,.14,.15,x+.06,-p/2+.16,.008),_("metal_light",.42,.012,.14,.1,x+.006,.08,.004));break}case"cabinet":{let L=A.includes("bookcase")||A.includes("tv")?"wood_dark":"wood_light";if(A.includes("bookcase")){_(L,.025,x,p,-u/2+.0125,x/2,0,.004),_(L,.025,x,p,u/2-.0125,x/2,0,.004),_(L,u,.025,p,0,x-.0125,0,.004),_(L,u,.03,.02,0,x/2,-p/2+.01,.004);for(let b=0;b<=4;b++)_(L,u-.05,.02,p-.02,0,x/5*b+.01,.01,.004);for(let b=1;b<5;b++)for(let w=0;w<3;w++)_(w%2?"linen":"fabric_rug",(u-.1)/3.4,x/5*.62,p*.6,-(u-.1)/2+(u-.1)/3*(w+.5),x/5*b+.02+x/5*.31,.02,.006)}else{_(L,u,x-.06,p,0,(x-.06)/2+.06,0,.012),_("wood_dark",u-.08,.06,p-.06,0,.03,-.02,.006);let b=Math.max(1,Math.round(u/.5));for(let w=1;w<b;w++)_("wood_dark",.006,x-.1,.008,-u/2+u/b*w,(x-.06)/2+.06,p/2,.002);if(A.includes("wardrobe"))for(let w of[-1,1])_("metal_light",.012,.22,.012,w*.04,x*.5,p/2+.012,.005);else for(let w=0;w<b;w++)_("metal_light",Math.min(.14,u/b-.1),.012,.012,-u/2+u/b*(w+.5),x-.12,p/2+.012,.005)}break}case"screen":{let L=T?new Xi(u,x,p,2,.008):Nt(u,x,p,0,0,0),b=new De(L,this.styledMaterial(new Pt({color:this.style.palette.screen_off,emissive:16777215,emissiveMap:AM(),emissiveIntensity:0,roughness:.2,metalness:.3}),"screen_off"));b.position.set(t,i+x/2,n),b.rotation.y=r,b.userData={kind:"device",entity:R,label:c.entityNames[R]||"\u05D8\u05DC\u05D5\u05D5\u05D9\u05D6\u05D9\u05D4",domain:"media_player"},b.castShadow=!0,o.add(b),this.devices.push(b),this.screens=this.screens||[],this.screens.push({entity:R,mesh:b});break}case"bed":{_("wood_light",u,.2,p,0,.1,0,.02),_("linen",u-.06,.2,p-.1,0,.3,.03,.06),_("fabric_grey",u-.02,.08,p*.62,0,.44,p*.17,.04),_("fabric_grey",u-.02,.05,.3,0,.47,p*.17-p*.31+.15,.025),_("linen",Math.min(.6,u/2-.12),.11,.42,u>1.2?-u/4:0,.455,-p/2+.32,.05),u>1.2&&_("linen",Math.min(.6,u/2-.12),.11,.42,u/4,.455,-p/2+.32,.05),_("wood_dark",u,x+.45,.05,0,(x+.45)/2,-p/2+.025,.02),E("wood_dark",u-.08,p-.08,.1,.02,.03,.9);break}case"kitchen":{if(A.includes("fridge"))_("metal_light",u,x,p,0,x/2,0,.03),_("metal_dark",.006,x-.5,.006,0,x*.55,p/2,.002),_("metal_dark",.02,.5,.02,u/2-.08,x*.6,p/2+.015,.008);else{_("wood_light",u,x-.14,p,0,(x-.14)/2+.1,0,.01),_("wood_dark",u-.06,.1,p-.06,0,.05,-.01,.006),_("concrete",u+.03,.04,p+.03,0,x-.02,0,.01);let L=Math.max(1,Math.round(Math.max(u,p)/.6)),b=u>=p;for(let w=1;w<L;w++)_("wood_dark",b?.006:u+.001,x-.3,b?p+.001:.006,b?-u/2+u/L*w:0,(x-.14)/2+.1,b?0:-p/2+p/L*w,.002);for(let w=0;w<L;w++)_("metal_light",b?.12:.012,.012,b?.012:.12,b?-u/2+u/L*(w+.5):(u/2+.012)*(e.rotation_deg?1:-1),x-.1,b?p/2+.012:-p/2+p/L*(w+.5),.005);A.includes("counter")&&u<p&&_("metal_light",.44,.012,.38,0,x+.006,0,.004),A.includes("island")&&_("metal_dark",.5,.008,.4,u/4,x+.004,0,.003)}break}case"plant":{v("concrete",u/2,.36,0,.18,0,18,u/2.3),v("wood_dark",u/2-.03,.02,0,.36,0,18);let L=u*.55;for(let[b,w,P,U]of[[0,x-L*.9,0,1],[L*.5,x-L*1.3,L*.2,.7],[-L*.45,x-L*1.25,-L*.3,.75],[L*.1,x-L*1.6,-L*.5,.6],[-L*.2,x-L*1.5,L*.5,.65]]){let F=new Wn(L*U,12,9),[O,z]=S(b,P);F.translate(O,i+w,z),a("grass",F)}break}case"mat":_("fabric_rug",u,.016,p,0,.008,0,.006);break;case"sanitary":{A.includes("wc")?(v("tiles_white",.19,.38,0,.19,.08,18,.16),_("tiles_white",.4,.06,.5,0,.42,.04,.03),_("tiles_white",.38,.4,.17,0,.62,-p/2+.085,.025)):A.includes("tub")?(_("tiles_white",u,x,p,0,x/2,0,.06),_("linen",u-.18,.04,p-.18,0,x-.06,0,.012),_("metal_light",.02,.2,.02,u/2-.2,x+.1,0,.008)):(_("tiles_white",u,.14,p,0,x-.07,0,.04),_("tiles_white",.22,x-.14,.2,0,(x-.14)/2,0,.03),_("metal_light",.012,.16,.012,0,x+.08,-p/2+.06,.005));break}case"appliance":{A.includes("boiler")?(v("metal_light",u/2,x,0,x/2,0,18),v("metal_dark",u/2-.03,.02,0,x,0,18)):(_("metal_light",u,x,p,0,x/2,0,.025),v("metal_dark",.2,.02,0,x*.5,p/2+.01,24),_("metal_dark",u-.1,.1,.01,0,x-.09,p/2+.005,.004));break}case"extinguisher":{let L=rm(.08,x,t,i+x/2,n,12);a("metal_dark",L);let b=new De(new Yt(.075,.075,x*.8,12),new Pt({color:13124668,roughness:.4,metalness:.3}));b.position.set(t,i+x/2,n),o.add(b);break}case"light":{let L=A.includes("pendant")||A.includes("floor")?2700:3200,b=this.bulbMaterial(L),w,P,U=null;if(A.includes("ceiling")){let O=new De(new Yt(u/2-.02,u/2*.88,.07,24),b);O.position.set(t,i+.035,n),w=O,P=new D(t,i-.12,n);let z=new De(new Yt(u/2+.01,u/2+.01,.03,24),d("metal_light"));z.position.set(t,i+.085,n),o.add(z)}else if(A.includes("pendant")){let O=new De(new Yt(.004,.004,.7,6),d("metal_dark"));O.position.set(t,i+x+.35,n),o.add(O);let z=new De(new Yt(.05,.05,.02,16),d("metal_dark"));z.position.set(t,i+x+.69,n),o.add(z),U=new De(new Yt(u/2,u/2*.45,x,24,1,!0),new Pt({color:3817286,emissive:new Me(...Cc(L)),emissiveIntensity:0,roughness:.5,metalness:.4,side:Dt})),U.position.set(t,i+x/2,n),o.add(U);let k=new De(new Wn(.045,12,10),b);k.position.set(t,i+.1,n),w=k,P=new D(t,i,n)}else if(A.includes("floor")){let O=new De(new Yt(.012,.012,x-.3,10),d("metal_dark"));O.position.set(t,i+(x-.3)/2,n),o.add(O);let z=new De(new Yt(.14,.15,.02,20),d("metal_dark"));z.position.set(t,i+.01,n),o.add(z);let k=new De(new Yt(u/2,u/2*.82,.32,24,1,!0),b);k.position.set(t,i+x-.16,n),w=k,P=new D(t,i+x-.12,n)}else{let O=new De(T?new Xi(u,x,p,2,.02):new qt(u,x,p),b);O.position.set(t,i+x/2,n),O.rotation.y=r,w=O,P=new D(t,i+x/2,n)}w.userData={kind:"device",entity:R,label:c.entityNames[R]||R,domain:"light"},o.add(w),this.devices.push(w);let F=new no(new or({map:CM(),color:new Me(...Cc(L)),transparent:!0,opacity:0,depthWrite:!1,blending:ys}));F.scale.set(1.1,1.1,1),F.position.copy(P),F.userData={noClip:!0},o.add(F),this.lamps.push({entity:R,bulb:w,pos:P,glow:F,kelvin:L,level:l.id,light:null,on:!1,kind:A,shade:U}),this.labels.push({kind:"device",entity:R,pos:P.clone(),level:l.id});break}default:_("concrete",u,x,p,0,x/2,0,.01)}}updateLevelCollision(){let e=this.plan.doc;for(let t of Object.values(this.levels)){let i=zu(e,this.W,this.H,t.id,this.plan.entities).map(n=>({a:[n.a[0]*this.scale,n.a[1]*this.scale],b:[n.b[0]*this.scale,n.b[1]*this.scale],w:(n.w||0)*this.scale,kind:n.kind,id:n.id}));for(let n of this.doors)if(n.lock&&this.plan.entities[n.lock]==="locked"){let r=e.openings.find(o=>o.id===n.id);if(r&&!i.some(o=>o.id===r.id)){let o=ta(e,this.W,this.H,t.id).openings.find(a=>a.opening.id===r.id);o&&i.push({a:[o.g0[0]*this.scale,o.g0[1]*this.scale],b:[o.g1[0]*this.scale,o.g1[1]*this.scale],w:o.wpx*this.scale,kind:"door-locked",id:r.id})}}for(let n of t.objectsBlocking){let r=Math.cos(n.yaw),o=Math.sin(n.yaw),a=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([l,c])=>[n.x+l*n.w/2*r+c*n.d/2*o,n.z-l*n.w/2*o+c*n.d/2*r]);for(let l=0;l<4;l++)i.push({a:a[l],b:a[(l+1)%4],w:0,kind:"object",id:"obj"})}t.segs=i}}setStates(e,t,i=!1){this.plan.entities=e,this.plan.coverPositions=t||this.plan.coverPositions||{};for(let n of this.doors){let r=n.entity?Tc(e[n.entity]):!1;n.open=r,i&&(n.t=r?1:0)}for(let n of this.shutters){let r=this.plan.coverPositions[n.entity],o=e[n.entity];n.target=typeof r=="number"?r/100:o==="open"?1:0,i&&(n.current=n.target)}for(let n of this.lamps)n.on=e[n.entity]==="on";for(let n of this.markers)n.group.visible=Tc(e[n.entity]);for(let n of this.presence)n.mesh.visible=e[n.entity]==="on";for(let n of this.tints)n.mesh.visible=e[n.entity]==="on";for(let n of this.screens||[])n.mesh.material.emissiveIntensity=e[n.entity]==="playing"||e[n.entity]==="on"?.9:0;for(let n of this.lockPlates||[]){let o=e[n.entity]==="locked"?this.style.palette.open_door:this.style.palette.lock_ok;n.mesh.material.color.setHex(o),n.mesh.material.emissive.setHex(o)}this.updateLevelCollision()}update(e,t,i={}){let n=!1;if(i.coneVolumes!==void 0)for(let h of this.cameras)h.vol.visible=!!i.coneVolumes;let r=Math.min(1,e/(SM/1e3));for(let h of this.doors){let f=h.open?1:0;Math.abs(h.t-f)>.001&&(h.t+=Math.sign(f-h.t)*r,h.t=Math.max(0,Math.min(1,h.t)),n=!0);let d=h.t<.5?2*h.t*h.t:1-Math.pow(-2*h.t+2,2)/2;for(let u of h.leaves)u.kind==="swing"?u.grp.rotation.y=u.closedYaw+(u.openYaw-u.closedYaw)*d:u.grp.position.set(u.base[0]+u.slide[0]*d,u.grp.position.y,u.base[1]+u.slide[1]*d)}for(let h of this.shutters){Math.abs(h.current-h.target)>.001&&(h.current+=Math.sign(h.target-h.current)*r*.6,h.current=Math.max(0,Math.min(1,h.current)),n=!0);let f=h.height*(1-h.current);h.mesh.scale.y=Math.max(.001,f),h.mesh.visible=f>.01}let o=i.nightFactor??0,a=this.style.rig,l=this.lamps.filter(h=>h.on&&this.levels[h.level].group.visible);for(let h of this.lamps){let f=h.on?this.quality>=3?sm(a.lampEmissiveDay,a.lampEmissiveNight,o):1.4:0;h.bulb.material.emissiveIntensity+=(f-h.bulb.material.emissiveIntensity)*Math.min(1,e*8),h.shade&&(h.shade.material.emissiveIntensity=h.bulb.material.emissiveIntensity*.22);let d=this.cutY!=null&&h.pos.y>this.cutY,u=h.on&&!d?.16+o*.26:0;h.glow.material.opacity+=(u-h.glow.material.opacity)*Math.min(1,e*8),Math.abs(f-h.bulb.material.emissiveIntensity)>.01&&(n=!0)}l.sort((h,f)=>h.pos.distanceToSquared(t)-f.pos.distanceToSquared(t));let c=l.slice(0,this.pool.length);for(let h=0;h<this.pool.length;h++){let f=this.pool[h],d=c[h];if(!d){f.intensity=0;continue}f.position.copy(d.pos);let u=Cc(d.kelvin+a.lampKelvinOffset);f.color.setRGB(u[0],u[1],u[2]);let p=d.kind.includes("floor")?6:d.kind.includes("wall")?5:11;f.intensity=p*sm(a.lampPoolDay,a.lampPoolNight,o)}return n}showLevel(e,t=!1){let i=Object.keys(this.levels);for(let n of i){let r=this.levels[n],o=e==="all"||e===n;r.group.visible=o;let a=!!(t||e==="all"&&n!==i[i.length-1]);for(let l of r.ceilings)l.visible=a&&!(e==="all"&&!t&&n===i[i.length-1]);if(e==="all"&&!t)for(let l of r.ceilings)l.visible=!1}for(let n of this.cameras)n.vol.visible=!1,n.cone.visible=!t}pick(e){let t=e.intersectObjects(this.devices,!1);for(let i of t){let n=i.object.userData;if(n&&(n.kind==="device"||n.kind==="camera"||n.kind==="lock"))return{...n,point:i.point,distance:i.distance}}return null}};function TM(s,e,t,i,n){let r=[s],o=Math.max(24,Math.round(t/2));for(let a=0;a<=o;a++){let c=(e-t/2+t*a/o-90)*Math.PI/180,h=[Math.cos(c),Math.sin(c)],f=i;for(let d of n){let u=EM(s,h,d.a,d.b);u!==null&&u>.5&&u<f&&(f=u)}r.push([s[0]+h[0]*f,s[1]+h[1]*f])}return r}function EM(s,e,t,i){let n=i[0]-t[0],r=i[1]-t[1],o=e[0]*r-e[1]*n;if(Math.abs(o)<1e-12)return null;let a=t[0]-s[0],l=t[1]-s[1],c=(a*r-l*n)/o,h=(a*e[1]-l*e[0])/o;return c<0||h<-1e-9||h>1+1e-9?null:c}function Cc(s){let e=s/100,t,i,n;t=e<=66?255:329.698727446*Math.pow(e-60,-.1332047592),i=e<=66?99.4708025861*Math.log(e)-161.1195681661:288.1221695283*Math.pow(e-60,-.0755148492),n=e>=66?255:e<=19?0:138.5177312231*Math.log(e-10)-305.0447927307;let r=o=>Math.max(0,Math.min(255,o))/255;return[r(t),r(i),r(n)]}var ia=null;function AM(){if(ia)return ia;let s=document.createElement("canvas");s.width=256,s.height=144;let e=s.getContext("2d"),t=e.createLinearGradient(0,0,256,144);t.addColorStop(0,"#2b3f5e"),t.addColorStop(.45,"#6d8fb3"),t.addColorStop(.7,"#c9b08a"),t.addColorStop(1,"#3a2f3a"),e.fillStyle=t,e.fillRect(0,0,256,144);let i=e.createRadialGradient(150,60,10,150,60,150);return i.addColorStop(0,"rgba(255,245,225,0.55)"),i.addColorStop(1,"rgba(255,245,225,0)"),e.fillStyle=i,e.fillRect(0,0,256,144),e.fillStyle="rgba(0,0,0,0.55)",e.fillRect(0,0,256,14),e.fillRect(0,130,256,14),ia=new Ci(s),ia.colorSpace=Mt,ia}var na=null;function CM(){if(na)return na;let s=document.createElement("canvas");s.width=s.height=128;let e=s.getContext("2d"),t=e.createRadialGradient(64,64,0,64,64,64);return t.addColorStop(0,"rgba(255,255,255,1)"),t.addColorStop(.25,"rgba(255,255,255,0.55)"),t.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=t,e.fillRect(0,0,128,128),na=new Ci(s),na.colorSpace=Mt,na}var cn={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`};var ii=class{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}},RM=new bi(-1,1,1,-1,0,1),Wu=class extends _t{constructor(){super(),this.setAttribute("position",new at([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new at([0,2,0,0,2,0],2))}},PM=new Wu,Di=class{constructor(e){this._mesh=new De(PM,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,RM)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}};var Pc=class extends ii{constructor(e,t="tDiffuse"){super(),this.textureID=t,this.uniforms=null,this.material=null,e instanceof ct?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=kt.clone(e.uniforms),this.material=new ct({name:e.name!==void 0?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this._fsQuad=new Di(this.material)}render(e,t,i){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=i.texture),this._fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}};var sa=class extends ii{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,i){let n=e.getContext(),r=e.state;r.buffers.color.setMask(!1),r.buffers.depth.setMask(!1),r.buffers.color.setLocked(!0),r.buffers.depth.setLocked(!0);let o,a;this.inverse?(o=0,a=1):(o=1,a=0),r.buffers.stencil.setTest(!0),r.buffers.stencil.setOp(n.REPLACE,n.REPLACE,n.REPLACE),r.buffers.stencil.setFunc(n.ALWAYS,o,4294967295),r.buffers.stencil.setClear(a),r.buffers.stencil.setLocked(!0),e.setRenderTarget(i),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),r.buffers.color.setLocked(!1),r.buffers.depth.setLocked(!1),r.buffers.color.setMask(!0),r.buffers.depth.setMask(!0),r.buffers.stencil.setLocked(!1),r.buffers.stencil.setFunc(n.EQUAL,1,4294967295),r.buffers.stencil.setOp(n.KEEP,n.KEEP,n.KEEP),r.buffers.stencil.setLocked(!0)}},Lc=class extends ii{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}};var Ic=class{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){let i=e.getSize(new ee);this._width=i.width,this._height=i.height,t=new dt(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:wt}),t.texture.name="EffectComposer.rt1"}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new Pc(cn),this.copyPass.material.blending=Bt,this.timer=new Ro}swapBuffers(){let e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){let t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){this.timer.update(),e===void 0&&(e=this.timer.getDelta());let t=this.renderer.getRenderTarget(),i=!1;for(let n=0,r=this.passes.length;n<r;n++){let o=this.passes[n];if(o.enabled!==!1){if(o.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(n),o.render(this.renderer,this.writeBuffer,this.readBuffer,e,i),o.needsSwap){if(i){let a=this.renderer.getContext(),l=this.renderer.state.buffers.stencil;l.setFunc(a.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),l.setFunc(a.EQUAL,1,4294967295)}this.swapBuffers()}sa!==void 0&&(o instanceof sa?i=!0:o instanceof Lc&&(i=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){let t=this.renderer.getSize(new ee);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;let i=this._width*this._pixelRatio,n=this._height*this._pixelRatio;this.renderTarget1.setSize(i,n),this.renderTarget2.setSize(i,n);for(let r=0;r<this.passes.length;r++)this.passes[r].setSize(i,n)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}};var Dc=class extends ii{constructor(e,t,i=null,n=null,r=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=i,this.clearColor=n,this.clearAlpha=r,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new Me}render(e,t,i){let n=e.autoClear;e.autoClear=!1;let r,o;this.overrideMaterial!==null&&(o=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(r=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:i),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(r),this.overrideMaterial!==null&&(this.scene.overrideMaterial=o),e.autoClear=n}};var ra={name:"GTAOShader",defines:{PERSPECTIVE_CAMERA:1,SAMPLES:16,NORMAL_VECTOR_TYPE:1,DEPTH_SWIZZLING:"x",SCREEN_SPACE_RADIUS:0,SCREEN_SPACE_RADIUS_SCALE:100,SCENE_CLIP_BOX:0},uniforms:{tNormal:{value:null},tDepth:{value:null},tNoise:{value:null},resolution:{value:new ee},cameraNear:{value:null},cameraFar:{value:null},cameraProjectionMatrix:{value:new We},cameraProjectionMatrixInverse:{value:new We},cameraWorldMatrix:{value:new We},radius:{value:.25},distanceExponent:{value:1},thickness:{value:1},distanceFallOff:{value:1},scale:{value:1},sceneBoxMin:{value:new D(-1,-1,-1)},sceneBoxMax:{value:new D(1,1,1)}},vertexShader:`

		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		varying vec2 vUv;
		uniform highp sampler2D tNormal;
		uniform highp sampler2D tDepth;
		uniform sampler2D tNoise;
		uniform vec2 resolution;
		uniform float cameraNear;
		uniform float cameraFar;
		uniform mat4 cameraProjectionMatrix;
		uniform mat4 cameraProjectionMatrixInverse;
		uniform mat4 cameraWorldMatrix;
		uniform float radius;
		uniform float distanceExponent;
		uniform float thickness;
		uniform float distanceFallOff;
		uniform float scale;
		#if SCENE_CLIP_BOX == 1
			uniform vec3 sceneBoxMin;
			uniform vec3 sceneBoxMax;
		#endif

		#include <common>
		#include <packing>

		#ifndef FRAGMENT_OUTPUT
		#define FRAGMENT_OUTPUT vec4(vec3(ao), 1.)
		#endif

		vec3 getViewPosition( const in vec2 screenPosition, const in float depth ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				vec4 clipSpacePosition = vec4( vec2( screenPosition ) * 2.0 - 1.0, depth, 1.0 );
			#else
				vec4 clipSpacePosition = vec4( vec3( screenPosition, depth ) * 2.0 - 1.0, 1.0 );
			#endif
			vec4 viewSpacePosition = cameraProjectionMatrixInverse * clipSpacePosition;
			return viewSpacePosition.xyz / viewSpacePosition.w;
		}

		float getDepth(const vec2 uv) {
			return textureLod(tDepth, uv.xy, 0.0).DEPTH_SWIZZLING;
		}

		float fetchDepth(const ivec2 uv) {
			return texelFetch(tDepth, uv.xy, 0).DEPTH_SWIZZLING;
		}

		float getViewZ(const in float depth) {
			#if PERSPECTIVE_CAMERA == 1
				return perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
			#else
				return orthographicDepthToViewZ(depth, cameraNear, cameraFar);
			#endif
		}

		vec3 computeNormalFromDepth(const vec2 uv) {
			vec2 size = vec2(textureSize(tDepth, 0));
			ivec2 p = ivec2(uv * size);
			float c0 = fetchDepth(p);
			float l2 = fetchDepth(p - ivec2(2, 0));
			float l1 = fetchDepth(p - ivec2(1, 0));
			float r1 = fetchDepth(p + ivec2(1, 0));
			float r2 = fetchDepth(p + ivec2(2, 0));
			float b2 = fetchDepth(p - ivec2(0, 2));
			float b1 = fetchDepth(p - ivec2(0, 1));
			float t1 = fetchDepth(p + ivec2(0, 1));
			float t2 = fetchDepth(p + ivec2(0, 2));
			float dl = abs((2.0 * l1 - l2) - c0);
			float dr = abs((2.0 * r1 - r2) - c0);
			float db = abs((2.0 * b1 - b2) - c0);
			float dt = abs((2.0 * t1 - t2) - c0);
			vec3 ce = getViewPosition(uv, c0).xyz;
			vec3 dpdx = (dl < dr) ? ce - getViewPosition((uv - vec2(1.0 / size.x, 0.0)), l1).xyz : -ce + getViewPosition((uv + vec2(1.0 / size.x, 0.0)), r1).xyz;
			vec3 dpdy = (db < dt) ? ce - getViewPosition((uv - vec2(0.0, 1.0 / size.y)), b1).xyz : -ce + getViewPosition((uv + vec2(0.0, 1.0 / size.y)), t1).xyz;
			return normalize(cross(dpdx, dpdy));
		}

		vec3 getViewNormal(const vec2 uv) {
			#if NORMAL_VECTOR_TYPE == 2
				return normalize(textureLod(tNormal, uv, 0.).rgb);
			#elif NORMAL_VECTOR_TYPE == 1
				return unpackRGBToNormal(textureLod(tNormal, uv, 0.).rgb);
			#else
				return computeNormalFromDepth(uv);
			#endif
		}

		vec3 getSceneUvAndDepth(vec3 sampleViewPos) {
			vec4 sampleClipPos = cameraProjectionMatrix * vec4(sampleViewPos, 1.);
			vec2 sampleUv = sampleClipPos.xy / sampleClipPos.w * 0.5 + 0.5;
			float sampleSceneDepth = getDepth(sampleUv);
			return vec3(sampleUv, sampleSceneDepth);
		}

		void main() {
			float depth = getDepth(vUv.xy);

			#ifdef USE_REVERSED_DEPTH_BUFFER
				if (depth <= 0.0) {
					discard;
					return;
				}
			#else
				if (depth >= 1.0) {
					discard;
					return;
				}
			#endif
			
			vec3 viewPos = getViewPosition(vUv, depth);
			vec3 viewNormal = getViewNormal(vUv);

			float radiusToUse = radius;
			float distanceFalloffToUse = thickness;
			#if SCREEN_SPACE_RADIUS == 1
				float radiusScale = getViewPosition(vec2(0.5 + float(SCREEN_SPACE_RADIUS_SCALE) / resolution.x, 0.0), depth).x;
				radiusToUse *= radiusScale;
				distanceFalloffToUse *= radiusScale;
			#endif

			#if SCENE_CLIP_BOX == 1
				vec3 worldPos = (cameraWorldMatrix * vec4(viewPos, 1.0)).xyz;
				float boxDistance = length(max(vec3(0.0), max(sceneBoxMin - worldPos, worldPos - sceneBoxMax)));
				if (boxDistance > radiusToUse) {
					discard;
					return;
				}
			#endif

			vec2 noiseResolution = vec2(textureSize(tNoise, 0));
			vec2 noiseUv = vUv * resolution / noiseResolution;
			vec4 noiseTexel = textureLod(tNoise, noiseUv, 0.0);
			vec3 randomVec = noiseTexel.xyz * 2.0 - 1.0;
			vec3 tangent = normalize(vec3(randomVec.xy, 0.));
			vec3 bitangent = vec3(-tangent.y, tangent.x, 0.);
			mat3 kernelMatrix = mat3(tangent, bitangent, vec3(0., 0., 1.));

			const int DIRECTIONS = SAMPLES < 30 ? 3 : 5;
			const int STEPS = (SAMPLES + DIRECTIONS - 1) / DIRECTIONS;
			float ao = 0.0;
			for (int i = 0; i < DIRECTIONS; ++i) {

				float angle = float(i) / float(DIRECTIONS) * PI;
				vec4 sampleDir = vec4(cos(angle), sin(angle), 0., 0.5 + 0.5 * noiseTexel.w);
				sampleDir.xyz = normalize(kernelMatrix * sampleDir.xyz);

				vec3 viewDir = normalize(-viewPos.xyz);
				vec3 sliceBitangent = normalize(cross(sampleDir.xyz, viewDir));
				vec3 sliceTangent = cross(sliceBitangent, viewDir);
				vec3 normalInSlice = normalize(viewNormal - sliceBitangent * dot(viewNormal, sliceBitangent));

				vec3 tangentToNormalInSlice = cross(normalInSlice, sliceBitangent);
				vec2 cosHorizons = vec2(dot(viewDir, tangentToNormalInSlice), dot(viewDir, -tangentToNormalInSlice));

				for (int j = 0; j < STEPS; ++j) {
					vec3 sampleViewOffset = sampleDir.xyz * radiusToUse * sampleDir.w * pow(float(j + 1) / float(STEPS), distanceExponent);

					vec3 sampleSceneUvDepth = getSceneUvAndDepth(viewPos + sampleViewOffset);
					vec3 sampleSceneViewPos = getViewPosition(sampleSceneUvDepth.xy, sampleSceneUvDepth.z);
					vec3 viewDelta = sampleSceneViewPos - viewPos;
					if (abs(viewDelta.z) < thickness) {
						float sampleCosHorizon = dot(viewDir, normalize(viewDelta));
						cosHorizons.x += max(0., (sampleCosHorizon - cosHorizons.x) * mix(1., 2. / float(j + 2), distanceFallOff));
					}

					sampleSceneUvDepth = getSceneUvAndDepth(viewPos - sampleViewOffset);
					sampleSceneViewPos = getViewPosition(sampleSceneUvDepth.xy, sampleSceneUvDepth.z);
					viewDelta = sampleSceneViewPos - viewPos;
					if (abs(viewDelta.z) < thickness) {
						float sampleCosHorizon = dot(viewDir, normalize(viewDelta));
						cosHorizons.y += max(0., (sampleCosHorizon - cosHorizons.y) * mix(1., 2. / float(j + 2), distanceFallOff));
					}
				}

				vec2 sinHorizons = sqrt(1. - cosHorizons * cosHorizons);
				float nx = dot(normalInSlice, sliceTangent);
				float ny = dot(normalInSlice, viewDir);
				float nxb = 1. / 2. * (acos(cosHorizons.y) - acos(cosHorizons.x) + sinHorizons.x * cosHorizons.x - sinHorizons.y * cosHorizons.y);
				float nyb = 1. / 2. * (2. - cosHorizons.x * cosHorizons.x - cosHorizons.y * cosHorizons.y);
				float occlusion = nx * nxb + ny * nyb;
				ao += occlusion;
			}

			ao = clamp(ao / float(DIRECTIONS), 0., 1.);
		#if SCENE_CLIP_BOX == 1
			ao = mix(ao, 1., smoothstep(0., radiusToUse, boxDistance));
		#endif
			ao = pow(ao, scale);

			gl_FragColor = FRAGMENT_OUTPUT;
		}`},oa={name:"GTAODepthShader",defines:{PERSPECTIVE_CAMERA:1},uniforms:{tDepth:{value:null},cameraNear:{value:null},cameraFar:{value:null}},vertexShader:`
		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		uniform sampler2D tDepth;
		uniform float cameraNear;
		uniform float cameraFar;
		varying vec2 vUv;

		#include <packing>

		float getLinearDepth( const in vec2 screenPosition ) {
			#if PERSPECTIVE_CAMERA == 1
				float fragCoordZ = texture2D( tDepth, screenPosition ).x;
				float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
				return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );
			#else
				return texture2D( tDepth, screenPosition ).x;
			#endif
		}

		void main() {
			float depth = getLinearDepth( vUv );
			gl_FragColor = vec4( vec3( 1.0 - depth ), 1.0 );

		}`},Nc={name:"GTAOBlendShader",uniforms:{tDiffuse:{value:null},intensity:{value:1}},vertexShader:`
		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`
		uniform float intensity;
		uniform sampler2D tDiffuse;
		varying vec2 vUv;

		void main() {
			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = vec4(mix(vec3(1.), texel.rgb, intensity), texel.a);
		}`};function am(s=5){let e=Math.floor(s)%2===0?Math.floor(s)+1:Math.floor(s),t=LM(e),i=t.length,n=new Uint8Array(i*4);for(let o=0;o<i;++o){let a=t[o],l=2*Math.PI*a/i,c=new D(Math.cos(l),Math.sin(l),0).normalize();n[o*4]=(c.x*.5+.5)*255,n[o*4+1]=(c.y*.5+.5)*255,n[o*4+2]=127,n[o*4+3]=255}let r=new en(n,e,e);return r.wrapS=Xt,r.wrapT=Xt,r.needsUpdate=!0,r}function LM(s){let e=Math.floor(s)%2===0?Math.floor(s)+1:Math.floor(s),t=e*e,i=Array(t).fill(0),n=Math.floor(e/2),r=e-1;for(let o=1;o<=t;){if(n===-1&&r===e?(r=e-2,n=0):(r===e&&(r=0),n<0&&(n=e-1)),i[n*e+r]!==0){r-=2,n++;continue}else i[n*e+r]=o++;r++,n--}return i}var aa={name:"PoissonDenoiseShader",defines:{SAMPLES:16,SAMPLE_VECTORS:Xu(16,2,1),NORMAL_VECTOR_TYPE:1,DEPTH_VALUE_SOURCE:0},uniforms:{tDiffuse:{value:null},tNormal:{value:null},tDepth:{value:null},tNoise:{value:null},resolution:{value:new ee},cameraProjectionMatrixInverse:{value:new We},lumaPhi:{value:5},depthPhi:{value:5},normalPhi:{value:5},radius:{value:4},index:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,fragmentShader:`

		varying vec2 vUv;

		uniform sampler2D tDiffuse;
		uniform sampler2D tNormal;
		uniform sampler2D tDepth;
		uniform sampler2D tNoise;
		uniform vec2 resolution;
		uniform mat4 cameraProjectionMatrixInverse;
		uniform float lumaPhi;
		uniform float depthPhi;
		uniform float normalPhi;
		uniform float radius;
		uniform int index;

		#include <common>
		#include <packing>

		#ifndef SAMPLE_LUMINANCE
		#define SAMPLE_LUMINANCE dot(vec3(0.2125, 0.7154, 0.0721), a)
		#endif

		#ifndef FRAGMENT_OUTPUT
		#define FRAGMENT_OUTPUT vec4(denoised, 1.)
		#endif

		float getLuminance(const in vec3 a) {
			return SAMPLE_LUMINANCE;
		}

		const vec3 poissonDisk[SAMPLES] = SAMPLE_VECTORS;

		vec3 getViewPosition( const in vec2 screenPosition, const in float depth ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				vec4 clipSpacePosition = vec4( vec2( screenPosition ) * 2.0 - 1.0, depth, 1.0 );
			#else
				vec4 clipSpacePosition = vec4( vec3( screenPosition, depth ) * 2.0 - 1.0, 1.0 );
			#endif
			vec4 viewSpacePosition = cameraProjectionMatrixInverse * clipSpacePosition;
			return viewSpacePosition.xyz / viewSpacePosition.w;
		}

		float getDepth(const vec2 uv) {
		#if DEPTH_VALUE_SOURCE == 1
			return textureLod(tDepth, uv.xy, 0.0).a;
		#else
			return textureLod(tDepth, uv.xy, 0.0).r;
		#endif
		}

		float fetchDepth(const ivec2 uv) {
			#if DEPTH_VALUE_SOURCE == 1
				return texelFetch(tDepth, uv.xy, 0).a;
			#else
				return texelFetch(tDepth, uv.xy, 0).r;
			#endif
		}

		vec3 computeNormalFromDepth(const vec2 uv) {
			vec2 size = vec2(textureSize(tDepth, 0));
			ivec2 p = ivec2(uv * size);
			float c0 = fetchDepth(p);
			float l2 = fetchDepth(p - ivec2(2, 0));
			float l1 = fetchDepth(p - ivec2(1, 0));
			float r1 = fetchDepth(p + ivec2(1, 0));
			float r2 = fetchDepth(p + ivec2(2, 0));
			float b2 = fetchDepth(p - ivec2(0, 2));
			float b1 = fetchDepth(p - ivec2(0, 1));
			float t1 = fetchDepth(p + ivec2(0, 1));
			float t2 = fetchDepth(p + ivec2(0, 2));
			float dl = abs((2.0 * l1 - l2) - c0);
			float dr = abs((2.0 * r1 - r2) - c0);
			float db = abs((2.0 * b1 - b2) - c0);
			float dt = abs((2.0 * t1 - t2) - c0);
			vec3 ce = getViewPosition(uv, c0).xyz;
			vec3 dpdx = (dl < dr) ?  ce - getViewPosition((uv - vec2(1.0 / size.x, 0.0)), l1).xyz
									: -ce + getViewPosition((uv + vec2(1.0 / size.x, 0.0)), r1).xyz;
			vec3 dpdy = (db < dt) ?  ce - getViewPosition((uv - vec2(0.0, 1.0 / size.y)), b1).xyz
									: -ce + getViewPosition((uv + vec2(0.0, 1.0 / size.y)), t1).xyz;
			return normalize(cross(dpdx, dpdy));
		}

		vec3 getViewNormal(const vec2 uv) {
		#if NORMAL_VECTOR_TYPE == 2
			return normalize(textureLod(tNormal, uv, 0.).rgb);
		#elif NORMAL_VECTOR_TYPE == 1
			return unpackRGBToNormal(textureLod(tNormal, uv, 0.).rgb);
		#else
			return computeNormalFromDepth(uv);
		#endif
		}

		void denoiseSample(in vec3 center, in vec3 viewNormal, in vec3 viewPos, in vec2 sampleUv, inout vec3 denoised, inout float totalWeight) {
			vec4 sampleTexel = textureLod(tDiffuse, sampleUv, 0.0);
			float sampleDepth = getDepth(sampleUv);
			vec3 sampleNormal = getViewNormal(sampleUv);
			vec3 neighborColor = sampleTexel.rgb;
			vec3 viewPosSample = getViewPosition(sampleUv, sampleDepth);

			float normalDiff = dot(viewNormal, sampleNormal);
			float normalSimilarity = pow(max(normalDiff, 0.), normalPhi);
			float lumaDiff = abs(getLuminance(neighborColor) - getLuminance(center));
			float lumaSimilarity = max(1.0 - lumaDiff / lumaPhi, 0.0);
			float depthDiff = abs(dot(viewPos - viewPosSample, viewNormal));
			float depthSimilarity = max(1. - depthDiff / depthPhi, 0.);
			float w = lumaSimilarity * depthSimilarity * normalSimilarity;

			denoised += w * neighborColor;
			totalWeight += w;
		}

		void main() {
			float depth = getDepth(vUv.xy);
			vec3 viewNormal = getViewNormal(vUv);
			if (depth == 1. || dot(viewNormal, viewNormal) == 0.) {
				discard;
				return;
			}
			vec4 texel = textureLod(tDiffuse, vUv, 0.0);
			vec3 center = texel.rgb;
			vec3 viewPos = getViewPosition(vUv, depth);

			vec2 noiseResolution = vec2(textureSize(tNoise, 0));
			vec2 noiseUv = vUv * resolution / noiseResolution;
			vec4 noiseTexel = textureLod(tNoise, noiseUv, 0.0);
      		vec2 noiseVec = vec2(sin(noiseTexel[index % 4] * 2. * PI), cos(noiseTexel[index % 4] * 2. * PI));
    		mat2 rotationMatrix = mat2(noiseVec.x, -noiseVec.y, noiseVec.x, noiseVec.y);

			float totalWeight = 1.0;
			vec3 denoised = texel.rgb;
			for (int i = 0; i < SAMPLES; i++) {
				vec3 sampleDir = poissonDisk[i];
				vec2 offset = rotationMatrix * (sampleDir.xy * (1. + sampleDir.z * (radius - 1.)) / resolution);
				vec2 sampleUv = vUv + offset;
				denoiseSample(center, viewNormal, viewPos, sampleUv, denoised, totalWeight);
			}

			if (totalWeight > 0.) {
				denoised /= totalWeight;
			}
			gl_FragColor = FRAGMENT_OUTPUT;
		}`};function Xu(s,e,t){let i=IM(s,e,t),n="vec3[SAMPLES](";for(let r=0;r<s;r++){let o=i[r];n+=`vec3(${o.x}, ${o.y}, ${o.z})${r<s-1?",":")"}`}return n}function IM(s,e,t){let i=[];for(let n=0;n<s;n++){let r=2*Math.PI*e*n/s,o=Math.pow(n/(s-1),t);i.push(new D(Math.cos(r),Math.sin(r),o))}return i}var Uc=class{constructor(e=Math){this.grad3=[[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]],this.grad4=[[0,1,1,1],[0,1,1,-1],[0,1,-1,1],[0,1,-1,-1],[0,-1,1,1],[0,-1,1,-1],[0,-1,-1,1],[0,-1,-1,-1],[1,0,1,1],[1,0,1,-1],[1,0,-1,1],[1,0,-1,-1],[-1,0,1,1],[-1,0,1,-1],[-1,0,-1,1],[-1,0,-1,-1],[1,1,0,1],[1,1,0,-1],[1,-1,0,1],[1,-1,0,-1],[-1,1,0,1],[-1,1,0,-1],[-1,-1,0,1],[-1,-1,0,-1],[1,1,1,0],[1,1,-1,0],[1,-1,1,0],[1,-1,-1,0],[-1,1,1,0],[-1,1,-1,0],[-1,-1,1,0],[-1,-1,-1,0]],this.p=[];for(let t=0;t<256;t++)this.p[t]=Math.floor(e.random()*256);this.perm=[];for(let t=0;t<512;t++)this.perm[t]=this.p[t&255];this.simplex=[[0,1,2,3],[0,1,3,2],[0,0,0,0],[0,2,3,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,3,0],[0,2,1,3],[0,0,0,0],[0,3,1,2],[0,3,2,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,3,2,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,0,3],[0,0,0,0],[1,3,0,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,3,0,1],[2,3,1,0],[1,0,2,3],[1,0,3,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,3,1],[0,0,0,0],[2,1,3,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,1,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,0,1,2],[3,0,2,1],[0,0,0,0],[3,1,2,0],[2,1,0,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,1,0,2],[0,0,0,0],[3,2,0,1],[3,2,1,0]]}noise(e,t){let i,n,r,o=.5*(Math.sqrt(3)-1),a=(e+t)*o,l=Math.floor(e+a),c=Math.floor(t+a),h=(3-Math.sqrt(3))/6,f=(l+c)*h,d=l-f,u=c-f,p=e-d,x=t-u,m,g;p>x?(m=1,g=0):(m=0,g=1);let S=p-m+h,T=x-g+h,_=p-1+2*h,v=x-1+2*h,E=l&255,A=c&255,y=this.perm[E+this.perm[A]]%12,R=this.perm[E+m+this.perm[A+g]]%12,I=this.perm[E+1+this.perm[A+1]]%12,L=.5-p*p-x*x;L<0?i=0:(L*=L,i=L*L*this._dot(this.grad3[y],p,x));let b=.5-S*S-T*T;b<0?n=0:(b*=b,n=b*b*this._dot(this.grad3[R],S,T));let w=.5-_*_-v*v;return w<0?r=0:(w*=w,r=w*w*this._dot(this.grad3[I],_,v)),70*(i+n+r)}noise3d(e,t,i){let n,r,o,a,c=(e+t+i)*.3333333333333333,h=Math.floor(e+c),f=Math.floor(t+c),d=Math.floor(i+c),u=1/6,p=(h+f+d)*u,x=h-p,m=f-p,g=d-p,S=e-x,T=t-m,_=i-g,v,E,A,y,R,I;S>=T?T>=_?(v=1,E=0,A=0,y=1,R=1,I=0):S>=_?(v=1,E=0,A=0,y=1,R=0,I=1):(v=0,E=0,A=1,y=1,R=0,I=1):T<_?(v=0,E=0,A=1,y=0,R=1,I=1):S<_?(v=0,E=1,A=0,y=0,R=1,I=1):(v=0,E=1,A=0,y=1,R=1,I=0);let L=S-v+u,b=T-E+u,w=_-A+u,P=S-y+2*u,U=T-R+2*u,F=_-I+2*u,O=S-1+3*u,z=T-1+3*u,k=_-1+3*u,G=h&255,Y=f&255,he=d&255,pe=this.perm[G+this.perm[Y+this.perm[he]]]%12,Te=this.perm[G+v+this.perm[Y+E+this.perm[he+A]]]%12,Ee=this.perm[G+y+this.perm[Y+R+this.perm[he+I]]]%12,Re=this.perm[G+1+this.perm[Y+1+this.perm[he+1]]]%12,j=.6-S*S-T*T-_*_;j<0?n=0:(j*=j,n=j*j*this._dot3(this.grad3[pe],S,T,_));let J=.6-L*L-b*b-w*w;J<0?r=0:(J*=J,r=J*J*this._dot3(this.grad3[Te],L,b,w));let fe=.6-P*P-U*U-F*F;fe<0?o=0:(fe*=fe,o=fe*fe*this._dot3(this.grad3[Ee],P,U,F));let Le=.6-O*O-z*z-k*k;return Le<0?a=0:(Le*=Le,a=Le*Le*this._dot3(this.grad3[Re],O,z,k)),32*(n+r+o+a)}noise4d(e,t,i,n){let r=this.grad4,o=this.simplex,a=this.perm,l=(Math.sqrt(5)-1)/4,c=(5-Math.sqrt(5))/20,h,f,d,u,p,x=(e+t+i+n)*l,m=Math.floor(e+x),g=Math.floor(t+x),S=Math.floor(i+x),T=Math.floor(n+x),_=(m+g+S+T)*c,v=m-_,E=g-_,A=S-_,y=T-_,R=e-v,I=t-E,L=i-A,b=n-y,w=R>I?32:0,P=R>L?16:0,U=I>L?8:0,F=R>b?4:0,O=I>b?2:0,z=L>b?1:0,k=w+P+U+F+O+z,G=o[k][0]>=3?1:0,Y=o[k][1]>=3?1:0,he=o[k][2]>=3?1:0,pe=o[k][3]>=3?1:0,Te=o[k][0]>=2?1:0,Ee=o[k][1]>=2?1:0,Re=o[k][2]>=2?1:0,j=o[k][3]>=2?1:0,J=o[k][0]>=1?1:0,fe=o[k][1]>=1?1:0,Le=o[k][2]>=1?1:0,_e=o[k][3]>=1?1:0,ze=R-G+c,et=I-Y+c,ie=L-he+c,ae=b-pe+c,re=R-Te+2*c,oe=I-Ee+2*c,le=L-Re+2*c,ke=b-j+2*c,Ie=R-J+3*c,Ue=I-fe+3*c,je=L-Le+3*c,B=b-_e+3*c,$e=R-1+4*c,Ze=I-1+4*c,N=L-1+4*c,M=b-1+4*c,W=m&255,X=g&255,q=S&255,ue=T&255,de=a[W+a[X+a[q+a[ue]]]]%32,$=a[W+G+a[X+Y+a[q+he+a[ue+pe]]]]%32,te=a[W+Te+a[X+Ee+a[q+Re+a[ue+j]]]]%32,ge=a[W+J+a[X+fe+a[q+Le+a[ue+_e]]]]%32,Oe=a[W+1+a[X+1+a[q+1+a[ue+1]]]]%32,xe=.6-R*R-I*I-L*L-b*b;xe<0?h=0:(xe*=xe,h=xe*xe*this._dot4(r[de],R,I,L,b));let me=.6-ze*ze-et*et-ie*ie-ae*ae;me<0?f=0:(me*=me,f=me*me*this._dot4(r[$],ze,et,ie,ae));let Ne=.6-re*re-oe*oe-le*le-ke*ke;Ne<0?d=0:(Ne*=Ne,d=Ne*Ne*this._dot4(r[te],re,oe,le,ke));let Xe=.6-Ie*Ie-Ue*Ue-je*je-B*B;Xe<0?u=0:(Xe*=Xe,u=Xe*Xe*this._dot4(r[ge],Ie,Ue,je,B));let Je=.6-$e*$e-Ze*Ze-N*N-M*M;return Je<0?p=0:(Je*=Je,p=Je*Je*this._dot4(r[Oe],$e,Ze,N,M)),27*(h+f+d+u+p)}_dot(e,t,i){return e[0]*t+e[1]*i}_dot3(e,t,i,n){return e[0]*t+e[1]*i+e[2]*n}_dot4(e,t,i,n,r){return e[0]*t+e[1]*i+e[2]*n+e[3]*r}};var Ir=class s extends ii{constructor(e,t,i=512,n=512,r,o,a){super(),this.width=i,this.height=n,this.clear=!0,this.camera=t,this.scene=e,this.output=0,this._renderGBuffer=!0,this._visibilityCache=[],this.blendIntensity=1,this.pdRings=2,this.pdRadiusExponent=2,this.pdSamples=16,this.gtaoNoiseTexture=am(),this.pdNoiseTexture=this._generateNoise(),this.gtaoRenderTarget=new dt(this.width,this.height,{type:wt,depthBuffer:!1}),this.pdRenderTarget=this.gtaoRenderTarget.clone(),this.gtaoMaterial=new ct({defines:Object.assign({},ra.defines),uniforms:kt.clone(ra.uniforms),vertexShader:ra.vertexShader,fragmentShader:ra.fragmentShader,blending:Bt,depthTest:!1,depthWrite:!1}),this.gtaoMaterial.defines.PERSPECTIVE_CAMERA=this.camera.isPerspectiveCamera?1:0,this.gtaoMaterial.uniforms.tNoise.value=this.gtaoNoiseTexture,this.gtaoMaterial.uniforms.resolution.value.set(this.width,this.height),this.gtaoMaterial.uniforms.cameraNear.value=this.camera.near,this.gtaoMaterial.uniforms.cameraFar.value=this.camera.far,this.normalMaterial=new yo,this.normalMaterial.blending=Bt,this.pdMaterial=new ct({defines:Object.assign({},aa.defines),uniforms:kt.clone(aa.uniforms),vertexShader:aa.vertexShader,fragmentShader:aa.fragmentShader,depthTest:!1,depthWrite:!1}),this.pdMaterial.uniforms.tDiffuse.value=this.gtaoRenderTarget.texture,this.pdMaterial.uniforms.tNoise.value=this.pdNoiseTexture,this.pdMaterial.uniforms.resolution.value.set(this.width,this.height),this.pdMaterial.uniforms.lumaPhi.value=10,this.pdMaterial.uniforms.depthPhi.value=2,this.pdMaterial.uniforms.normalPhi.value=3,this.pdMaterial.uniforms.radius.value=8,this.depthRenderMaterial=new ct({defines:Object.assign({},oa.defines),uniforms:kt.clone(oa.uniforms),vertexShader:oa.vertexShader,fragmentShader:oa.fragmentShader,blending:Bt}),this.depthRenderMaterial.uniforms.cameraNear.value=this.camera.near,this.depthRenderMaterial.uniforms.cameraFar.value=this.camera.far,this.copyMaterial=new ct({uniforms:kt.clone(cn.uniforms),vertexShader:cn.vertexShader,fragmentShader:cn.fragmentShader,transparent:!0,depthTest:!1,depthWrite:!1,blendSrc:Do,blendDst:Ms,blendEquation:Ri,blendSrcAlpha:Io,blendDstAlpha:Ms,blendEquationAlpha:Ri}),this.blendMaterial=new ct({uniforms:kt.clone(Nc.uniforms),vertexShader:Nc.vertexShader,fragmentShader:Nc.fragmentShader,transparent:!0,depthTest:!1,depthWrite:!1,blending:wl,blendSrc:Do,blendDst:Ms,blendEquation:Ri,blendSrcAlpha:Io,blendDstAlpha:Ms,blendEquationAlpha:Ri}),this._fsQuad=new Di(null),this._originalClearColor=new Me,this.setGBuffer(r?r.depthTexture:void 0,r?r.normalTexture:void 0),o!==void 0&&this.updateGtaoMaterial(o),a!==void 0&&this.updatePdMaterial(a)}setSize(e,t){this.width=e,this.height=t,this.gtaoRenderTarget.setSize(e,t),this.normalRenderTarget.setSize(e,t),this.pdRenderTarget.setSize(e,t),this.gtaoMaterial.uniforms.resolution.value.set(e,t),this.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this.pdMaterial.uniforms.resolution.value.set(e,t),this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse)}dispose(){this.gtaoNoiseTexture.dispose(),this.pdNoiseTexture.dispose(),this.normalRenderTarget.dispose(),this.gtaoRenderTarget.dispose(),this.pdRenderTarget.dispose(),this.normalMaterial.dispose(),this.pdMaterial.dispose(),this.copyMaterial.dispose(),this.depthRenderMaterial.dispose(),this._fsQuad.dispose()}get gtaoMap(){return this.pdRenderTarget.texture}setGBuffer(e,t){e!==void 0?(this.depthTexture=e,this.normalTexture=t,this._renderGBuffer=!1):(this.depthTexture=new tn,this.depthTexture.format=on,this.depthTexture.type=Qn,this.normalRenderTarget=new dt(this.width,this.height,{minFilter:bt,magFilter:bt,type:wt,depthTexture:this.depthTexture}),this.normalTexture=this.normalRenderTarget.texture,this._renderGBuffer=!0);let i=this.normalTexture?1:0,n=this.depthTexture===this.normalTexture?"w":"x";this.gtaoMaterial.defines.NORMAL_VECTOR_TYPE=i,this.gtaoMaterial.defines.DEPTH_SWIZZLING=n,this.gtaoMaterial.uniforms.tNormal.value=this.normalTexture,this.gtaoMaterial.uniforms.tDepth.value=this.depthTexture,this.pdMaterial.defines.NORMAL_VECTOR_TYPE=i,this.pdMaterial.defines.DEPTH_SWIZZLING=n,this.pdMaterial.uniforms.tNormal.value=this.normalTexture,this.pdMaterial.uniforms.tDepth.value=this.depthTexture,this.depthRenderMaterial.uniforms.tDepth.value=this.normalRenderTarget.depthTexture}setSceneClipBox(e){e?(this.gtaoMaterial.needsUpdate=this.gtaoMaterial.defines.SCENE_CLIP_BOX!==1,this.gtaoMaterial.defines.SCENE_CLIP_BOX=1,this.gtaoMaterial.uniforms.sceneBoxMin.value.copy(e.min),this.gtaoMaterial.uniforms.sceneBoxMax.value.copy(e.max)):(this.gtaoMaterial.needsUpdate=this.gtaoMaterial.defines.SCENE_CLIP_BOX===0,this.gtaoMaterial.defines.SCENE_CLIP_BOX=0)}updateGtaoMaterial(e){e.radius!==void 0&&(this.gtaoMaterial.uniforms.radius.value=e.radius),e.distanceExponent!==void 0&&(this.gtaoMaterial.uniforms.distanceExponent.value=e.distanceExponent),e.thickness!==void 0&&(this.gtaoMaterial.uniforms.thickness.value=e.thickness),e.distanceFallOff!==void 0&&(this.gtaoMaterial.uniforms.distanceFallOff.value=e.distanceFallOff,this.gtaoMaterial.needsUpdate=!0),e.scale!==void 0&&(this.gtaoMaterial.uniforms.scale.value=e.scale),e.samples!==void 0&&e.samples!==this.gtaoMaterial.defines.SAMPLES&&(this.gtaoMaterial.defines.SAMPLES=e.samples,this.gtaoMaterial.needsUpdate=!0),e.screenSpaceRadius!==void 0&&(e.screenSpaceRadius?1:0)!==this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS&&(this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS=e.screenSpaceRadius?1:0,this.gtaoMaterial.needsUpdate=!0)}updatePdMaterial(e){let t=!1;e.lumaPhi!==void 0&&(this.pdMaterial.uniforms.lumaPhi.value=e.lumaPhi),e.depthPhi!==void 0&&(this.pdMaterial.uniforms.depthPhi.value=e.depthPhi),e.normalPhi!==void 0&&(this.pdMaterial.uniforms.normalPhi.value=e.normalPhi),e.radius!==void 0&&e.radius!==this.radius&&(this.pdMaterial.uniforms.radius.value=e.radius),e.radiusExponent!==void 0&&e.radiusExponent!==this.pdRadiusExponent&&(this.pdRadiusExponent=e.radiusExponent,t=!0),e.rings!==void 0&&e.rings!==this.pdRings&&(this.pdRings=e.rings,t=!0),e.samples!==void 0&&e.samples!==this.pdSamples&&(this.pdSamples=e.samples,t=!0),t&&(this.pdMaterial.defines.SAMPLES=this.pdSamples,this.pdMaterial.defines.SAMPLE_VECTORS=Xu(this.pdSamples,this.pdRings,this.pdRadiusExponent),this.pdMaterial.needsUpdate=!0)}render(e,t,i){switch(this._renderGBuffer&&(this._overrideVisibility(),this._renderOverride(e,this.normalMaterial,this.normalRenderTarget,7829503,1),this._restoreVisibility()),this.gtaoMaterial.uniforms.cameraNear.value=this.camera.near,this.gtaoMaterial.uniforms.cameraFar.value=this.camera.far,this.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this.gtaoMaterial.uniforms.cameraWorldMatrix.value.copy(this.camera.matrixWorld),this._renderPass(e,this.gtaoMaterial,this.gtaoRenderTarget,16777215,1),this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this._renderPass(e,this.pdMaterial,this.pdRenderTarget,16777215,1),this.output){case s.OUTPUT.Off:break;case s.OUTPUT.Diffuse:this.copyMaterial.uniforms.tDiffuse.value=i.texture,this.copyMaterial.blending=Bt,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:t);break;case s.OUTPUT.AO:this.copyMaterial.uniforms.tDiffuse.value=this.gtaoRenderTarget.texture,this.copyMaterial.blending=Bt,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:t);break;case s.OUTPUT.Denoise:this.copyMaterial.uniforms.tDiffuse.value=this.pdRenderTarget.texture,this.copyMaterial.blending=Bt,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:t);break;case s.OUTPUT.Depth:this.depthRenderMaterial.uniforms.cameraNear.value=this.camera.near,this.depthRenderMaterial.uniforms.cameraFar.value=this.camera.far,this._renderPass(e,this.depthRenderMaterial,this.renderToScreen?null:t);break;case s.OUTPUT.Normal:this.copyMaterial.uniforms.tDiffuse.value=this.normalRenderTarget.texture,this.copyMaterial.blending=Bt,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:t);break;case s.OUTPUT.Default:this.copyMaterial.uniforms.tDiffuse.value=i.texture,this.copyMaterial.blending=Bt,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:t),this.blendMaterial.uniforms.intensity.value=this.blendIntensity,this.blendMaterial.uniforms.tDiffuse.value=this.pdRenderTarget.texture,this._renderPass(e,this.blendMaterial,this.renderToScreen?null:t);break;default:console.warn("THREE.GTAOPass: Unknown output type.")}}_renderPass(e,t,i,n,r){e.getClearColor(this._originalClearColor);let o=e.getClearAlpha(),a=e.autoClear;e.setRenderTarget(i),e.autoClear=!1,n!=null&&(e.setClearColor(n),e.setClearAlpha(r||0),e.clear()),this._fsQuad.material=t,this._fsQuad.render(e),e.autoClear=a,e.setClearColor(this._originalClearColor),e.setClearAlpha(o)}_renderOverride(e,t,i,n,r){e.getClearColor(this._originalClearColor);let o=e.getClearAlpha(),a=e.autoClear;e.setRenderTarget(i),e.autoClear=!1,n=t.clearColor||n,r=t.clearAlpha||r,n!=null&&(e.setClearColor(n),e.setClearAlpha(r||0),e.clear()),this.scene.overrideMaterial=t,e.render(this.scene,this.camera),this.scene.overrideMaterial=null,e.autoClear=a,e.setClearColor(this._originalClearColor),e.setClearAlpha(o)}_overrideVisibility(){let e=this.scene,t=this._visibilityCache;e.traverse(function(i){(i.isPoints||i.isLine||i.isLine2)&&i.visible&&(i.visible=!1,t.push(i))})}_restoreVisibility(){let e=this._visibilityCache;for(let t=0;t<e.length;t++)e[t].visible=!0;e.length=0}_generateNoise(e=64){let t=new Uc,i=e*e*4,n=new Uint8Array(i);for(let o=0;o<e;o++)for(let a=0;a<e;a++){let l=o,c=a;n[(o*e+a)*4]=(t.noise(l,c)*.5+.5)*255,n[(o*e+a)*4+1]=(t.noise(l+e,c)*.5+.5)*255,n[(o*e+a)*4+2]=(t.noise(l,c+e)*.5+.5)*255,n[(o*e+a)*4+3]=(t.noise(l+e,c+e)*.5+.5)*255}let r=new en(n,e,e,fi,li);return r.wrapS=Xt,r.wrapT=Xt,r.needsUpdate=!0,r}};Ir.OUTPUT={Off:-1,Default:0,Diffuse:1,Depth:2,Normal:3,AO:4,Denoise:5};var lm={name:"LuminosityHighPassShader",uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new Me(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};var Dr=class s extends ii{constructor(e,t=1,i,n){super(),this.strength=t,this.radius=i,this.threshold=n,this.resolution=e!==void 0?new ee(e.x,e.y):new ee(256,256),this.clearColor=new Me(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let r=Math.round(this.resolution.x/2),o=Math.round(this.resolution.y/2);this.renderTargetBright=new dt(r,o,{type:wt,depthBuffer:!1}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let h=0;h<this.nMips;h++){let f=new dt(r,o,{type:wt,depthBuffer:!1});f.texture.name="UnrealBloomPass.h"+h,f.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(f);let d=new dt(r,o,{type:wt,depthBuffer:!1});d.texture.name="UnrealBloomPass.v"+h,d.texture.generateMipmaps=!1,this.renderTargetsVertical.push(d),r=Math.round(r/2),o=Math.round(o/2)}let a=lm;this.highPassUniforms=kt.clone(a.uniforms),this.highPassUniforms.luminosityThreshold.value=n,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new ct({uniforms:this.highPassUniforms,vertexShader:a.vertexShader,fragmentShader:a.fragmentShader}),this.separableBlurMaterials=[];let l=[6,10,14,18,22];r=Math.round(this.resolution.x/2),o=Math.round(this.resolution.y/2);for(let h=0;h<this.nMips;h++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(l[h])),this.separableBlurMaterials[h].uniforms.invSize.value=new ee(1/r,1/o),r=Math.round(r/2),o=Math.round(o/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1;let c=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=c,this.bloomTintColors=[new D(1,1,1),new D(1,1,1),new D(1,1,1),new D(1,1,1),new D(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=kt.clone(cn.uniforms),this.blendMaterial=new ct({uniforms:this.copyUniforms,vertexShader:cn.vertexShader,fragmentShader:cn.fragmentShader,premultipliedAlpha:!0,blending:ys,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new Me,this._oldClearAlpha=1,this._basic=new St,this._fsQuad=new Di(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,t){let i=Math.round(e/2),n=Math.round(t/2);this.renderTargetBright.setSize(i,n);for(let r=0;r<this.nMips;r++)this.renderTargetsHorizontal[r].setSize(i,n),this.renderTargetsVertical[r].setSize(i,n),this.separableBlurMaterials[r].uniforms.invSize.value=new ee(1/i,1/n),i=Math.round(i/2),n=Math.round(n/2)}render(e,t,i,n,r){e.getClearColor(this._oldClearColor),this._oldClearAlpha=e.getClearAlpha();let o=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),r&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=i.texture,e.setRenderTarget(null),e.clear(),this._fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=i.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this._fsQuad.render(e);let a=this.renderTargetBright;for(let l=0;l<this.nMips;l++)this._fsQuad.material=this.separableBlurMaterials[l],this.separableBlurMaterials[l].uniforms.colorTexture.value=a.texture,this.separableBlurMaterials[l].uniforms.direction.value=s.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[l]),e.clear(),this._fsQuad.render(e),this.separableBlurMaterials[l].uniforms.colorTexture.value=this.renderTargetsHorizontal[l].texture,this.separableBlurMaterials[l].uniforms.direction.value=s.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[l]),e.clear(),this._fsQuad.render(e),a=this.renderTargetsVertical[l];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this._fsQuad.render(e),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,r&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(i),this._fsQuad.render(e)),e.setClearColor(this._oldClearColor,this._oldClearAlpha),e.autoClear=o}_getSeparableBlurMaterial(e){let t=[],i=e/3;for(let o=0;o<e;o++)t.push(.39894*Math.exp(-.5*o*o/(i*i))/i);let n=[],r=[];for(let o=1;o<e;o+=2){let a=t[o],l=o+1<e?t[o+1]:0,c=a+l;n.push((o*a+(o+1)*l)/c),r.push(c)}return new ct({defines:{KERNEL_PAIRS:n.length},uniforms:{colorTexture:{value:null},invSize:{value:new ee(.5,.5)},direction:{value:new ee(.5,.5)},centerWeight:{value:t[0]},gaussianOffsets:{value:n},gaussianWeights:{value:r}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				#include <common>

				varying vec2 vUv;

				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float centerWeight;
				uniform float gaussianOffsets[KERNEL_PAIRS];
				uniform float gaussianWeights[KERNEL_PAIRS];

				void main() {

					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * centerWeight;

					for ( int i = 0; i < KERNEL_PAIRS; i ++ ) {

						vec2 uvOffset = direction * invSize * gaussianOffsets[ i ];
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += ( sample1 + sample2 ) * gaussianWeights[ i ];

					}

					gl_FragColor = vec4( diffuseSum, 1.0 );

				}`})}_getCompositeMaterial(e){return new ct({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				varying vec2 vUv;

				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor( const in float factor ) {

					float mirrorFactor = 1.2 - factor;
					return mix( factor, mirrorFactor, bloomRadius );

				}

				void main() {

					// 3.0 for backwards compatibility with previous alpha-based intensity
					vec3 bloom = 3.0 * bloomStrength * (
						lerpBloomFactor( bloomFactors[ 0 ] ) * bloomTintColors[ 0 ] * texture2D( blurTexture1, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 1 ] ) * bloomTintColors[ 1 ] * texture2D( blurTexture2, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 2 ] ) * bloomTintColors[ 2 ] * texture2D( blurTexture3, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 3 ] ) * bloomTintColors[ 3 ] * texture2D( blurTexture4, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 4 ] ) * bloomTintColors[ 4 ] * texture2D( blurTexture5, vUv ).rgb
					);

					float bloomAlpha = max( bloom.r, max( bloom.g, bloom.b ) );
					gl_FragColor = vec4( bloom, bloomAlpha );

				}`})}};Dr.BlurDirectionX=new ee(1,0);Dr.BlurDirectionY=new ee(0,1);var la={name:"SMAAEdgesShader",defines:{SMAA_THRESHOLD:"0.1"},uniforms:{tDiffuse:{value:null},resolution:{value:new ee(1/1024,1/512)}},vertexShader:`

		uniform vec2 resolution;

		varying vec2 vUv;
		varying vec4 vOffset[ 3 ];

		void SMAAEdgeDetectionVS( vec2 texcoord ) {
			vOffset[ 0 ] = texcoord.xyxy + resolution.xyxy * vec4( -1.0, 0.0, 0.0,  1.0 ); // WebGL port note: Changed sign in W component
			vOffset[ 1 ] = texcoord.xyxy + resolution.xyxy * vec4(  1.0, 0.0, 0.0, -1.0 ); // WebGL port note: Changed sign in W component
			vOffset[ 2 ] = texcoord.xyxy + resolution.xyxy * vec4( -2.0, 0.0, 0.0,  2.0 ); // WebGL port note: Changed sign in W component
		}

		void main() {

			vUv = uv;

			SMAAEdgeDetectionVS( vUv );

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;

		varying vec2 vUv;
		varying vec4 vOffset[ 3 ];

		vec4 SMAAColorEdgeDetectionPS( vec2 texcoord, vec4 offset[3], sampler2D colorTex ) {
			vec2 threshold = vec2( SMAA_THRESHOLD, SMAA_THRESHOLD );

			// Calculate color deltas:
			vec4 delta;
			vec3 C = texture2D( colorTex, texcoord ).rgb;

			vec3 Cleft = texture2D( colorTex, offset[0].xy ).rgb;
			vec3 t = abs( C - Cleft );
			delta.x = max( max( t.r, t.g ), t.b );

			vec3 Ctop = texture2D( colorTex, offset[0].zw ).rgb;
			t = abs( C - Ctop );
			delta.y = max( max( t.r, t.g ), t.b );

			// We do the usual threshold:
			vec2 edges = step( threshold, delta.xy );

			// Then discard if there is no edge:
			if ( dot( edges, vec2( 1.0, 1.0 ) ) == 0.0 )
				discard;

			// Calculate right and bottom deltas:
			vec3 Cright = texture2D( colorTex, offset[1].xy ).rgb;
			t = abs( C - Cright );
			delta.z = max( max( t.r, t.g ), t.b );

			vec3 Cbottom  = texture2D( colorTex, offset[1].zw ).rgb;
			t = abs( C - Cbottom );
			delta.w = max( max( t.r, t.g ), t.b );

			// Calculate the maximum delta in the direct neighborhood:
			float maxDelta = max( max( max( delta.x, delta.y ), delta.z ), delta.w );

			// Calculate left-left and top-top deltas:
			vec3 Cleftleft  = texture2D( colorTex, offset[2].xy ).rgb;
			t = abs( C - Cleftleft );
			delta.z = max( max( t.r, t.g ), t.b );

			vec3 Ctoptop = texture2D( colorTex, offset[2].zw ).rgb;
			t = abs( C - Ctoptop );
			delta.w = max( max( t.r, t.g ), t.b );

			// Calculate the final maximum delta:
			maxDelta = max( max( maxDelta, delta.z ), delta.w );

			// Local contrast adaptation in action:
			edges.xy *= step( 0.5 * maxDelta, delta.xy );

			return vec4( edges, 0.0, 0.0 );
		}

		void main() {

			gl_FragColor = SMAAColorEdgeDetectionPS( vUv, vOffset, tDiffuse );

		}`},ca={name:"SMAAWeightsShader",defines:{SMAA_MAX_SEARCH_STEPS:"8",SMAA_AREATEX_MAX_DISTANCE:"16",SMAA_AREATEX_PIXEL_SIZE:"( 1.0 / vec2( 160.0, 560.0 ) )",SMAA_AREATEX_SUBTEX_SIZE:"( 1.0 / 7.0 )"},uniforms:{tDiffuse:{value:null},tArea:{value:null},tSearch:{value:null},resolution:{value:new ee(1/1024,1/512)}},vertexShader:`

		uniform vec2 resolution;

		varying vec2 vUv;
		varying vec4 vOffset[ 3 ];
		varying vec2 vPixcoord;

		void SMAABlendingWeightCalculationVS( vec2 texcoord ) {
			vPixcoord = texcoord / resolution;

			// We will use these offsets for the searches later on (see @PSEUDO_GATHER4):
			vOffset[ 0 ] = texcoord.xyxy + resolution.xyxy * vec4( -0.25, 0.125, 1.25, 0.125 ); // WebGL port note: Changed sign in Y and W components
			vOffset[ 1 ] = texcoord.xyxy + resolution.xyxy * vec4( -0.125, 0.25, -0.125, -1.25 ); // WebGL port note: Changed sign in Y and W components

			// And these for the searches, they indicate the ends of the loops:
			vOffset[ 2 ] = vec4( vOffset[ 0 ].xz, vOffset[ 1 ].yw ) + vec4( -2.0, 2.0, -2.0, 2.0 ) * resolution.xxyy * float( SMAA_MAX_SEARCH_STEPS );

		}

		void main() {

			vUv = uv;

			SMAABlendingWeightCalculationVS( vUv );

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		#define SMAASampleLevelZeroOffset( tex, coord, offset ) texture2D( tex, coord + float( offset ) * resolution, 0.0 )

		uniform sampler2D tDiffuse;
		uniform sampler2D tArea;
		uniform sampler2D tSearch;
		uniform vec2 resolution;

		varying vec2 vUv;
		varying vec4 vOffset[3];
		varying vec2 vPixcoord;

		#if __VERSION__ == 100
		vec2 round( vec2 x ) {
			return sign( x ) * floor( abs( x ) + 0.5 );
		}
		#endif

		float SMAASearchLength( sampler2D searchTex, vec2 e, float bias, float scale ) {
			// Not required if searchTex accesses are set to point:
			// float2 SEARCH_TEX_PIXEL_SIZE = 1.0 / float2(66.0, 33.0);
			// e = float2(bias, 0.0) + 0.5 * SEARCH_TEX_PIXEL_SIZE +
			//     e * float2(scale, 1.0) * float2(64.0, 32.0) * SEARCH_TEX_PIXEL_SIZE;
			e.r = bias + e.r * scale;
			return 255.0 * texture2D( searchTex, e, 0.0 ).r;
		}

		float SMAASearchXLeft( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {
			/**
				* @PSEUDO_GATHER4
				* This texcoord has been offset by (-0.25, -0.125) in the vertex shader to
				* sample between edge, thus fetching four edges in a row.
				* Sampling with different offsets in each direction allows to disambiguate
				* which edges are active from the four fetched ones.
				*/
			vec2 e = vec2( 0.0, 1.0 );

			for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) { // WebGL port note: Changed while to for
				e = texture2D( edgesTex, texcoord, 0.0 ).rg;
				texcoord -= vec2( 2.0, 0.0 ) * resolution;
				if ( ! ( texcoord.x > end && e.g > 0.8281 && e.r == 0.0 ) ) break;
			}

			// We correct the previous (-0.25, -0.125) offset we applied:
			texcoord.x += 0.25 * resolution.x;

			// The searches are bias by 1, so adjust the coords accordingly:
			texcoord.x += resolution.x;

			// Disambiguate the length added by the last step:
			texcoord.x += 2.0 * resolution.x; // Undo last step
			texcoord.x -= resolution.x * SMAASearchLength(searchTex, e, 0.0, 0.5);

			return texcoord.x;
		}

		float SMAASearchXRight( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {
			vec2 e = vec2( 0.0, 1.0 );

			for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) { // WebGL port note: Changed while to for
				e = texture2D( edgesTex, texcoord, 0.0 ).rg;
				texcoord += vec2( 2.0, 0.0 ) * resolution;
				if ( ! ( texcoord.x < end && e.g > 0.8281 && e.r == 0.0 ) ) break;
			}

			texcoord.x -= 0.25 * resolution.x;
			texcoord.x -= resolution.x;
			texcoord.x -= 2.0 * resolution.x;
			texcoord.x += resolution.x * SMAASearchLength( searchTex, e, 0.5, 0.5 );

			return texcoord.x;
		}

		float SMAASearchYUp( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {
			vec2 e = vec2( 1.0, 0.0 );

			for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) { // WebGL port note: Changed while to for
				e = texture2D( edgesTex, texcoord, 0.0 ).rg;
				texcoord += vec2( 0.0, 2.0 ) * resolution; // WebGL port note: Changed sign
				if ( ! ( texcoord.y > end && e.r > 0.8281 && e.g == 0.0 ) ) break;
			}

			texcoord.y -= 0.25 * resolution.y; // WebGL port note: Changed sign
			texcoord.y -= resolution.y; // WebGL port note: Changed sign
			texcoord.y -= 2.0 * resolution.y; // WebGL port note: Changed sign
			texcoord.y += resolution.y * SMAASearchLength( searchTex, e.gr, 0.0, 0.5 ); // WebGL port note: Changed sign

			return texcoord.y;
		}

		float SMAASearchYDown( sampler2D edgesTex, sampler2D searchTex, vec2 texcoord, float end ) {
			vec2 e = vec2( 1.0, 0.0 );

			for ( int i = 0; i < SMAA_MAX_SEARCH_STEPS; i ++ ) { // WebGL port note: Changed while to for
				e = texture2D( edgesTex, texcoord, 0.0 ).rg;
				texcoord -= vec2( 0.0, 2.0 ) * resolution; // WebGL port note: Changed sign
				if ( ! ( texcoord.y < end && e.r > 0.8281 && e.g == 0.0 ) ) break;
			}

			texcoord.y += 0.25 * resolution.y; // WebGL port note: Changed sign
			texcoord.y += resolution.y; // WebGL port note: Changed sign
			texcoord.y += 2.0 * resolution.y; // WebGL port note: Changed sign
			texcoord.y -= resolution.y * SMAASearchLength( searchTex, e.gr, 0.5, 0.5 ); // WebGL port note: Changed sign

			return texcoord.y;
		}

		vec2 SMAAArea( sampler2D areaTex, vec2 dist, float e1, float e2, float offset ) {
			// Rounding prevents precision errors of bilinear filtering:
			vec2 texcoord = float( SMAA_AREATEX_MAX_DISTANCE ) * round( 4.0 * vec2( e1, e2 ) ) + dist;

			// We do a scale and bias for mapping to texel space:
			texcoord = SMAA_AREATEX_PIXEL_SIZE * texcoord + ( 0.5 * SMAA_AREATEX_PIXEL_SIZE );

			// Move to proper place, according to the subpixel offset:
			texcoord.y += SMAA_AREATEX_SUBTEX_SIZE * offset;

			return texture2D( areaTex, texcoord, 0.0 ).rg;
		}

		vec4 SMAABlendingWeightCalculationPS( vec2 texcoord, vec2 pixcoord, vec4 offset[ 3 ], sampler2D edgesTex, sampler2D areaTex, sampler2D searchTex, ivec4 subsampleIndices ) {
			vec4 weights = vec4( 0.0, 0.0, 0.0, 0.0 );

			vec2 e = texture2D( edgesTex, texcoord ).rg;

			if ( e.g > 0.0 ) { // Edge at north
				vec2 d;

				// Find the distance to the left:
				vec2 coords;
				coords.x = SMAASearchXLeft( edgesTex, searchTex, offset[ 0 ].xy, offset[ 2 ].x );
				coords.y = offset[ 1 ].y; // offset[1].y = texcoord.y - 0.25 * resolution.y (@CROSSING_OFFSET)
				d.x = coords.x;

				// Now fetch the left crossing edges, two at a time using bilinear
				// filtering. Sampling at -0.25 (see @CROSSING_OFFSET) enables to
				// discern what value each edge has:
				float e1 = texture2D( edgesTex, coords, 0.0 ).r;

				// Find the distance to the right:
				coords.x = SMAASearchXRight( edgesTex, searchTex, offset[ 0 ].zw, offset[ 2 ].y );
				d.y = coords.x;

				// We want the distances to be in pixel units (doing this here allow to
				// better interleave arithmetic and memory accesses):
				d = d / resolution.x - pixcoord.x;

				// SMAAArea below needs a sqrt, as the areas texture is compressed
				// quadratically:
				vec2 sqrt_d = sqrt( abs( d ) );

				// Fetch the right crossing edges:
				coords.y -= 1.0 * resolution.y; // WebGL port note: Added
				float e2 = SMAASampleLevelZeroOffset( edgesTex, coords, ivec2( 1, 0 ) ).r;

				// Ok, we know how this pattern looks like, now it is time for getting
				// the actual area:
				weights.rg = SMAAArea( areaTex, sqrt_d, e1, e2, float( subsampleIndices.y ) );
			}

			if ( e.r > 0.0 ) { // Edge at west
				vec2 d;

				// Find the distance to the top:
				vec2 coords;

				coords.y = SMAASearchYUp( edgesTex, searchTex, offset[ 1 ].xy, offset[ 2 ].z );
				coords.x = offset[ 0 ].x; // offset[1].x = texcoord.x - 0.25 * resolution.x;
				d.x = coords.y;

				// Fetch the top crossing edges:
				float e1 = texture2D( edgesTex, coords, 0.0 ).g;

				// Find the distance to the bottom:
				coords.y = SMAASearchYDown( edgesTex, searchTex, offset[ 1 ].zw, offset[ 2 ].w );
				d.y = coords.y;

				// We want the distances to be in pixel units:
				d = d / resolution.y - pixcoord.y;

				// SMAAArea below needs a sqrt, as the areas texture is compressed
				// quadratically:
				vec2 sqrt_d = sqrt( abs( d ) );

				// Fetch the bottom crossing edges:
				coords.y -= 1.0 * resolution.y; // WebGL port note: Added
				float e2 = SMAASampleLevelZeroOffset( edgesTex, coords, ivec2( 0, 1 ) ).g;

				// Get the area for this direction:
				weights.ba = SMAAArea( areaTex, sqrt_d, e1, e2, float( subsampleIndices.x ) );
			}

			return weights;
		}

		void main() {

			gl_FragColor = SMAABlendingWeightCalculationPS( vUv, vPixcoord, vOffset, tDiffuse, tArea, tSearch, ivec4( 0.0 ) );

		}`},Oc={name:"SMAABlendShader",uniforms:{tDiffuse:{value:null},tColor:{value:null},resolution:{value:new ee(1/1024,1/512)}},vertexShader:`

		uniform vec2 resolution;

		varying vec2 vUv;
		varying vec4 vOffset[ 2 ];

		void SMAANeighborhoodBlendingVS( vec2 texcoord ) {
			vOffset[ 0 ] = texcoord.xyxy + resolution.xyxy * vec4( -1.0, 0.0, 0.0, 1.0 ); // WebGL port note: Changed sign in W component
			vOffset[ 1 ] = texcoord.xyxy + resolution.xyxy * vec4( 1.0, 0.0, 0.0, -1.0 ); // WebGL port note: Changed sign in W component
		}

		void main() {

			vUv = uv;

			SMAANeighborhoodBlendingVS( vUv );

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform sampler2D tColor;
		uniform vec2 resolution;

		varying vec2 vUv;
		varying vec4 vOffset[ 2 ];

		vec4 SMAANeighborhoodBlendingPS( vec2 texcoord, vec4 offset[ 2 ], sampler2D colorTex, sampler2D blendTex ) {
			// Fetch the blending weights for current pixel:
			vec4 a;
			a.xz = texture2D( blendTex, texcoord ).xz;
			a.y = texture2D( blendTex, offset[ 1 ].zw ).g;
			a.w = texture2D( blendTex, offset[ 1 ].xy ).a;

			// Is there any blending weight with a value greater than 0.0?
			if ( dot(a, vec4( 1.0, 1.0, 1.0, 1.0 )) < 1e-5 ) {
				return texture2D( colorTex, texcoord, 0.0 );
			} else {
				// Up to 4 lines can be crossing a pixel (one through each edge). We
				// favor blending by choosing the line with the maximum weight for each
				// direction:
				vec2 offset;
				offset.x = a.a > a.b ? a.a : -a.b; // left vs. right
				offset.y = a.g > a.r ? -a.g : a.r; // top vs. bottom // WebGL port note: Changed signs

				// Then we go in the direction that has the maximum weight:
				if ( abs( offset.x ) > abs( offset.y )) { // horizontal vs. vertical
					offset.y = 0.0;
				} else {
					offset.x = 0.0;
				}

				// Fetch the opposite color and lerp by hand:
				vec4 C = texture2D( colorTex, texcoord, 0.0 );
				texcoord += sign( offset ) * resolution;
				vec4 Cop = texture2D( colorTex, texcoord, 0.0 );
				float s = abs( offset.x ) > abs( offset.y ) ? abs( offset.x ) : abs( offset.y );

				// WebGL port note: Added gamma correction
				C.xyz = pow(C.xyz, vec3(2.2));
				Cop.xyz = pow(Cop.xyz, vec3(2.2));
				vec4 mixed = mix(C, Cop, s);
				mixed.xyz = pow(mixed.xyz, vec3(1.0 / 2.2));

				return mixed;
			}
		}

		void main() {

			gl_FragColor = SMAANeighborhoodBlendingPS( vUv, vOffset, tColor, tDiffuse );

		}`};var Fc=class extends ii{constructor(){super(),this._edgesRT=new dt(1,1,{depthBuffer:!1,type:wt}),this._edgesRT.texture.name="SMAAPass.edges",this._weightsRT=new dt(1,1,{depthBuffer:!1,type:wt}),this._weightsRT.texture.name="SMAAPass.weights";let e=this,t=new Image;t.src=this._getAreaTexture(),t.onload=function(){e._areaTexture.needsUpdate=!0},this._areaTexture=new Ot,this._areaTexture.name="SMAAPass.area",this._areaTexture.image=t,this._areaTexture.minFilter=It,this._areaTexture.generateMipmaps=!1,this._areaTexture.flipY=!1;let i=new Image;i.src=this._getSearchTexture(),i.onload=function(){e._searchTexture.needsUpdate=!0},this._searchTexture=new Ot,this._searchTexture.name="SMAAPass.search",this._searchTexture.image=i,this._searchTexture.magFilter=bt,this._searchTexture.minFilter=bt,this._searchTexture.generateMipmaps=!1,this._searchTexture.flipY=!1,this._uniformsEdges=kt.clone(la.uniforms),this._materialEdges=new ct({defines:Object.assign({},la.defines),uniforms:this._uniformsEdges,vertexShader:la.vertexShader,fragmentShader:la.fragmentShader}),this._uniformsWeights=kt.clone(ca.uniforms),this._uniformsWeights.tDiffuse.value=this._edgesRT.texture,this._uniformsWeights.tArea.value=this._areaTexture,this._uniformsWeights.tSearch.value=this._searchTexture,this._materialWeights=new ct({defines:Object.assign({},ca.defines),uniforms:this._uniformsWeights,vertexShader:ca.vertexShader,fragmentShader:ca.fragmentShader}),this._uniformsBlend=kt.clone(Oc.uniforms),this._uniformsBlend.tDiffuse.value=this._weightsRT.texture,this._materialBlend=new ct({uniforms:this._uniformsBlend,vertexShader:Oc.vertexShader,fragmentShader:Oc.fragmentShader}),this._fsQuad=new Di(null)}render(e,t,i){this._uniformsEdges.tDiffuse.value=i.texture,this._fsQuad.material=this._materialEdges,e.setRenderTarget(this._edgesRT),this.clear&&e.clear(),this._fsQuad.render(e),this._fsQuad.material=this._materialWeights,e.setRenderTarget(this._weightsRT),this.clear&&e.clear(),this._fsQuad.render(e),this._uniformsBlend.tColor.value=i.texture,this._fsQuad.material=this._materialBlend,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(),this._fsQuad.render(e))}setSize(e,t){this._edgesRT.setSize(e,t),this._weightsRT.setSize(e,t),this._materialEdges.uniforms.resolution.value.set(1/e,1/t),this._materialWeights.uniforms.resolution.value.set(1/e,1/t),this._materialBlend.uniforms.resolution.value.set(1/e,1/t)}dispose(){this._edgesRT.dispose(),this._weightsRT.dispose(),this._areaTexture.dispose(),this._searchTexture.dispose(),this._materialEdges.dispose(),this._materialWeights.dispose(),this._materialBlend.dispose(),this._fsQuad.dispose()}_getAreaTexture(){return"data:image/png;base64,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"}_getSearchTexture(){return"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEIAAAAhCAAAAABIXyLAAAAAOElEQVRIx2NgGAWjYBSMglEwEICREYRgFBZBqDCSLA2MGPUIVQETE9iNUAqLR5gIeoQKRgwXjwAAGn4AtaFeYLEAAAAASUVORK5CYII="}};var ha={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`};var Bc=class extends ii{constructor(){super(),this.isOutputPass=!0,this.uniforms=kt.clone(ha.uniforms),this.material=new dr({name:ha.name,uniforms:this.uniforms,vertexShader:ha.vertexShader,fragmentShader:ha.fragmentShader}),this._fsQuad=new Di(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,i){this.uniforms.tDiffuse.value=i.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},tt.getTransfer(this._outputColorSpace)===ht&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===No?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===Uo?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===Oo?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===Fo?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===ko?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===Kn?this.material.defines.NEUTRAL_TONE_MAPPING="":this._toneMapping===Bo&&(this.material.defines.CUSTOM_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}};var As=Math.PI/180;function cm(s,e,t,i=0){let n=23.44*Math.sin(As*.9863013698630136*(e-81)),r=15*(s-12),o=t*As,a=n*As,l=r*As,c=Math.sin(o)*Math.sin(a)+Math.cos(o)*Math.cos(a)*Math.cos(l),h=Math.asin(Math.max(-1,Math.min(1,c))),f=(Math.sin(a)-Math.sin(h)*Math.sin(o))/(Math.cos(h)*Math.cos(o)||1e-9),d=Math.acos(Math.max(-1,Math.min(1,f)));r>0&&(d=2*Math.PI-d);let u=d-i*As,p=[Math.sin(u)*Math.cos(h),Math.sin(h),-Math.cos(u)*Math.cos(h)];return{elevation:h/As,azimuth:d/As,dir:p}}var un=(s,e,t)=>s+(e-s)*t,hn=(s,e,t)=>[un(s[0],e[0],t),un(s[1],e[1],t),un(s[2],e[2],t)],Ln=s=>Math.max(0,Math.min(1,s));function qu(s,e="clear"){let t=s,i=Ln((t+6)/18),n=Ln(1-Math.abs(t-8)/14),r=Ln((-t-4)/8),o=e==="overcast"?1:e==="hazy"?.45:0,a=hn(hn([1,.96,.9],[1,.72,.42],n),[.85,.87,.92],o),l=i*un(3.4,.9,o)*(1-r),c=hn(hn([.05,.08,.16],[.36,.56,.92],i),[.62,.66,.72],o),h=hn(hn([.1,.12,.2],hn([.68,.79,.93],[.98,.72,.5],n),i),[.78,.8,.84],o),f=hn(hn([.16,.2,.34],[.78,.86,1],i),[.78,.8,.84],o),d=hn([.05,.06,.08],[.45,.42,.38],i),u=un(.35,un(1.6,2.2,o),i),p=un(.95,1.05,i),x=r*.35;return{day:i,night:r,golden:n,overcast:o,sunColor:a,sunIntensity:l,skyTop:c,skyHorizon:h,hemiSky:f,hemiGround:d,hemiIntensity:u,exposure:p,moon:x,turbidity:un(3,12,o),rayleigh:un(2.2,.8,o),mie:un(.005,.02,o)}}var kc=s=>Math.round(Ln(s[0])*255)<<16|Math.round(Ln(s[1])*255)<<8|Math.round(Ln(s[2])*255),Yu=s=>`rgb(${Math.round(Ln(s[0])*255)}, ${Math.round(Ln(s[1])*255)}, ${Math.round(Ln(s[2])*255)})`;function hm(s){let e=Math.floor(s),t=Math.round((s-e)*60)%60;return`${String(e).padStart(2,"0")}:${String(t).padStart(2,"0")}`}var DM=["\u05D9\u05E0\u05D5\u05D0\u05E8","\u05E4\u05D1\u05E8\u05D5\u05D0\u05E8","\u05DE\u05E8\u05E5","\u05D0\u05E4\u05E8\u05D9\u05DC","\u05DE\u05D0\u05D9","\u05D9\u05D5\u05E0\u05D9","\u05D9\u05D5\u05DC\u05D9","\u05D0\u05D5\u05D2\u05D5\u05E1\u05D8","\u05E1\u05E4\u05D8\u05DE\u05D1\u05E8","\u05D0\u05D5\u05E7\u05D8\u05D5\u05D1\u05E8","\u05E0\u05D5\u05D1\u05DE\u05D1\u05E8","\u05D3\u05E6\u05DE\u05D1\u05E8"];function um(s){let e=new Date(Date.UTC(2026,0,1)+(s-1)*864e5);return`${e.getUTCDate()} \u05D1${DM[e.getUTCMonth()]}`}var Cs=(s,e,t)=>s+(e-s)*t,zc=class{constructor(e,t={}){this.renderer=new xc({canvas:e,antialias:!0,powerPreference:"high-performance",preserveDrawingBuffer:!0,alpha:!0,premultipliedAlpha:!0}),this.renderer.setClearColor(0,0),this.renderer.shadowMap.enabled=!0,this.renderer.shadowMap.type=Zn,this.renderer.shadowMap.autoUpdate=!1,this.renderer.shadowMap.needsUpdate=!0,this.renderer.toneMapping=Kn,this.renderer.outputColorSpace=Mt,this.renderer.localClippingEnabled=!0,this.dpr=Math.min(t.maxDpr??2,window.devicePixelRatio||1),this.renderer.setPixelRatio(this.dpr),this.scene=new rr,this.style=_i.light;let i=new Wn(400,48,24),n=new Float32Array(i.attributes.position.count*3);i.setAttribute("color",new Ct(n,3)),this.dome=new De(i,new St({vertexColors:!0,side:ti,toneMapped:!1,fog:!1,depthWrite:!1})),this.dome.frustumCulled=!1,this.dome.renderOrder=-10,this.dome.userData={kind:"sky"},this.scene.add(this.dome),this.domeScene=new rr,this.domeScene.add(new De(i,this.dome.material)),this.sun=new An(16777215,3),this.sun.castShadow=!0,this.sun.shadow.mapSize.set(2048,2048),this.sun.shadow.bias=-4e-4,this.sun.shadow.normalBias=.025,this.sun.shadow.radius=5,this.scene.add(this.sun),this.scene.add(this.sun.target),this.hemi=new wo(16777215,4478310,1.5),this.scene.add(this.hemi),this.ambient=new Ao(16777215,0),this.scene.add(this.ambient),this.moon=new An(12570879,0),this.scene.add(this.moon),this.rim=new An(8177919,0),this.scene.add(this.rim),this.fogOn=!1,this.pmrem=new Tr(this.renderer),this.pmrem.compileCubemapShader(),this.envTarget=null,this.quality=3,this.composer=null,this.time={hour:15.5,day:278,latitude:32.08,north:0,weather:"clear"},this.recipe=qu(40,"clear"),this.fitted=null,this.post={ao:!0,bloom:!0,lite:!1,msaa:!0},this.size={w:1,h:1},this.interior=!1,this.interiorFill=1,this.isWebGL2=this.renderer.capabilities.isWebGL2}rendererName(){let e=this.renderer.getContext(),t=e.getExtension("WEBGL_debug_renderer_info");return t?e.getParameter(t.UNMASKED_RENDERER_WEBGL):e.getParameter(e.RENDERER)}setStyle(e){this.style=e,this.applyTime()}setSize(e,t){this.size={w:e,h:t},this.renderer.setSize(e,t,!1),this.composer&&(this.composer.setSize(e,t),this.gtao&&this.gtao.setSize(e,t))}fitShadows(e,t){this.fitted={extent:e,top:t};let i=this.sun.shadow.camera,n=e.maxX-e.minX,r=e.maxZ-e.minZ,o=Math.hypot(n,r)/2+4;i.left=-o,i.right=o,i.top=o,i.bottom=-o,i.near=.5,i.far=o*4+20,i.updateProjectionMatrix(),this.centre=new D((e.minX+e.maxX)/2,t/2,(e.minZ+e.maxZ)/2),this.sun.target.position.copy(this.centre),this.moon.target=this.sun.target,this.applyTime()}setQuality(e,t){this.quality=e,this.renderer.shadowMap.enabled=e>=2,this.renderer.shadowMap.type=Zn,this.renderer.shadowMap.needsUpdate=!0,this.sun.castShadow=e>=2;let i=e>=3&&!this.post.lite;this.sun.shadow.radius=i?this.style.rig.shadowRadius||8:e>=3?3:1,this.sun.shadow.blurSamples=12,this.sun.shadow.mapSize.set(i?2048:1024,i?2048:1024),this.sun.shadow.map&&(this.sun.shadow.map.dispose(),this.sun.shadow.map=null),this.scene.environment=e>=3?this.envTarget&&this.envTarget.texture:null,this.scene.background=null,this.renderer.toneMapping=e>=2?Kn:Si,this.buildComposer(t),this.applyTime()}buildComposer(e){if(this.composer&&(this.composer.dispose&&this.composer.dispose(),this.composer=null,this.gtao=null,this.bloom=null,this.smaa=null),this.quality<3)return;let{w:t,h:i}=this.size,n=this.post.samples!=null?this.post.samples:2,r=this.post.msaa&&this.isWebGL2&&n>0&&this.post.aa!=="smaa",o=new dt(Math.round(t*this.dpr),Math.round(i*this.dpr),{type:wt,samples:r?n:0}),a=new Ic(this.renderer,o);a.setPixelRatio(this.dpr),a.setSize(t,i);let l=new Dc(this.scene,e);if(l.clearAlpha=0,a.addPass(l),this.post.ao&&!this.post.lite){let c=new Ir(this.scene,e,t,i);c.output=Ir.OUTPUT.Default,c.updateGtaoMaterial({radius:this.style.post.aoRadius,distanceExponent:1,thickness:1,distanceFallOff:1,scale:.9,samples:6}),c.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:4,rings:2,samples:6}),c.blendIntensity=this.style.post.aoIntensity,a.addPass(c),this.gtao=c}if(this.post.bloom){let c=new Dr(new ee(t,i),.2,this.style.post.bloomRadius,2);a.addPass(c),this.bloom=c}if(a.addPass(new Bc),!r&&this.post.aa!=="none"){let c=new Fc;a.addPass(c),this.smaa=c}this.composer=a,this.camera=e,this.applyPost()}setCamera(e){if(this.camera=e,this.composer){for(let t of this.composer.passes)"camera"in t&&(t.camera=e);this.gtao&&(this.gtao.camera=e)}}setTime(e){Object.assign(this.time,e),this.applyTime()}setFog(e){this.fogOn=e,this.applyFog()}applyFog(){let e=this.style.rig.fog;if(this.fogOn&&e&&this.quality>=2){let t=this.recipe?this.recipe.night:0,i=new Me(e.color).multiplyScalar(1-t*.6);this.scene.fog?(this.scene.fog.color.copy(i),this.scene.fog.density=e.density):this.scene.fog=new eo(i,e.density)}else this.scene.fog=null}backdropColors(){let e=this.recipe,t=this.style.rig,i=this.style.backdrop,n=l=>[parseInt(l.slice(1,3),16)/255,parseInt(l.slice(3,5),16)/255,parseInt(l.slice(5,7),16)/255],r=(l,c)=>Yu([(l[0]+c[0])/2,(l[1]+c[1])/2,(l[2]+c[2])/2]),o=n(e.night>.5?i.topNight:i.topDay),a=n(e.night>.5?i.horizonNight:i.horizonDay);return[r(o,e.skyTop.map(l=>l*t.skyScale)),r(a,e.skyHorizon.map(l=>l*t.skyScale)),Yu(e.hemiGround.map(l=>l*i.groundTint*.9+.08))]}applyFill(){let e=this.style.rig,t=this.recipe,i=this.quality>=3,n=this.interior?Cs(e.interiorFill[0],e.interiorFill[1],this.interiorFill)*.7:1;this.hemi.intensity=(this.quality>=2?t.hemiIntensity*(i?e.hemiScale:1)*(i?1:e.skyScale):1.2)*n,i&&(this.scene.environmentIntensity=Cs(e.envNight,e.envDay,t.day)*n)}applyPost(){let e=this.recipe,t=this.style.post;this.bloom&&(this.bloom.threshold=Cs(t.bloomThresholdDay,t.bloomThresholdNight,e.night),this.bloom.strength=Cs(t.bloomStrengthDay,t.bloomStrengthNight,e.night),this.bloom.radius=t.bloomRadius)}applyTime(){let e=this.time,t=this.style.rig,i=cm(e.hour,e.day,e.latitude,e.north),n=qu(i.elevation,e.weather);this.recipe=n,this.sunInfo=i;let r=new D(i.dir[0],Math.max(i.dir[1],-.2),i.dir[2]).normalize(),o=this.centre||new D,a=this.fitted?Math.hypot(this.fitted.extent.maxX-this.fitted.extent.minX,this.fitted.extent.maxZ-this.fitted.extent.minZ):20;this.sun.position.copy(o).addScaledVector(r,a*1.5);let l=this.quality>=3,c=this.interior?Cs(t.interiorFill[0],t.interiorFill[1],this.interiorFill)*.7:1;if(this.sun.intensity=this.quality>=2?n.sunIntensity*(l?.55:1)*t.sunScale:1.1,this.sun.color.setHex(kc(n.sunColor)),this.sun.visible=i.elevation>-3||this.quality<2,this.moon.intensity=n.moon*t.moonScale,this.moon.position.copy(o).add(new D(-a,a*.9,a*.4)),t.rim?(this.rim.color.setHex(t.rim.color),this.rim.intensity=t.rim.intensity*(this.interior?.6:1),this.rim.position.copy(o).addScaledVector(new D(-r.x,.5,-r.z).normalize(),a*1.2),this.rim.target.position.copy(o),this.rim.target.updateMatrixWorld()):this.rim.intensity=0,this.applyFog(),this.hemi.color.setHex(kc(n.hemiSky)),this.hemi.groundColor.setHex(kc(n.hemiGround)),this.hemi.intensity=(this.quality>=2?n.hemiIntensity*(l?t.hemiScale:1)*(l?1:t.skyScale):1.2)*c,this.ambient.intensity=this.quality>=2?0:.9,this.renderer.toneMappingExposure=n.exposure*Cs(t.exposureDay,t.exposureNight,n.night)*(l?1:1.1)*(this.interior?1.05:1),this.renderer.shadowMap.needsUpdate=!0,this.applyPost(),this.backdrop){let[h,f,d]=this.backdropColors();this.backdrop.style.background=`linear-gradient(180deg, ${h} 0%, ${f} 62%, ${d} 100%)`}this.paintDome(n,r),this.quality>=3&&(this.envTarget&&this.envTarget.dispose(),this.envTarget=this.pmrem.fromScene(this.domeScene,0,1,1e3),this.scene.environment=this.envTarget.texture,this.scene.environmentIntensity=Cs(t.envNight,t.envDay,n.day)*c),this.onTime&&this.onTime(i,n)}paintDome(e,t){let i=this.dome.geometry,n=i.attributes.position,r=i.attributes.color,o=new D,a=this.style.rig.skyScale,l=e.hemiGround.map(c=>(c*.9+.1)*this.style.backdrop.groundTint);for(let c=0;c<n.count;c++){o.fromBufferAttribute(n,c).normalize();let h=o.y,f;if(h<0)f=l;else{let p=Math.pow(h,.55);f=[(e.skyHorizon[0]+(e.skyTop[0]-e.skyHorizon[0])*p)*a,(e.skyHorizon[1]+(e.skyTop[1]-e.skyHorizon[1])*p)*a,(e.skyHorizon[2]+(e.skyTop[2]-e.skyHorizon[2])*p)*a]}let d=Math.max(0,o.dot(t)),u=t.y>-.05?Math.pow(d,400)*.9+Math.pow(d,12)*.18*e.day:0;r.setXYZ(c,Math.min(1,f[0]+u*e.sunColor[0]),Math.min(1,f[1]+u*e.sunColor[1]),Math.min(1,f[2]+u*e.sunColor[2]))}r.needsUpdate=!0,this.dome.visible=this.quality>=2}render(e){this.composer&&this.quality>=3?(this.camera!==e&&this.setCamera(e),this.composer.render()):this.renderer.render(this.scene,e)}};var Hc=class{constructor(e){this.scene=e,this.x=0,this.z=0,this.yaw=0,this.pitch=0,this.level=Object.keys(e.levels)[0],this.eye=1.65,this.onStairs=null,this.path=null,this.input={fwd:0,strafe:0,run:!1,turn:0},this.onLevelChange=null,this.edge=!1,this.lastMoveTime=0}placeAt(e,t,i,n){this.x=e,this.z=t,this.yaw=i*Math.PI/180,this.pitch=0,n&&n!==this.level&&(this.level=n,this.onLevelChange&&this.onLevelChange(n)),this.path=null,this.onStairs=null}ground(e,t,i){let n=this.scene.levels[i];for(let r of n.stairs){let o=e-r.a[0],a=t-r.a[1],l=o*r.dx+a*r.dz;if(Math.abs(-o*r.dz+a*r.dx)<=r.width/2&&l>=-.05&&l<=r.run+.05){let h=Math.max(0,Math.min(1,l/r.run));return{y:r.elevFrom+(r.elevTo-r.elevFrom)*h,stair:r,along:l,f:h}}}return{y:n.elevation,stair:null}}segmentsFor(e,t="all"){let i=this.scene.levels[e],n=t==="stairs"?[]:i.segs.slice();for(let r of i.stairs){let o=-r.dz,a=r.dx;for(let l of[-1,1]){let c=o*l*(r.width/2),h=a*l*(r.width/2);n.push({a:[r.a[0]+c-r.dx*0,r.a[1]+h],b:[r.b[0]+c,r.b[1]+h],w:0,kind:"stair-side",id:"stair"})}}return n}collide(e,t,i,n="all"){let r=this.segmentsFor(i,n);for(let o=0;o<3;o++){let a=!1;for(let l of r){let c=.28+(l.w||0)/2,h=l.b[0]-l.a[0],f=l.b[1]-l.a[1],d=h*h+f*f,u=d>0?Math.max(0,Math.min(1,((e-l.a[0])*h+(t-l.a[1])*f)/d)):0,p=l.a[0]+u*h,x=l.a[1]+u*f,m=e-p,g=t-x,S=Math.hypot(m,g);if(S<c){if(S<1e-6){m=-f,g=h;let T=Math.hypot(m,g)||1;m/=T,g/=T}else m/=S,g/=S;e=p+m*(c+.001),t=x+g*(c+.001),a=!0}}if(!a)break}return[e,t]}step(e){let t=this.input,i=!1;t.turn&&(this.yaw+=t.turn*e*2.2,i=!0);let n=t.fwd,r=t.strafe;if(this.path&&this.path.length){let[o,a]=this.path[0],l=o-this.x,c=a-this.z;if(Math.hypot(l,c)<.15)this.path.shift(),this.path.length||(this.path=null);else{let d=Math.atan2(-l,-c)-this.yaw;for(;d>Math.PI;)d-=2*Math.PI;for(;d<-Math.PI;)d+=2*Math.PI;this.yaw+=Math.sign(d)*Math.min(Math.abs(d),e*3.5),n=Math.abs(d)<.6?1:.2,r=0}}if(n||r){let o=t.run?2.8:1.4,a=Math.sin(this.yaw),l=Math.cos(this.yaw),c=-a,h=-l,f=l,d=-a,u=this.x+(c*n+f*r)*o*e,p=this.z+(h*n+d*r)*o*e,x=this.ground(this.x,this.z,this.level).stair&&this.ground(u,p,this.level).stair;[u,p]=this.collide(u,p,this.level,x?"stairs":"all");let m=this.scene.levels[this.level];if(m.extent){let _=m.extent,v=Math.max(_.minX+.3,Math.min(_.maxX-.3,u)),E=Math.max(_.minZ+.3,Math.min(_.maxZ-.3,p));this.edge=v!==u||E!==p,u=v,p=E}(Math.abs(u-this.x)>1e-5||Math.abs(p-this.z)>1e-5)&&(i=!0);let g=this.ground(this.x,this.z,this.level);this.x=u,this.z=p;let S=this.ground(this.x,this.z,this.level),T=S.stair||g.stair;if(T){let _=T,v=(this.x-_.a[0])*_.dx+(this.z-_.a[1])*_.dz;this.onStairs=S.stair,v>_.run-.02&&this.level===_.from?this.switchLevel(_.to):v<.02&&this.level===_.to&&this.switchLevel(_.from)}else this.onStairs=null}return i}switchLevel(e){!this.scene.levels[e]||e===this.level||(this.level=e,this.onLevelChange&&this.onLevelChange(e))}eyeY(){return this.ground(this.x,this.z,this.level).y+this.eye}applyTo(e){e.position.set(this.x,this.eyeY(),this.z),e.rotation.order="YXZ",e.rotation.set(this.pitch,this.yaw,0)}look(e,t){this.yaw-=e,this.pitch=Math.max(-1.2,Math.min(1.2,this.pitch-t))}pathTo(e,t){let i=this.scene.levels[this.level];if(!i.extent)return null;let n=i.extent,r=Math.ceil((n.maxX-n.minX)/.25),o=Math.ceil((n.maxZ-n.minZ)/.25),a=this.segmentsFor(this.level),l=new Uint8Array(r*o),c=.28*.85;for(let b=0;b<o;b++)for(let w=0;w<r;w++){let P=n.minX+(w+.5)*.25,U=n.minZ+(b+.5)*.25;for(let F of a){let O=c+(F.w||0)/2,z=F.b[0]-F.a[0],k=F.b[1]-F.a[1],G=z*z+k*k,Y=G>0?Math.max(0,Math.min(1,((P-F.a[0])*z+(U-F.a[1])*k)/G)):0;if(Math.hypot(P-(F.a[0]+Y*z),U-(F.a[1]+Y*k))<O){l[b*r+w]=1;break}}}let h=(b,w)=>[Math.max(0,Math.min(r-1,Math.floor((b-n.minX)/.25))),Math.max(0,Math.min(o-1,Math.floor((w-n.minZ)/.25)))],[f,d]=h(this.x,this.z),[u,p]=h(e,t);if(l[p*r+u]){let b=null;for(let w=-3;w<=3;w++)for(let P=-3;P<=3;P++){let U=u+P,F=p+w;if(U<0||F<0||U>=r||F>=o||l[F*r+U])continue;let O=P*P+w*w;(!b||O<b.d)&&(b={i:U,j:F,d:O})}if(!b)return null;u=b.i,p=b.j}let x=new Map,m=new Float32Array(r*o).fill(1/0),g=new Int32Array(r*o).fill(-1),S=(b,w)=>Math.hypot(b-u,w-p),T=d*r+f,_=p*r+u;m[T]=0,x.set(T,S(f,d));let v=new Uint8Array(r*o),E=0;for(;x.size&&E++<5e4;){let b=-1,w=1/0;for(let[F,O]of x)O<w&&(w=O,b=F);if(x.delete(b),b===_)break;v[b]=1;let P=b%r,U=Math.floor(b/r);for(let[F,O]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){let z=P+F,k=U+O;if(z<0||k<0||z>=r||k>=o)continue;let G=k*r+z;if(l[G]||v[G]||F&&O&&(l[U*r+z]||l[k*r+P]))continue;let Y=m[b]+Math.hypot(F,O);Y<m[G]&&(m[G]=Y,g[G]=b,x.set(G,Y+S(z,k)))}}if(g[_]<0&&_!==T)return null;let A=[],y=_;for(;y>=0&&y!==T;)A.push([n.minX+(y%r+.5)*.25,n.minZ+(Math.floor(y/r)+.5)*.25]),y=g[y];A.reverse(),A.push([e,t]);let R=[],I=[this.x,this.z],L=0;for(;L<A.length;){let b=L;for(let w=A.length-1;w>L;w--)if(this.lineFree(I,A[w],a)){b=w;break}R.push(A[b]),I=A[b],L=b+1}return this.path=R,R}lineFree(e,t,i){let n=[t[0]-e[0],t[1]-e[1]],r=Math.hypot(n[0],n[1]);if(r<1e-6)return!0;let o=Math.max(2,Math.ceil(r/.1));for(let a=0;a<=o;a++){let l=e[0]+n[0]*a/o,c=e[1]+n[1]*a/o;for(let h of i){let f=.22400000000000003+(h.w||0)/2,d=h.b[0]-h.a[0],u=h.b[1]-h.a[1],p=d*d+u*u,x=p>0?Math.max(0,Math.min(1,((l-h.a[0])*d+(c-h.a[1])*u)/p)):0;if(Math.hypot(l-(h.a[0]+x*d),c-(h.a[1]+x*u))<f)return!1}}return!0}};function dm(s,e,t,i={}){let n=s.getContext("2d"),r=e.levels[t.level],o=s.width;if(n.clearRect(0,0,o,o),!r||!r.extent)return;let a=r.extent,l=a.maxX-a.minX,c=a.maxZ-a.minZ,h=(o-12)/Math.max(l,c),f=m=>6+(m-a.minX)*h+(o-12-l*h)/2,d=m=>6+(m-a.minZ)*h+(o-12-c*h)/2;n.fillStyle=i.bg||"rgba(255,255,255,0.92)",n.beginPath(),n.roundRect(0,0,o,o,10),n.fill();for(let m of r.zones){n.beginPath(),m.polyM.forEach(([S,T],_)=>_?n.lineTo(f(S),d(T)):n.moveTo(f(S),d(T))),n.closePath();let g=m.x_proto&&m.x_proto.light&&e.plan.entities[m.x_proto.light]==="on";n.fillStyle=g?"rgba(255,200,87,0.35)":"rgba(39,103,237,0.06)",n.fill()}n.lineWidth=2;for(let m of r.segs)n.strokeStyle=m.kind==="window"?"#7fb2ff":m.kind==="door"||m.kind==="door-locked"?"#ef4444":m.kind==="object"?"rgba(90,100,120,0.35)":m.kind==="railing"||m.kind==="low"?"#9aa3b5":"#56617a",n.lineWidth=m.kind==="object"?1:m.kind==="exterior"?3:2,n.beginPath(),n.moveTo(f(m.a[0]),d(m.a[1])),n.lineTo(f(m.b[0]),d(m.b[1])),n.stroke();for(let m of r.stairs){n.strokeStyle="#6b7f99",n.lineWidth=1;let g=8;for(let S=0;S<=g;S++){let T=S/g,_=m.a[0]+m.dx*m.run*T,v=m.a[1]+m.dz*m.run*T;n.beginPath(),n.moveTo(f(_-m.dz*m.width/2),d(v+m.dx*m.width/2)),n.lineTo(f(_+m.dz*m.width/2),d(v-m.dx*m.width/2)),n.stroke()}}if(t.path){n.strokeStyle="#22c55e",n.lineWidth=2,n.setLineDash([3,3]),n.beginPath(),n.moveTo(f(t.x),d(t.z));for(let[m,g]of t.path)n.lineTo(f(m),d(g));n.stroke(),n.setLineDash([])}let u=f(t.x),p=d(t.z),x=Math.atan2(-Math.sin(t.yaw),-Math.cos(t.yaw));return n.fillStyle="rgba(39,103,237,0.25)",n.beginPath(),n.moveTo(u,p),n.arc(u,p,22,x-.5,x+.5),n.closePath(),n.fill(),n.fillStyle="#2767ed",n.beginPath(),n.arc(u,p,4,0,Math.PI*2),n.fill(),n.strokeStyle="#fff",n.lineWidth=1.5,n.stroke(),{X:f,Z:d,k:h,ex:a,invert:(m,g)=>[a.minX+(m-6-(o-12-l*h)/2)/h,a.minZ+(g-6-(o-12-c*h)/2)/h]}}var Vc=class{constructor(e,t){this.env=e,this.scene=t,this.sets={}}snapshot(e,t,i){let n=this.env,r=n.size;n.setSize(t,i),e.isPerspectiveCamera&&(e.aspect=t/i),e.updateProjectionMatrix(),n.render(e);let o=this.compose(n.renderer.domElement,t,i);return n.setSize(r.w,r.h),o}compose(e,t,i){let n=document.createElement("canvas");n.width=t,n.height=i;let r=n.getContext("2d"),o=r.createLinearGradient(0,0,0,i),[a,l,c]=this.env.backdropColors();return o.addColorStop(0,a),o.addColorStop(.62,l),o.addColorStop(1,c),r.fillStyle=o,r.fillRect(0,0,t,i),r.drawImage(e,0,0,t,i),n.toDataURL("image/jpeg",.9)}thumbnail(e,t,i){let n=this.env,r=n.renderer;(!this._rt||this._rt.width!==t||this._rt.height!==i)&&(this._rt&&this._rt.dispose(),this._rt=new dt(t,i,{samples:0}));let o=r.getRenderTarget();r.setRenderTarget(this._rt),r.render(n.scene,e);let a=new Uint8Array(t*i*4);r.readRenderTargetPixels(this._rt,0,0,t,i,a),r.setRenderTarget(o);let l=document.createElement("canvas");l.width=t,l.height=i;let c=l.getContext("2d"),h=c.createImageData(t,i);for(let f=0;f<i;f++)h.data.set(a.subarray((i-1-f)*t*4,(i-f)*t*4),f*t*4);return c.putImageData(h,0,0),this.compose(l,t,i)}project(e,t,i,n){let r=t.clone().project(e);return[(r.x+1)/2*i,(1-r.y)/2*n]}async bake(e,t,i,n,r,o){let a=this.scene.levels[e],l={w:i,h:n,pics:{},masks:[],doors:[],cams:[]};for(let c of["day_off","day_on","night_off","night_on"])r(c),await new Promise(h=>requestAnimationFrame(h)),l.pics[c]=this.snapshot(t,i,n);t.aspect=i/n,t.updateProjectionMatrix(),t.updateMatrixWorld();for(let c of a.zones){let h=c.polyM.map(([d,u])=>this.project(t,new D(d,a.elevation+.02,u),i,n)),f=c.polyM.map(([d,u])=>this.project(t,new D(d,a.elevation+a.ceiling*.55,u),i,n));l.masks.push({zone:c.id,name:c.name,light:c.x_proto&&c.x_proto.light,presence:c.x_proto&&c.x_proto.presence,temp:c.x_proto&&c.x_proto.temp,floor:h,top:f,centre:this.project(t,new D(...NM(c.polyM,a.elevation+1.2)),i,n)})}for(let c of o||[]){let h=c.points.map(f=>this.project(t,f,i,n));l.doors.push({entity:c.entity,points:h})}for(let c of this.scene.cameras.filter(h=>h.level===e))l.cams.push({id:c.id,label:c.label,p:this.project(t,new D(c.pos[0],a.elevation+c.mount,c.pos[1]),i,n)});return this.sets[e]=l,l}};function NM(s,e){let t=0,i=0,n=0;for(let r=0;r<s.length;r++){let[o,a]=s[r],[l,c]=s[(r+1)%s.length],h=o*c-l*a;t+=h,i+=(o+l)*h,n+=(a+c)*h}return Math.abs(t)<1e-9?[s[0][0],e,s[0][1]]:[i/(3*t),e,n/(3*t)]}var es="http://www.w3.org/2000/svg";function pm(s,e,t){if(s.innerHTML="",!e){s.innerHTML='<div class="stills-empty">\u05D0\u05D9\u05DF \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DE\u05D5\u05DB\u05E0\u05D5\u05EA \u05DC\u05E7\u05D5\u05DE\u05D4 \u05D6\u05D5 \u2014 \u05DC\u05D7\u05E5 "\u05D4\u05DB\u05DF \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA" \u05D1\u05DC\u05E9\u05D5\u05E0\u05D9\u05EA \u05D4\u05D0\u05D9\u05DB\u05D5\u05EA</div>';return}let i=t.night,n=e.pics[i?"night_off":"day_off"],r=e.pics[i?"night_on":"day_on"],o=document.createElementNS(es,"svg");o.setAttribute("viewBox",`0 0 ${e.w} ${e.h}`),o.setAttribute("preserveAspectRatio","xMidYMid meet"),o.classList.add("stills-svg");let a=document.createElementNS(es,"defs");o.appendChild(a);let l=d=>{let u=document.createElementNS(es,"image");return u.setAttribute("href",d),u.setAttribute("width",e.w),u.setAttribute("height",e.h),u.setAttribute("preserveAspectRatio","none"),u};o.appendChild(l(n));let c=d=>d.map(u=>`${u[0].toFixed(1)},${u[1].toFixed(1)}`).join(" "),h=d=>fm([...d.floor,...d.top]);for(let d of e.masks){if(!(d.light&&t.entities[d.light]==="on"))continue;let p=document.createElementNS(es,"clipPath");p.setAttribute("id",`mask-${d.zone}`);let x=document.createElementNS(es,"polygon");x.setAttribute("points",c(h(d))),p.appendChild(x),a.appendChild(p);let m=l(r);m.setAttribute("clip-path",`url(#mask-${d.zone})`),m.classList.add("stills-lit"),o.appendChild(m)}for(let d of e.masks)if(d.presence&&t.entities[d.presence]==="on"){let p=document.createElementNS(es,"polygon");p.setAttribute("points",c(d.floor)),p.setAttribute("class","stills-presence"),o.appendChild(p)}for(let d of e.doors){if(t.entities[d.entity]!=="on"&&t.entities[d.entity]!=="open")continue;let u=document.createElementNS(es,"polygon");u.setAttribute("points",c(fm(d.points))),u.setAttribute("class","stills-door"),o.appendChild(u)}for(let d of e.cams){let u=document.createElementNS(es,"circle");u.setAttribute("cx",d.p[0]),u.setAttribute("cy",d.p[1]),u.setAttribute("r",6),u.setAttribute("class","stills-cam"),o.appendChild(u)}s.appendChild(o);let f=document.createElement("div");f.className="stills-chips";for(let d of e.masks){if(typeof d.temp!="number")continue;let u=document.createElement("span");u.className="chipT",u.textContent=`${d.temp.toFixed(1)}\xB0`,u.style.left=`${d.centre[0]/e.w*100}%`,u.style.top=`${d.centre[1]/e.h*100}%`,f.appendChild(u)}s.appendChild(f),requestAnimationFrame(()=>{let d=s.getBoundingClientRect(),u=Math.min(d.width/e.w,d.height/e.h),p=e.w*u,x=e.h*u;f.style.width=`${p}px`,f.style.height=`${x}px`,f.style.left=`${(d.width-p)/2}px`,f.style.top=`${(d.height-x)/2}px`})}function fm(s){let e=s.slice().sort((r,o)=>r[0]-o[0]||r[1]-o[1]);if(e.length<3)return e;let t=(r,o,a)=>(o[0]-r[0])*(a[1]-r[1])-(o[1]-r[1])*(a[0]-r[0]),i=[];for(let r of e){for(;i.length>=2&&t(i[i.length-2],i[i.length-1],r)<=0;)i.pop();i.push(r)}let n=[];for(let r=e.length-1;r>=0;r--){let o=e[r];for(;n.length>=2&&t(n[n.length-2],n[n.length-1],o)<=0;)n.pop();n.push(o)}return n.pop(),i.pop(),i.concat(n)}var mm=s=>s/.012,Ni=(s,e)=>[+(mm(s)/1e3).toFixed(6),+(mm(e)/900).toFixed(6)];function UM(s,e){let t={t:0,d:1/0},i=0,n=0;for(let r=0;r<s.length-1;r++)n+=Math.hypot(s[r+1][0]-s[r][0],s[r+1][1]-s[r][1]);for(let r=0;r<s.length-1;r++){let[o,a]=s[r],l=s[r+1][0]-o,c=s[r+1][1]-a,h=l*l+c*c,f=h>0?Math.max(0,Math.min(1,((e[0]-o)*l+(e[1]-a)*c)/h)):0,d=Math.hypot(e[0]-(o+f*l),e[1]-(a+f*c));d<t.d&&(t={t:(i+f*Math.sqrt(h))/n,d}),i+=Math.sqrt(h)}return+t.t.toFixed(5)}var gm=[{id:"g-out",level:"L0",kind:"exterior",t:.3,pts:[[.5,.5],[11.5,.5],[11.5,10.3],[.5,10.3],[.5,.5]]},{id:"g-w1",level:"L0",kind:"interior",t:.12,pts:[[3.5,.5],[3.5,10.3]]},{id:"g-w2",level:"L0",kind:"interior",t:.12,pts:[[.5,3.5],[3.5,3.5]]},{id:"g-w3",level:"L0",kind:"railing",t:.05,h:1,pts:[[2,3.9],[2,7.5]]},{id:"g-w5",level:"L0",kind:"interior",t:.12,pts:[[3.5,6],[11.5,6]]},{id:"g-w6",level:"L0",kind:"interior",t:.12,pts:[[7.5,6],[7.5,10.3]]},{id:"g-w7",level:"L0",kind:"interior",t:.12,pts:[[.5,7.5],[3.5,7.5]]},{id:"g-w8",level:"L0",kind:"interior",t:.1,pts:[[2,7.5],[2,10.3]]},{id:"u-out",level:"L1",kind:"exterior",t:.3,pts:[[.5,.5],[11.5,.5],[11.5,7.5],[.5,7.5],[.5,.5]]},{id:"u-w1",level:"L1",kind:"interior",t:.12,pts:[[3.5,.5],[3.5,7.5]]},{id:"u-w2",level:"L1",kind:"interior",t:.12,pts:[[3.5,4],[11.5,4]]},{id:"u-w3",level:"L1",kind:"interior",t:.12,pts:[[8,.5],[8,4]]},{id:"u-w4",level:"L1",kind:"interior",t:.12,pts:[[3.5,5.2],[11.5,5.2]]},{id:"u-w5",level:"L1",kind:"interior",t:.12,pts:[[6.5,5.2],[6.5,7.5]]},{id:"u-rail",level:"L1",kind:"railing",t:.05,h:1,pts:[[2,3.9],[2,7.2],[.5,7.2]]}],OM=[["front","g-out",[.5,2.2],"door",1,2.1,0,"right","end","binary_sensor.front_door"],["win-hall","g-out",[.5,1.2],"window",.8,1.2,.9],["win-liv-n1","g-out",[5.5,.5],"window",1.4,1.4,.9],["win-liv-n2","g-out",[7.5,.5],"window",1.4,1.4,.9],["win-liv-n3","g-out",[9.5,.5],"window",1.4,1.4,.9],["win-liv-e","g-out",[11.5,3.2],"window",2.6,2.3,.1,"none","start",null,"cover.living_terrace"],["win-kit-e","g-out",[11.5,8.2],"window",1.2,1.2,1],["win-kit-s","g-out",[9.5,10.3],"window",1.4,1.2,1],["win-off-s","g-out",[5.5,10.3],"window",1.6,1.4,.9,"none","start",null,"cover.office"],["win-wc-w","g-out",[.5,9],"window",.6,.6,1.5],["d-hall-liv","g-w1",[3.5,2],"door",1.6,2.1,0,"double","start","binary_sensor.hall_living_door"],["d-corr-liv","g-w1",[3.5,4.8],"door",.9,2.1,0,"left","start",null],["d-corr-off","g-w1",[3.5,6.9],"door",.9,2.1,0,"right","end","binary_sensor.office_door"],["p-hall-corr","g-w2",[2.7,3.5],"passage",1.4,2.1,0],["d-liv-off","g-w5",[5.5,6],"door",.9,2.1,0,"right","start",null],["d-liv-kit","g-w5",[9.5,6],"door",1.8,2.1,0,"sliding","start","binary_sensor.kitchen_door"],["d-off-kit","g-w6",[7.5,8.2],"door",.8,2.1,0,"left","end",null],["d-wc","g-w7",[1.25,7.5],"door",.8,2.1,0,"right","end","binary_sensor.wc_door"],["d-util","g-w7",[2.75,7.5],"door",.8,2.1,0,"left","start",null],["uw-n1","u-out",[5.7,.5],"window",1.4,1.4,.9,"none","start",null,"cover.bedroom1"],["uw-n2","u-out",[9.7,.5],"window",1.4,1.4,.9,"none","start",null,"cover.bedroom2"],["uw-e1","u-out",[11.5,2.2],"window",1.2,1.4,.9],["uw-e2","u-out",[11.5,6.3],"window",1.2,1.4,.9],["uw-s1","u-out",[5,7.5],"window",.8,.8,1.5],["uw-s2","u-out",[9,7.5],"window",1.6,1.4,.9,"none","start",null,"cover.bedroom3"],["uw-w1","u-out",[.5,1.8],"window",1.2,1.4,.9],["up-hall","u-w1",[3.5,4.6],"passage",1.2,2.1,0],["ud-bed1","u-w2",[5.5,4],"door",.9,2.1,0,"left","start","binary_sensor.bedroom1_door"],["ud-bed2","u-w2",[9.5,4],"door",.9,2.1,0,"right","end",null],["ud-bath","u-w4",[4.6,5.2],"door",.8,2.1,0,"right","start","binary_sensor.bath_door"],["ud-bed3","u-w4",[8.8,5.2],"door",.9,2.1,0,"left","end",null]],xm=[{id:"r-hall",level:"L0",name:"\u05DB\u05E0\u05D9\u05E1\u05D4",poly:[[.5,.5],[3.5,.5],[3.5,3.5],[.5,3.5]],floor:"tiles_grey",light:"light.hall",temp:23.4},{id:"r-stair",level:"L0",name:"\u05D7\u05D3\u05E8 \u05DE\u05D3\u05E8\u05D2\u05D5\u05EA",poly:[[.5,3.5],[2,3.5],[2,7.5],[.5,7.5]],floor:"tiles_grey",light:"light.stairs",temp:23},{id:"r-corr",level:"L0",name:"\u05DE\u05E1\u05D3\u05E8\u05D5\u05DF",poly:[[2,3.5],[3.5,3.5],[3.5,7.5],[2,7.5]],floor:"tiles_grey",light:"light.corridor",temp:23.1},{id:"r-living",level:"L0",name:"\u05E1\u05DC\u05D5\u05DF",poly:[[3.5,.5],[11.5,.5],[11.5,6],[3.5,6]],floor:"oak",light:"light.living",temp:24.2,presence:"binary_sensor.motion_living"},{id:"r-kitchen",level:"L0",name:"\u05DE\u05D8\u05D1\u05D7",poly:[[7.5,6],[11.5,6],[11.5,10.3],[7.5,10.3]],floor:"tiles_white",light:"light.kitchen",temp:25.1},{id:"r-office",level:"L0",name:"\u05D7\u05D3\u05E8 \u05E2\u05D1\u05D5\u05D3\u05D4",poly:[[3.5,6],[7.5,6],[7.5,10.3],[3.5,10.3]],floor:"oak",light:"light.office",temp:23.8,presence:"binary_sensor.motion_office"},{id:"r-wc",level:"L0",name:"\u05E9\u05D9\u05E8\u05D5\u05EA\u05D9\u05DD",poly:[[.5,7.5],[2,7.5],[2,10.3],[.5,10.3]],floor:"tiles_white",light:"light.wc",temp:22.5},{id:"r-util",level:"L0",name:"\u05D7\u05D3\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA",poly:[[2,7.5],[3.5,7.5],[3.5,10.3],[2,10.3]],floor:"concrete",light:"light.utility",temp:22},{id:"r-uhall",level:"L1",name:"\u05D2\u05DC\u05E8\u05D9\u05D4",poly:[[.5,.5],[3.5,.5],[3.5,7.5],[2,7.5],[2,3.9],[.5,3.9]],floor:"oak",light:"light.gallery",temp:23.6},{id:"r-ucorr",level:"L1",name:"\u05DE\u05E1\u05D3\u05E8\u05D5\u05DF \u05E2\u05DC\u05D9\u05D5\u05DF",poly:[[3.5,4],[11.5,4],[11.5,5.2],[3.5,5.2]],floor:"oak",light:"light.upper_corridor",temp:23.5,presence:"binary_sensor.motion_upper"},{id:"r-bed1",level:"L1",name:"\u05D7\u05D3\u05E8 \u05E9\u05D9\u05E0\u05D4 \u05D4\u05D5\u05E8\u05D9\u05DD",poly:[[3.5,.5],[8,.5],[8,4],[3.5,4]],floor:"carpet",light:"light.bedroom1",temp:22.8},{id:"r-bed2",level:"L1",name:"\u05D7\u05D3\u05E8 \u05D9\u05DC\u05D3\u05D9\u05DD",poly:[[8,.5],[11.5,.5],[11.5,4],[8,4]],floor:"carpet",light:"light.bedroom2",temp:23.2},{id:"r-bath",level:"L1",name:"\u05D0\u05DE\u05D1\u05D8\u05D9\u05D4",poly:[[3.5,5.2],[6.5,5.2],[6.5,7.5],[3.5,7.5]],floor:"tiles_white",light:"light.bath",temp:24.5},{id:"r-bed3",level:"L1",name:"\u05D7\u05D3\u05E8 \u05D0\u05D5\u05E8\u05D7\u05D9\u05DD",poly:[[6.5,5.2],[11.5,5.2],[11.5,7.5],[6.5,7.5]],floor:"carpet",light:"light.bedroom3",temp:22.9}],FM=[["sofa","sofa.3seat","L0",[6.3,3.9],180,[2.3,.95,.85],0,"\u05E1\u05E4\u05D4"],["coffee","table.coffee","L0",[6.3,2.6],0,[1.1,.6,.42],0,null],["tv","cabinet.tv","L0",[6.3,.95],0,[1.8,.45,.55],0,"\u05DE\u05D6\u05E0\u05D5\u05DF \u05D8\u05DC\u05D5\u05D5\u05D9\u05D6\u05D9\u05D4"],["tvscreen","screen.tv","L0",[6.3,.78],0,[1.4,.06,.8],.9,null,"media_player.living_tv"],["dining","table.dining","L0",[9.6,3.2],0,[1.6,.9,.75],0,"\u05E9\u05D5\u05DC\u05D7\u05DF \u05D0\u05D5\u05DB\u05DC"],["dc1","chair.basic","L0",[9.1,2.5],0,[.45,.45,.9],0,null],["dc2","chair.basic","L0",[10.1,2.5],0,[.45,.45,.9],0,null],["dc3","chair.basic","L0",[9.1,3.9],180,[.45,.45,.9],0,null],["dc4","chair.basic","L0",[10.1,3.9],180,[.45,.45,.9],0,null],["plant1","plant.pot","L0",[4,5.5],0,[.5,.5,1.4],0,null],["rug","mat.rug","L0",[6.3,3.2],0,[3,2.2,.02],0,null],["lamp-liv-a","light.ceiling","L0",[6.3,2.6],0,[.5,.5,.12],2.68,null,"light.living"],["lamp-liv-b","light.ceiling","L0",[9.6,3.2],0,[.5,.5,.12],2.68,null,"light.living"],["lamp-floor","light.floor","L0",[4.1,1],0,[.35,.35,1.5],0,null,"light.living_floor"],["console","cabinet.low","L0",[2,.85],0,[1.2,.4,.8],0,"\u05E9\u05D9\u05D3\u05D4"],["lamp-hall","light.ceiling","L0",[2,2],0,[.4,.4,.1],2.7,null,"light.hall"],["lamp-corr","light.ceiling","L0",[2.75,5.5],0,[.3,.3,.1],2.7,null,"light.corridor"],["lamp-stair","light.wall","L0",[.62,5.5],90,[.18,.1,.25],2,null,"light.stairs"],["counter-a","kitchen.counter","L0",[11.2,8],0,[.6,3.6,.9],0,"\u05DE\u05E9\u05D8\u05D7 \u05E2\u05D1\u05D5\u05D3\u05D4"],["counter-b","kitchen.counter","L0",[9.4,9.95],0,[3,.6,.9],0,null],["fridge","kitchen.fridge","L0",[7.95,9.9],0,[.75,.7,1.9],0,"\u05DE\u05E7\u05E8\u05E8"],["island","kitchen.island","L0",[9.3,7.6],0,[1.6,.9,.92],0,"\u05D0\u05D9"],["lamp-kit","light.pendant","L0",[9.3,7.6],0,[.3,.3,.35],2,null,"light.kitchen"],["desk","table.desk","L0",[5.5,9.4],0,[1.6,.8,.75],0,"\u05E9\u05D5\u05DC\u05D7\u05DF \u05E2\u05D1\u05D5\u05D3\u05D4"],["dchair","chair.office","L0",[5.5,8.6],180,[.6,.6,1.1],0,null],["books","cabinet.bookcase","L0",[3.75,8],90,[1.8,.35,2.1],0,"\u05E1\u05E4\u05E8\u05D9\u05D9\u05D4"],["lamp-off","light.ceiling","L0",[5.5,8],0,[.4,.4,.1],2.7,null,"light.office"],["toilet","sanitary.wc","L0",[1.25,9.9],0,[.4,.65,.45],0,null],["basin","sanitary.basin","L0",[.75,8.2],0,[.45,.4,.85],0,null],["washer","appliance.washer","L0",[3.1,9.9],0,[.6,.6,.85],0,"\u05DE\u05DB\u05D5\u05E0\u05EA \u05DB\u05D1\u05D9\u05E1\u05D4"],["boiler","appliance.boiler","L0",[2.4,9.9],0,[.5,.5,1.2],0,null],["lamp-wc","light.ceiling","L0",[1.25,8.9],0,[.25,.25,.1],2.7,null,"light.wc"],["lamp-util","light.ceiling","L0",[2.75,8.9],0,[.25,.25,.1],2.7,null,"light.utility"],["ext1","extinguisher.co2","L0",[3.3,7.3],0,[.18,.18,.55],.9,"\u05DE\u05D8\u05E3"],["bed1","bed.double","L1",[5.75,1.6],0,[1.8,2.1,.55],0,"\u05DE\u05D9\u05D8\u05D4 \u05D6\u05D5\u05D2\u05D9\u05EA"],["ward1","cabinet.wardrobe","L1",[3.9,2.8],90,[2,.6,2.3],0,"\u05D0\u05E8\u05D5\u05DF"],["lamp-bed1","light.ceiling","L1",[5.75,2.3],0,[.4,.4,.1],2.5,null,"light.bedroom1"],["bed2","bed.single","L1",[10.7,1.6],0,[1,2,.5],0,"\u05DE\u05D9\u05D8\u05D4"],["desk2","table.desk","L1",[8.9,1],0,[1.2,.6,.75],0,null],["lamp-bed2","light.ceiling","L1",[9.75,2.3],0,[.4,.4,.1],2.5,null,"light.bedroom2"],["bed3","bed.double","L1",[9,6.4],180,[1.6,2,.55],0,null],["lamp-bed3","light.ceiling","L1",[9,6.3],0,[.4,.4,.1],2.5,null,"light.bedroom3"],["tub","sanitary.tub","L1",[4.4,7],0,[1.7,.75,.55],0,"\u05D0\u05DE\u05D1\u05D8\u05D9\u05D4"],["basin2","sanitary.basin","L1",[6.1,5.6],0,[.5,.4,.85],0,null],["toilet2","sanitary.wc","L1",[6.1,6.9],90,[.4,.65,.45],0,null],["lamp-bath","light.ceiling","L1",[5,6.3],0,[.3,.3,.1],2.5,null,"light.bath"],["lamp-uhall","light.ceiling","L1",[2,2.2],0,[.45,.45,.1],2.5,null,"light.gallery"],["lamp-ucorr","light.ceiling","L1",[7.5,4.6],0,[.3,.3,.1],2.5,null,"light.upper_corridor"],["plant2","plant.pot","L1",[3,1],0,[.45,.45,1.1],0,null],["bench","cabinet.low","L1",[1.2,1],0,[1.2,.4,.5],0,null]],BM=[{id:"cam-hall",level:"L0",p:[3.3,.7],rot:215,fov:95,r:7,mount:2.4,tilt:22,label:"\u05DE\u05E6\u05DC\u05DE\u05D4 \xB7 \u05DB\u05E0\u05D9\u05E1\u05D4",online:!0},{id:"cam-living",level:"L0",p:[11.3,5.8],rot:318,fov:100,r:10,mount:2.5,tilt:20,label:"\u05DE\u05E6\u05DC\u05DE\u05D4 \xB7 \u05E1\u05DC\u05D5\u05DF",online:!0},{id:"cam-upper",level:"L1",p:[11.3,4.3],rot:265,fov:90,r:9,mount:2.3,tilt:18,label:"\u05DE\u05E6\u05DC\u05DE\u05D4 \xB7 \u05DE\u05E1\u05D3\u05E8\u05D5\u05DF \u05E2\u05DC\u05D9\u05D5\u05DF",online:!1}],kM=[{id:"wp-front",name:"\u05D3\u05DC\u05EA \u05DB\u05E0\u05D9\u05E1\u05D4",level:"L0",p:[1.1,2.2],heading:250,is_default:!0},{id:"wp-living",name:"\u05DE\u05E8\u05DB\u05D6 \u05D4\u05E1\u05DC\u05D5\u05DF",level:"L0",p:[7,3.3],heading:0},{id:"wp-kitchen",name:"\u05DE\u05D8\u05D1\u05D7",level:"L0",p:[9,8.8],heading:300},{id:"wp-gallery",name:"\u05D2\u05DC\u05E8\u05D9\u05D4",level:"L1",p:[2.7,2],heading:180}];function zM(){let s=gm.map(r=>({id:r.id,level_id:r.level,polyline:r.pts.map(o=>Ni(o[0],o[1])),thickness_m:r.t,height_m:r.h??null,base_z_m:0,kind:r.kind,confidence:1,source:"manual",locked:!1,external_ids:{}})),e=new Map(gm.map(r=>[r.id,r.pts])),t=OM.map(([r,o,a,l,c,h,f,d,u,p,x])=>({id:r,wall_id:o,t:UM(e.get(o),a),kind:l,width_m:c,height_m:h,sill_m:f,swing:d||"none",hinge:u||"start",anchor_ref:p?{resource_type:"ha_entity",resource_id:p}:null,confidence:1,source:"manual",external_ids:{},...x?{x_proto:{cover_entity:x,glazing:r==="uw-s1"||r==="win-wc-w"?"frosted":"clear"}}:{}})),i=FM.map(([r,o,a,l,c,h,f,d,u])=>({id:r,item_id:o,level_id:a,position:Ni(l[0],l[1]),rotation_deg:c,size:{w_m:h[0],d_m:h[1],h_m:h[2]},z_m:f,params:{},label:d??null,anchor_ref:u?{resource_type:"ha_entity",resource_id:u}:null,group_id:null,confidence:1,source:"manual",locked:!1,external_ids:{}})),n=xm.map(r=>({id:r.id,level_id:r.level,ceiling_height_m:null,tags:[],x_proto:{floor_material:r.floor}}));return{schema_version:"2.0",plan_version_id:"proto-house-v1",floor_id:"proto-house",source:{sha256:"0".repeat(64),file_name:"proto-house.pdf",mime:"application/pdf",page:1},dimensions:{width_px:1e3,height_px:900,scale_m_per_px:.012,calibration:{status:"measured",method:"two_point",pairs:[{a:Ni(.5,.5),b:Ni(11.5,.5),metres:11}],residual_pct:0,reason:null}},transform:{rotation:0,crop:null},levels:[{id:"L0",name:"\u05E7\u05E8\u05E7\u05E2",elevation_m:0,ceiling_height_m:2.8,is_default:!0,external_ids:{}},{id:"L1",name:"\u05E7\u05D5\u05DE\u05D4 1",elevation_m:2.9,ceiling_height_m:2.6,is_default:!1,external_ids:{}}],walls:s,openings:t,rooms:n,objects:i,circuits:[{id:"k-living",name:"\u05E1\u05DC\u05D5\u05DF",switch_entity_id:"light.living",member_ids:["lamp-liv-a","lamp-liv-b"],color_token:"circuit-1",power_w:48}],connectors:[{id:"stairs-main",kind:"stairs",level_from:"L0",level_to:"L1",floor_ids:[],polyline:[Ni(1.25,7.2),Ni(1.25,3.9)],width_m:1,label:null,object_id:null,source:"manual",external_ids:{},shape:"straight",turn:"none",flights:[{steps:16}],landing_depth_m:null}],labels:[],groups:[],uncertain_regions:[],uncertainty:{overall:0,notes:[]},meta:{generator:"studio6-prototype",tokens_version:"map-1",detector_version:null},floor_height_m:2.9,x_proto:{north_deg:12,latitude:32.08,longitude:34.78,walk_positions:kM.map(r=>({id:r.id,name:r.name,level_id:r.level,x:Ni(r.p[0],r.p[1])[0],y:Ni(r.p[0],r.p[1])[1],heading_deg:r.heading,is_default:!!r.is_default}))}}}var _m={id:"demo-house",title:"\u05D1\u05D9\u05EA \u05D3\u05D5\u05BE\u05E7\u05D5\u05DE\u05EA\u05D9 (\u05D3\u05DE\u05D5)",doc:zM(),zones:xm.map(s=>({id:s.id,name:s.name,level_id:s.level,polygon:s.poly.map(e=>({x:Ni(e[0],e[1])[0],y:Ni(e[0],e[1])[1]})),x_proto:{floor_material:s.floor,light:s.light,temp:s.temp,presence:s.presence||null}})),anchors:BM.map(s=>({id:s.id,resource_type:"camera",resource_id:s.id,x:Ni(s.p[0],s.p[1])[0],y:Ni(s.p[0],s.p[1])[1],rotation:s.rot,fov:s.fov,radius:s.r/12,polygon:null,level_id:s.level,layer_id:"cameras",label:s.label,state:null,online:s.online,mount_height_m:s.mount,tilt_deg:s.tilt})),entities:{"light.hall":"off","light.stairs":"off","light.corridor":"off","light.living":"on","light.living_floor":"on","light.kitchen":"on","light.office":"off","light.wc":"off","light.utility":"off","light.gallery":"off","light.upper_corridor":"off","light.bedroom1":"off","light.bedroom2":"on","light.bedroom3":"off","light.bath":"off","binary_sensor.front_door":"off","binary_sensor.hall_living_door":"on","binary_sensor.office_door":"off","binary_sensor.kitchen_door":"on","binary_sensor.wc_door":"off","binary_sensor.bedroom1_door":"off","binary_sensor.bath_door":"off","lock.front_door":"locked","cover.living_terrace":"open","cover.office":"closed","cover.bedroom1":"open","cover.bedroom2":"open","cover.bedroom3":"closed","binary_sensor.motion_living":"on","binary_sensor.motion_office":"off","binary_sensor.motion_upper":"off","media_player.living_tv":"playing"},coverPositions:{"cover.living_terrace":100,"cover.office":0,"cover.bedroom1":100,"cover.bedroom2":70,"cover.bedroom3":0},entityNames:{"light.hall":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05DB\u05E0\u05D9\u05E1\u05D4","light.stairs":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05DE\u05D3\u05E8\u05D2\u05D5\u05EA","light.corridor":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05DE\u05E1\u05D3\u05E8\u05D5\u05DF","light.living":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05E1\u05DC\u05D5\u05DF","light.living_floor":"\u05DE\u05E0\u05D5\u05E8\u05EA \u05E8\u05E6\u05E4\u05D4","light.kitchen":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05DE\u05D8\u05D1\u05D7","light.office":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D7\u05D3\u05E8 \u05E2\u05D1\u05D5\u05D3\u05D4","light.wc":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05E9\u05D9\u05E8\u05D5\u05EA\u05D9\u05DD","light.utility":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D7\u05D3\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA","light.gallery":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D2\u05DC\u05E8\u05D9\u05D4","light.upper_corridor":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05DE\u05E1\u05D3\u05E8\u05D5\u05DF \u05E2\u05DC\u05D9\u05D5\u05DF","light.bedroom1":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D7\u05D3\u05E8 \u05D4\u05D5\u05E8\u05D9\u05DD","light.bedroom2":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D7\u05D3\u05E8 \u05D9\u05DC\u05D3\u05D9\u05DD","light.bedroom3":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D7\u05D3\u05E8 \u05D0\u05D5\u05E8\u05D7\u05D9\u05DD","light.bath":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D0\u05DE\u05D1\u05D8\u05D9\u05D4","binary_sensor.front_door":"\u05D3\u05DC\u05EA \u05DB\u05E0\u05D9\u05E1\u05D4","binary_sensor.hall_living_door":"\u05D3\u05DC\u05EA \u05E1\u05DC\u05D5\u05DF","binary_sensor.office_door":"\u05D3\u05DC\u05EA \u05D7\u05D3\u05E8 \u05E2\u05D1\u05D5\u05D3\u05D4","binary_sensor.kitchen_door":"\u05D3\u05DC\u05EA \u05D4\u05D6\u05D6\u05D4 \u05DC\u05DE\u05D8\u05D1\u05D7","binary_sensor.wc_door":"\u05D3\u05DC\u05EA \u05E9\u05D9\u05E8\u05D5\u05EA\u05D9\u05DD","binary_sensor.bedroom1_door":"\u05D3\u05DC\u05EA \u05D7\u05D3\u05E8 \u05D4\u05D5\u05E8\u05D9\u05DD","binary_sensor.bath_door":"\u05D3\u05DC\u05EA \u05D0\u05DE\u05D1\u05D8\u05D9\u05D4","lock.front_door":"\u05DE\u05E0\u05E2\u05D5\u05DC \u05DB\u05E0\u05D9\u05E1\u05D4","cover.living_terrace":"\u05EA\u05E8\u05D9\u05E1 \u05DE\u05E8\u05E4\u05E1\u05EA","cover.office":"\u05EA\u05E8\u05D9\u05E1 \u05D7\u05D3\u05E8 \u05E2\u05D1\u05D5\u05D3\u05D4","cover.bedroom1":"\u05EA\u05E8\u05D9\u05E1 \u05D7\u05D3\u05E8 \u05D4\u05D5\u05E8\u05D9\u05DD","cover.bedroom2":"\u05EA\u05E8\u05D9\u05E1 \u05D7\u05D3\u05E8 \u05D9\u05DC\u05D3\u05D9\u05DD","cover.bedroom3":"\u05EA\u05E8\u05D9\u05E1 \u05D7\u05D3\u05E8 \u05D0\u05D5\u05E8\u05D7\u05D9\u05DD","binary_sensor.motion_living":"\u05EA\u05E0\u05D5\u05E2\u05D4 \u05D1\u05E1\u05DC\u05D5\u05DF","binary_sensor.motion_office":"\u05EA\u05E0\u05D5\u05E2\u05D4 \u05D1\u05D7\u05D3\u05E8 \u05E2\u05D1\u05D5\u05D3\u05D4","binary_sensor.motion_upper":"\u05EA\u05E0\u05D5\u05E2\u05D4 \u05DC\u05DE\u05E2\u05DC\u05D4","media_player.living_tv":"\u05D8\u05DC\u05D5\u05D5\u05D9\u05D6\u05D9\u05D4"},doorLocks:{front:"lock.front_door"}};var vm={schema_version:"2.0",plan_version_id:"sample",floor_id:"sample-floor",source:{sha256:"0000000000000000000000000000000000000000000000000000000000000000",file_name:"sample.pdf",mime:"application/pdf",page:1},dimensions:{width_px:1e3,height_px:800,scale_m_per_px:.01,calibration:{status:"measured",method:"two_point",pairs:[{a:[.1,.1],b:[.9,.1],metres:8}],residual_pct:0,reason:null}},transform:{rotation:0,crop:null},levels:[{id:"L0",name:"\u05DE\u05E4\u05DC\u05E1 \u05E8\u05D0\u05E9\u05D9",elevation_m:0,ceiling_height_m:3,is_default:!0,external_ids:{}},{id:"L1",name:"\u05D0\u05D5\u05DC\u05DD \u05EA\u05D7\u05EA\u05D5\u05DF",elevation_m:-1.2,ceiling_height_m:6,is_default:!1,external_ids:{}}],walls:[{id:"wc",level_id:"L0",polyline:[[.6,.1],[.6,.5]],thickness_m:.1,height_m:2.4,base_z_m:0,kind:"partition",confidence:.8,source:"auto",locked:!1,external_ids:{}},{id:"wa",level_id:"L0",polyline:[[.1,.1],[.9,.1],[.9,.6]],thickness_m:.3,height_m:null,base_z_m:0,kind:"exterior",confidence:1,source:"manual",locked:!1,external_ids:{}},{id:"wd",level_id:"L1",polyline:[[.1,.7],[.4,.7]],thickness_m:.2,height_m:null,base_z_m:0,kind:"interior",confidence:1,source:"manual",locked:!1,external_ids:{}},{id:"wb",level_id:"L0",polyline:[[.1,.5],[.6,.5]],thickness_m:.15,height_m:null,base_z_m:0,kind:"interior",confidence:1,source:"manual",locked:!1,external_ids:{}}],openings:[{id:"oe",wall_id:"wb",t:.9,kind:"passage",width_m:1,height_m:2.1,sill_m:0,swing:"none",hinge:"start",anchor_ref:null,confidence:1,source:"manual",external_ids:{}},{id:"ob",wall_id:"wa",t:.75,kind:"window",width_m:1.2,height_m:1.2,sill_m:.9,swing:"none",hinge:"start",anchor_ref:null,confidence:1,source:"manual",external_ids:{}},{id:"of",wall_id:"wd",t:.5,kind:"door",width_m:1,height_m:2.1,sill_m:0,swing:"sliding",hinge:"start",anchor_ref:null,confidence:1,source:"manual",external_ids:{}},{id:"oa",wall_id:"wa",t:.2,kind:"door",width_m:.9,height_m:2.1,sill_m:0,swing:"right",hinge:"start",anchor_ref:null,confidence:1,source:"manual",external_ids:{}},{id:"od",wall_id:"wc",t:.5,kind:"door",width_m:1.6,height_m:2.1,sill_m:0,swing:"double",hinge:"start",anchor_ref:null,confidence:1,source:"manual",external_ids:{}},{id:"oc",wall_id:"wb",t:.5,kind:"door",width_m:.8,height_m:2.1,sill_m:0,swing:"left",hinge:"end",anchor_ref:{resource_type:"ha_entity",resource_id:"lock.store"},confidence:1,source:"manual",external_ids:{}}],rooms:[],objects:[{id:"o1",item_id:"chair.basic",level_id:"L0",position:[.2,.2],rotation_deg:0,size:{w_m:.45,d_m:.45,h_m:.85},z_m:0,params:{},label:null,anchor_ref:null,group_id:"g1",confidence:1,source:"manual",locked:!1,external_ids:{}},{id:"o2",item_id:"table.desk",level_id:"L0",position:[.3,.4],rotation_deg:90,size:{w_m:1.4,d_m:.7,h_m:.75},z_m:0,params:{},label:"\u05E9\u05D5\u05DC\u05D7\u05DF",anchor_ref:null,group_id:"g1",confidence:1,source:"manual",locked:!1,external_ids:{}},{id:"o3",item_id:"light.ceiling",level_id:"L0",position:[.5,.3],rotation_deg:0,size:{w_m:.4,d_m:.4,h_m:.1},z_m:2.7,params:{},label:null,anchor_ref:{resource_type:"ha_entity",resource_id:"light.store"},group_id:null,confidence:1,source:"manual",locked:!1,external_ids:{}},{id:"o4",item_id:"tribune.stepped",level_id:"L0",position:[.25,.6],rotation_deg:180,size:{w_m:4,d_m:3,h_m:1.2},z_m:0,params:{rows:4,step_height_m:.3,step_width_m:1,connects_levels:"L1"},label:null,anchor_ref:null,group_id:null,confidence:1,source:"manual",locked:!1,external_ids:{}},{id:"o5",item_id:"extinguisher.co2",level_id:"L1",position:[.15,.8],rotation_deg:0,size:{w_m:.2,d_m:.2,h_m:.6},z_m:.9,params:{},label:"\u05DE\u05D8\u05E3",anchor_ref:null,group_id:null,confidence:1,source:"manual",locked:!1,external_ids:{}}],circuits:[{id:"k1",name:"\u05DE\u05E2\u05D2\u05DC \u05D0\u05D5\u05DC\u05DD",switch_entity_id:"switch.hall_a",member_ids:["o3"],color_token:"circuit-1",power_w:36}],connectors:[{id:"c1",kind:"stairs",level_from:"L0",level_to:"L1",floor_ids:[],polyline:[[.7,.7],[.8,.7]],width_m:1.2,label:null,object_id:null,source:"manual",external_ids:{}},{id:"cx-o4",kind:"tribune",level_from:"L0",level_to:"L1",floor_ids:[],polyline:[[.25,.4125],[.25,.7875]],width_m:4,label:null,object_id:"o4",source:"auto",external_ids:{}}],labels:[{id:"lb",text:"\u05D0\u05D5\u05DC\u05DD",position:[.25,.75],level_id:"L1",size:16},{id:"la",text:"\u05DE\u05D7\u05E1\u05DF",position:[.3,.3],level_id:"L0",size:16}],groups:[{id:"g1",kind:"manual",member_ids:["o1","o2"],params:{},label:null}],uncertain_regions:[],uncertainty:{overall:.2,notes:[]},meta:{generator:"fixture",tokens_version:"map-1",detector_version:null}};function ym(s){let e=new Map,t=new Map,i=s.clone();return Mm(s,i,function(n,r){e.set(r,n),t.set(n,r)}),i.traverse(function(n){if(!n.isSkinnedMesh)return;let r=n,o=e.get(n),a=o.skeleton.bones;r.skeleton=o.skeleton.clone(),r.bindMatrix.copy(o.bindMatrix),r.skeleton.bones=a.map(function(l){return t.get(l)}),r.bind(r.skeleton,r.bindMatrix)}),i}function Mm(s,e,t){t(s,e);for(let i=0;i<s.children.length;i++)Mm(s.children[i],e.children[i],t)}var Gc=class extends sn{constructor(e){super(e),this.dracoLoader=null,this.ktx2Loader=null,this.meshoptDecoder=null,this.pluginCallbacks=[],this.register(function(t){return new ed(t)}),this.register(function(t){return new td(t)}),this.register(function(t){return new hd(t)}),this.register(function(t){return new ud(t)}),this.register(function(t){return new dd(t)}),this.register(function(t){return new nd(t)}),this.register(function(t){return new sd(t)}),this.register(function(t){return new rd(t)}),this.register(function(t){return new od(t)}),this.register(function(t){return new $u(t)}),this.register(function(t){return new ad(t)}),this.register(function(t){return new id(t)}),this.register(function(t){return new cd(t)}),this.register(function(t){return new ld(t)}),this.register(function(t){return new Ju(t)}),this.register(function(t){return new Wc(t,rt.EXT_MESHOPT_COMPRESSION)}),this.register(function(t){return new Wc(t,rt.KHR_MESHOPT_COMPRESSION)}),this.register(function(t){return new fd(t)})}load(e,t,i,n){let r=this,o;if(this.resourcePath!=="")o=this.resourcePath;else if(this.path!==""){let c=Cn.extractUrlBase(e);o=Cn.resolveURL(c,this.path)}else o=Cn.extractUrlBase(e);this.manager.itemStart(e);let a=function(c){n?n(c):console.error(c),r.manager.itemError(e),r.manager.itemEnd(e)},l=new fr(this.manager);l.setPath(this.path),l.setResponseType("arraybuffer"),l.setRequestHeader(this.requestHeader),l.setWithCredentials(this.withCredentials),l.load(e,function(c){try{r.parse(c,o,function(h){t(h),r.manager.itemEnd(e)},a)}catch(h){a(h)}},i,a)}setDRACOLoader(e){return this.dracoLoader=e,this}setKTX2Loader(e){return this.ktx2Loader=e,this}setMeshoptDecoder(e){return this.meshoptDecoder=e,this}register(e){return this.pluginCallbacks.indexOf(e)===-1&&this.pluginCallbacks.push(e),this}unregister(e){return this.pluginCallbacks.indexOf(e)!==-1&&this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(e),1),this}parse(e,t,i,n){let r,o={},a={},l=new TextDecoder;if(typeof e=="string")r=JSON.parse(e);else if(e instanceof ArrayBuffer)if(l.decode(new Uint8Array(e,0,4))===Em){try{o[rt.KHR_BINARY_GLTF]=new pd(e)}catch(f){n&&n(f);return}r=JSON.parse(o[rt.KHR_BINARY_GLTF].content)}else r=JSON.parse(l.decode(e));else r=e;if(r.asset===void 0||r.asset.version[0]<2){n&&n(new Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));return}let c=new Md(r,{path:t||this.resourcePath||"",crossOrigin:this.crossOrigin,requestHeader:this.requestHeader,manager:this.manager,ktx2Loader:this.ktx2Loader,meshoptDecoder:this.meshoptDecoder});c.fileLoader.setRequestHeader(this.requestHeader);for(let h=0;h<this.pluginCallbacks.length;h++){let f=this.pluginCallbacks[h](c);f.name||console.error("THREE.GLTFLoader: Invalid plugin found: missing name"),a[f.name]=f,o[f.name]=!0}if(r.extensionsUsed)for(let h=0;h<r.extensionsUsed.length;++h){let f=r.extensionsUsed[h],d=r.extensionsRequired||[];switch(f){case rt.KHR_MATERIALS_UNLIT:o[f]=new Qu;break;case rt.KHR_DRACO_MESH_COMPRESSION:o[f]=new md(r,this.dracoLoader);break;case rt.KHR_TEXTURE_TRANSFORM:o[f]=new gd;break;case rt.KHR_MESH_QUANTIZATION:o[f]=new xd;break;default:d.indexOf(f)>=0&&a[f]===void 0&&console.warn('THREE.GLTFLoader: Unknown extension "'+f+'".')}}c.setExtensions(o),c.setPlugins(a),c.parse(i,n)}parseAsync(e,t){let i=this;return new Promise(function(n,r){i.parse(e,t,n,r)})}};function HM(){let s={};return{get:function(e){return s[e]},add:function(e,t){s[e]=t},remove:function(e){delete s[e]},removeAll:function(){s={}}}}function zt(s,e,t){let i=s.json.materials[e];return i.extensions&&i.extensions[t]?i.extensions[t]:null}var rt={KHR_BINARY_GLTF:"KHR_binary_glTF",KHR_DRACO_MESH_COMPRESSION:"KHR_draco_mesh_compression",KHR_LIGHTS_PUNCTUAL:"KHR_lights_punctual",KHR_MATERIALS_CLEARCOAT:"KHR_materials_clearcoat",KHR_MATERIALS_DISPERSION:"KHR_materials_dispersion",KHR_MATERIALS_IOR:"KHR_materials_ior",KHR_MATERIALS_SHEEN:"KHR_materials_sheen",KHR_MATERIALS_SPECULAR:"KHR_materials_specular",KHR_MATERIALS_TRANSMISSION:"KHR_materials_transmission",KHR_MATERIALS_IRIDESCENCE:"KHR_materials_iridescence",KHR_MATERIALS_ANISOTROPY:"KHR_materials_anisotropy",KHR_MATERIALS_UNLIT:"KHR_materials_unlit",KHR_MATERIALS_VOLUME:"KHR_materials_volume",KHR_TEXTURE_BASISU:"KHR_texture_basisu",KHR_TEXTURE_TRANSFORM:"KHR_texture_transform",KHR_MESH_QUANTIZATION:"KHR_mesh_quantization",KHR_MATERIALS_EMISSIVE_STRENGTH:"KHR_materials_emissive_strength",EXT_MATERIALS_BUMP:"EXT_materials_bump",EXT_TEXTURE_WEBP:"EXT_texture_webp",EXT_TEXTURE_AVIF:"EXT_texture_avif",EXT_MESHOPT_COMPRESSION:"EXT_meshopt_compression",KHR_MESHOPT_COMPRESSION:"KHR_meshopt_compression",EXT_MESH_GPU_INSTANCING:"EXT_mesh_gpu_instancing"},Ju=class{constructor(e){this.parser=e,this.name=rt.KHR_LIGHTS_PUNCTUAL,this.cache={refs:{},uses:{}}}_markDefs(){let e=this.parser,t=this.parser.json.nodes||[];for(let i=0,n=t.length;i<n;i++){let r=t[i];r.extensions&&r.extensions[this.name]&&r.extensions[this.name].light!==void 0&&e._addNodeRef(this.cache,r.extensions[this.name].light)}}_loadLight(e){let t=this.parser,i="light:"+e,n=t.cache.get(i);if(n)return n;let r=t.json,l=((r.extensions&&r.extensions[this.name]||{}).lights||[])[e],c,h=new Me(16777215);l.color!==void 0&&h.setRGB(l.color[0],l.color[1],l.color[2],di);let f=l.range!==void 0?l.range:0;switch(l.type){case"directional":c=new An(h),c.target.position.set(0,0,-1),c.add(c.target);break;case"point":c=new vs(h),c.distance=f;break;case"spot":c=new Eo(h),c.distance=f,l.spot=l.spot||{},l.spot.innerConeAngle=l.spot.innerConeAngle!==void 0?l.spot.innerConeAngle:0,l.spot.outerConeAngle=l.spot.outerConeAngle!==void 0?l.spot.outerConeAngle:Math.PI/4,c.angle=l.spot.outerConeAngle,c.penumbra=1-l.spot.innerConeAngle/l.spot.outerConeAngle,c.target.position.set(0,0,-1),c.add(c.target);break;default:throw new Error("THREE.GLTFLoader: Unexpected light type: "+l.type)}return c.position.set(0,0,0),dn(c,l),l.intensity!==void 0&&(c.intensity=l.intensity),c.name=t.createUniqueName(l.name||"light_"+e),n=Promise.resolve(c),t.cache.add(i,n),n}getDependency(e,t){if(e==="light")return this._loadLight(t)}createNodeAttachment(e){let t=this,i=this.parser,r=i.json.nodes[e],a=(r.extensions&&r.extensions[this.name]||{}).light;return a===void 0?null:this._loadLight(a).then(function(l){return i._getNodeRef(t.cache,a,l)})}},Qu=class{constructor(){this.name=rt.KHR_MATERIALS_UNLIT}getMaterialType(){return St}extendParams(e,t,i){let n=[];e.color=new Me(1,1,1),e.opacity=1;let r=t.pbrMetallicRoughness;if(r){if(Array.isArray(r.baseColorFactor)){let o=r.baseColorFactor;e.color.setRGB(o[0],o[1],o[2],di),e.opacity=o[3]}r.baseColorTexture!==void 0&&n.push(i.assignTexture(e,"map",r.baseColorTexture,Mt))}return Promise.all(n)}},$u=class{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_EMISSIVE_STRENGTH}extendMaterialParams(e,t){let i=zt(this.parser,e,this.name);return i===null||i.emissiveStrength!==void 0&&(t.emissiveIntensity=i.emissiveStrength),Promise.resolve()}},ed=class{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_CLEARCOAT}getMaterialType(e){return zt(this.parser,e,this.name)!==null?ai:null}extendMaterialParams(e,t){let i=zt(this.parser,e,this.name);if(i===null)return Promise.resolve();let n=[];if(i.clearcoatFactor!==void 0&&(t.clearcoat=i.clearcoatFactor),i.clearcoatTexture!==void 0&&n.push(this.parser.assignTexture(t,"clearcoatMap",i.clearcoatTexture)),i.clearcoatRoughnessFactor!==void 0&&(t.clearcoatRoughness=i.clearcoatRoughnessFactor),i.clearcoatRoughnessTexture!==void 0&&n.push(this.parser.assignTexture(t,"clearcoatRoughnessMap",i.clearcoatRoughnessTexture)),i.clearcoatNormalTexture!==void 0&&(n.push(this.parser.assignTexture(t,"clearcoatNormalMap",i.clearcoatNormalTexture)),i.clearcoatNormalTexture.scale!==void 0)){let r=i.clearcoatNormalTexture.scale;t.clearcoatNormalScale=new ee(r,r)}return Promise.all(n)}},td=class{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_DISPERSION}getMaterialType(e){return zt(this.parser,e,this.name)!==null?ai:null}extendMaterialParams(e,t){let i=zt(this.parser,e,this.name);return i===null||(t.dispersion=i.dispersion!==void 0?i.dispersion:0),Promise.resolve()}},id=class{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_IRIDESCENCE}getMaterialType(e){return zt(this.parser,e,this.name)!==null?ai:null}extendMaterialParams(e,t){let i=zt(this.parser,e,this.name);if(i===null)return Promise.resolve();let n=[];return i.iridescenceFactor!==void 0&&(t.iridescence=i.iridescenceFactor),i.iridescenceTexture!==void 0&&n.push(this.parser.assignTexture(t,"iridescenceMap",i.iridescenceTexture)),i.iridescenceIor!==void 0&&(t.iridescenceIOR=i.iridescenceIor),t.iridescenceThicknessRange===void 0&&(t.iridescenceThicknessRange=[100,400]),i.iridescenceThicknessMinimum!==void 0&&(t.iridescenceThicknessRange[0]=i.iridescenceThicknessMinimum),i.iridescenceThicknessMaximum!==void 0&&(t.iridescenceThicknessRange[1]=i.iridescenceThicknessMaximum),i.iridescenceThicknessTexture!==void 0&&n.push(this.parser.assignTexture(t,"iridescenceThicknessMap",i.iridescenceThicknessTexture)),Promise.all(n)}},nd=class{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_SHEEN}getMaterialType(e){return zt(this.parser,e,this.name)!==null?ai:null}extendMaterialParams(e,t){let i=zt(this.parser,e,this.name);if(i===null)return Promise.resolve();let n=[];if(t.sheenColor=new Me(0,0,0),t.sheenRoughness=0,t.sheen=1,i.sheenColorFactor!==void 0){let r=i.sheenColorFactor;t.sheenColor.setRGB(r[0],r[1],r[2],di)}return i.sheenRoughnessFactor!==void 0&&(t.sheenRoughness=i.sheenRoughnessFactor),i.sheenColorTexture!==void 0&&n.push(this.parser.assignTexture(t,"sheenColorMap",i.sheenColorTexture,Mt)),i.sheenRoughnessTexture!==void 0&&n.push(this.parser.assignTexture(t,"sheenRoughnessMap",i.sheenRoughnessTexture)),Promise.all(n)}},sd=class{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_TRANSMISSION}getMaterialType(e){return zt(this.parser,e,this.name)!==null?ai:null}extendMaterialParams(e,t){let i=zt(this.parser,e,this.name);if(i===null)return Promise.resolve();let n=[];return i.transmissionFactor!==void 0&&(t.transmission=i.transmissionFactor),i.transmissionTexture!==void 0&&n.push(this.parser.assignTexture(t,"transmissionMap",i.transmissionTexture)),Promise.all(n)}},rd=class{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_VOLUME}getMaterialType(e){return zt(this.parser,e,this.name)!==null?ai:null}extendMaterialParams(e,t){let i=zt(this.parser,e,this.name);if(i===null)return Promise.resolve();let n=[];t.thickness=i.thicknessFactor!==void 0?i.thicknessFactor:0,i.thicknessTexture!==void 0&&n.push(this.parser.assignTexture(t,"thicknessMap",i.thicknessTexture)),t.attenuationDistance=i.attenuationDistance||1/0;let r=i.attenuationColor||[1,1,1];return t.attenuationColor=new Me().setRGB(r[0],r[1],r[2],di),Promise.all(n)}},od=class{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_IOR}getMaterialType(e){return zt(this.parser,e,this.name)!==null?ai:null}extendMaterialParams(e,t){let i=zt(this.parser,e,this.name);return i===null||(t.ior=i.ior!==void 0?i.ior:1.5,t.ior===0&&(t.ior=1e3)),Promise.resolve()}},ad=class{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_SPECULAR}getMaterialType(e){return zt(this.parser,e,this.name)!==null?ai:null}extendMaterialParams(e,t){let i=zt(this.parser,e,this.name);if(i===null)return Promise.resolve();let n=[];t.specularIntensity=i.specularFactor!==void 0?i.specularFactor:1,i.specularTexture!==void 0&&n.push(this.parser.assignTexture(t,"specularIntensityMap",i.specularTexture));let r=i.specularColorFactor||[1,1,1];return t.specularColor=new Me().setRGB(r[0],r[1],r[2],di),i.specularColorTexture!==void 0&&n.push(this.parser.assignTexture(t,"specularColorMap",i.specularColorTexture,Mt)),Promise.all(n)}},ld=class{constructor(e){this.parser=e,this.name=rt.EXT_MATERIALS_BUMP}getMaterialType(e){return zt(this.parser,e,this.name)!==null?ai:null}extendMaterialParams(e,t){let i=zt(this.parser,e,this.name);if(i===null)return Promise.resolve();let n=[];return t.bumpScale=i.bumpFactor!==void 0?i.bumpFactor:1,i.bumpTexture!==void 0&&n.push(this.parser.assignTexture(t,"bumpMap",i.bumpTexture)),Promise.all(n)}},cd=class{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_ANISOTROPY}getMaterialType(e){return zt(this.parser,e,this.name)!==null?ai:null}extendMaterialParams(e,t){let i=zt(this.parser,e,this.name);if(i===null)return Promise.resolve();let n=[];return i.anisotropyStrength!==void 0&&(t.anisotropy=i.anisotropyStrength),i.anisotropyRotation!==void 0&&(t.anisotropyRotation=i.anisotropyRotation),i.anisotropyTexture!==void 0&&n.push(this.parser.assignTexture(t,"anisotropyMap",i.anisotropyTexture)),Promise.all(n)}},hd=class{constructor(e){this.parser=e,this.name=rt.KHR_TEXTURE_BASISU}loadTexture(e){let t=this.parser,i=t.json,n=i.textures[e];if(!n.extensions||!n.extensions[this.name])return null;let r=n.extensions[this.name],o=t.options.ktx2Loader;if(!o){if(i.extensionsRequired&&i.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures");return null}return t.loadTextureImage(e,r.source,o)}},ud=class{constructor(e){this.parser=e,this.name=rt.EXT_TEXTURE_WEBP}loadTexture(e){let t=this.name,i=this.parser,n=i.json,r=n.textures[e];if(!r.extensions||!r.extensions[t])return null;let o=r.extensions[t],a=n.images[o.source],l=i.textureLoader;if(a.uri){let c=i.options.manager.getHandler(a.uri);c!==null&&(l=c)}return i.loadTextureImage(e,o.source,l)}},dd=class{constructor(e){this.parser=e,this.name=rt.EXT_TEXTURE_AVIF}loadTexture(e){let t=this.name,i=this.parser,n=i.json,r=n.textures[e];if(!r.extensions||!r.extensions[t])return null;let o=r.extensions[t],a=n.images[o.source],l=i.textureLoader;if(a.uri){let c=i.options.manager.getHandler(a.uri);c!==null&&(l=c)}return i.loadTextureImage(e,o.source,l)}},Wc=class{constructor(e,t){this.name=t,this.parser=e}loadBufferView(e){let t=this.parser.json,i=t.bufferViews[e];if(i.extensions&&i.extensions[this.name]){let n=i.extensions[this.name],r=this.parser.getDependency("buffer",n.buffer),o=this.parser.options.meshoptDecoder;if(!o||!o.supported){if(t.extensionsRequired&&t.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");return null}return r.then(function(a){let l=n.byteOffset||0,c=n.byteLength||0,h=n.count,f=n.byteStride,d=new Uint8Array(a,l,c);return o.decodeGltfBufferAsync?o.decodeGltfBufferAsync(h,f,d,n.mode,n.filter).then(function(u){return u.buffer}):o.ready.then(function(){let u=new ArrayBuffer(h*f);return o.decodeGltfBuffer(new Uint8Array(u),h,f,d,n.mode,n.filter),u})})}else return null}},fd=class{constructor(e){this.name=rt.EXT_MESH_GPU_INSTANCING,this.parser=e}createNodeMesh(e){let t=this.parser.json,i=t.nodes[e];if(!i.extensions||!i.extensions[this.name]||i.mesh===void 0)return null;let n=t.meshes[i.mesh];for(let c of n.primitives)if(c.mode!==Ui.TRIANGLES&&c.mode!==Ui.TRIANGLE_STRIP&&c.mode!==Ui.TRIANGLE_FAN&&c.mode!==void 0)return null;let o=i.extensions[this.name].attributes,a=[],l={};for(let c in o)a.push(this.parser.getDependency("accessor",o[c]).then(h=>(l[c]=h,l[c])));return a.length<1?null:(a.push(this.parser.createNodeMesh(e)),Promise.all(a).then(c=>{let h=c.pop(),f=h.isGroup?h.children:[h],d=c[0].count,u=[];for(let p of f){let x=new We,m=new D,g=new Qt,S=new D(1,1,1),T=new ds(p.geometry,p.material,d);for(let v=0;v<d;v++)l.TRANSLATION&&m.fromBufferAttribute(l.TRANSLATION,v),l.ROTATION&&g.fromBufferAttribute(l.ROTATION,v),l.SCALE&&S.fromBufferAttribute(l.SCALE,v),T.setMatrixAt(v,x.compose(m,g,S));let _=null;for(let v in l)if(v==="_COLOR_0"){let E=l[v];T.instanceColor=new Mn(E.array,E.itemSize,E.normalized)}else if(v!=="TRANSLATION"&&v!=="ROTATION"&&v!=="SCALE"){if(_===null){let A=T.geometry;_=new _t,_.name=A.name;for(let y in A.attributes)_.setAttribute(y,A.attributes[y]);for(let y in A.morphAttributes)_.morphAttributes[y]=A.morphAttributes[y];A.index!==null&&_.setIndex(A.index),_.morphTargetsRelative=A.morphTargetsRelative;for(let y of A.groups)_.addGroup(y.start,y.count,y.materialIndex);A.boundingBox!==null&&(_.boundingBox=A.boundingBox.clone()),A.boundingSphere!==null&&(_.boundingSphere=A.boundingSphere.clone()),_.drawRange.start=A.drawRange.start,_.drawRange.count=A.drawRange.count,_.userData=Object.assign({},A.userData),T.geometry=_}let E=l[v];_.setAttribute(v,new Mn(E.array,E.itemSize,E.normalized))}Rt.prototype.copy.call(T,p),this.parser.assignFinalMaterial(T),u.push(T)}return h.isGroup?(h.clear(),h.add(...u),h):u[0]}))}},Em="glTF",ua=12,bm={JSON:1313821514,BIN:5130562},pd=class{constructor(e){this.name=rt.KHR_BINARY_GLTF,this.content=null,this.body=null;let t=new DataView(e,0,ua),i=new TextDecoder;if(this.header={magic:i.decode(new Uint8Array(e.slice(0,4))),version:t.getUint32(4,!0),length:t.getUint32(8,!0)},this.header.magic!==Em)throw new Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");if(this.header.version<2)throw new Error("THREE.GLTFLoader: Legacy binary file detected.");let n=this.header.length-ua,r=new DataView(e,ua),o=0;for(;o<n;){let a=r.getUint32(o,!0);o+=4;let l=r.getUint32(o,!0);if(o+=4,l===bm.JSON){let c=new Uint8Array(e,ua+o,a);this.content=i.decode(c)}else if(l===bm.BIN){let c=ua+o;this.body=e.slice(c,c+a)}o+=a}if(this.content===null)throw new Error("THREE.GLTFLoader: JSON content not found.")}},md=class{constructor(e,t){if(!t)throw new Error("THREE.GLTFLoader: No DRACOLoader instance provided.");this.name=rt.KHR_DRACO_MESH_COMPRESSION,this.json=e,this.dracoLoader=t,this.dracoLoader.preload()}decodePrimitive(e,t){let i=this.json,n=this.dracoLoader,r=e.extensions[this.name].bufferView,o=e.extensions[this.name].attributes,a={},l={},c={};for(let h in o){let f=vd[h]||h.toLowerCase();a[f]=o[h]}for(let h in e.attributes){let f=vd[h]||h.toLowerCase();if(o[h]!==void 0){let d=i.accessors[e.attributes[h]],u=Nr[d.componentType];c[f]=u.name,l[f]=d.normalized===!0}}return t.getDependency("bufferView",r).then(function(h){return new Promise(function(f,d){n.decodeDracoFile(h,function(u){for(let p in u.attributes){let x=u.attributes[p],m=l[p];m!==void 0&&(x.normalized=m)}f(u)},a,c,di,d)})})}},gd=class{constructor(){this.name=rt.KHR_TEXTURE_TRANSFORM}extendTexture(e,t){if((t.texCoord===void 0||t.texCoord===e.channel)&&t.offset===void 0&&t.rotation===void 0&&t.scale===void 0)return e;if(e=e.clone(),t.texCoord!==void 0&&(e.channel=t.texCoord),t.offset!==void 0&&e.offset.fromArray(t.offset),t.rotation!==void 0&&(e.rotation=t.rotation),t.scale!==void 0&&e.repeat.fromArray(t.scale),t.rotation!==void 0){let i=Math.cos(e.rotation),n=Math.sin(e.rotation);e.matrix.set(e.repeat.x*i,e.repeat.y*n,e.offset.x,-e.repeat.x*n,e.repeat.y*i,e.offset.y,0,0,1),e.matrixAutoUpdate=!1}return e.needsUpdate=!0,e}},xd=class{constructor(){this.name=rt.KHR_MESH_QUANTIZATION}},Xc=class extends nn{constructor(e,t,i,n){super(e,t,i,n)}copySampleValue_(e){let t=this.resultBuffer,i=this.sampleValues,n=this.valueSize,r=e*n*3+n;for(let o=0;o!==n;o++)t[o]=i[r+o];return t}interpolate_(e,t,i,n){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=a*2,c=a*3,h=n-t,f=(i-t)/h,d=f*f,u=d*f,p=e*c,x=p-c,m=-2*u+3*d,g=u-d,S=1-m,T=g-d+f;for(let _=0;_!==a;_++){let v=o[x+_+a],E=o[x+_+l]*h,A=o[p+_+a],y=o[p+_]*h;r[_]=S*v+T*E+m*A+g*y}return r}},VM=new Qt,_d=class extends Xc{interpolate_(e,t,i,n){let r=super.interpolate_(e,t,i,n);return VM.fromArray(r).normalize().toArray(r),r}},Ui={FLOAT:5126,FLOAT_MAT3:35675,FLOAT_MAT4:35676,FLOAT_VEC2:35664,FLOAT_VEC3:35665,FLOAT_VEC4:35666,LINEAR:9729,REPEAT:10497,SAMPLER_2D:35678,POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6,UNSIGNED_BYTE:5121,UNSIGNED_SHORT:5123},Nr={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},Sm={9728:bt,9729:It,9984:Cl,9985:_r,9986:Ss,9987:Gi},wm={33071:pi,33648:Qs,10497:Xt},ju={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},vd={POSITION:"position",NORMAL:"normal",TANGENT:"tangent",TEXCOORD_0:"uv",TEXCOORD_1:"uv1",TEXCOORD_2:"uv2",TEXCOORD_3:"uv3",COLOR_0:"color",WEIGHTS_0:"skinWeight",JOINTS_0:"skinIndex"},ts={scale:"scale",translation:"position",rotation:"quaternion",weights:"morphTargetInfluences"},GM={CUBICSPLINE:void 0,LINEAR:cs,STEP:ls},Zu={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};function WM(s){return s.DefaultMaterial===void 0&&(s.DefaultMaterial=new Pt({color:16777215,emissive:0,metalness:1,roughness:1,transparent:!1,depthTest:!0,side:rn})),s.DefaultMaterial}function Rs(s,e,t){for(let i in t.extensions)s[i]===void 0&&(e.userData.gltfExtensions=e.userData.gltfExtensions||{},e.userData.gltfExtensions[i]=t.extensions[i])}function dn(s,e){e.extras!==void 0&&(typeof e.extras=="object"?Object.assign(s.userData,e.extras):console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, "+e.extras))}function XM(s,e,t){let i=!1,n=!1,r=!1;for(let c=0,h=e.length;c<h;c++){let f=e[c];if(f.POSITION!==void 0&&(i=!0),f.NORMAL!==void 0&&(n=!0),f.COLOR_0!==void 0&&(r=!0),i&&n&&r)break}if(!i&&!n&&!r)return Promise.resolve(s);let o=[],a=[],l=[];for(let c=0,h=e.length;c<h;c++){let f=e[c];if(i){let d=f.POSITION!==void 0?t.getDependency("accessor",f.POSITION):s.attributes.position;o.push(d)}if(n){let d=f.NORMAL!==void 0?t.getDependency("accessor",f.NORMAL):s.attributes.normal;a.push(d)}if(r){let d=f.COLOR_0!==void 0?t.getDependency("accessor",f.COLOR_0):s.attributes.color;l.push(d)}}return Promise.all([Promise.all(o),Promise.all(a),Promise.all(l)]).then(function(c){let h=c[0],f=c[1],d=c[2];return i&&(s.morphAttributes.position=h),n&&(s.morphAttributes.normal=f),r&&(s.morphAttributes.color=d),s.morphTargetsRelative=!0,s})}function qM(s,e){if(s.updateMorphTargets(),e.weights!==void 0)for(let t=0,i=e.weights.length;t<i;t++)s.morphTargetInfluences[t]=e.weights[t];if(e.extras&&Array.isArray(e.extras.targetNames)){let t=e.extras.targetNames;if(s.morphTargetInfluences.length===t.length){s.morphTargetDictionary={};for(let i=0,n=t.length;i<n;i++)s.morphTargetDictionary[t[i]]=i}else console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.")}}function YM(s){let e,t=s.extensions&&s.extensions[rt.KHR_DRACO_MESH_COMPRESSION];if(t?e="draco:"+t.bufferView+":"+t.indices+":"+Ku(t.attributes):e=s.indices+":"+Ku(s.attributes)+":"+s.mode,s.targets!==void 0)for(let i=0,n=s.targets.length;i<n;i++)e+=":"+Ku(s.targets[i]);return e}function Ku(s){let e="",t=Object.keys(s).sort();for(let i=0,n=t.length;i<n;i++)e+=t[i]+":"+s[t[i]]+";";return e}function yd(s){switch(s){case Int8Array:return 1/127;case Uint8Array:return 1/255;case Int16Array:return 1/32767;case Uint16Array:return 1/65535;default:throw new Error("THREE.GLTFLoader: Unsupported normalized accessor component type.")}}function jM(s){return s.search(/\.jpe?g($|\?)/i)>0||s.search(/^data\:image\/jpeg/)===0?"image/jpeg":s.search(/\.webp($|\?)/i)>0||s.search(/^data\:image\/webp/)===0?"image/webp":s.search(/\.ktx2($|\?)/i)>0||s.search(/^data\:image\/ktx2/)===0?"image/ktx2":"image/png"}var ZM=new We,Md=class{constructor(e={},t={}){this.json=e,this.extensions={},this.plugins={},this.options=t,this.cache=new HM,this.associations=new Map,this.primitiveCache={},this.nodeCache={},this.meshCache={refs:{},uses:{}},this.cameraCache={refs:{},uses:{}},this.lightCache={refs:{},uses:{}},this.sourceCache={},this.textureCache={},this.nodeNamesUsed={};let i=!1,n=-1,r=!1,o=-1;if(typeof navigator<"u"&&typeof navigator.userAgent<"u"){let a=navigator.userAgent;i=/^((?!chrome|android).)*safari/i.test(a)===!0;let l=a.match(/Version\/(\d+)/);n=i&&l?parseInt(l[1],10):-1,r=a.indexOf("Firefox")>-1,o=r?a.match(/Firefox\/([0-9]+)\./)[1]:-1}typeof createImageBitmap>"u"||i&&n<17||r&&o<98?this.textureLoader=new _s(this.options.manager):this.textureLoader=new Co(this.options.manager),this.textureLoader.setCrossOrigin(this.options.crossOrigin),this.textureLoader.setRequestHeader(this.options.requestHeader),this.fileLoader=new fr(this.options.manager),this.fileLoader.setResponseType("arraybuffer"),this.options.crossOrigin==="use-credentials"&&this.fileLoader.setWithCredentials(!0)}setExtensions(e){this.extensions=e}setPlugins(e){this.plugins=e}parse(e,t){let i=this,n=this.json,r=this.extensions;this.cache.removeAll(),this.nodeCache={},this._invokeAll(function(o){return o._markDefs&&o._markDefs()}),Promise.all(this._invokeAll(function(o){return o.beforeRoot&&o.beforeRoot()})).then(function(){return Promise.all([i.getDependencies("scene"),i.getDependencies("animation"),i.getDependencies("camera")])}).then(function(o){let a={scene:o[0][n.scene||0],scenes:o[0],animations:o[1],cameras:o[2],asset:n.asset,parser:i,userData:{}};return Rs(r,a,n),dn(a,n),Promise.all(i._invokeAll(function(l){return l.afterRoot&&l.afterRoot(a)})).then(function(){for(let l of a.scenes)l.updateMatrixWorld();e(a)})}).catch(t)}_markDefs(){let e=this.json.nodes||[],t=this.json.skins||[],i=this.json.meshes||[];for(let n=0,r=t.length;n<r;n++){let o=t[n].joints;for(let a=0,l=o.length;a<l;a++)e[o[a]].isBone=!0}for(let n=0,r=e.length;n<r;n++){let o=e[n];o.mesh!==void 0&&(this._addNodeRef(this.meshCache,o.mesh),o.skin!==void 0&&(i[o.mesh].isSkinnedMesh=!0)),o.camera!==void 0&&this._addNodeRef(this.cameraCache,o.camera)}}_addNodeRef(e,t){t!==void 0&&(e.refs[t]===void 0&&(e.refs[t]=e.uses[t]=0),e.refs[t]++)}_getNodeRef(e,t,i){if(e.refs[t]<=1)return i;let n=i.clone(),r=(o,a)=>{let l=this.associations.get(o);l!=null&&this.associations.set(a,l);for(let[c,h]of o.children.entries())r(h,a.children[c])};return r(i,n),n.name+="_instance_"+e.uses[t]++,n}_invokeOne(e){let t=Object.values(this.plugins);t.push(this);for(let i=0;i<t.length;i++){let n=e(t[i]);if(n)return n}return null}_invokeAll(e){let t=Object.values(this.plugins);t.unshift(this);let i=[];for(let n=0;n<t.length;n++){let r=e(t[n]);r&&i.push(r)}return i}getDependency(e,t){let i=e+":"+t,n=this.cache.get(i);if(!n){switch(e){case"scene":n=this.loadScene(t);break;case"node":n=this._invokeOne(function(r){return r.loadNode&&r.loadNode(t)});break;case"mesh":n=this._invokeOne(function(r){return r.loadMesh&&r.loadMesh(t)});break;case"accessor":n=this.loadAccessor(t);break;case"bufferView":n=this._invokeOne(function(r){return r.loadBufferView&&r.loadBufferView(t)});break;case"buffer":n=this.loadBuffer(t);break;case"material":n=this._invokeOne(function(r){return r.loadMaterial&&r.loadMaterial(t)});break;case"texture":n=this._invokeOne(function(r){return r.loadTexture&&r.loadTexture(t)});break;case"skin":n=this.loadSkin(t);break;case"animation":n=this._invokeOne(function(r){return r.loadAnimation&&r.loadAnimation(t)});break;case"camera":n=this.loadCamera(t);break;default:if(n=this._invokeOne(function(r){return r!=this&&r.getDependency&&r.getDependency(e,t)}),!n)throw new Error("Unknown type: "+e);break}this.cache.add(i,n)}return n}getDependencies(e){let t=this.cache.get(e);if(!t){let i=this,n=this.json[e+(e==="mesh"?"es":"s")]||[];t=Promise.all(n.map(function(r,o){return i.getDependency(e,o)})),this.cache.add(e,t)}return t}loadBuffer(e){let t=this.json.buffers[e],i=this.fileLoader;if(t.type&&t.type!=="arraybuffer")throw new Error("THREE.GLTFLoader: "+t.type+" buffer type is not supported.");if(t.uri===void 0&&e===0)return Promise.resolve(this.extensions[rt.KHR_BINARY_GLTF].body);let n=this.options;return new Promise(function(r,o){i.load(Cn.resolveURL(t.uri,n.path),r,void 0,function(){o(new Error('THREE.GLTFLoader: Failed to load buffer "'+t.uri+'".'))})})}loadBufferView(e){let t=this.json.bufferViews[e];return this.getDependency("buffer",t.buffer).then(function(i){let n=t.byteLength||0,r=t.byteOffset||0;return i.slice(r,r+n)})}loadAccessor(e){let t=this,i=this.json,n=this.json.accessors[e];if(n.bufferView===void 0&&n.sparse===void 0){let o=ju[n.type],a=Nr[n.componentType],l=n.normalized===!0,c=new a(n.count*o);return Promise.resolve(new Ct(c,o,l))}let r=[];return n.bufferView!==void 0?r.push(this.getDependency("bufferView",n.bufferView)):r.push(null),n.sparse!==void 0&&(r.push(this.getDependency("bufferView",n.sparse.indices.bufferView)),r.push(this.getDependency("bufferView",n.sparse.values.bufferView))),Promise.all(r).then(function(o){let a=o[0],l=ju[n.type],c=Nr[n.componentType],h=c.BYTES_PER_ELEMENT,f=h*l,d=n.byteOffset||0,u=n.bufferView!==void 0?i.bufferViews[n.bufferView].byteStride:void 0,p=n.normalized===!0,x,m;if(u&&u!==f){let g=Math.floor(d/u),S="InterleavedBuffer:"+n.bufferView+":"+n.componentType+":"+g+":"+n.count,T=t.cache.get(S);T||(x=new c(a,g*u,n.count*u/h),T=new us(x,u/h),t.cache.add(S,T)),m=new Hn(T,l,d%u/h,p)}else a===null?x=new c(n.count*l):x=new c(a,d,n.count*l),m=new Ct(x,l,p);if(n.sparse!==void 0){let g=ju.SCALAR,S=Nr[n.sparse.indices.componentType],T=n.sparse.indices.byteOffset||0,_=n.sparse.values.byteOffset||0,v=new S(o[1],T,n.sparse.count*g),E=new c(o[2],_,n.sparse.count*l);a!==null&&(m=new Ct(m.array.slice(),m.itemSize,m.normalized)),m.normalized=!1;for(let A=0,y=v.length;A<y;A++){let R=v[A];if(m.setX(R,E[A*l]),l>=2&&m.setY(R,E[A*l+1]),l>=3&&m.setZ(R,E[A*l+2]),l>=4&&m.setW(R,E[A*l+3]),l>=5)throw new Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.")}m.normalized=p}return m})}loadTexture(e){let t=this.json,i=this.options,r=t.textures[e].source,o=t.images[r],a=this.textureLoader;if(o.uri){let l=i.manager.getHandler(o.uri);l!==null&&(a=l)}return this.loadTextureImage(e,r,a)}loadTextureImage(e,t,i){let n=this,r=this.json,o=r.textures[e],a=r.images[t],l=(a.uri||a.bufferView)+":"+o.sampler;if(this.textureCache[l])return this.textureCache[l];let c=this.loadImageSource(t,i).then(function(h){h.flipY=!1,h.name=o.name||a.name||"",h.name===""&&typeof a.uri=="string"&&a.uri.startsWith("data:image/")===!1&&(h.name=a.uri);let d=(r.samplers||{})[o.sampler]||{};return h.magFilter=Sm[d.magFilter]||It,h.minFilter=Sm[d.minFilter]||Gi,h.wrapS=wm[d.wrapS]||Xt,h.wrapT=wm[d.wrapT]||Xt,h.generateMipmaps=!h.isCompressedTexture&&h.minFilter!==bt&&h.minFilter!==It,n.associations.set(h,{textures:e}),h}).catch(function(){return null});return this.textureCache[l]=c,c}loadImageSource(e,t){let i=this,n=this.json,r=this.options;if(this.sourceCache[e]!==void 0)return this.sourceCache[e].then(f=>f.clone());let o=n.images[e],a=self.URL||self.webkitURL,l=o.uri||"",c=!1;if(o.bufferView!==void 0)l=i.getDependency("bufferView",o.bufferView).then(function(f){c=!0;let d=new Blob([f],{type:o.mimeType});return l=a.createObjectURL(d),l});else if(o.uri===void 0)throw new Error("THREE.GLTFLoader: Image "+e+" is missing URI and bufferView");let h=Promise.resolve(l).then(function(f){return new Promise(function(d,u){let p=d;t.isImageBitmapLoader===!0&&(p=function(x){let m=new Ot(x);m.needsUpdate=!0,d(m)}),t.load(Cn.resolveURL(f,r.path),p,void 0,u)})}).then(function(f){return c===!0&&a.revokeObjectURL(l),dn(f,o),f.userData.mimeType=o.mimeType||jM(o.uri),f}).catch(function(f){throw console.error("THREE.GLTFLoader: Couldn't load texture",l),f});return this.sourceCache[e]=h,h}assignTexture(e,t,i,n){let r=this;return this.getDependency("texture",i.index).then(function(o){if(!o)return null;if(i.texCoord!==void 0&&i.texCoord>0&&(o=o.clone(),o.channel=i.texCoord),r.extensions[rt.KHR_TEXTURE_TRANSFORM]){let a=i.extensions!==void 0?i.extensions[rt.KHR_TEXTURE_TRANSFORM]:void 0;if(a){let l=r.associations.get(o);o=r.extensions[rt.KHR_TEXTURE_TRANSFORM].extendTexture(o,a),r.associations.set(o,l)}}return n!==void 0&&(o.colorSpace=n),e[t]=o,o})}assignFinalMaterial(e){let t=e.geometry,i=e.material,n=t.attributes.tangent===void 0,r=t.attributes.color!==void 0,o=t.attributes.normal===void 0;if(e.isPoints){let a="PointsMaterial:"+i.uuid,l=this.cache.get(a);l||(l=new cr,ei.prototype.copy.call(l,i),l.color.copy(i.color),l.map=i.map,l.sizeAttenuation=!1,this.cache.add(a,l)),i=l}else if(e.isLine){let a="LineBasicMaterial:"+i.uuid,l=this.cache.get(a);l||(l=new Vn,ei.prototype.copy.call(l,i),l.color.copy(i.color),l.map=i.map,this.cache.add(a,l)),i=l}if(n||r||o){let a="ClonedMaterial:"+i.uuid+":";n&&(a+="derivative-tangents:"),r&&(a+="vertex-colors:"),o&&(a+="flat-shading:");let l=this.cache.get(a);l||(l=i.clone(),r&&(l.vertexColors=!0),o&&(l.flatShading=!0),n&&(l.normalScale&&(l.normalScale.y*=-1),l.clearcoatNormalScale&&(l.clearcoatNormalScale.y*=-1)),this.cache.add(a,l),this.associations.set(l,this.associations.get(i))),i=l}e.material=i}getMaterialType(){return Pt}loadMaterial(e){let t=this,i=this.json,n=this.extensions,r=i.materials[e],o,a={},l=r.extensions||{},c=[];if(l[rt.KHR_MATERIALS_UNLIT]){let f=n[rt.KHR_MATERIALS_UNLIT];o=f.getMaterialType(),c.push(f.extendParams(a,r,t))}else{let f=r.pbrMetallicRoughness||{};if(a.color=new Me(1,1,1),a.opacity=1,Array.isArray(f.baseColorFactor)){let d=f.baseColorFactor;a.color.setRGB(d[0],d[1],d[2],di),a.opacity=d[3]}f.baseColorTexture!==void 0&&c.push(t.assignTexture(a,"map",f.baseColorTexture,Mt)),a.metalness=f.metallicFactor!==void 0?f.metallicFactor:1,a.roughness=f.roughnessFactor!==void 0?f.roughnessFactor:1,f.metallicRoughnessTexture!==void 0&&(c.push(t.assignTexture(a,"metalnessMap",f.metallicRoughnessTexture)),c.push(t.assignTexture(a,"roughnessMap",f.metallicRoughnessTexture))),o=this._invokeOne(function(d){return d.getMaterialType&&d.getMaterialType(e)}),c.push(Promise.all(this._invokeAll(function(d){return d.extendMaterialParams&&d.extendMaterialParams(e,a)})))}r.doubleSided===!0&&(a.side=Dt);let h=r.alphaMode||Zu.OPAQUE;if(h===Zu.BLEND?(a.transparent=!0,a.depthWrite=!1):(a.transparent=!1,h===Zu.MASK&&(a.alphaTest=r.alphaCutoff!==void 0?r.alphaCutoff:.5)),r.normalTexture!==void 0&&o!==St&&(c.push(t.assignTexture(a,"normalMap",r.normalTexture)),a.normalScale=new ee(1,1),r.normalTexture.scale!==void 0)){let f=r.normalTexture.scale;a.normalScale.set(f,f)}if(r.occlusionTexture!==void 0&&o!==St&&(c.push(t.assignTexture(a,"aoMap",r.occlusionTexture)),r.occlusionTexture.strength!==void 0&&(a.aoMapIntensity=r.occlusionTexture.strength)),r.emissiveFactor!==void 0&&o!==St){let f=r.emissiveFactor;a.emissive=new Me().setRGB(f[0],f[1],f[2],di)}return r.emissiveTexture!==void 0&&o!==St&&c.push(t.assignTexture(a,"emissiveMap",r.emissiveTexture,Mt)),Promise.all(c).then(function(){let f=new o(a);return r.name&&(f.name=r.name),dn(f,r),t.associations.set(f,{materials:e}),r.extensions&&Rs(n,f,r),f})}createUniqueName(e){let t=yt.sanitizeNodeName(e||"");return t in this.nodeNamesUsed?t+"_"+ ++this.nodeNamesUsed[t]:(this.nodeNamesUsed[t]=0,t)}loadGeometries(e){let t=this,i=this.extensions,n=this.primitiveCache;function r(a){return i[rt.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(a,t).then(function(l){return Tm(l,a,t)})}let o=[];for(let a=0,l=e.length;a<l;a++){let c=e[a],h=YM(c),f=n[h];if(f)o.push(f.promise);else{let d;c.extensions&&c.extensions[rt.KHR_DRACO_MESH_COMPRESSION]?d=r(c):d=Tm(new _t,c,t),c.mode===Ui.TRIANGLE_STRIP?d=d.then(u=>Bu(u,Yo)):c.mode===Ui.TRIANGLE_FAN&&(d=d.then(u=>Bu(u,yr))),n[h]={primitive:c,promise:d},o.push(d)}}return Promise.all(o)}loadMesh(e){let t=this,i=this.json,n=this.extensions,r=i.meshes[e],o=r.primitives,a=[];for(let l=0,c=o.length;l<c;l++){let h=o[l].material===void 0?WM(this.cache):this.getDependency("material",o[l].material);a.push(h)}return a.push(t.loadGeometries(o)),Promise.all(a).then(async function(l){let c=l.slice(0,l.length-1),h=l[l.length-1],f=[];for(let u=0,p=h.length;u<p;u++){let x=h[u],m=o[u],g,S=c[u];if(m.mode===Ui.TRIANGLES||m.mode===Ui.TRIANGLE_STRIP||m.mode===Ui.TRIANGLE_FAN||m.mode===void 0){let T=r.isSkinnedMesh===!0,_=x.hasAttribute("skinIndex")&&x.hasAttribute("skinWeight");T&&_===!1&&console.warn("THREE.GLTFLoader: Missing skinIndex or skinWeight attributes. Skinning disabled."),g=T&&_?new so(x,S):new De(x,S),g.isSkinnedMesh===!0&&g.normalizeSkinWeights()}else if(m.mode===Ui.LINES)g=new ps(x,S);else if(m.mode===Ui.LINE_STRIP)g=new fs(x,S);else if(m.mode===Ui.LINE_LOOP)g=new oo(x,S);else if(m.mode===Ui.POINTS)g=new ao(x,S);else throw new Error("THREE.GLTFLoader: Primitive mode unsupported: "+m.mode);Object.keys(g.geometry.morphAttributes).length>0&&qM(g,r),g.name=t.createUniqueName(r.name||"mesh_"+e),dn(g,r),m.extensions&&Rs(n,g,m),t.assignFinalMaterial(g),f.push(g)}for(let u=0,p=f.length;u<p;u++)t.associations.set(f[u],{meshes:e,primitives:u});if(f.length===1)return r.extensions&&Rs(n,f[0],r),f[0];let d=new Gt;r.extensions&&Rs(n,d,r),t.associations.set(d,{meshes:e});for(let u=0,p=f.length;u<p;u++)d.add(f[u]);return d})}loadCamera(e){let t,i=this.json.cameras[e],n=i[i.type];if(!n){console.warn("THREE.GLTFLoader: Missing camera parameters.");return}return i.type==="perspective"?t=new Ut(jo.radToDeg(n.yfov),n.aspectRatio||1,n.znear||1,n.zfar||2e6):i.type==="orthographic"&&(t=new bi(-n.xmag,n.xmag,n.ymag,-n.ymag,n.znear,n.zfar)),i.name&&(t.name=this.createUniqueName(i.name)),dn(t,i),Promise.resolve(t)}loadSkin(e){let t=this.json.skins[e],i=[];for(let n=0,r=t.joints.length;n<r;n++)i.push(this._loadNodeShallow(t.joints[n]));return t.inverseBindMatrices!==void 0?i.push(this.getDependency("accessor",t.inverseBindMatrices)):i.push(null),Promise.all(i).then(function(n){let r=n.pop(),o=n,a=[],l=[];for(let c=0,h=o.length;c<h;c++){let f=o[c];if(f){a.push(f);let d=new We;r!==null&&d.fromArray(r.array,c*16),l.push(d)}else console.warn('THREE.GLTFLoader: Joint "%s" could not be found.',t.joints[c])}return new ro(a,l)})}loadAnimation(e){let t=this.json,i=this,n=t.animations[e],r=n.name?n.name:"animation_"+e,o=[],a=[],l=[],c=[],h=[];for(let f=0,d=n.channels.length;f<d;f++){let u=n.channels[f],p=n.samplers[u.sampler],x=u.target,m=x.node,g=n.parameters!==void 0?n.parameters[p.input]:p.input,S=n.parameters!==void 0?n.parameters[p.output]:p.output;x.node!==void 0&&(o.push(this.getDependency("node",m)),a.push(this.getDependency("accessor",g)),l.push(this.getDependency("accessor",S)),c.push(p),h.push(x))}return Promise.all([Promise.all(o),Promise.all(a),Promise.all(l),Promise.all(c),Promise.all(h)]).then(function(f){let d=f[0],u=f[1],p=f[2],x=f[3],m=f[4],g=[];for(let T=0,_=d.length;T<_;T++){let v=d[T],E=u[T],A=p[T],y=x[T],R=m[T];if(v===void 0)continue;v.updateMatrix&&v.updateMatrix();let I=i._createAnimationTracks(v,E,A,y,R);if(I)for(let L=0;L<I.length;L++)g.push(I[L])}let S=new So(r,void 0,g);return dn(S,n),S})}createNodeMesh(e){let t=this.json,i=this,n=t.nodes[e];return n.mesh===void 0?null:i.getDependency("mesh",n.mesh).then(function(r){let o=i._getNodeRef(i.meshCache,n.mesh,r);return n.weights!==void 0&&o.traverse(function(a){if(a.isMesh)for(let l=0,c=n.weights.length;l<c;l++)a.morphTargetInfluences[l]=n.weights[l]}),o})}loadNode(e){let t=this.json,i=this,n=t.nodes[e],r=i._loadNodeShallow(e),o=[],a=n.children||[];for(let c=0,h=a.length;c<h;c++)o.push(i.getDependency("node",a[c]));let l=n.skin===void 0?Promise.resolve(null):i.getDependency("skin",n.skin);return Promise.all([r,Promise.all(o),l]).then(function(c){let h=c[0],f=c[1],d=c[2];d!==null&&h.traverse(function(u){u.isSkinnedMesh&&u.bind(d,ZM)});for(let u=0,p=f.length;u<p;u++)h.add(f[u]);if(h.userData.pivot!==void 0&&f.length>0){let u=h.userData.pivot,p=f[0];h.pivot=new D().fromArray(u),h.position.x-=u[0],h.position.y-=u[1],h.position.z-=u[2],p.position.set(0,0,0),delete h.userData.pivot}return h})}_loadNodeShallow(e){let t=this.json,i=this.extensions,n=this;if(this.nodeCache[e]!==void 0)return this.nodeCache[e];let r=t.nodes[e],o=r.name?n.createUniqueName(r.name):"",a=[],l=n._invokeOne(function(c){return c.createNodeMesh&&c.createNodeMesh(e)});return l&&a.push(l),r.camera!==void 0&&a.push(n.getDependency("camera",r.camera).then(function(c){return n._getNodeRef(n.cameraCache,r.camera,c)})),n._invokeAll(function(c){return c.createNodeAttachment&&c.createNodeAttachment(e)}).forEach(function(c){a.push(c)}),this.nodeCache[e]=Promise.all(a).then(function(c){let h;if(r.isBone===!0?h=new ar:c.length>1?h=new Gt:c.length===1?h=c[0]:h=new Rt,h!==c[0])for(let f=0,d=c.length;f<d;f++)h.add(c[f]);if(r.name&&(h.userData.name=r.name,h.name=o),dn(h,r),r.extensions&&Rs(i,h,r),r.matrix!==void 0){let f=new We;f.fromArray(r.matrix),h.applyMatrix4(f)}else r.translation!==void 0&&h.position.fromArray(r.translation),r.rotation!==void 0&&h.quaternion.fromArray(r.rotation),r.scale!==void 0&&h.scale.fromArray(r.scale);if(!n.associations.has(h))n.associations.set(h,{});else if(r.mesh!==void 0&&n.meshCache.refs[r.mesh]>1){let f=n.associations.get(h);n.associations.set(h,{...f})}return n.associations.get(h).nodes=e,h}),this.nodeCache[e]}loadScene(e){let t=this.extensions,i=this.json.scenes[e],n=this,r=new Gt;i.name&&(r.name=n.createUniqueName(i.name)),dn(r,i),i.extensions&&Rs(t,r,i);let o=i.nodes||[],a=[];for(let l=0,c=o.length;l<c;l++)a.push(n.getDependency("node",o[l]));return Promise.all(a).then(function(l){for(let h=0,f=l.length;h<f;h++){let d=l[h];d.parent!==null?r.add(ym(d)):r.add(d)}let c=h=>{let f=new Map;for(let[d,u]of n.associations)(d instanceof ei||d instanceof Ot)&&f.set(d,u);return h.traverse(d=>{let u=n.associations.get(d);u!=null&&f.set(d,u)}),f};return n.associations=c(r),r})}_createAnimationTracks(e,t,i,n,r){let o=[],a=e.name?e.name:e.uuid,l=[];function c(u){u.morphTargetInfluences&&l.push(u.name?u.name:u.uuid)}ts[r.path]===ts.weights?(c(e),e.isGroup&&e.children.forEach(c)):l.push(a);let h;switch(ts[r.path]){case ts.weights:h=wn;break;case ts.rotation:h=Tn;break;case ts.translation:case ts.scale:h=Xn;break;default:switch(i.itemSize){case 1:h=wn;break;case 2:case 3:default:h=Xn;break}break}let f=n.interpolation!==void 0?GM[n.interpolation]:cs,d=this._getArrayFromAccessor(i);for(let u=0,p=l.length;u<p;u++){let x=new h(l[u]+"."+ts[r.path],t.array,d,f);n.interpolation==="CUBICSPLINE"&&this._createCubicSplineTrackInterpolant(x),o.push(x)}return o}_getArrayFromAccessor(e){let t=e.array;if(e.normalized){let i=yd(t.constructor),n=new Float32Array(t.length);for(let r=0,o=t.length;r<o;r++)n[r]=t[r]*i;t=n}return t}_createCubicSplineTrackInterpolant(e){e.createInterpolant=function(i){let n=this instanceof Tn?_d:Xc;return new n(this.times,this.values,this.getValueSize()/3,i)},e.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=!0}};function KM(s,e,t){let i=e.attributes,n=new oi;if(i.POSITION!==void 0){let a=t.json.accessors[i.POSITION],l=a.min,c=a.max;if(l!==void 0&&c!==void 0){if(n.set(new D(l[0],l[1],l[2]),new D(c[0],c[1],c[2])),a.normalized){let h=yd(Nr[a.componentType]);n.min.multiplyScalar(h),n.max.multiplyScalar(h)}}else{console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");return}}else return;let r=e.targets;if(r!==void 0){let a=new D,l=new D;for(let c=0,h=r.length;c<h;c++){let f=r[c];if(f.POSITION!==void 0){let d=t.json.accessors[f.POSITION],u=d.min,p=d.max;if(u!==void 0&&p!==void 0){if(l.setX(Math.max(Math.abs(u[0]),Math.abs(p[0]))),l.setY(Math.max(Math.abs(u[1]),Math.abs(p[1]))),l.setZ(Math.max(Math.abs(u[2]),Math.abs(p[2]))),d.normalized){let x=yd(Nr[d.componentType]);l.multiplyScalar(x)}a.max(l)}else console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.")}}n.expandByVector(a)}s.boundingBox=n;let o=new mi;n.getCenter(o.center),o.radius=n.min.distanceTo(n.max)/2,s.boundingSphere=o}function Tm(s,e,t){let i=e.attributes,n=[];function r(o,a){return t.getDependency("accessor",o).then(function(l){s.setAttribute(a,l)})}for(let o in i){let a=vd[o]||o.toLowerCase();a in s.attributes||n.push(r(i[o],a))}if(e.indices!==void 0&&!s.index){let o=t.getDependency("accessor",e.indices).then(function(a){s.setIndex(a)});n.push(o)}return tt.workingColorSpace!==di&&"COLOR_0"in i&&console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${tt.workingColorSpace}" not supported.`),dn(s,e),KM(s,e,t),Promise.all(n).then(function(){return e.targets!==void 0?XM(s,e.targets,t):s})}var JM={carpet:.9,carpetWhite:.85,wood:.55,woodDark:.55,metal:.35,metalLight:.3,metalMedium:.35,metalDark:.4,plant:.8,lamp:.6,glass:.1,_defaultMat:.6},QM=35*Math.PI/180,$M={"sofa.3seat":{file:"assets/models/loungeSofa.glb",slots:{carpet:"fabric_accent",wood:"wood_dark"}},"chair.basic":{file:"assets/models/chair.glb",slots:{wood:"wood_dark"}},"chair.office":{file:"assets/models/chairDesk.glb",slots:{carpet:"leather",metalMedium:"metal_dark"}},"table.dining":{file:"assets/models/table.glb",slots:{wood:"oak"}},"table.coffee":{file:"assets/models/tableCoffee.glb",slots:{wood:"wood_dark"}},"table.desk":{file:"assets/models/desk.glb",slots:{wood:"wood_light",metal:"metal_dark"}},"cabinet.tv":{file:"assets/models/cabinetTelevision.glb",slots:{wood:"wood_dark"}},"cabinet.bookcase":{file:"assets/models/bookcaseOpen.glb",slots:{wood:"wood_dark"}},"cabinet.wardrobe":{file:"assets/models/cabinetBed.glb",slots:{wood:"wood_light",metal:"metal_light"}},"cabinet.low":{file:"assets/models/cabinetBedDrawer.glb",slots:{wood:"wood_light",metal:"metal_light",_defaultMat:"wood_dark"}},"bed.double":{file:"assets/models/bedDouble.glb",slots:{wood:"wood_light",metal:"metal_light",carpetWhite:"linen",carpet:"fabric_grey"}},"bed.single":{file:"assets/models/bedSingle.glb",slots:{wood:"wood_light",metal:"metal_light",carpetWhite:"linen",carpet:"fabric_grey"}},"kitchen.fridge":{file:"assets/models/kitchenFridgeLarge.glb",slots:{metalLight:"metal_light",metalMedium:"metal_dark"}},"plant.pot":{file:"assets/models/plantSmall1.glb",slots:{wood:"concrete",plant:"grass"}},"sanitary.wc":{file:"assets/models/toilet.glb",slots:{carpetWhite:"tiles_white",metalLight:"metal_light",metalDark:"metal_dark",_defaultMat:"tiles_white"}},"sanitary.basin":{file:"assets/models/bathroomSink.glb",slots:{carpetWhite:"tiles_white",metalLight:"metal_light",_defaultMat:"tiles_white"}},"sanitary.tub":{file:"assets/models/bathtub.glb",slots:{carpetWhite:"tiles_white",metalLight:"metal_light",metalDark:"metal_dark"}},"appliance.washer":{file:"assets/models/washerDryerStacked.glb",slots:{metalMedium:"metal_light",metalLight:"metal_light",metalDark:"metal_dark",metal:"metal_dark",glass:"metal_dark",_defaultMat:"metal_light"}}},qc=class{constructor(e,t={}){this.lib=e,this.loader=new Gc,this.cache=new Map,this.pending=new Map,this.onLoaded=t.onLoaded||null,this.testModel=!!t.testModel,this.manifest=$M}template(e){if(this.cache.has(e))return this.cache.get(e);let t=this.manifest[e];if(!t)return this.cache.set(e,null),null;if(this.testModel){let i=this.makeTestModel(e);return this.cache.set(e,i),i}if(!this.pending.has(e)){let i=new Promise(n=>{this.loader.load(t.file,r=>{let o=r.scene;o.traverse(l=>{if(l.isMesh){let c=l.geometry.index?l.geometry.toNonIndexed():l.geometry;l.geometry=$p(c,QM)}}),o.updateMatrixWorld(!0);let a=new oi().setFromObject(o);this.cache.set(e,{scene:o,bbox:a,row:t}),n(!0),this.onLoaded&&this.onLoaded(e)},void 0,()=>{this.cache.set(e,null),n(!1)})});this.pending.set(e,i)}}makeTestModel(e){let t=this.manifest[e],i=new Gt,n=Object.keys(t.slots),r=new De(new Xi(1,1,1,2,.08),new Pt({name:n[0]}));if(r.position.y=.5,i.add(r),n[1]){let o=new De(new Xi(.9,.12,.9,2,.04),new Pt({name:n[1]}));o.position.y=1,i.add(o)}return i.updateMatrixWorld(!0),{scene:i,bbox:new oi().setFromObject(i),row:t,test:!0}}place(e,t,i,n,r,o,a,l,c){let h=this.template(e);if(!h)return!1;let f=new D;h.bbox.getSize(f);let{w_m:d,d_m:u,h_m:p}=t.size,x=new D(f.x>1e-6?d/f.x:1,f.y>1e-6?p/f.y:1,f.z>1e-6?u/f.z:1),m=Math.min(x.x,x.y,x.z),g=Math.min(x.x,m*1.15),S=Math.min(x.y,m*1.15),T=Math.min(x.z,m*1.15),_=new D;h.bbox.getCenter(_);let v=new We().compose(new D(i,n,r),new Qt().setFromAxisAngle(new D(0,1,0),o),new D(g,S,T));v.multiply(new We().makeTranslation(-_.x,-h.bbox.min.y,-_.z));let E=1+(Math.sin((i*12.9898+r*78.233)*43758.5453)%1*.1-.05);this.pending=this.pending||new Map;let A=`${l.id}|${e}`;return this.pending.has(A)||this.pending.set(A,{itemId:e,group:a,L:l,list:[]}),this.pending.get(A).list.push({matrix:v,jitter:E,o:t}),!0}flush(e){if(this.pending)for(let[t,i]of[...this.pending]){if(!t.startsWith(`${e}|`))continue;this.pending.delete(t);let n=this.template(i.itemId);if(!n)continue;let r=[];n.scene.traverse(o=>{o.isMesh&&r.push(o)});for(let o of r){let a=o.material&&o.material.name,l=n.row.slots&&n.row.slots[a]||"wood_light",c=this.lib.get(l,3,{roughness:JM[a]??.6}),h=new ds(o.geometry,c,i.list.length),f=o.matrixWorld.clone(),d=new We;i.list.forEach((u,p)=>{d.multiplyMatrices(u.matrix,f),h.setMatrixAt(p,d),h.setColorAt(p,new Me(u.jitter,u.jitter,u.jitter))}),h.instanceMatrix.needsUpdate=!0,h.instanceColor&&(h.instanceColor.needsUpdate=!0),h.castShadow=!0,h.receiveShadow=!0,h.userData={kind:"model",item:i.itemId,test:!!n.test,count:i.list.length},i.group.add(h)}}}};var Yc={3:"\u05E8\u05D9\u05D0\u05DC\u05D9\u05E1\u05D8\u05D9",2:"\u05DE\u05DC\u05D0",1:"\u05E1\u05DB\u05DE\u05D8\u05D9",0:"\u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DE\u05D5\u05DB\u05E0\u05D5\u05EA"},jc="\u05E8\u05D9\u05D0\u05DC\u05D9\u05E1\u05D8\u05D9 \u05E7\u05DC",Zc=[[3,!1],[3,!0],[2,!1],[1,!1],[0,!1]],Am=[["clear","\u05D1\u05D4\u05D9\u05E8"],["hazy","\u05D0\u05D5\u05D1\u05DA"],["overcast","\u05DE\u05E2\u05D5\u05E0\u05DF"]],bd=30,Sd=2500,eb=30,Ye=s=>document.getElementById(s),se=(s,e,t)=>{let i=document.createElement(s);return e&&(i.className=e),t!==void 0&&(i.textContent=t),i},tb={id:"fixture-sample-v2",title:"sample-v2.json (\u05E7\u05D5\u05D1\u05E5 \u05D4\u05D1\u05D3\u05D9\u05E7\u05D4 \u05E9\u05DC \u05D4\u05E8\u05D9\u05E4\u05D5)",doc:vm,zones:[],anchors:[],entities:{"light.store":"on","switch.hall_a":"on","lock.store":"locked"},coverPositions:{},entityNames:{"light.store":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05DE\u05D7\u05E1\u05DF","lock.store":"\u05DE\u05E0\u05E2\u05D5\u05DC \u05DE\u05D7\u05E1\u05DF"},doorLocks:{}},Kc=[_m,tb],Jc=class{constructor(e={}){this.stage=Ye("stage"),this.canvas=Ye("gl"),this.env=new zc(this.canvas,{maxDpr:2}),this.env.backdrop=this.stage,this.styleChoice=(()=>{try{return localStorage.getItem("studio6.style")||"auto"}catch{return"auto"}})(),this.style=this.resolveStyle(),this.env.style=this.style,this.settings=Object.assign({eyeHeight:om,mouseMode:"drag",furnitureMode:"models",textureSource:"files",defaultView:"schematic",wallDisplay:"live",timeSource:"clock",showTemps:!1,sectionCut:!0,motion:!0},(()=>{try{return JSON.parse(localStorage.getItem("studio6.settings")||"{}")}catch{return{}}})()),/[?&]procedural/.test(location.search)&&(this.settings.textureSource="procedural",this.settings.furnitureMode="procedural"),this.lib=new wc(this.style,{textureSource:this.settings.textureSource,onLoaded:()=>this.invalidate()}),this.planScene=new Rc(this.lib),this.hudOn=/[?&]hud/.test(location.search),this.planScene._reflector={Reflector:Qo},this.env.scene.add(this.planScene.root),this.planScene.models=new qc(this.lib,{onLoaded:()=>{this.rebuild(),this.makeThumbs()},testModel:/[?&]testmodels/.test(location.search)}),this.baker=new Vc(this.env,this.planScene),this.quality=3,this.lite=!1,this.mode="orbit",this.levelMode=null,this.preset="iso",this.opts={reflections:!1,ao:!0,bloom:!0,lampShadows:!1,autoLadder:!0,dprCap:1.25,idleS:eb,pointerLock:!1},this.tween=null,this.planScene.furnitureMode=this.settings.furnitureMode,this.fps={ema:0,ms:0,frames:0,last:performance.now(),window:[]},this.needsFrame=!0,this.continuous=!1,this.lastInput=performance.now(),this.touch=!1,this.hover=null,this.raycaster=new Po,this.walk=null,this.savedPositions=[],this.probe=null,this.fallbackNote=null,this.bakes={},this.thumbs={},this.presenceTimers={},this.setupCameras(),this.bindUI(),e.defer||this.boot()}boot(){this.loadPlan(Kc[0]),this.resize(),window.addEventListener("resize",()=>this.resize()),requestAnimationFrame(e=>this.frame(e))}resolveStyle(){return this.styleChoice==="auto"?Yp(document.documentElement.dataset.theme):_i[this.styleChoice]||_i.light}setStyle(e){this.styleChoice=e;try{localStorage.setItem("studio6.style",e)}catch{}this.style=this.resolveStyle(),this.planScene.setStyle(this.style),this.env.setStyle(this.style),this.env.buildComposer(this.camera),this.planScene.setNight(this.env.recipe.night),this.applyCut(),document.documentElement.dataset.style=this.style.id,this.applyGrade(),this.renderStyleChip&&this.renderStyleChip(),this.makeThumbs(),this.invalidate()}applyGrade(){let e=this.style.post,t=this.stage.style;t.setProperty("--vignette",String(e.vignette??0)),t.setProperty("--vignette-color",this.style.id==="dark"?"rgba(0,0,0,.6)":"rgba(20,24,32,.42)"),t.setProperty("--grade-contrast",String(e.contrast??1)),t.setProperty("--grade-saturation",String(e.saturation??1))}applyCut(){if(this.mode!=="orbit"||this.quality<2||!this.plan||!this.settings.sectionCut){this.planScene.setCut(null);return}let e=this.plan.doc.levels.map(n=>n.id),t=this.levelMode==="all"||!this.levelMode?e[e.length-1]:this.levelMode,i=this.planScene.levels[t];if(!i){this.planScene.setCut(null);return}this.planScene.setCut(i.elevation+i.ceiling*this.style.cut.fraction,t),this.shadowDirty=!0}setupCameras(){this.persp=new Ut(42,1,.05,300),this.ortho=new bi(-10,10,10,-10,-100,300),this.walkCam=new Ut(62,1,.05,200),this.camera=this.ortho,this.controls=null}makeControls(e){this.controls&&this.controls.dispose();let t=new Mc(e,this.canvas);t.enableDamping=!0,t.dampingFactor=.12,t.maxPolarAngle=Math.PI/2-.03,t.minDistance=2,t.maxDistance=120,t.addEventListener("change",()=>this.invalidate(!1)),t.addEventListener("start",()=>this.userInput()),this.controls=t}saveSettings(){try{localStorage.setItem("studio6.settings",JSON.stringify(this.settings))}catch{}}fitCamera(e,t=this.settings.motion&&!!this.plan&&this.mode==="orbit"){let i=this.camera&&this.controls?{cam:this.camera,pos:this.camera.position.clone(),target:this.controls.target.clone(),half:this.ortho.top}:null;if(this.fitCameraNow(e),!t||!i)return;if(i.cam!==this.camera){this.flash(.6);return}let n={pos:this.camera.position.clone(),target:this.controls.target.clone(),half:this.ortho.top},r=this.camera,o=this.controls,a=this.canvas.clientWidth/Math.max(1,this.canvas.clientHeight);this.tween={t0:performance.now(),ms:520,step:l=>{if(r.position.lerpVectors(i.pos,n.pos,l),o.target.lerpVectors(i.target,n.target,l),r===this.ortho){let c=i.half+(n.half-i.half)*l;r.left=-c*a,r.right=c*a,r.top=c,r.bottom=-c,r.updateProjectionMatrix()}o.update()}},o.enabled=!1}flash(e=.5){if(!this.settings.motion)return;let t=Ye("fade");t.style.transition="opacity .12s",t.style.opacity=String(e),setTimeout(()=>{t.style.transition="opacity .28s cubic-bezier(.2,.7,.2,1)",t.style.opacity="0"},130)}fitCameraNow(e){this.preset=e;let t=this.visibleExtent(),i=(t.minX+t.maxX)/2,n=(t.minZ+t.maxZ)/2,r=t.maxX-t.minX,o=t.maxZ-t.minZ,a=t.top,l=Math.hypot(r,o,a)/2,c=new D(i,t.base+a*.35,n),h;if(e==="persp"){h=this.persp;let f=l/Math.tan(h.fov*Math.PI/360)*1.15;h.position.set(i+f*.62,c.y+f*.55,n+f*.62)}else if(e==="top")h=this.ortho,h.position.set(i,c.y+60,n+.001);else{h=this.ortho;let f=60;h.position.set(i+f*.577,c.y+f*.577,n+f*.577)}if(h===this.ortho){let f=this.canvas.clientWidth/Math.max(1,this.canvas.clientHeight),d=l*1.08;h.left=-d*f,h.right=d*f,h.top=d,h.bottom=-d,h.zoom=1,h.updateProjectionMatrix()}h.lookAt(c),this.camera=h,this.makeControls(h),this.controls.target.copy(c),this.controls.update(),this.env.setCamera(h),this.invalidate()}visibleExtent(){let e=Object.values(this.planScene.levels).filter(n=>n.group.visible&&n.extent),t=e.length?e:Object.values(this.planScene.levels).filter(n=>n.extent),i={minX:1/0,maxX:-1/0,minZ:1/0,maxZ:-1/0,base:1/0,top:0};for(let n of t)i.minX=Math.min(i.minX,n.extent.minX),i.maxX=Math.max(i.maxX,n.extent.maxX),i.minZ=Math.min(i.minZ,n.extent.minZ),i.maxZ=Math.max(i.maxZ,n.extent.maxZ),i.base=Math.min(i.base,n.elevation),i.top=Math.max(i.top,n.elevation+n.ceiling);return Number.isFinite(i.minX)?i:{minX:0,maxX:10,minZ:0,maxZ:10,base:0,top:3}}resize(){let e=this.stage.getBoundingClientRect(),t=Math.max(1,Math.round(e.width)),i=Math.max(1,Math.round(e.height));this.env.dpr=Math.min(this.quality===3&&this.lite?1:this.opts.dprCap,window.devicePixelRatio||1),this.env.renderer.setPixelRatio(this.env.dpr),this.env.setSize(t,i);for(let n of[this.persp,this.walkCam])n.aspect=t/i,n.updateProjectionMatrix();if(this.ortho){let n=this.ortho.top;this.ortho.left=-n*(t/i),this.ortho.right=n*(t/i),this.ortho.updateProjectionMatrix()}this.invalidate()}loadPlan(e){this.plan=e,this.entities={...e.entities},this.coverPositions={...e.coverPositions||{}},e.entities=this.entities,e.coverPositions=this.coverPositions,Ye("crumb-floor").textContent=e.title;let t=e.doc.x_proto||{};this.env.setTime({north:t.north_deg||0,latitude:t.latitude||32}),this.savedPositions=(t.walk_positions||[]).map(n=>({...n})),this.bakes={},this.rebuild();let i=e.doc.levels.find(n=>n.is_default)||e.doc.levels[0];this.setLevelMode(i.id),this.fitCamera("iso"),this.buildStatesPanel(),this.buildWalkPanel(),this.buildQualityPanel(),this.buildStrip(),this.makeThumbs(),this.startProbe()}qualityLabel(){return this.quality===3&&this.lite?jc:Yc[this.quality]}rebuild(){if(this.quality===0)return;let e=this.quality===3&&this.lite;this.planScene.maxLights=this.quality>=3?8:6,this.planScene.lite=e,this.planScene.build(this.plan,this.quality,{reflections:this.opts.reflections&&this.quality>=3&&!e&&!this.touch,lampShadows:this.opts.lampShadows&&this.quality>=3&&!e&&!this.touch});let t=this.visibleExtent();this.env.post.lite=e,this.env.fitShadows(t,t.top),this.env.setQuality(this.quality,this.camera||this.ortho),this.resize(),this.walk&&(this.walk.scene=this.planScene),this.planScene.showLevel(this.levelMode||"all",this.mode==="walk"),this.planScene.setNight(this.env.recipe.night),this.applyCut(),this.invalidate()}setLevelMode(e){if(this.levelMode=e,this.planScene.showLevel(e,this.mode==="walk"),this.applyCut(),this.buildStrip(),this.invalidate(),this.mode==="orbit"){let t=this.visibleExtent();this.env.fitShadows(t,t.top)}this.mode==="stills"&&this.showStills()}setQuality(e,t,i=!1){if(e===this.quality&&i===this.lite)return;let n=this.quality,r=this.lite;if(this.quality=e,this.lite=e===3&&i,e===0){if(!this.bakes[this.currentLevelId()]){this.quality=n,this.lite=r,this.toast("\u05D0\u05D9\u05DF \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DE\u05D5\u05DB\u05E0\u05D5\u05EA \u05DC\u05E7\u05D5\u05DE\u05D4 \u2014 \u05D4\u05DB\u05DF \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05EA\u05D7\u05D9\u05DC\u05D4");return}this.lastLiveQuality=n,this.lastLiveLite=r,this.enterStills()}else this.mode==="stills"&&this.exitStills(!1),this.rebuild(),this.makeThumbs();this.renderBar(),this.renderLadder(),t&&this.setNote(t),e>0&&this.startProbe()}startProbe(){!this.opts.autoLadder||this.quality===0||(this.probe={start:null,frames:0,warm:0},this.continuous=!0,this.invalidate())}probeFrame(e){let t=this.probe;if(!t)return;if(t.warm<3){t.warm++;return}if(t.start===null){t.start=e,t.frames=0;return}t.frames++;let i=e-t.start;if(i>=Sd){let n=t.frames*1e3/i;this.probe=null,this.continuous=this.mode==="walk",this.lastProbe={fps:Math.round(n),quality:this.quality,label:this.qualityLabel()};let r=Zc.findIndex(([a,l])=>a===this.quality&&l===this.lite),o=Zc[r+1];if(n<bd&&o&&(o[0]>0||this.bakes[this.currentLevelId()])){let a=this.qualityLabel(),l=o[0]===3&&o[1]?jc:Yc[o[0]];this.fallbackNote=`${a} \u05E0\u05DE\u05D3\u05D3 ${Math.round(n)} fps (\u05DE\u05EA\u05D7\u05EA \u05DC\u05BE${bd}) \u2014 \u05D9\u05E8\u05D3\u05E0\u05D5 \u05DC"${l}" \u05DC\u05D4\u05DE\u05E9\u05DA \u05D4\u05D4\u05E4\u05E2\u05DC\u05D4`,this.setQuality(o[0],this.fallbackNote,o[1]),this.stage.dataset.fallback=String(r+1)}else this.setNote(`${this.qualityLabel()} \xB7 \u05E0\u05DE\u05D3\u05D3 ${Math.round(n)} fps \u05D1\u05BE${Sd/1e3} \u05E9\u05F3 \u2014 \u05E0\u05E9\u05D0\u05E8`);this.renderLadder()}}setNote(e,t=!1,i=6e3){let n=Ye("note");n.hidden=!e,n.textContent=e||"",n.classList.toggle("danger",t),clearTimeout(this._noteT),e&&!t&&i>0&&(this._noteT=setTimeout(()=>{n.hidden=!0},i))}toast(e){this.setNote(e,!1,3500)}toOrbit(e){if(this.mode==="walk"){this.orbitState={...this.orbitState||{},preset:e},this.exitWalk();return}this.mode==="stills"&&this.exitStills(!0),this.fitCamera(e),this.renderBar()}bindUI(){let e=Ye("plan-select");for(let l of Kc){let c=se("option","",l.title);c.value=l.id,e.appendChild(c)}e.addEventListener("change",()=>{this.mode==="walk"&&this.exitWalk(),this.mode==="stills"&&this.exitStills(!1),this.loadPlan(Kc.find(l=>l.id===e.value))}),Ye("theme-toggle").addEventListener("click",()=>{let l=document.documentElement;l.dataset.theme=l.dataset.theme==="dark"?"":"dark",this.styleChoice==="auto"&&this.setStyle("auto")});let t=Ye("style-select");if(t){for(let[l,c]of[["auto","\u05E1\u05D2\u05E0\u05D5\u05DF: \u05DC\u05E4\u05D9 \u05E2\u05E8\u05DB\u05EA \u05E0\u05D5\u05E9\u05D0"],["light",`\u05E1\u05D2\u05E0\u05D5\u05DF: ${_i.light.name}`],["dark",`\u05E1\u05D2\u05E0\u05D5\u05DF: ${_i.dark.name}`]]){let h=se("option","",c);h.value=l,t.appendChild(h)}t.value=this.styleChoice,t.addEventListener("change",()=>this.setStyle(t.value)),this.renderStyleChip=()=>{t.value=this.styleChoice}}document.documentElement.dataset.style=this.style.id,this.applyGrade(),Ye("hud").classList.toggle("on",this.hudOn);let n=Ye("sun-slider");n.addEventListener("input",()=>{this.env.setTime({hour:n.value/60}),this.updateSunCard(),this.invalidate(),this.userInput()}),Ye("sun-now").addEventListener("click",()=>{let l=new Date;n.value=l.getHours()*60+l.getMinutes();let c=new Date(l.getFullYear(),0,0);this.env.setTime({hour:n.value/60,day:Math.floor((l-c)/864e5)}),this.updateSunCard(),this.invalidate()});let r=Ye("weather");for(let[l,c]of Am){let h=se("button","chip",c);h.dataset.w=l,h.addEventListener("click",()=>{this.env.setTime({weather:l}),this.updateSunCard(),this.invalidate()}),r.appendChild(h)}for(let[l,c]of[["\u05E6\u05D4\u05E8\u05D9\u05D9\u05DD",12.5],["\u05E9\u05E7\u05D9\u05E2\u05D4",18.2],["\u05DC\u05D9\u05DC\u05D4",22.5]]){let h=se("button","chip",l);h.addEventListener("click",()=>{n.value=c*60,this.env.setTime({hour:c}),this.updateSunCard(),this.invalidate()}),r.appendChild(h)}this.env.onTime=()=>{this.updateSunCard(),this.planScene&&this.planScene.setNight(this.env.recipe.night)},this.env.setTime({hour:n.value/60,day:278}),document.querySelectorAll(".tabs button").forEach(l=>l.addEventListener("click",()=>{document.querySelectorAll(".tabs button").forEach(c=>c.classList.toggle("sel",c===l)),document.querySelectorAll(".panel").forEach(c=>c.classList.toggle("sel",c.dataset.panel===l.dataset.tab))})),Ye("mobile-toggle").addEventListener("click",()=>Ye("aside").classList.toggle("open")),Ye("sheet-handle").addEventListener("click",()=>Ye("aside").classList.remove("open")),Ye("sun-row").addEventListener("click",l=>{l.target.id!=="sun-now"&&Ye("sun-card").classList.toggle("open")}),Ye("labels").classList.toggle("temps",!!this.settings.showTemps);let o=Ye("fabs"),a=(l,c,h,f="")=>{let d=se("button","fab "+f,l);return d.title=c,d.addEventListener("click",h),o.insertBefore(d,o.firstChild),d};this.fabExit=a("\u2715","\u05D9\u05E6\u05D9\u05D0\u05D4 \u05DE\u05D4\u05E1\u05D9\u05D5\u05E8",()=>this.exitWalk(),"walk-only"),this.fabPos=a("\u293C","\u05D4\u05E2\u05DE\u05D3\u05D4 \u05D4\u05E9\u05DE\u05D5\u05E8\u05D4 \u05D4\u05D1\u05D0\u05D4",()=>{this.savedPositions.length&&(this.posIdx=((this.posIdx??-1)+1)%this.savedPositions.length,this.gotoPosition(this.savedPositions[this.posIdx]))},"walk-only"),Ye("kiosk-exit").addEventListener("click",l=>{l.preventDefault(),this.exitStills(!0)}),this.renderBar(),this.bindStageInput(),window.addEventListener("pointerdown",l=>{l.pointerType==="touch"&&(this.touch=!0,this.stage.classList.add("touch"))})}updateSunCard(){let e=this.env.time,t=this.env.sunInfo;Ye("sun-time").textContent=hm(e.hour);let i=Am.find(r=>r[0]===e.weather),n=t?t.azimuth<90?"\u05DE\u05D6\u05E8\u05D7":t.azimuth<180?"\u05D3\u05E8\u05D5\u05DD\u05BE\u05DE\u05D6\u05E8\u05D7":t.azimuth<270?"\u05D3\u05E8\u05D5\u05DD\u05BE\u05DE\u05E2\u05E8\u05D1":"\u05DE\u05E2\u05E8\u05D1":"";Ye("sun-info").textContent=t?`${t.elevation>0?`\u05E9\u05DE\u05E9 \u05DE${n} \xB7 \u05D2\u05D5\u05D1\u05D4 ${t.elevation.toFixed(0)}\xB0`:"\u05DC\u05D9\u05DC\u05D4 \xB7 \u05D4\u05E9\u05DE\u05E9 \u05DE\u05EA\u05D7\u05EA \u05DC\u05D0\u05D5\u05E4\u05E7"} \xB7 ${um(e.day)} \xB7 \u05E6\u05E4\u05D5\u05DF \u05D4\u05EA\u05D5\u05DB\u05E0\u05D9\u05EA ${e.north}\xB0 \xB7 ${i?i[1]:""}`:"",document.querySelectorAll("#weather .chip[data-w]").forEach(r=>r.classList.toggle("sel",r.dataset.w===e.weather))}renderBar(){let e=Ye("bar");if(e.innerHTML="",!this.plan)return;let t=(n,r,o,a)=>{let l=se("button","chip"+(r?" sel":""),n);return a&&(l.title=a),l.addEventListener("click",o),e.appendChild(l),l};t("\u05DE\u05DC\u05DE\u05E2\u05DC\u05D4",this.preset==="top"&&this.mode==="orbit",()=>this.toOrbit("top")),t("\u05D0\u05D9\u05D6\u05D5\u05DE\u05D8\u05E8\u05D9",this.preset==="iso"&&this.mode==="orbit",()=>this.toOrbit("iso")),t("\u05E4\u05E8\u05E1\u05E4\u05E7\u05D8\u05D9\u05D1\u05D4",this.preset==="persp"&&this.mode==="orbit",()=>this.toOrbit("persp")),e.appendChild(se("span","sep")),t("\u05E1\u05D9\u05D5\u05E8",this.mode==="walk",()=>this.mode==="walk"?this.exitWalk():this.enterWalk(),"\u05E1\u05D9\u05D5\u05E8 \u05D1\u05D2\u05D5\u05D1\u05D4 \u05E2\u05D9\u05DF"),e.appendChild(se("span","sep"));let i=document.createElement("select");i.className="chip",i.setAttribute("aria-label","\u05D0\u05D9\u05DB\u05D5\u05EA");for(let[n,r]of Zc){let o=se("option","",n===3&&r?jc:Yc[n]);o.value=`${n}|${r?1:0}`,n===0&&!this.bakes[this.currentLevelId()]&&(o.disabled=!0),this.quality===n&&this.lite===r&&(o.selected=!0),i.appendChild(o)}i.addEventListener("change",()=>{let[n,r]=i.value.split("|");this.setQuality(+n,null,r==="1")}),e.appendChild(i)}buildStrip(){let e=Ye("strip");e.innerHTML="";let t=this.plan.doc.levels.slice().reverse(),i=(n,r)=>{let o=se("button",this.levelMode===n?"sel":""),a=se("span","pic");if(this.thumbs[n]){let h=document.createElement("img");h.src=this.thumbs[n],a.appendChild(h)}let l=se("span","dots"),c=this.planScene.levels[n];if(c){let h=c.zones.some(u=>u.x_proto&&this.entities[u.x_proto.light]==="on"),f=c.zones.some(u=>u.x_proto&&u.x_proto.presence&&this.entities[u.x_proto.presence]==="on"),d=this.planScene.markers.some(u=>u.group.parent===c.group&&u.group.visible);if(h){let u=se("i");u.style.background="var(--sw-map-lit)",l.appendChild(u)}if(f){let u=se("i");u.style.background="var(--sw-map-presence)",l.appendChild(u)}if(d){let u=se("i");u.style.background="var(--sw-danger)",l.appendChild(u)}}a.appendChild(l),o.appendChild(a),o.appendChild(document.createTextNode(r)),o.addEventListener("click",()=>{this.mode==="walk"||this.levelMode===n||(this.flash(.45),this.setLevelMode(n),this.fitCamera(this.preset))}),e.appendChild(o)};for(let n of t)i(n.id,n.name);i("all","\u05DB\u05DC \u05D4\u05E7\u05D5\u05DE\u05D5\u05EA")}async makeThumbs(){if(this.quality===0)return;let e=this.levelMode;for(let t of this.plan.doc.levels){this.planScene.showLevel(t.id,!1);let i=new bi(-10,10,10,-10,-100,300),n=this.visibleExtent(),r=(n.minX+n.maxX)/2,o=(n.minZ+n.maxZ)/2,a=Math.hypot(n.maxX-n.minX,n.maxZ-n.minZ)/2*1.05;i.left=-a*1.6,i.right=a*1.6,i.top=a,i.bottom=-a,i.position.set(r+40,n.base+40,o+40),i.lookAt(r,n.base+1,o),i.updateProjectionMatrix(),this.planScene.update(.016,i.position,{nightFactor:this.env.recipe.night,lampShadows:!1}),this.thumbs[t.id]=this.baker.thumbnail(i,208,112)}this.planScene.showLevel(e,this.mode==="walk"),this.buildStrip(),this.invalidate()}currentLevelId(){return this.mode==="walk"&&this.walk?this.walk.level:this.levelMode==="all"||!this.levelMode?this.plan.doc.levels[0].id:this.levelMode}buildStatesPanel(){let e=Ye("panel-states");e.innerHTML="";let t=this.plan.entityNames||{},i=(h,f,d=["on"],u="off",p="on")=>{let x=se("button","sw "+(f||"")),m=()=>x.classList.toggle("on",d.includes(this.entities[h]));return m(),x.addEventListener("click",()=>{this.setEntity(h,d.includes(this.entities[h])?u:p),m()}),x.dataset.entity=h,this._syncs=this._syncs||[],this._syncs.push(m),x},n=se("div","pcard");n.appendChild(se("h3","","\u05EA\u05E8\u05D7\u05D9\u05E9\u05D9\u05DD"));let r=se("div","actions");r.style.display="flex",r.style.gap="6px",r.style.flexWrap="wrap";let o=(h,f)=>{let d=se("button","btn sm",h);d.addEventListener("click",()=>{f(),this.syncPanel()}),r.appendChild(d)};o("\u05D4\u05DB\u05D5\u05DC \u05DB\u05D1\u05D5\u05D9",()=>this.setMany(h=>h.startsWith("light."),"off")),o("\u05E2\u05E8\u05D1 \u05D1\u05D1\u05D9\u05EA",()=>{this.setMany(h=>h.startsWith("light."),"on"),Ye("sun-slider").value=1140,this.env.setTime({hour:19}),this.updateSunCard()}),o("\u05DC\u05D9\u05DC\u05D4",()=>{this.setMany(h=>h.startsWith("light."),"off"),this.setEntity("light.hall","on"),this.setEntity("light.upper_corridor","on"),Ye("sun-slider").value=1380,this.env.setTime({hour:23}),this.updateSunCard()}),o("\u05E4\u05EA\u05D7 \u05D4\u05DB\u05D5\u05DC",()=>this.setMany(h=>h.startsWith("binary_sensor.")&&h.endsWith("_door"),"on")),o("\u05E1\u05D2\u05D5\u05E8 \u05D4\u05DB\u05D5\u05DC",()=>this.setMany(h=>h.startsWith("binary_sensor.")&&h.endsWith("_door"),"off")),n.appendChild(r),e.appendChild(n),this.treeCollapsed=this.treeCollapsed||{};for(let h of this.plan.doc.levels){let f=se("div","pcard tree"+(this.treeCollapsed[h.id]?" collapsed":"")),d=se("h3");d.appendChild(se("span","tw","\u25BC")),d.appendChild(document.createTextNode(h.name)),d.appendChild(se("span","muted",`\u05DE\u05E4\u05DC\u05E1 ${h.elevation_m.toFixed(1)} \u05DE\u05F3`)),d.addEventListener("click",()=>{this.treeCollapsed[h.id]=!this.treeCollapsed[h.id],f.classList.toggle("collapsed",this.treeCollapsed[h.id])}),f.appendChild(d);let u=se("div","body");f.appendChild(u);let p=this.plan.zones.filter(x=>x.level_id===h.id);p.length||u.appendChild(se("div","help","\u05D0\u05D9\u05DF \u05D7\u05D3\u05E8\u05D9\u05DD \u05DE\u05D5\u05D2\u05D3\u05E8\u05D9\u05DD \u05D1\u05E7\u05D5\u05D1\u05E5 \u05D6\u05D4 \u2014 \u05D4\u05DE\u05E6\u05D1\u05D9\u05DD \u05DE\u05EA\u05D5\u05DA \u05D4\u05D9\u05E9\u05D5\u05D9\u05D5\u05EA \u05D1\u05DC\u05D1\u05D3."));for(let x of p){let m=se("div","room"),g=se("div","name",x.name);x.x_proto&&typeof x.x_proto.temp=="number"&&g.appendChild(se("span","t",`${x.x_proto.temp.toFixed(1)}\xB0`)),g.style.cursor="pointer",g.title="\u05E2\u05DE\u05D5\u05D3 \u05D1\u05D7\u05D3\u05E8",g.addEventListener("click",()=>{let T=this.planScene.levels[h.id],_=T&&T.zones.find(v=>v.id===x.id);_&&this.standInRoom(T,_)}),m.appendChild(g);let S=x.x_proto||{};if(S.light){let T=se("div","dev");T.appendChild(se("span","lbl2",t[S.light]||S.light)),T.appendChild(i(S.light)),m.appendChild(T)}for(let T of this.planScene.lamps.filter(_=>_.level===h.id&&_.entity!==S.light&&this.lampInZone(_,x))){let _=se("div","dev");_.appendChild(se("span","lbl2",t[T.entity]||T.entity)),_.appendChild(i(T.entity)),m.appendChild(_)}if(S.presence){let T=se("div","dev");T.appendChild(se("span","lbl2",t[S.presence]||S.presence));let _=se("button","btn sm","\u05D3\u05DE\u05D4 \u05EA\u05E0\u05D5\u05E2\u05D4");_.addEventListener("click",()=>this.pulsePresence(S.presence)),T.appendChild(_),T.appendChild(i(S.presence,"")),m.appendChild(T)}u.appendChild(m)}e.appendChild(f)}let a=se("div","pcard");a.appendChild(se("h3","","\u05D3\u05DC\u05EA\u05D5\u05EA \u05D5\u05DE\u05E0\u05E2\u05D5\u05DC\u05D9\u05DD"));for(let h of this.plan.doc.openings.filter(f=>f.kind==="door"&&f.anchor_ref)){let f=h.anchor_ref.resource_id,d=se("div","dev");d.appendChild(se("span","lbl2",t[f]||f)),f.startsWith("lock.")?d.appendChild(i(f,"danger",["locked"],"unlocked","locked")):d.appendChild(i(f,"danger",["on","open"],"off","on")),a.appendChild(d);let u=this.plan.doorLocks&&this.plan.doorLocks[h.id];if(u){let p=se("div","dev");p.appendChild(se("span","lbl2",t[u]||u)),p.appendChild(i(u,"danger",["locked"],"unlocked","locked")),a.appendChild(p)}}e.appendChild(a);let l=Object.keys(this.entities).filter(h=>h.startsWith("cover."));if(l.length){let h=se("div","pcard");h.appendChild(se("h3","","\u05EA\u05E8\u05D9\u05E1\u05D9\u05DD"));for(let f of l){let d=se("div","dev");d.appendChild(se("span","lbl2",t[f]||f));let u=document.createElement("input");u.type="range",u.min=0,u.max=100,u.className="pos",u.value=this.coverPositions[f]??(this.entities[f]==="open"?100:0),u.addEventListener("input",()=>{this.coverPositions[f]=+u.value,this.setEntity(f,+u.value>0?"open":"closed")}),d.appendChild(u),h.appendChild(d)}e.appendChild(h)}let c=Object.keys(this.entities).filter(h=>h.startsWith("media_player."));if(c.length){let h=se("div","pcard");h.appendChild(se("h3","","\u05DE\u05D3\u05D9\u05D4"));for(let f of c){let d=se("div","dev");d.appendChild(se("span","lbl2",t[f]||f)),d.appendChild(i(f,"",["playing","on"],"off","playing")),h.appendChild(d)}e.appendChild(h)}}lampInZone(e,t){let i=t.polygon.map(n=>this.planScene.toM([n.x,n.y]));return Pn(e.pos.x,e.pos.z,i)}syncPanel(){for(let e of this._syncs||[])e();this.buildStrip()}setMany(e,t){for(let i of Object.keys(this.entities))e(i)&&(this.entities[i]=t);this.applyStates()}setEntity(e,t){this.entities[e]=t,this.applyStates(),this.syncPanel()}applyStates(){this.planScene.setStates(this.entities,this.coverPositions),this.invalidate(),this.mode==="stills"&&this.showStills(),this.walk&&(this.walk.path=null)}pulsePresence(e){this.setEntity(e,"on"),clearTimeout(this.presenceTimers[e]),this.presenceTimers[e]=setTimeout(()=>this.setEntity(e,"off"),12e3)}buildWalkPanel(){let e=Ye("panel-walk");e.innerHTML="";let t=se("div","pcard");t.appendChild(se("h3","","\u05E1\u05D9\u05D5\u05E8 \u05D1\u05D2\u05D5\u05D1\u05D4 \u05E2\u05D9\u05DF"));let i=se("button","btn primary",this.mode==="walk"?"\u05D9\u05E6\u05D9\u05D0\u05D4 \u05DE\u05D4\u05E1\u05D9\u05D5\u05E8":"\u05D4\u05EA\u05D7\u05DC \u05E1\u05D9\u05D5\u05E8");i.addEventListener("click",()=>this.mode==="walk"?this.exitWalk():this.enterWalk()),t.appendChild(i);let n=se("div","toggles");n.style.marginTop="8px";let r=document.createElement("input");r.type="range",r.min=1.2,r.max=2,r.step=.05,r.value=this.settings.eyeHeight,r.className="pos";let o=se("span","",`\u05D2\u05D5\u05D1\u05D4 \u05E2\u05D9\u05DF ${(+r.value).toFixed(2)} \u05DE\u05F3`);r.addEventListener("input",()=>{o.textContent=`\u05D2\u05D5\u05D1\u05D4 \u05E2\u05D9\u05DF ${(+r.value).toFixed(2)} \u05DE\u05F3`,this.settings.eyeHeight=+r.value,this.saveSettings(),this.walk&&(this.walk.eyeTarget=+r.value,this.invalidate())}),n.appendChild(o),n.appendChild(r);let a=document.createElement("select");a.className="inline";for(let[d,u]of[["drag","\u05D2\u05E8\u05D9\u05E8\u05D4"],["lock","\u05E0\u05E2\u05D9\u05DC\u05EA \u05E1\u05DE\u05DF"],["auto","\u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9"]]){let p=se("option","",u);p.value=d,d===this.settings.mouseMode&&(p.selected=!0),a.appendChild(p)}a.addEventListener("change",()=>{this.settings.mouseMode=a.value,this.saveSettings(),document.pointerLockElement&&document.exitPointerLock()}),n.appendChild(se("span","","\u05DE\u05D1\u05D8 \u05D1\u05E2\u05DB\u05D1\u05E8")),n.appendChild(a),t.appendChild(n),e.appendChild(t);let l=se("div","pcard");l.appendChild(se("h3","","\u05E2\u05DE\u05D3\u05D5\u05EA \u05E9\u05DE\u05D5\u05E8\u05D5\u05EA"));let c=se("div","list");this.savedPositions.forEach((d,u)=>{let p=se("button","",`${d.name} \xB7 ${this.levelName(d.level_id)}`);p.appendChild(se("span","k",String(u+1))),p.addEventListener("click",()=>this.gotoPosition(d)),c.appendChild(p)}),l.appendChild(c),e.appendChild(l);let h=se("div","pcard");h.appendChild(se("h3","","\u05E2\u05DE\u05D5\u05D3 \u05D1\u2026"));let f=se("div","list");for(let d of this.planScene.cameras){let u=se("button","",`\u{1F4F7} ${d.label}`);u.addEventListener("click",()=>this.standAtCamera(d)),f.appendChild(u)}for(let d of Object.values(this.planScene.levels))for(let u of d.zones){let p=se("button","",`${u.name} \xB7 ${d.name}`);p.addEventListener("click",()=>this.standInRoom(d,u)),f.appendChild(p)}h.appendChild(f),e.appendChild(h)}levelName(e){let t=this.plan.doc.levels.find(i=>i.id===e);return t?t.name:e}buildQualityPanel(){let e=Ye("panel-quality");e.innerHTML="";let t=se("div","pcard");t.appendChild(se("h3","","\u05EA\u05E6\u05D5\u05D2\u05D4"));let i=se("div","toggles"),n=(E,A,y,R)=>{let I=document.createElement("select");I.className="inline";for(let[L,b]of y){let w=se("option","",b);w.value=L,String(L)===String(this.settings[E])&&(w.selected=!0),I.appendChild(w)}return I.addEventListener("change",()=>{this.settings[E]=I.value,this.saveSettings(),R&&R(I.value)}),i.appendChild(se("span","",A)),i.appendChild(I),I},r=(E,A,y)=>{let R=se("button","sw"+(this.settings[E]?" on":""));R.addEventListener("click",()=>{this.settings[E]=!this.settings[E],R.classList.toggle("on",this.settings[E]),this.saveSettings(),y&&y(this.settings[E])}),i.appendChild(se("span","",A)),i.appendChild(R)};n("defaultView","\u05EA\u05E6\u05D5\u05D2\u05D4 \u05D1\u05DB\u05E0\u05D9\u05E1\u05D4 (\u05DC\u05DB\u05D5\u05DC\u05DD: \u05E1\u05DB\u05DE\u05D8\u05D9)",[["schematic","\u05E1\u05DB\u05DE\u05D8\u05D9"],["realistic","\u05E8\u05D9\u05D0\u05DC\u05D9\u05E1\u05D8\u05D9"]]),n("wallDisplay","\u05EA\u05E6\u05D5\u05D2\u05EA \u05E7\u05D9\u05E8",[["live","\u05EA\u05DC\u05EA\u05BE\u05DE\u05DE\u05D3 \u05D7\u05D9"],["stills","\u05EA\u05DE\u05D5\u05E0\u05D4 \u05DE\u05D5\u05DB\u05E0\u05D4"]]),n("furnitureMode","\u05E8\u05D9\u05D4\u05D5\u05D8",[["models","\u05DE\u05D5\u05D3\u05DC\u05D9\u05DD (CC0)"],["procedural","\u05DE\u05D5\u05D1\u05E0\u05D4 (\u05E4\u05E8\u05D5\u05E6\u05D3\u05D5\u05E8\u05DC\u05D9)"]],E=>{this.planScene.furnitureMode=E,this.rebuild(),this.makeThumbs()}),n("textureSource","\u05D7\u05D5\u05DE\u05E8\u05D9\u05DD",[["files","\u05E2\u05E8\u05DB\u05D5\u05EA CC0 (\u05E7\u05D1\u05E6\u05D9\u05DD)"],["procedural","\u05DE\u05D5\u05D1\u05E0\u05D4 (\u05E4\u05E8\u05D5\u05E6\u05D3\u05D5\u05E8\u05DC\u05D9)"]],E=>{this.lib.dispose(),this.lib.textureSource=E,this.lib.failed=new Set,this.rebuild(),this.makeThumbs()}),n("timeSource","\u05E9\u05E2\u05D4 \u05D1\u05D9\u05D5\u05DD",[["clock","\u05E9\u05E2\u05D5\u05DF \u05D4\u05D0\u05EA\u05E8"],["manual","\u05D9\u05D3\u05E0\u05D9 (\u05D4\u05DE\u05D7\u05D5\u05D5\u05DF)"]],E=>{E==="clock"&&Ye("sun-now").click()}),r("sectionCut","\u05D7\u05EA\u05DA \u05E7\u05D5\u05DE\u05D4 \u05D1\u05DE\u05D1\u05D8\u05D9 \u05D4\u05DE\u05E2\u05D5\u05E3",()=>this.applyCut()),r("showTemps","\u05D8\u05DE\u05E4\u05E8\u05D8\u05D5\u05E8\u05D4 \u05E2\u05DC \u05DB\u05DC \u05D7\u05D3\u05E8",E=>Ye("labels").classList.toggle("temps",E)),r("motion","\u05DE\u05E2\u05D1\u05E8\u05D9\u05DD \u05DE\u05D5\u05E0\u05E4\u05E9\u05D9\u05DD"),t.appendChild(i),e.appendChild(t);let o=se("div","pcard tree collapsed"),a=se("h3");a.appendChild(se("span","tw","\u25BC")),a.appendChild(document.createTextNode("\u05D0\u05D9\u05DB\u05D5\u05EA \u05D5\u05D1\u05D9\u05E6\u05D5\u05E2\u05D9\u05DD")),a.addEventListener("click",()=>o.classList.toggle("collapsed")),o.appendChild(a);let l=se("div","body");o.appendChild(l),this.ladderEl=se("div","ladder"),l.appendChild(this.ladderEl),l.appendChild(se("div","help",`\u05E0\u05DE\u05D3\u05D3 ${Sd/1e3} \u05E9\u05E0\u05D9\u05D5\u05EA \u05D0\u05D7\u05E8\u05D9 3 \u05E4\u05E8\u05D9\u05D9\u05DE\u05D9\u05DD; \u05DE\u05EA\u05D7\u05EA \u05DC\u05BE${bd} fps \u05D9\u05D5\u05E8\u05D3\u05D9\u05DD \u05E9\u05DC\u05D1 \u05D5\u05E0\u05E9\u05D0\u05E8\u05D9\u05DD \u05E9\u05DD \u05DC\u05D4\u05DE\u05E9\u05DA \u05D4\u05D4\u05E4\u05E2\u05DC\u05D4. \u05D1\u05D7\u05D9\u05E8\u05D4 \u05D9\u05D3\u05E0\u05D9\u05EA \u05DE\u05D5\u05D3\u05D3\u05EA \u05DE\u05D7\u05D3\u05E9.`));let c=se("div","toggles"),h=(E,A,y)=>{let R=se("button","sw"+(this.opts[E]?" on":""));R.addEventListener("click",()=>{this.opts[E]=!this.opts[E],R.classList.toggle("on",this.opts[E]),(y||(()=>this.rebuild()))()}),c.appendChild(se("span","",A)),c.appendChild(R)};h("autoLadder","\u05D9\u05E8\u05D9\u05D3\u05D4 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA \u05D1\u05E8\u05DE\u05D4",()=>{}),h("reflections","\u05D4\u05E9\u05EA\u05E7\u05E4\u05D5\u05EA \u05E8\u05E6\u05E4\u05D4 (\u05E8\u05D9\u05D0\u05DC\u05D9\u05E1\u05D8\u05D9 \xB7 \u05D9\u05E7\u05E8)"),h("ao","\u05D7\u05E1\u05D9\u05DE\u05EA \u05E1\u05D1\u05D9\u05D1\u05D4 GTAO (\u05E8\u05D9\u05D0\u05DC\u05D9\u05E1\u05D8\u05D9)",()=>{this.env.post.ao=this.opts.ao,this.env.buildComposer(this.camera),this.invalidate()}),h("bloom","\u05D6\u05D5\u05D4\u05E8 \u05DE\u05E0\u05D5\u05E8\u05D5\u05EA (bloom)",()=>{this.env.post.bloom=this.opts.bloom,this.env.buildComposer(this.camera),this.invalidate()}),h("lampShadows","\u05E6\u05DC\u05DC\u05D9\u05DD \u05DE\u05DE\u05E0\u05D5\u05E8\u05D5\u05EA (2 \u05D4\u05E7\u05E8\u05D5\u05D1\u05D5\u05EA)");let f=se("button","sw"+(this.hudOn?" on":""));f.addEventListener("click",()=>{this.hudOn=!this.hudOn,f.classList.toggle("on",this.hudOn),Ye("hud").classList.toggle("on",this.hudOn)}),c.appendChild(se("span","","\u05E0\u05EA\u05D5\u05E0\u05D9 \u05D1\u05D9\u05E6\u05D5\u05E2\u05D9\u05DD \u05E2\u05DC \u05D4\u05DE\u05E1\u05DA (\u05DC\u05DE\u05E4\u05EA\u05D7\u05D9\u05DD)")),c.appendChild(f),l.appendChild(c);let d=se("div","toggles"),u=document.createElement("select");u.className="inline";for(let E of[1,1.25,1.5,2]){let A=se("option","",`\u05E2\u05D3 ${E}\xD7`);A.value=E,E===this.opts.dprCap&&(A.selected=!0),u.appendChild(A)}u.addEventListener("change",()=>{this.opts.dprCap=+u.value,this.resize()}),d.appendChild(se("span","","\u05D9\u05D7\u05E1 \u05E4\u05D9\u05E7\u05E1\u05DC\u05D9\u05DD")),d.appendChild(u),l.appendChild(d),e.appendChild(o);let p=se("div","pcard");p.appendChild(se("h3","","\u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DE\u05D5\u05DB\u05E0\u05D5\u05EA \u05DC\u05EA\u05E6\u05D5\u05D2\u05EA \u05E7\u05D9\u05E8"));let x=se("button","btn primary","\u05D4\u05DB\u05DF \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DC\u05E7\u05D5\u05DE\u05D4 \u05D4\u05E0\u05D5\u05DB\u05D7\u05D9\u05EA"),m=se("div","progress"),g=se("i");m.appendChild(g),x.addEventListener("click",()=>this.bakeCurrent(x,g)),p.appendChild(x),p.appendChild(m);let S=se("button","btn sm","\u05D4\u05DB\u05DF \u05DC\u05DB\u05DC \u05D4\u05E7\u05D5\u05DE\u05D5\u05EA");S.style.marginTop="6px",S.addEventListener("click",async()=>{for(let E of this.plan.doc.levels)this.setLevelMode(E.id),await this.bakeCurrent(x,g)}),p.appendChild(S);let T=se("div","toggles");T.style.marginTop="8px";let _=document.createElement("select");_.className="inline";for(let[E,A]of[[0,"\u05DB\u05D1\u05D5\u05D9"],[10,"10 \u05E9\u05F3"],[30,"30 \u05E9\u05F3"],[120,"2 \u05D3\u05E7\u05F3"],[600,"10 \u05D3\u05E7\u05F3"]]){let y=se("option","",A);y.value=E,E===this.opts.idleS&&(y.selected=!0),_.appendChild(y)}_.addEventListener("change",()=>{this.opts.idleS=+_.value}),T.appendChild(se("span","","\u05DE\u05E2\u05D1\u05E8 \u05DC\u05EA\u05DE\u05D5\u05E0\u05D4 \u05D0\u05D7\u05E8\u05D9 \u05D7\u05D5\u05E1\u05E8 \u05E4\u05E2\u05D9\u05DC\u05D5\u05EA")),T.appendChild(_),p.appendChild(T);let v=se("button","btn sm","\u05D4\u05E6\u05D2 \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DE\u05D5\u05DB\u05E0\u05D5\u05EA \u05E2\u05DB\u05E9\u05D9\u05D5");v.style.marginTop="6px",v.addEventListener("click",()=>this.setQuality(0)),p.appendChild(v),e.appendChild(p),this.renderLadder()}renderLadder(){if(!this.ladderEl)return;this.ladderEl.innerHTML="";let e=[...Zc.map(([t,i])=>[t,i,t===3&&i?jc:Yc[t]]),[-1,!1,"2D"]];e.forEach(([t,i,n],r)=>{let o=se("span",t===this.quality&&i===this.lite?"on":"",n);t>=0&&o.addEventListener("click",()=>this.setQuality(t,null,i)),t===-1&&(o.style.cursor="default"),this.stage.dataset.fallback&&r<+this.stage.dataset.fallback&&o.classList.add("down"),this.ladderEl.appendChild(o),r<e.length-1&&this.ladderEl.appendChild(se("span","","\u2190"))}),this.lastProbe&&this.ladderEl.appendChild(se("div","help",`\u05DE\u05D3\u05D9\u05D3\u05D4 \u05D0\u05D7\u05E8\u05D5\u05E0\u05D4: ${this.lastProbe.fps} fps \u05D1\u05E8\u05DE\u05D4 "${this.lastProbe.label}"`))}async bakeCurrent(e,t){this.quality===0&&this.exitStills(!1);let i=this.currentLevelId(),n=this.levelMode,r=this.mode;this.mode==="walk"&&this.exitWalk(),this.setLevelMode(i),e.disabled=!0;let o={...this.entities},a=this.env.time.hour,l=new Ut(38,1.6,.1,300),c=this.visibleExtent(),h=(c.minX+c.maxX)/2,f=(c.minZ+c.maxZ)/2,u=Math.hypot(c.maxX-c.minX,c.maxZ-c.minZ,c.top)/2/Math.tan(l.fov*Math.PI/360)*1.1;l.position.set(h+u*.6,c.base+u*.6,f+u*.6),l.lookAt(h,c.base+1,f);let p=this.planScene.markers.filter(S=>S.group.parent===this.planScene.levels[i].group).map(S=>{let T=[];return S.group.children.forEach(_=>{_.geometry.computeBoundingBox();let v=_.geometry.boundingBox;T.push(new D(v.min.x,v.min.y,v.min.z),new D(v.max.x,v.max.y,v.max.z),new D(v.min.x,v.max.y,v.max.z),new D(v.max.x,v.min.y,v.min.z),new D(v.min.x,v.max.y,v.min.z),new D(v.max.x,v.max.y,v.min.z),new D(v.min.x,v.min.y,v.max.z),new D(v.max.x,v.min.y,v.max.z))}),{entity:S.entity,points:T}}),x=0,m=S=>{let T=S.startsWith("night"),_=S.endsWith("_on");this.env.setTime({hour:T?22.5:14});for(let v of Object.keys(this.entities))v.startsWith("light.")&&(this.entities[v]=_?"on":"off");for(let v of this.planScene.markers)v.group.visible=!1;for(let v of this.planScene.presence)v.mesh.visible=!1;this.planScene.setStates(this.entities,this.coverPositions,!0);for(let v of this.planScene.markers)v.group.visible=!1;for(let v of this.planScene.presence)v.mesh.visible=!1;this.planScene.update(1,l.position,{nightFactor:T?1:0,lampShadows:!1}),this.planScene.update(1,l.position,{nightFactor:T?1:0,lampShadows:!1}),t.style.width=`${++x/4*100}%`},g=await this.baker.bake(i,l,1280,800,m,p);this.bakes[i]=g,Object.assign(this.entities,o),this.env.setTime({hour:a}),this.planScene.setStates(this.entities,this.coverPositions,!0),this.thumbs[i]=g.pics.day_on,t.style.width="0",e.disabled=!1,this.renderBar(),this.buildStrip(),this.toast(`\u05D4\u05D5\u05DB\u05E0\u05D5 4 \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA + ${g.masks.length} \u05DE\u05E1\u05DB\u05D5\u05EA \u05DC\u05E7\u05D5\u05DE\u05D4 "${this.levelName(i)}"`),n!==i&&this.setLevelMode(n),this.invalidate()}enterStills(){this.mode="stills",this.stage.classList.add("stills"),this.continuous=!1,this.showStills(),this.renderBar()}showStills(){let e=this.bakes[this.currentLevelId()];pm(Ye("stills"),e,{night:this.env.recipe.night>.5||this.env.sunInfo.elevation<0,entities:this.entities}),Ye("labels").innerHTML=""}exitStills(e){this.stage.classList.remove("stills"),this.mode="orbit",e&&this.quality===0&&(this.quality=this.lastLiveQuality||2,this.lite=!!this.lastLiveLite,this.rebuild(),this.renderBar(),this.renderLadder()),this.invalidate()}enterWalk(){this.mode==="stills"&&this.exitStills(!0),this.mode="walk",this.stage.classList.add("walk"),this.orbitState={camera:this.camera,preset:this.preset,levelMode:this.levelMode},this.walk||(this.walk=new Hc(this.planScene),this.walk.onLevelChange=n=>this.onWalkLevel(n)),this.walk.scene=this.planScene,this.walk.eye=this.settings.eyeHeight,this.walk.eyeTarget=this.settings.eyeHeight;let e=this.camera&&this.camera!==this.walkCam?{pos:this.camera.position.clone(),quat:this.camera.quaternion.clone()}:null,t=this.savedPositions.find(n=>n.is_default)||this.savedPositions[0];if(t)this.gotoPosition(t,!0);else{let n=this.planScene.levels[this.currentLevelId()],r=n.zones[0],o=r?Pr(r.polyM):[(n.extent.minX+n.extent.maxX)/2,(n.extent.minZ+n.extent.maxZ)/2];this.walk.placeAt(o[0],o[1],0,n.id)}let i=this.canvas.clientHeight>this.canvas.clientWidth;if(this.walkCam.fov=i?76:this.touch?70:62,this.walkCam.near=.06,this.walkCam.updateProjectionMatrix(),this.camera=this.walkCam,e&&this.settings.motion){this.walkCam.position.set(this.walk.x,this.walk.eyeY(),this.walk.z),this.walkCam.rotation.order="YXZ",this.walkCam.rotation.set(this.walk.pitch,this.walk.yaw,0);let n=this.walkCam.position.clone(),r=this.walkCam.quaternion.clone(),o=this.walkCam;this.tween={t0:performance.now(),ms:650,pose:!0,step:a=>{o.position.lerpVectors(e.pos,n,a),o.quaternion.slerpQuaternions(e.quat,r,a)}}}this.controls&&(this.controls.enabled=!1),this.planScene.showLevel("all",!0),this.planScene.setCut(null),this.env.setCamera(this.walkCam),this.env.interior=!0,this.env.interiorFill=.6,this.env.setFog(!0),this.env.applyTime(),this.continuous=!0,this.renderBar(),this.buildWalkPanel(),this.updateWalkBar(),this.invalidate(),this.canvas.focus&&this.canvas.focus()}exitWalk(){document.pointerLockElement&&document.exitPointerLock(),this.mode="orbit",this.stage.classList.remove("walk");let e=this.orbitState||{};this.levelMode=e.levelMode||this.plan.doc.levels[0].id,this.planScene.showLevel(this.levelMode,!1),this.buildStrip(),this.fitCamera(e.preset||"iso"),this.env.interior=!1,this.env.interiorFill=1,this.env.setFog(!1),this.env.applyTime(),this.applyCut(),this.continuous=!1,this.renderBar(),this.buildWalkPanel(),this.invalidate()}onWalkLevel(e){this.levelMode=e,this.buildStrip(),this.toast(`${this.levelName(e)}`),Ye("mm-level").textContent=this.levelName(e)}gotoPosition(e,t){let[i,n]=this.planScene.toM([e.x,e.y]);this.mode!=="walk"&&this.enterWalk(),this.teleport(()=>{this.walk.placeAt(i,n,e.heading_deg||0,e.level_id),this.planScene.showLevel("all",!0)},t),Ye("mm-level").textContent=this.levelName(this.walk.level)}teleport(e,t){let i=Ye("fade");if(t){e(),this.invalidate();return}i.style.opacity="1",setTimeout(()=>{e(),this.invalidate(),setTimeout(()=>i.style.opacity="0",60)},160)}standAtCamera(e){this.mode!=="walk"&&this.enterWalk(),this.teleport(()=>{let t=this.planScene.levels[e.level];this.walk.placeAt(e.pos[0]+e.fwd[0]*.35,e.pos[1]+e.fwd[1]*.35,Math.atan2(-e.fwd[0],-e.fwd[1])*180/Math.PI,e.level),this.walk.yaw=Math.atan2(-e.fwd[0],-e.fwd[1]),this.walk.pitch=-e.tilt*Math.PI/180,this.walk.eyeOverride=t.elevation+e.mount}),this.toast(`\u05E2\u05D5\u05DE\u05D3 \u05D1${e.label} \u2014 \u05D2\u05D5\u05D1\u05D4 ${e.mount.toFixed(1)} \u05DE\u05F3, \u05D4\u05D4\u05DC\u05D9\u05DB\u05D4 \u05D4\u05E8\u05D0\u05E9\u05D5\u05E0\u05D4 \u05DE\u05D7\u05D6\u05D9\u05E8\u05D4 \u05DC\u05D2\u05D5\u05D1\u05D4 \u05D4\u05E2\u05D9\u05DF`)}standInRoom(e,t){this.mode!=="walk"&&this.enterWalk();let[i,n]=Pr(t.polyM),r=0,o=0;for(let a=0;a<t.polyM.length;a++){let l=t.polyM[a],c=t.polyM[(a+1)%t.polyM.length],h=Math.hypot(c[0]-l[0],c[1]-l[1]);h>o&&(o=h,r=Math.atan2(-((l[0]+c[0])/2-i),-((l[1]+c[1])/2-n)))}this.teleport(()=>this.walk.placeAt(i,n,r*180/Math.PI,e.id))}updateWalkBar(){if(!this.walk||document.activeElement&&document.activeElement.closest&&document.activeElement.closest("#walkbar"))return;Ye("wx").value=this.walk.x.toFixed(2),Ye("wz").value=this.walk.z.toFixed(2),Ye("wh").value=Math.round((this.walk.yaw*180/Math.PI%360+360)%360);let e=this.planScene.levels[this.walk.level],t=e.zones.find(i=>Pn(this.walk.x,this.walk.z,i.polyM));Ye("roomname").textContent=`${t?t.name+" \xB7 ":""}${e.name}${this.walk.onStairs?" \xB7 \u05DE\u05D3\u05E8\u05D2\u05D5\u05EA":""}${this.walk.edge?" \xB7 \u05E7\u05E6\u05D4 \u05D4\u05EA\u05D5\u05DB\u05E0\u05D9\u05EA":""}`,Ye("mm-level").textContent=e.name}requestPointerLock(e=!1){this.mode!=="walk"&&this.enterWalk();let t=this.canvas.requestPointerLock&&this.canvas.requestPointerLock();t&&t.catch&&t.catch(()=>{e||this.toast("\u05E0\u05E2\u05D9\u05DC\u05EA \u05E1\u05DE\u05DF \u05DC\u05D0 \u05D6\u05DE\u05D9\u05E0\u05D4 \u05DB\u05D0\u05DF \u2014 \u05E0\u05E9\u05D0\u05E8\u05D9\u05DD \u05D1\u05D2\u05E8\u05D9\u05E8\u05D4")}),setTimeout(()=>{!document.pointerLockElement&&!e&&this.toast("\u05E0\u05E2\u05D9\u05DC\u05EA \u05E1\u05DE\u05DF \u05DC\u05D0 \u05D6\u05DE\u05D9\u05E0\u05D4 \u05DB\u05D0\u05DF \u2014 \u05E0\u05E9\u05D0\u05E8\u05D9\u05DD \u05D1\u05D2\u05E8\u05D9\u05E8\u05D4")},300)}bindStageInput(){let e=this.canvas;e.tabIndex=0;let t=new Set,i=()=>{if(!this.walk||this.mode!=="walk")return;let d=this.walk.input;d.fwd=(t.has("KeyW")||t.has("ArrowUp")?1:0)-(t.has("KeyS")||t.has("ArrowDown")?1:0),d.strafe=(t.has("KeyD")?1:0)-(t.has("KeyA")?1:0),d.turn=(t.has("KeyQ")||t.has("ArrowLeft")?1:0)-(t.has("KeyE")||t.has("ArrowRight")?1:0),d.run=t.has("ShiftLeft")||t.has("ShiftRight"),(d.fwd||d.strafe)&&(this.walk.path=null)};window.addEventListener("keydown",d=>{if(!(d.target&&(d.target.tagName==="INPUT"||d.target.tagName==="SELECT"||d.target.tagName==="TEXTAREA"))){if(this.userInput(),d.code==="Escape"){this.mode==="walk"&&this.exitWalk();return}if(!(d.code==="Digit3"&&this.mode!=="walk")&&this.mode==="walk"){if(/^Digit[1-9]$/.test(d.code)){let u=this.savedPositions[+d.code.slice(5)-1];u&&this.gotoPosition(u);return}if(d.code==="Enter"){this.actOnCrosshair();return}t.add(d.code),i(),["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(d.code)&&d.preventDefault()}}}),window.addEventListener("keyup",d=>{t.delete(d.code),i()}),window.addEventListener("blur",()=>{t.clear(),i()});let n=null;e.addEventListener("pointerdown",d=>{this.userInput(),this.mode!=="stills"&&(n={x:d.clientX,y:d.clientY,moved:!1,id:d.pointerId,t:performance.now(),touch:d.pointerType==="touch"},this.mode==="walk"&&!(d.pointerType==="touch"&&this.joyActive)&&e.setPointerCapture(d.pointerId),this.mode==="walk"&&d.pointerType==="mouse"&&this.settings.mouseMode!=="drag"&&!document.pointerLockElement&&this.requestPointerLock(this.settings.mouseMode==="auto"))}),e.addEventListener("pointermove",d=>{if(this.mode==="walk"&&document.pointerLockElement===e){this.walk.look(d.movementX*.0025,d.movementY*.0025),this.invalidate();return}if(!n||n.id!==d.pointerId){this.mode!=="walk"&&this.hoverAt(d);return}let u=d.clientX-n.x,p=d.clientY-n.y;if(Math.hypot(u,p)>6&&(n.moved=!0),this.mode==="walk"&&n.moved){let x=n.touch?.004:.0028;this.walk.look(u*x,p*x),n.x=d.clientX,n.y=d.clientY,this.invalidate()}});let r=d=>{if(!n||n.id!==d.pointerId)return;let u=n;n=null,this.mode!=="stills"&&(u.moved||this.clickAt(d,u.touch,performance.now()-u.t>500))};e.addEventListener("pointerup",r),e.addEventListener("pointercancel",()=>n=null),e.addEventListener("contextmenu",d=>d.preventDefault()),e.addEventListener("wheel",()=>this.userInput(),{passive:!0});let o=Ye("joystick"),a=Ye("knob"),l=null,c=null;o.addEventListener("pointerdown",d=>{l=d.pointerId;let u=o.getBoundingClientRect();c=[u.left+u.width/2,u.top+u.height/2],o.setPointerCapture(d.pointerId),this.joyActive=!0,this.userInput()}),o.addEventListener("pointermove",d=>{if(d.pointerId!==l||!this.walk)return;let u=d.clientX-c[0],p=d.clientY-c[1],x=Math.hypot(u,p),m=40;x>m&&(u*=m/x,p*=m/x),a.style.transform=`translate(${u}px, ${p}px)`;let g=8,S=Math.abs(u)<g?0:u/m,T=Math.abs(p)<g?0:p/m;this.walk.input.fwd=-T,this.walk.input.strafe=S,this.walk.path=null,this.invalidate()});let h=d=>{d.pointerId===l&&(l=null,this.joyActive=!1,a.style.transform="",this.walk&&(this.walk.input.fwd=0,this.walk.input.strafe=0))};o.addEventListener("pointerup",h),o.addEventListener("pointercancel",h),Ye("minimap").querySelector("canvas").addEventListener("click",d=>{if(!this.walk||!this.mmMap)return;let u=d.currentTarget.getBoundingClientRect(),[p,x]=this.mmMap.invert((d.clientX-u.left)/u.width*336,(d.clientY-u.top)/u.height*336);this.teleport(()=>{this.walk.placeAt(p,x,this.walk.yaw*180/Math.PI,this.walk.level)})});let f=()=>{this.walk&&(this.walk.placeAt(+Ye("wx").value,+Ye("wz").value,+Ye("wh").value,this.walk.level),this.invalidate())};for(let d of["wx","wz","wh"])Ye(d).addEventListener("change",f);Ye("walk-save").addEventListener("click",()=>{if(!this.walk)return;let u=this.planScene.levels[this.walk.level].zones.find(m=>Pn(this.walk.x,this.walk.z,m.polyM)),p=prompt("\u05E9\u05DD \u05D4\u05E2\u05DE\u05D3\u05D4",u?u.name:`\u05E2\u05DE\u05D3\u05D4 ${this.savedPositions.length+1}`);if(!p)return;let x=[this.walk.x/(this.planScene.W*this.planScene.scale),this.walk.z/(this.planScene.H*this.planScene.scale)];this.savedPositions.push({id:`wp-${Date.now()}`,name:p,level_id:this.walk.level,x:x[0],y:x[1],heading_deg:Math.round(this.walk.yaw*180/Math.PI),is_default:!1});try{localStorage.setItem(`studio6.positions.${this.plan.id}`,JSON.stringify(this.savedPositions))}catch{}this.buildWalkPanel(),this.toast(`\u05E0\u05E9\u05DE\u05E8\u05D4 \u05D4\u05E2\u05DE\u05D3\u05D4 "${p}"`)}),Ye("walk-exit").addEventListener("click",()=>this.exitWalk()),document.addEventListener("pointerlockchange",()=>{document.pointerLockElement===e&&this.toast("\u05E0\u05E2\u05D9\u05DC\u05EA \u05E1\u05DE\u05DF \u05E4\u05E2\u05D9\u05DC\u05D4 \u2014 Esc \u05DC\u05E9\u05D7\u05E8\u05D5\u05E8")}),window.addEventListener("pointerdown",()=>this.userInput(),!0)}userInput(){this.lastInput=performance.now(),this.mode==="stills"&&this.quality===0&&this.kioskAuto&&(this.kioskAuto=!1,this.exitStills(!0))}ndc(e){let t=this.canvas.getBoundingClientRect();return new ee((e.clientX-t.left)/t.width*2-1,-((e.clientY-t.top)/t.height*2-1))}hoverAt(e){this.raycaster.setFromCamera(this.ndc(e),this.camera);let t=this.planScene.pick(this.raycaster),i=t?t.entity||t.id:null;i!==this.hover&&(this.hover=i,this.canvas.style.cursor=t?"pointer":"",this.invalidate())}clickAt(e,t,i){this.raycaster.setFromCamera(this.mode==="walk"&&!t&&document.pointerLockElement?new ee(0,0):this.ndc(e),this.camera);let n=this.planScene.pick(this.raycaster);if(n&&(this.mode!=="walk"||i||!t||n.distance<3)){this.showPopover(n,e);return}if(this.hidePopover(),this.mode==="walk"){let r=[];this.planScene.root.traverse(l=>{l.userData&&(l.userData.kind==="floor"||l.userData.kind==="static")&&l.visible&&r.push(l)});let o=this.raycaster.intersectObjects(r,!1),a=o.find(l=>l.object.userData.kind==="floor"&&l.face&&l.face.normal.y>.5)||o[0];if(a&&a.object.userData.kind==="floor"){if(a.object.userData.level!==this.walk.level){this.toast("\u05D4\u05E0\u05E7\u05D5\u05D3\u05D4 \u05D1\u05E7\u05D5\u05DE\u05D4 \u05D0\u05D7\u05E8\u05EA \u2014 \u05D4\u05E9\u05EA\u05DE\u05E9 \u05D1\u05DE\u05D3\u05E8\u05D2\u05D5\u05EA");return}this.walk.pathTo(a.point.x,a.point.z)||this.toast("\u05D0\u05D9\u05DF \u05DE\u05E1\u05DC\u05D5\u05DC \u05E4\u05EA\u05D5\u05D7 \u05DC\u05E0\u05E7\u05D5\u05D3\u05D4 (\u05D3\u05DC\u05EA \u05E1\u05D2\u05D5\u05E8\u05D4?)"),this.invalidate()}}}actOnCrosshair(){this.raycaster.setFromCamera(new ee(0,0),this.walkCam);let e=this.planScene.pick(this.raycaster);e&&e.distance<3.5&&this.showPopover(e,{clientX:this.canvas.clientWidth/2+this.stage.getBoundingClientRect().left,clientY:this.canvas.clientHeight/2+this.stage.getBoundingClientRect().top})}updateAim(){if(this.mode!=="walk"||this.touch){this.aimKey&&(this.aimKey=null,this.stage.classList.remove("aim"));return}this.raycaster.setFromCamera(new ee(0,0),this.walkCam);let e=this.planScene.pick(this.raycaster),t=e&&e.distance<3.5?e.entity||e.id:null;if(t!==this.aimKey&&(this.aimKey=t,this.stage.classList.toggle("aim",!!t),t)){let i=this.plan.entityNames||{};Ye("aimhint").textContent=`${e.label||i[e.entity]||e.entity||e.id} \xB7 Enter`}}showPopover(e,t){this.hidePopover();let i=se("div","popover"),n=this.stage.getBoundingClientRect();i.style.left=`${Math.min(n.width-230,Math.max(8,t.clientX-n.left-100))}px`,i.style.top=`${Math.min(n.height-140,Math.max(8,t.clientY-n.top+14))}px`;let r=this.plan.entityNames||{},o=e.entity?this.entities[e.entity]:null,a={on:"\u05D3\u05D5\u05DC\u05E7",off:"\u05DB\u05D1\u05D5\u05D9",open:"\u05E4\u05EA\u05D5\u05D7",closed:"\u05E1\u05D2\u05D5\u05E8",locked:"\u05E0\u05E2\u05D5\u05DC",unlocked:"\u05DC\u05D0 \u05E0\u05E2\u05D5\u05DC",playing:"\u05DE\u05E0\u05D2\u05DF",unavailable:"\u05DC\u05D0 \u05D6\u05DE\u05D9\u05DF",undefined:"\u05DC\u05D0 \u05D9\u05D3\u05D5\u05E2",null:"\u05DC\u05D0 \u05D9\u05D3\u05D5\u05E2"};i.appendChild(se("h4","",e.label||r[e.entity]||e.entity||e.id));let l=se("div","actions");if(e.kind==="camera"){i.appendChild(se("div","state",e.online===!1?"\u05DC\u05D0 \u05DE\u05E7\u05D5\u05D5\u05DF \xB7 \u05DE\u05E6\u05D1 \u05D9\u05E9\u05DF":"\u05DE\u05E7\u05D5\u05D5\u05DF"));let h=se("button","btn sm","\u05E2\u05DE\u05D5\u05D3 \u05D1\u05DE\u05E6\u05DC\u05DE\u05D4");h.addEventListener("click",()=>{this.hidePopover(),this.standAtCamera(this.planScene.cameras.find(f=>f.id===e.id))}),l.appendChild(h)}else if(e.domain==="light"){i.appendChild(se("div","state",o==="on"?"\u05D3\u05D5\u05DC\u05E7":"\u05DB\u05D1\u05D5\u05D9"));let h=se("button","btn sm primary",o==="on"?"\u05DB\u05D1\u05D4":"\u05D4\u05D3\u05DC\u05E7");h.addEventListener("click",()=>{this.setEntity(e.entity,o==="on"?"off":"on"),this.hidePopover()}),l.appendChild(h)}else if(e.domain==="door"){let h=e.entity&&!e.entity.startsWith("door:");if(i.appendChild(se("div","state",h?(o==="on"||o==="open"?"\u05E4\u05EA\u05D5\u05D7\u05D4":"\u05E1\u05D2\u05D5\u05E8\u05D4")+(e.lock?` \xB7 ${a[this.entities[e.lock]]}`:""):"\u05DC\u05DC\u05D0 \u05D7\u05D9\u05D9\u05E9\u05DF \u2014 \u05E2\u05D1\u05D9\u05E8\u05D4 \u05D1\u05E1\u05D9\u05D5\u05E8")),h){let f=se("button","btn sm primary",o==="on"||o==="open"?"\u05E1\u05D2\u05D5\u05E8 (\u05D3\u05DE\u05D4 \u05D7\u05D9\u05D9\u05E9\u05DF)":"\u05E4\u05EA\u05D7 (\u05D3\u05DE\u05D4 \u05D7\u05D9\u05D9\u05E9\u05DF)");f.addEventListener("click",()=>{this.setEntity(e.entity,o==="on"||o==="open"?"off":"on"),this.hidePopover()}),l.appendChild(f)}if(e.lock){let f=se("button","btn sm",this.entities[e.lock]==="locked"?"\u05E9\u05D7\u05E8\u05E8 \u05E0\u05E2\u05D9\u05DC\u05D4":"\u05E0\u05E2\u05DC");f.addEventListener("click",()=>{this.setEntity(e.lock,this.entities[e.lock]==="locked"?"unlocked":"locked"),this.hidePopover()}),l.appendChild(f)}}else if(e.kind==="lock"){i.appendChild(se("div","state",a[o]));let h=se("button","btn sm primary",o==="locked"?"\u05E9\u05D7\u05E8\u05E8 \u05E0\u05E2\u05D9\u05DC\u05D4":"\u05E0\u05E2\u05DC");h.addEventListener("click",()=>{this.setEntity(e.entity,o==="locked"?"unlocked":"locked"),this.hidePopover()}),l.appendChild(h)}else if(e.domain==="cover"){let h=this.coverPositions[e.entity]??(o==="open"?100:0);i.appendChild(se("div","state",`${h}% \u05E4\u05EA\u05D5\u05D7`));for(let f of[0,50,100]){let d=se("button","btn sm",`${f}%`);d.addEventListener("click",()=>{this.coverPositions[e.entity]=f,this.setEntity(e.entity,f>0?"open":"closed"),this.buildStatesPanel(),this.hidePopover()}),l.appendChild(d)}}else if(e.domain==="media_player"){i.appendChild(se("div","state",a[o]));let h=se("button","btn sm primary",o==="playing"?"\u05DB\u05D1\u05D4":"\u05D4\u05E4\u05E2\u05DC");h.addEventListener("click",()=>{this.setEntity(e.entity,o==="playing"?"off":"playing"),this.hidePopover()}),l.appendChild(h)}let c=se("button","btn sm","\u05E1\u05D2\u05D5\u05E8");c.addEventListener("click",()=>this.hidePopover()),l.appendChild(c),i.appendChild(l),this.stage.appendChild(i),this.popover=i}hidePopover(){this.popover&&(this.popover.remove(),this.popover=null)}layoutLabels(){let e=Ye("labels");if(this.mode==="stills"){e.innerHTML="";return}let t=this.canvas.clientWidth,i=this.canvas.clientHeight,n=this.camera;n.updateMatrixWorld();let r=new D,o=document.createDocumentFragment(),a=n.position,l=this.mode==="walk";for(let c of this.planScene.labels){let h=this.planScene.levels[c.level];if(!h||!h.group.visible||l&&c.kind==="room"||!l&&c.kind==="device"&&(!this.hover||this.hover!==c.entity)||l&&c.kind==="device"&&c.pos.distanceTo(a)>4||l&&c.kind==="camera"&&c.pos.distanceTo(a)>9||l&&c.kind==="temp"&&c.pos.distanceTo(a)>7||this.levelMode==="all"&&!l&&c.kind==="temp"&&c.level!==this.plan.doc.levels[this.plan.doc.levels.length-1].id||(r.copy(c.pos),c.offset&&!l&&(r.x+=c.offset),r.project(n),r.z>1||r.z<-1))continue;let f=(r.x+1)/2*t,d=(1-r.y)/2*i;if(f<-40||f>t+40||d<-20||d>i+20)continue;let u=se("div",`lbl ${c.kind}`);if(c.kind==="device"){let p=this.entities[c.entity],x=this.plan.entityNames||{};u.textContent=`${x[c.entity]||c.entity} \xB7 ${p==="on"?c.entity.startsWith("light.")?"\u05D3\u05D5\u05DC\u05E7":"\u05E4\u05EA\u05D5\u05D7":p==="off"?c.entity.startsWith("light.")?"\u05DB\u05D1\u05D5\u05D9":"\u05E1\u05D2\u05D5\u05E8":p||"\u2014"}`,p==="on"&&c.entity.startsWith("light.")&&u.classList.add("on"),p==="on"&&c.entity.startsWith("binary_sensor.")&&u.classList.add("open")}else u.textContent=c.text;c.kind==="camera"&&c.online===!1&&u.classList.add("off"),u.style.left=`${f}px`,u.style.top=`${d}px`,o.appendChild(u)}e.innerHTML="",e.appendChild(o)}invalidate(e=!0){this.needsFrame=!0,e&&(this.shadowDirty=!0)}frame(e){requestAnimationFrame(o=>this.frame(o));let t=Math.min(.1,(e-(this.lastT||e))/1e3);if(this.lastT=e,this.opts.idleS>0&&this.mode==="orbit"&&this.bakes[this.currentLevelId()]&&e-this.lastInput>this.opts.idleS*1e3&&(this.lastLiveQuality=this.quality,this.kioskAuto=!0,this.quality=0,this.enterStills(),this.renderBar(),this.renderLadder(),this.setNote("\u05E7\u05D9\u05D5\u05E1\u05E7: \u05D7\u05D5\u05E1\u05E8 \u05E4\u05E2\u05D9\u05DC\u05D5\u05EA \u2014 \u05E2\u05D1\u05E8\u05E0\u05D5 \u05DC\u05EA\u05DE\u05D5\u05E0\u05D4 \u05D4\u05DE\u05D5\u05DB\u05E0\u05D4, 0 \u05E4\u05E8\u05D9\u05D9\u05DE\u05D9\u05DD")),this.mode==="stills"){this.updateHud(e,!1);return}let i=!1;if(this.tween){let o=Math.min(1,(e-this.tween.t0)/this.tween.ms),a=o<.5?2*o*o:1-Math.pow(-2*o+2,2)/2;if(this.tween.step(a),i=!0,o>=1){let l=this.tween;this.tween=null,!l.pose&&this.controls&&this.mode==="orbit"&&(this.controls.enabled=!0)}}if(this.mode==="walk"&&this.walk){this.walk.step(t)&&(i=!0,this.walk.eyeOverride=null),this.walk.eyeTarget!=null&&Math.abs(this.walk.eyeTarget-this.walk.eye)>.001&&(this.walk.eye+=(this.walk.eyeTarget-this.walk.eye)*Math.min(1,t*6),i=!0);let o=this.planScene.levels[this.walk.level],a=o&&o.zones.find(c=>Pn(this.walk.x,this.walk.z,c.polyM)),l=a&&typeof a.daylight=="number"?.25+a.daylight*.75:.6;if(Math.abs(l-this.env.interiorFill)>.004&&(this.env.interiorFill+=(l-this.env.interiorFill)*Math.min(1,t*3),this.env.applyFill(),i=!0),!(this.tween&&this.tween.pose)){let c=this.walk.eyeOverride!=null?this.walk.eyeOverride:this.walk.eyeY();this.walkCam.position.set(this.walk.x,c,this.walk.z),this.walkCam.rotation.order="YXZ",this.walkCam.rotation.set(this.walk.pitch,this.walk.yaw,0)}this.updateWalkBar(),this.updateAim(),this.mmMap=dm(Ye("minimap").querySelector("canvas"),this.planScene,this.walk,{bg:document.documentElement.dataset.theme==="dark"?"rgba(21,28,44,.92)":"rgba(255,255,255,.92)"})}else this.controls&&!this.tween&&this.controls.update()&&(i=!0);this.planScene.update(t,this.camera.position,{nightFactor:this.env.recipe.night,lampShadows:this.opts.lampShadows&&this.quality>=3,coneVolumes:this.mode==="walk"&&!!this.walk&&this.walk.eyeOverride!=null})&&(i=!0,this.shadowDirty=!0);let r=this.needsFrame||i||this.continuous||this.probe;if(r){this.needsFrame=!1,(this.shadowDirty||this.probe)&&(this.env.renderer.shadowMap.needsUpdate=!0,this.shadowDirty=!1),this.env.renderer.info.autoReset=!1,this.env.renderer.info.reset();let o=performance.now();this.env.render(this.camera),this.fps.ms=this.fps.ms*.85+(performance.now()-o)*.15,this.layoutLabels(),this.fps.window.push(e),this.probeFrame(e)}this.updateHud(e,r)}updateHud(e,t){let i=this.fps.window;for(;i.length&&i[0]<e-1e3;)i.shift();if(e-this.fps.last<250)return;this.fps.last=e;let n=this.env.renderer.info,r=performance.memory?`${(performance.memory.usedJSHeapSize/1048576).toFixed(0)} MB heap`:"heap n/a",o=this.gpuName||(this.gpuName=this.env.rendererName()),a=/swiftshader|llvmpipe|software/i.test(o),l=this.mode==="stills"?"0 fps (still, no WebGL frames)":i.length?`${i.length} fps \xB7 ${this.fps.ms.toFixed(1)} ms/frame (CPU submit)`:"idle (0 fps \u2014 on-demand)";Ye("hud").innerHTML=`<b>${l}</b><br>draw ${n.render.calls} \xB7 tris ${(n.render.triangles/1e3).toFixed(0)}k \xB7 tex ${n.memory.textures} \xB7 geo ${n.memory.geometries}<br>${r} \xB7 ${this.canvas.width}\xD7${this.canvas.height} @${this.env.dpr.toFixed(2)}\xD7<br>${this.mode} \xB7 ${this.qualityLabel()}${this.probe?" \xB7 measuring\u2026":""}<br><span class="${a?"warn":""}">${a?"\u26A0 software renderer: ":"GPU: "}${o.length>60?o.slice(0,60)+"\u2026":o}</span>`}};window.Studio6App=Jc;window.STUDIO6_PLANS=Kc;/noboot/.test(location.search)||window.addEventListener("load",()=>setTimeout(()=>{let s=performance.now();window.studio6=new Jc,window.studio6.bootMs=Math.round(performance.now()-s)},30));})();
