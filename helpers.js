module.exports.windowHelpers = {
  indexToCoords: (index, colsize) => ({
    row: Math.floor(index / colsize),
    col: index % colsize,
  }),
  coordsToIndex: (row, col, colsize) => row * colsize + col,
};
