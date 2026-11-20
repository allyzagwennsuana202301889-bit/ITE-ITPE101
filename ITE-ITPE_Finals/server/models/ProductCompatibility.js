const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ProductCompatibility = sequelize.define("ProductCompatibility", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  tabletProductId: { type: DataTypes.INTEGER, allowNull: false },
  accessoryProductId: { type: DataTypes.INTEGER, allowNull: false },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, { indexes: [{ unique: true, fields: ["tabletProductId", "accessoryProductId"] }] });
module.exports = ProductCompatibility;
