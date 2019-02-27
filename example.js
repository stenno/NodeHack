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
    menu: {
      worn: /\((being (?<worn>worn))\)/,
    },
  };

  // bind handler before pressing 'i' to open inventory
  // 'updatedAll' is fired before doInput resolves
  nethackSession.once('updatedAll', ({ menu, status }) => {
    const { items, page, numPages } = menu;
    const { strength, warnings, turns } = status;
    // all items with the attribute 'worn' matched the custom expression
    const wornItems = items.filter(item => item.worn !== null).map(item => item.item);
    console.log(`Worn items on inventory page ${page} of ${numPages}`);
    console.log(wornItems);
    console.log(`Player strength: ${strength}`);
    console.log(`Status warnings: ${warnings}`);
    console.log(`Current turncount: ${turns}`);
  });
  await nethackSession.doInput('i', customExpressions);

  // pressing escape to exit inventory menu
  await nethackSession.doInput(String.fromCharCode(0x1b)); // escape
  // yes, we want to Save
  await nethackSession.doInput('S');
  await nethackSession.doInput('y');
  nethackSession.close();
})();
