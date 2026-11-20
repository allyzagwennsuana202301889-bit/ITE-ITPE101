const sequelize = require("../config/database");

const User = require("./User");
const Category = require("./Category");
const Product = require("./Product");
const Cart = require("./Cart");
const CartItem = require("./CartItem");
const Order = require("./Order");
const OrderItem = require("./OrderItem");
const Payment = require("./Payment");
const PaymentAttempt = require("./PaymentAttempt");
const Coupon = require("./Coupon");
const ProductCompatibility = require("./ProductCompatibility");
const ArtKit = require("./ArtKit");
const ArtKitItem = require("./ArtKitItem");
const InventoryAdjustment = require("./InventoryAdjustment");
const OrderStatusHistory = require("./OrderStatusHistory");
const WebhookEvent = require("./WebhookEvent");

// Categories and products
Category.hasMany(Product, { foreignKey: "categoryId", as: "products" });
Product.belongsTo(Category, { foreignKey: "categoryId", as: "productCategory" });

// User shopping and orders
User.hasOne(Cart, { foreignKey: "userId", as: "cart" });
Cart.belongsTo(User, { foreignKey: "userId", as: "user" });
Cart.hasMany(CartItem, { foreignKey: "cartId", as: "items", onDelete: "CASCADE" });
CartItem.belongsTo(Cart, { foreignKey: "cartId", as: "cart" });
Product.hasMany(CartItem, { foreignKey: "productId", as: "cartEntries" });
CartItem.belongsTo(Product, { foreignKey: "productId", as: "product" });

User.hasMany(Order, { foreignKey: "userId", as: "orders" });
Order.belongsTo(User, { foreignKey: "userId", as: "user" });
Order.hasMany(OrderItem, { foreignKey: "orderId", as: "items", onDelete: "CASCADE" });
OrderItem.belongsTo(Order, { foreignKey: "orderId", as: "order" });
Product.hasMany(OrderItem, { foreignKey: "productId", as: "orderEntries" });
OrderItem.belongsTo(Product, { foreignKey: "productId", as: "product" });

Order.hasMany(Payment, { foreignKey: "orderId", as: "payments", onDelete: "CASCADE" });
Payment.belongsTo(Order, { foreignKey: "orderId", as: "order" });

Payment.hasMany(PaymentAttempt, {
  foreignKey: "paymentId",
  as: "attempts",
  onDelete: "CASCADE",
});
PaymentAttempt.belongsTo(Payment, {
  foreignKey: "paymentId",
  as: "payment",
});

Order.hasMany(OrderStatusHistory, { foreignKey: "orderId", as: "statusHistory", onDelete: "CASCADE" });
OrderStatusHistory.belongsTo(Order, { foreignKey: "orderId", as: "order" });
User.hasMany(OrderStatusHistory, { foreignKey: "changedBy", as: "orderStatusChanges" });
OrderStatusHistory.belongsTo(User, { foreignKey: "changedBy", as: "changedByUser" });

Product.hasMany(InventoryAdjustment, { foreignKey: "productId", as: "inventoryAdjustments" });
InventoryAdjustment.belongsTo(Product, { foreignKey: "productId", as: "product" });
User.hasMany(InventoryAdjustment, { foreignKey: "adminId", as: "inventoryChanges" });
InventoryAdjustment.belongsTo(User, { foreignKey: "adminId", as: "admin" });

// Coupons
Coupon.hasMany(Order, { foreignKey: "couponId", as: "orders" });
Order.belongsTo(Coupon, { foreignKey: "couponId", as: "coupon", allowNull: true });

// Device compatibility
Product.hasMany(ProductCompatibility, { foreignKey: "tabletProductId", as: "compatibleAccessories" });
Product.hasMany(ProductCompatibility, { foreignKey: "accessoryProductId", as: "compatibleWith" });
ProductCompatibility.belongsTo(Product, { foreignKey: "tabletProductId", as: "tablet" });
ProductCompatibility.belongsTo(Product, { foreignKey: "accessoryProductId", as: "accessory" });

// Custom art kits
User.hasMany(ArtKit, { foreignKey: "userId", as: "artKits" });
ArtKit.belongsTo(User, { foreignKey: "userId", as: "owner" });
ArtKit.hasMany(ArtKitItem, { foreignKey: "artKitId", as: "items", onDelete: "CASCADE" });
ArtKitItem.belongsTo(ArtKit, { foreignKey: "artKitId", as: "artKit" });
Product.hasMany(ArtKitItem, { foreignKey: "productId", as: "artKitEntries" });
ArtKitItem.belongsTo(Product, { foreignKey: "productId", as: "product" });

module.exports = {
  sequelize,
  User,
  Category,
  Product,
  Cart,
  CartItem,
  Order,
  OrderItem,
  Payment,
  PaymentAttempt,
  Coupon,
  ProductCompatibility,
  ArtKit,
  ArtKitItem,
  InventoryAdjustment,
  OrderStatusHistory,
  WebhookEvent,
};
