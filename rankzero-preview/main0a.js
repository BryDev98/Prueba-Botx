'use strict';

const canvas = document.getElementById('world');
const gl = canvas.getContext('webgl2', { antialias:true, alpha:false, powerPreference:'high-performance' });
if (!gl) { document.body.classList.add('no-webgl'); throw new Error('WEBGL2_UNAVAILABLE'); }
const DPR = Math.min(window.devicePixelRatio || 1, innerWidth < 760 ? 1.15 : 1.65);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
const vadd=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const vsub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const vmul=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const vlen=a=>Math.hypot(a[0],a[1],a[2]);
const vnorm=a=>{const l=vlen(a)||1;return[a[0]/l,a[1]/l,a[2]/l]};
const vcross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const vdot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const deg=d=>d*Math.PI/180;

const M4={
  identity:()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),
  mul:(a,b)=>{const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o},
  perspective:(fov,asp,n,f)=>{const q=1/Math.tan(fov/2),nf=1/(n-f);return new Float32Array([q/asp,0,0,0,0,q,0,0,0,0,(f+n)*nf,-1,0,0,2*f*n*nf,0])},
  lookAt:(eye,target,up=[0,1,0])=>{const z=vnorm(vsub(eye,target)),x=vnorm(vcross(up,z)),y=vcross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-vdot(x,eye),-vdot(y,eye),-vdot(z,eye),1])},
  trs:(p,r,s)=>{const [x,y,z]=r,cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);const Rx=new Float32Array([1,0,0,0,0,cx,sx,0,0,-sx,cx,0,0,0,0,1]);const Ry=new Float32Array([cy,0,-sy,0,0,1,0,0,sy,0,cy,0,0,0,0,1]);const Rz=new Float32Array([cz,sz,0,0,-sz,cz,0,0,0,0,1,0,0,0,0,1]);const S=new Float32Array([s[0],0,0,0,0,s[1],0,0,0,0,s[2],0,0,0,0,1]);let m=M4.mul(M4.mul(Ry,Rx),Rz);m=M4.mul(m,S);m[12]=p[0];m[13]=p[1];m[14]=p[2];return m}
};

function compile(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))console.error(gl.getShaderInfoLog(s));return s}
function program(vs,fs){const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))console.error(gl.getProgramInfoLog(p));return p}

const VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;layout(location=1) in vec3 aNor;
uniform mat4 uModel,uView,uProj;out vec3 vPos;out vec3 vNor;
void main(){vec4 wp=uModel*vec4(aPos,1.0);vPos=wp.xyz;vNor=normalize(transpose(inverse(mat3(uModel)))*aNor);gl_Position=uProj*uView*wp;}`;
const FS=`#version 300 es
precision highp float;
in vec3 vPos;in vec3 vNor;out vec4 outColor;
uniform sampler2D uAlb,uNorm,uRough;uniform vec3 uTint,uCamera,uRiftColor;uniform float uScale,uEmission,uTime,uFogStart,uFogEnd,uMetal;
vec3 triWeights(vec3 n){vec3 w=pow(abs(n),vec3(6.0));return w/(w.x+w.y+w.z+0.0001);}
vec4 triSample(sampler2D t,vec3 p,vec3 n,float s){vec3 w=triWeights(n);vec4 x=texture(t,p.zy*s);vec4 y=texture(t,p.xz*s);vec4 z=texture(t,p.xy*s);return x*w.x+y*w.y+z*w.z;}
vec3 triNormal(vec3 p,vec3 n,float s){vec3 w=triWeights(n);vec3 nx=texture(uNorm,p.zy*s).xyz*2.0-1.0;vec3 ny=texture(uNorm,p.xz*s).xyz*2.0-1.0;vec3 nz=texture(uNorm,p.xy*s).xyz*2.0-1.0;vec3 wx=normalize(vec3(nx.z,nx.y,nx.x*sign(n.x)));vec3 wy=normalize(vec3(ny.x,ny.z,ny.y*sign(n.y)));vec3 wz=normalize(vec3(nz.x,nz.y,nz.z*sign(n.z)));return normalize(wx*w.x+wy*w.y+wz*w.z+n*1.45);}
void main(){
 vec3 Ng=normalize(vNor);vec3 N=triNormal(vPos,Ng,uScale);vec3 alb=pow(triSample(uAlb,vPos,Ng,uScale).rgb,vec3(2.2))*uTint;float rough=triSample(uRough,vPos,Ng,uScale).r;
 vec3 V=normalize(uCamera-vPos);vec3 key=normalize(vec3(-.42,.86,.28));vec3 fill=normalize(vec3(.56,.2,-.8));
 float nd=max(dot(N,key),0.0);float nd2=max(dot(N,fill),0.0);vec3 H=normalize(key+V);float spec=pow(max(dot(N,H),0.0),mix(52.0,8.0,rough))*(1.0-rough*.8);
 vec3 base=alb*(.08+nd*.82+nd2*.16);
 vec3 riftPos=vec3(0.0,8.0,-56.0);float rd=max(0.0,1.0-distance(vPos,riftPos)/34.0);base+=uRiftColor*rd*rd*(.5+.5*max(dot(N,normalize(riftPos-vPos)),0.0));
 float warm=0.0;vec3 bp[4];bp[0]=vec3(-7.,2.,-26.);bp[1]=vec3(7.,2.,-8.);bp[2]=vec3(-7.,2.,18.);bp[3]=vec3(7.,2.,42.);for(int i=0;i<4;i++){float q=max(0.0,1.0-distance(vPos,bp[i])/18.0);warm+=q*q*max(dot(N,normalize(bp[i]-vPos)),0.0);}base+=vec3(.75,.22,.055)*warm*.62;
 float fres=pow(1.0-max(dot(N,V),0.0),3.0);base+=vec3(.08,.07,.12)*fres;base+=mix(vec3(.04),alb,uMetal)*spec*.55;base+=alb*uEmission*(1.55+.32*sin(uTime*2.4+vPos.y*.7));
 float d=distance(uCamera,vPos);float fog=clamp((d-uFogStart)/(uFogEnd-uFogStart),0.0,1.0);vec3 fogc=vec3(.016,.017,.024);base=mix(base,fogc,fog);
 outColor=vec4(pow(base,vec3(1.0/2.2)),1.0);
}`;
const mainProg=program(VS,FS);
const loc={
 model:gl.getUniformLocation(mainProg,'uModel'),view:gl.getUniformLocation(mainProg,'uView'),proj:gl.getUniformLocation(mainProg,'uProj'),
 alb:gl.getUniformLocation(mainProg,'uAlb'),norm:gl.getUniformLocation(mainProg,'uNorm'),rough:gl.getUniformLocation(mainProg,'uRough'),tint:gl.getUniformLocation(mainProg,'uTint'),cam:gl.getUniformLocation(mainProg,'uCamera'),scale:gl.getUniformLocation(mainProg,'uScale'),em:gl.getUniformLocation(mainProg,'uEmission'),time:gl.getUniformLocation(mainProg,'uTime'),fog0:gl.getUniformLocation(mainProg,'uFogStart'),fog1:gl.getUniformLocation(mainProg,'uFogEnd'),metal:gl.getUniformLocation(mainProg,'uMetal'),rift:gl.getUniformLocation(mainProg,'uRiftColor')
};

