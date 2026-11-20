
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const WebhookEvent = sequelize.define(
  "WebhookEvent",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    paymentId: {
      type: DataTypes.STRING(190),
      allowNull: false,
    },
    eventType: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("received", "processed", "failed"),
      allowNull: false,
      defaultValue: "received",
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    errorMessage: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  },
  {
    indexes: [
      {
        unique: true,
        fields: ["paymentId", "eventType"],
      },
    ],
  }
);

module.exports = WebhookEvent;
