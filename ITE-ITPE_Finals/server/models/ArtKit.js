const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ArtKit = sequelize.define("ArtKit", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  userId: { type: DataTypes.INTEGER, allowNull: true },
  name: { type: DataTypes.STRING(120), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  kitType: { type: DataTypes.STRING(60), allowNull: true },
});
module.exports = ArtKit;
