module.exports = class Character {
  constructor(name) {
    this.name = name;
    this.attributes = {
      strength: 0,
      dexterity: 0,
      constitution: 0,
      intelligence: 0,
      wisdom: 0,
      charisma: 0,
    };
    this.status = [];
    this.alignment = null;
    this.gold = 0;
    this.experienceLevel = 0;
    this.experience = 0;
    this.armorClass = 0;
  }
};
