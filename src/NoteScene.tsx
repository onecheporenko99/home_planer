import {notePoint} from './workspace.mjs';
import type {Project} from './types';
export function NoteScene({project,scale}:{project:Project;scale:number}){if(project.layers.find(l=>l.id==='notes')?.visible===false)return null;return <g pointerEvents="none">{project.notes?.map((n,i)=>{const q=notePoint(project,n);return <g key={n.id}><circle cx={q.x} cy={q.y} r={9/scale} fill="#8b69b5" stroke="white" strokeWidth={1/scale}/><text x={q.x} y={q.y+4/scale} textAnchor="middle" fill="white" fontSize={11/scale}>{i+1}</text><title>{n.text}</title></g>})}</g>}
