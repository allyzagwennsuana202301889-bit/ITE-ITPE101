
const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { Op } = require("sequelize");
const { Product } = require("../models");

const { askAI } = require("../services/aiAssistant");

const router = express.Router();

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    code: "AI_RATE_LIMITED",
    message: "Too many AI requests. Please try again later.",
  },
});

router.post("/ask", aiLimiter, async (req, res) => {
  try {
    const { question } = req.body || {};

    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({
        code: "INVALID_QUESTION",
        message: "Please provide a question.",
      });
    }

    if (question.length > 1000) {
      return res.status(400).json({
        code: "QUESTION_TOO_LONG",
        message: "Your question is too long. Maximum is 1000 characters.",
      });
    }

    const result = await askAI(question.trim());

    const products = result.productIds.length
      ? await Product.findAll({
          where: {
            id: { [Op.in]: result.productIds },
            isActive: true,
            stock: { [Op.gt]: 0 },
          },
          attributes: [
            "id",
            "name",
            "category",
            "price",
            "stock",
            "description",
            "imageUrl",
          ],
        })
      : [];

    return res.status(200).json({
      answer: result.answer,
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        price: Number(product.price),
        stock: product.stock,
        description: product.description,
        imageUrl: product.imageUrl,
      })),
    });
  } catch (error) {
    console.error("AI Assistant error:", error.message);

    return res.status(503).json({
      code: "AI_UNAVAILABLE",
      message: "The AI Assistant is temporarily unavailable. Please try again later.",
    });
  }
});

module.exports = router;
