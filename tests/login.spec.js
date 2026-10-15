const { test, expect } = require('@playwright/test');
const { LoginPage } = require('../pages/LoginPage');
const { InventoryPage } = require('../pages/InventoryPage');
const { user } = require('./data');

test.describe('Login', () => {
  test('standard_user can log in with valid credentials', async ({ page }) => {
    const login = new LoginPage(page);
    const inventory = new InventoryPage(page);

    await login.goto();
    await page.waitForTimeout(500);
    await login.login(user.username, user.password);

    await expect(page).toHaveURL(/inventory\.html/);
    await page.waitForTimeout(500);
    await expect(inventory.title).toHaveText('Products');
  });

  test('shows an error with a wrong password', async ({ page }) => {
    const login = new LoginPage(page);

    await login.goto();
    await page.waitForTimeout(500);
    await login.login(user.username, 'wrong_password');

    await expect(login.error).toContainText('Username and password do not match');
    await page.waitForTimeout(500);
    await expect(page).not.toHaveURL(/inventory\.html/);
  });
});
