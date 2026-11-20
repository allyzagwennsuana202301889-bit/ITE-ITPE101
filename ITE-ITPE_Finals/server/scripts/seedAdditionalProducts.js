
const { Product, Category } = require("../models");
const sequelize = require("../config/database");

const products = [
  // PAINTING
  {
    name: "Gouache Paint Set",
    category: "Painting",
    price: 520,
    stock: 14,
    description: "A versatile gouache paint set with rich, opaque colors for illustration and fine-art projects.",
  },
  {
    name: "Watercolor Paper Pad",
    category: "Painting",
    price: 280,
    stock: 22,
    description: "Textured paper for watercolor washes, blending, and layering.",
  },
  {
    name: "Acrylic Paint Marker Set",
    category: "Painting",
    price: 750,
    stock: 9,
    description: "Acrylic paint markers for colorful details and illustrations.",
  },
  {
    name: "Palette Knife Set",
    category: "Painting",
    price: 190,
    stock: 18,
    description: "Assorted palette knives for mixing paint and creating textures.",
  },
  {
    name: "Round Watercolor Brush Set",
    category: "Painting",
    price: 360,
    stock: 16,
    description: "Round brushes in several sizes for watercolor painting.",
  },
  {
    name: "Canvas Panel Pack",
    category: "Painting",
    price: 420,
    stock: 11,
    description: "Primed canvas panels suitable for acrylic painting.",
  },

  // DRAWING
  {
    name: "Fineliner Pen Set",
    category: "Drawing",
    price: 310,
    stock: 20,
    description: "Fine-tip pens for outlines, lettering, and technical drawing.",
  },
  {
    name: "Charcoal Drawing Set",
    category: "Drawing",
    price: 390,
    stock: 13,
    description: "A charcoal set for sketching and shading.",
  },
  {
    name: "Colored Pencil Set",
    category: "Drawing",
    price: 480,
    stock: 17,
    description: "Blendable colored pencils for illustrations and artwork.",
  },
  {
    name: "A4 Mixed Media Sketchbook",
    category: "Drawing",
    price: 340,
    stock: 19,
    description: "A mixed-media sketchbook for pencil, pen, and light marker work.",
  },
  {
    name: "Kneaded Eraser Pack",
    category: "Drawing",
    price: 95,
    stock: 35,
    description: "Moldable erasers for lifting graphite and charcoal.",
  },
  {
    name: "Blending Stump Set",
    category: "Drawing",
    price: 120,
    stock: 28,
    description: "Paper blending stumps for smooth pencil and charcoal shading.",
  },

  // DIGITAL ART
  {
    name: "XP-PEN Artist Glove",
    category: "Digital Art",
    price: 180,
    stock: 24,
    description: "A two-finger drawing glove for comfortable tablet use.",
  },
  {
    name: "Drawing Tablet Stand",
    category: "Digital Art",
    price: 650,
    stock: 8,
    description: "An adjustable stand for compatible drawing tablets.",
  },
  {
    name: "Replacement Stylus Nibs",
    category: "Digital Art",
    price: 220,
    stock: 15,
    description: "Replacement pen nibs for compatible digital drawing styluses.",
  },
  {
    name: "USB-C Drawing Tablet Cable",
    category: "Digital Art",
    price: 260,
    stock: 12,
    description: "A replacement USB-C cable for compatible drawing tablets.",
  },
  {
    name: "Digital Artist Shortcut Keypad",
    category: "Digital Art",
    price: 1890,
    stock: 6,
    description: "A shortcut keypad for common digital illustration commands.",
  },
  {
    name: "Tablet Screen Cleaning Kit",
    category: "Digital Art",
    price: 150,
    stock: 21,
    description: "A cleaning kit for compatible tablet screens.",
  },
];

async function seedProducts() {
  let added = 0;
  let skipped = 0;

  for (const item of products) {
    const category = await Category.findOne({
      where: { name: item.category },
    });

    if (!category) {
      throw new Error(`Category not found: ${item.category}`);
    }

    const [product, created] = await Product.findOrCreate({
      where: { name: item.name },
      defaults: {
        ...item,
        categoryId: category.id,
        isActive: true,
      },
    });

    if (created) {
      added++;
      console.log("Added:", product.name);
    } else {
      skipped++;
      console.log("Already exists:", item.name);
    }
  }

  console.log("\nProduct expansion complete!");
  console.log("Added:", added);
  console.log("Already existed:", skipped);
}

async function main() {
  try {
    await sequelize.authenticate();
    console.log("Database connected!");

    await seedProducts();
  } catch (error) {
    console.error("SEEDING ERROR:", error);
  } finally {
    await sequelize.close();
  }
}

main();
