const NethackSession = require('./nethacksession');
const { username, password } = require('./config');

const nethackSession = new NethackSession();

// lazy top-level await
(async () => {
  await nethackSession.loginSSH('hardfoughtEU', username, password);
  if (!nethackSession.connected) {
    throw new Error('Couldn\'t connect!');
  }

  // eat something?
  // await nethackSession.doInput('e');
  // await nethackSession.doInput('?');

  // lets check the inventory
  await nethackSession.doInput('i');
  const menuWindow = nethackSession.getMenuWindow();
  console.log(menuWindow.toChunkedString(''));
  // pressing escape to abort
  await nethackSession.doInput(String.fromCharCode(0x1b)); // escape

  const statuswindow = nethackSession.getStatusWindow();
  console.log(statuswindow.toString(' '));
  // yes, we want to Save
  await nethackSession.doInput('S');
  await nethackSession.doInput('y');
  nethackSession.close();
  // print all messages
  console.log(nethackSession.messages);
})();
