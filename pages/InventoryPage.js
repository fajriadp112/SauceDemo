class InventoryPage {
  constructor(page) {
    this.page = page;
    this.title = page.getByTestId('title');
    this.cartLink = page.getByTestId('shopping-cart-link');
    this.cartBadge = page.getByTestId('shopping-cart-badge');
  }

  productCard(name) {
    return this.page.getByTestId('inventory-item').filter({ hasText: name });
  }

  async addToCart(name) {
    await this.productCard(name).getByRole('button', { name: 'Add to cart' }).click();
  }

  async openCart() {
    await this.cartLink.click();
  }
}

module.exports = { InventoryPage };
