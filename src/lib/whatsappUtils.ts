/**
 * Утилиты для интеграции с WhatsApp
 */

export interface WhatsAppOrderItem {
  product_name: string;
  quantity: number;
  price: number;
  total: number;
  unit?: string;
}

export interface WhatsAppOrderData {
  orderNumber: string;
  createdAt: string;
  items: WhatsAppOrderItem[];
  total: number;
  shippingAddress?: string;
  storeName?: string;
  customerName?: string;
}

/**
 * Форматирует номер телефона для WhatsApp ссылки
 * Убирает все символы кроме цифр, заменяет 8 на 7 в начале
 */
export function formatPhoneForWhatsApp(phone: string): string {
  // Убираем все кроме цифр
  let cleaned = phone.replace(/\D/g, '');
  
  // Если начинается с 8, заменяем на 7 (Россия)
  if (cleaned.startsWith('8') && cleaned.length === 11) {
    cleaned = '7' + cleaned.slice(1);
  }
  
  // Если нет кода страны, добавляем 7
  if (cleaned.length === 10) {
    cleaned = '7' + cleaned;
  }
  
  return cleaned;
}

/**
 * Форматирует цену с пробелами
 */
function formatPriceSpaced(price: number): string {
  return Math.round(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Генерирует текст заказа для WhatsApp
 */
export function generateOrderText(order: WhatsAppOrderData): string {
  const date = new Date(order.createdAt).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  let text = `📦 *Заказ ${order.orderNumber}*\n`;
  text += `📅 ${date}\n`;
  
  if (order.customerName) {
    text += `👤 ${order.customerName}\n`;
  }
  
  if (order.storeName) {
    text += `🏪 ${order.storeName}\n`;
  }
  
  text += `\n🛒 *Товары:*\n`;
  
  order.items.forEach((item) => {
    const qty = Number.isInteger(item.quantity) 
      ? item.quantity.toString() 
      : item.quantity.toFixed(1).replace('.', ',');
    const unit = item.unit || 'шт';
    text += `• ${item.product_name} — ${qty} ${unit} × ${formatPriceSpaced(item.price)} ₽ = ${formatPriceSpaced(item.total)} ₽\n`;
  });
  
  text += `\n💰 *Итого: ${formatPriceSpaced(order.total)} ₽*`;
  
  if (order.shippingAddress) {
    text += `\n\n📍 Доставка: ${order.shippingAddress}`;
  }
  
  return text;
}

/**
 * Генерирует ссылку WhatsApp для отправки заказа
 * @param phone - номер телефона получателя
 * @param order - данные заказа
 * @returns URL для открытия WhatsApp с предзаполненным текстом
 */
export function generateWhatsAppOrderLink(phone: string, order: WhatsAppOrderData): string {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  const text = generateOrderText(order);
  const encodedText = encodeURIComponent(text);
  
  return `https://wa.me/${formattedPhone}?text=${encodedText}`;
}

/**
 * Открывает WhatsApp с предзаполненным текстом заказа
 */
export function openWhatsAppWithOrder(phone: string, order: WhatsAppOrderData): void {
  const link = generateWhatsAppOrderLink(phone, order);
  window.open(link, '_blank');
}
