// Standardized currency formatting functions
// Removes decimal places (tiyin) and adds proper spacing between thousands

/**
 * Format amount in Uzbek som without decimal places
 * @param {number|string} value - The amount to format
 * @returns {string} Formatted amount with "so'm" suffix
 */
export const formatAmountSom = (value) => {
  const num = Math.floor(Number(value) || 0);
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' so\'m';
};

/**
 * Format amount in USD without decimal places
 * @param {number|string} value - The amount to format
 * @returns {string} Formatted amount with "$" prefix
 */
export const formatAmountUSD = (value) => {
  const num = Math.floor(Number(value) || 0);
  return '$' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

/**
 * Format amount with thousands separator but no decimal places
 * @param {number|string} value - The amount to format
 * @returns {string} Formatted amount with spaces between thousands
 */
export const formatAmount = (value) => {
  const num = Math.floor(Number(value) || 0);
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

/**
 * Format amount in Uzbek som with proper spacing and no decimals
 * @param {number|string} value - The amount to format
 * @returns {string} Formatted amount with "so'm" suffix
 */
export const formatCurrency = (value) => {
  const num = Math.floor(Number(value) || 0);
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' so\'m';
};

/**
 * Format amount in USD with proper spacing and no decimals
 * @param {number|string} value - The amount to format
 * @returns {string} Formatted amount with "$" prefix
 */
export const formatCurrencyUSD = (value) => {
  const num = Math.floor(Number(value) || 0);
  return '$' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};
