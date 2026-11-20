
const { Sequelize } = require("sequelize");
const fs = require("fs");
require("dotenv").config();

const dialectOptions = {};

if (process.env.DB_SSL_CA_PATH) {
  dialectOptions.ssl = {
    ca: fs.readFileSync(process.env.DB_SSL_CA_PATH, "utf8"),
    rejectUnauthorized: true,
  };
}

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: "mysql",
    timezone: "+08:00",
    logging: false,
    dialectOptions,
  }
);

module.exports = sequelize;
