const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const OrderItem = sequelize.define("OrderItem", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  orderId: { type: DataTypes.INTEGER, allowNull: false },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  productName: { type: DataTypes.STRING, allowNull: false },
  unitPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } },
  lineTotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
});
module.exports = OrderItem;
