
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Payment = sequelize.define("Payment", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  orderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
  },
  provider: {
    type: DataTypes.STRING(40),
    allowNull: false,
    defaultValue: "maya",
  },
  providerPaymentId: {
    type: DataTypes.STRING(190),
    allowNull: true,
    unique: true,
  },
  checkoutUrl: {
    type: DataTypes.STRING(2048),
    allowNull: true,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM("pending", "paid", "failed", "refunded"),
    allowNull: false,
    defaultValue: "pending",
  },
  paidAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

module.exports = Payment;
