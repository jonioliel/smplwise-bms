/* SmplWise Arx - Plan Studio 6 prototype bundle. three.js 0.186.1 (MIT, see LICENSES.md). Built 2026-10-09. */
(()=>{var wn={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},En={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},Hu=0,qc=1,Vu=2;var Tn=1,Gu=2,Us=3,An=0,Ye=1,Le=2,Ae=0,Fs=1,Xn=2,Yc=3,Zc=4,Fa=5;var _i=100,Wu=101,Xu=102,qu=103,Yu=104,qn=200,Zu=201,ju=202,Ku=203,jc=204,Kc=205,Gr=206,Ju=207,Wr=208,Qu=209,$u=210,td=211,ed=212,id=213,nd=214,$o=0,ta=1,ea=2,vs=3,ia=4,na=5,sa=6,ra=7,Oa=0,sd=1,rd=2,pi=0,Xr=1,qr=2,Yr=3,Zr=4,jr=5,Kr=6,Cn=7;var Jc=300,Rn=301,Yn=302,Ba=303,ka=304,Jr=306,hi=1e3,xi=1001,oa=1002,Se=1003,od=1004;var Qr=1005;var Fe=1006,za=1007;var Pn=1008;var Qe=1009,Qc=1010,$c=1011,Os=1012,Ha=1013,Li=1014,Ii=1015,ve=1016,Va=1017,Ga=1018,Ln=1020,th=35902,eh=35899,ih=1021,nh=1022,ri=1023,ki=1026,Vi=1027,sh=1028,Wa=1029,In=1030,Xa=1031;var qa=1033,$r=33776,to=33777,eo=33778,io=33779,Ya=35840,Za=35841,ja=35842,Ka=35843,Ja=36196,Qa=37492,$a=37496,tl=37488,el=37489,no=37490,il=37491,nl=37808,sl=37809,rl=37810,ol=37811,al=37812,ll=37813,cl=37814,hl=37815,ul=37816,dl=37817,fl=37818,pl=37819,ml=37820,gl=37821,xl=36492,vl=36494,_l=36495,yl=36283,Ml=36284,so=36285,bl=36286;var cr=2300,aa=2301,Jo=2302,Dc=2303,Nc=2400,Uc=2401,Fc=2402;var ad=3200;var Bs=0,ld=1,Di="",De="srgb",hr="srgb-linear",ur="linear",ce="srgb";var Qo=7680;var cd=519,hd=512,ud=513,dd=514,Sl=515,fd=516,pd=517,wl=518,md=519,rh=35044;var oh="300 es",Ci=2e3,_s=2001;function Bf(n){for(let t=n.length-1;t>=0;--t)if(n[t]>=65535)return!0;return!1}function kf(n){return ArrayBuffer.isView(n)&&!(n instanceof DataView)}function dr(n){return document.createElementNS("http://www.w3.org/1999/xhtml",n)}function gd(){let n=dr("canvas");return n.style.display="block",n}var ru={},ys=null;function fr(...n){let t="THREE."+n.shift();ys?ys("log",t,...n):console.log(t,...n)}function xd(n){let t=n[0];if(typeof t=="string"&&t.startsWith("TSL:")){let e=n[1];e&&e.isStackTrace?n[0]+=" "+e.getLocation():n[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return n}function qt(...n){n=xd(n);let t="THREE."+n.shift();if(ys)ys("warn",t,...n);else{let e=n[0];e&&e.isStackTrace?console.warn(e.getError(t)):console.warn(t,...n)}}function Yt(...n){n=xd(n);let t="THREE."+n.shift();if(ys)ys("error",t,...n);else{let e=n[0];e&&e.isStackTrace?console.error(e.getError(t)):console.error(t,...n)}}function kn(...n){let t=n.join(" ");t in ru||(ru[t]=!0,qt(...n))}function vd(n,t,e){return new Promise(function(i,s){function r(){switch(n.clientWaitSync(t,n.SYNC_FLUSH_COMMANDS_BIT,0)){case n.WAIT_FAILED:s();break;case n.TIMEOUT_EXPIRED:setTimeout(r,e);break;default:i()}}setTimeout(r,e)})}var _d={[$o]:ta,[ea]:sa,[ia]:ra,[vs]:na,[ta]:$o,[sa]:ea,[ra]:ia,[na]:vs},Ri=class{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});let i=this._listeners;i[t]===void 0&&(i[t]=[]),i[t].indexOf(e)===-1&&i[t].push(e)}hasEventListener(t,e){let i=this._listeners;return i===void 0?!1:i[t]!==void 0&&i[t].indexOf(e)!==-1}removeEventListener(t,e){let i=this._listeners;if(i===void 0)return;let s=i[t];if(s!==void 0){let r=s.indexOf(e);r!==-1&&s.splice(r,1)}}dispatchEvent(t){let e=this._listeners;if(e===void 0)return;let i=e[t.type];if(i!==void 0){t.target=this;let s=i.slice(0);for(let r=0,o=s.length;r<o;r++)s[r].call(this,t);t.target=null}}},Ke=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],ou=1234567,rr=Math.PI/180,Ms=180/Math.PI;function Bi(){let n=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(Ke[n&255]+Ke[n>>8&255]+Ke[n>>16&255]+Ke[n>>24&255]+"-"+Ke[t&255]+Ke[t>>8&255]+"-"+Ke[t>>16&15|64]+Ke[t>>24&255]+"-"+Ke[e&63|128]+Ke[e>>8&255]+"-"+Ke[e>>16&255]+Ke[e>>24&255]+Ke[i&255]+Ke[i>>8&255]+Ke[i>>16&255]+Ke[i>>24&255]).toLowerCase()}function Qt(n,t,e){return Math.max(t,Math.min(e,n))}function ah(n,t){return(n%t+t)%t}function zf(n,t,e,i,s){return i+(n-t)*(s-i)/(e-t)}function Hf(n,t,e){return n!==t?(e-n)/(t-n):0}function or(n,t,e){return(1-e)*n+e*t}function Vf(n,t,e,i){return or(n,t,1-Math.exp(-e*i))}function Gf(n,t=1){return t-Math.abs(ah(n,t*2)-t)}function Wf(n,t,e){return n<=t?0:n>=e?1:(n=(n-t)/(e-t),n*n*(3-2*n))}function Xf(n,t,e){return n<=t?0:n>=e?1:(n=(n-t)/(e-t),n*n*n*(n*(n*6-15)+10))}function qf(n,t){return n+Math.floor(Math.random()*(t-n+1))}function Yf(n,t){return n+Math.random()*(t-n)}function Zf(n){return n*(.5-Math.random())}function jf(n){n!==void 0&&(ou=n);let t=ou+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function Kf(n){return n*rr}function Jf(n){return n*Ms}function Qf(n){return n>0&&Number.isInteger(n)&&2**Math.round(Math.log2(n))===n}function $f(n){return Math.pow(2,Math.ceil(Math.log(n)/Math.LN2))}function tp(n){return Math.pow(2,Math.floor(Math.log(n)/Math.LN2))}function ep(n,t,e,i,s){let r=Math.cos,o=Math.sin,a=r(e/2),l=o(e/2),c=r((t+i)/2),h=o((t+i)/2),f=r((t-i)/2),d=o((t-i)/2),u=r((i-t)/2),p=o((i-t)/2);switch(s){case"XYX":n.set(a*h,l*f,l*d,a*c);break;case"YZY":n.set(l*d,a*h,l*f,a*c);break;case"ZXZ":n.set(l*f,l*d,a*h,a*c);break;case"XZX":n.set(a*h,l*p,l*u,a*c);break;case"YXY":n.set(l*u,a*h,l*p,a*c);break;case"ZYZ":n.set(l*p,l*u,a*h,a*c);break;default:qt("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+s)}}function Ai(n,t){switch(t.constructor){case Float32Array:return n;case Uint32Array:return n/4294967295;case Uint16Array:return n/65535;case Uint8Array:case Uint8ClampedArray:return n/255;case Int32Array:return Math.max(n/2147483647,-1);case Int16Array:return Math.max(n/32767,-1);case Int8Array:return Math.max(n/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function fe(n,t){switch(t.constructor){case Float32Array:return n;case Uint32Array:return Math.round(n*4294967295);case Uint16Array:return Math.round(n*65535);case Uint8Array:case Uint8ClampedArray:return Math.round(n*255);case Int32Array:return Math.round(n*2147483647);case Int16Array:return Math.round(n*32767);case Int8Array:return Math.round(n*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var lh={DEG2RAD:rr,RAD2DEG:Ms,generateUUID:Bi,clamp:Qt,euclideanModulo:ah,mapLinear:zf,inverseLerp:Hf,lerp:or,damp:Vf,pingpong:Gf,smoothstep:Wf,smootherstep:Xf,randInt:qf,randFloat:Yf,randFloatSpread:Zf,seededRandom:jf,degToRad:Kf,radToDeg:Jf,isPowerOfTwo:Qf,ceilPowerOfTwo:$f,floorPowerOfTwo:tp,setQuaternionFromProperEuler:ep,normalize:fe,denormalize:Ai},ph=class ph{constructor(t=0,e=0){this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("THREE.Vector2: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){let e=this.x,i=this.y,s=t.elements;return this.x=s[0]*e+s[3]*i+s[6],this.y=s[1]*e+s[4]*i+s[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Qt(this.x,t.x,e.x),this.y=Qt(this.y,t.y,e.y),this}clampScalar(t,e){return this.x=Qt(this.x,t,e),this.y=Qt(this.y,t,e),this}clampLength(t,e){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Qt(i,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let i=this.dot(t)/e;return Math.acos(Qt(i,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,i=this.y-t.y;return e*e+i*i}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,i){return this.x=t.x+(e.x-t.x)*i,this.y=t.y+(e.y-t.y)*i,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){let i=Math.cos(e),s=Math.sin(e),r=this.x-t.x,o=this.y-t.y;return this.x=r*i-o*s+t.x,this.y=r*s+o*i+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}};ph.prototype.isVector2=!0;var tt=ph,ui=class{constructor(t=0,e=0,i=0,s=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=i,this._w=s}static slerpFlat(t,e,i,s,r,o,a){let l=i[s+0],c=i[s+1],h=i[s+2],f=i[s+3],d=r[o+0],u=r[o+1],p=r[o+2],x=r[o+3];if(f!==x||l!==d||c!==u||h!==p){let m=l*d+c*u+h*p+f*x;m<0&&(d=-d,u=-u,p=-p,x=-x,m=-m);let g=1-a;if(m<.9995){let b=Math.acos(m),T=Math.sin(b);g=Math.sin(g*b)/T,a=Math.sin(a*b)/T,l=l*g+d*a,c=c*g+u*a,h=h*g+p*a,f=f*g+x*a}else{l=l*g+d*a,c=c*g+u*a,h=h*g+p*a,f=f*g+x*a;let b=1/Math.sqrt(l*l+c*c+h*h+f*f);l*=b,c*=b,h*=b,f*=b}}t[e]=l,t[e+1]=c,t[e+2]=h,t[e+3]=f}static multiplyQuaternionsFlat(t,e,i,s,r,o){let a=i[s],l=i[s+1],c=i[s+2],h=i[s+3],f=r[o],d=r[o+1],u=r[o+2],p=r[o+3];return t[e]=a*p+h*f+l*u-c*d,t[e+1]=l*p+h*d+c*f-a*u,t[e+2]=c*p+h*u+a*d-l*f,t[e+3]=h*p-a*f-l*d-c*u,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,i,s){return this._x=t,this._y=e,this._z=i,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){let i=t._x,s=t._y,r=t._z,o=t._order,a=Math.cos,l=Math.sin,c=a(i/2),h=a(s/2),f=a(r/2),d=l(i/2),u=l(s/2),p=l(r/2);switch(o){case"XYZ":this._x=d*h*f+c*u*p,this._y=c*u*f-d*h*p,this._z=c*h*p+d*u*f,this._w=c*h*f-d*u*p;break;case"YXZ":this._x=d*h*f+c*u*p,this._y=c*u*f-d*h*p,this._z=c*h*p-d*u*f,this._w=c*h*f+d*u*p;break;case"ZXY":this._x=d*h*f-c*u*p,this._y=c*u*f+d*h*p,this._z=c*h*p+d*u*f,this._w=c*h*f-d*u*p;break;case"ZYX":this._x=d*h*f-c*u*p,this._y=c*u*f+d*h*p,this._z=c*h*p-d*u*f,this._w=c*h*f+d*u*p;break;case"YZX":this._x=d*h*f+c*u*p,this._y=c*u*f+d*h*p,this._z=c*h*p-d*u*f,this._w=c*h*f-d*u*p;break;case"XZY":this._x=d*h*f-c*u*p,this._y=c*u*f-d*h*p,this._z=c*h*p+d*u*f,this._w=c*h*f+d*u*p;break;default:qt("Quaternion: .setFromEuler() encountered an unknown order: "+o)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){let i=e/2,s=Math.sin(i);return this._x=t.x*s,this._y=t.y*s,this._z=t.z*s,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(t){let e=t.elements,i=e[0],s=e[4],r=e[8],o=e[1],a=e[5],l=e[9],c=e[2],h=e[6],f=e[10],d=i+a+f;if(d>0){let u=.5/Math.sqrt(d+1);this._w=.25/u,this._x=(h-l)*u,this._y=(r-c)*u,this._z=(o-s)*u}else if(i>a&&i>f){let u=2*Math.sqrt(1+i-a-f);this._w=(h-l)/u,this._x=.25*u,this._y=(s+o)/u,this._z=(r+c)/u}else if(a>f){let u=2*Math.sqrt(1+a-i-f);this._w=(r-c)/u,this._x=(s+o)/u,this._y=.25*u,this._z=(l+h)/u}else{let u=2*Math.sqrt(1+f-i-a);this._w=(o-s)/u,this._x=(r+c)/u,this._y=(l+h)/u,this._z=.25*u}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let i=t.dot(e)+1;return i<1e-8?(i=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=i):(this._x=0,this._y=-t.z,this._z=t.y,this._w=i)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=i),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(Qt(this.dot(t),-1,1)))}rotateTowards(t,e){let i=this.angleTo(t);if(i===0)return this;let s=Math.min(1,e/i);return this.slerp(t,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){let i=t._x,s=t._y,r=t._z,o=t._w,a=e._x,l=e._y,c=e._z,h=e._w;return this._x=i*h+o*a+s*c-r*l,this._y=s*h+o*l+r*a-i*c,this._z=r*h+o*c+i*l-s*a,this._w=o*h-i*a-s*l-r*c,this._onChangeCallback(),this}slerp(t,e){let i=t._x,s=t._y,r=t._z,o=t._w,a=this.dot(t);a<0&&(i=-i,s=-s,r=-r,o=-o,a=-a);let l=1-e;if(a<.9995){let c=Math.acos(a),h=Math.sin(c);l=Math.sin(l*c)/h,e=Math.sin(e*c)/h,this._x=this._x*l+i*e,this._y=this._y*l+s*e,this._z=this._z*l+r*e,this._w=this._w*l+o*e,this._onChangeCallback()}else this._x=this._x*l+i*e,this._y=this._y*l+s*e,this._z=this._z*l+r*e,this._w=this._w*l+o*e,this.normalize();return this}slerpQuaternions(t,e,i){return this.copy(t).slerp(e,i)}random(){let t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),i=Math.random(),s=Math.sqrt(1-i),r=Math.sqrt(i);return this.set(s*Math.sin(t),s*Math.cos(t),r*Math.sin(e),r*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},mh=class mh{constructor(t=0,e=0,i=0){this.x=t,this.y=e,this.z=i}set(t,e,i){return i===void 0&&(i=this.z),this.x=t,this.y=e,this.z=i,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("THREE.Vector3: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(au.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(au.setFromAxisAngle(t,e))}applyMatrix3(t){let e=this.x,i=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[3]*i+r[6]*s,this.y=r[1]*e+r[4]*i+r[7]*s,this.z=r[2]*e+r[5]*i+r[8]*s,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){let e=this.x,i=this.y,s=this.z,r=t.elements,o=1/(r[3]*e+r[7]*i+r[11]*s+r[15]);return this.x=(r[0]*e+r[4]*i+r[8]*s+r[12])*o,this.y=(r[1]*e+r[5]*i+r[9]*s+r[13])*o,this.z=(r[2]*e+r[6]*i+r[10]*s+r[14])*o,this}applyQuaternion(t){let e=this.x,i=this.y,s=this.z,r=t.x,o=t.y,a=t.z,l=t.w,c=2*(o*s-a*i),h=2*(a*e-r*s),f=2*(r*i-o*e);return this.x=e+l*c+o*f-a*h,this.y=i+l*h+a*c-r*f,this.z=s+l*f+r*h-o*c,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){let e=this.x,i=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[4]*i+r[8]*s,this.y=r[1]*e+r[5]*i+r[9]*s,this.z=r[2]*e+r[6]*i+r[10]*s,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Qt(this.x,t.x,e.x),this.y=Qt(this.y,t.y,e.y),this.z=Qt(this.z,t.z,e.z),this}clampScalar(t,e){return this.x=Qt(this.x,t,e),this.y=Qt(this.y,t,e),this.z=Qt(this.z,t,e),this}clampLength(t,e){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Qt(i,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,i){return this.x=t.x+(e.x-t.x)*i,this.y=t.y+(e.y-t.y)*i,this.z=t.z+(e.z-t.z)*i,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){let i=t.x,s=t.y,r=t.z,o=e.x,a=e.y,l=e.z;return this.x=s*l-r*a,this.y=r*o-i*l,this.z=i*a-s*o,this}projectOnVector(t){let e=t.lengthSq();if(e===0)return this.set(0,0,0);let i=t.dot(this)/e;return this.copy(t).multiplyScalar(i)}projectOnPlane(t){return ac.copy(this).projectOnVector(t),this.sub(ac)}reflect(t){return this.sub(ac.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let i=this.dot(t)/e;return Math.acos(Qt(i,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,i=this.y-t.y,s=this.z-t.z;return e*e+i*i+s*s}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,i){let s=Math.sin(e)*t;return this.x=s*Math.sin(i),this.y=Math.cos(e)*t,this.z=s*Math.cos(i),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,i){return this.x=t*Math.sin(e),this.y=i,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){let e=this.setFromMatrixColumn(t,0).length(),i=this.setFromMatrixColumn(t,1).length(),s=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=i,this.z=s,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let t=Math.random()*Math.PI*2,e=Math.random()*2-1,i=Math.sqrt(1-e*e);return this.x=i*Math.cos(t),this.y=e,this.z=i*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}};mh.prototype.isVector3=!0;var D=mh,ac=new D,au=new ui,gh=class gh{constructor(t,e,i,s,r,o,a,l,c){this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,i,s,r,o,a,l,c)}set(t,e,i,s,r,o,a,l,c){let h=this.elements;return h[0]=t,h[1]=s,h[2]=a,h[3]=e,h[4]=r,h[5]=l,h[6]=i,h[7]=o,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){let e=this.elements,i=t.elements;return e[0]=i[0],e[1]=i[1],e[2]=i[2],e[3]=i[3],e[4]=i[4],e[5]=i[5],e[6]=i[6],e[7]=i[7],e[8]=i[8],this}extractBasis(t,e,i){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(t){let e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let i=t.elements,s=e.elements,r=this.elements,o=i[0],a=i[3],l=i[6],c=i[1],h=i[4],f=i[7],d=i[2],u=i[5],p=i[8],x=s[0],m=s[3],g=s[6],b=s[1],T=s[4],v=s[7],S=s[2],C=s[5],P=s[8];return r[0]=o*x+a*b+l*S,r[3]=o*m+a*T+l*C,r[6]=o*g+a*v+l*P,r[1]=c*x+h*b+f*S,r[4]=c*m+h*T+f*C,r[7]=c*g+h*v+f*P,r[2]=d*x+u*b+p*S,r[5]=d*m+u*T+p*C,r[8]=d*g+u*v+p*P,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){let t=this.elements,e=t[0],i=t[1],s=t[2],r=t[3],o=t[4],a=t[5],l=t[6],c=t[7],h=t[8];return e*o*h-e*a*c-i*r*h+i*a*l+s*r*c-s*o*l}invert(){let t=this.elements,e=t[0],i=t[1],s=t[2],r=t[3],o=t[4],a=t[5],l=t[6],c=t[7],h=t[8],f=h*o-a*c,d=a*l-h*r,u=c*r-o*l,p=e*f+i*d+s*u;if(p===0)return this.set(0,0,0,0,0,0,0,0,0);let x=1/p;return t[0]=f*x,t[1]=(s*c-h*i)*x,t[2]=(a*i-s*o)*x,t[3]=d*x,t[4]=(h*e-s*l)*x,t[5]=(s*r-a*e)*x,t[6]=u*x,t[7]=(i*l-c*e)*x,t[8]=(o*e-i*r)*x,this}transpose(){let t,e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){let e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,i,s,r,o,a){let l=Math.cos(r),c=Math.sin(r);return this.set(i*l,i*c,-i*(l*o+c*a)+o+t,-s*c,s*l,-s*(-c*o+l*a)+a+e,0,0,1),this}scale(t,e){return kn("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(lc.makeScale(t,e)),this}rotate(t){return kn("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(lc.makeRotation(-t)),this}translate(t,e){return kn("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(lc.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){let e=Math.cos(t),i=Math.sin(t);return this.set(e,-i,0,i,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){let e=this.elements,i=t.elements;for(let s=0;s<9;s++)if(e[s]!==i[s])return!1;return!0}fromArray(t,e=0){for(let i=0;i<9;i++)this.elements[i]=t[i+e];return this}toArray(t=[],e=0){let i=this.elements;return t[e]=i[0],t[e+1]=i[1],t[e+2]=i[2],t[e+3]=i[3],t[e+4]=i[4],t[e+5]=i[5],t[e+6]=i[6],t[e+7]=i[7],t[e+8]=i[8],t}clone(){return new this.constructor().fromArray(this.elements)}};gh.prototype.isMatrix3=!0;var Kt=gh,lc=new Kt,lu=new Kt().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),cu=new Kt().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function ip(){let n={enabled:!0,workingColorSpace:hr,spaces:{},convert:function(s,r,o){return this.enabled===!1||r===o||!r||!o||(this.spaces[r].transfer===ce&&(s.r=en(s.r),s.g=en(s.g),s.b=en(s.b)),this.spaces[r].primaries!==this.spaces[o].primaries&&(s.applyMatrix3(this.spaces[r].toXYZ),s.applyMatrix3(this.spaces[o].fromXYZ)),this.spaces[o].transfer===ce&&(s.r=xs(s.r),s.g=xs(s.g),s.b=xs(s.b))),s},workingToColorSpace:function(s,r){return this.convert(s,this.workingColorSpace,r)},colorSpaceToWorking:function(s,r){return this.convert(s,r,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===Di?ur:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,r=this.workingColorSpace){return s.fromArray(this.spaces[r].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,r,o){return s.copy(this.spaces[r].toXYZ).multiply(this.spaces[o].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,r){return kn("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),n.workingToColorSpace(s,r)},toWorkingColorSpace:function(s,r){return kn("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),n.colorSpaceToWorking(s,r)}},t=[.64,.33,.3,.6,.15,.06],e=[.2126,.7152,.0722],i=[.3127,.329];return n.define({[hr]:{primaries:t,whitePoint:i,transfer:ur,toXYZ:lu,fromXYZ:cu,luminanceCoefficients:e,workingColorSpaceConfig:{unpackColorSpace:De},outputColorSpaceConfig:{drawingBufferColorSpace:De}},[De]:{primaries:t,whitePoint:i,transfer:ce,toXYZ:lu,fromXYZ:cu,luminanceCoefficients:e,outputColorSpaceConfig:{drawingBufferColorSpace:De}}}),n}var ie=ip();function en(n){return n<.04045?n*.0773993808:Math.pow(n*.9478672986+.0521327014,2.4)}function xs(n){return n<.0031308?n*12.92:1.055*Math.pow(n,.41666)-.055}var ts,la=class{static getDataURL(t,e="image/png"){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let i;if(t instanceof HTMLCanvasElement)i=t;else{ts===void 0&&(ts=dr("canvas")),ts.width=t.width,ts.height=t.height;let s=ts.getContext("2d");t instanceof ImageData?s.putImageData(t,0,0):s.drawImage(t,0,0,t.width,t.height),i=ts}return i.toDataURL(e)}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){let e=dr("canvas");e.width=t.width,e.height=t.height;let i=e.getContext("2d");i.drawImage(t,0,0,t.width,t.height);let s=i.getImageData(0,0,t.width,t.height),r=s.data;for(let o=0;o<r.length;o++)r[o]=en(r[o]/255)*255;return i.putImageData(s,0,0),e}else if(t.data){let e=t.data.slice(0);for(let i=0;i<e.length;i++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[i]=Math.floor(en(e[i]/255)*255):e[i]=en(e[i]);return{data:e,width:t.width,height:t.height}}else return qt("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}},np=0,bs=class{constructor(t=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:np++}),this.uuid=Bi(),this.data=t,this.dataReady=!0,this.version=0}getSize(t){let e=this.data;return typeof HTMLVideoElement<"u"&&e instanceof HTMLVideoElement?t.set(e.videoWidth,e.videoHeight,0):typeof VideoFrame<"u"&&e instanceof VideoFrame?t.set(e.displayWidth,e.displayHeight,0):e!==null?t.set(e.width,e.height,e.depth||0):t.set(0,0,0),t}set needsUpdate(t){t===!0&&this.version++}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];let i={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let o=0,a=s.length;o<a;o++)s[o].isDataTexture?r.push(cc(s[o].image)):r.push(cc(s[o]))}else r=cc(s);i.url=r}return e||(t.images[this.uuid]=i),i}};function cc(n){return typeof HTMLImageElement<"u"&&n instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&n instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&n instanceof ImageBitmap?la.getDataURL(n):n.data?{data:Array.from(n.data),width:n.width,height:n.height,type:n.data.constructor.name}:(qt("Texture: Unable to serialize Texture."),{})}var sp=0,hc=new D,We=class n extends Ri{constructor(t=n.DEFAULT_IMAGE,e=n.DEFAULT_MAPPING,i=xi,s=xi,r=Fe,o=Pn,a=ri,l=Qe,c=n.DEFAULT_ANISOTROPY,h=Di){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:sp++}),this.uuid=Bi(),this.name="",this.source=new bs(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=i,this.wrapT=s,this.magFilter=r,this.minFilter=o,this.anisotropy=c,this.format=a,this.internalFormat=null,this.type=l,this.offset=new tt(0,0),this.repeat=new tt(1,1),this.center=new tt(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Kt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(hc).x}get height(){return this.source.getSize(hc).y}get depth(){return this.source.getSize(hc).z}get image(){return this.source.data}set image(t){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.normalized=t.normalized,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.renderTarget=t.renderTarget,this.isRenderTargetTexture=t.isRenderTargetTexture,this.isArrayTexture=t.isArrayTexture,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}setValues(t){for(let e in t){let i=t[e];if(i===void 0){qt(`Texture.setValues(): parameter '${e}' has value of undefined.`);continue}let s=this[e];if(s===void 0){qt(`Texture.setValues(): property '${e}' does not exist.`);continue}s&&i&&s.isVector2&&i.isVector2||s&&i&&s.isVector3&&i.isVector3||s&&i&&s.isMatrix3&&i.isMatrix3?s.copy(i):this[e]=i}}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];let i={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),e||(t.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==Jc)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case hi:t.x=t.x-Math.floor(t.x);break;case xi:t.x=t.x<0?0:1;break;case oa:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case hi:t.y=t.y-Math.floor(t.y);break;case xi:t.y=t.y<0?0:1;break;case oa:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}};We.DEFAULT_IMAGE=null;We.DEFAULT_MAPPING=Jc;We.DEFAULT_ANISOTROPY=1;var xh=class xh{constructor(t=0,e=0,i=0,s=1){this.x=t,this.y=e,this.z=i,this.w=s}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,i,s){return this.x=t,this.y=e,this.z=i,this.w=s,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("THREE.Vector4: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){let e=this.x,i=this.y,s=this.z,r=this.w,o=t.elements;return this.x=o[0]*e+o[4]*i+o[8]*s+o[12]*r,this.y=o[1]*e+o[5]*i+o[9]*s+o[13]*r,this.z=o[2]*e+o[6]*i+o[10]*s+o[14]*r,this.w=o[3]*e+o[7]*i+o[11]*s+o[15]*r,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);let e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,i,s,r,l=t.elements,c=l[0],h=l[4],f=l[8],d=l[1],u=l[5],p=l[9],x=l[2],m=l[6],g=l[10];if(Math.abs(h-d)<.01&&Math.abs(f-x)<.01&&Math.abs(p-m)<.01){if(Math.abs(h+d)<.1&&Math.abs(f+x)<.1&&Math.abs(p+m)<.1&&Math.abs(c+u+g-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;let T=(c+1)/2,v=(u+1)/2,S=(g+1)/2,C=(h+d)/4,P=(f+x)/4,y=(p+m)/4;return T>v&&T>S?T<.01?(i=0,s=.707106781,r=.707106781):(i=Math.sqrt(T),s=C/i,r=P/i):v>S?v<.01?(i=.707106781,s=0,r=.707106781):(s=Math.sqrt(v),i=C/s,r=y/s):S<.01?(i=.707106781,s=.707106781,r=0):(r=Math.sqrt(S),i=P/r,s=y/r),this.set(i,s,r,e),this}let b=Math.sqrt((m-p)*(m-p)+(f-x)*(f-x)+(d-h)*(d-h));return Math.abs(b)<.001&&(b=1),this.x=(m-p)/b,this.y=(f-x)/b,this.z=(d-h)/b,this.w=Math.acos((c+u+g-1)/2),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Qt(this.x,t.x,e.x),this.y=Qt(this.y,t.y,e.y),this.z=Qt(this.z,t.z,e.z),this.w=Qt(this.w,t.w,e.w),this}clampScalar(t,e){return this.x=Qt(this.x,t,e),this.y=Qt(this.y,t,e),this.z=Qt(this.z,t,e),this.w=Qt(this.w,t,e),this}clampLength(t,e){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Qt(i,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,i){return this.x=t.x+(e.x-t.x)*i,this.y=t.y+(e.y-t.y)*i,this.z=t.z+(e.z-t.z)*i,this.w=t.w+(e.w-t.w)*i,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}};xh.prototype.isVector4=!0;var xe=xh,ca=class extends Ri{constructor(t=1,e=1,i={}){super(),i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Fe,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},i),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=i.depth,this.scissor=new xe(0,0,t,e),this.scissorTest=!1,this.viewport=new xe(0,0,t,e),this.textures=[];let s={width:t,height:e,depth:i.depth},r=new We(s),o=i.count;for(let a=0;a<o;a++)this.textures[a]=r.clone(),this.textures[a].isRenderTargetTexture=!0,this.textures[a].renderTarget=this;this._setTextureOptions(i),this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveColorBuffer=i.resolveColorBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this.storeMultisampledColorBuffer=i.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=i.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=i.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=i.depthTexture,this.samples=i.samples,this.multiview=i.multiview,this.useArrayDepthTexture=i.useArrayDepthTexture}_setTextureOptions(t={}){let e={minFilter:Fe,generateMipmaps:!1,flipY:!1,internalFormat:null};t.mapping!==void 0&&(e.mapping=t.mapping),t.wrapS!==void 0&&(e.wrapS=t.wrapS),t.wrapT!==void 0&&(e.wrapT=t.wrapT),t.wrapR!==void 0&&(e.wrapR=t.wrapR),t.magFilter!==void 0&&(e.magFilter=t.magFilter),t.minFilter!==void 0&&(e.minFilter=t.minFilter),t.format!==void 0&&(e.format=t.format),t.type!==void 0&&(e.type=t.type),t.anisotropy!==void 0&&(e.anisotropy=t.anisotropy),t.colorSpace!==void 0&&(e.colorSpace=t.colorSpace),t.flipY!==void 0&&(e.flipY=t.flipY),t.generateMipmaps!==void 0&&(e.generateMipmaps=t.generateMipmaps),t.internalFormat!==void 0&&(e.internalFormat=t.internalFormat);for(let i=0;i<this.textures.length;i++)this.textures[i].setValues(e)}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}set depthTexture(t){this._depthTexture!==null&&this._depthTexture.renderTarget===this&&(this._depthTexture.renderTarget=null),t!==null&&t.renderTarget===null&&(t.renderTarget=this),this._depthTexture=t}get depthTexture(){return this._depthTexture}setSize(t,e,i=1){if(this.width!==t||this.height!==e||this.depth!==i){this.width=t,this.height=e,this.depth=i;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=t,this.textures[s].image.height=e,this.textures[s].image.depth=i,this.textures[s].isData3DTexture!==!0&&(this.textures[s].isArrayTexture=this.textures[s].image.depth>1);this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let e=0,i=t.textures.length;e<i;e++){this.textures[e]=t.textures[e].clone(),this.textures[e].isRenderTargetTexture=!0,this.textures[e].renderTarget=this;let s=Object.assign({},t.textures[e].image);this.textures[e].source=new bs(s)}if(this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveColorBuffer=t.resolveColorBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,this.storeMultisampledColorBuffer=t.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=t.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=t.storeMultisampledStencilBuffer,t.depthTexture!==null)if(t.depthTexture.renderTarget===t){let e=t.depthTexture.clone();e.renderTarget=null,this.depthTexture=e}else this.depthTexture=t.depthTexture;return this.samples=t.samples,this.multiview=t.multiview,this.useArrayDepthTexture=t.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},he=class extends ca{constructor(t=1,e=1,i={}){super(t,e,i),this.isWebGLRenderTarget=!0}},pr=class extends We{constructor(t=null,e=1,i=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:i,depth:s},this.magFilter=Se,this.minFilter=Se,this.wrapR=xi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(t){return super.copy(t),this.wrapR=t.wrapR,this}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}};var ha=class extends We{constructor(t=null,e=1,i=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:i,depth:s},this.magFilter=Se,this.minFilter=Se,this.wrapR=xi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(t){return super.copy(t),this.wrapR=t.wrapR,this}};var Ua=class Ua{constructor(t,e,i,s,r,o,a,l,c,h,f,d,u,p,x,m){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,i,s,r,o,a,l,c,h,f,d,u,p,x,m)}set(t,e,i,s,r,o,a,l,c,h,f,d,u,p,x,m){let g=this.elements;return g[0]=t,g[4]=e,g[8]=i,g[12]=s,g[1]=r,g[5]=o,g[9]=a,g[13]=l,g[2]=c,g[6]=h,g[10]=f,g[14]=d,g[3]=u,g[7]=p,g[11]=x,g[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Ua().fromArray(this.elements)}copy(t){let e=this.elements,i=t.elements;return e[0]=i[0],e[1]=i[1],e[2]=i[2],e[3]=i[3],e[4]=i[4],e[5]=i[5],e[6]=i[6],e[7]=i[7],e[8]=i[8],e[9]=i[9],e[10]=i[10],e[11]=i[11],e[12]=i[12],e[13]=i[13],e[14]=i[14],e[15]=i[15],this}copyPosition(t){let e=this.elements,i=t.elements;return e[12]=i[12],e[13]=i[13],e[14]=i[14],this}setFromMatrix3(t){let e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,i){return this.determinantAffine()===0?(t.set(1,0,0),e.set(0,1,0),i.set(0,0,1),this):(t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this)}makeBasis(t,e,i){return this.set(t.x,e.x,i.x,0,t.y,e.y,i.y,0,t.z,e.z,i.z,0,0,0,0,1),this}extractRotation(t){if(t.determinantAffine()===0)return this.identity();let e=this.elements,i=t.elements,s=1/es.setFromMatrixColumn(t,0).length(),r=1/es.setFromMatrixColumn(t,1).length(),o=1/es.setFromMatrixColumn(t,2).length();return e[0]=i[0]*s,e[1]=i[1]*s,e[2]=i[2]*s,e[3]=0,e[4]=i[4]*r,e[5]=i[5]*r,e[6]=i[6]*r,e[7]=0,e[8]=i[8]*o,e[9]=i[9]*o,e[10]=i[10]*o,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){let e=this.elements,i=t.x,s=t.y,r=t.z,o=Math.cos(i),a=Math.sin(i),l=Math.cos(s),c=Math.sin(s),h=Math.cos(r),f=Math.sin(r);if(t.order==="XYZ"){let d=o*h,u=o*f,p=a*h,x=a*f;e[0]=l*h,e[4]=-l*f,e[8]=c,e[1]=u+p*c,e[5]=d-x*c,e[9]=-a*l,e[2]=x-d*c,e[6]=p+u*c,e[10]=o*l}else if(t.order==="YXZ"){let d=l*h,u=l*f,p=c*h,x=c*f;e[0]=d+x*a,e[4]=p*a-u,e[8]=o*c,e[1]=o*f,e[5]=o*h,e[9]=-a,e[2]=u*a-p,e[6]=x+d*a,e[10]=o*l}else if(t.order==="ZXY"){let d=l*h,u=l*f,p=c*h,x=c*f;e[0]=d-x*a,e[4]=-o*f,e[8]=p+u*a,e[1]=u+p*a,e[5]=o*h,e[9]=x-d*a,e[2]=-o*c,e[6]=a,e[10]=o*l}else if(t.order==="ZYX"){let d=o*h,u=o*f,p=a*h,x=a*f;e[0]=l*h,e[4]=p*c-u,e[8]=d*c+x,e[1]=l*f,e[5]=x*c+d,e[9]=u*c-p,e[2]=-c,e[6]=a*l,e[10]=o*l}else if(t.order==="YZX"){let d=o*l,u=o*c,p=a*l,x=a*c;e[0]=l*h,e[4]=x-d*f,e[8]=p*f+u,e[1]=f,e[5]=o*h,e[9]=-a*h,e[2]=-c*h,e[6]=u*f+p,e[10]=d-x*f}else if(t.order==="XZY"){let d=o*l,u=o*c,p=a*l,x=a*c;e[0]=l*h,e[4]=-f,e[8]=c*h,e[1]=d*f+x,e[5]=o*h,e[9]=u*f-p,e[2]=p*f-u,e[6]=a*h,e[10]=x*f+d}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(rp,t,op)}lookAt(t,e,i){let s=this.elements;return li.subVectors(t,e),li.lengthSq()===0&&(li.z=1),li.normalize(),un.crossVectors(i,li),un.lengthSq()===0&&(Math.abs(i.z)===1?li.x+=1e-4:li.z+=1e-4,li.normalize(),un.crossVectors(i,li)),un.normalize(),Eo.crossVectors(li,un),s[0]=un.x,s[4]=Eo.x,s[8]=li.x,s[1]=un.y,s[5]=Eo.y,s[9]=li.y,s[2]=un.z,s[6]=Eo.z,s[10]=li.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let i=t.elements,s=e.elements,r=this.elements,o=i[0],a=i[4],l=i[8],c=i[12],h=i[1],f=i[5],d=i[9],u=i[13],p=i[2],x=i[6],m=i[10],g=i[14],b=i[3],T=i[7],v=i[11],S=i[15],C=s[0],P=s[4],y=s[8],A=s[12],U=s[1],I=s[5],M=s[9],E=s[13],R=s[2],N=s[6],O=s[10],F=s[14],V=s[3],k=s[7],W=s[11],j=s[15];return r[0]=o*C+a*U+l*R+c*V,r[4]=o*P+a*I+l*N+c*k,r[8]=o*y+a*M+l*O+c*W,r[12]=o*A+a*E+l*F+c*j,r[1]=h*C+f*U+d*R+u*V,r[5]=h*P+f*I+d*N+u*k,r[9]=h*y+f*M+d*O+u*W,r[13]=h*A+f*E+d*F+u*j,r[2]=p*C+x*U+m*R+g*V,r[6]=p*P+x*I+m*N+g*k,r[10]=p*y+x*M+m*O+g*W,r[14]=p*A+x*E+m*F+g*j,r[3]=b*C+T*U+v*R+S*V,r[7]=b*P+T*I+v*N+S*k,r[11]=b*y+T*M+v*O+S*W,r[15]=b*A+T*E+v*F+S*j,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){let t=this.elements,e=t[0],i=t[4],s=t[8],r=t[12],o=t[1],a=t[5],l=t[9],c=t[13],h=t[2],f=t[6],d=t[10],u=t[14],p=t[3],x=t[7],m=t[11],g=t[15],b=l*u-c*d,T=a*u-c*f,v=a*d-l*f,S=o*u-c*h,C=o*d-l*h,P=o*f-a*h;return e*(x*b-m*T+g*v)-i*(p*b-m*S+g*C)+s*(p*T-x*S+g*P)-r*(p*v-x*C+m*P)}determinantAffine(){let t=this.elements,e=t[0],i=t[4],s=t[8],r=t[1],o=t[5],a=t[9],l=t[2],c=t[6],h=t[10];return e*(o*h-a*c)-i*(r*h-a*l)+s*(r*c-o*l)}transpose(){let t=this.elements,e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,i){let s=this.elements;return t.isVector3?(s[12]=t.x,s[13]=t.y,s[14]=t.z):(s[12]=t,s[13]=e,s[14]=i),this}invert(){let t=this.elements,e=t[0],i=t[1],s=t[2],r=t[3],o=t[4],a=t[5],l=t[6],c=t[7],h=t[8],f=t[9],d=t[10],u=t[11],p=t[12],x=t[13],m=t[14],g=t[15],b=e*a-i*o,T=e*l-s*o,v=e*c-r*o,S=i*l-s*a,C=i*c-r*a,P=s*c-r*l,y=h*x-f*p,A=h*m-d*p,U=h*g-u*p,I=f*m-d*x,M=f*g-u*x,E=d*g-u*m,R=b*E-T*M+v*I+S*U-C*A+P*y;if(R===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let N=1/R;return t[0]=(a*E-l*M+c*I)*N,t[1]=(s*M-i*E-r*I)*N,t[2]=(x*P-m*C+g*S)*N,t[3]=(d*C-f*P-u*S)*N,t[4]=(l*U-o*E-c*A)*N,t[5]=(e*E-s*U+r*A)*N,t[6]=(m*v-p*P-g*T)*N,t[7]=(h*P-d*v+u*T)*N,t[8]=(o*M-a*U+c*y)*N,t[9]=(i*U-e*M-r*y)*N,t[10]=(p*C-x*v+g*b)*N,t[11]=(f*v-h*C-u*b)*N,t[12]=(a*A-o*I-l*y)*N,t[13]=(e*I-i*A+s*y)*N,t[14]=(x*T-p*S-m*b)*N,t[15]=(h*S-f*T+d*b)*N,this}scale(t){let e=this.elements,i=t.x,s=t.y,r=t.z;return e[0]*=i,e[4]*=s,e[8]*=r,e[1]*=i,e[5]*=s,e[9]*=r,e[2]*=i,e[6]*=s,e[10]*=r,e[3]*=i,e[7]*=s,e[11]*=r,this}getMaxScaleOnAxis(){let t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],i=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],s=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,i,s))}makeTranslation(t,e,i){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,i,0,0,0,1),this}makeRotationX(t){let e=Math.cos(t),i=Math.sin(t);return this.set(1,0,0,0,0,e,-i,0,0,i,e,0,0,0,0,1),this}makeRotationY(t){let e=Math.cos(t),i=Math.sin(t);return this.set(e,0,i,0,0,1,0,0,-i,0,e,0,0,0,0,1),this}makeRotationZ(t){let e=Math.cos(t),i=Math.sin(t);return this.set(e,-i,0,0,i,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){let i=Math.cos(e),s=Math.sin(e),r=1-i,o=t.x,a=t.y,l=t.z,c=r*o,h=r*a;return this.set(c*o+i,c*a-s*l,c*l+s*a,0,c*a+s*l,h*a+i,h*l-s*o,0,c*l-s*a,h*l+s*o,r*l*l+i,0,0,0,0,1),this}makeScale(t,e,i){return this.set(t,0,0,0,0,e,0,0,0,0,i,0,0,0,0,1),this}makeShear(t,e,i,s,r,o){return this.set(1,i,r,0,t,1,o,0,e,s,1,0,0,0,0,1),this}compose(t,e,i){let s=this.elements,r=e._x,o=e._y,a=e._z,l=e._w,c=r+r,h=o+o,f=a+a,d=r*c,u=r*h,p=r*f,x=o*h,m=o*f,g=a*f,b=l*c,T=l*h,v=l*f,S=i.x,C=i.y,P=i.z;return s[0]=(1-(x+g))*S,s[1]=(u+v)*S,s[2]=(p-T)*S,s[3]=0,s[4]=(u-v)*C,s[5]=(1-(d+g))*C,s[6]=(m+b)*C,s[7]=0,s[8]=(p+T)*P,s[9]=(m-b)*P,s[10]=(1-(d+x))*P,s[11]=0,s[12]=t.x,s[13]=t.y,s[14]=t.z,s[15]=1,this}decompose(t,e,i){let s=this.elements;t.x=s[12],t.y=s[13],t.z=s[14];let r=this.determinantAffine();if(r===0)return i.set(1,1,1),e.identity(),this;let o=es.set(s[0],s[1],s[2]).length(),a=es.set(s[4],s[5],s[6]).length(),l=es.set(s[8],s[9],s[10]).length();r<0&&(o=-o),wi.copy(this);let c=1/o,h=1/a,f=1/l;return wi.elements[0]*=c,wi.elements[1]*=c,wi.elements[2]*=c,wi.elements[4]*=h,wi.elements[5]*=h,wi.elements[6]*=h,wi.elements[8]*=f,wi.elements[9]*=f,wi.elements[10]*=f,e.setFromRotationMatrix(wi),i.x=o,i.y=a,i.z=l,this}makePerspective(t,e,i,s,r,o,a=Ci,l=!1){let c=this.elements,h=2*r/(e-t),f=2*r/(i-s),d=(e+t)/(e-t),u=(i+s)/(i-s),p,x;if(l)p=r/(o-r),x=o*r/(o-r);else if(a===Ci)p=-(o+r)/(o-r),x=-2*o*r/(o-r);else if(a===_s)p=-o/(o-r),x=-o*r/(o-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return c[0]=h,c[4]=0,c[8]=d,c[12]=0,c[1]=0,c[5]=f,c[9]=u,c[13]=0,c[2]=0,c[6]=0,c[10]=p,c[14]=x,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(t,e,i,s,r,o,a=Ci,l=!1){let c=this.elements,h=2/(e-t),f=2/(i-s),d=-(e+t)/(e-t),u=-(i+s)/(i-s),p,x;if(l)p=1/(o-r),x=o/(o-r);else if(a===Ci)p=-2/(o-r),x=-(o+r)/(o-r);else if(a===_s)p=-1/(o-r),x=-r/(o-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return c[0]=h,c[4]=0,c[8]=0,c[12]=d,c[1]=0,c[5]=f,c[9]=0,c[13]=u,c[2]=0,c[6]=0,c[10]=p,c[14]=x,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(t){let e=this.elements,i=t.elements;for(let s=0;s<16;s++)if(e[s]!==i[s])return!1;return!0}fromArray(t,e=0){for(let i=0;i<16;i++)this.elements[i]=t[i+e];return this}toArray(t=[],e=0){let i=this.elements;return t[e]=i[0],t[e+1]=i[1],t[e+2]=i[2],t[e+3]=i[3],t[e+4]=i[4],t[e+5]=i[5],t[e+6]=i[6],t[e+7]=i[7],t[e+8]=i[8],t[e+9]=i[9],t[e+10]=i[10],t[e+11]=i[11],t[e+12]=i[12],t[e+13]=i[13],t[e+14]=i[14],t[e+15]=i[15],t}};Ua.prototype.isMatrix4=!0;var re=Ua,es=new D,wi=new re,rp=new D(0,0,0),op=new D(1,1,1),un=new D,Eo=new D,li=new D,hu=new re,uu=new ui,zi=class n{constructor(t=0,e=0,i=0,s=n.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=i,this._order=s}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,i,s=this._order){return this._x=t,this._y=e,this._z=i,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,i=!0){let s=t.elements,r=s[0],o=s[4],a=s[8],l=s[1],c=s[5],h=s[9],f=s[2],d=s[6],u=s[10];switch(e){case"XYZ":this._y=Math.asin(Qt(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-h,u),this._z=Math.atan2(-o,r)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Qt(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(a,u),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-f,r),this._z=0);break;case"ZXY":this._x=Math.asin(Qt(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-f,u),this._z=Math.atan2(-o,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-Qt(f,-1,1)),Math.abs(f)<.9999999?(this._x=Math.atan2(d,u),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-o,c));break;case"YZX":this._z=Math.asin(Qt(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-f,r)):(this._x=0,this._y=Math.atan2(a,u));break;case"XZY":this._z=Math.asin(-Qt(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(a,r)):(this._x=Math.atan2(-h,u),this._y=0);break;default:qt("Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,i===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,i){return hu.makeRotationFromQuaternion(t),this.setFromRotationMatrix(hu,e,i)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return uu.setFromEuler(this),this.setFromQuaternion(uu,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};zi.DEFAULT_ORDER="XYZ";var Ss=class{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}},ap=0,du=new D,is=new ui,ji=new re,To=new D,Ks=new D,lp=new D,cp=new ui,fu=new D(1,0,0),pu=new D(0,1,0),mu=new D(0,0,1),gu={type:"added"},hp={type:"removed"},ns={type:"childadded",child:null},uc={type:"childremoved",child:null},Xe=class n extends Ri{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:ap++}),this.uuid=Bi(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=n.DEFAULT_UP.clone();let t=new D,e=new zi,i=new ui,s=new D(1,1,1);function r(){i.setFromEuler(e,!1)}function o(){e.setFromQuaternion(i,void 0,!1)}e._onChange(r),i._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new re},normalMatrix:{value:new Kt}}),this.matrix=new re,this.matrixWorld=new re,this.matrixAutoUpdate=n.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=n.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Ss,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return is.setFromAxisAngle(t,e),this.quaternion.multiply(is),this}rotateOnWorldAxis(t,e){return is.setFromAxisAngle(t,e),this.quaternion.premultiply(is),this}rotateX(t){return this.rotateOnAxis(fu,t)}rotateY(t){return this.rotateOnAxis(pu,t)}rotateZ(t){return this.rotateOnAxis(mu,t)}translateOnAxis(t,e){return du.copy(t).applyQuaternion(this.quaternion),this.position.add(du.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(fu,t)}translateY(t){return this.translateOnAxis(pu,t)}translateZ(t){return this.translateOnAxis(mu,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(ji.copy(this.matrixWorld).invert())}lookAt(t,e,i){t.isVector3?To.copy(t):To.set(t,e,i);let s=this.parent;this.updateWorldMatrix(!0,!1),Ks.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?ji.lookAt(Ks,To,this.up):ji.lookAt(To,Ks,this.up),this.quaternion.setFromRotationMatrix(ji),s&&(ji.extractRotation(s.matrixWorld),is.setFromRotationMatrix(ji),this.quaternion.premultiply(is.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(Yt("Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(gu),ns.child=t,this.dispatchEvent(ns),ns.child=null):Yt("Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}let e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(hp),uc.child=t,this.dispatchEvent(uc),uc.child=null),this}removeFromParent(){let t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),ji.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),ji.multiply(t.parent.matrixWorld)),t.applyMatrix4(ji),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(gu),ns.child=t,this.dispatchEvent(ns),ns.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let i=0,s=this.children.length;i<s;i++){let o=this.children[i].getObjectByProperty(t,e);if(o!==void 0)return o}}getObjectsByProperty(t,e,i=[]){this[t]===e&&i.push(this);let s=this.children;for(let r=0,o=s.length;r<o;r++)s[r].getObjectsByProperty(t,e,i);return i}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ks,t,lp),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ks,cp,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);let e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}intersectsFrustum(){}traverse(t){t(this);let e=this.children;for(let i=0,s=e.length;i<s;i++)e[i].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);let e=this.children;for(let i=0,s=e.length;i<s;i++)e[i].traverseVisible(t)}traverseAncestors(t){let e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let t=this.pivot;if(t!==null){let e=t.x,i=t.y,s=t.z,r=this.matrix.elements;r[12]+=e-r[0]*e-r[4]*i-r[8]*s,r[13]+=i-r[1]*e-r[5]*i-r[9]*s,r[14]+=s-r[2]*e-r[6]*i-r[10]*s}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);let e=this.children;for(let i=0,s=e.length;i<s;i++)e[i].updateMatrixWorld(t)}updateWorldMatrix(t,e,i=!1){let s=this.parent;if(t===!0&&s!==null&&s.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||i)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,i=!0),e===!0){let r=this.children;for(let o=0,a=r.length;o<a;o++)r[o].updateWorldMatrix(!1,!0,i)}}toJSON(t){let e=t===void 0||typeof t=="string",i={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let s={};s.uuid=this.uuid,s.type=this.type,s.name=this.name,s.castShadow=this.castShadow,s.receiveShadow=this.receiveShadow,s.visible=this.visible,s.frustumCulled=this.frustumCulled,s.renderOrder=this.renderOrder,s.static=this.static,s.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.pivot!==null&&(s.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(s.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(s.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(a=>({...a,boundingBox:a.boundingBox?a.boundingBox.toJSON():void 0,boundingSphere:a.boundingSphere?a.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(a=>({...a})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(t),s.indirectTexture=this._indirectTexture.toJSON(t),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function r(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(t.geometries,this.geometry);let a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){let l=a.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){let f=l[c];r(t.shapes,f)}else r(t.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let a=[];for(let l=0,c=this.material.length;l<c;l++)a.push(r(t.materials,this.material[l]));s.material=a}else s.material=r(t.materials,this.material);if(this.children.length>0){s.children=[];for(let a=0;a<this.children.length;a++)s.children.push(this.children[a].toJSON(t).object)}if(this.animations.length>0){s.animations=[];for(let a=0;a<this.animations.length;a++){let l=this.animations[a];s.animations.push(r(t.animations,l))}}if(e){let a=o(t.geometries),l=o(t.materials),c=o(t.textures),h=o(t.images),f=o(t.shapes),d=o(t.skeletons),u=o(t.animations),p=o(t.nodes);a.length>0&&(i.geometries=a),l.length>0&&(i.materials=l),c.length>0&&(i.textures=c),h.length>0&&(i.images=h),f.length>0&&(i.shapes=f),d.length>0&&(i.skeletons=d),u.length>0&&(i.animations=u),p.length>0&&(i.nodes=p)}return i.object=s,i;function o(a){let l=[];for(let c in a){let h=a[c];delete h.metadata,l.push(h)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.pivot=t.pivot!==null?t.pivot.clone():null,this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.static=t.static,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let i=0;i<t.children.length;i++){let s=t.children[i];this.add(s.clone())}return this}dispose(){this.dispatchEvent({type:"dispose"})}};Xe.DEFAULT_UP=new D(0,1,0);Xe.DEFAULT_MATRIX_AUTO_UPDATE=!0;Xe.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var si=class extends Xe{constructor(){super(),this.isGroup=!0,this.type="Group"}},up={type:"move"},ws=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new si,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new si,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new D,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new D),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new si,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new D,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new D,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){let e=this._hand;if(e)for(let i of t.hand.values())this._getHandJoint(e,i)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,i){let s=null,r=null,o=null,a=this._targetRay,l=this._grip,c=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(c&&t.hand){o=!0;for(let x of t.hand.values()){let m=e.getJointPose(x,i),g=this._getHandJoint(c,x);m!==null&&(g.matrix.fromArray(m.transform.matrix),g.matrix.decompose(g.position,g.rotation,g.scale),g.matrixWorldNeedsUpdate=!0,g.jointRadius=m.radius),g.visible=m!==null}let h=c.joints["index-finger-tip"],f=c.joints["thumb-tip"],d=h.position.distanceTo(f.position),u=.02,p=.005;c.inputState.pinching&&d>u+p?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!c.inputState.pinching&&d<=u-p&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else l!==null&&t.gripSpace&&(r=e.getPose(t.gripSpace,i),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:t,target:this})));a!==null&&(s=e.getPose(t.targetRaySpace,i),s===null&&r!==null&&(s=r),s!==null&&(a.matrix.fromArray(s.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,s.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(s.linearVelocity)):a.hasLinearVelocity=!1,s.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(s.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(up)))}return a!==null&&(a.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=o!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){let i=new si;i.matrixAutoUpdate=!1,i.visible=!1,t.joints[e.jointName]=i,t.add(i)}return t.joints[e.jointName]}},yd={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},dn={h:0,s:0,l:0},Ao={h:0,s:0,l:0};function dc(n,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?n+(t-n)*6*e:e<1/2?t:e<2/3?n+(t-n)*6*(2/3-e):n}var Ft=class{constructor(t,e,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,i)}set(t,e,i){if(e===void 0&&i===void 0){let s=t;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(t,e,i);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=De){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,ie.colorSpaceToWorking(this,e),this}setRGB(t,e,i,s=ie.workingColorSpace){return this.r=t,this.g=e,this.b=i,ie.colorSpaceToWorking(this,s),this}setHSL(t,e,i,s=ie.workingColorSpace){if(t=ah(t,1),e=Qt(e,0,1),i=Qt(i,0,1),e===0)this.r=this.g=this.b=i;else{let r=i<=.5?i*(1+e):i+e-i*e,o=2*i-r;this.r=dc(o,r,t+1/3),this.g=dc(o,r,t),this.b=dc(o,r,t-1/3)}return ie.colorSpaceToWorking(this,s),this}setStyle(t,e=De){function i(r){r!==void 0&&parseFloat(r)<1&&qt("Color: Alpha component of "+t+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(t)){let r,o=s[1],a=s[2];switch(o){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,e);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:qt("Color: Unknown color model "+t)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(t)){let r=s[1],o=r.length;if(o===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(o===6)return this.setHex(parseInt(r,16),e);qt("Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=De){let i=yd[t.toLowerCase()];return i!==void 0?this.setHex(i,e):qt("Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=en(t.r),this.g=en(t.g),this.b=en(t.b),this}copyLinearToSRGB(t){return this.r=xs(t.r),this.g=xs(t.g),this.b=xs(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=De){return ie.workingToColorSpace(Je.copy(this),t),Math.round(Qt(Je.r*255,0,255))*65536+Math.round(Qt(Je.g*255,0,255))*256+Math.round(Qt(Je.b*255,0,255))}getHexString(t=De){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=ie.workingColorSpace){ie.workingToColorSpace(Je.copy(this),e);let i=Je.r,s=Je.g,r=Je.b,o=Math.max(i,s,r),a=Math.min(i,s,r),l,c,h=(a+o)/2;if(a===o)l=0,c=0;else{let f=o-a;switch(c=h<=.5?f/(o+a):f/(2-o-a),o){case i:l=(s-r)/f+(s<r?6:0);break;case s:l=(r-i)/f+2;break;case r:l=(i-s)/f+4;break}l/=6}return t.h=l,t.s=c,t.l=h,t}getRGB(t,e=ie.workingColorSpace){return ie.workingToColorSpace(Je.copy(this),e),t.r=Je.r,t.g=Je.g,t.b=Je.b,t}getStyle(t=De){ie.workingToColorSpace(Je.copy(this),t);let e=Je.r,i=Je.g,s=Je.b;return t!==De?`color(${t} ${e.toFixed(3)} ${i.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(i*255)},${Math.round(s*255)})`}offsetHSL(t,e,i){return this.getHSL(dn),this.setHSL(dn.h+t,dn.s+e,dn.l+i)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,i){return this.r=t.r+(e.r-t.r)*i,this.g=t.g+(e.g-t.g)*i,this.b=t.b+(e.b-t.b)*i,this}lerpHSL(t,e){this.getHSL(dn),t.getHSL(Ao);let i=or(dn.h,Ao.h,e),s=or(dn.s,Ao.s,e),r=or(dn.l,Ao.l,e);return this.setHSL(i,s,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){let e=this.r,i=this.g,s=this.b,r=t.elements;return this.r=r[0]*e+r[3]*i+r[6]*s,this.g=r[1]*e+r[4]*i+r[7]*s,this.b=r[2]*e+r[5]*i+r[8]*s,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Je=new Ft;Ft.NAMES=yd;var Es=class extends Xe{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new zi,this.environmentIntensity=1,this.environmentRotation=new zi,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){let e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),e.object.backgroundBlurriness=this.backgroundBlurriness,e.object.backgroundIntensity=this.backgroundIntensity,e.object.backgroundRotation=this.backgroundRotation.toArray(),e.object.environmentIntensity=this.environmentIntensity,e.object.environmentRotation=this.environmentRotation.toArray(),e}},Ei=new D,Ki=new D,fc=new D,Ji=new D,ss=new D,rs=new D,xu=new D,pc=new D,mc=new D,gc=new D,xc=new xe,vc=new xe,_c=new xe,tn=class n{constructor(t=new D,e=new D,i=new D){this.a=t,this.b=e,this.c=i}static getNormal(t,e,i,s){s.subVectors(i,e),Ei.subVectors(t,e),s.cross(Ei);let r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(t,e,i,s,r){Ei.subVectors(s,e),Ki.subVectors(i,e),fc.subVectors(t,e);let o=Ei.dot(Ei),a=Ei.dot(Ki),l=Ei.dot(fc),c=Ki.dot(Ki),h=Ki.dot(fc),f=o*c-a*a;if(f===0)return r.set(0,0,0),null;let d=1/f,u=(c*l-a*h)*d,p=(o*h-a*l)*d;return r.set(1-u-p,p,u)}static containsPoint(t,e,i,s){return this.getBarycoord(t,e,i,s,Ji)===null?!1:Ji.x>=0&&Ji.y>=0&&Ji.x+Ji.y<=1}static getInterpolation(t,e,i,s,r,o,a,l){return this.getBarycoord(t,e,i,s,Ji)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,Ji.x),l.addScaledVector(o,Ji.y),l.addScaledVector(a,Ji.z),l)}static getInterpolatedAttribute(t,e,i,s,r,o){return xc.setScalar(0),vc.setScalar(0),_c.setScalar(0),xc.fromBufferAttribute(t,e),vc.fromBufferAttribute(t,i),_c.fromBufferAttribute(t,s),o.setScalar(0),o.addScaledVector(xc,r.x),o.addScaledVector(vc,r.y),o.addScaledVector(_c,r.z),o}static isFrontFacing(t,e,i,s){return Ei.subVectors(i,e),Ki.subVectors(t,e),Ei.cross(Ki).dot(s)<0}set(t,e,i){return this.a.copy(t),this.b.copy(e),this.c.copy(i),this}setFromPointsAndIndices(t,e,i,s){return this.a.copy(t[e]),this.b.copy(t[i]),this.c.copy(t[s]),this}setFromAttributeAndIndices(t,e,i,s){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,i),this.c.fromBufferAttribute(t,s),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return Ei.subVectors(this.c,this.b),Ki.subVectors(this.a,this.b),Ei.cross(Ki).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return n.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return n.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,i,s,r){return n.getInterpolation(t,this.a,this.b,this.c,e,i,s,r)}containsPoint(t){return n.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return n.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){let i=this.a,s=this.b,r=this.c,o,a;ss.subVectors(s,i),rs.subVectors(r,i),pc.subVectors(t,i);let l=ss.dot(pc),c=rs.dot(pc);if(l<=0&&c<=0)return e.copy(i);mc.subVectors(t,s);let h=ss.dot(mc),f=rs.dot(mc);if(h>=0&&f<=h)return e.copy(s);let d=l*f-h*c;if(d<=0&&l>=0&&h<=0)return o=l/(l-h),e.copy(i).addScaledVector(ss,o);gc.subVectors(t,r);let u=ss.dot(gc),p=rs.dot(gc);if(p>=0&&u<=p)return e.copy(r);let x=u*c-l*p;if(x<=0&&c>=0&&p<=0)return a=c/(c-p),e.copy(i).addScaledVector(rs,a);let m=h*p-u*f;if(m<=0&&f-h>=0&&u-p>=0)return xu.subVectors(r,s),a=(f-h)/(f-h+(u-p)),e.copy(s).addScaledVector(xu,a);let g=1/(m+x+d);return o=x*g,a=d*g,e.copy(i).addScaledVector(ss,o).addScaledVector(rs,a)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}},gn=class{constructor(t=new D(1/0,1/0,1/0),e=new D(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,i=t.length;e<i;e+=3)this.expandByPoint(Ti.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,i=t.count;e<i;e++)this.expandByPoint(Ti.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,i=t.length;e<i;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){let i=Ti.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(i),this.max.copy(t).add(i),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);let i=t.geometry;if(i!==void 0){let r=i.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0)for(let o=0,a=r.count;o<a;o++)t.isMesh===!0?t.getVertexPosition(o,Ti):Ti.fromBufferAttribute(r,o),Ti.applyMatrix4(t.matrixWorld),this.expandByPoint(Ti);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),Co.copy(t.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),Co.copy(i.boundingBox)),Co.applyMatrix4(t.matrixWorld),this.union(Co)}let s=t.children;for(let r=0,o=s.length;r<o;r++)this.expandByObject(s[r],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,Ti),Ti.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,i;return t.normal.x>0?(e=t.normal.x*this.min.x,i=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,i=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,i+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,i+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,i+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,i+=t.normal.z*this.min.z),e<=-t.constant&&i>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(Js),Ro.subVectors(this.max,Js),os.subVectors(t.a,Js),as.subVectors(t.b,Js),ls.subVectors(t.c,Js),fn.subVectors(as,os),pn.subVectors(ls,as),Un.subVectors(os,ls);let e=[0,-fn.z,fn.y,0,-pn.z,pn.y,0,-Un.z,Un.y,fn.z,0,-fn.x,pn.z,0,-pn.x,Un.z,0,-Un.x,-fn.y,fn.x,0,-pn.y,pn.x,0,-Un.y,Un.x,0];return!yc(e,os,as,ls,Ro)||(e=[1,0,0,0,1,0,0,0,1],!yc(e,os,as,ls,Ro))?!1:(Po.crossVectors(fn,pn),e=[Po.x,Po.y,Po.z],yc(e,os,as,ls,Ro))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,Ti).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(Ti).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(Qi[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),Qi[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),Qi[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),Qi[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),Qi[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),Qi[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),Qi[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),Qi[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(Qi),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(t){return this.min.fromArray(t.min),this.max.fromArray(t.max),this}},Qi=[new D,new D,new D,new D,new D,new D,new D,new D],Ti=new D,Co=new gn,os=new D,as=new D,ls=new D,fn=new D,pn=new D,Un=new D,Js=new D,Ro=new D,Po=new D,Fn=new D;function yc(n,t,e,i,s){for(let r=0,o=n.length-3;r<=o;r+=3){Fn.fromArray(n,r);let a=s.x*Math.abs(Fn.x)+s.y*Math.abs(Fn.y)+s.z*Math.abs(Fn.z),l=t.dot(Fn),c=e.dot(Fn),h=i.dot(Fn);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>a)return!1}return!0}var Pe=new D,Lo=new tt,dp=0,Ue=class extends Ri{constructor(t,e,i=!1){if(super(),Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:dp++}),this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=i,this.usage=rh,this.updateRanges=[],this.gpuType=Ii,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,i){t*=this.itemSize,i*=e.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[t+s]=e.array[i+s];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,i=this.count;e<i;e++)Lo.fromBufferAttribute(this,e),Lo.applyMatrix3(t),this.setXY(e,Lo.x,Lo.y);else if(this.itemSize===3)for(let e=0,i=this.count;e<i;e++)Pe.fromBufferAttribute(this,e),Pe.applyMatrix3(t),this.setXYZ(e,Pe.x,Pe.y,Pe.z);return this}applyMatrix4(t){for(let e=0,i=this.count;e<i;e++)Pe.fromBufferAttribute(this,e),Pe.applyMatrix4(t),this.setXYZ(e,Pe.x,Pe.y,Pe.z);return this}applyNormalMatrix(t){for(let e=0,i=this.count;e<i;e++)Pe.fromBufferAttribute(this,e),Pe.applyNormalMatrix(t),this.setXYZ(e,Pe.x,Pe.y,Pe.z);return this}transformDirection(t){for(let e=0,i=this.count;e<i;e++)Pe.fromBufferAttribute(this,e),Pe.transformDirection(t),this.setXYZ(e,Pe.x,Pe.y,Pe.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let i=this.array[t*this.itemSize+e];return this.normalized&&(i=Ai(i,this.array)),i}setComponent(t,e,i){return this.normalized&&(i=fe(i,this.array)),this.array[t*this.itemSize+e]=i,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=Ai(e,this.array)),e}setX(t,e){return this.normalized&&(e=fe(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=Ai(e,this.array)),e}setY(t,e){return this.normalized&&(e=fe(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=Ai(e,this.array)),e}setZ(t,e){return this.normalized&&(e=fe(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=Ai(e,this.array)),e}setW(t,e){return this.normalized&&(e=fe(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,i){return t*=this.itemSize,this.normalized&&(e=fe(e,this.array),i=fe(i,this.array)),this.array[t+0]=e,this.array[t+1]=i,this}setXYZ(t,e,i,s){return t*=this.itemSize,this.normalized&&(e=fe(e,this.array),i=fe(i,this.array),s=fe(s,this.array)),this.array[t+0]=e,this.array[t+1]=i,this.array[t+2]=s,this}setXYZW(t,e,i,s,r){return t*=this.itemSize,this.normalized&&(e=fe(e,this.array),i=fe(i,this.array),s=fe(s,this.array),r=fe(r,this.array)),this.array[t+0]=e,this.array[t+1]=i,this.array[t+2]=s,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return t.name=this.name,t.usage=this.usage,t.gpuType=this.gpuType,t}dispose(){this.dispatchEvent({type:"dispose"})}};var mr=class extends Ue{constructor(t,e,i){super(new Uint16Array(t),e,i)}};var gr=class extends Ue{constructor(t,e,i){super(new Uint32Array(t),e,i)}};var oe=class extends Ue{constructor(t,e,i){super(new Float32Array(t),e,i)}},fp=new gn,Qs=new D,Mc=new D,zn=class{constructor(t=new D,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){let i=this.center;e!==void 0?i.copy(e):fp.setFromPoints(t).getCenter(i);let s=0;for(let r=0,o=t.length;r<o;r++)s=Math.max(s,i.distanceToSquared(t[r]));return this.radius=Math.sqrt(s),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){let e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){let i=this.center.distanceToSquared(t);return e.copy(t),i>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;Qs.subVectors(t,this.center);let e=Qs.lengthSq();if(e>this.radius*this.radius){let i=Math.sqrt(e),s=(i-this.radius)*.5;this.center.addScaledVector(Qs,s/i),this.radius+=s}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(Mc.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(Qs.copy(t.center).add(Mc)),this.expandByPoint(Qs.copy(t.center).sub(Mc))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(t){return this.radius=t.radius,this.center.fromArray(t.center),this}},pp=0,gi=new re,bc=new Xe,cs=new D,ci=new gn,$s=new gn,Ge=new D,we=class n extends Ri{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:pp++}),this.uuid=Bi(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(Bf(t)?gr:mr)(t,1):this.index=t,this}setIndirect(t,e=0){return this.indirect=t,this.indirectOffset=e,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,i=0){this.groups.push({start:t,count:e,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){let e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);let i=this.attributes.normal;if(i!==void 0){let r=new Kt().getNormalMatrix(t);i.applyNormalMatrix(r),i.needsUpdate=!0}let s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(t),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(t){return gi.makeRotationFromQuaternion(t),this.applyMatrix4(gi),this}rotateX(t){return gi.makeRotationX(t),this.applyMatrix4(gi),this}rotateY(t){return gi.makeRotationY(t),this.applyMatrix4(gi),this}rotateZ(t){return gi.makeRotationZ(t),this.applyMatrix4(gi),this}translate(t,e,i){return gi.makeTranslation(t,e,i),this.applyMatrix4(gi),this}scale(t,e,i){return gi.makeScale(t,e,i),this.applyMatrix4(gi),this}lookAt(t){return bc.lookAt(t),bc.updateMatrix(),this.applyMatrix4(bc.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(cs).negate(),this.translate(cs.x,cs.y,cs.z),this}setFromPoints(t){let e=this.getAttribute("position");if(e===void 0){let i=[];for(let s=0,r=t.length;s<r;s++){let o=t[s];i.push(o.x,o.y,o.z||0)}this.setAttribute("position",new oe(i,3))}else{let i=Math.min(t.length,e.count);for(let s=0;s<i;s++){let r=t[s];e.setXYZ(s,r.x,r.y,r.z||0)}t.length>e.count&&qt("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new gn);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){Yt("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new D(-1/0,-1/0,-1/0),new D(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let i=0,s=e.length;i<s;i++){let r=e[i];ci.setFromBufferAttribute(r),this.morphTargetsRelative?(Ge.addVectors(this.boundingBox.min,ci.min),this.boundingBox.expandByPoint(Ge),Ge.addVectors(this.boundingBox.max,ci.max),this.boundingBox.expandByPoint(Ge)):(this.boundingBox.expandByPoint(ci.min),this.boundingBox.expandByPoint(ci.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&Yt('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new zn);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){Yt("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new D,1/0);return}if(t){let i=this.boundingSphere.center;if(ci.setFromBufferAttribute(t),e)for(let r=0,o=e.length;r<o;r++){let a=e[r];$s.setFromBufferAttribute(a),this.morphTargetsRelative?(Ge.addVectors(ci.min,$s.min),ci.expandByPoint(Ge),Ge.addVectors(ci.max,$s.max),ci.expandByPoint(Ge)):(ci.expandByPoint($s.min),ci.expandByPoint($s.max))}ci.getCenter(i);let s=0;for(let r=0,o=t.count;r<o;r++)Ge.fromBufferAttribute(t,r),s=Math.max(s,i.distanceToSquared(Ge));if(e)for(let r=0,o=e.length;r<o;r++){let a=e[r],l=this.morphTargetsRelative;for(let c=0,h=a.count;c<h;c++)Ge.fromBufferAttribute(a,c),l&&(cs.fromBufferAttribute(t,c),Ge.add(cs)),s=Math.max(s,i.distanceToSquared(Ge))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&Yt('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){Yt("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let i=e.position,s=e.normal,r=e.uv,o=this.getAttribute("tangent");(o===void 0||o.count!==i.count)&&(o=new Ue(new Float32Array(4*i.count),4),this.setAttribute("tangent",o));let a=[],l=[];for(let y=0;y<i.count;y++)a[y]=new D,l[y]=new D;let c=new D,h=new D,f=new D,d=new tt,u=new tt,p=new tt,x=new D,m=new D;function g(y,A,U){c.fromBufferAttribute(i,y),h.fromBufferAttribute(i,A),f.fromBufferAttribute(i,U),d.fromBufferAttribute(r,y),u.fromBufferAttribute(r,A),p.fromBufferAttribute(r,U),h.sub(c),f.sub(c),u.sub(d),p.sub(d);let I=1/(u.x*p.y-p.x*u.y);isFinite(I)&&(x.copy(h).multiplyScalar(p.y).addScaledVector(f,-u.y).multiplyScalar(I),m.copy(f).multiplyScalar(u.x).addScaledVector(h,-p.x).multiplyScalar(I),a[y].add(x),a[A].add(x),a[U].add(x),l[y].add(m),l[A].add(m),l[U].add(m))}let b=this.groups;b.length===0&&(b=[{start:0,count:t.count}]);for(let y=0,A=b.length;y<A;++y){let U=b[y],I=U.start,M=U.count;for(let E=I,R=I+M;E<R;E+=3)g(t.getX(E+0),t.getX(E+1),t.getX(E+2))}let T=new D,v=new D,S=new D,C=new D;function P(y){S.fromBufferAttribute(s,y),C.copy(S);let A=a[y];T.copy(A),T.sub(S.multiplyScalar(S.dot(A))).normalize(),v.crossVectors(C,A);let I=v.dot(l[y])<0?-1:1;o.setXYZW(y,T.x,T.y,T.z,I)}for(let y=0,A=b.length;y<A;++y){let U=b[y],I=U.start,M=U.count;for(let E=I,R=I+M;E<R;E+=3)P(t.getX(E+0)),P(t.getX(E+1)),P(t.getX(E+2))}this._transformed=!0}computeVertexNormals(){let t=this.index,e=this.getAttribute("position");if(e!==void 0){let i=this.getAttribute("normal");if(i===void 0||i.count!==e.count)i=new Ue(new Float32Array(e.count*3),3),this.setAttribute("normal",i);else for(let d=0,u=i.count;d<u;d++)i.setXYZ(d,0,0,0);let s=new D,r=new D,o=new D,a=new D,l=new D,c=new D,h=new D,f=new D;if(t)for(let d=0,u=t.count;d<u;d+=3){let p=t.getX(d+0),x=t.getX(d+1),m=t.getX(d+2);s.fromBufferAttribute(e,p),r.fromBufferAttribute(e,x),o.fromBufferAttribute(e,m),h.subVectors(o,r),f.subVectors(s,r),h.cross(f),a.fromBufferAttribute(i,p),l.fromBufferAttribute(i,x),c.fromBufferAttribute(i,m),a.add(h),l.add(h),c.add(h),i.setXYZ(p,a.x,a.y,a.z),i.setXYZ(x,l.x,l.y,l.z),i.setXYZ(m,c.x,c.y,c.z)}else for(let d=0,u=e.count;d<u;d+=3)s.fromBufferAttribute(e,d+0),r.fromBufferAttribute(e,d+1),o.fromBufferAttribute(e,d+2),h.subVectors(o,r),f.subVectors(s,r),h.cross(f),i.setXYZ(d+0,h.x,h.y,h.z),i.setXYZ(d+1,h.x,h.y,h.z),i.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){let t=this.attributes.normal;for(let e=0,i=t.count;e<i;e++)Ge.fromBufferAttribute(t,e),Ge.normalize(),t.setXYZ(e,Ge.x,Ge.y,Ge.z)}toNonIndexed(){function t(a,l){let c=a.array,h=a.itemSize,f=a.normalized,d=new c.constructor(l.length*h),u=0,p=0;for(let x=0,m=l.length;x<m;x++){a.isInterleavedBufferAttribute?u=l[x]*a.data.stride+a.offset:u=l[x]*h;for(let g=0;g<h;g++)d[p++]=c[u++]}return new Ue(d,h,f)}if(this.index===null)return qt("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let e=new n,i=this.index.array,s=this.attributes;for(let a in s){let l=s[a],c=t(l,i);e.setAttribute(a,c)}let r=this.morphAttributes;for(let a in r){let l=[],c=r[a];for(let h=0,f=c.length;h<f;h++){let d=c[h],u=t(d,i);l.push(u)}e.morphAttributes[a]=l}e.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let a=0,l=o.length;a<l;a++){let c=o[a];e.addGroup(c.start,c.count,c.materialIndex)}return e}toJSON(){let t={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,t.name=this.name,Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(t[c]=l[c]);return t}t.data={attributes:{}};let e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});let i=this.attributes;for(let l in i){let c=i[l];t.data.attributes[l]=c.toJSON(t.data)}let s={},r=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],h=[];for(let f=0,d=c.length;f<d;f++){let u=c[f];h.push(u.toJSON(t.data))}h.length>0&&(s[l]=h,r=!0)}r&&(t.data.morphAttributes=s,t.data.morphTargetsRelative=this.morphTargetsRelative);let o=this.groups;o.length>0&&(t.data.groups=JSON.parse(JSON.stringify(o)));let a=this.boundingSphere;return a!==null&&(t.data.boundingSphere=a.toJSON()),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let e={};this.name=t.name;let i=t.index;i!==null&&this.setIndex(i.clone());let s=t.attributes;for(let c in s){let h=s[c];this.setAttribute(c,h.clone(e))}let r=t.morphAttributes;for(let c in r){let h=[],f=r[c];for(let d=0,u=f.length;d<u;d++)h.push(f[d].clone(e));this.morphAttributes[c]=h}this.morphTargetsRelative=t.morphTargetsRelative;let o=t.groups;for(let c=0,h=o.length;c<h;c++){let f=o[c];this.addGroup(f.start,f.count,f.materialIndex)}let a=t.boundingBox;a!==null&&(this.boundingBox=a.clone());let l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this._transformed=t._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}},xr=class{constructor(t,e){this.isInterleavedBuffer=!0,this.array=t,this.stride=e,this.count=t!==void 0?t.length/e:0,this.usage=rh,this.updateRanges=[],this.version=0,this.uuid=Bi()}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.array=new t.array.constructor(t.array),this.count=t.count,this.stride=t.stride,this.usage=t.usage,this}copyAt(t,e,i){t*=this.stride,i*=e.stride;for(let s=0,r=this.stride;s<r;s++)this.array[t+s]=e.array[i+s];return this}set(t,e=0){return this.array.set(t,e),this}clone(t){t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Bi()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);let e=new this.array.constructor(t.arrayBuffers[this.array.buffer._uuid]),i=new this.constructor(e,this.stride);return i.setUsage(this.usage),i}onUpload(t){return this.onUploadCallback=t,this}toJSON(t){t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Bi()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer)));let e={uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride};return e.usage=this.usage,e}},ei=new D,Ts=class n{constructor(t,e,i,s=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=t,this.itemSize=e,this.offset=i,this.normalized=s}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(t){this.data.needsUpdate=t}applyMatrix4(t){for(let e=0,i=this.data.count;e<i;e++)ei.fromBufferAttribute(this,e),ei.applyMatrix4(t),this.setXYZ(e,ei.x,ei.y,ei.z);return this}applyNormalMatrix(t){for(let e=0,i=this.count;e<i;e++)ei.fromBufferAttribute(this,e),ei.applyNormalMatrix(t),this.setXYZ(e,ei.x,ei.y,ei.z);return this}transformDirection(t){for(let e=0,i=this.count;e<i;e++)ei.fromBufferAttribute(this,e),ei.transformDirection(t),this.setXYZ(e,ei.x,ei.y,ei.z);return this}getComponent(t,e){let i=this.array[t*this.data.stride+this.offset+e];return this.normalized&&(i=Ai(i,this.array)),i}setComponent(t,e,i){return this.normalized&&(i=fe(i,this.array)),this.data.array[t*this.data.stride+this.offset+e]=i,this}setX(t,e){return this.normalized&&(e=fe(e,this.array)),this.data.array[t*this.data.stride+this.offset]=e,this}setY(t,e){return this.normalized&&(e=fe(e,this.array)),this.data.array[t*this.data.stride+this.offset+1]=e,this}setZ(t,e){return this.normalized&&(e=fe(e,this.array)),this.data.array[t*this.data.stride+this.offset+2]=e,this}setW(t,e){return this.normalized&&(e=fe(e,this.array)),this.data.array[t*this.data.stride+this.offset+3]=e,this}getX(t){let e=this.data.array[t*this.data.stride+this.offset];return this.normalized&&(e=Ai(e,this.array)),e}getY(t){let e=this.data.array[t*this.data.stride+this.offset+1];return this.normalized&&(e=Ai(e,this.array)),e}getZ(t){let e=this.data.array[t*this.data.stride+this.offset+2];return this.normalized&&(e=Ai(e,this.array)),e}getW(t){let e=this.data.array[t*this.data.stride+this.offset+3];return this.normalized&&(e=Ai(e,this.array)),e}setXY(t,e,i){return t=t*this.data.stride+this.offset,this.normalized&&(e=fe(e,this.array),i=fe(i,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=i,this}setXYZ(t,e,i,s){return t=t*this.data.stride+this.offset,this.normalized&&(e=fe(e,this.array),i=fe(i,this.array),s=fe(s,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=i,this.data.array[t+2]=s,this}setXYZW(t,e,i,s,r){return t=t*this.data.stride+this.offset,this.normalized&&(e=fe(e,this.array),i=fe(i,this.array),s=fe(s,this.array),r=fe(r,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=i,this.data.array[t+2]=s,this.data.array[t+3]=r,this}clone(t){if(t===void 0){fr("InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");let e=[];for(let i=0;i<this.count;i++){let s=i*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[s+r])}return new Ue(new this.array.constructor(e),this.itemSize,this.normalized)}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.clone(t)),new n(t.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(t){if(t===void 0){fr("InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");let e=[];for(let i=0;i<this.count;i++){let s=i*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[s+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:e,normalized:this.normalized}}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.toJSON(t)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}},Sc=new D,mp=new D,gp=new Kt,qe=class{constructor(t=new D(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,i,s){return this.normal.set(t,e,i),this.constant=s,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,i){let s=Sc.subVectors(i,e).cross(mp.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(s,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){let t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e,i=!0){let s=t.delta(Sc),r=this.normal.dot(s);if(r===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;let o=-(t.start.dot(this.normal)+this.constant)/r;return i===!0&&(o<0||o>1)?null:e.copy(t.start).addScaledVector(s,o)}intersectsLine(t){let e=this.distanceToPoint(t.start),i=this.distanceToPoint(t.end);return e<0&&i>0||i<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){let i=e||gp.getNormalMatrix(t),s=this.coplanarPoint(Sc).applyMatrix4(t),r=this.normal.applyMatrix3(i).normalize();return this.constant=-s.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(t){return this.normal.fromArray(t.normal),this.constant=t.constant,this}},xp=0,vi=class extends Ri{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:xp++}),this.uuid=Bi(),this.name="",this.type="Material",this.blending=Fs,this.side=An,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=jc,this.blendDst=Kc,this.blendEquation=_i,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Ft(0,0,0),this.blendAlpha=0,this.depthFunc=vs,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=cd,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Qo,this.stencilZFail=Qo,this.stencilZPass=Qo,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(let e in t){let i=t[e];if(i===void 0){qt(`Material: parameter '${e}' has value of undefined.`);continue}let s=this[e];if(s===void 0){qt(`Material: '${e}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(i):s&&s.isVector2&&i&&i.isVector2||s&&s.isEuler&&i&&i.isEuler||s&&s.isVector3&&i&&i.isVector3?s.copy(i):this[e]=i}}toJSON(t){let e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});let i={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,i.blending=this.blending,i.side=this.side,i.shadowSide=this.shadowSide,i.vertexColors=this.vertexColors,i.opacity=this.opacity,i.transparent=this.transparent,i.blendSrc=this.blendSrc,i.blendDst=this.blendDst,i.blendEquation=this.blendEquation,i.blendSrcAlpha=this.blendSrcAlpha,i.blendDstAlpha=this.blendDstAlpha,i.blendEquationAlpha=this.blendEquationAlpha,i.blendColor=this.blendColor.getHex(),i.blendAlpha=this.blendAlpha,i.depthFunc=this.depthFunc,i.depthTest=this.depthTest,i.depthWrite=this.depthWrite,i.colorWrite=this.colorWrite,i.clipIntersection=this.clipIntersection,i.clipShadows=this.clipShadows,i.stencilWriteMask=this.stencilWriteMask,i.stencilFunc=this.stencilFunc,i.stencilRef=this.stencilRef,i.stencilFuncMask=this.stencilFuncMask,i.stencilFail=this.stencilFail,i.stencilZFail=this.stencilZFail,i.stencilZPass=this.stencilZPass,i.stencilWrite=this.stencilWrite,i.polygonOffset=this.polygonOffset,i.polygonOffsetFactor=this.polygonOffsetFactor,i.polygonOffsetUnits=this.polygonOffsetUnits,i.dithering=this.dithering,i.alphaTest=this.alphaTest,i.alphaHash=this.alphaHash,i.alphaToCoverage=this.alphaToCoverage,i.premultipliedAlpha=this.premultipliedAlpha,i.forceSinglePass=this.forceSinglePass,i.allowOverride=this.allowOverride,i.visible=this.visible,i.toneMapped=this.toneMapped,i.name=this.name,this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(i.sheenColorMap=this.sheenColorMap.toJSON(t).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(i.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(t).uuid),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(i.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(t).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(t).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(t).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(t).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(t).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(i.clippingPlanes=this.clippingPlanes.map(r=>r.toJSON())),this.rotation!==void 0&&(i.rotation=this.rotation),this.depthPacking!==void 0&&(i.depthPacking=this.depthPacking),this.linewidth!==void 0&&(i.linewidth=this.linewidth),this.linecap!==void 0&&(i.linecap=this.linecap),this.linejoin!==void 0&&(i.linejoin=this.linejoin),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.wireframe!==void 0&&(i.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(i.flatShading=this.flatShading),this.fog!==void 0&&(i.fog=this.fog),Object.keys(this.userData).length>0&&(i.userData=this.userData);function s(r){let o=[];for(let a in r){let l=r[a];delete l.metadata,o.push(l)}return o}if(e){let r=s(t.textures),o=s(t.images);r.length>0&&(i.textures=r),o.length>0&&(i.images=o)}return i}fromJSON(t,e){if(t.uuid!==void 0&&(this.uuid=t.uuid),t.name!==void 0&&(this.name=t.name),t.color!==void 0&&this.color!==void 0&&this.color.setHex(t.color),t.roughness!==void 0&&(this.roughness=t.roughness),t.metalness!==void 0&&(this.metalness=t.metalness),t.sheen!==void 0&&(this.sheen=t.sheen),t.sheenColor!==void 0&&(this.sheenColor=new Ft().setHex(t.sheenColor)),t.sheenRoughness!==void 0&&(this.sheenRoughness=t.sheenRoughness),t.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(t.emissive),t.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(t.specular),t.specularIntensity!==void 0&&(this.specularIntensity=t.specularIntensity),t.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(t.specularColor),t.shininess!==void 0&&(this.shininess=t.shininess),t.clearcoat!==void 0&&(this.clearcoat=t.clearcoat),t.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=t.clearcoatRoughness),t.dispersion!==void 0&&(this.dispersion=t.dispersion),t.retroreflectivity!==void 0&&(this.retroreflectivity=t.retroreflectivity),t.iridescence!==void 0&&(this.iridescence=t.iridescence),t.iridescenceIOR!==void 0&&(this.iridescenceIOR=t.iridescenceIOR),t.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=t.iridescenceThicknessRange),t.transmission!==void 0&&(this.transmission=t.transmission),t.thickness!==void 0&&(this.thickness=t.thickness),t.attenuationDistance!==void 0&&(this.attenuationDistance=t.attenuationDistance),t.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(t.attenuationColor),t.anisotropy!==void 0&&(this.anisotropy=t.anisotropy),t.anisotropyRotation!==void 0&&(this.anisotropyRotation=t.anisotropyRotation),t.fog!==void 0&&(this.fog=t.fog),t.flatShading!==void 0&&(this.flatShading=t.flatShading),t.blending!==void 0&&(this.blending=t.blending),t.combine!==void 0&&(this.combine=t.combine),t.side!==void 0&&(this.side=t.side),t.shadowSide!==void 0&&(this.shadowSide=t.shadowSide),t.opacity!==void 0&&(this.opacity=t.opacity),t.transparent!==void 0&&(this.transparent=t.transparent),t.alphaTest!==void 0&&(this.alphaTest=t.alphaTest),t.alphaHash!==void 0&&(this.alphaHash=t.alphaHash),t.depthFunc!==void 0&&(this.depthFunc=t.depthFunc),t.depthTest!==void 0&&(this.depthTest=t.depthTest),t.depthWrite!==void 0&&(this.depthWrite=t.depthWrite),t.colorWrite!==void 0&&(this.colorWrite=t.colorWrite),t.clippingPlanes!==void 0&&(this.clippingPlanes=t.clippingPlanes.map(i=>new qe().fromJSON(i))),t.clipIntersection!==void 0&&(this.clipIntersection=t.clipIntersection),t.clipShadows!==void 0&&(this.clipShadows=t.clipShadows),t.depthPacking!==void 0&&(this.depthPacking=t.depthPacking),t.blendSrc!==void 0&&(this.blendSrc=t.blendSrc),t.blendDst!==void 0&&(this.blendDst=t.blendDst),t.blendEquation!==void 0&&(this.blendEquation=t.blendEquation),t.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=t.blendSrcAlpha),t.blendDstAlpha!==void 0&&(this.blendDstAlpha=t.blendDstAlpha),t.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=t.blendEquationAlpha),t.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(t.blendColor),t.blendAlpha!==void 0&&(this.blendAlpha=t.blendAlpha),t.stencilWriteMask!==void 0&&(this.stencilWriteMask=t.stencilWriteMask),t.stencilFunc!==void 0&&(this.stencilFunc=t.stencilFunc),t.stencilRef!==void 0&&(this.stencilRef=t.stencilRef),t.stencilFuncMask!==void 0&&(this.stencilFuncMask=t.stencilFuncMask),t.stencilFail!==void 0&&(this.stencilFail=t.stencilFail),t.stencilZFail!==void 0&&(this.stencilZFail=t.stencilZFail),t.stencilZPass!==void 0&&(this.stencilZPass=t.stencilZPass),t.stencilWrite!==void 0&&(this.stencilWrite=t.stencilWrite),t.wireframe!==void 0&&(this.wireframe=t.wireframe),t.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=t.wireframeLinewidth),t.wireframeLinecap!==void 0&&(this.wireframeLinecap=t.wireframeLinecap),t.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=t.wireframeLinejoin),t.rotation!==void 0&&(this.rotation=t.rotation),t.linewidth!==void 0&&(this.linewidth=t.linewidth),t.linecap!==void 0&&(this.linecap=t.linecap),t.linejoin!==void 0&&(this.linejoin=t.linejoin),t.dashSize!==void 0&&(this.dashSize=t.dashSize),t.gapSize!==void 0&&(this.gapSize=t.gapSize),t.scale!==void 0&&(this.scale=t.scale),t.polygonOffset!==void 0&&(this.polygonOffset=t.polygonOffset),t.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=t.polygonOffsetFactor),t.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=t.polygonOffsetUnits),t.dithering!==void 0&&(this.dithering=t.dithering),t.alphaToCoverage!==void 0&&(this.alphaToCoverage=t.alphaToCoverage),t.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=t.premultipliedAlpha),t.forceSinglePass!==void 0&&(this.forceSinglePass=t.forceSinglePass),t.allowOverride!==void 0&&(this.allowOverride=t.allowOverride),t.visible!==void 0&&(this.visible=t.visible),t.toneMapped!==void 0&&(this.toneMapped=t.toneMapped),t.userData!==void 0&&(this.userData=t.userData),t.vertexColors!==void 0&&(typeof t.vertexColors=="number"?this.vertexColors=t.vertexColors>0:this.vertexColors=t.vertexColors),t.size!==void 0&&(this.size=t.size),t.sizeAttenuation!==void 0&&(this.sizeAttenuation=t.sizeAttenuation),t.map!==void 0&&(this.map=e[t.map]||null),t.matcap!==void 0&&(this.matcap=e[t.matcap]||null),t.alphaMap!==void 0&&(this.alphaMap=e[t.alphaMap]||null),t.bumpMap!==void 0&&(this.bumpMap=e[t.bumpMap]||null),t.bumpScale!==void 0&&(this.bumpScale=t.bumpScale),t.normalMap!==void 0&&(this.normalMap=e[t.normalMap]||null),t.normalMapType!==void 0&&(this.normalMapType=t.normalMapType),t.normalScale!==void 0){let i=t.normalScale;Array.isArray(i)===!1&&(i=[i,i]),this.normalScale=new tt().fromArray(i)}return t.displacementMap!==void 0&&(this.displacementMap=e[t.displacementMap]||null),t.displacementScale!==void 0&&(this.displacementScale=t.displacementScale),t.displacementBias!==void 0&&(this.displacementBias=t.displacementBias),t.roughnessMap!==void 0&&(this.roughnessMap=e[t.roughnessMap]||null),t.metalnessMap!==void 0&&(this.metalnessMap=e[t.metalnessMap]||null),t.emissiveMap!==void 0&&(this.emissiveMap=e[t.emissiveMap]||null),t.emissiveIntensity!==void 0&&(this.emissiveIntensity=t.emissiveIntensity),t.specularMap!==void 0&&(this.specularMap=e[t.specularMap]||null),t.specularIntensityMap!==void 0&&(this.specularIntensityMap=e[t.specularIntensityMap]||null),t.specularColorMap!==void 0&&(this.specularColorMap=e[t.specularColorMap]||null),t.envMap!==void 0&&(this.envMap=e[t.envMap]||null),t.envMapRotation!==void 0&&this.envMapRotation.fromArray(t.envMapRotation),t.envMapIntensity!==void 0&&(this.envMapIntensity=t.envMapIntensity),t.reflectivity!==void 0&&(this.reflectivity=t.reflectivity),t.refractionRatio!==void 0&&(this.refractionRatio=t.refractionRatio),t.lightMap!==void 0&&(this.lightMap=e[t.lightMap]||null),t.lightMapIntensity!==void 0&&(this.lightMapIntensity=t.lightMapIntensity),t.aoMap!==void 0&&(this.aoMap=e[t.aoMap]||null),t.aoMapIntensity!==void 0&&(this.aoMapIntensity=t.aoMapIntensity),t.gradientMap!==void 0&&(this.gradientMap=e[t.gradientMap]||null),t.clearcoatMap!==void 0&&(this.clearcoatMap=e[t.clearcoatMap]||null),t.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=e[t.clearcoatRoughnessMap]||null),t.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=e[t.clearcoatNormalMap]||null),t.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new tt().fromArray(t.clearcoatNormalScale)),t.iridescenceMap!==void 0&&(this.iridescenceMap=e[t.iridescenceMap]||null),t.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=e[t.iridescenceThicknessMap]||null),t.transmissionMap!==void 0&&(this.transmissionMap=e[t.transmissionMap]||null),t.thicknessMap!==void 0&&(this.thicknessMap=e[t.thicknessMap]||null),t.anisotropyMap!==void 0&&(this.anisotropyMap=e[t.anisotropyMap]||null),t.sheenColorMap!==void 0&&(this.sheenColorMap=e[t.sheenColorMap]||null),t.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=e[t.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;let e=t.clippingPlanes,i=null;if(e!==null){let s=e.length;i=new Array(s);for(let r=0;r!==s;++r)i[r]=e[r].clone()}return this.clippingPlanes=i,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.allowOverride=t.allowOverride,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}},As=class extends vi{constructor(t){super(),this.isSpriteMaterial=!0,this.type="SpriteMaterial",this.color=new Ft(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.rotation=t.rotation,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}},hs,tr=new D,us=new D,ds=new D,fs=new tt,er=new tt,Md=new re,Io=new D,ir=new D,Do=new D,vu=new tt,wc=new tt,_u=new tt,vr=class extends Xe{constructor(t=new As){if(super(),this.isSprite=!0,this.type="Sprite",hs===void 0){hs=new we;let e=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),i=new xr(e,5);hs.setIndex([0,1,2,0,2,3]),hs.setAttribute("position",new Ts(i,3,0,!1)),hs.setAttribute("uv",new Ts(i,2,3,!1))}this.geometry=hs,this.material=t,this.center=new tt(.5,.5),this.count=1}intersectsFrustum(t){return t.intersectsSprite(this)}raycast(t,e){t.camera===null&&Yt('Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),us.setFromMatrixScale(this.matrixWorld),Md.copy(t.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(t.camera.matrixWorldInverse,this.matrixWorld),ds.setFromMatrixPosition(this.modelViewMatrix),t.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&us.multiplyScalar(-ds.z);let i=this.material.rotation,s,r;i!==0&&(r=Math.cos(i),s=Math.sin(i));let o=this.center;No(Io.set(-.5,-.5,0),ds,o,us,s,r),No(ir.set(.5,-.5,0),ds,o,us,s,r),No(Do.set(.5,.5,0),ds,o,us,s,r),vu.set(0,0),wc.set(1,0),_u.set(1,1);let a=t.ray.intersectTriangle(Io,ir,Do,!1,tr);if(a===null&&(No(ir.set(-.5,.5,0),ds,o,us,s,r),wc.set(0,1),a=t.ray.intersectTriangle(Io,Do,ir,!1,tr),a===null))return;let l=t.ray.origin.distanceTo(tr);l<t.near||l>t.far||e.push({distance:l,point:tr.clone(),uv:tn.getInterpolation(tr,Io,ir,Do,vu,wc,_u,new tt),face:null,object:this})}copy(t,e){return super.copy(t,e),t.center!==void 0&&this.center.copy(t.center),this.material=t.material,this}};function No(n,t,e,i,s,r){fs.subVectors(n,e).addScalar(.5).multiply(i),s!==void 0?(er.x=r*fs.x-s*fs.y,er.y=s*fs.x+r*fs.y):er.copy(fs),n.copy(t),n.x+=er.x,n.y+=er.y,n.applyMatrix4(Md)}var $i=new D,Ec=new D,Uo=new D,Fo=new D,xn=class{constructor(t=new D,e=new D(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,$i)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);let i=e.dot(this.direction);return i<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){let e=$i.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):($i.copy(this.origin).addScaledVector(this.direction,e),$i.distanceToSquared(t))}distanceSqToSegment(t,e,i,s){Ec.copy(t).add(e).multiplyScalar(.5),Uo.copy(e).sub(t).normalize(),Fo.copy(this.origin).sub(Ec);let r=t.distanceTo(e)*.5,o=-this.direction.dot(Uo),a=Fo.dot(this.direction),l=-Fo.dot(Uo),c=Fo.lengthSq(),h=Math.abs(1-o*o),f,d,u,p;if(h>0)if(f=o*l-a,d=o*a-l,p=r*h,f>=0)if(d>=-p)if(d<=p){let x=1/h;f*=x,d*=x,u=f*(f+o*d+2*a)+d*(o*f+d+2*l)+c}else d=r,f=Math.max(0,-(o*d+a)),u=-f*f+d*(d+2*l)+c;else d=-r,f=Math.max(0,-(o*d+a)),u=-f*f+d*(d+2*l)+c;else d<=-p?(f=Math.max(0,-(-o*r+a)),d=f>0?-r:Math.min(Math.max(-r,-l),r),u=-f*f+d*(d+2*l)+c):d<=p?(f=0,d=Math.min(Math.max(-r,-l),r),u=d*(d+2*l)+c):(f=Math.max(0,-(o*r+a)),d=f>0?r:Math.min(Math.max(-r,-l),r),u=-f*f+d*(d+2*l)+c);else d=o>0?-r:r,f=Math.max(0,-(o*d+a)),u=-f*f+d*(d+2*l)+c;return i&&i.copy(this.origin).addScaledVector(this.direction,f),s&&s.copy(Ec).addScaledVector(Uo,d),u}intersectSphere(t,e){if(t.radius<0)return null;$i.subVectors(t.center,this.origin);let i=$i.dot(this.direction),s=$i.dot($i)-i*i,r=t.radius*t.radius;if(s>r)return null;let o=Math.sqrt(r-s),a=i-o,l=i+o;return l<0?null:a<0?this.at(l,e):this.at(a,e)}intersectsSphere(t){return t.radius<0?!1:this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){let e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;let i=-(this.origin.dot(t.normal)+t.constant)/e;return i>=0?i:null}intersectPlane(t,e){let i=this.distanceToPlane(t);return i===null?null:this.at(i,e)}intersectsPlane(t){let e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let i,s,r,o,a,l,c=1/this.direction.x,h=1/this.direction.y,f=1/this.direction.z,d=this.origin;return c>=0?(i=(t.min.x-d.x)*c,s=(t.max.x-d.x)*c):(i=(t.max.x-d.x)*c,s=(t.min.x-d.x)*c),h>=0?(r=(t.min.y-d.y)*h,o=(t.max.y-d.y)*h):(r=(t.max.y-d.y)*h,o=(t.min.y-d.y)*h),i>o||r>s||((r>i||isNaN(i))&&(i=r),(o<s||isNaN(s))&&(s=o),f>=0?(a=(t.min.z-d.z)*f,l=(t.max.z-d.z)*f):(a=(t.max.z-d.z)*f,l=(t.min.z-d.z)*f),i>l||a>s)||((a>i||i!==i)&&(i=a),(l<s||s!==s)&&(s=l),s<0)?null:this.at(i>=0?i:s,e)}intersectsBox(t){return this.intersectBox(t,$i)!==null}intersectTriangle(t,e,i,s,r){let o=this.origin,a=this.direction,l=a.x,c=a.y,h=a.z,f=t.x-o.x,d=t.y-o.y,u=t.z-o.z,p=e.x-o.x,x=e.y-o.y,m=e.z-o.z,g=i.x-o.x,b=i.y-o.y,T=i.z-o.z,v=Math.abs(l),S=Math.abs(c),C=Math.abs(h),P,y,A,U,I,M,E,R,N,O,F,V;if(v>=S&&v>=C?(A=l,M=f,N=p,V=g,l>=0?(P=c,y=h,U=d,I=u,E=x,R=m,O=b,F=T):(P=h,y=c,U=u,I=d,E=m,R=x,O=T,F=b)):S>=C?(A=c,M=d,N=x,V=b,c>=0?(P=h,y=l,U=u,I=f,E=m,R=p,O=T,F=g):(P=l,y=h,U=f,I=u,E=p,R=m,O=g,F=T)):(A=h,M=u,N=m,V=T,h>=0?(P=l,y=c,U=f,I=d,E=p,R=x,O=g,F=b):(P=c,y=l,U=d,I=f,E=x,R=p,O=b,F=g)),A===0)return null;let k=P/A,W=y/A,j=1/A,ht=U-k*M,ft=I-W*M,At=E-k*N,wt=R-W*N,Gt=O-k*V,Z=F-W*V,K=Gt*wt-Z*At,dt=ht*Z-ft*Gt,Pt=At*ft-wt*ht;if(s){if(K<0||dt<0||Pt<0)return null}else if((K<0||dt<0||Pt<0)&&(K>0||dt>0||Pt>0))return null;let vt=K+dt+Pt;if(vt===0)return null;let Bt=j*(K*M+dt*N+Pt*V);return(vt>0?Bt<0:Bt>0)?null:this.at(Bt/vt,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},Oe=class extends vi{constructor(t){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Ft(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new zi,this.combine=Oa,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}},yu=new re,On=new xn,Oo=new zn,Mu=new D,Bo=new D,ko=new D,zo=new D,Tc=new D,Ho=new D,bu=new D,Vo=new D,Wt=class extends Xe{constructor(t=new we,e=new Oe){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){let e=this.geometry.morphAttributes,i=Object.keys(e);if(i.length>0){let s=e[i[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){let a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}getVertexPosition(t,e){let i=this.geometry,s=i.attributes.position,r=i.morphAttributes.position,o=i.morphTargetsRelative;e.fromBufferAttribute(s,t);let a=this.morphTargetInfluences;if(r&&a){Ho.set(0,0,0);for(let l=0,c=r.length;l<c;l++){let h=a[l],f=r[l];h!==0&&(Tc.fromBufferAttribute(f,t),o?Ho.addScaledVector(Tc,h):Ho.addScaledVector(Tc.sub(e),h))}e.add(Ho)}return e}intersectsFrustum(t){return t.intersectsObject(this)}raycast(t,e){let i=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),Oo.copy(i.boundingSphere),Oo.applyMatrix4(r),On.copy(t.ray).recast(t.near),!(Oo.containsPoint(On.origin)===!1&&(On.intersectSphere(Oo,Mu)===null||On.origin.distanceToSquared(Mu)>(t.far-t.near)**2))&&(yu.copy(r).invert(),On.copy(t.ray).applyMatrix4(yu),!(i.boundingBox!==null&&On.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(t,e,On)))}_computeIntersections(t,e,i){let s,r=this.geometry,o=this.material,a=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,f=r.attributes.normal,d=r.groups,u=r.drawRange;if(a!==null)if(Array.isArray(o))for(let p=0,x=d.length;p<x;p++){let m=d[p],g=o[m.materialIndex],b=Math.max(m.start,u.start),T=Math.min(a.count,Math.min(m.start+m.count,u.start+u.count));for(let v=b,S=T;v<S;v+=3){let C=a.getX(v),P=a.getX(v+1),y=a.getX(v+2);s=Go(this,g,t,i,c,h,f,C,P,y),s&&(s.faceIndex=Math.floor(v/3),s.face.materialIndex=m.materialIndex,e.push(s))}}else{let p=Math.max(0,u.start),x=Math.min(a.count,u.start+u.count);for(let m=p,g=x;m<g;m+=3){let b=a.getX(m),T=a.getX(m+1),v=a.getX(m+2);s=Go(this,o,t,i,c,h,f,b,T,v),s&&(s.faceIndex=Math.floor(m/3),e.push(s))}}else if(l!==void 0)if(Array.isArray(o))for(let p=0,x=d.length;p<x;p++){let m=d[p],g=o[m.materialIndex],b=Math.max(m.start,u.start),T=Math.min(l.count,Math.min(m.start+m.count,u.start+u.count));for(let v=b,S=T;v<S;v+=3){let C=v,P=v+1,y=v+2;s=Go(this,g,t,i,c,h,f,C,P,y),s&&(s.faceIndex=Math.floor(v/3),s.face.materialIndex=m.materialIndex,e.push(s))}}else{let p=Math.max(0,u.start),x=Math.min(l.count,u.start+u.count);for(let m=p,g=x;m<g;m+=3){let b=m,T=m+1,v=m+2;s=Go(this,o,t,i,c,h,f,b,T,v),s&&(s.faceIndex=Math.floor(m/3),e.push(s))}}}};function vp(n,t,e,i,s,r,o,a){let l;if(t.side===Ye?l=i.intersectTriangle(o,r,s,!0,a):l=i.intersectTriangle(s,r,o,t.side===An,a),l===null)return null;Vo.copy(a),Vo.applyMatrix4(n.matrixWorld);let c=e.ray.origin.distanceTo(Vo);return c<e.near||c>e.far?null:{distance:c,point:Vo.clone(),object:n}}function Go(n,t,e,i,s,r,o,a,l,c){n.getVertexPosition(a,Bo),n.getVertexPosition(l,ko),n.getVertexPosition(c,zo);let h=vp(n,t,e,i,Bo,ko,zo,bu);if(h){let f=new D;tn.getBarycoord(bu,Bo,ko,zo,f),s&&(h.uv=tn.getInterpolatedAttribute(s,a,l,c,f,new tt)),r&&(h.uv1=tn.getInterpolatedAttribute(r,a,l,c,f,new tt)),o&&(h.normal=tn.getInterpolatedAttribute(o,a,l,c,f,new D),h.normal.dot(i.direction)>0&&h.normal.multiplyScalar(-1));let d={a,b:l,c,normal:new D,materialIndex:0};tn.getNormal(Bo,ko,zo,d.normal),h.face=d,h.barycoord=f}return h}var vn=class extends We{constructor(t=null,e=1,i=1,s,r,o,a,l,c=Se,h=Se,f,d){super(null,o,a,l,c,h,s,r,f,d),this.isDataTexture=!0,this.image={data:t,width:e,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Bn=new zn,_p=new tt(.5,.5),Wo=new D,Cs=class{constructor(t=new qe,e=new qe,i=new qe,s=new qe,r=new qe,o=new qe){this.planes=[t,e,i,s,r,o]}set(t,e,i,s,r,o){let a=this.planes;return a[0].copy(t),a[1].copy(e),a[2].copy(i),a[3].copy(s),a[4].copy(r),a[5].copy(o),this}copy(t){let e=this.planes;for(let i=0;i<6;i++)e[i].copy(t.planes[i]);return this}setFromProjectionMatrix(t,e=Ci,i=!1){let s=this.planes,r=t.elements,o=r[0],a=r[1],l=r[2],c=r[3],h=r[4],f=r[5],d=r[6],u=r[7],p=r[8],x=r[9],m=r[10],g=r[11],b=r[12],T=r[13],v=r[14],S=r[15];if(s[0].setComponents(c-o,u-h,g-p,S-b).normalize(),s[1].setComponents(c+o,u+h,g+p,S+b).normalize(),s[2].setComponents(c+a,u+f,g+x,S+T).normalize(),s[3].setComponents(c-a,u-f,g-x,S-T).normalize(),i)s[4].setComponents(l,d,m,v).normalize(),s[5].setComponents(c-l,u-d,g-m,S-v).normalize();else if(s[4].setComponents(c-l,u-d,g-m,S-v).normalize(),e===Ci)s[5].setComponents(c+l,u+d,g+m,S+v).normalize();else if(e===_s)s[5].setComponents(l,d,m,v).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),Bn.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{let e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),Bn.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(Bn)}intersectsSprite(t){Bn.center.set(0,0,0);let e=_p.distanceTo(t.center);return Bn.radius=.7071067811865476+e,Bn.applyMatrix4(t.matrixWorld),this.intersectsSphere(Bn)}intersectsSphere(t){let e=this.planes,i=t.center,s=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(i)<s)return!1;return!0}intersectsBox(t){let e=this.planes;for(let i=0;i<6;i++){let s=e[i];if(Wo.x=s.normal.x>0?t.max.x:t.min.x,Wo.y=s.normal.y>0?t.max.y:t.min.y,Wo.z=s.normal.z>0?t.max.z:t.min.z,s.distanceToPoint(Wo)<0)return!1}return!0}containsPoint(t){let e=this.planes;for(let i=0;i<6;i++)if(e[i].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var Rs=class extends vi{constructor(t){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new Ft(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.linewidth=t.linewidth,this.linecap=t.linecap,this.linejoin=t.linejoin,this.fog=t.fog,this}},ua=new D,da=new D,Su=new re,nr=new xn,Xo=new zn,Ac=new D,wu=new D,fa=class extends Xe{constructor(t=new we,e=new Rs){super(),this.isLine=!0,this.type="Line",this.geometry=t,this.material=e,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}computeLineDistances(){let t=this.geometry;if(t.index===null){let e=t.attributes.position,i=[0];for(let s=1,r=e.count;s<r;s++)ua.fromBufferAttribute(e,s-1),da.fromBufferAttribute(e,s),i[s]=i[s-1],i[s]+=ua.distanceTo(da);t.setAttribute("lineDistance",new oe(i,1))}else qt("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}intersectsFrustum(t){return t.intersectsObject(this)}raycast(t,e){let i=this.geometry,s=this.matrixWorld,r=t.params.Line.threshold,o=i.drawRange;if(i.boundingSphere===null&&i.computeBoundingSphere(),Xo.copy(i.boundingSphere),Xo.applyMatrix4(s),Xo.radius+=r,t.ray.intersectsSphere(Xo)===!1)return;Su.copy(s).invert(),nr.copy(t.ray).applyMatrix4(Su);let a=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=this.isLineSegments?2:1,h=i.index,d=i.attributes.position;if(h!==null){let u=Math.max(0,o.start),p=Math.min(h.count,o.start+o.count);for(let x=u,m=p-1;x<m;x+=c){let g=h.getX(x),b=h.getX(x+1),T=qo(this,t,nr,l,g,b,x);T&&e.push(T)}if(this.isLineLoop){let x=h.getX(p-1),m=h.getX(u),g=qo(this,t,nr,l,x,m,p-1);g&&e.push(g)}}else{let u=Math.max(0,o.start),p=Math.min(d.count,o.start+o.count);for(let x=u,m=p-1;x<m;x+=c){let g=qo(this,t,nr,l,x,x+1,x);g&&e.push(g)}if(this.isLineLoop){let x=qo(this,t,nr,l,p-1,u,p-1);x&&e.push(x)}}}updateMorphTargets(){let e=this.geometry.morphAttributes,i=Object.keys(e);if(i.length>0){let s=e[i[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){let a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}};function qo(n,t,e,i,s,r,o){let a=n.geometry.attributes.position;if(ua.fromBufferAttribute(a,s),da.fromBufferAttribute(a,r),e.distanceSqToSegment(ua,da,Ac,wu)>i)return;Ac.applyMatrix4(n.matrixWorld);let c=t.ray.origin.distanceTo(Ac);if(!(c<t.near||c>t.far))return{distance:c,point:wu.clone().applyMatrix4(n.matrixWorld),index:o,face:null,faceIndex:null,barycoord:null,object:n}}var Eu=new D,Tu=new D,_r=class extends fa{constructor(t,e){super(t,e),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let t=this.geometry;if(t.index===null){let e=t.attributes.position,i=[];for(let s=0,r=e.count;s<r;s+=2)Eu.fromBufferAttribute(e,s),Tu.fromBufferAttribute(e,s+1),i[s]=s===0?0:i[s-1],i[s+1]=i[s]+Eu.distanceTo(Tu);t.setAttribute("lineDistance",new oe(i,1))}else qt("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}};var yr=class extends We{constructor(t=[],e=Rn,i,s,r,o,a,l,c,h){super(t,e,i,s,r,o,a,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}},nn=class extends We{constructor(t,e,i,s,r,o,a,l,c){super(t,e,i,s,r,o,a,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}};var Hi=class extends We{constructor(t,e,i=Li,s,r,o,a=Se,l=Se,c,h=ki,f=1){if(h!==ki&&h!==Vi)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let d={width:t,height:e,depth:f};super(d,s,r,o,a,l,h,i,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.source=new bs(Object.assign({},t.image)),this.compareFunction=t.compareFunction,this}toJSON(t){let e=super.toJSON(t);return e.compareFunction=this.compareFunction,e}},pa=class extends Hi{constructor(t,e=Li,i=Rn,s,r,o=Se,a=Se,l,c=ki){let h={width:t,height:t,depth:1},f=[h,h,h,h,h,h];super(t,t,e,i,s,r,o,a,l,c),this.image=f,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(t){this.image=t}},Mr=class extends We{constructor(t=null){super(),this.sourceTexture=t,this.isExternalTexture=!0}copy(t){return super.copy(t),this.sourceTexture=t.sourceTexture,this}},Be=class n extends we{constructor(t=1,e=1,i=1,s=1,r=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:i,widthSegments:s,heightSegments:r,depthSegments:o};let a=this;s=Math.floor(s),r=Math.floor(r),o=Math.floor(o);let l=[],c=[],h=[],f=[],d=0,u=0;p("z","y","x",-1,-1,i,e,t,o,r,0),p("z","y","x",1,-1,i,e,-t,o,r,1),p("x","z","y",1,1,t,i,e,s,o,2),p("x","z","y",1,-1,t,i,-e,s,o,3),p("x","y","z",1,-1,t,e,i,s,r,4),p("x","y","z",-1,-1,t,e,-i,s,r,5),this.setIndex(l),this.setAttribute("position",new oe(c,3)),this.setAttribute("normal",new oe(h,3)),this.setAttribute("uv",new oe(f,2));function p(x,m,g,b,T,v,S,C,P,y,A){let U=v/P,I=S/y,M=v/2,E=S/2,R=C/2,N=P+1,O=y+1,F=0,V=0,k=new D;for(let W=0;W<O;W++){let j=W*I-E;for(let ht=0;ht<N;ht++){let ft=ht*U-M;k[x]=ft*b,k[m]=j*T,k[g]=R,c.push(k.x,k.y,k.z),k[x]=0,k[m]=0,k[g]=C>0?1:-1,h.push(k.x,k.y,k.z),f.push(ht/P),f.push(1-W/y),F+=1}}for(let W=0;W<y;W++)for(let j=0;j<P;j++){let ht=d+j+N*W,ft=d+j+N*(W+1),At=d+(j+1)+N*(W+1),wt=d+(j+1)+N*W;l.push(ht,ft,wt),l.push(ft,At,wt),V+=6}a.addGroup(u,V,A),u+=V,d+=F}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new n(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}};var br=class n extends we{constructor(t=1,e=32,i=0,s=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:t,segments:e,thetaStart:i,thetaLength:s},e=Math.max(3,e);let r=[],o=[],a=[],l=[],c=new D,h=new tt;o.push(0,0,0),a.push(0,0,1),l.push(.5,.5);for(let f=0,d=3;f<=e;f++,d+=3){let u=i+f/e*s;c.x=t*Math.cos(u),c.y=t*Math.sin(u),o.push(c.x,c.y,c.z),a.push(0,0,1),h.x=(o[d]/t+1)/2,h.y=(o[d+1]/t+1)/2,l.push(h.x,h.y)}for(let f=1;f<=e;f++)r.push(f,f+1,0);this.setIndex(r),this.setAttribute("position",new oe(o,3)),this.setAttribute("normal",new oe(a,3)),this.setAttribute("uv",new oe(l,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new n(t.radius,t.segments,t.thetaStart,t.thetaLength)}},ii=class n extends we{constructor(t=1,e=1,i=1,s=32,r=1,o=!1,a=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:i,radialSegments:s,heightSegments:r,openEnded:o,thetaStart:a,thetaLength:l};let c=this;s=Math.floor(s),r=Math.floor(r);let h=[],f=[],d=[],u=[],p=0,x=[],m=i/2,g=0;b(),o===!1&&(t>0&&T(!0),e>0&&T(!1)),this.setIndex(h),this.setAttribute("position",new oe(f,3)),this.setAttribute("normal",new oe(d,3)),this.setAttribute("uv",new oe(u,2));function b(){let v=new D,S=new D,C=0,P=(e-t)/i;for(let y=0;y<=r;y++){let A=[],U=y/r,I=U*(e-t)+t;for(let M=0;M<=s;M++){let E=M/s,R=E*l+a,N=Math.sin(R),O=Math.cos(R);S.x=I*N,S.y=-U*i+m,S.z=I*O,f.push(S.x,S.y,S.z),v.set(N,P,O).normalize(),d.push(v.x,v.y,v.z),u.push(E,1-U),A.push(p++)}x.push(A)}for(let y=0;y<s;y++)for(let A=0;A<r;A++){let U=x[A][y],I=x[A+1][y],M=x[A+1][y+1],E=x[A][y+1];(t>0||A!==0)&&(h.push(U,I,E),C+=3),(e>0||A!==r-1)&&(h.push(I,M,E),C+=3)}c.addGroup(g,C,0),g+=C}function T(v){let S=p,C=new tt,P=new D,y=0,A=v===!0?t:e,U=v===!0?1:-1;for(let M=1;M<=s;M++)f.push(0,m*U,0),d.push(0,U,0),u.push(.5,.5),p++;let I=p;for(let M=0;M<=s;M++){let R=M/s*l+a,N=Math.cos(R),O=Math.sin(R);P.x=A*O,P.y=m*U,P.z=A*N,f.push(P.x,P.y,P.z),d.push(0,U,0),C.x=N*.5+.5,C.y=O*.5*U+.5,u.push(C.x,C.y),p++}for(let M=0;M<s;M++){let E=S+M,R=I+M;v===!0?h.push(R,R+1,E):h.push(R+1,R,E),y+=3}c.addGroup(g,y,v===!0?1:2),g+=y}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new n(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}};var di=class{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){qt("Curve: .getPoint() not implemented.")}getPointAt(t,e){let i=this.getUtoTmapping(t);return this.getPoint(i,e)}getPoints(t=5){let e=[];for(let i=0;i<=t;i++)e.push(this.getPoint(i/t));return e}getSpacedPoints(t=5){let e=[];for(let i=0;i<=t;i++)e.push(this.getPointAt(i/t));return e}getLength(){let t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let e=[],i,s=this.getPoint(0),r=0;e.push(0);for(let o=1;o<=t;o++)i=this.getPoint(o/t),r+=i.distanceTo(s),e.push(r),s=i;return this.cacheArcLengths=e,e}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,e=null){let i=this.getLengths(),s=0,r=i.length,o;e?o=e:o=t*i[r-1];let a=0,l=r-1,c;for(;a<=l;)if(s=Math.floor(a+(l-a)/2),c=i[s]-o,c<0)a=s+1;else if(c>0)l=s-1;else{l=s;break}if(s=l,i[s]===o)return s/(r-1);let h=i[s],d=i[s+1]-h,u=(o-h)/d;return(s+u)/(r-1)}getTangent(t,e){let s=t-1e-4,r=t+1e-4;s<0&&(s=0),r>1&&(r=1);let o=this.getPoint(s),a=this.getPoint(r),l=e||(o.isVector2?new tt:new D);return l.copy(a).sub(o).normalize(),l}getTangentAt(t,e){let i=this.getUtoTmapping(t);return this.getTangent(i,e)}computeFrenetFrames(t,e=!1){let i=new D,s=[],r=[],o=[],a=new D,l=new re;for(let u=0;u<=t;u++){let p=u/t;s[u]=this.getTangentAt(p,new D)}r[0]=new D,o[0]=new D;let c=Number.MAX_VALUE,h=Math.abs(s[0].x),f=Math.abs(s[0].y),d=Math.abs(s[0].z);h<=c&&(c=h,i.set(1,0,0)),f<=c&&(c=f,i.set(0,1,0)),d<=c&&i.set(0,0,1),a.crossVectors(s[0],i).normalize(),r[0].crossVectors(s[0],a),o[0].crossVectors(s[0],r[0]);for(let u=1;u<=t;u++){if(r[u]=r[u-1].clone(),o[u]=o[u-1].clone(),a.crossVectors(s[u-1],s[u]),a.length()>Number.EPSILON){a.normalize();let p=Math.acos(Qt(s[u-1].dot(s[u]),-1,1));r[u].applyMatrix4(l.makeRotationAxis(a,p))}o[u].crossVectors(s[u],r[u])}if(e===!0){let u=Math.acos(Qt(r[0].dot(r[t]),-1,1));u/=t,s[0].dot(a.crossVectors(r[0],r[t]))>0&&(u=-u);for(let p=1;p<=t;p++)r[p].applyMatrix4(l.makeRotationAxis(s[p],u*p)),o[p].crossVectors(s[p],r[p])}return{tangents:s,normals:r,binormals:o}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){let t={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}},Ps=class extends di{constructor(t=0,e=0,i=1,s=1,r=0,o=Math.PI*2,a=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=e,this.xRadius=i,this.yRadius=s,this.aStartAngle=r,this.aEndAngle=o,this.aClockwise=a,this.aRotation=l}getPoint(t,e=new tt){let i=e,s=Math.PI*2,r=this.aEndAngle-this.aStartAngle,o=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=s;for(;r>s;)r-=s;r<Number.EPSILON&&(o?r=0:r=s),this.aClockwise===!0&&!o&&(r===s?r=-s:r=r-s);let a=this.aStartAngle+t*r,l=this.aX+this.xRadius*Math.cos(a),c=this.aY+this.yRadius*Math.sin(a);if(this.aRotation!==0){let h=Math.cos(this.aRotation),f=Math.sin(this.aRotation),d=l-this.aX,u=c-this.aY;l=d*h-u*f+this.aX,c=d*f+u*h+this.aY}return i.set(l,c)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){let t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}},ma=class extends Ps{constructor(t,e,i,s,r,o){super(t,e,i,i,s,r,o),this.isArcCurve=!0,this.type="ArcCurve"}};function ch(){let n=0,t=0,e=0,i=0;function s(r,o,a,l){n=r,t=a,e=-3*r+3*o-2*a-l,i=2*r-2*o+a+l}return{initCatmullRom:function(r,o,a,l,c){s(o,a,c*(a-r),c*(l-o))},initNonuniformCatmullRom:function(r,o,a,l,c,h,f){let d=(o-r)/c-(a-r)/(c+h)+(a-o)/h,u=(a-o)/h-(l-o)/(h+f)+(l-a)/f;d*=h,u*=h,s(o,a,d,u)},calc:function(r){let o=r*r,a=o*r;return n+t*r+e*o+i*a}}}var Au=new D,Cu=new D,Cc=new ch,Rc=new ch,Pc=new ch,ga=class extends di{constructor(t=[],e=!1,i="centripetal",s=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=e,this.curveType=i,this.tension=s}getPoint(t,e=new D){let i=e,s=this.points,r=s.length,o=(r-(this.closed?0:1))*t,a=Math.floor(o),l=o-a;this.closed?a+=a>0?0:(Math.floor(Math.abs(a)/r)+1)*r:l===0&&a===r-1&&(a=r-2,l=1);let c,h;this.closed||a>0?c=s[(a-1)%r]:(Cu.subVectors(s[0],s[1]).add(s[0]),c=Cu);let f=s[a%r],d=s[(a+1)%r];if(this.closed||a+2<r?h=s[(a+2)%r]:(Au.subVectors(s[r-1],s[r-2]).add(s[r-1]),h=Au),this.curveType==="centripetal"||this.curveType==="chordal"){let u=this.curveType==="chordal"?.5:.25,p=Math.pow(c.distanceToSquared(f),u),x=Math.pow(f.distanceToSquared(d),u),m=Math.pow(d.distanceToSquared(h),u);x<1e-4&&(x=1),p<1e-4&&(p=x),m<1e-4&&(m=x),Cc.initNonuniformCatmullRom(c.x,f.x,d.x,h.x,p,x,m),Rc.initNonuniformCatmullRom(c.y,f.y,d.y,h.y,p,x,m),Pc.initNonuniformCatmullRom(c.z,f.z,d.z,h.z,p,x,m)}else this.curveType==="catmullrom"&&(Cc.initCatmullRom(c.x,f.x,d.x,h.x,this.tension),Rc.initCatmullRom(c.y,f.y,d.y,h.y,this.tension),Pc.initCatmullRom(c.z,f.z,d.z,h.z,this.tension));return i.set(Cc.calc(l),Rc.calc(l),Pc.calc(l)),i}copy(t){super.copy(t),this.points=[];for(let e=0,i=t.points.length;e<i;e++){let s=t.points[e];this.points.push(s.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){let t=super.toJSON();t.points=[];for(let e=0,i=this.points.length;e<i;e++){let s=this.points[e];t.points.push(s.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,i=t.points.length;e<i;e++){let s=t.points[e];this.points.push(new D().fromArray(s))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}};function Ru(n,t,e,i,s){let r=(i-t)*.5,o=(s-e)*.5,a=n*n,l=n*a;return(2*e-2*i+r+o)*l+(-3*e+3*i-2*r-o)*a+r*n+e}function yp(n,t){let e=1-n;return e*e*t}function Mp(n,t){return 2*(1-n)*n*t}function bp(n,t){return n*n*t}function ar(n,t,e,i){return yp(n,t)+Mp(n,e)+bp(n,i)}function Sp(n,t){let e=1-n;return e*e*e*t}function wp(n,t){let e=1-n;return 3*e*e*n*t}function Ep(n,t){return 3*(1-n)*n*n*t}function Tp(n,t){return n*n*n*t}function lr(n,t,e,i,s){return Sp(n,t)+wp(n,e)+Ep(n,i)+Tp(n,s)}var Sr=class extends di{constructor(t=new tt,e=new tt,i=new tt,s=new tt){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=e,this.v2=i,this.v3=s}getPoint(t,e=new tt){let i=e,s=this.v0,r=this.v1,o=this.v2,a=this.v3;return i.set(lr(t,s.x,r.x,o.x,a.x),lr(t,s.y,r.y,o.y,a.y)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},xa=class extends di{constructor(t=new D,e=new D,i=new D,s=new D){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=e,this.v2=i,this.v3=s}getPoint(t,e=new D){let i=e,s=this.v0,r=this.v1,o=this.v2,a=this.v3;return i.set(lr(t,s.x,r.x,o.x,a.x),lr(t,s.y,r.y,o.y,a.y),lr(t,s.z,r.z,o.z,a.z)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},wr=class extends di{constructor(t=new tt,e=new tt){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=e}getPoint(t,e=new tt){let i=e;return t===1?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(t).add(this.v1)),i}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new tt){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},va=class extends di{constructor(t=new D,e=new D){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=e}getPoint(t,e=new D){let i=e;return t===1?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(t).add(this.v1)),i}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new D){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},Er=class extends di{constructor(t=new tt,e=new tt,i=new tt){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=e,this.v2=i}getPoint(t,e=new tt){let i=e,s=this.v0,r=this.v1,o=this.v2;return i.set(ar(t,s.x,r.x,o.x),ar(t,s.y,r.y,o.y)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},_a=class extends di{constructor(t=new D,e=new D,i=new D){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=e,this.v2=i}getPoint(t,e=new D){let i=e,s=this.v0,r=this.v1,o=this.v2;return i.set(ar(t,s.x,r.x,o.x),ar(t,s.y,r.y,o.y),ar(t,s.z,r.z,o.z)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},Tr=class extends di{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,e=new tt){let i=e,s=this.points,r=(s.length-1)*t,o=Math.floor(r),a=r-o,l=s[o===0?o:o-1],c=s[o],h=s[o>s.length-2?s.length-1:o+1],f=s[o>s.length-3?s.length-1:o+2];return i.set(Ru(a,l.x,c.x,h.x,f.x),Ru(a,l.y,c.y,h.y,f.y)),i}copy(t){super.copy(t),this.points=[];for(let e=0,i=t.points.length;e<i;e++){let s=t.points[e];this.points.push(s.clone())}return this}toJSON(){let t=super.toJSON();t.points=[];for(let e=0,i=this.points.length;e<i;e++){let s=this.points[e];t.points.push(s.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,i=t.points.length;e<i;e++){let s=t.points[e];this.points.push(new tt().fromArray(s))}return this}},Oc=Object.freeze({__proto__:null,ArcCurve:ma,CatmullRomCurve3:ga,CubicBezierCurve:Sr,CubicBezierCurve3:xa,EllipseCurve:Ps,LineCurve:wr,LineCurve3:va,QuadraticBezierCurve:Er,QuadraticBezierCurve3:_a,SplineCurve:Tr}),ya=class extends di{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(t){this.curves.push(t)}closePath(){let t=this.curves[0].getPoint(0),e=this.curves[this.curves.length-1].getPoint(1);if(!t.equals(e)){let i=t.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new Oc[i](e,t))}return this}getPoint(t,e){let i=t*this.getLength(),s=this.getCurveLengths(),r=0;for(;r<s.length;){if(s[r]>=i){let o=s[r]-i,a=this.curves[r],l=a.getLength(),c=l===0?0:1-o/l;return a.getPointAt(c,e)}r++}return null}getLength(){let t=this.getCurveLengths();return t[t.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;let t=[],e=0;for(let i=0,s=this.curves.length;i<s;i++)e+=this.curves[i].getLength(),t.push(e);return this.cacheLengths=t,t}getSpacedPoints(t=40){let e=[];for(let i=0;i<=t;i++)e.push(this.getPoint(i/t));return this.autoClose&&e.push(e[0]),e}getPoints(t=12){let e=[],i;for(let s=0,r=this.curves;s<r.length;s++){let o=r[s],a=o.isEllipseCurve?t*2:o.isLineCurve||o.isLineCurve3?1:o.isSplineCurve?t*o.points.length:t,l=o.getPoints(a);for(let c=0;c<l.length;c++){let h=l[c];i&&i.equals(h)||(e.push(h),i=h)}}return this.autoClose&&e.length>1&&!e[e.length-1].equals(e[0])&&e.push(e[0]),e}copy(t){super.copy(t),this.curves=[];for(let e=0,i=t.curves.length;e<i;e++){let s=t.curves[e];this.curves.push(s.clone())}return this.autoClose=t.autoClose,this}toJSON(){let t=super.toJSON();t.autoClose=this.autoClose,t.curves=[];for(let e=0,i=this.curves.length;e<i;e++){let s=this.curves[e];t.curves.push(s.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.autoClose=t.autoClose,this.curves=[];for(let e=0,i=t.curves.length;e<i;e++){let s=t.curves[e];this.curves.push(new Oc[s.type]().fromJSON(s))}return this}},Hn=class extends ya{constructor(t){super(),this.type="Path",this.currentPoint=new tt,t&&this.setFromPoints(t)}setFromPoints(t){this.moveTo(t[0].x,t[0].y);for(let e=1,i=t.length;e<i;e++)this.lineTo(t[e].x,t[e].y);return this}moveTo(t,e){return this.currentPoint.set(t,e),this}lineTo(t,e){let i=new wr(this.currentPoint.clone(),new tt(t,e));return this.curves.push(i),this.currentPoint.set(t,e),this}quadraticCurveTo(t,e,i,s){let r=new Er(this.currentPoint.clone(),new tt(t,e),new tt(i,s));return this.curves.push(r),this.currentPoint.set(i,s),this}bezierCurveTo(t,e,i,s,r,o){let a=new Sr(this.currentPoint.clone(),new tt(t,e),new tt(i,s),new tt(r,o));return this.curves.push(a),this.currentPoint.set(r,o),this}splineThru(t){let e=[this.currentPoint.clone()].concat(t),i=new Tr(e);return this.curves.push(i),this.currentPoint.copy(t[t.length-1]),this}arc(t,e,i,s,r,o){let a=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(t+a,e+l,i,s,r,o),this}absarc(t,e,i,s,r,o){return this.absellipse(t,e,i,i,s,r,o),this}ellipse(t,e,i,s,r,o,a,l){let c=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(t+c,e+h,i,s,r,o,a,l),this}absellipse(t,e,i,s,r,o,a,l){let c=new Ps(t,e,i,s,r,o,a,l);if(this.curves.length>0){let f=c.getPoint(0);f.equals(this.currentPoint)||this.lineTo(f.x,f.y)}this.curves.push(c);let h=c.getPoint(1);return this.currentPoint.copy(h),this}copy(t){return super.copy(t),this.currentPoint.copy(t.currentPoint),this}toJSON(){let t=super.toJSON();return t.currentPoint=this.currentPoint.toArray(),t}fromJSON(t){return super.fromJSON(t),this.currentPoint.fromArray(t.currentPoint),this}},Vn=class extends Hn{constructor(t){super(t),this.uuid=Bi(),this.type="Shape",this.holes=[]}getPointsHoles(t){let e=[];for(let i=0,s=this.holes.length;i<s;i++)e[i]=this.holes[i].getPoints(t);return e}extractPoints(t){return{shape:this.getPoints(t),holes:this.getPointsHoles(t)}}copy(t){super.copy(t),this.holes=[];for(let e=0,i=t.holes.length;e<i;e++){let s=t.holes[e];this.holes.push(s.clone())}return this}toJSON(){let t=super.toJSON();t.uuid=this.uuid,t.holes=[];for(let e=0,i=this.holes.length;e<i;e++){let s=this.holes[e];t.holes.push(s.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.uuid=t.uuid,this.holes=[];for(let e=0,i=t.holes.length;e<i;e++){let s=t.holes[e];this.holes.push(new Hn().fromJSON(s))}return this}};function Ap(n,t,e=2){let i=t&&t.length,s=i?t[0]*e:n.length,r=bd(n,0,s,e,!0),o=[];if(!r||r.next===r.prev)return o;let a,l,c;if(i&&(r=Ip(n,t,r,e)),n.length>80*e){a=n[0],l=n[1];let h=a,f=l;for(let d=e;d<s;d+=e){let u=n[d],p=n[d+1];u<a&&(a=u),p<l&&(l=p),u>h&&(h=u),p>f&&(f=p)}c=Math.max(h-a,f-l),c=c!==0?32767/c:0}return Ar(r,o,e,a,l,c,0),o}function bd(n,t,e,i,s){let r;if(s===Gp(n,t,e,i)>0)for(let o=t;o<e;o+=i)r=Pu(o/i|0,n[o],n[o+1],r);else for(let o=e-i;o>=t;o-=i)r=Pu(o/i|0,n[o],n[o+1],r);return r&&Ls(r,r.next)&&(Rr(r),r=r.next),r}function Gn(n,t){if(!n)return n;t||(t=n);let e=n,i;do if(i=!1,!e.steiner&&(Ls(e,e.next)||Ee(e.prev,e,e.next)===0)){if(Rr(e),e=t=e.prev,e===e.next)break;i=!0}else e=e.next;while(i||e!==t);return t}function Ar(n,t,e,i,s,r,o){if(!n)return;!o&&r&&Op(n,i,s,r);let a=n;for(;n.prev!==n.next;){let l=n.prev,c=n.next;if(r?Rp(n,i,s,r):Cp(n)){t.push(l.i,n.i,c.i),Rr(n),n=c.next,a=c.next;continue}if(n=c,n===a){o?o===1?(n=Pp(Gn(n),t),Ar(n,t,e,i,s,r,2)):o===2&&Lp(n,t,e,i,s,r):Ar(Gn(n),t,e,i,s,r,1);break}}}function Cp(n){let t=n.prev,e=n,i=n.next;if(Ee(t,e,i)>=0)return!1;let s=t.x,r=e.x,o=i.x,a=t.y,l=e.y,c=i.y,h=Math.min(s,r,o),f=Math.min(a,l,c),d=Math.max(s,r,o),u=Math.max(a,l,c),p=i.next;for(;p!==t;){if(p.x>=h&&p.x<=d&&p.y>=f&&p.y<=u&&sr(s,a,r,l,o,c,p.x,p.y)&&Ee(p.prev,p,p.next)>=0)return!1;p=p.next}return!0}function Rp(n,t,e,i){let s=n.prev,r=n,o=n.next;if(Ee(s,r,o)>=0)return!1;let a=s.x,l=r.x,c=o.x,h=s.y,f=r.y,d=o.y,u=Math.min(a,l,c),p=Math.min(h,f,d),x=Math.max(a,l,c),m=Math.max(h,f,d),g=Bc(u,p,t,e,i),b=Bc(x,m,t,e,i),T=n.prevZ,v=n.nextZ;for(;T&&T.z>=g&&v&&v.z<=b;){if(T.x>=u&&T.x<=x&&T.y>=p&&T.y<=m&&T!==s&&T!==o&&sr(a,h,l,f,c,d,T.x,T.y)&&Ee(T.prev,T,T.next)>=0||(T=T.prevZ,v.x>=u&&v.x<=x&&v.y>=p&&v.y<=m&&v!==s&&v!==o&&sr(a,h,l,f,c,d,v.x,v.y)&&Ee(v.prev,v,v.next)>=0))return!1;v=v.nextZ}for(;T&&T.z>=g;){if(T.x>=u&&T.x<=x&&T.y>=p&&T.y<=m&&T!==s&&T!==o&&sr(a,h,l,f,c,d,T.x,T.y)&&Ee(T.prev,T,T.next)>=0)return!1;T=T.prevZ}for(;v&&v.z<=b;){if(v.x>=u&&v.x<=x&&v.y>=p&&v.y<=m&&v!==s&&v!==o&&sr(a,h,l,f,c,d,v.x,v.y)&&Ee(v.prev,v,v.next)>=0)return!1;v=v.nextZ}return!0}function Pp(n,t){let e=n;do{let i=e.prev,s=e.next.next;!Ls(i,s)&&wd(i,e,e.next,s)&&Cr(i,s)&&Cr(s,i)&&(t.push(i.i,e.i,s.i),Rr(e),Rr(e.next),e=n=s),e=e.next}while(e!==n);return Gn(e)}function Lp(n,t,e,i,s,r){let o=n;do{let a=o.next.next;for(;a!==o.prev;){if(o.i!==a.i&&zp(o,a)){let l=Ed(o,a);o=Gn(o,o.next),l=Gn(l,l.next),Ar(o,t,e,i,s,r,0),Ar(l,t,e,i,s,r,0);return}a=a.next}o=o.next}while(o!==n)}function Ip(n,t,e,i){let s=[];for(let r=0,o=t.length;r<o;r++){let a=t[r]*i,l=r<o-1?t[r+1]*i:n.length,c=bd(n,a,l,i,!1);c===c.next&&(c.steiner=!0),s.push(kp(c))}s.sort(Dp);for(let r=0;r<s.length;r++)e=Np(s[r],e);return e}function Dp(n,t){let e=n.x-t.x;if(e===0&&(e=n.y-t.y,e===0)){let i=(n.next.y-n.y)/(n.next.x-n.x),s=(t.next.y-t.y)/(t.next.x-t.x);e=i-s}return e}function Np(n,t){let e=Up(n,t);if(!e)return t;let i=Ed(e,n);return Gn(i,i.next),Gn(e,e.next)}function Up(n,t){let e=t,i=n.x,s=n.y,r=-1/0,o;if(Ls(n,e))return e;do{if(Ls(n,e.next))return e.next;if(s<=e.y&&s>=e.next.y&&e.next.y!==e.y){let f=e.x+(s-e.y)*(e.next.x-e.x)/(e.next.y-e.y);if(f<=i&&f>r&&(r=f,o=e.x<e.next.x?e:e.next,f===i))return o}e=e.next}while(e!==t);if(!o)return null;let a=o,l=o.x,c=o.y,h=1/0;e=o;do{if(i>=e.x&&e.x>=l&&i!==e.x&&Sd(s<c?i:r,s,l,c,s<c?r:i,s,e.x,e.y)){let f=Math.abs(s-e.y)/(i-e.x);Cr(e,n)&&(f<h||f===h&&(e.x>o.x||e.x===o.x&&Fp(o,e)))&&(o=e,h=f)}e=e.next}while(e!==a);return o}function Fp(n,t){return Ee(n.prev,n,t.prev)<0&&Ee(t.next,n,n.next)<0}function Op(n,t,e,i){let s=n;do s.z===0&&(s.z=Bc(s.x,s.y,t,e,i)),s.prevZ=s.prev,s.nextZ=s.next,s=s.next;while(s!==n);s.prevZ.nextZ=null,s.prevZ=null,Bp(s)}function Bp(n){let t,e=1;do{let i=n,s;n=null;let r=null;for(t=0;i;){t++;let o=i,a=0;for(let c=0;c<e&&(a++,o=o.nextZ,!!o);c++);let l=e;for(;a>0||l>0&&o;)a!==0&&(l===0||!o||i.z<=o.z)?(s=i,i=i.nextZ,a--):(s=o,o=o.nextZ,l--),r?r.nextZ=s:n=s,s.prevZ=r,r=s;i=o}r.nextZ=null,e*=2}while(t>1);return n}function Bc(n,t,e,i,s){return n=(n-e)*s|0,t=(t-i)*s|0,n=(n|n<<8)&16711935,n=(n|n<<4)&252645135,n=(n|n<<2)&858993459,n=(n|n<<1)&1431655765,t=(t|t<<8)&16711935,t=(t|t<<4)&252645135,t=(t|t<<2)&858993459,t=(t|t<<1)&1431655765,n|t<<1}function kp(n){let t=n,e=n;do(t.x<e.x||t.x===e.x&&t.y<e.y)&&(e=t),t=t.next;while(t!==n);return e}function Sd(n,t,e,i,s,r,o,a){return(s-o)*(t-a)>=(n-o)*(r-a)&&(n-o)*(i-a)>=(e-o)*(t-a)&&(e-o)*(r-a)>=(s-o)*(i-a)}function sr(n,t,e,i,s,r,o,a){return!(n===o&&t===a)&&Sd(n,t,e,i,s,r,o,a)}function zp(n,t){return n.next.i!==t.i&&n.prev.i!==t.i&&!Hp(n,t)&&(Cr(n,t)&&Cr(t,n)&&Vp(n,t)&&(Ee(n.prev,n,t.prev)||Ee(n,t.prev,t))||Ls(n,t)&&Ee(n.prev,n,n.next)>0&&Ee(t.prev,t,t.next)>0)}function Ee(n,t,e){return(t.y-n.y)*(e.x-t.x)-(t.x-n.x)*(e.y-t.y)}function Ls(n,t){return n.x===t.x&&n.y===t.y}function wd(n,t,e,i){let s=Zo(Ee(n,t,e)),r=Zo(Ee(n,t,i)),o=Zo(Ee(e,i,n)),a=Zo(Ee(e,i,t));return!!(s!==r&&o!==a||s===0&&Yo(n,e,t)||r===0&&Yo(n,i,t)||o===0&&Yo(e,n,i)||a===0&&Yo(e,t,i))}function Yo(n,t,e){return t.x<=Math.max(n.x,e.x)&&t.x>=Math.min(n.x,e.x)&&t.y<=Math.max(n.y,e.y)&&t.y>=Math.min(n.y,e.y)}function Zo(n){return n>0?1:n<0?-1:0}function Hp(n,t){let e=n;do{if(e.i!==n.i&&e.next.i!==n.i&&e.i!==t.i&&e.next.i!==t.i&&wd(e,e.next,n,t))return!0;e=e.next}while(e!==n);return!1}function Cr(n,t){return Ee(n.prev,n,n.next)<0?Ee(n,t,n.next)>=0&&Ee(n,n.prev,t)>=0:Ee(n,t,n.prev)<0||Ee(n,n.next,t)<0}function Vp(n,t){let e=n,i=!1,s=(n.x+t.x)/2,r=(n.y+t.y)/2;do e.y>r!=e.next.y>r&&e.next.y!==e.y&&s<(e.next.x-e.x)*(r-e.y)/(e.next.y-e.y)+e.x&&(i=!i),e=e.next;while(e!==n);return i}function Ed(n,t){let e=kc(n.i,n.x,n.y),i=kc(t.i,t.x,t.y),s=n.next,r=t.prev;return n.next=t,t.prev=n,e.next=s,s.prev=e,i.next=e,e.prev=i,r.next=i,i.prev=r,i}function Pu(n,t,e,i){let s=kc(n,t,e);return i?(s.next=i.next,s.prev=i,i.next.prev=s,i.next=s):(s.prev=s,s.next=s),s}function Rr(n){n.next.prev=n.prev,n.prev.next=n.next,n.prevZ&&(n.prevZ.nextZ=n.nextZ),n.nextZ&&(n.nextZ.prevZ=n.prevZ)}function kc(n,t,e){return{i:n,x:t,y:e,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function Gp(n,t,e,i){let s=0;for(let r=t,o=e-i;r<e;r+=i)s+=(n[o]-n[r])*(n[r+1]+n[o+1]),o=r;return s}var zc=class{static triangulate(t,e,i=2){return Ap(t,e,i)}},Oi=class n{static area(t){let e=t.length,i=0;for(let s=e-1,r=0;r<e;s=r++)i+=t[s].x*t[r].y-t[r].x*t[s].y;return i*.5}static isClockWise(t){return n.area(t)<0}static triangulateShape(t,e){let i=[],s=[],r=[];Lu(t),Iu(i,t);let o=t.length;e.forEach(Lu);for(let l=0;l<e.length;l++)s.push(o),o+=e[l].length,Iu(i,e[l]);let a=zc.triangulate(i,s);for(let l=0;l<a.length;l+=3)r.push(a.slice(l,l+3));return r}};function Lu(n){let t=n.length;t>2&&n[t-1].equals(n[0])&&n.pop()}function Iu(n,t){for(let e=0;e<t.length;e++)n.push(t[e].x),n.push(t[e].y)}var Pr=class n extends we{constructor(t=new Vn([new tt(.5,.5),new tt(-.5,.5),new tt(-.5,-.5),new tt(.5,-.5)]),e={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:t,options:e},t=Array.isArray(t)?t:[t];let i=this,s=[],r=[];for(let a=0,l=t.length;a<l;a++){let c=t[a];o(c)}this.setAttribute("position",new oe(s,3)),this.setAttribute("uv",new oe(r,2)),this.computeVertexNormals();function o(a){let l=[],c=e.curveSegments!==void 0?e.curveSegments:12,h=e.steps!==void 0?e.steps:1,f=e.depth!==void 0?e.depth:1,d=e.bevelEnabled!==void 0?e.bevelEnabled:!0,u=e.bevelThickness!==void 0?e.bevelThickness:.2,p=e.bevelSize!==void 0?e.bevelSize:u-.1,x=e.bevelOffset!==void 0?e.bevelOffset:0,m=e.bevelSegments!==void 0?e.bevelSegments:3,g=e.extrudePath,b=e.UVGenerator!==void 0?e.UVGenerator:Wp,T,v=!1,S,C,P,y;if(g){T=g.getSpacedPoints(h),v=!0,d=!1;let et=g.isCatmullRomCurve3?g.closed:!1;S=g.computeFrenetFrames(h,et),C=new D,P=new D,y=new D}d||(m=0,u=0,p=0,x=0);let A=a.extractPoints(c),U=A.shape,I=A.holes;if(!Oi.isClockWise(U)){U=U.reverse();for(let et=0,at=I.length;et<at;et++){let st=I[et];Oi.isClockWise(st)&&(I[et]=st.reverse())}}function E(et){let st=10000000000000001e-36,ot=et[0];for(let ct=1;ct<=et.length;ct++){let Ut=ct%et.length,Rt=et[Ut],It=Rt.x-ot.x,Xt=Rt.y-ot.y,B=It*It+Xt*Xt,ne=Math.max(Math.abs(Rt.x),Math.abs(Rt.y),Math.abs(ot.x),Math.abs(ot.y)),jt=st*ne*ne;if(B<=jt){et.splice(Ut,1),ct--;continue}ot=Rt}}E(U),I.forEach(E);let R=I.length,N=U;for(let et=0;et<R;et++){let at=I[et];U=U.concat(at)}function O(et,at,st){return at||Yt("ExtrudeGeometry: vec does not exist"),et.clone().addScaledVector(at,st)}let F=U.length;function V(et,at,st){let ot,ct,Ut,Rt=et.x-at.x,It=et.y-at.y,Xt=st.x-et.x,B=st.y-et.y,ne=Rt*Rt+It*It,jt=Rt*B-It*Xt;if(Math.abs(jt)>Number.EPSILON){let L=Math.sqrt(ne),_=Math.sqrt(Xt*Xt+B*B),G=at.x-It/L,X=at.y+Rt/L,Q=st.x-B/_,ut=st.y+Xt/_,pt=((Q-G)*B-(ut-X)*Xt)/(Rt*B-It*Xt);ot=G+Rt*pt-et.x,ct=X+It*pt-et.y;let $=ot*ot+ct*ct;if($<=2)return new tt(ot,ct);Ut=Math.sqrt($/2)}else{let L=!1;Rt>Number.EPSILON?Xt>Number.EPSILON&&(L=!0):Rt<-Number.EPSILON?Xt<-Number.EPSILON&&(L=!0):Math.sign(It)===Math.sign(B)&&(L=!0),L?(ot=-It,ct=Rt,Ut=Math.sqrt(ne)):(ot=Rt,ct=It,Ut=Math.sqrt(ne/2))}return new tt(ot/Ut,ct/Ut)}let k=[];for(let et=0,at=N.length,st=at-1,ot=et+1;et<at;et++,st++,ot++)st===at&&(st=0),ot===at&&(ot=0),k[et]=V(N[et],N[st],N[ot]);let W=[],j,ht=k.concat();for(let et=0,at=R;et<at;et++){let st=I[et];j=[];for(let ot=0,ct=st.length,Ut=ct-1,Rt=ot+1;ot<ct;ot++,Ut++,Rt++)Ut===ct&&(Ut=0),Rt===ct&&(Rt=0),j[ot]=V(st[ot],st[Ut],st[Rt]);W.push(j),ht=ht.concat(j)}let ft;if(m===0)ft=Oi.triangulateShape(N,I);else{let et=[],at=[];for(let st=0;st<m;st++){let ot=st/m,ct=u*Math.cos(ot*Math.PI/2),Ut=p*Math.sin(ot*Math.PI/2)+x;for(let Rt=0,It=N.length;Rt<It;Rt++){let Xt=O(N[Rt],k[Rt],Ut);dt(Xt.x,Xt.y,-ct),ot===0&&et.push(Xt)}for(let Rt=0,It=R;Rt<It;Rt++){let Xt=I[Rt];j=W[Rt];let B=[];for(let ne=0,jt=Xt.length;ne<jt;ne++){let L=O(Xt[ne],j[ne],Ut);dt(L.x,L.y,-ct),ot===0&&B.push(L)}ot===0&&at.push(B)}}ft=Oi.triangulateShape(et,at)}let At=ft.length,wt=p+x;for(let et=0;et<F;et++){let at=d?O(U[et],ht[et],wt):U[et];v?(P.copy(S.normals[0]).multiplyScalar(at.x),C.copy(S.binormals[0]).multiplyScalar(at.y),y.copy(T[0]).add(P).add(C),dt(y.x,y.y,y.z)):dt(at.x,at.y,0)}for(let et=1;et<=h;et++)for(let at=0;at<F;at++){let st=d?O(U[at],ht[at],wt):U[at];v?(P.copy(S.normals[et]).multiplyScalar(st.x),C.copy(S.binormals[et]).multiplyScalar(st.y),y.copy(T[et]).add(P).add(C),dt(y.x,y.y,y.z)):dt(st.x,st.y,f/h*et)}for(let et=m-1;et>=0;et--){let at=et/m,st=u*Math.cos(at*Math.PI/2),ot=p*Math.sin(at*Math.PI/2)+x;for(let ct=0,Ut=N.length;ct<Ut;ct++){let Rt=O(N[ct],k[ct],ot);dt(Rt.x,Rt.y,f+st)}for(let ct=0,Ut=I.length;ct<Ut;ct++){let Rt=I[ct];j=W[ct];for(let It=0,Xt=Rt.length;It<Xt;It++){let B=O(Rt[It],j[It],ot);v?dt(B.x,B.y+T[h-1].y,T[h-1].x+st):dt(B.x,B.y,f+st)}}}Gt(),Z();function Gt(){let et=s.length/3;if(d){let at=0,st=F*at;for(let ot=0;ot<At;ot++){let ct=ft[ot];Pt(ct[2]+st,ct[1]+st,ct[0]+st)}at=h+m*2,st=F*at;for(let ot=0;ot<At;ot++){let ct=ft[ot];Pt(ct[0]+st,ct[1]+st,ct[2]+st)}}else{for(let at=0;at<At;at++){let st=ft[at];Pt(st[2],st[1],st[0])}for(let at=0;at<At;at++){let st=ft[at];Pt(st[0]+F*h,st[1]+F*h,st[2]+F*h)}}i.addGroup(et,s.length/3-et,0)}function Z(){let et=s.length/3,at=0;K(N,at),at+=N.length;for(let st=0,ot=I.length;st<ot;st++){let ct=I[st];K(ct,at),at+=ct.length}i.addGroup(et,s.length/3-et,1)}function K(et,at){let st=et.length;for(;--st>=0;){let ot=st,ct=st-1;ct<0&&(ct=et.length-1);for(let Ut=0,Rt=h+m*2;Ut<Rt;Ut++){let It=F*Ut,Xt=F*(Ut+1),B=at+ot+It,ne=at+ct+It,jt=at+ct+Xt,L=at+ot+Xt;vt(B,ne,jt,L)}}}function dt(et,at,st){l.push(et),l.push(at),l.push(st)}function Pt(et,at,st){Bt(et),Bt(at),Bt(st);let ot=s.length/3,ct=b.generateTopUV(i,s,ot-3,ot-2,ot-1);ee(ct[0]),ee(ct[1]),ee(ct[2])}function vt(et,at,st,ot){Bt(et),Bt(at),Bt(ot),Bt(at),Bt(st),Bt(ot);let ct=s.length/3,Ut=b.generateSideWallUV(i,s,ct-6,ct-3,ct-2,ct-1);ee(Ut[0]),ee(Ut[1]),ee(Ut[3]),ee(Ut[1]),ee(Ut[2]),ee(Ut[3])}function Bt(et){s.push(l[et*3+0]),s.push(l[et*3+1]),s.push(l[et*3+2])}function ee(et){r.push(et.x),r.push(et.y)}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){let t=super.toJSON(),e=this.parameters.shapes,i=this.parameters.options;return Xp(e,i,t)}static fromJSON(t,e){let i=[];for(let r=0,o=t.shapes.length;r<o;r++){let a=e[t.shapes[r]];i.push(a)}let s=t.options.extrudePath;return s!==void 0&&(t.options.extrudePath=new Oc[s.type]().fromJSON(s)),new n(i,t.options)}},Wp={generateTopUV:function(n,t,e,i,s){let r=t[e*3],o=t[e*3+1],a=t[i*3],l=t[i*3+1],c=t[s*3],h=t[s*3+1];return[new tt(r,o),new tt(a,l),new tt(c,h)]},generateSideWallUV:function(n,t,e,i,s,r){let o=t[e*3],a=t[e*3+1],l=t[e*3+2],c=t[i*3],h=t[i*3+1],f=t[i*3+2],d=t[s*3],u=t[s*3+1],p=t[s*3+2],x=t[r*3],m=t[r*3+1],g=t[r*3+2];return Math.abs(a-h)<Math.abs(o-c)?[new tt(o,1-l),new tt(c,1-f),new tt(d,1-p),new tt(x,1-g)]:[new tt(a,1-l),new tt(h,1-f),new tt(u,1-p),new tt(m,1-g)]}};function Xp(n,t,e){if(e.shapes=[],Array.isArray(n))for(let i=0,s=n.length;i<s;i++){let r=n[i];e.shapes.push(r.uuid)}else e.shapes.push(n.uuid);return e.options=Object.assign({},t),t.extrudePath!==void 0&&(e.options.extrudePath=t.extrudePath.toJSON()),e}var _n=class n extends we{constructor(t=1,e=1,i=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:i,heightSegments:s};let r=t/2,o=e/2,a=Math.floor(i),l=Math.floor(s),c=a+1,h=l+1,f=t/a,d=e/l,u=[],p=[],x=[],m=[];for(let g=0;g<h;g++){let b=g*d-o;for(let T=0;T<c;T++){let v=T*f-r;p.push(v,-b,0),x.push(0,0,1),m.push(T/a),m.push(1-g/l)}}for(let g=0;g<l;g++)for(let b=0;b<a;b++){let T=b+c*g,v=b+c*(g+1),S=b+1+c*(g+1),C=b+1+c*g;u.push(T,v,C),u.push(v,S,C)}this.setIndex(u),this.setAttribute("position",new oe(p,3)),this.setAttribute("normal",new oe(x,3)),this.setAttribute("uv",new oe(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new n(t.width,t.height,t.widthSegments,t.heightSegments)}};var sn=class n extends we{constructor(t=new Vn([new tt(0,.5),new tt(-.5,-.5),new tt(.5,-.5)]),e=12){super(),this.type="ShapeGeometry",this.parameters={shapes:t,curveSegments:e};let i=[],s=[],r=[],o=[],a=0,l=0;if(Array.isArray(t)===!1)c(t);else for(let h=0;h<t.length;h++)c(t[h]),this.addGroup(a,l,h),a+=l,l=0;this.setIndex(i),this.setAttribute("position",new oe(s,3)),this.setAttribute("normal",new oe(r,3)),this.setAttribute("uv",new oe(o,2));function c(h){let f=s.length/3,d=h.extractPoints(e),u=d.shape,p=d.holes;Oi.isClockWise(u)===!1&&(u=u.reverse());for(let m=0,g=p.length;m<g;m++){let b=p[m];Oi.isClockWise(b)===!0&&(p[m]=b.reverse())}let x=Oi.triangulateShape(u,p);for(let m=0,g=p.length;m<g;m++){let b=p[m];u=u.concat(b)}for(let m=0,g=u.length;m<g;m++){let b=u[m];s.push(b.x,b.y,0),r.push(0,0,1),o.push(b.x,b.y)}for(let m=0,g=x.length;m<g;m++){let b=x[m],T=b[0]+f,v=b[1]+f,S=b[2]+f;i.push(T,v,S),l+=3}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){let t=super.toJSON(),e=this.parameters.shapes;return qp(e,t)}static fromJSON(t,e){let i=[];for(let s=0,r=t.shapes.length;s<r;s++){let o=e[t.shapes[s]];i.push(o)}return new n(i,t.curveSegments)}};function qp(n,t){if(t.shapes=[],Array.isArray(n))for(let e=0,i=n.length;e<i;e++){let s=n[e];t.shapes.push(s.uuid)}else t.shapes.push(n.uuid);return t}var yn=class n extends we{constructor(t=1,e=32,i=16,s=0,r=Math.PI*2,o=0,a=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:i,phiStart:s,phiLength:r,thetaStart:o,thetaLength:a},e=Math.max(3,Math.floor(e)),i=Math.max(2,Math.floor(i));let l=Math.min(o+a,Math.PI),c=0,h=[],f=new D,d=new D,u=[],p=[],x=[],m=[];for(let g=0;g<=i;g++){let b=[],T=g/i,v=o+T*a,S=t*Math.cos(v),C=Math.sqrt(t*t-S*S),P=0;g===0&&o===0?P=.5/e:g===i&&l===Math.PI&&(P=-.5/e);for(let y=0;y<=e;y++){let A=y/e,U=s+A*r;f.x=-C*Math.cos(U),f.y=S,f.z=C*Math.sin(U),p.push(f.x,f.y,f.z),d.copy(f).normalize(),x.push(d.x,d.y,d.z),m.push(A+P,1-T),b.push(c++)}h.push(b)}for(let g=0;g<i;g++)for(let b=0;b<e;b++){let T=h[g][b+1],v=h[g][b],S=h[g+1][b],C=h[g+1][b+1];(g!==0||o>0)&&u.push(T,v,C),(g!==i-1||l<Math.PI)&&u.push(v,S,C)}this.setIndex(u),this.setAttribute("position",new oe(p,3)),this.setAttribute("normal",new oe(x,3)),this.setAttribute("uv",new oe(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new n(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}};function Zn(n){let t={};for(let e in n){t[e]={};for(let i in n[e]){let s=n[e][i];if(Du(s))s.isRenderTargetTexture?(qt("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][i]=null):t[e][i]=s.clone();else if(Array.isArray(s))if(Du(s[0])){let r=[];for(let o=0,a=s.length;o<a;o++)r[o]=s[o].clone();t[e][i]=r}else t[e][i]=s.slice();else t[e][i]=s}}return t}function $e(n){let t={};for(let e=0;e<n.length;e++){let i=Zn(n[e]);for(let s in i)t[s]=i[s]}return t}function Du(n){return n&&(n.isColor||n.isMatrix3||n.isMatrix4||n.isVector2||n.isVector3||n.isVector4||n.isTexture||n.isQuaternion)}function Yp(n){let t=[];for(let e=0;e<n.length;e++)t.push(n[e].clone());return t}function hh(n){let t=n.getRenderTarget();return t===null?n.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:ie.workingColorSpace}var Ce={clone:Zn,merge:$e},Zp=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,jp=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,le=class extends vi{constructor(t){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Zp,this.fragmentShader=jp,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=Zn(t.uniforms),this.uniformsGroups=Yp(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this.defaultAttributeValues=Object.assign({},t.defaultAttributeValues),this.index0AttributeName=t.index0AttributeName,this.uniformsNeedUpdate=t.uniformsNeedUpdate,this}toJSON(t){let e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(let s in this.uniforms){let o=this.uniforms[s].value;o&&o.isTexture?e.uniforms[s]={type:"t",value:o.toJSON(t).uuid}:o&&o.isColor?e.uniforms[s]={type:"c",value:o.getHex()}:o&&o.isVector2?e.uniforms[s]={type:"v2",value:o.toArray()}:o&&o.isVector3?e.uniforms[s]={type:"v3",value:o.toArray()}:o&&o.isVector4?e.uniforms[s]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?e.uniforms[s]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?e.uniforms[s]={type:"m4",value:o.toArray()}:e.uniforms[s]={value:o}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;let i={};for(let s in this.extensions)this.extensions[s]===!0&&(i[s]=!0);return Object.keys(i).length>0&&(e.extensions=i),e}fromJSON(t,e){if(super.fromJSON(t,e),t.uniforms!==void 0)for(let i in t.uniforms){let s=t.uniforms[i];switch(this.uniforms[i]={},s.type){case"t":this.uniforms[i].value=e[s.value]||null;break;case"c":this.uniforms[i].value=new Ft().setHex(s.value);break;case"v2":this.uniforms[i].value=new tt().fromArray(s.value);break;case"v3":this.uniforms[i].value=new D().fromArray(s.value);break;case"v4":this.uniforms[i].value=new xe().fromArray(s.value);break;case"m3":this.uniforms[i].value=new Kt().fromArray(s.value);break;case"m4":this.uniforms[i].value=new re().fromArray(s.value);break;default:this.uniforms[i].value=s.value}}if(t.defines!==void 0&&(this.defines=t.defines),t.vertexShader!==void 0&&(this.vertexShader=t.vertexShader),t.fragmentShader!==void 0&&(this.fragmentShader=t.fragmentShader),t.glslVersion!==void 0&&(this.glslVersion=t.glslVersion),t.extensions!==void 0)for(let i in t.extensions)this.extensions[i]=t.extensions[i];return t.lights!==void 0&&(this.lights=t.lights),t.clipping!==void 0&&(this.clipping=t.clipping),this}},Is=class extends le{constructor(t){super(t),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}},ke=class extends vi{constructor(t){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Ft(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Ft(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Bs,this.normalScale=new tt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new zi,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={STANDARD:""},this.color.copy(t.color),this.roughness=t.roughness,this.metalness=t.metalness,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.roughnessMap=t.roughnessMap,this.metalnessMap=t.metalnessMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.envMapIntensity=t.envMapIntensity,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}},Lr=class extends ke{constructor(t){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new tt(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return Qt(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(e){this.ior=(1+.4*e)/(1-.4*e)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new Ft(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new Ft(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new Ft(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._retroreflectivity=0,this._sheen=0,this._transmission=0,this.setValues(t)}get anisotropy(){return this._anisotropy}set anisotropy(t){this._anisotropy>0!=t>0&&this.version++,this._anisotropy=t}get clearcoat(){return this._clearcoat}set clearcoat(t){this._clearcoat>0!=t>0&&this.version++,this._clearcoat=t}get iridescence(){return this._iridescence}set iridescence(t){this._iridescence>0!=t>0&&this.version++,this._iridescence=t}get dispersion(){return this._dispersion}set dispersion(t){this._dispersion>0!=t>0&&this.version++,this._dispersion=t}get retroreflectivity(){return this._retroreflectivity}set retroreflectivity(t){this._retroreflectivity>0!=t>0&&this.version++,this._retroreflectivity=t}get sheen(){return this._sheen}set sheen(t){this._sheen>0!=t>0&&this.version++,this._sheen=t}get transmission(){return this._transmission}set transmission(t){this._transmission>0!=t>0&&this.version++,this._transmission=t}copy(t){return super.copy(t),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=t.anisotropy,this.anisotropyRotation=t.anisotropyRotation,this.anisotropyMap=t.anisotropyMap,this.clearcoat=t.clearcoat,this.clearcoatMap=t.clearcoatMap,this.clearcoatRoughness=t.clearcoatRoughness,this.clearcoatRoughnessMap=t.clearcoatRoughnessMap,this.clearcoatNormalMap=t.clearcoatNormalMap,this.clearcoatNormalScale.copy(t.clearcoatNormalScale),this.dispersion=t.dispersion,this.ior=t.ior,this.iridescence=t.iridescence,this.iridescenceMap=t.iridescenceMap,this.iridescenceIOR=t.iridescenceIOR,this.iridescenceThicknessRange=[...t.iridescenceThicknessRange],this.iridescenceThicknessMap=t.iridescenceThicknessMap,this.retroreflectivity=t.retroreflectivity,this.sheen=t.sheen,this.sheenColor.copy(t.sheenColor),this.sheenColorMap=t.sheenColorMap,this.sheenRoughness=t.sheenRoughness,this.sheenRoughnessMap=t.sheenRoughnessMap,this.transmission=t.transmission,this.transmissionMap=t.transmissionMap,this.thickness=t.thickness,this.thicknessMap=t.thicknessMap,this.attenuationDistance=t.attenuationDistance,this.attenuationColor.copy(t.attenuationColor),this.specularIntensity=t.specularIntensity,this.specularIntensityMap=t.specularIntensityMap,this.specularColor.copy(t.specularColor),this.specularColorMap=t.specularColorMap,this}};var Ir=class extends vi{constructor(t){super(),this.isMeshNormalMaterial=!0,this.type="MeshNormalMaterial",this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Bs,this.normalScale=new tt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.flatShading=!1,this.setValues(t)}copy(t){return super.copy(t),this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.flatShading=t.flatShading,this}},Dr=class extends vi{constructor(t){super(),this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new Ft(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Ft(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Bs,this.normalScale=new tt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new zi,this.combine=Oa,this.reflectivity=1,this.envMapIntensity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.envMapIntensity=t.envMapIntensity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}},Ma=class extends vi{constructor(t){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=ad,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}},ba=class extends vi{constructor(t){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}};function ps(n,t){return!n||n.constructor===t?n:typeof t.BYTES_PER_ELEMENT=="number"?new t(n):Array.prototype.slice.call(n)}function Lc(n){return n!==void 0&&n.inTangents!==void 0&&n.outTangents!==void 0}var Mn=class{constructor(t,e,i,s){this.parameterPositions=t,this._cachedIndex=0,this.resultBuffer=s!==void 0?s:new e.constructor(i),this.sampleValues=e,this.valueSize=i,this.settings=null,this.DefaultSettings_={}}evaluate(t){let e=this.parameterPositions,i=this._cachedIndex,s=e[i],r=e[i-1];i:{t:{let o;e:{n:if(!(t<s)){for(let a=i+2;;){if(s===void 0){if(t<r)break n;return i=e.length,this._cachedIndex=i,this.copySampleValue_(i-1)}if(i===a)break;if(r=s,s=e[++i],t<s)break t}o=e.length;break e}if(!(t>=r)){let a=e[1];t<a&&(i=2,r=a);for(let l=i-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===l)break;if(s=r,r=e[--i-1],t>=r)break t}o=i,i=0;break e}break i}for(;i<o;){let a=i+o>>>1;t<e[a]?o=a:i=a+1}if(s=e[i],r=e[i-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(s===void 0)return i=e.length,this._cachedIndex=i,this.copySampleValue_(i-1)}this._cachedIndex=i,this.intervalChanged_(i,r,s)}return this.interpolate_(i,r,t,s)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(t){let e=this.resultBuffer,i=this.sampleValues,s=this.valueSize,r=t*s;for(let o=0;o!==s;++o)e[o]=i[r+o];return e}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},Sa=class extends Mn{constructor(t,e,i,s){super(t,e,i,s),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:Nc,endingEnd:Nc}}intervalChanged_(t,e,i){let s=this.parameterPositions,r=t-2,o=t+1,a=s[r],l=s[o];if(a===void 0)switch(this.getSettings_().endingStart){case Uc:r=t,a=2*e-i;break;case Fc:r=s.length-2,a=e+s[r]-s[r+1];break;default:r=t,a=i}if(l===void 0)switch(this.getSettings_().endingEnd){case Uc:o=t,l=2*i-e;break;case Fc:o=1,l=i+s[1]-s[0];break;default:o=t-1,l=e}let c=(i-e)*.5,h=this.valueSize;this._weightPrev=c/(e-a),this._weightNext=c/(l-i),this._offsetPrev=r*h,this._offsetNext=o*h}interpolate_(t,e,i,s){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=t*a,c=l-a,h=this._offsetPrev,f=this._offsetNext,d=this._weightPrev,u=this._weightNext,p=(i-e)/(s-e),x=p*p,m=x*p,g=-d*m+2*d*x-d*p,b=(1+d)*m+(-1.5-2*d)*x+(-.5+d)*p+1,T=(-1-u)*m+(1.5+u)*x+.5*p,v=u*m-u*x;for(let S=0;S!==a;++S)r[S]=g*o[h+S]+b*o[c+S]+T*o[l+S]+v*o[f+S];return r}},wa=class extends Mn{constructor(t,e,i,s){super(t,e,i,s)}interpolate_(t,e,i,s){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=t*a,c=l-a,h=(i-e)/(s-e),f=1-h;for(let d=0;d!==a;++d)r[d]=o[c+d]*f+o[l+d]*h;return r}},Ea=class extends Mn{constructor(t,e,i,s){super(t,e,i,s)}interpolate_(t){return this.copySampleValue_(t-1)}},Ta=class extends Mn{interpolate_(t,e,i,s){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=t*a,c=l-a,h=this.inTangents,f=this.outTangents;if(!h||!f){let p=(i-e)/(s-e),x=1-p;for(let m=0;m!==a;++m)r[m]=o[c+m]*x+o[l+m]*p;return r}let d=a*2,u=t-1;for(let p=0;p!==a;++p){let x=o[c+p],m=o[l+p],g=u*d+p*2,b=f[g],T=f[g+1],v=t*d+p*2,S=h[v],C=h[v+1],P=Jp(i,e,b,S,s);r[p]=Td(P,x,T,C,m)}return r}};function Td(n,t,e,i,s){let r=1-n;return r*r*r*t+3*r*r*n*e+3*r*n*n*i+n*n*n*s}function Kp(n,t,e,i,s){let r=1-n;return 3*r*r*(e-t)+6*r*n*(i-e)+3*n*n*(s-i)}function Jp(n,t,e,i,s){let r=(n-t)/(s-t);for(let o=0;o<8;o++){let a=Td(r,t,e,i,s)-n;if(Math.abs(a)<1e-10)break;let l=Kp(r,t,e,i,s);if(Math.abs(l)<1e-10)break;r=Math.max(0,Math.min(1,r-a/l))}return r}var fi=class{constructor(t,e,i,s){if(t===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(e===void 0||e.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+t);this.name=t,this.times=ps(e,this.TimeBufferType),this.values=ps(i,this.ValueBufferType),this.setInterpolation(s||this.DefaultInterpolation)}static toJSON(t){let e=t.constructor,i;if(e.toJSON!==this.toJSON)i=e.toJSON(t);else{i={name:t.name,times:ps(t.times,Array),values:ps(t.values,Array)};let s=t.getInterpolation();s!==t.DefaultInterpolation&&(i.interpolation=s),Lc(t.settings)&&(i.settings={inTangents:ps(t.settings.inTangents,Array),outTangents:ps(t.settings.outTangents,Array)})}return i.type=t.ValueTypeName,i}InterpolantFactoryMethodDiscrete(t){return new Ea(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodLinear(t){return new wa(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodSmooth(t){return new Sa(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodBezier(t){let e=new Ta(this.times,this.values,this.getValueSize(),t);return this.settings&&(e.inTangents=this.settings.inTangents,e.outTangents=this.settings.outTangents),e}setInterpolation(t){let e;switch(t){case cr:e=this.InterpolantFactoryMethodDiscrete;break;case aa:e=this.InterpolantFactoryMethodLinear;break;case Jo:e=this.InterpolantFactoryMethodSmooth;break;case Dc:e=this.InterpolantFactoryMethodBezier;break}if(e===void 0){let i="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(t!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(i);return qt("KeyframeTrack:",i),this}return this.createInterpolant=e,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return cr;case this.InterpolantFactoryMethodLinear:return aa;case this.InterpolantFactoryMethodSmooth:return Jo;case this.InterpolantFactoryMethodBezier:return Dc}}getValueSize(){return this.values.length/this.times.length}shift(t){if(t!==0){let e=this.times;for(let i=0,s=e.length;i!==s;++i)e[i]+=t}return this}scale(t){if(t!==1){let e=this.times;for(let i=0,s=e.length;i!==s;++i)e[i]*=t;Lc(this.settings)&&(Nu(this.settings.inTangents,t),Nu(this.settings.outTangents,t))}return this}trim(t,e){let i=this.times,s=i.length,r=0,o=s-1;for(;r!==s&&i[r]<t;)++r;for(;o!==-1&&i[o]>e;)--o;if(++o,r!==0||o!==s){r>=o&&(o=Math.max(o,1),r=o-1);let a=this.getValueSize();this.times=i.slice(r,o),this.values=this.values.slice(r*a,o*a)}return this}validate(){let t=!0,e=this.getValueSize();e-Math.floor(e)!==0&&(Yt("KeyframeTrack: Invalid value size in track.",this),t=!1);let i=this.times,s=this.values,r=i.length;r===0&&(Yt("KeyframeTrack: Track is empty.",this),t=!1);let o=null;for(let a=0;a!==r;a++){let l=i[a];if(typeof l=="number"&&isNaN(l)){Yt("KeyframeTrack: Time is not a valid number.",this,a,l),t=!1;break}if(o!==null&&o>l){Yt("KeyframeTrack: Out of order keys.",this,a,l,o),t=!1;break}o=l}if(s!==void 0&&kf(s))for(let a=0,l=s.length;a!==l;++a){let c=s[a];if(isNaN(c)){Yt("KeyframeTrack: Value is not a valid number.",this,a,c),t=!1;break}}return t}optimize(){let t=this.times.slice(),e=this.values.slice(),i=this.getValueSize(),s=this.getInterpolation()===Jo,r=t.length-1,o=1;for(let a=1;a<r;++a){let l=!1,c=t[a],h=t[a+1];if(c!==h&&(a!==1||c!==t[0]))if(s)l=!0;else{let f=a*i,d=f-i,u=f+i;for(let p=0;p!==i;++p){let x=e[f+p];if(x!==e[d+p]||x!==e[u+p]){l=!0;break}}}if(l){if(a!==o){t[o]=t[a];let f=a*i,d=o*i;for(let u=0;u!==i;++u)e[d+u]=e[f+u]}++o}}if(r>0){t[o]=t[r];for(let a=r*i,l=o*i,c=0;c!==i;++c)e[l+c]=e[a+c];++o}return o!==t.length?(this.times=t.slice(0,o),this.values=e.slice(0,o*i)):(this.times=t,this.values=e),this}clone(){let t=this.times.slice(),e=this.values.slice(),i=this.constructor,s=new i(this.name,t,e);return s.createInterpolant=this.createInterpolant,Lc(this.settings)&&(s.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()}),s}};function Nu(n,t){for(let e=0,i=n.length;e!==i;e+=2)n[e]*=t}fi.prototype.ValueTypeName="";fi.prototype.TimeBufferType=Float32Array;fi.prototype.ValueBufferType=Float32Array;fi.prototype.DefaultInterpolation=aa;var bn=class extends fi{constructor(t,e,i){super(t,e,i)}};bn.prototype.ValueTypeName="bool";bn.prototype.ValueBufferType=Array;bn.prototype.DefaultInterpolation=cr;bn.prototype.InterpolantFactoryMethodLinear=void 0;bn.prototype.InterpolantFactoryMethodSmooth=void 0;var Aa=class extends fi{constructor(t,e,i,s){super(t,e,i,s)}};Aa.prototype.ValueTypeName="color";var Ca=class extends fi{constructor(t,e,i,s){super(t,e,i,s)}};Ca.prototype.ValueTypeName="number";var Ra=class extends Mn{constructor(t,e,i,s){super(t,e,i,s)}interpolate_(t,e,i,s){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=(i-e)/(s-e),c=t*a;for(let h=c+a;c!==h;c+=4)ui.slerpFlat(r,0,o,c-a,o,c,l);return r}},Nr=class extends fi{constructor(t,e,i,s){super(t,e,i,s)}InterpolantFactoryMethodLinear(t){return new Ra(this.times,this.values,this.getValueSize(),t)}};Nr.prototype.ValueTypeName="quaternion";Nr.prototype.InterpolantFactoryMethodSmooth=void 0;var Sn=class extends fi{constructor(t,e,i){super(t,e,i)}};Sn.prototype.ValueTypeName="string";Sn.prototype.ValueBufferType=Array;Sn.prototype.DefaultInterpolation=cr;Sn.prototype.InterpolantFactoryMethodLinear=void 0;Sn.prototype.InterpolantFactoryMethodSmooth=void 0;var Pa=class extends fi{constructor(t,e,i,s){super(t,e,i,s)}};Pa.prototype.ValueTypeName="vector";var La=class{constructor(t,e,i){let s=this,r=!1,o=0,a=0,l,c=[];this.onStart=void 0,this.onLoad=t,this.onProgress=e,this.onError=i,this._abortController=null,this.itemStart=function(h){a++,r===!1&&s.onStart!==void 0&&s.onStart(h,o,a),r=!0},this.itemEnd=function(h){o++,s.onProgress!==void 0&&s.onProgress(h,o,a),o===a&&(r=!1,s.onLoad!==void 0&&s.onLoad())},this.itemError=function(h){s.onError!==void 0&&s.onError(h)},this.resolveURL=function(h){return h=h.normalize("NFC"),l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,f){return c.push(h,f),this},this.removeHandler=function(h){let f=c.indexOf(h);return f!==-1&&c.splice(f,2),this},this.getHandler=function(h){for(let f=0,d=c.length;f<d;f+=2){let u=c[f],p=c[f+1];if(u.global&&(u.lastIndex=0),u.test(h))return p}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},Ad=new La,Ia=class{constructor(t){this.manager=t!==void 0?t:Ad,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(t,e){let i=this;return new Promise(function(s,r){i.load(t,s,e,r)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}abort(){return this}};Ia.DEFAULT_MATERIAL_NAME="__DEFAULT";var Wn=class extends Xe{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new Ft(t),this.intensity=e}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){let e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,e}},Ur=class extends Wn{constructor(t,e,i){super(t,i),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Xe.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Ft(e)}copy(t,e){return super.copy(t,e),this.groundColor.copy(t.groundColor),this}toJSON(t){let e=super.toJSON(t);return e.object.groundColor=this.groundColor.getHex(),e}},Ic=new re,Uu=new D,Fu=new D,Fr=class{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new tt(512,512),this.mapType=Qe,this.map=null,this.mapPass=null,this.matrix=new re,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Cs,this._frameExtents=new tt(1,1),this._viewportCount=1,this._viewports=[new xe(0,0,1,1)]}getViewportCount(){return this._viewportCount}getCamera(){return this.camera}getFrustum(){return this._frustum}updateMatrices(t){let e=this.camera;Uu.setFromMatrixPosition(t.matrixWorld),e.position.copy(Uu),Fu.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(Fu),e.updateMatrixWorld(),this._updateMatrix(e,this.matrix,this._frustum)}_updateMatrix(t,e,i,s){Ic.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),i.setFromProjectionMatrix(Ic,t.coordinateSystem,t.reversedDepth);let r=this._frameExtents,o=s?s.z/r.x:1,a=s?s.w/r.y:1,l=s?s.x/r.x:0,c=s?s.y/r.y:0;t.coordinateSystem===_s||t.reversedDepth?e.set(.5*o,0,0,.5*o+l,0,.5*a,0,.5*a+c,0,0,1,0,0,0,0,1):e.set(.5*o,0,0,.5*o+l,0,.5*a,0,.5*a+c,0,0,.5,.5,0,0,0,1),e.multiply(Ic)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.autoUpdate=t.autoUpdate,this.needsUpdate=t.needsUpdate,this.normalBias=t.normalBias,this.blurSamples=t.blurSamples,this.mapSize.copy(t.mapSize),this.biasNode=t.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let t={};return t.intensity=this.intensity,t.bias=this.bias,t.normalBias=this.normalBias,t.radius=this.radius,t.blurSamples=this.blurSamples,t.mapSize=this.mapSize.toArray(),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}},jo=new D,Ko=new ui,Fi=new D,Or=class extends Xe{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new re,this.projectionMatrix=new re,this.projectionMatrixInverse=new re,this.coordinateSystem=Ci,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorld.decompose(jo,Ko,Fi),Fi.x===1&&Fi.y===1&&Fi.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(jo,Ko,Fi.set(1,1,1)).invert()}updateWorldMatrix(t,e,i=!1){super.updateWorldMatrix(t,e,i),this.matrixWorld.decompose(jo,Ko,Fi),Fi.x===1&&Fi.y===1&&Fi.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(jo,Ko,Fi.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},mn=new D,Ou=new tt,Bu=new tt,Ne=class extends Or{constructor(t=50,e=1,i=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=i,this.far=s,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){let e=.5*this.getFilmHeight()/t;this.fov=Ms*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){let t=Math.tan(rr*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return Ms*2*Math.atan(Math.tan(rr*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,i){mn.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set(mn.x,mn.y).multiplyScalar(-t/mn.z),mn.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(mn.x,mn.y).multiplyScalar(-t/mn.z)}getViewSize(t,e){return this.getViewBounds(t,Ou,Bu),e.subVectors(Bu,Ou)}setViewOffset(t,e,i,s,r,o){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=i,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=this.near,e=t*Math.tan(rr*.5*this.fov)/this.zoom,i=2*e,s=this.aspect*i,r=-.5*s,o=this.view;if(this.view!==null&&this.view.enabled){let l=o.fullWidth,c=o.fullHeight;r+=o.offsetX*s/l,e-=o.offsetY*i/c,s*=o.width/l,i*=o.height/c}let a=this.filmOffset;a!==0&&(r+=t*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,e,e-i,t,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}};var Hc=class extends Fr{constructor(){super(new Ne(90,1,.5,500)),this.isPointLightShadow=!0}},Br=class extends Wn{constructor(t,e,i=0,s=2){super(t,e),this.isPointLight=!0,this.type="PointLight",this.distance=i,this.decay=s,this.shadow=new Hc}get power(){return this.intensity*4*Math.PI}set power(t){this.intensity=t/(4*Math.PI)}dispose(){super.dispose(),this.shadow.dispose()}copy(t,e){return super.copy(t,e),this.distance=t.distance,this.decay=t.decay,this.shadow=t.shadow.clone(),this}toJSON(t){let e=super.toJSON(t);return e.object.distance=this.distance,e.object.decay=this.decay,e.object.shadow=this.shadow.toJSON(),e}},Pi=class extends Or{constructor(t=-1,e=1,i=1,s=-1,r=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=i,this.bottom=s,this.near=r,this.far=o,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,i,s,r,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=i,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,s=(this.top+this.bottom)/2,r=i-t,o=i+t,a=s+e,l=s-e;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,o=r+c*this.view.width,a-=h*this.view.offsetY,l=a-h*this.view.height}this.projectionMatrix.makeOrthographic(r,o,a,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}},Vc=class extends Fr{constructor(){super(new Pi(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},Ds=class extends Wn{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Xe.DEFAULT_UP),this.updateMatrix(),this.target=new Xe,this.shadow=new Vc}dispose(){super.dispose(),this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}toJSON(t){let e=super.toJSON(t);return e.object.shadow=this.shadow.toJSON(),e.object.target=this.target.uuid,e}},kr=class extends Wn{constructor(t,e){super(t,e),this.isAmbientLight=!0,this.type="AmbientLight"}};var ms=-90,gs=1,Da=class extends Xe{constructor(t,e,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;let s=new Ne(ms,gs,t,e);s.layers=this.layers,this.add(s);let r=new Ne(ms,gs,t,e);r.layers=this.layers,this.add(r);let o=new Ne(ms,gs,t,e);o.layers=this.layers,this.add(o);let a=new Ne(ms,gs,t,e);a.layers=this.layers,this.add(a);let l=new Ne(ms,gs,t,e);l.layers=this.layers,this.add(l);let c=new Ne(ms,gs,t,e);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let t=this.coordinateSystem,e=this.children.concat(),[i,s,r,o,a,l]=e;for(let c of e)this.remove(c);if(t===Ci)i.up.set(0,1,0),i.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(t===_s)i.up.set(0,-1,0),i.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(let c of e)this.add(c),c.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();let{renderTarget:i,activeMipmapLevel:s}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());let[r,o,a,l,c,h]=this.children,f=t.getRenderTarget(),d=t.getActiveCubeFace(),u=t.getActiveMipmapLevel(),p=t.xr.enabled;t.xr.enabled=!1;let x=i.texture.generateMipmaps;i.texture.generateMipmaps=!1;let m=!1;t.isWebGLRenderer===!0?m=t.state.buffers.depth.getReversed():m=t.reversedDepthBuffer,t.setRenderTarget(i,0,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(e,r),t.setRenderTarget(i,1,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(e,o),t.setRenderTarget(i,2,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(e,a),t.setRenderTarget(i,3,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(e,l),t.setRenderTarget(i,4,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(e,c),i.texture.generateMipmaps=x,t.setRenderTarget(i,5,s),m&&t.autoClear===!1&&t.clearDepth(),t.render(e,h),t.setRenderTarget(f,d,u),t.xr.enabled=p,i.texture.needsPMREMUpdate=!0}},Na=class extends Ne{constructor(t=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=t}},zr=class{constructor(){this._previousTime=0,this._currentTime=0,this._startTime=performance.now(),this._delta=0,this._elapsed=0,this._timescale=1,this._document=null,this._pageVisibilityHandler=null}connect(t){this._document=t,t.hidden!==void 0&&(this._pageVisibilityHandler=Qp.bind(this),t.addEventListener("visibilitychange",this._pageVisibilityHandler,!1))}disconnect(){this._pageVisibilityHandler!==null&&(this._document.removeEventListener("visibilitychange",this._pageVisibilityHandler),this._pageVisibilityHandler=null),this._document=null}getDelta(){return this._delta/1e3}getElapsed(){return this._elapsed/1e3}getTimescale(){return this._timescale}setTimescale(t){return this._timescale=t,this}reset(){return this._currentTime=performance.now()-this._startTime,this}dispose(){this.disconnect()}update(t){return this._pageVisibilityHandler!==null&&this._document.hidden===!0?this._delta=0:(this._previousTime=this._currentTime,this._currentTime=(t!==void 0?t:performance.now())-this._startTime,this._delta=(this._currentTime-this._previousTime)*this._timescale,this._elapsed+=this._delta),this}};function Qp(){this._document.hidden===!1&&this.reset()}var uh="\\[\\]\\.:\\/",$p=new RegExp("["+uh+"]","g"),dh="[^"+uh+"]",tm="[^"+uh.replace("\\.","")+"]",em=/((?:WC+[\/:])*)/.source.replace("WC",dh),im=/(WCOD+)?/.source.replace("WCOD",tm),nm=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",dh),sm=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",dh),rm=new RegExp("^"+em+im+nm+sm+"$"),om=["material","materials","bones","map"],Gc=class{constructor(t,e,i){let s=i||be.parseTrackName(e);this._targetGroup=t,this._bindings=t.subscribe_(e,s)}getValue(t,e){this.bind();let i=this._targetGroup.nCachedObjects_,s=this._bindings[i];s!==void 0&&s.getValue(t,e)}setValue(t,e){let i=this._bindings;for(let s=this._targetGroup.nCachedObjects_,r=i.length;s!==r;++s)i[s].setValue(t,e)}bind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,i=t.length;e!==i;++e)t[e].bind()}unbind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,i=t.length;e!==i;++e)t[e].unbind()}},be=class n{constructor(t,e,i){this.path=e,this.parsedPath=i||n.parseTrackName(e),this.node=n.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,e,i){return t&&t.isAnimationObjectGroup?new n.Composite(t,e,i):new n(t,e,i)}static sanitizeNodeName(t){return t.replace(/\s/g,"_").replace($p,"")}static parseTrackName(t){let e=rm.exec(t);if(e===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+t);let i={nodeName:e[2],objectName:e[3],objectIndex:e[4],propertyName:e[5],propertyIndex:e[6]},s=i.nodeName&&i.nodeName.lastIndexOf(".");if(s!==void 0&&s!==-1){let r=i.nodeName.substring(s+1);om.indexOf(r)!==-1&&(i.nodeName=i.nodeName.substring(0,s),i.objectName=r)}if(i.propertyName===null||i.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+t);return i}static findNode(t,e){if(e===void 0||e===""||e==="."||e===-1||e===t.name||e===t.uuid)return t;if(t.skeleton){let i=t.skeleton.getBoneByName(e);if(i!==void 0)return i}if(t.children){let i=function(r){for(let o=0;o<r.length;o++){let a=r[o];if(a.name===e||a.uuid===e)return a;let l=i(a.children);if(l)return l}return null},s=i(t.children);if(s)return s}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(t,e){t[e]=this.targetObject[this.propertyName]}_getValue_array(t,e){let i=this.resolvedProperty;for(let s=0,r=i.length;s!==r;++s)t[e++]=i[s]}_getValue_arrayElement(t,e){t[e]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(t,e){this.resolvedProperty.toArray(t,e)}_setValue_direct(t,e){this.targetObject[this.propertyName]=t[e]}_setValue_direct_setNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(t,e){let i=this.resolvedProperty;for(let s=0,r=i.length;s!==r;++s)i[s]=t[e++]}_setValue_array_setNeedsUpdate(t,e){let i=this.resolvedProperty;for(let s=0,r=i.length;s!==r;++s)i[s]=t[e++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(t,e){let i=this.resolvedProperty;for(let s=0,r=i.length;s!==r;++s)i[s]=t[e++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(t,e){this.resolvedProperty[this.propertyIndex]=t[e]}_setValue_arrayElement_setNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(t,e){this.resolvedProperty.fromArray(t,e)}_setValue_fromArray_setNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(t,e){this.bind(),this.getValue(t,e)}_setValue_unbound(t,e){this.bind(),this.setValue(t,e)}bind(){let t=this.node,e=this.parsedPath,i=e.objectName,s=e.propertyName,r=e.propertyIndex;if(t||(t=n.findNode(this.rootNode,e.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){qt("PropertyBinding: No target node found for track: "+this.path+".");return}if(i){let c=e.objectIndex;switch(i){case"materials":if(!t.material){Yt("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.materials){Yt("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}t=t.material.materials;break;case"bones":if(!t.skeleton){Yt("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}t=t.skeleton.bones;for(let h=0;h<t.length;h++)if(t[h].name===c){c=h;break}break;case"map":if("map"in t){t=t.map;break}if(!t.material){Yt("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.map){Yt("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}t=t.material.map;break;default:if(t[i]===void 0){Yt("PropertyBinding: Can not bind to objectName of node undefined.",this);return}t=t[i]}if(c!==void 0){if(t[c]===void 0){Yt("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,t);return}t=t[c]}}let o=t[s];if(o===void 0){let c=e.nodeName;Yt("PropertyBinding: Trying to update property for track: "+c+"."+s+" but it wasn't found.",t);return}let a=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?a=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(a=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(r!==void 0){if(s==="morphTargetInfluences"){if(!t.geometry){Yt("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!t.geometry.morphAttributes){Yt("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}t.morphTargetDictionary[r]!==void 0&&(r=t.morphTargetDictionary[r])}l=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=r}else o.fromArray!==void 0&&o.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(l=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=s;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][a]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};be.Composite=Gc;be.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};be.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};be.prototype.GetterByBindingType=[be.prototype._getValue_direct,be.prototype._getValue_array,be.prototype._getValue_arrayElement,be.prototype._getValue_toArray];be.prototype.SetterByBindingTypeAndVersioning=[[be.prototype._setValue_direct,be.prototype._setValue_direct_setNeedsUpdate,be.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[be.prototype._setValue_array,be.prototype._setValue_array_setNeedsUpdate,be.prototype._setValue_array_setMatrixWorldNeedsUpdate],[be.prototype._setValue_arrayElement,be.prototype._setValue_arrayElement_setNeedsUpdate,be.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[be.prototype._setValue_fromArray,be.prototype._setValue_fromArray_setNeedsUpdate,be.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var V_=new Float32Array(1);var ku=new re,Hr=class{constructor(t,e,i=0,s=1/0){this.ray=new xn(t,e),this.near=i,this.far=s,this.camera=null,this.layers=new Ss,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(t,e){this.ray.set(t,e)}setFromCamera(t,e){e.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(t.x,t.y,.5).unproject(e).sub(this.ray.origin).normalize(),this.camera=e):e.isOrthographicCamera?(this.ray.origin.set(t.x,t.y,e.projectionMatrix.elements[14]).unproject(e),this.ray.direction.set(0,0,-1).transformDirection(e.matrixWorld),this.camera=e):Yt("Raycaster: Unsupported camera type: "+e.type)}setFromXRController(t){return ku.identity().extractRotation(t.matrixWorld),this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(ku),this}intersectObject(t,e=!0,i=[]){return Wc(t,this,i,e),i.sort(zu),i}intersectObjects(t,e=!0,i=[]){for(let s=0,r=t.length;s<r;s++)Wc(t[s],this,i,e);return i.sort(zu),i}};function zu(n,t){return n.distance-t.distance}function Wc(n,t,e,i){let s=!0;if(n.layers.test(t.layers)&&n.raycast(t,e)===!1&&(s=!1),s===!0&&i===!0){let r=n.children;for(let o=0,a=r.length;o<a;o++)Wc(r[o],t,e,!0)}}var Ns=class{constructor(t=1,e=0,i=0){this.radius=t,this.phi=e,this.theta=i}set(t,e,i){return this.radius=t,this.phi=e,this.theta=i,this}copy(t){return this.radius=t.radius,this.phi=t.phi,this.theta=t.theta,this}makeSafe(){return this.phi=Qt(this.phi,1e-6,Math.PI-1e-6),this}setFromVector3(t){return this.setFromCartesianCoords(t.x,t.y,t.z)}setFromCartesianCoords(t,e,i){return this.radius=Math.sqrt(t*t+e*e+i*i),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(t,i),this.phi=Math.acos(Qt(e/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}};var vh=class vh{constructor(t,e,i,s){this.elements=[1,0,0,1],t!==void 0&&this.set(t,e,i,s)}identity(){return this.set(1,0,0,1),this}fromArray(t,e=0){for(let i=0;i<4;i++)this.elements[i]=t[i+e];return this}set(t,e,i,s){let r=this.elements;return r[0]=t,r[2]=e,r[1]=i,r[3]=s,this}};vh.prototype.isMatrix2=!0;var Xc=vh;var Vr=class extends Ri{constructor(t,e=null){super(),this.object=t,this.domElement=e,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(t){this.domElement!==null&&this.disconnect(),this.domElement=t}disconnect(){}dispose(){}update(){}};function fh(n,t,e,i){let s=am(i);switch(e){case ih:return n*t;case sh:return n*t/s.components*s.byteLength;case Wa:return n*t/s.components*s.byteLength;case In:return n*t*2/s.components*s.byteLength;case Xa:return n*t*2/s.components*s.byteLength;case nh:return n*t*3/s.components*s.byteLength;case ri:return n*t*4/s.components*s.byteLength;case qa:return n*t*4/s.components*s.byteLength;case $r:case to:return Math.floor((n+3)/4)*Math.floor((t+3)/4)*8;case eo:case io:return Math.floor((n+3)/4)*Math.floor((t+3)/4)*16;case Za:case Ka:return Math.max(n,16)*Math.max(t,8)/4;case Ya:case ja:return Math.max(n,8)*Math.max(t,8)/2;case Ja:case Qa:case tl:case el:return Math.floor((n+3)/4)*Math.floor((t+3)/4)*8;case $a:case no:case il:return Math.floor((n+3)/4)*Math.floor((t+3)/4)*16;case nl:return Math.floor((n+3)/4)*Math.floor((t+3)/4)*16;case sl:return Math.floor((n+4)/5)*Math.floor((t+3)/4)*16;case rl:return Math.floor((n+4)/5)*Math.floor((t+4)/5)*16;case ol:return Math.floor((n+5)/6)*Math.floor((t+4)/5)*16;case al:return Math.floor((n+5)/6)*Math.floor((t+5)/6)*16;case ll:return Math.floor((n+7)/8)*Math.floor((t+4)/5)*16;case cl:return Math.floor((n+7)/8)*Math.floor((t+5)/6)*16;case hl:return Math.floor((n+7)/8)*Math.floor((t+7)/8)*16;case ul:return Math.floor((n+9)/10)*Math.floor((t+4)/5)*16;case dl:return Math.floor((n+9)/10)*Math.floor((t+5)/6)*16;case fl:return Math.floor((n+9)/10)*Math.floor((t+7)/8)*16;case pl:return Math.floor((n+9)/10)*Math.floor((t+9)/10)*16;case ml:return Math.floor((n+11)/12)*Math.floor((t+9)/10)*16;case gl:return Math.floor((n+11)/12)*Math.floor((t+11)/12)*16;case xl:case vl:case _l:return Math.ceil(n/4)*Math.ceil(t/4)*16;case yl:case Ml:return Math.ceil(n/4)*Math.ceil(t/4)*8;case so:case bl:return Math.ceil(n/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${e} format.`)}function am(n){switch(n){case Qe:case Qc:return{byteLength:1,components:1};case Os:case $c:case ve:return{byteLength:2,components:1};case Va:case Ga:return{byteLength:2,components:4};case Li:case Ha:case Ii:return{byteLength:4,components:1};case th:case eh:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${n}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"186"}}));typeof window<"u"&&(window.__THREE__?qt("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="186");function jd(){let n=null,t=!1,e=null,i=null;function s(r,o){i=n.requestAnimationFrame(s),e(r,o)}return{start:function(){t!==!0&&e!==null&&n!==null&&(i=n.requestAnimationFrame(s),t=!0)},stop:function(){n!==null&&n.cancelAnimationFrame(i),t=!1},setAnimationLoop:function(r){e=r},setContext:function(r){n=r}}}function fm(n){let t=new WeakMap;function e(a,l){let c=a.array,h=a.usage,f=c.byteLength,d=n.createBuffer();n.bindBuffer(l,d),n.bufferData(l,c,h),a.onUploadCallback();let u;if(c instanceof Float32Array)u=n.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)u=n.HALF_FLOAT;else if(c instanceof Uint16Array)a.isFloat16BufferAttribute?u=n.HALF_FLOAT:u=n.UNSIGNED_SHORT;else if(c instanceof Int16Array)u=n.SHORT;else if(c instanceof Uint32Array)u=n.UNSIGNED_INT;else if(c instanceof Int32Array)u=n.INT;else if(c instanceof Int8Array)u=n.BYTE;else if(c instanceof Uint8Array)u=n.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)u=n.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:d,type:u,bytesPerElement:c.BYTES_PER_ELEMENT,version:a.version,size:f}}function i(a,l,c){let h=l.array,f=l.updateRanges;if(n.bindBuffer(c,a),f.length===0)n.bufferSubData(c,0,h);else{f.sort((u,p)=>u.start-p.start);let d=0;for(let u=1;u<f.length;u++){let p=f[d],x=f[u];x.start<=p.start+p.count+1?p.count=Math.max(p.count,x.start+x.count-p.start):(++d,f[d]=x)}f.length=d+1;for(let u=0,p=f.length;u<p;u++){let x=f[u];n.bufferSubData(c,x.start*h.BYTES_PER_ELEMENT,h,x.start,x.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(a){return a.isInterleavedBufferAttribute&&(a=a.data),t.get(a)}function r(a){a.isInterleavedBufferAttribute&&(a=a.data);let l=t.get(a);l&&(n.deleteBuffer(l.buffer),t.delete(a))}function o(a,l){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){let h=t.get(a);(!h||h.version<a.version)&&t.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}let c=t.get(a);if(c===void 0)t.set(a,e(a,l));else if(c.version<a.version){if(c.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,a,l),c.version=a.version}}return{get:s,remove:r,update:o}}var pm=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,mm=`#ifdef USE_ALPHAHASH
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
#endif`,gm=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,xm=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,vm=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,_m=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,ym=`#ifdef USE_AOMAP
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
#endif`,Mm=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,bm=`#ifdef USE_BATCHING
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
#endif`,Sm=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,wm=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Em=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Tm=`float G_BlinnPhong_Implicit( ) {
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
} // validated`,Am=`#ifdef USE_IRIDESCENCE
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
#endif`,Cm=`#ifdef USE_BUMPMAP
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
#endif`,Rm=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,Pm=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Lm=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Im=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Dm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Nm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Um=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Fm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
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
#endif`,Om=`#define PI 3.141592653589793
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
} // validated`,Bm=`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,km=`vec3 transformedNormal = objectNormal;
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
#endif`,zm=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Hm=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Vm=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Gm=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Wm="gl_FragColor = linearToOutputTexel( gl_FragColor );",Xm=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,qm=`#ifdef USE_ENVMAP
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
#endif`,Ym=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,Zm=`#ifdef USE_ENVMAP
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
#endif`,jm=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Km=`#ifdef USE_ENVMAP
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
#endif`,Jm=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Qm=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,$m=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,t0=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,e0=`#ifdef USE_GRADIENTMAP
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
}`,i0=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,n0=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,s0=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,r0=`uniform bool receiveShadow;
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
#include <lightprobes_pars_fragment>`,o0=`#ifdef USE_ENVMAP
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
#endif`,a0=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,l0=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,c0=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,h0=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,u0=`PhysicalMaterial material;
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
#endif`,d0=`uniform sampler2D dfgLUT;
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
}`,f0=`
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
#endif`,p0=`#if defined( RE_IndirectDiffuse )
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
#endif`,m0=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,g0=`#ifdef USE_LIGHT_PROBES_GRID
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
#endif`,x0=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,v0=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,_0=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,y0=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,M0=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,b0=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,S0=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,w0=`#if defined( USE_POINTS_UV )
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
#endif`,E0=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,T0=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,A0=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,C0=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,R0=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,P0=`#ifdef USE_MORPHTARGETS
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
#endif`,L0=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,I0=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
vec3 nonPerturbedNormal = normal;`,D0=`#ifdef USE_NORMALMAP_OBJECTSPACE
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
#endif`,N0=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,U0=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,F0=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,O0=`#ifdef USE_NORMALMAP
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
#endif`,B0=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,k0=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,z0=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,H0=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,V0=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,G0=`vec3 packNormalToRGB( const in vec3 normal ) {
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
}`,W0=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,X0=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,q0=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Y0=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Z0=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,j0=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,K0=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,J0=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,Q0=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
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
#endif`,$0=`float getShadowMask() {
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
}`,tg=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,eg=`#ifdef USE_SKINNING
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
#endif`,ig=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,ng=`#ifdef USE_SKINNING
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
#endif`,sg=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,rg=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,og=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,ag=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,lg=`#ifdef USE_TRANSMISSION
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
#endif`,cg=`#ifdef USE_TRANSMISSION
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
#endif`,hg=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,ug=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,dg=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,fg=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,pg=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,mg=`uniform sampler2D t2D;
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
}`,gg=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,xg=`#ifdef ENVMAP_TYPE_CUBE
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
}`,vg=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,_g=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,yg=`#include <common>
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
}`,Mg=`#if DEPTH_PACKING == 3200
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
}`,bg=`#define DISTANCE
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
}`,Sg=`#define DISTANCE
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
}`,wg=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Eg=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Tg=`uniform float scale;
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
}`,Ag=`uniform vec3 diffuse;
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
}`,Cg=`#include <common>
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
}`,Rg=`uniform vec3 diffuse;
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
}`,Pg=`#define LAMBERT
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
}`,Lg=`#define LAMBERT
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
}`,Ig=`#define MATCAP
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
}`,Dg=`#define MATCAP
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
}`,Ng=`#define NORMAL
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
}`,Ug=`#define NORMAL
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
}`,Fg=`#define PHONG
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
}`,Og=`#define PHONG
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
}`,Bg=`#define STANDARD
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
}`,kg=`#define STANDARD
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
}`,zg=`#define TOON
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
}`,Hg=`#define TOON
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
}`,Vg=`uniform float size;
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
}`,Gg=`uniform vec3 diffuse;
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
}`,Wg=`#include <common>
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
}`,Xg=`uniform vec3 color;
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
}`,qg=`uniform float rotation;
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
}`,Yg=`uniform vec3 diffuse;
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
}`,te={alphahash_fragment:pm,alphahash_pars_fragment:mm,alphamap_fragment:gm,alphamap_pars_fragment:xm,alphatest_fragment:vm,alphatest_pars_fragment:_m,aomap_fragment:ym,aomap_pars_fragment:Mm,batching_pars_vertex:bm,batching_vertex:Sm,begin_vertex:wm,beginnormal_vertex:Em,bsdfs:Tm,iridescence_fragment:Am,bumpmap_pars_fragment:Cm,clipping_planes_fragment:Rm,clipping_planes_pars_fragment:Pm,clipping_planes_pars_vertex:Lm,clipping_planes_vertex:Im,color_fragment:Dm,color_pars_fragment:Nm,color_pars_vertex:Um,color_vertex:Fm,common:Om,cube_uv_reflection_fragment:Bm,defaultnormal_vertex:km,displacementmap_pars_vertex:zm,displacementmap_vertex:Hm,emissivemap_fragment:Vm,emissivemap_pars_fragment:Gm,colorspace_fragment:Wm,colorspace_pars_fragment:Xm,envmap_fragment:qm,envmap_common_pars_fragment:Ym,envmap_pars_fragment:Zm,envmap_pars_vertex:jm,envmap_physical_pars_fragment:o0,envmap_vertex:Km,fog_vertex:Jm,fog_pars_vertex:Qm,fog_fragment:$m,fog_pars_fragment:t0,gradientmap_pars_fragment:e0,lightmap_pars_fragment:i0,lights_lambert_fragment:n0,lights_lambert_pars_fragment:s0,lights_pars_begin:r0,lights_toon_fragment:a0,lights_toon_pars_fragment:l0,lights_phong_fragment:c0,lights_phong_pars_fragment:h0,lights_physical_fragment:u0,lights_physical_pars_fragment:d0,lights_fragment_begin:f0,lights_fragment_maps:p0,lights_fragment_end:m0,lightprobes_pars_fragment:g0,logdepthbuf_fragment:x0,logdepthbuf_pars_fragment:v0,logdepthbuf_pars_vertex:_0,logdepthbuf_vertex:y0,map_fragment:M0,map_pars_fragment:b0,map_particle_fragment:S0,map_particle_pars_fragment:w0,metalnessmap_fragment:E0,metalnessmap_pars_fragment:T0,morphinstance_vertex:A0,morphcolor_vertex:C0,morphnormal_vertex:R0,morphtarget_pars_vertex:P0,morphtarget_vertex:L0,normal_fragment_begin:I0,normal_fragment_maps:D0,normal_pars_fragment:N0,normal_pars_vertex:U0,normal_vertex:F0,normalmap_pars_fragment:O0,clearcoat_normal_fragment_begin:B0,clearcoat_normal_fragment_maps:k0,clearcoat_pars_fragment:z0,iridescence_pars_fragment:H0,opaque_fragment:V0,packing:G0,premultiplied_alpha_fragment:W0,project_vertex:X0,dithering_fragment:q0,dithering_pars_fragment:Y0,roughnessmap_fragment:Z0,roughnessmap_pars_fragment:j0,shadowmap_pars_fragment:K0,shadowmap_pars_vertex:J0,shadowmap_vertex:Q0,shadowmask_pars_fragment:$0,skinbase_vertex:tg,skinning_pars_vertex:eg,skinning_vertex:ig,skinnormal_vertex:ng,specularmap_fragment:sg,specularmap_pars_fragment:rg,tonemapping_fragment:og,tonemapping_pars_fragment:ag,transmission_fragment:lg,transmission_pars_fragment:cg,uv_pars_fragment:hg,uv_pars_vertex:ug,uv_vertex:dg,worldpos_vertex:fg,background_vert:pg,background_frag:mg,backgroundCube_vert:gg,backgroundCube_frag:xg,cube_vert:vg,cube_frag:_g,depth_vert:yg,depth_frag:Mg,distance_vert:bg,distance_frag:Sg,equirect_vert:wg,equirect_frag:Eg,linedashed_vert:Tg,linedashed_frag:Ag,meshbasic_vert:Cg,meshbasic_frag:Rg,meshlambert_vert:Pg,meshlambert_frag:Lg,meshmatcap_vert:Ig,meshmatcap_frag:Dg,meshnormal_vert:Ng,meshnormal_frag:Ug,meshphong_vert:Fg,meshphong_frag:Og,meshphysical_vert:Bg,meshphysical_frag:kg,meshtoon_vert:zg,meshtoon_frag:Hg,points_vert:Vg,points_frag:Gg,shadow_vert:Wg,shadow_frag:Xg,sprite_vert:qg,sprite_frag:Yg},Mt={common:{diffuse:{value:new Ft(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Kt},alphaMap:{value:null},alphaMapTransform:{value:new Kt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Kt}},envmap:{envMap:{value:null},envMapRotation:{value:new Kt},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Kt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Kt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Kt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Kt},normalScale:{value:new tt(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Kt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Kt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Kt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Kt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Ft(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new D},probesMax:{value:new D},probesResolution:{value:new D}},points:{diffuse:{value:new Ft(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Kt},alphaTest:{value:0},uvTransform:{value:new Kt}},sprite:{diffuse:{value:new Ft(16777215)},opacity:{value:1},center:{value:new tt(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Kt},alphaMap:{value:null},alphaMapTransform:{value:new Kt},alphaTest:{value:0}}},Wi={basic:{uniforms:$e([Mt.common,Mt.specularmap,Mt.envmap,Mt.aomap,Mt.lightmap,Mt.fog]),vertexShader:te.meshbasic_vert,fragmentShader:te.meshbasic_frag},lambert:{uniforms:$e([Mt.common,Mt.specularmap,Mt.envmap,Mt.aomap,Mt.lightmap,Mt.emissivemap,Mt.bumpmap,Mt.normalmap,Mt.displacementmap,Mt.fog,Mt.lights,{emissive:{value:new Ft(0)},envMapIntensity:{value:1}}]),vertexShader:te.meshlambert_vert,fragmentShader:te.meshlambert_frag},phong:{uniforms:$e([Mt.common,Mt.specularmap,Mt.envmap,Mt.aomap,Mt.lightmap,Mt.emissivemap,Mt.bumpmap,Mt.normalmap,Mt.displacementmap,Mt.fog,Mt.lights,{emissive:{value:new Ft(0)},specular:{value:new Ft(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:te.meshphong_vert,fragmentShader:te.meshphong_frag},standard:{uniforms:$e([Mt.common,Mt.envmap,Mt.aomap,Mt.lightmap,Mt.emissivemap,Mt.bumpmap,Mt.normalmap,Mt.displacementmap,Mt.roughnessmap,Mt.metalnessmap,Mt.fog,Mt.lights,{emissive:{value:new Ft(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:te.meshphysical_vert,fragmentShader:te.meshphysical_frag},toon:{uniforms:$e([Mt.common,Mt.aomap,Mt.lightmap,Mt.emissivemap,Mt.bumpmap,Mt.normalmap,Mt.displacementmap,Mt.gradientmap,Mt.fog,Mt.lights,{emissive:{value:new Ft(0)}}]),vertexShader:te.meshtoon_vert,fragmentShader:te.meshtoon_frag},matcap:{uniforms:$e([Mt.common,Mt.bumpmap,Mt.normalmap,Mt.displacementmap,Mt.fog,{matcap:{value:null}}]),vertexShader:te.meshmatcap_vert,fragmentShader:te.meshmatcap_frag},points:{uniforms:$e([Mt.points,Mt.fog]),vertexShader:te.points_vert,fragmentShader:te.points_frag},dashed:{uniforms:$e([Mt.common,Mt.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:te.linedashed_vert,fragmentShader:te.linedashed_frag},depth:{uniforms:$e([Mt.common,Mt.displacementmap]),vertexShader:te.depth_vert,fragmentShader:te.depth_frag},normal:{uniforms:$e([Mt.common,Mt.bumpmap,Mt.normalmap,Mt.displacementmap,{opacity:{value:1}}]),vertexShader:te.meshnormal_vert,fragmentShader:te.meshnormal_frag},sprite:{uniforms:$e([Mt.sprite,Mt.fog]),vertexShader:te.sprite_vert,fragmentShader:te.sprite_frag},background:{uniforms:{uvTransform:{value:new Kt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:te.background_vert,fragmentShader:te.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Kt}},vertexShader:te.backgroundCube_vert,fragmentShader:te.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:te.cube_vert,fragmentShader:te.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:te.equirect_vert,fragmentShader:te.equirect_frag},distance:{uniforms:$e([Mt.common,Mt.displacementmap,{referencePosition:{value:new D},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:te.distance_vert,fragmentShader:te.distance_frag},shadow:{uniforms:$e([Mt.lights,Mt.fog,{color:{value:new Ft(0)},opacity:{value:1}}]),vertexShader:te.shadow_vert,fragmentShader:te.shadow_frag}};Wi.physical={uniforms:$e([Wi.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Kt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Kt},clearcoatNormalScale:{value:new tt(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Kt},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Kt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Kt},sheen:{value:0},sheenColor:{value:new Ft(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Kt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Kt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Kt},transmissionSamplerSize:{value:new tt},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Kt},attenuationDistance:{value:0},attenuationColor:{value:new Ft(0)},specularColor:{value:new Ft(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Kt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Kt},anisotropyVector:{value:new tt},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Kt}}]),vertexShader:te.meshphysical_vert,fragmentShader:te.meshphysical_frag};var El={r:0,b:0,g:0},Zg=new re,Kd=new Kt;Kd.set(-1,0,0,0,1,0,0,0,1);function jg(n,t,e,i,s,r){let o=new Ft(0),a=s===!0?0:1,l,c,h=null,f=0,d=null;function u(b){let T=b.isScene===!0?b.background:null;if(T&&T.isTexture){let v=b.backgroundBlurriness>0;T=t.get(T,v)}return T}function p(b){let T=!1,v=u(b);v===null?m(o,a):v&&v.isColor&&(m(v,1),T=!0);let S=n.xr.getEnvironmentBlendMode();S==="additive"?e.buffers.color.setClear(0,0,0,1,r):S==="alpha-blend"&&e.buffers.color.setClear(0,0,0,0,r),(n.autoClear||T)&&(e.buffers.depth.setTest(!0),e.buffers.depth.setMask(!0),e.buffers.color.setMask(!0),n.clear(n.autoClearColor,n.autoClearDepth,n.autoClearStencil))}function x(b,T){let v=u(T);v&&(v.isCubeTexture||v.mapping===Jr)?(c===void 0&&(c=new Wt(new Be(1,1,1),new le({name:"BackgroundCubeMaterial",uniforms:Zn(Wi.backgroundCube.uniforms),vertexShader:Wi.backgroundCube.vertexShader,fragmentShader:Wi.backgroundCube.fragmentShader,side:Ye,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(S,C,P){this.matrixWorld.copyPosition(P.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(c)),c.material.uniforms.envMap.value=v,c.material.uniforms.backgroundBlurriness.value=T.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=T.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(Zg.makeRotationFromEuler(T.backgroundRotation)).transpose(),v.isCubeTexture&&v.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(Kd),c.material.toneMapped=ie.getTransfer(v.colorSpace)!==ce,(h!==v||f!==v.version||d!==n.toneMapping)&&(c.material.needsUpdate=!0,h=v,f=v.version,d=n.toneMapping),c.layers.enableAll(),b.unshift(c,c.geometry,c.material,0,0,null)):v&&v.isTexture&&(l===void 0&&(l=new Wt(new _n(2,2),new le({name:"BackgroundMaterial",uniforms:Zn(Wi.background.uniforms),vertexShader:Wi.background.vertexShader,fragmentShader:Wi.background.fragmentShader,side:An,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(l)),l.material.uniforms.t2D.value=v,l.material.uniforms.backgroundIntensity.value=T.backgroundIntensity,l.material.toneMapped=ie.getTransfer(v.colorSpace)!==ce,v.matrixAutoUpdate===!0&&v.updateMatrix(),l.material.uniforms.uvTransform.value.copy(v.matrix),(h!==v||f!==v.version||d!==n.toneMapping)&&(l.material.needsUpdate=!0,h=v,f=v.version,d=n.toneMapping),l.layers.enableAll(),b.unshift(l,l.geometry,l.material,0,0,null))}function m(b,T){b.getRGB(El,hh(n)),e.buffers.color.setClear(El.r,El.g,El.b,T,r)}function g(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return o},setClearColor:function(b,T=1){o.set(b),a=T,m(o,a)},getClearAlpha:function(){return a},setClearAlpha:function(b){a=b,m(o,a)},render:p,addToRenderList:x,dispose:g}}function Kg(n,t){let e=n.getParameter(n.MAX_VERTEX_ATTRIBS),i={},s=d(null),r=s,o=!1;function a(I,M,E,R,N){let O=!1,F=f(I,R,E,M);r!==F&&(r=F,c(r.object)),O=u(I,R,E,N),O&&p(I,R,E,N),N!==null&&t.update(N,n.ELEMENT_ARRAY_BUFFER),(O||o)&&(o=!1,v(I,M,E,R),N!==null&&n.bindBuffer(n.ELEMENT_ARRAY_BUFFER,t.get(N).buffer))}function l(){return n.createVertexArray()}function c(I){return n.bindVertexArray(I)}function h(I){return n.deleteVertexArray(I)}function f(I,M,E,R){let N=R.wireframe===!0,O=i[M.id];O===void 0&&(O={},i[M.id]=O);let F=I.isInstancedMesh===!0?I.id:0,V=O[F];V===void 0&&(V={},O[F]=V);let k=V[E.id];k===void 0&&(k={},V[E.id]=k);let W=k[N];return W===void 0&&(W=d(l()),k[N]=W),W}function d(I){let M=[],E=[],R=[];for(let N=0;N<e;N++)M[N]=0,E[N]=0,R[N]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:M,enabledAttributes:E,attributeDivisors:R,object:I,attributes:{},index:null}}function u(I,M,E,R){let N=r.attributes,O=M.attributes,F=0,V=E.getAttributes();for(let k in V)if(V[k].location>=0){let j=N[k],ht=O[k];if(ht===void 0&&(k==="instanceMatrix"&&I.instanceMatrix&&(ht=I.instanceMatrix),k==="instanceColor"&&I.instanceColor&&(ht=I.instanceColor)),j===void 0||j.attribute!==ht||ht&&j.data!==ht.data)return!0;F++}return r.attributesNum!==F||r.index!==R}function p(I,M,E,R){let N={},O=M.attributes,F=0,V=E.getAttributes();for(let k in V)if(V[k].location>=0){let j=O[k];j===void 0&&(k==="instanceMatrix"&&I.instanceMatrix&&(j=I.instanceMatrix),k==="instanceColor"&&I.instanceColor&&(j=I.instanceColor));let ht={};ht.attribute=j,j&&j.data&&(ht.data=j.data),N[k]=ht,F++}r.attributes=N,r.attributesNum=F,r.index=R}function x(){let I=r.newAttributes;for(let M=0,E=I.length;M<E;M++)I[M]=0}function m(I){g(I,0)}function g(I,M){let E=r.newAttributes,R=r.enabledAttributes,N=r.attributeDivisors;E[I]=1,R[I]===0&&(n.enableVertexAttribArray(I),R[I]=1),N[I]!==M&&(n.vertexAttribDivisor(I,M),N[I]=M)}function b(){let I=r.newAttributes,M=r.enabledAttributes;for(let E=0,R=M.length;E<R;E++)M[E]!==I[E]&&(n.disableVertexAttribArray(E),M[E]=0)}function T(I,M,E,R,N,O,F){F===!0?n.vertexAttribIPointer(I,M,E,N,O):n.vertexAttribPointer(I,M,E,R,N,O)}function v(I,M,E,R){x();let N=R.attributes,O=E.getAttributes(),F=M.defaultAttributeValues;for(let V in O){let k=O[V];if(k.location>=0){let W=N[V];if(W===void 0&&(V==="instanceMatrix"&&I.instanceMatrix&&(W=I.instanceMatrix),V==="instanceColor"&&I.instanceColor&&(W=I.instanceColor)),W!==void 0){let j=W.normalized,ht=W.itemSize,ft=t.get(W);if(ft===void 0)continue;let At=ft.buffer,wt=ft.type,Gt=ft.bytesPerElement,Z=wt===n.INT||wt===n.UNSIGNED_INT||W.gpuType===Ha;if(W.isInterleavedBufferAttribute){let K=W.data,dt=K.stride,Pt=W.offset;if(K.isInstancedInterleavedBuffer){for(let vt=0;vt<k.locationSize;vt++)g(k.location+vt,K.meshPerAttribute);I.isInstancedMesh!==!0&&R._maxInstanceCount===void 0&&(R._maxInstanceCount=K.meshPerAttribute*K.count)}else for(let vt=0;vt<k.locationSize;vt++)m(k.location+vt);n.bindBuffer(n.ARRAY_BUFFER,At);for(let vt=0;vt<k.locationSize;vt++)T(k.location+vt,ht/k.locationSize,wt,j,dt*Gt,(Pt+ht/k.locationSize*vt)*Gt,Z)}else{if(W.isInstancedBufferAttribute){for(let K=0;K<k.locationSize;K++)g(k.location+K,W.meshPerAttribute);I.isInstancedMesh!==!0&&R._maxInstanceCount===void 0&&(R._maxInstanceCount=W.meshPerAttribute*W.count)}else for(let K=0;K<k.locationSize;K++)m(k.location+K);n.bindBuffer(n.ARRAY_BUFFER,At);for(let K=0;K<k.locationSize;K++)T(k.location+K,ht/k.locationSize,wt,j,ht*Gt,ht/k.locationSize*K*Gt,Z)}}else if(F!==void 0){let j=F[V];if(j!==void 0)switch(j.length){case 2:n.vertexAttrib2fv(k.location,j);break;case 3:n.vertexAttrib3fv(k.location,j);break;case 4:n.vertexAttrib4fv(k.location,j);break;default:n.vertexAttrib1fv(k.location,j)}}}}b()}function S(){A();for(let I in i){let M=i[I];for(let E in M){let R=M[E];for(let N in R){let O=R[N];for(let F in O)h(O[F].object),delete O[F];delete R[N]}}delete i[I]}}function C(I){if(i[I.id]===void 0)return;let M=i[I.id];for(let E in M){let R=M[E];for(let N in R){let O=R[N];for(let F in O)h(O[F].object),delete O[F];delete R[N]}}delete i[I.id]}function P(I){for(let M in i){let E=i[M];for(let R in E){let N=E[R];if(N[I.id]===void 0)continue;let O=N[I.id];for(let F in O)h(O[F].object),delete O[F];delete N[I.id]}}}function y(I){for(let M in i){let E=i[M],R=I.isInstancedMesh===!0?I.id:0,N=E[R];if(N!==void 0){for(let O in N){let F=N[O];for(let V in F)h(F[V].object),delete F[V];delete N[O]}delete E[R],Object.keys(E).length===0&&delete i[M]}}}function A(){U(),o=!0,r!==s&&(r=s,c(r.object))}function U(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:a,reset:A,resetDefaultState:U,dispose:S,releaseStatesOfGeometry:C,releaseStatesOfObject:y,releaseStatesOfProgram:P,initAttributes:x,enableAttribute:m,disableUnusedAttributes:b}}function Jg(n,t,e){let i;function s(l){i=l}function r(l,c){n.drawArrays(i,l,c),e.update(c,i,1)}function o(l,c,h){h!==0&&(n.drawArraysInstanced(i,l,c,h),e.update(c,i,h))}function a(l,c,h){if(h===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,l,0,c,0,h);let d=0;for(let u=0;u<h;u++)d+=c[u];e.update(d,i,1)}this.setMode=s,this.render=r,this.renderInstances=o,this.renderMultiDraw=a}function Qg(n,t,e,i){let s;function r(){if(s!==void 0)return s;if(t.has("EXT_texture_filter_anisotropic")===!0){let P=t.get("EXT_texture_filter_anisotropic");s=n.getParameter(P.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function o(P){return!(P!==ri&&i.convert(P)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(P){let y=P===ve&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(P!==Qe&&P!==Ii&&!y&&i.convert(P)!==n.getParameter(n.IMPLEMENTATION_COLOR_READ_TYPE))}function l(P){if(P==="highp"){if(n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.HIGH_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.HIGH_FLOAT).precision>0)return"highp";P="mediump"}return P==="mediump"&&n.getShaderPrecisionFormat(n.VERTEX_SHADER,n.MEDIUM_FLOAT).precision>0&&n.getShaderPrecisionFormat(n.FRAGMENT_SHADER,n.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=e.precision!==void 0?e.precision:"highp",h=l(c);h!==c&&(qt("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);let f=e.logarithmicDepthBuffer===!0,d=e.reversedDepthBuffer===!0&&t.has("EXT_clip_control");e.reversedDepthBuffer===!0&&d===!1&&qt("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let u=n.getParameter(n.MAX_TEXTURE_IMAGE_UNITS),p=n.getParameter(n.MAX_VERTEX_TEXTURE_IMAGE_UNITS),x=n.getParameter(n.MAX_TEXTURE_SIZE),m=n.getParameter(n.MAX_CUBE_MAP_TEXTURE_SIZE),g=n.getParameter(n.MAX_VERTEX_ATTRIBS),b=n.getParameter(n.MAX_VERTEX_UNIFORM_VECTORS),T=n.getParameter(n.MAX_VARYING_VECTORS),v=n.getParameter(n.MAX_FRAGMENT_UNIFORM_VECTORS),S=n.getParameter(n.MAX_SAMPLES),C=n.getParameter(n.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:c,logarithmicDepthBuffer:f,reversedDepthBuffer:d,maxTextures:u,maxVertexTextures:p,maxTextureSize:x,maxCubemapSize:m,maxAttributes:g,maxVertexUniforms:b,maxVaryings:T,maxFragmentUniforms:v,maxSamples:S,samples:C}}function $g(n){let t=this,e=null,i=0,s=!1,r=!1,o=new qe,a=new Kt,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(f,d){let u=f.length!==0||d||i!==0||s;return s=d,i=f.length,u},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(f,d){e=h(f,d,0)},this.setState=function(f,d,u){let p=f.clippingPlanes,x=f.clipIntersection,m=f.clipShadows,g=n.get(f);if(!s||p===null||p.length===0||r&&!m)r?h(null):c();else{let b=r?0:i,T=b*4,v=g.clippingState||null;l.value=v,v=h(p,d,T,u);for(let S=0;S!==T;++S)v[S]=e[S];g.clippingState=v,this.numIntersection=x?this.numPlanes:0,this.numPlanes+=b}};function c(){l.value!==e&&(l.value=e,l.needsUpdate=i>0),t.numPlanes=i,t.numIntersection=0}function h(f,d,u,p){let x=f!==null?f.length:0,m=null;if(x!==0){if(m=l.value,p!==!0||m===null){let g=u+x*4,b=d.matrixWorldInverse;a.getNormalMatrix(b),(m===null||m.length<g)&&(m=new Float32Array(g));for(let T=0,v=u;T!==x;++T,v+=4)o.copy(f[T]).applyMatrix4(b,a),o.normal.toArray(m,v),m[v+3]=o.constant}l.value=m,l.needsUpdate=!0}return t.numPlanes=x,t.numIntersection=0,m}}var zs=4,tx=6,ex=20,ix=256,ro=new Pi,Cd=new Ft,_h=null,yh=0,Mh=0,bh=!1,nx=new D,jn=new D,Vs=class{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(t,e=0,i=.1,s=100,r={}){let{size:o=256,position:a=nx}=r;_h=this._renderer.getRenderTarget(),yh=this._renderer.getActiveCubeFace(),Mh=this._renderer.getActiveMipmapLevel(),bh=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(o);let l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(t,i,s,l,a),e>0&&this._blur(l,0,0,e),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Ld(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Pd(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodMeshes.length;t++)this._lodMeshes[t].geometry.dispose()}_cleanup(t){this._renderer.setRenderTarget(_h,yh,Mh),this._renderer.xr.enabled=bh,t.scissorTest=!1,ks(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===Rn||t.mapping===Yn?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),_h=this._renderer.getRenderTarget(),yh=this._renderer.getActiveCubeFace(),Mh=this._renderer.getActiveMipmapLevel(),bh=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let i=e||this._allocateTargets();return this._textureToCubeUV(t,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){let t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,i={magFilter:Fe,minFilter:Fe,generateMipmaps:!1,type:ve,format:ri,colorSpace:hr,depthBuffer:!1},s=Rd(t,e,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Rd(t,e,i);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods}=sx(r)),this._blurMaterial=ox(r,t,e),this._ggxMaterial=rx(r,t,e)}return s}_compileMaterial(t){let e=new Wt(new we,t);this._renderer.compile(e,ro)}_sceneToCubeUV(t,e,i,s,r){let l=new Ne(90,1,e,i),c=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],f=this._renderer,d=f.autoClear,u=f.toneMapping;f.getClearColor(Cd),f.toneMapping=pi,f.autoClear=!1,f.state.buffers.depth.getReversed()&&(f.setRenderTarget(s),f.clearDepth(),f.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new Wt(new Be,new Oe({name:"PMREM.Background",side:Ye,depthWrite:!1,depthTest:!1})));let x=this._backgroundBox,m=x.material,g=!1,b=t.background;b?b.isColor&&(m.color.copy(b),t.background=null,g=!0):(m.color.copy(Cd),g=!0);for(let T=0;T<6;T++){let v=T%3;v===0?(l.up.set(0,c[T],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x+h[T],r.y,r.z)):v===1?(l.up.set(0,0,c[T]),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y+h[T],r.z)):(l.up.set(0,c[T],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y,r.z+h[T]));let S=this._cubeSize;ks(s,v*S,T>2?S:0,S,S),f.setRenderTarget(s),g&&f.render(x,l),f.render(t,l)}f.toneMapping=u,f.autoClear=d,t.background=b}_textureToCubeUV(t,e){let i=this._renderer,s=t.mapping===Rn||t.mapping===Yn;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=Ld()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Pd());let r=s?this._cubemapMaterial:this._equirectMaterial,o=this._lodMeshes[0];o.material=r;let a=r.uniforms;a.envMap.value=t;let l=this._cubeSize;ks(e,0,0,3*l,2*l),i.setRenderTarget(e),i.render(o,ro)}_applyPMREM(t){let e=this._renderer,i=e.autoClear;e.autoClear=!1;let s=this._lodMeshes.length;for(let r=1;r<s;r++)this._applyGGXFilter(t,r-1,r);e.autoClear=i}_applyGGXFilter(t,e,i){let s=this._renderer,r=this._pingPongRenderTarget,o=this._ggxMaterial,a=this._lodMeshes[i];a.material=o;let l=o.uniforms,c=i/(this._lodMeshes.length-1),h=e/(this._lodMeshes.length-1),f=Math.sqrt(c*c-h*h),d=c*1.25,u=f*d,{_lodMax:p}=this,x=this._sizeLods[i],m=3*x*(i>p-zs?i-p+zs:0),g=4*(this._cubeSize-x);l.envMap.value=t.texture,l.roughness.value=u,l.mipInt.value=p-e,ks(r,m,g,3*x,2*x),s.setRenderTarget(r),s.render(a,ro),l.envMap.value=r.texture,l.roughness.value=0,l.mipInt.value=p-i,ks(t,m,g,3*x,2*x),s.setRenderTarget(t),s.render(a,ro)}_blur(t,e,i,s){let r=this._pingPongRenderTarget,o=Math.min(s,Math.PI)/Math.SQRT2;this._blurPass(t,r,e,i,o),this._blurPass(r,t,i,i,o)}_blurPass(t,e,i,s,r){let o=this._renderer,a=this._blurMaterial,l=this._lodMeshes[s];l.material=a;let c=a.uniforms;c.envMap.value=t.texture,c.sigma.value=r,c.mipInt.value=this._lodMax-i;let h=this._sizeLods[s],f=3*h*(s>this._lodMax-zs?s-this._lodMax+zs:0),d=4*(this._cubeSize-h);ks(e,f,d,3*h,2*h),o.setRenderTarget(e),o.render(l,ro)}};function sx(n){let t=[],e=[],i=n,s=n-zs+1+tx;for(let r=0;r<s;r++){let o=Math.pow(2,i);t.push(o);let a=1/(o-2),l=-a,c=1+a,h=[l,l,c,l,c,c,l,l,c,c,l,c],f=6,d=6,u=3,p=new Float32Array(u*d*f),x=new Float32Array(u*d*f);for(let g=0;g<f;g++){let b=g%3*2/3-1,T=g>2?0:-1,v=[b,T,0,b+2/3,T,0,b+2/3,T+1,0,b,T,0,b+2/3,T+1,0,b,T+1,0];p.set(v,u*d*g);for(let S=0;S<d;S++){let C=h[S*2]*2-1,P=h[S*2+1]*2-1;g===0?jn.set(1,P,C):g===1?jn.set(-C,1,-P):g===2?jn.set(-C,P,1):g===3?jn.set(-1,P,-C):g===4?jn.set(-C,-1,P):jn.set(C,P,-1),jn.toArray(x,(g*d+S)*u)}}let m=new we;m.setAttribute("position",new Ue(p,u)),m.setAttribute("outputDirection",new Ue(x,u)),e.push(new Wt(m,null)),i>zs&&i--}return{lodMeshes:e,sizeLods:t}}function Rd(n,t,e){let i=new he(n,t,e);return i.texture.mapping=Jr,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function ks(n,t,e,i,s){n.viewport.set(t,e,i,s),n.scissor.set(t,e,i,s)}function rx(n,t,e){return new le({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:ix,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${n}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:Rl(),fragmentShader:`

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
		`,blending:Ae,depthTest:!1,depthWrite:!1})}function ox(n,t,e){return new le({name:"SphericalGaussianBlur",defines:{SAMPLES:ex,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${n}.0`},uniforms:{envMap:{value:null},sigma:{value:0},mipInt:{value:0}},vertexShader:Rl(),fragmentShader:`

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
		`,blending:Ae,depthTest:!1,depthWrite:!1})}function Pd(){return new le({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Rl(),fragmentShader:`

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
		`,blending:Ae,depthTest:!1,depthWrite:!1})}function Ld(){return new le({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Rl(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Ae,depthTest:!1,depthWrite:!1})}function Rl(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 outputDirection;

		varying vec3 vOutputDirection;

		void main() {

			vOutputDirection = outputDirection;
			gl_Position = vec4( position, 1.0 );

		}
	`}var Al=class extends he{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;let i={width:t,height:t,depth:1},s=[i,i,i,i,i,i];this.texture=new yr(s),this._setTextureOptions(e),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;let i={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},s=new Be(5,5,5),r=new le({name:"CubemapFromEquirect",uniforms:Zn(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:Ye,blending:Ae});r.uniforms.tEquirect.value=e;let o=new Wt(s,r),a=e.minFilter;return e.minFilter===Pn&&(e.minFilter=Fe),new Da(1,10,this).update(t,o),e.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(t,e=!0,i=!0,s=!0){let r=t.getRenderTarget();for(let o=0;o<6;o++)t.setRenderTarget(this,o),t.clear(e,i,s);t.setRenderTarget(r)}};function ax(n){let t=new WeakMap,e=new WeakMap,i=null;function s(d,u=!1){return d==null?null:u?o(d):r(d)}function r(d){if(d&&d.isTexture){let u=d.mapping;if(u===Ba||u===ka)if(t.has(d)){let p=t.get(d).texture;return a(p,d.mapping)}else{let p=d.image;if(p&&p.height>0){let x=new Al(p.height);return x.fromEquirectangularTexture(n,d),t.set(d,x),d.addEventListener("dispose",c),a(x.texture,d.mapping)}else return null}}return d}function o(d){if(d&&d.isTexture){let u=d.mapping,p=u===Ba||u===ka,x=u===Rn||u===Yn;if(p||x){let m=e.get(d),g=m!==void 0?m.texture.pmremVersion:0;if(d.isRenderTargetTexture&&d.pmremVersion!==g)return i===null&&(i=new Vs(n)),m=p?i.fromEquirectangular(d,m):i.fromCubemap(d,m),m.texture.pmremVersion=d.pmremVersion,e.set(d,m),m.texture;if(m!==void 0)return m.texture;{let b=d.image;return p&&b&&b.height>0||x&&b&&l(b)?(i===null&&(i=new Vs(n)),m=p?i.fromEquirectangular(d):i.fromCubemap(d),m.texture.pmremVersion=d.pmremVersion,e.set(d,m),d.addEventListener("dispose",h),m.texture):null}}}return d}function a(d,u){return u===Ba?d.mapping=Rn:u===ka&&(d.mapping=Yn),d}function l(d){let u=0,p=6;for(let x=0;x<p;x++)d[x]!==void 0&&u++;return u===p}function c(d){let u=d.target;u.removeEventListener("dispose",c);let p=t.get(u);p!==void 0&&(t.delete(u),p.dispose())}function h(d){let u=d.target;u.removeEventListener("dispose",h);let p=e.get(u);p!==void 0&&(e.delete(u),p.dispose())}function f(){t=new WeakMap,e=new WeakMap,i!==null&&(i.dispose(),i=null)}return{get:s,dispose:f}}function lx(n){let t={};function e(i){if(t[i]!==void 0)return t[i];let s=n.getExtension(i);return t[i]=s,s}return{has:function(i){return e(i)!==null},init:function(){e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance"),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture"),e("WEBGL_render_shared_exponent")},get:function(i){let s=e(i);return s===null&&kn("WebGLRenderer: "+i+" extension not supported."),s}}}function cx(n,t,e,i){let s={},r=new WeakMap;function o(f){let d=f.target;d.index!==null&&t.remove(d.index);for(let p in d.attributes)t.remove(d.attributes[p]);d.removeEventListener("dispose",o),delete s[d.id];let u=r.get(d);u&&(t.remove(u),r.delete(d)),i.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,e.memory.geometries--}function a(f,d){return s[d.id]===!0||(d.addEventListener("dispose",o),s[d.id]=!0,e.memory.geometries++),d}function l(f){let d=f.attributes;for(let u in d)t.update(d[u],n.ARRAY_BUFFER)}function c(f){let d=[],u=f.index,p=f.attributes.position,x=0;if(p===void 0)return;if(u!==null){let b=u.array;x=u.version;for(let T=0,v=b.length;T<v;T+=3){let S=b[T+0],C=b[T+1],P=b[T+2];d.push(S,C,C,P,P,S)}}else{let b=p.array;x=p.version;for(let T=0,v=b.length/3-1;T<v;T+=3){let S=T+0,C=T+1,P=T+2;d.push(S,C,C,P,P,S)}}let m=new(p.count>=65535?gr:mr)(d,1);m.version=x;let g=r.get(f);g&&t.remove(g),r.set(f,m)}function h(f){let d=r.get(f);if(d){let u=f.index;u!==null&&d.version<u.version&&c(f)}else c(f);return r.get(f)}return{get:a,update:l,getWireframeAttribute:h}}function hx(n,t,e){let i;function s(f){i=f}let r,o;function a(f){r=f.type,o=f.bytesPerElement}function l(f,d){n.drawElements(i,d,r,f*o),e.update(d,i,1)}function c(f,d,u){u!==0&&(n.drawElementsInstanced(i,d,r,f*o,u),e.update(d,i,u))}function h(f,d,u){if(u===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,d,0,r,f,0,u);let x=0;for(let m=0;m<u;m++)x+=d[m];e.update(x,i,1)}this.setMode=s,this.setIndex=a,this.render=l,this.renderInstances=c,this.renderMultiDraw=h}function ux(n){let t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function i(r,o,a){switch(e.calls++,o){case n.TRIANGLES:e.triangles+=a*(r/3);break;case n.LINES:e.lines+=a*(r/2);break;case n.LINE_STRIP:e.lines+=a*(r-1);break;case n.LINE_LOOP:e.lines+=a*r;break;case n.POINTS:e.points+=a*r;break;default:Yt("WebGLInfo: Unknown draw mode:",o);break}}function s(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:s,update:i}}function dx(n,t,e){let i=new WeakMap,s=new xe;function r(o,a,l){let c=o.morphTargetInfluences,h=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,f=h!==void 0?h.length:0,d=i.get(a);if(d===void 0||d.count!==f){let A=function(){P.dispose(),i.delete(a),a.removeEventListener("dispose",A)};d!==void 0&&d.texture.dispose();let u=a.morphAttributes.position!==void 0,p=a.morphAttributes.normal!==void 0,x=a.morphAttributes.color!==void 0,m=a.morphAttributes.position||[],g=a.morphAttributes.normal||[],b=a.morphAttributes.color||[],T=0;u===!0&&(T=1),p===!0&&(T=2),x===!0&&(T=3);let v=a.attributes.position.count*T,S=1;v>t.maxTextureSize&&(S=Math.ceil(v/t.maxTextureSize),v=t.maxTextureSize);let C=new Float32Array(v*S*4*f),P=new pr(C,v,S,f);P.type=Ii,P.needsUpdate=!0;let y=T*4;for(let U=0;U<f;U++){let I=m[U],M=g[U],E=b[U],R=v*S*4*U;for(let N=0;N<I.count;N++){let O=N*y;u===!0&&(s.fromBufferAttribute(I,N),C[R+O+0]=s.x,C[R+O+1]=s.y,C[R+O+2]=s.z,C[R+O+3]=0),p===!0&&(s.fromBufferAttribute(M,N),C[R+O+4]=s.x,C[R+O+5]=s.y,C[R+O+6]=s.z,C[R+O+7]=0),x===!0&&(s.fromBufferAttribute(E,N),C[R+O+8]=s.x,C[R+O+9]=s.y,C[R+O+10]=s.z,C[R+O+11]=E.itemSize===4?s.w:1)}}d={count:f,texture:P,size:new tt(v,S)},i.set(a,d),a.addEventListener("dispose",A)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(n,"morphTexture",o.morphTexture,e);else{let u=0;for(let x=0;x<c.length;x++)u+=c[x];let p=a.morphTargetsRelative?1:1-u;l.getUniforms().setValue(n,"morphTargetBaseInfluence",p),l.getUniforms().setValue(n,"morphTargetInfluences",c)}l.getUniforms().setValue(n,"morphTargetsTexture",d.texture,e),l.getUniforms().setValue(n,"morphTargetsTextureSize",d.size)}return{update:r}}function fx(n,t,e,i,s){let r=new WeakMap;function o(c){let h=s.render.frame,f=c.geometry,d=t.get(c,f);if(r.get(d)!==h&&(t.update(d),r.set(d,h)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),r.get(c)!==h&&(e.update(c.instanceMatrix,n.ARRAY_BUFFER),c.instanceColor!==null&&e.update(c.instanceColor,n.ARRAY_BUFFER),r.set(c,h))),c.isSkinnedMesh){let u=c.skeleton;r.get(u)!==h&&(u.update(),r.set(u,h))}return d}function a(){r=new WeakMap}function l(c){let h=c.target;h.removeEventListener("dispose",l),i.releaseStatesOfObject(h),e.remove(h.instanceMatrix),h.instanceColor!==null&&e.remove(h.instanceColor)}return{update:o,dispose:a}}var px={[Xr]:"LINEAR_TONE_MAPPING",[qr]:"REINHARD_TONE_MAPPING",[Yr]:"CINEON_TONE_MAPPING",[Zr]:"ACES_FILMIC_TONE_MAPPING",[Kr]:"AGX_TONE_MAPPING",[Cn]:"NEUTRAL_TONE_MAPPING",[jr]:"CUSTOM_TONE_MAPPING"};function mx(n,t,e,i,s,r){let o=new he(t,e,{type:n,depthBuffer:s,stencilBuffer:r,samples:i?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),a=null,l=null,c=new we;c.setAttribute("position",new oe([-1,3,0,-1,-1,0,3,-1,0],3)),c.setAttribute("uv",new oe([0,2,0,0,2,0],2));let h=new Is({uniforms:{tDiffuse:{value:null}},vertexShader:`
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
			}`,depthTest:!1,depthWrite:!1}),f=new Wt(c,h),d=new Pi(-1,1,1,-1,0,1),u=null,p=null,x=!1,m,g=null,b=[],T=!1;this.setSize=function(v,S){o.setSize(v,S),a!==null&&a.setSize(v,S),l!==null&&l.setSize(v,S);for(let C=0;C<b.length;C++){let P=b[C];P.setSize&&P.setSize(v,S)}},this.setEffects=function(v){b=v,T=b.length>0&&b[0].isRenderPass===!0;let S=o.width,C=o.height;b.length>0&&a===null&&(a=new he(S,C,{type:ve,depthBuffer:!1,stencilBuffer:!1}),l=new he(S,C,{type:ve,depthBuffer:!1,stencilBuffer:!1}));for(let P=0;P<b.length;P++){let y=b[P];y.setSize&&y.setSize(S,C)}},this.begin=function(v,S){if(x||v.toneMapping===pi&&b.length===0)return!1;if(g=S,S!==null){let C=S.width,P=S.height;(o.width!==C||o.height!==P)&&this.setSize(C,P)}return T===!1&&v.setRenderTarget(o),m=v.toneMapping,v.toneMapping=pi,!0},this.hasRenderPass=function(){return T},this.end=function(v,S){v.toneMapping=m,x=!0;let C=o,P=a;for(let y=0;y<b.length;y++){let A=b[y];A.enabled!==!1&&(A.render(v,P,C,S),A.needsSwap!==!1&&(C=P,P=P===a?l:a))}if(u!==v.outputColorSpace||p!==v.toneMapping){u=v.outputColorSpace,p=v.toneMapping,h.defines={},ie.getTransfer(u)===ce&&(h.defines.SRGB_TRANSFER="");let y=px[p];y&&(h.defines[y]=""),h.needsUpdate=!0}h.uniforms.tDiffuse.value=C.texture,v.setRenderTarget(g),v.render(f,d),g=null,x=!1},this.isCompositing=function(){return x},this.dispose=function(){o.dispose(),a!==null&&a.dispose(),l!==null&&l.dispose(),c.dispose(),h.dispose()}}var Jd=new We,Eh=new Hi(1,1),Qd=new pr,$d=new ha,tf=new yr,Id=[],Dd=[],Nd=new Float32Array(16),Ud=new Float32Array(9),Fd=new Float32Array(4);function Gs(n,t,e){let i=n[0];if(i<=0||i>0)return n;let s=t*e,r=Id[s];if(r===void 0&&(r=new Float32Array(s),Id[s]=r),t!==0){i.toArray(r,0);for(let o=1,a=0;o!==t;++o)a+=e,n[o].toArray(r,a)}return r}function ze(n,t){if(n.length!==t.length)return!1;for(let e=0,i=n.length;e<i;e++)if(n[e]!==t[e])return!1;return!0}function He(n,t){for(let e=0,i=t.length;e<i;e++)n[e]=t[e]}function Pl(n,t){let e=Dd[t];e===void 0&&(e=new Int32Array(t),Dd[t]=e);for(let i=0;i!==t;++i)e[i]=n.allocateTextureUnit();return e}function gx(n,t){let e=this.cache;e[0]!==t&&(n.uniform1f(this.addr,t),e[0]=t)}function xx(n,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(n.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(ze(e,t))return;n.uniform2fv(this.addr,t),He(e,t)}}function vx(n,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(n.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(n.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(ze(e,t))return;n.uniform3fv(this.addr,t),He(e,t)}}function _x(n,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(n.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(ze(e,t))return;n.uniform4fv(this.addr,t),He(e,t)}}function yx(n,t){let e=this.cache,i=t.elements;if(i===void 0){if(ze(e,t))return;n.uniformMatrix2fv(this.addr,!1,t),He(e,t)}else{if(ze(e,i))return;Fd.set(i),n.uniformMatrix2fv(this.addr,!1,Fd),He(e,i)}}function Mx(n,t){let e=this.cache,i=t.elements;if(i===void 0){if(ze(e,t))return;n.uniformMatrix3fv(this.addr,!1,t),He(e,t)}else{if(ze(e,i))return;Ud.set(i),n.uniformMatrix3fv(this.addr,!1,Ud),He(e,i)}}function bx(n,t){let e=this.cache,i=t.elements;if(i===void 0){if(ze(e,t))return;n.uniformMatrix4fv(this.addr,!1,t),He(e,t)}else{if(ze(e,i))return;Nd.set(i),n.uniformMatrix4fv(this.addr,!1,Nd),He(e,i)}}function Sx(n,t){let e=this.cache;e[0]!==t&&(n.uniform1i(this.addr,t),e[0]=t)}function wx(n,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(n.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(ze(e,t))return;n.uniform2iv(this.addr,t),He(e,t)}}function Ex(n,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(n.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(ze(e,t))return;n.uniform3iv(this.addr,t),He(e,t)}}function Tx(n,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(n.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(ze(e,t))return;n.uniform4iv(this.addr,t),He(e,t)}}function Ax(n,t){let e=this.cache;e[0]!==t&&(n.uniform1ui(this.addr,t),e[0]=t)}function Cx(n,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(n.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(ze(e,t))return;n.uniform2uiv(this.addr,t),He(e,t)}}function Rx(n,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(n.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(ze(e,t))return;n.uniform3uiv(this.addr,t),He(e,t)}}function Px(n,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(n.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(ze(e,t))return;n.uniform4uiv(this.addr,t),He(e,t)}}function Lx(n,t,e){let i=this.cache,s=e.allocateTextureUnit();i[0]!==s&&(n.uniform1i(this.addr,s),i[0]=s);let r;this.type===n.SAMPLER_2D_SHADOW?(Eh.compareFunction=e.isReversedDepthBuffer()?wl:Sl,r=Eh):r=Jd,e.setTexture2D(t||r,s)}function Ix(n,t,e){let i=this.cache,s=e.allocateTextureUnit();i[0]!==s&&(n.uniform1i(this.addr,s),i[0]=s),e.setTexture3D(t||$d,s)}function Dx(n,t,e){let i=this.cache,s=e.allocateTextureUnit();i[0]!==s&&(n.uniform1i(this.addr,s),i[0]=s),e.setTextureCube(t||tf,s)}function Nx(n,t,e){let i=this.cache,s=e.allocateTextureUnit();i[0]!==s&&(n.uniform1i(this.addr,s),i[0]=s),e.setTexture2DArray(t||Qd,s)}function Ux(n){switch(n){case 5126:return gx;case 35664:return xx;case 35665:return vx;case 35666:return _x;case 35674:return yx;case 35675:return Mx;case 35676:return bx;case 5124:case 35670:return Sx;case 35667:case 35671:return wx;case 35668:case 35672:return Ex;case 35669:case 35673:return Tx;case 5125:return Ax;case 36294:return Cx;case 36295:return Rx;case 36296:return Px;case 35678:case 36198:case 36298:case 36306:case 35682:return Lx;case 35679:case 36299:case 36307:return Ix;case 35680:case 36300:case 36308:case 36293:return Dx;case 36289:case 36303:case 36311:case 36292:return Nx}}function Fx(n,t){n.uniform1fv(this.addr,t)}function Ox(n,t){let e=Gs(t,this.size,2);n.uniform2fv(this.addr,e)}function Bx(n,t){let e=Gs(t,this.size,3);n.uniform3fv(this.addr,e)}function kx(n,t){let e=Gs(t,this.size,4);n.uniform4fv(this.addr,e)}function zx(n,t){let e=Gs(t,this.size,4);n.uniformMatrix2fv(this.addr,!1,e)}function Hx(n,t){let e=Gs(t,this.size,9);n.uniformMatrix3fv(this.addr,!1,e)}function Vx(n,t){let e=Gs(t,this.size,16);n.uniformMatrix4fv(this.addr,!1,e)}function Gx(n,t){n.uniform1iv(this.addr,t)}function Wx(n,t){n.uniform2iv(this.addr,t)}function Xx(n,t){n.uniform3iv(this.addr,t)}function qx(n,t){n.uniform4iv(this.addr,t)}function Yx(n,t){n.uniform1uiv(this.addr,t)}function Zx(n,t){n.uniform2uiv(this.addr,t)}function jx(n,t){n.uniform3uiv(this.addr,t)}function Kx(n,t){n.uniform4uiv(this.addr,t)}function Jx(n,t,e){let i=this.cache,s=t.length,r=Pl(e,s);ze(i,r)||(n.uniform1iv(this.addr,r),He(i,r));let o;this.type===n.SAMPLER_2D_SHADOW?o=Eh:o=Jd;for(let a=0;a!==s;++a)e.setTexture2D(t[a]||o,r[a])}function Qx(n,t,e){let i=this.cache,s=t.length,r=Pl(e,s);ze(i,r)||(n.uniform1iv(this.addr,r),He(i,r));for(let o=0;o!==s;++o)e.setTexture3D(t[o]||$d,r[o])}function $x(n,t,e){let i=this.cache,s=t.length,r=Pl(e,s);ze(i,r)||(n.uniform1iv(this.addr,r),He(i,r));for(let o=0;o!==s;++o)e.setTextureCube(t[o]||tf,r[o])}function tv(n,t,e){let i=this.cache,s=t.length,r=Pl(e,s);ze(i,r)||(n.uniform1iv(this.addr,r),He(i,r));for(let o=0;o!==s;++o)e.setTexture2DArray(t[o]||Qd,r[o])}function ev(n){switch(n){case 5126:return Fx;case 35664:return Ox;case 35665:return Bx;case 35666:return kx;case 35674:return zx;case 35675:return Hx;case 35676:return Vx;case 5124:case 35670:return Gx;case 35667:case 35671:return Wx;case 35668:case 35672:return Xx;case 35669:case 35673:return qx;case 5125:return Yx;case 36294:return Zx;case 36295:return jx;case 36296:return Kx;case 35678:case 36198:case 36298:case 36306:case 35682:return Jx;case 35679:case 36299:case 36307:return Qx;case 35680:case 36300:case 36308:case 36293:return $x;case 36289:case 36303:case 36311:case 36292:return tv}}var Th=class{constructor(t,e,i){this.id=t,this.addr=i,this.cache=[],this.type=e.type,this.setValue=Ux(e.type)}},Ah=class{constructor(t,e,i){this.id=t,this.addr=i,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=ev(e.type)}},Ch=class{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,i){let s=this.seq;for(let r=0,o=s.length;r!==o;++r){let a=s[r];a.setValue(t,e[a.id],i)}}},Sh=/(\w+)(\])?(\[|\.)?/g;function Od(n,t){n.seq.push(t),n.map[t.id]=t}function iv(n,t,e){let i=n.name,s=i.length;for(Sh.lastIndex=0;;){let r=Sh.exec(i),o=Sh.lastIndex,a=r[1],l=r[2]==="]",c=r[3];if(l&&(a=a|0),c===void 0||c==="["&&o+2===s){Od(e,c===void 0?new Th(a,n,t):new Ah(a,n,t));break}else{let f=e.map[a];f===void 0&&(f=new Ch(a),Od(e,f)),e=f}}}var Hs=class{constructor(t,e){this.seq=[],this.map={};let i=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let o=0;o<i;++o){let a=t.getActiveUniform(e,o),l=t.getUniformLocation(e,a.name);iv(a,l,this)}let s=[],r=[];for(let o of this.seq)o.type===t.SAMPLER_2D_SHADOW||o.type===t.SAMPLER_CUBE_SHADOW||o.type===t.SAMPLER_2D_ARRAY_SHADOW?s.push(o):r.push(o);s.length>0&&(this.seq=s.concat(r))}setValue(t,e,i,s){let r=this.map[e];r!==void 0&&r.setValue(t,i,s)}setOptional(t,e,i){let s=e[i];s!==void 0&&this.setValue(t,i,s)}static upload(t,e,i,s){for(let r=0,o=e.length;r!==o;++r){let a=e[r],l=i[a.id];l.needsUpdate!==!1&&a.setValue(t,l.value,s)}}static seqWithValue(t,e){let i=[];for(let s=0,r=t.length;s!==r;++s){let o=t[s];o.id in e&&i.push(o)}return i}};function Bd(n,t,e){let i=n.createShader(t);return n.shaderSource(i,e),n.compileShader(i),i}var nv=37297,sv=0;function rv(n,t){let e=n.split(`
`),i=[],s=Math.max(t-6,0),r=Math.min(t+6,e.length);for(let o=s;o<r;o++){let a=o+1;i.push(`${a===t?">":" "} ${a}: ${e[o]}`)}return i.join(`
`)}var kd=new Kt;function ov(n){ie._getMatrix(kd,ie.workingColorSpace,n);let t=`mat3( ${kd.elements.map(e=>e.toFixed(4))} )`;switch(ie.getTransfer(n)){case ur:return[t,"LinearTransferOETF"];case ce:return[t,"sRGBTransferOETF"];default:return qt("WebGLProgram: Unsupported color space: ",n),[t,"LinearTransferOETF"]}}function zd(n,t,e){let i=n.getShaderParameter(t,n.COMPILE_STATUS),r=(n.getShaderInfoLog(t)||"").trim();if(i&&r==="")return"";let o=/ERROR: 0:(\d+)/.exec(r);if(o){let a=parseInt(o[1]);return e.toUpperCase()+`

`+r+`

`+rv(n.getShaderSource(t),a)}else return r}function av(n,t){let e=ov(t);return[`vec4 ${n}( vec4 value ) {`,`	return ${e[1]}( vec4( value.rgb * ${e[0]}, value.a ) );`,"}"].join(`
`)}var lv={[Xr]:"Linear",[qr]:"Reinhard",[Yr]:"Cineon",[Zr]:"ACESFilmic",[Kr]:"AgX",[Cn]:"Neutral",[jr]:"Custom"};function cv(n,t){let e=lv[t];return e===void 0?(qt("WebGLProgram: Unsupported toneMapping:",t),"vec3 "+n+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+n+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}var Tl=new D;function hv(){ie.getLuminanceCoefficients(Tl);let n=Tl.x.toFixed(4),t=Tl.y.toFixed(4),e=Tl.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${n}, ${t}, ${e} );`,"	return dot( weights, rgb );","}"].join(`
`)}function uv(n){return[n.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",n.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(ao).join(`
`)}function dv(n){let t=[];for(let e in n){let i=n[e];i!==!1&&t.push("#define "+e+" "+i)}return t.join(`
`)}function fv(n,t){let e={},i=n.getProgramParameter(t,n.ACTIVE_ATTRIBUTES);for(let s=0;s<i;s++){let r=n.getActiveAttrib(t,s),o=r.name,a=1;r.type===n.FLOAT_MAT2&&(a=2),r.type===n.FLOAT_MAT3&&(a=3),r.type===n.FLOAT_MAT4&&(a=4),e[o]={type:r.type,location:n.getAttribLocation(t,o),locationSize:a}}return e}function ao(n){return n!==""}function Hd(n,t){let e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return n.replace(/NUM_SUN_LIGHTS/g,t.numSunLights).replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,t.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function Vd(n,t){return n.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var pv=/^[ \t]*#include +<([\w\d./]+)>/gm;function Rh(n){return n.replace(pv,gv)}var mv=new Map;function gv(n,t){let e=te[t];if(e===void 0){let i=mv.get(t);if(i!==void 0)e=te[i],qt('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,i);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+t+">")}return Rh(e)}var xv=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Gd(n){return n.replace(xv,vv)}function vv(n,t,e,i){let s="";for(let r=parseInt(t);r<parseInt(e);r++)s+=i.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function Wd(n){let t=`precision ${n.precision} float;
	precision ${n.precision} int;
	precision ${n.precision} sampler2D;
	precision ${n.precision} samplerCube;
	precision ${n.precision} sampler3D;
	precision ${n.precision} sampler2DArray;
	precision ${n.precision} sampler2DShadow;
	precision ${n.precision} samplerCubeShadow;
	precision ${n.precision} sampler2DArrayShadow;
	precision ${n.precision} isampler2D;
	precision ${n.precision} isampler3D;
	precision ${n.precision} isamplerCube;
	precision ${n.precision} isampler2DArray;
	precision ${n.precision} usampler2D;
	precision ${n.precision} usampler3D;
	precision ${n.precision} usamplerCube;
	precision ${n.precision} usampler2DArray;
	`;return n.precision==="highp"?t+=`
#define HIGH_PRECISION`:n.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:n.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}var _v={[Tn]:"SHADOWMAP_TYPE_PCF",[Us]:"SHADOWMAP_TYPE_VSM"};function yv(n){return _v[n.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var Mv={[Rn]:"ENVMAP_TYPE_CUBE",[Yn]:"ENVMAP_TYPE_CUBE",[Jr]:"ENVMAP_TYPE_CUBE_UV"};function bv(n){return n.envMap===!1?"ENVMAP_TYPE_CUBE":Mv[n.envMapMode]||"ENVMAP_TYPE_CUBE"}var Sv={[Yn]:"ENVMAP_MODE_REFRACTION"};function wv(n){return n.envMap===!1?"ENVMAP_MODE_REFLECTION":Sv[n.envMapMode]||"ENVMAP_MODE_REFLECTION"}var Ev={[Oa]:"ENVMAP_BLENDING_MULTIPLY",[sd]:"ENVMAP_BLENDING_MIX",[rd]:"ENVMAP_BLENDING_ADD"};function Tv(n){return n.envMap===!1?"ENVMAP_BLENDING_NONE":Ev[n.combine]||"ENVMAP_BLENDING_NONE"}function Av(n){let t=n.envMapCubeUVHeight;if(t===null)return null;let e=Math.log2(t)-2,i=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),112)),texelHeight:i,maxMip:e}}function Cv(n,t,e,i){let s=n.getContext(),r=e.defines,o=e.vertexShader,a=e.fragmentShader,l=yv(e),c=bv(e),h=wv(e),f=Tv(e),d=Av(e),u=uv(e),p=dv(r),x=s.createProgram(),m,g,b=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(m=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,p].filter(ao).join(`
`),m.length>0&&(m+=`
`),g=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,p].filter(ao).join(`
`),g.length>0&&(g+=`
`)):(m=[Wd(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,p,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.batchingColor?"#define USE_BATCHING_COLOR":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.instancingMorph?"#define USE_INSTANCING_MORPH":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+h:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexNormals?"#define HAS_NORMAL":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",e.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(ao).join(`
`),g=[Wd(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,p,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+c:"",e.envMap?"#define "+h:"",e.envMap?"#define "+f:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.dispersion?"#define USE_DISPERSION":"",e.retroreflection?"#define USE_RETROREFLECTION":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor?"#define USE_COLOR":"",e.vertexAlphas||e.batchingColor?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",e.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",e.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==pi?"#define TONE_MAPPING":"",e.toneMapping!==pi?te.tonemapping_pars_fragment:"",e.toneMapping!==pi?cv("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",te.colorspace_pars_fragment,av("linearToOutputTexel",e.outputColorSpace),hv(),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(ao).join(`
`)),o=Rh(o),o=Hd(o,e),o=Vd(o,e),a=Rh(a),a=Hd(a,e),a=Vd(a,e),o=Gd(o),a=Gd(a),e.isRawShaderMaterial!==!0&&(b=`#version 300 es
`,m=[u,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,g=["#define varying in",e.glslVersion===oh?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===oh?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+g);let T=b+m+o,v=b+g+a,S=Bd(s,s.VERTEX_SHADER,T),C=Bd(s,s.FRAGMENT_SHADER,v);s.attachShader(x,S),s.attachShader(x,C),e.index0AttributeName!==void 0?s.bindAttribLocation(x,0,e.index0AttributeName):e.hasPositionAttribute===!0&&s.bindAttribLocation(x,0,"position"),s.linkProgram(x);function P(I){if(n.debug.checkShaderErrors){let M=s.getProgramInfoLog(x)||"",E=s.getShaderInfoLog(S)||"",R=s.getShaderInfoLog(C)||"",N=M.trim(),O=E.trim(),F=R.trim(),V=!0,k=!0;if(s.getProgramParameter(x,s.LINK_STATUS)===!1)if(V=!1,typeof n.debug.onShaderError=="function")n.debug.onShaderError(s,x,S,C);else{let W=zd(s,S,"vertex"),j=zd(s,C,"fragment");Yt("WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(x,s.VALIDATE_STATUS)+`

Material Name: `+I.name+`
Material Type: `+I.type+`

Program Info Log: `+N+`
`+W+`
`+j)}else N!==""?qt("WebGLProgram: Program Info Log:",N):(O===""||F==="")&&(k=!1);k&&(I.diagnostics={runnable:V,programLog:N,vertexShader:{log:O,prefix:m},fragmentShader:{log:F,prefix:g}})}s.deleteShader(S),s.deleteShader(C),y=new Hs(s,x),A=fv(s,x)}let y;this.getUniforms=function(){return y===void 0&&P(this),y};let A;this.getAttributes=function(){return A===void 0&&P(this),A};let U=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return U===!1&&(U=s.getProgramParameter(x,nv)),U},this.destroy=function(){i.releaseStatesOfProgram(this),s.deleteProgram(x),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=sv++,this.cacheKey=t,this.usedTimes=1,this.program=x,this.vertexShader=S,this.fragmentShader=C,this}var Rv=0,Ph=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t,e,i){let s=this._getShaderCacheForMaterial(t);return s.has(e)===!1&&(s.add(e),e.usedTimes++),s.has(i)===!1&&(s.add(i),i.usedTimes++),this}remove(t){let e=this.materialCache.get(t);for(let i of e)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(t),this}getVertexShaderStage(t){return this._getShaderStage(t.vertexShader)}getFragmentShaderStage(t){return this._getShaderStage(t.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){let e=this.materialCache,i=e.get(t);return i===void 0&&(i=new Set,e.set(t,i)),i}_getShaderStage(t){let e=this.shaderCache,i=e.get(t);return i===void 0&&(i=new Lh(t),e.set(t,i)),i}},Lh=class{constructor(t){this.id=Rv++,this.code=t,this.usedTimes=0}};function Pv(n){return n===In||n===no||n===so}function Lv(n,t,e,i,s,r){let o=new Ss,a=new Ph,l=new Set,c=[],h=new Map,f=i.logarithmicDepthBuffer,d=i.precision,u={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function p(y){return l.add(y),y===0?"uv":`uv${y}`}function x(y,A,U,I,M,E){let R=I.fog,N=M.geometry,O=y.isMeshStandardMaterial||y.isMeshLambertMaterial||y.isMeshPhongMaterial?I.environment:null,F=y.isMeshStandardMaterial||y.isMeshLambertMaterial&&!y.envMap||y.isMeshPhongMaterial&&!y.envMap,V=t.get(y.envMap||O,F),k=V&&V.mapping===Jr?V.image.height:null,W=u[y.type];y.precision!==null&&(d=i.getMaxPrecision(y.precision),d!==y.precision&&qt("WebGLProgram.getParameters:",y.precision,"not supported, using",d,"instead."));let j=N.morphAttributes.position||N.morphAttributes.normal||N.morphAttributes.color,ht=j!==void 0?j.length:0,ft=0;N.morphAttributes.position!==void 0&&(ft=1),N.morphAttributes.normal!==void 0&&(ft=2),N.morphAttributes.color!==void 0&&(ft=3);let At,wt,Gt,Z;if(W){let _e=Wi[W];At=_e.vertexShader,wt=_e.fragmentShader}else{At=y.vertexShader,wt=y.fragmentShader;let _e=a.getVertexShaderStage(y),ue=a.getFragmentShaderStage(y);a.update(y,_e,ue),Gt=_e.id,Z=ue.id}let K=n.getRenderTarget(),dt=n.state.buffers.depth.getReversed(),Pt=M.isInstancedMesh===!0,vt=M.isBatchedMesh===!0,Bt=!!y.map,ee=!!y.matcap,et=!!V,at=!!y.aoMap,st=!!y.lightMap,ot=!!y.bumpMap&&y.wireframe===!1,ct=!!y.normalMap,Ut=!!y.displacementMap,Rt=!!y.emissiveMap,It=!!y.metalnessMap,Xt=!!y.roughnessMap,B=y.anisotropy>0,ne=y.clearcoat>0,jt=y.dispersion>0,L=y.retroreflectivity>0,_=y.iridescence>0,G=y.sheen>0,X=y.transmission>0,Q=B&&!!y.anisotropyMap,ut=ne&&!!y.clearcoatMap,pt=ne&&!!y.clearcoatNormalMap,$=ne&&!!y.clearcoatRoughnessMap,nt=_&&!!y.iridescenceMap,xt=_&&!!y.iridescenceThicknessMap,kt=G&&!!y.sheenColorMap,gt=G&&!!y.sheenRoughnessMap,mt=!!y.specularMap,Lt=!!y.specularColorMap,Ht=!!y.specularIntensityMap,Zt=X&&!!y.transmissionMap,H=X&&!!y.thicknessMap,_t=!!y.gradientMap,it=!!y.alphaMap,yt=y.alphaTest>0,Et=!!y.alphaHash,lt=!!y.extensions,Vt=pi;y.toneMapped&&(K===null||K.isXRRenderTarget===!0)&&(Vt=n.toneMapping);let Ot={shaderID:W,shaderType:y.type,shaderName:y.name,vertexShader:At,fragmentShader:wt,defines:y.defines,customVertexShaderID:Gt,customFragmentShaderID:Z,isRawShaderMaterial:y.isRawShaderMaterial===!0,glslVersion:y.glslVersion,precision:d,batching:vt,batchingColor:vt&&M._colorsTexture!==null,instancing:Pt,instancingColor:Pt&&M.instanceColor!==null,instancingMorph:Pt&&M.morphTexture!==null,outputColorSpace:K===null?n.outputColorSpace:K.isXRRenderTarget===!0?K.texture.colorSpace:ie.workingColorSpace,alphaToCoverage:!!y.alphaToCoverage,map:Bt,matcap:ee,envMap:et,envMapMode:et&&V.mapping,envMapCubeUVHeight:k,aoMap:at,lightMap:st,bumpMap:ot,normalMap:ct,displacementMap:Ut,emissiveMap:Rt,normalMapObjectSpace:ct&&y.normalMapType===ld,normalMapTangentSpace:ct&&y.normalMapType===Bs,packedNormalMap:ct&&y.normalMapType===Bs&&Pv(y.normalMap.format),metalnessMap:It,roughnessMap:Xt,anisotropy:B,anisotropyMap:Q,clearcoat:ne,clearcoatMap:ut,clearcoatNormalMap:pt,clearcoatRoughnessMap:$,dispersion:jt,retroreflection:L,iridescence:_,iridescenceMap:nt,iridescenceThicknessMap:xt,sheen:G,sheenColorMap:kt,sheenRoughnessMap:gt,specularMap:mt,specularColorMap:Lt,specularIntensityMap:Ht,transmission:X,transmissionMap:Zt,thicknessMap:H,gradientMap:_t,opaque:y.transparent===!1&&y.blending===Fs&&y.alphaToCoverage===!1,alphaMap:it,alphaTest:yt,alphaHash:Et,combine:y.combine,mapUv:Bt&&p(y.map.channel),aoMapUv:at&&p(y.aoMap.channel),lightMapUv:st&&p(y.lightMap.channel),bumpMapUv:ot&&p(y.bumpMap.channel),normalMapUv:ct&&p(y.normalMap.channel),displacementMapUv:Ut&&p(y.displacementMap.channel),emissiveMapUv:Rt&&p(y.emissiveMap.channel),metalnessMapUv:It&&p(y.metalnessMap.channel),roughnessMapUv:Xt&&p(y.roughnessMap.channel),anisotropyMapUv:Q&&p(y.anisotropyMap.channel),clearcoatMapUv:ut&&p(y.clearcoatMap.channel),clearcoatNormalMapUv:pt&&p(y.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:$&&p(y.clearcoatRoughnessMap.channel),iridescenceMapUv:nt&&p(y.iridescenceMap.channel),iridescenceThicknessMapUv:xt&&p(y.iridescenceThicknessMap.channel),sheenColorMapUv:kt&&p(y.sheenColorMap.channel),sheenRoughnessMapUv:gt&&p(y.sheenRoughnessMap.channel),specularMapUv:mt&&p(y.specularMap.channel),specularColorMapUv:Lt&&p(y.specularColorMap.channel),specularIntensityMapUv:Ht&&p(y.specularIntensityMap.channel),transmissionMapUv:Zt&&p(y.transmissionMap.channel),thicknessMapUv:H&&p(y.thicknessMap.channel),alphaMapUv:it&&p(y.alphaMap.channel),vertexTangents:!!N.attributes.tangent&&(ct||B),vertexNormals:!!N.attributes.normal,vertexColors:y.vertexColors,vertexAlphas:y.vertexColors===!0&&!!N.attributes.color&&N.attributes.color.itemSize===4,pointsUvs:M.isPoints===!0&&!!N.attributes.uv&&(Bt||it),fog:!!R,useFog:y.fog===!0,fogExp2:!!R&&R.isFogExp2,flatShading:y.wireframe===!1&&(y.flatShading===!0||N.attributes.normal===void 0&&ct===!1&&(y.isMeshLambertMaterial||y.isMeshPhongMaterial||y.isMeshStandardMaterial||y.isMeshPhysicalMaterial)),sizeAttenuation:y.sizeAttenuation===!0,logarithmicDepthBuffer:f,reversedDepthBuffer:dt,skinning:M.isSkinnedMesh===!0,hasPositionAttribute:N.attributes.position!==void 0,morphTargets:N.morphAttributes.position!==void 0,morphNormals:N.morphAttributes.normal!==void 0,morphColors:N.morphAttributes.color!==void 0,morphTargetsCount:ht,morphTextureStride:ft,numSunLights:A.sun.length,numDirLights:A.directional.length,numPointLights:A.point.length,numSpotLights:A.spot.length,numSpotLightMaps:A.spotLightMap.length,numRectAreaLights:A.rectArea.length,numHemiLights:A.hemi.length,numSunLightShadows:A.sunShadowMap.length,numDirLightShadows:A.directionalShadowMap.length,numPointLightShadows:A.pointShadowMap.length,numSpotLightShadows:A.spotShadowMap.length,numSpotLightShadowsWithMaps:A.numSpotLightShadowsWithMaps,numLightProbes:A.numLightProbes,numLightProbeGrids:E.length,numClippingPlanes:r.numPlanes,numClipIntersection:r.numIntersection,dithering:y.dithering,shadowMapEnabled:n.shadowMap.enabled&&U.length>0,shadowMapType:n.shadowMap.type,toneMapping:Vt,decodeVideoTexture:Bt&&y.map.isVideoTexture===!0&&ie.getTransfer(y.map.colorSpace)===ce,decodeVideoTextureEmissive:Rt&&y.emissiveMap.isVideoTexture===!0&&ie.getTransfer(y.emissiveMap.colorSpace)===ce,premultipliedAlpha:y.premultipliedAlpha,doubleSided:y.side===Le,flipSided:y.side===Ye,useDepthPacking:y.depthPacking>=0,depthPacking:y.depthPacking||0,index0AttributeName:y.index0AttributeName,extensionClipCullDistance:lt&&y.extensions.clipCullDistance===!0&&e.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(lt&&y.extensions.multiDraw===!0||vt)&&e.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:e.has("KHR_parallel_shader_compile"),customProgramCacheKey:y.customProgramCacheKey()};return Ot.vertexUv1s=l.has(1),Ot.vertexUv2s=l.has(2),Ot.vertexUv3s=l.has(3),l.clear(),Ot}function m(y){let A=[];if(y.shaderID?A.push(y.shaderID):(A.push(y.customVertexShaderID),A.push(y.customFragmentShaderID)),y.defines!==void 0)for(let U in y.defines)A.push(U),A.push(y.defines[U]);return y.isRawShaderMaterial===!1&&(g(A,y),b(A,y),A.push(n.outputColorSpace)),A.push(y.customProgramCacheKey),A.join()}function g(y,A){y.push(A.precision),y.push(A.outputColorSpace),y.push(A.envMapMode),y.push(A.envMapCubeUVHeight),y.push(A.mapUv),y.push(A.alphaMapUv),y.push(A.lightMapUv),y.push(A.aoMapUv),y.push(A.bumpMapUv),y.push(A.normalMapUv),y.push(A.displacementMapUv),y.push(A.emissiveMapUv),y.push(A.metalnessMapUv),y.push(A.roughnessMapUv),y.push(A.anisotropyMapUv),y.push(A.clearcoatMapUv),y.push(A.clearcoatNormalMapUv),y.push(A.clearcoatRoughnessMapUv),y.push(A.iridescenceMapUv),y.push(A.iridescenceThicknessMapUv),y.push(A.sheenColorMapUv),y.push(A.sheenRoughnessMapUv),y.push(A.specularMapUv),y.push(A.specularColorMapUv),y.push(A.specularIntensityMapUv),y.push(A.transmissionMapUv),y.push(A.thicknessMapUv),y.push(A.combine),y.push(A.fogExp2),y.push(A.sizeAttenuation),y.push(A.morphTargetsCount),y.push(A.morphAttributeCount),y.push(A.numSunLights),y.push(A.numDirLights),y.push(A.numPointLights),y.push(A.numSpotLights),y.push(A.numSpotLightMaps),y.push(A.numHemiLights),y.push(A.numRectAreaLights),y.push(A.numSunLightShadows),y.push(A.numDirLightShadows),y.push(A.numPointLightShadows),y.push(A.numSpotLightShadows),y.push(A.numSpotLightShadowsWithMaps),y.push(A.numLightProbes),y.push(A.shadowMapType),y.push(A.toneMapping),y.push(A.numClippingPlanes),y.push(A.numClipIntersection),y.push(A.depthPacking)}function b(y,A){o.disableAll(),A.instancing&&o.enable(0),A.instancingColor&&o.enable(1),A.instancingMorph&&o.enable(2),A.matcap&&o.enable(3),A.envMap&&o.enable(4),A.normalMapObjectSpace&&o.enable(5),A.normalMapTangentSpace&&o.enable(6),A.clearcoat&&o.enable(7),A.iridescence&&o.enable(8),A.alphaTest&&o.enable(9),A.vertexColors&&o.enable(10),A.vertexAlphas&&o.enable(11),A.vertexUv1s&&o.enable(12),A.vertexUv2s&&o.enable(13),A.vertexUv3s&&o.enable(14),A.vertexTangents&&o.enable(15),A.anisotropy&&o.enable(16),A.alphaHash&&o.enable(17),A.batching&&o.enable(18),A.dispersion&&o.enable(19),A.retroreflection&&o.enable(24),A.batchingColor&&o.enable(20),A.gradientMap&&o.enable(21),A.packedNormalMap&&o.enable(22),A.vertexNormals&&o.enable(23),y.push(o.mask),o.disableAll(),A.fog&&o.enable(0),A.useFog&&o.enable(1),A.flatShading&&o.enable(2),A.logarithmicDepthBuffer&&o.enable(3),A.reversedDepthBuffer&&o.enable(4),A.skinning&&o.enable(5),A.morphTargets&&o.enable(6),A.morphNormals&&o.enable(7),A.morphColors&&o.enable(8),A.premultipliedAlpha&&o.enable(9),A.shadowMapEnabled&&o.enable(10),A.doubleSided&&o.enable(11),A.flipSided&&o.enable(12),A.useDepthPacking&&o.enable(13),A.dithering&&o.enable(14),A.transmission&&o.enable(15),A.sheen&&o.enable(16),A.opaque&&o.enable(17),A.pointsUvs&&o.enable(18),A.decodeVideoTexture&&o.enable(19),A.decodeVideoTextureEmissive&&o.enable(20),A.alphaToCoverage&&o.enable(21),A.numLightProbeGrids>0&&o.enable(22),A.hasPositionAttribute&&o.enable(23),y.push(o.mask)}function T(y){let A=u[y.type],U;if(A){let I=Wi[A];U=Ce.clone(I.uniforms)}else U=y.uniforms;return U}function v(y,A){let U=h.get(A);return U!==void 0?++U.usedTimes:(U=new Cv(n,A,y,s),c.push(U),h.set(A,U)),U}function S(y){if(--y.usedTimes===0){let A=c.indexOf(y);c[A]=c[c.length-1],c.pop(),h.delete(y.cacheKey),y.destroy()}}function C(y){a.remove(y)}function P(){a.dispose()}return{getParameters:x,getProgramCacheKey:m,getUniforms:T,acquireProgram:v,releaseProgram:S,releaseShaderCache:C,programs:c,dispose:P}}function Iv(){let n=new WeakMap;function t(o){return n.has(o)}function e(o){let a=n.get(o);return a===void 0&&(a={},n.set(o,a)),a}function i(o){n.delete(o)}function s(o,a,l){n.get(o)[a]=l}function r(){n=new WeakMap}return{has:t,get:e,remove:i,update:s,dispose:r}}function Dv(n,t){return n.groupOrder!==t.groupOrder?n.groupOrder-t.groupOrder:n.renderOrder!==t.renderOrder?n.renderOrder-t.renderOrder:n.material.id!==t.material.id?n.material.id-t.material.id:n.materialVariant!==t.materialVariant?n.materialVariant-t.materialVariant:n.z!==t.z?n.z-t.z:n.id-t.id}function Xd(n,t){return n.groupOrder!==t.groupOrder?n.groupOrder-t.groupOrder:n.renderOrder!==t.renderOrder?n.renderOrder-t.renderOrder:n.z!==t.z?t.z-n.z:n.id-t.id}function qd(){let n=[],t=0,e=[],i=[],s=[];function r(){t=0,e.length=0,i.length=0,s.length=0}function o(d){let u=0;return d.isInstancedMesh&&(u+=2),d.isSkinnedMesh&&(u+=1),u}function a(d,u,p,x,m,g){let b=n[t];return b===void 0?(b={id:d.id,object:d,geometry:u,material:p,materialVariant:o(d),groupOrder:x,renderOrder:d.renderOrder,z:m,group:g},n[t]=b):(b.id=d.id,b.object=d,b.geometry=u,b.material=p,b.materialVariant=o(d),b.groupOrder=x,b.renderOrder=d.renderOrder,b.z=m,b.group=g),t++,b}function l(d,u,p,x,m,g,b){b.reversedDepth===!0&&(m=-m);let T=a(d,u,p,x,m,g);p.transmission>0?i.push(T):p.transparent===!0?s.push(T):e.push(T)}function c(d,u,p,x,m,g){let b=a(d,u,p,x,m,g);p.transmission>0?i.unshift(b):p.transparent===!0?s.unshift(b):e.unshift(b)}function h(d,u){e.length>1&&e.sort(d||Dv),i.length>1&&i.sort(u||Xd),s.length>1&&s.sort(u||Xd)}function f(){for(let d=t,u=n.length;d<u;d++){let p=n[d];if(p.id===null)break;p.id=null,p.object=null,p.geometry=null,p.material=null,p.group=null}}return{opaque:e,transmissive:i,transparent:s,init:r,push:l,unshift:c,finish:f,sort:h}}function Nv(){let n=new WeakMap;function t(i,s){let r=n.get(i),o;return r===void 0?(o=new qd,n.set(i,[o])):s>=r.length?(o=new qd,r.push(o)):o=r[s],o}function e(){n=new WeakMap}return{get:t,dispose:e}}function Uv(){let n={};return{get:function(t){if(n[t.id]!==void 0)return n[t.id];let e;switch(t.type){case"SunLight":case"DirectionalLight":e={direction:new D,color:new Ft};break;case"SpotLight":e={position:new D,direction:new D,color:new Ft,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new D,color:new Ft,distance:0,decay:0};break;case"HemisphereLight":e={direction:new D,skyColor:new Ft,groundColor:new Ft};break;case"RectAreaLight":e={color:new Ft,position:new D,halfWidth:new D,halfHeight:new D};break}return n[t.id]=e,e}}}function Fv(){let n={};return{get:function(t){if(n[t.id]!==void 0)return n[t.id];let e;switch(t.type){case"SunLight":case"DirectionalLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new tt};break;case"SpotLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new tt};break;case"PointLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new tt,shadowCameraNear:1,shadowCameraFar:1e3};break}return n[t.id]=e,e}}}var Ov=0;function Bv(n,t){return(t.castShadow?2:0)-(n.castShadow?2:0)+(t.map?1:0)-(n.map?1:0)}function kv(n){let t=new Uv,e=Fv(),i={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new D);let s=new D,r=new re,o=new re;function a(c){let h=0,f=0,d=0;for(let M=0;M<9;M++)i.probe[M].set(0,0,0);let u=0,p=0,x=0,m=0,g=0,b=0,T=0,v=0,S=0,C=0,P=0,y=0,A=0,U=0;c.sort(Bv);for(let M=0,E=c.length;M<E;M++){let R=c[M],N=R.color,O=R.intensity,F=R.distance,V=null;if(R.shadow&&R.shadow.map&&(R.shadow.map.texture.format===In?V=R.shadow.map.texture:V=R.shadow.map.depthTexture||R.shadow.map.texture),R.isAmbientLight)h+=N.r*O,f+=N.g*O,d+=N.b*O;else if(R.isLightProbe){for(let k=0;k<9;k++)i.probe[k].addScaledVector(R.sh.coefficients[k],O);U++}else if(R.isSunLight){let k=t.get(R);if(k.color.copy(R.color).multiplyScalar(R.intensity),R.castShadow){let W=R.shadow,j=e.get(R);j.shadowIntensity=W.intensity,j.shadowBias=W.bias,j.shadowNormalBias=W.normalBias,j.shadowRadius=W.radius,j.shadowMapSize.copy(W.mapSize).multiply(W.getFrameExtents()),i.sunShadow[p]=j,i.sunShadowMap[p]=V;let ht=W.getViewportCount();for(let ft=0;ft<ht;ft++)i.sunShadowMatrix[x+ft]=W.getMatrix(ft),i.sunShadowCascade[x+ft]=W._cascadeData[ft];x+=ht,p++}i.sun[u]=k,u++}else if(R.isDirectionalLight){let k=t.get(R);if(k.color.copy(R.color).multiplyScalar(R.intensity),R.castShadow){let W=R.shadow,j=e.get(R);j.shadowIntensity=W.intensity,j.shadowBias=W.bias,j.shadowNormalBias=W.normalBias,j.shadowRadius=W.radius,j.shadowMapSize=W.mapSize,i.directionalShadow[m]=j,i.directionalShadowMap[m]=V,i.directionalShadowMatrix[m]=R.shadow.matrix,S++}i.directional[m]=k,m++}else if(R.isSpotLight){let k=t.get(R);k.position.setFromMatrixPosition(R.matrixWorld),k.color.copy(N).multiplyScalar(O),k.distance=F,k.coneCos=Math.cos(R.angle),k.penumbraCos=Math.cos(R.angle*(1-R.penumbra)),k.decay=R.decay,i.spot[b]=k;let W=R.shadow;if(R.map&&(i.spotLightMap[y]=R.map,y++,W.updateMatrices(R),R.castShadow&&A++),i.spotLightMatrix[b]=W.matrix,R.castShadow){let j=e.get(R);j.shadowIntensity=W.intensity,j.shadowBias=W.bias,j.shadowNormalBias=W.normalBias,j.shadowRadius=W.radius,j.shadowMapSize=W.mapSize,i.spotShadow[b]=j,i.spotShadowMap[b]=V,P++}b++}else if(R.isRectAreaLight){let k=t.get(R);k.color.copy(N).multiplyScalar(O),k.halfWidth.set(R.width*.5,0,0),k.halfHeight.set(0,R.height*.5,0),i.rectArea[T]=k,T++}else if(R.isPointLight){let k=t.get(R);if(k.color.copy(R.color).multiplyScalar(R.intensity),k.distance=R.distance,k.decay=R.decay,R.castShadow){let W=R.shadow,j=e.get(R);j.shadowIntensity=W.intensity,j.shadowBias=W.bias,j.shadowNormalBias=W.normalBias,j.shadowRadius=W.radius,j.shadowMapSize=W.mapSize,j.shadowCameraNear=W.camera.near,j.shadowCameraFar=W.camera.far,i.pointShadow[g]=j,i.pointShadowMap[g]=V,i.pointShadowMatrix[g]=R.shadow.matrix,C++}i.point[g]=k,g++}else if(R.isHemisphereLight){let k=t.get(R);k.skyColor.copy(R.color).multiplyScalar(O),k.groundColor.copy(R.groundColor).multiplyScalar(O),i.hemi[v]=k,v++}}T>0&&(n.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=Mt.LTC_FLOAT_1,i.rectAreaLTC2=Mt.LTC_FLOAT_2):(i.rectAreaLTC1=Mt.LTC_HALF_1,i.rectAreaLTC2=Mt.LTC_HALF_2)),i.ambient[0]=h,i.ambient[1]=f,i.ambient[2]=d;let I=i.hash;(I.sunLength!==u||I.directionalLength!==m||I.pointLength!==g||I.spotLength!==b||I.rectAreaLength!==T||I.hemiLength!==v||I.numSunShadows!==p||I.numDirectionalShadows!==S||I.numPointShadows!==C||I.numSpotShadows!==P||I.numSpotMaps!==y||I.numLightProbes!==U)&&(i.sun.length=u,i.directional.length=m,i.spot.length=b,i.rectArea.length=T,i.point.length=g,i.hemi.length=v,i.sunShadow.length=p,i.sunShadowMap.length=p,i.sunShadowMatrix.length=x,i.sunShadowCascade.length=x,i.directionalShadow.length=S,i.directionalShadowMap.length=S,i.directionalShadowMatrix.length=S,i.pointShadow.length=C,i.pointShadowMap.length=C,i.pointShadowMatrix.length=C,i.spotShadow.length=P,i.spotShadowMap.length=P,i.spotLightMatrix.length=P+y-A,i.spotLightMap.length=y,i.numSpotLightShadowsWithMaps=A,i.numLightProbes=U,I.sunLength=u,I.directionalLength=m,I.pointLength=g,I.spotLength=b,I.rectAreaLength=T,I.hemiLength=v,I.numSunShadows=p,I.numDirectionalShadows=S,I.numPointShadows=C,I.numSpotShadows=P,I.numSpotMaps=y,I.numLightProbes=U,i.version=Ov++)}function l(c,h){let f=0,d=0,u=0,p=0,x=0,m=0,g=h.matrixWorldInverse;for(let b=0,T=c.length;b<T;b++){let v=c[b];if(v.isSunLight){let S=i.sun[f];S.direction.setFromMatrixPosition(v.matrixWorld),S.direction.transformDirection(g),f++}else if(v.isDirectionalLight){let S=i.directional[d];S.direction.setFromMatrixPosition(v.matrixWorld),s.setFromMatrixPosition(v.target.matrixWorld),S.direction.sub(s),S.direction.transformDirection(g),d++}else if(v.isSpotLight){let S=i.spot[p];S.position.setFromMatrixPosition(v.matrixWorld),S.position.applyMatrix4(g),S.direction.setFromMatrixPosition(v.matrixWorld),s.setFromMatrixPosition(v.target.matrixWorld),S.direction.sub(s),S.direction.transformDirection(g),p++}else if(v.isRectAreaLight){let S=i.rectArea[x];S.position.setFromMatrixPosition(v.matrixWorld),S.position.applyMatrix4(g),o.identity(),r.copy(v.matrixWorld),r.premultiply(g),o.extractRotation(r),S.halfWidth.set(v.width*.5,0,0),S.halfHeight.set(0,v.height*.5,0),S.halfWidth.applyMatrix4(o),S.halfHeight.applyMatrix4(o),x++}else if(v.isPointLight){let S=i.point[u];S.position.setFromMatrixPosition(v.matrixWorld),S.position.applyMatrix4(g),u++}else if(v.isHemisphereLight){let S=i.hemi[m];S.direction.setFromMatrixPosition(v.matrixWorld),S.direction.transformDirection(g),m++}}}return{setup:a,setupView:l,state:i}}function Yd(n){let t=new kv(n),e=[],i=[],s=[];function r(d){f.camera=d,e.length=0,i.length=0,s.length=0}function o(d){e.push(d)}function a(d){i.push(d)}function l(d){s.push(d)}function c(){t.setup(e)}function h(d){t.setupView(e,d)}let f={lightsArray:e,shadowsArray:i,lightProbeGridArray:s,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:r,state:f,setupLights:c,setupLightsView:h,pushLight:o,pushShadow:a,pushLightProbeGrid:l}}function zv(n){let t=new WeakMap;function e(s,r=0){let o=t.get(s),a;return o===void 0?(a=new Yd(n),t.set(s,[a])):r>=o.length?(a=new Yd(n),o.push(a)):a=o[r],a}function i(){t=new WeakMap}return{get:e,dispose:i}}var Hv=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Vv=`uniform sampler2D shadow_pass;
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
}`,Gv=[new D(1,0,0),new D(-1,0,0),new D(0,1,0),new D(0,-1,0),new D(0,0,1),new D(0,0,-1)],Wv=[new D(0,-1,0),new D(0,-1,0),new D(0,0,1),new D(0,0,-1),new D(0,-1,0),new D(0,-1,0)],Zd=new re,oo=new D,wh=new D;function Xv(n,t,e){let i=new Cs,s=new tt,r=new tt,o=new xe,a=new Ma,l=new ba,c={},h=e.maxTextureSize,f={[An]:Ye,[Ye]:An,[Le]:Le},d=new le({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new tt},radius:{value:4}},vertexShader:Hv,fragmentShader:Vv}),u=d.clone();u.defines.HORIZONTAL_PASS=1;let p=new we;p.setAttribute("position",new Ue(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let x=new Wt(p,d),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Tn;let g=this.type;this.render=function(C,P,y){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||C.length===0)return;this.type===Gu&&(qt("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead."),this.type=Tn);let A=n.getRenderTarget(),U=n.getActiveCubeFace(),I=n.getActiveMipmapLevel(),M=n.state;M.setBlending(Ae),M.buffers.depth.getReversed()===!0?M.buffers.color.setClear(0,0,0,0):M.buffers.color.setClear(1,1,1,1),M.buffers.depth.setTest(!0),M.setScissorTest(!1);let E=g!==this.type;E&&P.traverse(function(R){R.material&&(Array.isArray(R.material)?R.material.forEach(N=>N.needsUpdate=!0):R.material.needsUpdate=!0)});for(let R=0,N=C.length;R<N;R++){let O=C[R],F=O.shadow;if(F===void 0){qt("WebGLShadowMap:",O,"has no shadow.");continue}if(F.autoUpdate===!1&&F.needsUpdate===!1)continue;s.copy(F.mapSize);let V=F.getFrameExtents();s.multiply(V),r.copy(F.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(r.x=Math.floor(h/V.x),s.x=r.x*V.x,F.mapSize.x=r.x),s.y>h&&(r.y=Math.floor(h/V.y),s.y=r.y*V.y,F.mapSize.y=r.y));let k=n.state.buffers.depth.getReversed();if(F.camera._reversedDepth=k,F.map===null||E===!0){if(F.map!==null&&(F.map.depthTexture!==null&&(F.map.depthTexture.dispose(),F.map.depthTexture=null),F.map.dispose()),this.type===Us){if(O.isPointLight){qt("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}F.map=new he(s.x,s.y,{format:In,type:ve,minFilter:Fe,magFilter:Fe,generateMipmaps:!1}),F.map.texture.name=O.name+".shadowMap",F.map.depthTexture=new Hi(s.x,s.y,Ii),F.map.depthTexture.name=O.name+".shadowMapDepth",F.map.depthTexture.format=ki,F.map.depthTexture.compareFunction=null,F.map.depthTexture.minFilter=Se,F.map.depthTexture.magFilter=Se}else O.isPointLight?(F.map=new Al(s.x),F.map.depthTexture=new pa(s.x,Li)):(F.map=new he(s.x,s.y),F.map.depthTexture=new Hi(s.x,s.y,Li)),F.map.depthTexture.name=O.name+".shadowMap",F.map.depthTexture.format=ki,this.type===Tn?(F.map.depthTexture.compareFunction=k?wl:Sl,F.map.depthTexture.minFilter=Fe,F.map.depthTexture.magFilter=Fe):(F.map.depthTexture.compareFunction=null,F.map.depthTexture.minFilter=Se,F.map.depthTexture.magFilter=Se);F.camera.updateProjectionMatrix()}F.map.isWebGLCubeRenderTarget!==!0&&(F.map.width!==s.x||F.map.height!==s.y)&&F.map.setSize(s.x,s.y);let W=F.map.isWebGLCubeRenderTarget?6:F.getViewportCount();O.isPointLight!==!0&&F.updateMatrices(O,y);for(let j=0;j<W;j++){let ht=F.getCamera(j);if(O.isPointLight){let ft=F.camera,At=F.matrix,wt=O.distance||ft.far;wt!==ft.far&&(ft.far=wt,ft.updateProjectionMatrix()),oo.setFromMatrixPosition(O.matrixWorld),ft.position.copy(oo),wh.copy(ft.position),wh.add(Gv[j]),ft.up.copy(Wv[j]),ft.lookAt(wh),ft.updateMatrixWorld(),At.makeTranslation(-oo.x,-oo.y,-oo.z),Zd.multiplyMatrices(ft.projectionMatrix,ft.matrixWorldInverse),F._frustum.setFromProjectionMatrix(Zd,ft.coordinateSystem,ft.reversedDepth)}if(F.map.isWebGLCubeRenderTarget)n.setRenderTarget(F.map,j),n.clear();else{j===0&&(n.setRenderTarget(F.map),n.clear());let ft=F.getViewport(j);o.set(r.x*ft.x,r.y*ft.y,r.x*ft.z,r.y*ft.w),M.viewport(o)}i=F.getFrustum(j),v(P,y,ht,O,this.type)}F.isPointLightShadow!==!0&&this.type===Us&&b(F,y),F.needsUpdate=!1}g=this.type,m.needsUpdate=!1,n.setRenderTarget(A,U,I)};function b(C,P){let y=t.update(x);d.defines.VSM_SAMPLES!==C.blurSamples&&(d.defines.VSM_SAMPLES=C.blurSamples,u.defines.VSM_SAMPLES=C.blurSamples,d.needsUpdate=!0,u.needsUpdate=!0),C.mapPass===null?C.mapPass=new he(s.x,s.y,{format:In,type:ve}):(C.mapPass.width!==C.map.width||C.mapPass.height!==C.map.height)&&C.mapPass.setSize(C.map.width,C.map.height),d.uniforms.shadow_pass.value=C.map.depthTexture,d.uniforms.resolution.value.set(C.map.width,C.map.height),d.uniforms.radius.value=C.radius,n.setRenderTarget(C.mapPass),n.clear(),n.renderBufferDirect(P,null,y,d,x,null),u.uniforms.shadow_pass.value=C.mapPass.texture,u.uniforms.resolution.value.set(C.map.width,C.map.height),u.uniforms.radius.value=C.radius,n.setRenderTarget(C.map),n.clear(),n.renderBufferDirect(P,null,y,u,x,null)}function T(C,P,y,A){let U=null,I=y.isPointLight===!0?C.customDistanceMaterial:C.customDepthMaterial;if(I!==void 0)U=I;else if(U=y.isPointLight===!0?l:a,n.localClippingEnabled&&P.clipShadows===!0&&Array.isArray(P.clippingPlanes)&&P.clippingPlanes.length!==0||P.displacementMap&&P.displacementScale!==0||P.alphaMap&&P.alphaTest>0||P.map&&P.alphaTest>0||P.alphaToCoverage===!0){let M=U.uuid,E=P.uuid,R=c[M];R===void 0&&(R={},c[M]=R);let N=R[E];N===void 0&&(N=U.clone(),R[E]=N,P.addEventListener("dispose",S)),U=N}if(U.visible=P.visible,U.wireframe=P.wireframe,A===Us?U.side=P.shadowSide!==null?P.shadowSide:P.side:U.side=P.shadowSide!==null?P.shadowSide:f[P.side],U.alphaMap=P.alphaMap,U.alphaTest=P.alphaToCoverage===!0?.5:P.alphaTest,U.map=P.map,U.clipShadows=P.clipShadows,U.clippingPlanes=P.clippingPlanes,U.clipIntersection=P.clipIntersection,U.displacementMap=P.displacementMap,U.displacementScale=P.displacementScale,U.displacementBias=P.displacementBias,U.wireframeLinewidth=P.wireframeLinewidth,U.linewidth=P.linewidth,y.isPointLight===!0&&U.isMeshDistanceMaterial===!0){let M=n.properties.get(U);M.light=y}return U}function v(C,P,y,A,U){if(C.visible===!1)return;if(C.layers.test(P.layers)&&(C.isMesh||C.isLine||C.isPoints)&&(C.castShadow||C.receiveShadow&&U===Us)&&(!C.frustumCulled||C.intersectsFrustum(i))){C.modelViewMatrix.multiplyMatrices(y.matrixWorldInverse,C.matrixWorld);let E=t.update(C),R=C.material;if(Array.isArray(R)){let N=E.groups;for(let O=0,F=N.length;O<F;O++){let V=N[O],k=R[V.materialIndex];if(k&&k.visible){let W=T(C,k,A,U);C.onBeforeShadow(n,C,P,y,E,W,V),n.renderBufferDirect(y,null,E,W,C,V),C.onAfterShadow(n,C,P,y,E,W,V)}}}else if(R.visible){let N=T(C,R,A,U);C.onBeforeShadow(n,C,P,y,E,N,null),n.renderBufferDirect(y,null,E,N,C,null),C.onAfterShadow(n,C,P,y,E,N,null)}}let M=C.children;for(let E=0,R=M.length;E<R;E++)v(M[E],P,y,A,U)}function S(C){C.target.removeEventListener("dispose",S);for(let y in c){let A=c[y],U=C.target.uuid;U in A&&(A[U].dispose(),delete A[U])}}}function qv(n,t){function e(){let H=!1,_t=new xe,it=null,yt=new xe(0,0,0,0);return{setMask:function(Et){it!==Et&&!H&&(n.colorMask(Et,Et,Et,Et),it=Et)},setLocked:function(Et){H=Et},setClear:function(Et,lt,Vt,Ot,_e){_e===!0&&(Et*=Ot,lt*=Ot,Vt*=Ot),_t.set(Et,lt,Vt,Ot),yt.equals(_t)===!1&&(n.clearColor(Et,lt,Vt,Ot),yt.copy(_t))},reset:function(){H=!1,it=null,yt.set(-1,0,0,0)}}}function i(){let H=!1,_t=!1,it=null,yt=null,Et=null;return{setReversed:function(lt){if(_t!==lt){let Vt=t.get("EXT_clip_control");lt?Vt.clipControlEXT(Vt.LOWER_LEFT_EXT,Vt.ZERO_TO_ONE_EXT):Vt.clipControlEXT(Vt.LOWER_LEFT_EXT,Vt.NEGATIVE_ONE_TO_ONE_EXT),_t=lt;let Ot=Et;Et=null,this.setClear(Ot)}},getReversed:function(){return _t},setTest:function(lt){lt?K(n.DEPTH_TEST):dt(n.DEPTH_TEST)},setMask:function(lt){it!==lt&&!H&&(n.depthMask(lt),it=lt)},setFunc:function(lt){if(_t&&(lt=_d[lt]),yt!==lt){switch(lt){case $o:n.depthFunc(n.NEVER);break;case ta:n.depthFunc(n.ALWAYS);break;case ea:n.depthFunc(n.LESS);break;case vs:n.depthFunc(n.LEQUAL);break;case ia:n.depthFunc(n.EQUAL);break;case na:n.depthFunc(n.GEQUAL);break;case sa:n.depthFunc(n.GREATER);break;case ra:n.depthFunc(n.NOTEQUAL);break;default:n.depthFunc(n.LEQUAL)}yt=lt}},setLocked:function(lt){H=lt},setClear:function(lt){Et!==lt&&(Et=lt,_t&&(lt=1-lt),n.clearDepth(lt))},reset:function(){H=!1,it=null,yt=null,Et=null,_t=!1}}}function s(){let H=!1,_t=null,it=null,yt=null,Et=null,lt=null,Vt=null,Ot=null,_e=null;return{setTest:function(ue){H||(ue?K(n.STENCIL_TEST):dt(n.STENCIL_TEST))},setMask:function(ue){_t!==ue&&!H&&(n.stencilMask(ue),_t=ue)},setFunc:function(ue,Si,Ni){(it!==ue||yt!==Si||Et!==Ni)&&(n.stencilFunc(ue,Si,Ni),it=ue,yt=Si,Et=Ni)},setOp:function(ue,Si,Ni){(lt!==ue||Vt!==Si||Ot!==Ni)&&(n.stencilOp(ue,Si,Ni),lt=ue,Vt=Si,Ot=Ni)},setLocked:function(ue){H=ue},setClear:function(ue){_e!==ue&&(n.clearStencil(ue),_e=ue)},reset:function(){H=!1,_t=null,it=null,yt=null,Et=null,lt=null,Vt=null,Ot=null,_e=null}}}let r=new e,o=new i,a=new s,l=new WeakMap,c=new WeakMap,h={},f={},d={},u=new WeakMap,p=[],x=null,m=!1,g=null,b=null,T=null,v=null,S=null,C=null,P=null,y=new Ft(0,0,0),A=0,U=!1,I=null,M=null,E=null,R=null,N=null,O=n.getParameter(n.MAX_COMBINED_TEXTURE_IMAGE_UNITS),F=!1,V=0,k=n.getParameter(n.VERSION);k.indexOf("WebGL")!==-1?(V=parseFloat(/^WebGL (\d)/.exec(k)[1]),F=V>=1):k.indexOf("OpenGL ES")!==-1&&(V=parseFloat(/^OpenGL ES (\d)/.exec(k)[1]),F=V>=2);let W=null,j={},ht=n.getParameter(n.SCISSOR_BOX),ft=n.getParameter(n.VIEWPORT),At=new xe().fromArray(ht),wt=new xe().fromArray(ft);function Gt(H,_t,it,yt){let Et=new Uint8Array(4),lt=n.createTexture();n.bindTexture(H,lt),n.texParameteri(H,n.TEXTURE_MIN_FILTER,n.NEAREST),n.texParameteri(H,n.TEXTURE_MAG_FILTER,n.NEAREST);for(let Vt=0;Vt<it;Vt++)H===n.TEXTURE_3D||H===n.TEXTURE_2D_ARRAY?n.texImage3D(_t,0,n.RGBA,1,1,yt,0,n.RGBA,n.UNSIGNED_BYTE,Et):n.texImage2D(_t+Vt,0,n.RGBA,1,1,0,n.RGBA,n.UNSIGNED_BYTE,Et);return lt}let Z={};Z[n.TEXTURE_2D]=Gt(n.TEXTURE_2D,n.TEXTURE_2D,1),Z[n.TEXTURE_CUBE_MAP]=Gt(n.TEXTURE_CUBE_MAP,n.TEXTURE_CUBE_MAP_POSITIVE_X,6),Z[n.TEXTURE_2D_ARRAY]=Gt(n.TEXTURE_2D_ARRAY,n.TEXTURE_2D_ARRAY,1,1),Z[n.TEXTURE_3D]=Gt(n.TEXTURE_3D,n.TEXTURE_3D,1,1),r.setClear(0,0,0,1),o.setClear(1),a.setClear(0),K(n.DEPTH_TEST),o.setFunc(vs),ot(!1),ct(qc),K(n.CULL_FACE),at(Ae);function K(H){h[H]!==!0&&(n.enable(H),h[H]=!0)}function dt(H){h[H]!==!1&&(n.disable(H),h[H]=!1)}function Pt(H,_t){return d[H]!==_t?(n.bindFramebuffer(H,_t),d[H]=_t,H===n.DRAW_FRAMEBUFFER&&(d[n.FRAMEBUFFER]=_t),H===n.FRAMEBUFFER&&(d[n.DRAW_FRAMEBUFFER]=_t),!0):!1}function vt(H,_t){let it=p,yt=!1;if(H){it=u.get(_t),it===void 0&&(it=[],u.set(_t,it));let Et=H.textures;if(it.length!==Et.length||it[0]!==n.COLOR_ATTACHMENT0){for(let lt=0,Vt=Et.length;lt<Vt;lt++)it[lt]=n.COLOR_ATTACHMENT0+lt;it.length=Et.length,yt=!0}}else it[0]!==n.BACK&&(it[0]=n.BACK,yt=!0);yt&&n.drawBuffers(it)}function Bt(H){return x!==H?(n.useProgram(H),x=H,!0):!1}let ee={[_i]:n.FUNC_ADD,[Wu]:n.FUNC_SUBTRACT,[Xu]:n.FUNC_REVERSE_SUBTRACT};ee[qu]=n.MIN,ee[Yu]=n.MAX;let et={[qn]:n.ZERO,[Zu]:n.ONE,[ju]:n.SRC_COLOR,[jc]:n.SRC_ALPHA,[$u]:n.SRC_ALPHA_SATURATE,[Wr]:n.DST_COLOR,[Gr]:n.DST_ALPHA,[Ku]:n.ONE_MINUS_SRC_COLOR,[Kc]:n.ONE_MINUS_SRC_ALPHA,[Qu]:n.ONE_MINUS_DST_COLOR,[Ju]:n.ONE_MINUS_DST_ALPHA,[td]:n.CONSTANT_COLOR,[ed]:n.ONE_MINUS_CONSTANT_COLOR,[id]:n.CONSTANT_ALPHA,[nd]:n.ONE_MINUS_CONSTANT_ALPHA};function at(H,_t,it,yt,Et,lt,Vt,Ot,_e,ue){if(H===Ae){m===!0&&(dt(n.BLEND),m=!1);return}if(m===!1&&(K(n.BLEND),m=!0),H!==Fa){if(H!==g||ue!==U){if((b!==_i||S!==_i)&&(n.blendEquation(n.FUNC_ADD),b=_i,S=_i),ue)switch(H){case Fs:n.blendFuncSeparate(n.ONE,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case Xn:n.blendFunc(n.ONE,n.ONE);break;case Yc:n.blendFuncSeparate(n.ZERO,n.ONE_MINUS_SRC_COLOR,n.ZERO,n.ONE);break;case Zc:n.blendFuncSeparate(n.DST_COLOR,n.ONE_MINUS_SRC_ALPHA,n.ZERO,n.ONE);break;default:Yt("WebGLState: Invalid blending: ",H);break}else switch(H){case Fs:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE_MINUS_SRC_ALPHA,n.ONE,n.ONE_MINUS_SRC_ALPHA);break;case Xn:n.blendFuncSeparate(n.SRC_ALPHA,n.ONE,n.ONE,n.ONE);break;case Yc:Yt("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Zc:Yt("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:Yt("WebGLState: Invalid blending: ",H);break}T=null,v=null,C=null,P=null,y.set(0,0,0),A=0,g=H,U=ue}return}Et=Et||_t,lt=lt||it,Vt=Vt||yt,(_t!==b||Et!==S)&&(n.blendEquationSeparate(ee[_t],ee[Et]),b=_t,S=Et),(it!==T||yt!==v||lt!==C||Vt!==P)&&(n.blendFuncSeparate(et[it],et[yt],et[lt],et[Vt]),T=it,v=yt,C=lt,P=Vt),(Ot.equals(y)===!1||_e!==A)&&(n.blendColor(Ot.r,Ot.g,Ot.b,_e),y.copy(Ot),A=_e),g=H,U=!1}function st(H,_t){H.side===Le?dt(n.CULL_FACE):K(n.CULL_FACE);let it=H.side===Ye;_t&&(it=!it),ot(it),H.blending===Fs&&H.transparent===!1?at(Ae):at(H.blending,H.blendEquation,H.blendSrc,H.blendDst,H.blendEquationAlpha,H.blendSrcAlpha,H.blendDstAlpha,H.blendColor,H.blendAlpha,H.premultipliedAlpha),o.setFunc(H.depthFunc),o.setTest(H.depthTest),o.setMask(H.depthWrite),r.setMask(H.colorWrite);let yt=H.stencilWrite;a.setTest(yt),yt&&(a.setMask(H.stencilWriteMask),a.setFunc(H.stencilFunc,H.stencilRef,H.stencilFuncMask),a.setOp(H.stencilFail,H.stencilZFail,H.stencilZPass)),Rt(H.polygonOffset,H.polygonOffsetFactor,H.polygonOffsetUnits),H.alphaToCoverage===!0?K(n.SAMPLE_ALPHA_TO_COVERAGE):dt(n.SAMPLE_ALPHA_TO_COVERAGE)}function ot(H){I!==H&&(H?n.frontFace(n.CW):n.frontFace(n.CCW),I=H)}function ct(H){H!==Hu?(K(n.CULL_FACE),H!==M&&(H===qc?n.cullFace(n.BACK):H===Vu?n.cullFace(n.FRONT):n.cullFace(n.FRONT_AND_BACK))):dt(n.CULL_FACE),M=H}function Ut(H){H!==E&&(F&&n.lineWidth(H),E=H)}function Rt(H,_t,it){H?(K(n.POLYGON_OFFSET_FILL),(R!==_t||N!==it)&&(R=_t,N=it,o.getReversed()&&(_t=-_t),n.polygonOffset(_t,it))):dt(n.POLYGON_OFFSET_FILL)}function It(H){H?K(n.SCISSOR_TEST):dt(n.SCISSOR_TEST)}function Xt(H){H===void 0&&(H=n.TEXTURE0+O-1),W!==H&&(n.activeTexture(H),W=H)}function B(H,_t,it){it===void 0&&(W===null?it=n.TEXTURE0+O-1:it=W);let yt=j[it];yt===void 0&&(yt={type:void 0,texture:void 0},j[it]=yt),(yt.type!==H||yt.texture!==_t)&&(W!==it&&(n.activeTexture(it),W=it),n.bindTexture(H,_t||Z[H]),yt.type=H,yt.texture=_t)}function ne(){let H=j[W];H!==void 0&&H.type!==void 0&&(n.bindTexture(H.type,null),H.type=void 0,H.texture=void 0)}function jt(){try{n.compressedTexImage2D(...arguments)}catch(H){Yt("WebGLState:",H)}}function L(){try{n.compressedTexImage3D(...arguments)}catch(H){Yt("WebGLState:",H)}}function _(){try{n.texSubImage2D(...arguments)}catch(H){Yt("WebGLState:",H)}}function G(){try{n.texSubImage3D(...arguments)}catch(H){Yt("WebGLState:",H)}}function X(){try{n.compressedTexSubImage2D(...arguments)}catch(H){Yt("WebGLState:",H)}}function Q(){try{n.compressedTexSubImage3D(...arguments)}catch(H){Yt("WebGLState:",H)}}function ut(){try{n.texStorage2D(...arguments)}catch(H){Yt("WebGLState:",H)}}function pt(){try{n.texStorage3D(...arguments)}catch(H){Yt("WebGLState:",H)}}function $(){try{n.texImage2D(...arguments)}catch(H){Yt("WebGLState:",H)}}function nt(){try{n.texImage3D(...arguments)}catch(H){Yt("WebGLState:",H)}}function xt(H){return f[H]!==void 0?f[H]:n.getParameter(H)}function kt(H,_t){f[H]!==_t&&(n.pixelStorei(H,_t),f[H]=_t)}function gt(H){At.equals(H)===!1&&(n.scissor(H.x,H.y,H.z,H.w),At.copy(H))}function mt(H){wt.equals(H)===!1&&(n.viewport(H.x,H.y,H.z,H.w),wt.copy(H))}function Lt(H,_t){let it=c.get(_t);it===void 0&&(it=new WeakMap,c.set(_t,it));let yt=it.get(H);yt===void 0&&(yt=n.getUniformBlockIndex(_t,H.name),it.set(H,yt))}function Ht(H,_t){let yt=c.get(_t).get(H);l.get(_t)!==yt&&(n.uniformBlockBinding(_t,yt,H.__bindingPointIndex),l.set(_t,yt))}function Zt(){n.disable(n.BLEND),n.disable(n.CULL_FACE),n.disable(n.DEPTH_TEST),n.disable(n.POLYGON_OFFSET_FILL),n.disable(n.SCISSOR_TEST),n.disable(n.STENCIL_TEST),n.disable(n.SAMPLE_ALPHA_TO_COVERAGE),n.blendEquation(n.FUNC_ADD),n.blendFunc(n.ONE,n.ZERO),n.blendFuncSeparate(n.ONE,n.ZERO,n.ONE,n.ZERO),n.blendColor(0,0,0,0),n.colorMask(!0,!0,!0,!0),n.clearColor(0,0,0,0),n.depthMask(!0),n.depthFunc(n.LESS),o.setReversed(!1),n.clearDepth(1),n.stencilMask(4294967295),n.stencilFunc(n.ALWAYS,0,4294967295),n.stencilOp(n.KEEP,n.KEEP,n.KEEP),n.clearStencil(0),n.cullFace(n.BACK),n.frontFace(n.CCW),n.polygonOffset(0,0),n.activeTexture(n.TEXTURE0),n.bindFramebuffer(n.FRAMEBUFFER,null),n.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),n.bindFramebuffer(n.READ_FRAMEBUFFER,null),n.useProgram(null),n.lineWidth(1),n.scissor(0,0,n.canvas.width,n.canvas.height),n.viewport(0,0,n.canvas.width,n.canvas.height),n.pixelStorei(n.PACK_ALIGNMENT,4),n.pixelStorei(n.UNPACK_ALIGNMENT,4),n.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,!1),n.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),n.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,n.BROWSER_DEFAULT_WEBGL),n.pixelStorei(n.PACK_ROW_LENGTH,0),n.pixelStorei(n.PACK_SKIP_PIXELS,0),n.pixelStorei(n.PACK_SKIP_ROWS,0),n.pixelStorei(n.UNPACK_ROW_LENGTH,0),n.pixelStorei(n.UNPACK_IMAGE_HEIGHT,0),n.pixelStorei(n.UNPACK_SKIP_PIXELS,0),n.pixelStorei(n.UNPACK_SKIP_ROWS,0),n.pixelStorei(n.UNPACK_SKIP_IMAGES,0),h={},f={},W=null,j={},d={},u=new WeakMap,p=[],x=null,m=!1,g=null,b=null,T=null,v=null,S=null,C=null,P=null,y=new Ft(0,0,0),A=0,U=!1,I=null,M=null,E=null,R=null,N=null,At.set(0,0,n.canvas.width,n.canvas.height),wt.set(0,0,n.canvas.width,n.canvas.height),r.reset(),o.reset(),a.reset()}return{buffers:{color:r,depth:o,stencil:a},enable:K,disable:dt,bindFramebuffer:Pt,drawBuffers:vt,useProgram:Bt,setBlending:at,setMaterial:st,setFlipSided:ot,setCullFace:ct,setLineWidth:Ut,setPolygonOffset:Rt,setScissorTest:It,activeTexture:Xt,bindTexture:B,unbindTexture:ne,compressedTexImage2D:jt,compressedTexImage3D:L,texImage2D:$,texImage3D:nt,pixelStorei:kt,getParameter:xt,updateUBOMapping:Lt,uniformBlockBinding:Ht,texStorage2D:ut,texStorage3D:pt,texSubImage2D:_,texSubImage3D:G,compressedTexSubImage2D:X,compressedTexSubImage3D:Q,scissor:gt,viewport:mt,reset:Zt}}function Yv(n,t,e,i,s,r,o){let a=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new tt,h=new WeakMap,f=new Set,d,u=new WeakMap,p=!1;try{p=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function x(L,_){return p?new OffscreenCanvas(L,_):dr("canvas")}function m(L,_,G){let X=1,Q=jt(L);if((Q.width>G||Q.height>G)&&(X=G/Math.max(Q.width,Q.height)),X<1)if(typeof HTMLImageElement<"u"&&L instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&L instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&L instanceof ImageBitmap||typeof VideoFrame<"u"&&L instanceof VideoFrame){let ut=Math.floor(X*Q.width),pt=Math.floor(X*Q.height);d===void 0&&(d=x(ut,pt));let $=_?x(ut,pt):d;return $.width=ut,$.height=pt,$.getContext("2d").drawImage(L,0,0,ut,pt),qt("WebGLRenderer: Texture has been resized from ("+Q.width+"x"+Q.height+") to ("+ut+"x"+pt+")."),$}else return"data"in L&&qt("WebGLRenderer: Image in DataTexture is too big ("+Q.width+"x"+Q.height+")."),L;return L}function g(L){return L.generateMipmaps}function b(L){n.generateMipmap(L)}function T(L){return L.isWebGLCubeRenderTarget?n.TEXTURE_CUBE_MAP:L.isWebGL3DRenderTarget?n.TEXTURE_3D:L.isWebGLArrayRenderTarget||L.isCompressedArrayTexture?n.TEXTURE_2D_ARRAY:n.TEXTURE_2D}function v(L,_,G,X,Q,ut=!1){if(L!==null){if(n[L]!==void 0)return n[L];qt("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+L+"'")}let pt;X&&(pt=t.get("EXT_texture_norm16"),pt||qt("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let $=_;if(_===n.RED&&(G===n.FLOAT&&($=n.R32F),G===n.HALF_FLOAT&&($=n.R16F),G===n.UNSIGNED_BYTE&&($=n.R8),G===n.UNSIGNED_SHORT&&pt&&($=pt.R16_EXT),G===n.SHORT&&pt&&($=pt.R16_SNORM_EXT)),_===n.RED_INTEGER&&(G===n.UNSIGNED_BYTE&&($=n.R8UI),G===n.UNSIGNED_SHORT&&($=n.R16UI),G===n.UNSIGNED_INT&&($=n.R32UI),G===n.BYTE&&($=n.R8I),G===n.SHORT&&($=n.R16I),G===n.INT&&($=n.R32I)),_===n.RG&&(G===n.FLOAT&&($=n.RG32F),G===n.HALF_FLOAT&&($=n.RG16F),G===n.UNSIGNED_BYTE&&($=n.RG8),G===n.UNSIGNED_SHORT&&pt&&($=pt.RG16_EXT),G===n.SHORT&&pt&&($=pt.RG16_SNORM_EXT)),_===n.RG_INTEGER&&(G===n.UNSIGNED_BYTE&&($=n.RG8UI),G===n.UNSIGNED_SHORT&&($=n.RG16UI),G===n.UNSIGNED_INT&&($=n.RG32UI),G===n.BYTE&&($=n.RG8I),G===n.SHORT&&($=n.RG16I),G===n.INT&&($=n.RG32I)),_===n.RGB_INTEGER&&(G===n.UNSIGNED_BYTE&&($=n.RGB8UI),G===n.UNSIGNED_SHORT&&($=n.RGB16UI),G===n.UNSIGNED_INT&&($=n.RGB32UI),G===n.BYTE&&($=n.RGB8I),G===n.SHORT&&($=n.RGB16I),G===n.INT&&($=n.RGB32I)),_===n.RGBA_INTEGER&&(G===n.UNSIGNED_BYTE&&($=n.RGBA8UI),G===n.UNSIGNED_SHORT&&($=n.RGBA16UI),G===n.UNSIGNED_INT&&($=n.RGBA32UI),G===n.BYTE&&($=n.RGBA8I),G===n.SHORT&&($=n.RGBA16I),G===n.INT&&($=n.RGBA32I)),_===n.RGB&&(G===n.UNSIGNED_SHORT&&pt&&($=pt.RGB16_EXT),G===n.SHORT&&pt&&($=pt.RGB16_SNORM_EXT),G===n.UNSIGNED_INT_5_9_9_9_REV&&($=n.RGB9_E5),G===n.UNSIGNED_INT_10F_11F_11F_REV&&($=n.R11F_G11F_B10F)),_===n.RGBA){let nt=ut?ur:ie.getTransfer(Q);G===n.FLOAT&&($=n.RGBA32F),G===n.HALF_FLOAT&&($=n.RGBA16F),G===n.UNSIGNED_BYTE&&($=nt===ce?n.SRGB8_ALPHA8:n.RGBA8),G===n.UNSIGNED_SHORT&&pt&&($=pt.RGBA16_EXT),G===n.SHORT&&pt&&($=pt.RGBA16_SNORM_EXT),G===n.UNSIGNED_SHORT_4_4_4_4&&($=n.RGBA4),G===n.UNSIGNED_SHORT_5_5_5_1&&($=n.RGB5_A1)}return($===n.R16F||$===n.R32F||$===n.RG16F||$===n.RG32F||$===n.RGBA16F||$===n.RGBA32F)&&t.get("EXT_color_buffer_float"),$}function S(L,_){let G;return L?_===null||_===Li||_===Ln?G=n.DEPTH24_STENCIL8:_===Ii?G=n.DEPTH32F_STENCIL8:_===Os&&(G=n.DEPTH24_STENCIL8,qt("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):_===null||_===Li||_===Ln?G=n.DEPTH_COMPONENT24:_===Ii?G=n.DEPTH_COMPONENT32F:_===Os&&(G=n.DEPTH_COMPONENT16),G}function C(L,_){return g(L)===!0||L.isFramebufferTexture&&L.minFilter!==Se&&L.minFilter!==Fe?Math.log2(Math.max(_.width,_.height))+1:L.mipmaps!==void 0&&L.mipmaps.length>0?L.mipmaps.length:L.isCompressedTexture&&Array.isArray(L.image)?_.mipmaps.length:1}function P(L){let _=L.target;_.removeEventListener("dispose",P),A(_),_.isVideoTexture&&h.delete(_),_.isHTMLTexture&&f.delete(_)}function y(L){let _=L.target;_.removeEventListener("dispose",y),I(_)}function A(L){let _=i.get(L);if(_.__webglInit===void 0)return;let G=L.source,X=u.get(G);if(X){let Q=X[_.__cacheKey];Q.usedTimes--,Q.usedTimes===0&&U(L),Object.keys(X).length===0&&u.delete(G)}i.remove(L)}function U(L){let _=i.get(L);n.deleteTexture(_.__webglTexture);let G=L.source,X=u.get(G);delete X[_.__cacheKey],o.memory.textures--}function I(L){let _=i.get(L);if(L.depthTexture&&(L.depthTexture.dispose(),i.remove(L.depthTexture)),L.isWebGLCubeRenderTarget)for(let X=0;X<6;X++){if(Array.isArray(_.__webglFramebuffer[X]))for(let Q=0;Q<_.__webglFramebuffer[X].length;Q++)n.deleteFramebuffer(_.__webglFramebuffer[X][Q]);else n.deleteFramebuffer(_.__webglFramebuffer[X]);_.__webglDepthbuffer&&n.deleteRenderbuffer(_.__webglDepthbuffer[X])}else{if(Array.isArray(_.__webglFramebuffer))for(let X=0;X<_.__webglFramebuffer.length;X++)n.deleteFramebuffer(_.__webglFramebuffer[X]);else n.deleteFramebuffer(_.__webglFramebuffer);if(_.__webglDepthbuffer&&n.deleteRenderbuffer(_.__webglDepthbuffer),_.__webglMultisampledFramebuffer&&n.deleteFramebuffer(_.__webglMultisampledFramebuffer),_.__webglColorRenderbuffer)for(let X=0;X<_.__webglColorRenderbuffer.length;X++)_.__webglColorRenderbuffer[X]&&n.deleteRenderbuffer(_.__webglColorRenderbuffer[X]);_.__webglDepthRenderbuffer&&n.deleteRenderbuffer(_.__webglDepthRenderbuffer)}let G=L.textures;for(let X=0,Q=G.length;X<Q;X++){let ut=i.get(G[X]);ut.__webglTexture&&(n.deleteTexture(ut.__webglTexture),o.memory.textures--),i.remove(G[X])}i.remove(L)}let M=0;function E(){M=0}function R(){return M}function N(L){M=L}function O(){let L=M;return L>=s.maxTextures&&qt("WebGLTextures: Trying to use "+(L+1)+" texture units while this GPU supports only "+s.maxTextures),M+=1,L}function F(L){let _=[];return _.push(L.wrapS),_.push(L.wrapT),_.push(L.wrapR||0),_.push(L.magFilter),_.push(L.minFilter),_.push(L.anisotropy),_.push(L.internalFormat),_.push(L.format),_.push(L.type),_.push(L.generateMipmaps),_.push(L.premultiplyAlpha),_.push(L.flipY),_.push(L.unpackAlignment),_.push(L.colorSpace),_.join()}function V(L,_){let G=i.get(L);if(L.isVideoTexture&&B(L),L.isRenderTargetTexture===!1&&L.isExternalTexture!==!0&&L.version>0&&G.__version!==L.version){let X=L.image;if(X===null)qt("WebGLRenderer: Texture marked for update but no image data found.");else if(X.complete===!1)qt("WebGLRenderer: Texture marked for update but image is incomplete");else{dt(G,L,_);return}}else L.isExternalTexture&&(G.__webglTexture=L.sourceTexture?L.sourceTexture:null);e.bindTexture(n.TEXTURE_2D,G.__webglTexture,n.TEXTURE0+_)}function k(L,_){let G=i.get(L);if(L.isRenderTargetTexture===!1&&L.version>0&&G.__version!==L.version){dt(G,L,_);return}else L.isExternalTexture&&(G.__webglTexture=L.sourceTexture?L.sourceTexture:null);e.bindTexture(n.TEXTURE_2D_ARRAY,G.__webglTexture,n.TEXTURE0+_)}function W(L,_){let G=i.get(L);if(L.isRenderTargetTexture===!1&&L.version>0&&G.__version!==L.version){dt(G,L,_);return}e.bindTexture(n.TEXTURE_3D,G.__webglTexture,n.TEXTURE0+_)}function j(L,_){let G=i.get(L);if(L.isCubeDepthTexture!==!0&&L.version>0&&G.__version!==L.version){Pt(G,L,_);return}e.bindTexture(n.TEXTURE_CUBE_MAP,G.__webglTexture,n.TEXTURE0+_)}let ht={[hi]:n.REPEAT,[xi]:n.CLAMP_TO_EDGE,[oa]:n.MIRRORED_REPEAT},ft={[Se]:n.NEAREST,[od]:n.NEAREST_MIPMAP_NEAREST,[Qr]:n.NEAREST_MIPMAP_LINEAR,[Fe]:n.LINEAR,[za]:n.LINEAR_MIPMAP_NEAREST,[Pn]:n.LINEAR_MIPMAP_LINEAR},At={[hd]:n.NEVER,[md]:n.ALWAYS,[ud]:n.LESS,[Sl]:n.LEQUAL,[dd]:n.EQUAL,[wl]:n.GEQUAL,[fd]:n.GREATER,[pd]:n.NOTEQUAL};function wt(L,_){if(_.type===Ii&&t.has("OES_texture_float_linear")===!1&&(_.magFilter===Fe||_.magFilter===za||_.magFilter===Qr||_.magFilter===Pn||_.minFilter===Fe||_.minFilter===za||_.minFilter===Qr||_.minFilter===Pn)&&qt("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),n.texParameteri(L,n.TEXTURE_WRAP_S,ht[_.wrapS]),n.texParameteri(L,n.TEXTURE_WRAP_T,ht[_.wrapT]),(L===n.TEXTURE_3D||L===n.TEXTURE_2D_ARRAY)&&n.texParameteri(L,n.TEXTURE_WRAP_R,ht[_.wrapR]),n.texParameteri(L,n.TEXTURE_MAG_FILTER,ft[_.magFilter]),n.texParameteri(L,n.TEXTURE_MIN_FILTER,ft[_.minFilter]),_.compareFunction&&(n.texParameteri(L,n.TEXTURE_COMPARE_MODE,n.COMPARE_REF_TO_TEXTURE),n.texParameteri(L,n.TEXTURE_COMPARE_FUNC,At[_.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(_.magFilter===Se||_.minFilter!==Qr&&_.minFilter!==Pn||_.type===Ii&&t.has("OES_texture_float_linear")===!1)return;if(_.anisotropy>1||i.get(_).__currentAnisotropy){let G=t.get("EXT_texture_filter_anisotropic");n.texParameterf(L,G.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(_.anisotropy,s.getMaxAnisotropy())),i.get(_).__currentAnisotropy=_.anisotropy}}}function Gt(L,_){let G=!1;L.__webglInit===void 0&&(L.__webglInit=!0,_.addEventListener("dispose",P));let X=_.source,Q=u.get(X);Q===void 0&&(Q={},u.set(X,Q));let ut=F(_);if(ut!==L.__cacheKey){Q[ut]===void 0&&(Q[ut]={texture:n.createTexture(),usedTimes:0},o.memory.textures++,G=!0),Q[ut].usedTimes++;let pt=Q[L.__cacheKey];pt!==void 0&&(Q[L.__cacheKey].usedTimes--,pt.usedTimes===0&&U(_)),L.__cacheKey=ut,L.__webglTexture=Q[ut].texture}return G}function Z(L,_,G){return Math.floor(Math.floor(L/G)/_)}function K(L,_,G,X){let ut=L.updateRanges;if(ut.length===0)e.texSubImage2D(n.TEXTURE_2D,0,0,0,_.width,_.height,G,X,_.data);else{ut.sort((kt,gt)=>kt.start-gt.start);let pt=0;for(let kt=1;kt<ut.length;kt++){let gt=ut[pt],mt=ut[kt],Lt=gt.start+gt.count,Ht=Z(mt.start,_.width,4),Zt=Z(gt.start,_.width,4);mt.start<=Lt+1&&Ht===Zt&&Z(mt.start+mt.count-1,_.width,4)===Ht?gt.count=Math.max(gt.count,mt.start+mt.count-gt.start):(++pt,ut[pt]=mt)}ut.length=pt+1;let $=e.getParameter(n.UNPACK_ROW_LENGTH),nt=e.getParameter(n.UNPACK_SKIP_PIXELS),xt=e.getParameter(n.UNPACK_SKIP_ROWS);e.pixelStorei(n.UNPACK_ROW_LENGTH,_.width);for(let kt=0,gt=ut.length;kt<gt;kt++){let mt=ut[kt],Lt=Math.floor(mt.start/4),Ht=Math.ceil(mt.count/4),Zt=Lt%_.width,H=Math.floor(Lt/_.width),_t=Ht,it=1;e.pixelStorei(n.UNPACK_SKIP_PIXELS,Zt),e.pixelStorei(n.UNPACK_SKIP_ROWS,H),e.texSubImage2D(n.TEXTURE_2D,0,Zt,H,_t,it,G,X,_.data)}L.clearUpdateRanges(),e.pixelStorei(n.UNPACK_ROW_LENGTH,$),e.pixelStorei(n.UNPACK_SKIP_PIXELS,nt),e.pixelStorei(n.UNPACK_SKIP_ROWS,xt)}}function dt(L,_,G){let X=n.TEXTURE_2D;(_.isDataArrayTexture||_.isCompressedArrayTexture)&&(X=n.TEXTURE_2D_ARRAY),_.isData3DTexture&&(X=n.TEXTURE_3D);let Q=Gt(L,_),ut=_.source;e.bindTexture(X,L.__webglTexture,n.TEXTURE0+G);let pt=i.get(ut);if(ut.version!==pt.__version||Q===!0){if(e.activeTexture(n.TEXTURE0+G),(typeof ImageBitmap<"u"&&_.image instanceof ImageBitmap)===!1){let it=ie.getPrimaries(ie.workingColorSpace),yt=_.colorSpace===Di?null:ie.getPrimaries(_.colorSpace),Et=_.colorSpace===Di||it===yt?n.NONE:n.BROWSER_DEFAULT_WEBGL;e.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,_.flipY),e.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,_.premultiplyAlpha),e.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,Et)}e.pixelStorei(n.UNPACK_ALIGNMENT,_.unpackAlignment);let nt=m(_.image,!1,s.maxTextureSize);nt=ne(_,nt);let xt=r.convert(_.format,_.colorSpace),kt=r.convert(_.type),gt=v(_.internalFormat,xt,kt,_.normalized,_.colorSpace,_.isVideoTexture);wt(X,_);let mt,Lt=_.mipmaps,Ht=_.isVideoTexture!==!0,Zt=pt.__version===void 0||Q===!0,H=ut.dataReady,_t=C(_,nt);if(_.isDepthTexture)gt=S(_.format===Vi,_.type),Zt&&(Ht?e.texStorage2D(n.TEXTURE_2D,1,gt,nt.width,nt.height):e.texImage2D(n.TEXTURE_2D,0,gt,nt.width,nt.height,0,xt,kt,null));else if(_.isDataTexture)if(Lt.length>0){Ht&&Zt&&e.texStorage2D(n.TEXTURE_2D,_t,gt,Lt[0].width,Lt[0].height);for(let it=0,yt=Lt.length;it<yt;it++)mt=Lt[it],Ht?H&&e.texSubImage2D(n.TEXTURE_2D,it,0,0,mt.width,mt.height,xt,kt,mt.data):e.texImage2D(n.TEXTURE_2D,it,gt,mt.width,mt.height,0,xt,kt,mt.data);_.generateMipmaps=!1}else Ht?(Zt&&e.texStorage2D(n.TEXTURE_2D,_t,gt,nt.width,nt.height),H&&K(_,nt,xt,kt)):e.texImage2D(n.TEXTURE_2D,0,gt,nt.width,nt.height,0,xt,kt,nt.data);else if(_.isCompressedTexture)if(_.isCompressedArrayTexture){Ht&&Zt&&e.texStorage3D(n.TEXTURE_2D_ARRAY,_t,gt,Lt[0].width,Lt[0].height,nt.depth);for(let it=0,yt=Lt.length;it<yt;it++)if(mt=Lt[it],_.format!==ri)if(xt!==null)if(Ht){if(H)if(_.layerUpdates.size>0){let Et=fh(mt.width,mt.height,_.format,_.type);for(let lt of _.layerUpdates){let Vt=mt.data.subarray(lt*Et/mt.data.BYTES_PER_ELEMENT,(lt+1)*Et/mt.data.BYTES_PER_ELEMENT);e.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,it,0,0,lt,mt.width,mt.height,1,xt,Vt)}}else e.compressedTexSubImage3D(n.TEXTURE_2D_ARRAY,it,0,0,0,mt.width,mt.height,nt.depth,xt,mt.data)}else e.compressedTexImage3D(n.TEXTURE_2D_ARRAY,it,gt,mt.width,mt.height,nt.depth,0,mt.data,0,0);else qt("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Ht?H&&e.texSubImage3D(n.TEXTURE_2D_ARRAY,it,0,0,0,mt.width,mt.height,nt.depth,xt,kt,mt.data):e.texImage3D(n.TEXTURE_2D_ARRAY,it,gt,mt.width,mt.height,nt.depth,0,xt,kt,mt.data);_.layerUpdates.size>0&&_.clearLayerUpdates()}else{Ht&&Zt&&e.texStorage2D(n.TEXTURE_2D,_t,gt,Lt[0].width,Lt[0].height);for(let it=0,yt=Lt.length;it<yt;it++)mt=Lt[it],_.format!==ri?xt!==null?Ht?H&&e.compressedTexSubImage2D(n.TEXTURE_2D,it,0,0,mt.width,mt.height,xt,mt.data):e.compressedTexImage2D(n.TEXTURE_2D,it,gt,mt.width,mt.height,0,mt.data):qt("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Ht?H&&e.texSubImage2D(n.TEXTURE_2D,it,0,0,mt.width,mt.height,xt,kt,mt.data):e.texImage2D(n.TEXTURE_2D,it,gt,mt.width,mt.height,0,xt,kt,mt.data)}else if(_.isDataArrayTexture)if(Ht){if(Zt&&e.texStorage3D(n.TEXTURE_2D_ARRAY,_t,gt,nt.width,nt.height,nt.depth),H)if(_.layerUpdates.size>0){let it=fh(nt.width,nt.height,_.format,_.type);for(let yt of _.layerUpdates){let Et=nt.data.subarray(yt*it/nt.data.BYTES_PER_ELEMENT,(yt+1)*it/nt.data.BYTES_PER_ELEMENT);e.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,yt,nt.width,nt.height,1,xt,kt,Et)}_.clearLayerUpdates()}else e.texSubImage3D(n.TEXTURE_2D_ARRAY,0,0,0,0,nt.width,nt.height,nt.depth,xt,kt,nt.data)}else e.texImage3D(n.TEXTURE_2D_ARRAY,0,gt,nt.width,nt.height,nt.depth,0,xt,kt,nt.data);else if(_.isData3DTexture)Ht?(Zt&&e.texStorage3D(n.TEXTURE_3D,_t,gt,nt.width,nt.height,nt.depth),H&&e.texSubImage3D(n.TEXTURE_3D,0,0,0,0,nt.width,nt.height,nt.depth,xt,kt,nt.data)):e.texImage3D(n.TEXTURE_3D,0,gt,nt.width,nt.height,nt.depth,0,xt,kt,nt.data);else if(_.isFramebufferTexture){if(Zt)if(Ht)e.texStorage2D(n.TEXTURE_2D,_t,gt,nt.width,nt.height);else{let it=nt.width,yt=nt.height;for(let Et=0;Et<_t;Et++)e.texImage2D(n.TEXTURE_2D,Et,gt,it,yt,0,xt,kt,null),it>>=1,yt>>=1}}else if(_.isHTMLTexture){if("texElementImage2D"in n){let it=n.canvas;if(it.hasAttribute("layoutsubtree")||it.setAttribute("layoutsubtree","true"),nt.parentNode!==it){it.appendChild(nt),f.add(_),it.onpaint=yt=>{let Et=yt.changedElements;for(let lt of f)Et.includes(lt.image)&&(lt.needsUpdate=!0)},it.requestPaint();return}if(n.texElementImage2D.length===3)n.texElementImage2D(n.TEXTURE_2D,n.RGBA8,nt);else{let Et=n.RGBA,lt=n.RGBA,Vt=n.UNSIGNED_BYTE;n.texElementImage2D(n.TEXTURE_2D,0,Et,lt,Vt,nt)}n.texParameteri(n.TEXTURE_2D,n.TEXTURE_MIN_FILTER,n.LINEAR),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_S,n.CLAMP_TO_EDGE),n.texParameteri(n.TEXTURE_2D,n.TEXTURE_WRAP_T,n.CLAMP_TO_EDGE)}}else if(Lt.length>0){if(Ht&&Zt){let it=jt(Lt[0]);e.texStorage2D(n.TEXTURE_2D,_t,gt,it.width,it.height)}for(let it=0,yt=Lt.length;it<yt;it++)mt=Lt[it],Ht?H&&e.texSubImage2D(n.TEXTURE_2D,it,0,0,xt,kt,mt):e.texImage2D(n.TEXTURE_2D,it,gt,xt,kt,mt);_.generateMipmaps=!1}else if(Ht){if(Zt){let it=jt(nt);e.texStorage2D(n.TEXTURE_2D,_t,gt,it.width,it.height)}H&&e.texSubImage2D(n.TEXTURE_2D,0,0,0,xt,kt,nt)}else e.texImage2D(n.TEXTURE_2D,0,gt,xt,kt,nt);g(_)&&b(X),pt.__version=ut.version,_.onUpdate&&_.onUpdate(_)}L.__version=_.version}function Pt(L,_,G){if(_.image.length!==6)return;let X=Gt(L,_),Q=_.source;e.bindTexture(n.TEXTURE_CUBE_MAP,L.__webglTexture,n.TEXTURE0+G);let ut=i.get(Q);if(Q.version!==ut.__version||X===!0){e.activeTexture(n.TEXTURE0+G);let pt=ie.getPrimaries(ie.workingColorSpace),$=_.colorSpace===Di?null:ie.getPrimaries(_.colorSpace),nt=_.colorSpace===Di||pt===$?n.NONE:n.BROWSER_DEFAULT_WEBGL;e.pixelStorei(n.UNPACK_FLIP_Y_WEBGL,_.flipY),e.pixelStorei(n.UNPACK_PREMULTIPLY_ALPHA_WEBGL,_.premultiplyAlpha),e.pixelStorei(n.UNPACK_ALIGNMENT,_.unpackAlignment),e.pixelStorei(n.UNPACK_COLORSPACE_CONVERSION_WEBGL,nt);let xt=_.isCompressedTexture||_.image[0].isCompressedTexture,kt=_.image[0]&&_.image[0].isDataTexture,gt=[];for(let lt=0;lt<6;lt++)!xt&&!kt?gt[lt]=m(_.image[lt],!0,s.maxCubemapSize):gt[lt]=kt?_.image[lt].image:_.image[lt],gt[lt]=ne(_,gt[lt]);let mt=gt[0],Lt=r.convert(_.format,_.colorSpace),Ht=r.convert(_.type),Zt=v(_.internalFormat,Lt,Ht,_.normalized,_.colorSpace),H=_.isVideoTexture!==!0,_t=ut.__version===void 0||X===!0,it=Q.dataReady,yt=C(_,mt);wt(n.TEXTURE_CUBE_MAP,_);let Et;if(xt){H&&_t&&e.texStorage2D(n.TEXTURE_CUBE_MAP,yt,Zt,mt.width,mt.height);for(let lt=0;lt<6;lt++){Et=gt[lt].mipmaps;for(let Vt=0;Vt<Et.length;Vt++){let Ot=Et[Vt];_.format!==ri?Lt!==null?H?it&&e.compressedTexSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+lt,Vt,0,0,Ot.width,Ot.height,Lt,Ot.data):e.compressedTexImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+lt,Vt,Zt,Ot.width,Ot.height,0,Ot.data):qt("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):H?it&&e.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+lt,Vt,0,0,Ot.width,Ot.height,Lt,Ht,Ot.data):e.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+lt,Vt,Zt,Ot.width,Ot.height,0,Lt,Ht,Ot.data)}}}else{if(Et=_.mipmaps,H&&_t){Et.length>0&&yt++;let lt=jt(gt[0]);e.texStorage2D(n.TEXTURE_CUBE_MAP,yt,Zt,lt.width,lt.height)}for(let lt=0;lt<6;lt++)if(kt){H?it&&e.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+lt,0,0,0,gt[lt].width,gt[lt].height,Lt,Ht,gt[lt].data):e.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+lt,0,Zt,gt[lt].width,gt[lt].height,0,Lt,Ht,gt[lt].data);for(let Vt=0;Vt<Et.length;Vt++){let _e=Et[Vt].image[lt].image;H?it&&e.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+lt,Vt+1,0,0,_e.width,_e.height,Lt,Ht,_e.data):e.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+lt,Vt+1,Zt,_e.width,_e.height,0,Lt,Ht,_e.data)}}else{H?it&&e.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+lt,0,0,0,Lt,Ht,gt[lt]):e.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+lt,0,Zt,Lt,Ht,gt[lt]);for(let Vt=0;Vt<Et.length;Vt++){let Ot=Et[Vt];H?it&&e.texSubImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+lt,Vt+1,0,0,Lt,Ht,Ot.image[lt]):e.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+lt,Vt+1,Zt,Lt,Ht,Ot.image[lt])}}}g(_)&&b(n.TEXTURE_CUBE_MAP),ut.__version=Q.version,_.onUpdate&&_.onUpdate(_)}L.__version=_.version}function vt(L,_,G,X,Q,ut){let pt=r.convert(G.format,G.colorSpace),$=r.convert(G.type),nt=v(G.internalFormat,pt,$,G.normalized,G.colorSpace),xt=i.get(_),kt=i.get(G);if(kt.__renderTarget=_,!xt.__hasExternalTextures){let gt=Math.max(1,_.width>>ut),mt=Math.max(1,_.height>>ut);Q===n.TEXTURE_3D||Q===n.TEXTURE_2D_ARRAY?e.texImage3D(Q,ut,nt,gt,mt,_.depth,0,pt,$,null):e.texImage2D(Q,ut,nt,gt,mt,0,pt,$,null)}e.bindFramebuffer(n.FRAMEBUFFER,L),Xt(_)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,X,Q,kt.__webglTexture,0,It(_)):(Q===n.TEXTURE_2D||Q>=n.TEXTURE_CUBE_MAP_POSITIVE_X&&Q<=n.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&n.framebufferTexture2D(n.FRAMEBUFFER,X,Q,kt.__webglTexture,ut),e.bindFramebuffer(n.FRAMEBUFFER,null)}function Bt(L,_,G){if(n.bindRenderbuffer(n.RENDERBUFFER,L),_.depthBuffer){let X=_.depthTexture,Q=X&&X.isDepthTexture?X.type:null,ut=S(_.stencilBuffer,Q),pt=_.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;Xt(_)?a.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,It(_),ut,_.width,_.height):G?n.renderbufferStorageMultisample(n.RENDERBUFFER,It(_),ut,_.width,_.height):n.renderbufferStorage(n.RENDERBUFFER,ut,_.width,_.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,pt,n.RENDERBUFFER,L)}else{let X=_.textures;for(let Q=0;Q<X.length;Q++){let ut=X[Q],pt=r.convert(ut.format,ut.colorSpace),$=r.convert(ut.type),nt=v(ut.internalFormat,pt,$,ut.normalized,ut.colorSpace);Xt(_)?a.renderbufferStorageMultisampleEXT(n.RENDERBUFFER,It(_),nt,_.width,_.height):G?n.renderbufferStorageMultisample(n.RENDERBUFFER,It(_),nt,_.width,_.height):n.renderbufferStorage(n.RENDERBUFFER,nt,_.width,_.height)}}n.bindRenderbuffer(n.RENDERBUFFER,null)}function ee(L,_,G){let X=_.isWebGLCubeRenderTarget===!0;if(e.bindFramebuffer(n.FRAMEBUFFER,L),!(_.depthTexture&&_.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let Q=i.get(_.depthTexture);if(Q.__renderTarget=_,(!Q.__webglTexture||_.depthTexture.image.width!==_.width||_.depthTexture.image.height!==_.height)&&(_.depthTexture.image.width=_.width,_.depthTexture.image.height=_.height,_.depthTexture.needsUpdate=!0),X){if(Q.__webglInit===void 0&&(Q.__webglInit=!0,_.depthTexture.addEventListener("dispose",P)),Q.__webglTexture===void 0){Q.__webglTexture=n.createTexture(),e.bindTexture(n.TEXTURE_CUBE_MAP,Q.__webglTexture),wt(n.TEXTURE_CUBE_MAP,_.depthTexture);let xt=r.convert(_.depthTexture.format),kt=r.convert(_.depthTexture.type),gt;_.depthTexture.format===ki?gt=n.DEPTH_COMPONENT24:_.depthTexture.format===Vi&&(gt=n.DEPTH24_STENCIL8);for(let mt=0;mt<6;mt++)n.texImage2D(n.TEXTURE_CUBE_MAP_POSITIVE_X+mt,0,gt,_.width,_.height,0,xt,kt,null)}}else V(_.depthTexture,0);let ut=Q.__webglTexture,pt=It(_),$=X?n.TEXTURE_CUBE_MAP_POSITIVE_X+G:n.TEXTURE_2D,nt=_.depthTexture.format===Vi?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;if(_.depthTexture.format===ki)Xt(_)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,nt,$,ut,0,pt):n.framebufferTexture2D(n.FRAMEBUFFER,nt,$,ut,0);else if(_.depthTexture.format===Vi)Xt(_)?a.framebufferTexture2DMultisampleEXT(n.FRAMEBUFFER,nt,$,ut,0,pt):n.framebufferTexture2D(n.FRAMEBUFFER,nt,$,ut,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function et(L){let _=i.get(L),G=L.isWebGLCubeRenderTarget===!0;if(_.__boundDepthTexture!==L.depthTexture){let X=L.depthTexture;if(_.__depthDisposeCallback&&_.__depthDisposeCallback(),X){let Q=()=>{delete _.__boundDepthTexture,delete _.__depthDisposeCallback,X.removeEventListener("dispose",Q)};X.addEventListener("dispose",Q),_.__depthDisposeCallback=Q}_.__boundDepthTexture=X}if(L.depthTexture&&!_.__autoAllocateDepthBuffer)if(G)for(let X=0;X<6;X++)ee(_.__webglFramebuffer[X],L,X);else{let X=L.texture.mipmaps;X&&X.length>0?ee(_.__webglFramebuffer[0],L,0):ee(_.__webglFramebuffer,L,0)}else if(G){_.__webglDepthbuffer=[];for(let X=0;X<6;X++)if(e.bindFramebuffer(n.FRAMEBUFFER,_.__webglFramebuffer[X]),_.__webglDepthbuffer[X]===void 0)_.__webglDepthbuffer[X]=n.createRenderbuffer(),Bt(_.__webglDepthbuffer[X],L,!1);else{let Q=L.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,ut=_.__webglDepthbuffer[X];n.bindRenderbuffer(n.RENDERBUFFER,ut),n.framebufferRenderbuffer(n.FRAMEBUFFER,Q,n.RENDERBUFFER,ut)}}else{let X=L.texture.mipmaps;if(X&&X.length>0?e.bindFramebuffer(n.FRAMEBUFFER,_.__webglFramebuffer[0]):e.bindFramebuffer(n.FRAMEBUFFER,_.__webglFramebuffer),_.__webglDepthbuffer===void 0)_.__webglDepthbuffer=n.createRenderbuffer(),Bt(_.__webglDepthbuffer,L,!1);else{let Q=L.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,ut=_.__webglDepthbuffer;n.bindRenderbuffer(n.RENDERBUFFER,ut),n.framebufferRenderbuffer(n.FRAMEBUFFER,Q,n.RENDERBUFFER,ut)}}e.bindFramebuffer(n.FRAMEBUFFER,null)}function at(L,_,G){let X=i.get(L);_!==void 0&&vt(X.__webglFramebuffer,L,L.texture,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,0),G!==void 0&&et(L)}function st(L){let _=L.texture,G=i.get(L),X=i.get(_);L.addEventListener("dispose",y);let Q=L.textures,ut=L.isWebGLCubeRenderTarget===!0,pt=Q.length>1;if(pt||(X.__webglTexture===void 0&&(X.__webglTexture=n.createTexture()),X.__version=_.version,o.memory.textures++),ut){G.__webglFramebuffer=[];for(let $=0;$<6;$++)if(_.mipmaps&&_.mipmaps.length>0){G.__webglFramebuffer[$]=[];for(let nt=0;nt<_.mipmaps.length;nt++)G.__webglFramebuffer[$][nt]=n.createFramebuffer()}else G.__webglFramebuffer[$]=n.createFramebuffer()}else{if(_.mipmaps&&_.mipmaps.length>0){G.__webglFramebuffer=[];for(let $=0;$<_.mipmaps.length;$++)G.__webglFramebuffer[$]=n.createFramebuffer()}else G.__webglFramebuffer=n.createFramebuffer();if(pt)for(let $=0,nt=Q.length;$<nt;$++){let xt=i.get(Q[$]);xt.__webglTexture===void 0&&(xt.__webglTexture=n.createTexture(),o.memory.textures++)}if(L.samples>0&&Xt(L)===!1){G.__webglMultisampledFramebuffer=n.createFramebuffer(),G.__webglColorRenderbuffer=[],e.bindFramebuffer(n.FRAMEBUFFER,G.__webglMultisampledFramebuffer);for(let $=0;$<Q.length;$++){let nt=Q[$];G.__webglColorRenderbuffer[$]=n.createRenderbuffer(),n.bindRenderbuffer(n.RENDERBUFFER,G.__webglColorRenderbuffer[$]);let xt=r.convert(nt.format,nt.colorSpace),kt=r.convert(nt.type),gt=v(nt.internalFormat,xt,kt,nt.normalized,nt.colorSpace,L.isXRRenderTarget===!0),mt=It(L);n.renderbufferStorageMultisample(n.RENDERBUFFER,mt,gt,L.width,L.height),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+$,n.RENDERBUFFER,G.__webglColorRenderbuffer[$])}n.bindRenderbuffer(n.RENDERBUFFER,null),L.depthBuffer&&(G.__webglDepthRenderbuffer=n.createRenderbuffer(),Bt(G.__webglDepthRenderbuffer,L,!0)),e.bindFramebuffer(n.FRAMEBUFFER,null)}}if(ut){e.bindTexture(n.TEXTURE_CUBE_MAP,X.__webglTexture),wt(n.TEXTURE_CUBE_MAP,_);for(let $=0;$<6;$++)if(_.mipmaps&&_.mipmaps.length>0)for(let nt=0;nt<_.mipmaps.length;nt++)vt(G.__webglFramebuffer[$][nt],L,_,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+$,nt);else vt(G.__webglFramebuffer[$],L,_,n.COLOR_ATTACHMENT0,n.TEXTURE_CUBE_MAP_POSITIVE_X+$,0);g(_)&&b(n.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(pt){for(let $=0,nt=Q.length;$<nt;$++){let xt=Q[$],kt=i.get(xt),gt=n.TEXTURE_2D;(L.isWebGL3DRenderTarget||L.isWebGLArrayRenderTarget)&&(gt=L.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),e.bindTexture(gt,kt.__webglTexture),wt(gt,xt),vt(G.__webglFramebuffer,L,xt,n.COLOR_ATTACHMENT0+$,gt,0),g(xt)&&b(gt)}e.unbindTexture()}else{let $=n.TEXTURE_2D;if((L.isWebGL3DRenderTarget||L.isWebGLArrayRenderTarget)&&($=L.isWebGL3DRenderTarget?n.TEXTURE_3D:n.TEXTURE_2D_ARRAY),e.bindTexture($,X.__webglTexture),wt($,_),_.mipmaps&&_.mipmaps.length>0)for(let nt=0;nt<_.mipmaps.length;nt++)vt(G.__webglFramebuffer[nt],L,_,n.COLOR_ATTACHMENT0,$,nt);else vt(G.__webglFramebuffer,L,_,n.COLOR_ATTACHMENT0,$,0);g(_)&&b($),e.unbindTexture()}L.depthBuffer&&et(L)}function ot(L){let _=L.textures;for(let G=0,X=_.length;G<X;G++){let Q=_[G];if(g(Q)){let ut=T(L),pt=i.get(Q).__webglTexture;e.bindTexture(ut,pt),b(ut),e.unbindTexture()}}}let ct=[],Ut=[];function Rt(L){if(L.samples>0){if(Xt(L)===!1){let _=L.textures,G=L.width,X=L.height,Q=n.COLOR_BUFFER_BIT,ut=L.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT,pt=i.get(L),$=_.length>1;if($)for(let xt=0;xt<_.length;xt++)e.bindFramebuffer(n.FRAMEBUFFER,pt.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+xt,n.RENDERBUFFER,null),e.bindFramebuffer(n.FRAMEBUFFER,pt.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+xt,n.TEXTURE_2D,null,0);e.bindFramebuffer(n.READ_FRAMEBUFFER,pt.__webglMultisampledFramebuffer);let nt=L.texture.mipmaps;nt&&nt.length>0?e.bindFramebuffer(n.DRAW_FRAMEBUFFER,pt.__webglFramebuffer[0]):e.bindFramebuffer(n.DRAW_FRAMEBUFFER,pt.__webglFramebuffer);for(let xt=0;xt<_.length;xt++){if(L.resolveDepthBuffer&&(L.depthBuffer&&(Q|=n.DEPTH_BUFFER_BIT),L.stencilBuffer&&L.resolveStencilBuffer&&(Q|=n.STENCIL_BUFFER_BIT)),$){n.framebufferRenderbuffer(n.READ_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.RENDERBUFFER,pt.__webglColorRenderbuffer[xt]);let kt=i.get(_[xt]).__webglTexture;n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,kt,0)}n.blitFramebuffer(0,0,G,X,0,0,G,X,Q,n.NEAREST),l===!0&&(ct.length=0,Ut.length=0,ct.push(n.COLOR_ATTACHMENT0+xt),L.depthBuffer&&L.storeMultisampledDepthBuffer===!1&&(ct.push(ut),Ut.push(ut),n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,Ut)),n.invalidateFramebuffer(n.READ_FRAMEBUFFER,ct))}if(e.bindFramebuffer(n.READ_FRAMEBUFFER,null),e.bindFramebuffer(n.DRAW_FRAMEBUFFER,null),$)for(let xt=0;xt<_.length;xt++){e.bindFramebuffer(n.FRAMEBUFFER,pt.__webglMultisampledFramebuffer),n.framebufferRenderbuffer(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0+xt,n.RENDERBUFFER,pt.__webglColorRenderbuffer[xt]);let kt=i.get(_[xt]).__webglTexture;e.bindFramebuffer(n.FRAMEBUFFER,pt.__webglFramebuffer),n.framebufferTexture2D(n.DRAW_FRAMEBUFFER,n.COLOR_ATTACHMENT0+xt,n.TEXTURE_2D,kt,0)}e.bindFramebuffer(n.DRAW_FRAMEBUFFER,pt.__webglMultisampledFramebuffer)}else if(L.depthBuffer&&L.storeMultisampledDepthBuffer===!1&&l){let _=L.stencilBuffer?n.DEPTH_STENCIL_ATTACHMENT:n.DEPTH_ATTACHMENT;n.invalidateFramebuffer(n.DRAW_FRAMEBUFFER,[_])}}}function It(L){return Math.min(s.maxSamples,L.samples)}function Xt(L){let _=i.get(L);return L.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&_.__useRenderToTexture!==!1}function B(L){let _=o.render.frame;h.get(L)!==_&&(h.set(L,_),L.update())}function ne(L,_){let G=L.colorSpace,X=L.format,Q=L.type;return L.isCompressedTexture===!0||L.isVideoTexture===!0||G!==hr&&G!==Di&&(ie.getTransfer(G)===ce?(X!==ri||Q!==Qe)&&qt("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):Yt("WebGLTextures: Unsupported texture color space:",G)),_}function jt(L){return typeof HTMLImageElement<"u"&&L instanceof HTMLImageElement?(c.width=L.naturalWidth||L.width,c.height=L.naturalHeight||L.height):typeof VideoFrame<"u"&&L instanceof VideoFrame?(c.width=L.displayWidth,c.height=L.displayHeight):(c.width=L.width,c.height=L.height),c}this.allocateTextureUnit=O,this.resetTextureUnits=E,this.getTextureUnits=R,this.setTextureUnits=N,this.setTexture2D=V,this.setTexture2DArray=k,this.setTexture3D=W,this.setTextureCube=j,this.rebindTextures=at,this.setupRenderTarget=st,this.updateRenderTargetMipmap=ot,this.updateMultisampleRenderTarget=Rt,this.setupDepthRenderbuffer=et,this.setupFrameBufferTexture=vt,this.useMultisampledRTT=Xt,this.isReversedDepthBuffer=function(){return e.buffers.depth.getReversed()}}function Zv(n,t){function e(i,s=Di){let r,o=ie.getTransfer(s);if(i===Qe)return n.UNSIGNED_BYTE;if(i===Va)return n.UNSIGNED_SHORT_4_4_4_4;if(i===Ga)return n.UNSIGNED_SHORT_5_5_5_1;if(i===th)return n.UNSIGNED_INT_5_9_9_9_REV;if(i===eh)return n.UNSIGNED_INT_10F_11F_11F_REV;if(i===Qc)return n.BYTE;if(i===$c)return n.SHORT;if(i===Os)return n.UNSIGNED_SHORT;if(i===Ha)return n.INT;if(i===Li)return n.UNSIGNED_INT;if(i===Ii)return n.FLOAT;if(i===ve)return n.HALF_FLOAT;if(i===ih)return n.ALPHA;if(i===nh)return n.RGB;if(i===ri)return n.RGBA;if(i===ki)return n.DEPTH_COMPONENT;if(i===Vi)return n.DEPTH_STENCIL;if(i===sh)return n.RED;if(i===Wa)return n.RED_INTEGER;if(i===In)return n.RG;if(i===Xa)return n.RG_INTEGER;if(i===qa)return n.RGBA_INTEGER;if(i===$r||i===to||i===eo||i===io)if(o===ce)if(r=t.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(i===$r)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===to)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===eo)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===io)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=t.get("WEBGL_compressed_texture_s3tc"),r!==null){if(i===$r)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===to)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===eo)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===io)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===Ya||i===Za||i===ja||i===Ka)if(r=t.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(i===Ya)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===Za)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===ja)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===Ka)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===Ja||i===Qa||i===$a||i===tl||i===el||i===no||i===il)if(r=t.get("WEBGL_compressed_texture_etc"),r!==null){if(i===Ja||i===Qa)return o===ce?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(i===$a)return o===ce?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(i===tl)return r.COMPRESSED_R11_EAC;if(i===el)return r.COMPRESSED_SIGNED_R11_EAC;if(i===no)return r.COMPRESSED_RG11_EAC;if(i===il)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(i===nl||i===sl||i===rl||i===ol||i===al||i===ll||i===cl||i===hl||i===ul||i===dl||i===fl||i===pl||i===ml||i===gl)if(r=t.get("WEBGL_compressed_texture_astc"),r!==null){if(i===nl)return o===ce?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===sl)return o===ce?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===rl)return o===ce?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===ol)return o===ce?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===al)return o===ce?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===ll)return o===ce?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===cl)return o===ce?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===hl)return o===ce?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===ul)return o===ce?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===dl)return o===ce?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===fl)return o===ce?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===pl)return o===ce?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===ml)return o===ce?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===gl)return o===ce?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===xl||i===vl||i===_l)if(r=t.get("EXT_texture_compression_bptc"),r!==null){if(i===xl)return o===ce?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===vl)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===_l)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===yl||i===Ml||i===so||i===bl)if(r=t.get("EXT_texture_compression_rgtc"),r!==null){if(i===yl)return r.COMPRESSED_RED_RGTC1_EXT;if(i===Ml)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===so)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===bl)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===Ln?n.UNSIGNED_INT_24_8:n[i]!==void 0?n[i]:null}return{convert:e}}var jv=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Kv=`
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

}`,Ih=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,e){if(this.texture===null){let i=new Mr(t.texture);(t.depthNear!==e.depthNear||t.depthFar!==e.depthFar)&&(this.depthNear=t.depthNear,this.depthFar=t.depthFar),this.texture=i}}getMesh(t){if(this.texture!==null&&this.mesh===null){let e=t.cameras[0].viewport,i=new le({vertexShader:jv,fragmentShader:Kv,uniforms:{depthColor:{value:this.texture},depthWidth:{value:e.z},depthHeight:{value:e.w}}});this.mesh=new Wt(new _n(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},Dh=class extends Ri{constructor(t,e){super();let i=this,s=null,r=1,o=null,a="local-floor",l=1,c=null,h=null,f=null,d=null,u=null,p=null,x=typeof XRWebGLBinding<"u",m=new Ih,g={},b=e.getContextAttributes(),T=null,v=null,S=[],C=[],P=new tt,y=null,A=null,U=new Ne;U.viewport=new xe;let I=new Ne;I.viewport=new xe;let M=[U,I],E=new Na,R=null,N=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Z){let K=S[Z];return K===void 0&&(K=new ws,S[Z]=K),K.getTargetRaySpace()},this.getControllerGrip=function(Z){let K=S[Z];return K===void 0&&(K=new ws,S[Z]=K),K.getGripSpace()},this.getHand=function(Z){let K=S[Z];return K===void 0&&(K=new ws,S[Z]=K),K.getHandSpace()};function O(Z){let K=C.indexOf(Z.inputSource);if(K===-1)return;let dt=S[K];dt!==void 0&&(dt.update(Z.inputSource,Z.frame,c||o),dt.dispatchEvent({type:Z.type,data:Z.inputSource}))}function F(){s.removeEventListener("select",O),s.removeEventListener("selectstart",O),s.removeEventListener("selectend",O),s.removeEventListener("squeeze",O),s.removeEventListener("squeezestart",O),s.removeEventListener("squeezeend",O),s.removeEventListener("end",F),s.removeEventListener("inputsourceschange",V);for(let Z=0;Z<S.length;Z++){let K=C[Z];K!==null&&(C[Z]=null,S[Z].disconnect(K))}R=null,N=null,m.reset();for(let Z in g)delete g[Z];if(t.setRenderTarget(T),u=null,d=null,f=null,s=null,v=null,Gt.stop(),i.isPresenting=!1,t.setPixelRatio(y),t.setSize(P.width,P.height,!1),A!==null){let Z=A.camera;Z.fov=A.fov,Z.zoom=A.zoom,Z.updateProjectionMatrix(),A=null}i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Z){r=Z,i.isPresenting===!0&&qt("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Z){a=Z,i.isPresenting===!0&&qt("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||o},this.setReferenceSpace=function(Z){c=Z},this.getBaseLayer=function(){return d!==null?d:u},this.getBinding=function(){return f===null&&x&&(f=new XRWebGLBinding(s,e)),f},this.getFrame=function(){return p},this.getSession=function(){return s},this.setSession=async function(Z){if(s=Z,s!==null){if(T=t.getRenderTarget(),s.addEventListener("select",O),s.addEventListener("selectstart",O),s.addEventListener("selectend",O),s.addEventListener("squeeze",O),s.addEventListener("squeezestart",O),s.addEventListener("squeezeend",O),s.addEventListener("end",F),s.addEventListener("inputsourceschange",V),b.xrCompatible!==!0&&await e.makeXRCompatible(),y=t.getPixelRatio(),t.getSize(P),x&&"createProjectionLayer"in XRWebGLBinding.prototype){let dt=null,Pt=null,vt=null;b.depth&&(vt=b.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,dt=b.stencil?Vi:ki,Pt=b.stencil?Ln:Li);let Bt={colorFormat:e.RGBA8,depthFormat:vt,scaleFactor:r};f=this.getBinding(),d=f.createProjectionLayer(Bt),s.updateRenderState({layers:[d]}),t.setPixelRatio(1),t.setSize(d.textureWidth,d.textureHeight,!1),v=new he(d.textureWidth,d.textureHeight,{format:ri,type:Qe,depthTexture:new Hi(d.textureWidth,d.textureHeight,Pt,void 0,void 0,void 0,void 0,void 0,void 0,dt),stencilBuffer:b.stencil,colorSpace:t.outputColorSpace,samples:b.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1,storeMultisampledDepthBuffer:d.ignoreDepthValues===!1,storeMultisampledStencilBuffer:d.ignoreDepthValues===!1})}else{let dt={antialias:b.antialias,alpha:!0,depth:b.depth,stencil:b.stencil,framebufferScaleFactor:r};u=new XRWebGLLayer(s,e,dt),s.updateRenderState({baseLayer:u}),t.setPixelRatio(1),t.setSize(u.framebufferWidth,u.framebufferHeight,!1),v=new he(u.framebufferWidth,u.framebufferHeight,{format:ri,type:Qe,colorSpace:t.outputColorSpace,stencilBuffer:b.stencil,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1,storeMultisampledDepthBuffer:u.ignoreDepthValues===!1,storeMultisampledStencilBuffer:u.ignoreDepthValues===!1})}v.isXRRenderTarget=!0,this.setFoveation(l),c=null,o=await s.requestReferenceSpace(a),Gt.setContext(s),Gt.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function V(Z){for(let K=0;K<Z.removed.length;K++){let dt=Z.removed[K],Pt=C.indexOf(dt);Pt>=0&&(C[Pt]=null,S[Pt].disconnect(dt))}for(let K=0;K<Z.added.length;K++){let dt=Z.added[K],Pt=C.indexOf(dt);if(Pt===-1){for(let Bt=0;Bt<S.length;Bt++)if(Bt>=C.length){C.push(dt),Pt=Bt;break}else if(C[Bt]===null){C[Bt]=dt,Pt=Bt;break}if(Pt===-1)break}let vt=S[Pt];vt&&vt.connect(dt)}}let k=new D,W=new D;function j(Z,K,dt){k.setFromMatrixPosition(K.matrixWorld),W.setFromMatrixPosition(dt.matrixWorld);let Pt=k.distanceTo(W),vt=K.projectionMatrix.elements,Bt=dt.projectionMatrix.elements,ee=vt[14]/(vt[10]-1),et=vt[14]/(vt[10]+1),at=(vt[9]+1)/vt[5],st=(vt[9]-1)/vt[5],ot=(vt[8]-1)/vt[0],ct=(Bt[8]+1)/Bt[0],Ut=ee*ot,Rt=ee*ct,It=Pt/(-ot+ct),Xt=It*-ot;if(K.matrixWorld.decompose(Z.position,Z.quaternion,Z.scale),Z.translateX(Xt),Z.translateZ(It),Z.matrixWorld.compose(Z.position,Z.quaternion,Z.scale),Z.matrixWorldInverse.copy(Z.matrixWorld).invert(),vt[10]===-1)Z.projectionMatrix.copy(K.projectionMatrix),Z.projectionMatrixInverse.copy(K.projectionMatrixInverse);else{let B=ee+It,ne=et+It,jt=Ut-Xt,L=Rt+(Pt-Xt),_=at*et/ne*B,G=st*et/ne*B;Z.projectionMatrix.makePerspective(jt,L,_,G,B,ne),Z.projectionMatrixInverse.copy(Z.projectionMatrix).invert()}}function ht(Z,K){K===null?Z.matrixWorld.copy(Z.matrix):Z.matrixWorld.multiplyMatrices(K.matrixWorld,Z.matrix),Z.matrixWorldInverse.copy(Z.matrixWorld).invert()}this.updateCamera=function(Z){if(s===null)return;let K=Z.near,dt=Z.far;m.texture!==null&&(m.depthNear>0&&(K=m.depthNear),m.depthFar>0&&(dt=m.depthFar)),E.near=I.near=U.near=K,E.far=I.far=U.far=dt,(R!==E.near||N!==E.far)&&(s.updateRenderState({depthNear:E.near,depthFar:E.far}),R=E.near,N=E.far),E.layers.mask=Z.layers.mask|6,U.layers.mask=E.layers.mask&-5,I.layers.mask=E.layers.mask&-3;let Pt=Z.parent,vt=E.cameras;ht(E,Pt);for(let Bt=0;Bt<vt.length;Bt++)ht(vt[Bt],Pt);vt.length===2?j(E,U,I):E.projectionMatrix.copy(U.projectionMatrix),A===null&&Z.isPerspectiveCamera&&(A={camera:Z,fov:Z.fov,zoom:Z.zoom}),ft(Z,E,Pt)};function ft(Z,K,dt){dt===null?Z.matrix.copy(K.matrixWorld):(Z.matrix.copy(dt.matrixWorld),Z.matrix.invert(),Z.matrix.multiply(K.matrixWorld)),Z.matrix.decompose(Z.position,Z.quaternion,Z.scale),Z.updateMatrixWorld(!0),Z.projectionMatrix.copy(K.projectionMatrix),Z.projectionMatrixInverse.copy(K.projectionMatrixInverse),Z.isPerspectiveCamera&&(Z.fov=Ms*2*Math.atan(1/Z.projectionMatrix.elements[5]),Z.zoom=1)}this.getCamera=function(){return E},this.getFoveation=function(){if(!(d===null&&u===null))return l},this.setFoveation=function(Z){l=Z,d!==null&&(d.fixedFoveation=Z),u!==null&&u.fixedFoveation!==void 0&&(u.fixedFoveation=Z)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(E)},this.getCameraTexture=function(Z){return g[Z]};let At=null;function wt(Z,K){if(h=K.getViewerPose(c||o),p=K,h!==null){let dt=h.views;u!==null&&(t.setRenderTargetFramebuffer(v,u.framebuffer),t.setRenderTarget(v));let Pt=!1;dt.length!==E.cameras.length&&(E.cameras.length=0,Pt=!0);for(let et=0;et<dt.length;et++){let at=dt[et],st=null;if(u!==null)st=u.getViewport(at);else{let ct=f.getViewSubImage(d,at);st=ct.viewport,et===0&&(t.setRenderTargetTextures(v,ct.colorTexture,ct.depthStencilTexture),t.setRenderTarget(v))}let ot=M[et];ot===void 0&&(ot=new Ne,ot.layers.enable(et),ot.viewport=new xe,M[et]=ot),ot.matrix.fromArray(at.transform.matrix),ot.matrix.decompose(ot.position,ot.quaternion,ot.scale),ot.projectionMatrix.fromArray(at.projectionMatrix),ot.projectionMatrixInverse.copy(ot.projectionMatrix).invert(),ot.viewport.set(st.x,st.y,st.width,st.height),et===0&&(E.matrix.copy(ot.matrix),E.matrix.decompose(E.position,E.quaternion,E.scale)),Pt===!0&&E.cameras.push(ot)}let vt=s.enabledFeatures;if(vt&&vt.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&x){f=i.getBinding();let et=f.getDepthInformation(dt[0]);et&&et.isValid&&et.texture&&m.init(et,s.renderState)}if(vt&&vt.includes("camera-access")&&x){t.state.unbindTexture(),f=i.getBinding();for(let et=0;et<dt.length;et++){let at=dt[et].camera;if(at){let st=g[at];st||(st=new Mr,g[at]=st);let ot=f.getCameraImage(at);st.sourceTexture=ot}}}}for(let dt=0;dt<S.length;dt++){let Pt=C[dt],vt=S[dt];Pt!==null&&vt!==void 0&&vt.update(Pt,K,c||o)}At&&At(Z,K),K.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:K}),p=null}let Gt=new jd;Gt.setAnimationLoop(wt),this.setAnimationLoop=function(Z){At=Z},this.dispose=function(){}}},Jv=new re,ef=new Kt;ef.set(-1,0,0,0,1,0,0,0,1);function Qv(n,t){function e(m,g){m.matrixAutoUpdate===!0&&m.updateMatrix(),g.value.copy(m.matrix)}function i(m,g){g.color.getRGB(m.fogColor.value,hh(n)),g.isFog?(m.fogNear.value=g.near,m.fogFar.value=g.far):g.isFogExp2&&(m.fogDensity.value=g.density)}function s(m,g,b,T,v){g.isNodeMaterial?g.uniformsNeedUpdate=!1:g.isMeshBasicMaterial?r(m,g):g.isMeshLambertMaterial?(r(m,g),g.envMap&&(m.envMapIntensity.value=g.envMapIntensity)):g.isMeshToonMaterial?(r(m,g),f(m,g)):g.isMeshPhongMaterial?(r(m,g),h(m,g),g.envMap&&(m.envMapIntensity.value=g.envMapIntensity)):g.isMeshStandardMaterial?(r(m,g),d(m,g),g.isMeshPhysicalMaterial&&u(m,g,v)):g.isMeshMatcapMaterial?(r(m,g),p(m,g)):g.isMeshDepthMaterial?r(m,g):g.isMeshDistanceMaterial?(r(m,g),x(m,g)):g.isMeshNormalMaterial?r(m,g):g.isLineBasicMaterial?(o(m,g),g.isLineDashedMaterial&&a(m,g)):g.isPointsMaterial?l(m,g,b,T):g.isSpriteMaterial?c(m,g):g.isShadowMaterial?(m.color.value.copy(g.color),m.opacity.value=g.opacity):g.isShaderMaterial&&(g.uniformsNeedUpdate=!1)}function r(m,g){m.opacity.value=g.opacity,g.color&&m.diffuse.value.copy(g.color),g.emissive&&m.emissive.value.copy(g.emissive).multiplyScalar(g.emissiveIntensity),g.map&&(m.map.value=g.map,e(g.map,m.mapTransform)),g.alphaMap&&(m.alphaMap.value=g.alphaMap,e(g.alphaMap,m.alphaMapTransform)),g.bumpMap&&(m.bumpMap.value=g.bumpMap,e(g.bumpMap,m.bumpMapTransform),m.bumpScale.value=g.bumpScale,g.side===Ye&&(m.bumpScale.value*=-1)),g.normalMap&&(m.normalMap.value=g.normalMap,e(g.normalMap,m.normalMapTransform),m.normalScale.value.copy(g.normalScale),g.side===Ye&&m.normalScale.value.negate()),g.displacementMap&&(m.displacementMap.value=g.displacementMap,e(g.displacementMap,m.displacementMapTransform),m.displacementScale.value=g.displacementScale,m.displacementBias.value=g.displacementBias),g.emissiveMap&&(m.emissiveMap.value=g.emissiveMap,e(g.emissiveMap,m.emissiveMapTransform)),g.specularMap&&(m.specularMap.value=g.specularMap,e(g.specularMap,m.specularMapTransform)),g.alphaTest>0&&(m.alphaTest.value=g.alphaTest);let b=t.get(g),T=b.envMap,v=b.envMapRotation;T&&(m.envMap.value=T,m.envMapRotation.value.setFromMatrix4(Jv.makeRotationFromEuler(v)).transpose(),T.isCubeTexture&&T.isRenderTargetTexture===!1&&m.envMapRotation.value.premultiply(ef),m.reflectivity.value=g.reflectivity,m.ior.value=g.ior,m.refractionRatio.value=g.refractionRatio),g.lightMap&&(m.lightMap.value=g.lightMap,m.lightMapIntensity.value=g.lightMapIntensity,e(g.lightMap,m.lightMapTransform)),g.aoMap&&(m.aoMap.value=g.aoMap,m.aoMapIntensity.value=g.aoMapIntensity,e(g.aoMap,m.aoMapTransform))}function o(m,g){m.diffuse.value.copy(g.color),m.opacity.value=g.opacity,g.map&&(m.map.value=g.map,e(g.map,m.mapTransform))}function a(m,g){m.dashSize.value=g.dashSize,m.totalSize.value=g.dashSize+g.gapSize,m.scale.value=g.scale}function l(m,g,b,T){m.diffuse.value.copy(g.color),m.opacity.value=g.opacity,m.size.value=g.size*b,m.scale.value=T*.5,g.map&&(m.map.value=g.map,e(g.map,m.uvTransform)),g.alphaMap&&(m.alphaMap.value=g.alphaMap,e(g.alphaMap,m.alphaMapTransform)),g.alphaTest>0&&(m.alphaTest.value=g.alphaTest)}function c(m,g){m.diffuse.value.copy(g.color),m.opacity.value=g.opacity,m.rotation.value=g.rotation,g.map&&(m.map.value=g.map,e(g.map,m.mapTransform)),g.alphaMap&&(m.alphaMap.value=g.alphaMap,e(g.alphaMap,m.alphaMapTransform)),g.alphaTest>0&&(m.alphaTest.value=g.alphaTest)}function h(m,g){m.specular.value.copy(g.specular),m.shininess.value=Math.max(g.shininess,1e-4)}function f(m,g){g.gradientMap&&(m.gradientMap.value=g.gradientMap)}function d(m,g){m.metalness.value=g.metalness,g.metalnessMap&&(m.metalnessMap.value=g.metalnessMap,e(g.metalnessMap,m.metalnessMapTransform)),m.roughness.value=g.roughness,g.roughnessMap&&(m.roughnessMap.value=g.roughnessMap,e(g.roughnessMap,m.roughnessMapTransform)),g.envMap&&(m.envMapIntensity.value=g.envMapIntensity)}function u(m,g,b){m.ior.value=g.ior,g.sheen>0&&(m.sheenColor.value.copy(g.sheenColor).multiplyScalar(g.sheen),m.sheenRoughness.value=g.sheenRoughness,g.sheenColorMap&&(m.sheenColorMap.value=g.sheenColorMap,e(g.sheenColorMap,m.sheenColorMapTransform)),g.sheenRoughnessMap&&(m.sheenRoughnessMap.value=g.sheenRoughnessMap,e(g.sheenRoughnessMap,m.sheenRoughnessMapTransform))),g.clearcoat>0&&(m.clearcoat.value=g.clearcoat,m.clearcoatRoughness.value=g.clearcoatRoughness,g.clearcoatMap&&(m.clearcoatMap.value=g.clearcoatMap,e(g.clearcoatMap,m.clearcoatMapTransform)),g.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=g.clearcoatRoughnessMap,e(g.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),g.clearcoatNormalMap&&(m.clearcoatNormalMap.value=g.clearcoatNormalMap,e(g.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(g.clearcoatNormalScale),g.side===Ye&&m.clearcoatNormalScale.value.negate())),g.dispersion>0&&(m.dispersion.value=g.dispersion),g.retroreflectivity>0&&(m.retroreflectivity.value=g.retroreflectivity),g.iridescence>0&&(m.iridescence.value=g.iridescence,m.iridescenceIOR.value=g.iridescenceIOR,m.iridescenceThicknessMinimum.value=g.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=g.iridescenceThicknessRange[1],g.iridescenceMap&&(m.iridescenceMap.value=g.iridescenceMap,e(g.iridescenceMap,m.iridescenceMapTransform)),g.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=g.iridescenceThicknessMap,e(g.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),g.transmission>0&&(m.transmission.value=g.transmission,m.transmissionSamplerMap.value=b.texture,m.transmissionSamplerSize.value.set(b.width,b.height),g.transmissionMap&&(m.transmissionMap.value=g.transmissionMap,e(g.transmissionMap,m.transmissionMapTransform)),m.thickness.value=g.thickness,g.thicknessMap&&(m.thicknessMap.value=g.thicknessMap,e(g.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=g.attenuationDistance,m.attenuationColor.value.copy(g.attenuationColor)),g.anisotropy>0&&(m.anisotropyVector.value.set(g.anisotropy*Math.cos(g.anisotropyRotation),g.anisotropy*Math.sin(g.anisotropyRotation)),g.anisotropyMap&&(m.anisotropyMap.value=g.anisotropyMap,e(g.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=g.specularIntensity,m.specularColor.value.copy(g.specularColor),g.specularColorMap&&(m.specularColorMap.value=g.specularColorMap,e(g.specularColorMap,m.specularColorMapTransform)),g.specularIntensityMap&&(m.specularIntensityMap.value=g.specularIntensityMap,e(g.specularIntensityMap,m.specularIntensityMapTransform))}function p(m,g){g.matcap&&(m.matcap.value=g.matcap)}function x(m,g){let b=t.get(g).light;m.referencePosition.value.setFromMatrixPosition(b.matrixWorld),m.nearDistance.value=b.shadow.camera.near,m.farDistance.value=b.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:s}}function $v(n,t,e,i){let s={},r={},o=[],a=n.getParameter(n.MAX_UNIFORM_BUFFER_BINDINGS);function l(v,S){let C=S.program;i.uniformBlockBinding(v,C)}function c(v,S){let C=s[v.id];C===void 0&&(m(v),C=h(v),s[v.id]=C,v.addEventListener("dispose",b));let P=S.program;i.updateUBOMapping(v,P);let y=t.render.frame;r[v.id]!==y&&(d(v),r[v.id]=y)}function h(v){let S=f();v.__bindingPointIndex=S;let C=n.createBuffer(),P=v.__size,y=v.usage;return n.bindBuffer(n.UNIFORM_BUFFER,C),n.bufferData(n.UNIFORM_BUFFER,P,y),n.bindBuffer(n.UNIFORM_BUFFER,null),n.bindBufferBase(n.UNIFORM_BUFFER,S,C),C}function f(){for(let v=0;v<a;v++)if(o.indexOf(v)===-1)return o.push(v),v;return Yt("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(v){let S=s[v.id],C=v.uniforms,P=v.__cache;n.bindBuffer(n.UNIFORM_BUFFER,S);for(let y=0,A=C.length;y<A;y++){let U=C[y];if(Array.isArray(U))for(let I=0,M=U.length;I<M;I++)u(U[I],y,I,P);else u(U,y,0,P)}n.bindBuffer(n.UNIFORM_BUFFER,null)}function u(v,S,C,P){if(x(v,S,C,P)===!0){let y=v.__offset,A=v.value;if(Array.isArray(A)){let U=0;for(let I=0;I<A.length;I++){let M=A[I],E=g(M);p(M,v.__data,U),typeof M!="number"&&typeof M!="boolean"&&!M.isMatrix3&&!ArrayBuffer.isView(M)&&(U+=E.storage/Float32Array.BYTES_PER_ELEMENT)}}else p(A,v.__data,0);n.bufferSubData(n.UNIFORM_BUFFER,y,v.__data)}}function p(v,S,C){typeof v=="number"||typeof v=="boolean"?S[0]=v:v.isMatrix3?(S[0]=v.elements[0],S[1]=v.elements[1],S[2]=v.elements[2],S[3]=0,S[4]=v.elements[3],S[5]=v.elements[4],S[6]=v.elements[5],S[7]=0,S[8]=v.elements[6],S[9]=v.elements[7],S[10]=v.elements[8],S[11]=0):ArrayBuffer.isView(v)?S.set(new v.constructor(v.buffer,v.byteOffset,S.length)):v.toArray(S,C)}function x(v,S,C,P){let y=v.value,A=S+"_"+C;if(P[A]===void 0)return typeof y=="number"||typeof y=="boolean"?P[A]=y:ArrayBuffer.isView(y)?P[A]=y.slice():P[A]=y.clone(),!0;{let U=P[A];if(typeof y=="number"||typeof y=="boolean"){if(U!==y)return P[A]=y,!0}else{if(ArrayBuffer.isView(y))return!0;if(U.equals(y)===!1)return U.copy(y),!0}}return!1}function m(v){let S=v.uniforms,C=0,P=16;for(let A=0,U=S.length;A<U;A++){let I=Array.isArray(S[A])?S[A]:[S[A]];for(let M=0,E=I.length;M<E;M++){let R=I[M],N=Array.isArray(R.value)?R.value:[R.value];for(let O=0,F=N.length;O<F;O++){let V=N[O],k=g(V),W=C%P,j=W%k.boundary,ht=W+j;C+=j,ht!==0&&P-ht<k.storage&&(C+=P-ht),R.__data=new Float32Array(k.storage/Float32Array.BYTES_PER_ELEMENT),R.__offset=C,C+=k.storage}}}let y=C%P;return y>0&&(C+=P-y),v.__size=C,v.__cache={},this}function g(v){let S={boundary:0,storage:0};return typeof v=="number"||typeof v=="boolean"?(S.boundary=4,S.storage=4):v.isVector2?(S.boundary=8,S.storage=8):v.isVector3||v.isColor?(S.boundary=16,S.storage=12):v.isVector4?(S.boundary=16,S.storage=16):v.isMatrix3?(S.boundary=48,S.storage=48):v.isMatrix4?(S.boundary=64,S.storage=64):v.isTexture?qt("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(v)?(S.boundary=16,S.storage=v.byteLength):qt("WebGLRenderer: Unsupported uniform value type.",v),S}function b(v){let S=v.target;S.removeEventListener("dispose",b);let C=o.indexOf(S.__bindingPointIndex);o.splice(C,1),n.deleteBuffer(s[S.id]),delete s[S.id],delete r[S.id]}function T(){for(let v in s)n.deleteBuffer(s[v]);o=[],s={},r={}}return{bind:l,update:c,dispose:T}}var t_=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Gi=null;function e_(){return Gi===null&&(Gi=new vn(t_,16,16,In,ve),Gi.name="DFG_LUT",Gi.minFilter=Fe,Gi.magFilter=Fe,Gi.wrapS=xi,Gi.wrapT=xi,Gi.generateMipmaps=!1,Gi.needsUpdate=!0),Gi}var Cl=class{constructor(t={}){let{canvas:e=gd(),context:i=null,depth:s=!0,stencil:r=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:f=!1,reversedDepthBuffer:d=!1,outputBufferType:u=Qe}=t;this.isWebGLRenderer=!0;let p;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");p=i.getContextAttributes().alpha}else p=o;let x=u,m=new Set([qa,Xa,Wa]),g=new Set([Qe,Li,Os,Ln,Va,Ga]),b=new Uint32Array(4),T=new Int32Array(4),v=new D,S=null,C=null,P=[],y=[],A=null;this.domElement=e,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=pi,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let U=this,I=!1,M=null,E=null,R=null,N=null;this._outputColorSpace=De;let O=0,F=0,V=null,k=-1,W=null,j=new xe,ht=new xe,ft=null,At=new Ft(0),wt=0,Gt=e.width,Z=e.height,K=1,dt=null,Pt=null,vt=new xe(0,0,Gt,Z),Bt=new xe(0,0,Gt,Z),ee=!1,et=new Cs,at=!1,st=!1,ot=new re,ct=new D,Ut=new xe,Rt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},It=!1;function Xt(){return V===null?K:1}let B=i;function ne(w,z){return e.getContext(w,z)}let jt,L,_,G,X,Q,ut,pt,$,nt,xt,kt,gt,mt,Lt,Ht,Zt,H,_t,it,yt,Et,lt;try{let w={alpha:!0,depth:s,stencil:r,antialias:a,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:f};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${"186"}`),e.addEventListener("webglcontextlost",_e,!1),e.addEventListener("webglcontextrestored",ue,!1),e.addEventListener("webglcontextcreationerror",Si,!1),B===null){let z="webgl2";if(B=ne(z,w),B===null)throw ne(z)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}Vt()}catch(w){throw e.removeEventListener("webglcontextlost",_e,!1),e.removeEventListener("webglcontextrestored",ue,!1),e.removeEventListener("webglcontextcreationerror",Si,!1),Yt("WebGLRenderer: "+w.message),w}function Vt(){jt=new lx(B),jt.init(),yt=new Zv(B,jt),L=new Qg(B,jt,t,yt),_=new qv(B,jt),L.reversedDepthBuffer&&d&&_.buffers.depth.setReversed(!0),E=B.createFramebuffer(),R=B.createFramebuffer(),N=B.createFramebuffer(),G=new ux(B),X=new Iv,Q=new Yv(B,jt,_,X,L,yt,G),ut=new ax(U),pt=new fm(B),Et=new Kg(B,pt),$=new cx(B,pt,G,Et),nt=new fx(B,$,pt,Et,G),H=new dx(B,L,Q),Lt=new $g(X),xt=new Lv(U,ut,jt,L,Et,Lt),kt=new Qv(U,X),gt=new Nv,mt=new zv(jt),Zt=new jg(U,ut,_,nt,p,l),Ht=new Xv(U,nt,L),lt=new $v(B,G,L,_),_t=new Jg(B,jt,G),it=new hx(B,jt,G),G.programs=xt.programs,U.capabilities=L,U.extensions=jt,U.properties=X,U.renderLists=gt,U.shadowMap=Ht,U.state=_,U.info=G}x!==Qe&&(A=new mx(x,e.width,e.height,a,s,r));let Ot=new Dh(U,B);this.xr=Ot,this.getContext=function(){return B},this.getContextAttributes=function(){return B.getContextAttributes()},this.forceContextLoss=function(){let w=jt.get("WEBGL_lose_context");w&&w.loseContext()},this.forceContextRestore=function(){let w=jt.get("WEBGL_lose_context");w&&w.restoreContext()},this.getPixelRatio=function(){return K},this.setPixelRatio=function(w){w!==void 0&&(K=w,this.setSize(Gt,Z,!1))},this.getSize=function(w){return w.set(Gt,Z)},this.setSize=function(w,z,J=!0){if(Ot.isPresenting){qt("WebGLRenderer: Can't change size while VR device is presenting.");return}Gt=w,Z=z,e.width=Math.floor(w*K),e.height=Math.floor(z*K),J===!0&&(e.style.width=w+"px",e.style.height=z+"px"),A!==null&&A.setSize(e.width,e.height),this.setViewport(0,0,w,z)},this.getDrawingBufferSize=function(w){return w.set(Gt*K,Z*K).floor()},this.setDrawingBufferSize=function(w,z,J){Gt=w,Z=z,K=J,e.width=Math.floor(w*J),e.height=Math.floor(z*J),this.setViewport(0,0,w,z)},this.setEffects=function(w){if(x===Qe){Yt("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(w){for(let z=0;z<w.length;z++)if(w[z].isOutputPass===!0){qt("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}A.setEffects(w||[])},this.getCurrentViewport=function(w){return w.copy(j)},this.getViewport=function(w){return w.copy(vt)},this.setViewport=function(w,z,J,q){w.isVector4?vt.set(w.x,w.y,w.z,w.w):vt.set(w,z,J,q),_.viewport(j.copy(vt).multiplyScalar(K).round())},this.getScissor=function(w){return w.copy(Bt)},this.setScissor=function(w,z,J,q){w.isVector4?Bt.set(w.x,w.y,w.z,w.w):Bt.set(w,z,J,q),_.scissor(ht.copy(Bt).multiplyScalar(K).round())},this.getScissorTest=function(){return ee},this.setScissorTest=function(w){_.setScissorTest(ee=w)},this.setOpaqueSort=function(w){dt=w},this.setTransparentSort=function(w){Pt=w},this.getClearColor=function(w){return w.copy(Zt.getClearColor())},this.setClearColor=function(){Zt.setClearColor(...arguments)},this.getClearAlpha=function(){return Zt.getClearAlpha()},this.setClearAlpha=function(){Zt.setClearAlpha(...arguments)},this.clear=function(w=!0,z=!0,J=!0){let q=0;if(w){let Y=!1;if(V!==null){let St=V.texture.format;Y=m.has(St)}if(Y){let St=V.texture.type,Ct=g.has(St),bt=Zt.getClearColor(),Dt=Zt.getClearAlpha(),zt=bt.r,$t=bt.g,se=bt.b;Ct?(b[0]=zt,b[1]=$t,b[2]=se,b[3]=Dt,B.clearBufferuiv(B.COLOR,0,b)):(T[0]=zt,T[1]=$t,T[2]=se,T[3]=Dt,B.clearBufferiv(B.COLOR,0,T))}else q|=B.COLOR_BUFFER_BIT}z&&(q|=B.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),J&&(q|=B.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),q!==0&&B.clear(q)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(w){w.setRenderer(this),M=w},this.dispose=function(){e.removeEventListener("webglcontextlost",_e,!1),e.removeEventListener("webglcontextrestored",ue,!1),e.removeEventListener("webglcontextcreationerror",Si,!1),Zt.dispose(),gt.dispose(),mt.dispose(),X.dispose(),ut.dispose(),nt.dispose(),Et.dispose(),lt.dispose(),xt.dispose(),Ot.dispose(),Ot.removeEventListener("sessionstart",Kh),Ot.removeEventListener("sessionend",Jh),Nn.stop()};function _e(w){w.preventDefault(),fr("WebGLRenderer: Context Lost."),I=!0}function ue(){fr("WebGLRenderer: Context Restored."),I=!1;let w=G.autoReset,z=Ht.enabled,J=Ht.autoUpdate,q=Ht.needsUpdate,Y=Ht.type;Vt(),G.autoReset=w,Ht.enabled=z,Ht.autoUpdate=J,Ht.needsUpdate=q,Ht.type=Y}function Si(w){Yt("WebGLRenderer: A WebGL context could not be created. Reason: ",w.statusMessage)}function Ni(w){let z=w.target;z.removeEventListener("dispose",Ni),Lf(z)}function Lf(w){If(w),X.remove(w)}function If(w){let z=X.get(w).programs;z!==void 0&&(z.forEach(function(J){xt.releaseProgram(J)}),w.isShaderMaterial&&xt.releaseShaderCache(w))}this.renderBufferDirect=function(w,z,J,q,Y,St){z===null&&(z=Rt);let Ct=Y.isMesh&&Y.matrixWorld.determinantAffine()<0,bt=Uf(w,z,J,q,Y);_.setMaterial(q,Ct);let Dt=J.index,zt=1;if(q.wireframe===!0){if(Dt=$.getWireframeAttribute(J),Dt===void 0)return;zt=2}let $t=J.drawRange,se=J.attributes.position,Nt=$t.start*zt,de=($t.start+$t.count)*zt;St!==null&&(Nt=Math.max(Nt,St.start*zt),de=Math.min(de,(St.start+St.count)*zt)),Dt!==null?(Nt=Math.max(Nt,0),de=Math.min(de,Dt.count)):se!=null&&(Nt=Math.max(Nt,0),de=Math.min(de,se.count));let Re=de-Nt;if(Re<0||Re===1/0)return;Et.setup(Y,q,bt,J,Dt);let Me,ge=_t;if(Dt!==null&&(Me=pt.get(Dt),ge=it,ge.setIndex(Me)),Y.isMesh)q.wireframe===!0?(_.setLineWidth(q.wireframeLinewidth*Xt()),ge.setMode(B.LINES)):ge.setMode(B.TRIANGLES);else if(Y.isLine){let je=q.linewidth;je===void 0&&(je=1),_.setLineWidth(je*Xt()),Y.isLineSegments?ge.setMode(B.LINES):Y.isLineLoop?ge.setMode(B.LINE_LOOP):ge.setMode(B.LINE_STRIP)}else Y.isPoints?ge.setMode(B.POINTS):Y.isSprite&&ge.setMode(B.TRIANGLES);if(Y.isBatchedMesh)if(jt.get("WEBGL_multi_draw"))ge.renderMultiDraw(Y._multiDrawStarts,Y._multiDrawCounts,Y._multiDrawCount);else{let je=Y._multiDrawStarts,Tt=Y._multiDrawCounts,ti=Y._multiDrawCount,ae=Dt?pt.get(Dt).bytesPerElement:1,mi=X.get(q).currentProgram.getUniforms();for(let Ui=0;Ui<ti;Ui++)mi.setValue(B,"_gl_DrawID",Ui),ge.render(je[Ui]/ae,Tt[Ui])}else if(Y.isInstancedMesh)ge.renderInstances(Nt,Re,Y.count);else if(J.isInstancedBufferGeometry){let je=J._maxInstanceCount!==void 0?J._maxInstanceCount:1/0,Tt=Math.min(J.instanceCount,je);ge.renderInstances(Nt,Re,Tt)}else ge.render(Nt,Re)};function jh(w,z,J,q){M!==null&&w.isNodeMaterial&&M.setObject(q,w),at===!0&&Lt.setState(w,J,!1),w.transparent===!0&&w.side===Le&&w.forceSinglePass===!1?(w.side=Ye,w.needsUpdate=!0,wo(w,z,q),w.side=An,w.needsUpdate=!0,wo(w,z,q),w.side=Le):wo(w,z,q)}this.compile=function(w,z,J=null){J===null&&(J=w),M!==null&&M.renderStart(w,z,J),C=mt.get(J),C.init(z),y.push(C),J.traverseVisible(function(Y){Y.isLight&&Y.layers.test(z.layers)&&(C.pushLight(Y),Y.castShadow&&C.pushShadow(Y))}),w!==J&&w.traverseVisible(function(Y){Y.isLight&&Y.layers.test(z.layers)&&(C.pushLight(Y),Y.castShadow&&C.pushShadow(Y))}),C.setupLights(),M!==null&&M.updateLights(C.state.lightsArray),st=this.localClippingEnabled,at=Lt.init(this.clippingPlanes,st),at===!0&&Lt.setGlobalState(this.clippingPlanes,z),M!==null&&Ht.render(C.state.shadowsArray,J,z);let q=new Set;return w.traverse(function(Y){if(!(Y.isMesh||Y.isPoints||Y.isLine||Y.isSprite))return;let St=Y.material;if(St)if(Array.isArray(St))for(let Ct=0;Ct<St.length;Ct++){let bt=St[Ct];jh(bt,J,z,Y),q.add(bt)}else jh(St,J,z,Y),q.add(St)}),C=y.pop(),M!==null&&M.renderEnd(),q},this.compileAsync=function(w,z,J=null){let q=this.compile(w,z,J);return new Promise(Y=>{function St(){if(q.forEach(function(Ct){let Dt=X.get(Ct).currentProgram;(Dt===void 0||Dt.isReady())&&q.delete(Ct)}),q.size===0){Y(w);return}setTimeout(St,10)}jt.get("KHR_parallel_shader_compile")!==null?St():setTimeout(St,10)})};let rc=null;function Df(w){rc&&rc(w)}function Kh(){Nn.stop()}function Jh(){Nn.start()}let Nn=new jd;Nn.setAnimationLoop(Df),typeof self<"u"&&Nn.setContext(self),this.setAnimationLoop=function(w){rc=w,Ot.setAnimationLoop(w),w===null?Nn.stop():Nn.start()},Ot.addEventListener("sessionstart",Kh),Ot.addEventListener("sessionend",Jh),this.render=function(w,z){if(z!==void 0&&z.isCamera!==!0){Yt("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(I===!0)return;M!==null&&M.renderStart(w,z);let J=Ot.enabled===!0&&Ot.isPresenting===!0,q=A!==null&&(V===null||J)&&A.begin(U,V);if(w.matrixWorldAutoUpdate===!0&&w.updateMatrixWorld(),z.parent===null&&z.matrixWorldAutoUpdate===!0&&z.updateMatrixWorld(),Ot.enabled===!0&&Ot.isPresenting===!0&&(A===null||A.isCompositing()===!1)&&(Ot.cameraAutoUpdate===!0&&Ot.updateCamera(z),z=Ot.getCamera()),w.isScene===!0&&w.onBeforeRender(U,w,z,V),C=mt.get(w,y.length),C.init(z),C.state.textureUnits=Q.getTextureUnits(),y.push(C),ot.multiplyMatrices(z.projectionMatrix,z.matrixWorldInverse),et.setFromProjectionMatrix(ot,Ci,z.reversedDepth),st=this.localClippingEnabled,at=Lt.init(this.clippingPlanes,st),S=gt.get(w,P.length),S.init(),P.push(S),Ot.enabled===!0&&Ot.isPresenting===!0){let Ct=U.xr.getDepthSensingMesh();Ct!==null&&oc(Ct,z,-1/0,U.sortObjects)}oc(w,z,0,U.sortObjects),S.finish(),M!==null&&M.updateLights(C.state.lightsArray),U.sortObjects===!0&&S.sort(dt,Pt),It=Ot.enabled===!1||Ot.isPresenting===!1||Ot.hasDepthSensing()===!1,It&&Zt.addToRenderList(S,w),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),at===!0&&Lt.beginShadows();let Y=C.state.shadowsArray;if(Ht.render(Y,w,z),at===!0&&Lt.endShadows(),(q&&A.hasRenderPass())===!1){let Ct=S.opaque,bt=S.transmissive;if(C.setupLights(),z.isArrayCamera){let Dt=z.cameras;if(bt.length>0)for(let zt=0,$t=Dt.length;zt<$t;zt++){let se=Dt[zt];$h(Ct,bt,w,se)}It&&Zt.render(w);for(let zt=0,$t=Dt.length;zt<$t;zt++){let se=Dt[zt];Qh(S,w,se,se.viewport)}}else bt.length>0&&$h(Ct,bt,w,z),It&&Zt.render(w),Qh(S,w,z)}V!==null&&F===0&&(Q.updateMultisampleRenderTarget(V),Q.updateRenderTargetMipmap(V)),q&&A.end(U),w.isScene===!0&&w.onAfterRender(U,w,z),Et.resetDefaultState(),k=-1,W=null,y.pop(),y.length>0?(C=y[y.length-1],Q.setTextureUnits(C.state.textureUnits),at===!0&&Lt.setGlobalState(U.clippingPlanes,C.state.camera)):C=null,P.pop(),P.length>0?S=P[P.length-1]:S=null,M!==null&&M.renderEnd()};function oc(w,z,J,q){if(w.visible===!1)return;if(w.layers.test(z.layers)){if(w.isGroup)J=w.renderOrder;else if(w.isLOD)w.autoUpdate===!0&&w.update(z);else if(w.isLightProbeGrid)C.pushLightProbeGrid(w);else if(w.isLight)C.pushLight(w),w.castShadow&&C.pushShadow(w);else if(w.isSprite){if(!w.frustumCulled||w.intersectsFrustum(et)){q&&Ut.setFromMatrixPosition(w.matrixWorld).applyMatrix4(ot);let Ct=nt.update(w),bt=w.material;bt.visible&&S.push(w,Ct,bt,J,Ut.z,null,z)}}else if((w.isMesh||w.isLine||w.isPoints)&&(!w.frustumCulled||w.intersectsFrustum(et))){let Ct=nt.update(w),bt=w.material;if(q&&(w.boundingSphere!==void 0?(w.boundingSphere===null&&w.computeBoundingSphere(),Ut.copy(w.boundingSphere.center)):(Ct.boundingSphere===null&&Ct.computeBoundingSphere(),Ut.copy(Ct.boundingSphere.center)),Ut.applyMatrix4(w.matrixWorld).applyMatrix4(ot)),Array.isArray(bt)){let Dt=Ct.groups;for(let zt=0,$t=Dt.length;zt<$t;zt++){let se=Dt[zt],Nt=bt[se.materialIndex];Nt&&Nt.visible&&S.push(w,Ct,Nt,J,Ut.z,se,z)}}else bt.visible&&S.push(w,Ct,bt,J,Ut.z,null,z)}}let St=w.children;for(let Ct=0,bt=St.length;Ct<bt;Ct++)oc(St[Ct],z,J,q)}function Qh(w,z,J,q){let{opaque:Y,transmissive:St,transparent:Ct}=w;C.setupLightsView(J),at===!0&&Lt.setGlobalState(U.clippingPlanes,J),q&&_.viewport(j.copy(q)),Y.length>0&&So(Y,z,J),St.length>0&&So(St,z,J),Ct.length>0&&So(Ct,z,J),_.buffers.depth.setTest(!0),_.buffers.depth.setMask(!0),_.buffers.color.setMask(!0),_.setPolygonOffset(!1)}function $h(w,z,J,q){if((J.isScene===!0?J.overrideMaterial:null)!==null)return;if(C.state.transmissionRenderTarget[q.id]===void 0){let Nt=jt.has("EXT_color_buffer_half_float")||jt.has("EXT_color_buffer_float");C.state.transmissionRenderTarget[q.id]=new he(1,1,{generateMipmaps:!0,type:Nt?ve:Qe,minFilter:Pn,samples:Math.max(4,L.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:ie.workingColorSpace})}let St=C.state.transmissionRenderTarget[q.id],Ct=q.viewport||j;St.setSize(Ct.z*U.transmissionResolutionScale,Ct.w*U.transmissionResolutionScale);let bt=U.getRenderTarget(),Dt=U.getActiveCubeFace(),zt=U.getActiveMipmapLevel();U.setRenderTarget(St),U.getClearColor(At),wt=U.getClearAlpha(),wt<1&&U.setClearColor(16777215,.5),U.clear(),It&&Zt.render(J);let $t=U.toneMapping;U.toneMapping=pi;let se=q.viewport;if(q.viewport!==void 0&&(q.viewport=void 0),C.setupLightsView(q),at===!0&&Lt.setGlobalState(U.clippingPlanes,q),So(w,J,q),Q.updateMultisampleRenderTarget(St),Q.updateRenderTargetMipmap(St),jt.has("WEBGL_multisampled_render_to_texture")===!1){let Nt=!1;for(let de=0,Re=z.length;de<Re;de++){let Me=z[de],{object:ge,geometry:je,material:Tt,group:ti}=Me;if(Tt.side===Le&&ge.layers.test(q.layers)){let ae=Tt.side;Tt.side=Ye,Tt.needsUpdate=!0,tu(ge,J,q,je,Tt,ti),Tt.side=ae,Tt.needsUpdate=!0,Nt=!0}}Nt===!0&&(Q.updateMultisampleRenderTarget(St),Q.updateRenderTargetMipmap(St))}U.setRenderTarget(bt,Dt,zt),U.setClearColor(At,wt),se!==void 0&&(q.viewport=se),U.toneMapping=$t}function So(w,z,J){let q=z.isScene===!0?z.overrideMaterial:null;for(let Y=0,St=w.length;Y<St;Y++){let Ct=w[Y],{object:bt,geometry:Dt,group:zt}=Ct,$t=Ct.material;$t.allowOverride===!0&&q!==null&&($t=q),bt.layers.test(J.layers)&&tu(bt,z,J,Dt,$t,zt)}}function tu(w,z,J,q,Y,St){M!==null&&Y.isNodeMaterial&&M.setObject(w,Y),w.onBeforeRender(U,z,J,q,Y,St),w.modelViewMatrix.multiplyMatrices(J.matrixWorldInverse,w.matrixWorld),w.normalMatrix.getNormalMatrix(w.modelViewMatrix),Y.onBeforeRender(U,z,J,q,w,St),Y.transparent===!0&&Y.side===Le&&Y.forceSinglePass===!1?(Y.side=Ye,Y.needsUpdate=!0,U.renderBufferDirect(J,z,q,Y,w,St),Y.side=An,Y.needsUpdate=!0,U.renderBufferDirect(J,z,q,Y,w,St),Y.side=Le):U.renderBufferDirect(J,z,q,Y,w,St),w.onAfterRender(U,z,J,q,Y,St)}function wo(w,z,J){z.isScene!==!0&&(z=Rt);let q=X.get(w),Y=C.state.lights,St=C.state.shadowsArray,Ct=Y.state.version,bt=xt.getParameters(w,Y.state,St,z,J,C.state.lightProbeGridArray),Dt=xt.getProgramCacheKey(bt),zt=q.programs;q.environment=w.isMeshStandardMaterial||w.isMeshLambertMaterial||w.isMeshPhongMaterial?z.environment:null,q.fog=z.fog;let $t=w.isMeshStandardMaterial||w.isMeshLambertMaterial&&!w.envMap||w.isMeshPhongMaterial&&!w.envMap;q.envMap=ut.get(w.envMap||q.environment,$t),q.envMapRotation=q.environment!==null&&w.envMap===null?z.environmentRotation:w.envMapRotation,zt===void 0&&(w.addEventListener("dispose",Ni),zt=new Map,q.programs=zt);let se=zt.get(Dt);if(se!==void 0){if(q.currentProgram===se&&q.lightsStateVersion===Ct)return iu(w,bt),se}else bt.uniforms=xt.getUniforms(w),M!==null&&w.isNodeMaterial&&M.build(w,J,bt),w.onBeforeCompile(bt,U),se=xt.acquireProgram(bt,Dt),zt.set(Dt,se),q.uniforms=bt.uniforms;let Nt=q.uniforms;return(!w.isShaderMaterial&&!w.isRawShaderMaterial||w.clipping===!0)&&(Nt.clippingPlanes=Lt.uniform),iu(w,bt),q.needsLights=Of(w),q.lightsStateVersion=Ct,q.needsLights&&(Nt.ambientLightColor.value=Y.state.ambient,Nt.lightProbe.value=Y.state.probe,Nt.sunLights.value=Y.state.sun,Nt.sunLightShadows.value=Y.state.sunShadow,Nt.directionalLights.value=Y.state.directional,Nt.directionalLightShadows.value=Y.state.directionalShadow,Nt.spotLights.value=Y.state.spot,Nt.spotLightShadows.value=Y.state.spotShadow,Nt.rectAreaLights.value=Y.state.rectArea,Nt.ltc_1.value=Y.state.rectAreaLTC1,Nt.ltc_2.value=Y.state.rectAreaLTC2,Nt.pointLights.value=Y.state.point,Nt.pointLightShadows.value=Y.state.pointShadow,Nt.hemisphereLights.value=Y.state.hemi,Nt.sunShadowMatrix.value=Y.state.sunShadowMatrix,Nt.sunShadowCascade.value=Y.state.sunShadowCascade,Nt.directionalShadowMatrix.value=Y.state.directionalShadowMatrix,Nt.spotLightMatrix.value=Y.state.spotLightMatrix,Nt.spotLightMap.value=Y.state.spotLightMap,Nt.pointShadowMatrix.value=Y.state.pointShadowMatrix),q.lightProbeGrid=C.state.lightProbeGridArray.length>0,q.currentProgram=se,q.uniformsList=null,se}function eu(w){if(w.uniformsList===null){let z=w.currentProgram.getUniforms();w.uniformsList=Hs.seqWithValue(z.seq,w.uniforms)}return w.uniformsList}function iu(w,z){let J=X.get(w);J.outputColorSpace=z.outputColorSpace,J.batching=z.batching,J.batchingColor=z.batchingColor,J.instancing=z.instancing,J.instancingColor=z.instancingColor,J.instancingMorph=z.instancingMorph,J.skinning=z.skinning,J.morphTargets=z.morphTargets,J.morphNormals=z.morphNormals,J.morphColors=z.morphColors,J.morphTargetsCount=z.morphTargetsCount,J.numClippingPlanes=z.numClippingPlanes,J.numIntersection=z.numClipIntersection,J.vertexAlphas=z.vertexAlphas,J.vertexTangents=z.vertexTangents,J.toneMapping=z.toneMapping}function Nf(w,z){if(w.length===0)return null;if(w.length===1)return w[0].texture!==null?w[0]:null;v.setFromMatrixPosition(z.matrixWorld);for(let J=0,q=w.length;J<q;J++){let Y=w[J];if(Y.texture!==null&&Y.boundingBox.containsPoint(v))return Y}return null}function Uf(w,z,J,q,Y){z.isScene!==!0&&(z=Rt),Q.resetTextureUnits();let St=z.fog,Ct=q.isMeshStandardMaterial||q.isMeshLambertMaterial||q.isMeshPhongMaterial?z.environment:null,bt=V===null?U.outputColorSpace:V.isXRRenderTarget===!0?V.texture.colorSpace:ie.workingColorSpace,Dt=q.isMeshStandardMaterial||q.isMeshLambertMaterial&&!q.envMap||q.isMeshPhongMaterial&&!q.envMap,zt=ut.get(q.envMap||Ct,Dt),$t=q.vertexColors===!0&&!!J.attributes.color&&J.attributes.color.itemSize===4,se=!!J.attributes.tangent&&(!!q.normalMap||q.anisotropy>0),Nt=!!J.morphAttributes.position,de=!!J.morphAttributes.normal,Re=!!J.morphAttributes.color,Me=pi;q.toneMapped&&(V===null||V.isXRRenderTarget===!0)&&(Me=U.toneMapping);let ge=J.morphAttributes.position||J.morphAttributes.normal||J.morphAttributes.color,je=ge!==void 0?ge.length:0,Tt=X.get(q),ti=C.state.lights;if(at===!0&&(st===!0||w!==W)){let ye=w===W&&q.id===k;Lt.setState(q,w,ye)}let ae=!1;q.version===Tt.__version?(Tt.needsLights&&Tt.lightsStateVersion!==ti.state.version||Tt.outputColorSpace!==bt||Y.isBatchedMesh&&Tt.batching===!1||!Y.isBatchedMesh&&Tt.batching===!0||Y.isBatchedMesh&&Tt.batchingColor===!0&&Y._colorsTexture===null||Y.isBatchedMesh&&Tt.batchingColor===!1&&Y._colorsTexture!==null||Y.isInstancedMesh&&Tt.instancing===!1||!Y.isInstancedMesh&&Tt.instancing===!0||Y.isSkinnedMesh&&Tt.skinning===!1||!Y.isSkinnedMesh&&Tt.skinning===!0||Y.isInstancedMesh&&Tt.instancingColor===!0&&Y.instanceColor===null||Y.isInstancedMesh&&Tt.instancingColor===!1&&Y.instanceColor!==null||Y.isInstancedMesh&&Tt.instancingMorph===!0&&Y.morphTexture===null||Y.isInstancedMesh&&Tt.instancingMorph===!1&&Y.morphTexture!==null||Tt.envMap!==zt||q.fog===!0&&Tt.fog!==St||Tt.numClippingPlanes!==void 0&&(Tt.numClippingPlanes!==Lt.numPlanes||Tt.numIntersection!==Lt.numIntersection)||Tt.vertexAlphas!==$t||Tt.vertexTangents!==se||Tt.morphTargets!==Nt||Tt.morphNormals!==de||Tt.morphColors!==Re||Tt.toneMapping!==Me||Tt.morphTargetsCount!==je||!!Tt.lightProbeGrid!=C.state.lightProbeGridArray.length>0)&&(ae=!0):(ae=!0,Tt.__version=q.version);let mi=Tt.currentProgram;ae===!0&&(mi=wo(q,z,Y),M&&q.isNodeMaterial&&M.onUpdateProgram(q,mi,Tt));let Ui=!1,ln=!1,Qn=!1,me=mi.getUniforms(),Te=Tt.uniforms;if(_.useProgram(mi.program)&&(Ui=!0,ln=!0,Qn=!0),q.id!==k&&(k=q.id,ln=!0),Tt.needsLights){let ye=Nf(C.state.lightProbeGridArray,Y);Tt.lightProbeGrid!==ye&&(Tt.lightProbeGrid=ye,ln=!0)}if(Ui||W!==w){_.buffers.depth.getReversed()&&w.reversedDepth!==!0&&(w._reversedDepth=!0,w.updateProjectionMatrix()),me.setValue(B,"projectionMatrix",w.projectionMatrix),me.setValue(B,"viewMatrix",w.matrixWorldInverse);let hn=me.map.cameraPosition;hn!==void 0&&hn.setValue(B,ct.setFromMatrixPosition(w.matrixWorld)),L.logarithmicDepthBuffer&&me.setValue(B,"logDepthBufFC",2/(Math.log(w.far+1)/Math.LN2)),(q.isMeshPhongMaterial||q.isMeshToonMaterial||q.isMeshLambertMaterial||q.isMeshBasicMaterial||q.isMeshStandardMaterial||q.isShaderMaterial)&&me.setValue(B,"isOrthographic",w.isOrthographicCamera===!0),W!==w&&(W=w,ln=!0,Qn=!0)}if(Tt.needsLights&&(ti.state.sunShadowMap.length>0&&me.setValue(B,"sunShadowMap",ti.state.sunShadowMap,Q),ti.state.directionalShadowMap.length>0&&me.setValue(B,"directionalShadowMap",ti.state.directionalShadowMap,Q),ti.state.spotShadowMap.length>0&&me.setValue(B,"spotShadowMap",ti.state.spotShadowMap,Q),ti.state.pointShadowMap.length>0&&me.setValue(B,"pointShadowMap",ti.state.pointShadowMap,Q)),Y.isSkinnedMesh){me.setOptional(B,Y,"bindMatrix"),me.setOptional(B,Y,"bindMatrixInverse");let ye=Y.skeleton;ye&&(ye.boneTexture===null&&ye.computeBoneTexture(),me.setValue(B,"boneTexture",ye.boneTexture,Q))}Y.isBatchedMesh&&(me.setOptional(B,Y,"batchingTexture"),me.setValue(B,"batchingTexture",Y._matricesTexture,Q),me.setOptional(B,Y,"batchingIdTexture"),me.setValue(B,"batchingIdTexture",Y._indirectTexture,Q),me.setOptional(B,Y,"batchingColorTexture"),Y._colorsTexture!==null&&me.setValue(B,"batchingColorTexture",Y._colorsTexture,Q));let cn=J.morphAttributes;if((cn.position!==void 0||cn.normal!==void 0||cn.color!==void 0)&&H.update(Y,J,mi),(ln||Tt.receiveShadow!==Y.receiveShadow)&&(Tt.receiveShadow=Y.receiveShadow,me.setValue(B,"receiveShadow",Y.receiveShadow)),(q.isMeshStandardMaterial||q.isMeshLambertMaterial||q.isMeshPhongMaterial)&&q.envMap===null&&z.environment!==null&&(Te.envMapIntensity.value=z.environmentIntensity),Te.dfgLUT!==void 0&&(Te.dfgLUT.value=e_()),ln){if(me.setValue(B,"toneMappingExposure",U.toneMappingExposure),Tt.needsLights&&Ff(Te,Qn),St&&q.fog===!0&&kt.refreshFogUniforms(Te,St),kt.refreshMaterialUniforms(Te,q,K,Z,C.state.transmissionRenderTarget[w.id]),Tt.needsLights&&Tt.lightProbeGrid){let ye=Tt.lightProbeGrid;Te.probesSH.value=ye.texture,Te.probesMin.value.copy(ye.boundingBox.min),Te.probesMax.value.copy(ye.boundingBox.max),Te.probesResolution.value.copy(ye.resolution)}Hs.upload(B,eu(Tt),Te,Q)}if(q.isShaderMaterial&&q.uniformsNeedUpdate===!0&&(Hs.upload(B,eu(Tt),Te,Q),q.uniformsNeedUpdate=!1),q.isSpriteMaterial&&me.setValue(B,"center",Y.center),me.setValue(B,"modelViewMatrix",Y.modelViewMatrix),me.setValue(B,"normalMatrix",Y.normalMatrix),me.setValue(B,"modelMatrix",Y.matrixWorld),q.uniformsGroups!==void 0){let ye=q.uniformsGroups;for(let hn=0,$n=ye.length;hn<$n;hn++){let su=ye[hn];lt.update(su,mi),lt.bind(su,mi)}}return mi}function Ff(w,z){w.ambientLightColor.needsUpdate=z,w.lightProbe.needsUpdate=z,w.sunLights.needsUpdate=z,w.sunLightShadows.needsUpdate=z,w.directionalLights.needsUpdate=z,w.directionalLightShadows.needsUpdate=z,w.pointLights.needsUpdate=z,w.pointLightShadows.needsUpdate=z,w.spotLights.needsUpdate=z,w.spotLightShadows.needsUpdate=z,w.rectAreaLights.needsUpdate=z,w.hemisphereLights.needsUpdate=z}function Of(w){return w.isMeshLambertMaterial||w.isMeshToonMaterial||w.isMeshPhongMaterial||w.isMeshStandardMaterial||w.isShadowMaterial||w.isShaderMaterial&&w.lights===!0}this.getActiveCubeFace=function(){return O},this.getActiveMipmapLevel=function(){return F},this.getRenderTarget=function(){return V},this.setRenderTargetTextures=function(w,z,J){let q=X.get(w);q.__autoAllocateDepthBuffer=w.resolveDepthBuffer===!1,q.__autoAllocateDepthBuffer===!1&&(q.__useRenderToTexture=!1),X.get(w.texture).__webglTexture=z,X.get(w.depthTexture).__webglTexture=q.__autoAllocateDepthBuffer?void 0:J,q.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(w,z){let J=X.get(w);J.__webglFramebuffer=z,J.__useDefaultFramebuffer=z===void 0},this.setRenderTarget=function(w,z=0,J=0){V=w,O=z,F=J;let q=null,Y=!1,St=!1;if(w){let bt=X.get(w);if(bt.__useDefaultFramebuffer!==void 0){_.bindFramebuffer(B.FRAMEBUFFER,bt.__webglFramebuffer),j.copy(w.viewport),ht.copy(w.scissor),ft=w.scissorTest,_.viewport(j),_.scissor(ht),_.setScissorTest(ft),k=-1;return}else if(bt.__webglFramebuffer===void 0)Q.setupRenderTarget(w);else if(bt.__hasExternalTextures)Q.rebindTextures(w,X.get(w.texture).__webglTexture,X.get(w.depthTexture).__webglTexture);else if(w.depthBuffer){let $t=w.depthTexture;if(bt.__boundDepthTexture!==$t){if($t!==null&&X.has($t)&&(w.width!==$t.image.width||w.height!==$t.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");Q.setupDepthRenderbuffer(w)}}let Dt=w.texture;(Dt.isData3DTexture||Dt.isDataArrayTexture||Dt.isCompressedArrayTexture)&&(St=!0);let zt=X.get(w).__webglFramebuffer;w.isWebGLCubeRenderTarget?(Array.isArray(zt[z])?q=zt[z][J]:q=zt[z],Y=!0):w.samples>0&&Q.useMultisampledRTT(w)===!1?q=X.get(w).__webglMultisampledFramebuffer:Array.isArray(zt)?q=zt[J]:q=zt,j.copy(w.viewport),ht.copy(w.scissor),ft=w.scissorTest}else j.copy(vt).multiplyScalar(K).floor(),ht.copy(Bt).multiplyScalar(K).floor(),ft=ee;if(J!==0&&(q=E),_.bindFramebuffer(B.FRAMEBUFFER,q)&&_.drawBuffers(w,q),_.viewport(j),_.scissor(ht),_.setScissorTest(ft),Y){let bt=X.get(w.texture);B.framebufferTexture2D(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_CUBE_MAP_POSITIVE_X+z,bt.__webglTexture,J)}else if(St){let bt=z;for(let Dt=0;Dt<w.textures.length;Dt++){let zt=X.get(w.textures[Dt]);B.framebufferTextureLayer(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0+Dt,zt.__webglTexture,J,bt)}}else if(w!==null&&J!==0){let bt=X.get(w.texture);B.framebufferTexture2D(B.FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_2D,bt.__webglTexture,J)}k=-1};function nu(w){let z=X.get(w);return(z.__readFormat!==w.format||z.__readType!==w.type)&&(z.__readFormat=w.format,z.__readType=w.type,z.__formatReadable=L.textureFormatReadable(w.format),z.__typeReadable=L.textureTypeReadable(w.type)),z}this.readRenderTargetPixels=function(w,z,J,q,Y,St,Ct,bt=0){if(!(w&&w.isWebGLRenderTarget)){Yt("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Dt=X.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&Ct!==void 0&&(Dt=Dt[Ct]),Dt){_.bindFramebuffer(B.FRAMEBUFFER,Dt);try{let zt=w.textures[bt],$t=zt.format,se=zt.type;w.textures.length>1&&B.readBuffer(B.COLOR_ATTACHMENT0+bt);let Nt=nu(zt);if(Nt.__formatReadable===!1){Yt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(Nt.__typeReadable===!1){Yt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}z>=0&&z<=w.width-q&&J>=0&&J<=w.height-Y&&B.readPixels(z,J,q,Y,yt.convert($t),yt.convert(se),St)}finally{let zt=V!==null?X.get(V).__webglFramebuffer:null;_.bindFramebuffer(B.FRAMEBUFFER,zt)}}},this.readRenderTargetPixelsAsync=async function(w,z,J,q,Y,St,Ct,bt=0){if(!(w&&w.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Dt=X.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&Ct!==void 0&&(Dt=Dt[Ct]),Dt)if(z>=0&&z<=w.width-q&&J>=0&&J<=w.height-Y){_.bindFramebuffer(B.FRAMEBUFFER,Dt);let zt=w.textures[bt],$t=zt.format,se=zt.type;w.textures.length>1&&B.readBuffer(B.COLOR_ATTACHMENT0+bt);let Nt=nu(zt);if(Nt.__formatReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(Nt.__typeReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let de=B.createBuffer();B.bindBuffer(B.PIXEL_PACK_BUFFER,de),B.bufferData(B.PIXEL_PACK_BUFFER,St.byteLength,B.STREAM_READ),B.readPixels(z,J,q,Y,yt.convert($t),yt.convert(se),0),B.bindBuffer(B.PIXEL_PACK_BUFFER,null);let Re=V!==null?X.get(V).__webglFramebuffer:null;_.bindFramebuffer(B.FRAMEBUFFER,Re);let Me=B.fenceSync(B.SYNC_GPU_COMMANDS_COMPLETE,0);return B.flush(),await vd(B,Me,4),B.bindBuffer(B.PIXEL_PACK_BUFFER,de),B.getBufferSubData(B.PIXEL_PACK_BUFFER,0,St),B.bindBuffer(B.PIXEL_PACK_BUFFER,null),B.deleteBuffer(de),B.deleteSync(Me),St}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(w,z=null,J=0){let q=Math.pow(2,-J),Y=Math.floor(w.image.width*q),St=Math.floor(w.image.height*q),Ct=z!==null?z.x:0,bt=z!==null?z.y:0;Q.setTexture2D(w,0),B.copyTexSubImage2D(B.TEXTURE_2D,J,0,0,Ct,bt,Y,St),_.unbindTexture()},this.copyTextureToTexture=function(w,z,J=null,q=null,Y=0,St=0){let Ct,bt,Dt,zt,$t,se,Nt,de,Re,Me=w.isCompressedTexture?w.mipmaps[St]:w.image;if(J!==null)Ct=J.max.x-J.min.x,bt=J.max.y-J.min.y,Dt=J.isBox3?J.max.z-J.min.z:1,zt=J.min.x,$t=J.min.y,se=J.isBox3?J.min.z:0;else{let Te=Math.pow(2,-Y);Ct=Math.floor(Me.width*Te),bt=Math.floor(Me.height*Te),w.isDataArrayTexture?Dt=Me.depth:w.isData3DTexture?Dt=Math.floor(Me.depth*Te):Dt=1,zt=0,$t=0,se=0}q!==null?(Nt=q.x,de=q.y,Re=q.z):(Nt=0,de=0,Re=0);let ge=yt.convert(z.format),je=yt.convert(z.type),Tt;z.isData3DTexture?(Q.setTexture3D(z,0),Tt=B.TEXTURE_3D):z.isDataArrayTexture||z.isCompressedArrayTexture?(Q.setTexture2DArray(z,0),Tt=B.TEXTURE_2D_ARRAY):(Q.setTexture2D(z,0),Tt=B.TEXTURE_2D),_.activeTexture(B.TEXTURE0),_.pixelStorei(B.UNPACK_FLIP_Y_WEBGL,z.flipY),_.pixelStorei(B.UNPACK_PREMULTIPLY_ALPHA_WEBGL,z.premultiplyAlpha),_.pixelStorei(B.UNPACK_ALIGNMENT,z.unpackAlignment);let ti=_.getParameter(B.UNPACK_ROW_LENGTH),ae=_.getParameter(B.UNPACK_IMAGE_HEIGHT),mi=_.getParameter(B.UNPACK_SKIP_PIXELS),Ui=_.getParameter(B.UNPACK_SKIP_ROWS),ln=_.getParameter(B.UNPACK_SKIP_IMAGES);_.pixelStorei(B.UNPACK_ROW_LENGTH,Me.width),_.pixelStorei(B.UNPACK_IMAGE_HEIGHT,Me.height),_.pixelStorei(B.UNPACK_SKIP_PIXELS,zt),_.pixelStorei(B.UNPACK_SKIP_ROWS,$t),_.pixelStorei(B.UNPACK_SKIP_IMAGES,se);let Qn=w.isDataArrayTexture||w.isData3DTexture,me=z.isDataArrayTexture||z.isData3DTexture;if(w.isDepthTexture){let Te=X.get(w),cn=X.get(z),ye=X.get(Te.__renderTarget),hn=X.get(cn.__renderTarget);_.bindFramebuffer(B.READ_FRAMEBUFFER,ye.__webglFramebuffer),_.bindFramebuffer(B.DRAW_FRAMEBUFFER,hn.__webglFramebuffer);for(let $n=0;$n<Dt;$n++)Qn&&(B.framebufferTextureLayer(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,X.get(w).__webglTexture,Y,se+$n),B.framebufferTextureLayer(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,X.get(z).__webglTexture,St,Re+$n)),B.blitFramebuffer(zt,$t,Ct,bt,Nt,de,Ct,bt,B.DEPTH_BUFFER_BIT,B.NEAREST);_.bindFramebuffer(B.READ_FRAMEBUFFER,null),_.bindFramebuffer(B.DRAW_FRAMEBUFFER,null)}else if(Y!==0||w.isRenderTargetTexture||X.has(w)){let Te=X.get(w),cn=X.get(z);_.bindFramebuffer(B.READ_FRAMEBUFFER,R),_.bindFramebuffer(B.DRAW_FRAMEBUFFER,N);for(let ye=0;ye<Dt;ye++)Qn?B.framebufferTextureLayer(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,Te.__webglTexture,Y,se+ye):B.framebufferTexture2D(B.READ_FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_2D,Te.__webglTexture,Y),me?B.framebufferTextureLayer(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,cn.__webglTexture,St,Re+ye):B.framebufferTexture2D(B.DRAW_FRAMEBUFFER,B.COLOR_ATTACHMENT0,B.TEXTURE_2D,cn.__webglTexture,St),Y!==0?B.blitFramebuffer(zt,$t,Ct,bt,Nt,de,Ct,bt,B.COLOR_BUFFER_BIT,B.NEAREST):me?B.copyTexSubImage3D(Tt,St,Nt,de,Re+ye,zt,$t,Ct,bt):B.copyTexSubImage2D(Tt,St,Nt,de,zt,$t,Ct,bt);_.bindFramebuffer(B.READ_FRAMEBUFFER,null),_.bindFramebuffer(B.DRAW_FRAMEBUFFER,null)}else me?w.isDataTexture||w.isData3DTexture?B.texSubImage3D(Tt,St,Nt,de,Re,Ct,bt,Dt,ge,je,Me.data):z.isCompressedArrayTexture?B.compressedTexSubImage3D(Tt,St,Nt,de,Re,Ct,bt,Dt,ge,Me.data):B.texSubImage3D(Tt,St,Nt,de,Re,Ct,bt,Dt,ge,je,Me):w.isDataTexture?B.texSubImage2D(B.TEXTURE_2D,St,Nt,de,Ct,bt,ge,je,Me.data):w.isCompressedTexture?B.compressedTexSubImage2D(B.TEXTURE_2D,St,Nt,de,Me.width,Me.height,ge,Me.data):B.texSubImage2D(B.TEXTURE_2D,St,Nt,de,Ct,bt,ge,je,Me);_.pixelStorei(B.UNPACK_ROW_LENGTH,ti),_.pixelStorei(B.UNPACK_IMAGE_HEIGHT,ae),_.pixelStorei(B.UNPACK_SKIP_PIXELS,mi),_.pixelStorei(B.UNPACK_SKIP_ROWS,Ui),_.pixelStorei(B.UNPACK_SKIP_IMAGES,ln),St===0&&z.generateMipmaps&&B.generateMipmap(Tt),_.unbindTexture()},this.initRenderTarget=function(w){X.get(w).__webglFramebuffer===void 0&&Q.setupRenderTarget(w)},this.initTexture=function(w){w.isCubeTexture?Q.setTextureCube(w,0):w.isData3DTexture?Q.setTexture3D(w,0):w.isDataArrayTexture||w.isCompressedArrayTexture?Q.setTexture2DArray(w,0):Q.setTexture2D(w,0),_.unbindTexture()},this.resetState=function(){O=0,F=0,V=null,_.reset(),Et.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Ci}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;let e=this.getContext();e.drawingBufferColorSpace=ie._getDrawingBufferColorSpace(t),e.unpackColorSpace=ie._getUnpackColorSpace()}};var nf={type:"change"},Uh={type:"start"},rf={type:"end"},Ll=new xn,sf=new qe,i_=Math.cos(70*lh.DEG2RAD),Ve=new D,oi=2*Math.PI,pe={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},Nh=1e-6,Il=class extends Vr{constructor(t,e=null){super(t,e),this.state=pe.NONE,this.target=new D,this.cursor=new D,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:wn.ROTATE,MIDDLE:wn.DOLLY,RIGHT:wn.PAN},this.touches={ONE:En.ROTATE,TWO:En.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._cursorStyle="auto",this._domElementKeyEvents=null,this._lastPosition=new D,this._lastQuaternion=new ui,this._lastTargetPosition=new D,this._quat=new ui().setFromUnitVectors(t.up,new D(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new Ns,this._sphericalDelta=new Ns,this._scale=1,this._panOffset=new D,this._rotateStart=new tt,this._rotateEnd=new tt,this._rotateDelta=new tt,this._panStart=new tt,this._panEnd=new tt,this._panDelta=new tt,this._dollyStart=new tt,this._dollyEnd=new tt,this._dollyDelta=new tt,this._dollyDirection=new D,this._mouse=new tt,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=s_.bind(this),this._onPointerDown=n_.bind(this),this._onPointerUp=r_.bind(this),this._onContextMenu=d_.bind(this),this._onMouseWheel=l_.bind(this),this._onKeyDown=c_.bind(this),this._onTouchStart=h_.bind(this),this._onTouchMove=u_.bind(this),this._onMouseDown=o_.bind(this),this._onMouseMove=a_.bind(this),this._interceptControlDown=f_.bind(this),this._interceptControlUp=p_.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}set cursorStyle(t){this._cursorStyle=t,t==="grab"?this.domElement.style.cursor="grab":this.domElement.style.cursor="auto"}get cursorStyle(){return this._cursorStyle}connect(t){super.connect(t),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.state=pe.NONE,this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents();let t=this.domElement.getRootNode();t.removeEventListener("keydown",this._interceptControlDown,{capture:!0}),t.removeEventListener("keyup",this._interceptControlUp,{capture:!0}),this._controlActive=!1,this._pointers.length=0,this._pointerPositions={},this.domElement.style.touchAction="",this.domElement.style.cursor="auto"}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(t){t.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=t}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(nf),this.update(),this.state=pe.NONE}pan(t,e){this._pan(t,e),this.update()}dollyIn(t){this._dollyIn(t),this.update()}dollyOut(t){this._dollyOut(t),this.update()}rotateLeft(t){this._rotateLeft(t),this.update()}rotateUp(t){this._rotateUp(t),this.update()}update(t=null){let e=this.object.position;Ve.copy(e).sub(this.target),Ve.applyQuaternion(this._quat),this._spherical.setFromVector3(Ve),this.autoRotate&&this.state===pe.NONE&&this._rotateLeft(this._getAutoRotationAngle(t)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let i=this.minAzimuthAngle,s=this.maxAzimuthAngle;isFinite(i)&&isFinite(s)&&(i<-Math.PI?i+=oi:i>Math.PI&&(i-=oi),s<-Math.PI?s+=oi:s>Math.PI&&(s-=oi),i<=s?this._spherical.theta=Math.max(i,Math.min(s,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(i+s)/2?Math.max(i,this._spherical.theta):Math.min(s,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let r=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{let o=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),r=o!=this._spherical.radius}if(Ve.setFromSpherical(this._spherical),Ve.applyQuaternion(this._quatInverse),e.copy(this.target).add(Ve),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let o=null;if(this.object.isPerspectiveCamera){let a=Ve.length();o=this._clampDistance(a*this._scale);let l=a-o;this.object.position.addScaledVector(this._dollyDirection,l),this.object.updateMatrixWorld(),r=!!l}else if(this.object.isOrthographicCamera){let a=new D(this._mouse.x,this._mouse.y,0);a.unproject(this.object);let l=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),r=l!==this.object.zoom;let c=new D(this._mouse.x,this._mouse.y,0);c.unproject(this.object),this.object.position.sub(c).add(a),this.object.updateMatrixWorld(),o=Ve.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;o!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(o).add(this.object.position):(Ll.origin.copy(this.object.position),Ll.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(Ll.direction))<i_?this.object.lookAt(this.target):(sf.setFromNormalAndCoplanarPoint(this.object.up,this.target),Ll.intersectPlane(sf,this.target))))}else if(this.object.isOrthographicCamera){let o=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),o!==this.object.zoom&&(this.object.updateProjectionMatrix(),r=!0)}return this._scale=1,this._performCursorZoom=!1,r||this._lastPosition.distanceToSquared(this.object.position)>Nh||8*(1-this._lastQuaternion.dot(this.object.quaternion))>Nh||this._lastTargetPosition.distanceToSquared(this.target)>Nh?(this.dispatchEvent(nf),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(t){return t!==null?oi/60*this.autoRotateSpeed*t:oi/60/60*this.autoRotateSpeed}_getZoomScale(t){let e=Math.abs(t*.01);return Math.pow(.95,this.zoomSpeed*e)}_rotateLeft(t){this._sphericalDelta.theta-=t}_rotateUp(t){this._sphericalDelta.phi-=t}_panLeft(t,e){Ve.setFromMatrixColumn(e,0),Ve.multiplyScalar(-t),this._panOffset.add(Ve)}_panUp(t,e){this.screenSpacePanning===!0?Ve.setFromMatrixColumn(e,1):(Ve.setFromMatrixColumn(e,0),Ve.crossVectors(this.object.up,Ve)),Ve.multiplyScalar(t),this._panOffset.add(Ve)}_pan(t,e){let i=this.domElement;if(this.object.isPerspectiveCamera){let s=this.object.position;Ve.copy(s).sub(this.target);let r=Ve.length();r*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*t*r/i.clientHeight,this.object.matrix),this._panUp(2*e*r/i.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(t*(this.object.right-this.object.left)/this.object.zoom/i.clientWidth,this.object.matrix),this._panUp(e*(this.object.top-this.object.bottom)/this.object.zoom/i.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(t){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=t:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(t){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=t:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(t,e){if(!this.zoomToCursor)return;this._performCursorZoom=!0;let i=this.domElement.getBoundingClientRect(),s=t-i.left,r=e-i.top,o=i.width,a=i.height;this._mouse.x=s/o*2-1,this._mouse.y=-(r/a)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(t){return Math.max(this.minDistance,Math.min(this.maxDistance,t))}_handleMouseDownRotate(t){this._rotateStart.set(t.clientX,t.clientY)}_handleMouseDownDolly(t){this._updateZoomParameters(t.clientX,t.clientX),this._dollyStart.set(t.clientX,t.clientY)}_handleMouseDownPan(t){this._panStart.set(t.clientX,t.clientY)}_handleMouseMoveRotate(t){this._rotateEnd.set(t.clientX,t.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let e=this.domElement;this._rotateLeft(oi*this._rotateDelta.x/e.clientHeight),this._rotateUp(oi*this._rotateDelta.y/e.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(t){this._dollyEnd.set(t.clientX,t.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(t){this._panEnd.set(t.clientX,t.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(t){this._updateZoomParameters(t.clientX,t.clientY),t.deltaY<0?this._dollyIn(this._getZoomScale(t.deltaY)):t.deltaY>0&&this._dollyOut(this._getZoomScale(t.deltaY)),this.update()}_handleKeyDown(t){let e=!1;switch(t.code){case this.keys.UP:t.ctrlKey||t.metaKey||t.shiftKey?this.enableRotate&&this._rotateUp(oi*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),e=!0;break;case this.keys.BOTTOM:t.ctrlKey||t.metaKey||t.shiftKey?this.enableRotate&&this._rotateUp(-oi*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),e=!0;break;case this.keys.LEFT:t.ctrlKey||t.metaKey||t.shiftKey?this.enableRotate&&this._rotateLeft(oi*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),e=!0;break;case this.keys.RIGHT:t.ctrlKey||t.metaKey||t.shiftKey?this.enableRotate&&this._rotateLeft(-oi*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),e=!0;break}e&&(t.preventDefault(),this.update())}_handleTouchStartRotate(t){if(this._pointers.length===1)this._rotateStart.set(t.pageX,t.pageY);else{let e=this._getSecondPointerPosition(t),i=.5*(t.pageX+e.x),s=.5*(t.pageY+e.y);this._rotateStart.set(i,s)}}_handleTouchStartPan(t){if(this._pointers.length===1)this._panStart.set(t.pageX,t.pageY);else{let e=this._getSecondPointerPosition(t),i=.5*(t.pageX+e.x),s=.5*(t.pageY+e.y);this._panStart.set(i,s)}}_handleTouchStartDolly(t){let e=this._getSecondPointerPosition(t),i=t.pageX-e.x,s=t.pageY-e.y,r=Math.sqrt(i*i+s*s);this._dollyStart.set(0,r)}_handleTouchStartDollyPan(t){this.enableZoom&&this._handleTouchStartDolly(t),this.enablePan&&this._handleTouchStartPan(t)}_handleTouchStartDollyRotate(t){this.enableZoom&&this._handleTouchStartDolly(t),this.enableRotate&&this._handleTouchStartRotate(t)}_handleTouchMoveRotate(t){if(this._pointers.length==1)this._rotateEnd.set(t.pageX,t.pageY);else{let i=this._getSecondPointerPosition(t),s=.5*(t.pageX+i.x),r=.5*(t.pageY+i.y);this._rotateEnd.set(s,r)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let e=this.domElement;this._rotateLeft(oi*this._rotateDelta.x/e.clientHeight),this._rotateUp(oi*this._rotateDelta.y/e.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(t){if(this._pointers.length===1)this._panEnd.set(t.pageX,t.pageY);else{let e=this._getSecondPointerPosition(t),i=.5*(t.pageX+e.x),s=.5*(t.pageY+e.y);this._panEnd.set(i,s)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(t){let e=this._getSecondPointerPosition(t),i=t.pageX-e.x,s=t.pageY-e.y,r=Math.sqrt(i*i+s*s);this._dollyEnd.set(0,r),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);let o=(t.pageX+e.x)*.5,a=(t.pageY+e.y)*.5;this._updateZoomParameters(o,a)}_handleTouchMoveDollyPan(t){this.enableZoom&&this._handleTouchMoveDolly(t),this.enablePan&&this._handleTouchMovePan(t)}_handleTouchMoveDollyRotate(t){this.enableZoom&&this._handleTouchMoveDolly(t),this.enableRotate&&this._handleTouchMoveRotate(t)}_addPointer(t){this._pointers.push(t.pointerId)}_removePointer(t){delete this._pointerPositions[t.pointerId];for(let e=0;e<this._pointers.length;e++)if(this._pointers[e]==t.pointerId){this._pointers.splice(e,1);return}}_isTrackingPointer(t){for(let e=0;e<this._pointers.length;e++)if(this._pointers[e]==t.pointerId)return!0;return!1}_trackPointer(t){let e=this._pointerPositions[t.pointerId];e===void 0&&(e=new tt,this._pointerPositions[t.pointerId]=e),e.set(t.pageX,t.pageY)}_getSecondPointerPosition(t){let e=t.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[e]}_customWheelEvent(t){let e=t.deltaMode,i={clientX:t.clientX,clientY:t.clientY,deltaY:t.deltaY};switch(e){case 1:i.deltaY*=16;break;case 2:i.deltaY*=100;break}return t.ctrlKey&&!this._controlActive&&(i.deltaY*=10),i}};function n_(n){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(n.pointerId),this.domElement.ownerDocument.addEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(n)&&(this._addPointer(n),n.pointerType==="touch"?this._onTouchStart(n):this._onMouseDown(n),this._cursorStyle==="grab"&&(this.domElement.style.cursor="grabbing")))}function s_(n){this.enabled!==!1&&(n.pointerType==="touch"?this._onTouchMove(n):this._onMouseMove(n))}function r_(n){switch(this._removePointer(n),this._pointers.length){case 0:this.domElement.releasePointerCapture(n.pointerId),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(rf),this.state=pe.NONE,this._cursorStyle==="grab"&&(this.domElement.style.cursor="grab");break;case 1:let t=this._pointers[0],e=this._pointerPositions[t];this._onTouchStart({pointerId:t,pageX:e.x,pageY:e.y});break}}function o_(n){let t;switch(n.button){case 0:t=this.mouseButtons.LEFT;break;case 1:t=this.mouseButtons.MIDDLE;break;case 2:t=this.mouseButtons.RIGHT;break;default:t=-1}switch(t){case wn.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(n),this.state=pe.DOLLY;break;case wn.ROTATE:if(n.ctrlKey||n.metaKey||n.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(n),this.state=pe.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(n),this.state=pe.ROTATE}break;case wn.PAN:if(n.ctrlKey||n.metaKey||n.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(n),this.state=pe.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(n),this.state=pe.PAN}break;default:this.state=pe.NONE}this.state!==pe.NONE&&this.dispatchEvent(Uh)}function a_(n){switch(this.state){case pe.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(n);break;case pe.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(n);break;case pe.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(n);break}}function l_(n){this.enabled===!1||this.enableZoom===!1||this.state!==pe.NONE||(n.preventDefault(),this.dispatchEvent(Uh),this._handleMouseWheel(this._customWheelEvent(n)),this.dispatchEvent(rf))}function c_(n){this.enabled!==!1&&this._handleKeyDown(n)}function h_(n){switch(this._trackPointer(n),this._pointers.length){case 1:switch(this.touches.ONE){case En.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(n),this.state=pe.TOUCH_ROTATE;break;case En.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(n),this.state=pe.TOUCH_PAN;break;default:this.state=pe.NONE}break;case 2:switch(this.touches.TWO){case En.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(n),this.state=pe.TOUCH_DOLLY_PAN;break;case En.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(n),this.state=pe.TOUCH_DOLLY_ROTATE;break;default:this.state=pe.NONE}break;default:this.state=pe.NONE}this.state!==pe.NONE&&this.dispatchEvent(Uh)}function u_(n){switch(this._trackPointer(n),this.state){case pe.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(n),this.update();break;case pe.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(n),this.update();break;case pe.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(n),this.update();break;case pe.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(n),this.update();break;default:this.state=pe.NONE}}function d_(n){this.enabled!==!1&&n.preventDefault()}function f_(n){n.key==="Control"&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function p_(n){n.key==="Control"&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}var co=class n extends Wt{constructor(t,e={}){super(t),this.isReflector=!0,this.type="Reflector",this.forceUpdate=!1,this._reflectionCameras=new WeakMap;let i=this,s=e.color!==void 0?new Ft(e.color):new Ft(8355711),r=e.textureWidth||512,o=e.textureHeight||512,a=e.clipBias||0,l=e.shader||n.ReflectorShader,c=e.multisample!==void 0?e.multisample:4,h=new qe,f=new D,d=new D,u=new D,p=new re,x=new D(0,0,-1),m=new xe,g=new D,b=new D,T=new xe,v=new re,S=new he(r,o,{samples:c,type:ve}),C=new le({name:l.name!==void 0?l.name:"unspecified",uniforms:Ce.clone(l.uniforms),fragmentShader:l.fragmentShader,vertexShader:l.vertexShader});C.uniforms.tDiffuse.value=S.texture,C.uniforms.color.value=s,C.uniforms.textureMatrix.value=v,this.material=C,this.onBeforeRender=function(P,y,A){let U=this.getReflectionCamera(A);if(d.setFromMatrixPosition(i.matrixWorld),u.setFromMatrixPosition(A.matrixWorld),p.extractRotation(i.matrixWorld),f.set(0,0,1),f.applyMatrix4(p),g.subVectors(d,u),g.dot(f)>0===!0&&this.forceUpdate===!1)return;g.reflect(f).negate(),g.add(d),p.extractRotation(A.matrixWorld),x.set(0,0,-1),x.applyMatrix4(p),x.add(u),b.subVectors(d,x),b.reflect(f).negate(),b.add(d),U.position.copy(g),U.up.set(0,1,0),U.up.applyMatrix4(p),U.up.reflect(f),U.lookAt(b),U.far=A.far,U.updateMatrixWorld(),U.projectionMatrix.copy(A.projectionMatrix),v.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),v.multiply(U.projectionMatrix),v.multiply(U.matrixWorldInverse),v.multiply(i.matrixWorld),h.setFromNormalAndCoplanarPoint(f,d),h.applyMatrix4(U.matrixWorldInverse),m.set(h.normal.x,h.normal.y,h.normal.z,h.constant);let M=U.projectionMatrix;U.isOrthographicCamera?(T.x=(Math.sign(m.x)+M.elements[8])/M.elements[0],T.y=(Math.sign(m.y)+M.elements[9])/M.elements[5],T.z=-A.far,T.w=1):(T.x=(Math.sign(m.x)+M.elements[8])/M.elements[0],T.y=(Math.sign(m.y)+M.elements[9])/M.elements[5],T.z=-1,T.w=(1+M.elements[10])/M.elements[14]),m.multiplyScalar(2/m.dot(T)),M.elements[2]=m.x,M.elements[6]=m.y,U.isOrthographicCamera?(M.elements[10]=m.z-a,M.elements[14]=m.w-1):(M.elements[10]=m.z+1-a,M.elements[14]=m.w),i.visible=!1;let E=P.getRenderTarget(),R=P.xr.enabled,N=P.shadowMap.autoUpdate;P.xr.enabled=!1,P.shadowMap.autoUpdate=!1,P.setRenderTarget(S),P.state.buffers.depth.setMask(!0),P.autoClear===!1&&P.clear(),P.render(y,U),P.xr.enabled=R,P.shadowMap.autoUpdate=N,P.setRenderTarget(E);let O=A.viewport;O!==void 0&&P.state.viewport(O),i.visible=!0,this.forceUpdate=!1},this.getRenderTarget=function(){return S},this.dispose=function(){S.dispose(),i.material.dispose()},this.getReflectionCamera=function(P){let y=this._reflectionCameras.get(P);return y===void 0&&(y=P.clone(),this._reflectionCameras.set(P,y)),y}}};co.ReflectorShader={name:"ReflectorShader",uniforms:{color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null}},vertexShader:`
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

		}`};var ai={light:{id:"light",name:"\u05D0\u05D3\u05E8\u05D9\u05DB\u05DC\u05D9 \u05D1\u05D4\u05D9\u05E8",palette:{plaster_white:15525596,plaster_exterior:13880512,plaster_ceiling:16052974,concrete:11578790,tiles_white:14868956,tiles_grey:11711928,oak:12556906,carpet:11446172,fabric_grey:9081760,fabric_accent:6716046,fabric_rug:11375233,linen:15328474,leather:5128758,wood_light:13678228,wood_dark:7034439,door_wood:12295804,metal_dark:3948614,metal_light:12238273,asphalt:7040110,grass:8887410,screen_off:1382429,shutter:14277597,section_cap:3093047,section_edge:3093047,cone:2582509,presence:2582509,open_door:14960188,lock_ok:3122027},rig:{exposureDay:.68,exposureNight:.9,sunScale:1.3,skyScale:1,envDay:.5,envNight:.22,hemiScale:.22,interiorFill:[.55,1],lampEmissiveDay:1.6,lampEmissiveNight:3,lampPoolDay:.5,lampPoolNight:1,lampKelvinOffset:0,moonScale:.5},post:{bloomThresholdDay:2,bloomThresholdNight:1.6,bloomStrengthDay:.12,bloomStrengthNight:.38,bloomRadius:.35,aoRadius:.6,aoIntensity:.55,contactAlpha:.42,junctionAlpha:.5},cut:{fraction:.6,edge:!1,edgeWidth:0,ghostWalls:0},ground:{disc:13949149,discNight:1712432,contact:.38,horizonFade:!0},backdrop:{topDay:"#cfdff2",horizonDay:"#eef3f9",topNight:"#0d1a33",horizonNight:"#1a2b47",groundTint:.96},ui:{accent:"#2767ed",labelBg:"rgba(255,255,255,.86)",labelText:"#22314c",theme:"light"}},dark:{id:"dark",name:"\u05EA\u05D0\u05D5\u05DD \u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9 \u05DB\u05D4\u05D4",palette:{plaster_white:4936548,plaster_exterior:3423050,plaster_ceiling:4080980,concrete:4935769,tiles_white:7106936,tiles_grey:5199198,oak:8021584,carpet:5067355,fabric_grey:5989746,fabric_accent:5008006,fabric_rug:6314855,linen:10132902,leather:3353380,wood_light:9074016,wood_dark:4142384,door_wood:7232327,metal_dark:2764341,metal_light:9278620,asphalt:3356219,grass:4084544,screen_off:724242,shutter:8028296,section_cap:1383207,section_edge:6280191,cone:3718648,presence:3718648,open_door:16739170,lock_ok:4054148},rig:{exposureDay:.72,exposureNight:.8,sunScale:.55,skyScale:.32,envDay:.5,envNight:.2,hemiScale:.35,interiorFill:[.45,.9],lampEmissiveDay:2.6,lampEmissiveNight:3.4,lampPoolDay:1,lampPoolNight:1.2,lampKelvinOffset:0,moonScale:.8},post:{bloomThresholdDay:1.2,bloomThresholdNight:1,bloomStrengthDay:.32,bloomStrengthNight:.5,bloomRadius:.45,aoRadius:.6,aoIntensity:.5,contactAlpha:.5,junctionAlpha:.55},cut:{fraction:.6,edge:!0,edgeWidth:1,ghostWalls:0},ground:{disc:1119775,discNight:724759,contact:.5,horizonFade:!0},backdrop:{topDay:"#111a2b",horizonDay:"#1b2a44",topNight:"#070c17",horizonNight:"#111c33",groundTint:.5},ui:{accent:"#38bdf8",labelBg:"rgba(21,28,44,.86)",labelText:"#e6ebf5",theme:"dark"}}},Vb=Object.keys(ai);function of(n){return n==="dark"?ai.dark:ai.light}function af(n){let t=n>>>0;return()=>(t=t*1664525+1013904223>>>0,t/4294967296)}function lf(n,t,e){let i=af(e),s=new Float32Array((t+1)*(t+1));for(let l=0;l<s.length;l++)s[l]=i();let r=new Float32Array(n*n),o=l=>l*l*(3-2*l),a=new Float32Array(t+1);for(let l=0;l<n;l++){let c=l/n*t,h=Math.floor(c),f=o(c-h),d=(h+1)%t;for(let u=0;u<=t;u++)a[u]=s[h%t*(t+1)+u%t]*(1-f)+s[d*(t+1)+u%t]*f;for(let u=0;u<n;u++){let p=u/n*t,x=Math.floor(p),m=o(p-x);r[l*n+u]=a[x%t]*(1-m)+a[(x+1)%t]*m}}return r}function rn(n,t,e=4,i=4){let s=new Float32Array(n*n),r=.5,o=0;for(let a=0;a<e;a++){let l=lf(n,i<<a,t+a*97);for(let c=0;c<s.length;c++)s[c]+=l[c]*r;o+=r,r*=.5}for(let a=0;a<s.length;a++)s[a]/=o;return s}function Fh(n,t,e,i=8){let s=document.createElement("canvas");s.width=s.height=t;let r=s.getContext("2d"),o=r.createImageData(t,t);o.data.set(n),r.putImageData(o,0,0);let a=new nn(s);return a.wrapS=a.wrapT=hi,a.colorSpace=e?De:Di,a.anisotropy=i,a.needsUpdate=!0,a}function m_(n,t,e){let i=new Uint8ClampedArray(t*t*4),s=t;for(let r=0;r<s;r++){let o=(r-1+s)%s*s,a=r*s,l=(r+1)%s*s;for(let c=0;c<s;c++){let h=(c-1+s)%s,f=(c+1)%s,d=n[o+f]+2*n[a+f]+n[l+f]-(n[o+h]+2*n[a+h]+n[l+h]),u=n[l+h]+2*n[l+c]+n[l+f]-(n[o+h]+2*n[o+c]+n[o+f]),p=-d*e,x=-u*e,m=1,g=Math.hypot(p,x,m);p/=g,x/=g,m/=g;let b=(a+c)*4;i[b]=(p*.5+.5)*255,i[b+1]=(x*.5+.5)*255,i[b+2]=(m*.5+.5)*255,i[b+3]=255}}return i}function g_(n,t,e=200,i=40,s=[1,1,1]){let r=new Uint8ClampedArray(t*t*4);for(let o=0,a=0;o<n.length;o++,a+=4){let l=e+(n[o]-.5)*2*i;r[a]=l*s[0],r[a+1]=l*s[1],r[a+2]=l*s[2],r[a+3]=255}return r}function x_(n,t){let e=new Uint8ClampedArray(t*t*4);for(let i=0,s=0;i<n.length;i++,s+=4){let r=Math.max(0,Math.min(1,n[i]))*255;e[s]=r,e[s+1]=r,e[s+2]=r,e[s+3]=255}return e}var Ie={planks(n,t,e=6,i=.35){let s=rn(n,t,5,2),r=n/e,o=af(t+11),a=Array.from({length:e},()=>Math.floor(o()*n)),l=Array.from({length:e},()=>.88+o()*.24),c=new Float32Array(n*n),h=new Float32Array(n*n),f=new Float32Array(n*n);for(let d=0;d<n;d++)for(let u=0;u<n;u++){let p=Math.floor(u/r),x=(d+a[p])%n,m=s[x*n+u*3%n],g=.5+.5*Math.sin(u/r*Math.PI*9+m*11),b=u%r<1.5||x%n<1.5,T=d*n+u;c[T]=b?.2:Math.min(1,(.5+(m-.5)*i+(g-.5)*.12)*l[p]),h[T]=b?0:.75+.25*m,f[T]=b?.9:.42+.2*m}return{lum:c,height:h,rough:f,mid:196,amp:46,tint:[1,.98,.95]}},tiles(n,t,e=2,i=3,s=!1){let r=rn(n,t,3,8),o=n/e,a=new Float32Array(n*n),l=new Float32Array(n*n),c=new Float32Array(n*n);for(let h=0;h<n;h++)for(let f=0;f<n;f++){let d=h*n+f,u=f%o<i||h%o<i,p=Math.floor(f/o),x=Math.floor(h/o),m=.5+(r[d]-.5)*.5+((p*7+x*13)%5-2)*.025;a[d]=u?.32:m,l[d]=u?0:1-r[d]*.06,c[d]=u?.95:s?.18+r[d]*.1:.4+r[d]*.15}return{lum:a,height:l,rough:c,mid:206,amp:22}},plaster(n,t,e=.12){let i=rn(n,t,5,6),s=new Float32Array(n*n);for(let o=0;o<s.length;o++)s[o]=.82+i[o]*.15;let r=new Float32Array(n*n);for(let o=0;o<r.length;o++)r[o]=.5+(i[o]-.5)*e*2;return{lum:r,height:i,rough:s,mid:214,amp:14}},concrete(n,t){let e=rn(n,t,6,3),i=lf(n,64,t+5),s=new Float32Array(n*n),r=new Float32Array(n*n);for(let o=0;o<s.length;o++)s[o]=.5+(e[o]-.5)*.7+(i[o]>.94?-.2:0),r[o]=.7+e[o]*.25;return{lum:s,height:e,rough:r,mid:200,amp:30}},fabric(n,t,e=.8,i=.5){let s=rn(n,t,5,24),r=new Float32Array(n*n),o=new Float32Array(n*n);for(let l=0;l<n;l++)for(let c=0;c<n;c++){let h=l*n+c,f=.5+.5*Math.sin(c*e)*Math.sin(l*e);r[h]=.5+((s[h]-.5)*.6+(f-.5)*.4)*i,o[h]=s[h]*.6+f*.4}let a=new Float32Array(n*n).fill(.92);return{lum:r,height:o,rough:a,mid:200,amp:26}},wood(n,t,e=.12){let i=rn(n,t,4,2),s=new Float32Array(n*n),r=new Float32Array(n*n);for(let o=0;o<n;o++)for(let a=0;a<n;a++){let l=o*n+a,c=.5+.5*Math.sin(o*e+i[l]*7);s[l]=.5+(c-.5)*.5+(i[l]-.5)*.4,r[l]=.38+i[l]*.2}return{lum:s,height:i,rough:r,mid:200,amp:28,tint:[1,.98,.95]}},metal(n,t){let e=rn(n,t,4,32),i=new Float32Array(n*n),s=new Float32Array(n*n);for(let r=0;r<i.length;r++)i[r]=e[r],s[r]=.28+e[r]*.22;return{lum:i,height:e,rough:s,mid:215,amp:14}},leather(n,t){let e=rn(n,t,6,20),i=new Float32Array(n*n),s=new Float32Array(n*n);for(let r=0;r<i.length;r++)i[r]=e[r],s[r]=.45+e[r]*.3;return{lum:i,height:e,rough:s,mid:205,amp:22}},grass(n,t){let e=rn(n,t,6,10),i=new Float32Array(n*n).fill(.95);return{lum:e,height:e,rough:i,mid:205,amp:40}}},ho={plaster_white:{size:512,recipe:n=>Ie.plaster(n,31,.1),tile_m:2,normal:.35,roughness:1},plaster_exterior:{size:512,recipe:n=>Ie.plaster(n,47,.16),tile_m:2,normal:.9,roughness:1},plaster_ceiling:{size:256,recipe:n=>Ie.plaster(n,53,.05),tile_m:2,normal:.12,roughness:1},concrete:{size:512,recipe:n=>Ie.concrete(n,61),tile_m:2.5,normal:1.2,roughness:1},tiles_white:{size:512,recipe:n=>Ie.tiles(n,71,4,3,!0),tile_m:1.2,normal:1.8,roughness:1},tiles_grey:{size:512,recipe:n=>Ie.tiles(n,79,2,3,!1),tile_m:1.2,normal:1.8,roughness:1},oak:{size:512,recipe:n=>Ie.planks(n,83,6,.35),tile_m:1.2,normal:1.6,roughness:1},carpet:{size:256,recipe:n=>Ie.fabric(n,89,1.3,.35),tile_m:.5,normal:.8,roughness:1},fabric_grey:{size:256,recipe:n=>Ie.fabric(n,97,.8,.5),tile_m:.6,normal:.9,roughness:1},fabric_accent:{size:256,recipe:n=>Ie.fabric(n,101,.8,.5),tile_m:.6,normal:.9,roughness:1},fabric_rug:{size:256,recipe:n=>Ie.fabric(n,102,1.6,.4),tile_m:.8,normal:1,roughness:1},linen:{size:256,recipe:n=>Ie.fabric(n,103,1.1,.3),tile_m:.8,normal:.6,roughness:1},leather:{size:256,recipe:n=>Ie.leather(n,105),tile_m:.6,normal:.8,roughness:1},wood_light:{size:256,recipe:n=>Ie.wood(n,107,.12),tile_m:1,normal:.7,roughness:1},wood_dark:{size:256,recipe:n=>Ie.wood(n,109,.1),tile_m:1,normal:.7,roughness:1},door_wood:{size:256,recipe:n=>Ie.wood(n,113,.14),tile_m:1,normal:.9,roughness:1},metal_dark:{size:256,recipe:n=>Ie.metal(n,127),tile_m:.5,normal:.4,roughness:1,metalness:.85},metal_light:{size:256,recipe:n=>Ie.metal(n,131),tile_m:.5,normal:.4,roughness:1,metalness:.8},asphalt:{size:256,recipe:n=>Ie.concrete(n,137),tile_m:3,normal:1.2,roughness:1},grass:{size:256,recipe:n=>Ie.grass(n,139),tile_m:2,normal:.8,roughness:1}},Nl=class{constructor(t=ai.light){this.cache=new Map,this.materials=new Map,this.bytes=0,this.genMs=0,this.style=t}palette(t){return this.style.palette[t]??this.style.palette.plaster_white}textures(t){let e=this.cache.get(t);if(e)return e;let i=performance.now(),s=ho[t]||ho.plaster_white,r=s.size,o=s.recipe(r),a=Fh(g_(o.lum,r,o.mid,o.amp,o.tint),r,!0),l=Fh(m_(o.height,r,s.normal),r,!1),c=Fh(x_(o.rough,r),r,!1,2);return e={map:a,normalMap:l,roughnessMap:c,tile_m:s.tile_m,spec:s},this.bytes+=r*r*4*3*1.33,this.genMs+=performance.now()-i,this.cache.set(t,e),e}get(t,e,i={}){let s=`${t}|${e}|${i.side||0}`,r=this.materials.get(s);if(r)return r;let o=ho[t]||{},a=this.palette(t);if(e>=3){let l=this.textures(t);r=new ke({map:l.map,normalMap:l.normalMap,roughnessMap:l.roughnessMap,roughness:1,metalness:o.metalness??0,color:a,envMapIntensity:o.metalness?1:.7})}else e===2?r=new ke({color:a,roughness:.85,metalness:o.metalness?.6:0}):r=new Dr({color:a});return r.userData.materialId=t,i.side&&(r.side=i.side),this.materials.set(s,r),r}setStyle(t){this.style=t;for(let e of this.materials.values()){let i=e.userData.materialId;i&&e.color.setHex(this.palette(i))}}tileM(t){return(ho[t]||ho.plaster_white).tile_m}dispose(){for(let t of this.cache.values())t.map.dispose(),t.normalMap.dispose(),t.roughnessMap.dispose();for(let t of this.materials.values())t.dispose();this.cache.clear(),this.materials.clear(),this.bytes=0}},Dl=null,Ws=null;function Oh(){if(Dl)return Dl;let n=document.createElement("canvas");n.width=n.height=128;let t=n.getContext("2d"),e=t.createRadialGradient(64,64,0,64,64,64);return e.addColorStop(0,"rgba(0,0,0,1)"),e.addColorStop(.45,"rgba(0,0,0,0.75)"),e.addColorStop(.8,"rgba(0,0,0,0.18)"),e.addColorStop(1,"rgba(0,0,0,0)"),t.fillStyle=e,t.fillRect(0,0,128,128),Dl=new nn(n),Dl}function cf(){if(Ws)return Ws;let n=document.createElement("canvas");n.width=4,n.height=64;let t=n.getContext("2d"),e=t.createLinearGradient(0,0,0,64);return e.addColorStop(0,"rgba(0,0,0,1)"),e.addColorStop(.35,"rgba(0,0,0,0.45)"),e.addColorStop(1,"rgba(0,0,0,0)"),t.fillStyle=e,t.fillRect(0,0,4,64),Ws=new nn(n),Ws.wrapS=hi,Ws.wrapT=xi,Ws}function uo(n,t=!1){let e=n[0].index!==null,i=new Set(Object.keys(n[0].attributes)),s=new Set(Object.keys(n[0].morphAttributes)),r={},o={},a=n[0].morphTargetsRelative,l=new we,c=0;for(let h=0;h<n.length;++h){let f=n[h],d=0;if(e!==(f.index!==null))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(let u in f.attributes){if(!i.has(u))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+'. All geometries must have compatible attributes; make sure "'+u+'" attribute exists among all geometries, or in none of them.'),null;r[u]===void 0&&(r[u]=[]),r[u].push(f.attributes[u]),d++}if(d!==i.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". Make sure all geometries have the same number of attributes."),null;if(a!==f.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(let u in f.morphAttributes){if(!s.has(u))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+".  .morphAttributes must be consistent throughout all geometries."),null;o[u]===void 0&&(o[u]=[]),o[u].push(f.morphAttributes[u])}if(t){let u;if(e)u=f.index.count;else if(f.attributes.position!==void 0)u=f.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". The geometry must have either an index or a position attribute"),null;l.addGroup(c,u,h),c+=u}}if(e){let h=0,f=[];for(let d=0;d<n.length;++d){let u=n[d].index;for(let p=0;p<u.count;++p)f.push(u.getX(p)+h);h+=n[d].attributes.position.count}l.setIndex(f)}for(let h in r){let f=hf(r[h]);if(!f)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" attribute."),null;l.setAttribute(h,f)}for(let h in o){let f=o[h][0].length;if(f!==0){l.morphAttributes=l.morphAttributes||{},l.morphAttributes[h]=[];for(let d=0;d<f;++d){let u=[];for(let x=0;x<o[h].length;++x)u.push(o[h][x][d]);let p=hf(u);if(!p)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" morphAttribute."),null;l.morphAttributes[h].push(p)}}}return l}function hf(n){let t,e,i,s=-1,r=0;for(let c=0;c<n.length;++c){let h=n[c];if(t===void 0&&(t=h.array.constructor),t!==h.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(e===void 0&&(e=h.itemSize),e!==h.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(i===void 0&&(i=h.normalized),i!==h.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(s===-1&&(s=h.gpuType),s!==h.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;r+=h.count*e}let o=new t(r),a=new Ue(o,e,i),l=0;for(let c=0;c<n.length;++c){let h=n[c];if(h.isInterleavedBufferAttribute){let f=l/e;for(let d=0,u=h.count;d<u;d++)for(let p=0;p<e;p++){let x=h.getComponent(d,p);a.setComponent(d+f,p,x)}}else o.set(h.array,l);l+=h.count*e}return s!==void 0&&(a.gpuType=s),a}var fo=new D;function yi(n,t,e,i,s,r){let o=2*Math.PI*s/4,a=Math.max(r-2*s,0),l=Math.PI/4;fo.copy(t),fo[i]=0,fo.normalize();let c=.5*o/(o+a),h=1-fo.angleTo(n)/l;return Math.sign(fo[e])===1?h*c:a/(o+a)+c+c*(1-h)}var Xs=class n extends Be{constructor(t=1,e=1,i=1,s=2,r=.1){let o=s*2+1;if(r=Math.min(t/2,e/2,i/2,r),super(1,1,1,o,o,o),this.type="RoundedBoxGeometry",this.parameters={width:t,height:e,depth:i,segments:s,radius:r},o===1)return;let a=this.toNonIndexed();this.index=null,this.attributes.position=a.attributes.position,this.attributes.normal=a.attributes.normal,this.attributes.uv=a.attributes.uv;let l=new D,c=new D,h=new D(t,e,i).divideScalar(2).subScalar(r),f=this.attributes.position.array,d=this.attributes.normal.array,u=this.attributes.uv.array,p=f.length/6,x=new D,m=.5/o;for(let g=0,b=0;g<f.length;g+=3,b+=2)switch(l.fromArray(f,g),c.copy(l),c.x-=Math.sign(c.x)*m,c.y-=Math.sign(c.y)*m,c.z-=Math.sign(c.z)*m,c.normalize(),f[g+0]=h.x*Math.sign(l.x)+c.x*r,f[g+1]=h.y*Math.sign(l.y)+c.y*r,f[g+2]=h.z*Math.sign(l.z)+c.z*r,d[g+0]=c.x,d[g+1]=c.y,d[g+2]=c.z,Math.floor(g/p)){case 0:x.set(1,0,0),u[b+0]=yi(x,c,"z","y",r,i),u[b+1]=1-yi(x,c,"y","z",r,e);break;case 1:x.set(-1,0,0),u[b+0]=1-yi(x,c,"z","y",r,i),u[b+1]=1-yi(x,c,"y","z",r,e);break;case 2:x.set(0,1,0),u[b+0]=1-yi(x,c,"x","z",r,t),u[b+1]=yi(x,c,"z","x",r,i);break;case 3:x.set(0,-1,0),u[b+0]=1-yi(x,c,"x","z",r,t),u[b+1]=1-yi(x,c,"z","x",r,i);break;case 4:x.set(0,0,1),u[b+0]=1-yi(x,c,"x","y",r,t),u[b+1]=1-yi(x,c,"y","x",r,e);break;case 5:x.set(0,0,-1),u[b+0]=yi(x,c,"x","y",r,t),u[b+1]=1-yi(x,c,"y","x",r,e);break}}static fromJSON(t){return new n(t.width,t.height,t.depth,t.segments,t.radius)}};var v_=["open","opening","on"],Ul=n=>!!n&&v_.includes(n),uf=(n,t)=>n.id<t.id?-1:n.id>t.id?1:0;function __(n){let t=n.dimensions,e=t.scale_m_per_px,i=t.calibration&&t.calibration.status;return typeof e=="number"&&Number.isFinite(e)&&e>0&&(i==="measured"||i==="estimated")?{scale:e,estimated:i==="estimated"}:{scale:.2/(.006*(t.width_px||1e3)),estimated:!0}}function y_(n){let t=[0];for(let e=1;e<n.length;e++)t.push(t[e-1]+Math.hypot(n[e][0]-n[e-1][0],n[e][1]-n[e-1][1]));return t}function Bh(n,t,e){let i=0;for(;i<n.length-2&&e>t[i+1];)i++;let[s,r]=n[i],[o,a]=n[i+1],l=t[i+1]-t[i];if(l<=1e-9)return{p:[s,r],d:[1,0]};let c=Math.min(1,Math.max(0,(e-t[i])/l));return{p:[s+(o-s)*c,r+(a-r)*c],d:[(o-s)/l,(a-r)/l]}}function M_(n,t,e,i){let s=[];for(let r=1;r<n.length-1;r++)e<t[r]&&t[r]<i&&s.push(n[r]);return[Bh(n,t,e).p,...s,Bh(n,t,i).p]}var df=(n,t,e)=>{let i=n[0]-t[0],s=n[1]-t[1],r=Math.hypot(i,s);return r<1e-9?n:[n[0]+i/r*e,n[1]+s/r*e]},ff=(n,t,e)=>[n[0]+t[0]*e,n[1]+t[1]*e];function po(n,t,e,i){let{scale:s}=__(n),r=1/s,o=new Map;for(let h of n.openings){let f=o.get(h.wall_id);f?f.push(h):o.set(h.wall_id,[h])}let a=[],l=new Map;for(let h of[...new Map(n.walls.map(f=>[f.id,f])).values()].sort(uf)){if(i!=null&&h.level_id!==i)continue;let f=h.polyline.map(T=>[T[0]*t,T[1]*e]),d=y_(f),u=d[d.length-1];if(u<=1e-6)continue;let p=Math.max(1,(h.thickness_m||.2)*r);l.set(h.id,{pts:f,cum:d,wpx:p,wall:h});let x=(o.get(h.id)||[]).map(T=>{let v=(T.t||0)*u,S=(T.width_m||0)*r/2;return[Math.max(0,v-S),Math.min(u,v+S)]});x.sort((T,v)=>T[0]-v[0]||T[1]-v[1]);let m=[],g=0;for(let[T,v]of x)T>g&&m.push([g,T]),g=Math.max(g,v);g<u&&m.push([g,u]);let b=0;for(let[T,v]of m){if(v-T<=.01)continue;let S=M_(f,d,T,v);T<=0&&(S[0]=df(S[0],S[1],p/2)),v>=u&&(S[S.length-1]=df(S[S.length-1],S[S.length-2],p/2)),a.push({id:h.id,part:b,points:S,width:p,wall:h}),b+=1}}let c=[];for(let h of[...n.openings].sort(uf)){let f=l.get(h.wall_id);if(!f)continue;let{p:d,d:u}=Bh(f.pts,f.cum,(h.t||0)*f.cum[f.cum.length-1]),p=(h.width_m||0)*r;c.push({opening:h,wall:f.wall,c:d,d:u,g0:ff(d,u,-p/2),g1:ff(d,u,p/2),w:p,wpx:f.wpx})}return{walls:a,openings:c,scale:s}}function kh(n,t,e,i,s,r={}){let{walls:o,openings:a}=po(n,t,e,i),l=[];for(let c of o)if(!(r.bodyOnly===!1&&(c.wall.kind==="railing"||c.wall.kind==="low")))for(let h=1;h<c.points.length;h++)l.push({a:c.points[h-1],b:c.points[h],w:c.width,kind:c.wall.kind,id:c.id});for(let c of a){let h=c.opening.kind;if(h!=="passage"){if(h==="door"){let f=c.opening.anchor_ref,d=f&&f.resource_type==="ha_entity"?s[f.resource_id]:void 0;if(!f||Ul(d))continue;let u=r.locks&&r.locks[c.opening.id]}l.push({a:c.g0,b:c.g1,w:c.wpx,kind:h,id:c.opening.id})}}return l}function on(n,t,e){let i=!1;for(let s=0,r=e.length-1;s<e.length;r=s++){let o=e[s][0],a=e[s][1],l=e[r][0],c=e[r][1];a>t!=c>t&&n<(l-o)*(t-a)/(c-a)+o&&(i=!i)}return i}function qs(n){let t=0,e=0,i=0;for(let s=0;s<n.length;s++){let[r,o]=n[s],[a,l]=n[(s+1)%n.length],c=r*l-a*o;t+=c,e+=(r+a)*c,i+=(o+l)*c}return Math.abs(t)<1e-9?[n[0][0],n[0][1]]:[e/(3*t),i/(3*t)]}function zh(n,t){let e=n.length;if(e<2)return[];let i=[];for(let a=0;a<e-1;a++){let l=n[a+1][0]-n[a][0],c=n[a+1][1]-n[a][1],h=Math.hypot(l,c)||1;i.push([l/h,c/h])}let s=a=>{let l=[];for(let c=0;c<e;c++){let h=i[Math.max(0,c-1)],f=i[Math.min(e-2,c)],d=[-h[1]*a,h[0]*a],u=[-f[1]*a,f[0]*a],p=d[0]+u[0],x=d[1]+u[1],m=Math.hypot(p,x);if(m<1e-6){l.push([n[c][0]+u[0]*t,n[c][1]+u[1]*t]);continue}let g=(p*u[0]+x*u[1])/m,b=t/Math.max(g,.25);l.push([n[c][0]+p/m*b,n[c][1]+x/m*b])}return l},r=s(1),o=s(-1).reverse();return[...r,...o]}var Gh=1.65,pf=8,b_=85,S_=350,Fl=(n,t)=>-Math.atan2(t,n),mf=(n,t,e)=>n+(t-n)*e;function Vh(n,t,e,i,s=[[0,0],[1,0],[1,1],[0,1]]){let r=new we,o=[n,t,e,n,e,i].flat(),a=[s[0],s[1],s[2],s[0],s[2],s[3]].flat();return r.setAttribute("position",new oe(o,3)),r.setAttribute("uv",new oe(a,2)),r.computeVertexNormals(),r}function w_(n,t,e=.22,i=.28,s=.32){let r=n.length,o=[];for(let a=0;a<r;a++){let l=n[a],c=n[(a+1)%r],h=Math.hypot(c[0]-l[0],c[1]-l[1]);if(h<s)continue;let f=-(c[1]-l[1])/h,d=(c[0]-l[0])/h;on((l[0]+c[0])/2+f*.02,(l[1]+c[1])/2+d*.02,n)&&(f=-f,d=-d);let u=h/.5;o.push(Vh([l[0],t+.006,l[1]],[c[0],t+.006,c[1]],[c[0]+f*e,t+.006,c[1]+d*e],[l[0]+f*e,t+.006,l[1]+d*e],[[0,0],[u,0],[u,1],[0,1]]));let p=.004;o.push(Vh([l[0]+f*p,t,l[1]+d*p],[c[0]+f*p,t,c[1]+d*p],[c[0]+f*p,t+i,c[1]+d*p],[l[0]+f*p,t+i,l[1]+d*p],[[0,0],[u,0],[u,1],[0,1]]))}return o}function Xi(n,t,e=[0,0,0]){let i=n.index?n.toNonIndexed():n,s=i.attributes.position,r=new Float32Array(s.count*2),o=new D,a=new D,l=new D,c=new D;for(let h=0;h<s.count;h+=3){o.fromBufferAttribute(s,h),a.fromBufferAttribute(s,h+1),l.fromBufferAttribute(s,h+2),c.copy(a).sub(o).cross(l.clone().sub(o));let f=Math.abs(c.x),d=Math.abs(c.y),u=Math.abs(c.z);for(let p=0;p<3;p++){let x=[o,a,l][p],m,g;f>=d&&f>=u?(m=x.z+e[2],g=x.y+e[1]):d>=u?(m=x.x+e[0],g=x.z+e[2]):(m=x.x+e[0],g=x.y+e[1]),r[(h+p)*2]=m/t,r[(h+p)*2+1]=g/t}}return i.setAttribute("uv",new Ue(r,2)),i.computeVertexNormals(),i}function Ys(n){let t=new Vn;return n.forEach(([e,i],s)=>s?t.lineTo(e,-i):t.moveTo(e,-i)),t.closePath(),t}function Ol(n,t,e){let i=new Pr(Ys(n),{depth:t,bevelEnabled:!1,curveSegments:1});return i.rotateX(-Math.PI/2),i.translate(0,e,0),i}function ni(n,t,e,i,s,r,o=0){let a=new Be(n,t,e);return o&&a.rotateY(o),a.translate(i,s,r),a}function gf(n,t,e,i,s,r=16,o=n){let a=new ii(o,n,t,r);return a.translate(e,i,s),a}var Hh=(n,t)=>{let[e,i]=qs(n);return n.map(([s,r])=>[s+Math.sign(e-s)*t,r+Math.sign(i-r)*t])},kl=class{constructor(t){this.lib=t,this.root=new si,this.root.name="plan",this.levels={},this.doors=[],this.shutters=[],this.lamps=[],this.devices=[],this.markers=[],this.presence=[],this.tints=[],this.pool=[],this.labels=[],this.quality=3,this.reflectors=[],this.cameras=[],this.mirror=null,this.style=t.style||ai.light,this.cutY=null,this.clipMaterials=new Set,this.styled=[],this.furnitureMode="procedural"}dispose(){this.root.traverse(t=>{t.geometry&&t.geometry.dispose()}),this.root.clear(),this.levels={},this.doors=[],this.shutters=[],this.lamps=[],this.devices=[],this.markers=[],this.presence=[],this.tints=[],this.labels=[],this.cameras=[],this.clipMaterials.clear(),this.styled=[],this.screens=[],this.lockPlates=[],this.ground=null;for(let t of this.pool)t.parent&&t.parent.remove(t);this.pool=[]}setStyle(t){this.style=t,this.lib.setStyle(t);let e=t.palette;for(let i of this.styled){let s=e[i.key];s!==void 0&&(i.prop==="color"?i.material.color.setHex(s):i.prop==="emissive"?(i.material.color.setHex(s),i.material.emissive.setHex(s)):i.prop==="opacity"&&(i.material.opacity=t.post[i.key]))}for(let i of Object.values(this.levels))i.capEdges&&(i.capEdges.visible=!!t.cut.edge&&i.capMesh.visible);this.ground&&(this.ground.disc.material.color.setHex(t.ground.disc),this.ground.shadow.material.opacity=t.ground.contact)}setNight(t){this.ground&&this.ground.disc.material.color.setHex(this.style.ground.disc).lerp(new Ft(this.style.ground.discNight),t)}styledMaterial(t,e,i="color"){return this.styled.push({material:t,key:e,prop:i}),t}setCut(t,e){this.cutY=t,this.cutLevel=e;let i=t==null?null:[new qe(new D(0,-1,0),t)];for(let s of this.clipMaterials)s.clippingPlanes=i,s.clipShadows=!!i,s.needsUpdate=s.needsUpdate||!1;for(let s of Object.values(this.levels)){let r=t!=null&&s.id===e;s.capMesh&&(s.capMesh.visible=r,s.capMesh.position.y=t??0),s.capEdges&&(s.capEdges.visible=r&&!!this.style.cut.edge,s.capEdges.position.y=t??0)}}build(t,e,i={}){this.dispose(),this.plan=t,this.quality=e,this.reflections=!!i.reflections;let s=t.doc,r=s.dimensions.width_px,o=s.dimensions.height_px,{scale:a}=po(s,r,o,null);this.scale=a,this.W=r,this.H=o;let l=m=>[m[0]*r*a,m[1]*o*a];this.toM=l;let c=e,h=this.lib,f=(m,g)=>h.get(m,c,{side:g}),d=new Map(s.levels.map(m=>[m.id,m])),u=t.entities;for(let m of s.levels){let g=new si;g.name=`level:${m.id}`,this.root.add(g);let b=m.elevation_m,T=m.ceiling_height_m,v=t.zones.filter(M=>M.level_id===m.id).map(M=>({...M,polyM:M.polygon.map(E=>l([E.x,E.y]))}));if(!v.length){let M=s.walls.filter(E=>E.level_id===m.id).flatMap(E=>E.polyline.map(l));if(M.length){let R=Math.min(...M.map(V=>V[0]))-.5,N=Math.max(...M.map(V=>V[0]))+.5,O=Math.min(...M.map(V=>V[1]))-.5,F=Math.max(...M.map(V=>V[1]))+.5;v.push({id:`plate-${m.id}`,name:m.name,level_id:m.id,polyM:[[R,O],[N,O],[N,F],[R,F]],x_proto:{floor_material:"concrete"},synthetic:!0})}}let S={id:m.id,name:m.name,group:g,elevation:b,ceiling:T,zones:v,ceilings:[],extent:null,statics:[],segs:[],stairs:[],objectsBlocking:[],strips:[],blobs:[],caps:[],capLines:[]};this.levels[m.id]=S;let C=new Map,P=(M,E)=>{(C.get(M)||C.set(M,[]).get(M)).push(E)},{walls:y,openings:A}=po(s,r,o,m.id);for(let M of y){let E=M.wall,R=E.height_m??T,N=M.points.map(k=>[k[0]*a,k[1]*a]),O=zh(N,M.width*a/2);if(O.length<3)continue;let F=Ol(O,R-(E.base_z_m||0),b+(E.base_z_m||0)),V=E.kind==="railing"?"metal_dark":E.kind==="exterior"?"plaster_exterior":"plaster_white";if(P(V,Xi(F,h.tileM(V))),E.kind!=="railing"&&!(E.base_z_m>0)){if(S.strips.push(...w_(O,b)),R>=T*.5){let k=new sn(Ys(O));k.rotateX(-Math.PI/2),S.caps.push(k);for(let W=0;W<O.length;W++){let j=O[W],ht=O[(W+1)%O.length];S.capLines.push(j[0],0,j[1],ht[0],0,ht[1])}}if(c>=3&&E.kind==="interior"){let k=Ol(zh(N,M.width*a/2+.012),.08,b);P("plaster_ceiling",Xi(k,2))}}}let U=v.length?v.flatMap(M=>M.polyM):y.flatMap(M=>M.points.map(E=>[E[0]*a,E[1]*a]));U.length&&(S.extent={minX:Math.min(...U.map(M=>M[0])),maxX:Math.max(...U.map(M=>M[0])),minZ:Math.min(...U.map(M=>M[1])),maxZ:Math.max(...U.map(M=>M[1]))});for(let M of v){let E=0;for(let N of A){if(N.opening.kind!=="window")continue;let O=[N.c[0]*a,N.c[1]*a],F=[-N.d[1],N.d[0]];(on(O[0]+F[0]*.3,O[1]+F[1]*.3,M.polyM)||on(O[0]-F[0]*.3,O[1]-F[1]*.3,M.polyM))&&(E+=N.opening.width_m*N.opening.height_m)}let R=0;for(let N=0;N<M.polyM.length;N++){let O=M.polyM[N],F=M.polyM[(N+1)%M.polyM.length];R+=O[0]*F[1]-F[0]*O[1]}M.daylight=Math.min(1,E/Math.max(1,Math.abs(R)/2)*5)}for(let M of A){let E=M.opening,R=[M.c[0]*a,M.c[1]*a],N=M.d,O=[-N[1],N[0]],F=E.width_m,V=M.wpx*a,k=M.wall.height_m??T,W=Fl(N[0],N[1]),j=b+E.sill_m+E.height_m;if(k-(E.sill_m+E.height_m)>.01&&P(M.wall.kind==="exterior"?"plaster_exterior":"plaster_white",Xi(ni(F,k-(E.sill_m+E.height_m),V,R[0],(j+b+k)/2,R[1],W),2)),E.kind==="window"){E.sill_m>.01&&P(M.wall.kind==="exterior"?"plaster_exterior":"plaster_white",Xi(ni(F,E.sill_m,V,R[0],b+E.sill_m/2,R[1],W),2));let ht=.06;P("metal_light",ni(ht,E.height_m,V*.9,R[0]-N[0]*(F/2-ht/2),b+E.sill_m+E.height_m/2,R[1]-N[1]*(F/2-ht/2),W)),P("metal_light",ni(ht,E.height_m,V*.9,R[0]+N[0]*(F/2-ht/2),b+E.sill_m+E.height_m/2,R[1]+N[1]*(F/2-ht/2),W)),P("metal_light",ni(F,ht,V*.9,R[0],j-ht/2,R[1],W)),P("metal_light",ni(F+.1,ht,V+.08,R[0],b+E.sill_m+ht/2,R[1],W));let ft=E.x_proto&&E.x_proto.glazing==="frosted",At=new Wt(ni(F-ht*2,E.height_m-ht*2,.02,0,0,0),this.glassMaterial(ft));At.position.set(R[0],b+E.sill_m+E.height_m/2,R[1]),At.rotation.y=W,At.userData={kind:"glass"},g.add(At);let wt=E.x_proto&&E.x_proto.cover_entity;if(wt){let Gt=S.extent?R[0]+O[0]*.5<S.extent.minX+.01||R[0]+O[0]*.5>S.extent.maxX-.01||R[1]+O[1]*.5<S.extent.minZ+.01||R[1]+O[1]*.5>S.extent.maxZ-.01?1:-1:1,Z=new Wt(new Be(F+.1,.22,.18),f("metal_light"));Z.position.set(R[0]+O[0]*Gt*(V/2+.09),j+.11,R[1]+O[1]*Gt*(V/2+.09)),Z.rotation.y=W,Z.castShadow=!0,g.add(Z);let K=new Wt(new Be(F+.04,1,.04),this.shutterMaterial());K.geometry.translate(0,-.5,0),K.position.set(R[0]+O[0]*Gt*(V/2+.06),j,R[1]+O[1]*Gt*(V/2+.06)),K.rotation.y=W,K.castShadow=!0,K.userData={kind:"device",entity:wt,label:t.entityNames[wt]||wt,domain:"cover"},g.add(K),this.devices.push(K),this.shutters.push({entity:wt,mesh:K,height:E.height_m,current:1}),this.labels.push({kind:"device",entity:wt,pos:new D(R[0]+O[0]*Gt*.3,j+.3,R[1]+O[1]*Gt*.3),level:m.id})}}else if(E.kind==="door"){let ft="wood_dark";P(ft,ni(.05,E.height_m,V+.02,R[0]-N[0]*(F/2-.05/2),b+E.height_m/2,R[1]-N[1]*(F/2-.05/2),W)),P(ft,ni(.05,E.height_m,V+.02,R[0]+N[0]*(F/2-.05/2),b+E.height_m/2,R[1]+N[1]*(F/2-.05/2),W)),P(ft,ni(F,.05,V+.02,R[0],j-.05/2,R[1],W));let At=E.anchor_ref&&E.anchor_ref.resource_type==="ha_entity"?E.anchor_ref.resource_id:null,wt=t.doorLocks&&t.doorLocks[E.id],Gt=E.height_m-.05-.01,Z=.045,K=E.swing||"right",dt=[N[1],-N[0]],Pt=[-N[1],N[0]],vt=[],Bt=(st,ot,ct,Ut,Rt)=>{let It=new si;It.position.set(st[0],b,st[1]);let Xt=Fl(ot[0],ot[1]);It.rotation.y=Xt;let B=new Wt(new Be(ct-.02,Gt,Z),E.id==="d-liv-kit"?this.glassMaterial(!1,!0):f("door_wood"));B.geometry.translate(ct/2,Gt/2,0),B.castShadow=!0,B.receiveShadow=!0,c>=3&&E.id!=="d-liv-kit"&&Xi(B.geometry,1),B.userData={kind:"device",entity:At||`door:${E.id}`,label:At?t.entityNames[At]||At:"\u05D3\u05DC\u05EA \u05DC\u05DC\u05D0 \u05D7\u05D9\u05D9\u05E9\u05DF",domain:"door",openingId:E.id,lock:wt||null},It.add(B);let ne=new Wt(new Be(.12,.03,.08),f("metal_light"));if(ne.position.set(ct-.15,1,0),It.add(ne),wt){let L=new Wt(new Be(.06,.1,.06),this.lockMaterial());L.position.set(ct-.15,1.12,0),L.userData={kind:"lock",entity:wt},It.add(L),this.devices.push(L),this.lockPlates=this.lockPlates||[],this.lockPlates.push({entity:wt,mesh:L})}g.add(It),this.devices.push(B);let jt=Xt;if(Rt==="swing"){jt=Fl(Ut[0],Ut[1]);let L=jt-Xt;for(;L>Math.PI;)L-=2*Math.PI;for(;L<-Math.PI;)L+=2*Math.PI;jt=Xt+Math.sign(L)*(b_*Math.PI)/180}vt.push({grp:It,closedYaw:Xt,openYaw:jt,kind:Rt,slide:Rt==="slide"?[ot[0]*-(ct*.92),ot[1]*-(ct*.92)]:null,base:[st[0],st[1]]})},ee=[M.g0[0]*a,M.g0[1]*a],et=[M.g1[0]*a,M.g1[1]*a],at=(E.hinge||"start")==="start"?dt:Pt;if(K==="sliding"){let st=(E.hinge||"start")==="start"?ee:et,ot=st===ee?N:[-N[0],-N[1]];Bt([st[0]+dt[0]*0,st[1]+dt[1]*0],ot,F,null,"slide")}else if(K==="double")Bt(ee,N,F/2,at,"swing"),Bt(et,[-N[0],-N[1]],F/2,at,"swing");else if(K!=="none"){let st=K==="left"?dt:Pt,ot=(E.hinge||"start")==="start"?ee:et,ct=ot===ee?N:[-N[0],-N[1]];Bt(ot,ct,F,st,"swing")}if(this.doors.push({id:E.id,entity:At,lock:wt||null,leaves:vt,t:0,open:!1}),At){let st=new si,ot=this.markerMaterial(),ct=.06,Ut=.04;for(let Rt of[-1,1]){let It=new Wt(ni(ct,E.height_m+ct,V+Ut*2,R[0]+N[0]*Rt*(F/2+ct/2),b+(E.height_m+ct)/2,R[1]+N[1]*Rt*(F/2+ct/2),W),ot);st.add(It)}st.add(new Wt(ni(F+ct*2,ct,V+Ut*2,R[0],j+ct/2,R[1],W),ot)),st.visible=!1,g.add(st),this.markers.push({entity:At,group:st}),this.labels.push({kind:"device",entity:At,pos:new D(R[0],j+.25,R[1]),level:m.id})}}else E.kind}for(let M of v){let E=M.x_proto&&M.x_proto.floor_material||"concrete",R=Ol(M.polyM,.25,b-.25),N=f(E),O=this.reflections&&c>=3?this.transparentClone(N):N,F=new Wt(Xi(R,h.tileM(E)),O);F.receiveShadow=!0,F.castShadow=c>=2,F.userData={kind:"floor",zone:M.id,level:m.id},g.add(F),S.statics.push(F);let V=new sn(Ys(M.polyM));V.rotateX(-Math.PI/2),V.translate(0,b+T,0);let k=new Wt(Xi(V,h.tileM("plaster_ceiling")),f("plaster_ceiling",Le));k.castShadow=!0,k.receiveShadow=!0,k.userData={kind:"ceiling"},g.add(k),S.ceilings.push(k);let[W,j]=qs(M.polyM),ht=M.x_proto&&M.x_proto.light;if(ht&&c<3){let At=new sn(Ys(Hh(M.polyM,.08)));At.rotateX(-Math.PI/2),At.translate(0,b+.014,0);let wt=new Wt(At,new Oe({color:16762967,transparent:!0,opacity:.4,depthWrite:!1}));wt.visible=!1,g.add(wt),this.tints.push({entity:ht,mesh:wt,zone:M.id})}let ft=M.x_proto&&M.x_proto.presence;if(ft){let At=Hh(M.polyM,.1),wt=Hh(M.polyM,.4),Gt=Ys(At),Z=new Hn;wt.forEach(([Pt,vt],Bt)=>Bt?Z.lineTo(Pt,-vt):Z.moveTo(Pt,-vt)),Z.closePath(),Gt.holes.push(Z);let K=new sn(Gt);K.rotateX(-Math.PI/2),K.translate(0,b+.026,0);let dt=new Wt(K,this.styledMaterial(new Oe({color:this.style.palette.presence,transparent:!0,opacity:.45,depthWrite:!1}),"presence"));dt.visible=!1,g.add(dt),this.presence.push({entity:ft,mesh:dt,zone:M.id,fade:1})}this.labels.push({kind:"room",text:M.name,pos:new D(W,b+.05,j),level:m.id,zone:M.id}),M.x_proto&&typeof M.x_proto.temp=="number"&&this.labels.push({kind:"temp",text:`${M.x_proto.temp.toFixed(1)}\xB0`,pos:new D(W,b+1.5,j),level:m.id,zone:M.id,offset:.55})}for(let M of s.objects.filter(E=>E.level_id===m.id)){let[E,R]=l(M.position),N=-(M.rotation_deg||0)*Math.PI/180,O=b+(M.z_m||0);this.buildObject(M,E,O,R,N,g,P,S,t)}for(let M of s.connectors.filter(E=>E.level_from===m.id&&E.kind==="stairs"&&E.polyline.length>=2)){let E=d.get(M.level_to);if(!E)continue;let R=l(M.polyline[0]),N=l(M.polyline[M.polyline.length-1]),O=Math.hypot(N[0]-R[0],N[1]-R[1]),F=M.flights&&M.flights[0]&&M.flights[0].steps||Math.max(2,Math.round(O/.28)),V=E.elevation_m-b,k=(N[0]-R[0])/O,W=(N[1]-R[1])/O,j=Fl(k,W),ht=O/F,ft=V/F;for(let At=0;At<F;At++){let wt=(At+.5)*ht,Gt=b+(At+1)*ft,Z=Math.max(.02,(At+1)*ft);P("oak",Xi(ni(ht+.01,Z,M.width_m,R[0]+k*wt,Gt-Z/2,R[1]+W*wt,j),1))}P("wood_dark",ni(O,.08,.05,(R[0]+N[0])/2+0,b+V/2-.04,(R[1]+N[1])/2,j)),S.stairs.push({a:R,b:N,run:O,width:M.width_m,from:m.id,to:M.level_to,elevFrom:b,elevTo:E.elevation_m,dx:k,dz:W})}let I=kh(s,r,o,m.id,u);for(let M of t.anchors.filter(E=>E.level_id===m.id&&E.resource_type==="camera")){let[E,R]=l([M.x,M.y]),N=M.mount_height_m??2.4,O=(M.rotation||0)*Math.PI/180,F=[Math.sin(O),-Math.cos(O)],V=new si;V.position.set(E,b+N,R),V.rotation.y=-O+Math.PI/2;let k=new Wt(new Be(.24,.1,.12),f("metal_dark"));k.position.x=.1,k.rotation.z=-(M.tilt_deg||0)*Math.PI/180,V.add(k);let W=new Wt(new ii(.035,.035,.04,12),this.lensMaterial(M.online));W.rotation.z=Math.PI/2,W.position.set(.23,-.03,0),V.add(W);let j=new Wt(new Be(.06,.06,.06),f("metal_dark"));V.add(j),V.userData={kind:"camera",id:M.id,label:M.label,online:M.online},k.userData=V.userData,W.userData=V.userData,g.add(V),this.devices.push(k,W);let ht=(M.radius??.5)*r,At=E_([M.x*r,M.y*o],M.rotation||0,M.fov||90,ht,I).map(wt=>[wt[0]*a,wt[1]*a]);if(At.length>=3){let wt=new sn(Ys(At));wt.rotateX(-Math.PI/2),wt.translate(0,b+.03,0);let Gt=M.online===!1?new Oe({color:10134453,transparent:!0,opacity:.12,depthWrite:!1,side:Le}):this.styledMaterial(new Oe({color:this.style.palette.cone,transparent:!0,opacity:.11,depthWrite:!1,side:Le}),"cone"),Z=new Wt(wt,Gt);Z.userData={kind:"cone",noClip:!0},g.add(Z);let K=new Wt(Ol(At,N-.2,b+.05),this.styledMaterial(new Oe({color:this.style.palette.cone,transparent:!0,opacity:.05,depthWrite:!1,side:Le}),"cone"));K.visible=!1,K.userData={kind:"cone-volume",noClip:!0},g.add(K),this.cameras.push({id:M.id,cone:Z,vol:K,body:V,fwd:F,pos:[E,R],mount:N,tilt:M.tilt_deg||0,label:M.label,level:m.id})}this.labels.push({kind:"camera",text:M.label,pos:new D(E,b+N+.2,R),level:m.id,online:M.online})}for(let[M,E]of C){let R=E.map(V=>V.index?V.toNonIndexed():V),N=uo(R,!1),O=f(M),F=new Wt(N,O);F.castShadow=!0,F.receiveShadow=!0,F.userData={kind:"static",material:M,level:m.id},g.add(F),S.statics.push(F)}if(c>=2){if(S.strips.length){let M=this.styledMaterial(new Oe({map:cf(),color:0,transparent:!0,opacity:this.style.post.junctionAlpha,depthWrite:!1,side:Le,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),"junctionAlpha","opacity"),E=new Wt(uo(S.strips,!1),M);E.userData={kind:"ao",noClip:!0},E.renderOrder=1,g.add(E)}if(S.blobs.length){let M=this.styledMaterial(new Oe({map:Oh(),color:0,transparent:!0,opacity:this.style.post.contactAlpha,depthWrite:!1,side:Le,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),"contactAlpha","opacity"),E=new Wt(uo(S.blobs,!1),M);E.userData={kind:"ao",noClip:!0},E.renderOrder=1,g.add(E)}}if(S.caps.length){let M=this.styledMaterial(new Oe({color:this.style.palette.section_cap,toneMapped:!1}),"section_cap");S.capMesh=new Wt(uo(S.caps.map(R=>R.index?R.toNonIndexed():R),!1),M),S.capMesh.visible=!1,S.capMesh.userData={kind:"cap",noClip:!0},S.capMesh.renderOrder=2,g.add(S.capMesh);let E=new we;E.setAttribute("position",new oe(S.capLines,3)),S.capEdges=new _r(E,this.styledMaterial(new Rs({color:this.style.palette.section_edge,toneMapped:!1,transparent:!0,opacity:.9}),"section_edge")),S.capEdges.visible=!1,S.capEdges.userData={kind:"cap",noClip:!0},S.capEdges.renderOrder=3,g.add(S.capEdges)}S.segsPx=null}{let m=Object.values(this.levels).filter(g=>g.extent);if(m.length){let g=m.reduce((U,I)=>U.elevation<I.elevation?U:I),b=g.extent,T=b.maxX-b.minX,v=b.maxZ-b.minZ,S=(b.minX+b.maxX)/2,C=(b.minZ+b.maxZ)/2,P=new si;P.userData={kind:"ground",noClip:!0};let y=new Wt(new br(Math.max(T,v)*2.4,72),this.styledMaterial(new ke({color:this.style.ground.disc,roughness:1,metalness:0}),"ground_disc"));y.rotation.x=-Math.PI/2,y.position.set(S,g.elevation-.25,C),y.receiveShadow=c>=2,y.userData={kind:"ground",noClip:!0},P.add(y);let A=new Wt(new _n(T+3,v+3),new Oe({map:Oh(),color:0,transparent:!0,opacity:this.style.ground.contact,depthWrite:!1}));A.rotation.x=-Math.PI/2,A.position.set(S,g.elevation-.245,C),A.userData={kind:"ground",noClip:!0},P.add(A),this.ground={group:P,disc:y,shadow:A},this.root.add(P)}}this.root.traverse(m=>{m.material&&!(m.userData&&m.userData.noClip)&&!m.isSprite&&!m.isLine&&this.clipMaterials.add(m.material)}),this.cutY!=null&&this.setCut(this.cutY,this.cutLevel);let p=Object.values(this.levels).flatMap(m=>m.stairs.filter(g=>!g.arrival));for(let m of p){let g=this.levels[m.to];g&&g.stairs.push({...m,arrival:!0})}let x=Math.min(pf,this.maxLights??pf,Math.max(1,this.lamps.length));for(let m=0;m<x;m++){let g=new Br(16777215,0,9,2);g.castShadow=!!i.lampShadows&&m<2,g.shadow.mapSize.set(512,512),g.shadow.bias=-.002,g.position.set(0,-100,0),this.root.add(g),this.pool.push(g)}return this.reflections&&e>=3&&this.addReflectors(),this.setStates(t.entities,t.coverPositions,!0),this.updateLevelCollision(),this.root}addReflectors(){let{Reflector:t}=this._reflector||{};if(t)for(let e of Object.values(this.levels)){if(!e.extent)continue;let i=e.extent.maxX-e.extent.minX,s=e.extent.maxZ-e.extent.minZ,r=new t(new _n(i,s),{clipBias:.003,textureWidth:1024,textureHeight:1024,color:8949913});r.rotation.x=-Math.PI/2,r.position.set((e.extent.minX+e.extent.maxX)/2,e.elevation-.004,(e.extent.minZ+e.extent.maxZ)/2),r.userData={kind:"reflector"},e.group.add(r),this.reflectors.push(r)}}transparentClone(t){let e=t.clone();return e.transparent=!0,e.opacity=.9,e}glassMaterial(t,e){return this.quality>=3&&!this.lite?new Lr({color:15266040,metalness:0,roughness:t?.55:.05,transmission:t?.7:.92,thickness:.05,ior:1.5,transparent:!0,opacity:1,side:Le,envMapIntensity:1.2,clearcoat:.6}):new ke({color:14674419,transparent:!0,opacity:t?.62:.16,roughness:t?.5:.05,metalness:0,side:Le,envMapIntensity:1.4,depthWrite:!1})}shutterMaterial(){return this._shutter||(this._shutter=this.styledMaterial(new ke({color:this.style.palette.shutter,roughness:.6,metalness:.3}),"shutter")),this._shutter}markerMaterial(){return this._marker||(this._marker=this.styledMaterial(new ke({color:this.style.palette.open_door,emissive:this.style.palette.open_door,emissiveIntensity:.9,roughness:.8}),"open_door","emissive")),this._marker}lockMaterial(){return new ke({color:this.style.palette.lock_ok,emissive:this.style.palette.lock_ok,emissiveIntensity:.6,roughness:.5,metalness:.4})}lensMaterial(t){let e=this.style.palette.cone;return t===!1?new ke({color:10134453,roughness:.2}):this.styledMaterial(new ke({color:e,emissive:e,emissiveIntensity:.9,roughness:.2}),"cone","emissive")}bulbMaterial(t=3e3){let e=Bl(t);return new ke({color:16774880,emissive:new Ft(e[0],e[1],e[2]),emissiveIntensity:0,roughness:.4})}buildObject(t,e,i,s,r,o,a,l,c){let h=this.quality,f=this.lib,d=I=>f.get(I,h),{w_m:u,d_m:p,h_m:x}=t.size,m=Math.cos(r),g=Math.sin(r),b=(I,M)=>[e+I*m+M*g,s-I*g+M*m],T=h>=3,v=(I,M,E,R,N,O,F,V=.02,k=2)=>{let[W,j]=b(N,F),ht=Math.min(V,M/2-.001,E/2-.001,R/2-.001),ft=T&&ht>.003?new Xs(M,E,R,k,ht):new Be(M,E,R);r&&ft.rotateY(r),ft.translate(W,i+O,j),a(I,T?Xi(ft,f.tileM(I)):ft)},S=(I,M,E,R,N,O,F=16,V=M)=>{let[k,W]=b(R,O),j=gf(M,E,k,i+N,W,F,V);a(I,T?Xi(j,f.tileM(I)):j)},C=(I,M,E,R,N=.06,O=.022,F=.7)=>{for(let[V,k]of[[-1,-1],[1,-1],[-1,1],[1,1]])S(I,O,R,V*(M/2-N),R/2,k*(E/2-N),10,O*F)},P=t.item_id,y=P.split(".")[0],A=t.anchor_ref&&t.anchor_ref.resource_type==="ha_entity"?t.anchor_ref.resource_id:null;if(x>=.9&&y!=="mat"&&y!=="light"&&l.objectsBlocking.push({x:e,z:s,w:u,d:p,yaw:r}),y!=="light"&&y!=="mat"&&y!=="screen"&&(t.z_m||0)<.05){let I=u*1.3+.1,M=p*1.3+.1,E=(R,N)=>{let[O,F]=b(R,N);return[O,i+.009,F]};l.blobs.push(Vh(E(-I/2,-M/2),E(I/2,-M/2),E(I/2,M/2),E(-I/2,M/2)))}if(!(this.furnitureMode==="models"&&this.models&&this.models.place(P,t,e,i,s,r,o,l,c)))switch(y){case"sofa":{let I=u>1.9?3:2,M=.08;C("wood_dark",u-.1,p-.1,M,.04,.02,.8),v("fabric_accent",u,.34,p-.04,0,M+.17,.02,.045),v("fabric_accent",u,x-.42,.2,0,.42+(x-.42)/2,-p/2+.1,.05),v("fabric_accent",.2,.3,p,-u/2+.1,.42+.15,0,.06),v("fabric_accent",.2,.3,p,u/2-.1,.42+.15,0,.06);let E=(u-.4)/I-.02;for(let R=0;R<I;R++){let N=-(u-.4)/2+E/2+.01+R*(E+.02);v("fabric_grey",E,.14,p-.34,N,M+.34+.07,.07,.05),v("fabric_grey",E-.02,.36,.14,N,M+.34+.14+.18,-p/2+.27,.05)}break}case"chair":{if(P.includes("office")){S("metal_dark",.03,.45-.08,0,(.45-.08)/2+.04,0,12);for(let M=0;M<5;M++){let E=M/5*Math.PI*2;v("metal_dark",.3,.03,.04,Math.cos(E)*.15,.03,Math.sin(E)*.15,.01)}v("leather",u,.08,p,0,.45,0,.03),v("leather",u*.9,x-.45-.05,.08,0,.45+(x-.45)/2+.03,-p/2+.06,.03)}else C("wood_dark",u,p,.45,.035,.018,.75),v("wood_dark",u,.035,p,0,.45,0,.012),v("fabric_grey",u-.04,.05,p-.04,0,.45+.04,0,.018),v("wood_dark",u*.92,x-.45,.03,0,.45+(x-.45)/2,-p/2+.02,.012),S("wood_dark",.014,x-.45-.04,-u/2+.035,.45+(x-.45)/2,-p/2+.02,8),S("wood_dark",.014,x-.45-.04,u/2-.035,.45+(x-.45)/2,-p/2+.02,8);break}case"table":{let I=P.includes("coffee")?"wood_dark":P.includes("desk")?"wood_light":"oak";v(I,u,.035,p,0,x-.0175,0,.012),P.includes("coffee")?C("metal_dark",u,p,x-.035,.05,.016,.8):P.includes("desk")?(v("wood_light",.03,x-.035,p-.1,-u/2+.03,(x-.035)/2,0,.008),v("wood_light",.03,x-.035,p-.1,u/2-.03,(x-.035)/2,0,.008),v("wood_light",u-.1,.4,.02,0,x-.25,-p/2+.06,.006)):C("wood_dark",u,p,x-.035,.07,.03,.7),P.includes("desk")&&(v("metal_dark",.52,.32,.018,.15,x+.3,-p/2+.16,.006),v("metal_dark",.16,.12,.14,.15,x+.06,-p/2+.16,.008),v("metal_light",.42,.012,.14,.1,x+.006,.08,.004));break}case"cabinet":{let I=P.includes("bookcase")||P.includes("tv")?"wood_dark":"wood_light";if(P.includes("bookcase")){v(I,.025,x,p,-u/2+.0125,x/2,0,.004),v(I,.025,x,p,u/2-.0125,x/2,0,.004),v(I,u,.025,p,0,x-.0125,0,.004),v(I,u,.03,.02,0,x/2,-p/2+.01,.004);for(let M=0;M<=4;M++)v(I,u-.05,.02,p-.02,0,x/5*M+.01,.01,.004);for(let M=1;M<5;M++)for(let E=0;E<3;E++)v(E%2?"linen":"fabric_rug",(u-.1)/3.4,x/5*.62,p*.6,-(u-.1)/2+(u-.1)/3*(E+.5),x/5*M+.02+x/5*.31,.02,.006)}else{v(I,u,x-.06,p,0,(x-.06)/2+.06,0,.012),v("wood_dark",u-.08,.06,p-.06,0,.03,-.02,.006);let M=Math.max(1,Math.round(u/.5));for(let E=1;E<M;E++)v("wood_dark",.006,x-.1,.008,-u/2+u/M*E,(x-.06)/2+.06,p/2,.002);if(P.includes("wardrobe"))for(let E of[-1,1])v("metal_light",.012,.22,.012,E*.04,x*.5,p/2+.012,.005);else for(let E=0;E<M;E++)v("metal_light",Math.min(.14,u/M-.1),.012,.012,-u/2+u/M*(E+.5),x-.12,p/2+.012,.005)}break}case"screen":{let I=T?new Xs(u,x,p,2,.008):ni(u,x,p,0,0,0),M=new Wt(I,this.styledMaterial(new ke({color:this.style.palette.screen_off,emissive:7307158,emissiveIntensity:0,roughness:.2,metalness:.3}),"screen_off"));M.position.set(e,i+x/2,s),M.rotation.y=r,M.userData={kind:"device",entity:A,label:c.entityNames[A]||"\u05D8\u05DC\u05D5\u05D5\u05D9\u05D6\u05D9\u05D4",domain:"media_player"},M.castShadow=!0,o.add(M),this.devices.push(M),this.screens=this.screens||[],this.screens.push({entity:A,mesh:M});break}case"bed":{v("wood_light",u,.2,p,0,.1,0,.02),v("linen",u-.06,.2,p-.1,0,.3,.03,.06),v("fabric_grey",u-.02,.08,p*.62,0,.44,p*.17,.04),v("fabric_grey",u-.02,.05,.3,0,.47,p*.17-p*.31+.15,.025),v("linen",Math.min(.6,u/2-.12),.11,.42,u>1.2?-u/4:0,.455,-p/2+.32,.05),u>1.2&&v("linen",Math.min(.6,u/2-.12),.11,.42,u/4,.455,-p/2+.32,.05),v("wood_dark",u,x+.45,.05,0,(x+.45)/2,-p/2+.025,.02),C("wood_dark",u-.08,p-.08,.1,.02,.03,.9);break}case"kitchen":{if(P.includes("fridge"))v("metal_light",u,x,p,0,x/2,0,.03),v("metal_dark",.006,x-.5,.006,0,x*.55,p/2,.002),v("metal_dark",.02,.5,.02,u/2-.08,x*.6,p/2+.015,.008);else{v("wood_light",u,x-.14,p,0,(x-.14)/2+.1,0,.01),v("wood_dark",u-.06,.1,p-.06,0,.05,-.01,.006),v("concrete",u+.03,.04,p+.03,0,x-.02,0,.01);let I=Math.max(1,Math.round(Math.max(u,p)/.6)),M=u>=p;for(let E=1;E<I;E++)v("wood_dark",M?.006:u+.001,x-.3,M?p+.001:.006,M?-u/2+u/I*E:0,(x-.14)/2+.1,M?0:-p/2+p/I*E,.002);for(let E=0;E<I;E++)v("metal_light",M?.12:.012,.012,M?.012:.12,M?-u/2+u/I*(E+.5):(u/2+.012)*(t.rotation_deg?1:-1),x-.1,M?p/2+.012:-p/2+p/I*(E+.5),.005);P.includes("counter")&&u<p&&v("metal_light",.44,.012,.38,0,x+.006,0,.004),P.includes("island")&&v("metal_dark",.5,.008,.4,u/4,x+.004,0,.003)}break}case"plant":{S("concrete",u/2,.36,0,.18,0,18,u/2.3),S("wood_dark",u/2-.03,.02,0,.36,0,18);let I=u*.55;for(let[M,E,R,N]of[[0,x-I*.9,0,1],[I*.5,x-I*1.3,I*.2,.7],[-I*.45,x-I*1.25,-I*.3,.75],[I*.1,x-I*1.6,-I*.5,.6],[-I*.2,x-I*1.5,I*.5,.65]]){let O=new yn(I*N,12,9),[F,V]=b(M,R);O.translate(F,i+E,V),a("grass",O)}break}case"mat":v("fabric_rug",u,.016,p,0,.008,0,.006);break;case"sanitary":{P.includes("wc")?(S("tiles_white",.19,.38,0,.19,.08,18,.16),v("tiles_white",.4,.06,.5,0,.42,.04,.03),v("tiles_white",.38,.4,.17,0,.62,-p/2+.085,.025)):P.includes("tub")?(v("tiles_white",u,x,p,0,x/2,0,.06),v("linen",u-.18,.04,p-.18,0,x-.06,0,.012),v("metal_light",.02,.2,.02,u/2-.2,x+.1,0,.008)):(v("tiles_white",u,.14,p,0,x-.07,0,.04),v("tiles_white",.22,x-.14,.2,0,(x-.14)/2,0,.03),v("metal_light",.012,.16,.012,0,x+.08,-p/2+.06,.005));break}case"appliance":{P.includes("boiler")?(S("metal_light",u/2,x,0,x/2,0,18),S("metal_dark",u/2-.03,.02,0,x,0,18)):(v("metal_light",u,x,p,0,x/2,0,.025),S("metal_dark",.2,.02,0,x*.5,p/2+.01,24),v("metal_dark",u-.1,.1,.01,0,x-.09,p/2+.005,.004));break}case"extinguisher":{let I=gf(.08,x,e,i+x/2,s,12);a("metal_dark",I);let M=new Wt(new ii(.075,.075,x*.8,12),new ke({color:13124668,roughness:.4,metalness:.3}));M.position.set(e,i+x/2,s),o.add(M);break}case"light":{let I=P.includes("pendant")||P.includes("floor")?2700:3200,M=this.bulbMaterial(I),E,R,N=null;if(P.includes("ceiling")){let F=new Wt(new ii(u/2-.02,u/2*.88,.07,24),M);F.position.set(e,i+.035,s),E=F,R=new D(e,i-.12,s);let V=new Wt(new ii(u/2+.01,u/2+.01,.03,24),d("metal_light"));V.position.set(e,i+.085,s),o.add(V)}else if(P.includes("pendant")){let F=new Wt(new ii(.004,.004,.7,6),d("metal_dark"));F.position.set(e,i+x+.35,s),o.add(F);let V=new Wt(new ii(.05,.05,.02,16),d("metal_dark"));V.position.set(e,i+x+.69,s),o.add(V),N=new Wt(new ii(u/2,u/2*.45,x,24,1,!0),new ke({color:3817286,emissive:new Ft(...Bl(I)),emissiveIntensity:0,roughness:.5,metalness:.4,side:Le})),N.position.set(e,i+x/2,s),o.add(N);let k=new Wt(new yn(.045,12,10),M);k.position.set(e,i+.1,s),E=k,R=new D(e,i,s)}else if(P.includes("floor")){let F=new Wt(new ii(.012,.012,x-.3,10),d("metal_dark"));F.position.set(e,i+(x-.3)/2,s),o.add(F);let V=new Wt(new ii(.14,.15,.02,20),d("metal_dark"));V.position.set(e,i+.01,s),o.add(V);let k=new Wt(new ii(u/2,u/2*.82,.32,24,1,!0),M);k.position.set(e,i+x-.16,s),E=k,R=new D(e,i+x-.12,s)}else{let F=new Wt(T?new Xs(u,x,p,2,.02):new Be(u,x,p),M);F.position.set(e,i+x/2,s),F.rotation.y=r,E=F,R=new D(e,i+x/2,s)}E.userData={kind:"device",entity:A,label:c.entityNames[A]||A,domain:"light"},o.add(E),this.devices.push(E);let O=new vr(new As({map:A_(),color:new Ft(...Bl(I)),transparent:!0,opacity:0,depthWrite:!1,blending:Xn}));O.scale.set(1.1,1.1,1),O.position.copy(R),O.userData={noClip:!0},o.add(O),this.lamps.push({entity:A,bulb:E,pos:R,glow:O,kelvin:I,level:l.id,light:null,on:!1,kind:P,shade:N}),this.labels.push({kind:"device",entity:A,pos:R.clone(),level:l.id});break}default:v("concrete",u,x,p,0,x/2,0,.01)}}updateLevelCollision(){let t=this.plan.doc;for(let e of Object.values(this.levels)){let i=kh(t,this.W,this.H,e.id,this.plan.entities).map(s=>({a:[s.a[0]*this.scale,s.a[1]*this.scale],b:[s.b[0]*this.scale,s.b[1]*this.scale],w:(s.w||0)*this.scale,kind:s.kind,id:s.id}));for(let s of this.doors)if(s.lock&&this.plan.entities[s.lock]==="locked"){let r=t.openings.find(o=>o.id===s.id);if(r&&!i.some(o=>o.id===r.id)){let o=po(t,this.W,this.H,e.id).openings.find(a=>a.opening.id===r.id);o&&i.push({a:[o.g0[0]*this.scale,o.g0[1]*this.scale],b:[o.g1[0]*this.scale,o.g1[1]*this.scale],w:o.wpx*this.scale,kind:"door-locked",id:r.id})}}for(let s of e.objectsBlocking){let r=Math.cos(s.yaw),o=Math.sin(s.yaw),a=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([l,c])=>[s.x+l*s.w/2*r+c*s.d/2*o,s.z-l*s.w/2*o+c*s.d/2*r]);for(let l=0;l<4;l++)i.push({a:a[l],b:a[(l+1)%4],w:0,kind:"object",id:"obj"})}e.segs=i}}setStates(t,e,i=!1){this.plan.entities=t,this.plan.coverPositions=e||this.plan.coverPositions||{};for(let s of this.doors){let r=s.entity?Ul(t[s.entity]):!1;s.open=r,i&&(s.t=r?1:0)}for(let s of this.shutters){let r=this.plan.coverPositions[s.entity],o=t[s.entity];s.target=typeof r=="number"?r/100:o==="open"?1:0,i&&(s.current=s.target)}for(let s of this.lamps)s.on=t[s.entity]==="on";for(let s of this.markers)s.group.visible=Ul(t[s.entity]);for(let s of this.presence)s.mesh.visible=t[s.entity]==="on";for(let s of this.tints)s.mesh.visible=t[s.entity]==="on";for(let s of this.screens||[])s.mesh.material.emissiveIntensity=t[s.entity]==="playing"||t[s.entity]==="on"?.9:0;for(let s of this.lockPlates||[]){let o=t[s.entity]==="locked"?this.style.palette.open_door:this.style.palette.lock_ok;s.mesh.material.color.setHex(o),s.mesh.material.emissive.setHex(o)}this.updateLevelCollision()}update(t,e,i={}){let s=!1,r=Math.min(1,t/(S_/1e3));for(let h of this.doors){let f=h.open?1:0;Math.abs(h.t-f)>.001&&(h.t+=Math.sign(f-h.t)*r,h.t=Math.max(0,Math.min(1,h.t)),s=!0);let d=h.t<.5?2*h.t*h.t:1-Math.pow(-2*h.t+2,2)/2;for(let u of h.leaves)u.kind==="swing"?u.grp.rotation.y=u.closedYaw+(u.openYaw-u.closedYaw)*d:u.grp.position.set(u.base[0]+u.slide[0]*d,u.grp.position.y,u.base[1]+u.slide[1]*d)}for(let h of this.shutters){Math.abs(h.current-h.target)>.001&&(h.current+=Math.sign(h.target-h.current)*r*.6,h.current=Math.max(0,Math.min(1,h.current)),s=!0);let f=h.height*(1-h.current);h.mesh.scale.y=Math.max(.001,f),h.mesh.visible=f>.01}let o=i.nightFactor??0,a=this.style.rig,l=this.lamps.filter(h=>h.on&&this.levels[h.level].group.visible);for(let h of this.lamps){let f=h.on?this.quality>=3?mf(a.lampEmissiveDay,a.lampEmissiveNight,o):1.4:0;h.bulb.material.emissiveIntensity+=(f-h.bulb.material.emissiveIntensity)*Math.min(1,t*8),h.shade&&(h.shade.material.emissiveIntensity=h.bulb.material.emissiveIntensity*.22);let d=this.cutY!=null&&h.pos.y>this.cutY,u=h.on&&!d?.16+o*.26:0;h.glow.material.opacity+=(u-h.glow.material.opacity)*Math.min(1,t*8),Math.abs(f-h.bulb.material.emissiveIntensity)>.01&&(s=!0)}l.sort((h,f)=>h.pos.distanceToSquared(e)-f.pos.distanceToSquared(e));let c=l.slice(0,this.pool.length);for(let h=0;h<this.pool.length;h++){let f=this.pool[h],d=c[h];if(!d){f.intensity=0;continue}f.position.copy(d.pos);let u=Bl(d.kelvin+a.lampKelvinOffset);f.color.setRGB(u[0],u[1],u[2]);let p=d.kind.includes("floor")?6:d.kind.includes("wall")?5:11;f.intensity=p*mf(a.lampPoolDay,a.lampPoolNight,o)}return s}showLevel(t,e=!1){let i=Object.keys(this.levels);for(let s of i){let r=this.levels[s],o=t==="all"||t===s;r.group.visible=o;let a=!!(e||t==="all"&&s!==i[i.length-1]);for(let l of r.ceilings)l.visible=a&&!(t==="all"&&!e&&s===i[i.length-1]);if(t==="all"&&!e)for(let l of r.ceilings)l.visible=!1}for(let s of this.cameras)s.vol.visible=e,s.cone.visible=!e}pick(t){let e=t.intersectObjects(this.devices,!1);for(let i of e){let s=i.object.userData;if(s&&(s.kind==="device"||s.kind==="camera"||s.kind==="lock"))return{...s,point:i.point,distance:i.distance}}return null}};function E_(n,t,e,i,s){let r=[n],o=Math.max(24,Math.round(e/2));for(let a=0;a<=o;a++){let c=(t-e/2+e*a/o-90)*Math.PI/180,h=[Math.cos(c),Math.sin(c)],f=i;for(let d of s){let u=T_(n,h,d.a,d.b);u!==null&&u>.5&&u<f&&(f=u)}r.push([n[0]+h[0]*f,n[1]+h[1]*f])}return r}function T_(n,t,e,i){let s=i[0]-e[0],r=i[1]-e[1],o=t[0]*r-t[1]*s;if(Math.abs(o)<1e-12)return null;let a=e[0]-n[0],l=e[1]-n[1],c=(a*r-l*s)/o,h=(a*t[1]-l*t[0])/o;return c<0||h<-1e-9||h>1+1e-9?null:c}function Bl(n){let t=n/100,e,i,s;e=t<=66?255:329.698727446*Math.pow(t-60,-.1332047592),i=t<=66?99.4708025861*Math.log(t)-161.1195681661:288.1221695283*Math.pow(t-60,-.0755148492),s=t>=66?255:t<=19?0:138.5177312231*Math.log(t-10)-305.0447927307;let r=o=>Math.max(0,Math.min(255,o))/255;return[r(e),r(i),r(s)]}var mo=null;function A_(){if(mo)return mo;let n=document.createElement("canvas");n.width=n.height=128;let t=n.getContext("2d"),e=t.createRadialGradient(64,64,0,64,64,64);return e.addColorStop(0,"rgba(255,255,255,1)"),e.addColorStop(.25,"rgba(255,255,255,0.55)"),e.addColorStop(1,"rgba(255,255,255,0)"),t.fillStyle=e,t.fillRect(0,0,128,128),mo=new nn(n),mo.colorSpace=De,mo}var qi={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

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


		}`};var Ze=class{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}},C_=new Pi(-1,1,1,-1,0,1),Wh=class extends we{constructor(){super(),this.setAttribute("position",new oe([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new oe([0,2,0,0,2,0],2))}},R_=new Wh,Mi=class{constructor(t){this._mesh=new Wt(R_,t)}dispose(){this._mesh.geometry.dispose()}render(t){t.render(this._mesh,C_)}get material(){return this._mesh.material}set material(t){this._mesh.material=t}};var zl=class extends Ze{constructor(t,e="tDiffuse"){super(),this.textureID=e,this.uniforms=null,this.material=null,t instanceof le?(this.uniforms=t.uniforms,this.material=t):t&&(this.uniforms=Ce.clone(t.uniforms),this.material=new le({name:t.name!==void 0?t.name:"unspecified",defines:Object.assign({},t.defines),uniforms:this.uniforms,vertexShader:t.vertexShader,fragmentShader:t.fragmentShader})),this._fsQuad=new Mi(this.material)}render(t,e,i){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=i.texture),this._fsQuad.material=this.material,this.renderToScreen?(t.setRenderTarget(null),this._fsQuad.render(t)):(t.setRenderTarget(e),this.clear&&t.clear(t.autoClearColor,t.autoClearDepth,t.autoClearStencil),this._fsQuad.render(t))}dispose(){this.material.dispose(),this._fsQuad.dispose()}};var go=class extends Ze{constructor(t,e){super(),this.scene=t,this.camera=e,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(t,e,i){let s=t.getContext(),r=t.state;r.buffers.color.setMask(!1),r.buffers.depth.setMask(!1),r.buffers.color.setLocked(!0),r.buffers.depth.setLocked(!0);let o,a;this.inverse?(o=0,a=1):(o=1,a=0),r.buffers.stencil.setTest(!0),r.buffers.stencil.setOp(s.REPLACE,s.REPLACE,s.REPLACE),r.buffers.stencil.setFunc(s.ALWAYS,o,4294967295),r.buffers.stencil.setClear(a),r.buffers.stencil.setLocked(!0),t.setRenderTarget(i),this.clear&&t.clear(),t.render(this.scene,this.camera),t.setRenderTarget(e),this.clear&&t.clear(),t.render(this.scene,this.camera),r.buffers.color.setLocked(!1),r.buffers.depth.setLocked(!1),r.buffers.color.setMask(!0),r.buffers.depth.setMask(!0),r.buffers.stencil.setLocked(!1),r.buffers.stencil.setFunc(s.EQUAL,1,4294967295),r.buffers.stencil.setOp(s.KEEP,s.KEEP,s.KEEP),r.buffers.stencil.setLocked(!0)}},Hl=class extends Ze{constructor(){super(),this.needsSwap=!1}render(t){t.state.buffers.stencil.setLocked(!1),t.state.buffers.stencil.setTest(!1)}};var Vl=class{constructor(t,e){if(this.renderer=t,this._pixelRatio=t.getPixelRatio(),e===void 0){let i=t.getSize(new tt);this._width=i.width,this._height=i.height,e=new he(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:ve}),e.texture.name="EffectComposer.rt1"}else this._width=e.width,this._height=e.height;this.renderTarget1=e,this.renderTarget2=e.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new zl(qi),this.copyPass.material.blending=Ae,this.timer=new zr}swapBuffers(){let t=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=t}addPass(t){this.passes.push(t),t.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(t,e){this.passes.splice(e,0,t),t.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(t){let e=this.passes.indexOf(t);e!==-1&&this.passes.splice(e,1)}isLastEnabledPass(t){for(let e=t+1;e<this.passes.length;e++)if(this.passes[e].enabled)return!1;return!0}render(t){this.timer.update(),t===void 0&&(t=this.timer.getDelta());let e=this.renderer.getRenderTarget(),i=!1;for(let s=0,r=this.passes.length;s<r;s++){let o=this.passes[s];if(o.enabled!==!1){if(o.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(s),o.render(this.renderer,this.writeBuffer,this.readBuffer,t,i),o.needsSwap){if(i){let a=this.renderer.getContext(),l=this.renderer.state.buffers.stencil;l.setFunc(a.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,t),l.setFunc(a.EQUAL,1,4294967295)}this.swapBuffers()}go!==void 0&&(o instanceof go?i=!0:o instanceof Hl&&(i=!1))}}this.renderer.setRenderTarget(e)}reset(t){if(t===void 0){let e=this.renderer.getSize(new tt);this._pixelRatio=this.renderer.getPixelRatio(),this._width=e.width,this._height=e.height,t=this.renderTarget1.clone(),t.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=t,this.renderTarget2=t.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(t,e){this._width=t,this._height=e;let i=this._width*this._pixelRatio,s=this._height*this._pixelRatio;this.renderTarget1.setSize(i,s),this.renderTarget2.setSize(i,s);for(let r=0;r<this.passes.length;r++)this.passes[r].setSize(i,s)}setPixelRatio(t){this._pixelRatio=t,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}};var Gl=class extends Ze{constructor(t,e,i=null,s=null,r=null){super(),this.scene=t,this.camera=e,this.overrideMaterial=i,this.clearColor=s,this.clearAlpha=r,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new Ft}render(t,e,i){let s=t.autoClear;t.autoClear=!1;let r,o;this.overrideMaterial!==null&&(o=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(t.getClearColor(this._oldClearColor),t.setClearColor(this.clearColor,t.getClearAlpha())),this.clearAlpha!==null&&(r=t.getClearAlpha(),t.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&t.clearDepth(),t.setRenderTarget(this.renderToScreen?null:i),this.clear===!0&&t.clear(t.autoClearColor,t.autoClearDepth,t.autoClearStencil),t.render(this.scene,this.camera),this.clearColor!==null&&t.setClearColor(this._oldClearColor),this.clearAlpha!==null&&t.setClearAlpha(r),this.overrideMaterial!==null&&(this.scene.overrideMaterial=o),t.autoClear=s}};var xo={name:"GTAOShader",defines:{PERSPECTIVE_CAMERA:1,SAMPLES:16,NORMAL_VECTOR_TYPE:1,DEPTH_SWIZZLING:"x",SCREEN_SPACE_RADIUS:0,SCREEN_SPACE_RADIUS_SCALE:100,SCENE_CLIP_BOX:0},uniforms:{tNormal:{value:null},tDepth:{value:null},tNoise:{value:null},resolution:{value:new tt},cameraNear:{value:null},cameraFar:{value:null},cameraProjectionMatrix:{value:new re},cameraProjectionMatrixInverse:{value:new re},cameraWorldMatrix:{value:new re},radius:{value:.25},distanceExponent:{value:1},thickness:{value:1},distanceFallOff:{value:1},scale:{value:1},sceneBoxMin:{value:new D(-1,-1,-1)},sceneBoxMax:{value:new D(1,1,1)}},vertexShader:`

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
		}`},vo={name:"GTAODepthShader",defines:{PERSPECTIVE_CAMERA:1},uniforms:{tDepth:{value:null},cameraNear:{value:null},cameraFar:{value:null}},vertexShader:`
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

		}`},Wl={name:"GTAOBlendShader",uniforms:{tDiffuse:{value:null},intensity:{value:1}},vertexShader:`
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
		}`};function xf(n=5){let t=Math.floor(n)%2===0?Math.floor(n)+1:Math.floor(n),e=P_(t),i=e.length,s=new Uint8Array(i*4);for(let o=0;o<i;++o){let a=e[o],l=2*Math.PI*a/i,c=new D(Math.cos(l),Math.sin(l),0).normalize();s[o*4]=(c.x*.5+.5)*255,s[o*4+1]=(c.y*.5+.5)*255,s[o*4+2]=127,s[o*4+3]=255}let r=new vn(s,t,t);return r.wrapS=hi,r.wrapT=hi,r.needsUpdate=!0,r}function P_(n){let t=Math.floor(n)%2===0?Math.floor(n)+1:Math.floor(n),e=t*t,i=Array(e).fill(0),s=Math.floor(t/2),r=t-1;for(let o=1;o<=e;){if(s===-1&&r===t?(r=t-2,s=0):(r===t&&(r=0),s<0&&(s=t-1)),i[s*t+r]!==0){r-=2,s++;continue}else i[s*t+r]=o++;r++,s--}return i}var _o={name:"PoissonDenoiseShader",defines:{SAMPLES:16,SAMPLE_VECTORS:Xh(16,2,1),NORMAL_VECTOR_TYPE:1,DEPTH_VALUE_SOURCE:0},uniforms:{tDiffuse:{value:null},tNormal:{value:null},tDepth:{value:null},tNoise:{value:null},resolution:{value:new tt},cameraProjectionMatrixInverse:{value:new re},lumaPhi:{value:5},depthPhi:{value:5},normalPhi:{value:5},radius:{value:4},index:{value:0}},vertexShader:`

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
		}`};function Xh(n,t,e){let i=L_(n,t,e),s="vec3[SAMPLES](";for(let r=0;r<n;r++){let o=i[r];s+=`vec3(${o.x}, ${o.y}, ${o.z})${r<n-1?",":")"}`}return s}function L_(n,t,e){let i=[];for(let s=0;s<n;s++){let r=2*Math.PI*t*s/n,o=Math.pow(s/(n-1),e);i.push(new D(Math.cos(r),Math.sin(r),o))}return i}var Xl=class{constructor(t=Math){this.grad3=[[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]],this.grad4=[[0,1,1,1],[0,1,1,-1],[0,1,-1,1],[0,1,-1,-1],[0,-1,1,1],[0,-1,1,-1],[0,-1,-1,1],[0,-1,-1,-1],[1,0,1,1],[1,0,1,-1],[1,0,-1,1],[1,0,-1,-1],[-1,0,1,1],[-1,0,1,-1],[-1,0,-1,1],[-1,0,-1,-1],[1,1,0,1],[1,1,0,-1],[1,-1,0,1],[1,-1,0,-1],[-1,1,0,1],[-1,1,0,-1],[-1,-1,0,1],[-1,-1,0,-1],[1,1,1,0],[1,1,-1,0],[1,-1,1,0],[1,-1,-1,0],[-1,1,1,0],[-1,1,-1,0],[-1,-1,1,0],[-1,-1,-1,0]],this.p=[];for(let e=0;e<256;e++)this.p[e]=Math.floor(t.random()*256);this.perm=[];for(let e=0;e<512;e++)this.perm[e]=this.p[e&255];this.simplex=[[0,1,2,3],[0,1,3,2],[0,0,0,0],[0,2,3,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,3,0],[0,2,1,3],[0,0,0,0],[0,3,1,2],[0,3,2,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,3,2,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,0,3],[0,0,0,0],[1,3,0,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,3,0,1],[2,3,1,0],[1,0,2,3],[1,0,3,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,3,1],[0,0,0,0],[2,1,3,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,1,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,0,1,2],[3,0,2,1],[0,0,0,0],[3,1,2,0],[2,1,0,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,1,0,2],[0,0,0,0],[3,2,0,1],[3,2,1,0]]}noise(t,e){let i,s,r,o=.5*(Math.sqrt(3)-1),a=(t+e)*o,l=Math.floor(t+a),c=Math.floor(e+a),h=(3-Math.sqrt(3))/6,f=(l+c)*h,d=l-f,u=c-f,p=t-d,x=e-u,m,g;p>x?(m=1,g=0):(m=0,g=1);let b=p-m+h,T=x-g+h,v=p-1+2*h,S=x-1+2*h,C=l&255,P=c&255,y=this.perm[C+this.perm[P]]%12,A=this.perm[C+m+this.perm[P+g]]%12,U=this.perm[C+1+this.perm[P+1]]%12,I=.5-p*p-x*x;I<0?i=0:(I*=I,i=I*I*this._dot(this.grad3[y],p,x));let M=.5-b*b-T*T;M<0?s=0:(M*=M,s=M*M*this._dot(this.grad3[A],b,T));let E=.5-v*v-S*S;return E<0?r=0:(E*=E,r=E*E*this._dot(this.grad3[U],v,S)),70*(i+s+r)}noise3d(t,e,i){let s,r,o,a,c=(t+e+i)*.3333333333333333,h=Math.floor(t+c),f=Math.floor(e+c),d=Math.floor(i+c),u=1/6,p=(h+f+d)*u,x=h-p,m=f-p,g=d-p,b=t-x,T=e-m,v=i-g,S,C,P,y,A,U;b>=T?T>=v?(S=1,C=0,P=0,y=1,A=1,U=0):b>=v?(S=1,C=0,P=0,y=1,A=0,U=1):(S=0,C=0,P=1,y=1,A=0,U=1):T<v?(S=0,C=0,P=1,y=0,A=1,U=1):b<v?(S=0,C=1,P=0,y=0,A=1,U=1):(S=0,C=1,P=0,y=1,A=1,U=0);let I=b-S+u,M=T-C+u,E=v-P+u,R=b-y+2*u,N=T-A+2*u,O=v-U+2*u,F=b-1+3*u,V=T-1+3*u,k=v-1+3*u,W=h&255,j=f&255,ht=d&255,ft=this.perm[W+this.perm[j+this.perm[ht]]]%12,At=this.perm[W+S+this.perm[j+C+this.perm[ht+P]]]%12,wt=this.perm[W+y+this.perm[j+A+this.perm[ht+U]]]%12,Gt=this.perm[W+1+this.perm[j+1+this.perm[ht+1]]]%12,Z=.6-b*b-T*T-v*v;Z<0?s=0:(Z*=Z,s=Z*Z*this._dot3(this.grad3[ft],b,T,v));let K=.6-I*I-M*M-E*E;K<0?r=0:(K*=K,r=K*K*this._dot3(this.grad3[At],I,M,E));let dt=.6-R*R-N*N-O*O;dt<0?o=0:(dt*=dt,o=dt*dt*this._dot3(this.grad3[wt],R,N,O));let Pt=.6-F*F-V*V-k*k;return Pt<0?a=0:(Pt*=Pt,a=Pt*Pt*this._dot3(this.grad3[Gt],F,V,k)),32*(s+r+o+a)}noise4d(t,e,i,s){let r=this.grad4,o=this.simplex,a=this.perm,l=(Math.sqrt(5)-1)/4,c=(5-Math.sqrt(5))/20,h,f,d,u,p,x=(t+e+i+s)*l,m=Math.floor(t+x),g=Math.floor(e+x),b=Math.floor(i+x),T=Math.floor(s+x),v=(m+g+b+T)*c,S=m-v,C=g-v,P=b-v,y=T-v,A=t-S,U=e-C,I=i-P,M=s-y,E=A>U?32:0,R=A>I?16:0,N=U>I?8:0,O=A>M?4:0,F=U>M?2:0,V=I>M?1:0,k=E+R+N+O+F+V,W=o[k][0]>=3?1:0,j=o[k][1]>=3?1:0,ht=o[k][2]>=3?1:0,ft=o[k][3]>=3?1:0,At=o[k][0]>=2?1:0,wt=o[k][1]>=2?1:0,Gt=o[k][2]>=2?1:0,Z=o[k][3]>=2?1:0,K=o[k][0]>=1?1:0,dt=o[k][1]>=1?1:0,Pt=o[k][2]>=1?1:0,vt=o[k][3]>=1?1:0,Bt=A-W+c,ee=U-j+c,et=I-ht+c,at=M-ft+c,st=A-At+2*c,ot=U-wt+2*c,ct=I-Gt+2*c,Ut=M-Z+2*c,Rt=A-K+3*c,It=U-dt+3*c,Xt=I-Pt+3*c,B=M-vt+3*c,ne=A-1+4*c,jt=U-1+4*c,L=I-1+4*c,_=M-1+4*c,G=m&255,X=g&255,Q=b&255,ut=T&255,pt=a[G+a[X+a[Q+a[ut]]]]%32,$=a[G+W+a[X+j+a[Q+ht+a[ut+ft]]]]%32,nt=a[G+At+a[X+wt+a[Q+Gt+a[ut+Z]]]]%32,xt=a[G+K+a[X+dt+a[Q+Pt+a[ut+vt]]]]%32,kt=a[G+1+a[X+1+a[Q+1+a[ut+1]]]]%32,gt=.6-A*A-U*U-I*I-M*M;gt<0?h=0:(gt*=gt,h=gt*gt*this._dot4(r[pt],A,U,I,M));let mt=.6-Bt*Bt-ee*ee-et*et-at*at;mt<0?f=0:(mt*=mt,f=mt*mt*this._dot4(r[$],Bt,ee,et,at));let Lt=.6-st*st-ot*ot-ct*ct-Ut*Ut;Lt<0?d=0:(Lt*=Lt,d=Lt*Lt*this._dot4(r[nt],st,ot,ct,Ut));let Ht=.6-Rt*Rt-It*It-Xt*Xt-B*B;Ht<0?u=0:(Ht*=Ht,u=Ht*Ht*this._dot4(r[xt],Rt,It,Xt,B));let Zt=.6-ne*ne-jt*jt-L*L-_*_;return Zt<0?p=0:(Zt*=Zt,p=Zt*Zt*this._dot4(r[kt],ne,jt,L,_)),27*(h+f+d+u+p)}_dot(t,e,i){return t[0]*e+t[1]*i}_dot3(t,e,i,s){return t[0]*e+t[1]*i+t[2]*s}_dot4(t,e,i,s,r){return t[0]*e+t[1]*i+t[2]*s+t[3]*r}};var Zs=class n extends Ze{constructor(t,e,i=512,s=512,r,o,a){super(),this.width=i,this.height=s,this.clear=!0,this.camera=e,this.scene=t,this.output=0,this._renderGBuffer=!0,this._visibilityCache=[],this.blendIntensity=1,this.pdRings=2,this.pdRadiusExponent=2,this.pdSamples=16,this.gtaoNoiseTexture=xf(),this.pdNoiseTexture=this._generateNoise(),this.gtaoRenderTarget=new he(this.width,this.height,{type:ve,depthBuffer:!1}),this.pdRenderTarget=this.gtaoRenderTarget.clone(),this.gtaoMaterial=new le({defines:Object.assign({},xo.defines),uniforms:Ce.clone(xo.uniforms),vertexShader:xo.vertexShader,fragmentShader:xo.fragmentShader,blending:Ae,depthTest:!1,depthWrite:!1}),this.gtaoMaterial.defines.PERSPECTIVE_CAMERA=this.camera.isPerspectiveCamera?1:0,this.gtaoMaterial.uniforms.tNoise.value=this.gtaoNoiseTexture,this.gtaoMaterial.uniforms.resolution.value.set(this.width,this.height),this.gtaoMaterial.uniforms.cameraNear.value=this.camera.near,this.gtaoMaterial.uniforms.cameraFar.value=this.camera.far,this.normalMaterial=new Ir,this.normalMaterial.blending=Ae,this.pdMaterial=new le({defines:Object.assign({},_o.defines),uniforms:Ce.clone(_o.uniforms),vertexShader:_o.vertexShader,fragmentShader:_o.fragmentShader,depthTest:!1,depthWrite:!1}),this.pdMaterial.uniforms.tDiffuse.value=this.gtaoRenderTarget.texture,this.pdMaterial.uniforms.tNoise.value=this.pdNoiseTexture,this.pdMaterial.uniforms.resolution.value.set(this.width,this.height),this.pdMaterial.uniforms.lumaPhi.value=10,this.pdMaterial.uniforms.depthPhi.value=2,this.pdMaterial.uniforms.normalPhi.value=3,this.pdMaterial.uniforms.radius.value=8,this.depthRenderMaterial=new le({defines:Object.assign({},vo.defines),uniforms:Ce.clone(vo.uniforms),vertexShader:vo.vertexShader,fragmentShader:vo.fragmentShader,blending:Ae}),this.depthRenderMaterial.uniforms.cameraNear.value=this.camera.near,this.depthRenderMaterial.uniforms.cameraFar.value=this.camera.far,this.copyMaterial=new le({uniforms:Ce.clone(qi.uniforms),vertexShader:qi.vertexShader,fragmentShader:qi.fragmentShader,transparent:!0,depthTest:!1,depthWrite:!1,blendSrc:Wr,blendDst:qn,blendEquation:_i,blendSrcAlpha:Gr,blendDstAlpha:qn,blendEquationAlpha:_i}),this.blendMaterial=new le({uniforms:Ce.clone(Wl.uniforms),vertexShader:Wl.vertexShader,fragmentShader:Wl.fragmentShader,transparent:!0,depthTest:!1,depthWrite:!1,blending:Fa,blendSrc:Wr,blendDst:qn,blendEquation:_i,blendSrcAlpha:Gr,blendDstAlpha:qn,blendEquationAlpha:_i}),this._fsQuad=new Mi(null),this._originalClearColor=new Ft,this.setGBuffer(r?r.depthTexture:void 0,r?r.normalTexture:void 0),o!==void 0&&this.updateGtaoMaterial(o),a!==void 0&&this.updatePdMaterial(a)}setSize(t,e){this.width=t,this.height=e,this.gtaoRenderTarget.setSize(t,e),this.normalRenderTarget.setSize(t,e),this.pdRenderTarget.setSize(t,e),this.gtaoMaterial.uniforms.resolution.value.set(t,e),this.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this.pdMaterial.uniforms.resolution.value.set(t,e),this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse)}dispose(){this.gtaoNoiseTexture.dispose(),this.pdNoiseTexture.dispose(),this.normalRenderTarget.dispose(),this.gtaoRenderTarget.dispose(),this.pdRenderTarget.dispose(),this.normalMaterial.dispose(),this.pdMaterial.dispose(),this.copyMaterial.dispose(),this.depthRenderMaterial.dispose(),this._fsQuad.dispose()}get gtaoMap(){return this.pdRenderTarget.texture}setGBuffer(t,e){t!==void 0?(this.depthTexture=t,this.normalTexture=e,this._renderGBuffer=!1):(this.depthTexture=new Hi,this.depthTexture.format=Vi,this.depthTexture.type=Ln,this.normalRenderTarget=new he(this.width,this.height,{minFilter:Se,magFilter:Se,type:ve,depthTexture:this.depthTexture}),this.normalTexture=this.normalRenderTarget.texture,this._renderGBuffer=!0);let i=this.normalTexture?1:0,s=this.depthTexture===this.normalTexture?"w":"x";this.gtaoMaterial.defines.NORMAL_VECTOR_TYPE=i,this.gtaoMaterial.defines.DEPTH_SWIZZLING=s,this.gtaoMaterial.uniforms.tNormal.value=this.normalTexture,this.gtaoMaterial.uniforms.tDepth.value=this.depthTexture,this.pdMaterial.defines.NORMAL_VECTOR_TYPE=i,this.pdMaterial.defines.DEPTH_SWIZZLING=s,this.pdMaterial.uniforms.tNormal.value=this.normalTexture,this.pdMaterial.uniforms.tDepth.value=this.depthTexture,this.depthRenderMaterial.uniforms.tDepth.value=this.normalRenderTarget.depthTexture}setSceneClipBox(t){t?(this.gtaoMaterial.needsUpdate=this.gtaoMaterial.defines.SCENE_CLIP_BOX!==1,this.gtaoMaterial.defines.SCENE_CLIP_BOX=1,this.gtaoMaterial.uniforms.sceneBoxMin.value.copy(t.min),this.gtaoMaterial.uniforms.sceneBoxMax.value.copy(t.max)):(this.gtaoMaterial.needsUpdate=this.gtaoMaterial.defines.SCENE_CLIP_BOX===0,this.gtaoMaterial.defines.SCENE_CLIP_BOX=0)}updateGtaoMaterial(t){t.radius!==void 0&&(this.gtaoMaterial.uniforms.radius.value=t.radius),t.distanceExponent!==void 0&&(this.gtaoMaterial.uniforms.distanceExponent.value=t.distanceExponent),t.thickness!==void 0&&(this.gtaoMaterial.uniforms.thickness.value=t.thickness),t.distanceFallOff!==void 0&&(this.gtaoMaterial.uniforms.distanceFallOff.value=t.distanceFallOff,this.gtaoMaterial.needsUpdate=!0),t.scale!==void 0&&(this.gtaoMaterial.uniforms.scale.value=t.scale),t.samples!==void 0&&t.samples!==this.gtaoMaterial.defines.SAMPLES&&(this.gtaoMaterial.defines.SAMPLES=t.samples,this.gtaoMaterial.needsUpdate=!0),t.screenSpaceRadius!==void 0&&(t.screenSpaceRadius?1:0)!==this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS&&(this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS=t.screenSpaceRadius?1:0,this.gtaoMaterial.needsUpdate=!0)}updatePdMaterial(t){let e=!1;t.lumaPhi!==void 0&&(this.pdMaterial.uniforms.lumaPhi.value=t.lumaPhi),t.depthPhi!==void 0&&(this.pdMaterial.uniforms.depthPhi.value=t.depthPhi),t.normalPhi!==void 0&&(this.pdMaterial.uniforms.normalPhi.value=t.normalPhi),t.radius!==void 0&&t.radius!==this.radius&&(this.pdMaterial.uniforms.radius.value=t.radius),t.radiusExponent!==void 0&&t.radiusExponent!==this.pdRadiusExponent&&(this.pdRadiusExponent=t.radiusExponent,e=!0),t.rings!==void 0&&t.rings!==this.pdRings&&(this.pdRings=t.rings,e=!0),t.samples!==void 0&&t.samples!==this.pdSamples&&(this.pdSamples=t.samples,e=!0),e&&(this.pdMaterial.defines.SAMPLES=this.pdSamples,this.pdMaterial.defines.SAMPLE_VECTORS=Xh(this.pdSamples,this.pdRings,this.pdRadiusExponent),this.pdMaterial.needsUpdate=!0)}render(t,e,i){switch(this._renderGBuffer&&(this._overrideVisibility(),this._renderOverride(t,this.normalMaterial,this.normalRenderTarget,7829503,1),this._restoreVisibility()),this.gtaoMaterial.uniforms.cameraNear.value=this.camera.near,this.gtaoMaterial.uniforms.cameraFar.value=this.camera.far,this.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this.gtaoMaterial.uniforms.cameraWorldMatrix.value.copy(this.camera.matrixWorld),this._renderPass(t,this.gtaoMaterial,this.gtaoRenderTarget,16777215,1),this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this._renderPass(t,this.pdMaterial,this.pdRenderTarget,16777215,1),this.output){case n.OUTPUT.Off:break;case n.OUTPUT.Diffuse:this.copyMaterial.uniforms.tDiffuse.value=i.texture,this.copyMaterial.blending=Ae,this._renderPass(t,this.copyMaterial,this.renderToScreen?null:e);break;case n.OUTPUT.AO:this.copyMaterial.uniforms.tDiffuse.value=this.gtaoRenderTarget.texture,this.copyMaterial.blending=Ae,this._renderPass(t,this.copyMaterial,this.renderToScreen?null:e);break;case n.OUTPUT.Denoise:this.copyMaterial.uniforms.tDiffuse.value=this.pdRenderTarget.texture,this.copyMaterial.blending=Ae,this._renderPass(t,this.copyMaterial,this.renderToScreen?null:e);break;case n.OUTPUT.Depth:this.depthRenderMaterial.uniforms.cameraNear.value=this.camera.near,this.depthRenderMaterial.uniforms.cameraFar.value=this.camera.far,this._renderPass(t,this.depthRenderMaterial,this.renderToScreen?null:e);break;case n.OUTPUT.Normal:this.copyMaterial.uniforms.tDiffuse.value=this.normalRenderTarget.texture,this.copyMaterial.blending=Ae,this._renderPass(t,this.copyMaterial,this.renderToScreen?null:e);break;case n.OUTPUT.Default:this.copyMaterial.uniforms.tDiffuse.value=i.texture,this.copyMaterial.blending=Ae,this._renderPass(t,this.copyMaterial,this.renderToScreen?null:e),this.blendMaterial.uniforms.intensity.value=this.blendIntensity,this.blendMaterial.uniforms.tDiffuse.value=this.pdRenderTarget.texture,this._renderPass(t,this.blendMaterial,this.renderToScreen?null:e);break;default:console.warn("THREE.GTAOPass: Unknown output type.")}}_renderPass(t,e,i,s,r){t.getClearColor(this._originalClearColor);let o=t.getClearAlpha(),a=t.autoClear;t.setRenderTarget(i),t.autoClear=!1,s!=null&&(t.setClearColor(s),t.setClearAlpha(r||0),t.clear()),this._fsQuad.material=e,this._fsQuad.render(t),t.autoClear=a,t.setClearColor(this._originalClearColor),t.setClearAlpha(o)}_renderOverride(t,e,i,s,r){t.getClearColor(this._originalClearColor);let o=t.getClearAlpha(),a=t.autoClear;t.setRenderTarget(i),t.autoClear=!1,s=e.clearColor||s,r=e.clearAlpha||r,s!=null&&(t.setClearColor(s),t.setClearAlpha(r||0),t.clear()),this.scene.overrideMaterial=e,t.render(this.scene,this.camera),this.scene.overrideMaterial=null,t.autoClear=a,t.setClearColor(this._originalClearColor),t.setClearAlpha(o)}_overrideVisibility(){let t=this.scene,e=this._visibilityCache;t.traverse(function(i){(i.isPoints||i.isLine||i.isLine2)&&i.visible&&(i.visible=!1,e.push(i))})}_restoreVisibility(){let t=this._visibilityCache;for(let e=0;e<t.length;e++)t[e].visible=!0;t.length=0}_generateNoise(t=64){let e=new Xl,i=t*t*4,s=new Uint8Array(i);for(let o=0;o<t;o++)for(let a=0;a<t;a++){let l=o,c=a;s[(o*t+a)*4]=(e.noise(l,c)*.5+.5)*255,s[(o*t+a)*4+1]=(e.noise(l+t,c)*.5+.5)*255,s[(o*t+a)*4+2]=(e.noise(l,c+t)*.5+.5)*255,s[(o*t+a)*4+3]=(e.noise(l+t,c+t)*.5+.5)*255}let r=new vn(s,t,t,ri,Qe);return r.wrapS=hi,r.wrapT=hi,r.needsUpdate=!0,r}};Zs.OUTPUT={Off:-1,Default:0,Diffuse:1,Depth:2,Normal:3,AO:4,Denoise:5};var vf={name:"LuminosityHighPassShader",uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new Ft(0)},defaultOpacity:{value:0}},vertexShader:`

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

		}`};var js=class n extends Ze{constructor(t,e=1,i,s){super(),this.strength=e,this.radius=i,this.threshold=s,this.resolution=t!==void 0?new tt(t.x,t.y):new tt(256,256),this.clearColor=new Ft(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let r=Math.round(this.resolution.x/2),o=Math.round(this.resolution.y/2);this.renderTargetBright=new he(r,o,{type:ve,depthBuffer:!1}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let h=0;h<this.nMips;h++){let f=new he(r,o,{type:ve,depthBuffer:!1});f.texture.name="UnrealBloomPass.h"+h,f.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(f);let d=new he(r,o,{type:ve,depthBuffer:!1});d.texture.name="UnrealBloomPass.v"+h,d.texture.generateMipmaps=!1,this.renderTargetsVertical.push(d),r=Math.round(r/2),o=Math.round(o/2)}let a=vf;this.highPassUniforms=Ce.clone(a.uniforms),this.highPassUniforms.luminosityThreshold.value=s,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new le({uniforms:this.highPassUniforms,vertexShader:a.vertexShader,fragmentShader:a.fragmentShader}),this.separableBlurMaterials=[];let l=[6,10,14,18,22];r=Math.round(this.resolution.x/2),o=Math.round(this.resolution.y/2);for(let h=0;h<this.nMips;h++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(l[h])),this.separableBlurMaterials[h].uniforms.invSize.value=new tt(1/r,1/o),r=Math.round(r/2),o=Math.round(o/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=e,this.compositeMaterial.uniforms.bloomRadius.value=.1;let c=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=c,this.bloomTintColors=[new D(1,1,1),new D(1,1,1),new D(1,1,1),new D(1,1,1),new D(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=Ce.clone(qi.uniforms),this.blendMaterial=new le({uniforms:this.copyUniforms,vertexShader:qi.vertexShader,fragmentShader:qi.fragmentShader,premultipliedAlpha:!0,blending:Xn,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new Ft,this._oldClearAlpha=1,this._basic=new Oe,this._fsQuad=new Mi(null)}dispose(){for(let t=0;t<this.renderTargetsHorizontal.length;t++)this.renderTargetsHorizontal[t].dispose();for(let t=0;t<this.renderTargetsVertical.length;t++)this.renderTargetsVertical[t].dispose();this.renderTargetBright.dispose();for(let t=0;t<this.separableBlurMaterials.length;t++)this.separableBlurMaterials[t].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(t,e){let i=Math.round(t/2),s=Math.round(e/2);this.renderTargetBright.setSize(i,s);for(let r=0;r<this.nMips;r++)this.renderTargetsHorizontal[r].setSize(i,s),this.renderTargetsVertical[r].setSize(i,s),this.separableBlurMaterials[r].uniforms.invSize.value=new tt(1/i,1/s),i=Math.round(i/2),s=Math.round(s/2)}render(t,e,i,s,r){t.getClearColor(this._oldClearColor),this._oldClearAlpha=t.getClearAlpha();let o=t.autoClear;t.autoClear=!1,t.setClearColor(this.clearColor,0),r&&t.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=i.texture,t.setRenderTarget(null),t.clear(),this._fsQuad.render(t)),this.highPassUniforms.tDiffuse.value=i.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,t.setRenderTarget(this.renderTargetBright),t.clear(),this._fsQuad.render(t);let a=this.renderTargetBright;for(let l=0;l<this.nMips;l++)this._fsQuad.material=this.separableBlurMaterials[l],this.separableBlurMaterials[l].uniforms.colorTexture.value=a.texture,this.separableBlurMaterials[l].uniforms.direction.value=n.BlurDirectionX,t.setRenderTarget(this.renderTargetsHorizontal[l]),t.clear(),this._fsQuad.render(t),this.separableBlurMaterials[l].uniforms.colorTexture.value=this.renderTargetsHorizontal[l].texture,this.separableBlurMaterials[l].uniforms.direction.value=n.BlurDirectionY,t.setRenderTarget(this.renderTargetsVertical[l]),t.clear(),this._fsQuad.render(t),a=this.renderTargetsVertical[l];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,t.setRenderTarget(this.renderTargetsHorizontal[0]),t.clear(),this._fsQuad.render(t),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,r&&t.state.buffers.stencil.setTest(!0),this.renderToScreen?(t.setRenderTarget(null),this._fsQuad.render(t)):(t.setRenderTarget(i),this._fsQuad.render(t)),t.setClearColor(this._oldClearColor,this._oldClearAlpha),t.autoClear=o}_getSeparableBlurMaterial(t){let e=[],i=t/3;for(let o=0;o<t;o++)e.push(.39894*Math.exp(-.5*o*o/(i*i))/i);let s=[],r=[];for(let o=1;o<t;o+=2){let a=e[o],l=o+1<t?e[o+1]:0,c=a+l;s.push((o*a+(o+1)*l)/c),r.push(c)}return new le({defines:{KERNEL_PAIRS:s.length},uniforms:{colorTexture:{value:null},invSize:{value:new tt(.5,.5)},direction:{value:new tt(.5,.5)},centerWeight:{value:e[0]},gaussianOffsets:{value:s},gaussianWeights:{value:r}},vertexShader:`

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

				}`})}_getCompositeMaterial(t){return new le({defines:{NUM_MIPS:t},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`

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

				}`})}};js.BlurDirectionX=new tt(1,0);js.BlurDirectionY=new tt(0,1);var yo={name:"SMAAEdgesShader",defines:{SMAA_THRESHOLD:"0.1"},uniforms:{tDiffuse:{value:null},resolution:{value:new tt(1/1024,1/512)}},vertexShader:`

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

		}`},Mo={name:"SMAAWeightsShader",defines:{SMAA_MAX_SEARCH_STEPS:"8",SMAA_AREATEX_MAX_DISTANCE:"16",SMAA_AREATEX_PIXEL_SIZE:"( 1.0 / vec2( 160.0, 560.0 ) )",SMAA_AREATEX_SUBTEX_SIZE:"( 1.0 / 7.0 )"},uniforms:{tDiffuse:{value:null},tArea:{value:null},tSearch:{value:null},resolution:{value:new tt(1/1024,1/512)}},vertexShader:`

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

		}`},ql={name:"SMAABlendShader",uniforms:{tDiffuse:{value:null},tColor:{value:null},resolution:{value:new tt(1/1024,1/512)}},vertexShader:`

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

		}`};var Yl=class extends Ze{constructor(){super(),this._edgesRT=new he(1,1,{depthBuffer:!1,type:ve}),this._edgesRT.texture.name="SMAAPass.edges",this._weightsRT=new he(1,1,{depthBuffer:!1,type:ve}),this._weightsRT.texture.name="SMAAPass.weights";let t=this,e=new Image;e.src=this._getAreaTexture(),e.onload=function(){t._areaTexture.needsUpdate=!0},this._areaTexture=new We,this._areaTexture.name="SMAAPass.area",this._areaTexture.image=e,this._areaTexture.minFilter=Fe,this._areaTexture.generateMipmaps=!1,this._areaTexture.flipY=!1;let i=new Image;i.src=this._getSearchTexture(),i.onload=function(){t._searchTexture.needsUpdate=!0},this._searchTexture=new We,this._searchTexture.name="SMAAPass.search",this._searchTexture.image=i,this._searchTexture.magFilter=Se,this._searchTexture.minFilter=Se,this._searchTexture.generateMipmaps=!1,this._searchTexture.flipY=!1,this._uniformsEdges=Ce.clone(yo.uniforms),this._materialEdges=new le({defines:Object.assign({},yo.defines),uniforms:this._uniformsEdges,vertexShader:yo.vertexShader,fragmentShader:yo.fragmentShader}),this._uniformsWeights=Ce.clone(Mo.uniforms),this._uniformsWeights.tDiffuse.value=this._edgesRT.texture,this._uniformsWeights.tArea.value=this._areaTexture,this._uniformsWeights.tSearch.value=this._searchTexture,this._materialWeights=new le({defines:Object.assign({},Mo.defines),uniforms:this._uniformsWeights,vertexShader:Mo.vertexShader,fragmentShader:Mo.fragmentShader}),this._uniformsBlend=Ce.clone(ql.uniforms),this._uniformsBlend.tDiffuse.value=this._weightsRT.texture,this._materialBlend=new le({uniforms:this._uniformsBlend,vertexShader:ql.vertexShader,fragmentShader:ql.fragmentShader}),this._fsQuad=new Mi(null)}render(t,e,i){this._uniformsEdges.tDiffuse.value=i.texture,this._fsQuad.material=this._materialEdges,t.setRenderTarget(this._edgesRT),this.clear&&t.clear(),this._fsQuad.render(t),this._fsQuad.material=this._materialWeights,t.setRenderTarget(this._weightsRT),this.clear&&t.clear(),this._fsQuad.render(t),this._uniformsBlend.tColor.value=i.texture,this._fsQuad.material=this._materialBlend,this.renderToScreen?(t.setRenderTarget(null),this._fsQuad.render(t)):(t.setRenderTarget(e),this.clear&&t.clear(),this._fsQuad.render(t))}setSize(t,e){this._edgesRT.setSize(t,e),this._weightsRT.setSize(t,e),this._materialEdges.uniforms.resolution.value.set(1/t,1/e),this._materialWeights.uniforms.resolution.value.set(1/t,1/e),this._materialBlend.uniforms.resolution.value.set(1/t,1/e)}dispose(){this._edgesRT.dispose(),this._weightsRT.dispose(),this._areaTexture.dispose(),this._searchTexture.dispose(),this._materialEdges.dispose(),this._materialWeights.dispose(),this._materialBlend.dispose(),this._fsQuad.dispose()}_getAreaTexture(){return"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKAAAAIwCAIAAACOVPcQAACBeklEQVR42u39W4xlWXrnh/3WWvuciIzMrKxrV8/0rWbY0+SQFKcb4owIkSIFCjY9AC1BT/LYBozRi+EX+cV+8IMsYAaCwRcBwjzMiw2jAWtgwC8WR5Q8mDFHZLNHTarZGrLJJllt1W2qKrsumZWZcTvn7L3W54e1vrXX3vuciLPPORFR1XE2EomorB0nVuz//r71re/y/1eMvb4Cb3N11xV/PP/2v4UBAwJG/7H8urx6/25/Gf8O5hypMQ0EEEQwAqLfoN/Z+97f/SW+/NvcgQk4sGBJK6H7N4PFVL+K+e0N11yNfkKvwUdwdlUAXPHHL38oa15f/i/46Ih6SuMSPmLAYAwyRKn7dfMGH97jaMFBYCJUgotIC2YAdu+LyW9vvubxAP8kAL8H/koAuOKP3+q6+xGnd5kdYCeECnGIJViwGJMAkQKfDvB3WZxjLKGh8VSCCzhwEWBpMc5/kBbjawT4HnwJfhr+pPBIu7uu+OOTo9vsmtQcniMBGkKFd4jDWMSCRUpLjJYNJkM+IRzQ+PQvIeAMTrBS2LEiaiR9b/5PuT6Ap/AcfAFO4Y3dA3DFH7/VS+M8k4baEAQfMI4QfbVDDGIRg7GKaIY52qAjTAgTvGBAPGIIghOCYAUrGFNgzA7Q3QhgCwfwAnwe5vDejgG44o/fbm1C5ZlYQvQDARPAIQGxCWBM+wWl37ZQESb4gImexGMDouhGLx1Cst0Saa4b4AqO4Hk4gxo+3DHAV/nx27p3JziPM2pVgoiia5MdEzCGULprIN7gEEeQ5IQxEBBBQnxhsDb5auGmAAYcHMA9eAAz8PBol8/xij9+C4Djlim4gJjWcwZBhCBgMIIYxGAVIkH3ZtcBuLdtRFMWsPGoY9rN+HoBji9VBYdwD2ZQg4cnO7OSq/z4rU5KKdwVbFAjNojCQzTlCLPFSxtamwh2jMUcEgg2Wm/6XgErIBhBckQtGN3CzbVacERgCnfgLswhnvqf7QyAq/z4rRZm1YglYE3affGITaZsdIe2FmMIpnOCap25I6jt2kCwCW0D1uAD9sZctNGXcQIHCkINDQgc78aCr+zjtw3BU/ijdpw3zhCwcaONwBvdeS2YZKkJNJsMPf2JKEvC28RXxxI0ASJyzQCjCEQrO4Q7sFArEzjZhaFc4cdv+/JFdKULM4px0DfUBI2hIsy06BqLhGTQEVdbfAIZXYMPesq6VoCHICzUyjwInO4Y411//LYLs6TDa9wvg2CC2rElgAnpTBziThxaL22MYhzfkghz6GAs2VHbbdM91VZu1MEEpupMMwKyVTb5ij9+u4VJG/5EgEMMmFF01cFai3isRbKbzb+YaU/MQbAm2XSMoUPAmvZzbuKYRIFApbtlrfFuUGd6vq2hXNnH78ZLh/iFhsQG3T4D1ib7k5CC6vY0DCbtrohgLEIClXiGtl10zc0CnEGIhhatLBva7NP58Tvw0qE8yWhARLQ8h4+AhQSP+I4F5xoU+VilGRJs6wnS7ruti/4KvAY/CfdgqjsMy4pf8fodQO8/gnuX3f/3xi3om1/h7THr+co3x93PP9+FBUfbNUjcjEmhcrkT+8K7ml7V10Jo05mpIEFy1NmCJWx9SIKKt+EjAL4Ez8EBVOB6havuT/rByPvHXK+9zUcfcbb254+9fydJknYnRr1oGfdaiAgpxu1Rx/Rek8KISftx3L+DfsLWAANn8Hvw0/AFeAGO9DFV3c6D+CcWbL8Dj9e7f+T1k8AZv/d7+PXWM/Z+VvdCrIvuAKO09RpEEQJM0Ci6+B4xhTWr4cZNOvhktabw0ta0rSJmqz3Yw5/AKXwenod7cAhTmBSPKf6JBdvH8IP17h95pXqw50/+BFnj88fev4NchyaK47OPhhtI8RFSvAfDSNh0Ck0p2gLxGkib5NJj/JWCr90EWQJvwBzO4AHcgztwAFN1evHPUVGwfXON+0debT1YeGON9Yy9/63X+OguiwmhIhQhD7l4sMqlG3D86Suc3qWZ4rWjI1X7u0Ytw6x3rIMeIOPDprfe2XzNgyj6PahhBjO4C3e6puDgXrdg+/5l948vF3bqwZetZ+z9Rx9zdIY5pInPK4Nk0t+l52xdK2B45Qd87nM8fsD5EfUhIcJcERw4RdqqH7Yde5V7m1vhNmtedkz6EDzUMF/2jJYWbC+4fzzA/Y+/8PPH3j9dcBAPIRP8JLXd5BpAu03aziOL3VVHZzz3CXWDPWd+SH2AnxIqQoTZpo9Ckc6HIrFbAbzNmlcg8Ag8NFDDAhbJvTBZXbC94P7t68EXfv6o+21gUtPETU7bbkLxvNKRFG2+KXzvtObonPP4rBvsgmaKj404DlshFole1Glfh02fE7bYR7dZ82oTewIBGn1Md6CG6YUF26X376oevOLzx95vhUmgblI6LBZwTCDY7vMq0op5WVXgsObOXJ+1x3qaBl9j1FeLxbhU9w1F+Wiba6s1X/TBz1LnUfuYDi4r2C69f1f14BWfP+p+W2GFKuC9phcELMYRRLur9DEZTUdEH+iEqWdaM7X4WOoPGI+ZYD2+wcQ+y+ioHUZ9dTDbArzxmi/bJI9BND0Ynd6lBdve/butBw8+f/T9D3ABa3AG8W3VPX4hBin+bj8dMMmSpp5pg7fJ6xrBFE2WQQEWnV8Qg3FbAWzYfM1rREEnmvkN2o1+acG2d/9u68GDzx91v3mAjb1zkpqT21OipPKO0b9TO5W0nTdOmAQm0TObts3aBKgwARtoPDiCT0gHgwnbArzxmtcLc08HgF1asN0C4Ms/fvD5I+7PhfqyXE/b7RbbrGyRQRT9ARZcwAUmgdoz0ehJ9Fn7QAhUjhDAQSw0bV3T3WbNa59jzmiP6GsWbGXDX2ytjy8+f9T97fiBPq9YeLdBmyuizZHaqXITnXiMUEEVcJ7K4j3BFPurtB4bixW8wTpweL8DC95szWMOqucFYGsWbGU7p3TxxxefP+r+oTVktxY0v5hbq3KiOKYnY8ddJVSBxuMMVffNbxwIOERShst73HZ78DZrHpmJmH3K6sGz0fe3UUj0eyRrSCGTTc+rjVNoGzNSv05srAxUBh8IhqChiQgVNIIBH3AVPnrsnXQZbLTm8ammv8eVXn/vWpaTem5IXRlt+U/LA21zhSb9cye6jcOfCnOwhIAYXAMVTUNV0QhVha9xjgA27ODJbLbmitt3tRN80lqG6N/khgot4ZVlOyO4WNg3OIMzhIZQpUEHieg2im6F91hB3I2tubql6BYNN9Hj5S7G0G2tahslBWKDnOiIvuAEDzakDQKDNFQT6gbn8E2y4BBubM230YIpBnDbMa+y3dx0n1S0BtuG62lCCXwcY0F72T1VRR3t2ONcsmDjbmzNt9RFs2LO2hQNyb022JisaI8rAWuw4HI3FuAIhZdOGIcdjLJvvObqlpqvWTJnnQbyi/1M9O8UxWhBs//H42I0q1Yb/XPGONzcmm+ri172mHKvZBpHkJaNJz6v9jxqiklDj3U4CA2ugpAaYMWqNXsdXbmJNd9egCnJEsphXNM+MnK3m0FCJ5S1kmJpa3DgPVbnQnPGWIDspW9ozbcO4K/9LkfaQO2KHuqlfFXSbdNzcEcwoqNEFE9zcIXu9/6n/ym/BC/C3aJLzEKPuYVlbFnfhZ8kcWxV3dbv4bKl28566wD+8C53aw49lTABp9PWbsB+knfc/Li3eVizf5vv/xmvnPKg5ihwKEwlrcHqucuVcVOxEv8aH37E3ZqpZypUulrHEtIWKUr+txHg+ojZDGlwnqmkGlzcVi1dLiNSJiHjfbRNOPwKpx9TVdTn3K05DBx4psIk4Ei8aCkJahRgffk4YnEXe07T4H2RR1u27E6wfQsBDofUgjFUFnwC2AiVtA+05J2zpiDK2Oa0c5fmAecN1iJzmpqFZxqYBCYhFTCsUNEmUnIcZ6aEA5rQVhEywG6w7HSW02XfOoBlQmjwulOFQAg66SvJblrTEX1YtJ3uG15T/BH1OfOQeuR8g/c0gdpT5fx2SKbs9EfHTKdM8A1GaJRHLVIwhcGyydZsbifAFVKl5EMKNU2Hryo+06BeTgqnxzYjThVySDikbtJPieco75lYfKAJOMEZBTjoITuWHXXZVhcUDIS2hpiXHV9Ku4u44bN5OYLDOkJo8w+xJSMbhBRHEdEs9JZUCkQrPMAvaHyLkxgkEHxiNkx/x2YB0mGsQ8EUWj/stW5YLhtS5SMu+/YBbNPDCkGTUybN8krRLBGPlZkVOA0j+a1+rkyQKWGaPHPLZOkJhioQYnVZ2hS3zVxMtgC46KuRwbJNd9nV2PHgb36F194ecf/Yeu2vAFe5nm/bRBFrnY4BauE8ERmZRFUn0k8hbftiVYSKMEme2dJCJSCGYAlNqh87bXOPdUkGy24P6d1ll21MBqqx48Fvv8ZHH8HZFY7j/uAq1xMJUFqCSUlJPmNbIiNsmwuMs/q9CMtsZsFO6SprzCS1Z7QL8xCQClEelpjTduDMsmWD8S1PT152BtvmIGvUeDA/yRn83u/x0/4qxoPHjx+PXY9pqX9bgMvh/Nz9kpP4pOe1/fYf3axUiMdHLlPpZCNjgtNFAhcHEDxTumNONhHrBduW+vOyY++70WWnPXj98eA4kOt/mj/5E05l9+O4o8ePx67HFqyC+qSSnyselqjZGaVK2TadbFLPWAQ4NBhHqDCCV7OTpo34AlSSylPtIdd2AJZlyzYQrDJ5lcWGNceD80CunPLGGzsfD+7wRb95NevJI5docQ3tgCyr5bGnyaPRlmwNsFELViOOx9loebGNq2moDOKpHLVP5al2cymWHbkfzGXL7kfRl44H9wZy33tvt+PB/Xnf93e+nh5ZlU18wCiRUa9m7kib9LYuOk+hudQNbxwm0AQqbfloimaB2lM5fChex+ylMwuTbfmXQtmWlenZljbdXTLuOxjI/fDDHY4Hjx8/Hrse0zXfPFxbUN1kKqSCCSk50m0Ajtx3ub9XHBKHXESb8iO6E+qGytF4nO0OG3SXzbJlhxBnKtKyl0NwybjvYCD30aMdjgePHz8eu56SVTBbgxJMliQ3Oauwg0QHxXE2Ez/EIReLdQj42Gzb4CLS0YJD9xUx7bsi0vJi5mUbW1QzL0h0PFk17rtiIPfJk52MB48fPx67npJJwyrBa2RCCQRTbGZSPCxTPOiND4G2pYyOQ4h4jINIJh5wFU1NFZt+IsZ59LSnDqBjZ2awbOku+yInunLcd8VA7rNnOxkPHj9+PGY9B0MWJJNozOJmlglvDMXDEozdhQWbgs/U6oBanGzLrdSNNnZFjOkmbi5bNt1lX7JLLhn3vXAg9/h4y/Hg8ePHI9dzQMEkWCgdRfYykYKnkP7D4rIujsujaKPBsB54vE2TS00ccvFY/Tth7JXeq1hz+qgVy04sAJawTsvOknHfCwdyT062HA8eP348Zj0vdoXF4pilKa2BROed+9fyw9rWRXeTFXESMOanvDZfJuJaSXouQdMdDJZtekZcLLvEeK04d8m474UDuaenW44Hjx8/Xns9YYqZpszGWB3AN/4VHw+k7WSFtJ3Qicuqb/NlVmgXWsxh570xg2UwxUw3WfO6B5nOuO8aA7lnZxuPB48fPx6znm1i4bsfcbaptF3zNT78eFPtwi1OaCNOqp1x3zUGcs/PN++AGD1+fMXrSVm2baTtPhPahbPhA71wIHd2bXzRa69nG+3CraTtPivahV/55tXWg8fyRY/9AdsY8VbSdp8V7cKrrgdfM//z6ILQFtJ2nxHtwmuoB4/kf74+gLeRtvvMaBdeSz34+vifx0YG20jbfTa0C6+tHrwe//NmOG0L8EbSdp8R7cLrrQe/996O+ai3ujQOskpTNULa7jOjXXj99eCd8lHvoFiwsbTdZ0a78PrrwTvlo966pLuRtB2fFe3Cm6oHP9kNH/W2FryxtN1nTLvwRurBO+Kj3pWXHidtx2dFu/Bm68Fb81HvykuPlrb7LGkX3mw9eGs+6h1Y8MbSdjegXcguQLjmevDpTQLMxtJ2N6NdyBZu9AbrwVvwUW+LbteULUpCdqm0HTelXbhNPe8G68Gb8lFvVfYfSNuxvrTdTWoXbozAzdaDZzfkorOj1oxVxlIMlpSIlpLrt8D4hrQL17z+c3h6hU/wv4Q/utps4+bm+6P/hIcf0JwQ5oQGPBL0eKPTYEXTW+eL/2DKn73J9BTXYANG57hz1cEMviVf/4tf5b/6C5pTQkMIWoAq7hTpOJjtAM4pxKu5vg5vXeUrtI09/Mo/5H+4z+Mp5xULh7cEm2QbRP2tFIKR7WM3fPf/jZ3SWCqLM2l4NxID5zB72HQXv3jj/8mLR5xXNA5v8EbFQEz7PpRfl1+MB/hlAN65qgDn3wTgH13hK7T59bmP+NIx1SHHU84nLOITt3iVz8mNO+lPrjGAnBFqmioNn1mTyk1ta47R6d4MrX7tjrnjYUpdUbv2rVr6YpVfsGG58AG8Ah9eyUN8CX4WfgV+G8LVWPDGb+Zd4cU584CtqSbMKxauxTg+dyn/LkVgA+IR8KHtejeFKRtTmLLpxN6mYVLjYxwXf5x2VofiZcp/lwKk4wGOpYDnoIZPdg/AAbwMfx0+ge9dgZvYjuqKe4HnGnykYo5TvJbG0Vj12JagRhwKa44H95ShkZa5RyLGGdfYvG7aw1TsF6iapPAS29mNS3NmsTQZCmgTzFwgL3upCTgtBTRwvGMAKrgLn4evwin8+afJRcff+8izUGUM63GOOuAs3tJkw7J4kyoNreqrpO6cYLQeFUd7TTpr5YOTLc9RUUogUOVJQ1GYJaFLAW0oTmKyYS46ZooP4S4EON3xQ5zC8/CX4CnM4c1PE8ApexpoYuzqlP3d4S3OJP8ZDK7cKWNaTlqmgDiiHwl1YsE41w1zT4iRTm3DBqxvOUsbMKKDa/EHxagtnta072ejc3DOIh5ojvh8l3tk1JF/AV6FU6jh3U8HwEazLgdCLYSQ+MYiAI2ltomkzttUb0gGHdSUUgsIYjTzLG3mObX4FBRaYtpDVNZrih9TgTeYOBxsEnN1gOCTM8Bsw/ieMc75w9kuAT6A+/AiHGvN/+Gn4KRkiuzpNNDYhDGFndWRpE6SVfm8U5bxnSgVV2jrg6JCKmneqey8VMFgq2+AM/i4L4RUbfSi27lNXZ7R7W9RTcq/q9fk4Xw3AMQd4I5ifAZz8FcVtm9SAom/dyN4lczJQW/kC42ZrHgcCoIf1oVMKkVItmMBi9cOeNHGLqOZk+QqQmrbc5YmYgxELUUN35z2iohstgfLIFmcMV7s4CFmI74L9+EFmGsi+tGnAOD4Yk9gIpo01Y4cA43BWGygMdr4YZekG3OBIUXXNukvJS8tqa06e+lSDCtnqqMFu6hWHXCF+WaYt64m9QBmNxi7Ioy7D+fa1yHw+FMAcPt7SysFLtoG4PXAk7JOA3aAxBRqUiAdU9Yp5lK3HLSRFtOim0sa8euEt08xvKjYjzeJ2GU7YawexrnKI9tmobInjFXCewpwriY9+RR4aaezFhMhGCppKwom0ChrgFlKzyPKkGlTW1YQrE9HJqu8hKGgMc6hVi5QRq0PZxNfrYNgE64utmRv6KKHRpxf6VDUaOvNP5jCEx5q185My/7RKz69UQu2im5k4/eownpxZxNLwiZ1AZTO2ZjWjkU9uaB2HFn6Q3u0JcsSx/qV9hTEApRzeBLDJQXxYmTnq7bdLa3+uqFrxLJ5w1TehnNHx5ECvCh2g2c3hHH5YsfdaSKddztfjQ6imKFGSyFwlLzxEGPp6r5IevVjk1AMx3wMqi1NxDVjLBiPs9tbsCkIY5we5/ML22zrCScFxnNtzsr9Wcc3CnD+pYO+4VXXiDE0oc/vQQ/fDK3oPESJMYXNmJa/DuloJZkcTpcYE8lIH8Dz8DJMiynNC86Mb2lNaaqP/+L7f2fcE/yP7/Lde8xfgSOdMxvOixZf/9p3+M4hT1+F+zApxg9XfUvYjc8qX2lfOOpK2gNRtB4flpFu9FTKCp2XJRgXnX6olp1zyYjTKJSkGmLE2NjUr1bxFM4AeAAHBUFIeSLqXR+NvH/M9fOnfHzOD2vCSyQJKzfgsCh+yi/Mmc35F2fUrw7miW33W9hBD1vpuUojFphIyvg7aTeoymDkIkeW3XLHmguMzbIAJejN6B5MDrhipE2y6SoFRO/AK/AcHHZHNIfiWrEe/C6cr3f/yOvrQKB+zMM55/GQdLDsR+ifr5Fiuu+/y+M78LzOE5dsNuXC3PYvYWd8NXvphLSkJIasrlD2/HOqQ+RjcRdjKTGWYhhVUm4yxlyiGPuMsZR7sMCHUBeTuNWA7if+ifXgc/hovftHXs/DV+Fvwe+f8shzMiMcweFgBly3//vwJfg5AN4450fn1Hd1Rm1aBLu22Dy3y3H2+OqMemkbGZ4jozcDjJf6596xOLpC0eMTHbKnxLxH27uZ/bMTGs2jOaMOY4m87CfQwF0dw53oa1k80JRuz/XgS+8fX3N9Af4qPIMfzKgCp4H5TDGe9GGeFPzSsZz80SlPTxXjgwJmC45njzgt2vbQ4b4OAdUK4/vWhO8d8v6EE8fMUsfakXbPpFJeLs2ubM/qdm/la3WP91uWhxXHjoWhyRUq2iJ/+5mA73zwIIo+LoZ/SgvIRjAd1IMvvn98PfgOvAJfhhm8scAKVWDuaRaK8aQ9f7vuPDH6Bj47ZXau7rqYJ66mTDwEDU6lLbCjCK0qTXyl5mnDoeNRxanj3FJbaksTk0faXxHxLrssgPkWB9LnA/MFleXcJozzjwsUvUG0X/QCve51qkMDXp9mtcyOy3rwBfdvVJK7D6/ACSzg3RoruIq5UDeESfEmVclDxnniU82vxMLtceD0hGZWzBNPMM/jSPne2OVatiTKUpY5vY7gc0LdUAWeWM5tH+O2I66AOWw9xT2BuyRVLGdoDHUsVRXOo/c+ZdRXvFfnxWyIV4upFLCl9eAL7h8Zv0QH8Ry8pA2cHzQpGesctVA37ZtklBTgHjyvdSeKY/RZw/kJMk0Y25cSNRWSigQtlULPTw+kzuJPeYEkXjQRpoGZobYsLF79pyd1dMRHInbgFTZqNLhDqiIsTNpoex2WLcy0/X6rHcdMMQvFSd5dWA++4P7xv89deACnmr36uGlL69bRCL6BSZsS6c0TU2TKK5gtWCzgAOOwQcurqk9j8whvziZSMLcq5hbuwBEsYjopUBkqw1yYBGpLA97SRElEmx5MCInBY5vgLk94iKqSWmhIGmkJ4Bi9m4L645J68LyY4wsFYBfUg5feP/6gWWm58IEmKQM89hq7KsZNaKtP5TxxrUZZVkNmMJtjbKrGxLNEbHPJxhqy7lAmbC32ZqeF6lTaknRWcYaFpfLUBh/rwaQycCCJmW15Kstv6jRHyJFry2C1ahkkIW0LO75s61+owxK1y3XqweX9m5YLM2DPFeOjn/iiqCKJ+yKXF8t5Yl/kNsqaSCryxPq5xWTFIaP8KSW0RYxqupaUf0RcTNSSdJZGcKYdYA6kdtrtmyBckfKXwqk0pHpUHlwWaffjNRBYFPUDWa8e3Lt/o0R0CdisKDM89cX0pvRHEfM8ca4t0s2Xx4kgo91MPQJ/0c9MQYq0co8MBh7bz1fio0UUHLR4aAIOvOmoYO6kwlEVODSSTliWtOtH6sPkrtctF9ZtJ9GIerBskvhdVS5cFNv9s1BU0AbdUgdK4FG+dRnjFmDTzniRMdZO1QhzMK355vigbdkpz9P6qjUGE5J2qAcXmwJ20cZUiAD0z+pGMx6xkzJkmEf40Hr4qZfVg2XzF9YOyoV5BjzVkUJngKf8lgNYwKECEHrCNDrWZzMlflS3yBhr/InyoUgBc/lKT4pxVrrC6g1YwcceK3BmNxZcAtz3j5EIpqguh9H6wc011YN75cKDLpFDxuwkrPQmUwW4KTbj9mZTwBwLq4aQMUZbHm1rylJ46dzR0dua2n3RYCWZsiHROeywyJGR7mXKlpryyCiouY56sFkBWEnkEB/raeh/Sw4162KeuAxMQpEkzy5alMY5wamMsWKKrtW2WpEWNnReZWONKWjrdsKZarpFjqCslq773PLmEhM448Pc3+FKr1+94vv/rfw4tEcu+lKTBe4kZSdijBrykwv9vbCMPcLQTygBjzVckSLPRVGslqdunwJ4oegtFOYb4SwxNgWLCmD7T9kVjTv5YDgpo0XBmN34Z/rEHp0sgyz7lngsrm4lvMm2Mr1zNOJYJ5cuxuQxwMGJq/TP5emlb8fsQBZviK4t8hFL+zbhtlpwaRSxQRWfeETjuauPsdGxsBVdO7nmP4xvzSoT29pRl7kGqz+k26B3Oy0YNV+SXbbQas1ctC/GarskRdFpKczVAF1ZXnLcpaMuzVe6lZ2g/1ndcvOVgRG3sdUAY1bKD6achijMPdMxV4muKVorSpiDHituH7rSTs7n/4y5DhRXo4FVBN4vO/zbAcxhENzGbHCzU/98Mcx5e7a31kWjw9FCe/zNeYyQjZsWb1uc7U33pN4Mji6hCLhivqfa9Ss6xLg031AgfesA/l99m9fgvnaF9JoE6bYKmkGNK3aPbHB96w3+DnxFm4hs0drLsk7U8kf/N/CvwQNtllna0rjq61sH8L80HAuvwH1tvBy2ChqWSCaYTaGN19sTvlfzFD6n+iKTbvtayfrfe9ueWh6GJFoxLdr7V72a5ZpvHcCPDzma0wTO4EgbLyedxstO81n57LYBOBzyfsOhUKsW1J1BB5vr/tz8RyqOFylQP9Tvst2JALsC5lsH8PyQ40DV4ANzYa4dedNiKNR1s+x2wwbR7q4/4cTxqEk4LWDebfisuo36JXLiWFjOtLrlNWh3K1rRS4xvHcDNlFnNmWBBAl5SWaL3oPOfnvbr5pdjVnEaeBJSYjuLEkyLLsWhKccadmOphZkOPgVdalj2QpSmfOsADhMWE2ZBu4+EEJI4wKTAuCoC4xwQbWXBltpxbjkXJtKxxabo9e7tyhlgb6gNlSbUpMh+l/FaqzVwewGu8BW1Zx7pTpQDJUjb8tsUTW6+GDXbMn3mLbXlXJiGdggxFAoUrtPS3wE4Nk02UZG2OOzlk7fRs7i95QCLo3E0jtrjnM7SR3uS1p4qtS2nJ5OwtQVHgOvArLBFijZUV9QtSl8dAY5d0E0hM0w3HS2DpIeB6m/A1+HfhJcGUq4sOxH+x3f5+VO+Ds9rYNI7zPXOYWPrtf8bYMx6fuOAX5jzNR0PdsuON+X1f7EERxMJJoU6GkTEWBvVolVlb5lh3tKCg6Wx1IbaMDdJ+9sUCc5KC46hKGCk3IVOS4TCqdBNfUs7Kd4iXf2RjnT/LLysJy3XDcHLh/vde3x8DoGvwgsa67vBk91G5Pe/HbOe7xwym0NXbtiuuDkGO2IJDh9oQvJ4cY4vdoqLDuoH9Zl2F/ofsekn8lkuhIlhQcffUtSjytFyp++p6NiE7Rqx/lodgKVoceEp/CP4FfjrquZaTtj2AvH5K/ywpn7M34K/SsoYDAdIN448I1/0/wveW289T1/lX5xBzc8N5IaHr0XMOQdHsIkDuJFifj20pBm5jzwUv9e2FhwRsvhAbalCIuIw3bhJihY3p6nTFFIZgiSYjfTf3aXuOjmeGn4bPoGvwl+CFzTRczBIuHBEeImHc37/lGfwZR0cXzVDOvaKfNHvwe+suZ771K/y/XcBlsoN996JpBhoE2toYxOznNEOS5TJc6Id5GEXLjrWo+LEWGNpPDU4WAwsIRROu+1vM+0oW37z/MBN9kqHnSArwPfgFJ7Cq/Ai3Ie7g7ncmI09v8sjzw9mzOAEXoIHxURueaAce5V80f/DOuuZwHM8vsMb5wBzOFWM7wymTXPAEvm4vcFpZ2ut0VZRjkiP2MlmLd6DIpbGSiHOjdnUHN90hRYmhTnmvhzp1iKDNj+b7t5hi79lWGwQ+HN9RsfFMy0FXbEwhfuczKgCbyxYwBmcFhhvo/7a44v+i3XWcwDP86PzpGQYdWh7csP5dBvZ1jNzdxC8pBGuxqSW5vw40nBpj5JhMwvOzN0RWqERHMr4Lv1kWX84xLR830G3j6yqZ1a8UstTlW+qJPOZ+sZ7xZPKTJLhiNOAFd6tk+jrTH31ncLOxid8+nzRb128HhUcru/y0Wn6iT254YPC6FtVSIMoW2sk727AhvTtrWKZTvgsmckfXYZWeNRXx/3YQ2OUxLDrbHtN11IwrgXT6c8dATDwLniYwxzO4RzuQqTKSC5gAofMZ1QBK3zQ4JWobFbcvJm87FK+6JXrKahLn54m3p+McXzzYtP8VF/QpJuh1OwieElEoI1pRxPS09FBrkq2tWCU59+HdhNtTIqKm8EBrw2RTOEDpG3IKo2Y7mFdLm3ZeVjYwVw11o/oznceMve4CgMfNym/utA/d/ILMR7gpXzRy9eDsgLcgbs8O2Va1L0zzIdwGGemTBuwROHeoMShkUc7P+ISY3KH5ZZeWqO8mFTxQYeXTNuzvvK5FGPdQfuu00DwYFY9dyhctEt+OJDdnucfpmyhzUJzfsJjr29l8S0bXBfwRS9ZT26tmMIdZucch5ZboMz3Nio3nIOsYHCGoDT4kUA9MiXEp9Xsui1S8th/kbWIrMBxDGLodWUQIWcvnXy+9M23xPiSMOiRPqM+YMXkUN3gXFrZJwXGzUaMpJfyRS9ZT0lPe8TpScuRlbMHeUmlaKDoNuy62iWNTWNFYjoxFzuJs8oR+RhRx7O4SVNSXpa0ZJQ0K1LAHDQ+D9IepkMXpcsq5EVCvClBUIzDhDoyKwDw1Lc59GbTeORivugw1IcuaEOaGWdNm+Ps5fQ7/tm0DjMegq3yM3vb5j12qUId5UZD2oxDSEWOZMSqFl/W+5oynWDa/aI04tJRQ2eTXusg86SQVu/nwSYwpW6wLjlqIzwLuxGIvoAvul0PS+ZNz0/akp/pniO/8JDnGyaCkzbhl6YcqmK/69prxPqtpx2+Km9al9sjL+rwMgHw4jE/C8/HQ3m1vBuL1fldbzd8mOueVJ92syqdEY4KJjSCde3mcRw2TA6szxedn+zwhZMps0XrqEsiUjnC1hw0TELC2Ek7uAAdzcheXv1BYLagspxpzSAoZZUsIzIq35MnFQ9DOrlNB30jq3L4pkhccKUAA8/ocvN1Rzx9QyOtERs4CVsJRK/DF71kPYrxYsGsm6RMh4cps5g1DOmM54Ly1ii0Hd3Y/BMk8VWFgBVmhqrkJCPBHAolwZaWzLR9Vb7bcWdX9NyUYE+uB2BKfuaeBUcjDljbYVY4DdtsVWvzRZdWnyUzDpjNl1Du3aloAjVJTNDpcIOVVhrHFF66lLfJL1zJr9PQ2nFJSBaKoDe+sAvLufZVHVzYh7W0h/c6AAZ+7Tvj6q9j68G/cTCS/3n1vLKHZwNi+P+pS0WkZNMBMUl+LDLuiE4omZy71r3UFMwNJV+VJ/GC5ixVUkBStsT4gGKh0Gm4Oy3qvq7Lbmq24nPdDuDR9deR11XzP4vFu3TYzfnIyiSVmgizUYGqkIXNdKTY9pgb9D2Ix5t0+NHkVzCdU03suWkkVZAoCONCn0T35gAeW38de43mf97sMOpSvj4aa1KYUm58USI7Wxxes03bAZdRzk6UtbzMaCQ6IxO0dy7X+XsjoD16hpsBeGz9dfzHj+R/Hp8nCxZRqkEDTaCKCSywjiaoMJ1TITE9eg7Jqnq8HL6gDwiZb0u0V0Rr/rmvqjxKuaLCX7ZWXTvAY+uvm3z8CP7nzVpngqrJpZKwWnCUjIviYVlirlGOzPLI3SMVyp/elvBUjjDkNhrtufFFErQ8pmdSlbK16toBHlt/HV8uHMX/vEGALkV3RJREiSlopxwdMXOZPLZ+ix+kAHpMKIk8UtE1ygtquttwxNhphrIZ1IBzjGF3IIGxGcBj6q8bHJBG8T9vdsoWrTFEuebEZuVxhhClH6P5Zo89OG9fwHNjtNQTpD0TG9PJLEYqvEY6Rlxy+ZZGfL0Aj62/bnQCXp//eeM4KzfQVJbgMQbUjlMFIm6TpcfWlZje7NBSV6IsEVmumWIbjiloUzQX9OzYdo8L1wjw2PrrpimONfmfNyzKklrgnEkSzT5QWYQW40YShyzqsRmMXbvVxKtGuYyMKaU1ugenLDm5Ily4iT14fP11Mx+xJv+zZ3MvnfdFqxU3a1W/FTB4m3Qfsyc1XUcdVhDeUDZXSFHHLQj/Y5jtC7ZqM0CXGwB4bP11i3LhOvzPGygYtiUBiwQV/4wFO0majijGsafHyRLu0yG6q35cL1rOpVxr2s5cM2jJYMCdc10Aj6q/blRpWJ//+dmm5psMl0KA2+AFRx9jMe2WbC4jQxnikd4DU8TwUjRVacgdlhmr3bpddzuJ9zXqr2xnxJfzP29RexdtjDVZqzkqa6PyvcojGrfkXiJ8SEtml/nYskicv0ivlxbqjemwUjMw5evdg8fUX9nOiC/lf94Q2i7MURk9nW1MSj5j8eAyV6y5CN2S6qbnw3vdA1Iwq+XOSCl663udN3IzLnrt+us25cI1+Z83SXQUldqQq0b5XOT17bGpLd6ssN1VMPf8c+jG8L3NeCnMdF+Ra3fRa9dft39/LuZ/3vwHoHrqGmQFafmiQw6eyzMxS05K4bL9uA+SKUQzCnSDkqOGokXyJvbgJ/BHI+qvY69//4rl20NsmK2ou2dTsyIALv/91/8n3P2Aao71WFGi8KKv1fRC5+J67Q/507/E/SOshqN5TsmYIjVt+kcjAx98iz/4SaojbIV1rexE7/C29HcYD/DX4a0rBOF5VTu7omsb11L/AWcVlcVZHSsqGuXLLp9ha8I//w3Mv+T4Ew7nTBsmgapoCrNFObIcN4pf/Ob/mrvHTGqqgAupL8qWjWPS9m/31jAe4DjA+4+uCoQoT/zOzlrNd3qd4SdphFxsUvYwGWbTWtISc3wNOWH+kHBMfc6kpmpwPgHWwqaSUG2ZWWheYOGQGaHB+eQ/kn6b3pOgLV+ODSn94wDvr8Bvb70/LLuiPPEr8OGVWfDmr45PZyccEmsVXZGe1pRNX9SU5+AVQkNTIVPCHF/jGmyDC9j4R9LfWcQvfiETmgMMUCMN1uNCakkweZsowdYobiMSlnKA93u7NzTXlSfe+SVbfnPQXmg9LpYAQxpwEtONyEyaueWM4FPjjyjG3uOaFmBTWDNgBXGEiQpsaWhnAqIijB07Dlsy3fUGeP989xbWkyf+FF2SNEtT1E0f4DYYVlxFlbaSMPIRMk/3iMU5pME2SIWJvjckciebkQuIRRyhUvkHg/iUljG5kzVog5hV7vIlCuBrmlhvgPfNHQM8lCf+FEGsYbMIBC0qC9a0uuy2wLXVbLBaP5kjHokCRxapkQyzI4QEcwgYHRZBp+XEFTqXFuNVzMtjXLJgX4gAid24Hjwc4N3dtVSe+NNiwTrzH4WVUOlDobUqr1FuAgYllc8pmzoVrELRHSIW8ViPxNy4xwjBpyR55I6J220qQTZYR4guvUICJiSpr9gFFle4RcF/OMB7BRiX8sSfhpNSO3lvEZCQfLUVTKT78Ek1LRLhWN+yLyTnp8qWUZ46b6vxdRGXfHVqx3eI75YaLa4iNNiK4NOW7wPW6lhbSOF9/M9qw8e/aoB3d156qTzxp8pXx5BKAsYSTOIIiPkp68GmTq7sZtvyzBQaRLNxIZ+paozHWoLFeExIhRBrWitHCAHrCF7/thhD8JhYz84wg93QRV88wLuLY8zF8sQ36qF1J455bOlgnELfshKVxYOXKVuKx0jaj22sczTQqPqtV/XDgpswmGTWWMSDw3ssyUunLLrVPGjYRsH5ggHeHSWiV8kT33ycFSfMgkoOK8apCye0J6VW6GOYvffgU9RWsukEi2kUV2nl4dOYUzRik9p7bcA4ggdJ53LxKcEe17B1R8eqAd7dOepV8sTXf5lhejoL85hUdhDdknPtKHFhljOT+bdq0hxbm35p2nc8+Ja1Iw+tJykgp0EWuAAZYwMVwac5KzYMslhvgHdHRrxKnvhTYcfKsxTxtTETkjHO7rr3zjoV25lAQHrqpV7bTiy2aXMmUhTBnKS91jhtR3GEoF0oLnWhWNnYgtcc4N0FxlcgT7yz3TgNIKkscx9jtV1ZKpWW+Ub1tc1eOv5ucdgpx+FJy9pgbLE7xDyXb/f+hLHVGeitHOi6A7ybo3sF8sS7w7cgdk0nJaOn3hLj3uyD0Zp5pazFIUXUpuTTU18d1EPkDoX8SkmWTnVIozEdbTcZjoqxhNHf1JrSS/AcvHjZ/SMHhL/7i5z+POsTUh/8BvNfYMTA8n+yU/MlTZxSJDRStqvEuLQKWwDctMTQogUDyQRoTQG5Kc6oQRE1yV1jCA7ri7jdZyK0sYTRjCR0Hnnd+y7nHxNgTULqw+8wj0mQKxpYvhjm9uSUxg+TTy7s2GtLUGcywhXSKZN275GsqlclX90J6bRI1aouxmgL7Q0Nen5ziM80SqMIo8cSOo+8XplT/5DHNWsSUr/6lLN/QQ3rDyzLruEW5enpf7KqZoShEduuSFOV7DLX7Ye+GmXb6/hnNNqKsVXuMDFpb9Y9eH3C6NGEzuOuI3gpMH/I6e+zDiH1fXi15t3vA1czsLws0TGEtmPEJdiiFPwlwKbgLHAFk4P6ZyPdymYYHGE0dutsChQBl2JcBFlrEkY/N5bQeXQ18gjunuMfMfsBlxJSx3niO485fwO4fGD5T/+3fPQqkneWVdwnw/3bMPkW9Wbqg+iC765Zk+xcT98ibKZc2EdgHcLoF8cSOo/Oc8fS+OyEULF4g4sJqXVcmfMfsc7A8v1/yfGXmL9I6Fn5pRwZhsPv0TxFNlAfZCvG+Oohi82UC5f/2IsJo0cTOm9YrDoKhFPEUr/LBYTUNht9zelHXDqwfPCIw4owp3mOcIQcLttWXFe3VZ/j5H3cIc0G6oPbCR+6Y2xF2EC5cGUm6wKC5tGEzhsWqw5hNidUiKX5gFWE1GXh4/Qplw4sVzOmx9QxU78g3EF6wnZlEN4FzJ1QPSLEZz1KfXC7vd8ssGdIbNUYpVx4UapyFUHzJoTOo1McSkeNn1M5MDQfs4qQuhhX5vQZFw8suwWTcyYTgioISk2YdmkhehG4PkE7w51inyAGGaU+uCXADabGzJR1fn3lwkty0asIo8cROm9Vy1g0yDxxtPvHDAmpu+PKnM8Ix1wwsGw91YJqhteaWgjYBmmQiebmSpwKKzE19hx7jkzSWOm66oPbzZ8Yj6kxVSpYjVAuvLzYMCRo3oTQecOOjjgi3NQ4l9K5/hOGhNTdcWVOTrlgYNkEXINbpCkBRyqhp+LdRB3g0OU6rMfW2HPCFFMV9nSp+uB2woepdbLBuJQyaw/ZFysXrlXwHxI0b0LovEkiOpXGA1Ijagf+KUNC6rKNa9bQnLFqYNkEnMc1uJrg2u64ELPBHpkgWbmwKpJoDhMwNbbGzAp7Yg31wS2T5rGtzit59PrKhesWG550CZpHEzpv2NGRaxlNjbMqpmEIzygJqQfjypycs2pg2cS2RY9r8HUqkqdEgKTWtWTKoRvOBPDYBltja2SO0RGjy9UHtxwRjA11ujbKF+ti5cIR9eCnxUg6owidtyoU5tK4NLji5Q3HCtiyF2IqLGYsHViOXTXOYxucDqG0HyttqYAKqYo3KTY1ekyDXRAm2AWh9JmsVh/ccg9WJ2E8YjG201sPq5ULxxX8n3XLXuMInbft2mk80rRGjCGctJ8/GFdmEQ9Ug4FlE1ll1Y7jtiraqm5Fe04VV8lvSVBL8hiPrfFVd8+7QH3Qbu2ipTVi8cvSGivc9cj8yvH11YMHdNSERtuOslM97feYFOPKzGcsI4zW0YGAbTAOaxCnxdfiYUmVWslxiIblCeAYr9VYR1gM7GmoPrilunSxxeT3DN/2eBQ9H11+nk1adn6VK71+5+Jfct4/el10/7KBZfNryUunWSCPxPECk1rdOv1WVSrQmpC+Tl46YD3ikQYcpunSQgzVB2VHFhxHVGKDgMEY5GLlQnP7FMDzw7IacAWnO6sBr12u+XanW2AO0wQ8pknnFhsL7KYIqhkEPmEXFkwaN5KQphbkUmG72wgw7WSm9RiL9QT925hkjiVIIhphFS9HKI6/8QAjlpXqg9W2C0apyaVDwKQwrwLY3j6ADR13ZyUNByQXHQu6RY09Hu6zMqXRaNZGS/KEJs0cJEe9VH1QdvBSJv9h09eiRmy0V2uJcqHcShcdvbSNg5fxkenkVprXM9rDVnX24/y9MVtncvbKY706anNl3ASll9a43UiacVquXGhvq4s2FP62NGKfQLIQYu9q1WmdMfmUrDGt8eDS0cXozH/fjmUH6Jruvm50hBDSaEU/2Ru2LEN/dl006TSc/g7tfJERxGMsgDUEr104pfWH9lQaN+M4KWQjwZbVc2rZVNHsyHal23wZtIs2JJqtIc/WLXXRFCpJkfE9jvWlfFbsNQ9pP5ZBS0zKh4R0aMFj1IjTcTnvi0Zz2rt7NdvQb2mgbju1plsH8MmbnEk7KbK0b+wC2iy3aX3szW8xeZvDwET6hWZYwqTXSSG+wMETKum0Dq/q+x62gt2ua2ppAo309TRk9TPazfV3qL9H8z7uhGqGqxNVg/FKx0HBl9OVUORn8Q8Jx9gFttGQUDr3tzcXX9xGgN0EpzN9mdZ3GATtPhL+CjxFDmkeEU6x56kqZRusLzALXVqkCN7zMEcqwjmywDQ6OhyUe0Xao1Qpyncrg6wKp9XfWDsaZplElvQ/b3sdweeghorwBDlHzgk1JmMc/wiERICVy2VJFdMjFuLQSp3S0W3+sngt2njwNgLssFGVQdJ0tu0KH4ky1LW4yrbkuaA6Iy9oz/qEMMXMMDWyIHhsAyFZc2peV9hc7kiKvfULxCl9iddfRK1f8kk9qvbdOoBtOg7ZkOZ5MsGrSHsokgLXUp9y88smniwWyuFSIRVmjplga3yD8Uij5QS1ZiM4U3Qw5QlSm2bXjFe6jzzBFtpg+/YBbLAWG7OPynNjlCw65fukGNdkJRf7yM1fOxVzbxOJVocFoYIaGwH22mIQkrvu1E2nGuebxIgW9U9TSiukPGU+Lt++c3DJPKhyhEEbXCQLUpae2exiKy6tMPe9mDRBFCEMTWrtwxN8qvuGnt6MoihKWS5NSyBhbH8StXoAz8PLOrRgLtOT/+4vcu+7vDLnqNvztOq7fmd8sMmY9Xzn1zj8Dq8+XVdu2Nv0IIySgEdQo3xVHps3Q5i3fLFsV4aiqzAiBhbgMDEd1uh8qZZ+lwhjkgokkOIv4xNJmyncdfUUzgB4oFMBtiu71Xumpz/P+cfUP+SlwFExwWW62r7b+LSPxqxn/gvMZ5z9C16t15UbNlq+jbGJtco7p8wbYlL4alSyfWdeuu0j7JA3JFNuVAwtst7F7FhWBbPFNKIUORndWtLraFLmMu7KFVDDOzqkeaiN33YAW/r76wR4XDN/yN1z7hejPau06EddkS/6XThfcz1fI/4K736fO48vlxt2PXJYFaeUkFS8U15XE3428xdtn2kc8GQlf1vkIaNRRnOMvLTWrZbElEHeLWi1o0dlKPAh1MVgbbVquPJ5+Cr8LU5/H/+I2QlHIU2ClXM9G8v7Rr7oc/hozfUUgsPnb3D+I+7WF8kNO92GY0SNvuxiE+2Bt8prVJTkzE64sfOstxuwfxUUoyk8VjcTlsqe2qITSFoSj6Epd4KsT6BZOWmtgE3hBfir8IzZDwgV4ZTZvD8VvPHERo8v+vL1DASHTz/i9OlKueHDjK5Rnx/JB1Vb1ioXdBra16dmt7dgik10yA/FwJSVY6XjA3oy4SqM2frqDPPSRMex9qs3XQtoWxMj7/Er8GWYsXgjaVz4OYumP2+9kbxvny/6kvWsEBw+fcb5bInc8APdhpOSs01tEqIkoiZjbAqKMruLbJYddHuHFRIyJcbdEdbl2sVLaySygunutBg96Y2/JjKRCdyHV+AEFtTvIpbKIXOamknYSiB6KV/0JetZITgcjjk5ZdaskBtWO86UF0ap6ozGXJk2WNiRUlCPFir66lzdm/SLSuK7EUdPz8f1z29Skq6F1fXg8+5UVR6bszncP4Tn4KUkkdJ8UFCY1zR1i8RmL/qQL3rlei4THG7OODlnKko4oI01kd3CaM08Ia18kC3GNoVaO9iDh+hWxSyTXFABXoau7Q6q9OxYg/OVEMw6jdbtSrJ9cBcewGmaZmg+bvkUnUUaGr+ZfnMH45Ivevl61hMcXsxYLFTu1hTm2zViCp7u0o5l+2PSUh9bDj6FgYypufBDhqK2+oXkiuHFHR3zfj+9PtA8oR0xnqX8qn+sx3bFODSbbF0X8EUvWQ8jBIcjo5bRmLOljDNtcqNtOe756h3l0VhKa9hDd2l1eqmsnh0MNMT/Cqnx6BInumhLT8luljzQ53RiJeA/0dxe5NK0o2fA1+GLXr6eNQWHNUOJssQaTRlGpLHKL9fD+IrQzTOMZS9fNQD4AnRNVxvTdjC+fJdcDDWQcyB00B0t9BDwTxXgaAfzDZ/DBXzRnfWMFRwuNqocOmX6OKNkY63h5n/fFcB28McVHqnXZVI27K0i4rDLNE9lDKV/rT+udVbD8dFFu2GGZ8mOt0kAXcoX3ZkIWVtw+MNf5NjR2FbivROHmhV1/pj2egv/fMGIOWTIWrV3Av8N9imV9IWml36H6cUjqEWNv9aNc+veb2sH46PRaHSuMBxvtW+twxctq0z+QsHhux8Q7rCY4Ct8lqsx7c6Sy0dl5T89rIeEuZKoVctIk1hNpfavER6yyH1Vvm3MbsUHy4ab4hWr/OZPcsRBphnaV65/ZcdYPNNwsjN/djlf9NqCw9U5ExCPcdhKxUgLSmfROpLp4WSUr8ojdwbncbvCf+a/YzRaEc6QOvXcGO256TXc5Lab9POvB+AWY7PigWYjzhifbovuunzRawsO24ZqQQAqguBtmpmPB7ysXJfyDDaV/aPGillgz1MdQg4u5MYaEtBNNHFjkRlSpd65lp4hd2AVPTfbV7FGpyIOfmNc/XVsPfg7vzaS/3nkvLL593ANLvMuRMGpQIhiF7kUEW9QDpAUbTWYBcbp4WpacHHY1aacqQyjGZS9HI3yCBT9kUZJhVOD+zUDvEH9ddR11fzPcTDQ5TlgB0KwqdXSavk9BC0pKp0WmcuowSw07VXmXC5guzSa4p0UvRw2lbDiYUx0ExJJRzWzi6Gm8cnEkfXXsdcG/M/jAJa0+bmCgdmQ9CYlNlSYZOKixmRsgiFxkrmW4l3KdFKv1DM8tk6WxPYJZhUUzcd8Kdtgrw/gkfXXDT7+avmfVak32qhtkg6NVdUS5wgkru1YzIkSduTW1FDwVWV3JQVJVuieTc0y4iDpFwc7/BvSalvKdQM8sv662cevz/+8sQVnjVAT0W2wLllw1JiMhJRxgDjCjLQsOzSFSgZqx7lAW1JW0e03yAD3asC+GD3NbQhbe+mN5GXH1F83KDOM4n/e5JIuH4NpdQARrFPBVptUNcjj4cVMcFSRTE2NpR1LEYbYMmfWpXgP9KejaPsLUhuvLCsVXznAG9dfx9SR1ud/3hZdCLHb1GMdPqRJgqDmm76mHbvOXDtiO2QPUcKo/TWkQ0i2JFXpBoo7vij1i1Lp3ADAo+qvG3V0rM//vFnnTE4hxd5Ka/Cor5YEdsLVJyKtDgVoHgtW11pWSjolPNMnrlrVj9Fv2Qn60twMwKPqr+N/wvr8z5tZcDsDrv06tkqyzESM85Ycv6XBWA2birlNCXrI6VbD2lx2L0vQO0QVTVVLH4SE67fgsfVXv8n7sz7/85Z7cMtbE6f088wSaR4kCkCm10s6pKbJhfqiUNGLq+0gLWC6eUAZFPnLjwqtKd8EwGvWX59t7iPW4X/eAN1svgRVSY990YZg06BD1ohLMtyFTI4pKTJsS9xREq9EOaPWiO2gpms7397x6nQJkbh+Fz2q/rqRROX6/M8bJrqlVW4l6JEptKeUFuMYUbtCQ7CIttpGc6MY93x1r1vgAnRXvY5cvwWPqb9uWQm+lP95QxdNMeWhOq1x0Db55C7GcUv2ZUuN6n8iKzsvOxibC//Yfs9Na8r2Rlz02vXXDT57FP/zJi66/EJSmsJKa8QxnoqW3VLQ+jZVUtJwJ8PNX1NQCwfNgdhhHD9on7PdRdrdGPF28rJr1F+3LBdeyv+8yYfLoMYet1vX4upNAjVvwOUWnlNXJXlkzk5Il6kqeoiL0C07qno+/CYBXq/+utlnsz7/Mzvy0tmI4zm4ag23PRN3t/CWryoUVJGm+5+K8RJ0V8Hc88/XHUX/HfiAq7t+BH+x6v8t438enWmdJwFA6ZINriLGKv/95f8lT9/FnyA1NMVEvQyaXuu+gz36f/DD73E4pwqpLcvm/o0Vle78n//+L/NPvoefp1pTJye6e4A/D082FERa5/opeH9zpvh13cNm19/4v/LDe5xMWTi8I0Ta0qKlK27AS/v3/r+/x/2GO9K2c7kVMonDpq7//jc5PKCxeNPpFVzaRr01wF8C4Pu76hXuX18H4LduTr79guuFD3n5BHfI+ZRFhY8w29TYhbbLi/bvBdqKE4fUgg1pBKnV3FEaCWOWyA+m3WpORZr/j+9TKJtW8yBTF2/ZEODI9/QavHkVdGFp/Pjn4Q+u5hXapsP5sOH+OXXA1LiKuqJxiMNbhTkbdJTCy4llEt6NnqRT4dhg1V3nbdrm6dYMecA1yTOL4PWTE9L5VzPFlLBCvlG58AhehnN4uHsAYinyJ+AZ/NkVvELbfOBUuOO5syBIEtiqHU1k9XeISX5bsimrkUUhnGDxourN8SgUsCZVtKyGbyGzHXdjOhsAvOAswSRyIBddRdEZWP6GZhNK/yjwew9ehBo+3jEADu7Ay2n8mDc+TS7awUHg0OMzR0LABhqLD4hJEh/BEGyBdGlSJoXYXtr+3HS4ijzVpgi0paWXtdruGTknXBz+11qT1Q2inxaTzQCO46P3lfLpyS4fou2PH/PupwZgCxNhGlj4IvUuWEsTkqMWm6i4xCSMc9N1RDQoCVcuGItJ/MRWefais+3synowi/dESgJjkilnWnBTGvRWmaw8oR15257t7CHmCf8HOn7cwI8+NQBXMBEmAa8PMRemrNCEhLGEhDQKcGZWS319BX9PFBEwGTbRBhLbDcaV3drFcDqk5kCTd2JF1Wp0HraqBx8U0wwBTnbpCadwBA/gTH/CDrcCs93LV8E0YlmmcyQRQnjBa8JESmGUfIjK/7fkaDJpmD2QptFNVJU1bbtIAjjWQizepOKptRjbzR9Kag6xZmMLLjHOtcLT3Tx9o/0EcTT1XN3E45u24AiwEypDJXihKjQxjLprEwcmRKclaDNZCVqr/V8mYWyFADbusiY5hvgFoU2vio49RgJLn5OsReRFN6tabeetiiy0V7KFHT3HyZLx491u95sn4K1QQSPKM9hNT0wMVvAWbzDSVdrKw4zRjZMyJIHkfq1VAVCDl/bUhNKlGq0zGr05+YAceXVPCttVk0oqjVwMPt+BBefx4yPtGVkUsqY3CHDPiCM5ngupUwCdbkpd8kbPrCWHhkmtIKLEetF2499eS1jZlIPGYnlcPXeM2KD9vLS0bW3ktYNqUllpKLn5ZrsxlIzxvDu5eHxzGLctkZLEY4PgSOg2IUVVcUONzUDBEpRaMoXNmUc0tFZrTZquiLyKxrSm3DvIW9Fil+AkhXu5PhEPx9mUNwqypDvZWdKlhIJQY7vn2OsnmBeOWnYZ0m1iwbbw1U60by5om47iHRV6fOgzjMf/DAZrlP40Z7syxpLK0lJ0gqaAK1c2KQKu7tabTXkLFz0sCftuwX++MyNeNn68k5Buq23YQhUh0SNTJa1ioQ0p4nUG2y0XilF1JqODqdImloPS4Bp111DEWT0jJjVv95uX9BBV7eB3bUWcu0acSVM23YZdd8R8UbQUxJ9wdu3oMuhdt929ME+mh6JXJ8di2RxbTi6TbrDquqV4aUKR2iwT6aZbyOwEXN3DUsWr8Hn4EhwNyHuXHh7/pdaUjtR7vnDh/d8c9xD/s5f501eQ1+CuDiCvGhk1AN/4Tf74RfxPwD3toLarR0zNtsnPzmS64KIRk861dMWCU8ArasG9T9H0ZBpsDGnjtAOM2+/LuIb2iIUGXNgl5ZmKD/Tw8TlaAuihaFP5yrw18v4x1898zIdP+DDAX1bM3GAMvPgRP/cJn3zCW013nrhHkrITyvYuwOUkcHuKlRSW5C6rzIdY4ppnF7J8aAJbQepgbJYBjCY9usGXDKQxq7RZfh9eg5d1UHMVATRaD/4BHK93/1iAgYZ/+jqPn8Dn4UExmWrpa3+ZOK6MvM3bjwfzxNWA2dhs8+51XHSPJiaAhGSpWevEs5xHLXcEGFXYiCONySH3fPWq93JIsBiSWvWyc3CAN+EcXoT7rCSANloPPoa31rt/5PUA/gp8Q/jDD3hyrjzlR8VkanfOvB1XPubt17vzxAfdSVbD1pzAnfgyF3ycadOTOTXhpEUoLC1HZyNGW3dtmjeXgr2r56JNmRwdNNWaQVBddd6rh4MhviEB9EFRD/7RGvePvCbwAL4Mx/D6M541hHO4D3e7g6PafdcZVw689z7NGTwo5om7A8sPhccT6qKcl9NJl9aM/9kX+e59Hh1yPqGuCCZxuITcsmNaJ5F7d0q6J3H48TO1/+M57085q2icdu2U+W36Ldllz9Agiv4YGljoEN908EzvDOrBF98/vtJwCC/BF2AG75xxEmjmMIcjxbjoaxqOK3/4hPOZzhMPBpYPG44CM0dTVm1LjLtUWWVz1Bcf8tEx0zs8O2A2YVHRxKYOiy/aOVoAaMu0i7ubu43njjmd4ibMHU1sIDHaQNKrZND/FZYdk54oCXetjq7E7IVl9eAL7t+oHnwXXtLx44czzoRFHBztYVwtH1d+NOMkupZ5MTM+gUmq90X+Bh9zjRlmaQ+m7YMqUL/veemcecAtOJ0yq1JnVlN27di2E0+Klp1tAJ4KRw1eMI7aJjsO3R8kPSI3fUFXnIOfdQe86sIIVtWDL7h//Ok6vj8vwDk08NEcI8zz7OhBy+WwalzZeZ4+0XniRfst9pAJqQHDGLzVQ2pheZnnv1OWhwO43/AgcvAEXEVVpa4db9sGvNK8wjaENHkfFQ4Ci5i7dqnQlPoLQrHXZDvO3BIXZbJOBrOaEbML6sFL798I4FhKihjHMsPjBUZYCMFr6nvaArxqXPn4lCa+cHfSa2cP27g3Z3ziYTRrcbQNGLQmGF3F3cBdzzzX7AILx0IB9rbwn9kx2G1FW3Inic+ZLIsVvKR8Zwfj0l1fkqo8LWY1M3IX14OX3r9RKTIO+d9XzAI8qRPGPn/4NC2n6o4rN8XJ82TOIvuVA8zLKUHRFgBCetlDZlqR1gLKjS39xoE7Bt8UvA6BxuEDjU3tFsEijgA+615tmZkXKqiEENrh41iLDDZNq4pKTWR3LZfnos81LOuNa15cD956vLMsJd1rqYp51gDUQqMYm2XsxnUhD2jg1DM7SeuJxxgrmpfISSXVIJIS5qJJSvJPEQ49DQTVIbYWJ9QWa/E2+c/oPK1drmC7WSfJRNKBO5Yjvcp7Gc3dmmI/Xh1kDTEuiSnWqQf37h+fTMhGnDf6dsS8SQfQWlqqwXXGlc/PEZ/SC5mtzIV0nAshlQdM/LvUtYutrEZ/Y+EAFtq1k28zQhOwLr1AIeANzhF8t9qzTdZf2qRKO6MWE9ohBYwibbOmrFtNmg3mcS+tB28xv2uKd/agYCvOP+GkSc+0lr7RXzyufL7QbkUpjLjEWFLqOIkAGu2B0tNlO9Eau2W1qcOUvVRgKzypKIQZ5KI3q0MLzqTNRYqiZOqmtqloIRlmkBHVpHmRYV6/HixbO6UC47KOFJnoMrVyr7wYz+SlW6GUaghYbY1I6kkxA2W1fSJokUdSh2LQ1GAimRGm0MT+uu57H5l7QgOWxERpO9moLRPgTtquWCfFlGlIjQaRly9odmzMOWY+IBO5tB4sW/0+VWGUh32qYk79EidWKrjWuiLpiVNGFWFRJVktyeXWmbgBBzVl8anPuXyNJlBJOlKLTgAbi/EYHVHxWiDaVR06GnHQNpJcWcK2jJtiCfG2sEHLzuI66sGrMK47nPIInPnu799935aOK2cvmvubrE38ZzZjrELCmXM2hM7UcpXD2oC3+ECVp7xtIuxptJ0jUr3sBmBS47TVxlvJ1Sqb/E0uLdvLj0lLr29ypdd/eMX3f6lrxGlKwKQxEGvw0qHbkbwrF3uHKwVENbIV2wZ13kNEF6zD+x24aLNMfDTCbDPnEikZFyTNttxWBXDaBuM8KtI2rmaMdUY7cXcUPstqTGvBGSrFWIpNMfbdea990bvAOC1YX0qbc6smDS1mPxSJoW4fwEXvjMmhlijDRq6qale6aJEuFGoppYDoBELQzLBuh/mZNx7jkinv0EtnUp50lO9hbNK57lZaMAWuWR5Yo9/kYwcYI0t4gWM47Umnl3YmpeBPqSyNp3K7s2DSAS/39KRuEN2bS4xvowV3dFRMx/VFcp2Yp8w2nTO9hCXtHG1kF1L4KlrJr2wKfyq77R7MKpFKzWlY9UkhYxyHWW6nBWPaudvEAl3CGcNpSXPZ6R9BbBtIl6cHL3gIBi+42CYXqCx1gfGWe7Ap0h3luyXdt1MKy4YUT9xSF01G16YEdWsouW9mgDHd3veyA97H+Ya47ZmEbqMY72oPztCGvK0onL44AvgC49saZKkWRz4veWljE1FHjbRJaWv6ZKKtl875h4CziFCZhG5rx7tefsl0aRT1bMHZjm8dwL/6u7wCRysaQblQoG5yAQN5zpatMNY/+yf8z+GLcH/Qn0iX2W2oEfXP4GvwQHuIL9AYGnaO3zqAX6946nkgqZNnUhx43DIdQtMFeOPrgy/y3Yd85HlJWwjLFkU3kFwq28xPnuPhMWeS+tDLV9Otllq7pQCf3uXJDN9wFDiUTgefHaiYbdfi3b3u8+iY6TnzhgehI1LTe8lcd7s1wJSzKbahCRxKKztTLXstGAiu3a6rPuQs5pk9TWAan5f0BZmGf7Ylxzzk/A7PAs4QPPPAHeFQ2hbFHszlgZuKZsJcUmbDC40sEU403cEjczstOEypa+YxevL4QBC8oRYqWdK6b7sK25tfE+oDZgtOQ2Jg8T41HGcBE6fTWHn4JtHcu9S7uYgU5KSCkl/mcnq+5/YBXOEr6lCUCwOTOM1taOI8mSxx1NsCXBEmLKbMAg5MkwbLmpBaFOPrNSlO2HnLiEqW3tHEwd8AeiQLmn+2gxjC3k6AxREqvKcJbTEzlpLiw4rNZK6oJdidbMMGX9FULKr0AkW+2qDEPBNNm5QAt2Ik2nftNWHetubosHLo2nG4vQA7GkcVCgVCgaDixHqo9UUn1A6OshapaNR/LPRYFV8siT1cCtJE0k/3WtaNSuUZYKPnsVIW0xXWnMUxq5+En4Kvw/MqQmVXnAXj9Z+9zM98zM/Agy7F/qqj2Nh67b8HjFnPP3iBn/tkpdzwEJX/whIcQUXOaikeliCRGUk7tiwF0rItwMEhjkZ309hikFoRAmLTpEXWuHS6y+am/KB/fM50aLEhGnSMwkpxzOov4H0AvgovwJ1iGzDLtJn/9BU+fAINfwUe6FHSLhu83viV/+/HrOePX+STT2B9uWGbrMHHLldRBlhS/CJQmcRxJFqZica01XixAZsYiH1uolZxLrR/SgxVIJjkpQP4PE9sE59LKLr7kltSBogS5tyszzH8Fvw8/AS8rNOg0xUS9fIaHwb+6et8Q/gyvKRjf5OusOzGx8evA/BP4IP11uN/grca5O0lcsPLJ5YjwI4QkJBOHa0WdMZYGxPbh2W2nR9v3WxEWqgp/G3+6VZbRLSAAZ3BhdhAaUL33VUSw9yjEsvbaQ9u4A/gGXwZXoEHOuU1GSj2chf+Mo+f8IcfcAxfIKVmyunRbYQVnoevwgfw3TXXcw++xNuP4fhyueEUNttEduRVaDttddoP0eSxLe2LENk6itYxlrxBNBYrNNKSQmeaLcm9c8UsaB5WyO6675yyQIAWSDpBVoA/gxmcwEvwoDv0m58UE7gHn+fJOa8/Ywan8EKRfjsopF83eCglX/Sfr7OeaRoQfvt1CGvIDccH5BCvw1sWIzRGC/66t0VTcLZQZtm6PlAasbOJ9iwWtUo7biktTSIPxnR24jxP1ZKaqq+2RcXM9OrBAm/AAs7hDJ5bNmGb+KIfwCs8a3jnjBrOFeMjHSCdbKr+2uOLfnOd9eiA8Hvvwwq54VbP2OqwkB48Ytc4YEOiH2vTXqodabfWEOzso4qxdbqD5L6tbtNPECqbhnA708DZH4QOJUXqScmUlks7Ot6FBuZw3n2mEbaUX7kDzxHOOQk8nKWMzAzu6ZZ8sOFw4RK+6PcuXo9tB4SbMz58ApfKDXf3szjNIIbGpD5TKTRxGkEMLjLl+K3wlWXBsCUxIDU+jbOiysESqAy1MGUJpXgwbTWzNOVEziIXZrJ+VIztl1PUBxTSo0dwn2bOmfDRPD3TRTGlfbCJvO9KvuhL1hMHhB9wPuPRLGHcdOWG2xc0U+5bQtAJT0nRTewXL1pgk2+rZAdeWmz3jxAqfNQQdzTlbF8uJ5ecEIWvTkevAHpwz7w78QujlD/Lr491bD8/1vhM2yrUQRrWXNQY4fGilfctMWYjL72UL/qS9eiA8EmN88nbNdour+PBbbAjOjIa4iBhfFg6rxeKdEGcL6p3EWR1Qq2Qkhs2DrnkRnmN9tG2EAqmgPw6hoL7Oza7B+3SCrR9tRftko+Lsf2F/mkTndN2LmzuMcKTuj/mX2+4Va3ki16+nnJY+S7MefpkidxwnV+4wkXH8TKnX0tsYzYp29DOOoSW1nf7nTh2akYiWmcJOuTidSaqESrTYpwjJJNVGQr+rLI7WsqerHW6Kp/oM2pKuV7T1QY9gjqlZp41/WfKpl56FV/0kvXQFRyeQ83xaTu5E8p5dNP3dUF34ihyI3GSpeCsywSh22ZJdWto9winhqifb7VRvgktxp13vyjrS0EjvrRfZ62uyqddSWaWYlwTPAtJZ2oZ3j/Sgi/mi+6vpzesfAcWNA0n8xVyw90GVFGuZjTXEQy+6GfLGLMLL523f5E0OmxVjDoOuRiH91RKU+vtoCtH7TgmvBLvtFXWLW15H9GTdVw8ow4IlRLeHECN9ym1e9K0I+Cbnhgv4Yu+aD2HaQJ80XDqOzSGAV4+4yCqBxrsJAX6ZTIoX36QnvzhhzzMfFW2dZVLOJfo0zbce5OvwXMFaZ81mOnlTVXpDZsQNuoYWveketKb5+6JOOsgX+NTm7H49fUTlx+WLuWL7qxnOFh4BxpmJx0p2gDzA/BUARuS6phR+pUsY7MMboAHx5xNsSVfVZcYSwqCKrqon7zM+8ecCkeS4nm3rINuaWvVNnMRI1IRpxTqx8PZUZ0Br/UEduo3B3hNvmgZfs9gQPj8vIOxd2kndir3awvJ6BLvoUuOfFWNYB0LR1OQJoUySKb9IlOBx74q1+ADC2G6rOdmFdJcD8BkfualA+BdjOOzP9uUhGUEX/TwhZsUduwRr8wNuXKurCixLBgpQI0mDbJr9dIqUuV+92ngkJZ7xduCk2yZKbfWrH1VBiTg9VdzsgRjW3CVXCvAwDd+c1z9dWw9+B+8MJL/eY15ZQ/HqvTwVdsZn5WQsgRRnMaWaecu3jFvMBEmgg+FJFZsnSl0zjB9OqPYaBD7qmoVyImFvzi41usesV0julaAR9dfR15Xzv9sEruRDyk1nb+QaLU67T885GTls6YgcY+UiMa25M/pwGrbCfzkvR3e0jjtuaFtnwuagHTSb5y7boBH119HXhvwP487jJLsLJ4XnUkHX5sLbS61dpiAXRoZSCrFJ+EjpeU3puVfitngYNo6PJrAigKktmwjyQdZpfq30mmtulaAx9Zfx15Xzv+cyeuiBFUs9zq8Kq+XB9a4PVvph3GV4E3y8HENJrN55H1X2p8VyqSKwVusJDKzXOZzplWdzBUFK9e+B4+uv468xvI/b5xtSAkBHQaPvtqWzllVvEOxPbuiE6+j2pvjcKsbvI7txnRErgfH7LdXqjq0IokKzga14GzQ23SSbCQvO6r+Or7SMIr/efOkkqSdMnj9mBx2DRsiY29Uj6+qK9ZrssCKaptR6HKURdwUYeUWA2kPzVKQO8ku2nU3Anhs/XWkBx3F/7wJtCTTTIKftthue1ty9xvNYLY/zo5KSbIuKbXpbEdSyeRyYdAIwKY2neyoc3+k1XUaufYga3T9daMUx/r8z1s10ITknIO0kuoMt+TB8jK0lpayqqjsJ2qtXAYwBU932zinimgmd6mTRDnQfr88q36NAI+tv24E8Pr8zxtasBqx0+xHH9HhlrwsxxNUfKOHQaZBITNf0uccj8GXiVmXAuPEAKSdN/4GLHhs/XWj92dN/uetNuBMnVR+XWDc25JLjo5Mg5IZIq226tmCsip2zZliL213YrTlL2hcFjpCduyim3M7/eB16q/blQsv5X/esDRbtJeabLIosWy3ycavwLhtxdWzbMmHiBTiVjJo6lCLjXZsi7p9PEPnsq6X6wd4bP11i0rD5fzPm/0A6brrIsllenZs0lCJlU4abakR59enZKrKe3BZihbTxlyZ2zl1+g0wvgmA166/bhwDrcn/7Ddz0eWZuJvfSESug6NzZsox3Z04FIxz0mUjMwVOOVTq1CQ0AhdbBGVdjG/CgsfUX7esJl3K/7ytWHRv683praW/8iDOCqWLLhpljDY1ZpzK75QiaZoOTpLKl60auHS/97oBXrv+umU9+FL+5+NtLFgjqVLCdbmj7pY5zPCPLOHNCwXGOcLquOhi8CmCWvbcuO73XmMUPab+ug3A6/A/78Bwe0bcS2+tgHn4J5pyS2WbOck0F51Vq3LcjhLvZ67p1ABbaL2H67bg78BfjKi/jr3+T/ABV3ilLmNXTI2SpvxWBtt6/Z//D0z/FXaGbSBgylzlsEGp+5//xrd4/ae4d8DUUjlslfIYS3t06HZpvfQtvv0N7AHWqtjP2pW08QD/FLy//da38vo8PNlKHf5y37Dxdfe/oj4kVIgFq3koLReSR76W/bx//n9k8jonZxzWTANVwEniDsg87sOSd/z7//PvMp3jQiptGVWFX2caezzAXwfgtzYUvbr0iozs32c3Uge7varH+CNE6cvEYmzbPZ9hMaYDdjK4V2iecf6EcEbdUDVUARda2KzO/JtCuDbNQB/iTeL0EG1JSO1jbXS+nLxtPMDPw1fh5+EPrgSEKE/8Gry5A73ui87AmxwdatyMEBCPNOCSKUeRZ2P6Myb5MRvgCHmA9ywsMifU+AYXcB6Xa5GibUC5TSyerxyh0j6QgLVpdyhfArRTTLqQjwe4HOD9s92D4Ap54odXAPBWLAwB02igG5Kkc+piN4lvODIFGAZgT+EO4Si1s7fjSR7vcQETUkRm9O+MXyo9OYhfe4xt9STQ2pcZRLayCV90b4D3jR0DYAfyxJ+eywg2IL7NTMXna7S/RpQ63JhWEM8U41ZyQGjwsVS0QBrEKLu8xwZsbi4wLcCT+OGidPIOCe1PiSc9Qt+go+vYqB7cG+B9d8cAD+WJPz0Am2gxXgU9IneOqDpAAXOsOltVuMzpdakJXrdPCzXiNVUpCeOos5cxnpQT39G+XVLhs1osQVvJKPZyNq8HDwd4d7pNDuWJPxVX7MSzqUDU6gfadKiNlUFTzLeFHHDlzO4kpa7aiKhBPGKwOqxsBAmYkOIpipyXcQSPlRTf+Tii0U3EJGaZsDER2qoB3h2hu0qe+NNwUooYU8y5mILbJe6OuX+2FTKy7bieTDAemaQyQ0CPthljSWO+xmFDIYiESjM5xKd6Ik5lvLq5GrQ3aCMLvmCA9wowLuWJb9xF59hVVP6O0CrBi3ZjZSNOvRy+I6klNVRJYRBaEzdN+imiUXQ8iVF8fsp+W4JXw7WISW7fDh7lptWkCwZ4d7QTXyBPfJMYK7SijjFppGnlIVJBJBYj7eUwtiP1IBXGI1XCsjNpbjENVpSAJ2hq2LTywEly3hUYazt31J8w2+aiLx3g3fohXixPfOMYm6zCGs9LVo9MoW3MCJE7R5u/WsOIjrqBoHUO0bJE9vxBpbhsd3+Nb4/vtPCZ4oZYCitNeYuC/8UDvDvy0qvkiW/cgqNqRyzqSZa/s0mqNGjtKOoTm14zZpUauiQgVfqtQiZjq7Q27JNaSK5ExRcrGCXO1FJYh6jR6CFqK7bZdQZ4t8g0rSlPfP1RdBtqaa9diqtzJkQ9duSryi2brQXbxDwbRUpFMBHjRj8+Nt7GDKgvph9okW7LX47gu0SpGnnFQ1S1lYldOsC7hYteR574ZuKs7Ei1lBsfdz7IZoxzzCVmmVqaSySzQbBVAWDek+N4jh9E/4VqZrJjPwiv9BC1XcvOWgO8275CVyBPvAtTVlDJfZkaZGU7NpqBogAj/xEHkeAuJihWYCxGN6e8+9JtSegFXF1TrhhLGP1fak3pebgPz192/8gB4d/6WT7+GdYnpH7hH/DJzzFiYPn/vjW0SgNpTNuPIZoAEZv8tlGw4+RLxy+ZjnKa5NdFoC7UaW0aduoYse6+bXg1DLg6UfRYwmhGEjqPvF75U558SANrElK/+MdpXvmqBpaXOa/MTZaa1DOcSiLaw9j0NNNst3c+63c7EKTpkvKHzu6bPbP0RkuHAVcbRY8ijP46MIbQeeT1mhA+5PV/inyDdQipf8LTvMXbwvoDy7IruDNVZKTfV4CTSRUYdybUCnGU7KUTDxLgCknqUm5aAW6/1p6eMsOYsphLzsHrE0Y/P5bQedx1F/4yPHnMB3/IOoTU9+BL8PhtjuFKBpZXnYNJxTuv+2XqolKR2UQgHhS5novuxVySJhBNRF3SoKK1XZbbXjVwWNyOjlqWJjrWJIy+P5bQedyldNScP+HZ61xKSK3jyrz+NiHG1hcOLL/+P+PDF2gOkekKGiNWKgJ+8Z/x8Iv4DdQHzcpZyF4v19I27w9/yPGDFQvmEpKtqv/TLiWMfn4sofMm9eAH8Ao0zzh7h4sJqYtxZd5/D7hkYPneDzl5idlzNHcIB0jVlQ+8ULzw/nc5/ojzl2juE0apD7LRnJxe04dMz2iOCFNtGFpTuXA5AhcTRo8mdN4kz30nVjEC4YTZQy4gpC7GlTlrePKhGsKKgeXpCYeO0MAd/GH7yKQUlXPLOasOH3FnSphjHuDvEu4gB8g66oNbtr6eMbFIA4fIBJkgayoXriw2XEDQPJrQeROAlY6aeYOcMf+IVYTU3XFlZufMHinGywaW3YLpObVBAsbjF4QJMsVUSayjk4voPsHJOQfPWDhCgDnmDl6XIRerD24HsGtw86RMHOLvVSHrKBdeVE26gKB5NKHzaIwLOmrqBWJYZDLhASG16c0Tn+CdRhWDgWXnqRZUTnPIHuMJTfLVpkoYy5CzylHVTGZMTwkGAo2HBlkQplrJX6U+uF1wZz2uwS1SQ12IqWaPuO4baZaEFBdukksJmkcTOm+YJSvoqPFzxFA/YUhIvWxcmSdPWTWwbAKVp6rxTtPFUZfKIwpzm4IoMfaYQLWgmlG5FME2gdBgm+J7J+rtS/XBbaVLsR7bpPQnpMFlo2doWaVceHk9+MkyguZNCJ1He+kuHTWyQAzNM5YSUg/GlTk9ZunAsg1qELVOhUSAK0LABIJHLKbqaEbHZLL1VA3VgqoiOKXYiS+HRyaEKgsfIqX64HYWbLRXy/qWoylIV9gudL1OWBNgBgTNmxA6b4txDT4gi3Ri7xFSLxtXpmmYnzAcWDZgY8d503LFogz5sbonDgkKcxGsWsE1OI+rcQtlgBBCSOKD1mtqYpIU8cTvBmAT0yZe+zUzeY92fYjTtGipXLhuR0ePoHk0ofNWBX+lo8Z7pAZDk8mEw5L7dVyZZoE/pTewbI6SNbiAL5xeygW4xPRuLCGbhcO4RIeTMFYHEJkYyEO9HmJfXMDEj/LaH781wHHZEtqSQ/69UnGpzH7LKIAZEDSPJnTesJTUa+rwTepI9dLJEawYV+ZkRn9g+QirD8vF8Mq0jFQ29js6kCS3E1+jZIhgPNanHdHFqFvPJLHqFwQqbIA4jhDxcNsOCCQLDomaL/dr5lyJaJU6FxPFjO3JOh3kVMcROo8u+C+jo05GjMF3P3/FuDLn5x2M04xXULPwaS6hBYki+MrMdZJSgPHlcB7nCR5bJ9Kr5ACUn9jk5kivdd8tk95SOGrtqu9lr2IhK65ZtEl7ZKrp7DrqwZfRUSN1el7+7NJxZbywOC8neNKTch5vsTEMNsoCCqHBCqIPRjIPkm0BjvFODGtto99rCl+d3wmHkW0FPdpZtC7MMcVtGFQjJLX5bdQ2+x9ypdc313uj8xlsrfuLgWXz1cRhZvJYX0iNVBRcVcmCXZs6aEf3RQF2WI/TcCbKmGU3IOoDJGDdDub0+hYckt6PlGu2BcxmhbTdj/klhccLGJMcqRjMJP1jW2ETqLSWJ/29MAoORluJ+6LPffBZbi5gqi5h6catQpmOT7/OFf5UorRpLzCqcMltBLhwd1are3kztrSzXO0LUbXRQcdLh/RdSZ+swRm819REDrtqzC4es6Gw4JCKlSnjYVpo0xeq33PrADbFLL3RuCmObVmPN+24kfa+AojDuM4umKe2QwCf6EN906HwjujaitDs5o0s1y+k3lgbT2W2i7FJdnwbLXhJUBq/9liTctSmFC/0OqUinb0QddTWamtjbHRFuWJJ6NpqZ8vO3fZJ37Db+2GkaPYLGHs7XTTdiFQJ68SkVJFVmY6McR5UycflNCsccHFaV9FNbR4NttLxw4pQ7wJd066Z0ohVbzihaxHVExd/ay04oxUKWt+AsdiQ9OUyZ2krzN19IZIwafSTFgIBnMV73ADj7V/K8u1MaY2sJp2HWm0f41tqwajEvdHWOJs510MaAqN4aoSiPCXtN2KSi46dUxHdaMquar82O1x5jqhDGvqmoE9LfxcY3zqA7/x3HA67r9ZG4O6Cuxu12/+TP+eLP+I+HErqDDCDVmBDO4larujNe7x8om2rMug0MX0rL1+IWwdwfR+p1TNTyNmVJ85ljWzbWuGv8/C7HD/izjkHNZNYlhZcUOKVzKFUxsxxN/kax+8zPWPSFKw80rJr9Tizyj3o1gEsdwgWGoxPezDdZ1TSENE1dLdNvuKL+I84nxKesZgxXVA1VA1OcL49dFlpFV5yJMhzyCmNQ+a4BqusPJ2bB+xo8V9u3x48VVIEPS/mc3DvAbXyoYr6VgDfh5do5hhHOCXMqBZUPhWYbWZECwVJljLgMUWOCB4MUuMaxGNUQDVI50TQ+S3kFgIcu2qKkNSHVoM0SHsgoZxP2d5HH8B9woOk4x5bPkKtAHucZsdykjxuIpbUrSILgrT8G7G5oCW+K0990o7E3T6AdW4TilH5kDjds+H64kS0mz24grtwlzDHBJqI8YJQExotPvoC4JBq0lEjjQkyBZ8oH2LnRsQ4Hu1QsgDTJbO8fQDnllitkxuVskoiKbRF9VwzMDvxHAdwB7mD9yCplhHFEyUWHx3WtwCbSMMTCUCcEmSGlg4gTXkHpZXWQ7kpznK3EmCHiXInqndkQjunG5kxTKEeGye7jWz9cyMR2mGiFQ15ENRBTbCp+Gh86vAyASdgmJq2MC6hoADQ3GosP0QHbnMHjyBQvQqfhy/BUbeHd5WY/G/9LK/8Ka8Jd7UFeNWEZvzPb458Dn8DGLOe3/wGL/4xP+HXlRt+M1PE2iLhR8t+lfgxsuh7AfO2AOf+owWhSZRYQbd622hbpKWKuU+XuvNzP0OseRDa+mObgDHJUSc/pKx31QdKffQ5OIJpt8GWjlgTwMc/w5MPCR/yl1XC2a2Yut54SvOtMev55Of45BOat9aWG27p2ZVORRvnEk1hqWMVUmqa7S2YtvlIpspuF1pt0syuZS2NV14mUidCSfzQzg+KqvIYCMljIx2YK2AO34fX4GWdu5xcIAb8MzTw+j/lyWM+Dw/gjs4GD6ehNgA48kX/AI7XXM/XAN4WHr+9ntywqoCakCqmKP0rmQrJJEErG2Upg1JObr01lKQy4jskWalKYfJ/EDLMpjNSHFEUAde2fltaDgmrNaWQ9+AAb8I5vKjz3L1n1LriB/BXkG/wwR9y/oRX4LlioHA4LzP2inzRx/DWmutRweFjeP3tNeSGlaE1Fde0OS11yOpmbIp2u/jF1n2RRZviJM0yBT3IZl2HWImKjQOxIyeU325b/qWyU9Moj1o07tS0G7qJDoGHg5m8yeCxMoEH8GU45tnrNM84D2l297DQ9t1YP7jki/7RmutRweEA77/HWXOh3HCxkRgldDQkAjNTMl2Iloc1qN5JfJeeTlyTRzxURTdn1Ixv2uKjs12AbdEWlBtmVdk2k7FFwj07PCZ9XAwW3dG+8xKzNFr4EnwBZpy9Qzhh3jDXebBpYcpuo4fQ44u+fD1dweEnHzI7v0xuuOALRUV8rXpFyfSTQYkhd7IHm07jpyhlkCmI0ALYqPTpUxXS+z4jgDj1Pflvmz5ecuItpIBxyTHpSTGWd9g1ApfD/bvwUhL4nT1EzqgX7cxfCcNmb3mPL/qi9SwTHJ49oj5ZLjccbTG3pRmlYi6JCG0mQrAt1+i2UXTZ2dv9IlQpN5naMYtviaXlTrFpoMsl3bOAFEa8sqPj2WCMrx3Yjx99qFwO59Aw/wgx+HlqNz8oZvA3exRDvuhL1jMQHPaOJ0+XyA3fp1OfM3qObEVdhxjvynxNMXQV4+GJyvOEFqeQBaIbbO7i63rpxCltdZShPFxkjM2FPVkn3TG+Rp9pO3l2RzFegGfxGDHIAh8SteR0C4HopXzRF61nheDw6TFN05Ebvq8M3VKKpGjjO6r7nhudTEGMtYM92HTDaR1FDMXJ1eThsbKfywyoWwrzRSXkc51flG3vIid62h29bIcFbTGhfV+faaB+ohj7dPN0C2e2lC96+XouFByen9AsunLDJZ9z7NExiUc0OuoYW6UZkIyx2YUR2z6/TiRjyKMx5GbbjLHvHuf7YmtKghf34LJfx63Yg8vrvN2zC7lY0x0tvKezo4HmGYDU+Gab6dFL+KI761lDcNifcjLrrr9LWZJctG1FfU1uwhoQE22ObjdfkSzY63CbU5hzs21WeTddH2BaL11Gi7lVdlxP1nkxqhnKhVY6knS3EPgVGg1JpN5cP/hivujOelhXcPj8HC/LyI6MkteVjlolBdMmF3a3DbsuAYhL44dxzthWSN065xxUd55Lmf0wRbOYOqH09/o9WbO2VtFdaMb4qBgtFJoT1SqoN8wPXMoXLb3p1PUEhxfnnLzGzBI0Ku7FxrKsNJj/8bn/H8fPIVOd3rfrklUB/DOeO+nkghgSPzrlPxluCMtOnDL4Yml6dK1r3vsgMxgtPOrMFUZbEUbTdIzii5beq72G4PD0DKnwjmBULUVFmy8t+k7fZ3pKc0Q4UC6jpVRqS9Umv8bxw35flZVOU1X7qkjnhZlsMbk24qQ6Hz7QcuL6sDC0iHHki96Uh2UdvmgZnjIvExy2TeJdMDZNSbdZyAHe/Yd1xsQhHiKzjh7GxQ4yqMPaywPkjMamvqrYpmO7Knad+ZQC5msCuAPWUoxrxVhrGv7a+KLXFhyONdTMrZ7ke23qiO40ZJUyzgYyX5XyL0mV7NiUzEs9mjtbMN0dERqwyAJpigad0B3/zRV7s4PIfXSu6YV/MK7+OrYe/JvfGMn/PHJe2fyUdtnFrKRNpXV0Y2559aWPt/G4BlvjTMtXlVIWCnNyA3YQBDmYIodFz41PvXPSa6rq9lWZawZ4dP115HXV/M/tnFkkrBOdzg6aP4pID+MZnTJ1SuuB6iZlyiox4HT2y3YBtkUKWooacBQUDTpjwaDt5poBHl1/HXltwP887lKKXxNUEyPqpGTyA699UqY/lt9yGdlUKra0fFWS+36iylVWrAyd7Uw0CZM0z7xKTOduznLIjG2Hx8cDPLb+OvK6Bv7n1DYci4CxUuRxrjBc0bb4vD3rN5Zz36ntLb83eVJIB8LiIzCmn6SMPjlX+yNlTjvIGjs+QzHPf60Aj62/jrzG8j9vYMFtm1VoRWCJdmw7z9N0t+c8cxZpPeK4aTRicS25QhrVtUp7U578chk4q04Wx4YoQSjFryUlpcQ1AbxZ/XVMknIU//OGl7Q6z9Zpxi0+3yFhSkjUDpnCIUhLWVX23KQ+L9vKvFKI0ZWFQgkDLvBoylrHNVmaw10zwCPrr5tlodfnf94EWnQ0lFRWy8pW9LbkLsyUVDc2NSTHGDtnD1uMtchjbCeb1mpxFP0YbcClhzdLu6lfO8Bj6q+bdT2sz/+8SZCV7VIxtt0DUn9L7r4cLYWDSXnseEpOGFuty0qbOVlS7NNzs5FOGJUqQpl2Q64/yBpZf90sxbE+//PGdZ02HSipCbmD6NItmQ4Lk5XUrGpDMkhbMm2ZVheNYV+VbUWTcv99+2NyX1VoafSuC+AN6q9bFIMv5X/eagNWXZxEa9JjlMwNWb00akGUkSoepp1/yRuuqHGbUn3UdBSTxBU6SEVklzWRUkPndVvw2PrrpjvxOvzPmwHc0hpmq82npi7GRro8dXp0KXnUQmhZbRL7NEVp1uuZmO45vuzKsHrktS3GLWXODVjw+vXXLYx4Hf7njRPd0i3aoAGX6W29GnaV5YdyDj9TFkakje7GHYzDoObfddHtOSpoi2SmzJHrB3hM/XUDDEbxP2/oosszcRlehWXUvzHv4TpBVktHqwenFo8uLVmy4DKLa5d3RtLrmrM3aMFr1183E4sewf+85VWeg1c5ag276NZrM9IJVNcmLEvDNaV62aq+14IAOGFsBt973Ra8Xv11YzXwNfmft7Jg2oS+XOyoC8/cwzi66Dhmgk38kUmP1CUiYWOX1bpD2zWXt2FCp7uq8703APAa9dfNdscR/M/bZLIyouVxqJfeWvG9Je+JVckHQ9+CI9NWxz+blX/KYYvO5n2tAP/vrlZ7+8/h9y+9qeB/Hnt967e5mevX10rALDWK//FaAT5MXdBXdP0C/BAes792c40H+AiAp1e1oH8HgH94g/Lttx1gp63op1eyoM/Bvw5/G/7xFbqJPcCXnmBiwDPb/YKO4FX4OjyCb289db2/Noqicw4i7N6TVtoz8tNwDH+8x/i6Ae7lmaQVENzJFb3Di/BFeAwz+Is9SjeQySpPqbLFlNmyz47z5a/AF+AYFvDmHqibSXTEzoT4Gc3OALaqAP4KPFUJ6n+1x+rGAM6Zd78bgJ0a8QN4GU614vxwD9e1Amy6CcskNrczLx1JIp6HE5UZD/DBHrFr2oNlgG4Odv226BodoryjGJ9q2T/AR3vQrsOCS0ctXZi3ruLlhpFDJYl4HmYtjQCP9rhdn4suySLKDt6wLcC52h8xPlcjju1fn+yhuw4LZsAGUuo2b4Fx2UwQu77uqRHXGtg92aN3tQCbFexc0uk93vhTXbct6y7MulLycoUljx8ngDMBg1tvJjAazpEmOtxlzclvj1vQf1Tx7QlPDpGpqgtdSKz/d9/hdy1vTfFHSmC9dGDZbLiezz7Ac801HirGZsWjydfZyPvHXL/Y8Mjzg8BxTZiuwKz4Eb8sBE9zznszmjvFwHKPIWUnwhqfVRcd4Ck0K6ate48m1oOfrX3/yOtvAsJ8zsPAM89sjnddmuLuDPjX9Bu/L7x7xpMzFk6nWtyQfPg278Gn4Aekz2ZgOmU9eJ37R14vwE/BL8G3aibCiWMWWDQ0ZtkPMnlcGeAu/Ag+8ZyecU5BPuy2ILD+sQqyZhAKmn7XZd+jIMTN9eBL7x95xVLSX4On8EcNlXDqmBlqS13jG4LpmGbkF/0CnOi3H8ETOIXzmnmtb0a16Tzxj1sUvQCBiXZGDtmB3KAefPH94xcUa/6vwRn80GOFyjEXFpba4A1e8KQfFF+259tx5XS4egYn8fQsLGrqGrHbztr+uByTahWuL1NUGbDpsnrwBfePPwHHIf9X4RnM4Z2ABWdxUBlqQ2PwhuDxoS0vvqB1JzS0P4h2nA/QgTrsJFn+Y3AOjs9JFC07CGWX1oNX3T/yHOzgDjwPn1PM3g9Jk9lZrMEpxnlPmBbjyo2+KFXRU52TJM/2ALcY57RUzjObbjqxVw++4P6RAOf58pcVsw9Daje3htriYrpDOonre3CudSe6bfkTEgHBHuDiyu5MCsc7BHhYDx7ePxLjqigXZsw+ijMHFhuwBmtoTPtOxOrTvYJDnC75dnUbhfwu/ZW9AgYd+peL68HD+0emKquiXHhWjJg/UrkJYzuiaL3E9aI/ytrCvAd4GcYZMCkSQxfUg3v3j8c4e90j5ZTPdvmJJGHnOCI2nHS8081X013pHuBlV1gB2MX1YNmWLHqqGN/TWmG0y6clJWthxNUl48q38Bi8vtMKyzzpFdSDhxZ5WBA5ZLt8Jv3895DduBlgbPYAj8C4B8hO68FDkoh5lydC4FiWvBOVqjYdqjiLv92t8yPDjrDaiHdUD15qkSURSGmXJwOMSxWAXYwr3zaAufJ66l+94vv3AO+vPcD7aw/w/toDvL/2AO+vPcD7aw/wHuD9tQd4f+0B3l97gPfXHuD9tQd4f+0B3l97gG8LwP8G/AL8O/A5OCq0Ys2KIdv/qOIXG/4mvFAMF16gZD+2Xvu/B8as5+8bfllWyg0zaNO5bfXj6vfhhwD86/Aq3NfRS9t9WPnhfnvCIw/CT8GLcFTMnpntdF/z9V+PWc/vWoIH+FL3Znv57PitcdGP4R/C34avw5fgRVUInCwbsn1yyA8C8zm/BH8NXoXnVE6wVPjdeCI38kX/3+Ct9dbz1pTmHFRu+Hm4O9Ch3clr99negxfwj+ER/DR8EV6B5+DuQOnTgUw5rnkY+FbNU3gNXh0o/JYTuWOvyBf9FvzX663HH/HejO8LwAl8Hl5YLTd8q7sqA3wbjuExfAFegQdwfyDoSkWY8swzEf6o4Qyewefg+cHNbqMQruSL/u/WWc+E5g7vnnEXgDmcDeSGb/F4cBcCgT+GGRzDU3hZYburAt9TEtHgbM6JoxJ+6NMzzTcf6c2bycv2+KK/f+l6LBzw5IwfqZJhA3M472pWT/ajKxnjv4AFnMEpnBTPND6s2J7qHbPAqcMK74T2mZ4VGB9uJA465It+/eL1WKhYOD7xHOkr1ajK7d0C4+ke4Hy9qXZwpgLr+Znm/uNFw8xQOSy8H9IzjUrd9+BIfenYaylf9FsXr8fBAadnPIEDna8IBcwlxnuA0/Wv6GAWPd7dDIKjMdSWueAsBj4M7TOd06qBbwDwKr7oleuxMOEcTuEZTHWvDYUO7aHqAe0Bbq+HEFRzOz7WVoTDQkVds7A4sIIxfCQdCefFRoIOF/NFL1mPab/nvOakSL/Q1aFtNpUb/nFOVX6gzyg/1nISyDfUhsokIzaBR9Kxm80s5mK+6P56il1jXic7nhQxsxSm3OwBHl4fFdLqi64nDQZvqE2at7cWAp/IVvrN6/BFL1mPhYrGMBfOi4PyjuSGf6wBBh7p/FZTghCNWGgMzlBbrNJoPJX2mW5mwZfyRffXo7OFi5pZcS4qZUrlViptrXtw+GQoyhDPS+ANjcGBNRiLCQDPZPMHuiZfdFpPSTcQwwKYdRNqpkjm7AFeeT0pJzALgo7g8YYGrMHS0iocy+YTm2vyRUvvpXCIpQ5pe666TJrcygnScUf/p0NDs/iAI/nqDHC8TmQT8x3NF91l76oDdQGwu61Z6E0ABv7uO1dbf/37Zlv+Zw/Pbh8f1s4Avur6657/+YYBvur6657/+YYBvur6657/+YYBvur6657/+aYBvuL6657/+VMA8FXWX/f8zzcN8BXXX/f8zzcNMFdbf93zP38KLPiK6697/uebtuArrr/u+Z9vGmCusP6653/+1FjwVdZf9/zPN7oHX339dc//fNMu+irrr3v+50+Bi+Zq6697/uebA/jz8Pudf9ht/fWv517J/XUzAP8C/BAeX9WCDrUpZ3/dEMBxgPcfbtTVvsYV5Yn32u03B3Ac4P3b8I+vxNBKeeL9dRMAlwO83959qGO78sT769oB7g3w/vGVYFzKE++v6wV4OMD7F7tckFkmT7y/rhHgpQO8b+4Y46XyxPvrugBeNcB7BRiX8sT767oAvmCA9woAHsoT76+rBJjLBnh3txOvkifeX1dswZcO8G6N7sXyxPvr6i340gHe3TnqVfLE++uKAb50gHcXLnrX8sR7gNdPRqwzwLu7Y/FO5Yn3AK9jXCMGeHdgxDuVJ75VAI8ljP7PAb3/RfjcZfePHBB+79dpfpH1CanN30d+mT1h9GqAxxJGM5LQeeQ1+Tb+EQJrElLb38VHQ94TRq900aMIo8cSOo+8Dp8QfsB8zpqE1NO3OI9Zrj1h9EV78PqE0WMJnUdeU6E+Jjyk/hbrEFIfeWbvId8H9oTRFwdZaxJGvziW0Hn0gqYB/wyZ0PwRlxJST+BOw9m77Amj14ii1yGM/txYQudN0qDzGe4EqfA/5GJCagsHcPaEPWH0esekSwmjRxM6b5JEcZ4ww50ilvAOFxBSx4yLW+A/YU8YvfY5+ALC6NGEzhtmyZoFZoarwBLeZxUhtY4rc3bKnjB6TKJjFUHzJoTOozF2YBpsjcyxDgzhQ1YRUse8+J4wenwmaylB82hC5w0zoRXUNXaRBmSMQUqiWSWkLsaVqc/ZE0aPTFUuJWgeTei8SfLZQeMxNaZSIzbII4aE1Nmr13P2hNHjc9E9guYNCZ032YlNwESMLcZiLQHkE4aE1BFg0yAR4z1h9AiAGRA0jyZ03tyIxWMajMPWBIsxYJCnlITU5ShiHYdZ94TR4wCmSxg9jtB5KyPGYzymAYexWEMwAPIsAdYdV6aObmNPGD0aYLoEzaMJnTc0Ygs+YDw0GAtqxBjkuP38bMRWCHn73xNGjz75P73WenCEJnhwyVe3AEe8TtKdJcYhBl97wuhNAObK66lvD/9J9NS75v17wuitAN5fe4D31x7g/bUHeH/tAd5fe4D3AO+vPcD7aw/w/toDvL/2AO+vPcD7aw/w/toDvAd4f/24ABzZ8o+KLsSLS+Pv/TqTb3P4hKlQrTGh+fbIBT0Axqznnb+L/V2mb3HkN5Mb/nEHeK7d4IcDld6lmDW/iH9E+AH1MdOw/Jlu2T1xNmY98sv4wHnD7D3uNHu54WUuOsBTbQuvBsPT/UfzNxGYzwkP8c+Yz3C+r/i6DcyRL/rZ+utRwWH5PmfvcvYEt9jLDS/bg0/B64DWKrQM8AL8FPwS9beQCe6EMKNZYJol37jBMy35otdaz0Bw2H/C2Smc7+WGB0HWDELBmOByA3r5QONo4V+DpzR/hFS4U8wMW1PXNB4TOqYz9urxRV++ntWCw/U59Ty9ebdWbrgfRS9AYKKN63ZokZVygr8GZ/gfIhZXIXPsAlNjPOLBby5c1eOLvmQ9lwkOy5x6QV1j5TYqpS05JtUgUHUp5toHGsVfn4NX4RnMCe+AxTpwmApTYxqMxwfCeJGjpXzRF61nbcHhUBPqWze9svwcHJ+S6NPscKrEjug78Dx8Lj3T8D4YxGIdxmJcwhi34fzZUr7olevZCw5vkOhoClq5zBPZAnygD/Tl9EzDh6kl3VhsHYcDEb+hCtJSvuiV69kLDm+WycrOTArHmB5/VYyP6jOVjwgGawk2zQOaTcc1L+aLXrKeveDwZqlKrw8U9Y1p66uK8dEzdYwBeUQAY7DbyYNezBfdWQ97weEtAKYQg2xJIkuveAT3dYeLGH+ShrWNwZgN0b2YL7qznr3g8JYAo5bQBziPjx7BPZ0d9RCQp4UZbnFdzBddor4XHN4KYMrB2qHFRIzzcLAHQZ5the5ovui94PCWAPefaYnxIdzRwdHCbuR4B+tbiy96Lzi8E4D7z7S0mEPd+eqO3cT53Z0Y8SV80XvB4Z0ADJi/f7X113f+7p7/+UYBvur6657/+YYBvur6657/+aYBvuL6657/+aYBvuL6657/+aYBvuL6657/+aYBvuL6657/+VMA8FXWX/f8z58OgK+y/rrnf75RgLna+uue//lTA/CV1V/3/M837aKvvv6653++UQvmauuve/7nTwfAV1N/3fM/fzr24Cuuv+75nz8FFnxl9dc9//MOr/8/glixwRuUfM4AAAAASUVORK5CYII="}_getSearchTexture(){return"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEIAAAAhCAAAAABIXyLAAAAAOElEQVRIx2NgGAWjYBSMglEwEICREYRgFBZBqDCSLA2MGPUIVQETE9iNUAqLR5gIeoQKRgwXjwAAGn4AtaFeYLEAAAAASUVORK5CYII="}};var bo={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
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

		}`};var Zl=class extends Ze{constructor(){super(),this.isOutputPass=!0,this.uniforms=Ce.clone(bo.uniforms),this.material=new Is({name:bo.name,uniforms:this.uniforms,vertexShader:bo.vertexShader,fragmentShader:bo.fragmentShader}),this._fsQuad=new Mi(this.material),this._outputColorSpace=null,this._toneMapping=null}render(t,e,i){this.uniforms.tDiffuse.value=i.texture,this.uniforms.toneMappingExposure.value=t.toneMappingExposure,(this._outputColorSpace!==t.outputColorSpace||this._toneMapping!==t.toneMapping)&&(this._outputColorSpace=t.outputColorSpace,this._toneMapping=t.toneMapping,this.material.defines={},ie.getTransfer(this._outputColorSpace)===ce&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===Xr?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===qr?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===Yr?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===Zr?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===Kr?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===Cn?this.material.defines.NEUTRAL_TONE_MAPPING="":this._toneMapping===jr&&(this.material.defines.CUSTOM_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(t.setRenderTarget(null),this._fsQuad.render(t)):(t.setRenderTarget(e),this.clear&&t.clear(t.autoClearColor,t.autoClearDepth,t.autoClearStencil),this._fsQuad.render(t))}dispose(){this.material.dispose(),this._fsQuad.dispose()}};var Kn=Math.PI/180;function _f(n,t,e,i=0){let s=23.44*Math.sin(Kn*.9863013698630136*(t-81)),r=15*(n-12),o=e*Kn,a=s*Kn,l=r*Kn,c=Math.sin(o)*Math.sin(a)+Math.cos(o)*Math.cos(a)*Math.cos(l),h=Math.asin(Math.max(-1,Math.min(1,c))),f=(Math.sin(a)-Math.sin(h)*Math.sin(o))/(Math.cos(h)*Math.cos(o)||1e-9),d=Math.acos(Math.max(-1,Math.min(1,f)));r>0&&(d=2*Math.PI-d);let u=d-i*Kn,p=[Math.sin(u)*Math.cos(h),Math.sin(h),-Math.cos(u)*Math.cos(h)];return{elevation:h/Kn,azimuth:d/Kn,dir:p}}var Zi=(n,t,e)=>n+(t-n)*e,Yi=(n,t,e)=>[Zi(n[0],t[0],e),Zi(n[1],t[1],e),Zi(n[2],t[2],e)],an=n=>Math.max(0,Math.min(1,n));function qh(n,t="clear"){let e=n,i=an((e+6)/18),s=an(1-Math.abs(e-8)/14),r=an((-e-4)/8),o=t==="overcast"?1:t==="hazy"?.45:0,a=Yi(Yi([1,.96,.9],[1,.72,.42],s),[.85,.87,.92],o),l=i*Zi(3.4,.9,o)*(1-r),c=Yi(Yi([.05,.08,.16],[.36,.56,.92],i),[.62,.66,.72],o),h=Yi(Yi([.1,.12,.2],Yi([.68,.79,.93],[.98,.72,.5],s),i),[.78,.8,.84],o),f=Yi(Yi([.16,.2,.34],[.78,.86,1],i),[.78,.8,.84],o),d=Yi([.05,.06,.08],[.45,.42,.38],i),u=Zi(.35,Zi(1.6,2.2,o),i),p=Zi(.95,1.05,i),x=r*.35;return{day:i,night:r,golden:s,overcast:o,sunColor:a,sunIntensity:l,skyTop:c,skyHorizon:h,hemiSky:f,hemiGround:d,hemiIntensity:u,exposure:p,moon:x,turbidity:Zi(3,12,o),rayleigh:Zi(2.2,.8,o),mie:Zi(.005,.02,o)}}var jl=n=>Math.round(an(n[0])*255)<<16|Math.round(an(n[1])*255)<<8|Math.round(an(n[2])*255),Kl=n=>`rgb(${Math.round(an(n[0])*255)}, ${Math.round(an(n[1])*255)}, ${Math.round(an(n[2])*255)})`;function yf(n){let t=Math.floor(n),e=Math.round((n-t)*60)%60;return`${String(t).padStart(2,"0")}:${String(e).padStart(2,"0")}`}var I_=["\u05D9\u05E0\u05D5\u05D0\u05E8","\u05E4\u05D1\u05E8\u05D5\u05D0\u05E8","\u05DE\u05E8\u05E5","\u05D0\u05E4\u05E8\u05D9\u05DC","\u05DE\u05D0\u05D9","\u05D9\u05D5\u05E0\u05D9","\u05D9\u05D5\u05DC\u05D9","\u05D0\u05D5\u05D2\u05D5\u05E1\u05D8","\u05E1\u05E4\u05D8\u05DE\u05D1\u05E8","\u05D0\u05D5\u05E7\u05D8\u05D5\u05D1\u05E8","\u05E0\u05D5\u05D1\u05DE\u05D1\u05E8","\u05D3\u05E6\u05DE\u05D1\u05E8"];function Mf(n){let t=new Date(Date.UTC(2026,0,1)+(n-1)*864e5);return`${t.getUTCDate()} \u05D1${I_[t.getUTCMonth()]}`}var Jn=(n,t,e)=>n+(t-n)*e,Jl=class{constructor(t,e={}){this.renderer=new Cl({canvas:t,antialias:!0,powerPreference:"high-performance",preserveDrawingBuffer:!0,alpha:!0,premultipliedAlpha:!0}),this.renderer.setClearColor(0,0),this.renderer.shadowMap.enabled=!0,this.renderer.shadowMap.type=Tn,this.renderer.shadowMap.autoUpdate=!1,this.renderer.shadowMap.needsUpdate=!0,this.renderer.toneMapping=Cn,this.renderer.outputColorSpace=De,this.renderer.localClippingEnabled=!0,this.dpr=Math.min(e.maxDpr??2,window.devicePixelRatio||1),this.renderer.setPixelRatio(this.dpr),this.scene=new Es,this.style=ai.light;let i=new yn(400,48,24),s=new Float32Array(i.attributes.position.count*3);i.setAttribute("color",new Ue(s,3)),this.dome=new Wt(i,new Oe({vertexColors:!0,side:Ye,toneMapped:!1,fog:!1,depthWrite:!1})),this.dome.frustumCulled=!1,this.dome.renderOrder=-10,this.dome.userData={kind:"sky"},this.scene.add(this.dome),this.domeScene=new Es,this.domeScene.add(new Wt(i,this.dome.material)),this.sun=new Ds(16777215,3),this.sun.castShadow=!0,this.sun.shadow.mapSize.set(2048,2048),this.sun.shadow.bias=-4e-4,this.sun.shadow.normalBias=.025,this.sun.shadow.radius=5,this.scene.add(this.sun),this.scene.add(this.sun.target),this.hemi=new Ur(16777215,4478310,1.5),this.scene.add(this.hemi),this.ambient=new kr(16777215,0),this.scene.add(this.ambient),this.moon=new Ds(12570879,0),this.scene.add(this.moon),this.pmrem=new Vs(this.renderer),this.pmrem.compileCubemapShader(),this.envTarget=null,this.quality=3,this.composer=null,this.time={hour:15.5,day:278,latitude:32.08,north:0,weather:"clear"},this.recipe=qh(40,"clear"),this.fitted=null,this.post={ao:!0,bloom:!0,lite:!1,msaa:!0},this.size={w:1,h:1},this.interior=!1,this.interiorFill=1,this.isWebGL2=this.renderer.capabilities.isWebGL2}rendererName(){let t=this.renderer.getContext(),e=t.getExtension("WEBGL_debug_renderer_info");return e?t.getParameter(e.UNMASKED_RENDERER_WEBGL):t.getParameter(t.RENDERER)}setStyle(t){this.style=t,this.applyTime()}setSize(t,e){this.size={w:t,h:e},this.renderer.setSize(t,e,!1),this.composer&&(this.composer.setSize(t,e),this.gtao&&this.gtao.setSize(t,e))}fitShadows(t,e){this.fitted={extent:t,top:e};let i=this.sun.shadow.camera,s=t.maxX-t.minX,r=t.maxZ-t.minZ,o=Math.hypot(s,r)/2+4;i.left=-o,i.right=o,i.top=o,i.bottom=-o,i.near=.5,i.far=o*4+20,i.updateProjectionMatrix(),this.centre=new D((t.minX+t.maxX)/2,e/2,(t.minZ+t.maxZ)/2),this.sun.target.position.copy(this.centre),this.moon.target=this.sun.target,this.applyTime()}setQuality(t,e){this.quality=t,this.renderer.shadowMap.enabled=t>=2,this.renderer.shadowMap.type=Tn,this.renderer.shadowMap.needsUpdate=!0,this.sun.castShadow=t>=2,this.sun.shadow.radius=t>=3?5:1,this.sun.shadow.blurSamples=12,this.sun.shadow.mapSize.set(t>=3?2048:1024,t>=3?2048:1024),this.sun.shadow.map&&(this.sun.shadow.map.dispose(),this.sun.shadow.map=null),this.scene.environment=t>=3?this.envTarget&&this.envTarget.texture:null,this.scene.background=null,this.renderer.toneMapping=t>=2?Cn:pi,this.buildComposer(e),this.applyTime()}buildComposer(t){if(this.composer&&(this.composer.dispose&&this.composer.dispose(),this.composer=null,this.gtao=null,this.bloom=null,this.smaa=null),this.quality<3)return;let{w:e,h:i}=this.size,s=this.post.msaa&&this.isWebGL2,r=new he(Math.round(e*this.dpr),Math.round(i*this.dpr),{type:ve,samples:s?4:0}),o=new Vl(this.renderer,r);o.setPixelRatio(this.dpr),o.setSize(e,i);let a=new Gl(this.scene,t);if(a.clearAlpha=0,o.addPass(a),this.post.ao&&!this.post.lite){let l=new Zs(this.scene,t,e,i);l.output=Zs.OUTPUT.Default,l.updateGtaoMaterial({radius:this.style.post.aoRadius,distanceExponent:1,thickness:1,distanceFallOff:1,scale:.9,samples:8}),l.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:4,rings:2,samples:6}),l.blendIntensity=this.style.post.aoIntensity,o.addPass(l),this.gtao=l}if(this.post.bloom){let l=new js(new tt(e,i),.2,this.style.post.bloomRadius,2);o.addPass(l),this.bloom=l}if(o.addPass(new Zl),!s){let l=new Yl;o.addPass(l),this.smaa=l}this.composer=o,this.camera=t,this.applyPost()}setCamera(t){if(this.camera=t,this.composer){for(let e of this.composer.passes)"camera"in e&&(e.camera=t);this.gtao&&(this.gtao.camera=t)}}setTime(t){Object.assign(this.time,t),this.applyTime()}applyFill(){let t=this.style.rig,e=this.recipe,i=this.quality>=3,s=this.interior?Jn(t.interiorFill[0],t.interiorFill[1],this.interiorFill)*.7:1;this.hemi.intensity=(this.quality>=2?e.hemiIntensity*(i?t.hemiScale:1)*(i?1:t.skyScale):1.2)*s,i&&(this.scene.environmentIntensity=Jn(t.envNight,t.envDay,e.day)*s)}applyPost(){let t=this.recipe,e=this.style.post;this.bloom&&(this.bloom.threshold=Jn(e.bloomThresholdDay,e.bloomThresholdNight,t.night),this.bloom.strength=Jn(e.bloomStrengthDay,e.bloomStrengthNight,t.night),this.bloom.radius=e.bloomRadius)}applyTime(){let t=this.time,e=this.style.rig,i=_f(t.hour,t.day,t.latitude,t.north),s=qh(i.elevation,t.weather);this.recipe=s,this.sunInfo=i;let r=new D(i.dir[0],Math.max(i.dir[1],-.2),i.dir[2]).normalize(),o=this.centre||new D,a=this.fitted?Math.hypot(this.fitted.extent.maxX-this.fitted.extent.minX,this.fitted.extent.maxZ-this.fitted.extent.minZ):20;this.sun.position.copy(o).addScaledVector(r,a*1.5);let l=this.quality>=3,c=this.interior?Jn(e.interiorFill[0],e.interiorFill[1],this.interiorFill)*.7:1;this.sun.intensity=this.quality>=2?s.sunIntensity*(l?.55:1)*e.sunScale:1.1,this.sun.color.setHex(jl(s.sunColor)),this.sun.visible=i.elevation>-3||this.quality<2,this.moon.intensity=s.moon*e.moonScale,this.moon.position.copy(o).add(new D(-a,a*.9,a*.4)),this.hemi.color.setHex(jl(s.hemiSky)),this.hemi.groundColor.setHex(jl(s.hemiGround)),this.hemi.intensity=(this.quality>=2?s.hemiIntensity*(l?e.hemiScale:1)*(l?1:e.skyScale):1.2)*c,this.ambient.intensity=this.quality>=2?0:.9,this.renderer.toneMappingExposure=s.exposure*Jn(e.exposureDay,e.exposureNight,s.night)*(l?1:1.1)*(this.interior?1.05:1),this.renderer.shadowMap.needsUpdate=!0,this.applyPost();let h=this.style.backdrop;if(this.backdrop){let f=s.night>.5?h.topNight:h.topDay,d=s.night>.5?h.horizonNight:h.horizonDay,u=(m,g,b)=>`color-mix(in srgb, ${m} ${Math.round((1-b)*100)}%, ${g})`,p=u(f,Kl(s.skyTop.map(m=>m*e.skyScale)),.5),x=u(d,Kl(s.skyHorizon.map(m=>m*e.skyScale)),.5);this.backdrop.style.background=`linear-gradient(180deg, ${p} 0%, ${x} 62%, ${Kl(s.hemiGround.map(m=>m*h.groundTint*.9+.08))} 100%)`}this.paintDome(s,r),this.quality>=3&&(this.envTarget&&this.envTarget.dispose(),this.envTarget=this.pmrem.fromScene(this.domeScene,0,1,1e3),this.scene.environment=this.envTarget.texture,this.scene.environmentIntensity=Jn(e.envNight,e.envDay,s.day)*c),this.onTime&&this.onTime(i,s)}paintDome(t,e){let i=this.dome.geometry,s=i.attributes.position,r=i.attributes.color,o=new D,a=this.style.rig.skyScale,l=t.hemiGround.map(c=>(c*.9+.1)*this.style.backdrop.groundTint);for(let c=0;c<s.count;c++){o.fromBufferAttribute(s,c).normalize();let h=o.y,f;if(h<0)f=l;else{let p=Math.pow(h,.55);f=[(t.skyHorizon[0]+(t.skyTop[0]-t.skyHorizon[0])*p)*a,(t.skyHorizon[1]+(t.skyTop[1]-t.skyHorizon[1])*p)*a,(t.skyHorizon[2]+(t.skyTop[2]-t.skyHorizon[2])*p)*a]}let d=Math.max(0,o.dot(e)),u=e.y>-.05?Math.pow(d,400)*.9+Math.pow(d,12)*.18*t.day:0;r.setXYZ(c,Math.min(1,f[0]+u*t.sunColor[0]),Math.min(1,f[1]+u*t.sunColor[1]),Math.min(1,f[2]+u*t.sunColor[2]))}r.needsUpdate=!0,this.dome.visible=this.quality>=2}render(t){this.composer&&this.quality>=3?(this.camera!==t&&this.setCamera(t),this.composer.render()):this.renderer.render(this.scene,t)}};var Ql=class{constructor(t){this.scene=t,this.x=0,this.z=0,this.yaw=0,this.pitch=0,this.level=Object.keys(t.levels)[0],this.eye=1.65,this.onStairs=null,this.path=null,this.input={fwd:0,strafe:0,run:!1,turn:0},this.onLevelChange=null,this.edge=!1,this.lastMoveTime=0}placeAt(t,e,i,s){this.x=t,this.z=e,this.yaw=i*Math.PI/180,this.pitch=0,s&&s!==this.level&&(this.level=s,this.onLevelChange&&this.onLevelChange(s)),this.path=null,this.onStairs=null}ground(t,e,i){let s=this.scene.levels[i];for(let r of s.stairs){let o=t-r.a[0],a=e-r.a[1],l=o*r.dx+a*r.dz;if(Math.abs(-o*r.dz+a*r.dx)<=r.width/2&&l>=-.05&&l<=r.run+.05){let h=Math.max(0,Math.min(1,l/r.run));return{y:r.elevFrom+(r.elevTo-r.elevFrom)*h,stair:r,along:l,f:h}}}return{y:s.elevation,stair:null}}segmentsFor(t,e="all"){let i=this.scene.levels[t],s=e==="stairs"?[]:i.segs.slice();for(let r of i.stairs){let o=-r.dz,a=r.dx;for(let l of[-1,1]){let c=o*l*(r.width/2),h=a*l*(r.width/2);s.push({a:[r.a[0]+c-r.dx*0,r.a[1]+h],b:[r.b[0]+c,r.b[1]+h],w:0,kind:"stair-side",id:"stair"})}}return s}collide(t,e,i,s="all"){let r=this.segmentsFor(i,s);for(let o=0;o<3;o++){let a=!1;for(let l of r){let c=.28+(l.w||0)/2,h=l.b[0]-l.a[0],f=l.b[1]-l.a[1],d=h*h+f*f,u=d>0?Math.max(0,Math.min(1,((t-l.a[0])*h+(e-l.a[1])*f)/d)):0,p=l.a[0]+u*h,x=l.a[1]+u*f,m=t-p,g=e-x,b=Math.hypot(m,g);if(b<c){if(b<1e-6){m=-f,g=h;let T=Math.hypot(m,g)||1;m/=T,g/=T}else m/=b,g/=b;t=p+m*(c+.001),e=x+g*(c+.001),a=!0}}if(!a)break}return[t,e]}step(t){let e=this.input,i=!1;e.turn&&(this.yaw+=e.turn*t*2.2,i=!0);let s=e.fwd,r=e.strafe;if(this.path&&this.path.length){let[o,a]=this.path[0],l=o-this.x,c=a-this.z;if(Math.hypot(l,c)<.15)this.path.shift(),this.path.length||(this.path=null);else{let d=Math.atan2(-l,-c)-this.yaw;for(;d>Math.PI;)d-=2*Math.PI;for(;d<-Math.PI;)d+=2*Math.PI;this.yaw+=Math.sign(d)*Math.min(Math.abs(d),t*3.5),s=Math.abs(d)<.6?1:.2,r=0}}if(s||r){let o=e.run?2.8:1.4,a=Math.sin(this.yaw),l=Math.cos(this.yaw),c=-a,h=-l,f=l,d=-a,u=this.x+(c*s+f*r)*o*t,p=this.z+(h*s+d*r)*o*t,x=this.ground(this.x,this.z,this.level).stair&&this.ground(u,p,this.level).stair;[u,p]=this.collide(u,p,this.level,x?"stairs":"all");let m=this.scene.levels[this.level];if(m.extent){let b=m.extent,T=Math.max(b.minX+.3,Math.min(b.maxX-.3,u)),v=Math.max(b.minZ+.3,Math.min(b.maxZ-.3,p));this.edge=T!==u||v!==p,u=T,p=v}(Math.abs(u-this.x)>1e-5||Math.abs(p-this.z)>1e-5)&&(i=!0),this.x=u,this.z=p;let g=this.ground(this.x,this.z,this.level);if(g.stair){this.onStairs=g.stair;let b=g.stair;g.along>b.run-.02&&this.level===b.from?this.switchLevel(b.to):g.along<.02&&this.level===b.to&&this.switchLevel(b.from)}else this.onStairs=null}return i}switchLevel(t){!this.scene.levels[t]||t===this.level||(this.level=t,this.onLevelChange&&this.onLevelChange(t))}eyeY(){return this.ground(this.x,this.z,this.level).y+this.eye}applyTo(t){t.position.set(this.x,this.eyeY(),this.z),t.rotation.order="YXZ",t.rotation.set(this.pitch,this.yaw,0)}look(t,e){this.yaw-=t,this.pitch=Math.max(-1.2,Math.min(1.2,this.pitch-e))}pathTo(t,e){let i=this.scene.levels[this.level];if(!i.extent)return null;let s=i.extent,r=Math.ceil((s.maxX-s.minX)/.25),o=Math.ceil((s.maxZ-s.minZ)/.25),a=this.segmentsFor(this.level),l=new Uint8Array(r*o),c=.28*.85;for(let M=0;M<o;M++)for(let E=0;E<r;E++){let R=s.minX+(E+.5)*.25,N=s.minZ+(M+.5)*.25;for(let O of a){let F=c+(O.w||0)/2,V=O.b[0]-O.a[0],k=O.b[1]-O.a[1],W=V*V+k*k,j=W>0?Math.max(0,Math.min(1,((R-O.a[0])*V+(N-O.a[1])*k)/W)):0;if(Math.hypot(R-(O.a[0]+j*V),N-(O.a[1]+j*k))<F){l[M*r+E]=1;break}}}let h=(M,E)=>[Math.max(0,Math.min(r-1,Math.floor((M-s.minX)/.25))),Math.max(0,Math.min(o-1,Math.floor((E-s.minZ)/.25)))],[f,d]=h(this.x,this.z),[u,p]=h(t,e);if(l[p*r+u]){let M=null;for(let E=-3;E<=3;E++)for(let R=-3;R<=3;R++){let N=u+R,O=p+E;if(N<0||O<0||N>=r||O>=o||l[O*r+N])continue;let F=R*R+E*E;(!M||F<M.d)&&(M={i:N,j:O,d:F})}if(!M)return null;u=M.i,p=M.j}let x=new Map,m=new Float32Array(r*o).fill(1/0),g=new Int32Array(r*o).fill(-1),b=(M,E)=>Math.hypot(M-u,E-p),T=d*r+f,v=p*r+u;m[T]=0,x.set(T,b(f,d));let S=new Uint8Array(r*o),C=0;for(;x.size&&C++<5e4;){let M=-1,E=1/0;for(let[O,F]of x)F<E&&(E=F,M=O);if(x.delete(M),M===v)break;S[M]=1;let R=M%r,N=Math.floor(M/r);for(let[O,F]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){let V=R+O,k=N+F;if(V<0||k<0||V>=r||k>=o)continue;let W=k*r+V;if(l[W]||S[W]||O&&F&&(l[N*r+V]||l[k*r+R]))continue;let j=m[M]+Math.hypot(O,F);j<m[W]&&(m[W]=j,g[W]=M,x.set(W,j+b(V,k)))}}if(g[v]<0&&v!==T)return null;let P=[],y=v;for(;y>=0&&y!==T;)P.push([s.minX+(y%r+.5)*.25,s.minZ+(Math.floor(y/r)+.5)*.25]),y=g[y];P.reverse(),P.push([t,e]);let A=[],U=[this.x,this.z],I=0;for(;I<P.length;){let M=I;for(let E=P.length-1;E>I;E--)if(this.lineFree(U,P[E],a)){M=E;break}A.push(P[M]),U=P[M],I=M+1}return this.path=A,A}lineFree(t,e,i){let s=[e[0]-t[0],e[1]-t[1]],r=Math.hypot(s[0],s[1]);if(r<1e-6)return!0;let o=Math.max(2,Math.ceil(r/.1));for(let a=0;a<=o;a++){let l=t[0]+s[0]*a/o,c=t[1]+s[1]*a/o;for(let h of i){let f=.22400000000000003+(h.w||0)/2,d=h.b[0]-h.a[0],u=h.b[1]-h.a[1],p=d*d+u*u,x=p>0?Math.max(0,Math.min(1,((l-h.a[0])*d+(c-h.a[1])*u)/p)):0;if(Math.hypot(l-(h.a[0]+x*d),c-(h.a[1]+x*u))<f)return!1}}return!0}};function bf(n,t,e,i={}){let s=n.getContext("2d"),r=t.levels[e.level],o=n.width;if(s.clearRect(0,0,o,o),!r||!r.extent)return;let a=r.extent,l=a.maxX-a.minX,c=a.maxZ-a.minZ,h=(o-12)/Math.max(l,c),f=m=>6+(m-a.minX)*h+(o-12-l*h)/2,d=m=>6+(m-a.minZ)*h+(o-12-c*h)/2;s.fillStyle=i.bg||"rgba(255,255,255,0.92)",s.beginPath(),s.roundRect(0,0,o,o,10),s.fill();for(let m of r.zones){s.beginPath(),m.polyM.forEach(([b,T],v)=>v?s.lineTo(f(b),d(T)):s.moveTo(f(b),d(T))),s.closePath();let g=m.x_proto&&m.x_proto.light&&t.plan.entities[m.x_proto.light]==="on";s.fillStyle=g?"rgba(255,200,87,0.35)":"rgba(39,103,237,0.06)",s.fill()}s.lineWidth=2;for(let m of r.segs)s.strokeStyle=m.kind==="window"?"#7fb2ff":m.kind==="door"||m.kind==="door-locked"?"#ef4444":m.kind==="object"?"rgba(90,100,120,0.35)":m.kind==="railing"||m.kind==="low"?"#9aa3b5":"#56617a",s.lineWidth=m.kind==="object"?1:m.kind==="exterior"?3:2,s.beginPath(),s.moveTo(f(m.a[0]),d(m.a[1])),s.lineTo(f(m.b[0]),d(m.b[1])),s.stroke();for(let m of r.stairs){s.strokeStyle="#6b7f99",s.lineWidth=1;let g=8;for(let b=0;b<=g;b++){let T=b/g,v=m.a[0]+m.dx*m.run*T,S=m.a[1]+m.dz*m.run*T;s.beginPath(),s.moveTo(f(v-m.dz*m.width/2),d(S+m.dx*m.width/2)),s.lineTo(f(v+m.dz*m.width/2),d(S-m.dx*m.width/2)),s.stroke()}}if(e.path){s.strokeStyle="#22c55e",s.lineWidth=2,s.setLineDash([3,3]),s.beginPath(),s.moveTo(f(e.x),d(e.z));for(let[m,g]of e.path)s.lineTo(f(m),d(g));s.stroke(),s.setLineDash([])}let u=f(e.x),p=d(e.z),x=Math.atan2(-Math.sin(e.yaw),-Math.cos(e.yaw));return s.fillStyle="rgba(39,103,237,0.25)",s.beginPath(),s.moveTo(u,p),s.arc(u,p,22,x-.5,x+.5),s.closePath(),s.fill(),s.fillStyle="#2767ed",s.beginPath(),s.arc(u,p,4,0,Math.PI*2),s.fill(),s.strokeStyle="#fff",s.lineWidth=1.5,s.stroke(),{X:f,Z:d,k:h,ex:a,invert:(m,g)=>[a.minX+(m-6-(o-12-l*h)/2)/h,a.minZ+(g-6-(o-12-c*h)/2)/h]}}var $l=class{constructor(t,e){this.env=t,this.scene=e,this.sets={}}snapshot(t,e,i){let s=this.env,r=s.size;s.setSize(e,i),t.isPerspectiveCamera&&(t.aspect=e/i),t.updateProjectionMatrix(),s.render(t);let o=this.compose(s.renderer.domElement,e,i);return s.setSize(r.w,r.h),o}compose(t,e,i){let s=document.createElement("canvas");s.width=e,s.height=i;let r=s.getContext("2d"),o=this.env.recipe,a=r.createLinearGradient(0,0,0,i),l=c=>`rgb(${Math.round(c[0]*255)}, ${Math.round(c[1]*255)}, ${Math.round(c[2]*255)})`;return a.addColorStop(0,l(o.skyTop)),a.addColorStop(.7,l(o.skyHorizon)),a.addColorStop(1,l(o.hemiGround.map(c=>c*.9+.1))),r.fillStyle=a,r.fillRect(0,0,e,i),r.drawImage(t,0,0,e,i),s.toDataURL("image/jpeg",.9)}thumbnail(t,e,i){let s=this.env,r=s.renderer;(!this._rt||this._rt.width!==e||this._rt.height!==i)&&(this._rt&&this._rt.dispose(),this._rt=new he(e,i,{samples:0}));let o=r.getRenderTarget();r.setRenderTarget(this._rt),r.render(s.scene,t);let a=new Uint8Array(e*i*4);r.readRenderTargetPixels(this._rt,0,0,e,i,a),r.setRenderTarget(o);let l=document.createElement("canvas");l.width=e,l.height=i;let c=l.getContext("2d"),h=c.createImageData(e,i);for(let f=0;f<i;f++)h.data.set(a.subarray((i-1-f)*e*4,(i-f)*e*4),f*e*4);return c.putImageData(h,0,0),this.compose(l,e,i)}project(t,e,i,s){let r=e.clone().project(t);return[(r.x+1)/2*i,(1-r.y)/2*s]}async bake(t,e,i,s,r,o){let a=this.scene.levels[t],l={w:i,h:s,pics:{},masks:[],doors:[],cams:[]};for(let c of["day_off","day_on","night_off","night_on"])r(c),await new Promise(h=>requestAnimationFrame(h)),l.pics[c]=this.snapshot(e,i,s);e.aspect=i/s,e.updateProjectionMatrix(),e.updateMatrixWorld();for(let c of a.zones){let h=c.polyM.map(([d,u])=>this.project(e,new D(d,a.elevation+.02,u),i,s)),f=c.polyM.map(([d,u])=>this.project(e,new D(d,a.elevation+a.ceiling*.55,u),i,s));l.masks.push({zone:c.id,name:c.name,light:c.x_proto&&c.x_proto.light,presence:c.x_proto&&c.x_proto.presence,temp:c.x_proto&&c.x_proto.temp,floor:h,top:f,centre:this.project(e,new D(...D_(c.polyM,a.elevation+1.2)),i,s)})}for(let c of o||[]){let h=c.points.map(f=>this.project(e,f,i,s));l.doors.push({entity:c.entity,points:h})}for(let c of this.scene.cameras.filter(h=>h.level===t))l.cams.push({id:c.id,label:c.label,p:this.project(e,new D(c.pos[0],a.elevation+c.mount,c.pos[1]),i,s)});return this.sets[t]=l,l}};function D_(n,t){let e=0,i=0,s=0;for(let r=0;r<n.length;r++){let[o,a]=n[r],[l,c]=n[(r+1)%n.length],h=o*c-l*a;e+=h,i+=(o+l)*h,s+=(a+c)*h}return Math.abs(e)<1e-9?[n[0][0],t,n[0][1]]:[i/(3*e),t,s/(3*e)]}var Dn="http://www.w3.org/2000/svg";function wf(n,t,e){if(n.innerHTML="",!t){n.innerHTML='<div class="stills-empty">\u05D0\u05D9\u05DF \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DE\u05D5\u05DB\u05E0\u05D5\u05EA \u05DC\u05E7\u05D5\u05DE\u05D4 \u05D6\u05D5 \u2014 \u05DC\u05D7\u05E5 "\u05D4\u05DB\u05DF \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA" \u05D1\u05DC\u05E9\u05D5\u05E0\u05D9\u05EA \u05D4\u05D0\u05D9\u05DB\u05D5\u05EA</div>';return}let i=e.night,s=t.pics[i?"night_off":"day_off"],r=t.pics[i?"night_on":"day_on"],o=document.createElementNS(Dn,"svg");o.setAttribute("viewBox",`0 0 ${t.w} ${t.h}`),o.setAttribute("preserveAspectRatio","xMidYMid meet"),o.classList.add("stills-svg");let a=document.createElementNS(Dn,"defs");o.appendChild(a);let l=d=>{let u=document.createElementNS(Dn,"image");return u.setAttribute("href",d),u.setAttribute("width",t.w),u.setAttribute("height",t.h),u.setAttribute("preserveAspectRatio","none"),u};o.appendChild(l(s));let c=d=>d.map(u=>`${u[0].toFixed(1)},${u[1].toFixed(1)}`).join(" "),h=d=>Sf([...d.floor,...d.top]);for(let d of t.masks){if(!(d.light&&e.entities[d.light]==="on"))continue;let p=document.createElementNS(Dn,"clipPath");p.setAttribute("id",`mask-${d.zone}`);let x=document.createElementNS(Dn,"polygon");x.setAttribute("points",c(h(d))),p.appendChild(x),a.appendChild(p);let m=l(r);m.setAttribute("clip-path",`url(#mask-${d.zone})`),m.classList.add("stills-lit"),o.appendChild(m)}for(let d of t.masks)if(d.presence&&e.entities[d.presence]==="on"){let p=document.createElementNS(Dn,"polygon");p.setAttribute("points",c(d.floor)),p.setAttribute("class","stills-presence"),o.appendChild(p)}for(let d of t.doors){if(e.entities[d.entity]!=="on"&&e.entities[d.entity]!=="open")continue;let u=document.createElementNS(Dn,"polygon");u.setAttribute("points",c(Sf(d.points))),u.setAttribute("class","stills-door"),o.appendChild(u)}for(let d of t.cams){let u=document.createElementNS(Dn,"circle");u.setAttribute("cx",d.p[0]),u.setAttribute("cy",d.p[1]),u.setAttribute("r",6),u.setAttribute("class","stills-cam"),o.appendChild(u)}n.appendChild(o);let f=document.createElement("div");f.className="stills-chips";for(let d of t.masks){if(typeof d.temp!="number")continue;let u=document.createElement("span");u.className="chipT",u.textContent=`${d.temp.toFixed(1)}\xB0`,u.style.left=`${d.centre[0]/t.w*100}%`,u.style.top=`${d.centre[1]/t.h*100}%`,f.appendChild(u)}n.appendChild(f),requestAnimationFrame(()=>{let d=n.getBoundingClientRect(),u=Math.min(d.width/t.w,d.height/t.h),p=t.w*u,x=t.h*u;f.style.width=`${p}px`,f.style.height=`${x}px`,f.style.left=`${(d.width-p)/2}px`,f.style.top=`${(d.height-x)/2}px`})}function Sf(n){let t=n.slice().sort((r,o)=>r[0]-o[0]||r[1]-o[1]);if(t.length<3)return t;let e=(r,o,a)=>(o[0]-r[0])*(a[1]-r[1])-(o[1]-r[1])*(a[0]-r[0]),i=[];for(let r of t){for(;i.length>=2&&e(i[i.length-2],i[i.length-1],r)<=0;)i.pop();i.push(r)}let s=[];for(let r=t.length-1;r>=0;r--){let o=t[r];for(;s.length>=2&&e(s[s.length-2],s[s.length-1],o)<=0;)s.pop();s.push(o)}return s.pop(),i.pop(),i.concat(s)}var Ef=n=>n/.012,bi=(n,t)=>[+(Ef(n)/1e3).toFixed(6),+(Ef(t)/900).toFixed(6)];function N_(n,t){let e={t:0,d:1/0},i=0,s=0;for(let r=0;r<n.length-1;r++)s+=Math.hypot(n[r+1][0]-n[r][0],n[r+1][1]-n[r][1]);for(let r=0;r<n.length-1;r++){let[o,a]=n[r],l=n[r+1][0]-o,c=n[r+1][1]-a,h=l*l+c*c,f=h>0?Math.max(0,Math.min(1,((t[0]-o)*l+(t[1]-a)*c)/h)):0,d=Math.hypot(t[0]-(o+f*l),t[1]-(a+f*c));d<e.d&&(e={t:(i+f*Math.sqrt(h))/s,d}),i+=Math.sqrt(h)}return+e.t.toFixed(5)}var Tf=[{id:"g-out",level:"L0",kind:"exterior",t:.3,pts:[[.5,.5],[11.5,.5],[11.5,10.3],[.5,10.3],[.5,.5]]},{id:"g-w1",level:"L0",kind:"interior",t:.12,pts:[[3.5,.5],[3.5,10.3]]},{id:"g-w2",level:"L0",kind:"interior",t:.12,pts:[[.5,3.5],[3.5,3.5]]},{id:"g-w3",level:"L0",kind:"railing",t:.05,h:1,pts:[[2,3.9],[2,7.5]]},{id:"g-w5",level:"L0",kind:"interior",t:.12,pts:[[3.5,6],[11.5,6]]},{id:"g-w6",level:"L0",kind:"interior",t:.12,pts:[[7.5,6],[7.5,10.3]]},{id:"g-w7",level:"L0",kind:"interior",t:.12,pts:[[.5,7.5],[3.5,7.5]]},{id:"g-w8",level:"L0",kind:"interior",t:.1,pts:[[2,7.5],[2,10.3]]},{id:"u-out",level:"L1",kind:"exterior",t:.3,pts:[[.5,.5],[11.5,.5],[11.5,7.5],[.5,7.5],[.5,.5]]},{id:"u-w1",level:"L1",kind:"interior",t:.12,pts:[[3.5,.5],[3.5,7.5]]},{id:"u-w2",level:"L1",kind:"interior",t:.12,pts:[[3.5,4],[11.5,4]]},{id:"u-w3",level:"L1",kind:"interior",t:.12,pts:[[8,.5],[8,4]]},{id:"u-w4",level:"L1",kind:"interior",t:.12,pts:[[3.5,5.2],[11.5,5.2]]},{id:"u-w5",level:"L1",kind:"interior",t:.12,pts:[[6.5,5.2],[6.5,7.5]]},{id:"u-rail",level:"L1",kind:"railing",t:.05,h:1,pts:[[2,3.9],[2,7.2],[.5,7.2]]}],U_=[["front","g-out",[.5,2.2],"door",1,2.1,0,"right","end","binary_sensor.front_door"],["win-hall","g-out",[.5,1.2],"window",.8,1.2,.9],["win-liv-n1","g-out",[5.5,.5],"window",1.4,1.4,.9],["win-liv-n2","g-out",[7.5,.5],"window",1.4,1.4,.9],["win-liv-n3","g-out",[9.5,.5],"window",1.4,1.4,.9],["win-liv-e","g-out",[11.5,3.2],"window",2.6,2.3,.1,"none","start",null,"cover.living_terrace"],["win-kit-e","g-out",[11.5,8.2],"window",1.2,1.2,1],["win-kit-s","g-out",[9.5,10.3],"window",1.4,1.2,1],["win-off-s","g-out",[5.5,10.3],"window",1.6,1.4,.9,"none","start",null,"cover.office"],["win-wc-w","g-out",[.5,9],"window",.6,.6,1.5],["d-hall-liv","g-w1",[3.5,2],"door",1.6,2.1,0,"double","start","binary_sensor.hall_living_door"],["d-corr-liv","g-w1",[3.5,4.8],"door",.9,2.1,0,"left","start",null],["d-corr-off","g-w1",[3.5,6.9],"door",.9,2.1,0,"right","end","binary_sensor.office_door"],["p-hall-corr","g-w2",[2.7,3.5],"passage",1.4,2.1,0],["d-liv-off","g-w5",[5.5,6],"door",.9,2.1,0,"right","start",null],["d-liv-kit","g-w5",[9.5,6],"door",1.8,2.1,0,"sliding","start","binary_sensor.kitchen_door"],["d-off-kit","g-w6",[7.5,8.2],"door",.8,2.1,0,"left","end",null],["d-wc","g-w7",[1.25,7.5],"door",.8,2.1,0,"right","end","binary_sensor.wc_door"],["d-util","g-w7",[2.75,7.5],"door",.8,2.1,0,"left","start",null],["uw-n1","u-out",[5.7,.5],"window",1.4,1.4,.9,"none","start",null,"cover.bedroom1"],["uw-n2","u-out",[9.7,.5],"window",1.4,1.4,.9,"none","start",null,"cover.bedroom2"],["uw-e1","u-out",[11.5,2.2],"window",1.2,1.4,.9],["uw-e2","u-out",[11.5,6.3],"window",1.2,1.4,.9],["uw-s1","u-out",[5,7.5],"window",.8,.8,1.5],["uw-s2","u-out",[9,7.5],"window",1.6,1.4,.9,"none","start",null,"cover.bedroom3"],["uw-w1","u-out",[.5,1.8],"window",1.2,1.4,.9],["up-hall","u-w1",[3.5,4.6],"passage",1.2,2.1,0],["ud-bed1","u-w2",[5.5,4],"door",.9,2.1,0,"left","start","binary_sensor.bedroom1_door"],["ud-bed2","u-w2",[9.5,4],"door",.9,2.1,0,"right","end",null],["ud-bath","u-w4",[4.6,5.2],"door",.8,2.1,0,"right","start","binary_sensor.bath_door"],["ud-bed3","u-w4",[8.8,5.2],"door",.9,2.1,0,"left","end",null]],Af=[{id:"r-hall",level:"L0",name:"\u05DB\u05E0\u05D9\u05E1\u05D4",poly:[[.5,.5],[3.5,.5],[3.5,3.5],[.5,3.5]],floor:"tiles_grey",light:"light.hall",temp:23.4},{id:"r-stair",level:"L0",name:"\u05D7\u05D3\u05E8 \u05DE\u05D3\u05E8\u05D2\u05D5\u05EA",poly:[[.5,3.5],[2,3.5],[2,7.5],[.5,7.5]],floor:"tiles_grey",light:"light.stairs",temp:23},{id:"r-corr",level:"L0",name:"\u05DE\u05E1\u05D3\u05E8\u05D5\u05DF",poly:[[2,3.5],[3.5,3.5],[3.5,7.5],[2,7.5]],floor:"tiles_grey",light:"light.corridor",temp:23.1},{id:"r-living",level:"L0",name:"\u05E1\u05DC\u05D5\u05DF",poly:[[3.5,.5],[11.5,.5],[11.5,6],[3.5,6]],floor:"oak",light:"light.living",temp:24.2,presence:"binary_sensor.motion_living"},{id:"r-kitchen",level:"L0",name:"\u05DE\u05D8\u05D1\u05D7",poly:[[7.5,6],[11.5,6],[11.5,10.3],[7.5,10.3]],floor:"tiles_white",light:"light.kitchen",temp:25.1},{id:"r-office",level:"L0",name:"\u05D7\u05D3\u05E8 \u05E2\u05D1\u05D5\u05D3\u05D4",poly:[[3.5,6],[7.5,6],[7.5,10.3],[3.5,10.3]],floor:"oak",light:"light.office",temp:23.8,presence:"binary_sensor.motion_office"},{id:"r-wc",level:"L0",name:"\u05E9\u05D9\u05E8\u05D5\u05EA\u05D9\u05DD",poly:[[.5,7.5],[2,7.5],[2,10.3],[.5,10.3]],floor:"tiles_white",light:"light.wc",temp:22.5},{id:"r-util",level:"L0",name:"\u05D7\u05D3\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA",poly:[[2,7.5],[3.5,7.5],[3.5,10.3],[2,10.3]],floor:"concrete",light:"light.utility",temp:22},{id:"r-uhall",level:"L1",name:"\u05D2\u05DC\u05E8\u05D9\u05D4",poly:[[.5,.5],[3.5,.5],[3.5,7.5],[2,7.5],[2,3.9],[.5,3.9]],floor:"oak",light:"light.gallery",temp:23.6},{id:"r-ucorr",level:"L1",name:"\u05DE\u05E1\u05D3\u05E8\u05D5\u05DF \u05E2\u05DC\u05D9\u05D5\u05DF",poly:[[3.5,4],[11.5,4],[11.5,5.2],[3.5,5.2]],floor:"oak",light:"light.upper_corridor",temp:23.5,presence:"binary_sensor.motion_upper"},{id:"r-bed1",level:"L1",name:"\u05D7\u05D3\u05E8 \u05E9\u05D9\u05E0\u05D4 \u05D4\u05D5\u05E8\u05D9\u05DD",poly:[[3.5,.5],[8,.5],[8,4],[3.5,4]],floor:"carpet",light:"light.bedroom1",temp:22.8},{id:"r-bed2",level:"L1",name:"\u05D7\u05D3\u05E8 \u05D9\u05DC\u05D3\u05D9\u05DD",poly:[[8,.5],[11.5,.5],[11.5,4],[8,4]],floor:"carpet",light:"light.bedroom2",temp:23.2},{id:"r-bath",level:"L1",name:"\u05D0\u05DE\u05D1\u05D8\u05D9\u05D4",poly:[[3.5,5.2],[6.5,5.2],[6.5,7.5],[3.5,7.5]],floor:"tiles_white",light:"light.bath",temp:24.5},{id:"r-bed3",level:"L1",name:"\u05D7\u05D3\u05E8 \u05D0\u05D5\u05E8\u05D7\u05D9\u05DD",poly:[[6.5,5.2],[11.5,5.2],[11.5,7.5],[6.5,7.5]],floor:"carpet",light:"light.bedroom3",temp:22.9}],F_=[["sofa","sofa.3seat","L0",[6.3,3.9],180,[2.3,.95,.85],0,"\u05E1\u05E4\u05D4"],["coffee","table.coffee","L0",[6.3,2.6],0,[1.1,.6,.42],0,null],["tv","cabinet.tv","L0",[6.3,.95],0,[1.8,.45,.55],0,"\u05DE\u05D6\u05E0\u05D5\u05DF \u05D8\u05DC\u05D5\u05D5\u05D9\u05D6\u05D9\u05D4"],["tvscreen","screen.tv","L0",[6.3,.78],0,[1.4,.06,.8],.9,null,"media_player.living_tv"],["dining","table.dining","L0",[9.6,3.2],0,[1.6,.9,.75],0,"\u05E9\u05D5\u05DC\u05D7\u05DF \u05D0\u05D5\u05DB\u05DC"],["dc1","chair.basic","L0",[9.1,2.5],0,[.45,.45,.9],0,null],["dc2","chair.basic","L0",[10.1,2.5],0,[.45,.45,.9],0,null],["dc3","chair.basic","L0",[9.1,3.9],180,[.45,.45,.9],0,null],["dc4","chair.basic","L0",[10.1,3.9],180,[.45,.45,.9],0,null],["plant1","plant.pot","L0",[4,5.5],0,[.5,.5,1.4],0,null],["rug","mat.rug","L0",[6.3,3.2],0,[3,2.2,.02],0,null],["lamp-liv-a","light.ceiling","L0",[6.3,2.6],0,[.5,.5,.12],2.68,null,"light.living"],["lamp-liv-b","light.ceiling","L0",[9.6,3.2],0,[.5,.5,.12],2.68,null,"light.living"],["lamp-floor","light.floor","L0",[4.1,1],0,[.35,.35,1.5],0,null,"light.living_floor"],["console","cabinet.low","L0",[2,.85],0,[1.2,.4,.8],0,"\u05E9\u05D9\u05D3\u05D4"],["lamp-hall","light.ceiling","L0",[2,2],0,[.4,.4,.1],2.7,null,"light.hall"],["lamp-corr","light.ceiling","L0",[2.75,5.5],0,[.3,.3,.1],2.7,null,"light.corridor"],["lamp-stair","light.wall","L0",[.62,5.5],90,[.18,.1,.25],2,null,"light.stairs"],["counter-a","kitchen.counter","L0",[11.2,8],0,[.6,3.6,.9],0,"\u05DE\u05E9\u05D8\u05D7 \u05E2\u05D1\u05D5\u05D3\u05D4"],["counter-b","kitchen.counter","L0",[9.4,9.95],0,[3,.6,.9],0,null],["fridge","kitchen.fridge","L0",[7.95,9.9],0,[.75,.7,1.9],0,"\u05DE\u05E7\u05E8\u05E8"],["island","kitchen.island","L0",[9.3,7.6],0,[1.6,.9,.92],0,"\u05D0\u05D9"],["lamp-kit","light.pendant","L0",[9.3,7.6],0,[.3,.3,.35],2,null,"light.kitchen"],["desk","table.desk","L0",[5.5,9.4],0,[1.6,.8,.75],0,"\u05E9\u05D5\u05DC\u05D7\u05DF \u05E2\u05D1\u05D5\u05D3\u05D4"],["dchair","chair.office","L0",[5.5,8.6],180,[.6,.6,1.1],0,null],["books","cabinet.bookcase","L0",[3.75,8],90,[1.8,.35,2.1],0,"\u05E1\u05E4\u05E8\u05D9\u05D9\u05D4"],["lamp-off","light.ceiling","L0",[5.5,8],0,[.4,.4,.1],2.7,null,"light.office"],["toilet","sanitary.wc","L0",[1.25,9.9],0,[.4,.65,.45],0,null],["basin","sanitary.basin","L0",[.75,8.2],0,[.45,.4,.85],0,null],["washer","appliance.washer","L0",[3.1,9.9],0,[.6,.6,.85],0,"\u05DE\u05DB\u05D5\u05E0\u05EA \u05DB\u05D1\u05D9\u05E1\u05D4"],["boiler","appliance.boiler","L0",[2.4,9.9],0,[.5,.5,1.2],0,null],["lamp-wc","light.ceiling","L0",[1.25,8.9],0,[.25,.25,.1],2.7,null,"light.wc"],["lamp-util","light.ceiling","L0",[2.75,8.9],0,[.25,.25,.1],2.7,null,"light.utility"],["ext1","extinguisher.co2","L0",[3.3,7.3],0,[.18,.18,.55],.9,"\u05DE\u05D8\u05E3"],["bed1","bed.double","L1",[5.75,1.6],0,[1.8,2.1,.55],0,"\u05DE\u05D9\u05D8\u05D4 \u05D6\u05D5\u05D2\u05D9\u05EA"],["ward1","cabinet.wardrobe","L1",[3.9,2.8],90,[2,.6,2.3],0,"\u05D0\u05E8\u05D5\u05DF"],["lamp-bed1","light.ceiling","L1",[5.75,2.3],0,[.4,.4,.1],2.5,null,"light.bedroom1"],["bed2","bed.single","L1",[10.7,1.6],0,[1,2,.5],0,"\u05DE\u05D9\u05D8\u05D4"],["desk2","table.desk","L1",[8.9,1],0,[1.2,.6,.75],0,null],["lamp-bed2","light.ceiling","L1",[9.75,2.3],0,[.4,.4,.1],2.5,null,"light.bedroom2"],["bed3","bed.double","L1",[9,6.4],180,[1.6,2,.55],0,null],["lamp-bed3","light.ceiling","L1",[9,6.3],0,[.4,.4,.1],2.5,null,"light.bedroom3"],["tub","sanitary.tub","L1",[4.4,7],0,[1.7,.75,.55],0,"\u05D0\u05DE\u05D1\u05D8\u05D9\u05D4"],["basin2","sanitary.basin","L1",[6.1,5.6],0,[.5,.4,.85],0,null],["toilet2","sanitary.wc","L1",[6.1,6.9],90,[.4,.65,.45],0,null],["lamp-bath","light.ceiling","L1",[5,6.3],0,[.3,.3,.1],2.5,null,"light.bath"],["lamp-uhall","light.ceiling","L1",[2,2.2],0,[.45,.45,.1],2.5,null,"light.gallery"],["lamp-ucorr","light.ceiling","L1",[7.5,4.6],0,[.3,.3,.1],2.5,null,"light.upper_corridor"],["plant2","plant.pot","L1",[3,1],0,[.45,.45,1.1],0,null],["bench","cabinet.low","L1",[1.2,1],0,[1.2,.4,.5],0,null]],O_=[{id:"cam-hall",level:"L0",p:[3.3,.7],rot:215,fov:95,r:7,mount:2.4,tilt:22,label:"\u05DE\u05E6\u05DC\u05DE\u05D4 \xB7 \u05DB\u05E0\u05D9\u05E1\u05D4",online:!0},{id:"cam-living",level:"L0",p:[11.3,5.8],rot:318,fov:100,r:10,mount:2.5,tilt:20,label:"\u05DE\u05E6\u05DC\u05DE\u05D4 \xB7 \u05E1\u05DC\u05D5\u05DF",online:!0},{id:"cam-upper",level:"L1",p:[11.3,4.3],rot:265,fov:90,r:9,mount:2.3,tilt:18,label:"\u05DE\u05E6\u05DC\u05DE\u05D4 \xB7 \u05DE\u05E1\u05D3\u05E8\u05D5\u05DF \u05E2\u05DC\u05D9\u05D5\u05DF",online:!1}],B_=[{id:"wp-front",name:"\u05D3\u05DC\u05EA \u05DB\u05E0\u05D9\u05E1\u05D4",level:"L0",p:[1.3,2.2],heading:90,is_default:!0},{id:"wp-living",name:"\u05DE\u05E8\u05DB\u05D6 \u05D4\u05E1\u05DC\u05D5\u05DF",level:"L0",p:[7,3.3],heading:0},{id:"wp-kitchen",name:"\u05DE\u05D8\u05D1\u05D7",level:"L0",p:[9,8.8],heading:300},{id:"wp-gallery",name:"\u05D2\u05DC\u05E8\u05D9\u05D4",level:"L1",p:[2.7,2],heading:180}];function k_(){let n=Tf.map(r=>({id:r.id,level_id:r.level,polyline:r.pts.map(o=>bi(o[0],o[1])),thickness_m:r.t,height_m:r.h??null,base_z_m:0,kind:r.kind,confidence:1,source:"manual",locked:!1,external_ids:{}})),t=new Map(Tf.map(r=>[r.id,r.pts])),e=U_.map(([r,o,a,l,c,h,f,d,u,p,x])=>({id:r,wall_id:o,t:N_(t.get(o),a),kind:l,width_m:c,height_m:h,sill_m:f,swing:d||"none",hinge:u||"start",anchor_ref:p?{resource_type:"ha_entity",resource_id:p}:null,confidence:1,source:"manual",external_ids:{},...x?{x_proto:{cover_entity:x,glazing:r==="uw-s1"||r==="win-wc-w"?"frosted":"clear"}}:{}})),i=F_.map(([r,o,a,l,c,h,f,d,u])=>({id:r,item_id:o,level_id:a,position:bi(l[0],l[1]),rotation_deg:c,size:{w_m:h[0],d_m:h[1],h_m:h[2]},z_m:f,params:{},label:d??null,anchor_ref:u?{resource_type:"ha_entity",resource_id:u}:null,group_id:null,confidence:1,source:"manual",locked:!1,external_ids:{}})),s=Af.map(r=>({id:r.id,level_id:r.level,ceiling_height_m:null,tags:[],x_proto:{floor_material:r.floor}}));return{schema_version:"2.0",plan_version_id:"proto-house-v1",floor_id:"proto-house",source:{sha256:"0".repeat(64),file_name:"proto-house.pdf",mime:"application/pdf",page:1},dimensions:{width_px:1e3,height_px:900,scale_m_per_px:.012,calibration:{status:"measured",method:"two_point",pairs:[{a:bi(.5,.5),b:bi(11.5,.5),metres:11}],residual_pct:0,reason:null}},transform:{rotation:0,crop:null},levels:[{id:"L0",name:"\u05E7\u05E8\u05E7\u05E2",elevation_m:0,ceiling_height_m:2.8,is_default:!0,external_ids:{}},{id:"L1",name:"\u05E7\u05D5\u05DE\u05D4 1",elevation_m:2.9,ceiling_height_m:2.6,is_default:!1,external_ids:{}}],walls:n,openings:e,rooms:s,objects:i,circuits:[{id:"k-living",name:"\u05E1\u05DC\u05D5\u05DF",switch_entity_id:"light.living",member_ids:["lamp-liv-a","lamp-liv-b"],color_token:"circuit-1",power_w:48}],connectors:[{id:"stairs-main",kind:"stairs",level_from:"L0",level_to:"L1",floor_ids:[],polyline:[bi(1.25,7.2),bi(1.25,3.9)],width_m:1,label:null,object_id:null,source:"manual",external_ids:{},shape:"straight",turn:"none",flights:[{steps:16}],landing_depth_m:null}],labels:[],groups:[],uncertain_regions:[],uncertainty:{overall:0,notes:[]},meta:{generator:"studio6-prototype",tokens_version:"map-1",detector_version:null},floor_height_m:2.9,x_proto:{north_deg:12,latitude:32.08,longitude:34.78,walk_positions:B_.map(r=>({id:r.id,name:r.name,level_id:r.level,x:bi(r.p[0],r.p[1])[0],y:bi(r.p[0],r.p[1])[1],heading_deg:r.heading,is_default:!!r.is_default}))}}}var Cf={id:"demo-house",title:"\u05D1\u05D9\u05EA \u05D3\u05D5\u05BE\u05E7\u05D5\u05DE\u05EA\u05D9 (\u05D3\u05DE\u05D5)",doc:k_(),zones:Af.map(n=>({id:n.id,name:n.name,level_id:n.level,polygon:n.poly.map(t=>({x:bi(t[0],t[1])[0],y:bi(t[0],t[1])[1]})),x_proto:{floor_material:n.floor,light:n.light,temp:n.temp,presence:n.presence||null}})),anchors:O_.map(n=>({id:n.id,resource_type:"camera",resource_id:n.id,x:bi(n.p[0],n.p[1])[0],y:bi(n.p[0],n.p[1])[1],rotation:n.rot,fov:n.fov,radius:n.r/12,polygon:null,level_id:n.level,layer_id:"cameras",label:n.label,state:null,online:n.online,mount_height_m:n.mount,tilt_deg:n.tilt})),entities:{"light.hall":"off","light.stairs":"off","light.corridor":"off","light.living":"on","light.living_floor":"on","light.kitchen":"on","light.office":"off","light.wc":"off","light.utility":"off","light.gallery":"off","light.upper_corridor":"off","light.bedroom1":"off","light.bedroom2":"on","light.bedroom3":"off","light.bath":"off","binary_sensor.front_door":"off","binary_sensor.hall_living_door":"on","binary_sensor.office_door":"off","binary_sensor.kitchen_door":"on","binary_sensor.wc_door":"off","binary_sensor.bedroom1_door":"off","binary_sensor.bath_door":"off","lock.front_door":"locked","cover.living_terrace":"open","cover.office":"closed","cover.bedroom1":"open","cover.bedroom2":"open","cover.bedroom3":"closed","binary_sensor.motion_living":"on","binary_sensor.motion_office":"off","binary_sensor.motion_upper":"off","media_player.living_tv":"playing"},coverPositions:{"cover.living_terrace":100,"cover.office":0,"cover.bedroom1":100,"cover.bedroom2":70,"cover.bedroom3":0},entityNames:{"light.hall":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05DB\u05E0\u05D9\u05E1\u05D4","light.stairs":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05DE\u05D3\u05E8\u05D2\u05D5\u05EA","light.corridor":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05DE\u05E1\u05D3\u05E8\u05D5\u05DF","light.living":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05E1\u05DC\u05D5\u05DF","light.living_floor":"\u05DE\u05E0\u05D5\u05E8\u05EA \u05E8\u05E6\u05E4\u05D4","light.kitchen":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05DE\u05D8\u05D1\u05D7","light.office":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D7\u05D3\u05E8 \u05E2\u05D1\u05D5\u05D3\u05D4","light.wc":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05E9\u05D9\u05E8\u05D5\u05EA\u05D9\u05DD","light.utility":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D7\u05D3\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA","light.gallery":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D2\u05DC\u05E8\u05D9\u05D4","light.upper_corridor":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05DE\u05E1\u05D3\u05E8\u05D5\u05DF \u05E2\u05DC\u05D9\u05D5\u05DF","light.bedroom1":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D7\u05D3\u05E8 \u05D4\u05D5\u05E8\u05D9\u05DD","light.bedroom2":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D7\u05D3\u05E8 \u05D9\u05DC\u05D3\u05D9\u05DD","light.bedroom3":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D7\u05D3\u05E8 \u05D0\u05D5\u05E8\u05D7\u05D9\u05DD","light.bath":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D0\u05DE\u05D1\u05D8\u05D9\u05D4","binary_sensor.front_door":"\u05D3\u05DC\u05EA \u05DB\u05E0\u05D9\u05E1\u05D4","binary_sensor.hall_living_door":"\u05D3\u05DC\u05EA \u05E1\u05DC\u05D5\u05DF","binary_sensor.office_door":"\u05D3\u05DC\u05EA \u05D7\u05D3\u05E8 \u05E2\u05D1\u05D5\u05D3\u05D4","binary_sensor.kitchen_door":"\u05D3\u05DC\u05EA \u05D4\u05D6\u05D6\u05D4 \u05DC\u05DE\u05D8\u05D1\u05D7","binary_sensor.wc_door":"\u05D3\u05DC\u05EA \u05E9\u05D9\u05E8\u05D5\u05EA\u05D9\u05DD","binary_sensor.bedroom1_door":"\u05D3\u05DC\u05EA \u05D7\u05D3\u05E8 \u05D4\u05D5\u05E8\u05D9\u05DD","binary_sensor.bath_door":"\u05D3\u05DC\u05EA \u05D0\u05DE\u05D1\u05D8\u05D9\u05D4","lock.front_door":"\u05DE\u05E0\u05E2\u05D5\u05DC \u05DB\u05E0\u05D9\u05E1\u05D4","cover.living_terrace":"\u05EA\u05E8\u05D9\u05E1 \u05DE\u05E8\u05E4\u05E1\u05EA","cover.office":"\u05EA\u05E8\u05D9\u05E1 \u05D7\u05D3\u05E8 \u05E2\u05D1\u05D5\u05D3\u05D4","cover.bedroom1":"\u05EA\u05E8\u05D9\u05E1 \u05D7\u05D3\u05E8 \u05D4\u05D5\u05E8\u05D9\u05DD","cover.bedroom2":"\u05EA\u05E8\u05D9\u05E1 \u05D7\u05D3\u05E8 \u05D9\u05DC\u05D3\u05D9\u05DD","cover.bedroom3":"\u05EA\u05E8\u05D9\u05E1 \u05D7\u05D3\u05E8 \u05D0\u05D5\u05E8\u05D7\u05D9\u05DD","binary_sensor.motion_living":"\u05EA\u05E0\u05D5\u05E2\u05D4 \u05D1\u05E1\u05DC\u05D5\u05DF","binary_sensor.motion_office":"\u05EA\u05E0\u05D5\u05E2\u05D4 \u05D1\u05D7\u05D3\u05E8 \u05E2\u05D1\u05D5\u05D3\u05D4","binary_sensor.motion_upper":"\u05EA\u05E0\u05D5\u05E2\u05D4 \u05DC\u05DE\u05E2\u05DC\u05D4","media_player.living_tv":"\u05D8\u05DC\u05D5\u05D5\u05D9\u05D6\u05D9\u05D4"},doorLocks:{front:"lock.front_door"}};var Rf={schema_version:"2.0",plan_version_id:"sample",floor_id:"sample-floor",source:{sha256:"0000000000000000000000000000000000000000000000000000000000000000",file_name:"sample.pdf",mime:"application/pdf",page:1},dimensions:{width_px:1e3,height_px:800,scale_m_per_px:.01,calibration:{status:"measured",method:"two_point",pairs:[{a:[.1,.1],b:[.9,.1],metres:8}],residual_pct:0,reason:null}},transform:{rotation:0,crop:null},levels:[{id:"L0",name:"\u05DE\u05E4\u05DC\u05E1 \u05E8\u05D0\u05E9\u05D9",elevation_m:0,ceiling_height_m:3,is_default:!0,external_ids:{}},{id:"L1",name:"\u05D0\u05D5\u05DC\u05DD \u05EA\u05D7\u05EA\u05D5\u05DF",elevation_m:-1.2,ceiling_height_m:6,is_default:!1,external_ids:{}}],walls:[{id:"wc",level_id:"L0",polyline:[[.6,.1],[.6,.5]],thickness_m:.1,height_m:2.4,base_z_m:0,kind:"partition",confidence:.8,source:"auto",locked:!1,external_ids:{}},{id:"wa",level_id:"L0",polyline:[[.1,.1],[.9,.1],[.9,.6]],thickness_m:.3,height_m:null,base_z_m:0,kind:"exterior",confidence:1,source:"manual",locked:!1,external_ids:{}},{id:"wd",level_id:"L1",polyline:[[.1,.7],[.4,.7]],thickness_m:.2,height_m:null,base_z_m:0,kind:"interior",confidence:1,source:"manual",locked:!1,external_ids:{}},{id:"wb",level_id:"L0",polyline:[[.1,.5],[.6,.5]],thickness_m:.15,height_m:null,base_z_m:0,kind:"interior",confidence:1,source:"manual",locked:!1,external_ids:{}}],openings:[{id:"oe",wall_id:"wb",t:.9,kind:"passage",width_m:1,height_m:2.1,sill_m:0,swing:"none",hinge:"start",anchor_ref:null,confidence:1,source:"manual",external_ids:{}},{id:"ob",wall_id:"wa",t:.75,kind:"window",width_m:1.2,height_m:1.2,sill_m:.9,swing:"none",hinge:"start",anchor_ref:null,confidence:1,source:"manual",external_ids:{}},{id:"of",wall_id:"wd",t:.5,kind:"door",width_m:1,height_m:2.1,sill_m:0,swing:"sliding",hinge:"start",anchor_ref:null,confidence:1,source:"manual",external_ids:{}},{id:"oa",wall_id:"wa",t:.2,kind:"door",width_m:.9,height_m:2.1,sill_m:0,swing:"right",hinge:"start",anchor_ref:null,confidence:1,source:"manual",external_ids:{}},{id:"od",wall_id:"wc",t:.5,kind:"door",width_m:1.6,height_m:2.1,sill_m:0,swing:"double",hinge:"start",anchor_ref:null,confidence:1,source:"manual",external_ids:{}},{id:"oc",wall_id:"wb",t:.5,kind:"door",width_m:.8,height_m:2.1,sill_m:0,swing:"left",hinge:"end",anchor_ref:{resource_type:"ha_entity",resource_id:"lock.store"},confidence:1,source:"manual",external_ids:{}}],rooms:[],objects:[{id:"o1",item_id:"chair.basic",level_id:"L0",position:[.2,.2],rotation_deg:0,size:{w_m:.45,d_m:.45,h_m:.85},z_m:0,params:{},label:null,anchor_ref:null,group_id:"g1",confidence:1,source:"manual",locked:!1,external_ids:{}},{id:"o2",item_id:"table.desk",level_id:"L0",position:[.3,.4],rotation_deg:90,size:{w_m:1.4,d_m:.7,h_m:.75},z_m:0,params:{},label:"\u05E9\u05D5\u05DC\u05D7\u05DF",anchor_ref:null,group_id:"g1",confidence:1,source:"manual",locked:!1,external_ids:{}},{id:"o3",item_id:"light.ceiling",level_id:"L0",position:[.5,.3],rotation_deg:0,size:{w_m:.4,d_m:.4,h_m:.1},z_m:2.7,params:{},label:null,anchor_ref:{resource_type:"ha_entity",resource_id:"light.store"},group_id:null,confidence:1,source:"manual",locked:!1,external_ids:{}},{id:"o4",item_id:"tribune.stepped",level_id:"L0",position:[.25,.6],rotation_deg:180,size:{w_m:4,d_m:3,h_m:1.2},z_m:0,params:{rows:4,step_height_m:.3,step_width_m:1,connects_levels:"L1"},label:null,anchor_ref:null,group_id:null,confidence:1,source:"manual",locked:!1,external_ids:{}},{id:"o5",item_id:"extinguisher.co2",level_id:"L1",position:[.15,.8],rotation_deg:0,size:{w_m:.2,d_m:.2,h_m:.6},z_m:.9,params:{},label:"\u05DE\u05D8\u05E3",anchor_ref:null,group_id:null,confidence:1,source:"manual",locked:!1,external_ids:{}}],circuits:[{id:"k1",name:"\u05DE\u05E2\u05D2\u05DC \u05D0\u05D5\u05DC\u05DD",switch_entity_id:"switch.hall_a",member_ids:["o3"],color_token:"circuit-1",power_w:36}],connectors:[{id:"c1",kind:"stairs",level_from:"L0",level_to:"L1",floor_ids:[],polyline:[[.7,.7],[.8,.7]],width_m:1.2,label:null,object_id:null,source:"manual",external_ids:{}},{id:"cx-o4",kind:"tribune",level_from:"L0",level_to:"L1",floor_ids:[],polyline:[[.25,.4125],[.25,.7875]],width_m:4,label:null,object_id:"o4",source:"auto",external_ids:{}}],labels:[{id:"lb",text:"\u05D0\u05D5\u05DC\u05DD",position:[.25,.75],level_id:"L1",size:16},{id:"la",text:"\u05DE\u05D7\u05E1\u05DF",position:[.3,.3],level_id:"L0",size:16}],groups:[{id:"g1",kind:"manual",member_ids:["o1","o2"],params:{},label:null}],uncertain_regions:[],uncertainty:{overall:.2,notes:[]},meta:{generator:"fixture",tokens_version:"map-1",detector_version:null}};var tc={3:"\u05E8\u05D9\u05D0\u05DC\u05D9\u05E1\u05D8\u05D9",2:"\u05DE\u05DC\u05D0",1:"\u05E1\u05DB\u05DE\u05D8\u05D9",0:"\u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DE\u05D5\u05DB\u05E0\u05D5\u05EA"},ec="\u05E8\u05D9\u05D0\u05DC\u05D9\u05E1\u05D8\u05D9 \u05E7\u05DC",ic=[[3,!1],[3,!0],[2,!1],[1,!1],[0,!1]],Pf=[["clear","\u05D1\u05D4\u05D9\u05E8"],["hazy","\u05D0\u05D5\u05D1\u05DA"],["overcast","\u05DE\u05E2\u05D5\u05E0\u05DF"]],Yh=30,Zh=2500,z_=30,Jt=n=>document.getElementById(n),rt=(n,t,e)=>{let i=document.createElement(n);return t&&(i.className=t),e!==void 0&&(i.textContent=e),i},H_={id:"fixture-sample-v2",title:"sample-v2.json (\u05E7\u05D5\u05D1\u05E5 \u05D4\u05D1\u05D3\u05D9\u05E7\u05D4 \u05E9\u05DC \u05D4\u05E8\u05D9\u05E4\u05D5)",doc:Rf,zones:[],anchors:[],entities:{"light.store":"on","switch.hall_a":"on","lock.store":"locked"},coverPositions:{},entityNames:{"light.store":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05DE\u05D7\u05E1\u05DF","lock.store":"\u05DE\u05E0\u05E2\u05D5\u05DC \u05DE\u05D7\u05E1\u05DF"},doorLocks:{}},nc=[Cf,H_],sc=class{constructor(t={}){this.stage=Jt("stage"),this.canvas=Jt("gl"),this.env=new Jl(this.canvas,{maxDpr:2}),this.env.backdrop=this.stage,this.styleChoice=(()=>{try{return localStorage.getItem("studio6.style")||"auto"}catch{return"auto"}})(),this.style=this.resolveStyle(),this.env.style=this.style,this.lib=new Nl(this.style),this.planScene=new kl(this.lib),this.hudOn=/[?&]hud/.test(location.search),this.planScene._reflector={Reflector:co},this.env.scene.add(this.planScene.root),this.baker=new $l(this.env,this.planScene),this.quality=3,this.lite=!1,this.mode="orbit",this.levelMode=null,this.preset="iso",this.opts={reflections:!1,ao:!0,bloom:!0,lampShadows:!1,autoLadder:!0,dprCap:1.25,idleS:z_,pointerLock:!1},this.fps={ema:0,ms:0,frames:0,last:performance.now(),window:[]},this.needsFrame=!0,this.continuous=!1,this.lastInput=performance.now(),this.touch=!1,this.hover=null,this.raycaster=new Hr,this.walk=null,this.savedPositions=[],this.probe=null,this.fallbackNote=null,this.bakes={},this.thumbs={},this.presenceTimers={},this.setupCameras(),this.bindUI(),t.defer||this.boot()}boot(){this.loadPlan(nc[0]),this.resize(),window.addEventListener("resize",()=>this.resize()),requestAnimationFrame(t=>this.frame(t))}resolveStyle(){return this.styleChoice==="auto"?of(document.documentElement.dataset.theme):ai[this.styleChoice]||ai.light}setStyle(t){this.styleChoice=t;try{localStorage.setItem("studio6.style",t)}catch{}this.style=this.resolveStyle(),this.planScene.setStyle(this.style),this.env.setStyle(this.style),this.env.buildComposer(this.camera),this.planScene.setNight(this.env.recipe.night),this.applyCut(),document.documentElement.dataset.style=this.style.id,this.renderStyleChip&&this.renderStyleChip(),this.makeThumbs(),this.invalidate()}applyCut(){if(this.mode!=="orbit"||this.quality<2||!this.plan){this.planScene.setCut(null);return}let t=this.plan.doc.levels.map(s=>s.id),e=this.levelMode==="all"||!this.levelMode?t[t.length-1]:this.levelMode,i=this.planScene.levels[e];if(!i){this.planScene.setCut(null);return}this.planScene.setCut(i.elevation+i.ceiling*this.style.cut.fraction,e),this.shadowDirty=!0}setupCameras(){this.persp=new Ne(42,1,.05,300),this.ortho=new Pi(-10,10,10,-10,-100,300),this.walkCam=new Ne(62,1,.05,200),this.camera=this.ortho,this.controls=null}makeControls(t){this.controls&&this.controls.dispose();let e=new Il(t,this.canvas);e.enableDamping=!0,e.dampingFactor=.12,e.maxPolarAngle=Math.PI/2-.03,e.minDistance=2,e.maxDistance=120,e.addEventListener("change",()=>this.invalidate(!1)),e.addEventListener("start",()=>this.userInput()),this.controls=e}fitCamera(t){this.preset=t;let e=this.visibleExtent(),i=(e.minX+e.maxX)/2,s=(e.minZ+e.maxZ)/2,r=e.maxX-e.minX,o=e.maxZ-e.minZ,a=e.top,l=Math.hypot(r,o,a)/2,c=new D(i,e.base+a*.35,s),h;if(t==="persp"){h=this.persp;let f=l/Math.tan(h.fov*Math.PI/360)*1.15;h.position.set(i+f*.62,c.y+f*.55,s+f*.62)}else if(t==="top")h=this.ortho,h.position.set(i,c.y+60,s+.001);else{h=this.ortho;let f=60;h.position.set(i+f*.577,c.y+f*.577,s+f*.577)}if(h===this.ortho){let f=this.canvas.clientWidth/Math.max(1,this.canvas.clientHeight),d=l*1.08;h.left=-d*f,h.right=d*f,h.top=d,h.bottom=-d,h.zoom=1,h.updateProjectionMatrix()}h.lookAt(c),this.camera=h,this.makeControls(h),this.controls.target.copy(c),this.controls.update(),this.env.setCamera(h),this.invalidate()}visibleExtent(){let t=Object.values(this.planScene.levels).filter(s=>s.group.visible&&s.extent),e=t.length?t:Object.values(this.planScene.levels).filter(s=>s.extent),i={minX:1/0,maxX:-1/0,minZ:1/0,maxZ:-1/0,base:1/0,top:0};for(let s of e)i.minX=Math.min(i.minX,s.extent.minX),i.maxX=Math.max(i.maxX,s.extent.maxX),i.minZ=Math.min(i.minZ,s.extent.minZ),i.maxZ=Math.max(i.maxZ,s.extent.maxZ),i.base=Math.min(i.base,s.elevation),i.top=Math.max(i.top,s.elevation+s.ceiling);return Number.isFinite(i.minX)?i:{minX:0,maxX:10,minZ:0,maxZ:10,base:0,top:3}}resize(){let t=this.stage.getBoundingClientRect(),e=Math.max(1,Math.round(t.width)),i=Math.max(1,Math.round(t.height));this.env.dpr=Math.min(this.quality===3&&this.lite?1:this.opts.dprCap,window.devicePixelRatio||1),this.env.renderer.setPixelRatio(this.env.dpr),this.env.setSize(e,i);for(let s of[this.persp,this.walkCam])s.aspect=e/i,s.updateProjectionMatrix();if(this.ortho){let s=this.ortho.top;this.ortho.left=-s*(e/i),this.ortho.right=s*(e/i),this.ortho.updateProjectionMatrix()}this.invalidate()}loadPlan(t){this.plan=t,this.entities={...t.entities},this.coverPositions={...t.coverPositions||{}},t.entities=this.entities,t.coverPositions=this.coverPositions,Jt("crumb-floor").textContent=t.title;let e=t.doc.x_proto||{};this.env.setTime({north:e.north_deg||0,latitude:e.latitude||32}),this.savedPositions=(e.walk_positions||[]).map(s=>({...s})),this.bakes={},this.rebuild();let i=t.doc.levels.find(s=>s.is_default)||t.doc.levels[0];this.setLevelMode(i.id),this.fitCamera("iso"),this.buildStatesPanel(),this.buildWalkPanel(),this.buildQualityPanel(),this.buildStrip(),this.makeThumbs(),this.startProbe()}qualityLabel(){return this.quality===3&&this.lite?ec:tc[this.quality]}rebuild(){if(this.quality===0)return;let t=this.quality===3&&this.lite;this.planScene.maxLights=this.quality>=3?8:6,this.planScene.lite=t,this.planScene.build(this.plan,this.quality,{reflections:this.opts.reflections&&this.quality>=3&&!t&&!this.touch,lampShadows:this.opts.lampShadows&&this.quality>=3&&!t&&!this.touch});let e=this.visibleExtent();this.env.post.lite=t,this.env.fitShadows(e,e.top),this.env.setQuality(this.quality,this.camera||this.ortho),this.resize(),this.walk&&(this.walk.scene=this.planScene),this.planScene.showLevel(this.levelMode||"all",this.mode==="walk"),this.planScene.setNight(this.env.recipe.night),this.applyCut(),this.invalidate()}setLevelMode(t){if(this.levelMode=t,this.planScene.showLevel(t,this.mode==="walk"),this.applyCut(),this.buildStrip(),this.invalidate(),this.mode==="orbit"){let e=this.visibleExtent();this.env.fitShadows(e,e.top)}this.mode==="stills"&&this.showStills()}setQuality(t,e,i=!1){if(t===this.quality&&i===this.lite)return;let s=this.quality,r=this.lite;if(this.quality=t,this.lite=t===3&&i,t===0){if(!this.bakes[this.currentLevelId()]){this.quality=s,this.lite=r,this.toast("\u05D0\u05D9\u05DF \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DE\u05D5\u05DB\u05E0\u05D5\u05EA \u05DC\u05E7\u05D5\u05DE\u05D4 \u2014 \u05D4\u05DB\u05DF \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05EA\u05D7\u05D9\u05DC\u05D4");return}this.lastLiveQuality=s,this.lastLiveLite=r,this.enterStills()}else this.mode==="stills"&&this.exitStills(!1),this.rebuild(),this.makeThumbs();this.renderBar(),this.renderLadder(),e&&this.setNote(e),t>0&&this.startProbe()}startProbe(){!this.opts.autoLadder||this.quality===0||(this.probe={start:null,frames:0,warm:0},this.continuous=!0,this.invalidate())}probeFrame(t){let e=this.probe;if(!e)return;if(e.warm<3){e.warm++;return}if(e.start===null){e.start=t,e.frames=0;return}e.frames++;let i=t-e.start;if(i>=Zh){let s=e.frames*1e3/i;this.probe=null,this.continuous=this.mode==="walk",this.lastProbe={fps:Math.round(s),quality:this.quality,label:this.qualityLabel()};let r=ic.findIndex(([a,l])=>a===this.quality&&l===this.lite),o=ic[r+1];if(s<Yh&&o&&(o[0]>0||this.bakes[this.currentLevelId()])){let a=this.qualityLabel(),l=o[0]===3&&o[1]?ec:tc[o[0]];this.fallbackNote=`${a} \u05E0\u05DE\u05D3\u05D3 ${Math.round(s)} fps (\u05DE\u05EA\u05D7\u05EA \u05DC\u05BE${Yh}) \u2014 \u05D9\u05E8\u05D3\u05E0\u05D5 \u05DC"${l}" \u05DC\u05D4\u05DE\u05E9\u05DA \u05D4\u05D4\u05E4\u05E2\u05DC\u05D4`,this.setQuality(o[0],this.fallbackNote,o[1]),this.stage.dataset.fallback=String(r+1)}else this.setNote(`${this.qualityLabel()} \xB7 \u05E0\u05DE\u05D3\u05D3 ${Math.round(s)} fps \u05D1\u05BE${Zh/1e3} \u05E9\u05F3 \u2014 \u05E0\u05E9\u05D0\u05E8`);this.renderLadder()}}setNote(t,e=!1){let i=Jt("note");i.hidden=!t,i.textContent=t||"",i.classList.toggle("danger",e)}toast(t){this.setNote(t),clearTimeout(this._toast),this._toast=setTimeout(()=>this.setNote(""),3500)}bindUI(){let t=Jt("plan-select");for(let o of nc){let a=rt("option","",o.title);a.value=o.id,t.appendChild(a)}t.addEventListener("change",()=>{this.mode==="walk"&&this.exitWalk(),this.mode==="stills"&&this.exitStills(!1),this.loadPlan(nc.find(o=>o.id===t.value))}),Jt("theme-toggle").addEventListener("click",()=>{let o=document.documentElement;o.dataset.theme=o.dataset.theme==="dark"?"":"dark",this.styleChoice==="auto"&&this.setStyle("auto")});let e=Jt("style-select");if(e){for(let[o,a]of[["auto","\u05E1\u05D2\u05E0\u05D5\u05DF: \u05DC\u05E4\u05D9 \u05E2\u05E8\u05DB\u05EA \u05E0\u05D5\u05E9\u05D0"],["light",`\u05E1\u05D2\u05E0\u05D5\u05DF: ${ai.light.name}`],["dark",`\u05E1\u05D2\u05E0\u05D5\u05DF: ${ai.dark.name}`]]){let l=rt("option","",a);l.value=o,e.appendChild(l)}e.value=this.styleChoice,e.addEventListener("change",()=>this.setStyle(e.value)),this.renderStyleChip=()=>{e.value=this.styleChoice}}document.documentElement.dataset.style=this.style.id,Jt("hud").classList.toggle("on",this.hudOn);let s=Jt("sun-slider");s.addEventListener("input",()=>{this.env.setTime({hour:s.value/60}),this.updateSunCard(),this.invalidate(),this.userInput()}),Jt("sun-now").addEventListener("click",()=>{let o=new Date;s.value=o.getHours()*60+o.getMinutes();let a=new Date(o.getFullYear(),0,0);this.env.setTime({hour:s.value/60,day:Math.floor((o-a)/864e5)}),this.updateSunCard(),this.invalidate()});let r=Jt("weather");for(let[o,a]of Pf){let l=rt("button","chip",a);l.dataset.w=o,l.addEventListener("click",()=>{this.env.setTime({weather:o}),this.updateSunCard(),this.invalidate()}),r.appendChild(l)}for(let[o,a]of[["\u05E6\u05D4\u05E8\u05D9\u05D9\u05DD",12.5],["\u05E9\u05E7\u05D9\u05E2\u05D4",18.2],["\u05DC\u05D9\u05DC\u05D4",22.5]]){let l=rt("button","chip",o);l.addEventListener("click",()=>{s.value=a*60,this.env.setTime({hour:a}),this.updateSunCard(),this.invalidate()}),r.appendChild(l)}this.env.onTime=()=>{this.updateSunCard(),this.planScene&&this.planScene.setNight(this.env.recipe.night)},this.env.setTime({hour:s.value/60,day:278}),document.querySelectorAll(".tabs button").forEach(o=>o.addEventListener("click",()=>{document.querySelectorAll(".tabs button").forEach(a=>a.classList.toggle("sel",a===o)),document.querySelectorAll(".panel").forEach(a=>a.classList.toggle("sel",a.dataset.panel===o.dataset.tab))})),Jt("mobile-toggle").addEventListener("click",()=>Jt("aside").classList.toggle("open")),Jt("kiosk-exit").addEventListener("click",o=>{o.preventDefault(),this.exitStills(!0)}),this.renderBar(),this.bindStageInput(),window.addEventListener("pointerdown",o=>{o.pointerType==="touch"&&(this.touch=!0,this.stage.classList.add("touch"))})}updateSunCard(){let t=this.env.time,e=this.env.sunInfo;Jt("sun-time").textContent=yf(t.hour);let i=Pf.find(r=>r[0]===t.weather),s=e?e.azimuth<90?"\u05DE\u05D6\u05E8\u05D7":e.azimuth<180?"\u05D3\u05E8\u05D5\u05DD\u05BE\u05DE\u05D6\u05E8\u05D7":e.azimuth<270?"\u05D3\u05E8\u05D5\u05DD\u05BE\u05DE\u05E2\u05E8\u05D1":"\u05DE\u05E2\u05E8\u05D1":"";Jt("sun-info").textContent=e?`${e.elevation>0?`\u05E9\u05DE\u05E9 \u05DE${s} \xB7 \u05D2\u05D5\u05D1\u05D4 ${e.elevation.toFixed(0)}\xB0`:"\u05DC\u05D9\u05DC\u05D4 \xB7 \u05D4\u05E9\u05DE\u05E9 \u05DE\u05EA\u05D7\u05EA \u05DC\u05D0\u05D5\u05E4\u05E7"} \xB7 ${Mf(t.day)} \xB7 \u05E6\u05E4\u05D5\u05DF \u05D4\u05EA\u05D5\u05DB\u05E0\u05D9\u05EA ${t.north}\xB0 \xB7 ${i?i[1]:""}`:"",document.querySelectorAll("#weather .chip[data-w]").forEach(r=>r.classList.toggle("sel",r.dataset.w===t.weather))}renderBar(){let t=Jt("bar");if(t.innerHTML="",!this.plan)return;let e=(s,r,o,a={})=>{let l=rt("button","chip"+(r?" sel":""),s);return a.disabled&&(l.disabled=!0),l.addEventListener("click",o),t.appendChild(l),l},i=this.plan.doc.levels;e("\u05DE\u05DC\u05DE\u05E2\u05DC\u05D4",this.preset==="top"&&this.mode==="orbit",()=>this.toOrbit("top")),e("\u05D0\u05D9\u05D6\u05D5\u05DE\u05D8\u05E8\u05D9",this.preset==="iso"&&this.mode==="orbit",()=>this.toOrbit("iso")),e("\u05E4\u05E8\u05E1\u05E4\u05E7\u05D8\u05D9\u05D1\u05D4",this.preset==="persp"&&this.mode==="orbit",()=>this.toOrbit("persp"));for(let s of this.planScene.cameras)e(`\u05DE\u05D1\u05D8 \u05DE${s.label.replace("\u05DE\u05E6\u05DC\u05DE\u05D4 \xB7 ","")}`,!1,()=>this.standAtCamera(s));t.appendChild(rt("span","sep")),e("\u{1F6B6} \u05E1\u05D9\u05D5\u05E8",this.mode==="walk",()=>this.mode==="walk"?this.exitWalk():this.enterWalk()),t.appendChild(rt("span","sep"));for(let[s,r]of ic)e(s===3&&r?ec:tc[s],this.quality===s&&this.lite===r,()=>this.setQuality(s,null,r),{disabled:s===0&&!this.bakes[this.currentLevelId()]})}buildStrip(){let t=Jt("strip");t.innerHTML="";let e=this.plan.doc.levels.slice().reverse(),i=(s,r)=>{let o=rt("button",this.levelMode===s?"sel":""),a=rt("span","pic");if(this.thumbs[s]){let h=document.createElement("img");h.src=this.thumbs[s],a.appendChild(h)}let l=rt("span","dots"),c=this.planScene.levels[s];if(c){let h=c.zones.some(u=>u.x_proto&&this.entities[u.x_proto.light]==="on"),f=c.zones.some(u=>u.x_proto&&u.x_proto.presence&&this.entities[u.x_proto.presence]==="on"),d=this.planScene.markers.some(u=>u.group.parent===c.group&&u.group.visible);if(h){let u=rt("i");u.style.background="var(--sw-map-lit)",l.appendChild(u)}if(f){let u=rt("i");u.style.background="var(--sw-map-presence)",l.appendChild(u)}if(d){let u=rt("i");u.style.background="var(--sw-danger)",l.appendChild(u)}}a.appendChild(l),o.appendChild(a),o.appendChild(document.createTextNode(r)),o.addEventListener("click",()=>{this.mode!=="walk"&&(this.setLevelMode(s),this.fitCamera(this.preset))}),t.appendChild(o)};for(let s of e)i(s.id,s.name);i("all","\u05DB\u05DC \u05D4\u05E7\u05D5\u05DE\u05D5\u05EA")}async makeThumbs(){if(this.quality===0)return;let t=this.levelMode;for(let e of this.plan.doc.levels){this.planScene.showLevel(e.id,!1);let i=new Pi(-10,10,10,-10,-100,300),s=this.visibleExtent(),r=(s.minX+s.maxX)/2,o=(s.minZ+s.maxZ)/2,a=Math.hypot(s.maxX-s.minX,s.maxZ-s.minZ)/2*1.05;i.left=-a*1.6,i.right=a*1.6,i.top=a,i.bottom=-a,i.position.set(r+40,s.base+40,o+40),i.lookAt(r,s.base+1,o),i.updateProjectionMatrix(),this.planScene.update(.016,i.position,{nightFactor:this.env.recipe.night,lampShadows:!1}),this.thumbs[e.id]=this.baker.thumbnail(i,208,112)}this.planScene.showLevel(t,this.mode==="walk"),this.buildStrip(),this.invalidate()}currentLevelId(){return this.mode==="walk"&&this.walk?this.walk.level:this.levelMode==="all"||!this.levelMode?this.plan.doc.levels[0].id:this.levelMode}buildStatesPanel(){let t=Jt("panel-states");t.innerHTML="";let e=this.plan.entityNames||{},i=(h,f,d=["on"],u="off",p="on")=>{let x=rt("button","sw "+(f||"")),m=()=>x.classList.toggle("on",d.includes(this.entities[h]));return m(),x.addEventListener("click",()=>{this.setEntity(h,d.includes(this.entities[h])?u:p),m()}),x.dataset.entity=h,this._syncs=this._syncs||[],this._syncs.push(m),x},s=rt("div","pcard");s.appendChild(rt("h3","","\u05EA\u05E8\u05D7\u05D9\u05E9\u05D9\u05DD"));let r=rt("div","actions");r.style.display="flex",r.style.gap="6px",r.style.flexWrap="wrap";let o=(h,f)=>{let d=rt("button","btn sm",h);d.addEventListener("click",()=>{f(),this.syncPanel()}),r.appendChild(d)};o("\u05D4\u05DB\u05D5\u05DC \u05DB\u05D1\u05D5\u05D9",()=>this.setMany(h=>h.startsWith("light."),"off")),o("\u05E2\u05E8\u05D1 \u05D1\u05D1\u05D9\u05EA",()=>{this.setMany(h=>h.startsWith("light."),"on"),Jt("sun-slider").value=1140,this.env.setTime({hour:19}),this.updateSunCard()}),o("\u05DC\u05D9\u05DC\u05D4",()=>{this.setMany(h=>h.startsWith("light."),"off"),this.setEntity("light.hall","on"),this.setEntity("light.upper_corridor","on"),Jt("sun-slider").value=1380,this.env.setTime({hour:23}),this.updateSunCard()}),o("\u05E4\u05EA\u05D7 \u05D4\u05DB\u05D5\u05DC",()=>this.setMany(h=>h.startsWith("binary_sensor.")&&h.endsWith("_door"),"on")),o("\u05E1\u05D2\u05D5\u05E8 \u05D4\u05DB\u05D5\u05DC",()=>this.setMany(h=>h.startsWith("binary_sensor.")&&h.endsWith("_door"),"off")),s.appendChild(r),t.appendChild(s);for(let h of this.plan.doc.levels){let f=rt("div","pcard"),d=rt("h3","",h.name);d.appendChild(rt("span","muted",`\u05DE\u05E4\u05DC\u05E1 ${h.elevation_m.toFixed(1)} \u05DE\u05F3`)),f.appendChild(d);let u=this.plan.zones.filter(p=>p.level_id===h.id);u.length||f.appendChild(rt("div","help","\u05D0\u05D9\u05DF \u05D7\u05D3\u05E8\u05D9\u05DD \u05DE\u05D5\u05D2\u05D3\u05E8\u05D9\u05DD \u05D1\u05E7\u05D5\u05D1\u05E5 \u05D6\u05D4 \u2014 \u05D4\u05DE\u05E6\u05D1\u05D9\u05DD \u05DE\u05EA\u05D5\u05DA \u05D4\u05D9\u05E9\u05D5\u05D9\u05D5\u05EA \u05D1\u05DC\u05D1\u05D3."));for(let p of u){let x=rt("div","room"),m=rt("div","name",p.name);p.x_proto&&typeof p.x_proto.temp=="number"&&m.appendChild(rt("span","t",`${p.x_proto.temp.toFixed(1)}\xB0`)),x.appendChild(m);let g=p.x_proto||{};if(g.light){let b=rt("div","dev");b.appendChild(rt("span","lbl2",e[g.light]||g.light)),b.appendChild(i(g.light)),x.appendChild(b)}for(let b of this.planScene.lamps.filter(T=>T.level===h.id&&T.entity!==g.light&&this.lampInZone(T,p))){let T=rt("div","dev");T.appendChild(rt("span","lbl2",e[b.entity]||b.entity)),T.appendChild(i(b.entity)),x.appendChild(T)}if(g.presence){let b=rt("div","dev");b.appendChild(rt("span","lbl2",e[g.presence]||g.presence));let T=rt("button","btn sm","\u05D3\u05DE\u05D4 \u05EA\u05E0\u05D5\u05E2\u05D4");T.addEventListener("click",()=>this.pulsePresence(g.presence)),b.appendChild(T),b.appendChild(i(g.presence,"")),x.appendChild(b)}f.appendChild(x)}t.appendChild(f)}let a=rt("div","pcard");a.appendChild(rt("h3","","\u05D3\u05DC\u05EA\u05D5\u05EA \u05D5\u05DE\u05E0\u05E2\u05D5\u05DC\u05D9\u05DD"));for(let h of this.plan.doc.openings.filter(f=>f.kind==="door"&&f.anchor_ref)){let f=h.anchor_ref.resource_id,d=rt("div","dev");d.appendChild(rt("span","lbl2",e[f]||f)),f.startsWith("lock.")?d.appendChild(i(f,"danger",["locked"],"unlocked","locked")):d.appendChild(i(f,"danger",["on","open"],"off","on")),a.appendChild(d);let u=this.plan.doorLocks&&this.plan.doorLocks[h.id];if(u){let p=rt("div","dev");p.appendChild(rt("span","lbl2",e[u]||u)),p.appendChild(i(u,"danger",["locked"],"unlocked","locked")),a.appendChild(p)}}t.appendChild(a);let l=Object.keys(this.entities).filter(h=>h.startsWith("cover."));if(l.length){let h=rt("div","pcard");h.appendChild(rt("h3","","\u05EA\u05E8\u05D9\u05E1\u05D9\u05DD"));for(let f of l){let d=rt("div","dev");d.appendChild(rt("span","lbl2",e[f]||f));let u=document.createElement("input");u.type="range",u.min=0,u.max=100,u.className="pos",u.value=this.coverPositions[f]??(this.entities[f]==="open"?100:0),u.addEventListener("input",()=>{this.coverPositions[f]=+u.value,this.setEntity(f,+u.value>0?"open":"closed")}),d.appendChild(u),h.appendChild(d)}t.appendChild(h)}let c=Object.keys(this.entities).filter(h=>h.startsWith("media_player."));if(c.length){let h=rt("div","pcard");h.appendChild(rt("h3","","\u05DE\u05D3\u05D9\u05D4"));for(let f of c){let d=rt("div","dev");d.appendChild(rt("span","lbl2",e[f]||f)),d.appendChild(i(f,"",["playing","on"],"off","playing")),h.appendChild(d)}t.appendChild(h)}}lampInZone(t,e){let i=e.polygon.map(s=>this.planScene.toM([s.x,s.y]));return on(t.pos.x,t.pos.z,i)}syncPanel(){for(let t of this._syncs||[])t();this.buildStrip()}setMany(t,e){for(let i of Object.keys(this.entities))t(i)&&(this.entities[i]=e);this.applyStates()}setEntity(t,e){this.entities[t]=e,this.applyStates(),this.syncPanel()}applyStates(){this.planScene.setStates(this.entities,this.coverPositions),this.invalidate(),this.mode==="stills"&&this.showStills(),this.walk&&(this.walk.path=null)}pulsePresence(t){this.setEntity(t,"on"),clearTimeout(this.presenceTimers[t]),this.presenceTimers[t]=setTimeout(()=>this.setEntity(t,"off"),12e3)}buildWalkPanel(){let t=Jt("panel-walk");t.innerHTML="";let e=rt("div","pcard");e.appendChild(rt("h3","","\u05E1\u05D9\u05D5\u05E8 \u05D1\u05D2\u05D5\u05D1\u05D4 \u05E2\u05D9\u05DF"));let i=rt("button","btn primary",this.mode==="walk"?"\u05D9\u05E6\u05D9\u05D0\u05D4 \u05DE\u05D4\u05E1\u05D9\u05D5\u05E8":"\u05D4\u05EA\u05D7\u05DC \u05E1\u05D9\u05D5\u05E8");i.addEventListener("click",()=>this.mode==="walk"?this.exitWalk():this.enterWalk()),e.appendChild(i);let s=rt("div","toggles");s.style.marginTop="8px";let r=document.createElement("input");r.type="range",r.min=1.2,r.max=2,r.step=.05,r.value=Gh,r.className="pos";let o=rt("span","",`\u05D2\u05D5\u05D1\u05D4 \u05E2\u05D9\u05DF ${(+r.value).toFixed(2)} \u05DE\u05F3`);r.addEventListener("input",()=>{o.textContent=`\u05D2\u05D5\u05D1\u05D4 \u05E2\u05D9\u05DF ${(+r.value).toFixed(2)} \u05DE\u05F3`,this.walk&&(this.walk.eye=+r.value,this.invalidate())}),s.appendChild(o),s.appendChild(r);let a=rt("button","btn sm","\u05E0\u05E2\u05D9\u05DC\u05EA \u05E1\u05DE\u05DF (\u05D0\u05D5\u05E4\u05E6\u05D9\u05D5\u05E0\u05DC\u05D9)");a.addEventListener("click",()=>this.requestPointerLock()),s.appendChild(rt("span","","\u05DE\u05D1\u05D8 \u05D1\u05E2\u05DB\u05D1\u05E8: \u05D2\u05E8\u05D9\u05E8\u05D4 (\u05D1\u05E8\u05D9\u05E8\u05EA \u05DE\u05D7\u05D3\u05DC)")),s.appendChild(a),e.appendChild(s),e.appendChild(Object.assign(rt("div","help"),{innerHTML:"<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / \u05D7\u05D9\u05E6\u05D9\u05DD \u2014 \u05D4\u05DC\u05D9\u05DB\u05D4 \xB7 <kbd>Shift</kbd> \u05E8\u05D9\u05E6\u05D4 \xB7 <kbd>Q</kbd><kbd>E</kbd> \u05E1\u05D9\u05D1\u05D5\u05D1 \xB7 \u05D2\u05E8\u05D9\u05E8\u05EA \u05E2\u05DB\u05D1\u05E8 \u2014 \u05DE\u05D1\u05D8 \xB7 \u05DC\u05D7\u05D9\u05E6\u05D4 \u05E2\u05DC \u05D4\u05E8\u05E6\u05E4\u05D4 \u2014 \u05D4\u05DC\u05D9\u05DB\u05D4 \u05DC\u05E0\u05E7\u05D5\u05D3\u05D4 \xB7 <kbd>Enter</kbd> \u05E4\u05E2\u05D5\u05DC\u05D4 \u05E2\u05DC \u05D4\u05D4\u05EA\u05E7\u05DF \u05E9\u05D1\u05DB\u05D5\u05D5\u05E0\u05EA \xB7 <kbd>1</kbd>\u2013<kbd>9</kbd> \u05E2\u05DE\u05D3\u05D5\u05EA \u05E9\u05DE\u05D5\u05E8\u05D5\u05EA \xB7 <kbd>Esc</kbd> \u05D9\u05E6\u05D9\u05D0\u05D4 \xB7 \u05DE\u05D2\u05E2: \u05D2\u05F3\u05D5\u05D9\u05E1\u05D8\u05D9\u05E7 \u05DE\u05E9\u05DE\u05D0\u05DC, \u05D2\u05E8\u05D9\u05E8\u05D4 \u05DE\u05D9\u05DE\u05D9\u05DF, \u05D4\u05E7\u05E9\u05D4 \u2014 \u05D4\u05DC\u05D9\u05DB\u05D4"})),t.appendChild(e);let l=rt("div","pcard");l.appendChild(rt("h3","","\u05E2\u05DE\u05D3\u05D5\u05EA \u05E9\u05DE\u05D5\u05E8\u05D5\u05EA"));let c=rt("div","list");this.savedPositions.forEach((d,u)=>{let p=rt("button","",`${d.name} \xB7 ${this.levelName(d.level_id)}`);p.appendChild(rt("span","k",String(u+1))),p.addEventListener("click",()=>this.gotoPosition(d)),c.appendChild(p)}),l.appendChild(c),t.appendChild(l);let h=rt("div","pcard");h.appendChild(rt("h3","","\u05E2\u05DE\u05D5\u05D3 \u05D1\u2026"));let f=rt("div","list");for(let d of this.planScene.cameras){let u=rt("button","",`\u{1F4F7} ${d.label}`);u.addEventListener("click",()=>this.standAtCamera(d)),f.appendChild(u)}for(let d of Object.values(this.planScene.levels))for(let u of d.zones){let p=rt("button","",`${u.name} \xB7 ${d.name}`);p.addEventListener("click",()=>this.standInRoom(d,u)),f.appendChild(p)}h.appendChild(f),t.appendChild(h)}levelName(t){let e=this.plan.doc.levels.find(i=>i.id===t);return e?e.name:t}buildQualityPanel(){let t=Jt("panel-quality");t.innerHTML="";let e=rt("div","pcard");e.appendChild(rt("h3","","\u05E1\u05D5\u05DC\u05DD \u05D4\u05D0\u05D9\u05DB\u05D5\u05EA")),this.ladderEl=rt("div","ladder"),e.appendChild(this.ladderEl),e.appendChild(rt("div","help",`\u05E0\u05DE\u05D3\u05D3 ${Zh/1e3} \u05E9\u05E0\u05D9\u05D5\u05EA \u05D0\u05D7\u05E8\u05D9 3 \u05E4\u05E8\u05D9\u05D9\u05DE\u05D9\u05DD; \u05DE\u05EA\u05D7\u05EA \u05DC\u05BE${Yh} fps \u05D9\u05D5\u05E8\u05D3\u05D9\u05DD \u05E9\u05DC\u05D1 \u05D5\u05E0\u05E9\u05D0\u05E8\u05D9\u05DD \u05E9\u05DD \u05DC\u05D4\u05DE\u05E9\u05DA \u05D4\u05D4\u05E4\u05E2\u05DC\u05D4. \u05D1\u05D7\u05D9\u05E8\u05D4 \u05D9\u05D3\u05E0\u05D9\u05EA \u05DE\u05D5\u05D3\u05D3\u05EA \u05DE\u05D7\u05D3\u05E9.`));let i=rt("div","toggles"),s=(m,g,b)=>{let T=rt("button","sw"+(this.opts[m]?" on":""));T.addEventListener("click",()=>{this.opts[m]=!this.opts[m],T.classList.toggle("on",this.opts[m]),(b||(()=>this.rebuild()))()}),i.appendChild(rt("span","",g)),i.appendChild(T)};s("autoLadder","\u05D9\u05E8\u05D9\u05D3\u05D4 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA \u05D1\u05E8\u05DE\u05D4",()=>{}),s("reflections","\u05D4\u05E9\u05EA\u05E7\u05E4\u05D5\u05EA \u05E8\u05E6\u05E4\u05D4 (\u05E8\u05D9\u05D0\u05DC\u05D9\u05E1\u05D8\u05D9 \xB7 \u05D9\u05E7\u05E8: \u05DE\u05E2\u05D1\u05E8 \u05E9\u05E0\u05D9 \u05E9\u05DC \u05DB\u05DC \u05D4\u05E1\u05E6\u05E0\u05D4)"),s("ao","\u05D7\u05E1\u05D9\u05DE\u05EA \u05E1\u05D1\u05D9\u05D1\u05D4 GTAO (\u05E8\u05D9\u05D0\u05DC\u05D9\u05E1\u05D8\u05D9)",()=>{this.env.post.ao=this.opts.ao,this.env.buildComposer(this.camera),this.invalidate()}),s("bloom","\u05D6\u05D5\u05D4\u05E8 \u05DE\u05E0\u05D5\u05E8\u05D5\u05EA (bloom)",()=>{this.env.post.bloom=this.opts.bloom,this.env.buildComposer(this.camera),this.invalidate()}),s("lampShadows","\u05E6\u05DC\u05DC\u05D9\u05DD \u05DE\u05DE\u05E0\u05D5\u05E8\u05D5\u05EA (2 \u05D4\u05E7\u05E8\u05D5\u05D1\u05D5\u05EA)"),e.appendChild(i);let r=rt("div","toggles"),o=document.createElement("select");for(let m of[1,1.25,1.5,2]){let g=rt("option","",`\u05E2\u05D3 ${m}\xD7`);g.value=m,m===this.opts.dprCap&&(g.selected=!0),o.appendChild(g)}o.addEventListener("change",()=>{this.opts.dprCap=+o.value,this.resize()}),r.appendChild(rt("span","","\u05D9\u05D7\u05E1 \u05E4\u05D9\u05E7\u05E1\u05DC\u05D9\u05DD")),r.appendChild(o),e.appendChild(r),t.appendChild(e);let a=rt("div","pcard");a.appendChild(rt("h3","","\u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DE\u05D5\u05DB\u05E0\u05D5\u05EA \u05D5\u05DE\u05E6\u05D1 \u05E7\u05D9\u05D5\u05E1\u05E7")),a.appendChild(rt("div","help","\u05D0\u05E4\u05D9\u05D9\u05D4 \u05D1\u05D3\u05E4\u05D3\u05E4\u05DF: 4 \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DC\u05E7\u05D5\u05DE\u05D4 (\u05D9\u05D5\u05DD/\u05DC\u05D9\u05DC\u05D4 \xD7 \u05DB\u05D1\u05D5\u05D9/\u05D3\u05D5\u05DC\u05E7) \u05D1\u05DE\u05D1\u05D8 \u05D0\u05D9\u05D6\u05D5\u05DE\u05D8\u05E8\u05D9 + \u05DE\u05E1\u05DB\u05D5\u05EA SVG \u05DC\u05DB\u05DC \u05D7\u05D3\u05E8 \u05DE\u05D0\u05D5\u05EA\u05D4 \u05DE\u05D8\u05E8\u05D9\u05E6\u05EA \u05DE\u05E6\u05DC\u05DE\u05D4. \u05DE\u05E6\u05D1 \u05E7\u05D9\u05D5\u05E1\u05E7: \u05D0\u05E4\u05E1 \u05E4\u05E8\u05D9\u05D9\u05DE\u05D9\u05DD, \u05D4\u05EA\u05DE\u05D5\u05E0\u05D4 \u05D4\u05D3\u05D5\u05DC\u05E7\u05EA \u05E0\u05D7\u05E9\u05E4\u05EA \u05DC\u05E4\u05D9 \u05D4\u05DE\u05E1\u05DB\u05D4 \u05E9\u05DC \u05D4\u05D7\u05D3\u05E8."));let l=rt("button","btn primary","\u05D4\u05DB\u05DF \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DC\u05E7\u05D5\u05DE\u05D4 \u05D4\u05E0\u05D5\u05DB\u05D7\u05D9\u05EA"),c=rt("div","progress"),h=rt("i");c.appendChild(h),l.addEventListener("click",()=>this.bakeCurrent(l,h)),a.appendChild(l),a.appendChild(c);let f=rt("button","btn sm","\u05D4\u05DB\u05DF \u05DC\u05DB\u05DC \u05D4\u05E7\u05D5\u05DE\u05D5\u05EA");f.style.marginTop="6px",f.addEventListener("click",async()=>{for(let m of this.plan.doc.levels)this.setLevelMode(m.id),await this.bakeCurrent(l,h)}),a.appendChild(f);let d=rt("div","toggles");d.style.marginTop="8px";let u=document.createElement("select");for(let[m,g]of[[0,"\u05DB\u05D1\u05D5\u05D9"],[10,"10 \u05E9\u05F3"],[30,"30 \u05E9\u05F3"],[120,"2 \u05D3\u05E7\u05F3"],[600,"10 \u05D3\u05E7\u05F3"]]){let b=rt("option","",g);b.value=m,m===this.opts.idleS&&(b.selected=!0),u.appendChild(b)}u.addEventListener("change",()=>{this.opts.idleS=+u.value}),d.appendChild(rt("span","","\u05DE\u05E2\u05D1\u05E8 \u05DC\u05EA\u05DE\u05D5\u05E0\u05D4 \u05D0\u05D7\u05E8\u05D9 \u05D7\u05D5\u05E1\u05E8 \u05E4\u05E2\u05D9\u05DC\u05D5\u05EA")),d.appendChild(u),a.appendChild(d);let p=rt("button","btn sm","\u05D4\u05E6\u05D2 \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DE\u05D5\u05DB\u05E0\u05D5\u05EA \u05E2\u05DB\u05E9\u05D9\u05D5");p.style.marginTop="6px",p.addEventListener("click",()=>this.setQuality(0)),a.appendChild(p),t.appendChild(a);let x=rt("div","pcard");x.appendChild(rt("h3","","\u05DE\u05D4 \u05D4\u05DE\u05D3\u05D9\u05D3\u05D4 \u05D0\u05D5\u05DE\u05E8\u05EA")),x.appendChild(rt("div","help","\u05D4\u05BEHUD \u05D1\u05E4\u05D9\u05E0\u05D4 \u05DE\u05E8\u05D0\u05D4 fps, \u05D6\u05DE\u05DF \u05E4\u05E8\u05D9\u05D9\u05DD, \u05E7\u05E8\u05D9\u05D0\u05D5\u05EA \u05E6\u05D9\u05D5\u05E8, \u05DE\u05E9\u05D5\u05DC\u05E9\u05D9\u05DD, \u05D8\u05E7\u05E1\u05D8\u05D5\u05E8\u05D5\u05EA \u05D5\u05D6\u05D9\u05DB\u05E8\u05D5\u05DF JS \u05DE\u05EA\u05D5\u05DA three.js \u05D5\u05DE\u05D4\u05D3\u05E4\u05D3\u05E4\u05DF. \u05E9\u05D5\u05E8\u05EA \u05D4\u05BEGPU \u05DE\u05D6\u05D4\u05D4 SwiftShader (\u05E8\u05D9\u05E0\u05D3\u05D5\u05E8 \u05EA\u05D5\u05DB\u05E0\u05D4) \u2014 \u05DE\u05E1\u05E4\u05E8\u05D9\u05DD \u05DE\u05DE\u05E0\u05D5 \u05D0\u05D9\u05E0\u05DD \u05DE\u05E1\u05E4\u05E8\u05D9 GPU \u05D0\u05DE\u05D9\u05EA\u05D9.")),t.appendChild(x),this.renderLadder()}renderLadder(){if(!this.ladderEl)return;this.ladderEl.innerHTML="";let t=[...ic.map(([e,i])=>[e,i,e===3&&i?ec:tc[e]]),[-1,!1,"2D"]];t.forEach(([e,i,s],r)=>{let o=rt("span",e===this.quality&&i===this.lite?"on":"",s);e>=0&&o.addEventListener("click",()=>this.setQuality(e,null,i)),e===-1&&(o.style.cursor="default"),this.stage.dataset.fallback&&r<+this.stage.dataset.fallback&&o.classList.add("down"),this.ladderEl.appendChild(o),r<t.length-1&&this.ladderEl.appendChild(rt("span","","\u2190"))}),this.lastProbe&&this.ladderEl.appendChild(rt("div","help",`\u05DE\u05D3\u05D9\u05D3\u05D4 \u05D0\u05D7\u05E8\u05D5\u05E0\u05D4: ${this.lastProbe.fps} fps \u05D1\u05E8\u05DE\u05D4 "${this.lastProbe.label}"`))}async bakeCurrent(t,e){this.quality===0&&this.exitStills(!1);let i=this.currentLevelId(),s=this.levelMode,r=this.mode;this.mode==="walk"&&this.exitWalk(),this.setLevelMode(i),t.disabled=!0;let o={...this.entities},a=this.env.time.hour,l=new Ne(38,1.6,.1,300),c=this.visibleExtent(),h=(c.minX+c.maxX)/2,f=(c.minZ+c.maxZ)/2,u=Math.hypot(c.maxX-c.minX,c.maxZ-c.minZ,c.top)/2/Math.tan(l.fov*Math.PI/360)*1.1;l.position.set(h+u*.6,c.base+u*.6,f+u*.6),l.lookAt(h,c.base+1,f);let p=this.planScene.markers.filter(b=>b.group.parent===this.planScene.levels[i].group).map(b=>{let T=[];return b.group.children.forEach(v=>{v.geometry.computeBoundingBox();let S=v.geometry.boundingBox;T.push(new D(S.min.x,S.min.y,S.min.z),new D(S.max.x,S.max.y,S.max.z),new D(S.min.x,S.max.y,S.max.z),new D(S.max.x,S.min.y,S.min.z),new D(S.min.x,S.max.y,S.min.z),new D(S.max.x,S.max.y,S.min.z),new D(S.min.x,S.min.y,S.max.z),new D(S.max.x,S.min.y,S.max.z))}),{entity:b.entity,points:T}}),x=0,m=b=>{let T=b.startsWith("night"),v=b.endsWith("_on");this.env.setTime({hour:T?22.5:14});for(let S of Object.keys(this.entities))S.startsWith("light.")&&(this.entities[S]=v?"on":"off");for(let S of this.planScene.markers)S.group.visible=!1;for(let S of this.planScene.presence)S.mesh.visible=!1;this.planScene.setStates(this.entities,this.coverPositions,!0);for(let S of this.planScene.markers)S.group.visible=!1;for(let S of this.planScene.presence)S.mesh.visible=!1;this.planScene.update(1,l.position,{nightFactor:T?1:0,lampShadows:!1}),this.planScene.update(1,l.position,{nightFactor:T?1:0,lampShadows:!1}),e.style.width=`${++x/4*100}%`},g=await this.baker.bake(i,l,1280,800,m,p);this.bakes[i]=g,Object.assign(this.entities,o),this.env.setTime({hour:a}),this.planScene.setStates(this.entities,this.coverPositions,!0),this.thumbs[i]=g.pics.day_on,e.style.width="0",t.disabled=!1,this.renderBar(),this.buildStrip(),this.toast(`\u05D4\u05D5\u05DB\u05E0\u05D5 4 \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA + ${g.masks.length} \u05DE\u05E1\u05DB\u05D5\u05EA \u05DC\u05E7\u05D5\u05DE\u05D4 "${this.levelName(i)}"`),s!==i&&this.setLevelMode(s),this.invalidate()}enterStills(){this.mode="stills",this.stage.classList.add("stills"),this.continuous=!1,this.showStills(),this.renderBar()}showStills(){let t=this.bakes[this.currentLevelId()];wf(Jt("stills"),t,{night:this.env.recipe.night>.5||this.env.sunInfo.elevation<0,entities:this.entities}),Jt("labels").innerHTML=""}exitStills(t){this.stage.classList.remove("stills"),this.mode="orbit",t&&this.quality===0&&(this.quality=this.lastLiveQuality||2,this.lite=!!this.lastLiveLite,this.rebuild(),this.renderBar(),this.renderLadder()),this.invalidate()}enterWalk(){this.mode==="stills"&&this.exitStills(!0),this.mode="walk",this.stage.classList.add("walk"),this.orbitState={camera:this.camera,preset:this.preset,levelMode:this.levelMode},this.walk||(this.walk=new Ql(this.planScene),this.walk.onLevelChange=e=>this.onWalkLevel(e)),this.walk.scene=this.planScene,this.walk.eye=+(document.querySelector("#panel-walk input[type=range]")||{value:Gh}).value;let t=this.savedPositions.find(e=>e.is_default)||this.savedPositions[0];if(t)this.gotoPosition(t,!0);else{let e=this.planScene.levels[this.currentLevelId()],i=e.zones[0],s=i?qs(i.polyM):[(e.extent.minX+e.extent.maxX)/2,(e.extent.minZ+e.extent.maxZ)/2];this.walk.placeAt(s[0],s[1],0,e.id)}this.walkCam.fov=this.touch?70:62,this.walkCam.updateProjectionMatrix(),this.camera=this.walkCam,this.controls&&(this.controls.enabled=!1),this.planScene.showLevel("all",!0),this.planScene.setCut(null),this.env.setCamera(this.walkCam),this.env.interior=!0,this.env.interiorFill=.6,this.env.applyTime(),this.continuous=!0,this.renderBar(),this.buildWalkPanel(),this.updateWalkBar(),this.invalidate(),this.canvas.focus&&this.canvas.focus()}exitWalk(){document.pointerLockElement&&document.exitPointerLock(),this.mode="orbit",this.stage.classList.remove("walk");let t=this.orbitState||{};this.levelMode=t.levelMode||this.plan.doc.levels[0].id,this.planScene.showLevel(this.levelMode,!1),this.buildStrip(),this.fitCamera(t.preset||"iso"),this.env.interior=!1,this.env.interiorFill=1,this.env.applyTime(),this.applyCut(),this.continuous=!1,this.renderBar(),this.buildWalkPanel(),this.invalidate()}onWalkLevel(t){this.levelMode=t,this.buildStrip(),this.toast(`${this.levelName(t)}`),Jt("mm-level").textContent=this.levelName(t)}gotoPosition(t,e){let[i,s]=this.planScene.toM([t.x,t.y]);this.mode!=="walk"&&this.enterWalk(),this.teleport(()=>{this.walk.placeAt(i,s,t.heading_deg||0,t.level_id),this.planScene.showLevel("all",!0)},e),Jt("mm-level").textContent=this.levelName(this.walk.level)}teleport(t,e){let i=Jt("fade");if(e){t(),this.invalidate();return}i.style.opacity="1",setTimeout(()=>{t(),this.invalidate(),setTimeout(()=>i.style.opacity="0",60)},160)}standAtCamera(t){this.mode!=="walk"&&this.enterWalk(),this.teleport(()=>{let e=this.planScene.levels[t.level];this.walk.placeAt(t.pos[0]+t.fwd[0]*.35,t.pos[1]+t.fwd[1]*.35,Math.atan2(-t.fwd[0],-t.fwd[1])*180/Math.PI,t.level),this.walk.yaw=Math.atan2(-t.fwd[0],-t.fwd[1]),this.walk.pitch=-t.tilt*Math.PI/180,this.walk.eyeOverride=e.elevation+t.mount}),this.toast(`\u05E2\u05D5\u05DE\u05D3 \u05D1${t.label} \u2014 \u05D2\u05D5\u05D1\u05D4 ${t.mount.toFixed(1)} \u05DE\u05F3, \u05D4\u05D4\u05DC\u05D9\u05DB\u05D4 \u05D4\u05E8\u05D0\u05E9\u05D5\u05E0\u05D4 \u05DE\u05D7\u05D6\u05D9\u05E8\u05D4 \u05DC\u05D2\u05D5\u05D1\u05D4 \u05D4\u05E2\u05D9\u05DF`)}standInRoom(t,e){this.mode!=="walk"&&this.enterWalk();let[i,s]=qs(e.polyM),r=0,o=0;for(let a=0;a<e.polyM.length;a++){let l=e.polyM[a],c=e.polyM[(a+1)%e.polyM.length],h=Math.hypot(c[0]-l[0],c[1]-l[1]);h>o&&(o=h,r=Math.atan2(-((l[0]+c[0])/2-i),-((l[1]+c[1])/2-s)))}this.teleport(()=>this.walk.placeAt(i,s,r*180/Math.PI,t.id))}updateWalkBar(){if(!this.walk||document.activeElement&&document.activeElement.closest&&document.activeElement.closest("#walkbar"))return;Jt("wx").value=this.walk.x.toFixed(2),Jt("wz").value=this.walk.z.toFixed(2),Jt("wh").value=Math.round((this.walk.yaw*180/Math.PI%360+360)%360);let t=this.planScene.levels[this.walk.level],e=t.zones.find(i=>on(this.walk.x,this.walk.z,i.polyM));Jt("roomname").textContent=`${e?e.name+" \xB7 ":""}${t.name}${this.walk.onStairs?" \xB7 \u05DE\u05D3\u05E8\u05D2\u05D5\u05EA":""}${this.walk.edge?" \xB7 \u05E7\u05E6\u05D4 \u05D4\u05EA\u05D5\u05DB\u05E0\u05D9\u05EA":""}`,Jt("mm-level").textContent=t.name}requestPointerLock(){this.mode!=="walk"&&this.enterWalk();let t=this.canvas.requestPointerLock&&this.canvas.requestPointerLock();t&&t.catch&&t.catch(()=>this.toast("\u05E0\u05E2\u05D9\u05DC\u05EA \u05E1\u05DE\u05DF \u05E0\u05D3\u05D7\u05EA\u05D4 \u05E2\u05DC \u05D9\u05D3\u05D9 \u05D4\u05D3\u05E4\u05D3\u05E4\u05DF / \u05D4\u05DE\u05E1\u05D2\u05E8\u05EA \u2014 \u05E0\u05E9\u05D0\u05E8\u05D9\u05DD \u05D1\u05D2\u05E8\u05D9\u05E8\u05D4")),setTimeout(()=>{document.pointerLockElement||this.toast("\u05E0\u05E2\u05D9\u05DC\u05EA \u05E1\u05DE\u05DF \u05DC\u05D0 \u05D6\u05DE\u05D9\u05E0\u05D4 \u05DB\u05D0\u05DF \u2014 \u05E0\u05E9\u05D0\u05E8\u05D9\u05DD \u05D1\u05D2\u05E8\u05D9\u05E8\u05D4")},300)}bindStageInput(){let t=this.canvas;t.tabIndex=0;let e=new Set,i=()=>{if(!this.walk||this.mode!=="walk")return;let d=this.walk.input;d.fwd=(e.has("KeyW")||e.has("ArrowUp")?1:0)-(e.has("KeyS")||e.has("ArrowDown")?1:0),d.strafe=(e.has("KeyD")?1:0)-(e.has("KeyA")?1:0),d.turn=(e.has("KeyQ")||e.has("ArrowLeft")?1:0)-(e.has("KeyE")||e.has("ArrowRight")?1:0),d.run=e.has("ShiftLeft")||e.has("ShiftRight"),(d.fwd||d.strafe)&&(this.walk.path=null)};window.addEventListener("keydown",d=>{if(!(d.target&&(d.target.tagName==="INPUT"||d.target.tagName==="SELECT"||d.target.tagName==="TEXTAREA"))){if(this.userInput(),d.code==="Escape"){this.mode==="walk"&&this.exitWalk();return}if(!(d.code==="Digit3"&&this.mode!=="walk")&&this.mode==="walk"){if(/^Digit[1-9]$/.test(d.code)){let u=this.savedPositions[+d.code.slice(5)-1];u&&this.gotoPosition(u);return}if(d.code==="Enter"){this.actOnCrosshair();return}e.add(d.code),i(),["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(d.code)&&d.preventDefault()}}}),window.addEventListener("keyup",d=>{e.delete(d.code),i()}),window.addEventListener("blur",()=>{e.clear(),i()});let s=null;t.addEventListener("pointerdown",d=>{this.userInput(),this.mode!=="stills"&&(s={x:d.clientX,y:d.clientY,moved:!1,id:d.pointerId,t:performance.now(),touch:d.pointerType==="touch"},this.mode==="walk"&&!(d.pointerType==="touch"&&this.joyActive)&&t.setPointerCapture(d.pointerId))}),t.addEventListener("pointermove",d=>{if(this.mode==="walk"&&document.pointerLockElement===t){this.walk.look(d.movementX*.0025,d.movementY*.0025),this.invalidate();return}if(!s||s.id!==d.pointerId){this.mode!=="walk"&&this.hoverAt(d);return}let u=d.clientX-s.x,p=d.clientY-s.y;if(Math.hypot(u,p)>6&&(s.moved=!0),this.mode==="walk"&&s.moved){let x=s.touch?.004:.0028;this.walk.look(u*x,p*x),s.x=d.clientX,s.y=d.clientY,this.invalidate()}});let r=d=>{if(!s||s.id!==d.pointerId)return;let u=s;s=null,this.mode!=="stills"&&(u.moved||this.clickAt(d,u.touch,performance.now()-u.t>500))};t.addEventListener("pointerup",r),t.addEventListener("pointercancel",()=>s=null),t.addEventListener("contextmenu",d=>d.preventDefault()),t.addEventListener("wheel",()=>this.userInput(),{passive:!0});let o=Jt("joystick"),a=Jt("knob"),l=null,c=null;o.addEventListener("pointerdown",d=>{l=d.pointerId;let u=o.getBoundingClientRect();c=[u.left+u.width/2,u.top+u.height/2],o.setPointerCapture(d.pointerId),this.joyActive=!0,this.userInput()}),o.addEventListener("pointermove",d=>{if(d.pointerId!==l||!this.walk)return;let u=d.clientX-c[0],p=d.clientY-c[1],x=Math.hypot(u,p),m=40;x>m&&(u*=m/x,p*=m/x),a.style.transform=`translate(${u}px, ${p}px)`;let g=8,b=Math.abs(u)<g?0:u/m,T=Math.abs(p)<g?0:p/m;this.walk.input.fwd=-T,this.walk.input.strafe=b,this.walk.path=null,this.invalidate()});let h=d=>{d.pointerId===l&&(l=null,this.joyActive=!1,a.style.transform="",this.walk&&(this.walk.input.fwd=0,this.walk.input.strafe=0))};o.addEventListener("pointerup",h),o.addEventListener("pointercancel",h),Jt("minimap").querySelector("canvas").addEventListener("click",d=>{if(!this.walk||!this.mmMap)return;let u=d.currentTarget.getBoundingClientRect(),[p,x]=this.mmMap.invert((d.clientX-u.left)/u.width*336,(d.clientY-u.top)/u.height*336);this.teleport(()=>{this.walk.placeAt(p,x,this.walk.yaw*180/Math.PI,this.walk.level)})});let f=()=>{this.walk&&(this.walk.placeAt(+Jt("wx").value,+Jt("wz").value,+Jt("wh").value,this.walk.level),this.invalidate())};for(let d of["wx","wz","wh"])Jt(d).addEventListener("change",f);Jt("walk-save").addEventListener("click",()=>{if(!this.walk)return;let u=this.planScene.levels[this.walk.level].zones.find(m=>on(this.walk.x,this.walk.z,m.polyM)),p=prompt("\u05E9\u05DD \u05D4\u05E2\u05DE\u05D3\u05D4",u?u.name:`\u05E2\u05DE\u05D3\u05D4 ${this.savedPositions.length+1}`);if(!p)return;let x=[this.walk.x/(this.planScene.W*this.planScene.scale),this.walk.z/(this.planScene.H*this.planScene.scale)];this.savedPositions.push({id:`wp-${Date.now()}`,name:p,level_id:this.walk.level,x:x[0],y:x[1],heading_deg:Math.round(this.walk.yaw*180/Math.PI),is_default:!1});try{localStorage.setItem(`studio6.positions.${this.plan.id}`,JSON.stringify(this.savedPositions))}catch{}this.buildWalkPanel(),this.toast(`\u05E0\u05E9\u05DE\u05E8\u05D4 \u05D4\u05E2\u05DE\u05D3\u05D4 "${p}"`)}),Jt("walk-exit").addEventListener("click",()=>this.exitWalk()),document.addEventListener("pointerlockchange",()=>{document.pointerLockElement===t&&this.toast("\u05E0\u05E2\u05D9\u05DC\u05EA \u05E1\u05DE\u05DF \u05E4\u05E2\u05D9\u05DC\u05D4 \u2014 Esc \u05DC\u05E9\u05D7\u05E8\u05D5\u05E8")}),window.addEventListener("pointerdown",()=>this.userInput(),!0)}userInput(){this.lastInput=performance.now(),this.mode==="stills"&&this.quality===0&&this.kioskAuto&&(this.kioskAuto=!1,this.exitStills(!0))}ndc(t){let e=this.canvas.getBoundingClientRect();return new tt((t.clientX-e.left)/e.width*2-1,-((t.clientY-e.top)/e.height*2-1))}hoverAt(t){this.raycaster.setFromCamera(this.ndc(t),this.camera);let e=this.planScene.pick(this.raycaster),i=e?e.entity||e.id:null;i!==this.hover&&(this.hover=i,this.canvas.style.cursor=e?"pointer":"",this.invalidate())}clickAt(t,e,i){this.raycaster.setFromCamera(this.mode==="walk"&&!e&&document.pointerLockElement?new tt(0,0):this.ndc(t),this.camera);let s=this.planScene.pick(this.raycaster);if(s&&(this.mode!=="walk"||i||!e||s.distance<3)){this.showPopover(s,t);return}if(this.hidePopover(),this.mode==="walk"){let r=[];this.planScene.root.traverse(l=>{l.userData&&(l.userData.kind==="floor"||l.userData.kind==="static")&&l.visible&&r.push(l)});let o=this.raycaster.intersectObjects(r,!1),a=o.find(l=>l.object.userData.kind==="floor"&&l.face&&l.face.normal.y>.5)||o[0];if(a&&a.object.userData.kind==="floor"){if(a.object.userData.level!==this.walk.level){this.toast("\u05D4\u05E0\u05E7\u05D5\u05D3\u05D4 \u05D1\u05E7\u05D5\u05DE\u05D4 \u05D0\u05D7\u05E8\u05EA \u2014 \u05D4\u05E9\u05EA\u05DE\u05E9 \u05D1\u05DE\u05D3\u05E8\u05D2\u05D5\u05EA");return}this.walk.pathTo(a.point.x,a.point.z)||this.toast("\u05D0\u05D9\u05DF \u05DE\u05E1\u05DC\u05D5\u05DC \u05E4\u05EA\u05D5\u05D7 \u05DC\u05E0\u05E7\u05D5\u05D3\u05D4 (\u05D3\u05DC\u05EA \u05E1\u05D2\u05D5\u05E8\u05D4?)"),this.invalidate()}}}actOnCrosshair(){this.raycaster.setFromCamera(new tt(0,0),this.walkCam);let t=this.planScene.pick(this.raycaster);t&&t.distance<3.5&&this.showPopover(t,{clientX:this.canvas.clientWidth/2+this.stage.getBoundingClientRect().left,clientY:this.canvas.clientHeight/2+this.stage.getBoundingClientRect().top})}showPopover(t,e){this.hidePopover();let i=rt("div","popover"),s=this.stage.getBoundingClientRect();i.style.left=`${Math.min(s.width-230,Math.max(8,e.clientX-s.left-100))}px`,i.style.top=`${Math.min(s.height-140,Math.max(8,e.clientY-s.top+14))}px`;let r=this.plan.entityNames||{},o=t.entity?this.entities[t.entity]:null,a={on:"\u05D3\u05D5\u05DC\u05E7",off:"\u05DB\u05D1\u05D5\u05D9",open:"\u05E4\u05EA\u05D5\u05D7",closed:"\u05E1\u05D2\u05D5\u05E8",locked:"\u05E0\u05E2\u05D5\u05DC",unlocked:"\u05DC\u05D0 \u05E0\u05E2\u05D5\u05DC",playing:"\u05DE\u05E0\u05D2\u05DF",unavailable:"\u05DC\u05D0 \u05D6\u05DE\u05D9\u05DF",undefined:"\u05DC\u05D0 \u05D9\u05D3\u05D5\u05E2",null:"\u05DC\u05D0 \u05D9\u05D3\u05D5\u05E2"};i.appendChild(rt("h4","",t.label||r[t.entity]||t.entity||t.id));let l=rt("div","actions");if(t.kind==="camera"){i.appendChild(rt("div","state",t.online===!1?"\u05DC\u05D0 \u05DE\u05E7\u05D5\u05D5\u05DF \xB7 \u05DE\u05E6\u05D1 \u05D9\u05E9\u05DF":"\u05DE\u05E7\u05D5\u05D5\u05DF"));let h=rt("button","btn sm","\u05E2\u05DE\u05D5\u05D3 \u05D1\u05DE\u05E6\u05DC\u05DE\u05D4");h.addEventListener("click",()=>{this.hidePopover(),this.standAtCamera(this.planScene.cameras.find(f=>f.id===t.id))}),l.appendChild(h)}else if(t.domain==="light"){i.appendChild(rt("div","state",o==="on"?"\u05D3\u05D5\u05DC\u05E7":"\u05DB\u05D1\u05D5\u05D9"));let h=rt("button","btn sm primary",o==="on"?"\u05DB\u05D1\u05D4":"\u05D4\u05D3\u05DC\u05E7");h.addEventListener("click",()=>{this.setEntity(t.entity,o==="on"?"off":"on"),this.hidePopover()}),l.appendChild(h)}else if(t.domain==="door"){let h=t.entity&&!t.entity.startsWith("door:");if(i.appendChild(rt("div","state",h?(o==="on"||o==="open"?"\u05E4\u05EA\u05D5\u05D7\u05D4":"\u05E1\u05D2\u05D5\u05E8\u05D4")+(t.lock?` \xB7 ${a[this.entities[t.lock]]}`:""):"\u05DC\u05DC\u05D0 \u05D7\u05D9\u05D9\u05E9\u05DF \u2014 \u05E2\u05D1\u05D9\u05E8\u05D4 \u05D1\u05E1\u05D9\u05D5\u05E8")),h){let f=rt("button","btn sm primary",o==="on"||o==="open"?"\u05E1\u05D2\u05D5\u05E8 (\u05D3\u05DE\u05D4 \u05D7\u05D9\u05D9\u05E9\u05DF)":"\u05E4\u05EA\u05D7 (\u05D3\u05DE\u05D4 \u05D7\u05D9\u05D9\u05E9\u05DF)");f.addEventListener("click",()=>{this.setEntity(t.entity,o==="on"||o==="open"?"off":"on"),this.hidePopover()}),l.appendChild(f)}if(t.lock){let f=rt("button","btn sm",this.entities[t.lock]==="locked"?"\u05E9\u05D7\u05E8\u05E8 \u05E0\u05E2\u05D9\u05DC\u05D4":"\u05E0\u05E2\u05DC");f.addEventListener("click",()=>{this.setEntity(t.lock,this.entities[t.lock]==="locked"?"unlocked":"locked"),this.hidePopover()}),l.appendChild(f)}}else if(t.kind==="lock"){i.appendChild(rt("div","state",a[o]));let h=rt("button","btn sm primary",o==="locked"?"\u05E9\u05D7\u05E8\u05E8 \u05E0\u05E2\u05D9\u05DC\u05D4":"\u05E0\u05E2\u05DC");h.addEventListener("click",()=>{this.setEntity(t.entity,o==="locked"?"unlocked":"locked"),this.hidePopover()}),l.appendChild(h)}else if(t.domain==="cover"){let h=this.coverPositions[t.entity]??(o==="open"?100:0);i.appendChild(rt("div","state",`${h}% \u05E4\u05EA\u05D5\u05D7`));for(let f of[0,50,100]){let d=rt("button","btn sm",`${f}%`);d.addEventListener("click",()=>{this.coverPositions[t.entity]=f,this.setEntity(t.entity,f>0?"open":"closed"),this.buildStatesPanel(),this.hidePopover()}),l.appendChild(d)}}else if(t.domain==="media_player"){i.appendChild(rt("div","state",a[o]));let h=rt("button","btn sm primary",o==="playing"?"\u05DB\u05D1\u05D4":"\u05D4\u05E4\u05E2\u05DC");h.addEventListener("click",()=>{this.setEntity(t.entity,o==="playing"?"off":"playing"),this.hidePopover()}),l.appendChild(h)}let c=rt("button","btn sm","\u05E1\u05D2\u05D5\u05E8");c.addEventListener("click",()=>this.hidePopover()),l.appendChild(c),i.appendChild(l),this.stage.appendChild(i),this.popover=i}hidePopover(){this.popover&&(this.popover.remove(),this.popover=null)}layoutLabels(){let t=Jt("labels");if(this.mode==="stills"){t.innerHTML="";return}let e=this.canvas.clientWidth,i=this.canvas.clientHeight,s=this.camera;s.updateMatrixWorld();let r=new D,o=document.createDocumentFragment(),a=s.position,l=this.mode==="walk";for(let c of this.planScene.labels){let h=this.planScene.levels[c.level];if(!h||!h.group.visible||l&&c.kind==="room"||!l&&c.kind==="device"&&(!this.hover||this.hover!==c.entity)||l&&c.kind==="device"&&c.pos.distanceTo(a)>4||l&&c.kind==="camera"&&c.pos.distanceTo(a)>9||l&&c.kind==="temp"&&c.pos.distanceTo(a)>7||this.levelMode==="all"&&!l&&c.kind==="temp"&&c.level!==this.plan.doc.levels[this.plan.doc.levels.length-1].id||(r.copy(c.pos),c.offset&&!l&&(r.x+=c.offset),r.project(s),r.z>1||r.z<-1))continue;let f=(r.x+1)/2*e,d=(1-r.y)/2*i;if(f<-40||f>e+40||d<-20||d>i+20)continue;let u=rt("div",`lbl ${c.kind}`);if(c.kind==="device"){let p=this.entities[c.entity],x=this.plan.entityNames||{};u.textContent=`${x[c.entity]||c.entity} \xB7 ${p==="on"?c.entity.startsWith("light.")?"\u05D3\u05D5\u05DC\u05E7":"\u05E4\u05EA\u05D5\u05D7":p==="off"?c.entity.startsWith("light.")?"\u05DB\u05D1\u05D5\u05D9":"\u05E1\u05D2\u05D5\u05E8":p||"\u2014"}`,p==="on"&&c.entity.startsWith("light.")&&u.classList.add("on"),p==="on"&&c.entity.startsWith("binary_sensor.")&&u.classList.add("open")}else u.textContent=c.text;c.kind==="camera"&&c.online===!1&&u.classList.add("off"),u.style.left=`${f}px`,u.style.top=`${d}px`,o.appendChild(u)}t.innerHTML="",t.appendChild(o)}invalidate(t=!0){this.needsFrame=!0,t&&(this.shadowDirty=!0)}frame(t){requestAnimationFrame(o=>this.frame(o));let e=Math.min(.1,(t-(this.lastT||t))/1e3);if(this.lastT=t,this.opts.idleS>0&&this.mode==="orbit"&&this.bakes[this.currentLevelId()]&&t-this.lastInput>this.opts.idleS*1e3&&(this.lastLiveQuality=this.quality,this.kioskAuto=!0,this.quality=0,this.enterStills(),this.renderBar(),this.renderLadder(),this.setNote("\u05E7\u05D9\u05D5\u05E1\u05E7: \u05D7\u05D5\u05E1\u05E8 \u05E4\u05E2\u05D9\u05DC\u05D5\u05EA \u2014 \u05E2\u05D1\u05E8\u05E0\u05D5 \u05DC\u05EA\u05DE\u05D5\u05E0\u05D4 \u05D4\u05DE\u05D5\u05DB\u05E0\u05D4, 0 \u05E4\u05E8\u05D9\u05D9\u05DE\u05D9\u05DD")),this.mode==="stills"){this.updateHud(t,!1);return}let i=!1;if(this.mode==="walk"&&this.walk){this.walk.step(e)&&(i=!0,this.walk.eyeOverride=null);let o=this.planScene.levels[this.walk.level],a=o&&o.zones.find(h=>on(this.walk.x,this.walk.z,h.polyM)),l=a&&typeof a.daylight=="number"?.25+a.daylight*.75:.6;Math.abs(l-this.env.interiorFill)>.004&&(this.env.interiorFill+=(l-this.env.interiorFill)*Math.min(1,e*3),this.env.applyFill(),i=!0);let c=this.walk.eyeOverride!=null?this.walk.eyeOverride:this.walk.eyeY();this.walkCam.position.set(this.walk.x,c,this.walk.z),this.walkCam.rotation.order="YXZ",this.walkCam.rotation.set(this.walk.pitch,this.walk.yaw,0),this.updateWalkBar(),this.mmMap=bf(Jt("minimap").querySelector("canvas"),this.planScene,this.walk,{bg:document.documentElement.dataset.theme==="dark"?"rgba(21,28,44,.92)":"rgba(255,255,255,.92)"})}else this.controls&&this.controls.update()&&(i=!0);this.planScene.update(e,this.camera.position,{nightFactor:this.env.recipe.night,lampShadows:this.opts.lampShadows&&this.quality>=3})&&(i=!0,this.shadowDirty=!0);let r=this.needsFrame||i||this.continuous||this.probe;if(r){this.needsFrame=!1,(this.shadowDirty||this.probe)&&(this.env.renderer.shadowMap.needsUpdate=!0,this.shadowDirty=!1),this.env.renderer.info.autoReset=!1,this.env.renderer.info.reset();let o=performance.now();this.env.render(this.camera),this.fps.ms=this.fps.ms*.85+(performance.now()-o)*.15,this.layoutLabels(),this.fps.window.push(t),this.probeFrame(t)}this.updateHud(t,r)}updateHud(t,e){let i=this.fps.window;for(;i.length&&i[0]<t-1e3;)i.shift();if(t-this.fps.last<250)return;this.fps.last=t;let s=this.env.renderer.info,r=performance.memory?`${(performance.memory.usedJSHeapSize/1048576).toFixed(0)} MB heap`:"heap n/a",o=this.gpuName||(this.gpuName=this.env.rendererName()),a=/swiftshader|llvmpipe|software/i.test(o),l=this.mode==="stills"?"0 fps (still, no WebGL frames)":i.length?`${i.length} fps \xB7 ${this.fps.ms.toFixed(1)} ms/frame (CPU submit)`:"idle (0 fps \u2014 on-demand)";Jt("hud").innerHTML=`<b>${l}</b><br>draw ${s.render.calls} \xB7 tris ${(s.render.triangles/1e3).toFixed(0)}k \xB7 tex ${s.memory.textures} \xB7 geo ${s.memory.geometries}<br>${r} \xB7 ${this.canvas.width}\xD7${this.canvas.height} @${this.env.dpr.toFixed(2)}\xD7<br>${this.mode} \xB7 ${this.qualityLabel()}${this.probe?" \xB7 measuring\u2026":""}<br><span class="${a?"warn":""}">${a?"\u26A0 software renderer: ":"GPU: "}${o.length>60?o.slice(0,60)+"\u2026":o}</span>`}};window.Studio6App=sc;window.STUDIO6_PLANS=nc;/noboot/.test(location.search)||window.addEventListener("load",()=>setTimeout(()=>{let n=performance.now();window.studio6=new sc,window.studio6.bootMs=Math.round(performance.now()-n)},30));})();
