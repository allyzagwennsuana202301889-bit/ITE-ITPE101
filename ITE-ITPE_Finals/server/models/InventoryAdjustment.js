const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const InventoryAdjustment = sequelize.define("InventoryAdjustment", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  adminId: { type: DataTypes.INTEGER, allowNull: false },
  quantityChange: { type: DataTypes.INTEGER, allowNull: false },
  previousStock: { type: DataTypes.INTEGER, allowNull: false },
  newStock: { type: DataTypes.INTEGER, allowNull: false },
  reason: { type: DataTypes.STRING(255), allowNull: false },
});
module.exports = InventoryAdjustment;
