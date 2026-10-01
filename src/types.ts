export type Appearance={stroke?:string;fill?:string;opacity?:number;screenWidth?:number;dash?:'solid'|'dash'|'dot';hatch?:'none'|'diagonal'|'cross'};
export type WallCurve = {kind:'arc'|'circle';centerId:string;radius:number;startAngle:number;sweepAngle:number};
export type Point = {x:number; y:number};
export type Node = Point & {id:string;name?:string};
export type EdgeLock = {startId:string;endId:string;length?:number;angle?:number};
export type Connection = {nodeId:string;fixtureId:string;portId:string};
export type Layer = {id:string;name:string;visible:boolean;locked:boolean;style?:Appearance};
export type PlanObject = {furnitureSpec?:FurnitureSpec;id:string;style?:Appearance;labelVisible?:boolean;drawingKind?:string;closed?:boolean;text?:string;fontSize?:number;textWidth?:number;textAlign?:'left'|'center'|'right';arrowHead?:'none'|'start'|'end'|'both';attachment?:{targetId:string;origin:Point};detached?:boolean;layerId?:string;curve?:WallCurve; boundaryWallIds?:string[];type:'annotation'|'guide'|'outline'|'plot'|'building'|'wall'|'fixture'|'pipe'|'wire'|'path';name:string;vertexIds:string[];shape?:'rectangle'|'polygon';buildingKind?:'house'|'garage'|'shed'|'gazebo'|'other';buildingId?:string;thickness?:number;height?:number;wallKind?:'external'|'internal';locks?:EdgeLock[];kind?:string;width?:number;depth?:number;rotation?:number;symbolSize?:number;mirror?:boolean;diameter?:number;color?:string;group?:string;material?:string;connections?:Connection[];wallMount?:{wallId:string;offset:number;side:1|-1}};
export type Opening = {id:string;style?:Appearance;labelVisible?:boolean;layerId?:string;type:'door'|'window';name:string;wallId:string;width:number;offset:number;anchor:'start'|'end';height:number;sill?:number;hinge:'start'|'end';side:1|-1;kind:'single'|'double'|'sliding'|'standard'|'panoramic'|'curved'};
export type SnapSettings = {savedGuides?:boolean;locked?:boolean;grid:boolean;nodes:boolean;midpoints:boolean;intersections:boolean;walls:boolean;guides:boolean;extensions:boolean;centers:boolean;angleStep:number;relation:'none'|'parallel'|'perpendicular';tolerance:number;clearTemporary?:number};
export type Project = {floorModel?:FloorModel;variantSnapshot?:true;workspace?:Workspace;notes?:PlanNote[];viewPresets?:VisibilityPreset[];fences?:Fence[];clearanceRules?:ClearanceRule[];groups?:ObjectGroup[];library?:LibraryTemplate[];catalogPreferences?:{favorites:string[];recent:string[]};rooms?:Room[];dimensionChains?:DimensionChain[];resources?:Resource[];underlays?:Underlay[];id:string;name:string;schemaVersion:2|3|4|5|6|7|8|9|10;revision:number;createdAt:string;updatedAt:string;settings:{output?:{reservePercent:number;print:PrintOptions};site?:SiteSettings;measurements?:MeasurementSettings;recentColors?:string[];unit:'m'|'cm'|'mm';grid:number;snap:number;savedViews?:{id:string;name:string;camera:Camera}[]};jointConstraints?:{id:string;wallIds:string[];nodeId:string;angle:number;changedWallId:string}[];layers:Layer[];nodes:Record<string,Node>;objects:PlanObject[];openings:Opening[]};
export type Camera = {x:number;y:number;scale:number;rotation?:number};
export type Tool = 'select'|'hand'|'rectangle'|'polygon'|'wall'|'opening'|'fixture'|'route'|'measure'|'freehand';
export type Creation = {type:'annotation'|'guide'|'plot'|'building'|'wall'|'door'|'window'|'fixture'|'pipe'|'wire'|'path';kind?:string;openingKind?:Opening['kind'];name:string;buildingKind?:PlanObject['buildingKind'];wallKind?:PlanObject['wallKind'];thickness:number};

export type Resource={id:string;name:string;mimeType:string;byteLength:number;sha256:string;width?:number;height?:number};
export type Underlay={id:string;name:string;resourceId:string;sourceId:string;page?:number;x:number;y:number;angle:number;opacity:number;visible:boolean;locked:boolean;scope:'site'|'floor';floorId?:string;layerId:'underlays';metersPerPixel:number;crop:{x:number;y:number;width:number;height:number};calibration?:{a:Point;b:Point;length:number}};

export type RoomBoundary={wallId:string;from:number;to:number};
export type Room={id:string;name:string;purpose:string;fill:string;active:boolean;anchor:Point;labelOffset:Point;boundary:RoomBoundary[];holes:RoomBoundary[][];lastArea?:number};
export type DimensionChain={wallId:string;offset:number;labelOffsets:Point[]};
export type MeasurementSettings={mode:'axis'|'inner'|'outer';showRoomDimensions:boolean;showWallDimensions:boolean;showClearances:boolean;showChains:boolean};

export type FurnitureSpec={shape:'rectangle'|'circle'|'polygon';category:string;anchor:Point;points?:Point[]};
export type ObjectGroup={id:string;name:string;locked:boolean;anchor:Point;memberIds:string[]};
export type LibraryTemplate={id:string;name:string;type:'object'|'set';spec?:FurnitureSpec;width?:number;depth?:number;height?:number;document?:Project};

export type FenceOpening={id:string;name:string;segmentId:string;kind:'swing'|'sliding'|'wicket';width:number;offset:number;side:1|-1;hinge:'start'|'end'};
export type Fence={id:string;name:string;points:Point[];segmentIds:string[];kind:'wood'|'metal'|'mesh'|'masonry';height:number;screenWidth:number;interval:number;lastSpan:'remainder'|'equal';openings:FenceOpening[];posts:{id:string;segmentId:string;offset:number}[];sections:{id:string;segmentId:string;start:number;end:number}[]};
export type ClearanceRule={id:string;objectId:string;side:'front'|'back'|'left'|'right';depth:number};
export type SiteSettings={northAngle:number;northPosition:Point;boundaryOffset:number;minPassage:number;showZones:boolean;intentional:string[]};
export type SiteIssue={key:string;type:string;objectIds:string[];names:string;description:string;points:Point[];intentional:boolean};

export type PlanNote={id:string;text:string;position:Point;offset:Point;objectId?:string;photoIds:string[];createdAt:string};
export type Variant={id:string;name:string;createdAt:string;document:Project;notes:PlanNote[]};
export type Workspace={activeVariantId:string;variants:Variant[]};
export type VisibilityPreset={id:string;name:string;visibility:Record<string,boolean>};
export type SavedVersion={revision:number;label:string|null;createdAt:string};
export type VariantComparison={left:Project;right:Project;added:string[];removed:string[];changed:string[]};

export type FloorRecord={id:string;buildingId:string;name:string;elevation:number;height:number;document:Project;notes:PlanNote[]};
export type Stair={id:string;name:string;buildingId:string;lowerId:string;upperId:string;kind:'straight'|'L'|'U';x:number;y:number;rotation:number;turn:'left'|'right';direction:1|-1;steps:number;riser:number;tread:number;flightWidth:number;landing:number;gap:number;opening:{id:string;enabled:boolean;margin:number}};
export type VerticalLink={id:string;name:string;buildingId:string;lowerId:string;upperId:string;type:'pipe'|'wire';kind:string;fromRouteId:string;toRouteId:string;fromNodeId:string;toNodeId:string;fromOffset:number;toOffset:number;height:number};
export type FloorModel={activeFloorId:string|null;showSite:boolean;traceFloorId:string|null;snapTrace:boolean;site:{document:Project;notes:PlanNote[]};levels:FloorRecord[];stairs:Stair[];verticalLinks:VerticalLink[]};

export type PrintOptions={paper:string;orientation:string;mode:string;scale:number;overflow:string;overlap:number;margin:number;monochrome:boolean;north:boolean;scope:string;views:string[]};
