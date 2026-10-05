/* SmplWise Arx - Plan Studio 6 prototype bundle. three.js 0.186.1 (MIT, see LICENSES.md). Built 2026-10-05. */
(()=>{var Mn={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},bn={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},_u=0,Tc=1,vu=2;var Sn=1,xu=2,Ds=3,wn=0,Ne=1,Xe=2,Ae=0,Ns=1,Xn=2,Ac=3,Cc=4,Ma=5;var _i=100,yu=101,Mu=102,bu=103,Su=104,qn=200,wu=201,Eu=202,Tu=203,Rc=204,Pc=205,Fr=206,Au=207,Or=208,Cu=209,Ru=210,Pu=211,Iu=212,Lu=213,Du=214,Vo=0,Ho=1,Go=2,_s=3,Wo=4,Xo=5,qo=6,Yo=7,ba=0,Nu=1,Uu=2,fi=0,Br=1,kr=2,zr=3,En=4,Vr=5,Hr=6,Gr=7;var Ic=300,Tn=301,Yn=302,Sa=303,wa=304,Wr=306,gi=1e3,Fi=1001,Zo=1002,Te=1003,Fu=1004;var Xr=1005;var He=1006,Ea=1007;var An=1008;var $e=1009,Lc=1010,Dc=1011,Us=1012,Ta=1013,Ci=1014,Ri=1015,we=1016,Aa=1017,Ca=1018,Cn=1020,Nc=35902,Uc=35899,Fc=1021,Oc=1022,ri=1023,ki=1026,Hi=1027,Bc=1028,Ra=1029,Rn=1030,Pa=1031;var Ia=1033,qr=33776,Yr=33777,Zr=33778,$r=33779,La=35840,Da=35841,Na=35842,Ua=35843,Fa=36196,Oa=37492,Ba=37496,ka=37488,za=37489,Jr=37490,Va=37491,Ha=37808,Ga=37809,Wa=37810,Xa=37811,qa=37812,Ya=37813,Za=37814,$a=37815,Ja=37816,ja=37817,Ka=37818,Qa=37819,tl=37820,el=37821,il=36492,nl=36494,sl=36495,rl=36283,ol=36284,jr=36285,al=36286;var sr=2300,$o=2301,ko=2302,fc=2303,pc=2400,mc=2401,gc=2402;var Ou=3200;var Fs=0,Bu=1,Pi="",Pe="srgb",rr="srgb-linear",or="linear",le="srgb";var zo=7680;var ku=519,zu=512,Vu=513,Hu=514,ll=515,Gu=516,Wu=517,cl=518,Xu=519,kc=35044;var zc="300 es",wi=2e3,vs=2001;function ff(s){for(let t=s.length-1;t>=0;--t)if(s[t]>=65535)return!0;return!1}function pf(s){return ArrayBuffer.isView(s)&&!(s instanceof DataView)}function ar(s){return document.createElementNS("http://www.w3.org/1999/xhtml",s)}function qu(){let s=ar("canvas");return s.style.display="block",s}var kh={},xs=null;function lr(...s){let t="THREE."+s.shift();xs?xs("log",t,...s):console.log(t,...s)}function Yu(s){let t=s[0];if(typeof t=="string"&&t.startsWith("TSL:")){let e=s[1];e&&e.isStackTrace?s[0]+=" "+e.getLocation():s[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return s}function Yt(...s){s=Yu(s);let t="THREE."+s.shift();if(xs)xs("warn",t,...s);else{let e=s[0];e&&e.isStackTrace?console.warn(e.getError(t)):console.warn(t,...s)}}function qt(...s){s=Yu(s);let t="THREE."+s.shift();if(xs)xs("error",t,...s);else{let e=s[0];e&&e.isStackTrace?console.error(e.getError(t)):console.error(t,...s)}}function Fn(...s){let t=s.join(" ");t in kh||(kh[t]=!0,Yt(...s))}function Zu(s,t,e){return new Promise(function(i,n){function r(){switch(s.clientWaitSync(t,s.SYNC_FLUSH_COMMANDS_BIT,0)){case s.WAIT_FAILED:n();break;case s.TIMEOUT_EXPIRED:setTimeout(r,e);break;default:i()}}setTimeout(r,e)})}var $u={[Vo]:Ho,[Go]:qo,[Wo]:Yo,[_s]:Xo,[Ho]:Vo,[qo]:Go,[Yo]:Wo,[Xo]:_s},Ei=class{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});let i=this._listeners;i[t]===void 0&&(i[t]=[]),i[t].indexOf(e)===-1&&i[t].push(e)}hasEventListener(t,e){let i=this._listeners;return i===void 0?!1:i[t]!==void 0&&i[t].indexOf(e)!==-1}removeEventListener(t,e){let i=this._listeners;if(i===void 0)return;let n=i[t];if(n!==void 0){let r=n.indexOf(e);r!==-1&&n.splice(r,1)}}dispatchEvent(t){let e=this._listeners;if(e===void 0)return;let i=e[t.type];if(i!==void 0){t.target=this;let n=i.slice(0);for(let r=0,o=n.length;r<o;r++)n[r].call(this,t);t.target=null}}},Ye=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],zh=1234567,tr=Math.PI/180,ys=180/Math.PI;function Bi(){let s=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,i=Math.random()*4294967295|0;return(Ye[s&255]+Ye[s>>8&255]+Ye[s>>16&255]+Ye[s>>24&255]+"-"+Ye[t&255]+Ye[t>>8&255]+"-"+Ye[t>>16&15|64]+Ye[t>>24&255]+"-"+Ye[e&63|128]+Ye[e>>8&255]+"-"+Ye[e>>16&255]+Ye[e>>24&255]+Ye[i&255]+Ye[i>>8&255]+Ye[i>>16&255]+Ye[i>>24&255]).toLowerCase()}function Qt(s,t,e){return Math.max(t,Math.min(e,s))}function Vc(s,t){return(s%t+t)%t}function mf(s,t,e,i,n){return i+(s-t)*(n-i)/(e-t)}function gf(s,t,e){return s!==t?(e-s)/(t-s):0}function er(s,t,e){return(1-e)*s+e*t}function _f(s,t,e,i){return er(s,t,1-Math.exp(-e*i))}function vf(s,t=1){return t-Math.abs(Vc(s,t*2)-t)}function xf(s,t,e){return s<=t?0:s>=e?1:(s=(s-t)/(e-t),s*s*(3-2*s))}function yf(s,t,e){return s<=t?0:s>=e?1:(s=(s-t)/(e-t),s*s*s*(s*(s*6-15)+10))}function Mf(s,t){return s+Math.floor(Math.random()*(t-s+1))}function bf(s,t){return s+Math.random()*(t-s)}function Sf(s){return s*(.5-Math.random())}function wf(s){s!==void 0&&(zh=s);let t=zh+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function Ef(s){return s*tr}function Tf(s){return s*ys}function Af(s){return s>0&&Number.isInteger(s)&&2**Math.round(Math.log2(s))===s}function Cf(s){return Math.pow(2,Math.ceil(Math.log(s)/Math.LN2))}function Rf(s){return Math.pow(2,Math.floor(Math.log(s)/Math.LN2))}function Pf(s,t,e,i,n){let r=Math.cos,o=Math.sin,a=r(e/2),l=o(e/2),c=r((t+i)/2),h=o((t+i)/2),f=r((t-i)/2),u=o((t-i)/2),d=r((i-t)/2),m=o((i-t)/2);switch(n){case"XYX":s.set(a*h,l*f,l*u,a*c);break;case"YZY":s.set(l*u,a*h,l*f,a*c);break;case"ZXZ":s.set(l*f,l*u,a*h,a*c);break;case"XZX":s.set(a*h,l*m,l*d,a*c);break;case"YXY":s.set(l*d,a*h,l*m,a*c);break;case"ZYZ":s.set(l*m,l*d,a*h,a*c);break;default:Yt("MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+n)}}function Si(s,t){switch(t.constructor){case Float32Array:return s;case Uint32Array:return s/4294967295;case Uint16Array:return s/65535;case Uint8Array:case Uint8ClampedArray:return s/255;case Int32Array:return Math.max(s/2147483647,-1);case Int16Array:return Math.max(s/32767,-1);case Int8Array:return Math.max(s/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function de(s,t){switch(t.constructor){case Float32Array:return s;case Uint32Array:return Math.round(s*4294967295);case Uint16Array:return Math.round(s*65535);case Uint8Array:case Uint8ClampedArray:return Math.round(s*255);case Int32Array:return Math.round(s*2147483647);case Int16Array:return Math.round(s*32767);case Int8Array:return Math.round(s*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}var Hc={DEG2RAD:tr,RAD2DEG:ys,generateUUID:Bi,clamp:Qt,euclideanModulo:Vc,mapLinear:mf,inverseLerp:gf,lerp:er,damp:_f,pingpong:vf,smoothstep:xf,smootherstep:yf,randInt:Mf,randFloat:bf,randFloatSpread:Sf,seededRandom:wf,degToRad:Ef,radToDeg:Tf,isPowerOfTwo:Af,ceilPowerOfTwo:Cf,floorPowerOfTwo:Rf,setQuaternionFromProperEuler:Pf,normalize:de,denormalize:Si},Zc=class Zc{constructor(t=0,e=0){this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("THREE.Vector2: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){let e=this.x,i=this.y,n=t.elements;return this.x=n[0]*e+n[3]*i+n[6],this.y=n[1]*e+n[4]*i+n[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Qt(this.x,t.x,e.x),this.y=Qt(this.y,t.y,e.y),this}clampScalar(t,e){return this.x=Qt(this.x,t,e),this.y=Qt(this.y,t,e),this}clampLength(t,e){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Qt(i,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let i=this.dot(t)/e;return Math.acos(Qt(i,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,i=this.y-t.y;return e*e+i*i}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,i){return this.x=t.x+(e.x-t.x)*i,this.y=t.y+(e.y-t.y)*i,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){let i=Math.cos(e),n=Math.sin(e),r=this.x-t.x,o=this.y-t.y;return this.x=r*i-o*n+t.x,this.y=r*n+o*i+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}};Zc.prototype.isVector2=!0;var tt=Zc,hi=class{constructor(t=0,e=0,i=0,n=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=i,this._w=n}static slerpFlat(t,e,i,n,r,o,a){let l=i[n+0],c=i[n+1],h=i[n+2],f=i[n+3],u=r[o+0],d=r[o+1],m=r[o+2],_=r[o+3];if(f!==_||l!==u||c!==d||h!==m){let p=l*u+c*d+h*m+f*_;p<0&&(u=-u,d=-d,m=-m,_=-_,p=-p);let g=1-a;if(p<.9995){let M=Math.acos(p),T=Math.sin(M);g=Math.sin(g*M)/T,a=Math.sin(a*M)/T,l=l*g+u*a,c=c*g+d*a,h=h*g+m*a,f=f*g+_*a}else{l=l*g+u*a,c=c*g+d*a,h=h*g+m*a,f=f*g+_*a;let M=1/Math.sqrt(l*l+c*c+h*h+f*f);l*=M,c*=M,h*=M,f*=M}}t[e]=l,t[e+1]=c,t[e+2]=h,t[e+3]=f}static multiplyQuaternionsFlat(t,e,i,n,r,o){let a=i[n],l=i[n+1],c=i[n+2],h=i[n+3],f=r[o],u=r[o+1],d=r[o+2],m=r[o+3];return t[e]=a*m+h*f+l*d-c*u,t[e+1]=l*m+h*u+c*f-a*d,t[e+2]=c*m+h*d+a*u-l*f,t[e+3]=h*m-a*f-l*u-c*d,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,i,n){return this._x=t,this._y=e,this._z=i,this._w=n,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){let i=t._x,n=t._y,r=t._z,o=t._order,a=Math.cos,l=Math.sin,c=a(i/2),h=a(n/2),f=a(r/2),u=l(i/2),d=l(n/2),m=l(r/2);switch(o){case"XYZ":this._x=u*h*f+c*d*m,this._y=c*d*f-u*h*m,this._z=c*h*m+u*d*f,this._w=c*h*f-u*d*m;break;case"YXZ":this._x=u*h*f+c*d*m,this._y=c*d*f-u*h*m,this._z=c*h*m-u*d*f,this._w=c*h*f+u*d*m;break;case"ZXY":this._x=u*h*f-c*d*m,this._y=c*d*f+u*h*m,this._z=c*h*m+u*d*f,this._w=c*h*f-u*d*m;break;case"ZYX":this._x=u*h*f-c*d*m,this._y=c*d*f+u*h*m,this._z=c*h*m-u*d*f,this._w=c*h*f+u*d*m;break;case"YZX":this._x=u*h*f+c*d*m,this._y=c*d*f+u*h*m,this._z=c*h*m-u*d*f,this._w=c*h*f-u*d*m;break;case"XZY":this._x=u*h*f-c*d*m,this._y=c*d*f-u*h*m,this._z=c*h*m+u*d*f,this._w=c*h*f+u*d*m;break;default:Yt("Quaternion: .setFromEuler() encountered an unknown order: "+o)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){let i=e/2,n=Math.sin(i);return this._x=t.x*n,this._y=t.y*n,this._z=t.z*n,this._w=Math.cos(i),this._onChangeCallback(),this}setFromRotationMatrix(t){let e=t.elements,i=e[0],n=e[4],r=e[8],o=e[1],a=e[5],l=e[9],c=e[2],h=e[6],f=e[10],u=i+a+f;if(u>0){let d=.5/Math.sqrt(u+1);this._w=.25/d,this._x=(h-l)*d,this._y=(r-c)*d,this._z=(o-n)*d}else if(i>a&&i>f){let d=2*Math.sqrt(1+i-a-f);this._w=(h-l)/d,this._x=.25*d,this._y=(n+o)/d,this._z=(r+c)/d}else if(a>f){let d=2*Math.sqrt(1+a-i-f);this._w=(r-c)/d,this._x=(n+o)/d,this._y=.25*d,this._z=(l+h)/d}else{let d=2*Math.sqrt(1+f-i-a);this._w=(o-n)/d,this._x=(r+c)/d,this._y=(l+h)/d,this._z=.25*d}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let i=t.dot(e)+1;return i<1e-8?(i=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=i):(this._x=0,this._y=-t.z,this._z=t.y,this._w=i)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=i),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(Qt(this.dot(t),-1,1)))}rotateTowards(t,e){let i=this.angleTo(t);if(i===0)return this;let n=Math.min(1,e/i);return this.slerp(t,n),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){let i=t._x,n=t._y,r=t._z,o=t._w,a=e._x,l=e._y,c=e._z,h=e._w;return this._x=i*h+o*a+n*c-r*l,this._y=n*h+o*l+r*a-i*c,this._z=r*h+o*c+i*l-n*a,this._w=o*h-i*a-n*l-r*c,this._onChangeCallback(),this}slerp(t,e){let i=t._x,n=t._y,r=t._z,o=t._w,a=this.dot(t);a<0&&(i=-i,n=-n,r=-r,o=-o,a=-a);let l=1-e;if(a<.9995){let c=Math.acos(a),h=Math.sin(c);l=Math.sin(l*c)/h,e=Math.sin(e*c)/h,this._x=this._x*l+i*e,this._y=this._y*l+n*e,this._z=this._z*l+r*e,this._w=this._w*l+o*e,this._onChangeCallback()}else this._x=this._x*l+i*e,this._y=this._y*l+n*e,this._z=this._z*l+r*e,this._w=this._w*l+o*e,this.normalize();return this}slerpQuaternions(t,e,i){return this.copy(t).slerp(e,i)}random(){let t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),i=Math.random(),n=Math.sqrt(1-i),r=Math.sqrt(i);return this.set(n*Math.sin(t),n*Math.cos(t),r*Math.sin(e),r*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},$c=class $c{constructor(t=0,e=0,i=0){this.x=t,this.y=e,this.z=i}set(t,e,i){return i===void 0&&(i=this.z),this.x=t,this.y=e,this.z=i,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("THREE.Vector3: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(Vh.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(Vh.setFromAxisAngle(t,e))}applyMatrix3(t){let e=this.x,i=this.y,n=this.z,r=t.elements;return this.x=r[0]*e+r[3]*i+r[6]*n,this.y=r[1]*e+r[4]*i+r[7]*n,this.z=r[2]*e+r[5]*i+r[8]*n,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){let e=this.x,i=this.y,n=this.z,r=t.elements,o=1/(r[3]*e+r[7]*i+r[11]*n+r[15]);return this.x=(r[0]*e+r[4]*i+r[8]*n+r[12])*o,this.y=(r[1]*e+r[5]*i+r[9]*n+r[13])*o,this.z=(r[2]*e+r[6]*i+r[10]*n+r[14])*o,this}applyQuaternion(t){let e=this.x,i=this.y,n=this.z,r=t.x,o=t.y,a=t.z,l=t.w,c=2*(o*n-a*i),h=2*(a*e-r*n),f=2*(r*i-o*e);return this.x=e+l*c+o*f-a*h,this.y=i+l*h+a*c-r*f,this.z=n+l*f+r*h-o*c,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){let e=this.x,i=this.y,n=this.z,r=t.elements;return this.x=r[0]*e+r[4]*i+r[8]*n,this.y=r[1]*e+r[5]*i+r[9]*n,this.z=r[2]*e+r[6]*i+r[10]*n,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Qt(this.x,t.x,e.x),this.y=Qt(this.y,t.y,e.y),this.z=Qt(this.z,t.z,e.z),this}clampScalar(t,e){return this.x=Qt(this.x,t,e),this.y=Qt(this.y,t,e),this.z=Qt(this.z,t,e),this}clampLength(t,e){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Qt(i,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,i){return this.x=t.x+(e.x-t.x)*i,this.y=t.y+(e.y-t.y)*i,this.z=t.z+(e.z-t.z)*i,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){let i=t.x,n=t.y,r=t.z,o=e.x,a=e.y,l=e.z;return this.x=n*l-r*a,this.y=r*o-i*l,this.z=i*a-n*o,this}projectOnVector(t){let e=t.lengthSq();if(e===0)return this.set(0,0,0);let i=t.dot(this)/e;return this.copy(t).multiplyScalar(i)}projectOnPlane(t){return Hl.copy(this).projectOnVector(t),this.sub(Hl)}reflect(t){return this.sub(Hl.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){let e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;let i=this.dot(t)/e;return Math.acos(Qt(i,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){let e=this.x-t.x,i=this.y-t.y,n=this.z-t.z;return e*e+i*i+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,i){let n=Math.sin(e)*t;return this.x=n*Math.sin(i),this.y=Math.cos(e)*t,this.z=n*Math.cos(i),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,i){return this.x=t*Math.sin(e),this.y=i,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){let e=this.setFromMatrixColumn(t,0).length(),i=this.setFromMatrixColumn(t,1).length(),n=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=i,this.z=n,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let t=Math.random()*Math.PI*2,e=Math.random()*2-1,i=Math.sqrt(1-e*e);return this.x=i*Math.cos(t),this.y=e,this.z=i*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}};$c.prototype.isVector3=!0;var D=$c,Hl=new D,Vh=new hi,Jc=class Jc{constructor(t,e,i,n,r,o,a,l,c){this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,i,n,r,o,a,l,c)}set(t,e,i,n,r,o,a,l,c){let h=this.elements;return h[0]=t,h[1]=n,h[2]=a,h[3]=e,h[4]=r,h[5]=l,h[6]=i,h[7]=o,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){let e=this.elements,i=t.elements;return e[0]=i[0],e[1]=i[1],e[2]=i[2],e[3]=i[3],e[4]=i[4],e[5]=i[5],e[6]=i[6],e[7]=i[7],e[8]=i[8],this}extractBasis(t,e,i){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),i.setFromMatrix3Column(this,2),this}setFromMatrix4(t){let e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let i=t.elements,n=e.elements,r=this.elements,o=i[0],a=i[3],l=i[6],c=i[1],h=i[4],f=i[7],u=i[2],d=i[5],m=i[8],_=n[0],p=n[3],g=n[6],M=n[1],T=n[4],y=n[7],b=n[2],E=n[5],C=n[8];return r[0]=o*_+a*M+l*b,r[3]=o*p+a*T+l*E,r[6]=o*g+a*y+l*C,r[1]=c*_+h*M+f*b,r[4]=c*p+h*T+f*E,r[7]=c*g+h*y+f*C,r[2]=u*_+d*M+m*b,r[5]=u*p+d*T+m*E,r[8]=u*g+d*y+m*C,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){let t=this.elements,e=t[0],i=t[1],n=t[2],r=t[3],o=t[4],a=t[5],l=t[6],c=t[7],h=t[8];return e*o*h-e*a*c-i*r*h+i*a*l+n*r*c-n*o*l}invert(){let t=this.elements,e=t[0],i=t[1],n=t[2],r=t[3],o=t[4],a=t[5],l=t[6],c=t[7],h=t[8],f=h*o-a*c,u=a*l-h*r,d=c*r-o*l,m=e*f+i*u+n*d;if(m===0)return this.set(0,0,0,0,0,0,0,0,0);let _=1/m;return t[0]=f*_,t[1]=(n*c-h*i)*_,t[2]=(a*i-n*o)*_,t[3]=u*_,t[4]=(h*e-n*l)*_,t[5]=(n*r-a*e)*_,t[6]=d*_,t[7]=(i*l-c*e)*_,t[8]=(o*e-i*r)*_,this}transpose(){let t,e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){let e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,i,n,r,o,a){let l=Math.cos(r),c=Math.sin(r);return this.set(i*l,i*c,-i*(l*o+c*a)+o+t,-n*c,n*l,-n*(-c*o+l*a)+a+e,0,0,1),this}scale(t,e){return Fn("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(Gl.makeScale(t,e)),this}rotate(t){return Fn("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(Gl.makeRotation(-t)),this}translate(t,e){return Fn("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(Gl.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){let e=Math.cos(t),i=Math.sin(t);return this.set(e,-i,0,i,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){let e=this.elements,i=t.elements;for(let n=0;n<9;n++)if(e[n]!==i[n])return!1;return!0}fromArray(t,e=0){for(let i=0;i<9;i++)this.elements[i]=t[i+e];return this}toArray(t=[],e=0){let i=this.elements;return t[e]=i[0],t[e+1]=i[1],t[e+2]=i[2],t[e+3]=i[3],t[e+4]=i[4],t[e+5]=i[5],t[e+6]=i[6],t[e+7]=i[7],t[e+8]=i[8],t}clone(){return new this.constructor().fromArray(this.elements)}};Jc.prototype.isMatrix3=!0;var jt=Jc,Gl=new jt,Hh=new jt().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Gh=new jt().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function If(){let s={enabled:!0,workingColorSpace:rr,spaces:{},convert:function(n,r,o){return this.enabled===!1||r===o||!r||!o||(this.spaces[r].transfer===le&&(n.r=nn(n.r),n.g=nn(n.g),n.b=nn(n.b)),this.spaces[r].primaries!==this.spaces[o].primaries&&(n.applyMatrix3(this.spaces[r].toXYZ),n.applyMatrix3(this.spaces[o].fromXYZ)),this.spaces[o].transfer===le&&(n.r=gs(n.r),n.g=gs(n.g),n.b=gs(n.b))),n},workingToColorSpace:function(n,r){return this.convert(n,this.workingColorSpace,r)},colorSpaceToWorking:function(n,r){return this.convert(n,r,this.workingColorSpace)},getPrimaries:function(n){return this.spaces[n].primaries},getTransfer:function(n){return n===Pi?or:this.spaces[n].transfer},getToneMappingMode:function(n){return this.spaces[n].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(n,r=this.workingColorSpace){return n.fromArray(this.spaces[r].luminanceCoefficients)},define:function(n){Object.assign(this.spaces,n)},_getMatrix:function(n,r,o){return n.copy(this.spaces[r].toXYZ).multiply(this.spaces[o].fromXYZ)},_getDrawingBufferColorSpace:function(n){return this.spaces[n].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(n=this.workingColorSpace){return this.spaces[n].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(n,r){return Fn("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),s.workingToColorSpace(n,r)},toWorkingColorSpace:function(n,r){return Fn("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),s.colorSpaceToWorking(n,r)}},t=[.64,.33,.3,.6,.15,.06],e=[.2126,.7152,.0722],i=[.3127,.329];return s.define({[rr]:{primaries:t,whitePoint:i,transfer:or,toXYZ:Hh,fromXYZ:Gh,luminanceCoefficients:e,workingColorSpaceConfig:{unpackColorSpace:Pe},outputColorSpaceConfig:{drawingBufferColorSpace:Pe}},[Pe]:{primaries:t,whitePoint:i,transfer:le,toXYZ:Hh,fromXYZ:Gh,luminanceCoefficients:e,outputColorSpaceConfig:{drawingBufferColorSpace:Pe}}}),s}var ne=If();function nn(s){return s<.04045?s*.0773993808:Math.pow(s*.9478672986+.0521327014,2.4)}function gs(s){return s<.0031308?s*12.92:1.055*Math.pow(s,.41666)-.055}var Qn,Jo=class{static getDataURL(t,e="image/png"){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let i;if(t instanceof HTMLCanvasElement)i=t;else{Qn===void 0&&(Qn=ar("canvas")),Qn.width=t.width,Qn.height=t.height;let n=Qn.getContext("2d");t instanceof ImageData?n.putImageData(t,0,0):n.drawImage(t,0,0,t.width,t.height),i=Qn}return i.toDataURL(e)}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){let e=ar("canvas");e.width=t.width,e.height=t.height;let i=e.getContext("2d");i.drawImage(t,0,0,t.width,t.height);let n=i.getImageData(0,0,t.width,t.height),r=n.data;for(let o=0;o<r.length;o++)r[o]=nn(r[o]/255)*255;return i.putImageData(n,0,0),e}else if(t.data){let e=t.data.slice(0);for(let i=0;i<e.length;i++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[i]=Math.floor(nn(e[i]/255)*255):e[i]=nn(e[i]);return{data:e,width:t.width,height:t.height}}else return Yt("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}},Lf=0,Ms=class{constructor(t=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:Lf++}),this.uuid=Bi(),this.data=t,this.dataReady=!0,this.version=0}getSize(t){let e=this.data;return typeof HTMLVideoElement<"u"&&e instanceof HTMLVideoElement?t.set(e.videoWidth,e.videoHeight,0):typeof VideoFrame<"u"&&e instanceof VideoFrame?t.set(e.displayWidth,e.displayHeight,0):e!==null?t.set(e.width,e.height,e.depth||0):t.set(0,0,0),t}set needsUpdate(t){t===!0&&this.version++}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];let i={uuid:this.uuid,url:""},n=this.data;if(n!==null){let r;if(Array.isArray(n)){r=[];for(let o=0,a=n.length;o<a;o++)n[o].isDataTexture?r.push(Wl(n[o].image)):r.push(Wl(n[o]))}else r=Wl(n);i.url=r}return e||(t.images[this.uuid]=i),i}};function Wl(s){return typeof HTMLImageElement<"u"&&s instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&s instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&s instanceof ImageBitmap?Jo.getDataURL(s):s.data?{data:Array.from(s.data),width:s.width,height:s.height,type:s.data.constructor.name}:(Yt("Texture: Unable to serialize Texture."),{})}var Df=0,Xl=new D,ei=class s extends Ei{constructor(t=s.DEFAULT_IMAGE,e=s.DEFAULT_MAPPING,i=Fi,n=Fi,r=He,o=An,a=ri,l=$e,c=s.DEFAULT_ANISOTROPY,h=Pi){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Df++}),this.uuid=Bi(),this.name="",this.source=new Ms(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=i,this.wrapT=n,this.magFilter=r,this.minFilter=o,this.anisotropy=c,this.format=a,this.internalFormat=null,this.type=l,this.offset=new tt(0,0),this.repeat=new tt(1,1),this.center=new tt(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new jt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(Xl).x}get height(){return this.source.getSize(Xl).y}get depth(){return this.source.getSize(Xl).z}get image(){return this.source.data}set image(t){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.normalized=t.normalized,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.renderTarget=t.renderTarget,this.isRenderTargetTexture=t.isRenderTargetTexture,this.isArrayTexture=t.isArrayTexture,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}setValues(t){for(let e in t){let i=t[e];if(i===void 0){Yt(`Texture.setValues(): parameter '${e}' has value of undefined.`);continue}let n=this[e];if(n===void 0){Yt(`Texture.setValues(): property '${e}' does not exist.`);continue}n&&i&&n.isVector2&&i.isVector2||n&&i&&n.isVector3&&i.isVector3||n&&i&&n.isMatrix3&&i.isMatrix3?n.copy(i):this[e]=i}}toJSON(t){let e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];let i={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(i.userData=this.userData),e||(t.textures[this.uuid]=i),i}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==Ic)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case gi:t.x=t.x-Math.floor(t.x);break;case Fi:t.x=t.x<0?0:1;break;case Zo:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case gi:t.y=t.y-Math.floor(t.y);break;case Fi:t.y=t.y<0?0:1;break;case Zo:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}};ei.DEFAULT_IMAGE=null;ei.DEFAULT_MAPPING=Ic;ei.DEFAULT_ANISOTROPY=1;var jc=class jc{constructor(t=0,e=0,i=0,n=1){this.x=t,this.y=e,this.z=i,this.w=n}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,i,n){return this.x=t,this.y=e,this.z=i,this.w=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("THREE.Vector4: index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){let e=this.x,i=this.y,n=this.z,r=this.w,o=t.elements;return this.x=o[0]*e+o[4]*i+o[8]*n+o[12]*r,this.y=o[1]*e+o[5]*i+o[9]*n+o[13]*r,this.z=o[2]*e+o[6]*i+o[10]*n+o[14]*r,this.w=o[3]*e+o[7]*i+o[11]*n+o[15]*r,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);let e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,i,n,r,l=t.elements,c=l[0],h=l[4],f=l[8],u=l[1],d=l[5],m=l[9],_=l[2],p=l[6],g=l[10];if(Math.abs(h-u)<.01&&Math.abs(f-_)<.01&&Math.abs(m-p)<.01){if(Math.abs(h+u)<.1&&Math.abs(f+_)<.1&&Math.abs(m+p)<.1&&Math.abs(c+d+g-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;let T=(c+1)/2,y=(d+1)/2,b=(g+1)/2,E=(h+u)/4,C=(f+_)/4,x=(m+p)/4;return T>y&&T>b?T<.01?(i=0,n=.707106781,r=.707106781):(i=Math.sqrt(T),n=E/i,r=C/i):y>b?y<.01?(i=.707106781,n=0,r=.707106781):(n=Math.sqrt(y),i=E/n,r=x/n):b<.01?(i=.707106781,n=.707106781,r=0):(r=Math.sqrt(b),i=C/r,n=x/r),this.set(i,n,r,e),this}let M=Math.sqrt((p-m)*(p-m)+(f-_)*(f-_)+(u-h)*(u-h));return Math.abs(M)<.001&&(M=1),this.x=(p-m)/M,this.y=(f-_)/M,this.z=(u-h)/M,this.w=Math.acos((c+d+g-1)/2),this}setFromMatrixPosition(t){let e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Qt(this.x,t.x,e.x),this.y=Qt(this.y,t.y,e.y),this.z=Qt(this.z,t.z,e.z),this.w=Qt(this.w,t.w,e.w),this}clampScalar(t,e){return this.x=Qt(this.x,t,e),this.y=Qt(this.y,t,e),this.z=Qt(this.z,t,e),this.w=Qt(this.w,t,e),this}clampLength(t,e){let i=this.length();return this.divideScalar(i||1).multiplyScalar(Qt(i,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,i){return this.x=t.x+(e.x-t.x)*i,this.y=t.y+(e.y-t.y)*i,this.z=t.z+(e.z-t.z)*i,this.w=t.w+(e.w-t.w)*i,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}};jc.prototype.isVector4=!0;var _e=jc,jo=class extends Ei{constructor(t=1,e=1,i={}){super(),i=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:He,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},i),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=i.depth,this.scissor=new _e(0,0,t,e),this.scissorTest=!1,this.viewport=new _e(0,0,t,e),this.textures=[];let n={width:t,height:e,depth:i.depth},r=new ei(n),o=i.count;for(let a=0;a<o;a++)this.textures[a]=r.clone(),this.textures[a].isRenderTargetTexture=!0,this.textures[a].renderTarget=this;this._setTextureOptions(i),this.depthBuffer=i.depthBuffer,this.stencilBuffer=i.stencilBuffer,this.resolveColorBuffer=i.resolveColorBuffer,this.resolveDepthBuffer=i.resolveDepthBuffer,this.resolveStencilBuffer=i.resolveStencilBuffer,this.storeMultisampledColorBuffer=i.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=i.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=i.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=i.depthTexture,this.samples=i.samples,this.multiview=i.multiview,this.useArrayDepthTexture=i.useArrayDepthTexture}_setTextureOptions(t={}){let e={minFilter:He,generateMipmaps:!1,flipY:!1,internalFormat:null};t.mapping!==void 0&&(e.mapping=t.mapping),t.wrapS!==void 0&&(e.wrapS=t.wrapS),t.wrapT!==void 0&&(e.wrapT=t.wrapT),t.wrapR!==void 0&&(e.wrapR=t.wrapR),t.magFilter!==void 0&&(e.magFilter=t.magFilter),t.minFilter!==void 0&&(e.minFilter=t.minFilter),t.format!==void 0&&(e.format=t.format),t.type!==void 0&&(e.type=t.type),t.anisotropy!==void 0&&(e.anisotropy=t.anisotropy),t.colorSpace!==void 0&&(e.colorSpace=t.colorSpace),t.flipY!==void 0&&(e.flipY=t.flipY),t.generateMipmaps!==void 0&&(e.generateMipmaps=t.generateMipmaps),t.internalFormat!==void 0&&(e.internalFormat=t.internalFormat);for(let i=0;i<this.textures.length;i++)this.textures[i].setValues(e)}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}set depthTexture(t){this._depthTexture!==null&&this._depthTexture.renderTarget===this&&(this._depthTexture.renderTarget=null),t!==null&&t.renderTarget===null&&(t.renderTarget=this),this._depthTexture=t}get depthTexture(){return this._depthTexture}setSize(t,e,i=1){if(this.width!==t||this.height!==e||this.depth!==i){this.width=t,this.height=e,this.depth=i;for(let n=0,r=this.textures.length;n<r;n++)this.textures[n].image.width=t,this.textures[n].image.height=e,this.textures[n].image.depth=i,this.textures[n].isData3DTexture!==!0&&(this.textures[n].isArrayTexture=this.textures[n].image.depth>1);this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let e=0,i=t.textures.length;e<i;e++){this.textures[e]=t.textures[e].clone(),this.textures[e].isRenderTargetTexture=!0,this.textures[e].renderTarget=this;let n=Object.assign({},t.textures[e].image);this.textures[e].source=new Ms(n)}if(this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveColorBuffer=t.resolveColorBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,this.storeMultisampledColorBuffer=t.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=t.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=t.storeMultisampledStencilBuffer,t.depthTexture!==null)if(t.depthTexture.renderTarget===t){let e=t.depthTexture.clone();e.renderTarget=null,this.depthTexture=e}else this.depthTexture=t.depthTexture;return this.samples=t.samples,this.multiview=t.multiview,this.useArrayDepthTexture=t.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}},ve=class extends jo{constructor(t=1,e=1,i={}){super(t,e,i),this.isWebGLRenderTarget=!0}},cr=class extends ei{constructor(t=null,e=1,i=1,n=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:i,depth:n},this.magFilter=Te,this.minFilter=Te,this.wrapR=Fi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(t){return super.copy(t),this.wrapR=t.wrapR,this}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}};var Ko=class extends ei{constructor(t=null,e=1,i=1,n=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:i,depth:n},this.magFilter=Te,this.minFilter=Te,this.wrapR=Fi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(t){return super.copy(t),this.wrapR=t.wrapR,this}};var ya=class ya{constructor(t,e,i,n,r,o,a,l,c,h,f,u,d,m,_,p){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,i,n,r,o,a,l,c,h,f,u,d,m,_,p)}set(t,e,i,n,r,o,a,l,c,h,f,u,d,m,_,p){let g=this.elements;return g[0]=t,g[4]=e,g[8]=i,g[12]=n,g[1]=r,g[5]=o,g[9]=a,g[13]=l,g[2]=c,g[6]=h,g[10]=f,g[14]=u,g[3]=d,g[7]=m,g[11]=_,g[15]=p,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new ya().fromArray(this.elements)}copy(t){let e=this.elements,i=t.elements;return e[0]=i[0],e[1]=i[1],e[2]=i[2],e[3]=i[3],e[4]=i[4],e[5]=i[5],e[6]=i[6],e[7]=i[7],e[8]=i[8],e[9]=i[9],e[10]=i[10],e[11]=i[11],e[12]=i[12],e[13]=i[13],e[14]=i[14],e[15]=i[15],this}copyPosition(t){let e=this.elements,i=t.elements;return e[12]=i[12],e[13]=i[13],e[14]=i[14],this}setFromMatrix3(t){let e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,i){return this.determinantAffine()===0?(t.set(1,0,0),e.set(0,1,0),i.set(0,0,1),this):(t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),i.setFromMatrixColumn(this,2),this)}makeBasis(t,e,i){return this.set(t.x,e.x,i.x,0,t.y,e.y,i.y,0,t.z,e.z,i.z,0,0,0,0,1),this}extractRotation(t){if(t.determinantAffine()===0)return this.identity();let e=this.elements,i=t.elements,n=1/ts.setFromMatrixColumn(t,0).length(),r=1/ts.setFromMatrixColumn(t,1).length(),o=1/ts.setFromMatrixColumn(t,2).length();return e[0]=i[0]*n,e[1]=i[1]*n,e[2]=i[2]*n,e[3]=0,e[4]=i[4]*r,e[5]=i[5]*r,e[6]=i[6]*r,e[7]=0,e[8]=i[8]*o,e[9]=i[9]*o,e[10]=i[10]*o,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){let e=this.elements,i=t.x,n=t.y,r=t.z,o=Math.cos(i),a=Math.sin(i),l=Math.cos(n),c=Math.sin(n),h=Math.cos(r),f=Math.sin(r);if(t.order==="XYZ"){let u=o*h,d=o*f,m=a*h,_=a*f;e[0]=l*h,e[4]=-l*f,e[8]=c,e[1]=d+m*c,e[5]=u-_*c,e[9]=-a*l,e[2]=_-u*c,e[6]=m+d*c,e[10]=o*l}else if(t.order==="YXZ"){let u=l*h,d=l*f,m=c*h,_=c*f;e[0]=u+_*a,e[4]=m*a-d,e[8]=o*c,e[1]=o*f,e[5]=o*h,e[9]=-a,e[2]=d*a-m,e[6]=_+u*a,e[10]=o*l}else if(t.order==="ZXY"){let u=l*h,d=l*f,m=c*h,_=c*f;e[0]=u-_*a,e[4]=-o*f,e[8]=m+d*a,e[1]=d+m*a,e[5]=o*h,e[9]=_-u*a,e[2]=-o*c,e[6]=a,e[10]=o*l}else if(t.order==="ZYX"){let u=o*h,d=o*f,m=a*h,_=a*f;e[0]=l*h,e[4]=m*c-d,e[8]=u*c+_,e[1]=l*f,e[5]=_*c+u,e[9]=d*c-m,e[2]=-c,e[6]=a*l,e[10]=o*l}else if(t.order==="YZX"){let u=o*l,d=o*c,m=a*l,_=a*c;e[0]=l*h,e[4]=_-u*f,e[8]=m*f+d,e[1]=f,e[5]=o*h,e[9]=-a*h,e[2]=-c*h,e[6]=d*f+m,e[10]=u-_*f}else if(t.order==="XZY"){let u=o*l,d=o*c,m=a*l,_=a*c;e[0]=l*h,e[4]=-f,e[8]=c*h,e[1]=u*f+_,e[5]=o*h,e[9]=d*f-m,e[2]=m*f-d,e[6]=a*h,e[10]=_*f+u}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(Nf,t,Uf)}lookAt(t,e,i){let n=this.elements;return ai.subVectors(t,e),ai.lengthSq()===0&&(ai.z=1),ai.normalize(),cn.crossVectors(i,ai),cn.lengthSq()===0&&(Math.abs(i.z)===1?ai.x+=1e-4:ai.z+=1e-4,ai.normalize(),cn.crossVectors(i,ai)),cn.normalize(),mo.crossVectors(ai,cn),n[0]=cn.x,n[4]=mo.x,n[8]=ai.x,n[1]=cn.y,n[5]=mo.y,n[9]=ai.y,n[2]=cn.z,n[6]=mo.z,n[10]=ai.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){let i=t.elements,n=e.elements,r=this.elements,o=i[0],a=i[4],l=i[8],c=i[12],h=i[1],f=i[5],u=i[9],d=i[13],m=i[2],_=i[6],p=i[10],g=i[14],M=i[3],T=i[7],y=i[11],b=i[15],E=n[0],C=n[4],x=n[8],A=n[12],L=n[1],U=n[5],w=n[9],P=n[13],I=n[2],N=n[6],B=n[10],O=n[14],G=n[3],V=n[7],W=n[11],$=n[15];return r[0]=o*E+a*L+l*I+c*G,r[4]=o*C+a*U+l*N+c*V,r[8]=o*x+a*w+l*B+c*W,r[12]=o*A+a*P+l*O+c*$,r[1]=h*E+f*L+u*I+d*G,r[5]=h*C+f*U+u*N+d*V,r[9]=h*x+f*w+u*B+d*W,r[13]=h*A+f*P+u*O+d*$,r[2]=m*E+_*L+p*I+g*G,r[6]=m*C+_*U+p*N+g*V,r[10]=m*x+_*w+p*B+g*W,r[14]=m*A+_*P+p*O+g*$,r[3]=M*E+T*L+y*I+b*G,r[7]=M*C+T*U+y*N+b*V,r[11]=M*x+T*w+y*B+b*W,r[15]=M*A+T*P+y*O+b*$,this}multiplyScalar(t){let e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){let t=this.elements,e=t[0],i=t[4],n=t[8],r=t[12],o=t[1],a=t[5],l=t[9],c=t[13],h=t[2],f=t[6],u=t[10],d=t[14],m=t[3],_=t[7],p=t[11],g=t[15],M=l*d-c*u,T=a*d-c*f,y=a*u-l*f,b=o*d-c*h,E=o*u-l*h,C=o*f-a*h;return e*(_*M-p*T+g*y)-i*(m*M-p*b+g*E)+n*(m*T-_*b+g*C)-r*(m*y-_*E+p*C)}determinantAffine(){let t=this.elements,e=t[0],i=t[4],n=t[8],r=t[1],o=t[5],a=t[9],l=t[2],c=t[6],h=t[10];return e*(o*h-a*c)-i*(r*h-a*l)+n*(r*c-o*l)}transpose(){let t=this.elements,e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,i){let n=this.elements;return t.isVector3?(n[12]=t.x,n[13]=t.y,n[14]=t.z):(n[12]=t,n[13]=e,n[14]=i),this}invert(){let t=this.elements,e=t[0],i=t[1],n=t[2],r=t[3],o=t[4],a=t[5],l=t[6],c=t[7],h=t[8],f=t[9],u=t[10],d=t[11],m=t[12],_=t[13],p=t[14],g=t[15],M=e*a-i*o,T=e*l-n*o,y=e*c-r*o,b=i*l-n*a,E=i*c-r*a,C=n*c-r*l,x=h*_-f*m,A=h*p-u*m,L=h*g-d*m,U=f*p-u*_,w=f*g-d*_,P=u*g-d*p,I=M*P-T*w+y*U+b*L-E*A+C*x;if(I===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let N=1/I;return t[0]=(a*P-l*w+c*U)*N,t[1]=(n*w-i*P-r*U)*N,t[2]=(_*C-p*E+g*b)*N,t[3]=(u*E-f*C-d*b)*N,t[4]=(l*L-o*P-c*A)*N,t[5]=(e*P-n*L+r*A)*N,t[6]=(p*y-m*C-g*T)*N,t[7]=(h*C-u*y+d*T)*N,t[8]=(o*w-a*L+c*x)*N,t[9]=(i*L-e*w-r*x)*N,t[10]=(m*E-_*y+g*M)*N,t[11]=(f*y-h*E-d*M)*N,t[12]=(a*A-o*U-l*x)*N,t[13]=(e*U-i*A+n*x)*N,t[14]=(_*T-m*b-p*M)*N,t[15]=(h*b-f*T+u*M)*N,this}scale(t){let e=this.elements,i=t.x,n=t.y,r=t.z;return e[0]*=i,e[4]*=n,e[8]*=r,e[1]*=i,e[5]*=n,e[9]*=r,e[2]*=i,e[6]*=n,e[10]*=r,e[3]*=i,e[7]*=n,e[11]*=r,this}getMaxScaleOnAxis(){let t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],i=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],n=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,i,n))}makeTranslation(t,e,i){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,i,0,0,0,1),this}makeRotationX(t){let e=Math.cos(t),i=Math.sin(t);return this.set(1,0,0,0,0,e,-i,0,0,i,e,0,0,0,0,1),this}makeRotationY(t){let e=Math.cos(t),i=Math.sin(t);return this.set(e,0,i,0,0,1,0,0,-i,0,e,0,0,0,0,1),this}makeRotationZ(t){let e=Math.cos(t),i=Math.sin(t);return this.set(e,-i,0,0,i,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){let i=Math.cos(e),n=Math.sin(e),r=1-i,o=t.x,a=t.y,l=t.z,c=r*o,h=r*a;return this.set(c*o+i,c*a-n*l,c*l+n*a,0,c*a+n*l,h*a+i,h*l-n*o,0,c*l-n*a,h*l+n*o,r*l*l+i,0,0,0,0,1),this}makeScale(t,e,i){return this.set(t,0,0,0,0,e,0,0,0,0,i,0,0,0,0,1),this}makeShear(t,e,i,n,r,o){return this.set(1,i,r,0,t,1,o,0,e,n,1,0,0,0,0,1),this}compose(t,e,i){let n=this.elements,r=e._x,o=e._y,a=e._z,l=e._w,c=r+r,h=o+o,f=a+a,u=r*c,d=r*h,m=r*f,_=o*h,p=o*f,g=a*f,M=l*c,T=l*h,y=l*f,b=i.x,E=i.y,C=i.z;return n[0]=(1-(_+g))*b,n[1]=(d+y)*b,n[2]=(m-T)*b,n[3]=0,n[4]=(d-y)*E,n[5]=(1-(u+g))*E,n[6]=(p+M)*E,n[7]=0,n[8]=(m+T)*C,n[9]=(p-M)*C,n[10]=(1-(u+_))*C,n[11]=0,n[12]=t.x,n[13]=t.y,n[14]=t.z,n[15]=1,this}decompose(t,e,i){let n=this.elements;t.x=n[12],t.y=n[13],t.z=n[14];let r=this.determinantAffine();if(r===0)return i.set(1,1,1),e.identity(),this;let o=ts.set(n[0],n[1],n[2]).length(),a=ts.set(n[4],n[5],n[6]).length(),l=ts.set(n[8],n[9],n[10]).length();r<0&&(o=-o),yi.copy(this);let c=1/o,h=1/a,f=1/l;return yi.elements[0]*=c,yi.elements[1]*=c,yi.elements[2]*=c,yi.elements[4]*=h,yi.elements[5]*=h,yi.elements[6]*=h,yi.elements[8]*=f,yi.elements[9]*=f,yi.elements[10]*=f,e.setFromRotationMatrix(yi),i.x=o,i.y=a,i.z=l,this}makePerspective(t,e,i,n,r,o,a=wi,l=!1){let c=this.elements,h=2*r/(e-t),f=2*r/(i-n),u=(e+t)/(e-t),d=(i+n)/(i-n),m,_;if(l)m=r/(o-r),_=o*r/(o-r);else if(a===wi)m=-(o+r)/(o-r),_=-2*o*r/(o-r);else if(a===vs)m=-o/(o-r),_=-o*r/(o-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return c[0]=h,c[4]=0,c[8]=u,c[12]=0,c[1]=0,c[5]=f,c[9]=d,c[13]=0,c[2]=0,c[6]=0,c[10]=m,c[14]=_,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(t,e,i,n,r,o,a=wi,l=!1){let c=this.elements,h=2/(e-t),f=2/(i-n),u=-(e+t)/(e-t),d=-(i+n)/(i-n),m,_;if(l)m=1/(o-r),_=o/(o-r);else if(a===wi)m=-2/(o-r),_=-(o+r)/(o-r);else if(a===vs)m=-1/(o-r),_=-r/(o-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return c[0]=h,c[4]=0,c[8]=0,c[12]=u,c[1]=0,c[5]=f,c[9]=0,c[13]=d,c[2]=0,c[6]=0,c[10]=m,c[14]=_,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(t){let e=this.elements,i=t.elements;for(let n=0;n<16;n++)if(e[n]!==i[n])return!1;return!0}fromArray(t,e=0){for(let i=0;i<16;i++)this.elements[i]=t[i+e];return this}toArray(t=[],e=0){let i=this.elements;return t[e]=i[0],t[e+1]=i[1],t[e+2]=i[2],t[e+3]=i[3],t[e+4]=i[4],t[e+5]=i[5],t[e+6]=i[6],t[e+7]=i[7],t[e+8]=i[8],t[e+9]=i[9],t[e+10]=i[10],t[e+11]=i[11],t[e+12]=i[12],t[e+13]=i[13],t[e+14]=i[14],t[e+15]=i[15],t}};ya.prototype.isMatrix4=!0;var oe=ya,ts=new D,yi=new oe,Nf=new D(0,0,0),Uf=new D(1,1,1),cn=new D,mo=new D,ai=new D,Wh=new oe,Xh=new hi,zi=class s{constructor(t=0,e=0,i=0,n=s.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=i,this._order=n}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,i,n=this._order){return this._x=t,this._y=e,this._z=i,this._order=n,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,i=!0){let n=t.elements,r=n[0],o=n[4],a=n[8],l=n[1],c=n[5],h=n[9],f=n[2],u=n[6],d=n[10];switch(e){case"XYZ":this._y=Math.asin(Qt(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-h,d),this._z=Math.atan2(-o,r)):(this._x=Math.atan2(u,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Qt(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(a,d),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-f,r),this._z=0);break;case"ZXY":this._x=Math.asin(Qt(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(-f,d),this._z=Math.atan2(-o,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-Qt(f,-1,1)),Math.abs(f)<.9999999?(this._x=Math.atan2(u,d),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-o,c));break;case"YZX":this._z=Math.asin(Qt(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-f,r)):(this._x=0,this._y=Math.atan2(a,d));break;case"XZY":this._z=Math.asin(-Qt(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(u,c),this._y=Math.atan2(a,r)):(this._x=Math.atan2(-h,d),this._y=0);break;default:Yt("Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,i===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,i){return Wh.makeRotationFromQuaternion(t),this.setFromRotationMatrix(Wh,e,i)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return Xh.setFromEuler(this),this.setFromQuaternion(Xh,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};zi.DEFAULT_ORDER="XYZ";var bs=class{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}},Ff=0,qh=new D,es=new hi,Ji=new oe,go=new D,qs=new D,Of=new D,Bf=new hi,Yh=new D(1,0,0),Zh=new D(0,1,0),$h=new D(0,0,1),Jh={type:"added"},kf={type:"removed"},is={type:"childadded",child:null},ql={type:"childremoved",child:null},Ge=class s extends Ei{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Ff++}),this.uuid=Bi(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=s.DEFAULT_UP.clone();let t=new D,e=new zi,i=new hi,n=new D(1,1,1);function r(){i.setFromEuler(e,!1)}function o(){e.setFromQuaternion(i,void 0,!1)}e._onChange(r),i._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:i},scale:{configurable:!0,enumerable:!0,value:n},modelViewMatrix:{value:new oe},normalMatrix:{value:new jt}}),this.matrix=new oe,this.matrixWorld=new oe,this.matrixAutoUpdate=s.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=s.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new bs,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return es.setFromAxisAngle(t,e),this.quaternion.multiply(es),this}rotateOnWorldAxis(t,e){return es.setFromAxisAngle(t,e),this.quaternion.premultiply(es),this}rotateX(t){return this.rotateOnAxis(Yh,t)}rotateY(t){return this.rotateOnAxis(Zh,t)}rotateZ(t){return this.rotateOnAxis($h,t)}translateOnAxis(t,e){return qh.copy(t).applyQuaternion(this.quaternion),this.position.add(qh.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(Yh,t)}translateY(t){return this.translateOnAxis(Zh,t)}translateZ(t){return this.translateOnAxis($h,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(Ji.copy(this.matrixWorld).invert())}lookAt(t,e,i){t.isVector3?go.copy(t):go.set(t,e,i);let n=this.parent;this.updateWorldMatrix(!0,!1),qs.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Ji.lookAt(qs,go,this.up):Ji.lookAt(go,qs,this.up),this.quaternion.setFromRotationMatrix(Ji),n&&(Ji.extractRotation(n.matrixWorld),es.setFromRotationMatrix(Ji),this.quaternion.premultiply(es.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(qt("Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(Jh),is.child=t,this.dispatchEvent(is),is.child=null):qt("Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let i=0;i<arguments.length;i++)this.remove(arguments[i]);return this}let e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(kf),ql.child=t,this.dispatchEvent(ql),ql.child=null),this}removeFromParent(){let t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),Ji.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),Ji.multiply(t.parent.matrixWorld)),t.applyMatrix4(Ji),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(Jh),is.child=t,this.dispatchEvent(is),is.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let i=0,n=this.children.length;i<n;i++){let o=this.children[i].getObjectByProperty(t,e);if(o!==void 0)return o}}getObjectsByProperty(t,e,i=[]){this[t]===e&&i.push(this);let n=this.children;for(let r=0,o=n.length;r<o;r++)n[r].getObjectsByProperty(t,e,i);return i}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(qs,t,Of),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(qs,Bf,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);let e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}intersectsFrustum(){}traverse(t){t(this);let e=this.children;for(let i=0,n=e.length;i<n;i++)e[i].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);let e=this.children;for(let i=0,n=e.length;i<n;i++)e[i].traverseVisible(t)}traverseAncestors(t){let e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let t=this.pivot;if(t!==null){let e=t.x,i=t.y,n=t.z,r=this.matrix.elements;r[12]+=e-r[0]*e-r[4]*i-r[8]*n,r[13]+=i-r[1]*e-r[5]*i-r[9]*n,r[14]+=n-r[2]*e-r[6]*i-r[10]*n}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);let e=this.children;for(let i=0,n=e.length;i<n;i++)e[i].updateMatrixWorld(t)}updateWorldMatrix(t,e,i=!1){let n=this.parent;if(t===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||i)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,i=!0),e===!0){let r=this.children;for(let o=0,a=r.length;o<a;o++)r[o].updateWorldMatrix(!1,!0,i)}}toJSON(t){let e=t===void 0||typeof t=="string",i={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},i.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});let n={};n.uuid=this.uuid,n.type=this.type,n.name=this.name,n.castShadow=this.castShadow,n.receiveShadow=this.receiveShadow,n.visible=this.visible,n.frustumCulled=this.frustumCulled,n.renderOrder=this.renderOrder,n.static=this.static,n.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(n.userData=this.userData),n.layers=this.layers.mask,n.matrix=this.matrix.toArray(),n.up=this.up.toArray(),this.pivot!==null&&(n.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(n.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(n.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(n.type="InstancedMesh",n.count=this.count,n.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(n.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(n.type="BatchedMesh",n.perObjectFrustumCulled=this.perObjectFrustumCulled,n.sortObjects=this.sortObjects,n.drawRanges=this._drawRanges,n.reservedRanges=this._reservedRanges,n.geometryInfo=this._geometryInfo.map(a=>({...a,boundingBox:a.boundingBox?a.boundingBox.toJSON():void 0,boundingSphere:a.boundingSphere?a.boundingSphere.toJSON():void 0})),n.instanceInfo=this._instanceInfo.map(a=>({...a})),n.availableInstanceIds=this._availableInstanceIds.slice(),n.availableGeometryIds=this._availableGeometryIds.slice(),n.nextIndexStart=this._nextIndexStart,n.nextVertexStart=this._nextVertexStart,n.geometryCount=this._geometryCount,n.maxInstanceCount=this._maxInstanceCount,n.maxVertexCount=this._maxVertexCount,n.maxIndexCount=this._maxIndexCount,n.geometryInitialized=this._geometryInitialized,n.matricesTexture=this._matricesTexture.toJSON(t),n.indirectTexture=this._indirectTexture.toJSON(t),this._colorsTexture!==null&&(n.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(n.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(n.boundingBox=this.boundingBox.toJSON()));function r(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?n.background=this.background.toJSON():this.background.isTexture&&(n.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(n.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){n.geometry=r(t.geometries,this.geometry);let a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){let l=a.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){let f=l[c];r(t.shapes,f)}else r(t.shapes,l)}}if(this.isSkinnedMesh&&(n.bindMode=this.bindMode,n.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),n.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let a=[];for(let l=0,c=this.material.length;l<c;l++)a.push(r(t.materials,this.material[l]));n.material=a}else n.material=r(t.materials,this.material);if(this.children.length>0){n.children=[];for(let a=0;a<this.children.length;a++)n.children.push(this.children[a].toJSON(t).object)}if(this.animations.length>0){n.animations=[];for(let a=0;a<this.animations.length;a++){let l=this.animations[a];n.animations.push(r(t.animations,l))}}if(e){let a=o(t.geometries),l=o(t.materials),c=o(t.textures),h=o(t.images),f=o(t.shapes),u=o(t.skeletons),d=o(t.animations),m=o(t.nodes);a.length>0&&(i.geometries=a),l.length>0&&(i.materials=l),c.length>0&&(i.textures=c),h.length>0&&(i.images=h),f.length>0&&(i.shapes=f),u.length>0&&(i.skeletons=u),d.length>0&&(i.animations=d),m.length>0&&(i.nodes=m)}return i.object=n,i;function o(a){let l=[];for(let c in a){let h=a[c];delete h.metadata,l.push(h)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.pivot=t.pivot!==null?t.pivot.clone():null,this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.static=t.static,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let i=0;i<t.children.length;i++){let n=t.children[i];this.add(n.clone())}return this}dispose(){this.dispatchEvent({type:"dispose"})}};Ge.DEFAULT_UP=new D(0,1,0);Ge.DEFAULT_MATRIX_AUTO_UPDATE=!0;Ge.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var ci=class extends Ge{constructor(){super(),this.isGroup=!0,this.type="Group"}},zf={type:"move"},Ss=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new ci,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new ci,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new D,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new D),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new ci,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new D,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new D,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){let e=this._hand;if(e)for(let i of t.hand.values())this._getHandJoint(e,i)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,i){let n=null,r=null,o=null,a=this._targetRay,l=this._grip,c=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(c&&t.hand){o=!0;for(let _ of t.hand.values()){let p=e.getJointPose(_,i),g=this._getHandJoint(c,_);p!==null&&(g.matrix.fromArray(p.transform.matrix),g.matrix.decompose(g.position,g.rotation,g.scale),g.matrixWorldNeedsUpdate=!0,g.jointRadius=p.radius),g.visible=p!==null}let h=c.joints["index-finger-tip"],f=c.joints["thumb-tip"],u=h.position.distanceTo(f.position),d=.02,m=.005;c.inputState.pinching&&u>d+m?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!c.inputState.pinching&&u<=d-m&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else l!==null&&t.gripSpace&&(r=e.getPose(t.gripSpace,i),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:t,target:this})));a!==null&&(n=e.getPose(t.targetRaySpace,i),n===null&&r!==null&&(n=r),n!==null&&(a.matrix.fromArray(n.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,n.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(n.linearVelocity)):a.hasLinearVelocity=!1,n.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(n.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(zf)))}return a!==null&&(a.visible=n!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=o!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){let i=new ci;i.matrixAutoUpdate=!1,i.visible=!1,t.joints[e.jointName]=i,t.add(i)}return t.joints[e.jointName]}},Ju={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},hn={h:0,s:0,l:0},_o={h:0,s:0,l:0};function Yl(s,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?s+(t-s)*6*e:e<1/2?t:e<2/3?s+(t-s)*6*(2/3-e):s}var Vt=class{constructor(t,e,i){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,i)}set(t,e,i){if(e===void 0&&i===void 0){let n=t;n&&n.isColor?this.copy(n):typeof n=="number"?this.setHex(n):typeof n=="string"&&this.setStyle(n)}else this.setRGB(t,e,i);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=Pe){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,ne.colorSpaceToWorking(this,e),this}setRGB(t,e,i,n=ne.workingColorSpace){return this.r=t,this.g=e,this.b=i,ne.colorSpaceToWorking(this,n),this}setHSL(t,e,i,n=ne.workingColorSpace){if(t=Vc(t,1),e=Qt(e,0,1),i=Qt(i,0,1),e===0)this.r=this.g=this.b=i;else{let r=i<=.5?i*(1+e):i+e-i*e,o=2*i-r;this.r=Yl(o,r,t+1/3),this.g=Yl(o,r,t),this.b=Yl(o,r,t-1/3)}return ne.colorSpaceToWorking(this,n),this}setStyle(t,e=Pe){function i(r){r!==void 0&&parseFloat(r)<1&&Yt("Color: Alpha component of "+t+" will be ignored.")}let n;if(n=/^(\w+)\(([^\)]*)\)/.exec(t)){let r,o=n[1],a=n[2];switch(o){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,e);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return i(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:Yt("Color: Unknown color model "+t)}}else if(n=/^\#([A-Fa-f\d]+)$/.exec(t)){let r=n[1],o=r.length;if(o===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(o===6)return this.setHex(parseInt(r,16),e);Yt("Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=Pe){let i=Ju[t.toLowerCase()];return i!==void 0?this.setHex(i,e):Yt("Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=nn(t.r),this.g=nn(t.g),this.b=nn(t.b),this}copyLinearToSRGB(t){return this.r=gs(t.r),this.g=gs(t.g),this.b=gs(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=Pe){return ne.workingToColorSpace(Ze.copy(this),t),Math.round(Qt(Ze.r*255,0,255))*65536+Math.round(Qt(Ze.g*255,0,255))*256+Math.round(Qt(Ze.b*255,0,255))}getHexString(t=Pe){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=ne.workingColorSpace){ne.workingToColorSpace(Ze.copy(this),e);let i=Ze.r,n=Ze.g,r=Ze.b,o=Math.max(i,n,r),a=Math.min(i,n,r),l,c,h=(a+o)/2;if(a===o)l=0,c=0;else{let f=o-a;switch(c=h<=.5?f/(o+a):f/(2-o-a),o){case i:l=(n-r)/f+(n<r?6:0);break;case n:l=(r-i)/f+2;break;case r:l=(i-n)/f+4;break}l/=6}return t.h=l,t.s=c,t.l=h,t}getRGB(t,e=ne.workingColorSpace){return ne.workingToColorSpace(Ze.copy(this),e),t.r=Ze.r,t.g=Ze.g,t.b=Ze.b,t}getStyle(t=Pe){ne.workingToColorSpace(Ze.copy(this),t);let e=Ze.r,i=Ze.g,n=Ze.b;return t!==Pe?`color(${t} ${e.toFixed(3)} ${i.toFixed(3)} ${n.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(i*255)},${Math.round(n*255)})`}offsetHSL(t,e,i){return this.getHSL(hn),this.setHSL(hn.h+t,hn.s+e,hn.l+i)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,i){return this.r=t.r+(e.r-t.r)*i,this.g=t.g+(e.g-t.g)*i,this.b=t.b+(e.b-t.b)*i,this}lerpHSL(t,e){this.getHSL(hn),t.getHSL(_o);let i=er(hn.h,_o.h,e),n=er(hn.s,_o.s,e),r=er(hn.l,_o.l,e);return this.setHSL(i,n,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){let e=this.r,i=this.g,n=this.b,r=t.elements;return this.r=r[0]*e+r[3]*i+r[6]*n,this.g=r[1]*e+r[4]*i+r[7]*n,this.b=r[2]*e+r[5]*i+r[8]*n,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},Ze=new Vt;Vt.NAMES=Ju;var On=class extends Ge{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new zi,this.environmentIntensity=1,this.environmentRotation=new zi,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){let e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),e.object.backgroundBlurriness=this.backgroundBlurriness,e.object.backgroundIntensity=this.backgroundIntensity,e.object.backgroundRotation=this.backgroundRotation.toArray(),e.object.environmentIntensity=this.environmentIntensity,e.object.environmentRotation=this.environmentRotation.toArray(),e}},Mi=new D,ji=new D,Zl=new D,Ki=new D,ns=new D,ss=new D,jh=new D,$l=new D,Jl=new D,jl=new D,Kl=new _e,Ql=new _e,tc=new _e,en=class s{constructor(t=new D,e=new D,i=new D){this.a=t,this.b=e,this.c=i}static getNormal(t,e,i,n){n.subVectors(i,e),Mi.subVectors(t,e),n.cross(Mi);let r=n.lengthSq();return r>0?n.multiplyScalar(1/Math.sqrt(r)):n.set(0,0,0)}static getBarycoord(t,e,i,n,r){Mi.subVectors(n,e),ji.subVectors(i,e),Zl.subVectors(t,e);let o=Mi.dot(Mi),a=Mi.dot(ji),l=Mi.dot(Zl),c=ji.dot(ji),h=ji.dot(Zl),f=o*c-a*a;if(f===0)return r.set(0,0,0),null;let u=1/f,d=(c*l-a*h)*u,m=(o*h-a*l)*u;return r.set(1-d-m,m,d)}static containsPoint(t,e,i,n){return this.getBarycoord(t,e,i,n,Ki)===null?!1:Ki.x>=0&&Ki.y>=0&&Ki.x+Ki.y<=1}static getInterpolation(t,e,i,n,r,o,a,l){return this.getBarycoord(t,e,i,n,Ki)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,Ki.x),l.addScaledVector(o,Ki.y),l.addScaledVector(a,Ki.z),l)}static getInterpolatedAttribute(t,e,i,n,r,o){return Kl.setScalar(0),Ql.setScalar(0),tc.setScalar(0),Kl.fromBufferAttribute(t,e),Ql.fromBufferAttribute(t,i),tc.fromBufferAttribute(t,n),o.setScalar(0),o.addScaledVector(Kl,r.x),o.addScaledVector(Ql,r.y),o.addScaledVector(tc,r.z),o}static isFrontFacing(t,e,i,n){return Mi.subVectors(i,e),ji.subVectors(t,e),Mi.cross(ji).dot(n)<0}set(t,e,i){return this.a.copy(t),this.b.copy(e),this.c.copy(i),this}setFromPointsAndIndices(t,e,i,n){return this.a.copy(t[e]),this.b.copy(t[i]),this.c.copy(t[n]),this}setFromAttributeAndIndices(t,e,i,n){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,i),this.c.fromBufferAttribute(t,n),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return Mi.subVectors(this.c,this.b),ji.subVectors(this.a,this.b),Mi.cross(ji).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return s.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return s.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,i,n,r){return s.getInterpolation(t,this.a,this.b,this.c,e,i,n,r)}containsPoint(t){return s.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return s.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){let i=this.a,n=this.b,r=this.c,o,a;ns.subVectors(n,i),ss.subVectors(r,i),$l.subVectors(t,i);let l=ns.dot($l),c=ss.dot($l);if(l<=0&&c<=0)return e.copy(i);Jl.subVectors(t,n);let h=ns.dot(Jl),f=ss.dot(Jl);if(h>=0&&f<=h)return e.copy(n);let u=l*f-h*c;if(u<=0&&l>=0&&h<=0)return o=l/(l-h),e.copy(i).addScaledVector(ns,o);jl.subVectors(t,r);let d=ns.dot(jl),m=ss.dot(jl);if(m>=0&&d<=m)return e.copy(r);let _=d*c-l*m;if(_<=0&&c>=0&&m<=0)return a=c/(c-m),e.copy(i).addScaledVector(ss,a);let p=h*m-d*f;if(p<=0&&f-h>=0&&d-m>=0)return jh.subVectors(r,n),a=(f-h)/(f-h+(d-m)),e.copy(n).addScaledVector(jh,a);let g=1/(p+_+u);return o=_*g,a=u*g,e.copy(i).addScaledVector(ns,o).addScaledVector(ss,a)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}},pn=class{constructor(t=new D(1/0,1/0,1/0),e=new D(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,i=t.length;e<i;e+=3)this.expandByPoint(bi.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,i=t.count;e<i;e++)this.expandByPoint(bi.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,i=t.length;e<i;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){let i=bi.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(i),this.max.copy(t).add(i),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);let i=t.geometry;if(i!==void 0){let r=i.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0)for(let o=0,a=r.count;o<a;o++)t.isMesh===!0?t.getVertexPosition(o,bi):bi.fromBufferAttribute(r,o),bi.applyMatrix4(t.matrixWorld),this.expandByPoint(bi);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),vo.copy(t.boundingBox)):(i.boundingBox===null&&i.computeBoundingBox(),vo.copy(i.boundingBox)),vo.applyMatrix4(t.matrixWorld),this.union(vo)}let n=t.children;for(let r=0,o=n.length;r<o;r++)this.expandByObject(n[r],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,bi),bi.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,i;return t.normal.x>0?(e=t.normal.x*this.min.x,i=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,i=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,i+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,i+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,i+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,i+=t.normal.z*this.min.z),e<=-t.constant&&i>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(Ys),xo.subVectors(this.max,Ys),rs.subVectors(t.a,Ys),os.subVectors(t.b,Ys),as.subVectors(t.c,Ys),un.subVectors(os,rs),dn.subVectors(as,os),Ln.subVectors(rs,as);let e=[0,-un.z,un.y,0,-dn.z,dn.y,0,-Ln.z,Ln.y,un.z,0,-un.x,dn.z,0,-dn.x,Ln.z,0,-Ln.x,-un.y,un.x,0,-dn.y,dn.x,0,-Ln.y,Ln.x,0];return!ec(e,rs,os,as,xo)||(e=[1,0,0,0,1,0,0,0,1],!ec(e,rs,os,as,xo))?!1:(yo.crossVectors(un,dn),e=[yo.x,yo.y,yo.z],ec(e,rs,os,as,xo))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,bi).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(bi).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(Qi[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),Qi[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),Qi[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),Qi[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),Qi[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),Qi[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),Qi[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),Qi[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(Qi),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(t){return this.min.fromArray(t.min),this.max.fromArray(t.max),this}},Qi=[new D,new D,new D,new D,new D,new D,new D,new D],bi=new D,vo=new pn,rs=new D,os=new D,as=new D,un=new D,dn=new D,Ln=new D,Ys=new D,xo=new D,yo=new D,Dn=new D;function ec(s,t,e,i,n){for(let r=0,o=s.length-3;r<=o;r+=3){Dn.fromArray(s,r);let a=n.x*Math.abs(Dn.x)+n.y*Math.abs(Dn.y)+n.z*Math.abs(Dn.z),l=t.dot(Dn),c=e.dot(Dn),h=i.dot(Dn);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>a)return!1}return!0}var Re=new D,Mo=new tt,Vf=0,Le=class extends Ei{constructor(t,e,i=!1){if(super(),Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Vf++}),this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=i,this.usage=kc,this.updateRanges=[],this.gpuType=Ri,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,i){t*=this.itemSize,i*=e.itemSize;for(let n=0,r=this.itemSize;n<r;n++)this.array[t+n]=e.array[i+n];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,i=this.count;e<i;e++)Mo.fromBufferAttribute(this,e),Mo.applyMatrix3(t),this.setXY(e,Mo.x,Mo.y);else if(this.itemSize===3)for(let e=0,i=this.count;e<i;e++)Re.fromBufferAttribute(this,e),Re.applyMatrix3(t),this.setXYZ(e,Re.x,Re.y,Re.z);return this}applyMatrix4(t){for(let e=0,i=this.count;e<i;e++)Re.fromBufferAttribute(this,e),Re.applyMatrix4(t),this.setXYZ(e,Re.x,Re.y,Re.z);return this}applyNormalMatrix(t){for(let e=0,i=this.count;e<i;e++)Re.fromBufferAttribute(this,e),Re.applyNormalMatrix(t),this.setXYZ(e,Re.x,Re.y,Re.z);return this}transformDirection(t){for(let e=0,i=this.count;e<i;e++)Re.fromBufferAttribute(this,e),Re.transformDirection(t),this.setXYZ(e,Re.x,Re.y,Re.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let i=this.array[t*this.itemSize+e];return this.normalized&&(i=Si(i,this.array)),i}setComponent(t,e,i){return this.normalized&&(i=de(i,this.array)),this.array[t*this.itemSize+e]=i,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=Si(e,this.array)),e}setX(t,e){return this.normalized&&(e=de(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=Si(e,this.array)),e}setY(t,e){return this.normalized&&(e=de(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=Si(e,this.array)),e}setZ(t,e){return this.normalized&&(e=de(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=Si(e,this.array)),e}setW(t,e){return this.normalized&&(e=de(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,i){return t*=this.itemSize,this.normalized&&(e=de(e,this.array),i=de(i,this.array)),this.array[t+0]=e,this.array[t+1]=i,this}setXYZ(t,e,i,n){return t*=this.itemSize,this.normalized&&(e=de(e,this.array),i=de(i,this.array),n=de(n,this.array)),this.array[t+0]=e,this.array[t+1]=i,this.array[t+2]=n,this}setXYZW(t,e,i,n,r){return t*=this.itemSize,this.normalized&&(e=de(e,this.array),i=de(i,this.array),n=de(n,this.array),r=de(r,this.array)),this.array[t+0]=e,this.array[t+1]=i,this.array[t+2]=n,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return t.name=this.name,t.usage=this.usage,t.gpuType=this.gpuType,t}dispose(){this.dispatchEvent({type:"dispose"})}};var hr=class extends Le{constructor(t,e,i){super(new Uint16Array(t),e,i)}};var ur=class extends Le{constructor(t,e,i){super(new Uint32Array(t),e,i)}};var ge=class extends Le{constructor(t,e,i){super(new Float32Array(t),e,i)}},Hf=new pn,Zs=new D,ic=new D,ws=class{constructor(t=new D,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){let i=this.center;e!==void 0?i.copy(e):Hf.setFromPoints(t).getCenter(i);let n=0;for(let r=0,o=t.length;r<o;r++)n=Math.max(n,i.distanceToSquared(t[r]));return this.radius=Math.sqrt(n),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){let e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){let i=this.center.distanceToSquared(t);return e.copy(t),i>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;Zs.subVectors(t,this.center);let e=Zs.lengthSq();if(e>this.radius*this.radius){let i=Math.sqrt(e),n=(i-this.radius)*.5;this.center.addScaledVector(Zs,n/i),this.radius+=n}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(ic.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(Zs.copy(t.center).add(ic)),this.expandByPoint(Zs.copy(t.center).sub(ic))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(t){return this.radius=t.radius,this.center.fromArray(t.center),this}},Gf=0,mi=new oe,nc=new Ge,ls=new D,li=new pn,$s=new pn,ke=new D,De=class s extends Ei{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Gf++}),this.uuid=Bi(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(ff(t)?ur:hr)(t,1):this.index=t,this}setIndirect(t,e=0){return this.indirect=t,this.indirectOffset=e,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,i=0){this.groups.push({start:t,count:e,materialIndex:i})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){let e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);let i=this.attributes.normal;if(i!==void 0){let r=new jt().getNormalMatrix(t);i.applyNormalMatrix(r),i.needsUpdate=!0}let n=this.attributes.tangent;return n!==void 0&&(n.transformDirection(t),n.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(t){return mi.makeRotationFromQuaternion(t),this.applyMatrix4(mi),this}rotateX(t){return mi.makeRotationX(t),this.applyMatrix4(mi),this}rotateY(t){return mi.makeRotationY(t),this.applyMatrix4(mi),this}rotateZ(t){return mi.makeRotationZ(t),this.applyMatrix4(mi),this}translate(t,e,i){return mi.makeTranslation(t,e,i),this.applyMatrix4(mi),this}scale(t,e,i){return mi.makeScale(t,e,i),this.applyMatrix4(mi),this}lookAt(t){return nc.lookAt(t),nc.updateMatrix(),this.applyMatrix4(nc.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(ls).negate(),this.translate(ls.x,ls.y,ls.z),this}setFromPoints(t){let e=this.getAttribute("position");if(e===void 0){let i=[];for(let n=0,r=t.length;n<r;n++){let o=t[n];i.push(o.x,o.y,o.z||0)}this.setAttribute("position",new ge(i,3))}else{let i=Math.min(t.length,e.count);for(let n=0;n<i;n++){let r=t[n];e.setXYZ(n,r.x,r.y,r.z||0)}t.length>e.count&&Yt("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new pn);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){qt("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new D(-1/0,-1/0,-1/0),new D(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let i=0,n=e.length;i<n;i++){let r=e[i];li.setFromBufferAttribute(r),this.morphTargetsRelative?(ke.addVectors(this.boundingBox.min,li.min),this.boundingBox.expandByPoint(ke),ke.addVectors(this.boundingBox.max,li.max),this.boundingBox.expandByPoint(ke)):(this.boundingBox.expandByPoint(li.min),this.boundingBox.expandByPoint(li.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&qt('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new ws);let t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){qt("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new D,1/0);return}if(t){let i=this.boundingSphere.center;if(li.setFromBufferAttribute(t),e)for(let r=0,o=e.length;r<o;r++){let a=e[r];$s.setFromBufferAttribute(a),this.morphTargetsRelative?(ke.addVectors(li.min,$s.min),li.expandByPoint(ke),ke.addVectors(li.max,$s.max),li.expandByPoint(ke)):(li.expandByPoint($s.min),li.expandByPoint($s.max))}li.getCenter(i);let n=0;for(let r=0,o=t.count;r<o;r++)ke.fromBufferAttribute(t,r),n=Math.max(n,i.distanceToSquared(ke));if(e)for(let r=0,o=e.length;r<o;r++){let a=e[r],l=this.morphTargetsRelative;for(let c=0,h=a.count;c<h;c++)ke.fromBufferAttribute(a,c),l&&(ls.fromBufferAttribute(t,c),ke.add(ls)),n=Math.max(n,i.distanceToSquared(ke))}this.boundingSphere.radius=Math.sqrt(n),isNaN(this.boundingSphere.radius)&&qt('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){qt("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let i=e.position,n=e.normal,r=e.uv,o=this.getAttribute("tangent");(o===void 0||o.count!==i.count)&&(o=new Le(new Float32Array(4*i.count),4),this.setAttribute("tangent",o));let a=[],l=[];for(let x=0;x<i.count;x++)a[x]=new D,l[x]=new D;let c=new D,h=new D,f=new D,u=new tt,d=new tt,m=new tt,_=new D,p=new D;function g(x,A,L){c.fromBufferAttribute(i,x),h.fromBufferAttribute(i,A),f.fromBufferAttribute(i,L),u.fromBufferAttribute(r,x),d.fromBufferAttribute(r,A),m.fromBufferAttribute(r,L),h.sub(c),f.sub(c),d.sub(u),m.sub(u);let U=1/(d.x*m.y-m.x*d.y);isFinite(U)&&(_.copy(h).multiplyScalar(m.y).addScaledVector(f,-d.y).multiplyScalar(U),p.copy(f).multiplyScalar(d.x).addScaledVector(h,-m.x).multiplyScalar(U),a[x].add(_),a[A].add(_),a[L].add(_),l[x].add(p),l[A].add(p),l[L].add(p))}let M=this.groups;M.length===0&&(M=[{start:0,count:t.count}]);for(let x=0,A=M.length;x<A;++x){let L=M[x],U=L.start,w=L.count;for(let P=U,I=U+w;P<I;P+=3)g(t.getX(P+0),t.getX(P+1),t.getX(P+2))}let T=new D,y=new D,b=new D,E=new D;function C(x){b.fromBufferAttribute(n,x),E.copy(b);let A=a[x];T.copy(A),T.sub(b.multiplyScalar(b.dot(A))).normalize(),y.crossVectors(E,A);let U=y.dot(l[x])<0?-1:1;o.setXYZW(x,T.x,T.y,T.z,U)}for(let x=0,A=M.length;x<A;++x){let L=M[x],U=L.start,w=L.count;for(let P=U,I=U+w;P<I;P+=3)C(t.getX(P+0)),C(t.getX(P+1)),C(t.getX(P+2))}this._transformed=!0}computeVertexNormals(){let t=this.index,e=this.getAttribute("position");if(e!==void 0){let i=this.getAttribute("normal");if(i===void 0||i.count!==e.count)i=new Le(new Float32Array(e.count*3),3),this.setAttribute("normal",i);else for(let u=0,d=i.count;u<d;u++)i.setXYZ(u,0,0,0);let n=new D,r=new D,o=new D,a=new D,l=new D,c=new D,h=new D,f=new D;if(t)for(let u=0,d=t.count;u<d;u+=3){let m=t.getX(u+0),_=t.getX(u+1),p=t.getX(u+2);n.fromBufferAttribute(e,m),r.fromBufferAttribute(e,_),o.fromBufferAttribute(e,p),h.subVectors(o,r),f.subVectors(n,r),h.cross(f),a.fromBufferAttribute(i,m),l.fromBufferAttribute(i,_),c.fromBufferAttribute(i,p),a.add(h),l.add(h),c.add(h),i.setXYZ(m,a.x,a.y,a.z),i.setXYZ(_,l.x,l.y,l.z),i.setXYZ(p,c.x,c.y,c.z)}else for(let u=0,d=e.count;u<d;u+=3)n.fromBufferAttribute(e,u+0),r.fromBufferAttribute(e,u+1),o.fromBufferAttribute(e,u+2),h.subVectors(o,r),f.subVectors(n,r),h.cross(f),i.setXYZ(u+0,h.x,h.y,h.z),i.setXYZ(u+1,h.x,h.y,h.z),i.setXYZ(u+2,h.x,h.y,h.z);this.normalizeNormals(),i.needsUpdate=!0}}normalizeNormals(){let t=this.attributes.normal;for(let e=0,i=t.count;e<i;e++)ke.fromBufferAttribute(t,e),ke.normalize(),t.setXYZ(e,ke.x,ke.y,ke.z)}toNonIndexed(){function t(a,l){let c=a.array,h=a.itemSize,f=a.normalized,u=new c.constructor(l.length*h),d=0,m=0;for(let _=0,p=l.length;_<p;_++){a.isInterleavedBufferAttribute?d=l[_]*a.data.stride+a.offset:d=l[_]*h;for(let g=0;g<h;g++)u[m++]=c[d++]}return new Le(u,h,f)}if(this.index===null)return Yt("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let e=new s,i=this.index.array,n=this.attributes;for(let a in n){let l=n[a],c=t(l,i);e.setAttribute(a,c)}let r=this.morphAttributes;for(let a in r){let l=[],c=r[a];for(let h=0,f=c.length;h<f;h++){let u=c[h],d=t(u,i);l.push(d)}e.morphAttributes[a]=l}e.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let a=0,l=o.length;a<l;a++){let c=o[a];e.addGroup(c.start,c.count,c.materialIndex)}return e}toJSON(){let t={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,t.name=this.name,Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){let l=this.parameters;for(let c in l)l[c]!==void 0&&(t[c]=l[c]);return t}t.data={attributes:{}};let e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});let i=this.attributes;for(let l in i){let c=i[l];t.data.attributes[l]=c.toJSON(t.data)}let n={},r=!1;for(let l in this.morphAttributes){let c=this.morphAttributes[l],h=[];for(let f=0,u=c.length;f<u;f++){let d=c[f];h.push(d.toJSON(t.data))}h.length>0&&(n[l]=h,r=!0)}r&&(t.data.morphAttributes=n,t.data.morphTargetsRelative=this.morphTargetsRelative);let o=this.groups;o.length>0&&(t.data.groups=JSON.parse(JSON.stringify(o)));let a=this.boundingSphere;return a!==null&&(t.data.boundingSphere=a.toJSON()),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let e={};this.name=t.name;let i=t.index;i!==null&&this.setIndex(i.clone());let n=t.attributes;for(let c in n){let h=n[c];this.setAttribute(c,h.clone(e))}let r=t.morphAttributes;for(let c in r){let h=[],f=r[c];for(let u=0,d=f.length;u<d;u++)h.push(f[u].clone(e));this.morphAttributes[c]=h}this.morphTargetsRelative=t.morphTargetsRelative;let o=t.groups;for(let c=0,h=o.length;c<h;c++){let f=o[c];this.addGroup(f.start,f.count,f.materialIndex)}let a=t.boundingBox;a!==null&&(this.boundingBox=a.clone());let l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this._transformed=t._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}},dr=class{constructor(t,e){this.isInterleavedBuffer=!0,this.array=t,this.stride=e,this.count=t!==void 0?t.length/e:0,this.usage=kc,this.updateRanges=[],this.version=0,this.uuid=Bi()}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.array=new t.array.constructor(t.array),this.count=t.count,this.stride=t.stride,this.usage=t.usage,this}copyAt(t,e,i){t*=this.stride,i*=e.stride;for(let n=0,r=this.stride;n<r;n++)this.array[t+n]=e.array[i+n];return this}set(t,e=0){return this.array.set(t,e),this}clone(t){t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Bi()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=this.array.slice(0).buffer);let e=new this.array.constructor(t.arrayBuffers[this.array.buffer._uuid]),i=new this.constructor(e,this.stride);return i.setUsage(this.usage),i}onUpload(t){return this.onUploadCallback=t,this}toJSON(t){t.arrayBuffers===void 0&&(t.arrayBuffers={}),this.array.buffer._uuid===void 0&&(this.array.buffer._uuid=Bi()),t.arrayBuffers[this.array.buffer._uuid]===void 0&&(t.arrayBuffers[this.array.buffer._uuid]=Array.from(new Uint32Array(this.array.buffer)));let e={uuid:this.uuid,buffer:this.array.buffer._uuid,type:this.array.constructor.name,stride:this.stride};return e.usage=this.usage,e}},Qe=new D,Es=class s{constructor(t,e,i,n=!1){this.isInterleavedBufferAttribute=!0,this.name="",this.data=t,this.itemSize=e,this.offset=i,this.normalized=n}get count(){return this.data.count}get array(){return this.data.array}set needsUpdate(t){this.data.needsUpdate=t}applyMatrix4(t){for(let e=0,i=this.data.count;e<i;e++)Qe.fromBufferAttribute(this,e),Qe.applyMatrix4(t),this.setXYZ(e,Qe.x,Qe.y,Qe.z);return this}applyNormalMatrix(t){for(let e=0,i=this.count;e<i;e++)Qe.fromBufferAttribute(this,e),Qe.applyNormalMatrix(t),this.setXYZ(e,Qe.x,Qe.y,Qe.z);return this}transformDirection(t){for(let e=0,i=this.count;e<i;e++)Qe.fromBufferAttribute(this,e),Qe.transformDirection(t),this.setXYZ(e,Qe.x,Qe.y,Qe.z);return this}getComponent(t,e){let i=this.array[t*this.data.stride+this.offset+e];return this.normalized&&(i=Si(i,this.array)),i}setComponent(t,e,i){return this.normalized&&(i=de(i,this.array)),this.data.array[t*this.data.stride+this.offset+e]=i,this}setX(t,e){return this.normalized&&(e=de(e,this.array)),this.data.array[t*this.data.stride+this.offset]=e,this}setY(t,e){return this.normalized&&(e=de(e,this.array)),this.data.array[t*this.data.stride+this.offset+1]=e,this}setZ(t,e){return this.normalized&&(e=de(e,this.array)),this.data.array[t*this.data.stride+this.offset+2]=e,this}setW(t,e){return this.normalized&&(e=de(e,this.array)),this.data.array[t*this.data.stride+this.offset+3]=e,this}getX(t){let e=this.data.array[t*this.data.stride+this.offset];return this.normalized&&(e=Si(e,this.array)),e}getY(t){let e=this.data.array[t*this.data.stride+this.offset+1];return this.normalized&&(e=Si(e,this.array)),e}getZ(t){let e=this.data.array[t*this.data.stride+this.offset+2];return this.normalized&&(e=Si(e,this.array)),e}getW(t){let e=this.data.array[t*this.data.stride+this.offset+3];return this.normalized&&(e=Si(e,this.array)),e}setXY(t,e,i){return t=t*this.data.stride+this.offset,this.normalized&&(e=de(e,this.array),i=de(i,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=i,this}setXYZ(t,e,i,n){return t=t*this.data.stride+this.offset,this.normalized&&(e=de(e,this.array),i=de(i,this.array),n=de(n,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=i,this.data.array[t+2]=n,this}setXYZW(t,e,i,n,r){return t=t*this.data.stride+this.offset,this.normalized&&(e=de(e,this.array),i=de(i,this.array),n=de(n,this.array),r=de(r,this.array)),this.data.array[t+0]=e,this.data.array[t+1]=i,this.data.array[t+2]=n,this.data.array[t+3]=r,this}clone(t){if(t===void 0){lr("InterleavedBufferAttribute.clone(): Cloning an interleaved buffer attribute will de-interleave buffer data.");let e=[];for(let i=0;i<this.count;i++){let n=i*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[n+r])}return new Le(new this.array.constructor(e),this.itemSize,this.normalized)}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.clone(t)),new s(t.interleavedBuffers[this.data.uuid],this.itemSize,this.offset,this.normalized)}toJSON(t){if(t===void 0){lr("InterleavedBufferAttribute.toJSON(): Serializing an interleaved buffer attribute will de-interleave buffer data.");let e=[];for(let i=0;i<this.count;i++){let n=i*this.data.stride+this.offset;for(let r=0;r<this.itemSize;r++)e.push(this.data.array[n+r])}return{itemSize:this.itemSize,type:this.array.constructor.name,array:e,normalized:this.normalized}}else return t.interleavedBuffers===void 0&&(t.interleavedBuffers={}),t.interleavedBuffers[this.data.uuid]===void 0&&(t.interleavedBuffers[this.data.uuid]=this.data.toJSON(t)),{isInterleavedBufferAttribute:!0,itemSize:this.itemSize,data:this.data.uuid,offset:this.offset,normalized:this.normalized}}},sc=new D,Wf=new D,Xf=new jt,ti=class{constructor(t=new D(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,i,n){return this.normal.set(t,e,i),this.constant=n,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,i){let n=sc.subVectors(i,e).cross(Wf.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(n,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){let t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e,i=!0){let n=t.delta(sc),r=this.normal.dot(n);if(r===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;let o=-(t.start.dot(this.normal)+this.constant)/r;return i===!0&&(o<0||o>1)?null:e.copy(t.start).addScaledVector(n,o)}intersectsLine(t){let e=this.distanceToPoint(t.start),i=this.distanceToPoint(t.end);return e<0&&i>0||i<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){let i=e||Xf.getNormalMatrix(t),n=this.coplanarPoint(sc).applyMatrix4(t),r=this.normal.applyMatrix3(i).normalize();return this.constant=-n.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(t){return this.normal.fromArray(t.normal),this.constant=t.constant,this}},qf=0,Ti=class extends Ei{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:qf++}),this.uuid=Bi(),this.name="",this.type="Material",this.blending=Ns,this.side=wn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Rc,this.blendDst=Pc,this.blendEquation=_i,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Vt(0,0,0),this.blendAlpha=0,this.depthFunc=_s,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=ku,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=zo,this.stencilZFail=zo,this.stencilZPass=zo,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(let e in t){let i=t[e];if(i===void 0){Yt(`Material: parameter '${e}' has value of undefined.`);continue}let n=this[e];if(n===void 0){Yt(`Material: '${e}' is not a property of THREE.${this.type}.`);continue}n&&n.isColor?n.set(i):n&&n.isVector2&&i&&i.isVector2||n&&n.isEuler&&i&&i.isEuler||n&&n.isVector3&&i&&i.isVector3?n.copy(i):this[e]=i}}toJSON(t){let e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});let i={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};i.uuid=this.uuid,i.type=this.type,i.blending=this.blending,i.side=this.side,i.shadowSide=this.shadowSide,i.vertexColors=this.vertexColors,i.opacity=this.opacity,i.transparent=this.transparent,i.blendSrc=this.blendSrc,i.blendDst=this.blendDst,i.blendEquation=this.blendEquation,i.blendSrcAlpha=this.blendSrcAlpha,i.blendDstAlpha=this.blendDstAlpha,i.blendEquationAlpha=this.blendEquationAlpha,i.blendColor=this.blendColor.getHex(),i.blendAlpha=this.blendAlpha,i.depthFunc=this.depthFunc,i.depthTest=this.depthTest,i.depthWrite=this.depthWrite,i.colorWrite=this.colorWrite,i.clipIntersection=this.clipIntersection,i.clipShadows=this.clipShadows,i.stencilWriteMask=this.stencilWriteMask,i.stencilFunc=this.stencilFunc,i.stencilRef=this.stencilRef,i.stencilFuncMask=this.stencilFuncMask,i.stencilFail=this.stencilFail,i.stencilZFail=this.stencilZFail,i.stencilZPass=this.stencilZPass,i.stencilWrite=this.stencilWrite,i.polygonOffset=this.polygonOffset,i.polygonOffsetFactor=this.polygonOffsetFactor,i.polygonOffsetUnits=this.polygonOffsetUnits,i.dithering=this.dithering,i.alphaTest=this.alphaTest,i.alphaHash=this.alphaHash,i.alphaToCoverage=this.alphaToCoverage,i.premultipliedAlpha=this.premultipliedAlpha,i.forceSinglePass=this.forceSinglePass,i.allowOverride=this.allowOverride,i.visible=this.visible,i.toneMapped=this.toneMapped,i.name=this.name,this.color&&this.color.isColor&&(i.color=this.color.getHex()),this.roughness!==void 0&&(i.roughness=this.roughness),this.metalness!==void 0&&(i.metalness=this.metalness),this.sheen!==void 0&&(i.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(i.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(i.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(i.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(i.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(i.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(i.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(i.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(i.shininess=this.shininess),this.clearcoat!==void 0&&(i.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(i.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(i.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(i.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(i.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,i.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(i.sheenColorMap=this.sheenColorMap.toJSON(t).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(i.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(t).uuid),this.dispersion!==void 0&&(i.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(i.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(i.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(i.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(i.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(i.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(i.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(i.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(i.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(i.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(i.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(i.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(i.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(i.lightMap=this.lightMap.toJSON(t).uuid,i.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(i.aoMap=this.aoMap.toJSON(t).uuid,i.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(i.bumpMap=this.bumpMap.toJSON(t).uuid,i.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(i.normalMap=this.normalMap.toJSON(t).uuid,i.normalMapType=this.normalMapType,i.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(i.displacementMap=this.displacementMap.toJSON(t).uuid,i.displacementScale=this.displacementScale,i.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(i.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(i.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(i.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(i.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(i.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(i.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(i.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(i.combine=this.combine)),this.envMapRotation!==void 0&&(i.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(i.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(i.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(i.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(i.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(i.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(i.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(i.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(i.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&(i.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(i.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(i.size=this.size),this.sizeAttenuation!==void 0&&(i.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(i.clippingPlanes=this.clippingPlanes.map(r=>r.toJSON())),this.rotation!==void 0&&(i.rotation=this.rotation),this.depthPacking!==void 0&&(i.depthPacking=this.depthPacking),this.linewidth!==void 0&&(i.linewidth=this.linewidth),this.linecap!==void 0&&(i.linecap=this.linecap),this.linejoin!==void 0&&(i.linejoin=this.linejoin),this.dashSize!==void 0&&(i.dashSize=this.dashSize),this.gapSize!==void 0&&(i.gapSize=this.gapSize),this.scale!==void 0&&(i.scale=this.scale),this.wireframe!==void 0&&(i.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(i.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(i.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(i.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(i.flatShading=this.flatShading),this.fog!==void 0&&(i.fog=this.fog),Object.keys(this.userData).length>0&&(i.userData=this.userData);function n(r){let o=[];for(let a in r){let l=r[a];delete l.metadata,o.push(l)}return o}if(e){let r=n(t.textures),o=n(t.images);r.length>0&&(i.textures=r),o.length>0&&(i.images=o)}return i}fromJSON(t,e){if(t.uuid!==void 0&&(this.uuid=t.uuid),t.name!==void 0&&(this.name=t.name),t.color!==void 0&&this.color!==void 0&&this.color.setHex(t.color),t.roughness!==void 0&&(this.roughness=t.roughness),t.metalness!==void 0&&(this.metalness=t.metalness),t.sheen!==void 0&&(this.sheen=t.sheen),t.sheenColor!==void 0&&(this.sheenColor=new Vt().setHex(t.sheenColor)),t.sheenRoughness!==void 0&&(this.sheenRoughness=t.sheenRoughness),t.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(t.emissive),t.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(t.specular),t.specularIntensity!==void 0&&(this.specularIntensity=t.specularIntensity),t.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(t.specularColor),t.shininess!==void 0&&(this.shininess=t.shininess),t.clearcoat!==void 0&&(this.clearcoat=t.clearcoat),t.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=t.clearcoatRoughness),t.dispersion!==void 0&&(this.dispersion=t.dispersion),t.retroreflectivity!==void 0&&(this.retroreflectivity=t.retroreflectivity),t.iridescence!==void 0&&(this.iridescence=t.iridescence),t.iridescenceIOR!==void 0&&(this.iridescenceIOR=t.iridescenceIOR),t.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=t.iridescenceThicknessRange),t.transmission!==void 0&&(this.transmission=t.transmission),t.thickness!==void 0&&(this.thickness=t.thickness),t.attenuationDistance!==void 0&&(this.attenuationDistance=t.attenuationDistance),t.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(t.attenuationColor),t.anisotropy!==void 0&&(this.anisotropy=t.anisotropy),t.anisotropyRotation!==void 0&&(this.anisotropyRotation=t.anisotropyRotation),t.fog!==void 0&&(this.fog=t.fog),t.flatShading!==void 0&&(this.flatShading=t.flatShading),t.blending!==void 0&&(this.blending=t.blending),t.combine!==void 0&&(this.combine=t.combine),t.side!==void 0&&(this.side=t.side),t.shadowSide!==void 0&&(this.shadowSide=t.shadowSide),t.opacity!==void 0&&(this.opacity=t.opacity),t.transparent!==void 0&&(this.transparent=t.transparent),t.alphaTest!==void 0&&(this.alphaTest=t.alphaTest),t.alphaHash!==void 0&&(this.alphaHash=t.alphaHash),t.depthFunc!==void 0&&(this.depthFunc=t.depthFunc),t.depthTest!==void 0&&(this.depthTest=t.depthTest),t.depthWrite!==void 0&&(this.depthWrite=t.depthWrite),t.colorWrite!==void 0&&(this.colorWrite=t.colorWrite),t.clippingPlanes!==void 0&&(this.clippingPlanes=t.clippingPlanes.map(i=>new ti().fromJSON(i))),t.clipIntersection!==void 0&&(this.clipIntersection=t.clipIntersection),t.clipShadows!==void 0&&(this.clipShadows=t.clipShadows),t.depthPacking!==void 0&&(this.depthPacking=t.depthPacking),t.blendSrc!==void 0&&(this.blendSrc=t.blendSrc),t.blendDst!==void 0&&(this.blendDst=t.blendDst),t.blendEquation!==void 0&&(this.blendEquation=t.blendEquation),t.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=t.blendSrcAlpha),t.blendDstAlpha!==void 0&&(this.blendDstAlpha=t.blendDstAlpha),t.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=t.blendEquationAlpha),t.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(t.blendColor),t.blendAlpha!==void 0&&(this.blendAlpha=t.blendAlpha),t.stencilWriteMask!==void 0&&(this.stencilWriteMask=t.stencilWriteMask),t.stencilFunc!==void 0&&(this.stencilFunc=t.stencilFunc),t.stencilRef!==void 0&&(this.stencilRef=t.stencilRef),t.stencilFuncMask!==void 0&&(this.stencilFuncMask=t.stencilFuncMask),t.stencilFail!==void 0&&(this.stencilFail=t.stencilFail),t.stencilZFail!==void 0&&(this.stencilZFail=t.stencilZFail),t.stencilZPass!==void 0&&(this.stencilZPass=t.stencilZPass),t.stencilWrite!==void 0&&(this.stencilWrite=t.stencilWrite),t.wireframe!==void 0&&(this.wireframe=t.wireframe),t.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=t.wireframeLinewidth),t.wireframeLinecap!==void 0&&(this.wireframeLinecap=t.wireframeLinecap),t.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=t.wireframeLinejoin),t.rotation!==void 0&&(this.rotation=t.rotation),t.linewidth!==void 0&&(this.linewidth=t.linewidth),t.linecap!==void 0&&(this.linecap=t.linecap),t.linejoin!==void 0&&(this.linejoin=t.linejoin),t.dashSize!==void 0&&(this.dashSize=t.dashSize),t.gapSize!==void 0&&(this.gapSize=t.gapSize),t.scale!==void 0&&(this.scale=t.scale),t.polygonOffset!==void 0&&(this.polygonOffset=t.polygonOffset),t.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=t.polygonOffsetFactor),t.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=t.polygonOffsetUnits),t.dithering!==void 0&&(this.dithering=t.dithering),t.alphaToCoverage!==void 0&&(this.alphaToCoverage=t.alphaToCoverage),t.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=t.premultipliedAlpha),t.forceSinglePass!==void 0&&(this.forceSinglePass=t.forceSinglePass),t.allowOverride!==void 0&&(this.allowOverride=t.allowOverride),t.visible!==void 0&&(this.visible=t.visible),t.toneMapped!==void 0&&(this.toneMapped=t.toneMapped),t.userData!==void 0&&(this.userData=t.userData),t.vertexColors!==void 0&&(typeof t.vertexColors=="number"?this.vertexColors=t.vertexColors>0:this.vertexColors=t.vertexColors),t.size!==void 0&&(this.size=t.size),t.sizeAttenuation!==void 0&&(this.sizeAttenuation=t.sizeAttenuation),t.map!==void 0&&(this.map=e[t.map]||null),t.matcap!==void 0&&(this.matcap=e[t.matcap]||null),t.alphaMap!==void 0&&(this.alphaMap=e[t.alphaMap]||null),t.bumpMap!==void 0&&(this.bumpMap=e[t.bumpMap]||null),t.bumpScale!==void 0&&(this.bumpScale=t.bumpScale),t.normalMap!==void 0&&(this.normalMap=e[t.normalMap]||null),t.normalMapType!==void 0&&(this.normalMapType=t.normalMapType),t.normalScale!==void 0){let i=t.normalScale;Array.isArray(i)===!1&&(i=[i,i]),this.normalScale=new tt().fromArray(i)}return t.displacementMap!==void 0&&(this.displacementMap=e[t.displacementMap]||null),t.displacementScale!==void 0&&(this.displacementScale=t.displacementScale),t.displacementBias!==void 0&&(this.displacementBias=t.displacementBias),t.roughnessMap!==void 0&&(this.roughnessMap=e[t.roughnessMap]||null),t.metalnessMap!==void 0&&(this.metalnessMap=e[t.metalnessMap]||null),t.emissiveMap!==void 0&&(this.emissiveMap=e[t.emissiveMap]||null),t.emissiveIntensity!==void 0&&(this.emissiveIntensity=t.emissiveIntensity),t.specularMap!==void 0&&(this.specularMap=e[t.specularMap]||null),t.specularIntensityMap!==void 0&&(this.specularIntensityMap=e[t.specularIntensityMap]||null),t.specularColorMap!==void 0&&(this.specularColorMap=e[t.specularColorMap]||null),t.envMap!==void 0&&(this.envMap=e[t.envMap]||null),t.envMapRotation!==void 0&&this.envMapRotation.fromArray(t.envMapRotation),t.envMapIntensity!==void 0&&(this.envMapIntensity=t.envMapIntensity),t.reflectivity!==void 0&&(this.reflectivity=t.reflectivity),t.refractionRatio!==void 0&&(this.refractionRatio=t.refractionRatio),t.lightMap!==void 0&&(this.lightMap=e[t.lightMap]||null),t.lightMapIntensity!==void 0&&(this.lightMapIntensity=t.lightMapIntensity),t.aoMap!==void 0&&(this.aoMap=e[t.aoMap]||null),t.aoMapIntensity!==void 0&&(this.aoMapIntensity=t.aoMapIntensity),t.gradientMap!==void 0&&(this.gradientMap=e[t.gradientMap]||null),t.clearcoatMap!==void 0&&(this.clearcoatMap=e[t.clearcoatMap]||null),t.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=e[t.clearcoatRoughnessMap]||null),t.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=e[t.clearcoatNormalMap]||null),t.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new tt().fromArray(t.clearcoatNormalScale)),t.iridescenceMap!==void 0&&(this.iridescenceMap=e[t.iridescenceMap]||null),t.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=e[t.iridescenceThicknessMap]||null),t.transmissionMap!==void 0&&(this.transmissionMap=e[t.transmissionMap]||null),t.thicknessMap!==void 0&&(this.thicknessMap=e[t.thicknessMap]||null),t.anisotropyMap!==void 0&&(this.anisotropyMap=e[t.anisotropyMap]||null),t.sheenColorMap!==void 0&&(this.sheenColorMap=e[t.sheenColorMap]||null),t.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=e[t.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;let e=t.clippingPlanes,i=null;if(e!==null){let n=e.length;i=new Array(n);for(let r=0;r!==n;++r)i[r]=e[r].clone()}return this.clippingPlanes=i,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.allowOverride=t.allowOverride,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}},Ts=class extends Ti{constructor(t){super(),this.isSpriteMaterial=!0,this.type="SpriteMaterial",this.color=new Vt(16777215),this.map=null,this.alphaMap=null,this.rotation=0,this.sizeAttenuation=!0,this.transparent=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.rotation=t.rotation,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}},cs,Js=new D,hs=new D,us=new D,ds=new tt,js=new tt,ju=new oe,bo=new D,Ks=new D,So=new D,Kh=new tt,rc=new tt,Qh=new tt,fr=class extends Ge{constructor(t=new Ts){if(super(),this.isSprite=!0,this.type="Sprite",cs===void 0){cs=new De;let e=new Float32Array([-.5,-.5,0,0,0,.5,-.5,0,1,0,.5,.5,0,1,1,-.5,.5,0,0,1]),i=new dr(e,5);cs.setIndex([0,1,2,0,2,3]),cs.setAttribute("position",new Es(i,3,0,!1)),cs.setAttribute("uv",new Es(i,2,3,!1))}this.geometry=cs,this.material=t,this.center=new tt(.5,.5),this.count=1}intersectsFrustum(t){return t.intersectsSprite(this)}raycast(t,e){t.camera===null&&qt('Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.'),hs.setFromMatrixScale(this.matrixWorld),ju.copy(t.camera.matrixWorld),this.modelViewMatrix.multiplyMatrices(t.camera.matrixWorldInverse,this.matrixWorld),us.setFromMatrixPosition(this.modelViewMatrix),t.camera.isPerspectiveCamera&&this.material.sizeAttenuation===!1&&hs.multiplyScalar(-us.z);let i=this.material.rotation,n,r;i!==0&&(r=Math.cos(i),n=Math.sin(i));let o=this.center;wo(bo.set(-.5,-.5,0),us,o,hs,n,r),wo(Ks.set(.5,-.5,0),us,o,hs,n,r),wo(So.set(.5,.5,0),us,o,hs,n,r),Kh.set(0,0),rc.set(1,0),Qh.set(1,1);let a=t.ray.intersectTriangle(bo,Ks,So,!1,Js);if(a===null&&(wo(Ks.set(-.5,.5,0),us,o,hs,n,r),rc.set(0,1),a=t.ray.intersectTriangle(bo,So,Ks,!1,Js),a===null))return;let l=t.ray.origin.distanceTo(Js);l<t.near||l>t.far||e.push({distance:l,point:Js.clone(),uv:en.getInterpolation(Js,bo,Ks,So,Kh,rc,Qh,new tt),face:null,object:this})}copy(t,e){return super.copy(t,e),t.center!==void 0&&this.center.copy(t.center),this.material=t.material,this}};function wo(s,t,e,i,n,r){ds.subVectors(s,e).addScalar(.5).multiply(i),n!==void 0?(js.x=r*ds.x-n*ds.y,js.y=n*ds.x+r*ds.y):js.copy(ds),s.copy(t),s.x+=js.x,s.y+=js.y,s.applyMatrix4(ju)}var tn=new D,oc=new D,Eo=new D,To=new D,Bn=class{constructor(t=new D,e=new D(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,tn)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);let i=e.dot(this.direction);return i<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,i)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){let e=tn.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(tn.copy(this.origin).addScaledVector(this.direction,e),tn.distanceToSquared(t))}distanceSqToSegment(t,e,i,n){oc.copy(t).add(e).multiplyScalar(.5),Eo.copy(e).sub(t).normalize(),To.copy(this.origin).sub(oc);let r=t.distanceTo(e)*.5,o=-this.direction.dot(Eo),a=To.dot(this.direction),l=-To.dot(Eo),c=To.lengthSq(),h=Math.abs(1-o*o),f,u,d,m;if(h>0)if(f=o*l-a,u=o*a-l,m=r*h,f>=0)if(u>=-m)if(u<=m){let _=1/h;f*=_,u*=_,d=f*(f+o*u+2*a)+u*(o*f+u+2*l)+c}else u=r,f=Math.max(0,-(o*u+a)),d=-f*f+u*(u+2*l)+c;else u=-r,f=Math.max(0,-(o*u+a)),d=-f*f+u*(u+2*l)+c;else u<=-m?(f=Math.max(0,-(-o*r+a)),u=f>0?-r:Math.min(Math.max(-r,-l),r),d=-f*f+u*(u+2*l)+c):u<=m?(f=0,u=Math.min(Math.max(-r,-l),r),d=u*(u+2*l)+c):(f=Math.max(0,-(o*r+a)),u=f>0?r:Math.min(Math.max(-r,-l),r),d=-f*f+u*(u+2*l)+c);else u=o>0?-r:r,f=Math.max(0,-(o*u+a)),d=-f*f+u*(u+2*l)+c;return i&&i.copy(this.origin).addScaledVector(this.direction,f),n&&n.copy(oc).addScaledVector(Eo,u),d}intersectSphere(t,e){if(t.radius<0)return null;tn.subVectors(t.center,this.origin);let i=tn.dot(this.direction),n=tn.dot(tn)-i*i,r=t.radius*t.radius;if(n>r)return null;let o=Math.sqrt(r-n),a=i-o,l=i+o;return l<0?null:a<0?this.at(l,e):this.at(a,e)}intersectsSphere(t){return t.radius<0?!1:this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){let e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;let i=-(this.origin.dot(t.normal)+t.constant)/e;return i>=0?i:null}intersectPlane(t,e){let i=this.distanceToPlane(t);return i===null?null:this.at(i,e)}intersectsPlane(t){let e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let i,n,r,o,a,l,c=1/this.direction.x,h=1/this.direction.y,f=1/this.direction.z,u=this.origin;return c>=0?(i=(t.min.x-u.x)*c,n=(t.max.x-u.x)*c):(i=(t.max.x-u.x)*c,n=(t.min.x-u.x)*c),h>=0?(r=(t.min.y-u.y)*h,o=(t.max.y-u.y)*h):(r=(t.max.y-u.y)*h,o=(t.min.y-u.y)*h),i>o||r>n||((r>i||isNaN(i))&&(i=r),(o<n||isNaN(n))&&(n=o),f>=0?(a=(t.min.z-u.z)*f,l=(t.max.z-u.z)*f):(a=(t.max.z-u.z)*f,l=(t.min.z-u.z)*f),i>l||a>n)||((a>i||i!==i)&&(i=a),(l<n||n!==n)&&(n=l),n<0)?null:this.at(i>=0?i:n,e)}intersectsBox(t){return this.intersectBox(t,tn)!==null}intersectTriangle(t,e,i,n,r){let o=this.origin,a=this.direction,l=a.x,c=a.y,h=a.z,f=t.x-o.x,u=t.y-o.y,d=t.z-o.z,m=e.x-o.x,_=e.y-o.y,p=e.z-o.z,g=i.x-o.x,M=i.y-o.y,T=i.z-o.z,y=Math.abs(l),b=Math.abs(c),E=Math.abs(h),C,x,A,L,U,w,P,I,N,B,O,G;if(y>=b&&y>=E?(A=l,w=f,N=m,G=g,l>=0?(C=c,x=h,L=u,U=d,P=_,I=p,B=M,O=T):(C=h,x=c,L=d,U=u,P=p,I=_,B=T,O=M)):b>=E?(A=c,w=u,N=_,G=M,c>=0?(C=h,x=l,L=d,U=f,P=p,I=m,B=T,O=g):(C=l,x=h,L=f,U=d,P=m,I=p,B=g,O=T)):(A=h,w=d,N=p,G=T,h>=0?(C=l,x=c,L=f,U=u,P=m,I=_,B=g,O=M):(C=c,x=l,L=u,U=f,P=_,I=m,B=M,O=g)),A===0)return null;let V=C/A,W=x/A,$=1/A,dt=L-V*w,mt=U-W*w,Ct=P-V*N,wt=I-W*N,Ht=B-V*G,Z=O-W*G,j=Ht*wt-Z*Ct,ut=dt*Z-mt*Ht,It=Ct*mt-wt*dt;if(n){if(j<0||ut<0||It<0)return null}else if((j<0||ut<0||It<0)&&(j>0||ut>0||It>0))return null;let vt=j+ut+It;if(vt===0)return null;let Bt=$*(j*w+ut*N+It*G);return(vt>0?Bt<0:Bt>0)?null:this.at(Bt/vt,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},ni=class extends Ti{constructor(t){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Vt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new zi,this.combine=ba,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}},tu=new oe,Nn=new Bn,Ao=new ws,eu=new D,Co=new D,Ro=new D,Po=new D,ac=new D,Io=new D,iu=new D,Lo=new D,Zt=class extends Ge{constructor(t=new De,e=new ni){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){let e=this.geometry.morphAttributes,i=Object.keys(e);if(i.length>0){let n=e[i[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=n.length;r<o;r++){let a=n[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}getVertexPosition(t,e){let i=this.geometry,n=i.attributes.position,r=i.morphAttributes.position,o=i.morphTargetsRelative;e.fromBufferAttribute(n,t);let a=this.morphTargetInfluences;if(r&&a){Io.set(0,0,0);for(let l=0,c=r.length;l<c;l++){let h=a[l],f=r[l];h!==0&&(ac.fromBufferAttribute(f,t),o?Io.addScaledVector(ac,h):Io.addScaledVector(ac.sub(e),h))}e.add(Io)}return e}intersectsFrustum(t){return t.intersectsObject(this)}raycast(t,e){let i=this.geometry,n=this.material,r=this.matrixWorld;n!==void 0&&(i.boundingSphere===null&&i.computeBoundingSphere(),Ao.copy(i.boundingSphere),Ao.applyMatrix4(r),Nn.copy(t.ray).recast(t.near),!(Ao.containsPoint(Nn.origin)===!1&&(Nn.intersectSphere(Ao,eu)===null||Nn.origin.distanceToSquared(eu)>(t.far-t.near)**2))&&(tu.copy(r).invert(),Nn.copy(t.ray).applyMatrix4(tu),!(i.boundingBox!==null&&Nn.intersectsBox(i.boundingBox)===!1)&&this._computeIntersections(t,e,Nn)))}_computeIntersections(t,e,i){let n,r=this.geometry,o=this.material,a=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,f=r.attributes.normal,u=r.groups,d=r.drawRange;if(a!==null)if(Array.isArray(o))for(let m=0,_=u.length;m<_;m++){let p=u[m],g=o[p.materialIndex],M=Math.max(p.start,d.start),T=Math.min(a.count,Math.min(p.start+p.count,d.start+d.count));for(let y=M,b=T;y<b;y+=3){let E=a.getX(y),C=a.getX(y+1),x=a.getX(y+2);n=Do(this,g,t,i,c,h,f,E,C,x),n&&(n.faceIndex=Math.floor(y/3),n.face.materialIndex=p.materialIndex,e.push(n))}}else{let m=Math.max(0,d.start),_=Math.min(a.count,d.start+d.count);for(let p=m,g=_;p<g;p+=3){let M=a.getX(p),T=a.getX(p+1),y=a.getX(p+2);n=Do(this,o,t,i,c,h,f,M,T,y),n&&(n.faceIndex=Math.floor(p/3),e.push(n))}}else if(l!==void 0)if(Array.isArray(o))for(let m=0,_=u.length;m<_;m++){let p=u[m],g=o[p.materialIndex],M=Math.max(p.start,d.start),T=Math.min(l.count,Math.min(p.start+p.count,d.start+d.count));for(let y=M,b=T;y<b;y+=3){let E=y,C=y+1,x=y+2;n=Do(this,g,t,i,c,h,f,E,C,x),n&&(n.faceIndex=Math.floor(y/3),n.face.materialIndex=p.materialIndex,e.push(n))}}else{let m=Math.max(0,d.start),_=Math.min(l.count,d.start+d.count);for(let p=m,g=_;p<g;p+=3){let M=p,T=p+1,y=p+2;n=Do(this,o,t,i,c,h,f,M,T,y),n&&(n.faceIndex=Math.floor(p/3),e.push(n))}}}};function Yf(s,t,e,i,n,r,o,a){let l;if(t.side===Ne?l=i.intersectTriangle(o,r,n,!0,a):l=i.intersectTriangle(n,r,o,t.side===wn,a),l===null)return null;Lo.copy(a),Lo.applyMatrix4(s.matrixWorld);let c=e.ray.origin.distanceTo(Lo);return c<e.near||c>e.far?null:{distance:c,point:Lo.clone(),object:s}}function Do(s,t,e,i,n,r,o,a,l,c){s.getVertexPosition(a,Co),s.getVertexPosition(l,Ro),s.getVertexPosition(c,Po);let h=Yf(s,t,e,i,Co,Ro,Po,iu);if(h){let f=new D;en.getBarycoord(iu,Co,Ro,Po,f),n&&(h.uv=en.getInterpolatedAttribute(n,a,l,c,f,new tt)),r&&(h.uv1=en.getInterpolatedAttribute(r,a,l,c,f,new tt)),o&&(h.normal=en.getInterpolatedAttribute(o,a,l,c,f,new D),h.normal.dot(i.direction)>0&&h.normal.multiplyScalar(-1));let u={a,b:l,c,normal:new D,materialIndex:0};en.getNormal(Co,Ro,Po,u.normal),h.face=u,h.barycoord=f}return h}var mn=class extends ei{constructor(t=null,e=1,i=1,n,r,o,a,l,c=Te,h=Te,f,u){super(null,o,a,l,c,h,n,r,f,u),this.isDataTexture=!0,this.image={data:t,width:e,height:i},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}};var Un=new ws,Zf=new tt(.5,.5),No=new D,As=class{constructor(t=new ti,e=new ti,i=new ti,n=new ti,r=new ti,o=new ti){this.planes=[t,e,i,n,r,o]}set(t,e,i,n,r,o){let a=this.planes;return a[0].copy(t),a[1].copy(e),a[2].copy(i),a[3].copy(n),a[4].copy(r),a[5].copy(o),this}copy(t){let e=this.planes;for(let i=0;i<6;i++)e[i].copy(t.planes[i]);return this}setFromProjectionMatrix(t,e=wi,i=!1){let n=this.planes,r=t.elements,o=r[0],a=r[1],l=r[2],c=r[3],h=r[4],f=r[5],u=r[6],d=r[7],m=r[8],_=r[9],p=r[10],g=r[11],M=r[12],T=r[13],y=r[14],b=r[15];if(n[0].setComponents(c-o,d-h,g-m,b-M).normalize(),n[1].setComponents(c+o,d+h,g+m,b+M).normalize(),n[2].setComponents(c+a,d+f,g+_,b+T).normalize(),n[3].setComponents(c-a,d-f,g-_,b-T).normalize(),i)n[4].setComponents(l,u,p,y).normalize(),n[5].setComponents(c-l,d-u,g-p,b-y).normalize();else if(n[4].setComponents(c-l,d-u,g-p,b-y).normalize(),e===wi)n[5].setComponents(c+l,d+u,g+p,b+y).normalize();else if(e===vs)n[5].setComponents(l,u,p,y).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),Un.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{let e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),Un.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(Un)}intersectsSprite(t){Un.center.set(0,0,0);let e=Zf.distanceTo(t.center);return Un.radius=.7071067811865476+e,Un.applyMatrix4(t.matrixWorld),this.intersectsSphere(Un)}intersectsSphere(t){let e=this.planes,i=t.center,n=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(i)<n)return!1;return!0}intersectsBox(t){let e=this.planes;for(let i=0;i<6;i++){let n=e[i];if(No.x=n.normal.x>0?t.max.x:t.min.x,No.y=n.normal.y>0?t.max.y:t.min.y,No.z=n.normal.z>0?t.max.z:t.min.z,n.distanceToPoint(No)<0)return!1}return!0}containsPoint(t){let e=this.planes;for(let i=0;i<6;i++)if(e[i].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}};var pr=class extends ei{constructor(t=[],e=Tn,i,n,r,o,a,l,c,h){super(t,e,i,n,r,o,a,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}},kn=class extends ei{constructor(t,e,i,n,r,o,a,l,c){super(t,e,i,n,r,o,a,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}};var Vi=class extends ei{constructor(t,e,i=Ci,n,r,o,a=Te,l=Te,c,h=ki,f=1){if(h!==ki&&h!==Hi)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let u={width:t,height:e,depth:f};super(u,n,r,o,a,l,h,i,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.source=new Ms(Object.assign({},t.image)),this.compareFunction=t.compareFunction,this}toJSON(t){let e=super.toJSON(t);return e.compareFunction=this.compareFunction,e}},Qo=class extends Vi{constructor(t,e=Ci,i=Tn,n,r,o=Te,a=Te,l,c=ki){let h={width:t,height:t,depth:1},f=[h,h,h,h,h,h];super(t,t,e,i,n,r,o,a,l,c),this.image=f,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(t){this.image=t}},mr=class extends ei{constructor(t=null){super(),this.sourceTexture=t,this.isExternalTexture=!0}copy(t){return super.copy(t),this.sourceTexture=t.sourceTexture,this}},ze=class s extends De{constructor(t=1,e=1,i=1,n=1,r=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:i,widthSegments:n,heightSegments:r,depthSegments:o};let a=this;n=Math.floor(n),r=Math.floor(r),o=Math.floor(o);let l=[],c=[],h=[],f=[],u=0,d=0;m("z","y","x",-1,-1,i,e,t,o,r,0),m("z","y","x",1,-1,i,e,-t,o,r,1),m("x","z","y",1,1,t,i,e,n,o,2),m("x","z","y",1,-1,t,i,-e,n,o,3),m("x","y","z",1,-1,t,e,i,n,r,4),m("x","y","z",-1,-1,t,e,-i,n,r,5),this.setIndex(l),this.setAttribute("position",new ge(c,3)),this.setAttribute("normal",new ge(h,3)),this.setAttribute("uv",new ge(f,2));function m(_,p,g,M,T,y,b,E,C,x,A){let L=y/C,U=b/x,w=y/2,P=b/2,I=E/2,N=C+1,B=x+1,O=0,G=0,V=new D;for(let W=0;W<B;W++){let $=W*U-P;for(let dt=0;dt<N;dt++){let mt=dt*L-w;V[_]=mt*M,V[p]=$*T,V[g]=I,c.push(V.x,V.y,V.z),V[_]=0,V[p]=0,V[g]=E>0?1:-1,h.push(V.x,V.y,V.z),f.push(dt/C),f.push(1-W/x),O+=1}}for(let W=0;W<x;W++)for(let $=0;$<C;$++){let dt=u+$+N*W,mt=u+$+N*(W+1),Ct=u+($+1)+N*(W+1),wt=u+($+1)+N*W;l.push(dt,mt,wt),l.push(mt,Ct,wt),G+=6}a.addGroup(d,G,A),d+=G,u+=O}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new s(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}};var si=class s extends De{constructor(t=1,e=1,i=1,n=32,r=1,o=!1,a=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:i,radialSegments:n,heightSegments:r,openEnded:o,thetaStart:a,thetaLength:l};let c=this;n=Math.floor(n),r=Math.floor(r);let h=[],f=[],u=[],d=[],m=0,_=[],p=i/2,g=0;M(),o===!1&&(t>0&&T(!0),e>0&&T(!1)),this.setIndex(h),this.setAttribute("position",new ge(f,3)),this.setAttribute("normal",new ge(u,3)),this.setAttribute("uv",new ge(d,2));function M(){let y=new D,b=new D,E=0,C=(e-t)/i;for(let x=0;x<=r;x++){let A=[],L=x/r,U=L*(e-t)+t;for(let w=0;w<=n;w++){let P=w/n,I=P*l+a,N=Math.sin(I),B=Math.cos(I);b.x=U*N,b.y=-L*i+p,b.z=U*B,f.push(b.x,b.y,b.z),y.set(N,C,B).normalize(),u.push(y.x,y.y,y.z),d.push(P,1-L),A.push(m++)}_.push(A)}for(let x=0;x<n;x++)for(let A=0;A<r;A++){let L=_[A][x],U=_[A+1][x],w=_[A+1][x+1],P=_[A][x+1];(t>0||A!==0)&&(h.push(L,U,P),E+=3),(e>0||A!==r-1)&&(h.push(U,w,P),E+=3)}c.addGroup(g,E,0),g+=E}function T(y){let b=m,E=new tt,C=new D,x=0,A=y===!0?t:e,L=y===!0?1:-1;for(let w=1;w<=n;w++)f.push(0,p*L,0),u.push(0,L,0),d.push(.5,.5),m++;let U=m;for(let w=0;w<=n;w++){let I=w/n*l+a,N=Math.cos(I),B=Math.sin(I);C.x=A*B,C.y=p*L,C.z=A*N,f.push(C.x,C.y,C.z),u.push(0,L,0),E.x=N*.5+.5,E.y=B*.5*L+.5,d.push(E.x,E.y),m++}for(let w=0;w<n;w++){let P=b+w,I=U+w;y===!0?h.push(I,I+1,P):h.push(I+1,I,P),x+=3}c.addGroup(g,x,y===!0?1:2),g+=x}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new s(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}};var ui=class{constructor(){this.type="Curve",this.arcLengthDivisions=200,this.needsUpdate=!1,this.cacheArcLengths=null}getPoint(){Yt("Curve: .getPoint() not implemented.")}getPointAt(t,e){let i=this.getUtoTmapping(t);return this.getPoint(i,e)}getPoints(t=5){let e=[];for(let i=0;i<=t;i++)e.push(this.getPoint(i/t));return e}getSpacedPoints(t=5){let e=[];for(let i=0;i<=t;i++)e.push(this.getPointAt(i/t));return e}getLength(){let t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;let e=[],i,n=this.getPoint(0),r=0;e.push(0);for(let o=1;o<=t;o++)i=this.getPoint(o/t),r+=i.distanceTo(n),e.push(r),n=i;return this.cacheArcLengths=e,e}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,e=null){let i=this.getLengths(),n=0,r=i.length,o;e?o=e:o=t*i[r-1];let a=0,l=r-1,c;for(;a<=l;)if(n=Math.floor(a+(l-a)/2),c=i[n]-o,c<0)a=n+1;else if(c>0)l=n-1;else{l=n;break}if(n=l,i[n]===o)return n/(r-1);let h=i[n],u=i[n+1]-h,d=(o-h)/u;return(n+d)/(r-1)}getTangent(t,e){let n=t-1e-4,r=t+1e-4;n<0&&(n=0),r>1&&(r=1);let o=this.getPoint(n),a=this.getPoint(r),l=e||(o.isVector2?new tt:new D);return l.copy(a).sub(o).normalize(),l}getTangentAt(t,e){let i=this.getUtoTmapping(t);return this.getTangent(i,e)}computeFrenetFrames(t,e=!1){let i=new D,n=[],r=[],o=[],a=new D,l=new oe;for(let d=0;d<=t;d++){let m=d/t;n[d]=this.getTangentAt(m,new D)}r[0]=new D,o[0]=new D;let c=Number.MAX_VALUE,h=Math.abs(n[0].x),f=Math.abs(n[0].y),u=Math.abs(n[0].z);h<=c&&(c=h,i.set(1,0,0)),f<=c&&(c=f,i.set(0,1,0)),u<=c&&i.set(0,0,1),a.crossVectors(n[0],i).normalize(),r[0].crossVectors(n[0],a),o[0].crossVectors(n[0],r[0]);for(let d=1;d<=t;d++){if(r[d]=r[d-1].clone(),o[d]=o[d-1].clone(),a.crossVectors(n[d-1],n[d]),a.length()>Number.EPSILON){a.normalize();let m=Math.acos(Qt(n[d-1].dot(n[d]),-1,1));r[d].applyMatrix4(l.makeRotationAxis(a,m))}o[d].crossVectors(n[d],r[d])}if(e===!0){let d=Math.acos(Qt(r[0].dot(r[t]),-1,1));d/=t,n[0].dot(a.crossVectors(r[0],r[t]))>0&&(d=-d);for(let m=1;m<=t;m++)r[m].applyMatrix4(l.makeRotationAxis(n[m],d*m)),o[m].crossVectors(n[m],r[m])}return{tangents:n,normals:r,binormals:o}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){let t={metadata:{version:4.7,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}},Cs=class extends ui{constructor(t=0,e=0,i=1,n=1,r=0,o=Math.PI*2,a=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=e,this.xRadius=i,this.yRadius=n,this.aStartAngle=r,this.aEndAngle=o,this.aClockwise=a,this.aRotation=l}getPoint(t,e=new tt){let i=e,n=Math.PI*2,r=this.aEndAngle-this.aStartAngle,o=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=n;for(;r>n;)r-=n;r<Number.EPSILON&&(o?r=0:r=n),this.aClockwise===!0&&!o&&(r===n?r=-n:r=r-n);let a=this.aStartAngle+t*r,l=this.aX+this.xRadius*Math.cos(a),c=this.aY+this.yRadius*Math.sin(a);if(this.aRotation!==0){let h=Math.cos(this.aRotation),f=Math.sin(this.aRotation),u=l-this.aX,d=c-this.aY;l=u*h-d*f+this.aX,c=u*f+d*h+this.aY}return i.set(l,c)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){let t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}},ta=class extends Cs{constructor(t,e,i,n,r,o){super(t,e,i,i,n,r,o),this.isArcCurve=!0,this.type="ArcCurve"}};function Gc(){let s=0,t=0,e=0,i=0;function n(r,o,a,l){s=r,t=a,e=-3*r+3*o-2*a-l,i=2*r-2*o+a+l}return{initCatmullRom:function(r,o,a,l,c){n(o,a,c*(a-r),c*(l-o))},initNonuniformCatmullRom:function(r,o,a,l,c,h,f){let u=(o-r)/c-(a-r)/(c+h)+(a-o)/h,d=(a-o)/h-(l-o)/(h+f)+(l-a)/f;u*=h,d*=h,n(o,a,u,d)},calc:function(r){let o=r*r,a=o*r;return s+t*r+e*o+i*a}}}var nu=new D,su=new D,lc=new Gc,cc=new Gc,hc=new Gc,ea=class extends ui{constructor(t=[],e=!1,i="centripetal",n=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=e,this.curveType=i,this.tension=n}getPoint(t,e=new D){let i=e,n=this.points,r=n.length,o=(r-(this.closed?0:1))*t,a=Math.floor(o),l=o-a;this.closed?a+=a>0?0:(Math.floor(Math.abs(a)/r)+1)*r:l===0&&a===r-1&&(a=r-2,l=1);let c,h;this.closed||a>0?c=n[(a-1)%r]:(su.subVectors(n[0],n[1]).add(n[0]),c=su);let f=n[a%r],u=n[(a+1)%r];if(this.closed||a+2<r?h=n[(a+2)%r]:(nu.subVectors(n[r-1],n[r-2]).add(n[r-1]),h=nu),this.curveType==="centripetal"||this.curveType==="chordal"){let d=this.curveType==="chordal"?.5:.25,m=Math.pow(c.distanceToSquared(f),d),_=Math.pow(f.distanceToSquared(u),d),p=Math.pow(u.distanceToSquared(h),d);_<1e-4&&(_=1),m<1e-4&&(m=_),p<1e-4&&(p=_),lc.initNonuniformCatmullRom(c.x,f.x,u.x,h.x,m,_,p),cc.initNonuniformCatmullRom(c.y,f.y,u.y,h.y,m,_,p),hc.initNonuniformCatmullRom(c.z,f.z,u.z,h.z,m,_,p)}else this.curveType==="catmullrom"&&(lc.initCatmullRom(c.x,f.x,u.x,h.x,this.tension),cc.initCatmullRom(c.y,f.y,u.y,h.y,this.tension),hc.initCatmullRom(c.z,f.z,u.z,h.z,this.tension));return i.set(lc.calc(l),cc.calc(l),hc.calc(l)),i}copy(t){super.copy(t),this.points=[];for(let e=0,i=t.points.length;e<i;e++){let n=t.points[e];this.points.push(n.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){let t=super.toJSON();t.points=[];for(let e=0,i=this.points.length;e<i;e++){let n=this.points[e];t.points.push(n.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,i=t.points.length;e<i;e++){let n=t.points[e];this.points.push(new D().fromArray(n))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}};function ru(s,t,e,i,n){let r=(i-t)*.5,o=(n-e)*.5,a=s*s,l=s*a;return(2*e-2*i+r+o)*l+(-3*e+3*i-2*r-o)*a+r*s+e}function $f(s,t){let e=1-s;return e*e*t}function Jf(s,t){return 2*(1-s)*s*t}function jf(s,t){return s*s*t}function ir(s,t,e,i){return $f(s,t)+Jf(s,e)+jf(s,i)}function Kf(s,t){let e=1-s;return e*e*e*t}function Qf(s,t){let e=1-s;return 3*e*e*s*t}function tp(s,t){return 3*(1-s)*s*s*t}function ep(s,t){return s*s*s*t}function nr(s,t,e,i,n){return Kf(s,t)+Qf(s,e)+tp(s,i)+ep(s,n)}var gr=class extends ui{constructor(t=new tt,e=new tt,i=new tt,n=new tt){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=e,this.v2=i,this.v3=n}getPoint(t,e=new tt){let i=e,n=this.v0,r=this.v1,o=this.v2,a=this.v3;return i.set(nr(t,n.x,r.x,o.x,a.x),nr(t,n.y,r.y,o.y,a.y)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},ia=class extends ui{constructor(t=new D,e=new D,i=new D,n=new D){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=e,this.v2=i,this.v3=n}getPoint(t,e=new D){let i=e,n=this.v0,r=this.v1,o=this.v2,a=this.v3;return i.set(nr(t,n.x,r.x,o.x,a.x),nr(t,n.y,r.y,o.y,a.y),nr(t,n.z,r.z,o.z,a.z)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}},_r=class extends ui{constructor(t=new tt,e=new tt){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=e}getPoint(t,e=new tt){let i=e;return t===1?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(t).add(this.v1)),i}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new tt){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},na=class extends ui{constructor(t=new D,e=new D){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=e}getPoint(t,e=new D){let i=e;return t===1?i.copy(this.v2):(i.copy(this.v2).sub(this.v1),i.multiplyScalar(t).add(this.v1)),i}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new D){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},vr=class extends ui{constructor(t=new tt,e=new tt,i=new tt){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=e,this.v2=i}getPoint(t,e=new tt){let i=e,n=this.v0,r=this.v1,o=this.v2;return i.set(ir(t,n.x,r.x,o.x),ir(t,n.y,r.y,o.y)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},sa=class extends ui{constructor(t=new D,e=new D,i=new D){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=e,this.v2=i}getPoint(t,e=new D){let i=e,n=this.v0,r=this.v1,o=this.v2;return i.set(ir(t,n.x,r.x,o.x),ir(t,n.y,r.y,o.y),ir(t,n.z,r.z,o.z)),i}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){let t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}},xr=class extends ui{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,e=new tt){let i=e,n=this.points,r=(n.length-1)*t,o=Math.floor(r),a=r-o,l=n[o===0?o:o-1],c=n[o],h=n[o>n.length-2?n.length-1:o+1],f=n[o>n.length-3?n.length-1:o+2];return i.set(ru(a,l.x,c.x,h.x,f.x),ru(a,l.y,c.y,h.y,f.y)),i}copy(t){super.copy(t),this.points=[];for(let e=0,i=t.points.length;e<i;e++){let n=t.points[e];this.points.push(n.clone())}return this}toJSON(){let t=super.toJSON();t.points=[];for(let e=0,i=this.points.length;e<i;e++){let n=this.points[e];t.points.push(n.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,i=t.points.length;e<i;e++){let n=t.points[e];this.points.push(new tt().fromArray(n))}return this}},_c=Object.freeze({__proto__:null,ArcCurve:ta,CatmullRomCurve3:ea,CubicBezierCurve:gr,CubicBezierCurve3:ia,EllipseCurve:Cs,LineCurve:_r,LineCurve3:na,QuadraticBezierCurve:vr,QuadraticBezierCurve3:sa,SplineCurve:xr}),ra=class extends ui{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(t){this.curves.push(t)}closePath(){let t=this.curves[0].getPoint(0),e=this.curves[this.curves.length-1].getPoint(1);if(!t.equals(e)){let i=t.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new _c[i](e,t))}return this}getPoint(t,e){let i=t*this.getLength(),n=this.getCurveLengths(),r=0;for(;r<n.length;){if(n[r]>=i){let o=n[r]-i,a=this.curves[r],l=a.getLength(),c=l===0?0:1-o/l;return a.getPointAt(c,e)}r++}return null}getLength(){let t=this.getCurveLengths();return t[t.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;let t=[],e=0;for(let i=0,n=this.curves.length;i<n;i++)e+=this.curves[i].getLength(),t.push(e);return this.cacheLengths=t,t}getSpacedPoints(t=40){let e=[];for(let i=0;i<=t;i++)e.push(this.getPoint(i/t));return this.autoClose&&e.push(e[0]),e}getPoints(t=12){let e=[],i;for(let n=0,r=this.curves;n<r.length;n++){let o=r[n],a=o.isEllipseCurve?t*2:o.isLineCurve||o.isLineCurve3?1:o.isSplineCurve?t*o.points.length:t,l=o.getPoints(a);for(let c=0;c<l.length;c++){let h=l[c];i&&i.equals(h)||(e.push(h),i=h)}}return this.autoClose&&e.length>1&&!e[e.length-1].equals(e[0])&&e.push(e[0]),e}copy(t){super.copy(t),this.curves=[];for(let e=0,i=t.curves.length;e<i;e++){let n=t.curves[e];this.curves.push(n.clone())}return this.autoClose=t.autoClose,this}toJSON(){let t=super.toJSON();t.autoClose=this.autoClose,t.curves=[];for(let e=0,i=this.curves.length;e<i;e++){let n=this.curves[e];t.curves.push(n.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.autoClose=t.autoClose,this.curves=[];for(let e=0,i=t.curves.length;e<i;e++){let n=t.curves[e];this.curves.push(new _c[n.type]().fromJSON(n))}return this}},zn=class extends ra{constructor(t){super(),this.type="Path",this.currentPoint=new tt,t&&this.setFromPoints(t)}setFromPoints(t){this.moveTo(t[0].x,t[0].y);for(let e=1,i=t.length;e<i;e++)this.lineTo(t[e].x,t[e].y);return this}moveTo(t,e){return this.currentPoint.set(t,e),this}lineTo(t,e){let i=new _r(this.currentPoint.clone(),new tt(t,e));return this.curves.push(i),this.currentPoint.set(t,e),this}quadraticCurveTo(t,e,i,n){let r=new vr(this.currentPoint.clone(),new tt(t,e),new tt(i,n));return this.curves.push(r),this.currentPoint.set(i,n),this}bezierCurveTo(t,e,i,n,r,o){let a=new gr(this.currentPoint.clone(),new tt(t,e),new tt(i,n),new tt(r,o));return this.curves.push(a),this.currentPoint.set(r,o),this}splineThru(t){let e=[this.currentPoint.clone()].concat(t),i=new xr(e);return this.curves.push(i),this.currentPoint.copy(t[t.length-1]),this}arc(t,e,i,n,r,o){let a=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(t+a,e+l,i,n,r,o),this}absarc(t,e,i,n,r,o){return this.absellipse(t,e,i,i,n,r,o),this}ellipse(t,e,i,n,r,o,a,l){let c=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(t+c,e+h,i,n,r,o,a,l),this}absellipse(t,e,i,n,r,o,a,l){let c=new Cs(t,e,i,n,r,o,a,l);if(this.curves.length>0){let f=c.getPoint(0);f.equals(this.currentPoint)||this.lineTo(f.x,f.y)}this.curves.push(c);let h=c.getPoint(1);return this.currentPoint.copy(h),this}copy(t){return super.copy(t),this.currentPoint.copy(t.currentPoint),this}toJSON(){let t=super.toJSON();return t.currentPoint=this.currentPoint.toArray(),t}fromJSON(t){return super.fromJSON(t),this.currentPoint.fromArray(t.currentPoint),this}},Vn=class extends zn{constructor(t){super(t),this.uuid=Bi(),this.type="Shape",this.holes=[]}getPointsHoles(t){let e=[];for(let i=0,n=this.holes.length;i<n;i++)e[i]=this.holes[i].getPoints(t);return e}extractPoints(t){return{shape:this.getPoints(t),holes:this.getPointsHoles(t)}}copy(t){super.copy(t),this.holes=[];for(let e=0,i=t.holes.length;e<i;e++){let n=t.holes[e];this.holes.push(n.clone())}return this}toJSON(){let t=super.toJSON();t.uuid=this.uuid,t.holes=[];for(let e=0,i=this.holes.length;e<i;e++){let n=this.holes[e];t.holes.push(n.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.uuid=t.uuid,this.holes=[];for(let e=0,i=t.holes.length;e<i;e++){let n=t.holes[e];this.holes.push(new zn().fromJSON(n))}return this}};function ip(s,t,e=2){let i=t&&t.length,n=i?t[0]*e:s.length,r=Ku(s,0,n,e,!0),o=[];if(!r||r.next===r.prev)return o;let a,l,c;if(i&&(r=ap(s,t,r,e)),s.length>80*e){a=s[0],l=s[1];let h=a,f=l;for(let u=e;u<n;u+=e){let d=s[u],m=s[u+1];d<a&&(a=d),m<l&&(l=m),d>h&&(h=d),m>f&&(f=m)}c=Math.max(h-a,f-l),c=c!==0?32767/c:0}return yr(r,o,e,a,l,c,0),o}function Ku(s,t,e,i,n){let r;if(n===vp(s,t,e,i)>0)for(let o=t;o<e;o+=i)r=ou(o/i|0,s[o],s[o+1],r);else for(let o=e-i;o>=t;o-=i)r=ou(o/i|0,s[o],s[o+1],r);return r&&Rs(r,r.next)&&(br(r),r=r.next),r}function Hn(s,t){if(!s)return s;t||(t=s);let e=s,i;do if(i=!1,!e.steiner&&(Rs(e,e.next)||Se(e.prev,e,e.next)===0)){if(br(e),e=t=e.prev,e===e.next)break;i=!0}else e=e.next;while(i||e!==t);return t}function yr(s,t,e,i,n,r,o){if(!s)return;!o&&r&&dp(s,i,n,r);let a=s;for(;s.prev!==s.next;){let l=s.prev,c=s.next;if(r?sp(s,i,n,r):np(s)){t.push(l.i,s.i,c.i),br(s),s=c.next,a=c.next;continue}if(s=c,s===a){o?o===1?(s=rp(Hn(s),t),yr(s,t,e,i,n,r,2)):o===2&&op(s,t,e,i,n,r):yr(Hn(s),t,e,i,n,r,1);break}}}function np(s){let t=s.prev,e=s,i=s.next;if(Se(t,e,i)>=0)return!1;let n=t.x,r=e.x,o=i.x,a=t.y,l=e.y,c=i.y,h=Math.min(n,r,o),f=Math.min(a,l,c),u=Math.max(n,r,o),d=Math.max(a,l,c),m=i.next;for(;m!==t;){if(m.x>=h&&m.x<=u&&m.y>=f&&m.y<=d&&Qs(n,a,r,l,o,c,m.x,m.y)&&Se(m.prev,m,m.next)>=0)return!1;m=m.next}return!0}function sp(s,t,e,i){let n=s.prev,r=s,o=s.next;if(Se(n,r,o)>=0)return!1;let a=n.x,l=r.x,c=o.x,h=n.y,f=r.y,u=o.y,d=Math.min(a,l,c),m=Math.min(h,f,u),_=Math.max(a,l,c),p=Math.max(h,f,u),g=vc(d,m,t,e,i),M=vc(_,p,t,e,i),T=s.prevZ,y=s.nextZ;for(;T&&T.z>=g&&y&&y.z<=M;){if(T.x>=d&&T.x<=_&&T.y>=m&&T.y<=p&&T!==n&&T!==o&&Qs(a,h,l,f,c,u,T.x,T.y)&&Se(T.prev,T,T.next)>=0||(T=T.prevZ,y.x>=d&&y.x<=_&&y.y>=m&&y.y<=p&&y!==n&&y!==o&&Qs(a,h,l,f,c,u,y.x,y.y)&&Se(y.prev,y,y.next)>=0))return!1;y=y.nextZ}for(;T&&T.z>=g;){if(T.x>=d&&T.x<=_&&T.y>=m&&T.y<=p&&T!==n&&T!==o&&Qs(a,h,l,f,c,u,T.x,T.y)&&Se(T.prev,T,T.next)>=0)return!1;T=T.prevZ}for(;y&&y.z<=M;){if(y.x>=d&&y.x<=_&&y.y>=m&&y.y<=p&&y!==n&&y!==o&&Qs(a,h,l,f,c,u,y.x,y.y)&&Se(y.prev,y,y.next)>=0)return!1;y=y.nextZ}return!0}function rp(s,t){let e=s;do{let i=e.prev,n=e.next.next;!Rs(i,n)&&td(i,e,e.next,n)&&Mr(i,n)&&Mr(n,i)&&(t.push(i.i,e.i,n.i),br(e),br(e.next),e=s=n),e=e.next}while(e!==s);return Hn(e)}function op(s,t,e,i,n,r){let o=s;do{let a=o.next.next;for(;a!==o.prev;){if(o.i!==a.i&&mp(o,a)){let l=ed(o,a);o=Hn(o,o.next),l=Hn(l,l.next),yr(o,t,e,i,n,r,0),yr(l,t,e,i,n,r,0);return}a=a.next}o=o.next}while(o!==s)}function ap(s,t,e,i){let n=[];for(let r=0,o=t.length;r<o;r++){let a=t[r]*i,l=r<o-1?t[r+1]*i:s.length,c=Ku(s,a,l,i,!1);c===c.next&&(c.steiner=!0),n.push(pp(c))}n.sort(lp);for(let r=0;r<n.length;r++)e=cp(n[r],e);return e}function lp(s,t){let e=s.x-t.x;if(e===0&&(e=s.y-t.y,e===0)){let i=(s.next.y-s.y)/(s.next.x-s.x),n=(t.next.y-t.y)/(t.next.x-t.x);e=i-n}return e}function cp(s,t){let e=hp(s,t);if(!e)return t;let i=ed(e,s);return Hn(i,i.next),Hn(e,e.next)}function hp(s,t){let e=t,i=s.x,n=s.y,r=-1/0,o;if(Rs(s,e))return e;do{if(Rs(s,e.next))return e.next;if(n<=e.y&&n>=e.next.y&&e.next.y!==e.y){let f=e.x+(n-e.y)*(e.next.x-e.x)/(e.next.y-e.y);if(f<=i&&f>r&&(r=f,o=e.x<e.next.x?e:e.next,f===i))return o}e=e.next}while(e!==t);if(!o)return null;let a=o,l=o.x,c=o.y,h=1/0;e=o;do{if(i>=e.x&&e.x>=l&&i!==e.x&&Qu(n<c?i:r,n,l,c,n<c?r:i,n,e.x,e.y)){let f=Math.abs(n-e.y)/(i-e.x);Mr(e,s)&&(f<h||f===h&&(e.x>o.x||e.x===o.x&&up(o,e)))&&(o=e,h=f)}e=e.next}while(e!==a);return o}function up(s,t){return Se(s.prev,s,t.prev)<0&&Se(t.next,s,s.next)<0}function dp(s,t,e,i){let n=s;do n.z===0&&(n.z=vc(n.x,n.y,t,e,i)),n.prevZ=n.prev,n.nextZ=n.next,n=n.next;while(n!==s);n.prevZ.nextZ=null,n.prevZ=null,fp(n)}function fp(s){let t,e=1;do{let i=s,n;s=null;let r=null;for(t=0;i;){t++;let o=i,a=0;for(let c=0;c<e&&(a++,o=o.nextZ,!!o);c++);let l=e;for(;a>0||l>0&&o;)a!==0&&(l===0||!o||i.z<=o.z)?(n=i,i=i.nextZ,a--):(n=o,o=o.nextZ,l--),r?r.nextZ=n:s=n,n.prevZ=r,r=n;i=o}r.nextZ=null,e*=2}while(t>1);return s}function vc(s,t,e,i,n){return s=(s-e)*n|0,t=(t-i)*n|0,s=(s|s<<8)&16711935,s=(s|s<<4)&252645135,s=(s|s<<2)&858993459,s=(s|s<<1)&1431655765,t=(t|t<<8)&16711935,t=(t|t<<4)&252645135,t=(t|t<<2)&858993459,t=(t|t<<1)&1431655765,s|t<<1}function pp(s){let t=s,e=s;do(t.x<e.x||t.x===e.x&&t.y<e.y)&&(e=t),t=t.next;while(t!==s);return e}function Qu(s,t,e,i,n,r,o,a){return(n-o)*(t-a)>=(s-o)*(r-a)&&(s-o)*(i-a)>=(e-o)*(t-a)&&(e-o)*(r-a)>=(n-o)*(i-a)}function Qs(s,t,e,i,n,r,o,a){return!(s===o&&t===a)&&Qu(s,t,e,i,n,r,o,a)}function mp(s,t){return s.next.i!==t.i&&s.prev.i!==t.i&&!gp(s,t)&&(Mr(s,t)&&Mr(t,s)&&_p(s,t)&&(Se(s.prev,s,t.prev)||Se(s,t.prev,t))||Rs(s,t)&&Se(s.prev,s,s.next)>0&&Se(t.prev,t,t.next)>0)}function Se(s,t,e){return(t.y-s.y)*(e.x-t.x)-(t.x-s.x)*(e.y-t.y)}function Rs(s,t){return s.x===t.x&&s.y===t.y}function td(s,t,e,i){let n=Fo(Se(s,t,e)),r=Fo(Se(s,t,i)),o=Fo(Se(e,i,s)),a=Fo(Se(e,i,t));return!!(n!==r&&o!==a||n===0&&Uo(s,e,t)||r===0&&Uo(s,i,t)||o===0&&Uo(e,s,i)||a===0&&Uo(e,t,i))}function Uo(s,t,e){return t.x<=Math.max(s.x,e.x)&&t.x>=Math.min(s.x,e.x)&&t.y<=Math.max(s.y,e.y)&&t.y>=Math.min(s.y,e.y)}function Fo(s){return s>0?1:s<0?-1:0}function gp(s,t){let e=s;do{if(e.i!==s.i&&e.next.i!==s.i&&e.i!==t.i&&e.next.i!==t.i&&td(e,e.next,s,t))return!0;e=e.next}while(e!==s);return!1}function Mr(s,t){return Se(s.prev,s,s.next)<0?Se(s,t,s.next)>=0&&Se(s,s.prev,t)>=0:Se(s,t,s.prev)<0||Se(s,s.next,t)<0}function _p(s,t){let e=s,i=!1,n=(s.x+t.x)/2,r=(s.y+t.y)/2;do e.y>r!=e.next.y>r&&e.next.y!==e.y&&n<(e.next.x-e.x)*(r-e.y)/(e.next.y-e.y)+e.x&&(i=!i),e=e.next;while(e!==s);return i}function ed(s,t){let e=xc(s.i,s.x,s.y),i=xc(t.i,t.x,t.y),n=s.next,r=t.prev;return s.next=t,t.prev=s,e.next=n,n.prev=e,i.next=e,e.prev=i,r.next=i,i.prev=r,i}function ou(s,t,e,i){let n=xc(s,t,e);return i?(n.next=i.next,n.prev=i,i.next.prev=n,i.next=n):(n.prev=n,n.next=n),n}function br(s){s.next.prev=s.prev,s.prev.next=s.next,s.prevZ&&(s.prevZ.nextZ=s.nextZ),s.nextZ&&(s.nextZ.prevZ=s.prevZ)}function xc(s,t,e){return{i:s,x:t,y:e,prev:null,next:null,z:0,prevZ:null,nextZ:null,steiner:!1}}function vp(s,t,e,i){let n=0;for(let r=t,o=e-i;r<e;r+=i)n+=(s[o]-s[r])*(s[r+1]+s[o+1]),o=r;return n}var yc=class{static triangulate(t,e,i=2){return ip(t,e,i)}},Oi=class s{static area(t){let e=t.length,i=0;for(let n=e-1,r=0;r<e;n=r++)i+=t[n].x*t[r].y-t[r].x*t[n].y;return i*.5}static isClockWise(t){return s.area(t)<0}static triangulateShape(t,e){let i=[],n=[],r=[];au(t),lu(i,t);let o=t.length;e.forEach(au);for(let l=0;l<e.length;l++)n.push(o),o+=e[l].length,lu(i,e[l]);let a=yc.triangulate(i,n);for(let l=0;l<a.length;l+=3)r.push(a.slice(l,l+3));return r}};function au(s){let t=s.length;t>2&&s[t-1].equals(s[0])&&s.pop()}function lu(s,t){for(let e=0;e<t.length;e++)s.push(t[e].x),s.push(t[e].y)}var Sr=class s extends De{constructor(t=new Vn([new tt(.5,.5),new tt(-.5,.5),new tt(-.5,-.5),new tt(.5,-.5)]),e={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:t,options:e},t=Array.isArray(t)?t:[t];let i=this,n=[],r=[];for(let a=0,l=t.length;a<l;a++){let c=t[a];o(c)}this.setAttribute("position",new ge(n,3)),this.setAttribute("uv",new ge(r,2)),this.computeVertexNormals();function o(a){let l=[],c=e.curveSegments!==void 0?e.curveSegments:12,h=e.steps!==void 0?e.steps:1,f=e.depth!==void 0?e.depth:1,u=e.bevelEnabled!==void 0?e.bevelEnabled:!0,d=e.bevelThickness!==void 0?e.bevelThickness:.2,m=e.bevelSize!==void 0?e.bevelSize:d-.1,_=e.bevelOffset!==void 0?e.bevelOffset:0,p=e.bevelSegments!==void 0?e.bevelSegments:3,g=e.extrudePath,M=e.UVGenerator!==void 0?e.UVGenerator:xp,T,y=!1,b,E,C,x;if(g){T=g.getSpacedPoints(h),y=!0,u=!1;let et=g.isCatmullRomCurve3?g.closed:!1;b=g.computeFrenetFrames(h,et),E=new D,C=new D,x=new D}u||(p=0,d=0,m=0,_=0);let A=a.extractPoints(c),L=A.shape,U=A.holes;if(!Oi.isClockWise(L)){L=L.reverse();for(let et=0,at=U.length;et<at;et++){let st=U[et];Oi.isClockWise(st)&&(U[et]=st.reverse())}}function P(et){let st=10000000000000001e-36,ot=et[0];for(let ct=1;ct<=et.length;ct++){let Ft=ct%et.length,Pt=et[Ft],Dt=Pt.x-ot.x,Xt=Pt.y-ot.y,F=Dt*Dt+Xt*Xt,se=Math.max(Math.abs(Pt.x),Math.abs(Pt.y),Math.abs(ot.x),Math.abs(ot.y)),Jt=st*se*se;if(F<=Jt){et.splice(Ft,1),ct--;continue}ot=Pt}}P(L),U.forEach(P);let I=U.length,N=L;for(let et=0;et<I;et++){let at=U[et];L=L.concat(at)}function B(et,at,st){return at||qt("ExtrudeGeometry: vec does not exist"),et.clone().addScaledVector(at,st)}let O=L.length;function G(et,at,st){let ot,ct,Ft,Pt=et.x-at.x,Dt=et.y-at.y,Xt=st.x-et.x,F=st.y-et.y,se=Pt*Pt+Dt*Dt,Jt=Pt*F-Dt*Xt;if(Math.abs(Jt)>Number.EPSILON){let R=Math.sqrt(se),v=Math.sqrt(Xt*Xt+F*F),H=at.x-Dt/R,X=at.y+Pt/R,K=st.x-F/v,ht=st.y+Xt/v,ft=((K-H)*F-(ht-X)*Xt)/(Pt*F-Dt*Xt);ot=H+Pt*ft-et.x,ct=X+Dt*ft-et.y;let Q=ot*ot+ct*ct;if(Q<=2)return new tt(ot,ct);Ft=Math.sqrt(Q/2)}else{let R=!1;Pt>Number.EPSILON?Xt>Number.EPSILON&&(R=!0):Pt<-Number.EPSILON?Xt<-Number.EPSILON&&(R=!0):Math.sign(Dt)===Math.sign(F)&&(R=!0),R?(ot=-Dt,ct=Pt,Ft=Math.sqrt(se)):(ot=Pt,ct=Dt,Ft=Math.sqrt(se/2))}return new tt(ot/Ft,ct/Ft)}let V=[];for(let et=0,at=N.length,st=at-1,ot=et+1;et<at;et++,st++,ot++)st===at&&(st=0),ot===at&&(ot=0),V[et]=G(N[et],N[st],N[ot]);let W=[],$,dt=V.concat();for(let et=0,at=I;et<at;et++){let st=U[et];$=[];for(let ot=0,ct=st.length,Ft=ct-1,Pt=ot+1;ot<ct;ot++,Ft++,Pt++)Ft===ct&&(Ft=0),Pt===ct&&(Pt=0),$[ot]=G(st[ot],st[Ft],st[Pt]);W.push($),dt=dt.concat($)}let mt;if(p===0)mt=Oi.triangulateShape(N,U);else{let et=[],at=[];for(let st=0;st<p;st++){let ot=st/p,ct=d*Math.cos(ot*Math.PI/2),Ft=m*Math.sin(ot*Math.PI/2)+_;for(let Pt=0,Dt=N.length;Pt<Dt;Pt++){let Xt=B(N[Pt],V[Pt],Ft);ut(Xt.x,Xt.y,-ct),ot===0&&et.push(Xt)}for(let Pt=0,Dt=I;Pt<Dt;Pt++){let Xt=U[Pt];$=W[Pt];let F=[];for(let se=0,Jt=Xt.length;se<Jt;se++){let R=B(Xt[se],$[se],Ft);ut(R.x,R.y,-ct),ot===0&&F.push(R)}ot===0&&at.push(F)}}mt=Oi.triangulateShape(et,at)}let Ct=mt.length,wt=m+_;for(let et=0;et<O;et++){let at=u?B(L[et],dt[et],wt):L[et];y?(C.copy(b.normals[0]).multiplyScalar(at.x),E.copy(b.binormals[0]).multiplyScalar(at.y),x.copy(T[0]).add(C).add(E),ut(x.x,x.y,x.z)):ut(at.x,at.y,0)}for(let et=1;et<=h;et++)for(let at=0;at<O;at++){let st=u?B(L[at],dt[at],wt):L[at];y?(C.copy(b.normals[et]).multiplyScalar(st.x),E.copy(b.binormals[et]).multiplyScalar(st.y),x.copy(T[et]).add(C).add(E),ut(x.x,x.y,x.z)):ut(st.x,st.y,f/h*et)}for(let et=p-1;et>=0;et--){let at=et/p,st=d*Math.cos(at*Math.PI/2),ot=m*Math.sin(at*Math.PI/2)+_;for(let ct=0,Ft=N.length;ct<Ft;ct++){let Pt=B(N[ct],V[ct],ot);ut(Pt.x,Pt.y,f+st)}for(let ct=0,Ft=U.length;ct<Ft;ct++){let Pt=U[ct];$=W[ct];for(let Dt=0,Xt=Pt.length;Dt<Xt;Dt++){let F=B(Pt[Dt],$[Dt],ot);y?ut(F.x,F.y+T[h-1].y,T[h-1].x+st):ut(F.x,F.y,f+st)}}}Ht(),Z();function Ht(){let et=n.length/3;if(u){let at=0,st=O*at;for(let ot=0;ot<Ct;ot++){let ct=mt[ot];It(ct[2]+st,ct[1]+st,ct[0]+st)}at=h+p*2,st=O*at;for(let ot=0;ot<Ct;ot++){let ct=mt[ot];It(ct[0]+st,ct[1]+st,ct[2]+st)}}else{for(let at=0;at<Ct;at++){let st=mt[at];It(st[2],st[1],st[0])}for(let at=0;at<Ct;at++){let st=mt[at];It(st[0]+O*h,st[1]+O*h,st[2]+O*h)}}i.addGroup(et,n.length/3-et,0)}function Z(){let et=n.length/3,at=0;j(N,at),at+=N.length;for(let st=0,ot=U.length;st<ot;st++){let ct=U[st];j(ct,at),at+=ct.length}i.addGroup(et,n.length/3-et,1)}function j(et,at){let st=et.length;for(;--st>=0;){let ot=st,ct=st-1;ct<0&&(ct=et.length-1);for(let Ft=0,Pt=h+p*2;Ft<Pt;Ft++){let Dt=O*Ft,Xt=O*(Ft+1),F=at+ot+Dt,se=at+ct+Dt,Jt=at+ct+Xt,R=at+ot+Xt;vt(F,se,Jt,R)}}}function ut(et,at,st){l.push(et),l.push(at),l.push(st)}function It(et,at,st){Bt(et),Bt(at),Bt(st);let ot=n.length/3,ct=M.generateTopUV(i,n,ot-3,ot-2,ot-1);ie(ct[0]),ie(ct[1]),ie(ct[2])}function vt(et,at,st,ot){Bt(et),Bt(at),Bt(ot),Bt(at),Bt(st),Bt(ot);let ct=n.length/3,Ft=M.generateSideWallUV(i,n,ct-6,ct-3,ct-2,ct-1);ie(Ft[0]),ie(Ft[1]),ie(Ft[3]),ie(Ft[1]),ie(Ft[2]),ie(Ft[3])}function Bt(et){n.push(l[et*3+0]),n.push(l[et*3+1]),n.push(l[et*3+2])}function ie(et){r.push(et.x),r.push(et.y)}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){let t=super.toJSON(),e=this.parameters.shapes,i=this.parameters.options;return yp(e,i,t)}static fromJSON(t,e){let i=[];for(let r=0,o=t.shapes.length;r<o;r++){let a=e[t.shapes[r]];i.push(a)}let n=t.options.extrudePath;return n!==void 0&&(t.options.extrudePath=new _c[n.type]().fromJSON(n)),new s(i,t.options)}},xp={generateTopUV:function(s,t,e,i,n){let r=t[e*3],o=t[e*3+1],a=t[i*3],l=t[i*3+1],c=t[n*3],h=t[n*3+1];return[new tt(r,o),new tt(a,l),new tt(c,h)]},generateSideWallUV:function(s,t,e,i,n,r){let o=t[e*3],a=t[e*3+1],l=t[e*3+2],c=t[i*3],h=t[i*3+1],f=t[i*3+2],u=t[n*3],d=t[n*3+1],m=t[n*3+2],_=t[r*3],p=t[r*3+1],g=t[r*3+2];return Math.abs(a-h)<Math.abs(o-c)?[new tt(o,1-l),new tt(c,1-f),new tt(u,1-m),new tt(_,1-g)]:[new tt(a,1-l),new tt(h,1-f),new tt(d,1-m),new tt(p,1-g)]}};function yp(s,t,e){if(e.shapes=[],Array.isArray(s))for(let i=0,n=s.length;i<n;i++){let r=s[i];e.shapes.push(r.uuid)}else e.shapes.push(s.uuid);return e.options=Object.assign({},t),t.extrudePath!==void 0&&(e.options.extrudePath=t.extrudePath.toJSON()),e}var Gn=class s extends De{constructor(t=1,e=1,i=1,n=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:i,heightSegments:n};let r=t/2,o=e/2,a=Math.floor(i),l=Math.floor(n),c=a+1,h=l+1,f=t/a,u=e/l,d=[],m=[],_=[],p=[];for(let g=0;g<h;g++){let M=g*u-o;for(let T=0;T<c;T++){let y=T*f-r;m.push(y,-M,0),_.push(0,0,1),p.push(T/a),p.push(1-g/l)}}for(let g=0;g<l;g++)for(let M=0;M<a;M++){let T=M+c*g,y=M+c*(g+1),b=M+1+c*(g+1),E=M+1+c*g;d.push(T,y,E),d.push(y,b,E)}this.setIndex(d),this.setAttribute("position",new ge(m,3)),this.setAttribute("normal",new ge(_,3)),this.setAttribute("uv",new ge(p,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new s(t.width,t.height,t.widthSegments,t.heightSegments)}};var gn=class s extends De{constructor(t=new Vn([new tt(0,.5),new tt(-.5,-.5),new tt(.5,-.5)]),e=12){super(),this.type="ShapeGeometry",this.parameters={shapes:t,curveSegments:e};let i=[],n=[],r=[],o=[],a=0,l=0;if(Array.isArray(t)===!1)c(t);else for(let h=0;h<t.length;h++)c(t[h]),this.addGroup(a,l,h),a+=l,l=0;this.setIndex(i),this.setAttribute("position",new ge(n,3)),this.setAttribute("normal",new ge(r,3)),this.setAttribute("uv",new ge(o,2));function c(h){let f=n.length/3,u=h.extractPoints(e),d=u.shape,m=u.holes;Oi.isClockWise(d)===!1&&(d=d.reverse());for(let p=0,g=m.length;p<g;p++){let M=m[p];Oi.isClockWise(M)===!0&&(m[p]=M.reverse())}let _=Oi.triangulateShape(d,m);for(let p=0,g=m.length;p<g;p++){let M=m[p];d=d.concat(M)}for(let p=0,g=d.length;p<g;p++){let M=d[p];n.push(M.x,M.y,0),r.push(0,0,1),o.push(M.x,M.y)}for(let p=0,g=_.length;p<g;p++){let M=_[p],T=M[0]+f,y=M[1]+f,b=M[2]+f;i.push(T,y,b),l+=3}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){let t=super.toJSON(),e=this.parameters.shapes;return Mp(e,t)}static fromJSON(t,e){let i=[];for(let n=0,r=t.shapes.length;n<r;n++){let o=e[t.shapes[n]];i.push(o)}return new s(i,t.curveSegments)}};function Mp(s,t){if(t.shapes=[],Array.isArray(s))for(let e=0,i=s.length;e<i;e++){let n=s[e];t.shapes.push(n.uuid)}else t.shapes.push(s.uuid);return t}var _n=class s extends De{constructor(t=1,e=32,i=16,n=0,r=Math.PI*2,o=0,a=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:i,phiStart:n,phiLength:r,thetaStart:o,thetaLength:a},e=Math.max(3,Math.floor(e)),i=Math.max(2,Math.floor(i));let l=Math.min(o+a,Math.PI),c=0,h=[],f=new D,u=new D,d=[],m=[],_=[],p=[];for(let g=0;g<=i;g++){let M=[],T=g/i,y=o+T*a,b=t*Math.cos(y),E=Math.sqrt(t*t-b*b),C=0;g===0&&o===0?C=.5/e:g===i&&l===Math.PI&&(C=-.5/e);for(let x=0;x<=e;x++){let A=x/e,L=n+A*r;f.x=-E*Math.cos(L),f.y=b,f.z=E*Math.sin(L),m.push(f.x,f.y,f.z),u.copy(f).normalize(),_.push(u.x,u.y,u.z),p.push(A+C,1-T),M.push(c++)}h.push(M)}for(let g=0;g<i;g++)for(let M=0;M<e;M++){let T=h[g][M+1],y=h[g][M],b=h[g+1][M],E=h[g+1][M+1];(g!==0||o>0)&&d.push(T,y,E),(g!==i-1||l<Math.PI)&&d.push(y,b,E)}this.setIndex(d),this.setAttribute("position",new ge(m,3)),this.setAttribute("normal",new ge(_,3)),this.setAttribute("uv",new ge(p,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new s(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}};function Zn(s){let t={};for(let e in s){t[e]={};for(let i in s[e]){let n=s[e][i];if(cu(n))n.isRenderTargetTexture?(Yt("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][i]=null):t[e][i]=n.clone();else if(Array.isArray(n))if(cu(n[0])){let r=[];for(let o=0,a=n.length;o<a;o++)r[o]=n[o].clone();t[e][i]=r}else t[e][i]=n.slice();else t[e][i]=n}}return t}function Je(s){let t={};for(let e=0;e<s.length;e++){let i=Zn(s[e]);for(let n in i)t[n]=i[n]}return t}function cu(s){return s&&(s.isColor||s.isMatrix3||s.isMatrix4||s.isVector2||s.isVector3||s.isVector4||s.isTexture||s.isQuaternion)}function bp(s){let t=[];for(let e=0;e<s.length;e++)t.push(s[e].clone());return t}function Wc(s){let t=s.getRenderTarget();return t===null?s.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:ne.workingColorSpace}var Ue={clone:Zn,merge:Je},Sp=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,wp=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,ce=class extends Ti{constructor(t){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Sp,this.fragmentShader=wp,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=Zn(t.uniforms),this.uniformsGroups=bp(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this.defaultAttributeValues=Object.assign({},t.defaultAttributeValues),this.index0AttributeName=t.index0AttributeName,this.uniformsNeedUpdate=t.uniformsNeedUpdate,this}toJSON(t){let e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(let n in this.uniforms){let o=this.uniforms[n].value;o&&o.isTexture?e.uniforms[n]={type:"t",value:o.toJSON(t).uuid}:o&&o.isColor?e.uniforms[n]={type:"c",value:o.getHex()}:o&&o.isVector2?e.uniforms[n]={type:"v2",value:o.toArray()}:o&&o.isVector3?e.uniforms[n]={type:"v3",value:o.toArray()}:o&&o.isVector4?e.uniforms[n]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?e.uniforms[n]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?e.uniforms[n]={type:"m4",value:o.toArray()}:e.uniforms[n]={value:o}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;let i={};for(let n in this.extensions)this.extensions[n]===!0&&(i[n]=!0);return Object.keys(i).length>0&&(e.extensions=i),e}fromJSON(t,e){if(super.fromJSON(t,e),t.uniforms!==void 0)for(let i in t.uniforms){let n=t.uniforms[i];switch(this.uniforms[i]={},n.type){case"t":this.uniforms[i].value=e[n.value]||null;break;case"c":this.uniforms[i].value=new Vt().setHex(n.value);break;case"v2":this.uniforms[i].value=new tt().fromArray(n.value);break;case"v3":this.uniforms[i].value=new D().fromArray(n.value);break;case"v4":this.uniforms[i].value=new _e().fromArray(n.value);break;case"m3":this.uniforms[i].value=new jt().fromArray(n.value);break;case"m4":this.uniforms[i].value=new oe().fromArray(n.value);break;default:this.uniforms[i].value=n.value}}if(t.defines!==void 0&&(this.defines=t.defines),t.vertexShader!==void 0&&(this.vertexShader=t.vertexShader),t.fragmentShader!==void 0&&(this.fragmentShader=t.fragmentShader),t.glslVersion!==void 0&&(this.glslVersion=t.glslVersion),t.extensions!==void 0)for(let i in t.extensions)this.extensions[i]=t.extensions[i];return t.lights!==void 0&&(this.lights=t.lights),t.clipping!==void 0&&(this.clipping=t.clipping),this}},Ps=class extends ce{constructor(t){super(t),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}},We=class extends Ti{constructor(t){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Vt(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Vt(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Fs,this.normalScale=new tt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new zi,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={STANDARD:""},this.color.copy(t.color),this.roughness=t.roughness,this.metalness=t.metalness,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.roughnessMap=t.roughnessMap,this.metalnessMap=t.metalnessMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.envMapIntensity=t.envMapIntensity,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}},wr=class extends We{constructor(t){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.type="MeshPhysicalMaterial",this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new tt(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return Qt(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(e){this.ior=(1+.4*e)/(1-.4*e)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new Vt(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new Vt(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new Vt(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._retroreflectivity=0,this._sheen=0,this._transmission=0,this.setValues(t)}get anisotropy(){return this._anisotropy}set anisotropy(t){this._anisotropy>0!=t>0&&this.version++,this._anisotropy=t}get clearcoat(){return this._clearcoat}set clearcoat(t){this._clearcoat>0!=t>0&&this.version++,this._clearcoat=t}get iridescence(){return this._iridescence}set iridescence(t){this._iridescence>0!=t>0&&this.version++,this._iridescence=t}get dispersion(){return this._dispersion}set dispersion(t){this._dispersion>0!=t>0&&this.version++,this._dispersion=t}get retroreflectivity(){return this._retroreflectivity}set retroreflectivity(t){this._retroreflectivity>0!=t>0&&this.version++,this._retroreflectivity=t}get sheen(){return this._sheen}set sheen(t){this._sheen>0!=t>0&&this.version++,this._sheen=t}get transmission(){return this._transmission}set transmission(t){this._transmission>0!=t>0&&this.version++,this._transmission=t}copy(t){return super.copy(t),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=t.anisotropy,this.anisotropyRotation=t.anisotropyRotation,this.anisotropyMap=t.anisotropyMap,this.clearcoat=t.clearcoat,this.clearcoatMap=t.clearcoatMap,this.clearcoatRoughness=t.clearcoatRoughness,this.clearcoatRoughnessMap=t.clearcoatRoughnessMap,this.clearcoatNormalMap=t.clearcoatNormalMap,this.clearcoatNormalScale.copy(t.clearcoatNormalScale),this.dispersion=t.dispersion,this.ior=t.ior,this.iridescence=t.iridescence,this.iridescenceMap=t.iridescenceMap,this.iridescenceIOR=t.iridescenceIOR,this.iridescenceThicknessRange=[...t.iridescenceThicknessRange],this.iridescenceThicknessMap=t.iridescenceThicknessMap,this.retroreflectivity=t.retroreflectivity,this.sheen=t.sheen,this.sheenColor.copy(t.sheenColor),this.sheenColorMap=t.sheenColorMap,this.sheenRoughness=t.sheenRoughness,this.sheenRoughnessMap=t.sheenRoughnessMap,this.transmission=t.transmission,this.transmissionMap=t.transmissionMap,this.thickness=t.thickness,this.thicknessMap=t.thicknessMap,this.attenuationDistance=t.attenuationDistance,this.attenuationColor.copy(t.attenuationColor),this.specularIntensity=t.specularIntensity,this.specularIntensityMap=t.specularIntensityMap,this.specularColor.copy(t.specularColor),this.specularColorMap=t.specularColorMap,this}};var Er=class extends Ti{constructor(t){super(),this.isMeshNormalMaterial=!0,this.type="MeshNormalMaterial",this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Fs,this.normalScale=new tt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.flatShading=!1,this.setValues(t)}copy(t){return super.copy(t),this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.flatShading=t.flatShading,this}},Tr=class extends Ti{constructor(t){super(),this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new Vt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Vt(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Fs,this.normalScale=new tt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new zi,this.combine=ba,this.reflectivity=1,this.envMapIntensity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.envMapIntensity=t.envMapIntensity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}},oa=class extends Ti{constructor(t){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Ou,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}},aa=class extends Ti{constructor(t){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}};function fs(s,t){return!s||s.constructor===t?s:typeof t.BYTES_PER_ELEMENT=="number"?new t(s):Array.prototype.slice.call(s)}function uc(s){return s!==void 0&&s.inTangents!==void 0&&s.outTangents!==void 0}var vn=class{constructor(t,e,i,n){this.parameterPositions=t,this._cachedIndex=0,this.resultBuffer=n!==void 0?n:new e.constructor(i),this.sampleValues=e,this.valueSize=i,this.settings=null,this.DefaultSettings_={}}evaluate(t){let e=this.parameterPositions,i=this._cachedIndex,n=e[i],r=e[i-1];i:{t:{let o;e:{n:if(!(t<n)){for(let a=i+2;;){if(n===void 0){if(t<r)break n;return i=e.length,this._cachedIndex=i,this.copySampleValue_(i-1)}if(i===a)break;if(r=n,n=e[++i],t<n)break t}o=e.length;break e}if(!(t>=r)){let a=e[1];t<a&&(i=2,r=a);for(let l=i-2;;){if(r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(i===l)break;if(n=r,r=e[--i-1],t>=r)break t}o=i,i=0;break e}break i}for(;i<o;){let a=i+o>>>1;t<e[a]?o=a:i=a+1}if(n=e[i],r=e[i-1],r===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===void 0)return i=e.length,this._cachedIndex=i,this.copySampleValue_(i-1)}this._cachedIndex=i,this.intervalChanged_(i,r,n)}return this.interpolate_(i,r,t,n)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(t){let e=this.resultBuffer,i=this.sampleValues,n=this.valueSize,r=t*n;for(let o=0;o!==n;++o)e[o]=i[r+o];return e}interpolate_(){throw new Error("THREE.Interpolant: Call to abstract method.")}intervalChanged_(){}},la=class extends vn{constructor(t,e,i,n){super(t,e,i,n),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:pc,endingEnd:pc}}intervalChanged_(t,e,i){let n=this.parameterPositions,r=t-2,o=t+1,a=n[r],l=n[o];if(a===void 0)switch(this.getSettings_().endingStart){case mc:r=t,a=2*e-i;break;case gc:r=n.length-2,a=e+n[r]-n[r+1];break;default:r=t,a=i}if(l===void 0)switch(this.getSettings_().endingEnd){case mc:o=t,l=2*i-e;break;case gc:o=1,l=i+n[1]-n[0];break;default:o=t-1,l=e}let c=(i-e)*.5,h=this.valueSize;this._weightPrev=c/(e-a),this._weightNext=c/(l-i),this._offsetPrev=r*h,this._offsetNext=o*h}interpolate_(t,e,i,n){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=t*a,c=l-a,h=this._offsetPrev,f=this._offsetNext,u=this._weightPrev,d=this._weightNext,m=(i-e)/(n-e),_=m*m,p=_*m,g=-u*p+2*u*_-u*m,M=(1+u)*p+(-1.5-2*u)*_+(-.5+u)*m+1,T=(-1-d)*p+(1.5+d)*_+.5*m,y=d*p-d*_;for(let b=0;b!==a;++b)r[b]=g*o[h+b]+M*o[c+b]+T*o[l+b]+y*o[f+b];return r}},ca=class extends vn{constructor(t,e,i,n){super(t,e,i,n)}interpolate_(t,e,i,n){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=t*a,c=l-a,h=(i-e)/(n-e),f=1-h;for(let u=0;u!==a;++u)r[u]=o[c+u]*f+o[l+u]*h;return r}},ha=class extends vn{constructor(t,e,i,n){super(t,e,i,n)}interpolate_(t){return this.copySampleValue_(t-1)}},ua=class extends vn{interpolate_(t,e,i,n){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=t*a,c=l-a,h=this.inTangents,f=this.outTangents;if(!h||!f){let m=(i-e)/(n-e),_=1-m;for(let p=0;p!==a;++p)r[p]=o[c+p]*_+o[l+p]*m;return r}let u=a*2,d=t-1;for(let m=0;m!==a;++m){let _=o[c+m],p=o[l+m],g=d*u+m*2,M=f[g],T=f[g+1],y=t*u+m*2,b=h[y],E=h[y+1],C=Tp(i,e,M,b,n);r[m]=id(C,_,T,E,p)}return r}};function id(s,t,e,i,n){let r=1-s;return r*r*r*t+3*r*r*s*e+3*r*s*s*i+s*s*s*n}function Ep(s,t,e,i,n){let r=1-s;return 3*r*r*(e-t)+6*r*s*(i-e)+3*s*s*(n-i)}function Tp(s,t,e,i,n){let r=(s-t)/(n-t);for(let o=0;o<8;o++){let a=id(r,t,e,i,n)-s;if(Math.abs(a)<1e-10)break;let l=Ep(r,t,e,i,n);if(Math.abs(l)<1e-10)break;r=Math.max(0,Math.min(1,r-a/l))}return r}var di=class{constructor(t,e,i,n){if(t===void 0)throw new Error("THREE.KeyframeTrack: track name is undefined");if(e===void 0||e.length===0)throw new Error("THREE.KeyframeTrack: no keyframes in track named "+t);this.name=t,this.times=fs(e,this.TimeBufferType),this.values=fs(i,this.ValueBufferType),this.setInterpolation(n||this.DefaultInterpolation)}static toJSON(t){let e=t.constructor,i;if(e.toJSON!==this.toJSON)i=e.toJSON(t);else{i={name:t.name,times:fs(t.times,Array),values:fs(t.values,Array)};let n=t.getInterpolation();n!==t.DefaultInterpolation&&(i.interpolation=n),uc(t.settings)&&(i.settings={inTangents:fs(t.settings.inTangents,Array),outTangents:fs(t.settings.outTangents,Array)})}return i.type=t.ValueTypeName,i}InterpolantFactoryMethodDiscrete(t){return new ha(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodLinear(t){return new ca(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodSmooth(t){return new la(this.times,this.values,this.getValueSize(),t)}InterpolantFactoryMethodBezier(t){let e=new ua(this.times,this.values,this.getValueSize(),t);return this.settings&&(e.inTangents=this.settings.inTangents,e.outTangents=this.settings.outTangents),e}setInterpolation(t){let e;switch(t){case sr:e=this.InterpolantFactoryMethodDiscrete;break;case $o:e=this.InterpolantFactoryMethodLinear;break;case ko:e=this.InterpolantFactoryMethodSmooth;break;case fc:e=this.InterpolantFactoryMethodBezier;break}if(e===void 0){let i="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if(t!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw new Error(i);return Yt("KeyframeTrack:",i),this}return this.createInterpolant=e,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return sr;case this.InterpolantFactoryMethodLinear:return $o;case this.InterpolantFactoryMethodSmooth:return ko;case this.InterpolantFactoryMethodBezier:return fc}}getValueSize(){return this.values.length/this.times.length}shift(t){if(t!==0){let e=this.times;for(let i=0,n=e.length;i!==n;++i)e[i]+=t}return this}scale(t){if(t!==1){let e=this.times;for(let i=0,n=e.length;i!==n;++i)e[i]*=t;uc(this.settings)&&(hu(this.settings.inTangents,t),hu(this.settings.outTangents,t))}return this}trim(t,e){let i=this.times,n=i.length,r=0,o=n-1;for(;r!==n&&i[r]<t;)++r;for(;o!==-1&&i[o]>e;)--o;if(++o,r!==0||o!==n){r>=o&&(o=Math.max(o,1),r=o-1);let a=this.getValueSize();this.times=i.slice(r,o),this.values=this.values.slice(r*a,o*a)}return this}validate(){let t=!0,e=this.getValueSize();e-Math.floor(e)!==0&&(qt("KeyframeTrack: Invalid value size in track.",this),t=!1);let i=this.times,n=this.values,r=i.length;r===0&&(qt("KeyframeTrack: Track is empty.",this),t=!1);let o=null;for(let a=0;a!==r;a++){let l=i[a];if(typeof l=="number"&&isNaN(l)){qt("KeyframeTrack: Time is not a valid number.",this,a,l),t=!1;break}if(o!==null&&o>l){qt("KeyframeTrack: Out of order keys.",this,a,l,o),t=!1;break}o=l}if(n!==void 0&&pf(n))for(let a=0,l=n.length;a!==l;++a){let c=n[a];if(isNaN(c)){qt("KeyframeTrack: Value is not a valid number.",this,a,c),t=!1;break}}return t}optimize(){let t=this.times.slice(),e=this.values.slice(),i=this.getValueSize(),n=this.getInterpolation()===ko,r=t.length-1,o=1;for(let a=1;a<r;++a){let l=!1,c=t[a],h=t[a+1];if(c!==h&&(a!==1||c!==t[0]))if(n)l=!0;else{let f=a*i,u=f-i,d=f+i;for(let m=0;m!==i;++m){let _=e[f+m];if(_!==e[u+m]||_!==e[d+m]){l=!0;break}}}if(l){if(a!==o){t[o]=t[a];let f=a*i,u=o*i;for(let d=0;d!==i;++d)e[u+d]=e[f+d]}++o}}if(r>0){t[o]=t[r];for(let a=r*i,l=o*i,c=0;c!==i;++c)e[l+c]=e[a+c];++o}return o!==t.length?(this.times=t.slice(0,o),this.values=e.slice(0,o*i)):(this.times=t,this.values=e),this}clone(){let t=this.times.slice(),e=this.values.slice(),i=this.constructor,n=new i(this.name,t,e);return n.createInterpolant=this.createInterpolant,uc(this.settings)&&(n.settings={inTangents:this.settings.inTangents.slice(),outTangents:this.settings.outTangents.slice()}),n}};function hu(s,t){for(let e=0,i=s.length;e!==i;e+=2)s[e]*=t}di.prototype.ValueTypeName="";di.prototype.TimeBufferType=Float32Array;di.prototype.ValueBufferType=Float32Array;di.prototype.DefaultInterpolation=$o;var xn=class extends di{constructor(t,e,i){super(t,e,i)}};xn.prototype.ValueTypeName="bool";xn.prototype.ValueBufferType=Array;xn.prototype.DefaultInterpolation=sr;xn.prototype.InterpolantFactoryMethodLinear=void 0;xn.prototype.InterpolantFactoryMethodSmooth=void 0;var da=class extends di{constructor(t,e,i,n){super(t,e,i,n)}};da.prototype.ValueTypeName="color";var fa=class extends di{constructor(t,e,i,n){super(t,e,i,n)}};fa.prototype.ValueTypeName="number";var pa=class extends vn{constructor(t,e,i,n){super(t,e,i,n)}interpolate_(t,e,i,n){let r=this.resultBuffer,o=this.sampleValues,a=this.valueSize,l=(i-e)/(n-e),c=t*a;for(let h=c+a;c!==h;c+=4)hi.slerpFlat(r,0,o,c-a,o,c,l);return r}},Ar=class extends di{constructor(t,e,i,n){super(t,e,i,n)}InterpolantFactoryMethodLinear(t){return new pa(this.times,this.values,this.getValueSize(),t)}};Ar.prototype.ValueTypeName="quaternion";Ar.prototype.InterpolantFactoryMethodSmooth=void 0;var yn=class extends di{constructor(t,e,i){super(t,e,i)}};yn.prototype.ValueTypeName="string";yn.prototype.ValueBufferType=Array;yn.prototype.DefaultInterpolation=sr;yn.prototype.InterpolantFactoryMethodLinear=void 0;yn.prototype.InterpolantFactoryMethodSmooth=void 0;var ma=class extends di{constructor(t,e,i,n){super(t,e,i,n)}};ma.prototype.ValueTypeName="vector";var ga=class{constructor(t,e,i){let n=this,r=!1,o=0,a=0,l,c=[];this.onStart=void 0,this.onLoad=t,this.onProgress=e,this.onError=i,this._abortController=null,this.itemStart=function(h){a++,r===!1&&n.onStart!==void 0&&n.onStart(h,o,a),r=!0},this.itemEnd=function(h){o++,n.onProgress!==void 0&&n.onProgress(h,o,a),o===a&&(r=!1,n.onLoad!==void 0&&n.onLoad())},this.itemError=function(h){n.onError!==void 0&&n.onError(h)},this.resolveURL=function(h){return h=h.normalize("NFC"),l?l(h):h},this.setURLModifier=function(h){return l=h,this},this.addHandler=function(h,f){return c.push(h,f),this},this.removeHandler=function(h){let f=c.indexOf(h);return f!==-1&&c.splice(f,2),this},this.getHandler=function(h){for(let f=0,u=c.length;f<u;f+=2){let d=c[f],m=c[f+1];if(d.global&&(d.lastIndex=0),d.test(h))return m}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||(this._abortController=new AbortController),this._abortController}},nd=new ga,_a=class{constructor(t){this.manager=t!==void 0?t:nd,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}load(){}loadAsync(t,e){let i=this;return new Promise(function(n,r){i.load(t,n,e,r)})}parse(){}setCrossOrigin(t){return this.crossOrigin=t,this}setWithCredentials(t){return this.withCredentials=t,this}setPath(t){return this.path=t,this}setResourcePath(t){return this.resourcePath=t,this}setRequestHeader(t){return this.requestHeader=t,this}abort(){return this}};_a.DEFAULT_MATERIAL_NAME="__DEFAULT";var Wn=class extends Ge{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new Vt(t),this.intensity=e}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){let e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,e}},Cr=class extends Wn{constructor(t,e,i){super(t,i),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Ge.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Vt(e)}copy(t,e){return super.copy(t,e),this.groundColor.copy(t.groundColor),this}toJSON(t){let e=super.toJSON(t);return e.object.groundColor=this.groundColor.getHex(),e}},dc=new oe,uu=new D,du=new D,Rr=class{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new tt(512,512),this.mapType=$e,this.map=null,this.mapPass=null,this.matrix=new oe,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new As,this._frameExtents=new tt(1,1),this._viewportCount=1,this._viewports=[new _e(0,0,1,1)]}getViewportCount(){return this._viewportCount}getCamera(){return this.camera}getFrustum(){return this._frustum}updateMatrices(t){let e=this.camera;uu.setFromMatrixPosition(t.matrixWorld),e.position.copy(uu),du.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(du),e.updateMatrixWorld(),this._updateMatrix(e,this.matrix,this._frustum)}_updateMatrix(t,e,i,n){dc.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),i.setFromProjectionMatrix(dc,t.coordinateSystem,t.reversedDepth);let r=this._frameExtents,o=n?n.z/r.x:1,a=n?n.w/r.y:1,l=n?n.x/r.x:0,c=n?n.y/r.y:0;t.coordinateSystem===vs||t.reversedDepth?e.set(.5*o,0,0,.5*o+l,0,.5*a,0,.5*a+c,0,0,1,0,0,0,0,1):e.set(.5*o,0,0,.5*o+l,0,.5*a,0,.5*a+c,0,0,.5,.5,0,0,0,1),e.multiply(dc)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.autoUpdate=t.autoUpdate,this.needsUpdate=t.needsUpdate,this.normalBias=t.normalBias,this.blurSamples=t.blurSamples,this.mapSize.copy(t.mapSize),this.biasNode=t.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let t={};return t.intensity=this.intensity,t.bias=this.bias,t.normalBias=this.normalBias,t.radius=this.radius,t.blurSamples=this.blurSamples,t.mapSize=this.mapSize.toArray(),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}},Oo=new D,Bo=new hi,Ui=new D,Pr=class extends Ge{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new oe,this.projectionMatrix=new oe,this.projectionMatrixInverse=new oe,this.coordinateSystem=wi,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorld.decompose(Oo,Bo,Ui),Ui.x===1&&Ui.y===1&&Ui.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Oo,Bo,Ui.set(1,1,1)).invert()}updateWorldMatrix(t,e,i=!1){super.updateWorldMatrix(t,e,i),this.matrixWorld.decompose(Oo,Bo,Ui),Ui.x===1&&Ui.y===1&&Ui.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Oo,Bo,Ui.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},fn=new D,fu=new tt,pu=new tt,Ie=class extends Pr{constructor(t=50,e=1,i=.1,n=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=i,this.far=n,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){let e=.5*this.getFilmHeight()/t;this.fov=ys*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){let t=Math.tan(tr*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return ys*2*Math.atan(Math.tan(tr*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,i){fn.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set(fn.x,fn.y).multiplyScalar(-t/fn.z),fn.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),i.set(fn.x,fn.y).multiplyScalar(-t/fn.z)}getViewSize(t,e){return this.getViewBounds(t,fu,pu),e.subVectors(pu,fu)}setViewOffset(t,e,i,n,r,o){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=i,this.view.offsetY=n,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=this.near,e=t*Math.tan(tr*.5*this.fov)/this.zoom,i=2*e,n=this.aspect*i,r=-.5*n,o=this.view;if(this.view!==null&&this.view.enabled){let l=o.fullWidth,c=o.fullHeight;r+=o.offsetX*n/l,e-=o.offsetY*i/c,n*=o.width/l,i*=o.height/c}let a=this.filmOffset;a!==0&&(r+=t*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+n,e,e-i,t,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}};var Mc=class extends Rr{constructor(){super(new Ie(90,1,.5,500)),this.isPointLightShadow=!0}},Ir=class extends Wn{constructor(t,e,i=0,n=2){super(t,e),this.isPointLight=!0,this.type="PointLight",this.distance=i,this.decay=n,this.shadow=new Mc}get power(){return this.intensity*4*Math.PI}set power(t){this.intensity=t/(4*Math.PI)}dispose(){super.dispose(),this.shadow.dispose()}copy(t,e){return super.copy(t,e),this.distance=t.distance,this.decay=t.decay,this.shadow=t.shadow.clone(),this}toJSON(t){let e=super.toJSON(t);return e.object.distance=this.distance,e.object.decay=this.decay,e.object.shadow=this.shadow.toJSON(),e}},Ai=class extends Pr{constructor(t=-1,e=1,i=1,n=-1,r=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=i,this.bottom=n,this.near=r,this.far=o,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,i,n,r,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=i,this.view.offsetY=n,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),i=(this.right+this.left)/2,n=(this.top+this.bottom)/2,r=i-t,o=i+t,a=n+e,l=n-e;if(this.view!==null&&this.view.enabled){let c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,o=r+c*this.view.width,a-=h*this.view.offsetY,l=a-h*this.view.height}this.projectionMatrix.makeOrthographic(r,o,a,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){let e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}},bc=class extends Rr{constructor(){super(new Ai(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},Is=class extends Wn{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Ge.DEFAULT_UP),this.updateMatrix(),this.target=new Ge,this.shadow=new bc}dispose(){super.dispose(),this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}toJSON(t){let e=super.toJSON(t);return e.object.shadow=this.shadow.toJSON(),e.object.target=this.target.uuid,e}},Lr=class extends Wn{constructor(t,e){super(t,e),this.isAmbientLight=!0,this.type="AmbientLight"}};var ps=-90,ms=1,va=class extends Ge{constructor(t,e,i){super(),this.type="CubeCamera",this.renderTarget=i,this.coordinateSystem=null,this.activeMipmapLevel=0;let n=new Ie(ps,ms,t,e);n.layers=this.layers,this.add(n);let r=new Ie(ps,ms,t,e);r.layers=this.layers,this.add(r);let o=new Ie(ps,ms,t,e);o.layers=this.layers,this.add(o);let a=new Ie(ps,ms,t,e);a.layers=this.layers,this.add(a);let l=new Ie(ps,ms,t,e);l.layers=this.layers,this.add(l);let c=new Ie(ps,ms,t,e);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let t=this.coordinateSystem,e=this.children.concat(),[i,n,r,o,a,l]=e;for(let c of e)this.remove(c);if(t===wi)i.up.set(0,1,0),i.lookAt(1,0,0),n.up.set(0,1,0),n.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(t===vs)i.up.set(0,-1,0),i.lookAt(-1,0,0),n.up.set(0,-1,0),n.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(let c of e)this.add(c),c.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();let{renderTarget:i,activeMipmapLevel:n}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());let[r,o,a,l,c,h]=this.children,f=t.getRenderTarget(),u=t.getActiveCubeFace(),d=t.getActiveMipmapLevel(),m=t.xr.enabled;t.xr.enabled=!1;let _=i.texture.generateMipmaps;i.texture.generateMipmaps=!1;let p=!1;t.isWebGLRenderer===!0?p=t.state.buffers.depth.getReversed():p=t.reversedDepthBuffer,t.setRenderTarget(i,0,n),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,r),t.setRenderTarget(i,1,n),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,o),t.setRenderTarget(i,2,n),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,a),t.setRenderTarget(i,3,n),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,l),t.setRenderTarget(i,4,n),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,c),i.texture.generateMipmaps=_,t.setRenderTarget(i,5,n),p&&t.autoClear===!1&&t.clearDepth(),t.render(e,h),t.setRenderTarget(f,u,d),t.xr.enabled=m,i.texture.needsPMREMUpdate=!0}},xa=class extends Ie{constructor(t=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=t}},Dr=class{constructor(){this._previousTime=0,this._currentTime=0,this._startTime=performance.now(),this._delta=0,this._elapsed=0,this._timescale=1,this._document=null,this._pageVisibilityHandler=null}connect(t){this._document=t,t.hidden!==void 0&&(this._pageVisibilityHandler=Ap.bind(this),t.addEventListener("visibilitychange",this._pageVisibilityHandler,!1))}disconnect(){this._pageVisibilityHandler!==null&&(this._document.removeEventListener("visibilitychange",this._pageVisibilityHandler),this._pageVisibilityHandler=null),this._document=null}getDelta(){return this._delta/1e3}getElapsed(){return this._elapsed/1e3}getTimescale(){return this._timescale}setTimescale(t){return this._timescale=t,this}reset(){return this._currentTime=performance.now()-this._startTime,this}dispose(){this.disconnect()}update(t){return this._pageVisibilityHandler!==null&&this._document.hidden===!0?this._delta=0:(this._previousTime=this._currentTime,this._currentTime=(t!==void 0?t:performance.now())-this._startTime,this._delta=(this._currentTime-this._previousTime)*this._timescale,this._elapsed+=this._delta),this}};function Ap(){this._document.hidden===!1&&this.reset()}var Xc="\\[\\]\\.:\\/",Cp=new RegExp("["+Xc+"]","g"),qc="[^"+Xc+"]",Rp="[^"+Xc.replace("\\.","")+"]",Pp=/((?:WC+[\/:])*)/.source.replace("WC",qc),Ip=/(WCOD+)?/.source.replace("WCOD",Rp),Lp=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",qc),Dp=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",qc),Np=new RegExp("^"+Pp+Ip+Lp+Dp+"$"),Up=["material","materials","bones","map"],Sc=class{constructor(t,e,i){let n=i||be.parseTrackName(e);this._targetGroup=t,this._bindings=t.subscribe_(e,n)}getValue(t,e){this.bind();let i=this._targetGroup.nCachedObjects_,n=this._bindings[i];n!==void 0&&n.getValue(t,e)}setValue(t,e){let i=this._bindings;for(let n=this._targetGroup.nCachedObjects_,r=i.length;n!==r;++n)i[n].setValue(t,e)}bind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,i=t.length;e!==i;++e)t[e].bind()}unbind(){let t=this._bindings;for(let e=this._targetGroup.nCachedObjects_,i=t.length;e!==i;++e)t[e].unbind()}},be=class s{constructor(t,e,i){this.path=e,this.parsedPath=i||s.parseTrackName(e),this.node=s.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,e,i){return t&&t.isAnimationObjectGroup?new s.Composite(t,e,i):new s(t,e,i)}static sanitizeNodeName(t){return t.replace(/\s/g,"_").replace(Cp,"")}static parseTrackName(t){let e=Np.exec(t);if(e===null)throw new Error("THREE.PropertyBinding: Cannot parse trackName: "+t);let i={nodeName:e[2],objectName:e[3],objectIndex:e[4],propertyName:e[5],propertyIndex:e[6]},n=i.nodeName&&i.nodeName.lastIndexOf(".");if(n!==void 0&&n!==-1){let r=i.nodeName.substring(n+1);Up.indexOf(r)!==-1&&(i.nodeName=i.nodeName.substring(0,n),i.objectName=r)}if(i.propertyName===null||i.propertyName.length===0)throw new Error("THREE.PropertyBinding: can not parse propertyName from trackName: "+t);return i}static findNode(t,e){if(e===void 0||e===""||e==="."||e===-1||e===t.name||e===t.uuid)return t;if(t.skeleton){let i=t.skeleton.getBoneByName(e);if(i!==void 0)return i}if(t.children){let i=function(r){for(let o=0;o<r.length;o++){let a=r[o];if(a.name===e||a.uuid===e)return a;let l=i(a.children);if(l)return l}return null},n=i(t.children);if(n)return n}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(t,e){t[e]=this.targetObject[this.propertyName]}_getValue_array(t,e){let i=this.resolvedProperty;for(let n=0,r=i.length;n!==r;++n)t[e++]=i[n]}_getValue_arrayElement(t,e){t[e]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(t,e){this.resolvedProperty.toArray(t,e)}_setValue_direct(t,e){this.targetObject[this.propertyName]=t[e]}_setValue_direct_setNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(t,e){this.targetObject[this.propertyName]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(t,e){let i=this.resolvedProperty;for(let n=0,r=i.length;n!==r;++n)i[n]=t[e++]}_setValue_array_setNeedsUpdate(t,e){let i=this.resolvedProperty;for(let n=0,r=i.length;n!==r;++n)i[n]=t[e++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(t,e){let i=this.resolvedProperty;for(let n=0,r=i.length;n!==r;++n)i[n]=t[e++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(t,e){this.resolvedProperty[this.propertyIndex]=t[e]}_setValue_arrayElement_setNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty[this.propertyIndex]=t[e],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(t,e){this.resolvedProperty.fromArray(t,e)}_setValue_fromArray_setNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(t,e){this.resolvedProperty.fromArray(t,e),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(t,e){this.bind(),this.getValue(t,e)}_setValue_unbound(t,e){this.bind(),this.setValue(t,e)}bind(){let t=this.node,e=this.parsedPath,i=e.objectName,n=e.propertyName,r=e.propertyIndex;if(t||(t=s.findNode(this.rootNode,e.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){Yt("PropertyBinding: No target node found for track: "+this.path+".");return}if(i){let c=e.objectIndex;switch(i){case"materials":if(!t.material){qt("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.materials){qt("PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}t=t.material.materials;break;case"bones":if(!t.skeleton){qt("PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}t=t.skeleton.bones;for(let h=0;h<t.length;h++)if(t[h].name===c){c=h;break}break;case"map":if("map"in t){t=t.map;break}if(!t.material){qt("PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!t.material.map){qt("PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}t=t.material.map;break;default:if(t[i]===void 0){qt("PropertyBinding: Can not bind to objectName of node undefined.",this);return}t=t[i]}if(c!==void 0){if(t[c]===void 0){qt("PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,t);return}t=t[c]}}let o=t[n];if(o===void 0){let c=e.nodeName;qt("PropertyBinding: Trying to update property for track: "+c+"."+n+" but it wasn't found.",t);return}let a=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?a=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(a=this.Versioning.MatrixWorldNeedsUpdate);let l=this.BindingType.Direct;if(r!==void 0){if(n==="morphTargetInfluences"){if(!t.geometry){qt("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!t.geometry.morphAttributes){qt("PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}t.morphTargetDictionary[r]!==void 0&&(r=t.morphTargetDictionary[r])}l=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=r}else o.fromArray!==void 0&&o.toArray!==void 0?(l=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(l=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=n;this.getValue=this.GetterByBindingType[l],this.setValue=this.SetterByBindingTypeAndVersioning[l][a]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};be.Composite=Sc;be.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};be.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};be.prototype.GetterByBindingType=[be.prototype._getValue_direct,be.prototype._getValue_array,be.prototype._getValue_arrayElement,be.prototype._getValue_toArray];be.prototype.SetterByBindingTypeAndVersioning=[[be.prototype._setValue_direct,be.prototype._setValue_direct_setNeedsUpdate,be.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[be.prototype._setValue_array,be.prototype._setValue_array_setNeedsUpdate,be.prototype._setValue_array_setMatrixWorldNeedsUpdate],[be.prototype._setValue_arrayElement,be.prototype._setValue_arrayElement_setNeedsUpdate,be.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[be.prototype._setValue_fromArray,be.prototype._setValue_fromArray_setNeedsUpdate,be.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var mx=new Float32Array(1);var mu=new oe,Nr=class{constructor(t,e,i=0,n=1/0){this.ray=new Bn(t,e),this.near=i,this.far=n,this.camera=null,this.layers=new bs,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(t,e){this.ray.set(t,e)}setFromCamera(t,e){e.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(t.x,t.y,.5).unproject(e).sub(this.ray.origin).normalize(),this.camera=e):e.isOrthographicCamera?(this.ray.origin.set(t.x,t.y,e.projectionMatrix.elements[14]).unproject(e),this.ray.direction.set(0,0,-1).transformDirection(e.matrixWorld),this.camera=e):qt("Raycaster: Unsupported camera type: "+e.type)}setFromXRController(t){return mu.identity().extractRotation(t.matrixWorld),this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(mu),this}intersectObject(t,e=!0,i=[]){return wc(t,this,i,e),i.sort(gu),i}intersectObjects(t,e=!0,i=[]){for(let n=0,r=t.length;n<r;n++)wc(t[n],this,i,e);return i.sort(gu),i}};function gu(s,t){return s.distance-t.distance}function wc(s,t,e,i){let n=!0;if(s.layers.test(t.layers)&&s.raycast(t,e)===!1&&(n=!1),n===!0&&i===!0){let r=s.children;for(let o=0,a=r.length;o<a;o++)wc(r[o],t,e,!0)}}var Ls=class{constructor(t=1,e=0,i=0){this.radius=t,this.phi=e,this.theta=i}set(t,e,i){return this.radius=t,this.phi=e,this.theta=i,this}copy(t){return this.radius=t.radius,this.phi=t.phi,this.theta=t.theta,this}makeSafe(){return this.phi=Qt(this.phi,1e-6,Math.PI-1e-6),this}setFromVector3(t){return this.setFromCartesianCoords(t.x,t.y,t.z)}setFromCartesianCoords(t,e,i){return this.radius=Math.sqrt(t*t+e*e+i*i),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(t,i),this.phi=Math.acos(Qt(e/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}};var Kc=class Kc{constructor(t,e,i,n){this.elements=[1,0,0,1],t!==void 0&&this.set(t,e,i,n)}identity(){return this.set(1,0,0,1),this}fromArray(t,e=0){for(let i=0;i<4;i++)this.elements[i]=t[i+e];return this}set(t,e,i,n){let r=this.elements;return r[0]=t,r[2]=e,r[1]=i,r[3]=n,this}};Kc.prototype.isMatrix2=!0;var Ec=Kc;var Ur=class extends Ei{constructor(t,e=null){super(),this.object=t,this.domElement=e,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(t){this.domElement!==null&&this.disconnect(),this.domElement=t}disconnect(){}dispose(){}update(){}};function Yc(s,t,e,i){let n=Fp(i);switch(e){case Fc:return s*t;case Bc:return s*t/n.components*n.byteLength;case Ra:return s*t/n.components*n.byteLength;case Rn:return s*t*2/n.components*n.byteLength;case Pa:return s*t*2/n.components*n.byteLength;case Oc:return s*t*3/n.components*n.byteLength;case ri:return s*t*4/n.components*n.byteLength;case Ia:return s*t*4/n.components*n.byteLength;case qr:case Yr:return Math.floor((s+3)/4)*Math.floor((t+3)/4)*8;case Zr:case $r:return Math.floor((s+3)/4)*Math.floor((t+3)/4)*16;case Da:case Ua:return Math.max(s,16)*Math.max(t,8)/4;case La:case Na:return Math.max(s,8)*Math.max(t,8)/2;case Fa:case Oa:case ka:case za:return Math.floor((s+3)/4)*Math.floor((t+3)/4)*8;case Ba:case Jr:case Va:return Math.floor((s+3)/4)*Math.floor((t+3)/4)*16;case Ha:return Math.floor((s+3)/4)*Math.floor((t+3)/4)*16;case Ga:return Math.floor((s+4)/5)*Math.floor((t+3)/4)*16;case Wa:return Math.floor((s+4)/5)*Math.floor((t+4)/5)*16;case Xa:return Math.floor((s+5)/6)*Math.floor((t+4)/5)*16;case qa:return Math.floor((s+5)/6)*Math.floor((t+5)/6)*16;case Ya:return Math.floor((s+7)/8)*Math.floor((t+4)/5)*16;case Za:return Math.floor((s+7)/8)*Math.floor((t+5)/6)*16;case $a:return Math.floor((s+7)/8)*Math.floor((t+7)/8)*16;case Ja:return Math.floor((s+9)/10)*Math.floor((t+4)/5)*16;case ja:return Math.floor((s+9)/10)*Math.floor((t+5)/6)*16;case Ka:return Math.floor((s+9)/10)*Math.floor((t+7)/8)*16;case Qa:return Math.floor((s+9)/10)*Math.floor((t+9)/10)*16;case tl:return Math.floor((s+11)/12)*Math.floor((t+9)/10)*16;case el:return Math.floor((s+11)/12)*Math.floor((t+11)/12)*16;case il:case nl:case sl:return Math.ceil(s/4)*Math.ceil(t/4)*16;case rl:case ol:return Math.ceil(s/4)*Math.ceil(t/4)*8;case jr:case al:return Math.ceil(s/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${e} format.`)}function Fp(s){switch(s){case $e:case Lc:return{byteLength:1,components:1};case Us:case Dc:case we:return{byteLength:2,components:1};case Aa:case Ca:return{byteLength:2,components:4};case Ci:case Ta:case Ri:return{byteLength:4,components:1};case Nc:case Uc:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${s}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"186"}}));typeof window<"u"&&(window.__THREE__?Yt("WARNING: Multiple instances of Three.js being imported."):window.__THREE__="186");function Ed(){let s=null,t=!1,e=null,i=null;function n(r,o){i=s.requestAnimationFrame(n),e(r,o)}return{start:function(){t!==!0&&e!==null&&s!==null&&(i=s.requestAnimationFrame(n),t=!0)},stop:function(){s!==null&&s.cancelAnimationFrame(i),t=!1},setAnimationLoop:function(r){e=r},setContext:function(r){s=r}}}function Hp(s){let t=new WeakMap;function e(a,l){let c=a.array,h=a.usage,f=c.byteLength,u=s.createBuffer();s.bindBuffer(l,u),s.bufferData(l,c,h),a.onUploadCallback();let d;if(c instanceof Float32Array)d=s.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)d=s.HALF_FLOAT;else if(c instanceof Uint16Array)a.isFloat16BufferAttribute?d=s.HALF_FLOAT:d=s.UNSIGNED_SHORT;else if(c instanceof Int16Array)d=s.SHORT;else if(c instanceof Uint32Array)d=s.UNSIGNED_INT;else if(c instanceof Int32Array)d=s.INT;else if(c instanceof Int8Array)d=s.BYTE;else if(c instanceof Uint8Array)d=s.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)d=s.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:u,type:d,bytesPerElement:c.BYTES_PER_ELEMENT,version:a.version,size:f}}function i(a,l,c){let h=l.array,f=l.updateRanges;if(s.bindBuffer(c,a),f.length===0)s.bufferSubData(c,0,h);else{f.sort((d,m)=>d.start-m.start);let u=0;for(let d=1;d<f.length;d++){let m=f[u],_=f[d];_.start<=m.start+m.count+1?m.count=Math.max(m.count,_.start+_.count-m.start):(++u,f[u]=_)}f.length=u+1;for(let d=0,m=f.length;d<m;d++){let _=f[d];s.bufferSubData(c,_.start*h.BYTES_PER_ELEMENT,h,_.start,_.count)}l.clearUpdateRanges()}l.onUploadCallback()}function n(a){return a.isInterleavedBufferAttribute&&(a=a.data),t.get(a)}function r(a){a.isInterleavedBufferAttribute&&(a=a.data);let l=t.get(a);l&&(s.deleteBuffer(l.buffer),t.delete(a))}function o(a,l){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){let h=t.get(a);(!h||h.version<a.version)&&t.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}let c=t.get(a);if(c===void 0)t.set(a,e(a,l));else if(c.version<a.version){if(c.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(c.buffer,a,l),c.version=a.version}}return{get:n,remove:r,update:o}}var Gp=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Wp=`#ifdef USE_ALPHAHASH
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
#endif`,Xp=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,qp=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Yp=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Zp=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,$p=`#ifdef USE_AOMAP
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
#endif`,Jp=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,jp=`#ifdef USE_BATCHING
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
#endif`,Kp=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Qp=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,tm=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,em=`float G_BlinnPhong_Implicit( ) {
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
} // validated`,im=`#ifdef USE_IRIDESCENCE
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
#endif`,nm=`#ifdef USE_BUMPMAP
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
#endif`,sm=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,rm=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,om=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,am=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,lm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,cm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,hm=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,um=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
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
#endif`,dm=`#define PI 3.141592653589793
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
} // validated`,fm=`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,pm=`vec3 transformedNormal = objectNormal;
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
#endif`,mm=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,gm=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,_m=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,vm=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,xm="gl_FragColor = linearToOutputTexel( gl_FragColor );",ym=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Mm=`#ifdef USE_ENVMAP
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
#endif`,bm=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,Sm=`#ifdef USE_ENVMAP
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
#endif`,wm=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Em=`#ifdef USE_ENVMAP
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
#endif`,Tm=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Am=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Cm=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Rm=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Pm=`#ifdef USE_GRADIENTMAP
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
}`,Im=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Lm=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Dm=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Nm=`uniform bool receiveShadow;
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
#include <lightprobes_pars_fragment>`,Um=`#ifdef USE_ENVMAP
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
#endif`,Fm=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Om=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Bm=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,km=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,zm=`PhysicalMaterial material;
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
#endif`,Vm=`uniform sampler2D dfgLUT;
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
}`,Hm=`
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
#endif`,Gm=`#if defined( RE_IndirectDiffuse )
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
#endif`,Wm=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Xm=`#ifdef USE_LIGHT_PROBES_GRID
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
#endif`,qm=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Ym=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Zm=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,$m=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Jm=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,jm=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Km=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,Qm=`#if defined( USE_POINTS_UV )
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
#endif`,t0=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,e0=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,i0=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,n0=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,s0=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,r0=`#ifdef USE_MORPHTARGETS
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
#endif`,o0=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,a0=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
vec3 nonPerturbedNormal = normal;`,l0=`#ifdef USE_NORMALMAP_OBJECTSPACE
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
#endif`,c0=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,h0=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,u0=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,d0=`#ifdef USE_NORMALMAP
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
#endif`,f0=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,p0=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,m0=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,g0=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,_0=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,v0=`vec3 packNormalToRGB( const in vec3 normal ) {
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
}`,x0=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,y0=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,M0=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,b0=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,S0=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,w0=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,E0=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,T0=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,A0=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
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
#endif`,C0=`float getShadowMask() {
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
}`,R0=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,P0=`#ifdef USE_SKINNING
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
#endif`,I0=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,L0=`#ifdef USE_SKINNING
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
#endif`,D0=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,N0=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,U0=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,F0=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,O0=`#ifdef USE_TRANSMISSION
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
#endif`,B0=`#ifdef USE_TRANSMISSION
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
#endif`,k0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,z0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,V0=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,H0=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,G0=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,W0=`uniform sampler2D t2D;
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
}`,X0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,q0=`#ifdef ENVMAP_TYPE_CUBE
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
}`,Y0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Z0=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,$0=`#include <common>
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
}`,J0=`#if DEPTH_PACKING == 3200
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
}`,j0=`#define DISTANCE
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
}`,K0=`#define DISTANCE
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
}`,Q0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,tg=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,eg=`uniform float scale;
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
}`,ig=`uniform vec3 diffuse;
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
}`,ng=`#include <common>
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
}`,sg=`uniform vec3 diffuse;
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
}`,rg=`#define LAMBERT
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
}`,og=`#define LAMBERT
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
}`,ag=`#define MATCAP
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
}`,lg=`#define MATCAP
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
}`,cg=`#define NORMAL
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
}`,hg=`#define NORMAL
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
}`,ug=`#define PHONG
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
}`,dg=`#define PHONG
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
}`,fg=`#define STANDARD
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
}`,pg=`#define STANDARD
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
}`,mg=`#define TOON
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
}`,gg=`#define TOON
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
}`,_g=`uniform float size;
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
}`,vg=`uniform vec3 diffuse;
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
}`,xg=`#include <common>
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
}`,yg=`uniform vec3 color;
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
}`,Mg=`uniform float rotation;
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
}`,bg=`uniform vec3 diffuse;
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
}`,ee={alphahash_fragment:Gp,alphahash_pars_fragment:Wp,alphamap_fragment:Xp,alphamap_pars_fragment:qp,alphatest_fragment:Yp,alphatest_pars_fragment:Zp,aomap_fragment:$p,aomap_pars_fragment:Jp,batching_pars_vertex:jp,batching_vertex:Kp,begin_vertex:Qp,beginnormal_vertex:tm,bsdfs:em,iridescence_fragment:im,bumpmap_pars_fragment:nm,clipping_planes_fragment:sm,clipping_planes_pars_fragment:rm,clipping_planes_pars_vertex:om,clipping_planes_vertex:am,color_fragment:lm,color_pars_fragment:cm,color_pars_vertex:hm,color_vertex:um,common:dm,cube_uv_reflection_fragment:fm,defaultnormal_vertex:pm,displacementmap_pars_vertex:mm,displacementmap_vertex:gm,emissivemap_fragment:_m,emissivemap_pars_fragment:vm,colorspace_fragment:xm,colorspace_pars_fragment:ym,envmap_fragment:Mm,envmap_common_pars_fragment:bm,envmap_pars_fragment:Sm,envmap_pars_vertex:wm,envmap_physical_pars_fragment:Um,envmap_vertex:Em,fog_vertex:Tm,fog_pars_vertex:Am,fog_fragment:Cm,fog_pars_fragment:Rm,gradientmap_pars_fragment:Pm,lightmap_pars_fragment:Im,lights_lambert_fragment:Lm,lights_lambert_pars_fragment:Dm,lights_pars_begin:Nm,lights_toon_fragment:Fm,lights_toon_pars_fragment:Om,lights_phong_fragment:Bm,lights_phong_pars_fragment:km,lights_physical_fragment:zm,lights_physical_pars_fragment:Vm,lights_fragment_begin:Hm,lights_fragment_maps:Gm,lights_fragment_end:Wm,lightprobes_pars_fragment:Xm,logdepthbuf_fragment:qm,logdepthbuf_pars_fragment:Ym,logdepthbuf_pars_vertex:Zm,logdepthbuf_vertex:$m,map_fragment:Jm,map_pars_fragment:jm,map_particle_fragment:Km,map_particle_pars_fragment:Qm,metalnessmap_fragment:t0,metalnessmap_pars_fragment:e0,morphinstance_vertex:i0,morphcolor_vertex:n0,morphnormal_vertex:s0,morphtarget_pars_vertex:r0,morphtarget_vertex:o0,normal_fragment_begin:a0,normal_fragment_maps:l0,normal_pars_fragment:c0,normal_pars_vertex:h0,normal_vertex:u0,normalmap_pars_fragment:d0,clearcoat_normal_fragment_begin:f0,clearcoat_normal_fragment_maps:p0,clearcoat_pars_fragment:m0,iridescence_pars_fragment:g0,opaque_fragment:_0,packing:v0,premultiplied_alpha_fragment:x0,project_vertex:y0,dithering_fragment:M0,dithering_pars_fragment:b0,roughnessmap_fragment:S0,roughnessmap_pars_fragment:w0,shadowmap_pars_fragment:E0,shadowmap_pars_vertex:T0,shadowmap_vertex:A0,shadowmask_pars_fragment:C0,skinbase_vertex:R0,skinning_pars_vertex:P0,skinning_vertex:I0,skinnormal_vertex:L0,specularmap_fragment:D0,specularmap_pars_fragment:N0,tonemapping_fragment:U0,tonemapping_pars_fragment:F0,transmission_fragment:O0,transmission_pars_fragment:B0,uv_pars_fragment:k0,uv_pars_vertex:z0,uv_vertex:V0,worldpos_vertex:H0,background_vert:G0,background_frag:W0,backgroundCube_vert:X0,backgroundCube_frag:q0,cube_vert:Y0,cube_frag:Z0,depth_vert:$0,depth_frag:J0,distance_vert:j0,distance_frag:K0,equirect_vert:Q0,equirect_frag:tg,linedashed_vert:eg,linedashed_frag:ig,meshbasic_vert:ng,meshbasic_frag:sg,meshlambert_vert:rg,meshlambert_frag:og,meshmatcap_vert:ag,meshmatcap_frag:lg,meshnormal_vert:cg,meshnormal_frag:hg,meshphong_vert:ug,meshphong_frag:dg,meshphysical_vert:fg,meshphysical_frag:pg,meshtoon_vert:mg,meshtoon_frag:gg,points_vert:_g,points_frag:vg,shadow_vert:xg,shadow_frag:yg,sprite_vert:Mg,sprite_frag:bg},Mt={common:{diffuse:{value:new Vt(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new jt},alphaMap:{value:null},alphaMapTransform:{value:new jt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new jt}},envmap:{envMap:{value:null},envMapRotation:{value:new jt},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new jt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new jt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new jt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new jt},normalScale:{value:new tt(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new jt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new jt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new jt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new jt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Vt(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new D},probesMax:{value:new D},probesResolution:{value:new D}},points:{diffuse:{value:new Vt(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new jt},alphaTest:{value:0},uvTransform:{value:new jt}},sprite:{diffuse:{value:new Vt(16777215)},opacity:{value:1},center:{value:new tt(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new jt},alphaMap:{value:null},alphaMapTransform:{value:new jt},alphaTest:{value:0}}},Wi={basic:{uniforms:Je([Mt.common,Mt.specularmap,Mt.envmap,Mt.aomap,Mt.lightmap,Mt.fog]),vertexShader:ee.meshbasic_vert,fragmentShader:ee.meshbasic_frag},lambert:{uniforms:Je([Mt.common,Mt.specularmap,Mt.envmap,Mt.aomap,Mt.lightmap,Mt.emissivemap,Mt.bumpmap,Mt.normalmap,Mt.displacementmap,Mt.fog,Mt.lights,{emissive:{value:new Vt(0)},envMapIntensity:{value:1}}]),vertexShader:ee.meshlambert_vert,fragmentShader:ee.meshlambert_frag},phong:{uniforms:Je([Mt.common,Mt.specularmap,Mt.envmap,Mt.aomap,Mt.lightmap,Mt.emissivemap,Mt.bumpmap,Mt.normalmap,Mt.displacementmap,Mt.fog,Mt.lights,{emissive:{value:new Vt(0)},specular:{value:new Vt(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:ee.meshphong_vert,fragmentShader:ee.meshphong_frag},standard:{uniforms:Je([Mt.common,Mt.envmap,Mt.aomap,Mt.lightmap,Mt.emissivemap,Mt.bumpmap,Mt.normalmap,Mt.displacementmap,Mt.roughnessmap,Mt.metalnessmap,Mt.fog,Mt.lights,{emissive:{value:new Vt(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:ee.meshphysical_vert,fragmentShader:ee.meshphysical_frag},toon:{uniforms:Je([Mt.common,Mt.aomap,Mt.lightmap,Mt.emissivemap,Mt.bumpmap,Mt.normalmap,Mt.displacementmap,Mt.gradientmap,Mt.fog,Mt.lights,{emissive:{value:new Vt(0)}}]),vertexShader:ee.meshtoon_vert,fragmentShader:ee.meshtoon_frag},matcap:{uniforms:Je([Mt.common,Mt.bumpmap,Mt.normalmap,Mt.displacementmap,Mt.fog,{matcap:{value:null}}]),vertexShader:ee.meshmatcap_vert,fragmentShader:ee.meshmatcap_frag},points:{uniforms:Je([Mt.points,Mt.fog]),vertexShader:ee.points_vert,fragmentShader:ee.points_frag},dashed:{uniforms:Je([Mt.common,Mt.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:ee.linedashed_vert,fragmentShader:ee.linedashed_frag},depth:{uniforms:Je([Mt.common,Mt.displacementmap]),vertexShader:ee.depth_vert,fragmentShader:ee.depth_frag},normal:{uniforms:Je([Mt.common,Mt.bumpmap,Mt.normalmap,Mt.displacementmap,{opacity:{value:1}}]),vertexShader:ee.meshnormal_vert,fragmentShader:ee.meshnormal_frag},sprite:{uniforms:Je([Mt.sprite,Mt.fog]),vertexShader:ee.sprite_vert,fragmentShader:ee.sprite_frag},background:{uniforms:{uvTransform:{value:new jt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:ee.background_vert,fragmentShader:ee.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new jt}},vertexShader:ee.backgroundCube_vert,fragmentShader:ee.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:ee.cube_vert,fragmentShader:ee.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:ee.equirect_vert,fragmentShader:ee.equirect_frag},distance:{uniforms:Je([Mt.common,Mt.displacementmap,{referencePosition:{value:new D},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:ee.distance_vert,fragmentShader:ee.distance_frag},shadow:{uniforms:Je([Mt.lights,Mt.fog,{color:{value:new Vt(0)},opacity:{value:1}}]),vertexShader:ee.shadow_vert,fragmentShader:ee.shadow_frag}};Wi.physical={uniforms:Je([Wi.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new jt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new jt},clearcoatNormalScale:{value:new tt(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new jt},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new jt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new jt},sheen:{value:0},sheenColor:{value:new Vt(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new jt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new jt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new jt},transmissionSamplerSize:{value:new tt},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new jt},attenuationDistance:{value:0},attenuationColor:{value:new Vt(0)},specularColor:{value:new Vt(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new jt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new jt},anisotropyVector:{value:new tt},anisotropyMap:{value:null},anisotropyMapTransform:{value:new jt}}]),vertexShader:ee.meshphysical_vert,fragmentShader:ee.meshphysical_frag};var hl={r:0,b:0,g:0},Sg=new oe,Td=new jt;Td.set(-1,0,0,0,1,0,0,0,1);function wg(s,t,e,i,n,r){let o=new Vt(0),a=n===!0?0:1,l,c,h=null,f=0,u=null;function d(M){let T=M.isScene===!0?M.background:null;if(T&&T.isTexture){let y=M.backgroundBlurriness>0;T=t.get(T,y)}return T}function m(M){let T=!1,y=d(M);y===null?p(o,a):y&&y.isColor&&(p(y,1),T=!0);let b=s.xr.getEnvironmentBlendMode();b==="additive"?e.buffers.color.setClear(0,0,0,1,r):b==="alpha-blend"&&e.buffers.color.setClear(0,0,0,0,r),(s.autoClear||T)&&(e.buffers.depth.setTest(!0),e.buffers.depth.setMask(!0),e.buffers.color.setMask(!0),s.clear(s.autoClearColor,s.autoClearDepth,s.autoClearStencil))}function _(M,T){let y=d(T);y&&(y.isCubeTexture||y.mapping===Wr)?(c===void 0&&(c=new Zt(new ze(1,1,1),new ce({name:"BackgroundCubeMaterial",uniforms:Zn(Wi.backgroundCube.uniforms),vertexShader:Wi.backgroundCube.vertexShader,fragmentShader:Wi.backgroundCube.fragmentShader,side:Ne,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(b,E,C){this.matrixWorld.copyPosition(C.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(c)),c.material.uniforms.envMap.value=y,c.material.uniforms.backgroundBlurriness.value=T.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=T.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(Sg.makeRotationFromEuler(T.backgroundRotation)).transpose(),y.isCubeTexture&&y.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(Td),c.material.toneMapped=ne.getTransfer(y.colorSpace)!==le,(h!==y||f!==y.version||u!==s.toneMapping)&&(c.material.needsUpdate=!0,h=y,f=y.version,u=s.toneMapping),c.layers.enableAll(),M.unshift(c,c.geometry,c.material,0,0,null)):y&&y.isTexture&&(l===void 0&&(l=new Zt(new Gn(2,2),new ce({name:"BackgroundMaterial",uniforms:Zn(Wi.background.uniforms),vertexShader:Wi.background.vertexShader,fragmentShader:Wi.background.fragmentShader,side:wn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(l)),l.material.uniforms.t2D.value=y,l.material.uniforms.backgroundIntensity.value=T.backgroundIntensity,l.material.toneMapped=ne.getTransfer(y.colorSpace)!==le,y.matrixAutoUpdate===!0&&y.updateMatrix(),l.material.uniforms.uvTransform.value.copy(y.matrix),(h!==y||f!==y.version||u!==s.toneMapping)&&(l.material.needsUpdate=!0,h=y,f=y.version,u=s.toneMapping),l.layers.enableAll(),M.unshift(l,l.geometry,l.material,0,0,null))}function p(M,T){M.getRGB(hl,Wc(s)),e.buffers.color.setClear(hl.r,hl.g,hl.b,T,r)}function g(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return o},setClearColor:function(M,T=1){o.set(M),a=T,p(o,a)},getClearAlpha:function(){return a},setClearAlpha:function(M){a=M,p(o,a)},render:m,addToRenderList:_,dispose:g}}function Eg(s,t){let e=s.getParameter(s.MAX_VERTEX_ATTRIBS),i={},n=u(null),r=n,o=!1;function a(U,w,P,I,N){let B=!1,O=f(U,I,P,w);r!==O&&(r=O,c(r.object)),B=d(U,I,P,N),B&&m(U,I,P,N),N!==null&&t.update(N,s.ELEMENT_ARRAY_BUFFER),(B||o)&&(o=!1,y(U,w,P,I),N!==null&&s.bindBuffer(s.ELEMENT_ARRAY_BUFFER,t.get(N).buffer))}function l(){return s.createVertexArray()}function c(U){return s.bindVertexArray(U)}function h(U){return s.deleteVertexArray(U)}function f(U,w,P,I){let N=I.wireframe===!0,B=i[w.id];B===void 0&&(B={},i[w.id]=B);let O=U.isInstancedMesh===!0?U.id:0,G=B[O];G===void 0&&(G={},B[O]=G);let V=G[P.id];V===void 0&&(V={},G[P.id]=V);let W=V[N];return W===void 0&&(W=u(l()),V[N]=W),W}function u(U){let w=[],P=[],I=[];for(let N=0;N<e;N++)w[N]=0,P[N]=0,I[N]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:w,enabledAttributes:P,attributeDivisors:I,object:U,attributes:{},index:null}}function d(U,w,P,I){let N=r.attributes,B=w.attributes,O=0,G=P.getAttributes();for(let V in G)if(G[V].location>=0){let $=N[V],dt=B[V];if(dt===void 0&&(V==="instanceMatrix"&&U.instanceMatrix&&(dt=U.instanceMatrix),V==="instanceColor"&&U.instanceColor&&(dt=U.instanceColor)),$===void 0||$.attribute!==dt||dt&&$.data!==dt.data)return!0;O++}return r.attributesNum!==O||r.index!==I}function m(U,w,P,I){let N={},B=w.attributes,O=0,G=P.getAttributes();for(let V in G)if(G[V].location>=0){let $=B[V];$===void 0&&(V==="instanceMatrix"&&U.instanceMatrix&&($=U.instanceMatrix),V==="instanceColor"&&U.instanceColor&&($=U.instanceColor));let dt={};dt.attribute=$,$&&$.data&&(dt.data=$.data),N[V]=dt,O++}r.attributes=N,r.attributesNum=O,r.index=I}function _(){let U=r.newAttributes;for(let w=0,P=U.length;w<P;w++)U[w]=0}function p(U){g(U,0)}function g(U,w){let P=r.newAttributes,I=r.enabledAttributes,N=r.attributeDivisors;P[U]=1,I[U]===0&&(s.enableVertexAttribArray(U),I[U]=1),N[U]!==w&&(s.vertexAttribDivisor(U,w),N[U]=w)}function M(){let U=r.newAttributes,w=r.enabledAttributes;for(let P=0,I=w.length;P<I;P++)w[P]!==U[P]&&(s.disableVertexAttribArray(P),w[P]=0)}function T(U,w,P,I,N,B,O){O===!0?s.vertexAttribIPointer(U,w,P,N,B):s.vertexAttribPointer(U,w,P,I,N,B)}function y(U,w,P,I){_();let N=I.attributes,B=P.getAttributes(),O=w.defaultAttributeValues;for(let G in B){let V=B[G];if(V.location>=0){let W=N[G];if(W===void 0&&(G==="instanceMatrix"&&U.instanceMatrix&&(W=U.instanceMatrix),G==="instanceColor"&&U.instanceColor&&(W=U.instanceColor)),W!==void 0){let $=W.normalized,dt=W.itemSize,mt=t.get(W);if(mt===void 0)continue;let Ct=mt.buffer,wt=mt.type,Ht=mt.bytesPerElement,Z=wt===s.INT||wt===s.UNSIGNED_INT||W.gpuType===Ta;if(W.isInterleavedBufferAttribute){let j=W.data,ut=j.stride,It=W.offset;if(j.isInstancedInterleavedBuffer){for(let vt=0;vt<V.locationSize;vt++)g(V.location+vt,j.meshPerAttribute);U.isInstancedMesh!==!0&&I._maxInstanceCount===void 0&&(I._maxInstanceCount=j.meshPerAttribute*j.count)}else for(let vt=0;vt<V.locationSize;vt++)p(V.location+vt);s.bindBuffer(s.ARRAY_BUFFER,Ct);for(let vt=0;vt<V.locationSize;vt++)T(V.location+vt,dt/V.locationSize,wt,$,ut*Ht,(It+dt/V.locationSize*vt)*Ht,Z)}else{if(W.isInstancedBufferAttribute){for(let j=0;j<V.locationSize;j++)g(V.location+j,W.meshPerAttribute);U.isInstancedMesh!==!0&&I._maxInstanceCount===void 0&&(I._maxInstanceCount=W.meshPerAttribute*W.count)}else for(let j=0;j<V.locationSize;j++)p(V.location+j);s.bindBuffer(s.ARRAY_BUFFER,Ct);for(let j=0;j<V.locationSize;j++)T(V.location+j,dt/V.locationSize,wt,$,dt*Ht,dt/V.locationSize*j*Ht,Z)}}else if(O!==void 0){let $=O[G];if($!==void 0)switch($.length){case 2:s.vertexAttrib2fv(V.location,$);break;case 3:s.vertexAttrib3fv(V.location,$);break;case 4:s.vertexAttrib4fv(V.location,$);break;default:s.vertexAttrib1fv(V.location,$)}}}}M()}function b(){A();for(let U in i){let w=i[U];for(let P in w){let I=w[P];for(let N in I){let B=I[N];for(let O in B)h(B[O].object),delete B[O];delete I[N]}}delete i[U]}}function E(U){if(i[U.id]===void 0)return;let w=i[U.id];for(let P in w){let I=w[P];for(let N in I){let B=I[N];for(let O in B)h(B[O].object),delete B[O];delete I[N]}}delete i[U.id]}function C(U){for(let w in i){let P=i[w];for(let I in P){let N=P[I];if(N[U.id]===void 0)continue;let B=N[U.id];for(let O in B)h(B[O].object),delete B[O];delete N[U.id]}}}function x(U){for(let w in i){let P=i[w],I=U.isInstancedMesh===!0?U.id:0,N=P[I];if(N!==void 0){for(let B in N){let O=N[B];for(let G in O)h(O[G].object),delete O[G];delete N[B]}delete P[I],Object.keys(P).length===0&&delete i[w]}}}function A(){L(),o=!0,r!==n&&(r=n,c(r.object))}function L(){n.geometry=null,n.program=null,n.wireframe=!1}return{setup:a,reset:A,resetDefaultState:L,dispose:b,releaseStatesOfGeometry:E,releaseStatesOfObject:x,releaseStatesOfProgram:C,initAttributes:_,enableAttribute:p,disableUnusedAttributes:M}}function Tg(s,t,e){let i;function n(l){i=l}function r(l,c){s.drawArrays(i,l,c),e.update(c,i,1)}function o(l,c,h){h!==0&&(s.drawArraysInstanced(i,l,c,h),e.update(c,i,h))}function a(l,c,h){if(h===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,l,0,c,0,h);let u=0;for(let d=0;d<h;d++)u+=c[d];e.update(u,i,1)}this.setMode=n,this.render=r,this.renderInstances=o,this.renderMultiDraw=a}function Ag(s,t,e,i){let n;function r(){if(n!==void 0)return n;if(t.has("EXT_texture_filter_anisotropic")===!0){let C=t.get("EXT_texture_filter_anisotropic");n=s.getParameter(C.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else n=0;return n}function o(C){return!(C!==ri&&i.convert(C)!==s.getParameter(s.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(C){let x=C===we&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(C!==$e&&C!==Ri&&!x&&i.convert(C)!==s.getParameter(s.IMPLEMENTATION_COLOR_READ_TYPE))}function l(C){if(C==="highp"){if(s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.HIGH_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.HIGH_FLOAT).precision>0)return"highp";C="mediump"}return C==="mediump"&&s.getShaderPrecisionFormat(s.VERTEX_SHADER,s.MEDIUM_FLOAT).precision>0&&s.getShaderPrecisionFormat(s.FRAGMENT_SHADER,s.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=e.precision!==void 0?e.precision:"highp",h=l(c);h!==c&&(Yt("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);let f=e.logarithmicDepthBuffer===!0,u=e.reversedDepthBuffer===!0&&t.has("EXT_clip_control");e.reversedDepthBuffer===!0&&u===!1&&Yt("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");let d=s.getParameter(s.MAX_TEXTURE_IMAGE_UNITS),m=s.getParameter(s.MAX_VERTEX_TEXTURE_IMAGE_UNITS),_=s.getParameter(s.MAX_TEXTURE_SIZE),p=s.getParameter(s.MAX_CUBE_MAP_TEXTURE_SIZE),g=s.getParameter(s.MAX_VERTEX_ATTRIBS),M=s.getParameter(s.MAX_VERTEX_UNIFORM_VECTORS),T=s.getParameter(s.MAX_VARYING_VECTORS),y=s.getParameter(s.MAX_FRAGMENT_UNIFORM_VECTORS),b=s.getParameter(s.MAX_SAMPLES),E=s.getParameter(s.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:c,logarithmicDepthBuffer:f,reversedDepthBuffer:u,maxTextures:d,maxVertexTextures:m,maxTextureSize:_,maxCubemapSize:p,maxAttributes:g,maxVertexUniforms:M,maxVaryings:T,maxFragmentUniforms:y,maxSamples:b,samples:E}}function Cg(s){let t=this,e=null,i=0,n=!1,r=!1,o=new ti,a=new jt,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(f,u){let d=f.length!==0||u||i!==0||n;return n=u,i=f.length,d},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(f,u){e=h(f,u,0)},this.setState=function(f,u,d){let m=f.clippingPlanes,_=f.clipIntersection,p=f.clipShadows,g=s.get(f);if(!n||m===null||m.length===0||r&&!p)r?h(null):c();else{let M=r?0:i,T=M*4,y=g.clippingState||null;l.value=y,y=h(m,u,T,d);for(let b=0;b!==T;++b)y[b]=e[b];g.clippingState=y,this.numIntersection=_?this.numPlanes:0,this.numPlanes+=M}};function c(){l.value!==e&&(l.value=e,l.needsUpdate=i>0),t.numPlanes=i,t.numIntersection=0}function h(f,u,d,m){let _=f!==null?f.length:0,p=null;if(_!==0){if(p=l.value,m!==!0||p===null){let g=d+_*4,M=u.matrixWorldInverse;a.getNormalMatrix(M),(p===null||p.length<g)&&(p=new Float32Array(g));for(let T=0,y=d;T!==_;++T,y+=4)o.copy(f[T]).applyMatrix4(M,a),o.normal.toArray(p,y),p[y+3]=o.constant}l.value=p,l.needsUpdate=!0}return t.numPlanes=_,t.numIntersection=0,p}}var Bs=4,Rg=6,Pg=20,Ig=256,Kr=new Ai,sd=new Vt,Qc=null,th=0,eh=0,ih=!1,Lg=new D,$n=new D,zs=class{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(t,e=0,i=.1,n=100,r={}){let{size:o=256,position:a=Lg}=r;Qc=this._renderer.getRenderTarget(),th=this._renderer.getActiveCubeFace(),eh=this._renderer.getActiveMipmapLevel(),ih=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(o);let l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(t,i,n,l,a),e>0&&this._blur(l,0,0,e),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=ad(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=od(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodMeshes.length;t++)this._lodMeshes[t].geometry.dispose()}_cleanup(t){this._renderer.setRenderTarget(Qc,th,eh),this._renderer.xr.enabled=ih,t.scissorTest=!1,Os(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===Tn||t.mapping===Yn?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),Qc=this._renderer.getRenderTarget(),th=this._renderer.getActiveCubeFace(),eh=this._renderer.getActiveMipmapLevel(),ih=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let i=e||this._allocateTargets();return this._textureToCubeUV(t,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){let t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,i={magFilter:He,minFilter:He,generateMipmaps:!1,type:we,format:ri,colorSpace:rr,depthBuffer:!1},n=rd(t,e,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=rd(t,e,i);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods}=Dg(r)),this._blurMaterial=Ug(r,t,e),this._ggxMaterial=Ng(r,t,e)}return n}_compileMaterial(t){let e=new Zt(new De,t);this._renderer.compile(e,Kr)}_sceneToCubeUV(t,e,i,n,r){let l=new Ie(90,1,e,i),c=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],f=this._renderer,u=f.autoClear,d=f.toneMapping;f.getClearColor(sd),f.toneMapping=fi,f.autoClear=!1,f.state.buffers.depth.getReversed()&&(f.setRenderTarget(n),f.clearDepth(),f.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new Zt(new ze,new ni({name:"PMREM.Background",side:Ne,depthWrite:!1,depthTest:!1})));let _=this._backgroundBox,p=_.material,g=!1,M=t.background;M?M.isColor&&(p.color.copy(M),t.background=null,g=!0):(p.color.copy(sd),g=!0);for(let T=0;T<6;T++){let y=T%3;y===0?(l.up.set(0,c[T],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x+h[T],r.y,r.z)):y===1?(l.up.set(0,0,c[T]),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y+h[T],r.z)):(l.up.set(0,c[T],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y,r.z+h[T]));let b=this._cubeSize;Os(n,y*b,T>2?b:0,b,b),f.setRenderTarget(n),g&&f.render(_,l),f.render(t,l)}f.toneMapping=d,f.autoClear=u,t.background=M}_textureToCubeUV(t,e){let i=this._renderer,n=t.mapping===Tn||t.mapping===Yn;n?(this._cubemapMaterial===null&&(this._cubemapMaterial=ad()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=od());let r=n?this._cubemapMaterial:this._equirectMaterial,o=this._lodMeshes[0];o.material=r;let a=r.uniforms;a.envMap.value=t;let l=this._cubeSize;Os(e,0,0,3*l,2*l),i.setRenderTarget(e),i.render(o,Kr)}_applyPMREM(t){let e=this._renderer,i=e.autoClear;e.autoClear=!1;let n=this._lodMeshes.length;for(let r=1;r<n;r++)this._applyGGXFilter(t,r-1,r);e.autoClear=i}_applyGGXFilter(t,e,i){let n=this._renderer,r=this._pingPongRenderTarget,o=this._ggxMaterial,a=this._lodMeshes[i];a.material=o;let l=o.uniforms,c=i/(this._lodMeshes.length-1),h=e/(this._lodMeshes.length-1),f=Math.sqrt(c*c-h*h),u=c*1.25,d=f*u,{_lodMax:m}=this,_=this._sizeLods[i],p=3*_*(i>m-Bs?i-m+Bs:0),g=4*(this._cubeSize-_);l.envMap.value=t.texture,l.roughness.value=d,l.mipInt.value=m-e,Os(r,p,g,3*_,2*_),n.setRenderTarget(r),n.render(a,Kr),l.envMap.value=r.texture,l.roughness.value=0,l.mipInt.value=m-i,Os(t,p,g,3*_,2*_),n.setRenderTarget(t),n.render(a,Kr)}_blur(t,e,i,n){let r=this._pingPongRenderTarget,o=Math.min(n,Math.PI)/Math.SQRT2;this._blurPass(t,r,e,i,o),this._blurPass(r,t,i,i,o)}_blurPass(t,e,i,n,r){let o=this._renderer,a=this._blurMaterial,l=this._lodMeshes[n];l.material=a;let c=a.uniforms;c.envMap.value=t.texture,c.sigma.value=r,c.mipInt.value=this._lodMax-i;let h=this._sizeLods[n],f=3*h*(n>this._lodMax-Bs?n-this._lodMax+Bs:0),u=4*(this._cubeSize-h);Os(e,f,u,3*h,2*h),o.setRenderTarget(e),o.render(l,Kr)}};function Dg(s){let t=[],e=[],i=s,n=s-Bs+1+Rg;for(let r=0;r<n;r++){let o=Math.pow(2,i);t.push(o);let a=1/(o-2),l=-a,c=1+a,h=[l,l,c,l,c,c,l,l,c,c,l,c],f=6,u=6,d=3,m=new Float32Array(d*u*f),_=new Float32Array(d*u*f);for(let g=0;g<f;g++){let M=g%3*2/3-1,T=g>2?0:-1,y=[M,T,0,M+2/3,T,0,M+2/3,T+1,0,M,T,0,M+2/3,T+1,0,M,T+1,0];m.set(y,d*u*g);for(let b=0;b<u;b++){let E=h[b*2]*2-1,C=h[b*2+1]*2-1;g===0?$n.set(1,C,E):g===1?$n.set(-E,1,-C):g===2?$n.set(-E,C,1):g===3?$n.set(-1,C,-E):g===4?$n.set(-E,-1,C):$n.set(E,C,-1),$n.toArray(_,(g*u+b)*d)}}let p=new De;p.setAttribute("position",new Le(m,d)),p.setAttribute("outputDirection",new Le(_,d)),e.push(new Zt(p,null)),i>Bs&&i--}return{lodMeshes:e,sizeLods:t}}function rd(s,t,e){let i=new ve(s,t,e);return i.texture.mapping=Wr,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function Os(s,t,e,i,n){s.viewport.set(t,e,i,n),s.scissor.set(t,e,i,n)}function Ng(s,t,e){return new ce({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:Ig,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${s}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:pl(),fragmentShader:`

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
		`,blending:Ae,depthTest:!1,depthWrite:!1})}function Ug(s,t,e){return new ce({name:"SphericalGaussianBlur",defines:{SAMPLES:Pg,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${s}.0`},uniforms:{envMap:{value:null},sigma:{value:0},mipInt:{value:0}},vertexShader:pl(),fragmentShader:`

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
		`,blending:Ae,depthTest:!1,depthWrite:!1})}function od(){return new ce({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:pl(),fragmentShader:`

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
		`,blending:Ae,depthTest:!1,depthWrite:!1})}function ad(){return new ce({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:pl(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Ae,depthTest:!1,depthWrite:!1})}function pl(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 outputDirection;

		varying vec3 vOutputDirection;

		void main() {

			vOutputDirection = outputDirection;
			gl_Position = vec4( position, 1.0 );

		}
	`}var dl=class extends ve{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;let i={width:t,height:t,depth:1},n=[i,i,i,i,i,i];this.texture=new pr(n),this._setTextureOptions(e),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;let i={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},n=new ze(5,5,5),r=new ce({name:"CubemapFromEquirect",uniforms:Zn(i.uniforms),vertexShader:i.vertexShader,fragmentShader:i.fragmentShader,side:Ne,blending:Ae});r.uniforms.tEquirect.value=e;let o=new Zt(n,r),a=e.minFilter;return e.minFilter===An&&(e.minFilter=He),new va(1,10,this).update(t,o),e.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(t,e=!0,i=!0,n=!0){let r=t.getRenderTarget();for(let o=0;o<6;o++)t.setRenderTarget(this,o),t.clear(e,i,n);t.setRenderTarget(r)}};function Fg(s){let t=new WeakMap,e=new WeakMap,i=null;function n(u,d=!1){return u==null?null:d?o(u):r(u)}function r(u){if(u&&u.isTexture){let d=u.mapping;if(d===Sa||d===wa)if(t.has(u)){let m=t.get(u).texture;return a(m,u.mapping)}else{let m=u.image;if(m&&m.height>0){let _=new dl(m.height);return _.fromEquirectangularTexture(s,u),t.set(u,_),u.addEventListener("dispose",c),a(_.texture,u.mapping)}else return null}}return u}function o(u){if(u&&u.isTexture){let d=u.mapping,m=d===Sa||d===wa,_=d===Tn||d===Yn;if(m||_){let p=e.get(u),g=p!==void 0?p.texture.pmremVersion:0;if(u.isRenderTargetTexture&&u.pmremVersion!==g)return i===null&&(i=new zs(s)),p=m?i.fromEquirectangular(u,p):i.fromCubemap(u,p),p.texture.pmremVersion=u.pmremVersion,e.set(u,p),p.texture;if(p!==void 0)return p.texture;{let M=u.image;return m&&M&&M.height>0||_&&M&&l(M)?(i===null&&(i=new zs(s)),p=m?i.fromEquirectangular(u):i.fromCubemap(u),p.texture.pmremVersion=u.pmremVersion,e.set(u,p),u.addEventListener("dispose",h),p.texture):null}}}return u}function a(u,d){return d===Sa?u.mapping=Tn:d===wa&&(u.mapping=Yn),u}function l(u){let d=0,m=6;for(let _=0;_<m;_++)u[_]!==void 0&&d++;return d===m}function c(u){let d=u.target;d.removeEventListener("dispose",c);let m=t.get(d);m!==void 0&&(t.delete(d),m.dispose())}function h(u){let d=u.target;d.removeEventListener("dispose",h);let m=e.get(d);m!==void 0&&(e.delete(d),m.dispose())}function f(){t=new WeakMap,e=new WeakMap,i!==null&&(i.dispose(),i=null)}return{get:n,dispose:f}}function Og(s){let t={};function e(i){if(t[i]!==void 0)return t[i];let n=s.getExtension(i);return t[i]=n,n}return{has:function(i){return e(i)!==null},init:function(){e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance"),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture"),e("WEBGL_render_shared_exponent")},get:function(i){let n=e(i);return n===null&&Fn("WebGLRenderer: "+i+" extension not supported."),n}}}function Bg(s,t,e,i){let n={},r=new WeakMap;function o(f){let u=f.target;u.index!==null&&t.remove(u.index);for(let m in u.attributes)t.remove(u.attributes[m]);u.removeEventListener("dispose",o),delete n[u.id];let d=r.get(u);d&&(t.remove(d),r.delete(u)),i.releaseStatesOfGeometry(u),u.isInstancedBufferGeometry===!0&&delete u._maxInstanceCount,e.memory.geometries--}function a(f,u){return n[u.id]===!0||(u.addEventListener("dispose",o),n[u.id]=!0,e.memory.geometries++),u}function l(f){let u=f.attributes;for(let d in u)t.update(u[d],s.ARRAY_BUFFER)}function c(f){let u=[],d=f.index,m=f.attributes.position,_=0;if(m===void 0)return;if(d!==null){let M=d.array;_=d.version;for(let T=0,y=M.length;T<y;T+=3){let b=M[T+0],E=M[T+1],C=M[T+2];u.push(b,E,E,C,C,b)}}else{let M=m.array;_=m.version;for(let T=0,y=M.length/3-1;T<y;T+=3){let b=T+0,E=T+1,C=T+2;u.push(b,E,E,C,C,b)}}let p=new(m.count>=65535?ur:hr)(u,1);p.version=_;let g=r.get(f);g&&t.remove(g),r.set(f,p)}function h(f){let u=r.get(f);if(u){let d=f.index;d!==null&&u.version<d.version&&c(f)}else c(f);return r.get(f)}return{get:a,update:l,getWireframeAttribute:h}}function kg(s,t,e){let i;function n(f){i=f}let r,o;function a(f){r=f.type,o=f.bytesPerElement}function l(f,u){s.drawElements(i,u,r,f*o),e.update(u,i,1)}function c(f,u,d){d!==0&&(s.drawElementsInstanced(i,u,r,f*o,d),e.update(u,i,d))}function h(f,u,d){if(d===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,u,0,r,f,0,d);let _=0;for(let p=0;p<d;p++)_+=u[p];e.update(_,i,1)}this.setMode=n,this.setIndex=a,this.render=l,this.renderInstances=c,this.renderMultiDraw=h}function zg(s){let t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function i(r,o,a){switch(e.calls++,o){case s.TRIANGLES:e.triangles+=a*(r/3);break;case s.LINES:e.lines+=a*(r/2);break;case s.LINE_STRIP:e.lines+=a*(r-1);break;case s.LINE_LOOP:e.lines+=a*r;break;case s.POINTS:e.points+=a*r;break;default:qt("WebGLInfo: Unknown draw mode:",o);break}}function n(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:n,update:i}}function Vg(s,t,e){let i=new WeakMap,n=new _e;function r(o,a,l){let c=o.morphTargetInfluences,h=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,f=h!==void 0?h.length:0,u=i.get(a);if(u===void 0||u.count!==f){let A=function(){C.dispose(),i.delete(a),a.removeEventListener("dispose",A)};u!==void 0&&u.texture.dispose();let d=a.morphAttributes.position!==void 0,m=a.morphAttributes.normal!==void 0,_=a.morphAttributes.color!==void 0,p=a.morphAttributes.position||[],g=a.morphAttributes.normal||[],M=a.morphAttributes.color||[],T=0;d===!0&&(T=1),m===!0&&(T=2),_===!0&&(T=3);let y=a.attributes.position.count*T,b=1;y>t.maxTextureSize&&(b=Math.ceil(y/t.maxTextureSize),y=t.maxTextureSize);let E=new Float32Array(y*b*4*f),C=new cr(E,y,b,f);C.type=Ri,C.needsUpdate=!0;let x=T*4;for(let L=0;L<f;L++){let U=p[L],w=g[L],P=M[L],I=y*b*4*L;for(let N=0;N<U.count;N++){let B=N*x;d===!0&&(n.fromBufferAttribute(U,N),E[I+B+0]=n.x,E[I+B+1]=n.y,E[I+B+2]=n.z,E[I+B+3]=0),m===!0&&(n.fromBufferAttribute(w,N),E[I+B+4]=n.x,E[I+B+5]=n.y,E[I+B+6]=n.z,E[I+B+7]=0),_===!0&&(n.fromBufferAttribute(P,N),E[I+B+8]=n.x,E[I+B+9]=n.y,E[I+B+10]=n.z,E[I+B+11]=P.itemSize===4?n.w:1)}}u={count:f,texture:C,size:new tt(y,b)},i.set(a,u),a.addEventListener("dispose",A)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(s,"morphTexture",o.morphTexture,e);else{let d=0;for(let _=0;_<c.length;_++)d+=c[_];let m=a.morphTargetsRelative?1:1-d;l.getUniforms().setValue(s,"morphTargetBaseInfluence",m),l.getUniforms().setValue(s,"morphTargetInfluences",c)}l.getUniforms().setValue(s,"morphTargetsTexture",u.texture,e),l.getUniforms().setValue(s,"morphTargetsTextureSize",u.size)}return{update:r}}function Hg(s,t,e,i,n){let r=new WeakMap;function o(c){let h=n.render.frame,f=c.geometry,u=t.get(c,f);if(r.get(u)!==h&&(t.update(u),r.set(u,h)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),r.get(c)!==h&&(e.update(c.instanceMatrix,s.ARRAY_BUFFER),c.instanceColor!==null&&e.update(c.instanceColor,s.ARRAY_BUFFER),r.set(c,h))),c.isSkinnedMesh){let d=c.skeleton;r.get(d)!==h&&(d.update(),r.set(d,h))}return u}function a(){r=new WeakMap}function l(c){let h=c.target;h.removeEventListener("dispose",l),i.releaseStatesOfObject(h),e.remove(h.instanceMatrix),h.instanceColor!==null&&e.remove(h.instanceColor)}return{update:o,dispose:a}}var Gg={[Br]:"LINEAR_TONE_MAPPING",[kr]:"REINHARD_TONE_MAPPING",[zr]:"CINEON_TONE_MAPPING",[En]:"ACES_FILMIC_TONE_MAPPING",[Hr]:"AGX_TONE_MAPPING",[Gr]:"NEUTRAL_TONE_MAPPING",[Vr]:"CUSTOM_TONE_MAPPING"};function Wg(s,t,e,i,n,r){let o=new ve(t,e,{type:s,depthBuffer:n,stencilBuffer:r,samples:i?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1}),a=null,l=null,c=new De;c.setAttribute("position",new ge([-1,3,0,-1,-1,0,3,-1,0],3)),c.setAttribute("uv",new ge([0,2,0,0,2,0],2));let h=new Ps({uniforms:{tDiffuse:{value:null}},vertexShader:`
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
			}`,depthTest:!1,depthWrite:!1}),f=new Zt(c,h),u=new Ai(-1,1,1,-1,0,1),d=null,m=null,_=!1,p,g=null,M=[],T=!1;this.setSize=function(y,b){o.setSize(y,b),a!==null&&a.setSize(y,b),l!==null&&l.setSize(y,b);for(let E=0;E<M.length;E++){let C=M[E];C.setSize&&C.setSize(y,b)}},this.setEffects=function(y){M=y,T=M.length>0&&M[0].isRenderPass===!0;let b=o.width,E=o.height;M.length>0&&a===null&&(a=new ve(b,E,{type:we,depthBuffer:!1,stencilBuffer:!1}),l=new ve(b,E,{type:we,depthBuffer:!1,stencilBuffer:!1}));for(let C=0;C<M.length;C++){let x=M[C];x.setSize&&x.setSize(b,E)}},this.begin=function(y,b){if(_||y.toneMapping===fi&&M.length===0)return!1;if(g=b,b!==null){let E=b.width,C=b.height;(o.width!==E||o.height!==C)&&this.setSize(E,C)}return T===!1&&y.setRenderTarget(o),p=y.toneMapping,y.toneMapping=fi,!0},this.hasRenderPass=function(){return T},this.end=function(y,b){y.toneMapping=p,_=!0;let E=o,C=a;for(let x=0;x<M.length;x++){let A=M[x];A.enabled!==!1&&(A.render(y,C,E,b),A.needsSwap!==!1&&(E=C,C=C===a?l:a))}if(d!==y.outputColorSpace||m!==y.toneMapping){d=y.outputColorSpace,m=y.toneMapping,h.defines={},ne.getTransfer(d)===le&&(h.defines.SRGB_TRANSFER="");let x=Gg[m];x&&(h.defines[x]=""),h.needsUpdate=!0}h.uniforms.tDiffuse.value=E.texture,y.setRenderTarget(g),y.render(f,u),g=null,_=!1},this.isCompositing=function(){return _},this.dispose=function(){o.dispose(),a!==null&&a.dispose(),l!==null&&l.dispose(),c.dispose(),h.dispose()}}var Ad=new ei,rh=new Vi(1,1),Cd=new cr,Rd=new Ko,Pd=new pr,ld=[],cd=[],hd=new Float32Array(16),ud=new Float32Array(9),dd=new Float32Array(4);function Vs(s,t,e){let i=s[0];if(i<=0||i>0)return s;let n=t*e,r=ld[n];if(r===void 0&&(r=new Float32Array(n),ld[n]=r),t!==0){i.toArray(r,0);for(let o=1,a=0;o!==t;++o)a+=e,s[o].toArray(r,a)}return r}function Fe(s,t){if(s.length!==t.length)return!1;for(let e=0,i=s.length;e<i;e++)if(s[e]!==t[e])return!1;return!0}function Oe(s,t){for(let e=0,i=t.length;e<i;e++)s[e]=t[e]}function ml(s,t){let e=cd[t];e===void 0&&(e=new Int32Array(t),cd[t]=e);for(let i=0;i!==t;++i)e[i]=s.allocateTextureUnit();return e}function Xg(s,t){let e=this.cache;e[0]!==t&&(s.uniform1f(this.addr,t),e[0]=t)}function qg(s,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(s.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Fe(e,t))return;s.uniform2fv(this.addr,t),Oe(e,t)}}function Yg(s,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(s.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(s.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(Fe(e,t))return;s.uniform3fv(this.addr,t),Oe(e,t)}}function Zg(s,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(s.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Fe(e,t))return;s.uniform4fv(this.addr,t),Oe(e,t)}}function $g(s,t){let e=this.cache,i=t.elements;if(i===void 0){if(Fe(e,t))return;s.uniformMatrix2fv(this.addr,!1,t),Oe(e,t)}else{if(Fe(e,i))return;dd.set(i),s.uniformMatrix2fv(this.addr,!1,dd),Oe(e,i)}}function Jg(s,t){let e=this.cache,i=t.elements;if(i===void 0){if(Fe(e,t))return;s.uniformMatrix3fv(this.addr,!1,t),Oe(e,t)}else{if(Fe(e,i))return;ud.set(i),s.uniformMatrix3fv(this.addr,!1,ud),Oe(e,i)}}function jg(s,t){let e=this.cache,i=t.elements;if(i===void 0){if(Fe(e,t))return;s.uniformMatrix4fv(this.addr,!1,t),Oe(e,t)}else{if(Fe(e,i))return;hd.set(i),s.uniformMatrix4fv(this.addr,!1,hd),Oe(e,i)}}function Kg(s,t){let e=this.cache;e[0]!==t&&(s.uniform1i(this.addr,t),e[0]=t)}function Qg(s,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(s.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Fe(e,t))return;s.uniform2iv(this.addr,t),Oe(e,t)}}function t_(s,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(s.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(Fe(e,t))return;s.uniform3iv(this.addr,t),Oe(e,t)}}function e_(s,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(s.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Fe(e,t))return;s.uniform4iv(this.addr,t),Oe(e,t)}}function i_(s,t){let e=this.cache;e[0]!==t&&(s.uniform1ui(this.addr,t),e[0]=t)}function n_(s,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(s.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Fe(e,t))return;s.uniform2uiv(this.addr,t),Oe(e,t)}}function s_(s,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(s.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(Fe(e,t))return;s.uniform3uiv(this.addr,t),Oe(e,t)}}function r_(s,t){let e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(s.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Fe(e,t))return;s.uniform4uiv(this.addr,t),Oe(e,t)}}function o_(s,t,e){let i=this.cache,n=e.allocateTextureUnit();i[0]!==n&&(s.uniform1i(this.addr,n),i[0]=n);let r;this.type===s.SAMPLER_2D_SHADOW?(rh.compareFunction=e.isReversedDepthBuffer()?cl:ll,r=rh):r=Ad,e.setTexture2D(t||r,n)}function a_(s,t,e){let i=this.cache,n=e.allocateTextureUnit();i[0]!==n&&(s.uniform1i(this.addr,n),i[0]=n),e.setTexture3D(t||Rd,n)}function l_(s,t,e){let i=this.cache,n=e.allocateTextureUnit();i[0]!==n&&(s.uniform1i(this.addr,n),i[0]=n),e.setTextureCube(t||Pd,n)}function c_(s,t,e){let i=this.cache,n=e.allocateTextureUnit();i[0]!==n&&(s.uniform1i(this.addr,n),i[0]=n),e.setTexture2DArray(t||Cd,n)}function h_(s){switch(s){case 5126:return Xg;case 35664:return qg;case 35665:return Yg;case 35666:return Zg;case 35674:return $g;case 35675:return Jg;case 35676:return jg;case 5124:case 35670:return Kg;case 35667:case 35671:return Qg;case 35668:case 35672:return t_;case 35669:case 35673:return e_;case 5125:return i_;case 36294:return n_;case 36295:return s_;case 36296:return r_;case 35678:case 36198:case 36298:case 36306:case 35682:return o_;case 35679:case 36299:case 36307:return a_;case 35680:case 36300:case 36308:case 36293:return l_;case 36289:case 36303:case 36311:case 36292:return c_}}function u_(s,t){s.uniform1fv(this.addr,t)}function d_(s,t){let e=Vs(t,this.size,2);s.uniform2fv(this.addr,e)}function f_(s,t){let e=Vs(t,this.size,3);s.uniform3fv(this.addr,e)}function p_(s,t){let e=Vs(t,this.size,4);s.uniform4fv(this.addr,e)}function m_(s,t){let e=Vs(t,this.size,4);s.uniformMatrix2fv(this.addr,!1,e)}function g_(s,t){let e=Vs(t,this.size,9);s.uniformMatrix3fv(this.addr,!1,e)}function __(s,t){let e=Vs(t,this.size,16);s.uniformMatrix4fv(this.addr,!1,e)}function v_(s,t){s.uniform1iv(this.addr,t)}function x_(s,t){s.uniform2iv(this.addr,t)}function y_(s,t){s.uniform3iv(this.addr,t)}function M_(s,t){s.uniform4iv(this.addr,t)}function b_(s,t){s.uniform1uiv(this.addr,t)}function S_(s,t){s.uniform2uiv(this.addr,t)}function w_(s,t){s.uniform3uiv(this.addr,t)}function E_(s,t){s.uniform4uiv(this.addr,t)}function T_(s,t,e){let i=this.cache,n=t.length,r=ml(e,n);Fe(i,r)||(s.uniform1iv(this.addr,r),Oe(i,r));let o;this.type===s.SAMPLER_2D_SHADOW?o=rh:o=Ad;for(let a=0;a!==n;++a)e.setTexture2D(t[a]||o,r[a])}function A_(s,t,e){let i=this.cache,n=t.length,r=ml(e,n);Fe(i,r)||(s.uniform1iv(this.addr,r),Oe(i,r));for(let o=0;o!==n;++o)e.setTexture3D(t[o]||Rd,r[o])}function C_(s,t,e){let i=this.cache,n=t.length,r=ml(e,n);Fe(i,r)||(s.uniform1iv(this.addr,r),Oe(i,r));for(let o=0;o!==n;++o)e.setTextureCube(t[o]||Pd,r[o])}function R_(s,t,e){let i=this.cache,n=t.length,r=ml(e,n);Fe(i,r)||(s.uniform1iv(this.addr,r),Oe(i,r));for(let o=0;o!==n;++o)e.setTexture2DArray(t[o]||Cd,r[o])}function P_(s){switch(s){case 5126:return u_;case 35664:return d_;case 35665:return f_;case 35666:return p_;case 35674:return m_;case 35675:return g_;case 35676:return __;case 5124:case 35670:return v_;case 35667:case 35671:return x_;case 35668:case 35672:return y_;case 35669:case 35673:return M_;case 5125:return b_;case 36294:return S_;case 36295:return w_;case 36296:return E_;case 35678:case 36198:case 36298:case 36306:case 35682:return T_;case 35679:case 36299:case 36307:return A_;case 35680:case 36300:case 36308:case 36293:return C_;case 36289:case 36303:case 36311:case 36292:return R_}}var oh=class{constructor(t,e,i){this.id=t,this.addr=i,this.cache=[],this.type=e.type,this.setValue=h_(e.type)}},ah=class{constructor(t,e,i){this.id=t,this.addr=i,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=P_(e.type)}},lh=class{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,i){let n=this.seq;for(let r=0,o=n.length;r!==o;++r){let a=n[r];a.setValue(t,e[a.id],i)}}},nh=/(\w+)(\])?(\[|\.)?/g;function fd(s,t){s.seq.push(t),s.map[t.id]=t}function I_(s,t,e){let i=s.name,n=i.length;for(nh.lastIndex=0;;){let r=nh.exec(i),o=nh.lastIndex,a=r[1],l=r[2]==="]",c=r[3];if(l&&(a=a|0),c===void 0||c==="["&&o+2===n){fd(e,c===void 0?new oh(a,s,t):new ah(a,s,t));break}else{let f=e.map[a];f===void 0&&(f=new lh(a),fd(e,f)),e=f}}}var ks=class{constructor(t,e){this.seq=[],this.map={};let i=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let o=0;o<i;++o){let a=t.getActiveUniform(e,o),l=t.getUniformLocation(e,a.name);I_(a,l,this)}let n=[],r=[];for(let o of this.seq)o.type===t.SAMPLER_2D_SHADOW||o.type===t.SAMPLER_CUBE_SHADOW||o.type===t.SAMPLER_2D_ARRAY_SHADOW?n.push(o):r.push(o);n.length>0&&(this.seq=n.concat(r))}setValue(t,e,i,n){let r=this.map[e];r!==void 0&&r.setValue(t,i,n)}setOptional(t,e,i){let n=e[i];n!==void 0&&this.setValue(t,i,n)}static upload(t,e,i,n){for(let r=0,o=e.length;r!==o;++r){let a=e[r],l=i[a.id];l.needsUpdate!==!1&&a.setValue(t,l.value,n)}}static seqWithValue(t,e){let i=[];for(let n=0,r=t.length;n!==r;++n){let o=t[n];o.id in e&&i.push(o)}return i}};function pd(s,t,e){let i=s.createShader(t);return s.shaderSource(i,e),s.compileShader(i),i}var L_=37297,D_=0;function N_(s,t){let e=s.split(`
`),i=[],n=Math.max(t-6,0),r=Math.min(t+6,e.length);for(let o=n;o<r;o++){let a=o+1;i.push(`${a===t?">":" "} ${a}: ${e[o]}`)}return i.join(`
`)}var md=new jt;function U_(s){ne._getMatrix(md,ne.workingColorSpace,s);let t=`mat3( ${md.elements.map(e=>e.toFixed(4))} )`;switch(ne.getTransfer(s)){case or:return[t,"LinearTransferOETF"];case le:return[t,"sRGBTransferOETF"];default:return Yt("WebGLProgram: Unsupported color space: ",s),[t,"LinearTransferOETF"]}}function gd(s,t,e){let i=s.getShaderParameter(t,s.COMPILE_STATUS),r=(s.getShaderInfoLog(t)||"").trim();if(i&&r==="")return"";let o=/ERROR: 0:(\d+)/.exec(r);if(o){let a=parseInt(o[1]);return e.toUpperCase()+`

`+r+`

`+N_(s.getShaderSource(t),a)}else return r}function F_(s,t){let e=U_(t);return[`vec4 ${s}( vec4 value ) {`,`	return ${e[1]}( vec4( value.rgb * ${e[0]}, value.a ) );`,"}"].join(`
`)}var O_={[Br]:"Linear",[kr]:"Reinhard",[zr]:"Cineon",[En]:"ACESFilmic",[Hr]:"AgX",[Gr]:"Neutral",[Vr]:"Custom"};function B_(s,t){let e=O_[t];return e===void 0?(Yt("WebGLProgram: Unsupported toneMapping:",t),"vec3 "+s+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+s+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}var ul=new D;function k_(){ne.getLuminanceCoefficients(ul);let s=ul.x.toFixed(4),t=ul.y.toFixed(4),e=ul.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${s}, ${t}, ${e} );`,"	return dot( weights, rgb );","}"].join(`
`)}function z_(s){return[s.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",s.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(to).join(`
`)}function V_(s){let t=[];for(let e in s){let i=s[e];i!==!1&&t.push("#define "+e+" "+i)}return t.join(`
`)}function H_(s,t){let e={},i=s.getProgramParameter(t,s.ACTIVE_ATTRIBUTES);for(let n=0;n<i;n++){let r=s.getActiveAttrib(t,n),o=r.name,a=1;r.type===s.FLOAT_MAT2&&(a=2),r.type===s.FLOAT_MAT3&&(a=3),r.type===s.FLOAT_MAT4&&(a=4),e[o]={type:r.type,location:s.getAttribLocation(t,o),locationSize:a}}return e}function to(s){return s!==""}function _d(s,t){let e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return s.replace(/NUM_SUN_LIGHTS/g,t.numSunLights).replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,t.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function vd(s,t){return s.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var G_=/^[ \t]*#include +<([\w\d./]+)>/gm;function ch(s){return s.replace(G_,X_)}var W_=new Map;function X_(s,t){let e=ee[t];if(e===void 0){let i=W_.get(t);if(i!==void 0)e=ee[i],Yt('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,i);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+t+">")}return ch(e)}var q_=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function xd(s){return s.replace(q_,Y_)}function Y_(s,t,e,i){let n="";for(let r=parseInt(t);r<parseInt(e);r++)n+=i.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return n}function yd(s){let t=`precision ${s.precision} float;
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
	`;return s.precision==="highp"?t+=`
#define HIGH_PRECISION`:s.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:s.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}var Z_={[Sn]:"SHADOWMAP_TYPE_PCF",[Ds]:"SHADOWMAP_TYPE_VSM"};function $_(s){return Z_[s.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}var J_={[Tn]:"ENVMAP_TYPE_CUBE",[Yn]:"ENVMAP_TYPE_CUBE",[Wr]:"ENVMAP_TYPE_CUBE_UV"};function j_(s){return s.envMap===!1?"ENVMAP_TYPE_CUBE":J_[s.envMapMode]||"ENVMAP_TYPE_CUBE"}var K_={[Yn]:"ENVMAP_MODE_REFRACTION"};function Q_(s){return s.envMap===!1?"ENVMAP_MODE_REFLECTION":K_[s.envMapMode]||"ENVMAP_MODE_REFLECTION"}var tv={[ba]:"ENVMAP_BLENDING_MULTIPLY",[Nu]:"ENVMAP_BLENDING_MIX",[Uu]:"ENVMAP_BLENDING_ADD"};function ev(s){return s.envMap===!1?"ENVMAP_BLENDING_NONE":tv[s.combine]||"ENVMAP_BLENDING_NONE"}function iv(s){let t=s.envMapCubeUVHeight;if(t===null)return null;let e=Math.log2(t)-2,i=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),112)),texelHeight:i,maxMip:e}}function nv(s,t,e,i){let n=s.getContext(),r=e.defines,o=e.vertexShader,a=e.fragmentShader,l=$_(e),c=j_(e),h=Q_(e),f=ev(e),u=iv(e),d=z_(e),m=V_(r),_=n.createProgram(),p,g,M=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(p=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,m].filter(to).join(`
`),p.length>0&&(p+=`
`),g=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,m].filter(to).join(`
`),g.length>0&&(g+=`
`)):(p=[yd(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,m,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.batchingColor?"#define USE_BATCHING_COLOR":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.instancingMorph?"#define USE_INSTANCING_MORPH":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+h:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexNormals?"#define HAS_NORMAL":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",e.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(to).join(`
`),g=[yd(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,m,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+c:"",e.envMap?"#define "+h:"",e.envMap?"#define "+f:"",u?"#define CUBEUV_TEXEL_WIDTH "+u.texelWidth:"",u?"#define CUBEUV_TEXEL_HEIGHT "+u.texelHeight:"",u?"#define CUBEUV_MAX_MIP "+u.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.dispersion?"#define USE_DISPERSION":"",e.retroreflection?"#define USE_RETROREFLECTION":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor?"#define USE_COLOR":"",e.vertexAlphas||e.batchingColor?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",e.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",e.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==fi?"#define TONE_MAPPING":"",e.toneMapping!==fi?ee.tonemapping_pars_fragment:"",e.toneMapping!==fi?B_("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",ee.colorspace_pars_fragment,F_("linearToOutputTexel",e.outputColorSpace),k_(),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(to).join(`
`)),o=ch(o),o=_d(o,e),o=vd(o,e),a=ch(a),a=_d(a,e),a=vd(a,e),o=xd(o),a=xd(a),e.isRawShaderMaterial!==!0&&(M=`#version 300 es
`,p=[d,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+p,g=["#define varying in",e.glslVersion===zc?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===zc?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+g);let T=M+p+o,y=M+g+a,b=pd(n,n.VERTEX_SHADER,T),E=pd(n,n.FRAGMENT_SHADER,y);n.attachShader(_,b),n.attachShader(_,E),e.index0AttributeName!==void 0?n.bindAttribLocation(_,0,e.index0AttributeName):e.hasPositionAttribute===!0&&n.bindAttribLocation(_,0,"position"),n.linkProgram(_);function C(U){if(s.debug.checkShaderErrors){let w=n.getProgramInfoLog(_)||"",P=n.getShaderInfoLog(b)||"",I=n.getShaderInfoLog(E)||"",N=w.trim(),B=P.trim(),O=I.trim(),G=!0,V=!0;if(n.getProgramParameter(_,n.LINK_STATUS)===!1)if(G=!1,typeof s.debug.onShaderError=="function")s.debug.onShaderError(n,_,b,E);else{let W=gd(n,b,"vertex"),$=gd(n,E,"fragment");qt("WebGLProgram: Shader Error "+n.getError()+" - VALIDATE_STATUS "+n.getProgramParameter(_,n.VALIDATE_STATUS)+`

Material Name: `+U.name+`
Material Type: `+U.type+`

Program Info Log: `+N+`
`+W+`
`+$)}else N!==""?Yt("WebGLProgram: Program Info Log:",N):(B===""||O==="")&&(V=!1);V&&(U.diagnostics={runnable:G,programLog:N,vertexShader:{log:B,prefix:p},fragmentShader:{log:O,prefix:g}})}n.deleteShader(b),n.deleteShader(E),x=new ks(n,_),A=H_(n,_)}let x;this.getUniforms=function(){return x===void 0&&C(this),x};let A;this.getAttributes=function(){return A===void 0&&C(this),A};let L=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return L===!1&&(L=n.getProgramParameter(_,L_)),L},this.destroy=function(){i.releaseStatesOfProgram(this),n.deleteProgram(_),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=D_++,this.cacheKey=t,this.usedTimes=1,this.program=_,this.vertexShader=b,this.fragmentShader=E,this}var sv=0,hh=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t,e,i){let n=this._getShaderCacheForMaterial(t);return n.has(e)===!1&&(n.add(e),e.usedTimes++),n.has(i)===!1&&(n.add(i),i.usedTimes++),this}remove(t){let e=this.materialCache.get(t);for(let i of e)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(t),this}getVertexShaderStage(t){return this._getShaderStage(t.vertexShader)}getFragmentShaderStage(t){return this._getShaderStage(t.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){let e=this.materialCache,i=e.get(t);return i===void 0&&(i=new Set,e.set(t,i)),i}_getShaderStage(t){let e=this.shaderCache,i=e.get(t);return i===void 0&&(i=new uh(t),e.set(t,i)),i}},uh=class{constructor(t){this.id=sv++,this.code=t,this.usedTimes=0}};function rv(s){return s===Rn||s===Jr||s===jr}function ov(s,t,e,i,n,r){let o=new bs,a=new hh,l=new Set,c=[],h=new Map,f=i.logarithmicDepthBuffer,u=i.precision,d={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function m(x){return l.add(x),x===0?"uv":`uv${x}`}function _(x,A,L,U,w,P){let I=U.fog,N=w.geometry,B=x.isMeshStandardMaterial||x.isMeshLambertMaterial||x.isMeshPhongMaterial?U.environment:null,O=x.isMeshStandardMaterial||x.isMeshLambertMaterial&&!x.envMap||x.isMeshPhongMaterial&&!x.envMap,G=t.get(x.envMap||B,O),V=G&&G.mapping===Wr?G.image.height:null,W=d[x.type];x.precision!==null&&(u=i.getMaxPrecision(x.precision),u!==x.precision&&Yt("WebGLProgram.getParameters:",x.precision,"not supported, using",u,"instead."));let $=N.morphAttributes.position||N.morphAttributes.normal||N.morphAttributes.color,dt=$!==void 0?$.length:0,mt=0;N.morphAttributes.position!==void 0&&(mt=1),N.morphAttributes.normal!==void 0&&(mt=2),N.morphAttributes.color!==void 0&&(mt=3);let Ct,wt,Ht,Z;if(W){let xe=Wi[W];Ct=xe.vertexShader,wt=xe.fragmentShader}else{Ct=x.vertexShader,wt=x.fragmentShader;let xe=a.getVertexShaderStage(x),he=a.getFragmentShaderStage(x);a.update(x,xe,he),Ht=xe.id,Z=he.id}let j=s.getRenderTarget(),ut=s.state.buffers.depth.getReversed(),It=w.isInstancedMesh===!0,vt=w.isBatchedMesh===!0,Bt=!!x.map,ie=!!x.matcap,et=!!G,at=!!x.aoMap,st=!!x.lightMap,ot=!!x.bumpMap&&x.wireframe===!1,ct=!!x.normalMap,Ft=!!x.displacementMap,Pt=!!x.emissiveMap,Dt=!!x.metalnessMap,Xt=!!x.roughnessMap,F=x.anisotropy>0,se=x.clearcoat>0,Jt=x.dispersion>0,R=x.retroreflectivity>0,v=x.iridescence>0,H=x.sheen>0,X=x.transmission>0,K=F&&!!x.anisotropyMap,ht=se&&!!x.clearcoatMap,ft=se&&!!x.clearcoatNormalMap,Q=se&&!!x.clearcoatRoughnessMap,nt=v&&!!x.iridescenceMap,_t=v&&!!x.iridescenceThicknessMap,kt=H&&!!x.sheenColorMap,gt=H&&!!x.sheenRoughnessMap,pt=!!x.specularMap,Lt=!!x.specularColorMap,Gt=!!x.specularIntensityMap,$t=X&&!!x.transmissionMap,z=X&&!!x.thicknessMap,xt=!!x.gradientMap,it=!!x.alphaMap,yt=x.alphaTest>0,Et=!!x.alphaHash,lt=!!x.extensions,Wt=fi;x.toneMapped&&(j===null||j.isXRRenderTarget===!0)&&(Wt=s.toneMapping);let Ot={shaderID:W,shaderType:x.type,shaderName:x.name,vertexShader:Ct,fragmentShader:wt,defines:x.defines,customVertexShaderID:Ht,customFragmentShaderID:Z,isRawShaderMaterial:x.isRawShaderMaterial===!0,glslVersion:x.glslVersion,precision:u,batching:vt,batchingColor:vt&&w._colorsTexture!==null,instancing:It,instancingColor:It&&w.instanceColor!==null,instancingMorph:It&&w.morphTexture!==null,outputColorSpace:j===null?s.outputColorSpace:j.isXRRenderTarget===!0?j.texture.colorSpace:ne.workingColorSpace,alphaToCoverage:!!x.alphaToCoverage,map:Bt,matcap:ie,envMap:et,envMapMode:et&&G.mapping,envMapCubeUVHeight:V,aoMap:at,lightMap:st,bumpMap:ot,normalMap:ct,displacementMap:Ft,emissiveMap:Pt,normalMapObjectSpace:ct&&x.normalMapType===Bu,normalMapTangentSpace:ct&&x.normalMapType===Fs,packedNormalMap:ct&&x.normalMapType===Fs&&rv(x.normalMap.format),metalnessMap:Dt,roughnessMap:Xt,anisotropy:F,anisotropyMap:K,clearcoat:se,clearcoatMap:ht,clearcoatNormalMap:ft,clearcoatRoughnessMap:Q,dispersion:Jt,retroreflection:R,iridescence:v,iridescenceMap:nt,iridescenceThicknessMap:_t,sheen:H,sheenColorMap:kt,sheenRoughnessMap:gt,specularMap:pt,specularColorMap:Lt,specularIntensityMap:Gt,transmission:X,transmissionMap:$t,thicknessMap:z,gradientMap:xt,opaque:x.transparent===!1&&x.blending===Ns&&x.alphaToCoverage===!1,alphaMap:it,alphaTest:yt,alphaHash:Et,combine:x.combine,mapUv:Bt&&m(x.map.channel),aoMapUv:at&&m(x.aoMap.channel),lightMapUv:st&&m(x.lightMap.channel),bumpMapUv:ot&&m(x.bumpMap.channel),normalMapUv:ct&&m(x.normalMap.channel),displacementMapUv:Ft&&m(x.displacementMap.channel),emissiveMapUv:Pt&&m(x.emissiveMap.channel),metalnessMapUv:Dt&&m(x.metalnessMap.channel),roughnessMapUv:Xt&&m(x.roughnessMap.channel),anisotropyMapUv:K&&m(x.anisotropyMap.channel),clearcoatMapUv:ht&&m(x.clearcoatMap.channel),clearcoatNormalMapUv:ft&&m(x.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Q&&m(x.clearcoatRoughnessMap.channel),iridescenceMapUv:nt&&m(x.iridescenceMap.channel),iridescenceThicknessMapUv:_t&&m(x.iridescenceThicknessMap.channel),sheenColorMapUv:kt&&m(x.sheenColorMap.channel),sheenRoughnessMapUv:gt&&m(x.sheenRoughnessMap.channel),specularMapUv:pt&&m(x.specularMap.channel),specularColorMapUv:Lt&&m(x.specularColorMap.channel),specularIntensityMapUv:Gt&&m(x.specularIntensityMap.channel),transmissionMapUv:$t&&m(x.transmissionMap.channel),thicknessMapUv:z&&m(x.thicknessMap.channel),alphaMapUv:it&&m(x.alphaMap.channel),vertexTangents:!!N.attributes.tangent&&(ct||F),vertexNormals:!!N.attributes.normal,vertexColors:x.vertexColors,vertexAlphas:x.vertexColors===!0&&!!N.attributes.color&&N.attributes.color.itemSize===4,pointsUvs:w.isPoints===!0&&!!N.attributes.uv&&(Bt||it),fog:!!I,useFog:x.fog===!0,fogExp2:!!I&&I.isFogExp2,flatShading:x.wireframe===!1&&(x.flatShading===!0||N.attributes.normal===void 0&&ct===!1&&(x.isMeshLambertMaterial||x.isMeshPhongMaterial||x.isMeshStandardMaterial||x.isMeshPhysicalMaterial)),sizeAttenuation:x.sizeAttenuation===!0,logarithmicDepthBuffer:f,reversedDepthBuffer:ut,skinning:w.isSkinnedMesh===!0,hasPositionAttribute:N.attributes.position!==void 0,morphTargets:N.morphAttributes.position!==void 0,morphNormals:N.morphAttributes.normal!==void 0,morphColors:N.morphAttributes.color!==void 0,morphTargetsCount:dt,morphTextureStride:mt,numSunLights:A.sun.length,numDirLights:A.directional.length,numPointLights:A.point.length,numSpotLights:A.spot.length,numSpotLightMaps:A.spotLightMap.length,numRectAreaLights:A.rectArea.length,numHemiLights:A.hemi.length,numSunLightShadows:A.sunShadowMap.length,numDirLightShadows:A.directionalShadowMap.length,numPointLightShadows:A.pointShadowMap.length,numSpotLightShadows:A.spotShadowMap.length,numSpotLightShadowsWithMaps:A.numSpotLightShadowsWithMaps,numLightProbes:A.numLightProbes,numLightProbeGrids:P.length,numClippingPlanes:r.numPlanes,numClipIntersection:r.numIntersection,dithering:x.dithering,shadowMapEnabled:s.shadowMap.enabled&&L.length>0,shadowMapType:s.shadowMap.type,toneMapping:Wt,decodeVideoTexture:Bt&&x.map.isVideoTexture===!0&&ne.getTransfer(x.map.colorSpace)===le,decodeVideoTextureEmissive:Pt&&x.emissiveMap.isVideoTexture===!0&&ne.getTransfer(x.emissiveMap.colorSpace)===le,premultipliedAlpha:x.premultipliedAlpha,doubleSided:x.side===Xe,flipSided:x.side===Ne,useDepthPacking:x.depthPacking>=0,depthPacking:x.depthPacking||0,index0AttributeName:x.index0AttributeName,extensionClipCullDistance:lt&&x.extensions.clipCullDistance===!0&&e.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(lt&&x.extensions.multiDraw===!0||vt)&&e.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:e.has("KHR_parallel_shader_compile"),customProgramCacheKey:x.customProgramCacheKey()};return Ot.vertexUv1s=l.has(1),Ot.vertexUv2s=l.has(2),Ot.vertexUv3s=l.has(3),l.clear(),Ot}function p(x){let A=[];if(x.shaderID?A.push(x.shaderID):(A.push(x.customVertexShaderID),A.push(x.customFragmentShaderID)),x.defines!==void 0)for(let L in x.defines)A.push(L),A.push(x.defines[L]);return x.isRawShaderMaterial===!1&&(g(A,x),M(A,x),A.push(s.outputColorSpace)),A.push(x.customProgramCacheKey),A.join()}function g(x,A){x.push(A.precision),x.push(A.outputColorSpace),x.push(A.envMapMode),x.push(A.envMapCubeUVHeight),x.push(A.mapUv),x.push(A.alphaMapUv),x.push(A.lightMapUv),x.push(A.aoMapUv),x.push(A.bumpMapUv),x.push(A.normalMapUv),x.push(A.displacementMapUv),x.push(A.emissiveMapUv),x.push(A.metalnessMapUv),x.push(A.roughnessMapUv),x.push(A.anisotropyMapUv),x.push(A.clearcoatMapUv),x.push(A.clearcoatNormalMapUv),x.push(A.clearcoatRoughnessMapUv),x.push(A.iridescenceMapUv),x.push(A.iridescenceThicknessMapUv),x.push(A.sheenColorMapUv),x.push(A.sheenRoughnessMapUv),x.push(A.specularMapUv),x.push(A.specularColorMapUv),x.push(A.specularIntensityMapUv),x.push(A.transmissionMapUv),x.push(A.thicknessMapUv),x.push(A.combine),x.push(A.fogExp2),x.push(A.sizeAttenuation),x.push(A.morphTargetsCount),x.push(A.morphAttributeCount),x.push(A.numSunLights),x.push(A.numDirLights),x.push(A.numPointLights),x.push(A.numSpotLights),x.push(A.numSpotLightMaps),x.push(A.numHemiLights),x.push(A.numRectAreaLights),x.push(A.numSunLightShadows),x.push(A.numDirLightShadows),x.push(A.numPointLightShadows),x.push(A.numSpotLightShadows),x.push(A.numSpotLightShadowsWithMaps),x.push(A.numLightProbes),x.push(A.shadowMapType),x.push(A.toneMapping),x.push(A.numClippingPlanes),x.push(A.numClipIntersection),x.push(A.depthPacking)}function M(x,A){o.disableAll(),A.instancing&&o.enable(0),A.instancingColor&&o.enable(1),A.instancingMorph&&o.enable(2),A.matcap&&o.enable(3),A.envMap&&o.enable(4),A.normalMapObjectSpace&&o.enable(5),A.normalMapTangentSpace&&o.enable(6),A.clearcoat&&o.enable(7),A.iridescence&&o.enable(8),A.alphaTest&&o.enable(9),A.vertexColors&&o.enable(10),A.vertexAlphas&&o.enable(11),A.vertexUv1s&&o.enable(12),A.vertexUv2s&&o.enable(13),A.vertexUv3s&&o.enable(14),A.vertexTangents&&o.enable(15),A.anisotropy&&o.enable(16),A.alphaHash&&o.enable(17),A.batching&&o.enable(18),A.dispersion&&o.enable(19),A.retroreflection&&o.enable(24),A.batchingColor&&o.enable(20),A.gradientMap&&o.enable(21),A.packedNormalMap&&o.enable(22),A.vertexNormals&&o.enable(23),x.push(o.mask),o.disableAll(),A.fog&&o.enable(0),A.useFog&&o.enable(1),A.flatShading&&o.enable(2),A.logarithmicDepthBuffer&&o.enable(3),A.reversedDepthBuffer&&o.enable(4),A.skinning&&o.enable(5),A.morphTargets&&o.enable(6),A.morphNormals&&o.enable(7),A.morphColors&&o.enable(8),A.premultipliedAlpha&&o.enable(9),A.shadowMapEnabled&&o.enable(10),A.doubleSided&&o.enable(11),A.flipSided&&o.enable(12),A.useDepthPacking&&o.enable(13),A.dithering&&o.enable(14),A.transmission&&o.enable(15),A.sheen&&o.enable(16),A.opaque&&o.enable(17),A.pointsUvs&&o.enable(18),A.decodeVideoTexture&&o.enable(19),A.decodeVideoTextureEmissive&&o.enable(20),A.alphaToCoverage&&o.enable(21),A.numLightProbeGrids>0&&o.enable(22),A.hasPositionAttribute&&o.enable(23),x.push(o.mask)}function T(x){let A=d[x.type],L;if(A){let U=Wi[A];L=Ue.clone(U.uniforms)}else L=x.uniforms;return L}function y(x,A){let L=h.get(A);return L!==void 0?++L.usedTimes:(L=new nv(s,A,x,n),c.push(L),h.set(A,L)),L}function b(x){if(--x.usedTimes===0){let A=c.indexOf(x);c[A]=c[c.length-1],c.pop(),h.delete(x.cacheKey),x.destroy()}}function E(x){a.remove(x)}function C(){a.dispose()}return{getParameters:_,getProgramCacheKey:p,getUniforms:T,acquireProgram:y,releaseProgram:b,releaseShaderCache:E,programs:c,dispose:C}}function av(){let s=new WeakMap;function t(o){return s.has(o)}function e(o){let a=s.get(o);return a===void 0&&(a={},s.set(o,a)),a}function i(o){s.delete(o)}function n(o,a,l){s.get(o)[a]=l}function r(){s=new WeakMap}return{has:t,get:e,remove:i,update:n,dispose:r}}function lv(s,t){return s.groupOrder!==t.groupOrder?s.groupOrder-t.groupOrder:s.renderOrder!==t.renderOrder?s.renderOrder-t.renderOrder:s.material.id!==t.material.id?s.material.id-t.material.id:s.materialVariant!==t.materialVariant?s.materialVariant-t.materialVariant:s.z!==t.z?s.z-t.z:s.id-t.id}function Md(s,t){return s.groupOrder!==t.groupOrder?s.groupOrder-t.groupOrder:s.renderOrder!==t.renderOrder?s.renderOrder-t.renderOrder:s.z!==t.z?t.z-s.z:s.id-t.id}function bd(){let s=[],t=0,e=[],i=[],n=[];function r(){t=0,e.length=0,i.length=0,n.length=0}function o(u){let d=0;return u.isInstancedMesh&&(d+=2),u.isSkinnedMesh&&(d+=1),d}function a(u,d,m,_,p,g){let M=s[t];return M===void 0?(M={id:u.id,object:u,geometry:d,material:m,materialVariant:o(u),groupOrder:_,renderOrder:u.renderOrder,z:p,group:g},s[t]=M):(M.id=u.id,M.object=u,M.geometry=d,M.material=m,M.materialVariant=o(u),M.groupOrder=_,M.renderOrder=u.renderOrder,M.z=p,M.group=g),t++,M}function l(u,d,m,_,p,g,M){M.reversedDepth===!0&&(p=-p);let T=a(u,d,m,_,p,g);m.transmission>0?i.push(T):m.transparent===!0?n.push(T):e.push(T)}function c(u,d,m,_,p,g){let M=a(u,d,m,_,p,g);m.transmission>0?i.unshift(M):m.transparent===!0?n.unshift(M):e.unshift(M)}function h(u,d){e.length>1&&e.sort(u||lv),i.length>1&&i.sort(d||Md),n.length>1&&n.sort(d||Md)}function f(){for(let u=t,d=s.length;u<d;u++){let m=s[u];if(m.id===null)break;m.id=null,m.object=null,m.geometry=null,m.material=null,m.group=null}}return{opaque:e,transmissive:i,transparent:n,init:r,push:l,unshift:c,finish:f,sort:h}}function cv(){let s=new WeakMap;function t(i,n){let r=s.get(i),o;return r===void 0?(o=new bd,s.set(i,[o])):n>=r.length?(o=new bd,r.push(o)):o=r[n],o}function e(){s=new WeakMap}return{get:t,dispose:e}}function hv(){let s={};return{get:function(t){if(s[t.id]!==void 0)return s[t.id];let e;switch(t.type){case"SunLight":case"DirectionalLight":e={direction:new D,color:new Vt};break;case"SpotLight":e={position:new D,direction:new D,color:new Vt,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new D,color:new Vt,distance:0,decay:0};break;case"HemisphereLight":e={direction:new D,skyColor:new Vt,groundColor:new Vt};break;case"RectAreaLight":e={color:new Vt,position:new D,halfWidth:new D,halfHeight:new D};break}return s[t.id]=e,e}}}function uv(){let s={};return{get:function(t){if(s[t.id]!==void 0)return s[t.id];let e;switch(t.type){case"SunLight":case"DirectionalLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new tt};break;case"SpotLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new tt};break;case"PointLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new tt,shadowCameraNear:1,shadowCameraFar:1e3};break}return s[t.id]=e,e}}}var dv=0;function fv(s,t){return(t.castShadow?2:0)-(s.castShadow?2:0)+(t.map?1:0)-(s.map?1:0)}function pv(s){let t=new hv,e=uv(),i={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)i.probe.push(new D);let n=new D,r=new oe,o=new oe;function a(c){let h=0,f=0,u=0;for(let w=0;w<9;w++)i.probe[w].set(0,0,0);let d=0,m=0,_=0,p=0,g=0,M=0,T=0,y=0,b=0,E=0,C=0,x=0,A=0,L=0;c.sort(fv);for(let w=0,P=c.length;w<P;w++){let I=c[w],N=I.color,B=I.intensity,O=I.distance,G=null;if(I.shadow&&I.shadow.map&&(I.shadow.map.texture.format===Rn?G=I.shadow.map.texture:G=I.shadow.map.depthTexture||I.shadow.map.texture),I.isAmbientLight)h+=N.r*B,f+=N.g*B,u+=N.b*B;else if(I.isLightProbe){for(let V=0;V<9;V++)i.probe[V].addScaledVector(I.sh.coefficients[V],B);L++}else if(I.isSunLight){let V=t.get(I);if(V.color.copy(I.color).multiplyScalar(I.intensity),I.castShadow){let W=I.shadow,$=e.get(I);$.shadowIntensity=W.intensity,$.shadowBias=W.bias,$.shadowNormalBias=W.normalBias,$.shadowRadius=W.radius,$.shadowMapSize.copy(W.mapSize).multiply(W.getFrameExtents()),i.sunShadow[m]=$,i.sunShadowMap[m]=G;let dt=W.getViewportCount();for(let mt=0;mt<dt;mt++)i.sunShadowMatrix[_+mt]=W.getMatrix(mt),i.sunShadowCascade[_+mt]=W._cascadeData[mt];_+=dt,m++}i.sun[d]=V,d++}else if(I.isDirectionalLight){let V=t.get(I);if(V.color.copy(I.color).multiplyScalar(I.intensity),I.castShadow){let W=I.shadow,$=e.get(I);$.shadowIntensity=W.intensity,$.shadowBias=W.bias,$.shadowNormalBias=W.normalBias,$.shadowRadius=W.radius,$.shadowMapSize=W.mapSize,i.directionalShadow[p]=$,i.directionalShadowMap[p]=G,i.directionalShadowMatrix[p]=I.shadow.matrix,b++}i.directional[p]=V,p++}else if(I.isSpotLight){let V=t.get(I);V.position.setFromMatrixPosition(I.matrixWorld),V.color.copy(N).multiplyScalar(B),V.distance=O,V.coneCos=Math.cos(I.angle),V.penumbraCos=Math.cos(I.angle*(1-I.penumbra)),V.decay=I.decay,i.spot[M]=V;let W=I.shadow;if(I.map&&(i.spotLightMap[x]=I.map,x++,W.updateMatrices(I),I.castShadow&&A++),i.spotLightMatrix[M]=W.matrix,I.castShadow){let $=e.get(I);$.shadowIntensity=W.intensity,$.shadowBias=W.bias,$.shadowNormalBias=W.normalBias,$.shadowRadius=W.radius,$.shadowMapSize=W.mapSize,i.spotShadow[M]=$,i.spotShadowMap[M]=G,C++}M++}else if(I.isRectAreaLight){let V=t.get(I);V.color.copy(N).multiplyScalar(B),V.halfWidth.set(I.width*.5,0,0),V.halfHeight.set(0,I.height*.5,0),i.rectArea[T]=V,T++}else if(I.isPointLight){let V=t.get(I);if(V.color.copy(I.color).multiplyScalar(I.intensity),V.distance=I.distance,V.decay=I.decay,I.castShadow){let W=I.shadow,$=e.get(I);$.shadowIntensity=W.intensity,$.shadowBias=W.bias,$.shadowNormalBias=W.normalBias,$.shadowRadius=W.radius,$.shadowMapSize=W.mapSize,$.shadowCameraNear=W.camera.near,$.shadowCameraFar=W.camera.far,i.pointShadow[g]=$,i.pointShadowMap[g]=G,i.pointShadowMatrix[g]=I.shadow.matrix,E++}i.point[g]=V,g++}else if(I.isHemisphereLight){let V=t.get(I);V.skyColor.copy(I.color).multiplyScalar(B),V.groundColor.copy(I.groundColor).multiplyScalar(B),i.hemi[y]=V,y++}}T>0&&(s.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=Mt.LTC_FLOAT_1,i.rectAreaLTC2=Mt.LTC_FLOAT_2):(i.rectAreaLTC1=Mt.LTC_HALF_1,i.rectAreaLTC2=Mt.LTC_HALF_2)),i.ambient[0]=h,i.ambient[1]=f,i.ambient[2]=u;let U=i.hash;(U.sunLength!==d||U.directionalLength!==p||U.pointLength!==g||U.spotLength!==M||U.rectAreaLength!==T||U.hemiLength!==y||U.numSunShadows!==m||U.numDirectionalShadows!==b||U.numPointShadows!==E||U.numSpotShadows!==C||U.numSpotMaps!==x||U.numLightProbes!==L)&&(i.sun.length=d,i.directional.length=p,i.spot.length=M,i.rectArea.length=T,i.point.length=g,i.hemi.length=y,i.sunShadow.length=m,i.sunShadowMap.length=m,i.sunShadowMatrix.length=_,i.sunShadowCascade.length=_,i.directionalShadow.length=b,i.directionalShadowMap.length=b,i.directionalShadowMatrix.length=b,i.pointShadow.length=E,i.pointShadowMap.length=E,i.pointShadowMatrix.length=E,i.spotShadow.length=C,i.spotShadowMap.length=C,i.spotLightMatrix.length=C+x-A,i.spotLightMap.length=x,i.numSpotLightShadowsWithMaps=A,i.numLightProbes=L,U.sunLength=d,U.directionalLength=p,U.pointLength=g,U.spotLength=M,U.rectAreaLength=T,U.hemiLength=y,U.numSunShadows=m,U.numDirectionalShadows=b,U.numPointShadows=E,U.numSpotShadows=C,U.numSpotMaps=x,U.numLightProbes=L,i.version=dv++)}function l(c,h){let f=0,u=0,d=0,m=0,_=0,p=0,g=h.matrixWorldInverse;for(let M=0,T=c.length;M<T;M++){let y=c[M];if(y.isSunLight){let b=i.sun[f];b.direction.setFromMatrixPosition(y.matrixWorld),b.direction.transformDirection(g),f++}else if(y.isDirectionalLight){let b=i.directional[u];b.direction.setFromMatrixPosition(y.matrixWorld),n.setFromMatrixPosition(y.target.matrixWorld),b.direction.sub(n),b.direction.transformDirection(g),u++}else if(y.isSpotLight){let b=i.spot[m];b.position.setFromMatrixPosition(y.matrixWorld),b.position.applyMatrix4(g),b.direction.setFromMatrixPosition(y.matrixWorld),n.setFromMatrixPosition(y.target.matrixWorld),b.direction.sub(n),b.direction.transformDirection(g),m++}else if(y.isRectAreaLight){let b=i.rectArea[_];b.position.setFromMatrixPosition(y.matrixWorld),b.position.applyMatrix4(g),o.identity(),r.copy(y.matrixWorld),r.premultiply(g),o.extractRotation(r),b.halfWidth.set(y.width*.5,0,0),b.halfHeight.set(0,y.height*.5,0),b.halfWidth.applyMatrix4(o),b.halfHeight.applyMatrix4(o),_++}else if(y.isPointLight){let b=i.point[d];b.position.setFromMatrixPosition(y.matrixWorld),b.position.applyMatrix4(g),d++}else if(y.isHemisphereLight){let b=i.hemi[p];b.direction.setFromMatrixPosition(y.matrixWorld),b.direction.transformDirection(g),p++}}}return{setup:a,setupView:l,state:i}}function Sd(s){let t=new pv(s),e=[],i=[],n=[];function r(u){f.camera=u,e.length=0,i.length=0,n.length=0}function o(u){e.push(u)}function a(u){i.push(u)}function l(u){n.push(u)}function c(){t.setup(e)}function h(u){t.setupView(e,u)}let f={lightsArray:e,shadowsArray:i,lightProbeGridArray:n,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:r,state:f,setupLights:c,setupLightsView:h,pushLight:o,pushShadow:a,pushLightProbeGrid:l}}function mv(s){let t=new WeakMap;function e(n,r=0){let o=t.get(n),a;return o===void 0?(a=new Sd(s),t.set(n,[a])):r>=o.length?(a=new Sd(s),o.push(a)):a=o[r],a}function i(){t=new WeakMap}return{get:e,dispose:i}}var gv=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,_v=`uniform sampler2D shadow_pass;
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
}`,vv=[new D(1,0,0),new D(-1,0,0),new D(0,1,0),new D(0,-1,0),new D(0,0,1),new D(0,0,-1)],xv=[new D(0,-1,0),new D(0,-1,0),new D(0,0,1),new D(0,0,-1),new D(0,-1,0),new D(0,-1,0)],wd=new oe,Qr=new D,sh=new D;function yv(s,t,e){let i=new As,n=new tt,r=new tt,o=new _e,a=new oa,l=new aa,c={},h=e.maxTextureSize,f={[wn]:Ne,[Ne]:wn,[Xe]:Xe},u=new ce({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new tt},radius:{value:4}},vertexShader:gv,fragmentShader:_v}),d=u.clone();d.defines.HORIZONTAL_PASS=1;let m=new De;m.setAttribute("position",new Le(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let _=new Zt(m,u),p=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=Sn;let g=this.type;this.render=function(E,C,x){if(p.enabled===!1||p.autoUpdate===!1&&p.needsUpdate===!1||E.length===0)return;this.type===xu&&(Yt("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead."),this.type=Sn);let A=s.getRenderTarget(),L=s.getActiveCubeFace(),U=s.getActiveMipmapLevel(),w=s.state;w.setBlending(Ae),w.buffers.depth.getReversed()===!0?w.buffers.color.setClear(0,0,0,0):w.buffers.color.setClear(1,1,1,1),w.buffers.depth.setTest(!0),w.setScissorTest(!1);let P=g!==this.type;P&&C.traverse(function(I){I.material&&(Array.isArray(I.material)?I.material.forEach(N=>N.needsUpdate=!0):I.material.needsUpdate=!0)});for(let I=0,N=E.length;I<N;I++){let B=E[I],O=B.shadow;if(O===void 0){Yt("WebGLShadowMap:",B,"has no shadow.");continue}if(O.autoUpdate===!1&&O.needsUpdate===!1)continue;n.copy(O.mapSize);let G=O.getFrameExtents();n.multiply(G),r.copy(O.mapSize),(n.x>h||n.y>h)&&(n.x>h&&(r.x=Math.floor(h/G.x),n.x=r.x*G.x,O.mapSize.x=r.x),n.y>h&&(r.y=Math.floor(h/G.y),n.y=r.y*G.y,O.mapSize.y=r.y));let V=s.state.buffers.depth.getReversed();if(O.camera._reversedDepth=V,O.map===null||P===!0){if(O.map!==null&&(O.map.depthTexture!==null&&(O.map.depthTexture.dispose(),O.map.depthTexture=null),O.map.dispose()),this.type===Ds){if(B.isPointLight){Yt("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}O.map=new ve(n.x,n.y,{format:Rn,type:we,minFilter:He,magFilter:He,generateMipmaps:!1}),O.map.texture.name=B.name+".shadowMap",O.map.depthTexture=new Vi(n.x,n.y,Ri),O.map.depthTexture.name=B.name+".shadowMapDepth",O.map.depthTexture.format=ki,O.map.depthTexture.compareFunction=null,O.map.depthTexture.minFilter=Te,O.map.depthTexture.magFilter=Te}else B.isPointLight?(O.map=new dl(n.x),O.map.depthTexture=new Qo(n.x,Ci)):(O.map=new ve(n.x,n.y),O.map.depthTexture=new Vi(n.x,n.y,Ci)),O.map.depthTexture.name=B.name+".shadowMap",O.map.depthTexture.format=ki,this.type===Sn?(O.map.depthTexture.compareFunction=V?cl:ll,O.map.depthTexture.minFilter=He,O.map.depthTexture.magFilter=He):(O.map.depthTexture.compareFunction=null,O.map.depthTexture.minFilter=Te,O.map.depthTexture.magFilter=Te);O.camera.updateProjectionMatrix()}O.map.isWebGLCubeRenderTarget!==!0&&(O.map.width!==n.x||O.map.height!==n.y)&&O.map.setSize(n.x,n.y);let W=O.map.isWebGLCubeRenderTarget?6:O.getViewportCount();B.isPointLight!==!0&&O.updateMatrices(B,x);for(let $=0;$<W;$++){let dt=O.getCamera($);if(B.isPointLight){let mt=O.camera,Ct=O.matrix,wt=B.distance||mt.far;wt!==mt.far&&(mt.far=wt,mt.updateProjectionMatrix()),Qr.setFromMatrixPosition(B.matrixWorld),mt.position.copy(Qr),sh.copy(mt.position),sh.add(vv[$]),mt.up.copy(xv[$]),mt.lookAt(sh),mt.updateMatrixWorld(),Ct.makeTranslation(-Qr.x,-Qr.y,-Qr.z),wd.multiplyMatrices(mt.projectionMatrix,mt.matrixWorldInverse),O._frustum.setFromProjectionMatrix(wd,mt.coordinateSystem,mt.reversedDepth)}if(O.map.isWebGLCubeRenderTarget)s.setRenderTarget(O.map,$),s.clear();else{$===0&&(s.setRenderTarget(O.map),s.clear());let mt=O.getViewport($);o.set(r.x*mt.x,r.y*mt.y,r.x*mt.z,r.y*mt.w),w.viewport(o)}i=O.getFrustum($),y(C,x,dt,B,this.type)}O.isPointLightShadow!==!0&&this.type===Ds&&M(O,x),O.needsUpdate=!1}g=this.type,p.needsUpdate=!1,s.setRenderTarget(A,L,U)};function M(E,C){let x=t.update(_);u.defines.VSM_SAMPLES!==E.blurSamples&&(u.defines.VSM_SAMPLES=E.blurSamples,d.defines.VSM_SAMPLES=E.blurSamples,u.needsUpdate=!0,d.needsUpdate=!0),E.mapPass===null?E.mapPass=new ve(n.x,n.y,{format:Rn,type:we}):(E.mapPass.width!==E.map.width||E.mapPass.height!==E.map.height)&&E.mapPass.setSize(E.map.width,E.map.height),u.uniforms.shadow_pass.value=E.map.depthTexture,u.uniforms.resolution.value.set(E.map.width,E.map.height),u.uniforms.radius.value=E.radius,s.setRenderTarget(E.mapPass),s.clear(),s.renderBufferDirect(C,null,x,u,_,null),d.uniforms.shadow_pass.value=E.mapPass.texture,d.uniforms.resolution.value.set(E.map.width,E.map.height),d.uniforms.radius.value=E.radius,s.setRenderTarget(E.map),s.clear(),s.renderBufferDirect(C,null,x,d,_,null)}function T(E,C,x,A){let L=null,U=x.isPointLight===!0?E.customDistanceMaterial:E.customDepthMaterial;if(U!==void 0)L=U;else if(L=x.isPointLight===!0?l:a,s.localClippingEnabled&&C.clipShadows===!0&&Array.isArray(C.clippingPlanes)&&C.clippingPlanes.length!==0||C.displacementMap&&C.displacementScale!==0||C.alphaMap&&C.alphaTest>0||C.map&&C.alphaTest>0||C.alphaToCoverage===!0){let w=L.uuid,P=C.uuid,I=c[w];I===void 0&&(I={},c[w]=I);let N=I[P];N===void 0&&(N=L.clone(),I[P]=N,C.addEventListener("dispose",b)),L=N}if(L.visible=C.visible,L.wireframe=C.wireframe,A===Ds?L.side=C.shadowSide!==null?C.shadowSide:C.side:L.side=C.shadowSide!==null?C.shadowSide:f[C.side],L.alphaMap=C.alphaMap,L.alphaTest=C.alphaToCoverage===!0?.5:C.alphaTest,L.map=C.map,L.clipShadows=C.clipShadows,L.clippingPlanes=C.clippingPlanes,L.clipIntersection=C.clipIntersection,L.displacementMap=C.displacementMap,L.displacementScale=C.displacementScale,L.displacementBias=C.displacementBias,L.wireframeLinewidth=C.wireframeLinewidth,L.linewidth=C.linewidth,x.isPointLight===!0&&L.isMeshDistanceMaterial===!0){let w=s.properties.get(L);w.light=x}return L}function y(E,C,x,A,L){if(E.visible===!1)return;if(E.layers.test(C.layers)&&(E.isMesh||E.isLine||E.isPoints)&&(E.castShadow||E.receiveShadow&&L===Ds)&&(!E.frustumCulled||E.intersectsFrustum(i))){E.modelViewMatrix.multiplyMatrices(x.matrixWorldInverse,E.matrixWorld);let P=t.update(E),I=E.material;if(Array.isArray(I)){let N=P.groups;for(let B=0,O=N.length;B<O;B++){let G=N[B],V=I[G.materialIndex];if(V&&V.visible){let W=T(E,V,A,L);E.onBeforeShadow(s,E,C,x,P,W,G),s.renderBufferDirect(x,null,P,W,E,G),E.onAfterShadow(s,E,C,x,P,W,G)}}}else if(I.visible){let N=T(E,I,A,L);E.onBeforeShadow(s,E,C,x,P,N,null),s.renderBufferDirect(x,null,P,N,E,null),E.onAfterShadow(s,E,C,x,P,N,null)}}let w=E.children;for(let P=0,I=w.length;P<I;P++)y(w[P],C,x,A,L)}function b(E){E.target.removeEventListener("dispose",b);for(let x in c){let A=c[x],L=E.target.uuid;L in A&&(A[L].dispose(),delete A[L])}}}function Mv(s,t){function e(){let z=!1,xt=new _e,it=null,yt=new _e(0,0,0,0);return{setMask:function(Et){it!==Et&&!z&&(s.colorMask(Et,Et,Et,Et),it=Et)},setLocked:function(Et){z=Et},setClear:function(Et,lt,Wt,Ot,xe){xe===!0&&(Et*=Ot,lt*=Ot,Wt*=Ot),xt.set(Et,lt,Wt,Ot),yt.equals(xt)===!1&&(s.clearColor(Et,lt,Wt,Ot),yt.copy(xt))},reset:function(){z=!1,it=null,yt.set(-1,0,0,0)}}}function i(){let z=!1,xt=!1,it=null,yt=null,Et=null;return{setReversed:function(lt){if(xt!==lt){let Wt=t.get("EXT_clip_control");lt?Wt.clipControlEXT(Wt.LOWER_LEFT_EXT,Wt.ZERO_TO_ONE_EXT):Wt.clipControlEXT(Wt.LOWER_LEFT_EXT,Wt.NEGATIVE_ONE_TO_ONE_EXT),xt=lt;let Ot=Et;Et=null,this.setClear(Ot)}},getReversed:function(){return xt},setTest:function(lt){lt?j(s.DEPTH_TEST):ut(s.DEPTH_TEST)},setMask:function(lt){it!==lt&&!z&&(s.depthMask(lt),it=lt)},setFunc:function(lt){if(xt&&(lt=$u[lt]),yt!==lt){switch(lt){case Vo:s.depthFunc(s.NEVER);break;case Ho:s.depthFunc(s.ALWAYS);break;case Go:s.depthFunc(s.LESS);break;case _s:s.depthFunc(s.LEQUAL);break;case Wo:s.depthFunc(s.EQUAL);break;case Xo:s.depthFunc(s.GEQUAL);break;case qo:s.depthFunc(s.GREATER);break;case Yo:s.depthFunc(s.NOTEQUAL);break;default:s.depthFunc(s.LEQUAL)}yt=lt}},setLocked:function(lt){z=lt},setClear:function(lt){Et!==lt&&(Et=lt,xt&&(lt=1-lt),s.clearDepth(lt))},reset:function(){z=!1,it=null,yt=null,Et=null,xt=!1}}}function n(){let z=!1,xt=null,it=null,yt=null,Et=null,lt=null,Wt=null,Ot=null,xe=null;return{setTest:function(he){z||(he?j(s.STENCIL_TEST):ut(s.STENCIL_TEST))},setMask:function(he){xt!==he&&!z&&(s.stencilMask(he),xt=he)},setFunc:function(he,xi,Di){(it!==he||yt!==xi||Et!==Di)&&(s.stencilFunc(he,xi,Di),it=he,yt=xi,Et=Di)},setOp:function(he,xi,Di){(lt!==he||Wt!==xi||Ot!==Di)&&(s.stencilOp(he,xi,Di),lt=he,Wt=xi,Ot=Di)},setLocked:function(he){z=he},setClear:function(he){xe!==he&&(s.clearStencil(he),xe=he)},reset:function(){z=!1,xt=null,it=null,yt=null,Et=null,lt=null,Wt=null,Ot=null,xe=null}}}let r=new e,o=new i,a=new n,l=new WeakMap,c=new WeakMap,h={},f={},u={},d=new WeakMap,m=[],_=null,p=!1,g=null,M=null,T=null,y=null,b=null,E=null,C=null,x=new Vt(0,0,0),A=0,L=!1,U=null,w=null,P=null,I=null,N=null,B=s.getParameter(s.MAX_COMBINED_TEXTURE_IMAGE_UNITS),O=!1,G=0,V=s.getParameter(s.VERSION);V.indexOf("WebGL")!==-1?(G=parseFloat(/^WebGL (\d)/.exec(V)[1]),O=G>=1):V.indexOf("OpenGL ES")!==-1&&(G=parseFloat(/^OpenGL ES (\d)/.exec(V)[1]),O=G>=2);let W=null,$={},dt=s.getParameter(s.SCISSOR_BOX),mt=s.getParameter(s.VIEWPORT),Ct=new _e().fromArray(dt),wt=new _e().fromArray(mt);function Ht(z,xt,it,yt){let Et=new Uint8Array(4),lt=s.createTexture();s.bindTexture(z,lt),s.texParameteri(z,s.TEXTURE_MIN_FILTER,s.NEAREST),s.texParameteri(z,s.TEXTURE_MAG_FILTER,s.NEAREST);for(let Wt=0;Wt<it;Wt++)z===s.TEXTURE_3D||z===s.TEXTURE_2D_ARRAY?s.texImage3D(xt,0,s.RGBA,1,1,yt,0,s.RGBA,s.UNSIGNED_BYTE,Et):s.texImage2D(xt+Wt,0,s.RGBA,1,1,0,s.RGBA,s.UNSIGNED_BYTE,Et);return lt}let Z={};Z[s.TEXTURE_2D]=Ht(s.TEXTURE_2D,s.TEXTURE_2D,1),Z[s.TEXTURE_CUBE_MAP]=Ht(s.TEXTURE_CUBE_MAP,s.TEXTURE_CUBE_MAP_POSITIVE_X,6),Z[s.TEXTURE_2D_ARRAY]=Ht(s.TEXTURE_2D_ARRAY,s.TEXTURE_2D_ARRAY,1,1),Z[s.TEXTURE_3D]=Ht(s.TEXTURE_3D,s.TEXTURE_3D,1,1),r.setClear(0,0,0,1),o.setClear(1),a.setClear(0),j(s.DEPTH_TEST),o.setFunc(_s),ot(!1),ct(Tc),j(s.CULL_FACE),at(Ae);function j(z){h[z]!==!0&&(s.enable(z),h[z]=!0)}function ut(z){h[z]!==!1&&(s.disable(z),h[z]=!1)}function It(z,xt){return u[z]!==xt?(s.bindFramebuffer(z,xt),u[z]=xt,z===s.DRAW_FRAMEBUFFER&&(u[s.FRAMEBUFFER]=xt),z===s.FRAMEBUFFER&&(u[s.DRAW_FRAMEBUFFER]=xt),!0):!1}function vt(z,xt){let it=m,yt=!1;if(z){it=d.get(xt),it===void 0&&(it=[],d.set(xt,it));let Et=z.textures;if(it.length!==Et.length||it[0]!==s.COLOR_ATTACHMENT0){for(let lt=0,Wt=Et.length;lt<Wt;lt++)it[lt]=s.COLOR_ATTACHMENT0+lt;it.length=Et.length,yt=!0}}else it[0]!==s.BACK&&(it[0]=s.BACK,yt=!0);yt&&s.drawBuffers(it)}function Bt(z){return _!==z?(s.useProgram(z),_=z,!0):!1}let ie={[_i]:s.FUNC_ADD,[yu]:s.FUNC_SUBTRACT,[Mu]:s.FUNC_REVERSE_SUBTRACT};ie[bu]=s.MIN,ie[Su]=s.MAX;let et={[qn]:s.ZERO,[wu]:s.ONE,[Eu]:s.SRC_COLOR,[Rc]:s.SRC_ALPHA,[Ru]:s.SRC_ALPHA_SATURATE,[Or]:s.DST_COLOR,[Fr]:s.DST_ALPHA,[Tu]:s.ONE_MINUS_SRC_COLOR,[Pc]:s.ONE_MINUS_SRC_ALPHA,[Cu]:s.ONE_MINUS_DST_COLOR,[Au]:s.ONE_MINUS_DST_ALPHA,[Pu]:s.CONSTANT_COLOR,[Iu]:s.ONE_MINUS_CONSTANT_COLOR,[Lu]:s.CONSTANT_ALPHA,[Du]:s.ONE_MINUS_CONSTANT_ALPHA};function at(z,xt,it,yt,Et,lt,Wt,Ot,xe,he){if(z===Ae){p===!0&&(ut(s.BLEND),p=!1);return}if(p===!1&&(j(s.BLEND),p=!0),z!==Ma){if(z!==g||he!==L){if((M!==_i||b!==_i)&&(s.blendEquation(s.FUNC_ADD),M=_i,b=_i),he)switch(z){case Ns:s.blendFuncSeparate(s.ONE,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case Xn:s.blendFunc(s.ONE,s.ONE);break;case Ac:s.blendFuncSeparate(s.ZERO,s.ONE_MINUS_SRC_COLOR,s.ZERO,s.ONE);break;case Cc:s.blendFuncSeparate(s.DST_COLOR,s.ONE_MINUS_SRC_ALPHA,s.ZERO,s.ONE);break;default:qt("WebGLState: Invalid blending: ",z);break}else switch(z){case Ns:s.blendFuncSeparate(s.SRC_ALPHA,s.ONE_MINUS_SRC_ALPHA,s.ONE,s.ONE_MINUS_SRC_ALPHA);break;case Xn:s.blendFuncSeparate(s.SRC_ALPHA,s.ONE,s.ONE,s.ONE);break;case Ac:qt("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Cc:qt("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:qt("WebGLState: Invalid blending: ",z);break}T=null,y=null,E=null,C=null,x.set(0,0,0),A=0,g=z,L=he}return}Et=Et||xt,lt=lt||it,Wt=Wt||yt,(xt!==M||Et!==b)&&(s.blendEquationSeparate(ie[xt],ie[Et]),M=xt,b=Et),(it!==T||yt!==y||lt!==E||Wt!==C)&&(s.blendFuncSeparate(et[it],et[yt],et[lt],et[Wt]),T=it,y=yt,E=lt,C=Wt),(Ot.equals(x)===!1||xe!==A)&&(s.blendColor(Ot.r,Ot.g,Ot.b,xe),x.copy(Ot),A=xe),g=z,L=!1}function st(z,xt){z.side===Xe?ut(s.CULL_FACE):j(s.CULL_FACE);let it=z.side===Ne;xt&&(it=!it),ot(it),z.blending===Ns&&z.transparent===!1?at(Ae):at(z.blending,z.blendEquation,z.blendSrc,z.blendDst,z.blendEquationAlpha,z.blendSrcAlpha,z.blendDstAlpha,z.blendColor,z.blendAlpha,z.premultipliedAlpha),o.setFunc(z.depthFunc),o.setTest(z.depthTest),o.setMask(z.depthWrite),r.setMask(z.colorWrite);let yt=z.stencilWrite;a.setTest(yt),yt&&(a.setMask(z.stencilWriteMask),a.setFunc(z.stencilFunc,z.stencilRef,z.stencilFuncMask),a.setOp(z.stencilFail,z.stencilZFail,z.stencilZPass)),Pt(z.polygonOffset,z.polygonOffsetFactor,z.polygonOffsetUnits),z.alphaToCoverage===!0?j(s.SAMPLE_ALPHA_TO_COVERAGE):ut(s.SAMPLE_ALPHA_TO_COVERAGE)}function ot(z){U!==z&&(z?s.frontFace(s.CW):s.frontFace(s.CCW),U=z)}function ct(z){z!==_u?(j(s.CULL_FACE),z!==w&&(z===Tc?s.cullFace(s.BACK):z===vu?s.cullFace(s.FRONT):s.cullFace(s.FRONT_AND_BACK))):ut(s.CULL_FACE),w=z}function Ft(z){z!==P&&(O&&s.lineWidth(z),P=z)}function Pt(z,xt,it){z?(j(s.POLYGON_OFFSET_FILL),(I!==xt||N!==it)&&(I=xt,N=it,o.getReversed()&&(xt=-xt),s.polygonOffset(xt,it))):ut(s.POLYGON_OFFSET_FILL)}function Dt(z){z?j(s.SCISSOR_TEST):ut(s.SCISSOR_TEST)}function Xt(z){z===void 0&&(z=s.TEXTURE0+B-1),W!==z&&(s.activeTexture(z),W=z)}function F(z,xt,it){it===void 0&&(W===null?it=s.TEXTURE0+B-1:it=W);let yt=$[it];yt===void 0&&(yt={type:void 0,texture:void 0},$[it]=yt),(yt.type!==z||yt.texture!==xt)&&(W!==it&&(s.activeTexture(it),W=it),s.bindTexture(z,xt||Z[z]),yt.type=z,yt.texture=xt)}function se(){let z=$[W];z!==void 0&&z.type!==void 0&&(s.bindTexture(z.type,null),z.type=void 0,z.texture=void 0)}function Jt(){try{s.compressedTexImage2D(...arguments)}catch(z){qt("WebGLState:",z)}}function R(){try{s.compressedTexImage3D(...arguments)}catch(z){qt("WebGLState:",z)}}function v(){try{s.texSubImage2D(...arguments)}catch(z){qt("WebGLState:",z)}}function H(){try{s.texSubImage3D(...arguments)}catch(z){qt("WebGLState:",z)}}function X(){try{s.compressedTexSubImage2D(...arguments)}catch(z){qt("WebGLState:",z)}}function K(){try{s.compressedTexSubImage3D(...arguments)}catch(z){qt("WebGLState:",z)}}function ht(){try{s.texStorage2D(...arguments)}catch(z){qt("WebGLState:",z)}}function ft(){try{s.texStorage3D(...arguments)}catch(z){qt("WebGLState:",z)}}function Q(){try{s.texImage2D(...arguments)}catch(z){qt("WebGLState:",z)}}function nt(){try{s.texImage3D(...arguments)}catch(z){qt("WebGLState:",z)}}function _t(z){return f[z]!==void 0?f[z]:s.getParameter(z)}function kt(z,xt){f[z]!==xt&&(s.pixelStorei(z,xt),f[z]=xt)}function gt(z){Ct.equals(z)===!1&&(s.scissor(z.x,z.y,z.z,z.w),Ct.copy(z))}function pt(z){wt.equals(z)===!1&&(s.viewport(z.x,z.y,z.z,z.w),wt.copy(z))}function Lt(z,xt){let it=c.get(xt);it===void 0&&(it=new WeakMap,c.set(xt,it));let yt=it.get(z);yt===void 0&&(yt=s.getUniformBlockIndex(xt,z.name),it.set(z,yt))}function Gt(z,xt){let yt=c.get(xt).get(z);l.get(xt)!==yt&&(s.uniformBlockBinding(xt,yt,z.__bindingPointIndex),l.set(xt,yt))}function $t(){s.disable(s.BLEND),s.disable(s.CULL_FACE),s.disable(s.DEPTH_TEST),s.disable(s.POLYGON_OFFSET_FILL),s.disable(s.SCISSOR_TEST),s.disable(s.STENCIL_TEST),s.disable(s.SAMPLE_ALPHA_TO_COVERAGE),s.blendEquation(s.FUNC_ADD),s.blendFunc(s.ONE,s.ZERO),s.blendFuncSeparate(s.ONE,s.ZERO,s.ONE,s.ZERO),s.blendColor(0,0,0,0),s.colorMask(!0,!0,!0,!0),s.clearColor(0,0,0,0),s.depthMask(!0),s.depthFunc(s.LESS),o.setReversed(!1),s.clearDepth(1),s.stencilMask(4294967295),s.stencilFunc(s.ALWAYS,0,4294967295),s.stencilOp(s.KEEP,s.KEEP,s.KEEP),s.clearStencil(0),s.cullFace(s.BACK),s.frontFace(s.CCW),s.polygonOffset(0,0),s.activeTexture(s.TEXTURE0),s.bindFramebuffer(s.FRAMEBUFFER,null),s.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),s.bindFramebuffer(s.READ_FRAMEBUFFER,null),s.useProgram(null),s.lineWidth(1),s.scissor(0,0,s.canvas.width,s.canvas.height),s.viewport(0,0,s.canvas.width,s.canvas.height),s.pixelStorei(s.PACK_ALIGNMENT,4),s.pixelStorei(s.UNPACK_ALIGNMENT,4),s.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,!1),s.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),s.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,s.BROWSER_DEFAULT_WEBGL),s.pixelStorei(s.PACK_ROW_LENGTH,0),s.pixelStorei(s.PACK_SKIP_PIXELS,0),s.pixelStorei(s.PACK_SKIP_ROWS,0),s.pixelStorei(s.UNPACK_ROW_LENGTH,0),s.pixelStorei(s.UNPACK_IMAGE_HEIGHT,0),s.pixelStorei(s.UNPACK_SKIP_PIXELS,0),s.pixelStorei(s.UNPACK_SKIP_ROWS,0),s.pixelStorei(s.UNPACK_SKIP_IMAGES,0),h={},f={},W=null,$={},u={},d=new WeakMap,m=[],_=null,p=!1,g=null,M=null,T=null,y=null,b=null,E=null,C=null,x=new Vt(0,0,0),A=0,L=!1,U=null,w=null,P=null,I=null,N=null,Ct.set(0,0,s.canvas.width,s.canvas.height),wt.set(0,0,s.canvas.width,s.canvas.height),r.reset(),o.reset(),a.reset()}return{buffers:{color:r,depth:o,stencil:a},enable:j,disable:ut,bindFramebuffer:It,drawBuffers:vt,useProgram:Bt,setBlending:at,setMaterial:st,setFlipSided:ot,setCullFace:ct,setLineWidth:Ft,setPolygonOffset:Pt,setScissorTest:Dt,activeTexture:Xt,bindTexture:F,unbindTexture:se,compressedTexImage2D:Jt,compressedTexImage3D:R,texImage2D:Q,texImage3D:nt,pixelStorei:kt,getParameter:_t,updateUBOMapping:Lt,uniformBlockBinding:Gt,texStorage2D:ht,texStorage3D:ft,texSubImage2D:v,texSubImage3D:H,compressedTexSubImage2D:X,compressedTexSubImage3D:K,scissor:gt,viewport:pt,reset:$t}}function bv(s,t,e,i,n,r,o){let a=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new tt,h=new WeakMap,f=new Set,u,d=new WeakMap,m=!1;try{m=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function _(R,v){return m?new OffscreenCanvas(R,v):ar("canvas")}function p(R,v,H){let X=1,K=Jt(R);if((K.width>H||K.height>H)&&(X=H/Math.max(K.width,K.height)),X<1)if(typeof HTMLImageElement<"u"&&R instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&R instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&R instanceof ImageBitmap||typeof VideoFrame<"u"&&R instanceof VideoFrame){let ht=Math.floor(X*K.width),ft=Math.floor(X*K.height);u===void 0&&(u=_(ht,ft));let Q=v?_(ht,ft):u;return Q.width=ht,Q.height=ft,Q.getContext("2d").drawImage(R,0,0,ht,ft),Yt("WebGLRenderer: Texture has been resized from ("+K.width+"x"+K.height+") to ("+ht+"x"+ft+")."),Q}else return"data"in R&&Yt("WebGLRenderer: Image in DataTexture is too big ("+K.width+"x"+K.height+")."),R;return R}function g(R){return R.generateMipmaps}function M(R){s.generateMipmap(R)}function T(R){return R.isWebGLCubeRenderTarget?s.TEXTURE_CUBE_MAP:R.isWebGL3DRenderTarget?s.TEXTURE_3D:R.isWebGLArrayRenderTarget||R.isCompressedArrayTexture?s.TEXTURE_2D_ARRAY:s.TEXTURE_2D}function y(R,v,H,X,K,ht=!1){if(R!==null){if(s[R]!==void 0)return s[R];Yt("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+R+"'")}let ft;X&&(ft=t.get("EXT_texture_norm16"),ft||Yt("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let Q=v;if(v===s.RED&&(H===s.FLOAT&&(Q=s.R32F),H===s.HALF_FLOAT&&(Q=s.R16F),H===s.UNSIGNED_BYTE&&(Q=s.R8),H===s.UNSIGNED_SHORT&&ft&&(Q=ft.R16_EXT),H===s.SHORT&&ft&&(Q=ft.R16_SNORM_EXT)),v===s.RED_INTEGER&&(H===s.UNSIGNED_BYTE&&(Q=s.R8UI),H===s.UNSIGNED_SHORT&&(Q=s.R16UI),H===s.UNSIGNED_INT&&(Q=s.R32UI),H===s.BYTE&&(Q=s.R8I),H===s.SHORT&&(Q=s.R16I),H===s.INT&&(Q=s.R32I)),v===s.RG&&(H===s.FLOAT&&(Q=s.RG32F),H===s.HALF_FLOAT&&(Q=s.RG16F),H===s.UNSIGNED_BYTE&&(Q=s.RG8),H===s.UNSIGNED_SHORT&&ft&&(Q=ft.RG16_EXT),H===s.SHORT&&ft&&(Q=ft.RG16_SNORM_EXT)),v===s.RG_INTEGER&&(H===s.UNSIGNED_BYTE&&(Q=s.RG8UI),H===s.UNSIGNED_SHORT&&(Q=s.RG16UI),H===s.UNSIGNED_INT&&(Q=s.RG32UI),H===s.BYTE&&(Q=s.RG8I),H===s.SHORT&&(Q=s.RG16I),H===s.INT&&(Q=s.RG32I)),v===s.RGB_INTEGER&&(H===s.UNSIGNED_BYTE&&(Q=s.RGB8UI),H===s.UNSIGNED_SHORT&&(Q=s.RGB16UI),H===s.UNSIGNED_INT&&(Q=s.RGB32UI),H===s.BYTE&&(Q=s.RGB8I),H===s.SHORT&&(Q=s.RGB16I),H===s.INT&&(Q=s.RGB32I)),v===s.RGBA_INTEGER&&(H===s.UNSIGNED_BYTE&&(Q=s.RGBA8UI),H===s.UNSIGNED_SHORT&&(Q=s.RGBA16UI),H===s.UNSIGNED_INT&&(Q=s.RGBA32UI),H===s.BYTE&&(Q=s.RGBA8I),H===s.SHORT&&(Q=s.RGBA16I),H===s.INT&&(Q=s.RGBA32I)),v===s.RGB&&(H===s.UNSIGNED_SHORT&&ft&&(Q=ft.RGB16_EXT),H===s.SHORT&&ft&&(Q=ft.RGB16_SNORM_EXT),H===s.UNSIGNED_INT_5_9_9_9_REV&&(Q=s.RGB9_E5),H===s.UNSIGNED_INT_10F_11F_11F_REV&&(Q=s.R11F_G11F_B10F)),v===s.RGBA){let nt=ht?or:ne.getTransfer(K);H===s.FLOAT&&(Q=s.RGBA32F),H===s.HALF_FLOAT&&(Q=s.RGBA16F),H===s.UNSIGNED_BYTE&&(Q=nt===le?s.SRGB8_ALPHA8:s.RGBA8),H===s.UNSIGNED_SHORT&&ft&&(Q=ft.RGBA16_EXT),H===s.SHORT&&ft&&(Q=ft.RGBA16_SNORM_EXT),H===s.UNSIGNED_SHORT_4_4_4_4&&(Q=s.RGBA4),H===s.UNSIGNED_SHORT_5_5_5_1&&(Q=s.RGB5_A1)}return(Q===s.R16F||Q===s.R32F||Q===s.RG16F||Q===s.RG32F||Q===s.RGBA16F||Q===s.RGBA32F)&&t.get("EXT_color_buffer_float"),Q}function b(R,v){let H;return R?v===null||v===Ci||v===Cn?H=s.DEPTH24_STENCIL8:v===Ri?H=s.DEPTH32F_STENCIL8:v===Us&&(H=s.DEPTH24_STENCIL8,Yt("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):v===null||v===Ci||v===Cn?H=s.DEPTH_COMPONENT24:v===Ri?H=s.DEPTH_COMPONENT32F:v===Us&&(H=s.DEPTH_COMPONENT16),H}function E(R,v){return g(R)===!0||R.isFramebufferTexture&&R.minFilter!==Te&&R.minFilter!==He?Math.log2(Math.max(v.width,v.height))+1:R.mipmaps!==void 0&&R.mipmaps.length>0?R.mipmaps.length:R.isCompressedTexture&&Array.isArray(R.image)?v.mipmaps.length:1}function C(R){let v=R.target;v.removeEventListener("dispose",C),A(v),v.isVideoTexture&&h.delete(v),v.isHTMLTexture&&f.delete(v)}function x(R){let v=R.target;v.removeEventListener("dispose",x),U(v)}function A(R){let v=i.get(R);if(v.__webglInit===void 0)return;let H=R.source,X=d.get(H);if(X){let K=X[v.__cacheKey];K.usedTimes--,K.usedTimes===0&&L(R),Object.keys(X).length===0&&d.delete(H)}i.remove(R)}function L(R){let v=i.get(R);s.deleteTexture(v.__webglTexture);let H=R.source,X=d.get(H);delete X[v.__cacheKey],o.memory.textures--}function U(R){let v=i.get(R);if(R.depthTexture&&(R.depthTexture.dispose(),i.remove(R.depthTexture)),R.isWebGLCubeRenderTarget)for(let X=0;X<6;X++){if(Array.isArray(v.__webglFramebuffer[X]))for(let K=0;K<v.__webglFramebuffer[X].length;K++)s.deleteFramebuffer(v.__webglFramebuffer[X][K]);else s.deleteFramebuffer(v.__webglFramebuffer[X]);v.__webglDepthbuffer&&s.deleteRenderbuffer(v.__webglDepthbuffer[X])}else{if(Array.isArray(v.__webglFramebuffer))for(let X=0;X<v.__webglFramebuffer.length;X++)s.deleteFramebuffer(v.__webglFramebuffer[X]);else s.deleteFramebuffer(v.__webglFramebuffer);if(v.__webglDepthbuffer&&s.deleteRenderbuffer(v.__webglDepthbuffer),v.__webglMultisampledFramebuffer&&s.deleteFramebuffer(v.__webglMultisampledFramebuffer),v.__webglColorRenderbuffer)for(let X=0;X<v.__webglColorRenderbuffer.length;X++)v.__webglColorRenderbuffer[X]&&s.deleteRenderbuffer(v.__webglColorRenderbuffer[X]);v.__webglDepthRenderbuffer&&s.deleteRenderbuffer(v.__webglDepthRenderbuffer)}let H=R.textures;for(let X=0,K=H.length;X<K;X++){let ht=i.get(H[X]);ht.__webglTexture&&(s.deleteTexture(ht.__webglTexture),o.memory.textures--),i.remove(H[X])}i.remove(R)}let w=0;function P(){w=0}function I(){return w}function N(R){w=R}function B(){let R=w;return R>=n.maxTextures&&Yt("WebGLTextures: Trying to use "+(R+1)+" texture units while this GPU supports only "+n.maxTextures),w+=1,R}function O(R){let v=[];return v.push(R.wrapS),v.push(R.wrapT),v.push(R.wrapR||0),v.push(R.magFilter),v.push(R.minFilter),v.push(R.anisotropy),v.push(R.internalFormat),v.push(R.format),v.push(R.type),v.push(R.generateMipmaps),v.push(R.premultiplyAlpha),v.push(R.flipY),v.push(R.unpackAlignment),v.push(R.colorSpace),v.join()}function G(R,v){let H=i.get(R);if(R.isVideoTexture&&F(R),R.isRenderTargetTexture===!1&&R.isExternalTexture!==!0&&R.version>0&&H.__version!==R.version){let X=R.image;if(X===null)Yt("WebGLRenderer: Texture marked for update but no image data found.");else if(X.complete===!1)Yt("WebGLRenderer: Texture marked for update but image is incomplete");else{ut(H,R,v);return}}else R.isExternalTexture&&(H.__webglTexture=R.sourceTexture?R.sourceTexture:null);e.bindTexture(s.TEXTURE_2D,H.__webglTexture,s.TEXTURE0+v)}function V(R,v){let H=i.get(R);if(R.isRenderTargetTexture===!1&&R.version>0&&H.__version!==R.version){ut(H,R,v);return}else R.isExternalTexture&&(H.__webglTexture=R.sourceTexture?R.sourceTexture:null);e.bindTexture(s.TEXTURE_2D_ARRAY,H.__webglTexture,s.TEXTURE0+v)}function W(R,v){let H=i.get(R);if(R.isRenderTargetTexture===!1&&R.version>0&&H.__version!==R.version){ut(H,R,v);return}e.bindTexture(s.TEXTURE_3D,H.__webglTexture,s.TEXTURE0+v)}function $(R,v){let H=i.get(R);if(R.isCubeDepthTexture!==!0&&R.version>0&&H.__version!==R.version){It(H,R,v);return}e.bindTexture(s.TEXTURE_CUBE_MAP,H.__webglTexture,s.TEXTURE0+v)}let dt={[gi]:s.REPEAT,[Fi]:s.CLAMP_TO_EDGE,[Zo]:s.MIRRORED_REPEAT},mt={[Te]:s.NEAREST,[Fu]:s.NEAREST_MIPMAP_NEAREST,[Xr]:s.NEAREST_MIPMAP_LINEAR,[He]:s.LINEAR,[Ea]:s.LINEAR_MIPMAP_NEAREST,[An]:s.LINEAR_MIPMAP_LINEAR},Ct={[zu]:s.NEVER,[Xu]:s.ALWAYS,[Vu]:s.LESS,[ll]:s.LEQUAL,[Hu]:s.EQUAL,[cl]:s.GEQUAL,[Gu]:s.GREATER,[Wu]:s.NOTEQUAL};function wt(R,v){if(v.type===Ri&&t.has("OES_texture_float_linear")===!1&&(v.magFilter===He||v.magFilter===Ea||v.magFilter===Xr||v.magFilter===An||v.minFilter===He||v.minFilter===Ea||v.minFilter===Xr||v.minFilter===An)&&Yt("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),s.texParameteri(R,s.TEXTURE_WRAP_S,dt[v.wrapS]),s.texParameteri(R,s.TEXTURE_WRAP_T,dt[v.wrapT]),(R===s.TEXTURE_3D||R===s.TEXTURE_2D_ARRAY)&&s.texParameteri(R,s.TEXTURE_WRAP_R,dt[v.wrapR]),s.texParameteri(R,s.TEXTURE_MAG_FILTER,mt[v.magFilter]),s.texParameteri(R,s.TEXTURE_MIN_FILTER,mt[v.minFilter]),v.compareFunction&&(s.texParameteri(R,s.TEXTURE_COMPARE_MODE,s.COMPARE_REF_TO_TEXTURE),s.texParameteri(R,s.TEXTURE_COMPARE_FUNC,Ct[v.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(v.magFilter===Te||v.minFilter!==Xr&&v.minFilter!==An||v.type===Ri&&t.has("OES_texture_float_linear")===!1)return;if(v.anisotropy>1||i.get(v).__currentAnisotropy){let H=t.get("EXT_texture_filter_anisotropic");s.texParameterf(R,H.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(v.anisotropy,n.getMaxAnisotropy())),i.get(v).__currentAnisotropy=v.anisotropy}}}function Ht(R,v){let H=!1;R.__webglInit===void 0&&(R.__webglInit=!0,v.addEventListener("dispose",C));let X=v.source,K=d.get(X);K===void 0&&(K={},d.set(X,K));let ht=O(v);if(ht!==R.__cacheKey){K[ht]===void 0&&(K[ht]={texture:s.createTexture(),usedTimes:0},o.memory.textures++,H=!0),K[ht].usedTimes++;let ft=K[R.__cacheKey];ft!==void 0&&(K[R.__cacheKey].usedTimes--,ft.usedTimes===0&&L(v)),R.__cacheKey=ht,R.__webglTexture=K[ht].texture}return H}function Z(R,v,H){return Math.floor(Math.floor(R/H)/v)}function j(R,v,H,X){let ht=R.updateRanges;if(ht.length===0)e.texSubImage2D(s.TEXTURE_2D,0,0,0,v.width,v.height,H,X,v.data);else{ht.sort((kt,gt)=>kt.start-gt.start);let ft=0;for(let kt=1;kt<ht.length;kt++){let gt=ht[ft],pt=ht[kt],Lt=gt.start+gt.count,Gt=Z(pt.start,v.width,4),$t=Z(gt.start,v.width,4);pt.start<=Lt+1&&Gt===$t&&Z(pt.start+pt.count-1,v.width,4)===Gt?gt.count=Math.max(gt.count,pt.start+pt.count-gt.start):(++ft,ht[ft]=pt)}ht.length=ft+1;let Q=e.getParameter(s.UNPACK_ROW_LENGTH),nt=e.getParameter(s.UNPACK_SKIP_PIXELS),_t=e.getParameter(s.UNPACK_SKIP_ROWS);e.pixelStorei(s.UNPACK_ROW_LENGTH,v.width);for(let kt=0,gt=ht.length;kt<gt;kt++){let pt=ht[kt],Lt=Math.floor(pt.start/4),Gt=Math.ceil(pt.count/4),$t=Lt%v.width,z=Math.floor(Lt/v.width),xt=Gt,it=1;e.pixelStorei(s.UNPACK_SKIP_PIXELS,$t),e.pixelStorei(s.UNPACK_SKIP_ROWS,z),e.texSubImage2D(s.TEXTURE_2D,0,$t,z,xt,it,H,X,v.data)}R.clearUpdateRanges(),e.pixelStorei(s.UNPACK_ROW_LENGTH,Q),e.pixelStorei(s.UNPACK_SKIP_PIXELS,nt),e.pixelStorei(s.UNPACK_SKIP_ROWS,_t)}}function ut(R,v,H){let X=s.TEXTURE_2D;(v.isDataArrayTexture||v.isCompressedArrayTexture)&&(X=s.TEXTURE_2D_ARRAY),v.isData3DTexture&&(X=s.TEXTURE_3D);let K=Ht(R,v),ht=v.source;e.bindTexture(X,R.__webglTexture,s.TEXTURE0+H);let ft=i.get(ht);if(ht.version!==ft.__version||K===!0){if(e.activeTexture(s.TEXTURE0+H),(typeof ImageBitmap<"u"&&v.image instanceof ImageBitmap)===!1){let it=ne.getPrimaries(ne.workingColorSpace),yt=v.colorSpace===Pi?null:ne.getPrimaries(v.colorSpace),Et=v.colorSpace===Pi||it===yt?s.NONE:s.BROWSER_DEFAULT_WEBGL;e.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,v.flipY),e.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,v.premultiplyAlpha),e.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,Et)}e.pixelStorei(s.UNPACK_ALIGNMENT,v.unpackAlignment);let nt=p(v.image,!1,n.maxTextureSize);nt=se(v,nt);let _t=r.convert(v.format,v.colorSpace),kt=r.convert(v.type),gt=y(v.internalFormat,_t,kt,v.normalized,v.colorSpace,v.isVideoTexture);wt(X,v);let pt,Lt=v.mipmaps,Gt=v.isVideoTexture!==!0,$t=ft.__version===void 0||K===!0,z=ht.dataReady,xt=E(v,nt);if(v.isDepthTexture)gt=b(v.format===Hi,v.type),$t&&(Gt?e.texStorage2D(s.TEXTURE_2D,1,gt,nt.width,nt.height):e.texImage2D(s.TEXTURE_2D,0,gt,nt.width,nt.height,0,_t,kt,null));else if(v.isDataTexture)if(Lt.length>0){Gt&&$t&&e.texStorage2D(s.TEXTURE_2D,xt,gt,Lt[0].width,Lt[0].height);for(let it=0,yt=Lt.length;it<yt;it++)pt=Lt[it],Gt?z&&e.texSubImage2D(s.TEXTURE_2D,it,0,0,pt.width,pt.height,_t,kt,pt.data):e.texImage2D(s.TEXTURE_2D,it,gt,pt.width,pt.height,0,_t,kt,pt.data);v.generateMipmaps=!1}else Gt?($t&&e.texStorage2D(s.TEXTURE_2D,xt,gt,nt.width,nt.height),z&&j(v,nt,_t,kt)):e.texImage2D(s.TEXTURE_2D,0,gt,nt.width,nt.height,0,_t,kt,nt.data);else if(v.isCompressedTexture)if(v.isCompressedArrayTexture){Gt&&$t&&e.texStorage3D(s.TEXTURE_2D_ARRAY,xt,gt,Lt[0].width,Lt[0].height,nt.depth);for(let it=0,yt=Lt.length;it<yt;it++)if(pt=Lt[it],v.format!==ri)if(_t!==null)if(Gt){if(z)if(v.layerUpdates.size>0){let Et=Yc(pt.width,pt.height,v.format,v.type);for(let lt of v.layerUpdates){let Wt=pt.data.subarray(lt*Et/pt.data.BYTES_PER_ELEMENT,(lt+1)*Et/pt.data.BYTES_PER_ELEMENT);e.compressedTexSubImage3D(s.TEXTURE_2D_ARRAY,it,0,0,lt,pt.width,pt.height,1,_t,Wt)}}else e.compressedTexSubImage3D(s.TEXTURE_2D_ARRAY,it,0,0,0,pt.width,pt.height,nt.depth,_t,pt.data)}else e.compressedTexImage3D(s.TEXTURE_2D_ARRAY,it,gt,pt.width,pt.height,nt.depth,0,pt.data,0,0);else Yt("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Gt?z&&e.texSubImage3D(s.TEXTURE_2D_ARRAY,it,0,0,0,pt.width,pt.height,nt.depth,_t,kt,pt.data):e.texImage3D(s.TEXTURE_2D_ARRAY,it,gt,pt.width,pt.height,nt.depth,0,_t,kt,pt.data);v.layerUpdates.size>0&&v.clearLayerUpdates()}else{Gt&&$t&&e.texStorage2D(s.TEXTURE_2D,xt,gt,Lt[0].width,Lt[0].height);for(let it=0,yt=Lt.length;it<yt;it++)pt=Lt[it],v.format!==ri?_t!==null?Gt?z&&e.compressedTexSubImage2D(s.TEXTURE_2D,it,0,0,pt.width,pt.height,_t,pt.data):e.compressedTexImage2D(s.TEXTURE_2D,it,gt,pt.width,pt.height,0,pt.data):Yt("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Gt?z&&e.texSubImage2D(s.TEXTURE_2D,it,0,0,pt.width,pt.height,_t,kt,pt.data):e.texImage2D(s.TEXTURE_2D,it,gt,pt.width,pt.height,0,_t,kt,pt.data)}else if(v.isDataArrayTexture)if(Gt){if($t&&e.texStorage3D(s.TEXTURE_2D_ARRAY,xt,gt,nt.width,nt.height,nt.depth),z)if(v.layerUpdates.size>0){let it=Yc(nt.width,nt.height,v.format,v.type);for(let yt of v.layerUpdates){let Et=nt.data.subarray(yt*it/nt.data.BYTES_PER_ELEMENT,(yt+1)*it/nt.data.BYTES_PER_ELEMENT);e.texSubImage3D(s.TEXTURE_2D_ARRAY,0,0,0,yt,nt.width,nt.height,1,_t,kt,Et)}v.clearLayerUpdates()}else e.texSubImage3D(s.TEXTURE_2D_ARRAY,0,0,0,0,nt.width,nt.height,nt.depth,_t,kt,nt.data)}else e.texImage3D(s.TEXTURE_2D_ARRAY,0,gt,nt.width,nt.height,nt.depth,0,_t,kt,nt.data);else if(v.isData3DTexture)Gt?($t&&e.texStorage3D(s.TEXTURE_3D,xt,gt,nt.width,nt.height,nt.depth),z&&e.texSubImage3D(s.TEXTURE_3D,0,0,0,0,nt.width,nt.height,nt.depth,_t,kt,nt.data)):e.texImage3D(s.TEXTURE_3D,0,gt,nt.width,nt.height,nt.depth,0,_t,kt,nt.data);else if(v.isFramebufferTexture){if($t)if(Gt)e.texStorage2D(s.TEXTURE_2D,xt,gt,nt.width,nt.height);else{let it=nt.width,yt=nt.height;for(let Et=0;Et<xt;Et++)e.texImage2D(s.TEXTURE_2D,Et,gt,it,yt,0,_t,kt,null),it>>=1,yt>>=1}}else if(v.isHTMLTexture){if("texElementImage2D"in s){let it=s.canvas;if(it.hasAttribute("layoutsubtree")||it.setAttribute("layoutsubtree","true"),nt.parentNode!==it){it.appendChild(nt),f.add(v),it.onpaint=yt=>{let Et=yt.changedElements;for(let lt of f)Et.includes(lt.image)&&(lt.needsUpdate=!0)},it.requestPaint();return}if(s.texElementImage2D.length===3)s.texElementImage2D(s.TEXTURE_2D,s.RGBA8,nt);else{let Et=s.RGBA,lt=s.RGBA,Wt=s.UNSIGNED_BYTE;s.texElementImage2D(s.TEXTURE_2D,0,Et,lt,Wt,nt)}s.texParameteri(s.TEXTURE_2D,s.TEXTURE_MIN_FILTER,s.LINEAR),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_S,s.CLAMP_TO_EDGE),s.texParameteri(s.TEXTURE_2D,s.TEXTURE_WRAP_T,s.CLAMP_TO_EDGE)}}else if(Lt.length>0){if(Gt&&$t){let it=Jt(Lt[0]);e.texStorage2D(s.TEXTURE_2D,xt,gt,it.width,it.height)}for(let it=0,yt=Lt.length;it<yt;it++)pt=Lt[it],Gt?z&&e.texSubImage2D(s.TEXTURE_2D,it,0,0,_t,kt,pt):e.texImage2D(s.TEXTURE_2D,it,gt,_t,kt,pt);v.generateMipmaps=!1}else if(Gt){if($t){let it=Jt(nt);e.texStorage2D(s.TEXTURE_2D,xt,gt,it.width,it.height)}z&&e.texSubImage2D(s.TEXTURE_2D,0,0,0,_t,kt,nt)}else e.texImage2D(s.TEXTURE_2D,0,gt,_t,kt,nt);g(v)&&M(X),ft.__version=ht.version,v.onUpdate&&v.onUpdate(v)}R.__version=v.version}function It(R,v,H){if(v.image.length!==6)return;let X=Ht(R,v),K=v.source;e.bindTexture(s.TEXTURE_CUBE_MAP,R.__webglTexture,s.TEXTURE0+H);let ht=i.get(K);if(K.version!==ht.__version||X===!0){e.activeTexture(s.TEXTURE0+H);let ft=ne.getPrimaries(ne.workingColorSpace),Q=v.colorSpace===Pi?null:ne.getPrimaries(v.colorSpace),nt=v.colorSpace===Pi||ft===Q?s.NONE:s.BROWSER_DEFAULT_WEBGL;e.pixelStorei(s.UNPACK_FLIP_Y_WEBGL,v.flipY),e.pixelStorei(s.UNPACK_PREMULTIPLY_ALPHA_WEBGL,v.premultiplyAlpha),e.pixelStorei(s.UNPACK_ALIGNMENT,v.unpackAlignment),e.pixelStorei(s.UNPACK_COLORSPACE_CONVERSION_WEBGL,nt);let _t=v.isCompressedTexture||v.image[0].isCompressedTexture,kt=v.image[0]&&v.image[0].isDataTexture,gt=[];for(let lt=0;lt<6;lt++)!_t&&!kt?gt[lt]=p(v.image[lt],!0,n.maxCubemapSize):gt[lt]=kt?v.image[lt].image:v.image[lt],gt[lt]=se(v,gt[lt]);let pt=gt[0],Lt=r.convert(v.format,v.colorSpace),Gt=r.convert(v.type),$t=y(v.internalFormat,Lt,Gt,v.normalized,v.colorSpace),z=v.isVideoTexture!==!0,xt=ht.__version===void 0||X===!0,it=K.dataReady,yt=E(v,pt);wt(s.TEXTURE_CUBE_MAP,v);let Et;if(_t){z&&xt&&e.texStorage2D(s.TEXTURE_CUBE_MAP,yt,$t,pt.width,pt.height);for(let lt=0;lt<6;lt++){Et=gt[lt].mipmaps;for(let Wt=0;Wt<Et.length;Wt++){let Ot=Et[Wt];v.format!==ri?Lt!==null?z?it&&e.compressedTexSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+lt,Wt,0,0,Ot.width,Ot.height,Lt,Ot.data):e.compressedTexImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+lt,Wt,$t,Ot.width,Ot.height,0,Ot.data):Yt("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):z?it&&e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+lt,Wt,0,0,Ot.width,Ot.height,Lt,Gt,Ot.data):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+lt,Wt,$t,Ot.width,Ot.height,0,Lt,Gt,Ot.data)}}}else{if(Et=v.mipmaps,z&&xt){Et.length>0&&yt++;let lt=Jt(gt[0]);e.texStorage2D(s.TEXTURE_CUBE_MAP,yt,$t,lt.width,lt.height)}for(let lt=0;lt<6;lt++)if(kt){z?it&&e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+lt,0,0,0,gt[lt].width,gt[lt].height,Lt,Gt,gt[lt].data):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+lt,0,$t,gt[lt].width,gt[lt].height,0,Lt,Gt,gt[lt].data);for(let Wt=0;Wt<Et.length;Wt++){let xe=Et[Wt].image[lt].image;z?it&&e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+lt,Wt+1,0,0,xe.width,xe.height,Lt,Gt,xe.data):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+lt,Wt+1,$t,xe.width,xe.height,0,Lt,Gt,xe.data)}}else{z?it&&e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+lt,0,0,0,Lt,Gt,gt[lt]):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+lt,0,$t,Lt,Gt,gt[lt]);for(let Wt=0;Wt<Et.length;Wt++){let Ot=Et[Wt];z?it&&e.texSubImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+lt,Wt+1,0,0,Lt,Gt,Ot.image[lt]):e.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+lt,Wt+1,$t,Lt,Gt,Ot.image[lt])}}}g(v)&&M(s.TEXTURE_CUBE_MAP),ht.__version=K.version,v.onUpdate&&v.onUpdate(v)}R.__version=v.version}function vt(R,v,H,X,K,ht){let ft=r.convert(H.format,H.colorSpace),Q=r.convert(H.type),nt=y(H.internalFormat,ft,Q,H.normalized,H.colorSpace),_t=i.get(v),kt=i.get(H);if(kt.__renderTarget=v,!_t.__hasExternalTextures){let gt=Math.max(1,v.width>>ht),pt=Math.max(1,v.height>>ht);K===s.TEXTURE_3D||K===s.TEXTURE_2D_ARRAY?e.texImage3D(K,ht,nt,gt,pt,v.depth,0,ft,Q,null):e.texImage2D(K,ht,nt,gt,pt,0,ft,Q,null)}e.bindFramebuffer(s.FRAMEBUFFER,R),Xt(v)?a.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,X,K,kt.__webglTexture,0,Dt(v)):(K===s.TEXTURE_2D||K>=s.TEXTURE_CUBE_MAP_POSITIVE_X&&K<=s.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&s.framebufferTexture2D(s.FRAMEBUFFER,X,K,kt.__webglTexture,ht),e.bindFramebuffer(s.FRAMEBUFFER,null)}function Bt(R,v,H){if(s.bindRenderbuffer(s.RENDERBUFFER,R),v.depthBuffer){let X=v.depthTexture,K=X&&X.isDepthTexture?X.type:null,ht=b(v.stencilBuffer,K),ft=v.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT;Xt(v)?a.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,Dt(v),ht,v.width,v.height):H?s.renderbufferStorageMultisample(s.RENDERBUFFER,Dt(v),ht,v.width,v.height):s.renderbufferStorage(s.RENDERBUFFER,ht,v.width,v.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,ft,s.RENDERBUFFER,R)}else{let X=v.textures;for(let K=0;K<X.length;K++){let ht=X[K],ft=r.convert(ht.format,ht.colorSpace),Q=r.convert(ht.type),nt=y(ht.internalFormat,ft,Q,ht.normalized,ht.colorSpace);Xt(v)?a.renderbufferStorageMultisampleEXT(s.RENDERBUFFER,Dt(v),nt,v.width,v.height):H?s.renderbufferStorageMultisample(s.RENDERBUFFER,Dt(v),nt,v.width,v.height):s.renderbufferStorage(s.RENDERBUFFER,nt,v.width,v.height)}}s.bindRenderbuffer(s.RENDERBUFFER,null)}function ie(R,v,H){let X=v.isWebGLCubeRenderTarget===!0;if(e.bindFramebuffer(s.FRAMEBUFFER,R),!(v.depthTexture&&v.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");let K=i.get(v.depthTexture);if(K.__renderTarget=v,(!K.__webglTexture||v.depthTexture.image.width!==v.width||v.depthTexture.image.height!==v.height)&&(v.depthTexture.image.width=v.width,v.depthTexture.image.height=v.height,v.depthTexture.needsUpdate=!0),X){if(K.__webglInit===void 0&&(K.__webglInit=!0,v.depthTexture.addEventListener("dispose",C)),K.__webglTexture===void 0){K.__webglTexture=s.createTexture(),e.bindTexture(s.TEXTURE_CUBE_MAP,K.__webglTexture),wt(s.TEXTURE_CUBE_MAP,v.depthTexture);let _t=r.convert(v.depthTexture.format),kt=r.convert(v.depthTexture.type),gt;v.depthTexture.format===ki?gt=s.DEPTH_COMPONENT24:v.depthTexture.format===Hi&&(gt=s.DEPTH24_STENCIL8);for(let pt=0;pt<6;pt++)s.texImage2D(s.TEXTURE_CUBE_MAP_POSITIVE_X+pt,0,gt,v.width,v.height,0,_t,kt,null)}}else G(v.depthTexture,0);let ht=K.__webglTexture,ft=Dt(v),Q=X?s.TEXTURE_CUBE_MAP_POSITIVE_X+H:s.TEXTURE_2D,nt=v.depthTexture.format===Hi?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT;if(v.depthTexture.format===ki)Xt(v)?a.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,nt,Q,ht,0,ft):s.framebufferTexture2D(s.FRAMEBUFFER,nt,Q,ht,0);else if(v.depthTexture.format===Hi)Xt(v)?a.framebufferTexture2DMultisampleEXT(s.FRAMEBUFFER,nt,Q,ht,0,ft):s.framebufferTexture2D(s.FRAMEBUFFER,nt,Q,ht,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function et(R){let v=i.get(R),H=R.isWebGLCubeRenderTarget===!0;if(v.__boundDepthTexture!==R.depthTexture){let X=R.depthTexture;if(v.__depthDisposeCallback&&v.__depthDisposeCallback(),X){let K=()=>{delete v.__boundDepthTexture,delete v.__depthDisposeCallback,X.removeEventListener("dispose",K)};X.addEventListener("dispose",K),v.__depthDisposeCallback=K}v.__boundDepthTexture=X}if(R.depthTexture&&!v.__autoAllocateDepthBuffer)if(H)for(let X=0;X<6;X++)ie(v.__webglFramebuffer[X],R,X);else{let X=R.texture.mipmaps;X&&X.length>0?ie(v.__webglFramebuffer[0],R,0):ie(v.__webglFramebuffer,R,0)}else if(H){v.__webglDepthbuffer=[];for(let X=0;X<6;X++)if(e.bindFramebuffer(s.FRAMEBUFFER,v.__webglFramebuffer[X]),v.__webglDepthbuffer[X]===void 0)v.__webglDepthbuffer[X]=s.createRenderbuffer(),Bt(v.__webglDepthbuffer[X],R,!1);else{let K=R.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,ht=v.__webglDepthbuffer[X];s.bindRenderbuffer(s.RENDERBUFFER,ht),s.framebufferRenderbuffer(s.FRAMEBUFFER,K,s.RENDERBUFFER,ht)}}else{let X=R.texture.mipmaps;if(X&&X.length>0?e.bindFramebuffer(s.FRAMEBUFFER,v.__webglFramebuffer[0]):e.bindFramebuffer(s.FRAMEBUFFER,v.__webglFramebuffer),v.__webglDepthbuffer===void 0)v.__webglDepthbuffer=s.createRenderbuffer(),Bt(v.__webglDepthbuffer,R,!1);else{let K=R.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,ht=v.__webglDepthbuffer;s.bindRenderbuffer(s.RENDERBUFFER,ht),s.framebufferRenderbuffer(s.FRAMEBUFFER,K,s.RENDERBUFFER,ht)}}e.bindFramebuffer(s.FRAMEBUFFER,null)}function at(R,v,H){let X=i.get(R);v!==void 0&&vt(X.__webglFramebuffer,R,R.texture,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,0),H!==void 0&&et(R)}function st(R){let v=R.texture,H=i.get(R),X=i.get(v);R.addEventListener("dispose",x);let K=R.textures,ht=R.isWebGLCubeRenderTarget===!0,ft=K.length>1;if(ft||(X.__webglTexture===void 0&&(X.__webglTexture=s.createTexture()),X.__version=v.version,o.memory.textures++),ht){H.__webglFramebuffer=[];for(let Q=0;Q<6;Q++)if(v.mipmaps&&v.mipmaps.length>0){H.__webglFramebuffer[Q]=[];for(let nt=0;nt<v.mipmaps.length;nt++)H.__webglFramebuffer[Q][nt]=s.createFramebuffer()}else H.__webglFramebuffer[Q]=s.createFramebuffer()}else{if(v.mipmaps&&v.mipmaps.length>0){H.__webglFramebuffer=[];for(let Q=0;Q<v.mipmaps.length;Q++)H.__webglFramebuffer[Q]=s.createFramebuffer()}else H.__webglFramebuffer=s.createFramebuffer();if(ft)for(let Q=0,nt=K.length;Q<nt;Q++){let _t=i.get(K[Q]);_t.__webglTexture===void 0&&(_t.__webglTexture=s.createTexture(),o.memory.textures++)}if(R.samples>0&&Xt(R)===!1){H.__webglMultisampledFramebuffer=s.createFramebuffer(),H.__webglColorRenderbuffer=[],e.bindFramebuffer(s.FRAMEBUFFER,H.__webglMultisampledFramebuffer);for(let Q=0;Q<K.length;Q++){let nt=K[Q];H.__webglColorRenderbuffer[Q]=s.createRenderbuffer(),s.bindRenderbuffer(s.RENDERBUFFER,H.__webglColorRenderbuffer[Q]);let _t=r.convert(nt.format,nt.colorSpace),kt=r.convert(nt.type),gt=y(nt.internalFormat,_t,kt,nt.normalized,nt.colorSpace,R.isXRRenderTarget===!0),pt=Dt(R);s.renderbufferStorageMultisample(s.RENDERBUFFER,pt,gt,R.width,R.height),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+Q,s.RENDERBUFFER,H.__webglColorRenderbuffer[Q])}s.bindRenderbuffer(s.RENDERBUFFER,null),R.depthBuffer&&(H.__webglDepthRenderbuffer=s.createRenderbuffer(),Bt(H.__webglDepthRenderbuffer,R,!0)),e.bindFramebuffer(s.FRAMEBUFFER,null)}}if(ht){e.bindTexture(s.TEXTURE_CUBE_MAP,X.__webglTexture),wt(s.TEXTURE_CUBE_MAP,v);for(let Q=0;Q<6;Q++)if(v.mipmaps&&v.mipmaps.length>0)for(let nt=0;nt<v.mipmaps.length;nt++)vt(H.__webglFramebuffer[Q][nt],R,v,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+Q,nt);else vt(H.__webglFramebuffer[Q],R,v,s.COLOR_ATTACHMENT0,s.TEXTURE_CUBE_MAP_POSITIVE_X+Q,0);g(v)&&M(s.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(ft){for(let Q=0,nt=K.length;Q<nt;Q++){let _t=K[Q],kt=i.get(_t),gt=s.TEXTURE_2D;(R.isWebGL3DRenderTarget||R.isWebGLArrayRenderTarget)&&(gt=R.isWebGL3DRenderTarget?s.TEXTURE_3D:s.TEXTURE_2D_ARRAY),e.bindTexture(gt,kt.__webglTexture),wt(gt,_t),vt(H.__webglFramebuffer,R,_t,s.COLOR_ATTACHMENT0+Q,gt,0),g(_t)&&M(gt)}e.unbindTexture()}else{let Q=s.TEXTURE_2D;if((R.isWebGL3DRenderTarget||R.isWebGLArrayRenderTarget)&&(Q=R.isWebGL3DRenderTarget?s.TEXTURE_3D:s.TEXTURE_2D_ARRAY),e.bindTexture(Q,X.__webglTexture),wt(Q,v),v.mipmaps&&v.mipmaps.length>0)for(let nt=0;nt<v.mipmaps.length;nt++)vt(H.__webglFramebuffer[nt],R,v,s.COLOR_ATTACHMENT0,Q,nt);else vt(H.__webglFramebuffer,R,v,s.COLOR_ATTACHMENT0,Q,0);g(v)&&M(Q),e.unbindTexture()}R.depthBuffer&&et(R)}function ot(R){let v=R.textures;for(let H=0,X=v.length;H<X;H++){let K=v[H];if(g(K)){let ht=T(R),ft=i.get(K).__webglTexture;e.bindTexture(ht,ft),M(ht),e.unbindTexture()}}}let ct=[],Ft=[];function Pt(R){if(R.samples>0){if(Xt(R)===!1){let v=R.textures,H=R.width,X=R.height,K=s.COLOR_BUFFER_BIT,ht=R.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT,ft=i.get(R),Q=v.length>1;if(Q)for(let _t=0;_t<v.length;_t++)e.bindFramebuffer(s.FRAMEBUFFER,ft.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+_t,s.RENDERBUFFER,null),e.bindFramebuffer(s.FRAMEBUFFER,ft.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+_t,s.TEXTURE_2D,null,0);e.bindFramebuffer(s.READ_FRAMEBUFFER,ft.__webglMultisampledFramebuffer);let nt=R.texture.mipmaps;nt&&nt.length>0?e.bindFramebuffer(s.DRAW_FRAMEBUFFER,ft.__webglFramebuffer[0]):e.bindFramebuffer(s.DRAW_FRAMEBUFFER,ft.__webglFramebuffer);for(let _t=0;_t<v.length;_t++){if(R.resolveDepthBuffer&&(R.depthBuffer&&(K|=s.DEPTH_BUFFER_BIT),R.stencilBuffer&&R.resolveStencilBuffer&&(K|=s.STENCIL_BUFFER_BIT)),Q){s.framebufferRenderbuffer(s.READ_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.RENDERBUFFER,ft.__webglColorRenderbuffer[_t]);let kt=i.get(v[_t]).__webglTexture;s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0,s.TEXTURE_2D,kt,0)}s.blitFramebuffer(0,0,H,X,0,0,H,X,K,s.NEAREST),l===!0&&(ct.length=0,Ft.length=0,ct.push(s.COLOR_ATTACHMENT0+_t),R.depthBuffer&&R.storeMultisampledDepthBuffer===!1&&(ct.push(ht),Ft.push(ht),s.invalidateFramebuffer(s.DRAW_FRAMEBUFFER,Ft)),s.invalidateFramebuffer(s.READ_FRAMEBUFFER,ct))}if(e.bindFramebuffer(s.READ_FRAMEBUFFER,null),e.bindFramebuffer(s.DRAW_FRAMEBUFFER,null),Q)for(let _t=0;_t<v.length;_t++){e.bindFramebuffer(s.FRAMEBUFFER,ft.__webglMultisampledFramebuffer),s.framebufferRenderbuffer(s.FRAMEBUFFER,s.COLOR_ATTACHMENT0+_t,s.RENDERBUFFER,ft.__webglColorRenderbuffer[_t]);let kt=i.get(v[_t]).__webglTexture;e.bindFramebuffer(s.FRAMEBUFFER,ft.__webglFramebuffer),s.framebufferTexture2D(s.DRAW_FRAMEBUFFER,s.COLOR_ATTACHMENT0+_t,s.TEXTURE_2D,kt,0)}e.bindFramebuffer(s.DRAW_FRAMEBUFFER,ft.__webglMultisampledFramebuffer)}else if(R.depthBuffer&&R.storeMultisampledDepthBuffer===!1&&l){let v=R.stencilBuffer?s.DEPTH_STENCIL_ATTACHMENT:s.DEPTH_ATTACHMENT;s.invalidateFramebuffer(s.DRAW_FRAMEBUFFER,[v])}}}function Dt(R){return Math.min(n.maxSamples,R.samples)}function Xt(R){let v=i.get(R);return R.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&v.__useRenderToTexture!==!1}function F(R){let v=o.render.frame;h.get(R)!==v&&(h.set(R,v),R.update())}function se(R,v){let H=R.colorSpace,X=R.format,K=R.type;return R.isCompressedTexture===!0||R.isVideoTexture===!0||H!==rr&&H!==Pi&&(ne.getTransfer(H)===le?(X!==ri||K!==$e)&&Yt("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):qt("WebGLTextures: Unsupported texture color space:",H)),v}function Jt(R){return typeof HTMLImageElement<"u"&&R instanceof HTMLImageElement?(c.width=R.naturalWidth||R.width,c.height=R.naturalHeight||R.height):typeof VideoFrame<"u"&&R instanceof VideoFrame?(c.width=R.displayWidth,c.height=R.displayHeight):(c.width=R.width,c.height=R.height),c}this.allocateTextureUnit=B,this.resetTextureUnits=P,this.getTextureUnits=I,this.setTextureUnits=N,this.setTexture2D=G,this.setTexture2DArray=V,this.setTexture3D=W,this.setTextureCube=$,this.rebindTextures=at,this.setupRenderTarget=st,this.updateRenderTargetMipmap=ot,this.updateMultisampleRenderTarget=Pt,this.setupDepthRenderbuffer=et,this.setupFrameBufferTexture=vt,this.useMultisampledRTT=Xt,this.isReversedDepthBuffer=function(){return e.buffers.depth.getReversed()}}function Sv(s,t){function e(i,n=Pi){let r,o=ne.getTransfer(n);if(i===$e)return s.UNSIGNED_BYTE;if(i===Aa)return s.UNSIGNED_SHORT_4_4_4_4;if(i===Ca)return s.UNSIGNED_SHORT_5_5_5_1;if(i===Nc)return s.UNSIGNED_INT_5_9_9_9_REV;if(i===Uc)return s.UNSIGNED_INT_10F_11F_11F_REV;if(i===Lc)return s.BYTE;if(i===Dc)return s.SHORT;if(i===Us)return s.UNSIGNED_SHORT;if(i===Ta)return s.INT;if(i===Ci)return s.UNSIGNED_INT;if(i===Ri)return s.FLOAT;if(i===we)return s.HALF_FLOAT;if(i===Fc)return s.ALPHA;if(i===Oc)return s.RGB;if(i===ri)return s.RGBA;if(i===ki)return s.DEPTH_COMPONENT;if(i===Hi)return s.DEPTH_STENCIL;if(i===Bc)return s.RED;if(i===Ra)return s.RED_INTEGER;if(i===Rn)return s.RG;if(i===Pa)return s.RG_INTEGER;if(i===Ia)return s.RGBA_INTEGER;if(i===qr||i===Yr||i===Zr||i===$r)if(o===le)if(r=t.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(i===qr)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===Yr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===Zr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===$r)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=t.get("WEBGL_compressed_texture_s3tc"),r!==null){if(i===qr)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===Yr)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===Zr)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===$r)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===La||i===Da||i===Na||i===Ua)if(r=t.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(i===La)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===Da)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===Na)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===Ua)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===Fa||i===Oa||i===Ba||i===ka||i===za||i===Jr||i===Va)if(r=t.get("WEBGL_compressed_texture_etc"),r!==null){if(i===Fa||i===Oa)return o===le?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(i===Ba)return o===le?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(i===ka)return r.COMPRESSED_R11_EAC;if(i===za)return r.COMPRESSED_SIGNED_R11_EAC;if(i===Jr)return r.COMPRESSED_RG11_EAC;if(i===Va)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(i===Ha||i===Ga||i===Wa||i===Xa||i===qa||i===Ya||i===Za||i===$a||i===Ja||i===ja||i===Ka||i===Qa||i===tl||i===el)if(r=t.get("WEBGL_compressed_texture_astc"),r!==null){if(i===Ha)return o===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===Ga)return o===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===Wa)return o===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===Xa)return o===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===qa)return o===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===Ya)return o===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===Za)return o===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===$a)return o===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===Ja)return o===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===ja)return o===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===Ka)return o===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===Qa)return o===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===tl)return o===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===el)return o===le?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===il||i===nl||i===sl)if(r=t.get("EXT_texture_compression_bptc"),r!==null){if(i===il)return o===le?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===nl)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===sl)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===rl||i===ol||i===jr||i===al)if(r=t.get("EXT_texture_compression_rgtc"),r!==null){if(i===rl)return r.COMPRESSED_RED_RGTC1_EXT;if(i===ol)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===jr)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===al)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===Cn?s.UNSIGNED_INT_24_8:s[i]!==void 0?s[i]:null}return{convert:e}}var wv=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Ev=`
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

}`,dh=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,e){if(this.texture===null){let i=new mr(t.texture);(t.depthNear!==e.depthNear||t.depthFar!==e.depthFar)&&(this.depthNear=t.depthNear,this.depthFar=t.depthFar),this.texture=i}}getMesh(t){if(this.texture!==null&&this.mesh===null){let e=t.cameras[0].viewport,i=new ce({vertexShader:wv,fragmentShader:Ev,uniforms:{depthColor:{value:this.texture},depthWidth:{value:e.z},depthHeight:{value:e.w}}});this.mesh=new Zt(new Gn(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},fh=class extends Ei{constructor(t,e){super();let i=this,n=null,r=1,o=null,a="local-floor",l=1,c=null,h=null,f=null,u=null,d=null,m=null,_=typeof XRWebGLBinding<"u",p=new dh,g={},M=e.getContextAttributes(),T=null,y=null,b=[],E=[],C=new tt,x=null,A=null,L=new Ie;L.viewport=new _e;let U=new Ie;U.viewport=new _e;let w=[L,U],P=new xa,I=null,N=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Z){let j=b[Z];return j===void 0&&(j=new Ss,b[Z]=j),j.getTargetRaySpace()},this.getControllerGrip=function(Z){let j=b[Z];return j===void 0&&(j=new Ss,b[Z]=j),j.getGripSpace()},this.getHand=function(Z){let j=b[Z];return j===void 0&&(j=new Ss,b[Z]=j),j.getHandSpace()};function B(Z){let j=E.indexOf(Z.inputSource);if(j===-1)return;let ut=b[j];ut!==void 0&&(ut.update(Z.inputSource,Z.frame,c||o),ut.dispatchEvent({type:Z.type,data:Z.inputSource}))}function O(){n.removeEventListener("select",B),n.removeEventListener("selectstart",B),n.removeEventListener("selectend",B),n.removeEventListener("squeeze",B),n.removeEventListener("squeezestart",B),n.removeEventListener("squeezeend",B),n.removeEventListener("end",O),n.removeEventListener("inputsourceschange",G);for(let Z=0;Z<b.length;Z++){let j=E[Z];j!==null&&(E[Z]=null,b[Z].disconnect(j))}I=null,N=null,p.reset();for(let Z in g)delete g[Z];if(t.setRenderTarget(T),d=null,u=null,f=null,n=null,y=null,Ht.stop(),i.isPresenting=!1,t.setPixelRatio(x),t.setSize(C.width,C.height,!1),A!==null){let Z=A.camera;Z.fov=A.fov,Z.zoom=A.zoom,Z.updateProjectionMatrix(),A=null}i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Z){r=Z,i.isPresenting===!0&&Yt("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Z){a=Z,i.isPresenting===!0&&Yt("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||o},this.setReferenceSpace=function(Z){c=Z},this.getBaseLayer=function(){return u!==null?u:d},this.getBinding=function(){return f===null&&_&&(f=new XRWebGLBinding(n,e)),f},this.getFrame=function(){return m},this.getSession=function(){return n},this.setSession=async function(Z){if(n=Z,n!==null){if(T=t.getRenderTarget(),n.addEventListener("select",B),n.addEventListener("selectstart",B),n.addEventListener("selectend",B),n.addEventListener("squeeze",B),n.addEventListener("squeezestart",B),n.addEventListener("squeezeend",B),n.addEventListener("end",O),n.addEventListener("inputsourceschange",G),M.xrCompatible!==!0&&await e.makeXRCompatible(),x=t.getPixelRatio(),t.getSize(C),_&&"createProjectionLayer"in XRWebGLBinding.prototype){let ut=null,It=null,vt=null;M.depth&&(vt=M.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,ut=M.stencil?Hi:ki,It=M.stencil?Cn:Ci);let Bt={colorFormat:e.RGBA8,depthFormat:vt,scaleFactor:r};f=this.getBinding(),u=f.createProjectionLayer(Bt),n.updateRenderState({layers:[u]}),t.setPixelRatio(1),t.setSize(u.textureWidth,u.textureHeight,!1),y=new ve(u.textureWidth,u.textureHeight,{format:ri,type:$e,depthTexture:new Vi(u.textureWidth,u.textureHeight,It,void 0,void 0,void 0,void 0,void 0,void 0,ut),stencilBuffer:M.stencil,colorSpace:t.outputColorSpace,samples:M.antialias?4:0,resolveDepthBuffer:u.ignoreDepthValues===!1,resolveStencilBuffer:u.ignoreDepthValues===!1,storeMultisampledDepthBuffer:u.ignoreDepthValues===!1,storeMultisampledStencilBuffer:u.ignoreDepthValues===!1})}else{let ut={antialias:M.antialias,alpha:!0,depth:M.depth,stencil:M.stencil,framebufferScaleFactor:r};d=new XRWebGLLayer(n,e,ut),n.updateRenderState({baseLayer:d}),t.setPixelRatio(1),t.setSize(d.framebufferWidth,d.framebufferHeight,!1),y=new ve(d.framebufferWidth,d.framebufferHeight,{format:ri,type:$e,colorSpace:t.outputColorSpace,stencilBuffer:M.stencil,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1,storeMultisampledDepthBuffer:d.ignoreDepthValues===!1,storeMultisampledStencilBuffer:d.ignoreDepthValues===!1})}y.isXRRenderTarget=!0,this.setFoveation(l),c=null,o=await n.requestReferenceSpace(a),Ht.setContext(n),Ht.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(n!==null)return n.environmentBlendMode},this.getDepthTexture=function(){return p.getDepthTexture()};function G(Z){for(let j=0;j<Z.removed.length;j++){let ut=Z.removed[j],It=E.indexOf(ut);It>=0&&(E[It]=null,b[It].disconnect(ut))}for(let j=0;j<Z.added.length;j++){let ut=Z.added[j],It=E.indexOf(ut);if(It===-1){for(let Bt=0;Bt<b.length;Bt++)if(Bt>=E.length){E.push(ut),It=Bt;break}else if(E[Bt]===null){E[Bt]=ut,It=Bt;break}if(It===-1)break}let vt=b[It];vt&&vt.connect(ut)}}let V=new D,W=new D;function $(Z,j,ut){V.setFromMatrixPosition(j.matrixWorld),W.setFromMatrixPosition(ut.matrixWorld);let It=V.distanceTo(W),vt=j.projectionMatrix.elements,Bt=ut.projectionMatrix.elements,ie=vt[14]/(vt[10]-1),et=vt[14]/(vt[10]+1),at=(vt[9]+1)/vt[5],st=(vt[9]-1)/vt[5],ot=(vt[8]-1)/vt[0],ct=(Bt[8]+1)/Bt[0],Ft=ie*ot,Pt=ie*ct,Dt=It/(-ot+ct),Xt=Dt*-ot;if(j.matrixWorld.decompose(Z.position,Z.quaternion,Z.scale),Z.translateX(Xt),Z.translateZ(Dt),Z.matrixWorld.compose(Z.position,Z.quaternion,Z.scale),Z.matrixWorldInverse.copy(Z.matrixWorld).invert(),vt[10]===-1)Z.projectionMatrix.copy(j.projectionMatrix),Z.projectionMatrixInverse.copy(j.projectionMatrixInverse);else{let F=ie+Dt,se=et+Dt,Jt=Ft-Xt,R=Pt+(It-Xt),v=at*et/se*F,H=st*et/se*F;Z.projectionMatrix.makePerspective(Jt,R,v,H,F,se),Z.projectionMatrixInverse.copy(Z.projectionMatrix).invert()}}function dt(Z,j){j===null?Z.matrixWorld.copy(Z.matrix):Z.matrixWorld.multiplyMatrices(j.matrixWorld,Z.matrix),Z.matrixWorldInverse.copy(Z.matrixWorld).invert()}this.updateCamera=function(Z){if(n===null)return;let j=Z.near,ut=Z.far;p.texture!==null&&(p.depthNear>0&&(j=p.depthNear),p.depthFar>0&&(ut=p.depthFar)),P.near=U.near=L.near=j,P.far=U.far=L.far=ut,(I!==P.near||N!==P.far)&&(n.updateRenderState({depthNear:P.near,depthFar:P.far}),I=P.near,N=P.far),P.layers.mask=Z.layers.mask|6,L.layers.mask=P.layers.mask&-5,U.layers.mask=P.layers.mask&-3;let It=Z.parent,vt=P.cameras;dt(P,It);for(let Bt=0;Bt<vt.length;Bt++)dt(vt[Bt],It);vt.length===2?$(P,L,U):P.projectionMatrix.copy(L.projectionMatrix),A===null&&Z.isPerspectiveCamera&&(A={camera:Z,fov:Z.fov,zoom:Z.zoom}),mt(Z,P,It)};function mt(Z,j,ut){ut===null?Z.matrix.copy(j.matrixWorld):(Z.matrix.copy(ut.matrixWorld),Z.matrix.invert(),Z.matrix.multiply(j.matrixWorld)),Z.matrix.decompose(Z.position,Z.quaternion,Z.scale),Z.updateMatrixWorld(!0),Z.projectionMatrix.copy(j.projectionMatrix),Z.projectionMatrixInverse.copy(j.projectionMatrixInverse),Z.isPerspectiveCamera&&(Z.fov=ys*2*Math.atan(1/Z.projectionMatrix.elements[5]),Z.zoom=1)}this.getCamera=function(){return P},this.getFoveation=function(){if(!(u===null&&d===null))return l},this.setFoveation=function(Z){l=Z,u!==null&&(u.fixedFoveation=Z),d!==null&&d.fixedFoveation!==void 0&&(d.fixedFoveation=Z)},this.hasDepthSensing=function(){return p.texture!==null},this.getDepthSensingMesh=function(){return p.getMesh(P)},this.getCameraTexture=function(Z){return g[Z]};let Ct=null;function wt(Z,j){if(h=j.getViewerPose(c||o),m=j,h!==null){let ut=h.views;d!==null&&(t.setRenderTargetFramebuffer(y,d.framebuffer),t.setRenderTarget(y));let It=!1;ut.length!==P.cameras.length&&(P.cameras.length=0,It=!0);for(let et=0;et<ut.length;et++){let at=ut[et],st=null;if(d!==null)st=d.getViewport(at);else{let ct=f.getViewSubImage(u,at);st=ct.viewport,et===0&&(t.setRenderTargetTextures(y,ct.colorTexture,ct.depthStencilTexture),t.setRenderTarget(y))}let ot=w[et];ot===void 0&&(ot=new Ie,ot.layers.enable(et),ot.viewport=new _e,w[et]=ot),ot.matrix.fromArray(at.transform.matrix),ot.matrix.decompose(ot.position,ot.quaternion,ot.scale),ot.projectionMatrix.fromArray(at.projectionMatrix),ot.projectionMatrixInverse.copy(ot.projectionMatrix).invert(),ot.viewport.set(st.x,st.y,st.width,st.height),et===0&&(P.matrix.copy(ot.matrix),P.matrix.decompose(P.position,P.quaternion,P.scale)),It===!0&&P.cameras.push(ot)}let vt=n.enabledFeatures;if(vt&&vt.includes("depth-sensing")&&n.depthUsage=="gpu-optimized"&&_){f=i.getBinding();let et=f.getDepthInformation(ut[0]);et&&et.isValid&&et.texture&&p.init(et,n.renderState)}if(vt&&vt.includes("camera-access")&&_){t.state.unbindTexture(),f=i.getBinding();for(let et=0;et<ut.length;et++){let at=ut[et].camera;if(at){let st=g[at];st||(st=new mr,g[at]=st);let ot=f.getCameraImage(at);st.sourceTexture=ot}}}}for(let ut=0;ut<b.length;ut++){let It=E[ut],vt=b[ut];It!==null&&vt!==void 0&&vt.update(It,j,c||o)}Ct&&Ct(Z,j),j.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:j}),m=null}let Ht=new Ed;Ht.setAnimationLoop(wt),this.setAnimationLoop=function(Z){Ct=Z},this.dispose=function(){}}},Tv=new oe,Id=new jt;Id.set(-1,0,0,0,1,0,0,0,1);function Av(s,t){function e(p,g){p.matrixAutoUpdate===!0&&p.updateMatrix(),g.value.copy(p.matrix)}function i(p,g){g.color.getRGB(p.fogColor.value,Wc(s)),g.isFog?(p.fogNear.value=g.near,p.fogFar.value=g.far):g.isFogExp2&&(p.fogDensity.value=g.density)}function n(p,g,M,T,y){g.isNodeMaterial?g.uniformsNeedUpdate=!1:g.isMeshBasicMaterial?r(p,g):g.isMeshLambertMaterial?(r(p,g),g.envMap&&(p.envMapIntensity.value=g.envMapIntensity)):g.isMeshToonMaterial?(r(p,g),f(p,g)):g.isMeshPhongMaterial?(r(p,g),h(p,g),g.envMap&&(p.envMapIntensity.value=g.envMapIntensity)):g.isMeshStandardMaterial?(r(p,g),u(p,g),g.isMeshPhysicalMaterial&&d(p,g,y)):g.isMeshMatcapMaterial?(r(p,g),m(p,g)):g.isMeshDepthMaterial?r(p,g):g.isMeshDistanceMaterial?(r(p,g),_(p,g)):g.isMeshNormalMaterial?r(p,g):g.isLineBasicMaterial?(o(p,g),g.isLineDashedMaterial&&a(p,g)):g.isPointsMaterial?l(p,g,M,T):g.isSpriteMaterial?c(p,g):g.isShadowMaterial?(p.color.value.copy(g.color),p.opacity.value=g.opacity):g.isShaderMaterial&&(g.uniformsNeedUpdate=!1)}function r(p,g){p.opacity.value=g.opacity,g.color&&p.diffuse.value.copy(g.color),g.emissive&&p.emissive.value.copy(g.emissive).multiplyScalar(g.emissiveIntensity),g.map&&(p.map.value=g.map,e(g.map,p.mapTransform)),g.alphaMap&&(p.alphaMap.value=g.alphaMap,e(g.alphaMap,p.alphaMapTransform)),g.bumpMap&&(p.bumpMap.value=g.bumpMap,e(g.bumpMap,p.bumpMapTransform),p.bumpScale.value=g.bumpScale,g.side===Ne&&(p.bumpScale.value*=-1)),g.normalMap&&(p.normalMap.value=g.normalMap,e(g.normalMap,p.normalMapTransform),p.normalScale.value.copy(g.normalScale),g.side===Ne&&p.normalScale.value.negate()),g.displacementMap&&(p.displacementMap.value=g.displacementMap,e(g.displacementMap,p.displacementMapTransform),p.displacementScale.value=g.displacementScale,p.displacementBias.value=g.displacementBias),g.emissiveMap&&(p.emissiveMap.value=g.emissiveMap,e(g.emissiveMap,p.emissiveMapTransform)),g.specularMap&&(p.specularMap.value=g.specularMap,e(g.specularMap,p.specularMapTransform)),g.alphaTest>0&&(p.alphaTest.value=g.alphaTest);let M=t.get(g),T=M.envMap,y=M.envMapRotation;T&&(p.envMap.value=T,p.envMapRotation.value.setFromMatrix4(Tv.makeRotationFromEuler(y)).transpose(),T.isCubeTexture&&T.isRenderTargetTexture===!1&&p.envMapRotation.value.premultiply(Id),p.reflectivity.value=g.reflectivity,p.ior.value=g.ior,p.refractionRatio.value=g.refractionRatio),g.lightMap&&(p.lightMap.value=g.lightMap,p.lightMapIntensity.value=g.lightMapIntensity,e(g.lightMap,p.lightMapTransform)),g.aoMap&&(p.aoMap.value=g.aoMap,p.aoMapIntensity.value=g.aoMapIntensity,e(g.aoMap,p.aoMapTransform))}function o(p,g){p.diffuse.value.copy(g.color),p.opacity.value=g.opacity,g.map&&(p.map.value=g.map,e(g.map,p.mapTransform))}function a(p,g){p.dashSize.value=g.dashSize,p.totalSize.value=g.dashSize+g.gapSize,p.scale.value=g.scale}function l(p,g,M,T){p.diffuse.value.copy(g.color),p.opacity.value=g.opacity,p.size.value=g.size*M,p.scale.value=T*.5,g.map&&(p.map.value=g.map,e(g.map,p.uvTransform)),g.alphaMap&&(p.alphaMap.value=g.alphaMap,e(g.alphaMap,p.alphaMapTransform)),g.alphaTest>0&&(p.alphaTest.value=g.alphaTest)}function c(p,g){p.diffuse.value.copy(g.color),p.opacity.value=g.opacity,p.rotation.value=g.rotation,g.map&&(p.map.value=g.map,e(g.map,p.mapTransform)),g.alphaMap&&(p.alphaMap.value=g.alphaMap,e(g.alphaMap,p.alphaMapTransform)),g.alphaTest>0&&(p.alphaTest.value=g.alphaTest)}function h(p,g){p.specular.value.copy(g.specular),p.shininess.value=Math.max(g.shininess,1e-4)}function f(p,g){g.gradientMap&&(p.gradientMap.value=g.gradientMap)}function u(p,g){p.metalness.value=g.metalness,g.metalnessMap&&(p.metalnessMap.value=g.metalnessMap,e(g.metalnessMap,p.metalnessMapTransform)),p.roughness.value=g.roughness,g.roughnessMap&&(p.roughnessMap.value=g.roughnessMap,e(g.roughnessMap,p.roughnessMapTransform)),g.envMap&&(p.envMapIntensity.value=g.envMapIntensity)}function d(p,g,M){p.ior.value=g.ior,g.sheen>0&&(p.sheenColor.value.copy(g.sheenColor).multiplyScalar(g.sheen),p.sheenRoughness.value=g.sheenRoughness,g.sheenColorMap&&(p.sheenColorMap.value=g.sheenColorMap,e(g.sheenColorMap,p.sheenColorMapTransform)),g.sheenRoughnessMap&&(p.sheenRoughnessMap.value=g.sheenRoughnessMap,e(g.sheenRoughnessMap,p.sheenRoughnessMapTransform))),g.clearcoat>0&&(p.clearcoat.value=g.clearcoat,p.clearcoatRoughness.value=g.clearcoatRoughness,g.clearcoatMap&&(p.clearcoatMap.value=g.clearcoatMap,e(g.clearcoatMap,p.clearcoatMapTransform)),g.clearcoatRoughnessMap&&(p.clearcoatRoughnessMap.value=g.clearcoatRoughnessMap,e(g.clearcoatRoughnessMap,p.clearcoatRoughnessMapTransform)),g.clearcoatNormalMap&&(p.clearcoatNormalMap.value=g.clearcoatNormalMap,e(g.clearcoatNormalMap,p.clearcoatNormalMapTransform),p.clearcoatNormalScale.value.copy(g.clearcoatNormalScale),g.side===Ne&&p.clearcoatNormalScale.value.negate())),g.dispersion>0&&(p.dispersion.value=g.dispersion),g.retroreflectivity>0&&(p.retroreflectivity.value=g.retroreflectivity),g.iridescence>0&&(p.iridescence.value=g.iridescence,p.iridescenceIOR.value=g.iridescenceIOR,p.iridescenceThicknessMinimum.value=g.iridescenceThicknessRange[0],p.iridescenceThicknessMaximum.value=g.iridescenceThicknessRange[1],g.iridescenceMap&&(p.iridescenceMap.value=g.iridescenceMap,e(g.iridescenceMap,p.iridescenceMapTransform)),g.iridescenceThicknessMap&&(p.iridescenceThicknessMap.value=g.iridescenceThicknessMap,e(g.iridescenceThicknessMap,p.iridescenceThicknessMapTransform))),g.transmission>0&&(p.transmission.value=g.transmission,p.transmissionSamplerMap.value=M.texture,p.transmissionSamplerSize.value.set(M.width,M.height),g.transmissionMap&&(p.transmissionMap.value=g.transmissionMap,e(g.transmissionMap,p.transmissionMapTransform)),p.thickness.value=g.thickness,g.thicknessMap&&(p.thicknessMap.value=g.thicknessMap,e(g.thicknessMap,p.thicknessMapTransform)),p.attenuationDistance.value=g.attenuationDistance,p.attenuationColor.value.copy(g.attenuationColor)),g.anisotropy>0&&(p.anisotropyVector.value.set(g.anisotropy*Math.cos(g.anisotropyRotation),g.anisotropy*Math.sin(g.anisotropyRotation)),g.anisotropyMap&&(p.anisotropyMap.value=g.anisotropyMap,e(g.anisotropyMap,p.anisotropyMapTransform))),p.specularIntensity.value=g.specularIntensity,p.specularColor.value.copy(g.specularColor),g.specularColorMap&&(p.specularColorMap.value=g.specularColorMap,e(g.specularColorMap,p.specularColorMapTransform)),g.specularIntensityMap&&(p.specularIntensityMap.value=g.specularIntensityMap,e(g.specularIntensityMap,p.specularIntensityMapTransform))}function m(p,g){g.matcap&&(p.matcap.value=g.matcap)}function _(p,g){let M=t.get(g).light;p.referencePosition.value.setFromMatrixPosition(M.matrixWorld),p.nearDistance.value=M.shadow.camera.near,p.farDistance.value=M.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:n}}function Cv(s,t,e,i){let n={},r={},o=[],a=s.getParameter(s.MAX_UNIFORM_BUFFER_BINDINGS);function l(y,b){let E=b.program;i.uniformBlockBinding(y,E)}function c(y,b){let E=n[y.id];E===void 0&&(p(y),E=h(y),n[y.id]=E,y.addEventListener("dispose",M));let C=b.program;i.updateUBOMapping(y,C);let x=t.render.frame;r[y.id]!==x&&(u(y),r[y.id]=x)}function h(y){let b=f();y.__bindingPointIndex=b;let E=s.createBuffer(),C=y.__size,x=y.usage;return s.bindBuffer(s.UNIFORM_BUFFER,E),s.bufferData(s.UNIFORM_BUFFER,C,x),s.bindBuffer(s.UNIFORM_BUFFER,null),s.bindBufferBase(s.UNIFORM_BUFFER,b,E),E}function f(){for(let y=0;y<a;y++)if(o.indexOf(y)===-1)return o.push(y),y;return qt("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function u(y){let b=n[y.id],E=y.uniforms,C=y.__cache;s.bindBuffer(s.UNIFORM_BUFFER,b);for(let x=0,A=E.length;x<A;x++){let L=E[x];if(Array.isArray(L))for(let U=0,w=L.length;U<w;U++)d(L[U],x,U,C);else d(L,x,0,C)}s.bindBuffer(s.UNIFORM_BUFFER,null)}function d(y,b,E,C){if(_(y,b,E,C)===!0){let x=y.__offset,A=y.value;if(Array.isArray(A)){let L=0;for(let U=0;U<A.length;U++){let w=A[U],P=g(w);m(w,y.__data,L),typeof w!="number"&&typeof w!="boolean"&&!w.isMatrix3&&!ArrayBuffer.isView(w)&&(L+=P.storage/Float32Array.BYTES_PER_ELEMENT)}}else m(A,y.__data,0);s.bufferSubData(s.UNIFORM_BUFFER,x,y.__data)}}function m(y,b,E){typeof y=="number"||typeof y=="boolean"?b[0]=y:y.isMatrix3?(b[0]=y.elements[0],b[1]=y.elements[1],b[2]=y.elements[2],b[3]=0,b[4]=y.elements[3],b[5]=y.elements[4],b[6]=y.elements[5],b[7]=0,b[8]=y.elements[6],b[9]=y.elements[7],b[10]=y.elements[8],b[11]=0):ArrayBuffer.isView(y)?b.set(new y.constructor(y.buffer,y.byteOffset,b.length)):y.toArray(b,E)}function _(y,b,E,C){let x=y.value,A=b+"_"+E;if(C[A]===void 0)return typeof x=="number"||typeof x=="boolean"?C[A]=x:ArrayBuffer.isView(x)?C[A]=x.slice():C[A]=x.clone(),!0;{let L=C[A];if(typeof x=="number"||typeof x=="boolean"){if(L!==x)return C[A]=x,!0}else{if(ArrayBuffer.isView(x))return!0;if(L.equals(x)===!1)return L.copy(x),!0}}return!1}function p(y){let b=y.uniforms,E=0,C=16;for(let A=0,L=b.length;A<L;A++){let U=Array.isArray(b[A])?b[A]:[b[A]];for(let w=0,P=U.length;w<P;w++){let I=U[w],N=Array.isArray(I.value)?I.value:[I.value];for(let B=0,O=N.length;B<O;B++){let G=N[B],V=g(G),W=E%C,$=W%V.boundary,dt=W+$;E+=$,dt!==0&&C-dt<V.storage&&(E+=C-dt),I.__data=new Float32Array(V.storage/Float32Array.BYTES_PER_ELEMENT),I.__offset=E,E+=V.storage}}}let x=E%C;return x>0&&(E+=C-x),y.__size=E,y.__cache={},this}function g(y){let b={boundary:0,storage:0};return typeof y=="number"||typeof y=="boolean"?(b.boundary=4,b.storage=4):y.isVector2?(b.boundary=8,b.storage=8):y.isVector3||y.isColor?(b.boundary=16,b.storage=12):y.isVector4?(b.boundary=16,b.storage=16):y.isMatrix3?(b.boundary=48,b.storage=48):y.isMatrix4?(b.boundary=64,b.storage=64):y.isTexture?Yt("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(y)?(b.boundary=16,b.storage=y.byteLength):Yt("WebGLRenderer: Unsupported uniform value type.",y),b}function M(y){let b=y.target;b.removeEventListener("dispose",M);let E=o.indexOf(b.__bindingPointIndex);o.splice(E,1),s.deleteBuffer(n[b.id]),delete n[b.id],delete r[b.id]}function T(){for(let y in n)s.deleteBuffer(n[y]);o=[],n={},r={}}return{bind:l,update:c,dispose:T}}var Rv=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Gi=null;function Pv(){return Gi===null&&(Gi=new mn(Rv,16,16,Rn,we),Gi.name="DFG_LUT",Gi.minFilter=He,Gi.magFilter=He,Gi.wrapS=Fi,Gi.wrapT=Fi,Gi.generateMipmaps=!1,Gi.needsUpdate=!0),Gi}var fl=class{constructor(t={}){let{canvas:e=qu(),context:i=null,depth:n=!0,stencil:r=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:f=!1,reversedDepthBuffer:u=!1,outputBufferType:d=$e}=t;this.isWebGLRenderer=!0;let m;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");m=i.getContextAttributes().alpha}else m=o;let _=d,p=new Set([Ia,Pa,Ra]),g=new Set([$e,Ci,Us,Cn,Aa,Ca]),M=new Uint32Array(4),T=new Int32Array(4),y=new D,b=null,E=null,C=[],x=[],A=null;this.domElement=e,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=fi,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let L=this,U=!1,w=null,P=null,I=null,N=null;this._outputColorSpace=Pe;let B=0,O=0,G=null,V=-1,W=null,$=new _e,dt=new _e,mt=null,Ct=new Vt(0),wt=0,Ht=e.width,Z=e.height,j=1,ut=null,It=null,vt=new _e(0,0,Ht,Z),Bt=new _e(0,0,Ht,Z),ie=!1,et=new As,at=!1,st=!1,ot=new oe,ct=new D,Ft=new _e,Pt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},Dt=!1;function Xt(){return G===null?j:1}let F=i;function se(S,k){return e.getContext(S,k)}let Jt,R,v,H,X,K,ht,ft,Q,nt,_t,kt,gt,pt,Lt,Gt,$t,z,xt,it,yt,Et,lt;try{let S={alpha:!0,depth:n,stencil:r,antialias:a,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:f};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${"186"}`),e.addEventListener("webglcontextlost",xe,!1),e.addEventListener("webglcontextrestored",he,!1),e.addEventListener("webglcontextcreationerror",xi,!1),F===null){let k="webgl2";if(F=se(k,S),F===null)throw se(k)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}Wt()}catch(S){throw e.removeEventListener("webglcontextlost",xe,!1),e.removeEventListener("webglcontextrestored",he,!1),e.removeEventListener("webglcontextcreationerror",xi,!1),qt("WebGLRenderer: "+S.message),S}function Wt(){Jt=new Og(F),Jt.init(),yt=new Sv(F,Jt),R=new Ag(F,Jt,t,yt),v=new Mv(F,Jt),R.reversedDepthBuffer&&u&&v.buffers.depth.setReversed(!0),P=F.createFramebuffer(),I=F.createFramebuffer(),N=F.createFramebuffer(),H=new zg(F),X=new av,K=new bv(F,Jt,v,X,R,yt,H),ht=new Fg(L),ft=new Hp(F),Et=new Eg(F,ft),Q=new Bg(F,ft,H,Et),nt=new Hg(F,Q,ft,Et,H),z=new Vg(F,R,K),Lt=new Cg(X),_t=new ov(L,ht,Jt,R,Et,Lt),kt=new Av(L,X),gt=new cv,pt=new mv(Jt),$t=new wg(L,ht,v,nt,m,l),Gt=new yv(L,nt,R),lt=new Cv(F,H,R,v),xt=new Tg(F,Jt,H),it=new kg(F,Jt,H),H.programs=_t.programs,L.capabilities=R,L.extensions=Jt,L.properties=X,L.renderLists=gt,L.shadowMap=Gt,L.state=v,L.info=H}_!==$e&&(A=new Wg(_,e.width,e.height,a,n,r));let Ot=new fh(L,F);this.xr=Ot,this.getContext=function(){return F},this.getContextAttributes=function(){return F.getContextAttributes()},this.forceContextLoss=function(){let S=Jt.get("WEBGL_lose_context");S&&S.loseContext()},this.forceContextRestore=function(){let S=Jt.get("WEBGL_lose_context");S&&S.restoreContext()},this.getPixelRatio=function(){return j},this.setPixelRatio=function(S){S!==void 0&&(j=S,this.setSize(Ht,Z,!1))},this.getSize=function(S){return S.set(Ht,Z)},this.setSize=function(S,k,J=!0){if(Ot.isPresenting){Yt("WebGLRenderer: Can't change size while VR device is presenting.");return}Ht=S,Z=k,e.width=Math.floor(S*j),e.height=Math.floor(k*j),J===!0&&(e.style.width=S+"px",e.style.height=k+"px"),A!==null&&A.setSize(e.width,e.height),this.setViewport(0,0,S,k)},this.getDrawingBufferSize=function(S){return S.set(Ht*j,Z*j).floor()},this.setDrawingBufferSize=function(S,k,J){Ht=S,Z=k,j=J,e.width=Math.floor(S*J),e.height=Math.floor(k*J),this.setViewport(0,0,S,k)},this.setEffects=function(S){if(_===$e){qt("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(S){for(let k=0;k<S.length;k++)if(S[k].isOutputPass===!0){Yt("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}A.setEffects(S||[])},this.getCurrentViewport=function(S){return S.copy($)},this.getViewport=function(S){return S.copy(vt)},this.setViewport=function(S,k,J,q){S.isVector4?vt.set(S.x,S.y,S.z,S.w):vt.set(S,k,J,q),v.viewport($.copy(vt).multiplyScalar(j).round())},this.getScissor=function(S){return S.copy(Bt)},this.setScissor=function(S,k,J,q){S.isVector4?Bt.set(S.x,S.y,S.z,S.w):Bt.set(S,k,J,q),v.scissor(dt.copy(Bt).multiplyScalar(j).round())},this.getScissorTest=function(){return ie},this.setScissorTest=function(S){v.setScissorTest(ie=S)},this.setOpaqueSort=function(S){ut=S},this.setTransparentSort=function(S){It=S},this.getClearColor=function(S){return S.copy($t.getClearColor())},this.setClearColor=function(){$t.setClearColor(...arguments)},this.getClearAlpha=function(){return $t.getClearAlpha()},this.setClearAlpha=function(){$t.setClearAlpha(...arguments)},this.clear=function(S=!0,k=!0,J=!0){let q=0;if(S){let Y=!1;if(G!==null){let St=G.texture.format;Y=p.has(St)}if(Y){let St=G.texture.type,Rt=g.has(St),bt=$t.getClearColor(),Nt=$t.getClearAlpha(),zt=bt.r,te=bt.g,re=bt.b;Rt?(M[0]=zt,M[1]=te,M[2]=re,M[3]=Nt,F.clearBufferuiv(F.COLOR,0,M)):(T[0]=zt,T[1]=te,T[2]=re,T[3]=Nt,F.clearBufferiv(F.COLOR,0,T))}else q|=F.COLOR_BUFFER_BIT}k&&(q|=F.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),J&&(q|=F.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),q!==0&&F.clear(q)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(S){S.setRenderer(this),w=S},this.dispose=function(){e.removeEventListener("webglcontextlost",xe,!1),e.removeEventListener("webglcontextrestored",he,!1),e.removeEventListener("webglcontextcreationerror",xi,!1),$t.dispose(),gt.dispose(),pt.dispose(),X.dispose(),ht.dispose(),nt.dispose(),Et.dispose(),lt.dispose(),_t.dispose(),Ot.dispose(),Ot.removeEventListener("sessionstart",Ph),Ot.removeEventListener("sessionend",Ih),In.stop()};function xe(S){S.preventDefault(),lr("WebGLRenderer: Context Lost."),U=!0}function he(){lr("WebGLRenderer: Context Restored."),U=!1;let S=H.autoReset,k=Gt.enabled,J=Gt.autoUpdate,q=Gt.needsUpdate,Y=Gt.type;Wt(),H.autoReset=S,Gt.enabled=k,Gt.autoUpdate=J,Gt.needsUpdate=q,Gt.type=Y}function xi(S){qt("WebGLRenderer: A WebGL context could not be created. Reason: ",S.statusMessage)}function Di(S){let k=S.target;k.removeEventListener("dispose",Di),of(k)}function of(S){af(S),X.remove(S)}function af(S){let k=X.get(S).programs;k!==void 0&&(k.forEach(function(J){_t.releaseProgram(J)}),S.isShaderMaterial&&_t.releaseShaderCache(S))}this.renderBufferDirect=function(S,k,J,q,Y,St){k===null&&(k=Pt);let Rt=Y.isMesh&&Y.matrixWorld.determinantAffine()<0,bt=hf(S,k,J,q,Y);v.setMaterial(q,Rt);let Nt=J.index,zt=1;if(q.wireframe===!0){if(Nt=Q.getWireframeAttribute(J),Nt===void 0)return;zt=2}let te=J.drawRange,re=J.attributes.position,Ut=te.start*zt,ue=(te.start+te.count)*zt;St!==null&&(Ut=Math.max(Ut,St.start*zt),ue=Math.min(ue,(St.start+St.count)*zt)),Nt!==null?(Ut=Math.max(Ut,0),ue=Math.min(ue,Nt.count)):re!=null&&(Ut=Math.max(Ut,0),ue=Math.min(ue,re.count));let Ce=ue-Ut;if(Ce<0||Ce===1/0)return;Et.setup(Y,q,bt,J,Nt);let Me,me=xt;if(Nt!==null&&(Me=ft.get(Nt),me=it,me.setIndex(Me)),Y.isMesh)q.wireframe===!0?(v.setLineWidth(q.wireframeLinewidth*Xt()),me.setMode(F.LINES)):me.setMode(F.TRIANGLES);else if(Y.isLine){let qe=q.linewidth;qe===void 0&&(qe=1),v.setLineWidth(qe*Xt()),Y.isLineSegments?me.setMode(F.LINES):Y.isLineLoop?me.setMode(F.LINE_LOOP):me.setMode(F.LINE_STRIP)}else Y.isPoints?me.setMode(F.POINTS):Y.isSprite&&me.setMode(F.TRIANGLES);if(Y.isBatchedMesh)if(Jt.get("WEBGL_multi_draw"))me.renderMultiDraw(Y._multiDrawStarts,Y._multiDrawCounts,Y._multiDrawCount);else{let qe=Y._multiDrawStarts,At=Y._multiDrawCounts,Ke=Y._multiDrawCount,ae=Nt?ft.get(Nt).bytesPerElement:1,pi=X.get(q).currentProgram.getUniforms();for(let Ni=0;Ni<Ke;Ni++)pi.setValue(F,"_gl_DrawID",Ni),me.render(qe[Ni]/ae,At[Ni])}else if(Y.isInstancedMesh)me.renderInstances(Ut,Ce,Y.count);else if(J.isInstancedBufferGeometry){let qe=J._maxInstanceCount!==void 0?J._maxInstanceCount:1/0,At=Math.min(J.instanceCount,qe);me.renderInstances(Ut,Ce,At)}else me.render(Ut,Ce)};function Rh(S,k,J,q){w!==null&&S.isNodeMaterial&&w.setObject(q,S),at===!0&&Lt.setState(S,J,!1),S.transparent===!0&&S.side===Xe&&S.forceSinglePass===!1?(S.side=Ne,S.needsUpdate=!0,po(S,k,q),S.side=wn,S.needsUpdate=!0,po(S,k,q),S.side=Xe):po(S,k,q)}this.compile=function(S,k,J=null){J===null&&(J=S),w!==null&&w.renderStart(S,k,J),E=pt.get(J),E.init(k),x.push(E),J.traverseVisible(function(Y){Y.isLight&&Y.layers.test(k.layers)&&(E.pushLight(Y),Y.castShadow&&E.pushShadow(Y))}),S!==J&&S.traverseVisible(function(Y){Y.isLight&&Y.layers.test(k.layers)&&(E.pushLight(Y),Y.castShadow&&E.pushShadow(Y))}),E.setupLights(),w!==null&&w.updateLights(E.state.lightsArray),st=this.localClippingEnabled,at=Lt.init(this.clippingPlanes,st),at===!0&&Lt.setGlobalState(this.clippingPlanes,k),w!==null&&Gt.render(E.state.shadowsArray,J,k);let q=new Set;return S.traverse(function(Y){if(!(Y.isMesh||Y.isPoints||Y.isLine||Y.isSprite))return;let St=Y.material;if(St)if(Array.isArray(St))for(let Rt=0;Rt<St.length;Rt++){let bt=St[Rt];Rh(bt,J,k,Y),q.add(bt)}else Rh(St,J,k,Y),q.add(St)}),E=x.pop(),w!==null&&w.renderEnd(),q},this.compileAsync=function(S,k,J=null){let q=this.compile(S,k,J);return new Promise(Y=>{function St(){if(q.forEach(function(Rt){let Nt=X.get(Rt).currentProgram;(Nt===void 0||Nt.isReady())&&q.delete(Rt)}),q.size===0){Y(S);return}setTimeout(St,10)}Jt.get("KHR_parallel_shader_compile")!==null?St():setTimeout(St,10)})};let zl=null;function lf(S){zl&&zl(S)}function Ph(){In.stop()}function Ih(){In.start()}let In=new Ed;In.setAnimationLoop(lf),typeof self<"u"&&In.setContext(self),this.setAnimationLoop=function(S){zl=S,Ot.setAnimationLoop(S),S===null?In.stop():In.start()},Ot.addEventListener("sessionstart",Ph),Ot.addEventListener("sessionend",Ih),this.render=function(S,k){if(k!==void 0&&k.isCamera!==!0){qt("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(U===!0)return;w!==null&&w.renderStart(S,k);let J=Ot.enabled===!0&&Ot.isPresenting===!0,q=A!==null&&(G===null||J)&&A.begin(L,G);if(S.matrixWorldAutoUpdate===!0&&S.updateMatrixWorld(),k.parent===null&&k.matrixWorldAutoUpdate===!0&&k.updateMatrixWorld(),Ot.enabled===!0&&Ot.isPresenting===!0&&(A===null||A.isCompositing()===!1)&&(Ot.cameraAutoUpdate===!0&&Ot.updateCamera(k),k=Ot.getCamera()),S.isScene===!0&&S.onBeforeRender(L,S,k,G),E=pt.get(S,x.length),E.init(k),E.state.textureUnits=K.getTextureUnits(),x.push(E),ot.multiplyMatrices(k.projectionMatrix,k.matrixWorldInverse),et.setFromProjectionMatrix(ot,wi,k.reversedDepth),st=this.localClippingEnabled,at=Lt.init(this.clippingPlanes,st),b=gt.get(S,C.length),b.init(),C.push(b),Ot.enabled===!0&&Ot.isPresenting===!0){let Rt=L.xr.getDepthSensingMesh();Rt!==null&&Vl(Rt,k,-1/0,L.sortObjects)}Vl(S,k,0,L.sortObjects),b.finish(),w!==null&&w.updateLights(E.state.lightsArray),L.sortObjects===!0&&b.sort(ut,It),Dt=Ot.enabled===!1||Ot.isPresenting===!1||Ot.hasDepthSensing()===!1,Dt&&$t.addToRenderList(b,S),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),at===!0&&Lt.beginShadows();let Y=E.state.shadowsArray;if(Gt.render(Y,S,k),at===!0&&Lt.endShadows(),(q&&A.hasRenderPass())===!1){let Rt=b.opaque,bt=b.transmissive;if(E.setupLights(),k.isArrayCamera){let Nt=k.cameras;if(bt.length>0)for(let zt=0,te=Nt.length;zt<te;zt++){let re=Nt[zt];Dh(Rt,bt,S,re)}Dt&&$t.render(S);for(let zt=0,te=Nt.length;zt<te;zt++){let re=Nt[zt];Lh(b,S,re,re.viewport)}}else bt.length>0&&Dh(Rt,bt,S,k),Dt&&$t.render(S),Lh(b,S,k)}G!==null&&O===0&&(K.updateMultisampleRenderTarget(G),K.updateRenderTargetMipmap(G)),q&&A.end(L),S.isScene===!0&&S.onAfterRender(L,S,k),Et.resetDefaultState(),V=-1,W=null,x.pop(),x.length>0?(E=x[x.length-1],K.setTextureUnits(E.state.textureUnits),at===!0&&Lt.setGlobalState(L.clippingPlanes,E.state.camera)):E=null,C.pop(),C.length>0?b=C[C.length-1]:b=null,w!==null&&w.renderEnd()};function Vl(S,k,J,q){if(S.visible===!1)return;if(S.layers.test(k.layers)){if(S.isGroup)J=S.renderOrder;else if(S.isLOD)S.autoUpdate===!0&&S.update(k);else if(S.isLightProbeGrid)E.pushLightProbeGrid(S);else if(S.isLight)E.pushLight(S),S.castShadow&&E.pushShadow(S);else if(S.isSprite){if(!S.frustumCulled||S.intersectsFrustum(et)){q&&Ft.setFromMatrixPosition(S.matrixWorld).applyMatrix4(ot);let Rt=nt.update(S),bt=S.material;bt.visible&&b.push(S,Rt,bt,J,Ft.z,null,k)}}else if((S.isMesh||S.isLine||S.isPoints)&&(!S.frustumCulled||S.intersectsFrustum(et))){let Rt=nt.update(S),bt=S.material;if(q&&(S.boundingSphere!==void 0?(S.boundingSphere===null&&S.computeBoundingSphere(),Ft.copy(S.boundingSphere.center)):(Rt.boundingSphere===null&&Rt.computeBoundingSphere(),Ft.copy(Rt.boundingSphere.center)),Ft.applyMatrix4(S.matrixWorld).applyMatrix4(ot)),Array.isArray(bt)){let Nt=Rt.groups;for(let zt=0,te=Nt.length;zt<te;zt++){let re=Nt[zt],Ut=bt[re.materialIndex];Ut&&Ut.visible&&b.push(S,Rt,Ut,J,Ft.z,re,k)}}else bt.visible&&b.push(S,Rt,bt,J,Ft.z,null,k)}}let St=S.children;for(let Rt=0,bt=St.length;Rt<bt;Rt++)Vl(St[Rt],k,J,q)}function Lh(S,k,J,q){let{opaque:Y,transmissive:St,transparent:Rt}=S;E.setupLightsView(J),at===!0&&Lt.setGlobalState(L.clippingPlanes,J),q&&v.viewport($.copy(q)),Y.length>0&&fo(Y,k,J),St.length>0&&fo(St,k,J),Rt.length>0&&fo(Rt,k,J),v.buffers.depth.setTest(!0),v.buffers.depth.setMask(!0),v.buffers.color.setMask(!0),v.setPolygonOffset(!1)}function Dh(S,k,J,q){if((J.isScene===!0?J.overrideMaterial:null)!==null)return;if(E.state.transmissionRenderTarget[q.id]===void 0){let Ut=Jt.has("EXT_color_buffer_half_float")||Jt.has("EXT_color_buffer_float");E.state.transmissionRenderTarget[q.id]=new ve(1,1,{generateMipmaps:!0,type:Ut?we:$e,minFilter:An,samples:Math.max(4,R.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:ne.workingColorSpace})}let St=E.state.transmissionRenderTarget[q.id],Rt=q.viewport||$;St.setSize(Rt.z*L.transmissionResolutionScale,Rt.w*L.transmissionResolutionScale);let bt=L.getRenderTarget(),Nt=L.getActiveCubeFace(),zt=L.getActiveMipmapLevel();L.setRenderTarget(St),L.getClearColor(Ct),wt=L.getClearAlpha(),wt<1&&L.setClearColor(16777215,.5),L.clear(),Dt&&$t.render(J);let te=L.toneMapping;L.toneMapping=fi;let re=q.viewport;if(q.viewport!==void 0&&(q.viewport=void 0),E.setupLightsView(q),at===!0&&Lt.setGlobalState(L.clippingPlanes,q),fo(S,J,q),K.updateMultisampleRenderTarget(St),K.updateRenderTargetMipmap(St),Jt.has("WEBGL_multisampled_render_to_texture")===!1){let Ut=!1;for(let ue=0,Ce=k.length;ue<Ce;ue++){let Me=k[ue],{object:me,geometry:qe,material:At,group:Ke}=Me;if(At.side===Xe&&me.layers.test(q.layers)){let ae=At.side;At.side=Ne,At.needsUpdate=!0,Nh(me,J,q,qe,At,Ke),At.side=ae,At.needsUpdate=!0,Ut=!0}}Ut===!0&&(K.updateMultisampleRenderTarget(St),K.updateRenderTargetMipmap(St))}L.setRenderTarget(bt,Nt,zt),L.setClearColor(Ct,wt),re!==void 0&&(q.viewport=re),L.toneMapping=te}function fo(S,k,J){let q=k.isScene===!0?k.overrideMaterial:null;for(let Y=0,St=S.length;Y<St;Y++){let Rt=S[Y],{object:bt,geometry:Nt,group:zt}=Rt,te=Rt.material;te.allowOverride===!0&&q!==null&&(te=q),bt.layers.test(J.layers)&&Nh(bt,k,J,Nt,te,zt)}}function Nh(S,k,J,q,Y,St){w!==null&&Y.isNodeMaterial&&w.setObject(S,Y),S.onBeforeRender(L,k,J,q,Y,St),S.modelViewMatrix.multiplyMatrices(J.matrixWorldInverse,S.matrixWorld),S.normalMatrix.getNormalMatrix(S.modelViewMatrix),Y.onBeforeRender(L,k,J,q,S,St),Y.transparent===!0&&Y.side===Xe&&Y.forceSinglePass===!1?(Y.side=Ne,Y.needsUpdate=!0,L.renderBufferDirect(J,k,q,Y,S,St),Y.side=wn,Y.needsUpdate=!0,L.renderBufferDirect(J,k,q,Y,S,St),Y.side=Xe):L.renderBufferDirect(J,k,q,Y,S,St),S.onAfterRender(L,k,J,q,Y,St)}function po(S,k,J){k.isScene!==!0&&(k=Pt);let q=X.get(S),Y=E.state.lights,St=E.state.shadowsArray,Rt=Y.state.version,bt=_t.getParameters(S,Y.state,St,k,J,E.state.lightProbeGridArray),Nt=_t.getProgramCacheKey(bt),zt=q.programs;q.environment=S.isMeshStandardMaterial||S.isMeshLambertMaterial||S.isMeshPhongMaterial?k.environment:null,q.fog=k.fog;let te=S.isMeshStandardMaterial||S.isMeshLambertMaterial&&!S.envMap||S.isMeshPhongMaterial&&!S.envMap;q.envMap=ht.get(S.envMap||q.environment,te),q.envMapRotation=q.environment!==null&&S.envMap===null?k.environmentRotation:S.envMapRotation,zt===void 0&&(S.addEventListener("dispose",Di),zt=new Map,q.programs=zt);let re=zt.get(Nt);if(re!==void 0){if(q.currentProgram===re&&q.lightsStateVersion===Rt)return Fh(S,bt),re}else bt.uniforms=_t.getUniforms(S),w!==null&&S.isNodeMaterial&&w.build(S,J,bt),S.onBeforeCompile(bt,L),re=_t.acquireProgram(bt,Nt),zt.set(Nt,re),q.uniforms=bt.uniforms;let Ut=q.uniforms;return(!S.isShaderMaterial&&!S.isRawShaderMaterial||S.clipping===!0)&&(Ut.clippingPlanes=Lt.uniform),Fh(S,bt),q.needsLights=df(S),q.lightsStateVersion=Rt,q.needsLights&&(Ut.ambientLightColor.value=Y.state.ambient,Ut.lightProbe.value=Y.state.probe,Ut.sunLights.value=Y.state.sun,Ut.sunLightShadows.value=Y.state.sunShadow,Ut.directionalLights.value=Y.state.directional,Ut.directionalLightShadows.value=Y.state.directionalShadow,Ut.spotLights.value=Y.state.spot,Ut.spotLightShadows.value=Y.state.spotShadow,Ut.rectAreaLights.value=Y.state.rectArea,Ut.ltc_1.value=Y.state.rectAreaLTC1,Ut.ltc_2.value=Y.state.rectAreaLTC2,Ut.pointLights.value=Y.state.point,Ut.pointLightShadows.value=Y.state.pointShadow,Ut.hemisphereLights.value=Y.state.hemi,Ut.sunShadowMatrix.value=Y.state.sunShadowMatrix,Ut.sunShadowCascade.value=Y.state.sunShadowCascade,Ut.directionalShadowMatrix.value=Y.state.directionalShadowMatrix,Ut.spotLightMatrix.value=Y.state.spotLightMatrix,Ut.spotLightMap.value=Y.state.spotLightMap,Ut.pointShadowMatrix.value=Y.state.pointShadowMatrix),q.lightProbeGrid=E.state.lightProbeGridArray.length>0,q.currentProgram=re,q.uniformsList=null,re}function Uh(S){if(S.uniformsList===null){let k=S.currentProgram.getUniforms();S.uniformsList=ks.seqWithValue(k.seq,S.uniforms)}return S.uniformsList}function Fh(S,k){let J=X.get(S);J.outputColorSpace=k.outputColorSpace,J.batching=k.batching,J.batchingColor=k.batchingColor,J.instancing=k.instancing,J.instancingColor=k.instancingColor,J.instancingMorph=k.instancingMorph,J.skinning=k.skinning,J.morphTargets=k.morphTargets,J.morphNormals=k.morphNormals,J.morphColors=k.morphColors,J.morphTargetsCount=k.morphTargetsCount,J.numClippingPlanes=k.numClippingPlanes,J.numIntersection=k.numClipIntersection,J.vertexAlphas=k.vertexAlphas,J.vertexTangents=k.vertexTangents,J.toneMapping=k.toneMapping}function cf(S,k){if(S.length===0)return null;if(S.length===1)return S[0].texture!==null?S[0]:null;y.setFromMatrixPosition(k.matrixWorld);for(let J=0,q=S.length;J<q;J++){let Y=S[J];if(Y.texture!==null&&Y.boundingBox.containsPoint(y))return Y}return null}function hf(S,k,J,q,Y){k.isScene!==!0&&(k=Pt),K.resetTextureUnits();let St=k.fog,Rt=q.isMeshStandardMaterial||q.isMeshLambertMaterial||q.isMeshPhongMaterial?k.environment:null,bt=G===null?L.outputColorSpace:G.isXRRenderTarget===!0?G.texture.colorSpace:ne.workingColorSpace,Nt=q.isMeshStandardMaterial||q.isMeshLambertMaterial&&!q.envMap||q.isMeshPhongMaterial&&!q.envMap,zt=ht.get(q.envMap||Rt,Nt),te=q.vertexColors===!0&&!!J.attributes.color&&J.attributes.color.itemSize===4,re=!!J.attributes.tangent&&(!!q.normalMap||q.anisotropy>0),Ut=!!J.morphAttributes.position,ue=!!J.morphAttributes.normal,Ce=!!J.morphAttributes.color,Me=fi;q.toneMapped&&(G===null||G.isXRRenderTarget===!0)&&(Me=L.toneMapping);let me=J.morphAttributes.position||J.morphAttributes.normal||J.morphAttributes.color,qe=me!==void 0?me.length:0,At=X.get(q),Ke=E.state.lights;if(at===!0&&(st===!0||S!==W)){let ye=S===W&&q.id===V;Lt.setState(q,S,ye)}let ae=!1;q.version===At.__version?(At.needsLights&&At.lightsStateVersion!==Ke.state.version||At.outputColorSpace!==bt||Y.isBatchedMesh&&At.batching===!1||!Y.isBatchedMesh&&At.batching===!0||Y.isBatchedMesh&&At.batchingColor===!0&&Y._colorsTexture===null||Y.isBatchedMesh&&At.batchingColor===!1&&Y._colorsTexture!==null||Y.isInstancedMesh&&At.instancing===!1||!Y.isInstancedMesh&&At.instancing===!0||Y.isSkinnedMesh&&At.skinning===!1||!Y.isSkinnedMesh&&At.skinning===!0||Y.isInstancedMesh&&At.instancingColor===!0&&Y.instanceColor===null||Y.isInstancedMesh&&At.instancingColor===!1&&Y.instanceColor!==null||Y.isInstancedMesh&&At.instancingMorph===!0&&Y.morphTexture===null||Y.isInstancedMesh&&At.instancingMorph===!1&&Y.morphTexture!==null||At.envMap!==zt||q.fog===!0&&At.fog!==St||At.numClippingPlanes!==void 0&&(At.numClippingPlanes!==Lt.numPlanes||At.numIntersection!==Lt.numIntersection)||At.vertexAlphas!==te||At.vertexTangents!==re||At.morphTargets!==Ut||At.morphNormals!==ue||At.morphColors!==Ce||At.toneMapping!==Me||At.morphTargetsCount!==qe||!!At.lightProbeGrid!=E.state.lightProbeGridArray.length>0)&&(ae=!0):(ae=!0,At.__version=q.version);let pi=At.currentProgram;ae===!0&&(pi=po(q,k,Y),w&&q.isNodeMaterial&&w.onUpdateProgram(q,pi,At));let Ni=!1,on=!1,jn=!1,pe=pi.getUniforms(),Ee=At.uniforms;if(v.useProgram(pi.program)&&(Ni=!0,on=!0,jn=!0),q.id!==V&&(V=q.id,on=!0),At.needsLights){let ye=cf(E.state.lightProbeGridArray,Y);At.lightProbeGrid!==ye&&(At.lightProbeGrid=ye,on=!0)}if(Ni||W!==S){v.buffers.depth.getReversed()&&S.reversedDepth!==!0&&(S._reversedDepth=!0,S.updateProjectionMatrix()),pe.setValue(F,"projectionMatrix",S.projectionMatrix),pe.setValue(F,"viewMatrix",S.matrixWorldInverse);let ln=pe.map.cameraPosition;ln!==void 0&&ln.setValue(F,ct.setFromMatrixPosition(S.matrixWorld)),R.logarithmicDepthBuffer&&pe.setValue(F,"logDepthBufFC",2/(Math.log(S.far+1)/Math.LN2)),(q.isMeshPhongMaterial||q.isMeshToonMaterial||q.isMeshLambertMaterial||q.isMeshBasicMaterial||q.isMeshStandardMaterial||q.isShaderMaterial)&&pe.setValue(F,"isOrthographic",S.isOrthographicCamera===!0),W!==S&&(W=S,on=!0,jn=!0)}if(At.needsLights&&(Ke.state.sunShadowMap.length>0&&pe.setValue(F,"sunShadowMap",Ke.state.sunShadowMap,K),Ke.state.directionalShadowMap.length>0&&pe.setValue(F,"directionalShadowMap",Ke.state.directionalShadowMap,K),Ke.state.spotShadowMap.length>0&&pe.setValue(F,"spotShadowMap",Ke.state.spotShadowMap,K),Ke.state.pointShadowMap.length>0&&pe.setValue(F,"pointShadowMap",Ke.state.pointShadowMap,K)),Y.isSkinnedMesh){pe.setOptional(F,Y,"bindMatrix"),pe.setOptional(F,Y,"bindMatrixInverse");let ye=Y.skeleton;ye&&(ye.boneTexture===null&&ye.computeBoneTexture(),pe.setValue(F,"boneTexture",ye.boneTexture,K))}Y.isBatchedMesh&&(pe.setOptional(F,Y,"batchingTexture"),pe.setValue(F,"batchingTexture",Y._matricesTexture,K),pe.setOptional(F,Y,"batchingIdTexture"),pe.setValue(F,"batchingIdTexture",Y._indirectTexture,K),pe.setOptional(F,Y,"batchingColorTexture"),Y._colorsTexture!==null&&pe.setValue(F,"batchingColorTexture",Y._colorsTexture,K));let an=J.morphAttributes;if((an.position!==void 0||an.normal!==void 0||an.color!==void 0)&&z.update(Y,J,pi),(on||At.receiveShadow!==Y.receiveShadow)&&(At.receiveShadow=Y.receiveShadow,pe.setValue(F,"receiveShadow",Y.receiveShadow)),(q.isMeshStandardMaterial||q.isMeshLambertMaterial||q.isMeshPhongMaterial)&&q.envMap===null&&k.environment!==null&&(Ee.envMapIntensity.value=k.environmentIntensity),Ee.dfgLUT!==void 0&&(Ee.dfgLUT.value=Pv()),on){if(pe.setValue(F,"toneMappingExposure",L.toneMappingExposure),At.needsLights&&uf(Ee,jn),St&&q.fog===!0&&kt.refreshFogUniforms(Ee,St),kt.refreshMaterialUniforms(Ee,q,j,Z,E.state.transmissionRenderTarget[S.id]),At.needsLights&&At.lightProbeGrid){let ye=At.lightProbeGrid;Ee.probesSH.value=ye.texture,Ee.probesMin.value.copy(ye.boundingBox.min),Ee.probesMax.value.copy(ye.boundingBox.max),Ee.probesResolution.value.copy(ye.resolution)}ks.upload(F,Uh(At),Ee,K)}if(q.isShaderMaterial&&q.uniformsNeedUpdate===!0&&(ks.upload(F,Uh(At),Ee,K),q.uniformsNeedUpdate=!1),q.isSpriteMaterial&&pe.setValue(F,"center",Y.center),pe.setValue(F,"modelViewMatrix",Y.modelViewMatrix),pe.setValue(F,"normalMatrix",Y.normalMatrix),pe.setValue(F,"modelMatrix",Y.matrixWorld),q.uniformsGroups!==void 0){let ye=q.uniformsGroups;for(let ln=0,Kn=ye.length;ln<Kn;ln++){let Bh=ye[ln];lt.update(Bh,pi),lt.bind(Bh,pi)}}return pi}function uf(S,k){S.ambientLightColor.needsUpdate=k,S.lightProbe.needsUpdate=k,S.sunLights.needsUpdate=k,S.sunLightShadows.needsUpdate=k,S.directionalLights.needsUpdate=k,S.directionalLightShadows.needsUpdate=k,S.pointLights.needsUpdate=k,S.pointLightShadows.needsUpdate=k,S.spotLights.needsUpdate=k,S.spotLightShadows.needsUpdate=k,S.rectAreaLights.needsUpdate=k,S.hemisphereLights.needsUpdate=k}function df(S){return S.isMeshLambertMaterial||S.isMeshToonMaterial||S.isMeshPhongMaterial||S.isMeshStandardMaterial||S.isShadowMaterial||S.isShaderMaterial&&S.lights===!0}this.getActiveCubeFace=function(){return B},this.getActiveMipmapLevel=function(){return O},this.getRenderTarget=function(){return G},this.setRenderTargetTextures=function(S,k,J){let q=X.get(S);q.__autoAllocateDepthBuffer=S.resolveDepthBuffer===!1,q.__autoAllocateDepthBuffer===!1&&(q.__useRenderToTexture=!1),X.get(S.texture).__webglTexture=k,X.get(S.depthTexture).__webglTexture=q.__autoAllocateDepthBuffer?void 0:J,q.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(S,k){let J=X.get(S);J.__webglFramebuffer=k,J.__useDefaultFramebuffer=k===void 0},this.setRenderTarget=function(S,k=0,J=0){G=S,B=k,O=J;let q=null,Y=!1,St=!1;if(S){let bt=X.get(S);if(bt.__useDefaultFramebuffer!==void 0){v.bindFramebuffer(F.FRAMEBUFFER,bt.__webglFramebuffer),$.copy(S.viewport),dt.copy(S.scissor),mt=S.scissorTest,v.viewport($),v.scissor(dt),v.setScissorTest(mt),V=-1;return}else if(bt.__webglFramebuffer===void 0)K.setupRenderTarget(S);else if(bt.__hasExternalTextures)K.rebindTextures(S,X.get(S.texture).__webglTexture,X.get(S.depthTexture).__webglTexture);else if(S.depthBuffer){let te=S.depthTexture;if(bt.__boundDepthTexture!==te){if(te!==null&&X.has(te)&&(S.width!==te.image.width||S.height!==te.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");K.setupDepthRenderbuffer(S)}}let Nt=S.texture;(Nt.isData3DTexture||Nt.isDataArrayTexture||Nt.isCompressedArrayTexture)&&(St=!0);let zt=X.get(S).__webglFramebuffer;S.isWebGLCubeRenderTarget?(Array.isArray(zt[k])?q=zt[k][J]:q=zt[k],Y=!0):S.samples>0&&K.useMultisampledRTT(S)===!1?q=X.get(S).__webglMultisampledFramebuffer:Array.isArray(zt)?q=zt[J]:q=zt,$.copy(S.viewport),dt.copy(S.scissor),mt=S.scissorTest}else $.copy(vt).multiplyScalar(j).floor(),dt.copy(Bt).multiplyScalar(j).floor(),mt=ie;if(J!==0&&(q=P),v.bindFramebuffer(F.FRAMEBUFFER,q)&&v.drawBuffers(S,q),v.viewport($),v.scissor(dt),v.setScissorTest(mt),Y){let bt=X.get(S.texture);F.framebufferTexture2D(F.FRAMEBUFFER,F.COLOR_ATTACHMENT0,F.TEXTURE_CUBE_MAP_POSITIVE_X+k,bt.__webglTexture,J)}else if(St){let bt=k;for(let Nt=0;Nt<S.textures.length;Nt++){let zt=X.get(S.textures[Nt]);F.framebufferTextureLayer(F.FRAMEBUFFER,F.COLOR_ATTACHMENT0+Nt,zt.__webglTexture,J,bt)}}else if(S!==null&&J!==0){let bt=X.get(S.texture);F.framebufferTexture2D(F.FRAMEBUFFER,F.COLOR_ATTACHMENT0,F.TEXTURE_2D,bt.__webglTexture,J)}V=-1};function Oh(S){let k=X.get(S);return(k.__readFormat!==S.format||k.__readType!==S.type)&&(k.__readFormat=S.format,k.__readType=S.type,k.__formatReadable=R.textureFormatReadable(S.format),k.__typeReadable=R.textureTypeReadable(S.type)),k}this.readRenderTargetPixels=function(S,k,J,q,Y,St,Rt,bt=0){if(!(S&&S.isWebGLRenderTarget)){qt("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Nt=X.get(S).__webglFramebuffer;if(S.isWebGLCubeRenderTarget&&Rt!==void 0&&(Nt=Nt[Rt]),Nt){v.bindFramebuffer(F.FRAMEBUFFER,Nt);try{let zt=S.textures[bt],te=zt.format,re=zt.type;S.textures.length>1&&F.readBuffer(F.COLOR_ATTACHMENT0+bt);let Ut=Oh(zt);if(Ut.__formatReadable===!1){qt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(Ut.__typeReadable===!1){qt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}k>=0&&k<=S.width-q&&J>=0&&J<=S.height-Y&&F.readPixels(k,J,q,Y,yt.convert(te),yt.convert(re),St)}finally{let zt=G!==null?X.get(G).__webglFramebuffer:null;v.bindFramebuffer(F.FRAMEBUFFER,zt)}}},this.readRenderTargetPixelsAsync=async function(S,k,J,q,Y,St,Rt,bt=0){if(!(S&&S.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Nt=X.get(S).__webglFramebuffer;if(S.isWebGLCubeRenderTarget&&Rt!==void 0&&(Nt=Nt[Rt]),Nt)if(k>=0&&k<=S.width-q&&J>=0&&J<=S.height-Y){v.bindFramebuffer(F.FRAMEBUFFER,Nt);let zt=S.textures[bt],te=zt.format,re=zt.type;S.textures.length>1&&F.readBuffer(F.COLOR_ATTACHMENT0+bt);let Ut=Oh(zt);if(Ut.__formatReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(Ut.__typeReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let ue=F.createBuffer();F.bindBuffer(F.PIXEL_PACK_BUFFER,ue),F.bufferData(F.PIXEL_PACK_BUFFER,St.byteLength,F.STREAM_READ),F.readPixels(k,J,q,Y,yt.convert(te),yt.convert(re),0),F.bindBuffer(F.PIXEL_PACK_BUFFER,null);let Ce=G!==null?X.get(G).__webglFramebuffer:null;v.bindFramebuffer(F.FRAMEBUFFER,Ce);let Me=F.fenceSync(F.SYNC_GPU_COMMANDS_COMPLETE,0);return F.flush(),await Zu(F,Me,4),F.bindBuffer(F.PIXEL_PACK_BUFFER,ue),F.getBufferSubData(F.PIXEL_PACK_BUFFER,0,St),F.bindBuffer(F.PIXEL_PACK_BUFFER,null),F.deleteBuffer(ue),F.deleteSync(Me),St}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(S,k=null,J=0){let q=Math.pow(2,-J),Y=Math.floor(S.image.width*q),St=Math.floor(S.image.height*q),Rt=k!==null?k.x:0,bt=k!==null?k.y:0;K.setTexture2D(S,0),F.copyTexSubImage2D(F.TEXTURE_2D,J,0,0,Rt,bt,Y,St),v.unbindTexture()},this.copyTextureToTexture=function(S,k,J=null,q=null,Y=0,St=0){let Rt,bt,Nt,zt,te,re,Ut,ue,Ce,Me=S.isCompressedTexture?S.mipmaps[St]:S.image;if(J!==null)Rt=J.max.x-J.min.x,bt=J.max.y-J.min.y,Nt=J.isBox3?J.max.z-J.min.z:1,zt=J.min.x,te=J.min.y,re=J.isBox3?J.min.z:0;else{let Ee=Math.pow(2,-Y);Rt=Math.floor(Me.width*Ee),bt=Math.floor(Me.height*Ee),S.isDataArrayTexture?Nt=Me.depth:S.isData3DTexture?Nt=Math.floor(Me.depth*Ee):Nt=1,zt=0,te=0,re=0}q!==null?(Ut=q.x,ue=q.y,Ce=q.z):(Ut=0,ue=0,Ce=0);let me=yt.convert(k.format),qe=yt.convert(k.type),At;k.isData3DTexture?(K.setTexture3D(k,0),At=F.TEXTURE_3D):k.isDataArrayTexture||k.isCompressedArrayTexture?(K.setTexture2DArray(k,0),At=F.TEXTURE_2D_ARRAY):(K.setTexture2D(k,0),At=F.TEXTURE_2D),v.activeTexture(F.TEXTURE0),v.pixelStorei(F.UNPACK_FLIP_Y_WEBGL,k.flipY),v.pixelStorei(F.UNPACK_PREMULTIPLY_ALPHA_WEBGL,k.premultiplyAlpha),v.pixelStorei(F.UNPACK_ALIGNMENT,k.unpackAlignment);let Ke=v.getParameter(F.UNPACK_ROW_LENGTH),ae=v.getParameter(F.UNPACK_IMAGE_HEIGHT),pi=v.getParameter(F.UNPACK_SKIP_PIXELS),Ni=v.getParameter(F.UNPACK_SKIP_ROWS),on=v.getParameter(F.UNPACK_SKIP_IMAGES);v.pixelStorei(F.UNPACK_ROW_LENGTH,Me.width),v.pixelStorei(F.UNPACK_IMAGE_HEIGHT,Me.height),v.pixelStorei(F.UNPACK_SKIP_PIXELS,zt),v.pixelStorei(F.UNPACK_SKIP_ROWS,te),v.pixelStorei(F.UNPACK_SKIP_IMAGES,re);let jn=S.isDataArrayTexture||S.isData3DTexture,pe=k.isDataArrayTexture||k.isData3DTexture;if(S.isDepthTexture){let Ee=X.get(S),an=X.get(k),ye=X.get(Ee.__renderTarget),ln=X.get(an.__renderTarget);v.bindFramebuffer(F.READ_FRAMEBUFFER,ye.__webglFramebuffer),v.bindFramebuffer(F.DRAW_FRAMEBUFFER,ln.__webglFramebuffer);for(let Kn=0;Kn<Nt;Kn++)jn&&(F.framebufferTextureLayer(F.READ_FRAMEBUFFER,F.COLOR_ATTACHMENT0,X.get(S).__webglTexture,Y,re+Kn),F.framebufferTextureLayer(F.DRAW_FRAMEBUFFER,F.COLOR_ATTACHMENT0,X.get(k).__webglTexture,St,Ce+Kn)),F.blitFramebuffer(zt,te,Rt,bt,Ut,ue,Rt,bt,F.DEPTH_BUFFER_BIT,F.NEAREST);v.bindFramebuffer(F.READ_FRAMEBUFFER,null),v.bindFramebuffer(F.DRAW_FRAMEBUFFER,null)}else if(Y!==0||S.isRenderTargetTexture||X.has(S)){let Ee=X.get(S),an=X.get(k);v.bindFramebuffer(F.READ_FRAMEBUFFER,I),v.bindFramebuffer(F.DRAW_FRAMEBUFFER,N);for(let ye=0;ye<Nt;ye++)jn?F.framebufferTextureLayer(F.READ_FRAMEBUFFER,F.COLOR_ATTACHMENT0,Ee.__webglTexture,Y,re+ye):F.framebufferTexture2D(F.READ_FRAMEBUFFER,F.COLOR_ATTACHMENT0,F.TEXTURE_2D,Ee.__webglTexture,Y),pe?F.framebufferTextureLayer(F.DRAW_FRAMEBUFFER,F.COLOR_ATTACHMENT0,an.__webglTexture,St,Ce+ye):F.framebufferTexture2D(F.DRAW_FRAMEBUFFER,F.COLOR_ATTACHMENT0,F.TEXTURE_2D,an.__webglTexture,St),Y!==0?F.blitFramebuffer(zt,te,Rt,bt,Ut,ue,Rt,bt,F.COLOR_BUFFER_BIT,F.NEAREST):pe?F.copyTexSubImage3D(At,St,Ut,ue,Ce+ye,zt,te,Rt,bt):F.copyTexSubImage2D(At,St,Ut,ue,zt,te,Rt,bt);v.bindFramebuffer(F.READ_FRAMEBUFFER,null),v.bindFramebuffer(F.DRAW_FRAMEBUFFER,null)}else pe?S.isDataTexture||S.isData3DTexture?F.texSubImage3D(At,St,Ut,ue,Ce,Rt,bt,Nt,me,qe,Me.data):k.isCompressedArrayTexture?F.compressedTexSubImage3D(At,St,Ut,ue,Ce,Rt,bt,Nt,me,Me.data):F.texSubImage3D(At,St,Ut,ue,Ce,Rt,bt,Nt,me,qe,Me):S.isDataTexture?F.texSubImage2D(F.TEXTURE_2D,St,Ut,ue,Rt,bt,me,qe,Me.data):S.isCompressedTexture?F.compressedTexSubImage2D(F.TEXTURE_2D,St,Ut,ue,Me.width,Me.height,me,Me.data):F.texSubImage2D(F.TEXTURE_2D,St,Ut,ue,Rt,bt,me,qe,Me);v.pixelStorei(F.UNPACK_ROW_LENGTH,Ke),v.pixelStorei(F.UNPACK_IMAGE_HEIGHT,ae),v.pixelStorei(F.UNPACK_SKIP_PIXELS,pi),v.pixelStorei(F.UNPACK_SKIP_ROWS,Ni),v.pixelStorei(F.UNPACK_SKIP_IMAGES,on),St===0&&k.generateMipmaps&&F.generateMipmap(At),v.unbindTexture()},this.initRenderTarget=function(S){X.get(S).__webglFramebuffer===void 0&&K.setupRenderTarget(S)},this.initTexture=function(S){S.isCubeTexture?K.setTextureCube(S,0):S.isData3DTexture?K.setTexture3D(S,0):S.isDataArrayTexture||S.isCompressedArrayTexture?K.setTexture2DArray(S,0):K.setTexture2D(S,0),v.unbindTexture()},this.resetState=function(){B=0,O=0,G=null,v.reset(),Et.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return wi}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;let e=this.getContext();e.drawingBufferColorSpace=ne._getDrawingBufferColorSpace(t),e.unpackColorSpace=ne._getUnpackColorSpace()}};var Ld={type:"change"},mh={type:"start"},Nd={type:"end"},gl=new Bn,Dd=new ti,Iv=Math.cos(70*Hc.DEG2RAD),Be=new D,oi=2*Math.PI,fe={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},ph=1e-6,_l=class extends Ur{constructor(t,e=null){super(t,e),this.state=fe.NONE,this.target=new D,this.cursor=new D,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:Mn.ROTATE,MIDDLE:Mn.DOLLY,RIGHT:Mn.PAN},this.touches={ONE:bn.ROTATE,TWO:bn.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._cursorStyle="auto",this._domElementKeyEvents=null,this._lastPosition=new D,this._lastQuaternion=new hi,this._lastTargetPosition=new D,this._quat=new hi().setFromUnitVectors(t.up,new D(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new Ls,this._sphericalDelta=new Ls,this._scale=1,this._panOffset=new D,this._rotateStart=new tt,this._rotateEnd=new tt,this._rotateDelta=new tt,this._panStart=new tt,this._panEnd=new tt,this._panDelta=new tt,this._dollyStart=new tt,this._dollyEnd=new tt,this._dollyDelta=new tt,this._dollyDirection=new D,this._mouse=new tt,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=Dv.bind(this),this._onPointerDown=Lv.bind(this),this._onPointerUp=Nv.bind(this),this._onContextMenu=Vv.bind(this),this._onMouseWheel=Ov.bind(this),this._onKeyDown=Bv.bind(this),this._onTouchStart=kv.bind(this),this._onTouchMove=zv.bind(this),this._onMouseDown=Uv.bind(this),this._onMouseMove=Fv.bind(this),this._interceptControlDown=Hv.bind(this),this._interceptControlUp=Gv.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}set cursorStyle(t){this._cursorStyle=t,t==="grab"?this.domElement.style.cursor="grab":this.domElement.style.cursor="auto"}get cursorStyle(){return this._cursorStyle}connect(t){super.connect(t),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.state=fe.NONE,this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents();let t=this.domElement.getRootNode();t.removeEventListener("keydown",this._interceptControlDown,{capture:!0}),t.removeEventListener("keyup",this._interceptControlUp,{capture:!0}),this._controlActive=!1,this._pointers.length=0,this._pointerPositions={},this.domElement.style.touchAction="",this.domElement.style.cursor="auto"}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(t){t.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=t}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(Ld),this.update(),this.state=fe.NONE}pan(t,e){this._pan(t,e),this.update()}dollyIn(t){this._dollyIn(t),this.update()}dollyOut(t){this._dollyOut(t),this.update()}rotateLeft(t){this._rotateLeft(t),this.update()}rotateUp(t){this._rotateUp(t),this.update()}update(t=null){let e=this.object.position;Be.copy(e).sub(this.target),Be.applyQuaternion(this._quat),this._spherical.setFromVector3(Be),this.autoRotate&&this.state===fe.NONE&&this._rotateLeft(this._getAutoRotationAngle(t)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let i=this.minAzimuthAngle,n=this.maxAzimuthAngle;isFinite(i)&&isFinite(n)&&(i<-Math.PI?i+=oi:i>Math.PI&&(i-=oi),n<-Math.PI?n+=oi:n>Math.PI&&(n-=oi),i<=n?this._spherical.theta=Math.max(i,Math.min(n,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(i+n)/2?Math.max(i,this._spherical.theta):Math.min(n,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let r=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{let o=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),r=o!=this._spherical.radius}if(Be.setFromSpherical(this._spherical),Be.applyQuaternion(this._quatInverse),e.copy(this.target).add(Be),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let o=null;if(this.object.isPerspectiveCamera){let a=Be.length();o=this._clampDistance(a*this._scale);let l=a-o;this.object.position.addScaledVector(this._dollyDirection,l),this.object.updateMatrixWorld(),r=!!l}else if(this.object.isOrthographicCamera){let a=new D(this._mouse.x,this._mouse.y,0);a.unproject(this.object);let l=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),r=l!==this.object.zoom;let c=new D(this._mouse.x,this._mouse.y,0);c.unproject(this.object),this.object.position.sub(c).add(a),this.object.updateMatrixWorld(),o=Be.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;o!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(o).add(this.object.position):(gl.origin.copy(this.object.position),gl.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(gl.direction))<Iv?this.object.lookAt(this.target):(Dd.setFromNormalAndCoplanarPoint(this.object.up,this.target),gl.intersectPlane(Dd,this.target))))}else if(this.object.isOrthographicCamera){let o=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),o!==this.object.zoom&&(this.object.updateProjectionMatrix(),r=!0)}return this._scale=1,this._performCursorZoom=!1,r||this._lastPosition.distanceToSquared(this.object.position)>ph||8*(1-this._lastQuaternion.dot(this.object.quaternion))>ph||this._lastTargetPosition.distanceToSquared(this.target)>ph?(this.dispatchEvent(Ld),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(t){return t!==null?oi/60*this.autoRotateSpeed*t:oi/60/60*this.autoRotateSpeed}_getZoomScale(t){let e=Math.abs(t*.01);return Math.pow(.95,this.zoomSpeed*e)}_rotateLeft(t){this._sphericalDelta.theta-=t}_rotateUp(t){this._sphericalDelta.phi-=t}_panLeft(t,e){Be.setFromMatrixColumn(e,0),Be.multiplyScalar(-t),this._panOffset.add(Be)}_panUp(t,e){this.screenSpacePanning===!0?Be.setFromMatrixColumn(e,1):(Be.setFromMatrixColumn(e,0),Be.crossVectors(this.object.up,Be)),Be.multiplyScalar(t),this._panOffset.add(Be)}_pan(t,e){let i=this.domElement;if(this.object.isPerspectiveCamera){let n=this.object.position;Be.copy(n).sub(this.target);let r=Be.length();r*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*t*r/i.clientHeight,this.object.matrix),this._panUp(2*e*r/i.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(t*(this.object.right-this.object.left)/this.object.zoom/i.clientWidth,this.object.matrix),this._panUp(e*(this.object.top-this.object.bottom)/this.object.zoom/i.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(t){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=t:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(t){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=t:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(t,e){if(!this.zoomToCursor)return;this._performCursorZoom=!0;let i=this.domElement.getBoundingClientRect(),n=t-i.left,r=e-i.top,o=i.width,a=i.height;this._mouse.x=n/o*2-1,this._mouse.y=-(r/a)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(t){return Math.max(this.minDistance,Math.min(this.maxDistance,t))}_handleMouseDownRotate(t){this._rotateStart.set(t.clientX,t.clientY)}_handleMouseDownDolly(t){this._updateZoomParameters(t.clientX,t.clientX),this._dollyStart.set(t.clientX,t.clientY)}_handleMouseDownPan(t){this._panStart.set(t.clientX,t.clientY)}_handleMouseMoveRotate(t){this._rotateEnd.set(t.clientX,t.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let e=this.domElement;this._rotateLeft(oi*this._rotateDelta.x/e.clientHeight),this._rotateUp(oi*this._rotateDelta.y/e.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(t){this._dollyEnd.set(t.clientX,t.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(t){this._panEnd.set(t.clientX,t.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(t){this._updateZoomParameters(t.clientX,t.clientY),t.deltaY<0?this._dollyIn(this._getZoomScale(t.deltaY)):t.deltaY>0&&this._dollyOut(this._getZoomScale(t.deltaY)),this.update()}_handleKeyDown(t){let e=!1;switch(t.code){case this.keys.UP:t.ctrlKey||t.metaKey||t.shiftKey?this.enableRotate&&this._rotateUp(oi*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),e=!0;break;case this.keys.BOTTOM:t.ctrlKey||t.metaKey||t.shiftKey?this.enableRotate&&this._rotateUp(-oi*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),e=!0;break;case this.keys.LEFT:t.ctrlKey||t.metaKey||t.shiftKey?this.enableRotate&&this._rotateLeft(oi*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),e=!0;break;case this.keys.RIGHT:t.ctrlKey||t.metaKey||t.shiftKey?this.enableRotate&&this._rotateLeft(-oi*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),e=!0;break}e&&(t.preventDefault(),this.update())}_handleTouchStartRotate(t){if(this._pointers.length===1)this._rotateStart.set(t.pageX,t.pageY);else{let e=this._getSecondPointerPosition(t),i=.5*(t.pageX+e.x),n=.5*(t.pageY+e.y);this._rotateStart.set(i,n)}}_handleTouchStartPan(t){if(this._pointers.length===1)this._panStart.set(t.pageX,t.pageY);else{let e=this._getSecondPointerPosition(t),i=.5*(t.pageX+e.x),n=.5*(t.pageY+e.y);this._panStart.set(i,n)}}_handleTouchStartDolly(t){let e=this._getSecondPointerPosition(t),i=t.pageX-e.x,n=t.pageY-e.y,r=Math.sqrt(i*i+n*n);this._dollyStart.set(0,r)}_handleTouchStartDollyPan(t){this.enableZoom&&this._handleTouchStartDolly(t),this.enablePan&&this._handleTouchStartPan(t)}_handleTouchStartDollyRotate(t){this.enableZoom&&this._handleTouchStartDolly(t),this.enableRotate&&this._handleTouchStartRotate(t)}_handleTouchMoveRotate(t){if(this._pointers.length==1)this._rotateEnd.set(t.pageX,t.pageY);else{let i=this._getSecondPointerPosition(t),n=.5*(t.pageX+i.x),r=.5*(t.pageY+i.y);this._rotateEnd.set(n,r)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let e=this.domElement;this._rotateLeft(oi*this._rotateDelta.x/e.clientHeight),this._rotateUp(oi*this._rotateDelta.y/e.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(t){if(this._pointers.length===1)this._panEnd.set(t.pageX,t.pageY);else{let e=this._getSecondPointerPosition(t),i=.5*(t.pageX+e.x),n=.5*(t.pageY+e.y);this._panEnd.set(i,n)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(t){let e=this._getSecondPointerPosition(t),i=t.pageX-e.x,n=t.pageY-e.y,r=Math.sqrt(i*i+n*n);this._dollyEnd.set(0,r),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);let o=(t.pageX+e.x)*.5,a=(t.pageY+e.y)*.5;this._updateZoomParameters(o,a)}_handleTouchMoveDollyPan(t){this.enableZoom&&this._handleTouchMoveDolly(t),this.enablePan&&this._handleTouchMovePan(t)}_handleTouchMoveDollyRotate(t){this.enableZoom&&this._handleTouchMoveDolly(t),this.enableRotate&&this._handleTouchMoveRotate(t)}_addPointer(t){this._pointers.push(t.pointerId)}_removePointer(t){delete this._pointerPositions[t.pointerId];for(let e=0;e<this._pointers.length;e++)if(this._pointers[e]==t.pointerId){this._pointers.splice(e,1);return}}_isTrackingPointer(t){for(let e=0;e<this._pointers.length;e++)if(this._pointers[e]==t.pointerId)return!0;return!1}_trackPointer(t){let e=this._pointerPositions[t.pointerId];e===void 0&&(e=new tt,this._pointerPositions[t.pointerId]=e),e.set(t.pageX,t.pageY)}_getSecondPointerPosition(t){let e=t.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[e]}_customWheelEvent(t){let e=t.deltaMode,i={clientX:t.clientX,clientY:t.clientY,deltaY:t.deltaY};switch(e){case 1:i.deltaY*=16;break;case 2:i.deltaY*=100;break}return t.ctrlKey&&!this._controlActive&&(i.deltaY*=10),i}};function Lv(s){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(s.pointerId),this.domElement.ownerDocument.addEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(s)&&(this._addPointer(s),s.pointerType==="touch"?this._onTouchStart(s):this._onMouseDown(s),this._cursorStyle==="grab"&&(this.domElement.style.cursor="grabbing")))}function Dv(s){this.enabled!==!1&&(s.pointerType==="touch"?this._onTouchMove(s):this._onMouseMove(s))}function Nv(s){switch(this._removePointer(s),this._pointers.length){case 0:this.domElement.releasePointerCapture(s.pointerId),this.domElement.ownerDocument.removeEventListener("pointermove",this._onPointerMove),this.domElement.ownerDocument.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(Nd),this.state=fe.NONE,this._cursorStyle==="grab"&&(this.domElement.style.cursor="grab");break;case 1:let t=this._pointers[0],e=this._pointerPositions[t];this._onTouchStart({pointerId:t,pageX:e.x,pageY:e.y});break}}function Uv(s){let t;switch(s.button){case 0:t=this.mouseButtons.LEFT;break;case 1:t=this.mouseButtons.MIDDLE;break;case 2:t=this.mouseButtons.RIGHT;break;default:t=-1}switch(t){case Mn.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(s),this.state=fe.DOLLY;break;case Mn.ROTATE:if(s.ctrlKey||s.metaKey||s.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(s),this.state=fe.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(s),this.state=fe.ROTATE}break;case Mn.PAN:if(s.ctrlKey||s.metaKey||s.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(s),this.state=fe.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(s),this.state=fe.PAN}break;default:this.state=fe.NONE}this.state!==fe.NONE&&this.dispatchEvent(mh)}function Fv(s){switch(this.state){case fe.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(s);break;case fe.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(s);break;case fe.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(s);break}}function Ov(s){this.enabled===!1||this.enableZoom===!1||this.state!==fe.NONE||(s.preventDefault(),this.dispatchEvent(mh),this._handleMouseWheel(this._customWheelEvent(s)),this.dispatchEvent(Nd))}function Bv(s){this.enabled!==!1&&this._handleKeyDown(s)}function kv(s){switch(this._trackPointer(s),this._pointers.length){case 1:switch(this.touches.ONE){case bn.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(s),this.state=fe.TOUCH_ROTATE;break;case bn.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(s),this.state=fe.TOUCH_PAN;break;default:this.state=fe.NONE}break;case 2:switch(this.touches.TWO){case bn.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(s),this.state=fe.TOUCH_DOLLY_PAN;break;case bn.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(s),this.state=fe.TOUCH_DOLLY_ROTATE;break;default:this.state=fe.NONE}break;default:this.state=fe.NONE}this.state!==fe.NONE&&this.dispatchEvent(mh)}function zv(s){switch(this._trackPointer(s),this.state){case fe.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(s),this.update();break;case fe.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(s),this.update();break;case fe.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(s),this.update();break;case fe.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(s),this.update();break;default:this.state=fe.NONE}}function Vv(s){this.enabled!==!1&&s.preventDefault()}function Hv(s){s.key==="Control"&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function Gv(s){s.key==="Control"&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}var io=class s extends Zt{constructor(t,e={}){super(t),this.isReflector=!0,this.type="Reflector",this.forceUpdate=!1,this._reflectionCameras=new WeakMap;let i=this,n=e.color!==void 0?new Vt(e.color):new Vt(8355711),r=e.textureWidth||512,o=e.textureHeight||512,a=e.clipBias||0,l=e.shader||s.ReflectorShader,c=e.multisample!==void 0?e.multisample:4,h=new ti,f=new D,u=new D,d=new D,m=new oe,_=new D(0,0,-1),p=new _e,g=new D,M=new D,T=new _e,y=new oe,b=new ve(r,o,{samples:c,type:we}),E=new ce({name:l.name!==void 0?l.name:"unspecified",uniforms:Ue.clone(l.uniforms),fragmentShader:l.fragmentShader,vertexShader:l.vertexShader});E.uniforms.tDiffuse.value=b.texture,E.uniforms.color.value=n,E.uniforms.textureMatrix.value=y,this.material=E,this.onBeforeRender=function(C,x,A){let L=this.getReflectionCamera(A);if(u.setFromMatrixPosition(i.matrixWorld),d.setFromMatrixPosition(A.matrixWorld),m.extractRotation(i.matrixWorld),f.set(0,0,1),f.applyMatrix4(m),g.subVectors(u,d),g.dot(f)>0===!0&&this.forceUpdate===!1)return;g.reflect(f).negate(),g.add(u),m.extractRotation(A.matrixWorld),_.set(0,0,-1),_.applyMatrix4(m),_.add(d),M.subVectors(u,_),M.reflect(f).negate(),M.add(u),L.position.copy(g),L.up.set(0,1,0),L.up.applyMatrix4(m),L.up.reflect(f),L.lookAt(M),L.far=A.far,L.updateMatrixWorld(),L.projectionMatrix.copy(A.projectionMatrix),y.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),y.multiply(L.projectionMatrix),y.multiply(L.matrixWorldInverse),y.multiply(i.matrixWorld),h.setFromNormalAndCoplanarPoint(f,u),h.applyMatrix4(L.matrixWorldInverse),p.set(h.normal.x,h.normal.y,h.normal.z,h.constant);let w=L.projectionMatrix;L.isOrthographicCamera?(T.x=(Math.sign(p.x)+w.elements[8])/w.elements[0],T.y=(Math.sign(p.y)+w.elements[9])/w.elements[5],T.z=-A.far,T.w=1):(T.x=(Math.sign(p.x)+w.elements[8])/w.elements[0],T.y=(Math.sign(p.y)+w.elements[9])/w.elements[5],T.z=-1,T.w=(1+w.elements[10])/w.elements[14]),p.multiplyScalar(2/p.dot(T)),w.elements[2]=p.x,w.elements[6]=p.y,L.isOrthographicCamera?(w.elements[10]=p.z-a,w.elements[14]=p.w-1):(w.elements[10]=p.z+1-a,w.elements[14]=p.w),i.visible=!1;let P=C.getRenderTarget(),I=C.xr.enabled,N=C.shadowMap.autoUpdate;C.xr.enabled=!1,C.shadowMap.autoUpdate=!1,C.setRenderTarget(b),C.state.buffers.depth.setMask(!0),C.autoClear===!1&&C.clear(),C.render(x,L),C.xr.enabled=I,C.shadowMap.autoUpdate=N,C.setRenderTarget(P);let B=A.viewport;B!==void 0&&C.state.viewport(B),i.visible=!0,this.forceUpdate=!1},this.getRenderTarget=function(){return b},this.dispose=function(){b.dispose(),i.material.dispose()},this.getReflectionCamera=function(C){let x=this._reflectionCameras.get(C);return x===void 0&&(x=C.clone(),this._reflectionCameras.set(C,x)),x}}};io.ReflectorShader={name:"ReflectorShader",uniforms:{color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null}},vertexShader:`
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

		}`};var Tt=256;function Ud(s){let t=s>>>0;return()=>(t=t*1664525+1013904223>>>0,t/4294967296)}function Fd(s,t,e){let i=Ud(e),n=new Float32Array((t+1)*(t+1));for(let l=0;l<n.length;l++)n[l]=i();let r=new Float32Array(s*s),o=(l,c)=>n[(c%t+t)%t*(t+1)+(l%t+t)%t],a=l=>l*l*(3-2*l);for(let l=0;l<s;l++){let c=l/s*t,h=Math.floor(c),f=a(c-h);for(let u=0;u<s;u++){let d=u/s*t,m=Math.floor(d),_=a(d-m),p=o(m,h),g=o(m+1,h),M=o(m,h+1),T=o(m+1,h+1);r[l*s+u]=(p*(1-_)+g*_)*(1-f)+(M*(1-_)+T*_)*f}}return r}function Xi(s,t,e=4,i=4){let n=new Float32Array(s*s),r=.5,o=0;for(let a=0;a<e;a++){let l=Fd(s,i<<a,t+a*97);for(let c=0;c<n.length;c++)n[c]+=l[c]*r;o+=r,r*=.5}for(let a=0;a<n.length;a++)n[a]/=o;return n}function gh(s,t){let e=document.createElement("canvas");e.width=e.height=Tt;let i=e.getContext("2d"),n=i.createImageData(Tt,Tt);n.data.set(s),i.putImageData(n,0,0);let r=new kn(e);return r.wrapS=r.wrapT=gi,r.colorSpace=t?Pe:Pi,r.anisotropy=4,r.needsUpdate=!0,r}function Wv(s,t){let e=new Uint8ClampedArray(Tt*Tt*4),i=(n,r)=>s[(r+Tt)%Tt*Tt+(n+Tt)%Tt];for(let n=0;n<Tt;n++)for(let r=0;r<Tt;r++){let o=i(r+1,n-1)+2*i(r+1,n)+i(r+1,n+1)-(i(r-1,n-1)+2*i(r-1,n)+i(r-1,n+1)),a=i(r-1,n+1)+2*i(r,n+1)+i(r+1,n+1)-(i(r-1,n-1)+2*i(r,n-1)+i(r+1,n-1)),l=-o*t,c=-a*t,h=1,f=Math.hypot(l,c,h);l/=f,c/=f,h/=f;let u=(n*Tt+r)*4;e[u]=(l*.5+.5)*255,e[u+1]=(c*.5+.5)*255,e[u+2]=(h*.5+.5)*255,e[u+3]=255}return e}function Li(s){let t=new Uint8ClampedArray(Tt*Tt*4);for(let e=0;e<Tt;e++)for(let i=0;i<Tt;i++){let n=(e*Tt+i)*4,[r,o,a]=s(i,e,e*Tt+i);t[n]=r,t[n+1]=o,t[n+2]=a,t[n+3]=255}return t}var _h=(s,t,e)=>s+(t-s)*e,Ii=(s,t,e)=>[_h(s[0],t[0],e),_h(s[1],t[1],e),_h(s[2],t[2],e)],Ve={oak(s){let t=Xi(Tt,s,5,2),e=6,i=Tt/e,n=Ud(s+11),r=Array.from({length:e},()=>Math.floor(n()*Tt)),o=Array.from({length:e},()=>.85+n()*.3),a=Li((h,f,u)=>{let d=Math.floor(h/i),m=(f+r[d])%Tt,_=t[m*Tt+h*3%Tt],p=.5+.5*Math.sin(h/i*Math.PI*14+_*9),g=Ii([176,128,82],[214,172,120],_*.7+p*.3),M=h%i<2||m%(Tt/2)<2?.55:1,T=o[d]*M;return[g[0]*T,g[1]*T,g[2]*T]}),l=new Float32Array(Tt*Tt),c=new Float32Array(Tt*Tt);for(let h=0;h<Tt;h++)for(let f=0;f<Tt;f++){let u=Math.floor(f/i),d=(h+r[u])%Tt,m=f%i<2||d%(Tt/2)<2?0:1,_=h*Tt+f;l[_]=.7*m+.3*t[_],c[_]=.45+.25*t[_]}return{color:a,height:l,rough:c}},tiles(s,t){let e=Xi(Tt,s,3,8),n=Tt/4,r=Li((l,c,h)=>{let f=l%n,u=c%n,d=f<3||u<3,m=Math.floor(l/n),_=Math.floor(c/n),p=e[h]*.25+(m*7+_*13)%5*.03,g=t?Ii([222,224,226],[240,241,243],p*1.5):Ii([150,156,164],[188,192,198],p*1.5);return d?[g[0]*.72,g[1]*.72,g[2]*.72]:g}),o=new Float32Array(Tt*Tt),a=new Float32Array(Tt*Tt);for(let l=0;l<Tt;l++)for(let c=0;c<Tt;c++){let h=l*Tt+c,f=c%n<3||l%n<3;o[h]=f?0:1-e[h]*.08,a[h]=f?.95:t?.18+e[h]*.1:.3+e[h]*.15}return{color:r,height:o,rough:a}},plaster(s,t){let e=Xi(Tt,s,5,6),i=Li((r,o,a)=>Ii(t[0],t[1],e[a])),n=new Float32Array(Tt*Tt);for(let r=0;r<n.length;r++)n[r]=.82+e[r]*.15;return{color:i,height:e,rough:n}},concrete(s){let t=Xi(Tt,s,6,3),e=Fd(Tt,64,s+5),i=Li((r,o,a)=>{let l=t[a]*.8+(e[a]>.93?-.25:0);return Ii([128,130,134],[168,170,174],l)}),n=new Float32Array(Tt*Tt);for(let r=0;r<n.length;r++)n[r]=.7+t[r]*.25;return{color:i,height:t,rough:n}},carpet(s){let t=Xi(Tt,s,6,16),e=Li((n,r,o)=>Ii([96,110,132],[128,140,160],t[o])),i=new Float32Array(Tt*Tt).fill(.95);return{color:e,height:t,rough:i}},fabric(s,t){let e=Xi(Tt,s,5,24),i=Li((r,o,a)=>{let l=.5+.5*Math.sin(r*.8)*Math.sin(o*.8);return Ii(t[0],t[1],e[a]*.6+l*.4)}),n=new Float32Array(Tt*Tt).fill(.9);return{color:i,height:e,rough:n}},wood(s,t){let e=Xi(Tt,s,4,2),i=Li((r,o,a)=>{let l=.5+.5*Math.sin(o*.12+e[a]*7);return Ii(t[0],t[1],l*.6+e[a]*.4)}),n=new Float32Array(Tt*Tt);for(let r=0;r<n.length;r++)n[r]=.4+e[r]*.2;return{color:i,height:e,rough:n}},metal(s){let t=Xi(Tt,s,4,32),e=Li((n,r,o)=>Ii([150,152,156],[190,192,196],t[o])),i=new Float32Array(Tt*Tt);for(let n=0;n<i.length;n++)i[n]=.3+t[n]*.2;return{color:e,height:t,rough:i}},asphalt(s){let t=Xi(Tt,s,6,12),e=Li((n,r,o)=>Ii([58,60,64],[92,94,98],t[o])),i=new Float32Array(Tt*Tt).fill(.92);return{color:e,height:t,rough:i}},grass(s){let t=Xi(Tt,s,6,10),e=Li((n,r,o)=>Ii([74,112,52],[118,156,74],t[o])),i=new Float32Array(Tt*Tt).fill(.95);return{color:e,height:t,rough:i}}},no={plaster_white:{recipe:()=>Ve.plaster(31,[[226,223,216],[242,240,236]]),tile_m:2,normal:.5,roughness:1},plaster_exterior:{recipe:()=>Ve.plaster(47,[[200,194,182],[222,217,208]]),tile_m:2,normal:1,roughness:1},plaster_ceiling:{recipe:()=>Ve.plaster(53,[[236,236,234],[248,248,246]]),tile_m:2,normal:.3,roughness:1},concrete:{recipe:()=>Ve.concrete(61),tile_m:2.5,normal:1.5,roughness:1},tiles_white:{recipe:()=>Ve.tiles(71,!0),tile_m:1.2,normal:2.2,roughness:1},tiles_grey:{recipe:()=>Ve.tiles(79,!1),tile_m:1.6,normal:2.2,roughness:1},oak:{recipe:()=>Ve.oak(83),tile_m:1.5,normal:2,roughness:1},carpet:{recipe:()=>Ve.carpet(89),tile_m:1,normal:1,roughness:1},fabric_grey:{recipe:()=>Ve.fabric(97,[[112,118,128],[150,156,166]]),tile_m:.6,normal:1,roughness:1},fabric_blue:{recipe:()=>Ve.fabric(101,[[54,82,128],[84,116,168]]),tile_m:.6,normal:1,roughness:1},linen:{recipe:()=>Ve.fabric(103,[[214,210,200],[238,236,230]]),tile_m:.8,normal:.8,roughness:1},wood_light:{recipe:()=>Ve.wood(107,[[196,160,118],[226,196,156]]),tile_m:1,normal:1,roughness:1},wood_dark:{recipe:()=>Ve.wood(109,[[92,64,44],[128,94,66]]),tile_m:1,normal:1,roughness:1},door_wood:{recipe:()=>Ve.wood(113,[[150,108,72],[186,142,100]]),tile_m:1,normal:1.2,roughness:1},metal_dark:{recipe:()=>Ve.metal(127),tile_m:.5,normal:.6,roughness:1,metalness:.9,color:3817286},metal_light:{recipe:()=>Ve.metal(131),tile_m:.5,normal:.6,roughness:1,metalness:.85},asphalt:{recipe:()=>Ve.asphalt(137),tile_m:3,normal:1.5,roughness:1},grass:{recipe:()=>Ve.grass(139),tile_m:2,normal:1,roughness:1}},Xv={plaster_white:14147046,plaster_exterior:13226460,plaster_ceiling:15922423,concrete:11844034,tiles_white:15330802,tiles_grey:13028565,oak:13940106,carpet:9280435,fabric_grey:10135480,fabric_blue:5601194,linen:15262940,wood_light:13610628,wood_dark:8018498,door_wood:11044446,metal_dark:4937063,metal_light:11910344,asphalt:5922147,grass:7314518},vl=class{constructor(){this.cache=new Map,this.materials=new Map,this.bytes=0}textures(t){let e=this.cache.get(t);if(e)return e;let i=no[t]||no.plaster_white,{color:n,height:r,rough:o}=i.recipe(),a=gh(n,!0),l=gh(Wv(r,i.normal),!1),c=Li((f,u,d)=>{let m=Math.max(0,Math.min(1,o[d]))*255;return[m,m,m]}),h=gh(c,!1);return e={map:a,normalMap:l,roughnessMap:h,tile_m:i.tile_m,spec:i},this.bytes+=Tt*Tt*4*3*1.33,this.cache.set(t,e),e}get(t,e,i={}){let n=`${t}|${e}|${i.side||0}|${i.emissive||""}`,r=this.materials.get(n);if(r)return r;let o=Xv[t]??13421772,a=no[t]||{};if(e>=3){let l=this.textures(t);r=new We({map:l.map,normalMap:l.normalMap,roughnessMap:l.roughnessMap,roughness:1,metalness:a.metalness??0,color:a.color??16777215,envMapIntensity:.6}),a.metalness&&(r.color.setHex(a.color??16777215),r.metalnessMap=null)}else e===2?r=new We({color:o,roughness:.85,metalness:a.metalness?.6:0}):r=new Tr({color:o});return i.side&&(r.side=i.side),this.materials.set(n,r),r}tileM(t){return(no[t]||no.plaster_white).tile_m}dispose(){for(let t of this.cache.values())t.map.dispose(),t.normalMap.dispose(),t.roughnessMap.dispose();for(let t of this.materials.values())t.dispose();this.cache.clear(),this.materials.clear(),this.bytes=0}};function Bd(s,t=!1){let e=s[0].index!==null,i=new Set(Object.keys(s[0].attributes)),n=new Set(Object.keys(s[0].morphAttributes)),r={},o={},a=s[0].morphTargetsRelative,l=new De,c=0;for(let h=0;h<s.length;++h){let f=s[h],u=0;if(e!==(f.index!==null))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(let d in f.attributes){if(!i.has(d))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+'. All geometries must have compatible attributes; make sure "'+d+'" attribute exists among all geometries, or in none of them.'),null;r[d]===void 0&&(r[d]=[]),r[d].push(f.attributes[d]),u++}if(u!==i.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". Make sure all geometries have the same number of attributes."),null;if(a!==f.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(let d in f.morphAttributes){if(!n.has(d))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+".  .morphAttributes must be consistent throughout all geometries."),null;o[d]===void 0&&(o[d]=[]),o[d].push(f.morphAttributes[d])}if(t){let d;if(e)d=f.index.count;else if(f.attributes.position!==void 0)d=f.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". The geometry must have either an index or a position attribute"),null;l.addGroup(c,d,h),c+=d}}if(e){let h=0,f=[];for(let u=0;u<s.length;++u){let d=s[u].index;for(let m=0;m<d.count;++m)f.push(d.getX(m)+h);h+=s[u].attributes.position.count}l.setIndex(f)}for(let h in r){let f=Od(r[h]);if(!f)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" attribute."),null;l.setAttribute(h,f)}for(let h in o){let f=o[h][0].length;if(f!==0){l.morphAttributes=l.morphAttributes||{},l.morphAttributes[h]=[];for(let u=0;u<f;++u){let d=[];for(let _=0;_<o[h].length;++_)d.push(o[h][_][u]);let m=Od(d);if(!m)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" morphAttribute."),null;l.morphAttributes[h].push(m)}}}return l}function Od(s){let t,e,i,n=-1,r=0;for(let c=0;c<s.length;++c){let h=s[c];if(t===void 0&&(t=h.array.constructor),t!==h.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(e===void 0&&(e=h.itemSize),e!==h.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(i===void 0&&(i=h.normalized),i!==h.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(n===-1&&(n=h.gpuType),n!==h.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;r+=h.count*e}let o=new t(r),a=new Le(o,e,i),l=0;for(let c=0;c<s.length;++c){let h=s[c];if(h.isInterleavedBufferAttribute){let f=l/e;for(let u=0,d=h.count;u<d;u++)for(let m=0;m<e;m++){let _=h.getComponent(u,m);a.setComponent(u+f,m,_)}}else o.set(h.array,l);l+=h.count*e}return n!==void 0&&(a.gpuType=n),a}var qv=["open","opening","on"],xl=s=>!!s&&qv.includes(s),kd=(s,t)=>s.id<t.id?-1:s.id>t.id?1:0;function Yv(s){let t=s.dimensions,e=t.scale_m_per_px,i=t.calibration&&t.calibration.status;return typeof e=="number"&&Number.isFinite(e)&&e>0&&(i==="measured"||i==="estimated")?{scale:e,estimated:i==="estimated"}:{scale:.2/(.006*(t.width_px||1e3)),estimated:!0}}function Zv(s){let t=[0];for(let e=1;e<s.length;e++)t.push(t[e-1]+Math.hypot(s[e][0]-s[e-1][0],s[e][1]-s[e-1][1]));return t}function vh(s,t,e){let i=0;for(;i<s.length-2&&e>t[i+1];)i++;let[n,r]=s[i],[o,a]=s[i+1],l=t[i+1]-t[i];if(l<=1e-9)return{p:[n,r],d:[1,0]};let c=Math.min(1,Math.max(0,(e-t[i])/l));return{p:[n+(o-n)*c,r+(a-r)*c],d:[(o-n)/l,(a-r)/l]}}function $v(s,t,e,i){let n=[];for(let r=1;r<s.length-1;r++)e<t[r]&&t[r]<i&&n.push(s[r]);return[vh(s,t,e).p,...n,vh(s,t,i).p]}var zd=(s,t,e)=>{let i=s[0]-t[0],n=s[1]-t[1],r=Math.hypot(i,n);return r<1e-9?s:[s[0]+i/r*e,s[1]+n/r*e]},Vd=(s,t,e)=>[s[0]+t[0]*e,s[1]+t[1]*e];function so(s,t,e,i){let{scale:n}=Yv(s),r=1/n,o=new Map;for(let h of s.openings){let f=o.get(h.wall_id);f?f.push(h):o.set(h.wall_id,[h])}let a=[],l=new Map;for(let h of[...new Map(s.walls.map(f=>[f.id,f])).values()].sort(kd)){if(i!=null&&h.level_id!==i)continue;let f=h.polyline.map(T=>[T[0]*t,T[1]*e]),u=Zv(f),d=u[u.length-1];if(d<=1e-6)continue;let m=Math.max(1,(h.thickness_m||.2)*r);l.set(h.id,{pts:f,cum:u,wpx:m,wall:h});let _=(o.get(h.id)||[]).map(T=>{let y=(T.t||0)*d,b=(T.width_m||0)*r/2;return[Math.max(0,y-b),Math.min(d,y+b)]});_.sort((T,y)=>T[0]-y[0]||T[1]-y[1]);let p=[],g=0;for(let[T,y]of _)T>g&&p.push([g,T]),g=Math.max(g,y);g<d&&p.push([g,d]);let M=0;for(let[T,y]of p){if(y-T<=.01)continue;let b=$v(f,u,T,y);T<=0&&(b[0]=zd(b[0],b[1],m/2)),y>=d&&(b[b.length-1]=zd(b[b.length-1],b[b.length-2],m/2)),a.push({id:h.id,part:M,points:b,width:m,wall:h}),M+=1}}let c=[];for(let h of[...s.openings].sort(kd)){let f=l.get(h.wall_id);if(!f)continue;let{p:u,d}=vh(f.pts,f.cum,(h.t||0)*f.cum[f.cum.length-1]),m=(h.width_m||0)*r;c.push({opening:h,wall:f.wall,c:u,d,g0:Vd(u,d,-m/2),g1:Vd(u,d,m/2),w:m,wpx:f.wpx})}return{walls:a,openings:c,scale:n}}function xh(s,t,e,i,n,r={}){let{walls:o,openings:a}=so(s,t,e,i),l=[];for(let c of o)if(!(r.bodyOnly===!1&&(c.wall.kind==="railing"||c.wall.kind==="low")))for(let h=1;h<c.points.length;h++)l.push({a:c.points[h-1],b:c.points[h],w:c.width,kind:c.wall.kind,id:c.id});for(let c of a){let h=c.opening.kind;if(h!=="passage"){if(h==="door"){let f=c.opening.anchor_ref,u=f&&f.resource_type==="ha_entity"?n[f.resource_id]:void 0;if(!f||xl(u))continue;let d=r.locks&&r.locks[c.opening.id]}l.push({a:c.g0,b:c.g1,w:c.wpx,kind:h,id:c.opening.id})}}return l}function yl(s,t,e){let i=!1;for(let n=0,r=e.length-1;n<e.length;r=n++){let o=e[n][0],a=e[n][1],l=e[r][0],c=e[r][1];a>t!=c>t&&s<(l-o)*(t-a)/(c-a)+o&&(i=!i)}return i}function Hs(s){let t=0,e=0,i=0;for(let n=0;n<s.length;n++){let[r,o]=s[n],[a,l]=s[(n+1)%s.length],c=r*l-a*o;t+=c,e+=(r+a)*c,i+=(o+l)*c}return Math.abs(t)<1e-9?[s[0][0],s[0][1]]:[e/(3*t),i/(3*t)]}function Hd(s,t){let e=s.length;if(e<2)return[];let i=[];for(let a=0;a<e-1;a++){let l=s[a+1][0]-s[a][0],c=s[a+1][1]-s[a][1],h=Math.hypot(l,c)||1;i.push([l/h,c/h])}let n=a=>{let l=[];for(let c=0;c<e;c++){let h=i[Math.max(0,c-1)],f=i[Math.min(e-2,c)],u=[-h[1]*a,h[0]*a],d=[-f[1]*a,f[0]*a],m=u[0]+d[0],_=u[1]+d[1],p=Math.hypot(m,_);if(p<1e-6){l.push([s[c][0]+d[0]*t,s[c][1]+d[1]*t]);continue}let g=(m*d[0]+_*d[1])/p,M=t/Math.max(g,.25);l.push([s[c][0]+m/p*M,s[c][1]+_/p*M])}return l},r=n(1),o=n(-1).reverse();return[...r,...o]}var Sh=1.65,Gd=8,Jv=85,jv=350,Ml=(s,t)=>-Math.atan2(t,s);function sn(s,t,e=[0,0,0]){let i=s.index?s.toNonIndexed():s,n=i.attributes.position,r=new Float32Array(n.count*2),o=new D,a=new D,l=new D,c=new D;for(let h=0;h<n.count;h+=3){o.fromBufferAttribute(n,h),a.fromBufferAttribute(n,h+1),l.fromBufferAttribute(n,h+2),c.copy(a).sub(o).cross(l.clone().sub(o));let f=Math.abs(c.x),u=Math.abs(c.y),d=Math.abs(c.z);for(let m=0;m<3;m++){let _=[o,a,l][m],p,g;f>=u&&f>=d?(p=_.z+e[2],g=_.y+e[1]):u>=d?(p=_.x+e[0],g=_.z+e[2]):(p=_.x+e[0],g=_.y+e[1]),r[(h+m)*2]=p/t,r[(h+m)*2+1]=g/t}}return i.setAttribute("uv",new Le(r,2)),i.computeVertexNormals(),i}function oo(s){let t=new Vn;return s.forEach(([e,i],n)=>n?t.lineTo(e,-i):t.moveTo(e,-i)),t.closePath(),t}function yh(s,t,e){let i=new Sr(oo(s),{depth:t,bevelEnabled:!1,curveSegments:1});return i.rotateX(-Math.PI/2),i.translate(0,e,0),i}function je(s,t,e,i,n,r,o=0){let a=new ze(s,t,e);return o&&a.rotateY(o),a.translate(i,n,r),a}function Wd(s,t,e,i,n,r=16,o=s){let a=new si(o,s,t,r);return a.translate(e,i,n),a}var Mh=(s,t)=>{let[e,i]=Hs(s);return s.map(([n,r])=>[n+Math.sign(e-n)*t,r+Math.sign(i-r)*t])},bl=class{constructor(t){this.lib=t,this.root=new ci,this.root.name="plan",this.levels={},this.doors=[],this.shutters=[],this.lamps=[],this.devices=[],this.markers=[],this.presence=[],this.tints=[],this.pool=[],this.labels=[],this.quality=3,this.reflectors=[],this.cameras=[],this.mirror=null}dispose(){this.root.traverse(t=>{t.geometry&&t.geometry.dispose()}),this.root.clear(),this.levels={},this.doors=[],this.shutters=[],this.lamps=[],this.devices=[],this.markers=[],this.presence=[],this.tints=[],this.labels=[],this.cameras=[];for(let t of this.pool)t.parent&&t.parent.remove(t);this.pool=[]}build(t,e,i={}){this.dispose(),this.plan=t,this.quality=e,this.reflections=!!i.reflections;let n=t.doc,r=n.dimensions.width_px,o=n.dimensions.height_px,{scale:a}=so(n,r,o,null);this.scale=a,this.W=r,this.H=o;let l=p=>[p[0]*r*a,p[1]*o*a];this.toM=l;let c=e,h=this.lib,f=(p,g)=>h.get(p,c,{side:g}),u=new Map(n.levels.map(p=>[p.id,p])),d=t.entities;for(let p of n.levels){let g=new ci;g.name=`level:${p.id}`,this.root.add(g);let M=p.elevation_m,T=p.ceiling_height_m,y=t.zones.filter(w=>w.level_id===p.id).map(w=>({...w,polyM:w.polygon.map(P=>l([P.x,P.y]))}));if(!y.length){let w=n.walls.filter(P=>P.level_id===p.id).flatMap(P=>P.polyline.map(l));if(w.length){let I=Math.min(...w.map(G=>G[0]))-.5,N=Math.max(...w.map(G=>G[0]))+.5,B=Math.min(...w.map(G=>G[1]))-.5,O=Math.max(...w.map(G=>G[1]))+.5;y.push({id:`plate-${p.id}`,name:p.name,level_id:p.id,polyM:[[I,B],[N,B],[N,O],[I,O]],x_proto:{floor_material:"concrete"},synthetic:!0})}}let b={id:p.id,name:p.name,group:g,elevation:M,ceiling:T,zones:y,ceilings:[],extent:null,statics:[],segs:[],stairs:[],objectsBlocking:[]};this.levels[p.id]=b;let E=new Map,C=(w,P)=>{(E.get(w)||E.set(w,[]).get(w)).push(P)},{walls:x,openings:A}=so(n,r,o,p.id);for(let w of x){let P=w.wall,I=P.height_m??T,N=w.points.map(V=>[V[0]*a,V[1]*a]),B=Hd(N,w.width*a/2);if(B.length<3)continue;let O=yh(B,I-(P.base_z_m||0),M+(P.base_z_m||0)),G=P.kind==="railing"?"metal_dark":P.kind==="exterior"?"plaster_exterior":"plaster_white";C(G,sn(O,h.tileM(G)))}let L=y.length?y.flatMap(w=>w.polyM):x.flatMap(w=>w.points.map(P=>[P[0]*a,P[1]*a]));L.length&&(b.extent={minX:Math.min(...L.map(w=>w[0])),maxX:Math.max(...L.map(w=>w[0])),minZ:Math.min(...L.map(w=>w[1])),maxZ:Math.max(...L.map(w=>w[1]))});for(let w of A){let P=w.opening,I=[w.c[0]*a,w.c[1]*a],N=w.d,B=[-N[1],N[0]],O=P.width_m,G=w.wpx*a,V=w.wall.height_m??T,W=Ml(N[0],N[1]),$=M+P.sill_m+P.height_m;if(V-(P.sill_m+P.height_m)>.01&&C(w.wall.kind==="exterior"?"plaster_exterior":"plaster_white",sn(je(O,V-(P.sill_m+P.height_m),G,I[0],($+M+V)/2,I[1],W),2)),P.kind==="window"){P.sill_m>.01&&C(w.wall.kind==="exterior"?"plaster_exterior":"plaster_white",sn(je(O,P.sill_m,G,I[0],M+P.sill_m/2,I[1],W),2));let dt=.06;C("metal_light",je(dt,P.height_m,G*.9,I[0]-N[0]*(O/2-dt/2),M+P.sill_m+P.height_m/2,I[1]-N[1]*(O/2-dt/2),W)),C("metal_light",je(dt,P.height_m,G*.9,I[0]+N[0]*(O/2-dt/2),M+P.sill_m+P.height_m/2,I[1]+N[1]*(O/2-dt/2),W)),C("metal_light",je(O,dt,G*.9,I[0],$-dt/2,I[1],W)),C("metal_light",je(O+.1,dt,G+.08,I[0],M+P.sill_m+dt/2,I[1],W));let mt=P.x_proto&&P.x_proto.glazing==="frosted",Ct=new Zt(je(O-dt*2,P.height_m-dt*2,.02,0,0,0),this.glassMaterial(mt));Ct.position.set(I[0],M+P.sill_m+P.height_m/2,I[1]),Ct.rotation.y=W,Ct.userData={kind:"glass"},g.add(Ct);let wt=P.x_proto&&P.x_proto.cover_entity;if(wt){let Ht=b.extent?I[0]+B[0]*.5<b.extent.minX+.01||I[0]+B[0]*.5>b.extent.maxX-.01||I[1]+B[1]*.5<b.extent.minZ+.01||I[1]+B[1]*.5>b.extent.maxZ-.01?1:-1:1,Z=new Zt(new ze(O+.1,.22,.18),f("metal_light"));Z.position.set(I[0]+B[0]*Ht*(G/2+.09),$+.11,I[1]+B[1]*Ht*(G/2+.09)),Z.rotation.y=W,Z.castShadow=!0,g.add(Z);let j=new Zt(new ze(O+.04,1,.04),this.shutterMaterial());j.geometry.translate(0,-.5,0),j.position.set(I[0]+B[0]*Ht*(G/2+.06),$,I[1]+B[1]*Ht*(G/2+.06)),j.rotation.y=W,j.castShadow=!0,j.userData={kind:"device",entity:wt,label:t.entityNames[wt]||wt,domain:"cover"},g.add(j),this.devices.push(j),this.shutters.push({entity:wt,mesh:j,height:P.height_m,current:1}),this.labels.push({kind:"device",entity:wt,pos:new D(I[0]+B[0]*Ht*.3,$+.3,I[1]+B[1]*Ht*.3),level:p.id})}}else if(P.kind==="door"){let mt="wood_dark";C(mt,je(.05,P.height_m,G+.02,I[0]-N[0]*(O/2-.05/2),M+P.height_m/2,I[1]-N[1]*(O/2-.05/2),W)),C(mt,je(.05,P.height_m,G+.02,I[0]+N[0]*(O/2-.05/2),M+P.height_m/2,I[1]+N[1]*(O/2-.05/2),W)),C(mt,je(O,.05,G+.02,I[0],$-.05/2,I[1],W));let Ct=P.anchor_ref&&P.anchor_ref.resource_type==="ha_entity"?P.anchor_ref.resource_id:null,wt=t.doorLocks&&t.doorLocks[P.id],Ht=P.height_m-.05-.01,Z=.045,j=P.swing||"right",ut=[N[1],-N[0]],It=[-N[1],N[0]],vt=[],Bt=(st,ot,ct,Ft,Pt)=>{let Dt=new ci;Dt.position.set(st[0],M,st[1]);let Xt=Ml(ot[0],ot[1]);Dt.rotation.y=Xt;let F=new Zt(new ze(ct-.02,Ht,Z),P.id==="d-liv-kit"?this.glassMaterial(!1,!0):f("door_wood"));F.geometry.translate(ct/2,Ht/2,0),F.castShadow=!0,F.receiveShadow=!0,c>=3&&P.id!=="d-liv-kit"&&sn(F.geometry,1),F.userData={kind:"device",entity:Ct||`door:${P.id}`,label:Ct?t.entityNames[Ct]||Ct:"\u05D3\u05DC\u05EA \u05DC\u05DC\u05D0 \u05D7\u05D9\u05D9\u05E9\u05DF",domain:"door",openingId:P.id,lock:wt||null},Dt.add(F);let se=new Zt(new ze(.12,.03,.08),f("metal_light"));if(se.position.set(ct-.15,1,0),Dt.add(se),wt){let R=new Zt(new ze(.06,.1,.06),this.lockMaterial());R.position.set(ct-.15,1.12,0),R.userData={kind:"lock",entity:wt},Dt.add(R),this.devices.push(R),this.lockPlates=this.lockPlates||[],this.lockPlates.push({entity:wt,mesh:R})}g.add(Dt),this.devices.push(F);let Jt=Xt;if(Pt==="swing"){Jt=Ml(Ft[0],Ft[1]);let R=Jt-Xt;for(;R>Math.PI;)R-=2*Math.PI;for(;R<-Math.PI;)R+=2*Math.PI;Jt=Xt+Math.sign(R)*(Jv*Math.PI)/180}vt.push({grp:Dt,closedYaw:Xt,openYaw:Jt,kind:Pt,slide:Pt==="slide"?[ot[0]*-(ct*.92),ot[1]*-(ct*.92)]:null,base:[st[0],st[1]]})},ie=[w.g0[0]*a,w.g0[1]*a],et=[w.g1[0]*a,w.g1[1]*a],at=(P.hinge||"start")==="start"?ut:It;if(j==="sliding"){let st=(P.hinge||"start")==="start"?ie:et,ot=st===ie?N:[-N[0],-N[1]];Bt([st[0]+ut[0]*0,st[1]+ut[1]*0],ot,O,null,"slide")}else if(j==="double")Bt(ie,N,O/2,at,"swing"),Bt(et,[-N[0],-N[1]],O/2,at,"swing");else if(j!=="none"){let st=j==="left"?ut:It,ot=(P.hinge||"start")==="start"?ie:et,ct=ot===ie?N:[-N[0],-N[1]];Bt(ot,ct,O,st,"swing")}if(this.doors.push({id:P.id,entity:Ct,lock:wt||null,leaves:vt,t:0,open:!1}),Ct){let st=new ci,ot=this.markerMaterial(),ct=.06,Ft=.04;for(let Pt of[-1,1]){let Dt=new Zt(je(ct,P.height_m+ct,G+Ft*2,I[0]+N[0]*Pt*(O/2+ct/2),M+(P.height_m+ct)/2,I[1]+N[1]*Pt*(O/2+ct/2),W),ot);st.add(Dt)}st.add(new Zt(je(O+ct*2,ct,G+Ft*2,I[0],$+ct/2,I[1],W),ot)),st.visible=!1,g.add(st),this.markers.push({entity:Ct,group:st}),this.labels.push({kind:"device",entity:Ct,pos:new D(I[0],$+.25,I[1]),level:p.id})}}else P.kind}for(let w of y){let P=w.x_proto&&w.x_proto.floor_material||"concrete",I=yh(w.polyM,.25,M-.25),N=f(P),B=this.reflections&&c>=3?this.transparentClone(N):N,O=new Zt(sn(I,h.tileM(P)),B);O.receiveShadow=!0,O.castShadow=c>=2,O.userData={kind:"floor",zone:w.id,level:p.id},g.add(O),b.statics.push(O);let G=new gn(oo(w.polyM));G.rotateX(-Math.PI/2),G.translate(0,M+T,0);let V=new Zt(sn(G,h.tileM("plaster_ceiling")),f("plaster_ceiling",Xe));V.castShadow=!0,V.receiveShadow=!0,V.userData={kind:"ceiling"},g.add(V),b.ceilings.push(V);let[W,$]=Hs(w.polyM),dt=w.x_proto&&w.x_proto.light;if(dt&&c<3){let Ct=new gn(oo(Mh(w.polyM,.08)));Ct.rotateX(-Math.PI/2),Ct.translate(0,M+.014,0);let wt=new Zt(Ct,new ni({color:16762967,transparent:!0,opacity:.4,depthWrite:!1}));wt.visible=!1,g.add(wt),this.tints.push({entity:dt,mesh:wt,zone:w.id})}let mt=w.x_proto&&w.x_proto.presence;if(mt){let Ct=Mh(w.polyM,.1),wt=Mh(w.polyM,.4),Ht=oo(Ct),Z=new zn;wt.forEach(([It,vt],Bt)=>Bt?Z.lineTo(It,-vt):Z.moveTo(It,-vt)),Z.closePath(),Ht.holes.push(Z);let j=new gn(Ht);j.rotateX(-Math.PI/2),j.translate(0,M+.026,0);let ut=new Zt(j,new ni({color:2582509,transparent:!0,opacity:.7,depthWrite:!1}));ut.visible=!1,g.add(ut),this.presence.push({entity:mt,mesh:ut,zone:w.id,fade:1})}this.labels.push({kind:"room",text:w.name,pos:new D(W,M+.05,$),level:p.id,zone:w.id}),w.x_proto&&typeof w.x_proto.temp=="number"&&this.labels.push({kind:"temp",text:`${w.x_proto.temp.toFixed(1)}\xB0`,pos:new D(W,M+1.5,$),level:p.id,zone:w.id,offset:.55})}for(let w of n.objects.filter(P=>P.level_id===p.id)){let[P,I]=l(w.position),N=-(w.rotation_deg||0)*Math.PI/180,B=M+(w.z_m||0);this.buildObject(w,P,B,I,N,g,C,b,t)}for(let w of n.connectors.filter(P=>P.level_from===p.id&&P.kind==="stairs"&&P.polyline.length>=2)){let P=u.get(w.level_to);if(!P)continue;let I=l(w.polyline[0]),N=l(w.polyline[w.polyline.length-1]),B=Math.hypot(N[0]-I[0],N[1]-I[1]),O=w.flights&&w.flights[0]&&w.flights[0].steps||Math.max(2,Math.round(B/.28)),G=P.elevation_m-M,V=(N[0]-I[0])/B,W=(N[1]-I[1])/B,$=Ml(V,W),dt=B/O,mt=G/O;for(let Ct=0;Ct<O;Ct++){let wt=(Ct+.5)*dt,Ht=M+(Ct+1)*mt,Z=Math.max(.02,(Ct+1)*mt);C("oak",sn(je(dt+.01,Z,w.width_m,I[0]+V*wt,Ht-Z/2,I[1]+W*wt,$),1))}C("wood_dark",je(B,.08,.05,(I[0]+N[0])/2+0,M+G/2-.04,(I[1]+N[1])/2,$)),b.stairs.push({a:I,b:N,run:B,width:w.width_m,from:p.id,to:w.level_to,elevFrom:M,elevTo:P.elevation_m,dx:V,dz:W})}let U=xh(n,r,o,p.id,d);for(let w of t.anchors.filter(P=>P.level_id===p.id&&P.resource_type==="camera")){let[P,I]=l([w.x,w.y]),N=w.mount_height_m??2.4,B=(w.rotation||0)*Math.PI/180,O=[Math.sin(B),-Math.cos(B)],G=new ci;G.position.set(P,M+N,I),G.rotation.y=-B+Math.PI/2;let V=new Zt(new ze(.24,.1,.12),f("metal_dark"));V.position.x=.1,V.rotation.z=-(w.tilt_deg||0)*Math.PI/180,G.add(V);let W=new Zt(new si(.035,.035,.04,12),this.lensMaterial(w.online));W.rotation.z=Math.PI/2,W.position.set(.23,-.03,0),G.add(W);let $=new Zt(new ze(.06,.06,.06),f("metal_dark"));G.add($),G.userData={kind:"camera",id:w.id,label:w.label,online:w.online},V.userData=G.userData,W.userData=G.userData,g.add(G),this.devices.push(V,W);let dt=(w.radius??.5)*r,Ct=Kv([w.x*r,w.y*o],w.rotation||0,w.fov||90,dt,U).map(wt=>[wt[0]*a,wt[1]*a]);if(Ct.length>=3){let wt=new gn(oo(Ct));wt.rotateX(-Math.PI/2),wt.translate(0,M+.03,0);let Ht=new Zt(wt,new ni({color:w.online===!1?10134453:2582509,transparent:!0,opacity:.16,depthWrite:!1,side:Xe}));Ht.userData={kind:"cone"},g.add(Ht);let Z=new Zt(yh(Ct,N-.2,M+.05),new ni({color:2582509,transparent:!0,opacity:.05,depthWrite:!1,side:Xe}));Z.visible=!1,Z.userData={kind:"cone-volume"},g.add(Z),this.cameras.push({id:w.id,cone:Ht,vol:Z,body:G,fwd:O,pos:[P,I],mount:N,tilt:w.tilt_deg||0,label:w.label,level:p.id})}this.labels.push({kind:"camera",text:w.label,pos:new D(P,M+N+.2,I),level:p.id,online:w.online})}for(let[w,P]of E){let I=P.map(G=>G.index?G.toNonIndexed():G),N=Bd(I,!1),B=f(w),O=new Zt(N,B);O.castShadow=!0,O.receiveShadow=!0,O.userData={kind:"static",material:w,level:p.id},g.add(O),b.statics.push(O)}b.segsPx=null}let m=Object.values(this.levels).flatMap(p=>p.stairs.filter(g=>!g.arrival));for(let p of m){let g=this.levels[p.to];g&&g.stairs.push({...p,arrival:!0})}let _=Math.min(Gd,this.maxLights??Gd,Math.max(1,this.lamps.length));for(let p=0;p<_;p++){let g=new Ir(16777215,0,9,2);g.castShadow=!!i.lampShadows&&p<2,g.shadow.mapSize.set(512,512),g.shadow.bias=-.002,g.position.set(0,-100,0),this.root.add(g),this.pool.push(g)}return this.reflections&&e>=3&&this.addReflectors(),this.setStates(t.entities,t.coverPositions,!0),this.updateLevelCollision(),this.root}addReflectors(){let{Reflector:t}=this._reflector||{};if(t)for(let e of Object.values(this.levels)){if(!e.extent)continue;let i=e.extent.maxX-e.extent.minX,n=e.extent.maxZ-e.extent.minZ,r=new t(new Gn(i,n),{clipBias:.003,textureWidth:1024,textureHeight:1024,color:8949913});r.rotation.x=-Math.PI/2,r.position.set((e.extent.minX+e.extent.maxX)/2,e.elevation-.004,(e.extent.minZ+e.extent.maxZ)/2),r.userData={kind:"reflector"},e.group.add(r),this.reflectors.push(r)}}transparentClone(t){let e=t.clone();return e.transparent=!0,e.opacity=.9,e}glassMaterial(t,e){return this.quality>=3&&!this.lite?new wr({color:15266040,metalness:0,roughness:t?.55:.05,transmission:t?.7:.92,thickness:.05,ior:1.5,transparent:!0,opacity:1,side:Xe,envMapIntensity:1.2,clearcoat:.6}):new We({color:10471423,transparent:!0,opacity:t?.6:.3,roughness:.1,metalness:.2,side:Xe})}shutterMaterial(){return this._shutter||(this._shutter=new We({color:14278115,roughness:.6,metalness:.3})),this._shutter}markerMaterial(){return this._marker||(this._marker=new We({color:15680580,emissive:15680580,emissiveIntensity:.9,roughness:.8})),this._marker}lockMaterial(){return new We({color:2278750,emissive:2278750,emissiveIntensity:.6,roughness:.5,metalness:.4})}lensMaterial(t){return new We({color:t===!1?10134453:2582509,emissive:t===!1?0:2582509,emissiveIntensity:.9,roughness:.2})}bulbMaterial(t=3e3){let e=bh(t);return new We({color:16774880,emissive:new Vt(e[0],e[1],e[2]),emissiveIntensity:0,roughness:.4})}buildObject(t,e,i,n,r,o,a,l,c){let h=this.quality,f=this.lib,u=E=>f.get(E,h),{w_m:d,d_m:m,h_m:_}=t.size,p=(E,C,x,A,L,U,w)=>{let P=Math.cos(r),I=Math.sin(r),N=e+L*P+w*I,B=n-L*I+w*P,O=je(C,x,A,0,0,0,r);O.translate(N,i+U,B),a(E,h>=3?sn(O,f.tileM(E)):O)},g=(E,C,x,A,L,U,w=16,P=C)=>{let I=Math.cos(r),N=Math.sin(r),B=Wd(C,x,e+A*I+U*N,i+L,n-A*N+U*I,w,P);a(E,h>=3?sn(B,f.tileM(E)):B)},M=t.item_id,T=M.split(".")[0],y=t.anchor_ref&&t.anchor_ref.resource_type==="ha_entity"?t.anchor_ref.resource_id:null;switch(_>=.9&&T!=="mat"&&T!=="light"&&l.objectsBlocking.push({x:e,z:n,w:d,d:m,yaw:r}),T){case"sofa":{p("fabric_blue",d,.42,m,0,.21,0),p("fabric_blue",d,_-.42,.22,0,.42+(_-.42)/2,-m/2+.11),p("fabric_blue",.22,.28,m,-d/2+.11,.42+.14,0),p("fabric_blue",.22,.28,m,d/2-.11,.42+.14,0),p("linen",(d-.5)/2-.02,.12,m-.3,-(d-.5)/4-.01,.48,.04),p("linen",(d-.5)/2-.02,.12,m-.3,(d-.5)/4+.01,.48,.04);break}case"chair":{p("wood_dark",d,.04,m,0,.45,0),p("fabric_grey",d-.04,.05,m-.04,0,.45+.045,0),p("wood_dark",d,_-.45,.04,0,.45+(_-.45)/2,-m/2+.02);for(let[C,x]of[[-1,-1],[1,-1],[-1,1],[1,1]])p("wood_dark",.03,.45,.03,C*(d/2-.03),.45/2,x*(m/2-.03));break}case"table":{let E=M.includes("coffee")?"wood_dark":M.includes("desk")?"wood_light":"oak";p(E,d,.04,m,0,_-.02,0);for(let[C,x]of[[-1,-1],[1,-1],[-1,1],[1,1]])p("metal_dark",.05,_-.04,.05,C*(d/2-.06),(_-.04)/2,x*(m/2-.06));M.includes("desk")&&(p("metal_dark",.5,.02,.3,.2,_+.01,0),p("metal_dark",.5,.32,.02,.2,_+.18,-.1));break}case"cabinet":{let E=M.includes("bookcase")||M.includes("tv")?"wood_dark":"wood_light";if(p(E,d,_,m,0,_/2,0),M.includes("bookcase"))for(let C=1;C<5;C++)p("linen",d-.06,.02,m-.04,0,_/5*C,.01);M.includes("wardrobe")&&(p("metal_light",.02,.2,.02,-.03,_*.5,m/2+.01),p("metal_light",.02,.2,.02,.03,_*.5,m/2+.01));break}case"screen":{let E=new Zt(je(d,_,m,0,0,0),new We({color:724758,emissive:1716053,emissiveIntensity:0,roughness:.3,metalness:.5}));E.position.set(e,i+_/2,n),E.rotation.y=r,E.userData={kind:"device",entity:y,label:c.entityNames[y]||"\u05D8\u05DC\u05D5\u05D5\u05D9\u05D6\u05D9\u05D4",domain:"media_player"},E.castShadow=!0,o.add(E),this.devices.push(E),this.screens=this.screens||[],this.screens.push({entity:y,mesh:E});break}case"bed":{p("wood_light",d,.25,m,0,.125,0),p("linen",d-.06,.22,m-.1,0,.36,.03),p("fabric_blue",d-.06,.06,m*.6,0,.5,m*.15),p("linen",d/2-.1,.1,.4,-d/4,.52,-m/2+.3),d>1.2&&p("linen",d/2-.1,.1,.4,d/4,.52,-m/2+.3),p("wood_dark",d,_+.5,.06,0,(_+.5)/2,-m/2+.03);break}case"kitchen":{M.includes("fridge")?(p("metal_light",d,_,m,0,_/2,0),p("metal_dark",.03,.5,.03,d/2-.08,_*.6,m/2+.02)):(p("wood_light",d,_-.04,m,0,(_-.04)/2,0),p("concrete",d+.04,.04,m+.04,0,_-.02,0),M.includes("counter")&&d<m&&p("metal_light",.5,.02,.4,0,_+.01,0));break}case"plant":{g("concrete",d/2,.35,0,.175,0,14,d/2.4);let E=new _n(d*.7,10,8);E.translate(e,i+_-d*.6,n),a("grass",E);break}case"mat":p("fabric_blue",d,.02,m,0,.01,0);break;case"sanitary":{M.includes("wc")?(g("tiles_white",.2,.4,0,.2,.1,14),p("tiles_white",.38,.4,.18,0,.6,-m/2+.09)):M.includes("tub")?(p("tiles_white",d,_,m,0,_/2,0),p("metal_light",d-.2,.02,m-.2,0,_-.08,0)):(p("tiles_white",d,.15,m,0,_-.075,0),p("tiles_white",.2,_-.15,.2,0,(_-.15)/2,0));break}case"appliance":{M.includes("boiler")?g("metal_light",d/2,_,0,_/2,0,16):(p("metal_light",d,_,m,0,_/2,0),g("metal_dark",.2,.02,0,_*.5,m/2+.01,16));break}case"extinguisher":{let E=Wd(.08,_,e,i+_/2,n,12);a("metal_dark",E);let C=new Zt(new si(.075,.075,_*.8,12),new We({color:14697532,roughness:.4,metalness:.3}));C.position.set(e,i+_/2,n),o.add(C);break}case"light":{let E=M.includes("pendant")||M.includes("floor")?2700:3200,C=this.bulbMaterial(E),x,A;if(M.includes("ceiling")){let U=new Zt(new si(d/2,d/2*.92,.08,20),C);U.position.set(e,i+.04,n),x=U,A=new D(e,i-.12,n);let w=new Zt(new si(d/2+.02,d/2+.02,.03,20),u("metal_light"));w.position.set(e,i+.09,n),o.add(w)}else if(M.includes("pendant")){let U=new Zt(new si(.006,.006,.7,6),u("metal_dark"));U.position.set(e,i+_+.35,n),o.add(U);let w=new Zt(new si(d/2,d/2*.5,_,20,1,!0),new We({color:3817286,roughness:.5,metalness:.6,side:Xe}));w.position.set(e,i+_/2,n),o.add(w);let P=new Zt(new _n(.05,10,8),C);P.position.set(e,i+.1,n),x=P,A=new D(e,i,n)}else if(M.includes("floor")){let U=new Zt(new si(.015,.015,_-.3,8),u("metal_dark"));U.position.set(e,i+(_-.3)/2,n),o.add(U);let w=new Zt(new si(.15,.15,.02,16),u("metal_dark"));w.position.set(e,i+.01,n),o.add(w);let P=new Zt(new si(d/2,d/2*.8,.3,20,1,!0),C);P.position.set(e,i+_-.15,n),x=P,A=new D(e,i+_-.1,n)}else{let U=new Zt(new ze(d,_,m),C);U.position.set(e,i+_/2,n),U.rotation.y=r,x=U,A=new D(e,i+_/2,n)}x.userData={kind:"device",entity:y,label:c.entityNames[y]||y,domain:"light"},o.add(x),this.devices.push(x);let L=new fr(new Ts({map:tx(),color:new Vt(...bh(E)),transparent:!0,opacity:0,depthWrite:!1,blending:Xn}));L.scale.set(1.6,1.6,1),L.position.copy(A),o.add(L),this.lamps.push({entity:y,bulb:x,pos:A,glow:L,kelvin:E,level:l.id,light:null,on:!1,kind:M}),this.labels.push({kind:"device",entity:y,pos:A.clone(),level:l.id});break}default:p("concrete",d,_,m,0,_/2,0)}}updateLevelCollision(){let t=this.plan.doc;for(let e of Object.values(this.levels)){let i=xh(t,this.W,this.H,e.id,this.plan.entities).map(n=>({a:[n.a[0]*this.scale,n.a[1]*this.scale],b:[n.b[0]*this.scale,n.b[1]*this.scale],w:(n.w||0)*this.scale,kind:n.kind,id:n.id}));for(let n of this.doors)if(n.lock&&this.plan.entities[n.lock]==="locked"){let r=t.openings.find(o=>o.id===n.id);if(r&&!i.some(o=>o.id===r.id)){let o=so(t,this.W,this.H,e.id).openings.find(a=>a.opening.id===r.id);o&&i.push({a:[o.g0[0]*this.scale,o.g0[1]*this.scale],b:[o.g1[0]*this.scale,o.g1[1]*this.scale],w:o.wpx*this.scale,kind:"door-locked",id:r.id})}}for(let n of e.objectsBlocking){let r=Math.cos(n.yaw),o=Math.sin(n.yaw),a=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([l,c])=>[n.x+l*n.w/2*r+c*n.d/2*o,n.z-l*n.w/2*o+c*n.d/2*r]);for(let l=0;l<4;l++)i.push({a:a[l],b:a[(l+1)%4],w:0,kind:"object",id:"obj"})}e.segs=i}}setStates(t,e,i=!1){this.plan.entities=t,this.plan.coverPositions=e||this.plan.coverPositions||{};for(let n of this.doors){let r=n.entity?xl(t[n.entity]):!1;n.open=r,i&&(n.t=r?1:0)}for(let n of this.shutters){let r=this.plan.coverPositions[n.entity],o=t[n.entity];n.target=typeof r=="number"?r/100:o==="open"?1:0,i&&(n.current=n.target)}for(let n of this.lamps)n.on=t[n.entity]==="on";for(let n of this.markers)n.group.visible=xl(t[n.entity]);for(let n of this.presence)n.mesh.visible=t[n.entity]==="on";for(let n of this.tints)n.mesh.visible=t[n.entity]==="on";for(let n of this.screens||[])n.mesh.material.emissiveIntensity=t[n.entity]==="playing"||t[n.entity]==="on"?1.6:0;for(let n of this.lockPlates||[]){let r=t[n.entity]==="locked";n.mesh.material.color.setHex(r?15680580:2278750),n.mesh.material.emissive.setHex(r?15680580:2278750)}this.updateLevelCollision()}update(t,e,i={}){let n=!1,r=Math.min(1,t/(jv/1e3));for(let c of this.doors){let h=c.open?1:0;Math.abs(c.t-h)>.001&&(c.t+=Math.sign(h-c.t)*r,c.t=Math.max(0,Math.min(1,c.t)),n=!0);let f=c.t<.5?2*c.t*c.t:1-Math.pow(-2*c.t+2,2)/2;for(let u of c.leaves)u.kind==="swing"?u.grp.rotation.y=u.closedYaw+(u.openYaw-u.closedYaw)*f:u.grp.position.set(u.base[0]+u.slide[0]*f,u.grp.position.y,u.base[1]+u.slide[1]*f)}for(let c of this.shutters){Math.abs(c.current-c.target)>.001&&(c.current+=Math.sign(c.target-c.current)*r*.6,c.current=Math.max(0,Math.min(1,c.current)),n=!0);let h=c.height*(1-c.current);c.mesh.scale.y=Math.max(.001,h),c.mesh.visible=h>.01}let o=i.nightFactor??0,a=this.lamps.filter(c=>c.on&&this.levels[c.level].group.visible);for(let c of this.lamps){let h=c.on?this.quality>=3?2.2+o*1.6:1.4:0;c.bulb.material.emissiveIntensity+=(h-c.bulb.material.emissiveIntensity)*Math.min(1,t*8);let f=c.on?.35+o*.4:0;c.glow.material.opacity+=(f-c.glow.material.opacity)*Math.min(1,t*8),Math.abs(h-c.bulb.material.emissiveIntensity)>.01&&(n=!0)}a.sort((c,h)=>c.pos.distanceToSquared(e)-h.pos.distanceToSquared(e));let l=a.slice(0,this.pool.length);for(let c=0;c<this.pool.length;c++){let h=this.pool[c],f=l[c];if(!f){h.intensity=0;continue}h.position.copy(f.pos);let u=bh(f.kelvin);h.color.setRGB(u[0],u[1],u[2]);let d=f.kind.includes("floor")?6:f.kind.includes("wall")?5:11;h.intensity=d*(.5+o*.8)}return n}showLevel(t,e=!1){let i=Object.keys(this.levels);for(let n of i){let r=this.levels[n],o=t==="all"||t===n;r.group.visible=o;let a=!!(e||t==="all"&&n!==i[i.length-1]);for(let l of r.ceilings)l.visible=a&&!(t==="all"&&!e&&n===i[i.length-1]);if(t==="all"&&!e)for(let l of r.ceilings)l.visible=!1}for(let n of this.cameras)n.vol.visible=e,n.cone.visible=!e}pick(t){let e=t.intersectObjects(this.devices,!1);for(let i of e){let n=i.object.userData;if(n&&(n.kind==="device"||n.kind==="camera"||n.kind==="lock"))return{...n,point:i.point,distance:i.distance}}return null}};function Kv(s,t,e,i,n){let r=[s],o=Math.max(24,Math.round(e/2));for(let a=0;a<=o;a++){let c=(t-e/2+e*a/o-90)*Math.PI/180,h=[Math.cos(c),Math.sin(c)],f=i;for(let u of n){let d=Qv(s,h,u.a,u.b);d!==null&&d>.5&&d<f&&(f=d)}r.push([s[0]+h[0]*f,s[1]+h[1]*f])}return r}function Qv(s,t,e,i){let n=i[0]-e[0],r=i[1]-e[1],o=t[0]*r-t[1]*n;if(Math.abs(o)<1e-12)return null;let a=e[0]-s[0],l=e[1]-s[1],c=(a*r-l*n)/o,h=(a*t[1]-l*t[0])/o;return c<0||h<-1e-9||h>1+1e-9?null:c}function bh(s){let t=s/100,e,i,n;e=t<=66?255:329.698727446*Math.pow(t-60,-.1332047592),i=t<=66?99.4708025861*Math.log(t)-161.1195681661:288.1221695283*Math.pow(t-60,-.0755148492),n=t>=66?255:t<=19?0:138.5177312231*Math.log(t-10)-305.0447927307;let r=o=>Math.max(0,Math.min(255,o))/255;return[r(e),r(i),r(n)]}var ro=null;function tx(){if(ro)return ro;let s=document.createElement("canvas");s.width=s.height=128;let t=s.getContext("2d"),e=t.createRadialGradient(64,64,0,64,64,64);return e.addColorStop(0,"rgba(255,255,255,1)"),e.addColorStop(.25,"rgba(255,255,255,0.55)"),e.addColorStop(1,"rgba(255,255,255,0)"),t.fillStyle=e,t.fillRect(0,0,128,128),ro=new kn(s),ro.colorSpace=Pe,ro}var Gs=class s extends Zt{constructor(){let t=s.SkyShader,e=new ce({name:t.name,uniforms:Ue.clone(t.uniforms),vertexShader:t.vertexShader,fragmentShader:t.fragmentShader,side:Ne,depthWrite:!1});super(new ze(1,1,1),e),this.isSky=!0}};Gs.SkyShader={name:"SkyShader",uniforms:{turbidity:{value:2},rayleigh:{value:1},mieCoefficient:{value:.005},mieDirectionalG:{value:.8},sunPosition:{value:new D},cloudScale:{value:2e-4},cloudSpeed:{value:2e-5},cloudCoverage:{value:.4},cloudDensity:{value:.4},cloudElevation:{value:.5},showSunDisc:{value:1},time:{value:0}},vertexShader:`
		uniform vec3 sunPosition;
		uniform float rayleigh;
		uniform float turbidity;
		uniform float mieCoefficient;

		varying vec3 vWorldPosition;
		varying vec3 vSunDirection;
		varying float vSunfade;
		varying vec3 vBetaR;
		varying vec3 vBetaM;
		varying float vSunE;

		// constants for atmospheric scattering
		const float e = 2.71828182845904523536028747135266249775724709369995957;
		const float pi = 3.141592653589793238462643383279502884197169;

		// wavelength of used primaries, according to preetham
		const vec3 lambda = vec3( 680E-9, 550E-9, 450E-9 );
		// this pre-calculation replaces older TotalRayleigh(vec3 lambda) function:
		// (8.0 * pow(pi, 3.0) * pow(pow(n, 2.0) - 1.0, 2.0) * (6.0 + 3.0 * pn)) / (3.0 * N * pow(lambda, vec3(4.0)) * (6.0 - 7.0 * pn))
		const vec3 totalRayleigh = vec3( 5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5 );

		// mie stuff
		// K coefficient for the primaries
		const float v = 4.0;
		const vec3 K = vec3( 0.686, 0.678, 0.666 );
		// MieConst = pi * pow( ( 2.0 * pi ) / lambda, vec3( v - 2.0 ) ) * K
		const vec3 MieConst = vec3( 1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14 );

		// earth shadow hack
		// cutoffAngle = pi / 1.95;
		const float cutoffAngle = 1.6110731556870734;
		const float steepness = 1.5;
		const float EE = 1000.0;

		float sunIntensity( float zenithAngleCos ) {
			zenithAngleCos = clamp( zenithAngleCos, -1.0, 1.0 );
			return EE * max( 0.0, 1.0 - pow( e, -( ( cutoffAngle - acos( zenithAngleCos ) ) / steepness ) ) );
		}

		vec3 totalMie( float T ) {
			float c = ( 0.2 * T ) * 10E-18;
			return 0.434 * c * MieConst;
		}

		void main() {

			vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
			vWorldPosition = worldPosition.xyz;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			gl_Position.z = gl_Position.w; // set z to camera.far

			vSunDirection = normalize( sunPosition );

			vSunE = sunIntensity( vSunDirection.y );

			vSunfade = 1.0 - clamp( 1.0 - exp( ( sunPosition.y / 450000.0 ) ), 0.0, 1.0 );

			float rayleighCoefficient = rayleigh - ( 1.0 * ( 1.0 - vSunfade ) );

			// extinction (absorption + out scattering)
			// rayleigh coefficients
			vBetaR = totalRayleigh * rayleighCoefficient;

			// mie coefficients
			vBetaM = totalMie( turbidity ) * mieCoefficient;

		}`,fragmentShader:`
		varying vec3 vWorldPosition;
		varying vec3 vSunDirection;
		varying vec3 vBetaR;
		varying vec3 vBetaM;
		varying float vSunE;

		uniform float mieDirectionalG;
		uniform float cloudScale;
		uniform float cloudSpeed;
		uniform float cloudCoverage;
		uniform float cloudDensity;
		uniform float cloudElevation;
		uniform float showSunDisc;
		uniform float time;

		// gradient at a lattice corner; sinless hash so every GPU produces the same clouds
		vec2 gradient( vec2 i ) {
			vec3 p = fract( i.xyx * vec3( 0.1031, 0.1030, 0.0973 ) );
			p += dot( p, p.yzx + 33.33 );
			return fract( ( p.xx + p.yz ) * p.zy ) * 2.0 - 1.0;
		}

		// 2D gradient noise: isotropic lobes like Perlin at value-noise cost
		float noise( vec2 p ) {
			vec2 i = floor( p );
			vec2 f = fract( p );
			vec2 u = f * f * f * ( f * ( f * 6.0 - 15.0 ) + 10.0 ); // quintic fade
			float a = dot( gradient( i ), f );
			float b = dot( gradient( i + vec2( 1.0, 0.0 ) ), f - vec2( 1.0, 0.0 ) );
			float c = dot( gradient( i + vec2( 0.0, 1.0 ) ), f - vec2( 0.0, 1.0 ) );
			float d = dot( gradient( i + vec2( 1.0, 1.0 ) ), f - vec2( 1.0, 1.0 ) );
			return mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y ) * 1.6; // ~[-1,1]
		}

		// fbm; per-octave drift makes clouds billow instead of scrolling as a rigid stamp
		float fbm( vec2 p, float drift ) {
			float result = 0.0;
			float amplitude = 1.0;
			for ( int i = 0; i < 4; i ++ ) {
				result += amplitude * noise( p );
				amplitude *= 0.5;
				p = p * 2.0 + drift;
			}
			return result;
		}

		// constants for atmospheric scattering
		const float pi = 3.141592653589793238462643383279502884197169;

		const float n = 1.0003; // refractive index of air
		const float N = 2.545E25; // number of molecules per unit volume for air at 288.15K and 1013mb (sea level -45 celsius)

		// optical length at zenith for molecules
		const float rayleighZenithLength = 8.4E3;
		const float mieZenithLength = 1.25E3;
		// 66 arc seconds -> degrees, and the cosine of that
		const float sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;

		// 3.0 / ( 16.0 * pi )
		const float THREE_OVER_SIXTEENPI = 0.05968310365946075;
		// 1.0 / ( 4.0 * pi )
		const float ONE_OVER_FOURPI = 0.07957747154594767;

		float rayleighPhase( float cosTheta ) {
			return THREE_OVER_SIXTEENPI * ( 1.0 + pow( cosTheta, 2.0 ) );
		}

		float hgPhase( float cosTheta, float g ) {
			float g2 = pow( g, 2.0 );
			float inverse = 1.0 / pow( 1.0 - 2.0 * g * cosTheta + g2, 1.5 );
			return ONE_OVER_FOURPI * ( ( 1.0 - g2 ) * inverse );
		}

		void main() {

			vec3 direction = normalize( vWorldPosition - cameraPosition );

			// optical length
			// cutoff angle at 90 to avoid singularity in next formula.
			float zenithAngle = acos( max( 0.0, direction.y ) );
			float inverse = 1.0 / ( cos( zenithAngle ) + 0.15 * pow( 93.885 - ( ( zenithAngle * 180.0 ) / pi ), -1.253 ) );
			float sR = rayleighZenithLength * inverse;
			float sM = mieZenithLength * inverse;

			// combined extinction factor
			vec3 Fex = exp( -( vBetaR * sR + vBetaM * sM ) );

			// in scattering
			float cosTheta = dot( direction, vSunDirection );

			float rPhase = rayleighPhase( cosTheta * 0.5 + 0.5 );
			vec3 betaRTheta = vBetaR * rPhase;

			float mPhase = hgPhase( cosTheta, mieDirectionalG );
			vec3 betaMTheta = vBetaM * mPhase;

			vec3 Lin = pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * ( 1.0 - Fex ), vec3( 1.5 ) );
			Lin *= mix( vec3( 1.0 ), pow( vSunE * ( ( betaRTheta + betaMTheta ) / ( vBetaR + vBetaM ) ) * Fex, vec3( 1.0 / 2.0 ) ), clamp( pow( 1.0 - vSunDirection.y, 5.0 ), 0.0, 1.0 ) );

			// nightsky
			float theta = acos( direction.y ); // elevation --> y-axis, [-pi/2, pi/2]
			float phi = atan( direction.z, direction.x ); // azimuth --> x-axis [-pi/2, pi/2]
			vec2 uv = vec2( phi, theta ) / vec2( 2.0 * pi, pi ) + vec2( 0.5, 0.0 );
			vec3 L0 = vec3( 0.1 ) * Fex;

			// composition + solar disc
			float sundisc = clamp( ( cosTheta - sunAngularDiameterCos ) * 50000.0, 0.0, 1.0 ) * showSunDisc;
			vec3 sundiscColor = ( 760.0 * sundisc ) * min( vSunE * Fex, 80.0 );

			vec3 texColor = ( Lin + L0 ) * 0.04 + sundiscColor + vec3( 0.0, 0.0003, 0.00075 );

			// Clouds
			if ( direction.y > 0.0 && cloudCoverage > 0.0 ) {

				// Project to cloud plane (higher elevation = clouds appear lower/closer)
				float elevation = mix( 1.0, 0.1, cloudElevation );
				vec2 cloudUV = direction.xz / ( direction.y * elevation );
				cloudUV *= cloudScale;
				cloudUV += time * cloudSpeed;

				// Cloud density field
				float evolve = time * cloudSpeed * 300.0;
				float cloudNoise = clamp( fbm( cloudUV * 1000.0, evolve ) * 0.7 + 0.5, 0.0, 1.0 );

				// Large-scale coverage variation: clear gaps next to dense banks
				float region = noise( cloudUV * 300.0 ) * 0.37 + 0.5;
				float cov = clamp( cloudCoverage + ( region - 0.5 ) * 0.6, 0.0, 1.0 );

				// Carve clouds where noise rises above the coverage level
				float threshold = 1.0 - cov;
				float cloudMask = smoothstep( threshold, threshold + 0.3, cloudNoise );

				// Fade clouds near horizon (adjusted by elevation)
				float horizonFade = smoothstep( 0.0, 0.03 + 0.06 * cloudElevation, direction.y );
				cloudMask *= horizonFade;

				// Cloud lighting from the sky's own radiance
				float dayFactor = smoothstep( -0.08, 0.3, vSunDirection.y );
				vec3 sunColor = vSunE * Fex * 0.22 * 0.04; // 0.22 ~ albedo/pi, 0.04 = exposure; the aerial composite adds the eye-leg extinction
				vec3 skyAmbient = Lin * 0.04 + vec3( 0.0, 0.0003, 0.00075 );

				// Beer-powder self-shadow from the sampled density
				float depth = max( 0.0, cloudNoise - threshold );
				float beer = exp( depth * -4.0 );
				float powder = 1.0 - beer * beer; // beer*beer == exp(-8*depth)
				float shade = mix( 0.45, 1.0, clamp( beer * powder * 2.6, 0.0, 1.0 ) ); // 2.6 = 1/0.385, normalizes beer*powder peak to 1

				// Henyey-Greenstein forward lobe ( g = 0.7 ): silver lining on rims toward the sun
				float silver = clamp( 0.51 / pow( 1.49 - cosTheta * 1.4, 1.5 ), 0.0, 3.0 ); // 0.51=1-g^2, 1.49=1+g^2, 1.4=2g
				float edge = cloudMask * ( 1.0 - cloudMask ) * 4.0;

				vec3 cloudColor = skyAmbient + sunColor * shade;
				cloudColor += sunColor * silver * edge * 0.6;
				cloudColor *= max( dayFactor, 0.03 );

				// Cloud opacity via Beer's law: density sets how solid the clouds get
				float alpha = ( 1.0 - exp( depth * cloudDensity * -12.0 ) ) * horizonFade;

				// Occlude the sun disc/glow behind opaque cloud
				texColor -= L0 * 0.04 * alpha;

				// Composite through the atmosphere so distant clouds dissolve into haze
				vec3 cloudAerial = mix( texColor, cloudColor, Fex );
				texColor = mix( texColor, cloudAerial, alpha );

			}

			gl_FragColor = vec4( texColor, 1.0 );

			#include <tonemapping_fragment>
			#include <colorspace_fragment>

		}`};var qi={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

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


		}`};var ii=class{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}},ex=new Ai(-1,1,1,-1,0,1),wh=class extends De{constructor(){super(),this.setAttribute("position",new ge([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new ge([0,2,0,0,2,0],2))}},ix=new wh,Yi=class{constructor(t){this._mesh=new Zt(ix,t)}dispose(){this._mesh.geometry.dispose()}render(t){t.render(this._mesh,ex)}get material(){return this._mesh.material}set material(t){this._mesh.material=t}};var Sl=class extends ii{constructor(t,e="tDiffuse"){super(),this.textureID=e,this.uniforms=null,this.material=null,t instanceof ce?(this.uniforms=t.uniforms,this.material=t):t&&(this.uniforms=Ue.clone(t.uniforms),this.material=new ce({name:t.name!==void 0?t.name:"unspecified",defines:Object.assign({},t.defines),uniforms:this.uniforms,vertexShader:t.vertexShader,fragmentShader:t.fragmentShader})),this._fsQuad=new Yi(this.material)}render(t,e,i){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=i.texture),this._fsQuad.material=this.material,this.renderToScreen?(t.setRenderTarget(null),this._fsQuad.render(t)):(t.setRenderTarget(e),this.clear&&t.clear(t.autoClearColor,t.autoClearDepth,t.autoClearStencil),this._fsQuad.render(t))}dispose(){this.material.dispose(),this._fsQuad.dispose()}};var ao=class extends ii{constructor(t,e){super(),this.scene=t,this.camera=e,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(t,e,i){let n=t.getContext(),r=t.state;r.buffers.color.setMask(!1),r.buffers.depth.setMask(!1),r.buffers.color.setLocked(!0),r.buffers.depth.setLocked(!0);let o,a;this.inverse?(o=0,a=1):(o=1,a=0),r.buffers.stencil.setTest(!0),r.buffers.stencil.setOp(n.REPLACE,n.REPLACE,n.REPLACE),r.buffers.stencil.setFunc(n.ALWAYS,o,4294967295),r.buffers.stencil.setClear(a),r.buffers.stencil.setLocked(!0),t.setRenderTarget(i),this.clear&&t.clear(),t.render(this.scene,this.camera),t.setRenderTarget(e),this.clear&&t.clear(),t.render(this.scene,this.camera),r.buffers.color.setLocked(!1),r.buffers.depth.setLocked(!1),r.buffers.color.setMask(!0),r.buffers.depth.setMask(!0),r.buffers.stencil.setLocked(!1),r.buffers.stencil.setFunc(n.EQUAL,1,4294967295),r.buffers.stencil.setOp(n.KEEP,n.KEEP,n.KEEP),r.buffers.stencil.setLocked(!0)}},wl=class extends ii{constructor(){super(),this.needsSwap=!1}render(t){t.state.buffers.stencil.setLocked(!1),t.state.buffers.stencil.setTest(!1)}};var El=class{constructor(t,e){if(this.renderer=t,this._pixelRatio=t.getPixelRatio(),e===void 0){let i=t.getSize(new tt);this._width=i.width,this._height=i.height,e=new ve(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:we}),e.texture.name="EffectComposer.rt1"}else this._width=e.width,this._height=e.height;this.renderTarget1=e,this.renderTarget2=e.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new Sl(qi),this.copyPass.material.blending=Ae,this.timer=new Dr}swapBuffers(){let t=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=t}addPass(t){this.passes.push(t),t.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(t,e){this.passes.splice(e,0,t),t.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(t){let e=this.passes.indexOf(t);e!==-1&&this.passes.splice(e,1)}isLastEnabledPass(t){for(let e=t+1;e<this.passes.length;e++)if(this.passes[e].enabled)return!1;return!0}render(t){this.timer.update(),t===void 0&&(t=this.timer.getDelta());let e=this.renderer.getRenderTarget(),i=!1;for(let n=0,r=this.passes.length;n<r;n++){let o=this.passes[n];if(o.enabled!==!1){if(o.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(n),o.render(this.renderer,this.writeBuffer,this.readBuffer,t,i),o.needsSwap){if(i){let a=this.renderer.getContext(),l=this.renderer.state.buffers.stencil;l.setFunc(a.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,t),l.setFunc(a.EQUAL,1,4294967295)}this.swapBuffers()}ao!==void 0&&(o instanceof ao?i=!0:o instanceof wl&&(i=!1))}}this.renderer.setRenderTarget(e)}reset(t){if(t===void 0){let e=this.renderer.getSize(new tt);this._pixelRatio=this.renderer.getPixelRatio(),this._width=e.width,this._height=e.height,t=this.renderTarget1.clone(),t.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=t,this.renderTarget2=t.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(t,e){this._width=t,this._height=e;let i=this._width*this._pixelRatio,n=this._height*this._pixelRatio;this.renderTarget1.setSize(i,n),this.renderTarget2.setSize(i,n);for(let r=0;r<this.passes.length;r++)this.passes[r].setSize(i,n)}setPixelRatio(t){this._pixelRatio=t,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}};var Tl=class extends ii{constructor(t,e,i=null,n=null,r=null){super(),this.scene=t,this.camera=e,this.overrideMaterial=i,this.clearColor=n,this.clearAlpha=r,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new Vt}render(t,e,i){let n=t.autoClear;t.autoClear=!1;let r,o;this.overrideMaterial!==null&&(o=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(t.getClearColor(this._oldClearColor),t.setClearColor(this.clearColor,t.getClearAlpha())),this.clearAlpha!==null&&(r=t.getClearAlpha(),t.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&t.clearDepth(),t.setRenderTarget(this.renderToScreen?null:i),this.clear===!0&&t.clear(t.autoClearColor,t.autoClearDepth,t.autoClearStencil),t.render(this.scene,this.camera),this.clearColor!==null&&t.setClearColor(this._oldClearColor),this.clearAlpha!==null&&t.setClearAlpha(r),this.overrideMaterial!==null&&(this.scene.overrideMaterial=o),t.autoClear=n}};var lo={name:"GTAOShader",defines:{PERSPECTIVE_CAMERA:1,SAMPLES:16,NORMAL_VECTOR_TYPE:1,DEPTH_SWIZZLING:"x",SCREEN_SPACE_RADIUS:0,SCREEN_SPACE_RADIUS_SCALE:100,SCENE_CLIP_BOX:0},uniforms:{tNormal:{value:null},tDepth:{value:null},tNoise:{value:null},resolution:{value:new tt},cameraNear:{value:null},cameraFar:{value:null},cameraProjectionMatrix:{value:new oe},cameraProjectionMatrixInverse:{value:new oe},cameraWorldMatrix:{value:new oe},radius:{value:.25},distanceExponent:{value:1},thickness:{value:1},distanceFallOff:{value:1},scale:{value:1},sceneBoxMin:{value:new D(-1,-1,-1)},sceneBoxMax:{value:new D(1,1,1)}},vertexShader:`

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
		}`},co={name:"GTAODepthShader",defines:{PERSPECTIVE_CAMERA:1},uniforms:{tDepth:{value:null},cameraNear:{value:null},cameraFar:{value:null}},vertexShader:`
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

		}`},Al={name:"GTAOBlendShader",uniforms:{tDiffuse:{value:null},intensity:{value:1}},vertexShader:`
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
		}`};function Xd(s=5){let t=Math.floor(s)%2===0?Math.floor(s)+1:Math.floor(s),e=nx(t),i=e.length,n=new Uint8Array(i*4);for(let o=0;o<i;++o){let a=e[o],l=2*Math.PI*a/i,c=new D(Math.cos(l),Math.sin(l),0).normalize();n[o*4]=(c.x*.5+.5)*255,n[o*4+1]=(c.y*.5+.5)*255,n[o*4+2]=127,n[o*4+3]=255}let r=new mn(n,t,t);return r.wrapS=gi,r.wrapT=gi,r.needsUpdate=!0,r}function nx(s){let t=Math.floor(s)%2===0?Math.floor(s)+1:Math.floor(s),e=t*t,i=Array(e).fill(0),n=Math.floor(t/2),r=t-1;for(let o=1;o<=e;){if(n===-1&&r===t?(r=t-2,n=0):(r===t&&(r=0),n<0&&(n=t-1)),i[n*t+r]!==0){r-=2,n++;continue}else i[n*t+r]=o++;r++,n--}return i}var ho={name:"PoissonDenoiseShader",defines:{SAMPLES:16,SAMPLE_VECTORS:Eh(16,2,1),NORMAL_VECTOR_TYPE:1,DEPTH_VALUE_SOURCE:0},uniforms:{tDiffuse:{value:null},tNormal:{value:null},tDepth:{value:null},tNoise:{value:null},resolution:{value:new tt},cameraProjectionMatrixInverse:{value:new oe},lumaPhi:{value:5},depthPhi:{value:5},normalPhi:{value:5},radius:{value:4},index:{value:0}},vertexShader:`

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
		}`};function Eh(s,t,e){let i=sx(s,t,e),n="vec3[SAMPLES](";for(let r=0;r<s;r++){let o=i[r];n+=`vec3(${o.x}, ${o.y}, ${o.z})${r<s-1?",":")"}`}return n}function sx(s,t,e){let i=[];for(let n=0;n<s;n++){let r=2*Math.PI*t*n/s,o=Math.pow(n/(s-1),e);i.push(new D(Math.cos(r),Math.sin(r),o))}return i}var Cl=class{constructor(t=Math){this.grad3=[[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]],this.grad4=[[0,1,1,1],[0,1,1,-1],[0,1,-1,1],[0,1,-1,-1],[0,-1,1,1],[0,-1,1,-1],[0,-1,-1,1],[0,-1,-1,-1],[1,0,1,1],[1,0,1,-1],[1,0,-1,1],[1,0,-1,-1],[-1,0,1,1],[-1,0,1,-1],[-1,0,-1,1],[-1,0,-1,-1],[1,1,0,1],[1,1,0,-1],[1,-1,0,1],[1,-1,0,-1],[-1,1,0,1],[-1,1,0,-1],[-1,-1,0,1],[-1,-1,0,-1],[1,1,1,0],[1,1,-1,0],[1,-1,1,0],[1,-1,-1,0],[-1,1,1,0],[-1,1,-1,0],[-1,-1,1,0],[-1,-1,-1,0]],this.p=[];for(let e=0;e<256;e++)this.p[e]=Math.floor(t.random()*256);this.perm=[];for(let e=0;e<512;e++)this.perm[e]=this.p[e&255];this.simplex=[[0,1,2,3],[0,1,3,2],[0,0,0,0],[0,2,3,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,3,0],[0,2,1,3],[0,0,0,0],[0,3,1,2],[0,3,2,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,3,2,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,0,3],[0,0,0,0],[1,3,0,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,3,0,1],[2,3,1,0],[1,0,2,3],[1,0,3,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,3,1],[0,0,0,0],[2,1,3,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,1,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,0,1,2],[3,0,2,1],[0,0,0,0],[3,1,2,0],[2,1,0,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,1,0,2],[0,0,0,0],[3,2,0,1],[3,2,1,0]]}noise(t,e){let i,n,r,o=.5*(Math.sqrt(3)-1),a=(t+e)*o,l=Math.floor(t+a),c=Math.floor(e+a),h=(3-Math.sqrt(3))/6,f=(l+c)*h,u=l-f,d=c-f,m=t-u,_=e-d,p,g;m>_?(p=1,g=0):(p=0,g=1);let M=m-p+h,T=_-g+h,y=m-1+2*h,b=_-1+2*h,E=l&255,C=c&255,x=this.perm[E+this.perm[C]]%12,A=this.perm[E+p+this.perm[C+g]]%12,L=this.perm[E+1+this.perm[C+1]]%12,U=.5-m*m-_*_;U<0?i=0:(U*=U,i=U*U*this._dot(this.grad3[x],m,_));let w=.5-M*M-T*T;w<0?n=0:(w*=w,n=w*w*this._dot(this.grad3[A],M,T));let P=.5-y*y-b*b;return P<0?r=0:(P*=P,r=P*P*this._dot(this.grad3[L],y,b)),70*(i+n+r)}noise3d(t,e,i){let n,r,o,a,c=(t+e+i)*.3333333333333333,h=Math.floor(t+c),f=Math.floor(e+c),u=Math.floor(i+c),d=1/6,m=(h+f+u)*d,_=h-m,p=f-m,g=u-m,M=t-_,T=e-p,y=i-g,b,E,C,x,A,L;M>=T?T>=y?(b=1,E=0,C=0,x=1,A=1,L=0):M>=y?(b=1,E=0,C=0,x=1,A=0,L=1):(b=0,E=0,C=1,x=1,A=0,L=1):T<y?(b=0,E=0,C=1,x=0,A=1,L=1):M<y?(b=0,E=1,C=0,x=0,A=1,L=1):(b=0,E=1,C=0,x=1,A=1,L=0);let U=M-b+d,w=T-E+d,P=y-C+d,I=M-x+2*d,N=T-A+2*d,B=y-L+2*d,O=M-1+3*d,G=T-1+3*d,V=y-1+3*d,W=h&255,$=f&255,dt=u&255,mt=this.perm[W+this.perm[$+this.perm[dt]]]%12,Ct=this.perm[W+b+this.perm[$+E+this.perm[dt+C]]]%12,wt=this.perm[W+x+this.perm[$+A+this.perm[dt+L]]]%12,Ht=this.perm[W+1+this.perm[$+1+this.perm[dt+1]]]%12,Z=.6-M*M-T*T-y*y;Z<0?n=0:(Z*=Z,n=Z*Z*this._dot3(this.grad3[mt],M,T,y));let j=.6-U*U-w*w-P*P;j<0?r=0:(j*=j,r=j*j*this._dot3(this.grad3[Ct],U,w,P));let ut=.6-I*I-N*N-B*B;ut<0?o=0:(ut*=ut,o=ut*ut*this._dot3(this.grad3[wt],I,N,B));let It=.6-O*O-G*G-V*V;return It<0?a=0:(It*=It,a=It*It*this._dot3(this.grad3[Ht],O,G,V)),32*(n+r+o+a)}noise4d(t,e,i,n){let r=this.grad4,o=this.simplex,a=this.perm,l=(Math.sqrt(5)-1)/4,c=(5-Math.sqrt(5))/20,h,f,u,d,m,_=(t+e+i+n)*l,p=Math.floor(t+_),g=Math.floor(e+_),M=Math.floor(i+_),T=Math.floor(n+_),y=(p+g+M+T)*c,b=p-y,E=g-y,C=M-y,x=T-y,A=t-b,L=e-E,U=i-C,w=n-x,P=A>L?32:0,I=A>U?16:0,N=L>U?8:0,B=A>w?4:0,O=L>w?2:0,G=U>w?1:0,V=P+I+N+B+O+G,W=o[V][0]>=3?1:0,$=o[V][1]>=3?1:0,dt=o[V][2]>=3?1:0,mt=o[V][3]>=3?1:0,Ct=o[V][0]>=2?1:0,wt=o[V][1]>=2?1:0,Ht=o[V][2]>=2?1:0,Z=o[V][3]>=2?1:0,j=o[V][0]>=1?1:0,ut=o[V][1]>=1?1:0,It=o[V][2]>=1?1:0,vt=o[V][3]>=1?1:0,Bt=A-W+c,ie=L-$+c,et=U-dt+c,at=w-mt+c,st=A-Ct+2*c,ot=L-wt+2*c,ct=U-Ht+2*c,Ft=w-Z+2*c,Pt=A-j+3*c,Dt=L-ut+3*c,Xt=U-It+3*c,F=w-vt+3*c,se=A-1+4*c,Jt=L-1+4*c,R=U-1+4*c,v=w-1+4*c,H=p&255,X=g&255,K=M&255,ht=T&255,ft=a[H+a[X+a[K+a[ht]]]]%32,Q=a[H+W+a[X+$+a[K+dt+a[ht+mt]]]]%32,nt=a[H+Ct+a[X+wt+a[K+Ht+a[ht+Z]]]]%32,_t=a[H+j+a[X+ut+a[K+It+a[ht+vt]]]]%32,kt=a[H+1+a[X+1+a[K+1+a[ht+1]]]]%32,gt=.6-A*A-L*L-U*U-w*w;gt<0?h=0:(gt*=gt,h=gt*gt*this._dot4(r[ft],A,L,U,w));let pt=.6-Bt*Bt-ie*ie-et*et-at*at;pt<0?f=0:(pt*=pt,f=pt*pt*this._dot4(r[Q],Bt,ie,et,at));let Lt=.6-st*st-ot*ot-ct*ct-Ft*Ft;Lt<0?u=0:(Lt*=Lt,u=Lt*Lt*this._dot4(r[nt],st,ot,ct,Ft));let Gt=.6-Pt*Pt-Dt*Dt-Xt*Xt-F*F;Gt<0?d=0:(Gt*=Gt,d=Gt*Gt*this._dot4(r[_t],Pt,Dt,Xt,F));let $t=.6-se*se-Jt*Jt-R*R-v*v;return $t<0?m=0:($t*=$t,m=$t*$t*this._dot4(r[kt],se,Jt,R,v)),27*(h+f+u+d+m)}_dot(t,e,i){return t[0]*e+t[1]*i}_dot3(t,e,i,n){return t[0]*e+t[1]*i+t[2]*n}_dot4(t,e,i,n,r){return t[0]*e+t[1]*i+t[2]*n+t[3]*r}};var Ws=class s extends ii{constructor(t,e,i=512,n=512,r,o,a){super(),this.width=i,this.height=n,this.clear=!0,this.camera=e,this.scene=t,this.output=0,this._renderGBuffer=!0,this._visibilityCache=[],this.blendIntensity=1,this.pdRings=2,this.pdRadiusExponent=2,this.pdSamples=16,this.gtaoNoiseTexture=Xd(),this.pdNoiseTexture=this._generateNoise(),this.gtaoRenderTarget=new ve(this.width,this.height,{type:we,depthBuffer:!1}),this.pdRenderTarget=this.gtaoRenderTarget.clone(),this.gtaoMaterial=new ce({defines:Object.assign({},lo.defines),uniforms:Ue.clone(lo.uniforms),vertexShader:lo.vertexShader,fragmentShader:lo.fragmentShader,blending:Ae,depthTest:!1,depthWrite:!1}),this.gtaoMaterial.defines.PERSPECTIVE_CAMERA=this.camera.isPerspectiveCamera?1:0,this.gtaoMaterial.uniforms.tNoise.value=this.gtaoNoiseTexture,this.gtaoMaterial.uniforms.resolution.value.set(this.width,this.height),this.gtaoMaterial.uniforms.cameraNear.value=this.camera.near,this.gtaoMaterial.uniforms.cameraFar.value=this.camera.far,this.normalMaterial=new Er,this.normalMaterial.blending=Ae,this.pdMaterial=new ce({defines:Object.assign({},ho.defines),uniforms:Ue.clone(ho.uniforms),vertexShader:ho.vertexShader,fragmentShader:ho.fragmentShader,depthTest:!1,depthWrite:!1}),this.pdMaterial.uniforms.tDiffuse.value=this.gtaoRenderTarget.texture,this.pdMaterial.uniforms.tNoise.value=this.pdNoiseTexture,this.pdMaterial.uniforms.resolution.value.set(this.width,this.height),this.pdMaterial.uniforms.lumaPhi.value=10,this.pdMaterial.uniforms.depthPhi.value=2,this.pdMaterial.uniforms.normalPhi.value=3,this.pdMaterial.uniforms.radius.value=8,this.depthRenderMaterial=new ce({defines:Object.assign({},co.defines),uniforms:Ue.clone(co.uniforms),vertexShader:co.vertexShader,fragmentShader:co.fragmentShader,blending:Ae}),this.depthRenderMaterial.uniforms.cameraNear.value=this.camera.near,this.depthRenderMaterial.uniforms.cameraFar.value=this.camera.far,this.copyMaterial=new ce({uniforms:Ue.clone(qi.uniforms),vertexShader:qi.vertexShader,fragmentShader:qi.fragmentShader,transparent:!0,depthTest:!1,depthWrite:!1,blendSrc:Or,blendDst:qn,blendEquation:_i,blendSrcAlpha:Fr,blendDstAlpha:qn,blendEquationAlpha:_i}),this.blendMaterial=new ce({uniforms:Ue.clone(Al.uniforms),vertexShader:Al.vertexShader,fragmentShader:Al.fragmentShader,transparent:!0,depthTest:!1,depthWrite:!1,blending:Ma,blendSrc:Or,blendDst:qn,blendEquation:_i,blendSrcAlpha:Fr,blendDstAlpha:qn,blendEquationAlpha:_i}),this._fsQuad=new Yi(null),this._originalClearColor=new Vt,this.setGBuffer(r?r.depthTexture:void 0,r?r.normalTexture:void 0),o!==void 0&&this.updateGtaoMaterial(o),a!==void 0&&this.updatePdMaterial(a)}setSize(t,e){this.width=t,this.height=e,this.gtaoRenderTarget.setSize(t,e),this.normalRenderTarget.setSize(t,e),this.pdRenderTarget.setSize(t,e),this.gtaoMaterial.uniforms.resolution.value.set(t,e),this.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this.pdMaterial.uniforms.resolution.value.set(t,e),this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse)}dispose(){this.gtaoNoiseTexture.dispose(),this.pdNoiseTexture.dispose(),this.normalRenderTarget.dispose(),this.gtaoRenderTarget.dispose(),this.pdRenderTarget.dispose(),this.normalMaterial.dispose(),this.pdMaterial.dispose(),this.copyMaterial.dispose(),this.depthRenderMaterial.dispose(),this._fsQuad.dispose()}get gtaoMap(){return this.pdRenderTarget.texture}setGBuffer(t,e){t!==void 0?(this.depthTexture=t,this.normalTexture=e,this._renderGBuffer=!1):(this.depthTexture=new Vi,this.depthTexture.format=Hi,this.depthTexture.type=Cn,this.normalRenderTarget=new ve(this.width,this.height,{minFilter:Te,magFilter:Te,type:we,depthTexture:this.depthTexture}),this.normalTexture=this.normalRenderTarget.texture,this._renderGBuffer=!0);let i=this.normalTexture?1:0,n=this.depthTexture===this.normalTexture?"w":"x";this.gtaoMaterial.defines.NORMAL_VECTOR_TYPE=i,this.gtaoMaterial.defines.DEPTH_SWIZZLING=n,this.gtaoMaterial.uniforms.tNormal.value=this.normalTexture,this.gtaoMaterial.uniforms.tDepth.value=this.depthTexture,this.pdMaterial.defines.NORMAL_VECTOR_TYPE=i,this.pdMaterial.defines.DEPTH_SWIZZLING=n,this.pdMaterial.uniforms.tNormal.value=this.normalTexture,this.pdMaterial.uniforms.tDepth.value=this.depthTexture,this.depthRenderMaterial.uniforms.tDepth.value=this.normalRenderTarget.depthTexture}setSceneClipBox(t){t?(this.gtaoMaterial.needsUpdate=this.gtaoMaterial.defines.SCENE_CLIP_BOX!==1,this.gtaoMaterial.defines.SCENE_CLIP_BOX=1,this.gtaoMaterial.uniforms.sceneBoxMin.value.copy(t.min),this.gtaoMaterial.uniforms.sceneBoxMax.value.copy(t.max)):(this.gtaoMaterial.needsUpdate=this.gtaoMaterial.defines.SCENE_CLIP_BOX===0,this.gtaoMaterial.defines.SCENE_CLIP_BOX=0)}updateGtaoMaterial(t){t.radius!==void 0&&(this.gtaoMaterial.uniforms.radius.value=t.radius),t.distanceExponent!==void 0&&(this.gtaoMaterial.uniforms.distanceExponent.value=t.distanceExponent),t.thickness!==void 0&&(this.gtaoMaterial.uniforms.thickness.value=t.thickness),t.distanceFallOff!==void 0&&(this.gtaoMaterial.uniforms.distanceFallOff.value=t.distanceFallOff,this.gtaoMaterial.needsUpdate=!0),t.scale!==void 0&&(this.gtaoMaterial.uniforms.scale.value=t.scale),t.samples!==void 0&&t.samples!==this.gtaoMaterial.defines.SAMPLES&&(this.gtaoMaterial.defines.SAMPLES=t.samples,this.gtaoMaterial.needsUpdate=!0),t.screenSpaceRadius!==void 0&&(t.screenSpaceRadius?1:0)!==this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS&&(this.gtaoMaterial.defines.SCREEN_SPACE_RADIUS=t.screenSpaceRadius?1:0,this.gtaoMaterial.needsUpdate=!0)}updatePdMaterial(t){let e=!1;t.lumaPhi!==void 0&&(this.pdMaterial.uniforms.lumaPhi.value=t.lumaPhi),t.depthPhi!==void 0&&(this.pdMaterial.uniforms.depthPhi.value=t.depthPhi),t.normalPhi!==void 0&&(this.pdMaterial.uniforms.normalPhi.value=t.normalPhi),t.radius!==void 0&&t.radius!==this.radius&&(this.pdMaterial.uniforms.radius.value=t.radius),t.radiusExponent!==void 0&&t.radiusExponent!==this.pdRadiusExponent&&(this.pdRadiusExponent=t.radiusExponent,e=!0),t.rings!==void 0&&t.rings!==this.pdRings&&(this.pdRings=t.rings,e=!0),t.samples!==void 0&&t.samples!==this.pdSamples&&(this.pdSamples=t.samples,e=!0),e&&(this.pdMaterial.defines.SAMPLES=this.pdSamples,this.pdMaterial.defines.SAMPLE_VECTORS=Eh(this.pdSamples,this.pdRings,this.pdRadiusExponent),this.pdMaterial.needsUpdate=!0)}render(t,e,i){switch(this._renderGBuffer&&(this._overrideVisibility(),this._renderOverride(t,this.normalMaterial,this.normalRenderTarget,7829503,1),this._restoreVisibility()),this.gtaoMaterial.uniforms.cameraNear.value=this.camera.near,this.gtaoMaterial.uniforms.cameraFar.value=this.camera.far,this.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix),this.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this.gtaoMaterial.uniforms.cameraWorldMatrix.value.copy(this.camera.matrixWorld),this._renderPass(t,this.gtaoMaterial,this.gtaoRenderTarget,16777215,1),this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse),this._renderPass(t,this.pdMaterial,this.pdRenderTarget,16777215,1),this.output){case s.OUTPUT.Off:break;case s.OUTPUT.Diffuse:this.copyMaterial.uniforms.tDiffuse.value=i.texture,this.copyMaterial.blending=Ae,this._renderPass(t,this.copyMaterial,this.renderToScreen?null:e);break;case s.OUTPUT.AO:this.copyMaterial.uniforms.tDiffuse.value=this.gtaoRenderTarget.texture,this.copyMaterial.blending=Ae,this._renderPass(t,this.copyMaterial,this.renderToScreen?null:e);break;case s.OUTPUT.Denoise:this.copyMaterial.uniforms.tDiffuse.value=this.pdRenderTarget.texture,this.copyMaterial.blending=Ae,this._renderPass(t,this.copyMaterial,this.renderToScreen?null:e);break;case s.OUTPUT.Depth:this.depthRenderMaterial.uniforms.cameraNear.value=this.camera.near,this.depthRenderMaterial.uniforms.cameraFar.value=this.camera.far,this._renderPass(t,this.depthRenderMaterial,this.renderToScreen?null:e);break;case s.OUTPUT.Normal:this.copyMaterial.uniforms.tDiffuse.value=this.normalRenderTarget.texture,this.copyMaterial.blending=Ae,this._renderPass(t,this.copyMaterial,this.renderToScreen?null:e);break;case s.OUTPUT.Default:this.copyMaterial.uniforms.tDiffuse.value=i.texture,this.copyMaterial.blending=Ae,this._renderPass(t,this.copyMaterial,this.renderToScreen?null:e),this.blendMaterial.uniforms.intensity.value=this.blendIntensity,this.blendMaterial.uniforms.tDiffuse.value=this.pdRenderTarget.texture,this._renderPass(t,this.blendMaterial,this.renderToScreen?null:e);break;default:console.warn("THREE.GTAOPass: Unknown output type.")}}_renderPass(t,e,i,n,r){t.getClearColor(this._originalClearColor);let o=t.getClearAlpha(),a=t.autoClear;t.setRenderTarget(i),t.autoClear=!1,n!=null&&(t.setClearColor(n),t.setClearAlpha(r||0),t.clear()),this._fsQuad.material=e,this._fsQuad.render(t),t.autoClear=a,t.setClearColor(this._originalClearColor),t.setClearAlpha(o)}_renderOverride(t,e,i,n,r){t.getClearColor(this._originalClearColor);let o=t.getClearAlpha(),a=t.autoClear;t.setRenderTarget(i),t.autoClear=!1,n=e.clearColor||n,r=e.clearAlpha||r,n!=null&&(t.setClearColor(n),t.setClearAlpha(r||0),t.clear()),this.scene.overrideMaterial=e,t.render(this.scene,this.camera),this.scene.overrideMaterial=null,t.autoClear=a,t.setClearColor(this._originalClearColor),t.setClearAlpha(o)}_overrideVisibility(){let t=this.scene,e=this._visibilityCache;t.traverse(function(i){(i.isPoints||i.isLine||i.isLine2)&&i.visible&&(i.visible=!1,e.push(i))})}_restoreVisibility(){let t=this._visibilityCache;for(let e=0;e<t.length;e++)t[e].visible=!0;t.length=0}_generateNoise(t=64){let e=new Cl,i=t*t*4,n=new Uint8Array(i);for(let o=0;o<t;o++)for(let a=0;a<t;a++){let l=o,c=a;n[(o*t+a)*4]=(e.noise(l,c)*.5+.5)*255,n[(o*t+a)*4+1]=(e.noise(l+t,c)*.5+.5)*255,n[(o*t+a)*4+2]=(e.noise(l,c+t)*.5+.5)*255,n[(o*t+a)*4+3]=(e.noise(l+t,c+t)*.5+.5)*255}let r=new mn(n,t,t,ri,$e);return r.wrapS=gi,r.wrapT=gi,r.needsUpdate=!0,r}};Ws.OUTPUT={Off:-1,Default:0,Diffuse:1,Depth:2,Normal:3,AO:4,Denoise:5};var qd={name:"LuminosityHighPassShader",uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new Vt(0)},defaultOpacity:{value:0}},vertexShader:`

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

		}`};var Xs=class s extends ii{constructor(t,e=1,i,n){super(),this.strength=e,this.radius=i,this.threshold=n,this.resolution=t!==void 0?new tt(t.x,t.y):new tt(256,256),this.clearColor=new Vt(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let r=Math.round(this.resolution.x/2),o=Math.round(this.resolution.y/2);this.renderTargetBright=new ve(r,o,{type:we,depthBuffer:!1}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let h=0;h<this.nMips;h++){let f=new ve(r,o,{type:we,depthBuffer:!1});f.texture.name="UnrealBloomPass.h"+h,f.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(f);let u=new ve(r,o,{type:we,depthBuffer:!1});u.texture.name="UnrealBloomPass.v"+h,u.texture.generateMipmaps=!1,this.renderTargetsVertical.push(u),r=Math.round(r/2),o=Math.round(o/2)}let a=qd;this.highPassUniforms=Ue.clone(a.uniforms),this.highPassUniforms.luminosityThreshold.value=n,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new ce({uniforms:this.highPassUniforms,vertexShader:a.vertexShader,fragmentShader:a.fragmentShader}),this.separableBlurMaterials=[];let l=[6,10,14,18,22];r=Math.round(this.resolution.x/2),o=Math.round(this.resolution.y/2);for(let h=0;h<this.nMips;h++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(l[h])),this.separableBlurMaterials[h].uniforms.invSize.value=new tt(1/r,1/o),r=Math.round(r/2),o=Math.round(o/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=e,this.compositeMaterial.uniforms.bloomRadius.value=.1;let c=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=c,this.bloomTintColors=[new D(1,1,1),new D(1,1,1),new D(1,1,1),new D(1,1,1),new D(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=Ue.clone(qi.uniforms),this.blendMaterial=new ce({uniforms:this.copyUniforms,vertexShader:qi.vertexShader,fragmentShader:qi.fragmentShader,premultipliedAlpha:!0,blending:Xn,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new Vt,this._oldClearAlpha=1,this._basic=new ni,this._fsQuad=new Yi(null)}dispose(){for(let t=0;t<this.renderTargetsHorizontal.length;t++)this.renderTargetsHorizontal[t].dispose();for(let t=0;t<this.renderTargetsVertical.length;t++)this.renderTargetsVertical[t].dispose();this.renderTargetBright.dispose();for(let t=0;t<this.separableBlurMaterials.length;t++)this.separableBlurMaterials[t].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(t,e){let i=Math.round(t/2),n=Math.round(e/2);this.renderTargetBright.setSize(i,n);for(let r=0;r<this.nMips;r++)this.renderTargetsHorizontal[r].setSize(i,n),this.renderTargetsVertical[r].setSize(i,n),this.separableBlurMaterials[r].uniforms.invSize.value=new tt(1/i,1/n),i=Math.round(i/2),n=Math.round(n/2)}render(t,e,i,n,r){t.getClearColor(this._oldClearColor),this._oldClearAlpha=t.getClearAlpha();let o=t.autoClear;t.autoClear=!1,t.setClearColor(this.clearColor,0),r&&t.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=i.texture,t.setRenderTarget(null),t.clear(),this._fsQuad.render(t)),this.highPassUniforms.tDiffuse.value=i.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,t.setRenderTarget(this.renderTargetBright),t.clear(),this._fsQuad.render(t);let a=this.renderTargetBright;for(let l=0;l<this.nMips;l++)this._fsQuad.material=this.separableBlurMaterials[l],this.separableBlurMaterials[l].uniforms.colorTexture.value=a.texture,this.separableBlurMaterials[l].uniforms.direction.value=s.BlurDirectionX,t.setRenderTarget(this.renderTargetsHorizontal[l]),t.clear(),this._fsQuad.render(t),this.separableBlurMaterials[l].uniforms.colorTexture.value=this.renderTargetsHorizontal[l].texture,this.separableBlurMaterials[l].uniforms.direction.value=s.BlurDirectionY,t.setRenderTarget(this.renderTargetsVertical[l]),t.clear(),this._fsQuad.render(t),a=this.renderTargetsVertical[l];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,t.setRenderTarget(this.renderTargetsHorizontal[0]),t.clear(),this._fsQuad.render(t),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,r&&t.state.buffers.stencil.setTest(!0),this.renderToScreen?(t.setRenderTarget(null),this._fsQuad.render(t)):(t.setRenderTarget(i),this._fsQuad.render(t)),t.setClearColor(this._oldClearColor,this._oldClearAlpha),t.autoClear=o}_getSeparableBlurMaterial(t){let e=[],i=t/3;for(let o=0;o<t;o++)e.push(.39894*Math.exp(-.5*o*o/(i*i))/i);let n=[],r=[];for(let o=1;o<t;o+=2){let a=e[o],l=o+1<t?e[o+1]:0,c=a+l;n.push((o*a+(o+1)*l)/c),r.push(c)}return new ce({defines:{KERNEL_PAIRS:n.length},uniforms:{colorTexture:{value:null},invSize:{value:new tt(.5,.5)},direction:{value:new tt(.5,.5)},centerWeight:{value:e[0]},gaussianOffsets:{value:n},gaussianWeights:{value:r}},vertexShader:`

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

				}`})}_getCompositeMaterial(t){return new ce({defines:{NUM_MIPS:t},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`

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

				}`})}};Xs.BlurDirectionX=new tt(1,0);Xs.BlurDirectionY=new tt(0,1);var uo={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
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

		}`};var Rl=class extends ii{constructor(){super(),this.isOutputPass=!0,this.uniforms=Ue.clone(uo.uniforms),this.material=new Ps({name:uo.name,uniforms:this.uniforms,vertexShader:uo.vertexShader,fragmentShader:uo.fragmentShader}),this._fsQuad=new Yi(this.material),this._outputColorSpace=null,this._toneMapping=null}render(t,e,i){this.uniforms.tDiffuse.value=i.texture,this.uniforms.toneMappingExposure.value=t.toneMappingExposure,(this._outputColorSpace!==t.outputColorSpace||this._toneMapping!==t.toneMapping)&&(this._outputColorSpace=t.outputColorSpace,this._toneMapping=t.toneMapping,this.material.defines={},ne.getTransfer(this._outputColorSpace)===le&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===Br?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===kr?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===zr?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===En?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===Hr?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===Gr?this.material.defines.NEUTRAL_TONE_MAPPING="":this._toneMapping===Vr&&(this.material.defines.CUSTOM_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(t.setRenderTarget(null),this._fsQuad.render(t)):(t.setRenderTarget(e),this.clear&&t.clear(t.autoClearColor,t.autoClearDepth,t.autoClearStencil),this._fsQuad.render(t))}dispose(){this.material.dispose(),this._fsQuad.dispose()}};var Jn=Math.PI/180;function Yd(s,t,e,i=0){let n=23.44*Math.sin(Jn*.9863013698630136*(t-81)),r=15*(s-12),o=e*Jn,a=n*Jn,l=r*Jn,c=Math.sin(o)*Math.sin(a)+Math.cos(o)*Math.cos(a)*Math.cos(l),h=Math.asin(Math.max(-1,Math.min(1,c))),f=(Math.sin(a)-Math.sin(h)*Math.sin(o))/(Math.cos(h)*Math.cos(o)||1e-9),u=Math.acos(Math.max(-1,Math.min(1,f)));r>0&&(u=2*Math.PI-u);let d=u-i*Jn,m=[Math.sin(d)*Math.cos(h),Math.sin(h),-Math.cos(d)*Math.cos(h)];return{elevation:h/Jn,azimuth:u/Jn,dir:m}}var $i=(s,t,e)=>s+(t-s)*e,Zi=(s,t,e)=>[$i(s[0],t[0],e),$i(s[1],t[1],e),$i(s[2],t[2],e)],rn=s=>Math.max(0,Math.min(1,s));function Th(s,t="clear"){let e=s,i=rn((e+6)/18),n=rn(1-Math.abs(e-8)/14),r=rn((-e-4)/8),o=t==="overcast"?1:t==="hazy"?.45:0,a=Zi(Zi([1,.96,.9],[1,.72,.42],n),[.85,.87,.92],o),l=i*$i(3.4,.9,o)*(1-r),c=Zi(Zi([.05,.08,.16],[.36,.56,.92],i),[.62,.66,.72],o),h=Zi(Zi([.1,.12,.2],Zi([.78,.86,.96],[.98,.72,.5],n),i),[.8,.82,.85],o),f=Zi(Zi([.16,.2,.34],[.78,.86,1],i),[.78,.8,.84],o),u=Zi([.05,.06,.08],[.45,.42,.38],i),d=$i(.35,$i(1.6,2.2,o),i),m=$i(.95,1.05,i),_=r*.35;return{day:i,night:r,golden:n,overcast:o,sunColor:a,sunIntensity:l,skyTop:c,skyHorizon:h,hemiSky:f,hemiGround:u,hemiIntensity:d,exposure:m,moon:_,turbidity:$i(3,12,o),rayleigh:$i(2.2,.8,o),mie:$i(.005,.02,o)}}var Pl=s=>Math.round(rn(s[0])*255)<<16|Math.round(rn(s[1])*255)<<8|Math.round(rn(s[2])*255),Il=s=>`rgb(${Math.round(rn(s[0])*255)}, ${Math.round(rn(s[1])*255)}, ${Math.round(rn(s[2])*255)})`;function Zd(s){let t=Math.floor(s),e=Math.round((s-t)*60)%60;return`${String(t).padStart(2,"0")}:${String(e).padStart(2,"0")}`}var rx=["\u05D9\u05E0\u05D5\u05D0\u05E8","\u05E4\u05D1\u05E8\u05D5\u05D0\u05E8","\u05DE\u05E8\u05E5","\u05D0\u05E4\u05E8\u05D9\u05DC","\u05DE\u05D0\u05D9","\u05D9\u05D5\u05E0\u05D9","\u05D9\u05D5\u05DC\u05D9","\u05D0\u05D5\u05D2\u05D5\u05E1\u05D8","\u05E1\u05E4\u05D8\u05DE\u05D1\u05E8","\u05D0\u05D5\u05E7\u05D8\u05D5\u05D1\u05E8","\u05E0\u05D5\u05D1\u05DE\u05D1\u05E8","\u05D3\u05E6\u05DE\u05D1\u05E8"];function $d(s){let t=new Date(Date.UTC(2026,0,1)+(s-1)*864e5);return`${t.getUTCDate()} \u05D1${rx[t.getUTCMonth()]}`}var Ll=class{constructor(t,e={}){this.renderer=new fl({canvas:t,antialias:!0,powerPreference:"high-performance",preserveDrawingBuffer:!0,alpha:!0,premultipliedAlpha:!0}),this.renderer.setClearColor(0,0),this.renderer.shadowMap.enabled=!0,this.renderer.shadowMap.type=Sn,this.renderer.shadowMap.autoUpdate=!1,this.renderer.shadowMap.needsUpdate=!0,this.renderer.toneMapping=En,this.renderer.outputColorSpace=Pe,this.dpr=Math.min(e.maxDpr??2,window.devicePixelRatio||1),this.renderer.setPixelRatio(this.dpr),this.scene=new On,this.skyScene=new On,this.sky=new Gs,this.sky.scale.setScalar(2e3),this.skyScene.add(this.sky),this.skyVisible=new Gs,this.skyVisible.scale.setScalar(2e3),this.skyVisible.visible=!1,this.scene.add(this.skyVisible);let i=new _n(400,48,24),n=new Float32Array(i.attributes.position.count*3);i.setAttribute("color",new Le(n,3)),this.dome=new Zt(i,new ni({vertexColors:!0,side:Ne,toneMapped:!1,fog:!1,depthWrite:!1})),this.dome.frustumCulled=!1,this.dome.renderOrder=-10,this.dome.userData={kind:"sky"},this.scene.add(this.dome),this.domeScene=new On,this.domeScene.add(new Zt(i,this.dome.material)),this.sun=new Is(16777215,3),this.sun.castShadow=!0,this.sun.shadow.mapSize.set(2048,2048),this.sun.shadow.bias=-5e-4,this.sun.shadow.normalBias=.03,this.sun.shadow.radius=6,this.scene.add(this.sun),this.scene.add(this.sun.target),this.hemi=new Cr(16777215,4478310,1.5),this.scene.add(this.hemi),this.ambient=new Lr(16777215,0),this.scene.add(this.ambient),this.moon=new Is(12570879,0),this.scene.add(this.moon),this.pmrem=new zs(this.renderer),this.pmrem.compileCubemapShader(),this.envTarget=null,this.quality=3,this.composer=null,this.time={hour:15.5,day:278,latitude:32.08,north:0,weather:"clear"},this.recipe=Th(40,"clear"),this.fitted=null,this.post={ao:!0,bloom:!0},this.size={w:1,h:1}}rendererName(){let t=this.renderer.getContext(),e=t.getExtension("WEBGL_debug_renderer_info");return e?t.getParameter(e.UNMASKED_RENDERER_WEBGL):t.getParameter(t.RENDERER)}setSize(t,e){this.size={w:t,h:e},this.renderer.setSize(t,e,!1),this.composer&&(this.composer.setSize(t,e),this.gtao&&this.gtao.setSize(t,e))}fitShadows(t,e){this.fitted={extent:t,top:e};let i=this.sun.shadow.camera,n=t.maxX-t.minX,r=t.maxZ-t.minZ,o=Math.hypot(n,r)/2+2;i.left=-o,i.right=o,i.top=o,i.bottom=-o,i.near=.5,i.far=o*4+20,i.updateProjectionMatrix(),this.centre=new D((t.minX+t.maxX)/2,e/2,(t.minZ+t.maxZ)/2),this.sun.target.position.copy(this.centre),this.moon.target=this.sun.target,this.applyTime()}setQuality(t,e){this.quality=t,this.renderer.shadowMap.enabled=t>=2,this.renderer.shadowMap.type=Sn,this.renderer.shadowMap.needsUpdate=!0,this.sun.castShadow=t>=2,this.sun.shadow.radius=t>=3?6:1,this.sun.shadow.blurSamples=12,this.sun.shadow.mapSize.set(t>=3?2048:1024,t>=3?2048:1024),this.sun.shadow.map&&(this.sun.shadow.map.dispose(),this.sun.shadow.map=null),this.scene.environment=t>=3?this.envTarget&&this.envTarget.texture:null,this.scene.background=null,this.renderer.toneMapping=t>=2?En:fi,this.buildComposer(e),this.applyTime()}buildComposer(t){if(this.composer&&(this.composer.dispose&&this.composer.dispose(),this.composer=null,this.gtao=null,this.bloom=null),this.quality<3)return;let{w:e,h:i}=this.size,n=new El(this.renderer);n.setPixelRatio(this.dpr),n.setSize(e,i);let r=new Tl(this.scene,t);if(r.clearAlpha=0,n.addPass(r),this.post.ao&&!this.post.lite){let o=new Ws(this.scene,t,e,i);o.output=Ws.OUTPUT.Default,o.updateGtaoMaterial({radius:.5,distanceExponent:1,thickness:1,distanceFallOff:1,scale:1.1,samples:8}),o.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:4,rings:2,samples:6}),o.blendIntensity=.8,n.addPass(o),this.gtao=o}if(this.post.bloom){let o=new Xs(new tt(e,i),.25+.45*(this.recipe?this.recipe.night:0),.5,2.4);n.addPass(o),this.bloom=o}n.addPass(new Rl),this.composer=n,this.camera=t}setCamera(t){if(this.camera=t,this.composer){for(let e of this.composer.passes)"camera"in e&&(e.camera=t);this.gtao&&(this.gtao.camera=t)}}setTime(t){Object.assign(this.time,t),this.applyTime()}applyTime(){let t=this.time,e=Yd(t.hour,t.day,t.latitude,t.north),i=Th(e.elevation,t.weather);this.recipe=i,this.sunInfo=e;let n=new D(e.dir[0],Math.max(e.dir[1],-.2),e.dir[2]).normalize(),r=this.centre||new D,o=this.fitted?Math.hypot(this.fitted.extent.maxX-this.fitted.extent.minX,this.fitted.extent.maxZ-this.fitted.extent.minZ):20;this.sun.position.copy(r).addScaledVector(n,o*1.5);let a=this.quality>=3,l=this.interior?.55:1;this.sun.intensity=this.quality>=2?i.sunIntensity*(a?.5:1):1.1,this.sun.color.setHex(Pl(i.sunColor)),this.sun.visible=e.elevation>-3||this.quality<2,this.moon.intensity=i.moon*.5,this.moon.position.copy(r).add(new D(-o,o*.9,o*.4)),this.hemi.color.setHex(Pl(i.hemiSky)),this.hemi.groundColor.setHex(Pl(i.hemiGround)),this.hemi.intensity=(this.quality>=2?i.hemiIntensity*(a?.25:1):1.2)*l,this.ambient.intensity=this.quality>=2?0:.9,this.renderer.toneMappingExposure=i.exposure*(a?.8:1)*(this.interior?.9:1),this.renderer.shadowMap.needsUpdate=!0,this.bloom&&(this.bloom.threshold=2.4,this.bloom.strength=.25+.45*i.night,this.bloom.radius=.5);for(let c of[this.sky,this.skyVisible]){let h=c.material.uniforms;h.turbidity.value=i.turbidity,h.rayleigh.value=i.rayleigh,h.mieCoefficient.value=i.mie,h.mieDirectionalG.value=.8,h.sunPosition.value.copy(n)}this.backdrop&&(this.backdrop.style.background=`linear-gradient(180deg, ${Il(i.skyTop)} 0%, ${Il(i.skyHorizon)} 70%, ${Il(i.hemiGround.map(c=>c*.9+.1))} 100%)`),this.paintDome(i,n),this.quality>=3&&(this.envTarget&&this.envTarget.dispose(),this.envTarget=this.pmrem.fromScene(this.domeScene,0,1,1e3),this.scene.environment=this.envTarget.texture,this.scene.environmentIntensity=(.25+i.day*.65)*l),this.onTime&&this.onTime(e,i)}paintDome(t,e){let i=this.dome.geometry,n=i.attributes.position,r=i.attributes.color,o=new D,a=t.hemiGround.map(l=>l*.9+.1);for(let l=0;l<n.count;l++){o.fromBufferAttribute(n,l).normalize();let c=o.y,h;if(c<0)h=a;else{let d=Math.pow(c,.55);h=[t.skyHorizon[0]+(t.skyTop[0]-t.skyHorizon[0])*d,t.skyHorizon[1]+(t.skyTop[1]-t.skyHorizon[1])*d,t.skyHorizon[2]+(t.skyTop[2]-t.skyHorizon[2])*d]}let f=Math.max(0,o.dot(e)),u=e.y>-.05?Math.pow(f,400)*.9+Math.pow(f,12)*.18*t.day:0;r.setXYZ(l,Math.min(1,h[0]+u*t.sunColor[0]),Math.min(1,h[1]+u*t.sunColor[1]),Math.min(1,h[2]+u*t.sunColor[2]))}r.needsUpdate=!0,this.dome.visible=this.quality>=2}render(t){this.composer&&this.quality>=3?(this.camera!==t&&this.setCamera(t),this.composer.render()):this.renderer.render(this.scene,t)}};var Dl=class{constructor(t){this.scene=t,this.x=0,this.z=0,this.yaw=0,this.pitch=0,this.level=Object.keys(t.levels)[0],this.eye=1.65,this.onStairs=null,this.path=null,this.input={fwd:0,strafe:0,run:!1,turn:0},this.onLevelChange=null,this.edge=!1,this.lastMoveTime=0}placeAt(t,e,i,n){this.x=t,this.z=e,this.yaw=i*Math.PI/180,this.pitch=0,n&&n!==this.level&&(this.level=n,this.onLevelChange&&this.onLevelChange(n)),this.path=null,this.onStairs=null}ground(t,e,i){let n=this.scene.levels[i];for(let r of n.stairs){let o=t-r.a[0],a=e-r.a[1],l=o*r.dx+a*r.dz;if(Math.abs(-o*r.dz+a*r.dx)<=r.width/2&&l>=-.05&&l<=r.run+.05){let h=Math.max(0,Math.min(1,l/r.run));return{y:r.elevFrom+(r.elevTo-r.elevFrom)*h,stair:r,along:l,f:h}}}return{y:n.elevation,stair:null}}segmentsFor(t,e="all"){let i=this.scene.levels[t],n=e==="stairs"?[]:i.segs.slice();for(let r of i.stairs){let o=-r.dz,a=r.dx;for(let l of[-1,1]){let c=o*l*(r.width/2),h=a*l*(r.width/2);n.push({a:[r.a[0]+c-r.dx*0,r.a[1]+h],b:[r.b[0]+c,r.b[1]+h],w:0,kind:"stair-side",id:"stair"})}}return n}collide(t,e,i,n="all"){let r=this.segmentsFor(i,n);for(let o=0;o<3;o++){let a=!1;for(let l of r){let c=.28+(l.w||0)/2,h=l.b[0]-l.a[0],f=l.b[1]-l.a[1],u=h*h+f*f,d=u>0?Math.max(0,Math.min(1,((t-l.a[0])*h+(e-l.a[1])*f)/u)):0,m=l.a[0]+d*h,_=l.a[1]+d*f,p=t-m,g=e-_,M=Math.hypot(p,g);if(M<c){if(M<1e-6){p=-f,g=h;let T=Math.hypot(p,g)||1;p/=T,g/=T}else p/=M,g/=M;t=m+p*(c+.001),e=_+g*(c+.001),a=!0}}if(!a)break}return[t,e]}step(t){let e=this.input,i=!1;e.turn&&(this.yaw+=e.turn*t*2.2,i=!0);let n=e.fwd,r=e.strafe;if(this.path&&this.path.length){let[o,a]=this.path[0],l=o-this.x,c=a-this.z;if(Math.hypot(l,c)<.15)this.path.shift(),this.path.length||(this.path=null);else{let u=Math.atan2(-l,-c)-this.yaw;for(;u>Math.PI;)u-=2*Math.PI;for(;u<-Math.PI;)u+=2*Math.PI;this.yaw+=Math.sign(u)*Math.min(Math.abs(u),t*3.5),n=Math.abs(u)<.6?1:.2,r=0}}if(n||r){let o=e.run?2.8:1.4,a=Math.sin(this.yaw),l=Math.cos(this.yaw),c=-a,h=-l,f=l,u=-a,d=this.x+(c*n+f*r)*o*t,m=this.z+(h*n+u*r)*o*t,_=this.ground(this.x,this.z,this.level).stair&&this.ground(d,m,this.level).stair;[d,m]=this.collide(d,m,this.level,_?"stairs":"all");let p=this.scene.levels[this.level];if(p.extent){let M=p.extent,T=Math.max(M.minX+.3,Math.min(M.maxX-.3,d)),y=Math.max(M.minZ+.3,Math.min(M.maxZ-.3,m));this.edge=T!==d||y!==m,d=T,m=y}(Math.abs(d-this.x)>1e-5||Math.abs(m-this.z)>1e-5)&&(i=!0),this.x=d,this.z=m;let g=this.ground(this.x,this.z,this.level);if(g.stair){this.onStairs=g.stair;let M=g.stair;g.along>M.run-.02&&this.level===M.from?this.switchLevel(M.to):g.along<.02&&this.level===M.to&&this.switchLevel(M.from)}else this.onStairs=null}return i}switchLevel(t){!this.scene.levels[t]||t===this.level||(this.level=t,this.onLevelChange&&this.onLevelChange(t))}eyeY(){return this.ground(this.x,this.z,this.level).y+this.eye}applyTo(t){t.position.set(this.x,this.eyeY(),this.z),t.rotation.order="YXZ",t.rotation.set(this.pitch,this.yaw,0)}look(t,e){this.yaw-=t,this.pitch=Math.max(-1.2,Math.min(1.2,this.pitch-e))}pathTo(t,e){let i=this.scene.levels[this.level];if(!i.extent)return null;let n=i.extent,r=Math.ceil((n.maxX-n.minX)/.25),o=Math.ceil((n.maxZ-n.minZ)/.25),a=this.segmentsFor(this.level),l=new Uint8Array(r*o),c=.28*.85;for(let w=0;w<o;w++)for(let P=0;P<r;P++){let I=n.minX+(P+.5)*.25,N=n.minZ+(w+.5)*.25;for(let B of a){let O=c+(B.w||0)/2,G=B.b[0]-B.a[0],V=B.b[1]-B.a[1],W=G*G+V*V,$=W>0?Math.max(0,Math.min(1,((I-B.a[0])*G+(N-B.a[1])*V)/W)):0;if(Math.hypot(I-(B.a[0]+$*G),N-(B.a[1]+$*V))<O){l[w*r+P]=1;break}}}let h=(w,P)=>[Math.max(0,Math.min(r-1,Math.floor((w-n.minX)/.25))),Math.max(0,Math.min(o-1,Math.floor((P-n.minZ)/.25)))],[f,u]=h(this.x,this.z),[d,m]=h(t,e);if(l[m*r+d]){let w=null;for(let P=-3;P<=3;P++)for(let I=-3;I<=3;I++){let N=d+I,B=m+P;if(N<0||B<0||N>=r||B>=o||l[B*r+N])continue;let O=I*I+P*P;(!w||O<w.d)&&(w={i:N,j:B,d:O})}if(!w)return null;d=w.i,m=w.j}let _=new Map,p=new Float32Array(r*o).fill(1/0),g=new Int32Array(r*o).fill(-1),M=(w,P)=>Math.hypot(w-d,P-m),T=u*r+f,y=m*r+d;p[T]=0,_.set(T,M(f,u));let b=new Uint8Array(r*o),E=0;for(;_.size&&E++<5e4;){let w=-1,P=1/0;for(let[B,O]of _)O<P&&(P=O,w=B);if(_.delete(w),w===y)break;b[w]=1;let I=w%r,N=Math.floor(w/r);for(let[B,O]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){let G=I+B,V=N+O;if(G<0||V<0||G>=r||V>=o)continue;let W=V*r+G;if(l[W]||b[W]||B&&O&&(l[N*r+G]||l[V*r+I]))continue;let $=p[w]+Math.hypot(B,O);$<p[W]&&(p[W]=$,g[W]=w,_.set(W,$+M(G,V)))}}if(g[y]<0&&y!==T)return null;let C=[],x=y;for(;x>=0&&x!==T;)C.push([n.minX+(x%r+.5)*.25,n.minZ+(Math.floor(x/r)+.5)*.25]),x=g[x];C.reverse(),C.push([t,e]);let A=[],L=[this.x,this.z],U=0;for(;U<C.length;){let w=U;for(let P=C.length-1;P>U;P--)if(this.lineFree(L,C[P],a)){w=P;break}A.push(C[w]),L=C[w],U=w+1}return this.path=A,A}lineFree(t,e,i){let n=[e[0]-t[0],e[1]-t[1]],r=Math.hypot(n[0],n[1]);if(r<1e-6)return!0;let o=Math.max(2,Math.ceil(r/.1));for(let a=0;a<=o;a++){let l=t[0]+n[0]*a/o,c=t[1]+n[1]*a/o;for(let h of i){let f=.22400000000000003+(h.w||0)/2,u=h.b[0]-h.a[0],d=h.b[1]-h.a[1],m=u*u+d*d,_=m>0?Math.max(0,Math.min(1,((l-h.a[0])*u+(c-h.a[1])*d)/m)):0;if(Math.hypot(l-(h.a[0]+_*u),c-(h.a[1]+_*d))<f)return!1}}return!0}};function Jd(s,t,e,i={}){let n=s.getContext("2d"),r=t.levels[e.level],o=s.width;if(n.clearRect(0,0,o,o),!r||!r.extent)return;let a=r.extent,l=a.maxX-a.minX,c=a.maxZ-a.minZ,h=(o-12)/Math.max(l,c),f=p=>6+(p-a.minX)*h+(o-12-l*h)/2,u=p=>6+(p-a.minZ)*h+(o-12-c*h)/2;n.fillStyle=i.bg||"rgba(255,255,255,0.92)",n.beginPath(),n.roundRect(0,0,o,o,10),n.fill();for(let p of r.zones){n.beginPath(),p.polyM.forEach(([M,T],y)=>y?n.lineTo(f(M),u(T)):n.moveTo(f(M),u(T))),n.closePath();let g=p.x_proto&&p.x_proto.light&&t.plan.entities[p.x_proto.light]==="on";n.fillStyle=g?"rgba(255,200,87,0.35)":"rgba(39,103,237,0.06)",n.fill()}n.lineWidth=2;for(let p of r.segs)n.strokeStyle=p.kind==="window"?"#7fb2ff":p.kind==="door"||p.kind==="door-locked"?"#ef4444":p.kind==="object"?"rgba(90,100,120,0.35)":p.kind==="railing"||p.kind==="low"?"#9aa3b5":"#56617a",n.lineWidth=p.kind==="object"?1:p.kind==="exterior"?3:2,n.beginPath(),n.moveTo(f(p.a[0]),u(p.a[1])),n.lineTo(f(p.b[0]),u(p.b[1])),n.stroke();for(let p of r.stairs){n.strokeStyle="#6b7f99",n.lineWidth=1;let g=8;for(let M=0;M<=g;M++){let T=M/g,y=p.a[0]+p.dx*p.run*T,b=p.a[1]+p.dz*p.run*T;n.beginPath(),n.moveTo(f(y-p.dz*p.width/2),u(b+p.dx*p.width/2)),n.lineTo(f(y+p.dz*p.width/2),u(b-p.dx*p.width/2)),n.stroke()}}if(e.path){n.strokeStyle="#22c55e",n.lineWidth=2,n.setLineDash([3,3]),n.beginPath(),n.moveTo(f(e.x),u(e.z));for(let[p,g]of e.path)n.lineTo(f(p),u(g));n.stroke(),n.setLineDash([])}let d=f(e.x),m=u(e.z),_=Math.atan2(-Math.sin(e.yaw),-Math.cos(e.yaw));return n.fillStyle="rgba(39,103,237,0.25)",n.beginPath(),n.moveTo(d,m),n.arc(d,m,22,_-.5,_+.5),n.closePath(),n.fill(),n.fillStyle="#2767ed",n.beginPath(),n.arc(d,m,4,0,Math.PI*2),n.fill(),n.strokeStyle="#fff",n.lineWidth=1.5,n.stroke(),{X:f,Z:u,k:h,ex:a,invert:(p,g)=>[a.minX+(p-6-(o-12-l*h)/2)/h,a.minZ+(g-6-(o-12-c*h)/2)/h]}}var Nl=class{constructor(t,e){this.env=t,this.scene=e,this.sets={}}snapshot(t,e,i){let n=this.env,r=n.size;n.setSize(e,i),t.isPerspectiveCamera&&(t.aspect=e/i),t.updateProjectionMatrix(),n.render(t);let o=this.compose(n.renderer.domElement,e,i);return n.setSize(r.w,r.h),o}compose(t,e,i){let n=document.createElement("canvas");n.width=e,n.height=i;let r=n.getContext("2d"),o=this.env.recipe,a=r.createLinearGradient(0,0,0,i),l=c=>`rgb(${Math.round(c[0]*255)}, ${Math.round(c[1]*255)}, ${Math.round(c[2]*255)})`;return a.addColorStop(0,l(o.skyTop)),a.addColorStop(.7,l(o.skyHorizon)),a.addColorStop(1,l(o.hemiGround.map(c=>c*.9+.1))),r.fillStyle=a,r.fillRect(0,0,e,i),r.drawImage(t,0,0,e,i),n.toDataURL("image/jpeg",.9)}thumbnail(t,e,i){let n=this.env,r=n.renderer;(!this._rt||this._rt.width!==e||this._rt.height!==i)&&(this._rt&&this._rt.dispose(),this._rt=new ve(e,i,{samples:0}));let o=r.getRenderTarget();r.setRenderTarget(this._rt),r.render(n.scene,t);let a=new Uint8Array(e*i*4);r.readRenderTargetPixels(this._rt,0,0,e,i,a),r.setRenderTarget(o);let l=document.createElement("canvas");l.width=e,l.height=i;let c=l.getContext("2d"),h=c.createImageData(e,i);for(let f=0;f<i;f++)h.data.set(a.subarray((i-1-f)*e*4,(i-f)*e*4),f*e*4);return c.putImageData(h,0,0),this.compose(l,e,i)}project(t,e,i,n){let r=e.clone().project(t);return[(r.x+1)/2*i,(1-r.y)/2*n]}async bake(t,e,i,n,r,o){let a=this.scene.levels[t],l={w:i,h:n,pics:{},masks:[],doors:[],cams:[]};for(let c of["day_off","day_on","night_off","night_on"])r(c),await new Promise(h=>requestAnimationFrame(h)),l.pics[c]=this.snapshot(e,i,n);e.aspect=i/n,e.updateProjectionMatrix(),e.updateMatrixWorld();for(let c of a.zones){let h=c.polyM.map(([u,d])=>this.project(e,new D(u,a.elevation+.02,d),i,n)),f=c.polyM.map(([u,d])=>this.project(e,new D(u,a.elevation+a.ceiling*.55,d),i,n));l.masks.push({zone:c.id,name:c.name,light:c.x_proto&&c.x_proto.light,presence:c.x_proto&&c.x_proto.presence,temp:c.x_proto&&c.x_proto.temp,floor:h,top:f,centre:this.project(e,new D(...ox(c.polyM,a.elevation+1.2)),i,n)})}for(let c of o||[]){let h=c.points.map(f=>this.project(e,f,i,n));l.doors.push({entity:c.entity,points:h})}for(let c of this.scene.cameras.filter(h=>h.level===t))l.cams.push({id:c.id,label:c.label,p:this.project(e,new D(c.pos[0],a.elevation+c.mount,c.pos[1]),i,n)});return this.sets[t]=l,l}};function ox(s,t){let e=0,i=0,n=0;for(let r=0;r<s.length;r++){let[o,a]=s[r],[l,c]=s[(r+1)%s.length],h=o*c-l*a;e+=h,i+=(o+l)*h,n+=(a+c)*h}return Math.abs(e)<1e-9?[s[0][0],t,s[0][1]]:[i/(3*e),t,n/(3*e)]}var Pn="http://www.w3.org/2000/svg";function Kd(s,t,e){if(s.innerHTML="",!t){s.innerHTML='<div class="stills-empty">\u05D0\u05D9\u05DF \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DE\u05D5\u05DB\u05E0\u05D5\u05EA \u05DC\u05E7\u05D5\u05DE\u05D4 \u05D6\u05D5 \u2014 \u05DC\u05D7\u05E5 "\u05D4\u05DB\u05DF \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA" \u05D1\u05DC\u05E9\u05D5\u05E0\u05D9\u05EA \u05D4\u05D0\u05D9\u05DB\u05D5\u05EA</div>';return}let i=e.night,n=t.pics[i?"night_off":"day_off"],r=t.pics[i?"night_on":"day_on"],o=document.createElementNS(Pn,"svg");o.setAttribute("viewBox",`0 0 ${t.w} ${t.h}`),o.setAttribute("preserveAspectRatio","xMidYMid meet"),o.classList.add("stills-svg");let a=document.createElementNS(Pn,"defs");o.appendChild(a);let l=u=>{let d=document.createElementNS(Pn,"image");return d.setAttribute("href",u),d.setAttribute("width",t.w),d.setAttribute("height",t.h),d.setAttribute("preserveAspectRatio","none"),d};o.appendChild(l(n));let c=u=>u.map(d=>`${d[0].toFixed(1)},${d[1].toFixed(1)}`).join(" "),h=u=>jd([...u.floor,...u.top]);for(let u of t.masks){if(!(u.light&&e.entities[u.light]==="on"))continue;let m=document.createElementNS(Pn,"clipPath");m.setAttribute("id",`mask-${u.zone}`);let _=document.createElementNS(Pn,"polygon");_.setAttribute("points",c(h(u))),m.appendChild(_),a.appendChild(m);let p=l(r);p.setAttribute("clip-path",`url(#mask-${u.zone})`),p.classList.add("stills-lit"),o.appendChild(p)}for(let u of t.masks)if(u.presence&&e.entities[u.presence]==="on"){let m=document.createElementNS(Pn,"polygon");m.setAttribute("points",c(u.floor)),m.setAttribute("class","stills-presence"),o.appendChild(m)}for(let u of t.doors){if(e.entities[u.entity]!=="on"&&e.entities[u.entity]!=="open")continue;let d=document.createElementNS(Pn,"polygon");d.setAttribute("points",c(jd(u.points))),d.setAttribute("class","stills-door"),o.appendChild(d)}for(let u of t.cams){let d=document.createElementNS(Pn,"circle");d.setAttribute("cx",u.p[0]),d.setAttribute("cy",u.p[1]),d.setAttribute("r",6),d.setAttribute("class","stills-cam"),o.appendChild(d)}s.appendChild(o);let f=document.createElement("div");f.className="stills-chips";for(let u of t.masks){if(typeof u.temp!="number")continue;let d=document.createElement("span");d.className="chipT",d.textContent=`${u.temp.toFixed(1)}\xB0`,d.style.left=`${u.centre[0]/t.w*100}%`,d.style.top=`${u.centre[1]/t.h*100}%`,f.appendChild(d)}s.appendChild(f),requestAnimationFrame(()=>{let u=s.getBoundingClientRect(),d=Math.min(u.width/t.w,u.height/t.h),m=t.w*d,_=t.h*d;f.style.width=`${m}px`,f.style.height=`${_}px`,f.style.left=`${(u.width-m)/2}px`,f.style.top=`${(u.height-_)/2}px`})}function jd(s){let t=s.slice().sort((r,o)=>r[0]-o[0]||r[1]-o[1]);if(t.length<3)return t;let e=(r,o,a)=>(o[0]-r[0])*(a[1]-r[1])-(o[1]-r[1])*(a[0]-r[0]),i=[];for(let r of t){for(;i.length>=2&&e(i[i.length-2],i[i.length-1],r)<=0;)i.pop();i.push(r)}let n=[];for(let r=t.length-1;r>=0;r--){let o=t[r];for(;n.length>=2&&e(n[n.length-2],n[n.length-1],o)<=0;)n.pop();n.push(o)}return n.pop(),i.pop(),i.concat(n)}var Qd=s=>s/.012,vi=(s,t)=>[+(Qd(s)/1e3).toFixed(6),+(Qd(t)/900).toFixed(6)];function ax(s,t){let e={t:0,d:1/0},i=0,n=0;for(let r=0;r<s.length-1;r++)n+=Math.hypot(s[r+1][0]-s[r][0],s[r+1][1]-s[r][1]);for(let r=0;r<s.length-1;r++){let[o,a]=s[r],l=s[r+1][0]-o,c=s[r+1][1]-a,h=l*l+c*c,f=h>0?Math.max(0,Math.min(1,((t[0]-o)*l+(t[1]-a)*c)/h)):0,u=Math.hypot(t[0]-(o+f*l),t[1]-(a+f*c));u<e.d&&(e={t:(i+f*Math.sqrt(h))/n,d:u}),i+=Math.sqrt(h)}return+e.t.toFixed(5)}var tf=[{id:"g-out",level:"L0",kind:"exterior",t:.3,pts:[[.5,.5],[11.5,.5],[11.5,10.3],[.5,10.3],[.5,.5]]},{id:"g-w1",level:"L0",kind:"interior",t:.12,pts:[[3.5,.5],[3.5,10.3]]},{id:"g-w2",level:"L0",kind:"interior",t:.12,pts:[[.5,3.5],[3.5,3.5]]},{id:"g-w3",level:"L0",kind:"railing",t:.05,h:1,pts:[[2,3.9],[2,7.5]]},{id:"g-w5",level:"L0",kind:"interior",t:.12,pts:[[3.5,6],[11.5,6]]},{id:"g-w6",level:"L0",kind:"interior",t:.12,pts:[[7.5,6],[7.5,10.3]]},{id:"g-w7",level:"L0",kind:"interior",t:.12,pts:[[.5,7.5],[3.5,7.5]]},{id:"g-w8",level:"L0",kind:"interior",t:.1,pts:[[2,7.5],[2,10.3]]},{id:"u-out",level:"L1",kind:"exterior",t:.3,pts:[[.5,.5],[11.5,.5],[11.5,7.5],[.5,7.5],[.5,.5]]},{id:"u-w1",level:"L1",kind:"interior",t:.12,pts:[[3.5,.5],[3.5,7.5]]},{id:"u-w2",level:"L1",kind:"interior",t:.12,pts:[[3.5,4],[11.5,4]]},{id:"u-w3",level:"L1",kind:"interior",t:.12,pts:[[8,.5],[8,4]]},{id:"u-w4",level:"L1",kind:"interior",t:.12,pts:[[3.5,5.2],[11.5,5.2]]},{id:"u-w5",level:"L1",kind:"interior",t:.12,pts:[[6.5,5.2],[6.5,7.5]]},{id:"u-rail",level:"L1",kind:"railing",t:.05,h:1,pts:[[2,3.9],[2,7.2],[.5,7.2]]}],lx=[["front","g-out",[.5,2.2],"door",1,2.1,0,"right","end","binary_sensor.front_door"],["win-hall","g-out",[.5,1.2],"window",.8,1.2,.9],["win-liv-n1","g-out",[5.5,.5],"window",1.4,1.4,.9],["win-liv-n2","g-out",[7.5,.5],"window",1.4,1.4,.9],["win-liv-n3","g-out",[9.5,.5],"window",1.4,1.4,.9],["win-liv-e","g-out",[11.5,3.2],"window",2.6,2.3,.1,"none","start",null,"cover.living_terrace"],["win-kit-e","g-out",[11.5,8.2],"window",1.2,1.2,1],["win-kit-s","g-out",[9.5,10.3],"window",1.4,1.2,1],["win-off-s","g-out",[5.5,10.3],"window",1.6,1.4,.9,"none","start",null,"cover.office"],["win-wc-w","g-out",[.5,9],"window",.6,.6,1.5],["d-hall-liv","g-w1",[3.5,2],"door",1.6,2.1,0,"double","start","binary_sensor.hall_living_door"],["d-corr-liv","g-w1",[3.5,4.8],"door",.9,2.1,0,"left","start",null],["d-corr-off","g-w1",[3.5,6.9],"door",.9,2.1,0,"right","end","binary_sensor.office_door"],["p-hall-corr","g-w2",[2.7,3.5],"passage",1.4,2.1,0],["d-liv-off","g-w5",[5.5,6],"door",.9,2.1,0,"right","start",null],["d-liv-kit","g-w5",[9.5,6],"door",1.8,2.1,0,"sliding","start","binary_sensor.kitchen_door"],["d-off-kit","g-w6",[7.5,8.2],"door",.8,2.1,0,"left","end",null],["d-wc","g-w7",[1.25,7.5],"door",.8,2.1,0,"right","end","binary_sensor.wc_door"],["d-util","g-w7",[2.75,7.5],"door",.8,2.1,0,"left","start",null],["uw-n1","u-out",[5.7,.5],"window",1.4,1.4,.9,"none","start",null,"cover.bedroom1"],["uw-n2","u-out",[9.7,.5],"window",1.4,1.4,.9,"none","start",null,"cover.bedroom2"],["uw-e1","u-out",[11.5,2.2],"window",1.2,1.4,.9],["uw-e2","u-out",[11.5,6.3],"window",1.2,1.4,.9],["uw-s1","u-out",[5,7.5],"window",.8,.8,1.5],["uw-s2","u-out",[9,7.5],"window",1.6,1.4,.9,"none","start",null,"cover.bedroom3"],["uw-w1","u-out",[.5,1.8],"window",1.2,1.4,.9],["up-hall","u-w1",[3.5,4.6],"passage",1.2,2.1,0],["ud-bed1","u-w2",[5.5,4],"door",.9,2.1,0,"left","start","binary_sensor.bedroom1_door"],["ud-bed2","u-w2",[9.5,4],"door",.9,2.1,0,"right","end",null],["ud-bath","u-w4",[4.6,5.2],"door",.8,2.1,0,"right","start","binary_sensor.bath_door"],["ud-bed3","u-w4",[8.8,5.2],"door",.9,2.1,0,"left","end",null]],ef=[{id:"r-hall",level:"L0",name:"\u05DB\u05E0\u05D9\u05E1\u05D4",poly:[[.5,.5],[3.5,.5],[3.5,3.5],[.5,3.5]],floor:"tiles_grey",light:"light.hall",temp:23.4},{id:"r-stair",level:"L0",name:"\u05D7\u05D3\u05E8 \u05DE\u05D3\u05E8\u05D2\u05D5\u05EA",poly:[[.5,3.5],[2,3.5],[2,7.5],[.5,7.5]],floor:"tiles_grey",light:"light.stairs",temp:23},{id:"r-corr",level:"L0",name:"\u05DE\u05E1\u05D3\u05E8\u05D5\u05DF",poly:[[2,3.5],[3.5,3.5],[3.5,7.5],[2,7.5]],floor:"tiles_grey",light:"light.corridor",temp:23.1},{id:"r-living",level:"L0",name:"\u05E1\u05DC\u05D5\u05DF",poly:[[3.5,.5],[11.5,.5],[11.5,6],[3.5,6]],floor:"oak",light:"light.living",temp:24.2,presence:"binary_sensor.motion_living"},{id:"r-kitchen",level:"L0",name:"\u05DE\u05D8\u05D1\u05D7",poly:[[7.5,6],[11.5,6],[11.5,10.3],[7.5,10.3]],floor:"tiles_white",light:"light.kitchen",temp:25.1},{id:"r-office",level:"L0",name:"\u05D7\u05D3\u05E8 \u05E2\u05D1\u05D5\u05D3\u05D4",poly:[[3.5,6],[7.5,6],[7.5,10.3],[3.5,10.3]],floor:"oak",light:"light.office",temp:23.8,presence:"binary_sensor.motion_office"},{id:"r-wc",level:"L0",name:"\u05E9\u05D9\u05E8\u05D5\u05EA\u05D9\u05DD",poly:[[.5,7.5],[2,7.5],[2,10.3],[.5,10.3]],floor:"tiles_white",light:"light.wc",temp:22.5},{id:"r-util",level:"L0",name:"\u05D7\u05D3\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA",poly:[[2,7.5],[3.5,7.5],[3.5,10.3],[2,10.3]],floor:"concrete",light:"light.utility",temp:22},{id:"r-uhall",level:"L1",name:"\u05D2\u05DC\u05E8\u05D9\u05D4",poly:[[.5,.5],[3.5,.5],[3.5,7.5],[2,7.5],[2,3.9],[.5,3.9]],floor:"oak",light:"light.gallery",temp:23.6},{id:"r-ucorr",level:"L1",name:"\u05DE\u05E1\u05D3\u05E8\u05D5\u05DF \u05E2\u05DC\u05D9\u05D5\u05DF",poly:[[3.5,4],[11.5,4],[11.5,5.2],[3.5,5.2]],floor:"oak",light:"light.upper_corridor",temp:23.5,presence:"binary_sensor.motion_upper"},{id:"r-bed1",level:"L1",name:"\u05D7\u05D3\u05E8 \u05E9\u05D9\u05E0\u05D4 \u05D4\u05D5\u05E8\u05D9\u05DD",poly:[[3.5,.5],[8,.5],[8,4],[3.5,4]],floor:"carpet",light:"light.bedroom1",temp:22.8},{id:"r-bed2",level:"L1",name:"\u05D7\u05D3\u05E8 \u05D9\u05DC\u05D3\u05D9\u05DD",poly:[[8,.5],[11.5,.5],[11.5,4],[8,4]],floor:"carpet",light:"light.bedroom2",temp:23.2},{id:"r-bath",level:"L1",name:"\u05D0\u05DE\u05D1\u05D8\u05D9\u05D4",poly:[[3.5,5.2],[6.5,5.2],[6.5,7.5],[3.5,7.5]],floor:"tiles_white",light:"light.bath",temp:24.5},{id:"r-bed3",level:"L1",name:"\u05D7\u05D3\u05E8 \u05D0\u05D5\u05E8\u05D7\u05D9\u05DD",poly:[[6.5,5.2],[11.5,5.2],[11.5,7.5],[6.5,7.5]],floor:"carpet",light:"light.bedroom3",temp:22.9}],cx=[["sofa","sofa.3seat","L0",[6.3,3.9],180,[2.3,.95,.85],0,"\u05E1\u05E4\u05D4"],["coffee","table.coffee","L0",[6.3,2.6],0,[1.1,.6,.42],0,null],["tv","cabinet.tv","L0",[6.3,.95],0,[1.8,.45,.55],0,"\u05DE\u05D6\u05E0\u05D5\u05DF \u05D8\u05DC\u05D5\u05D5\u05D9\u05D6\u05D9\u05D4"],["tvscreen","screen.tv","L0",[6.3,.78],0,[1.4,.06,.8],.9,null,"media_player.living_tv"],["dining","table.dining","L0",[9.6,3.2],0,[1.6,.9,.75],0,"\u05E9\u05D5\u05DC\u05D7\u05DF \u05D0\u05D5\u05DB\u05DC"],["dc1","chair.basic","L0",[9.1,2.5],0,[.45,.45,.9],0,null],["dc2","chair.basic","L0",[10.1,2.5],0,[.45,.45,.9],0,null],["dc3","chair.basic","L0",[9.1,3.9],180,[.45,.45,.9],0,null],["dc4","chair.basic","L0",[10.1,3.9],180,[.45,.45,.9],0,null],["plant1","plant.pot","L0",[4,5.5],0,[.5,.5,1.4],0,null],["rug","mat.rug","L0",[6.3,3.2],0,[3,2.2,.02],0,null],["lamp-liv-a","light.ceiling","L0",[6.3,2.6],0,[.5,.5,.12],2.68,null,"light.living"],["lamp-liv-b","light.ceiling","L0",[9.6,3.2],0,[.5,.5,.12],2.68,null,"light.living"],["lamp-floor","light.floor","L0",[4.1,1],0,[.35,.35,1.5],0,null,"light.living_floor"],["console","cabinet.low","L0",[2,.85],0,[1.2,.4,.8],0,"\u05E9\u05D9\u05D3\u05D4"],["lamp-hall","light.ceiling","L0",[2,2],0,[.4,.4,.1],2.7,null,"light.hall"],["lamp-corr","light.ceiling","L0",[2.75,5.5],0,[.3,.3,.1],2.7,null,"light.corridor"],["lamp-stair","light.wall","L0",[.62,5.5],90,[.18,.1,.25],2,null,"light.stairs"],["counter-a","kitchen.counter","L0",[11.2,8],0,[.6,3.6,.9],0,"\u05DE\u05E9\u05D8\u05D7 \u05E2\u05D1\u05D5\u05D3\u05D4"],["counter-b","kitchen.counter","L0",[9.4,9.95],0,[3,.6,.9],0,null],["fridge","kitchen.fridge","L0",[7.95,9.9],0,[.75,.7,1.9],0,"\u05DE\u05E7\u05E8\u05E8"],["island","kitchen.island","L0",[9.3,7.6],0,[1.6,.9,.92],0,"\u05D0\u05D9"],["lamp-kit","light.pendant","L0",[9.3,7.6],0,[.3,.3,.35],2,null,"light.kitchen"],["desk","table.desk","L0",[5.5,9.4],0,[1.6,.8,.75],0,"\u05E9\u05D5\u05DC\u05D7\u05DF \u05E2\u05D1\u05D5\u05D3\u05D4"],["dchair","chair.office","L0",[5.5,8.6],180,[.6,.6,1.1],0,null],["books","cabinet.bookcase","L0",[3.75,8],90,[1.8,.35,2.1],0,"\u05E1\u05E4\u05E8\u05D9\u05D9\u05D4"],["lamp-off","light.ceiling","L0",[5.5,8],0,[.4,.4,.1],2.7,null,"light.office"],["toilet","sanitary.wc","L0",[1.25,9.9],0,[.4,.65,.45],0,null],["basin","sanitary.basin","L0",[.75,8.2],0,[.45,.4,.85],0,null],["washer","appliance.washer","L0",[3.1,9.9],0,[.6,.6,.85],0,"\u05DE\u05DB\u05D5\u05E0\u05EA \u05DB\u05D1\u05D9\u05E1\u05D4"],["boiler","appliance.boiler","L0",[2.4,9.9],0,[.5,.5,1.2],0,null],["lamp-wc","light.ceiling","L0",[1.25,8.9],0,[.25,.25,.1],2.7,null,"light.wc"],["lamp-util","light.ceiling","L0",[2.75,8.9],0,[.25,.25,.1],2.7,null,"light.utility"],["ext1","extinguisher.co2","L0",[3.3,7.3],0,[.18,.18,.55],.9,"\u05DE\u05D8\u05E3"],["bed1","bed.double","L1",[5.75,1.6],0,[1.8,2.1,.55],0,"\u05DE\u05D9\u05D8\u05D4 \u05D6\u05D5\u05D2\u05D9\u05EA"],["ward1","cabinet.wardrobe","L1",[3.9,2.8],90,[2,.6,2.3],0,"\u05D0\u05E8\u05D5\u05DF"],["lamp-bed1","light.ceiling","L1",[5.75,2.3],0,[.4,.4,.1],2.5,null,"light.bedroom1"],["bed2","bed.single","L1",[10.7,1.6],0,[1,2,.5],0,"\u05DE\u05D9\u05D8\u05D4"],["desk2","table.desk","L1",[8.9,1],0,[1.2,.6,.75],0,null],["lamp-bed2","light.ceiling","L1",[9.75,2.3],0,[.4,.4,.1],2.5,null,"light.bedroom2"],["bed3","bed.double","L1",[9,6.4],180,[1.6,2,.55],0,null],["lamp-bed3","light.ceiling","L1",[9,6.3],0,[.4,.4,.1],2.5,null,"light.bedroom3"],["tub","sanitary.tub","L1",[4.4,7],0,[1.7,.75,.55],0,"\u05D0\u05DE\u05D1\u05D8\u05D9\u05D4"],["basin2","sanitary.basin","L1",[6.1,5.6],0,[.5,.4,.85],0,null],["toilet2","sanitary.wc","L1",[6.1,6.9],90,[.4,.65,.45],0,null],["lamp-bath","light.ceiling","L1",[5,6.3],0,[.3,.3,.1],2.5,null,"light.bath"],["lamp-uhall","light.ceiling","L1",[2,2.2],0,[.45,.45,.1],2.5,null,"light.gallery"],["lamp-ucorr","light.ceiling","L1",[7.5,4.6],0,[.3,.3,.1],2.5,null,"light.upper_corridor"],["plant2","plant.pot","L1",[3,1],0,[.45,.45,1.1],0,null],["bench","cabinet.low","L1",[1.2,1],0,[1.2,.4,.5],0,null]],hx=[{id:"cam-hall",level:"L0",p:[3.3,.7],rot:215,fov:95,r:7,mount:2.4,tilt:22,label:"\u05DE\u05E6\u05DC\u05DE\u05D4 \xB7 \u05DB\u05E0\u05D9\u05E1\u05D4",online:!0},{id:"cam-living",level:"L0",p:[11.3,5.8],rot:318,fov:100,r:10,mount:2.5,tilt:20,label:"\u05DE\u05E6\u05DC\u05DE\u05D4 \xB7 \u05E1\u05DC\u05D5\u05DF",online:!0},{id:"cam-upper",level:"L1",p:[11.3,4.3],rot:265,fov:90,r:9,mount:2.3,tilt:18,label:"\u05DE\u05E6\u05DC\u05DE\u05D4 \xB7 \u05DE\u05E1\u05D3\u05E8\u05D5\u05DF \u05E2\u05DC\u05D9\u05D5\u05DF",online:!1}],ux=[{id:"wp-front",name:"\u05D3\u05DC\u05EA \u05DB\u05E0\u05D9\u05E1\u05D4",level:"L0",p:[1.3,2.2],heading:90,is_default:!0},{id:"wp-living",name:"\u05DE\u05E8\u05DB\u05D6 \u05D4\u05E1\u05DC\u05D5\u05DF",level:"L0",p:[7,3.3],heading:0},{id:"wp-kitchen",name:"\u05DE\u05D8\u05D1\u05D7",level:"L0",p:[9,8.8],heading:300},{id:"wp-gallery",name:"\u05D2\u05DC\u05E8\u05D9\u05D4",level:"L1",p:[2.7,2],heading:180}];function dx(){let s=tf.map(r=>({id:r.id,level_id:r.level,polyline:r.pts.map(o=>vi(o[0],o[1])),thickness_m:r.t,height_m:r.h??null,base_z_m:0,kind:r.kind,confidence:1,source:"manual",locked:!1,external_ids:{}})),t=new Map(tf.map(r=>[r.id,r.pts])),e=lx.map(([r,o,a,l,c,h,f,u,d,m,_])=>({id:r,wall_id:o,t:ax(t.get(o),a),kind:l,width_m:c,height_m:h,sill_m:f,swing:u||"none",hinge:d||"start",anchor_ref:m?{resource_type:"ha_entity",resource_id:m}:null,confidence:1,source:"manual",external_ids:{},..._?{x_proto:{cover_entity:_,glazing:r==="uw-s1"||r==="win-wc-w"?"frosted":"clear"}}:{}})),i=cx.map(([r,o,a,l,c,h,f,u,d])=>({id:r,item_id:o,level_id:a,position:vi(l[0],l[1]),rotation_deg:c,size:{w_m:h[0],d_m:h[1],h_m:h[2]},z_m:f,params:{},label:u??null,anchor_ref:d?{resource_type:"ha_entity",resource_id:d}:null,group_id:null,confidence:1,source:"manual",locked:!1,external_ids:{}})),n=ef.map(r=>({id:r.id,level_id:r.level,ceiling_height_m:null,tags:[],x_proto:{floor_material:r.floor}}));return{schema_version:"2.0",plan_version_id:"proto-house-v1",floor_id:"proto-house",source:{sha256:"0".repeat(64),file_name:"proto-house.pdf",mime:"application/pdf",page:1},dimensions:{width_px:1e3,height_px:900,scale_m_per_px:.012,calibration:{status:"measured",method:"two_point",pairs:[{a:vi(.5,.5),b:vi(11.5,.5),metres:11}],residual_pct:0,reason:null}},transform:{rotation:0,crop:null},levels:[{id:"L0",name:"\u05E7\u05E8\u05E7\u05E2",elevation_m:0,ceiling_height_m:2.8,is_default:!0,external_ids:{}},{id:"L1",name:"\u05E7\u05D5\u05DE\u05D4 1",elevation_m:2.9,ceiling_height_m:2.6,is_default:!1,external_ids:{}}],walls:s,openings:e,rooms:n,objects:i,circuits:[{id:"k-living",name:"\u05E1\u05DC\u05D5\u05DF",switch_entity_id:"light.living",member_ids:["lamp-liv-a","lamp-liv-b"],color_token:"circuit-1",power_w:48}],connectors:[{id:"stairs-main",kind:"stairs",level_from:"L0",level_to:"L1",floor_ids:[],polyline:[vi(1.25,7.2),vi(1.25,3.9)],width_m:1,label:null,object_id:null,source:"manual",external_ids:{},shape:"straight",turn:"none",flights:[{steps:16}],landing_depth_m:null}],labels:[],groups:[],uncertain_regions:[],uncertainty:{overall:0,notes:[]},meta:{generator:"studio6-prototype",tokens_version:"map-1",detector_version:null},floor_height_m:2.9,x_proto:{north_deg:12,latitude:32.08,longitude:34.78,walk_positions:ux.map(r=>({id:r.id,name:r.name,level_id:r.level,x:vi(r.p[0],r.p[1])[0],y:vi(r.p[0],r.p[1])[1],heading_deg:r.heading,is_default:!!r.is_default}))}}}var nf={id:"demo-house",title:"\u05D1\u05D9\u05EA \u05D3\u05D5\u05BE\u05E7\u05D5\u05DE\u05EA\u05D9 (\u05D3\u05DE\u05D5)",doc:dx(),zones:ef.map(s=>({id:s.id,name:s.name,level_id:s.level,polygon:s.poly.map(t=>({x:vi(t[0],t[1])[0],y:vi(t[0],t[1])[1]})),x_proto:{floor_material:s.floor,light:s.light,temp:s.temp,presence:s.presence||null}})),anchors:hx.map(s=>({id:s.id,resource_type:"camera",resource_id:s.id,x:vi(s.p[0],s.p[1])[0],y:vi(s.p[0],s.p[1])[1],rotation:s.rot,fov:s.fov,radius:s.r/12,polygon:null,level_id:s.level,layer_id:"cameras",label:s.label,state:null,online:s.online,mount_height_m:s.mount,tilt_deg:s.tilt})),entities:{"light.hall":"off","light.stairs":"off","light.corridor":"off","light.living":"on","light.living_floor":"on","light.kitchen":"on","light.office":"off","light.wc":"off","light.utility":"off","light.gallery":"off","light.upper_corridor":"off","light.bedroom1":"off","light.bedroom2":"on","light.bedroom3":"off","light.bath":"off","binary_sensor.front_door":"off","binary_sensor.hall_living_door":"on","binary_sensor.office_door":"off","binary_sensor.kitchen_door":"on","binary_sensor.wc_door":"off","binary_sensor.bedroom1_door":"off","binary_sensor.bath_door":"off","lock.front_door":"locked","cover.living_terrace":"open","cover.office":"closed","cover.bedroom1":"open","cover.bedroom2":"open","cover.bedroom3":"closed","binary_sensor.motion_living":"on","binary_sensor.motion_office":"off","binary_sensor.motion_upper":"off","media_player.living_tv":"playing"},coverPositions:{"cover.living_terrace":100,"cover.office":0,"cover.bedroom1":100,"cover.bedroom2":70,"cover.bedroom3":0},entityNames:{"light.hall":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05DB\u05E0\u05D9\u05E1\u05D4","light.stairs":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05DE\u05D3\u05E8\u05D2\u05D5\u05EA","light.corridor":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05DE\u05E1\u05D3\u05E8\u05D5\u05DF","light.living":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05E1\u05DC\u05D5\u05DF","light.living_floor":"\u05DE\u05E0\u05D5\u05E8\u05EA \u05E8\u05E6\u05E4\u05D4","light.kitchen":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05DE\u05D8\u05D1\u05D7","light.office":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D7\u05D3\u05E8 \u05E2\u05D1\u05D5\u05D3\u05D4","light.wc":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05E9\u05D9\u05E8\u05D5\u05EA\u05D9\u05DD","light.utility":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D7\u05D3\u05E8 \u05E9\u05D9\u05E8\u05D5\u05EA","light.gallery":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D2\u05DC\u05E8\u05D9\u05D4","light.upper_corridor":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05DE\u05E1\u05D3\u05E8\u05D5\u05DF \u05E2\u05DC\u05D9\u05D5\u05DF","light.bedroom1":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D7\u05D3\u05E8 \u05D4\u05D5\u05E8\u05D9\u05DD","light.bedroom2":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D7\u05D3\u05E8 \u05D9\u05DC\u05D3\u05D9\u05DD","light.bedroom3":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D7\u05D3\u05E8 \u05D0\u05D5\u05E8\u05D7\u05D9\u05DD","light.bath":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05D0\u05DE\u05D1\u05D8\u05D9\u05D4","binary_sensor.front_door":"\u05D3\u05DC\u05EA \u05DB\u05E0\u05D9\u05E1\u05D4","binary_sensor.hall_living_door":"\u05D3\u05DC\u05EA \u05E1\u05DC\u05D5\u05DF","binary_sensor.office_door":"\u05D3\u05DC\u05EA \u05D7\u05D3\u05E8 \u05E2\u05D1\u05D5\u05D3\u05D4","binary_sensor.kitchen_door":"\u05D3\u05DC\u05EA \u05D4\u05D6\u05D6\u05D4 \u05DC\u05DE\u05D8\u05D1\u05D7","binary_sensor.wc_door":"\u05D3\u05DC\u05EA \u05E9\u05D9\u05E8\u05D5\u05EA\u05D9\u05DD","binary_sensor.bedroom1_door":"\u05D3\u05DC\u05EA \u05D7\u05D3\u05E8 \u05D4\u05D5\u05E8\u05D9\u05DD","binary_sensor.bath_door":"\u05D3\u05DC\u05EA \u05D0\u05DE\u05D1\u05D8\u05D9\u05D4","lock.front_door":"\u05DE\u05E0\u05E2\u05D5\u05DC \u05DB\u05E0\u05D9\u05E1\u05D4","cover.living_terrace":"\u05EA\u05E8\u05D9\u05E1 \u05DE\u05E8\u05E4\u05E1\u05EA","cover.office":"\u05EA\u05E8\u05D9\u05E1 \u05D7\u05D3\u05E8 \u05E2\u05D1\u05D5\u05D3\u05D4","cover.bedroom1":"\u05EA\u05E8\u05D9\u05E1 \u05D7\u05D3\u05E8 \u05D4\u05D5\u05E8\u05D9\u05DD","cover.bedroom2":"\u05EA\u05E8\u05D9\u05E1 \u05D7\u05D3\u05E8 \u05D9\u05DC\u05D3\u05D9\u05DD","cover.bedroom3":"\u05EA\u05E8\u05D9\u05E1 \u05D7\u05D3\u05E8 \u05D0\u05D5\u05E8\u05D7\u05D9\u05DD","binary_sensor.motion_living":"\u05EA\u05E0\u05D5\u05E2\u05D4 \u05D1\u05E1\u05DC\u05D5\u05DF","binary_sensor.motion_office":"\u05EA\u05E0\u05D5\u05E2\u05D4 \u05D1\u05D7\u05D3\u05E8 \u05E2\u05D1\u05D5\u05D3\u05D4","binary_sensor.motion_upper":"\u05EA\u05E0\u05D5\u05E2\u05D4 \u05DC\u05DE\u05E2\u05DC\u05D4","media_player.living_tv":"\u05D8\u05DC\u05D5\u05D5\u05D9\u05D6\u05D9\u05D4"},doorLocks:{front:"lock.front_door"}};var sf={schema_version:"2.0",plan_version_id:"sample",floor_id:"sample-floor",source:{sha256:"0000000000000000000000000000000000000000000000000000000000000000",file_name:"sample.pdf",mime:"application/pdf",page:1},dimensions:{width_px:1e3,height_px:800,scale_m_per_px:.01,calibration:{status:"measured",method:"two_point",pairs:[{a:[.1,.1],b:[.9,.1],metres:8}],residual_pct:0,reason:null}},transform:{rotation:0,crop:null},levels:[{id:"L0",name:"\u05DE\u05E4\u05DC\u05E1 \u05E8\u05D0\u05E9\u05D9",elevation_m:0,ceiling_height_m:3,is_default:!0,external_ids:{}},{id:"L1",name:"\u05D0\u05D5\u05DC\u05DD \u05EA\u05D7\u05EA\u05D5\u05DF",elevation_m:-1.2,ceiling_height_m:6,is_default:!1,external_ids:{}}],walls:[{id:"wc",level_id:"L0",polyline:[[.6,.1],[.6,.5]],thickness_m:.1,height_m:2.4,base_z_m:0,kind:"partition",confidence:.8,source:"auto",locked:!1,external_ids:{}},{id:"wa",level_id:"L0",polyline:[[.1,.1],[.9,.1],[.9,.6]],thickness_m:.3,height_m:null,base_z_m:0,kind:"exterior",confidence:1,source:"manual",locked:!1,external_ids:{}},{id:"wd",level_id:"L1",polyline:[[.1,.7],[.4,.7]],thickness_m:.2,height_m:null,base_z_m:0,kind:"interior",confidence:1,source:"manual",locked:!1,external_ids:{}},{id:"wb",level_id:"L0",polyline:[[.1,.5],[.6,.5]],thickness_m:.15,height_m:null,base_z_m:0,kind:"interior",confidence:1,source:"manual",locked:!1,external_ids:{}}],openings:[{id:"oe",wall_id:"wb",t:.9,kind:"passage",width_m:1,height_m:2.1,sill_m:0,swing:"none",hinge:"start",anchor_ref:null,confidence:1,source:"manual",external_ids:{}},{id:"ob",wall_id:"wa",t:.75,kind:"window",width_m:1.2,height_m:1.2,sill_m:.9,swing:"none",hinge:"start",anchor_ref:null,confidence:1,source:"manual",external_ids:{}},{id:"of",wall_id:"wd",t:.5,kind:"door",width_m:1,height_m:2.1,sill_m:0,swing:"sliding",hinge:"start",anchor_ref:null,confidence:1,source:"manual",external_ids:{}},{id:"oa",wall_id:"wa",t:.2,kind:"door",width_m:.9,height_m:2.1,sill_m:0,swing:"right",hinge:"start",anchor_ref:null,confidence:1,source:"manual",external_ids:{}},{id:"od",wall_id:"wc",t:.5,kind:"door",width_m:1.6,height_m:2.1,sill_m:0,swing:"double",hinge:"start",anchor_ref:null,confidence:1,source:"manual",external_ids:{}},{id:"oc",wall_id:"wb",t:.5,kind:"door",width_m:.8,height_m:2.1,sill_m:0,swing:"left",hinge:"end",anchor_ref:{resource_type:"ha_entity",resource_id:"lock.store"},confidence:1,source:"manual",external_ids:{}}],rooms:[],objects:[{id:"o1",item_id:"chair.basic",level_id:"L0",position:[.2,.2],rotation_deg:0,size:{w_m:.45,d_m:.45,h_m:.85},z_m:0,params:{},label:null,anchor_ref:null,group_id:"g1",confidence:1,source:"manual",locked:!1,external_ids:{}},{id:"o2",item_id:"table.desk",level_id:"L0",position:[.3,.4],rotation_deg:90,size:{w_m:1.4,d_m:.7,h_m:.75},z_m:0,params:{},label:"\u05E9\u05D5\u05DC\u05D7\u05DF",anchor_ref:null,group_id:"g1",confidence:1,source:"manual",locked:!1,external_ids:{}},{id:"o3",item_id:"light.ceiling",level_id:"L0",position:[.5,.3],rotation_deg:0,size:{w_m:.4,d_m:.4,h_m:.1},z_m:2.7,params:{},label:null,anchor_ref:{resource_type:"ha_entity",resource_id:"light.store"},group_id:null,confidence:1,source:"manual",locked:!1,external_ids:{}},{id:"o4",item_id:"tribune.stepped",level_id:"L0",position:[.25,.6],rotation_deg:180,size:{w_m:4,d_m:3,h_m:1.2},z_m:0,params:{rows:4,step_height_m:.3,step_width_m:1,connects_levels:"L1"},label:null,anchor_ref:null,group_id:null,confidence:1,source:"manual",locked:!1,external_ids:{}},{id:"o5",item_id:"extinguisher.co2",level_id:"L1",position:[.15,.8],rotation_deg:0,size:{w_m:.2,d_m:.2,h_m:.6},z_m:.9,params:{},label:"\u05DE\u05D8\u05E3",anchor_ref:null,group_id:null,confidence:1,source:"manual",locked:!1,external_ids:{}}],circuits:[{id:"k1",name:"\u05DE\u05E2\u05D2\u05DC \u05D0\u05D5\u05DC\u05DD",switch_entity_id:"switch.hall_a",member_ids:["o3"],color_token:"circuit-1",power_w:36}],connectors:[{id:"c1",kind:"stairs",level_from:"L0",level_to:"L1",floor_ids:[],polyline:[[.7,.7],[.8,.7]],width_m:1.2,label:null,object_id:null,source:"manual",external_ids:{}},{id:"cx-o4",kind:"tribune",level_from:"L0",level_to:"L1",floor_ids:[],polyline:[[.25,.4125],[.25,.7875]],width_m:4,label:null,object_id:"o4",source:"auto",external_ids:{}}],labels:[{id:"lb",text:"\u05D0\u05D5\u05DC\u05DD",position:[.25,.75],level_id:"L1",size:16},{id:"la",text:"\u05DE\u05D7\u05E1\u05DF",position:[.3,.3],level_id:"L0",size:16}],groups:[{id:"g1",kind:"manual",member_ids:["o1","o2"],params:{},label:null}],uncertain_regions:[],uncertainty:{overall:.2,notes:[]},meta:{generator:"fixture",tokens_version:"map-1",detector_version:null}};var Ul={3:"\u05E8\u05D9\u05D0\u05DC\u05D9\u05E1\u05D8\u05D9",2:"\u05DE\u05DC\u05D0",1:"\u05E1\u05DB\u05DE\u05D8\u05D9",0:"\u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DE\u05D5\u05DB\u05E0\u05D5\u05EA"},Fl="\u05E8\u05D9\u05D0\u05DC\u05D9\u05E1\u05D8\u05D9 \u05E7\u05DC",Ol=[[3,!1],[3,!0],[2,!1],[1,!1],[0,!1]],rf=[["clear","\u05D1\u05D4\u05D9\u05E8"],["hazy","\u05D0\u05D5\u05D1\u05DA"],["overcast","\u05DE\u05E2\u05D5\u05E0\u05DF"]],Ah=30,Ch=2500,fx=30,Kt=s=>document.getElementById(s),rt=(s,t,e)=>{let i=document.createElement(s);return t&&(i.className=t),e!==void 0&&(i.textContent=e),i},px={id:"fixture-sample-v2",title:"sample-v2.json (\u05E7\u05D5\u05D1\u05E5 \u05D4\u05D1\u05D3\u05D9\u05E7\u05D4 \u05E9\u05DC \u05D4\u05E8\u05D9\u05E4\u05D5)",doc:sf,zones:[],anchors:[],entities:{"light.store":"on","switch.hall_a":"on","lock.store":"locked"},coverPositions:{},entityNames:{"light.store":"\u05EA\u05D0\u05D5\u05E8\u05EA \u05DE\u05D7\u05E1\u05DF","lock.store":"\u05DE\u05E0\u05E2\u05D5\u05DC \u05DE\u05D7\u05E1\u05DF"},doorLocks:{}},Bl=[nf,px],kl=class{constructor(t={}){this.stage=Kt("stage"),this.canvas=Kt("gl"),this.env=new Ll(this.canvas,{maxDpr:2}),this.env.backdrop=this.stage,this.lib=new vl,this.planScene=new bl(this.lib),this.planScene._reflector={Reflector:io},this.env.scene.add(this.planScene.root),this.baker=new Nl(this.env,this.planScene),this.quality=3,this.lite=!1,this.mode="orbit",this.levelMode=null,this.preset="iso",this.opts={reflections:!1,ao:!0,bloom:!0,lampShadows:!1,autoLadder:!0,dprCap:1.25,idleS:fx,pointerLock:!1},this.fps={ema:0,ms:0,frames:0,last:performance.now(),window:[]},this.needsFrame=!0,this.continuous=!1,this.lastInput=performance.now(),this.touch=!1,this.hover=null,this.raycaster=new Nr,this.walk=null,this.savedPositions=[],this.probe=null,this.fallbackNote=null,this.bakes={},this.thumbs={},this.presenceTimers={},this.setupCameras(),this.bindUI(),t.defer||this.boot()}boot(){this.loadPlan(Bl[0]),this.resize(),window.addEventListener("resize",()=>this.resize()),requestAnimationFrame(t=>this.frame(t))}setupCameras(){this.persp=new Ie(42,1,.05,300),this.ortho=new Ai(-10,10,10,-10,-100,300),this.walkCam=new Ie(62,1,.05,200),this.camera=this.ortho,this.controls=null}makeControls(t){this.controls&&this.controls.dispose();let e=new _l(t,this.canvas);e.enableDamping=!0,e.dampingFactor=.12,e.maxPolarAngle=Math.PI/2-.03,e.minDistance=2,e.maxDistance=120,e.addEventListener("change",()=>this.invalidate(!1)),e.addEventListener("start",()=>this.userInput()),this.controls=e}fitCamera(t){this.preset=t;let e=this.visibleExtent(),i=(e.minX+e.maxX)/2,n=(e.minZ+e.maxZ)/2,r=e.maxX-e.minX,o=e.maxZ-e.minZ,a=e.top,l=Math.hypot(r,o,a)/2,c=new D(i,e.base+a*.35,n),h;if(t==="persp"){h=this.persp;let f=l/Math.tan(h.fov*Math.PI/360)*1.15;h.position.set(i+f*.62,c.y+f*.55,n+f*.62)}else if(t==="top")h=this.ortho,h.position.set(i,c.y+60,n+.001);else{h=this.ortho;let f=60;h.position.set(i+f*.577,c.y+f*.577,n+f*.577)}if(h===this.ortho){let f=this.canvas.clientWidth/Math.max(1,this.canvas.clientHeight),u=l*1.08;h.left=-u*f,h.right=u*f,h.top=u,h.bottom=-u,h.zoom=1,h.updateProjectionMatrix()}h.lookAt(c),this.camera=h,this.makeControls(h),this.controls.target.copy(c),this.controls.update(),this.env.setCamera(h),this.invalidate()}visibleExtent(){let t=Object.values(this.planScene.levels).filter(n=>n.group.visible&&n.extent),e=t.length?t:Object.values(this.planScene.levels).filter(n=>n.extent),i={minX:1/0,maxX:-1/0,minZ:1/0,maxZ:-1/0,base:1/0,top:0};for(let n of e)i.minX=Math.min(i.minX,n.extent.minX),i.maxX=Math.max(i.maxX,n.extent.maxX),i.minZ=Math.min(i.minZ,n.extent.minZ),i.maxZ=Math.max(i.maxZ,n.extent.maxZ),i.base=Math.min(i.base,n.elevation),i.top=Math.max(i.top,n.elevation+n.ceiling);return Number.isFinite(i.minX)?i:{minX:0,maxX:10,minZ:0,maxZ:10,base:0,top:3}}resize(){let t=this.stage.getBoundingClientRect(),e=Math.max(1,Math.round(t.width)),i=Math.max(1,Math.round(t.height));this.env.dpr=Math.min(this.quality===3&&this.lite?1:this.opts.dprCap,window.devicePixelRatio||1),this.env.renderer.setPixelRatio(this.env.dpr),this.env.setSize(e,i);for(let n of[this.persp,this.walkCam])n.aspect=e/i,n.updateProjectionMatrix();if(this.ortho){let n=this.ortho.top;this.ortho.left=-n*(e/i),this.ortho.right=n*(e/i),this.ortho.updateProjectionMatrix()}this.invalidate()}loadPlan(t){this.plan=t,this.entities={...t.entities},this.coverPositions={...t.coverPositions||{}},t.entities=this.entities,t.coverPositions=this.coverPositions,Kt("crumb-floor").textContent=t.title;let e=t.doc.x_proto||{};this.env.setTime({north:e.north_deg||0,latitude:e.latitude||32}),this.savedPositions=(e.walk_positions||[]).map(n=>({...n})),this.bakes={},this.rebuild();let i=t.doc.levels.find(n=>n.is_default)||t.doc.levels[0];this.setLevelMode(i.id),this.fitCamera("iso"),this.buildStatesPanel(),this.buildWalkPanel(),this.buildQualityPanel(),this.buildStrip(),this.makeThumbs(),this.startProbe()}qualityLabel(){return this.quality===3&&this.lite?Fl:Ul[this.quality]}rebuild(){if(this.quality===0)return;let t=this.quality===3&&this.lite;this.planScene.maxLights=this.quality>=3?8:6,this.planScene.lite=t,this.planScene.build(this.plan,this.quality,{reflections:this.opts.reflections&&this.quality>=3&&!t&&!this.touch,lampShadows:this.opts.lampShadows&&this.quality>=3&&!t&&!this.touch});let e=this.visibleExtent();this.env.post.lite=t,this.env.fitShadows(e,e.top),this.env.setQuality(this.quality,this.camera||this.ortho),this.resize(),this.walk&&(this.walk.scene=this.planScene),this.planScene.showLevel(this.levelMode||"all",this.mode==="walk"),this.invalidate()}setLevelMode(t){if(this.levelMode=t,this.planScene.showLevel(t,this.mode==="walk"),this.buildStrip(),this.invalidate(),this.mode==="orbit"){let e=this.visibleExtent();this.env.fitShadows(e,e.top)}this.mode==="stills"&&this.showStills()}setQuality(t,e,i=!1){if(t===this.quality&&i===this.lite)return;let n=this.quality,r=this.lite;if(this.quality=t,this.lite=t===3&&i,t===0){if(!this.bakes[this.currentLevelId()]){this.quality=n,this.lite=r,this.toast("\u05D0\u05D9\u05DF \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DE\u05D5\u05DB\u05E0\u05D5\u05EA \u05DC\u05E7\u05D5\u05DE\u05D4 \u2014 \u05D4\u05DB\u05DF \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05EA\u05D7\u05D9\u05DC\u05D4");return}this.lastLiveQuality=n,this.lastLiveLite=r,this.enterStills()}else this.mode==="stills"&&this.exitStills(!1),this.rebuild(),this.makeThumbs();this.renderBar(),this.renderLadder(),e&&this.setNote(e),t>0&&this.startProbe()}startProbe(){!this.opts.autoLadder||this.quality===0||(this.probe={start:null,frames:0,warm:0},this.continuous=!0,this.invalidate())}probeFrame(t){let e=this.probe;if(!e)return;if(e.warm<3){e.warm++;return}if(e.start===null){e.start=t,e.frames=0;return}e.frames++;let i=t-e.start;if(i>=Ch){let n=e.frames*1e3/i;this.probe=null,this.continuous=this.mode==="walk",this.lastProbe={fps:Math.round(n),quality:this.quality,label:this.qualityLabel()};let r=Ol.findIndex(([a,l])=>a===this.quality&&l===this.lite),o=Ol[r+1];if(n<Ah&&o&&(o[0]>0||this.bakes[this.currentLevelId()])){let a=this.qualityLabel(),l=o[0]===3&&o[1]?Fl:Ul[o[0]];this.fallbackNote=`${a} \u05E0\u05DE\u05D3\u05D3 ${Math.round(n)} fps (\u05DE\u05EA\u05D7\u05EA \u05DC\u05BE${Ah}) \u2014 \u05D9\u05E8\u05D3\u05E0\u05D5 \u05DC"${l}" \u05DC\u05D4\u05DE\u05E9\u05DA \u05D4\u05D4\u05E4\u05E2\u05DC\u05D4`,this.setQuality(o[0],this.fallbackNote,o[1]),this.stage.dataset.fallback=String(r+1)}else this.setNote(`${this.qualityLabel()} \xB7 \u05E0\u05DE\u05D3\u05D3 ${Math.round(n)} fps \u05D1\u05BE${Ch/1e3} \u05E9\u05F3 \u2014 \u05E0\u05E9\u05D0\u05E8`);this.renderLadder()}}setNote(t,e=!1){let i=Kt("note");i.hidden=!t,i.textContent=t||"",i.classList.toggle("danger",e)}toast(t){this.setNote(t),clearTimeout(this._toast),this._toast=setTimeout(()=>this.setNote(""),3500)}bindUI(){let t=Kt("plan-select");for(let n of Bl){let r=rt("option","",n.title);r.value=n.id,t.appendChild(r)}t.addEventListener("change",()=>{this.mode==="walk"&&this.exitWalk(),this.mode==="stills"&&this.exitStills(!1),this.loadPlan(Bl.find(n=>n.id===t.value))}),Kt("theme-toggle").addEventListener("click",()=>{let n=document.documentElement;n.dataset.theme=n.dataset.theme==="dark"?"":"dark"});let e=Kt("sun-slider");e.addEventListener("input",()=>{this.env.setTime({hour:e.value/60}),this.updateSunCard(),this.invalidate(),this.userInput()}),Kt("sun-now").addEventListener("click",()=>{let n=new Date;e.value=n.getHours()*60+n.getMinutes();let r=new Date(n.getFullYear(),0,0);this.env.setTime({hour:e.value/60,day:Math.floor((n-r)/864e5)}),this.updateSunCard(),this.invalidate()});let i=Kt("weather");for(let[n,r]of rf){let o=rt("button","chip",r);o.dataset.w=n,o.addEventListener("click",()=>{this.env.setTime({weather:n}),this.updateSunCard(),this.invalidate()}),i.appendChild(o)}for(let[n,r]of[["\u05E6\u05D4\u05E8\u05D9\u05D9\u05DD",12.5],["\u05E9\u05E7\u05D9\u05E2\u05D4",18.2],["\u05DC\u05D9\u05DC\u05D4",22.5]]){let o=rt("button","chip",n);o.addEventListener("click",()=>{e.value=r*60,this.env.setTime({hour:r}),this.updateSunCard(),this.invalidate()}),i.appendChild(o)}this.env.onTime=()=>this.updateSunCard(),this.env.setTime({hour:e.value/60,day:278}),document.querySelectorAll(".tabs button").forEach(n=>n.addEventListener("click",()=>{document.querySelectorAll(".tabs button").forEach(r=>r.classList.toggle("sel",r===n)),document.querySelectorAll(".panel").forEach(r=>r.classList.toggle("sel",r.dataset.panel===n.dataset.tab))})),Kt("mobile-toggle").addEventListener("click",()=>Kt("aside").classList.toggle("open")),Kt("kiosk-exit").addEventListener("click",n=>{n.preventDefault(),this.exitStills(!0)}),this.renderBar(),this.bindStageInput(),window.addEventListener("pointerdown",n=>{n.pointerType==="touch"&&(this.touch=!0,this.stage.classList.add("touch"))})}updateSunCard(){let t=this.env.time,e=this.env.sunInfo;Kt("sun-time").textContent=Zd(t.hour);let i=rf.find(r=>r[0]===t.weather),n=e?e.azimuth<90?"\u05DE\u05D6\u05E8\u05D7":e.azimuth<180?"\u05D3\u05E8\u05D5\u05DD\u05BE\u05DE\u05D6\u05E8\u05D7":e.azimuth<270?"\u05D3\u05E8\u05D5\u05DD\u05BE\u05DE\u05E2\u05E8\u05D1":"\u05DE\u05E2\u05E8\u05D1":"";Kt("sun-info").textContent=e?`${e.elevation>0?`\u05E9\u05DE\u05E9 \u05DE${n} \xB7 \u05D2\u05D5\u05D1\u05D4 ${e.elevation.toFixed(0)}\xB0`:"\u05DC\u05D9\u05DC\u05D4 \xB7 \u05D4\u05E9\u05DE\u05E9 \u05DE\u05EA\u05D7\u05EA \u05DC\u05D0\u05D5\u05E4\u05E7"} \xB7 ${$d(t.day)} \xB7 \u05E6\u05E4\u05D5\u05DF \u05D4\u05EA\u05D5\u05DB\u05E0\u05D9\u05EA ${t.north}\xB0 \xB7 ${i?i[1]:""}`:"",document.querySelectorAll("#weather .chip[data-w]").forEach(r=>r.classList.toggle("sel",r.dataset.w===t.weather))}renderBar(){let t=Kt("bar");if(t.innerHTML="",!this.plan)return;let e=(n,r,o,a={})=>{let l=rt("button","chip"+(r?" sel":""),n);return a.disabled&&(l.disabled=!0),l.addEventListener("click",o),t.appendChild(l),l},i=this.plan.doc.levels;e("\u05DE\u05DC\u05DE\u05E2\u05DC\u05D4",this.preset==="top"&&this.mode==="orbit",()=>this.toOrbit("top")),e("\u05D0\u05D9\u05D6\u05D5\u05DE\u05D8\u05E8\u05D9",this.preset==="iso"&&this.mode==="orbit",()=>this.toOrbit("iso")),e("\u05E4\u05E8\u05E1\u05E4\u05E7\u05D8\u05D9\u05D1\u05D4",this.preset==="persp"&&this.mode==="orbit",()=>this.toOrbit("persp"));for(let n of this.planScene.cameras)e(`\u05DE\u05D1\u05D8 \u05DE${n.label.replace("\u05DE\u05E6\u05DC\u05DE\u05D4 \xB7 ","")}`,!1,()=>this.standAtCamera(n));t.appendChild(rt("span","sep")),e("\u{1F6B6} \u05E1\u05D9\u05D5\u05E8",this.mode==="walk",()=>this.mode==="walk"?this.exitWalk():this.enterWalk()),t.appendChild(rt("span","sep"));for(let[n,r]of Ol)e(n===3&&r?Fl:Ul[n],this.quality===n&&this.lite===r,()=>this.setQuality(n,null,r),{disabled:n===0&&!this.bakes[this.currentLevelId()]})}buildStrip(){let t=Kt("strip");t.innerHTML="";let e=this.plan.doc.levels.slice().reverse(),i=(n,r)=>{let o=rt("button",this.levelMode===n?"sel":""),a=rt("span","pic");if(this.thumbs[n]){let h=document.createElement("img");h.src=this.thumbs[n],a.appendChild(h)}let l=rt("span","dots"),c=this.planScene.levels[n];if(c){let h=c.zones.some(d=>d.x_proto&&this.entities[d.x_proto.light]==="on"),f=c.zones.some(d=>d.x_proto&&d.x_proto.presence&&this.entities[d.x_proto.presence]==="on"),u=this.planScene.markers.some(d=>d.group.parent===c.group&&d.group.visible);if(h){let d=rt("i");d.style.background="var(--sw-map-lit)",l.appendChild(d)}if(f){let d=rt("i");d.style.background="var(--sw-map-presence)",l.appendChild(d)}if(u){let d=rt("i");d.style.background="var(--sw-danger)",l.appendChild(d)}}a.appendChild(l),o.appendChild(a),o.appendChild(document.createTextNode(r)),o.addEventListener("click",()=>{this.mode!=="walk"&&(this.setLevelMode(n),this.fitCamera(this.preset))}),t.appendChild(o)};for(let n of e)i(n.id,n.name);i("all","\u05DB\u05DC \u05D4\u05E7\u05D5\u05DE\u05D5\u05EA")}async makeThumbs(){if(this.quality===0)return;let t=this.levelMode;for(let e of this.plan.doc.levels){this.planScene.showLevel(e.id,!1);let i=new Ai(-10,10,10,-10,-100,300),n=this.visibleExtent(),r=(n.minX+n.maxX)/2,o=(n.minZ+n.maxZ)/2,a=Math.hypot(n.maxX-n.minX,n.maxZ-n.minZ)/2*1.05;i.left=-a*1.6,i.right=a*1.6,i.top=a,i.bottom=-a,i.position.set(r+40,n.base+40,o+40),i.lookAt(r,n.base+1,o),i.updateProjectionMatrix(),this.planScene.update(.016,i.position,{nightFactor:this.env.recipe.night,lampShadows:!1}),this.thumbs[e.id]=this.baker.thumbnail(i,208,112)}this.planScene.showLevel(t,this.mode==="walk"),this.buildStrip(),this.invalidate()}currentLevelId(){return this.mode==="walk"&&this.walk?this.walk.level:this.levelMode==="all"||!this.levelMode?this.plan.doc.levels[0].id:this.levelMode}buildStatesPanel(){let t=Kt("panel-states");t.innerHTML="";let e=this.plan.entityNames||{},i=(h,f,u=["on"],d="off",m="on")=>{let _=rt("button","sw "+(f||"")),p=()=>_.classList.toggle("on",u.includes(this.entities[h]));return p(),_.addEventListener("click",()=>{this.setEntity(h,u.includes(this.entities[h])?d:m),p()}),_.dataset.entity=h,this._syncs=this._syncs||[],this._syncs.push(p),_},n=rt("div","pcard");n.appendChild(rt("h3","","\u05EA\u05E8\u05D7\u05D9\u05E9\u05D9\u05DD"));let r=rt("div","actions");r.style.display="flex",r.style.gap="6px",r.style.flexWrap="wrap";let o=(h,f)=>{let u=rt("button","btn sm",h);u.addEventListener("click",()=>{f(),this.syncPanel()}),r.appendChild(u)};o("\u05D4\u05DB\u05D5\u05DC \u05DB\u05D1\u05D5\u05D9",()=>this.setMany(h=>h.startsWith("light."),"off")),o("\u05E2\u05E8\u05D1 \u05D1\u05D1\u05D9\u05EA",()=>{this.setMany(h=>h.startsWith("light."),"on"),Kt("sun-slider").value=1140,this.env.setTime({hour:19}),this.updateSunCard()}),o("\u05DC\u05D9\u05DC\u05D4",()=>{this.setMany(h=>h.startsWith("light."),"off"),this.setEntity("light.hall","on"),this.setEntity("light.upper_corridor","on"),Kt("sun-slider").value=1380,this.env.setTime({hour:23}),this.updateSunCard()}),o("\u05E4\u05EA\u05D7 \u05D4\u05DB\u05D5\u05DC",()=>this.setMany(h=>h.startsWith("binary_sensor.")&&h.endsWith("_door"),"on")),o("\u05E1\u05D2\u05D5\u05E8 \u05D4\u05DB\u05D5\u05DC",()=>this.setMany(h=>h.startsWith("binary_sensor.")&&h.endsWith("_door"),"off")),n.appendChild(r),t.appendChild(n);for(let h of this.plan.doc.levels){let f=rt("div","pcard"),u=rt("h3","",h.name);u.appendChild(rt("span","muted",`\u05DE\u05E4\u05DC\u05E1 ${h.elevation_m.toFixed(1)} \u05DE\u05F3`)),f.appendChild(u);let d=this.plan.zones.filter(m=>m.level_id===h.id);d.length||f.appendChild(rt("div","help","\u05D0\u05D9\u05DF \u05D7\u05D3\u05E8\u05D9\u05DD \u05DE\u05D5\u05D2\u05D3\u05E8\u05D9\u05DD \u05D1\u05E7\u05D5\u05D1\u05E5 \u05D6\u05D4 \u2014 \u05D4\u05DE\u05E6\u05D1\u05D9\u05DD \u05DE\u05EA\u05D5\u05DA \u05D4\u05D9\u05E9\u05D5\u05D9\u05D5\u05EA \u05D1\u05DC\u05D1\u05D3."));for(let m of d){let _=rt("div","room"),p=rt("div","name",m.name);m.x_proto&&typeof m.x_proto.temp=="number"&&p.appendChild(rt("span","t",`${m.x_proto.temp.toFixed(1)}\xB0`)),_.appendChild(p);let g=m.x_proto||{};if(g.light){let M=rt("div","dev");M.appendChild(rt("span","lbl2",e[g.light]||g.light)),M.appendChild(i(g.light)),_.appendChild(M)}for(let M of this.planScene.lamps.filter(T=>T.level===h.id&&T.entity!==g.light&&this.lampInZone(T,m))){let T=rt("div","dev");T.appendChild(rt("span","lbl2",e[M.entity]||M.entity)),T.appendChild(i(M.entity)),_.appendChild(T)}if(g.presence){let M=rt("div","dev");M.appendChild(rt("span","lbl2",e[g.presence]||g.presence));let T=rt("button","btn sm","\u05D3\u05DE\u05D4 \u05EA\u05E0\u05D5\u05E2\u05D4");T.addEventListener("click",()=>this.pulsePresence(g.presence)),M.appendChild(T),M.appendChild(i(g.presence,"")),_.appendChild(M)}f.appendChild(_)}t.appendChild(f)}let a=rt("div","pcard");a.appendChild(rt("h3","","\u05D3\u05DC\u05EA\u05D5\u05EA \u05D5\u05DE\u05E0\u05E2\u05D5\u05DC\u05D9\u05DD"));for(let h of this.plan.doc.openings.filter(f=>f.kind==="door"&&f.anchor_ref)){let f=h.anchor_ref.resource_id,u=rt("div","dev");u.appendChild(rt("span","lbl2",e[f]||f)),f.startsWith("lock.")?u.appendChild(i(f,"danger",["locked"],"unlocked","locked")):u.appendChild(i(f,"danger",["on","open"],"off","on")),a.appendChild(u);let d=this.plan.doorLocks&&this.plan.doorLocks[h.id];if(d){let m=rt("div","dev");m.appendChild(rt("span","lbl2",e[d]||d)),m.appendChild(i(d,"danger",["locked"],"unlocked","locked")),a.appendChild(m)}}t.appendChild(a);let l=Object.keys(this.entities).filter(h=>h.startsWith("cover."));if(l.length){let h=rt("div","pcard");h.appendChild(rt("h3","","\u05EA\u05E8\u05D9\u05E1\u05D9\u05DD"));for(let f of l){let u=rt("div","dev");u.appendChild(rt("span","lbl2",e[f]||f));let d=document.createElement("input");d.type="range",d.min=0,d.max=100,d.className="pos",d.value=this.coverPositions[f]??(this.entities[f]==="open"?100:0),d.addEventListener("input",()=>{this.coverPositions[f]=+d.value,this.setEntity(f,+d.value>0?"open":"closed")}),u.appendChild(d),h.appendChild(u)}t.appendChild(h)}let c=Object.keys(this.entities).filter(h=>h.startsWith("media_player."));if(c.length){let h=rt("div","pcard");h.appendChild(rt("h3","","\u05DE\u05D3\u05D9\u05D4"));for(let f of c){let u=rt("div","dev");u.appendChild(rt("span","lbl2",e[f]||f)),u.appendChild(i(f,"",["playing","on"],"off","playing")),h.appendChild(u)}t.appendChild(h)}}lampInZone(t,e){let i=e.polygon.map(n=>this.planScene.toM([n.x,n.y]));return yl(t.pos.x,t.pos.z,i)}syncPanel(){for(let t of this._syncs||[])t();this.buildStrip()}setMany(t,e){for(let i of Object.keys(this.entities))t(i)&&(this.entities[i]=e);this.applyStates()}setEntity(t,e){this.entities[t]=e,this.applyStates(),this.syncPanel()}applyStates(){this.planScene.setStates(this.entities,this.coverPositions),this.invalidate(),this.mode==="stills"&&this.showStills(),this.walk&&(this.walk.path=null)}pulsePresence(t){this.setEntity(t,"on"),clearTimeout(this.presenceTimers[t]),this.presenceTimers[t]=setTimeout(()=>this.setEntity(t,"off"),12e3)}buildWalkPanel(){let t=Kt("panel-walk");t.innerHTML="";let e=rt("div","pcard");e.appendChild(rt("h3","","\u05E1\u05D9\u05D5\u05E8 \u05D1\u05D2\u05D5\u05D1\u05D4 \u05E2\u05D9\u05DF"));let i=rt("button","btn primary",this.mode==="walk"?"\u05D9\u05E6\u05D9\u05D0\u05D4 \u05DE\u05D4\u05E1\u05D9\u05D5\u05E8":"\u05D4\u05EA\u05D7\u05DC \u05E1\u05D9\u05D5\u05E8");i.addEventListener("click",()=>this.mode==="walk"?this.exitWalk():this.enterWalk()),e.appendChild(i);let n=rt("div","toggles");n.style.marginTop="8px";let r=document.createElement("input");r.type="range",r.min=1.2,r.max=2,r.step=.05,r.value=Sh,r.className="pos";let o=rt("span","",`\u05D2\u05D5\u05D1\u05D4 \u05E2\u05D9\u05DF ${(+r.value).toFixed(2)} \u05DE\u05F3`);r.addEventListener("input",()=>{o.textContent=`\u05D2\u05D5\u05D1\u05D4 \u05E2\u05D9\u05DF ${(+r.value).toFixed(2)} \u05DE\u05F3`,this.walk&&(this.walk.eye=+r.value,this.invalidate())}),n.appendChild(o),n.appendChild(r);let a=rt("button","btn sm","\u05E0\u05E2\u05D9\u05DC\u05EA \u05E1\u05DE\u05DF (\u05D0\u05D5\u05E4\u05E6\u05D9\u05D5\u05E0\u05DC\u05D9)");a.addEventListener("click",()=>this.requestPointerLock()),n.appendChild(rt("span","","\u05DE\u05D1\u05D8 \u05D1\u05E2\u05DB\u05D1\u05E8: \u05D2\u05E8\u05D9\u05E8\u05D4 (\u05D1\u05E8\u05D9\u05E8\u05EA \u05DE\u05D7\u05D3\u05DC)")),n.appendChild(a),e.appendChild(n),e.appendChild(Object.assign(rt("div","help"),{innerHTML:"<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / \u05D7\u05D9\u05E6\u05D9\u05DD \u2014 \u05D4\u05DC\u05D9\u05DB\u05D4 \xB7 <kbd>Shift</kbd> \u05E8\u05D9\u05E6\u05D4 \xB7 <kbd>Q</kbd><kbd>E</kbd> \u05E1\u05D9\u05D1\u05D5\u05D1 \xB7 \u05D2\u05E8\u05D9\u05E8\u05EA \u05E2\u05DB\u05D1\u05E8 \u2014 \u05DE\u05D1\u05D8 \xB7 \u05DC\u05D7\u05D9\u05E6\u05D4 \u05E2\u05DC \u05D4\u05E8\u05E6\u05E4\u05D4 \u2014 \u05D4\u05DC\u05D9\u05DB\u05D4 \u05DC\u05E0\u05E7\u05D5\u05D3\u05D4 \xB7 <kbd>Enter</kbd> \u05E4\u05E2\u05D5\u05DC\u05D4 \u05E2\u05DC \u05D4\u05D4\u05EA\u05E7\u05DF \u05E9\u05D1\u05DB\u05D5\u05D5\u05E0\u05EA \xB7 <kbd>1</kbd>\u2013<kbd>9</kbd> \u05E2\u05DE\u05D3\u05D5\u05EA \u05E9\u05DE\u05D5\u05E8\u05D5\u05EA \xB7 <kbd>Esc</kbd> \u05D9\u05E6\u05D9\u05D0\u05D4 \xB7 \u05DE\u05D2\u05E2: \u05D2\u05F3\u05D5\u05D9\u05E1\u05D8\u05D9\u05E7 \u05DE\u05E9\u05DE\u05D0\u05DC, \u05D2\u05E8\u05D9\u05E8\u05D4 \u05DE\u05D9\u05DE\u05D9\u05DF, \u05D4\u05E7\u05E9\u05D4 \u2014 \u05D4\u05DC\u05D9\u05DB\u05D4"})),t.appendChild(e);let l=rt("div","pcard");l.appendChild(rt("h3","","\u05E2\u05DE\u05D3\u05D5\u05EA \u05E9\u05DE\u05D5\u05E8\u05D5\u05EA"));let c=rt("div","list");this.savedPositions.forEach((u,d)=>{let m=rt("button","",`${u.name} \xB7 ${this.levelName(u.level_id)}`);m.appendChild(rt("span","k",String(d+1))),m.addEventListener("click",()=>this.gotoPosition(u)),c.appendChild(m)}),l.appendChild(c),t.appendChild(l);let h=rt("div","pcard");h.appendChild(rt("h3","","\u05E2\u05DE\u05D5\u05D3 \u05D1\u2026"));let f=rt("div","list");for(let u of this.planScene.cameras){let d=rt("button","",`\u{1F4F7} ${u.label}`);d.addEventListener("click",()=>this.standAtCamera(u)),f.appendChild(d)}for(let u of Object.values(this.planScene.levels))for(let d of u.zones){let m=rt("button","",`${d.name} \xB7 ${u.name}`);m.addEventListener("click",()=>this.standInRoom(u,d)),f.appendChild(m)}h.appendChild(f),t.appendChild(h)}levelName(t){let e=this.plan.doc.levels.find(i=>i.id===t);return e?e.name:t}buildQualityPanel(){let t=Kt("panel-quality");t.innerHTML="";let e=rt("div","pcard");e.appendChild(rt("h3","","\u05E1\u05D5\u05DC\u05DD \u05D4\u05D0\u05D9\u05DB\u05D5\u05EA")),this.ladderEl=rt("div","ladder"),e.appendChild(this.ladderEl),e.appendChild(rt("div","help",`\u05E0\u05DE\u05D3\u05D3 ${Ch/1e3} \u05E9\u05E0\u05D9\u05D5\u05EA \u05D0\u05D7\u05E8\u05D9 3 \u05E4\u05E8\u05D9\u05D9\u05DE\u05D9\u05DD; \u05DE\u05EA\u05D7\u05EA \u05DC\u05BE${Ah} fps \u05D9\u05D5\u05E8\u05D3\u05D9\u05DD \u05E9\u05DC\u05D1 \u05D5\u05E0\u05E9\u05D0\u05E8\u05D9\u05DD \u05E9\u05DD \u05DC\u05D4\u05DE\u05E9\u05DA \u05D4\u05D4\u05E4\u05E2\u05DC\u05D4. \u05D1\u05D7\u05D9\u05E8\u05D4 \u05D9\u05D3\u05E0\u05D9\u05EA \u05DE\u05D5\u05D3\u05D3\u05EA \u05DE\u05D7\u05D3\u05E9.`));let i=rt("div","toggles"),n=(p,g,M)=>{let T=rt("button","sw"+(this.opts[p]?" on":""));T.addEventListener("click",()=>{this.opts[p]=!this.opts[p],T.classList.toggle("on",this.opts[p]),(M||(()=>this.rebuild()))()}),i.appendChild(rt("span","",g)),i.appendChild(T)};n("autoLadder","\u05D9\u05E8\u05D9\u05D3\u05D4 \u05D0\u05D5\u05D8\u05D5\u05DE\u05D8\u05D9\u05EA \u05D1\u05E8\u05DE\u05D4",()=>{}),n("reflections","\u05D4\u05E9\u05EA\u05E7\u05E4\u05D5\u05EA \u05E8\u05E6\u05E4\u05D4 (\u05E8\u05D9\u05D0\u05DC\u05D9\u05E1\u05D8\u05D9 \xB7 \u05D9\u05E7\u05E8: \u05DE\u05E2\u05D1\u05E8 \u05E9\u05E0\u05D9 \u05E9\u05DC \u05DB\u05DC \u05D4\u05E1\u05E6\u05E0\u05D4)"),n("ao","\u05D7\u05E1\u05D9\u05DE\u05EA \u05E1\u05D1\u05D9\u05D1\u05D4 GTAO (\u05E8\u05D9\u05D0\u05DC\u05D9\u05E1\u05D8\u05D9)",()=>{this.env.post.ao=this.opts.ao,this.env.buildComposer(this.camera),this.invalidate()}),n("bloom","\u05D6\u05D5\u05D4\u05E8 \u05DE\u05E0\u05D5\u05E8\u05D5\u05EA (bloom)",()=>{this.env.post.bloom=this.opts.bloom,this.env.buildComposer(this.camera),this.invalidate()}),n("lampShadows","\u05E6\u05DC\u05DC\u05D9\u05DD \u05DE\u05DE\u05E0\u05D5\u05E8\u05D5\u05EA (2 \u05D4\u05E7\u05E8\u05D5\u05D1\u05D5\u05EA)"),e.appendChild(i);let r=rt("div","toggles"),o=document.createElement("select");for(let p of[1,1.25,1.5,2]){let g=rt("option","",`\u05E2\u05D3 ${p}\xD7`);g.value=p,p===this.opts.dprCap&&(g.selected=!0),o.appendChild(g)}o.addEventListener("change",()=>{this.opts.dprCap=+o.value,this.resize()}),r.appendChild(rt("span","","\u05D9\u05D7\u05E1 \u05E4\u05D9\u05E7\u05E1\u05DC\u05D9\u05DD")),r.appendChild(o),e.appendChild(r),t.appendChild(e);let a=rt("div","pcard");a.appendChild(rt("h3","","\u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DE\u05D5\u05DB\u05E0\u05D5\u05EA \u05D5\u05DE\u05E6\u05D1 \u05E7\u05D9\u05D5\u05E1\u05E7")),a.appendChild(rt("div","help","\u05D0\u05E4\u05D9\u05D9\u05D4 \u05D1\u05D3\u05E4\u05D3\u05E4\u05DF: 4 \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DC\u05E7\u05D5\u05DE\u05D4 (\u05D9\u05D5\u05DD/\u05DC\u05D9\u05DC\u05D4 \xD7 \u05DB\u05D1\u05D5\u05D9/\u05D3\u05D5\u05DC\u05E7) \u05D1\u05DE\u05D1\u05D8 \u05D0\u05D9\u05D6\u05D5\u05DE\u05D8\u05E8\u05D9 + \u05DE\u05E1\u05DB\u05D5\u05EA SVG \u05DC\u05DB\u05DC \u05D7\u05D3\u05E8 \u05DE\u05D0\u05D5\u05EA\u05D4 \u05DE\u05D8\u05E8\u05D9\u05E6\u05EA \u05DE\u05E6\u05DC\u05DE\u05D4. \u05DE\u05E6\u05D1 \u05E7\u05D9\u05D5\u05E1\u05E7: \u05D0\u05E4\u05E1 \u05E4\u05E8\u05D9\u05D9\u05DE\u05D9\u05DD, \u05D4\u05EA\u05DE\u05D5\u05E0\u05D4 \u05D4\u05D3\u05D5\u05DC\u05E7\u05EA \u05E0\u05D7\u05E9\u05E4\u05EA \u05DC\u05E4\u05D9 \u05D4\u05DE\u05E1\u05DB\u05D4 \u05E9\u05DC \u05D4\u05D7\u05D3\u05E8."));let l=rt("button","btn primary","\u05D4\u05DB\u05DF \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DC\u05E7\u05D5\u05DE\u05D4 \u05D4\u05E0\u05D5\u05DB\u05D7\u05D9\u05EA"),c=rt("div","progress"),h=rt("i");c.appendChild(h),l.addEventListener("click",()=>this.bakeCurrent(l,h)),a.appendChild(l),a.appendChild(c);let f=rt("button","btn sm","\u05D4\u05DB\u05DF \u05DC\u05DB\u05DC \u05D4\u05E7\u05D5\u05DE\u05D5\u05EA");f.style.marginTop="6px",f.addEventListener("click",async()=>{for(let p of this.plan.doc.levels)this.setLevelMode(p.id),await this.bakeCurrent(l,h)}),a.appendChild(f);let u=rt("div","toggles");u.style.marginTop="8px";let d=document.createElement("select");for(let[p,g]of[[0,"\u05DB\u05D1\u05D5\u05D9"],[10,"10 \u05E9\u05F3"],[30,"30 \u05E9\u05F3"],[120,"2 \u05D3\u05E7\u05F3"],[600,"10 \u05D3\u05E7\u05F3"]]){let M=rt("option","",g);M.value=p,p===this.opts.idleS&&(M.selected=!0),d.appendChild(M)}d.addEventListener("change",()=>{this.opts.idleS=+d.value}),u.appendChild(rt("span","","\u05DE\u05E2\u05D1\u05E8 \u05DC\u05EA\u05DE\u05D5\u05E0\u05D4 \u05D0\u05D7\u05E8\u05D9 \u05D7\u05D5\u05E1\u05E8 \u05E4\u05E2\u05D9\u05DC\u05D5\u05EA")),u.appendChild(d),a.appendChild(u);let m=rt("button","btn sm","\u05D4\u05E6\u05D2 \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA \u05DE\u05D5\u05DB\u05E0\u05D5\u05EA \u05E2\u05DB\u05E9\u05D9\u05D5");m.style.marginTop="6px",m.addEventListener("click",()=>this.setQuality(0)),a.appendChild(m),t.appendChild(a);let _=rt("div","pcard");_.appendChild(rt("h3","","\u05DE\u05D4 \u05D4\u05DE\u05D3\u05D9\u05D3\u05D4 \u05D0\u05D5\u05DE\u05E8\u05EA")),_.appendChild(rt("div","help","\u05D4\u05BEHUD \u05D1\u05E4\u05D9\u05E0\u05D4 \u05DE\u05E8\u05D0\u05D4 fps, \u05D6\u05DE\u05DF \u05E4\u05E8\u05D9\u05D9\u05DD, \u05E7\u05E8\u05D9\u05D0\u05D5\u05EA \u05E6\u05D9\u05D5\u05E8, \u05DE\u05E9\u05D5\u05DC\u05E9\u05D9\u05DD, \u05D8\u05E7\u05E1\u05D8\u05D5\u05E8\u05D5\u05EA \u05D5\u05D6\u05D9\u05DB\u05E8\u05D5\u05DF JS \u05DE\u05EA\u05D5\u05DA three.js \u05D5\u05DE\u05D4\u05D3\u05E4\u05D3\u05E4\u05DF. \u05E9\u05D5\u05E8\u05EA \u05D4\u05BEGPU \u05DE\u05D6\u05D4\u05D4 SwiftShader (\u05E8\u05D9\u05E0\u05D3\u05D5\u05E8 \u05EA\u05D5\u05DB\u05E0\u05D4) \u2014 \u05DE\u05E1\u05E4\u05E8\u05D9\u05DD \u05DE\u05DE\u05E0\u05D5 \u05D0\u05D9\u05E0\u05DD \u05DE\u05E1\u05E4\u05E8\u05D9 GPU \u05D0\u05DE\u05D9\u05EA\u05D9.")),t.appendChild(_),this.renderLadder()}renderLadder(){if(!this.ladderEl)return;this.ladderEl.innerHTML="";let t=[...Ol.map(([e,i])=>[e,i,e===3&&i?Fl:Ul[e]]),[-1,!1,"2D"]];t.forEach(([e,i,n],r)=>{let o=rt("span",e===this.quality&&i===this.lite?"on":"",n);e>=0&&o.addEventListener("click",()=>this.setQuality(e,null,i)),e===-1&&(o.style.cursor="default"),this.stage.dataset.fallback&&r<+this.stage.dataset.fallback&&o.classList.add("down"),this.ladderEl.appendChild(o),r<t.length-1&&this.ladderEl.appendChild(rt("span","","\u2190"))}),this.lastProbe&&this.ladderEl.appendChild(rt("div","help",`\u05DE\u05D3\u05D9\u05D3\u05D4 \u05D0\u05D7\u05E8\u05D5\u05E0\u05D4: ${this.lastProbe.fps} fps \u05D1\u05E8\u05DE\u05D4 "${this.lastProbe.label}"`))}async bakeCurrent(t,e){this.quality===0&&this.exitStills(!1);let i=this.currentLevelId(),n=this.levelMode,r=this.mode;this.mode==="walk"&&this.exitWalk(),this.setLevelMode(i),t.disabled=!0;let o={...this.entities},a=this.env.time.hour,l=new Ie(38,1.6,.1,300),c=this.visibleExtent(),h=(c.minX+c.maxX)/2,f=(c.minZ+c.maxZ)/2,d=Math.hypot(c.maxX-c.minX,c.maxZ-c.minZ,c.top)/2/Math.tan(l.fov*Math.PI/360)*1.1;l.position.set(h+d*.6,c.base+d*.6,f+d*.6),l.lookAt(h,c.base+1,f);let m=this.planScene.markers.filter(M=>M.group.parent===this.planScene.levels[i].group).map(M=>{let T=[];return M.group.children.forEach(y=>{y.geometry.computeBoundingBox();let b=y.geometry.boundingBox;T.push(new D(b.min.x,b.min.y,b.min.z),new D(b.max.x,b.max.y,b.max.z),new D(b.min.x,b.max.y,b.max.z),new D(b.max.x,b.min.y,b.min.z),new D(b.min.x,b.max.y,b.min.z),new D(b.max.x,b.max.y,b.min.z),new D(b.min.x,b.min.y,b.max.z),new D(b.max.x,b.min.y,b.max.z))}),{entity:M.entity,points:T}}),_=0,p=M=>{let T=M.startsWith("night"),y=M.endsWith("_on");this.env.setTime({hour:T?22.5:14});for(let b of Object.keys(this.entities))b.startsWith("light.")&&(this.entities[b]=y?"on":"off");for(let b of this.planScene.markers)b.group.visible=!1;for(let b of this.planScene.presence)b.mesh.visible=!1;this.planScene.setStates(this.entities,this.coverPositions,!0);for(let b of this.planScene.markers)b.group.visible=!1;for(let b of this.planScene.presence)b.mesh.visible=!1;this.planScene.update(1,l.position,{nightFactor:T?1:0,lampShadows:!1}),this.planScene.update(1,l.position,{nightFactor:T?1:0,lampShadows:!1}),e.style.width=`${++_/4*100}%`},g=await this.baker.bake(i,l,1280,800,p,m);this.bakes[i]=g,Object.assign(this.entities,o),this.env.setTime({hour:a}),this.planScene.setStates(this.entities,this.coverPositions,!0),this.thumbs[i]=g.pics.day_on,e.style.width="0",t.disabled=!1,this.renderBar(),this.buildStrip(),this.toast(`\u05D4\u05D5\u05DB\u05E0\u05D5 4 \u05EA\u05DE\u05D5\u05E0\u05D5\u05EA + ${g.masks.length} \u05DE\u05E1\u05DB\u05D5\u05EA \u05DC\u05E7\u05D5\u05DE\u05D4 "${this.levelName(i)}"`),n!==i&&this.setLevelMode(n),this.invalidate()}enterStills(){this.mode="stills",this.stage.classList.add("stills"),this.continuous=!1,this.showStills(),this.renderBar()}showStills(){let t=this.bakes[this.currentLevelId()];Kd(Kt("stills"),t,{night:this.env.recipe.night>.5||this.env.sunInfo.elevation<0,entities:this.entities}),Kt("labels").innerHTML=""}exitStills(t){this.stage.classList.remove("stills"),this.mode="orbit",t&&this.quality===0&&(this.quality=this.lastLiveQuality||2,this.lite=!!this.lastLiveLite,this.rebuild(),this.renderBar(),this.renderLadder()),this.invalidate()}enterWalk(){this.mode==="stills"&&this.exitStills(!0),this.mode="walk",this.stage.classList.add("walk"),this.orbitState={camera:this.camera,preset:this.preset,levelMode:this.levelMode},this.walk||(this.walk=new Dl(this.planScene),this.walk.onLevelChange=e=>this.onWalkLevel(e)),this.walk.scene=this.planScene,this.walk.eye=+(document.querySelector("#panel-walk input[type=range]")||{value:Sh}).value;let t=this.savedPositions.find(e=>e.is_default)||this.savedPositions[0];if(t)this.gotoPosition(t,!0);else{let e=this.planScene.levels[this.currentLevelId()],i=e.zones[0],n=i?Hs(i.polyM):[(e.extent.minX+e.extent.maxX)/2,(e.extent.minZ+e.extent.maxZ)/2];this.walk.placeAt(n[0],n[1],0,e.id)}this.walkCam.fov=this.touch?70:62,this.walkCam.updateProjectionMatrix(),this.camera=this.walkCam,this.controls&&(this.controls.enabled=!1),this.planScene.showLevel("all",!0),this.env.setCamera(this.walkCam),this.env.interior=!0,this.env.applyTime(),this.continuous=!0,this.renderBar(),this.buildWalkPanel(),this.updateWalkBar(),this.invalidate(),this.canvas.focus&&this.canvas.focus()}exitWalk(){document.pointerLockElement&&document.exitPointerLock(),this.mode="orbit",this.stage.classList.remove("walk");let t=this.orbitState||{};this.levelMode=t.levelMode||this.plan.doc.levels[0].id,this.planScene.showLevel(this.levelMode,!1),this.buildStrip(),this.fitCamera(t.preset||"iso"),this.env.interior=!1,this.env.applyTime(),this.continuous=!1,this.renderBar(),this.buildWalkPanel(),this.invalidate()}onWalkLevel(t){this.levelMode=t,this.buildStrip(),this.toast(`${this.levelName(t)}`),Kt("mm-level").textContent=this.levelName(t)}gotoPosition(t,e){let[i,n]=this.planScene.toM([t.x,t.y]);this.mode!=="walk"&&this.enterWalk(),this.teleport(()=>{this.walk.placeAt(i,n,t.heading_deg||0,t.level_id),this.planScene.showLevel("all",!0)},e),Kt("mm-level").textContent=this.levelName(this.walk.level)}teleport(t,e){let i=Kt("fade");if(e){t(),this.invalidate();return}i.style.opacity="1",setTimeout(()=>{t(),this.invalidate(),setTimeout(()=>i.style.opacity="0",60)},160)}standAtCamera(t){this.mode!=="walk"&&this.enterWalk(),this.teleport(()=>{let e=this.planScene.levels[t.level];this.walk.placeAt(t.pos[0]+t.fwd[0]*.35,t.pos[1]+t.fwd[1]*.35,Math.atan2(-t.fwd[0],-t.fwd[1])*180/Math.PI,t.level),this.walk.yaw=Math.atan2(-t.fwd[0],-t.fwd[1]),this.walk.pitch=-t.tilt*Math.PI/180,this.walk.eyeOverride=e.elevation+t.mount}),this.toast(`\u05E2\u05D5\u05DE\u05D3 \u05D1${t.label} \u2014 \u05D2\u05D5\u05D1\u05D4 ${t.mount.toFixed(1)} \u05DE\u05F3, \u05D4\u05D4\u05DC\u05D9\u05DB\u05D4 \u05D4\u05E8\u05D0\u05E9\u05D5\u05E0\u05D4 \u05DE\u05D7\u05D6\u05D9\u05E8\u05D4 \u05DC\u05D2\u05D5\u05D1\u05D4 \u05D4\u05E2\u05D9\u05DF`)}standInRoom(t,e){this.mode!=="walk"&&this.enterWalk();let[i,n]=Hs(e.polyM),r=0,o=0;for(let a=0;a<e.polyM.length;a++){let l=e.polyM[a],c=e.polyM[(a+1)%e.polyM.length],h=Math.hypot(c[0]-l[0],c[1]-l[1]);h>o&&(o=h,r=Math.atan2(-((l[0]+c[0])/2-i),-((l[1]+c[1])/2-n)))}this.teleport(()=>this.walk.placeAt(i,n,r*180/Math.PI,t.id))}updateWalkBar(){if(!this.walk||document.activeElement&&document.activeElement.closest&&document.activeElement.closest("#walkbar"))return;Kt("wx").value=this.walk.x.toFixed(2),Kt("wz").value=this.walk.z.toFixed(2),Kt("wh").value=Math.round((this.walk.yaw*180/Math.PI%360+360)%360);let t=this.planScene.levels[this.walk.level],e=t.zones.find(i=>yl(this.walk.x,this.walk.z,i.polyM));Kt("roomname").textContent=`${e?e.name+" \xB7 ":""}${t.name}${this.walk.onStairs?" \xB7 \u05DE\u05D3\u05E8\u05D2\u05D5\u05EA":""}${this.walk.edge?" \xB7 \u05E7\u05E6\u05D4 \u05D4\u05EA\u05D5\u05DB\u05E0\u05D9\u05EA":""}`,Kt("mm-level").textContent=t.name}requestPointerLock(){this.mode!=="walk"&&this.enterWalk();let t=this.canvas.requestPointerLock&&this.canvas.requestPointerLock();t&&t.catch&&t.catch(()=>this.toast("\u05E0\u05E2\u05D9\u05DC\u05EA \u05E1\u05DE\u05DF \u05E0\u05D3\u05D7\u05EA\u05D4 \u05E2\u05DC \u05D9\u05D3\u05D9 \u05D4\u05D3\u05E4\u05D3\u05E4\u05DF / \u05D4\u05DE\u05E1\u05D2\u05E8\u05EA \u2014 \u05E0\u05E9\u05D0\u05E8\u05D9\u05DD \u05D1\u05D2\u05E8\u05D9\u05E8\u05D4")),setTimeout(()=>{document.pointerLockElement||this.toast("\u05E0\u05E2\u05D9\u05DC\u05EA \u05E1\u05DE\u05DF \u05DC\u05D0 \u05D6\u05DE\u05D9\u05E0\u05D4 \u05DB\u05D0\u05DF \u2014 \u05E0\u05E9\u05D0\u05E8\u05D9\u05DD \u05D1\u05D2\u05E8\u05D9\u05E8\u05D4")},300)}bindStageInput(){let t=this.canvas;t.tabIndex=0;let e=new Set,i=()=>{if(!this.walk||this.mode!=="walk")return;let u=this.walk.input;u.fwd=(e.has("KeyW")||e.has("ArrowUp")?1:0)-(e.has("KeyS")||e.has("ArrowDown")?1:0),u.strafe=(e.has("KeyD")?1:0)-(e.has("KeyA")?1:0),u.turn=(e.has("KeyQ")||e.has("ArrowLeft")?1:0)-(e.has("KeyE")||e.has("ArrowRight")?1:0),u.run=e.has("ShiftLeft")||e.has("ShiftRight"),(u.fwd||u.strafe)&&(this.walk.path=null)};window.addEventListener("keydown",u=>{if(!(u.target&&(u.target.tagName==="INPUT"||u.target.tagName==="SELECT"||u.target.tagName==="TEXTAREA"))){if(this.userInput(),u.code==="Escape"){this.mode==="walk"&&this.exitWalk();return}if(!(u.code==="Digit3"&&this.mode!=="walk")&&this.mode==="walk"){if(/^Digit[1-9]$/.test(u.code)){let d=this.savedPositions[+u.code.slice(5)-1];d&&this.gotoPosition(d);return}if(u.code==="Enter"){this.actOnCrosshair();return}e.add(u.code),i(),["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(u.code)&&u.preventDefault()}}}),window.addEventListener("keyup",u=>{e.delete(u.code),i()}),window.addEventListener("blur",()=>{e.clear(),i()});let n=null;t.addEventListener("pointerdown",u=>{this.userInput(),this.mode!=="stills"&&(n={x:u.clientX,y:u.clientY,moved:!1,id:u.pointerId,t:performance.now(),touch:u.pointerType==="touch"},this.mode==="walk"&&!(u.pointerType==="touch"&&this.joyActive)&&t.setPointerCapture(u.pointerId))}),t.addEventListener("pointermove",u=>{if(this.mode==="walk"&&document.pointerLockElement===t){this.walk.look(u.movementX*.0025,u.movementY*.0025),this.invalidate();return}if(!n||n.id!==u.pointerId){this.mode!=="walk"&&this.hoverAt(u);return}let d=u.clientX-n.x,m=u.clientY-n.y;if(Math.hypot(d,m)>6&&(n.moved=!0),this.mode==="walk"&&n.moved){let _=n.touch?.004:.0028;this.walk.look(d*_,m*_),n.x=u.clientX,n.y=u.clientY,this.invalidate()}});let r=u=>{if(!n||n.id!==u.pointerId)return;let d=n;n=null,this.mode!=="stills"&&(d.moved||this.clickAt(u,d.touch,performance.now()-d.t>500))};t.addEventListener("pointerup",r),t.addEventListener("pointercancel",()=>n=null),t.addEventListener("contextmenu",u=>u.preventDefault()),t.addEventListener("wheel",()=>this.userInput(),{passive:!0});let o=Kt("joystick"),a=Kt("knob"),l=null,c=null;o.addEventListener("pointerdown",u=>{l=u.pointerId;let d=o.getBoundingClientRect();c=[d.left+d.width/2,d.top+d.height/2],o.setPointerCapture(u.pointerId),this.joyActive=!0,this.userInput()}),o.addEventListener("pointermove",u=>{if(u.pointerId!==l||!this.walk)return;let d=u.clientX-c[0],m=u.clientY-c[1],_=Math.hypot(d,m),p=40;_>p&&(d*=p/_,m*=p/_),a.style.transform=`translate(${d}px, ${m}px)`;let g=8,M=Math.abs(d)<g?0:d/p,T=Math.abs(m)<g?0:m/p;this.walk.input.fwd=-T,this.walk.input.strafe=M,this.walk.path=null,this.invalidate()});let h=u=>{u.pointerId===l&&(l=null,this.joyActive=!1,a.style.transform="",this.walk&&(this.walk.input.fwd=0,this.walk.input.strafe=0))};o.addEventListener("pointerup",h),o.addEventListener("pointercancel",h),Kt("minimap").querySelector("canvas").addEventListener("click",u=>{if(!this.walk||!this.mmMap)return;let d=u.currentTarget.getBoundingClientRect(),[m,_]=this.mmMap.invert((u.clientX-d.left)/d.width*336,(u.clientY-d.top)/d.height*336);this.teleport(()=>{this.walk.placeAt(m,_,this.walk.yaw*180/Math.PI,this.walk.level)})});let f=()=>{this.walk&&(this.walk.placeAt(+Kt("wx").value,+Kt("wz").value,+Kt("wh").value,this.walk.level),this.invalidate())};for(let u of["wx","wz","wh"])Kt(u).addEventListener("change",f);Kt("walk-save").addEventListener("click",()=>{if(!this.walk)return;let d=this.planScene.levels[this.walk.level].zones.find(p=>yl(this.walk.x,this.walk.z,p.polyM)),m=prompt("\u05E9\u05DD \u05D4\u05E2\u05DE\u05D3\u05D4",d?d.name:`\u05E2\u05DE\u05D3\u05D4 ${this.savedPositions.length+1}`);if(!m)return;let _=[this.walk.x/(this.planScene.W*this.planScene.scale),this.walk.z/(this.planScene.H*this.planScene.scale)];this.savedPositions.push({id:`wp-${Date.now()}`,name:m,level_id:this.walk.level,x:_[0],y:_[1],heading_deg:Math.round(this.walk.yaw*180/Math.PI),is_default:!1});try{localStorage.setItem(`studio6.positions.${this.plan.id}`,JSON.stringify(this.savedPositions))}catch{}this.buildWalkPanel(),this.toast(`\u05E0\u05E9\u05DE\u05E8\u05D4 \u05D4\u05E2\u05DE\u05D3\u05D4 "${m}"`)}),Kt("walk-exit").addEventListener("click",()=>this.exitWalk()),document.addEventListener("pointerlockchange",()=>{document.pointerLockElement===t&&this.toast("\u05E0\u05E2\u05D9\u05DC\u05EA \u05E1\u05DE\u05DF \u05E4\u05E2\u05D9\u05DC\u05D4 \u2014 Esc \u05DC\u05E9\u05D7\u05E8\u05D5\u05E8")}),window.addEventListener("pointerdown",()=>this.userInput(),!0)}userInput(){this.lastInput=performance.now(),this.mode==="stills"&&this.quality===0&&this.kioskAuto&&(this.kioskAuto=!1,this.exitStills(!0))}ndc(t){let e=this.canvas.getBoundingClientRect();return new tt((t.clientX-e.left)/e.width*2-1,-((t.clientY-e.top)/e.height*2-1))}hoverAt(t){this.raycaster.setFromCamera(this.ndc(t),this.camera);let e=this.planScene.pick(this.raycaster),i=e?e.entity||e.id:null;i!==this.hover&&(this.hover=i,this.canvas.style.cursor=e?"pointer":"",this.invalidate())}clickAt(t,e,i){this.raycaster.setFromCamera(this.mode==="walk"&&!e&&document.pointerLockElement?new tt(0,0):this.ndc(t),this.camera);let n=this.planScene.pick(this.raycaster);if(n&&(this.mode!=="walk"||i||!e||n.distance<3)){this.showPopover(n,t);return}if(this.hidePopover(),this.mode==="walk"){let r=[];this.planScene.root.traverse(l=>{l.userData&&(l.userData.kind==="floor"||l.userData.kind==="static")&&l.visible&&r.push(l)});let o=this.raycaster.intersectObjects(r,!1),a=o.find(l=>l.object.userData.kind==="floor"&&l.face&&l.face.normal.y>.5)||o[0];if(a&&a.object.userData.kind==="floor"){if(a.object.userData.level!==this.walk.level){this.toast("\u05D4\u05E0\u05E7\u05D5\u05D3\u05D4 \u05D1\u05E7\u05D5\u05DE\u05D4 \u05D0\u05D7\u05E8\u05EA \u2014 \u05D4\u05E9\u05EA\u05DE\u05E9 \u05D1\u05DE\u05D3\u05E8\u05D2\u05D5\u05EA");return}this.walk.pathTo(a.point.x,a.point.z)||this.toast("\u05D0\u05D9\u05DF \u05DE\u05E1\u05DC\u05D5\u05DC \u05E4\u05EA\u05D5\u05D7 \u05DC\u05E0\u05E7\u05D5\u05D3\u05D4 (\u05D3\u05DC\u05EA \u05E1\u05D2\u05D5\u05E8\u05D4?)"),this.invalidate()}}}actOnCrosshair(){this.raycaster.setFromCamera(new tt(0,0),this.walkCam);let t=this.planScene.pick(this.raycaster);t&&t.distance<3.5&&this.showPopover(t,{clientX:this.canvas.clientWidth/2+this.stage.getBoundingClientRect().left,clientY:this.canvas.clientHeight/2+this.stage.getBoundingClientRect().top})}showPopover(t,e){this.hidePopover();let i=rt("div","popover"),n=this.stage.getBoundingClientRect();i.style.left=`${Math.min(n.width-230,Math.max(8,e.clientX-n.left-100))}px`,i.style.top=`${Math.min(n.height-140,Math.max(8,e.clientY-n.top+14))}px`;let r=this.plan.entityNames||{},o=t.entity?this.entities[t.entity]:null,a={on:"\u05D3\u05D5\u05DC\u05E7",off:"\u05DB\u05D1\u05D5\u05D9",open:"\u05E4\u05EA\u05D5\u05D7",closed:"\u05E1\u05D2\u05D5\u05E8",locked:"\u05E0\u05E2\u05D5\u05DC",unlocked:"\u05DC\u05D0 \u05E0\u05E2\u05D5\u05DC",playing:"\u05DE\u05E0\u05D2\u05DF",unavailable:"\u05DC\u05D0 \u05D6\u05DE\u05D9\u05DF",undefined:"\u05DC\u05D0 \u05D9\u05D3\u05D5\u05E2",null:"\u05DC\u05D0 \u05D9\u05D3\u05D5\u05E2"};i.appendChild(rt("h4","",t.label||r[t.entity]||t.entity||t.id));let l=rt("div","actions");if(t.kind==="camera"){i.appendChild(rt("div","state",t.online===!1?"\u05DC\u05D0 \u05DE\u05E7\u05D5\u05D5\u05DF \xB7 \u05DE\u05E6\u05D1 \u05D9\u05E9\u05DF":"\u05DE\u05E7\u05D5\u05D5\u05DF"));let h=rt("button","btn sm","\u05E2\u05DE\u05D5\u05D3 \u05D1\u05DE\u05E6\u05DC\u05DE\u05D4");h.addEventListener("click",()=>{this.hidePopover(),this.standAtCamera(this.planScene.cameras.find(f=>f.id===t.id))}),l.appendChild(h)}else if(t.domain==="light"){i.appendChild(rt("div","state",o==="on"?"\u05D3\u05D5\u05DC\u05E7":"\u05DB\u05D1\u05D5\u05D9"));let h=rt("button","btn sm primary",o==="on"?"\u05DB\u05D1\u05D4":"\u05D4\u05D3\u05DC\u05E7");h.addEventListener("click",()=>{this.setEntity(t.entity,o==="on"?"off":"on"),this.hidePopover()}),l.appendChild(h)}else if(t.domain==="door"){let h=t.entity&&!t.entity.startsWith("door:");if(i.appendChild(rt("div","state",h?(o==="on"||o==="open"?"\u05E4\u05EA\u05D5\u05D7\u05D4":"\u05E1\u05D2\u05D5\u05E8\u05D4")+(t.lock?` \xB7 ${a[this.entities[t.lock]]}`:""):"\u05DC\u05DC\u05D0 \u05D7\u05D9\u05D9\u05E9\u05DF \u2014 \u05E2\u05D1\u05D9\u05E8\u05D4 \u05D1\u05E1\u05D9\u05D5\u05E8")),h){let f=rt("button","btn sm primary",o==="on"||o==="open"?"\u05E1\u05D2\u05D5\u05E8 (\u05D3\u05DE\u05D4 \u05D7\u05D9\u05D9\u05E9\u05DF)":"\u05E4\u05EA\u05D7 (\u05D3\u05DE\u05D4 \u05D7\u05D9\u05D9\u05E9\u05DF)");f.addEventListener("click",()=>{this.setEntity(t.entity,o==="on"||o==="open"?"off":"on"),this.hidePopover()}),l.appendChild(f)}if(t.lock){let f=rt("button","btn sm",this.entities[t.lock]==="locked"?"\u05E9\u05D7\u05E8\u05E8 \u05E0\u05E2\u05D9\u05DC\u05D4":"\u05E0\u05E2\u05DC");f.addEventListener("click",()=>{this.setEntity(t.lock,this.entities[t.lock]==="locked"?"unlocked":"locked"),this.hidePopover()}),l.appendChild(f)}}else if(t.kind==="lock"){i.appendChild(rt("div","state",a[o]));let h=rt("button","btn sm primary",o==="locked"?"\u05E9\u05D7\u05E8\u05E8 \u05E0\u05E2\u05D9\u05DC\u05D4":"\u05E0\u05E2\u05DC");h.addEventListener("click",()=>{this.setEntity(t.entity,o==="locked"?"unlocked":"locked"),this.hidePopover()}),l.appendChild(h)}else if(t.domain==="cover"){let h=this.coverPositions[t.entity]??(o==="open"?100:0);i.appendChild(rt("div","state",`${h}% \u05E4\u05EA\u05D5\u05D7`));for(let f of[0,50,100]){let u=rt("button","btn sm",`${f}%`);u.addEventListener("click",()=>{this.coverPositions[t.entity]=f,this.setEntity(t.entity,f>0?"open":"closed"),this.buildStatesPanel(),this.hidePopover()}),l.appendChild(u)}}else if(t.domain==="media_player"){i.appendChild(rt("div","state",a[o]));let h=rt("button","btn sm primary",o==="playing"?"\u05DB\u05D1\u05D4":"\u05D4\u05E4\u05E2\u05DC");h.addEventListener("click",()=>{this.setEntity(t.entity,o==="playing"?"off":"playing"),this.hidePopover()}),l.appendChild(h)}let c=rt("button","btn sm","\u05E1\u05D2\u05D5\u05E8");c.addEventListener("click",()=>this.hidePopover()),l.appendChild(c),i.appendChild(l),this.stage.appendChild(i),this.popover=i}hidePopover(){this.popover&&(this.popover.remove(),this.popover=null)}layoutLabels(){let t=Kt("labels");if(this.mode==="stills"){t.innerHTML="";return}let e=this.canvas.clientWidth,i=this.canvas.clientHeight,n=this.camera;n.updateMatrixWorld();let r=new D,o=document.createDocumentFragment(),a=n.position,l=this.mode==="walk";for(let c of this.planScene.labels){let h=this.planScene.levels[c.level];if(!h||!h.group.visible||l&&c.kind==="room"||!l&&c.kind==="device"&&(!this.hover||this.hover!==c.entity)||l&&c.kind==="device"&&c.pos.distanceTo(a)>4||l&&c.kind==="camera"&&c.pos.distanceTo(a)>9||l&&c.kind==="temp"&&c.pos.distanceTo(a)>7||this.levelMode==="all"&&!l&&c.kind==="temp"&&c.level!==this.plan.doc.levels[this.plan.doc.levels.length-1].id||(r.copy(c.pos),c.offset&&!l&&(r.x+=c.offset),r.project(n),r.z>1||r.z<-1))continue;let f=(r.x+1)/2*e,u=(1-r.y)/2*i;if(f<-40||f>e+40||u<-20||u>i+20)continue;let d=rt("div",`lbl ${c.kind}`);if(c.kind==="device"){let m=this.entities[c.entity],_=this.plan.entityNames||{};d.textContent=`${_[c.entity]||c.entity} \xB7 ${m==="on"?c.entity.startsWith("light.")?"\u05D3\u05D5\u05DC\u05E7":"\u05E4\u05EA\u05D5\u05D7":m==="off"?c.entity.startsWith("light.")?"\u05DB\u05D1\u05D5\u05D9":"\u05E1\u05D2\u05D5\u05E8":m||"\u2014"}`,m==="on"&&c.entity.startsWith("light.")&&d.classList.add("on"),m==="on"&&c.entity.startsWith("binary_sensor.")&&d.classList.add("open")}else d.textContent=c.text;c.kind==="camera"&&c.online===!1&&d.classList.add("off"),d.style.left=`${f}px`,d.style.top=`${u}px`,o.appendChild(d)}t.innerHTML="",t.appendChild(o)}invalidate(t=!0){this.needsFrame=!0,t&&(this.shadowDirty=!0)}frame(t){requestAnimationFrame(o=>this.frame(o));let e=Math.min(.1,(t-(this.lastT||t))/1e3);if(this.lastT=t,this.opts.idleS>0&&this.mode==="orbit"&&this.bakes[this.currentLevelId()]&&t-this.lastInput>this.opts.idleS*1e3&&(this.lastLiveQuality=this.quality,this.kioskAuto=!0,this.quality=0,this.enterStills(),this.renderBar(),this.renderLadder(),this.setNote("\u05E7\u05D9\u05D5\u05E1\u05E7: \u05D7\u05D5\u05E1\u05E8 \u05E4\u05E2\u05D9\u05DC\u05D5\u05EA \u2014 \u05E2\u05D1\u05E8\u05E0\u05D5 \u05DC\u05EA\u05DE\u05D5\u05E0\u05D4 \u05D4\u05DE\u05D5\u05DB\u05E0\u05D4, 0 \u05E4\u05E8\u05D9\u05D9\u05DE\u05D9\u05DD")),this.mode==="stills"){this.updateHud(t,!1);return}let i=!1;if(this.mode==="walk"&&this.walk){this.walk.step(e)&&(i=!0,this.walk.eyeOverride=null);let o=this.walk.eyeOverride!=null?this.walk.eyeOverride:this.walk.eyeY();this.walkCam.position.set(this.walk.x,o,this.walk.z),this.walkCam.rotation.order="YXZ",this.walkCam.rotation.set(this.walk.pitch,this.walk.yaw,0),this.updateWalkBar(),this.mmMap=Jd(Kt("minimap").querySelector("canvas"),this.planScene,this.walk,{bg:document.documentElement.dataset.theme==="dark"?"rgba(21,28,44,.92)":"rgba(255,255,255,.92)"})}else this.controls&&this.controls.update()&&(i=!0);this.planScene.update(e,this.camera.position,{nightFactor:this.env.recipe.night,lampShadows:this.opts.lampShadows&&this.quality>=3})&&(i=!0,this.shadowDirty=!0);let r=this.needsFrame||i||this.continuous||this.probe;if(r){this.needsFrame=!1,(this.shadowDirty||this.probe)&&(this.env.renderer.shadowMap.needsUpdate=!0,this.shadowDirty=!1),this.env.renderer.info.autoReset=!1,this.env.renderer.info.reset();let o=performance.now();this.env.render(this.camera),this.fps.ms=this.fps.ms*.85+(performance.now()-o)*.15,this.layoutLabels(),this.fps.window.push(t),this.probeFrame(t)}this.updateHud(t,r)}updateHud(t,e){let i=this.fps.window;for(;i.length&&i[0]<t-1e3;)i.shift();if(t-this.fps.last<250)return;this.fps.last=t;let n=this.env.renderer.info,r=performance.memory?`${(performance.memory.usedJSHeapSize/1048576).toFixed(0)} MB heap`:"heap n/a",o=this.gpuName||(this.gpuName=this.env.rendererName()),a=/swiftshader|llvmpipe|software/i.test(o),l=this.mode==="stills"?"0 fps (still, no WebGL frames)":i.length?`${i.length} fps \xB7 ${this.fps.ms.toFixed(1)} ms/frame (CPU submit)`:"idle (0 fps \u2014 on-demand)";Kt("hud").innerHTML=`<b>${l}</b><br>draw ${n.render.calls} \xB7 tris ${(n.render.triangles/1e3).toFixed(0)}k \xB7 tex ${n.memory.textures} \xB7 geo ${n.memory.geometries}<br>${r} \xB7 ${this.canvas.width}\xD7${this.canvas.height} @${this.env.dpr.toFixed(2)}\xD7<br>${this.mode} \xB7 ${this.qualityLabel()}${this.probe?" \xB7 measuring\u2026":""}<br><span class="${a?"warn":""}">${a?"\u26A0 software renderer: ":"GPU: "}${o.length>60?o.slice(0,60)+"\u2026":o}</span>`}};window.Studio6App=kl;window.STUDIO6_PLANS=Bl;/noboot/.test(location.search)||window.addEventListener("load",()=>setTimeout(()=>{let s=performance.now();window.studio6=new kl,window.studio6.bootMs=Math.round(performance.now()-s)},30));})();
