const fs = require('fs');
const path = require('path');
const util = require('util');
const _ = require('lodash');

const getGlyphRows = rawData => rawData.split('\n').filter(row => row.startsWith('#'));
const readFile = util.promisify(fs.readFile);
// order monsters -> objects -> other
const files = [{
  section: 'monsters',
  filename: 'monsters.txt',
}, {
  section: 'objects',
  filename: 'objects.txt',
}, {
  section: 'other',
  filename: 'other.txt',
}];

const filePaths = files.map(file => path.join(__dirname, file.filename));
const outfile = path.join(__dirname, '../tiles.json');

const readPromise = Promise.all(filePaths.map(filePath => readFile(filePath)));

readPromise.then((rawData) => {
  const glyphRowData = rawData.map(rawFile => getGlyphRows(rawFile.toString()));
  // # tile <nr> (<name>)
  const rowExpr = /^# tile (?<sectionIndex>\d+) \((?<name>(.*?))(?=\))/;
  const fileWithData = _.zipWith(files, glyphRowData, (file, glyphRows) => {
    const parsedRows = glyphRows.map(row => ({
      section: file.section,
      ...(rowExpr.exec(row).groups), // optimistic
    }));
    return parsedRows;
  }).flat();
  const glyphs = fileWithData.map((data, index) => ({ ...data, index }));
  fs.writeFileSync(outfile, JSON.stringify(glyphs));
});
