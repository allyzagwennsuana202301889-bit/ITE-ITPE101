
const sequelize = require("../config/database");
const Product = require("../models/Product");

const descriptions = [
  {
    name: "Watercolor Paint Set",
    description: "A vibrant watercolor paint collection perfect for beginners and experienced artists. Ideal for painting landscapes, illustrations, and creative artwork.",
  },
  {
    name: "Artist Brush Collection",
    description: "A versatile collection of artist brushes with different shapes and sizes. Suitable for watercolor, acrylic, and other painting techniques.",
  },
  {
    name: "Acrylic Paint Set",
    description: "A rich and colorful acrylic paint set with excellent coverage. Perfect for canvas painting, crafts, and mixed-media artwork.",
  },
  {
    name: "Premium Sketchbook",
    description: "A high-quality sketchbook designed for drawing, sketching, and practicing artistic techniques. A great companion for everyday creativity.",
  },
  {
    name: "Alcohol Marker Set",
    description: "A colorful marker collection featuring smooth ink flow and blendable colors. Great for illustrations, coloring, and professional artwork.",
  },
  {
    name: "Drawing Pencil Kit",
    description: "A complete drawing pencil kit for sketching, shading, and creating detailed illustrations. Suitable for beginners and professional artists.",
  },
  {
    name: "XP-PEN Drawing Tablet",
    description: "A digital drawing tablet designed for digital illustration, graphic design, and creative projects. Perfect for artists exploring digital art.",
  },
  {
    name: "Digital Stylus Pen",
    description: "A digital stylus designed for compatible drawing devices. Helps artists create precise strokes, sketches, and digital illustrations.",
  },
];

async function updateDescriptions() {
  try {
    await sequelize.authenticate();

    for (const item of descriptions) {
      await Product.update(
        { description: item.description },
        { where: { name: item.name } }
      );
    }

    console.log("Product descriptions updated successfully!");
  } catch (error) {
    console.error("Error updating descriptions:", error);
  } finally {
    await sequelize.close();
  }
}

updateDescriptions();
