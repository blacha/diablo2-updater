const pino = require('pino');
const { PrettyTransform } = require('pretty-json-log');

const fs = require('fs');
const fetch = require('node-fetch');
const { crc32 } = require('crc');
const path = require('path');

const updatePod = require('./update.pod');
const updatePd2 = require('./update.pd2');

const PathOfDiablo = 'Path of Diablo';
const ProjectD2 = 'ProjectD2';
function getDiabloPath() {
  let diablo2Path = process.env.DIABLO2_PATH;
  if (diablo2Path == null) throw new Error('$DIABLO2_PATH is not set');
  if (diablo2Path.endsWith(path.sep)) diablo2Path = diablo2Path.substr(0, diablo2Path.length - 1);
  if (fs.existsSync(diablo2Path)) return diablo2Path;

  throw new Error('Path does not exist:' + diablo2Path);
}

const Diablo2Path = getDiabloPath();

const log = pino(PrettyTransform.stream());
log.level = 'debug';

async function main() {
  const isPathOfDiablo = Diablo2Path.endsWith(PathOfDiablo);
  const isPd2 = Diablo2Path.endsWith(ProjectD2);
  if (isPathOfDiablo) return updatePod(Diablo2Path, log);
  if (isPd2) return updatePd2(Diablo2Path, log);

  throw new Error('Unknown game type: ' + Diablo2Path);
}

main().catch(console.error);
