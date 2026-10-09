/* SmplWise Arx - Plan Studio 6 prototype bundle. three.js 0.186.1 (MIT, see LICENSES.md). Built 2026-10-09. */
(()=>{var Yi={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},ji={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},Tf=0,Gh=1,Ef=2;var Zi=1,Af=2,pr=3,si=0,en=1,Ot=2,kt=0,mr=1,vs=2,Wh=3,Xh=4,bl=5;var Rn=100,Cf=101,Rf=102,Pf=103,Lf=104,ys=200,If=201,Df=202,Nf=203,qh=204,Yh=205,Ro=206,Uf=207,Po=208,Of=209,Ff=210,Bf=211,kf=212,zf=213,Hf=214,Xa=0,qa=1,Ya=2,Zs=3,ja=4,Za=5,Ka=6,Ja=7,Sl=0,Vf=1,Gf=2,wn=0,Lo=1,Io=2,Do=3,No=4,Uo=5,Oo=6,Ki=7,Eh="attached",Wf="detached",jh=300,Ji=301,Ms=302,wl=303,Tl=304,Fo=306,Kt=1e3,mn=1001,Ks=1002,bt=1003,El=1004;var bs=1005;var It=1006,gr=1007;var Gn=1008;var cn=1009,Zh=1010,Kh=1011,xr=1012,Al=1013,Wn=1014,Tn=1015,St=1016,Cl=1017,Rl=1018,Qi=1020,Jh=35902,Qh=35899,$h=1021,eu=1022,pn=1023,Jn=1026,ri=1027,Pl=1028,Ll=1029,$i=1030,Il=1031;var Dl=1033,Bo=33776,ko=33777,zo=33778,Ho=33779,Nl=35840,Ul=35841,Ol=35842,Fl=35843,Bl=36196,kl=37492,zl=37496,Hl=37488,Vl=37489,Vo=37490,Gl=37491,Wl=37808,Xl=37809,ql=37810,Yl=37811,jl=37812,Zl=37813,Kl=37814,Jl=37815,Ql=37816,$l=37817,ec=37818,tc=37819,nc=37820,ic=37821,sc=36492,rc=36494,oc=36495,ac=36283,lc=36284,Go=36285,cc=36286;var ls=2300,cs=2301,Va=2302,Ah=2303,Ch=2400,Rh=2401,Ph=2402,Xf=2500;var tu=0,Wo=1,_r=2,qf=3200;var vr=0,Yf=1,Pn="",Mt="srgb",fn="srgb-linear",jr="linear",ht="srgb";var Ga=7680;var jf=519,Zf=512,Kf=513,Jf=514,hc=515,Qf=516,$f=517,uc=518,ep=519,nu=35044;var iu="300 es",zn=2e3,Js=2001;function Lm(s){for(let e=s.length-1;e>=0;--e)if(s[e]>=65535)return!0;return!1}function Im(s){return ArrayBuffer.isView(s)&&!(s instanceof DataView)}function Qs(s){return document.createElementNS("http://www.w3.org/1999/xhtml",s)}function tp(){let s=Qs("canvas");return s.style.display="block",s}var Ld={},$s=null;function Zr(...s){let e="THREE."+s.shift();$s?$s("log",e,...s):console.log(e,...s)}function np(s){let e=s[0];if(typeof e=="string"&&e.startsWith("TSL:")){let t=s[1];t&&t.isStackTrace?s[0]+=" "+t.getLocation():s[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return s}function Ge(...s){s=np(s);let e="THREE."+s.shift();if($s)$s("warn",e,...s);else{let t=s[0];t&&t.isStackTrace?console.warn(t.getError(e)):console.warn(e,...s)}}function Ze(...s){s=np(s);let e="THREE."+s.shift();if($s)$s("error",e,...s);else{let t=s[0];t&&t.isStackTrace?console.error(t.getError(e)):console.error(e,...s)}}function as(...s){let e=s.join(" ");e in Ld||(Ld[e]=!0,Ge(...s))}function ip(s,e,t){return new Promise(function(n,i){function r(){switch(s.clientWaitSync(e,s.SYNC_FLUSH_COMMANDS_BIT,0)){case s.WAIT_FAILED:i();break;case s.TIMEOUT_EXPIRED:setTimeout(r,t);break;default:n()}}setTimeout(r,t)})}var sp={[Xa]:qa,[Ya]:Ka,[ja]:Ja,[Zs]:Za,[qa]:Xa,[Ka]:Ya,[Ja]:ja,[Za]:Zs},Hn=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){let n=this._listeners;return n===void 0?!1:n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){let n=this._listeners;if(n===void 0)return;let i=n[e];if(i!==void 0){let r=i.indexOf(t);r!==-1&&i.splice(r,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let n=t[e.type];if(n!==void 0){e.target=this;let i=n.slice(0);for(let r=0,o=i.length;r<o;r++)i[r].call(this,e);e.target=null}}},sn=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],Id=1234567,Wr=Math.PI/180,hs=180/Math.PI;function Cn(){let s=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(sn[s&255]+sn[s>>8&255]+sn[s>>16&255]+sn[s>>24&255]+"-"+sn[e&255]+sn[e>>8&255]+"-"+sn[e>>16&15|64]+sn[e>>24&255]+"-"+sn[t&63|128]+sn[t>>8&255]+"-"+sn[t>>16&255]+sn[t>>24&255]+sn[n&255]+sn[n>>8&255]+sn[n>>16&255]+sn[n>>24&255]).toLowerCase()}function nt(s,e,t){return Math.max(e,Math.min(t,s))}function su(s,e){return(s%e+e)%e}function Dm(s,e,t,n,i){return n+(s-e)*(i-n)/(t-e)}function Nm(s,e,t){return s!==e?(t-s)/(e-s):0}function Xr(s,e,t){return(1-t)*s+t*e}function Um(s,e,t,n){return Xr(s,e,1-Math.exp(-t*n))}function Om(s,e=1){return e-Math.abs(su(s,e*2)-e)}function Fm(s,e,t){return s<=e?0:s>=t?1:(s=(s-e)/(t-e),s*s*(3-2*s))}function Bm(s,e,t){return s<=e?0:s>=t?1:(s=(s-e)/(t-e),s*s*s*(s*(s*6-15)+10))}function km(s,e){return s+Math.floor(Math.random()*(e-s+1))}function zm(s,e){return s+Math.random()*(e-s)}function Hm(s){return s*(.5-Math.random())}function Vm(s){s!==void 0&&(Id=s);let e=Id+=1831565813;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}function Gm(s){return s*Wr}function Wm(s){return s*hs}function Xm(s){return s>0&&Number.isInteger(s)&&2**Math.round(Math.log2(s))===s}function qm(s){return Math.pow(2,Math.ceil(Math.log(s)/Math.LN2))}function Ym(s){return Math.pow(2,Math.floor(Math.log(s)/Math.LN2))}function jm(s,e,t,n,i){let r=Math.cos,o=Math.sin,a=r(t/2),l=o(t/2),c=r((e+n)/2),h=o((e+n)/2),f=r((e-n)/2),d=o((e-n)/2),u=r((n-e)/2),p=o((n-e)/2);switch(i){case"XYX":s.set(a*h,l*f,l*d,a*c);break;case"YZY":s.set(l*d,a*h,l*f,a*c);break;case"ZXZ":s.set(l*f,l*d,a*h,a*c);break;case"XZX":s.set(a*h,l*p,l*u,a*c);break;case"YXY":s.set(l*u,a*h,l*p,a*c);break;case"ZYZ":s.set(l*p,l*u,a*h,a*c);break;default:Ge("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+i)}}function kn(s,e){switch(e.constructor){case Float32Array:return s;case Uint32Array:return s/4294967295;case Uint16Array:return s/65535;case Uint8Array:case Uint8ClampedArray:return s/255;case Int32Array:return Math.max(s/2147483647,-1);case Int16Array:return Math.max(s/32767,-1);case Int8Array:return Math.max(s/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function mt(s,e){switch(e.constructor){case Float32Array:return s;case Uint32Array:return Math.round(s*4294967295);case Uint16Array:return Math.round(s*65535);case Uint8Array:case Uint8ClampedArray:return Math.round(s*255);case Int32Array:return Math.round(s*2147483647);case Int16Array:return Math.round(s*32767);case Int8Array:return Math.round(s*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var Xo={DEG2RAD:Wr,RAD2DEG:hs,generateUUID:Cn,clamp:nt,euclideanModulo:su,mapLinear:Dm,inverseLerp:Nm,lerp:Xr,damp:Um,pingpong:Om,smoothstep:Fm,smootherstep:Bm,randInt:km,randFloat:zm,randFloatSpread:Hm,seededRandom:Vm,degToRad:Gm,radToDeg:Wm,isPowerOfTwo:Xm,ceilPowerOfTwo:qm,floorPowerOfTwo:Ym,setQuaternionFromProperEuler:jm,normalize:mt,denormalize:kn},hu=class hu{constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,i=e.elements;return this.x=i[0]*t+i[3]*n+i[6],this.y=i[1]*t+i[4]*n+i[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=nt(this.x,e.x,t.x),this.y=nt(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=nt(this.x,e,t),this.y=nt(this.y,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(nt(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(nt(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),i=Math.sin(t),r=this.x-e.x,o=this.y-e.y;return this.x=r*n-o*i+e.x,this.y=r*i+o*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}};hu.prototype.isVector2=!0;var ee=hu,on=class{constructor(e=0,t=0,n=0,i=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=i}static slerpFlat(e,t,n,i,r,o,a){let l=n[i+0],c=n[i+1],h=n[i+2],f=n[i+3],d=r[o+0],u=r[o+1],p=r[o+2],x=r[o+3];if(f!==x||l!==d||c!==u||h!==p){let m=l*d+c*u+h*p+f*x;m<0&&(d=-d,u=-u,p=-p,x=-x,m=-m);let g=1-a;if(m<.9995){let b=Math.acos(m),T=Math.sin(b);g=Math.sin(g*b)/T,a=Math.sin(a*b)/T,l=l*g+d*a,c=c*g+u*a,h=h*g+p*a,f=f*g+x*a}else{l=l*g+d*a,c=c*g+u*a,h=h*g+p*a,f=f*g+x*a;let b=1/Math.sqrt(l*l+c*c+h*h+f*f);l*=b,c*=b,h*=b,f*=b}}e[t]=l,e[t+1]=c,e[t+2]=h,e[t+3]=f}static multiplyQuaternionsFlat(e,t,n,i,r,o){let a=n[i],l=n[i+1],c=n[i+2],h=n[i+3],f=r[o],d=r[o+1],u=r[o+2],p=r[o+3];return e[t]=a*p+h*f+l*u-c*d,e[t+1]=l*p+h*d+c*f-a*u,e[t+2]=c*p+h*u+a*d-l*f,e[t+3]=h*p-a*f-l*d-c*u,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,i){return this._x=e,this._y=t,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let n=e._x,i=e._y,r=e._z,o=e._order,a=Math.cos,l=Math.sin,c=a(n/2),h=a(i/2),f=a(r/2),d=l(n/2),u=l(i/2),p=l(r/2);switch(o){case"XYZ":this._x=d*h*f+c*u*p,this._y=c*u*f-d*h*p,this._z=c*h*p+d*u*f,this._w=c*h*f-d*u*p;break;case"YXZ":this._x=d*h*f+c*u*p,this._y=c*u*f-d*h*p,this._z=c*h*p-d*u*f,this._w=c*h*f+d*u*p;break;case"ZXY":this._x=d*h*f-c*u*p,this._y=c*u*f+d*h*p,this._z=c*h*p+d*u*f,this._w=c*h*f-d*u*p;break;case"ZYX":this._x=d*h*f-c*u*p,this._y=c*u*f+d*h*p,this._z=c*h*p-d*u*f,this._w=c*h*f+d*u*p;break;case"YZX":this._x=d*h*f+c*u*p,this._y=c*u*f+d*h*p,this._z=c*h*p-d*u*f,this._w=c*h*f-d*u*p;break;case"XZY":this._x=d*h*f-c*u*p,this._y=c*u*f-d*h*p,this._z=c*h*p+d*u*f,this._w=c*h*f+d*u*p;break;default:Ge("Quaternion: .setFromEuler() encountered an unknown order: "+o)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let n=t/2,i=Math.sin(n);return this._x=e.x*i,this._y=e.y*i,this._z=e.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],i=t[4],r=t[8],o=t[1],a=t[5],l=t[9],c=t[2],h=t[6],f=t[10],d=n+a+f;if(d>0){let u=.5/Math.sqrt(d+1);this._w=.25/u,this._x=(h-l)*u,this._y=(r-c)*u,this._z=(o-i)*u}else if(n>a&&n>f){let u=2*Math.sqrt(1+n-a-f);this._w=(h-l)/u,this._x=.25*u,this._y=(i+o)/u,this._z=(r+c)/u}else if(a>f){let u=2*Math.sqrt(1+a-n-f);this._w=(r-c)/u,this._x=(i+o)/u,this._y=.25*u,this._z=(l+h)/u}else{let u=2*Math.sqrt(1+f-n-a);this._w=(o-i)/u,this._x=(r+c)/u,this._y=(l+h)/u,this._z=.25*u}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(nt(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let i=Math.min(1,t/n);return this.slerp(e,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let n=e._x,i=e._y,r=e._z,o=e._w,a=t._x,l=t._y,c=t._z,h=t._w;return this._x=n*h+o*a+i*c-r*l,this._y=i*h+o*l+r*a-n*c,this._z=r*h+o*c+n*l-i*a,this._w=o*h-n*a-i*l-r*c,this._onChangeCallback(),this}slerp(e,t){let n=e._x,i=e._y,r=e._z,o=e._w,a=this.dot(e);a<0&&(n=-n,i=-i,r=-r,o=-o,a=-a);let l=1-t;if(a<.9995){let c=Math.acos(a),h=Math.sin(c);l=Math.sin(l*c)/h,t=Math.sin(t*c)/h,this._x=this._x*l+n*t,this._y=this._y*l+i*t,this._z=this._z*l+r*t,this._w=this._w*l+o*t,this._onChangeCallback()}else this._x=this._x*l+n*t,this._y=this._y*l+i*t,this._z=this._z*l+r*t,this._w=this._w*l+o*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),i=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(i*Math.sin(e),i*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},uu=class uu{constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Dd.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Dd.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,i=this.z,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6]*i,this.y=r[1]*t+r[4]*n+r[7]*i,this.z=r[2]*t+r[5]*n+r[8]*i,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,i=this.z,r=e.elements,o=1/(r[3]*t+r[7]*n+r[11]*i+r[15]);return this.x=(r[0]*t+r[4]*n+r[8]*i+r[12])*o,this.y=(r[1]*t+r[5]*n+r[9]*i+r[13])*o,this.z=(r[2]*t+r[6]*n+r[10]*i+r[14])*o,this}applyQuaternion(e){let t=this.x,n=this.y,i=this.z,r=e.x,o=e.y,a=e.z,l=e.w,c=2*(o*i-a*n),h=2*(a*t-r*i),f=2*(r*n-o*t);return this.x=t+l*c+o*f-a*h,this.y=n+l*h+a*c-r*f,this.z=i+l*f+r*h-o*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,i=this.z,r=e.elements;return this.x=r[0]*t+r[4]*n+r[8]*i,this.y=r[1]*t+r[5]*n+r[9]*i,this.z=r[2]*t+r[6]*n+r[10]*i,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=nt(this.x,e.x,t.x),this.y=nt(this.y,e.y,t.y),this.z=nt(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=nt(this.x,e,t),this.y=nt(this.y,e,t),this.z=nt(this.z,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(nt(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let n=e.x,i=e.y,r=e.z,o=t.x,a=t.y,l=t.z;return this.x=i*l-r*a,this.y=r*o-n*l,this.z=n*a-i*o,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return Qc.copy(this).projectOnVector(e),this.sub(Qc)}reflect(e){return this.sub(Qc.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(nt(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,i=this.z-e.z;return t*t+n*n+i*i}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let i=Math.sin(t)*e;return this.x=i*Math.sin(n),this.y=Math.cos(t)*e,this.z=i*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),i=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=i,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}};uu.prototype.isVector3=!0;var D=uu,Qc=new D,Dd=new on,du=class du{constructor(e,t,n,i,r,o,a,l,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,i,r,o,a,l,c)}set(e,t,n,i,r,o,a,l,c){let h=this.elements;return h[0]=e,h[1]=i,h[2]=a,h[3]=t,h[4]=r,h[5]=l,h[6]=n,h[7]=o,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,i=t.elements,r=this.elements,o=n[0],a=n[3],l=n[6],c=n[1],h=n[4],f=n[7],d=n[2],u=n[5],p=n[8],x=i[0],m=i[3],g=i[6],b=i[1],T=i[4],_=i[7],M=i[2],E=i[5],A=i[8];return r[0]=o*x+a*b+l*M,r[3]=o*m+a*T+l*E,r[6]=o*g+a*_+l*A,r[1]=c*x+h*b+f*M,r[4]=c*m+h*T+f*E,r[7]=c*g+h*_+f*A,r[2]=d*x+u*b+p*M,r[5]=d*m+u*T+p*E,r[8]=d*g+u*_+p*A,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],o=e[4],a=e[5],l=e[6],c=e[7],h=e[8];return t*o*h-t*a*c-n*r*h+n*a*l+i*r*c-i*o*l}invert(){let e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],o=e[4],a=e[5],l=e[6],c=e[7],h=e[8],f=h*o-a*c,d=a*l-h*r,u=c*r-o*l,p=t*f+n*d+i*u;if(p===0)return this.set(0,0,0,0,0,0,0,0,0);let x=1/p;return e[0]=f*x,e[1]=(i*c-h*n)*x,e[2]=(a*n-i*o)*x,e[3]=d*x,e[4]=(h*t-i*l)*x,e[5]=(i*r-a*t)*x,e[6]=u*x,e[7]=(n*l-c*t)*x,e[8]=(o*t-n*r)*x,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,i,r,o,a){let l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*o+c*a)+o+e,-i*c,i*l,-i*(-c*o+l*a)+a+t,0,0,1),this}scale(e,t){return as("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply($c.makeScale(e,t)),this}rotate(e){return as("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply($c.makeRotation(-e)),this}translate(e,t){return as("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply($c.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,n=e.elements;for(let i=0;i<9;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}};du.prototype.isMatrix3=!0;var Qe=du,$c=new Qe,Nd=new Qe().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Ud=new Qe().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Zm(){let s={enabled:!0,workingColorSpace:fn,spaces:{},convert:function(i,r,o){return this.enabled===!1||r===o||!r||!o||(this.spaces[r].transfer===ht&&(i.r=yi(i.r),i.g=yi(i.g),i.b=yi(i.b)),this.spaces[r].primaries!==this.spaces[o].primaries&&(i.applyMatrix3(this.spaces[r].toXYZ),i.applyMatrix3(this.spaces[o].fromXYZ)),this.spaces[o].transfer===ht&&(i.r=js(i.r),i.g=js(i.g),i.b=js(i.b))),i},workingToColorSpace:function(i,r){return this.convert(i,this.workingColorSpace,r)},colorSpaceToWorking:function(i,r){return this.convert(i,r,this.workingColorSpace)},getPrimaries:function(i){return this.spaces[i].primaries},getTransfer:function(i){return i===Pn?jr:this.spaces[i].transfer},getToneMappingMode:function(i){return this.spaces[i].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(i,r=this.workingColorSpace){return i.fromArray(this.spaces[r].luminanceCoefficients)},define:function(i){Object.assign(this.spaces,i)},_getMatrix:function(i,r,o){return i.copy(this.spaces[r].toXYZ).multiply(this.spaces[o].fromXYZ)},_getDrawingBufferColorSpace:function(i){return this.spaces[i].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(i=this.workingColorSpace){return this.spaces[i].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(i,r){return as("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),s.workingToColorSpace(i,r)},toWorkingColorSpace:function(i,r){return as("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),s.colorSpaceToWorking(i,r)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],n=[.3127,.329];return s.define({[fn]:{primaries:e,whitePoint:n,transfer:jr,toXYZ:Nd,fromXYZ:Ud,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:Mt},outputColorSpaceConfig:{drawingBufferColorSpace:Mt}},[Mt]:{primaries:e,whitePoint:n,transfer:ht,toXYZ:Nd,fromXYZ:Ud,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:Mt}}}),s}var tt=Zm();function yi(s){return s<.04045?s*.0773993808:Math.pow(s*.9478672986+.0521327014,2.4)}function js(s){return s<.0031308?s*12.92:1.055*Math.pow(s,.41666)-.055}var Ps,Qa=class{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{Ps===void 0&&(Ps=Qs("canvas")),Ps.width=e.width,Ps.height=e.height;let i=Ps.getContext("2d");e instanceof ImageData?i.putImageData(e,0,0):i.drawImage(e,0,0,e.width,e.height),n=Ps}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){let t=Qs("canvas");t.width=e.width,t.height=e.height;let n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);let i=n.getImageData(0,0,e.width,e.height),r=i.data;for(let o=0;o<r.length;o++)r[o]=yi(r[o]/255)*255;return n.putImageData(i,0,0),t}else if(e.data){let t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(yi(t[n]/255)*255):t[n]=yi(t[n]);return{data:t,width:e.width,height:e.height}}else return Ge("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}},Km=0,er=class{constructor(e=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:Km++}),this.uuid=Cn(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let n={uuid:this.uuid,url:""},i=this.data;if(i!==null){let r;if(Array.isArray(i)){r=[];for(let o=0,a=i.length;o<a;o++)i[o].isDataTexture?r.push(eh(i[o].image)):r.push(eh(i[o]))}else r=eh(i);n.url=r}return t||(e.images[this.uuid]=n),n}};function eh(s){return typeof HTMLImageElement<"u"&&s instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&s instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&s instanceof ImageBitmap?Qa.getDataURL(s):s.data?{data:Array.from(s.data),width:s.width,height:s.height,type:s.data.constructor.name}:(Ge("Texture: Unable to serialize Texture."),{})}var Jm=0,th=new D,Ut=class s extends Hn{constructor(e=s.DEFAULT_IMAGE,t=s.DEFAULT_MAPPING,n=mn,i=mn,r=It,o=Gn,a=pn,l=cn,c=s.DEFAULT_ANISOTROPY,h=Pn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Jm++}),this.uuid=Cn(),this.name="",this.source=new er(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=i,this.magFilter=r,this.minFilter=o,this.anisotropy=c,this.format=a,this.internalFormat=null,this.type=l,this.offset=new ee(0,0),this.repeat=new ee(1,1),this.center=new ee(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Qe,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(th).x}get height(){return this.source.getSize(th).y}get depth(){return this.source.getSize(th).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let n=e[t];if(n===void 0){Ge(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let i=this[t];if(i===void 0){Ge(`Texture.setValues(): property '${t}' does not exist.`);continue}i&&n&&i.isVector2&&n.isVector2||i&&n&&i.isVector3&&n.isVector3||i&&n&&i.isMatrix3&&n.isMatrix3?i.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==jh)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case Kt:e.x=e.x-Math.floor(e.x);break;case mn:e.x=e.x<0?0:1;break;case Ks:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case Kt:e.y=e.y-Math.floor(e.y);break;case mn:e.y=e.y<0?0:1;break;case Ks:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};Ut.DEFAULT_IMAGE=null;Ut.DEFAULT_MAPPING=jh;Ut.DEFAULT_ANISOTROPY=1;var fu=class fu{constructor(e=0,t=0,n=0,i=1){this.x=e,this.y=t,this.z=n,this.w=i}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,i){return this.x=e,this.y=t,this.z=n,this.w=i,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,i=this.z,r=this.w,o=e.elements;return this.x=o[0]*t+o[4]*n+o[8]*i+o[12]*r,this.y=o[1]*t+o[5]*n+o[9]*i+o[13]*r,this.z=o[2]*t+o[6]*n+o[10]*i+o[14]*r,this.w=o[3]*t+o[7]*n+o[11]*i+o[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,i,r,l=e.elements,c=l[0],h=l[4],f=l[8],d=l[1],u=l[5],p=l[9],x=l[2],m=l[6],g=l[10];if(Math.abs(h-d)<.01&&Math.abs(f-x)<.01&&Math.abs(p-m)<.01){if(Math.abs(h+d)<.1&&Math.abs(f+x)<.1&&Math.abs(p+m)<.1&&Math.abs(c+u+g-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;let T=(c+1)/2,_=(u+1)/2,M=(g+1)/2,E=(h+d)/4,A=(f+x)/4,v=(p+m)/4;return T>_&&T>M?T<.01?(n=0,i=.707106781,r=.707106781):(n=Math.sqrt(T),i=E/n,r=A/n):_>M?_<.01?(n=.707106781,i=0,r=.707106781):(i=Math.sqrt(_),n=E/i,r=v/i):M<.01?(n=.707106781,i=.707106781,r=0):(r=Math.sqrt(M),n=A/r,i=v/r),this.set(n,i,r,t),this}let b=Math.sqrt((m-p)*(m-p)+(f-x)*(f-x)+(d-h)*(d-h));return Math.abs(b)<.001&&(b=1),this.x=(m-p)/b,this.y=(f-x)/b,this.z=(d-h)/b,this.w=Math.acos((c+u+g-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=nt(this.x,e.x,t.x),this.y=nt(this.y,e.y,t.y),this.z=nt(this.z,e.z,t.z),this.w=nt(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=nt(this.x,e,t),this.y=nt(this.y,e,t),this.z=nt(this.z,e,t),this.w=nt(this.w,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(nt(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}};fu.prototype.isVector4=!0;var ut=fu,$a=class extends Hn{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:It,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new ut(0,0,e,t),this.scissorTest=!1,this.viewport=new ut(0,0,e,t),this.textures=[];let i={width:e,height:t,depth:n.depth},r=new Ut(i),o=n.count;for(let a=0;a<o;a++)this.textures[a]=r.clone(),this.textures[a].isRenderTargetTexture=!0,this.textures[a].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveColorBuffer=n.resolveColorBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.storeMultisampledColorBuffer=n.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=n.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=n.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(e={}){let t={minFilter:It,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&this._depthTexture.renderTarget===this&&(this._depthTexture.renderTarget=null),e!==null&&e.renderTarget===null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let i=0,r=this.textures.length;i<r;i++)this.textures[i].image.width=e,this.textures[i].image.height=t,this.textures[i].image.depth=n,this.textures[i].isData3DTexture!==!0&&(this.textures[i].isArrayTexture=this.textures[i].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let i=Object.assign({},e.textures[t].image);this.textures[t].source=new er(i)}if(this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveColorBuffer=e.resolveColorBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,this.storeMultisampledColorBuffer=e.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=e.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=e.storeMultisampledStencilBuffer,e.depthTexture!==null)if(e.depthTexture.renderTarget===e){let t=e.depthTexture.clone();t.renderTarget=null,this.depthTexture=t}else this.depthTexture=e.depthTexture;return this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},dt=class extends $a{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}},Kr=class extends Ut{constructor(e=null,t=1,n=1,i=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=bt,this.minFilter=bt,this.wrapR=mn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}};var el=class extends Ut{constructor(e=null,t=1,n=1,i=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:i},this.magFilter=bt,this.minFilter=bt,this.wrapR=mn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}};var Ml=class Ml{constructor(e,t,n,i,r,o,a,l,c,h,f,d,u,p,x,m){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,i,r,o,a,l,c,h,f,d,u,p,x,m)}set(e,t,n,i,r,o,a,l,c,h,f,d,u,p,x,m){let g=this.elements;return g[0]=e,g[4]=t,g[8]=n,g[12]=i,g[1]=r,g[5]=o,g[9]=a,g[13]=l,g[2]=c,g[6]=h,g[10]=f,g[14]=d,g[3]=u,g[7]=p,g[11]=x,g[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Ml().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();let t=this.elements,n=e.elements,i=1/Ls.setFromMatrixColumn(e,0).length(),r=1/Ls.setFromMatrixColumn(e,1).length(),o=1/Ls.setFromMatrixColumn(e,2).length();return t[0]=n[0]*i,t[1]=n[1]*i,t[2]=n[2]*i,t[3]=0,t[4]=n[4]*r,t[5]=n[5]*r,t[6]=n[6]*r,t[7]=0,t[8]=n[8]*o,t[9]=n[9]*o,t[10]=n[10]*o,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,n=e.x,i=e.y,r=e.z,o=Math.cos(n),a=Math.sin(n),l=Math.cos(i),c=Math.sin(i),h=Math.cos(r),f=Math.sin(r);if(e.order==="XYZ"){let d=o*h,u=o*f,p=a*h,x=a*f;t[0]=l*h,t[4]=-l*f,t[8]=c,t[1]=u+p*c,t[5]=d-x*c,t[9]=-a*l,t[2]=x-d*c,t[6]=p+u*c,t[10]=o*l}else if(e.order==="YXZ"){let d=l*h,u=l*f,p=c*h,x=c*f;t[0]=d+x*a,t[4]=p*a-u,t[8]=o*c,t[1]=o*f,t[5]=o*h,t[9]=-a,t[2]=u*a-p,t[6]=x+d*a,t[10]=o*l}else if(e.order==="ZXY"){let d=l*h,u=l*f,p=c*h,x=c*f;t[0]=d-x*a,t[4]=-o*f,t[8]=p+u*a,t[1]=u+p*a,t[5]=o*h,t[9]=x-d*a,t[2]=-o*c,t[6]=a,t[10]=o*l}else if(e.order==="ZYX"){let d=o*h,u=o*f,p=a*h,x=a*f;t[0]=l*h,t[4]=p*c-u,t[8]=d*c+x,t[1]=l*f,t[5]=x*c+d,t[9]=u*c-p,t[2]=-c,t[6]=a*l,t[10]=o*l}else if(e.order==="YZX"){let d=o*l,u=o*c,p=a*l,x=a*c;t[0]=l*h,t[4]=x-d*f,t[8]=p*f+u,t[1]=f,t[5]=o*h,t[9]=-a*h,t[2]=-c*h,t[6]=u*f+p,t[10]=d-x*f}else if(e.order==="XZY"){let d=o*l,u=o*c,p=a*l,x=a*c;t[0]=l*h,t[4]=-f,t[8]=c*h,t[1]=d*f+x,t[5]=o*h,t[9]=u*f-p,t[2]=p*f-u,t[6]=a*h,t[10]=x*f+d}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Qm,e,$m)}lookAt(e,t,n){let i=this.elements;return yn.subVectors(e,t),yn.lengthSq()===0&&(yn.z=1),yn.normalize(),Ni.crossVectors(n,yn),Ni.lengthSq()===0&&(Math.abs(n.z)===1?yn.x+=1e-4:yn.z+=1e-4,yn.normalize(),Ni.crossVectors(n,yn)),Ni.normalize(),da.crossVectors(yn,Ni),i[0]=Ni.x,i[4]=da.x,i[8]=yn.x,i[1]=Ni.y,i[5]=da.y,i[9]=yn.y,i[2]=Ni.z,i[6]=da.z,i[10]=yn.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,i=t.elements,r=this.elements,o=n[0],a=n[4],l=n[8],c=n[12],h=n[1],f=n[5],d=n[9],u=n[13],p=n[2],x=n[6],m=n[10],g=n[14],b=n[3],T=n[7],_=n[11],M=n[15],E=i[0],A=i[4],v=i[8],R=i[12],N=i[1],L=i[5],S=i[9],w=i[13],P=i[2],U=i[6],F=i[10],O=i[14],H=i[3],k=i[7],W=i[11],Z=i[15];return r[0]=o*E+a*N+l*P+c*H,r[4]=o*A+a*L+l*U+c*k,r[8]=o*v+a*S+l*F+c*W,r[12]=o*R+a*w+l*O+c*Z,r[1]=h*E+f*N+d*P+u*H,r[5]=h*A+f*L+d*U+u*k,r[9]=h*v+f*S+d*F+u*W,r[13]=h*R+f*w+d*O+u*Z,r[2]=p*E+x*N+m*P+g*H,r[6]=p*A+x*L+m*U+g*k,r[10]=p*v+x*S+m*F+g*W,r[14]=p*R+x*w+m*O+g*Z,r[3]=b*E+T*N+_*P+M*H,r[7]=b*A+T*L+_*U+M*k,r[11]=b*v+T*S+_*F+M*W,r[15]=b*R+T*w+_*O+M*Z,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],i=e[8],r=e[12],o=e[1],a=e[5],l=e[9],c=e[13],h=e[2],f=e[6],d=e[10],u=e[14],p=e[3],x=e[7],m=e[11],g=e[15],b=l*u-c*d,T=a*u-c*f,_=a*d-l*f,M=o*u-c*h,E=o*d-l*h,A=o*f-a*h;return t*(x*b-m*T+g*_)-n*(p*b-m*M+g*E)+i*(p*T-x*M+g*A)-r*(p*_-x*E+m*A)}determinantAffine(){let e=this.elements,t=e[0],n=e[4],i=e[8],r=e[1],o=e[5],a=e[9],l=e[2],c=e[6],h=e[10];return t*(o*h-a*c)-n*(r*h-a*l)+i*(r*c-o*l)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let i=this.elements;return e.isVector3?(i[12]=e.x,i[13]=e.y,i[14]=e.z):(i[12]=e,i[13]=t,i[14]=n),this}invert(){let e=this.elements,t=e[0],n=e[1],i=e[2],r=e[3],o=e[4],a=e[5],l=e[6],c=e[7],h=e[8],f=e[9],d=e[10],u=e[11],p=e[12],x=e[13],m=e[14],g=e[15],b=t*a-n*o,T=t*l-i*o,_=t*c-r*o,M=n*l-i*a,E=n*c-r*a,A=i*c-r*l,v=h*x-f*p,R=h*m-d*p,N=h*g-u*p,L=f*m-d*x,S=f*g-u*x,w=d*g-u*m,P=b*w-T*S+_*L+M*N-E*R+A*v;if(P===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let U=1/P;return e[0]=(a*w-l*S+c*L)*U,e[1]=(i*S-n*w-r*L)*U,e[2]=(x*A-m*E+g*M)*U,e[3]=(d*E-f*A-u*M)*U,e[4]=(l*N-o*w-c*R)*U,e[5]=(t*w-i*N+r*R)*U,e[6]=(m*_-p*A-g*T)*U,e[7]=(h*A-d*_+u*T)*U,e[8]=(o*S-a*N+c*v)*U,e[9]=(n*N-t*S-r*v)*U,e[10]=(p*E-x*_+g*b)*U,e[11]=(f*_-h*E-u*b)*U,e[12]=(a*R-o*L-l*v)*U,e[13]=(t*L-n*R+i*v)*U,e[14]=(x*T-p*M-m*b)*U,e[15]=(h*M-f*T+d*b)*U,this}scale(e){let t=this.elements,n=e.x,i=e.y,r=e.z;return t[0]*=n,t[4]*=i,t[8]*=r,t[1]*=n,t[5]*=i,t[9]*=r,t[2]*=n,t[6]*=i,t[10]*=r,t[3]*=n,t[7]*=i,t[11]*=r,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],i=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,i))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),i=Math.sin(t),r=1-n,o=e.x,a=e.y,l=e.z,c=r*o,h=r*a;return this.set(c*o+n,c*a-i*l,c*l+i*a,0,c*a+i*l,h*a+n,h*l-i*o,0,c*l-i*a,h*l+i*o,r*l*l+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,i,r,o){return this.set(1,n,r,0,e,1,o,0,t,i,1,0,0,0,0,1),this}compose(e,t,n){let i=this.elements,r=t._x,o=t._y,a=t._z,l=t._w,c=r+r,h=o+o,f=a+a,d=r*c,u=r*h,p=r*f,x=o*h,m=o*f,g=a*f,b=l*c,T=l*h,_=l*f,M=n.x,E=n.y,A=n.z;return i[0]=(1-(x+g))*M,i[1]=(u+_)*M,i[2]=(p-T)*M,i[3]=0,i[4]=(u-_)*E,i[5]=(1-(d+g))*E,i[6]=(m+b)*E,i[7]=0,i[8]=(p+T)*A,i[9]=(m-b)*A,i[10]=(1-(d+x))*A,i[11]=0,i[12]=e.x,i[13]=e.y,i[14]=e.z,i[15]=1,this}decompose(e,t,n){let i=this.elements;e.x=i[12],e.y=i[13],e.z=i[14];let r=this.determinantAffine();if(r===0)return n.set(1,1,1),t.identity(),this;let o=Ls.set(i[0],i[1],i[2]).length(),a=Ls.set(i[4],i[5],i[6]).length(),l=Ls.set(i[8],i[9],i[10]).length();r<0&&(o=-o),On.copy(this);let c=1/o,h=1/a,f=1/l;return On.elements[0]*=c,On.elements[1]*=c,On.elements[2]*=c,On.elements[4]*=h,On.elements[5]*=h,On.elements[6]*=h,On.elements[8]*=f,On.elements[9]*=f,On.elements[10]*=f,t.setFromRotationMatrix(On),n.x=o,n.y=a,n.z=l,this}makePerspective(e,t,n,i,r,o,a=zn,l=!1){let c=this.elements,h=2*r/(t-e),f=2*r/(n-i),d=(t+e)/(t-e),u=(n+i)/(n-i),p,x;if(l)p=r/(o-r),x=o*r/(o-r);else if(a===zn)p=-(o+r)/(o-r),x=-2*o*r/(o-r);else if(a===Js)p=-o/(o-r),x=-o*r/(o-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return c[0]=h,c[4]=0,c[8]=d,c[12]=0,c[1]=0,c[5]=f,c[9]=u,c[13]=0,c[2]=0,c[6]=0,c[10]=p,c[14]=x,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,n,i,r,o,a=zn,l=!1){let c=this.elements,h=2/(t-e),f=2/(n-i),d=-(t+e)/(t-e),u=-(n+i)/(n-i),p,x;if(l)p=1/(o-r),x=o/(o-r);else if(a===zn)p=-2/(o-r),x=-(o+r)/(o-r);else if(a===Js)p=-1/(o-r),x=-r/(o-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return c[0]=h,c[4]=0,c[8]=0,c[12]=d,c[1]=0,c[5]=f,c[9]=0,c[13]=u,c[2]=0,c[6]=0,c[10]=p,c[14]=x,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let i=0;i<16;i++)if(t[i]!==n[i])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}};Ml.prototype.isMatrix4=!0;var je=Ml,Ls=new D,On=new je,Qm=new D(0,0,0),$m=new D(1,1,1),Ni=new D,da=new D,yn=new D,Od=new je,Fd=new on,Qn=class s{constructor(e=0,t=0,n=0,i=s.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=i}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,i=this._order){return this._x=e,this._y=t,this._z=n,this._order=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){let i=e.elements,r=i[0],o=i[4],a=i[8],l=i[1],c=i[5],h=i[9],f=i[2],d=i[6],u=i[10];switch(t){case"XYZ":this._y=Math.asin(nt(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-h,u),this._z=Math.atan2(-o,r)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-nt(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(a,u),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-f,r),this._z=0);break;case"ZXY":this._x=Math.asin(nt(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-f,u),this._z=Math.atan2(-o,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-nt(f,-1,1)),Math.abs(f)<.9999999?(this._x=Math.atan2(d,u),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-o,c));break;case"YZX":this._z=Math.asin(nt(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-f,r)):(this._x=0,this._y=Math.atan2(a,u));break;case"XZY":this._z=Math.asin(-nt(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(a,r)):(this._x=Math.atan2(-h,u),this._y=0);break;default:Ge("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return Od.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Od,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return Fd.setFromEuler(this),this.setFromQuaternion(Fd,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Qn.DEFAULT_ORDER="XYZ";var tr=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}},e0=0,Bd=new D,Is=new on,fi=new je,fa=new D,Ir=new D,t0=new D,n0=new on,kd=new D(1,0,0),zd=new D(0,1,0),Hd=new D(0,0,1),Vd={type:"added"},i0={type:"removed"},Ds={type:"childadded",child:null},nh={type:"childremoved",child:null},Ct=class s extends Hn{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:e0++}),this.uuid=Cn(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=s.DEFAULT_UP.clone();let e=new D,t=new Qn,n=new on,i=new D(1,1,1);function r(){n.setFromEuler(t,!1)}function o(){t.setFromQuaternion(n,void 0,!1)}t._onChange(r),n._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new je},normalMatrix:{value:new Qe}}),this.matrix=new je,this.matrixWorld=new je,this.matrixAutoUpdate=s.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=s.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new tr,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return Is.setFromAxisAngle(e,t),this.quaternion.multiply(Is),this}rotateOnWorldAxis(e,t){return Is.setFromAxisAngle(e,t),this.quaternion.premultiply(Is),this}rotateX(e){return this.rotateOnAxis(kd,e)}rotateY(e){return this.rotateOnAxis(zd,e)}rotateZ(e){return this.rotateOnAxis(Hd,e)}translateOnAxis(e,t){return Bd.copy(e).applyQuaternion(this.quaternion),this.position.add(Bd.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(kd,e)}translateY(e){return this.translateOnAxis(zd,e)}translateZ(e){return this.translateOnAxis(Hd,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(fi.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?fa.copy(e):fa.set(e,t,n);let i=this.parent;this.updateWorldMatrix(!0,!1),Ir.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?fi.lookAt(Ir,fa,this.up):fi.lookAt(fa,Ir,this.up),this.quaternion.setFromRotationMatrix(fi),i&&(fi.extractRotation(i.matrixWorld),Is.setFromRotationMatrix(fi),this.quaternion.premultiply(Is.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(Ze("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(Vd),Ds.child=e,this.dispatchEvent(Ds),Ds.child=null):Ze("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(i0),nh.child=e,this.dispatchEvent(nh),nh.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),fi.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),fi.multiply(e.parent.matrixWorld)),e.applyMatrix4(fi),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(Vd),Ds.child=e,this.dispatchEvent(Ds),Ds.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,i=this.children.length;n<i;n++){let o=this.children[n].getObjectByProperty(e,t);if(o!==void 0)return o}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);let i=this.children;for(let r=0,o=i.length;r<o;r++)i[r].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ir,e,t0),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ir,n0,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}intersectsFrustum(){}traverse(e){e(this);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let t=e.x,n=e.y,i=e.z,r=this.matrix.elements;r[12]+=t-r[0]*t-r[4]*n-r[8]*i,r[13]+=n-r[1]*t-r[5]*n-r[9]*i,r[14]+=i-r[2]*t-r[6]*n-r[10]*i}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let n=0,i=t.length;n<i;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t,n=!1){let i=this.parent;if(e===!0&&i!==null&&i.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),t===!0){let r=this.children;for(let o=0,a=r.length;o<a;o++)r[o].updateWorldMatrix(!1,!0,n)}}toJSON(e){let t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let i={};i.uuid=this.uuid,i.type=this.type,i.name=this.name,i.castShadow=this.castShadow,i.receiveShadow=this.receiveShadow,i.visible=this.visible,i.frustumCulled=this.frustumCulled,i.renderOrder=this.renderOrder,i.static=this.static,i.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(i.userData=this.userData),i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),i.up=this.up.toArray(),this.pivot!==null&&(i.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(i.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(i.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(i.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(i.type="BatchedMesh",i.perObjectFrustumCulled=this.perObjectFrustumCulled,i.sortObjects=this.sortObjects,i.drawRanges=this._drawRanges,i.reservedRanges=this._reservedRanges,i.geometryInfo=this._geometryInfo.map(a=>({...a,boundingBox:a.boundingBox?a.boundingBox.toJSON():void 0,boundingSphere:a.boundingSphere?a.boundingSphere.toJSON():void 0})),i.instanceInfo=this._instanceInfo.map(a=>({...a})),i.availableInstanceIds=this._availableInstanceIds.slice(),i.availableGeometryIds=this._availableGeometryIds.slice(),i.nextIndexStart=this._nextIndexStart,i.nextVertexStart=this._nextVertexStart,i.geometryCount=this._geometryCount,i.maxInstanceCount=this._maxInstanceCount,i.maxVertexCount=this._maxVertexCount,i.maxIndexCount=this._maxIndexCount,i.geometryInitialized=this._geometryInitialized,i.matricesTexture=this._matricesTexture.toJSON(e),i.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(i.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(i.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(i.boundingBox=this.boundingBox.toJSON()));function r(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?i.background=this.background.toJSON():this.background.isTexture&&(i.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(i.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){i.geometry=r(e.geometries,this.geometry);let a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){let l=a.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){let f=l[c];r(e.shapes,f)}else r(e.shapes,l)}}if(this.isSkinnedMesh&&(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(e.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let a=[];for(let l=0,c=this.material.length;l<c;l++)a.push(r(e.materials,this.material[l]));i.material=a}else i.material=r(e.materials,this.material);if(this.children.length>0){i.children=[];for(let a=0;a<this.children.length;a++)i.children.push(this.children[a].toJSON(e).object)}if(this.animations.length>0){i.animations=[];for(let a=0;a<this.animations.length;a++){let l=this.animations[a];i.animations.push(r(e.animations,l))}}if(t){let a=o(e.geometries),l=o(e.materials),c=o(e.textures),h=o(e.images),f=o(e.shapes),d=o(e.skeletons),u=o(e.animations),p=o(e.nodes);a.length>0&&(n.geometries=a),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),f.length>0&&(n.shapes=f),d.length>0&&(n.skeletons=d),u.length>0&&(n.animations=u),p.length>0&&(n.nodes=p)}return n.object=i,n;function o(a){let l=[];for(let c in a){let h=a[c];delete h.metadata,l.push(h)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){let i=e.children[n];this.add(i.clone())}return this}dispose(){this.dispatchEvent({type:"dispose"})}};Ct.DEFAULT_UP=new D(0,1,0);Ct.DEFAULT_MATRIX_AUTO_UPDATE=!0;Ct.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var Bt=class extends Ct{constructor(){super(),this.isGroup=!0,this.type="Group"}},s0={type:"move"},nr=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Bt,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Bt,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new D,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new D),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Bt,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new D,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new D,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let i=null,r=null,o=null,a=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){o=!0;for(let x of e.hand.values()){let m=t.getJointPose(x,n),g=this._getHandJoint(c,x);m!==null&&(g.matrix.fromArray(m.transform.matrix),g.matrix.decompose(g.position,g.rotation,g.scale),g.matrixWorldNeedsUpdate=!0,g.jointRadius=m.radius),g.visible=m!==null}let h=c.joints["index-finger-tip"],f=c.joints["thumb-tip"],d=h.position.distanceTo(f.position),u=.02,p=.005;c.inputState.pinching&&d>u+p?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&d<=u-p&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:e,target:this})));a!==null&&(i=t.getPose(e.targetRaySpace,n),i===null&&r!==null&&(i=r),i!==null&&(a.matrix.fromArray(i.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,i.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(i.linearVelocity)):a.hasLinearVelocity=!1,i.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(i.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(s0)))}return a!==null&&(a.visible=i!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=o!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let n=new Bt;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}},rp={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Ui={h:0,s:0,l:0},pa={h:0,s:0,l:0};function ih(s,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?s+(e-s)*6*t:t<1/2?e:t<2/3?s+(e-s)*6*(2/3-t):s}var Ee=class{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){let i=e;i&&i.isColor?this.copy(i):typeof i=="number"?this.setHex(i):typeof i=="string"&&this.setStyle(i)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Mt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,tt.colorSpaceToWorking(this,t),this}setRGB(e,t,n,i=tt.workingColorSpace){return this.r=e,this.g=t,this.b=n,tt.colorSpaceToWorking(this,i),this}setHSL(e,t,n,i=tt.workingColorSpace){if(e=su(e,1),t=nt(t,0,1),n=nt(n,0,1),t===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+t):n+t-n*t,o=2*n-r;this.r=ih(o,r,e+1/3),this.g=ih(o,r,e),this.b=ih(o,r,e-1/3)}return tt.colorSpaceToWorking(this,i),this}setStyle(e,t=Mt){function n(r){r!==void 0&&parseFloat(r)<1&&Ge("Color: Alpha component of "+e+" will be ignored.")}let i;if(i=/^(\w+)\(([^\)]*)\)/.exec(e)){let r,o=i[1],a=i[2];switch(o){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:Ge("Color: Unknown color model "+e)}}else if(i=/^\#([A-Fa-f\d]+)$/.exec(e)){let r=i[1],o=r.length;if(o===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(o===6)return this.setHex(parseInt(r,16),t);Ge("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Mt){let n=rp[e.toLowerCase()];return n!==void 0?this.setHex(n,t):Ge("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=yi(e.r),this.g=yi(e.g),this.b=yi(e.b),this}copyLinearToSRGB(e){return this.r=js(e.r),this.g=js(e.g),this.b=js(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Mt){return tt.workingToColorSpace(rn.copy(this),e),Math.round(nt(rn.r*255,0,255))*65536+Math.round(nt(rn.g*255,0,255))*256+Math.round(nt(rn.b*255,0,255))}getHexString(e=Mt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=tt.workingColorSpace){tt.workingToColorSpace(rn.copy(this),t);let n=rn.r,i=rn.g,r=rn.b,o=Math.max(n,i,r),a=Math.min(n,i,r),l,c,h=(a+o)/2;if(a===o)l=0,c=0;else{let f=o-a;switch(c=h<=.5?f/(o+a):f/(2-o-a),o){case n:l=(i-r)/f+(i<r?6:0);break;case i:l=(r-n)/f+2;break;case r:l=(n-i)/f+4;break}l/=6}return e.h=l,e.s=c,e.l=h,e}getRGB(e,t=tt.workingColorSpace){return tt.workingToColorSpace(rn.copy(this),t),e.r=rn.r,e.g=rn.g,e.b=rn.b,e}getStyle(e=Mt){tt.workingToColorSpace(rn.copy(this),e);let t=rn.r,n=rn.g,i=rn.b;return e!==Mt?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${i.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(i*255)})`}offsetHSL(e,t,n){return this.getHSL(Ui),this.setHSL(Ui.h+e,Ui.s+t,Ui.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(Ui),e.getHSL(pa);let n=Xr(Ui.h,pa.h,t),i=Xr(Ui.s,pa.s,t),r=Xr(Ui.l,pa.l,t);return this.setHSL(n,i,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,n=this.g,i=this.b,r=e.elements;return this.r=r[0]*t+r[3]*n+r[6]*i,this.g=r[1]*t+r[4]*n+r[7]*i,this.b=r[2]*t+r[5]*n+r[8]*i,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},rn=new Ee;Ee.NAMES=rp;var ir=class extends Ct{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Qn,this.environmentIntensity=1,this.environmentRotation=new Qn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),t.object.backgroundBlurriness=this.backgroundBlurriness,t.object.backgroundIntensity=this.backgroundIntensity,t.object.backgroundRotation=this.backgroundRotation.toArray(),t.object.environmentIntensity=this.environmentIntensity,t.object.environmentRotation=this.environmentRotation.toArray(),t}},Fn=new D,pi=new D,sh=new D,mi=new D,Ns=new D,Us=new D,Gd=new D,rh=new D,oh=new D,ah=new D,lh=new ut,ch=new ut,hh=new ut,vi=class s{constructor(e=new D,t=new D,n=new D){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,i){i.subVectors(n,t),Fn.subVectors(e,t),i.cross(Fn);let r=i.lengthSq();return r>0?i.multiplyScalar(1/Math.sqrt(r)):i.set(0,0,0)}static getBarycoord(e,t,n,i,r){Fn.subVectors(i,t),pi.subVectors(n,t),sh.subVectors(e,t);let o=Fn.dot(Fn),a=Fn.dot(pi),l=Fn.dot(sh),c=pi.dot(pi),h=pi.dot(sh),f=o*c-a*a;if(f===0)return r.set(0,0,0),null;let d=1/f,u=(c*l-a*h)*d,p=(o*h-a*l)*d;return r.set(1-u-p,p,u)}static containsPoint(e,t,n,i){return this.getBarycoord(e,t,n,i,mi)===null?!1:mi.x>=0&&mi.y>=0&&mi.x+mi.y<=1}static getInterpolation(e,t,n,i,r,o,a,l){return this.getBarycoord(e,t,n,i,mi)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,mi.x),l.addScaledVector(o,mi.y),l.addScaledVector(a,mi.z),l)}static getInterpolatedAttribute(e,t,n,i,r,o){return lh.setScalar(0),ch.setScalar(0),hh.setScalar(0),lh.fromBufferAttribute(e,t),ch.fromBufferAttribute(e,n),hh.fromBufferAttribute(e,i),o.setScalar(0),o.addScaledVector(lh,r.x),o.addScaledVector(ch,r.y),o.addScaledVector(hh,r.z),o}static isFrontFacing(e,t,n,i){return Fn.subVectors(n,t),pi.subVectors(e,t),Fn.cross(pi).dot(i)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,i){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[i]),this}setFromAttributeAndIndices(e,t,n,i){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,i),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return Fn.subVectors(this.c,this.b),pi.subVectors(this.a,this.b),Fn.cross(pi).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return s.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return s.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,i,r){return s.getInterpolation(e,this.a,this.b,this.c,t,n,i,r)}containsPoint(e){return s.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return s.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let n=this.a,i=this.b,r=this.c,o,a;Ns.subVectors(i,n),Us.subVectors(r,n),rh.subVectors(e,n);let l=Ns.dot(rh),c=Us.dot(rh);if(l<=0&&c<=0)return t.copy(n);oh.subVectors(e,i);let h=Ns.dot(oh),f=Us.dot(oh);if(h>=0&&f<=h)return t.copy(i);let d=l*f-h*c;if(d<=0&&l>=0&&h<=0)return o=l/(l-h),t.copy(n).addScaledVector(Ns,o);ah.subVectors(e,r);let u=Ns.dot(ah),p=Us.dot(ah);if(p>=0&&u<=p)return t.copy(r);let x=u*c-l*p;if(x<=0&&c>=0&&p<=0)return a=c/(c-p),t.copy(n).addScaledVector(Us,a);let m=h*p-u*f;if(m<=0&&f-h>=0&&u-p>=0)return Gd.subVectors(r,i),a=(f-h)/(f-h+(u-p)),t.copy(i).addScaledVector(Gd,a);let g=1/(m+x+d);return o=x*g,a=d*g,t.copy(n).addScaledVector(Ns,o).addScaledVector(Us,a)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},an=class{constructor(e=new D(1/0,1/0,1/0),t=new D(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(Bn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(Bn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=Bn.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let n=e.geometry;if(n!==void 0){let r=n.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let o=0,a=r.count;o<a;o++)e.isMesh===!0?e.getVertexPosition(o,Bn):Bn.fromBufferAttribute(r,o),Bn.applyMatrix4(e.matrixWorld),this.expandByPoint(Bn);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),ma.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),ma.copy(n.boundingBox)),ma.applyMatrix4(e.matrixWorld),this.union(ma)}let i=e.children;for(let r=0,o=i.length;r<o;r++)this.expandByObject(i[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,Bn),Bn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Dr),ga.subVectors(this.max,Dr),Os.subVectors(e.a,Dr),Fs.subVectors(e.b,Dr),Bs.subVectors(e.c,Dr),Oi.subVectors(Fs,Os),Fi.subVectors(Bs,Fs),is.subVectors(Os,Bs);let t=[0,-Oi.z,Oi.y,0,-Fi.z,Fi.y,0,-is.z,is.y,Oi.z,0,-Oi.x,Fi.z,0,-Fi.x,is.z,0,-is.x,-Oi.y,Oi.x,0,-Fi.y,Fi.x,0,-is.y,is.x,0];return!uh(t,Os,Fs,Bs,ga)||(t=[1,0,0,0,1,0,0,0,1],!uh(t,Os,Fs,Bs,ga))?!1:(xa.crossVectors(Oi,Fi),t=[xa.x,xa.y,xa.z],uh(t,Os,Fs,Bs,ga))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Bn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(Bn).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(gi[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),gi[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),gi[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),gi[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),gi[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),gi[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),gi[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),gi[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(gi),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},gi=[new D,new D,new D,new D,new D,new D,new D,new D],Bn=new D,ma=new an,Os=new D,Fs=new D,Bs=new D,Oi=new D,Fi=new D,is=new D,Dr=new D,ga=new D,xa=new D,ss=new D;function uh(s,e,t,n,i){for(let r=0,o=s.length-3;r<=o;r+=3){ss.fromArray(s,r);let a=i.x*Math.abs(ss.x)+i.y*Math.abs(ss.y)+i.z*Math.abs(ss.z),l=e.dot(ss),c=t.dot(ss),h=n.dot(ss);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>a)return!1}return!0}var Gt=new D,_a=new ee,r0=0,Pt=class extends Hn{constructor(e,t,n=!1){if(super(),Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:r0++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=nu,this.updateRanges=[],this.gpuType=Tn,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let i=0,r=this.itemSize;i<r;i++)this.array[e+i]=t.array[n+i];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)_a.fromBufferAttribute(this,t),_a.applyMatrix3(e),this.setXY(t,_a.x,_a.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)Gt.fromBufferAttribute(this,t),Gt.applyMatrix3(e),this.setXYZ(t,Gt.x,Gt.y,Gt.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)Gt.fromBufferAttribute(this,t),Gt.applyMatrix4(e),this.setXYZ(t,Gt.x,Gt.y,Gt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Gt.fromBufferAttribute(this,t),Gt.applyNormalMatrix(e),this.setXYZ(t,Gt.x,Gt.y,Gt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Gt.fromBufferAttribute(this,t),Gt.transformDirection(e),this.setXYZ(t,Gt.x,Gt.y,Gt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=kn(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=mt(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=kn(t,this.array)),t}setX(e,t){return this.normalized&&(t=mt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=kn(t,this.array)),t}setY(e,t){return this.normalized&&(t=mt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=kn(t,this.array)),t}setZ(e,t){return this.normalized&&(t=mt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=kn(t,this.array)),t}setW(e,t){return this.normalized&&(t=mt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=mt(t,this.array),n=mt(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,i){return e*=this.itemSize,this.normalized&&(t=mt(t,this.array),n=mt(n,this.array),i=mt(i,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this}setXYZW(e,t,n,i,r){return e*=this.itemSize,this.normalized&&(t=mt(t,this.array),n=mt(n,this.array),i=mt(i,this.array),r=mt(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=i,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return e.name=this.name,e.usage=this.usage,e.gpuType=this.gpuType,e}dispose(){this.dispatchEvent({type:"dispose"})}};var Jr=class extends Pt{constructor(e,t,n){super(new Uint16Array(e),t,n)}};var Qr=class extends Pt{constructor(e,t,n){super(new Uint32Array(e),t,n)}};var at=class extends Pt{constructor(e,t,n){super(new Float32Array(e),t,n)}},o0=new an,Nr=new D,dh=new D,gn=class{constructor(e=new D,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;t!==void 0?n.copy(t):o0.setFromPoints(e).getCenter(n);let i=0;for(let r=0,o=e.length;r<o;r++)i=Math.max(i,n.distanceToSquared(e[r]));return this.radius=Math.sqrt(i),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Nr.subVectors(e,this.center);let t=Nr.lengthSq();if(t>this.radius*this.radius){let n=Math.sqrt(t),i=(n-this.radius)*.5;this.center.addScaledVector(Nr,i/n),this.radius+=i}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(dh.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Nr.copy(e.center).add(dh)),this.expandByPoint(Nr.copy(e.center).sub(dh))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},a0=0,An=new je,fh=new Ct,ks=new D,Mn=new an,Ur=new an,Zt=new D,_t=class s extends Hn{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:a0++}),this.uuid=Cn(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Lm(e)?Qr:Jr)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let r=new Qe().getNormalMatrix(e);n.applyNormalMatrix(r),n.needsUpdate=!0}let i=this.attributes.tangent;return i!==void 0&&(i.transformDirection(e),i.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return An.makeRotationFromQuaternion(e),this.applyMatrix4(An),this}rotateX(e){return An.makeRotationX(e),this.applyMatrix4(An),this}rotateY(e){return An.makeRotationY(e),this.applyMatrix4(An),this}rotateZ(e){return An.makeRotationZ(e),this.applyMatrix4(An),this}translate(e,t,n){return An.makeTranslation(e,t,n),this.applyMatrix4(An),this}scale(e,t,n){return An.makeScale(e,t,n),this.applyMatrix4(An),this}lookAt(e){return fh.lookAt(e),fh.updateMatrix(),this.applyMatrix4(fh.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(ks).negate(),this.translate(ks.x,ks.y,ks.z),this}setFromPoints(e){let t=this.getAttribute("position");if(t===void 0){let n=[];for(let i=0,r=e.length;i<r;i++){let o=e[i];n.push(o.x,o.y,o.z||0)}this.setAttribute("position",new at(n,3))}else{let n=Math.min(e.length,t.count);for(let i=0;i<n;i++){let r=e[i];t.setXYZ(i,r.x,r.y,r.z||0)}e.length>t.count&&Ge("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new an);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ze("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new D(-1/0,-1/0,-1/0),new D(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,i=t.length;n<i;n++){let r=t[n];Mn.setFromBufferAttribute(r),this.morphTargetsRelative?(Zt.addVectors(this.boundingBox.min,Mn.min),this.boundingBox.expandByPoint(Zt),Zt.addVectors(this.boundingBox.max,Mn.max),this.boundingBox.expandByPoint(Zt)):(this.boundingBox.expandByPoint(Mn.min),this.boundingBox.expandByPoint(Mn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Ze('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new gn);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){Ze("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new D,1/0);return}if(e){let n=this.boundingSphere.center;if(Mn.setFromBufferAttribute(e),t)for(let r=0,o=t.length;r<o;r++){let a=t[r];Ur.setFromBufferAttribute(a),this.morphTargetsRelative?(Zt.addVectors(Mn.min,Ur.min),Mn.expandByPoint(Zt),Zt.addVectors(Mn.max,Ur.max),Mn.expandByPoint(Zt)):(Mn.expandByPoint(Ur.min),Mn.expandByPoint(Ur.max))}Mn.getCenter(n);let i=0;for(let r=0,o=e.count;r<o;r++)Zt.fromBufferAttribute(e,r),i=Math.max(i,n.distanceToSquared(Zt));if(t)for(let r=0,o=t.length;r<o;r++){let a=t[r],l=this.morphTargetsRelative;for(let c=0,h=a.count;c<h;c++)Zt.fromBufferAttribute(a,c),l&&(ks.fromBufferAttribute(e,c),Zt.add(ks)),i=Math.max(i,n.distanceToSquared(Zt))}this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius)&&Ze('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){Ze("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let n=t.position,i=t.normal,r=t.uv,o=this.getAttribute("tangent");(o===void 0||o.count!==n.count)&&(o=new Pt(new Float32Array(4*n.count),4),this.setAttribute("tangent",o));let a=[],l=[];for(let v=0;v<n.count;v++)a[v]=new D,l[v]=new D;let c=new D,h=new D,f=new D,d=new ee,u=new ee,p=new ee,x=new D,m=new D;function g(v,R,N){c.fromBufferAttribute(n,v),h.fromBufferAttribute(n,R),f.fromBufferAttribute(n,N),d.fromBufferAttribute(r,v),u.fromBufferAttribute(r,R),p.fromBufferAttribute(r,N),h.sub(c),f.sub(c),u.sub(d),p.sub(d);let L=1/(u.x*p.y-p.x*u.y);isFinite(L)&&(x.copy(h).multiplyScalar(p.y).addScaledVector(f,-u.y).multiplyScalar(L),m.copy(f).multiplyScalar(u.x).addScaledVector(h,-p.x).multiplyScalar(L),a[v].add(x),a[R].add(x),a[N].add(x),l[v].add(m),l[R].add(m),l[N].add(m))}let b=this.groups;b.length===0&&(b=[{start:0,count:e.count}]);for(let v=0,R=b.length;v<R;++v){let N=b[v],L=N.start,S=N.count;for(let w=L,P=L+S;w<P;w+=3)g(e.getX(w+0),e.getX(w+1),e.getX(w+2))}let T=new D,_=new D,M=new D,E=new D;function A(v){M.fromBufferAttribute(i,v),E.copy(M);let R=a[v];T.copy(R),T.sub(M.multiplyScalar(M.dot(R))).normalize(),_.crossVectors(E,R);let L=_.dot(l[v])<0?-1:1;o.setXYZW(v,T.x,T.y,T.z,L)}for(let v=0,R=b.length;v<R;++v){let N=b[v],L=N.start,S=N.count;for(let w=L,P=L+S;w<P;w+=3)A(e.getX(w+0)),A(e.getX(w+1)),A(e.getX(w+2))}this._transformed=!0}computeVertexNormals(){let e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==t.count)n=new Pt(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let d=0,u=n.count;d<u;d++)n.setXYZ(d,0,0,0);let i=new D,r=new D,o=new D,a=new D,l=new D,c=new D,h=new D,f=new D;if(e)for(let d=0,u=e.count;d<u;d+=3){let p=e.getX(d+0),x=e.getX(d+1),m=e.getX(d+2);i.fromBufferAttribute(t,p),r.fromBufferAttribute(t,x),o.fromBufferAttribute(t,m),h.subVectors(o,r),f.subVectors(i,r),h.cross(f),a.fromBufferAttribute(n,p),l.fromBufferAttribute(n,x),c.fromBufferAttribute(n,m),a.add(h),l.add(h),c.add(h),n.setXYZ(p,a.x,a.y,a.z),n.setXYZ(x,l.x,l.y,l.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let d=0,u=t.count;d<u;d+=3)i.fromBufferAttribute(t,d+0),r.fromBufferAttribute(t,d+1),o.fromBufferAttribute(t,d+2),h.subVectors(o,r),f.subVectors(i,r),h.cross(f),n.setXYZ(d+0,h.x,h.y,h.z),n.setXYZ(d+1,h.x,h.y,h.z),n.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)Zt.fromBufferAttribute(e,t),Zt.normalize(),e.setXYZ(t,Zt.x,Zt.y,Zt.z)}toNonIndexed(){function e(a,l){let c=a.array,h=a.itemSize,f=a.normalized,d=new c.constructor(l.length*h),u=0,p=0;for(let x=0,m=l.length;x<m;x++){a.isInterleavedBufferAttribute?u=l[x]*a.data.stride+a.offset:u=l[x]*h;for(let g=0;g<h;g++)d[p++]=c[u++]}return new Pt(d,h,f)}if(this.index===null)return Ge("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let t=new s,n=this.index.array,i=this.attributes;for(let a in i){let l=i[a],c=e(l,n);t.setAttribute(a,c)}let r=this.morphAttributes;for(let a in r){let l=[],c=r[a];for(let h=0,f=c.length;h<f;h++){let d=c[h],u=e(d,n);l.push(u)}t.morphAttributes[a]=l}t.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let a=0,l=o.length;a<l;a++){let c=o[a];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){let e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,e.name=this.name,Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let n=this.attributes;for(let l in n){let c=n[l];e.data.attributes[l]=c.toJSON(e.data)}let i={},r=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],h=[];for(let f=0,d=c.length;f<d;f++){let u=c[f];h.push(u.toJSON(e.data))}h.length>0&&(i[l]=h,r=!0)}r&&(e.data.morphAttributes=i,e.data.morphTargetsRelative=this.morphTargetsRelative);let o=this.groups;o.length>0&&(e.data.groups=JSON.parse(JSON.stringify(o)));let a=this.boundingSphere;return a!==null&&(e.data.boundingSphere=a.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;n!==null&&this.setIndex(n.clone());let i=e.attributes;for(let c in i){let h=i[c];this.setAttribute(c,h.clone(t))}let r=e.morphAttributes;for(let c in r){let h=[],f=r[c];for(let d=0,u=f.length;d<u;d++)h.push(f[d].clone(t));this.morphAttributes[c]=h}this.morphTargetsRelative=e.morphTargetsRelative;let o=e.groups;for(let c=0,h=o.length;c<h;c++){let f=o[c];this.addGroup(f.start,f.count,f.materialIndex)}let a=e.boundingBox;a!==null&&(this.boundingBox=a.clone());let l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}},us=class{constructor(e,t){this.isInterleavedBuffer=!0,this.array=e,this.stride=t,this.count=e!==void 0?e.length/t:0,this.usage=nu,this.updateRanges=[],this.version=0,this.uuid=Cn()}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.array=new e.array.constructor(e.array),this.count=e.count,this.stride=e.stride,this.usage=e.usage,this}copyAt(e,t,n){e*=this.stride,n*=t.stride;for(let i=0,r=this.stride;i<r;i++)this.array[e+i]=t.array[n+i];return this}set(e,t=0){return this.array.set(e,t),this}clone(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Cn()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);let t=new this.array.constructor(e.arrayBuffers[this.array.buffer._uuid]),n=new this.constructor(t,this.stride);return n.setUsage(this.usage),n}onUpload(e){return this.onUploadCallback=e,this}toJSON(e){e.arrayBuffers===void 0&&(e.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Cn()),e.arrayBuffers[this.array.buffer._uuid]===void 0&&(e.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer)));let t={uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride};return t.usage=this.usage,t}},dn=new D,zi=class s{constructor(e,t,n,i=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=e,this.itemSize=t,this.offset=n,this.normalized=i}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(e){this.data.needsUpdate=e}applyMatrix4(e){for(let t=0,n=this.data.count;t<n;t++)dn.fromBufferAttribute(this,t),dn.applyMatrix4(e),this.setXYZ(t,dn.x,dn.y,dn.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)dn.fromBufferAttribute(this,t),dn.applyNormalMatrix(e),this.setXYZ(t,dn.x,dn.y,dn.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)dn.fromBufferAttribute(this,t),dn.transformDirection(e),this.setXYZ(t,dn.x,dn.y,dn.z);return this}getComponent(e,t){let n=this.array[e*this.data.stride+this.offset+t];return this.normalized&&(n=kn(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=mt(n,this.array)),this.data.array[e*this.data.stride+this.offset+t]=n,this}setX(e,t){return this.normalized&&(t=mt(t,this.array)),this.data.array[e*this.data.stride+this.offset]=t,this}setY(e,t){return this.normalized&&(t=mt(t,this.array)),this.data.array[e*this.data.stride+this.offset+1]=t,this}setZ(e,t){return this.normalized&&(t=mt(t,this.array)),this.data.array[e*this.data.stride+this.offset+2]=t,this}setW(e,t){return this.normalized&&(t=mt(t,this.array)),this.data.array[e*this.data.stride+this.offset+3]=t,this}getX(e){let t=this.data.array[e*this.data.stride+this.offset];return this.normalized&&(t=kn(t,this.array)),t}getY(e){let t=this.data.array[e*this.data.stride+this.offset+1];return this.normalized&&(t=kn(t,this.array)),t}getZ(e){let t=this.data.array[e*this.data.stride+this.offset+2];return this.normalized&&(t=kn(t,this.array)),t}getW(e){let t=this.data.array[e*this.data.stride+this.offset+3];return this.normalized&&(t=kn(t,this.array)),t}setXY(e,t,n){return e=e*this.data.stride+this.offset,this.normalized&&(t=mt(t,this.array),n=mt(n,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this}setXYZ(e,t,n,i){return e=e*this.data.stride+this.offset,this.normalized&&(t=mt(t,this.array),n=mt(n,this.array),i=mt(i,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this}setXYZW(e,t,n,i,r){return e=e*this.data.stride+this.offset,this.normalized&&(t=mt(t,this.array),n=mt(n,this.array),i=mt(i,this.array),r=mt(r,this.array)),this.data.array[e+0]=t,this.data.array[e+1]=n,this.data.array[e+2]=i,this.data.array[e+3]=r,this}clone(e){if(e===void 0){Zr("InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let i=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[i+r])}return new Pt(new this.array.constructor(t),this.itemSize,this.normalized)}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.clone(e)),new s(e.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(e){if(e===void 0){Zr("InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");let t=[];for(let n=0;n<this.count;n++){let i=n*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)t.push(this.data.array[i+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:t,normalized:this.normalized}}else return e.interleavedBuffers===void 0&&(e.interleavedBuffers={}),e.interleavedBuffers[this.data.uuid]===void 0&&(e.interleavedBuffers[this.data.uuid]=this.data.toJSON(e)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}},ph=new D,l0=new D,c0=new Qe,Qt=class{constructor(e=new D(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,i){return this.normal.set(e,t,n),this.constant=i,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let i=ph.subVectors(n,t).cross(l0.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(i,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){let i=e.delta(ph),r=this.normal.dot(i);if(r===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let o=-(e.start.dot(this.normal)+this.constant)/r;return n===!0&&(o<0||o>1)?null:t.copy(e.start).addScaledVector(i,o)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||c0.getNormalMatrix(e),i=this.coplanarPoint(ph).applyMatrix4(e),r=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(e){return this.normal.fromArray(e.normal),this.constant=e.constant,this}},h0=0,$t=class extends Hn{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:h0++}),this.uuid=Cn(),this.name="",this.type="Material",this.blending=mr,this.side=si,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=qh,this.blendDst=Yh,this.blendEquation=Rn,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Ee(0,0,0),this.blendAlpha=0,this.depthFunc=Zs,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=jf,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Ga,this.stencilZFail=Ga,this.stencilZPass=Ga,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let n=e[t];if(n===void 0){Ge(`Material: parameter '${t}' has value of undefined.`);continue}let i=this[t];if(i===void 0){Ge(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}i&&i.isColor?i.set(n):i&&i.isVector2&&n&&n.isVector2||i&&i.isEuler&&n&&n.isEuler||i&&i.isVector3&&n&&n.isVector3?i.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});let n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,n.blending=this.blending,n.side=this.side,n.shadowSide=this.shadowSide,n.vertexColors=this.vertexColors,n.opacity=this.opacity,n.transparent=this.transparent,n.blendSrc=this.blendSrc,n.blendDst=this.blendDst,n.blendEquation=this.blendEquation,n.blendSrcAlpha=this.blendSrcAlpha,n.blendDstAlpha=this.blendDstAlpha,n.blendEquationAlpha=this.blendEquationAlpha,n.blendColor=this.blendColor.getHex(),n.blendAlpha=this.blendAlpha,n.depthFunc=this.depthFunc,n.depthTest=this.depthTest,n.depthWrite=this.depthWrite,n.colorWrite=this.colorWrite,n.clipIntersection=this.clipIntersection,n.clipShadows=this.clipShadows,n.stencilWriteMask=this.stencilWriteMask,n.stencilFunc=this.stencilFunc,n.stencilRef=this.stencilRef,n.stencilFuncMask=this.stencilFuncMask,n.stencilFail=this.stencilFail,n.stencilZFail=this.stencilZFail,n.stencilZPass=this.stencilZPass,n.stencilWrite=this.stencilWrite,n.polygonOffset=this.polygonOffset,n.polygonOffsetFactor=this.polygonOffsetFactor,n.polygonOffsetUnits=this.polygonOffsetUnits,n.dithering=this.dithering,n.alphaTest=this.alphaTest,n.alphaHash=this.alphaHash,n.alphaToCoverage=this.alphaToCoverage,n.premultipliedAlpha=this.premultipliedAlpha,n.forceSinglePass=this.forceSinglePass,n.allowOverride=this.allowOverride,n.visible=this.visible,n.toneMapped=this.toneMapped,n.name=this.name,this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(n.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(n.clippingPlanes=this.clippingPlanes.map(r=>r.toJSON())),this.rotation!==void 0&&(n.rotation=this.rotation),this.depthPacking!==void 0&&(n.depthPacking=this.depthPacking),this.linewidth!==void 0&&(n.linewidth=this.linewidth),this.linecap!==void 0&&(n.linecap=this.linecap),this.linejoin!==void 0&&(n.linejoin=this.linejoin),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.wireframe!==void 0&&(n.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(n.flatShading=this.flatShading),this.fog!==void 0&&(n.fog=this.fog),Object.keys(this.userData).length>0&&(n.userData=this.userData);function i(r){let o=[];for(let a in r){let l=r[a];delete l.metadata,o.push(l)}return o}if(t){let r=i(e.textures),o=i(e.images);r.length>0&&(n.textures=r),o.length>0&&(n.images=o)}return n}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new Ee().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.retroreflectivity!==void 0&&(this.retroreflectivity=e.retroreflectivity),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.clippingPlanes!==void 0&&(this.clippingPlanes=e.clippingPlanes.map(n=>new Qt().fromJSON(n))),e.clipIntersection!==void 0&&(this.clipIntersection=e.clipIntersection),e.clipShadows!==void 0&&(this.clipShadows=e.clipShadows),e.depthPacking!==void 0&&(this.depthPacking=e.depthPacking),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.linecap!==void 0&&(this.linecap=e.linecap),e.linejoin!==void 0&&(this.linejoin=e.linejoin),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let n=e.normalScale;Array.isArray(n)===!1&&(n=[n,n]),this.normalScale=new ee().fromArray(n)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new ee().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,n=null;if(t!==null){let i=t.length;n=new Array(i);for(let r=0;r!==i;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}},sr=class extends $t{constructor(e){super(),this.isSpriteMaterial=!0,this.type="SpriteMaterial",this.color=new Ee(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.rotation=e.rotation,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},zs,Or=new D,Hs=new D,Vs=new D,Gs=new ee,Fr=new ee,op=new je,va=new D,Br=new D,ya=new D,Wd=new ee,mh=new ee,Xd=new ee,$r=class extends Ct{constructor(e=new sr){if(super(),this.isSprite=!0,this.type="Sprite",zs===void 0){zs=new _t;let t=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),n=new us(t,5);zs.setIndex([0,1,2,0,2,3]),zs.setAttribute("position",new zi(n,3,0,!1)),zs.setAttribute("uv",new zi(n,2,3,!1))}this.geometry=zs,this.material=e,this.center=new ee(.5,.5),this.count=1}intersectsFrustum(e){return e.intersectsSprite(this)}raycast(e,t){e.camera===null&&Ze('Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),Hs.setFromMatrixScale(this.matrixWorld),op.copy(e.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(e.camera.matrixWorldInverse,this.matrixWorld),Vs.setFromMatrixPosition(this.modelViewMatrix),e.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&Hs.multiplyScalar(-Vs.z);let n=this.material.rotation,i,r;n!==0&&(r=Math.cos(n),i=Math.sin(n));let o=this.center;Ma(va.set(-.5,-.5,0),Vs,o,Hs,i,r),Ma(Br.set(.5,-.5,0),Vs,o,Hs,i,r),Ma(ya.set(.5,.5,0),Vs,o,Hs,i,r),Wd.set(0,0),mh.set(1,0),Xd.set(1,1);let a=e.ray.intersectTriangle(va,Br,ya,!1,Or);if(a===null&&(Ma(Br.set(-.5,.5,0),Vs,o,Hs,i,r),mh.set(0,1),a=e.ray.intersectTriangle(va,ya,Br,!1,Or),a===null))return;let l=e.ray.origin.distanceTo(Or);l<e.near||l>e.far||t.push({distance:l,point:Or.clone(),uv:vi.getInterpolation(Or,va,Br,ya,Wd,mh,Xd,new ee),face:null,object:this})}copy(e,t){return super.copy(e,t),e.center!==void 0&&this.center.copy(e.center),this.material=e.material,this}};function Ma(s,e,t,n,i,r){Gs.subVectors(s,t).addScalar(.5).multiply(n),i!==void 0?(Fr.x=r*Gs.x-i*Gs.y,Fr.y=i*Gs.x+r*Gs.y):Fr.copy(Gs),s.copy(e),s.x+=Fr.x,s.y+=Fr.y,s.applyMatrix4(op)}var xi=new D,gh=new D,ba=new D,Sa=new D,$n=class{constructor(e=new D,t=new D(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,xi)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=xi.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(xi.copy(this.origin).addScaledVector(this.direction,t),xi.distanceToSquared(e))}distanceSqToSegment(e,t,n,i){gh.copy(e).add(t).multiplyScalar(.5),ba.copy(t).sub(e).normalize(),Sa.copy(this.origin).sub(gh);let r=e.distanceTo(t)*.5,o=-this.direction.dot(ba),a=Sa.dot(this.direction),l=-Sa.dot(ba),c=Sa.lengthSq(),h=Math.abs(1-o*o),f,d,u,p;if(h>0)if(f=o*l-a,d=o*a-l,p=r*h,f>=0)if(d>=-p)if(d<=p){let x=1/h;f*=x,d*=x,u=f*(f+o*d+2*a)+d*(o*f+d+2*l)+c}else d=r,f=Math.max(0,-(o*d+a)),u=-f*f+d*(d+2*l)+c;else d=-r,f=Math.max(0,-(o*d+a)),u=-f*f+d*(d+2*l)+c;else d<=-p?(f=Math.max(0,-(-o*r+a)),d=f>0?-r:Math.min(Math.max(-r,-l),r),u=-f*f+d*(d+2*l)+c):d<=p?(f=0,d=Math.min(Math.max(-r,-l),r),u=d*(d+2*l)+c):(f=Math.max(0,-(o*r+a)),d=f>0?r:Math.min(Math.max(-r,-l),r),u=-f*f+d*(d+2*l)+c);else d=o>0?-r:r,f=Math.max(0,-(o*d+a)),u=-f*f+d*(d+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,f),i&&i.copy(gh).addScaledVector(ba,d),u}intersectSphere(e,t){if(e.radius<0)return null;xi.subVectors(e.center,this.origin);let n=xi.dot(this.direction),i=xi.dot(xi)-n*n,r=e.radius*e.radius;if(i>r)return null;let o=Math.sqrt(r-i),a=n-o,l=n+o;return l<0?null:a<0?this.at(l,t):this.at(a,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,i,r,o,a,l,c=1/this.direction.x,h=1/this.direction.y,f=1/this.direction.z,d=this.origin;return c>=0?(n=(e.min.x-d.x)*c,i=(e.max.x-d.x)*c):(n=(e.max.x-d.x)*c,i=(e.min.x-d.x)*c),h>=0?(r=(e.min.y-d.y)*h,o=(e.max.y-d.y)*h):(r=(e.max.y-d.y)*h,o=(e.min.y-d.y)*h),n>o||r>i||((r>n||isNaN(n))&&(n=r),(o<i||isNaN(i))&&(i=o),f>=0?(a=(e.min.z-d.z)*f,l=(e.max.z-d.z)*f):(a=(e.max.z-d.z)*f,l=(e.min.z-d.z)*f),n>l||a>i)||((a>n||n!==n)&&(n=a),(l<i||i!==i)&&(i=l),i<0)?null:this.at(n>=0?n:i,t)}intersectsBox(e){return this.intersectBox(e,xi)!==null}intersectTriangle(e,t,n,i,r){let o=this.origin,a=this.direction,l=a.x,c=a.y,h=a.z,f=e.x-o.x,d=e.y-o.y,u=e.z-o.z,p=t.x-o.x,x=t.y-o.y,m=t.z-o.z,g=n.x-o.x,b=n.y-o.y,T=n.z-o.z,_=Math.abs(l),M=Math.abs(c),E=Math.abs(h),A,v,R,N,L,S,w,P,U,F,O,H;if(_>=M&&_>=E?(R=l,S=f,U=p,H=g,l>=0?(A=c,v=h,N=d,L=u,w=x,P=m,F=b,O=T):(A=h,v=c,N=u,L=d,w=m,P=x,F=T,O=b)):M>=E?(R=c,S=d,U=x,H=b,c>=0?(A=h,v=l,N=u,L=f,w=m,P=p,F=T,O=g):(A=l,v=h,N=f,L=u,w=p,P=m,F=g,O=T)):(R=h,S=u,U=m,H=T,h>=0?(A=l,v=c,N=f,L=d,w=p,P=x,F=g,O=b):(A=c,v=l,N=d,L=f,w=x,P=p,F=b,O=g)),R===0)return null;let k=A/R,W=v/R,Z=1/R,he=N-k*S,pe=L-W*S,Ae=w-k*U,we=P-W*U,Pe=F-k*H,q=O-W*H,K=Pe*we-q*Ae,de=he*q-pe*Pe,De=Ae*pe-we*he;if(i){if(K<0||de<0||De<0)return null}else if((K<0||de<0||De<0)&&(K>0||de>0||De>0))return null;let _e=K+de+De;if(_e===0)return null;let ke=Z*(K*S+de*U+De*H);return(_e>0?ke<0:ke>0)?null:this.at(ke/_e,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},Et=class extends $t{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Ee(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Qn,this.combine=Sl,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},qd=new je,rs=new $n,wa=new gn,Yd=new D,Ta=new D,Ea=new D,Aa=new D,xh=new D,Ca=new D,jd=new D,Ra=new D,Re=class extends Ct{constructor(e=new _t,t=new Et){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=i.length;r<o;r++){let a=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}getVertexPosition(e,t){let n=this.geometry,i=n.attributes.position,r=n.morphAttributes.position,o=n.morphTargetsRelative;t.fromBufferAttribute(i,e);let a=this.morphTargetInfluences;if(r&&a){Ca.set(0,0,0);for(let l=0,c=r.length;l<c;l++){let h=a[l],f=r[l];h!==0&&(xh.fromBufferAttribute(f,e),o?Ca.addScaledVector(xh,h):Ca.addScaledVector(xh.sub(t),h))}t.add(Ca)}return t}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,i=this.material,r=this.matrixWorld;i!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),wa.copy(n.boundingSphere),wa.applyMatrix4(r),rs.copy(e.ray).recast(e.near),!(wa.containsPoint(rs.origin)===!1&&(rs.intersectSphere(wa,Yd)===null||rs.origin.distanceToSquared(Yd)>(e.far-e.near)**2))&&(qd.copy(r).invert(),rs.copy(e.ray).applyMatrix4(qd),!(n.boundingBox!==null&&rs.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,rs)))}_computeIntersections(e,t,n){let i,r=this.geometry,o=this.material,a=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,f=r.attributes.normal,d=r.groups,u=r.drawRange;if(a!==null)if(Array.isArray(o))for(let p=0,x=d.length;p<x;p++){let m=d[p],g=o[m.materialIndex],b=Math.max(m.start,u.start),T=Math.min(a.count,Math.min(m.start+m.count,u.start+u.count));for(let _=b,M=T;_<M;_+=3){let E=a.getX(_),A=a.getX(_+1),v=a.getX(_+2);i=Pa(this,g,e,n,c,h,f,E,A,v),i&&(i.faceIndex=Math.floor(_/3),i.face.materialIndex=m.materialIndex,t.push(i))}}else{let p=Math.max(0,u.start),x=Math.min(a.count,u.start+u.count);for(let m=p,g=x;m<g;m+=3){let b=a.getX(m),T=a.getX(m+1),_=a.getX(m+2);i=Pa(this,o,e,n,c,h,f,b,T,_),i&&(i.faceIndex=Math.floor(m/3),t.push(i))}}else if(l!==void 0)if(Array.isArray(o))for(let p=0,x=d.length;p<x;p++){let m=d[p],g=o[m.materialIndex],b=Math.max(m.start,u.start),T=Math.min(l.count,Math.min(m.start+m.count,u.start+u.count));for(let _=b,M=T;_<M;_+=3){let E=_,A=_+1,v=_+2;i=Pa(this,g,e,n,c,h,f,E,A,v),i&&(i.faceIndex=Math.floor(_/3),i.face.materialIndex=m.materialIndex,t.push(i))}}else{let p=Math.max(0,u.start),x=Math.min(l.count,u.start+u.count);for(let m=p,g=x;m<g;m+=3){let b=m,T=m+1,_=m+2;i=Pa(this,o,e,n,c,h,f,b,T,_),i&&(i.faceIndex=Math.floor(m/3),t.push(i))}}}};function u0(s,e,t,n,i,r,o,a){let l;if(e.side===en?l=n.intersectTriangle(o,r,i,!0,a):l=n.intersectTriangle(i,r,o,e.side===si,a),l===null)return null;Ra.copy(a),Ra.applyMatrix4(s.matrixWorld);let c=t.ray.origin.distanceTo(Ra);return c<t.near||c>t.far?null:{distance:c,point:Ra.clone(),object:s}}function Pa(s,e,t,n,i,r,o,a,l,c){s.getVertexPosition(a,Ta),s.getVertexPosition(l,Ea),s.getVertexPosition(c,Aa);let h=u0(s,e,t,n,Ta,Ea,Aa,jd);if(h){let f=new D;vi.getBarycoord(jd,Ta,Ea,Aa,f),i&&(h.uv=vi.getInterpolatedAttribute(i,a,l,c,f,new ee)),r&&(h.uv1=vi.getInterpolatedAttribute(r,a,l,c,f,new ee)),o&&(h.normal=vi.getInterpolatedAttribute(o,a,l,c,f,new D),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));let d={a,b:l,c,normal:new D,materialIndex:0};vi.getNormal(Ta,Ea,Aa,d.normal),h.face=d,h.barycoord=f}return h}var kr=new ut,Zd=new ut,Kd=new ut,d0=new ut,Jd=new je,La=new D,_h=new gn,Qd=new je,vh=new $n,eo=class extends Re{constructor(e,t){super(e,t),this.isSkinnedMesh=!0,this.type="SkinnedMesh",this.bindMode=Eh,this.bindMatrix=new je,this.bindMatrixInverse=new je,this.boundingBox=null,this.boundingSphere=null}computeBoundingBox(){let e=this.geometry;this.boundingBox===null&&(this.boundingBox=new an),this.boundingBox.makeEmpty();let t=e.getAttribute("position");for(let n=0;n<t.count;n++)this.getVertexPosition(n,La),this.boundingBox.expandByPoint(La)}computeBoundingSphere(){let e=this.geometry;this.boundingSphere===null&&(this.boundingSphere=new gn),this.boundingSphere.makeEmpty();let t=e.getAttribute("position");for(let n=0;n<t.count;n++)this.getVertexPosition(n,La),this.boundingSphere.expandByPoint(La)}copy(e,t){return super.copy(e,t),this.bindMode=e.bindMode,this.bindMatrix.copy(e.bindMatrix),this.bindMatrixInverse.copy(e.bindMatrixInverse),this.skeleton=e.skeleton,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}raycast(e,t){let n=this.material,i=this.matrixWorld;n!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),_h.copy(this.boundingSphere),_h.applyMatrix4(i),e.ray.intersectsSphere(_h)!==!1&&(Qd.copy(i).invert(),vh.copy(e.ray).applyMatrix4(Qd),!(this.boundingBox!==null&&vh.intersectsBox(this.boundingBox)===!1)&&this._computeIntersections(e,t,vh)))}getVertexPosition(e,t){return super.getVertexPosition(e,t),this.applyBoneTransform(e,t),t}bind(e,t){this.skeleton=e,t===void 0&&(this.updateMatrixWorld(!0),this.skeleton.calculateInverses(),t=this.matrixWorld),this.bindMatrix.copy(t),this.bindMatrixInverse.copy(t).invert()}pose(){this.skeleton.pose()}normalizeSkinWeights(){let e=new ut,t=this.geometry.attributes.skinWeight;for(let n=0,i=t.count;n<i;n++){e.fromBufferAttribute(t,n);let r=1/e.manhattanLength();r!==1/0?e.multiplyScalar(r):e.set(1,0,0,0),t.setXYZW(n,e.x,e.y,e.z,e.w)}}updateMatrixWorld(e){super.updateMatrixWorld(e),this.bindMode===Eh?this.bindMatrixInverse.copy(this.matrixWorld).invert():this.bindMode===Wf?this.bindMatrixInverse.copy(this.bindMatrix).invert():Ge("SkinnedMesh: Unrecognized bindMode: "+this.bindMode)}applyBoneTransform(e,t){let n=this.skeleton,i=this.geometry;Zd.fromBufferAttribute(i.attributes.skinIndex,e),Kd.fromBufferAttribute(i.attributes.skinWeight,e),t.isVector4?(kr.copy(t),t.set(0,0,0,0)):(kr.set(...t,1),t.set(0,0,0)),kr.applyMatrix4(this.bindMatrix);for(let r=0;r<4;r++){let o=Kd.getComponent(r);if(o!==0){let a=Zd.getComponent(r);Jd.multiplyMatrices(n.bones[a].matrixWorld,n.boneInverses[a]),t.addScaledVector(d0.copy(kr).applyMatrix4(Jd),o)}}return t.isVector4&&(t.w=kr.w),t.applyMatrix4(this.bindMatrixInverse)}},rr=class extends Ct{constructor(){super(),this.isBone=!0,this.type="Bone"}},ei=class extends Ut{constructor(e=null,t=1,n=1,i,r,o,a,l,c=bt,h=bt,f,d){super(null,o,a,l,c,h,i,r,f,d),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},$d=new je,f0=new je,to=class s{constructor(e=[],t=[]){this.uuid=Cn(),this.bones=e.slice(0),this.boneInverses=t,this.boneMatrices=null,this.boneTexture=null,this.init()}init(){let e=this.bones,t=this.boneInverses;if(this.boneMatrices=new Float32Array(e.length*16),t.length===0)this.calculateInverses();else if(e.length!==t.length){Ge("Skeleton: Number of inverse bone matrices does not match amount of bones."),this.boneInverses=[];for(let n=0,i=this.bones.length;n<i;n++)this.boneInverses.push(new je)}}calculateInverses(){this.boneInverses.length=0;for(let e=0,t=this.bones.length;e<t;e++){let n=new je;this.bones[e]&&n.copy(this.bones[e].matrixWorld).invert(),this.boneInverses.push(n)}}pose(){for(let e=0,t=this.bones.length;e<t;e++){let n=this.bones[e];n&&n.matrixWorld.copy(this.boneInverses[e]).invert()}for(let e=0,t=this.bones.length;e<t;e++){let n=this.bones[e];n&&(n.parent&&n.parent.isBone?(n.matrix.copy(n.parent.matrixWorld).invert(),n.matrix.multiply(n.matrixWorld)):n.matrix.copy(n.matrixWorld),n.matrix.decompose(n.position,n.quaternion,n.scale))}}update(){let e=this.bones,t=this.boneInverses,n=this.boneMatrices,i=this.boneTexture;for(let r=0,o=e.length;r<o;r++){let a=e[r]?e[r].matrixWorld:f0;$d.multiplyMatrices(a,t[r]),$d.toArray(n,r*16)}i!==null&&(i.needsUpdate=!0)}clone(){return new s(this.bones,this.boneInverses)}computeBoneTexture(){let e=Math.sqrt(this.bones.length*4);e=Math.ceil(e/4)*4,e=Math.max(e,4);let t=new Float32Array(e*e*4);t.set(this.boneMatrices);let n=new ei(t,e,e,pn,Tn);return n.needsUpdate=!0,this.boneMatrices=t,this.boneTexture=n,this}getBoneByName(e){for(let t=0,n=this.bones.length;t<n;t++){let i=this.bones[t];if(i.name===e)return i}}dispose(){this.boneTexture!==null&&(this.boneTexture.dispose(),this.boneTexture=null)}fromJSON(e,t){this.uuid=e.uuid;for(let n=0,i=e.bones.length;n<i;n++){let r=e.bones[n],o=t[r];o===void 0&&(Ge("Skeleton: No bone found with UUID:",r),o=new rr),this.bones.push(o),this.boneInverses.push(new je().fromArray(e.boneInverses[n]))}return this.init(),this}toJSON(){let e={metadata:{version:4.7,type:"Skeleton",generator:"Skeleton.toJSON"},bones:[],boneInverses:[]};e.uuid=this.uuid;let t=this.bones,n=this.boneInverses;for(let i=0,r=t.length;i<r;i++){let o=t[i];e.bones.push(o.uuid);let a=n[i];e.boneInverses.push(a.toArray())}return e}},Mi=class extends Pt{constructor(e,t,n,i=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=i}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}},Ws=new je,ef=new je,Ia=[],tf=new an,p0=new je,zr=new Re,Hr=new gn,no=class extends Re{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new Mi(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let i=0;i<n;i++)this.setMatrixAt(i,p0)}computeBoundingBox(){let e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new an),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Ws),tf.copy(e.boundingBox).applyMatrix4(Ws),this.boundingBox.union(tf)}computeBoundingSphere(){let e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new gn),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Ws),Hr.copy(e.boundingSphere).applyMatrix4(Ws),this.boundingSphere.union(Hr)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){return this.instanceColor===null?t.setRGB(1,1,1):t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){return t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){let n=t.morphTargetInfluences,i=this.morphTexture.source.data.data,r=n.length+1,o=e*r+1;for(let a=0;a<n.length;a++)n[a]=i[o+a]}raycast(e,t){let n=this.matrixWorld,i=this.count;if(zr.geometry=this.geometry,zr.material=this.material,zr.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Hr.copy(this.boundingSphere),Hr.applyMatrix4(n),e.ray.intersectsSphere(Hr)!==!1))for(let r=0;r<i;r++){this.getMatrixAt(r,Ws),ef.multiplyMatrices(n,Ws),zr.matrixWorld=ef,zr.raycast(e,Ia);for(let o=0,a=Ia.length;o<a;o++){let l=Ia[o];l.instanceId=r,l.object=this,t.push(l)}Ia.length=0}}setColorAt(e,t){return this.instanceColor===null&&(this.instanceColor=new Mi(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3),this}setMatrixAt(e,t){return t.toArray(this.instanceMatrix.array,e*16),this}setMorphAt(e,t){let n=t.morphTargetInfluences,i=n.length+1;this.morphTexture===null&&(this.morphTexture=new ei(new Float32Array(i*this.count),i,this.count,Pl,Tn));let r=this.morphTexture.source.data.data,o=0;for(let c=0;c<n.length;c++)o+=n[c];let a=this.geometry.morphTargetsRelative?1:1-o,l=i*e;return r[l]=a,r.set(n,l+1),this}updateMorphTargets(){}dispose(){super.dispose(),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}},os=new gn,m0=new ee(.5,.5),Da=new D,or=class{constructor(e=new Qt,t=new Qt,n=new Qt,i=new Qt,r=new Qt,o=new Qt){this.planes=[e,t,n,i,r,o]}set(e,t,n,i,r,o){let a=this.planes;return a[0].copy(e),a[1].copy(t),a[2].copy(n),a[3].copy(i),a[4].copy(r),a[5].copy(o),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=zn,n=!1){let i=this.planes,r=e.elements,o=r[0],a=r[1],l=r[2],c=r[3],h=r[4],f=r[5],d=r[6],u=r[7],p=r[8],x=r[9],m=r[10],g=r[11],b=r[12],T=r[13],_=r[14],M=r[15];if(i[0].setComponents(c-o,u-h,g-p,M-b).normalize(),i[1].setComponents(c+o,u+h,g+p,M+b).normalize(),i[2].setComponents(c+a,u+f,g+x,M+T).normalize(),i[3].setComponents(c-a,u-f,g-x,M-T).normalize(),n)i[4].setComponents(l,d,m,_).normalize(),i[5].setComponents(c-l,u-d,g-m,M-_).normalize();else if(i[4].setComponents(c-l,u-d,g-m,M-_).normalize(),t===zn)i[5].setComponents(c+l,u+d,g+m,M+_).normalize();else if(t===Js)i[5].setComponents(l,d,m,_).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),os.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),os.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(os)}intersectsSprite(e){os.center.set(0,0,0);let t=m0.distanceTo(e.center);return os.radius=.7071067811865476+t,os.applyMatrix4(e.matrixWorld),this.intersectsSphere(os)}intersectsSphere(e){let t=this.planes,n=e.center,i=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(n)<i)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let i=t[n];if(Da.x=i.normal.x>0?e.max.x:e.min.x,Da.y=i.normal.y>0?e.max.y:e.min.y,Da.z=i.normal.z>0?e.max.z:e.min.z,i.distanceToPoint(Da)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var Hi=class extends $t{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new Ee(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}},tl=new D,nl=new D,nf=new je,Vr=new $n,Na=new gn,yh=new D,sf=new D,ds=class extends Ct{constructor(e=new _t,t=new Hi){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[0];for(let i=1,r=t.count;i<r;i++)tl.fromBufferAttribute(t,i-1),nl.fromBufferAttribute(t,i),n[i]=n[i-1],n[i]+=tl.distanceTo(nl);e.setAttribute("lineDistance",new at(n,1))}else Ge("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,i=this.matrixWorld,r=e.params.Line.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Na.copy(n.boundingSphere),Na.applyMatrix4(i),Na.radius+=r,e.ray.intersectsSphere(Na)===!1)return;nf.copy(i).invert(),Vr.copy(e.ray).applyMatrix4(nf);let a=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=this.isLineSegments?2:1,h=n.index,d=n.attributes.position;if(h!==null){let u=Math.max(0,o.start),p=Math.min(h.count,o.start+o.count);for(let x=u,m=p-1;x<m;x+=c){let g=h.getX(x),b=h.getX(x+1),T=Ua(this,e,Vr,l,g,b,x);T&&t.push(T)}if(this.isLineLoop){let x=h.getX(p-1),m=h.getX(u),g=Ua(this,e,Vr,l,x,m,p-1);g&&t.push(g)}}else{let u=Math.max(0,o.start),p=Math.min(d.count,o.start+o.count);for(let x=u,m=p-1;x<m;x+=c){let g=Ua(this,e,Vr,l,x,x+1,x);g&&t.push(g)}if(this.isLineLoop){let x=Ua(this,e,Vr,l,p-1,u,p-1);x&&t.push(x)}}}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=i.length;r<o;r++){let a=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}};function Ua(s,e,t,n,i,r,o){let a=s.geometry.attributes.position;if(tl.fromBufferAttribute(a,i),nl.fromBufferAttribute(a,r),t.distanceSqToSegment(tl,nl,yh,sf)>n)return;yh.applyMatrix4(s.matrixWorld);let c=e.ray.origin.distanceTo(yh);if(!(c<e.near||c>e.far))return{distance:c,point:sf.clone().applyMatrix4(s.matrixWorld),index:o,face:null,faceIndex:null,barycoord:null,object:s}}var rf=new D,of=new D,fs=class extends ds{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let e=this.geometry;if(e.index===null){let t=e.attributes.position,n=[];for(let i=0,r=t.count;i<r;i+=2)rf.fromBufferAttribute(t,i),of.fromBufferAttribute(t,i+1),n[i]=i===0?0:n[i-1],n[i+1]=n[i]+rf.distanceTo(of);e.setAttribute("lineDistance",new at(n,1))}else Ge("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}},io=class extends ds{constructor(e,t){super(e,t),this.isLineLoop=!0,this.type="LineLoop"}},ar=class extends $t{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new Ee(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},af=new je,Lh=new $n,Oa=new gn,Fa=new D,so=class extends Ct{constructor(e=new _t,t=new ar){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){let n=this.geometry,i=this.matrixWorld,r=e.params.Points.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Oa.copy(n.boundingSphere),Oa.applyMatrix4(i),Oa.radius+=r,e.ray.intersectsSphere(Oa)===!1)return;af.copy(i).invert(),Lh.copy(e.ray).applyMatrix4(af);let a=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=n.index,f=n.attributes.position;if(c!==null){let d=Math.max(0,o.start),u=Math.min(c.count,o.start+o.count);for(let p=d,x=u;p<x;p++){let m=c.getX(p);Fa.fromBufferAttribute(f,m),lf(Fa,m,l,i,e,t,this)}}else{let d=Math.max(0,o.start),u=Math.min(f.count,o.start+o.count);for(let p=d,x=u;p<x;p++)Fa.fromBufferAttribute(f,p),lf(Fa,p,l,i,e,t,this)}}updateMorphTargets(){let t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){let i=t[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=i.length;r<o;r++){let a=i[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}};function lf(s,e,t,n,i,r,o){let a=Lh.distanceSqToPoint(s);if(a<t){let l=new D;Lh.closestPointToPoint(s,l),l.applyMatrix4(n);let c=i.ray.origin.distanceTo(l);if(c<i.near||c>i.far)return;r.push({distance:c,distanceToRay:Math.sqrt(a),point:l,index:e,face:null,faceIndex:null,barycoord:null,object:o})}}var ro=class extends Ut{constructor(e=[],t=Ji,n,i,r,o,a,l,c,h){super(e,t,n,i,r,o,a,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},Vn=class extends Ut{constructor(e,t,n,i,r,o,a,l,c){super(e,t,n,i,r,o,a,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}};var ti=class extends Ut{constructor(e,t,n=Wn,i,r,o,a=bt,l=bt,c,h=Jn,f=1){if(h!==Jn&&h!==ri)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let d={width:e,height:t,depth:f};super(d,i,r,o,a,l,h,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new er(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return t.compareFunction=this.compareFunction,t}},il=class extends ti{constructor(e,t=Wn,n=Ji,i,r,o=bt,a=bt,l,c=Jn){let h={width:e,height:e,depth:1},f=[h,h,h,h,h,h];super(e,e,t,n,i,r,o,a,l,c),this.image=f,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},oo=class extends Ut{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},Xt=class s extends _t{constructor(e=1,t=1,n=1,i=1,r=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:i,heightSegments:r,depthSegments:o};let a=this;i=Math.floor(i),r=Math.floor(r),o=Math.floor(o);let l=[],c=[],h=[],f=[],d=0,u=0;p("z","y","x",-1,-1,n,t,e,o,r,0),p("z","y","x",1,-1,n,t,-e,o,r,1),p("x","z","y",1,1,e,n,t,i,o,2),p("x","z","y",1,-1,e,n,-t,i,o,3),p("x","y","z",1,-1,e,t,n,i,r,4),p("x","y","z",-1,-1,e,t,-n,i,r,5),this.setIndex(l),this.setAttribute("position",new at(c,3)),this.setAttribute("normal",new at(h,3)),this.setAttribute("uv",new at(f,2));function p(x,m,g,b,T,_,M,E,A,v,R){let N=_/A,L=M/v,S=_/2,w=M/2,P=E/2,U=A+1,F=v+1,O=0,H=0,k=new D;for(let W=0;W<F;W++){let Z=W*L-w;for(let he=0;he<U;he++){let pe=he*N-S;k[x]=pe*b,k[m]=Z*T,k[g]=P,c.push(k.x,k.y,k.z),k[x]=0,k[m]=0,k[g]=E>0?1:-1,h.push(k.x,k.y,k.z),f.push(he/A),f.push(1-W/v),O+=1}}for(let W=0;W<v;W++)for(let Z=0;Z<A;Z++){let he=d+Z+U*W,pe=d+Z+U*(W+1),Ae=d+(Z+1)+U*(W+1),we=d+(Z+1)+U*W;l.push(he,pe,we),l.push(pe,Ae,we),H+=6}a.addGroup(u,H,R),u+=H,d+=O}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}};var ao=class s extends _t{constructor(e=1,t=32,n=0,i=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:e,segments:t,thetaStart:n,thetaLength:i},t=Math.max(3,t);let r=[],o=[],a=[],l=[],c=new D,h=new ee;o.push(0,0,0),a.push(0,0,1),l.push(.5,.5);for(let f=0,d=3;f<=t;f++,d+=3){let u=n+f/t*i;c.x=e*Math.cos(u),c.y=e*Math.sin(u),o.push(c.x,c.y,c.z),a.push(0,0,1),h.x=(o[d]/e+1)/2,h.y=(o[d+1]/e+1)/2,l.push(h.x,h.y)}for(let f=1;f<=t;f++)r.push(f,f+1,0);this.setIndex(r),this.setAttribute("position",new at(o,3)),this.setAttribute("normal",new at(a,3)),this.setAttribute("uv",new at(l,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.radius,e.segments,e.thetaStart,e.thetaLength)}},Jt=class s extends _t{constructor(e=1,t=1,n=1,i=32,r=1,o=!1,a=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:i,heightSegments:r,openEnded:o,thetaStart:a,thetaLength:l};let c=this;i=Math.floor(i),r=Math.floor(r);let h=[],f=[],d=[],u=[],p=0,x=[],m=n/2,g=0;b(),o===!1&&(e>0&&T(!0),t>0&&T(!1)),this.setIndex(h),this.setAttribute("position",new at(f,3)),this.setAttribute("normal",new at(d,3)),this.setAttribute("uv",new at(u,2));function b(){let _=new D,M=new D,E=0,A=(t-e)/n;for(let v=0;v<=r;v++){let R=[],N=v/r,L=N*(t-e)+e;for(let S=0;S<=i;S++){let w=S/i,P=w*l+a,U=Math.sin(P),F=Math.cos(P);M.x=L*U,M.y=-N*n+m,M.z=L*F,f.push(M.x,M.y,M.z),_.set(U,A,F).normalize(),d.push(_.x,_.y,_.z),u.push(w,1-N),R.push(p++)}x.push(R)}for(let v=0;v<i;v++)for(let R=0;R<r;R++){let N=x[R][v],L=x[R+1][v],S=x[R+1][v+1],w=x[R][v+1];(e>0||R!==0)&&(h.push(N,L,w),E+=3),(t>0||R!==r-1)&&(h.push(L,S,w),E+=3)}c.addGroup(g,E,0),g+=E}function T(_){let M=p,E=new ee,A=new D,v=0,R=_===!0?e:t,N=_===!0?1:-1;for(let S=1;S<=i;S++)f.push(0,m*N,0),d.push(0,N,0),u.push(.5,.5),p++;let L=p;for(let S=0;S<=i;S++){let P=S/i*l+a,U=Math.cos(P),F=Math.sin(P);A.x=R*F,A.y=m*N,A.z=R*U,f.push(A.x,A.y,A.z),d.push(0,N,0),E.x=U*.5+.5,E.y=F*.5*N+.5,u.push(E.x,E.y),p++}for(let S=0;S<i;S++){let w=M+S,P=L+S;_===!0?h.push(P,P+1,w):h.push(P+1,P,w),v+=3}c.addGroup(g,v,_===!0?1:2),g+=v}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}};var bn=class{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){Ge("Curve: .getPoint() not implemented.")}getPointAt(e,t){let n=this.getUtoTmapping(e);return this.getPoint(n,t)}getPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return t}getSpacedPoints(e=5){let t=[];for(let n=0;n<=e;n++)t.push(this.getPointAt(n/e));return t}getLength(){let e=this.getLengths();return e[e.length-1]}getLengths(e=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===e+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let t=[],n,i=this.getPoint(0),r=0;t.push(0);for(let o=1;o<=e;o++)n=this.getPoint(o/e),r+=n.distanceTo(i),t.push(r),i=n;return this.cacheArcLengths=t,t}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(e,t=null){let n=this.getLengths(),i=0,r=n.length,o;t?o=t:o=e*n[r-1];let a=0,l=r-1,c;for(;a<=l;)if(i=Math.floor(a+(l-a)/2),c=n[i]-o,c<0)a=i+1;else if(c>0)l=i-1;else{l=i;break}if(i=l,n[i]===o)return i/(r-1);let h=n[i],d=n[i+1]-h,u=(o-h)/d;return(i+u)/(r-1)}getTangent(e,t){let i=e-1e-4,r=e+1e-4;i<0&&(i=0),r>1&&(r=1);let o=this.getPoint(i),a=this.getPoint(r),l=t||(o.isVector2?new ee:new D);return l.copy(a).sub(o).normalize(),l}getTangentAt(e,t){let n=this.getUtoTmapping(e);return this.getTangent(n,t)}computeFrenetFrames(e,t=!1){let n=new D,i=[],r=[],o=[],a=new D,l=new je;for(let u=0;u<=e;u++){let p=u/e;i[u]=this.getTangentAt(p,new D)}r[0]=new D,o[0]=new D;let c=Number.MAX_VALUE,h=Math.abs(i[0].x),f=Math.abs(i[0].y),d=Math.abs(i[0].z);h<=c&&(c=h,n.set(1,0,0)),f<=c&&(c=f,n.set(0,1,0)),d<=c&&n.set(0,0,1),a.crossVectors(i[0],n).normalize(),r[0].crossVectors(i[0],a),o[0].crossVectors(i[0],r[0]);for(let u=1;u<=e;u++){if(r[u]=r[u-1].clone(),o[u]=o[u-1].clone(),a.crossVectors(i[u-1],i[u]),a.length()>Number.EPSILON){a.normalize();let p=Math.acos(nt(i[u-1].dot(i[u]),-1,1));r[u].applyMatrix4(l.makeRotationAxis(a,p))}o[u].crossVectors(i[u],r[u])}if(t===!0){let u=Math.acos(nt(r[0].dot(r[e]),-1,1));u/=e,i[0].dot(a.crossVectors(r[0],r[e]))>0&&(u=-u);for(let p=1;p<=e;p++)r[p].applyMatrix4(l.makeRotationAxis(i[p],u*p)),o[p].crossVectors(i[p],r[p])}return{tangents:i,normals:r,binormals:o}}clone(){return new this.constructor().copy(this)}copy(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}toJSON(){let e={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return e.arcLengthDivisions=this.arcLengthDivisions,e.type=this.type,e}fromJSON(e){return this.arcLengthDivisions=e.arcLengthDivisions,this}},lr=class extends bn{constructor(e=0,t=0,n=1,i=1,r=0,o=Math.PI*2,a=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=e,this.aY=t,this.xRadius=n,this.yRadius=i,this.aStartAngle=r,this.aEndAngle=o,this.aClockwise=a,this.aRotation=l}getPoint(e,t=new ee){let n=t,i=Math.PI*2,r=this.aEndAngle-this.aStartAngle,o=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=i;for(;r>i;)r-=i;r<Number.EPSILON&&(o?r=0:r=i),this.aClockwise===!0&&!o&&(r===i?r=-i:r=r-i);let a=this.aStartAngle+e*r,l=this.aX+this.xRadius*Math.cos(a),c=this.aY+this.yRadius*Math.sin(a);if(this.aRotation!==0){let h=Math.cos(this.aRotation),f=Math.sin(this.aRotation),d=l-this.aX,u=c-this.aY;l=d*h-u*f+this.aX,c=d*f+u*h+this.aY}return n.set(l,c)}copy(e){return super.copy(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}toJSON(){let e=super.toJSON();return e.aX=this.aX,e.aY=this.aY,e.xRadius=this.xRadius,e.yRadius=this.yRadius,e.aStartAngle=this.aStartAngle,e.aEndAngle=this.aEndAngle,e.aClockwise=this.aClockwise,e.aRotation=this.aRotation,e}fromJSON(e){return super.fromJSON(e),this.aX=e.aX,this.aY=e.aY,this.xRadius=e.xRadius,this.yRadius=e.yRadius,this.aStartAngle=e.aStartAngle,this.aEndAngle=e.aEndAngle,this.aClockwise=e.aClockwise,this.aRotation=e.aRotation,this}},sl=class extends lr{constructor(e,t,n,i,r,o){super(e,t,n,n,i,r,o),this.isArcCurve=!0,this.type="ArcCurve"}};function ru(){let s=0,e=0,t=0,n=0;function i(r,o,a,l){s=r,e=a,t=-3*r+3*o-2*a-l,n=2*r-2*o+a+l}return{initCatmullRom:function(r,o,a,l,c){i(o,a,c*(a-r),c*(l-o))},initNonuniformCatmullRom:function(r,o,a,l,c,h,f){let d=(o-r)/c-(a-r)/(c+h)+(a-o)/h,u=(a-o)/h-(l-o)/(h+f)+(l-a)/f;d*=h,u*=h,i(o,a,d,u)},calc:function(r){let o=r*r,a=o*r;return s+e*r+t*o+n*a}}}var cf=new D,hf=new D,Mh=new ru,bh=new ru,Sh=new ru,rl=class extends bn{constructor(e=[],t=!1,n="centripetal",i=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=e,this.closed=t,this.curveType=n,this.tension=i}getPoint(e,t=new D){let n=t,i=this.points,r=i.length,o=(r-(this.closed?0:1))*e,a=Math.floor(o),l=o-a;this.closed?a+=a>0?0:(Math.floor(Math.abs(a)/r)+1)*r:l===0&&a===r-1&&(a=r-2,l=1);let c,h;this.closed||a>0?c=i[(a-1)%r]:(hf.subVectors(i[0],i[1]).add(i[0]),c=hf);let f=i[a%r],d=i[(a+1)%r];if(this.closed||a+2<r?h=i[(a+2)%r]:(cf.subVectors(i[r-1],i[r-2]).add(i[r-1]),h=cf),this.curveType==="centripetal"||this.curveType==="chordal"){let u=this.curveType==="chordal"?.5:.25,p=Math.pow(c.distanceToSquared(f),u),x=Math.pow(f.distanceToSquared(d),u),m=Math.pow(d.distanceToSquared(h),u);x<1e-4&&(x=1),p<1e-4&&(p=x),m<1e-4&&(m=x),Mh.initNonuniformCatmullRom(c.x,f.x,d.x,h.x,p,x,m),bh.initNonuniformCatmullRom(c.y,f.y,d.y,h.y,p,x,m),Sh.initNonuniformCatmullRom(c.z,f.z,d.z,h.z,p,x,m)}else this.curveType==="catmullrom"&&(Mh.initCatmullRom(c.x,f.x,d.x,h.x,this.tension),bh.initCatmullRom(c.y,f.y,d.y,h.y,this.tension),Sh.initCatmullRom(c.z,f.z,d.z,h.z,this.tension));return n.set(Mh.calc(l),bh.calc(l),Sh.calc(l)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(i.clone())}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let i=this.points[t];e.points.push(i.toArray())}return e.closed=this.closed,e.curveType=this.curveType,e.tension=this.tension,e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(new D().fromArray(i))}return this.closed=e.closed,this.curveType=e.curveType,this.tension=e.tension,this}};function uf(s,e,t,n,i){let r=(n-e)*.5,o=(i-t)*.5,a=s*s,l=s*a;return(2*t-2*n+r+o)*l+(-3*t+3*n-2*r-o)*a+r*s+t}function g0(s,e){let t=1-s;return t*t*e}function x0(s,e){return 2*(1-s)*s*e}function _0(s,e){return s*s*e}function qr(s,e,t,n){return g0(s,e)+x0(s,t)+_0(s,n)}function v0(s,e){let t=1-s;return t*t*t*e}function y0(s,e){let t=1-s;return 3*t*t*s*e}function M0(s,e){return 3*(1-s)*s*s*e}function b0(s,e){return s*s*s*e}function Yr(s,e,t,n,i){return v0(s,e)+y0(s,t)+M0(s,n)+b0(s,i)}var lo=class extends bn{constructor(e=new ee,t=new ee,n=new ee,i=new ee){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=e,this.v1=t,this.v2=n,this.v3=i}getPoint(e,t=new ee){let n=t,i=this.v0,r=this.v1,o=this.v2,a=this.v3;return n.set(Yr(e,i.x,r.x,o.x,a.x),Yr(e,i.y,r.y,o.y,a.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},ol=class extends bn{constructor(e=new D,t=new D,n=new D,i=new D){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=e,this.v1=t,this.v2=n,this.v3=i}getPoint(e,t=new D){let n=t,i=this.v0,r=this.v1,o=this.v2,a=this.v3;return n.set(Yr(e,i.x,r.x,o.x,a.x),Yr(e,i.y,r.y,o.y,a.y),Yr(e,i.z,r.z,o.z,a.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this.v3.copy(e.v3),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e.v3=this.v3.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this.v3.fromArray(e.v3),this}},co=class extends bn{constructor(e=new ee,t=new ee){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=e,this.v2=t}getPoint(e,t=new ee){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new ee){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},al=class extends bn{constructor(e=new D,t=new D){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=e,this.v2=t}getPoint(e,t=new D){let n=t;return e===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(e).add(this.v1)),n}getPointAt(e,t){return this.getPoint(e,t)}getTangent(e,t=new D){return t.subVectors(this.v2,this.v1).normalize()}getTangentAt(e,t){return this.getTangent(e,t)}copy(e){return super.copy(e),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},ho=class extends bn{constructor(e=new ee,t=new ee,n=new ee){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new ee){let n=t,i=this.v0,r=this.v1,o=this.v2;return n.set(qr(e,i.x,r.x,o.x),qr(e,i.y,r.y,o.y)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},ll=class extends bn{constructor(e=new D,t=new D,n=new D){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=e,this.v1=t,this.v2=n}getPoint(e,t=new D){let n=t,i=this.v0,r=this.v1,o=this.v2;return n.set(qr(e,i.x,r.x,o.x),qr(e,i.y,r.y,o.y),qr(e,i.z,r.z,o.z)),n}copy(e){return super.copy(e),this.v0.copy(e.v0),this.v1.copy(e.v1),this.v2.copy(e.v2),this}toJSON(){let e=super.toJSON();return e.v0=this.v0.toArray(),e.v1=this.v1.toArray(),e.v2=this.v2.toArray(),e}fromJSON(e){return super.fromJSON(e),this.v0.fromArray(e.v0),this.v1.fromArray(e.v1),this.v2.fromArray(e.v2),this}},uo=class extends bn{constructor(e=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=e}getPoint(e,t=new ee){let n=t,i=this.points,r=(i.length-1)*e,o=Math.floor(r),a=r-o,l=i[o===0?o:o-1],c=i[o],h=i[o>i.length-2?i.length-1:o+1],f=i[o>i.length-3?i.length-1:o+2];return n.set(uf(a,l.x,c.x,h.x,f.x),uf(a,l.y,c.y,h.y,f.y)),n}copy(e){super.copy(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(i.clone())}return this}toJSON(){let e=super.toJSON();e.points=[];for(let t=0,n=this.points.length;t<n;t++){let i=this.points[t];e.points.push(i.toArray())}return e}fromJSON(e){super.fromJSON(e),this.points=[];for(let t=0,n=e.points.length;t<n;t++){let i=e.points[t];this.points.push(new ee().fromArray(i))}return this}},Ih=Object.freeze({__proto__:null,ArcCurve:sl,CatmullRomCurve3:rl,CubicBezierCurve:lo,CubicBezierCurve3:ol,EllipseCurve:lr,LineCurve:co,LineCurve3:al,QuadraticBezierCurve:ho,QuadraticBezierCurve3:ll,SplineCurve:uo}),cl=class extends bn{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(e){this.curves.push(e)}closePath(){let e=this.curves[0].getPoint(0),t=this.curves[this.curves.length-1].getPoint(1);if(!e.equals(t)){let n=e.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new Ih[n](t,e))}return this}getPoint(e,t){let n=e*this.getLength(),i=this.getCurveLengths(),r=0;for(;r<i.length;){if(i[r]>=n){let o=i[r]-n,a=this.curves[r],l=a.getLength(),c=l===0?0:1-o/l;return a.getPointAt(c,t)}r++}return null}getLength(){let e=this.getCurveLengths();return e[e.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;let e=[],t=0;for(let n=0,i=this.curves.length;n<i;n++)t+=this.curves[n].getLength(),e.push(t);return this.cacheLengths=e,e}getSpacedPoints(e=40){let t=[];for(let n=0;n<=e;n++)t.push(this.getPoint(n/e));return this.autoClose&&t.push(t[0]),t}getPoints(e=12){let t=[],n;for(let i=0,r=this.curves;i<r.length;i++){let o=r[i],a=o.isEllipseCurve?e*2:o.isLineCurve||o.isLineCurve3?1:o.isSplineCurve?e*o.points.length:e,l=o.getPoints(a);for(let c=0;c<l.length;c++){let h=l[c];n&&n.equals(h)||(t.push(h),n=h)}}return this.autoClose&&t.length>1&&!t[t.length-1].equals(t[0])&&t.push(t[0]),t}copy(e){super.copy(e),this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){let i=e.curves[t];this.curves.push(i.clone())}return this.autoClose=e.autoClose,this}toJSON(){let e=super.toJSON();e.autoClose=this.autoClose,e.curves=[];for(let t=0,n=this.curves.length;t<n;t++){let i=this.curves[t];e.curves.push(i.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.autoClose=e.autoClose,this.curves=[];for(let t=0,n=e.curves.length;t<n;t++){let i=e.curves[t];this.curves.push(new Ih[i.type]().fromJSON(i))}return this}},ps=class extends cl{constructor(e){super(),this.type="Path",this.currentPoint=new ee,e&&this.setFromPoints(e)}setFromPoints(e){this.moveTo(e[0].x,e[0].y);for(let t=1,n=e.length;t<n;t++)this.lineTo(e[t].x,e[t].y);return this}moveTo(e,t){return this.currentPoint.set(e,t),this}lineTo(e,t){let n=new co(this.currentPoint.clone(),new ee(e,t));return this.curves.push(n),this.currentPoint.set(e,t),this}quadraticCurveTo(e,t,n,i){let r=new ho(this.currentPoint.clone(),new ee(e,t),new ee(n,i));return this.curves.push(r),this.currentPoint.set(n,i),this}bezierCurveTo(e,t,n,i,r,o){let a=new lo(this.currentPoint.clone(),new ee(e,t),new ee(n,i),new ee(r,o));return this.curves.push(a),this.currentPoint.set(r,o),this}splineThru(e){let t=[this.currentPoint.clone()].concat(e),n=new uo(t);return this.curves.push(n),this.currentPoint.copy(e[e.length-1]),this}arc(e,t,n,i,r,o){let a=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(e+a,t+l,n,i,r,o),this}absarc(e,t,n,i,r,o){return this.absellipse(e,t,n,n,i,r,o),this}ellipse(e,t,n,i,r,o,a,l){let c=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(e+c,t+h,n,i,r,o,a,l),this}absellipse(e,t,n,i,r,o,a,l){let c=new lr(e,t,n,i,r,o,a,l);if(this.curves.length>0){let f=c.getPoint(0);f.equals(this.currentPoint)||this.lineTo(f.x,f.y)}this.curves.push(c);let h=c.getPoint(1);return this.currentPoint.copy(h),this}copy(e){return super.copy(e),this.currentPoint.copy(e.currentPoint),this}toJSON(){let e=super.toJSON();return e.currentPoint=this.currentPoint.toArray(),e}fromJSON(e){return super.fromJSON(e),this.currentPoint.fromArray(e.currentPoint),this}},ms=class extends ps{constructor(e){super(e),this.uuid=Cn(),this.type="Shape",this.holes=[]}getPointsHoles(e){let t=[];for(let n=0,i=this.holes.length;n<i;n++)t[n]=this.holes[n].getPoints(e);return t}extractPoints(e){return{shape:this.getPoints(e),holes:this.getPointsHoles(e)}}copy(e){super.copy(e),this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){let i=e.holes[t];this.holes.push(i.clone())}return this}toJSON(){let e=super.toJSON();e.uuid=this.uuid,e.holes=[];for(let t=0,n=this.holes.length;t<n;t++){let i=this.holes[t];e.holes.push(i.toJSON())}return e}fromJSON(e){super.fromJSON(e),this.uuid=e.uuid,this.holes=[];for(let t=0,n=e.holes.length;t<n;t++){let i=e.holes[t];this.holes.push(new ps().fromJSON(i))}return this}};function S0(s,e,t=2){let n=e&&e.length,i=n?e[0]*t:s.length,r=ap(s,0,i,t,!0),o=[];if(!r||r.next===r.prev)return o;let a,l,c;if(n&&(r=C0(s,e,r,t)),s.length>80*t){a=s[0],l=s[1];let h=a,f=l;for(let d=t;d<i;d+=t){let u=s[d],p=s[d+1];u<a&&(a=u),p<l&&(l=p),u>h&&(h=u),p>f&&(f=p)}c=Math.max(h-a,f-l),c=c!==0?32767/c:0}return fo(r,o,t,a,l,c,0),o}function ap(s,e,t,n,i){let r;if(i===k0(s,e,t,n)>0)for(let o=e;o<t;o+=n)r=df(o/n|0,s[o],s[o+1],r);else for(let o=t-n;o>=e;o-=n)r=df(o/n|0,s[o],s[o+1],r);return r&&cr(r,r.next)&&(mo(r),r=r.next),r}function gs(s,e){if(!s)return s;e||(e=s);let t=s,n;do if(n=!1,!t.steiner&&(cr(t,t.next)||Lt(t.prev,t,t.next)===0)){if(mo(t),t=e=t.prev,t===t.next)break;n=!0}else t=t.next;while(n||t!==e);return e}function fo(s,e,t,n,i,r,o){if(!s)return;!o&&r&&D0(s,n,i,r);let a=s;for(;s.prev!==s.next;){let l=s.prev,c=s.next;if(r?T0(s,n,i,r):w0(s)){e.push(l.i,s.i,c.i),mo(s),s=c.next,a=c.next;continue}if(s=c,s===a){o?o===1?(s=E0(gs(s),e),fo(s,e,t,n,i,r,2)):o===2&&A0(s,e,t,n,i,r):fo(gs(s),e,t,n,i,r,1);break}}}function w0(s){let e=s.prev,t=s,n=s.next;if(Lt(e,t,n)>=0)return!1;let i=e.x,r=t.x,o=n.x,a=e.y,l=t.y,c=n.y,h=Math.min(i,r,o),f=Math.min(a,l,c),d=Math.max(i,r,o),u=Math.max(a,l,c),p=n.next;for(;p!==e;){if(p.x>=h&&p.x<=d&&p.y>=f&&p.y<=u&&Gr(i,a,r,l,o,c,p.x,p.y)&&Lt(p.prev,p,p.next)>=0)return!1;p=p.next}return!0}function T0(s,e,t,n){let i=s.prev,r=s,o=s.next;if(Lt(i,r,o)>=0)return!1;let a=i.x,l=r.x,c=o.x,h=i.y,f=r.y,d=o.y,u=Math.min(a,l,c),p=Math.min(h,f,d),x=Math.max(a,l,c),m=Math.max(h,f,d),g=Dh(u,p,e,t,n),b=Dh(x,m,e,t,n),T=s.prevZ,_=s.nextZ;for(;T&&T.z>=g&&_&&_.z<=b;){if(T.x>=u&&T.x<=x&&T.y>=p&&T.y<=m&&T!==i&&T!==o&&Gr(a,h,l,f,c,d,T.x,T.y)&&Lt(T.prev,T,T.next)>=0||(T=T.prevZ,_.x>=u&&_.x<=x&&_.y>=p&&_.y<=m&&_!==i&&_!==o&&Gr(a,h,l,f,c,d,_.x,_.y)&&Lt(_.prev,_,_.next)>=0))return!1;_=_.nextZ}for(;T&&T.z>=g;){if(T.x>=u&&T.x<=x&&T.y>=p&&T.y<=m&&T!==i&&T!==o&&Gr(a,h,l,f,c,d,T.x,T.y)&&Lt(T.prev,T,T.next)>=0)return!1;T=T.prevZ}for(;_&&_.z<=b;){if(_.x>=u&&_.x<=x&&_.y>=p&&_.y<=m&&_!==i&&_!==o&&Gr(a,h,l,f,c,d,_.x,_.y)&&Lt(_.prev,_,_.next)>=0)return!1;_=_.nextZ}return!0}function E0(s,e){let t=s;do{let n=t.prev,i=t.next.next;!cr(n,i)&&cp(n,t,t.next,i)&&po(n,i)&&po(i,n)&&(e.push(n.i,t.i,i.i),mo(t),mo(t.next),t=s=i),t=t.next}while(t!==s);return gs(t)}function A0(s,e,t,n,i,r){let o=s;do{let a=o.next.next;for(;a!==o.prev;){if(o.i!==a.i&&O0(o,a)){let l=hp(o,a);o=gs(o,o.next),l=gs(l,l.next),fo(o,e,t,n,i,r,0),fo(l,e,t,n,i,r,0);return}a=a.next}o=o.next}while(o!==s)}function C0(s,e,t,n){let i=[];for(let r=0,o=e.length;r<o;r++){let a=e[r]*n,l=r<o-1?e[r+1]*n:s.length,c=ap(s,a,l,n,!1);c===c.next&&(c.steiner=!0),i.push(U0(c))}i.sort(R0);for(let r=0;r<i.length;r++)t=P0(i[r],t);return t}function R0(s,e){let t=s.x-e.x;if(t===0&&(t=s.y-e.y,t===0)){let n=(s.next.y-s.y)/(s.next.x-s.x),i=(e.next.y-e.y)/(e.next.x-e.x);t=n-i}return t}function P0(s,e){let t=L0(s,e);if(!t)return e;let n=hp(t,s);return gs(n,n.next),gs(t,t.next)}function L0(s,e){let t=e,n=s.x,i=s.y,r=-1/0,o;if(cr(s,t))return t;do{if(cr(s,t.next))return t.next;if(i<=t.y&&i>=t.next.y&&t.next.y!==t.y){let f=t.x+(i-t.y)*(t.next.x-t.x)/(t.next.y-t.y);if(f<=n&&f>r&&(r=f,o=t.x<t.next.x?t:t.next,f===n))return o}t=t.next}while(t!==e);if(!o)return null;let a=o,l=o.x,c=o.y,h=1/0;t=o;do{if(n>=t.x&&t.x>=l&&n!==t.x&&lp(i<c?n:r,i,l,c,i<c?r:n,i,t.x,t.y)){let f=Math.abs(i-t.y)/(n-t.x);po(t,s)&&(f<h||f===h&&(t.x>o.x||t.x===o.x&&I0(o,t)))&&(o=t,h=f)}t=t.next}while(t!==a);return o}function I0(s,e){return Lt(s.prev,s,e.prev)<0&&Lt(e.next,s,s.next)<0}function D0(s,e,t,n){let i=s;do i.z===0&&(i.z=Dh(i.x,i.y,e,t,n)),i.prevZ=i.prev,i.nextZ=i.next,i=i.next;while(i!==s);i.prevZ.nextZ=null,i.prevZ=null,N0(i)}function N0(s){let e,t=1;do{let n=s,i;s=null;let r=null;for(e=0;n;){e++;let o=n,a=0;for(let c=0;c<t&&(a++,o=o.nextZ,!!o);c++);let l=t;for(;a>0||l>0&&o;)a!==0&&(l===0||!o||n.z<=o.z)?(i=n,n=n.nextZ,a--):(i=o,o=o.nextZ,l--),r?r.nextZ=i:s=i,i.prevZ=r,r=i;n=o}r.nextZ=null,t*=2}while(e>1);return s}function Dh(s,e,t,n,i){return s=(s-t)*i|0,e=(e-n)*i|0,s=(s|s<<8)&16711935,s=(s|s<<4)&252645135,s=(s|s<<2)&858993459,s=(s|s<<1)&1431655765,e=(e|e<<8)&16711935,e=(e|e<<4)&252645135,e=(e|e<<2)&858993459,e=(e|e<<1)&1431655765,s|e<<1}function U0(s){let e=s,t=s;do(e.x<t.x||e.x===t.x&&e.y<t.y)&&(t=e),e=e.next;while(e!==s);return t}function lp(s,e,t,n,i,r,o,a){return(i-o)*(e-a)>=(s-o)*(r-a)&&(s-o)*(n-a)>=(t-o)*(e-a)&&(t-o)*(r-a)>=(i-o)*(n-a)}function Gr(s,e,t,n,i,r,o,a){return!(s===o&&e===a)&&lp(s,e,t,n,i,r,o,a)}function O0(s,e){return s.next.i!==e.i&&s.prev.i!==e.i&&!F0(s,e)&&(po(s,e)&&po(e,s)&&B0(s,e)&&(Lt(s.prev,s,e.prev)||Lt(s,e.prev,e))||cr(s,e)&&Lt(s.prev,s,s.next)>0&&Lt(e.prev,e,e.next)>0)}function Lt(s,e,t){return(e.y-s.y)*(t.x-e.x)-(e.x-s.x)*(t.y-e.y)}function cr(s,e){return s.x===e.x&&s.y===e.y}function cp(s,e,t,n){let i=ka(Lt(s,e,t)),r=ka(Lt(s,e,n)),o=ka(Lt(t,n,s)),a=ka(Lt(t,n,e));return!!(i!==r&&o!==a||i===0&&Ba(s,t,e)||r===0&&Ba(s,n,e)||o===0&&Ba(t,s,n)||a===0&&Ba(t,e,n))}function Ba(s,e,t){return e.x<=Math.max(s.x,t.x)&&e.x>=Math.min(s.x,t.x)&&e.y<=Math.max(s.y,t.y)&&e.y>=Math.min(s.y,t.y)}function ka(s){return s>0?1:s<0?-1:0}function F0(s,e){let t=s;do{if(t.i!==s.i&&t.next.i!==s.i&&t.i!==e.i&&t.next.i!==e.i&&cp(t,t.next,s,e))return!0;t=t.next}while(t!==s);return!1}function po(s,e){return Lt(s.prev,s,s.next)<0?Lt(s,e,s.next)>=0&&Lt(s,s.prev,e)>=0:Lt(s,e,s.prev)<0||Lt(s,s.next,e)<0}function B0(s,e){let t=s,n=!1,i=(s.x+e.x)/2,r=(s.y+e.y)/2;do t.y>r!=t.next.y>r&&t.next.y!==t.y&&i<(t.next.x-t.x)*(r-t.y)/(t.next.y-t.y)+t.x&&(n=!n),t=t.next;while(t!==s);return n}function hp(s,e){let t=Nh(s.i,s.x,s.y),n=Nh(e.i,e.x,e.y),i=s.next,r=e.prev;return s.next=e,e.prev=s,t.next=i,i.prev=t,n.next=t,t.prev=n,r.next=n,n.prev=r,n}function df(s,e,t,n){let i=Nh(s,e,t);return n?(i.next=n.next,i.prev=n,n.next.prev=i,n.next=i):(i.prev=i,i.next=i),i}function mo(s){s.next.prev=s.prev,s.prev.next=s.next,s.prevZ&&(s.prevZ.nextZ=s.nextZ),s.nextZ&&(s.nextZ.prevZ=s.prevZ)}function Nh(s,e,t){return{i:s,x:e,y:t,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function k0(s,e,t,n){let i=0;for(let r=e,o=t-n;r<t;r+=n)i+=(s[o]-s[r])*(s[r+1]+s[o+1]),o=r;return i}var Uh=class{static triangulate(e,t,n=2){return S0(e,t,n)}},Zn=class s{static area(e){let t=e.length,n=0;for(let i=t-1,r=0;r<t;i=r++)n+=e[i].x*e[r].y-e[r].x*e[i].y;return n*.5}static isClockWise(e){return s.area(e)<0}static triangulateShape(e,t){let n=[],i=[],r=[];ff(e),pf(n,e);let o=e.length;t.forEach(ff);for(let l=0;l<t.length;l++)i.push(o),o+=t[l].length,pf(n,t[l]);let a=Uh.triangulate(n,i);for(let l=0;l<a.length;l+=3)r.push(a.slice(l,l+3));return r}};function ff(s){let e=s.length;e>2&&s[e-1].equals(s[0])&&s.pop()}function pf(s,e){for(let t=0;t<e.length;t++)s.push(e[t].x),s.push(e[t].y)}var go=class s extends _t{constructor(e=new ms([new ee(.5,.5),new ee(-.5,.5),new ee(-.5,-.5),new ee(.5,-.5)]),t={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:e,options:t},e=Array.isArray(e)?e:[e];let n=this,i=[],r=[];for(let a=0,l=e.length;a<l;a++){let c=e[a];o(c)}this.setAttribute("position",new at(i,3)),this.setAttribute("uv",new at(r,2)),this.computeVertexNormals();function o(a){let l=[],c=t.curveSegments!==void 0?t.curveSegments:12,h=t.steps!==void 0?t.steps:1,f=t.depth!==void 0?t.depth:1,d=t.bevelEnabled!==void 0?t.bevelEnabled:!0,u=t.bevelThickness!==void 0?t.bevelThickness:.2,p=t.bevelSize!==void 0?t.bevelSize:u-.1,x=t.bevelOffset!==void 0?t.bevelOffset:0,m=t.bevelSegments!==void 0?t.bevelSegments:3,g=t.extrudePath,b=t.UVGenerator!==void 0?t.UVGenerator:z0,T,_=!1,M,E,A,v;if(g){T=g.getSpacedPoints(h),_=!0,d=!1;let te=g.isCatmullRomCurve3?g.closed:!1;M=g.computeFrenetFrames(h,te),E=new D,A=new D,v=new D}d||(m=0,u=0,p=0,x=0);let R=a.extractPoints(c),N=R.shape,L=R.holes;if(!Zn.isClockWise(N)){N=N.reverse();for(let te=0,ae=L.length;te<ae;te++){let re=L[te];Zn.isClockWise(re)&&(L[te]=re.reverse())}}function w(te){let re=10000000000000001e-36,oe=te[0];for(let le=1;le<=te.length;le++){let Be=le%te.length,Ne=te[Be],Le=Ne.x-oe.x,Ye=Ne.y-oe.y,B=Le*Le+Ye*Ye,$e=Math.max(Math.abs(Ne.x),Math.abs(Ne.y),Math.abs(oe.x),Math.abs(oe.y)),Ke=re*$e*$e;if(B<=Ke){te.splice(Be,1),le--;continue}oe=Ne}}w(N),L.forEach(w);let P=L.length,U=N;for(let te=0;te<P;te++){let ae=L[te];N=N.concat(ae)}function F(te,ae,re){return ae||Ze("ExtrudeGeometry: vec does not exist"),te.clone().addScaledVector(ae,re)}let O=N.length;function H(te,ae,re){let oe,le,Be,Ne=te.x-ae.x,Le=te.y-ae.y,Ye=re.x-te.x,B=re.y-te.y,$e=Ne*Ne+Le*Le,Ke=Ne*B-Le*Ye;if(Math.abs(Ke)>Number.EPSILON){let I=Math.sqrt($e),y=Math.sqrt(Ye*Ye+B*B),G=ae.x-Le/I,X=ae.y+Ne/I,J=re.x-B/y,ue=re.y+Ye/y,fe=((J-G)*B-(ue-X)*Ye)/(Ne*B-Le*Ye);oe=G+Ne*fe-te.x,le=X+Le*fe-te.y;let $=oe*oe+le*le;if($<=2)return new ee(oe,le);Be=Math.sqrt($/2)}else{let I=!1;Ne>Number.EPSILON?Ye>Number.EPSILON&&(I=!0):Ne<-Number.EPSILON?Ye<-Number.EPSILON&&(I=!0):Math.sign(Le)===Math.sign(B)&&(I=!0),I?(oe=-Le,le=Ne,Be=Math.sqrt($e)):(oe=Ne,le=Le,Be=Math.sqrt($e/2))}return new ee(oe/Be,le/Be)}let k=[];for(let te=0,ae=U.length,re=ae-1,oe=te+1;te<ae;te++,re++,oe++)re===ae&&(re=0),oe===ae&&(oe=0),k[te]=H(U[te],U[re],U[oe]);let W=[],Z,he=k.concat();for(let te=0,ae=P;te<ae;te++){let re=L[te];Z=[];for(let oe=0,le=re.length,Be=le-1,Ne=oe+1;oe<le;oe++,Be++,Ne++)Be===le&&(Be=0),Ne===le&&(Ne=0),Z[oe]=H(re[oe],re[Be],re[Ne]);W.push(Z),he=he.concat(Z)}let pe;if(m===0)pe=Zn.triangulateShape(U,L);else{let te=[],ae=[];for(let re=0;re<m;re++){let oe=re/m,le=u*Math.cos(oe*Math.PI/2),Be=p*Math.sin(oe*Math.PI/2)+x;for(let Ne=0,Le=U.length;Ne<Le;Ne++){let Ye=F(U[Ne],k[Ne],Be);de(Ye.x,Ye.y,-le),oe===0&&te.push(Ye)}for(let Ne=0,Le=P;Ne<Le;Ne++){let Ye=L[Ne];Z=W[Ne];let B=[];for(let $e=0,Ke=Ye.length;$e<Ke;$e++){let I=F(Ye[$e],Z[$e],Be);de(I.x,I.y,-le),oe===0&&B.push(I)}oe===0&&ae.push(B)}}pe=Zn.triangulateShape(te,ae)}let Ae=pe.length,we=p+x;for(let te=0;te<O;te++){let ae=d?F(N[te],he[te],we):N[te];_?(A.copy(M.normals[0]).multiplyScalar(ae.x),E.copy(M.binormals[0]).multiplyScalar(ae.y),v.copy(T[0]).add(A).add(E),de(v.x,v.y,v.z)):de(ae.x,ae.y,0)}for(let te=1;te<=h;te++)for(let ae=0;ae<O;ae++){let re=d?F(N[ae],he[ae],we):N[ae];_?(A.copy(M.normals[te]).multiplyScalar(re.x),E.copy(M.binormals[te]).multiplyScalar(re.y),v.copy(T[te]).add(A).add(E),de(v.x,v.y,v.z)):de(re.x,re.y,f/h*te)}for(let te=m-1;te>=0;te--){let ae=te/m,re=u*Math.cos(ae*Math.PI/2),oe=p*Math.sin(ae*Math.PI/2)+x;for(let le=0,Be=U.length;le<Be;le++){let Ne=F(U[le],k[le],oe);de(Ne.x,Ne.y,f+re)}for(let le=0,Be=L.length;le<Be;le++){let Ne=L[le];Z=W[le];for(let Le=0,Ye=Ne.length;Le<Ye;Le++){let B=F(Ne[Le],Z[Le],oe);_?de(B.x,B.y+T[h-1].y,T[h-1].x+re):de(B.x,B.y,f+re)}}}Pe(),q();function Pe(){let te=i.length/3;if(d){let ae=0,re=O*ae;for(let oe=0;oe<Ae;oe++){let le=pe[oe];De(le[2]+re,le[1]+re,le[0]+re)}ae=h+m*2,re=O*ae;for(let oe=0;oe<Ae;oe++){let le=pe[oe];De(le[0]+re,le[1]+re,le[2]+re)}}else{for(let ae=0;ae<Ae;ae++){let re=pe[ae];De(re[2],re[1],re[0])}for(let ae=0;ae<Ae;ae++){let re=pe[ae];De(re[0]+O*h,re[1]+O*h,re[2]+O*h)}}n.addGroup(te,i.length/3-te,0)}function q(){let te=i.length/3,ae=0;K(U,ae),ae+=U.length;for(let re=0,oe=L.length;re<oe;re++){let le=L[re];K(le,ae),ae+=le.length}n.addGroup(te,i.length/3-te,1)}function K(te,ae){let re=te.length;for(;--re>=0;){let oe=re,le=re-1;le<0&&(le=te.length-1);for(let Be=0,Ne=h+m*2;Be<Ne;Be++){let Le=O*Be,Ye=O*(Be+1),B=ae+oe+Le,$e=ae+le+Le,Ke=ae+le+Ye,I=ae+oe+Ye;_e(B,$e,Ke,I)}}}function de(te,ae,re){l.push(te),l.push(ae),l.push(re)}function De(te,ae,re){ke(te),ke(ae),ke(re);let oe=i.length/3,le=b.generateTopUV(n,i,oe-3,oe-2,oe-1);et(le[0]),et(le[1]),et(le[2])}function _e(te,ae,re,oe){ke(te),ke(ae),ke(oe),ke(ae),ke(re),ke(oe);let le=i.length/3,Be=b.generateSideWallUV(n,i,le-6,le-3,le-2,le-1);et(Be[0]),et(Be[1]),et(Be[3]),et(Be[1]),et(Be[2]),et(Be[3])}function ke(te){i.push(l[te*3+0]),i.push(l[te*3+1]),i.push(l[te*3+2])}function et(te){r.push(te.x),r.push(te.y)}}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON(),t=this.parameters.shapes,n=this.parameters.options;return H0(t,n,e)}static fromJSON(e,t){let n=[];for(let r=0,o=e.shapes.length;r<o;r++){let a=t[e.shapes[r]];n.push(a)}let i=e.options.extrudePath;return i!==void 0&&(e.options.extrudePath=new Ih[i.type]().fromJSON(i)),new s(n,e.options)}},z0={generateTopUV:function(s,e,t,n,i){let r=e[t*3],o=e[t*3+1],a=e[n*3],l=e[n*3+1],c=e[i*3],h=e[i*3+1];return[new ee(r,o),new ee(a,l),new ee(c,h)]},generateSideWallUV:function(s,e,t,n,i,r){let o=e[t*3],a=e[t*3+1],l=e[t*3+2],c=e[n*3],h=e[n*3+1],f=e[n*3+2],d=e[i*3],u=e[i*3+1],p=e[i*3+2],x=e[r*3],m=e[r*3+1],g=e[r*3+2];return Math.abs(a-h)<Math.abs(o-c)?[new ee(o,1-l),new ee(c,1-f),new ee(d,1-p),new ee(x,1-g)]:[new ee(a,1-l),new ee(h,1-f),new ee(u,1-p),new ee(m,1-g)]}};function H0(s,e,t){if(t.shapes=[],Array.isArray(s))for(let n=0,i=s.length;n<i;n++){let r=s[n];t.shapes.push(r.uuid)}else t.shapes.push(s.uuid);return t.options=Object.assign({},e),e.extrudePath!==void 0&&(t.options.extrudePath=e.extrudePath.toJSON()),t}var Vi=class s extends _t{constructor(e=1,t=1,n=1,i=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:i};let r=e/2,o=t/2,a=Math.floor(n),l=Math.floor(i),c=a+1,h=l+1,f=e/a,d=t/l,u=[],p=[],x=[],m=[];for(let g=0;g<h;g++){let b=g*d-o;for(let T=0;T<c;T++){let _=T*f-r;p.push(_,-b,0),x.push(0,0,1),m.push(T/a),m.push(1-g/l)}}for(let g=0;g<l;g++)for(let b=0;b<a;b++){let T=b+c*g,_=b+c*(g+1),M=b+1+c*(g+1),E=b+1+c*g;u.push(T,_,E),u.push(_,M,E)}this.setIndex(u),this.setAttribute("position",new at(p,3)),this.setAttribute("normal",new at(x,3)),this.setAttribute("uv",new at(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.width,e.height,e.widthSegments,e.heightSegments)}};var bi=class s extends _t{constructor(e=new ms([new ee(0,.5),new ee(-.5,-.5),new ee(.5,-.5)]),t=12){super(),this.type="ShapeGeometry",this.parameters={shapes:e,curveSegments:t};let n=[],i=[],r=[],o=[],a=0,l=0;if(Array.isArray(e)===!1)c(e);else for(let h=0;h<e.length;h++)c(e[h]),this.addGroup(a,l,h),a+=l,l=0;this.setIndex(n),this.setAttribute("position",new at(i,3)),this.setAttribute("normal",new at(r,3)),this.setAttribute("uv",new at(o,2));function c(h){let f=i.length/3,d=h.extractPoints(t),u=d.shape,p=d.holes;Zn.isClockWise(u)===!1&&(u=u.reverse());for(let m=0,g=p.length;m<g;m++){let b=p[m];Zn.isClockWise(b)===!0&&(p[m]=b.reverse())}let x=Zn.triangulateShape(u,p);for(let m=0,g=p.length;m<g;m++){let b=p[m];u=u.concat(b)}for(let m=0,g=u.length;m<g;m++){let b=u[m];i.push(b.x,b.y,0),r.push(0,0,1),o.push(b.x,b.y)}for(let m=0,g=x.length;m<g;m++){let b=x[m],T=b[0]+f,_=b[1]+f,M=b[2]+f;n.push(T,_,M),l+=3}}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}toJSON(){let e=super.toJSON(),t=this.parameters.shapes;return V0(t,e)}static fromJSON(e,t){let n=[];for(let i=0,r=e.shapes.length;i<r;i++){let o=t[e.shapes[i]];n.push(o)}return new s(n,e.curveSegments)}};function V0(s,e){if(e.shapes=[],Array.isArray(s))for(let t=0,n=s.length;t<n;t++){let i=s[t];e.shapes.push(i.uuid)}else e.shapes.push(s.uuid);return e}var Gi=class s extends _t{constructor(e=1,t=32,n=16,i=0,r=Math.PI*2,o=0,a=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:n,phiStart:i,phiLength:r,thetaStart:o,thetaLength:a},t=Math.max(3,Math.floor(t)),n=Math.max(2,Math.floor(n));let l=Math.min(o+a,Math.PI),c=0,h=[],f=new D,d=new D,u=[],p=[],x=[],m=[];for(let g=0;g<=n;g++){let b=[],T=g/n,_=o+T*a,M=e*Math.cos(_),E=Math.sqrt(e*e-M*M),A=0;g===0&&o===0?A=.5/t:g===n&&l===Math.PI&&(A=-.5/t);for(let v=0;v<=t;v++){let R=v/t,N=i+R*r;f.x=-E*Math.cos(N),f.y=M,f.z=E*Math.sin(N),p.push(f.x,f.y,f.z),d.copy(f).normalize(),x.push(d.x,d.y,d.z),m.push(R+A,1-T),b.push(c++)}h.push(b)}for(let g=0;g<n;g++)for(let b=0;b<t;b++){let T=h[g][b+1],_=h[g][b],M=h[g+1][b],E=h[g+1][b+1];(g!==0||o>0)&&u.push(T,_,E),(g!==n-1||l<Math.PI)&&u.push(_,M,E)}this.setIndex(u),this.setAttribute("position",new at(p,3)),this.setAttribute("normal",new at(x,3)),this.setAttribute("uv",new at(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new s(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}};function Ss(s){let e={};for(let t in s){e[t]={};for(let n in s[t]){let i=s[t][n];if(mf(i))i.isRenderTargetTexture?(Ge("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=i.clone();else if(Array.isArray(i))if(mf(i[0])){let r=[];for(let o=0,a=i.length;o<a;o++)r[o]=i[o].clone();e[t][n]=r}else e[t][n]=i.slice();else e[t][n]=i}}return e}function hn(s){let e={};for(let t=0;t<s.length;t++){let n=Ss(s[t]);for(let i in n)e[i]=n[i]}return e}function mf(s){return s&&(s.isColor||s.isMatrix3||s.isMatrix4||s.isVector2||s.isVector3||s.isVector4||s.isTexture||s.isQuaternion)}function G0(s){let e=[];for(let t=0;t<s.length;t++)e.push(s[t].clone());return e}function ou(s){let e=s.getRenderTarget();return e===null?s.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:tt.workingColorSpace}var zt={clone:Ss,merge:hn},W0=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,X0=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,ct=class extends $t{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=W0,this.fragmentShader=X0,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Ss(e.uniforms),this.uniformsGroups=G0(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let i in this.uniforms){let o=this.uniforms[i].value;o&&o.isTexture?t.uniforms[i]={type:"t",value:o.toJSON(e).uuid}:o&&o.isColor?t.uniforms[i]={type:"c",value:o.getHex()}:o&&o.isVector2?t.uniforms[i]={type:"v2",value:o.toArray()}:o&&o.isVector3?t.uniforms[i]={type:"v3",value:o.toArray()}:o&&o.isVector4?t.uniforms[i]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?t.uniforms[i]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?t.uniforms[i]={type:"m4",value:o.toArray()}:t.uniforms[i]={value:o}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let n={};for(let i in this.extensions)this.extensions[i]===!0&&(n[i]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(let n in e.uniforms){let i=e.uniforms[n];switch(this.uniforms[n]={},i.type){case"t":this.uniforms[n].value=t[i.value]||null;break;case"c":this.uniforms[n].value=new Ee().setHex(i.value);break;case"v2":this.uniforms[n].value=new ee().fromArray(i.value);break;case"v3":this.uniforms[n].value=new D().fromArray(i.value);break;case"v4":this.uniforms[n].value=new ut().fromArray(i.value);break;case"m3":this.uniforms[n].value=new Qe().fromArray(i.value);break;case"m4":this.uniforms[n].value=new je().fromArray(i.value);break;default:this.uniforms[n].value=i.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(let n in e.extensions)this.extensions[n]=e.extensions[n];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}},hr=class extends ct{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}},Rt=class extends $t{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Ee(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Ee(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=vr,this.normalScale=new ee(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Qn,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},ln=class extends Rt{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new ee(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return nt(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(t){this.ior=(1+.4*t)/(1-.4*t)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new Ee(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new Ee(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new Ee(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._retroreflectivity=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get retroreflectivity(){return this._retroreflectivity}set retroreflectivity(e){this._retroreflectivity>0!=e>0&&this.version++,this._retroreflectivity=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.retroreflectivity=e.retroreflectivity,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}};var xo=class extends $t{constructor(e){super(),this.isMeshNormalMaterial=!0,this.type="MeshNormalMaterial",this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=vr,this.normalScale=new ee(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.flatShading=!1,this.setValues(e)}copy(e){return super.copy(e),this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.flatShading=e.flatShading,this}},_o=class extends $t{constructor(e){super(),this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new Ee(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Ee(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=vr,this.normalScale=new ee(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Qn,this.combine=Sl,this.reflectivity=1,this.envMapIntensity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.envMapIntensity=e.envMapIntensity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},hl=class extends $t{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=qf,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},ul=class extends $t{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function ki(s,e){return!s||s.constructor===e?s:typeof e.BYTES_PER_ELEMENT=="number"?new e(s):Array.prototype.slice.call(s)}function Wa(s){return s!==void 0&&s.inTangents!==void 0&&s.outTangents!==void 0}function q0(s){function e(i,r){return s[i]-s[r]}let t=s.length,n=new Array(t);for(let i=0;i!==t;++i)n[i]=i;return n.sort(e),n}function gf(s,e,t){let n=s.length,i=new s.constructor(n);for(let r=0,o=0;o!==n;++r){let a=t[r]*e;for(let l=0;l!==e;++l)i[o++]=s[a+l]}return i}function Y0(s,e,t,n){let i=1,r=s[0];for(;r!==void 0&&r[n]===void 0;)r=s[i++];if(r===void 0)return;let o=r[n];if(o!==void 0)if(Array.isArray(o))do o=r[n],o!==void 0&&(e.push(r.time),t.push(...o)),r=s[i++];while(r!==void 0);else if(o.toArray!==void 0)do o=r[n],o!==void 0&&(e.push(r.time),o.toArray(t,t.length)),r=s[i++];while(r!==void 0);else do o=r[n],o!==void 0&&(e.push(r.time),t.push(o)),r=s[i++];while(r!==void 0)}var ni=class{constructor(e,t,n,i){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=i!==void 0?i:new t.constructor(n),this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,i=t[n],r=t[n-1];n:{e:{let o;t:{i:if(!(e<i)){for(let a=n+2;;){if(i===void 0){if(e<r)break i;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===a)break;if(r=i,i=t[++n],e<i)break e}o=t.length;break t}if(!(e>=r)){let a=t[1];e<a&&(n=2,r=a);for(let l=n-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===l)break;if(i=r,r=t[--n-1],e>=r)break e}o=n,n=0;break t}break n}for(;n<o;){let a=n+o>>>1;e<t[a]?o=a:n=a+1}if(i=t[n],r=t[n-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,r,i)}return this.interpolate_(n,r,e,i)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,i=this.valueSize,r=e*i;for(let o=0;o!==i;++o)t[o]=n[r+o];return t}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},dl=class extends ni{constructor(e,t,n,i){super(e,t,n,i),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Ch,endingEnd:Ch}}intervalChanged_(e,t,n){let i=this.parameterPositions,r=e-2,o=e+1,a=i[r],l=i[o];if(a===void 0)switch(this.getSettings_().endingStart){case Rh:r=e,a=2*t-n;break;case Ph:r=i.length-2,a=t+i[r]-i[r+1];break;default:r=e,a=n}if(l===void 0)switch(this.getSettings_().endingEnd){case Rh:o=e,l=2*n-t;break;case Ph:o=1,l=n+i[1]-i[0];break;default:o=e-1,l=t}let c=(n-t)*.5,h=this.valueSize;this._weightPrev=c/(t-a),this._weightNext=c/(l-n),this._offsetPrev=r*h,this._offsetNext=o*h}interpolate_(e,t,n,i){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,h=this._offsetPrev,f=this._offsetNext,d=this._weightPrev,u=this._weightNext,p=(n-t)/(i-t),x=p*p,m=x*p,g=-d*m+2*d*x-d*p,b=(1+d)*m+(-1.5-2*d)*x+(-.5+d)*p+1,T=(-1-u)*m+(1.5+u)*x+.5*p,_=u*m-u*x;for(let M=0;M!==a;++M)r[M]=g*o[h+M]+b*o[c+M]+T*o[l+M]+_*o[f+M];return r}},fl=class extends ni{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,h=(n-t)/(i-t),f=1-h;for(let d=0;d!==a;++d)r[d]=o[c+d]*f+o[l+d]*h;return r}},pl=class extends ni{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e){return this.copySampleValue_(e-1)}},ml=class extends ni{interpolate_(e,t,n,i){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=e*a,c=l-a,h=this.inTangents,f=this.outTangents;if(!h||!f){let p=(n-t)/(i-t),x=1-p;for(let m=0;m!==a;++m)r[m]=o[c+m]*x+o[l+m]*p;return r}let d=a*2,u=e-1;for(let p=0;p!==a;++p){let x=o[c+p],m=o[l+p],g=u*d+p*2,b=f[g],T=f[g+1],_=e*d+p*2,M=h[_],E=h[_+1],A=Z0(n,t,b,M,i);r[p]=up(A,x,T,E,m)}return r}};function up(s,e,t,n,i){let r=1-s;return r*r*r*e+3*r*r*s*t+3*r*s*s*n+s*s*s*i}function j0(s,e,t,n,i){let r=1-s;return 3*r*r*(t-e)+6*r*s*(n-t)+3*s*s*(i-n)}function Z0(s,e,t,n,i){let r=(s-e)/(i-e);for(let o=0;o<8;o++){let a=up(r,e,t,n,i)-s;if(Math.abs(a)<1e-10)break;let l=j0(r,e,t,n,i);if(Math.abs(l)<1e-10)break;r=Math.max(0,Math.min(1,r-a/l))}return r}var xn=class{constructor(e,t,n,i){if(e===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(t===void 0||t.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+e);this.name=e,this.times=ki(t,this.TimeBufferType),this.values=ki(n,this.ValueBufferType),this.setInterpolation(i||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:ki(e.times,Array),values:ki(e.values,Array)};let i=e.getInterpolation();i!==e.DefaultInterpolation&&(n.interpolation=i),Wa(e.settings)&&(n.settings={inTangents:ki(e.settings.inTangents,Array),outTangents:ki(e.settings.outTangents,Array)})}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new pl(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new fl(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new dl(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new ml(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.inTangents=this.settings.inTangents,t.outTangents=this.settings.outTangents),t}setInterpolation(e){let t;switch(e){case ls:t=this.InterpolantFactoryMethodDiscrete;break;case cs:t=this.InterpolantFactoryMethodLinear;break;case Va:t=this.InterpolantFactoryMethodSmooth;break;case Ah:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){let n="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(n);return Ge("KeyframeTrack:",n),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return ls;case this.InterpolantFactoryMethodLinear:return cs;case this.InterpolantFactoryMethodSmooth:return Va;case this.InterpolantFactoryMethodBezier:return Ah}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,i=t.length;n!==i;++n)t[n]*=e;Wa(this.settings)&&(xf(this.settings.inTangents,e),xf(this.settings.outTangents,e))}return this}trim(e,t){let n=this.times,i=n.length,r=0,o=i-1;for(;r!==i&&n[r]<e;)++r;for(;o!==-1&&n[o]>t;)--o;if(++o,r!==0||o!==i){r>=o&&(o=Math.max(o,1),r=o-1);let a=this.getValueSize();this.times=n.slice(r,o),this.values=this.values.slice(r*a,o*a)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(Ze("KeyframeTrack: Invalid value size in track.",this),e=!1);let n=this.times,i=this.values,r=n.length;r===0&&(Ze("KeyframeTrack: Track is empty.",this),e=!1);let o=null;for(let a=0;a!==r;a++){let l=n[a];if(typeof l=="number"&&isNaN(l)){Ze("KeyframeTrack: Time is not a valid number.",this,a,l),e=!1;break}if(o!==null&&o>l){Ze("KeyframeTrack: Out of order keys.",this,a,l,o),e=!1;break}o=l}if(i!==void 0&&Im(i))for(let a=0,l=i.length;a!==l;++a){let c=i[a];if(isNaN(c)){Ze("KeyframeTrack: Value is not a valid number.",this,a,c),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),i=this.getInterpolation()===Va,r=e.length-1,o=1;for(let a=1;a<r;++a){let l=!1,c=e[a],h=e[a+1];if(c!==h&&(a!==1||c!==e[0]))if(i)l=!0;else{let f=a*n,d=f-n,u=f+n;for(let p=0;p!==n;++p){let x=t[f+p];if(x!==t[d+p]||x!==t[u+p]){l=!0;break}}}if(l){if(a!==o){e[o]=e[a];let f=a*n,d=o*n;for(let u=0;u!==n;++u)t[d+u]=t[f+u]}++o}}if(r>0){e[o]=e[r];for(let a=r*n,l=o*n,c=0;c!==n;++c)t[l+c]=t[a+c];++o}return o!==e.length?(this.times=e.slice(0,o),this.values=t.slice(0,o*n)):(this.times=e,this.values=t),this}clone(){let e=this.times.slice(),t=this.values.slice(),n=this.constructor,i=new n(this.name,e,t);return i.createInterpolant=this.createInterpolant,Wa(this.settings)&&(i.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()}),i}};function xf(s,e){for(let t=0,n=s.length;t!==n;t+=2)s[t]*=e}xn.prototype.ValueTypeName="";xn.prototype.TimeBufferType=Float32Array;xn.prototype.ValueBufferType=Float32Array;xn.prototype.DefaultInterpolation=cs;var Si=class extends xn{constructor(e,t,n){super(e,t,n)}};Si.prototype.ValueTypeName="bool";Si.prototype.ValueBufferType=Array;Si.prototype.DefaultInterpolation=ls;Si.prototype.InterpolantFactoryMethodLinear=void 0;Si.prototype.InterpolantFactoryMethodSmooth=void 0;var vo=class extends xn{constructor(e,t,n,i){super(e,t,n,i)}};vo.prototype.ValueTypeName="color";var wi=class extends xn{constructor(e,t,n,i){super(e,t,n,i)}};wi.prototype.ValueTypeName="number";var gl=class extends ni{constructor(e,t,n,i){super(e,t,n,i)}interpolate_(e,t,n,i){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=(n-t)/(i-t),c=e*a;for(let h=c+a;c!==h;c+=4)on.slerpFlat(r,0,o,c-a,o,c,l);return r}},Ti=class extends xn{constructor(e,t,n,i){super(e,t,n,i)}InterpolantFactoryMethodLinear(e){return new gl(this.times,this.values,this.getValueSize(),e)}};Ti.prototype.ValueTypeName="quaternion";Ti.prototype.InterpolantFactoryMethodSmooth=void 0;var Ei=class extends xn{constructor(e,t,n){super(e,t,n)}};Ei.prototype.ValueTypeName="string";Ei.prototype.ValueBufferType=Array;Ei.prototype.DefaultInterpolation=ls;Ei.prototype.InterpolantFactoryMethodLinear=void 0;Ei.prototype.InterpolantFactoryMethodSmooth=void 0;var Wi=class extends xn{constructor(e,t,n,i){super(e,t,n,i)}};Wi.prototype.ValueTypeName="vector";var yo=class{constructor(e="",t=-1,n=[],i=Xf){this.name=e,this.tracks=n,this.duration=t,this.blendMode=i,this.uuid=Cn(),this.userData={},this.duration<0&&this.resetDuration()}static parse(e){let t=[],n=e.tracks,i=1/(e.fps||1);for(let o=0,a=n.length;o!==a;++o)t.push(J0(n[o]).scale(i));let r=new this(e.name,e.duration,t,e.blendMode);return r.uuid=e.uuid,r.userData=JSON.parse(e.userData||"{}"),r}static toJSON(e){let t=[],n=e.tracks,i={name:e.name,duration:e.duration,tracks:t,uuid:e.uuid,blendMode:e.blendMode,userData:JSON.stringify(e.userData)};for(let r=0,o=n.length;r!==o;++r)t.push(xn.toJSON(n[r]));return i}static CreateFromMorphTargetSequence(e,t,n,i){let r=t.length,o=[];for(let a=0;a<r;a++){let l=[],c=[];l.push((a+r-1)%r,a,(a+1)%r),c.push(0,1,0);let h=q0(l);l=gf(l,1,h),c=gf(c,1,h),!i&&l[0]===0&&(l.push(r),c.push(c[0])),o.push(new wi(".morphTargetInfluences["+t[a].name+"]",l,c).scale(1/n))}return new this(e,-1,o)}static findByName(e,t){let n=e;if(!Array.isArray(e)){let i=e;n=i.geometry&&i.geometry.animations||i.animations}for(let i=0;i<n.length;i++)if(n[i].name===t)return n[i];return null}static CreateClipsFromMorphTargetSequences(e,t,n){let i={},r=/^([\w-]*?)([\d]+)$/;for(let a=0,l=e.length;a<l;a++){let c=e[a],h=c.name.match(r);if(h&&h.length>1){let f=h[1],d=i[f];d||(i[f]=d=[]),d.push(c)}}let o=[];for(let a in i)o.push(this.CreateFromMorphTargetSequence(a,i[a],t,n));return o}resetDuration(){let e=this.tracks,t=0;for(let n=0,i=e.length;n!==i;++n){let r=this.tracks[n];t=Math.max(t,r.times[r.times.length-1])}return this.duration=t,this}trim(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].trim(0,this.duration);return this}validate(){let e=!0;for(let t=0;t<this.tracks.length;t++)e=e&&this.tracks[t].validate();return e}optimize(){for(let e=0;e<this.tracks.length;e++)this.tracks[e].optimize();return this}clone(){let e=[];for(let n=0;n<this.tracks.length;n++)e.push(this.tracks[n].clone());let t=new this.constructor(this.name,this.duration,e,this.blendMode);return t.userData=JSON.parse(JSON.stringify(this.userData)),t}toJSON(){return this.constructor.toJSON(this)}};function K0(s){switch(s.toLowerCase()){case"scalar":case"double":case"float":case"number":case"integer":return wi;case"vector":case"vector2":case"vector3":case"vector4":return Wi;case"color":return vo;case"quaternion":return Ti;case"bool":case"boolean":return Si;case"string":return Ei}throw new Error("THREE.KeyframeTrack: Unsupported typeName: "+s)}function J0(s){if(s.type===void 0)throw new Error("THREE.KeyframeTrack: track type undefined, can not parse");let e=K0(s.type);if(s.times===void 0){let n=[],i=[];Y0(s.keys,n,i,"value"),s.times=n,s.values=i}let t;return e.parse!==void 0?t=e.parse(s):t=new e(s.name,s.times,s.values,s.interpolation),Wa(s.settings)&&(t.settings={inTangents:ki(s.settings.inTangents,Float32Array),outTangents:ki(s.settings.outTangents,Float32Array)}),t}var Kn={enabled:!1,files:{},add:function(s,e){this.enabled!==!1&&(_f(s)||(this.files[s]=e))},get:function(s){if(this.enabled!==!1&&!_f(s))return this.files[s]},remove:function(s){delete this.files[s]},clear:function(){this.files={}}};function _f(s){try{let e=s.slice(s.indexOf(":")+1);return new URL(e).protocol==="blob:"}catch{return!1}}var xl=class{constructor(e,t,n){let i=this,r=!1,o=0,a=0,l,c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this._abortController=null,this.itemStart=function(h){a++,r===!1&&i.onStart!==void 0&&i.onStart(h,o,a),r=!0},this.itemEnd=function(h){o++,i.onProgress!==void 0&&i.onProgress(h,o,a),o===a&&(r=!1,i.onLoad!==void 0&&i.onLoad())},this.itemError=function(h){i.onError!==void 0&&i.onError(h)},this.resolveURL=function(h){return h=h.normalize("NFC"),l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,f){return c.push(h,f),this},this.removeHandler=function(h){let f=c.indexOf(h);return f!==-1&&c.splice(f,2),this},this.getHandler=function(h){for(let f=0,d=c.length;f<d;f+=2){let u=c[f],p=c[f+1];if(u.global&&(u.lastIndex=0),u.test(h))return p}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},dp=new xl,ii=class{constructor(e){this.manager=e!==void 0?e:dp,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(e,t){let n=this;return new Promise(function(i,r){n.load(e,i,t,r)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}};ii.DEFAULT_MATERIAL_NAME="__DEFAULT";var _i={},Oh=class extends Error{constructor(e,t){super(e),this.response=t}},ur=class extends ii{constructor(e){super(e),this.mimeType="",this.responseType="",this._abortController=new AbortController}load(e,t,n,i){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let r=Kn.get(`file:${e}`);if(r!==void 0){this.manager.itemStart(e),setTimeout(()=>{t&&t(r),this.manager.itemEnd(e)},0);return}if(_i[e]!==void 0){_i[e].push({onLoad:t,onProgress:n,onError:i});return}_i[e]=[],_i[e].push({onLoad:t,onProgress:n,onError:i});let o=new Request(e,{headers:new Headers(this.requestHeader),credentials:this.withCredentials?"include":"same-origin",signal:typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal}),a=this.mimeType,l=this.responseType;fetch(o).then(c=>{if(c.status===200||c.status===0){if(c.status===0&&Ge("FileLoader: HTTP Status 0 received."),typeof ReadableStream>"u"||c.body===void 0||c.body.getReader===void 0)return c;let h=_i[e],f=c.body.getReader(),d=c.headers.get("X-File-Size")||c.headers.get("Content-Length"),u=d?parseInt(d):0,p=u!==0,x=0,m=new ReadableStream({start(g){b();function b(){f.read().then(({done:T,value:_})=>{if(T)g.close();else{x+=_.byteLength;let M=new ProgressEvent("progress",{lengthComputable:p,loaded:x,total:u});for(let E=0,A=h.length;E<A;E++){let v=h[E];v.onProgress&&v.onProgress(M)}g.enqueue(_),b()}},T=>{g.error(T)})}}});return new Response(m)}else throw new Oh(`fetch for "${c.url}" responded with ${c.status}: ${c.statusText}`,c)}).then(c=>{switch(l){case"arraybuffer":return c.arrayBuffer();case"blob":return c.blob();case"document":return c.text().then(h=>new DOMParser().parseFromString(h,a));case"json":return c.json();default:if(a==="")return c.text();{let f=/charset="?([^;"\s]*)"?/i.exec(a),d=f&&f[1]?f[1].toLowerCase():void 0,u=new TextDecoder(d);return c.arrayBuffer().then(p=>u.decode(p))}}}).then(c=>{Kn.add(`file:${e}`,c);let h=_i[e];delete _i[e];for(let f=0,d=h.length;f<d;f++){let u=h[f];u.onLoad&&u.onLoad(c)}}).catch(c=>{let h=_i[e];if(h===void 0)throw this.manager.itemError(e),c;delete _i[e];for(let f=0,d=h.length;f<d;f++){let u=h[f];u.onError&&u.onError(c)}this.manager.itemError(e)}).finally(()=>{this.manager.itemEnd(e)}),this.manager.itemStart(e)}setResponseType(e){return this.responseType=e,this}setMimeType(e){return this.mimeType=e,this}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}};var Xs=new WeakMap,_l=class extends ii{constructor(e){super(e)}load(e,t,n,i){this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let r=this,o=Kn.get(`image:${e}`);if(o!==void 0){if(o.complete===!0)r.manager.itemStart(e),setTimeout(function(){t&&t(o),r.manager.itemEnd(e)},0);else{let f=Xs.get(o);f===void 0&&(f=[],Xs.set(o,f)),f.push({onLoad:t,onError:i})}return o}let a=Qs("img");function l(){h(),t&&t(this);let f=Xs.get(this)||[];for(let d=0;d<f.length;d++){let u=f[d];u.onLoad&&u.onLoad(this)}Xs.delete(this),r.manager.itemEnd(e)}function c(f){h(),i&&i(f),Kn.remove(`image:${e}`);let d=Xs.get(this)||[];for(let u=0;u<d.length;u++){let p=d[u];p.onError&&p.onError(f)}Xs.delete(this),r.manager.itemError(e),r.manager.itemEnd(e)}function h(){a.removeEventListener("load",l,!1),a.removeEventListener("error",c,!1)}return a.addEventListener("load",l,!1),a.addEventListener("error",c,!1),e.slice(0,5)!=="data:"&&this.crossOrigin!==void 0&&(a.crossOrigin=this.crossOrigin),Kn.add(`image:${e}`,a),r.manager.itemStart(e),a.src=e,a}};var xs=class extends ii{constructor(e){super(e)}load(e,t,n,i){let r=new Ut,o=new _l(this.manager);return o.setCrossOrigin(this.crossOrigin),o.setPath(this.path),o.load(e,function(a){r.image=a,r.needsUpdate=!0,t!==void 0&&t(r)},n,i),r}},Xi=class extends Ct{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new Ee(e),this.intensity=t}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}},Mo=class extends Xi{constructor(e,t,n){super(e,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Ct.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Ee(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}toJSON(e){let t=super.toJSON(e);return t.object.groundColor=this.groundColor.getHex(),t}},wh=new je,vf=new D,yf=new D,dr=class{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new ee(512,512),this.mapType=cn,this.map=null,this.mapPass=null,this.matrix=new je,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new or,this._frameExtents=new ee(1,1),this._viewportCount=1,this._viewports=[new ut(0,0,1,1)]}getViewportCount(){return this._viewportCount}getCamera(){return this.camera}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera;vf.setFromMatrixPosition(e.matrixWorld),t.position.copy(vf),yf.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(yf),t.updateMatrixWorld(),this._updateMatrix(t,this.matrix,this._frustum)}_updateMatrix(e,t,n,i){wh.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),n.setFromProjectionMatrix(wh,e.coordinateSystem,e.reversedDepth);let r=this._frameExtents,o=i?i.z/r.x:1,a=i?i.w/r.y:1,l=i?i.x/r.x:0,c=i?i.y/r.y:0;e.coordinateSystem===Js||e.reversedDepth?t.set(.5*o,0,0,.5*o+l,0,.5*a,0,.5*a+c,0,0,1,0,0,0,0,1):t.set(.5*o,0,0,.5*o+l,0,.5*a,0,.5*a+c,0,0,.5,.5,0,0,0,1),t.multiply(wh)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return e.intensity=this.intensity,e.bias=this.bias,e.normalBias=this.normalBias,e.radius=this.radius,e.blurSamples=this.blurSamples,e.mapSize=this.mapSize.toArray(),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},za=new D,Ha=new on,jn=new D,bo=class extends Ct{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new je,this.projectionMatrix=new je,this.projectionMatrixInverse=new je,this.coordinateSystem=zn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(za,Ha,jn),jn.x===1&&jn.y===1&&jn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(za,Ha,jn.set(1,1,1)).invert()}updateWorldMatrix(e,t,n=!1){super.updateWorldMatrix(e,t,n),this.matrixWorld.decompose(za,Ha,jn),jn.x===1&&jn.y===1&&jn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(za,Ha,jn.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},Bi=new D,Mf=new ee,bf=new ee,Nt=class extends bo{constructor(e=50,t=1,n=.1,i=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=i,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=hs*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(Wr*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return hs*2*Math.atan(Math.tan(Wr*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){Bi.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Bi.x,Bi.y).multiplyScalar(-e/Bi.z),Bi.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(Bi.x,Bi.y).multiplyScalar(-e/Bi.z)}getViewSize(e,t){return this.getViewBounds(e,Mf,bf),t.subVectors(bf,Mf)}setViewOffset(e,t,n,i,r,o){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(Wr*.5*this.fov)/this.zoom,n=2*t,i=this.aspect*n,r=-.5*i,o=this.view;if(this.view!==null&&this.view.enabled){let l=o.fullWidth,c=o.fullHeight;r+=o.offsetX*i/l,t-=o.offsetY*n/c,i*=o.width/l,n*=o.height/c}let a=this.filmOffset;a!==0&&(r+=e*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+i,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}},Fh=class extends dr{constructor(){super(new Nt(50,1,.5,500)),this.isSpotLightShadow=!0,this.focus=1,this.aspect=1}updateMatrices(e){let t=this.camera,n=hs*2*e.angle*this.focus,i=this.mapSize.width/this.mapSize.height*this.aspect,r=e.distance||t.far;(n!==t.fov||i!==t.aspect||r!==t.far)&&(t.fov=n,t.aspect=i,t.far=r,t.updateProjectionMatrix()),super.updateMatrices(e)}copy(e){return super.copy(e),this.focus=e.focus,this.aspect=e.aspect,this}toJSON(){let e=super.toJSON();return e.focus=this.focus,e.aspect=this.aspect,e}},So=class extends Xi{constructor(e,t,n=0,i=Math.PI/3,r=0,o=2){super(e,t),this.isSpotLight=!0,this.type="SpotLight",this.position.copy(Ct.DEFAULT_UP),this.updateMatrix(),this.target=new Ct,this.distance=n,this.angle=i,this.penumbra=r,this.decay=o,this.map=null,this.shadow=new Fh}get power(){return this.intensity*Math.PI}set power(e){this.intensity=e/Math.PI}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.angle=e.angle,this.penumbra=e.penumbra,this.decay=e.decay,this.target=e.target.clone(),this.map=e.map,this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.distance=this.distance,t.object.angle=this.angle,t.object.decay=this.decay,t.object.penumbra=this.penumbra,t.object.target=this.target.uuid,this.map&&this.map.isTexture&&(t.object.map=this.map.toJSON(e).uuid),t.object.shadow=this.shadow.toJSON(),t}},Bh=class extends dr{constructor(){super(new Nt(90,1,.5,500)),this.isPointLightShadow=!0}},_s=class extends Xi{constructor(e,t,n=0,i=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=i,this.shadow=new Bh}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.distance=this.distance,t.object.decay=this.decay,t.object.shadow=this.shadow.toJSON(),t}},Sn=class extends bo{constructor(e=-1,t=1,n=1,i=-1,r=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=i,this.near=r,this.far=o,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,i,r,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=i,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,i=(this.top+this.bottom)/2,r=n-e,o=n+e,a=i+t,l=i-t;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,o=r+c*this.view.width,a-=h*this.view.offsetY,l=a-h*this.view.height}this.projectionMatrix.makeOrthographic(r,o,a,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},kh=class extends dr{constructor(){super(new Sn(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},qi=class extends Xi{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Ct.DEFAULT_UP),this.updateMatrix(),this.target=new Ct,this.shadow=new kh}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}},wo=class extends Xi{constructor(e,t){super(e,t),this.isAmbientLight=!0,this.type="AmbientLight"}};var Ai=class{static extractUrlBase(e){let t=e.lastIndexOf("/");return t===-1?"./":e.slice(0,t+1)}static resolveURL(e,t){return typeof e!="string"||e===""?"":(/^https?:\/\//i.test(t)&&/^\//.test(e)&&(t=t.replace(/(^https?:\/\/[^\/]+).*/i,"$1")),/^(https?:)?\/\//i.test(e)||/^data:.*,.*$/i.test(e)||/^blob:.*$/i.test(e)?e:t+e)}};var Th=new WeakMap,To=class extends ii{constructor(e){super(e),this.isImageBitmapLoader=!0,typeof createImageBitmap>"u"&&Ge("ImageBitmapLoader: createImageBitmap() not supported."),typeof fetch>"u"&&Ge("ImageBitmapLoader: fetch() not supported."),this.options={premultiplyAlpha:"none"},this._abortController=new AbortController}setOptions(e){return this.options=e,this}load(e,t,n,i){e===void 0&&(e=""),this.path!==void 0&&(e=this.path+e),e=this.manager.resolveURL(e);let r=this,o=Kn.get(`image-bitmap:${e}`);if(o!==void 0){if(r.manager.itemStart(e),o.then){o.then(c=>{Th.has(o)===!0?(i&&i(Th.get(o)),r.manager.itemError(e),r.manager.itemEnd(e)):(t&&t(c),r.manager.itemEnd(e))});return}setTimeout(function(){t&&t(o),r.manager.itemEnd(e)},0);return}let a={};a.credentials=this.crossOrigin==="anonymous"?"same-origin":"include",a.headers=this.requestHeader,a.signal=typeof AbortSignal.any=="function"?AbortSignal.any([this._abortController.signal,this.manager.abortController.signal]):this._abortController.signal;let l=fetch(e,a).then(function(c){return c.blob()}).then(function(c){return createImageBitmap(c,Object.assign({},r.options,{colorSpaceConversion:"none"}))}).then(function(c){return Kn.add(`image-bitmap:${e}`,c),t&&t(c),r.manager.itemEnd(e),c}).catch(function(c){i&&i(c),Th.set(l,c),Kn.remove(`image-bitmap:${e}`),r.manager.itemError(e),r.manager.itemEnd(e)});Kn.add(`image-bitmap:${e}`,l),r.manager.itemStart(e)}abort(){return this._abortController.abort(),this._abortController=new AbortController,this}};var qs=-90,Ys=1,vl=class extends Ct{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let i=new Nt(qs,Ys,e,t);i.layers=this.layers,this.add(i);let r=new Nt(qs,Ys,e,t);r.layers=this.layers,this.add(r);let o=new Nt(qs,Ys,e,t);o.layers=this.layers,this.add(o);let a=new Nt(qs,Ys,e,t);a.layers=this.layers,this.add(a);let l=new Nt(qs,Ys,e,t);l.layers=this.layers,this.add(l);let c=new Nt(qs,Ys,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[n,i,r,o,a,l]=t;for(let c of t)this.remove(c);if(e===zn)n.up.set(0,1,0),n.lookAt(1,0,0),i.up.set(0,1,0),i.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===Js)n.up.set(0,-1,0),n.lookAt(-1,0,0),i.up.set(0,-1,0),i.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(let c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:i}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[r,o,a,l,c,h]=this.children,f=e.getRenderTarget(),d=e.getActiveCubeFace(),u=e.getActiveMipmapLevel(),p=e.xr.enabled;e.xr.enabled=!1;let x=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let m=!1;e.isWebGLRenderer===!0?m=e.state.buffers.depth.getReversed():m=e.reversedDepthBuffer,e.setRenderTarget(n,0,i),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,r),e.setRenderTarget(n,1,i),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(n,2,i),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(n,3,i),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(n,4,i),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),n.texture.generateMipmaps=x,e.setRenderTarget(n,5,i),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,h),e.setRenderTarget(f,d,u),e.xr.enabled=p,n.texture.needsPMREMUpdate=!0}},yl=class extends Nt{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}},Eo=class{constructor(){this._previousTime=0,this._currentTime=0,this._startTime=performance.now(),this._delta=0,this._elapsed=0,this._timescale=1,this._document=null,this._pageVisibilityHandler=null}connect(e){this._document=e,e.hidden!==void 0&&(this._pageVisibilityHandler=Q0.bind(this),e.addEventListener("visibilitychange",this._pageVisibilityHandler,!1))}disconnect(){this._pageVisibilityHandler!==null&&(this._document.removeEventListener("visibilitychange",this._pageVisibilityHandler),this._pageVisibilityHandler=null),this._document=null}getDelta(){return this._delta/1e3}getElapsed(){return this._elapsed/1e3}getTimescale(){return this._timescale}setTimescale(e){return this._timescale=e,this}reset(){return this._currentTime=performance.now()-this._startTime,this}dispose(){this.disconnect()}update(e){return this._pageVisibilityHandler!==null&&this._document.hidden===!0?this._delta=0:(this._previousTime=this._currentTime,this._currentTime=(e!==void 0?e:performance.now())-this._startTime,this._delta=(this._currentTime-this._previousTime)*this._timescale,this._elapsed+=this._delta),this}};function Q0(){this._document.hidden===!1&&this.reset()}var au="\\[\\]\\.:\\/",$0=new RegExp("["+au+"]","g"),lu="[^"+au+"]",eg="[^"+au.replace("\\.","")+"]",tg=/((?:WC+[\/:])*)/.source.replace("WC",lu),ng=/(WCOD+)?/.source.replace("WCOD",eg),ig=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",lu),sg=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",lu),rg=new RegExp("^"+tg+ng+ig+sg+"$"),og=["material","materials","bones","map"],zh=class{constructor(e,t,n){let i=n||yt.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,i)}getValue(e,t){this.bind();let n=this._targetGroup.nCachedObjects_,i=this._bindings[n];i!==void 0&&i.getValue(e,t)}setValue(e,t){let n=this._bindings;for(let i=this._targetGroup.nCachedObjects_,r=n.length;i!==r;++i)n[i].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}},yt=class s{constructor(e,t,n){this.path=t,this.parsedPath=n||s.parseTrackName(t),this.node=s.findNode(e,this.parsedPath.nodeName),this.rootNode=e,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(e,t,n){return e&&e.isAnimationObjectGroup?new s.Composite(e,t,n):new s(e,t,n)}static sanitizeNodeName(e){return e.replace(/\s/g,"_").replace($0,"")}static parseTrackName(e){let t=rg.exec(e);if(t===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},i=n.nodeName&&n.nodeName.lastIndexOf(".");if(i!==void 0&&i!==-1){let r=n.nodeName.substring(i+1);og.indexOf(r)!==-1&&(n.nodeName=n.nodeName.substring(0,i),n.objectName=r)}if(n.propertyName===null||n.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+e);return n}static findNode(e,t){if(t===void 0||t===""||t==="."||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(r){for(let o=0;o<r.length;o++){let a=r[o];if(a.name===t||a.uuid===t)return a;let l=n(a.children);if(l)return l}return null},i=n(e.children);if(i)return i}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)e[t++]=n[i]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let i=0,r=n.length;i!==r;++i)n[i]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let e=this.node,t=this.parsedPath,n=t.objectName,i=t.propertyName,r=t.propertyIndex;if(e||(e=s.findNode(this.rootNode,t.nodeName),this.node=e),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!e){Ge("PropertyBinding: No target node found for track: "+this.path+".");return}if(n){let c=t.objectIndex;switch(n){case"materials":if(!e.material){Ze("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.materials){Ze("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}e=e.material.materials;break;case"bones":if(!e.skeleton){Ze("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}e=e.skeleton.bones;for(let h=0;h<e.length;h++)if(e[h].name===c){c=h;break}break;case"map":if("map"in e){e=e.map;break}if(!e.material){Ze("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!e.material.map){Ze("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}e=e.material.map;break;default:if(e[n]===void 0){Ze("PropertyBinding: Can not bind to objectName of node undefined.",this);return}e=e[n]}if(c!==void 0){if(e[c]===void 0){Ze("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,e);return}e=e[c]}}let o=e[i];if(o===void 0){let c=t.nodeName;Ze("PropertyBinding: Trying to update property for track: "+c+"."+i+" but it wasn't found.",e);return}let a=this.Versioning.None;this.targetObject=e,e.isMaterial===!0?a=this.Versioning.NeedsUpdate:e.isObject3D===!0&&(a=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(r!==void 0){if(i==="morphTargetInfluences"){if(!e.geometry){Ze("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!e.geometry.morphAttributes){Ze("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}e.morphTargetDictionary[r]!==void 0&&(r=e.morphTargetDictionary[r])}l=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=r}else o.fromArray!==void 0&&o.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(l=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=i;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][a]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};yt.Composite=zh;yt.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};yt.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};yt.prototype.GetterByBindingType=[yt.prototype._getValue_direct,yt.prototype._getValue_array,yt.prototype._getValue_arrayElement,yt.prototype._getValue_toArray];yt.prototype.SetterByBindingTypeAndVersioning=[[yt.prototype._setValue_direct,yt.prototype._setValue_direct_setNeedsUpdate,yt.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[yt.prototype._setValue_array,yt.prototype._setValue_array_setNeedsUpdate,yt.prototype._setValue_array_setMatrixWorldNeedsUpdate],[yt.prototype._setValue_arrayElement,yt.prototype._setValue_arrayElement_setNeedsUpdate,yt.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[yt.prototype._setValue_fromArray,yt.prototype._setValue_fromArray_setNeedsUpdate,yt.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var KM=new Float32Array(1);var Sf=new je,Ao=class{constructor(e,t,n=0,i=1/0){this.ray=new $n(e,t),this.near=n,this.far=i,this.camera=null,this.layers=new tr,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,t.projectionMatrix.elements[14]).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):Ze("Raycaster: Unsupported camera type: "+t.type)}setFromXRController(e){return Sf.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(Sf),this}intersectObject(e,t=!0,n=[]){return Hh(e,this,n,t),n.sort(wf),n}intersectObjects(e,t=!0,n=[]){for(let i=0,r=e.length;i<r;i++)Hh(e[i],this,n,t);return n.sort(wf),n}};function wf(s,e){return s.distance-e.distance}function Hh(s,e,t,n){let i=!0;if(s.layers.test(e.layers)&&s.raycast(e,t)===!1&&(i=!1),i===!0&&n===!0){let r=s.children;for(let o=0,a=r.length;o<a;o++)Hh(r[o],e,t,!0)}}var fr=class{constructor(e=1,t=0,n=0){this.radius=e,this.phi=t,this.theta=n}set(e,t,n){return this.radius=e,this.phi=t,this.theta=n,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){return this.phi=nt(this.phi,1e-6,Math.PI-1e-6),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,n){return this.radius=Math.sqrt(e*e+t*t+n*n),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,n),this.phi=Math.acos(nt(t/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}};var pu=class pu{constructor(e,t,n,i){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,n,i)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,i){let r=this.elements;return r[0]=e,r[2]=t,r[1]=n,r[3]=i,this}};pu.prototype.isMatrix2=!0;var Vh=pu;var Co=class extends Hn{constructor(e,t=null){super(),this.object=e,this.domElement=t,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(e){this.domElement!==null&&this.disconnect(),this.domElement=e}disconnect(){}dispose(){}update(){}};function cu(s,e,t,n){let i=ag(n);switch(t){case $h:return s*e;case Pl:return s*e/i.components*i.byteLength;case Ll:return s*e/i.components*i.byteLength;case $i:return s*e*2/i.components*i.byteLength;case Il:return s*e*2/i.components*i.byteLength;case eu:return s*e*3/i.components*i.byteLength;case pn:return s*e*4/i.components*i.byteLength;case Dl:return s*e*4/i.components*i.byteLength;case Bo:case ko:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*8;case zo:case Ho:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*16;case Ul:case Fl:return Math.max(s,16)*Math.max(e,8)/4;case Nl:case Ol:return Math.max(s,8)*Math.max(e,8)/2;case Bl:case kl:case Hl:case Vl:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*8;case zl:case Vo:case Gl:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*16;case Wl:return Math.floor((s+3)/4)*Math.floor((e+3)/4)*16;case Xl:return Math.floor((s+4)/5)*Math.floor((e+3)/4)*16;case ql:return Math.floor((s+4)/5)*Math.floor((e+4)/5)*16;case Yl:return Math.floor((s+5)/6)*Math.floor((e+4)/5)*16;case jl:return Math.floor((s+5)/6)*Math.floor((e+5)/6)*16;case Zl:return Math.floor((s+7)/8)*Math.floor((e+4)/5)*16;case Kl:return Math.floor((s+7)/8)*Math.floor((e+5)/6)*16;case Jl:return Math.floor((s+7)/8)*Math.floor((e+7)/8)*16;case Ql:return Math.floor((s+9)/10)*Math.floor((e+4)/5)*16;case $l:return Math.floor((s+9)/10)*Math.floor((e+5)/6)*16;case ec:return Math.floor((s+9)/10)*Math.floor((e+7)/8)*16;case tc:return Math.floor((s+9)/10)*Math.floor((e+9)/10)*16;case nc:return Math.floor((s+11)/12)*Math.floor((e+9)/10)*16;case ic:return Math.floor((s+11)/12)*Math.floor((e+11)/12)*16;case sc:case rc:case oc:return Math.ceil(s/4)*Math.ceil(e/4)*16;case ac:case lc:return Math.ceil(s/4)*Math.ceil(e/4)*8;case Go:case cc:return Math.ceil(s/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function ag(s){switch(s){case cn:case Zh:return{byteLength:1,components:1};case xr:case Kh:case St:return{byteLength:2,components:1};case Cl:case Rl:return{byteLength:2,components:4};case Wn:case Al:case Tn:return{byteLength:4,components:1};case Jh:case Qh:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${s}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"186"}}));typeof window<"u"&&(window.__THREE__?Ge("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="186");function Np(){let s=null,e=!1,t=null,n=null;function i(r,o){n=s.requestAnimationFrame(i),t(r,o)}return{start:function(){e!==!0&&t!==null&&s!==null&&(n=s.requestAnimationFrame(i),e=!0)},stop:function(){s!==null&&s.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(r){t=r},setContext:function(r){s=r}}}function cg(s){let e=new WeakMap;function t(a,l){let c=a.array,h=a.usage,f=c.byteLength,d=s.createBuffer();s.bindBuffer(l,d),s.bufferData(l,c,h),a.onUploadCallback();let u;if(c instanceof Float32Array)u=s.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)u=s.HALF_FLOAT;else if(c instanceof Uint16Array)a.isFloat16BufferAttribute?u=s.HALF_FLOAT:u=s.UNSIGNED_SHORT;else if(c instanceof Int16Array)u=s.SHORT;else if(c instanceof Uint32Array)u=s.UNSIGNED_INT;else if(c instanceof Int32Array)u=s.INT;else if(c instanceof Int8Array)u=s.BYTE;else if(c instanceof Uint8Array)u=s.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)u=s.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:d,type:u,bytesPerElement:c.BYTES_PER_ELEMENT,version:a.version,size:f}}function n(a,l,c){let h=l.array,f=l.updateRanges;if(s.bindBuffer(c,a),f.length===0)s.bufferSubData(c,0,h);else{f.sort((u,p)=>u.start-p.start);let d=0;for(let u=1;u<f.length;u++){let p=f[d],x=f[u];x.start<=p.start+p.count+1?p.count=Math.max(p.count,x.start+x.count-p.start):(++d,f[d]=x)}f.length=d+1;for(let u=0,p=f.length;u<p;u++){let x=f[u];s.bufferSubData(c,x.start*h.BYTES_PER_ELEMENT,h,x.start,x.count)}l.clearUpdateRanges()}l.onUploadCallback()}function i(a){return a.isInterleavedBufferAttribute&&(a=a.data),e.get(a)}function r(a){a.isInterleavedBufferAttribute&&(a=a.data);let l=e.get(a);l&&(s.deleteBuffer(l.buffer),e.delete(a))}function o(a,l){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){let h=e.get(a);(!h||h.version<a.version)&&e.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}let c=e.get(a);if(c===void 0)e.set(a,t(a,l));else if(c.version<a.version){if(c.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,a,l),c.version=a.version}}return{get:i,remove:r,update:o}}var hg=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,ug=`#ifdef USE_ALPHAHASH
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
#endif`,dg=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,fg=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,pg=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,mg=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,gg=`#ifdef USE_AOMAP
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
#endif`,xg=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,_g=`#ifdef USE_BATCHING
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
#endif`,vg=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,yg=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Mg=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,bg=`float G_BlinnPhong_Implicit( ) {
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
} // validated`,Sg=`#ifdef USE_IRIDESCENCE
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
#endif`,wg=`#ifdef USE_BUMPMAP
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
#endif`,Tg=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,Eg=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Ag=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Cg=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Rg=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Pg=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Lg=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Ig=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
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
#endif`,Dg=`#define PI 3.141592653589793
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
} // validated`,Ng=`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,Ug=`vec3 transformedNormal = objectNormal;
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
#endif`,Og=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Fg=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Bg=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,kg=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,zg="gl_FragColor = linearToOutputTexel( gl_FragColor );",Hg=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Vg=`#ifdef USE_ENVMAP
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
#endif`,Gg=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,Wg=`#ifdef USE_ENVMAP
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
#endif`,Xg=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,qg=`#ifdef USE_ENVMAP
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
#endif`,Yg=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,jg=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Zg=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Kg=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Jg=`#ifdef USE_GRADIENTMAP
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
}`,Qg=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,$g=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,ex=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,tx=`uniform bool receiveShadow;
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
#include <lightprobes_pars_fragment>`,nx=`#ifdef USE_ENVMAP
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
#endif`,ix=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,sx=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,rx=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,ox=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,ax=`PhysicalMaterial material;
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
#endif`,lx=`uniform sampler2D dfgLUT;
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
}`,cx=`
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
#endif`,hx=`#if defined( RE_IndirectDiffuse )
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
#endif`,ux=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,dx=`#ifdef USE_LIGHT_PROBES_GRID
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
#endif`,fx=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,px=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,mx=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,gx=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,xx=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,_x=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,vx=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,yx=`#if defined( USE_POINTS_UV )
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
#endif`,Mx=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,bx=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Sx=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,wx=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Tx=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Ex=`#ifdef USE_MORPHTARGETS
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
#endif`,Ax=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Cx=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
vec3 nonPerturbedNormal = normal;`,Rx=`#ifdef USE_NORMALMAP_OBJECTSPACE
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
#endif`,Px=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Lx=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Ix=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,Dx=`#ifdef USE_NORMALMAP
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
#endif`,Nx=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Ux=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Ox=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Fx=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Bx=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,kx=`vec3 packNormalToRGB( const in vec3 normal ) {
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
}`,zx=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,Hx=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Vx=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Gx=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Wx=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Xx=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,qx=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,Yx=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,jx=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
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
#endif`,Zx=`float getShadowMask() {
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
}`,Kx=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Jx=`#ifdef USE_SKINNING
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
#endif`,Qx=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,$x=`#ifdef USE_SKINNING
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
#endif`,e_=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,t_=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,n_=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,i_=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,s_=`#ifdef USE_TRANSMISSION
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
#endif`,r_=`#ifdef USE_TRANSMISSION
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
#endif`,o_=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,a_=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,l_=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,c_=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,h_=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,u_=`uniform sampler2D t2D;
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
}`,d_=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,f_=`#ifdef ENVMAP_TYPE_CUBE
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
}`,p_=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,m_=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,g_=`#include <common>
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
}`,x_=`#if DEPTH_PACKING == 3200
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
}`,__=`#define DISTANCE
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
}`,v_=`#define DISTANCE
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
}`,y_=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,M_=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,b_=`uniform float scale;
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
}`,S_=`uniform vec3 diffuse;
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
}`,w_=`#include <common>
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
}`,T_=`uniform vec3 diffuse;
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
}`,E_=`#define LAMBERT
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
}`,A_=`#define LAMBERT
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
}`,C_=`#define MATCAP
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
}`,R_=`#define MATCAP
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
}`,P_=`#define NORMAL
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
}`,L_=`#define NORMAL
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
}`,I_=`#define PHONG
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
}`,D_=`#define PHONG
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
}`,N_=`#define STANDARD
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
}`,U_=`#define STANDARD
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
}`,O_=`#define TOON
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
}`,F_=`#define TOON
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
}`,B_=`uniform float size;
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
}`,k_=`uniform vec3 diffuse;
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
}`,z_=`#include <common>
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
}`,H_=`uniform vec3 color;
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
}`,V_=`uniform float rotation;
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
}`,G_=`uniform vec3 diffuse;
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
}`,st={alphahash_fragment:hg,alphahash_pars_fragment:ug,alphamap_fragment:dg,alphamap_pars_fragment:fg,alphatest_fragment:pg,alphatest_pars_fragment:mg,aomap_fragment:gg,aomap_pars_fragment:xg,batching_pars_vertex:_g,batching_vertex:vg,begin_vertex:yg,beginnormal_vertex:Mg,bsdfs:bg,iridescence_fragment:Sg,bumpmap_pars_fragment:wg,clipping_planes_fragment:Tg,clipping_planes_pars_fragment:Eg,clipping_planes_pars_vertex:Ag,clipping_planes_vertex:Cg,color_fragment:Rg,color_pars_fragment:Pg,color_pars_vertex:Lg,color_vertex:Ig,common:Dg,cube_uv_reflection_fragment:Ng,defaultnormal_vertex:Ug,displacementmap_pars_vertex:Og,displacementmap_vertex:Fg,emissivemap_fragment:Bg,emissivemap_pars_fragment:kg,colorspace_fragment:zg,colorspace_pars_fragment:Hg,envmap_fragment:Vg,envmap_common_pars_fragment:Gg,envmap_pars_fragment:Wg,envmap_pars_vertex:Xg,envmap_physical_pars_fragment:nx,envmap_vertex:qg,fog_vertex:Yg,fog_pars_vertex:jg,fog_fragment:Zg,fog_pars_fragment:Kg,gradientmap_pars_fragment:Jg,lightmap_pars_fragment:Qg,lights_lambert_fragment:$g,lights_lambert_pars_fragment:ex,lights_pars_begin:tx,lights_toon_fragment:ix,lights_toon_pars_fragment:sx,lights_phong_fragment:rx,lights_phong_pars_fragment:ox,lights_physical_fragment:ax,lights_physical_pars_fragment:lx,lights_fragment_begin:cx,lights_fragment_maps:hx,lights_fragment_end:ux,lightprobes_pars_fragment:dx,logdepthbuf_fragment:fx,logdepthbuf_pars_fragment:px,logdepthbuf_pars_vertex:mx,logdepthbuf_vertex:gx,map_fragment:xx,map_pars_fragment:_x,map_particle_fragment:vx,map_particle_pars_fragment:yx,metalnessmap_fragment:Mx,metalnessmap_pars_fragment:bx,morphinstance_vertex:Sx,morphcolor_vertex:wx,morphnormal_vertex:Tx,morphtarget_pars_vertex:Ex,morphtarget_vertex:Ax,normal_fragment_begin:Cx,normal_fragment_maps:Rx,normal_pars_fragment:Px,normal_pars_vertex:Lx,normal_vertex:Ix,normalmap_pars_fragment:Dx,clearcoat_normal_fragment_begin:Nx,clearcoat_normal_fragment_maps:Ux,clearcoat_pars_fragment:Ox,iridescence_pars_fragment:Fx,opaque_fragment:Bx,packing:kx,premultiplied_alpha_fragment:zx,project_vertex:Hx,dithering_fragment:Vx,dithering_pars_fragment:Gx,roughnessmap_fragment:Wx,roughnessmap_pars_fragment:Xx,shadowmap_pars_fragment:qx,shadowmap_pars_vertex:Yx,shadowmap_vertex:jx,shadowmask_pars_fragment:Zx,skinbase_vertex:Kx,skinning_pars_vertex:Jx,skinning_vertex:Qx,skinnormal_vertex:$x,specularmap_fragment:e_,specularmap_pars_fragment:t_,tonemapping_fragment:n_,tonemapping_pars_fragment:i_,transmission_fragment:s_,transmission_pars_fragment:r_,uv_pars_fragment:o_,uv_pars_vertex:a_,uv_vertex:l_,worldpos_vertex:c_,background_vert:h_,background_frag:u_,backgroundCube_vert:d_,backgroundCube_frag:f_,cube_vert:p_,cube_frag:m_,depth_vert:g_,depth_frag:x_,distance_vert:__,distance_frag:v_,equirect_vert:y_,equirect_frag:M_,linedashed_vert:b_,linedashed_frag:S_,meshbasic_vert:w_,meshbasic_frag:T_,meshlambert_vert:E_,meshlambert_frag:A_,meshmatcap_vert:C_,meshmatcap_frag:R_,meshnormal_vert:P_,meshnormal_frag:L_,meshphong_vert:I_,meshphong_frag:D_,meshphysical_vert:N_,meshphysical_frag:U_,meshtoon_vert:O_,meshtoon_frag:F_,points_vert:B_,points_frag:k_,shadow_vert:z_,shadow_frag:H_,sprite_vert:V_,sprite_frag:G_},Me={common:{diffuse:{value:new Ee(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Qe},alphaMap:{value:null},alphaMapTransform:{value:new Qe},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Qe}},envmap:{envMap:{value:null},envMapRotation:{value:new Qe},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Qe}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Qe}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Qe},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Qe},normalScale:{value:new ee(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Qe},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Qe}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Qe}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Qe}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Ee(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new D},probesMax:{value:new D},probesResolution:{value:new D}},points:{diffuse:{value:new Ee(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Qe},alphaTest:{value:0},uvTransform:{value:new Qe}},sprite:{diffuse:{value:new Ee(16777215)},opacity:{value:1},center:{value:new ee(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Qe},alphaMap:{value:null},alphaMapTransform:{value:new Qe},alphaTest:{value:0}}},ai={basic:{uniforms:hn([Me.common,Me.specularmap,Me.envmap,Me.aomap,Me.lightmap,Me.fog]),vertexShader:st.meshbasic_vert,fragmentShader:st.meshbasic_frag},lambert:{uniforms:hn([Me.common,Me.specularmap,Me.envmap,Me.aomap,Me.lightmap,Me.emissivemap,Me.bumpmap,Me.normalmap,Me.displacementmap,Me.fog,Me.lights,{emissive:{value:new Ee(0)},envMapIntensity:{value:1}}]),vertexShader:st.meshlambert_vert,fragmentShader:st.meshlambert_frag},phong:{uniforms:hn([Me.common,Me.specularmap,Me.envmap,Me.aomap,Me.lightmap,Me.emissivemap,Me.bumpmap,Me.normalmap,Me.displacementmap,Me.fog,Me.lights,{emissive:{value:new Ee(0)},specular:{value:new Ee(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:st.meshphong_vert,fragmentShader:st.meshphong_frag},standard:{uniforms:hn([Me.common,Me.envmap,Me.aomap,Me.lightmap,Me.emissivemap,Me.bumpmap,Me.normalmap,Me.displacementmap,Me.roughnessmap,Me.metalnessmap,Me.fog,Me.lights,{emissive:{value:new Ee(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:st.meshphysical_vert,fragmentShader:st.meshphysical_frag},toon:{uniforms:hn([Me.common,Me.aomap,Me.lightmap,Me.emissivemap,Me.bumpmap,Me.normalmap,Me.displacementmap,Me.gradientmap,Me.fog,Me.lights,{emissive:{value:new Ee(0)}}]),vertexShader:st.meshtoon_vert,fragmentShader:st.meshtoon_frag},matcap:{uniforms:hn([Me.common,Me.bumpmap,Me.normalmap,Me.displacementmap,Me.fog,{matcap:{value:null}}]),vertexShader:st.meshmatcap_vert,fragmentShader:st.meshmatcap_frag},points:{uniforms:hn([Me.points,Me.fog]),vertexShader:st.points_vert,fragmentShader:st.points_frag},dashed:{uniforms:hn([Me.common,Me.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:st.linedashed_vert,fragmentShader:st.linedashed_frag},depth:{uniforms:hn([Me.common,Me.displacementmap]),vertexShader:st.depth_vert,fragmentShader:st.depth_frag},normal:{uniforms:hn([Me.common,Me.bumpmap,Me.normalmap,Me.displacementmap,{opacity:{value:1}}]),vertexShader:st.meshnormal_vert,fragmentShader:st.meshnormal_frag},sprite:{uniforms:hn([Me.sprite,Me.fog]),vertexShader:st.sprite_vert,fragmentShader:st.sprite_frag},background:{uniforms:{uvTransform:{value:new Qe},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:st.background_vert,fragmentShader:st.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Qe}},vertexShader:st.backgroundCube_vert,fragmentShader:st.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:st.cube_vert,fragmentShader:st.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:st.equirect_vert,fragmentShader:st.equirect_frag},distance:{uniforms:hn([Me.common,Me.displacementmap,{referencePosition:{value:new D},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:st.distance_vert,fragmentShader:st.distance_frag},shadow:{uniforms:hn([Me.lights,Me.fog,{color:{value:new Ee(0)},opacity:{value:1}}]),vertexShader:st.shadow_vert,fragmentShader:st.shadow_frag}};ai.physical={uniforms:hn([ai.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Qe},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Qe},clearcoatNormalScale:{value:new ee(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Qe},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Qe},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Qe},sheen:{value:0},sheenColor:{value:new Ee(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Qe},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Qe},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Qe},transmissionSamplerSize:{value:new ee},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Qe},attenuationDistance:{value:0},attenuationColor:{value:new Ee(0)},specularColor:{value:new Ee(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Qe},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Qe},anisotropyVector:{value:new ee},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Qe}}]),vertexShader:st.meshphysical_vert,fragmentShader:st.meshphysical_frag};var dc={r:0,b:0,g:0},W_=new je,Up=new Qe;Up.set(-1,0,0,0,1,0,0,0,1);function X_(s,e,t,n,i,r){let o=new Ee(0),a=i===!0?0:1,l,c,h=null,f=0,d=null;function u(b){let T=b.isScene===!0?b.background:null;if(T&&T.isTexture){let _=b.backgroundBlurriness>0;T=e.get(T,_)}return T}function p(b){let T=!1,_=u(b);_===null?m(o,a):_&&_.isColor&&(m(_,1),T=!0);let M=s.xr.getEnvironmentBlendMode();M==="additive"?t.buffers.color.setClear(0,0,0,1,r):M==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,r),(s.autoClear||T)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),s.clear(s.autoClearColor,s.autoClearDepth,s.autoClearStencil))}function x(b,T){let _=u(T);_&&(_.isCubeTexture||_.mapping===Fo)?(c===void 0&&(c=new Re(new Xt(1,1,1),new ct({name:"BackgroundCubeMaterial",uniforms:Ss(ai.backgroundCube.uniforms),vertexShader:ai.backgroundCube.vertexShader,fragmentShader:ai.backgroundCube.fragmentShader,side:en,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(M,E,A){this.matrixWorld.copyPosition(A.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(c)),c.material.uniforms.envMap.value=_,c.material.uniforms.backgroundBlurriness.value=T.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=T.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(W_.makeRotationFromEuler(T.backgroundRotation)).transpose(),_.isCubeTexture&&_.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(Up),c.material.toneMapped=tt.getTransfer(_.colorSpace)!==ht,(h!==_||f!==_.version||d!==s.toneMapping)&&(c.material.needsUpdate=!0,h=_,f=_.version,d=s.toneMapping),c.layers.enableAll(),b.unshift(c,c.geometry,c.material,0,0,null)):_&&_.isTexture&&(l===void 0&&(l=new Re(new Vi(2,2),new ct({name:"BackgroundMaterial",uniforms:Ss(ai.background.uniforms),vertexShader:ai.background.vertexShader,fragmentShader:ai.background.fragmentShader,side:si,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(l)),l.material.uniforms.t2D.value=_,l.material.uniforms.backgroundIntensity.value=T.backgroundIntensity,l.material.toneMapped=tt.getTransfer(_.colorSpace)!==ht,_.matrixAutoUpdate===!0&&_.updateMatrix(),l.material.uniforms.uvTransform.value.copy(_.matrix),(h!==_||f!==_.version||d!==s.toneMapping)&&(l.material.needsUpdate=!0,h=_,f=_.version,d=s.toneMapping),l.layers.enableAll(),b.unshift(l,l.geometry,l.material,0,0,null))}function m(b,T){b.getRGB(dc,ou(s)),t.buffers.color.setClear(dc.r,dc.g,dc.b,T,r)}function g(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return o},setClearColor:function(b,T=1){o.set(b),a=T,m(o,a)},getClearAlpha:function(){return a},setClearAlpha:function(b){a=b,m(o,a)},render:p,addToRenderList:x,dispose:g}}function q_(s,e){let t=s.getParameter(s.MAX_VERTEX_ATTRIBS),n={},i=d(null),r=i,o=!1;function a(L,S,w,P,U){let F=!1,O=f(L,P,w,S);r!==O&&(r=O,c(r.object)),F=u(L,P,w,U),F&&p(L,P,w,U),U!==null&&e.update(U,s.ELEMENT_ARRAY_BUFFER),(F||o)&&(o=!1,_(L,S,w,P),U!==null&&s.bindBuffer(s.ELEMENT_ARRAY_BUFFER,e.get(U).buffer))}function l(){return s.createVertexArray()}function c(L){return s.bindVertexArray(L)}function h(L){return s.deleteVertexArray(L)}function f(L,S,w,P){let U=P.wireframe===!0,F=n[S.id];F===void 0&&(F={},n[S.id]=F);let O=L.isInstancedMesh===!0?L.id:0,H=F[O];H===void 0&&(H={},F[O]=H);let k=H[w.id];k===void 0&&(k={},H[w.id]=k);let W=k[U];return W===void 0&&(W=d(l()),k[U]=W),W}function d(L){let S=[],w=[],P=[];for(let U=0;U<t;U++)S[U]=0,w[U]=0,P[U]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:S,enabledAttributes:w,attributeDivisors:P,object:L,attributes:{},index:null}}function u(L,S,w,P){let U=r.attributes,F=S.attributes,O=0,H=w.getAttributes();for(let k in H)if(H[k].location>=0){let Z=U[k],he=F[k];if(he===void 0&&(k==="instanceMatrix"&&L.instanceMatrix&&(he=L.instanceMatrix),k==="instanceColor"&&L.instanceColor&&(he=L.instanceColor)),Z===void 0||Z.attribute!==he||he&&Z.data!==he.data)return!0;O++}return r.attributesNum!==O||r.index!==P}function p(L,S,w,P){let U={},F=S.attributes,O=0,H=w.getAttributes();for(let k in H)if(H[k].location>=0){let Z=F[k];Z===void 0&&(k==="instanceMatrix"&&L.instanceMatrix&&(Z=L.instanceMatrix),k==="instanceColor"&&L.instanceColor&&(Z=L.instanceColor));let he={};he.attribute=Z,Z&&Z.data&&(he.data=Z.data),U[k]=he,O++}r.attributes=U,r.attributesNum=O,r.index=P}function x(){let L=r.newAttributes;for(let S=0,w=L.length;S<w;S++)L[S]=0}function m(L){g(L,0)}function g(L,S){let w=r.newAttributes,P=r.enabledAttributes,U=r.attributeDivisors;w[L]=1,P[L]===0&&(s.enableVertexAttribArray(L),P[L]=1),U[L]!==S&&(s.vertexAttribDivisor(L,S),U[L]=S)}function b(){let L=r.newAttributes,S=r.enabledAttributes;for(let w=0,P=S.length;w<P;w++)S[w]!==L[w]&&(s.disableVertexAttribArray(w),S[w]=0)}function T(L,S,w,P,U,F,O){O===!0?s.vertexAttribIPointer(L,S,w,U,F):s.vertexAttribPointer(L,S,w,P,U,F)}function _(L,S,w,P){x();let U=P.attributes,F=w.getAttributes(),O=S.defaultAttributeValues;for(let H in F){let k=F[H];if(k.location>=0){let W=U[H];if(W===void 0&&(H==="instanceMatrix"&&L.instanceMatrix&&(W=L.instanceMatrix),H==="instanceColor"&&L.instanceColor&&(W=L.instanceColor)),W!==void 0){let Z=W.normalized,he=W.itemSize,pe=e.get(W);if(pe===void 0)continue;let Ae=pe.buffer,we=pe.type,Pe=pe.bytesPerElement,q=we===s.INT||we===s.UNSIGNED_INT||W.gpuType===Al;if(W.isInterleavedBufferAttribute){let K=W.data,de=K.stride,De=W.offset;if(K.isInstancedInterleavedBuffer){for(let _e=0;_e<k.locationSize;_e++)g(k.location+_e,K.meshPerAttribute);L.isInstancedMesh!==!0&&P._maxInstanceCount===void 0&&(P._maxInstanceCount=K.meshPerAttribute*K.count)}else for(let _e=0;_e<k.locationSize;_e++)m(k.location+_e);s.bindBuffer(s.ARRAY_BUFFER,Ae);for(let _e=0;_e<k.locationSize;_e++)T(k.location+_e,he/k.locationSize,we,Z,de*Pe,(De+he/k.locationSize*_e)*Pe,q)}else{if(W.isInstancedBufferAttribute){for(let K=0;K<k.locationSize;K++)g(k.location+K,W.meshPerAttribute);L.isInstancedMesh!==!0&&P._maxInstanceCount===void 0&&(P._maxInstanceCount=W.meshPerAttribute*W.count)}else for(let K=0;K<k.locationSize;K++)m(k.location+K);s.bindBuffer(s.ARRAY_BUFFER,Ae);for(let K=0;K<k.locationSize;K++)T(k.location+K,he/k.locationSize,we,Z,he*Pe,he/k.locationSize*K*Pe,q)}}else if(O!==void 0){let Z=O[H];if(Z!==void 0)switch(Z.length){case 2:s.vertexAttrib2fv(k.location,Z);break;case 3:s.vertexAttrib3fv(k.location,Z);break;case 4:s.vertexAttrib4fv(k.location,Z);break;default:s.vertexAttrib1fv(k.location,Z)}}}}b()}function M(){R();for(let L in n){let S=n[L];for(let w in S){let P=S[w];for(let U in P){let F=P[U];for(let O in F)h(F[O].object),delete F[O];delete P[U]}}delete n[L]}}function E(L){if(n[L.id]===void 0)return;let S=n[L.id];for(let w in S){let P=S[w];for(let U in P){let F=P[U];for(let O in F)h(F[O].object),delete F[O];delete P[U]}}delete n[L.id]}function A(L){for(let S in n){let w=n[S];for(let P in w){let U=w[P];if(U[L.id]===void 0)continue;let F=U[L.id];for(let O in F)h(F[O].object),delete F[O];delete U[L.id]}}}function v(L){for(let S in n){let w=n[S],P=L.isInstancedMesh===!0?L.id:0,U=w[P];if(U!==void 0){for(let F in U){let O=U[F];for(let H in O)h(O[H].object),delete O[H];delete U[F]}delete w[P],Object.keys(w).length===0&&delete n[S]}}}function R(){N(),o=!0,r!==i&&(r=i,c(r.object))}function N(){i.geometry=null,i.program=null,i.wireframe=!1}return{setup:a,reset:R,resetDefaultState:N,dispose:M,releaseStatesOfGeometry:E,releaseStatesOfObject:v,releaseStatesOfProgram:A,initAttributes:x,enableAttribute:m,disableUnusedAttributes:b}}function Y_(s,e,t){let n;function i(l){n=l}function r(l,c){s.drawArrays(n,l,c),t.update(c,n,1)}function o(l,c,h){h!==0&&(s.drawArraysInstanced(n,l,c,h),t.update(c,n,h))}function a(l,c,h){if(h===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,l,0,c,0,h);let d=0;for(let u=0;u<h;u++)d+=c[u];t.update(d,n,1)}this.setMode=i,this.render=r,this.renderInstances=o,this.renderMultiDraw=a}function j_(s,e,t,n){let i;function r(){if(i!==void 0)return i;if(e.has("EXT_texture_filter_anisotropic")===!0){let A=e.get("EXT_texture_filter_anisotropic");i=s.getParameter(A.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else i=0;return i}function o(A){return!(A!==pn&&n.convert(A)!==s.getParameter(s.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(A){let v=A===St&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(A!==cn&&A!==Tn&&!v&&n.convert(A)!==s.getParameter(s.IMPLEMENTATION_COLOR_READ_TYPE))}function l(A){if(A==="highp"){if(s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.HIGH_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.HIGH_FLOAT).precision>0)return"highp";A="mediump"}return A==="mediump"&&s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.MEDIUM_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp",h=l(c);h!==c&&(Ge("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);let f=t.logarithmicDepthBuffer===!0,d=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control");t.reversedDepthBuffer===!0&&d===!1&&Ge("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let u=s.getParameter(s.MAX_TEXTURE_IMAGE_UNITS),p=s.getParameter(s.MAX_VERTEX_TEXTURE_IMAGE_UNITS),x=s.getParameter(s.MAX_TEXTURE_SIZE),m=s.getParameter(s.MAX_CUBE_MAP_TEXTURE_SIZE),g=s.getParameter(s.MAX_VERTEX_ATTRIBS),b=s.getParameter(s.MAX_VERTEX_UNIFORM_VECTORS),T=s.getParameter(s.MAX_VARYING_VECTORS),_=s.getParameter(s.MAX_FRAGMENT_UNIFORM_VECTORS),M=s.getParameter(s.MAX_SAMPLES),E=s.getParameter(s.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:c,logarithmicDepthBuffer:f,reversedDepthBuffer:d,maxTextures:u,maxVertexTextures:p,maxTextureSize:x,maxCubemapSize:m,maxAttributes:g,maxVertexUniforms:b,maxVaryings:T,maxFragmentUniforms:_,maxSamples:M,samples:E}}function Z_(s){let e=this,t=null,n=0,i=!1,r=!1,o=new Qt,a=new Qe,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(f,d){let u=f.length!==0||d||n!==0||i;return i=d,n=f.length,u},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(f,d){t=h(f,d,0)},this.setState=function(f,d,u){let p=f.clippingPlanes,x=f.clipIntersection,m=f.clipShadows,g=s.get(f);if(!i||p===null||p.length===0||r&&!m)r?h(null):c();else{let b=r?0:n,T=b*4,_=g.clippingState||null;l.value=_,_=h(p,d,T,u);for(let M=0;M!==T;++M)_[M]=t[M];g.clippingState=_,this.numIntersection=x?this.numPlanes:0,this.numPlanes+=b}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function h(f,d,u,p){let x=f!==null?f.length:0,m=null;if(x!==0){if(m=l.value,p!==!0||m===null){let g=u+x*4,b=d.matrixWorldInverse;a.getNormalMatrix(b),(m===null||m.length<g)&&(m=new Float32Array(g));for(let T=0,_=u;T!==x;++T,_+=4)o.copy(f[T]).applyMatrix4(b,a),o.normal.toArray(m,_),m[_+3]=o.constant}l.value=m,l.needsUpdate=!0}return e.numPlanes=x,e.numIntersection=0,m}}var Mr=4,K_=6,J_=20,Q_=256,qo=new Sn,fp=new Ee,mu=null,gu=0,xu=0,_u=!1,$_=new D,ws=new D,Sr=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,i=100,r={}){let{size:o=256,position:a=$_}=r;mu=this._renderer.getRenderTarget(),gu=this._renderer.getActiveCubeFace(),xu=this._renderer.getActiveMipmapLevel(),_u=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(o);let l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,n,i,l,a),t>0&&this._blur(l,0,0,t),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=gp(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=mp(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(mu,gu,xu),this._renderer.xr.enabled=_u,e.scissorTest=!1,yr(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===Ji||e.mapping===Ms?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),mu=this._renderer.getRenderTarget(),gu=this._renderer.getActiveCubeFace(),xu=this._renderer.getActiveMipmapLevel(),_u=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:It,minFilter:It,generateMipmaps:!1,type:St,format:pn,colorSpace:fn,depthBuffer:!1},i=pp(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=pp(e,t,n);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods}=ev(r)),this._blurMaterial=nv(r,e,t),this._ggxMaterial=tv(r,e,t)}return i}_compileMaterial(e){let t=new Re(new _t,e);this._renderer.compile(t,qo)}_sceneToCubeUV(e,t,n,i,r){let l=new Nt(90,1,t,n),c=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],f=this._renderer,d=f.autoClear,u=f.toneMapping;f.getClearColor(fp),f.toneMapping=wn,f.autoClear=!1,f.state.buffers.depth.getReversed()&&(f.setRenderTarget(i),f.clearDepth(),f.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new Re(new Xt,new Et({name:"PMREM.Background",side:en,depthWrite:!1,depthTest:!1})));let x=this._backgroundBox,m=x.material,g=!1,b=e.background;b?b.isColor&&(m.color.copy(b),e.background=null,g=!0):(m.color.copy(fp),g=!0);for(let T=0;T<6;T++){let _=T%3;_===0?(l.up.set(0,c[T],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x+h[T],r.y,r.z)):_===1?(l.up.set(0,0,c[T]),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y+h[T],r.z)):(l.up.set(0,c[T],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y,r.z+h[T]));let M=this._cubeSize;yr(i,_*M,T>2?M:0,M,M),f.setRenderTarget(i),g&&f.render(x,l),f.render(e,l)}f.toneMapping=u,f.autoClear=d,e.background=b}_textureToCubeUV(e,t){let n=this._renderer,i=e.mapping===Ji||e.mapping===Ms;i?(this._cubemapMaterial===null&&(this._cubemapMaterial=gp()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=mp());let r=i?this._cubemapMaterial:this._equirectMaterial,o=this._lodMeshes[0];o.material=r;let a=r.uniforms;a.envMap.value=e;let l=this._cubeSize;yr(t,0,0,3*l,2*l),n.setRenderTarget(t),n.render(o,qo)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;let i=this._lodMeshes.length;for(let r=1;r<i;r++)this._applyGGXFilter(e,r-1,r);t.autoClear=n}_applyGGXFilter(e,t,n){let i=this._renderer,r=this._pingPongRenderTarget,o=this._ggxMaterial,a=this._lodMeshes[n];a.material=o;let l=o.uniforms,c=n/(this._lodMeshes.length-1),h=t/(this._lodMeshes.length-1),f=Math.sqrt(c*c-h*h),d=c*1.25,u=f*d,{_lodMax:p}=this,x=this._sizeLods[n],m=3*x*(n>p-Mr?n-p+Mr:0),g=4*(this._cubeSize-x);l.envMap.value=e.texture,l.roughness.value=u,l.mipInt.value=p-t,yr(r,m,g,3*x,2*x),i.setRenderTarget(r),i.render(a,qo),l.envMap.value=r.texture,l.roughness.value=0,l.mipInt.value=p-n,yr(e,m,g,3*x,2*x),i.setRenderTarget(e),i.render(a,qo)}_blur(e,t,n,i){let r=this._pingPongRenderTarget,o=Math.min(i,Math.PI)/Math.SQRT2;this._blurPass(e,r,t,n,o),this._blurPass(r,e,n,n,o)}_blurPass(e,t,n,i,r){let o=this._renderer,a=this._blurMaterial,l=this._lodMeshes[i];l.material=a;let c=a.uniforms;c.envMap.value=e.texture,c.sigma.value=r,c.mipInt.value=this._lodMax-n;let h=this._sizeLods[i],f=3*h*(i>this._lodMax-Mr?i-this._lodMax+Mr:0),d=4*(this._cubeSize-h);yr(t,f,d,3*h,2*h),o.setRenderTarget(t),o.render(l,qo)}};function ev(s){let e=[],t=[],n=s,i=s-Mr+1+K_;for(let r=0;r<i;r++){let o=Math.pow(2,n);e.push(o);let a=1/(o-2),l=-a,c=1+a,h=[l,l,c,l,c,c,l,l,c,c,l,c],f=6,d=6,u=3,p=new Float32Array(u*d*f),x=new Float32Array(u*d*f);for(let g=0;g<f;g++){let b=g%3*2/3-1,T=g>2?0:-1,_=[b,T,0,b+2/3,T,0,b+2/3,T+1,0,b,T,0,b+2/3,T+1,0,b,T+1,0];p.set(_,u*d*g);for(let M=0;M<d;M++){let E=h[M*2]*2-1,A=h[M*2+1]*2-1;g===0?ws.set(1,A,E):g===1?ws.set(-E,1,-A):g===2?ws.set(-E,A,1):g===3?ws.set(-1,A,-E):g===4?ws.set(-E,-1,A):ws.set(E,A,-1),ws.toArray(x,(g*d+M)*u)}}let m=new _t;m.setAttribute("position",new Pt(p,u)),m.setAttribute("outputDirection",new Pt(x,u)),t.push(new Re(m,null)),n>Mr&&n--}return{lodMeshes:t,sizeLods:e}}function pp(s,e,t){let n=new dt(s,e,t);return n.texture.mapping=Fo,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function yr(s,e,t,n,i){s.viewport.set(e,t,n,i),s.scissor.set(e,t,n,i)}function tv(s,e,t){return new ct({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:Q_,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${s}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:gc(),fragmentShader:`

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
		`,blending:kt,depthTest:!1,depthWrite:!1})}function nv(s,e,t){return new ct({name:"SphericalGaussianBlur",defines:{SAMPLES:J_,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${s}.0`},uniforms:{envMap:{value:null},sigma:{value:0},mipInt:{value:0}},vertexShader:gc(),fragmentShader:`

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
		`,blending:kt,depthTest:!1,depthWrite:!1})}function mp(){return new ct({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:gc(),fragmentShader:`

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
		`,blending:kt,depthTest:!1,depthWrite:!1})}function gp(){return new ct({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:gc(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:kt,depthTest:!1,depthWrite:!1})}function gc(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 outputDirection;

		varying vec3 vOutputDirection;

		void main() {

			vOutputDirection = outputDirection;
			gl_Position = vec4( position, 1.0 );

		}
	`}var pc=class extends dt{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},i=[n,n,n,n,n,n];this.texture=new ro(i),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},i=new Xt(5,5,5),r=new ct({name:"CubemapFromEquirect",uniforms:Ss(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:en,blending:kt});r.uniforms.tEquirect.value=t;let o=new Re(i,r),a=t.minFilter;return t.minFilter===Gn&&(t.minFilter=It),new vl(1,10,this).update(e,o),t.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(e,t=!0,n=!0,i=!0){let r=e.getRenderTarget();for(let o=0;o<6;o++)e.setRenderTarget(this,o),e.clear(t,n,i);e.setRenderTarget(r)}};function iv(s){let e=new WeakMap,t=new WeakMap,n=null;function i(d,u=!1){return d==null?null:u?o(d):r(d)}function r(d){if(d&&d.isTexture){let u=d.mapping;if(u===wl||u===Tl)if(e.has(d)){let p=e.get(d).texture;return a(p,d.mapping)}else{let p=d.image;if(p&&p.height>0){let x=new pc(p.height);return x.fromEquirectangularTexture(s,d),e.set(d,x),d.addEventListener("dispose",c),a(x.texture,d.mapping)}else return null}}return d}function o(d){if(d&&d.isTexture){let u=d.mapping,p=u===wl||u===Tl,x=u===Ji||u===Ms;if(p||x){let m=t.get(d),g=m!==void 0?m.texture.pmremVersion:0;if(d.isRenderTargetTexture&&d.pmremVersion!==g)return n===null&&(n=new Sr(s)),m=p?n.fromEquirectangular(d,m):n.fromCubemap(d,m),m.texture.pmremVersion=d.pmremVersion,t.set(d,m),m.texture;if(m!==void 0)return m.texture;{let b=d.image;return p&&b&&b.height>0||x&&b&&l(b)?(n===null&&(n=new Sr(s)),m=p?n.fromEquirectangular(d):n.fromCubemap(d),m.texture.pmremVersion=d.pmremVersion,t.set(d,m),d.addEventListener("dispose",h),m.texture):null}}}return d}function a(d,u){return u===wl?d.mapping=Ji:u===Tl&&(d.mapping=Ms),d}function l(d){let u=0,p=6;for(let x=0;x<p;x++)d[x]!==void 0&&u++;return u===p}function c(d){let u=d.target;u.removeEventListener("dispose",c);let p=e.get(u);p!==void 0&&(e.delete(u),p.dispose())}function h(d){let u=d.target;u.removeEventListener("dispose",h);let p=t.get(u);p!==void 0&&(t.delete(u),p.dispose())}function f(){e=new WeakMap,t=new WeakMap,n!==null&&(n.dispose(),n=null)}return{get:i,dispose:f}}function sv(s){let e={};function t(n){if(e[n]!==void 0)return e[n];let i=s.getExtension(n);return e[n]=i,i}return{has:function(n){return t(n)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(n){let i=t(n);return i===null&&as("WebGLRenderer: "+n+" extension not supported."),i}}}function rv(s,e,t,n){let i={},r=new WeakMap;function o(f){let d=f.target;d.index!==null&&e.remove(d.index);for(let p in d.attributes)e.remove(d.attributes[p]);d.removeEventListener("dispose",o),delete i[d.id];let u=r.get(d);u&&(e.remove(u),r.delete(d)),n.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,t.memory.geometries--}function a(f,d){return i[d.id]===!0||(d.addEventListener("dispose",o),i[d.id]=!0,t.memory.geometries++),d}function l(f){let d=f.attributes;for(let u in d)e.update(d[u],s.ARRAY_BUFFER)}function c(f){let d=[],u=f.index,p=f.attributes.position,x=0;if(p===void 0)return;if(u!==null){let b=u.array;x=u.version;for(let T=0,_=b.length;T<_;T+=3){let M=b[T+0],E=b[T+1],A=b[T+2];d.push(M,E,E,A,A,M)}}else{let b=p.array;x=p.version;for(let T=0,_=b.length/3-1;T<_;T+=3){let M=T+0,E=T+1,A=T+2;d.push(M,E,E,A,A,M)}}let m=new(p.count>=65535?Qr:Jr)(d,1);m.version=x;let g=r.get(f);g&&e.remove(g),r.set(f,m)}function h(f){let d=r.get(f);if(d){let u=f.index;u!==null&&d.version<u.version&&c(f)}else c(f);return r.get(f)}return{get:a,update:l,getWireframeAttribute:h}}function ov(s,e,t){let n;function i(f){n=f}let r,o;function a(f){r=f.type,o=f.bytesPerElement}function l(f,d){s.drawElements(n,d,r,f*o),t.update(d,n,1)}function c(f,d,u){u!==0&&(s.drawElementsInstanced(n,d,r,f*o,u),t.update(d,n,u))}function h(f,d,u){if(u===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,d,0,r,f,0,u);let x=0;for(let m=0;m<u;m++)x+=d[m];t.update(x,n,1)}this.setMode=i,this.setIndex=a,this.render=l,this.renderInstances=c,this.renderMultiDraw=h}function av(s){let e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,o,a){switch(t.calls++,o){case s.TRIANGLES:t.triangles+=a*(r/3);break;case s.LINES:t.lines+=a*(r/2);break;case s.LINE_STRIP:t.lines+=a*(r-1);break;case s.LINE_LOOP:t.lines+=a*r;break;case s.POINTS:t.points+=a*r;break;default:Ze("WebGLInfo: Unknown draw mode:",o);break}}function i(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:i,update:n}}function lv(s,e,t){let n=new WeakMap,i=new ut;function r(o,a,l){let c=o.morphTargetInfluences,h=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,f=h!==void 0?h.length:0,d=n.get(a);if(d===void 0||d.count!==f){let R=function(){A.dispose(),n.delete(a),a.removeEventListener("dispose",R)};d!==void 0&&d.texture.dispose();let u=a.morphAttributes.position!==void 0,p=a.morphAttributes.normal!==void 0,x=a.morphAttributes.color!==void 0,m=a.morphAttributes.position||[],g=a.morphAttributes.normal||[],b=a.morphAttributes.color||[],T=0;u===!0&&(T=1),p===!0&&(T=2),x===!0&&(T=3);let _=a.attributes.position.count*T,M=1;_>e.maxTextureSize&&(M=Math.ceil(_/e.maxTextureSize),_=e.maxTextureSize);let E=new Float32Array(_*M*4*f),A=new Kr(E,_,M,f);A.type=Tn,A.needsUpdate=!0;let v=T*4;for(let N=0;N<f;N++){let L=m[N],S=g[N],w=b[N],P=_*M*4*N;for(let U=0;U<L.count;U++){let F=U*v;u===!0&&(i.fromBufferAttribute(L,U),E[P+F+0]=i.x,E[P+F+1]=i.y,E[P+F+2]=i.z,E[P+F+3]=0),p===!0&&(i.fromBufferAttribute(S,U),E[P+F+4]=i.x,E[P+F+5]=i.y,E[P+F+6]=i.z,E[P+F+7]=0),x===!0&&(i.fromBufferAttribute(w,U),E[P+F+8]=i.x,E[P+F+9]=i.y,E[P+F+10]=i.z,E[P+F+11]=w.itemSize===4?i.w:1)}}d={count:f,texture:A,size:new ee(_,M)},n.set(a,d),a.addEventListener("dispose",R)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(s,"morphTexture",o.morphTexture,t);else{let u=0;for(let x=0;x<c.length;x++)u+=c[x];let p=a.morphTargetsRelative?1:1-u;l.getUniforms().setValue(s,"morphTargetBaseInfluence",p),l.getUniforms().setValue(s,"morphTargetInfluences",c)}l.getUniforms().setValue(s,"morphTargetsTexture",d.texture,t),l.getUniforms().setValue(s,"morphTargetsTextureSize",d.size)}return{update:r}}function cv(s,e,t,n,i){let r=new WeakMap;function o(c){let h=i.render.frame,f=c.geometry,d=e.get(c,f);if(r.get(d)!==h&&(e.update(d),r.set(d,h)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),r.get(c)!==h&&(t.update(c.instanceMatrix,s.ARRAY_BUFFER),c.instanceColor!==null&&t.update(c.instanceColor,s.ARRAY_BUFFER),r.set(c,h))),c.isSkinnedMesh){let u=c.skeleton;r.get(u)!==h&&(u.update(),r.set(u,h))}return d}function a(){r=new WeakMap}function l(c){let h=c.target;h.removeEventListener("dispose",l),n.releaseStatesOfObject(h),t.remove(h.instanceMatrix),h.instanceColor!==null&&t.remove(h.instanceColor)}return{update:o,dispose:a}}var hv={[Lo]:"LINEAR_TONE_MAPPING",[Io]:"REINHARD_TONE_MAPPING",[Do]:"CINEON_TONE_MAPPING",[No]:"ACES_FILMIC_TONE_MAPPING",[Oo]:"AGX_TONE_MAPPING",[Ki]:"NEUTRAL_TONE_MAPPING",[Uo]:"CUSTOM_TONE_MAPPING"};function uv(s,e,t,n,i,r){let o=new dt(e,t,{type:s,depthBuffer:i,stencilBuffer:r,samples:n?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),a=null,l=null,c=new _t;c.setAttribute("position",new at([-1,3,0,-1,-1,0,3,-1,0],3)),c.setAttribute("uv",new at([0,2,0,0,2,0],2));let h=new hr({uniforms:{tDiffuse:{value:null}},vertexShader:`
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
			}`,depthTest:!1,depthWrite:!1}),f=new Re(c,h),d=new Sn(-1,1,1,-1,0,1),u=null,p=null,x=!1,m,g=null,b=[],T=!1;this.setSize=function(_,M){o.setSize(_,M),a!==null&&a.setSize(_,M),l!==null&&l.setSize(_,M);for(let E=0;E<b.length;E++){let A=b[E];A.setSize&&A.setSize(_,M)}},this.setEffects=function(_){b=_,T=b.length>0&&b[0].isRenderPass===!0;let M=o.width,E=o.height;b.length>0&&a===null&&(a=new dt(M,E,{type:St,depthBuffer:!1,stencilBuffer:!1}),l=new dt(M,E,{type:St,depthBuffer:!1,stencilBuffer:!1}));for(let A=0;A<b.length;A++){let v=b[A];v.setSize&&v.setSize(M,E)}},this.begin=function(_,M){if(x||_.toneMapping===wn&&b.length===0)return!1;if(g=M,M!==null){let E=M.width,A=M.height;(o.width!==E||o.height!==A)&&this.setSize(E,A)}return T===!1&&_.setRenderTarget(o),m=_.toneMapping,_.toneMapping=wn,!0},this.hasRenderPass=function(){return T},this.end=function(_,M){_.toneMapping=m,x=!0;let E=o,A=a;for(let v=0;v<b.length;v++){let R=b[v];R.enabled!==!1&&(R.render(_,A,E,M),R.needsSwap!==!1&&(E=A,A=A===a?l:a))}if(u!==_.outputColorSpace||p!==_.toneMapping){u=_.outputColorSpace,p=_.toneMapping,h.defines={},tt.getTransfer(u)===ht&&(h.defines.SRGB_TRANSFER="");let v=hv[p];v&&(h.defines[v]=""),h.needsUpdate=!0}h.uniforms.tDiffuse.value=E.texture,_.setRenderTarget(g),_.render(f,d),g=null,x=!1},this.isCompositing=function(){return x},this.dispose=function(){o.dispose(),a!==null&&a.dispose(),l!==null&&l.dispose(),c.dispose(),h.dispose()}}var Op=new Ut,Mu=new ti(1,1),Fp=new Kr,Bp=new el,kp=new ro,xp=[],_p=[],vp=new Float32Array(16),yp=new Float32Array(9),Mp=new Float32Array(4);function wr(s,e,t){let n=s[0];if(n<=0||n>0)return s;let i=e*t,r=xp[i];if(r===void 0&&(r=new Float32Array(i),xp[i]=r),e!==0){n.toArray(r,0);for(let o=1,a=0;o!==e;++o)a+=t,s[o].toArray(r,a)}return r}function qt(s,e){if(s.length!==e.length)return!1;for(let t=0,n=s.length;t<n;t++)if(s[t]!==e[t])return!1;return!0}function Yt(s,e){for(let t=0,n=e.length;t<n;t++)s[t]=e[t]}function xc(s,e){let t=_p[e];t===void 0&&(t=new Int32Array(e),_p[e]=t);for(let n=0;n!==e;++n)t[n]=s.allocateTextureUnit();return t}function dv(s,e){let t=this.cache;t[0]!==e&&(s.uniform1f(this.addr,e),t[0]=e)}function fv(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(s.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(qt(t,e))return;s.uniform2fv(this.addr,e),Yt(t,e)}}function pv(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(s.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(s.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(qt(t,e))return;s.uniform3fv(this.addr,e),Yt(t,e)}}function mv(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(s.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(qt(t,e))return;s.uniform4fv(this.addr,e),Yt(t,e)}}function gv(s,e){let t=this.cache,n=e.elements;if(n===void 0){if(qt(t,e))return;s.uniformMatrix2fv(this.addr,!1,e),Yt(t,e)}else{if(qt(t,n))return;Mp.set(n),s.uniformMatrix2fv(this.addr,!1,Mp),Yt(t,n)}}function xv(s,e){let t=this.cache,n=e.elements;if(n===void 0){if(qt(t,e))return;s.uniformMatrix3fv(this.addr,!1,e),Yt(t,e)}else{if(qt(t,n))return;yp.set(n),s.uniformMatrix3fv(this.addr,!1,yp),Yt(t,n)}}function _v(s,e){let t=this.cache,n=e.elements;if(n===void 0){if(qt(t,e))return;s.uniformMatrix4fv(this.addr,!1,e),Yt(t,e)}else{if(qt(t,n))return;vp.set(n),s.uniformMatrix4fv(this.addr,!1,vp),Yt(t,n)}}function vv(s,e){let t=this.cache;t[0]!==e&&(s.uniform1i(this.addr,e),t[0]=e)}function yv(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(s.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(qt(t,e))return;s.uniform2iv(this.addr,e),Yt(t,e)}}function Mv(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(s.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(qt(t,e))return;s.uniform3iv(this.addr,e),Yt(t,e)}}function bv(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(s.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(qt(t,e))return;s.uniform4iv(this.addr,e),Yt(t,e)}}function Sv(s,e){let t=this.cache;t[0]!==e&&(s.uniform1ui(this.addr,e),t[0]=e)}function wv(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(s.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(qt(t,e))return;s.uniform2uiv(this.addr,e),Yt(t,e)}}function Tv(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(s.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(qt(t,e))return;s.uniform3uiv(this.addr,e),Yt(t,e)}}function Ev(s,e){let t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(s.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(qt(t,e))return;s.uniform4uiv(this.addr,e),Yt(t,e)}}function Av(s,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i);let r;this.type===s.SAMPLER_2D_SHADOW?(Mu.compareFunction=t.isReversedDepthBuffer()?uc:hc,r=Mu):r=Op,t.setTexture2D(e||r,i)}function Cv(s,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),t.setTexture3D(e||Bp,i)}function Rv(s,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),t.setTextureCube(e||kp,i)}function Pv(s,e,t){let n=this.cache,i=t.allocateTextureUnit();n[0]!==i&&(s.uniform1i(this.addr,i),n[0]=i),t.setTexture2DArray(e||Fp,i)}function Lv(s){switch(s){case 5126:return dv;case 35664:return fv;case 35665:return pv;case 35666:return mv;case 35674:return gv;case 35675:return xv;case 35676:return _v;case 5124:case 35670:return vv;case 35667:case 35671:return yv;case 35668:case 35672:return Mv;case 35669:case 35673:return bv;case 5125:return Sv;case 36294:return wv;case 36295:return Tv;case 36296:return Ev;case 35678:case 36198:case 36298:case 36306:case 35682:return Av;case 35679:case 36299:case 36307:return Cv;case 35680:case 36300:case 36308:case 36293:return Rv;case 36289:case 36303:case 36311:case 36292:return Pv}}function Iv(s,e){s.uniform1fv(this.addr,e)}function Dv(s,e){let t=wr(e,this.size,2);s.uniform2fv(this.addr,t)}function Nv(s,e){let t=wr(e,this.size,3);s.uniform3fv(this.addr,t)}function Uv(s,e){let t=wr(e,this.size,4);s.uniform4fv(this.addr,t)}function Ov(s,e){let t=wr(e,this.size,4);s.uniformMatrix2fv(this.addr,!1,t)}function Fv(s,e){let t=wr(e,this.size,9);s.uniformMatrix3fv(this.addr,!1,t)}function Bv(s,e){let t=wr(e,this.size,16);s.uniformMatrix4fv(this.addr,!1,t)}function kv(s,e){s.uniform1iv(this.addr,e)}function zv(s,e){s.uniform2iv(this.addr,e)}function Hv(s,e){s.uniform3iv(this.addr,e)}function Vv(s,e){s.uniform4iv(this.addr,e)}function Gv(s,e){s.uniform1uiv(this.addr,e)}function Wv(s,e){s.uniform2uiv(this.addr,e)}function Xv(s,e){s.uniform3uiv(this.addr,e)}function qv(s,e){s.uniform4uiv(this.addr,e)}function Yv(s,e,t){let n=this.cache,i=e.length,r=xc(t,i);qt(n,r)||(s.uniform1iv(this.addr,r),Yt(n,r));let o;this.type===s.SAMPLER_2D_SHADOW?o=Mu:o=Op;for(let a=0;a!==i;++a)t.setTexture2D(e[a]||o,r[a])}function jv(s,e,t){let n=this.cache,i=e.length,r=xc(t,i);qt(n,r)||(s.uniform1iv(this.addr,r),Yt(n,r));for(let o=0;o!==i;++o)t.setTexture3D(e[o]||Bp,r[o])}function Zv(s,e,t){let n=this.cache,i=e.length,r=xc(t,i);qt(n,r)||(s.uniform1iv(this.addr,r),Yt(n,r));for(let o=0;o!==i;++o)t.setTextureCube(e[o]||kp,r[o])}function Kv(s,e,t){let n=this.cache,i=e.length,r=xc(t,i);qt(n,r)||(s.uniform1iv(this.addr,r),Yt(n,r));for(let o=0;o!==i;++o)t.setTexture2DArray(e[o]||Fp,r[o])}function Jv(s){switch(s){case 5126:return Iv;case 35664:return Dv;case 35665:return Nv;case 35666:return Uv;case 35674:return Ov;case 35675:return Fv;case 35676:return Bv;case 5124:case 35670:return kv;case 35667:case 35671:return zv;case 35668:case 35672:return Hv;case 35669:case 35673:return Vv;case 5125:return Gv;case 36294:return Wv;case 36295:return Xv;case 36296:return qv;case 35678:case 36198:case 36298:case 36306:case 35682:return Yv;case 35679:case 36299:case 36307:return jv;case 35680:case 36300:case 36308:case 36293:return Zv;case 36289:case 36303:case 36311:case 36292:return Kv}}var bu=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=Lv(t.type)}},Su=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Jv(t.type)}},wu=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let i=this.seq;for(let r=0,o=i.length;r!==o;++r){let a=i[r];a.setValue(e,t[a.id],n)}}},vu=/(\w+)(\])?(\[|\.)?/g;function bp(s,e){s.seq.push(e),s.map[e.id]=e}function Qv(s,e,t){let n=s.name,i=n.length;for(vu.lastIndex=0;;){let r=vu.exec(n),o=vu.lastIndex,a=r[1],l=r[2]==="]",c=r[3];if(l&&(a=a|0),c===void 0||c==="["&&o+2===i){bp(t,c===void 0?new bu(a,s,e):new Su(a,s,e));break}else{let f=t.map[a];f===void 0&&(f=new wu(a),bp(t,f)),t=f}}}var br=class{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let o=0;o<n;++o){let a=e.getActiveUniform(t,o),l=e.getUniformLocation(t,a.name);Qv(a,l,this)}let i=[],r=[];for(let o of this.seq)o.type===e.SAMPLER_2D_SHADOW||o.type===e.SAMPLER_CUBE_SHADOW||o.type===e.SAMPLER_2D_ARRAY_SHADOW?i.push(o):r.push(o);i.length>0&&(this.seq=i.concat(r))}setValue(e,t,n,i){let r=this.map[t];r!==void 0&&r.setValue(e,n,i)}setOptional(e,t,n){let i=t[n];i!==void 0&&this.setValue(e,n,i)}static upload(e,t,n,i){for(let r=0,o=t.length;r!==o;++r){let a=t[r],l=n[a.id];l.needsUpdate!==!1&&a.setValue(e,l.value,i)}}static seqWithValue(e,t){let n=[];for(let i=0,r=e.length;i!==r;++i){let o=e[i];o.id in t&&n.push(o)}return n}};function Sp(s,e,t){let n=s.createShader(e);return s.shaderSource(n,t),s.compileShader(n),n}var $v=37297,ey=0;function ty(s,e){let t=s.split(`
`),n=[],i=Math.max(e-6,0),r=Math.min(e+6,t.length);for(let o=i;o<r;o++){let a=o+1;n.push(`${a===e?">":" "} ${a}: ${t[o]}`)}return n.join(`
`)}var wp=new Qe;function ny(s){tt._getMatrix(wp,tt.workingColorSpace,s);let e=`mat3( ${wp.elements.map(t=>t.toFixed(4))} )`;switch(tt.getTransfer(s)){case jr:return[e,"LinearTransferOETF"];case ht:return[e,"sRGBTransferOETF"];default:return Ge("WebGLProgram: Unsupported color space: ",s),[e,"LinearTransferOETF"]}}function Tp(s,e,t){let n=s.getShaderParameter(e,s.COMPILE_STATUS),r=(s.getShaderInfoLog(e)||"").trim();if(n&&r==="")return"";let o=/ERROR: 0:(\d+)/.exec(r);if(o){let a=parseInt(o[1]);return t.toUpperCase()+`

`+r+`

`+ty(s.getShaderSource(e),a)}else return r}function iy(s,e){let t=ny(e);return[`vec4 ${s}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}var sy={[Lo]:"Linear",[Io]:"Reinhard",[Do]:"Cineon",[No]:"ACESFilmic",[Oo]:"AgX",[Ki]:"Neutral",[Uo]:"Custom"};function ry(s,e){let t=sy[e];return t===void 0?(Ge("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+s+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+s+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}var fc=new D;function oy(){tt.getLuminanceCoefficients(fc);let s=fc.x.toFixed(4),e=fc.y.toFixed(4),t=fc.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${s}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function ay(s){return[s.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",s.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(jo).join(`
`)}function ly(s){let e=[];for(let t in s){let n=s[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function cy(s,e){let t={},n=s.getProgramParameter(e,s.ACTIVE_ATTRIBUTES);for(let i=0;i<n;i++){let r=s.getActiveAttrib(e,i),o=r.name,a=1;r.type===s.FLOAT_MAT2&&(a=2),r.type===s.FLOAT_MAT3&&(a=3),r.type===s.FLOAT_MAT4&&(a=4),t[o]={type:r.type,location:s.getAttribLocation(e,o),locationSize:a}}return t}function jo(s){return s!==""}function Ep(s,e){let t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return s.replace(/NUM_SUN_LIGHTS/g,e.numSunLights).replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,e.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function Ap(s,e){return s.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}var hy=/^[ \t]*#include +<([\w\d./]+)>/gm;function Tu(s){return s.replace(hy,dy)}var uy=new Map;function dy(s,e){let t=st[e];if(t===void 0){let n=uy.get(e);if(n!==void 0)t=st[n],Ge('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+e+">")}return Tu(t)}var fy=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Cp(s){return s.replace(fy,py)}function py(s,e,t,n){let i="";for(let r=parseInt(e);r<parseInt(t);r++)i+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return i}function Rp(s){let e=`precision ${s.precision} float;
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
#define LOW_PRECISION`),e}var my={[Zi]:"SHADOWMAP_TYPE_PCF",[pr]:"SHADOWMAP_TYPE_VSM"};function gy(s){return my[s.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var xy={[Ji]:"ENVMAP_TYPE_CUBE",[Ms]:"ENVMAP_TYPE_CUBE",[Fo]:"ENVMAP_TYPE_CUBE_UV"};function _y(s){return s.envMap===!1?"ENVMAP_TYPE_CUBE":xy[s.envMapMode]||"ENVMAP_TYPE_CUBE"}var vy={[Ms]:"ENVMAP_MODE_REFRACTION"};function yy(s){return s.envMap===!1?"ENVMAP_MODE_REFLECTION":vy[s.envMapMode]||"ENVMAP_MODE_REFLECTION"}var My={[Sl]:"ENVMAP_BLENDING_MULTIPLY",[Vf]:"ENVMAP_BLENDING_MIX",[Gf]:"ENVMAP_BLENDING_ADD"};function by(s){return s.envMap===!1?"ENVMAP_BLENDING_NONE":My[s.combine]||"ENVMAP_BLENDING_NONE"}function Sy(s){let e=s.envMapCubeUVHeight;if(e===null)return null;let t=Math.log2(e)-2,n=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:n,maxMip:t}}function wy(s,e,t,n){let i=s.getContext(),r=t.defines,o=t.vertexShader,a=t.fragmentShader,l=gy(t),c=_y(t),h=yy(t),f=by(t),d=Sy(t),u=ay(t),p=ly(r),x=i.createProgram(),m,g,b=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,p].filter(jo).join(`
`),m.length>0&&(m+=`
`),g=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,p].filter(jo).join(`
`),g.length>0&&(g+=`
`)):(m=[Rp(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,p,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(jo).join(`
`),g=[Rp(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,p,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+h:"",t.envMap?"#define "+f:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.retroreflection?"#define USE_RETROREFLECTION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==wn?"#define TONE_MAPPING":"",t.toneMapping!==wn?st.tonemapping_pars_fragment:"",t.toneMapping!==wn?ry("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",st.colorspace_pars_fragment,iy("linearToOutputTexel",t.outputColorSpace),oy(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(jo).join(`
`)),o=Tu(o),o=Ep(o,t),o=Ap(o,t),a=Tu(a),a=Ep(a,t),a=Ap(a,t),o=Cp(o),a=Cp(a),t.isRawShaderMaterial!==!0&&(b=`#version 300 es
`,m=[u,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,g=["#define varying in",t.glslVersion===iu?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===iu?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+g);let T=b+m+o,_=b+g+a,M=Sp(i,i.VERTEX_SHADER,T),E=Sp(i,i.FRAGMENT_SHADER,_);i.attachShader(x,M),i.attachShader(x,E),t.index0AttributeName!==void 0?i.bindAttribLocation(x,0,t.index0AttributeName):t.hasPositionAttribute===!0&&i.bindAttribLocation(x,0,"position"),i.linkProgram(x);function A(L){if(s.debug.checkShaderErrors){let S=i.getProgramInfoLog(x)||"",w=i.getShaderInfoLog(M)||"",P=i.getShaderInfoLog(E)||"",U=S.trim(),F=w.trim(),O=P.trim(),H=!0,k=!0;if(i.getProgramParameter(x,i.LINK_STATUS)===!1)if(H=!1,typeof s.debug.onShaderError=="function")s.debug.onShaderError(i,x,M,E);else{let W=Tp(i,M,"vertex"),Z=Tp(i,E,"fragment");Ze("WebGLProgram: Shader Error "+i.getError()+" - VALIDATE_STATUS "+i.getProgramParameter(x,i.VALIDATE_STATUS)+`

Material Name: `+L.name+`
Material Type: `+L.type+`

Program Info Log: `+U+`
`+W+`
`+Z)}else U!==""?Ge("WebGLProgram: Program Info Log:",U):(F===""||O==="")&&(k=!1);k&&(L.diagnostics={runnable:H,programLog:U,vertexShader:{log:F,prefix:m},fragmentShader:{log:O,prefix:g}})}i.deleteShader(M),i.deleteShader(E),v=new br(i,x),R=cy(i,x)}let v;this.getUniforms=function(){return v===void 0&&A(this),v};let R;this.getAttributes=function(){return R===void 0&&A(this),R};let N=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return N===!1&&(N=i.getProgramParameter(x,$v)),N},this.destroy=function(){n.releaseStatesOfProgram(this),i.deleteProgram(x),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=ey++,this.cacheKey=e,this.usedTimes=1,this.program=x,this.vertexShader=M,this.fragmentShader=E,this}var Ty=0,Eu=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){let i=this._getShaderCacheForMaterial(e);return i.has(t)===!1&&(i.add(t),t.usedTimes++),i.has(n)===!1&&(i.add(n),n.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);return n===void 0&&(n=new Au(e),t.set(e,n)),n}},Au=class{constructor(e){this.id=Ty++,this.code=e,this.usedTimes=0}};function Ey(s){return s===$i||s===Vo||s===Go}function Ay(s,e,t,n,i,r){let o=new tr,a=new Eu,l=new Set,c=[],h=new Map,f=n.logarithmicDepthBuffer,d=n.precision,u={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function p(v){return l.add(v),v===0?"uv":`uv${v}`}function x(v,R,N,L,S,w){let P=L.fog,U=S.geometry,F=v.isMeshStandardMaterial||v.isMeshLambertMaterial||v.isMeshPhongMaterial?L.environment:null,O=v.isMeshStandardMaterial||v.isMeshLambertMaterial&&!v.envMap||v.isMeshPhongMaterial&&!v.envMap,H=e.get(v.envMap||F,O),k=H&&H.mapping===Fo?H.image.height:null,W=u[v.type];v.precision!==null&&(d=n.getMaxPrecision(v.precision),d!==v.precision&&Ge("WebGLProgram.getParameters:",v.precision,"not supported, using",d,"instead."));let Z=U.morphAttributes.position||U.morphAttributes.normal||U.morphAttributes.color,he=Z!==void 0?Z.length:0,pe=0;U.morphAttributes.position!==void 0&&(pe=1),U.morphAttributes.normal!==void 0&&(pe=2),U.morphAttributes.color!==void 0&&(pe=3);let Ae,we,Pe,q;if(W){let wt=ai[W];Ae=wt.vertexShader,we=wt.fragmentShader}else{Ae=v.vertexShader,we=v.fragmentShader;let wt=a.getVertexShaderStage(v),ft=a.getFragmentShaderStage(v);a.update(v,wt,ft),Pe=wt.id,q=ft.id}let K=s.getRenderTarget(),de=s.state.buffers.depth.getReversed(),De=S.isInstancedMesh===!0,_e=S.isBatchedMesh===!0,ke=!!v.map,et=!!v.matcap,te=!!H,ae=!!v.aoMap,re=!!v.lightMap,oe=!!v.bumpMap&&v.wireframe===!1,le=!!v.normalMap,Be=!!v.displacementMap,Ne=!!v.emissiveMap,Le=!!v.metalnessMap,Ye=!!v.roughnessMap,B=v.anisotropy>0,$e=v.clearcoat>0,Ke=v.dispersion>0,I=v.retroreflectivity>0,y=v.iridescence>0,G=v.sheen>0,X=v.transmission>0,J=B&&!!v.anisotropyMap,ue=$e&&!!v.clearcoatMap,fe=$e&&!!v.clearcoatNormalMap,$=$e&&!!v.clearcoatRoughnessMap,ne=y&&!!v.iridescenceMap,xe=y&&!!v.iridescenceThicknessMap,He=G&&!!v.sheenColorMap,ge=G&&!!v.sheenRoughnessMap,me=!!v.specularMap,Ue=!!v.specularColorMap,We=!!v.specularIntensityMap,Je=X&&!!v.transmissionMap,V=X&&!!v.thicknessMap,ve=!!v.gradientMap,ie=!!v.alphaMap,ye=v.alphaTest>0,Te=!!v.alphaHash,ce=!!v.extensions,Xe=wn;v.toneMapped&&(K===null||K.isXRRenderTarget===!0)&&(Xe=s.toneMapping);let ze={shaderID:W,shaderType:v.type,shaderName:v.name,vertexShader:Ae,fragmentShader:we,defines:v.defines,customVertexShaderID:Pe,customFragmentShaderID:q,isRawShaderMaterial:v.isRawShaderMaterial===!0,glslVersion:v.glslVersion,precision:d,batching:_e,batchingColor:_e&&S._colorsTexture!==null,instancing:De,instancingColor:De&&S.instanceColor!==null,instancingMorph:De&&S.morphTexture!==null,outputColorSpace:K===null?s.outputColorSpace:K.isXRRenderTarget===!0?K.texture.colorSpace:tt.workingColorSpace,alphaToCoverage:!!v.alphaToCoverage,map:ke,matcap:et,envMap:te,envMapMode:te&&H.mapping,envMapCubeUVHeight:k,aoMap:ae,lightMap:re,bumpMap:oe,normalMap:le,displacementMap:Be,emissiveMap:Ne,normalMapObjectSpace:le&&v.normalMapType===Yf,normalMapTangentSpace:le&&v.normalMapType===vr,packedNormalMap:le&&v.normalMapType===vr&&Ey(v.normalMap.format),metalnessMap:Le,roughnessMap:Ye,anisotropy:B,anisotropyMap:J,clearcoat:$e,clearcoatMap:ue,clearcoatNormalMap:fe,clearcoatRoughnessMap:$,dispersion:Ke,retroreflection:I,iridescence:y,iridescenceMap:ne,iridescenceThicknessMap:xe,sheen:G,sheenColorMap:He,sheenRoughnessMap:ge,specularMap:me,specularColorMap:Ue,specularIntensityMap:We,transmission:X,transmissionMap:Je,thicknessMap:V,gradientMap:ve,opaque:v.transparent===!1&&v.blending===mr&&v.alphaToCoverage===!1,alphaMap:ie,alphaTest:ye,alphaHash:Te,combine:v.combine,mapUv:ke&&p(v.map.channel),aoMapUv:ae&&p(v.aoMap.channel),lightMapUv:re&&p(v.lightMap.channel),bumpMapUv:oe&&p(v.bumpMap.channel),normalMapUv:le&&p(v.normalMap.channel),displacementMapUv:Be&&p(v.displacementMap.channel),emissiveMapUv:Ne&&p(v.emissiveMap.channel),metalnessMapUv:Le&&p(v.metalnessMap.channel),roughnessMapUv:Ye&&p(v.roughnessMap.channel),anisotropyMapUv:J&&p(v.anisotropyMap.channel),clearcoatMapUv:ue&&p(v.clearcoatMap.channel),clearcoatNormalMapUv:fe&&p(v.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:$&&p(v.clearcoatRoughnessMap.channel),iridescenceMapUv:ne&&p(v.iridescenceMap.channel),iridescenceThicknessMapUv:xe&&p(v.iridescenceThicknessMap.channel),sheenColorMapUv:He&&p(v.sheenColorMap.channel),sheenRoughnessMapUv:ge&&p(v.sheenRoughnessMap.channel),specularMapUv:me&&p(v.specularMap.channel),specularColorMapUv:Ue&&p(v.specularColorMap.channel),specularIntensityMapUv:We&&p(v.specularIntensityMap.channel),transmissionMapUv:Je&&p(v.transmissionMap.channel),thicknessMapUv:V&&p(v.thicknessMap.channel),alphaMapUv:ie&&p(v.alphaMap.channel),vertexTangents:!!U.attributes.tangent&&(le||B),vertexNormals:!!U.attributes.normal,vertexColors:v.vertexColors,vertexAlphas:v.vertexColors===!0&&!!U.attributes.color&&U.attributes.color.itemSize===4,pointsUvs:S.isPoints===!0&&!!U.attributes.uv&&(ke||ie),fog:!!P,useFog:v.fog===!0,fogExp2:!!P&&P.isFogExp2,flatShading:v.wireframe===!1&&(v.flatShading===!0||U.attributes.normal===void 0&&le===!1&&(v.isMeshLambertMaterial||v.isMeshPhongMaterial||v.isMeshStandardMaterial||v.isMeshPhysicalMaterial)),sizeAttenuation:v.sizeAttenuation===!0,logarithmicDepthBuffer:f,reversedDepthBuffer:de,skinning:S.isSkinnedMesh===!0,hasPositionAttribute:U.attributes.position!==void 0,morphTargets:U.morphAttributes.position!==void 0,morphNormals:U.morphAttributes.normal!==void 0,morphColors:U.morphAttributes.color!==void 0,morphTargetsCount:he,morphTextureStride:pe,numSunLights:R.sun.length,numDirLights:R.directional.length,numPointLights:R.point.length,numSpotLights:R.spot.length,numSpotLightMaps:R.spotLightMap.length,numRectAreaLights:R.rectArea.length,numHemiLights:R.hemi.length,numSunLightShadows:R.sunShadowMap.length,numDirLightShadows:R.directionalShadowMap.length,numPointLightShadows:R.pointShadowMap.length,numSpotLightShadows:R.spotShadowMap.length,numSpotLightShadowsWithMaps:R.numSpotLightShadowsWithMaps,numLightProbes:R.numLightProbes,numLightProbeGrids:w.length,numClippingPlanes:r.numPlanes,numClipIntersection:r.numIntersection,dithering:v.dithering,shadowMapEnabled:s.shadowMap.enabled&&N.length>0,shadowMapType:s.shadowMap.type,toneMapping:Xe,decodeVideoTexture:ke&&v.map.isVideoTexture===!0&&tt.getTransfer(v.map.colorSpace)===ht,decodeVideoTextureEmissive:Ne&&v.emissiveMap.isVideoTexture===!0&&tt.getTransfer(v.emissiveMap.colorSpace)===ht,premultipliedAlpha:v.premultipliedAlpha,doubleSided:v.side===Ot,flipSided:v.side===en,useDepthPacking:v.depthPacking>=0,depthPacking:v.depthPacking||0,index0AttributeName:v.index0AttributeName,extensionClipCullDistance:ce&&v.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(ce&&v.extensions.multiDraw===!0||_e)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:v.customProgramCacheKey()};return ze.vertexUv1s=l.has(1),ze.vertexUv2s=l.has(2),ze.vertexUv3s=l.has(3),l.clear(),ze}function m(v){let R=[];if(v.shaderID?R.push(v.shaderID):(R.push(v.customVertexShaderID),R.push(v.customFragmentShaderID)),v.defines!==void 0)for(let N in v.defines)R.push(N),R.push(v.defines[N]);return v.isRawShaderMaterial===!1&&(g(R,v),b(R,v),R.push(s.outputColorSpace)),R.push(v.customProgramCacheKey),R.join()}function g(v,R){v.push(R.precision),v.push(R.outputColorSpace),v.push(R.envMapMode),v.push(R.envMapCubeUVHeight),v.push(R.mapUv),v.push(R.alphaMapUv),v.push(R.lightMapUv),v.push(R.aoMapUv),v.push(R.bumpMapUv),v.push(R.normalMapUv),v.push(R.displacementMapUv),v.push(R.emissiveMapUv),v.push(R.metalnessMapUv),v.push(R.roughnessMapUv),v.push(R.anisotropyMapUv),v.push(R.clearcoatMapUv),v.push(R.clearcoatNormalMapUv),v.push(R.clearcoatRoughnessMapUv),v.push(R.iridescenceMapUv),v.push(R.iridescenceThicknessMapUv),v.push(R.sheenColorMapUv),v.push(R.sheenRoughnessMapUv),v.push(R.specularMapUv),v.push(R.specularColorMapUv),v.push(R.specularIntensityMapUv),v.push(R.transmissionMapUv),v.push(R.thicknessMapUv),v.push(R.combine),v.push(R.fogExp2),v.push(R.sizeAttenuation),v.push(R.morphTargetsCount),v.push(R.morphAttributeCount),v.push(R.numSunLights),v.push(R.numDirLights),v.push(R.numPointLights),v.push(R.numSpotLights),v.push(R.numSpotLightMaps),v.push(R.numHemiLights),v.push(R.numRectAreaLights),v.push(R.numSunLightShadows),v.push(R.numDirLightShadows),v.push(R.numPointLightShadows),v.push(R.numSpotLightShadows),v.push(R.numSpotLightShadowsWithMaps),v.push(R.numLightProbes),v.push(R.shadowMapType),v.push(R.toneMapping),v.push(R.numClippingPlanes),v.push(R.numClipIntersection),v.push(R.depthPacking)}function b(v,R){o.disableAll(),R.instancing&&o.enable(0),R.instancingColor&&o.enable(1),R.instancingMorph&&o.enable(2),R.matcap&&o.enable(3),R.envMap&&o.enable(4),R.normalMapObjectSpace&&o.enable(5),R.normalMapTangentSpace&&o.enable(6),R.clearcoat&&o.enable(7),R.iridescence&&o.enable(8),R.alphaTest&&o.enable(9),R.vertexColors&&o.enable(10),R.vertexAlphas&&o.enable(11),R.vertexUv1s&&o.enable(12),R.vertexUv2s&&o.enable(13),R.vertexUv3s&&o.enable(14),R.vertexTangents&&o.enable(15),R.anisotropy&&o.enable(16),R.alphaHash&&o.enable(17),R.batching&&o.enable(18),R.dispersion&&o.enable(19),R.retroreflection&&o.enable(24),R.batchingColor&&o.enable(20),R.gradientMap&&o.enable(21),R.packedNormalMap&&o.enable(22),R.vertexNormals&&o.enable(23),v.push(o.mask),o.disableAll(),R.fog&&o.enable(0),R.useFog&&o.enable(1),R.flatShading&&o.enable(2),R.logarithmicDepthBuffer&&o.enable(3),R.reversedDepthBuffer&&o.enable(4),R.skinning&&o.enable(5),R.morphTargets&&o.enable(6),R.morphNormals&&o.enable(7),R.morphColors&&o.enable(8),R.premultipliedAlpha&&o.enable(9),R.shadowMapEnabled&&o.enable(10),R.doubleSided&&o.enable(11),R.flipSided&&o.enable(12),R.useDepthPacking&&o.enable(13),R.dithering&&o.enable(14),R.transmission&&o.enable(15),R.sheen&&o.enable(16),R.opaque&&o.enable(17),R.pointsUvs&&o.enable(18),R.decodeVideoTexture&&o.enable(19),R.decodeVideoTextureEmissive&&o.enable(20),R.alphaToCoverage&&o.enable(21),R.numLightProbeGrids>0&&o.enable(22),R.hasPositionAttribute&&o.enable(23),v.push(o.mask)}function T(v){let R=u[v.type],N;if(R){let L=ai[R];N=zt.clone(L.uniforms)}else N=v.uniforms;return N}function _(v,R){let N=h.get(R);return N!==void 0?++N.usedTimes:(N=new wy(s,R,v,i),c.push(N),h.set(R,N)),N}function M(v){if(--v.usedTimes===0){let R=c.indexOf(v);c[R]=c[c.length-1],c.pop(),h.delete(v.cacheKey),v.destroy()}}function E(v){a.remove(v)}function A(){a.dispose()}return{getParameters:x,getProgramCacheKey:m,getUniforms:T,acquireProgram:_,releaseProgram:M,releaseShaderCache:E,programs:c,dispose:A}}function Cy(){let s=new WeakMap;function e(o){return s.has(o)}function t(o){let a=s.get(o);return a===void 0&&(a={},s.set(o,a)),a}function n(o){s.delete(o)}function i(o,a,l){s.get(o)[a]=l}function r(){s=new WeakMap}return{has:e,get:t,remove:n,update:i,dispose:r}}function Ry(s,e){return s.groupOrder!==e.groupOrder?s.groupOrder-e.groupOrder:s.renderOrder!==e.renderOrder?s.renderOrder-e.renderOrder:s.material.id!==e.material.id?s.material.id-e.material.id:s.materialVariant!==e.materialVariant?s.materialVariant-e.materialVariant:s.z!==e.z?s.z-e.z:s.id-e.id}function Pp(s,e){return s.groupOrder!==e.groupOrder?s.groupOrder-e.groupOrder:s.renderOrder!==e.renderOrder?s.renderOrder-e.renderOrder:s.z!==e.z?e.z-s.z:s.id-e.id}function Lp(){let s=[],e=0,t=[],n=[],i=[];function r(){e=0,t.length=0,n.length=0,i.length=0}function o(d){let u=0;return d.isInstancedMesh&&(u+=2),d.isSkinnedMesh&&(u+=1),u}function a(d,u,p,x,m,g){let b=s[e];return b===void 0?(b={id:d.id,object:d,geometry:u,material:p,materialVariant:o(d),groupOrder:x,renderOrder:d.renderOrder,z:m,group:g},s[e]=b):(b.id=d.id,b.object=d,b.geometry=u,b.material=p,b.materialVariant=o(d),b.groupOrder=x,b.renderOrder=d.renderOrder,b.z=m,b.group=g),e++,b}function l(d,u,p,x,m,g,b){b.reversedDepth===!0&&(m=-m);let T=a(d,u,p,x,m,g);p.transmission>0?n.push(T):p.transparent===!0?i.push(T):t.push(T)}function c(d,u,p,x,m,g){let b=a(d,u,p,x,m,g);p.transmission>0?n.unshift(b):p.transparent===!0?i.unshift(b):t.unshift(b)}function h(d,u){t.length>1&&t.sort(d||Ry),n.length>1&&n.sort(u||Pp),i.length>1&&i.sort(u||Pp)}function f(){for(let d=e,u=s.length;d<u;d++){let p=s[d];if(p.id===null)break;p.id=null,p.object=null,p.geometry=null,p.material=null,p.group=null}}return{opaque:t,transmissive:n,transparent:i,init:r,push:l,unshift:c,finish:f,sort:h}}function Py(){let s=new WeakMap;function e(n,i){let r=s.get(n),o;return r===void 0?(o=new Lp,s.set(n,[o])):i>=r.length?(o=new Lp,r.push(o)):o=r[i],o}function t(){s=new WeakMap}return{get:e,dispose:t}}function Ly(){let s={};return{get:function(e){if(s[e.id]!==void 0)return s[e.id];let t;switch(e.type){case"SunLight":case"DirectionalLight":t={direction:new D,color:new Ee};break;case"SpotLight":t={position:new D,direction:new D,color:new Ee,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new D,color:new Ee,distance:0,decay:0};break;case"HemisphereLight":t={direction:new D,skyColor:new Ee,groundColor:new Ee};break;case"RectAreaLight":t={color:new Ee,position:new D,halfWidth:new D,halfHeight:new D};break}return s[e.id]=t,t}}}function Iy(){let s={};return{get:function(e){if(s[e.id]!==void 0)return s[e.id];let t;switch(e.type){case"SunLight":case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ee};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ee};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ee,shadowCameraNear:1,shadowCameraFar:1e3};break}return s[e.id]=t,t}}}var Dy=0;function Ny(s,e){return(e.castShadow?2:0)-(s.castShadow?2:0)+(e.map?1:0)-(s.map?1:0)}function Uy(s){let e=new Ly,t=Iy(),n={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new D);let i=new D,r=new je,o=new je;function a(c){let h=0,f=0,d=0;for(let S=0;S<9;S++)n.probe[S].set(0,0,0);let u=0,p=0,x=0,m=0,g=0,b=0,T=0,_=0,M=0,E=0,A=0,v=0,R=0,N=0;c.sort(Ny);for(let S=0,w=c.length;S<w;S++){let P=c[S],U=P.color,F=P.intensity,O=P.distance,H=null;if(P.shadow&&P.shadow.map&&(P.shadow.map.texture.format===$i?H=P.shadow.map.texture:H=P.shadow.map.depthTexture||P.shadow.map.texture),P.isAmbientLight)h+=U.r*F,f+=U.g*F,d+=U.b*F;else if(P.isLightProbe){for(let k=0;k<9;k++)n.probe[k].addScaledVector(P.sh.coefficients[k],F);N++}else if(P.isSunLight){let k=e.get(P);if(k.color.copy(P.color).multiplyScalar(P.intensity),P.castShadow){let W=P.shadow,Z=t.get(P);Z.shadowIntensity=W.intensity,Z.shadowBias=W.bias,Z.shadowNormalBias=W.normalBias,Z.shadowRadius=W.radius,Z.shadowMapSize.copy(W.mapSize).multiply(W.getFrameExtents()),n.sunShadow[p]=Z,n.sunShadowMap[p]=H;let he=W.getViewportCount();for(let pe=0;pe<he;pe++)n.sunShadowMatrix[x+pe]=W.getMatrix(pe),n.sunShadowCascade[x+pe]=W._cascadeData[pe];x+=he,p++}n.sun[u]=k,u++}else if(P.isDirectionalLight){let k=e.get(P);if(k.color.copy(P.color).multiplyScalar(P.intensity),P.castShadow){let W=P.shadow,Z=t.get(P);Z.shadowIntensity=W.intensity,Z.shadowBias=W.bias,Z.shadowNormalBias=W.normalBias,Z.shadowRadius=W.radius,Z.shadowMapSize=W.mapSize,n.directionalShadow[m]=Z,n.directionalShadowMap[m]=H,n.directionalShadowMatrix[m]=P.shadow.matrix,M++}n.directional[m]=k,m++}else if(P.isSpotLight){let k=e.get(P);k.position.setFromMatrixPosition(P.matrixWorld),k.color.copy(U).multiplyScalar(F),k.distance=O,k.coneCos=Math.cos(P.angle),k.penumbraCos=Math.cos(P.angle*(1-P.penumbra)),k.decay=P.decay,n.spot[b]=k;let W=P.shadow;if(P.map&&(n.spotLightMap[v]=P.map,v++,W.updateMatrices(P),P.castShadow&&R++),n.spotLightMatrix[b]=W.matrix,P.castShadow){let Z=t.get(P);Z.shadowIntensity=W.intensity,Z.shadowBias=W.bias,Z.shadowNormalBias=W.normalBias,Z.shadowRadius=W.radius,Z.shadowMapSize=W.mapSize,n.spotShadow[b]=Z,n.spotShadowMap[b]=H,A++}b++}else if(P.isRectAreaLight){let k=e.get(P);k.color.copy(U).multiplyScalar(F),k.halfWidth.set(P.width*.5,0,0),k.halfHeight.set(0,P.height*.5,0),n.rectArea[T]=k,T++}else if(P.isPointLight){let k=e.get(P);if(k.color.copy(P.color).multiplyScalar(P.intensity),k.distance=P.distance,k.decay=P.decay,P.castShadow){let W=P.shadow,Z=t.get(P);Z.shadowIntensity=W.intensity,Z.shadowBias=W.bias,Z.shadowNormalBias=W.normalBias,Z.shadowRadius=W.radius,Z.shadowMapSize=W.mapSize,Z.shadowCameraNear=W.camera.near,Z.shadowCameraFar=W.camera.far,n.pointShadow[g]=Z,n.pointShadowMap[g]=H,n.pointShadowMatrix[g]=P.shadow.matrix,E++}n.point[g]=k,g++}else if(P.isHemisphereLight){let k=e.get(P);k.skyColor.copy(P.color).multiplyScalar(F),k.groundColor.copy(P.groundColor).multiplyScalar(F),n.hemi[_]=k,_++}}T>0&&(s.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=Me.LTC_FLOAT_1,n.rectAreaLTC2=Me.LTC_FLOAT_2):(n.rectAreaLTC1=Me.LTC_HALF_1,n.rectAreaLTC2=Me.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=f,n.ambient[2]=d;let L=n.hash;(L.sunLength!==u||L.directionalLength!==m||L.pointLength!==g||L.spotLength!==b||L.rectAreaLength!==T||L.hemiLength!==_||L.numSunShadows!==p||L.numDirectionalShadows!==M||L.numPointShadows!==E||L.numSpotShadows!==A||L.numSpotMaps!==v||L.numLightProbes!==N)&&(n.sun.length=u,n.directional.length=m,n.spot.length=b,n.rectArea.length=T,n.point.length=g,n.hemi.length=_,n.sunShadow.length=p,n.sunShadowMap.length=p,n.sunShadowMatrix.length=x,n.sunShadowCascade.length=x,n.directionalShadow.length=M,n.directionalShadowMap.length=M,n.directionalShadowMatrix.length=M,n.pointShadow.length=E,n.pointShadowMap.length=E,n.pointShadowMatrix.length=E,n.spotShadow.length=A,n.spotShadowMap.length=A,n.spotLightMatrix.length=A+v-R,n.spotLightMap.length=v,n.numSpotLightShadowsWithMaps=R,n.numLightProbes=N,L.sunLength=u,L.directionalLength=m,L.pointLength=g,L.spotLength=b,L.rectAreaLength=T,L.hemiLength=_,L.numSunShadows=p,L.numDirectionalShadows=M,L.numPointShadows=E,L.numSpotShadows=A,L.numSpotMaps=v,L.numLightProbes=N,n.version=Dy++)}function l(c,h){let f=0,d=0,u=0,p=0,x=0,m=0,g=h.matrixWorldInverse;for(let b=0,T=c.length;b<T;b++){let _=c[b];if(_.isSunLight){let M=n.sun[f];M.direction.setFromMatrixPosition(_.matrixWorld),M.direction.transformDirection(g),f++}else if(_.isDirectionalLight){let M=n.directional[d];M.direction.setFromMatrixPosition(_.matrixWorld),i.setFromMatrixPosition(_.target.matrixWorld),M.direction.sub(i),M.direction.transformDirection(g),d++}else if(_.isSpotLight){let M=n.spot[p];M.position.setFromMatrixPosition(_.matrixWorld),M.position.applyMatrix4(g),M.direction.setFromMatrixPosition(_.matrixWorld),i.setFromMatrixPosition(_.target.matrixWorld),M.direction.sub(i),M.direction.transformDirection(g),p++}else if(_.isRectAreaLight){let M=n.rectArea[x];M.position.setFromMatrixPosition(_.matrixWorld),M.position.applyMatrix4(g),o.identity(),r.copy(_.matrixWorld),r.premultiply(g),o.extractRotation(r),M.halfWidth.set(_.width*.5,0,0),M.halfHeight.set(0,_.height*.5,0),M.halfWidth.applyMatrix4(o),M.halfHeight.applyMatrix4(o),x++}else if(_.isPointLight){let M=n.point[u];M.position.setFromMatrixPosition(_.matrixWorld),M.position.applyMatrix4(g),u++}else if(_.isHemisphereLight){let M=n.hemi[m];M.direction.setFromMatrixPosition(_.matrixWorld),M.direction.transformDirection(g),m++}}}return{setup:a,setupView:l,state:n}}function Ip(s){let e=new Uy(s),t=[],n=[],i=[];function r(d){f.camera=d,t.length=0,n.length=0,i.length=0}function o(d){t.push(d)}function a(d){n.push(d)}function l(d){i.push(d)}function c(){e.setup(t)}function h(d){e.setupView(t,d)}let f={lightsArray:t,shadowsArray:n,lightProbeGridArray:i,camera:null,lights:e,transmissionRenderTarget:{},textureUnits:0};return{init:r,state:f,setupLights:c,setupLightsView:h,pushLight:o,pushShadow:a,pushLightProbeGrid:l}}function Oy(s){let e=new WeakMap;function t(i,r=0){let o=e.get(i),a;return o===void 0?(a=new Ip(s),e.set(i,[a])):r>=o.length?(a=new Ip(s),o.push(a)):a=o[r],a}function n(){e=new WeakMap}return{get:t,dispose:n}}var Fy=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,By=`uniform sampler2D shadow_pass;
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
}`,ky=[new D(1,0,0),new D(-1,0,0),new D(0,1,0),new D(0,-1,0),new D(0,0,1),new D(0,0,-1)],zy=[new D(0,-1,0),new D(0,-1,0),new D(0,0,1),new D(0,0,-1),new D(0,-1,0),new D(0,-1,0)],Dp=new je,Yo=new D,yu=new D;function Hy(s,e,t){let n=new or,i=new ee,r=new ee,o=new ut,a=new hl,l=new ul,c={},h=t.maxTextureSize,f={[si]:en,[en]:si,[Ot]:Ot},d=new ct({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new ee},radius:{value:4}},vertexShader:Fy,fragmentShader:By}),u=d.clone();u.defines.HORIZONTAL_PASS=1;let p=new _t;p.setAttribute("position",new Pt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let x=new Re(p,d),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Zi;let g=this.type;this.render=function(E,A,v){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||E.length===0)return;this.type===Af&&(Ge("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead."),this.type=Zi);let R=s.getRenderTarget(),N=s.getActiveCubeFace(),L=s.getActiveMipmapLevel(),S=s.state;S.setBlending(kt),S.buffers.depth.getReversed()===!0?S.buffers.color.setClear(0,0,0,0):S.buffers.color.setClear(1,1,1,1),S.buffers.depth.setTest(!0),S.setScissorTest(!1);let w=g!==this.type;w&&A.traverse(function(P){P.material&&(Array.isArray(P.material)?P.material.forEach(U=>U.needsUpdate=!0):P.material.needsUpdate=!0)});for(let P=0,U=E.length;P<U;P++){let F=E[P],O=F.shadow;if(O===void 0){Ge("WebGLShadowMap:",F,"has no shadow.");continue}if(O.autoUpdate===!1&&O.needsUpdate===!1)continue;i.copy(O.mapSize);let H=O.getFrameExtents();i.multiply(H),r.copy(O.mapSize),(i.x>h||i.y>h)&&(i.x>h&&(r.x=Math.floor(h/H.x),i.x=r.x*H.x,O.mapSize.x=r.x),i.y>h&&(r.y=Math.floor(h/H.y),i.y=r.y*H.y,O.mapSize.y=r.y));let k=s.state.buffers.depth.getReversed();if(O.camera._reversedDepth=k,O.map===null||w===!0){if(O.map!==null&&(O.map.depthTexture!==null&&(O.map.depthTexture.dispose(),O.map.depthTexture=null),O.map.dispose()),this.type===pr){if(F.isPointLight){Ge("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}O.map=new dt(i.x,i.y,{format:$i,type:St,minFilter:It,magFilter:It,generateMipmaps:!1}),O.map.texture.name=F.name+".shadowMap",O.map.depthTexture=new ti(i.x,i.y,Tn),O.map.depthTexture.name=F.name+".shadowMapDepth",O.map.depthTexture.format=Jn,O.map.depthTexture.compareFunction=null,O.map.depthTexture.minFilter=bt,O.map.depthTexture.magFilter=bt}else F.isPointLight?(O.map=new pc(i.x),O.map.depthTexture=new il(i.x,Wn)):(O.map=new dt(i.x,i.y),O.map.depthTexture=new ti(i.x,i.y,Wn)),O.map.depthTexture.name=F.name+".shadowMap",O.map.depthTexture.format=Jn,this.type===Zi?(O.map.depthTexture.compareFunction=k?uc:hc,O.map.depthTexture.minFilter=It,O.map.depthTexture.magFilter=It):(O.map.depthTexture.compareFunction=null,O.map.depthTexture.minFilter=bt,O.map.depthTexture.magFilter=bt);O.camera.updateProjectionMatrix()}O.map.isWebGLCubeRenderTarget!==!0&&(O.map.width!==i.x||O.map.height!==i.y)&&O.map.setSize(i.x,i.y);let W=O.map.isWebGLCubeRenderTarget?6:O.getViewportCount();F.isPointLight!==!0&&O.updateMatrices(F,v);for(let Z=0;Z<W;Z++){let he=O.getCamera(Z);if(F.isPointLight){let pe=O.camera,Ae=O.matrix,we=F.distance||pe.far;we!==pe.far&&(pe.far=we,pe.updateProjectionMatrix()),Yo.setFromMatrixPosition(F.matrixWorld),pe.position.copy(Yo),yu.copy(pe.position),yu.add(ky[Z]),pe.up.copy(zy[Z]),pe.lookAt(yu),pe.updateMatrixWorld(),Ae.makeTranslation(-Yo.x,-Yo.y,-Yo.z),Dp.multiplyMatrices(pe.projectionMatrix,pe.matrixWorldInverse),O._frustum.setFromProjectionMatrix(Dp,pe.coordinateSystem,pe.reversedDepth)}if(O.map.isWebGLCubeRenderTarget)s.setRenderTarget(O.map,Z),s.clear();else{Z===0&&(s.setRenderTarget(O.map),s.clear());let pe=O.getViewport(Z);o.set(r.x*pe.x,r.y*pe.y,r.x*pe.z,r.y*pe.w),S.viewport(o)}n=O.getFrustum(Z),_(A,v,he,F,this.type)}O.isPointLightShadow!==!0&&this.type===pr&&b(O,v),O.needsUpdate=!1}g=this.type,m.needsUpdate=!1,s.setRenderTarget(R,N,L)};function b(E,A){let v=e.update(x);d.defines.VSM_SAMPLES!==E.blurSamples&&(d.defines.VSM_SAMPLES=E.blurSamples,u.defines.VSM_SAMPLES=E.blurSamples,d.needsUpdate=!0,u.needsUpdate=!0),E.mapPass===null?E.mapPass=new dt(i.x,i.y,{format:$i,type:St}):(E.mapPass.width!==E.map.width||E.mapPass.height!==E.map.height)&&E.mapPass.setSize(E.map.width,E.map.height),d.uniforms.shadow_pass.value=E.map.depthTexture,d.uniforms.resolution.value.set(E.map.width,E.map.height),d.uniforms.radius.value=E.radius,s.setRenderTarget(E.mapPass),s.clear(),s.renderBufferDirect(A,null,v,d,x,null),u.uniforms.shadow_pass.value=E.mapPass.texture,u.uniforms.resolution.value.set(E.map.width,E.map.height),u.uniforms.radius.value=E.radius,s.setRenderTarget(E.map),s.clear(),s.renderBufferDirect(A,null,v,u,x,null)}function T(E,A,v,R){let N=null,L=v.isPointLight===!0?E.customDistanceMaterial:E.customDepthMaterial;if(L!==void 0)N=L;else if(N=v.isPointLight===!0?l:a,s.localClippingEnabled&&A.clipShadows===!0&&Array.isArray(A.clippingPlanes)&&A.clippingPlanes.length!==0||A.displacementMap&&A.displacementScale!==0||A.alphaMap&&A.alphaTest>0||A.map&&A.alphaTest>0||A.alphaToCoverage===!0){let S=N.uuid,w=A.uuid,P=c[S];P===void 0&&(P={},c[S]=P);let U=P[w];U===void 0&&(U=N.clone(),P[w]=U,A.addEventListener("dispose",M)),N=U}if(N.visible=A.visible,N.wireframe=A.wireframe,R===pr?N.side=A.shadowSide!==null?A.shadowSide:A.side:N.side=A.shadowSide!==null?A.shadowSide:f[A.side],N.alphaMap=A.alphaMap,N.alphaTest=A.alphaToCoverage===!0?.5:A.alphaTest,N.map=A.map,N.clipShadows=A.clipShadows,N.clippingPlanes=A.clippingPlanes,N.clipIntersection=A.clipIntersection,N.displacementMap=A.displacementMap,N.displacementScale=A.displacementScale,N.displacementBias=A.displacementBias,N.wireframeLinewidth=A.wireframeLinewidth,N.linewidth=A.linewidth,v.isPointLight===!0&&N.isMeshDistanceMaterial===!0){let S=s.properties.get(N);S.light=v}return N}function _(E,A,v,R,N){if(E.visible===!1)return;if(E.layers.test(A.layers)&&(E.isMesh||E.isLine||E.isPoints)&&(E.castShadow||E.receiveShadow&&N===pr)&&(!E.frustumCulled||E.intersectsFrustum(n))){E.modelViewMatrix.multiplyMatrices(v.matrixWorldInverse,E.matrixWorld);let w=e.update(E),P=E.material;if(Array.isArray(P)){let U=w.groups;for(let F=0,O=U.length;F<O;F++){let H=U[F],k=P[H.materialIndex];if(k&&k.visible){let W=T(E,k,R,N);E.onBeforeShadow(s,E,A,v,w,W,H),s.renderBufferDirect(v,null,w,W,E,H),E.onAfterShadow(s,E,A,v,w,W,H)}}}else if(P.visible){let U=T(E,P,R,N);E.onBeforeShadow(s,E,A,v,w,U,null),s.renderBufferDirect(v,null,w,U,E,null),E.onAfterShadow(s,E,A,v,w,U,null)}}let S=E.children;for(let w=0,P=S.length;w<P;w++)_(S[w],A,v,R,N)}function M(E){E.target.removeEventListener("dispose",M);for(let v in c){let R=c[v],N=E.target.uuid;N in R&&(R[N].dispose(),delete R[N])}}}function Vy(s,e){function t(){let V=!1,ve=new ut,ie=null,ye=new ut(0,0,0,0);return{setMask:function(Te){ie!==Te&&!V&&(s.colorMask(Te,Te,Te,Te),ie=Te)},setLocked:function(Te){V=Te},setClear:function(Te,ce,Xe,ze,wt){wt===!0&&(Te*=ze,ce*=ze,Xe*=ze),ve.set(Te,ce,Xe,ze),ye.equals(ve)===!1&&(s.clearColor(Te,ce,Xe,ze),ye.copy(ve))},reset:function(){V=!1,ie=null,ye.set(-1,0,0,0)}}}function n(){let V=!1,ve=!1,ie=null,ye=null,Te=null;return{setReversed:function(ce){if(ve!==ce){let Xe=e.get("EXT_clip_control");ce?Xe.clipControlEXT(Xe.LOWER_LEFT_EXT,Xe.ZERO_TO_ONE_EXT):Xe.clipControlEXT(Xe.LOWER_LEFT_EXT,Xe.NEGATIVE_ONE_TO_ONE_EXT),ve=ce;let ze=Te;Te=null,this.setClear(ze)}},getReversed:function(){return ve},setTest:function(ce){ce?K(s.DEPTH_TEST):de(s.DEPTH_TEST)},setMask:function(ce){ie!==ce&&!V&&(s.depthMask(ce),ie=ce)},setFunc:function(ce){if(ve&&(ce=sp[ce]),ye!==ce){switch(ce){case Xa:s.depthFunc(s.NEVER);break;case qa:s.depthFunc(s.ALWAYS);break;case Ya:s.depthFunc(s.LESS);break;case Zs:s.depthFunc(s.LEQUAL);break;case ja:s.depthFunc(s.EQUAL);break;case Za:s.depthFunc(s.GEQUAL);break;case Ka:s.depthFunc(s.GREATER);break;case Ja:s.depthFunc(s.NOTEQUAL);break;default:s.depthFunc(s.LEQUAL)}ye=ce}},setLocked:function(ce){V=ce},setClear:function(ce){Te!==ce&&(Te=ce,ve&&(ce=1-ce),s.clearDepth(ce))},reset:function(){V=!1,ie=null,ye=null,Te=null,ve=!1}}}function i(){let V=!1,ve=null,ie=null,ye=null,Te=null,ce=null,Xe=null,ze=null,wt=null;return{setTest:function(ft){V||(ft?K(s.STENCIL_TEST):de(s.STENCIL_TEST))},setMask:function(ft){ve!==ft&&!V&&(s.stencilMask(ft),ve=ft)},setFunc:function(ft,Un,qn){(ie!==ft||ye!==Un||Te!==qn)&&(s.stencilFunc(ft,Un,qn),ie=ft,ye=Un,Te=qn)},setOp:function(ft,Un,qn){(ce!==ft||Xe!==Un||ze!==qn)&&(s.stencilOp(ft,Un,qn),ce=ft,Xe=Un,ze=qn)},setLocked:function(ft){V=ft},setClear:function(ft){wt!==ft&&(s.clearStencil(ft),wt=ft)},reset:function(){V=!1,ve=null,ie=null,ye=null,Te=null,ce=null,Xe=null,ze=null,wt=null}}}let r=new t,o=new n,a=new i,l=new WeakMap,c=new WeakMap,h={},f={},d={},u=new WeakMap,p=[],x=null,m=!1,g=null,b=null,T=null,_=null,M=null,E=null,A=null,v=new Ee(0,0,0),R=0,N=!1,L=null,S=null,w=null,P=null,U=null,F=s.getParameter(s.MAX_COMBINED_TEXTURE_IMAGE_UNITS),O=!1,H=0,k=s.getParameter(s.VERSION);k.indexOf("WebGL")!==-1?(H=parseFloat(/^WebGL (\d)/.exec(k)[1]),O=H>=1):k.indexOf("OpenGL ES")!==-1&&(H=parseFloat(/^OpenGL ES (\d)/.exec(k)[1]),O=H>=2);let W=null,Z={},he=s.getParameter(s.SCISSOR_BOX),pe=s.getParameter(s.VIEWPORT),Ae=new ut().fromArray(he),we=new ut().fromArray(pe);function Pe(V,ve,ie,ye){let Te=new Uint8Array(4),ce=s.createTexture();s.bindTexture(V,ce),s.texParameteri(V,s.TEXTURE_MIN_FILTER,s.NEAREST),s.texParameteri(V,s.TEXTURE_MAG_FILTER,s.NEAREST);for(let Xe=0;Xe<ie;Xe++)V===s.TEXTURE_3D||V===s.TEXTURE_2D_ARRAY?s.texImage3D(ve,0,s.RGBA,1,1,ye,0,s.RGBA,s.UNSIGNED_BYTE,Te):s.texImage2D(ve+Xe,0,s.RGBA,1,1,0,s.RGBA,s.UNSIGNED_BYTE,Te);return ce}let q={};q[s.TEXTURE_2D]=Pe(s.TEXTURE_2D,s.TEXTURE_2D,1),q[s.TEXTURE_CUBE_MAP]=Pe(s.TEXTURE_CUBE_MAP,s.TEXTURE_CUBE_MAP_POSITIVE_X,6),q[s.TEXTURE_2D_ARRAY]=Pe(s.TEXTURE_2D_ARRAY,s.TEXTURE_2D_ARRAY,1,1),q[s.TEXTURE_3D]=Pe(s.TEXTURE_3D,s.TEXTURE_3D,1,1),r.setClear(0,0,0,1),o.setClear(1),a.setClear(0),K(s.DEPTH_TEST),o.setFunc(Zs),oe(!1),le(Gh),K(s.CULL_FACE),ae(kt);function K(V){h[V]!==!0&&(s.enable(V),h[V]=!0)}function de(V){h[V]!==!1&&(s.disable(V),h[V]=!1)}function De(V,ve){return d[V]!==ve?(s.bindFramebuffer(V,ve),d[V]=ve,V===s.DRAW_FRAMEBUFFER&&(d[s.FRAMEBUFFER]=ve),V===s.FRAMEBUFFER&&(d[s.DRAW_FRAMEBUFFER]=ve),!0):!1}function _e(V,ve){let ie=p,ye=!1;if(V){ie=u.get(ve),ie===void 0&&(ie=[],u.set(ve,ie));let Te=V.textures;if(ie.length!==Te.length||ie[0]!==s.COLOR_ATTACHMENT0){for(let ce=0,Xe=Te.length;ce<Xe;ce++)ie[ce]=s.COLOR_ATTACHMENT0+ce;ie.length=Te.length,ye=!0}}else ie[0]!==s.BACK&&(ie[0]=s.BACK,ye=!0);ye&&s.drawBuffers(ie)}function ke(V){return x!==V?(s.useProgram(V),x=V,!0):!1}let et={[Rn]:s.FUNC_ADD,[Cf]:s.FUNC_SUBTRACT,[Rf]:s.FUNC_REVERSE_SUBTRACT};et[Pf]=s.MIN,et[Lf]=s.MAX;let te={[ys]:s.ZERO,[If]:s.ONE,[Df]:s.SRC_COLOR,[qh]:s.SRC_ALPHA,[Ff]:s.SRC_ALPHA_SATURATE,[Po]:s.DST_COLOR,[Ro]:s.DST_ALPHA,[Nf]:s.ONE_MINUS_SRC_COLOR,[Yh]:s.ONE_MINUS_SRC_ALPHA,[Of]:s.ONE_MINUS_DST_COLOR,[Uf]:s.ONE_MINUS_DST_ALPHA,[Bf]:s.CONSTANT_COLOR,[kf]:s.ONE_MINUS_CONSTANT_COLOR,[zf]:s.CONSTANT_ALPHA,[Hf]:s.ONE_MINUS_CONSTANT_ALPHA};function ae(V,ve,ie,ye,Te,ce,Xe,ze,wt,ft){if(V===kt){m===!0&&(de(s.BLEND),m=!1);return}if(m===!1&&(K(s.BLEND),m=!0),V!==bl){if(V!==g||ft!==N){if((b!==Rn||M!==Rn)&&(s.blendEquation(s.FUNC_ADD),b=Rn,M=Rn),ft)switch(V){case mr:s.blendFuncSeparate(s.ONE,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case vs:s.blendFunc(s.ONE,s.ONE);break;case Wh:s.blendFuncSeparate(s.ZERO,s.ONE_MINUS_SRC_COLOR,s.ZERO,s.ONE);break;case Xh:s.blendFuncSeparate(s.DST_COLOR,s.ONE_MINUS_SRC_ALPHA,s.ZERO,s.ONE);break;default:Ze("WebGLState: Invalid blending: ",V);break}else switch(V){case mr:s.blendFuncSeparate(s.SRC_ALPHA,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case vs:s.blendFuncSeparate(s.SRC_ALPHA,s.ONE,s.ONE,s.ONE);break;case Wh:Ze("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Xh:Ze("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Ze("WebGLState: Invalid blending: ",V);break}T=null,_=null,E=null,A=null,v.set(0,0,0),R=0,g=V,N=ft}return}Te=Te||ve,ce=ce||ie,Xe=Xe||ye,(ve!==b||Te!==M)&&(s.blendEquationSeparate(et[ve],et[Te]),b=ve,M=Te),(ie!==T||ye!==_||ce!==E||Xe!==A)&&(s.blendFuncSeparate(te[ie],te[ye],te[ce],te[Xe]),T=ie,_=ye,E=ce,A=Xe),(ze.equals(v)===!1||wt!==R)&&(s.blendColor(ze.r,ze.g,ze.b,wt),v.copy(ze),R=wt),g=V,N=!1}function re(V,ve){V.side===Ot?de(s.CULL_FACE):K(s.CULL_FACE);let ie=V.side===en;ve&&(ie=!ie),oe(ie),V.blending===mr&&V.transparent===!1?ae(kt):ae(V.blending,V.blendEquation,V.blendSrc,V.blendDst,V.blendEquationAlpha,V.blendSrcAlpha,V.blendDstAlpha,V.blendColor,V.blendAlpha,V.premultipliedAlpha),o.setFunc(V.depthFunc),o.setTest(V.depthTest),o.setMask(V.depthWrite),r.setMask(V.colorWrite);let ye=V.stencilWrite;a.setTest(ye),ye&&(a.setMask(V.stencilWriteMask),a.setFunc(V.stencilFunc,V.stencilRef,V.stencilFuncMask),a.setOp(V.stencilFail,V.stencilZFail,V.stencilZPass)),Ne(V.polygonOffset,V.polygonOffsetFactor,V.polygonOffsetUnits),V.alphaToCoverage===!0?K(s.SAMPLE_ALPHA_TO_COVERAGE):de(s.SAMPLE_ALPHA_TO_COVERAGE)}function oe(V){L!==V&&(V?s.frontFace(s.CW):s.frontFace(s.CCW),L=V)}function le(V){V!==Tf?(K(s.CULL_FACE),V!==S&&(V===Gh?s.cullFace(s.BACK):V===Ef?s.cullFace(s.FRONT):s.cullFace(s.FRONT_AND_BACK))):de(s.CULL_FACE),S=V}function Be(V){V!==w&&(O&&s.lineWidth(V),w=V)}function Ne(V,ve,ie){V?(K(s.POLYGON_OFFSET_FILL),(P!==ve||U!==ie)&&(P=ve,U=ie,o.getReversed()&&(ve=-ve),s.polygonOffset(ve,ie))):de(s.POLYGON_OFFSET_FILL)}function Le(V){V?K(s.SCISSOR_TEST):de(s.SCISSOR_TEST)}function Ye(V){V===void 0&&(V=s.TEXTURE0+F-1),W!==V&&(s.activeTexture(V),W=V)}function B(V,ve,ie){ie===void 0&&(W===null?ie=s.TEXTURE0+F-1:ie=W);let ye=Z[ie];ye===void 0&&(ye={type:void 0,texture:void 0},Z[ie]=ye),(ye.type!==V||ye.texture!==ve)&&(W!==ie&&(s.activeTexture(ie),W=ie),s.bindTexture(V,ve||q[V]),ye.type=V,ye.texture=ve)}function $e(){let V=Z[W];V!==void 0&&V.type!==void 0&&(s.bindTexture(V.type,null),V.type=void 0,V.texture=void 0)}function Ke(){try{s.compressedTexImage2D(...arguments)}catch(V){Ze("WebGLState:",V)}}function I(){try{s.compressedTexImage3D(...arguments)}catch(V){Ze("WebGLState:",V)}}function y(){try{s.texSubImage2D(...arguments)}catch(V){Ze("WebGLState:",V)}}function G(){try{s.texSubImage3D(...arguments)}catch(V){Ze("WebGLState:",V)}}function X(){try{s.compressedTexSubImage2D(...arguments)}catch(V){Ze("WebGLState:",V)}}function J(){try{s.compressedTexSubImage3D(...arguments)}catch(V){Ze("WebGLState:",V)}}function ue(){try{s.texStorage2D(...arguments)}catch(V){Ze("WebGLState:",V)}}function fe(){try{s.texStorage3D(...arguments)}catch(V){Ze("WebGLState:",V)}}function $(){try{s.texImage2D(...arguments)}catch(V){Ze("WebGLState:",V)}}function ne(){try{s.texImage3D(...arguments)}catch(V){Ze("WebGLState:",V)}}function xe(V){return f[V]!==void 0?f[V]:s.getParameter(V)}function He(V,ve){f[V]!==ve&&(s.pixelStorei(V,ve),f[V]=ve)}function ge(V){Ae.equals(V)===!1&&(s.scissor(V.x,V.y,V.z,V.w),Ae.copy(V))}function me(V){we.equals(V)===!1&&(s.viewport(V.x,V.y,V.z,V.w),we.copy(V))}function Ue(V,ve){let ie=c.get(ve);ie===void 0&&(ie=new WeakMap,c.set(ve,ie));let ye=ie.get(V);ye===void 0&&(ye=s.getUniformBlockIndex(ve,V.name),ie.set(V,ye))}function We(V,ve){let ye=c.get(ve).get(V);l.get(ve)!==ye&&(s.uniformBlockBinding(ve,ye,V.__bindingPointIndex),l.set(ve,ye))}function Je(){s.disable(s.BLEND),s.disable(s.CULL_FACE),s.disable(s.DEPTH_TEST),s.disable(s.POLYGON_OFFSET_FILL),s.disable(s.SCISSOR_TEST),s.disable(s.STENCIL_TEST),s.disable(s.SAMPLE_ALPHA_TO_COVERAGE),s.blendEquation(s.FUNC_ADD),s.blendFunc(s.ONE,s.ZERO),s.blendFuncSeparate(s.ONE,s.ZERO,s.ONE,s.ZERO),s.blendColor(0,0,0,0),s.colorMask(!0,!0,!0,!0),s.clearColor(0,0,0,0),s.depthMask(!0),s.depthFunc(s.LESS),o.setReversed(!1),s.clearDepth(1),s.stencilMask(4294967295),s.stencilFunc(s.ALWAYS,0,4294967295),s.stencilOp(s.KEEP,s.KEEP,s.KEEP),s.clearStencil(0),s.cullFace(s.BACK),s.frontFace(s.CCW),s.polygonOffset(0,0),s.activeTexture(s.TEXTURE0),s.bindFramebuffer(s.FRAMEBUFFER,null),s.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),s.bindFramebuffer(s.READ_FRAMEBUFFER,null),s.useProgram(null),s.lineWidth(1),s.scissor(0,0,s.canvas.width,s.canvas.height),s.viewport(0,0,s.canvas.width,s.canvas.height),s.pixelStorei(s.PACK_ALIGNMENT,4),s.pixelStorei(s.UNPACK_ALIGNMENT,4),s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,!1),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,s.BROWSER_DEFAULT_WEBGL),s.pixelStorei(s.PACK_ROW_LENGTH,0),s.pixelStorei(s.PACK_SKIP_PIXELS,0),s.pixelStorei(s.PACK_SKIP_ROWS,0),s.pixelStorei(s.UNPACK_ROW_LENGTH,0),s.pixelStorei(s.UNPACK_IMAGE_HEIGHT,0),s.pixelStorei(s.UNPACK_SKIP_PIXELS,0),s.pixelStorei(s.UNPACK_SKIP_ROWS,0),s.pixelStorei(s.UNPACK_SKIP_IMAGES,0),h={},f={},W=null,Z={},d={},u=new WeakMap,p=[],x=null,m=!1,g=null,b=null,T=null,_=null,M=null,E=null,A=null,v=new Ee(0,0,0),R=0,N=!1,L=null,S=null,w=null,P=null,U=null,Ae.set(0,0,s.canvas.width,s.canvas.height),we.set(0,0,s.canvas.width,s.canvas.height),r.reset(),o.reset(),a.reset()}return{buffers:{color:r,depth:o,stencil:a},enable:K,disable:de,bindFramebuffer:De,drawBuffers:_e,useProgram:ke,setBlending:ae,setMaterial:re,setFlipSided:oe,setCullFace:le,setLineWidth:Be,setPolygonOffset:Ne,setScissorTest:Le,activeTexture:Ye,bindTexture:B,unbindTexture:$e,compressedTexImage2D:Ke,compressedTexImage3D:I,texImage2D:$,texImage3D:ne,pixelStorei:He,getParameter:xe,updateUBOMapping:Ue,uniformBlockBinding:We,texStorage2D:ue,texStorage3D:fe,texSubImage2D:y,texSubImage3D:G,compressedTexSubImage2D:X,compressedTexSubImage3D:J,scissor:ge,viewport:me,reset:Je}}function Gy(s,e,t,n,i,r,o){let a=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new ee,h=new WeakMap,f=new Set,d,u=new WeakMap,p=!1;try{p=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function x(I,y){return p?new OffscreenCanvas(I,y):Qs("canvas")}function m(I,y,G){let X=1,J=Ke(I);if((J.width>G||J.height>G)&&(X=G/Math.max(J.width,J.height)),X<1)if(typeof HTMLImageElement<"u"&&I instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&I instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&I instanceof ImageBitmap||typeof VideoFrame<"u"&&I instanceof VideoFrame){let ue=Math.floor(X*J.width),fe=Math.floor(X*J.height);d===void 0&&(d=x(ue,fe));let $=y?x(ue,fe):d;return $.width=ue,$.height=fe,$.getContext("2d").drawImage(I,0,0,ue,fe),Ge("WebGLRenderer: Texture has been resized from ("+J.width+"x"+J.height+") to ("+ue+"x"+fe+")."),$}else return"data"in I&&Ge("WebGLRenderer: Image in DataTexture is too big ("+J.width+"x"+J.height+")."),I;return I}function g(I){return I.generateMipmaps}function b(I){s.generateMipmap(I)}function T(I){return I.isWebGLCubeRenderTarget?s.TEXTURE_CUBE_MAP:I.isWebGL3DRenderTarget?s.TEXTURE_3D:I.isWebGLArrayRenderTarget||I.isCompressedArrayTexture?s.TEXTURE_2D_ARRAY:s.TEXTURE_2D}function _(I,y,G,X,J,ue=!1){if(I!==null){if(s[I]!==void 0)return s[I];Ge("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+I+"'")}let fe;X&&(fe=e.get("EXT_texture_norm16"),fe||Ge("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let $=y;if(y===s.RED&&(G===s.FLOAT&&($=s.R32F),G===s.HALF_FLOAT&&($=s.R16F),G===s.UNSIGNED_BYTE&&($=s.R8),G===s.UNSIGNED_SHORT&&fe&&($=fe.R16_EXT),G===s.SHORT&&fe&&($=fe.R16_SNORM_EXT)),y===s.RED_INTEGER&&(G===s.UNSIGNED_BYTE&&($=s.R8UI),G===s.UNSIGNED_SHORT&&($=s.R16UI),G===s.UNSIGNED_INT&&($=s.R32UI),G===s.BYTE&&($=s.R8I),G===s.SHORT&&($=s.R16I),G===s.INT&&($=s.R32I)),y===s.RG&&(G===s.FLOAT&&($=s.RG32F),G===s.HALF_FLOAT&&($=s.RG16F),G===s.UNSIGNED_BYTE&&($=s.RG8),G===s.UNSIGNED_SHORT&&fe&&($=fe.RG16_EXT),G===s.SHORT&&fe&&($=fe.RG16_SNORM_EXT)),y===s.RG_INTEGER&&(G===s.UNSIGNED_BYTE&&($=s.RG8UI),G===s.UNSIGNED_SHORT&&($=s.RG16UI),G===s.UNSIGNED_INT&&($=s.RG32UI),G===s.BYTE&&($=s.RG8I),G===s.SHORT&&($=s.RG16I),G===s.INT&&($=s.RG32I)),y===s.RGB_INTEGER&&(G===s.UNSIGNED_BYTE&&($=s.RGB8UI),G===s.UNSIGNED_SHORT&&($=s.RGB16UI),G===s.UNSIGNED_INT&&($=s.RGB32UI),G===s.BYTE&&($=s.RGB8I),G===s.SHORT&&($=s.RGB16I),G===s.INT&&($=s.RGB32I)),y===s.RGBA_INTEGER&&(G===s.UNSIGNED_BYTE&&($=s.RGBA8UI),G===s.UNSIGNED_SHORT&&($=s.RGBA16UI),G===s.UNSIGNED_INT&&($=s.RGBA32UI),G===s.BYTE&&($=s.RGBA8I),G===s.SHORT&&($=s.RGBA16I),G===s.INT&&($=s.RGBA32I)),y===s.RGB&&(G===s.UNSIGNED_SHORT&&fe&&($=fe.RGB16_EXT),G===s.SHORT&&fe&&($=fe.RGB16_SNORM_EXT),G===s.UNSIGNED_INT_5_9_9_9_REV&&($=s.RGB9_E5),G===s.UNSIGNED_INT_10F_11F_11F_REV&&($=s.R11F_G11F_B10F)),y===s.RGBA){let ne=ue?jr:tt.getTransfer(J);G===s.FLOAT&&($=s.RGBA32F),G===s.HALF_FLOAT&&($=s.RGBA16F),G===s.UNSIGNED_BYTE&&($=ne===ht?s.SRGB8_ALPHA8:s.RGBA8),G===s.UNSIGNED_SHORT&&fe&&($=fe.RGBA16_EXT),G===s.SHORT&&fe&&($=fe.RGBA16_SNORM_EXT),G===s.UNSIGNED_SHORT_4_4_4_4&&($=s.RGBA4),G===s.UNSIGNED_SHORT_5_5_5_1&&($=s.RGB5_A1)}return($===s.R16F||$===s.R32F||$===s.RG16F||$===s.RG32F||$===s.RGBA16F||$===s.RGBA32F)&&e.get("EXT_color_buffer_float"),$}function M(I,y){let G;return I?y===null||y===Wn||y===Qi?G=s.DEPTH24_STENCIL8:y===Tn?G=s.DEPTH32F_STENCIL8:y===xr&&(G=s.DEPTH24_STENCIL8,Ge("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):y===null||y===Wn||y===Qi?G=s.DEPTH_COMPONENT24:y===Tn?G=s.DEPTH_COMPONENT32F:y===xr&&(G=s.DEPTH_COMPONENT16),G}function E(I,y){return g(I)===!0||I.isFramebufferTexture&&I.minFilter!==bt&&I.minFilter!==It?Math.log2(Math.max(y.width,y.height))+1:I.mipmaps!==void 0&&I.mipmaps.length>0?I.mipmaps.length:I.isCompressedTexture&&Array.isArray(I.image)?y.mipmaps.length:1}function A(I){let y=I.target;y.removeEventListener("dispose",A),R(y),y.isVideoTexture&&h.delete(y),y.isHTMLTexture&&f.delete(y)}function v(I){let y=I.target;y.removeEventListener("dispose",v),L(y)}function R(I){let y=n.get(I);if(y.__webglInit===void 0)return;let G=I.source,X=u.get(G);if(X){let J=X[y.__cacheKey];J.usedTimes--,J.usedTimes===0&&N(I),Object.keys(X).length===0&&u.delete(G)}n.remove(I)}function N(I){let y=n.get(I);s.deleteTexture(y.__webglTexture);let G=I.source,X=u.get(G);delete X[y.__cacheKey],o.memory.textures--}function L(I){let y=n.get(I);if(I.depthTexture&&(I.depthTexture.dispose(),n.remove(I.depthTexture)),I.isWebGLCubeRenderTarget)for(let X=0;X<6;X++){if(Array.isArray(y.__webglFramebuffer[X]))for(let J=0;J<y.__webglFramebuffer[X].length;J++)s.deleteFramebuffer(y.__webglFramebuffer[X][J]);else s.deleteFramebuffer(y.__webglFramebuffer[X]);y.__webglDepthbuffer&&s.deleteRenderbuffer(y.__webglDepthbuffer[X])}else{if(Array.isArray(y.__webglFramebuffer))for(let X=0;X<y.__webglFramebuffer.length;X++)s.deleteFramebuffer(y.__webglFramebuffer[X]);else s.deleteFramebuffer(y.__webglFramebuffer);if(y.__webglDepthbuffer&&s.deleteRenderbuffer(y.__webglDepthbuffer),y.__webglMultisampledFramebuffer&&s.deleteFramebuffer(y.__webglMultisampledFramebuffer),y.__webglColorRenderbuffer)for(let X=0;X<y.__webglColorRenderbuffer.length;X++)y.__webglColorRenderbuffer[X]&&s.deleteRenderbuffer(y.__webglColorRenderbuffer[X]);y.__webglDepthRenderbuffer&&s.deleteRenderbuffer(y.__webglDepthRenderbuffer)}let G=I.textures;for(let X=0,J=G.length;X<J;X++){let ue=n.get(G[X]);ue.__webglTexture&&(s.deleteTexture(ue.__webglTexture),o.memory.textures--),n.remove(G[X])}n.remove(I)}let S=0;function w(){S=0}function P(){return S}function U(I){S=I}function F(){let I=S;return I>=i.maxTextures&&Ge("WebGLTextures: Trying to use "+(I+1)+" texture units while this GPU supports only "+i.maxTextures),S+=1,I}function O(I){let y=[];return y.push(I.wrapS),y.push(I.wrapT),y.push(I.wrapR||0),y.push(I.magFilter),y.push(I.minFilter),y.push(I.anisotropy),y.push(I.internalFormat),y.push(I.format),y.push(I.type),y.push(I.generateMipmaps),y.push(I.premultiplyAlpha),y.push(I.flipY),y.push(I.unpackAlignment),y.push(I.colorSpace),y.join()}function H(I,y){let G=n.get(I);if(I.isVideoTexture&&B(I),I.isRenderTargetTexture===!1&&I.isExternalTexture!==!0&&I.version>0&&G.__version!==I.version){let X=I.image;if(X===null)Ge("WebGLRenderer: Texture marked for update but no image data found.");else if(X.complete===!1)Ge("WebGLRenderer: Texture marked for update but image is incomplete");else{de(G,I,y);return}}else I.isExternalTexture&&(G.__webglTexture=I.sourceTexture?I.sourceTexture:null);t.bindTexture(s.TEXTURE_2D,G.__webglTexture,s.TEXTURE0+y)}function k(I,y){let G=n.get(I);if(I.isRenderTargetTexture===!1&&I.version>0&&G.__version!==I.version){de(G,I,y);return}else I.isExternalTexture&&(G.__webglTexture=I.sourceTexture?I.sourceTexture:null);t.bindTexture(s.TEXTURE_2D_ARRAY,G.__webglTexture,s.TEXTURE0+y)}function W(I,y){let G=n.get(I);if(I.isRenderTargetTexture===!1&&I.version>0&&G.__version!==I.version){de(G,I,y);return}t.bindTexture(s.TEXTURE_3D,G.__webglTexture,s.TEXTURE0+y)}function Z(I,y){let G=n.get(I);if(I.isCubeDepthTexture!==!0&&I.version>0&&G.__version!==I.version){De(G,I,y);return}t.bindTexture(s.TEXTURE_CUBE_MAP,G.__webglTexture,s.TEXTURE0+y)}let he={[Kt]:s.REPEAT,[mn]:s.CLAMP_TO_EDGE,[Ks]:s.MIRRORED_REPEAT},pe={[bt]:s.NEAREST,[El]:s.NEAREST_MIPMAP_NEAREST,[bs]:s.NEAREST_MIPMAP_LINEAR,[It]:s.LINEAR,[gr]:s.LINEAR_MIPMAP_NEAREST,[Gn]:s.LINEAR_MIPMAP_LINEAR},Ae={[Zf]:s.NEVER,[ep]:s.ALWAYS,[Kf]:s.LESS,[hc]:s.LEQUAL,[Jf]:s.EQUAL,[uc]:s.GEQUAL,[Qf]:s.GREATER,[$f]:s.NOTEQUAL};function we(I,y){if(y.type===Tn&&e.has("OES_texture_float_linear")===!1&&(y.magFilter===It||y.magFilter===gr||y.magFilter===bs||y.magFilter===Gn||y.minFilter===It||y.minFilter===gr||y.minFilter===bs||y.minFilter===Gn)&&Ge("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),s.texParameteri(I,s.TEXTURE_WRAP_S,he[y.wrapS]),s.texParameteri(I,s.TEXTURE_WRAP_T,he[y.wrapT]),(I===s.TEXTURE_3D||I===s.TEXTURE_2D_ARRAY)&&s.texParameteri(I,s.TEXTURE_WRAP_R,he[y.wrapR]),s.texParameteri(I,s.TEXTURE_MAG_FILTER,pe[y.magFilter]),s.texParameteri(I,s.TEXTURE_MIN_FILTER,pe[y.minFilter]),y.compareFunction&&(s.texParameteri(I,s.TEXTURE_COMPARE_MODE,s.COMPARE_REF_TO_TEXTURE),s.texParameteri(I,s.TEXTURE_COMPARE_FUNC,Ae[y.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(y.magFilter===bt||y.minFilter!==bs&&y.minFilter!==Gn||y.type===Tn&&e.has("OES_texture_float_linear")===!1)return;if(y.anisotropy>1||n.get(y).__currentAnisotropy){let G=e.get("EXT_texture_filter_anisotropic");s.texParameterf(I,G.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(y.anisotropy,i.getMaxAnisotropy())),n.get(y).__currentAnisotropy=y.anisotropy}}}function Pe(I,y){let G=!1;I.__webglInit===void 0&&(I.__webglInit=!0,y.addEventListener("dispose",A));let X=y.source,J=u.get(X);J===void 0&&(J={},u.set(X,J));let ue=O(y);if(ue!==I.__cacheKey){J[ue]===void 0&&(J[ue]={texture:s.createTexture(),usedTimes:0},o.memory.textures++,G=!0),J[ue].usedTimes++;let fe=J[I.__cacheKey];fe!==void 0&&(J[I.__cacheKey].usedTimes--,fe.usedTimes===0&&N(y)),I.__cacheKey=ue,I.__webglTexture=J[ue].texture}return G}function q(I,y,G){return Math.floor(Math.floor(I/G)/y)}function K(I,y,G,X){let ue=I.updateRanges;if(ue.length===0)t.texSubImage2D(s.TEXTURE_2D,0,0,0,y.width,y.height,G,X,y.data);else{ue.sort((He,ge)=>He.start-ge.start);let fe=0;for(let He=1;He<ue.length;He++){let ge=ue[fe],me=ue[He],Ue=ge.start+ge.count,We=q(me.start,y.width,4),Je=q(ge.start,y.width,4);me.start<=Ue+1&&We===Je&&q(me.start+me.count-1,y.width,4)===We?ge.count=Math.max(ge.count,me.start+me.count-ge.start):(++fe,ue[fe]=me)}ue.length=fe+1;let $=t.getParameter(s.UNPACK_ROW_LENGTH),ne=t.getParameter(s.UNPACK_SKIP_PIXELS),xe=t.getParameter(s.UNPACK_SKIP_ROWS);t.pixelStorei(s.UNPACK_ROW_LENGTH,y.width);for(let He=0,ge=ue.length;He<ge;He++){let me=ue[He],Ue=Math.floor(me.start/4),We=Math.ceil(me.count/4),Je=Ue%y.width,V=Math.floor(Ue/y.width),ve=We,ie=1;t.pixelStorei(s.UNPACK_SKIP_PIXELS,Je),t.pixelStorei(s.UNPACK_SKIP_ROWS,V),t.texSubImage2D(s.TEXTURE_2D,0,Je,V,ve,ie,G,X,y.data)}I.clearUpdateRanges(),t.pixelStorei(s.UNPACK_ROW_LENGTH,$),t.pixelStorei(s.UNPACK_SKIP_PIXELS,ne),t.pixelStorei(s.UNPACK_SKIP_ROWS,xe)}}function de(I,y,G){let X=s.TEXTURE_2D;(y.isDataArrayTexture||y.isCompressedArrayTexture)&&(X=s.TEXTURE_2D_ARRAY),y.isData3DTexture&&(X=s.TEXTURE_3D);let J=Pe(I,y),ue=y.source;t.bindTexture(X,I.__webglTexture,s.TEXTURE0+G);let fe=n.get(ue);if(ue.version!==fe.__version||J===!0){if(t.activeTexture(s.TEXTURE0+G),(typeof ImageBitmap<"u"&&y.image instanceof ImageBitmap)===!1){let ie=tt.getPrimaries(tt.workingColorSpace),ye=y.colorSpace===Pn?null:tt.getPrimaries(y.colorSpace),Te=y.colorSpace===Pn||ie===ye?s.NONE:s.BROWSER_DEFAULT_WEBGL;t.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,y.flipY),t.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,y.premultiplyAlpha),t.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,Te)}t.pixelStorei(s.UNPACK_ALIGNMENT,y.unpackAlignment);let ne=m(y.image,!1,i.maxTextureSize);ne=$e(y,ne);let xe=r.convert(y.format,y.colorSpace),He=r.convert(y.type),ge=_(y.internalFormat,xe,He,y.normalized,y.colorSpace,y.isVideoTexture);we(X,y);let me,Ue=y.mipmaps,We=y.isVideoTexture!==!0,Je=fe.__version===void 0||J===!0,V=ue.dataReady,ve=E(y,ne);if(y.isDepthTexture)ge=M(y.format===ri,y.type),Je&&(We?t.texStorage2D(s.TEXTURE_2D,1,ge,ne.width,ne.height):t.texImage2D(s.TEXTURE_2D,0,ge,ne.width,ne.height,0,xe,He,null));else if(y.isDataTexture)if(Ue.length>0){We&&Je&&t.texStorage2D(s.TEXTURE_2D,ve,ge,Ue[0].width,Ue[0].height);for(let ie=0,ye=Ue.length;ie<ye;ie++)me=Ue[ie],We?V&&t.texSubImage2D(s.TEXTURE_2D,ie,0,0,me.width,me.height,xe,He,me.data):t.texImage2D(s.TEXTURE_2D,ie,ge,me.width,me.height,0,xe,He,me.data);y.generateMipmaps=!1}else We?(Je&&t.texStorage2D(s.TEXTURE_2D,ve,ge,ne.width,ne.height),V&&K(y,ne,xe,He)):t.texImage2D(s.TEXTURE_2D,0,ge,ne.width,ne.height,0,xe,He,ne.data);else if(y.isCompressedTexture)if(y.isCompressedArrayTexture){We&&Je&&t.texStorage3D(s.TEXTURE_2D_ARRAY,ve,ge,Ue[0].width,Ue[0].height,ne.depth);for(let ie=0,ye=Ue.length;ie<ye;ie++)if(me=Ue[ie],y.format!==pn)if(xe!==null)if(We){if(V)if(y.layerUpdates.size>0){let Te=cu(me.width,me.height,y.format,y.type);for(let ce of y.layerUpdates){let Xe=me.data.subarray(ce*Te/me.data.BYTES_PER_ELEMENT,(ce+1)*Te/me.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(s.TEXTURE_2D_ARRAY,ie,0,0,ce,me.width,me.height,1,xe,Xe)}}else t.compressedTexSubImage3D(s.TEXTURE_2D_ARRAY,ie,0,0,0,me.width,me.height,ne.depth,xe,me.data)}else t.compressedTexImage3D(s.TEXTURE_2D_ARRAY,ie,ge,me.width,me.height,ne.depth,0,me.data,0,0);else Ge("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else We?V&&t.texSubImage3D(s.TEXTURE_2D_ARRAY,ie,0,0,0,me.width,me.height,ne.depth,xe,He,me.data):t.texImage3D(s.TEXTURE_2D_ARRAY,ie,ge,me.width,me.height,ne.depth,0,xe,He,me.data);y.layerUpdates.size>0&&y.clearLayerUpdates()}else{We&&Je&&t.texStorage2D(s.TEXTURE_2D,ve,ge,Ue[0].width,Ue[0].height);for(let ie=0,ye=Ue.length;ie<ye;ie++)me=Ue[ie],y.format!==pn?xe!==null?We?V&&t.compressedTexSubImage2D(s.TEXTURE_2D,ie,0,0,me.width,me.height,xe,me.data):t.compressedTexImage2D(s.TEXTURE_2D,ie,ge,me.width,me.height,0,me.data):Ge("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):We?V&&t.texSubImage2D(s.TEXTURE_2D,ie,0,0,me.width,me.height,xe,He,me.data):t.texImage2D(s.TEXTURE_2D,ie,ge,me.width,me.height,0,xe,He,me.data)}else if(y.isDataArrayTexture)if(We){if(Je&&t.texStorage3D(s.TEXTURE_2D_ARRAY,ve,ge,ne.width,ne.height,ne.depth),V)if(y.layerUpdates.size>0){let ie=cu(ne.width,ne.height,y.format,y.type);for(let ye of y.layerUpdates){let Te=ne.data.subarray(ye*ie/ne.data.BYTES_PER_ELEMENT,(ye+1)*ie/ne.data.BYTES_PER_ELEMENT);t.texSubImage3D(s.TEXTURE_2D_ARRAY,0,0,0,ye,ne.width,ne.height,1,xe,He,Te)}y.clearLayerUpdates()}else t.texSubImage3D(s.TEXTURE_2D_ARRAY,0,0,0,0,ne.width,ne.height,ne.depth,xe,He,ne.data)}else t.texImage3D(s.TEXTURE_2D_ARRAY,0,ge,ne.width,ne.height,ne.depth,0,xe,He,ne.data);else if(y.isData3DTexture)We?(Je&&t.texStorage3D(s.TEXTURE_3D,ve,ge,ne.width,ne.height,ne.depth),V&&t.texSubImage3D(s.TEXTURE_3D,0,0,0,0,ne.width,ne.height,ne.depth,xe,He,ne.data)):t.texImage3D(s.TEXTURE_3D,0,ge,ne.width,ne.height,ne.depth,0,xe,He,ne.data);else if(y.isFramebufferTexture){if(Je)if(We)t.texStorage2D(s.TEXTURE_2D,ve,ge,ne.width,ne.height);else{let ie=ne.width,ye=ne.height;for(let Te=0;Te<ve;Te++)t.texImage2D(s.TEXTURE_2D,Te,ge,ie,ye,0,xe,He,null),ie>>=1,ye>>=1}}else if(y.isHTMLTexture){if("texElementImage2D"in s){let ie=s.canvas;if(ie.hasAttribute("layoutsubtree")||ie.setAttribute("layoutsubtree","true"),ne.parentNode!==ie){ie.appendChild(ne),f.add(y),ie.onpaint=ye=>{let Te=ye.changedElements;for(let ce of f)Te.includes(ce.image)&&(ce.needsUpdate=!0)},ie.requestPaint();return}if(s.texElementImage2D.length===3)s.texElementImage2D(s.TEXTURE_2D,s.RGBA8,ne);else{let Te=s.RGBA,ce=s.RGBA,Xe=s.UNSIGNED_BYTE;s.texElementImage2D(s.TEXTURE_2D,0,Te,ce,Xe,ne)}s.texParameteri(s.TEXTURE_2D,s.TEXTURE_MIN_FILTER,s.LINEAR),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_S,s.CLAMP_TO_EDGE),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_T,s.CLAMP_TO_EDGE)}}else if(Ue.length>0){if(We&&Je){let ie=Ke(Ue[0]);t.texStorage2D(s.TEXTURE_2D,ve,ge,ie.width,ie.height)}for(let ie=0,ye=Ue.length;ie<ye;ie++)me=Ue[ie],We?V&&t.texSubImage2D(s.TEXTURE_2D,ie,0,0,xe,He,me):t.texImage2D(s.TEXTURE_2D,ie,ge,xe,He,me);y.generateMipmaps=!1}else if(We){if(Je){let ie=Ke(ne);t.texStorage2D(s.TEXTURE_2D,ve,ge,ie.width,ie.height)}V&&t.texSubImage2D(s.TEXTURE_2D,0,0,0,xe,He,ne)}else t.texImage2D(s.TEXTURE_2D,0,ge,xe,He,ne);g(y)&&b(X),fe.__version=ue.version,y.onUpdate&&y.onUpdate(y)}I.__version=y.version}function De(I,y,G){if(y.image.length!==6)return;let X=Pe(I,y),J=y.source;t.bindTexture(s.TEXTURE_CUBE_MAP,I.__webglTexture,s.TEXTURE0+G);let ue=n.get(J);if(J.version!==ue.__version||X===!0){t.activeTexture(s.TEXTURE0+G);let fe=tt.getPrimaries(tt.workingColorSpace),$=y.colorSpace===Pn?null:tt.getPrimaries(y.colorSpace),ne=y.colorSpace===Pn||fe===$?s.NONE:s.BROWSER_DEFAULT_WEBGL;t.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,y.flipY),t.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,y.premultiplyAlpha),t.pixelStorei(s.UNPACK_ALIGNMENT,y.unpackAlignment),t.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,ne);let xe=y.isCompressedTexture||y.image[0].isCompressedTexture,He=y.image[0]&&y.image[0].isDataTexture,ge=[];for(let ce=0;ce<6;ce++)!xe&&!He?ge[ce]=m(y.image[ce],!0,i.maxCubemapSize):ge[ce]=He?y.image[ce].image:y.image[ce],ge[ce]=$e(y,ge[ce]);let me=ge[0],Ue=r.convert(y.format,y.colorSpace),We=r.convert(y.type),Je=_(y.internalFormat,Ue,We,y.normalized,y.colorSpace),V=y.isVideoTexture!==!0,ve=ue.__version===void 0||X===!0,ie=J.dataReady,ye=E(y,me);we(s.TEXTURE_CUBE_MAP,y);let Te;if(xe){V&&ve&&t.texStorage2D(s.TEXTURE_CUBE_MAP,ye,Je,me.width,me.height);for(let ce=0;ce<6;ce++){Te=ge[ce].mipmaps;for(let Xe=0;Xe<Te.length;Xe++){let ze=Te[Xe];y.format!==pn?Ue!==null?V?ie&&t.compressedTexSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,Xe,0,0,ze.width,ze.height,Ue,ze.data):t.compressedTexImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,Xe,Je,ze.width,ze.height,0,ze.data):Ge("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):V?ie&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,Xe,0,0,ze.width,ze.height,Ue,We,ze.data):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,Xe,Je,ze.width,ze.height,0,Ue,We,ze.data)}}}else{if(Te=y.mipmaps,V&&ve){Te.length>0&&ye++;let ce=Ke(ge[0]);t.texStorage2D(s.TEXTURE_CUBE_MAP,ye,Je,ce.width,ce.height)}for(let ce=0;ce<6;ce++)if(He){V?ie&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,0,0,0,ge[ce].width,ge[ce].height,Ue,We,ge[ce].data):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,0,Je,ge[ce].width,ge[ce].height,0,Ue,We,ge[ce].data);for(let Xe=0;Xe<Te.length;Xe++){let wt=Te[Xe].image[ce].image;V?ie&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,Xe+1,0,0,wt.width,wt.height,Ue,We,wt.data):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,Xe+1,Je,wt.width,wt.height,0,Ue,We,wt.data)}}else{V?ie&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,0,0,0,Ue,We,ge[ce]):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,0,Je,Ue,We,ge[ce]);for(let Xe=0;Xe<Te.length;Xe++){let ze=Te[Xe];V?ie&&t.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,Xe+1,0,0,Ue,We,ze.image[ce]):t.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+ce,Xe+1,Je,Ue,We,ze.image[ce])}}}g(y)&&b(s.TEXTURE_CUBE_MAP),ue.__version=J.version,y.onUpdate&&y.onUpdate(y)}I.__version=y.version}function _e(I,y,G,X,J,ue){let fe=r.convert(G.format,G.colorSpace),$=r.convert(G.type),ne=_(G.internalFormat,fe,$,G.normalized,G.colorSpace),xe=n.get(y),He=n.get(G);if(He.__renderTarget=y,!xe.__hasExternalTextures){let ge=Math.max(1,y.width>>ue),me=Math.max(1,y.height>>ue);J===s.TEXTURE_3D||J===s.TEXTURE_2D_ARRAY?t.texImage3D(J,ue,ne,ge,me,y.depth,0,fe,$,null):t.texImage2D(J,ue,ne,ge,me,0,fe,$,null)}t.bindFramebuffer(s.FRAMEBUFFER,I),Ye(y)?a.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,X,J,He.__webglTexture,0,Le(y)):(J===s.TEXTURE_2D||J>=s.TEXTURE_CUBE_MAP_POSITIVE_X&&J<=s.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&s.framebufferTexture2D(s.FRAMEBUFFER,X,J,He.__webglTexture,ue),t.bindFramebuffer(s.FRAMEBUFFER,null)}function ke(I,y,G){if(s.bindRenderbuffer(s.RENDERBUFFER,I),y.depthBuffer){let X=y.depthTexture,J=X&&X.isDepthTexture?X.type:null,ue=M(y.stencilBuffer,J),fe=y.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT;Ye(y)?a.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,Le(y),ue,y.width,y.height):G?s.renderbufferStorageMultisample(s.RENDERBUFFER,Le(y),ue,y.width,y.height):s.renderbufferStorage(s.RENDERBUFFER,ue,y.width,y.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,fe,s.RENDERBUFFER,I)}else{let X=y.textures;for(let J=0;J<X.length;J++){let ue=X[J],fe=r.convert(ue.format,ue.colorSpace),$=r.convert(ue.type),ne=_(ue.internalFormat,fe,$,ue.normalized,ue.colorSpace);Ye(y)?a.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,Le(y),ne,y.width,y.height):G?s.renderbufferStorageMultisample(s.RENDERBUFFER,Le(y),ne,y.width,y.height):s.renderbufferStorage(s.RENDERBUFFER,ne,y.width,y.height)}}s.bindRenderbuffer(s.RENDERBUFFER,null)}function et(I,y,G){let X=y.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(s.FRAMEBUFFER,I),!(y.depthTexture&&y.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let J=n.get(y.depthTexture);if(J.__renderTarget=y,(!J.__webglTexture||y.depthTexture.image.width!==y.width||y.depthTexture.image.height!==y.height)&&(y.depthTexture.image.width=y.width,y.depthTexture.image.height=y.height,y.depthTexture.needsUpdate=!0),X){if(J.__webglInit===void 0&&(J.__webglInit=!0,y.depthTexture.addEventListener("dispose",A)),J.__webglTexture===void 0){J.__webglTexture=s.createTexture(),t.bindTexture(s.TEXTURE_CUBE_MAP,J.__webglTexture),we(s.TEXTURE_CUBE_MAP,y.depthTexture);let xe=r.convert(y.depthTexture.format),He=r.convert(y.depthTexture.type),ge;y.depthTexture.format===Jn?ge=s.DEPTH_COMPONENT24:y.depthTexture.format===ri&&(ge=s.DEPTH24_STENCIL8);for(let me=0;me<6;me++)s.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+me,0,ge,y.width,y.height,0,xe,He,null)}}else H(y.depthTexture,0);let ue=J.__webglTexture,fe=Le(y),$=X?s.TEXTURE_CUBE_MAP_POSITIVE_X+G:s.TEXTURE_2D,ne=y.depthTexture.format===ri?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT;if(y.depthTexture.format===Jn)Ye(y)?a.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,ne,$,ue,0,fe):s.framebufferTexture2D(s.FRAMEBUFFER,ne,$,ue,0);else if(y.depthTexture.format===ri)Ye(y)?a.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,ne,$,ue,0,fe):s.framebufferTexture2D(s.FRAMEBUFFER,ne,$,ue,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function te(I){let y=n.get(I),G=I.isWebGLCubeRenderTarget===!0;if(y.__boundDepthTexture!==I.depthTexture){let X=I.depthTexture;if(y.__depthDisposeCallback&&y.__depthDisposeCallback(),X){let J=()=>{delete y.__boundDepthTexture,delete y.__depthDisposeCallback,X.removeEventListener("dispose",J)};X.addEventListener("dispose",J),y.__depthDisposeCallback=J}y.__boundDepthTexture=X}if(I.depthTexture&&!y.__autoAllocateDepthBuffer)if(G)for(let X=0;X<6;X++)et(y.__webglFramebuffer[X],I,X);else{let X=I.texture.mipmaps;X&&X.length>0?et(y.__webglFramebuffer[0],I,0):et(y.__webglFramebuffer,I,0)}else if(G){y.__webglDepthbuffer=[];for(let X=0;X<6;X++)if(t.bindFramebuffer(s.FRAMEBUFFER,y.__webglFramebuffer[X]),y.__webglDepthbuffer[X]===void 0)y.__webglDepthbuffer[X]=s.createRenderbuffer(),ke(y.__webglDepthbuffer[X],I,!1);else{let J=I.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,ue=y.__webglDepthbuffer[X];s.bindRenderbuffer(s.RENDERBUFFER,ue),s.framebufferRenderbuffer(s.FRAMEBUFFER,J,s.RENDERBUFFER,ue)}}else{let X=I.texture.mipmaps;if(X&&X.length>0?t.bindFramebuffer(s.FRAMEBUFFER,y.__webglFramebuffer[0]):t.bindFramebuffer(s.FRAMEBUFFER,y.__webglFramebuffer),y.__webglDepthbuffer===void 0)y.__webglDepthbuffer=s.createRenderbuffer(),ke(y.__webglDepthbuffer,I,!1);else{let J=I.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,ue=y.__webglDepthbuffer;s.bindRenderbuffer(s.RENDERBUFFER,ue),s.framebufferRenderbuffer(s.FRAMEBUFFER,J,s.RENDERBUFFER,ue)}}t.bindFramebuffer(s.FRAMEBUFFER,null)}function ae(I,y,G){let X=n.get(I);y!==void 0&&_e(X.__webglFramebuffer,I,I.texture,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,0),G!==void 0&&te(I)}function re(I){let y=I.texture,G=n.get(I),X=n.get(y);I.addEventListener("dispose",v);let J=I.textures,ue=I.isWebGLCubeRenderTarget===!0,fe=J.length>1;if(fe||(X.__webglTexture===void 0&&(X.__webglTexture=s.createTexture()),X.__version=y.version,o.memory.textures++),ue){G.__webglFramebuffer=[];for(let $=0;$<6;$++)if(y.mipmaps&&y.mipmaps.length>0){G.__webglFramebuffer[$]=[];for(let ne=0;ne<y.mipmaps.length;ne++)G.__webglFramebuffer[$][ne]=s.createFramebuffer()}else G.__webglFramebuffer[$]=s.createFramebuffer()}else{if(y.mipmaps&&y.mipmaps.length>0){G.__webglFramebuffer=[];for(let $=0;$<y.mipmaps.length;$++)G.__webglFramebuffer[$]=s.createFramebuffer()}else G.__webglFramebuffer=s.createFramebuffer();if(fe)for(let $=0,ne=J.length;$<ne;$++){let xe=n.get(J[$]);xe.__webglTexture===void 0&&(xe.__webglTexture=s.createTexture(),o.memory.textures++)}if(I.samples>0&&Ye(I)===!1){G.__webglMultisampledFramebuffer=s.createFramebuffer(),G.__webglColorRenderbuffer=[],t.bindFramebuffer(s.FRAMEBUFFER,G.__webglMultisampledFramebuffer);for(let $=0;$<J.length;$++){let ne=J[$];G.__webglColorRenderbuffer[$]=s.createRenderbuffer(),s.bindRenderbuffer(s.RENDERBUFFER,G.__webglColorRenderbuffer[$]);let xe=r.convert(ne.format,ne.colorSpace),He=r.convert(ne.type),ge=_(ne.internalFormat,xe,He,ne.normalized,ne.colorSpace,I.isXRRenderTarget===!0),me=Le(I);s.renderbufferStorageMultisample(s.RENDERBUFFER,me,ge,I.width,I.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+$,s.RENDERBUFFER,G.__webglColorRenderbuffer[$])}s.bindRenderbuffer(s.RENDERBUFFER,null),I.depthBuffer&&(G.__webglDepthRenderbuffer=s.createRenderbuffer(),ke(G.__webglDepthRenderbuffer,I,!0)),t.bindFramebuffer(s.FRAMEBUFFER,null)}}if(ue){t.bindTexture(s.TEXTURE_CUBE_MAP,X.__webglTexture),we(s.TEXTURE_CUBE_MAP,y);for(let $=0;$<6;$++)if(y.mipmaps&&y.mipmaps.length>0)for(let ne=0;ne<y.mipmaps.length;ne++)_e(G.__webglFramebuffer[$][ne],I,y,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+$,ne);else _e(G.__webglFramebuffer[$],I,y,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+$,0);g(y)&&b(s.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(fe){for(let $=0,ne=J.length;$<ne;$++){let xe=J[$],He=n.get(xe),ge=s.TEXTURE_2D;(I.isWebGL3DRenderTarget||I.isWebGLArrayRenderTarget)&&(ge=I.isWebGL3DRenderTarget?s.TEXTURE_3D:s.TEXTURE_2D_ARRAY),t.bindTexture(ge,He.__webglTexture),we(ge,xe),_e(G.__webglFramebuffer,I,xe,s.COLOR_ATTACHMENT0+$,ge,0),g(xe)&&b(ge)}t.unbindTexture()}else{let $=s.TEXTURE_2D;if((I.isWebGL3DRenderTarget||I.isWebGLArrayRenderTarget)&&($=I.isWebGL3DRenderTarget?s.TEXTURE_3D:s.TEXTURE_2D_ARRAY),t.bindTexture($,X.__webglTexture),we($,y),y.mipmaps&&y.mipmaps.length>0)for(let ne=0;ne<y.mipmaps.length;ne++)_e(G.__webglFramebuffer[ne],I,y,s.COLOR_ATTACHMENT0,$,ne);else _e(G.__webglFramebuffer,I,y,s.COLOR_ATTACHMENT0,$,0);g(y)&&b($),t.unbindTexture()}I.depthBuffer&&te(I)}function oe(I){let y=I.textures;for(let G=0,X=y.length;G<X;G++){let J=y[G];if(g(J)){let ue=T(I),fe=n.get(J).__webglTexture;t.bindTexture(ue,fe),b(ue),t.unbindTexture()}}}let le=[],Be=[];function Ne(I){if(I.samples>0){if(Ye(I)===!1){let y=I.textures,G=I.width,X=I.height,J=s.COLOR_BUFFER_BIT,ue=I.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,fe=n.get(I),$=y.length>1;if($)for(let xe=0;xe<y.length;xe++)t.bindFramebuffer(s.FRAMEBUFFER,fe.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+xe,s.RENDERBUFFER,null),t.bindFramebuffer(s.FRAMEBUFFER,fe.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+xe,s.TEXTURE_2D,null,0);t.bindFramebuffer(s.READ_FRAMEBUFFER,fe.__webglMultisampledFramebuffer);let ne=I.texture.mipmaps;ne&&ne.length>0?t.bindFramebuffer(s.DRAW_FRAMEBUFFER,fe.__webglFramebuffer[0]):t.bindFramebuffer(s.DRAW_FRAMEBUFFER,fe.__webglFramebuffer);for(let xe=0;xe<y.length;xe++){if(I.resolveDepthBuffer&&(I.depthBuffer&&(J|=s.DEPTH_BUFFER_BIT),I.stencilBuffer&&I.resolveStencilBuffer&&(J|=s.STENCIL_BUFFER_BIT)),$){s.framebufferRenderbuffer(s.READ_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.RENDERBUFFER,fe.__webglColorRenderbuffer[xe]);let He=n.get(y[xe]).__webglTexture;s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,He,0)}s.blitFramebuffer(0,0,G,X,0,0,G,X,J,s.NEAREST),l===!0&&(le.length=0,Be.length=0,le.push(s.COLOR_ATTACHMENT0+xe),I.depthBuffer&&I.storeMultisampledDepthBuffer===!1&&(le.push(ue),Be.push(ue),s.invalidateFramebuffer(s.DRAW_FRAMEBUFFER,Be)),s.invalidateFramebuffer(s.READ_FRAMEBUFFER,le))}if(t.bindFramebuffer(s.READ_FRAMEBUFFER,null),t.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),$)for(let xe=0;xe<y.length;xe++){t.bindFramebuffer(s.FRAMEBUFFER,fe.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+xe,s.RENDERBUFFER,fe.__webglColorRenderbuffer[xe]);let He=n.get(y[xe]).__webglTexture;t.bindFramebuffer(s.FRAMEBUFFER,fe.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+xe,s.TEXTURE_2D,He,0)}t.bindFramebuffer(s.DRAW_FRAMEBUFFER,fe.__webglMultisampledFramebuffer)}else if(I.depthBuffer&&I.storeMultisampledDepthBuffer===!1&&l){let y=I.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT;s.invalidateFramebuffer(s.DRAW_FRAMEBUFFER,[y])}}}function Le(I){return Math.min(i.maxSamples,I.samples)}function Ye(I){let y=n.get(I);return I.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&y.__useRenderToTexture!==!1}function B(I){let y=o.render.frame;h.get(I)!==y&&(h.set(I,y),I.update())}function $e(I,y){let G=I.colorSpace,X=I.format,J=I.type;return I.isCompressedTexture===!0||I.isVideoTexture===!0||G!==fn&&G!==Pn&&(tt.getTransfer(G)===ht?(X!==pn||J!==cn)&&Ge("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Ze("WebGLTextures: Unsupported texture color space:",G)),y}function Ke(I){return typeof HTMLImageElement<"u"&&I instanceof HTMLImageElement?(c.width=I.naturalWidth||I.width,c.height=I.naturalHeight||I.height):typeof VideoFrame<"u"&&I instanceof VideoFrame?(c.width=I.displayWidth,c.height=I.displayHeight):(c.width=I.width,c.height=I.height),c}this.allocateTextureUnit=F,this.resetTextureUnits=w,this.getTextureUnits=P,this.setTextureUnits=U,this.setTexture2D=H,this.setTexture2DArray=k,this.setTexture3D=W,this.setTextureCube=Z,this.rebindTextures=ae,this.setupRenderTarget=re,this.updateRenderTargetMipmap=oe,this.updateMultisampleRenderTarget=Ne,this.setupDepthRenderbuffer=te,this.setupFrameBufferTexture=_e,this.useMultisampledRTT=Ye,this.isReversedDepthBuffer=function(){return t.buffers.depth.getReversed()}}function Wy(s,e){function t(n,i=Pn){let r,o=tt.getTransfer(i);if(n===cn)return s.UNSIGNED_BYTE;if(n===Cl)return s.UNSIGNED_SHORT_4_4_4_4;if(n===Rl)return s.UNSIGNED_SHORT_5_5_5_1;if(n===Jh)return s.UNSIGNED_INT_5_9_9_9_REV;if(n===Qh)return s.UNSIGNED_INT_10F_11F_11F_REV;if(n===Zh)return s.BYTE;if(n===Kh)return s.SHORT;if(n===xr)return s.UNSIGNED_SHORT;if(n===Al)return s.INT;if(n===Wn)return s.UNSIGNED_INT;if(n===Tn)return s.FLOAT;if(n===St)return s.HALF_FLOAT;if(n===$h)return s.ALPHA;if(n===eu)return s.RGB;if(n===pn)return s.RGBA;if(n===Jn)return s.DEPTH_COMPONENT;if(n===ri)return s.DEPTH_STENCIL;if(n===Pl)return s.RED;if(n===Ll)return s.RED_INTEGER;if(n===$i)return s.RG;if(n===Il)return s.RG_INTEGER;if(n===Dl)return s.RGBA_INTEGER;if(n===Bo||n===ko||n===zo||n===Ho)if(o===ht)if(r=e.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===Bo)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===ko)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===zo)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===Ho)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=e.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===Bo)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===ko)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===zo)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===Ho)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===Nl||n===Ul||n===Ol||n===Fl)if(r=e.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===Nl)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===Ul)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===Ol)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===Fl)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===Bl||n===kl||n===zl||n===Hl||n===Vl||n===Vo||n===Gl)if(r=e.get("WEBGL_compressed_texture_etc"),r!==null){if(n===Bl||n===kl)return o===ht?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===zl)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(n===Hl)return r.COMPRESSED_R11_EAC;if(n===Vl)return r.COMPRESSED_SIGNED_R11_EAC;if(n===Vo)return r.COMPRESSED_RG11_EAC;if(n===Gl)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===Wl||n===Xl||n===ql||n===Yl||n===jl||n===Zl||n===Kl||n===Jl||n===Ql||n===$l||n===ec||n===tc||n===nc||n===ic)if(r=e.get("WEBGL_compressed_texture_astc"),r!==null){if(n===Wl)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===Xl)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===ql)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===Yl)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===jl)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===Zl)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===Kl)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===Jl)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===Ql)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===$l)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===ec)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===tc)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===nc)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===ic)return o===ht?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===sc||n===rc||n===oc)if(r=e.get("EXT_texture_compression_bptc"),r!==null){if(n===sc)return o===ht?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===rc)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===oc)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===ac||n===lc||n===Go||n===cc)if(r=e.get("EXT_texture_compression_rgtc"),r!==null){if(n===ac)return r.COMPRESSED_RED_RGTC1_EXT;if(n===lc)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===Go)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===cc)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===Qi?s.UNSIGNED_INT_24_8:s[n]!==void 0?s[n]:null}return{convert:t}}var Xy=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,qy=`
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

}`,Cu=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let n=new oo(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,n=new ct({vertexShader:Xy,fragmentShader:qy,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new Re(new Vi(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},Ru=class extends Hn{constructor(e,t){super();let n=this,i=null,r=1,o=null,a="local-floor",l=1,c=null,h=null,f=null,d=null,u=null,p=null,x=typeof XRWebGLBinding<"u",m=new Cu,g={},b=t.getContextAttributes(),T=null,_=null,M=[],E=[],A=new ee,v=null,R=null,N=new Nt;N.viewport=new ut;let L=new Nt;L.viewport=new ut;let S=[N,L],w=new yl,P=null,U=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(q){let K=M[q];return K===void 0&&(K=new nr,M[q]=K),K.getTargetRaySpace()},this.getControllerGrip=function(q){let K=M[q];return K===void 0&&(K=new nr,M[q]=K),K.getGripSpace()},this.getHand=function(q){let K=M[q];return K===void 0&&(K=new nr,M[q]=K),K.getHandSpace()};function F(q){let K=E.indexOf(q.inputSource);if(K===-1)return;let de=M[K];de!==void 0&&(de.update(q.inputSource,q.frame,c||o),de.dispatchEvent({type:q.type,data:q.inputSource}))}function O(){i.removeEventListener("select",F),i.removeEventListener("selectstart",F),i.removeEventListener("selectend",F),i.removeEventListener("squeeze",F),i.removeEventListener("squeezestart",F),i.removeEventListener("squeezeend",F),i.removeEventListener("end",O),i.removeEventListener("inputsourceschange",H);for(let q=0;q<M.length;q++){let K=E[q];K!==null&&(E[q]=null,M[q].disconnect(K))}P=null,U=null,m.reset();for(let q in g)delete g[q];if(e.setRenderTarget(T),u=null,d=null,f=null,i=null,_=null,Pe.stop(),n.isPresenting=!1,e.setPixelRatio(v),e.setSize(A.width,A.height,!1),R!==null){let q=R.camera;q.fov=R.fov,q.zoom=R.zoom,q.updateProjectionMatrix(),R=null}n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(q){r=q,n.isPresenting===!0&&Ge("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(q){a=q,n.isPresenting===!0&&Ge("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||o},this.setReferenceSpace=function(q){c=q},this.getBaseLayer=function(){return d!==null?d:u},this.getBinding=function(){return f===null&&x&&(f=new XRWebGLBinding(i,t)),f},this.getFrame=function(){return p},this.getSession=function(){return i},this.setSession=async function(q){if(i=q,i!==null){if(T=e.getRenderTarget(),i.addEventListener("select",F),i.addEventListener("selectstart",F),i.addEventListener("selectend",F),i.addEventListener("squeeze",F),i.addEventListener("squeezestart",F),i.addEventListener("squeezeend",F),i.addEventListener("end",O),i.addEventListener("inputsourceschange",H),b.xrCompatible!==!0&&await t.makeXRCompatible(),v=e.getPixelRatio(),e.getSize(A),x&&"createProjectionLayer"in XRWebGLBinding.prototype){let de=null,De=null,_e=null;b.depth&&(_e=b.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,de=b.stencil?ri:Jn,De=b.stencil?Qi:Wn);let ke={colorFormat:t.RGBA8,depthFormat:_e,scaleFactor:r};f=this.getBinding(),d=f.createProjectionLayer(ke),i.updateRenderState({layers:[d]}),e.setPixelRatio(1),e.setSize(d.textureWidth,d.textureHeight,!1),_=new dt(d.textureWidth,d.textureHeight,{format:pn,type:cn,depthTexture:new ti(d.textureWidth,d.textureHeight,De,void 0,void 0,void 0,void 0,void 0,void 0,de),stencilBuffer:b.stencil,colorSpace:e.outputColorSpace,samples:b.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1,storeMultisampledDepthBuffer:d.ignoreDepthValues===!1,storeMultisampledStencilBuffer:d.ignoreDepthValues===!1})}else{let de={antialias:b.antialias,alpha:!0,depth:b.depth,stencil:b.stencil,framebufferScaleFactor:r};u=new XRWebGLLayer(i,t,de),i.updateRenderState({baseLayer:u}),e.setPixelRatio(1),e.setSize(u.framebufferWidth,u.framebufferHeight,!1),_=new dt(u.framebufferWidth,u.framebufferHeight,{format:pn,type:cn,colorSpace:e.outputColorSpace,stencilBuffer:b.stencil,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1,storeMultisampledDepthBuffer:u.ignoreDepthValues===!1,storeMultisampledStencilBuffer:u.ignoreDepthValues===!1})}_.isXRRenderTarget=!0,this.setFoveation(l),c=null,o=await i.requestReferenceSpace(a),Pe.setContext(i),Pe.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(i!==null)return i.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function H(q){for(let K=0;K<q.removed.length;K++){let de=q.removed[K],De=E.indexOf(de);De>=0&&(E[De]=null,M[De].disconnect(de))}for(let K=0;K<q.added.length;K++){let de=q.added[K],De=E.indexOf(de);if(De===-1){for(let ke=0;ke<M.length;ke++)if(ke>=E.length){E.push(de),De=ke;break}else if(E[ke]===null){E[ke]=de,De=ke;break}if(De===-1)break}let _e=M[De];_e&&_e.connect(de)}}let k=new D,W=new D;function Z(q,K,de){k.setFromMatrixPosition(K.matrixWorld),W.setFromMatrixPosition(de.matrixWorld);let De=k.distanceTo(W),_e=K.projectionMatrix.elements,ke=de.projectionMatrix.elements,et=_e[14]/(_e[10]-1),te=_e[14]/(_e[10]+1),ae=(_e[9]+1)/_e[5],re=(_e[9]-1)/_e[5],oe=(_e[8]-1)/_e[0],le=(ke[8]+1)/ke[0],Be=et*oe,Ne=et*le,Le=De/(-oe+le),Ye=Le*-oe;if(K.matrixWorld.decompose(q.position,q.quaternion,q.scale),q.translateX(Ye),q.translateZ(Le),q.matrixWorld.compose(q.position,q.quaternion,q.scale),q.matrixWorldInverse.copy(q.matrixWorld).invert(),_e[10]===-1)q.projectionMatrix.copy(K.projectionMatrix),q.projectionMatrixInverse.copy(K.projectionMatrixInverse);else{let B=et+Le,$e=te+Le,Ke=Be-Ye,I=Ne+(De-Ye),y=ae*te/$e*B,G=re*te/$e*B;q.projectionMatrix.makePerspective(Ke,I,y,G,B,$e),q.projectionMatrixInverse.copy(q.projectionMatrix).invert()}}function he(q,K){K===null?q.matrixWorld.copy(q.matrix):q.matrixWorld.multiplyMatrices(K.matrixWorld,q.matrix),q.matrixWorldInverse.copy(q.matrixWorld).invert()}this.updateCamera=function(q){if(i===null)return;let K=q.near,de=q.far;m.texture!==null&&(m.depthNear>0&&(K=m.depthNear),m.depthFar>0&&(de=m.depthFar)),w.near=L.near=N.near=K,w.far=L.far=N.far=de,(P!==w.near||U!==w.far)&&(i.updateRenderState({depthNear:w.near,depthFar:w.far}),P=w.near,U=w.far),w.layers.mask=q.layers.mask|6,N.layers.mask=w.layers.mask&-5,L.layers.mask=w.layers.mask&-3;let De=q.parent,_e=w.cameras;he(w,De);for(let ke=0;ke<_e.length;ke++)he(_e[ke],De);_e.length===2?Z(w,N,L):w.projectionMatrix.copy(N.projectionMatrix),R===null&&q.isPerspectiveCamera&&(R={camera:q,fov:q.fov,zoom:q.zoom}),pe(q,w,De)};function pe(q,K,de){de===null?q.matrix.copy(K.matrixWorld):(q.matrix.copy(de.matrixWorld),q.matrix.invert(),q.matrix.multiply(K.matrixWorld)),q.matrix.decompose(q.position,q.quaternion,q.scale),q.updateMatrixWorld(!0),q.projectionMatrix.copy(K.projectionMatrix),q.projectionMatrixInverse.copy(K.projectionMatrixInverse),q.isPerspectiveCamera&&(q.fov=hs*2*Math.atan(1/q.projectionMatrix.elements[5]),q.zoom=1)}this.getCamera=function(){return w},this.getFoveation=function(){if(!(d===null&&u===null))return l},this.setFoveation=function(q){l=q,d!==null&&(d.fixedFoveation=q),u!==null&&u.fixedFoveation!==void 0&&(u.fixedFoveation=q)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(w)},this.getCameraTexture=function(q){return g[q]};let Ae=null;function we(q,K){if(h=K.getViewerPose(c||o),p=K,h!==null){let de=h.views;u!==null&&(e.setRenderTargetFramebuffer(_,u.framebuffer),e.setRenderTarget(_));let De=!1;de.length!==w.cameras.length&&(w.cameras.length=0,De=!0);for(let te=0;te<de.length;te++){let ae=de[te],re=null;if(u!==null)re=u.getViewport(ae);else{let le=f.getViewSubImage(d,ae);re=le.viewport,te===0&&(e.setRenderTargetTextures(_,le.colorTexture,le.depthStencilTexture),e.setRenderTarget(_))}let oe=S[te];oe===void 0&&(oe=new Nt,oe.layers.enable(te),oe.viewport=new ut,S[te]=oe),oe.matrix.fromArray(ae.transform.matrix),oe.matrix.decompose(oe.position,oe.quaternion,oe.scale),oe.projectionMatrix.fromArray(ae.projectionMatrix),oe.projectionMatrixInverse.copy(oe.projectionMatrix).invert(),oe.viewport.set(re.x,re.y,re.width,re.height),te===0&&(w.matrix.copy(oe.matrix),w.matrix.decompose(w.position,w.quaternion,w.scale)),De===!0&&w.cameras.push(oe)}let _e=i.enabledFeatures;if(_e&&_e.includes("depth-sensing")&&i.depthUsage=="gpu-optimized"&&x){f=n.getBinding();let te=f.getDepthInformation(de[0]);te&&te.isValid&&te.texture&&m.init(te,i.renderState)}if(_e&&_e.includes("camera-access")&&x){e.state.unbindTexture(),f=n.getBinding();for(let te=0;te<de.length;te++){let ae=de[te].camera;if(ae){let re=g[ae];re||(re=new oo,g[ae]=re);let oe=f.getCameraImage(ae);re.sourceTexture=oe}}}}for(let de=0;de<M.length;de++){let De=E[de],_e=M[de];De!==null&&_e!==void 0&&_e.update(De,K,c||o)}Ae&&Ae(q,K),K.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:K}),p=null}let Pe=new Np;Pe.setAnimationLoop(we),this.setAnimationLoop=function(q){Ae=q},this.dispose=function(){}}},Yy=new je,zp=new Qe;zp.set(-1,0,0,0,1,0,0,0,1);function jy(s,e){function t(m,g){m.matrixAutoUpdate===!0&&m.updateMatrix(),g.value.copy(m.matrix)}function n(m,g){g.color.getRGB(m.fogColor.value,ou(s)),g.isFog?(m.fogNear.value=g.near,m.fogFar.value=g.far):g.isFogExp2&&(m.fogDensity.value=g.density)}function i(m,g,b,T,_){g.isNodeMaterial?g.uniformsNeedUpdate=!1:g.isMeshBasicMaterial?r(m,g):g.isMeshLambertMaterial?(r(m,g),g.envMap&&(m.envMapIntensity.value=g.envMapIntensity)):g.isMeshToonMaterial?(r(m,g),f(m,g)):g.isMeshPhongMaterial?(r(m,g),h(m,g),g.envMap&&(m.envMapIntensity.value=g.envMapIntensity)):g.isMeshStandardMaterial?(r(m,g),d(m,g),g.isMeshPhysicalMaterial&&u(m,g,_)):g.isMeshMatcapMaterial?(r(m,g),p(m,g)):g.isMeshDepthMaterial?r(m,g):g.isMeshDistanceMaterial?(r(m,g),x(m,g)):g.isMeshNormalMaterial?r(m,g):g.isLineBasicMaterial?(o(m,g),g.isLineDashedMaterial&&a(m,g)):g.isPointsMaterial?l(m,g,b,T):g.isSpriteMaterial?c(m,g):g.isShadowMaterial?(m.color.value.copy(g.color),m.opacity.value=g.opacity):g.isShaderMaterial&&(g.uniformsNeedUpdate=!1)}function r(m,g){m.opacity.value=g.opacity,g.color&&m.diffuse.value.copy(g.color),g.emissive&&m.emissive.value.copy(g.emissive).multiplyScalar(g.emissiveIntensity),g.map&&(m.map.value=g.map,t(g.map,m.mapTransform)),g.alphaMap&&(m.alphaMap.value=g.alphaMap,t(g.alphaMap,m.alphaMapTransform)),g.bumpMap&&(m.bumpMap.value=g.bumpMap,t(g.bumpMap,m.bumpMapTransform),m.bumpScale.value=g.bumpScale,g.side===en&&(m.bumpScale.value*=-1)),g.normalMap&&(m.normalMap.value=g.normalMap,t(g.normalMap,m.normalMapTransform),m.normalScale.value.copy(g.normalScale),g.side===en&&m.normalScale.value.negate()),g.displacementMap&&(m.displacementMap.value=g.displacementMap,t(g.displacementMap,m.displacementMapTransform),m.displacementScale.value=g.displacementScale,m.displacementBias.value=g.displacementBias),g.emissiveMap&&(m.emissiveMap.value=g.emissiveMap,t(g.emissiveMap,m.emissiveMapTransform)),g.specularMap&&(m.specularMap.value=g.specularMap,t(g.specularMap,m.specularMapTransform)),g.alphaTest>0&&(m.alphaTest.value=g.alphaTest);let b=e.get(g),T=b.envMap,_=b.envMapRotation;T&&(m.envMap.value=T,m.envMapRotation.value.setFromMatrix4(Yy.makeRotationFromEuler(_)).transpose(),T.isCubeTexture&&T.isRenderTargetTexture===!1&&m.envMapRotation.value.premultiply(zp),m.reflectivity.value=g.reflectivity,m.ior.value=g.ior,m.refractionRatio.value=g.refractionRatio),g.lightMap&&(m.lightMap.value=g.lightMap,m.lightMapIntensity.value=g.lightMapIntensity,t(g.lightMap,m.lightMapTransform)),g.aoMap&&(m.aoMap.value=g.aoMap,m.aoMapIntensity.value=g.aoMapIntensity,t(g.aoMap,m.aoMapTransform))}function o(m,g){m.diffuse.value.copy(g.color),m.opacity.value=g.opacity,g.map&&(m.map.value=g.map,t(g.map,m.mapTransform))}function a(m,g){m.dashSize.value=g.dashSize,m.totalSize.value=g.dashSize+g.gapSize,m.scale.value=g.scale}function l(m,g,b,T){m.diffuse.value.copy(g.color),m.opacity.value=g.opacity,m.size.value=g.size*b,m.scale.value=T*.5,g.map&&(m.map.value=g.map,t(g.map,m.uvTransform)),g.alphaMap&&(m.alphaMap.value=g.alphaMap,t(g.alphaMap,m.alphaMapTransform)),g.alphaTest>0&&(m.alphaTest.value=g.alphaTest)}function c(m,g){m.diffuse.value.copy(g.color),m.opacity.value=g.opacity,m.rotation.value=g.rotation,g.map&&(m.map.value=g.map,t(g.map,m.mapTransform)),g.alphaMap&&(m.alphaMap.value=g.alphaMap,t(g.alphaMap,m.alphaMapTransform)),g.alphaTest>0&&(m.alphaTest.value=g.alphaTest)}function h(m,g){m.specular.value.copy(g.specular),m.shininess.value=Math.max(g.shininess,1e-4)}function f(m,g){g.gradientMap&&(m.gradientMap.value=g.gradientMap)}function d(m,g){m.metalness.value=g.metalness,g.metalnessMap&&(m.metalnessMap.value=g.metalnessMap,t(g.metalnessMap,m.metalnessMapTransform)),m.roughness.value=g.roughness,g.roughnessMap&&(m.roughnessMap.value=g.roughnessMap,t(g.roughnessMap,m.roughnessMapTransform)),g.envMap&&(m.envMapIntensity.value=g.envMapIntensity)}function u(m,g,b){m.ior.value=g.ior,g.sheen>0&&(m.sheenColor.value.copy(g.sheenColor).multiplyScalar(g.sheen),m.sheenRoughness.value=g.sheenRoughness,g.sheenColorMap&&(m.sheenColorMap.value=g.sheenColorMap,t(g.sheenColorMap,m.sheenColorMapTransform)),g.sheenRoughnessMap&&(m.sheenRoughnessMap.value=g.sheenRoughnessMap,t(g.sheenRoughnessMap,m.sheenRoughnessMapTransform))),g.clearcoat>0&&(m.clearcoat.value=g.clearcoat,m.clearcoatRoughness.value=g.clearcoatRoughness,g.clearcoatMap&&(m.clearcoatMap.value=g.clearcoatMap,t(g.clearcoatMap,m.clearcoatMapTransform)),g.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=g.clearcoatRoughnessMap,t(g.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),g.clearcoatNormalMap&&(m.clearcoatNormalMap.value=g.clearcoatNormalMap,t(g.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(g.clearcoatNormalScale),g.side===en&&m.clearcoatNormalScale.value.negate())),g.dispersion>0&&(m.dispersion.value=g.dispersion),g.retroreflectivity>0&&(m.retroreflectivity.value=g.retroreflectivity),g.iridescence>0&&(m.iridescence.value=g.iridescence,m.iridescenceIOR.value=g.iridescenceIOR,m.iridescenceThicknessMinimum.value=g.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=g.iridescenceThicknessRange[1],g.iridescenceMap&&(m.iridescenceMap.value=g.iridescenceMap,t(g.iridescenceMap,m.iridescenceMapTransform)),g.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=g.iridescenceThicknessMap,t(g.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),g.transmission>0&&(m.transmission.value=g.transmission,m.transmissionSamplerMap.value=b.texture,m.transmissionSamplerSize.value.set(b.width,b.height),g.transmissionMap&&(m.transmissionMap.value=g.transmissionMap,t(g.transmissionMap,m.transmissionMapTransform)),m.thickness.value=g.thickness,g.thicknessMap&&(m.thicknessMap.value=g.thicknessMap,t(g.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=g.attenuationDistance,m.attenuationColor.value.copy(g.attenuationColor)),g.anisotropy>0&&(m.anisotropyVector.value.set(g.anisotropy*Math.cos(g.anisotropyRotation),g.anisotropy*Math.sin(g.anisotropyRotation)),g.anisotropyMap&&(m.anisotropyMap.value=g.anisotropyMap,t(g.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=g.specularIntensity,m.specularColor.value.copy(g.specularColor),g.specularColorMap&&(m.specularColorMap.value=g.specularColorMap,t(g.specularColorMap,m.specularColorMapTransform)),g.specularIntensityMap&&(m.specularIntensityMap.value=g.specularIntensityMap,t(g.specularIntensityMap,m.specularIntensityMapTransform))}function p(m,g){g.matcap&&(m.matcap.value=g.matcap)}function x(m,g){let b=e.get(g).light;m.referencePosition.value.setFromMatrixPosition(b.matrixWorld),m.nearDistance.value=b.shadow.camera.near,m.farDistance.value=b.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:i}}function Zy(s,e,t,n){let i={},r={},o=[],a=s.getParameter(s.MAX_UNIFORM_BUFFER_BINDINGS);function l(_,M){let E=M.program;n.uniformBlockBinding(_,E)}function c(_,M){let E=i[_.id];E===void 0&&(m(_),E=h(_),i[_.id]=E,_.addEventListener("dispose",b));let A=M.program;n.updateUBOMapping(_,A);let v=e.render.frame;r[_.id]!==v&&(d(_),r[_.id]=v)}function h(_){let M=f();_.__bindingPointIndex=M;let E=s.createBuffer(),A=_.__size,v=_.usage;return s.bindBuffer(s.UNIFORM_BUFFER,E),s.bufferData(s.UNIFORM_BUFFER,A,v),s.bindBuffer(s.UNIFORM_BUFFER,null),s.bindBufferBase(s.UNIFORM_BUFFER,M,E),E}function f(){for(let _=0;_<a;_++)if(o.indexOf(_)===-1)return o.push(_),_;return Ze("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(_){let M=i[_.id],E=_.uniforms,A=_.__cache;s.bindBuffer(s.UNIFORM_BUFFER,M);for(let v=0,R=E.length;v<R;v++){let N=E[v];if(Array.isArray(N))for(let L=0,S=N.length;L<S;L++)u(N[L],v,L,A);else u(N,v,0,A)}s.bindBuffer(s.UNIFORM_BUFFER,null)}function u(_,M,E,A){if(x(_,M,E,A)===!0){let v=_.__offset,R=_.value;if(Array.isArray(R)){let N=0;for(let L=0;L<R.length;L++){let S=R[L],w=g(S);p(S,_.__data,N),typeof S!="number"&&typeof S!="boolean"&&!S.isMatrix3&&!ArrayBuffer.isView(S)&&(N+=w.storage/Float32Array.BYTES_PER_ELEMENT)}}else p(R,_.__data,0);s.bufferSubData(s.UNIFORM_BUFFER,v,_.__data)}}function p(_,M,E){typeof _=="number"||typeof _=="boolean"?M[0]=_:_.isMatrix3?(M[0]=_.elements[0],M[1]=_.elements[1],M[2]=_.elements[2],M[3]=0,M[4]=_.elements[3],M[5]=_.elements[4],M[6]=_.elements[5],M[7]=0,M[8]=_.elements[6],M[9]=_.elements[7],M[10]=_.elements[8],M[11]=0):ArrayBuffer.isView(_)?M.set(new _.constructor(_.buffer,_.byteOffset,M.length)):_.toArray(M,E)}function x(_,M,E,A){let v=_.value,R=M+"_"+E;if(A[R]===void 0)return typeof v=="number"||typeof v=="boolean"?A[R]=v:ArrayBuffer.isView(v)?A[R]=v.slice():A[R]=v.clone(),!0;{let N=A[R];if(typeof v=="number"||typeof v=="boolean"){if(N!==v)return A[R]=v,!0}else{if(ArrayBuffer.isView(v))return!0;if(N.equals(v)===!1)return N.copy(v),!0}}return!1}function m(_){let M=_.uniforms,E=0,A=16;for(let R=0,N=M.length;R<N;R++){let L=Array.isArray(M[R])?M[R]:[M[R]];for(let S=0,w=L.length;S<w;S++){let P=L[S],U=Array.isArray(P.value)?P.value:[P.value];for(let F=0,O=U.length;F<O;F++){let H=U[F],k=g(H),W=E%A,Z=W%k.boundary,he=W+Z;E+=Z,he!==0&&A-he<k.storage&&(E+=A-he),P.__data=new Float32Array(k.storage/Float32Array.BYTES_PER_ELEMENT),P.__offset=E,E+=k.storage}}}let v=E%A;return v>0&&(E+=A-v),_.__size=E,_.__cache={},this}function g(_){let M={boundary:0,storage:0};return typeof _=="number"||typeof _=="boolean"?(M.boundary=4,M.storage=4):_.isVector2?(M.boundary=8,M.storage=8):_.isVector3||_.isColor?(M.boundary=16,M.storage=12):_.isVector4?(M.boundary=16,M.storage=16):_.isMatrix3?(M.boundary=48,M.storage=48):_.isMatrix4?(M.boundary=64,M.storage=64):_.isTexture?Ge("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(_)?(M.boundary=16,M.storage=_.byteLength):Ge("WebGLRenderer: Unsupported uniform value type.",_),M}function b(_){let M=_.target;M.removeEventListener("dispose",b);let E=o.indexOf(M.__bindingPointIndex);o.splice(E,1),s.deleteBuffer(i[M.id]),delete i[M.id],delete r[M.id]}function T(){for(let _ in i)s.deleteBuffer(i[_]);o=[],i={},r={}}return{bind:l,update:c,dispose:T}}var Ky=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),oi=null;function Jy(){return oi===null&&(oi=new ei(Ky,16,16,$i,St),oi.name="DFG_LUT",oi.minFilter=It,oi.magFilter=It,oi.wrapS=mn,oi.wrapT=mn,oi.generateMipmaps=!1,oi.needsUpdate=!0),oi}var mc=class{constructor(e={}){let{canvas:t=tp(),context:n=null,depth:i=!0,stencil:r=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:f=!1,reversedDepthBuffer:d=!1,outputBufferType:u=cn}=e;this.isWebGLRenderer=!0;let p;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");p=n.getContextAttributes().alpha}else p=o;let x=u,m=new Set([Dl,Il,Ll]),g=new Set([cn,Wn,xr,Qi,Cl,Rl]),b=new Uint32Array(4),T=new Int32Array(4),_=new D,M=null,E=null,A=[],v=[],R=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=wn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let N=this,L=!1,S=null,w=null,P=null,U=null;this._outputColorSpace=Mt;let F=0,O=0,H=null,k=-1,W=null,Z=new ut,he=new ut,pe=null,Ae=new Ee(0),we=0,Pe=t.width,q=t.height,K=1,de=null,De=null,_e=new ut(0,0,Pe,q),ke=new ut(0,0,Pe,q),et=!1,te=new or,ae=!1,re=!1,oe=new je,le=new D,Be=new ut,Ne={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},Le=!1;function Ye(){return H===null?K:1}let B=n;function $e(C,z){return t.getContext(C,z)}let Ke,I,y,G,X,J,ue,fe,$,ne,xe,He,ge,me,Ue,We,Je,V,ve,ie,ye,Te,ce;try{let C={alpha:!0,depth:i,stencil:r,antialias:a,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:f};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${"186"}`),t.addEventListener("webglcontextlost",wt,!1),t.addEventListener("webglcontextrestored",ft,!1),t.addEventListener("webglcontextcreationerror",Un,!1),B===null){let z="webgl2";if(B=$e(z,C),B===null)throw $e(z)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}Xe()}catch(C){throw t.removeEventListener("webglcontextlost",wt,!1),t.removeEventListener("webglcontextrestored",ft,!1),t.removeEventListener("webglcontextcreationerror",Un,!1),Ze("WebGLRenderer: "+C.message),C}function Xe(){Ke=new sv(B),Ke.init(),ye=new Wy(B,Ke),I=new j_(B,Ke,e,ye),y=new Vy(B,Ke),I.reversedDepthBuffer&&d&&y.buffers.depth.setReversed(!0),w=B.createFramebuffer(),P=B.createFramebuffer(),U=B.createFramebuffer(),G=new av(B),X=new Cy,J=new Gy(B,Ke,y,X,I,ye,G),ue=new iv(N),fe=new cg(B),Te=new q_(B,fe),$=new rv(B,fe,G,Te),ne=new cv(B,$,fe,Te,G),V=new lv(B,I,J),Ue=new Z_(X),xe=new Ay(N,ue,Ke,I,Te,Ue),He=new jy(N,X),ge=new Py,me=new Oy(Ke),Je=new X_(N,ue,y,ne,p,l),We=new Hy(N,ne,I),ce=new Zy(B,G,I,y),ve=new Y_(B,Ke,G),ie=new ov(B,Ke,G),G.programs=xe.programs,N.capabilities=I,N.extensions=Ke,N.properties=X,N.renderLists=ge,N.shadowMap=We,N.state=y,N.info=G}x!==cn&&(R=new uv(x,t.width,t.height,a,i,r));let ze=new Ru(N,B);this.xr=ze,this.getContext=function(){return B},this.getContextAttributes=function(){return B.getContextAttributes()},this.forceContextLoss=function(){let C=Ke.get("WEBGL_lose_context");C&&C.loseContext()},this.forceContextRestore=function(){let C=Ke.get("WEBGL_lose_context");C&&C.restoreContext()},this.getPixelRatio=function(){return K},this.setPixelRatio=function(C){C!==void 0&&(K=C,this.setSize(Pe,q,!1))},this.getSize=function(C){return C.set(Pe,q)},this.setSize=function(C,z,Q=!0){if(ze.isPresenting){Ge("WebGLRenderer: Can't change size while VR device is presenting.");return}Pe=C,q=z,t.width=Math.floor(C*K),t.height=Math.floor(z*K),Q===!0&&(t.style.width=C+"px",t.style.height=z+"px"),R!==null&&R.setSize(t.width,t.height),this.setViewport(0,0,C,z)},this.getDrawingBufferSize=function(C){return C.set(Pe*K,q*K).floor()},this.setDrawingBufferSize=function(C,z,Q){Pe=C,q=z,K=Q,t.width=Math.floor(C*Q),t.height=Math.floor(z*Q),this.setViewport(0,0,C,z)},this.setEffects=function(C){if(x===cn){Ze("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(C){for(let z=0;z<C.length;z++)if(C[z].isOutputPass===!0){Ge("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}R.setEffects(C||[])},this.getCurrentViewport=function(C){return C.copy(Z)},this.getViewport=function(C){return C.copy(_e)},this.setViewport=function(C,z,Q,Y){C.isVector4?_e.set(C.x,C.y,C.z,C.w):_e.set(C,z,Q,Y),y.viewport(Z.copy(_e).multiplyScalar(K).round())},this.getScissor=function(C){return C.copy(ke)},this.setScissor=function(C,z,Q,Y){C.isVector4?ke.set(C.x,C.y,C.z,C.w):ke.set(C,z,Q,Y),y.scissor(he.copy(ke).multiplyScalar(K).round())},this.getScissorTest=function(){return et},this.setScissorTest=function(C){y.setScissorTest(et=C)},this.setOpaqueSort=function(C){de=C},this.setTransparentSort=function(C){De=C},this.getClearColor=function(C){return C.copy(Je.getClearColor())},this.setClearColor=function(){Je.setClearColor(...arguments)},this.getClearAlpha=function(){return Je.getClearAlpha()},this.setClearAlpha=function(){Je.setClearAlpha(...arguments)},this.clear=function(C=!0,z=!0,Q=!0){let Y=0;if(C){let j=!1;if(H!==null){let Se=H.texture.format;j=m.has(Se)}if(j){let Se=H.texture.type,Ie=g.has(Se),be=Je.getClearColor(),Oe=Je.getClearAlpha(),Ve=be.r,it=be.g,ot=be.b;Ie?(b[0]=Ve,b[1]=it,b[2]=ot,b[3]=Oe,B.clearBufferuiv(B.COLOR,0,b)):(T[0]=Ve,T[1]=it,T[2]=ot,T[3]=Oe,B.clearBufferiv(B.COLOR,0,T))}else Y|=B.COLOR_BUFFER_BIT}z&&(Y|=B.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),Q&&(Y|=B.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),Y!==0&&B.clear(Y)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(C){C.setRenderer(this),S=C},this.dispose=function(){t.removeEventListener("webglcontextlost",wt,!1),t.removeEventListener("webglcontextrestored",ft,!1),t.removeEventListener("webglcontextcreationerror",Un,!1),Je.dispose(),ge.dispose(),me.dispose(),X.dispose(),ue.dispose(),ne.dispose(),Te.dispose(),ce.dispose(),xe.dispose(),ze.dispose(),ze.removeEventListener("sessionstart",bd),ze.removeEventListener("sessionend",Sd),ns.stop()};function wt(C){C.preventDefault(),Zr("WebGLRenderer: Context Lost."),L=!0}function ft(){Zr("WebGLRenderer: Context Restored."),L=!1;let C=G.autoReset,z=We.enabled,Q=We.autoUpdate,Y=We.needsUpdate,j=We.type;Xe(),G.autoReset=C,We.enabled=z,We.autoUpdate=Q,We.needsUpdate=Y,We.type=j}function Un(C){Ze("WebGLRenderer: A WebGL context could not be created. Reason: ",C.statusMessage)}function qn(C){let z=C.target;z.removeEventListener("dispose",qn),wm(z)}function wm(C){Tm(C),X.remove(C)}function Tm(C){let z=X.get(C).programs;z!==void 0&&(z.forEach(function(Q){xe.releaseProgram(Q)}),C.isShaderMaterial&&xe.releaseShaderCache(C))}this.renderBufferDirect=function(C,z,Q,Y,j,Se){z===null&&(z=Ne);let Ie=j.isMesh&&j.matrixWorld.determinantAffine()<0,be=Cm(C,z,Q,Y,j);y.setMaterial(Y,Ie);let Oe=Q.index,Ve=1;if(Y.wireframe===!0){if(Oe=$.getWireframeAttribute(Q),Oe===void 0)return;Ve=2}let it=Q.drawRange,ot=Q.attributes.position,Fe=it.start*Ve,pt=(it.start+it.count)*Ve;Se!==null&&(Fe=Math.max(Fe,Se.start*Ve),pt=Math.min(pt,(Se.start+Se.count)*Ve)),Oe!==null?(Fe=Math.max(Fe,0),pt=Math.min(pt,Oe.count)):ot!=null&&(Fe=Math.max(Fe,0),pt=Math.min(pt,ot.count));let Vt=pt-Fe;if(Vt<0||Vt===1/0)return;Te.setup(j,Y,be,Q,Oe);let At,vt=ve;if(Oe!==null&&(At=fe.get(Oe),vt=ie,vt.setIndex(At)),j.isMesh)Y.wireframe===!0?(y.setLineWidth(Y.wireframeLinewidth*Ye()),vt.setMode(B.LINES)):vt.setMode(B.TRIANGLES);else if(j.isLine){let nn=Y.linewidth;nn===void 0&&(nn=1),y.setLineWidth(nn*Ye()),j.isLineSegments?vt.setMode(B.LINES):j.isLineLoop?vt.setMode(B.LINE_LOOP):vt.setMode(B.LINE_STRIP)}else j.isPoints?vt.setMode(B.POINTS):j.isSprite&&vt.setMode(B.TRIANGLES);if(j.isBatchedMesh)if(Ke.get("WEBGL_multi_draw"))vt.renderMultiDraw(j._multiDrawStarts,j._multiDrawCounts,j._multiDrawCount);else{let nn=j._multiDrawStarts,Ce=j._multiDrawCounts,un=j._multiDrawCount,lt=Oe?fe.get(Oe).bytesPerElement:1,En=X.get(Y).currentProgram.getUniforms();for(let Yn=0;Yn<un;Yn++)En.setValue(B,"_gl_DrawID",Yn),vt.render(nn[Yn]/lt,Ce[Yn])}else if(j.isInstancedMesh)vt.renderInstances(Fe,Vt,j.count);else if(Q.isInstancedBufferGeometry){let nn=Q._maxInstanceCount!==void 0?Q._maxInstanceCount:1/0,Ce=Math.min(Q.instanceCount,nn);vt.renderInstances(Fe,Vt,Ce)}else vt.render(Fe,Vt)};function Md(C,z,Q,Y){S!==null&&C.isNodeMaterial&&S.setObject(Y,C),ae===!0&&Ue.setState(C,Q,!1),C.transparent===!0&&C.side===Ot&&C.forceSinglePass===!1?(C.side=en,C.needsUpdate=!0,ua(C,z,Y),C.side=si,C.needsUpdate=!0,ua(C,z,Y),C.side=Ot):ua(C,z,Y)}this.compile=function(C,z,Q=null){Q===null&&(Q=C),S!==null&&S.renderStart(C,z,Q),E=me.get(Q),E.init(z),v.push(E),Q.traverseVisible(function(j){j.isLight&&j.layers.test(z.layers)&&(E.pushLight(j),j.castShadow&&E.pushShadow(j))}),C!==Q&&C.traverseVisible(function(j){j.isLight&&j.layers.test(z.layers)&&(E.pushLight(j),j.castShadow&&E.pushShadow(j))}),E.setupLights(),S!==null&&S.updateLights(E.state.lightsArray),re=this.localClippingEnabled,ae=Ue.init(this.clippingPlanes,re),ae===!0&&Ue.setGlobalState(this.clippingPlanes,z),S!==null&&We.render(E.state.shadowsArray,Q,z);let Y=new Set;return C.traverse(function(j){if(!(j.isMesh||j.isPoints||j.isLine||j.isSprite))return;let Se=j.material;if(Se)if(Array.isArray(Se))for(let Ie=0;Ie<Se.length;Ie++){let be=Se[Ie];Md(be,Q,z,j),Y.add(be)}else Md(Se,Q,z,j),Y.add(Se)}),E=v.pop(),S!==null&&S.renderEnd(),Y},this.compileAsync=function(C,z,Q=null){let Y=this.compile(C,z,Q);return new Promise(j=>{function Se(){if(Y.forEach(function(Ie){let Oe=X.get(Ie).currentProgram;(Oe===void 0||Oe.isReady())&&Y.delete(Ie)}),Y.size===0){j(C);return}setTimeout(Se,10)}Ke.get("KHR_parallel_shader_compile")!==null?Se():setTimeout(Se,10)})};let Kc=null;function Em(C){Kc&&Kc(C)}function bd(){ns.stop()}function Sd(){ns.start()}let ns=new Np;ns.setAnimationLoop(Em),typeof self<"u"&&ns.setContext(self),this.setAnimationLoop=function(C){Kc=C,ze.setAnimationLoop(C),C===null?ns.stop():ns.start()},ze.addEventListener("sessionstart",bd),ze.addEventListener("sessionend",Sd),this.render=function(C,z){if(z!==void 0&&z.isCamera!==!0){Ze("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(L===!0)return;S!==null&&S.renderStart(C,z);let Q=ze.enabled===!0&&ze.isPresenting===!0,Y=R!==null&&(H===null||Q)&&R.begin(N,H);if(C.matrixWorldAutoUpdate===!0&&C.updateMatrixWorld(),z.parent===null&&z.matrixWorldAutoUpdate===!0&&z.updateMatrixWorld(),ze.enabled===!0&&ze.isPresenting===!0&&(R===null||R.isCompositing()===!1)&&(ze.cameraAutoUpdate===!0&&ze.updateCamera(z),z=ze.getCamera()),C.isScene===!0&&C.onBeforeRender(N,C,z,H),E=me.get(C,v.length),E.init(z),E.state.textureUnits=J.getTextureUnits(),v.push(E),oe.multiplyMatrices(z.projectionMatrix,z.matrixWorldInverse),te.setFromProjectionMatrix(oe,zn,z.reversedDepth),re=this.localClippingEnabled,ae=Ue.init(this.clippingPlanes,re),M=ge.get(C,A.length),M.init(),A.push(M),ze.enabled===!0&&ze.isPresenting===!0){let Ie=N.xr.getDepthSensingMesh();Ie!==null&&Jc(Ie,z,-1/0,N.sortObjects)}Jc(C,z,0,N.sortObjects),M.finish(),S!==null&&S.updateLights(E.state.lightsArray),N.sortObjects===!0&&M.sort(de,De),Le=ze.enabled===!1||ze.isPresenting===!1||ze.hasDepthSensing()===!1,Le&&Je.addToRenderList(M,C),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),ae===!0&&Ue.beginShadows();let j=E.state.shadowsArray;if(We.render(j,C,z),ae===!0&&Ue.endShadows(),(Y&&R.hasRenderPass())===!1){let Ie=M.opaque,be=M.transmissive;if(E.setupLights(),z.isArrayCamera){let Oe=z.cameras;if(be.length>0)for(let Ve=0,it=Oe.length;Ve<it;Ve++){let ot=Oe[Ve];Td(Ie,be,C,ot)}Le&&Je.render(C);for(let Ve=0,it=Oe.length;Ve<it;Ve++){let ot=Oe[Ve];wd(M,C,ot,ot.viewport)}}else be.length>0&&Td(Ie,be,C,z),Le&&Je.render(C),wd(M,C,z)}H!==null&&O===0&&(J.updateMultisampleRenderTarget(H),J.updateRenderTargetMipmap(H)),Y&&R.end(N),C.isScene===!0&&C.onAfterRender(N,C,z),Te.resetDefaultState(),k=-1,W=null,v.pop(),v.length>0?(E=v[v.length-1],J.setTextureUnits(E.state.textureUnits),ae===!0&&Ue.setGlobalState(N.clippingPlanes,E.state.camera)):E=null,A.pop(),A.length>0?M=A[A.length-1]:M=null,S!==null&&S.renderEnd()};function Jc(C,z,Q,Y){if(C.visible===!1)return;if(C.layers.test(z.layers)){if(C.isGroup)Q=C.renderOrder;else if(C.isLOD)C.autoUpdate===!0&&C.update(z);else if(C.isLightProbeGrid)E.pushLightProbeGrid(C);else if(C.isLight)E.pushLight(C),C.castShadow&&E.pushShadow(C);else if(C.isSprite){if(!C.frustumCulled||C.intersectsFrustum(te)){Y&&Be.setFromMatrixPosition(C.matrixWorld).applyMatrix4(oe);let Ie=ne.update(C),be=C.material;be.visible&&M.push(C,Ie,be,Q,Be.z,null,z)}}else if((C.isMesh||C.isLine||C.isPoints)&&(!C.frustumCulled||C.intersectsFrustum(te))){let Ie=ne.update(C),be=C.material;if(Y&&(C.boundingSphere!==void 0?(C.boundingSphere===null&&C.computeBoundingSphere(),Be.copy(C.boundingSphere.center)):(Ie.boundingSphere===null&&Ie.computeBoundingSphere(),Be.copy(Ie.boundingSphere.center)),Be.applyMatrix4(C.matrixWorld).applyMatrix4(oe)),Array.isArray(be)){let Oe=Ie.groups;for(let Ve=0,it=Oe.length;Ve<it;Ve++){let ot=Oe[Ve],Fe=be[ot.materialIndex];Fe&&Fe.visible&&M.push(C,Ie,Fe,Q,Be.z,ot,z)}}else be.visible&&M.push(C,Ie,be,Q,Be.z,null,z)}}let Se=C.children;for(let Ie=0,be=Se.length;Ie<be;Ie++)Jc(Se[Ie],z,Q,Y)}function wd(C,z,Q,Y){let{opaque:j,transmissive:Se,transparent:Ie}=C;E.setupLightsView(Q),ae===!0&&Ue.setGlobalState(N.clippingPlanes,Q),Y&&y.viewport(Z.copy(Y)),j.length>0&&ha(j,z,Q),Se.length>0&&ha(Se,z,Q),Ie.length>0&&ha(Ie,z,Q),y.buffers.depth.setTest(!0),y.buffers.depth.setMask(!0),y.buffers.color.setMask(!0),y.setPolygonOffset(!1)}function Td(C,z,Q,Y){if((Q.isScene===!0?Q.overrideMaterial:null)!==null)return;if(E.state.transmissionRenderTarget[Y.id]===void 0){let Fe=Ke.has("EXT_color_buffer_half_float")||Ke.has("EXT_color_buffer_float");E.state.transmissionRenderTarget[Y.id]=new dt(1,1,{generateMipmaps:!0,type:Fe?St:cn,minFilter:Gn,samples:Math.max(4,I.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:tt.workingColorSpace})}let Se=E.state.transmissionRenderTarget[Y.id],Ie=Y.viewport||Z;Se.setSize(Ie.z*N.transmissionResolutionScale,Ie.w*N.transmissionResolutionScale);let be=N.getRenderTarget(),Oe=N.getActiveCubeFace(),Ve=N.getActiveMipmapLevel();N.setRenderTarget(Se),N.getClearColor(Ae),we=N.getClearAlpha(),we<1&&N.setClearColor(16777215,.5),N.clear(),Le&&Je.render(Q);let it=N.toneMapping;N.toneMapping=wn;let ot=Y.viewport;if(Y.viewport!==void 0&&(Y.viewport=void 0),E.setupLightsView(Y),ae===!0&&Ue.setGlobalState(N.clippingPlanes,Y),ha(C,Q,Y),J.updateMultisampleRenderTarget(Se),J.updateRenderTargetMipmap(Se),Ke.has("WEBGL_multisampled_render_to_texture")===!1){let Fe=!1;for(let pt=0,Vt=z.length;pt<Vt;pt++){let At=z[pt],{object:vt,geometry:nn,material:Ce,group:un}=At;if(Ce.side===Ot&&vt.layers.test(Y.layers)){let lt=Ce.side;Ce.side=en,Ce.needsUpdate=!0,Ed(vt,Q,Y,nn,Ce,un),Ce.side=lt,Ce.needsUpdate=!0,Fe=!0}}Fe===!0&&(J.updateMultisampleRenderTarget(Se),J.updateRenderTargetMipmap(Se))}N.setRenderTarget(be,Oe,Ve),N.setClearColor(Ae,we),ot!==void 0&&(Y.viewport=ot),N.toneMapping=it}function ha(C,z,Q){let Y=z.isScene===!0?z.overrideMaterial:null;for(let j=0,Se=C.length;j<Se;j++){let Ie=C[j],{object:be,geometry:Oe,group:Ve}=Ie,it=Ie.material;it.allowOverride===!0&&Y!==null&&(it=Y),be.layers.test(Q.layers)&&Ed(be,z,Q,Oe,it,Ve)}}function Ed(C,z,Q,Y,j,Se){S!==null&&j.isNodeMaterial&&S.setObject(C,j),C.onBeforeRender(N,z,Q,Y,j,Se),C.modelViewMatrix.multiplyMatrices(Q.matrixWorldInverse,C.matrixWorld),C.normalMatrix.getNormalMatrix(C.modelViewMatrix),j.onBeforeRender(N,z,Q,Y,C,Se),j.transparent===!0&&j.side===Ot&&j.forceSinglePass===!1?(j.side=en,j.needsUpdate=!0,N.renderBufferDirect(Q,z,Y,j,C,Se),j.side=si,j.needsUpdate=!0,N.renderBufferDirect(Q,z,Y,j,C,Se),j.side=Ot):N.renderBufferDirect(Q,z,Y,j,C,Se),C.onAfterRender(N,z,Q,Y,j,Se)}function ua(C,z,Q){z.isScene!==!0&&(z=Ne);let Y=X.get(C),j=E.state.lights,Se=E.state.shadowsArray,Ie=j.state.version,be=xe.getParameters(C,j.state,Se,z,Q,E.state.lightProbeGridArray),Oe=xe.getProgramCacheKey(be),Ve=Y.programs;Y.environment=C.isMeshStandardMaterial||C.isMeshLambertMaterial||C.isMeshPhongMaterial?z.environment:null,Y.fog=z.fog;let it=C.isMeshStandardMaterial||C.isMeshLambertMaterial&&!C.envMap||C.isMeshPhongMaterial&&!C.envMap;Y.envMap=ue.get(C.envMap||Y.environment,it),Y.envMapRotation=Y.environment!==null&&C.envMap===null?z.environmentRotation:C.envMapRotation,Ve===void 0&&(C.addEventListener("dispose",qn),Ve=new Map,Y.programs=Ve);let ot=Ve.get(Oe);if(ot!==void 0){if(Y.currentProgram===ot&&Y.lightsStateVersion===Ie)return Cd(C,be),ot}else be.uniforms=xe.getUniforms(C),S!==null&&C.isNodeMaterial&&S.build(C,Q,be),C.onBeforeCompile(be,N),ot=xe.acquireProgram(be,Oe),Ve.set(Oe,ot),Y.uniforms=be.uniforms;let Fe=Y.uniforms;return(!C.isShaderMaterial&&!C.isRawShaderMaterial||C.clipping===!0)&&(Fe.clippingPlanes=Ue.uniform),Cd(C,be),Y.needsLights=Pm(C),Y.lightsStateVersion=Ie,Y.needsLights&&(Fe.ambientLightColor.value=j.state.ambient,Fe.lightProbe.value=j.state.probe,Fe.sunLights.value=j.state.sun,Fe.sunLightShadows.value=j.state.sunShadow,Fe.directionalLights.value=j.state.directional,Fe.directionalLightShadows.value=j.state.directionalShadow,Fe.spotLights.value=j.state.spot,Fe.spotLightShadows.value=j.state.spotShadow,Fe.rectAreaLights.value=j.state.rectArea,Fe.ltc_1.value=j.state.rectAreaLTC1,Fe.ltc_2.value=j.state.rectAreaLTC2,Fe.pointLights.value=j.state.point,Fe.pointLightShadows.value=j.state.pointShadow,Fe.hemisphereLights.value=j.state.hemi,Fe.sunShadowMatrix.value=j.state.sunShadowMatrix,Fe.sunShadowCascade.value=j.state.sunShadowCascade,Fe.directionalShadowMatrix.value=j.state.directionalShadowMatrix,Fe.spotLightMatrix.value=j.state.spotLightMatrix,Fe.spotLightMap.value=j.state.spotLightMap,Fe.pointShadowMatrix.value=j.state.pointShadowMatrix),Y.lightProbeGrid=E.state.lightProbeGridArray.length>0,Y.currentProgram=ot,Y.uniformsList=null,ot}function Ad(C){if(C.uniformsList===null){let z=C.currentProgram.getUniforms();C.uniformsList=br.seqWithValue(z.seq,C.uniforms)}return C.uniformsList}function Cd(C,z){let Q=X.get(C);Q.outputColorSpace=z.outputColorSpace,Q.batching=z.batching,Q.batchingColor=z.batchingColor,Q.instancing=z.instancing,Q.instancingColor=z.instancingColor,Q.instancingMorph=z.instancingMorph,Q.skinning=z.skinning,Q.morphTargets=z.morphTargets,Q.morphNormals=z.morphNormals,Q.morphColors=z.morphColors,Q.morphTargetsCount=z.morphTargetsCount,Q.numClippingPlanes=z.numClippingPlanes,Q.numIntersection=z.numClipIntersection,Q.vertexAlphas=z.vertexAlphas,Q.vertexTangents=z.vertexTangents,Q.toneMapping=z.toneMapping}function Am(C,z){if(C.length===0)return null;if(C.length===1)return C[0].texture!==null?C[0]:null;_.setFromMatrixPosition(z.matrixWorld);for(let Q=0,Y=C.length;Q<Y;Q++){let j=C[Q];if(j.texture!==null&&j.boundingBox.containsPoint(_))return j}return null}function Cm(C,z,Q,Y,j){z.isScene!==!0&&(z=Ne),J.resetTextureUnits();let Se=z.fog,Ie=Y.isMeshStandardMaterial||Y.isMeshLambertMaterial||Y.isMeshPhongMaterial?z.environment:null,be=H===null?N.outputColorSpace:H.isXRRenderTarget===!0?H.texture.colorSpace:tt.workingColorSpace,Oe=Y.isMeshStandardMaterial||Y.isMeshLambertMaterial&&!Y.envMap||Y.isMeshPhongMaterial&&!Y.envMap,Ve=ue.get(Y.envMap||Ie,Oe),it=Y.vertexColors===!0&&!!Q.attributes.color&&Q.attributes.color.itemSize===4,ot=!!Q.attributes.tangent&&(!!Y.normalMap||Y.anisotropy>0),Fe=!!Q.morphAttributes.position,pt=!!Q.morphAttributes.normal,Vt=!!Q.morphAttributes.color,At=wn;Y.toneMapped&&(H===null||H.isXRRenderTarget===!0)&&(At=N.toneMapping);let vt=Q.morphAttributes.position||Q.morphAttributes.normal||Q.morphAttributes.color,nn=vt!==void 0?vt.length:0,Ce=X.get(Y),un=E.state.lights;if(ae===!0&&(re===!0||C!==W)){let Tt=C===W&&Y.id===k;Ue.setState(Y,C,Tt)}let lt=!1;Y.version===Ce.__version?(Ce.needsLights&&Ce.lightsStateVersion!==un.state.version||Ce.outputColorSpace!==be||j.isBatchedMesh&&Ce.batching===!1||!j.isBatchedMesh&&Ce.batching===!0||j.isBatchedMesh&&Ce.batchingColor===!0&&j._colorsTexture===null||j.isBatchedMesh&&Ce.batchingColor===!1&&j._colorsTexture!==null||j.isInstancedMesh&&Ce.instancing===!1||!j.isInstancedMesh&&Ce.instancing===!0||j.isSkinnedMesh&&Ce.skinning===!1||!j.isSkinnedMesh&&Ce.skinning===!0||j.isInstancedMesh&&Ce.instancingColor===!0&&j.instanceColor===null||j.isInstancedMesh&&Ce.instancingColor===!1&&j.instanceColor!==null||j.isInstancedMesh&&Ce.instancingMorph===!0&&j.morphTexture===null||j.isInstancedMesh&&Ce.instancingMorph===!1&&j.morphTexture!==null||Ce.envMap!==Ve||Y.fog===!0&&Ce.fog!==Se||Ce.numClippingPlanes!==void 0&&(Ce.numClippingPlanes!==Ue.numPlanes||Ce.numIntersection!==Ue.numIntersection)||Ce.vertexAlphas!==it||Ce.vertexTangents!==ot||Ce.morphTargets!==Fe||Ce.morphNormals!==pt||Ce.morphColors!==Vt||Ce.toneMapping!==At||Ce.morphTargetsCount!==nn||!!Ce.lightProbeGrid!=E.state.lightProbeGridArray.length>0)&&(lt=!0):(lt=!0,Ce.__version=Y.version);let En=Ce.currentProgram;lt===!0&&(En=ua(Y,z,j),S&&Y.isNodeMaterial&&S.onUpdateProgram(Y,En,Ce));let Yn=!1,Li=!1,Cs=!1,xt=En.getUniforms(),Ft=Ce.uniforms;if(y.useProgram(En.program)&&(Yn=!0,Li=!0,Cs=!0),Y.id!==k&&(k=Y.id,Li=!0),Ce.needsLights){let Tt=Am(E.state.lightProbeGridArray,j);Ce.lightProbeGrid!==Tt&&(Ce.lightProbeGrid=Tt,Li=!0)}if(Yn||W!==C){y.buffers.depth.getReversed()&&C.reversedDepth!==!0&&(C._reversedDepth=!0,C.updateProjectionMatrix()),xt.setValue(B,"projectionMatrix",C.projectionMatrix),xt.setValue(B,"viewMatrix",C.matrixWorldInverse);let Di=xt.map.cameraPosition;Di!==void 0&&Di.setValue(B,le.setFromMatrixPosition(C.matrixWorld)),I.logarithmicDepthBuffer&&xt.setValue(B,"logDepthBufFC",2/(Math.log(C.far+1)/Math.LN2)),(Y.isMeshPhongMaterial||Y.isMeshToonMaterial||Y.isMeshLambertMaterial||Y.isMeshBasicMaterial||Y.isMeshStandardMaterial||Y.isShaderMaterial)&&xt.setValue(B,"isOrthographic",C.isOrthographicCamera===!0),W!==C&&(W=C,Li=!0,Cs=!0)}if(Ce.needsLights&&(un.state.sunShadowMap.length>0&&xt.setValue(B,"sunShadowMap",un.state.sunShadowMap,J),un.state.directionalShadowMap.length>0&&xt.setValue(B,"directionalShadowMap",un.state.directionalShadowMap,J),un.state.spotShadowMap.length>0&&xt.setValue(B,"spotShadowMap",un.state.spotShadowMap,J),un.state.pointShadowMap.length>0&&xt.setValue(B,"pointShadowMap",un.state.pointShadowMap,J)),j.isSkinnedMesh){xt.setOptional(B,j,"bindMatrix"),xt.setOptional(B,j,"bindMatrixInverse");let Tt=j.skeleton;Tt&&(Tt.boneTexture===null&&Tt.computeBoneTexture(),xt.setValue(B,"boneTexture",Tt.boneTexture,J))}j.isBatchedMesh&&(xt.setOptional(B,j,"batchingTexture"),xt.setValue(B,"batchingTexture",j._matricesTexture,J),xt.setOptional(B,j,"batchingIdTexture"),xt.setValue(B,"batchingIdTexture",j._indirectTexture,J),xt.setOptional(B,j,"batchingColorTexture"),j._colorsTexture!==null&&xt.setValue(B,"batchingColorTexture",j._colorsTexture,J));let Ii=Q.morphAttributes;if((Ii.position!==void 0||Ii.normal!==void 0||Ii.color!==void 0)&&V.update(j,Q,En),(Li||Ce.receiveShadow!==j.receiveShadow)&&(Ce.receiveShadow=j.receiveShadow,xt.setValue(B,"receiveShadow",j.receiveShadow)),(Y.isMeshStandardMaterial||Y.isMeshLambertMaterial||Y.isMeshPhongMaterial)&&Y.envMap===null&&z.environment!==null&&(Ft.envMapIntensity.value=z.environmentIntensity),Ft.dfgLUT!==void 0&&(Ft.dfgLUT.value=Jy()),Li){if(xt.setValue(B,"toneMappingExposure",N.toneMappingExposure),Ce.needsLights&&Rm(Ft,Cs),Se&&Y.fog===!0&&He.refreshFogUniforms(Ft,Se),He.refreshMaterialUniforms(Ft,Y,K,q,E.state.transmissionRenderTarget[C.id]),Ce.needsLights&&Ce.lightProbeGrid){let Tt=Ce.lightProbeGrid;Ft.probesSH.value=Tt.texture,Ft.probesMin.value.copy(Tt.boundingBox.min),Ft.probesMax.value.copy(Tt.boundingBox.max),Ft.probesResolution.value.copy(Tt.resolution)}br.upload(B,Ad(Ce),Ft,J)}if(Y.isShaderMaterial&&Y.uniformsNeedUpdate===!0&&(br.upload(B,Ad(Ce),Ft,J),Y.uniformsNeedUpdate=!1),Y.isSpriteMaterial&&xt.setValue(B,"center",j.center),xt.setValue(B,"modelViewMatrix",j.modelViewMatrix),xt.setValue(B,"normalMatrix",j.normalMatrix),xt.setValue(B,"modelMatrix",j.matrixWorld),Y.uniformsGroups!==void 0){let Tt=Y.uniformsGroups;for(let Di=0,Rs=Tt.length;Di<Rs;Di++){let Pd=Tt[Di];ce.update(Pd,En),ce.bind(Pd,En)}}return En}function Rm(C,z){C.ambientLightColor.needsUpdate=z,C.lightProbe.needsUpdate=z,C.sunLights.needsUpdate=z,C.sunLightShadows.needsUpdate=z,C.directionalLights.needsUpdate=z,C.directionalLightShadows.needsUpdate=z,C.pointLights.needsUpdate=z,C.pointLightShadows.needsUpdate=z,C.spotLights.needsUpdate=z,C.spotLightShadows.needsUpdate=z,C.rectAreaLights.needsUpdate=z,C.hemisphereLights.needsUpdate=z}function Pm(C){return C.isMeshLambertMaterial||C.isMeshToonMaterial||C.isMeshPhongMaterial||C.isMeshStandardMaterial||C.isShadowMaterial||C.isShaderMaterial&&C.lights===!0}this.getActiveCubeFace=function(){return F},this.getActiveMipmapLevel=function(){return O},this.getRenderTarget=function(){return H},this.setRenderTargetTextures=function(C,z,Q){let Y=X.get(C);Y.__autoAllocateDepthBuffer=C.resolveDepthBuffer===!1,Y.__autoAllocateDepthBuffer===!1&&(Y.__useRenderToTexture=!1),X.get(C.texture).__webglTexture=z,X.get(C.depthTexture).__webglTexture=Y.__autoAllocateDepthBuffer?void 0:Q,Y.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(C,z){let Q=X.get(C);Q.__webglFramebuffer=z,Q.__useDefaultFramebuffer=z===void 0},this.setRenderTarget=function(C,z=0,Q=0){H=C,F=z,O=Q;let Y=null,j=!1,Se=!1;if(C){let be=X.get(C);if(be.__useDefaultFramebuffer!==void 0){y.bindFramebuffer(B.FRAMEBUFFER,be.__webglFramebuffer),Z.copy(C.viewport),he.copy(C.scissor),pe=C.scissorTest,y.viewport(Z),y.scissor(he),y.setScissorTest(pe),k=-1;return}else if(be.__webglFramebuffer===void 0)J.setupRenderTarget(C);else if(be.__hasExternalTextures)J.rebindTextures(C,X.get(C.texture).__webglTexture,X.get(C.depthTexture).__webglTexture);else if(C.depthBuffer){let it=C.depthTexture;if(be.__boundDepthTexture!==it){if(it!==null&&X.has(it)&&(C.width!==it.image.width||C.height!==it.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");J.setupDepthRenderbuffer(C)}}let Oe=C.texture;(Oe.isData3DTexture||Oe.isDataArrayTexture||Oe.isCompressedArrayTexture)&&(Se=!0);let Ve=X.get(C).__webglFramebuffer;C.isWebGLCubeRenderTarget?(Array.isArray(Ve[z])?Y=Ve[z][Q]:Y=Ve[z],j=!0):C.samples>0&&J.useMultisampledRTT(C)===!1?Y=X.get(C).__webglMultisampledFramebuffer:Array.isArray(Ve)?Y=Ve[Q]:Y=Ve,Z.copy(C.viewport),he.copy(C.scissor),pe=C.scissorTest}else Z.copy(_e).multiplyScalar(K).floor(),he.copy(ke).multiplyScalar(K).floor(),pe=et;if(Q!==0&&(Y=w),y.bindFramebuffer(B.FRAMEBUFFER,Y)&&y.drawBuffers(C,Y),y.viewport(Z),y.scissor(he),y.setScissorTest(pe),j){let be=X.get(C.texture);B.framebufferTexture2D(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_CUBE_MAP_POSITIVE_X+z,be.__webglTexture,Q)}else if(Se){let be=z;for(let Oe=0;Oe<C.textures.length;Oe++){let Ve=X.get(C.textures[Oe]);B.framebufferTextureLayer(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0+Oe,Ve.__webglTexture,Q,be)}}else if(C!==null&&Q!==0){let be=X.get(C.texture);B.framebufferTexture2D(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_2D,be.__webglTexture,Q)}k=-1};function Rd(C){let z=X.get(C);return(z.__readFormat!==C.format||z.__readType!==C.type)&&(z.__readFormat=C.format,z.__readType=C.type,z.__formatReadable=I.textureFormatReadable(C.format),z.__typeReadable=I.textureTypeReadable(C.type)),z}this.readRenderTargetPixels=function(C,z,Q,Y,j,Se,Ie,be=0){if(!(C&&C.isWebGLRenderTarget)){Ze("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Oe=X.get(C).__webglFramebuffer;if(C.isWebGLCubeRenderTarget&&Ie!==void 0&&(Oe=Oe[Ie]),Oe){y.bindFramebuffer(B.FRAMEBUFFER,Oe);try{let Ve=C.textures[be],it=Ve.format,ot=Ve.type;C.textures.length>1&&B.readBuffer(B.COLOR_ATTACHMENT0+be);let Fe=Rd(Ve);if(Fe.__formatReadable===!1){Ze("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(Fe.__typeReadable===!1){Ze("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}z>=0&&z<=C.width-Y&&Q>=0&&Q<=C.height-j&&B.readPixels(z,Q,Y,j,ye.convert(it),ye.convert(ot),Se)}finally{let Ve=H!==null?X.get(H).__webglFramebuffer:null;y.bindFramebuffer(B.FRAMEBUFFER,Ve)}}},this.readRenderTargetPixelsAsync=async function(C,z,Q,Y,j,Se,Ie,be=0){if(!(C&&C.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Oe=X.get(C).__webglFramebuffer;if(C.isWebGLCubeRenderTarget&&Ie!==void 0&&(Oe=Oe[Ie]),Oe)if(z>=0&&z<=C.width-Y&&Q>=0&&Q<=C.height-j){y.bindFramebuffer(B.FRAMEBUFFER,Oe);let Ve=C.textures[be],it=Ve.format,ot=Ve.type;C.textures.length>1&&B.readBuffer(B.COLOR_ATTACHMENT0+be);let Fe=Rd(Ve);if(Fe.__formatReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(Fe.__typeReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let pt=B.createBuffer();B.bindBuffer(B.PIXEL_PACK_BUFFER,pt),B.bufferData(B.PIXEL_PACK_BUFFER,Se.byteLength,B.STREAM_READ),B.readPixels(z,Q,Y,j,ye.convert(it),ye.convert(ot),0),B.bindBuffer(B.PIXEL_PACK_BUFFER,null);let Vt=H!==null?X.get(H).__webglFramebuffer:null;y.bindFramebuffer(B.FRAMEBUFFER,Vt);let At=B.fenceSync(B.SYNC_GPU_COMMANDS_COMPLETE,0);return B.flush(),await ip(B,At,4),B.bindBuffer(B.PIXEL_PACK_BUFFER,pt),B.getBufferSubData(B.PIXEL_PACK_BUFFER,0,Se),B.bindBuffer(B.PIXEL_PACK_BUFFER,null),B.deleteBuffer(pt),B.deleteSync(At),Se}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(C,z=null,Q=0){let Y=Math.pow(2,-Q),j=Math.floor(C.image.width*Y),Se=Math.floor(C.image.height*Y),Ie=z!==null?z.x:0,be=z!==null?z.y:0;J.setTexture2D(C,0),B.copyTexSubImage2D(B.TEXTURE_2D,Q,0,0,Ie,be,j,Se),y.unbindTexture()},this.copyTextureToTexture=function(C,z,Q=null,Y=null,j=0,Se=0){let Ie,be,Oe,Ve,it,ot,Fe,pt,Vt,At=C.isCompressedTexture?C.mipmaps[Se]:C.image;if(Q!==null)Ie=Q.max.x-Q.min.x,be=Q.max.y-Q.min.y,Oe=Q.isBox3?Q.max.z-Q.min.z:1,Ve=Q.min.x,it=Q.min.y,ot=Q.isBox3?Q.min.z:0;else{let Ft=Math.pow(2,-j);Ie=Math.floor(At.width*Ft),be=Math.floor(At.height*Ft),C.isDataArrayTexture?Oe=At.depth:C.isData3DTexture?Oe=Math.floor(At.depth*Ft):Oe=1,Ve=0,it=0,ot=0}Y!==null?(Fe=Y.x,pt=Y.y,Vt=Y.z):(Fe=0,pt=0,Vt=0);let vt=ye.convert(z.format),nn=ye.convert(z.type),Ce;z.isData3DTexture?(J.setTexture3D(z,0),Ce=B.TEXTURE_3D):z.isDataArrayTexture||z.isCompressedArrayTexture?(J.setTexture2DArray(z,0),Ce=B.TEXTURE_2D_ARRAY):(J.setTexture2D(z,0),Ce=B.TEXTURE_2D),y.activeTexture(B.TEXTURE0),y.pixelStorei(B.UNPACK_FLIP_Y_WEBGL,z.flipY),y.pixelStorei(B.UNPACK_PREMULTIPLY_ALPHA_WEBGL,z.premultiplyAlpha),y.pixelStorei(B.UNPACK_ALIGNMENT,z.unpackAlignment);let un=y.getParameter(B.UNPACK_ROW_LENGTH),lt=y.getParameter(B.UNPACK_IMAGE_HEIGHT),En=y.getParameter(B.UNPACK_SKIP_PIXELS),Yn=y.getParameter(B.UNPACK_SKIP_ROWS),Li=y.getParameter(B.UNPACK_SKIP_IMAGES);y.pixelStorei(B.UNPACK_ROW_LENGTH,At.width),y.pixelStorei(B.UNPACK_IMAGE_HEIGHT,At.height),y.pixelStorei(B.UNPACK_SKIP_PIXELS,Ve),y.pixelStorei(B.UNPACK_SKIP_ROWS,it),y.pixelStorei(B.UNPACK_SKIP_IMAGES,ot);let Cs=C.isDataArrayTexture||C.isData3DTexture,xt=z.isDataArrayTexture||z.isData3DTexture;if(C.isDepthTexture){let Ft=X.get(C),Ii=X.get(z),Tt=X.get(Ft.__renderTarget),Di=X.get(Ii.__renderTarget);y.bindFramebuffer(B.READ_FRAMEBUFFER,Tt.__webglFramebuffer),y.bindFramebuffer(B.DRAW_FRAMEBUFFER,Di.__webglFramebuffer);for(let Rs=0;Rs<Oe;Rs++)Cs&&(B.framebufferTextureLayer(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,X.get(C).__webglTexture,j,ot+Rs),B.framebufferTextureLayer(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,X.get(z).__webglTexture,Se,Vt+Rs)),B.blitFramebuffer(Ve,it,Ie,be,Fe,pt,Ie,be,B.DEPTH_BUFFER_BIT,B.NEAREST);y.bindFramebuffer(B.READ_FRAMEBUFFER,null),y.bindFramebuffer(B.DRAW_FRAMEBUFFER,null)}else if(j!==0||C.isRenderTargetTexture||X.has(C)){let Ft=X.get(C),Ii=X.get(z);y.bindFramebuffer(B.READ_FRAMEBUFFER,P),y.bindFramebuffer(B.DRAW_FRAMEBUFFER,U);for(let Tt=0;Tt<Oe;Tt++)Cs?B.framebufferTextureLayer(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,Ft.__webglTexture,j,ot+Tt):B.framebufferTexture2D(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_2D,Ft.__webglTexture,j),xt?B.framebufferTextureLayer(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,Ii.__webglTexture,Se,Vt+Tt):B.framebufferTexture2D(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_2D,Ii.__webglTexture,Se),j!==0?B.blitFramebuffer(Ve,it,Ie,be,Fe,pt,Ie,be,B.COLOR_BUFFER_BIT,B.NEAREST):xt?B.copyTexSubImage3D(Ce,Se,Fe,pt,Vt+Tt,Ve,it,Ie,be):B.copyTexSubImage2D(Ce,Se,Fe,pt,Ve,it,Ie,be);y.bindFramebuffer(B.READ_FRAMEBUFFER,null),y.bindFramebuffer(B.DRAW_FRAMEBUFFER,null)}else xt?C.isDataTexture||C.isData3DTexture?B.texSubImage3D(Ce,Se,Fe,pt,Vt,Ie,be,Oe,vt,nn,At.data):z.isCompressedArrayTexture?B.compressedTexSubImage3D(Ce,Se,Fe,pt,Vt,Ie,be,Oe,vt,At.data):B.texSubImage3D(Ce,Se,Fe,pt,Vt,Ie,be,Oe,vt,nn,At):C.isDataTexture?B.texSubImage2D(B.TEXTURE_2D,Se,Fe,pt,Ie,be,vt,nn,At.data):C.isCompressedTexture?B.compressedTexSubImage2D(B.TEXTURE_2D,Se,Fe,pt,At.width,At.height,vt,At.data):B.texSubImage2D(B.TEXTURE_2D,Se,Fe,pt,Ie,be,vt,nn,At);y.pixelStorei(B.UNPACK_ROW_LENGTH,un),y.pixelStorei(B.UNPACK_IMAGE_HEIGHT,lt),y.pixelStorei(B.UNPACK_SKIP_PIXELS,En),y.pixelStorei(B.UNPACK_SKIP_ROWS,Yn),y.pixelStorei(B.UNPACK_SKIP_IMAGES,Li),Se===0&&z.generateMipmaps&&B.generateMipmap(Ce),y.unbindTexture()},this.initRenderTarget=function(C){X.get(C).__webglFramebuffer===void 0&&J.setupRenderTarget(C)},this.initTexture=function(C){C.isCubeTexture?J.setTextureCube(C,0):C.isData3DTexture?J.setTexture3D(C,0):C.isDataArrayTexture||C.isCompressedArrayTexture?J.setTexture2DArray(C,0):J.setTexture2D(C,0),y.unbindTexture()},this.resetState=function(){F=0,O=0,H=null,y.reset(),Te.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return zn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=tt._getDrawingBufferColorSpace(e),t.unpackColorSpace=tt._getUnpackColorSpace()}};var Hp={type:"change"},Lu={type:"start"},Gp={type:"end"},_c=new $n,Vp=new Qt,Qy=Math.cos(70*Xo.DEG2RAD),jt=new D,_n=2*Math.PI,gt={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},Pu=1e-6,vc=class extends Co{constructor(e,t=null){super(e,t),this.state=gt.NONE,this.target=new D,this.cursor=new D,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:Yi.ROTATE,MIDDLE:Yi.DOLLY,RIGHT:Yi.PAN},this.touches={ONE:ji.ROTATE,TWO:ji.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._cursorStyle="auto",this._domElementKeyEvents=null,this._lastPosition=new D,this._lastQuaternion=new on,this._lastTargetPosition=new D,this._quat=new on().setFromUnitVectors(e.up,new D(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new fr,this._sphericalDelta=new fr,this._scale=1,this._panOffset=new D,this._rotateStart=new ee,this._rotateEnd=new ee,this._rotateDelta=new ee,this._panStart=new ee,this._panEnd=new ee,this._panDelta=new ee,this._dollyStart=new ee,this._dollyEnd=new ee,this._dollyDelta=new ee,this._dollyDirection=new D,this._mouse=new ee,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=eM.bind(this),this._onPointerDown=$y.bind(this),this._onPointerUp=tM.bind(this),this._onContextMenu=lM.bind(this),this._onMouseWheel=sM.bind(this),this._onKeyDown=rM.bind(this),this._onTouchStart=oM.bind(this),this._onTouchMove=aM.bind(this),this._onMouseDown=nM.bind(this),this._onMouseMove=iM.bind(this),this._interceptControlDown=cM.bind(this),this._interceptControlUp=hM.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}set cursorStyle(e){this._cursorStyle=e,e==="grab"?this.domElement.style.cursor="grab":this.domElement.style.cursor="auto"}get cursorStyle(){return this._cursorStyle}connect(e){super.connect(e),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.state=gt.NONE,this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents();let e=this.domElement.getRootNode();e.removeEventListener("keydown",this._interceptControlDown,{capture:!0}),e.removeEventListener("keyup",this._interceptControlUp,{capture:!0}),this._controlActive=!1,this._pointers.length=0,this._pointerPositions={},this.domElement.style.touchAction="",this.domElement.style.cursor="auto"}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(Hp),this.update(),this.state=gt.NONE}pan(e,t){this._pan(e,t),this.update()}dollyIn(e){this._dollyIn(e),this.update()}dollyOut(e){this._dollyOut(e),this.update()}rotateLeft(e){this._rotateLeft(e),this.update()}rotateUp(e){this._rotateUp(e),this.update()}update(e=null){let t=this.object.position;jt.copy(t).sub(this.target),jt.applyQuaternion(this._quat),this._spherical.setFromVector3(jt),this.autoRotate&&this.state===gt.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let n=this.minAzimuthAngle,i=this.maxAzimuthAngle;isFinite(n)&&isFinite(i)&&(n<-Math.PI?n+=_n:n>Math.PI&&(n-=_n),i<-Math.PI?i+=_n:i>Math.PI&&(i-=_n),n<=i?this._spherical.theta=Math.max(n,Math.min(i,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(n+i)/2?Math.max(n,this._spherical.theta):Math.min(i,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let r=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{let o=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),r=o!=this._spherical.radius}if(jt.setFromSpherical(this._spherical),jt.applyQuaternion(this._quatInverse),t.copy(this.target).add(jt),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let o=null;if(this.object.isPerspectiveCamera){let a=jt.length();o=this._clampDistance(a*this._scale);let l=a-o;this.object.position.addScaledVector(this._dollyDirection,l),this.object.updateMatrixWorld(),r=!!l}else if(this.object.isOrthographicCamera){let a=new D(this._mouse.x,this._mouse.y,0);a.unproject(this.object);let l=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),r=l!==this.object.zoom;let c=new D(this._mouse.x,this._mouse.y,0);c.unproject(this.object),this.object.position.sub(c).add(a),this.object.updateMatrixWorld(),o=jt.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;o!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(o).add(this.object.position):(_c.origin.copy(this.object.position),_c.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(_c.direction))<Qy?this.object.lookAt(this.target):(Vp.setFromNormalAndCoplanarPoint(this.object.up,this.target),_c.intersectPlane(Vp,this.target))))}else if(this.object.isOrthographicCamera){let o=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),o!==this.object.zoom&&(this.object.updateProjectionMatrix(),r=!0)}return this._scale=1,this._performCursorZoom=!1,r||this._lastPosition.distanceToSquared(this.object.position)>Pu||8*(1-this._lastQuaternion.dot(this.object.quaternion))>Pu||this._lastTargetPosition.distanceToSquared(this.target)>Pu?(this.dispatchEvent(Hp),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e!==null?_n/60*this.autoRotateSpeed*e:_n/60/60*this.autoRotateSpeed}_getZoomScale(e){let t=Math.abs(e*.01);return Math.pow(.95,this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){jt.setFromMatrixColumn(t,0),jt.multiplyScalar(-e),this._panOffset.add(jt)}_panUp(e,t){this.screenSpacePanning===!0?jt.setFromMatrixColumn(t,1):(jt.setFromMatrixColumn(t,0),jt.crossVectors(this.object.up,jt)),jt.multiplyScalar(e),this._panOffset.add(jt)}_pan(e,t){let n=this.domElement;if(this.object.isPerspectiveCamera){let i=this.object.position;jt.copy(i).sub(this.target);let r=jt.length();r*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*r/n.clientHeight,this.object.matrix),this._panUp(2*t*r/n.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/n.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/n.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;let n=this.domElement.getBoundingClientRect(),i=e-n.left,r=t-n.top,o=n.width,a=n.height;this._mouse.x=i/o*2-1,this._mouse.y=-(r/a)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(_n*this._rotateDelta.x/t.clientHeight),this._rotateUp(_n*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(_n*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(-_n*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(_n*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(-_n*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),t=!0;break}t&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),i=.5*(e.pageY+t.y);this._rotateStart.set(n,i)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),i=.5*(e.pageY+t.y);this._panStart.set(n,i)}}_handleTouchStartDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,i=e.pageY-t.y,r=Math.sqrt(n*n+i*i);this._dollyStart.set(0,r)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{let n=this._getSecondPointerPosition(e),i=.5*(e.pageX+n.x),r=.5*(e.pageY+n.y);this._rotateEnd.set(i,r)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(_n*this._rotateDelta.x/t.clientHeight),this._rotateUp(_n*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),i=.5*(e.pageY+t.y);this._panEnd.set(n,i)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,i=e.pageY-t.y,r=Math.sqrt(n*n+i*i);this._dollyEnd.set(0,r),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);let o=(e.pageX+t.x)*.5,a=(e.pageY+t.y)*.5;this._updateZoomParameters(o,a)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new ee,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){let t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){let t=e.deltaMode,n={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:n.deltaY*=16;break;case 2:n.deltaY*=100;break}return e.ctrlKey&&!this._controlActive&&(n.deltaY*=10),n}};function $y(s){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(s.pointerId),this.domElement.ownerDocument.addEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(s)&&(this._addPointer(s),s.pointerType==="touch"?this._onTouchStart(s):this._onMouseDown(s),this._cursorStyle==="grab"&&(this.domElement.style.cursor="grabbing")))}function eM(s){this.enabled!==!1&&(s.pointerType==="touch"?this._onTouchMove(s):this._onMouseMove(s))}function tM(s){switch(this._removePointer(s),this._pointers.length){case 0:this.domElement.releasePointerCapture(s.pointerId),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(Gp),this.state=gt.NONE,this._cursorStyle==="grab"&&(this.domElement.style.cursor="grab");break;case 1:let e=this._pointers[0],t=this._pointerPositions[e];this._onTouchStart({pointerId:e,pageX:t.x,pageY:t.y});break}}function nM(s){let e;switch(s.button){case 0:e=this.mouseButtons.LEFT;break;case 1:e=this.mouseButtons.MIDDLE;break;case 2:e=this.mouseButtons.RIGHT;break;default:e=-1}switch(e){case Yi.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(s),this.state=gt.DOLLY;break;case Yi.ROTATE:if(s.ctrlKey||s.metaKey||s.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(s),this.state=gt.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(s),this.state=gt.ROTATE}break;case Yi.PAN:if(s.ctrlKey||s.metaKey||s.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(s),this.state=gt.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(s),this.state=gt.PAN}break;default:this.state=gt.NONE}this.state!==gt.NONE&&this.dispatchEvent(Lu)}function iM(s){switch(this.state){case gt.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(s);break;case gt.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(s);break;case gt.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(s);break}}function sM(s){this.enabled===!1||this.enableZoom===!1||this.state!==gt.NONE||(s.preventDefault(),this.dispatchEvent(Lu),this._handleMouseWheel(this._customWheelEvent(s)),this.dispatchEvent(Gp))}function rM(s){this.enabled!==!1&&this._handleKeyDown(s)}function oM(s){switch(this._trackPointer(s),this._pointers.length){case 1:switch(this.touches.ONE){case ji.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(s),this.state=gt.TOUCH_ROTATE;break;case ji.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(s),this.state=gt.TOUCH_PAN;break;default:this.state=gt.NONE}break;case 2:switch(this.touches.TWO){case ji.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(s),this.state=gt.TOUCH_DOLLY_PAN;break;case ji.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(s),this.state=gt.TOUCH_DOLLY_ROTATE;break;default:this.state=gt.NONE}break;default:this.state=gt.NONE}this.state!==gt.NONE&&this.dispatchEvent(Lu)}function aM(s){switch(this._trackPointer(s),this.state){case gt.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(s),this.update();break;case gt.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(s),this.update();break;case gt.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(s),this.update();break;case gt.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(s),this.update();break;default:this.state=gt.NONE}}function lM(s){this.enabled!==!1&&s.preventDefault()}function cM(s){s.key==="Control"&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function hM(s){s.key==="Control"&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}var Zo=class s extends Re{constructor(e,t={}){super(e),this.isReflector=!0,this.type="Reflector",this.forceUpdate=!1,this._reflectionCameras=new WeakMap;let n=this,i=t.color!==void 0?new Ee(t.color):new Ee(8355711),r=t.textureWidth||512,o=t.textureHeight||512,a=t.clipBias||0,l=t.shader||s.ReflectorShader,c=t.multisample!==void 0?t.multisample:4,h=new Qt,f=new D,d=new D,u=new D,p=new je,x=new D(0,0,-1),m=new ut,g=new D,b=new D,T=new ut,_=new je,M=new dt(r,o,{samples:c,type:St}),E=new ct({name:l.name!==void 0?l.name:"unspecified",uniforms:zt.clone(l.uniforms),fragmentShader:l.fragmentShader,vertexShader:l.vertexShader});E.uniforms.tDiffuse.value=M.texture,E.uniforms.color.value=i,E.uniforms.textureMatrix.value=_,this.material=E,this.onBeforeRender=function(A,v,R){let N=this.getReflectionCamera(R);if(d.setFromMatrixPosition(n.matrixWorld),u.setFromMatrixPosition(R.matrixWorld),p.extractRotation(n.matrixWorld),f.set(0,0,1),f.applyMatrix4(p),g.subVectors(d,u),g.dot(f)>0===!0&&this.forceUpdate===!1)return;g.reflect(f).negate(),g.add(d),p.extractRotation(R.matrixWorld),x.set(0,0,-1),x.applyMatrix4(p),x.add(u),b.subVectors(d,x),b.reflect(f).negate(),b.add(d),N.position.copy(g),N.up.set(0,1,0),N.up.applyMatrix4(p),N.up.reflect(f),N.lookAt(b),N.far=R.far,N.updateMatrixWorld(),N.projectionMatrix.copy(R.projectionMatrix),_.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),_.multiply(N.projectionMatrix),_.multiply(N.matrixWorldInverse),_.multiply(n.matrixWorld),h.setFromNormalAndCoplanarPoint(f,d),h.applyMatrix4(N.matrixWorldInverse),m.set(h.normal.x,h.normal.y,h.normal.z,h.constant);let S=N.projectionMatrix;N.isOrthographicCamera?(T.x=(Math.sign(m.x)+S.elements[8])/S.elements[0],T.y=(Math.sign(m.y)+S.elements[9])/S.elements[5],T.z=-R.far,T.w=1):(T.x=(Math.sign(m.x)+S.elements[8])/S.elements[0],T.y=(Math.sign(m.y)+S.elements[9])/S.elements[5],T.z=-1,T.w=(1+S.elements[10])/S.elements[14]),m.multiplyScalar(2/m.dot(T)),S.elements[2]=m.x,S.elements[6]=m.y,N.isOrthographicCamera?(S.elements[10]=m.z-a,S.elements[14]=m.w-1):(S.elements[10]=m.z+1-a,S.elements[14]=m.w),n.visible=!1;let w=A.getRenderTarget(),P=A.xr.enabled,U=A.shadowMap.autoUpdate;A.xr.enabled=!1,A.shadowMap.autoUpdate=!1,A.setRenderTarget(M),A.state.buffers.depth.setMask(!0),A.autoClear===!1&&A.clear(),A.render(v,N),A.xr.enabled=P,A.shadowMap.autoUpdate=U,A.setRenderTarget(w);let F=R.viewport;F!==void 0&&A.state.viewport(F),n.visible=!0,this.forceUpdate=!1},this.getRenderTarget=function(){return M},this.dispose=function(){M.dispose(),n.material.dispose()},this.getReflectionCamera=function(A){let v=this._reflectionCameras.get(A);return v===void 0&&(v=A.clone(),this._reflectionCameras.set(A,v)),v}}};Zo.ReflectorShader={name:"ReflectorShader",uniforms:{color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null}},vertexShader:`
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

		}`};var vn={light:{id:"light",name:"\u05D0\u05D3\u05E8\u05D9\u05DB\u05DC\u05D9 \u05D1\u05D4\u05D9\u05E8",palette:{plaster_white:15525596,plaster_exterior:13880512,plaster_ceiling:16052974,concrete:11578790,tiles_white:14868956,tiles_grey:11711928,oak:12556906,carpet:11446172,fabric_grey:9081760,fabric_accent:6716046,fabric_rug:11375233,linen:15328474,leather:5128758,wood_light:13678228,wood_dark:7034439,door_wood:12295804,metal_dark:3948614,metal_light:12238273,asphalt:7040110,grass:8887410,screen_off:1382429,shutter:14277597,section_cap:3093047,section_edge:3093047,cone:2582509,presence:2582509,open_door:14960188,lock_ok:3122027},rig:{exposureDay:.68,exposureNight:.9,sunScale:1.3,skyScale:1,envDay:.5,envNight:.22,hemiScale:.22,interiorFill:[.55,1],lampEmissiveDay:1.6,lampEmissiveNight:3,lampPoolDay:.5,lampPoolNight:1,lampKelvinOffset:0,moonScale:.5},post:{bloomThresholdDay:2,bloomThresholdNight:1.6,bloomStrengthDay:.12,bloomStrengthNight:.38,bloomRadius:.35,aoRadius:.6,aoIntensity:.55,contactAlpha:.42,junctionAlpha:.5},cut:{fraction:.6,edge:!1,edgeWidth:0,ghostWalls:0},ground:{disc:13949149,discNight:1712432,contact:.38,horizonFade:!0},backdrop:{topDay:"#cfdff2",horizonDay:"#eef3f9",topNight:"#0d1a33",horizonNight:"#1a2b47",groundTint:.96},ui:{accent:"#2767ed",labelBg:"rgba(255,255,255,.86)",labelText:"#22314c",theme:"light"}},dark:{id:"dark",name:"\u05EA\u05D0\u05D5\u05DD \u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9 \u05DB\u05D4\u05D4",palette:{plaster_white:4936548,plaster_exterior:3423050,plaster_ceiling:4080980,concrete:4935769,tiles_white:7106936,tiles_grey:5199198,oak:8021584,carpet:5067355,fabric_grey:5989746,fabric_accent:5008006,fabric_rug:6314855,linen:10132902,leather:3353380,wood_light:9074016,wood_dark:4142384,door_wood:7232327,metal_dark:2764341,metal_light:9278620,asphalt:3356219,grass:4084544,screen_off:724242,shutter:8028296,section_cap:1383207,section_edge:6280191,cone:3718648,presence:3718648,open_door:16739170,lock_ok:4054148},rig:{exposureDay:.72,exposureNight:.8,sunScale:.55,skyScale:.32,envDay:.5,envNight:.2,hemiScale:.35,interiorFill:[.45,.9],lampEmissiveDay:2.6,lampEmissiveNight:3.4,lampPoolDay:1,lampPoolNight:1.2,lampKelvinOffset:0,moonScale:.8},post:{bloomThresholdDay:1.2,bloomThresholdNight:1,bloomStrengthDay:.32,bloomStrengthNight:.5,bloomRadius:.45,aoRadius:.6,aoIntensity:.5,contactAlpha:.5,junctionAlpha:.55},cut:{fraction:.6,edge:!0,edgeWidth:1,ghostWalls:0},ground:{disc:1119775,discNight:724759,contact:.5,horizonFade:!0},backdrop:{topDay:"#111a2b",horizonDay:"#1b2a44",topNight:"#070c17",horizonNight:"#111c33",groundTint:.5},ui:{accent:"#38bdf8",labelBg:"rgba(21,28,44,.86)",labelText:"#e6ebf5",theme:"dark"}}},I1=Object.keys(vn);function Wp(s){return s==="dark"?vn.dark:vn.light}function qp(s){let e=s>>>0;return()=>(e=e*1664525+1013904223>>>0,e/4294967296)}function Yp(s,e,t){let n=qp(t),i=new Float32Array((e+1)*(e+1));for(let l=0;l<i.length;l++)i[l]=n();let r=new Float32Array(s*s),o=l=>l*l*(3-2*l),a=new Float32Array(e+1);for(let l=0;l<s;l++){let c=l/s*e,h=Math.floor(c),f=o(c-h),d=(h+1)%e;for(let u=0;u<=e;u++)a[u]=i[h%e*(e+1)+u%e]*(1-f)+i[d*(e+1)+u%e]*f;for(let u=0;u<s;u++){let p=u/s*e,x=Math.floor(p),m=o(p-x);r[l*s+u]=a[x%e]*(1-m)+a[(x+1)%e]*m}}return r}function Ci(s,e,t=4,n=4){let i=new Float32Array(s*s),r=.5,o=0;for(let a=0;a<t;a++){let l=Yp(s,n<<a,e+a*97);for(let c=0;c<i.length;c++)i[c]+=l[c]*r;o+=r,r*=.5}for(let a=0;a<i.length;a++)i[a]/=o;return i}function Iu(s,e,t,n=8){let i=document.createElement("canvas");i.width=i.height=e;let r=i.getContext("2d"),o=r.createImageData(e,e);o.data.set(s),r.putImageData(o,0,0);let a=new Vn(i);return a.wrapS=a.wrapT=Kt,a.colorSpace=t?Mt:Pn,a.anisotropy=n,a.needsUpdate=!0,a}function uM(s,e,t){let n=new Uint8ClampedArray(e*e*4),i=e;for(let r=0;r<i;r++){let o=(r-1+i)%i*i,a=r*i,l=(r+1)%i*i;for(let c=0;c<i;c++){let h=(c-1+i)%i,f=(c+1)%i,d=s[o+f]+2*s[a+f]+s[l+f]-(s[o+h]+2*s[a+h]+s[l+h]),u=s[l+h]+2*s[l+c]+s[l+f]-(s[o+h]+2*s[o+c]+s[o+f]),p=-d*t,x=-u*t,m=1,g=Math.hypot(p,x,m);p/=g,x/=g,m/=g;let b=(a+c)*4;n[b]=(p*.5+.5)*255,n[b+1]=(x*.5+.5)*255,n[b+2]=(m*.5+.5)*255,n[b+3]=255}}return n}function dM(s,e,t=200,n=40,i=[1,1,1]){let r=new Uint8ClampedArray(e*e*4);for(let o=0,a=0;o<s.length;o++,a+=4){let l=t+(s[o]-.5)*2*n;r[a]=l*i[0],r[a+1]=l*i[1],r[a+2]=l*i[2],r[a+3]=255}return r}function fM(s,e){let t=new Uint8ClampedArray(e*e*4);for(let n=0,i=0;n<s.length;n++,i+=4){let r=Math.max(0,Math.min(1,s[n]))*255;t[i]=r,t[i+1]=r,t[i+2]=r,t[i+3]=255}return t}var Wt={planks(s,e,t=6,n=.35){let i=Ci(s,e,5,2),r=s/t,o=qp(e+11),a=Array.from({length:t},()=>Math.floor(o()*s)),l=Array.from({length:t},()=>.88+o()*.24),c=new Float32Array(s*s),h=new Float32Array(s*s),f=new Float32Array(s*s);for(let d=0;d<s;d++)for(let u=0;u<s;u++){let p=Math.floor(u/r),x=(d+a[p])%s,m=i[x*s+u*3%s],g=.5+.5*Math.sin(u/r*Math.PI*9+m*11),b=u%r<1.5||x%s<1.5,T=d*s+u;c[T]=b?.2:Math.min(1,(.5+(m-.5)*n+(g-.5)*.12)*l[p]),h[T]=b?0:.75+.25*m,f[T]=b?.9:.42+.2*m}return{lum:c,height:h,rough:f,mid:196,amp:46,tint:[1,.98,.95]}},tiles(s,e,t=2,n=3,i=!1){let r=Ci(s,e,3,8),o=s/t,a=new Float32Array(s*s),l=new Float32Array(s*s),c=new Float32Array(s*s);for(let h=0;h<s;h++)for(let f=0;f<s;f++){let d=h*s+f,u=f%o<n||h%o<n,p=Math.floor(f/o),x=Math.floor(h/o),m=.5+(r[d]-.5)*.5+((p*7+x*13)%5-2)*.025;a[d]=u?.32:m,l[d]=u?0:1-r[d]*.06,c[d]=u?.95:i?.18+r[d]*.1:.4+r[d]*.15}return{lum:a,height:l,rough:c,mid:206,amp:22}},plaster(s,e,t=.12){let n=Ci(s,e,5,6),i=new Float32Array(s*s);for(let o=0;o<i.length;o++)i[o]=.82+n[o]*.15;let r=new Float32Array(s*s);for(let o=0;o<r.length;o++)r[o]=.5+(n[o]-.5)*t*2;return{lum:r,height:n,rough:i,mid:214,amp:14}},concrete(s,e){let t=Ci(s,e,6,3),n=Yp(s,64,e+5),i=new Float32Array(s*s),r=new Float32Array(s*s);for(let o=0;o<i.length;o++)i[o]=.5+(t[o]-.5)*.7+(n[o]>.94?-.2:0),r[o]=.7+t[o]*.25;return{lum:i,height:t,rough:r,mid:200,amp:30}},fabric(s,e,t=.8,n=.5){let i=Ci(s,e,5,24),r=new Float32Array(s*s),o=new Float32Array(s*s);for(let l=0;l<s;l++)for(let c=0;c<s;c++){let h=l*s+c,f=.5+.5*Math.sin(c*t)*Math.sin(l*t);r[h]=.5+((i[h]-.5)*.6+(f-.5)*.4)*n,o[h]=i[h]*.6+f*.4}let a=new Float32Array(s*s).fill(.92);return{lum:r,height:o,rough:a,mid:200,amp:26}},wood(s,e,t=.12){let n=Ci(s,e,4,2),i=new Float32Array(s*s),r=new Float32Array(s*s);for(let o=0;o<s;o++)for(let a=0;a<s;a++){let l=o*s+a,c=.5+.5*Math.sin(o*t+n[l]*7);i[l]=.5+(c-.5)*.5+(n[l]-.5)*.4,r[l]=.38+n[l]*.2}return{lum:i,height:n,rough:r,mid:200,amp:28,tint:[1,.98,.95]}},metal(s,e){let t=Ci(s,e,3,4),n=new Float32Array(s*s),i=new Float32Array(s*s);for(let r=0;r<s;r++)for(let o=0;o<s;o++){let a=r*s+o,l=t[r*7%s*s+o%s];n[a]=.5+(l-.5)*.5,i[a]=.3+l*.15}return{lum:n,height:n,rough:i,mid:215,amp:10}},leather(s,e){let t=Ci(s,e,6,20),n=new Float32Array(s*s),i=new Float32Array(s*s);for(let r=0;r<n.length;r++)n[r]=t[r],i[r]=.45+t[r]*.3;return{lum:n,height:t,rough:i,mid:205,amp:22}},grass(s,e){let t=Ci(s,e,6,10),n=new Float32Array(s*s).fill(.95);return{lum:t,height:t,rough:n,mid:205,amp:40}}},Ko={plaster_white:{size:512,recipe:s=>Wt.plaster(s,31,.1),tile_m:2,normal:.35,roughness:1},plaster_exterior:{size:512,recipe:s=>Wt.plaster(s,47,.16),tile_m:2,normal:.9,roughness:1},plaster_ceiling:{size:256,recipe:s=>Wt.plaster(s,53,.03),tile_m:3,normal:.04,roughness:1},concrete:{size:512,recipe:s=>Wt.concrete(s,61),tile_m:2.5,normal:1.2,roughness:1},tiles_white:{size:512,recipe:s=>Wt.tiles(s,71,4,3,!0),tile_m:1.2,normal:1.8,roughness:1},tiles_grey:{size:512,recipe:s=>Wt.tiles(s,79,2,3,!1),tile_m:1.2,normal:1.8,roughness:1},oak:{size:512,recipe:s=>Wt.planks(s,83,6,.35),tile_m:1.2,normal:1.6,roughness:1},carpet:{size:256,recipe:s=>Wt.fabric(s,89,1.3,.35),tile_m:.5,normal:.8,roughness:1},fabric_grey:{size:256,recipe:s=>Wt.fabric(s,97,.8,.5),tile_m:.6,normal:.9,roughness:1},fabric_accent:{size:256,recipe:s=>Wt.fabric(s,101,.8,.5),tile_m:.6,normal:.9,roughness:1},fabric_rug:{size:256,recipe:s=>Wt.fabric(s,102,1.6,.4),tile_m:.8,normal:1,roughness:1},linen:{size:256,recipe:s=>Wt.fabric(s,103,1.1,.3),tile_m:.8,normal:.6,roughness:1},leather:{size:256,recipe:s=>Wt.leather(s,105),tile_m:.6,normal:.8,roughness:1},wood_light:{size:256,recipe:s=>Wt.wood(s,107,.12),tile_m:1,normal:.7,roughness:1},wood_dark:{size:256,recipe:s=>Wt.wood(s,109,.1),tile_m:1,normal:.7,roughness:1},door_wood:{size:256,recipe:s=>Wt.wood(s,113,.14),tile_m:1,normal:.9,roughness:1},metal_dark:{size:256,recipe:s=>Wt.metal(s,127),tile_m:.5,normal:.12,roughness:1,metalness:.85},metal_light:{size:256,recipe:s=>Wt.metal(s,131),tile_m:.5,normal:.12,roughness:1,metalness:.8},asphalt:{size:256,recipe:s=>Wt.concrete(s,137),tile_m:3,normal:1.2,roughness:1},grass:{size:256,recipe:s=>Wt.grass(s,139),tile_m:2,normal:.8,roughness:1}},Xp={plaster_white:"Plaster001",plaster_exterior:"Plaster003",concrete:"Concrete034",brick_painted:"Bricks059",tiles_white:"Tiles074",oak:"WoodFloor051",tiles_grey:"Tiles101",carpet:"Carpet013",asphalt:"Asphalt012",grass:"Grass004",wood_light:"Wood049",wood_dark:"Wood049",door_wood:"Wood049",metal_dark:"Metal032",metal_light:"Metal032",fabric_grey:"Fabric030",fabric_accent:"Fabric030",fabric_rug:"Fabric030",linen:"Fabric024",leather:"Leather011",floor_sport:"WoodFloor040"},bc=class{constructor(e=vn.light){this.cache=new Map,this.materials=new Map,this.bytes=0,this.genMs=0,this.style=e}palette(e){return this.style.palette[e]??this.style.palette.plaster_white}fileTextures(e,t){let n=this.base||"assets/textures/",i=`${n}sets/${Xp[e]}/`,r=`${n}${e}/`;this.loader||(this.loader=new xs,this.loaded=new Set,this.failed=new Set);let o=(l,c)=>{let h=this.loader.load(l,()=>{this.loaded.add(e),this.onLoaded&&this.onLoaded(e)},void 0,()=>{this.failed.add(e),this.cache.delete(e),this.onLoaded&&this.onLoaded(e)});return h.wrapS=h.wrapT=Kt,h.colorSpace=c?Mt:Pn,h.anisotropy=8,h},a=o(i+"rough_ao.jpg",!1);return this.bytes+=512*512*4*3*1.33,{map:o(r+"color.webp",!0),normalMap:o(i+"normal.jpg",!1),roughnessMap:a,aoMap:a,tile_m:t.tile_m,spec:t,file:!0}}textures(e){let t=this.cache.get(e);if(t)return t;let n=performance.now(),i=Ko[e]||Ko.plaster_white;if((this.textureSource||"files")==="files"&&Xp[e]&&!(this.failed&&this.failed.has(e)))return t=this.fileTextures(e,i),this.cache.set(e,t),t;let r=i.size,o=i.recipe(r),a=Iu(dM(o.lum,r,o.mid,o.amp,o.tint),r,!0),l=Iu(uM(o.height,r,i.normal),r,!1),c=Iu(fM(o.rough,r),r,!1,2);return t={map:a,normalMap:l,roughnessMap:c,tile_m:i.tile_m,spec:i},this.bytes+=r*r*4*3*1.33,this.genMs+=performance.now()-n,this.cache.set(e,t),t}get(e,t,n={}){let i=`${e}|${t}|${n.side||0}`,r=this.materials.get(i);if(r)return r;let o=Ko[e]||{},a=this.palette(e);if(t>=3){let l=this.textures(e);r=new Rt({map:l.map,normalMap:l.normalMap,roughnessMap:l.roughnessMap,roughness:1,metalness:o.metalness??0,color:a,envMapIntensity:o.metalness?1:.7}),l.aoMap&&(r.aoMap=l.aoMap,r.aoMap.channel=0,r.aoMapIntensity=.6),l.file&&r.normalScale.set(o.normal,o.normal)}else t===2?r=new Rt({color:a,roughness:.85,metalness:o.metalness?.6:0}):r=new _o({color:a});return r.userData.materialId=e,n.side&&(r.side=n.side),this.materials.set(i,r),r}setStyle(e){this.style=e;for(let t of this.materials.values()){let n=t.userData.materialId;n&&t.color.setHex(this.palette(n))}}tileM(e){return(Ko[e]||Ko.plaster_white).tile_m}dispose(){for(let e of this.cache.values())e.map.dispose(),e.normalMap.dispose(),e.roughnessMap.dispose();for(let e of this.materials.values())e.dispose();this.cache.clear(),this.materials.clear(),this.bytes=0}},yc=null,Er=null;function Du(){if(yc)return yc;let s=document.createElement("canvas");s.width=s.height=128;let e=s.getContext("2d"),t=e.createRadialGradient(64,64,0,64,64,64);return t.addColorStop(0,"rgba(0,0,0,1)"),t.addColorStop(.45,"rgba(0,0,0,0.75)"),t.addColorStop(.8,"rgba(0,0,0,0.18)"),t.addColorStop(1,"rgba(0,0,0,0)"),e.fillStyle=t,e.fillRect(0,0,128,128),yc=new Vn(s),yc}var Mc=null;function Nu(){if(Mc)return Mc;let s=document.createElement("canvas");s.width=s.height=256;let e=s.getContext("2d"),t=e.createRadialGradient(128,128,0,128,128,128);return t.addColorStop(0,"#fff"),t.addColorStop(.55,"#fff"),t.addColorStop(1,"#000"),e.fillStyle=t,e.fillRect(0,0,256,256),Mc=new Vn(s),Mc}function jp(){if(Er)return Er;let s=document.createElement("canvas");s.width=4,s.height=64;let e=s.getContext("2d"),t=e.createLinearGradient(0,0,0,64);return t.addColorStop(0,"rgba(0,0,0,1)"),t.addColorStop(.35,"rgba(0,0,0,0.45)"),t.addColorStop(1,"rgba(0,0,0,0)"),e.fillStyle=t,e.fillRect(0,0,4,64),Er=new Vn(s),Er.wrapS=Kt,Er.wrapT=mn,Er}function Jo(s,e=!1){let t=s[0].index!==null,n=new Set(Object.keys(s[0].attributes)),i=new Set(Object.keys(s[0].morphAttributes)),r={},o={},a=s[0].morphTargetsRelative,l=new _t,c=0;for(let h=0;h<s.length;++h){let f=s[h],d=0;if(t!==(f.index!==null))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(let u in f.attributes){if(!n.has(u))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+'. All geometries must have compatible attributes; make sure "'+u+'" attribute exists among all geometries, or in none of them.'),null;r[u]===void 0&&(r[u]=[]),r[u].push(f.attributes[u]),d++}if(d!==n.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". Make sure all geometries have the same number of attributes."),null;if(a!==f.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(let u in f.morphAttributes){if(!i.has(u))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+".  .morphAttributes must be consistent throughout all geometries."),null;o[u]===void 0&&(o[u]=[]),o[u].push(f.morphAttributes[u])}if(e){let u;if(t)u=f.index.count;else if(f.attributes.position!==void 0)u=f.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". The geometry must have either an index or a position attribute"),null;l.addGroup(c,u,h),c+=u}}if(t){let h=0,f=[];for(let d=0;d<s.length;++d){let u=s[d].index;for(let p=0;p<u.count;++p)f.push(u.getX(p)+h);h+=s[d].attributes.position.count}l.setIndex(f)}for(let h in r){let f=Zp(r[h]);if(!f)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" attribute."),null;l.setAttribute(h,f)}for(let h in o){let f=o[h][0].length;if(f!==0){l.morphAttributes=l.morphAttributes||{},l.morphAttributes[h]=[];for(let d=0;d<f;++d){let u=[];for(let x=0;x<o[h].length;++x)u.push(o[h][x][d]);let p=Zp(u);if(!p)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" morphAttribute."),null;l.morphAttributes[h].push(p)}}}return l}function Zp(s){let e,t,n,i=-1,r=0;for(let c=0;c<s.length;++c){let h=s[c];if(e===void 0&&(e=h.array.constructor),e!==h.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(t===void 0&&(t=h.itemSize),t!==h.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(n===void 0&&(n=h.normalized),n!==h.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(i===-1&&(i=h.gpuType),i!==h.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;r+=h.count*t}let o=new e(r),a=new Pt(o,t,n),l=0;for(let c=0;c<s.length;++c){let h=s[c];if(h.isInterleavedBufferAttribute){let f=l/t;for(let d=0,u=h.count;d<u;d++)for(let p=0;p<t;p++){let x=h.getComponent(d,p);a.setComponent(d+f,p,x)}}else o.set(h.array,l);l+=h.count*t}return i!==void 0&&(a.gpuType=i),a}function Uu(s,e){if(e===tu)return console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles."),s;if(e===_r||e===Wo){let t=s.getIndex();if(t===null){let r=[],o=s.getAttribute("position");if(o!==void 0){for(let a=0;a<o.count;a++)r.push(a);s.setIndex(r),t=s.getIndex()}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible."),s}let n=t.count-2,i=[];if(e===_r)for(let r=1;r<=n;r++)i.push(t.getX(0)),i.push(t.getX(r)),i.push(t.getX(r+1));else for(let r=0;r<n;r++)r%2===0?(i.push(t.getX(r)),i.push(t.getX(r+1)),i.push(t.getX(r+2))):(i.push(t.getX(r+2)),i.push(t.getX(r+1)),i.push(t.getX(r)));return i.length/3!==n&&console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles."),s.setIndex(i),s.clearGroups(),s}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:",e),s}var Qo=new D;function Ln(s,e,t,n,i,r){let o=2*Math.PI*i/4,a=Math.max(r-2*i,0),l=Math.PI/4;Qo.copy(e),Qo[n]=0,Qo.normalize();let c=.5*o/(o+a),h=1-Qo.angleTo(s)/l;return Math.sign(Qo[t])===1?h*c:a/(o+a)+c+c*(1-h)}var Xn=class s extends Xt{constructor(e=1,t=1,n=1,i=2,r=.1){let o=i*2+1;if(r=Math.min(e/2,t/2,n/2,r),super(1,1,1,o,o,o),this.type="RoundedBoxGeometry",this.parameters={width:e,height:t,depth:n,segments:i,radius:r},o===1)return;let a=this.toNonIndexed();this.index=null,this.attributes.position=a.attributes.position,this.attributes.normal=a.attributes.normal,this.attributes.uv=a.attributes.uv;let l=new D,c=new D,h=new D(e,t,n).divideScalar(2).subScalar(r),f=this.attributes.position.array,d=this.attributes.normal.array,u=this.attributes.uv.array,p=f.length/6,x=new D,m=.5/o;for(let g=0,b=0;g<f.length;g+=3,b+=2)switch(l.fromArray(f,g),c.copy(l),c.x-=Math.sign(c.x)*m,c.y-=Math.sign(c.y)*m,c.z-=Math.sign(c.z)*m,c.normalize(),f[g+0]=h.x*Math.sign(l.x)+c.x*r,f[g+1]=h.y*Math.sign(l.y)+c.y*r,f[g+2]=h.z*Math.sign(l.z)+c.z*r,d[g+0]=c.x,d[g+1]=c.y,d[g+2]=c.z,Math.floor(g/p)){case 0:x.set(1,0,0),u[b+0]=Ln(x,c,"z","y",r,n),u[b+1]=1-Ln(x,c,"y","z",r,t);break;case 1:x.set(-1,0,0),u[b+0]=1-Ln(x,c,"z","y",r,n),u[b+1]=1-Ln(x,c,"y","z",r,t);break;case 2:x.set(0,1,0),u[b+0]=1-Ln(x,c,"x","z",r,e),u[b+1]=Ln(x,c,"z","x",r,n);break;case 3:x.set(0,-1,0),u[b+0]=1-Ln(x,c,"x","z",r,e),u[b+1]=1-Ln(x,c,"z","x",r,n);break;case 4:x.set(0,0,1),u[b+0]=1-Ln(x,c,"x","y",r,e),u[b+1]=1-Ln(x,c,"y","x",r,t);break;case 5:x.set(0,0,-1),u[b+0]=Ln(x,c,"x","y",r,e),u[b+1]=1-Ln(x,c,"y","x",r,t);break}}static fromJSON(e){return new s(e.width,e.height,e.depth,e.segments,e.radius)}};var pM=["open","opening","on"],Sc=s=>!!s&&pM.includes(s),Kp=(s,e)=>s.id<e.id?-1:s.id>e.id?1:0;function mM(s){let e=s.dimensions,t=e.scale_m_per_px,n=e.calibration&&e.calibration.status;return typeof t=="number"&&Number.isFinite(t)&&t>0&&(n==="measured"||n==="estimated")?{scale:t,estimated:n==="estimated"}:{scale:.2/(.006*(e.width_px||1e3)),estimated:!0}}function gM(s){let e=[0];for(let t=1;t<s.length;t++)e.push(e[t-1]+Math.hypot(s[t][0]-s[t-1][0],s[t][1]-s[t-1][1]));return e}function Ou(s,e,t){let n=0;for(;n<s.length-2&&t>e[n+1];)n++;let[i,r]=s[n],[o,a]=s[n+1],l=e[n+1]-e[n];if(l<=1e-9)return{p:[i,r],d:[1,0]};let c=Math.min(1,Math.max(0,(t-e[n])/l));return{p:[i+(o-i)*c,r+(a-r)*c],d:[(o-i)/l,(a-r)/l]}}function xM(s,e,t,n){let i=[];for(let r=1;r<s.length-1;r++)t<e[r]&&e[r]<n&&i.push(s[r]);return[Ou(s,e,t).p,...i,Ou(s,e,n).p]}var Jp=(s,e,t)=>{let n=s[0]-e[0],i=s[1]-e[1],r=Math.hypot(n,i);return r<1e-9?s:[s[0]+n/r*t,s[1]+i/r*t]},Qp=(s,e,t)=>[s[0]+e[0]*t,s[1]+e[1]*t];function $o(s,e,t,n){let{scale:i}=mM(s),r=1/i,o=new Map;for(let h of s.openings){let f=o.get(h.wall_id);f?f.push(h):o.set(h.wall_id,[h])}let a=[],l=new Map;for(let h of[...new Map(s.walls.map(f=>[f.id,f])).values()].sort(Kp)){if(n!=null&&h.level_id!==n)continue;let f=h.polyline.map(T=>[T[0]*e,T[1]*t]),d=gM(f),u=d[d.length-1];if(u<=1e-6)continue;let p=Math.max(1,(h.thickness_m||.2)*r);l.set(h.id,{pts:f,cum:d,wpx:p,wall:h});let x=(o.get(h.id)||[]).map(T=>{let _=(T.t||0)*u,M=(T.width_m||0)*r/2;return[Math.max(0,_-M),Math.min(u,_+M)]});x.sort((T,_)=>T[0]-_[0]||T[1]-_[1]);let m=[],g=0;for(let[T,_]of x)T>g&&m.push([g,T]),g=Math.max(g,_);g<u&&m.push([g,u]);let b=0;for(let[T,_]of m){if(_-T<=.01)continue;let M=xM(f,d,T,_);T<=0&&(M[0]=Jp(M[0],M[1],p/2)),_>=u&&(M[M.length-1]=Jp(M[M.length-1],M[M.length-2],p/2)),a.push({id:h.id,part:b,points:M,width:p,wall:h}),b+=1}}let c=[];for(let h of[...s.openings].sort(Kp)){let f=l.get(h.wall_id);if(!f)continue;let{p:d,d:u}=Ou(f.pts,f.cum,(h.t||0)*f.cum[f.cum.length-1]),p=(h.width_m||0)*r;c.push({opening:h,wall:f.wall,c:d,d:u,g0:Qp(d,u,-p/2),g1:Qp(d,u,p/2),w:p,wpx:f.wpx})}return{walls:a,openings:c,scale:i}}function Fu(s,e,t,n,i,r={}){let{walls:o,openings:a}=$o(s,e,t,n),l=[];for(let c of o)if(!(r.bodyOnly===!1&&(c.wall.kind==="railing"||c.wall.kind==="low")))for(let h=1;h<c.points.length;h++)l.push({a:c.points[h-1],b:c.points[h],w:c.width,kind:c.wall.kind,id:c.id});for(let c of a){let h=c.opening.kind;if(h!=="passage"){if(h==="door"){let f=c.opening.anchor_ref,d=f&&f.resource_type==="ha_entity"?i[f.resource_id]:void 0;if(!f||Sc(d))continue;let u=r.locks&&r.locks[c.opening.id]}l.push({a:c.g0,b:c.g1,w:c.wpx,kind:h,id:c.opening.id})}}return l}function Ri(s,e,t){let n=!1;for(let i=0,r=t.length-1;i<t.length;r=i++){let o=t[i][0],a=t[i][1],l=t[r][0],c=t[r][1];a>e!=c>e&&s<(l-o)*(e-a)/(c-a)+o&&(n=!n)}return n}function Ar(s){let e=0,t=0,n=0;for(let i=0;i<s.length;i++){let[r,o]=s[i],[a,l]=s[(i+1)%s.length],c=r*l-a*o;e+=c,t+=(r+a)*c,n+=(o+l)*c}return Math.abs(e)<1e-9?[s[0][0],s[0][1]]:[t/(3*e),n/(3*e)]}function Bu(s,e){let t=s.length;if(t<2)return[];let n=[];for(let a=0;a<t-1;a++){let l=s[a+1][0]-s[a][0],c=s[a+1][1]-s[a][1],h=Math.hypot(l,c)||1;n.push([l/h,c/h])}let i=a=>{let l=[];for(let c=0;c<t;c++){let h=n[Math.max(0,c-1)],f=n[Math.min(t-2,c)],d=[-h[1]*a,h[0]*a],u=[-f[1]*a,f[0]*a],p=d[0]+u[0],x=d[1]+u[1],m=Math.hypot(p,x);if(m<1e-6){l.push([s[c][0]+u[0]*e,s[c][1]+u[1]*e]);continue}let g=(p*u[0]+x*u[1])/m,b=e/Math.max(g,.25);l.push([s[c][0]+p/m*b,s[c][1]+x/m*b])}return l},r=i(1),o=i(-1).reverse();return[...r,...o]}var nm=1.65,$p=8,_M=85,vM=350,wc=(s,e)=>-Math.atan2(e,s),em=(s,e,t)=>s+(e-s)*t;function zu(s,e,t,n,i=[[0,0],[1,0],[1,1],[0,1]]){let r=new _t,o=[s,e,t,s,t,n].flat(),a=[i[0],i[1],i[2],i[0],i[2],i[3]].flat();return r.setAttribute("position",new at(o,3)),r.setAttribute("uv",new at(a,2)),r.computeVertexNormals(),r}function yM(s,e,t=.22,n=.28,i=.32){let r=s.length,o=[];for(let a=0;a<r;a++){let l=s[a],c=s[(a+1)%r],h=Math.hypot(c[0]-l[0],c[1]-l[1]);if(h<i)continue;let f=-(c[1]-l[1])/h,d=(c[0]-l[0])/h;Ri((l[0]+c[0])/2+f*.02,(l[1]+c[1])/2+d*.02,s)&&(f=-f,d=-d);let u=h/.5;o.push(zu([l[0],e+.006,l[1]],[c[0],e+.006,c[1]],[c[0]+f*t,e+.006,c[1]+d*t],[l[0]+f*t,e+.006,l[1]+d*t],[[0,0],[u,0],[u,1],[0,1]]));let p=.004;o.push(zu([l[0]+f*p,e,l[1]+d*p],[c[0]+f*p,e,c[1]+d*p],[c[0]+f*p,e+n,c[1]+d*p],[l[0]+f*p,e+n,l[1]+d*p],[[0,0],[u,0],[u,1],[0,1]]))}return o}function li(s,e,t=[0,0,0]){let n=s.index?s.toNonIndexed():s,i=n.attributes.position,r=new Float32Array(i.count*2),o=new D,a=new D,l=new D,c=new D;for(let h=0;h<i.count;h+=3){o.fromBufferAttribute(i,h),a.fromBufferAttribute(i,h+1),l.fromBufferAttribute(i,h+2),c.copy(a).sub(o).cross(l.clone().sub(o));let f=Math.abs(c.x),d=Math.abs(c.y),u=Math.abs(c.z);for(let p=0;p<3;p++){let x=[o,a,l][p],m,g;f>=d&&f>=u?(m=x.z+t[2],g=x.y+t[1]):d>=u?(m=x.x+t[0],g=x.z+t[2]):(m=x.x+t[0],g=x.y+t[1]),r[(h+p)*2]=m/e,r[(h+p)*2+1]=g/e}}return n.setAttribute("uv",new Pt(r,2)),n.computeVertexNormals(),n}function Cr(s){let e=new ms;return s.forEach(([t,n],i)=>i?e.lineTo(t,-n):e.moveTo(t,-n)),e.closePath(),e}function Tc(s,e,t){let n=new go(Cr(s),{depth:e,bevelEnabled:!1,curveSegments:1});return n.rotateX(-Math.PI/2),n.translate(0,t,0),n}function Dt(s,e,t,n,i,r,o=0){let a=new Xt(s,e,t);return o&&a.rotateY(o),a.translate(n,i,r),a}function tm(s,e,t,n,i,r=16,o=s){let a=new Jt(o,s,e,r);return a.translate(t,n,i),a}var ku=(s,e)=>{let[t,n]=Ar(s);return s.map(([i,r])=>[i+Math.sign(t-i)*e,r+Math.sign(n-r)*e])},Ac=class{constructor(e){this.lib=e,this.root=new Bt,this.root.name="plan",this.levels={},this.doors=[],this.shutters=[],this.lamps=[],this.devices=[],this.markers=[],this.presence=[],this.tints=[],this.pool=[],this.labels=[],this.quality=3,this.reflectors=[],this.cameras=[],this.mirror=null,this.style=e.style||vn.light,this.cutY=null,this.clipMaterials=new Set,this.styled=[],this.furnitureMode="procedural"}dispose(){this.root.traverse(e=>{e.geometry&&e.geometry.dispose()}),this.root.clear(),this.levels={},this.doors=[],this.shutters=[],this.lamps=[],this.devices=[],this.markers=[],this.presence=[],this.tints=[],this.labels=[],this.cameras=[],this.clipMaterials.clear(),this.styled=[],this.screens=[],this.lockPlates=[],this.ground=null;for(let e of this.pool)e.parent&&e.parent.remove(e);this.pool=[]}setStyle(e){this.style=e,this.lib.setStyle(e);let t=e.palette;for(let n of this.styled){let i=t[n.key];i!==void 0&&(n.prop==="color"?n.material.color.setHex(i):n.prop==="emissive"?(n.material.color.setHex(i),n.material.emissive.setHex(i)):n.prop==="opacity"&&(n.material.opacity=e.post[n.key]))}for(let n of Object.values(this.levels))n.capEdges&&(n.capEdges.visible=!!e.cut.edge&&n.capMesh.visible);this.ground&&(this.ground.disc.material.color.setHex(e.ground.disc),this.ground.shadow.material.opacity=e.ground.contact)}setNight(e){this.ground&&this.ground.disc.material.color.setHex(this.style.ground.disc).lerp(new Ee(this.style.ground.discNight),e)}styledMaterial(e,t,n="color"){return this.styled.push({material:e,key:t,prop:n}),e}setCut(e,t){this.cutY=e,this.cutLevel=t;let n=e==null?null:[new Qt(new D(0,-1,0),e)];for(let i of this.clipMaterials)i.clippingPlanes=n,i.clipShadows=!!n,i.needsUpdate=i.needsUpdate||!1;for(let i of Object.values(this.levels)){let r=e!=null&&i.id===t;i.capMesh&&(i.capMesh.visible=r,i.capMesh.position.y=e??0),i.capEdges&&(i.capEdges.visible=r&&!!this.style.cut.edge,i.capEdges.position.y=e??0)}}build(e,t,n={}){this.dispose(),this.plan=e,this.quality=t,this.reflections=!!n.reflections;let i=e.doc,r=i.dimensions.width_px,o=i.dimensions.height_px,{scale:a}=$o(i,r,o,null);this.scale=a,this.W=r,this.H=o;let l=m=>[m[0]*r*a,m[1]*o*a];this.toM=l;let c=t,h=this.lib,f=(m,g)=>h.get(m,c,{side:g}),d=new Map(i.levels.map(m=>[m.id,m])),u=e.entities;for(let m of i.levels){let g=new Bt;g.name=`level:${m.id}`,this.root.add(g);let b=m.elevation_m,T=m.ceiling_height_m,_=e.zones.filter(S=>S.level_id===m.id).map(S=>({...S,polyM:S.polygon.map(w=>l([w.x,w.y]))}));if(!_.length){let S=i.walls.filter(w=>w.level_id===m.id).flatMap(w=>w.polyline.map(l));if(S.length){let P=Math.min(...S.map(H=>H[0]))-.5,U=Math.max(...S.map(H=>H[0]))+.5,F=Math.min(...S.map(H=>H[1]))-.5,O=Math.max(...S.map(H=>H[1]))+.5;_.push({id:`plate-${m.id}`,name:m.name,level_id:m.id,polyM:[[P,F],[U,F],[U,O],[P,O]],x_proto:{floor_material:"concrete"},synthetic:!0})}}let M={id:m.id,name:m.name,group:g,elevation:b,ceiling:T,zones:_,ceilings:[],extent:null,statics:[],segs:[],stairs:[],objectsBlocking:[],strips:[],blobs:[],caps:[],capLines:[]};this.levels[m.id]=M;let E=new Map,A=(S,w)=>{(E.get(S)||E.set(S,[]).get(S)).push(w)},{walls:v,openings:R}=$o(i,r,o,m.id);for(let S of v){let w=S.wall,P=w.height_m??T,U=S.points.map(k=>[k[0]*a,k[1]*a]),F=Bu(U,S.width*a/2);if(F.length<3)continue;let O=Tc(F,P-(w.base_z_m||0),b+(w.base_z_m||0)),H=w.kind==="railing"?"metal_dark":w.kind==="exterior"?"plaster_exterior":"plaster_white";if(A(H,li(O,h.tileM(H))),w.kind!=="railing"&&!(w.base_z_m>0)){if(M.strips.push(...yM(F,b)),P>=T*.5){let k=new bi(Cr(F));k.rotateX(-Math.PI/2),M.caps.push(k);for(let W=0;W<F.length;W++){let Z=F[W],he=F[(W+1)%F.length];M.capLines.push(Z[0],0,Z[1],he[0],0,he[1])}}if(c>=3&&w.kind==="interior"){let k=Tc(Bu(U,S.width*a/2+.012),.08,b);A("plaster_ceiling",li(k,2))}}}let N=_.length?_.flatMap(S=>S.polyM):v.flatMap(S=>S.points.map(w=>[w[0]*a,w[1]*a]));N.length&&(M.extent={minX:Math.min(...N.map(S=>S[0])),maxX:Math.max(...N.map(S=>S[0])),minZ:Math.min(...N.map(S=>S[1])),maxZ:Math.max(...N.map(S=>S[1]))});for(let S of _){let w=0;for(let U of R){if(U.opening.kind!=="window")continue;let F=[U.c[0]*a,U.c[1]*a],O=[-U.d[1],U.d[0]];(Ri(F[0]+O[0]*.3,F[1]+O[1]*.3,S.polyM)||Ri(F[0]-O[0]*.3,F[1]-O[1]*.3,S.polyM))&&(w+=U.opening.width_m*U.opening.height_m)}let P=0;for(let U=0;U<S.polyM.length;U++){let F=S.polyM[U],O=S.polyM[(U+1)%S.polyM.length];P+=F[0]*O[1]-O[0]*F[1]}S.daylight=Math.min(1,w/Math.max(1,Math.abs(P)/2)*5)}for(let S of R){let w=S.opening,P=[S.c[0]*a,S.c[1]*a],U=S.d,F=[-U[1],U[0]],O=w.width_m,H=S.wpx*a,k=S.wall.height_m??T,W=wc(U[0],U[1]),Z=b+w.sill_m+w.height_m;if(k-(w.sill_m+w.height_m)>.01&&A(S.wall.kind==="exterior"?"plaster_exterior":"plaster_white",li(Dt(O,k-(w.sill_m+w.height_m),H,P[0],(Z+b+k)/2,P[1],W),2)),w.kind==="window"){w.sill_m>.01&&A(S.wall.kind==="exterior"?"plaster_exterior":"plaster_white",li(Dt(O,w.sill_m,H,P[0],b+w.sill_m/2,P[1],W),2));let he=.06;A("metal_light",Dt(he,w.height_m,H*.9,P[0]-U[0]*(O/2-he/2),b+w.sill_m+w.height_m/2,P[1]-U[1]*(O/2-he/2),W)),A("metal_light",Dt(he,w.height_m,H*.9,P[0]+U[0]*(O/2-he/2),b+w.sill_m+w.height_m/2,P[1]+U[1]*(O/2-he/2),W)),A("metal_light",Dt(O,he,H*.9,P[0],Z-he/2,P[1],W)),A("metal_light",Dt(O+.1,he,H+.08,P[0],b+w.sill_m+he/2,P[1],W)),c>=3&&(A("tiles_white",Dt(O+.14,.03,H+.12,P[0],b+w.sill_m-.015,P[1],W)),O>1&&A("metal_light",Dt(.04,w.height_m-he*2,H*.6,P[0],b+w.sill_m+w.height_m/2,P[1],W)),O>2&&(A("metal_light",Dt(.04,w.height_m-he*2,H*.6,P[0]-U[0]*(O/3),b+w.sill_m+w.height_m/2,P[1]-U[1]*(O/3),W)),A("metal_light",Dt(.04,w.height_m-he*2,H*.6,P[0]+U[0]*(O/3),b+w.sill_m+w.height_m/2,P[1]+U[1]*(O/3),W))),w.height_m>1.6&&A("metal_light",Dt(O-he*2,.04,H*.6,P[0],b+w.sill_m+w.height_m*.68,P[1],W)));let pe=w.x_proto&&w.x_proto.glazing==="frosted",Ae=new Re(Dt(O-he*2,w.height_m-he*2,.02,0,0,0),this.glassMaterial(pe));Ae.position.set(P[0],b+w.sill_m+w.height_m/2,P[1]),Ae.rotation.y=W,Ae.userData={kind:"glass"},g.add(Ae);let we=w.x_proto&&w.x_proto.cover_entity;if(we){let Pe=M.extent?P[0]+F[0]*.5<M.extent.minX+.01||P[0]+F[0]*.5>M.extent.maxX-.01||P[1]+F[1]*.5<M.extent.minZ+.01||P[1]+F[1]*.5>M.extent.maxZ-.01?1:-1:1,q=new Re(new Xt(O+.1,.22,.18),f("metal_light"));q.position.set(P[0]+F[0]*Pe*(H/2+.09),Z+.11,P[1]+F[1]*Pe*(H/2+.09)),q.rotation.y=W,q.castShadow=!0,g.add(q);let K=new Re(new Xt(O+.04,1,.04),this.shutterMaterial());K.geometry.translate(0,-.5,0),K.position.set(P[0]+F[0]*Pe*(H/2+.06),Z,P[1]+F[1]*Pe*(H/2+.06)),K.rotation.y=W,K.castShadow=!0,K.userData={kind:"device",entity:we,label:e.entityNames[we]||we,domain:"cover"},g.add(K),this.devices.push(K),this.shutters.push({entity:we,mesh:K,height:w.height_m,current:1}),this.labels.push({kind:"device",entity:we,pos:new D(P[0]+F[0]*Pe*.3,Z+.3,P[1]+F[1]*Pe*.3),level:m.id})}}else if(w.kind==="door"){let pe="wood_dark";if(A(pe,Dt(.05,w.height_m,H+.02,P[0]-U[0]*(O/2-.05/2),b+w.height_m/2,P[1]-U[1]*(O/2-.05/2),W)),A(pe,Dt(.05,w.height_m,H+.02,P[0]+U[0]*(O/2-.05/2),b+w.height_m/2,P[1]+U[1]*(O/2-.05/2),W)),A(pe,Dt(O,.05,H+.02,P[0],Z-.05/2,P[1],W)),c>=3){let oe=H+.024;A(pe,Dt(.07,w.height_m+.07,oe,P[0]-U[0]*(O/2+.07/2),b+(w.height_m+.07)/2,P[1]-U[1]*(O/2+.07/2),W)),A(pe,Dt(.07,w.height_m+.07,oe,P[0]+U[0]*(O/2+.07/2),b+(w.height_m+.07)/2,P[1]+U[1]*(O/2+.07/2),W)),A(pe,Dt(O+.07*2,.07,oe,P[0],Z+.07/2,P[1],W))}let Ae=w.anchor_ref&&w.anchor_ref.resource_type==="ha_entity"?w.anchor_ref.resource_id:null,we=e.doorLocks&&e.doorLocks[w.id],Pe=w.height_m-.05-.01,q=.045,K=w.swing||"right",de=[U[1],-U[0]],De=[-U[1],U[0]],_e=[],ke=(re,oe,le,Be,Ne)=>{let Le=new Bt;Le.position.set(re[0],b,re[1]);let Ye=wc(oe[0],oe[1]);Le.rotation.y=Ye;let B=w.id==="d-liv-kit",$e=le-.02,Ke=new Re(c>=3?new Xn($e,Pe,q,2,.006):new Xt($e,Pe,q),B?this.glassMaterial(!1,!0):f("door_wood"));if(Ke.geometry.translate(le/2,Pe/2,0),Ke.castShadow=!0,Ke.receiveShadow=!0,c>=3&&!B&&li(Ke.geometry,1),Ke.userData={kind:"device",entity:Ae||`door:${w.id}`,label:Ae?e.entityNames[Ae]||Ae:"\u05D3\u05DC\u05EA \u05DC\u05DC\u05D0 \u05D7\u05D9\u05D9\u05E9\u05DF",domain:"door",openingId:w.id,lock:we||null},Le.add(Ke),c>=3)if(B){let y=f("metal_dark");for(let[G,X,J,ue]of[[.04,Pe,.02,Pe/2],[.04,Pe,$e-.02,Pe/2],[$e,.04,$e/2,.02],[$e,.04,$e/2,Pe-.02]]){let fe=new Re(new Xt(G,X,q+.01),y);fe.position.set(J+.01,ue,0),Le.add(fe)}}else{let y=f("door_wood"),G=$e-.22,X=Pe*.52,J=Pe*.28;for(let ue of[-1,1])for(let[fe,$]of[[.14+J/2,J],[.14+J+.12+X/2,X]]){let ne=new Re(new Xn(G,$,.012,2,.005),y);ne.position.set(le/2+.01,fe,ue*(q/2+.003)),ne.castShadow=!0,Le.add(ne)}}for(let y of[-1,1]){let G=new Re(new Jt(.025,.025,.012,14),f("metal_light"));G.rotation.x=Math.PI/2,G.position.set(le-.12,1.02,y*(q/2+.006)),Le.add(G);let X=new Re(new Jt(.009,.009,.12,10),f("metal_light"));X.rotation.z=Math.PI/2,X.position.set(le-.17,1.02,y*(q/2+.04)),Le.add(X);let J=new Re(new Jt(.009,.009,.05,10),f("metal_light"));J.rotation.x=Math.PI/2,J.position.set(le-.12,1.02,y*(q/2+.025)),Le.add(J)}if(we){let y=new Re(new Xt(.06,.1,.06),this.lockMaterial());y.position.set(le-.15,1.12,0),y.userData={kind:"lock",entity:we},Le.add(y),this.devices.push(y),this.lockPlates=this.lockPlates||[],this.lockPlates.push({entity:we,mesh:y})}g.add(Le),this.devices.push(Ke);let I=Ye;if(Ne==="swing"){I=wc(Be[0],Be[1]);let y=I-Ye;for(;y>Math.PI;)y-=2*Math.PI;for(;y<-Math.PI;)y+=2*Math.PI;I=Ye+Math.sign(y)*(_M*Math.PI)/180}_e.push({grp:Le,closedYaw:Ye,openYaw:I,kind:Ne,slide:Ne==="slide"?[oe[0]*-(le*.92),oe[1]*-(le*.92)]:null,base:[re[0],re[1]]})},et=[S.g0[0]*a,S.g0[1]*a],te=[S.g1[0]*a,S.g1[1]*a],ae=(w.hinge||"start")==="start"?de:De;if(K==="sliding"){let re=(w.hinge||"start")==="start"?et:te,oe=re===et?U:[-U[0],-U[1]];ke([re[0]+de[0]*0,re[1]+de[1]*0],oe,O,null,"slide")}else if(K==="double")ke(et,U,O/2,ae,"swing"),ke(te,[-U[0],-U[1]],O/2,ae,"swing");else if(K!=="none"){let re=K==="left"?de:De,oe=(w.hinge||"start")==="start"?et:te,le=oe===et?U:[-U[0],-U[1]];ke(oe,le,O,re,"swing")}if(this.doors.push({id:w.id,entity:Ae,lock:we||null,leaves:_e,t:0,open:!1}),Ae){let re=new Bt,oe=this.markerMaterial(),le=.06,Be=.04;for(let Ne of[-1,1]){let Le=new Re(Dt(le,w.height_m+le,H+Be*2,P[0]+U[0]*Ne*(O/2+le/2),b+(w.height_m+le)/2,P[1]+U[1]*Ne*(O/2+le/2),W),oe);re.add(Le)}re.add(new Re(Dt(O+le*2,le,H+Be*2,P[0],Z+le/2,P[1],W),oe)),re.visible=!1,g.add(re),this.markers.push({entity:Ae,group:re}),this.labels.push({kind:"device",entity:Ae,pos:new D(P[0],Z+.25,P[1]),level:m.id})}}else w.kind}for(let S of _){let w=S.x_proto&&S.x_proto.floor_material||"concrete",P=b>.01?.08:.25,U=Tc(S.polyM,P,b-P),F=f(w),O=this.reflections&&c>=3?this.transparentClone(F):F,H=new Re(li(U,h.tileM(w)),O);H.receiveShadow=!0,H.castShadow=c>=2,H.userData={kind:"floor",zone:S.id,level:m.id},g.add(H),M.statics.push(H);let k=new bi(Cr(S.polyM));k.rotateX(-Math.PI/2),k.translate(0,b+T,0);let W=new Re(li(k,h.tileM("plaster_ceiling")),f("plaster_ceiling",Ot));W.castShadow=!0,W.receiveShadow=!0,W.userData={kind:"ceiling"},g.add(W),M.ceilings.push(W);let[Z,he]=Ar(S.polyM),pe=S.x_proto&&S.x_proto.light;if(pe&&c<3){let we=new bi(Cr(ku(S.polyM,.08)));we.rotateX(-Math.PI/2),we.translate(0,b+.014,0);let Pe=new Re(we,new Et({color:16762967,transparent:!0,opacity:.4,depthWrite:!1}));Pe.visible=!1,g.add(Pe),this.tints.push({entity:pe,mesh:Pe,zone:S.id})}let Ae=S.x_proto&&S.x_proto.presence;if(Ae){let we=ku(S.polyM,.1),Pe=ku(S.polyM,.4),q=Cr(we),K=new ps;Pe.forEach(([_e,ke],et)=>et?K.lineTo(_e,-ke):K.moveTo(_e,-ke)),K.closePath(),q.holes.push(K);let de=new bi(q);de.rotateX(-Math.PI/2),de.translate(0,b+.026,0);let De=new Re(de,this.styledMaterial(new Et({color:this.style.palette.presence,transparent:!0,opacity:.45,depthWrite:!1}),"presence"));De.visible=!1,g.add(De),this.presence.push({entity:Ae,mesh:De,zone:S.id,fade:1})}this.labels.push({kind:"room",text:S.name,pos:new D(Z,b+.05,he),level:m.id,zone:S.id}),S.x_proto&&typeof S.x_proto.temp=="number"&&this.labels.push({kind:"temp",text:`${S.x_proto.temp.toFixed(1)}\xB0`,pos:new D(Z,b+1.5,he),level:m.id,zone:S.id,offset:.55})}for(let S of i.objects.filter(w=>w.level_id===m.id)){let[w,P]=l(S.position),U=-(S.rotation_deg||0)*Math.PI/180,F=b+(S.z_m||0);this.buildObject(S,w,F,P,U,g,A,M,e)}for(let S of i.connectors.filter(w=>w.level_from===m.id&&w.kind==="stairs"&&w.polyline.length>=2)){let w=d.get(S.level_to);if(!w)continue;let P=l(S.polyline[0]),U=l(S.polyline[S.polyline.length-1]),F=Math.hypot(U[0]-P[0],U[1]-P[1]),O=S.flights&&S.flights[0]&&S.flights[0].steps||Math.max(2,Math.round(F/.28)),H=w.elevation_m-b,k=(U[0]-P[0])/F,W=(U[1]-P[1])/F,Z=wc(k,W),he=F/O,pe=H/O;for(let Ae=0;Ae<O;Ae++){let we=(Ae+.5)*he,Pe=b+(Ae+1)*pe,q=Math.max(.02,(Ae+1)*pe);A("oak",li(Dt(he+.01,q,S.width_m,P[0]+k*we,Pe-q/2,P[1]+W*we,Z),1))}A("wood_dark",Dt(F,.08,.05,(P[0]+U[0])/2+0,b+H/2-.04,(P[1]+U[1])/2,Z)),M.stairs.push({a:P,b:U,run:F,width:S.width_m,from:m.id,to:S.level_to,elevFrom:b,elevTo:w.elevation_m,dx:k,dz:W})}let L=Fu(i,r,o,m.id,u);for(let S of e.anchors.filter(w=>w.level_id===m.id&&w.resource_type==="camera")){let[w,P]=l([S.x,S.y]),U=S.mount_height_m??2.4,F=(S.rotation||0)*Math.PI/180,O=[Math.sin(F),-Math.cos(F)],H=new Bt;H.position.set(w,b+U,P),H.rotation.y=-F+Math.PI/2;let k=new Re(new Xt(.24,.1,.12),f("metal_dark"));k.position.x=.1,k.rotation.z=-(S.tilt_deg||0)*Math.PI/180,H.add(k);let W=new Re(new Jt(.035,.035,.04,12),this.lensMaterial(S.online));W.rotation.z=Math.PI/2,W.position.set(.23,-.03,0),H.add(W);let Z=new Re(new Xt(.06,.06,.06),f("metal_dark"));H.add(Z),H.userData={kind:"camera",id:S.id,label:S.label,online:S.online},k.userData=H.userData,W.userData=H.userData,g.add(H),this.devices.push(k,W);let he=(S.radius??.5)*r,Ae=MM([S.x*r,S.y*o],S.rotation||0,S.fov||90,he,L).map(we=>[we[0]*a,we[1]*a]);if(Ae.length>=3){let we=new bi(Cr(Ae));we.rotateX(-Math.PI/2),we.translate(0,b+.03,0);let Pe=S.online===!1?new Et({color:10134453,transparent:!0,opacity:.12,depthWrite:!1,side:Ot}):this.styledMaterial(new Et({color:this.style.palette.cone,transparent:!0,opacity:.11,depthWrite:!1,side:Ot}),"cone"),q=new Re(we,Pe);q.userData={kind:"cone",noClip:!0},g.add(q);let K=new Re(Tc(Ae,U-.2,b+.05),this.styledMaterial(new Et({color:this.style.palette.cone,transparent:!0,opacity:.05,depthWrite:!1,side:Ot}),"cone"));K.visible=!1,K.userData={kind:"cone-volume",noClip:!0},g.add(K),this.cameras.push({id:S.id,cone:q,vol:K,body:H,fwd:O,pos:[w,P],mount:U,tilt:S.tilt_deg||0,label:S.label,level:m.id})}this.labels.push({kind:"camera",text:S.label,pos:new D(w,b+U+.2,P),level:m.id,online:S.online})}for(let[S,w]of E){let P=w.map(H=>H.index?H.toNonIndexed():H),U=Jo(P,!1),F=f(S),O=new Re(U,F);O.castShadow=!0,O.receiveShadow=!0,O.userData={kind:"static",material:S,level:m.id},g.add(O),M.statics.push(O)}if(c>=2){if(M.strips.length){let S=this.styledMaterial(new Et({map:jp(),color:0,transparent:!0,opacity:this.style.post.junctionAlpha,depthWrite:!1,side:Ot,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),"junctionAlpha","opacity"),w=new Re(Jo(M.strips,!1),S);w.userData={kind:"ao",noClip:!0},w.renderOrder=1,g.add(w)}if(M.blobs.length){let S=this.styledMaterial(new Et({map:Du(),color:0,transparent:!0,opacity:this.style.post.contactAlpha,depthWrite:!1,side:Ot,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),"contactAlpha","opacity"),w=new Re(Jo(M.blobs,!1),S);w.userData={kind:"ao",noClip:!0},w.renderOrder=1,g.add(w)}}if(M.caps.length){let S=this.styledMaterial(new Et({color:this.style.palette.section_cap,toneMapped:!1}),"section_cap");M.capMesh=new Re(Jo(M.caps.map(P=>P.index?P.toNonIndexed():P),!1),S),M.capMesh.visible=!1,M.capMesh.userData={kind:"cap",noClip:!0},M.capMesh.renderOrder=2,g.add(M.capMesh);let w=new _t;w.setAttribute("position",new at(M.capLines,3)),M.capEdges=new fs(w,this.styledMaterial(new Hi({color:this.style.palette.section_edge,toneMapped:!1,transparent:!0,opacity:.9}),"section_edge")),M.capEdges.visible=!1,M.capEdges.userData={kind:"cap",noClip:!0},M.capEdges.renderOrder=3,g.add(M.capEdges)}M.segsPx=null}{let m=Object.values(this.levels).filter(g=>g.extent);if(m.length){let g=m.reduce((S,w)=>S.elevation<w.elevation?S:w),b=g.extent,T=b.maxX-b.minX,_=b.maxZ-b.minZ,M=(b.minX+b.maxX)/2,E=(b.minZ+b.maxZ)/2,A=new Bt;A.userData={kind:"ground",noClip:!0};let v=c>=3&&!this.lite,R=v?new Rt({color:this.style.ground.disc,roughness:1,metalness:0,transparent:!0,alphaMap:Nu(),depthWrite:!1}):new Et({color:this.style.ground.disc,transparent:!0,alphaMap:Nu(),depthWrite:!1}),N=new Re(new ao(Math.max(T,_)*3.2,72),this.styledMaterial(R,"ground_disc"));N.rotation.x=-Math.PI/2,N.position.set(M,g.elevation-.25,E),N.receiveShadow=v,N.userData={kind:"ground",noClip:!0},A.add(N);let L=new Re(new Vi(T+3,_+3),new Et({map:Du(),color:0,transparent:!0,opacity:this.style.ground.contact,depthWrite:!1}));L.rotation.x=-Math.PI/2,L.position.set(M,g.elevation-.245,E),L.userData={kind:"ground",noClip:!0},A.add(L),this.ground={group:A,disc:N,shadow:L},this.root.add(A)}}this.root.traverse(m=>{m.material&&!(m.userData&&m.userData.noClip)&&!m.isSprite&&!m.isLine&&this.clipMaterials.add(m.material)}),this.cutY!=null&&this.setCut(this.cutY,this.cutLevel);let p=Object.values(this.levels).flatMap(m=>m.stairs.filter(g=>!g.arrival));for(let m of p){let g=this.levels[m.to];g&&g.stairs.push({...m,arrival:!0})}let x=Math.min($p,this.maxLights??$p,Math.max(1,this.lamps.length));for(let m=0;m<x;m++){let g=new _s(16777215,0,9,2);g.castShadow=!!n.lampShadows&&m<2,g.shadow.mapSize.set(512,512),g.shadow.bias=-.002,g.position.set(0,-100,0),this.root.add(g),this.pool.push(g)}return this.reflections&&t>=3&&this.addReflectors(),this.setStates(e.entities,e.coverPositions,!0),this.updateLevelCollision(),this.root}addReflectors(){let{Reflector:e}=this._reflector||{};if(e)for(let t of Object.values(this.levels)){if(!t.extent)continue;let n=t.extent.maxX-t.extent.minX,i=t.extent.maxZ-t.extent.minZ,r=new e(new Vi(n,i),{clipBias:.003,textureWidth:1024,textureHeight:1024,color:8949913});r.rotation.x=-Math.PI/2,r.position.set((t.extent.minX+t.extent.maxX)/2,t.elevation-.004,(t.extent.minZ+t.extent.maxZ)/2),r.userData={kind:"reflector"},t.group.add(r),this.reflectors.push(r)}}transparentClone(e){let t=e.clone();return t.transparent=!0,t.opacity=.9,t}glassMaterial(e,t){return this.quality>=3&&!this.lite?new ln({color:15266040,metalness:0,roughness:e?.55:.05,transmission:e?.7:.92,thickness:.05,ior:1.5,transparent:!0,opacity:1,side:Ot,envMapIntensity:1.2,clearcoat:.6}):new Rt({color:14674419,transparent:!0,opacity:e?.62:.16,roughness:e?.5:.05,metalness:0,side:Ot,envMapIntensity:1.4,depthWrite:!1})}shutterMaterial(){return this._shutter||(this._shutter=this.styledMaterial(new Rt({color:this.style.palette.shutter,roughness:.6,metalness:.3}),"shutter")),this._shutter}markerMaterial(){return this._marker||(this._marker=this.styledMaterial(new Rt({color:this.style.palette.open_door,emissive:this.style.palette.open_door,emissiveIntensity:.9,roughness:.8}),"open_door","emissive")),this._marker}lockMaterial(){return new Rt({color:this.style.palette.lock_ok,emissive:this.style.palette.lock_ok,emissiveIntensity:.6,roughness:.5,metalness:.4})}lensMaterial(e){let t=this.style.palette.cone;return e===!1?new Rt({color:10134453,roughness:.2}):this.styledMaterial(new Rt({color:t,emissive:t,emissiveIntensity:.9,roughness:.2}),"cone","emissive")}bulbMaterial(e=3e3){let t=Ec(e);return new Rt({color:16774880,emissive:new Ee(t[0],t[1],t[2]),emissiveIntensity:0,roughness:.4})}buildObject(e,t,n,i,r,o,a,l,c){let h=this.quality,f=this.lib,d=L=>f.get(L,h),{w_m:u,d_m:p,h_m:x}=e.size,m=Math.cos(r),g=Math.sin(r),b=(L,S)=>[t+L*m+S*g,i-L*g+S*m],T=h>=3,_=(L,S,w,P,U,F,O,H=.02,k=2)=>{let[W,Z]=b(U,O),he=Math.min(H,S/2-.001,w/2-.001,P/2-.001),pe=Math.min(S,w,P)<.12?1:k,Ae=T&&he>.003?new Xn(S,w,P,pe,he):new Xt(S,w,P);r&&Ae.rotateY(r),Ae.translate(W,n+F,Z),a(L,T?li(Ae,f.tileM(L)):Ae)},M=(L,S,w,P,U,F,O=16,H=S)=>{let[k,W]=b(P,F),Z=tm(S,w,k,n+U,W,O,H);a(L,T?li(Z,f.tileM(L)):Z)},E=(L,S,w,P,U=.06,F=.022,O=.7)=>{for(let[H,k]of[[-1,-1],[1,-1],[-1,1],[1,1]])M(L,F,P,H*(S/2-U),P/2,k*(w/2-U),10,F*O)},A=e.item_id,v=A.split(".")[0],R=e.anchor_ref&&e.anchor_ref.resource_type==="ha_entity"?e.anchor_ref.resource_id:null;if(x>=.9&&v!=="mat"&&v!=="light"&&l.objectsBlocking.push({x:t,z:i,w:u,d:p,yaw:r}),v!=="light"&&v!=="mat"&&v!=="screen"&&(e.z_m||0)<.05){let L=u*1.3+.1,S=p*1.3+.1,w=(P,U)=>{let[F,O]=b(P,U);return[F,n+.009,O]};l.blobs.push(zu(w(-L/2,-S/2),w(L/2,-S/2),w(L/2,S/2),w(-L/2,S/2)))}if(!(v!=="light"&&this.furnitureMode==="models"&&this.models&&this.models.place(A,e,t,n,i,r,o,l,c)))switch(v){case"sofa":{let L=u>1.9?3:2,S=.08;E("wood_dark",u-.1,p-.1,S,.04,.02,.8),_("fabric_accent",u,.34,p-.04,0,S+.17,.02,.045),_("fabric_accent",u,x-.42,.2,0,.42+(x-.42)/2,-p/2+.1,.05),_("fabric_accent",.2,.3,p,-u/2+.1,.42+.15,0,.06),_("fabric_accent",.2,.3,p,u/2-.1,.42+.15,0,.06);let w=(u-.4)/L-.02;for(let P=0;P<L;P++){let U=-(u-.4)/2+w/2+.01+P*(w+.02);_("fabric_grey",w,.14,p-.34,U,S+.34+.07,.07,.05),_("fabric_grey",w-.02,.36,.14,U,S+.34+.14+.18,-p/2+.27,.05)}break}case"chair":{if(A.includes("office")){M("metal_dark",.03,.45-.08,0,(.45-.08)/2+.04,0,12);for(let S=0;S<5;S++){let w=S/5*Math.PI*2;_("metal_dark",.3,.03,.04,Math.cos(w)*.15,.03,Math.sin(w)*.15,.01)}_("leather",u,.08,p,0,.45,0,.03),_("leather",u*.9,x-.45-.05,.08,0,.45+(x-.45)/2+.03,-p/2+.06,.03)}else E("wood_dark",u,p,.45,.035,.018,.75),_("wood_dark",u,.035,p,0,.45,0,.012),_("fabric_grey",u-.04,.05,p-.04,0,.45+.04,0,.018),_("wood_dark",u*.92,x-.45,.03,0,.45+(x-.45)/2,-p/2+.02,.012),M("wood_dark",.014,x-.45-.04,-u/2+.035,.45+(x-.45)/2,-p/2+.02,8),M("wood_dark",.014,x-.45-.04,u/2-.035,.45+(x-.45)/2,-p/2+.02,8);break}case"table":{let L=A.includes("coffee")?"wood_dark":A.includes("desk")?"wood_light":"oak";_(L,u,.035,p,0,x-.0175,0,.012),A.includes("coffee")?E("metal_dark",u,p,x-.035,.05,.016,.8):A.includes("desk")?(_("wood_light",.03,x-.035,p-.1,-u/2+.03,(x-.035)/2,0,.008),_("wood_light",.03,x-.035,p-.1,u/2-.03,(x-.035)/2,0,.008),_("wood_light",u-.1,.4,.02,0,x-.25,-p/2+.06,.006)):E("wood_dark",u,p,x-.035,.07,.03,.7),A.includes("desk")&&(_("metal_dark",.52,.32,.018,.15,x+.3,-p/2+.16,.006),_("metal_dark",.16,.12,.14,.15,x+.06,-p/2+.16,.008),_("metal_light",.42,.012,.14,.1,x+.006,.08,.004));break}case"cabinet":{let L=A.includes("bookcase")||A.includes("tv")?"wood_dark":"wood_light";if(A.includes("bookcase")){_(L,.025,x,p,-u/2+.0125,x/2,0,.004),_(L,.025,x,p,u/2-.0125,x/2,0,.004),_(L,u,.025,p,0,x-.0125,0,.004),_(L,u,.03,.02,0,x/2,-p/2+.01,.004);for(let S=0;S<=4;S++)_(L,u-.05,.02,p-.02,0,x/5*S+.01,.01,.004);for(let S=1;S<5;S++)for(let w=0;w<3;w++)_(w%2?"linen":"fabric_rug",(u-.1)/3.4,x/5*.62,p*.6,-(u-.1)/2+(u-.1)/3*(w+.5),x/5*S+.02+x/5*.31,.02,.006)}else{_(L,u,x-.06,p,0,(x-.06)/2+.06,0,.012),_("wood_dark",u-.08,.06,p-.06,0,.03,-.02,.006);let S=Math.max(1,Math.round(u/.5));for(let w=1;w<S;w++)_("wood_dark",.006,x-.1,.008,-u/2+u/S*w,(x-.06)/2+.06,p/2,.002);if(A.includes("wardrobe"))for(let w of[-1,1])_("metal_light",.012,.22,.012,w*.04,x*.5,p/2+.012,.005);else for(let w=0;w<S;w++)_("metal_light",Math.min(.14,u/S-.1),.012,.012,-u/2+u/S*(w+.5),x-.12,p/2+.012,.005)}break}case"screen":{let L=T?new Xn(u,x,p,2,.008):Dt(u,x,p,0,0,0),S=new Re(L,this.styledMaterial(new Rt({color:this.style.palette.screen_off,emissive:16777215,emissiveMap:SM(),emissiveIntensity:0,roughness:.2,metalness:.3}),"screen_off"));S.position.set(t,n+x/2,i),S.rotation.y=r,S.userData={kind:"device",entity:R,label:c.entityNames[R]||"\u05D8\u05DC\u05D5\u05D5\u05D9\u05D6\u05D9\u05D4",domain:"media_player"},S.castShadow=!0,o.add(S),this.devices.push(S),this.screens=this.screens||[],this.screens.push({entity:R,mesh:S});break}case"bed":{_("wood_light",u,.2,p,0,.1,0,.02),_("linen",u-.06,.2,p-.1,0,.3,.03,.06),_("fabric_grey",u-.02,.08,p*.62,0,.44,p*.17,.04),_("fabric_grey",u-.02,.05,.3,0,.47,p*.17-p*.31+.15,.025),_("linen",Math.min(.6,u/2-.12),.11,.42,u>1.2?-u/4:0,.455,-p/2+.32,.05),u>1.2&&_("linen",Math.min(.6,u/2-.12),.11,.42,u/4,.455,-p/2+.32,.05),_("wood_dark",u,x+.45,.05,0,(x+.45)/2,-p/2+.025,.02),E("wood_dark",u-.08,p-.08,.1,.02,.03,.9);break}case"kitchen":{if(A.includes("fridge"))_("metal_light",u,x,p,0,x/2,0,.03),_("metal_dark",.006,x-.5,.006,0,x*.55,p/2,.002),_("metal_dark",.02,.5,.02,u/2-.08,x*.6,p/2+.015,.008);else{_("wood_light",u,x-.14,p,0,(x-.14)/2+.1,0,.01),_("wood_dark",u-.06,.1,p-.06,0,.05,-.01,.006),_("concrete",u+.03,.04,p+.03,0,x-.02,0,.01);let L=Math.max(1,Math.round(Math.max(u,p)/.6)),S=u>=p;for(let w=1;w<L;w++)_("wood_dark",S?.006:u+.001,x-.3,S?p+.001:.006,S?-u/2+u/L*w:0,(x-.14)/2+.1,S?0:-p/2+p/L*w,.002);for(let w=0;w<L;w++)_("metal_light",S?.12:.012,.012,S?.012:.12,S?-u/2+u/L*(w+.5):(u/2+.012)*(e.rotation_deg?1:-1),x-.1,S?p/2+.012:-p/2+p/L*(w+.5),.005);A.includes("counter")&&u<p&&_("metal_light",.44,.012,.38,0,x+.006,0,.004),A.includes("island")&&_("metal_dark",.5,.008,.4,u/4,x+.004,0,.003)}break}case"plant":{M("concrete",u/2,.36,0,.18,0,18,u/2.3),M("wood_dark",u/2-.03,.02,0,.36,0,18);let L=u*.55;for(let[S,w,P,U]of[[0,x-L*.9,0,1],[L*.5,x-L*1.3,L*.2,.7],[-L*.45,x-L*1.25,-L*.3,.75],[L*.1,x-L*1.6,-L*.5,.6],[-L*.2,x-L*1.5,L*.5,.65]]){let F=new Gi(L*U,12,9),[O,H]=b(S,P);F.translate(O,n+w,H),a("grass",F)}break}case"mat":_("fabric_rug",u,.016,p,0,.008,0,.006);break;case"sanitary":{A.includes("wc")?(M("tiles_white",.19,.38,0,.19,.08,18,.16),_("tiles_white",.4,.06,.5,0,.42,.04,.03),_("tiles_white",.38,.4,.17,0,.62,-p/2+.085,.025)):A.includes("tub")?(_("tiles_white",u,x,p,0,x/2,0,.06),_("linen",u-.18,.04,p-.18,0,x-.06,0,.012),_("metal_light",.02,.2,.02,u/2-.2,x+.1,0,.008)):(_("tiles_white",u,.14,p,0,x-.07,0,.04),_("tiles_white",.22,x-.14,.2,0,(x-.14)/2,0,.03),_("metal_light",.012,.16,.012,0,x+.08,-p/2+.06,.005));break}case"appliance":{A.includes("boiler")?(M("metal_light",u/2,x,0,x/2,0,18),M("metal_dark",u/2-.03,.02,0,x,0,18)):(_("metal_light",u,x,p,0,x/2,0,.025),M("metal_dark",.2,.02,0,x*.5,p/2+.01,24),_("metal_dark",u-.1,.1,.01,0,x-.09,p/2+.005,.004));break}case"extinguisher":{let L=tm(.08,x,t,n+x/2,i,12);a("metal_dark",L);let S=new Re(new Jt(.075,.075,x*.8,12),new Rt({color:13124668,roughness:.4,metalness:.3}));S.position.set(t,n+x/2,i),o.add(S);break}case"light":{let L=A.includes("pendant")||A.includes("floor")?2700:3200,S=this.bulbMaterial(L),w,P,U=null;if(A.includes("ceiling")){let O=new Re(new Jt(u/2-.02,u/2*.88,.07,24),S);O.position.set(t,n+.035,i),w=O,P=new D(t,n-.12,i);let H=new Re(new Jt(u/2+.01,u/2+.01,.03,24),d("metal_light"));H.position.set(t,n+.085,i),o.add(H)}else if(A.includes("pendant")){let O=new Re(new Jt(.004,.004,.7,6),d("metal_dark"));O.position.set(t,n+x+.35,i),o.add(O);let H=new Re(new Jt(.05,.05,.02,16),d("metal_dark"));H.position.set(t,n+x+.69,i),o.add(H),U=new Re(new Jt(u/2,u/2*.45,x,24,1,!0),new Rt({color:3817286,emissive:new Ee(...Ec(L)),emissiveIntensity:0,roughness:.5,metalness:.4,side:Ot})),U.position.set(t,n+x/2,i),o.add(U);let k=new Re(new Gi(.045,12,10),S);k.position.set(t,n+.1,i),w=k,P=new D(t,n,i)}else if(A.includes("floor")){let O=new Re(new Jt(.012,.012,x-.3,10),d("metal_dark"));O.position.set(t,n+(x-.3)/2,i),o.add(O);let H=new Re(new Jt(.14,.15,.02,20),d("metal_dark"));H.position.set(t,n+.01,i),o.add(H);let k=new Re(new Jt(u/2,u/2*.82,.32,24,1,!0),S);k.position.set(t,n+x-.16,i),w=k,P=new D(t,n+x-.12,i)}else{let O=new Re(T?new Xn(u,x,p,2,.02):new Xt(u,x,p),S);O.position.set(t,n+x/2,i),O.rotation.y=r,w=O,P=new D(t,n+x/2,i)}w.userData={kind:"device",entity:R,label:c.entityNames[R]||R,domain:"light"},o.add(w),this.devices.push(w);let F=new $r(new sr({map:wM(),color:new Ee(...Ec(L)),transparent:!0,opacity:0,depthWrite:!1,blending:vs}));F.scale.set(1.1,1.1,1),F.position.copy(P),F.userData={noClip:!0},o.add(F),this.lamps.push({entity:R,bulb:w,pos:P,glow:F,kelvin:L,level:l.id,light:null,on:!1,kind:A,shade:U}),this.labels.push({kind:"device",entity:R,pos:P.clone(),level:l.id});break}default:_("concrete",u,x,p,0,x/2,0,.01)}}updateLevelCollision(){let e=this.plan.doc;for(let t of Object.values(this.levels)){let n=Fu(e,this.W,this.H,t.id,this.plan.entities).map(i=>({a:[i.a[0]*this.scale,i.a[1]*this.scale],b:[i.b[0]*this.scale,i.b[1]*this.scale],w:(i.w||0)*this.scale,kind:i.kind,id:i.id}));for(let i of this.doors)if(i.lock&&this.plan.entities[i.lock]==="locked"){let r=e.openings.find(o=>o.id===i.id);if(r&&!n.some(o=>o.id===r.id)){let o=$o(e,this.W,this.H,t.id).openings.find(a=>a.opening.id===r.id);o&&n.push({a:[o.g0[0]*this.scale,o.g0[1]*this.scale],b:[o.g1[0]*this.scale,o.g1[1]*this.scale],w:o.wpx*this.scale,kind:"door-locked",id:r.id})}}for(let i of t.objectsBlocking){let r=Math.cos(i.yaw),o=Math.sin(i.yaw),a=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([l,c])=>[i.x+l*i.w/2*r+c*i.d/2*o,i.z-l*i.w/2*o+c*i.d/2*r]);for(let l=0;l<4;l++)n.push({a:a[l],b:a[(l+1)%4],w:0,kind:"object",id:"obj"})}t.segs=n}}setStates(e,t,n=!1){this.plan.entities=e,this.plan.coverPositions=t||this.plan.coverPositions||{};for(let i of this.doors){let r=i.entity?Sc(e[i.entity]):!1;i.open=r,n&&(i.t=r?1:0)}for(let i of this.shutters){let r=this.plan.coverPositions[i.entity],o=e[i.entity];i.target=typeof r=="number"?r/100:o==="open"?1:0,n&&(i.current=i.target)}for(let i of this.lamps)i.on=e[i.entity]==="on";for(let i of this.markers)i.group.visible=Sc(e[i.entity]);for(let i of this.presence)i.mesh.visible=e[i.entity]==="on";for(let i of this.tints)i.mesh.visible=e[i.entity]==="on";for(let i of this.screens||[])i.mesh.material.emissiveIntensity=e[i.entity]==="playing"||e[i.entity]==="on"?.9:0;for(let i of this.lockPlates||[]){let o=e[i.entity]==="locked"?this.style.palette.open_door:this.style.palette.lock_ok;i.mesh.material.color.setHex(o),i.mesh.material.emissive.setHex(o)}this.updateLevelCollision()}update(e,t,n={}){let i=!1;if(n.coneVolumes!==void 0)for(let h of this.cameras)h.vol.visible=!!n.coneVolumes;let r=Math.min(1,e/(vM/1e3));for(let h of this.doors){let f=h.open?1:0;Math.abs(h.t-f)>.001&&(h.t+=Math.sign(f-h.t)*r,h.t=Math.max(0,Math.min(1,h.t)),i=!0);let d=h.t<.5?2*h.t*h.t:1-Math.pow(-2*h.t+2,2)/2;for(let u of h.leaves)u.kind==="swing"?u.grp.rotation.y=u.closedYaw+(u.openYaw-u.closedYaw)*d:u.grp.position.set(u.base[0]+u.slide[0]*d,u.grp.position.y,u.base[1]+u.slide[1]*d)}for(let h of this.shutters){Math.abs(h.current-h.target)>.001&&(h.current+=Math.sign(h.target-h.current)*r*.6,h.current=Math.max(0,Math.min(1,h.current)),i=!0);let f=h.height*(1-h.current);h.mesh.scale.y=Math.max(.001,f),h.mesh.visible=f>.01}let o=n.nightFactor??0,a=this.style.rig,l=this.lamps.filter(h=>h.on&&this.levels[h.level].group.visible);for(let h of this.lamps){let f=h.on?this.quality>=3?em(a.lampEmissiveDay,a.lampEmissiveNight,o):1.4:0;h.bulb.material.emissiveIntensity+=(f-h.bulb.material.emissiveIntensity)*Math.min(1,e*8),h.shade&&(h.shade.material.emissiveIntensity=h.bulb.material.emissiveIntensity*.22);let d=this.cutY!=null&&h.pos.y>this.cutY,u=h.on&&!d?.16+o*.26:0;h.glow.material.opacity+=(u-h.glow.material.opacity)*Math.min(1,e*8),Math.abs(f-h.bulb.material.emissiveIntensity)>.01&&(i=!0)}l.sort((h,f)=>h.pos.distanceToSquared(t)-f.pos.distanceToSquared(t));let c=l.slice(0,this.pool.length);for(let h=0;h<this.pool.length;h++){let f=this.pool[h],d=c[h];if(!d){f.intensity=0;continue}f.position.copy(d.pos);let u=Ec(d.kelvin+a.lampKelvinOffset);f.color.setRGB(u[0],u[1],u[2]);let p=d.kind.includes("floor")?6:d.kind.includes("wall")?5:11;f.intensity=p*em(a.lampPoolDay,a.lampPoolNight,o)}return i}showLevel(e,t=!1){let n=Object.keys(this.levels);for(let i of n){let r=this.levels[i],o=e==="all"||e===i;r.group.visible=o;let a=!!(t||e==="all"&&i!==n[n.length-1]);for(let l of r.ceilings)l.visible=a&&!(e==="all"&&!t&&i===n[n.length-1]);if(e==="all"&&!t)for(let l of r.ceilings)l.visible=!1}for(let i of this.cameras)i.vol.visible=!1,i.cone.visible=!t}pick(e){let t=e.intersectObjects(this.devices,!1);for(let n of t){let i=n.object.userData;if(i&&(i.kind==="device"||i.kind==="camera"||i.kind==="lock"))return{...i,point:n.point,distance:n.distance}}return null}};function MM(s,e,t,n,i){let r=[s],o=Math.max(24,Math.round(t/2));for(let a=0;a<=o;a++){let c=(e-t/2+t*a/o-90)*Math.PI/180,h=[Math.cos(c),Math.sin(c)],f=n;for(let d of i){let u=bM(s,h,d.a,d.b);u!==null&&u>.5&&u<f&&(f=u)}r.push([s[0]+h[0]*f,s[1]+h[1]*f])}return r}function bM(s,e,t,n){let i=n[0]-t[0],r=n[1]-t[1],o=e[0]*r-e[1]*i;if(Math.abs(o)<1e-12)return null;let a=t[0]-s[0],l=t[1]-s[1],c=(a*r-l*i)/o,h=(a*e[1]-l*e[0])/o;return c<0||h<-1e-9||h>1+1e-9?null:c}function Ec(s){let e=s/100,t,n,i;t=e<=66?255:329.698727446*Math.pow(e-60,-.1332047592),n=e<=66?99.4708025861*Math.log(e)-161.1195681661:288.1221695283*Math.pow(e-60,-.0755148492),i=e>=66?255:e<=19?0:138.5177312231*Math.log(e-10)-305.0447927307;let r=o=>Math.max(0,Math.min(255,o))/255;return[r(t),r(n),r(i)]}var ea=null;function SM(){if(ea)return ea;let s=document.createElement("canvas");s.width=256,s.height=144;let e=s.getContext("2d"),t=e.createLinearGradient(0,0,256,144);t.addColorStop(0,"#2b3f5e"),t.addColorStop(.45,"#6d8fb3"),t.addColorStop(.7,"#c9b08a"),t.addColorStop(1,"#3a2f3a"),e.fillStyle=t,e.fillRect(0,0,256,144);let n=e.createRadialGradient(150,60,10,150,60,150);return n.addColorStop(0,"rgba(255,245,225,0.55)"),n.addColorStop(1,"rgba(255,245,225,0)"),e.fillStyle=n,e.fillRect(0,0,256,144),e.fillStyle="rgba(0,0,0,0.55)",e.fillRect(0,0,256,14),e.fillRect(0,130,256,14),ea=new Vn(s),ea.colorSpace=Mt,ea}var ta=null;function wM(){if(ta)return ta;let s=document.createElement("canvas");s.width=s.height=128;let e=s.getContext("2d"),t=e.createRadialGradient(64,64,0,64,64,64);return t.addColorStop(0,"rgba(255,255,255,1)"),t.addColorStop(.25,"rgba(255,255,255,0.55)"),t.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=t,e.fillRect(0,0,128,128),ta=new Vn(s),ta.colorSpace=Mt,ta}var ci={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

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


		}`};var tn=class{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}},TM=new Sn(-1,1,1,-1,0,1),Hu=class extends _t{constructor(){super(),this.setAttribute("position",new at([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new at([0,2,0,0,2,0],2))}},EM=new Hu,In=class{constructor(e){this._mesh=new Re(EM,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,TM)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}};var Cc=class extends tn{constructor(e,t="tDiffuse"){super(),this.textureID=t,this.uniforms=null,this.material=null,e instanceof ct?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=zt.clone(e.uniforms),this.material=new ct({name:e.name!==void 0?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this._fsQuad=new In(this.material)}render(e,t,n){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=n.texture),this._fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}};var na=class extends tn{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,n){let i=e.getContext(),r=e.state;r.buffers.color.setMask(!1),r.buffers.depth.setMask(!1),r.buffers.color.setLocked(!0),r.buffers.depth.setLocked(!0);let o,a;this.inverse?(o=0,a=1):(o=1,a=0),r.buffers.stencil.setTest(!0),r.buffers.stencil.setOp(i.REPLACE,i.REPLACE,i.REPLACE),r.buffers.stencil.setFunc(i.ALWAYS,o,4294967295),r.buffers.stencil.setClear(a),r.buffers.stencil.setLocked(!0),e.setRenderTarget(n),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),r.buffers.color.setLocked(!1),r.buffers.depth.setLocked(!1),r.buffers.color.setMask(!0),r.buffers.depth.setMask(!0),r.buffers.stencil.setLocked(!1),r.buffers.stencil.setFunc(i.EQUAL,1,4294967295),r.buffers.stencil.setOp(i.KEEP,i.KEEP,i.KEEP),r.buffers.stencil.setLocked(!0)}},Rc=class extends tn{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}};var Pc=class{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){let n=e.getSize(new ee);this._width=n.width,this._height=n.height,t=new dt(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:St}),t.texture.name="EffectComposer.rt1"}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new Cc(ci),this.copyPass.material.blending=kt,this.timer=new Eo}swapBuffers(){let e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){let t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){this.timer.update(),e===void 0&&(e=this.timer.getDelta());let t=this.renderer.getRenderTarget(),n=!1;for(let i=0,r=this.passes.length;i<r;i++){let o=this.passes[i];if(o.enabled!==!1){if(o.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(i),o.render(this.renderer,this.writeBuffer,this.readBuffer,e,n),o.needsSwap){if(n){let a=this.renderer.getContext(),l=this.renderer.state.buffers.stencil;l.setFunc(a.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),l.setFunc(a.EQUAL,1,4294967295)}this.swapBuffers()}na!==void 0&&(o instanceof na?n=!0:o instanceof Rc&&(n=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){let t=this.renderer.getSize(new ee);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;let n=this._width*this._pixelRatio,i=this._height*this._pixelRatio;this.renderTarget1.setSize(n,i),this.renderTarget2.setSize(n,i);for(let r=0;r<this.passes.length;r++)this.passes[r].setSize(n,i)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}};var Lc=class extends tn{constructor(e,t,n=null,i=null,r=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=n,this.clearColor=i,this.clearAlpha=r,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new Ee}render(e,t,n){let i=e.autoClear;e.autoClear=!1;let r,o;this.overrideMaterial!==null&&(o=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(r=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:n),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(r),this.overrideMaterial!==null&&(this.scene.overrideMaterial=o),e.autoClear=i}};var ia={name:"GTAOShader",defines:{PERSPECTIVE_CAMERA:1,SAMPLES:16,NORMAL_VECTOR_TYPE:1,DEPTH_SWIZZLING:"x",SCREEN_SPACE_RADIUS:0,SCREEN_SPACE_RADIUS_SCALE:100,SCENE_CLIP_BOX:0},uniforms:{tNormal:{value:null},tDepth:{value:null},tNoise:{value:null},resolution:{value:new ee},cameraNear:{value:null},cameraFar:{value:null},cameraProjectionMatrix:{value:new je},cameraProjectionMatrixInverse:{value:new je},cameraWorldMatrix:{value:new je},radius:{value:.25},distanceExponent:{value:1},thickness:{value:1},distanceFallOff:{value:1},scale:{value:1},sceneBoxMin:{value:new D(-1,-1,-1)},sceneBoxMax:{value:new D(1,1,1)}},vertexShader:`

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
		}`},sa={name:"GTAODepthShader",defines:{PERSPECTIVE_CAMERA:1},uniforms:{tDepth:{value:null},cameraNear:{value:null},cameraFar:{value:null}},vertexShader:`
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

		}`},Ic={name:"GTAOBlendShader",uniforms:{tDiffuse:{value:null},intensity:{value:1}},vertexShader:`
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
		}`};function im(s=5){let e=Math.floor(s)%2===0?Math.floor(s)+1:Math.floor(s),t=AM(e),n=t.length,i=new Uint8Array(n*4);for(let o=0;o<n;++o){let a=t[o],l=2*Math.PI*a/n,c=new D(Math.cos(l),Math.sin(l),0).normalize();i[o*4]=(c.x*.5+.5)*255,i[o*4+1]=(c.y*.5+.5)*255,i[o*4+2]=127,i[o*4+3]=255}let r=new ei(i,e,e);return r.wrapS=Kt,r.wrapT=Kt,r.needsUpdate=!0,r}function AM(s){let e=Math.floor(s)%2===0?Math.floor(s)+1:Math.floor(s),t=e*e,n=Array(t).fill(0),i=Math.floor(e/2),r=e-1;for(let o=1;o<=t;){if(i===-1&&r===e?(r=e-2,i=0):(r===e&&(r=0),i<0&&(i=e-1)),n[i*e+r]!==0){r-=2,i++;continue}else n[i*e+r]=o++;r++,i--}return n}var ra={name:"PoissonDenoiseShader",defines:{SAMPLES:16,SAMPLE_VECTORS:Vu(16,2,1),NORMAL_VECTOR_TYPE:1,DEPTH_VALUE_SOURCE:0},uniforms:{tDiffuse:{value:null},tNormal:{value:null},tDepth:{value:null},tNoise:{value:null},resolution:{value:new ee},cameraProjectionMatrixInverse:{value:new je},lumaPhi:{value:5},depthPhi:{value:5},normalPhi:{value:5},radius:{value:4},index:{value:0}},vertexShader:`

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
		}`};function Vu(s,e,t){let n=CM(s,e,t),i="vec3[SAMPLES](";for(let r=0;r<s;r++){let o=n[r];i+=`vec3(${o.x}, ${o.y}, ${o.z})${r<s-1?",":")"}`}return i}function CM(s,e,t){let n=[];for(let i=0;i<s;i++){let r=2*Math.PI*e*i/s,o=Math.pow(i/(s-1),t);n.push(new D(Math.cos(r),Math.sin(r),o))}return n}var Dc=class{constructor(e=Math){this.grad3=[[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]],this.grad4=[[0,1,1,1],[0,1,1,-1],[0,1,-1,1],[0,1,-1,-1],[0,-1,1,1],[0,-1,1,-1],[0,-1,-1,1],[0,-1,-1,-1],[1,0,1,1],[1,0,1,-1],[1,0,-1,1],[1,0,-1,-1],[-1,0,1,1],[-1,0,1,-1],[-1,0,-1,1],[-1,0,-1,-1],[1,1,0,1],[1,1,0,-1],[1,-1,0,1],[1,-1,0,-1],[-1,1,0,1],[-1,1,0,-1],[-1,-1,0,1],[-1,-1,0,-1],[1,1,1,0],[1,1,-1,0],[1,-1,1,0],[1,-1,-1,0],[-1,1,1,0],[-1,1,-1,0],[-1,-1,1,0],[-1,-1,-1,0]],this.p=[];for(let t=0;t<256;t++)this.p[t]=Math.floor(e.random()*256);this.perm=[];for(let t=0;t<512;t++)this.perm[t]=this.p[t&255];this.simplex=[[0,1,2,3],[0,1,3,2],[0,0,0,0],[0,2,3,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,3,0],[0,2,1,3],[0,0,0,0],[0,3,1,2],[0,3,2,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,3,2,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,0,3],[0,0,0,0],[1,3,0,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,3,0,1],[2,3,1,0],[1,0,2,3],[1,0,3,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,3,1],[0,0,0,0],[2,1,3,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,1,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,0,1,2],[3,0,2,1],[0,0,0,0],[3,1,2,0],[2,1,0,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,1,0,2],[0,0,0,0],[3,2,0,1],[3,2,1,0]]}noise(e,t){let n,i,r,o=.5*(Math.sqrt(3)-1),a=(e+t)*o,l=Math.floor(e+a),c=Math.floor(t+a),h=(3-Math.sqrt(3))/6,f=(l+c)*h,d=l-f,u=c-f,p=e-d,x=t-u,m,g;p>x?(m=1,g=0):(m=0,g=1);let b=p-m+h,T=x-g+h,_=p-1+2*h,M=x-1+2*h,E=l&255,A=c&255,v=this.perm[E+this.perm[A]]%12,R=this.perm[E+m+this.perm[A+g]]%12,N=this.perm[E+1+this.perm[A+1]]%12,L=.5-p*p-x*x;L<0?n=0:(L*=L,n=L*L*this._dot(this.grad3[v],p,x));let S=.5-b*b-T*T;S<0?i=0:(S*=S,i=S*S*this._dot(this.grad3[R],b,T));let w=.5-_*_-M*M;return w<0?r=0:(w*=w,r=w*w*this._dot(this.grad3[N],_,M)),70*(n+i+r)}noise3d(e,t,n){let i,r,o,a,c=(e+t+n)*.3333333333333333,h=Math.floor(e+c),f=Math.floor(t+c),d=Math.floor(n+c),u=1/6,p=(h+f+d)*u,x=h-p,m=f-p,g=d-p,b=e-x,T=t-m,_=n-g,M,E,A,v,R,N;b>=T?T>=_?(M=1,E=0,A=0,v=1,R=1,N=0):b>=_?(M=1,E=0,A=0,v=1,R=0,N=1):(M=0,E=0,A=1,v=1,R=0,N=1):T<_?(M=0,E=0,A=1,v=0,R=1,N=1):b<_?(M=0,E=1,A=0,v=0,R=1,N=1):(M=0,E=1,A=0,v=1,R=1,N=0);let L=b-M+u,S=T-E+u,w=_-A+u,P=b-v+2*u,U=T-R+2*u,F=_-N+2*u,O=b-1+3*u,H=T-1+3*u,k=_-1+3*u,W=h&255,Z=f&255,he=d&255,pe=this.perm[W+this.perm[Z+this.perm[he]]]%12,Ae=this.perm[W+M+this.perm[Z+E+this.perm[he+A]]]%12,we=this.perm[W+v+this.perm[Z+R+this.perm[he+N]]]%12,Pe=this.perm[W+1+this.perm[Z+1+this.perm[he+1]]]%12,q=.6-b*b-T*T-_*_;q<0?i=0:(q*=q,i=q*q*this._dot3(this.grad3[pe],b,T,_));let K=.6-L*L-S*S-w*w;K<0?r=0:(K*=K,r=K*K*this._dot3(this.grad3[Ae],L,S,w));let de=.6-P*P-U*U-F*F;de<0?o=0:(de*=de,o=de*de*this._dot3(this.grad3[we],P,U,F));let De=.6-O*O-H*H-k*k;return De<0?a=0:(De*=De,a=De*De*this._dot3(this.grad3[Pe],O,H,k)),32*(i+r+o+a)}noise4d(e,t,n,i){let r=this.grad4,o=this.simplex,a=this.perm,l=(Math.sqrt(5)-1)/4,c=(5-Math.sqrt(5))/20,h,f,d,u,p,x=(e+t+n+i)*l,m=Math.floor(e+x),g=Math.floor(t+x),b=Math.floor(n+x),T=Math.floor(i+x),_=(m+g+b+T)*c,M=m-_,E=g-_,A=b-_,v=T-_,R=e-M,N=t-E,L=n-A,S=i-v,w=R>N?32:0,P=R>L?16:0,U=N>L?8:0,F=R>S?4:0,O=N>S?2:0,H=L>S?1:0,k=w+P+U+F+O+H,W=o[k][0]>=3?1:0,Z=o[k][1]>=3?1:0,he=o[k][2]>=3?1:0,pe=o[k][3]>=3?1:0,Ae=o[k][0]>=2?1:0,we=o[k][1]>=2?1:0,Pe=o[k][2]>=2?1:0,q=o[k][3]>=2?1:0,K=o[k][0]>=1?1:0,de=o[k][1]>=1?1:0,De=o[k][2]>=1?1:0,_e=o[k][3]>=1?1:0,ke=R-W+c,et=N-Z+c,te=L-he+c,ae=S-pe+c,re=R-Ae+2*c,oe=N-we+2*c,le=L-Pe+2*c,Be=S-q+2*c,Ne=R-K+3*c,Le=N-de+3*c,Ye=L-De+3*c,B=S-_e+3*c,$e=R-1+4*c,Ke=N-1+4*c,I=L-1+4*c,y=S-1+4*c,G=m&255,X=g&255,J=b&255,ue=T&255,fe=a[G+a[X+a[J+a[ue]]]]%32,$=a[G+W+a[X+Z+a[J+he+a[ue+pe]]]]%32,ne=a[G+Ae+a[X+we+a[J+Pe+a[ue+q]]]]%32,xe=a[G+K+a[X+de+a[J+De+a[ue+_e]]]]%32,He=a[G+1+a[X+1+a[J+1+a[ue+1]]]]%32,ge=.6-R*R-N*N-L*L-S*S;ge<0?h=0:(ge*=ge,h=ge*ge*this._dot4(r[fe],R,N,L,S));let me=.6-ke*ke-et*et-te*te-ae*ae;me<0?f=0:(me*=me,f=me*me*this._dot4(r[$],ke,et,te,ae));let Ue=.6-re*re-oe*oe-le*le-Be*Be;Ue<0?d=0:(Ue*=Ue,d=Ue*Ue*this._dot4(r[ne],re,oe,le,Be));let We=.6-Ne*Ne-Le*Le-Ye*Ye-B*B;We<0?u=0:(We*=We,u=We*We*this._dot4(r[xe],Ne,Le,Ye,B));let Je=.6-$e*$e-Ke*Ke-I*I-y*y;return Je<0?p=0:(Je*=Je,p=Je*Je*this._dot4(r[He],$e,Ke,I,y)),27*(h+f+d+u+p)}_dot(e,t,n){return e[0]*t+e[1]*n}_dot3(e,t,n,i){return e[0]*t+e[1]*n+e[2]*i}_dot4(e,t,n,i,r){return e[0]*t+e[1]*n+e[2]*i+e[3]*r}};var Rr=class s extends tn{constructor(e,t,n=512,i=512,r,o,a){super(),this.width=n,this.height=i,this.clear=!0,this.camera=t,this.scene=e,this.output=0,this._renderGBuffer=!0,this._visibilityCache=[],this.blendIntensity=1,this.pdRings=2,this.pdRadiusExponent=2,this.pdSamples=16,this.gtaoNoiseTexture=im(),this.pdNoiseTexture=this._generateNoise(),this.gtaoRenderTarget=new dt(this.width,this.height,{type:St,depthBuffer:!1}),this.pdRenderTarget=this.gtaoRenderTarget.clone(),this.gtaoMaterial=new ct({defines:Object.assign({},ia.defines),uniforms:zt.clone(ia.uniforms),vertexShader:ia.vertexShader,fragmentShader:ia.fragmentShader,blending:kt,depthTest:!1,depthWrite:!1}),this.gtaoMaterial.defines.PERSPECTIVE_CAMERA=this.camera.isPerspectiveCamera?1:0,this.gtaoMaterial.uniforms.tNoise.value=this.gtaoNoiseTexture,this.gtaoMaterial.uniforms.resolution.value.set(this.width,this.height),this.gtaoMaterial.uniforms.cameraNear.value=this.camera.near,this.gtaoMaterial.uniforms.cameraFar.value=this.camera.far,this.normalMaterial=new xo,this.normalMaterial.blending=kt,this.pdMaterial=new ct({defines:Object.assign({},ra.defines),uniforms:zt.clone(ra.uniforms),vertexShader:ra.vertexShader,fragmentShader:ra.fragmentShader,depthTest:!1,depthWrite:!1}),this.pdMaterial.uniforms.tDiffuse.value=this.gtaoRenderTarget.texture,this.pdMaterial.uniforms.tNoise.value=this.pdNoiseTexture,this.pdMaterial.uniforms.resolution.value.set(this.width,this.height),this.pdMaterial.uniforms.lumaPhi.value=10,this.pdMaterial.uniforms.depthPhi.value=2,this.pdMaterial.uniforms.normalPhi.value=3,this.pdMaterial.uniforms.radius.value=8,this.depthRenderMaterial=new ct({defines:Object.assign({},sa.defines),uniforms:zt.clone(sa.uniforms),vertexShader:sa.vertexShader,fragmentShader:sa.fragmentShader,blending:kt}),this.depthRenderMaterial.uniforms.cameraNear.value=this.camera.near,this.depthRenderMaterial.uniforms.cameraFar.value=this.camera.far,this.copyMaterial=new ct({uniforms:zt.clone(ci.uniforms),vertexShader:ci.vertexShader,fragmentShader:ci.fragmentShader,transparent:!0,depthTest:!1,depthWrite:!1,blendSrc:Po,blendDst:ys,blendEquation:Rn,blendSrcAlpha:Ro,blendDstAlpha:ys,blendEquationAlpha:Rn}),this.blendMaterial=new ct({uniforms:zt.clone(Ic.uniforms),vertexShader:Ic.vertexShader,fragmentShader:Ic.fragmentShader,transparent:!0,depthTest:!1,depthWrite:!1,blending:bl,blendSrc:Po,blendDst:ys,blendEquation:Rn,blendSrcAlpha:Ro,blendDstAlpha:ys,blendEquationAlpha:Rn}),this._fsQuad=new In(null),this._originalClearColor=new Ee,this.setGBuffer(r?r.depthTexture:void 0,r?r.normalTexture:void 0),o!==void 0&&this.updateGtaoMaterial(o),a!==void 0&&this.updatePdMaterial(a)}setSize(e,t){this.width=e,this.height=t,this.gtaoRenderTarget.setSize(e,t),this.normalRenderTarget.setSize(e,t),this.pdRenderTarget.setSize(e,t),this.gtaoMaterial.uniforms.resolution.value.set(e,t),this.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this.pdMaterial.uniforms.resolution.value.set(e,t),this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse)}dispose(){this.gtaoNoiseTexture.dispose(),this.pdNoiseTexture.dispose(),this.normalRenderTarget.dispose(),this.gtaoRenderTarget.dispose(),this.pdRenderTarget.dispose(),this.normalMaterial.dispose(),this.pdMaterial.dispose(),this.copyMaterial.dispose(),this.depthRenderMaterial.dispose(),this._fsQuad.dispose()}get gtaoMap(){return this.pdRenderTarget.texture}setGBuffer(e,t){e!==void 0?(this.depthTexture=e,this.normalTexture=t,this._renderGBuffer=!1):(this.depthTexture=new ti,this.depthTexture.format=ri,this.depthTexture.type=Qi,this.normalRenderTarget=new dt(this.width,this.height,{minFilter:bt,magFilter:bt,type:St,depthTexture:this.depthTexture}),this.normalTexture=this.normalRenderTarget.texture,this._renderGBuffer=!0);let n=this.normalTexture?1:0,i=this.depthTexture===this.normalTexture?"w":"x";this.gtaoMaterial.defines.NORMAL_VECTOR_TYPE=n,this.gtaoMaterial.defines.DEPTH_SWIZZLING=i,this.gtaoMaterial.uniforms.tNormal.value=this.normalTexture,this.gtaoMaterial.uniforms.tDepth.value=this.depthTexture,this.pdMaterial.defines.NORMAL_VECTOR_TYPE=n,this.pdMaterial.defines.DEPTH_SWIZZLING=i,this.pdMaterial.uniforms.tNormal.value=this.normalTexture,this.pdMaterial.uniforms.tDepth.value=this.depthTexture,this.depthRenderMaterial.uniforms.tDepth.value=this.normalRenderTarget.depthTexture}setSceneClipBox(e){e?(this.gtaoMaterial.needsUpdate=this.gtaoMaterial.defines.SCENE_CLIP_BOX!==1,this.gtaoMaterial.defines.SCENE_CLIP_BOX=1,this.gtaoMaterial.uniforms.sceneBoxMin.value.copy(e.min),this.gtaoMaterial.uniforms.sceneBoxMax.value.copy(e.max)):(this.gtaoMaterial.needsUpdate=this.gtaoMaterial.defines.SCENE_CLIP_BOX===0,this.gtaoMaterial.defines.SCENE_CLIP_BOX=0)}updateGtaoMaterial(e){e.radius!==void 0&&(this.gtaoMaterial.uniforms.radius.value=e.radius),e.distanceExponent!==void 0&&(this.gtaoMaterial.uniforms.distanceExponent.value=e.distanceExponent),e.thickness!==void 0&&(this.gtaoMaterial.uniforms.thickness.value=e.thickness),e.distanceFallOff!==void 0&&(this.gtaoMaterial.uniforms.distanceFallOff.value=e.distanceFallOff,this.gtaoMaterial.needsUpdate=!0),e.scale!==void 0&&(this.gtaoMaterial.uniforms.scale.value=e.scale),e.samples!==void 0&&e.samples!==this.gtaoMaterial.defines.SAMPLES&&(this.gtaoMaterial.defines.SAMPLES=e.samples,this.gtaoMaterial.needsUpdate=!0),e.screenSpaceRadius!==void 0&&(e.screenSpaceRadius?1:0)!==this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS&&(this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS=e.screenSpaceRadius?1:0,this.gtaoMaterial.needsUpdate=!0)}updatePdMaterial(e){let t=!1;e.lumaPhi!==void 0&&(this.pdMaterial.uniforms.lumaPhi.value=e.lumaPhi),e.depthPhi!==void 0&&(this.pdMaterial.uniforms.depthPhi.value=e.depthPhi),e.normalPhi!==void 0&&(this.pdMaterial.uniforms.normalPhi.value=e.normalPhi),e.radius!==void 0&&e.radius!==this.radius&&(this.pdMaterial.uniforms.radius.value=e.radius),e.radiusExponent!==void 0&&e.radiusExponent!==this.pdRadiusExponent&&(this.pdRadiusExponent=e.radiusExponent,t=!0),e.rings!==void 0&&e.rings!==this.pdRings&&(this.pdRings=e.rings,t=!0),e.samples!==void 0&&e.samples!==this.pdSamples&&(this.pdSamples=e.samples,t=!0),t&&(this.pdMaterial.defines.SAMPLES=this.pdSamples,this.pdMaterial.defines.SAMPLE_VECTORS=Vu(this.pdSamples,this.pdRings,this.pdRadiusExponent),this.pdMaterial.needsUpdate=!0)}render(e,t,n){switch(this._renderGBuffer&&(this._overrideVisibility(),this._renderOverride(e,this.normalMaterial,this.normalRenderTarget,7829503,1),this._restoreVisibility()),this.gtaoMaterial.uniforms.cameraNear.value=this.camera.near,this.gtaoMaterial.uniforms.cameraFar.value=this.camera.far,this.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this.gtaoMaterial.uniforms.cameraWorldMatrix.value.copy(this.camera.matrixWorld),this._renderPass(e,this.gtaoMaterial,this.gtaoRenderTarget,16777215,1),this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this._renderPass(e,this.pdMaterial,this.pdRenderTarget,16777215,1),this.output){case s.OUTPUT.Off:break;case s.OUTPUT.Diffuse:this.copyMaterial.uniforms.tDiffuse.value=n.texture,this.copyMaterial.blending=kt,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:t);break;case s.OUTPUT.AO:this.copyMaterial.uniforms.tDiffuse.value=this.gtaoRenderTarget.texture,this.copyMaterial.blending=kt,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:t);break;case s.OUTPUT.Denoise:this.copyMaterial.uniforms.tDiffuse.value=this.pdRenderTarget.texture,this.copyMaterial.blending=kt,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:t);break;case s.OUTPUT.Depth:this.depthRenderMaterial.uniforms.cameraNear.value=this.camera.near,this.depthRenderMaterial.uniforms.cameraFar.value=this.camera.far,this._renderPass(e,this.depthRenderMaterial,this.renderToScreen?null:t);break;case s.OUTPUT.Normal:this.copyMaterial.uniforms.tDiffuse.value=this.normalRenderTarget.texture,this.copyMaterial.blending=kt,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:t);break;case s.OUTPUT.Default:this.copyMaterial.uniforms.tDiffuse.value=n.texture,this.copyMaterial.blending=kt,this._renderPass(e,this.copyMaterial,this.renderToScreen?null:t),this.blendMaterial.uniforms.intensity.value=this.blendIntensity,this.blendMaterial.uniforms.tDiffuse.value=this.pdRenderTarget.texture,this._renderPass(e,this.blendMaterial,this.renderToScreen?null:t);break;default:console.warn("THREE.GTAOPass: Unknown output type.")}}_renderPass(e,t,n,i,r){e.getClearColor(this._originalClearColor);let o=e.getClearAlpha(),a=e.autoClear;e.setRenderTarget(n),e.autoClear=!1,i!=null&&(e.setClearColor(i),e.setClearAlpha(r||0),e.clear()),this._fsQuad.material=t,this._fsQuad.render(e),e.autoClear=a,e.setClearColor(this._originalClearColor),e.setClearAlpha(o)}_renderOverride(e,t,n,i,r){e.getClearColor(this._originalClearColor);let o=e.getClearAlpha(),a=e.autoClear;e.setRenderTarget(n),e.autoClear=!1,i=t.clearColor||i,r=t.clearAlpha||r,i!=null&&(e.setClearColor(i),e.setClearAlpha(r||0),e.clear()),this.scene.overrideMaterial=t,e.render(this.scene,this.camera),this.scene.overrideMaterial=null,e.autoClear=a,e.setClearColor(this._originalClearColor),e.setClearAlpha(o)}_overrideVisibility(){let e=this.scene,t=this._visibilityCache;e.traverse(function(n){(n.isPoints||n.isLine||n.isLine2)&&n.visible&&(n.visible=!1,t.push(n))})}_restoreVisibility(){let e=this._visibilityCache;for(let t=0;t<e.length;t++)e[t].visible=!0;e.length=0}_generateNoise(e=64){let t=new Dc,n=e*e*4,i=new Uint8Array(n);for(let o=0;o<e;o++)for(let a=0;a<e;a++){let l=o,c=a;i[(o*e+a)*4]=(t.noise(l,c)*.5+.5)*255,i[(o*e+a)*4+1]=(t.noise(l+e,c)*.5+.5)*255,i[(o*e+a)*4+2]=(t.noise(l,c+e)*.5+.5)*255,i[(o*e+a)*4+3]=(t.noise(l+e,c+e)*.5+.5)*255}let r=new ei(i,e,e,pn,cn);return r.wrapS=Kt,r.wrapT=Kt,r.needsUpdate=!0,r}};Rr.OUTPUT={Off:-1,Default:0,Diffuse:1,Depth:2,Normal:3,AO:4,Denoise:5};var sm={name:"LuminosityHighPassShader",uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new Ee(0)},defaultOpacity:{value:0}},vertexShader:`

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

		}`};var Pr=class s extends tn{constructor(e,t=1,n,i){super(),this.strength=t,this.radius=n,this.threshold=i,this.resolution=e!==void 0?new ee(e.x,e.y):new ee(256,256),this.clearColor=new Ee(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let r=Math.round(this.resolution.x/2),o=Math.round(this.resolution.y/2);this.renderTargetBright=new dt(r,o,{type:St,depthBuffer:!1}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let h=0;h<this.nMips;h++){let f=new dt(r,o,{type:St,depthBuffer:!1});f.texture.name="UnrealBloomPass.h"+h,f.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(f);let d=new dt(r,o,{type:St,depthBuffer:!1});d.texture.name="UnrealBloomPass.v"+h,d.texture.generateMipmaps=!1,this.renderTargetsVertical.push(d),r=Math.round(r/2),o=Math.round(o/2)}let a=sm;this.highPassUniforms=zt.clone(a.uniforms),this.highPassUniforms.luminosityThreshold.value=i,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new ct({uniforms:this.highPassUniforms,vertexShader:a.vertexShader,fragmentShader:a.fragmentShader}),this.separableBlurMaterials=[];let l=[6,10,14,18,22];r=Math.round(this.resolution.x/2),o=Math.round(this.resolution.y/2);for(let h=0;h<this.nMips;h++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(l[h])),this.separableBlurMaterials[h].uniforms.invSize.value=new ee(1/r,1/o),r=Math.round(r/2),o=Math.round(o/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1;let c=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=c,this.bloomTintColors=[new D(1,1,1),new D(1,1,1),new D(1,1,1),new D(1,1,1),new D(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=zt.clone(ci.uniforms),this.blendMaterial=new ct({uniforms:this.copyUniforms,vertexShader:ci.vertexShader,fragmentShader:ci.fragmentShader,premultipliedAlpha:!0,blending:vs,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new Ee,this._oldClearAlpha=1,this._basic=new Et,this._fsQuad=new In(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,t){let n=Math.round(e/2),i=Math.round(t/2);this.renderTargetBright.setSize(n,i);for(let r=0;r<this.nMips;r++)this.renderTargetsHorizontal[r].setSize(n,i),this.renderTargetsVertical[r].setSize(n,i),this.separableBlurMaterials[r].uniforms.invSize.value=new ee(1/n,1/i),n=Math.round(n/2),i=Math.round(i/2)}render(e,t,n,i,r){e.getClearColor(this._oldClearColor),this._oldClearAlpha=e.getClearAlpha();let o=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),r&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=n.texture,e.setRenderTarget(null),e.clear(),this._fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=n.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this._fsQuad.render(e);let a=this.renderTargetBright;for(let l=0;l<this.nMips;l++)this._fsQuad.material=this.separableBlurMaterials[l],this.separableBlurMaterials[l].uniforms.colorTexture.value=a.texture,this.separableBlurMaterials[l].uniforms.direction.value=s.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[l]),e.clear(),this._fsQuad.render(e),this.separableBlurMaterials[l].uniforms.colorTexture.value=this.renderTargetsHorizontal[l].texture,this.separableBlurMaterials[l].uniforms.direction.value=s.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[l]),e.clear(),this._fsQuad.render(e),a=this.renderTargetsVertical[l];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this._fsQuad.render(e),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,r&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(n),this._fsQuad.render(e)),e.setClearColor(this._oldClearColor,this._oldClearAlpha),e.autoClear=o}_getSeparableBlurMaterial(e){let t=[],n=e/3;for(let o=0;o<e;o++)t.push(.39894*Math.exp(-.5*o*o/(n*n))/n);let i=[],r=[];for(let o=1;o<e;o+=2){let a=t[o],l=o+1<e?t[o+1]:0,c=a+l;i.push((o*a+(o+1)*l)/c),r.push(c)}return new ct({defines:{KERNEL_PAIRS:i.length},uniforms:{colorTexture:{value:null},invSize:{value:new ee(.5,.5)},direction:{value:new ee(.5,.5)},centerWeight:{value:t[0]},gaussianOffsets:{value:i},gaussianWeights:{value:r}},vertexShader:`

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

				}`})}};Pr.BlurDirectionX=new ee(1,0);Pr.BlurDirectionY=new ee(0,1);var oa={name:"SMAAEdgesShader",defines:{SMAA_THRESHOLD:"0.1"},uniforms:{tDiffuse:{value:null},resolution:{value:new ee(1/1024,1/512)}},vertexShader:`

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

		}`},aa={name:"SMAAWeightsShader",defines:{SMAA_MAX_SEARCH_STEPS:"8",SMAA_AREATEX_MAX_DISTANCE:"16",SMAA_AREATEX_PIXEL_SIZE:"( 1.0 / vec2( 160.0, 560.0 ) )",SMAA_AREATEX_SUBTEX_SIZE:"( 1.0 / 7.0 )"},uniforms:{tDiffuse:{value:null},tArea:{value:null},tSearch:{value:null},resolution:{value:new ee(1/1024,1/512)}},vertexShader:`

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

		}`},Nc={name:"SMAABlendShader",uniforms:{tDiffuse:{value:null},tColor:{value:null},resolution:{value:new ee(1/1024,1/512)}},vertexShader:`

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

		}`};var Uc=class extends tn{constructor(){super(),this._edgesRT=new dt(1,1,{depthBuffer:!1,type:St}),this._edgesRT.texture.name="SMAAPass.edges",this._weightsRT=new dt(1,1,{depthBuffer:!1,type:St}),this._weightsRT.texture.name="SMAAPass.weights";let e=this,t=new Image;t.src=this._getAreaTexture(),t.onload=function(){e._areaTexture.needsUpdate=!0},this._areaTexture=new Ut,this._areaTexture.name="SMAAPass.area",this._areaTexture.image=t,this._areaTexture.minFilter=It,this._areaTexture.generateMipmaps=!1,this._areaTexture.flipY=!1;let n=new Image;n.src=this._getSearchTexture(),n.onload=function(){e._searchTexture.needsUpdate=!0},this._searchTexture=new Ut,this._searchTexture.name="SMAAPass.search",this._searchTexture.image=n,this._searchTexture.magFilter=bt,this._searchTexture.minFilter=bt,this._searchTexture.generateMipmaps=!1,this._searchTexture.flipY=!1,this._uniformsEdges=zt.clone(oa.uniforms),this._materialEdges=new ct({defines:Object.assign({},oa.defines),uniforms:this._uniformsEdges,vertexShader:oa.vertexShader,fragmentShader:oa.fragmentShader}),this._uniformsWeights=zt.clone(aa.uniforms),this._uniformsWeights.tDiffuse.value=this._edgesRT.texture,this._uniformsWeights.tArea.value=this._areaTexture,this._uniformsWeights.tSearch.value=this._searchTexture,this._materialWeights=new ct({defines:Object.assign({},aa.defines),uniforms:this._uniformsWeights,vertexShader:aa.vertexShader,fragmentShader:aa.fragmentShader}),this._uniformsBlend=zt.clone(Nc.uniforms),this._uniformsBlend.tDiffuse.value=this._weightsRT.texture,this._materialBlend=new ct({uniforms:this._uniformsBlend,vertexShader:Nc.vertexShader,fragmentShader:Nc.fragmentShader}),this._fsQuad=new In(null)}render(e,t,n){this._uniformsEdges.tDiffuse.value=n.texture,this._fsQuad.material=this._materialEdges,e.setRenderTarget(this._edgesRT),this.clear&&e.clear(),this._fsQuad.render(e),this._fsQuad.material=this._materialWeights,e.setRenderTarget(this._weightsRT),this.clear&&e.clear(),this._fsQuad.render(e),this._uniformsBlend.tColor.value=n.texture,this._fsQuad.material=this._materialBlend,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(),this._fsQuad.render(e))}setSize(e,t){this._edgesRT.setSize(e,t),this._weightsRT.setSize(e,t),this._materialEdges.uniforms.resolution.value.set(1/e,1/t),this._materialWeights.uniforms.resolution.value.set(1/e,1/t),this._materialBlend.uniforms.resolution.value.set(1/e,1/t)}dispose(){this._edgesRT.dispose(),this._weightsRT.dispose(),this._areaTexture.dispose(),this._searchTexture.dispose(),this._materialEdges.dispose(),this._materialWeights.dispose(),this._materialBlend.dispose(),this._fsQuad.dispose()}_getAreaTexture(){return"data:image/png;base64,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"}_getSearchTexture(){return"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEIAAAAhCAAAAABIXyLAAAAAOElEQVRIx2NgGAWjYBSMglEwEICREYRgFBZBqDCSLA2MGPUIVQETE9iNUAqLR5gIeoQKRgwXjwAAGn4AtaFeYLEAAAAASUVORK5CYII="}};var la={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
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

		}`};var Oc=class extends tn{constructor(){super(),this.isOutputPass=!0,this.uniforms=zt.clone(la.uniforms),this.material=new hr({name:la.name,uniforms:this.uniforms,vertexShader:la.vertexShader,fragmentShader:la.fragmentShader}),this._fsQuad=new In(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,n){this.uniforms.tDiffuse.value=n.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},tt.getTransfer(this._outputColorSpace)===ht&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===Lo?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===Io?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===Do?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===No?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===Oo?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===Ki?this.material.defines.NEUTRAL_TONE_MAPPING="":this._toneMapping===Uo&&(this.material.defines.CUSTOM_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}};var Ts=Math.PI/180;function rm(s,e,t,n=0){let i=23.44*Math.sin(Ts*.9863013698630136*(e-81)),r=15*(s-12),o=t*Ts,a=i*Ts,l=r*Ts,c=Math.sin(o)*Math.sin(a)+Math.cos(o)*Math.cos(a)*Math.cos(l),h=Math.asin(Math.max(-1,Math.min(1,c))),f=(Math.sin(a)-Math.sin(h)*Math.sin(o))/(Math.cos(h)*Math.cos(o)||1e-9),d=Math.acos(Math.max(-1,Math.min(1,f)));r>0&&(d=2*Math.PI-d);let u=d-n*Ts,p=[Math.sin(u)*Math.cos(h),Math.sin(h),-Math.cos(u)*Math.cos(h)];return{elevation:h/Ts,azimuth:d/Ts,dir:p}}var ui=(s,e,t)=>s+(e-s)*t,hi=(s,e,t)=>[ui(s[0],e[0],t),ui(s[1],e[1],t),ui(s[2],e[2],t)],Pi=s=>Math.max(0,Math.min(1,s));function Gu(s,e="clear"){let t=s,n=Pi((t+6)/18),i=Pi(1-Math.abs(t-8)/14),r=Pi((-t-4)/8),o=e==="overcast"?1:e==="hazy"?.45:0,a=hi(hi([1,.96,.9],[1,.72,.42],i),[.85,.87,.92],o),l=n*ui(3.4,.9,o)*(1-r),c=hi(hi([.05,.08,.16],[.36,.56,.92],n),[.62,.66,.72],o),h=hi(hi([.1,.12,.2],hi([.68,.79,.93],[.98,.72,.5],i),n),[.78,.8,.84],o),f=hi(hi([.16,.2,.34],[.78,.86,1],n),[.78,.8,.84],o),d=hi([.05,.06,.08],[.45,.42,.38],n),u=ui(.35,ui(1.6,2.2,o),n),p=ui(.95,1.05,n),x=r*.35;return{day:n,night:r,golden:i,overcast:o,sunColor:a,sunIntensity:l,skyTop:c,skyHorizon:h,hemiSky:f,hemiGround:d,hemiIntensity:u,exposure:p,moon:x,turbidity:ui(3,12,o),rayleigh:ui(2.2,.8,o),mie:ui(.005,.02,o)}}var Fc=s=>Math.round(Pi(s[0])*255)<<16|Math.round(Pi(s[1])*255)<<8|Math.round(Pi(s[2])*255),Wu=s=>`rgb(${Math.round(Pi(s[0])*255)}, ${Math.round(Pi(s[1])*255)}, ${Math.round(Pi(s[2])*255)})`;function om(s){let e=Math.floor(s),t=Math.round((s-e)*60)%60;return`${String(e).padStart(2,"0")}:${String(t).padStart(2,"0")}`}var RM=["\u05D9\u05E0\u05D5\u05D0\u05E8","\u05E4\u05D1\u05E8\u05D5\u05D0\u05E8","\u05DE\u05E8\u05E5","\u05D0\u05E4\u05E8\u05D9\u05DC","\u05DE\u05D0\u05D9","\u05D9\u05D5\u05E0\u05D9","\u05D9\u05D5\u05DC\u05D9","\u05D0\u05D5\u05D2\u05D5\u05E1\u05D8","\u05E1\u05E4\u05D8\u05DE\u05D1\u05E8","\u05D0\u05D5\u05E7\u05D8\u05D5\u05D1\u05E8","\u05E0\u05D5\u05D1\u05DE\u05D1\u05E8","\u05D3\u05E6\u05DE\u05D1\u05E8"];function am(s){let e=new Date(Date.UTC(2026,0,1)+(s-1)*864e5);return`${e.getUTCDate()} \u05D1${RM[e.getUTCMonth()]}`}var Es=(s,e,t)=>s+(e-s)*t,Bc=class{constructor(e,t={}){this.renderer=new mc({canvas:e,antialias:!0,powerPreference:"high-performance",preserveDrawingBuffer:!0,alpha:!0,premultipliedAlpha:!0}),this.renderer.setClearColor(0,0),this.renderer.shadowMap.enabled=!0,this.renderer.shadowMap.type=Zi,this.renderer.shadowMap.autoUpdate=!1,this.renderer.shadowMap.needsUpdate=!0,this.renderer.toneMapping=Ki,this.renderer.outputColorSpace=Mt,this.renderer.localClippingEnabled=!0,this.dpr=Math.min(t.maxDpr??2,window.devicePixelRatio||1),this.renderer.setPixelRatio(this.dpr),this.scene=new ir,this.style=vn.light;let n=new Gi(400,48,24),i=new Float32Array(n.attributes.position.count*3);n.setAttribute("color",new Pt(i,3)),this.dome=new Re(n,new Et({vertexColors:!0,side:en,toneMapped:!1,fog:!1,depthWrite:!1})),this.dome.frustumCulled=!1,this.dome.renderOrder=-10,this.dome.userData={kind:"sky"},this.scene.add(this.dome),this.domeScene=new ir,this.domeScene.add(new Re(n,this.dome.material)),this.sun=new qi(16777215,3),this.sun.castShadow=!0,this.sun.shadow.mapSize.set(2048,2048),this.sun.shadow.bias=-4e-4,this.sun.shadow.normalBias=.025,this.sun.shadow.radius=5,this.scene.add(this.sun),this.scene.add(this.sun.target),this.hemi=new Mo(16777215,4478310,1.5),this.scene.add(this.hemi),this.ambient=new wo(16777215,0),this.scene.add(this.ambient),this.moon=new qi(12570879,0),this.scene.add(this.moon),this.pmrem=new Sr(this.renderer),this.pmrem.compileCubemapShader(),this.envTarget=null,this.quality=3,this.composer=null,this.time={hour:15.5,day:278,latitude:32.08,north:0,weather:"clear"},this.recipe=Gu(40,"clear"),this.fitted=null,this.post={ao:!0,bloom:!0,lite:!1,msaa:!0},this.size={w:1,h:1},this.interior=!1,this.interiorFill=1,this.isWebGL2=this.renderer.capabilities.isWebGL2}rendererName(){let e=this.renderer.getContext(),t=e.getExtension("WEBGL_debug_renderer_info");return t?e.getParameter(t.UNMASKED_RENDERER_WEBGL):e.getParameter(e.RENDERER)}setStyle(e){this.style=e,this.applyTime()}setSize(e,t){this.size={w:e,h:t},this.renderer.setSize(e,t,!1),this.composer&&(this.composer.setSize(e,t),this.gtao&&this.gtao.setSize(e,t))}fitShadows(e,t){this.fitted={extent:e,top:t};let n=this.sun.shadow.camera,i=e.maxX-e.minX,r=e.maxZ-e.minZ,o=Math.hypot(i,r)/2+4;n.left=-o,n.right=o,n.top=o,n.bottom=-o,n.near=.5,n.far=o*4+20,n.updateProjectionMatrix(),this.centre=new D((e.minX+e.maxX)/2,t/2,(e.minZ+e.maxZ)/2),this.sun.target.position.copy(this.centre),this.moon.target=this.sun.target,this.applyTime()}setQuality(e,t){this.quality=e,this.renderer.shadowMap.enabled=e>=2,this.renderer.shadowMap.type=Zi,this.renderer.shadowMap.needsUpdate=!0,this.sun.castShadow=e>=2,this.sun.shadow.radius=e>=3?5:1,this.sun.shadow.blurSamples=12,this.sun.shadow.mapSize.set(e>=3?2048:1024,e>=3?2048:1024),this.sun.shadow.map&&(this.sun.shadow.map.dispose(),this.sun.shadow.map=null),this.scene.environment=e>=3?this.envTarget&&this.envTarget.texture:null,this.scene.background=null,this.renderer.toneMapping=e>=2?Ki:wn,this.buildComposer(t),this.applyTime()}buildComposer(e){if(this.composer&&(this.composer.dispose&&this.composer.dispose(),this.composer=null,this.gtao=null,this.bloom=null,this.smaa=null),this.quality<3)return;let{w:t,h:n}=this.size,i=this.post.samples!=null?this.post.samples:this.post.lite?2:4,r=this.post.msaa&&this.isWebGL2&&i>0&&this.post.aa!=="smaa",o=new dt(Math.round(t*this.dpr),Math.round(n*this.dpr),{type:St,samples:r?i:0}),a=new Pc(this.renderer,o);a.setPixelRatio(this.dpr),a.setSize(t,n);let l=new Lc(this.scene,e);if(l.clearAlpha=0,a.addPass(l),this.post.ao&&!this.post.lite){let c=new Rr(this.scene,e,t,n);c.output=Rr.OUTPUT.Default,c.updateGtaoMaterial({radius:this.style.post.aoRadius,distanceExponent:1,thickness:1,distanceFallOff:1,scale:.9,samples:8}),c.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:4,rings:2,samples:6}),c.blendIntensity=this.style.post.aoIntensity,a.addPass(c),this.gtao=c}if(this.post.bloom){let c=new Pr(new ee(t,n),.2,this.style.post.bloomRadius,2);a.addPass(c),this.bloom=c}if(a.addPass(new Oc),!r&&this.post.aa!=="none"){let c=new Uc;a.addPass(c),this.smaa=c}this.composer=a,this.camera=e,this.applyPost()}setCamera(e){if(this.camera=e,this.composer){for(let t of this.composer.passes)"camera"in t&&(t.camera=e);this.gtao&&(this.gtao.camera=e)}}setTime(e){Object.assign(this.time,e),this.applyTime()}backdropColors(){let e=this.recipe,t=this.style.rig,n=this.style.backdrop,i=l=>[parseInt(l.slice(1,3),16)/255,parseInt(l.slice(3,5),16)/255,parseInt(l.slice(5,7),16)/255],r=(l,c)=>Wu([(l[0]+c[0])/2,(l[1]+c[1])/2,(l[2]+c[2])/2]),o=i(e.night>.5?n.topNight:n.topDay),a=i(e.night>.5?n.horizonNight:n.horizonDay);return[r(o,e.skyTop.map(l=>l*t.skyScale)),r(a,e.skyHorizon.map(l=>l*t.skyScale)),Wu(e.hemiGround.map(l=>l*n.groundTint*.9+.08))]}applyFill(){let e=this.style.rig,t=this.recipe,n=this.quality>=3,i=this.interior?Es(e.interiorFill[0],e.interiorFill[1],this.interiorFill)*.7:1;this.hemi.intensity=(this.quality>=2?t.hemiIntensity*(n?e.hemiScale:1)*(n?1:e.skyScale):1.2)*i,n&&(this.scene.environmentIntensity=Es(e.envNight,e.envDay,t.day)*i)}applyPost(){let e=this.recipe,t=this.style.post;this.bloom&&(this.bloom.threshold=Es(t.bloomThresholdDay,t.bloomThresholdNight,e.night),this.bloom.strength=Es(t.bloomStrengthDay,t.bloomStrengthNight,e.night),this.bloom.radius=t.bloomRadius)}applyTime(){let e=this.time,t=this.style.rig,n=rm(e.hour,e.day,e.latitude,e.north),i=Gu(n.elevation,e.weather);this.recipe=i,this.sunInfo=n;let r=new D(n.dir[0],Math.max(n.dir[1],-.2),n.dir[2]).normalize(),o=this.centre||new D,a=this.fitted?Math.hypot(this.fitted.extent.maxX-this.fitted.extent.minX,this.fitted.extent.maxZ-this.fitted.extent.minZ):20;this.sun.position.copy(o).addScaledVector(r,a*1.5);let l=this.quality>=3,c=this.interior?Es(t.interiorFill[0],t.interiorFill[1],this.interiorFill)*.7:1;if(this.sun.intensity=this.quality>=2?i.sunIntensity*(l?.55:1)*t.sunScale:1.1,this.sun.color.setHex(Fc(i.sunColor)),this.sun.visible=n.elevation>-3||this.quality<2,this.moon.intensity=i.moon*t.moonScale,this.moon.position.copy(o).add(new D(-a,a*.9,a*.4)),this.hemi.color.setHex(Fc(i.hemiSky)),this.hemi.groundColor.setHex(Fc(i.hemiGround)),this.hemi.intensity=(this.quality>=2?i.hemiIntensity*(l?t.hemiScale:1)*(l?1:t.skyScale):1.2)*c,this.ambient.intensity=this.quality>=2?0:.9,this.renderer.toneMappingExposure=i.exposure*Es(t.exposureDay,t.exposureNight,i.night)*(l?1:1.1)*(this.interior?1.05:1),this.renderer.shadowMap.needsUpdate=!0,this.applyPost(),this.backdrop){let[h,f,d]=this.backdropColors();this.backdrop.style.background=`linear-gradient(180deg, ${h} 0%, ${f} 62%, ${d} 100%)`}this.paintDome(i,r),this.quality>=3&&(this.envTarget&&this.envTarget.dispose(),this.envTarget=this.pmrem.fromScene(this.domeScene,0,1,1e3),this.scene.environment=this.envTarget.texture,this.scene.environmentIntensity=Es(t.envNight,t.envDay,i.day)*c),this.onTime&&this.onTime(n,i)}paintDome(e,t){let n=this.dome.geometry,i=n.attributes.position,r=n.attributes.color,o=new D,a=this.style.rig.skyScale,l=e.hemiGround.map(c=>(c*.9+.1)*this.style.backdrop.groundTint);for(let c=0;c<i.count;c++){o.fromBufferAttribute(i,c).normalize();let h=o.y,f;if(h<0)f=l;else{let p=Math.pow(h,.55);f=[(e.skyHorizon[0]+(e.skyTop[0]-e.skyHorizon[0])*p)*a,(e.skyHorizon[1]+(e.skyTop[1]-e.skyHorizon[1])*p)*a,(e.skyHorizon[2]+(e.skyTop[2]-e.skyHorizon[2])*p)*a]}let d=Math.max(0,o.dot(t)),u=t.y>-.05?Math.pow(d,400)*.9+Math.pow(d,12)*.18*e.day:0;r.setXYZ(c,Math.min(1,f[0]+u*e.sunColor[0]),Math.min(1,f[1]+u*e.sunColor[1]),Math.min(1,f[2]+u*e.sunColor[2]))}r.needsUpdate=!0,this.dome.visible=this.quality>=2}render(e){this.composer&&this.quality>=3?(this.camera!==e&&this.setCamera(e),this.composer.render()):this.renderer.render(this.scene,e)}};var kc=class{constructor(e){this.scene=e,this.x=0,this.z=0,this.yaw=0,this.pitch=0,this.level=Object.keys(e.levels)[0],this.eye=1.65,this.onStairs=null,this.path=null,this.input={fwd:0,strafe:0,run:!1,turn:0},this.onLevelChange=null,this.edge=!1,this.lastMoveTime=0}placeAt(e,t,n,i){this.x=e,this.z=t,this.yaw=n*Math.PI/180,this.pitch=0,i&&i!==this.level&&(this.level=i,this.onLevelChange&&this.onLevelChange(i)),this.path=null,this.onStairs=null}ground(e,t,n){let i=this.scene.levels[n];for(let r of i.stairs){let o=e-r.a[0],a=t-r.a[1],l=o*r.dx+a*r.dz;if(Math.abs(-o*r.dz+a*r.dx)<=r.width/2&&l>=-.05&&l<=r.run+.05){let h=Math.max(0,Math.min(1,l/r.run));return{y:r.elevFrom+(r.elevTo-r.elevFrom)*h,stair:r,along:l,f:h}}}return{y:i.elevation,stair:null}}segmentsFor(e,t="all"){let n=this.scene.levels[e],i=t==="stairs"?[]:n.segs.slice();for(let r of n.stairs){let o=-r.dz,a=r.dx;for(let l of[-1,1]){let c=o*l*(r.width/2),h=a*l*(r.width/2);i.push({a:[r.a[0]+c-r.dx*0,r.a[1]+h],b:[r.b[0]+c,r.b[1]+h],w:0,kind:"stair-side",id:"stair"})}}return i}collide(e,t,n,i="all"){let r=this.segmentsFor(n,i);for(let o=0;o<3;o++){let a=!1;for(let l of r){let c=.28+(l.w||0)/2,h=l.b[0]-l.a[0],f=l.b[1]-l.a[1],d=h*h+f*f,u=d>0?Math.max(0,Math.min(1,((e-l.a[0])*h+(t-l.a[1])*f)/d)):0,p=l.a[0]+u*h,x=l.a[1]+u*f,m=e-p,g=t-x,b=Math.hypot(m,g);if(b<c){if(b<1e-6){m=-f,g=h;let T=Math.hypot(m,g)||1;m/=T,g/=T}else m/=b,g/=b;e=p+m*(c+.001),t=x+g*(c+.001),a=!0}}if(!a)break}return[e,t]}step(e){let t=this.input,n=!1;t.turn&&(this.yaw+=t.turn*e*2.2,n=!0);let i=t.fwd,r=t.strafe;if(this.path&&this.path.length){let[o,a]=this.path[0],l=o-this.x,c=a-this.z;if(Math.hypot(l,c)<.15)this.path.shift(),this.path.length||(this.path=null);else{let d=Math.atan2(-l,-c)-this.yaw;for(;d>Math.PI;)d-=2*Math.PI;for(;d<-Math.PI;)d+=2*Math.PI;this.yaw+=Math.sign(d)*Math.min(Math.abs(d),e*3.5),i=Math.abs(d)<.6?1:.2,r=0}}if(i||r){let o=t.run?2.8:1.4,a=Math.sin(this.yaw),l=Math.cos(this.yaw),c=-a,h=-l,f=l,d=-a,u=this.x+(c*i+f*r)*o*e,p=this.z+(h*i+d*r)*o*e,x=this.ground(this.x,this.z,this.level).stair&&this.ground(u,p,this.level).stair;[u,p]=this.collide(u,p,this.level,x?"stairs":"all");let m=this.scene.levels[this.level];if(m.extent){let _=m.extent,M=Math.max(_.minX+.3,Math.min(_.maxX-.3,u)),E=Math.max(_.minZ+.3,Math.min(_.maxZ-.3,p));this.edge=M!==u||E!==p,u=M,p=E}(Math.abs(u-this.x)>1e-5||Math.abs(p-this.z)>1e-5)&&(n=!0);let g=this.ground(this.x,this.z,this.level);this.x=u,this.z=p;let b=this.ground(this.x,this.z,this.level),T=b.stair||g.stair;if(T){let _=T,M=(this.x-_.a[0])*_.dx+(this.z-_.a[1])*_.dz;this.onStairs=b.stair,M>_.run-.02&&this.level===_.from?this.switchLevel(_.to):M<.02&&this.level===_.to&&this.switchLevel(_.from)}else this.onStairs=null}return n}switchLevel(e){!this.scene.levels[e]||e===this.level||(this.level=e,this.onLevelChange&&this.onLevelChange(e))}eyeY(){return this.ground(this.x,this.z,this.level).y+this.eye}applyTo(e){e.position.set(this.x,this.eyeY(),this.z),e.rotation.order="YXZ",e.rotation.set(this.pitch,this.yaw,0)}look(e,t){this.yaw-=e,this.pitch=Math.max(-1.2,Math.min(1.2,this.pitch-t))}pathTo(e,t){let n=this.scene.levels[this.level];if(!n.extent)return null;let i=n.extent,r=Math.ceil((i.maxX-i.minX)/.25),o=Math.ceil((i.maxZ-i.minZ)/.25),a=this.segmentsFor(this.level),l=new Uint8Array(r*o),c=.28*.85;for(let S=0;S<o;S++)for(let w=0;w<r;w++){let P=i.minX+(w+.5)*.25,U=i.minZ+(S+.5)*.25;for(let F of a){let O=c+(F.w||0)/2,H=F.b[0]-F.a[0],k=F.b[1]-F.a[1],W=H*H+k*k,Z=W>0?Math.max(0,Math.min(1,((P-F.a[0])*H+(U-F.a[1])*k)/W)):0;if(Math.hypot(P-(F.a[0]+Z*H),U-(F.a[1]+Z*k))<O){l[S*r+w]=1;break}}}let h=(S,w)=>[Math.max(0,Math.min(r-1,Math.floor((S-i.minX)/.25))),Math.max(0,Math.min(o-1,Math.floor((w-i.minZ)/.25)))],[f,d]=h(this.x,this.z),[u,p]=h(e,t);if(l[p*r+u]){let S=null;for(let w=-3;w<=3;w++)for(let P=-3;P<=3;P++){let U=u+P,F=p+w;if(U<0||F<0||U>=r||F>=o||l[F*r+U])continue;let O=P*P+w*w;(!S||O<S.d)&&(S={i:U,j:F,d:O})}if(!S)return null;u=S.i,p=S.j}let x=new Map,m=new Float32Array(r*o).fill(1/0),g=new Int32Array(r*o).fill(-1),b=(S,w)=>Math.hypot(S-u,w-p),T=d*r+f,_=p*r+u;m[T]=0,x.set(T,b(f,d));let M=new Uint8Array(r*o),E=0;for(;x.size&&E++<5e4;){let S=-1,w=1/0;for(let[F,O]of x)O<w&&(w=O,S=F);if(x.delete(S),S===_)break;M[S]=1;let P=S%r,U=Math.floor(S/r);for(let[F,O]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){let H=P+F,k=U+O;if(H<0||k<0||H>=r||k>=o)continue;let W=k*r+H;if(l[W]||M[W]||F&&O&&(l[U*r+H]||l[k*r+P]))continue;let Z=m[S]+Math.hypot(F,O);Z<m[W]&&(m[W]=Z,g[W]=S,x.set(W,Z+b(H,k)))}}if(g[_]<0&&_!==T)return null;let A=[],v=_;for(;v>=0&&v!==T;)A.push([i.minX+(v%r+.5)*.25,i.minZ+(Math.floor(v/r)+.5)*.25]),v=g[v];A.reverse(),A.push([e,t]);let R=[],N=[this.x,this.z],L=0;for(;L<A.length;){let S=L;for(let w=A.length-1;w>L;w--)if(this.lineFree(N,A[w],a)){S=w;break}R.push(A[S]),N=A[S],L=S+1}return this.path=R,R}lineFree(e,t,n){let i=[t[0]-e[0],t[1]-e[1]],r=Math.hypot(i[0],i[1]);if(r<1e-6)return!0;let o=Math.max(2,Math.ceil(r/.1));for(let a=0;a<=o;a++){let l=e[0]+i[0]*a/o,c=e[1]+i[1]*a/o;for(let h of n){let f=.22400000000000003+(h.w||0)/2,d=h.b[0]-h.a[0],u=h.b[1]-h.a[1],p=d*d+u*u,x=p>0?Math.max(0,Math.min(1,((l-h.a[0])*d+(c-h.a[1])*u)/p)):0;if(Math.hypot(l-(h.a[0]+x*d),c-(h.a[1]+x*u))<f)return!1}}return!0}};function lm(s,e,t,n={}){let i=s.getContext("2d"),r=e.levels[t.level],o=s.width;if(i.clearRect(0,0,o,o),!r||!r.extent)return;let a=r.extent,l=a.maxX-a.minX,c=a.maxZ-a.minZ,h=(o-12)/Math.max(l,c),f=m=>6+(m-a.minX)*h+(o-12-l*h)/2,d=m=>6+(m-a.minZ)*h+(o-12-c*h)/2;i.fillStyle=n.bg||"rgba(255,255,255,0.92)",i.beginPath(),i.roundRect(0,0,o,o,10),i.fill();for(let m of r.zones){i.beginPath(),m.polyM.forEach(([b,T],_)=>_?i.lineTo(f(b),d(T)):i.moveTo(f(b),d(T))),i.closePath();let g=m.x_proto&&m.x_proto.light&&e.plan.entities[m.x_proto.light]==="on";i.fillStyle=g?"rgba(255,200,87,0.35)":"rgba(39,103,237,0.06)",i.fill()}i.lineWidth=2;for(let m of r.segs)i.strokeStyle=m.kind==="window"?"#7fb2ff":m.kind==="door"||m.kind==="door-locked"?"#ef4444":m.kind==="object"?"rgba(90,100,120,0.35)":m.kind==="railing"||m.kind==="low"?"#9aa3b5":"#56617a",i.lineWidth=m.kind==="object"?1:m.kind==="exterior"?3:2,i.beginPath(),i.moveTo(f(m.a[0]),d(m.a[1])),i.lineTo(f(m.b[0]),d(m.b[1])),i.stroke();for(let m of r.stairs){i.strokeStyle="#6b7f99",i.lineWidth=1;let g=8;for(let b=0;b<=g;b++){let T=b/g,_=m.a[0]+m.dx*m.run*T,M=m.a[1]+m.dz*m.run*T;i.beginPath(),i.moveTo(f(_-m.dz*m.width/2),d(M+m.dx*m.width/2)),i.lineTo(f(_+m.dz*m.width/2),d(M-m.dx*m.width/2)),i.stroke()}}if(t.path){i.strokeStyle="#22c55e",i.lineWidth=2,i.setLineDash([3,3]),i.beginPath(),i.moveTo(f(t.x),d(t.z));for(let[m,g]of t.path)i.lineTo(f(m),d(g));i.stroke(),i.setLineDash([])}let u=f(t.x),p=d(t.z),x=Math.atan2(-Math.sin(t.yaw),-Math.cos(t.yaw));return i.fillStyle="rgba(39,103,237,0.25)",i.beginPath(),i.moveTo(u,p),i.arc(u,p,22,x-.5,x+.5),i.closePath(),i.fill(),i.fillStyle="#2767ed",i.beginPath(),i.arc(u,p,4,0,Math.PI*2),i.fill(),i.strokeStyle="#fff",i.lineWidth=1.5,i.stroke(),{X:f,Z:d,k:h,ex:a,invert:(m,g)=>[a.minX+(m-6-(o-12-l*h)/2)/h,a.minZ+(g-6-(o-12-c*h)/2)/h]}}var zc=class{constructor(e,t){this.env=e,this.scene=t,this.sets={}}snapshot(e,t,n){let i=this.env,r=i.size;i.setSize(t,n),e.isPerspectiveCamera&&(e.aspect=t/n),e.updateProjectionMatrix(),i.render(e);let o=this.compose(i.renderer.domElement,t,n);return i.setSize(r.w,r.h),o}compose(e,t,n){let i=document.createElement("canvas");i.width=t,i.height=n;let r=i.getContext("2d"),o=r.createLinearGradient(0,0,0,n),[a,l,c]=this.env.backdropColors();return o.addColorStop(0,a),o.addColorStop(.62,l),o.addColorStop(1,c),r.fillStyle=o,r.fillRect(0,0,t,n),r.drawImage(e,0,0,t,n),i.toDataURL("image/jpeg",.9)}thumbnail(e,t,n){let i=this.env,r=i.renderer;(!this._rt||this._rt.width!==t||this._rt.height!==n)&&(this._rt&&this._rt.dispose(),this._rt=new dt(t,n,{samples:0}));let o=r.getRenderTarget();r.setRenderTarget(this._rt),r.render(i.scene,e);let a=new Uint8Array(t*n*4);r.readRenderTargetPixels(this._rt,0,0,t,n,a),r.setRenderTarget(o);let l=document.createElement("canvas");l.width=t,l.height=n;let c=l.getContext("2d"),h=c.createImageData(t,n);for(let f=0;f<n;f++)h.data.set(a.subarray((n-1-f)*t*4,(n-f)*t*4),f*t*4);return c.putImageData(h,0,0),this.compose(l,t,n)}project(e,t,n,i){let r=t.clone().project(e);return[(r.x+1)/2*n,(1-r.y)/2*i]}async bake(e,t,n,i,r,o){let a=this.scene.levels[e],l={w:n,h:i,pics:{},masks:[],doors:[],cams:[]};for(let c of["day_off","day_on","night_off","night_on"])r(c),await new Promise(h=>requestAnimationFrame(h)),l.pics[c]=this.snapshot(t,n,i);t.aspect=n/i,t.updateProjectionMatrix(),t.updateMatrixWorld();for(let c of a.zones){let h=c.polyM.map(([d,u])=>this.project(t,new D(d,a.elevation+.02,u),n,i)),f=c.polyM.map(([d,u])=>this.project(t,new D(d,a.elevation+a.ceiling*.55,u),n,i));l.masks.push({zone:c.id,name:c.name,light:c.x_proto&&c.x_proto.light,presence:c.x_proto&&c.x_proto.presence,temp:c.x_proto&&c.x_proto.temp,floor:h,top:f,centre:this.project(t,new D(...PM(c.polyM,a.elevation+1.2)),n,i)})}for(let c of o||[]){let h=c.points.map(f=>this.project(t,f,n,i));l.doors.push({entity:c.entity,points:h})}for(let c of this.scene.cameras.filter(h=>h.level===e))l.cams.push({id:c.id,label:c.label,p:this.project(t,new D(c.pos[0],a.elevation+c.mount,c.pos[1]),n,i)});return this.sets[e]=l,l}};function PM(s,e){let t=0,n=0,i=0;for(let r=0;r<s.length;r++){let[o,a]=s[r],[l,c]=s[(r+1)%s.length],h=o*c-l*a;t+=h,n+=(o+l)*h,i+=(a+c)*h}return Math.abs(t)<1e-9?[s[0][0],e,s[0][1]]:[n/(3*t),e,i/(3*t)]}var es="http://www.w3.org/2000/svg";function hm(s,e,t){if(s.innerHTML="",!e){s.innerHTML='<div class="stills-empty">\u05D0\u05D9\u05DF \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DE\u05D5\u05DB\u05E0\u05D5\u05EA \u05DC\u05E7\u05D5\u05DE\u05D4 \u05D6\u05D5 \u2014 \u05DC\u05D7\u05E5 "\u05D4\u05DB\u05DF \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA" \u05D1\u05DC\u05E9\u05D5\u05E0\u05D9\u05EA \u05D4\u05D0\u05D9\u05DB\u05D5\u05EA</div>';return}let n=t.night,i=e.pics[n?"night_off":"day_off"],r=e.pics[n?"night_on":"day_on"],o=document.createElementNS(es,"svg");o.setAttribute("viewBox",`0 0 ${e.w} ${e.h}`),o.setAttribute("preserveAspectRatio","xMidYMid meet"),o.classList.add("stills-svg");let a=document.createElementNS(es,"defs");o.appendChild(a);let l=d=>{let u=document.createElementNS(es,"image");return u.setAttribute("href",d),u.setAttribute("width",e.w),u.setAttribute("height",e.h),u.setAttribute("preserveAspectRatio","none"),u};o.appendChild(l(i));let c=d=>d.map(u=>`${u[0].toFixed(1)},${u[1].toFixed(1)}`).join(" "),h=d=>cm([...d.floor,...d.top]);for(let d of e.masks){if(!(d.light&&t.entities[d.light]==="on"))continue;let p=document.createElementNS(es,"clipPath");p.setAttribute("id",`mask-${d.zone}`);let x=document.createElementNS(es,"polygon");x.setAttribute("points",c(h(d))),p.appendChild(x),a.appendChild(p);let m=l(r);m.setAttribute("clip-path",`url(#mask-${d.zone})`),m.classList.add("stills-lit"),o.appendChild(m)}for(let d of e.masks)if(d.presence&&t.entities[d.presence]==="on"){let p=document.createElementNS(es,"polygon");p.setAttribute("points",c(d.floor)),p.setAttribute("class","stills-presence"),o.appendChild(p)}for(let d of e.doors){if(t.entities[d.entity]!=="on"&&t.entities[d.entity]!=="open")continue;let u=document.createElementNS(es,"polygon");u.setAttribute("points",c(cm(d.points))),u.setAttribute("class","stills-door"),o.appendChild(u)}for(let d of e.cams){let u=document.createElementNS(es,"circle");u.setAttribute("cx",d.p[0]),u.setAttribute("cy",d.p[1]),u.setAttribute("r",6),u.setAttribute("class","stills-cam"),o.appendChild(u)}s.appendChild(o);let f=document.createElement("div");f.className="stills-chips";for(let d of e.masks){if(typeof d.temp!="number")continue;let u=document.createElement("span");u.className="chipT",u.textContent=`${d.temp.toFixed(1)}\xB0`,u.style.left=`${d.centre[0]/e.w*100}%`,u.style.top=`${d.centre[1]/e.h*100}%`,f.appendChild(u)}s.appendChild(f),requestAnimationFrame(()=>{let d=s.getBoundingClientRect(),u=Math.min(d.width/e.w,d.height/e.h),p=e.w*u,x=e.h*u;f.style.width=`${p}px`,f.style.height=`${x}px`,f.style.left=`${(d.width-p)/2}px`,f.style.top=`${(d.height-x)/2}px`})}function cm(s){let e=s.slice().sort((r,o)=>r[0]-o[0]||r[1]-o[1]);if(e.length<3)return e;let t=(r,o,a)=>(o[0]-r[0])*(a[1]-r[1])-(o[1]-r[1])*(a[0]-r[0]),n=[];for(let r of e){for(;n.length>=2&&t(n[n.length-2],n[n.length-1],r)<=0;)n.pop();n.push(r)}let i=[];for(let r=e.length-1;r>=0;r--){let o=e[r];for(;i.length>=2&&t(i[i.length-2],i[i.length-1],o)<=0;)i.pop();i.push(o)}return i.pop(),n.pop(),n.concat(i)}var um=s=>s/.012,Dn=(s,e)=>[+(um(s)/1e3).toFixed(6),+(um(e)/900).toFixed(6)];function LM(s,e){let t={t:0,d:1/0},n=0,i=0;for(let r=0;r<s.length-1;r++)i+=Math.hypot(s[r+1][0]-s[r][0],s[r+1][1]-s[r][1]);for(let r=0;r<s.length-1;r++){let[o,a]=s[r],l=s[r+1][0]-o,c=s[r+1][1]-a,h=l*l+c*c,f=h>0?Math.max(0,Math.min(1,((e[0]-o)*l+(e[1]-a)*c)/h)):0,d=Math.hypot(e[0]-(o+f*l),e[1]-(a+f*c));d<t.d&&(t={t:(n+f*Math.sqrt(h))/i,d}),n+=Math.sqrt(h)}return+t.t.toFixed(5)}var dm=[{id:"g-out",level:"L0",kind:"exterior",t:.3,pts:[[.5,.5],[11.5,.5],[11.5,10.3],[.5,10.3],[.5,.5]]},{id:"g-w1",level:"L0",kind:"interior",t:.12,pts:[[3.5,.5],[3.5,10.3]]},{id:"g-w2",level:"L0",kind:"interior",t:.12,pts:[[.5,3.5],[3.5,3.5]]},{id:"g-w3",level:"L0",kind:"railing",t:.05,h:1,pts:[[2,3.9],[2,7.5]]},{id:"g-w5",level:"L0",kind:"interior",t:.12,pts:[[3.5,6],[11.5,6]]},{id:"g-w6",level:"L0",kind:"interior",t:.12,pts:[[7.5,6],[7.5,10.3]]},{id:"g-w7",level:"L0",kind:"interior",t:.12,pts:[[.5,7.5],[3.5,7.5]]},{id:"g-w8",level:"L0",kind:"interior",t:.1,pts:[[2,7.5],[2,10.3]]},{id:"u-out",level:"L1",kind:"exterior",t:.3,pts:[[.5,.5],[11.5,.5],[11.5,7.5],[.5,7.5],[.5,.5]]},{id:"u-w1",level:"L1",kind:"interior",t:.12,pts:[[3.5,.5],[3.5,7.5]]},{id:"u-w2",level:"L1",kind:"interior",t:.12,pts:[[3.5,4],[11.5,4]]},{id:"u-w3",level:"L1",kind:"interior",t:.12,pts:[[8,.5],[8,4]]},{id:"u-w4",level:"L1",kind:"interior",t:.12,pts:[[3.5,5.2],[11.5,5.2]]},{id:"u-w5",level:"L1",kind:"interior",t:.12,pts:[[6.5,5.2],[6.5,7.5]]},{id:"u-rail",level:"L1",kind:"railing",t:.05,h:1,pts:[[2,3.9],[2,7.2],[.5,7.2]]}],IM=[["front","g-out",[.5,2.2],"door",1,2.1,0,"right","end","binary_sensor.front_door"],["win-hall","g-out",[.5,1.2],"window",.8,1.2,.9],["win-liv-n1","g-out",[5.5,.5],"window",1.4,1.4,.9],["win-liv-n2","g-out",[7.5,.5],"window",1.4,1.4,.9],["win-liv-n3","g-out",[9.5,.5],"window",1.4,1.4,.9],["win-liv-e","g-out",[11.5,3.2],"window",2.6,2.3,.1,"none","start",null,"cover.living_terrace"],["win-kit-e","g-out",[11.5,8.2],"window",1.2,1.2,1],["win-kit-s","g-out",[9.5,10.3],"window",1.4,1.2,1],["win-off-s","g-out",[5.5,10.3],"window",1.6,1.4,.9,"none","start",null,"cover.office"],["win-wc-w","g-out",[.5,9],"window",.6,.6,1.5],["d-hall-liv","g-w1",[3.5,2],"door",1.6,2.1,0,"double","start","binary_sensor.hall_living_door"],["d-corr-liv","g-w1",[3.5,4.8],"door",.9,2.1,0,"left","start",null],["d-corr-off","g-w1",[3.5,6.9],"door",.9,2.1,0,"right","end","binary_sensor.office_door"],["p-hall-corr","g-w2",[2.7,3.5],"passage",1.4,2.1,0],["d-liv-off","g-w5",[5.5,6],"door",.9,2.1,0,"right","start",null],["d-liv-kit","g-w5",[9.5,6],"door",1.8,2.1,0,"sliding","start","binary_sensor.kitchen_door"],["d-off-kit","g-w6",[7.5,8.2],"door",.8,2.1,0,"left","end",null],["d-wc","g-w7",[1.25,7.5],"door",.8,2.1,0,"right","end","binary_sensor.wc_door"],["d-util","g-w7",[2.75,7.5],"door",.8,2.1,0,"left","start",null],["uw-n1","u-out",[5.7,.5],"window",1.4,1.4,.9,"none","start",null,"cover.bedroom1"],["uw-n2","u-out",[9.7,.5],"window",1.4,1.4,.9,"none","start",null,"cover.bedroom2"],["uw-e1","u-out",[11.5,2.2],"window",1.2,1.4,.9],["uw-e2","u-out",[11.5,6.3],"window",1.2,1.4,.9],["uw-s1","u-out",[5,7.5],"window",.8,.8,1.5],["uw-s2","u-out",[9,7.5],"window",1.6,1.4,.9,"none","start",null,"cover.bedroom3"],["uw-w1","u-out",[.5,1.8],"window",1.2,1.4,.9],["up-hall","u-w1",[3.5,4.6],"passage",1.2,2.1,0],["ud-bed1","u-w2",[5.5,4],"door",.9,2.1,0,"left","start","binary_sensor.bedroom1_door"],["ud-bed2","u-w2",[9.5,4],"door",.9,2.1,0,"right","end",null],["ud-bath","u-w4",[4.6,5.2],"door",.8,2.1,0,"right","start","binary_sensor.bath_door"],["ud-bed3","u-w4",[8.8,5.2],"door",.9,2.1,0,"left","end",null]],fm=[{id:"r-hall",level:"L0",name:"\u05DB\u05E0\u05D9\u05E1\u05D4",poly:[[.5,.5],[3.5,.5],[3.5,3.5],[.5,3.5]],floor:"tiles_grey",light:"light.hall",temp:23.4},{id:"r-stair",level:"L0",name:"\u05D7\u05D3\u05E8 \u05DE\u05D3\u05E8\u05D2\u05D5\u05EA",poly:[[.5,3.5],[2,3.5],[2,7.5],[.5,7.5]],floor:"tiles_grey",light:"light.stairs",temp:23},{id:"r-corr",level:"L0",name:"\u05DE\u05E1\u05D3\u05E8\u05D5\u05DF",poly:[[2,3.5],[3.5,3.5],[3.5,7.5],[2,7.5]],floor:"tiles_grey",light:"light.corridor",temp:23.1},{id:"r-living",level:"L0",name:"\u05E1\u05DC\u05D5\u05DF",poly:[[3.5,.5],[11.5,.5],[11.5,6],[3.5,6]],floor:"oak",light:"light.living",temp:24.2,presence:"binary_sensor.motion_living"},{id:"r-kitchen",level:"L0",name:"\u05DE\u05D8\u05D1\u05D7",poly:[[7.5,6],[11.5,6],[11.5,10.3],[7.5,10.3]],floor:"tiles_white",light:"light.kitchen",temp:25.1},{id:"r-office",level:"L0",name:"\u05D7\u05D3\u05E8 \u05E2\u05D1\u05D5\u05D3\u05D4",poly:[[3.5,6],[7.5,6],[7.5,10.3],[3.5,10.3]],floor:"oak",light:"light.office",temp:23.8,presence:"binary_sensor.motion_office"},{id:"r-wc",level:"L0",name:"\u05E9\u05D9\u05E8\u05D5\u05EA\u05D9\u05DD",poly:[[.5,7.5],[2,7.5],[2,10.3],[.5,10.3]],floor:"tiles_white",light:"light.wc",temp:22.5},{id:"r-util",level:"L0",name:"\u05D7\u05D3\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA",poly:[[2,7.5],[3.5,7.5],[3.5,10.3],[2,10.3]],floor:"concrete",light:"light.utility",temp:22},{id:"r-uhall",level:"L1",name:"\u05D2\u05DC\u05E8\u05D9\u05D4",poly:[[.5,.5],[3.5,.5],[3.5,7.5],[2,7.5],[2,3.9],[.5,3.9]],floor:"oak",light:"light.gallery",temp:23.6},{id:"r-ucorr",level:"L1",name:"\u05DE\u05E1\u05D3\u05E8\u05D5\u05DF \u05E2\u05DC\u05D9\u05D5\u05DF",poly:[[3.5,4],[11.5,4],[11.5,5.2],[3.5,5.2]],floor:"oak",light:"light.upper_corridor",temp:23.5,presence:"binary_sensor.motion_upper"},{id:"r-bed1",level:"L1",name:"\u05D7\u05D3\u05E8 \u05E9\u05D9\u05E0\u05D4 \u05D4\u05D5\u05E8\u05D9\u05DD",poly:[[3.5,.5],[8,.5],[8,4],[3.5,4]],floor:"carpet",light:"light.bedroom1",temp:22.8},{id:"r-bed2",level:"L1",name:"\u05D7\u05D3\u05E8 \u05D9\u05DC\u05D3\u05D9\u05DD",poly:[[8,.5],[11.5,.5],[11.5,4],[8,4]],floor:"carpet",light:"light.bedroom2",temp:23.2},{id:"r-bath",level:"L1",name:"\u05D0\u05DE\u05D1\u05D8\u05D9\u05D4",poly:[[3.5,5.2],[6.5,5.2],[6.5,7.5],[3.5,7.5]],floor:"tiles_white",light:"light.bath",temp:24.5},{id:"r-bed3",level:"L1",name:"\u05D7\u05D3\u05E8 \u05D0\u05D5\u05E8\u05D7\u05D9\u05DD",poly:[[6.5,5.2],[11.5,5.2],[11.5,7.5],[6.5,7.5]],floor:"carpet",light:"light.bedroom3",temp:22.9}],DM=[["sofa","sofa.3seat","L0",[6.3,3.9],180,[2.3,.95,.85],0,"\u05E1\u05E4\u05D4"],["coffee","table.coffee","L0",[6.3,2.6],0,[1.1,.6,.42],0,null],["tv","cabinet.tv","L0",[6.3,.95],0,[1.8,.45,.55],0,"\u05DE\u05D6\u05E0\u05D5\u05DF \u05D8\u05DC\u05D5\u05D5\u05D9\u05D6\u05D9\u05D4"],["tvscreen","screen.tv","L0",[6.3,.78],0,[1.4,.06,.8],.9,null,"media_player.living_tv"],["dining","table.dining","L0",[9.6,3.2],0,[1.6,.9,.75],0,"\u05E9\u05D5\u05DC\u05D7\u05DF \u05D0\u05D5\u05DB\u05DC"],["dc1","chair.basic","L0",[9.1,2.5],0,[.45,.45,.9],0,null],["dc2","chair.basic","L0",[10.1,2.5],0,[.45,.45,.9],0,null],["dc3","chair.basic","L0",[9.1,3.9],180,[.45,.45,.9],0,null],["dc4","chair.basic","L0",[10.1,3.9],180,[.45,.45,.9],0,null],["plant1","plant.pot","L0",[4,5.5],0,[.5,.5,1.4],0,null],["rug","mat.rug","L0",[6.3,3.2],0,[3,2.2,.02],0,null],["lamp-liv-a","light.ceiling","L0",[6.3,2.6],0,[.5,.5,.12],2.68,null,"light.living"],["lamp-liv-b","light.ceiling","L0",[9.6,3.2],0,[.5,.5,.12],2.68,null,"light.living"],["lamp-floor","light.floor","L0",[4.1,1],0,[.35,.35,1.5],0,null,"light.living_floor"],["console","cabinet.low","L0",[2,.85],0,[1.2,.4,.8],0,"\u05E9\u05D9\u05D3\u05D4"],["lamp-hall","light.ceiling","L0",[2,2],0,[.4,.4,.1],2.7,null,"light.hall"],["lamp-corr","light.ceiling","L0",[2.75,5.5],0,[.3,.3,.1],2.7,null,"light.corridor"],["lamp-stair","light.wall","L0",[.62,5.5],90,[.18,.1,.25],2,null,"light.stairs"],["counter-a","kitchen.counter","L0",[11.2,8],0,[.6,3.6,.9],0,"\u05DE\u05E9\u05D8\u05D7 \u05E2\u05D1\u05D5\u05D3\u05D4"],["counter-b","kitchen.counter","L0",[9.4,9.95],0,[3,.6,.9],0,null],["fridge","kitchen.fridge","L0",[7.95,9.9],0,[.75,.7,1.9],0,"\u05DE\u05E7\u05E8\u05E8"],["island","kitchen.island","L0",[9.3,7.6],0,[1.6,.9,.92],0,"\u05D0\u05D9"],["lamp-kit","light.pendant","L0",[9.3,7.6],0,[.3,.3,.35],2,null,"light.kitchen"],["desk","table.desk","L0",[5.5,9.4],0,[1.6,.8,.75],0,"\u05E9\u05D5\u05DC\u05D7\u05DF \u05E2\u05D1\u05D5\u05D3\u05D4"],["dchair","chair.office","L0",[5.5,8.6],180,[.6,.6,1.1],0,null],["books","cabinet.bookcase","L0",[3.75,8],90,[1.8,.35,2.1],0,"\u05E1\u05E4\u05E8\u05D9\u05D9\u05D4"],["lamp-off","light.ceiling","L0",[5.5,8],0,[.4,.4,.1],2.7,null,"light.office"],["toilet","sanitary.wc","L0",[1.25,9.9],0,[.4,.65,.45],0,null],["basin","sanitary.basin","L0",[.75,8.2],0,[.45,.4,.85],0,null],["washer","appliance.washer","L0",[3.1,9.9],0,[.6,.6,.85],0,"\u05DE\u05DB\u05D5\u05E0\u05EA \u05DB\u05D1\u05D9\u05E1\u05D4"],["boiler","appliance.boiler","L0",[2.4,9.9],0,[.5,.5,1.2],0,null],["lamp-wc","light.ceiling","L0",[1.25,8.9],0,[.25,.25,.1],2.7,null,"light.wc"],["lamp-util","light.ceiling","L0",[2.75,8.9],0,[.25,.25,.1],2.7,null,"light.utility"],["ext1","extinguisher.co2","L0",[3.3,7.3],0,[.18,.18,.55],.9,"\u05DE\u05D8\u05E3"],["bed1","bed.double","L1",[5.75,1.6],0,[1.8,2.1,.55],0,"\u05DE\u05D9\u05D8\u05D4 \u05D6\u05D5\u05D2\u05D9\u05EA"],["ward1","cabinet.wardrobe","L1",[3.9,2.8],90,[2,.6,2.3],0,"\u05D0\u05E8\u05D5\u05DF"],["lamp-bed1","light.ceiling","L1",[5.75,2.3],0,[.4,.4,.1],2.5,null,"light.bedroom1"],["bed2","bed.single","L1",[10.7,1.6],0,[1,2,.5],0,"\u05DE\u05D9\u05D8\u05D4"],["desk2","table.desk","L1",[8.9,1],0,[1.2,.6,.75],0,null],["lamp-bed2","light.ceiling","L1",[9.75,2.3],0,[.4,.4,.1],2.5,null,"light.bedroom2"],["bed3","bed.double","L1",[9,6.4],180,[1.6,2,.55],0,null],["lamp-bed3","light.ceiling","L1",[9,6.3],0,[.4,.4,.1],2.5,null,"light.bedroom3"],["tub","sanitary.tub","L1",[4.4,7],0,[1.7,.75,.55],0,"\u05D0\u05DE\u05D1\u05D8\u05D9\u05D4"],["basin2","sanitary.basin","L1",[6.1,5.6],0,[.5,.4,.85],0,null],["toilet2","sanitary.wc","L1",[6.1,6.9],90,[.4,.65,.45],0,null],["lamp-bath","light.ceiling","L1",[5,6.3],0,[.3,.3,.1],2.5,null,"light.bath"],["lamp-uhall","light.ceiling","L1",[2,2.2],0,[.45,.45,.1],2.5,null,"light.gallery"],["lamp-ucorr","light.ceiling","L1",[7.5,4.6],0,[.3,.3,.1],2.5,null,"light.upper_corridor"],["plant2","plant.pot","L1",[3,1],0,[.45,.45,1.1],0,null],["bench","cabinet.low","L1",[1.2,1],0,[1.2,.4,.5],0,null]],NM=[{id:"cam-hall",level:"L0",p:[3.3,.7],rot:215,fov:95,r:7,mount:2.4,tilt:22,label:"\u05DE\u05E6\u05DC\u05DE\u05D4 \xB7 \u05DB\u05E0\u05D9\u05E1\u05D4",online:!0},{id:"cam-living",level:"L0",p:[11.3,5.8],rot:318,fov:100,r:10,mount:2.5,tilt:20,label:"\u05DE\u05E6\u05DC\u05DE\u05D4 \xB7 \u05E1\u05DC\u05D5\u05DF",online:!0},{id:"cam-upper",level:"L1",p:[11.3,4.3],rot:265,fov:90,r:9,mount:2.3,tilt:18,label:"\u05DE\u05E6\u05DC\u05DE\u05D4 \xB7 \u05DE\u05E1\u05D3\u05E8\u05D5\u05DF \u05E2\u05DC\u05D9\u05D5\u05DF",online:!1}],UM=[{id:"wp-front",name:"\u05D3\u05DC\u05EA \u05DB\u05E0\u05D9\u05E1\u05D4",level:"L0",p:[1.1,2.2],heading:250,is_default:!0},{id:"wp-living",name:"\u05DE\u05E8\u05DB\u05D6 \u05D4\u05E1\u05DC\u05D5\u05DF",level:"L0",p:[7,3.3],heading:0},{id:"wp-kitchen",name:"\u05DE\u05D8\u05D1\u05D7",level:"L0",p:[9,8.8],heading:300},{id:"wp-gallery",name:"\u05D2\u05DC\u05E8\u05D9\u05D4",level:"L1",p:[2.7,2],heading:180}];function OM(){let s=dm.map(r=>({id:r.id,level_id:r.level,polyline:r.pts.map(o=>Dn(o[0],o[1])),thickness_m:r.t,height_m:r.h??null,base_z_m:0,kind:r.kind,confidence:1,source:"manual",locked:!1,external_ids:{}})),e=new Map(dm.map(r=>[r.id,r.pts])),t=IM.map(([r,o,a,l,c,h,f,d,u,p,x])=>({id:r,wall_id:o,t:LM(e.get(o),a),kind:l,width_m:c,height_m:h,sill_m:f,swing:d||"none",hinge:u||"start",anchor_ref:p?{resource_type:"ha_entity",resource_id:p}:null,confidence:1,source:"manual",external_ids:{},...x?{x_proto:{cover_entity:x,glazing:r==="uw-s1"||r==="win-wc-w"?"frosted":"clear"}}:{}})),n=DM.map(([r,o,a,l,c,h,f,d,u])=>({id:r,item_id:o,level_id:a,position:Dn(l[0],l[1]),rotation_deg:c,size:{w_m:h[0],d_m:h[1],h_m:h[2]},z_m:f,params:{},label:d??null,anchor_ref:u?{resource_type:"ha_entity",resource_id:u}:null,group_id:null,confidence:1,source:"manual",locked:!1,external_ids:{}})),i=fm.map(r=>({id:r.id,level_id:r.level,ceiling_height_m:null,tags:[],x_proto:{floor_material:r.floor}}));return{schema_version:"2.0",plan_version_id:"proto-house-v1",floor_id:"proto-house",source:{sha256:"0".repeat(64),file_name:"proto-house.pdf",mime:"application/pdf",page:1},dimensions:{width_px:1e3,height_px:900,scale_m_per_px:.012,calibration:{status:"measured",method:"two_point",pairs:[{a:Dn(.5,.5),b:Dn(11.5,.5),metres:11}],residual_pct:0,reason:null}},transform:{rotation:0,crop:null},levels:[{id:"L0",name:"\u05E7\u05E8\u05E7\u05E2",elevation_m:0,ceiling_height_m:2.8,is_default:!0,external_ids:{}},{id:"L1",name:"\u05E7\u05D5\u05DE\u05D4 1",elevation_m:2.9,ceiling_height_m:2.6,is_default:!1,external_ids:{}}],walls:s,openings:t,rooms:i,objects:n,circuits:[{id:"k-living",name:"\u05E1\u05DC\u05D5\u05DF",switch_entity_id:"light.living",member_ids:["lamp-liv-a","lamp-liv-b"],color_token:"circuit-1",power_w:48}],connectors:[{id:"stairs-main",kind:"stairs",level_from:"L0",level_to:"L1",floor_ids:[],polyline:[Dn(1.25,7.2),Dn(1.25,3.9)],width_m:1,label:null,object_id:null,source:"manual",external_ids:{},shape:"straight",turn:"none",flights:[{steps:16}],landing_depth_m:null}],labels:[],groups:[],uncertain_regions:[],uncertainty:{overall:0,notes:[]},meta:{generator:"studio6-prototype",tokens_version:"map-1",detector_version:null},floor_height_m:2.9,x_proto:{north_deg:12,latitude:32.08,longitude:34.78,walk_positions:UM.map(r=>({id:r.id,name:r.name,level_id:r.level,x:Dn(r.p[0],r.p[1])[0],y:Dn(r.p[0],r.p[1])[1],heading_deg:r.heading,is_default:!!r.is_default}))}}}var pm={id:"demo-house",title:"\u05D1\u05D9\u05EA \u05D3\u05D5\u05BE\u05E7\u05D5\u05DE\u05EA\u05D9 (\u05D3\u05DE\u05D5)",doc:OM(),zones:fm.map(s=>({id:s.id,name:s.name,level_id:s.level,polygon:s.poly.map(e=>({x:Dn(e[0],e[1])[0],y:Dn(e[0],e[1])[1]})),x_proto:{floor_material:s.floor,light:s.light,temp:s.temp,presence:s.presence||null}})),anchors:NM.map(s=>({id:s.id,resource_type:"camera",resource_id:s.id,x:Dn(s.p[0],s.p[1])[0],y:Dn(s.p[0],s.p[1])[1],rotation:s.rot,fov:s.fov,radius:s.r/12,polygon:null,level_id:s.level,layer_id:"cameras",label:s.label,state:null,online:s.online,mount_height_m:s.mount,tilt_deg:s.tilt})),entities:{"light.hall":"off","light.stairs":"off","light.corridor":"off","light.living":"on","light.living_floor":"on","light.kitchen":"on","light.office":"off","light.wc":"off","light.utility":"off","light.gallery":"off","light.upper_corridor":"off","light.bedroom1":"off","light.bedroom2":"on","light.bedroom3":"off","light.bath":"off","binary_sensor.front_door":"off","binary_sensor.hall_living_door":"on","binary_sensor.office_door":"off","binary_sensor.kitchen_door":"on","binary_sensor.wc_door":"off","binary_sensor.bedroom1_door":"off","binary_sensor.bath_door":"off","lock.front_door":"locked","cover.living_terrace":"open","cover.office":"closed","cover.bedroom1":"open","cover.bedroom2":"open","cover.bedroom3":"closed","binary_sensor.motion_living":"on","binary_sensor.motion_office":"off","binary_sensor.motion_upper":"off","media_player.living_tv":"playing"},coverPositions:{"cover.living_terrace":100,"cover.office":0,"cover.bedroom1":100,"cover.bedroom2":70,"cover.bedroom3":0},entityNames:{"light.hall":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05DB\u05E0\u05D9\u05E1\u05D4","light.stairs":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05DE\u05D3\u05E8\u05D2\u05D5\u05EA","light.corridor":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05DE\u05E1\u05D3\u05E8\u05D5\u05DF","light.living":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05E1\u05DC\u05D5\u05DF","light.living_floor":"\u05DE\u05E0\u05D5\u05E8\u05EA \u05E8\u05E6\u05E4\u05D4","light.kitchen":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05DE\u05D8\u05D1\u05D7","light.office":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D7\u05D3\u05E8 \u05E2\u05D1\u05D5\u05D3\u05D4","light.wc":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05E9\u05D9\u05E8\u05D5\u05EA\u05D9\u05DD","light.utility":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D7\u05D3\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA","light.gallery":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D2\u05DC\u05E8\u05D9\u05D4","light.upper_corridor":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05DE\u05E1\u05D3\u05E8\u05D5\u05DF \u05E2\u05DC\u05D9\u05D5\u05DF","light.bedroom1":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D7\u05D3\u05E8 \u05D4\u05D5\u05E8\u05D9\u05DD","light.bedroom2":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D7\u05D3\u05E8 \u05D9\u05DC\u05D3\u05D9\u05DD","light.bedroom3":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D7\u05D3\u05E8 \u05D0\u05D5\u05E8\u05D7\u05D9\u05DD","light.bath":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D0\u05DE\u05D1\u05D8\u05D9\u05D4","binary_sensor.front_door":"\u05D3\u05DC\u05EA \u05DB\u05E0\u05D9\u05E1\u05D4","binary_sensor.hall_living_door":"\u05D3\u05DC\u05EA \u05E1\u05DC\u05D5\u05DF","binary_sensor.office_door":"\u05D3\u05DC\u05EA \u05D7\u05D3\u05E8 \u05E2\u05D1\u05D5\u05D3\u05D4","binary_sensor.kitchen_door":"\u05D3\u05DC\u05EA \u05D4\u05D6\u05D6\u05D4 \u05DC\u05DE\u05D8\u05D1\u05D7","binary_sensor.wc_door":"\u05D3\u05DC\u05EA \u05E9\u05D9\u05E8\u05D5\u05EA\u05D9\u05DD","binary_sensor.bedroom1_door":"\u05D3\u05DC\u05EA \u05D7\u05D3\u05E8 \u05D4\u05D5\u05E8\u05D9\u05DD","binary_sensor.bath_door":"\u05D3\u05DC\u05EA \u05D0\u05DE\u05D1\u05D8\u05D9\u05D4","lock.front_door":"\u05DE\u05E0\u05E2\u05D5\u05DC \u05DB\u05E0\u05D9\u05E1\u05D4","cover.living_terrace":"\u05EA\u05E8\u05D9\u05E1 \u05DE\u05E8\u05E4\u05E1\u05EA","cover.office":"\u05EA\u05E8\u05D9\u05E1 \u05D7\u05D3\u05E8 \u05E2\u05D1\u05D5\u05D3\u05D4","cover.bedroom1":"\u05EA\u05E8\u05D9\u05E1 \u05D7\u05D3\u05E8 \u05D4\u05D5\u05E8\u05D9\u05DD","cover.bedroom2":"\u05EA\u05E8\u05D9\u05E1 \u05D7\u05D3\u05E8 \u05D9\u05DC\u05D3\u05D9\u05DD","cover.bedroom3":"\u05EA\u05E8\u05D9\u05E1 \u05D7\u05D3\u05E8 \u05D0\u05D5\u05E8\u05D7\u05D9\u05DD","binary_sensor.motion_living":"\u05EA\u05E0\u05D5\u05E2\u05D4 \u05D1\u05E1\u05DC\u05D5\u05DF","binary_sensor.motion_office":"\u05EA\u05E0\u05D5\u05E2\u05D4 \u05D1\u05D7\u05D3\u05E8 \u05E2\u05D1\u05D5\u05D3\u05D4","binary_sensor.motion_upper":"\u05EA\u05E0\u05D5\u05E2\u05D4 \u05DC\u05DE\u05E2\u05DC\u05D4","media_player.living_tv":"\u05D8\u05DC\u05D5\u05D5\u05D9\u05D6\u05D9\u05D4"},doorLocks:{front:"lock.front_door"}};var mm={schema_version:"2.0",plan_version_id:"sample",floor_id:"sample-floor",source:{sha256:"0000000000000000000000000000000000000000000000000000000000000000",file_name:"sample.pdf",mime:"application/pdf",page:1},dimensions:{width_px:1e3,height_px:800,scale_m_per_px:.01,calibration:{status:"measured",method:"two_point",pairs:[{a:[.1,.1],b:[.9,.1],metres:8}],residual_pct:0,reason:null}},transform:{rotation:0,crop:null},levels:[{id:"L0",name:"\u05DE\u05E4\u05DC\u05E1 \u05E8\u05D0\u05E9\u05D9",elevation_m:0,ceiling_height_m:3,is_default:!0,external_ids:{}},{id:"L1",name:"\u05D0\u05D5\u05DC\u05DD \u05EA\u05D7\u05EA\u05D5\u05DF",elevation_m:-1.2,ceiling_height_m:6,is_default:!1,external_ids:{}}],walls:[{id:"wc",level_id:"L0",polyline:[[.6,.1],[.6,.5]],thickness_m:.1,height_m:2.4,base_z_m:0,kind:"partition",confidence:.8,source:"auto",locked:!1,external_ids:{}},{id:"wa",level_id:"L0",polyline:[[.1,.1],[.9,.1],[.9,.6]],thickness_m:.3,height_m:null,base_z_m:0,kind:"exterior",confidence:1,source:"manual",locked:!1,external_ids:{}},{id:"wd",level_id:"L1",polyline:[[.1,.7],[.4,.7]],thickness_m:.2,height_m:null,base_z_m:0,kind:"interior",confidence:1,source:"manual",locked:!1,external_ids:{}},{id:"wb",level_id:"L0",polyline:[[.1,.5],[.6,.5]],thickness_m:.15,height_m:null,base_z_m:0,kind:"interior",confidence:1,source:"manual",locked:!1,external_ids:{}}],openings:[{id:"oe",wall_id:"wb",t:.9,kind:"passage",width_m:1,height_m:2.1,sill_m:0,swing:"none",hinge:"start",anchor_ref:null,confidence:1,source:"manual",external_ids:{}},{id:"ob",wall_id:"wa",t:.75,kind:"window",width_m:1.2,height_m:1.2,sill_m:.9,swing:"none",hinge:"start",anchor_ref:null,confidence:1,source:"manual",external_ids:{}},{id:"of",wall_id:"wd",t:.5,kind:"door",width_m:1,height_m:2.1,sill_m:0,swing:"sliding",hinge:"start",anchor_ref:null,confidence:1,source:"manual",external_ids:{}},{id:"oa",wall_id:"wa",t:.2,kind:"door",width_m:.9,height_m:2.1,sill_m:0,swing:"right",hinge:"start",anchor_ref:null,confidence:1,source:"manual",external_ids:{}},{id:"od",wall_id:"wc",t:.5,kind:"door",width_m:1.6,height_m:2.1,sill_m:0,swing:"double",hinge:"start",anchor_ref:null,confidence:1,source:"manual",external_ids:{}},{id:"oc",wall_id:"wb",t:.5,kind:"door",width_m:.8,height_m:2.1,sill_m:0,swing:"left",hinge:"end",anchor_ref:{resource_type:"ha_entity",resource_id:"lock.store"},confidence:1,source:"manual",external_ids:{}}],rooms:[],objects:[{id:"o1",item_id:"chair.basic",level_id:"L0",position:[.2,.2],rotation_deg:0,size:{w_m:.45,d_m:.45,h_m:.85},z_m:0,params:{},label:null,anchor_ref:null,group_id:"g1",confidence:1,source:"manual",locked:!1,external_ids:{}},{id:"o2",item_id:"table.desk",level_id:"L0",position:[.3,.4],rotation_deg:90,size:{w_m:1.4,d_m:.7,h_m:.75},z_m:0,params:{},label:"\u05E9\u05D5\u05DC\u05D7\u05DF",anchor_ref:null,group_id:"g1",confidence:1,source:"manual",locked:!1,external_ids:{}},{id:"o3",item_id:"light.ceiling",level_id:"L0",position:[.5,.3],rotation_deg:0,size:{w_m:.4,d_m:.4,h_m:.1},z_m:2.7,params:{},label:null,anchor_ref:{resource_type:"ha_entity",resource_id:"light.store"},group_id:null,confidence:1,source:"manual",locked:!1,external_ids:{}},{id:"o4",item_id:"tribune.stepped",level_id:"L0",position:[.25,.6],rotation_deg:180,size:{w_m:4,d_m:3,h_m:1.2},z_m:0,params:{rows:4,step_height_m:.3,step_width_m:1,connects_levels:"L1"},label:null,anchor_ref:null,group_id:null,confidence:1,source:"manual",locked:!1,external_ids:{}},{id:"o5",item_id:"extinguisher.co2",level_id:"L1",position:[.15,.8],rotation_deg:0,size:{w_m:.2,d_m:.2,h_m:.6},z_m:.9,params:{},label:"\u05DE\u05D8\u05E3",anchor_ref:null,group_id:null,confidence:1,source:"manual",locked:!1,external_ids:{}}],circuits:[{id:"k1",name:"\u05DE\u05E2\u05D2\u05DC \u05D0\u05D5\u05DC\u05DD",switch_entity_id:"switch.hall_a",member_ids:["o3"],color_token:"circuit-1",power_w:36}],connectors:[{id:"c1",kind:"stairs",level_from:"L0",level_to:"L1",floor_ids:[],polyline:[[.7,.7],[.8,.7]],width_m:1.2,label:null,object_id:null,source:"manual",external_ids:{}},{id:"cx-o4",kind:"tribune",level_from:"L0",level_to:"L1",floor_ids:[],polyline:[[.25,.4125],[.25,.7875]],width_m:4,label:null,object_id:"o4",source:"auto",external_ids:{}}],labels:[{id:"lb",text:"\u05D0\u05D5\u05DC\u05DD",position:[.25,.75],level_id:"L1",size:16},{id:"la",text:"\u05DE\u05D7\u05E1\u05DF",position:[.3,.3],level_id:"L0",size:16}],groups:[{id:"g1",kind:"manual",member_ids:["o1","o2"],params:{},label:null}],uncertain_regions:[],uncertainty:{overall:.2,notes:[]},meta:{generator:"fixture",tokens_version:"map-1",detector_version:null}};function gm(s){let e=new Map,t=new Map,n=s.clone();return xm(s,n,function(i,r){e.set(r,i),t.set(i,r)}),n.traverse(function(i){if(!i.isSkinnedMesh)return;let r=i,o=e.get(i),a=o.skeleton.bones;r.skeleton=o.skeleton.clone(),r.bindMatrix.copy(o.bindMatrix),r.skeleton.bones=a.map(function(l){return t.get(l)}),r.bind(r.skeleton,r.bindMatrix)}),n}function xm(s,e,t){t(s,e);for(let n=0;n<s.children.length;n++)xm(s.children[n],e.children[n],t)}var Hc=class extends ii{constructor(e){super(e),this.dracoLoader=null,this.ktx2Loader=null,this.meshoptDecoder=null,this.pluginCallbacks=[],this.register(function(t){return new Ju(t)}),this.register(function(t){return new Qu(t)}),this.register(function(t){return new ad(t)}),this.register(function(t){return new ld(t)}),this.register(function(t){return new cd(t)}),this.register(function(t){return new ed(t)}),this.register(function(t){return new td(t)}),this.register(function(t){return new nd(t)}),this.register(function(t){return new id(t)}),this.register(function(t){return new Ku(t)}),this.register(function(t){return new sd(t)}),this.register(function(t){return new $u(t)}),this.register(function(t){return new od(t)}),this.register(function(t){return new rd(t)}),this.register(function(t){return new ju(t)}),this.register(function(t){return new Vc(t,rt.EXT_MESHOPT_COMPRESSION)}),this.register(function(t){return new Vc(t,rt.KHR_MESHOPT_COMPRESSION)}),this.register(function(t){return new hd(t)})}load(e,t,n,i){let r=this,o;if(this.resourcePath!=="")o=this.resourcePath;else if(this.path!==""){let c=Ai.extractUrlBase(e);o=Ai.resolveURL(c,this.path)}else o=Ai.extractUrlBase(e);this.manager.itemStart(e);let a=function(c){i?i(c):console.error(c),r.manager.itemError(e),r.manager.itemEnd(e)},l=new ur(this.manager);l.setPath(this.path),l.setResponseType("arraybuffer"),l.setRequestHeader(this.requestHeader),l.setWithCredentials(this.withCredentials),l.load(e,function(c){try{r.parse(c,o,function(h){t(h),r.manager.itemEnd(e)},a)}catch(h){a(h)}},n,a)}setDRACOLoader(e){return this.dracoLoader=e,this}setKTX2Loader(e){return this.ktx2Loader=e,this}setMeshoptDecoder(e){return this.meshoptDecoder=e,this}register(e){return this.pluginCallbacks.indexOf(e)===-1&&this.pluginCallbacks.push(e),this}unregister(e){return this.pluginCallbacks.indexOf(e)!==-1&&this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(e),1),this}parse(e,t,n,i){let r,o={},a={},l=new TextDecoder;if(typeof e=="string")r=JSON.parse(e);else if(e instanceof ArrayBuffer)if(l.decode(new Uint8Array(e,0,4))===bm){try{o[rt.KHR_BINARY_GLTF]=new ud(e)}catch(f){i&&i(f);return}r=JSON.parse(o[rt.KHR_BINARY_GLTF].content)}else r=JSON.parse(l.decode(e));else r=e;if(r.asset===void 0||r.asset.version[0]<2){i&&i(new Error("THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported."));return}let c=new _d(r,{path:t||this.resourcePath||"",crossOrigin:this.crossOrigin,requestHeader:this.requestHeader,manager:this.manager,ktx2Loader:this.ktx2Loader,meshoptDecoder:this.meshoptDecoder});c.fileLoader.setRequestHeader(this.requestHeader);for(let h=0;h<this.pluginCallbacks.length;h++){let f=this.pluginCallbacks[h](c);f.name||console.error("THREE.GLTFLoader: Invalid plugin found: missing name"),a[f.name]=f,o[f.name]=!0}if(r.extensionsUsed)for(let h=0;h<r.extensionsUsed.length;++h){let f=r.extensionsUsed[h],d=r.extensionsRequired||[];switch(f){case rt.KHR_MATERIALS_UNLIT:o[f]=new Zu;break;case rt.KHR_DRACO_MESH_COMPRESSION:o[f]=new dd(r,this.dracoLoader);break;case rt.KHR_TEXTURE_TRANSFORM:o[f]=new fd;break;case rt.KHR_MESH_QUANTIZATION:o[f]=new pd;break;default:d.indexOf(f)>=0&&a[f]===void 0&&console.warn('THREE.GLTFLoader: Unknown extension "'+f+'".')}}c.setExtensions(o),c.setPlugins(a),c.parse(n,i)}parseAsync(e,t){let n=this;return new Promise(function(i,r){n.parse(e,t,i,r)})}};function FM(){let s={};return{get:function(e){return s[e]},add:function(e,t){s[e]=t},remove:function(e){delete s[e]},removeAll:function(){s={}}}}function Ht(s,e,t){let n=s.json.materials[e];return n.extensions&&n.extensions[t]?n.extensions[t]:null}var rt={KHR_BINARY_GLTF:"KHR_binary_glTF",KHR_DRACO_MESH_COMPRESSION:"KHR_draco_mesh_compression",KHR_LIGHTS_PUNCTUAL:"KHR_lights_punctual",KHR_MATERIALS_CLEARCOAT:"KHR_materials_clearcoat",KHR_MATERIALS_DISPERSION:"KHR_materials_dispersion",KHR_MATERIALS_IOR:"KHR_materials_ior",KHR_MATERIALS_SHEEN:"KHR_materials_sheen",KHR_MATERIALS_SPECULAR:"KHR_materials_specular",KHR_MATERIALS_TRANSMISSION:"KHR_materials_transmission",KHR_MATERIALS_IRIDESCENCE:"KHR_materials_iridescence",KHR_MATERIALS_ANISOTROPY:"KHR_materials_anisotropy",KHR_MATERIALS_UNLIT:"KHR_materials_unlit",KHR_MATERIALS_VOLUME:"KHR_materials_volume",KHR_TEXTURE_BASISU:"KHR_texture_basisu",KHR_TEXTURE_TRANSFORM:"KHR_texture_transform",KHR_MESH_QUANTIZATION:"KHR_mesh_quantization",KHR_MATERIALS_EMISSIVE_STRENGTH:"KHR_materials_emissive_strength",EXT_MATERIALS_BUMP:"EXT_materials_bump",EXT_TEXTURE_WEBP:"EXT_texture_webp",EXT_TEXTURE_AVIF:"EXT_texture_avif",EXT_MESHOPT_COMPRESSION:"EXT_meshopt_compression",KHR_MESHOPT_COMPRESSION:"KHR_meshopt_compression",EXT_MESH_GPU_INSTANCING:"EXT_mesh_gpu_instancing"},ju=class{constructor(e){this.parser=e,this.name=rt.KHR_LIGHTS_PUNCTUAL,this.cache={refs:{},uses:{}}}_markDefs(){let e=this.parser,t=this.parser.json.nodes||[];for(let n=0,i=t.length;n<i;n++){let r=t[n];r.extensions&&r.extensions[this.name]&&r.extensions[this.name].light!==void 0&&e._addNodeRef(this.cache,r.extensions[this.name].light)}}_loadLight(e){let t=this.parser,n="light:"+e,i=t.cache.get(n);if(i)return i;let r=t.json,l=((r.extensions&&r.extensions[this.name]||{}).lights||[])[e],c,h=new Ee(16777215);l.color!==void 0&&h.setRGB(l.color[0],l.color[1],l.color[2],fn);let f=l.range!==void 0?l.range:0;switch(l.type){case"directional":c=new qi(h),c.target.position.set(0,0,-1),c.add(c.target);break;case"point":c=new _s(h),c.distance=f;break;case"spot":c=new So(h),c.distance=f,l.spot=l.spot||{},l.spot.innerConeAngle=l.spot.innerConeAngle!==void 0?l.spot.innerConeAngle:0,l.spot.outerConeAngle=l.spot.outerConeAngle!==void 0?l.spot.outerConeAngle:Math.PI/4,c.angle=l.spot.outerConeAngle,c.penumbra=1-l.spot.innerConeAngle/l.spot.outerConeAngle,c.target.position.set(0,0,-1),c.add(c.target);break;default:throw new Error("THREE.GLTFLoader: Unexpected light type: "+l.type)}return c.position.set(0,0,0),di(c,l),l.intensity!==void 0&&(c.intensity=l.intensity),c.name=t.createUniqueName(l.name||"light_"+e),i=Promise.resolve(c),t.cache.add(n,i),i}getDependency(e,t){if(e==="light")return this._loadLight(t)}createNodeAttachment(e){let t=this,n=this.parser,r=n.json.nodes[e],a=(r.extensions&&r.extensions[this.name]||{}).light;return a===void 0?null:this._loadLight(a).then(function(l){return n._getNodeRef(t.cache,a,l)})}},Zu=class{constructor(){this.name=rt.KHR_MATERIALS_UNLIT}getMaterialType(){return Et}extendParams(e,t,n){let i=[];e.color=new Ee(1,1,1),e.opacity=1;let r=t.pbrMetallicRoughness;if(r){if(Array.isArray(r.baseColorFactor)){let o=r.baseColorFactor;e.color.setRGB(o[0],o[1],o[2],fn),e.opacity=o[3]}r.baseColorTexture!==void 0&&i.push(n.assignTexture(e,"map",r.baseColorTexture,Mt))}return Promise.all(i)}},Ku=class{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_EMISSIVE_STRENGTH}extendMaterialParams(e,t){let n=Ht(this.parser,e,this.name);return n===null||n.emissiveStrength!==void 0&&(t.emissiveIntensity=n.emissiveStrength),Promise.resolve()}},Ju=class{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_CLEARCOAT}getMaterialType(e){return Ht(this.parser,e,this.name)!==null?ln:null}extendMaterialParams(e,t){let n=Ht(this.parser,e,this.name);if(n===null)return Promise.resolve();let i=[];if(n.clearcoatFactor!==void 0&&(t.clearcoat=n.clearcoatFactor),n.clearcoatTexture!==void 0&&i.push(this.parser.assignTexture(t,"clearcoatMap",n.clearcoatTexture)),n.clearcoatRoughnessFactor!==void 0&&(t.clearcoatRoughness=n.clearcoatRoughnessFactor),n.clearcoatRoughnessTexture!==void 0&&i.push(this.parser.assignTexture(t,"clearcoatRoughnessMap",n.clearcoatRoughnessTexture)),n.clearcoatNormalTexture!==void 0&&(i.push(this.parser.assignTexture(t,"clearcoatNormalMap",n.clearcoatNormalTexture)),n.clearcoatNormalTexture.scale!==void 0)){let r=n.clearcoatNormalTexture.scale;t.clearcoatNormalScale=new ee(r,r)}return Promise.all(i)}},Qu=class{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_DISPERSION}getMaterialType(e){return Ht(this.parser,e,this.name)!==null?ln:null}extendMaterialParams(e,t){let n=Ht(this.parser,e,this.name);return n===null||(t.dispersion=n.dispersion!==void 0?n.dispersion:0),Promise.resolve()}},$u=class{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_IRIDESCENCE}getMaterialType(e){return Ht(this.parser,e,this.name)!==null?ln:null}extendMaterialParams(e,t){let n=Ht(this.parser,e,this.name);if(n===null)return Promise.resolve();let i=[];return n.iridescenceFactor!==void 0&&(t.iridescence=n.iridescenceFactor),n.iridescenceTexture!==void 0&&i.push(this.parser.assignTexture(t,"iridescenceMap",n.iridescenceTexture)),n.iridescenceIor!==void 0&&(t.iridescenceIOR=n.iridescenceIor),t.iridescenceThicknessRange===void 0&&(t.iridescenceThicknessRange=[100,400]),n.iridescenceThicknessMinimum!==void 0&&(t.iridescenceThicknessRange[0]=n.iridescenceThicknessMinimum),n.iridescenceThicknessMaximum!==void 0&&(t.iridescenceThicknessRange[1]=n.iridescenceThicknessMaximum),n.iridescenceThicknessTexture!==void 0&&i.push(this.parser.assignTexture(t,"iridescenceThicknessMap",n.iridescenceThicknessTexture)),Promise.all(i)}},ed=class{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_SHEEN}getMaterialType(e){return Ht(this.parser,e,this.name)!==null?ln:null}extendMaterialParams(e,t){let n=Ht(this.parser,e,this.name);if(n===null)return Promise.resolve();let i=[];if(t.sheenColor=new Ee(0,0,0),t.sheenRoughness=0,t.sheen=1,n.sheenColorFactor!==void 0){let r=n.sheenColorFactor;t.sheenColor.setRGB(r[0],r[1],r[2],fn)}return n.sheenRoughnessFactor!==void 0&&(t.sheenRoughness=n.sheenRoughnessFactor),n.sheenColorTexture!==void 0&&i.push(this.parser.assignTexture(t,"sheenColorMap",n.sheenColorTexture,Mt)),n.sheenRoughnessTexture!==void 0&&i.push(this.parser.assignTexture(t,"sheenRoughnessMap",n.sheenRoughnessTexture)),Promise.all(i)}},td=class{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_TRANSMISSION}getMaterialType(e){return Ht(this.parser,e,this.name)!==null?ln:null}extendMaterialParams(e,t){let n=Ht(this.parser,e,this.name);if(n===null)return Promise.resolve();let i=[];return n.transmissionFactor!==void 0&&(t.transmission=n.transmissionFactor),n.transmissionTexture!==void 0&&i.push(this.parser.assignTexture(t,"transmissionMap",n.transmissionTexture)),Promise.all(i)}},nd=class{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_VOLUME}getMaterialType(e){return Ht(this.parser,e,this.name)!==null?ln:null}extendMaterialParams(e,t){let n=Ht(this.parser,e,this.name);if(n===null)return Promise.resolve();let i=[];t.thickness=n.thicknessFactor!==void 0?n.thicknessFactor:0,n.thicknessTexture!==void 0&&i.push(this.parser.assignTexture(t,"thicknessMap",n.thicknessTexture)),t.attenuationDistance=n.attenuationDistance||1/0;let r=n.attenuationColor||[1,1,1];return t.attenuationColor=new Ee().setRGB(r[0],r[1],r[2],fn),Promise.all(i)}},id=class{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_IOR}getMaterialType(e){return Ht(this.parser,e,this.name)!==null?ln:null}extendMaterialParams(e,t){let n=Ht(this.parser,e,this.name);return n===null||(t.ior=n.ior!==void 0?n.ior:1.5,t.ior===0&&(t.ior=1e3)),Promise.resolve()}},sd=class{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_SPECULAR}getMaterialType(e){return Ht(this.parser,e,this.name)!==null?ln:null}extendMaterialParams(e,t){let n=Ht(this.parser,e,this.name);if(n===null)return Promise.resolve();let i=[];t.specularIntensity=n.specularFactor!==void 0?n.specularFactor:1,n.specularTexture!==void 0&&i.push(this.parser.assignTexture(t,"specularIntensityMap",n.specularTexture));let r=n.specularColorFactor||[1,1,1];return t.specularColor=new Ee().setRGB(r[0],r[1],r[2],fn),n.specularColorTexture!==void 0&&i.push(this.parser.assignTexture(t,"specularColorMap",n.specularColorTexture,Mt)),Promise.all(i)}},rd=class{constructor(e){this.parser=e,this.name=rt.EXT_MATERIALS_BUMP}getMaterialType(e){return Ht(this.parser,e,this.name)!==null?ln:null}extendMaterialParams(e,t){let n=Ht(this.parser,e,this.name);if(n===null)return Promise.resolve();let i=[];return t.bumpScale=n.bumpFactor!==void 0?n.bumpFactor:1,n.bumpTexture!==void 0&&i.push(this.parser.assignTexture(t,"bumpMap",n.bumpTexture)),Promise.all(i)}},od=class{constructor(e){this.parser=e,this.name=rt.KHR_MATERIALS_ANISOTROPY}getMaterialType(e){return Ht(this.parser,e,this.name)!==null?ln:null}extendMaterialParams(e,t){let n=Ht(this.parser,e,this.name);if(n===null)return Promise.resolve();let i=[];return n.anisotropyStrength!==void 0&&(t.anisotropy=n.anisotropyStrength),n.anisotropyRotation!==void 0&&(t.anisotropyRotation=n.anisotropyRotation),n.anisotropyTexture!==void 0&&i.push(this.parser.assignTexture(t,"anisotropyMap",n.anisotropyTexture)),Promise.all(i)}},ad=class{constructor(e){this.parser=e,this.name=rt.KHR_TEXTURE_BASISU}loadTexture(e){let t=this.parser,n=t.json,i=n.textures[e];if(!i.extensions||!i.extensions[this.name])return null;let r=i.extensions[this.name],o=t.options.ktx2Loader;if(!o){if(n.extensionsRequired&&n.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures");return null}return t.loadTextureImage(e,r.source,o)}},ld=class{constructor(e){this.parser=e,this.name=rt.EXT_TEXTURE_WEBP}loadTexture(e){let t=this.name,n=this.parser,i=n.json,r=i.textures[e];if(!r.extensions||!r.extensions[t])return null;let o=r.extensions[t],a=i.images[o.source],l=n.textureLoader;if(a.uri){let c=n.options.manager.getHandler(a.uri);c!==null&&(l=c)}return n.loadTextureImage(e,o.source,l)}},cd=class{constructor(e){this.parser=e,this.name=rt.EXT_TEXTURE_AVIF}loadTexture(e){let t=this.name,n=this.parser,i=n.json,r=i.textures[e];if(!r.extensions||!r.extensions[t])return null;let o=r.extensions[t],a=i.images[o.source],l=n.textureLoader;if(a.uri){let c=n.options.manager.getHandler(a.uri);c!==null&&(l=c)}return n.loadTextureImage(e,o.source,l)}},Vc=class{constructor(e,t){this.name=t,this.parser=e}loadBufferView(e){let t=this.parser.json,n=t.bufferViews[e];if(n.extensions&&n.extensions[this.name]){let i=n.extensions[this.name],r=this.parser.getDependency("buffer",i.buffer),o=this.parser.options.meshoptDecoder;if(!o||!o.supported){if(t.extensionsRequired&&t.extensionsRequired.indexOf(this.name)>=0)throw new Error("THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files");return null}return r.then(function(a){let l=i.byteOffset||0,c=i.byteLength||0,h=i.count,f=i.byteStride,d=new Uint8Array(a,l,c);return o.decodeGltfBufferAsync?o.decodeGltfBufferAsync(h,f,d,i.mode,i.filter).then(function(u){return u.buffer}):o.ready.then(function(){let u=new ArrayBuffer(h*f);return o.decodeGltfBuffer(new Uint8Array(u),h,f,d,i.mode,i.filter),u})})}else return null}},hd=class{constructor(e){this.name=rt.EXT_MESH_GPU_INSTANCING,this.parser=e}createNodeMesh(e){let t=this.parser.json,n=t.nodes[e];if(!n.extensions||!n.extensions[this.name]||n.mesh===void 0)return null;let i=t.meshes[n.mesh];for(let c of i.primitives)if(c.mode!==Nn.TRIANGLES&&c.mode!==Nn.TRIANGLE_STRIP&&c.mode!==Nn.TRIANGLE_FAN&&c.mode!==void 0)return null;let o=n.extensions[this.name].attributes,a=[],l={};for(let c in o)a.push(this.parser.getDependency("accessor",o[c]).then(h=>(l[c]=h,l[c])));return a.length<1?null:(a.push(this.parser.createNodeMesh(e)),Promise.all(a).then(c=>{let h=c.pop(),f=h.isGroup?h.children:[h],d=c[0].count,u=[];for(let p of f){let x=new je,m=new D,g=new on,b=new D(1,1,1),T=new no(p.geometry,p.material,d);for(let M=0;M<d;M++)l.TRANSLATION&&m.fromBufferAttribute(l.TRANSLATION,M),l.ROTATION&&g.fromBufferAttribute(l.ROTATION,M),l.SCALE&&b.fromBufferAttribute(l.SCALE,M),T.setMatrixAt(M,x.compose(m,g,b));let _=null;for(let M in l)if(M==="_COLOR_0"){let E=l[M];T.instanceColor=new Mi(E.array,E.itemSize,E.normalized)}else if(M!=="TRANSLATION"&&M!=="ROTATION"&&M!=="SCALE"){if(_===null){let A=T.geometry;_=new _t,_.name=A.name;for(let v in A.attributes)_.setAttribute(v,A.attributes[v]);for(let v in A.morphAttributes)_.morphAttributes[v]=A.morphAttributes[v];A.index!==null&&_.setIndex(A.index),_.morphTargetsRelative=A.morphTargetsRelative;for(let v of A.groups)_.addGroup(v.start,v.count,v.materialIndex);A.boundingBox!==null&&(_.boundingBox=A.boundingBox.clone()),A.boundingSphere!==null&&(_.boundingSphere=A.boundingSphere.clone()),_.drawRange.start=A.drawRange.start,_.drawRange.count=A.drawRange.count,_.userData=Object.assign({},A.userData),T.geometry=_}let E=l[M];_.setAttribute(M,new Mi(E.array,E.itemSize,E.normalized))}Ct.prototype.copy.call(T,p),this.parser.assignFinalMaterial(T),u.push(T)}return h.isGroup?(h.clear(),h.add(...u),h):u[0]}))}},bm="glTF",ca=12,_m={JSON:1313821514,BIN:5130562},ud=class{constructor(e){this.name=rt.KHR_BINARY_GLTF,this.content=null,this.body=null;let t=new DataView(e,0,ca),n=new TextDecoder;if(this.header={magic:n.decode(new Uint8Array(e.slice(0,4))),version:t.getUint32(4,!0),length:t.getUint32(8,!0)},this.header.magic!==bm)throw new Error("THREE.GLTFLoader: Unsupported glTF-Binary header.");if(this.header.version<2)throw new Error("THREE.GLTFLoader: Legacy binary file detected.");let i=this.header.length-ca,r=new DataView(e,ca),o=0;for(;o<i;){let a=r.getUint32(o,!0);o+=4;let l=r.getUint32(o,!0);if(o+=4,l===_m.JSON){let c=new Uint8Array(e,ca+o,a);this.content=n.decode(c)}else if(l===_m.BIN){let c=ca+o;this.body=e.slice(c,c+a)}o+=a}if(this.content===null)throw new Error("THREE.GLTFLoader: JSON content not found.")}},dd=class{constructor(e,t){if(!t)throw new Error("THREE.GLTFLoader: No DRACOLoader instance provided.");this.name=rt.KHR_DRACO_MESH_COMPRESSION,this.json=e,this.dracoLoader=t,this.dracoLoader.preload()}decodePrimitive(e,t){let n=this.json,i=this.dracoLoader,r=e.extensions[this.name].bufferView,o=e.extensions[this.name].attributes,a={},l={},c={};for(let h in o){let f=gd[h]||h.toLowerCase();a[f]=o[h]}for(let h in e.attributes){let f=gd[h]||h.toLowerCase();if(o[h]!==void 0){let d=n.accessors[e.attributes[h]],u=Lr[d.componentType];c[f]=u.name,l[f]=d.normalized===!0}}return t.getDependency("bufferView",r).then(function(h){return new Promise(function(f,d){i.decodeDracoFile(h,function(u){for(let p in u.attributes){let x=u.attributes[p],m=l[p];m!==void 0&&(x.normalized=m)}f(u)},a,c,fn,d)})})}},fd=class{constructor(){this.name=rt.KHR_TEXTURE_TRANSFORM}extendTexture(e,t){if((t.texCoord===void 0||t.texCoord===e.channel)&&t.offset===void 0&&t.rotation===void 0&&t.scale===void 0)return e;if(e=e.clone(),t.texCoord!==void 0&&(e.channel=t.texCoord),t.offset!==void 0&&e.offset.fromArray(t.offset),t.rotation!==void 0&&(e.rotation=t.rotation),t.scale!==void 0&&e.repeat.fromArray(t.scale),t.rotation!==void 0){let n=Math.cos(e.rotation),i=Math.sin(e.rotation);e.matrix.set(e.repeat.x*n,e.repeat.y*i,e.offset.x,-e.repeat.x*i,e.repeat.y*n,e.offset.y,0,0,1),e.matrixAutoUpdate=!1}return e.needsUpdate=!0,e}},pd=class{constructor(){this.name=rt.KHR_MESH_QUANTIZATION}},Gc=class extends ni{constructor(e,t,n,i){super(e,t,n,i)}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,i=this.valueSize,r=e*i*3+i;for(let o=0;o!==i;o++)t[o]=n[r+o];return t}interpolate_(e,t,n,i){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=a*2,c=a*3,h=i-t,f=(n-t)/h,d=f*f,u=d*f,p=e*c,x=p-c,m=-2*u+3*d,g=u-d,b=1-m,T=g-d+f;for(let _=0;_!==a;_++){let M=o[x+_+a],E=o[x+_+l]*h,A=o[p+_+a],v=o[p+_]*h;r[_]=b*M+T*E+m*A+g*v}return r}},BM=new on,md=class extends Gc{interpolate_(e,t,n,i){let r=super.interpolate_(e,t,n,i);return BM.fromArray(r).normalize().toArray(r),r}},Nn={FLOAT:5126,FLOAT_MAT3:35675,FLOAT_MAT4:35676,FLOAT_VEC2:35664,FLOAT_VEC3:35665,FLOAT_VEC4:35666,LINEAR:9729,REPEAT:10497,SAMPLER_2D:35678,POINTS:0,LINES:1,LINE_LOOP:2,LINE_STRIP:3,TRIANGLES:4,TRIANGLE_STRIP:5,TRIANGLE_FAN:6,UNSIGNED_BYTE:5121,UNSIGNED_SHORT:5123},Lr={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array},vm={9728:bt,9729:It,9984:El,9985:gr,9986:bs,9987:Gn},ym={33071:mn,33648:Ks,10497:Kt},Xu={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16},gd={POSITION:"position",NORMAL:"normal",TANGENT:"tangent",TEXCOORD_0:"uv",TEXCOORD_1:"uv1",TEXCOORD_2:"uv2",TEXCOORD_3:"uv3",COLOR_0:"color",WEIGHTS_0:"skinWeight",JOINTS_0:"skinIndex"},ts={scale:"scale",translation:"position",rotation:"quaternion",weights:"morphTargetInfluences"},kM={CUBICSPLINE:void 0,LINEAR:cs,STEP:ls},qu={OPAQUE:"OPAQUE",MASK:"MASK",BLEND:"BLEND"};function zM(s){return s.DefaultMaterial===void 0&&(s.DefaultMaterial=new Rt({color:16777215,emissive:0,metalness:1,roughness:1,transparent:!1,depthTest:!0,side:si})),s.DefaultMaterial}function As(s,e,t){for(let n in t.extensions)s[n]===void 0&&(e.userData.gltfExtensions=e.userData.gltfExtensions||{},e.userData.gltfExtensions[n]=t.extensions[n])}function di(s,e){e.extras!==void 0&&(typeof e.extras=="object"?Object.assign(s.userData,e.extras):console.warn("THREE.GLTFLoader: Ignoring primitive type .extras, "+e.extras))}function HM(s,e,t){let n=!1,i=!1,r=!1;for(let c=0,h=e.length;c<h;c++){let f=e[c];if(f.POSITION!==void 0&&(n=!0),f.NORMAL!==void 0&&(i=!0),f.COLOR_0!==void 0&&(r=!0),n&&i&&r)break}if(!n&&!i&&!r)return Promise.resolve(s);let o=[],a=[],l=[];for(let c=0,h=e.length;c<h;c++){let f=e[c];if(n){let d=f.POSITION!==void 0?t.getDependency("accessor",f.POSITION):s.attributes.position;o.push(d)}if(i){let d=f.NORMAL!==void 0?t.getDependency("accessor",f.NORMAL):s.attributes.normal;a.push(d)}if(r){let d=f.COLOR_0!==void 0?t.getDependency("accessor",f.COLOR_0):s.attributes.color;l.push(d)}}return Promise.all([Promise.all(o),Promise.all(a),Promise.all(l)]).then(function(c){let h=c[0],f=c[1],d=c[2];return n&&(s.morphAttributes.position=h),i&&(s.morphAttributes.normal=f),r&&(s.morphAttributes.color=d),s.morphTargetsRelative=!0,s})}function VM(s,e){if(s.updateMorphTargets(),e.weights!==void 0)for(let t=0,n=e.weights.length;t<n;t++)s.morphTargetInfluences[t]=e.weights[t];if(e.extras&&Array.isArray(e.extras.targetNames)){let t=e.extras.targetNames;if(s.morphTargetInfluences.length===t.length){s.morphTargetDictionary={};for(let n=0,i=t.length;n<i;n++)s.morphTargetDictionary[t[n]]=n}else console.warn("THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.")}}function GM(s){let e,t=s.extensions&&s.extensions[rt.KHR_DRACO_MESH_COMPRESSION];if(t?e="draco:"+t.bufferView+":"+t.indices+":"+Yu(t.attributes):e=s.indices+":"+Yu(s.attributes)+":"+s.mode,s.targets!==void 0)for(let n=0,i=s.targets.length;n<i;n++)e+=":"+Yu(s.targets[n]);return e}function Yu(s){let e="",t=Object.keys(s).sort();for(let n=0,i=t.length;n<i;n++)e+=t[n]+":"+s[t[n]]+";";return e}function xd(s){switch(s){case Int8Array:return 1/127;case Uint8Array:return 1/255;case Int16Array:return 1/32767;case Uint16Array:return 1/65535;default:throw new Error("THREE.GLTFLoader: Unsupported normalized accessor component type.")}}function WM(s){return s.search(/\.jpe?g($|\?)/i)>0||s.search(/^data\:image\/jpeg/)===0?"image/jpeg":s.search(/\.webp($|\?)/i)>0||s.search(/^data\:image\/webp/)===0?"image/webp":s.search(/\.ktx2($|\?)/i)>0||s.search(/^data\:image\/ktx2/)===0?"image/ktx2":"image/png"}var XM=new je,_d=class{constructor(e={},t={}){this.json=e,this.extensions={},this.plugins={},this.options=t,this.cache=new FM,this.associations=new Map,this.primitiveCache={},this.nodeCache={},this.meshCache={refs:{},uses:{}},this.cameraCache={refs:{},uses:{}},this.lightCache={refs:{},uses:{}},this.sourceCache={},this.textureCache={},this.nodeNamesUsed={};let n=!1,i=-1,r=!1,o=-1;if(typeof navigator<"u"&&typeof navigator.userAgent<"u"){let a=navigator.userAgent;n=/^((?!chrome|android).)*safari/i.test(a)===!0;let l=a.match(/Version\/(\d+)/);i=n&&l?parseInt(l[1],10):-1,r=a.indexOf("Firefox")>-1,o=r?a.match(/Firefox\/([0-9]+)\./)[1]:-1}typeof createImageBitmap>"u"||n&&i<17||r&&o<98?this.textureLoader=new xs(this.options.manager):this.textureLoader=new To(this.options.manager),this.textureLoader.setCrossOrigin(this.options.crossOrigin),this.textureLoader.setRequestHeader(this.options.requestHeader),this.fileLoader=new ur(this.options.manager),this.fileLoader.setResponseType("arraybuffer"),this.options.crossOrigin==="use-credentials"&&this.fileLoader.setWithCredentials(!0)}setExtensions(e){this.extensions=e}setPlugins(e){this.plugins=e}parse(e,t){let n=this,i=this.json,r=this.extensions;this.cache.removeAll(),this.nodeCache={},this._invokeAll(function(o){return o._markDefs&&o._markDefs()}),Promise.all(this._invokeAll(function(o){return o.beforeRoot&&o.beforeRoot()})).then(function(){return Promise.all([n.getDependencies("scene"),n.getDependencies("animation"),n.getDependencies("camera")])}).then(function(o){let a={scene:o[0][i.scene||0],scenes:o[0],animations:o[1],cameras:o[2],asset:i.asset,parser:n,userData:{}};return As(r,a,i),di(a,i),Promise.all(n._invokeAll(function(l){return l.afterRoot&&l.afterRoot(a)})).then(function(){for(let l of a.scenes)l.updateMatrixWorld();e(a)})}).catch(t)}_markDefs(){let e=this.json.nodes||[],t=this.json.skins||[],n=this.json.meshes||[];for(let i=0,r=t.length;i<r;i++){let o=t[i].joints;for(let a=0,l=o.length;a<l;a++)e[o[a]].isBone=!0}for(let i=0,r=e.length;i<r;i++){let o=e[i];o.mesh!==void 0&&(this._addNodeRef(this.meshCache,o.mesh),o.skin!==void 0&&(n[o.mesh].isSkinnedMesh=!0)),o.camera!==void 0&&this._addNodeRef(this.cameraCache,o.camera)}}_addNodeRef(e,t){t!==void 0&&(e.refs[t]===void 0&&(e.refs[t]=e.uses[t]=0),e.refs[t]++)}_getNodeRef(e,t,n){if(e.refs[t]<=1)return n;let i=n.clone(),r=(o,a)=>{let l=this.associations.get(o);l!=null&&this.associations.set(a,l);for(let[c,h]of o.children.entries())r(h,a.children[c])};return r(n,i),i.name+="_instance_"+e.uses[t]++,i}_invokeOne(e){let t=Object.values(this.plugins);t.push(this);for(let n=0;n<t.length;n++){let i=e(t[n]);if(i)return i}return null}_invokeAll(e){let t=Object.values(this.plugins);t.unshift(this);let n=[];for(let i=0;i<t.length;i++){let r=e(t[i]);r&&n.push(r)}return n}getDependency(e,t){let n=e+":"+t,i=this.cache.get(n);if(!i){switch(e){case"scene":i=this.loadScene(t);break;case"node":i=this._invokeOne(function(r){return r.loadNode&&r.loadNode(t)});break;case"mesh":i=this._invokeOne(function(r){return r.loadMesh&&r.loadMesh(t)});break;case"accessor":i=this.loadAccessor(t);break;case"bufferView":i=this._invokeOne(function(r){return r.loadBufferView&&r.loadBufferView(t)});break;case"buffer":i=this.loadBuffer(t);break;case"material":i=this._invokeOne(function(r){return r.loadMaterial&&r.loadMaterial(t)});break;case"texture":i=this._invokeOne(function(r){return r.loadTexture&&r.loadTexture(t)});break;case"skin":i=this.loadSkin(t);break;case"animation":i=this._invokeOne(function(r){return r.loadAnimation&&r.loadAnimation(t)});break;case"camera":i=this.loadCamera(t);break;default:if(i=this._invokeOne(function(r){return r!=this&&r.getDependency&&r.getDependency(e,t)}),!i)throw new Error("Unknown type: "+e);break}this.cache.add(n,i)}return i}getDependencies(e){let t=this.cache.get(e);if(!t){let n=this,i=this.json[e+(e==="mesh"?"es":"s")]||[];t=Promise.all(i.map(function(r,o){return n.getDependency(e,o)})),this.cache.add(e,t)}return t}loadBuffer(e){let t=this.json.buffers[e],n=this.fileLoader;if(t.type&&t.type!=="arraybuffer")throw new Error("THREE.GLTFLoader: "+t.type+" buffer type is not supported.");if(t.uri===void 0&&e===0)return Promise.resolve(this.extensions[rt.KHR_BINARY_GLTF].body);let i=this.options;return new Promise(function(r,o){n.load(Ai.resolveURL(t.uri,i.path),r,void 0,function(){o(new Error('THREE.GLTFLoader: Failed to load buffer "'+t.uri+'".'))})})}loadBufferView(e){let t=this.json.bufferViews[e];return this.getDependency("buffer",t.buffer).then(function(n){let i=t.byteLength||0,r=t.byteOffset||0;return n.slice(r,r+i)})}loadAccessor(e){let t=this,n=this.json,i=this.json.accessors[e];if(i.bufferView===void 0&&i.sparse===void 0){let o=Xu[i.type],a=Lr[i.componentType],l=i.normalized===!0,c=new a(i.count*o);return Promise.resolve(new Pt(c,o,l))}let r=[];return i.bufferView!==void 0?r.push(this.getDependency("bufferView",i.bufferView)):r.push(null),i.sparse!==void 0&&(r.push(this.getDependency("bufferView",i.sparse.indices.bufferView)),r.push(this.getDependency("bufferView",i.sparse.values.bufferView))),Promise.all(r).then(function(o){let a=o[0],l=Xu[i.type],c=Lr[i.componentType],h=c.BYTES_PER_ELEMENT,f=h*l,d=i.byteOffset||0,u=i.bufferView!==void 0?n.bufferViews[i.bufferView].byteStride:void 0,p=i.normalized===!0,x,m;if(u&&u!==f){let g=Math.floor(d/u),b="InterleavedBuffer:"+i.bufferView+":"+i.componentType+":"+g+":"+i.count,T=t.cache.get(b);T||(x=new c(a,g*u,i.count*u/h),T=new us(x,u/h),t.cache.add(b,T)),m=new zi(T,l,d%u/h,p)}else a===null?x=new c(i.count*l):x=new c(a,d,i.count*l),m=new Pt(x,l,p);if(i.sparse!==void 0){let g=Xu.SCALAR,b=Lr[i.sparse.indices.componentType],T=i.sparse.indices.byteOffset||0,_=i.sparse.values.byteOffset||0,M=new b(o[1],T,i.sparse.count*g),E=new c(o[2],_,i.sparse.count*l);a!==null&&(m=new Pt(m.array.slice(),m.itemSize,m.normalized)),m.normalized=!1;for(let A=0,v=M.length;A<v;A++){let R=M[A];if(m.setX(R,E[A*l]),l>=2&&m.setY(R,E[A*l+1]),l>=3&&m.setZ(R,E[A*l+2]),l>=4&&m.setW(R,E[A*l+3]),l>=5)throw new Error("THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.")}m.normalized=p}return m})}loadTexture(e){let t=this.json,n=this.options,r=t.textures[e].source,o=t.images[r],a=this.textureLoader;if(o.uri){let l=n.manager.getHandler(o.uri);l!==null&&(a=l)}return this.loadTextureImage(e,r,a)}loadTextureImage(e,t,n){let i=this,r=this.json,o=r.textures[e],a=r.images[t],l=(a.uri||a.bufferView)+":"+o.sampler;if(this.textureCache[l])return this.textureCache[l];let c=this.loadImageSource(t,n).then(function(h){h.flipY=!1,h.name=o.name||a.name||"",h.name===""&&typeof a.uri=="string"&&a.uri.startsWith("data:image/")===!1&&(h.name=a.uri);let d=(r.samplers||{})[o.sampler]||{};return h.magFilter=vm[d.magFilter]||It,h.minFilter=vm[d.minFilter]||Gn,h.wrapS=ym[d.wrapS]||Kt,h.wrapT=ym[d.wrapT]||Kt,h.generateMipmaps=!h.isCompressedTexture&&h.minFilter!==bt&&h.minFilter!==It,i.associations.set(h,{textures:e}),h}).catch(function(){return null});return this.textureCache[l]=c,c}loadImageSource(e,t){let n=this,i=this.json,r=this.options;if(this.sourceCache[e]!==void 0)return this.sourceCache[e].then(f=>f.clone());let o=i.images[e],a=self.URL||self.webkitURL,l=o.uri||"",c=!1;if(o.bufferView!==void 0)l=n.getDependency("bufferView",o.bufferView).then(function(f){c=!0;let d=new Blob([f],{type:o.mimeType});return l=a.createObjectURL(d),l});else if(o.uri===void 0)throw new Error("THREE.GLTFLoader: Image "+e+" is missing URI and bufferView");let h=Promise.resolve(l).then(function(f){return new Promise(function(d,u){let p=d;t.isImageBitmapLoader===!0&&(p=function(x){let m=new Ut(x);m.needsUpdate=!0,d(m)}),t.load(Ai.resolveURL(f,r.path),p,void 0,u)})}).then(function(f){return c===!0&&a.revokeObjectURL(l),di(f,o),f.userData.mimeType=o.mimeType||WM(o.uri),f}).catch(function(f){throw console.error("THREE.GLTFLoader: Couldn't load texture",l),f});return this.sourceCache[e]=h,h}assignTexture(e,t,n,i){let r=this;return this.getDependency("texture",n.index).then(function(o){if(!o)return null;if(n.texCoord!==void 0&&n.texCoord>0&&(o=o.clone(),o.channel=n.texCoord),r.extensions[rt.KHR_TEXTURE_TRANSFORM]){let a=n.extensions!==void 0?n.extensions[rt.KHR_TEXTURE_TRANSFORM]:void 0;if(a){let l=r.associations.get(o);o=r.extensions[rt.KHR_TEXTURE_TRANSFORM].extendTexture(o,a),r.associations.set(o,l)}}return i!==void 0&&(o.colorSpace=i),e[t]=o,o})}assignFinalMaterial(e){let t=e.geometry,n=e.material,i=t.attributes.tangent===void 0,r=t.attributes.color!==void 0,o=t.attributes.normal===void 0;if(e.isPoints){let a="PointsMaterial:"+n.uuid,l=this.cache.get(a);l||(l=new ar,$t.prototype.copy.call(l,n),l.color.copy(n.color),l.map=n.map,l.sizeAttenuation=!1,this.cache.add(a,l)),n=l}else if(e.isLine){let a="LineBasicMaterial:"+n.uuid,l=this.cache.get(a);l||(l=new Hi,$t.prototype.copy.call(l,n),l.color.copy(n.color),l.map=n.map,this.cache.add(a,l)),n=l}if(i||r||o){let a="ClonedMaterial:"+n.uuid+":";i&&(a+="derivative-tangents:"),r&&(a+="vertex-colors:"),o&&(a+="flat-shading:");let l=this.cache.get(a);l||(l=n.clone(),r&&(l.vertexColors=!0),o&&(l.flatShading=!0),i&&(l.normalScale&&(l.normalScale.y*=-1),l.clearcoatNormalScale&&(l.clearcoatNormalScale.y*=-1)),this.cache.add(a,l),this.associations.set(l,this.associations.get(n))),n=l}e.material=n}getMaterialType(){return Rt}loadMaterial(e){let t=this,n=this.json,i=this.extensions,r=n.materials[e],o,a={},l=r.extensions||{},c=[];if(l[rt.KHR_MATERIALS_UNLIT]){let f=i[rt.KHR_MATERIALS_UNLIT];o=f.getMaterialType(),c.push(f.extendParams(a,r,t))}else{let f=r.pbrMetallicRoughness||{};if(a.color=new Ee(1,1,1),a.opacity=1,Array.isArray(f.baseColorFactor)){let d=f.baseColorFactor;a.color.setRGB(d[0],d[1],d[2],fn),a.opacity=d[3]}f.baseColorTexture!==void 0&&c.push(t.assignTexture(a,"map",f.baseColorTexture,Mt)),a.metalness=f.metallicFactor!==void 0?f.metallicFactor:1,a.roughness=f.roughnessFactor!==void 0?f.roughnessFactor:1,f.metallicRoughnessTexture!==void 0&&(c.push(t.assignTexture(a,"metalnessMap",f.metallicRoughnessTexture)),c.push(t.assignTexture(a,"roughnessMap",f.metallicRoughnessTexture))),o=this._invokeOne(function(d){return d.getMaterialType&&d.getMaterialType(e)}),c.push(Promise.all(this._invokeAll(function(d){return d.extendMaterialParams&&d.extendMaterialParams(e,a)})))}r.doubleSided===!0&&(a.side=Ot);let h=r.alphaMode||qu.OPAQUE;if(h===qu.BLEND?(a.transparent=!0,a.depthWrite=!1):(a.transparent=!1,h===qu.MASK&&(a.alphaTest=r.alphaCutoff!==void 0?r.alphaCutoff:.5)),r.normalTexture!==void 0&&o!==Et&&(c.push(t.assignTexture(a,"normalMap",r.normalTexture)),a.normalScale=new ee(1,1),r.normalTexture.scale!==void 0)){let f=r.normalTexture.scale;a.normalScale.set(f,f)}if(r.occlusionTexture!==void 0&&o!==Et&&(c.push(t.assignTexture(a,"aoMap",r.occlusionTexture)),r.occlusionTexture.strength!==void 0&&(a.aoMapIntensity=r.occlusionTexture.strength)),r.emissiveFactor!==void 0&&o!==Et){let f=r.emissiveFactor;a.emissive=new Ee().setRGB(f[0],f[1],f[2],fn)}return r.emissiveTexture!==void 0&&o!==Et&&c.push(t.assignTexture(a,"emissiveMap",r.emissiveTexture,Mt)),Promise.all(c).then(function(){let f=new o(a);return r.name&&(f.name=r.name),di(f,r),t.associations.set(f,{materials:e}),r.extensions&&As(i,f,r),f})}createUniqueName(e){let t=yt.sanitizeNodeName(e||"");return t in this.nodeNamesUsed?t+"_"+ ++this.nodeNamesUsed[t]:(this.nodeNamesUsed[t]=0,t)}loadGeometries(e){let t=this,n=this.extensions,i=this.primitiveCache;function r(a){return n[rt.KHR_DRACO_MESH_COMPRESSION].decodePrimitive(a,t).then(function(l){return Mm(l,a,t)})}let o=[];for(let a=0,l=e.length;a<l;a++){let c=e[a],h=GM(c),f=i[h];if(f)o.push(f.promise);else{let d;c.extensions&&c.extensions[rt.KHR_DRACO_MESH_COMPRESSION]?d=r(c):d=Mm(new _t,c,t),c.mode===Nn.TRIANGLE_STRIP?d=d.then(u=>Uu(u,Wo)):c.mode===Nn.TRIANGLE_FAN&&(d=d.then(u=>Uu(u,_r))),i[h]={primitive:c,promise:d},o.push(d)}}return Promise.all(o)}loadMesh(e){let t=this,n=this.json,i=this.extensions,r=n.meshes[e],o=r.primitives,a=[];for(let l=0,c=o.length;l<c;l++){let h=o[l].material===void 0?zM(this.cache):this.getDependency("material",o[l].material);a.push(h)}return a.push(t.loadGeometries(o)),Promise.all(a).then(async function(l){let c=l.slice(0,l.length-1),h=l[l.length-1],f=[];for(let u=0,p=h.length;u<p;u++){let x=h[u],m=o[u],g,b=c[u];if(m.mode===Nn.TRIANGLES||m.mode===Nn.TRIANGLE_STRIP||m.mode===Nn.TRIANGLE_FAN||m.mode===void 0){let T=r.isSkinnedMesh===!0,_=x.hasAttribute("skinIndex")&&x.hasAttribute("skinWeight");T&&_===!1&&console.warn("THREE.GLTFLoader: Missing skinIndex or skinWeight attributes. Skinning disabled."),g=T&&_?new eo(x,b):new Re(x,b),g.isSkinnedMesh===!0&&g.normalizeSkinWeights()}else if(m.mode===Nn.LINES)g=new fs(x,b);else if(m.mode===Nn.LINE_STRIP)g=new ds(x,b);else if(m.mode===Nn.LINE_LOOP)g=new io(x,b);else if(m.mode===Nn.POINTS)g=new so(x,b);else throw new Error("THREE.GLTFLoader: Primitive mode unsupported: "+m.mode);Object.keys(g.geometry.morphAttributes).length>0&&VM(g,r),g.name=t.createUniqueName(r.name||"mesh_"+e),di(g,r),m.extensions&&As(i,g,m),t.assignFinalMaterial(g),f.push(g)}for(let u=0,p=f.length;u<p;u++)t.associations.set(f[u],{meshes:e,primitives:u});if(f.length===1)return r.extensions&&As(i,f[0],r),f[0];let d=new Bt;r.extensions&&As(i,d,r),t.associations.set(d,{meshes:e});for(let u=0,p=f.length;u<p;u++)d.add(f[u]);return d})}loadCamera(e){let t,n=this.json.cameras[e],i=n[n.type];if(!i){console.warn("THREE.GLTFLoader: Missing camera parameters.");return}return n.type==="perspective"?t=new Nt(Xo.radToDeg(i.yfov),i.aspectRatio||1,i.znear||1,i.zfar||2e6):n.type==="orthographic"&&(t=new Sn(-i.xmag,i.xmag,i.ymag,-i.ymag,i.znear,i.zfar)),n.name&&(t.name=this.createUniqueName(n.name)),di(t,n),Promise.resolve(t)}loadSkin(e){let t=this.json.skins[e],n=[];for(let i=0,r=t.joints.length;i<r;i++)n.push(this._loadNodeShallow(t.joints[i]));return t.inverseBindMatrices!==void 0?n.push(this.getDependency("accessor",t.inverseBindMatrices)):n.push(null),Promise.all(n).then(function(i){let r=i.pop(),o=i,a=[],l=[];for(let c=0,h=o.length;c<h;c++){let f=o[c];if(f){a.push(f);let d=new je;r!==null&&d.fromArray(r.array,c*16),l.push(d)}else console.warn('THREE.GLTFLoader: Joint "%s" could not be found.',t.joints[c])}return new to(a,l)})}loadAnimation(e){let t=this.json,n=this,i=t.animations[e],r=i.name?i.name:"animation_"+e,o=[],a=[],l=[],c=[],h=[];for(let f=0,d=i.channels.length;f<d;f++){let u=i.channels[f],p=i.samplers[u.sampler],x=u.target,m=x.node,g=i.parameters!==void 0?i.parameters[p.input]:p.input,b=i.parameters!==void 0?i.parameters[p.output]:p.output;x.node!==void 0&&(o.push(this.getDependency("node",m)),a.push(this.getDependency("accessor",g)),l.push(this.getDependency("accessor",b)),c.push(p),h.push(x))}return Promise.all([Promise.all(o),Promise.all(a),Promise.all(l),Promise.all(c),Promise.all(h)]).then(function(f){let d=f[0],u=f[1],p=f[2],x=f[3],m=f[4],g=[];for(let T=0,_=d.length;T<_;T++){let M=d[T],E=u[T],A=p[T],v=x[T],R=m[T];if(M===void 0)continue;M.updateMatrix&&M.updateMatrix();let N=n._createAnimationTracks(M,E,A,v,R);if(N)for(let L=0;L<N.length;L++)g.push(N[L])}let b=new yo(r,void 0,g);return di(b,i),b})}createNodeMesh(e){let t=this.json,n=this,i=t.nodes[e];return i.mesh===void 0?null:n.getDependency("mesh",i.mesh).then(function(r){let o=n._getNodeRef(n.meshCache,i.mesh,r);return i.weights!==void 0&&o.traverse(function(a){if(a.isMesh)for(let l=0,c=i.weights.length;l<c;l++)a.morphTargetInfluences[l]=i.weights[l]}),o})}loadNode(e){let t=this.json,n=this,i=t.nodes[e],r=n._loadNodeShallow(e),o=[],a=i.children||[];for(let c=0,h=a.length;c<h;c++)o.push(n.getDependency("node",a[c]));let l=i.skin===void 0?Promise.resolve(null):n.getDependency("skin",i.skin);return Promise.all([r,Promise.all(o),l]).then(function(c){let h=c[0],f=c[1],d=c[2];d!==null&&h.traverse(function(u){u.isSkinnedMesh&&u.bind(d,XM)});for(let u=0,p=f.length;u<p;u++)h.add(f[u]);if(h.userData.pivot!==void 0&&f.length>0){let u=h.userData.pivot,p=f[0];h.pivot=new D().fromArray(u),h.position.x-=u[0],h.position.y-=u[1],h.position.z-=u[2],p.position.set(0,0,0),delete h.userData.pivot}return h})}_loadNodeShallow(e){let t=this.json,n=this.extensions,i=this;if(this.nodeCache[e]!==void 0)return this.nodeCache[e];let r=t.nodes[e],o=r.name?i.createUniqueName(r.name):"",a=[],l=i._invokeOne(function(c){return c.createNodeMesh&&c.createNodeMesh(e)});return l&&a.push(l),r.camera!==void 0&&a.push(i.getDependency("camera",r.camera).then(function(c){return i._getNodeRef(i.cameraCache,r.camera,c)})),i._invokeAll(function(c){return c.createNodeAttachment&&c.createNodeAttachment(e)}).forEach(function(c){a.push(c)}),this.nodeCache[e]=Promise.all(a).then(function(c){let h;if(r.isBone===!0?h=new rr:c.length>1?h=new Bt:c.length===1?h=c[0]:h=new Ct,h!==c[0])for(let f=0,d=c.length;f<d;f++)h.add(c[f]);if(r.name&&(h.userData.name=r.name,h.name=o),di(h,r),r.extensions&&As(n,h,r),r.matrix!==void 0){let f=new je;f.fromArray(r.matrix),h.applyMatrix4(f)}else r.translation!==void 0&&h.position.fromArray(r.translation),r.rotation!==void 0&&h.quaternion.fromArray(r.rotation),r.scale!==void 0&&h.scale.fromArray(r.scale);if(!i.associations.has(h))i.associations.set(h,{});else if(r.mesh!==void 0&&i.meshCache.refs[r.mesh]>1){let f=i.associations.get(h);i.associations.set(h,{...f})}return i.associations.get(h).nodes=e,h}),this.nodeCache[e]}loadScene(e){let t=this.extensions,n=this.json.scenes[e],i=this,r=new Bt;n.name&&(r.name=i.createUniqueName(n.name)),di(r,n),n.extensions&&As(t,r,n);let o=n.nodes||[],a=[];for(let l=0,c=o.length;l<c;l++)a.push(i.getDependency("node",o[l]));return Promise.all(a).then(function(l){for(let h=0,f=l.length;h<f;h++){let d=l[h];d.parent!==null?r.add(gm(d)):r.add(d)}let c=h=>{let f=new Map;for(let[d,u]of i.associations)(d instanceof $t||d instanceof Ut)&&f.set(d,u);return h.traverse(d=>{let u=i.associations.get(d);u!=null&&f.set(d,u)}),f};return i.associations=c(r),r})}_createAnimationTracks(e,t,n,i,r){let o=[],a=e.name?e.name:e.uuid,l=[];function c(u){u.morphTargetInfluences&&l.push(u.name?u.name:u.uuid)}ts[r.path]===ts.weights?(c(e),e.isGroup&&e.children.forEach(c)):l.push(a);let h;switch(ts[r.path]){case ts.weights:h=wi;break;case ts.rotation:h=Ti;break;case ts.translation:case ts.scale:h=Wi;break;default:switch(n.itemSize){case 1:h=wi;break;case 2:case 3:default:h=Wi;break}break}let f=i.interpolation!==void 0?kM[i.interpolation]:cs,d=this._getArrayFromAccessor(n);for(let u=0,p=l.length;u<p;u++){let x=new h(l[u]+"."+ts[r.path],t.array,d,f);i.interpolation==="CUBICSPLINE"&&this._createCubicSplineTrackInterpolant(x),o.push(x)}return o}_getArrayFromAccessor(e){let t=e.array;if(e.normalized){let n=xd(t.constructor),i=new Float32Array(t.length);for(let r=0,o=t.length;r<o;r++)i[r]=t[r]*n;t=i}return t}_createCubicSplineTrackInterpolant(e){e.createInterpolant=function(n){let i=this instanceof Ti?md:Gc;return new i(this.times,this.values,this.getValueSize()/3,n)},e.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline=!0}};function qM(s,e,t){let n=e.attributes,i=new an;if(n.POSITION!==void 0){let a=t.json.accessors[n.POSITION],l=a.min,c=a.max;if(l!==void 0&&c!==void 0){if(i.set(new D(l[0],l[1],l[2]),new D(c[0],c[1],c[2])),a.normalized){let h=xd(Lr[a.componentType]);i.min.multiplyScalar(h),i.max.multiplyScalar(h)}}else{console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.");return}}else return;let r=e.targets;if(r!==void 0){let a=new D,l=new D;for(let c=0,h=r.length;c<h;c++){let f=r[c];if(f.POSITION!==void 0){let d=t.json.accessors[f.POSITION],u=d.min,p=d.max;if(u!==void 0&&p!==void 0){if(l.setX(Math.max(Math.abs(u[0]),Math.abs(p[0]))),l.setY(Math.max(Math.abs(u[1]),Math.abs(p[1]))),l.setZ(Math.max(Math.abs(u[2]),Math.abs(p[2]))),d.normalized){let x=xd(Lr[d.componentType]);l.multiplyScalar(x)}a.max(l)}else console.warn("THREE.GLTFLoader: Missing min/max properties for accessor POSITION.")}}i.expandByVector(a)}s.boundingBox=i;let o=new gn;i.getCenter(o.center),o.radius=i.min.distanceTo(i.max)/2,s.boundingSphere=o}function Mm(s,e,t){let n=e.attributes,i=[];function r(o,a){return t.getDependency("accessor",o).then(function(l){s.setAttribute(a,l)})}for(let o in n){let a=gd[o]||o.toLowerCase();a in s.attributes||i.push(r(n[o],a))}if(e.indices!==void 0&&!s.index){let o=t.getDependency("accessor",e.indices).then(function(a){s.setIndex(a)});i.push(o)}return tt.workingColorSpace!==fn&&"COLOR_0"in n&&console.warn(`THREE.GLTFLoader: Converting vertex colors from "srgb-linear" to "${tt.workingColorSpace}" not supported.`),di(s,e),qM(s,e,t),Promise.all(i).then(function(){return e.targets!==void 0?HM(s,e.targets,t):s})}var YM={"sofa.3seat":{file:"assets/models/loungeSofa.glb",slots:{carpet:"fabric_accent",wood:"wood_dark"}},"chair.basic":{file:"assets/models/chair.glb",slots:{wood:"wood_dark"}},"chair.office":{file:"assets/models/chairDesk.glb",slots:{carpet:"leather",metalMedium:"metal_dark"}},"table.dining":{file:"assets/models/table.glb",slots:{wood:"oak"}},"table.coffee":{file:"assets/models/tableCoffee.glb",slots:{wood:"wood_dark"}},"table.desk":{file:"assets/models/desk.glb",slots:{wood:"wood_light",metal:"metal_dark"}},"cabinet.tv":{file:"assets/models/cabinetTelevision.glb",slots:{wood:"wood_dark"}},"cabinet.bookcase":{file:"assets/models/bookcaseOpen.glb",slots:{wood:"wood_dark"}},"cabinet.wardrobe":{file:"assets/models/cabinetBed.glb",slots:{wood:"wood_light",metal:"metal_light"}},"cabinet.low":{file:"assets/models/cabinetBedDrawer.glb",slots:{wood:"wood_light",metal:"metal_light",_defaultMat:"wood_dark"}},"bed.double":{file:"assets/models/bedDouble.glb",slots:{wood:"wood_light",metal:"metal_light",carpetWhite:"linen",carpet:"fabric_grey"}},"bed.single":{file:"assets/models/bedSingle.glb",slots:{wood:"wood_light",metal:"metal_light",carpetWhite:"linen",carpet:"fabric_grey"}},"kitchen.fridge":{file:"assets/models/kitchenFridgeLarge.glb",slots:{metalLight:"metal_light",metalMedium:"metal_dark"}},"kitchen.island":{file:"assets/models/kitchenCabinet.glb",slots:{wood:"wood_light",woodDark:"concrete",metal:"metal_light"}},"plant.pot":{file:"assets/models/plantSmall1.glb",slots:{wood:"concrete",plant:"grass"}},"sanitary.wc":{file:"assets/models/toilet.glb",slots:{carpetWhite:"tiles_white",metalLight:"metal_light",metalDark:"metal_dark",_defaultMat:"tiles_white"}},"sanitary.basin":{file:"assets/models/bathroomSink.glb",slots:{carpetWhite:"tiles_white",metalLight:"metal_light",_defaultMat:"tiles_white"}},"sanitary.tub":{file:"assets/models/bathtub.glb",slots:{carpetWhite:"tiles_white",metalLight:"metal_light",metalDark:"metal_dark"}},"appliance.washer":{file:"assets/models/washerDryerStacked.glb",slots:{metalMedium:"metal_light",metalLight:"metal_light",metalDark:"metal_dark",metal:"metal_dark",glass:"metal_dark",_defaultMat:"metal_light"}}},Wc=class{constructor(e,t={}){this.lib=e,this.loader=new Hc,this.cache=new Map,this.pending=new Map,this.onLoaded=t.onLoaded||null,this.testModel=!!t.testModel,this.manifest=YM}template(e){if(this.cache.has(e))return this.cache.get(e);let t=this.manifest[e];if(!t)return this.cache.set(e,null),null;if(this.testModel){let n=this.makeTestModel(e);return this.cache.set(e,n),n}if(!this.pending.has(e)){let n=new Promise(i=>{this.loader.load(t.file,r=>{let o=r.scene;o.updateMatrixWorld(!0);let a=new an().setFromObject(o);this.cache.set(e,{scene:o,bbox:a,row:t}),i(!0),this.onLoaded&&this.onLoaded(e)},void 0,()=>{this.cache.set(e,null),i(!1)})});this.pending.set(e,n)}}makeTestModel(e){let t=this.manifest[e],n=new Bt,i=Object.keys(t.slots),r=new Re(new Xn(1,1,1,2,.08),new Rt({name:i[0]}));if(r.position.y=.5,n.add(r),i[1]){let o=new Re(new Xn(.9,.12,.9,2,.04),new Rt({name:i[1]}));o.position.y=1,n.add(o)}return n.updateMatrixWorld(!0),{scene:n,bbox:new an().setFromObject(n),row:t,test:!0}}place(e,t,n,i,r,o,a,l,c){let h=this.template(e);if(!h)return!1;let f=3,d=h.scene.clone(!0),u=new D;h.bbox.getSize(u);let{w_m:p,d_m:x,h_m:m}=t.size,g=new D(u.x>1e-6?p/u.x:1,u.y>1e-6?m/u.y:1,u.z>1e-6?x/u.z:1),b=Math.min(g.x,g.y,g.z),T=Math.min(g.x,b*1.15),_=Math.min(g.y,b*1.15),M=Math.min(g.z,b*1.15),E=new D;h.bbox.getCenter(E),d.traverse(v=>{if(!v.isMesh)return;let R=v.material&&v.material.name,N=h.row.slots&&h.row.slots[R]||"wood_light";v.material=this.lib.get(N,f),v.castShadow=!0,v.receiveShadow=!0,v.userData={kind:"model",item:e}});let A=new Bt;return A.add(d),d.position.set(-E.x*T,-h.bbox.min.y*_,-E.z*M),d.scale.set(T,_,M),A.position.set(n,i,r),A.rotation.y=o,A.userData={kind:"model",item:e,test:!!h.test},a.add(A),!0}};var Xc={3:"\u05E8\u05D9\u05D0\u05DC\u05D9\u05E1\u05D8\u05D9",2:"\u05DE\u05DC\u05D0",1:"\u05E1\u05DB\u05DE\u05D8\u05D9",0:"\u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DE\u05D5\u05DB\u05E0\u05D5\u05EA"},qc="\u05E8\u05D9\u05D0\u05DC\u05D9\u05E1\u05D8\u05D9 \u05E7\u05DC",Yc=[[3,!1],[3,!0],[2,!1],[1,!1],[0,!1]],Sm=[["clear","\u05D1\u05D4\u05D9\u05E8"],["hazy","\u05D0\u05D5\u05D1\u05DA"],["overcast","\u05DE\u05E2\u05D5\u05E0\u05DF"]],vd=30,yd=2500,jM=30,qe=s=>document.getElementById(s),se=(s,e,t)=>{let n=document.createElement(s);return e&&(n.className=e),t!==void 0&&(n.textContent=t),n},ZM={id:"fixture-sample-v2",title:"sample-v2.json (\u05E7\u05D5\u05D1\u05E5 \u05D4\u05D1\u05D3\u05D9\u05E7\u05D4 \u05E9\u05DC \u05D4\u05E8\u05D9\u05E4\u05D5)",doc:mm,zones:[],anchors:[],entities:{"light.store":"on","switch.hall_a":"on","lock.store":"locked"},coverPositions:{},entityNames:{"light.store":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05DE\u05D7\u05E1\u05DF","lock.store":"\u05DE\u05E0\u05E2\u05D5\u05DC \u05DE\u05D7\u05E1\u05DF"},doorLocks:{}},jc=[pm,ZM],Zc=class{constructor(e={}){this.stage=qe("stage"),this.canvas=qe("gl"),this.env=new Bc(this.canvas,{maxDpr:2}),this.env.backdrop=this.stage,this.styleChoice=(()=>{try{return localStorage.getItem("studio6.style")||"auto"}catch{return"auto"}})(),this.style=this.resolveStyle(),this.env.style=this.style,this.settings=Object.assign({eyeHeight:nm,mouseMode:"drag",furnitureMode:"models",textureSource:"files",defaultView:"schematic",wallDisplay:"live",timeSource:"clock",showTemps:!1,sectionCut:!0,motion:!0},(()=>{try{return JSON.parse(localStorage.getItem("studio6.settings")||"{}")}catch{return{}}})()),/[?&]procedural/.test(location.search)&&(this.settings.textureSource="procedural",this.settings.furnitureMode="procedural"),this.lib=new bc(this.style,{textureSource:this.settings.textureSource,onLoaded:()=>this.invalidate()}),this.planScene=new Ac(this.lib),this.hudOn=/[?&]hud/.test(location.search),this.planScene._reflector={Reflector:Zo},this.env.scene.add(this.planScene.root),this.planScene.models=new Wc(this.lib,{onLoaded:()=>{this.rebuild(),this.makeThumbs()},testModel:/[?&]testmodels/.test(location.search)}),this.baker=new zc(this.env,this.planScene),this.quality=3,this.lite=!1,this.mode="orbit",this.levelMode=null,this.preset="iso",this.opts={reflections:!1,ao:!0,bloom:!0,lampShadows:!1,autoLadder:!0,dprCap:1.25,idleS:jM,pointerLock:!1},this.tween=null,this.planScene.furnitureMode=this.settings.furnitureMode,this.fps={ema:0,ms:0,frames:0,last:performance.now(),window:[]},this.needsFrame=!0,this.continuous=!1,this.lastInput=performance.now(),this.touch=!1,this.hover=null,this.raycaster=new Ao,this.walk=null,this.savedPositions=[],this.probe=null,this.fallbackNote=null,this.bakes={},this.thumbs={},this.presenceTimers={},this.setupCameras(),this.bindUI(),e.defer||this.boot()}boot(){this.loadPlan(jc[0]),this.resize(),window.addEventListener("resize",()=>this.resize()),requestAnimationFrame(e=>this.frame(e))}resolveStyle(){return this.styleChoice==="auto"?Wp(document.documentElement.dataset.theme):vn[this.styleChoice]||vn.light}setStyle(e){this.styleChoice=e;try{localStorage.setItem("studio6.style",e)}catch{}this.style=this.resolveStyle(),this.planScene.setStyle(this.style),this.env.setStyle(this.style),this.env.buildComposer(this.camera),this.planScene.setNight(this.env.recipe.night),this.applyCut(),document.documentElement.dataset.style=this.style.id,this.renderStyleChip&&this.renderStyleChip(),this.makeThumbs(),this.invalidate()}applyCut(){if(this.mode!=="orbit"||this.quality<2||!this.plan||!this.settings.sectionCut){this.planScene.setCut(null);return}let e=this.plan.doc.levels.map(i=>i.id),t=this.levelMode==="all"||!this.levelMode?e[e.length-1]:this.levelMode,n=this.planScene.levels[t];if(!n){this.planScene.setCut(null);return}this.planScene.setCut(n.elevation+n.ceiling*this.style.cut.fraction,t),this.shadowDirty=!0}setupCameras(){this.persp=new Nt(42,1,.05,300),this.ortho=new Sn(-10,10,10,-10,-100,300),this.walkCam=new Nt(62,1,.05,200),this.camera=this.ortho,this.controls=null}makeControls(e){this.controls&&this.controls.dispose();let t=new vc(e,this.canvas);t.enableDamping=!0,t.dampingFactor=.12,t.maxPolarAngle=Math.PI/2-.03,t.minDistance=2,t.maxDistance=120,t.addEventListener("change",()=>this.invalidate(!1)),t.addEventListener("start",()=>this.userInput()),this.controls=t}saveSettings(){try{localStorage.setItem("studio6.settings",JSON.stringify(this.settings))}catch{}}fitCamera(e,t=this.settings.motion&&!!this.plan&&this.mode==="orbit"){let n=this.camera&&this.controls?{cam:this.camera,pos:this.camera.position.clone(),target:this.controls.target.clone(),half:this.ortho.top}:null;if(this.fitCameraNow(e),!t||!n)return;if(n.cam!==this.camera){this.flash(.6);return}let i={pos:this.camera.position.clone(),target:this.controls.target.clone(),half:this.ortho.top},r=this.camera,o=this.controls,a=this.canvas.clientWidth/Math.max(1,this.canvas.clientHeight);this.tween={t0:performance.now(),ms:520,step:l=>{if(r.position.lerpVectors(n.pos,i.pos,l),o.target.lerpVectors(n.target,i.target,l),r===this.ortho){let c=n.half+(i.half-n.half)*l;r.left=-c*a,r.right=c*a,r.top=c,r.bottom=-c,r.updateProjectionMatrix()}o.update()}},o.enabled=!1}flash(e=.5){if(!this.settings.motion)return;let t=qe("fade");t.style.transition="opacity .12s",t.style.opacity=String(e),setTimeout(()=>{t.style.transition="opacity .28s cubic-bezier(.2,.7,.2,1)",t.style.opacity="0"},130)}fitCameraNow(e){this.preset=e;let t=this.visibleExtent(),n=(t.minX+t.maxX)/2,i=(t.minZ+t.maxZ)/2,r=t.maxX-t.minX,o=t.maxZ-t.minZ,a=t.top,l=Math.hypot(r,o,a)/2,c=new D(n,t.base+a*.35,i),h;if(e==="persp"){h=this.persp;let f=l/Math.tan(h.fov*Math.PI/360)*1.15;h.position.set(n+f*.62,c.y+f*.55,i+f*.62)}else if(e==="top")h=this.ortho,h.position.set(n,c.y+60,i+.001);else{h=this.ortho;let f=60;h.position.set(n+f*.577,c.y+f*.577,i+f*.577)}if(h===this.ortho){let f=this.canvas.clientWidth/Math.max(1,this.canvas.clientHeight),d=l*1.08;h.left=-d*f,h.right=d*f,h.top=d,h.bottom=-d,h.zoom=1,h.updateProjectionMatrix()}h.lookAt(c),this.camera=h,this.makeControls(h),this.controls.target.copy(c),this.controls.update(),this.env.setCamera(h),this.invalidate()}visibleExtent(){let e=Object.values(this.planScene.levels).filter(i=>i.group.visible&&i.extent),t=e.length?e:Object.values(this.planScene.levels).filter(i=>i.extent),n={minX:1/0,maxX:-1/0,minZ:1/0,maxZ:-1/0,base:1/0,top:0};for(let i of t)n.minX=Math.min(n.minX,i.extent.minX),n.maxX=Math.max(n.maxX,i.extent.maxX),n.minZ=Math.min(n.minZ,i.extent.minZ),n.maxZ=Math.max(n.maxZ,i.extent.maxZ),n.base=Math.min(n.base,i.elevation),n.top=Math.max(n.top,i.elevation+i.ceiling);return Number.isFinite(n.minX)?n:{minX:0,maxX:10,minZ:0,maxZ:10,base:0,top:3}}resize(){let e=this.stage.getBoundingClientRect(),t=Math.max(1,Math.round(e.width)),n=Math.max(1,Math.round(e.height));this.env.dpr=Math.min(this.quality===3&&this.lite?1:this.opts.dprCap,window.devicePixelRatio||1),this.env.renderer.setPixelRatio(this.env.dpr),this.env.setSize(t,n);for(let i of[this.persp,this.walkCam])i.aspect=t/n,i.updateProjectionMatrix();if(this.ortho){let i=this.ortho.top;this.ortho.left=-i*(t/n),this.ortho.right=i*(t/n),this.ortho.updateProjectionMatrix()}this.invalidate()}loadPlan(e){this.plan=e,this.entities={...e.entities},this.coverPositions={...e.coverPositions||{}},e.entities=this.entities,e.coverPositions=this.coverPositions,qe("crumb-floor").textContent=e.title;let t=e.doc.x_proto||{};this.env.setTime({north:t.north_deg||0,latitude:t.latitude||32}),this.savedPositions=(t.walk_positions||[]).map(i=>({...i})),this.bakes={},this.rebuild();let n=e.doc.levels.find(i=>i.is_default)||e.doc.levels[0];this.setLevelMode(n.id),this.fitCamera("iso"),this.buildStatesPanel(),this.buildWalkPanel(),this.buildQualityPanel(),this.buildStrip(),this.makeThumbs(),this.startProbe()}qualityLabel(){return this.quality===3&&this.lite?qc:Xc[this.quality]}rebuild(){if(this.quality===0)return;let e=this.quality===3&&this.lite;this.planScene.maxLights=this.quality>=3?8:6,this.planScene.lite=e,this.planScene.build(this.plan,this.quality,{reflections:this.opts.reflections&&this.quality>=3&&!e&&!this.touch,lampShadows:this.opts.lampShadows&&this.quality>=3&&!e&&!this.touch});let t=this.visibleExtent();this.env.post.lite=e,this.env.fitShadows(t,t.top),this.env.setQuality(this.quality,this.camera||this.ortho),this.resize(),this.walk&&(this.walk.scene=this.planScene),this.planScene.showLevel(this.levelMode||"all",this.mode==="walk"),this.planScene.setNight(this.env.recipe.night),this.applyCut(),this.invalidate()}setLevelMode(e){if(this.levelMode=e,this.planScene.showLevel(e,this.mode==="walk"),this.applyCut(),this.buildStrip(),this.invalidate(),this.mode==="orbit"){let t=this.visibleExtent();this.env.fitShadows(t,t.top)}this.mode==="stills"&&this.showStills()}setQuality(e,t,n=!1){if(e===this.quality&&n===this.lite)return;let i=this.quality,r=this.lite;if(this.quality=e,this.lite=e===3&&n,e===0){if(!this.bakes[this.currentLevelId()]){this.quality=i,this.lite=r,this.toast("\u05D0\u05D9\u05DF \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DE\u05D5\u05DB\u05E0\u05D5\u05EA \u05DC\u05E7\u05D5\u05DE\u05D4 \u2014 \u05D4\u05DB\u05DF \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05EA\u05D7\u05D9\u05DC\u05D4");return}this.lastLiveQuality=i,this.lastLiveLite=r,this.enterStills()}else this.mode==="stills"&&this.exitStills(!1),this.rebuild(),this.makeThumbs();this.renderBar(),this.renderLadder(),t&&this.setNote(t),e>0&&this.startProbe()}startProbe(){!this.opts.autoLadder||this.quality===0||(this.probe={start:null,frames:0,warm:0},this.continuous=!0,this.invalidate())}probeFrame(e){let t=this.probe;if(!t)return;if(t.warm<3){t.warm++;return}if(t.start===null){t.start=e,t.frames=0;return}t.frames++;let n=e-t.start;if(n>=yd){let i=t.frames*1e3/n;this.probe=null,this.continuous=this.mode==="walk",this.lastProbe={fps:Math.round(i),quality:this.quality,label:this.qualityLabel()};let r=Yc.findIndex(([a,l])=>a===this.quality&&l===this.lite),o=Yc[r+1];if(i<vd&&o&&(o[0]>0||this.bakes[this.currentLevelId()])){let a=this.qualityLabel(),l=o[0]===3&&o[1]?qc:Xc[o[0]];this.fallbackNote=`${a} \u05E0\u05DE\u05D3\u05D3 ${Math.round(i)} fps (\u05DE\u05EA\u05D7\u05EA \u05DC\u05BE${vd}) \u2014 \u05D9\u05E8\u05D3\u05E0\u05D5 \u05DC"${l}" \u05DC\u05D4\u05DE\u05E9\u05DA \u05D4\u05D4\u05E4\u05E2\u05DC\u05D4`,this.setQuality(o[0],this.fallbackNote,o[1]),this.stage.dataset.fallback=String(r+1)}else this.setNote(`${this.qualityLabel()} \xB7 \u05E0\u05DE\u05D3\u05D3 ${Math.round(i)} fps \u05D1\u05BE${yd/1e3} \u05E9\u05F3 \u2014 \u05E0\u05E9\u05D0\u05E8`);this.renderLadder()}}setNote(e,t=!1,n=6e3){let i=qe("note");i.hidden=!e,i.textContent=e||"",i.classList.toggle("danger",t),clearTimeout(this._noteT),e&&!t&&n>0&&(this._noteT=setTimeout(()=>{i.hidden=!0},n))}toast(e){this.setNote(e,!1,3500)}toOrbit(e){if(this.mode==="walk"){this.orbitState={...this.orbitState||{},preset:e},this.exitWalk();return}this.mode==="stills"&&this.exitStills(!0),this.fitCamera(e),this.renderBar()}bindUI(){let e=qe("plan-select");for(let l of jc){let c=se("option","",l.title);c.value=l.id,e.appendChild(c)}e.addEventListener("change",()=>{this.mode==="walk"&&this.exitWalk(),this.mode==="stills"&&this.exitStills(!1),this.loadPlan(jc.find(l=>l.id===e.value))}),qe("theme-toggle").addEventListener("click",()=>{let l=document.documentElement;l.dataset.theme=l.dataset.theme==="dark"?"":"dark",this.styleChoice==="auto"&&this.setStyle("auto")});let t=qe("style-select");if(t){for(let[l,c]of[["auto","\u05E1\u05D2\u05E0\u05D5\u05DF: \u05DC\u05E4\u05D9 \u05E2\u05E8\u05DB\u05EA \u05E0\u05D5\u05E9\u05D0"],["light",`\u05E1\u05D2\u05E0\u05D5\u05DF: ${vn.light.name}`],["dark",`\u05E1\u05D2\u05E0\u05D5\u05DF: ${vn.dark.name}`]]){let h=se("option","",c);h.value=l,t.appendChild(h)}t.value=this.styleChoice,t.addEventListener("change",()=>this.setStyle(t.value)),this.renderStyleChip=()=>{t.value=this.styleChoice}}document.documentElement.dataset.style=this.style.id,qe("hud").classList.toggle("on",this.hudOn);let i=qe("sun-slider");i.addEventListener("input",()=>{this.env.setTime({hour:i.value/60}),this.updateSunCard(),this.invalidate(),this.userInput()}),qe("sun-now").addEventListener("click",()=>{let l=new Date;i.value=l.getHours()*60+l.getMinutes();let c=new Date(l.getFullYear(),0,0);this.env.setTime({hour:i.value/60,day:Math.floor((l-c)/864e5)}),this.updateSunCard(),this.invalidate()});let r=qe("weather");for(let[l,c]of Sm){let h=se("button","chip",c);h.dataset.w=l,h.addEventListener("click",()=>{this.env.setTime({weather:l}),this.updateSunCard(),this.invalidate()}),r.appendChild(h)}for(let[l,c]of[["\u05E6\u05D4\u05E8\u05D9\u05D9\u05DD",12.5],["\u05E9\u05E7\u05D9\u05E2\u05D4",18.2],["\u05DC\u05D9\u05DC\u05D4",22.5]]){let h=se("button","chip",l);h.addEventListener("click",()=>{i.value=c*60,this.env.setTime({hour:c}),this.updateSunCard(),this.invalidate()}),r.appendChild(h)}this.env.onTime=()=>{this.updateSunCard(),this.planScene&&this.planScene.setNight(this.env.recipe.night)},this.env.setTime({hour:i.value/60,day:278}),document.querySelectorAll(".tabs button").forEach(l=>l.addEventListener("click",()=>{document.querySelectorAll(".tabs button").forEach(c=>c.classList.toggle("sel",c===l)),document.querySelectorAll(".panel").forEach(c=>c.classList.toggle("sel",c.dataset.panel===l.dataset.tab))})),qe("mobile-toggle").addEventListener("click",()=>qe("aside").classList.toggle("open")),qe("sheet-handle").addEventListener("click",()=>qe("aside").classList.remove("open")),qe("sun-row").addEventListener("click",l=>{l.target.id!=="sun-now"&&qe("sun-card").classList.toggle("open")}),qe("labels").classList.toggle("temps",!!this.settings.showTemps);let o=qe("fabs"),a=(l,c,h,f="")=>{let d=se("button","fab "+f,l);return d.title=c,d.addEventListener("click",h),o.insertBefore(d,o.firstChild),d};this.fabExit=a("\u2715","\u05D9\u05E6\u05D9\u05D0\u05D4 \u05DE\u05D4\u05E1\u05D9\u05D5\u05E8",()=>this.exitWalk(),"walk-only"),this.fabPos=a("\u293C","\u05D4\u05E2\u05DE\u05D3\u05D4 \u05D4\u05E9\u05DE\u05D5\u05E8\u05D4 \u05D4\u05D1\u05D0\u05D4",()=>{this.savedPositions.length&&(this.posIdx=((this.posIdx??-1)+1)%this.savedPositions.length,this.gotoPosition(this.savedPositions[this.posIdx]))},"walk-only"),qe("kiosk-exit").addEventListener("click",l=>{l.preventDefault(),this.exitStills(!0)}),this.renderBar(),this.bindStageInput(),window.addEventListener("pointerdown",l=>{l.pointerType==="touch"&&(this.touch=!0,this.stage.classList.add("touch"))})}updateSunCard(){let e=this.env.time,t=this.env.sunInfo;qe("sun-time").textContent=om(e.hour);let n=Sm.find(r=>r[0]===e.weather),i=t?t.azimuth<90?"\u05DE\u05D6\u05E8\u05D7":t.azimuth<180?"\u05D3\u05E8\u05D5\u05DD\u05BE\u05DE\u05D6\u05E8\u05D7":t.azimuth<270?"\u05D3\u05E8\u05D5\u05DD\u05BE\u05DE\u05E2\u05E8\u05D1":"\u05DE\u05E2\u05E8\u05D1":"";qe("sun-info").textContent=t?`${t.elevation>0?`\u05E9\u05DE\u05E9 \u05DE${i} \xB7 \u05D2\u05D5\u05D1\u05D4 ${t.elevation.toFixed(0)}\xB0`:"\u05DC\u05D9\u05DC\u05D4 \xB7 \u05D4\u05E9\u05DE\u05E9 \u05DE\u05EA\u05D7\u05EA \u05DC\u05D0\u05D5\u05E4\u05E7"} \xB7 ${am(e.day)} \xB7 \u05E6\u05E4\u05D5\u05DF \u05D4\u05EA\u05D5\u05DB\u05E0\u05D9\u05EA ${e.north}\xB0 \xB7 ${n?n[1]:""}`:"",document.querySelectorAll("#weather .chip[data-w]").forEach(r=>r.classList.toggle("sel",r.dataset.w===e.weather))}renderBar(){let e=qe("bar");if(e.innerHTML="",!this.plan)return;let t=(i,r,o,a)=>{let l=se("button","chip"+(r?" sel":""),i);return a&&(l.title=a),l.addEventListener("click",o),e.appendChild(l),l};t("\u05DE\u05DC\u05DE\u05E2\u05DC\u05D4",this.preset==="top"&&this.mode==="orbit",()=>this.toOrbit("top")),t("\u05D0\u05D9\u05D6\u05D5\u05DE\u05D8\u05E8\u05D9",this.preset==="iso"&&this.mode==="orbit",()=>this.toOrbit("iso")),t("\u05E4\u05E8\u05E1\u05E4\u05E7\u05D8\u05D9\u05D1\u05D4",this.preset==="persp"&&this.mode==="orbit",()=>this.toOrbit("persp")),e.appendChild(se("span","sep")),t("\u05E1\u05D9\u05D5\u05E8",this.mode==="walk",()=>this.mode==="walk"?this.exitWalk():this.enterWalk(),"\u05E1\u05D9\u05D5\u05E8 \u05D1\u05D2\u05D5\u05D1\u05D4 \u05E2\u05D9\u05DF"),e.appendChild(se("span","sep"));let n=document.createElement("select");n.className="chip",n.setAttribute("aria-label","\u05D0\u05D9\u05DB\u05D5\u05EA");for(let[i,r]of Yc){let o=se("option","",i===3&&r?qc:Xc[i]);o.value=`${i}|${r?1:0}`,i===0&&!this.bakes[this.currentLevelId()]&&(o.disabled=!0),this.quality===i&&this.lite===r&&(o.selected=!0),n.appendChild(o)}n.addEventListener("change",()=>{let[i,r]=n.value.split("|");this.setQuality(+i,null,r==="1")}),e.appendChild(n)}buildStrip(){let e=qe("strip");e.innerHTML="";let t=this.plan.doc.levels.slice().reverse(),n=(i,r)=>{let o=se("button",this.levelMode===i?"sel":""),a=se("span","pic");if(this.thumbs[i]){let h=document.createElement("img");h.src=this.thumbs[i],a.appendChild(h)}let l=se("span","dots"),c=this.planScene.levels[i];if(c){let h=c.zones.some(u=>u.x_proto&&this.entities[u.x_proto.light]==="on"),f=c.zones.some(u=>u.x_proto&&u.x_proto.presence&&this.entities[u.x_proto.presence]==="on"),d=this.planScene.markers.some(u=>u.group.parent===c.group&&u.group.visible);if(h){let u=se("i");u.style.background="var(--sw-map-lit)",l.appendChild(u)}if(f){let u=se("i");u.style.background="var(--sw-map-presence)",l.appendChild(u)}if(d){let u=se("i");u.style.background="var(--sw-danger)",l.appendChild(u)}}a.appendChild(l),o.appendChild(a),o.appendChild(document.createTextNode(r)),o.addEventListener("click",()=>{this.mode==="walk"||this.levelMode===i||(this.flash(.45),this.setLevelMode(i),this.fitCamera(this.preset))}),e.appendChild(o)};for(let i of t)n(i.id,i.name);n("all","\u05DB\u05DC \u05D4\u05E7\u05D5\u05DE\u05D5\u05EA")}async makeThumbs(){if(this.quality===0)return;let e=this.levelMode;for(let t of this.plan.doc.levels){this.planScene.showLevel(t.id,!1);let n=new Sn(-10,10,10,-10,-100,300),i=this.visibleExtent(),r=(i.minX+i.maxX)/2,o=(i.minZ+i.maxZ)/2,a=Math.hypot(i.maxX-i.minX,i.maxZ-i.minZ)/2*1.05;n.left=-a*1.6,n.right=a*1.6,n.top=a,n.bottom=-a,n.position.set(r+40,i.base+40,o+40),n.lookAt(r,i.base+1,o),n.updateProjectionMatrix(),this.planScene.update(.016,n.position,{nightFactor:this.env.recipe.night,lampShadows:!1}),this.thumbs[t.id]=this.baker.thumbnail(n,208,112)}this.planScene.showLevel(e,this.mode==="walk"),this.buildStrip(),this.invalidate()}currentLevelId(){return this.mode==="walk"&&this.walk?this.walk.level:this.levelMode==="all"||!this.levelMode?this.plan.doc.levels[0].id:this.levelMode}buildStatesPanel(){let e=qe("panel-states");e.innerHTML="";let t=this.plan.entityNames||{},n=(h,f,d=["on"],u="off",p="on")=>{let x=se("button","sw "+(f||"")),m=()=>x.classList.toggle("on",d.includes(this.entities[h]));return m(),x.addEventListener("click",()=>{this.setEntity(h,d.includes(this.entities[h])?u:p),m()}),x.dataset.entity=h,this._syncs=this._syncs||[],this._syncs.push(m),x},i=se("div","pcard");i.appendChild(se("h3","","\u05EA\u05E8\u05D7\u05D9\u05E9\u05D9\u05DD"));let r=se("div","actions");r.style.display="flex",r.style.gap="6px",r.style.flexWrap="wrap";let o=(h,f)=>{let d=se("button","btn sm",h);d.addEventListener("click",()=>{f(),this.syncPanel()}),r.appendChild(d)};o("\u05D4\u05DB\u05D5\u05DC \u05DB\u05D1\u05D5\u05D9",()=>this.setMany(h=>h.startsWith("light."),"off")),o("\u05E2\u05E8\u05D1 \u05D1\u05D1\u05D9\u05EA",()=>{this.setMany(h=>h.startsWith("light."),"on"),qe("sun-slider").value=1140,this.env.setTime({hour:19}),this.updateSunCard()}),o("\u05DC\u05D9\u05DC\u05D4",()=>{this.setMany(h=>h.startsWith("light."),"off"),this.setEntity("light.hall","on"),this.setEntity("light.upper_corridor","on"),qe("sun-slider").value=1380,this.env.setTime({hour:23}),this.updateSunCard()}),o("\u05E4\u05EA\u05D7 \u05D4\u05DB\u05D5\u05DC",()=>this.setMany(h=>h.startsWith("binary_sensor.")&&h.endsWith("_door"),"on")),o("\u05E1\u05D2\u05D5\u05E8 \u05D4\u05DB\u05D5\u05DC",()=>this.setMany(h=>h.startsWith("binary_sensor.")&&h.endsWith("_door"),"off")),i.appendChild(r),e.appendChild(i),this.treeCollapsed=this.treeCollapsed||{};for(let h of this.plan.doc.levels){let f=se("div","pcard tree"+(this.treeCollapsed[h.id]?" collapsed":"")),d=se("h3");d.appendChild(se("span","tw","\u25BC")),d.appendChild(document.createTextNode(h.name)),d.appendChild(se("span","muted",`\u05DE\u05E4\u05DC\u05E1 ${h.elevation_m.toFixed(1)} \u05DE\u05F3`)),d.addEventListener("click",()=>{this.treeCollapsed[h.id]=!this.treeCollapsed[h.id],f.classList.toggle("collapsed",this.treeCollapsed[h.id])}),f.appendChild(d);let u=se("div","body");f.appendChild(u);let p=this.plan.zones.filter(x=>x.level_id===h.id);p.length||u.appendChild(se("div","help","\u05D0\u05D9\u05DF \u05D7\u05D3\u05E8\u05D9\u05DD \u05DE\u05D5\u05D2\u05D3\u05E8\u05D9\u05DD \u05D1\u05E7\u05D5\u05D1\u05E5 \u05D6\u05D4 \u2014 \u05D4\u05DE\u05E6\u05D1\u05D9\u05DD \u05DE\u05EA\u05D5\u05DA \u05D4\u05D9\u05E9\u05D5\u05D9\u05D5\u05EA \u05D1\u05DC\u05D1\u05D3."));for(let x of p){let m=se("div","room"),g=se("div","name",x.name);x.x_proto&&typeof x.x_proto.temp=="number"&&g.appendChild(se("span","t",`${x.x_proto.temp.toFixed(1)}\xB0`)),g.style.cursor="pointer",g.title="\u05E2\u05DE\u05D5\u05D3 \u05D1\u05D7\u05D3\u05E8",g.addEventListener("click",()=>{let T=this.planScene.levels[h.id],_=T&&T.zones.find(M=>M.id===x.id);_&&this.standInRoom(T,_)}),m.appendChild(g);let b=x.x_proto||{};if(b.light){let T=se("div","dev");T.appendChild(se("span","lbl2",t[b.light]||b.light)),T.appendChild(n(b.light)),m.appendChild(T)}for(let T of this.planScene.lamps.filter(_=>_.level===h.id&&_.entity!==b.light&&this.lampInZone(_,x))){let _=se("div","dev");_.appendChild(se("span","lbl2",t[T.entity]||T.entity)),_.appendChild(n(T.entity)),m.appendChild(_)}if(b.presence){let T=se("div","dev");T.appendChild(se("span","lbl2",t[b.presence]||b.presence));let _=se("button","btn sm","\u05D3\u05DE\u05D4 \u05EA\u05E0\u05D5\u05E2\u05D4");_.addEventListener("click",()=>this.pulsePresence(b.presence)),T.appendChild(_),T.appendChild(n(b.presence,"")),m.appendChild(T)}u.appendChild(m)}e.appendChild(f)}let a=se("div","pcard");a.appendChild(se("h3","","\u05D3\u05DC\u05EA\u05D5\u05EA \u05D5\u05DE\u05E0\u05E2\u05D5\u05DC\u05D9\u05DD"));for(let h of this.plan.doc.openings.filter(f=>f.kind==="door"&&f.anchor_ref)){let f=h.anchor_ref.resource_id,d=se("div","dev");d.appendChild(se("span","lbl2",t[f]||f)),f.startsWith("lock.")?d.appendChild(n(f,"danger",["locked"],"unlocked","locked")):d.appendChild(n(f,"danger",["on","open"],"off","on")),a.appendChild(d);let u=this.plan.doorLocks&&this.plan.doorLocks[h.id];if(u){let p=se("div","dev");p.appendChild(se("span","lbl2",t[u]||u)),p.appendChild(n(u,"danger",["locked"],"unlocked","locked")),a.appendChild(p)}}e.appendChild(a);let l=Object.keys(this.entities).filter(h=>h.startsWith("cover."));if(l.length){let h=se("div","pcard");h.appendChild(se("h3","","\u05EA\u05E8\u05D9\u05E1\u05D9\u05DD"));for(let f of l){let d=se("div","dev");d.appendChild(se("span","lbl2",t[f]||f));let u=document.createElement("input");u.type="range",u.min=0,u.max=100,u.className="pos",u.value=this.coverPositions[f]??(this.entities[f]==="open"?100:0),u.addEventListener("input",()=>{this.coverPositions[f]=+u.value,this.setEntity(f,+u.value>0?"open":"closed")}),d.appendChild(u),h.appendChild(d)}e.appendChild(h)}let c=Object.keys(this.entities).filter(h=>h.startsWith("media_player."));if(c.length){let h=se("div","pcard");h.appendChild(se("h3","","\u05DE\u05D3\u05D9\u05D4"));for(let f of c){let d=se("div","dev");d.appendChild(se("span","lbl2",t[f]||f)),d.appendChild(n(f,"",["playing","on"],"off","playing")),h.appendChild(d)}e.appendChild(h)}}lampInZone(e,t){let n=t.polygon.map(i=>this.planScene.toM([i.x,i.y]));return Ri(e.pos.x,e.pos.z,n)}syncPanel(){for(let e of this._syncs||[])e();this.buildStrip()}setMany(e,t){for(let n of Object.keys(this.entities))e(n)&&(this.entities[n]=t);this.applyStates()}setEntity(e,t){this.entities[e]=t,this.applyStates(),this.syncPanel()}applyStates(){this.planScene.setStates(this.entities,this.coverPositions),this.invalidate(),this.mode==="stills"&&this.showStills(),this.walk&&(this.walk.path=null)}pulsePresence(e){this.setEntity(e,"on"),clearTimeout(this.presenceTimers[e]),this.presenceTimers[e]=setTimeout(()=>this.setEntity(e,"off"),12e3)}buildWalkPanel(){let e=qe("panel-walk");e.innerHTML="";let t=se("div","pcard");t.appendChild(se("h3","","\u05E1\u05D9\u05D5\u05E8 \u05D1\u05D2\u05D5\u05D1\u05D4 \u05E2\u05D9\u05DF"));let n=se("button","btn primary",this.mode==="walk"?"\u05D9\u05E6\u05D9\u05D0\u05D4 \u05DE\u05D4\u05E1\u05D9\u05D5\u05E8":"\u05D4\u05EA\u05D7\u05DC \u05E1\u05D9\u05D5\u05E8");n.addEventListener("click",()=>this.mode==="walk"?this.exitWalk():this.enterWalk()),t.appendChild(n);let i=se("div","toggles");i.style.marginTop="8px";let r=document.createElement("input");r.type="range",r.min=1.2,r.max=2,r.step=.05,r.value=this.settings.eyeHeight,r.className="pos";let o=se("span","",`\u05D2\u05D5\u05D1\u05D4 \u05E2\u05D9\u05DF ${(+r.value).toFixed(2)} \u05DE\u05F3`);r.addEventListener("input",()=>{o.textContent=`\u05D2\u05D5\u05D1\u05D4 \u05E2\u05D9\u05DF ${(+r.value).toFixed(2)} \u05DE\u05F3`,this.settings.eyeHeight=+r.value,this.saveSettings(),this.walk&&(this.walk.eyeTarget=+r.value,this.invalidate())}),i.appendChild(o),i.appendChild(r);let a=document.createElement("select");a.className="inline";for(let[d,u]of[["drag","\u05D2\u05E8\u05D9\u05E8\u05D4"],["lock","\u05E0\u05E2\u05D9\u05DC\u05EA \u05E1\u05DE\u05DF"],["auto","\u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9"]]){let p=se("option","",u);p.value=d,d===this.settings.mouseMode&&(p.selected=!0),a.appendChild(p)}a.addEventListener("change",()=>{this.settings.mouseMode=a.value,this.saveSettings(),document.pointerLockElement&&document.exitPointerLock()}),i.appendChild(se("span","","\u05DE\u05D1\u05D8 \u05D1\u05E2\u05DB\u05D1\u05E8")),i.appendChild(a),t.appendChild(i),e.appendChild(t);let l=se("div","pcard");l.appendChild(se("h3","","\u05E2\u05DE\u05D3\u05D5\u05EA \u05E9\u05DE\u05D5\u05E8\u05D5\u05EA"));let c=se("div","list");this.savedPositions.forEach((d,u)=>{let p=se("button","",`${d.name} \xB7 ${this.levelName(d.level_id)}`);p.appendChild(se("span","k",String(u+1))),p.addEventListener("click",()=>this.gotoPosition(d)),c.appendChild(p)}),l.appendChild(c),e.appendChild(l);let h=se("div","pcard");h.appendChild(se("h3","","\u05E2\u05DE\u05D5\u05D3 \u05D1\u2026"));let f=se("div","list");for(let d of this.planScene.cameras){let u=se("button","",`\u{1F4F7} ${d.label}`);u.addEventListener("click",()=>this.standAtCamera(d)),f.appendChild(u)}for(let d of Object.values(this.planScene.levels))for(let u of d.zones){let p=se("button","",`${u.name} \xB7 ${d.name}`);p.addEventListener("click",()=>this.standInRoom(d,u)),f.appendChild(p)}h.appendChild(f),e.appendChild(h)}levelName(e){let t=this.plan.doc.levels.find(n=>n.id===e);return t?t.name:e}buildQualityPanel(){let e=qe("panel-quality");e.innerHTML="";let t=se("div","pcard");t.appendChild(se("h3","","\u05EA\u05E6\u05D5\u05D2\u05D4"));let n=se("div","toggles"),i=(E,A,v,R)=>{let N=document.createElement("select");N.className="inline";for(let[L,S]of v){let w=se("option","",S);w.value=L,String(L)===String(this.settings[E])&&(w.selected=!0),N.appendChild(w)}return N.addEventListener("change",()=>{this.settings[E]=N.value,this.saveSettings(),R&&R(N.value)}),n.appendChild(se("span","",A)),n.appendChild(N),N},r=(E,A,v)=>{let R=se("button","sw"+(this.settings[E]?" on":""));R.addEventListener("click",()=>{this.settings[E]=!this.settings[E],R.classList.toggle("on",this.settings[E]),this.saveSettings(),v&&v(this.settings[E])}),n.appendChild(se("span","",A)),n.appendChild(R)};i("defaultView","\u05EA\u05E6\u05D5\u05D2\u05D4 \u05D1\u05DB\u05E0\u05D9\u05E1\u05D4 (\u05DC\u05DB\u05D5\u05DC\u05DD: \u05E1\u05DB\u05DE\u05D8\u05D9)",[["schematic","\u05E1\u05DB\u05DE\u05D8\u05D9"],["realistic","\u05E8\u05D9\u05D0\u05DC\u05D9\u05E1\u05D8\u05D9"]]),i("wallDisplay","\u05EA\u05E6\u05D5\u05D2\u05EA \u05E7\u05D9\u05E8",[["live","\u05EA\u05DC\u05EA\u05BE\u05DE\u05DE\u05D3 \u05D7\u05D9"],["stills","\u05EA\u05DE\u05D5\u05E0\u05D4 \u05DE\u05D5\u05DB\u05E0\u05D4"]]),i("furnitureMode","\u05E8\u05D9\u05D4\u05D5\u05D8",[["models","\u05DE\u05D5\u05D3\u05DC\u05D9\u05DD (CC0)"],["procedural","\u05DE\u05D5\u05D1\u05E0\u05D4 (\u05E4\u05E8\u05D5\u05E6\u05D3\u05D5\u05E8\u05DC\u05D9)"]],E=>{this.planScene.furnitureMode=E,this.rebuild(),this.makeThumbs()}),i("textureSource","\u05D7\u05D5\u05DE\u05E8\u05D9\u05DD",[["files","\u05E2\u05E8\u05DB\u05D5\u05EA CC0 (\u05E7\u05D1\u05E6\u05D9\u05DD)"],["procedural","\u05DE\u05D5\u05D1\u05E0\u05D4 (\u05E4\u05E8\u05D5\u05E6\u05D3\u05D5\u05E8\u05DC\u05D9)"]],E=>{this.lib.dispose(),this.lib.textureSource=E,this.lib.failed=new Set,this.rebuild(),this.makeThumbs()}),i("timeSource","\u05E9\u05E2\u05D4 \u05D1\u05D9\u05D5\u05DD",[["clock","\u05E9\u05E2\u05D5\u05DF \u05D4\u05D0\u05EA\u05E8"],["manual","\u05D9\u05D3\u05E0\u05D9 (\u05D4\u05DE\u05D7\u05D5\u05D5\u05DF)"]],E=>{E==="clock"&&qe("sun-now").click()}),r("sectionCut","\u05D7\u05EA\u05DA \u05E7\u05D5\u05DE\u05D4 \u05D1\u05DE\u05D1\u05D8\u05D9 \u05D4\u05DE\u05E2\u05D5\u05E3",()=>this.applyCut()),r("showTemps","\u05D8\u05DE\u05E4\u05E8\u05D8\u05D5\u05E8\u05D4 \u05E2\u05DC \u05DB\u05DC \u05D7\u05D3\u05E8",E=>qe("labels").classList.toggle("temps",E)),r("motion","\u05DE\u05E2\u05D1\u05E8\u05D9\u05DD \u05DE\u05D5\u05E0\u05E4\u05E9\u05D9\u05DD"),t.appendChild(n),e.appendChild(t);let o=se("div","pcard tree collapsed"),a=se("h3");a.appendChild(se("span","tw","\u25BC")),a.appendChild(document.createTextNode("\u05D0\u05D9\u05DB\u05D5\u05EA \u05D5\u05D1\u05D9\u05E6\u05D5\u05E2\u05D9\u05DD")),a.addEventListener("click",()=>o.classList.toggle("collapsed")),o.appendChild(a);let l=se("div","body");o.appendChild(l),this.ladderEl=se("div","ladder"),l.appendChild(this.ladderEl),l.appendChild(se("div","help",`\u05E0\u05DE\u05D3\u05D3 ${yd/1e3} \u05E9\u05E0\u05D9\u05D5\u05EA \u05D0\u05D7\u05E8\u05D9 3 \u05E4\u05E8\u05D9\u05D9\u05DE\u05D9\u05DD; \u05DE\u05EA\u05D7\u05EA \u05DC\u05BE${vd} fps \u05D9\u05D5\u05E8\u05D3\u05D9\u05DD \u05E9\u05DC\u05D1 \u05D5\u05E0\u05E9\u05D0\u05E8\u05D9\u05DD \u05E9\u05DD \u05DC\u05D4\u05DE\u05E9\u05DA \u05D4\u05D4\u05E4\u05E2\u05DC\u05D4. \u05D1\u05D7\u05D9\u05E8\u05D4 \u05D9\u05D3\u05E0\u05D9\u05EA \u05DE\u05D5\u05D3\u05D3\u05EA \u05DE\u05D7\u05D3\u05E9.`));let c=se("div","toggles"),h=(E,A,v)=>{let R=se("button","sw"+(this.opts[E]?" on":""));R.addEventListener("click",()=>{this.opts[E]=!this.opts[E],R.classList.toggle("on",this.opts[E]),(v||(()=>this.rebuild()))()}),c.appendChild(se("span","",A)),c.appendChild(R)};h("autoLadder","\u05D9\u05E8\u05D9\u05D3\u05D4 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA \u05D1\u05E8\u05DE\u05D4",()=>{}),h("reflections","\u05D4\u05E9\u05EA\u05E7\u05E4\u05D5\u05EA \u05E8\u05E6\u05E4\u05D4 (\u05E8\u05D9\u05D0\u05DC\u05D9\u05E1\u05D8\u05D9 \xB7 \u05D9\u05E7\u05E8)"),h("ao","\u05D7\u05E1\u05D9\u05DE\u05EA \u05E1\u05D1\u05D9\u05D1\u05D4 GTAO (\u05E8\u05D9\u05D0\u05DC\u05D9\u05E1\u05D8\u05D9)",()=>{this.env.post.ao=this.opts.ao,this.env.buildComposer(this.camera),this.invalidate()}),h("bloom","\u05D6\u05D5\u05D4\u05E8 \u05DE\u05E0\u05D5\u05E8\u05D5\u05EA (bloom)",()=>{this.env.post.bloom=this.opts.bloom,this.env.buildComposer(this.camera),this.invalidate()}),h("lampShadows","\u05E6\u05DC\u05DC\u05D9\u05DD \u05DE\u05DE\u05E0\u05D5\u05E8\u05D5\u05EA (2 \u05D4\u05E7\u05E8\u05D5\u05D1\u05D5\u05EA)");let f=se("button","sw"+(this.hudOn?" on":""));f.addEventListener("click",()=>{this.hudOn=!this.hudOn,f.classList.toggle("on",this.hudOn),qe("hud").classList.toggle("on",this.hudOn)}),c.appendChild(se("span","","\u05E0\u05EA\u05D5\u05E0\u05D9 \u05D1\u05D9\u05E6\u05D5\u05E2\u05D9\u05DD \u05E2\u05DC \u05D4\u05DE\u05E1\u05DA (\u05DC\u05DE\u05E4\u05EA\u05D7\u05D9\u05DD)")),c.appendChild(f),l.appendChild(c);let d=se("div","toggles"),u=document.createElement("select");u.className="inline";for(let E of[1,1.25,1.5,2]){let A=se("option","",`\u05E2\u05D3 ${E}\xD7`);A.value=E,E===this.opts.dprCap&&(A.selected=!0),u.appendChild(A)}u.addEventListener("change",()=>{this.opts.dprCap=+u.value,this.resize()}),d.appendChild(se("span","","\u05D9\u05D7\u05E1 \u05E4\u05D9\u05E7\u05E1\u05DC\u05D9\u05DD")),d.appendChild(u),l.appendChild(d),e.appendChild(o);let p=se("div","pcard");p.appendChild(se("h3","","\u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DE\u05D5\u05DB\u05E0\u05D5\u05EA \u05DC\u05EA\u05E6\u05D5\u05D2\u05EA \u05E7\u05D9\u05E8"));let x=se("button","btn primary","\u05D4\u05DB\u05DF \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DC\u05E7\u05D5\u05DE\u05D4 \u05D4\u05E0\u05D5\u05DB\u05D7\u05D9\u05EA"),m=se("div","progress"),g=se("i");m.appendChild(g),x.addEventListener("click",()=>this.bakeCurrent(x,g)),p.appendChild(x),p.appendChild(m);let b=se("button","btn sm","\u05D4\u05DB\u05DF \u05DC\u05DB\u05DC \u05D4\u05E7\u05D5\u05DE\u05D5\u05EA");b.style.marginTop="6px",b.addEventListener("click",async()=>{for(let E of this.plan.doc.levels)this.setLevelMode(E.id),await this.bakeCurrent(x,g)}),p.appendChild(b);let T=se("div","toggles");T.style.marginTop="8px";let _=document.createElement("select");_.className="inline";for(let[E,A]of[[0,"\u05DB\u05D1\u05D5\u05D9"],[10,"10 \u05E9\u05F3"],[30,"30 \u05E9\u05F3"],[120,"2 \u05D3\u05E7\u05F3"],[600,"10 \u05D3\u05E7\u05F3"]]){let v=se("option","",A);v.value=E,E===this.opts.idleS&&(v.selected=!0),_.appendChild(v)}_.addEventListener("change",()=>{this.opts.idleS=+_.value}),T.appendChild(se("span","","\u05DE\u05E2\u05D1\u05E8 \u05DC\u05EA\u05DE\u05D5\u05E0\u05D4 \u05D0\u05D7\u05E8\u05D9 \u05D7\u05D5\u05E1\u05E8 \u05E4\u05E2\u05D9\u05DC\u05D5\u05EA")),T.appendChild(_),p.appendChild(T);let M=se("button","btn sm","\u05D4\u05E6\u05D2 \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DE\u05D5\u05DB\u05E0\u05D5\u05EA \u05E2\u05DB\u05E9\u05D9\u05D5");M.style.marginTop="6px",M.addEventListener("click",()=>this.setQuality(0)),p.appendChild(M),e.appendChild(p),this.renderLadder()}renderLadder(){if(!this.ladderEl)return;this.ladderEl.innerHTML="";let e=[...Yc.map(([t,n])=>[t,n,t===3&&n?qc:Xc[t]]),[-1,!1,"2D"]];e.forEach(([t,n,i],r)=>{let o=se("span",t===this.quality&&n===this.lite?"on":"",i);t>=0&&o.addEventListener("click",()=>this.setQuality(t,null,n)),t===-1&&(o.style.cursor="default"),this.stage.dataset.fallback&&r<+this.stage.dataset.fallback&&o.classList.add("down"),this.ladderEl.appendChild(o),r<e.length-1&&this.ladderEl.appendChild(se("span","","\u2190"))}),this.lastProbe&&this.ladderEl.appendChild(se("div","help",`\u05DE\u05D3\u05D9\u05D3\u05D4 \u05D0\u05D7\u05E8\u05D5\u05E0\u05D4: ${this.lastProbe.fps} fps \u05D1\u05E8\u05DE\u05D4 "${this.lastProbe.label}"`))}async bakeCurrent(e,t){this.quality===0&&this.exitStills(!1);let n=this.currentLevelId(),i=this.levelMode,r=this.mode;this.mode==="walk"&&this.exitWalk(),this.setLevelMode(n),e.disabled=!0;let o={...this.entities},a=this.env.time.hour,l=new Nt(38,1.6,.1,300),c=this.visibleExtent(),h=(c.minX+c.maxX)/2,f=(c.minZ+c.maxZ)/2,u=Math.hypot(c.maxX-c.minX,c.maxZ-c.minZ,c.top)/2/Math.tan(l.fov*Math.PI/360)*1.1;l.position.set(h+u*.6,c.base+u*.6,f+u*.6),l.lookAt(h,c.base+1,f);let p=this.planScene.markers.filter(b=>b.group.parent===this.planScene.levels[n].group).map(b=>{let T=[];return b.group.children.forEach(_=>{_.geometry.computeBoundingBox();let M=_.geometry.boundingBox;T.push(new D(M.min.x,M.min.y,M.min.z),new D(M.max.x,M.max.y,M.max.z),new D(M.min.x,M.max.y,M.max.z),new D(M.max.x,M.min.y,M.min.z),new D(M.min.x,M.max.y,M.min.z),new D(M.max.x,M.max.y,M.min.z),new D(M.min.x,M.min.y,M.max.z),new D(M.max.x,M.min.y,M.max.z))}),{entity:b.entity,points:T}}),x=0,m=b=>{let T=b.startsWith("night"),_=b.endsWith("_on");this.env.setTime({hour:T?22.5:14});for(let M of Object.keys(this.entities))M.startsWith("light.")&&(this.entities[M]=_?"on":"off");for(let M of this.planScene.markers)M.group.visible=!1;for(let M of this.planScene.presence)M.mesh.visible=!1;this.planScene.setStates(this.entities,this.coverPositions,!0);for(let M of this.planScene.markers)M.group.visible=!1;for(let M of this.planScene.presence)M.mesh.visible=!1;this.planScene.update(1,l.position,{nightFactor:T?1:0,lampShadows:!1}),this.planScene.update(1,l.position,{nightFactor:T?1:0,lampShadows:!1}),t.style.width=`${++x/4*100}%`},g=await this.baker.bake(n,l,1280,800,m,p);this.bakes[n]=g,Object.assign(this.entities,o),this.env.setTime({hour:a}),this.planScene.setStates(this.entities,this.coverPositions,!0),this.thumbs[n]=g.pics.day_on,t.style.width="0",e.disabled=!1,this.renderBar(),this.buildStrip(),this.toast(`\u05D4\u05D5\u05DB\u05E0\u05D5 4 \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA + ${g.masks.length} \u05DE\u05E1\u05DB\u05D5\u05EA \u05DC\u05E7\u05D5\u05DE\u05D4 "${this.levelName(n)}"`),i!==n&&this.setLevelMode(i),this.invalidate()}enterStills(){this.mode="stills",this.stage.classList.add("stills"),this.continuous=!1,this.showStills(),this.renderBar()}showStills(){let e=this.bakes[this.currentLevelId()];hm(qe("stills"),e,{night:this.env.recipe.night>.5||this.env.sunInfo.elevation<0,entities:this.entities}),qe("labels").innerHTML=""}exitStills(e){this.stage.classList.remove("stills"),this.mode="orbit",e&&this.quality===0&&(this.quality=this.lastLiveQuality||2,this.lite=!!this.lastLiveLite,this.rebuild(),this.renderBar(),this.renderLadder()),this.invalidate()}enterWalk(){this.mode==="stills"&&this.exitStills(!0),this.mode="walk",this.stage.classList.add("walk"),this.orbitState={camera:this.camera,preset:this.preset,levelMode:this.levelMode},this.walk||(this.walk=new kc(this.planScene),this.walk.onLevelChange=i=>this.onWalkLevel(i)),this.walk.scene=this.planScene,this.walk.eye=this.settings.eyeHeight,this.walk.eyeTarget=this.settings.eyeHeight;let e=this.camera&&this.camera!==this.walkCam?{pos:this.camera.position.clone(),quat:this.camera.quaternion.clone()}:null,t=this.savedPositions.find(i=>i.is_default)||this.savedPositions[0];if(t)this.gotoPosition(t,!0);else{let i=this.planScene.levels[this.currentLevelId()],r=i.zones[0],o=r?Ar(r.polyM):[(i.extent.minX+i.extent.maxX)/2,(i.extent.minZ+i.extent.maxZ)/2];this.walk.placeAt(o[0],o[1],0,i.id)}let n=this.canvas.clientHeight>this.canvas.clientWidth;if(this.walkCam.fov=n?76:this.touch?70:62,this.walkCam.near=.06,this.walkCam.updateProjectionMatrix(),this.camera=this.walkCam,e&&this.settings.motion){this.walkCam.position.set(this.walk.x,this.walk.eyeY(),this.walk.z),this.walkCam.rotation.order="YXZ",this.walkCam.rotation.set(this.walk.pitch,this.walk.yaw,0);let i=this.walkCam.position.clone(),r=this.walkCam.quaternion.clone(),o=this.walkCam;this.tween={t0:performance.now(),ms:650,pose:!0,step:a=>{o.position.lerpVectors(e.pos,i,a),o.quaternion.slerpQuaternions(e.quat,r,a)}}}this.controls&&(this.controls.enabled=!1),this.planScene.showLevel("all",!0),this.planScene.setCut(null),this.env.setCamera(this.walkCam),this.env.interior=!0,this.env.interiorFill=.6,this.env.applyTime(),this.continuous=!0,this.renderBar(),this.buildWalkPanel(),this.updateWalkBar(),this.invalidate(),this.canvas.focus&&this.canvas.focus()}exitWalk(){document.pointerLockElement&&document.exitPointerLock(),this.mode="orbit",this.stage.classList.remove("walk");let e=this.orbitState||{};this.levelMode=e.levelMode||this.plan.doc.levels[0].id,this.planScene.showLevel(this.levelMode,!1),this.buildStrip(),this.fitCamera(e.preset||"iso"),this.env.interior=!1,this.env.interiorFill=1,this.env.applyTime(),this.applyCut(),this.continuous=!1,this.renderBar(),this.buildWalkPanel(),this.invalidate()}onWalkLevel(e){this.levelMode=e,this.buildStrip(),this.toast(`${this.levelName(e)}`),qe("mm-level").textContent=this.levelName(e)}gotoPosition(e,t){let[n,i]=this.planScene.toM([e.x,e.y]);this.mode!=="walk"&&this.enterWalk(),this.teleport(()=>{this.walk.placeAt(n,i,e.heading_deg||0,e.level_id),this.planScene.showLevel("all",!0)},t),qe("mm-level").textContent=this.levelName(this.walk.level)}teleport(e,t){let n=qe("fade");if(t){e(),this.invalidate();return}n.style.opacity="1",setTimeout(()=>{e(),this.invalidate(),setTimeout(()=>n.style.opacity="0",60)},160)}standAtCamera(e){this.mode!=="walk"&&this.enterWalk(),this.teleport(()=>{let t=this.planScene.levels[e.level];this.walk.placeAt(e.pos[0]+e.fwd[0]*.35,e.pos[1]+e.fwd[1]*.35,Math.atan2(-e.fwd[0],-e.fwd[1])*180/Math.PI,e.level),this.walk.yaw=Math.atan2(-e.fwd[0],-e.fwd[1]),this.walk.pitch=-e.tilt*Math.PI/180,this.walk.eyeOverride=t.elevation+e.mount}),this.toast(`\u05E2\u05D5\u05DE\u05D3 \u05D1${e.label} \u2014 \u05D2\u05D5\u05D1\u05D4 ${e.mount.toFixed(1)} \u05DE\u05F3, \u05D4\u05D4\u05DC\u05D9\u05DB\u05D4 \u05D4\u05E8\u05D0\u05E9\u05D5\u05E0\u05D4 \u05DE\u05D7\u05D6\u05D9\u05E8\u05D4 \u05DC\u05D2\u05D5\u05D1\u05D4 \u05D4\u05E2\u05D9\u05DF`)}standInRoom(e,t){this.mode!=="walk"&&this.enterWalk();let[n,i]=Ar(t.polyM),r=0,o=0;for(let a=0;a<t.polyM.length;a++){let l=t.polyM[a],c=t.polyM[(a+1)%t.polyM.length],h=Math.hypot(c[0]-l[0],c[1]-l[1]);h>o&&(o=h,r=Math.atan2(-((l[0]+c[0])/2-n),-((l[1]+c[1])/2-i)))}this.teleport(()=>this.walk.placeAt(n,i,r*180/Math.PI,e.id))}updateWalkBar(){if(!this.walk||document.activeElement&&document.activeElement.closest&&document.activeElement.closest("#walkbar"))return;qe("wx").value=this.walk.x.toFixed(2),qe("wz").value=this.walk.z.toFixed(2),qe("wh").value=Math.round((this.walk.yaw*180/Math.PI%360+360)%360);let e=this.planScene.levels[this.walk.level],t=e.zones.find(n=>Ri(this.walk.x,this.walk.z,n.polyM));qe("roomname").textContent=`${t?t.name+" \xB7 ":""}${e.name}${this.walk.onStairs?" \xB7 \u05DE\u05D3\u05E8\u05D2\u05D5\u05EA":""}${this.walk.edge?" \xB7 \u05E7\u05E6\u05D4 \u05D4\u05EA\u05D5\u05DB\u05E0\u05D9\u05EA":""}`,qe("mm-level").textContent=e.name}requestPointerLock(e=!1){this.mode!=="walk"&&this.enterWalk();let t=this.canvas.requestPointerLock&&this.canvas.requestPointerLock();t&&t.catch&&t.catch(()=>{e||this.toast("\u05E0\u05E2\u05D9\u05DC\u05EA \u05E1\u05DE\u05DF \u05DC\u05D0 \u05D6\u05DE\u05D9\u05E0\u05D4 \u05DB\u05D0\u05DF \u2014 \u05E0\u05E9\u05D0\u05E8\u05D9\u05DD \u05D1\u05D2\u05E8\u05D9\u05E8\u05D4")}),setTimeout(()=>{!document.pointerLockElement&&!e&&this.toast("\u05E0\u05E2\u05D9\u05DC\u05EA \u05E1\u05DE\u05DF \u05DC\u05D0 \u05D6\u05DE\u05D9\u05E0\u05D4 \u05DB\u05D0\u05DF \u2014 \u05E0\u05E9\u05D0\u05E8\u05D9\u05DD \u05D1\u05D2\u05E8\u05D9\u05E8\u05D4")},300)}bindStageInput(){let e=this.canvas;e.tabIndex=0;let t=new Set,n=()=>{if(!this.walk||this.mode!=="walk")return;let d=this.walk.input;d.fwd=(t.has("KeyW")||t.has("ArrowUp")?1:0)-(t.has("KeyS")||t.has("ArrowDown")?1:0),d.strafe=(t.has("KeyD")?1:0)-(t.has("KeyA")?1:0),d.turn=(t.has("KeyQ")||t.has("ArrowLeft")?1:0)-(t.has("KeyE")||t.has("ArrowRight")?1:0),d.run=t.has("ShiftLeft")||t.has("ShiftRight"),(d.fwd||d.strafe)&&(this.walk.path=null)};window.addEventListener("keydown",d=>{if(!(d.target&&(d.target.tagName==="INPUT"||d.target.tagName==="SELECT"||d.target.tagName==="TEXTAREA"))){if(this.userInput(),d.code==="Escape"){this.mode==="walk"&&this.exitWalk();return}if(!(d.code==="Digit3"&&this.mode!=="walk")&&this.mode==="walk"){if(/^Digit[1-9]$/.test(d.code)){let u=this.savedPositions[+d.code.slice(5)-1];u&&this.gotoPosition(u);return}if(d.code==="Enter"){this.actOnCrosshair();return}t.add(d.code),n(),["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(d.code)&&d.preventDefault()}}}),window.addEventListener("keyup",d=>{t.delete(d.code),n()}),window.addEventListener("blur",()=>{t.clear(),n()});let i=null;e.addEventListener("pointerdown",d=>{this.userInput(),this.mode!=="stills"&&(i={x:d.clientX,y:d.clientY,moved:!1,id:d.pointerId,t:performance.now(),touch:d.pointerType==="touch"},this.mode==="walk"&&!(d.pointerType==="touch"&&this.joyActive)&&e.setPointerCapture(d.pointerId),this.mode==="walk"&&d.pointerType==="mouse"&&this.settings.mouseMode!=="drag"&&!document.pointerLockElement&&this.requestPointerLock(this.settings.mouseMode==="auto"))}),e.addEventListener("pointermove",d=>{if(this.mode==="walk"&&document.pointerLockElement===e){this.walk.look(d.movementX*.0025,d.movementY*.0025),this.invalidate();return}if(!i||i.id!==d.pointerId){this.mode!=="walk"&&this.hoverAt(d);return}let u=d.clientX-i.x,p=d.clientY-i.y;if(Math.hypot(u,p)>6&&(i.moved=!0),this.mode==="walk"&&i.moved){let x=i.touch?.004:.0028;this.walk.look(u*x,p*x),i.x=d.clientX,i.y=d.clientY,this.invalidate()}});let r=d=>{if(!i||i.id!==d.pointerId)return;let u=i;i=null,this.mode!=="stills"&&(u.moved||this.clickAt(d,u.touch,performance.now()-u.t>500))};e.addEventListener("pointerup",r),e.addEventListener("pointercancel",()=>i=null),e.addEventListener("contextmenu",d=>d.preventDefault()),e.addEventListener("wheel",()=>this.userInput(),{passive:!0});let o=qe("joystick"),a=qe("knob"),l=null,c=null;o.addEventListener("pointerdown",d=>{l=d.pointerId;let u=o.getBoundingClientRect();c=[u.left+u.width/2,u.top+u.height/2],o.setPointerCapture(d.pointerId),this.joyActive=!0,this.userInput()}),o.addEventListener("pointermove",d=>{if(d.pointerId!==l||!this.walk)return;let u=d.clientX-c[0],p=d.clientY-c[1],x=Math.hypot(u,p),m=40;x>m&&(u*=m/x,p*=m/x),a.style.transform=`translate(${u}px, ${p}px)`;let g=8,b=Math.abs(u)<g?0:u/m,T=Math.abs(p)<g?0:p/m;this.walk.input.fwd=-T,this.walk.input.strafe=b,this.walk.path=null,this.invalidate()});let h=d=>{d.pointerId===l&&(l=null,this.joyActive=!1,a.style.transform="",this.walk&&(this.walk.input.fwd=0,this.walk.input.strafe=0))};o.addEventListener("pointerup",h),o.addEventListener("pointercancel",h),qe("minimap").querySelector("canvas").addEventListener("click",d=>{if(!this.walk||!this.mmMap)return;let u=d.currentTarget.getBoundingClientRect(),[p,x]=this.mmMap.invert((d.clientX-u.left)/u.width*336,(d.clientY-u.top)/u.height*336);this.teleport(()=>{this.walk.placeAt(p,x,this.walk.yaw*180/Math.PI,this.walk.level)})});let f=()=>{this.walk&&(this.walk.placeAt(+qe("wx").value,+qe("wz").value,+qe("wh").value,this.walk.level),this.invalidate())};for(let d of["wx","wz","wh"])qe(d).addEventListener("change",f);qe("walk-save").addEventListener("click",()=>{if(!this.walk)return;let u=this.planScene.levels[this.walk.level].zones.find(m=>Ri(this.walk.x,this.walk.z,m.polyM)),p=prompt("\u05E9\u05DD \u05D4\u05E2\u05DE\u05D3\u05D4",u?u.name:`\u05E2\u05DE\u05D3\u05D4 ${this.savedPositions.length+1}`);if(!p)return;let x=[this.walk.x/(this.planScene.W*this.planScene.scale),this.walk.z/(this.planScene.H*this.planScene.scale)];this.savedPositions.push({id:`wp-${Date.now()}`,name:p,level_id:this.walk.level,x:x[0],y:x[1],heading_deg:Math.round(this.walk.yaw*180/Math.PI),is_default:!1});try{localStorage.setItem(`studio6.positions.${this.plan.id}`,JSON.stringify(this.savedPositions))}catch{}this.buildWalkPanel(),this.toast(`\u05E0\u05E9\u05DE\u05E8\u05D4 \u05D4\u05E2\u05DE\u05D3\u05D4 "${p}"`)}),qe("walk-exit").addEventListener("click",()=>this.exitWalk()),document.addEventListener("pointerlockchange",()=>{document.pointerLockElement===e&&this.toast("\u05E0\u05E2\u05D9\u05DC\u05EA \u05E1\u05DE\u05DF \u05E4\u05E2\u05D9\u05DC\u05D4 \u2014 Esc \u05DC\u05E9\u05D7\u05E8\u05D5\u05E8")}),window.addEventListener("pointerdown",()=>this.userInput(),!0)}userInput(){this.lastInput=performance.now(),this.mode==="stills"&&this.quality===0&&this.kioskAuto&&(this.kioskAuto=!1,this.exitStills(!0))}ndc(e){let t=this.canvas.getBoundingClientRect();return new ee((e.clientX-t.left)/t.width*2-1,-((e.clientY-t.top)/t.height*2-1))}hoverAt(e){this.raycaster.setFromCamera(this.ndc(e),this.camera);let t=this.planScene.pick(this.raycaster),n=t?t.entity||t.id:null;n!==this.hover&&(this.hover=n,this.canvas.style.cursor=t?"pointer":"",this.invalidate())}clickAt(e,t,n){this.raycaster.setFromCamera(this.mode==="walk"&&!t&&document.pointerLockElement?new ee(0,0):this.ndc(e),this.camera);let i=this.planScene.pick(this.raycaster);if(i&&(this.mode!=="walk"||n||!t||i.distance<3)){this.showPopover(i,e);return}if(this.hidePopover(),this.mode==="walk"){let r=[];this.planScene.root.traverse(l=>{l.userData&&(l.userData.kind==="floor"||l.userData.kind==="static")&&l.visible&&r.push(l)});let o=this.raycaster.intersectObjects(r,!1),a=o.find(l=>l.object.userData.kind==="floor"&&l.face&&l.face.normal.y>.5)||o[0];if(a&&a.object.userData.kind==="floor"){if(a.object.userData.level!==this.walk.level){this.toast("\u05D4\u05E0\u05E7\u05D5\u05D3\u05D4 \u05D1\u05E7\u05D5\u05DE\u05D4 \u05D0\u05D7\u05E8\u05EA \u2014 \u05D4\u05E9\u05EA\u05DE\u05E9 \u05D1\u05DE\u05D3\u05E8\u05D2\u05D5\u05EA");return}this.walk.pathTo(a.point.x,a.point.z)||this.toast("\u05D0\u05D9\u05DF \u05DE\u05E1\u05DC\u05D5\u05DC \u05E4\u05EA\u05D5\u05D7 \u05DC\u05E0\u05E7\u05D5\u05D3\u05D4 (\u05D3\u05DC\u05EA \u05E1\u05D2\u05D5\u05E8\u05D4?)"),this.invalidate()}}}actOnCrosshair(){this.raycaster.setFromCamera(new ee(0,0),this.walkCam);let e=this.planScene.pick(this.raycaster);e&&e.distance<3.5&&this.showPopover(e,{clientX:this.canvas.clientWidth/2+this.stage.getBoundingClientRect().left,clientY:this.canvas.clientHeight/2+this.stage.getBoundingClientRect().top})}updateAim(){if(this.mode!=="walk"||this.touch){this.aimKey&&(this.aimKey=null,this.stage.classList.remove("aim"));return}this.raycaster.setFromCamera(new ee(0,0),this.walkCam);let e=this.planScene.pick(this.raycaster),t=e&&e.distance<3.5?e.entity||e.id:null;if(t!==this.aimKey&&(this.aimKey=t,this.stage.classList.toggle("aim",!!t),t)){let n=this.plan.entityNames||{};qe("aimhint").textContent=`${e.label||n[e.entity]||e.entity||e.id} \xB7 Enter`}}showPopover(e,t){this.hidePopover();let n=se("div","popover"),i=this.stage.getBoundingClientRect();n.style.left=`${Math.min(i.width-230,Math.max(8,t.clientX-i.left-100))}px`,n.style.top=`${Math.min(i.height-140,Math.max(8,t.clientY-i.top+14))}px`;let r=this.plan.entityNames||{},o=e.entity?this.entities[e.entity]:null,a={on:"\u05D3\u05D5\u05DC\u05E7",off:"\u05DB\u05D1\u05D5\u05D9",open:"\u05E4\u05EA\u05D5\u05D7",closed:"\u05E1\u05D2\u05D5\u05E8",locked:"\u05E0\u05E2\u05D5\u05DC",unlocked:"\u05DC\u05D0 \u05E0\u05E2\u05D5\u05DC",playing:"\u05DE\u05E0\u05D2\u05DF",unavailable:"\u05DC\u05D0 \u05D6\u05DE\u05D9\u05DF",undefined:"\u05DC\u05D0 \u05D9\u05D3\u05D5\u05E2",null:"\u05DC\u05D0 \u05D9\u05D3\u05D5\u05E2"};n.appendChild(se("h4","",e.label||r[e.entity]||e.entity||e.id));let l=se("div","actions");if(e.kind==="camera"){n.appendChild(se("div","state",e.online===!1?"\u05DC\u05D0 \u05DE\u05E7\u05D5\u05D5\u05DF \xB7 \u05DE\u05E6\u05D1 \u05D9\u05E9\u05DF":"\u05DE\u05E7\u05D5\u05D5\u05DF"));let h=se("button","btn sm","\u05E2\u05DE\u05D5\u05D3 \u05D1\u05DE\u05E6\u05DC\u05DE\u05D4");h.addEventListener("click",()=>{this.hidePopover(),this.standAtCamera(this.planScene.cameras.find(f=>f.id===e.id))}),l.appendChild(h)}else if(e.domain==="light"){n.appendChild(se("div","state",o==="on"?"\u05D3\u05D5\u05DC\u05E7":"\u05DB\u05D1\u05D5\u05D9"));let h=se("button","btn sm primary",o==="on"?"\u05DB\u05D1\u05D4":"\u05D4\u05D3\u05DC\u05E7");h.addEventListener("click",()=>{this.setEntity(e.entity,o==="on"?"off":"on"),this.hidePopover()}),l.appendChild(h)}else if(e.domain==="door"){let h=e.entity&&!e.entity.startsWith("door:");if(n.appendChild(se("div","state",h?(o==="on"||o==="open"?"\u05E4\u05EA\u05D5\u05D7\u05D4":"\u05E1\u05D2\u05D5\u05E8\u05D4")+(e.lock?` \xB7 ${a[this.entities[e.lock]]}`:""):"\u05DC\u05DC\u05D0 \u05D7\u05D9\u05D9\u05E9\u05DF \u2014 \u05E2\u05D1\u05D9\u05E8\u05D4 \u05D1\u05E1\u05D9\u05D5\u05E8")),h){let f=se("button","btn sm primary",o==="on"||o==="open"?"\u05E1\u05D2\u05D5\u05E8 (\u05D3\u05DE\u05D4 \u05D7\u05D9\u05D9\u05E9\u05DF)":"\u05E4\u05EA\u05D7 (\u05D3\u05DE\u05D4 \u05D7\u05D9\u05D9\u05E9\u05DF)");f.addEventListener("click",()=>{this.setEntity(e.entity,o==="on"||o==="open"?"off":"on"),this.hidePopover()}),l.appendChild(f)}if(e.lock){let f=se("button","btn sm",this.entities[e.lock]==="locked"?"\u05E9\u05D7\u05E8\u05E8 \u05E0\u05E2\u05D9\u05DC\u05D4":"\u05E0\u05E2\u05DC");f.addEventListener("click",()=>{this.setEntity(e.lock,this.entities[e.lock]==="locked"?"unlocked":"locked"),this.hidePopover()}),l.appendChild(f)}}else if(e.kind==="lock"){n.appendChild(se("div","state",a[o]));let h=se("button","btn sm primary",o==="locked"?"\u05E9\u05D7\u05E8\u05E8 \u05E0\u05E2\u05D9\u05DC\u05D4":"\u05E0\u05E2\u05DC");h.addEventListener("click",()=>{this.setEntity(e.entity,o==="locked"?"unlocked":"locked"),this.hidePopover()}),l.appendChild(h)}else if(e.domain==="cover"){let h=this.coverPositions[e.entity]??(o==="open"?100:0);n.appendChild(se("div","state",`${h}% \u05E4\u05EA\u05D5\u05D7`));for(let f of[0,50,100]){let d=se("button","btn sm",`${f}%`);d.addEventListener("click",()=>{this.coverPositions[e.entity]=f,this.setEntity(e.entity,f>0?"open":"closed"),this.buildStatesPanel(),this.hidePopover()}),l.appendChild(d)}}else if(e.domain==="media_player"){n.appendChild(se("div","state",a[o]));let h=se("button","btn sm primary",o==="playing"?"\u05DB\u05D1\u05D4":"\u05D4\u05E4\u05E2\u05DC");h.addEventListener("click",()=>{this.setEntity(e.entity,o==="playing"?"off":"playing"),this.hidePopover()}),l.appendChild(h)}let c=se("button","btn sm","\u05E1\u05D2\u05D5\u05E8");c.addEventListener("click",()=>this.hidePopover()),l.appendChild(c),n.appendChild(l),this.stage.appendChild(n),this.popover=n}hidePopover(){this.popover&&(this.popover.remove(),this.popover=null)}layoutLabels(){let e=qe("labels");if(this.mode==="stills"){e.innerHTML="";return}let t=this.canvas.clientWidth,n=this.canvas.clientHeight,i=this.camera;i.updateMatrixWorld();let r=new D,o=document.createDocumentFragment(),a=i.position,l=this.mode==="walk";for(let c of this.planScene.labels){let h=this.planScene.levels[c.level];if(!h||!h.group.visible||l&&c.kind==="room"||!l&&c.kind==="device"&&(!this.hover||this.hover!==c.entity)||l&&c.kind==="device"&&c.pos.distanceTo(a)>4||l&&c.kind==="camera"&&c.pos.distanceTo(a)>9||l&&c.kind==="temp"&&c.pos.distanceTo(a)>7||this.levelMode==="all"&&!l&&c.kind==="temp"&&c.level!==this.plan.doc.levels[this.plan.doc.levels.length-1].id||(r.copy(c.pos),c.offset&&!l&&(r.x+=c.offset),r.project(i),r.z>1||r.z<-1))continue;let f=(r.x+1)/2*t,d=(1-r.y)/2*n;if(f<-40||f>t+40||d<-20||d>n+20)continue;let u=se("div",`lbl ${c.kind}`);if(c.kind==="device"){let p=this.entities[c.entity],x=this.plan.entityNames||{};u.textContent=`${x[c.entity]||c.entity} \xB7 ${p==="on"?c.entity.startsWith("light.")?"\u05D3\u05D5\u05DC\u05E7":"\u05E4\u05EA\u05D5\u05D7":p==="off"?c.entity.startsWith("light.")?"\u05DB\u05D1\u05D5\u05D9":"\u05E1\u05D2\u05D5\u05E8":p||"\u2014"}`,p==="on"&&c.entity.startsWith("light.")&&u.classList.add("on"),p==="on"&&c.entity.startsWith("binary_sensor.")&&u.classList.add("open")}else u.textContent=c.text;c.kind==="camera"&&c.online===!1&&u.classList.add("off"),u.style.left=`${f}px`,u.style.top=`${d}px`,o.appendChild(u)}e.innerHTML="",e.appendChild(o)}invalidate(e=!0){this.needsFrame=!0,e&&(this.shadowDirty=!0)}frame(e){requestAnimationFrame(o=>this.frame(o));let t=Math.min(.1,(e-(this.lastT||e))/1e3);if(this.lastT=e,this.opts.idleS>0&&this.mode==="orbit"&&this.bakes[this.currentLevelId()]&&e-this.lastInput>this.opts.idleS*1e3&&(this.lastLiveQuality=this.quality,this.kioskAuto=!0,this.quality=0,this.enterStills(),this.renderBar(),this.renderLadder(),this.setNote("\u05E7\u05D9\u05D5\u05E1\u05E7: \u05D7\u05D5\u05E1\u05E8 \u05E4\u05E2\u05D9\u05DC\u05D5\u05EA \u2014 \u05E2\u05D1\u05E8\u05E0\u05D5 \u05DC\u05EA\u05DE\u05D5\u05E0\u05D4 \u05D4\u05DE\u05D5\u05DB\u05E0\u05D4, 0 \u05E4\u05E8\u05D9\u05D9\u05DE\u05D9\u05DD")),this.mode==="stills"){this.updateHud(e,!1);return}let n=!1;if(this.tween){let o=Math.min(1,(e-this.tween.t0)/this.tween.ms),a=o<.5?2*o*o:1-Math.pow(-2*o+2,2)/2;if(this.tween.step(a),n=!0,o>=1){let l=this.tween;this.tween=null,!l.pose&&this.controls&&this.mode==="orbit"&&(this.controls.enabled=!0)}}if(this.mode==="walk"&&this.walk){this.walk.step(t)&&(n=!0,this.walk.eyeOverride=null),this.walk.eyeTarget!=null&&Math.abs(this.walk.eyeTarget-this.walk.eye)>.001&&(this.walk.eye+=(this.walk.eyeTarget-this.walk.eye)*Math.min(1,t*6),n=!0);let o=this.planScene.levels[this.walk.level],a=o&&o.zones.find(c=>Ri(this.walk.x,this.walk.z,c.polyM)),l=a&&typeof a.daylight=="number"?.25+a.daylight*.75:.6;if(Math.abs(l-this.env.interiorFill)>.004&&(this.env.interiorFill+=(l-this.env.interiorFill)*Math.min(1,t*3),this.env.applyFill(),n=!0),!(this.tween&&this.tween.pose)){let c=this.walk.eyeOverride!=null?this.walk.eyeOverride:this.walk.eyeY();this.walkCam.position.set(this.walk.x,c,this.walk.z),this.walkCam.rotation.order="YXZ",this.walkCam.rotation.set(this.walk.pitch,this.walk.yaw,0)}this.updateWalkBar(),this.updateAim(),this.mmMap=lm(qe("minimap").querySelector("canvas"),this.planScene,this.walk,{bg:document.documentElement.dataset.theme==="dark"?"rgba(21,28,44,.92)":"rgba(255,255,255,.92)"})}else this.controls&&!this.tween&&this.controls.update()&&(n=!0);this.planScene.update(t,this.camera.position,{nightFactor:this.env.recipe.night,lampShadows:this.opts.lampShadows&&this.quality>=3,coneVolumes:this.mode==="walk"&&!!this.walk&&this.walk.eyeOverride!=null})&&(n=!0,this.shadowDirty=!0);let r=this.needsFrame||n||this.continuous||this.probe;if(r){this.needsFrame=!1,(this.shadowDirty||this.probe)&&(this.env.renderer.shadowMap.needsUpdate=!0,this.shadowDirty=!1),this.env.renderer.info.autoReset=!1,this.env.renderer.info.reset();let o=performance.now();this.env.render(this.camera),this.fps.ms=this.fps.ms*.85+(performance.now()-o)*.15,this.layoutLabels(),this.fps.window.push(e),this.probeFrame(e)}this.updateHud(e,r)}updateHud(e,t){let n=this.fps.window;for(;n.length&&n[0]<e-1e3;)n.shift();if(e-this.fps.last<250)return;this.fps.last=e;let i=this.env.renderer.info,r=performance.memory?`${(performance.memory.usedJSHeapSize/1048576).toFixed(0)} MB heap`:"heap n/a",o=this.gpuName||(this.gpuName=this.env.rendererName()),a=/swiftshader|llvmpipe|software/i.test(o),l=this.mode==="stills"?"0 fps (still, no WebGL frames)":n.length?`${n.length} fps \xB7 ${this.fps.ms.toFixed(1)} ms/frame (CPU submit)`:"idle (0 fps \u2014 on-demand)";qe("hud").innerHTML=`<b>${l}</b><br>draw ${i.render.calls} \xB7 tris ${(i.render.triangles/1e3).toFixed(0)}k \xB7 tex ${i.memory.textures} \xB7 geo ${i.memory.geometries}<br>${r} \xB7 ${this.canvas.width}\xD7${this.canvas.height} @${this.env.dpr.toFixed(2)}\xD7<br>${this.mode} \xB7 ${this.qualityLabel()}${this.probe?" \xB7 measuring\u2026":""}<br><span class="${a?"warn":""}">${a?"\u26A0 software renderer: ":"GPU: "}${o.length>60?o.slice(0,60)+"\u2026":o}</span>`}};window.Studio6App=Zc;window.STUDIO6_PLANS=jc;/noboot/.test(location.search)||window.addEventListener("load",()=>setTimeout(()=>{let s=performance.now();window.studio6=new Zc,window.studio6.bootMs=Math.round(performance.now()-s)},30));})();
