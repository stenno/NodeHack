const NethackSession = require('./nethacksession');
const { username, password } = require('./config');

const nethackSession = new NethackSession();

// lazy top-level await
(async () => {
  await nethackSession.loginSSH('hardfoughtEU', username, password);
  if (!nethackSession.connected) {
    throw new Error('Couldn\'t connect!');
  }

  // lets check the inventory
  // inject custom inventory handler: all worn items on the inventory page

  const customExpressions = {
    menuItem: {
      worn: /\((being (?<worn>worn))\)/,
    },
  };

  nethackSession.once('updatedMenu', ({ items, page, numPages }) => {
    // all items with the attribute 'worn' matched the custom expression
    const wornItems = items.filter(item => typeof item.worn !== 'undefined');

    console.log(`Worn items on inventory page ${page} of ${numPages}`);
    console.log(wornItems);
  });

  await nethackSession.doInput('i', customExpressions);
  nethackSession.once('updatedStatusBar', (updatedStatusBar) => {
    console.log(updatedStatusBar);
  });

  // pressing escape to abort
  await nethackSession.doInput(String.fromCharCode(0x1b)); // escape

  // yes, we want to Save
  await nethackSession.doInput('S');
  await nethackSession.doInput('y');
  nethackSession.close();
  // print all messages
})();
