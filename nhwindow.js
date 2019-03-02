const _ = require('lodash'); // eslint-disable-line import/no-extraneous-dependencies
const stripAnsi = require('strip-ansi'); // eslint-disable-line import/no-extraneous-dependencies

const { indexToCoords } = require('./helpers').windowHelpers;

const windowIds = {
  NHW_NONE: 0, // ansi mode
  NHW_MESSAGE: 1,
  NHW_STATUS: 2,
  NHW_MAP: 3,
  NHW_MENU: 4,
  NHW_TEXT: 5,
  NHW_BASE: 6,
};

// const coordsToIndex = (row, col, colsize) => row * colsize + col;

// see https://github.com/NetHack/NetHack/blob/NetHack-3.6.2-beta01/win/tty/wintty.c tty_create_nhwindow
// 0 means full width/height in the original sources...
// the resize function should be called when creating a new NethackWindow
// as the base dimensions depend on absolute window size
// this should allow us to react to window resizing properly, this isn't tested yet though

const coreTTYWindows = [{
  name: 'none',
  internalName: 'NHW_NONE',
  id: windowIds.NHW_NONE,
  description: 'raw ANSI',
  resize: (baseDimensions) => {
    const { rows, cols } = baseDimensions;
    const offset = { row: 0, col: 0 };
    return ({
      rows, cols, maxRows: 0, maxCols: 0, offset,
    });
  },
}, {
  name: 'message',
  internalName: 'NHW_MESSAGE',
  id: windowIds.NHW_MESSAGE,
  description: 'Message window, 1 line long, very wide, top of screen',
  resize: () => ({
    rows: 20, cols: 0, maxRows: 0, maxCols: 0, offset: { row: 0, col: 0 },
  }),
}, {
  name: 'status',
  internalName: 'NHW_STATUS',
  id: windowIds.NHW_STATUS,
  description: 'Status window, 2 lines long, full width, bottom of screen',

  resize: (baseDimensions) => {
    const { rows, cols } = baseDimensions;
    return ({
      rows: 2, cols, maxRows: 2, maxCols: cols, offset: { row: rows - 2, col: 0 },
    });
  },
}, {
  name: 'map',
  internalName: 'NHW_MAP',
  id: windowIds.NHW_MAP,
  description: 'Map window, ROWNO lines long, full width, below message window',
  resize: (baseDimensions) => {
    const { rowno, colno } = baseDimensions;
    return ({
      rows: rowno, cols: colno, maxRows: 0, maxCols: 0, offset: { row: 1, col: 0 },
    });
  },

}, {
  name: 'menu',
  internalName: 'NHW_MENU',
  id: windowIds.NHW_MENU,
  description: 'Inventory/menu window, variable length, full width, top of screen',
  resize: (baseDimensions) => {
    const { cols } = baseDimensions;
    return ({
      rows: 0, cols, maxRows: 0, maxCols: 0, offset: { row: 0, col: 0 },
    });
  },
}, {
  name: 'text',
  internalName: 'NHW_TEXT',
  id: windowIds.NHW_TEXT,
  description: 'Help window, the same, different semantics for display, etc',
  resize: (baseDimensions) => {
    const { cols } = baseDimensions;
    return ({
      rows: 0, cols, maxRows: 0, maxCols: 0, offset: { row: 0, col: 0 },
    });
  },

}, {
  name: 'base',
  internalName: 'NHW_BASE',
  id: windowIds.NHW_BASE,
  description: 'Base window, used for absolute movement on the screen',
  resize: (baseDimensions) => {
    const { rows, cols } = baseDimensions;
    return ({
      rows, cols, maxRows: 0, maxCols: 0, offset: { row: 0, col: 0 },
    });
  },
},
];

class NethackWindow {
  constructor(baseDimensions, coreWindowId, data, normalized = true) {
    const { id, name, resize } = coreTTYWindows.find(window => window.id === coreWindowId);
    this.id = id;
    this.name = name;
    // lets strip ansi from any data thing
    if (data.length > 0) {
      this.data = data.map(cell => ({ ...cell, sym: stripAnsi(cell.sym) }));
    } else {
      this.data = [];
    }

    this.normalized = normalized;

    this.dimensions = resize(baseDimensions);
    this.baseDimensions = baseDimensions;
  }

  sanitizeDimensions() {
    const {
      data, dimensions: { offset, rows, cols },
    } = this;
    const maxColsize = (data.length > 0)
      ? ((Math.max(...data.map(cell => cell.col + 1))) - offset.col)
      : this.baseDimensions.cols;
    const maxRowsize = (data.length > 0)
      ? ((Math.max(...data.map(cell => cell.row + 1))) - offset.row)
      : this.baseDimensions.rows;

    const fullCols = (cols === 0) ? maxColsize : cols;
    const fullRows = (rows === 0) ? maxRowsize : rows;

    return ({
      rows: fullRows,
      cols: fullCols,
    });
  }

  static getCoreWindow(id) {
    const coreWindow = coreTTYWindows.find(window => window.id === id);
    if (typeof coreWindow === 'undefined') {
      throw new Error(`Could not find core window with id ${id}`);
    }
    return coreWindow;
  }

  static getCoreWindowByName(name) {
    const coreWindow = coreTTYWindows.find(window => window.name === name);
    if (typeof coreWindow === 'undefined') {
      throw new Error(`Could not find core window with name ${name}`);
    }
    return coreWindow;
  }

  static createEmptyCell({ row, col }) {
    return ({
      row, col, glyph: null, sym: '',
    });
  }

  emptyWindow() {
    const { rows: fullRows, cols: fullCols } = this.sanitizeDimensions();

    const length = fullCols * fullRows;

    const emptyWindow = Array.from({ length }, (el, index) => {
      const row = Math.floor(index / fullCols);
      const col = index % fullCols;
      return NethackWindow.createEmptyCell({ row, col });
    });

    return emptyWindow;
  }

  normalizedData() {
    const { data, dimensions: { offset: { row: rowOffset, col: colOffset } } } = this;
    if (data.length === 0) {
      return [];
    }
    const offsetData = data.map((cell) => {
      const { row, col } = cell;
      return ({ ...cell, row: row - rowOffset, col: col - colOffset });
    });

    return offsetData;
  }

  normalizedDataWindow() {
    const { normalized, dimensions: { rows, cols } } = this;

    const { rows: fullRows, cols: fullCols } = this.sanitizeDimensions({ rows, cols });
    const length = fullCols * fullRows;
    const updates = normalized ? this.data : this.normalizedData();
    // can't use _.zip here yet
    return Array.from({ length }, (el, index) => {
      const { row, col } = indexToCoords(index, fullCols);
      const update = updates.find(cell => cell.row === row && cell.col === col);
      if (typeof update !== 'undefined') {
        return update;
      }
      return NethackWindow.createEmptyCell({ row, col });
    });
  }

  chunkedWindow() {
    const { normalized, dimensions: { rows, cols } } = this;
    const { cols: fullCols } = this.sanitizeDimensions({ rows, cols });
    const window = normalized ? this.data : this.normalizedDataWindow();
    return _.chunk(window, fullCols);
  }

  applyUpdate(oldWindow) {
    // oldWindow should be same size as we
    // our data is expected to be normalized
    const windowUpdates = this.data;
    const oldWindowData = oldWindow.data;

    const [{ length: oldLength }, { length: updatesLength }] = [oldWindowData, windowUpdates];
    if (oldLength !== updatesLength) {
      throw new Error(`applyUpdate expected window length to be ${updatesLength} but got ${oldLength}`);
    }
    const updatedWindow = _.zipWith(windowUpdates, oldWindowData, (updateCell, oldCell) => {
      if (updateCell.sym !== '') {
        return updateCell;
      }
      return oldCell;
    });
    return updatedWindow;
  }

  toString(emptySymbol = '') {
    const dataWindow = this.data;

    const rowStrings = dataWindow.map(cell => cell.sym.padStart(1, emptySymbol)).join('');
    return rowStrings;
  }

  // lazy
  toChunkedString(emptySymbol = '') {
    const dataWindow = this.chunkedWindow();
    const window = dataWindow.map(row => row.map(cell => cell.sym.padStart(1, emptySymbol)).join('')).join('\n');
    return window;
  }
}

module.exports = {
  windowIds,
  coreTTYWindows,
  NethackWindow,
};
