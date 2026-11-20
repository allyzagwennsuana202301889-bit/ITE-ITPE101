const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ArtKitItem = sequelize.define("ArtKitItem", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  artKitId: { type: DataTypes.INTEGER, allowNull: false },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, validate: { min: 1 } },
});
module.exports = ArtKitItem;
