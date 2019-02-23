const PTY = require('node-pty'); // eslint-disable-line import/no-extraneous-dependencies
const termios = require('termios'); // eslint-disable-line import/no-extraneous-dependencies
const AnsiParser = require('node-ansiparser'); // eslint-disable-line import/no-extraneous-dependencies
const TiledataTerminal = require('./tiledata-terminal');

module.exports = class Session {
  constructor(rows, cols, ptyData) {
    this.terminal = new TiledataTerminal(cols, rows, cols);
    this.parser = new AnsiParser(this.terminal);

    this.rows = rows;
    this.cols = cols;
    this.ptyData = ptyData;

    this.connected = false;
    this.ptySession = null;

    this.dataBuffer = [];
  }

  connect() {
    const { rows, cols, ptyData: { shell, name, env } } = this;

    this.ptySession = PTY.spawn(shell, [], {
      name, env, rows, cols,
    });

    // disable echo
    // eslint-disable-next-line no-underscore-dangle
    termios.setattr(this.ptySession._fd, { lflag: { ECHO: false } });

    this.ptySession.once('data', () => {
      this.connected = true;
      this.ptySession.emit('ptyConnected');
    });

    this.ptySession.on('data', (data) => {
      this.dataBuffer = [...this.dataBuffer, data];
    });
  }

  close() {
    this.ptySession.kill();
  }

  parseBuffer() {
    // console.log('Parsing buffer with length', this.dataBuffer.length);
    this.dataBuffer.forEach(data => this.parser.parse(data));
    this.dataBuffer = [];
  }

  rawInput(data, wait) {
    return new Promise((resolve) => {
      this.ptySession.write(data);
      setTimeout(() => {
        this.parseBuffer();
        resolve(this.terminal);
      }, wait);
    });
  }

  prepareForInput() {
    this.terminal.waiting = false;
  }
};
