import type {Point} from './types';

// Internal contracts for future stages; not persisted or exposed by empty UI yet.
export type EntityRef = {id:string};
export type FloorContext = {buildingId:string;floorId:string};
export type Room = EntityRef & FloorContext & {name:string;purpose:string;boundaryWallIds:string[]};
export type Floor = EntityRef & {buildingId:string;name:string;elevation:number;height:number};
export type Variant = EntityRef & {name:string;createdAt:string};
export type ObjectGroup = EntityRef & {name:string;memberIds:string[];anchor:Point;locked:boolean};
export type FileResource = EntityRef & {name:string;mimeType:string;byteLength:number;sha256:string};
export type ModelResource = EntityRef & {resourceId:string;name:string;dimensions:{width:number;depth:number;height:number};anchor:{x:number;y:number;z:number}};
