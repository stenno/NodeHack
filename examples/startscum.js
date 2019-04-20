/**
* WARNING: You must not use this script on public servers
* unless you have the permissions of the server admins
*/

const { NethackSession } = require('nodehack');
const startscumItems = require('./startscum_items');

const username = 'username';
const password = 'password';
const MAX_TRIES = 30;
const TIMEOUT = 10000;

const menuExpressions = startscumItems.items.reduce((acc, cur) => {
  const key = cur.replace(/ /g, '_');
  const regexp = RegExp(`(?<${key}>${cur})`);
  return ({ ...acc, [key]: regexp });
}, {});

const check = async (user, pw, tries) => {
  const nethackSession = new NethackSession();
  await nethackSession.loginSSH('myPrivateServer', user, pw);
  if (!nethackSession.connected) {
    throw new Error('Couldn\'t connect!');
  }
  const customExpressions = {
    menu: menuExpressions,
  };
  if ((MAX_TRIES - tries) % 10 === 0) {
    console.log(`Try ${MAX_TRIES - tries + 1}`);
  }
  const screens = await nethackSession.doInput('i', customExpressions);
  const [{ menu }] = screens.slice(-1);
  const { items } = menu.data;
  const menuKeys = Object.keys(menuExpressions);
  const foundItems = menuKeys.filter(key => items.some(item => item[key] !== null));
  const success = menuKeys.length === foundItems.length;
  await nethackSession.doInput(String.fromCharCode(0x1b)); // escape
  if (success) {
    await nethackSession.doInput('S');
    await nethackSession.doInput('y');
    console.log(`Success: Found all items after ${MAX_TRIES - tries}!`);
  } else {
    await nethackSession.doInput('#quit\n');
    await nethackSession.doInput('yq');
    if (tries <= 0) {
      console.log(`Failure: Could not find all items after ${MAX_TRIES} tries`);
    } else {
      setTimeout(() => check(user, pw, tries - 1), TIMEOUT);
    }
  }
  nethackSession.close();
};

check(username, password, MAX_TRIES);
