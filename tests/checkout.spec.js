const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');
const { InventoryPage } = require('../pages/InventoryPage');
const { CartPage } = require('../pages/CartPage');
const { CheckoutPage } = require('../pages/CheckoutPage');
const { user, product, customer } = require('./data');

test('E2E checkout: buy "Sauce Labs Onesie" until successful order', async ({ page }) => {
  const login = new LoginPage(page);
  const inventory = new InventoryPage(page);
  const cart = new CartPage(page);
  const checkout = new CheckoutPage(page);

  await test.step('Login', async () => {
    await login.goto();
    await page.waitForTimeout(500);
    await login.login(user.username, user.password);
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/inventory\.html/);
    await page.waitForTimeout(500);
    await expect(inventory.title).toHaveText('Products');
  });

  let price;
  await test.step('Add the product to the cart', async () => {
    price = await inventory.productCard(product).getByTestId('inventory-item-price').innerText();
    await inventory.addToCart(product);
    await expect(inventory.cartBadge).toHaveText('1');
  });

  await test.step('Verify the cart', async () => {
    await inventory.openCart();
    await expect(page).toHaveURL(/cart\.html/);
    await expect(cart.title).toHaveText('Your Cart');
    await expect(cart.items).toHaveCount(1);
    await expect(cart.itemName(product)).toBeVisible();
    await page.waitForTimeout(1000);
  });

  await test.step('Enter checkout information', async () => {
    await cart.checkout();
    await expect(page).toHaveURL(/checkout-step-one\.html/);
    await checkout.fillInformation(customer);
    await page.waitForTimeout(1000);
  });

  await test.step('Review the order overview', async () => {
    await expect(page).toHaveURL(/checkout-step-two\.html/);
    await expect(checkout.title).toHaveText('Checkout: Overview');
    await expect(checkout.summaryItems).toHaveCount(1);
    await expect(checkout.summaryItems.first()).toContainText(product);
    await expect(checkout.subtotal).toContainText(`Item total: ${price}`);
    await page.waitForTimeout(1000);
  });

  await test.step('Finish the order', async () => {
    await checkout.finish();
    await expect(page).toHaveURL(/checkout-complete\.html/);
    await expect(checkout.title).toHaveText('Checkout: Complete!');
    await expect(checkout.completeHeader).toHaveText('Thank you for your order!');
    await expect(checkout.completeText).toContainText('Your order has been dispatched');
    await page.waitForTimeout(1000);
  });

  await test.step('Back to products with an empty cart', async () => {
    await checkout.backHomeButton.click();
    await expect(page).toHaveURL(/inventory\.html/);
    await expect(inventory.cartBadge).toBeHidden();
    await page.waitForTimeout(1000);
  });
});
