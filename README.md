# Low-level NetHack bindings for node.js

## Introduction

This library aims to provide low-level, easily extendable bindings to the roguelike [NetHack](https://nethack.org) 3.6.1.


## Requirements

Currently, the library relies on the [vt_tiledata](https://nethackwiki.com/wiki/vt_tiledata) compile-time option to be enabled. Luckily both the [NAO](https://nethack.alt.org) and the [Hardfought](https://hardfought.org) public servers have it enabled. At the moment, only server play is supported, implementing a local connection should be trivial, though. Make sure to set your DGL username and password in the [config.json](./config.json) file. 

Even though screen resizing is technically supported, it is thoroughly untested and the standard 80 columns x 24 rows layout should be used. This repository includes a [.nethackrc](./.nethackrc) file which is recommended for usage with the library. If you are feeling adventurous, play around with those options but expect it to break.


## Usage

### Game windows

NetHack writes its data into one of six game windows, which are exposed by the bindings:

1.  **Message**

    All messages and prompts are written to this window.

    > What do you want to eat? [bdeqv or ?*] 

    > Never mind.

2.  **Status**

    The status window, also known as botl (bottom line), contains the name of the character, their attributes and game information.

    > Nodehack the Stripling        St:16 Dx:13 Co:17 In:8 Wi:13 Ch:8 Lawful           lvl:1 $:0 HP:16(16) Pw:2(2) AC:6 Xp:1 T:1

3.  **Map**

    This window holds the current map as it's drawn by the game. The tile ID maps each cell to its respective tile.

4.  **Menu**

    Whenever you have to select items from a menu (for example chest contents, or a selection from the inventory), it gets written to the Menu window. For example, after pressing `?` when asked what the character wants to eat:

    > Comestibles     
    > v - an uncursed slime mold   
    > d - an uncursed food ration   
    > q - a food ration   
    > e - an uncursed lembas wafer   
    > b - an uncursed lizard corpse   
    > (end)   

5.  **Text**

    This window displays non-interactive text. Executing the `#version` extcommand or the quest nemesis lair text gets written to this window.

6.  **Base**

    This window is used for absolute movement and also serves as a fallback window.

---

The bindings expose those windows in a game session:

```javascript
  const statusWindow = nethackSession.getStatusWindow();
  console.log(statusWindow.toString(' '));
```

Please note that windows will not update by themselves. You have to fetch each window again after each update (if you need it).
Likewise, mutating window data will **not** reflect on the actual session.

### Input

Input is done via the `doInput` method of a game session, which returns a promise.

```javascript
  // eat something?
  await nethackSession.doInput('e');
```

```javascript
  // execute `#version` extcommand
  await nethackSession.doInput('#version\n');
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

### NetHack game session

The game session provides an interface to interact with the game. It handles the SSH session, input and updates, and provides abstraction over the NetHack windows. The method `loginSSH` creates a connection to a NetHack public server. Currently supported servers are:

+ `'nao'`:          nethack@nethack.alt.org
+ `'hardfoughtEU'`: nethack@eu.hardfought.org
+ `'hardfoughtUS'`: nethack@us.hardfought.org
+ `'hardfoughtAU'`: nethack@au.hardfought.org

Feel free to add other servers to `config.json`.

---

```javascript
  const nethackSession = new NethackSession();
  // connect to HDF-EU
  await nethackSession.loginSSH('hardfoughtEU', 'dglUsername', 'dglPassword');
```

### Custom parse expressions

NodeHack uses regular expressions to parse menus, the status bar etc. See [expressions.js](./expressions.js) for a list of built-in expressions. These built-in expressions can be overriden and extended during runtime. The following example injects a custom menu expression to obtain all worn items on the current inventory page once. 

```javascript
  const customExpressions = {
    menuItem: {
      worn: /\((being (?<worn>worn))\)/,
    },
  };

  nethackSession.once('updatedMenu', ({ items, page, numPages }) => {
    const wornItems = items.filter(item => typeof item.worn !== 'undefined');
    console.log(page, numPages, wornItems);
  });

  await nethackSession.doInput('i', customExpressions);
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
+ [ ] Handling of `--More--` prompts
+ [ ] Handling of character creation if neccessary
+ [ ] Mapping of tiledata ID to an abstract tile square
+ [x] Configuration of DGL interaction
+ [ ] Local play
+ [ ] Proper JSDoc
