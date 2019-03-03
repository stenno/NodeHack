# Low-level NetHack bindings for node.js

## Introduction

This library aims to provide low-level, easily extendable bindings to the roguelike [NetHack](https://nethack.org) 3.6.1.


## Requirements

Currently, the library relies on the [vt_tiledata](https://nethackwiki.com/wiki/vt_tiledata) compile-time option to be enabled. Luckily both the [NAO](https://nethack.alt.org) and the [Hardfought](https://hardfought.org) public servers have it enabled. At the moment, only server play is supported, implementing a local connection should be trivial, though. Make sure to set your DGL username and password in the [config.json](./config.json) file. 

Even though screen resizing is technically supported, it is thoroughly untested and the standard 80 columns x 24 rows layout should be used. This repository includes a [.nethackrc](./.nethackrc) file which is recommended for usage with the library. If you are feeling adventurous, play around with those options but expect it to break.


## Usage

### Windows

See [docs/windows.md](./docs/windows.md).

### Input

Input is done via the `doInput` method of a game session, which returns a promise.

```javascript
  // eat something?
  const screens = await nethackSession.doInput('e');
```

```javascript
  // execute `#version` extcommand
  const screens = await nethackSession.doInput('#version\n');
```

After input is completed, the bindings will update the windows and emit events after updating:

```javascript
  nethackSession.once('updatedStatusBar', (updatedStatusBar) => {
    console.log(updatedStatusBar)
    // do something with the updated map here
  });
```

```javascript
  nethackSession.on('updatedMessages', (lastMessage) => {
    console.log(`The last received message is ${ lastMessage }`);
  });
```

`doInput` will automatically handle `--More--` prompts by sending a whitespace. It will return a list of all parsed screens. For more information about nethack windows, see [docs/windows.md](./docs/windows.md).

```javascript 
  const screens = nethackSession.doInput('>'); // going downstairs
  screens.forEach(({ menu, map }) => {
    // do stuff
  });
```
NodeHack maps tile glyph IDs:

```javascript
  const objectGlyphsOnMap = map.getObjectGlyphs();
  const objectsOnMap = objectGlyphsOnMap.map(glyph => glyph.data.name);
  console.log(objectsOnMap);
```

### NetHack game session

The game session provides an interface to interact with the game. It handles the SSH session, input and updates, and provides abstraction over the NetHack windows. The method `loginSSH` creates a connection to a NetHack public server. Currently supported servers are:

+ `'nao'`:          nethack@nethack.alt.org
+ `'hardfoughtEU'`: nethack@eu.hardfought.org
+ `'hardfoughtUS'`: nethack@us.hardfought.org
+ `'hardfoughtAU'`: nethack@au.hardfought.org

Feel free to add other servers to `config.json`.

```javascript
  const nethackSession = new NethackSession();
  // connect to HDF-EU
  await nethackSession.loginSSH('hardfoughtEU', 'dglUsername', 'dglPassword');
```

### Custom parse expressions

NodeHack uses regular expressions to parse menus, the status bar etc. See [expressions.js](./expressions.js) for a list of built-in expressions. These built-in expressions can be overriden and extended during runtime. The following example injects a custom menu expression to obtain all worn items on the current inventory page once. 

```javascript
  const customExpressions = {
    menu: {
      worn: /\((being (?<worn>worn))\)/,
    },
  };

  const [{ menu }] = await nethackSession.doInput('i', customExpressions);
  const { items, page, numPages } = menu;
  const wornItems = items.filter(item => item.worn !== null);
  
  console.log(`Worn items on inventory page ${page} of ${numPages}`);
  console.log(wornItems);
```

A more detailed explanation about custom parse expressions will follow soon.

### Example

See [example.js](./example.js) for an example NetHack session.


## Notes

This library _should_ work out of the box at the low level for both [xNetHack](https://github.com/copperwater/xNetHack) and [SpliceHack](https://nethackwiki.com/wiki/SpliceHack), as those are based on NetHack 3.6.1.

If you are connecting with high lag, adjust the `WAITING_DELAY` constant in [client.js](./client.js) (default: 250 ms).


## TODO

+ [x] Proper abstraction of statuswindow
+ [x] Proper abstraction of menuwindows
+ [ ] Proper abstraction of map window
+ [ ] Proper abstraction of the player character
+ [x] Handling of `--More--` prompts
+ [ ] Handling of character creation if neccessary
+ [x] Mapping of tiledata ID to an abstract tile square
+ [x] Configuration of DGL interaction
+ [ ] Local play
+ [ ] Proper JSDoc
