const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const OrderStatusHistory = sequelize.define("OrderStatusHistory", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  orderId: { type: DataTypes.INTEGER, allowNull: false },
  changedBy: { type: DataTypes.INTEGER, allowNull: true },
  fromStatus: { type: DataTypes.STRING(30), allowNull: true },
  toStatus: { type: DataTypes.STRING(30), allowNull: false },
  note: { type: DataTypes.STRING(255), allowNull: true },
});
module.exports = OrderStatusHistory;
