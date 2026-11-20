require("dotenv").config();
const bcrypt = require("bcryptjs");
const { sequelize, User, Category, Product, Coupon } = require("../models");
const categoryData = [
  ["Painting", "Paints, brushes, and painting supplies."],
  ["Drawing", "Pencils, markers, and drawing materials."],
  ["Digital Art", "Drawing tablets, styluses, and digital art tools."],
  ["Accessories", "Additional tools and accessories for artists."],
  ["Paper and Sketchbooks", "Sketchbooks, paper, and surfaces for artwork."],
];
const productData = [
  ["Watercolor Paint Set", "Painting", 450, 20, "A vibrant watercolor set for expressive painting."],
  ["Artist Brush Collection", "Painting", 320, 15, "A versatile collection of artist brushes."],
  ["Acrylic Paint Set", "Painting", 580, 12, "Rich acrylic colors for canvas and mixed media."],
  ["Premium Sketchbook", "Paper and Sketchbooks", 250, 30, "A smooth sketchbook for daily drawing."],
  ["Alcohol Marker Set", "Drawing", 690, 10, "Dual-tip markers for illustration and coloring."],
  ["Drawing Pencil Kit", "Drawing", 180, 25, "A graphite pencil set for sketching and shading."],
  ["XP-PEN Drawing Tablet", "Digital Art", 3499, 8, "A drawing tablet for digital creators."],
  ["Digital Stylus Pen", "Digital Art", 1299, 10, "A precision stylus for compatible tablets."],
  ["Gouache Paint Set", "Painting", 520, 14, "Opaque gouache colors for illustration."],
  ["Watercolor Paper Pad", "Paper and Sketchbooks", 280, 22, "Textured paper designed for watercolor."],
  ["Acrylic Paint Marker Set", "Painting", 430, 18, "Paint markers for bold details and lettering."],
  ["Palette Knife Set", "Accessories", 210, 16, "Palette knives for mixing and textured effects."],
  ["Round Watercolor Brush Set", "Painting", 350, 17, "Round brushes for washes and fine details."],
  ["Canvas Panel Pack", "Paper and Sketchbooks", 390, 13, "Canvas panels for acrylic and oil studies."],
  ["Fineliner Pen Set", "Drawing", 260, 24, "Fine-line pens for outlines and detail work."],
  ["Charcoal Drawing Set", "Drawing", 310, 11, "Charcoal tools for expressive tonal drawings."],
  ["Colored Pencil Set", "Drawing", 470, 19, "Colored pencils for layered illustration."],
  ["A4 Mixed Media Sketchbook", "Paper and Sketchbooks", 330, 21, "Mixed-media pages for a variety of materials."],
  ["Kneaded Eraser Pack", "Accessories", 95, 40, "Moldable erasers for precise graphite lifting."],
  ["Blending Stump Set", "Accessories", 120, 28, "Paper blending tools for smooth shading."],
];
async function seed() {
  try {
    const requiredPasswords = [process.env.SEED_ADMIN_PASSWORD, process.env.SEED_CUSTOMER1_PASSWORD, process.env.SEED_CUSTOMER2_PASSWORD];
    if (requiredPasswords.some(password => !password || password.length < 8)) throw new Error("Set SEED_ADMIN_PASSWORD, SEED_CUSTOMER1_PASSWORD, and SEED_CUSTOMER2_PASSWORD (at least 8 characters each) in server/.env before running the seed command.");
    await sequelize.authenticate();
    for (const [name, description] of categoryData) await Category.findOrCreate({ where: { name }, defaults: { description } });
    for (const [name, category, price, stock, description] of productData) {
      const cat = await Category.findOne({ where: { name: category } });
      await Product.findOrCreate({ where: { name }, defaults: { name, category, categoryId: cat.id, price, stock, description, isActive: true } });
    }
    const accounts = [
      { name: process.env.SEED_ADMIN_NAME || "Artistry Admin", email: process.env.SEED_ADMIN_EMAIL || "admin@artistry.local", role: "admin", password: process.env.SEED_ADMIN_PASSWORD },
      { name: "Artistry Customer One", email: process.env.SEED_CUSTOMER1_EMAIL || "customer1@artistry.local", role: "customer", password: process.env.SEED_CUSTOMER1_PASSWORD },
      { name: "Artistry Customer Two", email: process.env.SEED_CUSTOMER2_EMAIL || "customer2@artistry.local", role: "customer", password: process.env.SEED_CUSTOMER2_PASSWORD },
    ];
    for (const account of accounts) {
      if (!account.password || account.password.length < 8) throw new Error(`Set a password of at least 8 characters for ${account.email} in server/.env before seeding demo accounts.`);
      const passwordHash = await bcrypt.hash(account.password, 12);
      const [user, created] = await User.findOrCreate({ where: { email: account.email.toLowerCase() }, defaults: { name: account.name, email: account.email.toLowerCase(), role: account.role, passwordHash } });
      if (!created && account.role === "admin" && user.role !== "admin") await user.update({ role: "admin" });
    }
    const couponData = [
      { code: "CREATE10", discountType: "percentage", discountValue: 10, minimumSpend: 300, usageLimit: 100, perCustomerLimit: 1 },
      { code: "ART50", discountType: "fixed", discountValue: 50, minimumSpend: 500, usageLimit: 100, perCustomerLimit: 2 },
      { code: "WELCOME15", discountType: "percentage", discountValue: 15, minimumSpend: 800, usageLimit: 50, perCustomerLimit: 1 },
    ];
    for (const coupon of couponData) await Coupon.findOrCreate({ where: { code: coupon.code }, defaults: coupon });
    console.log("Phase 1 seed completed: 5 categories, 20 products, 1 admin, 2 customers, and 3 coupons.");
  } finally { await sequelize.close(); }
}
seed().catch(error => { console.error("Phase 1 seed failed:", error.message); process.exitCode = 1; });
