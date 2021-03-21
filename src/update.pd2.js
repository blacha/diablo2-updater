const fs = require('fs');
const fetch = require('node-fetch');
const crypto = require('crypto');
const path = require('path');
const plimit = require('p-limit');

const Q = plimit(5);

const SkipFiles = new Set(['UI.ini', 'default.filter', 'ddraw.ini', 'ProjectDiablo.cfg']);
module.exports = async function updatePd2(diablo2Path, log) {
  log.info('FileList:Fetch');
  const res = await fetch('https://storage.googleapis.com/storage/v1/b/pd2-client-files/o');
  if (!res.ok) {
    log.error({ status: res.status, description: res.statusDescription }, 'Failed to fetch files');
    return;
  }

  const data = await res.json();
  log.info({ bytes: data.items.length }, 'FileList:Fetch:Done');

  const todo = data.items.map((file) => {
    return Q(async () => {
      const fileName = file.name;
      const currentHash = file.md5Hash;
      const targetFile = path.join(diablo2Path, fileName);

      const currentFileBytes = await fs.promises.readFile(targetFile);
      const expectedHash = crypto.createHash('md5').update(currentFileBytes).digest('base64');
      if (expectedHash === currentHash) return;
      if (SkipFiles.has(fileName)) return;

      log.debug({ fileName, currentHash, expectedHash, link: file.selfLink }, 'File:Update');
      const fileRes = await fetch(file.mediaLink);
      if (!fileRes.ok) {
        log.error('File:Update:Failed');
        return;
      }
      const newFileBuffer = await fileRes.buffer();
      const newHash = crypto.createHash('md5').update(newFileBuffer).digest('base64');
      if (newHash !== expectedHash) {
        log.error({ fileName, expectedHash, newHash }, 'File:Update:Failed-Md5');
        return;
      }
      await fs.promises.writeFile(targetFile, newFileBuffer);
      log.info({ fileName, newHash }, 'Updated');
    });
  });

  await Promise.all(todo);
};
