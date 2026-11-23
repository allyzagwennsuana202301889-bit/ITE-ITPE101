import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./App.css";
import AuthModal from "./AuthModal";
import { api } from "./api";
import OfflineBanner from "./components/OfflineBanner";
import ReloadPrompt from "./components/ReloadPrompt";
import BottomNav from "./components/BottomNav";
import SkeletonLoader from "./components/SkeletonLoader";
import CheckoutForm from "./components/CheckoutForm";
import useAuth from "./hooks/useAuth";
import useCart from "./hooks/useCart";
import useNetworkStatus from "./hooks/useNetworkStatus";

const AdminDashboard = lazy(() => import("./AdminDashboard"));
const OrderHistory = lazy(() => import("./OrderHistory"));
const AIAssistant = lazy(() => import("./AIAssistant"));

const productDetails = {
  1: { icon: "🎨", color: "pink", shortDescription: "24 vibrant watercolor shades" },
  2: { icon: "🖌️", color: "yellow", shortDescription: "A set of 12 versatile brushes" },
  3: { icon: "🧑‍🎨", color: "blue", shortDescription: "12 rich acrylic paint colors" },
  4: { icon: "📒", color: "green", shortDescription: "Thick, smooth 100-page paper" },
  5: { icon: "🖍️", color: "orange", shortDescription: "36 dual-tip art markers" },
  6: { icon: "✏️", color: "pink", shortDescription: "Complete graphite pencil set" },
  7: { icon: "🖥️", color: "blue", shortDescription: "Digital drawing tablet for creators" },
  8: { icon: "🖊️", color: "green", shortDescription: "Precision pen for digital artists" },
};

const productImages = {
  "Watercolor Paint Set": "watercolor.jpg",
  "Artist Brush Collection": "brush.jpg",
  "Acrylic Paint Set": "acylic.jpg",
  "Premium Sketchbook": "premiumsketchpad.jpg",
  "Alcohol Marker Set": "alchoholmarker.jpg",
  "Drawing Pencil Kit": "drawingpencilkit.jpg",
  "XP-PEN Drawing Tablet": "drawingtabletxppen.jpg",
  "Apple iPad": "Apple-iPad-10th-gen-hero-221018_Full-Bleed-Image.jpg.large.jpg",
  "Samsung Galaxy Tab": "galaxytab.jpg",
  "Digital Stylus Pen": "styluspen.png",
  "Gouache Paint Set": "guache.jpg",
  "Watercolor Paper Pad": "watercolorpaper.jpg",
  "Acrylic Paint Marker Set": "acylicmarker.jpg",
  "Palette Knife Set": "palette.jpg",
  "Round Watercolor Brush Set": "roundbrush.jpg",
  "Canvas Panel Pack": "canvas.jpg",
  "Fineliner Pen Set": "finelinerpenset.jpg",
  "Charcoal Drawing Set": "charcoaldrawingset.jpg",
  "Colored Pencil Set": "coloredpencilset.jpg",
  "A4 Mixed Media Sketchbook": "A4mixedmediasketchbook.jpg",
  "Kneaded Eraser Pack": "kneedederaser.jpg",
  "Blending Stump Set": "blendedstump.jpg",
  "XP-PEN Artist Glove": "artistglove.jpg",
  "Drawing Tablet Stand": "drawingtabletstand.jpg",
  "Replacement Stylus Nibs": "stylusnib.jpg",
  "USB-C Drawing Tablet Cable": "usbcdrawingtabletcable.jpg",
  "Digital Artist Shortcut Keypad": "shortcutkeypad.jpg",
  "Tablet Screen Cleaning Kit": "tabletscreencleaning.jpg",
};

function getProductImage(product) {
  if (product.imageUrl) return product.imageUrl;
  const file = productImages[product.name];
  return file ? `/images/${file}` : null;
}

async function fetchCompatibleAccessories(tabletProductId, options = {}) {
  const result = await api(
    `/compatibility/tablets/${tabletProductId}/accessories`,
    options
  );
  if (!Array.isArray(result.data)) {
    throw new Error("The compatibility API returned an unexpected response.");
  }
  return result.data;
}

function CompatibilityTabletDropdown({
  tablets,
  selectedTabletId,
  onChange,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);
  const options = [
    { id: "", name: "Select a drawing tablet" },
    ...tablets,
  ];
  const selectedIndex = options.findIndex(
    (option) => String(option.id) === String(selectedTabletId)
  );
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : options[0];
  const activeOption = options[activeIndex];
  const selectedImage =
    selectedIndex > 0 ? getProductImage(selectedOption) : null;
  const menuId = "compatibility-tablet-options";

  useEffect(() => {
    if (!isOpen) return undefined;

    function closeOnOutsidePointer(event) {
      if (!dropdownRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    menuRef.current
      .querySelector(`[data-option-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen]);

  function chooseOption(option) {
    onChange(String(option.id));
    setIsOpen(false);
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;

      if (!isOpen) {
        setActiveIndex(
          selectedIndex >= 0
            ? selectedIndex
            : direction > 0
              ? 0
              : options.length - 1
        );
        setIsOpen(true);
      } else {
        setActiveIndex(
          (index) => (index + direction + options.length) % options.length
        );
      }
      return;
    }

    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : options.length - 1);
      setIsOpen(true);
      return;
    }

    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      setIsOpen(false);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (isOpen && activeOption) {
        chooseOption(activeOption);
      } else {
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
        setIsOpen(true);
      }
    }
  }

  return (
    <div
      className={`compatibility-tablet-controls${isOpen ? " is-open" : ""}`}
      ref={dropdownRef}
      onBlur={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          setIsOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="compatibility-tablet-select"
        role="combobox"
        aria-label="Select a drawing tablet"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-activedescendant={
          isOpen ? `compatibility-tablet-option-${activeIndex}` : undefined
        }
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
          } else {
            setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
            setIsOpen(true);
          }
        }}
        onKeyDown={handleKeyDown}
      >
        <span className="compatibility-tablet-selected-value">
          {selectedImage && <img src={selectedImage} alt="" />}
          <span>{selectedOption.name}</span>
        </span>
      </button>

      {isOpen && (
        <div
          className="compatibility-tablet-menu"
          id={menuId}
          role="listbox"
          aria-label="Available drawing tablets"
          ref={menuRef}
        >
          {options.map((option, index) => (
            <div
              className="compatibility-tablet-option"
              data-active={index === activeIndex}
              data-option-index={index}
              id={`compatibility-tablet-option-${index}`}
              key={option.id || "placeholder"}
              role="option"
              aria-selected={String(option.id) === String(selectedTabletId)}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => chooseOption(option)}
            >
              {getProductImage(option) && (
                <img src={getProductImage(option)} alt="" loading="lazy" />
              )}
              <span>{option.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function isDrawingTabletProduct(product) {
  const name = String(product?.name || "");
  return (
    /\b(?:drawing|graphics)\s+tablet\b/i.test(name) &&
    !/\b(?:stand|cable)\b/i.test(name)
  );
}

function CompatibleAccessoryGrid({
  accessories,
  cartBusy,
  isOnline,
  onAddToCart,
  onViewAccessory,
}) {
  return (
    <div className="product-grid compatibility-accessory-grid">
      {accessories.map((accessory) => (
        <article className="product-card compatibility-accessory-card" key={accessory.id}>
          <div className="product-art">
            {getProductImage(accessory) ? (
              <img
                className="product-img"
                src={getProductImage(accessory)}
                alt={accessory.name}
                loading="lazy"
              />
            ) : (
              <span className="product-emoji">🖊️</span>
            )}
          </div>

          <div className="product-info">
            <h3>{accessory.name}</h3>
            <p>{accessory.description}</p>

            {accessory.compatibilityNotes && (
              <p className="compatibility-accessory-notes">
                <strong>Compatibility:</strong>{" "}
                {accessory.compatibilityNotes}
              </p>
            )}

            <div className="product-bottom">
              <strong>₱{Number(accessory.price).toLocaleString("en-PH")}</strong>
              <button
                type="button"
                disabled={accessory.stock <= 0 || cartBusy || !isOnline}
                title={!isOnline ? "Reconnect to add items to your cart" : undefined}
                onClick={() => onAddToCart(accessory)}
              >
                {accessory.stock <= 0 ? "Out of stock" : "+ Add"}
              </button>
            </div>

            <button
              type="button"
              className="compatibility-view-button"
              onClick={() => onViewAccessory(accessory)}
            >
              View accessory
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function ProductCompatibilitySection({
  tabletProductId,
  cartBusy,
  isOnline,
  onAddToCart,
  onViewAccessory,
}) {
  const [compatibility, setCompatibility] = useState({
    accessories: [],
    loading: true,
    error: "",
  });

  useEffect(() => {
    const controller = new AbortController();
    fetchCompatibleAccessories(tabletProductId, {
      signal: controller.signal,
    })
      .then((accessories) => {
        if (controller.signal.aborted) return;
        setCompatibility({ accessories, loading: false, error: "" });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setCompatibility({
          accessories: [],
          loading: false,
          error: error.message,
        });
      });

    return () => controller.abort();
  }, [tabletProductId]);

  return (
    <section className="detail-compatibility">
      <h3>Device Compatibility</h3>

      {compatibility.loading ? (
        <p role="status">Loading compatible accessories...</p>
      ) : compatibility.error ? (
        <p role="alert">
          Could not load compatible accessories: {compatibility.error}
        </p>
      ) : compatibility.accessories.length === 0 ? (
        <p>No compatible accessories currently listed.</p>
      ) : (
        <CompatibleAccessoryGrid
          accessories={compatibility.accessories}
          cartBusy={cartBusy}
          isOnline={isOnline}
          onAddToCart={onAddToCart}
          onViewAccessory={onViewAccessory}
        />
      )}
    </section>
  );
}

const categories = [
  "All Supplies",
  "Painting",
  "Drawing",
  "Digital Art",
  "Accessories",
  "Paper and Sketchbooks",
];

// Scrolls to a section after React has finished drawing the page
function scrollToId(id) {
  setTimeout(
    () =>
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
    0
  );
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isOnline } = useNetworkStatus();
  const { user, authMode, openAuth, closeAuth, handleAuthSuccess, logout } = useAuth();
  const { cart, setCart, cartOpen, setCartOpen, cartBusy, setCartBusy } = useCart();

  const requireOnline = () => {
    if (!isOnline) {
      alert("This action requires an internet connection. Please reconnect and try again.");
      return false;
    }
    return true;
  };

  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState("All Supplies");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [tabletAccountOpen, setTabletAccountOpen] = useState(false);

  useEffect(() => {
    if (!tabletAccountOpen) return;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setTabletAccountOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [tabletAccountOpen]);

  // Which page is showing: "shop" | "kit" | "compatibility"
  const [activePage, setActivePage] = useState("shop");
  const [isPhoneViewport, setIsPhoneViewport] = useState(() =>
    window.matchMedia("(max-width: 600px)").matches
  );
  const isMobileShopPage =
    isPhoneViewport &&
    (location.pathname === "/shop" || location.pathname === "/products");

  useEffect(() => {
    const phoneMediaQuery = window.matchMedia("(max-width: 600px)");
    const updatePhoneViewport = () =>
      setIsPhoneViewport(phoneMediaQuery.matches);

    phoneMediaQuery.addEventListener("change", updatePhoneViewport);
    return () =>
      phoneMediaQuery.removeEventListener("change", updatePhoneViewport);
  }, []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [orderDetail, setOrderDetail] = useState(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [orderDetailError, setOrderDetailError] = useState("");

  // L3: Custom Art Kit Builder
  const [kitName, setKitName] = useState("");
  const [kitDescription, setKitDescription] = useState("");
  const [kitItems, setKitItems] = useState([]);
  const [savedKits, setSavedKits] = useState([]);
  const [kitBusy, setKitBusy] = useState(false);
  const [kitMessage, setKitMessage] = useState("");
  const [editingKitId, setEditingKitId] = useState(null);
  const [kitSearch, setKitSearch] = useState("");
  const [kitSearchOpen, setKitSearchOpen] = useState(false);
  const kitSearchRef = useRef(null);
  // Which half of the Art Kit section is showing: "build" | "saved"
  const [kitView, setKitView] = useState("build");
  const [kitCartMessage, setKitCartMessage] = useState({ kitId: null, text: "" });

  // L3: Device Compatibility Checker
  const [tablets, setTablets] = useState([]);
  const [tabletsLoading, setTabletsLoading] = useState(true);
  const [selectedTabletId, setSelectedTabletId] = useState("");
  const [compatibleAccessories, setCompatibleAccessories] = useState([]);
  const [compatibilityLoading, setCompatibilityLoading] = useState(false);
  const [compatibilityError, setCompatibilityError] = useState("");

  // Return to the product catalog
  const closeProductDetails = () => {
    setSelectedProduct(null);
    setSelectedQuantity(1);
    setDetailsError("");
  };

  // Switch pages while keeping the browser URL in sync.
  function goTo(page, anchorId) {
    closeProductDetails();
    setActivePage(page);

    let path = "/";
    if (page === "kit") path = "/art-kit";
    else if (page === "compatibility") path = "/compatibility";
    else if (anchorId === "shop" || anchorId === "categories") path = "/shop";

    if (location.pathname !== path) navigate(path);
    if (anchorId) {
      const opensMobileShop =
        isPhoneViewport &&
        page === "shop" &&
        (anchorId === "shop" || anchorId === "categories")
      const opensMobileKit = isPhoneViewport && page === "kit";
      if (opensMobileShop || opensMobileKit) {
        setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 0);
      } else {
        scrollToId(anchorId);
      }
    }
  }

  // Keep the displayed page synchronized with browser navigation and deep links.
  useEffect(() => {
    let cancelled = false;
    const productMatch = location.pathname.match(/^\/products\/(\d+)$/);

    window.queueMicrotask(() => {
      if (cancelled) return;

      if (location.pathname === "/login" || location.pathname === "/register") {
      openAuth(location.pathname === "/register" ? "signup" : "login");
      setActivePage("shop");
      } else if (location.pathname === "/cart") {
        if (user) setCartOpen(true);
        else openAuth("login");
        setActivePage("shop");
      } else if (location.pathname === "/checkout") {
        if (user) {
          setCartOpen(false);
          setCheckoutOpen(true);
        }
        else openAuth("login");
        setActivePage("shop");
      } else if (location.pathname === "/admin" || location.pathname.startsWith("/admin/")) {
        if (user?.role === "admin") setAdminOpen(true);
        setActivePage("shop");
      } else if (location.pathname === "/orders") {
        if (user) setOrdersOpen(true);
        else openAuth("login");
        setActivePage("shop");
      } else if (/^\/orders\/[^/]+$/.test(location.pathname)) {
        setActivePage("shop");
        setOrderDetailLoading(true);
        setOrderDetailError("");
        const orderId = location.pathname.split("/").pop();
        api(`/orders/${orderId}`)
          .then((data) => {
            if (!cancelled) setOrderDetail(data.order || data.data?.order || data);
          })
          .catch((error) => {
            if (!cancelled) setOrderDetailError(error.message);
          })
          .finally(() => {
            if (!cancelled) setOrderDetailLoading(false);
          });
      } else if (location.pathname === "/ai-assistant") {
        setActivePage("shop");
      } else if (location.pathname === "/payment/failed") {
        setActivePage("shop");
        setPaymentStatus({
          loading: false,
          cancelled: true,
          failed: true,
          order: null,
          error: "The payment was not completed. No payment status has been confirmed.",
        });
      } else if (location.pathname === "/payment/success" || location.pathname === "/payment/cancelled") {
        setActivePage("shop");
        setPaymentStatus({ loading: true, cancelled: location.pathname.endsWith("cancelled"), order: null, error: "" });
        const orderId = new URLSearchParams(location.search).get("orderId") || new URLSearchParams(location.search).get("order");
        if (!orderId) {
          setPaymentStatus({ loading: false, cancelled: location.pathname.endsWith("cancelled"), order: null, error: "No order ID was provided in the return URL." });
        } else {
          api(`/orders/${orderId}`)
            .then((data) => {
              if (!cancelled) setPaymentStatus({ loading: false, cancelled: location.pathname.endsWith("cancelled"), order: data.data?.order || data.order || data, error: "" });
            })
            .catch((error) => {
              if (!cancelled) setPaymentStatus({ loading: false, cancelled: location.pathname.endsWith("cancelled"), order: null, error: error.message });
            });
        }
      } else if (location.pathname === "/art-kit") {
        setActivePage("kit");
        setSelectedProduct(null);
        setDetailsLoading(false);
        setDetailsError("");
      } else if (location.pathname === "/compatibility") {
        setActivePage("compatibility");
        setSelectedProduct(null);
        setDetailsLoading(false);
        setDetailsError("");
      } else if (productMatch) {
        setActivePage("shop");
        setSelectedProduct(null);
        const productId = Number(productMatch[1]);
        setSelectedQuantity(1);
        setDetailsLoading(true);
        setDetailsError("");

        api(`/products/${productId}`)
          .then((data) => {
            if (cancelled) return;
            const productData = data.data || data.product || data;
            setSelectedProduct({
              ...productData,
              price: Number(productData.price),
              ...(productDetails[productData.id] || {}),
            });
          })
          .catch((error) => {
            if (cancelled) return;
            setSelectedProduct(null);
            setDetailsError(error.message);
          })
          .finally(() => {
            if (!cancelled) setDetailsLoading(false);
          });
      } else {
        setActivePage("shop");
        setSelectedProduct(null);
        setDetailsLoading(false);
        setDetailsError("");
      }
    });

    return () => { cancelled = true; };
  }, [location.pathname, location.search, user, openAuth, setCartOpen]);

  function handleLogout() {
    logout();
    setCartOpen(false);
    setOrdersOpen(false);
    setAdminOpen(false);
    setCart([]);
    setSavedKits([]);
    setKitItems([]);
    setKitName("");
    setKitDescription("");
    setKitMessage("");
    setEditingKitId(null);
    goTo("shop");
  }

  // Fetch all products (the API allows up to 100 per request)
  useEffect(() => {
    const controller = new AbortController();
    api("/products?limit=100", { signal: controller.signal })
      .then((data) => {
        const productList = Array.isArray(data) ? data : data.data || data.products;

        if (!Array.isArray(productList)) {
          throw new Error("The products API returned an unexpected response.");
        }

        const productsWithDetails = productList.map((product) => ({
          ...product,
          price: Number(product.price),
          ...(productDetails[product.id] || {}),
        }));

        setProducts(productsWithDetails);
        setLoading(false);
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setError(error.message);
        setLoading(false);
      });
    return () => controller.abort();
  }, []);

  // L3: Load the customer's saved art kits
  const loadSavedKits = useCallback(async () => {
    if (!user) return;

    try {
      const result = await api("/art-kits");
      setSavedKits(result.data || []);
    } catch (error) {
      setKitMessage(error.message);
    }
  }, [user]);

  // L3: Load available drawing tablets
  async function loadTablets() {
    setTabletsLoading(true);
    setCompatibilityError("");
    try {
      const result = await api("/compatibility/tablets");
      if (!Array.isArray(result.data)) {
        throw new Error("The compatibility API returned an unexpected response.");
      }
      setTablets(result.data);
    } catch (error) {
      setCompatibilityError(error.message);
    } finally {
      setTabletsLoading(false);
    }
  }

  // Load tablet options when the app opens
  useEffect(() => {
    window.queueMicrotask(() => {
      void loadTablets();
    });
  }, []);

  // Load saved kits when the customer logs in
  useEffect(() => {
    if (user) {
      window.queueMicrotask(() => {
        void loadSavedKits();
      });
    } else {
      window.queueMicrotask(() => {
        setSavedKits([]);
      });
    }
  }, [user, loadSavedKits]);

  // L3: Add a product to the kit
  function addKitItem(productId) {
    const id = Number(productId);
    const product = products.find((p) => p.id === id);

    if (!product || product.stock <= 0) {
      setKitMessage("This product is currently out of stock.");
      return;
    }

    const existingItem = kitItems.find((item) => item.productId === id);

    if (existingItem) {
      if (existingItem.quantity >= product.stock) {
        setKitMessage(`Only ${product.stock} units are available.`);
        return;
      }

      setKitItems((current) =>
        current.map((item) =>
          item.productId === id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setKitItems((current) => [...current, { productId: id, quantity: 1 }]);
    }

    setKitMessage("");
  }

  // L3: Change the quantity of a kit item
  function updateKitItemQuantity(productId, quantity) {
    const parsedQuantity = Number(quantity);
    const product = products.find((p) => p.id === Number(productId));

    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) return;

    if (!product || parsedQuantity > product.stock) {
      setKitMessage(
        product
          ? `Only ${product.stock} units are available.`
          : "Product is unavailable."
      );
      return;
    }

    setKitMessage("");

    setKitItems((current) =>
      current.map((item) =>
        item.productId === Number(productId)
          ? { ...item, quantity: parsedQuantity }
          : item
      )
    );
  }

  // L3: Remove an item from the kit
  function removeKitItem(productId) {
    setKitItems((current) =>
      current.filter((item) => item.productId !== productId)
    );
  }

  // L3: Save a new custom art kit, or update the one being edited
  async function saveArtKit(event) {
    event.preventDefault();
    if (!requireOnline()) return;

    if (!user) {
      openAuth("login");
      return;
    }

    if (!kitName.trim()) {
      setKitMessage("Please enter a name for your art kit.");
      return;
    }

    if (kitItems.length === 0) {
      setKitMessage("Please add at least one product to your kit.");
      return;
    }

    try {
      setKitBusy(true);
      setKitMessage("");

      const isEditing = editingKitId !== null;

      await api(isEditing ? `/art-kits/${editingKitId}` : "/art-kits", {
        method: isEditing ? "PATCH" : "POST",
        body: JSON.stringify({
          name: kitName.trim(),
          description: kitDescription.trim(),
          items: kitItems,
        }),
      });

      setKitName("");
      setKitDescription("");
      setKitItems([]);
      setEditingKitId(null);

      setKitMessage(
        isEditing
          ? "Your art kit was updated successfully."
          : "Your art kit was saved successfully."
      );

      await loadSavedKits();
    } catch (error) {
      setKitMessage(error.message);
    } finally {
      setKitBusy(false);
    }
  }

  // L3: Load a saved kit back into the builder for editing
  function editArtKit(kit) {
    setEditingKitId(kit.id);
    setKitView("build");
    setKitName(kit.name || "");
    setKitDescription(kit.description || "");

    setKitItems(
      (kit.items || []).map((item) => ({
        productId: Number(item.productId ?? item.product?.id),
        quantity: Number(item.quantity),
      }))
    );

    setKitMessage(`Editing "${kit.name}". Make your changes below.`);
    goTo("kit", "art-kit-builder");
  }

  function cancelKitEdit() {
    setEditingKitId(null);
    setKitName("");
    setKitDescription("");
    setKitItems([]);
    setKitMessage("Editing cancelled.");
  }

  // L3: Delete a saved art kit
  async function deleteArtKit(kitId) {
    if (!requireOnline()) return;
    if (!window.confirm("Are you sure you want to delete this art kit?")) {
      return;
    }

    try {
      setKitBusy(true);
      await api(`/art-kits/${kitId}`, { method: "DELETE" });

      // If the deleted kit was open in the builder, clear the builder too.
      if (editingKitId === kitId) {
        setEditingKitId(null);
        setKitName("");
        setKitDescription("");
        setKitItems([]);
      }

      setKitMessage("Art kit deleted successfully.");
      await loadSavedKits();
    } catch (error) {
      setKitMessage(error.message);
    } finally {
      setKitBusy(false);
    }
  }

  // L3: Find accessories compatible with the selected tablet
  async function handleTabletChange(tabletId) {
    setSelectedTabletId(tabletId);
    setCompatibleAccessories([]);
    setCompatibilityError("");

    if (!tabletId) return;
    if (!requireOnline()) return;

    try {
      setCompatibilityLoading(true);

      const accessories = await fetchCompatibleAccessories(tabletId);
      setCompatibleAccessories(accessories);
    } catch (error) {
      setCompatibilityError(error.message);
    } finally {
      setCompatibilityLoading(false);
    }
  }

  // Add a saved kit's products to the existing cart (server validates stock).
  async function addKitToCart(kit) {
    if (!requireOnline()) return;
    if (!user) {
      openAuth("login");
      return;
    }

    try {
      setKitBusy(true);
      setKitCartMessage({ kitId: kit.id, text: "" });

      const result = await api(`/art-kits/${kit.id}/add-to-cart`, {
        method: "POST",
      });

      const { added = [], skipped = [] } = result.data || {};

      // Refresh from the existing cart endpoint so the cart drawer is accurate.
      const cartData = await api("/cart");
      setCart(cartData.cart.items);

      const parts = [];
      if (added.length > 0) {
        parts.push(
          `${added.length} product${added.length === 1 ? "" : "s"} from "${kit.name}" added to your cart.`
        );
      } else {
        parts.push("No products could be added to your cart.");
      }
      if (skipped.length > 0) {
        parts.push(`Not added: ${skipped.map((x) => x.message).join(" ")}`);
      }

      setKitCartMessage({ kitId: kit.id, text: parts.join(" ") });

      // Open the cart so the user can review it before checkout.
      if (added.length > 0) setCartOpen(true);
    } catch (e) {
      setKitCartMessage({ kitId: kit.id, text: e.message });
    } finally {
      setKitBusy(false);
    }
  }

  // Close the search dropdown when the customer clicks anywhere outside it.
  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (kitSearchRef.current && !kitSearchRef.current.contains(event.target)) {
        setKitSearchOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  // Art Kit Builder: search the already-loaded catalog (same data as the Shop).
  const KIT_SEARCH_LIMIT = 12;
  const kitSearchMatches = useMemo(() => {
    const query = kitSearch.trim().toLowerCase();
    if (!query) return [];

    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        String(product.category || "").toLowerCase().includes(query)
    );
  }, [products, kitSearch]);

  const compatibilityTablet = selectedProduct
    ? tablets.find((tablet) => Number(tablet.id) === Number(selectedProduct.id))
    : null;
  const detailTabletProductId =
    selectedProduct && (compatibilityTablet || isDrawingTabletProduct(selectedProduct))
      ? Number(compatibilityTablet?.id ?? selectedProduct.id)
      : null;

  // Search and category filtering
  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => {
        const matchesCategory =
          category === "All Supplies" || product.category === category;

        const matchesSearch = product.name
          .toLowerCase()
          .includes(search.toLowerCase());

        const matchesMin = minPrice === "" || product.price >= Number(minPrice);

        const matchesMax = maxPrice === "" || product.price <= Number(maxPrice);

        return matchesCategory && matchesSearch && matchesMin && matchesMax;
      })
      .sort((a, b) =>
        sortOrder === "price-low"
          ? a.price - b.price
          : sortOrder === "price-high"
            ? b.price - a.price
            : sortOrder === "name"
              ? a.name.localeCompare(b.name)
              : b.id - a.id
      );
  }, [products, category, search, minPrice, maxPrice, sortOrder]);

  // Open a product's individual details page.
  const openProductDetails = (product) => {
    navigate(`/products/${product.id}`);
  };

  async function addToCart(product, quantity = 1) {
    if (!requireOnline()) return;
    if (!user) {
      openAuth("login");
      return;
    }

    try {
      setCartBusy(true);

      const data = await api("/cart/items", {
        method: "POST",
        body: JSON.stringify({
          productId: product.id,
          quantity,
        }),
      });

      setCart(data.cart.items);
    } catch (e) {
      const message =
        e.code === "COUPON_EXPIRED"
          ? "That coupon has expired. Remove it or enter a valid coupon code."
          : e.status === 409
            ? "Checkout could not be completed because of a stock or order conflict."
            : e.status === 422
              ? "Please review the shipping address and coupon fields."
              : e.status === 403
                ? "You do not have permission to complete this checkout."
                : e.message;
      alert(message);
    } finally {
      setCartBusy(false);
    }
  }

  // Cart item ids are product ids (that is what the API uses in /cart/items/:id)
  async function updateQuantity(id, change) {
    if (!requireOnline()) return;
    const item = cart.find((x) => x.id === id);
    if (!item) return;

    const quantity = item.quantity + change;

    if (quantity < 1) return removeFromCart(id);

    try {
      const data = await api(`/cart/items/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity }),
      });

      setCart(data.cart.items);
    } catch (e) {
      alert(e.message);
    }
  }

  async function removeFromCart(id) {
    if (!requireOnline()) return;
    try {
      const data = await api(`/cart/items/${id}`, {
        method: "DELETE",
      });

      setCart(data.cart.items);
    } catch (e) {
      alert(e.message);
    }
  }

  // Checkout with an idempotency key to prevent duplicate orders.
  async function checkout({ shippingAddress, couponCode }) {
    if (!requireOnline()) return;
    if (!user) {
      openAuth("login");
      return;
    }

    const storageKey = `artistry_checkout_key_${user.id}`;

    try {
      setCartBusy(true);

      let idempotencyKey = sessionStorage.getItem(storageKey);
      if (!idempotencyKey) {
        idempotencyKey = crypto.randomUUID();
        sessionStorage.setItem(storageKey, idempotencyKey);
      }

      const result = await api("/checkout", {
        method: "POST",
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          shippingAddress,
          couponCode,
        }),
      });

      if (!result.checkoutUrl) {
        throw new Error("Maya did not return a checkout URL.");
      }

      sessionStorage.removeItem(storageKey);
      window.location.assign(result.checkoutUrl);
    } catch (e) {
      setCartBusy(false);
      throw e;
    }
  }

  // Calculate cart count and subtotal
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  const cartTotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  // Calculate custom kit subtotal
  const kitTotal = kitItems.reduce((total, item) => {
    const product = products.find((p) => p.id === item.productId);
    return total + (product ? product.price * item.quantity : 0);
  }, 0);

  // Stop a link from jumping around, then switch page.
  const navClick = (page, anchorId) => (event) => {
    event.preventDefault();
    goTo(page, anchorId);
  };

  const validPaths = [
    "/", "/shop", "/products", "/art-kit", "/compatibility",
    "/login", "/register", "/cart", "/checkout", "/orders",
    "/ai-assistant", "/payment/success", "/payment/cancelled", "/payment/failed",
    "/admin",
  ];
  const isProductRoute = /^\/products\/\d+$/.test(location.pathname);
  const isPaymentRoute = /^\/payment\/(success|cancelled|failed)$/.test(location.pathname);
  const isOrderDetailRoute = /^\/orders\/[^/]+$/.test(location.pathname);
  const isNotFound =
    !validPaths.includes(location.pathname) &&
    !isProductRoute &&
    !isOrderDetailRoute &&
    !location.pathname.startsWith("/admin/");

  if (isNotFound) {
    return (
      <div className="app">
        <main className="not-found-page">
          <h1>404</h1>
          <h2>Page Not Found</h2>
          <p>Sorry, the page you're looking for doesn't exist.</p>
          <button type="button" className="detail-add-button" onClick={() => navigate("/")}>Return Home</button>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Navigation */}
      <header className={ordersOpen ? "navbar orders-open" : "navbar"}>
        <div className="tablet-menu">
          <button
            type="button"
            className="tablet-menu-toggle"
            aria-label={tabletAccountOpen ? "Close menu" : "Open menu"}
            aria-expanded={tabletAccountOpen}
            aria-controls="tablet-navigation-menu"
            onClick={() => setTabletAccountOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
          {tabletAccountOpen && (
            <div id="tablet-navigation-menu" className="tablet-menu-panel">
              {user ? (
                <>
                  <p className="tablet-menu-greeting">Hi, {user.name.split(" ")[0]}</p>
                  <button type="button" onClick={() => { setTabletAccountOpen(false); setOrdersOpen(true); }}>
                    My Orders
                  </button>
                  {user.role === "admin" && (
                    <button type="button" onClick={() => { setTabletAccountOpen(false); setAdminOpen(true); }}>
                      Admin
                    </button>
                  )}
                  <button type="button" className="tablet-menu-cart" onClick={() => { setTabletAccountOpen(false); setCartOpen(true); }}>
                    Cart <span>{cartCount}</span>
                  </button>
                  <button type="button" onClick={() => { setTabletAccountOpen(false); handleLogout(); }}>
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => { setTabletAccountOpen(false); openAuth("login"); }}>Log in</button>
                  <button type="button" onClick={() => { setTabletAccountOpen(false); openAuth("signup"); }}>Sign up</button>
                </>
              )}
            </div>
          )}
        </div>

        <a className="brand" href="#home" onClick={navClick("shop", "home")}>
          <span className="brand-icon">✳</span>
          artistry<span className="brand-dot">.</span>
        </a>

        <nav className="nav-links">
          <a href="#home" onClick={navClick("shop", "home")}>
            Home
          </a>
          <a href="#shop" onClick={navClick("shop", "shop")}>
            Shop
          </a>
          <a href="#categories" onClick={navClick("shop", "categories")}>
            Categories
          </a>
          <a
            href="#art-kit-builder"
            onClick={(event) => {
              setKitView("build");
              navClick("kit", "art-kit-builder")(event);
            }}
          >
            Build a Kit
          </a>
          <a
            href="#compatibility"
            onClick={navClick("compatibility", "compatibility")}
          >
            Compatibility
          </a>
        </nav>

        <div className="nav-actions">
          {user ? (
            <>
              <span className="nav-user">Hi, {user.name.split(" ")[0]}</span>

              <button
                className="nav-link-button"
                onClick={() => setOrdersOpen(true)}
              >
                My orders
              </button>

              {user.role === "admin" && (
                <button
                  className="nav-link-button"
                  onClick={() => setAdminOpen(true)}
                >
                  Admin
                </button>
              )}

              <button className="nav-link-button" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <button
                className="nav-link-button"
                onClick={() => openAuth("login")}
              >
                Log in
              </button>

              <button
                className="nav-signup-button"
                onClick={() => openAuth("signup")}
              >
                Sign up
              </button>
            </>
          )}

          {user && (
            <button className="cart-button" onClick={() => setCartOpen(true)}>
              🛍️ Cart <span>{cartCount}</span>
            </button>
          )}
        </div>
      </header>

      <OfflineBanner isOnline={isOnline} />
      <ReloadPrompt />

      {!adminOpen && !ordersOpen && (
        <BottomNav
          activePage={isMobileShopPage ? "catalog" : activePage}
          user={user}
          onNavigate={(page, anchorId) => {
            if (page === "kit") setKitView("build");
            goTo(page, anchorId);
          }}
          onAccount={() => {
            if (!user) openAuth("login");
            else if (user.role === "admin") setAdminOpen(true);
            else setOrdersOpen(true);
          }}
        />
      )}

      <main>
        {isPaymentRoute ? (
          <section className="not-found-page payment-return-page">
            {paymentStatus?.loading ? (
              <p>Verifying your payment status with the server...</p>
            ) : (
              <>
                <h2>{paymentStatus?.failed ? "Payment failed" : paymentStatus?.cancelled ? "Payment cancelled" : "Payment return"}</h2>
                <p>{paymentStatus?.error || "Payment status is informational. The server order record is shown below."}</p>
                {paymentStatus?.order && (
                  <div className="payment-status-card">
                    <strong>Order #{paymentStatus.order.id || paymentStatus.order.orderId || "—"}</strong>
                    <span>Status: {paymentStatus.order.status || paymentStatus.order.paymentStatus || "Unknown"}</span>
                  </div>
                )}
                <button type="button" className="detail-add-button" onClick={() => navigate("/")}>Return Home</button>
              </>
            )}
          </section>
        ) : isOrderDetailRoute ? (
          <section className="not-found-page payment-return-page">
            <h2>Order details</h2>
            {orderDetailLoading && <p>Loading order details...</p>}
            {orderDetailError && <p className="empty-message">{orderDetailError}</p>}
            {!orderDetailLoading && orderDetail && (
              <div className="payment-status-card">
                <strong>{orderDetail.orderNumber || `Order #${orderDetail.id}`}</strong>
                <span>Status: {orderDetail.status || "Unknown"}</span>
                <span>Total: ₱{Number(orderDetail.total || 0).toLocaleString("en-PH")}</span>
              </div>
            )}
            <button type="button" className="detail-add-button" onClick={() => navigate("/orders")}>Back to orders</button>
          </section>
        ) : isProductRoute && activePage === "shop" ? (
          /* PRODUCT DETAILS PAGE */
          <section className="product-detail-page">
            <button
              type="button"
              className="back-button"
              onClick={() => {
                closeProductDetails();
                navigate("/products");
              }}
            >
              ← Back to Shop
            </button>

            {(detailsLoading || (!selectedProduct && !detailsError)) && (
              <SkeletonLoader count={1} />
            )}

            {detailsError && (
              <p className="empty-message" role="alert">
                Could not load this product: {detailsError}
              </p>
            )}

            {!detailsLoading && selectedProduct && (
              <>
              <div className="product-detail-layout">
                <div className={`detail-product-art ${selectedProduct.color}`}>
                  {getProductImage(selectedProduct) ? (
                    <img
                      className="detail-img"
                      src={getProductImage(selectedProduct)}
                      alt={selectedProduct.name}
                    />
                  ) : (
                    <span>{selectedProduct.icon}</span>
                  )}
                </div>

                <div className="detail-product-info">
                  <span className="detail-category">
                    {selectedProduct.category}
                  </span>

                  <h1>{selectedProduct.name}</h1>

                  <h2>₱{Number(selectedProduct.price).toLocaleString("en-PH")}</h2>

                  <p className="detail-description">
                    {selectedProduct.description || "No description available."}
                  </p>

                  <p className="detail-stock">
                    {selectedProduct.stock > 0
                      ? `${selectedProduct.stock} items available`
                      : "Out of stock"}
                  </p>

                  {selectedProduct.stock > 0 && (
                    <div className="detail-quantity">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedQuantity((q) => Math.max(1, q - 1))
                        }
                        disabled={selectedQuantity <= 1}
                      >
                        −
                      </button>

                      <span>{selectedQuantity}</span>

                      <button
                        type="button"
                        onClick={() =>
                          setSelectedQuantity((q) =>
                            Math.min(selectedProduct.stock, q + 1)
                          )
                        }
                        disabled={selectedQuantity >= selectedProduct.stock}
                      >
                        +
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    className="detail-add-button"
                    disabled={selectedProduct.stock <= 0 || cartBusy || !isOnline}
                    title={!isOnline ? "Reconnect to add items to your cart" : undefined}
                    onClick={() => {
                      if (!requireOnline()) return;
                      addToCart(selectedProduct, selectedQuantity);
                      closeProductDetails();
                      navigate("/products");
                    }}
                  >
                    {selectedProduct.stock <= 0 ? "Out of stock" : "Add to Cart"}
                  </button>

                  {selectedProduct.stock > 0 && (
                    <button
                      type="button"
                      className="back-button"
                      onClick={() => {
                        if (!requireOnline()) return;
                        addKitItem(selectedProduct.id);
                        setKitView("build");
                        goTo("kit", "art-kit-builder");
                      }}
                    >
                      Add to Art Kit
                    </button>
                  )}

                </div>
              </div>
              {detailTabletProductId !== null && (
                <ProductCompatibilitySection
                  key={detailTabletProductId}
                  tabletProductId={detailTabletProductId}
                  cartBusy={cartBusy}
                  isOnline={isOnline}
                  onAddToCart={addToCart}
                  onViewAccessory={openProductDetails}
                />
              )}
              </>
            )}
          </section>
        ) : activePage === "kit" ? (
          /* L3 FEATURE 1: CUSTOM ART KIT BUILDER */
          <section className="shop-section" id="art-kit-builder">
            <div className="shop-heading">
              <div className="kit-heading-block">
                <span className="eyebrow">MAKE IT YOURS</span>

                <div className="kit-headings">
                  <h2>
                    <button
                      type="button"
                      className={`kit-heading-link${kitView === "build" ? " is-active" : ""}`}
                      aria-current={kitView === "build" ? "page" : undefined}
                      onClick={() => setKitView("build")}
                    >
                      Build your own art kit.
                    </button>
                  </h2>

                  <h2>
                    <button
                      type="button"
                      className={`kit-heading-link${kitView === "saved" ? " is-active" : ""}`}
                      aria-current={kitView === "saved" ? "page" : undefined}
                      onClick={() => {
                        setKitSearchOpen(false);
                        setKitView("saved");
                      }}
                    >
                      Saved Art Kits
                    </button>
                  </h2>
                </div>

                <p>
                  {kitView === "build"
                    ? "Choose the supplies you need and put together your own personalized art kit."
                    : "Review your saved kits, edit them, or add their products to your cart."}
                </p>
              </div>
            </div>

            {kitView === "build" && (
            <>
            {!user && (
              <p className="empty-message">
                Log in to save your custom art kits.{" "}
                <button
                  type="button"
                  className="nav-link-button"
                  onClick={() => openAuth("login")}
                >
                  Log in here
                </button>
              </p>
            )}

            <form onSubmit={saveArtKit}>
              <div className="catalog-controls">
                <input
                  type="text"
                  placeholder="Art kit name"
                  value={kitName}
                  onChange={(event) => setKitName(event.target.value)}
                  maxLength={100}
                  required
                />

                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={kitDescription}
                  onChange={(event) => setKitDescription(event.target.value)}
                  maxLength={500}
                />

                <div className="kit-search-box" ref={kitSearchRef}>
                  <input
                    type="search"
                    className="kit-search-input"
                    placeholder="Search products by name..."
                    aria-label="Search products to add to your kit"
                    aria-expanded={kitSearchOpen}
                    autoComplete="off"
                    value={kitSearch}
                    onFocus={() => setKitSearchOpen(true)}
                    onChange={(event) => {
                      setKitSearch(event.target.value);
                      setKitSearchOpen(true);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setKitSearchOpen(false);
                    }}
                  />

                  {kitSearchOpen && (
                    <div className="kit-search-dropdown">
                {kitSearch.trim() === "" ? (
                  <p className="kit-search-hint">
                    Start typing to find products to add to your kit.
                  </p>
                ) : kitSearchMatches.length === 0 ? (
                  <p className="kit-search-hint">
                    No products match &quot;{kitSearch.trim()}&quot;. Try a
                    different name or category.
                  </p>
                ) : (
                  <>
                    <ul className="kit-search-results">
                      {kitSearchMatches.slice(0, KIT_SEARCH_LIMIT).map((product) => {
                        const inKit = kitItems.some(
                          (item) => item.productId === product.id
                        );
                        const outOfStock = product.stock <= 0;

                        return (
                          <li className="kit-search-item" key={product.id}>
                            <div className="kit-search-thumb">
                              {getProductImage(product) ? (
                                <img
                                  src={getProductImage(product)}
                                  alt={product.name}
                                  loading="lazy"
                                />
                              ) : (
                                <span>{product.icon || "🎨"}</span>
                              )}
                            </div>

                            <div className="kit-search-info">
                              <strong>{product.name}</strong>
                              <span>{product.category}</span>
                              <span>
                                ₱{product.price.toLocaleString("en-PH")}
                              </span>
                            </div>

                            {inKit ? (
                              <button
                                type="button"
                                className="kit-search-button is-added"
                                onClick={() => removeKitItem(product.id)}
                              >
                                Added · Remove
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="kit-search-button"
                                disabled={outOfStock}
                                onClick={() => addKitItem(product.id)}
                              >
                                {outOfStock ? "Out of stock" : "Add"}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    {kitSearchMatches.length > KIT_SEARCH_LIMIT && (
                      <p className="kit-search-hint">
                        Showing the first {KIT_SEARCH_LIMIT} of{" "}
                        {kitSearchMatches.length} matches. Keep typing to
                        narrow the results.
                      </p>
                    )}
                  </>
                )}
                    </div>
                  )}
                </div>
              </div>

              <h3>Your selected items</h3>

              {kitItems.length === 0 ? (
                <p className="empty-message">
                  Your kit is empty. Choose products from the list above.
                </p>
              ) : (
                <div className="product-grid kit-selected-grid">
                  {kitItems.map((item) => {
                    const product = products.find((p) => p.id === item.productId);

                    if (!product) return null;

                    return (
                      <article className="product-card" key={item.productId}>
                        <div className="product-info">
                          <h3>{product.name}</h3>
                          <p>₱{product.price.toLocaleString("en-PH")} each</p>

                          <div className="catalog-controls">
                            <label>
                              Quantity
                              <input
                                type="number"
                                min="1"
                                max={product.stock}
                                value={item.quantity}
                                onChange={(event) =>
                                  updateKitItemQuantity(
                                    item.productId,
                                    event.target.value
                                  )
                                }
                              />
                            </label>

                            <button
                              type="button"
                              className="kit-remove-button"
                              onClick={() => removeKitItem(item.productId)}
                            >
                              Remove
                            </button>
                          </div>

                          <strong>
                            Subtotal: ₱
                            {(product.price * item.quantity).toLocaleString(
                              "en-PH"
                            )}
                          </strong>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              <div className="cart-total">
                <span>Estimated kit total</span>
                <strong>₱{kitTotal.toLocaleString("en-PH")}</strong>
              </div>

              <button
                className="checkout-button"
                type="submit"
                disabled={kitBusy || !user || kitItems.length === 0}
              >
                {kitBusy
                  ? "Saving..."
                  : editingKitId !== null
                    ? "Update My Art Kit"
                    : "Save My Art Kit"}
              </button>

              {editingKitId !== null && (
                <button
                  type="button"
                  className="back-button"
                  onClick={cancelKitEdit}
                  disabled={kitBusy}
                >
                  Cancel editing
                </button>
              )}
            </form>
            </>
            )}

            {kitMessage && <p className="empty-message">{kitMessage}</p>}

            {kitView === "saved" && (
            <div>

              {!user ? (
                <p className="empty-message">Log in to view your saved kits.</p>
              ) : savedKits.length === 0 ? (
                <p className="empty-message">
                  You haven&apos;t saved any art kits yet.
                </p>
              ) : (
                <div className="product-grid kit-grid">
                  {savedKits.map((kit) => (
                    <article className="product-card kit-card" key={kit.id}>
                      <button
                        type="button"
                        className="kit-delete-button"
                        aria-label={`Delete ${kit.name}`}
                        title="Delete kit"
                        onClick={() => deleteArtKit(kit.id)}
                        disabled={kitBusy}
                      >
                        ×
                      </button>

                      <div className="product-info kit-card-info">
                        <div className="kit-card-header">
                          <button
                            type="button"
                            className="kit-edit-button"
                            aria-label={`Edit ${kit.name}`}
                            title="Edit kit"
                            onClick={() => editArtKit(kit)}
                            disabled={kitBusy}
                          >
                            <svg
                              className="kit-card-icon"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path
                                d="M14.5 3.5l6 6-3.2 3.2-6-6 3.2-3.2zM10.2 7.8l6 6-2.4 6.4L4 20l-.2-.2 1-9.8 5.4-2.2z"
                                fill="currentColor"
                              />
                            </svg>
                          </button>
                          <h3>{kit.name}</h3>
                        </div>

                        <p className="kit-card-description">
                          {kit.description || "No description provided."}
                        </p>

                        <ul className="kit-card-items">
                          {kit.items?.map((item) => (
                            <li key={item.id}>
                              {item.product?.name || "Product"} × {item.quantity}
                            </li>
                          ))}
                        </ul>

                        <div className="kit-card-actions">
                          <strong className="kit-card-total">
                            Estimated total: ₱
                            {(kit.items || [])
                              .reduce(
                                (sum, item) =>
                                  sum + Number(item.product?.price || 0) * item.quantity,
                                0
                              )
                              .toLocaleString("en-PH")}
                          </strong>

                          <button
                            type="button"
                            className="checkout-button"
                            onClick={() => addKitToCart(kit)}
                            disabled={kitBusy || !kit.items?.length}
                          >
                            Add Kit to Cart
                          </button>

                          <div className="kit-card-status" aria-live="polite">
                            {kitCartMessage.kitId === kit.id && kitCartMessage.text && (
                              <p className="empty-message">{kitCartMessage.text}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
            )}
          </section>
        ) : activePage === "compatibility" ? (
          /* L3 FEATURE 2: DEVICE COMPATIBILITY CHECKER */
          <section className="shop-section" id="compatibility">
            <div className="shop-heading">
              <div>
                <span className="eyebrow">CHECK BEFORE YOU BUY</span>
                <h2>Device compatibility checker.</h2>
                <p>
                  Select your drawing tablet to see which accessories are listed
                  as compatible with it.
                </p>
              </div>
            </div>

            {compatibilityError && (
              <p className="empty-message" role="alert">{compatibilityError}</p>
            )}

            {tabletsLoading ? (
              <p>Loading available drawing tablets...</p>
            ) : tablets.length === 0 ? (
              !compatibilityError && (
                <p className="empty-message">
                  No drawing tablets have compatibility records yet.
                </p>
              )
            ) : (
              <CompatibilityTabletDropdown
                tablets={tablets}
                selectedTabletId={selectedTabletId}
                onChange={handleTabletChange}
              />
            )}

            {compatibilityLoading && <p>Checking compatible accessories...</p>}

            {selectedTabletId && !compatibilityLoading && (
              <>
                <h3>Compatible accessories</h3>

                {compatibleAccessories.length === 0 ? (
                  <p className="empty-message">
                    No compatible accessories were found for this tablet.
                  </p>
                ) : (
                  <CompatibleAccessoryGrid
                    accessories={compatibleAccessories}
                    cartBusy={cartBusy}
                    isOnline={isOnline}
                    onAddToCart={addToCart}
                    onViewAccessory={openProductDetails}
                  />
                )}
              </>
            )}
          </section>
        ) : (
          /* MAIN STOREFRONT */
          <>
            {!isMobileShopPage && (
              <section className="hero" id="home">
              <div className="hero-content">
                <span className="eyebrow">YOUR CREATIVE SPACE</span>

                <h1>
                  Make room
                  <br />
                  for <span>creativity.</span>
                </h1>

                <p>
                  Everything you need to bring your imagination to life. From
                  traditional art materials to digital tools.
                </p>

                <a
                  className="hero-button"
                  href="#shop"
                  onClick={navClick("shop", "shop")}
                >
                  Explore supplies <span>↗</span>
                </a>
              </div>

              <div className="hero-art">
                <div className="hero-circle circle-one"></div>
                <div className="hero-circle circle-two"></div>
                <div className="hero-emoji">🎨</div>
                <span className="floating-note note-one">CREATE MORE ✦</span>
                <span className="floating-note note-two">ART STARTS HERE!</span>
              </div>
              </section>
            )}

            {!isPhoneViewport && (
              <section className="category-section" id="categories">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">FIND YOUR MEDIUM</span>
                    <h2>What are we creating today?</h2>
                  </div>
                </div>

                <div className="category-list">
                  <button
                    onClick={() => {
                      setCategory("Painting");
                      scrollToId("shop");
                    }}
                    className="category-card painting"
                  >
                    <span>🖌️</span>
                    <strong>Painting</strong>
                    <small>Colors & brushes</small>
                  </button>

                  <button
                    onClick={() => {
                      setCategory("Drawing");
                      scrollToId("shop");
                    }}
                    className="category-card drawing"
                  >
                    <span>✏️</span>
                    <strong>Drawing</strong>
                    <small>Pencils & paper</small>
                  </button>

                  <button
                    onClick={() => {
                      setCategory("Digital Art");
                      scrollToId("shop");
                    }}
                    className="category-card digital"
                  >
                    <span>🖥️</span>
                    <strong>Digital Art</strong>
                    <small>Tablets & accessories</small>
                  </button>
                </div>
              </section>
            )}

            {isMobileShopPage && (
              <nav
                className="mobile-medium-nav"
                id="mobile-shop-top"
                aria-label="Find your medium"
              >
                <span className="eyebrow">FIND YOUR MEDIUM</span>
                <div className="mobile-medium-nav-list">
                  {categories.map((item) => (
                    <button
                      type="button"
                      key={item}
                      className={
                        category === item
                          ? "mobile-medium-option active"
                          : "mobile-medium-option"
                      }
                      aria-pressed={category === item}
                      onClick={() => setCategory(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </nav>
            )}

            {(!isPhoneViewport || isMobileShopPage) && (
              <section
                className={
                  isMobileShopPage
                    ? "shop-section mobile-shop-section"
                    : "shop-section"
                }
                id="shop"
              >
              <div className="shop-heading">
                <div>
                  <span className="eyebrow">THE ART SUPPLY SHELF</span>
                  <h2>Find your next favorite.</h2>
                </div>

                <div className="catalog-controls">
                  <input
                    className="search-input"
                    type="search"
                    placeholder="Search art supplies..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />

                  <input
                    aria-label="Minimum price"
                    type="number"
                    min="0"
                    placeholder="Min ₱"
                    value={minPrice}
                    onChange={(event) => setMinPrice(event.target.value)}
                  />

                  <input
                    aria-label="Maximum price"
                    type="number"
                    min="0"
                    placeholder="Max ₱"
                    value={maxPrice}
                    onChange={(event) => setMaxPrice(event.target.value)}
                  />

                  <select
                    aria-label="Sort products"
                    value={sortOrder}
                    onChange={(event) => setSortOrder(event.target.value)}
                  >
                    <option value="newest">Newest</option>
                    <option value="price-low">Price: low to high</option>
                    <option value="price-high">Price: high to low</option>
                    <option value="name">Name A-Z</option>
                  </select>
                </div>
              </div>

              <div className="filter-list">
                {categories.map((item) => (
                  <button
                    key={item}
                    className={category === item ? "filter active" : "filter"}
                    onClick={() => setCategory(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              {loading && <SkeletonLoader count={4} />}

              {error && (
                <p className="empty-message">
                  {error} Make sure your backend server is running.
                </p>
              )}

              {!loading && !error && (
                <>
                  <div className="product-grid">
                    {filteredProducts.map((product) => (
                      <article
                        className="product-card"
                        key={product.id}
                        onClick={() => openProductDetails(product)}
                        style={{ cursor: "pointer" }}
                      >
                        <div className={`product-art ${product.color}`}>
                          {getProductImage(product) ? (
                            <img
                              className="product-img"
                              src={getProductImage(product)}
                              alt={product.name}
                              loading="lazy"
                            />
                          ) : (
                            <span className="product-emoji">{product.icon}</span>
                          )}

                          <span className="product-category">
                            {product.category}
                          </span>
                        </div>

                        <div className="product-info">
                          <h3>{product.name}</h3>

                          <p>{product.shortDescription}</p>

                          <div className="product-bottom">
                            <strong>
                              ₱{product.price.toLocaleString("en-PH")}
                            </strong>

                            <button
                              disabled={product.stock <= 0 || cartBusy}
                              onClick={(event) => {
                                event.stopPropagation();
                                addToCart(product);
                              }}
                            >
                              {product.stock <= 0 ? "Out of stock" : "+ Add"}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>

                  {filteredProducts.length === 0 && (
                    <p className="empty-message">
                      No supplies found. Try another search!
                    </p>
                  )}
                </>
              )}
            </section>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer>
        <a className="brand" href="#home" onClick={navClick("shop", "home")}>
          ✳ artistry<span className="brand-dot">.</span>
        </a>

        <p>Made for the love of creating.</p>

        <span>© 2026 Artistry Supplies</span>
      </footer>

      {/* Login / Sign up */}
      {authMode && (
        <AuthModal
          key={authMode}
          initialMode={authMode}
          onClose={closeAuth}
          onSuccess={handleAuthSuccess}
        />
      )}

      {adminOpen && user?.role === "admin" && (
        <Suspense fallback={<div className="loading-overlay" role="status">Loading admin...</div>}>
          <AdminDashboard onClose={() => setAdminOpen(false)} />
        </Suspense>
      )}

      {ordersOpen && user && (
        <Suspense fallback={<div className="loading-overlay" role="status">Loading orders...</div>}>
          <OrderHistory onClose={() => setOrdersOpen(false)} />
        </Suspense>
      )}

      {checkoutOpen && user && (
        <CheckoutForm
          busy={cartBusy}
          isOnline={isOnline}
          onClose={() => {
            setCheckoutOpen(false);
            setCartOpen(true);
          }}
          onSubmit={checkout}
        />
      )}

      {!adminOpen && !ordersOpen && (
        <Suspense fallback={null}>
          <AIAssistant initialOpen={location.pathname === "/ai-assistant"} />
        </Suspense>
      )}

      {/* Shopping Cart */}
      {cartOpen && user && (
        <div className="cart-overlay" onClick={() => setCartOpen(false)}>
          <div
            className="cart-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cart-header">
              <h2>Your Shopping Cart</h2>

              <button type="button" onClick={() => setCartOpen(false)}>✕</button>
            </div>

            {cart.length === 0 ? (
              <p className="empty-message">
                Your cart is empty. Let&apos;s get creative!
              </p>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map((item) => (
                    <div className="cart-item" key={item.id}>
                      <div className="cart-item-icon">
                        {item.icon || productDetails[item.id]?.icon || "🎨"}
                      </div>

                      <div className="cart-item-info">
                        <strong>{item.name}</strong>

                        <p>₱{item.price.toLocaleString("en-PH")}</p>

                        <div className="quantity-controls">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            disabled={cartBusy || !isOnline}
                            title={!isOnline ? "Reconnect to update your cart" : undefined}
                          >
                            −
                          </button>

                          <span>{item.quantity}</span>

                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            disabled={item.quantity >= item.stock || cartBusy || !isOnline}
                            title={!isOnline ? "Reconnect to update your cart" : undefined}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <button
                        className="remove-item"
                        onClick={() => removeFromCart(item.id)}
                        disabled={cartBusy || !isOnline}
                        title={!isOnline ? "Reconnect to update your cart" : undefined}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <div className="cart-total">
                  <span>Subtotal</span>

                  <strong>₱{cartTotal.toLocaleString("en-PH")}</strong>
                </div>

                <button
                  className="checkout-button"
                  type="button"
                  onClick={() => {
                    setCartOpen(false);
                    setCheckoutOpen(true);
                  }}
                  disabled={cartBusy || !isOnline}
                  title={!isOnline ? "Reconnect to checkout" : undefined}
                >
                  {cartBusy ? "Please wait..." : "Proceed to Checkout"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;