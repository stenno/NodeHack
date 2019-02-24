const { EventEmitter } = require('events');

const _ = require('lodash'); // eslint-disable-line import/no-extraneous-dependencies

const Client = require('./client');
const { NethackWindow, windowIds } = require('./nhwindow');
const { servers } = require('./config');
const expressions = require('./expressions');
const Character = require('./character');

module.exports = class NethackSession extends EventEmitter {
  constructor(customExpressions = {}) {
    super();
    this.client = new Client();
    this.windows = [];
    this.connected = false;
    this.messages = [];
    this.dungeonMap = null;
    this.currentText = '';
    this.character = null;
    this.statusBar = {};
    this.currentMenu = { items: [], page: 0, numPages: 0 };
    this.customExpressions = customExpressions;
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

  // message parsing TBI
  updateMessages(customExpressions) { // eslint-disable-line no-unused-vars
    const window = this.getMessageWindow();
    this.messages = [...this.messages, window.toString('')];
    this.emit('updatedMessages', this.messages.slice(-1));
  }

  // text parsing TBI
  updateText(customExpressions) { // eslint-disable-line no-unused-vars
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

  updateStatusBar(customExpressions = {}) {
    const window = this.getStatusWindow();
    const statusBar = window.toString(' ');

    if (statusBar.trim() === '') {
      // no update here, so we just return the old statusBar
      this.emit('statusBarUpdated', this.statusBar);
      return;
    }

    const statusExpressions = {
      ...expressions.statusBar,
      ...this.customExpressions.statusBar,
      ...customExpressions,
    };

    const updatedStatusBar = Object.values(statusExpressions).reduce((result, expression) => {
      const parsedItem = expression.exec(statusBar);
      return (parsedItem === null) ? result : { ...result, ...parsedItem.groups };
    }, {});
    this.statusBar = updatedStatusBar;
    this.emit('updatedStatusBar', this.statusBar);
  }

  updateMenu(customExpressions = {}) {
    const window = this.getMenuWindow();
    const menuPage = window.toChunkedString('').split('\n').map(row => row.trim()).filter(row => row !== '');

    if (menuPage.length === 0) {
      this.currentMenu = { items: [], page: 0, numPages: 0 };
      this.emit('updatedMenu', this.currentMenu);
      return this.currentMenu;
    }
    const menuItemExpressions = {
      ...expressions.menuItem,
      ...this.customExpressions.menuItem,
      ...customExpressions,
    };

    const items = menuPage.slice(0, -1).map((menuItem) => {
      const parsedMenuItem = Object.values(menuItemExpressions).reduce((result, expression) => {
        const parsedItem = expression.exec(menuItem);
        return (parsedItem === null) ? result : { ...result, ...parsedItem.groups };
      }, {});
      return parsedMenuItem;
    });

    const lastLine = menuPage.slice(-1);

    // lazy
    const menu = { items: items.filter(item => !_.isEmpty(item)) };

    // (end) indicates single page
    if (lastLine === '(end)') {
      this.currentMenu = { ...menu, page: 0, numPages: 1 };
      this.emit('updatedMenu', this.currentMenu);
      return this.currentMenu;
    }

    // move this to expressions.js too?
    const { page, numPages } = /^\((?<page>\d+) of (?<numPages>\d+)\)$/.exec(lastLine).groups;
    this.currentMenu = { ...menu, page, numPages };
    this.emit('updatedMenu', this.currentMenu);
    return this.currentMenu;
  }

  async doInput(str, customExpressions = {}) {
    const windows = await this.client.doNHInput(str);
    this.windows = windows;
    this.update(customExpressions);
  }

  update(customExpressions = {}) {
    this.updateMessages(customExpressions.messages);
    this.updateStatusBar(customExpressions.statusBar);
    this.updateText(customExpressions.text);
    this.updateMap();
    this.updateMenu(customExpressions.menu);
    this.emit('updatedAll');
  }

  close() {
    this.client.disconnect();
  }
};
