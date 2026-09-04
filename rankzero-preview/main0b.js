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
