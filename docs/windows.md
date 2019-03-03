# Game windows

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
    > b - an uncursed lizard corpse   
    > (end)   

5.  **Text**

    This window displays non-interactive text. Executing the `#version` extcommand or the quest nemesis lair text gets written to this window.

6.  **Base**

    This window is used for absolute movement and also serves as a fallback window.

Note that windows will not update by themselves. You have to fetch each window again after each update (if you need it).
Likewise, mutating window data will **not** reflect on the actual session.

## Access

The bindings expose those windows in a game session:
```javascript
  const statusWindow = nethackSession.getStatusWindow();
  console.log(statusWindow.toString(' '));
```

## Tiledata glyphs

Each map cell contains the parsed glyph data of vt_tiledata:
```javascript
  const map = nethackSession.getMapWindow();
  const objectsOnMap = map.getObjectGlyphs()
    .map(({ row, col, data }) => ({ row, col, name: data.name }));
```
