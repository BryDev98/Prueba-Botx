const assets={};const mats={};const objects=[];let glowMesh=null;
function add(meshKey,p,s=[1,1,1],mat='stone',r=[0,0,0],em=0,tint=[1,1,1]){objects.push({meshKey,p,s,mat,r,em,tint,model:M4.trs(p,r,s)})}
function addGlowPlane(){
 const p=[-1,-1,0,1,-1,0,1,1,0,-1,-1,0,1,1,0,-1,1,0],n=new Array(18).fill(0);glowMesh=createMesh(p,n);
}
function makeParticleVAO(){const count=1250,pp=[];let seed=9321;const rnd=()=>((seed=(seed*16807)%2147483647)-1)/2147483646;for(let i=0;i<count;i++)pp.push((rnd()-.5)*52,-13+rnd()*34,-74+rnd()*174);const vao=gl.createVertexArray();gl.bindVertexArray(vao);const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(pp),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);gl.bindVertexArray(null);return{vao,count}}
const particles=makeParticleVAO();

async function loadAll(){
 const bootStatus=document.querySelector('.boot__status');
 const modelNames=['column_hero','arch_monument','wall_ruined','altar_dais','brazier','gate_ancient','rift_frame','floor_slab','statue_unranked','statue_sacrifice','statue_judgement','rubble_cluster','player_hunter','boss_custodian','enemy_ash_bailiff','stair_broken','balcony','bridge_ruined','boss_arena','arena_obelisk'];
 let done=0,total=modelNames.length+12;
 const tick=(name)=>{done++;bootStatus.textContent=`Cargando ${name} // ${Math.round(done/total*100)}%`;document.querySelector('.boot__bar span').style.width=`${Math.round(done/total*100)}%`};
 const lowDetail=true;
 for(const n of modelNames){const useLOD=lowDetail&&(n==='statue_unranked'||n==='boss_custodian');const file=useLOD?`${n}_lod`:n;assets[n]=await loadOBJ(`assets/models/${file}.obj`);tick((useLOD?file:n).toUpperCase())}
 const defs={
  stone:{base:[84,84,76],files:'stone',scale:.085,metal:0},bone:{base:[118,111,92],files:'bone',scale:.11,metal:0},iron:{base:[40,37,33],files:'iron',scale:.16,metal:.72},ash:{base:[35,33,31],files:'ash',scale:.12,metal:0}
 };
 for(const [k,d] of Object.entries(defs)){
   const alb=await loadTex(`assets/textures/${d.files}_albedo.png`,d.base);tick(k+' ALBEDO');
   const nor=await loadTex(`assets/textures/${d.files}_normal.png`,[128,128,255]);tick(k+' NORMAL');
   const rough=await loadTex(`assets/textures/${d.files}_roughness.png`,[210,210,210]);tick(k+' ROUGHNESS');
   mats[k]={alb,nor,rough,scale:d.scale,metal:d.metal};
 }
 addGlowPlane();buildScene();
}

function buildScene(){
 for(let z=-66;z<88;z+=3.3){for(let x=-14;x<=14;x+=4.4){const j=(Math.sin(x*1.7+z*.63)+1)*.14;add('floor_slab',[x+(Math.sin(z*.8+x)*.35),-1.8+j,z],[1.05,.55,1.05],'stone',[0,(x+z)*.045,0],0,[.82,.84,.8])}}
 for(const side of [-1,1]){for(let z=-58;z<62;z+=16)add('wall_ruined',[side*20,1.6,z],[1.25,1.35,1.2],'stone',[0,side<0?deg(90):deg(-90),0]);}
 for(const side of [-1,1])for(let z=-54;z<=58;z+=14){add('column_hero',[side*13.8,-1.35,z],[1,1.42,1],'stone',[0,0,0],0,[.9,.9,.85]);if((Math.round((z+54)/14)%2)===0)add('arch_monument',[0,9.2,z],[1.13,1.18,1.12],'stone',[0,0,0],0,[.82,.83,.8]);}
 add('gate_ancient',[0,-1.2,44],[1.25,1.25,1.25],'iron',[0,0,0],0,[.8,.76,.7]);
 add('altar_dais',[0,-1.4,64],[1.25,1.15,1.25],'stone');
 add('statue_unranked',[0,-.8,64],[1.42,1.42,1.42],'bone',[0,deg(180),0],.035,[1.08,1.08,1.02]);
 add('statue_sacrifice',[-10.2,-1.1,35],[.96,.96,.96],'bone',[0,deg(12),0],0,[.82,.80,.72]);
 add('statue_judgement',[10.5,-1.1,35],[.92,.92,.92],'stone',[0,deg(-10),0],0,[.88,.88,.84]);
 add('rift_frame',[0,-1.2,-58],[1.15,1.15,1.15],'stone',[0,0,0],.015,[.8,.82,.82]);
 for(const side of [-1,1])for(const z of [-30,-4,22,48])add('brazier',[side*7,-1.4,z],[.9,.9,.9],'iron');
 for(const side of [-1,1])for(const z of [-46,-16,12,40,72])add('rubble_cluster',[side*(10+Math.sin(z)*2),-1.6,z],[.65,.65,.65],'stone',[0,z*.17,0],0,[.78,.78,.74]);
 add('player_hunter',[0,-1.35,18],[.50,.50,.50],'ash',[0,deg(180),0],0,[.55,.58,.62]);
 add('stair_broken',[0,-1.55,50],[1.08,1.08,1.08],'stone',[0,0,0],0,[.86,.86,.82]);
 add('bridge_ruined',[0,9.4,8],[1.05,1.05,1.05],'stone',[0,deg(90),0],0,[.76,.77,.74]);
 for(const side of [-1,1]){add('balcony',[side*18.2,9.2,18],[.92,.92,.92],'stone',[0,side<0?deg(90):deg(-90),0]);add('balcony',[side*18.2,11.0,48],[.85,.85,.85],'stone',[0,side<0?deg(90):deg(-90),0]);}
 add('boss_arena',[0,-.75,84],[1,1,1],'stone',[0,0,0],0,[.77,.78,.75]);
 for(let i=0;i<8;i++){const a=i*Math.PI/4;add('arena_obelisk',[Math.cos(a)*15.2,-1.0,84+Math.sin(a)*15.2],[.68,.68,.68],'stone',[0,-a,0],.01,[.75,.76,.74]);}
 add('boss_custodian',[0,-.75,84],[.72,.72,.72],'stone',[0,deg(180),0],.018,[.80,.79,.74]);
 add('enemy_ash_bailiff',[-7.8,-1.20,75],[.42,.42,.42],'iron',[0,deg(165),0],.02,[.78,.70,.64]);
}

const cameraPath=[
 {p:[0,6,-77],t:[0,7,-42],f:61},{p:[15,10,-41],t:[0,7,-7],f:55},{p:[-19,12,-3],t:[0,9,26],f:52},{p:[11,8,23],t:[0,13,58],f:48},{p:[-15,11,39],t:[0,13,64],f:45},{p:[17,11,59],t:[0,8,83],f:47},{p:[11,7,18],t:[0,4,43],f:56},{p:[0,13,-12],t:[0,14,64],f:47}
];
let mouse={x:0,y:0},scrollT=0,currentScene=0,explore=false,last=performance.now();let explorePos=[0,4,-48],yaw=0,pitch=0,keys={};
let focusState=null;
let activeRiftColor=[.22,.08,.58];
const focusViews={
 unranked:{p:[11,11,51],t:[0,10.5,64],f:42},
 sacrifice:{p:[-1,6.5,25],t:[-10.2,4.8,35],f:43},
 judgement:{p:[2,7.2,26],t:[10.5,5.0,35],f:43},
 custodian:{p:[13,9,68],t:[0,7.0,84],f:42},
 bailiff:{p:[1,5,66],t:[-7.8,3.4,75],f:43},
 rift:{p:[10,8,-70],t:[0,7.5,-58],f:46}
};
