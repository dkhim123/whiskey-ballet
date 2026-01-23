/**
 * Pricing Utility for Whiskey Ballet
 * Handles VAT-inclusive pricing calculations for Kenyan market (16% VAT)
 * 
 * VAT Calculation Rule:
 * - All selling prices are VAT-INCLUSIVE (customer sees final price)
 * - VAT is extracted from selling price using formula: VAT = (sellingPrice × 0.16) / 1.16
 * - Markup can be unlimited (e.g., cost 700 → selling 2,500 is valid)
 */

/**
 * Calculate VAT amount from VAT-inclusive selling price
 * Formula: VAT = (sellingPrice × vatRate) / (1 + vatRate)
 * 
 * @param {number} sellingPrice - VAT-inclusive selling price
 * @param {number} vatRate - VAT rate as decimal (0.16 for 16%)
 * @returns {number} VAT amount rounded to 2 decimals
 */
export function calculateVAT(sellingPrice, vatRate = 0.16) {
  if (!sellingPrice || sellingPrice <= 0) return 0;
  const vatAmount = (sellingPrice * vatRate) / (1 + vatRate);
  return Math.round(vatAmount * 100) / 100;
}

/**
 * Calculate price before VAT from VAT-inclusive price
 * Formula: priceBeforeVAT = sellingPrice / (1 + vatRate)
 * 
 * @param {number} sellingPrice - VAT-inclusive selling price
 * @param {number} vatRate - VAT rate as decimal (0.16 for 16%)
 * @returns {number} Price before VAT rounded to 2 decimals
 */
export function calculatePriceBeforeVAT(sellingPrice, vatRate = 0.16) {
  if (!sellingPrice || sellingPrice <= 0) return 0;
  const priceBeforeVAT = sellingPrice / (1 + vatRate);
  return Math.round(priceBeforeVAT * 100) / 100;
}

/**
 * Calculate profit (absolute amount)
 * Profit = sellingPrice - costPrice
 * 
 * @param {number} sellingPrice - VAT-inclusive selling price
 * @param {number} costPrice - Purchase/cost price (no VAT)
 * @returns {number} Profit amount rounded to 2 decimals
 */
export function calculateProfit(sellingPrice, costPrice) {
  if (!sellingPrice || !costPrice) return 0;
  const profit = sellingPrice - costPrice;
  return Math.round(profit * 100) / 100;
}

/**
 * Calculate profit margin percentage
 * Margin = ((sellingPrice - costPrice) / sellingPrice) × 100
 * 
 * @param {number} sellingPrice - VAT-inclusive selling price
 * @param {number} costPrice - Purchase/cost price
 * @returns {number} Margin percentage rounded to 2 decimals
 */
export function calculateMargin(sellingPrice, costPrice) {
  if (!sellingPrice || sellingPrice <= 0) return 0;
  const margin = ((sellingPrice - costPrice) / sellingPrice) * 100;
  return Math.round(margin * 100) / 100;
}

/**
 * Calculate markup percentage
 * Markup = ((sellingPrice - costPrice) / costPrice) × 100
 * 
 * @param {number} sellingPrice - VAT-inclusive selling price
 * @param {number} costPrice - Purchase/cost price
 * @returns {number} Markup percentage rounded to 2 decimals
 */
export function calculateMarkup(sellingPrice, costPrice) {
  if (!costPrice || costPrice <= 0) return 0;
  const markup = ((sellingPrice - costPrice) / costPrice) * 100;
  return Math.round(markup * 100) / 100;
}

/**
 * Calculate all pricing metrics for a product
 * Returns comprehensive pricing breakdown
 * 
 * @param {number} sellingPrice - VAT-inclusive selling price
 * @param {number} costPrice - Purchase/cost price
 * @param {number} vatRate - VAT rate as decimal (default 0.16)
 * @returns {Object} Complete pricing metrics
 */
export function calculatePricingMetrics(sellingPrice, costPrice, vatRate = 0.16) {
  const vatAmount = calculateVAT(sellingPrice, vatRate);
  const priceBeforeVAT = calculatePriceBeforeVAT(sellingPrice, vatRate);
  const profit = calculateProfit(sellingPrice, costPrice);
  const margin = calculateMargin(sellingPrice, costPrice);
  const markup = calculateMarkup(sellingPrice, costPrice);

  return {
    sellingPrice: Math.round(sellingPrice * 100) / 100,
    costPrice: Math.round(costPrice * 100) / 100,
    priceBeforeVAT,
    vatAmount,
    vatRate,
    profit,
    margin,
    markup
  };
}

/**
 * Format currency for Kenyan Shillings (KES)
 * Formats with thousand separators: KES 12,500.00
 * 
 * @param {number} amount - Amount to format
 * @param {boolean} includeDecimals - Whether to show decimals (default true)
 * @returns {string} Formatted currency string
 */
export function formatKES(amount, includeDecimals = true) {
  if (amount === null || amount === undefined) return 'KES 0.00';
  
  const formatted = includeDecimals
    ? amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(amount).toLocaleString('en-KE');
  
  return `KES ${formatted}`;
}

/**
 * Calculate cart totals with VAT breakdown
 * 
 * @param {Array} cartItems - Array of cart items with price and quantity
 * @param {number} discountPercentage - Discount percentage (0-100)
 * @param {number} vatRate - VAT rate as decimal (default 0.16)
 * @returns {Object} Cart totals with VAT breakdown
 */
export function calculateCartTotals(cartItems, discountPercentage = 0, vatRate = 0.16) {
  // Calculate subtotal (sum of all items)
  const subtotal = cartItems.reduce((sum, item) => {
    return sum + (item.price * item.quantity);
  }, 0);

  // Calculate discount amount
  const discountAmount = (subtotal * discountPercentage) / 100;

  // Calculate subtotal after discount
  const subtotalAfterDiscount = subtotal - discountAmount;

  // Calculate total VAT amount from discounted subtotal
  const totalVAT = calculateVAT(subtotalAfterDiscount, vatRate);

  // Calculate price before VAT
  const priceBeforeVAT = calculatePriceBeforeVAT(subtotalAfterDiscount, vatRate);

  // Final total (already includes VAT since prices are VAT-inclusive)
  const total = subtotalAfterDiscount;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountPercentage,
    discountAmount: Math.round(discountAmount * 100) / 100,
    subtotalAfterDiscount: Math.round(subtotalAfterDiscount * 100) / 100,
    priceBeforeVAT: Math.round(priceBeforeVAT * 100) / 100,
    totalVAT: Math.round(totalVAT * 100) / 100,
    total: Math.round(total * 100) / 100,
    vatRate
  };
}

/**
 * Calculate per-item VAT for transaction records
 * 
 * @param {Array} cartItems - Array of cart items
 * @param {number} vatRate - VAT rate as decimal (default 0.16)
 * @returns {Array} Cart items with VAT calculations
 */
export function calculateItemVAT(cartItems, vatRate = 0.16) {
  return cartItems.map(item => {
    const itemTotal = item.price * item.quantity;
    const itemVAT = calculateVAT(itemTotal, vatRate);
    const itemPriceBeforeVAT = calculatePriceBeforeVAT(itemTotal, vatRate);

    return {
      ...item,
      itemTotal: Math.round(itemTotal * 100) / 100,
      itemVAT: Math.round(itemVAT * 100) / 100,
      itemPriceBeforeVAT: Math.round(itemPriceBeforeVAT * 100) / 100,
      vatRate
    };
  });
}

export default {
  calculateVAT,
  calculatePriceBeforeVAT,
  calculateProfit,
  calculateMargin,
  calculateMarkup,
  calculatePricingMetrics,
  formatKES,
  calculateCartTotals,
  calculateItemVAT
};
