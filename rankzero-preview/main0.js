'use strict';

const canvas = document.getElementById('world');
const gl = canvas.getContext('webgl2', { antialias:true, alpha:false, powerPreference:'high-performance' });
if (!gl) { document.body.classList.add('no-webgl'); return; }
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

const GVS=`#version 300 es
precision highp float;layout(location=0) in vec3 aPos;uniform mat4 uModel,uView,uProj;uniform float uTime;out float vA;void main(){vec3 lp=aPos;lp.x+=sin(uTime*2.1+lp.y*2.7)*.08;vec4 wp=uModel*vec4(lp,1.);gl_Position=uProj*uView*wp;float d=length(lp.xy);vA=1.0-smoothstep(.55,1.35,d);}`;
const GFS=`#version 300 es
precision highp float;in float vA;out vec4 outColor;uniform float uTime;uniform vec3 uGlowColor;void main(){vec3 c=mix(uGlowColor*.45,uGlowColor*1.8,.5+.5*sin(uTime*2.2));outColor=vec4(c,.11+.22*vA);}`;
const glowProg=program(GVS,GFS);const gloc={model:gl.getUniformLocation(glowProg,'uModel'),view:gl.getUniformLocation(glowProg,'uView'),proj:gl.getUniformLocation(glowProg,'uProj'),time:gl.getUniformLocation(glowProg,'uTime'),color:gl.getUniformLocation(glowProg,'uGlowColor')};

const PVS=`#version 300 es
precision highp float;layout(location=0) in vec3 aPos;uniform mat4 uView,uProj;uniform float uTime;out float life;void main(){vec3 p=aPos;p.y+=mod(uTime*.42+aPos.x*2.7+aPos.z*1.9,10.);p.x+=sin(uTime*.4+aPos.y)*.32;life=fract((p.y+20.)*.09);gl_Position=uProj*uView*vec4(p,1.);gl_PointSize=1.2+life*3.2;}`;
const PFS=`#version 300 es
precision highp float;in float life;out vec4 outColor;void main(){vec2 q=gl_PointCoord-.5;if(dot(q,q)>.25)discard;outColor=vec4(mix(vec3(.24,.21,.34),vec3(.76,.70,.96),life),.12+.45*life);}`;
const partProg=program(PVS,PFS),ploc={view:gl.getUniformLocation(partProg,'uView'),proj:gl.getUniformLocation(partProg,'uProj'),time:gl.getUniformLocation(partProg,'uTime')};

function createMesh(vertices,normals){
 const vao=gl.createVertexArray();gl.bindVertexArray(vao);
 const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
 const nb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,nb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(normals),gl.STATIC_DRAW);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,0,0);
 gl.bindVertexArray(null);return{vao,count:vertices.length/3};
}
function parseOBJ(text){
 const pos=[[0,0,0]],nor=[[0,1,0]],outP=[],outN=[];
 const lines=text.split(/\r?\n/);
 for(const line of lines){const t=line.trim();if(!t||t[0]==='#')continue;const p=t.split(/\s+/);if(p[0]==='v')pos.push([+p[1],+p[2],+p[3]]);else if(p[0]==='vn')nor.push([+p[1],+p[2],+p[3]]);else if(p[0]==='f'){
   const verts=p.slice(1).map(x=>{const q=x.split('/');return{v:parseInt(q[0]),n:q[2]?parseInt(q[2]):0}});
   for(let k=1;k<verts.length-1;k++){const tri=[verts[0],verts[k],verts[k+1]];let faceN=null;if(!tri[0].n||!tri[1].n||!tri[2].n){const A=pos[tri[0].v],B=pos[tri[1].v],C=pos[tri[2].v];faceN=vnorm(vcross(vsub(B,A),vsub(C,A)));}for(const q of tri){outP.push(...pos[q.v]);outN.push(...(q.n?nor[q.n]:faceN));}}
 }}
 return createMesh(outP,outN);
}
let rzPackPromise=null,rzMeta=null,rzData=null,rzMeshes={};
async function initRZPack(){
 if(rzPackPromise)return rzPackPromise;
 rzPackPromise=(async()=>{const b64=(window.RZ_PACK_PARTS||[]).join('');const bin=atob(b64);const u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);if(!('DecompressionStream'in window))throw new Error('GZIP_UNSUPPORTED');const ds=new DecompressionStream('gzip');const ab=await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer();const dv=new DataView(ab);const hlen=dv.getUint32(0,true);rzMeta=JSON.parse(new TextDecoder().decode(new Uint8Array(ab,4,hlen)));rzData={ab,base:4+hlen,map:Object.fromEntries(rzMeta.map(x=>[x.name,x]))};return true})();
 return rzPackPromise;
}
async function loadOBJ(url){
 await initRZPack();let name=url.split('/').pop().replace('.obj','');if(!rzData.map[name]){if(name==='statue_unranked')name='statue_unranked_lod';if(name==='boss_custodian')name='boss_custodian_lod'}if(rzMeshes[name])return rzMeshes[name];const m=rzData.map[name];if(!m)throw new Error(name);const dv=new DataView(rzData.ab,rzData.base+m.off,m.vbytes+m.fbytes);const pos=[];for(let i=0;i<m.nv;i++){const qx=dv.getUint16(i*6,true),qy=dv.getUint16(i*6+2,true),qz=dv.getUint16(i*6+4,true);pos.push([m.mn[0]+m.sc[0]*qx/65535,m.mn[1]+m.sc[1]*qy/65535,m.mn[2]+m.sc[2]*qz/65535])}const outP=[],outN=[];let fo=m.vbytes;for(let i=0;i<m.nf;i++){const ia=dv.getUint32(fo+i*12,true),ib=dv.getUint32(fo+i*12+4,true),ic=dv.getUint32(fo+i*12+8,true),A=pos[ia],B=pos[ib],C=pos[ic],N=vnorm(vcross(vsub(B,A),vsub(C,A)));outP.push(...A,...B,...C);outN.push(...N,...N,...N)}return rzMeshes[name]=createMesh(outP,outN);
}
function loadTex(url,fallback){
 const S=64,pix=new Uint8Array(S*S*4),isN=url.includes('_normal'),isR=url.includes('_roughness');let seed=2166136261;for(const c of url)seed=(seed^c.charCodeAt(0))*16777619>>>0;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)&65535)/65535;for(let y=0;y<S;y++)for(let x=0;x<S;x++){const i=(y*S+x)*4,n=.72+.28*(rnd()*.55+.45*Math.sin(x*.33+y*.21)*.5+.22);if(isN){pix[i]=128+(rnd()-.5)*24;pix[i+1]=128+(rnd()-.5)*24;pix[i+2]=245}else if(isR){const q=175+Math.floor(rnd()*70);pix[i]=pix[i+1]=pix[i+2]=q}else{pix[i]=Math.min(255,fallback[0]*n);pix[i+1]=Math.min(255,fallback[1]*n);pix[i+2]=Math.min(255,fallback[2]*n)}pix[i+3]=255}const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,S,S,0,gl.RGBA,gl.UNSIGNED_BYTE,pix);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);return Promise.resolve(t)
}

