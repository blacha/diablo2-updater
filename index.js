const pino = require('pino');
const { PrettyTransform } = require('pretty-json-log');

const fs = require('fs');
const path = require('path')
const fetch = require('node-fetch');
const { crc32 } = require('crc');

const D2Path = path.resolve(path.join(__dirname, '../DiabloII'));
const PodPath = path.join(D2Path, 'Path of Diablo');

const FileSkip = new Set(['ddraw.dll'])

const log = pino(PrettyTransform.stream());
log.level = 'debug';

function extractKeyValue(text, key) {
    const keyText = `${key}="`;
    const keyStart = text.indexOf(keyText) + keyText.length;
    const keyEnd = text.indexOf('"', keyStart)
    return text.slice(keyStart, keyEnd)
}
async function main() {
    if (!fs.existsSync(PodPath)) {
        log.error({ path: PodPath }, 'Failed to find PoD');
        return;
    }
    log.info('FileList:Fetch')
    const res = await fetch('https://raw.githubusercontent.com/GreenDude120/PoD-Launcher/master/files.xml');
    if (!res.ok) {
        log.error({ status: res.status, desciption: res.statusDescription }, 'Failed to fetch files')
        return;
    }

    const data = await res.text();
    log.info({ bytes: data.length }, 'FileList:Fetch:Done');
    const lines = data.split('\n').map(c => c.trim());
    const files = lines.filter(f => f.startsWith('<file') && f.includes('crc'));
    const links = lines.filter(f => f.startsWith('<link')).map(c => c.replace('<link>', '').replace('</link>', '').replace(/%20/g, ' '))
    
    for (const file of files) {
        const fileName = extractKeyValue(file, 'name');
        const expectedCrc = extractKeyValue(file, 'crc').toLowerCase();
        const downloadLinks = links.find(f => f.endsWith(fileName));
   
        const targetFile = path.join(PodPath, fileName);
        if (!fs.existsSync(targetFile)) {
            log.warn({ fileName }, 'File:Missing')
            await updateFile(fileName)
        }
        const currentCrc = crc32(fs.readFileSync(targetFile)).toString(16);
        if (currentCrc == expectedCrc) {
            log.trace({ fileName, currentCrc }, 'File:Current')
            continue;
        }

        if (FileSkip.has(fileName)) {
            log.debug({ fileName, currentCrc, expectedCrc }, 'File:Skipped')
            continue;

        }

        log.info({ fileName, currentCrc, expectedCrc, }, 'File:Update')
        const fileRes = await fetch(downloadLinks)
        if (!fileRes.ok) {
            log.error('File:Update:Failed');
            continue;
        }
        const newFileBuffer = await fileRes.buffer()
        const newCrc = crc32(newFileBuffer).toString(16)
        if (newCrc !== expectedCrc) {
            log.error({ fileName, newCrc, expectedCrc,newCrc},'File:Update:Failed-Crc');
            continue;
        }
        fs.writeFileSync(targetFile, newFileBuffer)
    }
}

main().catch(console.error)