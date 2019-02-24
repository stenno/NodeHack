const { EventEmitter } = require('events');

const Client = require('./client');
const { NethackWindow, windowIds } = require('./nhwindow');
const { servers } = require('./config');
const Character = require('./character');

module.exports = class NethackSession extends EventEmitter {
  constructor() {
    super();
    this.client = new Client();
    this.windows = [];
    this.connected = false;
    this.messages = [];
    this.dungeonMap = null;
    this.currentText = '';
    this.character = null;
    this.statusBar = {};
  }

  async loginSSH(serverName, dglUsername, dglPassword) {
    const { client } = this;
    try {
      client.start();
    } catch ({ message }) {
      throw new Error(`Could not initialize PTY session: ${message}`);
    }

    // TODO sanity checks
    const { sshHost, dglStartGame } = servers[serverName];

    try {
      // connect  to server
      await client.doANSIInput(`ssh ${sshHost}\n`);
    } catch ({ message }) {
      throw new Error(`Could not connect to ${sshHost}: ${message}`);
    }

    try {
      // choose option l)ogin
      // enter DGL usename
      // enter DGL password
      await client.doANSIInput('l');
      await client.doANSIInput(`${dglUsername}\n`);
      await client.doANSIInput(`${dglPassword}\n`);

      await client.doANSIInput(dglStartGame);
    } catch ({ message }) {
      throw new Error(`Could not login: ${message}`);
    }

    try {
      // character pick here?
      // we are now 'in the game', first true input
      this.character = new Character(dglUsername);
      this.windows = await client.doNHInput('  ');
      this.connected = true;
      this.update();
    } catch ({ message }) {
      throw new Error(`Could not start game: ${message}`);
    }

    this.emit('connected');
  }

  getRawWindow(name) {
    const window = this.windows.find(win => win.name === name);
    if (typeof window === 'undefined') {
      throw new Error(`Could not find window with name ${name}`);
    }
    return window;
  }

  getWindow(name) {
    const coreWindow = NethackWindow.getCoreWindowByName(name);
    const rawBaseWindow = this.getRawWindow(name);
    const { baseDimensions } = this.client;
    const resizedDimensions = coreWindow.resize(baseDimensions);
    const normalizedDataWindow = rawBaseWindow.normalizedDataWindow();
    return new NethackWindow(resizedDimensions, rawBaseWindow.id, normalizedDataWindow);
  }

  getANSIWindow() {
    // ANSI data doesn't need to get normalized
    return this.getRawWindow('none');
  }

  getBaseWindow() {
    return this.getWindow('base');
  }

  getMessageWindow() {
    return this.getWindow('message');
  }

  getStatusWindow() {
    return this.getWindow('status');
  }

  getMapWindow() {
    return this.getWindow('map');
  }

  getTextWindow() {
    return this.getWindow('text');
  }

  getMenuWindow() {
    return this.getWindow('menu');
  }

  updateMessages() {
    const window = this.getMessageWindow();
    this.messages = [...this.messages, window.toString('')];
    this.emit('updatedMessages', this.messages.slice(-1));
  }

  updateText() {
    // do nothing for now
    this.emit('updatedText');
  }

  updateMap() {
    // normalized
    const window = this.getMapWindow();

    if (this.dungeonMap === null) {
      this.dungeonMap = window; // initialize
    } else {
      const updateData = window.applyUpdate(this.dungeonMap);
      // we should definetely not use the hardcoded values here...
      this.dungeonMap = new NethackWindow({
        rows: 24, cols: 80, rowno: 21, colno: 80,
      }, windowIds.NHW_MAP, updateData);
    }
    this.emit('updatedMap', this.dungeonMap);
  }

  updateStatusBar() {
    const window = this.getStatusWindow();
    const statusBar = window.toString(' ');

    if (statusBar.trim() === '') {
      // no update here, so we just return the old statusBar
      this.emit('statusBarUpdated', this.statusBar);
      return;
    }

    // Nodehack the Stripling \
    // St:16 Dx:13 Co:17 In:8 Wi:13 Ch:8 Lawful lvl:1 $:0 HP:16(16) Pw:2(2) AC:6 Xp:1 T:1

    const { name } = this.character;

    // thanks to named capture groups we can be modular with our 'parsers'
    // later, we can inject user-defined regexps
    // we rely 'a bit' on names not containing ':'...

    // player name the role title St: ...
    const titleRegexp = new RegExp(`^${name} the (?<title>(.*?))(?=( *St:))`, 'i');
    const { title } = titleRegexp.exec(statusBar).groups;

    const attributeExpressions = [
      /St:(?<strength>\d+(\/\d+)?)/,
      /Dx:(?<dexterity>\d+)/,
      /Co:(?<constitution>\d+)/,
      /In:(?<intelligence>\d+)/,
      /Wi:(?<wisdom>\d+)/,
      /Ch:(?<charisma>\d+)/,
    ];

    const attributes = attributeExpressions.reduce((attrs, re) => ({
      ...attrs, ...(re.exec(statusBar).groups),
    }), {});

    // the word that is followed by Ch: xx
    const alignmentExpression = /(?<=Ch:(\d+)( *?))(?<alignment>\w+)/;
    const { alignment } = alignmentExpression.exec(statusBar).groups;

    const dungeonLevelExpression = /lvl:(?<dungeonLevel>\d+)/;
    const { dungeonLevel } = dungeonLevelExpression.exec(statusBar).groups;

    const goldExpression = /\$:(?<gold>\d+)/;
    const { gold } = goldExpression.exec(statusBar).groups;

    const hpExpression = /HP:(?<hp>-?\d+)\((?<maxHP>-?\d+)\)/;
    const { hp, maxHP } = hpExpression.exec(statusBar).groups;

    const pwExpression = /Pw:(?<pw>\d+)\((?<maxPw>\d+)\)/;
    const { pw, maxPw } = pwExpression.exec(statusBar).groups;

    const acExpression = /AC:(?<ac>-?\d+)/;
    const { ac } = acExpression.exec(statusBar).groups;

    const xpExpression = /Xp:(?<xp>\d+)/;
    const { xp } = xpExpression.exec(statusBar).groups;

    // handles overflow, thanks Khaos
    const turnsExpression = /T:(?<turns>-?\d+)/;
    const { turns } = turnsExpression.exec(statusBar).groups;

    // this expects status warnings to be the last elements in the botl
    const statusWarningsExpression = /(?<=T:-?(\d+) )(?<warnings>(.*))(?= *)$/;
    const rawStatusWarnings = statusWarningsExpression.exec(statusBar).groups.warnings;
    const statusWarnings = rawStatusWarnings.trim().split(' ');

    this.statusBar = {
      title,
      attributes,
      alignment,
      dungeonLevel,
      gold,
      hp,
      maxHP,
      pw,
      maxPw,
      ac,
      xp,
      turns,
      statusWarnings,
    };
    this.emit('updatedStatusBar', this.statusBar);
  }

  async doInput(str) {
    const windows = await this.client.doNHInput(str);
    this.windows = windows;
    this.update();
  }

  update() {
    this.updateMessages();
    this.updateStatusBar();
    this.updateText();
    this.updateMap();
    this.emit('updatedAll');
  }

  close() {
    this.client.disconnect();
  }
};
