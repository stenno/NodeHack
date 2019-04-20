const { NethackSession } = require('nodehack');

const nethackSession = new NethackSession();
const username = 'username';
const password = 'password';

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

  const screens = await nethackSession.doInput('i', customExpressions);

  // get last screen
  const [{ menu, map }] = screens.slice(-1);
  const { items, page, numPages } = menu.data;

  // all items with the attribute 'worn' matched the custom expression
  const wornItems = items.filter(item => item.worn !== null).map(item => item.item);
  console.log(`Worn items on inventory page ${page} of ${numPages}`);
  console.log(wornItems);

  // print map
  // console.log(map.window.toChunkedString(' '));

  // find all pets on the map by tile information
  const petsOnMap = map.glyphs.filter(glyph => glyph.effects.includes('pet'));
  console.log(petsOnMap);

  // pressing escape to exit inventory menu
  await nethackSession.doInput(String.fromCharCode(0x1b)); // escape

  // yes, we want to Save
  await nethackSession.doInput('S');
  await nethackSession.doInput('y');
  nethackSession.close();
})();
