
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Order = sequelize.define(
  "Order",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    orderNumber: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    idempotencyKey: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM(
        "pending",
        "pending_payment",
        "paid",
        "processing",
        "shipped",
        "completed",
        "cancelled",
        "refunded"
      ),
      allowNull: false,
      defaultValue: "pending_payment",
    },
    subtotal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    discountAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    shippingFee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    couponId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    shippingAddress: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    indexes: [
      {
        unique: true,
        fields: ["userId", "idempotencyKey"],
      },
    ],
  }
);

module.exports = Order;
