const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Coupon = sequelize.define("Coupon", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  discountType: { type: DataTypes.ENUM("percentage", "fixed"), allowNull: false },
  discountValue: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  minimumSpend: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
  usageLimit: { type: DataTypes.INTEGER, allowNull: true },
  perCustomerLimit: { type: DataTypes.INTEGER, allowNull: true },
  usedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  expiresAt: { type: DataTypes.DATE, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
});
module.exports = Coupon;
