const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PaymentAttempt = sequelize.define(
  "PaymentAttempt",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    paymentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    providerPaymentId: {
      type: DataTypes.STRING(190),
      allowNull: false,
      unique: true,
    },
    checkoutUrl: {
      type: DataTypes.STRING(2048),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("pending", "paid", "failed", "expired", "cancelled"),
      allowNull: false,
      defaultValue: "pending",
    },
  }
);

module.exports = PaymentAttempt;
