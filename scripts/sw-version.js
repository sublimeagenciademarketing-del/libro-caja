// Escribe una versión nueva en public/sw.js en cada build, así los teléfonos
// con el app abierto se recargan solos después de cada despliegue.
const fs = require('fs');
const path = require('path');

const archivo = path.join(__dirname, '..', 'public', 'sw.js');
const version = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15); // 20260915T1830Z
const contenido = fs.readFileSync(archivo, 'utf8');
const nuevo = contenido.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`);

if (nuevo === contenido) {
  console.error('sw-version: no se encontró la línea VERSION en public/sw.js');
  process.exit(1);
}
fs.writeFileSync(archivo, nuevo);
console.log(`sw-version: ${version}`);
