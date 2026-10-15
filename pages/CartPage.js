class CartPage {
  constructor(page) {
    this.page = page;
    this.title = page.getByTestId('title');
    this.items = page.getByTestId('inventory-item');
    this.checkoutButton = page.getByTestId('checkout');
  }

  itemName(name) {
    return this.page.getByTestId('inventory-item-name').filter({ hasText: name });
  }

  async checkout() {
    await this.checkoutButton.click();
  }
}

module.exports = { CartPage };
