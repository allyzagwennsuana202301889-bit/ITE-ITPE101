# Artistry - Business Concept

## Business Overview

Artistry is an online retail application for art supplies and related creative
equipment. It allows customers to browse products, maintain a shopping cart,
place and track orders, use Maya payment checkout, and access specialized
features for art kits and drawing-tablet accessories.

The application centralizes product discovery and purchasing for students,
artists, hobbyists, and beginners.

## Target Customers

- Students and learners purchasing materials for school or creative projects
- Artists and hobbyists looking for art supplies
- Beginners seeking organized starter materials
- Customers needing compatible accessories for an existing drawing tablet

## Business Objectives

1. Provide an accessible online store for art supplies.
2. Support product discovery through search, category, sorting, and filters.
3. Maintain accurate stock and cart quantities.
4. Support secure account access and customer-order ownership.
5. Provide Maya checkout and track payment status.
6. Allow customers to create reusable art kits.
7. Provide administrators with tools for products, inventory, coupons,
   categories, and orders.

## Customer Operations

Customers can register and sign in, browse active products, save cart items,
validate coupons, complete Maya checkout, view their own orders, retry eligible
payments, and cancel eligible unpaid orders.

Custom art kits are created from active products and positive quantities.
Customers can manage only kits that belong to their account.

The compatibility feature uses stored relationships between tablet products
and accessory products. It shows active tablets with compatibility records,
then shows active accessories linked to the selected tablet.

## Administrative Operations

Administrators can view dashboard and payment-mismatch information, manage
product records and stock, create coupons and categories, review orders, and
apply permitted order-status transitions.

Product removal is implemented as deactivation. Category deletion is restricted
when products are still assigned to the category. Administrative status
changes do not themselves perform an external Maya refund.

## Specialized Business Features

### Art Kit Builder

The Art Kit Builder lets an authenticated customer create a named combination
of products. The system verifies that at least one item is supplied, that
product IDs are valid and unique within the kit, that products are active, and
that each quantity is available in stock.

Customers can update kit details and item lists or delete and reuse their
owned kits. Adding a kit to the cart adds its products to the customer's
server-persisted cart and is subject to the normal cart and stock rules.

### Device Compatibility Checker

The compatibility checker does not infer compatibility from product names or
categories. It reads `ProductCompatibility` records created in the application
database and excludes inactive tablets or accessories.

This feature is implemented as a lookup over predefined relationships, not as
an AI or recommendation algorithm.

## System Benefits

Artistry reduces manual coordination of art-supply purchases by:

- organizing products into categories;
- checking stock before cart, kit, and checkout actions;
- associating saved kits with individual customer accounts;
- displaying only database-verified compatibility relationships;
- calculating totals and coupon discounts on the backend;
- separating customer and administrator permissions.
