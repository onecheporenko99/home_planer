// Parametric primitives in world metres/degrees. No screen tessellation in measurements.
export const TAU = 2*Math.PI;
const rad = degrees=>degrees*Math.PI/180;
const deg = radians=>radians*180/Math.PI;
const norm = angle=>((angle%360)+360)%360;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function checkCurve(curve,thickness=0){
 if(!curve||!['arc','circle'].includes(curve.kind)||!curve.center||![curve.center.x,curve.center.y,curve.radius,curve.startAngle,curve.sweepAngle,thickness].every(Number.isFinite))throw Error('Некорректная кривая');
 if(curve.radius<=0||thickness<0||curve.radius-thickness/2<=1e-6)throw Error('Внутренний радиус стены должен быть положительным');
 if(Math.abs(curve.sweepAngle)<1e-6)throw Error('Угол почти нулевой: преобразуйте дугу в прямую');
 if(curve.kind==='arc'&&Math.abs(curve.sweepAngle)>=360-1e-6||curve.kind==='circle'&&Math.abs(Math.abs(curve.sweepAngle)-360)>1e-6)throw Error('Полная окружность — отдельная замкнутая сущность');
 return curve;
}
export function curvePoint(curve,t){const a=rad(curve.startAngle+curve.sweepAngle*t);return{x:curve.center.x+curve.radius*Math.cos(a),y:curve.center.y+curve.radius*Math.sin(a)}}
export const curveLength=curve=>curve.radius*Math.abs(rad(curve.sweepAngle));
export const curveChord=curve=>2*curve.radius*Math.abs(Math.sin(rad(curve.sweepAngle)/2));
export function curveTangent(curve,t){const a=rad(curve.startAngle+curve.sweepAngle*t),sign=Math.sign(curve.sweepAngle);return{x:-Math.sin(a)*sign,y:Math.cos(a)*sign}}
export function curveParameter(curve,point){if(distance(point,curvePoint(curve,0))<1e-8)return 0;if(curve.kind==='arc'&&distance(point,curvePoint(curve,1))<1e-8)return 1;const angle=deg(Math.atan2(point.y-curve.center.y,point.x-curve.center.x));return norm(Math.sign(curve.sweepAngle)*(angle-curve.startAngle))/Math.abs(curve.sweepAngle)}
export function onCurve(curve,point,tolerance=1e-7){return Math.abs(distance(point,curve.center)-curve.radius)<=tolerance&&(curve.kind==='circle'||curveParameter(curve,point)<=1+tolerance)}
export function projectOnCurve(curve,point){
 const d=distance(point,curve.center);if(d<1e-12)return {t:0,point:curvePoint(curve,0)};
 const projected={x:curve.center.x+(point.x-curve.center.x)*curve.radius/d,y:curve.center.y+(point.y-curve.center.y)*curve.radius/d};
 const t=curveParameter(curve,projected);if(curve.kind==='circle'||t<=1)return{t,point:projected};
 const a=curvePoint(curve,0),b=curvePoint(curve,1);return distance(point,a)<=distance(point,b)?{t:0,point:a}:{t:1,point:b};
}
export function curveBounds(curve){const points=[curvePoint(curve,0),curvePoint(curve,1)];for(const a of [0,90,180,270]){const point=curvePoint({...curve,startAngle:a},0);if(onCurve(curve,point))points.push(point)}return {minX:Math.min(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxX:Math.max(...points.map(p=>p.x)),maxY:Math.max(...points.map(p=>p.y))}}
export function offsetCurve(curve,offset,thickness=0){return checkCurve({...curve,radius:curve.radius+offset},thickness)}
export function curveFromThreePoints(a,through,b){
 const d=2*(a.x*(through.y-b.y)+through.x*(b.y-a.y)+b.x*(a.y-through.y));if(Math.abs(d)<1e-10)throw Error('Три точки лежат на одной прямой');
 const aa=a.x*a.x+a.y*a.y,mm=through.x*through.x+through.y*through.y,bb=b.x*b.x+b.y*b.y;
 const center={x:(aa*(through.y-b.y)+mm*(b.y-a.y)+bb*(a.y-through.y))/d,y:(aa*(b.x-through.x)+mm*(a.x-b.x)+bb*(through.x-a.x))/d};
 const startAngle=deg(Math.atan2(a.y-center.y,a.x-center.x)),end=deg(Math.atan2(b.y-center.y,b.x-center.x)),mid=deg(Math.atan2(through.y-center.y,through.x-center.x));
 const sweep=norm(end-startAngle),sweepAngle=norm(mid-startAngle)<=sweep?sweep:sweep-360;
 return checkCurve({kind:'arc',center,radius:distance(a,center),startAngle,sweepAngle});
}
export function curveFromChord(a,b,sweepAngle){
 const chord=distance(a,b);if(chord<1e-6||!Number.isFinite(sweepAngle)||Math.abs(sweepAngle)<1e-6||Math.abs(sweepAngle)>=360-1e-6)throw Error('Несовместимые концы или угол дуги');
 const theta=rad(sweepAngle),radius=chord/(2*Math.abs(Math.sin(theta/2))),h=chord/(2*Math.tan(theta/2));
 const center={x:(a.x+b.x)/2-(b.y-a.y)/chord*h,y:(a.y+b.y)/2+(b.x-a.x)/chord*h};
 return checkCurve({kind:'arc',center,radius,startAngle:deg(Math.atan2(a.y-center.y,a.x-center.x)),sweepAngle});
}
export function curveFromRadius(a,b,radius,side=1,major=false){const chord=distance(a,b);if(!Number.isFinite(radius)||radius<=0||chord>2*radius+1e-9||![1,-1].includes(side))throw Error('Радиус несовместим с хордой');const minor=2*deg(Math.asin(Math.min(1,chord/(2*radius))));return curveFromChord(a,b,side*(major?360-minor:minor))}
export function lineCurveIntersections(a,b,curve,extend=false){
 const dx=b.x-a.x,dy=b.y-a.y,x=a.x-curve.center.x,y=a.y-curve.center.y,A=dx*dx+dy*dy;if(A<1e-12)throw Error('Нулевая прямая');
 const B=2*(x*dx+y*dy),C=x*x+y*y-curve.radius*curve.radius,D=B*B-4*A*C;if(D<-1e-10)return[];
 const roots=Math.abs(D)<=1e-10?[-B/(2*A)]:[(-B-Math.sqrt(D))/(2*A),(-B+Math.sqrt(D))/(2*A)];
 return roots.filter(t=>extend||t>=-1e-9&&t<=1+1e-9).map(t=>({x:a.x+t*dx,y:a.y+t*dy})).filter(p=>onCurve(curve,p));
}
export function curveIntersections(a,b){
 const d=distance(a.center,b.center);if(d<1e-10){if(Math.abs(a.radius-b.radius)<1e-8)throw Error('Совпадающие окружности: бесконечно много пересечений');return[]}
 if(d>a.radius+b.radius+1e-9||d<Math.abs(a.radius-b.radius)-1e-9)return[];
 const x=(a.radius*a.radius-b.radius*b.radius+d*d)/(2*d),h=Math.sqrt(Math.max(0,a.radius*a.radius-x*x)),u={x:(b.center.x-a.center.x)/d,y:(b.center.y-a.center.y)/d};
 const mid={x:a.center.x+x*u.x,y:a.center.y+x*u.y};return (h<1e-9?[mid]:[{x:mid.x-h*u.y,y:mid.y+h*u.x},{x:mid.x+h*u.y,y:mid.y-h*u.x}]).filter(p=>onCurve(a,p)&&onCurve(b,p));
}
export function tangentPoints(curve,point){const d=distance(point,curve.center);if(d<curve.radius-1e-9)return[];const a=Math.atan2(point.y-curve.center.y,point.x-curve.center.x),offset=Math.acos(Math.min(1,curve.radius/d));return [a-offset,a+offset].map(theta=>({x:curve.center.x+curve.radius*Math.cos(theta),y:curve.center.y+curve.radius*Math.sin(theta)})).filter((p,i,all)=>onCurve(curve,p)&&(i===0||distance(p,all[0])>1e-9))}
// Signed contribution to exact Green's-theorem area of a mixed closed contour.
export function curveAreaContribution(curve){const a=rad(curve.startAngle),b=a+rad(curve.sweepAngle),r=curve.radius,c=curve.center;return .5*(r*c.x*(Math.sin(b)-Math.sin(a))-r*c.y*(Math.cos(b)-Math.cos(a))+r*r*(b-a))}
export function splitCurve(curve,t){if(curve.kind==='circle')throw Error('Окружность разделяется с явным выбором начальной метки');if(!Number.isFinite(t)||t<=1e-8||t>=1-1e-8)throw Error('Разделение должно быть внутри дуги');return[{...curve,sweepAngle:curve.sweepAngle*t},{...curve,startAngle:curve.startAngle+curve.sweepAngle*t,sweepAngle:curve.sweepAngle*(1-t)}]}
export function filletGeometry(corner,a,b,radius){
 const la=distance(corner,a),lb=distance(corner,b);if(!Number.isFinite(radius)||radius<=0||Math.min(la,lb)<1e-6)throw Error('Некорректный радиус или нулевой сегмент');
 const u={x:(a.x-corner.x)/la,y:(a.y-corner.y)/la},v={x:(b.x-corner.x)/lb,y:(b.y-corner.y)/lb},theta=Math.acos(Math.max(-1,Math.min(1,u.x*v.x+u.y*v.y)));
 if(theta<1e-6||Math.PI-theta<1e-6)throw Error('Скругление требует ненулевого угла стыка');
 const trim=radius/Math.tan(theta/2);if(trim>=Math.min(la,lb)-1e-6)throw Error('Сегменты слишком короткие для этого радиуса');
 const bisector={x:u.x+v.x,y:u.y+v.y},normB=Math.hypot(bisector.x,bisector.y),centerDistance=radius/Math.sin(theta/2),center={x:corner.x+bisector.x/normB*centerDistance,y:corner.y+bisector.y/normB*centerDistance};
 const start={x:corner.x+u.x*trim,y:corner.y+u.y*trim},end={x:corner.x+v.x*trim,y:corner.y+v.y*trim};
 const startAngle=deg(Math.atan2(start.y-center.y,start.x-center.x)),endAngle=deg(Math.atan2(end.y-center.y,end.x-center.x));let sweepAngle=norm(endAngle-startAngle);if(sweepAngle>180)sweepAngle-=360;
 return {start,end,trim,curve:checkCurve({kind:'arc',center,radius,startAngle,sweepAngle})};
}
export function chamferGeometry(corner,a,b,offsetA,offsetB){const la=distance(corner,a),lb=distance(corner,b);if(![offsetA,offsetB].every(Number.isFinite)||Math.min(offsetA,offsetB)<=0||offsetA>=la-1e-6||offsetB>=lb-1e-6)throw Error('Отступы фаски превышают длины сегментов');return{start:{x:corner.x+(a.x-corner.x)*offsetA/la,y:corner.y+(a.y-corner.y)*offsetA/la},end:{x:corner.x+(b.x-corner.x)*offsetB/lb,y:corner.y+(b.y-corner.y)*offsetB/lb}}}
export function curvePath(curve,t0=0,t1=1,radius=curve.radius){const c={...curve,radius},start=curvePoint(c,t0),sweep=curve.sweepAngle*(t1-t0);if(Math.abs(sweep)>=360-1e-7){const middle=curvePoint(c,(t0+t1)/2);return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 ${sweep>0?1:0} ${middle.x} ${middle.y} A ${radius} ${radius} 0 0 ${sweep>0?1:0} ${start.x} ${start.y}`}const end=curvePoint(c,t1);return`M ${start.x} ${start.y} A ${radius} ${radius} 0 ${Math.abs(sweep)>180?1:0} ${sweep>0?1:0} ${end.x} ${end.y}`}
export function coincidentCurveOverlap(a,b){if(Math.hypot(a.center.x-b.center.x,a.center.y-b.center.y)>1e-6||Math.abs(a.radius-b.radius)>1e-6)return false;const intervals=c=>{const length=Math.abs(c.sweepAngle);if(length>=360-1e-7)return[[0,360]];const start=((c.startAngle+(c.sweepAngle<0?c.sweepAngle:0))%360+360)%360,end=start+length;return end>360?[[start,360],[0,end-360]]:[[start,end]]};return intervals(a).some(x=>intervals(b).some(y=>Math.min(x[1],y[1])-Math.max(x[0],y[0])>1e-7))}
