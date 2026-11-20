
const sequelize = require("../config/database");
const Product = require("../models/Product");

const products = [
  {
    name: "Watercolor Paint Set",
    category: "Painting",
    price: 450,
    stock: 20,
  },
  {
    name: "Artist Brush Collection",
    category: "Painting",
    price: 320,
    stock: 15,
  },
  {
    name: "Acrylic Paint Set",
    category: "Painting",
    price: 580,
    stock: 12,
  },
  {
    name: "Premium Sketchbook",
    category: "Drawing",
    price: 250,
    stock: 30,
  },
  {
    name: "Alcohol Marker Set",
    category: "Drawing",
    price: 690,
    stock: 10,
  },
  {
    name: "Drawing Pencil Kit",
    category: "Drawing",
    price: 180,
    stock: 25,
  },
  {
    name: "XP-PEN Drawing Tablet",
    category: "Digital Art",
    price: 3499,
    stock: 8,
  },
  {
    name: "Digital Stylus Pen",
    category: "Digital Art",
    price: 1299,
    stock: 10,
  },
];

async function seedProducts() {
  try {
    await sequelize.authenticate();

    await Product.bulkCreate(products);

    console.log("Products added successfully!");
  } catch (error) {
    console.error("Error adding products:", error);
  } finally {
    await sequelize.close();
  }
}

seedProducts();
