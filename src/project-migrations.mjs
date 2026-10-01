export const CURRENT_SCHEMA_VERSION = 10;

// Pure migrations: reading a legacy file never writes it or generates random IDs.
const migrations = new Map([[1, project => {
 if (!Array.isArray(project.objects)) throw Error('Некорректный проект');
 const nodes = {}, reserved = new Set(project.objects.map(object => object.id));
 const occupied = new Set([...reserved,...project.objects.flatMap(object => Array.isArray(object.vertices) ? object.vertices.map(vertex => vertex.id).filter(id => id !== undefined) : [])]);
 const objects = project.objects.map((object, objectIndex) => {
  if (object.type !== 'outline' || !Array.isArray(object.vertices)) throw Error('Некорректная геометрия старого проекта');
  const vertexIds = object.vertices.map((vertex, vertexIndex) => {
   let id = vertex.id;
   if (id === undefined) {
    id = `legacy-node-${objectIndex}-${vertexIndex}`;
    while (occupied.has(id)) id += '-n';
    occupied.add(id);
   }
   if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(id) || reserved.has(id)) throw Error('Некорректный ID старого узла');
   if (nodes[id] && (nodes[id].x !== vertex.x || nodes[id].y !== vertex.y)) throw Error('Старый общий узел имеет разные координаты');
   nodes[id] = {...vertex, id};
   return id;
  });
  const {vertices, ...rest} = object;
  return {...rest, vertexIds, shape: 'polygon'};
 });
 return {...project, schemaVersion: 2, nodes, objects, openings: []};
}]]);

export function migrateProject(input) {
 if (!input || !Number.isInteger(input.schemaVersion) || input.schemaVersion < 1 || input.schemaVersion > CURRENT_SCHEMA_VERSION) throw Error('Неподдерживаемая версия проекта');
 let project = input;
 while (project.schemaVersion < 2) {
  const migrate = migrations.get(project.schemaVersion);
  if (!migrate) throw Error('Не найдена миграция проекта');
  project = migrate(project);
 }
 return {...project, openings: project.openings ?? []};
}
