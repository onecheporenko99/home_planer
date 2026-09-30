// No project commands run until a single-finger tap/drag is disambiguated.
export function createTouchState(){return {points:new Map(),pending:null,multi:false,baseline:null,drag:false};}
const pair=s=>[...s.points.values()].slice(0,2);
const center=([a,b])=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const span=([a,b])=>Math.hypot(a.x-b.x,a.y-b.y);
export function touchStart(s,id,p,camera){s.points.set(id,p);if(s.points.size===1&&!s.multi){s.pending=p;s.drag=false;return 'pending'}s.multi=true;s.pending=null;s.drag=false;if(s.points.size>=2){const ps=pair(s);s.baseline={camera:{...camera},center:center(ps),span:Math.max(1,span(ps))}}return 'cancel-edit';}
export function touchMove(s,id,p){
 if(!s.points.has(id))return null;s.points.set(id,p);
 if(!s.multi)return s.pending&&Math.hypot(p.x-s.pending.x,p.y-s.pending.y)>5?'drag':null;
 if(s.points.size<2||!s.baseline)return null;
 const ps=pair(s),mid=center(ps),b=s.baseline,c=b.camera,scale=Math.max(3,Math.min(400,c.scale*span(ps)/b.span));
 return {scale,x:mid.x-(b.center.x-c.x)/c.scale*scale,y:mid.y-(b.center.y-c.y)/c.scale*scale};
}
export function touchEnd(s,id,camera,cancel=false){
 const multi=s.multi;s.points.delete(id);
 if(multi&&s.points.size>=2){const ps=pair(s);s.baseline={camera:{...camera},center:center(ps),span:Math.max(1,span(ps))}}
 const result=multi||cancel?'cancel':s.drag?'finish':'tap';
 if(!s.points.size){s.multi=false;s.baseline=null;s.pending=null;s.drag=false}
 return result;
}
