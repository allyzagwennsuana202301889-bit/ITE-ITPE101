const express = require("express");
const { Op } = require("sequelize");

const {
  sequelize,
  Product,
  ArtKit,
  ArtKitItem,
  ProductCompatibility,
  Cart,
  CartItem,
} = require("../models");

const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const fail = (res, status, message, code = "REQUEST_ERROR") =>
  res.status(status).json({
    success: false,
    error: { code, message },
  });

const validId = (value) =>
  Number.isInteger(Number(value)) && Number(value) > 0;

// ART KIT BUILDER
router.use("/art-kits", requireAuth);

// List the logged-in user's kits
router.get("/art-kits", async (req, res, next) => {
  try {
    const kits = await ArtKit.findAll({
      where: { userId: req.user.id },
      include: [{
        model: ArtKitItem,
        as: "items",
        include: [{
          model: Product,
          as: "product",
        }],
      }],
      order: [["createdAt", "DESC"]],
    });

    res.json({ success: true, data: kits });
  } catch (error) {
    next(error);
  }
});

// Create a kit
router.post("/art-kits", async (req, res, next) => {
  const { name, description, kitType, items } = req.body;

  if (!name || !String(name).trim()) {
    return fail(res, 400, "Kit name is required.");
  }

  if (!Array.isArray(items) || items.length === 0) {
    return fail(res, 400, "At least one product is required.");
  }

  const seen = new Set();

  for (const item of items) {
    const productId = Number(item.productId);
    const quantity = Number(item.quantity);

    if (!validId(productId) || !Number.isInteger(quantity) || quantity < 1) {
      return fail(res, 400, "Each item needs a valid product ID and quantity.");
    }

    if (seen.has(productId)) {
      return fail(res, 400, "Duplicate products are not allowed in a kit.");
    }

    seen.add(productId);
  }

  const transaction = await sequelize.transaction();

  try {
    const productIds = items.map((item) => Number(item.productId));

    const products = await Product.findAll({
      where: {
        id: { [Op.in]: productIds },
        isActive: true,
      },
      transaction,
    });

    if (products.length !== productIds.length) {
      await transaction.rollback();
      return fail(res, 400, "One or more products are unavailable.");
    }
    
    const productMap = new Map(
  products.map((product) => [product.id, product])
);

for (const item of items) {
  const product = productMap.get(Number(item.productId));

  if (Number(item.quantity) > product.stock) {
    await transaction.rollback();
    return fail(
      res,
      400,
      `${product.name} only has ${product.stock} units available.`
    );
  }
}

    const kit = await ArtKit.create({
      userId: req.user.id,
      name: String(name).trim().slice(0, 120),
      description: description ? String(description).trim() : null,
      kitType: kitType ? String(kitType).trim().slice(0, 60) : null,
    }, { transaction });

    await ArtKitItem.bulkCreate(
      items.map((item) => ({
        artKitId: kit.id,
        productId: Number(item.productId),
        quantity: Number(item.quantity),
      })),
      { transaction }
    );

    await transaction.commit();

    const createdKit = await ArtKit.findOne({
      where: { id: kit.id, userId: req.user.id },
      include: [{
        model: ArtKitItem,
        as: "items",
        include: [{ model: Product, as: "product" }],
      }],
    });

    res.status(201).json({ success: true, data: createdKit });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

// View one of the logged-in user's kits
router.get("/art-kits/:id", async (req, res, next) => {
  try {
    if (!validId(req.params.id)) {
      return fail(res, 400, "Invalid kit ID.");
    }

    const kit = await ArtKit.findOne({
      where: {
        id: Number(req.params.id),
        userId: req.user.id,
      },
      include: [{
        model: ArtKitItem,
        as: "items",
        include: [{ model: Product, as: "product" }],
      }],
    });

    if (!kit) {
      return fail(res, 404, "Art kit not found.");
    }

    res.json({ success: true, data: kit });
  } catch (error) {
    next(error);
  }
});

// Update kit details and, optionally, replace the kit's products.
// Send "items" to replace the whole list of products; leave it out to change only the details.
router.patch("/art-kits/:id", async (req, res, next) => {
  let transaction;

  try {
    if (!validId(req.params.id)) {
      return fail(res, 400, "Invalid kit ID.");
    }

    const kit = await ArtKit.findOne({
      where: {
        id: Number(req.params.id),
        userId: req.user.id,
      },
    });

    if (!kit) {
      return fail(res, 404, "Art kit not found.");
    }

    const updates = {};

    if (req.body.name !== undefined) {
      if (!String(req.body.name).trim()) {
        return fail(res, 400, "Kit name cannot be empty.");
      }
      updates.name = String(req.body.name).trim().slice(0, 120);
    }

    if (req.body.description !== undefined) {
      updates.description = req.body.description
        ? String(req.body.description).trim()
        : null;
    }

    if (req.body.kitType !== undefined) {
      updates.kitType = req.body.kitType
        ? String(req.body.kitType).trim().slice(0, 60)
        : null;
    }

    const replaceItems = req.body.items !== undefined;
    const items = replaceItems ? req.body.items : [];

    if (replaceItems) {
      if (!Array.isArray(items) || items.length === 0) {
        return fail(res, 400, "At least one product is required.");
      }

      const seen = new Set();

      for (const item of items) {
        const productId = Number(item.productId);
        const quantity = Number(item.quantity);

        if (!validId(productId) || !Number.isInteger(quantity) || quantity < 1) {
          return fail(res, 400, "Each item needs a valid product ID and quantity.");
        }

        if (seen.has(productId)) {
          return fail(res, 400, "Duplicate products are not allowed in a kit.");
        }

        seen.add(productId);
      }
    }

    transaction = await sequelize.transaction();

    if (replaceItems) {
      const productIds = items.map((item) => Number(item.productId));

      const products = await Product.findAll({
        where: {
          id: { [Op.in]: productIds },
          isActive: true,
        },
        transaction,
      });

      if (products.length !== productIds.length) {
        await transaction.rollback();
        transaction = null;
        return fail(res, 400, "One or more products are unavailable.");
      }

      const productMap = new Map(
        products.map((product) => [product.id, product])
      );

      for (const item of items) {
        const product = productMap.get(Number(item.productId));

        if (Number(item.quantity) > product.stock) {
          await transaction.rollback();
          transaction = null;
          return fail(
            res,
            400,
            `${product.name} only has ${product.stock} units available.`
          );
        }
      }

      await ArtKitItem.destroy({
        where: { artKitId: kit.id },
        transaction,
      });

      await ArtKitItem.bulkCreate(
        items.map((item) => ({
          artKitId: kit.id,
          productId: Number(item.productId),
          quantity: Number(item.quantity),
        })),
        { transaction }
      );
    }

    await kit.update(updates, { transaction });
    await transaction.commit();
    transaction = null;

    const updatedKit = await ArtKit.findOne({
      where: { id: kit.id, userId: req.user.id },
      include: [{
        model: ArtKitItem,
        as: "items",
        include: [{ model: Product, as: "product" }],
      }],
    });

    res.json({ success: true, data: updatedKit });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
});

// Delete an owned kit and its items
router.delete("/art-kits/:id", async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    if (!validId(req.params.id)) {
      await transaction.rollback();
      return fail(res, 400, "Invalid kit ID.");
    }

    const kit = await ArtKit.findOne({
      where: {
        id: Number(req.params.id),
        userId: req.user.id,
      },
      transaction,
    });

    if (!kit) {
      await transaction.rollback();
      return fail(res, 404, "Art kit not found.");
    }

    await ArtKitItem.destroy({
      where: { artKitId: kit.id },
      transaction,
    });

    await kit.destroy({ transaction });
    await transaction.commit();

    res.json({ success: true, message: "Art kit deleted successfully." });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

// Add every available product in an owned kit to the existing shopping cart.
// Uses the same Cart / CartItem tables as POST /cart/items (no separate cart).
// Products that are inactive, out of stock, or would exceed stock / the
// 99-per-line cart limit are skipped and reported; the rest are added with
// the quantities saved in the kit. The user still reviews the cart afterwards.
router.post("/art-kits/:id/add-to-cart", async (req, res, next) => {
  let transaction;

  try {
    if (!validId(req.params.id)) {
      return fail(res, 400, "Invalid kit ID.");
    }

    transaction = await sequelize.transaction();

    const kit = await ArtKit.findOne({
      where: { id: Number(req.params.id), userId: req.user.id },
      include: [{
        model: ArtKitItem,
        as: "items",
        include: [{ model: Product, as: "product" }],
      }],
      transaction,
    });

    if (!kit) {
      await transaction.rollback();
      transaction = null;
      return fail(res, 404, "Art kit not found.");
    }

    if (!kit.items || kit.items.length === 0) {
      await transaction.rollback();
      transaction = null;
      return fail(res, 400, "This kit has no products to add.");
    }

    const [cart] = await Cart.findOrCreate({
      where: { userId: req.user.id },
      defaults: { userId: req.user.id },
      transaction,
    });

    const cartLines = await CartItem.findAll({
      where: { cartId: cart.id },
      transaction,
    });
    const inCart = new Map(cartLines.map((line) => [line.productId, line]));

    const added = [];
    const skipped = [];

    for (const item of kit.items) {
      const product = item.product;
      const name = product ? product.name : "A product";
      const skip = (reason, message) =>
        skipped.push({
          productId: item.productId,
          name,
          quantity: item.quantity,
          reason,
          message,
        });

      if (!product || !product.isActive) {
        skip("UNAVAILABLE", `${name} is no longer available.`);
        continue;
      }

      if (product.stock <= 0) {
        skip("OUT_OF_STOCK", `${name} is out of stock.`);
        continue;
      }

      const line = inCart.get(product.id);
      const alreadyInCart = line ? line.quantity : 0;
      const newQuantity = alreadyInCart + item.quantity;

      if (newQuantity > product.stock) {
        skip(
          "INSUFFICIENT_STOCK",
          alreadyInCart > 0
            ? `${name}: only ${product.stock} in stock (${alreadyInCart} already in your cart, kit needs ${item.quantity}).`
            : `${name}: only ${product.stock} in stock, but the kit needs ${item.quantity}.`
        );
        continue;
      }

      if (newQuantity > 99) {
        skip("CART_LIMIT", `${name}: a cart line cannot exceed 99 items.`);
        continue;
      }

      if (line) {
        await line.update({ quantity: newQuantity }, { transaction });
      } else {
        await CartItem.create(
          { cartId: cart.id, productId: product.id, quantity: item.quantity },
          { transaction }
        );
      }

      added.push({
        productId: product.id,
        name,
        quantity: item.quantity,
        cartQuantity: newQuantity,
      });
    }

    await transaction.commit();
    transaction = null;

    res.json({
      success: true,
      data: { kitId: kit.id, added, skipped },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    next(error);
  }
});

// DEVICE COMPATIBILITY CHECKER

// List tablets that have compatibility records
router.get("/compatibility/tablets", async (req, res, next) => {
  try {
    const records = await ProductCompatibility.findAll({
      include: [{
        model: Product,
        as: "tablet",
        where: { isActive: true },
        attributes: ["id", "name", "description", "imageUrl"],
      }],
    });

    const tablets = [
      ...new Map(
        records.map((record) => [record.tablet.id, record.tablet])
      ).values(),
    ];

    res.json({ success: true, data: tablets });
  } catch (error) {
    next(error);
  }
});

// List accessories compatible with a tablet
router.get("/compatibility/tablets/:id/accessories", async (req, res, next) => {
  try {
    if (!validId(req.params.id)) {
      return fail(res, 400, "Invalid tablet product ID.");
    }

    const records = await ProductCompatibility.findAll({
      where: { tabletProductId: Number(req.params.id) },
      include: [{
        model: Product,
        as: "accessory",
        where: { isActive: true },
        attributes: ["id", "name", "description", "price", "stock", "imageUrl"],
      }],
    });

    res.json({
      success: true,
      data: records.map((record) => ({
        ...record.accessory.toJSON(),
        compatibilityNotes: record.notes,
      })),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;