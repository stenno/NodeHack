// we monkeypatch AnsiTerminal for vt_tiledata support
// https://nethackwiki.com/wiki/Vt_tiledata
const { AnsiTerminal } = require('node-ansiterminal'); // eslint-disable-line import/no-extraneous-dependencies

const { indexToCoords } = require('./helpers').windowHelpers;

// may or may not be needed later (therefore disabled linter for now)
// eslint-disable-next-line no-unused-vars
const tiledataSpecialFlags = {
  corpse: 0x01,
  invis: 0x02,
  detect: 0x04,
  pet: 0x08,
  ridden: 0x10,
  statue: 0x20,
  objpile: 0x40,
  bw_lava: 0x80,
};

module.exports = class TiledataTerminal extends AnsiTerminal {
  constructor(cols, rows, scrollLength) {
    super(cols, rows, scrollLength);

    this.waiting = false;
    this.currentWindow = 0;
    this.currentGlyph = null;
    this.currentEffect = null;

    // monkeypatch inst_c to handle CSI sequences for vt_tiledata
    this.old_inst_c = this.inst_c;
    this.inst_c = (collected, params, flag) => {
      if (flag === 'z') {
        this.TILE(params);
      } else {
        this.old_inst_c(collected, params, flag);
      }
    };

    this.old_inst_p = this.inst_p;
    // in order to set correct tilesWindow to text, we need to hack up inst_p
    // call the old inst_p for each character of the string
    // TODO: handle encoding properly
    this.inst_p = (str) => {
      [...str].forEach((char) => {
        const oldCell = this.cloneCurrentCell();
        oldCell.tilesWindow = +this.currentWindow;
        oldCell.glyph = this.currentGlyph;
        oldCell.effect = this.currentEffect;
        this.setCurrentCell(oldCell);
        this.old_inst_p(char);
      });
    };

    this.old_inst_e = this.inst_e;
    this.inst_e = (collected, flag) => {
      if (flag === '>' || flag === '=') {
        // do nothing, suppress unhandled warning
      } else {
        this.old_inst_e(collected, flag);
      }
    };
  }

  cloneCurrentCell() {
    const { row, col } = this.cursor;
    const { buffer } = this.screen;
    return buffer[row].cells[col].clone();
  }

  setCurrentCell(cell) {
    const { row, col } = this.cursor;
    this.screen.buffer[row].cells[col] = cell;
  }

  TILE([check, command, arg1, arg2]) {
    if (check !== 1) {
      throw new Error('Unexpected vt_tiledata');
    }
    // monkeypatching intensifies
    this.last_char = '';
    this._rem_c = ''; // eslint-disable-line no-underscore-dangle
    this.wrap = false;
    const handlers = [
      'handleStartGlyph',
      'handleEndGlyph',
      'handleSelectWindow',
      'handleWait',
    ];

    // a bit messy, but i am too lazy to bind the handlers to `this`
    this[handlers[command]](arg1, arg2);
  }

  handleStartGlyph(glyph, effect) {
    this.currentGlyph = +glyph;
    this.currentEffect = +effect;
  }

  handleEndGlyph() {  // eslint-disable-line
    this.currentGlyph = null;
    this.currentEffect = null;
  }

  handleSelectWindow(windowId) {
    const idType = typeof windowId;
    if (idType !== 'number') {
      throw new Error(`handleSelectWindow expected window id of type 'number' but got ${idType}`);
    }
    if (windowId < 0 || windowId > 6) {
      throw new Error(`handleSelectWindow expected window id from 0-6, got ${windowId}`);
    }

    // we ignore window ID of 0 for now
    if (windowId !== 0) {
      this.currentWindow = windowId;
    }
  }

  handleWait() {
    this.waiting = true;
  }

  getWindowCells(windowId) {
    const { cols: colSize, screen: { buffer } } = this;
    const cells = buffer.flatMap(row => row.cells);

    const mappedCells = cells.map((cell, index) => {
      const { row, col } = indexToCoords(index, colSize);
      const {
        c: sym, glyph, effect, tilesWindow,
      } = cell;
      const attributes = cell.getJSONAttributes();
      return ({
        sym, glyph, effect, window: tilesWindow, attributes, row, col,
      });
    });

    return mappedCells.filter(cell => cell.window === windowId);
  }

  getANSICells() {
    const { buffer } = this.screen;
    const cells = buffer.flatMap(row => row.cells.filter(cell => cell.tilesWindow === 0));
    return cells.map((cell) => {
      const attributes = cell.getAttributes();
      return ({
        sym: cell.c, glyph: null, effect: null, tilesWindow: null, attributes,
      });
    });
  }
};
