import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

// Same threshold the dashboard "Low stock (≤5)" card and the backend use.
const LOW_STOCK_LIMIT = 5;

export default function AdminDashboard({ onClose }) {
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [orderStartDate, setOrderStartDate] = useState("");
  const [orderEndDate, setOrderEndDate] = useState("");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [mismatches, setMismatches] = useState([]);

  const [couponForm, setCouponForm] = useState({
    code: "",
    discountType: "percentage",
    discountValue: "",
    minimumSpend: "0",
    usageLimit: "",
    perCustomerLimit: "",
    expiresAt: "",
  });

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("overview");
  const [productView, setProductView] = useState("products");
  const [categoryDialog, setCategoryDialog] = useState(null);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [categoryDialogError, setCategoryDialogError] = useState("");
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });

  const [form, setForm] = useState({
    name: "",
    category: "Painting",
    price: "",
    stock: "",
    description: "",
    imageUrl: "",
  });

  const load = useCallback(async () => {
    try {
      setError("");

      const [
        dashboard,
        orderData,
        productData,
        categoryData,
        couponData,
        mismatchData,
      ] = await Promise.all([
        api("/admin/dashboard"),
        api("/admin/orders"),
        api("/admin/products?limit=100"),
        api("/admin/categories"),
        api("/admin/coupons"),
        api("/admin/payment-mismatches"),
      ]);

      setStats(dashboard.stats);
      setOrders(orderData.orders);
      setProducts(productData.products);
      setCategories(categoryData.categories);
      setCoupons(couponData.coupons);
      setMismatches(mismatchData.mismatches);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    window.queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const changeStatus = async (id, status) => {
    try {
      setBusy(true);

      await api(`/admin/orders/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const openCategoryDialog = (category = null) => {
    setCategoryForm({
      name: category?.name || "",
      description: category?.description || "",
    });
    setCategoryDialogError("");
    setCategoryDialog(category ? { mode: "edit", category } : { mode: "create" });
  };

  const closeCategoryDialog = () => {
    if (busy) return;
    setCategoryDialog(null);
    setCategoryDialogError("");
  };

  const saveCategory = async (event) => {
    event.preventDefault();
    if (!categoryDialog) return;

    const name = categoryForm.name.trim();
    if (!name) {
      setCategoryDialogError("Enter a category name.");
      return;
    }

    try {
      setBusy(true);
      setCategoryDialogError("");
      const payload = {
        name,
        description: categoryForm.description.trim(),
      };
      if (categoryDialog.mode === "edit") {
        await api(`/admin/categories/${categoryDialog.category.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await api("/admin/categories", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      await load();
    } catch (e) {
      setCategoryDialogError(e.message);
      return;
    } finally {
      setBusy(false);
    }

    setCategoryDialog(null);
  };

  const deleteCategory = async () => {
    if (!categoryToDelete) return;

    try {
      setBusy(true);
      setCategoryDialogError("");
      await api(`/admin/categories/${categoryToDelete.id}`, {
        method: "DELETE",
      });
      await load();
      setCategoryToDelete(null);
    } catch (e) {
      setCategoryDialogError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const addProduct = async (event) => {
    event.preventDefault();

    try {
      setBusy(true);

      await api("/admin/products", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
          stock: Number(form.stock),
        }),
      });

      setForm({
        name: "",
        category: categories[0]?.name || "Painting",
        price: "",
        stock: "",
        description: "",
        imageUrl: "",
      });

      await load();
      setTab("products");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const adjustStock = async (product) => {
    const raw = window.prompt(
      `Stock adjustment for ${product.name}. Enter a positive or negative whole number:`
    );

    if (raw === null) return;

    const reason = window.prompt(
      "Reason for this adjustment:"
    );

    if (!reason) return;

    try {
      setBusy(true);

      await api(
        `/admin/inventory/${product.id}/adjust`,
        {
          method: "POST",
          body: JSON.stringify({
            change: Number(raw),
            reason,
          }),
        }
      );

      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const editProduct = async (product) => {
    const name = window.prompt(
      "Product name:",
      product.name
    );

    if (name === null) return;

    const category = window.prompt(
      `Category (${categories.map((c) => c.name).join(", ")}):`,
      product.category
    );

    if (category === null) return;

    const price = window.prompt(
      "Price:",
      product.price
    );

    if (price === null) return;

    const stock = window.prompt(
      "Stock:",
      product.stock
    );

    if (stock === null) return;

    const description =
      window.prompt(
        "Description:",
        product.description || ""
      ) ?? product.description;

    try {
      await api(`/admin/products/${product.id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...product,
          name,
          category,
          price: Number(price),
          stock: Number(stock),
          description,
        }),
      });

      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const createCoupon = async (event) => {
    event.preventDefault();

    try {
      setBusy(true);

      await api("/admin/coupons", {
        method: "POST",
        body: JSON.stringify({
          ...couponForm,
          discountValue: Number(couponForm.discountValue),
          minimumSpend: Number(couponForm.minimumSpend),
          usageLimit: couponForm.usageLimit
            ? Number(couponForm.usageLimit)
            : null,
          perCustomerLimit: couponForm.perCustomerLimit
            ? Number(couponForm.perCustomerLimit)
            : null,
          expiresAt: couponForm.expiresAt || null,
        }),
      });

      setCouponForm({
        code: "",
        discountType: "percentage",
        discountValue: "",
        minimumSpend: "0",
        usageLimit: "",
        perCustomerLimit: "",
        expiresAt: "",
      });

      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (id) => {
    if (
      !window.confirm(
        "Deactivate this product? It will no longer appear in the shop."
      )
    ) {
      return;
    }

    try {
      await api(`/admin/products/${id}`, {
        method: "DELETE",
      });

      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const activateProduct = async (id) => {
    if (
      !window.confirm(
        "Reactivate this product? It will appear in the shop again."
      )
    ) {
      return;
    }

    try {
      await api(`/admin/products/${id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: true }),
      });

      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const formatPrice = (value) =>
    `₱${Number(value || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  

    const filteredOrders = orders.filter((order) => {
  const matchesStatus =
    orderStatusFilter === "all" ||
    order.status === orderStatusFilter;

  const dateOnly = new Date(order.createdAt)
    .toISOString()
    .slice(0, 10);

  const matchesStartDate =
    !orderStartDate || dateOnly >= orderStartDate;

  const matchesEndDate =
    !orderEndDate || dateOnly <= orderEndDate;

  return matchesStatus && matchesStartDate && matchesEndDate;
});
  return (
    <div className="admin-overlay">
      <section className="admin-panel">
        <header className="admin-header">
          <div>
            <span className="eyebrow">
              ARTISTRY MANAGEMENT
            </span>
            <h2>Admin dashboard</h2>
          </div>

          <button onClick={onClose}>✕</button>
        </header>

        

        {error && (
          <p className="empty-message">
            {error}
          </p>
        )}

        <nav className="admin-tabs">
          {[
            "overview",
            "products",
            "orders",
            "coupons",
            "add product",
            "payment mismatches",
          ].map((x) => (
            <button
              className={tab === x ? "active" : ""}
              key={x}
              onClick={() => setTab(x)}
            >
              {x}
              {x === "payment mismatches" &&
                mismatches.length > 0 && (
                  <span> ({mismatches.length})</span>
                )}
            </button>
          ))}
        </nav>

        {/* OVERVIEW */}
        {tab === "overview" && stats && (
          <>
            <div className="admin-stats">
              {[
                ["Active products", stats.products],
                ["Customers", stats.customers],
                ["Orders", stats.orders],
                [
                  "Recorded revenue",
                  formatPrice(stats.revenue),
                ],
                ["Low stock (≤5)", stats.lowStock],
              ].map(([label, value]) => (
                <article key={label}>
                  <small>{label}</small>
                  <strong>{value}</strong>
                </article>
              ))}
            </div>

            <h3>Recent orders</h3>

            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {orders.slice(0, 8).map((o) => (
                    <tr key={o.id}>
                      <td>{o.orderNumber}</td>
                      <td>{o.user?.name}</td>
                      <td>{formatPrice(o.total)}</td>
                      <td>{o.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* PRODUCTS */}
        {tab === "products" && (
          <>
            <div className="admin-section-heading">
              <h3>Products & inventory</h3>

              {productView === "categories" && (
                <button
                  type="button"
                  className="admin-add-category"
                  onClick={() => openCategoryDialog()}
                >
                  Add category
                </button>
              )}
            </div>

            <div className="admin-subtabs">
              {[
                ["products", "Products"],
                ["categories", "Categories"],
              ].map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  className={productView === key ? "active" : ""}
                  onClick={() => setProductView(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {productView === "categories" && (
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Products</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {categories.map((c) => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{c.description || "—"}</td>
                        <td>
                          {
                            products.filter(
                              (p) => p.category === c.name
                            ).length
                          }
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => openCategoryDialog(c)}
                          >
                            Edit
                          </button>{" "}

                          <button
                            type="button"
                            onClick={() => {
                              setCategoryDialogError("");
                              setCategoryToDelete(c);
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {productView === "products" && (
            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {products.map((p) => (
                    <tr
                      key={p.id}
                      className={
                        p.isActive && p.stock <= LOW_STOCK_LIMIT
                          ? "admin-low-stock-row"
                          : undefined
                      }
                    >
                      <td>{p.name}</td>
                      <td>{formatPrice(p.price)}</td>
                      <td>{p.stock}</td>
                      <td>
                        {p.isActive ? "Active" : "Inactive"}
                      </td>
                      <td>
                        <button
                          onClick={() => editProduct(p)}
                        >
                          Edit
                        </button>{" "}

                        <button
                          onClick={() => adjustStock(p)}
                          disabled={busy}
                        >
                          Adjust stock
                        </button>{" "}

                        {p.isActive ? (
                          <button
                            onClick={() => deactivate(p.id)}
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => activateProduct(p.id)}
                          >
                            Activate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </>
        )}

        {/* ORDERS */}
        {tab === "orders" && (
          <>
            <h3>Order management</h3>

            <div className="admin-order-filters">
  <label>
    Status
    <select
      value={orderStatusFilter}
      onChange={(e) => setOrderStatusFilter(e.target.value)}
    >
      <option value="all">All statuses</option>
      <option value="pending_payment">Pending payment</option>
      <option value="paid">Paid</option>
      <option value="processing">Processing</option>
      <option value="shipped">Shipped</option>
      <option value="completed">Completed</option>
      <option value="cancelled">Cancelled</option>
      <option value="refunded">Refunded</option>
    </select>
  </label>

  <label>
    From
    <input
      type="date"
      value={orderStartDate}
      onChange={(e) => setOrderStartDate(e.target.value)}
    />
  </label>

  <label>
    To
    <input
      type="date"
      value={orderEndDate}
      onChange={(e) => setOrderEndDate(e.target.value)}
    />
  </label>

  <button
    type="button"
    className="admin-clear-filters"
    onClick={() => {
      setOrderStatusFilter("all");
      setOrderStartDate("");
      setOrderEndDate("");
    }}
  >
    Clear filters
  </button>
</div>

            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Total</th>
                    <th>Update status</th>
                    <th>Status history</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredOrders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.orderNumber}</td>
                      <td>{o.user?.name}</td>
                      <td>{formatPrice(o.total)}</td>
                      <td>
                        <select
                          value={o.status}
                          disabled={busy}
                          onChange={(e) =>
                            changeStatus(o.id, e.target.value)
                          }
                        >
                          {[
                            o.status,
                            ...({
                              pending: ["cancelled"],
                              pending_payment: ["cancelled"],
                              paid: ["processing", "refunded"],
                              processing: ["shipped", "refunded"],
                              shipped: ["completed", "refunded"],
                              completed: [],
                              cancelled: [],
                              refunded: [],
                            }[o.status] || []),
                          ]
                            .filter(
                              (status, index, list) =>
                                list.indexOf(status) === index
                            )
                            .map((status) => (
                              <option
                                key={status}
                                value={status}
                              >
                                {status}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td>
  <details>
    <summary>
      View history ({o.statusHistory?.length || 0})
    </summary>

    {o.statusHistory?.length ? (
      <ul>
        {o.statusHistory.map((entry) => (
          <li key={entry.id}>
            {entry.fromStatus || "Created"} → {entry.toStatus}
            {" · "}
            {new Date(entry.createdAt).toLocaleString()}
          </li>
        ))}
      </ul>
    ) : (
      <p>No status history available.</p>
    )}
  </details>
</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* COUPONS */}
        {tab === "coupons" && (
          <>
            <h3>Coupons and discounts</h3>

            <form
              className="admin-product-form"
              onSubmit={createCoupon}
            >
              <label>
                Code
                <input
                  required
                  minLength="3"
                  value={couponForm.code}
                  onChange={(e) =>
                    setCouponForm({
                      ...couponForm,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                />
              </label>

              <label>
                Discount type
                <select
                  value={couponForm.discountType}
                  onChange={(e) =>
                    setCouponForm({
                      ...couponForm,
                      discountType: e.target.value,
                    })
                  }
                >
                  <option value="percentage">
                    Percentage
                  </option>
                  <option value="fixed">
                    Fixed amount (₱)
                  </option>
                </select>
              </label>

              <label>
                Discount value
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={couponForm.discountValue}
                  onChange={(e) =>
                    setCouponForm({
                      ...couponForm,
                      discountValue: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Minimum spend
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={couponForm.minimumSpend}
                  onChange={(e) =>
                    setCouponForm({
                      ...couponForm,
                      minimumSpend: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Total usage limit
                <input
                  type="number"
                  min="1"
                  value={couponForm.usageLimit}
                  onChange={(e) =>
                    setCouponForm({
                      ...couponForm,
                      usageLimit: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Per-customer limit
                <input
                  type="number"
                  min="1"
                  value={couponForm.perCustomerLimit}
                  onChange={(e) =>
                    setCouponForm({
                      ...couponForm,
                      perCustomerLimit: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Expiry date
                <input
                  type="date"
                  value={couponForm.expiresAt}
                  onChange={(e) =>
                    setCouponForm({
                      ...couponForm,
                      expiresAt: e.target.value,
                    })
                  }
                />
              </label>

              <button
                className="checkout-button"
                disabled={busy}
              >
                Create coupon
              </button>
            </form>

            <div className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Discount</th>
                    <th>Used</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {coupons.map((c) => (
                    <tr key={c.id}>
                      <td>{c.code}</td>
                      <td>
                        {c.discountType === "percentage"
                          ? `${c.discountValue}%`
                          : formatPrice(c.discountValue)}
                      </td>
                      <td>
                        {c.usedCount}
                        {c.usageLimit
                          ? ` / ${c.usageLimit}`
                          : ""}
                      </td>
                      <td>
                        {c.isActive ? "Active" : "Inactive"}
                      </td>
                      <td>
                        <button
                          onClick={async () => {
                            try {
                              await api(
                                `/admin/coupons/${c.id}`,
                                {
                                  method: "PATCH",
                                  body: JSON.stringify({
                                    isActive: !c.isActive,
                                  }),
                                }
                              );

                              await load();
                            } catch (e) {
                              setError(e.message);
                            }
                          }}
                        >
                          {c.isActive
                            ? "Deactivate"
                            : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ADD PRODUCT */}
        {tab === "add product" && (
          <form
            className="admin-product-form"
            onSubmit={addProduct}
          >
            <h3>Add product</h3>

            <label>
              Name
              <input
                required
                minLength="2"
                value={form.name}
                onChange={(e) =>
                  setForm({
                    ...form,
                    name: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Category
              <select
                value={form.category}
                onChange={(e) =>
                  setForm({
                    ...form,
                    category: e.target.value,
                  })
                }
              >
                {categories.map((c) => (
                  <option key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Price (₱)
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) =>
                  setForm({
                    ...form,
                    price: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Stock
              <input
                required
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={(e) =>
                  setForm({
                    ...form,
                    stock: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Description
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({
                    ...form,
                    description: e.target.value,
                  })
                }
              />
            </label>

            <label>
              Image URL
              <input
                type="url"
                value={form.imageUrl}
                onChange={(e) =>
                  setForm({
                    ...form,
                    imageUrl: e.target.value,
                  })
                }
              />
            </label>

            <button
              className="checkout-button"
              disabled={busy}
            >
              Save product
            </button>
          </form>
        )}

        {/* PAYMENT MISMATCHES */}
        {tab === "payment mismatches" && (
          <>
            <div className="admin-section-heading">
              <div>
                <h3>Payment mismatches</h3>
                <p>
                  Payments flagged because their amount or
                  currency did not match the Artistry order.
                </p>
              </div>

              <button
                type="button"
                className="admin-refresh-button"
                onClick={load}
                disabled={busy}
              >
                <span aria-hidden="true">↻</span> Refresh
              </button>
            </div>

            {mismatches.length === 0 ? (
              <p className="empty-message">
                No payment mismatches have been recorded.
              </p>
            ) : (
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Order</th>
                      <th>Maya payment ID</th>
                      <th>Event</th>
                      <th>Payment status</th>
                      <th>Mismatch details</th>
                    </tr>
                  </thead>

                  <tbody>
                    {mismatches.map((m) => (
                      <tr key={m.id}>
                        <td>
                          {m.createdAt
                            ? new Date(
                                m.createdAt
                              ).toLocaleString("en-PH")
                            : "—"}
                        </td>

                        <td>
                          {m.order?.orderNumber || "Unmatched"}
                          {m.order && (
                            <small>
                              <br />
                              Order #{m.order.id}
                            </small>
                          )}
                        </td>

                        <td>
                          <small>{m.paymentId}</small>
                        </td>

                        <td>{m.eventType}</td>

                        <td>
                          {m.payment?.status || "Unknown"}
                        </td>

                        <td>
                          {m.errorMessage || "No details recorded"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {categoryDialog && (
        <div
          className="admin-dialog-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeCategoryDialog();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") closeCategoryDialog();
          }}
        >
          <section
            className="admin-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="admin-dialog-header">
              <div>
                <span className="eyebrow">PRODUCT ORGANIZATION</span>
                <h2 id="category-dialog-title">
                  {categoryDialog.mode === "edit" ? "Edit category" : "New category"}
                </h2>
                <p>Add a clear name and optional description for this category.</p>
              </div>
              <button
                type="button"
                className="admin-dialog-close"
                aria-label="Close dialog"
                onClick={closeCategoryDialog}
                disabled={busy}
              >
                ×
              </button>
            </header>

            <form className="admin-dialog-form" onSubmit={saveCategory} noValidate>
              <label htmlFor="category-dialog-name">Category name</label>
              <input
                id="category-dialog-name"
                type="text"
                value={categoryForm.name}
                onChange={(event) =>
                  setCategoryForm({ ...categoryForm, name: event.target.value })
                }
                autoFocus
                required
              />

              <label htmlFor="category-dialog-description">Description</label>
              <textarea
                id="category-dialog-description"
                rows="4"
                value={categoryForm.description}
                onChange={(event) =>
                  setCategoryForm({
                    ...categoryForm,
                    description: event.target.value,
                  })
                }
              />

              {categoryDialogError && (
                <p className="admin-dialog-error" role="alert">
                  {categoryDialogError}
                </p>
              )}

              <div className="admin-dialog-actions">
                <button
                  type="button"
                  className="admin-dialog-cancel"
                  onClick={closeCategoryDialog}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button type="submit" className="admin-dialog-submit" disabled={busy}>
                  {busy
                    ? "Saving..."
                    : categoryDialog.mode === "edit"
                      ? "Save changes"
                      : "Add category"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {categoryToDelete && (
        <div
          className="admin-dialog-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget && !busy) {
              setCategoryToDelete(null);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !busy) setCategoryToDelete(null);
          }}
        >
          <section
            className="admin-dialog admin-confirm-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-category-title"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="eyebrow">CATEGORY SETTINGS</span>
            <h2 id="delete-category-title">Delete category?</h2>
            <p>
              Delete <strong>{categoryToDelete.name}</strong>? This cannot be undone.
            </p>
            {categoryDialogError && (
              <p className="admin-dialog-error" role="alert">
                {categoryDialogError}
              </p>
            )}
            <div className="admin-dialog-actions">
              <button
                type="button"
                className="admin-dialog-cancel"
                onClick={() => setCategoryToDelete(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-dialog-delete"
                onClick={deleteCategory}
                disabled={busy}
              >
                {busy ? "Deleting..." : "Delete category"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}