const Session = require('./session');
const NHWindow = require('./nhwindow');

// a short delay to capture all neccessary data
const WAITING_DELAY = 250;

class Client {
  constructor() {
    // why is this hardcoded here :v
    this.baseDimensions = {
      rows: 24,
      cols: 80,
      rowno: 21,
      colno: 80,
    };

    const ptyData = {
      shell: 'bash',
      name: 'xterm-256color',
      env: process.env,
    };

    this.session = new Session(this.baseDimensions.rows, this.baseDimensions.cols, ptyData);
    this.connected = false;
  }

  async start() {
    return new Promise((resolve) => {
      this.session.connect();
      this.session.ptySession.once('ptyConnected', () => {
        this.connected = true;
        resolve();
      });
    });
  }

  disconnect() {
    this.session.close();
  }

  async doANSIInput(data) {
    this.session.prepareForInput();

    const terminal = await this.session.rawInput(data, WAITING_DELAY);
    const ANSIWindow = terminal.getANSICells();

    return ANSIWindow;
  }

  // streamify?
  async doNHInput(data) {
    // only after the game actually started
    const { session, baseDimensions } = this;
    const { coreTTYWindows, NethackWindow } = NHWindow;
    this.session.prepareForInput();
    const term = await session.rawInput(data, WAITING_DELAY);
    const updatedWindows = coreTTYWindows.map((window) => {
      const { id } = window;
      const updatedWindow = new NethackWindow(baseDimensions, id, term.getWindowCells(id), false);
      return updatedWindow;
    });
    return updatedWindows;
  }
}

module.exports = Client;
