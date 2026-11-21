
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Op } = require("sequelize");

const { sequelize, Category, Product } = require("./models");
const { startOrderExpirationJob } = require("./services/expirePendingOrders");
const { startMayaReconciliationJob } = require("./services/mayaReconciliationJob");

const app = express();

const swaggerUi = require("swagger-ui-express");
const swaggerYaml = require("yaml");
const swaggerDocument = swaggerYaml.parse(
  require("node:fs").readFileSync(
    require("node:path").join(__dirname, "openapi.yaml"),
    "utf8"
  )
);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
const PORT = process.env.PORT || 5000;

app.disable("x-powered-by");

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN
      ? process.env.CLIENT_ORIGIN.split(",").map((x) => x.trim())
      : true,
  })
);

app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    console.log(
      `${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - startedAt}ms)`
    );
  });

  next();
});

app.use(
  express.json({
    limit: "1mb",
    verify: (req, res, buf) => {
      req.rawBody = Buffer.from(buf);
    },
  })
);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

// API routes
app.use("/api/v1/auth", require("./routes/auth"));
app.use("/api/v1", require("./routes/cartOrders"));
app.use("/api/v1/admin", require("./routes/admin"));
app.use("/api/v1/webhooks", require("./routes/mayaWebhook"));
app.use("/api/v1/ai", require("./routes/ai"));
app.use("/api/v1", require("./routes/businessFeatures"));
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to the Artistry API!",
    version: "v1",
  });
});

// Product listing
app.get("/api/v1/products", async (req, res, next) => {
  try {
    const page = Math.max(
      1,
      Number.parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 50)
    );

    const where = { isActive: true };

    if (req.query.search) {
      where.name = {
        [Op.like]: `%${String(req.query.search).trim().slice(0, 80)}%`,
      };
    }

    if (req.query.category) {
      where.category = String(req.query.category).trim().slice(0, 100);
    }

    if (req.query.categoryId !== undefined) {
  const categoryId = Number(req.query.categoryId);

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "categoryId must be a positive integer.",
      },
    });
  }

  where.categoryId = categoryId;
}

    if (
      req.query.minPrice !== undefined ||
      req.query.maxPrice !== undefined
    ) {
      const price = {};

      if (req.query.minPrice !== undefined) {
        const n = Number(req.query.minPrice);

        if (!Number.isFinite(n) || n < 0) {
          return res.status(400).json({
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "minPrice must be a non-negative number.",
            },
          });
        }

        price[Op.gte] = n;
      }

      if (req.query.maxPrice !== undefined) {
        const n = Number(req.query.maxPrice);

        if (!Number.isFinite(n) || n < 0) {
          return res.status(400).json({
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "maxPrice must be a non-negative number.",
            },
          });
        }

        price[Op.lte] = n;
      }

      if (
        price[Op.gte] !== undefined &&
        price[Op.lte] !== undefined &&
        price[Op.gte] > price[Op.lte]
      ) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "minPrice cannot exceed maxPrice.",
          },
        });
      }

      where.price = price;
    }

    const allowedSort = {
      name: "name",
      price: "price",
      newest: "createdAt",
      stock: "stock",
    };

    const sort = allowedSort[req.query.sort] || "id";

    const direction =
      String(req.query.direction).toUpperCase() === "DESC"
        ? "DESC"
        : "ASC";

    const result = await Product.findAndCountAll({
      where,
      include: [
        {
          model: Category,
          as: "productCategory",
          required: false,
        },
      ],
      order: [[sort, direction]],
      limit,
      offset: (page - 1) * limit,
    });

    res.json({
      success: true,
      products: result.rows,
      pagination: {
        page,
        limit,
        total: result.count,
        pages: Math.ceil(result.count / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Product details
app.get("/api/v1/products/:id", async (req, res, next) => {
  try {
    const product = await Product.findOne({
      where: {
        id: req.params.id,
        isActive: true,
      },
      include: [
        {
          model: Category,
          as: "productCategory",
          required: false,
        },
      ],
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Product not found.",
        },
      });
    }

    res.json({
      success: true,
      product,
    });
  } catch (error) {
    next(error);
  }
});

// Categories
app.get("/api/v1/categories", async (req, res, next) => {
  try {
    res.json({
      success: true,
      categories: await Category.findAll({
        order: [["name", "ASC"]],
      }),
    });
  } catch (error) {
    next(error);
  }
});

// Seed and link categories
async function seedAndLinkCategories() {
  const categoryNames = [
    ["Painting", "Paints, brushes, and painting supplies."],
    ["Drawing", "Pencils, markers, and drawing materials."],
    ["Digital Art", "Drawing tablets, styluses, and digital art tools."],
    ["Accessories", "Additional tools and accessories for artists."],
    ["Paper and Sketchbooks", "Sketchbooks, paper, and surfaces for artwork."],
  ];

  for (const [name, description] of categoryNames) {
    await Category.findOrCreate({
      where: { name },
      defaults: { description },
    });
  }

  const existingProducts = await Product.findAll({
    where: { categoryId: null },
  });

  for (const product of existingProducts) {
    const category = await Category.findOne({
      where: { name: product.category },
    });

    if (category) {
      await product.update({
        categoryId: category.id,
      });
    }
  }
}

// Global error handler
app.use((err, req, res, next) => {
  console.error(`${req.method} ${req.originalUrl}:`, err);

  if (res.headersSent) {
    return next(err);
  }

  if (
    err.name === "SequelizeValidationError" ||
    err.name === "SequelizeForeignKeyConstraintError"
  ) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message:
          err.errors?.[0]?.message || "The supplied data is invalid.",
      },
    });
  }

  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected server error occurred.",
    },
  });
});

// Start backend
async function startServer() {
  try {
    if (
      !process.env.JWT_SECRET ||
      process.env.JWT_SECRET.length < 32
    ) {
      throw new Error(
        "JWT_SECRET must be set to a random value of at least 32 characters in server/.env. See .env.example."
      );
    }

    await sequelize.authenticate();

    console.log("MySQL database connected successfully!");

    await sequelize.sync();

    await seedAndLinkCategories();

    app.listen(PORT, () => {
      console.log(`Artistry API running at http://localhost:${PORT}`);

      startOrderExpirationJob();
      startMayaReconciliationJob();
    });
  } catch (error) {
    console.error("Unable to start Artistry API:");
    console.error(error);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer,
};

